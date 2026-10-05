# AionUi - 免費開源的桌面辦公Agent

> 🚀 AionUi 是一款免費、本地、開源的Cowork，支援 Gemini CLI、Claude Code、Codex、OpenCode、Qwen Code、Goose CLI、Auggie 等多種 AI 代理。它提供了完整的 GUI 介面和 WebUI 遠端訪問功能，是 Cowork 的開源替代方案。

- 官網地址：[https://www.aionui.com](https://www.aionui.com)
- GitHub 倉庫：[https://github.com/iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi)
- 下載地址：[https://github.com/iOfficeAI/AionUi/releases](https://github.com/iOfficeAI/AionUi/releases)

![AionUi Logo](/apps-assets/aionui/aionui-logo.webp)

## 核心特性

### 💬 多會話聊天
- **多會話 + 獨立上下文** - 可同時開啟多個聊天會話，每個會話擁有獨立的上下文記憶
- **本地儲存** - 所有對話資料儲存在本地 SQLite 資料庫中，不會丟失

### 🤖 多模型支援
- **多平臺支援** - 支援 Gemini、OpenAI、Claude、Qwen 等主流模型，靈活切換
- **本地模型支援** - 支援 Ollama、LM Studio 等本地模型部署

### 🤝 多代理模式
- **同時執行多個 AI 代理** - 可同時執行多個 AI 代理（如 Gemini CLI、Claude Code、Codex、OpenCode、Qwen Code、Goose CLI、Auggie 等）
- **MCP 統一管理** - 透過 Model Context Protocol (MCP) 統一管理和配置所有代理，簡化操作流程
- **Skills 配置** - 支援為不同代理配置專屬的 Skills，擴充套件代理能力
- **助手自定義** - 支援自定義助手配置，打造個性化的 AI 工作流
- **獨立配置** - 每個代理可獨立配置和使用，互不干擾
- **靈活切換** - 在不同代理之間靈活切換，滿足不同場景需求

### 🗂️ 檔案管理
- **檔案樹瀏覽 + 拖拽上傳** - 像資料夾一樣瀏覽檔案，支援拖拽檔案或資料夾一鍵匯入
- **智慧整理** - 可讓 AI 幫助整理資料夾，自動分類

### 📄 預覽面板
- **9+ 格式預覽** - 支援 PDF、Word、Excel、PPT、程式碼、Markdown、圖片等格式
- **實時跟蹤 + 可編輯** - 自動跟蹤檔案變化，支援實時編輯和除錯 Markdown、程式碼、HTML

### 🎨 AI 影象生成與編輯
- **智慧影象生成** - 支援 Gemini 2.5 Flash Image Preview、Nano、Banana 等多種影象生成模型
- **影象識別與編輯** - AI 驅動的影象分析和編輯功能

### 🌐 多渠道訪問
- **WebUI 遠端訪問** - 可透過瀏覽器從網路上的任何裝置訪問，支援移動裝置
- **Telegram 整合** - 支援透過 Telegram 機器人進行互動
- **飛書整合** - 支援透過飛書進行訪問和互動
- **本地資料安全** - 所有資料儲存在本地 SQLite 資料庫中，適合伺服器部署

## 優特接入方法

### 引數填寫

提供商型別：優特支援的型別  
API 金鑰：於 優特獲取  
API 地址：優特站點地址（例如：`https://<your-uter-domain>/v1`）

請使用您自己部署的 優特，或確認服務方具備合法上游授權和合規義務的 優特服務。不要將來源不明的 API 地址或金鑰接入生產環境。

### 配置步驟

1. **在 優特中複製 API key**
   ![複製 API 金鑰](/apps-assets/aionui/copy_apikey.webp)

2. **開啟 AionUi 設定**
   - 在 AionUi 中進入設定頁面
   - 找到 模型配置 Tab
   - 點選"新增模型"
   ![開啟設定](/apps-assets/aionui/add-model-1.webp)

3. **新增新的提供商**
   - 點選"新增模型"
   - 選擇 優特
   ![新增 優特提供商](/apps-assets/aionui/newapi_provider.webp)

4. **配置 API 資訊**
   - API 地址：填寫您的 優特站點地址（格式：`https://<your-uter-domain>/v1`）
   - API 金鑰：貼上從 優特控制檯複製的 API Key

5. **新增模型**
   - 下拉選擇需要新增的模型
   - 模型名稱應與 優特中配置的模型名稱一致
   - 選擇合適的請求協議

6. **開始使用**
   - 返回聊天頁面
   - 選擇已配置的 優特模型開始對話

## 相關連結

- [GitHub 倉庫](https://github.com/iOfficeAI/AionUi)
- [完整使用指南](https://github.com/iOfficeAI/AionUi#-detailed-usage-guide)
- [FAQ 常見問題](https://github.com/iOfficeAI/AionUi#-support--help)
