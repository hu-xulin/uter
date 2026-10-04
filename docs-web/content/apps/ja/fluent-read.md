# FluentRead - オープンソース翻訳プラグイン

> **チャット設定オプション**
>
> Uter コンソールの システム設定 → チャット設定 で、トークン管理ページから
>   FluentRead にワンクリックで入力できるよう、次のショートカットオプションを追加できます：

    ```json
    { "流畅阅读": "fluentread" }
    ```

> 🌊 FluentRead は、ネイティブに近い読書体験の提供に特化したオープンソースのブラウザ翻訳プラグインです。

- プロジェクトアドレス: [https://github.com/Bistutu/FluentRead](https://github.com/Bistutu/FluentRead)

## 🌟 主要機能

### スマート翻訳エンジン

- **マルチエンジン対応**: 20 種類以上の翻訳エンジンをサポート
- **従来の翻訳**: Microsoft Translate、Google Translate、DeepL Translate など
- **AI 大規模モデル**: OpenAI、DeepSeek、Kimi、Ollama など
- **カスタムエンジン**: カスタム翻訳サービスの設定をサポート

### 没入型の読書体験

- **バイリンガル比較**: 原文と翻訳文を並べて表示し、読みやすく
- **選択翻訳**: 任意のテキストを選択するだけで即時翻訳結果を取得
- **ワンクリックコピー**: 翻訳テキストを素早くコピーし、読書効率を向上
- **全文翻訳**: フローティングボタンでウェブページ全体をワンクリック翻訳、ページの再読み込み不要

### プライバシーとカスタマイズ

- **プライバシー保護**: すべてのデータをローカルに保存、オープンソースで透明性のあるコード
- **高いカスタマイズ性**: さまざまなシナリオのニーズに応える豊富なカスタマイズオプション
- **完全無料**: オープンソースで無料の非商用プロジェクト

## 📦 インストール方法

| ブラウザ     | インストール方法                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome**  | [Chrome Web Store](https://chromewebstore.google.com/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/djnlaiohfaaifbibleebjggkghlmcpcj?hl=zh-CN&authuser=0) \| [国内ミラー](https://www.crxsoso.com/webstore/detail/djnlaiohfaaifbibleebjggkghlmcpcj) |
| **Edge**    | [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/kakgmllfpjldjhcnkghpplmlbnmcoflp?hl=zh-CN)                                                                                                |
| **Firefox** | [Firefox Add-ons Store](https://addons.mozilla.org/zh-CN/firefox/addon/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/)                                                                                                                                         |

## 🚀 設定方法

### Uter コンソールから設定をインポート（推奨）

FluentRead プラグインをブラウザにインストールした後、Uter コンソール → トークン管理ページを開くと、FluentRead を追加するためのプロンプトが表示されます。

![追加のプロンプト](/apps-assets/fluentread/hint.webp)

モデルを選択後、「FluentRead にワンクリック入力」をクリックすると、確認ウィンドウが表示されます。対応する情報が正しいか確認してください。

![確認](/apps-assets/fluentread/confirm.webp)

インポートを確認すると、FluentRead 内の Uter 設定が有効になります。

![設定結果](/apps-assets/fluentread/fluentread.webp)

### FluentRead で手動設定

![手動設定](/apps-assets/fluentread/configuration.webp)

| 設定項目  | 内容                                 |
| ------------------- | --------------------------------------- |
| 翻訳サービス | Uter                                  |
| アクセストークン        | Uter キー                              |
| Uter エンドポイント     | Uter 導入アドレス（/v1 なし） |
| モデル               | 一覧から選択、またはカスタムモデル       |
| カスタムモデル        | モデル名                              |
