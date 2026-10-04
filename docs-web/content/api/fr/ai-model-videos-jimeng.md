# Génération vidéo Jimeng

## Génération vidéo Jimeng

Interface de génération vidéo au format d'API officiel Jimeng.

Prend en charge la spécification du type d'opération via le paramètre Action :
- `CVSync2AsyncSubmitTask` : soumettre une tâche de génération vidéo
- `CVSync2AsyncGetResult` : récupérer le résultat de la tâche

Vous devez spécifier Action et Version dans les paramètres de requête.

`POST` `/jimeng/`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `Action` | query | enum（`CVSync2AsyncSubmitTask`, `CVSync2AsyncGetResult`） | Oui | Type d'opération API |
| `Version` | query | string | Oui | Version de l'API |

### Corps de la requête (`application/json`)

| Champ | Type | Requis | Description |
|---|---|---|---|
| `req_key` | string | Non | Identifiant du type de requête |
| `prompt` | string | Non | Description textuelle |
| `binary_data_base64` | array&lt;string&gt; | Non | Données image encodées en Base64 |

### Réponse

| Code d'état | Description |
|---|---|
| `200` | Requête traitée avec succès |
| `400` | Erreur de paramètres de requête |

#### Champs de la réponse `200`

| Champ | Type | Description |
|---|---|---|
| `code` | integer | Code de réponse |
| `message` | string | Message de réponse |
| `data` | object | Données de réponse |

#### Champs de la réponse `400`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |
