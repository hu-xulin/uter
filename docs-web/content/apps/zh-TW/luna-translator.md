# LunaTranslator - 開源 GalGame 翻譯器

> **聊天設定選項**
>
> 在 優特
>   控制檯的系統設定->聊天設定中，可新增如下快捷選項，便於在令牌管理頁一鍵填充到
>   LunaTranslator：

    ```json
    { "LunaTranslator": "lunatranslator://llmapi/base64?data={cheryConfig}" }
    ```

> LunaTranslator
>   是一款開源免費的視覺小說（GalGame）翻譯器，致力於提供母語級別的視覺小說遊玩體驗。

- 專案地址：[https://github.com/HIllya51/LunaTranslator](https://github.com/HIllya51/LunaTranslator)
- 專案文件：[https://docs.lunatranslator.org](https://docs.lunatranslator.org/zh/README.html)

## 功能支援

- **HOOK** 主要使用HOOK提取遊戲文字，幾乎適配了所有的常見和冷門的視覺小說

- **內嵌翻譯** 部分遊戲還可以直接內嵌翻譯到遊戲中，以獲取沉浸式體驗

- **HOOK模擬器** 對NS/PSP/PSV/PS2上的大部分遊戲，支援HOOK模擬器直接讀取遊戲文字

- **OCR** 內建較高精度的OCR模型，並支援許多其他線上&離線OCR引擎，以便靈活的讀取任意文字

- **豐富的翻譯介面** 支援幾乎所有翻譯引擎，包括大語言模型翻譯、離線翻譯等

- **語言學習** 支援日語分詞及假名注音，支援AnkiConnect，支援Yomitan外掛

- **語音合成** 支援大量線上&離線語音合成引擎

- **語音識別** 在Windows 10和Windows 11上，可以使用Windows語音識別。

## 安裝方式

在 [LunaTranslator 文件- 下載 & 啟動 & 更新](https://docs.lunatranslator.org/zh/README.html) 進行下載安裝

## 在 LunaTranslator 接入 優特

LunaTranslator 支援接入本地部署的 優特。請使用您自己部署的 優特，或確認服務方具備合法上游授權和合規義務的 優特服務。不要將來源不明的 API 地址或金鑰接入生產環境。

### 一鍵配置

1. 在 優特控制檯的`系统设置`->`聊天设置`中，新增如下快捷選項：

   ```json
   { "LunaTranslator": "lunatranslator://llmapi/base64?data={cheryConfig}" }
   ```

   ![add_config](/apps-assets/luna_translator/add_config.webp)

2. 在 **`优特`** -> `控制台` -> `令牌管理` 選項卡中選擇要使用在 LunaTranslator 的令牌，點選聊天按鈕旁的下拉選項，選擇 `LunaTranslator`,將會跳轉到 LunaTranslator 並自動配置 API 地址與 API Key

   ![跳轉到 LunaTranslator](/apps-assets/luna_translator/jump_to_app.webp)

3. 在 **`LunaTranslator`** -> `设置` -> `翻译设置` -> `大模型` 中將出現一個新增的大模型介面配置，點選編輯

   ![設定api](/apps-assets/luna_translator/api_setting.webp)

4. 點選 **model** 下拉框旁的重新整理按鈕，獲取 優特平臺的模型列表，選擇或輸入模型名稱，完成後點選確定儲存

   ![設定模型](/apps-assets/luna_translator/setting_model.webp)

5. 檢查 **uter** 大模型介面配置旁邊的開關按鈕是否開啟，若未啟用則啟用介面即可開始使用

   ![開啟配置](/apps-assets/luna_translator/open_config.webp)

### 手動配置

1. 在 **`优特`** -> `控制台` -> `令牌管理` 選項卡中獲取 API Key

   ![獲取 API Key](/apps-assets/luna_translator/copy_api_key.webp)

2. 在 **`LunaTranslator`** -> `设置` - `翻译设置` -> `大模型` 中選擇新增

   ![新增 API](/apps-assets/luna_translator/add_api.webp)

3. 複製 **大模型通用介面** 模板，新增介面

   ![新增 API2](/apps-assets/luna_translator/add_api_2.webp)

4. 在 **新增的介面** 中，填寫對應的 API 地址和 API Key

   ![設定 API1](/apps-assets/luna_translator/setting_api.webp)

   ![設定 API2](/apps-assets/luna_translator/setting_api2.webp)

5. 點選 **model** 下拉框旁的重新整理按鈕，獲取 優特平臺的模型列表，選擇或輸入模型名稱，完成後點選確定儲存

   ![設定 API3](/apps-assets/luna_translator/setting_api3.webp)

6. 點選 **優特** 旁邊的開關按鈕，啟用介面即可開始使用

   ![開啟API](/apps-assets/luna_translator/open_api.webp)

更多使用方式請檢視 LunaTranslator 官方文件:[LunaTranslator 文件 - 大模型翻譯介面](https://docs.lunatranslator.org/zh/guochandamoxing.html)
