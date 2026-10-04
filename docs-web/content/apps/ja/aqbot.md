# AQBot - ローカルファーストのデスクトップ AI ワークベンチ

> **チャット設定オプション**
>
> Uter コンソールで、システム設定 → チャット設定 に移動し、次のショートカットオプションを追加します。これにより、トークン管理ページから AQBot をワンクリックで入力できるようになります：

    ```json
    { "AQBot": "aqbot://providers?name=New%20API&baseurl={address}&apikey={key}&type=openai" }
    ```

> AQBot はローカルファーストのオープンソース デスクトップ AI ワークベンチです（AGPL-3.0）。複数プロバイダのチャット、ACP エージェント、ナレッジベース、MCP ツール、およびローカル API ゲートウェイを統合しながら、アプリデータとユーザーファイルをマシン上に保持します。

- 公式サイト: [https://app.aqbot.top](https://app.aqbot.top)
- GitHub: [https://github.com/AQBot-Desktop/AQBot](https://github.com/AQBot-Desktop/AQBot)
- ダウンロード: [GitHub Releases](https://github.com/AQBot-Desktop/AQBot/releases)
- 公式ドキュメント: [はじめに](https://app.aqbot.top/guide/getting-started)

## 主要機能

- **マルチプロバイダチャット** — OpenAI、Claude、Gemini、DeepSeek、Qwen、および任意の OpenAI 互換エンドポイントに接続
- **プロバイダのインポート** — 確認後に `aqbot://` リンクからプロバイダをインポート
- **モデル管理** — リモートのモデル一覧、機能タグ、レイテンシテストを同期
- **エージェント** — チャット内エージェント（設定したプロバイダ API を使用）に加え、ACP エージェント ワークベンチ
- **ローカルデータ** — アプリの状態は `~/.aqbot/` に、ユーザーファイルは `~/Documents/aqbot/` に保存

機能の全容については [AQBot のウェブサイト](https://app.aqbot.top) を参照してください。このページでは Uter との連携のみを扱います。

## Uter との連携方法

ご自身で導入した Uter を使用するか、サービス提供者が正当な上流認可とコンプライアンス義務を負う Uter サービスを提供していることを確認してください。出所不明の API アドレスやキーを本番環境に統合しないでください。

### 方法 1: ワンクリックインポート（推奨）

1. AQBot をインストールし、少なくとも一度開いてシステムに `aqbot://` プロトコルを登録する
2. Uter コンソールで、上記の JSON を **システム設定 → チャット設定** に追加
3. **トークン管理** を開き、トークン操作から **AQBot** を選択
4. ブラウザが AQBot を起動する。プロバイダ名、API ホスト、タイプ `openai`、キーのプレフィックスを確認
5. 確認後、AQBot が **設定 → プロバイダ管理** を開く。同じ API ホスト + タイプのプロバイダがあれば再利用し、なければ新規作成する
6. そのプロバイダを開き、**モデルの同期** をクリックし、チャットに戻ってモデルを選択

`{address}` は Uter サイトのルート（例：`https://your-uter.example`）で、クエリ文字列は付けません。OpenAI タイプの場合、AQBot が自動的に `/v1` を付加します。インポートではキーの検証やモデルの同期は行われません。

### 方法 2: 手動設定

1. Uter トークン管理から API キーをコピー
2. AQBot で **設定 → プロバイダ管理 → プロバイダを追加** に移動
3. 次を入力：

| 項目 | 値 |
| --- | --- |
| プロバイダ名 | 例：`Uter` |
| プロバイダタイプ | `OpenAI`（推奨） |
| API ホスト | Uter サイトのアドレス（例：`https://your-uter.example`） |
| API キー | お使いの Uter トークン |

4. **モデルの同期** をクリックして、Uter が現在公開しているモデルを取得
5. チャットに戻り、同期されたモデルを選択

![Switch model](/apps-assets/aqbot/switch-model.webp)

### API ホストに関する注意

- サイトルートを指定し、AQBot に `/v1` を付加させるのが推奨
- ホストが既に `/v1` で終わっている場合、AQBot はそれ以上付加しない
- 自動補完を無効にする必要がある場合のみ、末尾に `!` を追加

### オプション: ネイティブプロトコル

Uter が Claude や Gemini のネイティブ API も公開している場合、別のプロバイダを追加：

| 用途 | プロバイダタイプ | API ホスト |
| --- | --- | --- |
| Chat Completions（デフォルト） | OpenAI | サイトルート |
| Claude ネイティブ `/v1/messages` | Anthropic | サイトルート |
| Gemini ネイティブ | Gemini | サイトルート |

ワンクリックテンプレートの `type` を `anthropic` または `gemini` に変更します。同じ API キーで複数のプロバイダを支えることができます。

## FAQ

- **AQBot をクリックしてもアプリが開かない**: まずデスクトップアプリをインストールして起動してください。ウェブサイトや Vite 開発サーバーだけを開いても `aqbot://` は登録されません
- **インポートは成功するがチャットが失敗する**: **モデルの同期** をクリックし、モデル ID が Uter が実際に公開している名前と一致することを確認
- **macOS でアプリが破損している、または開発者を確認できないと表示される**: [AQBot README](https://github.com/AQBot-Desktop/AQBot) と [はじめに](https://app.aqbot.top/guide/getting-started) に従ってこのアプリを許可してください。Gatekeeper をオフにする必要はありません
- **ワンクリックリンクに API キーが含まれている**: サインイン済みのトークンページでのみ生成してください。実際のキーが埋め込まれた URL を投稿しないでください

## 関連リンク

- [AQBot GitHub](https://github.com/AQBot-Desktop/AQBot)
- [プロバイダの設定（公式ドキュメント）](https://app.aqbot.top/guide/providers)
- [ダウンロード](https://github.com/AQBot-Desktop/AQBot/releases)
