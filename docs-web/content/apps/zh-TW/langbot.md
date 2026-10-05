# LangBot - 即時通訊機器人開發平臺

> LangBot
>   是一個開源的即時通訊機器人開發平臺，支援多種即時通訊平臺，如飛書、釘釘、微信、QQ、Telegram、Discord、Slack
>   等。接入全球主流的 AI 模型，支援知識庫、Agent、MCP等多種 AI
>   應用能力，並完美適配 優特。

- 官網地址：[https://langbot.app](https://langbot.app/)
- 下載地址：[https://github.com/langbot-app/LangBot/releases](https://github.com/langbot-app/LangBot/releases)
- 官方文件：[https://docs.langbot.app](https://docs.langbot.app/)
- 開源地址：[https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot)

## 接入 優特

LangBot 支援接入本地部署的 優特和第三方使用 優特搭建的 優特服務。

### 使用方式

1.  從 優特中獲取 API key
    ![獲取 API key](/apps-assets/langbot/get_api_key.webp)

        若是本地部署的 優特請自行配置 API 地址（可參考[容器網路連線](https://docs.langbot.app/zh/workshop/network-details.html)），若使用第三方 優特服務，可在頁面上覆制地址。注意，地址後需要新增`/v1`。

2.  在 LangBot 中新增模型，選擇使用 優特供應商，填寫對應的 API key 和 API 地址
    ![新增 優特模型](/apps-assets/langbot/add_newapi_model.webp)

3.  在流水線中選擇使用模型

    ![選擇模型](/apps-assets/langbot/select_model.webp)

4.  在對話除錯中對話或與繫結至流水線的機器人對話即可使用

    ![對話](/apps-assets/langbot/debug_chat.webp)

    ![微信對話](/apps-assets/langbot/wechat.webp)

    部署配置機器人請參考[部署機器人](https://docs.langbot.app/zh/deploy/platforms/readme.html)。

### 使用 LangBot 知識庫

LangBot 支援使用 優特的嵌入模型，並將其作為知識庫的向量模型。

1. 在 LangBot 中新增嵌入模型，選擇使用 優特供應商
   ![新增嵌入模型](/apps-assets/langbot/add_embedding_model.webp)

2. 在新建知識庫時選用嵌入模型
   ![使用嵌入模型](/apps-assets/langbot/use_embedding_model.webp)

更多使用方式請檢視 LangBot 官方文件：[https://docs.langbot.app](https://docs.langbot.app/)
