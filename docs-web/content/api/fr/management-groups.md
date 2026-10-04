# groupes

## Récupérer tous les groupes

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/group/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Récupérer le groupe pré-rempli

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`GET` `/api/prefill_group/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Supprimer le groupe pré-rempli

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`DELETE` `/api/prefill_group/{id}`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `id` | path | integer | Oui | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Créer un groupe pré-rempli

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`POST` `/api/prefill_group/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

## Mettre à jour le groupe pré-rempli

👨‍💼 Nécessite des privilèges d'administrateur (Admin)

`PUT` `/api/prefill_group/`

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |
