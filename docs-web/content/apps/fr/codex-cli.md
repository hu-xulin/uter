# OpenAI Codex CLI

> **Présentation du projet**
>
> Codex CLI est un agent de codage d'OpenAI qui s'exécute localement sur votre ordinateur.
>
>   - Site officiel : [https://chatgpt.com/codex](https://chatgpt.com/codex)
>   - Page du projet : [https://github.com/openai/codex](https://github.com/openai/codex)

## Démonstration

![introduce-01.webp](/apps-assets/codex/introduce-01.webp)

### Fonctionnalités

| Catégorie | Fonctionnalité |
| --- | --- |
| Assistant de codage en terminal | Codex CLI est un assistant de codage interactif en terminal pour éditer du code, générer des patchs et exécuter des commandes en ligne de commande. |
| Architecture pilotée par outils | Fournit des outils tels que `apply_patch`, `shell`, `update_plan` et `multi_tool_use` pour une modification contrôlée des fichiers et opérations du dépôt. |
| Édition de patch atomique | Utilise un format de patch spécialisé pour ajouter/mettre à jour/supprimer des fichiers de manière atomique via `apply_patch`, facilitant l'audit et le rollback. |
| Sandbox et approbation | Prend en charge les politiques de sandbox (par ex. `workspace-write`, `read-only`) et les modes d'approbation (`on-request`, `on-failure`, `never`) pour contrôler les permissions d'écriture et d'accès réseau. |
| Suivi de plan | `update_plan` est utilisé pour lister les étapes et suivre leur statut, ne nécessitant qu'une seule étape `in_progress` à la fois pour maintenir une progression claire. |
| Protocole d'interaction | Envoie de brèves explications introductives avant les opérations importantes, maintenant un ton amical et concis et fournissant des mises à jour de progression. |
| Contraintes de sécurité | Respecte des règles strictes (aucune modification arbitraire de fichiers non liés, aucun ajout d'en-têtes de copyright, aucune exécution de commandes destructrices), nécessitant l'approbation de l'utilisateur pour les opérations sensibles. |
| Tests et formatage | Recommande l'exécution des tests pertinents et des outils de formatage après les modifications, mais n'est pas responsable de la correction de problèmes non liés à la tâche courante. |
| Sortie et style | La sortie finale respecte les spécifications de rendu CLI (par ex. `**` pour les titres, backticks pour les chemins/commandes), maintenant une structure concise et scannable. |
| Exécution parallèle | Prend en charge l'exécution de plusieurs outils en parallèle via `multi_tool_use.parallel` pour améliorer l'efficacité. |

## Méthode de configuration du modèle IA

### Guide illustré Windows

#### 1. Ouvrir le terminal

![windows_open_terminal](/apps-assets/codex/windows_open_terminal.webp)

#### 2. Installer WSL

Pour des performances optimales sur Windows, veuillez installer et utiliser le Sous-système Windows pour Linux (WSL2).

> **Installer WSL2, redémarrer l'ordinateur Windows**
>
> ```powershell
>   wsl --install
>   ```
>
>   Redémarrez votre ordinateur Windows après l'installation.

> **Notes Windows**
>
> - Il est recommandé d'utiliser PowerShell plutôt que CMD.
>   - En cas de problème de permission, essayez de lancer en tant qu'administrateur.
>   - Certains logiciels antivirus peuvent signaler de faux positifs ; vous devez ajouter une exception.

![windows-img-03.webp](/apps-assets/codex/windows-img-03.webp)

> **Télécharger Node Version Manager (NVM)**
>
> ```bash
>   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
>   ```

![windows-img-04.webp](/apps-assets/codex/windows-img-04.webp)

> **NVM installe Node.js 22**
>
> Ouvrez une nouvelle fenêtre PowerShell dans la barre d'onglets et ouvrez WSL :
>
>   ```bash
>   wsl
>   ```
>
>   Installez Node.js (les numéros de version sont sensibles au temps ; veuillez installer la version correspondante selon les exigences du [site officiel OpenAI](https://developers.openai.com/codex/windows)) :
>
>   ```bash
>   nvm install 22
>   ```

![windows-img-05.webp](/apps-assets/codex/windows-img-05.webp)

#### 3. Installer Codex CLI

> **Installer Codex CLI**
>
> ```bash
>   npm i -g @openai/codex
>   ```
>
>   Cette commande téléchargera et installera la dernière version de Codex CLI depuis le dépôt npm officiel.

![windows-img-06.webp](/apps-assets/codex/windows-img-06.webp)

#### 4. Modifier le fichier de configuration

> **Modification en un clic du fichier de configuration Codex CLI**
>
> ```powershell
>   iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.ps1')
>   ```

![windows-configure](/apps-assets/codex/windows_configure.webp)

#### 5. Commencer à utiliser Codex CLI

Vous pouvez maintenant commencer à utiliser Codex CLI !

> **Lancer Codex CLI**
>
> Lancez WSL2 :
>
>   ```bash
>   wsl
>   ```
>
>   Lancez Codex CLI directement :
>
>   ```bash
>   codex
>   ```
>
>   Utiliser dans un projet spécifique :
>
>   ```bash
>   cd mnt/c/path/to/your/project
>   codex
>   ```
>
>   Appuyez sur Entrée pour lancer Codex CLI.

![windows-img-09.webp](/apps-assets/codex/windows-img-09.webp)

![windows-img-10.webp](/apps-assets/codex/windows-img-10.webp)

> Définissez les permissions Codex CLI : 1. Autoriser Codex à modifier les fichiers directement ; 2. Codex nécessite une autorisation manuelle pour modifier les fichiers.

> **Sélectionner un modèle**
>
> ```bash
>   /model
>   ```

![windows-img-11.webp](/apps-assets/codex/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/codex/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/codex/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/codex/windows-img-14.webp)

> Note : Après modification de l'adresse API, tous les modèles (y compris les modèles prédéfinis officiellement) appelleront le point d'accès configuré, légalement autorisé et appartenant à vous-même ou à votre organisation. Veuillez utiliser votre propre instance Uter déployée, ou confirmer que le fournisseur de services dispose d'un service Uter avec une autorisation amont légitime et des obligations de conformité. N'intégrez pas d'adresses API ou de clés provenant de sources inconnues dans un environnement de production.

### Guide illustré macOS

#### 1. Installer Homebrew (ignorer si déjà installé)

Homebrew est le gestionnaire de paquets manquant pour macOS.

Site officiel : https://brew.sh

![macos-img-01.webp](/apps-assets/codex/macos-img-01.webp)

> **Installer Homebrew**
>
> ```bash
>   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
>   ```

![macos-img-02.webp](/apps-assets/codex/macos-img-02.webp)

![macos-img-03.webp](/apps-assets/codex/macos-img-03.webp)

![macos-img-04.webp](/apps-assets/codex/macos-img-04.webp)

#### 2. Installer l'environnement Node.js

> **Étapes d'installation de l'environnement Node.js**
>
> Mettez à jour Homebrew :
>
>   ```bash
>   brew update
>   ```
>
>   Installez Node.js :
>
>   ```bash
>   brew install node
>   ```

> **Notes macOS**
>
> - En cas de problème de permission, vous devrez peut-être utiliser `sudo`.
>   - La première exécution peut nécessiter une permission dans les Préférences Système.
>   - Il est recommandé d'utiliser Terminal ou iTerm2.

![macos-img-05.webp](/apps-assets/codex/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/codex/macos-img-06.webp)

> **Vérifier la réussite de l'installation**
>
> Après l'installation, ouvrez le terminal et saisissez les commandes suivantes :
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Si des numéros de version s'affichent, l'installation a réussi.

#### 3. Installer Codex CLI

> **Installer Codex CLI**
>
> Ouvrez le terminal et exécutez la commande suivante :
>
>   ```bash
>   # Install Codex CLI globally
>   npm install -g @openai/codex
>   ```
>
>   En cas de problème de permission, vous pouvez utiliser sudo :
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![macos-img-07.webp](/apps-assets/codex/macos-img-07.webp)

> **Vérifier l'installation de Codex CLI**
>
> Après l'installation, saisissez la commande suivante pour vérifier si l'installation a réussi :
>
>   ```bash
>   codex --version
>   ```
>
>   Si un numéro de version s'affiche, félicitations ! Codex CLI a été installé avec succès.

#### 4. Modifier le fichier de configuration

> **Modification en un clic du fichier de configuration Codex CLI**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 5. Commencer à utiliser Codex CLI

Vous pouvez maintenant commencer à utiliser Codex CLI !

> **Lancer Codex CLI**
>
> Lancez Codex CLI directement :
>
>   ```bash
>   codex
>   ```
>
>   Utiliser dans un projet spécifique :
>
>   ```bash
>   cd /path/to/your/project
>   codex
>   ```
>
>   Appuyez sur Entrée pour lancer Codex CLI.

![macos-img-09.webp](/apps-assets/codex/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/codex/macos-img-10.webp)

> Définissez les permissions Codex CLI : 1. Autoriser Codex à modifier les fichiers directement ; 2. Codex nécessite une autorisation manuelle pour modifier les fichiers.

![macos-img-11.webp](/apps-assets/codex/macos-img-11.webp)

![macos-img-12.webp](/apps-assets/codex/macos-img-12.webp)

![macos-img-13.webp](/apps-assets/codex/macos-img-13.webp)

![macos-img-14.webp](/apps-assets/codex/macos-img-14.webp)

> Note : Après modification de l'adresse API, tous les modèles (y compris les modèles prédéfinis officiellement) appelleront le point d'accès configuré, légalement autorisé et appartenant à vous-même ou à votre organisation.

#### 6. Problèmes et solutions courants macOS

> **Erreur de permission lors de l'installation**
>
> Essayez les solutions suivantes :
>
>   - Installez avec `sudo` : `sudo npm install -g @openai/codex`
>   - Ou configurez `npm` pour utiliser le répertoire utilisateur : `npm config set prefix ~/.npm-global`

> **Les paramètres de sécurité macOS empêchent l'exécution**
>
> Si le système empêche Codex CLI de s'exécuter :
>
>   - Ouvrez « System Preferences » → « Security & Privacy »
>   - Cliquez sur « Open Anyway » ou « Allow »
>   - Ou exécutez dans le Terminal : `sudo spctl --master-disable`

### Guide illustré Linux

#### 1. Installer l'environnement Node.js

Codex CLI nécessite un environnement Node.js pour fonctionner.

> **Étapes d'installation de l'environnement Node.js**
>
> Ajoutez le dépôt NodeSource :
>
>   ```bash
>   sudo curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
>   ```
>
>   Installez Node.js :
>
>   ```bash
>   sudo apt-get install -y nodejs
>   ```

> **Notes Linux**
>
> - Certaines distributions peuvent nécessiter des dépendances supplémentaires.
>   - En cas de problème de permission, utilisez sudo.
>   - Assurez-vous que votre utilisateur dispose des permissions d'écriture dans le répertoire global de npm.

![linux-img-01.webp](/apps-assets/codex/linux-img-01.webp)

![linux-img-02.webp](/apps-assets/codex/linux-img-02.webp)

> **Vérifier la réussite de l'installation**
>
> Après l'installation, ouvrez le terminal et saisissez les commandes suivantes :
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Si des numéros de version s'affichent, l'installation a réussi.

#### 2. Installer Codex CLI

> **Installer Codex CLI**
>
> Ouvrez le terminal et exécutez la commande suivante :
>
>   ```bash
>   # Install Codex CLI globally
>   npm install -g @openai/codex
>   ```
>
>   En cas de problème de permission, vous pouvez utiliser sudo :
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![linux-img-03.webp](/apps-assets/codex/linux-img-03.webp)

> **Vérifier l'installation de Codex CLI**
>
> Après l'installation, saisissez la commande suivante pour vérifier si l'installation a réussi :
>
>   ```bash
>   codex --version
>   ```
>
>   Si un numéro de version s'affiche, félicitations ! Codex CLI a été installé avec succès.

#### 3. Modifier le fichier de configuration

> **Modification en un clic du fichier de configuration Codex CLI**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 4. Commencer à utiliser Codex CLI

Vous pouvez maintenant commencer à utiliser Codex CLI !

> **Lancer Codex CLI**
>
> Lancez Codex CLI directement :
>
>   ```bash
>   codex
>   ```
>
>   Utiliser dans un projet spécifique :
>
>   ```bash
>   # Enter your project directory
>   cd /path/to/your/project
>
>   # Launch Codex CLI
>   codex
>   ```
>
>   Appuyez sur Entrée pour lancer Codex CLI.

![linux-img-05.webp](/apps-assets/codex/linux-img-05.webp)

![linux-img-06.webp](/apps-assets/codex/linux-img-06.webp)

> Définissez les permissions Codex CLI : 1. Autoriser Codex à modifier les fichiers directement ; 2. Codex nécessite une autorisation manuelle pour modifier les fichiers.

![linux-img-07.webp](/apps-assets/codex/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/codex/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/codex/linux-img-09.webp)

![linux-img-10.webp](/apps-assets/codex/linux-img-10.webp)

> Note : Après modification de l'adresse API, tous les modèles (y compris les modèles prédéfinis officiellement) appelleront le point d'accès configuré, légalement autorisé et appartenant à vous-même ou à votre organisation.

#### 5. Problèmes et solutions courants Linux

> **Erreur de permission lors de l'installation**
>
> Essayez les solutions suivantes :
>
>   - Installez avec `sudo` : `sudo npm install -g @openai/codex`
>   - Ou configurez `npm` pour utiliser le répertoire utilisateur : `npm config set prefix ~/.npm-global`
>   - Ajoutez ensuite au PATH : `export PATH=~/.npm-global/bin:$PATH`

> **Bibliothèques de dépendances manquantes**
>
> Certaines distributions Linux nécessitent des dépendances supplémentaires :
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>   ```
>
>   ```bash
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```
