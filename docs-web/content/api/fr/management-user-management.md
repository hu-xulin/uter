# user-management

## Récupérer le code d'invitation

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/aff`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Convertir le quota d'invitation

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/aff_transfer`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `quota` | integer | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer tous les utilisateurs

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/user/`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `p` | query | integer | Non | — |
| `page_size` | query | integer | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Désactiver la 2FA d'un utilisateur (admin)

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/user/{id}/2fa`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer un utilisateur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/user/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer un utilisateur spécifique

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/user/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Réinitialiser la clé d'accès d'un utilisateur (admin)

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/user/{id}/reset_passkey`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Gérer le statut d'un utilisateur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/user/manage`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `id` | integer | Non | — |
| `action` | enum（`disable`, `enable`, `delete`, `promote`, `demote`） | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les modèles disponibles pour l'utilisateur

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/models`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer la clé d'accès

🔐 Nécessite une connexion (permission User)

`DELETE` `/api/user/passkey`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer le statut de la clé d'accès

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/passkey`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Démarrer l'enregistrement de la clé d'accès

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/passkey/register/begin`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Terminer l'enregistrement de la clé d'accès

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/passkey/register/finish`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Démarrer la vérification de la clé d'accès

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/passkey/verify/begin`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Terminer la vérification de la clé d'accès

🔐 Nécessite une connexion (permission User)

`POST` `/api/user/passkey/verify/finish`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Créer un utilisateur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/user/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour un utilisateur

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`PUT` `/api/user/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Rechercher des utilisateurs

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/user/search`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `keyword` | query | string | Non | — |
| `group` | query | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer l'utilisateur actuel

🔐 Nécessite une connexion (permission User)

`DELETE` `/api/user/self`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les informations de l'utilisateur actuel

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/self`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les groupes de l'utilisateur actuel

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/self/groups`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour les informations de l'utilisateur actuel

🔐 Nécessite une connexion (permission User)

`PUT` `/api/user/self`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `username` | string | Non | — |
| `display_name` | string | Non | — |
| `password` | string | Non | — |
| `original_password` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour les paramètres utilisateur

🔐 Nécessite une connexion (permission User)

`PUT` `/api/user/setting`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `notify_type` | string | Non | — |
| `quota_warning_threshold` | number | Non | — |
| `webhook_url` | string | Non | — |
| `notification_email` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Générer un jeton d'accès

🔐 Nécessite une connexion (permission User)

`GET` `/api/user/token`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Finaliser une recharge (admin)

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/user/topup/complete`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer tous les enregistrements de recharge

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/user/topup`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
