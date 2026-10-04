# 流暢閱讀 (FluentRead) - 開源翻譯外掛

> **聊天設定選項**
>
> 在 優特
>   控制檯的系統設定->聊天設定中，可新增如下快捷選項，便於在令牌管理頁一鍵填充到
>   FluentRead：

    ```json
    { "流暢閱讀": "fluentread" }
    ```

> 🌊
>   流暢閱讀（FluentRead）是一款開源瀏覽器翻譯外掛，致力於提供母語般的閱讀體驗。

- 專案地址：[https://github.com/Bistutu/FluentRead](https://github.com/Bistutu/FluentRead)

## 🌟 核心特性

### 智慧翻譯引擎

- **多引擎支援**：支援 20+ 種翻譯引擎
- **傳統翻譯**：微軟翻譯、谷歌翻譯、DeepL翻譯等
- **AI 大模型**：OpenAI、DeepSeek、Kimi、Ollama等
- **自定義引擎**：支援自定義翻譯服務配置

### 沉浸式閱讀體驗

- **雙語對照**：原文與譯文並列顯示，閱讀更輕鬆
- **劃詞翻譯**：選中任意文字，即時獲得翻譯結果
- **一鍵複製**：快速複製譯文，提高閱讀效率
- **全文翻譯**：懸浮球一鍵翻譯整個網頁，無需重新整理頁面

### 隱私與定製

- **隱私保護**：所有資料本地儲存，程式碼開源透明
- **高度定製**：豐富的自定義選項，滿足不同場景需求
- **完全免費**：開源免費，非商業化專案

## 📦 安裝方式

| 瀏覽器      | 安裝方式                                                                                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome**  | [Chrome 應用商店](https://chromewebstore.google.com/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/djnlaiohfaaifbibleebjggkghlmcpcj?hl=zh-CN&authuser=0) \| [國內映象](https://www.crxsoso.com/webstore/detail/djnlaiohfaaifbibleebjggkghlmcpcj) |
| **Edge**    | [Edge 應用商店](https://microsoftedge.microsoft.com/addons/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/kakgmllfpjldjhcnkghpplmlbnmcoflp?hl=zh-CN)                                                                                             |
| **Firefox** | [Firefox 附加元件商店](https://addons.mozilla.org/zh-CN/firefox/addon/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/)                                                                                                                                  |

## 🚀 配置方法

### 從 優特控制檯匯入配置（推薦）

當瀏覽器安裝了流暢閱讀外掛後，開啟 優特控制檯->令牌管理頁面會彈出新增流暢閱讀的提示

![新增提示](/apps-assets/fluentread/hint.webp)

選擇模型後點選一鍵填充到FluentRead，會彈出確認視窗，檢查對應的資訊是否正確

![確認](/apps-assets/fluentread/confirm.webp)

確認匯入後在流暢閱讀中的優特配置便會啟用

![配置結果](/apps-assets/fluentread/fluentread.webp)

### 在流暢閱讀中手動填寫配置

![手動配置](/apps-assets/fluentread/configuration.webp)

| 配置項     | 內容                       |
| ---------- | -------------------------- |
| 翻譯服務   | 優特                     |
| 訪問令牌   | 優特金鑰                |
| 優特介面 | 優特部署地址（不帶/v1）  |
| 模型       | 列表中選擇，或者自定義模型 |
| 自定義模型 | 模型名稱                   |
