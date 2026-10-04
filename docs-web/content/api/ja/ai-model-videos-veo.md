# Google Veo 形式

Google Veo 3.1 動画生成：非同期タスク API を通じて Veo 3.1 モデルファミリー全体を呼び出し、テキストから動画と画像から動画に対応します。同期オーディオは任意で、最大 4K 出力に対応しています。

## 対応モデル

3 つのモデルは同一のエンドポイントを共有し、`model` フィールドのみで区別されます。すべてのモデルはテキストから動画と画像から動画に対応し、オーディオ生成は任意です。

| モデル ID | バージョン | 特徴 | 最適な用途 |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | 最高品質、4K、ネイティブオーディオ | 高品質なクリエイティブおよび商業用途 |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | より高速、安定した品質 | 迅速な反復、バッチ生成 |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | 最速、最低コスト | プロトタイピング、コスト重視のケース |

## 動画の作成

`POST` `/v1/video/generations`

### リクエストヘッダー

| ヘッダー | 必須 | 説明 |
|---|---|---|
| `Authorization` | はい | `Bearer sk-your-api-key` |
| `Content-Type` | はい | `application/json` |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | はい | Veo 3.1 モデル ID。上の表を参照 |
| `prompt` | string | はい | 動画プロンプト。中国語と英語に対応。最適な結果のためには英語推奨 |
| `size` | string | いいえ | 解像度：`720p` / `1080p` / `4000`（4K、一部モデルのみ）、デフォルト `1080p` |
| `resolution` | string | いいえ | `size` と同じ（推奨、上流と一致。両方設定した場合は `resolution` が優先） |
| `duration` | int | いいえ | 長さ（秒）：`4` / `6` / `8`、デフォルト `8` |
| `seconds` | string | いいえ | `duration` の文字列形式（OpenAI Sora API 互換のため） |
| `aspect_ratio` | string | いいえ | アスペクト比：`16:9` / `9:16`、デフォルト `16:9` |
| `generate_audio` | bool | いいえ | 同期オーディオを生成（音声、効果音、environments）。**デフォルト `true`**。コストを節約する場合は明示的に `false` に設定 |
| `negative_prompt` | string | いいえ | 避けたい内容を説明するネガティブプロンプト |
| `image` | string | いいえ | i2v のファーストフレーム画像。HTTP(S) URL / データ URI / 生 base64 |
| `images` | string[] | いいえ | i2v のファーストフレーム画像配列。`images[0]` のみが使用され、両方を送った場合は `image` が優先されます |
| `last_frame_image` | string | いいえ | ラストフレーム画像（`image` / `images[0]` と併用するとファースト＋ラストフレーム補間。Veo 3.1 専用）。`image` と同じ形式 |
| `reference_images` | string[] | いいえ | 参照画像。最大 3 枚。上流には `referenceType="asset"` として送信されます。**`image` / `last_frame_image` とは排他**で、`duration=8` の場合のみサポートされます |
| `metadata` | object | いいえ | Veo ネイティブのパラメータコンテナ。「metadata 詳細パラメータ」を参照 |

> `generate_audio` / `negative_prompt` / `aspect_ratio` などのトップレベルの snake_case フィールドは、上流の camelCase パラメータに自動的にマッピングされます。`metadata` 内（snake_case または camelCase）にも配置でき、これはトップレベルと同等です。
>
> `generate_audio: true` はコストを大幅に増加させます（約 2 倍）。課金のデフォルトが `true` のため、オーディオが不要な場合は `generate_audio: false` を明示的に設定してください。

### レスポンス

| ステータス | 説明 |
|---|---|
| `200` | 動画タスクの作成に成功 |
| `400` | リクエストパラメータが不正 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` / `task_id` | string | 公開タスク ID（`task_` プレフィックス）。後続の照会に使用 |
| `object` | string | オブジェクト種別（`video`） |
| `model` | string | 使用されたモデル |
| `status` | string | タスクステータス（送信直後は `queued`） |
| `progress` | integer | 進捗率（パーセント） |
| `created_at` | integer | 作成タイムスタンプ |

## 動画タスクのステータス取得

`GET` `/v1/video/generations/{task_id}`

レスポンスは Uter の統一 `{code, message, data}` エンベロープを使用します。

### リクエストパラメータ

| 名前 | 場所 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | はい | 動画タスク ID |

### レスポンス

| ステータス | 説明 |
|---|---|
| `200` | タスクステータスの取得に成功 |
| `404` | タスクが見つかりません |

#### `200` レスポンスフィールド（`data`）

| フィールド | 型 | 説明 |
|---|---|---|
| `data.task_id` | string | タスク ID |
| `data.status` | string | タスクステータス：`queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | 失敗理由。成功時は `null` |
| `data.format` | string / null | 出力形式（例：`mp4`）。処理中または失敗時は `null` |
| `data.metadata` | object / null | 追加メタデータ |
| `data.url` | string / null | 動画のダウンロード URL。処理中または失敗時は `null`（一時署名付きリンク、24 時間有効） |

#### ステータス列挙

| ステータス | 説明 |
|---|---|
| `queued` | 送信済み、処理待ち |
| `processing` | 生成中 |
| `succeeded` | 完了。`data.url` にダウンロード先が含まれます |
| `failed` | 失敗。`data.error` で理由を確認できます |

## 画像入力の形式

`image` / `images[0]` は次の 3 つの形式を受け付けます。Uter が이를検出し、Veo が期待するインライン base64 に変換します。

| 形式 | 例 | 説明 |
|---|---|---|
| HTTP(S) URL | `https://example.com/foo.png` | バックエンドがダウンロードして base64 エンコード。URL は公開アクセス可能で、有効期限が切れていない必要があります |
| データ URI | `data:image/png;base64,iVBOR...` | インラインデータをそのまま渡す。ネットワークは不要 |
| 生 base64 | `iVBORw0KGgo...`（プレフィックスなし） | プレフィックスなしの base64。MIME タイプは自動判別されます |

制限：デコード後のサイズ ≤ **20 MB**、URL ダウンロードのタイムアウト **30 秒**。解析失敗（URL に到達できない / 大きすぎる / 不正な base64）の場合は `400 parse images[0] failed: ...` が返り、**課金は発生しません**。ネイティブの `gs://` GCS URI はサポートされていません。代わりに `https://storage.googleapis.com/...` を使用してください。

## metadata 詳細パラメータ

`metadata` は、OpenAI 形式には存在しない詳細オプションのための Veo ネイティブパラメータコンテナです。トップレベルのすべてのフィールドを `metadata` 内（snake_case または camelCase）に配置することもできます。

| フィールド | 型 | 説明 |
|---|---|---|
| `seed` | int | 乱数シード（推奨配置先） |
| `personGeneration` / `person_generation` | string | 人物生成ポリシー：`allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | 結果を GCS バケットのパスに直接書き込み（vertex チャネルのみ。権限が必要） |
| `compressionQuality` / `compression_quality` | string | 圧縮品質：`optimized`（デフォルト）/ `lossless` |
| `resizeMode` / `resize_mode` | string | i2v のリサイズモード：`crop` / `fit` |
| `sampleCount` / `sample_count` | int | リクエストあたりの動画数。**現在 1 に固定**されており、どの値も上書きされます |

> 優先順位：metadata 内の camelCase > metadata 内の snake_case > トップレベルフィールド。

## モデル比較

| 項目 | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **モデル ID** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **品質** | 最高 | バランス | 基本 |
| **速度（実測、8 秒動画）** | 90〜130 秒 | 75〜105 秒 | 50〜80 秒 |
| **最大解像度** | 4K | 1080p | 1080p |
| **オーディオ対応** | ✓ | ✓ | ✓ |
| **画像から動画** | ✓ | ✓ | ✓ |

## OpenAI 互換エンドポイント

`/v1/video/generations` に加えて、OpenAI 形式の `/v1/videos` エンドポイントも利用でき、両者は完全に等価です。

- 送信：`POST` `/v1/videos`（ボディフィールドは同一）
- 照会：`GET` `/v1/videos/{task_id}`（フラットな OpenAI 形式を返す）

> OpenAI 互換の照会レスポンスには動画の URL が含まれません。ダウンロード先を取得するには `/v1/video/generations/{task_id}` を使用して `data.url` を読み取ってください。

## 課金

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0 (本番デフォルトグループ)
```

### 動画のみ（`generate_audio: false`）

| モデル | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.20 / 秒 | $0.20 / 秒 | $0.40 / 秒 |
| `veo-3.1-fast-generate-001` | $0.08 / 秒 | $0.10 / 秒 | $0.25 / 秒 |
| `veo-3.1-lite-generate-001` | $0.03 / 秒 | $0.05 / 秒 | — |

### 動画 + オーディオ（`generate_audio: true`）

| モデル | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.40 / 秒 | $0.40 / 秒 | $0.60 / 秒 |
| `veo-3.1-fast-generate-001` | $0.10 / 秒 | $0.12 / 秒 | $0.30 / 秒 |
| `veo-3.1-lite-generate-001` | $0.05 / 秒 | $0.08 / 秒 | — |

`failed` の場合、Uter は自動的に返金します。

## 完全な例

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# Poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Once data.status == "succeeded", download from data.url
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

ファースト＋ラストフレーム補間（Veo 3.1 専用）：

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` は `image` / `images` / `last_frame_image` と組み合わせることはできません。組み合わせた場合は `400 reference_images is mutually exclusive ...` が返されます。
- `reference_images` は最大 3 件です。それを超えると `400 reference_images supports at most 3 entries` が返されます。
- `reference_images` は `duration=8` の場合のみサポートされます。

## ステータスコードとエラー

| ステータス | 理由 | 対処 |
|---|---|---|
| `400` | パラメータエラー（`prompt` の欠落、不正な `duration`、画像解析失敗 `parse images[0] failed: ...`） | リクエストボディのフィールドを確認してください |
| `401` | API キーが無効または期限切れ | `Authorization` ヘッダーを確認してください |
| `403` | このモデルへのアクセスが許可されていない API キー | トークンのモデルホワイトリストを確認してください |
| `402` | 残高が不足 | Uter コンソールでチャージしてください |

`failed` の一般的な原因：コンテンツセキュリティによる拒否（プロンプトを調整。`negative_prompt` を追加）、到達できない画像 URL、範囲外の `duration`、Lite モデルでの 4K リクエスト。
