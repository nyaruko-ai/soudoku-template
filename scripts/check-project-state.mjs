import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exists,
  listChapterFiles,
  readJsonIfExists,
  readTextIfExists,
  splitFrontmatter,
  stripMarkdown,
} from "./lib/novel-project.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function countGeneratedFiles(dirPath, pattern) {
  if (!(await exists(dirPath))) {
    return 0;
  }

  const { readdir } = await import("node:fs/promises");
  return (await readdir(dirPath)).filter((fileName) => pattern.test(fileName)).length;
}

function sectionStatus(label, ok, detail) {
  const marker = ok ? "[ok]" : "[ ]";
  return `${marker} ${label}: ${detail}`;
}

async function main() {
  const overviewPath = path.join(rootDir, "project", "00_project_overview.md");
  const plotPath = path.join(rootDir, "project", "01_plot.md");
  const charactersPath = path.join(rootDir, "project", "02_characters.md");
  const outlinePath = path.join(rootDir, "project", "04_chapter_outline.md");
  const manuscriptDir = path.join(rootDir, "project", "manuscript");
  const fullNovelPath = path.join(manuscriptDir, "full_novel.md");
  const storyDataPath = path.join(rootDir, "docs", "story-data.js");
  const titlePromptPath = path.join(rootDir, "prompts", "title-image.json");
  const portraitPromptPath = path.join(rootDir, "prompts", "character-portraits.json");
  const sceneRefsPath = path.join(rootDir, "prompts", "scene-character-references.json");
  const backgroundPromptPath = path.join(rootDir, "prompts", "background-concepts.json");

  const overviewSource = await readTextIfExists(overviewPath);
  const overview = splitFrontmatter(overviewSource);
  const plotSource = await readTextIfExists(plotPath);
  const charactersSource = await readTextIfExists(charactersPath);
  const outlineSource = await readTextIfExists(outlinePath);
  const fullNovelSource = await readTextIfExists(fullNovelPath);
  const chapterFiles = await listChapterFiles(manuscriptDir);
  const portraitPrompt = await readJsonIfExists(portraitPromptPath, { characters: [] });
  const backgroundPrompt = await readJsonIfExists(backgroundPromptPath, { backgrounds: [] });
  const sceneRefs = await readJsonIfExists(sceneRefsPath, { characters: [], sceneOverrides: {} });
  const storyBuilt = await exists(storyDataPath);

  const characterDefinitions = (charactersSource.match(/^###\s+/gm) ?? []).length;
  const chapterDefinitions = (outlineSource.match(/^###\s+/gm) ?? []).length;
  const talkDefinitions = (outlineSource.match(/^####\s+/gm) ?? []).length;
  const outlineSectionDefinitions = (outlineSource.match(/^#####\s+/gm) ?? []).length;
  const manuscriptTalkDefinitions = (fullNovelSource.match(/^###\s+/gm) ?? []).length;
  const sceneDefinitions = (fullNovelSource.match(/^####\s+/gm) ?? []).length;
  const titleImages = await countGeneratedFiles(
    path.join(rootDir, "project", "assets", "title"),
    /\.webp$/i,
  );
  const backgroundImages = await countGeneratedFiles(
    path.join(rootDir, "project", "assets", "world"),
    /\.webp$/i,
  );
  const characterImages = await countGeneratedFiles(
    path.join(rootDir, "project", "assets", "characters"),
    /\.(png|webp)$/i,
  );
  const sourceEpisodeImages = await countGeneratedFiles(
    path.join(rootDir, "project", "assets", "episodes"),
    /\.webp$/i,
  );
  const episodeImages = await countGeneratedFiles(
    path.join(rootDir, "docs", "images", "episodes"),
    /\.webp$/i,
  );

  const nextSteps = [];

  if (!stripMarkdown(plotSource)) {
    nextSteps.push("プロットを `project/01_plot.md` に固める");
  }
  if (characterDefinitions === 0 || portraitPrompt.characters.length === 0) {
    nextSteps.push("主要キャラクターを定義し、`prompts/character-portraits.json` を更新する");
  }
  if (backgroundPrompt.backgrounds.length === 0) {
    nextSteps.push("初回承認用の背景イメージを `prompts/background-concepts.json` に定義する");
  }
  if (sceneDefinitions === 0) {
    nextSteps.push("`project/manuscript/full_novel.md` に章・話・節を追加する");
  }
  if (!storyBuilt) {
    nextSteps.push("`node scripts/build-web-novel.mjs` を実行して Web 版を更新する");
  }
  if (storyBuilt && sceneRefs.characters.length === 0) {
    nextSteps.push("節画像用の `prompts/scene-character-references.json` を整備する");
  }

  process.stdout.write(`# Project State\n\n`);
  process.stdout.write(
    `Title: ${overview.attributes.title || "未設定"}\nSlug: ${overview.attributes.slug || "未設定"}\n\n`,
  );
  process.stdout.write(`${sectionStatus("project overview", overviewSource.length > 0, "基本情報")}\n`);
  process.stdout.write(
    `${sectionStatus("plot", stripMarkdown(plotSource).length > 12, "物語の聖典")}\n`,
  );
  process.stdout.write(
    `${sectionStatus("characters", characterDefinitions > 0, `${characterDefinitions} entries`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("chapter outline", chapterDefinitions > 0, `${chapterDefinitions} chapters`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("talk outline", talkDefinitions > 0, `${talkDefinitions} talks / ${outlineSectionDefinitions} sections`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("chapter files", chapterFiles.length > 0, `${chapterFiles.length} files`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("manuscript talks", manuscriptTalkDefinitions > 0, `${manuscriptTalkDefinitions} talks`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("manuscript sections", sceneDefinitions > 0, `${sceneDefinitions} sections`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("title prompt", await exists(titlePromptPath), `${titleImages} generated images`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus(
      "background prompts",
      backgroundPrompt.backgrounds.length > 0,
      `${backgroundPrompt.backgrounds.length} prompts / ${backgroundImages} images`,
    )}\n`,
  );
  process.stdout.write(
    `${sectionStatus(
      "character prompts",
      portraitPrompt.characters.length > 0,
      `${portraitPrompt.characters.length} prompts / ${characterImages} images`,
    )}\n`,
  );
  process.stdout.write(
    `${sectionStatus(
      "scene references",
      sceneRefs.characters.length > 0,
      `${sceneRefs.characters.length} characters / ${Object.keys(sceneRefs.sceneOverrides || {}).length} overrides`,
    )}\n`,
  );
  process.stdout.write(
    `${sectionStatus("web build", storyBuilt, `${episodeImages} episode images`)}\n`,
  );
  process.stdout.write(
    `${sectionStatus("episode source assets", sourceEpisodeImages >= 0, `${sourceEpisodeImages} source images`)}\n`,
  );

  if (nextSteps.length > 0) {
    process.stdout.write(`\n## Suggested Next Steps\n- ${nextSteps.join("\n- ")}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
