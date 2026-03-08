import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const manifestPath = path.join(rootDir, "prompts", "episode-image-manifest.json");
const characterRefsPath = path.join(rootDir, "prompts", "scene-character-references.json");

function usage() {
  process.stderr.write(
    "Usage: node scripts/generate-episode-image.mjs <scene-id ...|--all> [--from=scene-001-001-001] [--limit=10] [--force] [--parallel=2]\n",
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

function parseArgs(argv) {
  const parsed = {
    targets: [],
    from: null,
    limit: null,
    force: false,
    parallel: 2,
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--from=")) {
      parsed.from = arg.slice("--from=".length);
    } else if (arg.startsWith("--limit=")) {
      parsed.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--force") {
      parsed.force = true;
    } else if (arg.startsWith("--parallel=")) {
      parsed.parallel = Number(arg.slice("--parallel=".length));
    } else if (arg.trim()) {
      parsed.targets.push(...arg.split(",").map((value) => value.trim()).filter(Boolean));
    }
  }

  return parsed;
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
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

async function generateEpisode(episode, manifest, refMap, apiKey, outputDir, force) {
  const finalPath = path.join(outputDir, `${episode.id}.webp`);
  if (!force && (await fileExists(finalPath))) {
    process.stdout.write(`Skipping existing ${episode.id}: ${path.relative(rootDir, finalPath)}\n`);
    return { id: episode.id, skipped: true, output: path.relative(rootDir, finalPath) };
  }

  process.stdout.write(`Generating ${episode.id} with ${episode.model}...\n`);

  const referenceEntries = episode.referenceCharacterIds
    .map((id) => refMap.get(id))
    .filter(Boolean)
    .slice(0, 4);

  const referenceBuffers = [];
  for (const entry of referenceEntries) {
    const referencePath = path.join(rootDir, entry.referenceImage);
    if (!(await fileExists(referencePath))) {
      process.stdout.write(`Skipping missing reference image: ${entry.referenceImage}\n`);
      continue;
    }

    referenceBuffers.push({
      id: entry.id,
      path: referencePath,
      mimeType: getMimeType(referencePath),
      data: await readFile(referencePath),
    });
  }

  const parts = referenceBuffers.map((buffer) => ({
    inlineData: {
      mimeType: buffer.mimeType,
      data: buffer.data.toString("base64"),
    },
  }));

  parts.push({
    text: [
      manifest.spec.globalPrompt,
      episode.prompt,
      `Global negative prompt: ${manifest.spec.globalNegativePrompt}.`,
      `Episode negative prompt: ${episode.negativePrompt}.`,
    ].join(" "),
  });

  const requestBody = {
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${episode.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed for ${episode.id} (${response.status}): ${errorText}`);
  }

  const responseJson = await response.json();
  const generatedImage = extractGeneratedImage(responseJson);
  if (!generatedImage) {
    throw new Error(`Gemini response did not include an image for ${episode.id}`);
  }

  const rawExtension = getExtensionForMimeType(generatedImage.mimeType);
  const rawPath = path.join(outputDir, `${episode.id}.raw${rawExtension}`);
  const metadataPath = path.join(outputDir, `${episode.id}.json`);

  await writeFile(rawPath, Buffer.from(generatedImage.data, "base64"));
  await centerCropToWebp(rawPath, finalPath, manifest.spec.fixedWidth, manifest.spec.fixedHeight);

  const metadata = {
    episodeId: episode.id,
    title: episode.title,
    chapterTitle: episode.chapterTitle,
    model: episode.model,
    generatedAt: new Date().toISOString(),
    output: path.relative(rootDir, finalPath),
    rawOutput: path.relative(rootDir, rawPath),
    referenceImages: referenceEntries.map((entry) => entry.referenceImage),
    referenceCharacterIds: episode.referenceCharacterIds,
    continuityNotes: episode.continuityNotes,
    prompt: episode.prompt,
    responseTexts: extractTextResponses(responseJson),
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  process.stdout.write(`${path.relative(rootDir, finalPath)}\n`);

  return { id: episode.id, skipped: false, output: path.relative(rootDir, finalPath) };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.targets.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  const [envSource, manifestSource, refsSource] = await Promise.all([
    readFile(envPath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(characterRefsPath, "utf8"),
  ]);

  const env = parseEnvFile(envSource);
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env");
  }

  const manifest = JSON.parse(manifestSource);
  const refs = JSON.parse(refsSource);
  const refMap = new Map(refs.characters.map((character) => [character.id, character]));

  let episodes = manifest.episodes;
  const requestedAll = args.targets.includes("--all");
  if (!requestedAll) {
    const requestedIds = new Set(args.targets);
    episodes = episodes.filter((episode) => requestedIds.has(episode.id));

    const matchedIds = new Set(episodes.map((episode) => episode.id));
    const unknownIds = args.targets.filter((id) => !matchedIds.has(id));
    if (unknownIds.length > 0) {
      throw new Error(`Unknown scene id: ${unknownIds.join(", ")}`);
    }
  } else if (args.from) {
    const fromIndex = episodes.findIndex((episode) => episode.id === args.from);
    if (fromIndex !== -1) {
      episodes = episodes.slice(fromIndex);
    }
  }

  if (typeof args.limit === "number" && Number.isFinite(args.limit) && args.limit > 0) {
    episodes = episodes.slice(0, args.limit);
  }

  if (episodes.length === 0) {
    throw new Error(`No episode matched target ${args.targets.join(", ")}`);
  }

  const outputDir = path.join(rootDir, manifest.spec.outputDir);
  await mkdir(outputDir, { recursive: true });
  await runWithConcurrency(
    episodes,
    Number.isFinite(args.parallel) && args.parallel > 0 ? args.parallel : 2,
    (episode) => generateEpisode(episode, manifest, refMap, env.GEMINI_API_KEY, outputDir, args.force),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
