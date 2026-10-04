# Format Claude natif

## Format Claude natif

Requête au format Anthropic Claude Messages API.
Nécessite l'en-tête `anthropic-version`.

`POST` `/v1/messages`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `anthropic-version` | header | string | Oui | Version de l'API Anthropic |
| `x-api-key` | header | string | Non | Clé API Anthropic (optionnelle, le Bearer Token peut aussi être utilisé) |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `messages` | array&lt;object&gt; | Oui | — |
| `max_tokens` | integer | Oui | — |
| `temperature` | number | Non | — |
| `top_p` | number | Non | — |
| `top_k` | integer | Non | — |
| `stream` | boolean | Non | — |
| `stop_sequences` | array&lt;string&gt; | Non | — |
| `tools` | array&lt;object&gt; | Non | — |
| `tool_choice.type` | enum（`auto`, `any`, `tool`） | Non | — |
| `tool_choice.name` | string | Non | — |
| `thinking.type` | enum（`enabled`, `disabled`） | Non | — |
| `thinking.budget_tokens` | integer | Non | — |
| `metadata.user_id` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Réponse créée avec succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | — |
| `type` | string | — |
| `role` | string | — |
| `content` | array&lt;object&gt; | — |
| `model` | string | — |
| `stop_reason` | enum（`end_turn`, `max_tokens`, `stop_sequence`, `tool_use`） | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.cache_creation_input_tokens` | integer | — |
| `usage.cache_read_input_tokens` | integer | — |
