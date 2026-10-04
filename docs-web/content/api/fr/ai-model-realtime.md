# Format OpenAI natif

## Format OpenAI natif

Établit une connexion WebSocket pour un dialogue en temps réel.

**Note** : il s'agit d'un point de terminaison WebSocket, nécessitant une connexion via le protocole WebSocket.

Exemple d'URL de connexion : `wss://api.example.com/v1/realtime?model=gpt-4o-realtime`

`GET` `/v1/realtime`

### Paramètres de requête

| Nom du paramètre | Position | Type | Requis | Description |
|---|---|---|---|---|
| `model` | query | string | Non | Modèle à utiliser |

### Réponse

| Code d'état | Description |
|---|---|
| `101` | Basculement du protocole WebSocket |
| `400` | Erreur de requête |

#### Champs de la réponse `400`

| Champ | Type | Description |
|---|---|---|
| `error.message` | string | Message d'erreur |
| `error.type` | string | Type d'erreur |
| `error.param` | string | Paramètre concerné |
| `error.code` | string | Code d'erreur |
