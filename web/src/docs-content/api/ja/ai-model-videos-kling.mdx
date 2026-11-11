# kling

## Kling Image to Video

Kling モデルを使用して画像から動画を生成します。

image パラメータで画像 URL または Base64 エンコードされた画像データを渡すことができます。

`POST` `/kling/v1/videos/image2video`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 任意 | モデル/スタイル ID |
| `prompt` | string | 任意 | テキスト説明プロンプト |
| `image` | string | 任意 | 画像入力（URL または Base64） |
| `duration` | number | 任意 | 動画の長さ（秒） |
| `width` | integer | 任意 | 動画の幅 |
| `height` | integer | 任意 | 動画の高さ |
| `fps` | integer | 任意 | 動画のフレームレート |
| `seed` | integer | 任意 | 乱数シード |
| `n` | integer | 任意 | 生成する動画の数 |
| `response_format` | string | 任意 | 応答フォーマット |
| `user` | string | 任意 | ユーザー識別子 |
| `metadata` | object | 任意 | 拡張パラメータ（negative_prompt、style、quality_level など） |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 動画生成タスクの作成に成功 |
| `400` | リクエストパラメータエラー |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `task_id` | string | タスク ID |
| `status` | string | タスク状態 |

#### `400` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |

## Kling Text-to-Video

Kling モデルを使用してテキスト説明から動画を生成します。

対応モデル：kling-v1、kling-v1-5 など

`POST` `/kling/v1/videos/text2video`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 任意 | モデル/スタイル ID |
| `prompt` | string | 任意 | テキスト説明プロンプト |
| `image` | string | 任意 | 画像入力（URL または Base64） |
| `duration` | number | 任意 | 動画の長さ（秒） |
| `width` | integer | 任意 | 動画の幅 |
| `height` | integer | 任意 | 動画の高さ |
| `fps` | integer | 任意 | 動画のフレームレート |
| `seed` | integer | 任意 | 乱数シード |
| `n` | integer | 任意 | 生成する動画の数 |
| `response_format` | string | 任意 | 応答フォーマット |
| `user` | string | 任意 | ユーザー識別子 |
| `metadata` | object | 任意 | 拡張パラメータ（negative_prompt、style、quality_level など） |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 動画生成タスクの作成に成功 |
| `400` | リクエストパラメータエラー |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `task_id` | string | タスク ID |
| `status` | string | タスク状態 |

#### `400` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |

## Get Kling Image-to-Video Task Status

Kling の画像から動画へのタスクの状態と結果を照会します。

`GET` `/kling/v1/videos/image2video/{task_id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | 必須 | タスク ID |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | タスク状態の取得に成功 |
| `404` | タスクが存在しません |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `task_id` | string | タスク ID |
| `status` | enum（`queued`, `in_progress`, `completed`, `failed`） | タスク状態 |
| `url` | string | 動画リソース URL（成功時） |
| `format` | string | 動画フォーマット |
| `metadata.duration` | number | 実際に生成された動画の長さ |
| `metadata.fps` | integer | 実際のフレームレート |
| `metadata.width` | integer | 実際の幅 |
| `metadata.height` | integer | 実際の高さ |
| `metadata.seed` | integer | 使用された乱数シード |
| `error.code` | integer | エラーコード |
| `error.message` | string | エラーメッセージ |

#### `404` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |

## Get Kling Text-to-Video Task Status

Kling のテキストから動画へのタスクの状態と結果を照会します。

`GET` `/kling/v1/videos/text2video/{task_id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | 必須 | タスク ID |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | タスク状態の取得に成功 |
| `404` | タスクが存在しません |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `task_id` | string | タスク ID |
| `status` | enum（`queued`, `in_progress`, `completed`, `failed`） | タスク状態 |
| `url` | string | 動画リソース URL（成功時） |
| `format` | string | 動画フォーマット |
| `metadata.duration` | number | 実際に生成された動画の長さ |
| `metadata.fps` | integer | 実際のフレームレート |
| `metadata.width` | integer | 実際の幅 |
| `metadata.height` | integer | 実際の高さ |
| `metadata.seed` | integer | 使用された乱数シード |
| `error.code` | integer | エラーコード |
| `error.message` | string | エラーメッセージ |

#### `404` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |
