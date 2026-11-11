# モデルテスト

Uter で大言語モデルを接入する前に、この章の手順に従って「接続できるか、使えるか、安定したか、課金計算が正しいか」を一つずつ確認し、本番リリース後のトラブルを未然に防ぎます。

## 事前準備

テストを始める前に、以下がすべて揃っていることを確認してください。1つでも欠けていると最初の手順が失敗します。

| 項目 | 説明 | 入手先 |
| --- | --- | --- |
| **API ベース URL** | `https://uter.ai/v1` の形式。コントロールパネルに表示されているアドレスが正（専用ドメインの場合もあります） | コンソール → プロフィール / 接続ドキュメント |
| **API キー（トークン）** | `sk-xxxxxxxx` の形式。これは認証資格情報でありパスワードと同義です。漏らさない・フロントエンドコードに書かない・コードリポジトリにコミットしないこと | コンソール → トークン管理 → トークン作成 |
| **アカウント残額（クォータ）** | 課金単位：50万トークン ≈ 1米ドル。呼び出しごとに減算され、不足すると拒否されます | コンソール → 使用量 / 残高；または `GET /v1/dashboard/billing/usage` |
| **モデル名** | テストしたいモデルのプラットフォーム上の登録名（公式名称と同じとは限りません） | モデル一覧 API `GET /v1/models` が返す `id` |

<Callout type="warn">
  キーはパスワードと同義です。サーバー側またはシークレット管理でのみ使用し、ブラウザへ送信したり、ログへ平文で残したり、Git へコミットしたりしないでください。
</Callout>

キーはコンソール上で「有効 / 無効 / 期限切れ / 枯渇」の4つの状態をもちます。残額を使い切るとキーは「枯渇」となり、すべての呼び出しが残量不足を返します。テスト前にトークン管理ページで状態を確認してください。

## テスト観点

本番でモデルを使う前に、次の9つの観点を順番に検証してください。前半の4項目は「そもそも使えるか」、後半の5項目は「安定して使えるか、課金が正しいか」です。

1. **接続性と認証** —— アドレスが正しいか、キーが有効か、IP 制限に引っかかっていないか。
2. **モデル一覧と可用性** —— 対象のモデルが実際に存在し、利用可能か。
3. **基本的な対話能力** —— 最小リクエストが正常に返るか。
4. **パラメータと高度な機能** —— ストリーミング、temperature、max_tokens、tools/function calling、視覚（マルチモーダル）、JSON モード、システムプロンプト。
5. **ストリーミング出力（SSE）** —— 1文字ずつ返るか、解析できるか。
6. **性能とレイテンシ** —— 応答開始までの時間（TTFT）、応答全体所要時間、長文コンテキストでの挙動。
7. **安定性とレート制限** —— 並行、リトライ、429 発生時の挙動。
8. **残額と課金の照合** —— 減算額が正しいか、残高が減っているか。
9. **エラーと境界値** —— 不正なパラメータ、过长な入力、モデル利用不可時のエラーが明確で、コード側で扱えるか。

## 手順

以下の例は共通で次の前提を仮定します。

- ベース URL `BASE=https://uter.ai/v1`（実際のアドレスに置き換えてください）
- キー `TOKEN=sk-your-token-here`（コンソールで取得した完全なキーに置き換えてください）

すべての例は `curl` を使います。置き換え後そのままターミナルに貼り付けて実行できます。ローカルでプロキシ経由の環境の場合は `--noproxy '*'` を付けてプロキシを回避してください。

### Step 1 · 最小接続と認証テスト

```bash
BASE=https://uter.ai/v1
TOKEN=sk-your-token-here

curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" | head -c 800
echo
```

判定基準：

- `object: "list"` と複数の `id` を含む JSON が返る → 接続と認証は OK。
- HTTP 401 とともに `{"error":{"message":"That token isn't valid.","type":"...","code":"..."}}` が返る → キーが誤っているか無効（トラブルシュート表を参照）。
- まったく接続できない・タイムアウトする → アドレスが誤っているかネットワークが到達不能（トラブルシュート表を参照）。

<Callout type="info">
  一部のベンダーのネイティブ API は独自の認証方式を使います。該当する公式 SDK を使う場合のみ必要です。Claude は `POST /v1/messages` に `x-api-key: $TOKEN` と `anthropic-version: 2023-06-01` を付与します。Gemini は `GET /v1beta/models` に `x-goog-api-key: $TOKEN` を付与するか、URL に `?key=$TOKEN` を付けます。
</Callout>

### Step 2 · 利用可能モデルを一覧し、対象モデルの存在を確認

```bash
curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep '"id"' | head -40
```

テストしたいモデルの `id` を確認してください（例：`gpt-4o`、`claude-3-5-sonnet-20241022`、プラットフォーム固有の名前）。

<Callout type="warn">
  一覧に目的のモデルがない場合、そのモデルはあなたのアカウントでは有効化されていません。プラットフォームに連絡してください。自分で名前を推測して呼ぶと 404 または「利用可能なチャネルなし」になります。
</Callout>

### Step 3 · 最小限の対話（ストリーミングなし）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "自分のモデルidに置き換える",
    "messages": [{"role": "user", "content": "自分自身を一文で紹介してください。"}],
    "max_tokens": 200
  }' | python3 -m json.tool
```

判定基準：`choices[0].message.content` に正常なテキストがあり、`usage` に `prompt_tokens` / `completion_tokens` が含まれる → 基本の対話は OK。

### Step 4 · ストリーミング出力（SSE）テスト

```bash
curl --noproxy '*' -N -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "自分のモデルidに置き換える",
    "messages": [{"role": "user", "content": "10まで数えてください。"}],
    "stream": true
  }'
```

判定基準：ターミナルに `data: {...}` の断片が1行ずつスクロールし、最後に `data: [DONE]` で終わる。正しく1文字ずつ返っていればストリーミングは OK。

<Callout type="info">
  `curl` で逐次表示を見るには `-N`（バッファリング無効）が必要です。SDK 側では `stream: true` が有効になっており、レスポンス全体をバッファしていないことを確認してください。
</Callout>

### Step 5 · 高度な機能：ツール呼び出し（Function Calling）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "自分のモデルidに置き換える",
    "messages": [{"role": "user", "content": "北京の天気はどうですか？"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "都市の天気を取得する",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }]
  }' | python3 -m json.tool
```

判定基準：レスポンスに `choices[0].message.tool_calls` が現れる（モデルが `get_weather` の呼び出しを選んだ）状態であること。自分で答えを捏造していない → ツール呼び出しは OK。

<Callout type="warn">
  プロダクトが function calling・JSON モード・視覚入力に依存する場合は、それぞれ必ず個別にテストしてください。「チャットできるならすべて動く」と仮定しないことが重要です。
</Callout>

### Step 6 · マルチモーダル（視覚）テスト（モデルが画像対応の場合のみ）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "視覚対応モデルのidに置き換える",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "この画像には何がありますか？"},
        {"type": "image_url", "image_url": {"url": "https://example.com/demo.png"}}
      ]
    }]
  }' | python3 -m json.tool
```

判定基準：画像内容の正しい説明が返る → 視覚機能は OK。画像は公開からアクセス可能な URL である必要があります。プラットフォームはローカルファイルを読み取りません。

### Step 7 · レイテンシと性能の基準値（3〜5 回実行して平均）

```bash
for i in 1 2 3; do
  curl --noproxy '*' -s -o /dev/null -w "run $i first_byte=%{time_starttransfer}s total=%{time_total}s HTTP=%{http_code}\n" \
    "$BASE/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"自分のモデルidに置き換える","messages":[{"role":"user","content":"こんにちは"}],"max_tokens":128}'
done
```

応答開始までの時間（TTFT）と全体所要時間を注視し、業務の SLA と比較してください。長文コンテキストの場合は、長いプロンプト（例：8k / 32k トークン）でも1回テストし、レイテンシが線形に増加するか確認します。

### Step 8 · 残額と課金の照合

呼び出し前に残高を記録し、呼び出し後に再度記録して、差分が概ね実消費量と一致することを確認します。

```bash
# 呼び出し前
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# （この間に Step 3 の対話を実行）

# 呼び出し後
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

単一レスポンスの `usage` フィールド（`prompt_tokens` + `completion_tokens`）を課金ルールと照合する方法でも確認できます。

### Step 9 · 境界値とエラーの可読性

意図的にエラーを発生させ、メッセージが明確でコードで捕捉可能かを確認します。

```bash
# 大きすぎる max_tokens / 不正なパラメータ
curl --noproxy '*' -s -w "\nHTTP=%{http_code}\n" "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"自分のモデルidに置き換える","messages":[{"role":"user","content":"hi"}],"max_tokens":999999}'
```

判定基準：空レスポンスや 500 のスタックトレースではなく、構造化された `{"error":{"message":...,"type":...,"code":...}}` と明確な 4xx の HTTP ステータスコードが返る → エラーを正常に処理できる。

## トラブルシュート表

| # | 症状 | 想定される原因 | 解決方法 |
| --- | --- | --- | --- |
| **A1** | `401` + `That token isn't valid.` | キーのコピーが不完全・タイプミス・無効化されている | コンソールから完全なキーをコピーし直す。状態が「有効」であること、途中で切れていないこと、余分な空白が含まれていないことを確認する |
| **A2** | `401` + `This token has expired. Please create a new one.` | キーに有効期限が設定されており、その期限を過ぎている | コンソールで新しいキーを生成する。長期で使うキーは有効期限を「無期限」にする |
| **A3** | `403` + `Your IP is not in the token's allowed list` | キーに IP ホワイトリストが設定され、現在の送信元 IP が含まれていない | コンソールで送信元公開 IP をキーのホワイトリストに追加する、または一時的に IP 制限を無効化する（テスト環境のみ） |
| **A4** | まったく接続できない / `Could not resolve host` / 長時間のタイムアウト | Base URL の誤り、自己証明書、イントラネットからのアクセス | Base URL を確認（`https://あなたのドメイン/v1` の形式）。ローカルでの動作確認がプロキシ経由なら `--noproxy '*'` を追加。ネットワーク到達性を確認 |
| **B1** | `Your quota is insufficient.` HTTP 403 | アカウントまたはキーの残量が枯渇している | コンソールでチャージ / 残量を引き上げる。`GET /v1/dashboard/billing/usage` で残り残量を確認 |
| **B2** | `No available channel for model "xxx" in group "default".` | そのモデルがあなたのアカウントで有効なチャネルに設定されていない | プラットフォームにモデルの利用可否を問い合わせる、または `/v1/models` の一覧で確認できるモデル名を選ぶ。モデル名を推測しない |
| **B3** | `404` / `model not found` | モデル名の誤り、またはそのモデルが有効化されていない | Step 2 でモデルを一覧し、返された `id` を厳密にコピーする |
| **C1** | `429` + リクエストがレート制限された | キー単位またはプラットフォーム単位のレート制限に抵触 | 並列数を下げる / バックオフ付きリトライを追加（指数バックオフ）。キーの RPM/TPM 制限を確認。バッチ処理は時間をずらす |
| **C2** | たまに `5xx` / 上流タイムアウトだがリトライで成功する | 上流モデルの揺らぎ | 失敗時のリトライとバックオフを実装。プラットフォームも自動リトライしますが、クライアント側でも保険をかけましょう |
| **D1** | ストリーミングが逐次ではなく一括で返る | クライアント側のバッファリング（curl に `-N` が無い、SDK で stream が無効など） | curl に `-N` を付ける。SDK で `stream: true` が有効かつ、レスポンス全体のバッファリングがないことを確認 |
| **D2** | 日本語や特殊文字が文字化けする | エンコード未指定、または解析エラー | リクエスト・レスポンスとも UTF-8 を使用。`python3 -m json.tool` が正常に表示されればサーバー側は問題なし。端末のエンコード設定を確認 |
| **D3** | 応答が途中で切られる | `max_tokens` が小さすぎる、またはモデルの出力上限に到達 | `max_tokens` を増やす。長い文書はストリーミングで分割受信する |
| **E1** | 課金が想定と違う（過剰・不足） | 課金算定に思考チェーンやツール呼び出し等の非表示トークンが含まれる可能性、またはモデルごとに倍率が異なる可能性 | 単一レスポンスの `usage` フィールドを正として照合する。不明な点はプラットフォームに課金ルールを確認 |
| **E2** | function calling が発動しない / JSON モードが効かない | そのモデルが該当機能を公開していない | Step 5 で個別に検証する。未対応の機能に依存せず、業務側でフォールバックを用意する |
| **F1** | `400` + 中国語風「お知らせ」形式のメッセージ | 上流モデルの供給が一時的に変更された旨の通知がエラーに含まれているものであり、あなたのリクエストの誤りではない | 自分のリクエスト形式に誤りがないことを確認の上、プラットフォームに連絡し、エラー原文を提示する |

<Callout type="idea">
  覚えておきたい经验和2つの低点：「利用可能なチャネルなし / モデルが見つからない」と出た場合は、まず `GET /v1/models` で実際のモデル名を確認し、その後にプラットフォームへ連絡してください。**「モデルが使えない」の9割はこの2つの原因**であり、コードの問題ではありません。`401` / `403` の場合は、Base URL を確認する前にキーの状態と IP ホワイトリストを確認してください。**認証関連の問題はほぼ「コピーの不備・URL の誤り・制限が解除されていない」** ことが原因です。
</Callout>

### 400 エラーへの対応（Bad Request）

`400` は「リクエスト自体が間違っている」ことを意味します。サーバーはリクエストを受け取ったものの、内容やパラメータが不正だったため拒否しました。認証（401）、残量（403）、レート制限（429）とは別のカテゴリです。

まずエラーメッセージの表現から発生源を判断してください。

| 表示されるメッセージ | 主な発生源 | 対処 |
| --- | --- | --- |
| 中国語で、プラットフォームの案内っぽい | プラットフォームが転送前にリクエストを検証 | メッセージの指示どおりパラメータを修正 |
| 英語で、OpenAI / Claude / Gemini のエラー風 | 上流モデルベンダー（パラメータが対象モデルの要件を満たしていない） | メッセージの指示どおり修正（例：messages を追加、範囲外の値を調整） |
| 中国語で、通知・お知らせ風 | 上流モデルの供給が一時的に変更された | あなたの誤りではないため、エラー原文を添えてプラットフォームへ連絡 |

プラットフォーム側で頻出する 400 メッセージ：

| 表示されるメッセージ | 意味 | 対処 |
| --- | --- | --- |
| `Invalid request: <詳細>` | プラットフォームがリクエストボディの検証に失敗 | コロン以降の説明を読み、そのとおり修正 |
| `Invalid request: unable to determine which model you want to use.` | 使用するモデルが特定できない | リクエストに `"model": "<モデル名>"` が正しく入っているか確認 |
| `model field is required` | `model` フィールドが無い | `model` パラメータを追加 |
| 「有効な JSON ではない」と表示される | リクエストボディの JSON 構文が誤り | クォート、カンマ、エスケープを確認。特に日本語文字と改行に注意 |

<Callout type="info">
  「モデル設定」「価格が未設定」などのメッセージが表示された場合はプラットフォーム側の問題です。プラットフォームに連絡即可で、リクエストの修正は不要です。
</Callout>

上流モデルで頻出する 400 メッセージ：

- `messages is required` / `messages must be a non-empty array` —— `messages` が無い、または空
- `temperature must be between 0 and 2` / `max_tokens too large` —— パラメータが範囲外
- `Unknown parameter: 'xxx'` —— モデルが対応していないフィールドを送っている
- `1 validation error for ...` —— フィールドの型や必須条件が合致しない

30 秒で切り分ける（curl に `-i` を付けて完全なレスポンスを見る）：

```bash
curl -i https://uter.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"<モデル名>","messages":[{"role":"user","content":"hi"}]}'
```

レスポンスの `message` を重点的に見てください。大抵は直接の原因が書かれています。

## 本番リリース前チェックリスト

以下をコピーして、すべてチェックしてから本番トラフィックを切り替えてください。

- [ ] **ベース URL** を設定（環境変数 / 設定センター）に固定し、フロントエンドにハードコードしていない。
- [ ] **キー** をコンソールから完全にコピーし、状態が「有効」で、期限切れでなく、残量も十分である。
- [ ] キーに IP ホワイトリストを設定している場合は、本番サーバーの送信元 IP が登録されている。
- [ ] `GET /v1/models` で対象モデルが一覧に出ており、その `id` がコード内の記述と一致する。
- [ ] 非ストリーミングの対話が通り、`content` と `usage` を取得できる。
- [ ] ストリーミング（SSE）が通り、`data:` の断片と `[DONE]` を解析できる。
- [ ] プロダクトが依存する**高度な機能**（tools / JSON / 視覚 / 長文コンテキスト）を個別に検証済み。
- [ ] レイテンシの基準値（TTFT / 全体所要）を記録し、SLA を満たしている。
- [ ] クライアントに**レート制限時のバックオフリトライ**と**上流 5xx のフォールバックリトライ**が実装されている。
- [ ] エラーレスポンスを `error.message` / `error.code` / HTTP ステータスコードで構造的に処理し、元の資格情報をログに出力していない。
- [ ] 残量の減算を `usage` フィールドと照合し、想定と一致している。
- [ ] 本番環境でキーを出力・コミットしていない（シークレット管理または環境変数を活用している）。
- [ ] 対象モデルの**可用性と課金ルール**をプラットフォームと確認済み。

## 付録

### 対応インターフェース一覧（主に OpenAI 互換）

| 機能 | メソッドとパス | 説明 |
| --- | --- | --- |
| モデル一覧 | `GET /v1/models` | 認証後に利用可能なモデルを確認 |
| モデル参照 | `GET /v1/models/:model` | 単一モデルの情報を取得 |
| チャット | `POST /v1/chat/completions` | 主要な API。stream / tools / 視覚に対応 |
| テキスト補完 | `POST /v1/completions` | 旧来の補完（対応モデルのみ） |
| ベクトル | `POST /v1/embeddings` | テキストのベクトル化 |
| 画像生成 | `POST /v1/images/generations`、`/v1/images/edits` | テキストから画像生成 / 画像編集 |
| 音声 | `POST /v1/audio/transcriptions`、`/translations`、`/speech` | 文字起こし / 翻訳 / 音声合成 |
| ランキング | `POST /v1/rerank` | 検索再順位付け |
| モデレーション | `POST /v1/moderations` | コンテンツ安全性チェック |
| Claude ネイティブ | `POST /v1/messages` | `x-api-key` で認証 |
| リアルタイム音声 | `GET /v1/realtime`（WebSocket） | Realtime モード |
| Gemini ネイティブ | `/v1beta/models/*` | `x-goog-api-key` で認証 |
| 使用量 / サブスクリプション | `GET /v1/dashboard/billing/usage`、`/subscription` | セルフサービスでの残量確認 |

### エラーレスポンスの統一形式

プラットフォームの API エラーはすべて OpenAI と同じ構造で統一されており、クライアント側での処理が容易です。

```json
{
  "error": {
    "message": "人間向けのエラー理由",
    "type": "invalid_request_error | authentication_error | ...",
    "code": "任意のエラーコード",
    "param": "任意の問題があるパラメータ名"
  }
}
```

HTTP ステータスコード（401 認証 / 403 残量または権限 / 404 モデル / 429 レート制限 / 5xx 上流）と組み合わせれば，绝大多数のクライアント処理ロジックをカバーできます。

### セキュリティ上の注意（必須）

- **キーはパスワード**：サーバー側またはシークレット管理でのみ使用し、ブラウザへ送信しない、ログへ平文で残さない、Git へコミットしない。
- **ログのマスキング**：プラットフォームの監査ログにキーが平文で記録されることはありません。ただしクライアント自身がレスポンスを出力する場合は、`Authorization` ヘッダーをログに書かないようにしてください。
- **レート制限とリトライ**：必ずバックオフ付きリトライを実装し、雪崩的なリトライがレート制限を全面障害に拡大しないようにしてください。
