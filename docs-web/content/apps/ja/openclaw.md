# OpenClaw - セルフホスト型 AI アシスタントプラットフォーム

> **プロジェクト紹介**
>
> OpenClaw は、メッセージングアプリをご自身のハードウェアで動作する AI
>   エージェントに接続する、オープンソースのセルフホスト型パーソナル AI
>   アシスタントプラットフォームです。開発者および上級ユーザー向けに設計されており、
>   データの管理を手放すことなく自律型 AI アシスタントを利用できます。
>
>   - 公式ホームページ: [https://openclaw.ai](https://openclaw.ai)
>   - プロジェクトドキュメント: [https://docs.openclaw.ai](https://docs.openclaw.ai)
>   - GitHub: [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

OpenClaw は完全にオープンソースです。[OpenClaw の GitHub リポジトリ](https://github.com/openclaw/openclaw) でソースコードの閲覧、Issue の投稿、または貢献ができます。本チュートリアルでは、OpenClaw のインストール、設定、および Uter との統合の完全な手順を解説します。

## 🌟 主要機能

### マルチチャネル統合

- **マルチチャネル統合**: Telegram、Discord、WhatsApp、iMessage などのさまざまなメッセージングチャネルをサポートし、プラグインでさらに多くのプラットフォームに拡張可能。
- **単一ゲートウェイ**: 単一の Gateway プロセスで全チャネルを一元管理。
- **音声対応**: macOS/iOS/Android の音声対話をサポート。
- **Canvas インターフェース**: インタラクティブな Canvas インターフェースを描画可能。

### セルフホストとデータセキュリティ

- **完全セルフホスト**: ご自身のマシンまたはサーバーで動作。
- **オープンソースの透明性**: MIT オープンソースライセンス、完全に透明なコード。
- **ローカルデータ**: コンテキストとスキルはクラウドではなくローカルコンピュータに保存。

### インテリジェントエージェント機能

- **継続稼働**: 長期メモリを備えた永続的なバックグラウンド動作をサポート。
- **スケジュールされたタスク**: cron スケジュールタスクをサポート。
- **セッション分離**: エージェント/ワークスペース/送信者ごとにセッションを分離。
- **マルチエージェントルーティング**: 複数エージェント間の協調動作をサポート。
- **ツール呼び出し**: ツール呼び出しとコード実行をネイティブサポート。

## 📦 統合前の準備

> **準備情報**
>
> - Node.js 22 以上
>   - 利用可能な Uter アドレス（通常は `/v1` で終わる）
>   - 利用可能な Uter API キー
>   - ご自身で導入した Uter を使用するか、サービス提供者がその Uter サービスに対して正当な上流認可とコンプライアンス義務を負っていることを確認してください。出所不明の API アドレスやキーを本番環境に接続しないでください。

Uter を統合する前に、OpenClaw の公式で現在推奨されている手順に従って、まず Gateway と Control UI を起動しておくことをお勧めします。これにより、後でトラブルシューティングする際に、OpenClaw 自体が起動しないのか、モデルプロバイダの設定が誤っているのかを区別しやすくなります。

### 1. OpenClaw をインストール（macOS/Linux）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

その他のインストール方法については、OpenClaw 公式ドキュメントを参照: [Getting Started](https://docs.openclaw.ai/start/getting-started)。

### 2. オンボーディングウィザードを実行

```bash
openclaw onboard --install-daemon
```

このウィザードは、基本認証、Gateway のセットアップ、およびオプションのチャネル初期化を完了します。ここでの目的はまず OpenClaw を動作させ、その後でデフォルトモデルを Uter に切り替えることです。

### 3. Gateway と Control UI を確認

```bash
openclaw gateway status
```

```bash
openclaw dashboard
```

ブラウザで Control UI を開ける場合、OpenClaw の基本動作は正常です。この段階では、Telegram、Discord、Feishu、その他のメッセージングチャネルを設定する必要はありません。

### 4. 設定ファイルの場所

OpenClaw の設定ファイルは通常 `~/.openclaw/openclaw.json` にあります。オンボーディングウィザードが生成した内容を基に変更を続けられます。

> **パス関連の環境変数**
>
> 専用のサービスアカウント配下で OpenClaw を実行する場合、または設定/状態ディレクトリをカスタマイズしたい場合は、次を使用できます：
>
>   - `OPENCLAW_HOME`
>   - `OPENCLAW_STATE_DIR`
>   - `OPENCLAW_CONFIG_PATH`
>
>   詳細な手順は、公式の環境変数ドキュメントを参照: [Environment Variables](https://docs.openclaw.ai/help/environment)。

## 🚀 モデルプロバイダとして Uter を使用

OpenClaw は `models.providers` を通じて、カスタムまたは OpenAI 互換のモデルゲートウェイの統合をサポートしています。Uter の場合、最も一般的な方法は設定にカスタムプロバイダとして追加し、その後デフォルトモデルを `uter/model-ID` に向けることです。

### 統合手順

1. `models.providers` の配下に `uter` プロバイダを宣言。
2. `baseUrl` を Uter アドレスに向け、`/v1` を含めることを確認。
3. `api` を `openai-completions` に設定。
4. `models` に OpenClaw で使用したいモデル ID を列挙。
5. `agents.defaults.model.primary` のデフォルトモデルを `uter/...` に切り替え。

### 推奨される実践：API キーを環境変数に保存

まず、現在のシェル、サービス環境、または OpenClaw から読み取り可能な `.env` ファイルで Uter キーを提供します：

```bash
export UTER_API_KEY="sk-your-uter-key"
```

次に、`openclaw.json` に次のスニペットを追加または変更します：

```json5
{
  models: {
    mode: "merge",
    providers: {
      uter: {
        baseUrl: "https://<your-uter-domain>/v1",
        apiKey: "${UTER_API_KEY}",
        api: "openai-completions",
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
          { id: "kimi-k2.5", name: "Kimi K2.5" },
        ],
      },
    },
  },

  agents: {
    defaults: {
      model: {
        primary: "uter/gemini-2.5-flash",
        fallbacks: ["uter/kimi-k2.5"],
      },
      models: {
        "uter/gemini-2.5-flash": { alias: "flash" },
        "uter/kimi-k2.5": { alias: "kimi" },
      },
    },
  },
}
```

これはそのままコピーすべき完全な設定ではなく、Uter を統合する上で最も重要な部分です。`provider`、モデル ID、およびデフォルトモデルの参照さえ正しければ、OpenClaw は Uter を通じて公開されているモデルリソースを呼び出せるようになります。

### 主要な設定の詳細

| 設定項目 | 説明 |
| --- | --- |
| `models.mode` | `merge` に設定することを推奨。OpenClaw 内蔵のプロバイダを保持したまま `uter` を追加 |
| `models.providers.uter.baseUrl` | Uter アドレス。通常は `/v1` を含める必要あり |
| `models.providers.uter.apiKey` | Uter キー。`${UTER_API_KEY}` で注入することを推奨 |
| `models.providers.uter.api` | Uter のような OpenAI 互換ゲートウェイには `openai-completions` を使用 |
| `models.providers.uter.models` | ここに列挙するモデル ID は、Uter が実際に公開しているモデル名と一致している必要あり |
| `agents.defaults.model.primary` | デフォルトのプライマリモデル。形式は `provider/model-id` である必要あり |
| `agents.defaults.model.fallbacks` | フォールバックモデルのリスト。プライマリが失敗した場合自動的に切り替え |
| `agents.defaults.models` | オプション。モデルのエイリアスを作成し、UI やセッションからの参照を容易に |

### 統合成功の確認

設定完了後、Control UI に戻るか再び開きます：

```bash
openclaw dashboard
```

OpenClaw で正常に会話を開始でき、デフォルトモデルが `uter/...` になっていれば統合は成功です。また、次を使用できます：

```bash
openclaw models list
```

`uter/` プレフィックス付きのモデルが選択可能なリストに表示されることを確認。

### よくある問題

- `baseUrl` に `/v1` が欠落: これは最も一般的な統合エラーの一つ。
- モデル ID が不正: `primary` と `fallbacks` は `models.providers.uter.models` の `id` に対応している必要あり。
- API キーが現在のターミナルでのみ有効: Gateway がバックグラウンドサービスとして動作する場合、サービスプロセスも `UTER_API_KEY` を読めることを確認。
- フォアグラウンドでのトラブルシューティング: 公式のフォアグラウンド実行方法 `openclaw gateway --port 18789` を使用してログとエラーを観察。
