# gemini

## Reconnaissance de médias Gemini

Requête de reconnaissance d'images, PDF, audio, vidéo Gemini.

⚠️ Note : les requêtes au format Gemini natif prennent en charge le transfert de médias via inlineData (base64) ou fileData.fileUri (URL publiquement accessible, prend en charge les liens YouTube). L'accessibilité de l'URI de fichier téléversé via l'API Gemini File dépend des permissions de la clé du canal en amont ; il est recommandé d'utiliser en priorité une URL publiquement accessible. Lors de la conversion d'une requête au format OpenAI (chat/completions) vers Gemini, les médias sont téléchargés et convertis uniformément en inlineData (base64) pour le transfert.

`POST` `/v1beta/models/{model}:generateContent`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `model` | path | string | Oui | Nom du modèle |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `contents` | array&lt;object&gt; | Non | — |
| `generationConfig.temperature` | number | Non | — |
| `generationConfig.topP` | number | Non | — |
| `generationConfig.topK` | integer | Non | — |
| `generationConfig.maxOutputTokens` | integer | Non | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | Non | — |
| `safetySettings` | array&lt;object&gt; | Non | — |
| `tools` | array&lt;object&gt; | Non | — |
| `systemInstruction.parts` | array&lt;object&gt; | Non | — |

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

## Conversation texte Gemini

Requête proxy vers l'API Gemini.
Format du chemin : `/v1beta/models/{model_name}:{action}`

Par exemple :
- `/v1beta/models/gemini-2.5-pro:generateContent`
- `/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse`

`POST` `/v1beta/models/{model}:generateContent`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `model` | path | string | Oui | Nom du modèle |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `contents` | array&lt;object&gt; | Non | — |
| `generationConfig.temperature` | number | Non | — |
| `generationConfig.topP` | number | Non | — |
| `generationConfig.topK` | integer | Non | — |
| `generationConfig.maxOutputTokens` | integer | Non | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | Non | — |
| `safetySettings` | array&lt;object&gt; | Non | — |
| `tools` | array&lt;object&gt; | Non | — |
| `systemInstruction.parts` | array&lt;object&gt; | Non | — |

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
