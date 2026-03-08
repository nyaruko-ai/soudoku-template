# Project Files

## Canon Files

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

- `prompts/title-image.json`: タイトル画像生成定義
- `prompts/background-concepts.json`: 初期フェーズで使う背景イメージ生成定義
- `prompts/character-portraits.json`: キャラクター画像生成定義
- `prompts/scene-character-references.json`: 節画像用の参照キャラクター定義と上書き
- `prompts/episode-image-manifest.json`: `build-episode-image-manifest.mjs` が生成する節画像入力
- `project/assets/`: 制作中アセットの保存先。タイトル、キャラクター、背景、節画像をここに置く
- `docs/`: 配信用静的 Web 出力。ビルド結果だけを置く

## Update Order

1. ヒアリングした要求を `00_project_overview.md` に反映
2. 物語の変更を `01_plot.md`, `02_characters.md`, `03_worldbuilding.md`, `04_chapter_outline.md` に反映
3. 初回承認用に主要キャラクター画像と背景イメージの定義を `prompts/*.json` に反映し、生成物を `project/assets/` に保存
4. 初回承認を取る
5. 承認後に本文を `project/manuscript/` に反映
6. 章ができるごとに `project/assets/` の画像と本文から `docs/` をビルドして確認

## Writing Unit

- 章: 大きな転換点
- 話: 読者に一回で読ませるまとまり
- 節: 話内で背景や状況が切り替わる画面ショット単位。画像生成の最小単位であり、Web 上の基本表示単位
