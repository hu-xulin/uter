# PixVerse 形式

PixVerse 動画生成：OpenAI 互換の `/v1/videos` エンドポイントを通じて PixVerse モデルファミリー全体（C1 / V6 / V5.6 / V5.5 / V5 / V4.5 / V4 / V3.5）を呼び出し、テキストから動画と画像から動画に対応します。

## 対応モデル

`model` フィールドでは常に `PixVerse/<バージョン>` の形式を使用してください。例：`PixVerse/v5.6`。

| モデル | 特徴 | 長さティア | 音声 |
|---|---|---|---|
| `PixVerse/c1` | フラッグシップ、秒単位の最も柔軟な課金 | 1〜15 秒（秒単位） | ✓ |
| `PixVerse/v6` | 最新世代、秒単位課金 | 1〜15 秒（秒単位） | ✓ |
| `PixVerse/v5.6` | シングルクリップモード、安定した品質 | 5 / 8 / 10 秒 | ✓ |
| `PixVerse/v5.5` | マルチクリップの結合に対応 | 5 / 8 / 10 秒 | ✓ |
| `PixVerse/v5` | 第 5 世代のベースバージョン | 5 / 8 秒 | ✗ |
| `PixVerse/v4.5` | 第 4.5 世代、Fast Motion に対応 | 5 / 8 秒 | ✗ |
| `PixVerse/v4` | 第 4 世代、Fast Motion に対応 | 5 / 8 秒 | ✗ |
| `PixVerse/v3.5` | 第 3.5 世代、Fast Motion に対応 | 5 / 8 秒 | ✗ |

> `PixVerse/` プレフィックスは大文字と小文字が区別されます。`PixVerse/v5.6` を正確に指定してください。バージョン部分（`v5.6`、`c1`）は大文字と小文字を区別せず正規化されます。

## 動画の作成

`POST` `/v1/videos`

### リクエストヘッダー

| ヘッダー | 必須 | 説明 |
|---|---|---|
| `Authorization` | はい | `Bearer sk-your-api-key` |
| `Content-Type` | はい | `application/json` |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | はい | PixVerse モデル名。上の表を参照 |
| `prompt` | string | はい | 動画プロンプト。2048 文字まで |
| `image` | string | いいえ | 画像から動画用の元画像（URL または base64 データ URI）。指定すると画像から動画に切り替わります |
| `images` | string[] | いいえ | `image` の配列形式（`image` とは排他） |
| `duration` | int | いいえ | 長さ（秒）。デフォルト 5。対応するティアはモデルによって異なります |
| `resolution` | string | いいえ | 解像度ティア（`size` と同じ。モデル間の統一のため推奨）：`720P` / `1080P` |
| `size` | string | いいえ | 解像度：`360p` `540p` `720p` `1080p`、または `1920x1080` のようなピクセル形式。両方を指定した場合は `resolution` が優先されます |
| `metadata` | object | いいえ | PixVerse 固有のパラメータコンテナ。下記を参照 |

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

> `id` / `task_id` は Uter が生成するもので、上流の PixVerse の `video_id` ではありません。常にここで返される値を使用してください。

## 動画タスクのステータス取得

`GET` `/v1/videos/{task_id}`

### リクエストパラメータ

| 名前 | 場所 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | はい | 動画タスク ID |

### レスポンス

| ステータス | 説明 |
|---|---|
| `200` | タスクステータスの取得に成功 |
| `404` | タスクが見つかりません |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | 動画 ID |
| `status` | string | タスクステータス。列挙を参照 |
| `progress` | integer | 進捗率（パーセント） |
| `created_at` | integer | 作成タイムスタンプ |
| `completed_at` | integer | 完了タイムスタンプ（成功時） |
| `size` | string | 動画サイズ（成功時） |
| `metadata.url` | string | 動画 URL（`completed` の場合のみ） |
| `error.message` | string | 失敗理由（`failed` の場合のみ） |

#### ステータス列挙

| ステータス | 説明 |
|---|---|
| `queued` | 送信済み、待機中 |
| `in_progress` | 生成中 |
| `completed` | 完了。`metadata.url` に動画が含まれます |
| `failed` | 失敗。`error.message` で理由を確認できます |

## 動画コンテンツの取得

`GET` `/v1/videos/{task_id}/content`

生の動画ストリーム（`Content-Type: video/mp4`）を返します。Uter が PixVerse の一時 URL をプロキシし、上流アドレスの露出と有効期限の問題を回避します。

### リクエストパラメータ

| 名前 | 場所 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | はい | 動画タスク ID |

### レスポンス

| ステータス | 説明 |
|---|---|
| `200` | 動画コンテンツの取得に成功 |
| `404` | 動画が見つからないか、まだ完成していません |

> **強く推奨**：`metadata.url` に直接アクセスするのではなく、`/content` プロキシ経由でダウンロードしてください。前者は PixVerse の一時リンク（通常は数時間のみ有効）ですが、プロキシはタスク記録が存在する限り期限切れになりません。

## 固有パラメータ（`metadata`）

PixVerse 固有のすべてのフィールドは、リクエストボディの `metadata` オブジェクト経由で渡します。

### 共通フィールド

| フィールド | 型 | 適用対象 | 説明 |
|---|---|---|---|
| `quality` | string | すべて | 解像度。トップレベルの `size` より優先されます：`360p` `540p` `720p` `1080p` |
| `aspect_ratio` | string | テキストから動画 | アスペクト比：`16:9` `9:16` `1:1` `4:3` `3:4` `2:3` `3:2` `21:9` |
| `motion_mode` | string | V4.5 / V4 / V3.5 | モーションモード：`normal`（デフォルト）または `fast`（価格は 2 倍。360p/540p/720p の 5 秒のみ） |
| `camera_movement` | string | すべて | カメラ移動。例：`zoom_in` `zoom_out` `pan_left` `pan_right` |
| `seed` | int | すべて | 乱数シード。0〜2147483647 |
| `template_id` | int | すべて | テンプレート ID |
| `style` | string | すべて | スタイル。例：`anime` |
| `water_mark` | bool | すべて | ウォーターマークを追加するか |
| `negative_prompt` | string | すべて | ネガティブプロンプト |

> `motion_mode: fast` は V4.5 / V4 / V3.5、長さ 5 秒、360p/540p/720p に厳密に限定されています。その他の組み合わせ（`1080p + fast` や `8s + fast` など）は `400` を返し、課金は発生しません。

### 音声生成（C1 / V6 / V5.6 / V5.5）

| フィールド | 型 | 適用対象 | 説明 |
|---|---|---|---|
| `generate_audio_switch` | bool | C1 / V6 / V5.6 / V5.5 | 「音声あり」課金ティアに切り替える（音声は上流で生成） |

> V5 / V4.5 / V4 / V3.5 は音声に**対応していません**。`generate_audio_switch: true` を渡すと `400` が返ります。

### 画像から動画の詳細フィールド

PixVerse の画像から動画では、`img_id` を取得するために画像を上流へアップロードする必要があります。Uter は**アップロード処理を自動的にラップ**します。ボディに `image: "https://..."` または `image: "data:image/png;base64,..."` を渡すと、Uter が PixVerse へアップロードして `img_id` を取得し、転送します。

すでに `img_id` をお持ちの場合（上級者向け）は、直接渡してください。

| フィールド | 型 | 説明 |
|---|---|---|
| `img_id` | int | 事前アップロード済み画像 ID。`image` からの自動アップロードより優先されます |

## 完全な例

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "PixVerse/v5.6",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "size": "720p",
    "metadata": { "aspect_ratio": "16:9", "seed": 42 }
  }'

# Step 2: poll the task status (every 3~5 seconds)
curl https://uter.ai/v1/videos/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once completed, download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## ステータスコードとエラー

| ケース | 説明 |
|---|---|
| `400` | 無効なパラメータ組み合わせ（例：V5 での `generate_audio_switch: true`、1080p/8s での fast モード、非対応、品質 × 長さの組み合わせ、未知のモデル）。送信前に拒否され、課金は発生しません |
| `401` | API キーが無効または期限切れ |
| `403` | このモデルへのアクセスが許可されていない API キー（トークンのモデルホワイトリストを確認してください） |
| `402` | 残高が不足しています（`insufficient user quota`）。Uter コンソールでチャージしてください |
| タスク `failed` | 上流での失敗（モデレーション / 生成 / タイムアウト）。Uter は自動的に返金し、返金はログに表示されます |
