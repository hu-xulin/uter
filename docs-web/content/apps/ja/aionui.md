# AionUi - 無料オープンソースのデスクトップオフィスエージェント

> 🚀 AionUi は、Gemini CLI、Claude Code、Codex、OpenCode、Qwen Code、Goose CLI、Auggie などのさまざまな AI エージェントをサポートする、無料のローカル型オープンソース Cowork です。完全な GUI インターフェースと WebUI リモートアクセス機能を提供し、Cowork のオープンソース代替として機能します。

- 公式サイト: [https://www.aionui.com](https://www.aionui.com)
- GitHub リポジトリ: [https://github.com/iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi)
- ダウンロードリンク: [https://github.com/iOfficeAI/AionUi/releases](https://github.com/iOfficeAI/AionUi/releases)

![AionUi Logo](/apps-assets/aionui/aionui-logo.webp)

## 主要機能

### 💬 マルチセッションチャット
- **マルチセッション + 独立したコンテキスト** - 複数のチャットセッションを同時に開くことができ、それぞれが独自の独立したコンテキストメモリを持ちます。
- **ローカル保存** - すべての会話データはローカルの SQLite データベースに保存され、失われることはありません。

### 🤖 マルチモデル対応
- **マルチプラットフォーム対応** - Gemini、OpenAI、Claude、Qwen などの主流モデルをサポートし、柔軟に切り替えられます。
- **ローカルモデル対応** - Ollama、LM Studio などを通じたローカルモデルの導入をサポート。

### 🤝 マルチエージェントモード
- **複数の AI エージェントの同時実行** - 複数の AI エージェントを同時に実行できます（例：Gemini CLI、Claude Code、Codex、OpenCode、Qwen Code、Goose CLI、Auggie など）。
- **統合 MCP 管理** - Model Context Protocol (MCP) を通じたすべてのエージェントの統合管理と設定により、操作を簡素化します。
- **スキル設定** - 異なるエージェント向けに専用の Skills を設定し、能力を拡張できます。
- **アシスタントのカスタマイズ** - カスタムアシスタント設定をサポートし、パーソナライズされた AI ワークフローを作成できます。
- **独立した設定** - 各エージェントは独立して設定・使用でき、干渉しません。
- **柔軟な切り替え** - さまざまなシナリオの要件を満たすために、異なるエージェント間をシームレスに切り替えられます。

### 🗂️ ファイル管理
- **ファイルツリーの閲覧 + ドラッグ＆ドロップアップロード** - フォルダのようにファイルを閲覧でき、ファイルやフォルダのドラッグ＆ドロップによるワンクリックインポートをサポートします。
- **スマート整理** - AI がフォルダの整理を手伝い、自動で分類します。

### 📄 プレビューパネル
- **9 種類以上の形式をプレビュー** - PDF、Word、Excel、PPT、コード、Markdown、画像などの形式をサポート。
- **リアルタイム追跡 + 編集可能** - ファイルの変更を自動的に追跡し、Markdown、コード、HTML のリアルタイム編集とデバッグをサポート。

### 🎨 AI 画像生成と編集
- **スマート画像生成** - Gemini 2.5 Flash Image Preview、Nano、Banana などのさまざまな画像生成モデルをサポート。
- **画像認識と編集** - AI を活用した画像解析および編集機能。

### 🌐 マルチチャネルアクセス
- **WebUI リモートアクセス** - ネットワーク上の任意のデバイスからブラウザでアクセス可能、モバイルデバイスにも対応。
- **Telegram 連携** - Telegram ボットを通じたやり取りをサポート。
- **Feishu 連携** - Feishu を通じたアクセスとやり取りをサポート。
- **ローカルデータの安全性** - すべてのデータはローカルの SQLite データベースに保存され、サーバーへの導入にも適しています。

## Uter との連携方法

### パラメータの入力

Provider Type: Uter がサポートする種類
API Key: Uter から取得
API Address: Uter サイトのアドレス（例：`https://<your-uter-domain>/v1`）

ご自身で導入した Uter を使用するか、サービス提供者が正当な上流認可とコンプライアンス義務を負う Uter サービスを提供していることを確認してください。出所不明の API アドレスやキーを本番環境に接続しないでください。

### 設定手順

1.  **Uter で API キーをコピー**
    ![Copy API Key](/apps-assets/aionui/copy_apikey.webp)

2.  **AionUi の設定を開く**
    - AionUi の設定ページに移動
    - 「モデル設定」タブを見つける
    - 「モデルを追加」をクリック
    ![Open Settings](/apps-assets/aionui/add-model-1.webp)

3.  **新しいプロバイダを追加**
    - 「モデルを追加」をクリック
    - Uter を選択
    ![Add Uter Provider](/apps-assets/aionui/newapi_provider.webp)

4.  **API 情報を設定**
    - API Address: Uter サイトのアドレスを入力（形式：`https://<your-uter-domain>/v1`）
    - API Key: Uter コンソールからコピーした API キーを貼り付け

5.  **モデルを追加**
    - ドロップダウンから追加するモデルを選択
    - モデル名は Uter で設定したモデル名と一致させる
    - 適切なリクエストプロトコルを選択

6.  **利用開始**
    - チャットページに戻る
    - 設定した Uter モデルを選択して会話を開始

## 関連リンク

- [GitHub リポジトリ](https://github.com/iOfficeAI/AionUi)
- [詳細な使い方ガイド](https://github.com/iOfficeAI/AionUi#-detailed-usage-guide)
- [FAQ よくある質問](https://github.com/iOfficeAI/AionUi#-support--help)
