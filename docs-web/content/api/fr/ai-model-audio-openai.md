# openai

## Synthèse vocale (Text-to-Speech)

Convertit le texte en audio.

`POST` `/v1/audio/speech`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | — |
| `input` | string | Oui | Texte à convertir |
| `voice` | enum（`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`） | Oui | — |
| `response_format` | enum（`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`） | Non | — |
| `speed` | number | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Audio généré avec succès |

## Transcriptions audio

Convertit l'audio en texte.

`POST` `/v1/audio/transcriptions`

### Corps de la requête (`multipart/form-data`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `file` | string（binary） | Oui | Fichier audio |
| `model` | string | Oui | — |
| `language` | string | Non | Code de langue ISO-639-1 |
| `prompt` | string | Non | — |
| `response_format` | enum（`json`, `text`, `srt`, `verbose_json`, `vtt`） | Non | — |
| `temperature` | number | Non | — |
| `timestamp_granularities` | array&lt;enum（`word`, `segment`）&gt; | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Transcription réussie |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `text` | string | — |

## Traduction audio

Traduit l'audio en texte anglais.

`POST` `/v1/audio/translations`

### Corps de la requête (`multipart/form-data`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `file` | string（binary） | Oui | — |
| `model` | string | Oui | — |
| `prompt` | string | Non | — |
| `response_format` | string | Non | — |
| `temperature` | number | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Traduction réussie |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `text` | string | — |
