# Wanx 形式

Wan 2.7 動画生成：非同期タスク API を通じて Wan 2.7 モデルファミリー全体を呼び出し、テキストから動画、画像から動画、参照から動画、動画編集に対応します。1080P 出力、最大 15 秒の動画、マルチショットのナラティブ、ネイティブオーディオ同期を備えています。

## 対応モデル

4 つのモデルは同一のエンドポイント `/v1/video/generations` を共有し、`model` フィールドのみで区別されます。レスポンスの構造も同一です。

| モデル | 機能 | 必須メディア入力 | 説明 |
|---|---|---|---|
| `wan2.7-t2v` | テキストから動画 | — | テキストから動画を生成。マルチショットのナラティブと音声同期に対応 |
| `wan2.7-i2v` | 画像から動画 | 1 枚のファーストフレーム画像 | ファーストフレーム画像からプロンプトに従ってアニメーション化 |
| `wan2.7-r2v` | 参照から動画 | 1〜9 枚の参照画像 | 被写体の一貫性を保つ複数画像参照。`[Image N]` として画像を参照 |
| `wan2.7-videoedit` | 動画編集 | 1 本の動画 + 0〜3 枚の参照画像 | テキスト指示によるスタイル転送、要素置換、部分編集 |

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
| `model` | string | はい | Wan 2.7 モデル名。上の表を参照 |
| `prompt` | string | はい | テキストプロンプト。5000 文字まで、中国語と英語に対応 |
| `resolution` | string | いいえ | 解像度ティア：`720P` / `1080P`、デフォルト `720P`。**推奨**。Alibaba Cloud の公式フィールド名と一致します |
| `size` | string | いいえ | 旧フィールド名。両方を送信した場合は `resolution` が優先されます。`size` のみを送信した場合はその値が解像度として使用されます。新しい連携では `resolution` を使用してください |
| `duration` | int | いいえ | 長さ（秒）：t2v/i2v は `2`〜`15`、デフォルト `5`。参照動画ありの r2v は `2`〜`10`。`videoedit` では無視されます（入力動画に従い、最大 15 秒） |
| `input_reference` | string | いいえ | i2v のみ：ファーストフレーム画像の公開 URL |
| `images` | array | いいえ | videoedit のみ：メディア URL の配列。1 番目の要素は編集対象の動画（MP4/MOV）、残りは任意の参照画像（最大 3 枚） |
| `metadata` | object | いいえ | Wan 2.7 固有のパラメータコンテナ。下記を参照 |

> `images` フィールドはリリースの移行期にあります。リリース前は `metadata.input.media` 配列でメディアを渡してください。リリース後はシステムが URL の拡張子からメディア種別を推定するため、`images` を直接使用できます。

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

> `id` / `task_id` は Uter が生成するもので、上流の DashScope の task_id ではありません。常にここで返される値を使用してください。

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
| `data.task_id` | string | 公開タスク ID |
| `data.status` | string | タスクステータス：`NOT_START` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | 動画結果 URL（`SUCCESS` の場合のみ値あり。上流の OSS 署名付きリンクで 24 時間有効） |
| `data.fail_reason` | string | 失敗理由（`FAILURE` の場合のみ値あり） |
| `data.quota` | int | このタスクで課金された生のクォータ |
| `data.progress` | string | 進捗文字列。例：`"40%"` / `"100%"` |
| `data.properties.upstream_model_name` | string | 実際に上流へ送信されたモデル名 |
| `data.data` | object | 上流 DashScope の生レスポンス（`output.video_url`、`usage`、`request_id`） |

#### ステータス列挙

| ステータス | 上流ステータス | 説明 |
|---|---|---|
| `NOT_START` | `PENDING` | 作成済み、まだ処理されていません |
| `QUEUED` | `PENDING` | 上流の待機キューです |
| `IN_PROGRESS` | `RUNNING` | 生成中 |
| `SUCCESS` | `SUCCEEDED` | 完了。`result_url` に動画が含まれます |
| `FAILURE` | `FAILED` / `CANCELED` / `UNKNOWN` | 失敗。`fail_reason` で理由を確認できます |

## 固有パラメータ（`metadata`）

以下はリクエストボディの `metadata` オブジェクト経由で渡します。Uter が上流 DashScope に転送します。

### 共通制御パラメータ

| フィールド | 型 | 適用対象 | 説明 | デフォルト |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | アスペクト比：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `seed` | int | すべて | 乱数シード。`0`〜`2147483647`。省略時は自動生成 | — |
| `negative_prompt` | string | すべて | ネガティブプロンプト。500 文字まで | — |

> i2v は `ratio` に対応していません。アスペクト比は入力のファーストフレーム画像に従います。

### マルチメディア入力（`metadata.input.media`）

r2v と videoedit では、`metadata.input.media` 配列経由でメディアを渡します。

| `type` | 用途 | 件数制限 |
|---|---|---|
| `reference_image` | 参照画像 | r2v：1〜9、videoedit：0〜3 |
| `video` | 編集対象の動画（videoedit のみ） | ちょうど 1 |
| `first_frame` | ファーストフレーム画像（i2v のみ。トップレベルの `input_reference` も使用可能） | ちょうど 1 |

r2v では、プロンプト内で `[Image 1]`、`[Image 2]` を使って配列順で参照画像を指定します。

### メディアの制約

| 種別 | フォーマット | 解像度 | サイズ | その他の制約 |
|---|---|---|---|---|
| 画像（i2v ファーストフレーム） | JPEG / JPG / PNG / WEBP | 240〜8000 px | ≤ 10 MB | アスペクト比 1:8〜8:1 |
| 画像（r2v 参照） | JPEG / JPG / PNG / WEBP | 短辺 ≥ 300 px | ≤ 10 MB | シャープな画像を使用してください |
| 画像（videoedit 参照） | JPEG / JPG / PNG / BMP / WEBP | 240〜8000 px | ≤ 20 MB | アスペクト比 1:8〜8:1 |
| 動画（videoedit 入力） | MP4 / MOV（H.264） | 240〜4096 px | ≤ 100 MB | 2〜10 秒、アスペクト比 1:8〜8:1 |

## OpenAI 互換エンドポイント

`/v1/video/generations` に加えて、OpenAI 形式の `/v1/videos` エンドポイントも利用でき、両者は完全に等価です。

- 送信：`POST` `/v1/videos`（ボディフィールドは同一）
- 照会：`GET` `/v1/videos/{task_id}`（フラットな OpenAI 形式を返す）

| OpenAI ステータス | 統一ステータス |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## 課金

Wan 2.7 は**秒数 × 解像度係数**で課金されます。

| 解像度 | 価格 | 5 秒の場合の例 |
|---|---|---|
| `720P` | $0.10 / 秒 | $0.50 |
| `1080P` | $0.15 / 秒 | $0.75 |

```
quota = modelPrice × QuotaPerUnit × groupRatio × seconds × resolutionRatio

QuotaPerUnit    = 500,000
modelPrice      = 0.10 (all wan2.7 models)
groupRatio      = 1.0 (production default group)
resolutionRatio = 720P → 1.0, 1080P → 1.5
```

`FAILURE` の場合、Uter は自動的に返金します。

## 完全な例

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-t2v",
    "prompt": "A kitten running under the moonlight, fur drifting in the wind, cinematic slow motion",
    "resolution": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42 }
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

videoedit の場合は `images` 配列でメディアを渡します。1 番目の MP4/MOV が編集対象の動画、残りの PNG/JPG/WEBP が参照画像です。`duration` は指定不要です（入力動画に従います）。

## ステータスコードとエラー

| ケース | 説明 |
|---|---|
| `400` | パラメータエラー（`prompt` の欠落、未知のモデル、videoedit での `images` が空など）。送信前に拒否され、課金は発生しません |
| `401` / `403` | API キーが無効、またはこのモデルへのアクセスが許可されていません |
| `402` | 残高が不足しています（`insufficient user quota`）。Uter コンソールでチャージしてください |
| タスク `FAILURE` | 上流の生成に失敗しました。`fail_reason` を確認してください。Uter は自動的に返金します |

`FAILURE` の一般的な原因：`DataInspectionFailed`（上流の安全審査による拒否。プロンプトまたは素材を調整してください）、i2v での `input_reference` の欠落、r2v での参照画像が 0 枚、videoedit での `images[0]` が MP4/MOV でない、到達できないメディア URL、または上記の制約に違反するメディア。
