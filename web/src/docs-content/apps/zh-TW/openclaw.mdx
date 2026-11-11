# OpenClaw - 自託管 AI 智慧助手平臺

> **專案介紹**
>
> OpenClaw 是一個開源、自託管的個人 AI
>   助手平臺，將訊息應用連線到執行在你自己硬體上的 AI
>   代理。專為開發者和高階使用者設計，無需交出資料控制權即可擁有自主 AI 助手。
>
>   - 官方主頁：[https://openclaw.ai](https://openclaw.ai)
>   - 專案文件：[https://docs.openclaw.ai](https://docs.openclaw.ai)
>   - GitHub：[https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

OpenClaw 完全開源，你可以在 [OpenClaw 的 GitHub 倉庫](https://github.com/openclaw/openclaw) 瀏覽原始碼、提交 Issue 或參與貢獻。本教程涵蓋安裝、配置，以及將 OpenClaw 對接 優特的完整步驟。

## 🌟 核心特性

### 多渠道整合

- **多渠道整合**：支援 Telegram、Discord、WhatsApp、iMessage 等多種訊息渠道，也可透過外掛擴充套件更多平臺
- **單一閘道器**：透過一個 Gateway 程序統一管理所有渠道
- **語音支援**：支援 macOS/iOS/Android 語音互動
- **Canvas 介面**：可渲染互動式 Canvas 介面

### 自託管與資料安全

- **完全自託管**：執行在你自己的機器或伺服器上
- **開源透明**：MIT 開源協議，程式碼完全透明
- **資料本地化**：上下文和技能儲存在你的本地計算機，而非雲端

### 智慧代理能力

- **持續執行**：支援後臺常駐執行，擁有持久記憶
- **計劃任務**：支援 cron 定時任務
- **會話隔離**：按代理/工作區/傳送者隔離會話
- **多代理路由**：支援多代理協同工作
- **工具呼叫**：原生支援工具呼叫和程式碼執行

## 📦 接入前準備

> **準備資訊**
>
> - Node.js 22 或更高版本
>   - 一個可用的 優特地址（通常以 `/v1` 結尾）
>   - 一個可用的 優特 API Key
>   - 請使用您自己部署的 優特，或確認服務方具備合法上游授權和合規義務的 優特服務。不要將來源不明的 API 地址或金鑰接入生產環境。

在開始接入 優特之前，建議先按 OpenClaw 官方當前推薦流程把 Gateway 和 Control UI 跑起來。這樣後續排查問題時，更容易區分是 OpenClaw 本身未啟動，還是模型提供商配置有誤。

### 1. 安裝 OpenClaw（macOS/Linux）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

其他安裝方式可參考 OpenClaw 官方文件：[Getting Started](https://docs.openclaw.ai/start/getting-started)。

### 2. 執行引導向導

```bash
openclaw onboard --install-daemon
```

該向導會完成基礎認證、Gateway 設定，以及可選的渠道初始化。這裡的目標是先把 OpenClaw 跑起來，後面再把預設模型切到 優特。

### 3. 檢查 Gateway 與 Control UI

```bash
openclaw gateway status
```

```bash
openclaw dashboard
```

如果瀏覽器能開啟 Control UI，說明 OpenClaw 基礎執行已經正常。這個階段不需要先配置 Telegram、Discord、飛書等訊息渠道。

### 4. 定位配置檔案

OpenClaw 的配置檔案通常位於 `~/.openclaw/openclaw.json`，你可以在引導向導生成的基礎上繼續修改。

> **路徑相關環境變數**
>
> 如果你把 OpenClaw 跑在專用服務賬號下，或希望自定義配置/狀態目錄，可以使用：
>
>   - `OPENCLAW_HOME`
>   - `OPENCLAW_STATE_DIR`
>   - `OPENCLAW_CONFIG_PATH`
>
>   詳細說明見官方環境變數文件：[Environment Variables](https://docs.openclaw.ai/help/environment)。

## 🚀 使用 優特作為模型提供商

OpenClaw 支援透過 `models.providers` 接入自定義或相容 OpenAI 介面的模型閘道器。對於 優特，最常見的做法是把它作為一個自定義 provider 加進配置裡，再把預設模型指向 `uter/模型ID`。

### 接入思路

1. 在 `models.providers` 下宣告一個 `uter` provider
2. 將 `baseUrl` 指向你的 優特地址，並確保包含 `/v1`
3. 將 `api` 設為 `openai-completions`
4. 在 `models` 中列出你希望 OpenClaw 使用的模型 ID
5. 在 `agents.defaults.model.primary` 中把預設模型切到 `uter/...`

### 推薦做法：用環境變數儲存金鑰

先在當前 shell、服務環境，或 OpenClaw 可讀取的 `.env` 中提供你的 優特金鑰：

```bash
export UTER_API_KEY="sk-your-uter-key"
```

然後在 `openclaw.json` 裡補充或修改以下片段：

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

這不是一份必須原樣照抄的完整配置，而是接入 優特最關鍵的部分。只要 `provider`、模型 ID 和預設模型引用對應正確，OpenClaw 就能透過 優特呼叫你暴露出來的模型資源。

### 關鍵配置說明

| 配置項 | 說明 |
| --- | --- |
| `models.mode` | 建議設為 `merge`，在保留 OpenClaw 內建 provider 的同時追加 `uter` |
| `models.providers.uter.baseUrl` | 你的 優特地址，通常需要帶上 `/v1` |
| `models.providers.uter.apiKey` | 優特金鑰，推薦透過 `${UTER_API_KEY}` 注入 |
| `models.providers.uter.api` | 對於 優特這類 OpenAI 相容閘道器，使用 `openai-completions` |
| `models.providers.uter.models` | 這裡列出的模型 ID 必須與你的 優特實際暴露的模型名稱一致 |
| `agents.defaults.model.primary` | 預設主模型，格式必須是 `provider/model-id` |
| `agents.defaults.model.fallbacks` | 備選模型列表，主模型失敗時自動切換 |
| `agents.defaults.models` | 可選，用來給模型起別名，方便在 UI 或會話裡引用 |

### 驗證是否接入成功

完成配置後，回到 Control UI 或重新開啟：

```bash
openclaw dashboard
```

如果你能在 OpenClaw 中正常發起對話，並且預設模型已經變成 `uter/...`，說明接入成功。你也可以使用：

```bash
openclaw models list
```

確認 `uter/` 字首的模型已經出現在可選列表中。

### 常見問題

- `baseUrl` 沒帶 `/v1`：這是最常見的接入錯誤之一。
- 模型 ID 填錯：`primary` 和 `fallbacks` 必須與 `models.providers.uter.models` 裡的 `id` 對應。
- 金鑰只在當前終端生效：如果 Gateway 以後臺服務執行，請確保服務程序也能讀取 `UTER_API_KEY`。
- 想前臺排障：可使用官方前臺執行方式 `openclaw gateway --port 18789` 觀察日誌與報錯。
