# Claude Code

> **Présentation du projet**
>
> Libérez la puissance brute de Claude directement dans votre terminal. Recherchez des bases de code de plusieurs millions de lignes instantanément. Transformez des flux de travail de plusieurs heures en une seule commande. Vos outils. Votre flux de travail. Votre base de code, qui évolue à la vitesse de la pensée.
>
>   - Site officiel : [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)

## Démonstration

![introduce-01.webp](/apps-assets/claude_code/introduce-01.webp)

![introduce-02.webp](/apps-assets/claude_code/introduce-02.webp)

### Fonctionnalités

| **Catégorie** | **Fonctionnalité** |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Compréhension du code** | Analyse approfondie de la base de code, utilisant des agents intelligents pour rechercher et comprendre la structure et les dépendances du projet |
| | Génère automatiquement des aperçus de code de haut niveau, aidant rapidement les utilisateurs à comprendre la base de code |
| **Édition de code** | Prend en charge l'édition collaborative multi-fichiers, adaptée aux modifications de code complexes |
| | Fournit des suggestions de code pratiques et utilisables, conformes aux modèles et à l'architecture du projet |
| **Capacités d'intégration** | Prend en charge l'exécution directe dans le terminal, supprimant les changements de contexte |
| | Intégration transparente avec VS Code et les IDE JetBrains, sans copier-coller |
| **Génération et optimisation de code** | Génère automatiquement du code, crée des tests, corrige les bugs, prenant en charge le processus complet de la conception au commit |
| | Optimisé pour la génération et la compréhension de code, combinant des modèles avancés comme Claude Opus 4 |
| **Sécurité et flexibilité** | Les modifications nécessitent une autorisation explicite de l'utilisateur, garantissant des opérations de fichiers et de commandes plus sûres |
| | S'adapte aux normes de code de l'utilisateur, prend en charge des configurations personnalisées |
| **Intégration de la chaîne d'outils** | Prend en charge l'intégration avec des outils comme GitHub et GitLab pour réaliser des flux de travail automatisés |
| | S'intègre aux suites de tests et aux systèmes de build, améliorant les outils de développement existants |
| **Multiplateforme et extensibilité** | Prend en charge les systèmes d'exploitation Windows, macOS et Linux |
| | Configurable pour s'exécuter dans des SDK ou GitHub Actions, s'adaptant flexiblement à différents besoins |
| **Scénarios d'application clés** | Intégration et compréhension de la base de code, montée en compétence rapide pour les nouveaux membres |
| | Processus de correction et d'optimisation de problèmes de code, de l'analyse du problème à la soumission de PR |
| | Refactorisation du code du projet et implémentation de nouvelles fonctionnalités |
| **Points forts des retours utilisateurs** | Améliore l'efficacité de développement quotidien, économisant le temps passé aux tâches répétitives |
| | Excellente performance dans la gestion de tâches complexes multi-étapes, élargissant les possibilités de développement |

## Méthode de configuration du modèle IA

### Guide illustré Windows

#### 1. Installer l'environnement Node.js

Claude Code nécessite un environnement Node.js pour fonctionner.

> **Étapes d'installation de l'environnement Node.js**
>
> - Ouvrez votre navigateur et visitez https://nodejs.org/
>   - Cliquez sur la version « LTS » pour télécharger (version Long Term Support recommandée)
>   - Après le téléchargement, double-cliquez sur le fichier .msi
>   - Suivez l'assistant d'installation pour terminer l'installation, en conservant les paramètres par défaut

> **Notes Windows**
>
> - Il est recommandé d'utiliser PowerShell plutôt que CMD
>   - En cas de problème de permission, essayez de lancer en tant qu'administrateur
>   - Certains logiciels antivirus peuvent signaler de faux positifs ; vous devrez peut-être ajouter une exception

![windows-img-01.webp](/apps-assets/claude_code/windows-img-01.webp)

![windows-img-02.webp](/apps-assets/claude_code/windows-img-02.webp)

![windows-img-03.webp](/apps-assets/claude_code/windows-img-03.webp)

![windows-img-04.webp](/apps-assets/claude_code/windows-img-04.webp)

![windows-img-05.webp](/apps-assets/claude_code/windows-img-05.webp)

> **Vérifier la réussite de l'installation**
>
> Après l'installation, ouvrez PowerShell ou CMD et saisissez les commandes suivantes :
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Si des numéros de version s'affichent, l'installation a réussi.

#### 2. Installer Git Bash

> **Notes Windows**
>
> Dans un environnement Windows, Git Bash est requis pour installer Claude Code. Après l'installation, la configuration des variables d'environnement et l'utilisation de Claude Code se feront toujours dans PowerShell ou CMD classiques.

> **Télécharger et installer Git for Windows**
>
> - Visitez https://git-scm.com/downloads/win
>   - Cliquez sur « Download for Windows » pour télécharger l'installateur
>   - Exécutez le fichier d'installation .exe téléchargé
>   - Conservez les paramètres par défaut pendant l'installation, et cliquez sur « Next » pour terminer l'installation

![windows-img-06.webp](/apps-assets/claude_code/windows-img-06.webp)

![windows-img-07.webp](/apps-assets/claude_code/windows-img-07.webp)

![windows-img-08.webp](/apps-assets/claude_code/windows-img-08.webp)

> **Vérifier l'installation de Git Bash**
>
> Après l'installation, ouvrez Git Bash et saisissez la commande suivante pour vérifier :
>
>   ```bash
>   git --version
>   ```
>
>   Si un numéro de version s'affiche, l'installation a réussi.

#### 3. Installer Claude Code

> **Installer Claude Code**
>
> Ouvrez PowerShell et exécutez la commande suivante :
>
>   ```bash
>   npm install -g @anthropic-ai/claude-code
>   ```
>
>   Cette commande téléchargera et installera la dernière version de Claude Code depuis le dépôt npm officiel.

![windows-img-09.webp](/apps-assets/claude_code/windows-img-09.webp)

> **Ajouter ~/.local/bin au PATH (uniquement si demandé)**
>
> ```powershell
>   [Environment]::SetEnvironmentVariable('Path', ([Environment]::GetEnvironmentVariable('Path','User') + ";$HOME\.local\bin"), 'User')
>   ```

> **Vérifier l'installation de Claude Code**
>
> Après l'installation, saisissez la commande suivante pour vérifier si elle a été installée avec succès :
>
>   ```bash
>   claude --version
>   ```
>
>   Si un numéro de version s'affiche, félicitations ! Claude Code a été installé avec succès.

#### 4. Définir les variables d'environnement

> **Commande de configuration en un clic (système Windows)**
>
> Pour permettre à Claude Code de se connecter à votre service de relais, vous devez définir plusieurs variables d'environnement :

```powershell
iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.ps1')
```

![windows-configure](/apps-assets/claude_code/windows_configure.webp)

#### 5. Commencer à utiliser Claude Code

Vous pouvez maintenant commencer à utiliser Claude Code !

> **Lancer Claude Code**
>
> Ouvrez PowerShell et lancez Claude Code directement :
>
>   ```bash
>   claude
>   ```
>
>   Pour l'utiliser dans un projet spécifique :
>
>   ```bash
>   # Navigate to your project directory
>   cd C:\path\to\your\project
>
>   # Launch Claude Code
>   claude
>   ```

![windows-img-11.webp](/apps-assets/claude_code/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/claude_code/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/claude_code/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/claude_code/windows-img-14.webp)

![windows-img-15.webp](/apps-assets/claude_code/windows-img-15.webp)

> **Sélectionner un modèle**
>
> Saisissez la commande :
>
>   ```bash
>   /model
>   ```
>
>   Appuyez sur Entrée pour sélectionner un modèle ; généralement, les paramètres par défaut suffisent.

![windows-img-16.webp](/apps-assets/claude_code/windows-img-16.webp)

![windows-img-17.webp](/apps-assets/claude_code/windows-img-17.webp)

> Note : Après modification des variables d'environnement, tous les modèles (y compris les modèles prédéfinis officiellement) appelleront le point d'accès personnalisé au lieu d'utiliser les quotas du compte officiel.

### Guide illustré macOS

#### 1. Installer l'interface CLI Claude Code

Ouvrez le Terminal

![macos-img-01.webp](/apps-assets/claude_code/macos-img-01.webp)

> **Installer Claude Code**
>
> Ouvrez le Terminal et exécutez la commande suivante :
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   Facultatif : exécutez la commande fournie lorsque demandé
>
>   ```bash
>   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
>   ```

![macos-img-02.webp](/apps-assets/claude_code/macos-img-02.webp)

#### 2. Définir les variables d'environnement

Pour permettre à Claude Code de se connecter à un service de relais tiers, vous devez définir des variables d'environnement :

> **Configuration en un clic des variables d'environnement Claude Code**
>
> Saisissez la commande :
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

> **Vérifier l'installation de Claude Code**
>
> Après l'installation, saisissez la commande suivante pour vérifier si elle a été installée avec succès :
>
>   ```bash
>   claude --version
>   ```
>
>   Si un numéro de version s'affiche, félicitations ! Claude Code a été installé avec succès.

#### 3. Commencer à utiliser Claude Code

Vous pouvez maintenant commencer à utiliser Claude Code !

> **Lancer Claude Code**
>
> Lancez Claude Code directement :
>
>   ```bash
>   claude
>   ```
>
>   Pour l'utiliser dans un projet spécifique :
>
>   ```bash
>   # Navigate to your project directory
>   cd /path/to/your/project
>
>   # Launch Claude Code
>   claude
>   ```

![macos-img-04.webp](/apps-assets/claude_code/macos-img-04.webp)

![macos-img-05.webp](/apps-assets/claude_code/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/claude_code/macos-img-06.webp)

![macos-img-07.webp](/apps-assets/claude_code/macos-img-07.webp)

![macos-img-08.webp](/apps-assets/claude_code/macos-img-08.webp)

> **Sélectionner un modèle (facultatif)**
>
> Saisissez la commande :
>
>   ```bash
>   /model
>   ```
>
>   Appuyez sur Entrée pour sélectionner un modèle officiel ; généralement, le modèle par défaut suffit.

![macos-img-09.webp](/apps-assets/claude_code/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/claude_code/macos-img-10.webp)

![macos-img-11.webp](/apps-assets/claude_code/macos-img-11.webp)

> Note : Après modification de la variable d'environnement `ANTHROPIC_BASE_URL`, tous les modèles (y compris les modèles prédéfinis officiellement) appelleront le point d'accès personnalisé au lieu d'utiliser les quotas du compte officiel.

#### 4. Problèmes courants macOS

> **Paramètres de sécurité macOS empêchant l'exécution**
>
> Si le système empêche Claude Code de s'exécuter :
>
>   - Ouvrez « System Preferences » → « Security & Privacy »
>   - Cliquez sur « Open Anyway » ou « Allow »
>   - Ou exécutez dans le Terminal : `sudo spctl --master-disable`

### Guide illustré Linux

#### 1. Installer Claude Code

![linux-img-01.webp](/apps-assets/claude_code/linux-img-01.webp)

> **Installer Claude Code**
>
> Ouvrez le Terminal et exécutez la commande suivante :
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   Si vous rencontrez des problèmes de permission, vous pouvez utiliser sudo :
>
>   ```bash
>   sudo curl -fsSL https://claude.ai/install.sh | bash
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

> **Vérifier l'installation de Claude Code**
>
> Après l'installation, saisissez la commande suivante pour vérifier si elle a été installée avec succès :
>
>   ```bash
>   claude --version
>   ```
>
>   Si un numéro de version s'affiche, félicitations ! Claude Code a été installé avec succès.

#### 2. Définir les variables d'environnement

Pour permettre à Claude Code de se connecter à votre service de relais, vous devez définir deux variables d'environnement :

> **Modification en un clic des variables d'environnement**
>
> Saisissez la commande :
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

#### 3. Commencer à utiliser Claude Code

Vous pouvez maintenant commencer à utiliser Claude Code !

> **Lancer Claude Code**
>
> Lancez Claude Code directement :
>
>   ```bash
>   claude
>   ```
>
>   Pour l'utiliser dans un projet spécifique :
>
>   ```bash
>   # Navigate to your project directory
>   cd /path/to/your/project
>
>   # Launch Claude Code
>   claude
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

![linux-img-04.webp](/apps-assets/claude_code/linux-img-04.webp)

![linux-img-05.webp](/apps-assets/claude_code/linux-img-05.webp)

> **Sélectionner un modèle**
>
> Saisissez la commande :
>
>   ```bash
>   /model
>   ```
>
>   Appuyez sur Entrée pour sélectionner un modèle officiel ; généralement, le modèle par défaut suffit.

![linux-img-06.webp](/apps-assets/claude_code/linux-img-06.webp)

![linux-img-07.webp](/apps-assets/claude_code/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/claude_code/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/claude_code/linux-img-09.webp)

> Note : Après modification de la variable d'environnement `ANTHROPIC_BASE_URL`, tous les modèles (y compris les modèles prédéfinis officiellement) appelleront le point d'accès personnalisé au lieu d'utiliser les quotas du compte officiel.

#### 4. Problèmes courants Linux

> **Bibliothèques de dépendances manquantes**
>
> Certaines distributions Linux nécessitent l'installation de dépendances supplémentaires :
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```

> **Les variables d'environnement ne prennent pas effet**
>
> Vérifiez les points suivants :
>
>   - Confirmez que vous avez modifié le fichier de configuration correct (`.bashrc` ou `.zshrc`)
>   - Redémarrez le terminal ou exécutez `source ~/.bashrc`
>   - Vérifiez les paramètres : `echo $ANTHROPIC_BASE_URL`
