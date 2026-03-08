import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, slugify, writeFileIfMissing } from "./lib/novel-project.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {
    title: "新しい創読プロジェクト",
    subtitle: "",
    author: "",
    genre: "",
    logline: "",
    slug: "",
  };

  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const separatorIndex = arg.indexOf("=");
    const key = separatorIndex === -1 ? arg.slice(2) : arg.slice(2, separatorIndex);
    const value = separatorIndex === -1 ? "true" : arg.slice(separatorIndex + 1);

    if (key in options) {
      options[key] = value;
    }
  }

  return options;
}

function buildOverviewTemplate(options, nowIso) {
  const slug = options.slug || slugify(options.title);
  return `---
title: "${options.title}"
subtitle: "${options.subtitle}"
author: "${options.author}"
genre: "${options.genre}"
slug: "${slug}"
status: "planning"
updatedAt: "${nowIso}"
---

# Project Overview

## Logline
${options.logline || "ここに作品の核となる一文要約を書く。"}

## Audience
- 想定読者:
- 読後感:
- 連載ペース:

## Creative Intent
- この作品でやりたいこと:
- 絶対に入れたい要素:
- 避けたい要素:

## Product Intent
- 創読としてどんな体験にしたいか:
- 画像生成の方針:
- モバイル Web での見せ方:

## Initial Approval Gate
- まず確認してもらうもの:
- 主要キャラクター画像:
- 背景イメージ:
- タイトル画像は最後に作る:
- 本文開始の条件:

## Current Focus
- 今回進める範囲:
- 未確定事項:
- 次に決めること:
`;
}

function buildPlotTemplate() {
  return `# Plot

## Core Conflict
- 主人公:
- 欲望:
- 障害:
- 失敗コスト:

## Arc Overview
### Beginning

### Middle

### Ending

## Pivot Log
- 変更があれば日付と理由を書く
`;
}

function buildCharactersTemplate() {
  return `# Characters

## Cast Rules
- 各キャラクターは「役割」「内面」「外見」「口調」「変化」を必ず持たせる
- 画像生成後は見た目の定義をここに固定する

## Main Cast

### character_id: protagonist
- 名前:
- 役割:
- 年齢・立場:
- 外見:
- 服装・持ち物:
- 性格:
- 話し方:
- 欲望:
- 恐れ:
- 変化:
- 画像プロンプト要約:

## Supporting Cast
`;
}

function buildWorldTemplate() {
  return `# Worldbuilding

## Setting Summary

## Key Background Concepts
- 初期確認で見せる背景 01:
- 初期確認で見せる背景 02:

## Rules
- 魔法・技術:
- 社会:
- 地理:
- 禁則:

## Sensory Notes
- 色:
- 質感:
- 音:
- 匂い:

## Open Questions
`;
}

function buildChapterOutlineTemplate() {
  return `# Chapter Outline

## Release Strategy
- 1回で見せる分量:
- 章あたりの体験:
- 話あたりの役割:
- 画像生成の最小単位: 節

## Initial Package
- 初回承認前に確定するもの:
  - 全体プロット
  - 主要キャラクター
  - 主要キャラクター画像
  - 背景イメージ

## Chapters

### 第1章
- 章テーマ:
- 到達点:
- ユーザ確認ポイント:

#### 第1話
- 話テーマ:
- 到達点:

##### 第1節
- 背景:
- 画面ショットの目的:
`;
}

function buildStyleGuideTemplate() {
  return `# Style Guide

## Narrative Voice
- 地の文:
- 会話文:
- テンポ:

## Reading Experience
- スマホで読みやすい段落長:
- 1節の気持ちよい終わり方:
- 次を読みたくなるフック:

## Image Direction
- タイトル画像: 全話と節画像が固まった最後に作る
- キャラクター画像:
- 節画像:

## Continuity Rules
- 固定設定:
- 後から変えてよい設定:
`;
}

function buildManuscriptOverviewTemplate() {
  return `# Manuscript Overview

## Canon
- 主人公の現在地:
- 主要キャラクターの関係:
- 未回収の伏線:

## Review Loop
- 初回承認前:
- 現在レビュー中の章:
- 次に画像化する節:

## Drafting Log
- 新規執筆や修正を行うたびに記録する
`;
}

function buildFullNovelTemplate(title) {
  return `# ${title}

## 第1章　朝

### 第1話　休日のはじまり

#### 第1節
ここから本文を書く。
`;
}

function buildTitlePromptTemplate(options) {
  return {
    spec: {
      globalPrompt:
        "Create a photorealistic cinematic illustration for a modern web novel. Keep lighting, materials, anatomy, and faces grounded in live-action realism. Maintain a unified realistic visual language across all generated assets.",
      globalNegativePrompt:
        "anime, manga, cel shading, cartoon, illustration with flat shading, text, logo, watermark, collage, split panel, deformed anatomy, low detail face, extra limbs",
      fixedWidth: 1440,
      fixedHeight: 2304,
    },
    titleImage: {
      id: "title-cover",
      model: "gemini-3.1-flash-image-preview",
      outputDir: "project/assets/title",
      referenceImages: [],
      prompt: `${options.title} の世界観と読後感が一目で伝わるタイトルビジュアルを生成する。これは最終工程で使う。キャラクター画像と世界観が固まった後で更新する。`,
      negativePrompt: "avoid generic fantasy poster layout",
    },
  };
}

function buildCharacterPromptTemplate() {
  return {
    spec: {
      globalPrompt:
        "Create a photorealistic cinematic full-body character portrait for a modern web novel. Preserve silhouette clarity, costume readability, realistic anatomy, realistic fabric texture, and a consistent live-action visual language shared with all other generated assets.",
      globalNegativePrompt:
        "anime, manga, cel shading, cartoon, text, logo, watermark, deformed anatomy, extra limbs, duplicate body parts, cropped head, doll-like face",
      fixedWidth: 1080,
      fixedHeight: 1920,
      outputDir: "project/assets/characters",
      defaultModel: "gemini-3.1-flash-image-preview",
    },
    characters: [],
  };
}

function buildBackgroundConceptTemplate() {
  return {
    spec: {
      globalPrompt:
        "Create a photorealistic cinematic environment image for a modern web novel. Emphasize atmosphere, lighting, believable architecture, realistic materials, and a unified live-action visual language shared with all other generated assets.",
      globalNegativePrompt:
        "anime, manga, cel shading, cartoon, text, logo, watermark, character close-up, deformed architecture, low detail",
      fixedWidth: 1440,
      fixedHeight: 2304,
      outputDir: "project/assets/world",
      defaultModel: "gemini-3.1-flash-image-preview",
    },
    backgrounds: [],
  };
}

function buildSceneCharacterReferencesTemplate() {
  return {
    spec: {
      globalPrompt:
        "Create one photorealistic cinematic scene image for a modern web novel. Keep the style consistent with the title, character, and background assets. Use realistic anatomy, realistic materials, and live-action-like lighting.",
      globalNegativePrompt:
        "anime, manga, cel shading, cartoon, text, logo, watermark, collage, split panel, multiple moments in one frame, deformed anatomy",
      fixedWidth: 1080,
      fixedHeight: 1920,
      outputDir: "project/assets/episodes",
      defaultModel: "gemini-3.1-flash-image-preview",
    },
    characters: [],
    sceneOverrides: {},
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const nowIso = new Date().toISOString();
  const manuscriptDir = path.join(rootDir, "project", "manuscript");

  await Promise.all([
    ensureDir(path.join(rootDir, "docs")),
    ensureDir(path.join(rootDir, "project", "assets", "title")),
    ensureDir(path.join(rootDir, "project", "assets", "characters")),
    ensureDir(path.join(rootDir, "project", "assets", "episodes")),
    ensureDir(path.join(rootDir, "project", "assets", "world")),
    ensureDir(manuscriptDir),
    ensureDir(path.join(rootDir, "prompts")),
  ]);

  const created = [];

  if (
    await writeFileIfMissing(
      path.join(rootDir, "project", "00_project_overview.md"),
      buildOverviewTemplate(options, nowIso),
    )
  ) {
    created.push("project/00_project_overview.md");
  }

  if (await writeFileIfMissing(path.join(rootDir, "project", "01_plot.md"), buildPlotTemplate())) {
    created.push("project/01_plot.md");
  }

  if (
    await writeFileIfMissing(path.join(rootDir, "project", "02_characters.md"), buildCharactersTemplate())
  ) {
    created.push("project/02_characters.md");
  }

  if (
    await writeFileIfMissing(
      path.join(rootDir, "project", "03_worldbuilding.md"),
      buildWorldTemplate(),
    )
  ) {
    created.push("project/03_worldbuilding.md");
  }

  if (
    await writeFileIfMissing(
      path.join(rootDir, "project", "04_chapter_outline.md"),
      buildChapterOutlineTemplate(),
    )
  ) {
    created.push("project/04_chapter_outline.md");
  }

  if (
    await writeFileIfMissing(path.join(rootDir, "project", "05_style_guide.md"), buildStyleGuideTemplate())
  ) {
    created.push("project/05_style_guide.md");
  }

  if (
    await writeFileIfMissing(
      path.join(manuscriptDir, "00_manuscript_overview.md"),
      buildManuscriptOverviewTemplate(),
    )
  ) {
    created.push("project/manuscript/00_manuscript_overview.md");
  }

  if (
    await writeFileIfMissing(
      path.join(manuscriptDir, "chapter_01.md"),
      "## 第1章　はじまり\n\n### Scene 01\nここから本文を書く。\n",
    )
  ) {
    created.push("project/manuscript/chapter_01.md");
  }

  if (
    await writeFileIfMissing(
      path.join(manuscriptDir, "full_novel.md"),
      buildFullNovelTemplate(options.title),
    )
  ) {
    created.push("project/manuscript/full_novel.md");
  }

  if (
    await writeFileIfMissing(
      path.join(rootDir, "prompts", "title-image.json"),
      `${JSON.stringify(buildTitlePromptTemplate(options), null, 2)}\n`,
    )
  ) {
    created.push("prompts/title-image.json");
  }

  if (
    await writeFileIfMissing(
      path.join(rootDir, "prompts", "character-portraits.json"),
      `${JSON.stringify(buildCharacterPromptTemplate(), null, 2)}\n`,
    )
  ) {
    created.push("prompts/character-portraits.json");
  }

  if (
    await writeFileIfMissing(
      path.join(rootDir, "prompts", "background-concepts.json"),
      `${JSON.stringify(buildBackgroundConceptTemplate(), null, 2)}\n`,
    )
  ) {
    created.push("prompts/background-concepts.json");
  }

  if (
    await writeFileIfMissing(
      path.join(rootDir, "prompts", "scene-character-references.json"),
      `${JSON.stringify(buildSceneCharacterReferencesTemplate(), null, 2)}\n`,
    )
  ) {
    created.push("prompts/scene-character-references.json");
  }

  if (await writeFileIfMissing(path.join(rootDir, "docs", ".nojekyll"), "")) {
    created.push("docs/.nojekyll");
  }

  process.stdout.write(
    created.length === 0
      ? "Project scaffold already existed.\n"
      : `Created ${created.length} files:\n- ${created.join("\n- ")}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
