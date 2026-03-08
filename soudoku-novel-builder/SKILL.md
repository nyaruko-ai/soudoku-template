---
name: soudoku-novel-builder
description: Use this skill when the user wants to create, continue, revise, or publish a soudoku novel project that first locks plot, major characters, character images, and background concepts, then builds the story chapter by chapter with chapter review, section image generation, and a mobile-friendly web build under docs/.
---

# Soudoku Novel Builder

「創りながら読む」創読向けの小説制作スキル。全量を一気に書かず、ユーザとの対話、画像生成、モバイル Web ビルド、整合性確認を反復しながら作品を育てる。

## First Moves

1. まず現在の小説ルートに `project/`, `prompts/`, `docs/`, `scripts/` が揃っているか確認する。
2. `project/` が無ければ `node scripts/init-novel-project.mjs --title="..."` を実行して雛形を作る。
3. 最初の制作フェーズでは本文を先に書かない。まず「全体プロット」「主要キャラクター設定」「主要キャラクター画像」「背景イメージ」を揃える。
4. 初期セットが揃ったら、必ず一度ユーザ確認を入れる。承認前に第1章本文へ進まない。
5. ユーザが曖昧なら、最初に次を短く聞く: テーマ、ジャンル、核となる感情、想定ボリューム、避けたい要素、画像トーン。

## Working Rules

- 聖典は `project/01_plot.md`, `project/02_characters.md`, `project/03_worldbuilding.md`, `project/04_chapter_outline.md`, `project/05_style_guide.md` に置く。本文を書く前にここを同期する。
- 構成単位は必ず `章 > 話 > 節`。`節` は背景や状況が切り替わる画面ショット単位で、画像生成の最小単位でもある。
- 初回承認前に作るのは `project/01_plot.md`, `project/02_characters.md`, `project/03_worldbuilding.md`, `project/04_chapter_outline.md`, `prompts/character-portraits.json`, `prompts/background-concepts.json` とその生成物。
- 制作中の画像や中間生成物は常に `project/assets/` に保存する。`docs/` は配信用にビルドした結果だけを置く。
- 新キャラクターや敵が出たら、まず `project/02_characters.md` と `prompts/character-portraits.json` を更新し、必要なら `node scripts/generate-character-portrait.mjs <id>` を使う。
- 背景イメージは初期フェーズで `prompts/background-concepts.json` を更新し、必要なら `node scripts/generate-background-concept.mjs <id|--all>` で生成する。
- 節画像を作る前に `node scripts/build-web-novel.mjs` と `node scripts/build-episode-image-manifest.mjs` を実行し、`prompts/episode-image-manifest.json` を更新する。
- Web ビルドは `project/` と `project/assets/` を入力にして `docs/` を生成する。`docs/` は公開用成果物であり、作業中アセットの保管場所ではない。
- 本文制作は初期承認のあとに `第1章第1話` から順に進める。少なくとも章が1つ完成するごとに止まり、ユーザ確認と修正を挟む。
- 章ごとの標準ループは「本文作成 -> ユーザ確認 -> 節画像生成 -> Web ビルド -> フィードバック反映」。
- 話が進むごとに設定変更やピボットが起こる前提で、毎回 `project/01_plot.md` と `project/manuscript/00_manuscript_overview.md` に変更理由を残す。
- フィードバックは本文、画像、Web 表示の3点で受ける。

## Standard Loop

### 1. 初期設計

- `references/project-files.md` を必要部分だけ確認する。
- ヒアリング結果を `project/00_project_overview.md` と各聖典ファイルへ反映する。
- `project/04_chapter_outline.md` では本文を書く前に `章 > 話 > 節` の骨格を作る。

### 2. 初期ビジュアル設計

- タイトル画像が必要なら `prompts/title-image.json` を更新して `node scripts/generate-title-image.mjs` を使う。
- キャラクター画像は `references/prompt-files.md` の `character-portraits.json` 形式に従って更新する。
- 背景イメージは `prompts/background-concepts.json` を更新し、物語の基調となる主要背景を先に作る。

### 3. 初回承認ゲート

- ここでユーザに「プロット」「主要キャラクター」「主要キャラクター画像」「背景イメージ」を確認してもらう。
- 承認が出るまで本文制作へ進まない。修正が出たら聖典と画像定義を更新して再提示する。

### 4. 章制作

- 承認後に `第1章第1話` から順に作る。
- その時点で扱う章の本文だけを書く。本文は `章 > 話 > 節` を崩さない。
- `project/manuscript/chapter_XX.md` と `project/manuscript/full_novel.md` を同期する。
- 新規設定は本文より先に聖典へ反映する。

### 5. 章確認と Web 更新

- 章が1つまとまったらユーザ確認を入れる。
- 承認または修正方針が出たら、節画像を生成する。
- `node scripts/build-web-novel.mjs`
- `node scripts/build-episode-image-manifest.mjs`
- 節画像生成後に再度 `node scripts/build-web-novel.mjs`

### 6. 整合性確認

- `node scripts/check-project-state.mjs` を実行して不足を確認する。
- あわせて `plot`, `characters`, `worldbuilding`, `chapter_outline`, `manuscript` を横断して矛盾をレビューする。

## Commands

- プロジェクト初期化: `node scripts/init-novel-project.mjs --title="作品名"`
- 状態確認: `node scripts/check-project-state.mjs`
- Web ビルド: `node scripts/build-web-novel.mjs`
- 節画像マニフェスト生成: `node scripts/build-episode-image-manifest.mjs`
- タイトル画像生成: `node scripts/generate-title-image.mjs`
- 背景イメージ生成: `node scripts/generate-background-concept.mjs <background-id|--all>`
- キャラクター画像生成: `node scripts/generate-character-portrait.mjs <character-id|--all>`
- 節画像生成: `node scripts/generate-episode-image.mjs <scene-id|--all>` 。
  ここでの `scene-id` は実質的に「節」の画像 ID。

## Read As Needed

- ファイル役割や更新順は `references/project-files.md`
- `prompts/*.json` の形式は `references/prompt-files.md`

このスキルの目的は完成原稿だけではなく、ユーザが段階的に読み進めながら創作そのものを楽しめる状態を保つこと。
