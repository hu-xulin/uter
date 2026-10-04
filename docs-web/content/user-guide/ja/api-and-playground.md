# API とプレイグラウンドの使用方法

## プレイグラウンド

* プレイグラウンドは、AI モデルの簡単なオンライン検証と体験のためのものです。質問や指示を入力してモデルと対話し、生成された結果を確認できます。
  


1. グループとモデルを選択：入力欄の右下で、利用可能なモデルグループと具体的なモデル選択し、この会話で使用するモデルを確認します。
2. リクエストパラメータを設定：パラメータ設定ボタンをクリックし、Temperature、Top P、Frequency Penalty、Presence Penalty、Max Tokens などの生成パラメータを必要な範囲で有効化・調整します。
3. 会話内容を入力：下部の入力欄に質問・指示・プロンプトを入力します。検索、ファイルのアップロード、写真のアップロード、スクリーンショット、撮影機能はまだ実装されていません。
4. リクエストを送信：モデル・パラメータ・入力内容を確認したら、「送信」ボタンをクリックしてリクエストを送信します。
5. 応答結果を確認：モデルの生成が完了したら、会話領域で返された内容を確認し、次の質問を入力して複数ターンの会話を続けられます。

<img alt="プレイグラウンドページ" src="01-playground.webp" />

## API アドレスと認証

ゲートウェイの OpenAI 互換アドレスは通常以下のとおりです：

```text
https://your-host/v1
```

API キーを Bearer トークンとして使用します：

```http
Authorization: Bearer YOUR_API_KEY
```

チャット補完の例：

```bash
curl https://your-host/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}'
```

## SDK のサンプル

### Python（OpenAI SDK）

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="https://your-host/v1",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

### Claude ネイティブ形式

```bash
curl https://your-platform.com/v1/messages \
  -H "x-api-key: sk-xxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Gemini ネイティブ形式

```bash
curl "https://your-platform.com/v1beta/models/gemini-1.5-pro:generateContent?key=sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

## サポートされている API エンドポイント

| インターフェース | パス | 説明 |
| --- | --- | --- |
| Chat Completions | `POST /v1/chat/completions` | OpenAI Chat Completions 互換インターフェース。`model` と `messages` が必要で、ストリーミング応答と通常の応答の両方に対応します。 |
| Playground Chat | `POST /pg/chat/completions` | Web プレイグラウンド専用のインターフェース。ログインセッションでグループとモデルを選び、統一されたトラフィック分散・プロトコル変換・課金・リトライの経路を再利用します。 |
| Text Completions | `POST /v1/completions` | 従来のテキスト補完インターフェース。`prompt` と `model` が必要です。 |
| Vector Embeddings | `POST /v1/embeddings` | テキストまたはテキストの配列をベクトルに変換します。`input` が必要で、チャネルアダプタがアップストリーム形式に変換します。 |
| Gemini Embeddings Compatible Interface | `POST /v1/engines/{model}/embeddings` | 旧来の Gemini 形式の埋め込みパスとの互換性を提供し、URL 内のモデル名に基づいて埋め込みリクエストを処理します。 |
| Image Generation | `POST /v1/images/generations` | プロンプトから画像を生成します。モデル・サイズ・品質・枚数はリクエストパラメータと設定済みチャネルに依存します。 |
| Image Editing | `POST /v1/images/edits` | 入力画像とプロンプトに基づいて画像を編集します。JSON と `multipart/form-data` の両方に対応します。 |
| Legacy Edit Interface | `POST /v1/edits` | 互換性のために残されたパスで、コードは画像 Relay 処理に入ります。新規クライアントは `/v1/images/edits` の利用を推奨します。 |
| Speech to Text | `POST /v1/audio/transcriptions` | 音声をテキストに変換し、OpenAI 音声インターフェース形式に従って対応する音声認識チャネルへ転送します。 |
| Audio Translation | `POST /v1/audio/translations` | 音声内容を認識し、翻訳されたテキストを出力します。 |
| Text to Speech | `POST /v1/audio/speech` | 入力されたテキストを音声に変換します。 |
| Rerank | `POST /v1/rerank` | `query` に基づいて候補 `documents` を関連度順に並べ替えます。空でないクエリ内容とドキュメントリストが必要です。 |
| Content Moderation | `POST /v1/moderations` | テキストなどの入力に対してコンテンツモデレーションを実行します。モデルが指定されていない場合は、デフォルトのモデレーションモデル候補が使用されます。 |
| Responses API | `POST /v1/responses` | OpenAI Responses 形式のインターフェースで、入力・ツール・応答イベントなどの機能に対応します。 |
| Responses Compression | `POST /v1/responses/compact` | Responses リクエストのコンテキストを圧縮処理します。 |
| Codex Web Search | `POST /v1/alpha/search` | Codex 独立のウェブ検索形式インターフェース。現在はこの機能をサポートする Sub2API、Uter、Codex、および高度なカスタムチャネルでのみ処理されます。 |
| Claude Messages | `POST /v1/messages` | Anthropic Claude Messages 互換インターフェース。`model` とメッセージ内容が必要で、必要に応じて Uter がアップストリームプロトコルに変換します。 |
| Realtime Conversation | `GET /v1/realtime`（WebSocket） | OpenAI Realtime 形式の双方向リアルタイム通信インターフェース。モデルは通常クエリパラメータで渡し、API キーは Bearer トークンまたは WebSocket サブプロトコルで渡せます。 |
| Gemini Native Model Invocation | `POST /v1beta/models/{model}:{action}` | Gemini ネイティブ形式のインターフェース。`generateContent`、`streamGenerateContent`、埋め込み関連操作など、モデル操作パスに対応します。 |
| Gemini Compatible Model Invocation | `POST /v1/models/{model}:{action}` | `/v1` プレフィックス付きの Gemini 形式のモデル操作リクエストを受け付け、Gemini Relay が解析・変換します。 |
| Model List | `GET /v1/models` | デフォルトで OpenAI 形式のモデル一覧を返します。Anthropic リクエストヘッダー使用時は Claude 形式、`x-goog-api-key` または `key` クエリパラメーター使用時は Gemini 形式を返します。 |
| Model Details | `GET /v1/models/{model}` | 単一モデルの情報を取得します。モデルが存在しない場合は `model_not_found` エラーオブジェクトを返します。 |
| Gemini Model List | `GET /v1beta/models` | Gemini 形式で利用可能なモデル一覧を返します。レスポンスフィールドには `models` と `nextPageToken` が含まれます。 |
| OpenAI Format Model List | `GET /v1beta/openai/models` | Gemini 互換名前空間の下で、OpenAI 形式のモデル一覧を返します。 |
