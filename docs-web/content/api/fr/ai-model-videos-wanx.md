# Format de l'API Wanx

Génération vidéo Wan 2.7 : appelez toute la famille de modèles Wan 2.7 via une API de tâches asynchrone, avec prise en charge de la génération texte vers vidéo, image vers vidéo, référence vers vidéo et du montage vidéo, avec sortie 1080P, vidéos jusqu'à 15 secondes, narration multi-coups et synchronisation audio native.

## Modèles pris en charge

Les quatre modèles partagent un même point de terminaison, `/v1/video/generations`, et ne se distinguent que par le champ `model` ; la forme de la réponse est identique.

| Modèle | Capacité | Entrée média requise | Description |
|---|---|---|---|
| `wan2.7-t2v` | Texte vers vidéo | — | Génère une vidéo à partir de texte ; prend en charge la narration multi-coups et la synchronisation audio |
| `wan2.7-i2v` | Image vers vidéo | 1 image de première image | Anime à partir d'une image de première image en suivant le prompt |
| `wan2.7-r2v` | Référence vers vidéo | 1–9 images de référence | Référence multi-images préservant la cohérence du sujet ; référencez les images via `[Image N]` |
| `wan2.7-videoedit` | Montage vidéo | 1 vidéo + 0–3 images de référence | Transfert de style, remplacement d'éléments et retouches locales via des instructions textuelles |

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
| `model` | string | Oui | Nom du modèle Wan 2.7, voir le tableau ci-dessus |
| `prompt` | string | Oui | Prompt textuel, jusqu'à 5000 caractères, chinois et anglais pris en charge |
| `resolution` | string | Non | Palier de résolution : `720P` / `1080P`, `720P` par défaut. **Recommandé** ; correspond au nom de champ officiel Alibaba Cloud |
| `size` | string | Non | Nom de champ hérité. Lorsque les deux sont envoyés, `resolution` l'emporte ; lorsque seul `size` est envoyé, sa valeur est utilisée comme résolution. Les nouvelles intégrations doivent utiliser `resolution` |
| `duration` | int | Non | Durée en secondes : `2`–`15` pour t2v/i2v, `5` par défaut ; `2`–`10` pour r2v avec une vidéo de référence ; ignoré pour `videoedit` (suit la vidéo d'entrée, 15 s max.) |
| `input_reference` | string | Non | Uniquement i2v : URL publique de l'image de première image |
| `images` | array | Non | Uniquement videoedit : tableau d'URL médias ; le 1er élément est la vidéo à monter (MP4/MOV), les restants sont des images de référence facultatives (3 max.) |
| `metadata` | object | Non | Conteneur des paramètres propres à Wan 2.7, voir ci-dessous |

> Le champ `images` est en période de transition : avant la publication, transmettez les médias via le tableau `metadata.input.media` ; après, le système déduit les types de médias à partir des extensions d'URL et `images` peut être utilisé directement.

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

> `id` / `task_id` est généré par Uter et n'est pas le task_id DashScope en amont. Utilisez toujours la valeur renvoyée ici.

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
| `data.task_id` | string | Identifiant public de tâche |
| `data.status` | string | Statut de la tâche : `NOT_START` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | URL du résultat vidéo (non vide uniquement sur `SUCCESS` ; lien signé OSS en amont valable 24 heures) |
| `data.fail_reason` | string | Raison de l'échec (non vide uniquement sur `FAILURE`) |
| `data.quota` | int | Quota brut facturé pour cette tâche |
| `data.progress` | string | Chaîne de progression, par ex. `"40%"` / `"100%"` |
| `data.properties.upstream_model_name` | string | Nom de modèle effectivement envoyé en amont |
| `data.data` | object | Réponse DashScope brute en amont (`output.video_url`, `usage`, `request_id`) |

#### Énumération des statuts

| Statut | Statut en amont | Description |
|---|---|---|
| `NOT_START` | `PENDING` | Créée, pas encore traitée |
| `QUEUED` | `PENDING` | File d'attente en amont |
| `IN_PROGRESS` | `RUNNING` | Génération en cours |
| `SUCCESS` | `SUCCEEDED` | Terminée ; `result_url` contient la vidéo |
| `FAILURE` | `FAILED` / `CANCELED` / `UNKNOWN` | Échec ; `fail_reason` explique pourquoi |

## Paramètres spécifiques (`metadata`)

Transmettez les éléments suivants via l'objet `metadata` du corps de la requête ; Uter les transmet à DashScope en amont.

### Paramètres de contrôle généraux

| Champ | Type | S'applique à | Description | Par défaut |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | Rapport d'aspect : `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `seed` | int | Tous | Graine aléatoire, `0`–`2147483647` ; générée automatiquement si omise | — |
| `negative_prompt` | string | Tous | Prompt négatif, jusqu'à 500 caractères | — |

> i2v ne prend pas en charge `ratio` ; le rapport d'aspect suit l'image de première image en entrée.

### Entrée multimédia (`metadata.input.media`)

Pour r2v et videoedit, transmettez les médias via le tableau `metadata.input.media` :

| `type` | Finalité | Limite de nombre |
|---|---|---|
| `reference_image` | Image de référence | r2v : 1–9 ; videoedit : 0–3 |
| `video` | Vidéo à monter (videoedit uniquement) | Exactement 1 |
| `first_frame` | Image de première image (i2v uniquement ; peut aussi utiliser le `input_reference` de premier niveau) | Exactement 1 |

Pour r2v, référencez les images de référence par leur ordre dans le tableau via `[Image 1]`, `[Image 2]` dans le prompt.

### Contraintes médias

| Type | Format | Résolution | Taille | Autres limites |
|---|---|---|---|---|
| Image (première image i2v) | JPEG / JPG / PNG / WEBP | 240–8000 px | ≤ 10 Mo | Rapport d'aspect 1:8 – 8:1 |
| Image (référence r2v) | JPEG / JPG / PNG / WEBP | Petit côté ≥ 300 px | ≤ 10 Mo | Utilisez des images nettes |
| Image (référence videoedit) | JPEG / JPG / PNG / BMP / WEBP | 240–8000 px | ≤ 20 Mo | Rapport d'aspect 1:8 – 8:1 |
| Vidéo (entrée videoedit) | MP4 / MOV (H.264) | 240–4096 px | ≤ 100 Mo | 2–10 s, rapport d'aspect 1:8 – 8:1 |

## Point de terminaison compatible OpenAI

En plus de `/v1/video/generations`, un point de terminaison `/v1/videos` de style OpenAI est disponible ; les deux sont entièrement équivalents.

- Soumission : `POST` `/v1/videos` (champs de corps identiques)
- Requête : `GET` `/v1/videos/{task_id}` (renvoie le format plat OpenAI)

| Statut OpenAI | Statut unifié |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## Facturation

Wan 2.7 facture selon **les secondes × le facteur de résolution** :

| Résolution | Prix | Exemple sur 5 secondes |
|---|---|---|
| `720P` | 0,10 $ / seconde | 0,50 $ |
| `1080P` | 0,15 $ / seconde | 0,75 $ |

```
quota = modelPrice × QuotaPerUnit × groupRatio × seconds × resolutionRatio

QuotaPerUnit    = 500,000
modelPrice      = 0.10 (all wan2.7 models)
groupRatio      = 1.0 (production default group)
resolutionRatio = 720P → 1.0, 1080P → 1.5
```

Sur `FAILURE`, Uter rembourse automatiquement.

## Exemple complet

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-t2v",
    "prompt": "A kitten running under the moonlight, fur drifting in the wind, cinematic slow motion",
    "resolution": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42 }
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

Pour videoedit, transmettez les médias via le tableau `images` : le 1er MP4/MOV est la vidéo à monter et les entrées PNG/JPG/WEBP restantes sont des images de référence ; `duration` n'est pas requis (il suit la vidéo d'entrée).

## Codes d'état et erreurs

| Cas | Description |
|---|---|
| `400` | Erreur de paramètre (`prompt` manquant, modèle inconnu, `images` vide pour videoedit, …) ; rejetée avant soumission, aucun débit |
| `401` / `403` | Clé d'API invalide / non autorisée à accéder à ce modèle |
| `402` | Solde insuffisant (`insufficient user quota`) ; rechargez dans la console Uter |
| Tâche `FAILURE` | La génération en amont a échoué, voir `fail_reason` ; Uter rembourse automatiquement |

Causes courantes de `FAILURE` : `DataInspectionFailed` (rejet de sécurité en amont — ajustez le prompt ou les ressources), `input_reference` manquant pour i2v, zéro image de référence pour r2v, `images[0]` qui n'est pas en MP4/MOV pour videoedit, URL média injoignable, ou média ne respectant pas les contraintes ci-dessus.
