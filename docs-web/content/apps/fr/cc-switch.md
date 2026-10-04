# CC Switch - Outil de gestion CLI IA tout-en-un

> **Option des paramètres de conversation**
>
> Dans la console Uter sous System Settings -> Chat Settings, vous pouvez ajouter le raccourci suivant pour activer le remplissage en un clic pour CC Switch depuis la page de gestion des jetons :

    ```json
    { "CC Switch": "ccswitch" }
    ```

> 🔀 CC Switch est un outil de gestion CLI IA open-source et multiplateforme tout-en-un. Il prend en charge le basculement de fournisseur en un clic pour Claude Code, Codex et Gemini CLI, la gestion unifiée des serveurs MCP, la gestion des invites système et la gestion des extensions Skills — vous permettant de basculer librement entre plusieurs assistants de codage IA sans éditer manuellement les fichiers de configuration.

- Dépôt GitHub : [https://github.com/farion1231/cc-switch](https://github.com/farion1231/cc-switch)
- Téléchargement : [GitHub Releases](https://github.com/farion1231/cc-switch/releases)

## Fonctionnalités clés

### 🔌 Gestion des fournisseurs

- **Basculement en un clic** — basculez instantanément entre les configurations API de Claude Code, Codex et Gemini, sans variables d'environnement manuelles ni édition de fichiers de configuration
- **Prise en charge multi-points de terminaison** — configurez plusieurs points de terminaison par fournisseur avec gestion des clés API et tests de latence
- **Configuration de modèles à 4 niveaux** — sélection granulaire des modèles sur les niveaux Haiku / Sonnet / Opus / Personnalisé

### 🛠️ Gestion des serveurs MCP

- **Gestion unifiée multi-applications** — gérez les serveurs MCP pour Claude / Codex / Gemini depuis un panneau unique
- **Trois types de transport** — prend en charge stdio, HTTP et SSE (Server-Sent Events)
- **Synchronisation automatique** — import/export unifié avec synchronisation bidirectionnelle

### 💬 Gestion des invites

- **Invites système multi-préréglages** — préréglages illimités avec basculement rapide
- **Prise en charge multi-applications** — Claude (`CLAUDE.md`), Codex (`AGENTS.md`), Gemini (`GEMINI.md`)
- **Éditeur Markdown** — CodeMirror 6 avec aperçu en direct

### 🌐 Prise en charge multiplateforme

- **Application de bureau** — installateurs natifs pour Windows, macOS et Linux
- **Version web** — interface accessible via navigateur pour serveurs headless / environnements SSH
- **Version CLI** — modes interactifs par menu et en ligne de commande

## Intégration Uter

CC Switch prend en charge le protocole de lien profond `ccswitch://`, permettant l'import de configuration de fournisseur en un clic depuis la page de gestion des jetons Uter.

### Étapes de configuration

1. **Sur la page de gestion des jetons Uter, cliquez sur le menu déroulant pour le jeton correspondant**
   Sélectionnez l'option **CC Switch** dans le menu. Le système lancera automatiquement CC Switch et ouvrira la boîte de dialogue de configuration.

2. **Complétez la configuration dans la boîte de dialogue**
   ![Boîte de dialogue de configuration CC Switch](/apps-assets/cc_switch/fill_dialog.webp)

   Descriptions des champs :
   - **Application** : basculez le type d'application en haut — **Claude** / **Codex** / **Gemini**, sélectionnez l'application cible selon vos besoins
   - **Nom** : saisissez un nom pour cette configuration (par ex. `My Claude`) pour l'identifier et basculer facilement plus tard dans CC Switch
   - **Modèle principal** (requis) — le modèle principal à utiliser par défaut
   - **Modèle Haiku** — modèle léger et rapide
   - **Modèle Sonnet** — modèle équilibré
   - **Modèle Opus** — modèle le plus performant

   Tous les modèles sont des sélections déroulantes ; les champs non sélectionnés affichent « Veuillez sélectionner un modèle ».

3. **Terminer**
   Cliquez sur **"Open CC Switch"** pour importer la configuration dans CC Switch et commencer à l'utiliser ; cliquez sur **"Cancel"** pour annuler.

## Installation

### macOS (Homebrew recommandé)

```shell
brew tap farion1231/ccswitch
brew install --cask cc-switch
```

### Windows

Téléchargez l'installateur `.msi` ou le `.zip` portable depuis [Releases](https://github.com/farion1231/cc-switch/releases).

### Linux

Téléchargez le paquet `.deb` ou l'.AppImage depuis [Releases](https://github.com/farion1231/cc-switch/releases).

Utilisateurs ArchLinux :

```shell
paru -S cc-switch-bin
```

### Version web (serveurs headless / SSH)

```shell
wget https://github.com/farion1231/cc-switch/releases/latest/download/cc-switch-web-linux-x64.tar.gz
tar -xzf cc-switch-web-linux-x64.tar.gz
cd cc-switch/
./cc-switch-web
```

Port par défaut `17666`, accessible via le navigateur à `http://localhost:17666`.

## Liens associés

- [Dépôt GitHub](https://github.com/farion1231/cc-switch)
- [Journal des modifications](https://github.com/farion1231/cc-switch/blob/main/CHANGELOG.md)
- [Dépôt de la version web](https://github.com/cp-yu/cc-switch-web)
- [Dépôt de la version CLI](https://github.com/thomas-jack/cc-switch-cli)
