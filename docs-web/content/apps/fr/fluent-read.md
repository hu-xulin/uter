# FluentRead - Plugin de traduction open-source

> **Options des paramètres de conversation**
>
> Dans les Paramètres système -> Paramètres de conversation de la console Uter, vous pouvez ajouter
>   l'option de raccourci suivante pour un remplissage en un clic vers FluentRead sur
>   la page Gestion des jetons :

    ```json
    { "流畅阅读": "fluentread" }
    ```

> 🌊 FluentRead est un plugin de traduction pour navigateur open-source, dédié à
>   offrir une expérience de lecture quasi native.

- Adresse du projet : [https://github.com/Bistutu/FluentRead](https://github.com/Bistutu/FluentRead)

## 🌟 Fonctionnalités principales

### Moteur de traduction intelligent

- **Prise en charge multi-moteurs** : prend en charge plus de 20 moteurs de traduction
- **Traduction traditionnelle** : Microsoft Translate, Google Translate, DeepL Translate, etc.
- **Grands modèles IA** : OpenAI, DeepSeek, Kimi, Ollama, etc.
- **Moteur personnalisé** : prend en charge la configuration d'un service de traduction personnalisé

### Expérience de lecture immersive

- **Comparaison bilingue** : texte original et traduit affichés côte à côte pour une lecture facilitée
- **Traduction par sélection** : sélectionnez n'importe quel texte pour obtenir instantanément une traduction
- **Copie en un clic** : copiez rapidement le texte traduit pour améliorer l'efficacité de lecture
- **Traduction de la page entière** : traduction en un clic de toute la page web via un bouton flottant, sans rechargement de la page

### Confidentialité et personnalisation

- **Protection de la vie privée** : toutes les données sont stockées localement, code open-source et transparent
- **Haute personnalisation** : riches options de personnalisation pour répondre aux besoins de différents scénarios
- **Entièrement gratuit** : projet open-source et gratuit, non commercial

## 📦 Méthodes d'installation

| Navigateur   | Méthode d'installation                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Chrome**   | [Chrome Web Store](https://chromewebstore.google.com/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/djnlaiohfaaifbibleebjggkghlmcpcj?hl=zh-CN&authuser=0) \| [Miroir national](https://www.crxsoso.com/webstore/detail/djnlaiohfaaifbibleebjggkghlmcpcj) |
| **Edge**     | [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/kakgmllfpjldjhcnkghpplmlbnmcoflp?hl=zh-CN)                                                                                                 |
| **Firefox**  | [Firefox Add-ons Store](https://addons.mozilla.org/zh-CN/firefox/addon/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/)                                                                                                                                          |

## 🚀 Méthodes de configuration

### Importer la configuration depuis la console Uter (recommandé)

Une fois le plugin FluentRead installé dans votre navigateur, l'ouverture de la console Uter -> page Gestion des jetons affichera une invite pour ajouter FluentRead.

![add-hint](/apps-assets/fluentread/hint.webp)

Après avoir sélectionné un modèle, cliquez sur « Remplir en un clic vers FluentRead », et une fenêtre de confirmation s'affichera. Vérifiez que les informations correspondantes sont correctes.

![confirm](/apps-assets/fluentread/confirm.webp)

Après confirmation de l'import, la configuration Uter dans FluentRead sera activée.

![config-result](/apps-assets/fluentread/fluentread.webp)

### Remplir manuellement la configuration dans FluentRead

![manual-config](/apps-assets/fluentread/configuration.webp)

| Élément de configuration | Contenu                                       |
| ------------------------ | --------------------------------------------- |
| Service de traduction    | Uter                                          |
| Jeton d'accès            | Clé Uter                                      |
| Point de terminaison Uter | Adresse de déploiement Uter (sans /v1)       |
| Modèle                   | Sélectionner dans la liste, ou modèle personnalisé |
| Modèle personnalisé      | Nom du modèle                                 |
