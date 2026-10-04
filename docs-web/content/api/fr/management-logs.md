# journaux

## Supprimer les journaux historiques

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/log/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer tous les journaux

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/log/`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `p` | query | integer | Non | — |
| `page_size` | query | integer | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher des journaux

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/log/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les journaux personnels

🔐 Nécessite une connexion (permission User)

`GET` `/api/log/self`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher les journaux personnels

🔐 Nécessite une connexion (permission User)

`GET` `/api/log/self/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les statistiques de journaux personnels

🔐 Nécessite une connexion (permission User)

`GET` `/api/log/self/stat`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les statistiques de journaux

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/log/stat`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les journaux par jeton

🔓 Aucune authentification requise (requête par jeton)

`GET` `/api/log/token`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `key` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
