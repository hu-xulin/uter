# Test des modèles

Avant d'intégrer un grand modèle sur Uter, suivez ce chapitre pour vérifier « si ça se connecte, si ça fonctionne, si c'est stable, si c'est facturé juste », afin d'éviter les mauvaises surprises après la mise en production.

## Prérequis

Vérifiez que vous disposez des éléments suivants avant de tester. Il en manque un seul et la première étape échoue.

| Élément | Description | Où l'obtenir |
| --- | --- | --- |
| **URL de base (Base URL)** | De la forme `https://uter.ai/v1` ; utilisez l'adresse indiquée dans votre console (il peut s'agir d'un domaine qui vous est propre) | Console → Profil / documentation d'intégration |
| **Clé d'API (jeton)** | De la forme `sk-xxxxxxxx`. C'est un identifiant équivalent à un mot de passe : ne le divulguez jamais, ne le mettez jamais dans le code front-end, ne le committez jamais dans un dépôt | Console → Gestion des jetons → Créer un jeton |
| **Quota du compte** | Unité de facturation : 500 000 tokens ≈ 1 USD. Chaque appel débite le quota ; en dessous, la requête est refusée | Console → Consommation / solde ; ou `GET /v1/dashboard/billing/usage` |
| **Nom du modèle** | Le nom enregistré du modèle que vous voulez tester (il peut différer du nom officiel du fournisseur) | L'`id` renvoyé par `GET /v1/models` |

<Callout type="warn">
  Une clé équivaut à un mot de passe : utilisez-la uniquement côté serveur ou dans un gestionnaire de secrets, ne l'envoyez jamais au navigateur, ne l'écrivez jamais en clair dans les journaux, ne la committez jamais sur Git.
</Callout>

Un jeton présente quatre états dans la console : activé, désactivé, expiré et épuisé. Lorsque le quota est consommé, le jeton est épuisé et tout appel signale un quota insuffisant. Vérifiez l'état sur la page de gestion des jetons avant de tester.

## Dimensions de test

Avant d'utiliser un modèle en production, vérifiez ces neuf dimensions une à une. Les quatre premières répondent à « est-ce que ça fonctionne », les cinq suivantes à « est-ce stable et est-ce facturé correctement ».

1. **Connectivité et authentification** — l'adresse est-elle correcte, la clé est-elle valide, une restriction IP vous bloque-t-elle.
2. **Liste des modèles et disponibilité** — le modèle cible existe-t-il vraiment et fonctionne-t-il.
3. **Conversation de base** — une requête minimale renvoie-t-elle correctement une réponse.
4. **Paramètres et capacités avancées** — streaming, temperature, max_tokens, tools/function calling, vision, mode JSON, prompt système.
5. **Sortie en streaming (SSE)** — le flux arrive-t-il token par token et est-il analysable.
6. **Performance et latence** — latence du premier token (TTFT), durée totale, comportement sur long contexte.
7. **Stabilité et limites de débit** — comportement en concurrence, lors des retries et sur 429.
8. **Quota et facturation** — la déduction est-elle exacte et le solde diminue-t-il.
9. **Erreurs et cas limites** — les erreurs (paramètre invalide, entrée trop longue, modèle indisponible) sont-elles claires et exploitables en code.

## Étape par étape

Les exemples ci-dessous supposent :

- URL de base `BASE=https://uter.ai/v1` (à remplacer par votre adresse réelle)
- Clé `TOKEN=sk-your-token-here` (à remplacer par la clé complète de votre console)

Tous les exemples utilisent `curl` : collez-les dans un terminal après substitution. Si votre machine passe par un proxy, ajoutez `--noproxy '*'` pour le contourner.

### Étape 1 · Connectivité minimale et authentification

```bash
BASE=https://uter.ai/v1
TOKEN=sk-your-token-here

curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" | head -c 800
echo
```

Critères de validation :

- Un corps JSON avec `object: "list"` et plusieurs `id` → connectivité et authentification OK.
- `{"error":{"message":"That token isn't valid.","type":"...","code":"..."}}` avec HTTP 401 → la clé est incorrecte ou désactivée (voir le tableau de dépannage).
- Connexion impossible / délai dépassé → l'adresse est incorrecte ou le réseau est injoignable (voir le tableau de dépannage).

<Callout type="info">
  Certaines API natives de fournisseurs utilisent leur propre authentification, uniquement nécessaire si vous employez le SDK officiel correspondant : Claude utilise `POST /v1/messages` avec `x-api-key: $TOKEN` et `anthropic-version: 2023-06-01` ; Gemini utilise `GET /v1beta/models` avec `x-goog-api-key: $TOKEN` ou `?key=$TOKEN` dans l'URL.
</Callout>

### Étape 2 · Lister les modèles disponibles et confirmer la cible

```bash
curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep '"id"' | head -40
```

Repérez l'`id` du modèle à tester (par exemple `gpt-4o`, `claude-3-5-sonnet-20241022` ou un nom propre à la plateforme).

<Callout type="warn">
  Si le modèle souhaité n'apparaît pas dans la liste, il n'est pas activé pour vous — contactez la plateforme. Deviner le nom et l'appeler directement ne renverra que 404 ou « aucun canal disponible ».
</Callout>

### Étape 3 · Une conversation minimale (sans streaming)

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "remplacez par votre id de modèle",
    "messages": [{"role": "user", "content": "Présentez-vous en une phrase."}],
    "max_tokens": 200
  }' | python3 -m json.tool
```

Critères de validation : `choices[0].message.content` contient du texte normal et `usage` contient `prompt_tokens` / `completion_tokens` → la conversation de base fonctionne.

### Étape 4 · Sortie en streaming (SSE)

```bash
curl --noproxy '*' -N -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "remplacez par votre id de modèle",
    "messages": [{"role": "user", "content": "Compte jusqu'à 10."}],
    "stream": true
  }'
```

Critères de validation : le terminal doit faire défiler les fragments `data: {...}` ligne par ligne, en terminant par `data: [DONE]`. Une arrivée correcte token par token signifie que le streaming fonctionne.

<Callout type="info">
  `curl` a besoin de `-N` (désactivation de la mise en tampon) pour voir la sortie incrémentale ; côté SDK, vérifiez que `stream: true` est activé et que rien ne met la réponse entière en tampon.
</Callout>

### Étape 5 · Capacité avancée : appel de fonction (Function Calling)

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "remplacez par votre id de modèle",
    "messages": [{"role": "user", "content": "Quel temps fait-il à Pékin ?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Consulter la météo d une ville",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }]
  }' | python3 -m json.tool
```

Critères de validation : `choices[0].message.tool_calls` apparaît dans la réponse (le modèle choisit d'appeler `get_weather`) au lieu d'inventer une réponse → l'appel de fonction fonctionne.

<Callout type="warn">
  Si votre produit dépend du function calling, du mode JSON ou de la vision, testez chacun séparément : ne présumez pas que « si ça dialogue, tout fonctionne ».
</Callout>

### Étape 6 · Test multimodal (vision) — uniquement si le modèle gère les images

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "remplacez par un id de modèle avec vision",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Que contient cette image ?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/demo.png"}}
      ]
    }]
  }' | python3 -m json.tool
```

Critères de validation : la réponse décrit correctement le contenu de l'image → la vision fonctionne. L'image doit être une URL accessible publiquement ; la plateforme ne lit pas vos fichiers locaux.

### Étape 7 · Latence et référence de performance (3 à 5 exécutions, moyenne)

```bash
for i in 1 2 3; do
  curl --noproxy '*' -s -o /dev/null -w "essai $i premier_token=%{time_starttransfer}s total=%{time_total}s HTTP=%{http_code}\n" \
    "$BASE/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"remplacez par votre id de modèle","messages":[{"role":"user","content":"bonjour"}],"max_tokens":128}'
done
```

Surveillez le délai avant le premier token (TTFT) et la durée totale, et comparez-les à votre SLA. Pour les contextes longs, testez aussi un prompt long (par exemple 8k / 32k tokens) pour voir si la latence croît linéairement.

### Étape 8 · Vérification du quota et de la facturation

Notez le solde avant l'appel, puis après ; la différence doit correspondre à la consommation réelle.

```bash
# avant
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# (exécutez la conversation de l'étape 3 entre-temps)

# après
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Vous pouvez aussi comparer le champ `usage` de la réponse (`prompt_tokens` + `completion_tokens`) avec les règles de facturation.

### Étape 9 · Cas limites et lisibilité des erreurs

Provoquez volontairement une erreur pour vérifier que le message est clair et exploitable en code :

```bash
# max_tokens excessif / paramètre invalide
curl --noproxy '*' -s -w "\nHTTP=%{http_code}\n" "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"remplacez par votre id de modèle","messages":[{"role":"user","content":"hi"}],"max_tokens":999999}'
```

Critères de validation : une erreur structurée `{"error":{"message":...,"type":...,"code":...}}` avec un code HTTP 4xx clair, plutôt qu'un corps vide ou une trace 500 → les erreurs sont exploitables.

## Tableau de dépannage

| # | Symptôme | Cause probable | Solution |
| --- | --- | --- | --- |
| **A1** | `401` + `That token isn't valid.` | Clé copiée incomplètement, mal saisie, ou désactivée | Recopiez la clé complète depuis la console ; vérifiez que l'état est « activé » et que vous ne l'avez pas tronquée ni Added d'espaces superflus |
| **A2** | `401` + `This token has expired. Please create a new one.` | La clé a une date d'expiration dépassée | Générez une nouvelle clé dans la console ; pour une clé durable, réglez l'expiration sur « n'expire jamais » |
| **A3** | `403` + `Your IP is not in the token's allowed list` | La clé impose une liste blanche IP et votre IP de sortie n'y figure pas | Ajoutez votre IP publique de sortie à la liste blanche de la clé dans la console, ou désactivez temporairement la restriction IP (environnements de test uniquement) |
| **A4** | Connexion impossible / `Could not resolve host` / délai très long | URL de base erronée, certificat auto-signé, accès intranet | Vérifiez l'URL de base (elle doit être `https://votre-domaine/v1`) ; ajoutez `--noproxy '*'` si votre débogage local passe par un proxy ; confirmez que le réseau est joignable |
| **B1** | `Your quota is insufficient.` HTTP 403 | Quota du compte ou de la clé épuisé | Rechargez / augmentez le quota dans la console ; ou vérifiez le solde restant avec `GET /v1/dashboard/billing/usage` |
| **B2** | `No available channel for model "xxx" in group "default".` | Aucun canal n'est configuré pour ce modèle sur votre compte | Contactez la plateforme pour confirmer la disponibilité, ou choisissez un modèle confirmé dans la liste `/v1/models`. Ne devinez pas les noms de modèles |
| **B3** | `404` / `model not found` | Nom de modèle erroné, ou modèle non activé pour vous | Listez les modèles à l'étape 2 et copiez exactement l'`id` renvoyé |
| **C1** | `429` + requête limitée | Limite de débit au niveau de la clé ou de la plateforme | Réduisez la concurrence / ajoutez des retries avec backoff (backoff exponentiel) ; vérifiez les limites RPM/TPM de la clé ; étalez les tâches par lot |
| **C2** | `5xx` intermittents / délai amont, réussi après retry | Fluctuation du modèle amont | Implémentez des retries avec backoff ; la plateforme réessaie automatiquement, mais le client doit aussi prévoir un repli |
| **D1** | Le streaming arrive d'un seul coup au lieu de token par token | Mise en tampon côté client (curl sans `-N`, ou SDK sans stream) | Ajoutez `-N` à curl ; vérifiez `stream: true` et l'absence de mise en tampon globale côté SDK |
| **D2** | Caractères chinois ou spéciaux affichés en clair | Encodage non déclaré ou erreur d'analyse | Utilisez UTF-8 pour la requête et la réponse ; si `python3 -m json.tool` affiche correctement, le serveur va bien et le problème vient du terminal |
| **D3** | La réponse est tronquée | `max_tokens` trop petit, ou limite de sortie du modèle atteinte | Augmentez `max_tokens` ; réceptionnez les textes longs en flux segmenté |
| **E1** | Facturation inattendue (trop ou trop peu facturée) | La base de facturation peut inclure des tokens cachés (raisonnement, appels d'outils) ou les multiplicateurs diffèrent selon les modèles | Rapprochez sur le champ `usage` de la réponse ; contactez la plateforme en cas de doute |
| **E2** | Le function calling ne se déclenche pas / le mode JSON n'a pas d'effet | Le modèle n'expose pas cette capacité | Testez-la séparément à l'étape 5 ; ne dépendez pas d'une capacité non supportée — prévoyez un repli dans votre produit |
| **F1** | `400` avec un message de type « annonce » en chinois | Changement temporaire de l'approvisionnement amont (le fournisseur glisse une notification dans l'erreur), ce n'est pas une erreur de votre part | Une fois votre requête vérifiée, contactez la plateforme en citant le texte de l'erreur |
<Callout type="idea">
  Deux leçons à retenir : face à « aucun canal disponible / modèle introuvable », vérifiez d'abord le vrai nom du modèle avec `GET /v1/models`, puis contactez la plateforme — **90 % des cas « le modèle ne marche pas » viennent de ces deux causes**, pas du code. Face à un `401` / `403`, vérifiez l'état de la clé et la liste blanche IP avant de vérifier l'URL de base — **les problèmes d'authentification viennent presque toujours d'une « copie incomplète / mauvaise adresse / restriction non désactivée »**.
</Callout>

### Que faire face à une erreur 400 (Bad Request)

`400` signifie « la requête elle-même est incorrecte » : le serveur a bien reçu la requête, mais son contenu ou ses paramètres sont invalides et il la refuse. C'est une catégorie différente de l'authentification (401), du quota (403) et de la limitation de débit (429).

Identifiez d'abord la source d'après le libellé :

| Ce que vous voyez | Source habituelle | Que faire |
| --- | --- | --- |
| En chinois, formulé comme un message de la plateforme | La plateforme valide la requête avant de la relayer | Modifiez les paramètres comme indiqué |
| En anglais, formulé comme une erreur OpenAI / Claude / Gemini | Le fournisseur amont (les paramètres ne correspondent pas aux exigences de ce modèle) | Modifiez les paramètres comme indiqué (ajouter messages, ramener les valeurs dans les bornes) |
| En chinois, formulé comme une notification / annonce | Changement temporaire de l'approvisionnement amont | Ce n'est pas votre faute — contactez la plateforme avec le texte de l'erreur |

Messages 400 courants côté plateforme :

| Ce que vous voyez | Signification | Résolution |
| --- | --- | --- |
| `Requête non valide : <détail>` | La plateforme n'a pas validé le corps de la requête | Lisez ce qui suit les deux-points et corrigez en conséquence |
| `Requête non valide : impossible de déterminer le modèle utilisé.` | Aucun modèle n'a pu être déterminé | Vérifiez que `"model": "<nom>"` est bien présent et correctement orthographié |
| `model field is required` | Le champ `model` est absent | Ajoutez le paramètre `model` |
| Un message du type « pas du JSON valide » | Le corps JSON est malformé | Vérifiez guillemets, virgules et échappements, en particulier avec du texte non ASCII et des retours à la ligne |

<Callout type="info">
  Si vous voyez un message du type « configuration du modèle » ou « prix non configuré », il s'agit d'un problème côté plateforme : contactez-la, vous n'avez pas à modifier la requête.
</Callout>

Messages 400 courants côté amont :

- `messages is required` / `messages must be a non-empty array` — `messages` est absent ou vide
- `temperature must be between 0 and 2` / `max_tokens too large` — paramètre hors bornes
- `Unknown parameter: 'xxx'` — un champ non supporté par le modèle a été envoyé
- `1 validation error for ...` — type de champ ou champ obligatoire non conforme

Diagnostic en 30 secondes (ajoutez `-i` à curl pour voir la réponse complète) :

```bash
curl -i https://uter.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"<nom du modèle>","messages":[{"role":"user","content":"hi"}]}'
```

Concentrez-vous sur le `message` de la réponse : il indique généralement la cause directe.

## Check-list avant mise en production

Reprenez cette liste et cochez chaque point avant de basculer le trafic de production :

- [ ] L'**URL de base** est figée dans la configuration (variables d'environnement ou service de configuration), pas codée en dur dans le front-end.
- [ ] La **clé** a été copiée complètement depuis la console, est « activée », non expirée, avec un quota suffisant.
- [ ] Si la clé impose une liste blanche IP, l'IP de sortie du serveur de production y figure.
- [ ] `GET /v1/models` liste le modèle cible, et son `id` correspond à celui écrit dans le code.
- [ ] La conversation sans streaming fonctionne et renvoie `content` et `usage`.
- [ ] Le streaming (SSE) fonctionne et vous savez analyser les fragments `data:` et `[DONE]`.
- [ ] Chaque **capacité avancée** dont dépend votre produit (tools / JSON / vision / long contexte) a été vérifiée individuellement.
- [ ] Vous avez relevé une référence de latence (TTFT / total) conforme à votre SLA.
- [ ] Le client implémente des **retries avec backoff sur limitation de débit** et un **retry de secours sur 5xx amont**.
- [ ] Les réponses d'erreur sont traitées de façon structurée via `error.message` / `error.code` / code HTTP, et aucun identifiant n'est écrit dans les journaux.
- [ ] La débite de quota a été rapprochée avec le champ `usage`.
- [ ] La production n'affiche ni ne commit la clé (un gestionnaire de secrets ou des variables d'environnement sont en place).
- [ ] Vous avez confirmé la **disponibilité et les règles de facturation** du modèle cible auprès de la plateforme.

## Annexe

### Points de terminaison pris en charge (principalement compatibles OpenAI)

| Capacité | Méthode et chemin | Remarque |
| --- | --- | --- |
| Lister les modèles | `GET /v1/models` | Voir les modèles disponibles après authentification |
| Consulter un modèle | `GET /v1/models/:model` | Informations sur un modèle |
| Chat | `POST /v1/chat/completions` | Point d'entrée principal ; prend en charge stream / tools / vision |
| Complétion de texte | `POST /v1/completions` | Ancienne complétion (certains modèles) |
| Embeddings | `POST /v1/embeddings` | Vectorisation de texte |
| Images | `POST /v1/images/generations`, `/v1/images/edits` | Génération et retouche d'images |
| Audio | `POST /v1/audio/transcriptions`, `/translations`, `/speech` | Transcription / traduction / synthèse |
| Rerank | `POST /v1/rerank` | Reclassement de récupération |
| Modération | `POST /v1/moderations` | Contrôle de sécurité du contenu |
| Claude natif | `POST /v1/messages` | Authentification par `x-api-key` |
| Voix temps réel | `GET /v1/realtime` (WebSocket) | Mode Realtime |
| Gemini natif | `/v1beta/models/*` | Authentification par `x-goog-api-key` |
| Consommation / abonnement | `GET /v1/dashboard/billing/usage`, `/subscription` | Consultation autonome du quota |

### Format d'erreur unifié

Toutes les erreurs de l'API de la plateforme suivent une structure de type OpenAI, pour un traitement uniforme côté client :

```json
{
  "error": {
    "message": "raison lisible par un humain",
    "type": "invalid_request_error | authentication_error | ...",
    "code": "code d'erreur facultatif",
    "param": "nom du paramètre en cause, facultatif"
  }
}
```

Associée au code HTTP (401 authentification / 403 quota ou permission / 404 modèle / 429 limitation de débit / 5xx amont), elle couvre l'essentiel de la logique de gestion côté client.

### Rappel de sécurité (obligatoire)

- **Une clé est un mot de passe** : utilisez-la uniquement côté serveur ou dans un gestionnaire de secrets, ne l'envoyez jamais au navigateur, ne l'écrivez jamais en clair dans les journaux, ne la committez jamais sur Git.
- **Masquage des journaux** : l'audit de la plateforme n'enregistre pas votre clé en clair ; mais lorsque votre client imprime les réponses, évitez d'écrire l'en-tête `Authorization` dans les journaux.
- **Limitation de débit et retries** : implémentez des retries avec backoff, pour qu'une vague de retries ne transforme une limitation de débit en panne générale.
