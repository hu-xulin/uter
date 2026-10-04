# DeepChat - 商用フレンドリーなフル機能 AI エージェントクライアント

> **チャット設定オプション**
>
> Uter コンソールで、システム設定 → チャット設定 に移動し、次のショートカットオプションを追加します。
>   これにより、トークン管理ページから DeepChat をワンクリックで入力できるようになります：

    ```json
    { "DeepChat": "deepchat://provider/install?v=1&data={deepchatConfig}" }
    ```

> DeepChat はオープンソースのクロスプラットフォームで、商用フレンドリーなフル機能の
>   AI エージェントクライアントです。クラウドモデルとローカルモデル、MCP ツール呼び出し、Skills、
>   ACP、エージェント統合、およびリモート制御ワークフローをサポートし、統合されたプロバイダ管理と
>   高度な AI エージェントを必要とするユーザーに適しています。

- 公式サイト: [https://deepchat.thinkinai.xyz](https://deepchat.thinkinai.xyz)
- GitHub リポジトリ: [https://github.com/ThinkInAIXYZ/deepchat](https://github.com/ThinkInAIXYZ/deepchat)
- ダウンロードアドレス: [https://deepchat.thinkinai.xyz/#/download](https://deepchat.thinkinai.xyz/#/download)

## Uter との連携方法

### 方法 1: ワンクリックインポート

1. Uter コンソールのサイドバーで **トークン管理** を開き、使用したいトークンを見つける

2. トークン操作から **DeepChat** を選択

3. ブラウザで DeepChat を起動し、アプリを開くことを確認
   ![Open DeepChat](/apps-assets/deepchat/3-open-deepchat.webp)

4. DeepChat のプロバイダインポートプレビューで設定を確認
   ![Confirm DeepChat Configuration](/apps-assets/deepchat/4-deepchat-ok.webp)

5. モデル一覧を開き、Uter モデルを選択して利用開始
   ![Open Model List](/apps-assets/deepchat/5-open-models.webp)

### 方法 2: 手動インポート

1. Uter コンソールから API キーとサイトアドレスをコピー
   ![Uter Manual Configuration Guide](/apps-assets/deepchat/7-uter-manual-guidance.webp)

2. DeepChat の設定で Uter プロバイダを追加または編集し、API アドレスと API キーを入力
   ![DeepChat Manual Configuration Guide](/apps-assets/deepchat/6-deepchat-manual-guidance.webp)

3. モデル一覧を開き、Uter モデルを選択して利用開始
   ![Open Model List](/apps-assets/deepchat/5-open-models.webp)

## 関連リンク

- [DeepChat GitHub リポジトリ](https://github.com/ThinkInAIXYZ/deepchat)
- [DeepChat ダウンロードページ](https://deepchat.thinkinai.xyz/#/download)
