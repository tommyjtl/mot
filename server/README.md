# Motif Gateway

Self-hosted Python API for cloud mode: translation today, TTS/STT next.

## npm scripts

| Command | Purpose |
|---------|---------|
| `npm run server:start` | Start gateway on `http://127.0.0.1:8787` (logs to `server/logs/gateway.log`) |
| `npm run server:stop` | Stop the process on port 8787 |
| `npm run server:restart` | Stop, then start |
| `npm run server:health` | `curl /v1/health` (pretty JSON) |
| `npm run server:status` | PID, URL, log path, health |
| `npm run server:log` | Last 50 log lines |
| `npm run server:log -- -f` | Follow log file |

## Quick start

```bash
cd server
chmod +x scripts/start-local.sh
./scripts/start-local.sh
```

First run downloads Opus-MT (`Helsinki-NLP/opus-mt-fr-en`, ~300 MB).

Health check:

```bash
curl http://127.0.0.1:8787/v1/health
```

Translate requires a Motif session JWT (see [specs/cloud-auth.md](../specs/cloud-auth.md)).
With `MOTIF_AUTH_DISABLED=1` in `server/.env`:

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"id_token":"dev"}'

curl -X POST http://127.0.0.1:8787/v1/translate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{"text":"J'\''ai adoré ce film.","source":"fr","target":"en"}'
```

## FRP tunnel (existing ~/.frpc/)

Your frps: `52.72.164.119:7010`. Add the snippet from
[`scripts/frpc.motif.toml.snippet`](scripts/frpc.motif.toml.snippet) to
`~/.frpc/frpc.toml`, then restart frpc:

```bash
pm2 restart frp-client
```

Extension default URL: `https://motif-cloud.tjtl.io` (see [docs/frp-setup.md](docs/frp-setup.md)).

## Environment

Copy [`.env.example`](.env.example) to `server/.env` before production use.

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOTIF_GATEWAY_HOST` | `127.0.0.1` | Bind host |
| `MOTIF_GATEWAY_PORT` | `8787` | Bind port (frpc localPort) |
| `MOTIF_TRANSLATION_MODEL` | `Helsinki-NLP/opus-mt-fr-en` | HF translation model |
| `MOTIF_SUPERTONIC_URL` | `http://127.0.0.1:7788` | Future TTS proxy target |
| `GOOGLE_OAUTH_CLIENT_ID` | — | Chrome extension OAuth client ID |
| `MOTIF_ALLOWED_SUBS` | — | Comma-separated Google user IDs (`sub`) |
| `MOTIF_JWT_SECRET` | — | Secret for Motif session JWTs |
| `MOTIF_JWT_TTL_SECONDS` | `86400` | Session lifetime (24h) |
| `MOTIF_AUTH_DISABLED` | — | `1` for local dev only (never production) |

Optional allowlist file: copy [`allowed_users.example.json`](allowed_users.example.json) to `allowed_users.json` (gitignored).

Auth spec: [../specs/cloud-auth.md](../specs/cloud-auth.md).

## Roadmap

- TTS: proxy to `supertonic serve`
- STT: faster-whisper WebSocket stream
