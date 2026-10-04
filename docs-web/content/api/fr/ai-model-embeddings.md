# embeddings

## Format OpenAI natif

Convertit le texte en embeddings vectoriels.

`POST` `/v1/embeddings`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `encoding_format` | enum（`float`, `base64`） | Non | — |
| `dimensions` | integer | Non | Dimension du vecteur de sortie |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Embedding créé avec succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |

## Format Gemini natif

Crée un embedding avec le moteur/modèle spécifié.

`POST` `/v1/engines/{model}/embeddings`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `model` | path | string | Oui | ID du modèle/moteur |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `encoding_format` | enum（`float`, `base64`） | Non | — |
| `dimensions` | integer | Non | Dimension du vecteur de sortie |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Embedding créé avec succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
