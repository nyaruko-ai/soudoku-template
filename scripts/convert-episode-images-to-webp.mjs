import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const episodesDir = path.join(rootDir, "docs", "images", "episodes");
const storyDataPath = path.join(rootDir, "docs", "story-data.js");

const targetBytes = 950_000;
const qualities = [82, 78, 74, 70, 66, 62, 58, 54, 50, 46, 42];
const scales = [1, 0.92, 0.85];

function isEpisodePng(fileName) {
  return /^scene-\d{3}-\d{3}-\d{3}\.png$/.test(fileName);
}

async function encodeCandidate(inputPath, width, scale, quality) {
  const pipeline = sharp(inputPath);

  if (scale < 1) {
    pipeline.resize({
      width: Math.max(1, Math.round(width * scale)),
      withoutEnlargement: true,
    });
  }

  return pipeline
    .webp({
      quality,
      effort: 6,
    })
    .toBuffer();
}

async function convertEpisodeImage(inputPath, outputPath) {
  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width ?? 1080;

  let bestMatch = null;
  let smallest = null;

  for (const scale of scales) {
    for (const quality of qualities) {
      const buffer = await encodeCandidate(inputPath, width, scale, quality);
      const candidate = {
        buffer,
        bytes: buffer.length,
        quality,
        scale,
      };

      if (!smallest || candidate.bytes < smallest.bytes) {
        smallest = candidate;
      }

      if (candidate.bytes <= targetBytes) {
        bestMatch = candidate;
        break;
      }
    }

    if (bestMatch) {
      break;
    }
  }

  const selected = bestMatch ?? smallest;
  await writeFile(outputPath, selected.buffer);

  return selected;
}

async function main() {
  const files = (await readdir(episodesDir))
    .filter(isEpisodePng)
    .sort((left, right) => left.localeCompare(right));

  let totalBytes = 0;
  let maxBytes = 0;
  let overTargetCount = 0;

  for (const fileName of files) {
    const inputPath = path.join(episodesDir, fileName);
    const outputPath = path.join(episodesDir, fileName.replace(/\.png$/, ".webp"));
    const result = await convertEpisodeImage(inputPath, outputPath);

    totalBytes += result.bytes;
    maxBytes = Math.max(maxBytes, result.bytes);

    if (result.bytes > targetBytes) {
      overTargetCount += 1;
    }

    await unlink(inputPath);
    process.stdout.write(
      `${fileName} -> ${path.basename(outputPath)} ${result.bytes}B q=${result.quality} scale=${result.scale}\n`,
    );
  }

  const storyData = await readFile(storyDataPath, "utf8");
  const updatedStoryData = storyData.replace(
    /\.\/images\/episodes\/(scene-\d{3}-\d{3}-\d{3})\.png/g,
    "./images/episodes/$1.webp",
  );
  await writeFile(storyDataPath, updatedStoryData, "utf8");

  process.stdout.write(
    `converted=${files.length} avg=${Math.round(totalBytes / files.length)} max=${maxBytes} overTarget=${overTargetCount}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
