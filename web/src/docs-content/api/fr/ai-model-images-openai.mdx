# openai

## Éditer une image

Crée une image éditée ou étendue à partir d'une image d'origine et d'un invite donnés.

`POST` `/v1/images/edits/`

### Corps de la requête (`multipart/form-data`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `image` | string（binary） | Oui | Image à modifier. Doit être un fichier PNG valide, de moins de 4 Mo, et carré. Si aucun masque n'est fourni, l'image doit avoir de la transparence, qui sera utilisée comme masque. |
| `mask` | string（binary） | Non | Image supplémentaire dont les zones totalement transparentes (par ex. alpha nul) indiquent où l'image doit être éditée. Doit être un fichier PNG valide, de moins de 4 Mo, et de même dimension que l'image d'origine. |
| `prompt` | string | Oui | Description textuelle de l'image souhaitée. Longueur maximale de 1000 caractères. |
| `n` | string | Non | Nombre d'images à générer. Doit être compris entre 1 et 10. |
| `size` | string | Non | Taille de l'image générée. Doit être l'une de `256x256`, `512x512` ou `1024x1024`. |
| `response_format` | string | Non | Format de retour de l'image générée. Doit être `url` ou `b64_json`. |
| `user` | string | Non | Identifiant unique représentant votre utilisateur final, aide OpenAI à surveiller et détecter les abus. [En savoir plus](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids). |
| `model` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Réponse |

## Générer des images

Crée une image à partir d'un invite. [En savoir plus](https://platform.openai.com/docs/guides/images).

`POST` `/v1/images/generations/`

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `model` | string | Non | Modèle utilisé pour la génération d'images. L'un de `dall-e-2`, `dall-e-3` ou `gpt-image-1`. Par défaut `dall-e-2`, sauf si des paramètres spécifiques à `gpt-image-1` sont utilisés. |
| `prompt` | string | Oui | Description textuelle de l'image souhaitée. Longueur maximale de 32000 caractères pour `gpt-image-1`, 1000 pour `dall-e-2`, 4000 pour `dall-e-3`. |
| `n` | integer | Non | Nombre d'images à générer. Doit être compris entre 1 et 10. Pour `dall-e-3`, seul `n=1` est pris en charge. |
| `size` | string | Non | Taille de l'image générée. Pour `gpt-image-1`, doit être l'une de `1024x1024`, `1536x1024` (paysage), `1024x1536` (portrait) ou `auto` (défaut) ; pour `dall-e-2`, l'une de `256x256`, `512x512` ou `1024x1024` ; pour `dall-e-3`, l'une de `1024x1024`, `1792x1024` ou `1024x1792`. |
| `background` | string | Non | Permet de définir la transparence de l'arrière-plan de l'image générée. Ce paramètre ne prend en charge que `gpt-image-1`. Doit être l'un de `transparent`, `opaque` ou `auto` (défaut). Avec `auto`, le modèle détermine automatiquement le meilleur arrière-plan. Si `transparent`, le format de sortie doit prendre en charge la transparence, donc doit être défini sur `png` (défaut) ou `webp`. |
| `moderation` | string | Non | Contrôle le niveau de modération de contenu des images générées par `gpt-image-1`. Doit être `low` pour un filtrage moins restrictif ou `auto` (défaut). |
| `quality` | string | Non | Qualité de l'image générée. |
| `stream` | string | Non | — |
| `style` | string | Non | — |
| `user` | string | Non | — |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Réponse |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
| `usage.total_tokens` | integer | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.input_tokens_details.text_tokens` | integer | — |
| `usage.input_tokens_details.image_tokens` | integer | — |
