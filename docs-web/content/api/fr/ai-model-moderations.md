# Format OpenAI natif

## Format OpenAI natif

Vérifie si le contenu textuel viole la politique d'utilisation.

`POST` `/v1/moderations`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Modération réussie |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | — |
| `model` | string | — |
| `results` | array&lt;object&gt; | — |
