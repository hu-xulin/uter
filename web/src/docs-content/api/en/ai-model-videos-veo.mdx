# Google Veo Format

Google Veo 3.1 video generation: call the full Veo 3.1 model family through an asynchronous task API, supporting text-to-video and image-to-video with optional synchronised audio (up to 4K output).

## Supported Models

All three models share a single endpoint and are distinguished only by the `model` field. Every model supports text-to-video and image-to-video, with optional audio generation.

| Model ID | Version | Highlights | Best for |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | Highest quality, 4K, native audio | High-quality creative and commercial work |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | Faster, balanced quality | Rapid iteration, batch generation |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | Fastest, lowest cost | Prototyping, cost-sensitive cases |

## Create Video

`POST` `/v1/video/generations`

### Request Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | `Bearer sk-your-api-key` |
| `Content-Type` | Yes | `application/json` |

### Request Body (`application/json`)

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | string | Yes | Veo 3.1 model ID, see the table above |
| `prompt` | string | Yes | Video prompt; Chinese and English supported, English recommended for best results |
| `size` | string | No | Resolution: `720p` / `1080p` / `4000` (4K, only some models), default `1080p` |
| `resolution` | string | No | Same as `size` (recommended, matches upstream; wins when both are set) |
| `duration` | int | No | Length in seconds: `4` / `6` / `8`, default `8` |
| `seconds` | string | No | String form of `duration` (for OpenAI Sora API compatibility) |
| `aspect_ratio` | string | No | Aspect ratio: `16:9` / `9:16`, default `16:9` |
| `generate_audio` | bool | No | Generate synchronised audio (speech, effects, ambience). **Default `true`**; set explicitly to `false` to save cost |
| `negative_prompt` | string | No | Negative prompt describing what to avoid |
| `image` | string | No | i2v first-frame image; HTTP(S) URL / data URI / raw base64 |
| `images` | string[] | No | i2v first-frame array; only `images[0]` is used, and `image` wins if both are sent |
| `last_frame_image` | string | No | Last-frame image (with `image` / `images[0]` → first+last-frame interpolation, Veo 3.1 exclusive). Same format as `image` |
| `reference_images` | string[] | No | Asset reference images, up to 3; submitted upstream as `referenceType="asset"`. **Mutually exclusive with `image` / `last_frame_image`**, and only supported for `duration=8` |
| `metadata` | object | No | Veo native parameters container, see "metadata Advanced Parameters" |

> Top-level snake_case fields such as `generate_audio` / `negative_prompt` / `aspect_ratio` are automatically mapped to upstream camelCase parameters. You may also place them inside `metadata` (snake_case or camelCase), which is equivalent to the top level.
>
> `generate_audio: true` significantly increases cost (roughly 2×). As the billing default is `true`, set `generate_audio: false` explicitly when audio is not needed.

### Response

| Status | Description |
|---|---|
| `200` | Video task created successfully |
| `400` | Invalid request parameters |

#### `200` Response Fields

| Field | Type | Description |
|---|---|---|
| `id` / `task_id` | string | Public task ID (`task_` prefix) used for subsequent queries |
| `object` | string | Object type (`video`) |
| `model` | string | Model used |
| `status` | string | Task status (`queued` right after submission) |
| `progress` | integer | Progress percentage |
| `created_at` | integer | Creation timestamp |

## Get Video Task Status

`GET` `/v1/video/generations/{task_id}`

The response uses Uter's unified `{code, message, data}` envelope.

### Request Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `task_id` | path | string | Yes | Video task ID |

### Response

| Status | Description |
|---|---|
| `200` | Task status retrieved successfully |
| `404` | Task not found |

#### `200` Response Fields (`data`)

| Field | Type | Description |
|---|---|---|
| `data.task_id` | string | Task ID |
| `data.status` | string | Task status: `queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | Failure reason; `null` on success |
| `data.format` | string / null | Output format (e.g. `mp4`); `null` while processing or on failure |
| `data.metadata` | object / null | Additional metadata |
| `data.url` | string / null | Video download URL; `null` while processing or on failure (temporary signed link, valid 24 hours) |

#### Status Enum

| Status | Description |
|---|---|
| `queued` | Submitted, awaiting processing |
| `processing` | Generating |
| `succeeded` | Completed; `data.url` holds the download address |
| `failed` | Failed; `data.error` explains why |

## Image Input Formats

`image` / `images[0]` accept the following three formats; Uter detects and converts them to the inline base64 that Veo expects:

| Format | Example | Description |
|---|---|---|
| HTTP(S) URL | `https://example.com/foo.png` | Downloaded and base64-encoded by the backend; the URL must be publicly reachable and unexpired |
| data URI | `data:image/png;base64,iVBOR...` | Inline data passed through directly; no network needed |
| raw base64 | `iVBORw0KGgo...` (no prefix) | Bare base64; MIME type is sniffed automatically |

Limits: decoded size ≤ **20 MB**; URL download timeout **30 seconds**; parse failures (unreachable URL / too large / invalid base64) return `400 parse images[0] failed: ...` with **no charge**. Native `gs://` GCS URIs are not supported; use `https://storage.googleapis.com/...` instead.

## metadata Advanced Parameters

`metadata` is a Veo-native parameter container for advanced options not present in the OpenAI style. All top-level fields may also be placed inside `metadata` (snake_case or camelCase).

| Field | Type | Description |
|---|---|---|
| `seed` | int | Random seed (recommended location) |
| `personGeneration` / `person_generation` | string | Person generation policy: `allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | Write the result directly to a GCS bucket path (vertex channel only; requires permissions) |
| `compressionQuality` / `compression_quality` | string | Compression quality: `optimized` (default) / `lossless` |
| `resizeMode` / `resize_mode` | string | i2v resize mode: `crop` / `fit` |
| `sampleCount` / `sample_count` | int | Number of videos per request; **currently fixed at 1**, any value is overridden |

> Precedence: camelCase already in metadata > snake_case in metadata > top-level fields.

## Model Comparison

| Item | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **Model ID** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **Quality** | Highest | Balanced | Basic |
| **Speed (measured, 8s video)** | 90–130 s | 75–105 s | 50–80 s |
| **Max resolution** | 4K | 1080p | 1080p |
| **Audio support** | ✓ | ✓ | ✓ |
| **Image-to-video** | ✓ | ✓ | ✓ |

## OpenAI-Compatible Endpoint

Besides `/v1/video/generations`, an OpenAI-style `/v1/videos` endpoint is available; the two are fully equivalent.

- Submit: `POST` `/v1/videos` (identical body fields)
- Query: `GET` `/v1/videos/{task_id}` (returns the flat OpenAI format)

> The OpenAI-compatible query response does not include the video URL. To obtain the download address, use `/v1/video/generations/{task_id}` and read `data.url`.

## Billing

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0 (production default group)
```

### Video only (`generate_audio: false`)

| Model | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.20 / s | $0.20 / s | $0.40 / s |
| `veo-3.1-fast-generate-001` | $0.08 / s | $0.10 / s | $0.25 / s |
| `veo-3.1-lite-generate-001` | $0.03 / s | $0.05 / s | — |

### Video + audio (`generate_audio: true`)

| Model | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.40 / s | $0.40 / s | $0.60 / s |
| `veo-3.1-fast-generate-001` | $0.10 / s | $0.12 / s | $0.30 / s |
| `veo-3.1-lite-generate-001` | $0.05 / s | $0.08 / s | — |

On `failed`, Uter refunds automatically.

## Full Example

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# Poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Once data.status == "succeeded", download from data.url
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

First+last-frame interpolation (Veo 3.1 exclusive):

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` cannot be combined with `image` / `images` / `last_frame_image`, otherwise `400 reference_images is mutually exclusive ...` is returned.
- `reference_images` accepts at most 3 entries; more returns `400 reference_images supports at most 3 entries`.
- `reference_images` is only supported for `duration=8`.

## Status Codes and Errors

| Status | Reason | Action |
|---|---|---|
| `400` | Parameter error (missing `prompt`, invalid `duration`, or image parse failure `parse images[0] failed: ...`) | Check the request body fields |
| `401` | API key invalid or expired | Check the `Authorization` header |
| `403` | API key not allowed to access this model | Check the token model whitelist |
| `402` | Insufficient balance | Top up in the Uter console |

Common `failed` causes: content safety rejection (adjust the prompt; add `negative_prompt`), unreachable image URL, `duration` out of range, or 4K requested on the Lite model.
