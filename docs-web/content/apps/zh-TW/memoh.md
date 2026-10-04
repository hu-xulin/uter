# Memoh - 容器化 AI 智慧體平臺

> Memoh 是一個開源的自託管 AI
>   智慧體平臺，每個機器人執行在獨立的容器中，擁有持久化記憶和獨立檔案系統。支援接入
>   Telegram、Discord、飛書、QQ、Matrix、企業微信、微信、郵件以及內建 Web
>   UI 等 9 種渠道，並支援 MCP 工具呼叫、瀏覽器自動化、定時任務等豐富的智慧體能力。

- 官方網站：[https://memoh.sh](https://memoh.sh)
- 官方文件：[https://docs.memoh.ai](https://docs.memoh.ai)
- 專案主頁：[https://github.com/memohai/Memoh](https://github.com/memohai/Memoh)

## 核心特性

- **容器化隔離**：每個機器人執行在獨立的 containerd 容器中，擁有專屬檔案系統和網路，支援快照、資料匯入匯出
- **記憶引擎**：基於 LLM 的事實抽取、混合檢索（稠密 + 稀疏 + BM25）、24 小時上下文載入、記憶壓縮與重建
- **多渠道支援**：Telegram、Discord、飛書、QQ、Matrix、企業微信、微信、郵件、Web UI
- **MCP 支援**：完整的 MCP 協議支援（HTTP / SSE / Stdio / OAuth），每個機器人可獨立管理 MCP 連線
- **瀏覽器自動化**：內建 Playwright 驅動的無頭瀏覽器，支援網頁瀏覽、表單填寫、截圖等操作
- **Web 管理面板**：基於 Vue 3 + Tailwind CSS 的現代化管理介面，支援流式對話、工具呼叫視覺化、檔案管理等

## 快速安裝

Memoh 基於 Docker 部署，一鍵安裝（需要 Docker）：

```bash
curl -fsSL https://memoh.sh | sudo sh
```

或手動安裝：

```bash
git clone --depth 1 https://github.com/memohai/Memoh.git
cd Memoh
cp conf/app.docker.toml config.toml
# 编辑 config.toml 配置文件
sudo docker compose up -d
```

啟動後訪問 `http://localhost:8082`，預設賬號密碼：`admin` / `admin123`。

## 優特接入方法

Memoh 支援接入任何 OpenAI 相容的模型提供商，可以透過 優特來統一管理和訪問各種 AI 模型服務。

### 配置步驟

#### 獲取 優特 API Key 金鑰

在 優特註冊並登入後，點選上方導航欄的「控制檯」，點選「令牌管理」，然後點選「新增令牌」按鈕，建立一個新的 API Key 金鑰，選擇適當的許可權，然後點選「建立」。

建立成功後，點選複製金鑰按鈕，複製生成的 API Key 金鑰。

![copy-api-key](/apps-assets/memoh/copy_api_key.webp)

#### 在 Memoh 中新增模型提供商

登入 Memoh Web 管理面板，進入提供商管理頁面，點選優特。

![switch-to-uter-provider](/apps-assets/memoh/switch_to_uter_provider.webp)

在配置頁面中填寫以下資訊：

- **API Base URL**：填寫 優特的介面地址，例如 `https://api.example.com/v1`（如果本地部署則填寫 `http://localhost:3000/v1`）
- **API Key**：貼上從 優特複製的 API Key 金鑰

點選儲存，完成提供商配置。

#### 匯入模型

提供商配置完成後，進入模型管理頁面，點選自動匯入或手動新增你需要使用的模型。

#### 為機器人配置模型

進入機器人設定頁面，在模型配置一欄中，將預設聊天模型切換為剛剛透過 優特提供商新增的模型，點選儲存。

![set_chat_model](/apps-assets/memoh/set_chat_model.webp)

至此，您已經成功配置了 優特作為 Memoh 的模型提供商。現在，您可以透過 Memoh 中的各個渠道（Telegram、Discord、飛書等）與 AI 機器人對話，所有請求將透過 優特進行轉發。
