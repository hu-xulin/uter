# Memoh - Plateforme d'agents IA conteneurisée

> Memoh est une plateforme d'agents IA open-source et auto-hébergée où chaque bot s'exécute dans
>   son propre conteneur isolé avec une mémoire persistante et un système de fichiers dédié.
>   Elle prend en charge 9 canaux incluant Telegram, Discord, Lark (Feishu), QQ, Matrix,
>   WeCom, WeChat, Email, et une interface Web intégrée, ainsi que l'appel d'outils MCP,
>   l'automatisation de navigateur, les tâches planifiées, et d'autres riches capacités d'agent.

- Site web : [https://memoh.sh](https://memoh.sh)
- Documentation : [https://docs.memoh.ai](https://docs.memoh.ai)
- GitHub : [https://github.com/memohai/Memoh](https://github.com/memohai/Memoh)

## Fonctionnalités clés

- **Isolation conteneurisée** : chaque bot s'exécute dans son propre conteneur containerd avec un système de fichiers et un réseau dédiés, prenant en charge les instantanés et l'import/export de données
- **Moteur de mémoire** : extraction de faits pilotée par LLM, recherche hybride (dense + creuse + BM25), chargement de contexte sur 24 heures, compaction et reconstruction de la mémoire
- **Prise en charge multi-canaux** : Telegram, Discord, Lark (Feishu), QQ, Matrix, WeCom, WeChat, Email, interface Web
- **Prise en charge MCP** : prise en charge complète du protocole MCP (HTTP / SSE / Stdio / OAuth), avec gestion de connexion MCP indépendante par bot
- **Automatisation de navigateur** : navigateur headless intégré propulsé par Playwright, prenant en charge la navigation web, le remplissage de formulaires, les captures d'écran, et plus encore
- **Tableau de bord Web** : interface de gestion moderne construite avec Vue 3 + Tailwind CSS, avec conversation en streaming, visualisation des appels d'outils, gestion de fichiers, et plus encore

## Installation rapide

Memoh est déployé via Docker. Installation en un clic (nécessite Docker) :

```bash
curl -fsSL https://memoh.sh | sudo sh
```

Ou installez manuellement :

```bash
git clone --depth 1 https://github.com/memohai/Memoh.git
cd Memoh
cp conf/app.docker.toml config.toml
# Modifiez le fichier de configuration config.toml
sudo docker compose up -d
```

Après le démarrage, visitez `http://localhost:8082`. Identifiants par défaut : `admin` / `admin123`.

## Intégration Uter

Memoh prend en charge n'importe quel fournisseur de modèles compatible OpenAI, vous permettant d'utiliser Uter pour gérer et accéder centralement à divers services de modèles IA.

### Étapes de configuration

#### Obtenir une clé API Uter

Après vous être inscrit et connecté à Uter, cliquez sur « Console » dans la barre de navigation supérieure, puis cliquez sur « Gestion des jetons », et cliquez sur le bouton « Ajouter un jeton » pour créer une clé Uter. Sélectionnez les permissions appropriées et cliquez sur « Créer ».

Une fois créée, cliquez sur le bouton de copie pour copier la clé API générée.

![copy-api-key](/apps-assets/memoh/copy_api_key.webp)

#### Ajouter un fournisseur de modèles dans Memoh

Connectez-vous au tableau de bord Web de Memoh, allez à la page de gestion des fournisseurs, et cliquez sur Uter.

![switch-to-uter-provider](/apps-assets/memoh/switch_to_newapi_provider.webp)

Remplissez les informations suivantes sur la page de configuration :

- **URL de base de l'API** : saisissez l'URL de point de terminaison Uter, par ex. `https://api.example.com/v1` (utilisez `http://localhost:3000/v1` pour les déploiements locaux)
- **Clé API** : collez la clé API copiée depuis Uter

Cliquez sur Enregistrer pour compléter la configuration du fournisseur.

#### Importer les modèles

Après avoir configuré le fournisseur, allez à la page de gestion des modèles et cliquez sur import automatique ou ajoutez manuellement les modèles dont vous avez besoin.

#### Configurer un modèle pour votre bot

Allez à la page des paramètres du bot, trouvez la section de configuration du modèle, basculez le modèle de conversation par défaut vers celui ajouté via le fournisseur Uter, et cliquez sur Enregistrer.

![set_chat_model](/apps-assets/memoh/set_chat_model.webp)

Vous avez maintenant configuré avec succès Uter comme fournisseur de modèles pour Memoh. Vous pouvez discuter avec des bots IA via n'importe quel canal de Memoh (Telegram, Discord, Lark, etc.), et toutes les requêtes seront routées via Uter.
