import { execFileSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const promptPath = path.join(rootDir, "prompts", "character-portraits.json");

function usage() {
  process.stderr.write(
    "Usage: node scripts/generate-character-portrait.mjs <character-id|--all> [reference-image-path] [--parallel=2]\n",
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

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      throw new Error(`Unsupported image type: ${ext}`);
  }
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

function readImageSize(filePath) {
  const output = execFileSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", "-1", filePath],
    { encoding: "utf8" },
  );

  const widthMatch = output.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = output.match(/pixelHeight:\s+(\d+)/);

  if (!widthMatch || !heightMatch) {
    throw new Error(`Failed to read dimensions for ${filePath}`);
  }

  return {
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1]),
  };
}

function centerCropToSize(sourcePath, targetPath, targetWidth, targetHeight) {
  const targetDir = path.dirname(targetPath);
  const resizedPath = path.join(
    targetDir,
    `${path.basename(targetPath, path.extname(targetPath))}.resized.png`,
  );

  try {
    execFileSync(
      "sips",
      ["--resampleHeight", String(targetHeight), sourcePath, "--out", resizedPath],
      { stdio: "pipe" },
    );

    const resized = readImageSize(resizedPath);
    if (resized.width < targetWidth || resized.height < targetHeight) {
      execFileSync(
        "sips",
        ["--resampleWidth", String(targetWidth), resizedPath, "--out", resizedPath],
        { stdio: "pipe" },
      );
    }

    const finalSize = readImageSize(resizedPath);
    const offsetY = Math.max(0, Math.floor((finalSize.height - targetHeight) / 2));
    const offsetX = Math.max(0, Math.floor((finalSize.width - targetWidth) / 2));

    execFileSync(
      "sips",
      [
        "--cropToHeightWidth",
        String(targetHeight),
        String(targetWidth),
        "--cropOffset",
        String(offsetY),
        String(offsetX),
        resizedPath,
        "--out",
        targetPath,
      ],
      { stdio: "pipe" },
    );
  } finally {
    unlink(resizedPath).catch(() => {});
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

function buildPrompt(spec, character) {
  const { fixedWidth, fixedHeight, globalPrompt, globalNegativePrompt } = spec;

  return [
    globalPrompt,
    character.prompt,
    "Keep the whole character visible within frame when possible, especially head, key costume details, hands, silhouette, and signature accessories.",
    `Final delivery will be center-cropped to ${fixedWidth}x${fixedHeight}. Keep the face, silhouette, and signature costume details near the center with safe margins.`,
    `Negative prompt: ${globalNegativePrompt}, ${character.negativePrompt || ""}`,
  ].join("\n");
}

function buildRequestBody(prompt, referenceBuffer, referenceMimeType) {
  const parts = [];

  if (referenceBuffer && referenceMimeType) {
    parts.push({
      inlineData: {
        mimeType: referenceMimeType,
        data: referenceBuffer.toString("base64"),
      },
    });
  }

  parts.push({ text: prompt });

  return {
    contents: [
      {
        parts,
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
}

async function generateCharacter(character, promptFile, apiKey, cliReferencePath) {
  const outputDir = path.join(
    rootDir,
    promptFile.spec?.outputDir || "project/assets/characters",
  );
  const referencePath =
    cliReferencePath ||
    (character.referenceImage ? path.join(rootDir, character.referenceImage) : null);
  let referenceBuffer = null;
  let referenceMimeType = null;

  if (referencePath) {
    referenceBuffer = await readFile(referencePath);
    referenceMimeType = getMimeType(referencePath);
  }

  const prompt = buildPrompt(promptFile.spec, character);
  const requestBody = buildRequestBody(prompt, referenceBuffer, referenceMimeType);
  const { fixedWidth, fixedHeight } = promptFile.spec;

  process.stdout.write(`Generating ${character.id} with ${character.model}...\n`);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${character.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
  const rawOutputPath = path.join(outputDir, `${character.id}.raw${rawExtension}`);
  const finalOutputPath = path.join(outputDir, `${character.id}.png`);
  const metadataPath = path.join(outputDir, `${character.id}.json`);

  await writeFile(rawOutputPath, Buffer.from(image.data, "base64"));
  centerCropToSize(rawOutputPath, finalOutputPath, fixedWidth, fixedHeight);

  const metadata = {
    characterId: character.id,
    name: character.name,
    model: character.model,
    generatedAt: new Date().toISOString(),
    output: path.relative(rootDir, finalOutputPath),
    rawOutput: path.relative(rootDir, rawOutputPath),
    referenceImage: referencePath ? path.relative(rootDir, referencePath) : null,
    fixedSize: {
      width: fixedWidth,
      height: fixedHeight,
    },
    prompt,
    sourceRefs: character.sourceRefs,
    responseTexts: extractTextResponses(responseJson),
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return path.relative(rootDir, finalOutputPath);
}

function parseArgs(argv) {
  const parsed = {
    target: argv[2],
    cliReferencePath: null,
    parallel: 2,
  };

  for (const arg of argv.slice(3)) {
    if (arg.startsWith("--parallel=")) {
      parsed.parallel = Number(arg.slice("--parallel=".length));
    } else if (!parsed.cliReferencePath) {
      parsed.cliReferencePath = arg;
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

  const envSource = await readFile(envPath, "utf8");
  const env = parseEnvFile(envSource);
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from .env");
  }

  const promptFile = JSON.parse(await readFile(promptPath, "utf8"));
  const characters =
    args.target === "--all"
      ? promptFile.characters
      : promptFile.characters.filter((entry) => entry.id === args.target);

  if (characters.length === 0) {
    throw new Error(`Unknown character id: ${args.target}`);
  }

  const completed = await runWithConcurrency(
    characters,
    Number.isFinite(args.parallel) && args.parallel > 0 ? args.parallel : 2,
    (character) => generateCharacter(character, promptFile, apiKey, args.cliReferencePath),
  );

  process.stdout.write(`${completed.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
