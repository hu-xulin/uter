# vendors

## Récupérer tous les fournisseurs

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/vendors/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer un fournisseur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/vendors/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer un fournisseur spécifique

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/vendors/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Créer un fournisseur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/vendors/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour un fournisseur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`PUT` `/api/vendors/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher des fournisseurs

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/vendors/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
