# Format de l'API PixVerse

Génération vidéo PixVerse : appelez toute la famille de modèles PixVerse (C1 / V6 / V5.6 / V5.5 / V5 / V4.5 / V4 / V3.5) via le point de terminaison compatible OpenAI `/v1/videos`, avec prise en charge de la génération texte vers vidéo et image vers vidéo.

## Modèles pris en charge

Dans le champ `model`, utilisez toujours la forme `PixVerse/<version>`, par ex. `PixVerse/v5.6`.

| Modèle | Points forts | Paliers de durée | Audio |
|---|---|---|---|
| `PixVerse/c1` | Modèle phare, facturation à la seconde la plus flexible | 1–15 s (à la seconde) | ✓ |
| `PixVerse/v6` | Dernière génération, facturation à la seconde | 1–15 s (à la seconde) | ✓ |
| `PixVerse/v5.6` | Mode clip unique, qualité stable | 5 / 8 / 10 s | ✓ |
| `PixVerse/v5.5` | Prend en charge l'assemblage multi-clips | 5 / 8 / 10 s | ✓ |
| `PixVerse/v5` | Version de base de 5e génération | 5 / 8 s | ✗ |
| `PixVerse/v4.5` | 4,5e génération, prend en charge Fast Motion | 5 / 8 s | ✗ |
| `PixVerse/v4` | 4e génération, prend en charge Fast Motion | 5 / 8 s | ✗ |
| `PixVerse/v3.5` | 3,5e génération, prend en charge Fast Motion | 5 / 8 s | ✗ |

> Le préfixe `PixVerse/` est sensible à la casse ; utilisez exactement `PixVerse/v5.6`. La partie version (`v5.6`, `c1`) est normalisée sans distinction de casse.

## Créer une vidéo

`POST` `/v1/videos`

### En-têtes de requête

| En-tête | Requis | Description |
|---|---|---|
| `Authorization` | Oui | `Bearer sk-your-api-key` |
| `Content-Type` | Oui | `application/json` |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | Nom du modèle PixVerse, voir le tableau ci-dessus |
| `prompt` | string | Oui | Prompt vidéo, jusqu'à 2048 caractères |
| `image` | string | Non | Image source pour l'image vers vidéo (URL ou data URI base64) ; sa présence bascule en image vers vidéo |
| `images` | string[] | Non | Forme tableau de `image` (mutuellement exclusif avec `image`) |
| `duration` | int | Non | Durée en secondes, 5 par défaut ; les paliers pris en charge varient selon le modèle |
| `resolution` | string | Non | Palier de résolution (identique à `size`, recommandé pour l'harmonisation entre modèles) : `720P` / `1080P` |
| `size` | string | Non | Résolution : `360p` `540p` `720p` `1080p`, ou forme en pixels comme `1920x1080`. Si les deux sont envoyés, `resolution` l'emporte |
| `metadata` | object | Non | Conteneur des paramètres propres à PixVerse, voir ci-dessous |

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

> `id` / `task_id` est généré par Uter et n'est pas le `video_id` PixVerse en amont. Utilisez toujours la valeur renvoyée ici.

## Obtenir le statut de la tâche vidéo

`GET` `/v1/videos/{task_id}`

### Paramètres de requête

| Nom | Emplacement | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | Identifiant de la tâche vidéo |

### Réponse

| Statut | Description |
|---|---|
| `200` | Statut de la tâche récupéré avec succès |
| `404` | Tâche introuvable |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant de la vidéo |
| `status` | string | Statut de la tâche, voir l'énumération |
| `progress` | integer | Pourcentage de progression |
| `created_at` | integer | Horodatage de création |
| `completed_at` | integer | Horodatage d'achèvement (en cas de succès) |
| `size` | string | Taille de la vidéo (en cas de succès) |
| `metadata.url` | string | URL de la vidéo (uniquement lorsque `completed`) |
| `error.message` | string | Raison de l'échec (uniquement lorsque `failed`) |

#### Énumération des statuts

| Statut | Description |
|---|---|
| `queued` | Soumise, en file d'attente |
| `in_progress` | Génération en cours |
| `completed` | Terminée ; `metadata.url` contient la vidéo |
| `failed` | Échec ; `error.message` explique pourquoi |

## Obtenir le contenu vidéo

`GET` `/v1/videos/{task_id}/content`

Renvoie le flux vidéo brut (`Content-Type: video/mp4`). Uter relaie l'URL temporaire de PixVerse, ce qui évite d'exposer l'adresse en amont et le problème d'expiration.

### Paramètres de requête

| Nom | Emplacement | Type | Requis | Description |
|---|---|---|---|---|
| `task_id` | path | string | Oui | Identifiant de la tâche vidéo |

### Réponse

| Statut | Description |
|---|---|
| `200` | Contenu vidéo récupéré avec succès |
| `404` | Vidéo introuvable ou non terminée |

> **Fortement recommandé** : téléchargez via le proxy `/content` plutôt que d'accéder directement à `metadata.url`. Ce dernier est un lien temporaire PixVerse (généralement valable quelques heures), tandis que le proxy n'expire jamais tant que l'enregistrement de la tâche existe.

## Paramètres spécifiques (`metadata`)

Tous les champs propres à PixVerse sont transmis via l'objet `metadata` du corps de la requête.

### Champs généraux

| Champ | Type | S'applique à | Description |
|---|---|---|---|
| `quality` | string | Tous | Résolution ; prime sur le `size` de premier niveau : `360p` `540p` `720p` `1080p` |
| `aspect_ratio` | string | Texte vers vidéo | Rapport d'aspect : `16:9` `9:16` `1:1` `4:3` `3:4` `2:3` `3:2` `21:9` |
| `motion_mode` | string | V4.5 / V4 / V3.5 | Mode de mouvement : `normal` (par défaut) ou `fast` (prix ×2 ; uniquement 5 s en 360p/540p/720p) |
| `camera_movement` | string | Tous | Mouvement de caméra, par ex. `zoom_in` `zoom_out` `pan_left` `pan_right` |
| `seed` | int | Tous | Graine aléatoire, 0–2147483647 |
| `template_id` | int | Tous | Identifiant de modèle |
| `style` | string | Tous | Style, par ex. `anime` |
| `water_mark` | bool | Tous | Ajouter ou non un filigrane |
| `negative_prompt` | string | Tous | Prompt négatif |

> `motion_mode: fast` est strictement limité à V4.5 / V4 / V3.5, une durée de 5 secondes et 360p/540p/720p. Les autres combinaisons (par ex. `1080p + fast` ou `8s + fast`) renvoient `400` et ne sont pas facturées.

### Génération audio (C1 / V6 / V5.6 / V5.5)

| Champ | Type | S'applique à | Description |
|---|---|---|---|
| `generate_audio_switch` | bool | C1 / V6 / V5.6 / V5.5 | Basculer vers le palier de facturation « avec audio » (audio généré en amont) |

> V5 / V4.5 / V4 / V3.5 ne prennent **pas** en charge l'audio ; transmettre `generate_audio_switch: true` renvoie `400`.

### Champs avancés d'image vers vidéo

L'image vers vidéo PixVerse nécessite de téléverser l'image en amont pour obtenir un `img_id`. Uter **encapsule automatiquement le flux de téléversement** : transmettez `image: "https://..."` ou `image: "data:image/png;base64,..."` dans le corps et Uter la téléverse vers PixVerse, récupère l'`img_id` et le transmet.

Si vous disposez déjà d'un `img_id` (cas avancé), transmettez-le directement :

| Champ | Type | Description |
|---|---|---|
| `img_id` | int | Identifiant d'image pré-téléversé ; prime sur le téléversement automatique depuis `image` |

## Exemple complet

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "PixVerse/v5.6",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "size": "720p",
    "metadata": { "aspect_ratio": "16:9", "seed": 42 }
  }'

# Step 2: poll the task status (every 3~5 seconds)
curl https://uter.ai/v1/videos/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once completed, download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## Codes d'état et erreurs

| Cas | Description |
|---|---|
| `400` | Combinaison de paramètres invalide (par ex. `generate_audio_switch: true` sur V5, mode fast avec 1080p/8s, qualité × durée non pris en charge, modèle inconnu) ; rejetée avant soumission, aucun débit |
| `401` | Clé d'API invalide ou expirée |
| `403` | Clé d'API non autorisée à accéder à ce modèle (vérifiez la liste blanche de modèles du jeton) |
| `402` | Solde insuffisant (`insufficient user quota`) ; rechargez dans la console Uter |
| Tâche `failed` | Échec en amont (modération / génération / délai dépassé) ; Uter rembourse automatiquement et le remboursement apparaît dans les journaux |
