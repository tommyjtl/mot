# Authenticated model CDN (future)

**Status:** planned — not implemented.

Today Mot loads Supertonic TTS models from **Hugging Face** (production default) or a **local dev server** (`npm run models:serve`). This doc describes a future path: **Google sign-in + private S3/CloudFront** so only signed-in users can fetch models from our origin.

## Goals

- Gate model downloads on **our** CDN (not anonymous hotlinking).
- Own distribution if upstream (e.g. Hugging Face) access changes.
- Know who fetched models (abuse response, optional allowlists later).
- After a successful download, rely on the existing **Cache API** — no need to block local reuse or re-download on cache miss.

## Non-goals (v1 of this feature)

- DRM or encrypting ONNX files on disk.
- Blocking re-download after first success (re-auth on cache miss is fine).
- Replacing Hugging Face until the CDN path is stable (HF remains fallback during rollout).

---

## Decisions to confirm before build

| # | Question | Options / default proposal |
|---|----------|----------------------------|
| 1 | **Who can download?** | Start with any valid Google account; optional allowlist in Lambda later. |
| 2 | **Custom domain** | e.g. `models.example.com` — pick domain + Route 53 hosted zone. |
| 3 | **Model path versioning** | e.g. `https://models.example.com/supertonic-3/v1/onnx/...` — bump `v1` on breaking updates. |
| 4 | **Signed access shape** | **Signed cookies** (one auth → many files) vs per-file signed URLs. Prefer **cookies** for ~15 parallel ONNX/JSON fetches. |
| 5 | **Session length** | e.g. signed cookie TTL **24h**; extension re-auths when cache empty or cookie expired. |
| 6 | **HF fallback in shipped builds** | Keep `huggingface` source as emergency fallback vs Mot CDN only — recommend **CDN-only** once stable. |
| 7 | **Chrome Web Store** | Privacy policy + `identity` permission justification for Google sign-in. |

---

## Architecture

```text
Extension                         AWS
─────────                         ───
Sign in (Google)  ──►  API Gateway + Lambda
                       verify ID token, optional allowlist
                       mint CloudFront signed cookie(s)

fetch(model paths) ──► CloudFront (HTTPS, WAF rate limit)
                       OAC → private S3 bucket
                       supertonic-3/v1/onnx/...
                       voice_styles/...

Cache API (existing) ◄── 200 + Content-Length
  mot-supertonic-v3       (no further CDN hits until cache cleared)
```

**Services (AWS credits):** S3, CloudFront (+ OAC), ACM (us-east-1), API Gateway, Lambda, Secrets Manager (CloudFront signing key), optional WAF + DynamoDB (users/bans).

**Not needed:** EC2 for static file serving.

---

## Operator checklist (AWS + Google)

Do these before wiring the extension.

### 1. Google Cloud

1. Create OAuth client — type **Chrome extension**.
2. Add extension ID(s): dev unpacked ID + Web Store ID after publish.
3. Note **client ID** for the extension and for Lambda token verification.

### 2. S3

1. Bucket `mot-models-prod` (private, block public access).
2. Upload assets (same tree as local dev):

   ```bash
   python3 scripts/models.py download
   aws s3 sync models/supertonic-3/ s3://mot-models-prod/supertonic-3/v1/ \
     --cache-control "public, max-age=31536000, immutable"
   ```

3. Enable CORS (GET/HEAD) for debugging; extension fetches use `host_permissions`.

### 3. CloudFront

1. Origin: S3 bucket with **Origin Access Control (OAC)**.
2. Alternate domain: `models.example.com` + ACM cert in **us-east-1**.
3. Create **key group** + trusted key for signed URLs/cookies; store private key in Secrets Manager.
4. Behavior: require signed requests for `/supertonic-3/*` (or whole distribution).
5. Optional: WAF rate-based rule on the distribution.

### 4. Auth API

1. Lambda: `POST /auth/google` — verify Google ID token, return signed cookie policy (or cookie values for extension to set).
2. Lambda: optional `GET /auth/me` — health / session check.
3. Optional DynamoDB table: `userId`, `email`, `createdAt`, `banned`.

### 5. DNS

1. CNAME `models.example.com` → CloudFront distribution domain.

### 6. Verify

```bash
curl -I https://models.example.com/supertonic-3/v1/onnx/tts.json
# Expect 403 without signature; 200 with valid signed cookie/URL
```

---

## App wiring (when implemented)

### Current code paths

| File | Role today |
|------|------------|
| `utils/supertonic/constants.ts` | Local + Hugging Face base URLs |
| `utils/supertonic/model-source.ts` | Probe local server; fall back to HF |
| `utils/supertonic/model-cache.ts` | Cache API (persists across restarts) + fetch |
| `wxt.config.ts` | `host_permissions`: `huggingface.co`, `127.0.0.1:8091` |
| `scripts/models.py` | Local download + dev static server |

### Planned changes

1. **`ModelSource`** — add `"mot"` (or `"cdn"`) with `MOT_MODEL_BASE_URL`.
2. **`wxt.config.ts`** — add `https://models.example.com/*` and auth API origin; add `identity` permission.
3. **Auth module** (new) — e.g. `utils/auth/google-sign-in.ts`:
   - `chrome.identity.launchWebAuthFlow` (or `getAuthToken` if using Google account API).
   - Store refresh/session hint in `chrome.storage.local` (not the CloudFront private key).
4. **Model access** (new) — e.g. `utils/supertonic/model-access.ts`:
   - After sign-in, call auth API → receive signed cookie policy or signed URLs.
   - Attach cookies to model `fetch` (or use signed URLs in `modelAssetUrl`).
5. **First-run UX** — options page or overlay: “Sign in with Google to download pronunciation models.”
6. **Build flavors** — dev: local server preferred when running; production: HF via fallback; future: Mot CDN auth.

### Fetch flow (today)

```text
isModelCached()?  yes → Cache API (survives browser restart)
                no  → local server reachable?  yes → fetch local → cache
                                              no  → fetch Hugging Face → cache
```

---

## Rollout phases

| Phase | What |
|-------|------|
| **0 (now)** | HF + local dev server only. This doc. |
| **1** | S3 + CloudFront live; manual signed URL tests; no extension changes. |
| **2** | Auth API + extension sign-in; internal testers only. |
| **3** | Production extension uses Mot CDN; HF removed from `host_permissions` when stable. |
| **4 (optional)** | Allowlist, bans, analytics, paid tiers. |

---

## Related docs

- Local model server: `scripts/models.py`, `npm run models:download`, `npm run models:serve`
- Cache behavior: `utils/supertonic/model-cache.ts`
- Pre-submit testing: [testing.md](./testing.md) — add CDN auth smoke tests in phase 2
