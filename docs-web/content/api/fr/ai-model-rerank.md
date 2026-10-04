# Réordonnancement de documents

## Réordonnancement de documents

Réordonne une liste de documents par pertinence selon une requête.

`POST` `/v1/rerank`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `query` | string | Oui | Texte de requête |
| `documents` | array&lt;string&gt; | Oui | Liste des documents à réordonner |
| `top_n` | integer | Non | Renvoie les N premiers résultats |
| `return_documents` | boolean | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Réordonnancement réussi |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | — |
| `results` | array&lt;object&gt; | — |
| `meta` | object | — |
