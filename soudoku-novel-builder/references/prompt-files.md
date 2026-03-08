# Prompt Files

## `prompts/title-image.json`

```json
{
  "spec": {
    "globalPrompt": "overall art direction",
    "globalNegativePrompt": "things to avoid",
    "fixedWidth": 1440,
    "fixedHeight": 2304
  },
  "titleImage": {
    "id": "title-cover",
    "model": "gemini-3.1-flash-image-preview",
    "outputDir": "project/assets/title",
    "referenceImages": [
      "project/assets/characters/protagonist.png"
    ],
    "prompt": "cover-specific direction",
    "negativePrompt": "cover-specific avoidance"
  }
}
```

## `prompts/character-portraits.json`

```json
{
  "spec": {
    "globalPrompt": "overall portrait direction",
    "globalNegativePrompt": "things to avoid",
    "fixedWidth": 1080,
    "fixedHeight": 1920,
    "outputDir": "project/assets/characters",
    "defaultModel": "gemini-3.1-flash-image-preview"
  },
  "characters": [
    {
      "id": "protagonist",
      "name": "主人公名",
      "model": "gemini-3.1-flash-image-preview",
      "prompt": "full body portrait instructions",
      "negativePrompt": "character-specific avoidance",
      "referenceImage": "project/assets/characters/protagonist-ref.png",
      "sourceRefs": [
        "project/02_characters.md"
      ]
    }
  ]
}
```

## `prompts/background-concepts.json`

```json
{
  "spec": {
    "globalPrompt": "overall background concept direction",
    "globalNegativePrompt": "things to avoid",
    "fixedWidth": 1440,
    "fixedHeight": 2304,
    "outputDir": "project/assets/world",
    "defaultModel": "gemini-3.1-flash-image-preview"
  },
  "backgrounds": [
    {
      "id": "holiday-morning-street",
      "name": "休日の朝の街並み",
      "model": "gemini-3.1-flash-image-preview",
      "prompt": "quiet affluent neighborhood at morning with hidden unease",
      "negativePrompt": "avoid crowds and overt violence"
    }
  ]
}
```

## `prompts/scene-character-references.json`

```json
{
  "spec": {
    "globalPrompt": "overall scene art direction",
    "globalNegativePrompt": "things to avoid",
    "fixedWidth": 1080,
    "fixedHeight": 1920,
    "outputDir": "project/assets/episodes",
    "defaultModel": "gemini-3.1-flash-image-preview"
  },
  "characters": [
    {
      "id": "protagonist",
      "name": "主人公名",
      "aliases": ["別名", "呼び名"],
      "referenceImage": "project/assets/characters/protagonist.png",
      "visualRules": "keep the scar on the left cheek and the navy coat"
    }
  ],
  "sceneOverrides": {
    "scene-001-001-001": {
      "referenceCharacterIds": ["protagonist"],
      "focusCharacterIds": ["protagonist"],
      "continuityNotes": ["this happens before the heroine knows the secret"],
      "promptSuffix": "show the station platform soaked by summer rain",
      "negativePrompt": "do not add extra crowd characters",
      "model": "gemini-3.1-flash-image-preview"
    }
  }
}
```

## Usage Notes

- 初期フェーズでは `character-portraits.json` と `background-concepts.json` を先に整える
- 生成物の保存先は `project/assets/`。`docs/` は `build-web-novel.mjs` が配信用に組み立てる
- キャラクター画像生成後は `referenceImage` を生成結果に合わせて更新する
- タイトル画像は最終工程で生成する。`referenceImages` に最新のキャラクター画像を入れ、最終的な人物像と印象を揃える
- 節画像は `docs/story-data.js` を元に `build-episode-image-manifest.mjs` が組み立てる
- `scene-id` は `scene-章(000)-話(000)-節(000)` 形式で、override キーや画像ファイル名もこれに揃える
- 節画像 prompt では小説の章話節ラベルを画像に描かせない。`text`, `captions`, `chapter labels`, `talk labels`, `subtitles`, `UI overlays` などを負例に入れる
- 節画像生成は通常、追加または修正した `scene-id` だけを `generate-episode-image.mjs` に渡す。既存画像がある節は自動でスキップされる
- 既存の節画像を意図的に作り直す場合だけ `generate-episode-image.mjs ... --force` を使う
- 複数画像を一度に作るときは `--parallel=<n>` を使って保守的に並列化できる。既定値は `2`
- 画像生成モデル名はプロジェクトで実際に使える値に合わせて調整する
