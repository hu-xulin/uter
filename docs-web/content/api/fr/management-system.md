# system

## Récupérer les informations « À propos »

🔓 Aucune authentification requise

`GET` `/api/about`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer le contenu de la page d'accueil

🔓 Aucune authentification requise

`GET` `/api/home_page_content`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer la liste des modèles

🔐 Nécessite une connexion (permission User)

`GET` `/api/models`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les annonces

🔓 Aucune authentification requise

`GET` `/api/notice`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer les informations de tarification

🔓 Aucune authentification requise (connexion optionnelle)

`GET` `/api/pricing`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer la politique de confidentialité

🔓 Aucune authentification requise

`GET` `/api/privacy-policy`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer la configuration des ratios

🔓 Aucune authentification requise

`GET` `/api/ratio_config`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer l'état d'initialisation

🔓 Aucune authentification requise

`GET` `/api/setup`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Initialiser le système

🔓 Aucune authentification requise

`POST` `/api/setup`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `username` | string | Non | — |
| `password` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer l'état du système

🔓 Aucune authentification requise

`GET` `/api/status`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Tester l'état du système

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/status/test`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer l'état Uptime Kuma

🔓 Aucune authentification requise

`GET` `/api/uptime/status`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer le contrat d'utilisation

🔓 Aucune authentification requise

`GET` `/api/user-agreement`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
