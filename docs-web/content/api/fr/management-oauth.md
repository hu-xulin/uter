# oauth

## Connexion OAuth Discord

🔓 Aucune authentification requise (rappel OAuth)

`GET` `/api/oauth/discord`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `code` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Lier l'e-mail

🔓 Aucune authentification requise

`GET` `/api/oauth/email/bind`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `email` | query | string | Non | — |
| `code` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion OAuth GitHub

🔓 Aucune authentification requise (rappel OAuth)

`GET` `/api/oauth/github`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `code` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion OAuth LinuxDO

🔓 Aucune authentification requise (rappel OAuth)

`GET` `/api/oauth/linuxdo`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion OIDC

🔓 Aucune authentification requise (rappel OAuth)

`GET` `/api/oauth/oidc`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Générer l'état OAuth

🔓 Aucune authentification requise

`GET` `/api/oauth/state`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Lier Telegram

🔓 Aucune authentification requise

`GET` `/api/oauth/telegram/bind`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion Telegram

🔓 Aucune authentification requise (rappel OAuth)

`GET` `/api/oauth/telegram/login`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion OAuth WeChat

🔓 Aucune authentification requise (rappel OAuth)

`GET` `/api/oauth/wechat`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
