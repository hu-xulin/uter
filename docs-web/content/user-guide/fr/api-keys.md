# Clés API

Cliquez sur 'API Keys' dans la navigation de gauche, ou rendez-vous directement sur `/keys`. La page affiche des informations telles que le nom de la clé, la clé masquée, le statut d’activation, l’utilisation du quota et le groupe, et prend en charge le filtrage, la copie, la modification, l’activation/désactivation et la suppression par lot. Le menu de la ligne permet également de copier les informations de connexion, d’ouvrir les préréglages de conversation configurés par l’administrateur et d’envoyer la clé aux intégrations client prises en charge.

<img alt="Page d’informations sur les clés API" src="01-keys-info.webp" />

## Créer des clés API

1. Ouvrez 'API Keys' et cliquez sur 'Create API Key'.
2. Renseignez le nom de la clé afin de distinguer facilement les applications ou les environnements.
3. Définissez le quota, l’heure d’expiration, les restrictions de modèles, les restrictions d’IP et les groupes selon vos besoins.
4. Après l’enregistrement, consultez la clé complète dans la liste et copiez-la.

<img alt="Page de création de clé API" src="02-create-key.webp" />

### Description des paramètres de configuration

| Paramètre                      | Fonction                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Nom                            | Nom de la clé API (il est recommandé de nommer selon l’usage, par ex. « Environnement de production », « Usage de test »)           |
| Groupe                         | Spécifie le groupe de canaux utilisé par ce jeton                                                                                          |
| Ordre du groupe automatique    | Affiché uniquement lorsque le groupe est `auto` ; peut hériter de l’ordre global du Root, ou définir un ordre au niveau de la clé         |
| Commutation de nouvelle tentative inter-groupe | Lorsque cette option est activée, si le canal du groupe actuel échoue, le système tentera le canal du groupe suivant dans l’ordre. |
| Heure d’expiration             | Refuse l’utilisation de cette clé après l’expiration                                                                                       |
| Quantité                       | Plusieurs clés API peuvent être créées en une seule fois (un suffixe aléatoire est ajouté au nom)                                          |
| Quota                          | Restreint le quota que cette clé peut consommer                                                                                            |
| Commutation de quota illimité  | Active un quota illimité pour cette clé API lorsqu’elle est activée                                                                        |
| Restrictions de modèles        | Restreint ce jeton à n’appeler que les modèles spécifiés ; laissez vide pour aucune restriction                                              |
| Liste blanche d’IP             | Permet de saisir des IP ou des CIDR ligne par ligne ; laissez vide pour aucune restriction ; à utiliser avec des proxys inverses/CDN de confiance |

<Callout type="warn">
  Les clés API sont équivalentes à des mots de passe. Ne soumettez jamais la clé complète à des dépôts de code, des captures d’écran, des journaux ou des outils de discussion ; si vous suspectez une fuite, supprimez immédiatement la clé et créez-en une nouvelle.
</Callout>

## Consulter et copier les clés API

Dans la liste des clés API, cliquez sur la clé masquée pour consulter et copier la valeur complète, comme indiqué sur la page. La clé complète est un identifiant sensible et sa consultation peut nécessiter une vérification de sécurité supplémentaire.

'Copy Connection Info' copie la clé et l’adresse de la plateforme en tant qu’informations d’import pour l’application ; cliquez sur l’application de conversation cible du préréglage 'Chat' dans la barre latérale gauche, et le navigateur tentera de lancer l’application de conversation installée et redirigera automatiquement pour remplir les informations de configuration.

<img alt="Page de consultation des clés API" src="03-view-key.webp" />

## Modifier les clés API

Dans la liste des clés API, repérez la clé cible, puis cliquez sur le bouton 'Edit' à droite pour modifier les options de configuration de la clé (à l’exclusion de la clé API elle-même).

<img alt="Page de modification des clés API" src="04-edit-key.webp" />

## Activer, désactiver et supprimer des clés API

Vous pouvez activer, désactiver ou supprimer des clés dans les opérations de ligne de la liste ; plusieurs lignes peuvent être sélectionnées pour une suppression par lot. La désactivation conserve la configuration et interrompt les appels, tandis que la suppression est irréversible.

<img alt="Page de suppression des clés API" src="05-delete-key.webp" />

<Callout type="warn">
  Après confirmation de la suppression, la clé API devient immédiatement invalide et ne peut pas être récupérée. Avant de supprimer, veuillez confirmer la clé sélectionnée afin d’éviter de supprimer accidentellement des clés de production.
</Callout>