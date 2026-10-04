# OpenClaw - Plateforme d'assistant IA auto-hébergée

> **Présentation du projet**
>
> OpenClaw est une plateforme d'assistant IA personnelle open-source et auto-hébergée qui connecte
>   les applications de messagerie à des agents IA
>   exécutés sur votre propre matériel. Conçue pour les développeurs et les utilisateurs avancés, elle vous permet d'avoir un assistant IA autonome sans renoncer au contrôle de vos données.
>
>   - Page d'accueil officielle : [https://openclaw.ai](https://openclaw.ai)
>   - Documentation du projet : [https://docs.openclaw.ai](https://docs.openclaw.ai)
>   - GitHub : [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

OpenClaw est entièrement open-source. Vous pouvez parcourir le code source, soumettre des problèmes, ou contribuer sur [le dépôt GitHub d'OpenClaw](https://github.com/openclaw/openclaw). Ce tutoriel couvre les étapes complètes d'installation, de configuration et d'intégration d'OpenClaw avec Uter.

## 🌟 Fonctionnalités principales

### Intégration multi-canaux

- **Intégration multi-canaux** : prend en charge divers canaux de messagerie comme Telegram, Discord, WhatsApp, iMessage, et peut être étendu à davantage de plateformes via des plugins.
- **Passerelle unique** : gestion unifiée de tous les canaux via un processus de passerelle unique.
- **Prise en charge vocale** : prend en charge l'interaction vocale macOS/iOS/Android.
- **Interface Canvas** : peut afficher des interfaces Canvas interactives.

### Auto-hébergement et sécurité des données

- **Entièrement auto-hébergé** : s'exécute sur votre propre machine ou serveur.
- **Transparence open-source** : licence open-source MIT, code entièrement transparent.
- **Données locales** : le contexte et les compétences sont stockés sur votre ordinateur local, pas dans le cloud.

### Capacités d'agents intelligents

- **Fonctionnement continu** : prend en charge un fonctionnement en arrière-plan persistant avec mémoire à long terme.
- **Tâches planifiées** : prend en charge les tâches planifiées cron.
- **Isolation des sessions** : isole les sessions par agent/espace de travail/expéditeur.
- **Routage multi-agents** : prend en charge le travail collaboratif entre plusieurs agents.
- **Appel d'outils** : prise en charge native de l'appel d'outils et de l'exécution de code.

## 📦 Préparation avant l'intégration

> **Informations de préparation**
>
> - Node.js 22 ou supérieur
>   - Une adresse Uter disponible (se terminant généralement par `/v1`)
>   - Une clé API Uter disponible
>   - Veuillez utiliser votre propre Uter déployé, ou confirmer que le fournisseur de services dispose d'une autorisation en amont légitime et d'obligations de conformité pour son service Uter. Ne connectez pas des adresses API ou des clés inconnues à des environnements de production.

Avant d'intégrer Uter, il est recommandé de faire d'abord démarrer la passerelle et l'interface de contrôle selon le processus recommandé actuel d'OpenClaw. Cela facilite le diagnostic ultérieur pour distinguer si OpenClaw lui-même ne démarre pas ou si la configuration du fournisseur de modèles est incorrecte.

### 1. Installer OpenClaw (macOS/Linux)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Pour d'autres méthodes d'installation, reportez-vous à la documentation officielle d'OpenClaw : [Getting Started](https://docs.openclaw.ai/start/getting-started).

### 2. Exécuter l'assistant de configuration

```bash
openclaw onboard --install-daemon
```

Cet assistant accomplira l'authentification de base, la configuration de la passerelle, et l'initialisation optionnelle des canaux. L'objectif ici est de faire démarrer OpenClaw d'abord, puis de basculer le modèle par défaut vers Uter plus tard.

### 3. Vérifier la passerelle et l'interface de contrôle

```bash
openclaw gateway status
```

```bash
openclaw dashboard
```

Si le navigateur peut ouvrir l'interface de contrôle, cela signifie que le fonctionnement de base d'OpenClaw est normal. À ce stade, il n'est pas nécessaire de configurer Telegram, Discord, Feishu, ou d'autres canaux de messagerie.

### 4. Localiser le fichier de configuration

Le fichier de configuration d'OpenClaw se trouve généralement à `~/.openclaw/openclaw.json`. Vous pouvez continuer à le modifier en fonction de ce que l'assistant de configuration a généré.

> **Variables d'environnement liées aux chemins**
>
> Si vous exécutez OpenClaw sous un compte de service dédié, ou souhaitez personnaliser le répertoire de configuration/état, vous pouvez utiliser :
>
>   - `OPENCLAW_HOME`
>   - `OPENCLAW_STATE_DIR`
>   - `OPENCLAW_CONFIG_PATH`
>
>   Pour des instructions détaillées, voir la documentation officielle des variables d'environnement : [Environment Variables](https://docs.openclaw.ai/help/environment).

## 🚀 Utiliser Uter comme fournisseur de modèles

OpenClaw prend en charge l'intégration de passerelles de modèles personnalisées ou compatibles OpenAI via `models.providers`. Pour Uter, l'approche la plus courante consiste à l'ajouter comme fournisseur personnalisé à la configuration, puis à pointer le modèle par défaut vers `uter/model-ID`.

### Approche d'intégration

1. Déclarer un fournisseur `uter` sous `models.providers`.
2. Pointer `baseUrl` vers votre adresse Uter, en vous assurant qu'elle inclut `/v1`.
3. Définir `api` sur `openai-completions`.
4. Lister les ID de modèles que vous souhaitez qu'OpenClaw utilise dans `models`.
5. Basculer le modèle par défaut dans `agents.defaults.model.primary` vers `uter/...`.

### Pratique recommandée : stocker la clé API dans les variables d'environnement

Tout d'abord, fournissez votre clé Uter dans le shell actuel, l'environnement de service, ou un fichier `.env` lisible par OpenClaw :

```bash
export UTER_API_KEY="sk-your-uter-key"
```

Ensuite, ajoutez ou modifiez l'extrait suivant dans `openclaw.json` :

```json5
{
  models: {
    mode: "merge",
    providers: {
      uter: {
        baseUrl: "https://<your-uter-domain>/v1",
        apiKey: "${UTER_API_KEY}",
        api: "openai-completions",
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
          { id: "kimi-k2.5", name: "Kimi K2.5" },
        ],
      },
    },
  },

  agents: {
    defaults: {
      model: {
        primary: "uter/gemini-2.5-flash",
        fallbacks: ["uter/kimi-k2.5"],
      },
      models: {
        "uter/gemini-2.5-flash": { alias: "flash" },
        "uter/kimi-k2.5": { alias: "kimi" },
      },
    },
  },
}
```

Ce n'est pas une configuration complète à copier exactement, mais plutôt la partie la plus critique pour intégrer Uter. Tant que le `provider`, les ID de modèles et les références au modèle par défaut sont corrects, OpenClaw sera capable d'appeler vos ressources de modèles exposées via Uter.

### Détails clés de configuration

| Élément de configuration | Description |
| --- | --- |
| `models.mode` | Recommandé de définir sur `merge`, ajoutant `uter` tout en conservant les fournisseurs intégrés d'OpenClaw |
| `models.providers.uter.baseUrl` | Votre adresse Uter, doit généralement inclure `/v1` |
| `models.providers.uter.apiKey` | Clé Uter, recommandé de l'injecter via `${UTER_API_KEY}` |
| `models.providers.uter.api` | Pour les passerelles compatibles OpenAI comme Uter, utilisez `openai-completions` |
| `models.providers.uter.models` | Les ID de modèles listés ici doivent correspondre aux noms de modèles réellement exposés par votre Uter |
| `agents.defaults.model.primary` | Modèle principal par défaut, le format doit être `provider/model-id` |
| `agents.defaults.model.fallbacks` | Liste des modèles de secours, bascule automatiquement si le modèle principal échoue |
| `agents.defaults.models` | Optionnel, utilisé pour créer des alias pour les modèles, pratique pour les référencer dans l'interface ou les sessions |

### Vérifier le succès de l'intégration

Après avoir complété la configuration, retournez à l'interface de contrôle ou rouvrez-la :

```bash
openclaw dashboard
```

Si vous pouvez initier des conversations normalement dans OpenClaw et que le modèle par défaut est devenu `uter/...`, alors l'intégration est réussie. Vous pouvez également utiliser :

```bash
openclaw models list
```

pour confirmer que des modèles avec le préfixe `uter/` apparaissent dans la liste sélectionnable.

### Problèmes courants

- `baseUrl` sans `/v1` : c'est l'une des erreurs d'intégration les plus courantes.
- ID de modèle incorrect : `primary` et `fallbacks` doivent correspondre à l'`id` dans `models.providers.uter.models`.
- Clé API effective uniquement dans le terminal actuel : si la passerelle s'exécute comme service en arrière-plan, assurez-vous que le processus de service peut également lire `UTER_API_KEY`.
- Pour le dépannage en premier plan : utilisez la méthode d'exécution en premier plan officielle `openclaw gateway --port 18789` pour observer les journaux et les erreurs.
