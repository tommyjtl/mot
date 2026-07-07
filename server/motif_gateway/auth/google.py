from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token

from ..config import GOOGLE_OAUTH_CLIENT_ID


@dataclass(frozen=True)
class GoogleUser:
    sub: str
    email: str


def verify_google_id_token(token: str) -> GoogleUser:
    if not GOOGLE_OAUTH_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth_not_configured",
        )

    try:
        payload = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_OAUTH_CLIENT_ID,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_google_token",
        ) from error

    sub = payload.get("sub")
    email = payload.get("email")

    if not isinstance(sub, str) or not sub.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_google_token",
        )

    if not isinstance(email, str) or not email.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_google_token",
        )

    return GoogleUser(sub=sub.strip(), email=email.strip())
