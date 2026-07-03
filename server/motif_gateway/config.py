from __future__ import annotations

import json
import os
from pathlib import Path

HOST = os.getenv("MOTIF_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.getenv("MOTIF_GATEWAY_PORT", "8787"))

SUPERTONIC_BASE_URL = os.getenv(
    "MOTIF_SUPERTONIC_URL",
    "http://127.0.0.1:7788",
)

TRANSLATION_MODEL = os.getenv(
    "MOTIF_TRANSLATION_MODEL",
    "Helsinki-NLP/opus-mt-fr-en",
)

AUTH_DISABLED = os.getenv("MOTIF_AUTH_DISABLED", "").lower() in ("1", "true", "yes")
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
JWT_SECRET = os.getenv("MOTIF_JWT_SECRET", "").strip()
JWT_TTL_SECONDS = int(os.getenv("MOTIF_JWT_TTL_SECONDS", "86400"))
JWT_ISSUER = os.getenv("MOTIF_JWT_ISSUER", "motif-gateway")

_ALLOWED_SUBS_ENV = os.getenv("MOTIF_ALLOWED_SUBS", "").strip()
_ALLOWED_USERS_FILE = os.getenv(
    "MOTIF_ALLOWED_USERS_FILE",
    str(Path(__file__).resolve().parent.parent / "allowed_users.json"),
)


def _load_allowed_subs() -> frozenset[str]:
    subs: set[str] = set()

    if _ALLOWED_SUBS_ENV:
        subs.update(
            part.strip()
            for part in _ALLOWED_SUBS_ENV.split(",")
            if part.strip()
        )

    users_file = Path(_ALLOWED_USERS_FILE)
    if users_file.is_file():
        try:
            payload = json.loads(users_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            payload = []

        if isinstance(payload, list):
            for entry in payload:
                if isinstance(entry, dict):
                    sub = entry.get("sub")
                    if isinstance(sub, str) and sub.strip():
                        subs.add(sub.strip())
                elif isinstance(entry, str) and entry.strip():
                    subs.add(entry.strip())

    return frozenset(subs)


ALLOWED_SUBS = _load_allowed_subs()
