# vidéos

## Créer une tâche de génération vidéo

Soumet une tâche de génération vidéo, prenant en charge la génération vidéo à partir de texte et d'image.

Renvoie un ID de tâche, dont l'état peut être consulté via l'interface GET.

`POST` `/v1/video/generations`

### Corps de la requête (`application/json`)

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
| `200` | Tâche de génération vidéo créée avec succès |
| `400` | Erreur de paramètres de requête |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `task_id` | string | ID de tâche |
| `status` | string | État de la tâche |

#### Champs de la réponse `400`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |

## Récupérer l'état de la tâche de génération vidéo

Interroge l'état et le résultat de la tâche de génération vidéo.

États de la tâche :
- `queued` : en file d'attente
- `in_progress` : en génération
- `completed` : terminé
- `failed` : échoué

`GET` `/v1/video/generations/{task_id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | ID de tâche |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | État de la tâche récupéré avec succès |
| `404` | Tâche inexistante |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `task_id` | string | ID de tâche |
| `status` | enum（`queued`, `in_progress`, `completed`, `failed`） | État de la tâche |
| `url` | string | URL de la ressource vidéo (en cas de succès) |
| `format` | string | Format vidéo |
| `metadata.duration` | number | Durée réelle de la vidéo générée |
| `metadata.fps` | integer | Fréquence d'images réelle |
| `metadata.width` | integer | Largeur réelle |
| `metadata.height` | integer | Hauteur réelle |
| `metadata.seed` | integer | Graine aléatoire utilisée |
| `error.code` | integer | Code d'erreur |
| `error.message` | string | Message d'erreur |

#### Champs de la réponse `404`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |
