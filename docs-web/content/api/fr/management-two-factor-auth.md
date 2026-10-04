# two-factor-auth

## Régénérer les codes de secours

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/2fa/backup_codes`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Désactiver la 2FA

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/2fa/disable`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Activer la 2FA

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/2fa/enable`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Configurer la 2FA

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/2fa/setup`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les statistiques 2FA

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/user/2fa/stats`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer le statut 2FA

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/2fa/status`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
