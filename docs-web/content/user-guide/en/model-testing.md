# Model Testing

Before integrating a large model on Uter, work through this chapter to verify whether it connects, works, is stable, and bills accurately — so you don't hit surprises after going live.

## Prerequisites

Confirm you have the following before testing. Missing any one of them makes the first step fail.

| Item | Description | Where to get it |
| --- | --- | --- |
| **API base URL** | Shaped like `https://uter.ai/v1`; use the address shown in your console (it may be a dedicated domain for you) | Console → Profile / integration docs |
| **API key (token)** | Shaped like `sk-xxxxxxxx`. This is a credential equivalent to a password: never leak it, never put it in front-end code, never commit it to a repository | Console → Token management → Create token |
| **Account quota** | Billing unit: 500,000 tokens ≈ 1 USD. Every call deducts quota; requests are rejected when it runs out | Console → Usage / balance; or `GET /v1/dashboard/billing/usage` |
| **Model name** | The registered name of the model you want to test (it may differ from the vendor's original name) | The `id` returned by `GET /v1/models` |

<Callout type="warn">
  A key is equivalent to a password: use it only on your server or in a secret manager, never ship it to the browser, never write it in plaintext to logs, never commit it to Git.
</Callout>

Keys have four states in the console: enabled, disabled, expired, and exhausted. Once the quota is used up the key is exhausted and every call reports insufficient quota. Check the state on the token management page before testing.

## Test dimensions

Before using a model in production, verify these nine dimensions one by one. The first four answer "does it work at all"; the last five answer "is it stable and is the billing correct".

1. **Connectivity and authentication** — is the address right, is the key valid, is an IP restriction blocking you.
2. **Model list and availability** — does the target model really exist and work.
3. **Basic chat** — does a minimal request return normally.
4. **Parameters and advanced capabilities** — streaming, temperature, max_tokens, tools/function calling, vision, JSON mode, system prompt.
5. **Streaming (SSE)** — does it arrive token by token and parse correctly.
6. **Performance and latency** — time to first token (TTFT), total latency, long-context behaviour.
7. **Stability and rate limits** — behaviour under concurrency, retries, and 429s.
8. **Quota and billing verification** — is the deduction accurate and the balance decreasing.
9. **Errors and edge cases** — are errors for invalid parameters, over-long input, or an unavailable model clear and handleable in code.

## Step by step

The examples below assume:

- Base URL `BASE=https://uter.ai/v1` (replace with your actual address)
- Key `TOKEN=sk-your-token-here` (replace with the complete key from your console)

All examples use `curl` — paste and run them in a terminal after substituting. If your machine uses a proxy, add `--noproxy '*'` to bypass it.

### Step 1 · Minimal connectivity and authentication

```bash
BASE=https://uter.ai/v1
TOKEN=sk-your-token-here

curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" | head -c 800
echo
```

Pass criteria:

- A JSON body with `object: "list"` and several `id` values → connectivity and auth OK.
- `{"error":{"message":"That token isn't valid.","type":"...","code":"..."}}` with HTTP 401 → the key is wrong or disabled (see the troubleshooting table).
- Cannot connect at all / timeout → the address is wrong or the network is unreachable (see the troubleshooting table).

<Callout type="info">
  Some vendors' native APIs use their own authentication, needed only when you use the matching official SDK: Claude uses `POST /v1/messages` with `x-api-key: $TOKEN` and `anthropic-version: 2023-06-01`; Gemini uses `GET /v1beta/models` with `x-goog-api-key: $TOKEN` or `?key=$TOKEN` in the URL.
</Callout>

### Step 2 · List available models and confirm the target exists

```bash
curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep '"id"' | head -40
```

Find the `id` of the model you want to test (for example `gpt-4o`, `claude-3-5-sonnet-20241022`, or a platform-specific name).

<Callout type="warn">
  If the model you want is not in the list, it has not been enabled for you — contact the platform. Guessing the name and calling it anyway will only return 404 or report no available channel.
</Callout>

### Step 3 · One minimal chat completion (non-streaming)

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "replace with your model id",
    "messages": [{"role": "user", "content": "Introduce yourself in one sentence."}],
    "max_tokens": 200
  }' | python3 -m json.tool
```

Pass criteria: `choices[0].message.content` contains normal text and `usage` has `prompt_tokens` / `completion_tokens` → basic chat works.

### Step 4 · Streaming (SSE)

```bash
curl --noproxy '*' -N -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "replace with your model id",
    "messages": [{"role": "user", "content": "Count to 10."}],
    "stream": true
  }'
```

Pass criteria: the terminal should scroll `data: {...}` fragments line by line, ending with `data: [DONE]`. Correct token-by-token delivery means streaming works.

<Callout type="info">
  `curl` needs `-N` (disable buffering) to see the incremental output; on the SDK side, confirm `stream: true` is set and that nothing buffers the whole response.
</Callout>

### Step 5 · Advanced capability: function calling

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "replace with your model id",
    "messages": [{"role": "user", "content": "What is the weather in Beijing?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Query the weather of a city",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }]
  }' | python3 -m json.tool
```

Pass criteria: `choices[0].message.tool_calls` appears in the response (the model decides to call `get_weather`) instead of it making up an answer → function calling works.

<Callout type="warn">
  If your product depends on function calling, JSON mode, or vision, test each one separately — never assume "if it chats, everything works".
</Callout>

### Step 6 · Multimodal (vision) test — only if the model supports images

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "replace with a vision-capable model id",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/demo.png"}}
      ]
    }]
  }' | python3 -m json.tool
```

Pass criteria: the response correctly describes the image → vision works. The image must be a publicly reachable URL; the platform cannot read files from your local machine.

### Step 7 · Latency and performance baseline (run 3–5 times and average)

```bash
for i in 1 2 3; do
  curl --noproxy '*' -s -o /dev/null -w "run $i ttft=%{time_starttransfer}s total=%{time_total}s HTTP=%{http_code}\n" \
    "$BASE/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"replace with your model id","messages":[{"role":"user","content":"hello"}],"max_tokens":128}'
done
```

Watch the time to first token (TTFT) and the total time, and compare them against your SLA. For long-context work, also test one long prompt (for example 8k / 32k tokens) to see whether latency grows linearly.

### Step 8 · Quota and billing verification

Record the balance before the call and again afterwards; the difference should match the actual consumption.

```bash
# before
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# (run the Step 3 chat in between)

# after
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

You can also check the `usage` field of the single response (`prompt_tokens` + `completion_tokens`) against the billing rules.

### Step 9 · Edge cases and error readability

Deliberately trigger an error to confirm the message is clear and catchable in code:

```bash
# oversized max_tokens / invalid parameter
curl --noproxy '*' -s -w "\nHTTP=%{http_code}\n" "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"replace with your model id","messages":[{"role":"user","content":"hi"}],"max_tokens":999999}'
```

Pass criteria: a structured `{"error":{"message":...,"type":...,"code":...}}` with a clear 4xx status code, rather than an empty body or a 500 stack trace → errors are handleable.

## Troubleshooting table

| # | Symptom | Likely cause | Resolution |
| --- | --- | --- | --- |
| **A1** | `401` + `That token isn't valid.` | Key copied incompletely, mistyped, or disabled | Copy the complete key again from the console; confirm the state is "enabled" and that you did not truncate it or include stray spaces |
| **A2** | `401` + `This token has expired. Please create a new one.` | The key has an expiry that has passed | Generate a new key in the console; for long-lived keys set the expiry to "never expires" |
| **A3** | `403` + `Your IP is not in the token's allowed list` | The key has an IP whitelist and your current egress IP is not on it | Add your egress public IP to the key's whitelist in the console, or temporarily disable the IP restriction (test environments only) |
| **A4** | Cannot connect / `Could not resolve host` / long timeout | Wrong base URL, self-signed certificate, intranet access | Check the base URL (it should be `https://your-domain/v1`); add `--noproxy '*'` if your local debugging goes through a proxy; confirm the network is reachable |
| **B1** | `Your quota is insufficient.` HTTP 403 | Account or key quota is exhausted | Top up / raise the quota in the console; or check the remaining quota with `GET /v1/dashboard/billing/usage` |
| **B2** | `No available channel for model "xxx" in group "default".` | No channel is configured for that model on your account | Contact the platform to confirm availability, or pick a model confirmed in the `/v1/models` list. Do not guess model names |
| **B3** | `404` / `model not found` | Model name is wrong, or the model is not enabled for you | List models with Step 2 and copy the returned `id` exactly |
| **C1** | `429` + rate limited | Key-level or platform-level rate limit hit | Lower concurrency / add backoff retries (exponential backoff); check the key's RPM/TPM limits; stagger batch jobs |
| **C2** | Intermittent `5xx` / upstream timeout, succeeds on retry | Upstream model fluctuation | Implement retry with backoff; the platform retries automatically, but the client should have a fallback |
| **D1** | Streaming arrives all at once instead of token by token | Client-side buffering (e.g. `curl` without `-N`, or the SDK not streaming) | Add `-N` to curl; confirm `stream: true` and no whole-response buffering in the SDK |
| **D2** | Chinese or special characters render as garbage | Encoding not declared, or a parsing error | Use UTF-8 for both request and response; if `python3 -m json.tool` displays correctly, the server is fine and the issue is your terminal's encoding |
| **D3** | Response is truncated | `max_tokens` too small, or the model hit its output cap | Raise `max_tokens`; receive long output in streamed chunks |
| **E1** | Billing does not match expectations (over- or under-charged) | The billing basis may include hidden tokens such as chain-of-thought or tool calls, or models have different multipliers | Reconcile against the `usage` field of the response; contact the platform if in doubt |
| **E2** | Function calling never triggers / JSON mode has no effect | The model does not expose that capability | Test it separately with Step 5; do not depend on unsupported capabilities — degrade gracefully in your product |
| **F1** | `400` with an "announcement-style" message in Chinese | A temporary upstream supply change notice carried inside the error, not a mistake in your request | Once you have confirmed your request is well-formed, contact the platform and quote the error text |

<Callout type="idea">
  Two lessons worth remembering. When you see "no available channel / model not found", check the real model name with `GET /v1/models` first, then contact the platform — **90% of "the model doesn't work" cases come from these two causes**, not from code. For `401` / `403`, check the key state and the IP whitelist before checking the base URL — **authentication problems almost always come from "incomplete copy / wrong address / restriction not disabled"**.
</Callout>

### What to do about a 400 (Bad Request)

`400` means "the request itself is wrong": the server received it but the content or parameters are invalid, so it was rejected outright. It is a different class from authentication (401), quota (403), and rate limiting (429).

First identify the source from the wording:

| What you see | Usually from | What to do |
| --- | --- | --- |
| Chinese, phrased like a platform message | The platform validating the request before forwarding | Change the request parameters as it says |
| English, phrased like an OpenAI / Claude / Gemini error | The upstream vendor (parameters do not meet that model's requirements) | Change the parameters as it says (e.g. supply messages, bring values back in range) |
| Chinese, phrased like a notice or announcement | A temporary upstream supply change | Not your mistake — contact the platform with the error text |

Common platform-side 400 messages:

| What you see | Meaning | Resolution |
| --- | --- | --- |
| `Invalid request: <details>` | The platform failed to validate the body | Read what follows the colon and fix accordingly |
| `Invalid request: unable to determine which model you want to use.` | No model could be parsed | Confirm `"model": "<name>"` is present and spelled correctly |
| `model field is required` | The `model` field is missing | Add the `model` parameter |
| Something about "not valid JSON" | The request body is malformed JSON | Check quotes, commas, and escaping — especially with non-ASCII text and line breaks |

<Callout type="info">
  If you see a message about model configuration or pricing not being set, that is a platform-side issue — contact the platform; you do not need to change the request.
</Callout>

Common upstream 400 messages:

- `messages is required` / `messages must be a non-empty array` — `messages` is missing or empty
- `temperature must be between 0 and 2` / `max_tokens too large` — a parameter is out of range
- `Unknown parameter: 'xxx'` — you passed a field the model does not support
- `1 validation error for ...` — a field type or required field does not match

Thirty-second diagnosis (add `-i` to curl to see the full response):

```bash
curl -i https://uter.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"<model name>","messages":[{"role":"user","content":"hi"}]}'
```

Focus on the `message` in the response — it usually states the direct cause.

## Pre-launch checklist

Copy this checklist and tick every item before switching production traffic:

- [ ] The **base URL** is pinned in configuration (environment variables or a config service), not hard-coded in front-end code.
- [ ] The **key** was copied completely from the console, is "enabled", not expired, and has sufficient quota.
- [ ] If the key has an IP whitelist, the production server's egress IP is on it.
- [ ] `GET /v1/models` lists the target model, and its `id` matches the one in your code.
- [ ] Non-streaming chat works and returns `content` and `usage`.
- [ ] Streaming (SSE) works and you can parse `data:` fragments and `[DONE]`.
- [ ] Every **advanced capability** your product depends on (tools / JSON / vision / long context) has been verified individually.
- [ ] You recorded a latency baseline (TTFT / total) that meets your SLA.
- [ ] The client implements **backoff retries for rate limits** and a **fallback retry for upstream 5xx**.
- [ ] Error responses are handled structurally via `error.message` / `error.code` / HTTP status, and raw credentials are never logged.
- [ ] The quota deduction was reconciled against the `usage` field.
- [ ] Production never prints or commits the key (a secret manager or environment variables are in place).
- [ ] You have confirmed the target model's **availability and billing rules** with the platform.

## Appendix

### Supported endpoints (mostly OpenAI-compatible)

| Capability | Method and path | Notes |
| --- | --- | --- |
| List models | `GET /v1/models` | See the models available to you after authenticating |
| Retrieve model | `GET /v1/models/:model` | Inspect a single model |
| Chat | `POST /v1/chat/completions` | The main endpoint; supports stream / tools / vision |
| Text completion | `POST /v1/completions` | Legacy completion (supported by some models) |
| Embeddings | `POST /v1/embeddings` | Text vectorisation |
| Images | `POST /v1/images/generations`, `/v1/images/edits` | Text-to-image / image editing |
| Audio | `POST /v1/audio/transcriptions`, `/translations`, `/speech` | Transcription / translation / synthesis |
| Rerank | `POST /v1/rerank` | Retrieval reranking |
| Moderation | `POST /v1/moderations` | Content safety checks |
| Claude native | `POST /v1/messages` | Authenticates with `x-api-key` |
| Realtime voice | `GET /v1/realtime` (WebSocket) | Realtime mode |
| Gemini native | `/v1beta/models/*` | Authenticates with `x-goog-api-key` |
| Usage / subscription | `GET /v1/dashboard/billing/usage`, `/subscription` | Self-service quota lookup |

### Uniform error format

All platform API errors use an OpenAI-style structure so clients can handle them uniformly:

```json
{
  "error": {
    "message": "human-readable reason",
    "type": "invalid_request_error | authentication_error | ...",
    "code": "optional error code",
    "param": "optional offending parameter"
  }
}
```

Paired with the HTTP status code (401 auth / 403 quota or permission / 404 model / 429 rate limit / 5xx upstream), this covers the vast majority of client handling logic.

### Security reminders (required)

- **A key is a password**: use it only on the server or in a secret manager, never ship it to the browser, never write it in plaintext to logs, never commit it to Git.
- **Redact logs**: the platform's audit trail does not record your key in plaintext, but when your own client prints responses, avoid writing the `Authorization` header into logs.
- **Rate limits and retries**: always implement backoff retries, so an avalanche of retries does not turn a rate limit into a full outage.
