# CC Switch - オールインワン AI CLI 管理ツール

> **チャット設定オプション**
>
> Uter コンソールの システム設定 → チャット設定 で、トークン管理ページから CC Switch をワンクリック入力できるよう、次のショートカットを追加できます：

    ```json
    { "CC Switch": "ccswitch" }
    ```

> 🔀 CC Switch はオープンソースのクロスプラットフォーム対応オールインワン AI CLI 管理ツールです。Claude Code、Codex、Gemini CLI のワンクリック プロバイダ切り替え、統合された MCP サーバー管理、システムプロンプト管理、Skills 拡張管理をサポートしており、設定ファイルを手動で編集することなく複数の AI コーディング アシスタントを自由に切り替えられます。

- GitHub リポジトリ: [https://github.com/farion1231/cc-switch](https://github.com/farion1231/cc-switch)
- ダウンロード: [GitHub Releases](https://github.com/farion1231/cc-switch/releases)

## 主要機能

### 🔌 プロバイダ管理
- **ワンクリック切り替え** — Claude Code、Codex、Gemini の API 設定を瞬時に切り替え、環境変数や設定ファイルを手動編集する必要なし
- **マルチエンドポイント対応** — プロバイダごとに複数エンドポイントを設定でき、API キー管理とレイテンシ速度テストに対応
- **4 段階のモデル設定** — Haiku / Sonnet / Opus / カスタム の各層で細かいモデル選択

### 🛠️ MCP サーバー管理
- **統合クロスアプリ管理** — Claude / Codex / Gemini の MCP サーバーを単一のパネルから管理
- **3 つの転送タイプ** — stdio、HTTP、SSE（Server-Sent Events）をサポート
- **自動同期** — 双方向同期を伴う統合インポート/エクスポート

### 💬 プロンプト管理
- **マルチプリセットのシステムプロンプト** — 無制限のプリセットとクイック切り替え
- **クロスアプリ対応** — Claude（`CLAUDE.md`）、Codex（`AGENTS.md`）、Gemini（`GEMINI.md`）
- **Markdown エディタ** — ライブプレビュー付きの CodeMirror 6

### 🌐 マルチプラットフォーム対応
- **デスクトップアプリ** — Windows、macOS、Linux 向けのネイティブインストーラー
- **Web 版** — ヘッドレスサーバー / SSH 環境向けのブラウザアクセス可能なインターフェース
- **CLI 版** — 対話型メニューとコマンドライン両方のモード

## Uter との連携

CC Switch は `ccswitch://` ディープリンク プロトコルをサポートしており、Uter トークン管理ページからプロバイダ設定をワンクリックでインポートできます。

### 設定手順

1. **Uter トークン管理ページで、該当トークンのドロップダウンメニューをクリック**
   メニューから **CC Switch** オプションを選択します。システムが自動的に CC Switch を起動し、設定ダイアログを開きます。

2. **ダイアログで設定を完了**
   ![CC Switch Configuration Dialog](/apps-assets/cc_switch/fill_dialog.webp)

   項目の説明：
   - **Application**: 上部でアプリの種類を切り替え — **Claude** / **Codex** / **Gemini** から、必要に応じて対象アプリケーションを選択
   - **Name**: この設定の名前を入力（例：`My Claude`）して、CC Switch での識別と切り替えを容易に
   - **Main Model**（必須） — デフォルトで使用する主要モデル
   - **Haiku Model** — 軽量で高速なモデル
   - **Sonnet Model** — バランスの取れたモデル
   - **Opus Model** — 最も高性能なモデル

   すべてのモデルはドロップダウンで選択します。未選択の欄は「Please select model」と表示されます。

3. **完了**
   **「Open CC Switch」** をクリックすると設定を CC Switch にインポートして利用開始、**「Cancel」** をクリックすると破棄します。

## インストール

### macOS（Homebrew 推奨）

```shell
brew tap farion1231/ccswitch
brew install --cask cc-switch
```

### Windows

[Releases](https://github.com/farion1231/cc-switch/releases) から `.msi` インストーラーまたはポータブル `.zip` をダウンロード。

### Linux

[Releases](https://github.com/farion1231/cc-switch/releases) から `.deb` パッケージまたは `.AppImage` をダウンロード。

ArchLinux ユーザー：

```shell
paru -S cc-switch-bin
```

### Web 版（ヘッドレス / SSH サーバー）

```shell
wget https://github.com/farion1231/cc-switch/releases/latest/download/cc-switch-web-linux-x64.tar.gz
tar -xzf cc-switch-web-linux-x64.tar.gz
cd cc-switch-web/
./cc-switch-web
```

デフォルトポートは `17666`、ブラウザで `http://localhost:17666` からアクセス。

## 関連リンク

- [GitHub リポジトリ](https://github.com/farion1231/cc-switch)
- [Changelog](https://github.com/farion1231/cc-switch/blob/main/CHANGELOG.md)
- [Web 版リポジトリ](https://github.com/cp-yu/cc-switch-web)
- [CLI 版リポジトリ](https://github.com/thomas-jack/cc-switch-cli)
