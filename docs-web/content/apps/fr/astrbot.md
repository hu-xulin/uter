# AstrBot - Chatbot Agent

> AstrBot est une plateforme open-source de chatbot Agent tout-en-un qui intègre de manière transparente les capacités des grands modèles de langage dans les logiciels de messagerie instantanée grand public tels que QQ, Feishu, DingTalk et WeChat Work, créant une infrastructure de conversation IA fiable et extensible pour les particuliers, les développeurs et les équipes. Qu'il s'agisse d'un compagnon IA personnel, d'un service client intelligent, d'un assistant d'automatisation ou d'une base de connaissances d'entreprise, AstrBot peut rapidement construire des applications IA prêtes pour la production dans le flux de travail de votre plateforme de messagerie instantanée.

- Site officiel : [https://astrbot.app](https://astrbot.app)
- Documentation officielle : [https://docs.astrbot.app](https://docs.astrbot.app)
- Page du projet : [https://github.com/astrbotdevs/astrbot](https://github.com/astrbotdevs/astrbot)

## Méthode d'intégration Uter

AstrBot prend en charge l'intégration d'Uter comme fournisseur de modèles, permettant aux utilisateurs d'accéder et d'utiliser divers services de modèles IA via Uter.

### Étapes de configuration

#### Obtenir la clé API Uter

Après vous être inscrit et connecté à Uter, cliquez sur « Console » dans la barre de navigation supérieure, puis sur « Token Management », puis sur le bouton « Add Token » pour créer une clé Uter. Sélectionnez les permissions appropriées et cliquez sur « Create ».

![créer-clé-api](/apps-assets/astrbot/image.webp)

Après la création réussie, cliquez sur le bouton « Copy Key » pour copier la clé API générée.

![copier-clé-api](/apps-assets/astrbot/image-1.webp)

#### Configurer le fournisseur de services Uter dans AstrBot

Ouvrez le panneau d'administration AstrBot, accédez à la page « Model Providers », puis cliquez sur le bouton « Add Model Provider ».

Uter prend parfaitement en charge les interfaces OpenAI Chat Completion et Responses. Cliquez sur « OpenAI » pour accéder à la page de configuration du fournisseur OpenAI.

Dans la boîte de dialogue, définissez l'API Base URL sur l'adresse d'interface Uter. Veuillez utiliser votre propre instance Uter déployée, ou assurez-vous que le fournisseur de services dispose d'une autorisation amont légitime et d'obligations de conformité pour le service Uter. Si vous avez déployé Uter localement, renseignez l'adresse locale, par exemple `http://localhost:3000/v1`. Ne connectez pas d'adresses API ou de clés provenant de sources inconnues à un environnement de production.

Ensuite, saisissez la clé API dans le champ « API Key » et cliquez sur le bouton « Save ».

![config-fournisseur-astrbot](/apps-assets/astrbot/image-2.webp)

Cliquez ensuite sur « Save » pour terminer la configuration du fournisseur Uter.

#### Appliquer le fournisseur de services

Accédez à la page « Configuration File », trouvez la section « Model », modifiez le « Default Chat Model » pour le fournisseur Uter que vous venez de créer, et cliquez sur le bouton « Save ».

![appliquer](/apps-assets/astrbot/image-3.webp)

À ce stade, vous avez configuré Uter avec succès comme fournisseur de modèles d'AstrBot. Vous pouvez désormais accéder et utiliser les divers services de modèles IA fournis par Uter via AstrBot.
