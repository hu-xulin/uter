# Format Gemini natif

Le point de terminaison de génération audio Gemini natif. Synthétise la parole directement avec des modèles tels que `gemini-2.5-flash-preview-tts`, renvoyant de l'audio aux formats PCM / WAV et autres.

Contrairement au « Format OpenAI natif », ce point de terminaison suit le protocole `v1beta` de Google Gemini : vous soumettez du contenu au point de terminaison `generateContent` et contrôlez la modalité de sortie et la voix via `generationConfig`. Uter unifie l'accès à la famille de modèles Gemini — clés, quotas et facturation utilisent tous le système de compte de la plateforme.

## Autorisation

Authentifiez-vous avec un jeton Bearer.

`Authorization: Bearer <token>`

| Paramètre | Emplacement | Description |
|---|---|---|
| `Authorization` | header | Jeton Bearer, format `Bearer sk-xxxxxx` |

## Paramètres de chemin

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `model` | string | oui | Nom du modèle, ex. `gemini-2.5-flash-preview-tts` |

## Corps de la requête

`Content-Type: application/json`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `contents` | array&lt;object&gt; | oui | Contenu de conversation ; chaque entrée est un tour de saisie |
| `generationConfig` | object | oui | Configuration de génération contrôlant la modalité de sortie et la voix |

### Champs de generationConfig

| Champ | Type | Requis | Description |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | non | Modalités de sortie ; les cas d'usage audio doivent inclure `AUDIO` |
| `speechConfig` | object | non | Configuration vocale |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | non | Nom de voix prédéfinie, ex. `Kore` |

## Réponse

`200` la requête a réussi et du JSON est renvoyé. L'audio généré est inclus en ligne dans `candidates[].content.parts[]`.

### Exemple de requête

```bash
curl -X POST "https://uter.ai/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
  -H "Authorization: Bearer $Uter_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          { "text": "Read this text in a gentle female voice." }
        ]
      }
    ],
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Kore"
          }
        }
      }
    }
  }'
```

### Exemple de réponse

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          { "inlineData": { "mimeType": "audio/pcm", "data": "<base64>" } }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": []
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 12,
    "candidatesTokenCount": 0,
    "totalTokenCount": 12
  }
}
```

> Astuce : l'audio est inclus en base64 dans `inlineData.data` ; décodez-le selon `inlineData.mimeType` pour le lire. La facturation est basée sur les tokens d'entrée — l'audio synthétisé n'est pas facturé en tokens supplémentaires.
