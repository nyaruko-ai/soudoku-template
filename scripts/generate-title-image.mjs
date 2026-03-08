import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const promptPath = path.join(rootDir, "prompts", "title-image.json");

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
      (value.startsWith("\"") && value.endsWith("\"")) ||
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

async function main() {
  const [envSource, promptSource] = await Promise.all([
    readFile(envPath, "utf8"),
    readFile(promptPath, "utf8"),
  ]);

  const env = parseEnvFile(envSource);
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env");
  }

  const promptFile = JSON.parse(promptSource);
  const { spec, titleImage } = promptFile;
  const outputDir = path.join(rootDir, titleImage.outputDir);
  const prompt = [
    spec.globalPrompt,
    titleImage.prompt,
    `Final delivery will be cropped to ${spec.fixedWidth}x${spec.fixedHeight}. Keep the important subject matter centered with safe margins.`,
    `Negative prompt: ${spec.globalNegativePrompt}, ${titleImage.negativePrompt}`,
  ].join(" ");

  const referenceImagePaths = (titleImage.referenceImages || []).map((entry) =>
    path.join(rootDir, entry),
  );
  const referenceParts = [];
  for (const referenceImagePath of referenceImagePaths) {
    const buffer = await readFile(referenceImagePath);
    referenceParts.push({
      inlineData: {
        mimeType: getMimeType(referenceImagePath),
        data: buffer.toString("base64"),
      },
    });
  }

  const requestBody = {
    contents: [
      {
        parts: [...referenceParts, { text: prompt }],
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

  process.stdout.write(`Generating ${titleImage.id} with ${titleImage.model}...\n`);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${titleImage.model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
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
  const rawPath = path.join(outputDir, `${titleImage.id}.raw${rawExtension}`);
  const finalPath = path.join(outputDir, `${titleImage.id}.webp`);
  const metadataPath = path.join(outputDir, `${titleImage.id}.json`);

  await writeFile(rawPath, Buffer.from(image.data, "base64"));
  await centerCropToWebp(rawPath, finalPath, spec.fixedWidth, spec.fixedHeight);

  const metadata = {
    id: titleImage.id,
    model: titleImage.model,
    generatedAt: new Date().toISOString(),
    output: path.relative(rootDir, finalPath),
    rawOutput: path.relative(rootDir, rawPath),
    referenceImages: titleImage.referenceImages || [],
    prompt,
    responseTexts: extractTextResponses(responseJson),
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  process.stdout.write(`${path.relative(rootDir, finalPath)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
