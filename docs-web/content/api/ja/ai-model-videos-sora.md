# sora

## ビデオ作成 (Create Video)

OpenAI 互換のビデオ生成インターフェースです。

参考ドキュメント: https://platform.openai.com/docs/api-reference/videos/create

`POST` `/v1/videos`

### リクエストボディ（`multipart/form-data`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | いいえ | モデル/スタイル ID |
| `prompt` | string | いいえ | テキストによる説明プロンプト |
| `image` | string | いいえ | 画像入力 (URL または Base64) |
| `duration` | number | いいえ | ビデオの長さ（秒） |
| `width` | integer | いいえ | ビデオの幅 |
| `height` | integer | いいえ | ビデオの高さ |
| `fps` | integer | いいえ | ビデオのフレームレート |
| `seed` | integer | いいえ | 乱数シード |
| `n` | integer | いいえ | 生成するビデオの数 |
| `response_format` | string | いいえ | レスポンスの形式 |
| `user` | string | いいえ | ユーザー識別子 |
| `metadata` | object | いいえ | 拡張パラメータ (negative_prompt, style, quality_level など) |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | ビデオタスクの作成に成功 |
| `400` | リクエストパラメータが不正 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | ビデオ ID |
| `object` | string | オブジェクトの種類 |
| `model` | string | 使用されたモデル |
| `status` | string | タスクの状態 |
| `progress` | integer | 進捗率（パーセント） |
| `created_at` | integer | 作成タイムスタンプ |
| `seconds` | string | ビデオの長さ |
| `completed_at` | integer | 完了タイムスタンプ |
| `expires_at` | integer | 有効期限タイムスタンプ |
| `size` | string | ビデオのサイズ |
| `error.message` | string | エラーメッセージ |
| `error.code` | string | エラーコード |
| `metadata` | object | その他のメタデータ |

#### `400` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラーの種類 |
| `error.param` | string | 関連するパラメータ |
| `error.code` | string | エラーコード |

## ビデオタスク状態の取得 (Get Video Task Status)

OpenAI 互換のビデオタスク状態照会インターフェースです。

ビデオタスクの詳細な状態情報を返します。

`GET` `/v1/videos/{task_id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | はい | ビデオタスク ID |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | ビデオタスクの状態を正常に取得 |
| `404` | タスクが存在しません |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `model` | string | — |
| `status` | string | — |
| `progress` | integer | — |
| `created_at` | integer | — |
| `seconds` | string | — |

#### `404` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラーの種類 |
| `error.param` | string | 関連するパラメータ |
| `error.code` | string | エラーコード |

## ビデオコンテンツの取得 (Get Video Content)

完了したビデオタスクのビデオファイルの内容を取得します。

このインターフェースはビデオファイルストリームをプロキシして返します。

`GET` `/v1/videos/{task_id}/content`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `task_id` | path | string | はい | ビデオタスク ID |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | ビデオコンテンツの取得に成功 |
| `404` | ビデオが存在しないか、未完了 |

#### `404` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラーの種類 |
| `error.param` | string | 関連するパラメータ |
| `error.code` | string | エラーコード |
