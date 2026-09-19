# AstrBot - Agent Chatbot

> AstrBot is an open-source, all-in-one Agent chatbot platform that seamlessly integrates large language model capabilities into mainstream instant messaging software such as QQ, Feishu, DingTalk, and WeChat Work, creating a reliable and scalable conversational AI infrastructure for individuals, developers, and teams. Whether it's a personal AI companion, intelligent customer service, automation assistant, or enterprise knowledge base, AstrBot can quickly build production-ready AI applications within your instant messaging platform's workflow.

- Official Website: [https://astrbot.app](https://astrbot.app)
- Official Documentation: [https://docs.astrbot.app](https://docs.astrbot.app)
- Project Homepage: [https://github.com/astrbotdevs/astrbot](https://github.com/astrbotdevs/astrbot)

## URouters Integration Method

AstrBot supports integrating URouters as a model provider, allowing users to access and utilize various AI model services through URouters.

### Configuration Steps

#### Obtain URouters API Key

After registering and logging into URouters, click 'Console' in the top navigation bar, then click 'Token Management', and then click the 'Add Token' button to create a new API Key. Select the appropriate permissions and click 'Create'.

![create-api-key](/apps-assets/astrbot/image.webp)

After successful creation, click the 'Copy Key' button to copy the generated API Key.

![copy-api-key](/apps-assets/astrbot/image-1.webp)

#### Configure URouters Service Provider in AstrBot

Open the AstrBot administration panel, go to the 'Model Providers' page, then click the 'Add Model Provider' button.

URouters perfectly supports OpenAI Chat Completion and Responses interfaces. Click 'OpenAI' to enter the OpenAI provider configuration page.

In the pop-up dialog, set the API Base URL to the URouters interface address. Please use your own deployed URouters, or ensure that the service provider has legitimate upstream authorization and compliance obligations for the URouters service. If you have deployed URouters locally, fill in the local address, for example, `http://localhost:3000/v1`. Do not connect API addresses or keys from unknown sources to a production environment.

Then, enter the API Key into the 'API Key' field and click the 'Save' button.

![astrbot-provider-config](/apps-assets/astrbot/image-2.webp)

Then click 'Save' to complete the URouters provider configuration.

#### Apply Service Provider

Go to the 'Configuration File' page, find the 'Model' section, change the 'Default Chat Model' to the URouters provider you just created, and click the 'Save' button.

![apply](/apps-assets/astrbot/image-3.webp)

At this point, you have successfully configured URouters as AstrBot's model provider. Now, you can access and use various AI model services provided by URouters through AstrBot.
