# Project Files

## Canon Files

- `project/` 配下のファイル群は制作の正本。本文や画像はここから外れてはいけない
- `project/00_project_overview.md`: 作品の目的、想定読者、今回の作業範囲
- `project/01_plot.md`: 物語の聖典。大きな変更はここが最優先
- `project/02_characters.md`: 固定設定と見た目の基準
- `project/03_worldbuilding.md`: 世界のルール
- `project/04_chapter_outline.md`: 章、話、節の粒度での構成
- `project/05_style_guide.md`: 文体、読書体験、画像トーン
- `project/manuscript/00_manuscript_overview.md`: 連載中の現状と未回収要素
- `project/manuscript/chapter_XX.md`: 章ごとの作業本文。本文は `## 章`, `### 話`, `#### 節`
- `project/manuscript/full_novel.md`: Web ビルドの基準本文

## Asset and Build Files

- `prompts/title-image.json`: 最終工程で使うタイトル画像生成定義
- `prompts/background-concepts.json`: 初期フェーズで使う背景イメージ生成定義
- `prompts/character-portraits.json`: キャラクター画像生成定義
- `prompts/scene-character-references.json`: 節画像用の参照キャラクター定義と上書き
- `prompts/episode-image-manifest.json`: `build-episode-image-manifest.mjs` が生成する節画像入力
- `project/assets/`: 制作中アセットの保存先。タイトル、キャラクター、背景、節画像をここに置く
- `docs/`: 配信用静的 Web 出力。ビルド結果だけを置く

## Update Order

1. ヒアリングした要求を `00_project_overview.md` に反映
2. 物語の変更を `01_plot.md`, `02_characters.md`, `03_worldbuilding.md`, `04_chapter_outline.md` に反映
3. 本文や画像の案が設計とズレる場合は、先に差分をユーザへ指摘し、設計ファイルを修正する
4. 初回承認用に主要キャラクター画像と背景イメージの定義を `prompts/*.json` に反映し、生成物を `project/assets/` に保存
5. 初回承認を取る
6. 承認後に本文を `project/manuscript/` に反映
7. 章ができるごとに `build-episode-image-manifest.mjs` を更新し、新規追加または修正した `節` の画像だけを `project/assets/episodes/` に生成する
8. 全体が固まった最後に `prompts/title-image.json` を更新し、現在のキャラクター画像に寄せてタイトル画像を生成する
9. その時点の `project/assets/` の画像と本文から `docs/` をビルドして確認

## Change Guardrails

- `project/04_chapter_outline.md` に存在しない `章・話・節` を勝手に本文へ追加しない
- キャラクター設定、世界観、文体、到達点、構成順が設計から外れる場合は、必ず先にユーザへ確認する
- ユーザが変更を望む場合でも、先に `project/` 側の設計を修正する
- 設計修正の前に本文や画像を作り始めない
- 既存の節画像は勝手に再生成しない。画像生成対象は今回追加または修正した `節` に限る
- 既存の節画像を上書きするのは、対象節の本文または画像方針を変更したうえで明示的に再生成するときだけ

## Writing Unit

- 章: 大きな転換点
- 話: 読者に一回で読ませるまとまり
- 節: 話内で背景や状況が切り替わる画面ショット単位。画像生成の最小単位であり、Web 上の基本表示単位
- 節画像ファイル名: `scene-章(000)-話(000)-節(000).webp`。例: `scene-001-002-003.webp`
