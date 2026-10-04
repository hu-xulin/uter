# AionUi - Agent de bureau open-source gratuit

> 🚀 AionUi est un Cowork local, gratuit et open-source, prenant en charge divers agents IA tels que Gemini CLI, Claude Code, Codex, OpenCode, Qwen Code, Goose CLI, Auggie. Il fournit une interface GUI complète et une fonctionnalité d'accès distant WebUI, servant d'alternative open-source à Cowork.

- Site officiel : [https://www.aionui.com](https://www.aionui.com)
- Dépôt GitHub : [https://github.com/iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi)
- Lien de téléchargement : [https://github.com/iOfficeAI/AionUi/releases](https://github.com/iOfficeAI/AionUi/releases)

![Logo AionUi](/apps-assets/aionui/aionui-logo.webp)

## Fonctionnalités principales

### 💬 Chat multi-sessions

- **Multi-sessions + Contexte indépendant** - permet d'ouvrir plusieurs sessions de chat simultanément, chacune avec sa propre mémoire de contexte indépendante.
- **Stockage local** - toutes les données de conversation sont stockées localement dans une base de données SQLite et ne seront pas perdues.

### 🤖 Prise en charge multi-modèles

- **Prise en charge multiplateforme** - prend en charge les modèles grand public comme Gemini, OpenAI, Claude, Qwen, avec un basculement flexible.
- **Prise en charge des modèles locaux** - prend en charge le déploiement de modèles locaux via Ollama, LM Studio, etc.

### 🤝 Mode multi-agents

- **Exécuter plusieurs agents IA simultanément** - permet d'exécuter plusieurs agents IA en parallèle (par ex. Gemini CLI, Claude Code, Codex, OpenCode, Qwen Code, Goose CLI, Auggie, etc.).
- **Gestion MCP unifiée** - gestion et configuration unifiées de tous les agents via le Model Context Protocol (MCP), simplifiant l'exploitation.
- **Configuration de Skills** - prend en charge la configuration de Skills exclusives pour différents agents afin d'étendre leurs capacités.
- **Personnalisation de l'assistant** - prend en charge des configurations d'assistant personnalisées pour créer des flux de travail IA personnalisés.
- **Configuration indépendante** - chaque agent peut être configuré et utilisé indépendamment sans interférence.
- **Basculement flexible** - basculez de manière transparente entre différents agents pour répondre à divers besoins selon les scénarios.

### 🗂️ Gestion des fichiers

- **Navigation en arborescence + glisser-déposer** - parcourez les fichiers comme un dossier, prend en charge le glisser-déposer de fichiers ou dossiers pour un import en un clic.
- **Organisation intelligente** - l'IA peut aider à organiser les dossiers et à les catégoriser automatiquement.

### 📄 Panneau d'aperçu

- **Aperçu de plus de 9 formats** - prend en charge des formats comme PDF, Word, Excel, PPT, code, Markdown, images, etc.
- **Suivi en temps réel + modifiable** - suit automatiquement les modifications des fichiers, prend en charge l'édition et le débogage en temps réel de Markdown, code, HTML.

### 🎨 Génération et édition d'images par IA

- **Génération d'images intelligente** - prend en charge divers modèles de génération d'images tels que Gemini 2.5 Flash Image Preview, Nano, Banana, etc.
- **Reconnaissance et édition d'images** - fonctionnalités d'analyse et d'édition d'images pilotées par l'IA.

### 🌐 Accès multi-canaux

- **Accès distant WebUI** - accessible via le navigateur depuis n'importe quel appareil du réseau, prend en charge les appareils mobiles.
- **Intégration Telegram** - prend en charge l'interaction via des bots Telegram.
- **Intégration Feishu** - prend en charge l'accès et l'interaction via Feishu.
- **Sécurité des données locales** - toutes les données sont stockées dans une base de données SQLite locale, adaptée au déploiement sur serveur.

## Méthode d'intégration Uter

### Saisie des paramètres

Type de fournisseur : types pris en charge par Uter
Clé API : obtenue depuis Uter
Adresse API : adresse du site Uter (par ex. `https://<your-uter-domain>/v1`)

Veuillez utiliser votre propre instance Uter déployée, ou assurez-vous que le fournisseur de services propose des services Uter avec une autorisation amont légitime et des obligations de conformité. Ne connectez pas d'adresses API ou de clés provenant de sources inconnues à un environnement de production.

### Étapes de configuration

1.  **Copier la clé API dans Uter**
    ![Copier la clé API](/apps-assets/aionui/copy_apikey.webp)

2.  **Ouvrir les paramètres AionUi**
    - Accédez à la page des paramètres dans AionUi
    - Trouvez l'onglet Configuration du modèle
    - Cliquez sur « Add Model »
    ![Ouvrir les paramètres](/apps-assets/aionui/add-model-1.webp)

3.  **Ajouter un nouveau fournisseur**
    - Cliquez sur « Add Model »
    - Sélectionnez Uter
    ![Ajouter le fournisseur Uter](/apps-assets/aionui/uter_provider.webp)

4.  **Configurer les informations API**
    - Adresse API : saisissez l'adresse de votre site Uter (format : `https://<your-uter-domain>/v1`)
    - Clé API : collez la clé API copiée depuis la console Uter

5.  **Ajouter un modèle**
    - Sélectionnez le modèle à ajouter dans le menu déroulant
    - Le nom du modèle doit correspondre au nom du modèle configuré dans Uter
    - Sélectionnez le protocole de requête approprié

6.  **Commencer à utiliser**
    - Retournez à la page de conversation
    - Sélectionnez le modèle Uter configuré pour démarrer une conversation

## Liens associés

- [Dépôt GitHub](https://github.com/iOfficeAI/AionUi)
- [Guide d'utilisation complet](https://github.com/iOfficeAI/AionUi#-detailed-usage-guide)
- [FAQ Questions fréquentes](https://github.com/iOfficeAI/AionUi#-support--help)
