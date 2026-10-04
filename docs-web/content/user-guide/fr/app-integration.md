# Intégration des applications de conversation

* Uter permet d’importer rapidement des configurations dans diverses applications de conversation IA, facilitant les tests et l’usage quotidien.

## Méthodes d’intégration de conversation

* Uter propose trois méthodes d’intégration de conversation :

1. **Import en un clic des préréglages de conversation**
2. **Import en un clic des configurations de clé API**
3. **Configuration manuelle des applications de conversation**

### Préparation avant utilisation

1. Connectez-vous à Uter et créez une clé sur la page 'API Key'.
2. Assurez-vous que la clé est activée, qu’elle dispose d’un quota suffisant, qu’elle n’est pas expirée et que les restrictions actuelles d’IP, de groupe et de modèle autorisent l’appel.

<Callout type="info">
  **Pour les étapes détaillées de création et d’utilisation des clés API, veuillez consulter la page [Clé API](../api-keys/).**
</Callout>

### Import en un clic des préréglages de conversation

1. Cliquez sur 'Chat' dans la barre latérale gauche pour développer les préréglages de conversation configurés sur la plateforme.
2. Cliquez sur le préréglage de conversation cible.
3. Le navigateur tentera de lancer l’application externe installée dans une nouvelle fenêtre.
4. Le système redirige automatiquement vers l’application cible et pré-remplit les informations de configuration.

<img alt="Page d’import de configuration des préréglages de conversation" src="01-chat-presets-configuration-import.webp" />

<Callout type="info">
  Les utilisateurs Root peuvent maintenir et gérer les préréglages de conversation dans 'System Settings' → 'Console Content' → 'Chat'.
</Callout>

### Import en un clic des configurations de clé API

1. Cliquez pour accéder à 'API Key' dans la barre latérale gauche.
2. Sélectionnez la clé API à utiliser.
3. À côté de la clé sélectionnée, cliquez sur '...' → 'Chat' → 'Target Chat Application'.
4. Redirigez-vous rapidement vers l’application correspondante et utilisez la clé sélectionnée pour importer la configuration en un clic.

<img alt="Page d’import de configuration des clés API en un clic" src="02-api-key-configuration-import.webp" />

### Configurer manuellement les applications de conversation

Pour les applications qui ne prennent pas en charge l’import en un clic, vous pouvez les configurer manuellement :

* Obtenez les informations de configuration suivantes auprès d’Uter :

| Élément de configuration | Description                     | Lieu d’obtention                                                             |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------- |
| URL de base de l’API | Adresse du point de terminaison API | Adresse Uter, par ex. `https://api.example.com/v1`                             |
| Clé API            | Clé API                  | Page Clé API                                                                    |
| Modèles disponibles | Liste des modèles pris en charge | Filtrer et consulter les modèles disponibles sous le groupe de la clé dans la Place de marché des modèles |

* Étapes de configuration générale

1. Dans l’application cible, recherchez l’entrée 'Settings' ou 'Configuration'.
2. Repérez la zone de configuration 'Custom API' ou 'OpenAI Compatible Interface'.
3. Renseignez l’URL de base de l’API et la clé API.
4. Enregistrez la configuration pour commencer à l’utiliser.

<Callout type="info">
  1) La plupart des applications prenant en charge les interfaces compatibles avec l’API OpenAI peuvent s’intégrer à Uter en renseignant une adresse d’API personnalisée.
  2) Si l’application exige un point de terminaison complet, utilisez `https://api.example.com/v1/chat/completions` ; reportez-vous aux instructions de configuration spécifiques de l’application pour compléter le chemin.
  3) **La plupart des applications IA grand public peuvent être connectées via l’API personnalisée décrite ci-dessus ; suivez le guide de configuration propre à chaque application.**
</Callout>

## Foire aux questions

* **Aucun préréglage de conversation dans la barre latérale** : vérifiez que le module 'Chat' est activé dans 'Profile' → 'Left Sidebar Personal Settings'.
* **Aucun message indiquant qu’une clé est disponible** : créez ou activez une clé API et vérifiez le quota, l’heure d’expiration, les restrictions de modèles et la liste blanche d’IP.
* **L’application de bureau ne se lance pas** : installez d’abord l’application cible et vérifiez que le système d’exploitation a enregistré le protocole personnalisé correspondant ; le navigateur peut également demander une confirmation pour ouvrir une application externe.
* **Préréglage web vide ou refusé au chargement** : le site cible interdit peut-être les iframes via CSP ou `X-Frame-Options`. Dans ce cas, passez à la configuration manuelle pour cette application.
* **Clé FluentRead invalide après connexion** : vérifiez que l’extension est installée et active sur la page actuelle ; la version actuelle peut présenter des différences de compatibilité pour le préfixe de clé, si cela échoue toujours, passez à la configuration manuelle ou à un autre préréglage.
* **La requête renvoie un accès non autorisé ou interdit** : vérifiez le format de l’en-tête d’authentification, le nom du modèle, le statut de la clé, les autorisations du groupe et les restrictions d’IP ; pour les requêtes Claude et Gemini, vérifiez également que les chemins et les en-têtes de requête corrects sont utilisés.