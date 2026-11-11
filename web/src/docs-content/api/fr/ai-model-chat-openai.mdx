# openai

## Format ChatCompletions

Crée une réponse de modèle basée sur l'historique de conversation. Prend en charge les réponses en streaming et non-streaming.

Compatible avec l'API OpenAI Chat Completions.

`POST` `/v1/chat/completions`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | ID du modèle |
| `messages` | array&lt;object&gt; | Oui | Liste des messages de conversation |
| `temperature` | number | Non | Température d'échantillonnage |
| `top_p` | number | Non | Paramètre d'échantillonnage par noyau |
| `n` | integer | Non | Nombre de générations |
| `stream` | boolean | Non | Réponse en streaming ou non |
| `stream_options.include_usage` | boolean | Non | — |
| `max_tokens` | integer | Non | Nombre maximum de tokens générés |
| `max_completion_tokens` | integer | Non | Nombre maximum de tokens de complétion |
| `presence_penalty` | number | Non | — |
| `frequency_penalty` | number | Non | — |
| `logit_bias` | object | Non | — |
| `user` | string | Non | — |
| `tools` | array&lt;object&gt; | Non | — |
| `response_format.type` | enum（`text`, `json_object`, `json_schema`） | Non | — |
| `response_format.json_schema` | object | Non | Définition JSON Schema |
| `seed` | integer | Non | — |
| `reasoning_effort` | enum（`low`, `medium`, `high`） | Non | Intensité de raisonnement (pour les modèles prenant en charge le raisonnement) |
| `modalities` | array&lt;enum（`text`, `audio`）&gt; | Non | — |
| `audio.voice` | string | Non | — |
| `audio.format` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Réponse créée avec succès |
| `400` | Erreur de paramètres de requête |
| `429` | Limite de fréquence de requête |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `model` | string | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | Nombre de tokens d'invite |
| `usage.completion_tokens` | integer | Nombre de tokens de complétion |
| `usage.total_tokens` | integer | Nombre total de tokens |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
| `system_fingerprint` | string | — |

#### Champs de la réponse `400`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |

#### Champs de la réponse `429`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |

## Format Responses

API OpenAI Responses, utilisée pour créer des réponses de modèle.
Prend en charge le dialogue multi-tours, l'appel d'outils, le raisonnement, etc.

`POST` `/v1/responses`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `instructions` | string | Non | — |
| `max_output_tokens` | integer | Non | — |
| `temperature` | number | Non | — |
| `top_p` | number | Non | — |
| `stream` | boolean | Non | — |
| `tools` | array&lt;object&gt; | Non | — |
| `reasoning.effort` | enum（`low`, `medium`, `high`） | Non | — |
| `reasoning.summary` | string | Non | — |
| `previous_response_id` | string | Non | — |
| `truncation` | enum（`auto`, `disabled`） | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Réponse créée avec succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created_at` | integer | — |
| `status` | enum（`completed`, `failed`, `in_progress`, `incomplete`） | — |
| `model` | string | — |
| `output` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | Nombre de tokens d'invite |
| `usage.completion_tokens` | integer | Nombre de tokens de complétion |
| `usage.total_tokens` | integer | Nombre total de tokens |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
