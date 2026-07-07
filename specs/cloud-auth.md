# Cloud mode authentication

**Status:** implemented (v1) — gateway + extension wiring. Operator must configure Google OAuth + allowlist.

Gate **cloud mode** behind Google sign-in. Only allowlisted Google accounts (`sub`) may call Motif cloud APIs on the self-hosted gateway (`motif-cloud.tjtl.io` via FRP). Private mode stays unauthenticated and on-device.

This auth layer will later be reused for the authenticated model CDN ([authenticated-model-cdn.md](./authenticated-model-cdn.md)).

---

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Audience size | ≤10 users (personal + small beta) |
| 2 | Allowlist key | Google `sub` (stable user ID); email for display/errors only |
| 3 | Sign-in UX | Explicit **Sign in with Google** button; attempt **silent** sign-in first when Chrome already has an active Google session |
| 4 | Auth scope | One system for cloud API now + model CDN later |
| 5 | Where auth runs | Self-hosted FastAPI gateway (`server/`), same tunnel as today |

---

## Goals

- Require authentication before cloud mode is usable (translate now; TTS/STT later).
- Server-side allowlist — never trust the extension.
- Issue short-lived **Motif session JWTs** so API calls don't re-verify with Google every time.
- Clear UX when signed out, wrong account, or not allowlisted.
- Minimal ops overhead for ≤10 users.

## Non-goals (v1)

- Multi-provider sign-in (Apple, email/password).
- Self-service signup or billing.
- User admin dashboard (allowlist is config/env).
- Auth for private mode.
- Per-route billing or usage metering.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Chrome extension                                                │
│                                                                 │
│  Options page                                                   │
│    1. trySilentGoogleSignIn()   ← launchWebAuthFlow + prompt=none│
│    2. signInWithGoogle()        ← explicit button               │
│    3. exchangeSession(id_token) → POST /v1/auth/session         │
│    4. store Motif JWT in chrome.storage.local                   │
│                                                                 │
│  Background / translators                                       │
│    fetch /v1/translate  Authorization: Bearer <motif_jwt>       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ motif-cloud.tjtl.io  (Caddy → FRP :7016 → Mac :8787)           │
│                                                                 │
│  FastAPI gateway                                                │
│    POST /v1/auth/session   verify Google token, check allowlist │
│    GET  /v1/auth/me        return { sub, email } from JWT       │
│    GET  /v1/health         public (sanitized, no secrets)         │
│    POST /v1/translate      require Motif JWT                      │
│    (future TTS/STT)        require Motif JWT                    │
└─────────────────────────────────────────────────────────────────┘
```

### Token flow

```mermaid
sequenceDiagram
    participant Opt as Options page
    participant Google
    participant GW as Gateway
    participant BG as Background

    Opt->>Google: launchWebAuthFlow (prompt=none, openid)
    alt Active Google session
        Google-->>Opt: ID token
    else No session
        Google-->>Opt: error
        Opt->>Opt: Show "Sign in with Google"
        Opt->>Google: launchWebAuthFlow (interactive)
        Google-->>Opt: ID token
    end

    Opt->>GW: POST /v1/auth/session { id_token }
    GW->>GW: Verify JWT (aud, iss, exp) + allowlist[sub]
    alt Allowed
        GW-->>Opt: { access_token, expires_in, user }
        Opt->>Opt: chrome.storage.local
    else Not allowed
        GW-->>Opt: 403 { detail, email }
    end

    BG->>GW: POST /v1/translate + Bearer access_token
    GW->>GW: Verify Motif JWT + sub in allowlist
    GW-->>BG: { text }
```

### Why two tokens?

| Token | Issuer | TTL | Purpose |
|-------|--------|-----|---------|
| Google ID token | Google | ~1 h | Prove identity once at sign-in |
| Motif session JWT | Gateway | 24 h | API calls; no Google round-trip per translate |

Motif JWT claims: `sub`, `email`, `iat`, `exp`, `iss: motif-gateway`.

---

## Sign-in UX

### Silent first, explicit fallback

On Options page load (or when user clicks Cloud):

1. **Silent attempt** — `chrome.identity.launchWebAuthFlow` with OAuth URL including `prompt=none` and `openid email profile` scopes. Succeeds when the browser already has an active Google session for a permitted account.
2. **On failure** (no session, consent required, wrong account) — show signed-out state with **Sign in with Google** button.
3. **Explicit sign-in** — same flow without `prompt=none` (or `prompt=select_account` if you want account picker every time).

Do **not** use `getProfileUserInfo()` alone — it is not cryptographically verifiable server-side.

### Cloud mode gating

| State | Cloud mode selectable? | Shortcuts (cloud)? |
|-------|------------------------|-------------------|
| Not signed in | No (or select → immediately prompt sign-in) | Blocked |
| Signed in, not allowlisted | No — show error with email | Blocked |
| Signed in, allowlisted | Yes | Allowed (translate today) |
| Session expired | Show "Session expired — sign in again" | Blocked until refresh |

**Recommended flow:** user can click Cloud, but saving cloud mode requires a valid session. Private mode never requires sign-in.

### Signed-in UI (Options)

```
Runtime mode
  [ Private ]  [ Cloud ✓ ]

  Signed in as you@example.com        [ Sign out ]

  Motif server
  https://motif-cloud.tjtl.io
  Server reachable.
```

### Error copy

| Case | Message |
|------|---------|
| Not allowlisted | "This Google account isn't authorized for Motif Cloud. Signed in as you@example.com." |
| Session expired | "Your session expired. Sign in again to use cloud mode." |
| Server unreachable | (existing) "Server unreachable…" |
| 401 on API call | Trigger silent re-auth once; then prompt explicit sign-in |

---

## Allowlist (≤10 users)

**v1: environment variable on the gateway**

```bash
# server/.env or pm2 env
MOTIF_ALLOWED_SUBS=108123456789012345678,102987654321098765432
MOTIF_JWT_SECRET=<random 32+ bytes>
GOOGLE_OAUTH_CLIENT_ID=<chrome extension client id>
```

Optional companion file for readability (gitignored, loaded at startup):

```json
// server/allowed_users.json (optional)
[
  { "sub": "108123456789012345678", "email": "you@example.com", "note": "tommy" },
  { "sub": "102987654321098765432", "email": "friend@example.com", "note": "beta" }
]
```

**Getting a user's `sub`:** after first sign-in attempt, log it server-side (even if not allowlisted) or use [Google OAuth Playground](https://developers.google.com/oauthplayground/) during setup. Do not allowlist by email alone.

**Revocation:** remove `sub` from env → restart gateway. Existing JWTs expire within 24 h; optional `MOTIF_JWT_SECRET` rotation for immediate kill.

---

## Gateway changes (`server/`)

### New modules

| File | Role |
|------|------|
| `motif_gateway/config.py` | `ALLOWED_SUBS`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `JWT_TTL` |
| `motif_gateway/auth/google.py` | Verify Google ID token (`google-auth`) |
| `motif_gateway/auth/jwt.py` | Mint + verify Motif session JWT |
| `motif_gateway/auth/middleware.py` | `require_auth` dependency for protected routes |
| `motif_gateway/auth/routes.py` | `POST /v1/auth/session`, `GET /v1/auth/me` |

### New dependencies

```
google-auth>=2.36.0
PyJWT>=2.9.0
```

### Endpoints

#### `POST /v1/auth/session`

Request:

```json
{ "id_token": "<google_id_token>" }
```

Response 200:

```json
{
  "access_token": "<motif_jwt>",
  "expires_in": 86400,
  "token_type": "Bearer",
  "user": { "sub": "…", "email": "you@example.com" }
}
```

Response 403:

```json
{ "detail": "not_allowlisted", "email": "other@gmail.com" }
```

#### `GET /v1/auth/me`

Requires `Authorization: Bearer <motif_jwt>`. Returns `{ sub, email, exp }`.

#### `GET /v1/health` (updated)

Public. Return reachability only — **remove** `supertonic_url` from unauthenticated response (or gate behind auth).

#### Protected routes

Apply auth dependency to:

- `POST /v1/translate`
- Future `/v1/tts/*`, `/v1/stt/*`
- Future `POST /v1/auth/cdn-cookies` (model CDN)

Return `401` without/invalid token. Re-check `sub` against allowlist on each request (cheap set lookup).

### Caddy hardening (EC2, optional but recommended)

Restrict proxied paths to `/v1/*` so scanner noise (`/wp-config.php`, etc.) never hits uvicorn:

```caddy
motif-cloud.tjtl.io {
    handle /v1/* {
        reverse_proxy 127.0.0.1:7016
    }
    respond 404
}
```

---

## Extension changes

### Manifest (`wxt.config.ts`)

```ts
permissions: [..., "identity"],
// oauth2 block optional if using launchWebAuthFlow with full URL
```

Add host permission for Google OAuth if needed: `https://accounts.google.com/*`.

### New modules

| File | Role |
|------|------|
| `utils/auth/types.ts` | `AuthUser`, `AuthSession`, storage keys |
| `utils/auth/google-sign-in.ts` | Silent + explicit `launchWebAuthFlow`, parse ID token |
| `utils/auth/session.ts` | Exchange, store, load, clear, `getValidAccessToken()` |
| `utils/auth/auth-store.ts` | Reactive store for Options UI |

### Storage keys (`chrome.storage.local`)

| Key | Value |
|-----|-------|
| `motAuthSession` | `{ accessToken, expiresAt, user: { sub, email } }` |

Clear session when: user signs out, switches to Private mode, token rejected with 401.

### Wire auth into existing cloud paths

| File | Change |
|------|--------|
| `utils/remote-api.ts` | `authHeaders()` helper; attach Bearer token |
| `utils/translation/remote-translator.ts` | Use `authHeaders()`; handle 401 → re-auth |
| `entrypoints/options/components/RuntimeModeSection.tsx` | Sign-in UI, gate Cloud selection |
| `entrypoints/options/hooks/useRuntimeMode.ts` | Auth state alongside runtime mode |
| `entrypoints/background.ts` | Block cloud shortcuts if no valid session |
| `utils/runtime-mode-store.ts` | `isCloudSessionReady()` helper |

### `fetchRemote` wrapper (recommended)

Centralize in `utils/remote-api.ts`:

```ts
export async function fetchRemote(path, init?): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new AuthRequiredError();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}
```

---

## Google Cloud setup (operator)

Do once before extension wiring.

1. **Google Cloud project** (can reuse existing Motif project).
2. **OAuth consent screen** — External or Internal (if Google Workspace).
3. **OAuth client** — type **Chrome extension**:
   - Dev unpacked extension ID (from `chrome://extensions`)
   - Published Web Store ID (add after first publish; can use two clients or update one)
4. Note **Client ID** → `GOOGLE_OAUTH_CLIENT_ID` on gateway + extension build config.
5. Scopes: `openid`, `email`, `profile` (no Gmail/Drive scopes).

### Extension OAuth URL shape (for `launchWebAuthFlow`)

```
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=<CLIENT_ID>
  &response_type=id_token
  &redirect_uri=https://<EXTENSION_ID>.chromiumapp.org/
  &scope=openid%20email%20profile
  &nonce=<random>
  [&prompt=none]   ← silent attempt only
```

Redirect URI is always `https://<extension-id>.chromiumapp.org/` for Chrome extensions.

---

## Security notes

| Topic | Approach |
|-------|----------|
| Allowlist | Server only; `sub` not email |
| JWT secret | Env var; never in extension |
| ID token verify | Check `aud`, `iss`, `exp`, signature via Google certs |
| HTTPS | Caddy terminates TLS; tunnel is TCP |
| Scanner traffic | Caddy path filter; 404 at edge |
| Session theft | Extension storage is local; acceptable for personal beta |
| Immediate revoke | Remove `sub` + optional secret rotation |
| Logging | Log auth failures with `sub`/email; don't log JWTs |

---

## Unified auth: cloud API + model CDN (later)

When model CDN ships, extend the same session:

```
POST /v1/auth/cdn-cookies   Authorization: Bearer <motif_jwt>
  → verify session + allowlist
  → return CloudFront signed cookie policy (or short-lived signed URLs)
```

Extension flow unchanged: one sign-in, one Motif JWT, multiple resource types.

---

## Chrome Web Store

- Add `identity` permission.
- Privacy policy update: Google sign-in, what is stored (`sub`, email, session token locally), what is sent to `motif-cloud.tjtl.io`.
- Permission justification text for reviewers.

---

## Implementation phases

### Phase 0 — Operator prep (no extension changes)

- [ ] Create Google OAuth Chrome extension client(s)
- [ ] Generate `MOTIF_JWT_SECRET`
- [ ] Collect beta users' Google `sub` values
- [ ] Set `MOTIF_ALLOWED_SUBS` on gateway host
- [ ] (Optional) Update Caddy path filter on EC2

### Phase 1 — Gateway auth

- [ ] `POST /v1/auth/session`, `GET /v1/auth/me`
- [ ] Auth middleware on `/v1/translate`
- [ ] Sanitize `/v1/health`
- [ ] Manual test: `curl` with token from OAuth Playground

### Phase 2 — Extension sign-in UI

- [ ] `utils/auth/*` modules
- [ ] Options: silent + explicit sign-in, sign-out, session display
- [ ] Gate cloud mode on valid allowlisted session
- [ ] `identity` permission + OAuth client ID in extension

### Phase 3 — Wire API calls

- [ ] `fetchRemote` with Bearer token
- [ ] `remote-translator.ts` + future TTS/STT clients
- [ ] Background: block cloud shortcuts without session
- [ ] 401 → silent re-auth → explicit prompt

### Phase 4 — Hardening + docs

- [ ] Caddy `/v1/*` filter (if not done in Phase 0)
- [ ] Update `server/docs/frp-setup.md` with auth env vars
- [ ] Update `specs/authenticated-model-cdn.md` to reference this doc
- [ ] Smoke test checklist (below)

---

## Test plan

| # | Test | Expected |
|---|------|----------|
| 1 | `GET /v1/health` no auth | 200, no sensitive fields |
| 2 | `POST /v1/translate` no auth | 401 |
| 3 | Sign in (allowlisted) | Session returned, Options shows email |
| 4 | Sign in (not allowlisted) | 403, clear error, cloud mode blocked |
| 5 | Silent sign-in (logged into Chrome Google) | No popup, session established |
| 6 | Silent fails → explicit button | Popup, then session |
| 7 | Translate in cloud mode | Works with Bearer token |
| 8 | Expired session | 401 → re-auth prompt |
| 9 | Sign out | Session cleared, cloud shortcuts blocked |
| 10 | Switch Private → Cloud | Requires sign-in again if session was cleared |
| 11 | Scanner path `/wp-config.php` | 404 at Caddy, not in gateway logs |

---

## Open questions (minor — can decide during build)

1. **Account picker on explicit sign-in?** `prompt=select_account` vs default (recommend `select_account` so users can switch Google accounts).
2. **JWT TTL:** 24 h default — OK?
3. **Dev bypass?** Optional `MOTIF_AUTH_DISABLED=1` for local gateway testing without Google (dev only, never in production).

---

## Related docs

- [authenticated-model-cdn.md](./authenticated-model-cdn.md) — CDN phase reuses this auth
- [server/docs/frp-setup.md](../server/docs/frp-setup.md) — tunnel + Caddy
- [utils/runtime-mode.ts](../utils/runtime-mode.ts) — cloud vs private mode
