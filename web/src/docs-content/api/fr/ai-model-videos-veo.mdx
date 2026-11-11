# Format de l'API Google Veo

Génération vidéo Google Veo 3.1 : appelez toute la famille de modèles Veo 3.1 via une API de tâches asynchrone, avec prise en charge de la génération texte vers vidéo et image vers vidéo, avec audio synchronisé facultatif (jusqu'à la sortie 4K).

## Modèles pris en charge

Les trois modèles partagent un même point de terminaison et ne se distinguent que par le champ `model`. Chaque modèle prend en charge la génération texte vers vidéo et image vers vidéo, avec génération audio facultative.

| Identifiant de modèle | Version | Points forts | Idéal pour |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | Qualité la plus élevée, 4K, audio natif | Travaux créatifs et commerciaux de haute qualité |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | Plus rapide, qualité équilibrée | Itération rapide, génération par lots |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | Le plus rapide, coût le plus faible | Prototypage, cas sensibles au coût |

## Créer une vidéo

`POST` `/v1/video/generations`

### En-têtes de requête

| En-tête | Requis | Description |
|---|---|---|
| `Authorization` | Oui | `Bearer sk-your-api-key` |
| `Content-Type` | Oui | `application/json` |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | Identifiant de modèle Veo 3.1, voir le tableau ci-dessus |
| `prompt` | string | Oui | Prompt vidéo ; chinois et anglais pris en charge, anglais recommandé pour les meilleurs résultats |
| `size` | string | Non | Résolution : `720p` / `1080p` / `4000` (4K, certains modèles uniquement), `1080p` par défaut |
| `resolution` | string | Non | Identique à `size` (recommandé, conforme à l'amont ; l'emporte lorsque les deux sont définis) |
| `duration` | int | Non | Durée en secondes : `4` / `6` / `8`, `8` par défaut |
| `seconds` | string | Non | Forme chaîne de `duration` (pour la compatibilité avec l'API OpenAI Sora) |
| `aspect_ratio` | string | Non | Rapport d'aspect : `16:9` / `9:16`, `16:9` par défaut |
| `generate_audio` | bool | Non | Générer un audio synchronisé (parole, effets, ambiance). **`true` par défaut** ; définissez explicitement `false` pour économiser |
| `negative_prompt` | string | Non | Prompt négatif décrivant ce qu'il faut éviter |
| `image` | string | Non | Image de première image i2v ; URL HTTP(S) / data URI / base64 brut |
| `images` | string[] | Non | Tableau d'images de première image i2v ; seul `images[0]` est utilisé, et `image` l'emporte si les deux sont envoyés |
| `last_frame_image` | string | Non | Image de dernière image (avec `image` / `images[0]` → interpolation première + dernière image, exclusif à Veo 3.1). Même format que `image` |
| `reference_images` | string[] | Non | Images de référence, jusqu'à 3 ; envoyées en amont avec `referenceType="asset"`. **Mutuellement exclusif avec `image` / `last_frame_image`**, et pris en charge uniquement pour `duration=8` |
| `metadata` | object | Non | Conteneur des paramètres natifs Veo, voir « Paramètres avancés metadata » |

> Les champs snake_case de premier niveau tels que `generate_audio` / `negative_prompt` / `aspect_ratio` sont automatiquement mappés vers les paramètres camelCase en amont. Vous pouvez aussi les placer dans `metadata` (snake_case ou camelCase), ce qui équivaut au premier niveau.
>
> `generate_audio: true` augmente considérablement le coût (environ ×2). Comme la valeur par défaut de facturation est `true`, définissez explicitement `generate_audio: false` lorsque l'audio n'est pas nécessaire.

### Réponse

| Statut | Description |
|---|---|
| `200` | Tâche vidéo créée avec succès |
| `400` | Paramètres de requête invalides |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` / `task_id` | string | Identifiant public de tâche (préfixe `task_`) utilisé pour les requêtes ultérieures |
| `object` | string | Type d'objet (`video`) |
| `model` | string | Modèle utilisé |
| `status` | string | Statut de la tâche (`queued` juste après la soumission) |
| `progress` | integer | Pourcentage de progression |
| `created_at` | integer | Horodatage de création |

## Obtenir le statut de la tâche vidéo

`GET` `/v1/video/generations/{task_id}`

La réponse utilise l'enveloppe unifiée `{code, message, data}` d'Uter.

### Paramètres de requête

| Nom | Emplacement | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | Identifiant de la tâche vidéo |

### Réponse

| Statut | Description |
|---|---|
| `200` | Statut de la tâche récupéré avec succès |
| `404` | Tâche introuvable |

#### Champs de la réponse `200` (`data`)

| Champ | Type | Description |
|---|---|---|
| `data.task_id` | string | Identifiant de tâche |
| `data.status` | string | Statut de la tâche : `queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | Raison de l'échec ; `null` en cas de succès |
| `data.format` | string / null | Format de sortie (par ex. `mp4`) ; `null` pendant le traitement ou en cas d'échec |
| `data.metadata` | object / null | Métadonnées supplémentaires |
| `data.url` | string / null | URL de téléchargement de la vidéo ; `null` pendant le traitement ou en cas d'échec (lien signé temporaire, valable 24 heures) |

#### Énumération des statuts

| Statut | Description |
|---|---|
| `queued` | Soumise, en attente de traitement |
| `processing` | Génération en cours |
| `succeeded` | Terminée ; `data.url` contient l'adresse de téléchargement |
| `failed` | Échec ; `data.error` explique pourquoi |

## Formats d'entrée image

`image` / `images[0]` acceptent les trois formats suivants ; Uter les détecte et les convertit vers le base64 intégré qu'attend Veo :

| Format | Exemple | Description |
|---|---|---|
| URL HTTP(S) | `https://example.com/foo.png` | Téléchargée et encodée en base64 par le backend ; l'URL doit être publiquement accessible et non expirée |
| data URI | `data:image/png;base64,iVBOR...` | Données intégrées transmises directement ; aucun réseau requis |
| base64 brut | `iVBORw0KGgo...` (sans préfixe) | Base64 nu ; le type MIME est détecté automatiquement |

Limites : taille décodée ≤ **20 Mo** ; délai de téléchargement de l'URL **30 secondes** ; les échecs d'analyse (URL injoignable / trop volumineux / base64 invalide) renvoient `400 parse images[0] failed: ...` **sans facturation**. Les URI GCS natifs `gs://` ne sont pas pris en charge ; utilisez `https://storage.googleapis.com/...` à la place.

## Paramètres avancés metadata

`metadata` est un conteneur de paramètres natif Veo pour les options avancées absentes du style OpenAI. Tous les champs de premier niveau peuvent aussi être placés dans `metadata` (snake_case ou camelCase).

| Champ | Type | Description |
|---|---|---|
| `seed` | int | Graine aléatoire (emplacement recommandé) |
| `personGeneration` / `person_generation` | string | Politique de génération de personnes : `allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | Écrire le résultat directement dans un chemin de bucket GCS (canal vertex uniquement ; nécessite des permissions) |
| `compressionQuality` / `compression_quality` | string | Qualité de compression : `optimized` (par défaut) / `lossless` |
| `resizeMode` / `resize_mode` | string | Mode de redimensionnement i2v : `crop` / `fit` |
| `sampleCount` / `sample_count` | int | Nombre de vidéos par requête ; **actuellement fixé à 1**, toute valeur est ignorée |

> Priorité : camelCase déjà présent dans metadata > snake_case dans metadata > champs de premier niveau.

## Comparaison des modèles

| Élément | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **Identifiant de modèle** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **Qualité** | La plus élevée | Équilibrée | Basique |
| **Vitesse (mesurée, vidéo 8 s)** | 90–130 s | 75–105 s | 50–80 s |
| **Résolution maximale** | 4K | 1080p | 1080p |
| **Prise en charge audio** | ✓ | ✓ | ✓ |
| **Image vers vidéo** | ✓ | ✓ | ✓ |

## Point de terminaison compatible OpenAI

En plus de `/v1/video/generations`, un point de terminaison `/v1/videos` de style OpenAI est disponible ; les deux sont entièrement équivalents.

- Soumission : `POST` `/v1/videos` (champs de corps identiques)
- Requête : `GET` `/v1/videos/{task_id}` (renvoie le format plat OpenAI)

> La réponse de requête compatible OpenAI n'inclut pas l'URL de la vidéo. Pour obtenir l'adresse de téléchargement, utilisez `/v1/video/generations/{task_id}` et lisez `data.url`.

## Facturation

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0 (groupe par défaut en production)
```

### Vidéo seule (`generate_audio: false`)

| Modèle | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | 0,20 $ / s | 0,20 $ / s | 0,40 $ / s |
| `veo-3.1-fast-generate-001` | 0,08 $ / s | 0,10 $ / s | 0,25 $ / s |
| `veo-3.1-lite-generate-001` | 0,03 $ / s | 0,05 $ / s | — |

### Vidéo + audio (`generate_audio: true`)

| Modèle | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | 0,40 $ / s | 0,40 $ / s | 0,60 $ / s |
| `veo-3.1-fast-generate-001` | 0,10 $ / s | 0,12 $ / s | 0,30 $ / s |
| `veo-3.1-lite-generate-001` | 0,05 $ / s | 0,08 $ / s | — |

Sur `failed`, Uter rembourse automatiquement.

## Exemple complet

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# Poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Once data.status == "succeeded", download from data.url
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

Interpolation première + dernière image (exclusif à Veo 3.1) :

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` ne peut pas être combiné avec `image` / `images` / `last_frame_image`, sinon `400 reference_images is mutually exclusive ...` est renvoyé.
- `reference_images` accepte au plus 3 entrées ; au-delà, `400 reference_images supports at most 3 entries` est renvoyé.
- `reference_images` n'est pris en charge que pour `duration=8`.

## Codes d'état et erreurs

| Statut | Raison | Action |
|---|---|---|
| `400` | Erreur de paramètre (`prompt` manquant, `duration` invalide, ou échec d'analyse d'image `parse images[0] failed: ...`) | Vérifiez les champs du corps de la requête |
| `401` | Clé d'API invalide ou expirée | Vérifiez l'en-tête `Authorization` |
| `403` | Clé d'API non autorisée à accéder à ce modèle | Vérifiez la liste blanche de modèles du jeton |
| `402` | Solde insuffisant | Rechargez dans la console Uter |

Causes courantes de `failed` : rejet par la sécurité du contenu (ajustez le prompt ; ajoutez `negative_prompt`), URL d'image injoignable, `duration` hors plage, ou 4K demandé sur le modèle Lite.
