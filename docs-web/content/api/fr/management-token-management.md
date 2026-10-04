# token-management

## Supprimer des jetons par lot

🔐 Nécessite une connexion (permission User)

`POST` `/api/token/batch`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer tous les jetons

🔐 Nécessite une connexion (permission User)

`GET` `/api/token/`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `p` | query | integer | Non | — |
| `page_size` | query | integer | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer un jeton

🔐 Nécessite une connexion (permission User)

`DELETE` `/api/token/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer le jeton spécifié

🔐 Nécessite une connexion (permission User)

`GET` `/api/token/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Créer un jeton

🔐 Nécessite une connexion (permission User)

`POST` `/api/token/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour un jeton

🔐 Nécessite une connexion (permission User)

`PUT` `/api/token/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher des jetons

🔐 Nécessite une connexion (permission User)

`GET` `/api/token/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer l'utilisation du jeton

🔑 Nécessite une authentification par jeton (TokenAuth)

`GET` `/api/usage/token/`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `Authorization` | header | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
