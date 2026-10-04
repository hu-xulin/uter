# Memoh - コンテナ化された AI エージェントプラットフォーム

> Memoh は、各ボットが独自の分離されたコンテナで、永続的なメモリと専用のファイルシステムを備えて
>   動作する、オープンソースのセルフホスト型 AI エージェントプラットフォームです。
>   Telegram、Discord、Lark (Feishu)、QQ、Matrix、WeCom、WeChat、Email、および
>   組み込みの Web UI を含む 9 つのチャネルをサポートし、MCP ツール呼び出し、
>   ブラウザ自動化、スケジュールされたタスクなど、豊富なエージェント機能も備えています。

- ウェブサイト: [https://memoh.sh](https://memoh.sh)
- ドキュメント: [https://docs.memoh.ai](https://docs.memoh.ai)
- GitHub: [https://github.com/memohai/Memoh](https://github.com/memohai/Memoh)

## 主要機能

- **コンテナ分離**: 各ボットは専用の filesystem とネットワークを持つ独自の containerd コンテナで動作し、スナップショットやデータのインポート/エクスポートをサポート
- **メモリエンジン**: LLM 駆動の事実抽出、ハイブリッド検索（dense + sparse + BM25）、24 時間コンテキストの読み込み、メモリの圧縮と再構築
- **マルチチャネル対応**: Telegram、Discord、Lark (Feishu)、QQ、Matrix、WeCom、WeChat、Email、Web UI
- **MCP 対応**: 完全な MCP プロトコル対応（HTTP / SSE / Stdio / OAuth）、ボットごとに独立した MCP 接続管理
- **ブラウザ自動化**: Playwright を動力源とする組み込みのヘッドレスブラウザを備え、ウェブ閲覧、フォーム入力、スクリーンショットなどをサポート
- **Web ダッシュボード**: Vue 3 + Tailwind CSS で構築されたモダンな管理インターフェースで、ストリーミングチャット、ツール呼び出しの可視化、ファイル管理などを備える

## クイックインストール

Memoh は Docker 経由で導入します。ワンクリックインストール（Docker が必要）：

```bash
curl -fsSL https://memoh.sh | sudo sh
```

または手動でインストール：

```bash
git clone --depth 1 https://github.com/memohai/Memoh.git
cd Memoh
cp conf/app.docker.toml config.toml
# conf/app.docker.toml 設定ファイルを編集
sudo docker compose up -d
```

起動後、`http://localhost:8082` にアクセス。デフォルト認証情報：`admin` / `admin123`。

## Uter との統合

Memoh は任意の OpenAI 互換モデルプロバイダをサポートし、Uter を使用してさまざまな AI モデルサービスを一元管理・アクセスできます。

### 設定手順

#### Uter API キーを取得

Uter に登録してログイン後、上部ナビゲーションバーの「コンソール」をクリックし、次に「トークン管理」をクリックし、「トークンを追加」ボタンをクリックして uter キーを作成します。適切な権限を選択し、「作成」をクリックします。

作成後、コピーボタンをクリックして生成された API キーをコピーします。

![copy-api-key](/apps-assets/memoh/copy_api_key.webp)

#### Memoh でモデルプロバイダを追加

Memoh Web ダッシュボードにログインし、プロバイダ管理ページに移動して Uter をクリックします。

![switch-to-uter-provider](/apps-assets/memoh/switch_to_uter_provider.webp)

設定ページで次の情報を入力：

- **API Base URL**: Uter のエンドポイント URL を入力（例：`https://api.example.com/v1`、ローカル導入の場合は `http://localhost:3000/v1`）
- **API Key**: Uter からコピーした API キーを貼り付け

保存をクリックしてプロバイダ設定を完了します。

#### モデルをインポート

プロバイダを設定後、モデル管理ページに移動し、自動インポートをクリックするか、必要なモデルを手動で追加します。

#### ボットにモデルを設定

ボット設定ページに移動し、モデル設定セクションを見つけて、デフォルトのチャットモデルを Uter プロバイダ経由で追加したものに切り替え、保存をクリックします。

![set_chat_model](/apps-assets/memoh/set_chat_model.webp)

これで、Memoh のモデルプロバイダとして Uter の設定が完了しました。Memoh の任意のチャネル（Telegram、Discord、Lark など）を通じて AI ボットとチャットでき、すべてのリクエストは Uter を経由します。
