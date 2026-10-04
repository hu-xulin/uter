# Format de l'API MiniMax

Génération vidéo MiniMax H3 (`MiniMax-H3`) : appelez MiniMax H3 via une API de tâches asynchrone, avec prise en charge de la génération texte vers vidéo, image vers vidéo et référence vers vidéo, facturée précisément selon l'usage en amont.

## Modèle et capacités

Il existe un seul nom de modèle, `MiniMax-H3`. **Le mode de génération est déterminé automatiquement selon les entrées média portées par la requête :**

| Mode | Déclencheur | Entrée média |
|---|---|---|
| Texte vers vidéo (t2v) | Uniquement `prompt` | Aucune |
| Image vers vidéo (i2v) | Une image de première image (image de dernière image facultative) | `input_reference` / `images` |
| Référence vers vidéo (r2v) | Image / vidéo / audio de référence | Tableau `media[]` de premier niveau |

Dans tous les modes, `prompt` est **toujours requis**.

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
| `model` | string | Oui | Fixé à `MiniMax-H3` |
| `prompt` | string | Oui | Prompt textuel |
| `resolution` | string | Non | Résolution ; actuellement uniquement `2K` (par défaut `2K`) |
| `duration` | int | Non | Durée de la vidéo en secondes, `4`–`15`, par défaut `6` |
| `ratio` | string | Non | Rapport d'aspect : `16:9` / `9:16` / `1:1` / `adaptive`. Par défaut `16:9` pour t2v et `adaptive` (suit la première image) pour i2v |
| `input_reference` | string | Non | URL de l'image de première image i2v (publique, ou base64) |
| `images` | string[] | Non | Tableau d'images i2v : la 1re est la première image, la 2e est la dernière image |
| `media` | object[] | Non | Entrée média structurée pour la référence vers vidéo, voir ci-dessous |

### Éléments `media[]`

Utilisés pour la référence vers vidéo (r2v) afin de préciser le rôle de chaque ressource de référence :

| `type` | Rôle | Finalité |
|---|---|---|
| `reference_image` | Image de référence | Image(s) de référence |
| `reference_video` | Vidéo de référence | Vidéo de référence (sa durée facturable compte dans les secondes totales) |
| `reference_audio` | Audio de référence | Audio de référence |
| `first_frame` / `last_frame` | Première / dernière image | Images de première / dernière image pour i2v |

Lorsque le `media` structuré est omis, Uter déduit les ressources à partir de `images` / `input_reference` selon l'extension et l'ordre : vidéo → vidéo de référence, audio → audio de référence, 1re image → première image, 2e image → dernière image. Utilisez `media[]` lorsque vous devez contrôler précisément les rôles.

> L'audio de référence (`reference_audio`) est actuellement limité par la prise en charge en amont : lors des tests, l'amont renvoie un échec de tâche (Uter rembourse intégralement et automatiquement). La génération texte vers vidéo, image vers vidéo (première image / première + dernière image) et par image/vidéo de référence fonctionne normalement.

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

> `id` / `task_id` est généré par Uter et n'est pas le task_id MiniMax en amont.

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
| `data.status` | string | Statut de la tâche : `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | URL du résultat vidéo (non vide uniquement sur `SUCCESS`) |
| `data.quota` | int | Quota final facturé (déjà réglé sur l'usage réel) |
| `data.data.task.usage` | object | Usage en amont précis, base de facturation (`total_seconds` / `input_seconds` / `output_seconds` / `input_image_count`) |

#### Énumération des statuts

| Statut unifié | Statut MiniMax | Description |
|---|---|---|
| `QUEUED` | `queued` / `preparing` | En file d'attente |
| `IN_PROGRESS` | `running` | Génération en cours |
| `SUCCESS` | `succeeded` | Terminée ; `result_url` contient la vidéo |
| `FAILURE` | `failed` / `cancelled` / `expired` | Échec ; `fail_reason` explique pourquoi |

## Facturation

MiniMax H3 facture selon **l'usage réel en amont** :

```
cost(USD) = total_billed_seconds × resolution_price + billable_reference_images × $0.04
where: total_billed_seconds = input_reference_video_seconds + generated_video_seconds
```

| Résolution | Prix |
|---|---|
| `2K` | 0,13 $ / seconde |
| `768P` | 0,09 $ / seconde (pas encore disponible) |

Points clés :

- **La vidéo de référence en entrée est également facturée** : pour r2v, la durée facturable d'une vidéo de référence est comptée au prix de la résolution de sortie.
- **Les images de référence sont facturées séparément** : 0,04 $ par image de référence facturable.
- **Pré-débité à la soumission, réglé à l'achèvement** : une charge provisoire est prélevée à la soumission, puis Uter recalcule précisément à partir de l'`usage` en amont en cas de succès, en remboursant ou en débitant la différence.

## Exemple complet

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "A cat dozing in the sunlight, fur gently swaying in the breeze",
    "resolution": "2K",
    "duration": 6,
    "ratio": "16:9"
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

Référence vers vidéo à l'aide du tableau `media[]` de premier niveau :

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "Generate a coherent video from the given assets",
    "resolution": "2K",
    "duration": 6,
    "media": [
      { "type": "reference_image", "url": "https://example.com/ref.jpg" },
      { "type": "reference_video", "url": "https://example.com/ref.mp4" }
    ]
  }'
```

## Codes d'état et erreurs

| Cas | Description |
|---|---|
| `prompt` manquant | `400`, `prompt is required` (rejeté avant soumission, aucun débit) |
| `401` / `403` | Clé d'API invalide / non autorisée à accéder à ce modèle |
| `402` | Solde insuffisant (`insufficient user quota`) ; rechargez dans la console Uter |
| Tâche `FAILURE` | La génération en amont a échoué, voir `fail_reason` ; Uter rembourse automatiquement |
