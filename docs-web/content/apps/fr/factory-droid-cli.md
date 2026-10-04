# Factory Droid CLI

> **Présentation du projet**
>
> Droid CLI est un outil en ligne de commande développé par Factory AI, conçu pour fonctionner comme un agent d'ingénierie logicielle IA. Il permet aux utilisateurs d'interagir avec divers grands modèles de langage via le terminal, de construire, déboguer et refactoriser du code, et même de créer des applications complètes.
>
>   - Site officiel : [https://factory.ai/product/cli](https://factory.ai/product/cli)
>   - Documentation officielle : [https://docs.factory.ai/cli/getting-started/quickstart](https://docs.factory.ai/cli/getting-started/quickstart)

## Démonstration

![droid.webp](/apps-assets/factory_droid_cli/droid_example.webp)

### Fonctionnalités

| Catégorie | Fonctionnalité | Valeur/Capacité | Exemple/Notes |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Démarrage rapide en CLI | Installation en 30 secondes ; lancez une session interactive droid dans le répertoire du projet ; prend en charge macOS/Linux et Windows | Intégration rapide aux projets actuels, aucun nouvel outil requis | Installation Windows : `irm https://app.factory.ai/cli/windows \| iex` ; Lancement : `droid` |
| Développement de fonctionnalités de bout en bout | Automatisation du processus complet de la planification à l'implémentation en passant par les tests ; processus de revue transparent | Accélérer la livraison, maintenir la supervision humaine | Visualisation et approbation de diff native (voir « Transparence et contrôle ») |
| Compréhension approfondie de la base de code | Intègre les connaissances partagées de l'organisation issues des bases de code, de la documentation, du suivi des tickets ; contextuel, s'améliore avec le temps | Suggestions et modifications plus précises | Tire continuellement parti des connaissances des dépôts et documents |
| Intégration aux systèmes d'ingénierie | Intégration native avec Jira, Notion, Slack et autres outils ; le travail de développement reste synchronisé avec les processus d'équipe | Réduire les changements d'outils et les silos d'information | « etc. » indique davantage d'intégrations |
| Automatisation de qualité production | Flux de travail réutilisables localement et en CI/CD ; sécurité et conformité de niveau entreprise intégrées | Cohérence et traçabilité | S'adapte aux pipelines et environnements d'entreprise |
| Capacités d'entreprise | Options de déploiement privé, conformité SOC-2, environnements isolés (air-gapped) | Répond aux exigences de sécurité et de conformité | Priorise la sécurité et la qualité |
| Enrichit les outils existants | Fonctionne dans le terminal, l'IDE et les environnements de développement existants ; pas besoin de changer d'éditeur ou d'apprendre de nouvelles interfaces | Conserve les habitudes de travail existantes, coût de migration faible | Intégration profonde avec les outils familiers |
| Transparence et contrôle | Chaque décision est visible et révisable ; supervision complète des modifications de code ; visualisation de diff et flux d'approbation natifs | Réduire les risques, renforcer la contrôlabilité | Aptitude à l'audit, traçable |
| Flexibilité des modèles | Non verrouillé sur un seul fournisseur IA ; choisissez le meilleur modèle par tâche ; comportement et mémoire organisationnels cohérents | Choix optimal entre performance et coût | Prend en charge le routage multi-modèles |
| Prochaines étapes et ressources | Quickstart, cas d'usage courants, intégration IDE, configuration, AGENTS.md | Facilite l'adoption et la pratique | Voir « Next steps/Additional resources » sur la page |

## Méthode de configuration du modèle IA

### Guide illustré Windows

#### 1. Ouvrir le terminal

![windows_open_terminal](/apps-assets/factory_droid_cli/windows_open_terminal.webp)

#### 2. Installer Factory Droid CLI

Commande d'installation officielle en un clic :

> **Commande d'installation en un clic**
>
> ```powershell
>   irm https://app.factory.ai/cli/windows | iex
>   ```

![windows-install](/apps-assets/factory_droid_cli/windows_install_droid.webp)

#### 3. Modifier le fichier de configuration

Droid CLI nécessite de modifier le fichier de configuration pour utiliser des API tierces.

![windows-configure.webp](/apps-assets/factory_droid_cli/factory_cli_setup_windows.webp)

> **Modifier les variables d'environnement**
>
> ```powershell
>   iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/factory-cli-setup.ps1')
>   ```

#### 4. Commencer à utiliser Droid CLI

Vous pouvez maintenant commencer à utiliser Droid CLI !

> **Lancer Droid CLI**
>
> Lancez Droid CLI directement :
>
>   ```bash
>   droid
>   ```
>
>   Utiliser dans un projet spécifique :
>
>   ```bash
>   # Navigate to your project directory
>   cd C:\path\to\your\project
>
>   # Launch Droid CLI
>   droid
>   ```
>
>   Appuyez sur Entrée pour lancer Droid CLI.

Droid CLI nécessite que les utilisateurs se connectent à un compte officiel (gratuit) avant utilisation.

#### 5. Solution des problèmes courants Windows

> Il s'agit généralement d'un problème de permission. Essayez les solutions suivantes :
>
>   - Exécutez PowerShell en tant qu'administrateur
>   - Ou configurez `npm` pour utiliser le répertoire utilisateur : `npm config set prefix %APPDATA%\npm`

> **Erreur de stratégie d'exécution PowerShell**
>
> Si vous rencontrez une restriction de stratégie d'exécution, exécutez :
>
>   ```powershell
>   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
>   ```

### Guide illustré macOS/Linux

#### 1. Installer Droid CLI

> **Installer Droid CLI**
>
> Ouvrez votre terminal et exécutez la commande suivante :
>
>   ```bash
>   curl -fsSL https://app.factory.ai/cli | sh
>   ```

![macos-open-terminal](/apps-assets/factory_droid_cli/macos_install_droid.webp)

![macos-img-02.webp](/apps-assets/factory_droid_cli/macos_install_droid_2.webp)

Suivez les invites d'installation pour modifier les variables d'environnement (copiez directement le code indiqué lors de l'installation) :

Pour Linux, choisissez `~/.bashrc` ou `~/.zshrc` selon le cas.

> **Variables d'environnement Droid CLI (exemple uniquement)**
>
> ```bash
>   echo 'export PATH=/Users/modify_here/.local/bin:$PATH' >> ~/.zshrc
>   source ~/.zshrc
>   ```

#### 2. Modifier le fichier de configuration

Droid CLI nécessite de modifier le fichier de configuration pour utiliser des API tierces.

> **Modification en un clic du fichier de configuration**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/factory-cli-setup.sh | bash
>   ```

![macos-img-03.webp](/apps-assets/factory_droid_cli/macos_configure.webp)

#### 3. Commencer à utiliser Droid CLI

Vous pouvez maintenant commencer à utiliser Droid CLI !

> **Lancer Droid CLI**
>
> Lancez Droid CLI directement :
>
>   ```bash
>   droid
>   ```
>
>   Utiliser dans un projet spécifique :
>
>   ```bash
>   # Navigate to your project directory
>   cd /path/to/your/project
>
>   # Launch Droid CLI
>   droid
>   ```
>
>   Appuyez sur Entrée pour lancer Droid CLI.

> Droid CLI nécessite que les utilisateurs se connectent à un compte officiel (gratuit) avant utilisation.
