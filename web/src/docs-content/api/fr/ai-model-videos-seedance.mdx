# Format de l'API Seedance

Génération vidéo Seedance (Dreamina) : appelez la famille de modèles Dreamina Seedance 2.0 via une API de tâches asynchrone, avec prise en charge de la génération texte vers vidéo, image vers vidéo et de la continuation / du montage vidéo.

## Modèles pris en charge

| Modèle | Description | Capacités |
|---|---|---|
| `dreamina-seedance-2-0` | Seedance 2.0 standard, qualité prioritaire | Texte vers vidéo, image vers vidéo, continuation vidéo |
| `dreamina-seedance-2-0-fast` | Seedance 2.0 rapide, latence réduite | Texte vers vidéo, image vers vidéo, continuation vidéo |

Les deux modèles prennent en charge **la vidéo en entrée** (continuation / montage) en transmettant `video_url` dans `metadata.content`.

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
| `model` | string | Oui | Nom du modèle Seedance, voir le tableau ci-dessus |
| `prompt` | string | Oui | Prompt vidéo |
| `image` | string | Non | Image de référence pour l'image vers vidéo (URL ou data URI base64) ; mutuellement exclusif avec `images` |
| `images` | string[] | Non | Référence multi-images (URL ou data URI base64) |
| `duration` | int | Non | Durée en secondes ; couramment 5 / 10, 5 par défaut |
| `seconds` | string | Non | Forme chaîne de `duration` (pour la compatibilité avec l'API OpenAI Sora). Doit être une chaîne numérique simple (par ex. `"5"`, `"10"`) sans unité. Prend effet uniquement lorsque `duration` de premier niveau vaut `0` ou est omis |
| `metadata` | object | Non | Conteneur des paramètres propres à Seedance, voir « Paramètres spécifiques » |

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

> `id` / `task_id` est généré par Uter et n'est pas l'identifiant de tâche en amont.

## Obtenir le statut de la tâche vidéo

`GET` `/v1/video/generations/{task_id}`

La réponse est une enveloppe `{code, message, data}` ; en cas de succès `code` vaut `"success"` et `data` est l'objet de détail de la tâche.

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
| `data.id` | int | Identifiant de tâche interne auto-incrémenté |
| `data.task_id` | string | Identifiant public de tâche (préfixe `task_`) |
| `data.platform` | string | Code de la plateforme en amont |
| `data.user_id` | int | Identifiant utilisateur |
| `data.group` | string | Nom du groupe |
| `data.channel_id` | int | Identifiant de canal réellement utilisé |
| `data.quota` | int | Quota brut facturé pour cette tâche |
| `data.action` | string | Action de la tâche, généralement `generate` |
| `data.status` | string | Statut de la tâche : `SUBMITTED` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.fail_reason` | string | Raison de l'échec (uniquement lorsque `status = FAILURE`) |
| `data.result_url` | string | URL du résultat vidéo (renvoyée uniquement en cas de succès ; lien temporaire en amont) |
| `data.progress` | string | Progression, par ex. `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | Horodatages Unix de soumission / début / fin (secondes) |
| `data.properties.upstream_model_name` | string | Nom de modèle effectivement envoyé en amont |
| `data.data` | object | Réponse brute en amont (`usage`, `content.video_url`, `resolution`, `framespersecond`, …) |

#### Énumération des statuts

| Statut | Description |
|---|---|
| `SUBMITTED` | Soumise |
| `QUEUED` | File d'attente en amont |
| `IN_PROGRESS` | Génération en cours |
| `SUCCESS` | Terminée ; `result_url` contient la vidéo |
| `FAILURE` | Échec ; `fail_reason` explique pourquoi |

## Obtenir le contenu vidéo

`GET` `/v1/videos/{task_id}/content`

Renvoie le flux vidéo brut (`Content-Type: video/mp4`). Uter relaie l'URL en amont.

### Paramètres de requête

| Nom | Emplacement | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | Identifiant de la tâche vidéo |

> **Fortement recommandé** : téléchargez via le proxy `/content` plutôt que d'accéder directement à `result_url`, qui est un lien temporaire en amont à durée de vie limitée.

## Paramètres spécifiques (`metadata`)

Tous les champs propres à Seedance sont transmis via l'objet `metadata` du corps de la requête et relayés en amont.

### Résolution / rapport d'aspect / durée

| Champ | Type | Description |
|---|---|---|
| `resolution` | string | Palier de résolution : `480p` `720p` `1080p` |
| `ratio` | string | Rapport d'aspect : `16:9` `9:16` `1:1` `4:3` `3:4` `21:9` `adaptive` |
| `duration` | int | Durée de la vidéo en secondes : `5` `10`. **Note :** `duration` (ou `seconds`) de premier niveau prime sur `metadata.duration` |
| `frames` | int | Nombre d'images (facultatif, mutuellement exclusif avec `duration`), par ex. `121` |
| `seed` | int | Graine aléatoire, `0` – `2^31-1` |

### Contrôle de la caméra et du contenu

| Champ | Type | Description |
|---|---|---|
| `camera_fixed` | bool | Fixer la caméra (`true` = statique) |
| `watermark` | bool | Ajouter ou non le filigrane officiel |

### Paramètres avancés

| Champ | Type | Description |
|---|---|---|
| `service_tier` | string | Palier de service influençant la vitesse et le quota (par ex. `auto` / `default` / `priority`) |
| `execution_expires_after` | int | Délai d'exécution de la tâche en secondes |
| `generate_audio` | bool | Générer ou non de l'audio |
| `draft` | bool | Mode brouillon (plus rapide et moins cher, qualité légèrement inférieure) |
| `return_last_frame` | bool | Renvoyer ou non l'image de dernière image dans la réponse |
| `callback_url` | string | URL de rappel notifiée à l'achèvement de la tâche |

### Entrée multimodale (tableau `content`)

Outre les champs `image` / `images` de premier niveau, vous pouvez transmettre un tableau d'entrée multimodale dans `metadata.content`, en mélangeant **images** et **vidéos** :

| `type` | Finalité |
|---|---|
| `image_url` + `image_url.url` | Référence image (image vers vidéo) |
| `video_url` + `video_url.url` | Entrée vidéo (continuation / montage) |

```json
{
  "model": "dreamina-seedance-2-0",
  "prompt": "Extend this video so the cat walks out of frame",
  "metadata": {
    "content": [
      { "type": "video_url", "video_url": { "url": "https://example.com/cat.mp4" } }
    ],
    "resolution": "720p"
  }
}
```

## Exemple complet

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-0",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "metadata": { "resolution": "720p", "ratio": "16:9", "seed": 42 }
  }'

# Poll the task
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## Codes d'état et erreurs

| Cas | Description |
|---|---|
| `400` | Modèle introuvable ou non autorisé (`model not allowed`), `prompt` vide (`prompt is required`), résolution / durée invalides |
| `401` / `403` | Clé d'API invalide / non autorisée à accéder à ce modèle (vérifiez la liste blanche de modèles du jeton) |
| `402` | Solde insuffisant (`insufficient user quota`) |
| Tâche `FAILURE` | Échec en amont (modération / URL d'image ou de vidéo injoignable / délai dépassé en amont) ; Uter rembourse automatiquement le débit |

Gestion suggérée : ajustez le prompt en cas d'échec de modération ; basculez en base64 lorsque les URLs sont injoignables ; réessayez plus tard ou basculez vers `dreamina-seedance-2-0-fast` en cas de délai dépassé en amont.
