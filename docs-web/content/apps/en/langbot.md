# LangBot - Instant Messaging Bot Development Platform

> LangBot is an open-source instant messaging bot development platform that
>   supports various instant messaging platforms such as Feishu, DingTalk, WeChat,
>   QQ, Telegram, Discord, Slack, etc. It integrates with mainstream global AI
>   models, supports various AI application capabilities like Knowledge Base,
>   Agent, MCP, and is perfectly compatible with URouters.

- Official Website: [https://langbot.app](https://langbot.app/)
- Download Address: [https://github.com/langbot-app/LangBot/releases](https://github.com/langbot-app/LangBot/releases)
- Official Documentation: [https://docs.langbot.app](https://docs.langbot.app/)
- Open Source Address: [https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot)

## Integrating URouters

LangBot supports integrating with locally deployed URouters and third-party URouters services built using URouters.

### Usage

1.  Obtain an API key from URouters
    ![获取 API key](/apps-assets/langbot/get_api_key.webp)

        If URouters is deployed locally, please configure the API address yourself (refer to [Container Network Connection](https://docs.langbot.app/en/workshop/network-details.html)). If using a third-party URouters service, you can copy the address from the page. Note that `/v1` needs to be appended to the address.

2.  Add a model in LangBot, select URouters as the provider, and fill in the corresponding API key and API address
    ![添加 URouters 模型](/apps-assets/langbot/add_newapi_model.webp)

3.  Select the model to use in the pipeline

    ![选择模型](/apps-assets/langbot/select_model.webp)

4.  Use it by chatting in conversation debugging or by chatting with a bot bound to the pipeline

    ![对话](/apps-assets/langbot/debug_chat.webp)

    ![微信对话](/apps-assets/langbot/wechat.webp)

    For deploying and configuring bots, please refer to [Deploying Bots](https://docs.langbot.app/en/deploy/platforms/readme.html).

### Using LangBot Knowledge Base

LangBot supports using URouters's embedding models and utilizing them as vector models for the knowledge base.

1. Add an embedding model in LangBot, select URouters as the provider
   ![添加嵌入模型](/apps-assets/langbot/add_embedding_model.webp)

2. Select the embedding model when creating a new knowledge base
   ![使用嵌入模型](/apps-assets/langbot/use_embedding_model.webp)

For more usage instructions, please refer to the LangBot official documentation: [https://docs.langbot.app](https://docs.langbot.app/)
