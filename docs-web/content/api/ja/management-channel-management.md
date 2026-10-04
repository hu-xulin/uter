# channel-management

## チャネルの一括削除

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/batch`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルタグの一括設定

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/batch/tag`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | いいえ | — |
| `tag` | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルのコピー

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/copy/{id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |
| `suffix` | query | string | いいえ | — |
| `reset_balance` | query | boolean | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 無効チャネルの削除

👨‍💼 管理者権限が必要（Admin）

`DELETE` `/api/channel/disabled`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 上流モデルリストの取得

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/fetch_models/{id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## モデルリストの取得

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/fetch_models`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `base_url` | string | いいえ | — |
| `type` | integer | いいえ | — |
| `key` | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネル機能の修復

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/fix`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## すべてのチャネルの取得

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `p` | query | integer | いいえ | — |
| `page_size` | query | integer | いいえ | — |
| `id_sort` | query | boolean | いいえ | — |
| `tag_mode` | query | boolean | いいえ | — |
| `status` | query | string | いいえ | — |
| `type` | query | integer | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルの削除

👨‍💼 管理者権限が必要（Admin）

`DELETE` `/api/channel/{id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 特定のチャネルの取得

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/{id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルキーの取得

👑 スーパー管理者権限が必要（Root）+ セキュリティ検証

`POST` `/api/channel/{id}/key`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルモデルリストの取得

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/models`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 有効モデルリストの取得

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/models_enabled`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 複数キーの管理

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/multi_key/manage`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `channel_id` | integer | いいえ | — |
| `action` | enum（`get_key_status`, `disable_key`, `enable_key`, `delete_key`, `delete_disabled_keys`, `enable_all_keys` …） | いいえ | — |
| `key_index` | integer | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルの追加

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `mode` | enum（`single`, `batch`, `multi_to_single`） | いいえ | — |
| `channel` | object | いいえ | Unresolved $ref: #/definitions/224188811 |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルの更新

👨‍💼 管理者権限が必要（Admin）

`PUT` `/api/channel/`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャネルの検索

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/search`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `keyword` | query | string | いいえ | — |
| `group` | query | string | いいえ | — |
| `model` | query | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## タグチャネルの無効化

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/tag/disabled`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `tag` | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## タグチャネルの有効化

👨‍💼 管理者権限が必要（Admin）

`POST` `/api/channel/tag/enabled`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `tag` | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## タグモデルの取得

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/tag/models`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `tag` | query | string | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## タグチャネルの編集

👨‍💼 管理者権限が必要（Admin）

`PUT` `/api/channel/tag`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `tag` | string | いいえ | — |
| `new_tag` | string | いいえ | — |
| `priority` | integer | いいえ | — |
| `weight` | integer | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## すべてのチャネルのテスト

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/test`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 特定のチャネルのテスト

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/test/{id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## すべてのチャネル残高の更新

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/update_balance`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 指定チャネル残高の更新

👨‍💼 管理者権限が必要（Admin）

`GET` `/api/channel/update_balance/{id}`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `id` | path | integer | はい | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |
