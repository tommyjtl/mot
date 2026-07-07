from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException, status

from ..config import JWT_ISSUER, JWT_SECRET, JWT_TTL_SECONDS


@dataclass(frozen=True)
class SessionUser:
    sub: str
    email: str


@dataclass(frozen=True)
class SessionToken:
    access_token: str
    expires_in: int
    user: SessionUser


def _require_jwt_secret() -> str:
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth_not_configured",
        )
    return JWT_SECRET


def mint_session_token(user: SessionUser) -> SessionToken:
    secret = _require_jwt_secret()
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=JWT_TTL_SECONDS)

    payload = {
        "sub": user.sub,
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": JWT_ISSUER,
    }

    access_token = jwt.encode(payload, secret, algorithm="HS256")

    return SessionToken(
        access_token=access_token,
        expires_in=JWT_TTL_SECONDS,
        user=user,
    )


def verify_session_token(token: str) -> SessionUser:
    secret = _require_jwt_secret()

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "email", "iss"]},
        )
    except jwt.PyJWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_session",
        ) from error

    sub = payload.get("sub")
    email = payload.get("email")

    if not isinstance(sub, str) or not sub.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_session",
        )

    if not isinstance(email, str) or not email.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_session",
        )

    return SessionUser(sub=sub.strip(), email=email.strip())
