# CC Switch - AI CLI 統一管理工具

> **聊天設定選項**
>
> 在 優特控制檯的系統設定->聊天設定中，可新增如下快捷選項，便於在令牌管理頁一鍵填充到 CC Switch：

    ```json
    { "CC Switch": "ccswitch" }
    ```

> 🔀 CC Switch 是一款開源、跨平臺的 AI CLI 統一管理工具，支援 Claude Code、Codex 和 Gemini CLI
>   的 Provider 配置一鍵切換、MCP 伺服器統一管理、系統提示詞（Prompts）管理以及 Skills 擴充套件管理，
>   讓你在多個 AI 程式設計助手之間自由切換，無需手動編輯配置檔案。

- GitHub 倉庫：[https://github.com/farion1231/cc-switch](https://github.com/farion1231/cc-switch)
- 下載地址：[GitHub Releases](https://github.com/farion1231/cc-switch/releases)

## 核心特性

### 🔌 Provider 管理
- **一鍵切換** — 在 Claude Code、Codex、Gemini 的 API 配置之間一鍵切換，無需手動修改環境變數或配置檔案
- **多端點支援** — 每個 Provider 可配置多個端點，支援 API Key 管理與延遲測速
- **4 層模型配置** — 支援 Haiku / Sonnet / Opus / Custom 四級模型粒度配置

### 🛠️ MCP 伺服器管理
- **跨應用統一管理** — 單面板管理 Claude / Codex / Gemini 三端的 MCP 伺服器
- **三種傳輸型別** — 支援 stdio、HTTP、SSE（Server-Sent Events）
- **自動同步** — 統一匯入匯出 + 雙向同步

### 💬 Prompts 管理
- **多預設系統提示詞** — 無限預設、快速切換
- **跨應用支援** — Claude（`CLAUDE.md`）、Codex（`AGENTS.md`）、Gemini（`GEMINI.md`）
- **Markdown 編輯器** — CodeMirror 6 + 實時預覽

### 🌐 多平臺支援
- **桌面應用** — Windows、macOS、Linux 原生安裝包
- **Web 版本** — 適用於無頭伺服器 / SSH 遠端環境的瀏覽器訪問方案
- **CLI 版本** — 命令列互動模式與命令模式雙支援

## 優特接入方法

CC Switch 支援 `ccswitch://` Deep Link 協議，可從 優特令牌管理頁一鍵匯入 Provider 配置。

### 配置步驟

1. **在 優特令牌管理頁，點選對應令牌的下拉選單**
   在選單中選擇 **CC Switch** 選項，系統會自動喚起 CC Switch 應用並彈出配置彈窗。

2. **在彈窗中完成配置**
   ![填入 CC Switch 彈窗](/apps-assets/cc_switch/fill_dialog.webp)

   彈窗各欄位說明：
   - **應用**：頂部切換應用型別 — **Claude** / **Codex** / **Gemini**，根據需要選擇目標應用
   - **名稱**：為該配置填寫一個名稱（例如 `My Claude`），方便後續在 CC Switch 中識別和切換
   - **主模型**（必填）— 預設使用的主力模型
   - **Haiku 模型** — 輕量快速模型
   - **Sonnet 模型** — 均衡模型
   - **Opus 模型** — 最強模型

   所有模型均為下拉選擇，未選擇時顯示「請選擇模型」。

3. **完成配置**
   點選 **「開啟 CC Switch」** 即可將配置匯入 CC Switch 並開始使用；點選 **「取消」** 放棄本次操作。

## 安裝方式

### macOS（推薦 Homebrew）

```shell
brew tap farion1231/ccswitch
brew install --cask cc-switch
```

### Windows

從 [Releases](https://github.com/farion1231/cc-switch/releases) 下載 `.msi` 安裝包或便攜版 `.zip`。

### Linux

從 [Releases](https://github.com/farion1231/cc-switch/releases) 下載 `.deb` 包或 `.AppImage`。

ArchLinux 使用者：

```shell
paru -S cc-switch-bin
```

### Web 版本（無頭 / SSH 伺服器）

```shell
wget https://github.com/farion1231/cc-switch/releases/latest/download/cc-switch-web-linux-x64.tar.gz
tar -xzf cc-switch-web-linux-x64.tar.gz
cd cc-switch-web/
./cc-switch-web
```

預設埠 `17666`，透過瀏覽器訪問 `http://localhost:17666`。

## 相關連結

- [GitHub 倉庫](https://github.com/farion1231/cc-switch)
- [更新日誌](https://github.com/farion1231/cc-switch/blob/main/CHANGELOG.md)
- [Web 版本倉庫](https://github.com/cp-yu/cc-switch-web)
- [CLI 版本倉庫](https://github.com/thomas-jack/cc-switch-cli)
