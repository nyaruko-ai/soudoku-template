---
name: soudoku-novel-builder
description: Use this skill to create Soudoku novels, an original Japanese "creative reading" approach to building a novel step by step.
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

- `project/` 配下の設計ファイルが正本。少なくとも `project/00_project_overview.md`, `project/01_plot.md`, `project/02_characters.md`, `project/03_worldbuilding.md`, `project/04_chapter_outline.md`, `project/05_style_guide.md`, `project/manuscript/00_manuscript_overview.md` を基準にする。
- 聖典は `project/01_plot.md`, `project/02_characters.md`, `project/03_worldbuilding.md`, `project/04_chapter_outline.md`, `project/05_style_guide.md` に置く。本文を書く前にここを同期する。
- 構成単位は必ず `章 > 話 > 節`。`節` は背景や状況が切り替わる画面ショット単位で、画像生成の最小単位でもある。
- 節画像の `scene-id` は `scene-章(000)-話(000)-節(000)` 形式にする。例: `scene-001-002-003` は「第1章第2話第3節」。
- 初回承認前に作るのは `project/01_plot.md`, `project/02_characters.md`, `project/03_worldbuilding.md`, `project/04_chapter_outline.md`, `prompts/character-portraits.json`, `prompts/background-concepts.json` とその生成物。タイトル画像はこの段階では作らない。
- 制作中の画像や中間生成物は常に `project/assets/` に保存する。`docs/` は配信用にビルドした結果だけを置く。
- 本文、画像、ビルドの作業中に設計との差分を見つけたら、必ずユーザへ先に指摘する。勝手に本文や画像へ反映しない。
- 設計変更が必要な場合は、必ず先に `project/` 側の該当ファイルを修正し、必要ならユーザ確認を取る。その後で本文・画像・ビルドに進む。
- アウトラインに存在しない `章・話・節` は勝手に追加しない。追加や削除や順序変更が必要なら、まず `project/04_chapter_outline.md` を直す提案を出し、承認後に更新する。
- キャラクター、世界観、語り口、到達点、構成、現在地などが `project/` の設計とズレる場合も同じ。先に設計を直し、本文は常に承認済み設計に従わせる。
- 新キャラクターや敵が出たら、まず `project/02_characters.md` と `prompts/character-portraits.json` を更新し、必要なら `node scripts/generate-character-portrait.mjs <id>` を使う。
- 背景イメージは初期フェーズで `prompts/background-concepts.json` を更新し、必要なら `node scripts/generate-background-concept.mjs <id|--all>` で生成する。
- 複数枚の画像を生成する場面では、可能な限り並列生成を使う。背景、キャラクター、節画像は `--parallel=<n>` を付けて保守的に 2 枚前後ずつ並列化できる。
- 節画像を作る前に `node scripts/build-web-novel.mjs` と `node scripts/build-episode-image-manifest.mjs` を実行し、`prompts/episode-image-manifest.json` を更新する。
- 節画像は全件再生成しない。既存の `project/assets/episodes/*.webp` は保持し、新規追加または修正した `節` の画像だけを生成する。
- 節画像を再生成したいのは、対象の `節` を本文またはプロンプト上で修正した場合だけ。既存画像を上書きする必要があるときだけ `--force` を使う。
- 画像内に `第1章`, `第2話`, `第3節` のような小説の構造ラベル、字幕、キャプション、ロゴ、UI 文字を埋め込まない。文字情報は Web 側で表示し、生成画像そのものには入れない。
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

### 1.5. 差分確認

- 本文や画像の次の一手を決める前に、現在の要求が `project/` の設計群と一致しているかを見る。
- 差分があれば、どのファイルのどの前提とズレるかを短く明示してユーザへ確認する。
- ユーザが変更意思を示したら、先に設計ファイルを更新する。設計未更新のまま本文や画像を先行させない。

### 2. 初期ビジュアル設計

- キャラクター画像は `references/prompt-files.md` の `character-portraits.json` 形式に従って更新する。
- 背景イメージは `prompts/background-concepts.json` を更新し、物語の基調となる主要背景を先に作る。

### 3. 初回承認ゲート

- ここでユーザに「プロット」「主要キャラクター」「主要キャラクター画像」「背景イメージ」を確認してもらう。
- 承認が出るまで本文制作へ進まない。修正が出たら聖典と画像定義を更新して再提示する。

### 4. 章制作

- 承認後に `第1章第1話` から順に作る。
- 作る対象は、承認済みの `project/04_chapter_outline.md` に存在する `章・話・節` に限る。
- その時点で扱う章の本文だけを書く。本文は `章 > 話 > 節` を崩さない。
- `project/manuscript/chapter_XX.md` と `project/manuscript/full_novel.md` を同期する。
- 新規設定は本文より先に聖典へ反映する。
- 執筆中に「話を増やしたい」「節を足したい」「設定を変えたい」と判断した場合は、本文を書き足す前に設計差分としてユーザへ提示する。

### 5. 章確認と Web 更新

- 章が1つまとまったらユーザ確認を入れる。
- 承認または修正方針が出たら、節画像を生成する。
- `node scripts/build-web-novel.mjs`
- `node scripts/build-episode-image-manifest.mjs`
- 追加または修正した `節` の `scene-id` だけを `node scripts/generate-episode-image.mjs <scene-id ...>` で生成する。既存画像を作り直さない。
- 節画像生成後に再度 `node scripts/build-web-novel.mjs`

### 5.5. 最終タイトル画像

- タイトル画像は本文、主要節画像、キャラクター像、全体トーンが固まった最後に作る。
- `prompts/title-image.json` は、その時点で確定した `project/02_characters.md`, `project/05_style_guide.md`, `project/assets/characters/*.png`, `project/assets/world/*.webp` に合わせて更新する。
- タイトル画像は現在のキャラクター画像と印象を揃える。必要なら `referenceImages` にサトーとニャル子の最新画像を入れて `node scripts/generate-title-image.mjs` を使う。
- タイトル画像でも `第1章`, `第2話`, `第3節` のような文字情報やロゴや UI 表示を画像に埋め込まない。

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
- 節画像生成: `node scripts/generate-episode-image.mjs <scene-id ...|--all> [--force]` 。
  ここでの `scene-id` は実質的に「節」の画像 ID。通常は変更した節だけを指定し、`--all` は初回生成や欠番補完に限る。既存画像の再生成は `--force` を付けたときだけ行う。
- 複数生成時の並列化: `node scripts/generate-background-concept.mjs --all --parallel=2`, `node scripts/generate-character-portrait.mjs --all --parallel=2`, `node scripts/generate-episode-image.mjs <scene-id ...> --parallel=2`

## Read As Needed

- ファイル役割や更新順は `references/project-files.md`
- `prompts/*.json` の形式は `references/prompt-files.md`

このスキルの目的は完成原稿だけではなく、ユーザが段階的に読み進めながら創作そのものを楽しめる状態を保つこと。
