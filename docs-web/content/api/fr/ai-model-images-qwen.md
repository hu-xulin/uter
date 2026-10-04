# qwen

## Générer des images

Génération d'images de la série qwen-image (Bailian).

`POST` `/v1/images/generations`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `input.messages` | array&lt;object&gt; | Non | — |
| `parameters.negative_prompt` | string | Non | — |
| `parameters.prompt_extend` | boolean | Non | — |
| `parameters.watermark` | boolean | Non | — |
| `parameters.size` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Image générée avec succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |

## Éditer une image

Édition d'images de la série qwen-image (Bailian).

`POST` `/v1/images/edits`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `input.messages` | array&lt;object&gt; | Non | — |
| `parameters.n` | integer | Non | — |
| `parameters.negative_prompt` | string | Non | — |
| `parameters.prompt_extend` | boolean | Non | — |
| `parameters.watermark` | boolean | Non | — |
| `parameters.size` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Image générée avec succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
