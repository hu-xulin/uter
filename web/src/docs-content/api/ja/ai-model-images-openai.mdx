# openai

## Edit Image

元の画像とプロンプトを给定して、編集または拡張した画像を作成します。

`POST` `/v1/images/edits/`

### リクエストボディ（`multipart/form-data`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `image` | string（binary） | 必須 | 編集する画像。有効な PNG ファイルで、4MB 未満かつ正方形である必要があります。マスクが指定されていない場合、画像は透過性を持っている必要があり、マスクとして使用されます。 |
| `mask` | string（binary） | 任意 | 追加の画像。完全に透明な領域（例: alpha がゼロの領域）が、画像を編集すべき位置を示します。有効な PNG ファイルで、4MB 未満かつ元の画像と同じサイズである必要があります。 |
| `prompt` | string | 必須 | 希望する画像のテキスト説明。最大長は 1000 文字です。 |
| `n` | string | 任意 | 生成する画像の数。1 から 10 の間である必要があります。 |
| `size` | string | 任意 | 生成される画像のサイズ。`256x256`、`512x512`、または `1024x1024` のいずれかである必要があります。 |
| `response_format` | string | 任意 | 生成された画像が返される形式。 `url` または `b64_json` のいずれかである必要があります。 |
| `user` | string | 任意 | エンドユーザーを代表する一意の識別子。OpenAI が不正利用の監視と検出に役立てることができます。[詳細](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids)。 |
| `model` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | レスポンス |

## Generate Images

プロンプトを给定して画像を作成します。[詳細](https://platform.openai.com/docs/guides/images)。

`POST` `/v1/images/generations/`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 任意 | 画像生成に使用するモデル。`dall-e-2`、`dall-e-3`、または `gpt-image-1` のいずれか。デフォルトは `dall-e-2`（ただし `gpt-image-1` 専用のパラメータを使用する場合を除く）。 |
| `prompt` | string | 必須 | 希望する画像のテキスト説明。`gpt-image-1` の最大長は 32000 文字、`dall-e-2` は 1000 文字、`dall-e-3` は 4000 文字です。 |
| `n` | integer | 任意 | 生成する画像の数。1 から 10 の間である必要があります。`dall-e-3` の場合は `n=1` のみ対応。 |
| `size` | string | 任意 | 生成される画像のサイズ。`gpt-image-1` の場合は `1024x1024`、`1536x1024`（横向き）、`1024x1536`（縦向き）、または `自動`（デフォルト）のいずれか。`dall-e-2` の場合は `256x256`、`512x512`、または `1024x1024` のいずれか。`dall-e-3` の場合は `1024x1024`、`1792x1024`、または `1024x1792` のいずれか。 |
| `background` | string | 任意 | 生成された画像の背景の透明度を設定できます。このパラメータは `gpt-image-1` のみ対応。`透明`、`不透明`、または `自動`（デフォルト）のいずれか。 `自動` を使用した場合、モデルが画像に最適な背景を自動的に決定します。`透明` の場合、出力形式は透明度をサポートする必要があるため、`png`（デフォルト）または `webp` に設定する必要があります。 |
| `moderation` | string | 任意 | `gpt-image-1` が生成する画像のコンテンツモデレーションのレベルを制御します。`低`（制限の緩いフィルタリング）または `自動`（デフォルト）のいずれかである必要があります。 |
| `quality` | string | 任意 | 生成される画像の品質。 |
| `stream` | string | 任意 | — |
| `style` | string | 任意 | — |
| `user` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | レスポンス |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
| `usage.total_tokens` | integer | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.input_tokens_details.text_tokens` | integer | — |
| `usage.input_tokens_details.image_tokens` | integer | — |
