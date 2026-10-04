# MiniMax 形式

MiniMax H3（`MiniMax-H3`）動画生成：非同期タスク API を通じて MiniMax H3 を呼び出し、テキストから動画、画像から動画、参照から動画に対応します。上流の実使用量に基づいて正確に課金されます。

## モデルと機能

モデル名は `MiniMax-H3` の 1 種類のみです。**生成モードは、リクエストに含まれるメディア入力に応じて自動的に決定されます。**

| モード | トリガー | メディア入力 |
|---|---|---|
| テキストから動画（t2v） | `prompt` のみ | なし |
| 画像から動画（i2v） | ファーストフレーム画像（ラストフレーム画像は任意） | `input_reference` / `images` |
| 参照から動画（r2v） | 参照画像 / 動画 / 音声 | トップレベルの `media[]` 配列 |

いずれのモードでも、`prompt` は**常に必須**です。

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
| `model` | string | はい | `MiniMax-H3` に固定 |
| `prompt` | string | はい | テキストプロンプト |
| `resolution` | string | いいえ | 解像度。現時点では `2K` のみ（デフォルト `2K`） |
| `duration` | int | いいえ | 動画の長さ（秒）。`4`〜`15`、デフォルト `6` |
| `ratio` | string | いいえ | アスペクト比：`16:9` / `9:16` / `1:1` / `adaptive`。t2v では `16:9`、i2v では `adaptive`（ファーストフレームに追随）がデフォルト |
| `input_reference` | string | いいえ | i2v のファーストフレーム画像 URL（公開 URL または base64） |
| `images` | string[] | いいえ | i2v の画像配列：1 枚目がファーストフレーム、2 枚目がラストフレーム |
| `media` | object[] | いいえ | 参照から動画用の構造化メディア入力。下記を参照 |

### `media[]` の要素

参照から動画（r2v）で、各参照アセットの役割を正確に指定するために使用します。

| `type` | 役割 | 用途 |
|---|---|---|
| `reference_image` | 参照画像 | 参照画像 |
| `reference_video` | 参照動画 | 参照動画（その課金対象秒数が合計秒数に加算されます） |
| `reference_audio` | 参照音声 | 参照音声 |
| `first_frame` / `last_frame` | ファースト / ラストフレーム | i2v のファースト / ラストフレーム画像 |

構造化された `media` を省略した場合、Uter は `images` / `input_reference` から拡張子と順序でアセットを推定します：動画 → 参照動画、音声 → 参照音声、1 枚目の画像 → ファーストフレーム、2 枚目の画像 → ラストフレーム。役割を厳密に制御したい場合は `media[]` を使用してください。

> 参照音声（`reference_audio`）は現時点で上流の対応状況に制限があります。テストでは上流がタスク失敗を返すため、Uter が自動的に全額返金します。テキストから動画、画像から動画（ファーストフレーム / ファースト＋ラストフレーム）、参照画像・参照動画からの生成はいずれも正常に動作します。

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

> `id` / `task_id` は Uter が生成するもので、上流の MiniMax の task_id ではありません。

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
| `data.status` | string | タスクステータス：`QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | 動画結果 URL（`SUCCESS` の場合のみ値あり） |
| `data.quota` | int | 最終的な課金クォータ（実使用量に基づいてすでに精算済み） |
| `data.data.task.usage` | object | 上流の正確な使用量。課金の基準（`total_seconds` / `input_seconds` / `output_seconds` / `input_image_count`） |

#### ステータス列挙

| 統一ステータス | MiniMax ステータス | 説明 |
|---|---|---|
| `QUEUED` | `queued` / `preparing` | 待機中 |
| `IN_PROGRESS` | `running` | 生成中 |
| `SUCCESS` | `succeeded` | 完了。`result_url` に動画が含まれます |
| `FAILURE` | `failed` / `cancelled` / `expired` | 失敗。`fail_reason` で理由を確認できます |

## 課金

MiniMax H3 は**上流の実使用量**に基づいて課金されます。

```
cost(USD) = total_billed_seconds × resolution_price + billable_reference_images × $0.04
where: total_billed_seconds = input_reference_video_seconds + generated_video_seconds
```

| 解像度 | 価格 |
|---|---|
| `2K` | $0.13 / 秒 |
| `768P` | $0.09 / 秒（未対応） |

重要なポイント：

- **入力の参照動画も課金対象です**：r2v では参照動画の課金対象秒数が出力解像度の価格で計算されます。
- **参照画像は別途課金されます**：課金対象の参照画像 1 枚につき $0.04。
- **送信時に仮払い、完了時に精算**：送信時に仮の課金が適用され、成功時に Uter が上流の `usage` から正確に再計算して差額を返金または追加課金します。

## 完全な例

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "A cat dozing in the sunlight, fur gently swaying in the breeze",
    "resolution": "2K",
    "duration": 6,
    "ratio": "16:9"
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

トップレベルの `media[]` 配列を使用した参照から動画：

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "Generate a coherent video from the given assets",
    "resolution": "2K",
    "duration": 6,
    "media": [
      { "type": "reference_image", "url": "https://example.com/ref.jpg" },
      { "type": "reference_video", "url": "https://example.com/ref.mp4" }
    ]
  }'
```

## ステータスコードとエラー

| ケース | 説明 |
|---|---|
| `prompt` が欠落 | `400`、`prompt is required`（送信前に拒否され、課金は発生しません） |
| `401` / `403` | API キーが無効、またはこのモデルへのアクセスが許可されていません |
| `402` | 残高が不足しています（`insufficient user quota`）。Uter コンソールでチャージしてください |
| タスク `FAILURE` | 上流の生成に失敗しました。`fail_reason` を確認してください。Uter は自動的に返金します |
