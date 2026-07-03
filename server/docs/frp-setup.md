# FRP + Caddy setup for Motif cloud mode

Motif uses your existing FRP stack on EC2 (`52.72.164.119`). **frps** only needs the control port; each app gets a **remotePort** on EC2 and (optionally) a **Caddy HTTPS** front.

## Port map (your EC2)

| remotePort | Service | Public URL |
|------------|---------|------------|
| 7011 | crux-ios-pyapp | `services.cruxbeta.dev/crux/*` |
| 7012 | receipt-backend | (unused in Caddy) |
| 7013 | spray-segmentation | `spray-segmentation.cruxbeta.dev` |
| 7014 | spray-image-search | `spray-image-search.cruxbeta.dev` |
| 7015 | cue-messaging | `cue-messaging.tjtl.io` |
| **7016** | **motif-gateway** | **`motif-cloud.tjtl.io`** |

---

## 1. frps (EC2) — no change required

`~/tunneling/frps.toml` is already correct:

```toml
bindPort = 7010
```

Start (if not running):

```bash
cd ~/tunneling
/usr/local/bin/frps -c ./frps.toml
```

Or with PM2 (binary is `/usr/local/bin/frps`, not `./frps` in this directory):

```bash
cd ~/tunneling
pm2 start /usr/local/bin/frps --name frps -- -c /home/ubuntu/tunneling/frps.toml
pm2 save
```

Verify control port:

```bash
ss -tlnp | grep 7010
```

`frps` does **not** list per-app proxies; those are defined in **frpc** on your Mac.

---

## 2. frpc (Mac) — already updated

`~/.frpc/frpc.toml` should include:

```toml
[[proxies]]
name = "motif-gateway"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8787
remotePort = 7016
```

Restart after edits:

```bash
pm2 restart frp-client
```

---

## 3. DNS

Add an **A record** (same target as your other `*.tjtl.io` / EC2 records):

```
motif-cloud.tjtl.io  →  52.72.164.119
```

Verify from your laptop:

```bash
dig motif-cloud.tjtl.io +short
```

---

## 4. Caddy (EC2)

Add this block to `/etc/caddy/Caddyfile` (same pattern as `cue-messaging.tjtl.io`):

```caddy
motif-cloud.tjtl.io {
        reverse_proxy 127.0.0.1:7016 {
                header_up Host {host}
                header_up X-Forwarded-Proto {scheme}
                header_up X-Forwarded-For {remote_host}
        }
}
```

Reload:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Security group: **80** and **443** open (you already have these). You do **not** need to expose 7016 publicly — Caddy talks to it on localhost only.

---

## 5. Local Motif gateway

On your Mac:

```bash
npm run server:start
```

Test locally:

```bash
curl http://127.0.0.1:8787/v1/health
```

Test through tunnel (after frpc + Caddy + DNS):

```bash
curl https://motif-cloud.tjtl.io/v1/health
curl -X POST https://motif-cloud.tjtl.io/v1/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"J'\''ai adoré ce film.","source":"fr","target":"en"}'
```

---

## 6. Extension

Options → **Cloud** → server URL defaults to `https://motif-cloud.tjtl.io`.

Flow:

```
Extension → HTTPS motif-cloud.tjtl.io → Caddy → 127.0.0.1:7016 (EC2)
         → FRP tunnel → 127.0.0.1:8787 (your Mac) → Motif gateway
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `curl https://motif-cloud.tjtl.io` fails | DNS, Caddy reload, `pm2 logs frp-client` |
| Caddy 502 | Gateway not running locally, or frpc not connected |
| Extension "server unreachable" | Reload extension after `wxt` rebuild; confirm host permission `https://motif-cloud.tjtl.io/*` |
| Port conflict | Never use **7015** for Motif — reserved for cue-messaging |
