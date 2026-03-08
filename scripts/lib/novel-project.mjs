import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

export async function writeFileIfMissing(targetPath, content) {
  if (await exists(targetPath)) {
    return false;
  }

  await ensureDir(path.dirname(targetPath));
  await writeFile(targetPath, content, "utf8");
  return true;
}

export function splitFrontmatter(source) {
  if (!source.startsWith("---\n")) {
    return { attributes: {}, body: source };
  }

  const endIndex = source.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { attributes: {}, body: source };
  }

  const frontmatter = source.slice(4, endIndex);
  const body = source.slice(endIndex + 5);
  return {
    attributes: parseSimpleFrontmatter(frontmatter),
    body,
  };
}

export function parseSimpleFrontmatter(source) {
  const attributes = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
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

    attributes[key] = value;
  }

  return attributes;
}

export function slugify(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "novel-project";
}

export async function readTextIfExists(targetPath, fallback = "") {
  if (!(await exists(targetPath))) {
    return fallback;
  }

  return readFile(targetPath, "utf8");
}

export async function readJsonIfExists(targetPath, fallback) {
  if (!(await exists(targetPath))) {
    return fallback;
  }

  return JSON.parse(await readFile(targetPath, "utf8"));
}

export async function listChapterFiles(manuscriptDir) {
  if (!(await exists(manuscriptDir))) {
    return [];
  }

  return (await readdir(manuscriptDir))
    .filter((fileName) => /^chapter_\d+\.md$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function parseStoryDataSource(jsSource) {
  return JSON.parse(jsSource.replace(/^window\.STORY_DATA = /, "").replace(/;\s*$/, ""));
}

export function stripMarkdown(source) {
  return source
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .trim();
}

export function summarizeText(source, maxLength = 100) {
  const flattened = stripMarkdown(source).replace(/\s+/g, " ").trim();
  if (flattened.length <= maxLength) {
    return flattened;
  }

  return `${flattened.slice(0, maxLength - 1)}…`;
}
