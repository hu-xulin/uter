# Document Reranking

## Document Reranking

クエリに基づいてドキュメントリストの関連性を再ランキングします。

`POST` `/v1/rerank`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `query` | string | 必須 | クエリテキスト |
| `documents` | array&lt;string&gt; | 必須 | 再ランキングするドキュメントリスト |
| `top_n` | integer | 任意 | 上位 N 件の結果を返す |
| `return_documents` | boolean | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 再ランキングに成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | — |
| `results` | array&lt;object&gt; | — |
| `meta` | object | — |
