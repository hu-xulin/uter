# redemption

## Récupérer tous les codes de rédemption

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/redemption/`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `p` | query | integer | Non | — |
| `page_size` | query | integer | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer un code de rédemption

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/redemption/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer un code de rédemption spécifique

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/redemption/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer les codes de rédemption invalides

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/redemption/invalid`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Créer un code de rédemption

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/redemption/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour un code de rédemption

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`PUT` `/api/redemption/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher des codes de rédemption

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/redemption/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
