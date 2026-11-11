# Seedance 形式

Seedance 動画生成（Dreamina）：非同期タスク API を通じて Dreamina Seedance 2.0 モデルファミリーを呼び出し、テキストから動画、画像から動画、動画の継続 / 編集に対応します。

## 対応モデル

| モデル | 説明 | 機能 |
|---|---|---|
| `dreamina-seedance-2-0` | 標準版 Seedance 2.0、品質重視 | テキストから動画、画像から動画、動画の継続 |
| `dreamina-seedance-2-0-fast` | 高速版 Seedance 2.0、レイテンシ低 | テキストから動画、画像から動画、動画の継続 |

両モデルは `metadata.content` 内に `video_url` を渡すことで**動画を入力**として利用できます（継続 / 編集）。

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
| `model` | string | はい | Seedance モデル名。上の表を参照 |
| `prompt` | string | はい | 動画プロンプト |
| `image` | string | いいえ | 画像から動画用の参照画像（URL または base64 データ URI）。`images` とは排他 |
| `images` | string[] | いいえ | 複数画像参照（URL または base64 データ URI） |
| `duration` | int | いいえ | 長さ（秒）。通常は 5 / 10、デフォルト 5 |
| `seconds` | string | いいえ | `duration` の文字列形式（OpenAI Sora API 互換のため）。単位なしの数値文字列（例：`"5"`、`"10"`）である必要があります。トップレベルの `duration` が `0` または省略されている場合にのみ有効 |
| `metadata` | object | いいえ | Seedance 固有のパラメータコンテナ。「固有パラメータ」を参照 |

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

> `id` / `task_id` は Uter が生成するもので、上流のタスク ID ではありません。

## 動画タスクのステータス取得

`GET` `/v1/video/generations/{task_id}`

レスポンスは `{code, message, data}` エンベロープです。成功時は `code` が `"success"` になり、`data` がタスク詳細オブジェクトになります。

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
| `data.id` | int | 内部の自動採番タスク ID |
| `data.task_id` | string | 公開タスク ID（`task_` プレフィックス） |
| `data.platform` | string | 上流プラットフォームコード |
| `data.user_id` | int | ユーザー ID |
| `data.group` | string | グループ名 |
| `data.channel_id` | int | 実際に使用されたチャネル ID |
| `data.quota` | int | このタスクで課金された生のクォータ |
| `data.action` | string | タスクアクション。通常は `generate` |
| `data.status` | string | タスクステータス：`SUBMITTED` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.fail_reason` | string | 失敗理由（`status = FAILURE` の場合のみ） |
| `data.result_url` | string | 動画結果 URL（成功時のみ返される。上流の一時リンク） |
| `data.progress` | string | 進捗。例：`"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | 送信 / 開始 / 完了の Unix タイムスタンプ（秒） |
| `data.properties.upstream_model_name` | string | 実際に上流へ送信されたモデル名 |
| `data.data` | object | 上流の生レスポンス（`usage`、`content.video_url`、`resolution`、`framespersecond` など） |

#### ステータス列挙

| ステータス | 説明 |
|---|---|
| `SUBMITTED` | 送信済み |
| `QUEUED` | 上流の待機キュー |
| `IN_PROGRESS` | 生成中 |
| `SUCCESS` | 完了。`result_url` に動画が含まれます |
| `FAILURE` | 失敗。`fail_reason` で理由を確認できます |

## 動画コンテンツの取得

`GET` `/v1/videos/{task_id}/content`

生の動画ストリーム（`Content-Type: video/mp4`）を返します。Uter が上流 URL をプロキシします。

### リクエストパラメータ

| 名前 | 場所 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | はい | 動画タスク ID |

> **強く推奨**：`result_url` は有効期間が限定された上流の一時リンクのため、`/content` プロキシ経由でダウンロードしてください。

## 固有パラメータ（`metadata`）

Seedance 固有のすべてのフィールドはリクエストボディの `metadata` オブジェクト経由で渡し、上流に転送されます。

### 解像度 / アスペクト比 / 長さ

| フィールド | 型 | 説明 |
|---|---|---|
| `resolution` | string | 解像度ティア：`480p` `720p` `1080p` |
| `ratio` | string | アスペクト比：`16:9` `9:16` `1:1` `4:3` `3:4` `21:9` `adaptive` |
| `duration` | int | 動画の長さ（秒）：`5` `10`。**注意：** トップレベルの `duration`（または `seconds`）が `metadata.duration` より優先されます |
| `frames` | int | フレーム数（任意、`duration` とは排他）。例：`121` |
| `seed` | int | 乱数シード。`0`〜`2^31-1` |

### カメラとコンテンツ制御

| フィールド | 型 | 説明 |
|---|---|---|
| `camera_fixed` | bool | カメラを固定（`true` = 固定） |
| `watermark` | bool | 公式ウォーターマークを追加するか |

### 詳細パラメータ

| フィールド | 型 | 説明 |
|---|---|---|
| `service_tier` | string | 速度とクォータに影響するサービスティア（例：`auto` / `default` / `priority`） |
| `execution_expires_after` | int | タスク実行のタイムアウト（秒） |
| `generate_audio` | bool | 音声を生成するか |
| `draft` | bool | ドラフトモード（より高速かつ安価で、品質はわずかに低下） |
| `return_last_frame` | bool | レスポンスにラストフレーム画像を返すか |
| `callback_url` | string | タスク完了時に通知されるコールバック URL |

### マルチモーダル入力（`content` 配列）

トップレベルの `image` / `images` フィールドに加え、`metadata.content` にマルチモーダル入力配列を渡し、**画像**と**動画**を混在させることができます。

| `type` | 用途 |
|---|---|
| `image_url` + `image_url.url` | 画像参照（画像から動画） |
| `video_url` + `video_url.url` | 動画入力（継続 / 編集） |

```json
{
  "model": "dreamina-seedance-2-0",
  "prompt": "Extend this video so the cat walks out of frame",
  "metadata": {
    "content": [
      { "type": "video_url", "video_url": { "url": "https://example.com/cat.mp4" } }
    ],
    "resolution": "720p"
  }
}
```

## 完全な例

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-0",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "metadata": { "resolution": "720p", "ratio": "16:9", "seed": 42 }
  }'

# Poll the task
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## ステータスコードとエラー

| ケース | 説明 |
|---|---|
| `400` | モデルが見つからない、または無権（`model not allowed`）、`prompt` が空（`prompt is required`）、無効な解像度 / 長さ |
| `401` / `403` | API キーが無効、またはこのモデルへのアクセスが許可されていません（トークンのモデルホワイトリストを確認してください） |
| `402` | 残高が不足しています（`insufficient user quota`） |
| タスク `FAILURE` | 上流での失敗（モデレーション / 画像または動画 URL に到達できない / 上流タイムアウト）。Uter は自動的に課金を返金します |

推奨される対応：モデレーション失敗時はプロンプトを調整してください。URL に到達できない場合は base64 に切り替えてください。上流タイムアウト時は後再試行するか `dreamina-seedance-2-0-fast` に切り替えてください。
