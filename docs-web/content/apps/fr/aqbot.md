# AQBot - Établi de travail IA local-first pour bureau

> **Options des paramètres de conversation**
>
> Dans la console Uter, accédez à System Settings -> Chat Settings et ajoutez l'option de raccourci suivante. Elle permet aux utilisateurs de remplir AQBot depuis la page de gestion des jetons en un clic :

    ```json
    { "AQBot": "aqbot://providers?name=New%20API&baseurl={address}&apikey={key}&type=openai" }
    ```

> AQBot est un établi de travail IA open-source local-first (AGPL-3.0). Il unifie le chat multi-fournisseurs, les agents ACP, les bases de connaissances, les outils MCP et une passerelle API locale, tout en conservant les données de l'application et les fichiers utilisateur sur la machine.

- Site officiel : [https://app.aqbot.top](https://app.aqbot.top)
- GitHub : [https://github.com/AQBot-Desktop/AQBot](https://github.com/AQBot-Desktop/AQBot)
- Téléchargement : [GitHub Releases](https://github.com/AQBot-Desktop/AQBot/releases)
- Documentation officielle : [Getting Started](https://app.aqbot.top/guide/getting-started)

## Fonctionnalités principales

- **Chat multi-fournisseurs** — connectez OpenAI, Claude, Gemini, DeepSeek, Qwen et tout point de terminaison compatible OpenAI
- **Import de fournisseur** — importez un fournisseur depuis un lien `aqbot://` après confirmation
- **Gestion des modèles** — synchronisez les listes de modèles distants, les balises de capacité et les tests de latence
- **Agent** — Agent en conversation (utilise les API de fournisseur configurées) ainsi qu'un établi d'agents ACP
- **Données locales** — l'état de l'application réside dans `~/.aqbot/` ; les fichiers utilisateur dans `~/Documents/aqbot/`

Consultez le [site AQBot](https://app.aqbot.top) pour l'ensemble des fonctionnalités. Cette page ne couvre que l'intégration Uter.

## Méthode d'intégration Uter

Veuillez utiliser votre propre instance Uter déployée, ou assurez-vous que le fournisseur de services propose des services Uter avec une autorisation amont légitime et des obligations de conformité. Ne connectez pas d'adresses API ou de clés provenant de sources inconnues à un environnement de production.

### Méthode 1 : Import en un clic (recommandé)

1. Installez AQBot et ouvrez-le au moins une fois afin que le système enregistre le protocole `aqbot://`
2. Dans la console Uter, ajoutez le JSON ci-dessus sous **System Settings → Chat Settings**
3. Ouvrez **Token Management** et choisissez **AQBot** dans les actions du jeton
4. Le navigateur lance AQBot. Confirmez le nom du fournisseur, l'hôte API, le type `openai` et le préfixe de clé
5. Après confirmation, AQBot ouvre **Settings → Provider Management**. Il réutilise un fournisseur avec le même hôte API + type, ou en crée un nouveau
6. Ouvrez ce fournisseur, cliquez sur **Sync Models**, puis revenez à la conversation et sélectionnez un modèle

`{address}` est la racine du site Uter (par exemple `https://your-uter.example`), sans chaîne de requête. Pour le type OpenAI, AQBot ajoute `/v1` automatiquement. L'import ne valide pas la clé ni ne synchronise les modèles.

### Méthode 2 : Configuration manuelle

1. Copiez la clé API depuis la gestion des jetons Uter
2. Dans AQBot, accédez à **Settings → Provider Management → Add Provider**
3. Renseignez :

| Champ | Valeur |
| --- | --- |
| Nom du fournisseur | Par exemple `Uter` |
| Type de fournisseur | `OpenAI` (recommandé) |
| Hôte API | Adresse du site Uter, telle que `https://your-uter.example` |
| Clé API | Votre jeton Uter |

4. Cliquez sur **Sync Models** pour récupérer les modèles actuellement exposés par Uter
5. Revenez à la conversation et sélectionnez un modèle synchronisé

![Changer de modèle](/apps-assets/aqbot/switch-model.webp)

### Notes sur l'hôte API

- Privilégiez la racine du site et laissez AQBot ajouter `/v1`
- Si l'hôte se termine déjà par `/v1`, AQBot n'en ajoutera pas un autre
- Ajoutez un `!` final uniquement lorsque vous devez désactiver le complètement automatique

### Optionnel : Protocoles natifs

Si Uter expose également les API natives Claude ou Gemini, ajoutez un autre fournisseur :

| Usage | Type de fournisseur | Hôte API |
| --- | --- | --- |
| Chat Completions (par défaut) | OpenAI | Racine du site |
| Claude native `/v1/messages` | Anthropic | Racine du site |
| Gemini native | Gemini | Racine du site |

Modifiez `type` dans le modèle en un clic pour `anthropic` ou `gemini`. La même clé API peut servir plusieurs fournisseurs.

## FAQ

- **Cliquer sur AQBot n'ouvre pas l'application** : installez et lancez d'abord l'application de bureau. Ouvrir uniquement le site web ou un serveur de développement Vite n'enregistre pas `aqbot://`
- **L'import réussit mais le chat échoue** : cliquez sur **Sync Models** et assurez-vous que l'ID du modèle correspond au nom réellement exposé par Uter
- **macOS indique que l'application est endommagée ou que le développeur ne peut pas être vérifié** : suivez le [AQBot README](https://github.com/AQBot-Desktop/AQBot) et [Getting Started](https://app.aqbot.top/guide/getting-started) pour autoriser cette application. Vous n'avez pas besoin de désactiver Gatekeeper
- **Le lien en un clic contient une clé API** : générez-le uniquement sur la page de jeton connectée. Ne publiez pas d'URL contenant une clé réelle

## Liens associés

- [AQBot GitHub](https://github.com/AQBot-Desktop/AQBot)
- [Configurer les fournisseurs (docs officielles)](https://app.aqbot.top/guide/providers)
- [Téléchargement](https://github.com/AQBot-Desktop/AQBot/releases)
