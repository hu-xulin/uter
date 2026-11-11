# OpenAI Codex CLI

> **プロジェクト紹介**
>
> Codex CLI は OpenAI 製のコーディングエージェントで、お使いのコンピュータ上でローカルに動作します。
>
>   - 公式ホームページ: [https://chatgpt.com/codex](https://chatgpt.com/codex)
>   - プロジェクトホームページ: [https://github.com/openai/codex](https://github.com/openai/codex)

## デモ

![introduce-01.webp](/apps-assets/codex/introduce-01.webp)

### 機能

| カテゴリ | 機能 |
| --- | --- |
| ターミナルベースのコーディングアシスタント | Codex CLI はターミナルベースの対話型コーディングアシスタントで、コードの編集、パッチの生成、コマンドラインでのコマンド実行を行います。 |
| ツール駆動アーキテクチャ  | `apply_patch`、`shell`、`update_plan`、`multi_tool_use` などのツールを提供し、リポジトリファイルと操作の制御された変更を行います。 |
| アトミックパッチ編集      | 専用のパッチ形式を使用して `apply_patch` でファイルをアトミックに追加/更新/削除し、監査とロールバックを容易にします。 |
| サンドボックスと承認      | サンドボックスポリシー（例：`workspace-write`、`read-only`）と承認モード（`on-request`、`on-failure`、`never`）をサポートし、書き込みとネットワークアクセス権限を制御します。 |
| 計画の追跡             | `update_plan` は手順を一覧表示して状態を追跡し、常に 1 つの `in_progress` 手順のみを持つことで明確な進捗を維持します。 |
| 対話プロトコル      | 重要な操作の前に簡潔な導入説明を送り、親しみやすく簡潔なトーンを維持し、進捗を提供します。 |
| セキュリティ制約      | 厳格なルール（無関係なファイルへの恣意的な変更なし、著作権ヘッダの追加なし、破壊的なコマンドの実行なし）を順守し、機密性の高い操作にはユーザーの承認を必要とします。 |
| テストとフォーマット    | 変更後に該当するテストとフォーマットツールの実行を推奨しますが、現在のタスクと無関係な問題の修正には責任を負いません。 |
| 出力とスタイル          | 最終出力は CLI レンダリング仕様（見出しには `**`、パス/コマンドにはバッククォートなど）に準拠し、スキャンしやすく簡潔な構造を維持します。 |
| 並列実行        | `multi_tool_use.parallel` で複数のツールを並列実行し、効率を向上させます。 |

## AI モデルの設定方法

### Windows 図解ガイド

#### 1. ターミナルを開く

![windows_open_terminal](/apps-assets/codex/windows_open_terminal.webp)

#### 2. WSL をインストール

Windows で最適なパフォーマンスを得るため、Windows Subsystem for Linux (WSL2) をインストールして使用してください。

> **WSL2 のインストールと Windows の再起動**
>
> ```powershell
>   wsl --install
>   ```
>
>   インストール後に Windows コンピュータを再起動してください。

> **Windows の注意点**
>
> - CMD ではなく PowerShell の使用を推奨。
>   - 権限の問題が発生した場合は、管理者として実行を試す。
>   - 一部のウイルス対策ソフトが誤検知する場合があります；例外に追加する必要があります。

![windows-img-03.webp](/apps-assets/codex/windows-img-03.webp)

> **Node Version Manager (NVM) のダウンロード**
>
> ```bash
>   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
>   ```

![windows-img-04.webp](/apps-assets/codex/windows-img-04.webp)

> **NVM で Node.js 22 をインストール**
>
> タブバーで新しい PowerShell ウィンドウを開き、WSL を開きます：
>
>   ```bash
>   wsl
>   ```
>
>   Node.js をインストール（バージョン番号は時期により異なります；[OpenAI 公式サイト](https://developers.openai.com/codex/windows) の要件に応じたバージョンをインストールしてください）：
>
>   ```bash
>   nvm install 22
>   ```

![windows-img-05.webp](/apps-assets/codex/windows-img-05.webp)

#### 3. Codex CLI をインストール

> **Codex CLI のインストール**
>
> ```bash
>   npm i -g @openai/codex
>   ```
>
>   このコマンドは公式 npm リポジトリから最新版の Codex CLI をダウンロードしてインストールします。

![windows-img-06.webp](/apps-assets/codex/windows-img-06.webp)

#### 4. 設定ファイルを変更

> **Codex CLI 設定ファイルのワンクリック変更**
>
> ```powershell
>   iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.ps1')
>   ```

![windows-configure](/apps-assets/codex/windows_configure.webp)

#### 5. Codex CLI の利用開始

これで Codex CLI を使い始められます！

> **Codex CLI を起動**
>
> WSL2 を起動：
>
>   ```bash
>   wsl
>   ```
>
>   Codex CLI を直接起動：
>
>   ```bash
>   codex
>   ```
>
>   特定のプロジェクトで使用：
>
>   ```bash
>   cd mnt/c/path/to/your/project
>   codex
>   ```
>
>   Enter を押して Codex CLI を起動。

![windows-img-09.webp](/apps-assets/codex/windows-img-09.webp)

![windows-img-10.webp](/apps-assets/codex/windows-img-10.webp)

> Codex CLI の権限を設定：1. Codex によるファイルの直接変更を許可；2. Codex がファイルを変更するには手動承認が必要。

> **モデルを選択**
>
> ```bash
>   /model
>   ```

![windows-img-11.webp](/apps-assets/codex/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/codex/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/codex/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/codex/windows-img-14.webp)

> 注：API アドレスを変更すると、すべてのモデル（公式プリセットモデルを含む）は、ご自身で設定した正当に認可された個人または組織のアクセスポイントを呼び出すようになります。ご自身で導入した Uter を使用するか、サービス提供者が正当な上流認可とコンプライアンス義務を負う Uter サービスを提供していることを確認してください。出所不明の API アドレスやキーを本番環境に接続しないでください。

### macOS 図解ガイド

#### 1. Homebrew をインストール（既にインストール済みの場合は省略）

Homebrew は macOS の欠かせないパッケージマネージャーです。

公式サイト: https://brew.sh

![macos-img-01.webp](/apps-assets/codex/macos-img-01.webp)

> **Homebrew のインストール**
>
> ```bash
>   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
>   ```

![macos-img-02.webp](/apps-assets/codex/macos-img-02.webp)

![macos-img-03.webp](/apps-assets/codex/macos-img-03.webp)

![macos-img-04.webp](/apps-assets/codex/macos-img-04.webp)

#### 2. Node.js 環境のインストール

> **Node.js 環境のインストール手順**
>
> Homebrew を更新：
>
>   ```bash
>   brew update
>   ```
>
>   Node.js をインストール：
>
>   ```bash
>   brew install node
>   ```

> **macOS の注意点**
>
> - 権限の問題が発生した場合は `sudo` が必要な場合があります。
>   - 初回実行時に「システム環境設定」での許可が必要になる場合があります。
>   - ターミナルまたは iTerm2 の使用を推奨。

![macos-img-05.webp](/apps-assets/codex/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/codex/macos-img-06.webp)

> **インストール成功の確認**
>
> インストール後、ターミナルを開き次のコマンドを入力：
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   バージョン番号が表示されればインストール成功です。

#### 3. Codex CLI をインストール

> **Codex CLI のインストール**
>
> ターミナルを開き、次のコマンドを実行：
>
>   ```bash
>   # Install Codex CLI globally
>   npm install -g @openai/codex
>   ```
>
>   権限の問題が発生した場合は sudo を使用できます：
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![macos-img-07.webp](/apps-assets/codex/macos-img-07.webp)

> **Codex CLI インストールの確認**
>
> インストール後、次のコマンドを入力して正常にインストールされたか確認：
>
>   ```bash
>   codex --version
>   ```
>
>   バージョン番号が表示されれば、おめでとうございます！ Codex CLI のインストールは成功です。

#### 4. 設定ファイルを変更

> **Codex CLI 設定ファイルのワンクリック変更**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 5. Codex CLI の利用開始

これで Codex CLI を使い始められます！

> **Codex CLI を起動**
>
> Codex CLI を直接起動：
>
>   ```bash
>   codex
>   ```
>
>   特定のプロジェクトで使用：
>
>   ```bash
>   cd /path/to/your/project
>   codex
>   ```
>
>   Enter を押して Codex CLI を起動。

![macos-img-09.webp](/apps-assets/codex/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/codex/macos-img-10.webp)

> Codex CLI の権限を設定：1. Codex によるファイルの直接変更を許可；2. Codex がファイルを変更するには手動承認が必要。

![macos-img-11.webp](/apps-assets/codex/macos-img-11.webp)

![macos-img-12.webp](/apps-assets/codex/macos-img-12.webp)

![macos-img-13.webp](/apps-assets/codex/macos-img-13.webp)

![macos-img-14.webp](/apps-assets/codex/macos-img-14.webp)

> 注：API アドレスを変更すると、すべてのモデル（公式プリセットモデルを含む）は、ご自身で設定した正当に認可された個人または組織のアクセスポイントを呼び出すようになります。

#### 6. macOS の一般的な問題と解決策

> **インストール時の権限エラー**
>
> 次の解決策をお試しください：
>
>   - `sudo` でインストール：`sudo npm install -g @openai/codex`
>   - または `npm` がユーザーディレクトリを使用するよう設定：`npm config set prefix ~/.npm-global`

> **macOS のセキュリティ設定で実行がブロックされる**
>
> システムが Codex CLI の実行をブロックする場合：
>
>   - 「システム環境設定」→「セキュリティとプライバシー」を開く
>   - 「このまま開く」または「許可」をクリック
>   - またはターミナルで実行：`sudo spctl --master-disable`

### Linux 図解ガイド

#### 1. Node.js 環境のインストール

Codex CLI を実行するには Node.js 環境が必要です。

> **Node.js 環境のインストール手順**
>
> NodeSource リポジトリを追加：
>
>   ```bash
>   sudo curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
>   ```
>
>   Node.js をインストール：
>
>   ```bash
>   sudo apt-get install -y nodejs
>   ```

> **Linux の注意点**
>
> - 一部のディストリビューションでは追加の依存関係が必要な場合があります。
>   - 権限の問題が発生した場合は sudo を使用。
>   - ユーザーが npm のグローバルディレクトリに書き込み権限を持っていることを確認。

![linux-img-01.webp](/apps-assets/codex/linux-img-01.webp)

![linux-img-02.webp](/apps-assets/codex/linux-img-02.webp)

> **インストール成功の確認**
>
> インストール後、ターミナルを開き次のコマンドを入力：
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   バージョン番号が表示されればインストール成功です。

#### 2. Codex CLI をインストール

> **Codex CLI のインストール**
>
> ターミナルを開き、次のコマンドを実行：
>
>   ```bash
>   # Install Codex CLI globally
>   npm install -g @openai/codex
>   ```
>
>   権限の問題が発生した場合は sudo を使用できます：
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![linux-img-03.webp](/apps-assets/codex/linux-img-03.webp)

> **Codex CLI インストールの確認**
>
> インストール後、次のコマンドを入力して正常にインストールされたか確認：
>
>   ```bash
>   codex --version
>   ```
>
>   バージョン番号が表示されれば、おめでとうございます！ Codex CLI のインストールは成功です。

#### 3. 設定ファイルを変更

> **Codex CLI 設定ファイルのワンクリック変更**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 4. Codex CLI の利用開始

これで Codex CLI を使い始められます！

> **Codex CLI を起動**
>
> Codex CLI を直接起動：
>
>   ```bash
>   codex
>   ```
>
>   特定のプロジェクトで使用：
>
>   ```bash
>   # Enter your project directory
>   cd /path/to/your/project
>
>   # Launch Codex CLI
>   codex
>   ```
>
>   Enter を押して Codex CLI を起動。

![linux-img-05.webp](/apps-assets/codex/linux-img-05.webp)

![linux-img-06.webp](/apps-assets/codex/linux-img-06.webp)

> Codex CLI の権限を設定：1. Codex によるファイルの直接変更を許可；2. Codex がファイルを変更するには手動承認が必要。

![linux-img-07.webp](/apps-assets/codex/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/codex/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/codex/linux-img-09.webp)

![linux-img-10.webp](/apps-assets/codex/linux-img-10.webp)

> 注：API アドレスを変更すると、すべてのモデル（公式プリセットモデルを含む）は、ご自身で設定した正当に認可された個人または組織のアクセスポイントを呼び出すようになります。

#### 5. Linux の一般的な問題と解決策

> **インストール時の権限エラー**
>
> 次の解決策をお試しください：
>
>   - `sudo` でインストール：`sudo npm install -g @openai/codex`
>   - または `npm` がユーザーディレクトリを使用するよう設定：`npm config set prefix ~/.npm-global`
>   - その後 PATH に追加：`export PATH=~/.npm-global/bin:$PATH`

> **依存ライブラリの欠落**
>
> 一部の Linux ディストリビューションでは追加の依存関係が必要です：
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>   ```
>
>   ```bash
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```
