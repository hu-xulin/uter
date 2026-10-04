# Journaux et tâches asynchrones

* Uter enregistre séparément les détails des requêtes, les relevés de dessin et les tâches asynchrones telles que la vidéo et la musique.
* Après connexion, vous pouvez accéder aux "Journaux d’utilisation" ou aux "Journaux de tâches" depuis la navigation de gauche.
* Cette page explique uniformément les trois partitions de données, les statuts des tâches et les méthodes de requête via l’API.

Les trois partitions correspondent aux chemins suivants :

* `/usage-logs/common` : journaux d’utilisation généraux de l’API et détails de facturation ;
* `/usage-logs/drawing` : tâches de dessin Midjourney ;
* `/usage-logs/task` : tâches asynchrones générales comme Suno et la vidéo.

<Callout type="info">
  Les utilisateurs ordinaires ne peuvent consulter que leurs propres enregistrements. Les utilisateurs Admin et Root peuvent basculer entre "Tous" et "Uniquement les miens" dans le coin supérieur droit de la page ; lorsqu’on bascule sur "Uniquement les miens", la page renvoie les données selon les champs et les permissions de l’utilisateur ordinaire.
</Callout>

## Journaux d’utilisation

* Cliquez sur "Journaux d’utilisation" dans la barre latérale gauche ou rendez-vous sur `/usage-logs/common` pour consulter les requêtes API et les détails de facturation.

### Filtrer les enregistrements

Les options de filtre disponibles pour les requêtes du journal d’utilisation sont les suivantes :

| Option de filtre                   | Description                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Période                     | Filtrer par heure de création de l’enregistrement, l’heure de début et l’heure de fin étant toutes deux incluses dans la plage requête. |
| Nom du modèle               | Filtrer par nom de modèle.                                                                           |
| Groupe                      | Filtrer par le groupe utilisé dans la requête.                                                        |
| Type de journal             | Tous les types, Recharge, Consommation, Gestion, Système, Erreur, Remboursement, Connexion.                     |
| Nom de la clé API                 | Filtrer par nom de clé API.                                                                         |
| ID de requête                   | Localiser une requête par l’ID de requête Uter.                                                         |
| ID de requête Upstream          | Localiser une requête par l’ID de requête renvoyé ou enregistré par le service Upstream.                |
| Nom d’utilisateur (Admin/Root uniquement)   | Filtrer par nom d’utilisateur dans la vue administrateur.                                                   |
| ID de canal (Admin/Root uniquement) | Filtrer par ID de canal dans la vue administrateur.                                                 |

### Statistiques de la page

Les valeurs statistiques de la barre de filtre dépendent des permissions actuelles et des conditions de filtrage :

* **Utilisation** : agrège le quota des enregistrements de consommation, filtrable par le temps, le modèle, le groupe, la clé, le canal et l’utilisateur.
* **RPM** : nombre de requêtes de consommation au cours des 60 dernières secondes.
* **TPM** : nombre total de jetons d’entrée et de jetons de sortie au cours des 60 dernières secondes.

### Liste et détails

* Les utilisateurs ordinaires voient les colonnes Heure et Type, Jeton, Modèle, Stream, Jetons, Coût, Durée et Détails.
* La vue Admin/Root peut également afficher les colonnes Canal et Utilisateur.

<img alt="Page des journaux d’utilisation" src="01-usage-logs.webp" />

<Callout type="info">
  1. **Jetons** : affiche les jetons d’entrée / jetons de sortie ; lorsque le cache est utilisé, les quantités de lecture et d’écriture du cache peuvent également être affichées.
  2. **Coût** : affiche la consommation de quota ou le résultat du remboursement pour cet enregistrement ; le format précis dépend du mode d’affichage du quota de l’instance.
  3. **Durée** : affiche la durée de réponse des enregistrements de consommation ou d’erreur comportant des données de temporisation ; les requêtes en streaming peuvent également afficher le temps de première réponse (FRT) et les informations de débit.
  4. **Détails** : cliquer sur un enregistrement ouvre une boîte de dialogue de détails. Selon le type de journal et les champs réellement enregistrés, elle peut inclure l’ID de requête, le mapping de modèle, la raison de l’erreur ou du remboursement, les détails des jetons, les détails de facturation, l’utilisation du cache/de l’audio/de l’image, le statut du stream, etc. Tous les blocs ne sont pas affichés pour chaque enregistrement.
  5. Les administrateurs peuvent également voir dans les détails les chaînes de nouvelle tentative de canal, les transformations de requête, les chemins de facturation, les audits de recharge ou les audits d’opérations de gestion.
</Callout>

<Callout type="warn">
  * **Pourquoi ne puis-je pas voir un enregistrement précis ?**
    L’écriture des journaux de consommation est contrôlée par la commutation "Conserver l’utilisation du quota" du Root dans "Paramètres système" → "Opérations" → "Maintenance des journaux". Si le Root désactive ce paramètre, de nouveaux enregistrements de consommation peuvent ne pas être générés. Les journaux d’erreur dépendent également de la commutation des journaux d’erreur et des types d’erreurs enregistrables ; toutes les réponses échouées ne génèrent pas un enregistrement Erreur. La préférence "Enregistrer l’adresse IP" des profils utilisateur ne contrôle que l’enregistrement des IP de requête pour les journaux de consommation et les journaux de requêtes en erreur ; les autres journaux tels que la connexion, l’audit de gestion et la recharge peuvent enregistrer les IP selon leurs propres processus d’audit.
</Callout>

## Journaux de tâches

* Les "Journaux de tâches" comprennent les "Journaux de dessin" et les "Journaux de tâches asynchrones".

1. "Journaux de dessin" : enregistre les journaux des tâches de dessin Midjourney.
2. "Journaux de tâches asynchrones" : enregistre les tâches asynchrones telles que la génération de texte en vidéo, d’image en vidéo et d’audio.

## Journaux de dessin

* Cliquez sur "Journaux de tâches" → "Journaux de dessin" dans la barre latérale gauche ou rendez-vous sur `/usage-logs/drawing` pour consulter les enregistrements des tâches de dessin Midjourney.
* Les utilisateurs ordinaires ne peuvent consulter que leurs propres tâches ; les utilisateurs Admin/Root peuvent consulter les tâches relevant de leur périmètre de gestion dans la vue "Tous" et voir en plus les canaux et les résultats de soumission.

Les journaux de dessin prennent en charge le filtrage selon les conditions suivantes :

1. Plage de dates ;
2. ID de tâche Midjourney ;
3. ID de canal (Admin/Root uniquement).

<img alt="Page des journaux de dessin" src="02-drawing-logs.webp" />

<Callout type="info">
  1. La liste comprend l’heure de soumission et le statut, l’ID de canal (Admin/Root uniquement), le type d’opération, l’ID de tâche, la durée, le résultat de soumission, la progression, l’image, l’invite et la raison de l’échec. Cliquer sur l’image ouvre un aperçu ; cliquer sur l’invite affiche le contenu complet ; cliquer sur la raison de l’échec affiche le message d’erreur complet.
  2. Les statuts de dessin comprennent : Non démarré, En file d’attente, En cours, Réussi, Échoué, En attente de fenêtre.
  3. Les statuts de dessin sont mis à jour par une interrogation périodique en arrière-plan des tâches Upstream. Un intervalle d’interrogation étant défini, le statut de la tâche peut être retardé ; lorsque le backend récupère les données de la tâche Upstream correspondante, le système marquera comme échouées les tâches Midjourney soumises depuis plus d’environ 1 heure et encore incomplètes.
</Callout>

## Journaux de tâches (journaux de tâches asynchrones)

* Cliquez sur "Journaux de tâches" → "Journaux de tâches asynchrones" dans la barre latérale gauche ou rendez-vous sur `/usage-logs/task` pour consulter les journaux des tâches asynchrones. Les utilisateurs ordinaires ne peuvent consulter que leurs propres tâches ; la vue Admin/Root affiche également l’ID de canal et l’utilisateur.
* Les API asynchrones pour la vidéo, la musique, etc., ne renvoient pas de résultats définitifs immédiatement lors de la soumission de la requête. Après une soumission réussie, Uter renvoie un ID de tâche accessible publiquement et enregistre la tâche, puis le backend interroge le service Upstream pour mettre à jour le statut, la progression et les résultats.

### Filtrer les tâches

Les journaux de tâches prennent en charge le filtrage selon les conditions suivantes :

1. Plage de dates ;
2. ID de tâche ;
3. ID de canal (Admin/Root uniquement).

### Liste et résultats

La liste des tâches affiche l’heure de soumission et l’heure de fin, le canal, l’utilisateur, l’ID de tâche, la plateforme et l’opération, la durée, le statut, la progression et les détails :

* Lorsqu’une tâche Suno réussit et renvoie une adresse audio, la colonne des détails fournit un aperçu audio ;
* Certaines tâches vidéo afficheront une entrée d’aperçu une fois réussies ; vous pouvez également utiliser la session de connexion ou la clé API du même compte pour demander `/v1/videos/{task_id}/content` afin d’obtenir le contenu vidéo des tâches terminées. Cette API vérifie la propriété de la tâche ; elle ne renverra aucun contenu si la tâche est incomplète ou n’appartient pas à l’utilisateur actuel ;
* Les autres enregistrements échoués afficheront la raison de l’échec dans la colonne des détails, sur laquelle vous pouvez cliquer pour afficher les informations complètes.

## Statut des tâches et traitement par le backend

Les journaux de tâches asynchrones utilisent les valeurs de statut suivantes. Les différents adaptateurs de plateforme conservent parfois la casse ou les particularités de plateforme des statuts Upstream ; les valeurs de retour de l’API doivent donc être fondées sur les enregistrements de tâches réels :

| Statut        | Signification                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `Not Started` | L’enregistrement de tâche a été créé mais n’a pas encore commencé le traitement.                                |
| `Queued`      | Soumis à l’Upstream, en attente de traitement ultérieur.                                                 |
| `In Queue`    | A rejoint la file de traitement.                                                                   |
| `In Progress` | En cours de traitement.                                                                               |
| `Success`     | Terminée, les résultats peuvent être consultés ou récupérés.                                                      |
| `Failed`      | Le traitement a échoué ; la raison de l’échec sera écrite dans l’enregistrement de tâche (si fournie par l’Upstream). |
| `Unknown`     | Valeur de repli définie en interne pour un statut inconnu.                                               |

<img alt="Page des journaux de tâches" src="03-task-logs.webp" />

<Callout type="info">
  Les statuts de tâches sont mis à jour par une interrogation périodique en arrière-plan, le statut des tâches nouvellement soumises peut donc être retardé. Par défaut, les tâches asynchrones sont interrogées environ toutes les 15 secondes ; l’interrogation ne s’exécute que lorsque `UPDATE_TASK` est activé et qu’il existe des tâches incomplètes. Le seuil de délai d’expiration des tâches asynchrones est contrôlé par `TASK_TIMEOUT_MINUTES`, qui vaut 1440 minutes par défaut ; le définir sur `0` désactive la gestion des délais d’expiration.
</Callout>

### Échec, délai d’expiration et remboursement

Après qu’une tâche a atteint un état final d’échec, si un quota avait été pré-déduit lors de la phase de soumission, le système tentera généralement un remboursement et écrira un journal `Refund` en cas de remboursement réussi. Après un remboursement réussi, le quota de remboursement en attente dans l’enregistrement de tâche est effacé, et l’utilisation cumulée pour l’utilisateur et le canal est réduite ; le nombre de requêtes n’est pas annulé pour autant.

<Callout type="warn">
  Les situations suivantes peuvent entraîner des incohérences temporaires entre le statut de la page et le solde :

  1. La tâche n’avait aucun quota pré-déduit (`quota = 0`) ;
  2. Le remboursement depuis la source de financement a échoué, le système conservera le quota de la tâche pour une nouvelle tentative ou un rapprochement manuel ;

  * Lors du diagnostic d’un remboursement, veuillez vérifier à la fois votre solde de portefeuille ou le quota d’abonnement restant (ainsi que le quota des clés API actives) et les enregistrements "Refund" dans les journaux d’utilisation généraux. Ne vous fiez pas uniquement au statut "Failed" pour déterminer si un remboursement a été effectué.
</Callout>

## Référence de l’API

### API de requête des journaux

Si vous utilisez l’API au lieu de la console, vous pouvez appeler les API suivantes en lecture seule. Ces API restent soumises aux restrictions d’authentification et de permission, et les résultats pour les utilisateurs ordinaires seront strictement limités au compte actuel :

| Données               | API administrateur           | API utilisateur                 | Unité du paramètre de temps          |
| ------------------ | ------------------- | ------------------------ | ---------------------------- |
| Journaux généraux       | `GET /api/log/`     | `GET /api/log/self`      | Secondes (`created_at`)       |
| Statistiques des journaux     | `GET /api/log/stat` | `GET /api/log/self/stat` | Secondes                      |
| Dessin Midjourney | `GET /api/mj/`      | `GET /api/mj/self`       | Millisecondes (`submit_time`) |
| Tâches asynchrones | `GET /api/task/`    | `GET /api/task/self`     | Secondes (`submit_time`)      |

Les API de liste des journaux et des tâches utilisent les paramètres de pagination `p` et `page_size` ; la numérotation des pages commence à `1`. Lorsque des entiers positifs normaux sont utilisés, un `page_size` supérieur à `100` sera tronqué à `100`. Le nombre total de journaux utilisateur est également soumis à la limite de requête interne de l’instance. Les données renvoyées par les tâches n’incluront pas les champs privés susceptibles de contenir des clés, des identifiants de tâches Upstream ou le contexte de facturation.

De plus, `GET /api/log/token` peut être utilisé avec une clé API pour lire les journaux les plus récents de cette clé. Cette API utilise une authentification par jeton en lecture seule : elle vérifie que la clé existe, qu’elle n’est pas explicitement désactivée et que son utilisateur propriétaire est disponible, mais elle ne refusera pas les requêtes en raison de l’expiration de la clé ou de l’épuisement du quota ; elle renvoie au maximum `1000` enregistrements récents.

Les paramètres de requête courants des API de liste des tâches sont les suivants :

| Portée        | Méthode et chemin      | Paramètres de requête courants                                                                                       |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Utilisateur actuel | `GET /api/task/self` | `p`, `page_size`, `task_id`, `start_timestamp`, `end_timestamp` ; accepte également `platform`, `action`, `status`. |
| Admin/Root   | `GET /api/task/`     | Ajoute `channel_id` aux paramètres de l’API utilisateur, et permet de filtrer par `platform`, `action`, `status`.                   |

<Callout type="info">
  Les paramètres `start_timestamp` et `end_timestamp` des API de tâches utilisent des horodatages en secondes Unix ; les paramètres de temps de l’API de dessin Midjourney utilisent des millisecondes.
</Callout>

### API de génération asynchrone et de tâches

Les API de génération asynchrone et de requête des tâches Upstream suivantes sont fournies par l’instance en fonction des canaux et des adaptateurs configurés. Les API de soumission et de requête utilisent généralement l’authentification par clé API. Le proxy de contenu vidéo prend en charge à la fois les clés API et les sessions de connexion, et respecte la vérification de propriété de la tâche ; le proxy d’images Midjourney fait exception et ne nécessite pas de clé API ; l’API de liste `/api/task` ci-dessous utilise les permissions d’utilisateur connecté ou d’administrateur. La méthode d’authentification spécifique est soumise aux exigences de l’API.

| API                            | Chemin                                                                                                 | Description                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Génération vidéo OpenAI        | `POST /v1/videos`                                                                                    | Crée une tâche asynchrone de génération vidéo compatible OpenAI, renvoyant un identifiant de tâche en cas de succès.                                          |
| Requête de tâche vidéo OpenAI        | `GET /v1/videos/{task_id}`                                                                           | Interroge le statut, la progression et les informations de résultat d’une tâche de génération vidéo.                                                                    |
| Récupération du contenu vidéo        | `GET /v1/videos/{task_id}/content`                                                                   | Renvoie en streaming le contenu vidéo terminé ; le système récupère le contenu depuis l’Upstream d’après les résultats de la tâche ou décode les URL de données enregistrées.                  |
| Remix vidéo                    | `POST /v1/videos/{video_id}/remix`                                                                   | Soumet une nouvelle tâche asynchrone Remix à partir d’une vidéo existante.                                                                                   |
| Génération vidéo héritée        | `POST /v1/video/generations`                                                                         | Compatible avec les chemins de génération vidéo hérités, crée des tâches vidéo asynchrones.                                                                    |
| Requête de tâche vidéo héritée        | `GET /v1/video/generations/{task_id}`                                                                | Interroge le statut et les résultats des tâches de génération vidéo héritées.                                                                                    |
| Texte en vidéo Kling            | `POST /kling/v1/videos/text2video`                                                                   | Soumet une tâche texte en vidéo au format Kling ; le système effectuera d’abord une conversion du format de requête.                                           |
| Image en vidéo Kling           | `POST /kling/v1/videos/image2video`                                                                  | Soumet une tâche image en vidéo au format Kling.                                                                                                  |
| Requête de tâche Kling               | `GET /kling/v1/videos/text2video/{task_id}` `GET /kling/v1/videos/image2video/{task_id}`        | Interroge les résultats des tâches texte en vidéo ou image en vidéo Kling.                                                                                 |
| API officielle Jimeng            | `POST /jimeng/`                                                                                      | Compatible avec le format de l’API officielle Jimeng, en distinguant les opérations de soumission et de requête via des paramètres comme `Action` et `Version`. |
| Soumission de tâche Suno           | `POST /suno/submit/{action}`                                                                         | Soumet une tâche de génération musicale Suno ; le type de tâche spécifique est déterminé par le paramètre `action`.                                               |
| Requête de tâche Suno                | `POST /suno/fetch` `GET /suno/fetch/{id}`                                                       | Interroge la liste des tâches Suno ou le statut et les résultats d’une tâche spécifiée.                                                                           |
| Soumission de tâche Midjourney     | `POST /mj/submit/{action}` `POST /{mode}/mj/submit/{action}`                                    | Prend en charge les opérations de tâche telles que `imagine`, `describe`, `blend`, `change`, `simple-change`, `edits`, `video`, `action`, `modal` et `shorten`.     |
| Requête de tâche Midjourney          | `GET /mj/task/{id}/fetch` `GET /mj/task/{id}/image-seed` `POST /mj/task/list-by-condition` | Interroge le statut des tâches, les graines d’image ou les listes de tâches par condition ; prend également en charge les chemins avec le préfixe `{mode}`.                                         |
| Proxy d’images Midjourney         | `GET /mj/image/{id}` `GET /{mode}/mj/image/{id}`                                                | Récupère ou proxifie les images générées en fonction de l’ID de tâche Midjourney.                                                                              |
| Opérations étendues Midjourney | `POST /mj/insight-face/swap` `POST /mj/submit/upload-discord-images`                            | Fournit des fonctionnalités étendues telles que l’échange de visages et le téléversement d’images Discord.                                                               |

## Relation avec le Tableau de bord des données

* Les journaux sont des enregistrements détaillés, tandis que le tableau de bord des données fournit des statistiques agrégées par heure, modèle, utilisateur ou canal.
* Leur portée de filtrage, leur fréquence de rafraîchissement et leurs méthodes statistiques peuvent différer ;
* Les nouvelles requêtes apparaissent d’abord dans les journaux, et les données des graphiques peuvent nécessiter une agrégation ou un rafraîchissement avant de se mettre à jour.

<Callout type="info">
  Lors du diagnostic d’un appel, il est recommandé de localiser d’abord la requête dans les journaux généraux par heure, modèle, ID de requête ou ID de requête Upstream ; pour les requêtes asynchrones, notez le `task_id` renvoyé par l’API de soumission, puis interrogez le statut final de la tâche et les détails de l’échec. Si une tâche reste inchangée pendant longtemps, vérifiez la disponibilité du canal, la commutation d’interrogation des tâches, les paramètres de délai d’expiration et les journaux "Refund" correspondants.
</Callout>