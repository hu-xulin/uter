# Format de l'API HappyHorse

Génération vidéo HappyHorse : appelez toute la famille de modèles HappyHorse 1.0 via une API de tâches asynchrone, avec prise en charge de la génération texte vers vidéo, image vers vidéo, référence vers vidéo et du montage vidéo.

## Modèles pris en charge

Les quatre modèles partagent un même point de terminaison, `/v1/video/generations`, et ne se distinguent que par le champ `model` ; la forme de la réponse est identique.

| Modèle | Capacité | Entrée média requise | Description |
|---|---|---|---|
| `happyhorse-1.0-t2v` | Texte vers vidéo | — | Génère une vidéo à partir d'une simple description textuelle |
| `happyhorse-1.0-i2v` | Image vers vidéo | 1 image de première image | Anime à partir d'une image de première image en suivant le prompt |
| `happyhorse-1.0-r2v` | Référence vers vidéo | 1–9 images de référence | Référence multi-images ; référencez les images via `[Image N]` dans le prompt |
| `happyhorse-1.0-video-edit` | Montage vidéo | 1 vidéo + 0–5 images de référence | Transfert de style, remplacement local et autres retouches sur une vidéo |

## Créer une vidéo

Soumettez une tâche de génération vidéo et recevez un identifiant de tâche ; interrogez le point de terminaison de statut pour obtenir le résultat.

`POST` `/v1/video/generations`

### En-têtes de requête

| En-tête | Requis | Description |
|---|---|---|
| `Authorization` | Oui | `Bearer sk-your-api-key` |
| `Content-Type` | Oui | `application/json` |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Oui | Nom du modèle HappyHorse, voir le tableau ci-dessus |
| `prompt` | string | Oui | Prompt textuel, jusqu'à 5000 caractères non chinois ou 2500 caractères chinois ; une saisie plus longue est tronquée |
| `size` | string | Non | Palier de résolution : `720P` / `1080P` ; par défaut `1080P` |
| `duration` | int | Non | Durée de la vidéo en secondes, `3`–`15`, par défaut `5` ; ignoré pour `video-edit` (suit la vidéo d'entrée, 15 s max.) |
| `input_reference` | string | Non | Uniquement i2v : URL publique de l'image de première image |
| `metadata` | object | Non | Conteneur des paramètres propres à HappyHorse, voir ci-dessous |

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
| `data.result_url` | string | URL du résultat vidéo (non vide uniquement sur `SUCCESS` ; lien signé OSS en amont, valable généralement 24 heures) |
| `data.fail_reason` | string | Raison de l'échec (non vide uniquement sur `FAILURE`) |
| `data.quota` | int | Quota brut facturé pour cette tâche |
| `data.progress` | string | Chaîne de progression, par ex. `"30%"` / `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | Horodatages Unix de soumission / début / fin (secondes) |
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

### Paramètres de contrôle vidéo

| Champ | Type | S'applique à | Description | Par défaut |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | Rapport d'aspect : `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `watermark` | bool | Tous | Ajouter ou non un filigrane (texte « Happy Horse » en bas à droite) | `true` |
| `seed` | int | Tous | Graine aléatoire, `0`–`2147483647` ; générée automatiquement si omise | — |
| `audio_setting` | string | video-edit | Contrôle audio : `auto` (contrôlé par le modèle) / `origin` (conserver l'audio d'origine) | `auto` |

> i2v ne prend pas en charge `ratio` ; le rapport d'aspect suit l'image de première image en entrée.

### Entrée multimédia (`metadata.input.media`)

r2v et video-edit transmettent les médias via le tableau `metadata.input.media` :

| `type` | Rôle | Limite de nombre |
|---|---|---|
| `reference_image` | Image de référence (prise en charge par r2v et video-edit) | r2v : 1–9 ; video-edit : 0–5 |
| `video` | Vidéo à monter (video-edit uniquement) | Exactement 1 |
| `first_frame` | Image de première image (i2v uniquement ; peut aussi utiliser le `input_reference` de premier niveau) | Exactement 1 |

Pour r2v, référencez les images de référence par leur ordre dans le tableau via `[Image 1]`, `[Image 2]` dans le prompt.

### Contraintes médias

| Type | Format | Résolution | Taille | Autres limites |
|---|---|---|---|---|
| Image (première image i2v) | JPEG / JPG / PNG / WEBP | Largeur et hauteur ≥ 300 px | ≤ 10 Mo | Rapport d'aspect 1:2,5 – 2,5:1 |
| Image (référence r2v) | JPEG / JPG / PNG / WEBP | Petit côté ≥ 400 px | ≤ 10 Mo | Utilisez des images nettes |
| Image (référence video-edit) | JPEG / JPG / PNG / WEBP | Largeur et hauteur ≥ 300 px | ≤ 10 Mo | Rapport d'aspect 1:2,5 – 2,5:1 |
| Vidéo (entrée video-edit) | MP4 / MOV (H.264) | Grand côté ≤ 2160, petit côté ≥ 320 | ≤ 100 Mo | 3–60 s, >8 fps, rapport 1:2,5 – 2,5:1 |

> Longueur de sortie video-edit : une entrée ≤ 15 s donne la même longueur ; une entrée > 15 s est tronquée aux 15 premières secondes.

## Point de terminaison compatible OpenAI

En plus de `/v1/video/generations`, un point de terminaison `/v1/videos` de style OpenAI est disponible ; les deux sont entièrement équivalents (même tâche en backend).

- Soumission : `POST` `/v1/videos` (champs de corps identiques)
- Requête : `GET` `/v1/videos/{task_id}` (renvoie le format plat OpenAI)

| Statut OpenAI | Statut unifié |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## Exemple complet

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "happyhorse-1.0-t2v",
    "prompt": "A cat dozing in the sunlight, fur gently swaying in the breeze",
    "size": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42, "watermark": false }
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

## Codes d'état et erreurs

| Cas | Description |
|---|---|
| `400` | Erreur de paramètre (`prompt` manquant, modèle inconnu, …) ; rejetée avant soumission, aucun débit |
| `401` / `403` | Clé d'API invalide / non autorisée à accéder à ce modèle (vérifiez la liste blanche de modèles du jeton) |
| `402` | Solde insuffisant (`insufficient user quota`) ; rechargez dans la console Uter |
| Tâche `FAILURE` | La génération en amont a échoué, voir `data.fail_reason` ; Uter rembourse automatiquement et le remboursement apparaît dans les journaux |

Causes courantes de `FAILURE` : rejet par la modération du contenu (ajustez le prompt), `input_reference` manquant pour i2v, zéro image de référence pour r2v, vidéo manquante pour video-edit, URL média injoignable, ou média ne respectant pas les contraintes ci-dessus.
