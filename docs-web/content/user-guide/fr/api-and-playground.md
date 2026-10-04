# Utiliser l'API et le playground

## Playground

* Le playground sert à tester simplement les modèles IA en ligne et à se faire une idée de leur comportement. Vous pouvez saisir une question ou une instruction, échanger avec le modèle et consulter les résultats générés.
  


1. Choisir le groupe et le modèle : dans le coin inférieur droit du champ de saisie, sélectionnez le groupe de modèles disponible et le modèle précis à utiliser pour cette conversation.
2. Régler les paramètres de requête : cliquez sur le bouton de configuration des paramètres pour activer et ajuster les paramètres de génération tels que Temperature, Top P, Frequency Penalty, Presence Penalty et Max Tokens.
3. Saisir le contenu de la conversation : entrez vos questions, instructions ou invites dans le champ de saisie en bas ; la recherche, l'envoi de fichiers, l'envoi de photos, la capture d'écran et la prise de photo ne sont pas encore disponibles.
4. Envoyer la requête : une fois le modèle, les paramètres et le contenu saisis validés, cliquez sur le bouton « Envoyer » pour soumettre la requête.
5. Consulter les résultats : une fois la génération terminée, vous pouvez lire le contenu renvoyé dans la zone de conversation et poursuivre l'échange pour plusieurs tours.

<img alt="Page du playground" src="01-playground.webp" />

## Adresse de l'API et authentification

L'adresse compatible OpenAI de la passerelle est généralement la suivante :

```text
https://your-host/v1
```

Utilisez votre clé d'API comme jeton Bearer :

```http
Authorization: Bearer YOUR_API_KEY
```

Par exemple, avec les complétions de chat :

```bash
curl https://your-host/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}'
```

## Exemples de SDK

### Python (SDK OpenAI)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="https://your-host/v1",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

### Format natif Claude

```bash
curl https://your-platform.com/v1/messages \
  -H "x-api-key: sk-xxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Format natif Gemini

```bash
curl "https://your-platform.com/v1beta/models/gemini-1.5-pro:generateContent?key=sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

## Points de terminaison pris en charge

| Interface                              | Chemin                                  | Description                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat Completions                       | `POST /v1/chat/completions`             | Interface compatible OpenAI Chat Completions ; nécessite `model` et `messages`, et prend en charge les réponses en flux ou classiques.                                                              |
| Playground Chat                        | `POST /pg/chat/completions`             | Interface réservée au playground web : la session de connexion sert à choisir le groupe et le modèle, avec réutilisation du routage, de la conversion de protocole, de la facturation et des mécanismes de réessai unifiés. |
| Text Completions                       | `POST /v1/completions`                  | Interface classique de complétion de texte ; nécessite `prompt` et `model`.                                                                                                                   |
| Vector Embeddings                      | `POST /v1/embeddings`                   | Convertit du texte ou un tableau de textes en vecteurs ; nécessite `input`, converti au format amont par l'adaptateur de canal.                                                                    |
| Gemini Embeddings Compatible Interface | `POST /v1/engines/{model}/embeddings`   | Compatible avec les anciens chemins d'embedding de style Gemini ; traite les requêtes d'embedding selon le nom de modèle présent dans l'URL.                                                       |
| Image Generation                       | `POST /v1/images/generations`           | Génère des images à partir d'invites ; le modèle, la taille, la qualité et le nombre dépendent des paramètres de requête et des canaux configurés.                                                 |
| Image Editing                          | `POST /v1/images/edits`                 | Modifie des images à partir de l'image d'entrée et de l'invite ; prend en charge les requêtes JSON et `multipart/form-data`.                                                                       |
| Legacy Edit Interface                  | `POST /v1/edits`                        | Chemin de compatibilité conservé, qui passe par le traitement Relay des images ; les nouveaux clients doivent préférer `/v1/images/edits`.                                                          |
| Speech to Text                         | `POST /v1/audio/transcriptions`         | Convertit l'audio en texte et le transmet au canal de reconnaissance vocale correspondant selon le format d'interface audio d'OpenAI.                                                               |
| Audio Translation                      | `POST /v1/audio/translations`           | Reconnaît le contenu audio et restitue le texte traduit.                                                                                                                                     |
| Text to Speech                         | `POST /v1/audio/speech`                 | Convertit le texte saisi en audio.                                                                                                                                                            |
| Rerank                                 | `POST /v1/rerank`                       | Réordonne les `documents` candidats selon leur pertinence par rapport à `query` ; exige un contenu de requête non vide et une liste de documents.                                                  |
| Content Moderation                     | `POST /v1/moderations`                  | Effectue une modération de contenu sur du texte ou d'autres entrées ; si aucun modèle n'est fourni, un modèle de modération par défaut est utilisé.                                                |
| Responses API                          | `POST /v1/responses`                    | Interface au format OpenAI Responses, prenant en charge des capacités telles que l'entrée, les outils et les événements de réponse.                                                              |
| Responses Compression                  | `POST /v1/responses/compact`            | Effectue une compression du contexte des requêtes Responses.                                                                                                                                 |
| Codex Web Search                       | `POST /v1/alpha/search`                 | Interface au format de recherche web indépendante de Codex ; actuellement traitée uniquement par Sub2API, Uter, Codex et les canaux personnalisés avancés compatibles.                               |
| Claude Messages                        | `POST /v1/messages`                     | Interface compatible Anthropic Claude Messages ; nécessite `model` et le contenu des messages, convertis par Uter vers le protocole amont si nécessaire.                                           |
| Realtime Conversation                  | `GET /v1/realtime` (WebSocket)          | Interface de communication bidirectionnelle en temps réel de style OpenAI Realtime ; le modèle est généralement passé via des paramètres de requête et la clé d'API via un jeton Bearer ou un sous-protocole WebSocket. |
| Gemini Native Model Invocation         | `POST /v1beta/models/{model}:{action}`  | Interface au format natif Gemini, prenant en charge les chemins d'opération de modèle tels que `generateContent`, `streamGenerateContent` et les opérations d'embedding.                                     |
| Gemini Compatible Model Invocation     | `POST /v1/models/{model}:{action}`      | Accepte les requêtes d'opération de modèle de style Gemini avec le préfixe `/v1` ; elles sont analysées et converties par le Relay Gemini.                                                          |
| Model List                             | `GET /v1/models`                        | Renvoie par défaut la liste des modèles au format OpenAI ; renvoie le format Claude avec les en-têtes de requête Anthropic et le format Gemini avec `x-goog-api-key` ou le paramètre de requête `key`.            |
| Model Details                          | `GET /v1/models/{model}`                | Interroge les informations d'un seul modèle ; renvoie un objet d'erreur `model_not_found` si le modèle n'existe pas.                                                                           |
| Gemini Model List                      | `GET /v1beta/models`                    | Renvoie la liste des modèles disponibles au format Gemini ; les champs de réponse comprennent `models` et `nextPageToken`.                                                                        |
| OpenAI Format Model List               | `GET /v1beta/openai/models`             | Renvoie la liste des modèles au format OpenAI sous l'espace de noms de compatibilité Gemini.                                                                                               |
