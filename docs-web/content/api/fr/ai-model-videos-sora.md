# sora

## Créer une vidéo

Interface de génération vidéo compatible OpenAI.

Documentation de référence : https://platform.openai.com/docs/api-reference/videos/create

`POST` `/v1/videos`

### Corps de la requête (`multipart/form-data`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Non | ID du modèle/style |
| `prompt` | string | Non | Invite de description textuelle |
| `image` | string | Non | Entrée image (URL ou Base64) |
| `duration` | number | Non | Durée de la vidéo (secondes) |
| `width` | integer | Non | Largeur de la vidéo |
| `height` | integer | Non | Hauteur de la vidéo |
| `fps` | integer | Non | Fréquence d'images de la vidéo |
| `seed` | integer | Non | Graine aléatoire |
| `n` | integer | Non | Nombre de vidéos générées |
| `response_format` | string | Non | Format de réponse |
| `user` | string | Non | Identifiant utilisateur |
| `metadata` | object | Non | Paramètres étendus (ex. negative_prompt, style, quality_level, etc.) |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Tâche vidéo créée avec succès |
| `400` | Erreur de paramètres de requête |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | ID de la vidéo |
| `object` | string | Type d'objet |
| `model` | string | Modèle utilisé |
| `status` | string | État de la tâche |
| `progress` | integer | Pourcentage de progression |
| `created_at` | integer | Horodatage de création |
| `seconds` | string | Durée de la vidéo |
| `completed_at` | integer | Horodatage de fin |
| `expires_at` | integer | Horodatage d'expiration |
| `size` | string | Dimensions de la vidéo |
| `error.message` | string | Message d'erreur |
| `error.code` | string | Code d'erreur |
| `metadata` | object | Métadonnées supplémentaires |

#### Champs de la réponse `400`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |

## Récupérer l'état de la tâche vidéo

Interface de requête d'état de tâche vidéo compatible OpenAI.

Renvoie les informations d'état détaillées de la tâche vidéo.

`GET` `/v1/videos/{task_id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | ID de tâche vidéo |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | État de la tâche vidéo récupéré avec succès |
| `404` | Tâche inexistante |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `model` | string | — |
| `status` | string | — |
| `progress` | integer | — |
| `created_at` | integer | — |
| `seconds` | string | — |

#### Champs de la réponse `404`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |

## Récupérer le contenu vidéo

Récupère le contenu du fichier vidéo de la tâche vidéo terminée.

Cette interface renvoie en proxy le flux du fichier vidéo.

`GET` `/v1/videos/{task_id}/content`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | ID de tâche vidéo |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Contenu vidéo récupéré avec succès |
| `404` | Vidéo inexistante ou non terminée |

#### Champs de la réponse `404`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |
