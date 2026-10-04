# user-auth

## Envoyer l'e-mail de réinitialisation du mot de passe

🔓 Aucune authentification requise

`GET` `/api/reset_password`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `email` | query | string | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer la liste des groupes d'utilisateurs

🔓 Aucune authentification requise

`GET` `/api/user/groups`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion par authentification à deux facteurs

🔓 Aucune authentification requise (processus de connexion)

`POST` `/api/user/login/2fa`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `code` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Connexion utilisateur

🔓 Aucune authentification requise

`POST` `/api/user/login`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `username` | string | Non | — |
| `password` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Déconnexion utilisateur

🔓 Aucune authentification requise

`GET` `/api/user/logout`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Démarrer la connexion par clé d'accès (passkey)

🔓 Aucune authentification requise

`POST` `/api/user/passkey/login/begin`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Terminer la connexion par clé d'accès

🔓 Aucune authentification requise

`POST` `/api/user/passkey/login/finish`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Inscription utilisateur

🔓 Aucune authentification requise

`POST` `/api/user/register`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `username` | string | Non | — |
| `password` | string | Non | — |
| `email` | string | Non | — |
| `verification_code` | string | Non | — |
| `aff_code` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Réinitialiser le mot de passe

🔓 Aucune authentification requise

`POST` `/api/user/reset`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | string | Non | — |
| `token` | string | Non | — |
| `password` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Envoyer le code de vérification par e-mail

🔓 Aucune authentification requise

`GET` `/api/verification`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `email` | query | string | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
