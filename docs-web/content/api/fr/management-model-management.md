# model-management

## Récupérer toutes les métadonnées de modèles

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/models/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer un modèle

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/models/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer un modèle spécifique

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/models/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les modèles manquants

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/models/missing`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Créer des métadonnées de modèle

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/models/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour les métadonnées de modèle

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`PUT` `/api/models/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher des modèles

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/models/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Synchroniser les modèles en amont

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/models/sync_upstream`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Prévisualiser la synchronisation des modèles en amont

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/models/sync_upstream/preview`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
