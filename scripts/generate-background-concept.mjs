import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const promptPath = path.join(rootDir, "prompts", "background-concepts.json");

function usage() {
  process.stderr.write(
    "Usage: node scripts/generate-background-concept.mjs <background-id|--all> [--parallel=2]\n",
  );
}

function parseEnvFile(source) {
  const env = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function getExtensionForMimeType(mimeType) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

function extractGeneratedImage(responseJson) {
  const candidates = responseJson.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData ?? part.inline_data;
      if (data?.data && data?.mimeType) {
        return {
          data: data.data,
          mimeType: data.mimeType,
        };
      }
    }
  }

  return null;
}

function extractTextResponses(responseJson) {
  const messages = [];

  for (const candidate of responseJson.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim()) {
        messages.push(part.text.trim());
      }
    }
  }

  return messages;
}

async function centerCropToWebp(sourcePath, targetPath, targetWidth, targetHeight) {
  await sharp(sourcePath)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "cover",
      position: "centre",
    })
    .webp({
      quality: 82,
      effort: 6,
    })
    .toFile(targetPath);
}

function buildPrompt(spec, entry) {
  return [
    spec.globalPrompt,
    entry.prompt,
    `Final delivery will be cropped to ${spec.fixedWidth}x${spec.fixedHeight}. Keep the main focal area centered with safe margins.`,
    `Negative prompt: ${spec.globalNegativePrompt}, ${entry.negativePrompt || ""}`,
  ].join(" ");
}

async function generateBackground(entry, promptFile, apiKey) {
  const outputDir = path.join(
    rootDir,
    promptFile.spec?.outputDir || "project/assets/world",
  );
  const prompt = buildPrompt(promptFile.spec, entry);

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "9:16",
        imageSize: "2K",
      },
    },
  };

  process.stdout.write(`Generating ${entry.id} with ${entry.model}...\n`);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${entry.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
  }

  const responseJson = await response.json();
  const image = extractGeneratedImage(responseJson);
  if (!image) {
    throw new Error(`Gemini response did not include an image: ${JSON.stringify(responseJson)}`);
  }

  await mkdir(outputDir, { recursive: true });

  const rawExtension = getExtensionForMimeType(image.mimeType);
  const rawPath = path.join(outputDir, `${entry.id}.raw${rawExtension}`);
  const finalPath = path.join(outputDir, `${entry.id}.webp`);
  const metadataPath = path.join(outputDir, `${entry.id}.json`);

  await writeFile(rawPath, Buffer.from(image.data, "base64"));
  await centerCropToWebp(
    rawPath,
    finalPath,
    promptFile.spec.fixedWidth,
    promptFile.spec.fixedHeight,
  );

  const metadata = {
    id: entry.id,
    name: entry.name,
    model: entry.model,
    generatedAt: new Date().toISOString(),
    output: path.relative(rootDir, finalPath),
    rawOutput: path.relative(rootDir, rawPath),
    prompt,
    responseTexts: extractTextResponses(responseJson),
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return path.relative(rootDir, finalPath);
}

function parseArgs(argv) {
  const parsed = {
    target: argv[2],
    parallel: 2,
  };

  for (const arg of argv.slice(3)) {
    if (arg.startsWith("--parallel=")) {
      parsed.parallel = Number(arg.slice("--parallel=".length));
    }
  }

  return parsed;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function consume() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => consume()));
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.target) {
    usage();
    process.exitCode = 1;
    return;
  }

  const [envSource, promptSource] = await Promise.all([
    readFile(envPath, "utf8"),
    readFile(promptPath, "utf8"),
  ]);

  const env = parseEnvFile(envSource);
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env");
  }

  const promptFile = JSON.parse(promptSource);
  const entries =
    args.target === "--all"
      ? promptFile.backgrounds
      : promptFile.backgrounds.filter((entry) => entry.id === args.target);

  if (entries.length === 0) {
    throw new Error(`Unknown background id: ${args.target}`);
  }

  const completed = await runWithConcurrency(
    entries,
    Number.isFinite(args.parallel) && args.parallel > 0 ? args.parallel : 2,
    (entry) =>
      generateBackground(
        {
          ...entry,
          model: entry.model || promptFile.spec.defaultModel,
        },
        promptFile,
        env.GEMINI_API_KEY,
      ),
  );

  process.stdout.write(`${completed.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
