# 機能説明

1. 🎨 全く新しいUIインターフェース（一部のインターフェースはまだ更新されていません）
2. 🌍 多言語対応（改善予定）
3. 🎨 [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) APIのサポートを追加（使用前に、サードパーティプロジェクトおよび上流サービスの認可、コンテンツの安全性、利用規約の要件を確認してください）
4. 💰 法的に認可されたデプロイメントにおいて、内部残高、コスト配分、または企業顧客のアカウント管理をサポートし、システム設定で設定可能：
   - [x] Epay
5. 🔍 法的に認可されたチャンネルの使用状況や残高情報の照会をサポート
6. 📑 ページネーションは1ページあたりの表示項目数の選択をサポート
7. 🔄 SQLiteデータベースストレージをサポート、すぐに使えて軽量で便利
8. 💵 内部コスト管理または企業顧客の課金をサポートし、システム設定 - 運用設定で設定可能
9. ⚖️ チャンネルの**重み付きランダム**をサポート
10. 📈 データダッシュボード（コンソール）
11. 🔒 トークンが呼び出せるモデルを設定可能
12. 🤖 Telegramの認可ログインをサポート
13. 🎵 [Suno API](https://github.com/Suno-API/Suno-API) APIのサポートを追加（使用前に、サードパーティプロジェクトおよび上流サービスの認可、コンテンツの安全性、利用規約の要件を確認してください）
14. 🔄 Rerankモデルをサポート、現在CohereとJinaと互換性があり、Difyと統合可能
15. ⚡ **[OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime/integration)** - OpenAIのRealtime APIをサポートし、Azureチャンネルをサポート
16. ルート /chat2link を使用してチャットインターフェースに入ることをサポート
17. 🧠 モデル名のサフィックスによる推論強度（reasoning effort）の設定をサポート：
    1. OpenAI o-seriesモデル
       - サフィックス `-high` を追加して高い推論強度に設定（例：`o3-mini-high`）
       - サフィックス `-medium` を追加して中程度の推論強度に設定（例：`o3-mini-medium`）
       - サフィックス `-low` を追加して低い推論強度に設定（例：`o3-mini-low`）
    2. Claude思考モデル
       - サフィックス `-thinking` を追加して思考モードを有効化（例：`claude-3-7-sonnet-20250219-thinking`）
18. 🔄 Thinking to Content： `Channel - Edit - Channel Extra Settings` で `thinking_to_content` オプションの設定をサポート。デフォルトは `false`。有効にすると、思考コンテンツ `reasoning_content` を `<think>` タグに変換し、返されるコンテンツに追加します。
19. 🔄 モデルのレート制限： `System Settings - Rate Limit Settings` でモデルのレート制限（総リクエスト制限と成功リクエスト制限を含む）の設定をサポート。
20. 💰 キャッシュ課金のサポート：有効にすると、キャッシュヒット時に設定された比率に応じて課金が可能：
    1. `System Settings - Operations Settings` で `Prompt Cache Ratio` オプションを設定。
    2. チャンネルで `Prompt Cache Ratio` を設定。範囲は0〜1。例えば0.5に設定すると、キャッシュヒット時に50％で課金。
    3. サポートされているチャンネル：
    - [x] OpenAI
    - [x] Azure
    - [x] DeepSeek
    - [x] Claude
