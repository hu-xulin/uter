# Format Gemini natif

## Format Gemini natif

Interface de génération audio Gemini.
Les modèles tels que gemini-2.5-flash-preview-tts peuvent être utilisés.

`POST` `/v1beta/models/{model}:generateContent`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `model` | path | string | Oui | Nom du modèle |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `contents` | array&lt;object&gt; | Oui | — |
| `generationConfig.responseModalities` | array&lt;string&gt; | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Succès |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |
