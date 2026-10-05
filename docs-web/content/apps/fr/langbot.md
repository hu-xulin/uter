# LangBot - Plateforme de développement de bots de messagerie instantanée

> LangBot est une plateforme open-source de développement de bots de messagerie instantanée qui
>   prend en charge diverses plateformes de messagerie instantanée telles que Feishu, DingTalk, WeChat,
>   QQ, Telegram, Discord, Slack, etc. Elle s'intègre aux principaux modèles IA
>   mondiaux, prend en charge diverses capacités d'applications IA comme la Base de connaissances,
>   l'Agent, le MCP, et est parfaitement compatible avec Uter.

- Site officiel : [https://langbot.app](https://langbot.app/)
- Adresse de téléchargement : [https://github.com/langbot-app/LangBot/releases](https://github.com/langbot-app/LangBot/releases)
- Documentation officielle : [https://docs.langbot.app](https://docs.langbot.app/)
- Adresse open-source : [https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot)

## Intégrer Uter

LangBot prend en charge l'intégration avec Uter déployé localement et les services Uter tiers construits à l'aide d'Uter.

### Utilisation

1.  Obtenir une clé API depuis Uter
    ![get-api-key](/apps-assets/langbot/get_api_key.webp)

        Si Uter est déployé localement, veuillez configurer vous-même l'adresse API (reportez-vous à [Connexion réseau des conteneurs](https://docs.langbot.app/en/workshop/network-details.html)). Si vous utilisez un service Uter tiers, vous pouvez copier l'adresse depuis la page. Notez que `/v1` doit être ajouté à l'adresse.

2.  Ajouter un modèle dans LangBot, sélectionner Uter comme fournisseur, et remplir la clé API et l'adresse API correspondantes
    ![add-uter-model](/apps-assets/langbot/add_newapi_model.webp)

3.  Sélectionner le modèle à utiliser dans le pipeline

    ![select-model](/apps-assets/langbot/select_model.webp)

4.  L'utiliser en discutant dans le débogage de conversation ou en discutant avec un bot lié au pipeline

    ![chat](/apps-assets/langbot/debug_chat.webp)

    ![wechat-chat](/apps-assets/langbot/wechat.webp)

    Pour le déploiement et la configuration des bots, veuillez consulter [Déployer des bots](https://docs.langbot.app/en/deploy/platforms/readme.html).

### Utilisation de la base de connaissances LangBot

LangBot prend en charge l'utilisation des modèles d'embedding d'Uter et les utilise comme modèles vectoriels pour la base de connaissances.

1. Ajouter un modèle d'embedding dans LangBot, sélectionner Uter comme fournisseur
   ![add-embedding-model](/apps-assets/langbot/add_embedding_model.webp)

2. Sélectionner le modèle d'embedding lors de la création d'une nouvelle base de connaissances
   ![use-embedding-model](/apps-assets/langbot/use_embedding_model.webp)

Pour plus d'instructions d'utilisation, veuillez consulter la documentation officielle de LangBot : [https://docs.langbot.app](https://docs.langbot.app/)
