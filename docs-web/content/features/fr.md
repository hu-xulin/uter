# Description des fonctionnalités

1. 🎨 Interface UI entièrement nouvelle (certaines interfaces restent à mettre à jour)
2. 🌍 Prise en charge multilingue (à améliorer)
3. 🎨 Ajout de la prise en charge de l'API [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) (Avant utilisation, veuillez confirmer l'autorisation du projet tiers et du service amont, la sécurité du contenu et les conditions de service)
4. 💰 Prend en charge le solde interne, la répartition des coûts ou la gestion de compte client entreprise dans des déploiements légalement autorisés, configurable dans les paramètres système :
   - [x] Epay
5. 🔍 Prend en charge la consultation des informations d'utilisation ou de solde des canaux légalement autorisés
6. 📑 La pagination prend en charge la sélection du nombre d'éléments affichés par page
7. 🔄 Prend en charge le stockage en base de données SQLite, prêt à l'emploi, léger et pratique
8. 💵 Prend en charge la comptabilité analytique interne ou la facturation client entreprise, configurable dans Paramètres système - Paramètres d'exploitation
9. ⚖️ Prend en charge la **sélection aléatoire pondérée** des canaux
10. 📈 Tableau de bord des données (Console)
11. 🔒 Peut définir les modèles qu'un token peut appeler
12. 🤖 Prend en charge la connexion autorisée Telegram
13. 🎵 Ajout de la prise en charge de l'API [Suno API](https://github.com/Suno-API/Suno-API) (Avant utilisation, veuillez confirmer l'autorisation du projet tiers et du service amont, la sécurité du contenu et les conditions de service)
14. 🔄 Prend en charge les modèles Rerank, actuellement compatibles avec Cohere et Jina, et pouvant être intégrés avec Dify
15. ⚡ **[OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime/integration)** - Prend en charge l'API Realtime d'OpenAI, prend en charge les canaux Azure
16. Prend en charge l'utilisation de la route /chat2link pour accéder à l'interface de chat
17. 🧠 Prend en charge le réglage de l'effort de raisonnement via le suffixe du nom du modèle :
    1. Modèles de la série OpenAI o
       - Ajouter le suffixe `-high` pour définir un effort de raisonnement élevé (par exemple, `o3-mini-high`)
       - Ajouter le suffixe `-medium` pour définir un effort de raisonnement moyen (par exemple, `o3-mini-medium`)
       - Ajouter le suffixe `-low` pour définir un effort de raisonnement faible (par exemple, `o3-mini-low`)
    2. Modèles de réflexion Claude
       - Ajouter le suffixe `-thinking` pour activer le mode de réflexion (par exemple, `claude-3-7-sonnet-20250219-thinking`)
18. 🔄 Thinking to Content : Prend en charge le réglage de l'option `thinking_to_content` dans `Channel - Edit - Channel Extra Settings`. Par défaut, la valeur est `false`. Lorsqu'elle est activée, elle convertit le contenu de réflexion `reasoning_content` en une balise `<think>` et l'ajoute au contenu renvoyé.
19. 🔄 Limitation de débit des modèles : Prend en charge le réglage de la limitation de débit des modèles dans `System Settings - Rate Limit Settings`, incluant la limite totale de requêtes et la limite de requêtes réussies.
20. 💰 Prise en charge de la facturation par cache : Lorsqu'elle est activée, la facturation peut être effectuée selon le ratio défini en cas de succès du cache :
    1. Définir l'option `Prompt Cache Ratio` dans `System Settings - Operations Settings`.
    2. Définir le `Prompt Cache Ratio` dans le canal, plage 0-1. Par exemple, le régler sur 0.5 signifie une facturation à 50 % en cas de succès du cache.
    3. Canaux pris en charge :
    - [x] OpenAI
    - [x] Azure
    - [x] DeepSeek
    - [x] Claude
