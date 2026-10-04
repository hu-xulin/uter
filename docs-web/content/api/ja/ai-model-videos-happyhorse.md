# HappyHorse 形式

HappyHorse 動画生成：非同期タスク API を通じて HappyHorse 1.0 モデルファミリー全体を呼び出し、テキストから動画、画像から動画、参照から動画、動画編集に対応します。

## 対応モデル

4 つのモデルは同一のエンドポイント `/v1/video/generations` を共有し、`model` フィールドのみで区別されます。レスポンスの構造も同一です。

| モデル | 機能 | 必須メディア入力 | 説明 |
|---|---|---|---|
| `happyhorse-1.0-t2v` | テキストから動画 | — | テキスト説明のみから動画を生成 |
| `happyhorse-1.0-i2v` | 画像から動画 | 1 枚のファーストフレーム画像 | ファーストフレーム画像からプロンプトに従ってアニメーション化 |
| `happyhorse-1.0-r2v` | 参照から動画 | 1〜9 枚の参照画像 | 複数画像の参照。プロンプト内で `[Image N]` として画像を参照 |
| `happyhorse-1.0-video-edit` | 動画編集 | 1 本の動画 + 0〜5 枚の参照画像 | スタイル転送、部分置換など動画への編集 |

## 動画の作成

動画生成タスクを送信してタスク ID を取得し、ステータスエンドポイントをポーリングして結果を取得します。

`POST` `/v1/video/generations`

### リクエストヘッダー

| ヘッダー | 必須 | 説明 |
|---|---|---|
| `Authorization` | はい | `Bearer sk-your-api-key` |
| `Content-Type` | はい | `application/json` |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | はい | HappyHorse モデル名。上の表を参照 |
| `prompt` | string | はい | テキストプロンプト。中国語以外の文字で 5000 文字、中国語で 2500 文字まで。超える入力は切り詰められます |
| `size` | string | いいえ | 解像度ティア：`720P` / `1080P`、デフォルト `1080P` |
| `duration` | int | いいえ | 動画の長さ（秒）。`3`〜`15`、デフォルト `5`。`video-edit` では無視されます（入力動画に従い、最大 15 秒） |
| `input_reference` | string | いいえ | i2v のみ：ファーストフレーム画像の公開 URL |
| `metadata` | object | いいえ | HappyHorse 固有のパラメータコンテナ。下記を参照 |

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
| `data.result_url` | string | 動画結果 URL（`SUCCESS` の場合のみ値あり。上流の OSS 署名付きリンクで、通常 24 時間有効） |
| `data.fail_reason` | string | 失敗理由（`FAILURE` の場合のみ値あり） |
| `data.quota` | int | このタスクで課金された生のクォータ |
| `data.progress` | string | 進捗文字列。例：`"30%"` / `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | 送信 / 開始 / 完了の Unix タイムスタンプ（秒） |
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

### 動画制御パラメータ

| フィールド | 型 | 適用対象 | 説明 | デフォルト |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | アスペクト比：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `watermark` | bool | すべて | ウォーターマークを追加するか（右下隅に「Happy Horse」テキスト） | `true` |
| `seed` | int | すべて | 乱数シード。`0`〜`2147483647`。省略時は自動生成 | — |
| `audio_setting` | string | video-edit | 音声制御：`auto`（モデルが制御）/ `origin`（元の音声を維持） | `auto` |

> i2v は `ratio` に対応していません。アスペクト比は入力のファーストフレーム画像に従います。

### マルチメディア入力（`metadata.input.media`）

r2v と video-edit は `metadata.input.media` 配列経由でメディアを渡します。

| `type` | 役割 | 件数制限 |
|---|---|---|
| `reference_image` | 参照画像（r2v と video-edit が対応） | r2v：1〜9、video-edit：0〜5 |
| `video` | 編集対象の動画（video-edit のみ） | ちょうど 1 |
| `first_frame` | ファーストフレーム画像（i2v のみ。トップレベルの `input_reference` も使用可能） | ちょうど 1 |

r2v では、プロンプト内で `[Image 1]`、`[Image 2]` を使って配列順で参照画像を指定します。

### メディアの制約

| 種別 | フォーマット | 解像度 | サイズ | その他の制約 |
|---|---|---|---|---|
| 画像（i2v ファーストフレーム） | JPEG / JPG / PNG / WEBP | 幅と高さ ≥ 300 px | ≤ 10 MB | アスペクト比 1:2.5〜2.5:1 |
| 画像（r2v 参照） | JPEG / JPG / PNG / WEBP | 短辺 ≥ 400 px | ≤ 10 MB | シャープな画像を使用してください |
| 画像（video-edit 参照） | JPEG / JPG / PNG / WEBP | 幅と高さ ≥ 300 px | ≤ 10 MB | アスペクト比 1:2.5〜2.5:1 |
| 動画（video-edit 入力） | MP4 / MOV（H.264） | 長辺 ≤ 2160、短辺 ≥ 320 | ≤ 100 MB | 3〜60 秒、>8 fps、アスペクト比 1:2.5〜2.5:1 |

> video-edit の出力長：入力が 15 秒以下なら同じ長さ、15 秒超の場合は最初の 15 秒に切り詰められます。

## OpenAI 互換エンドポイント

`/v1/video/generations` に加えて、OpenAI 形式の `/v1/videos` エンドポイントも利用でき、両者は完全に等価です（同じバックエンドタスク）。

- 送信：`POST` `/v1/videos`（ボディフィールドは同一）
- 照会：`GET` `/v1/videos/{task_id}`（フラットな OpenAI 形式を返す）

| OpenAI ステータス | 統一ステータス |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## 完全な例

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "happyhorse-1.0-t2v",
    "prompt": "A cat dozing in the sunlight, fur gently swaying in the breeze",
    "size": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42, "watermark": false }
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

## ステータスコードとエラー

| ケース | 説明 |
|---|---|
| `400` | パラメータエラー（`prompt` が欠落、未知のモデルなど）。送信前に拒否され、課金は発生しません |
| `401` / `403` | API キーが無効、またはこのモデルへのアクセスが許可されていません（トークンのモデルホワイトリストを確認してください） |
| `402` | 残高が不足しています（`insufficient user quota`）。Uter コンソールでチャージしてください |
| タスク `FAILURE` | 上流の生成に失敗しました。`data.fail_reason` を確認してください。Uter は自動的に返金し、返金はログに表示されます |

`FAILURE` の一般的な原因：コンテンツモデレーションによる拒否（プロンプトを調整）、i2v での `input_reference` の欠落、r2v での参照画像が 0 枚、video-edit での動画の欠落、到達できないメディア URL、または上記の制約に違反するメディア。
