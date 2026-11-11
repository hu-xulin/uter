# AQBot - 本地優先的桌面 AI 工作臺

> **聊天設定選項**
>
> 在 優特
>   控制檯的系統設定->聊天設定中，可新增如下快捷選項，便於在令牌管理頁一鍵填充到
>   AQBot：

    ```json
    { "AQBot": "aqbot://providers?name=New%20API&baseurl={address}&apikey={key}&type=openai" }
    ```

> AQBot
>   是一款本地優先的開源桌面 AI
>   工作臺（AGPL-3.0），統一多服務商對話、ACP Agent、知識庫、MCP
>   工具與本地 API 閘道器，應用資料與使用者檔案保留在本機。

- 官網：[https://app.aqbot.top](https://app.aqbot.top)
- GitHub：[https://github.com/AQBot-Desktop/AQBot](https://github.com/AQBot-Desktop/AQBot)
- 下載：[GitHub Releases](https://github.com/AQBot-Desktop/AQBot/releases)
- 官方文件：[快速開始](https://app.aqbot.top/zh/guide/getting-started)

## 核心特性

- **多服務商對話** — 連線 OpenAI、Claude、Gemini、DeepSeek、Qwen 以及任意 OpenAI 相容端點
- **服務商快速匯入** — 透過 `aqbot://` 連結匯入服務商，確認後寫入本地配置
- **模型管理** — 同步遠端模型列表、能力標籤與延遲測試
- **Agent** — 對話內 Agent（使用已配置服務商 API）與 ACP Agent 工作臺
- **本地資料** — 應用狀態位於 `~/.aqbot/`，使用者檔案位於 `~/Documents/aqbot/`

完整功能請參考 [AQBot 官網](https://app.aqbot.top)。本頁只覆蓋對接 優特。

## 優特接入方法

請使用您自己部署的 優特，或確認服務方具備合法上游授權和合規義務的 優特服務。不要將來源不明的 API 地址或金鑰接入生產環境。

### 方式一：一鍵匯入（推薦）

1. 安裝並至少開啟過一次 AQBot 桌面端，系統才會註冊 `aqbot://` 協議
2. 在 優特控制檯的「系統設定 → 聊天設定」中加入上文 JSON
3. 開啟「令牌管理」，在目標令牌的操作選單中選擇 **AQBot**
4. 瀏覽器喚起 AQBot，在確認框中核對服務商名稱、API 地址、型別 `openai` 和金鑰字首
5. 確認後 AQBot 會進入 **設定 → 服務商管理**；按 API 地址 + 型別複用已有服務商，否則新建
6. 開啟該服務商，點選 **同步模型**，再回到對話頁選擇模型開始使用

`{address}` 是 優特站點根地址（例如 `https://your-uter.example`），不要帶 query。AQBot 對 OpenAI 型別會自動補上 `/v1`。匯入後不會自動驗證金鑰，也不會自動同步模型。

### 方式二：手動配置

1. 在 優特令牌管理頁複製 API Key
2. 開啟 AQBot → **設定 → 服務商管理** → **新增服務商**
3. 填寫以下欄位：

| 欄位 | 填法 |
| --- | --- |
| 服務商名稱 | 例如 `Uter` |
| 服務商型別 | `OpenAI`（推薦） |
| API 地址 | 優特站點地址，如 `https://your-uter.example` |
| API 金鑰 | 優特令牌 |

4. 點選 **同步模型**，拉取 優特當前可用的模型
5. 回到對話頁，選擇剛同步的模型開始使用

![切換模型](/apps-assets/aqbot/switch-model.webp)

### API 地址注意

- 推薦只填站點根地址，讓 AQBot 自動補 `/v1`
- 如果地址已經以 `/v1` 結尾，AQBot 不會再追加
- 只有在必須禁用自動補全時，才在地址末尾加 `!`

### 可選：原生協議

優特同時提供 Claude / Gemini 原生介面時，可以再新增一條服務商：

| 需求 | 服務商型別 | API 地址 |
| --- | --- | --- |
| Chat Completions（預設） | OpenAI | 站點根地址 |
| Claude 原生 `/v1/messages` | Anthropic | 站點根地址 |
| Gemini 原生 | Gemini | 站點根地址 |

一鍵匯入模板裡的 `type` 對應改為 `anthropic` 或 `gemini`。同一套 API Key 可以掛多條服務商。

## 常見問題

- **點選 AQBot 沒有喚起應用**：先安裝並啟動過桌面端。只開啟官網或開發伺服器不會註冊 `aqbot://`
- **匯入成功但無法對話**：先點選「同步模型」，並確認模型 ID 與 優特實際暴露的名稱一致
- **macOS 提示「已損壞」或「無法驗證開發者」**：按 [AQBot README](https://github.com/AQBot-Desktop/AQBot) 與[官方快速開始](https://app.aqbot.top/zh/guide/getting-started)放行當前應用，不必關閉整個 Gatekeeper
- **一鍵連結裡帶有 API Key**：只在已登入的令牌頁生成該連結，不要把帶真實金鑰的 URL 發到公開頁面

## 相關連結

- [AQBot GitHub](https://github.com/AQBot-Desktop/AQBot)
- [配置服務商（官網）](https://app.aqbot.top/zh/guide/providers)
- [下載](https://github.com/AQBot-Desktop/AQBot/releases)
