from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import ALLOWED_SUBS, AUTH_DISABLED
from .jwt import SessionUser, verify_session_token

_bearer = HTTPBearer(auto_error=False)


def is_sub_allowlisted(sub: str) -> bool:
    return sub in ALLOWED_SUBS


def require_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> SessionUser:
    if AUTH_DISABLED:
        return SessionUser(sub="dev", email="dev@local")

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth_required",
        )

    user = verify_session_token(credentials.credentials)

    if not is_sub_allowlisted(user.sub):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="not_allowlisted",
        )

    return user


def optional_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> SessionUser | None:
    if AUTH_DISABLED or credentials is None:
        return None

    if credentials.scheme.lower() != "bearer":
        return None

    try:
        user = verify_session_token(credentials.credentials)
    except HTTPException:
        return None

    if not is_sub_allowlisted(user.sub):
        return None

    return user
