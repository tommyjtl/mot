from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..config import ALLOWED_SUBS, AUTH_DISABLED
from .deps import is_sub_allowlisted, require_auth
from .google import verify_google_id_token
from .jwt import SessionToken, SessionUser, mint_session_token, verify_session_token

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class SessionExchangeRequest(BaseModel):
    id_token: str = Field(min_length=1)


class AuthUserResponse(BaseModel):
    sub: str
    email: str


class SessionExchangeResponse(BaseModel):
    access_token: str
    expires_in: int
    token_type: str = "Bearer"
    user: AuthUserResponse


@router.post("/session", response_model=SessionExchangeResponse)
def exchange_session(request: SessionExchangeRequest) -> SessionExchangeResponse:
    if AUTH_DISABLED:
        token = mint_session_token(SessionUser(sub="dev", email="dev@local"))
        return _to_response(token)

    google_user = verify_google_id_token(request.id_token)

    if not is_sub_allowlisted(google_user.sub):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "not_allowlisted",
                "email": google_user.email,
            },
        )

    token = mint_session_token(
        SessionUser(sub=google_user.sub, email=google_user.email),
    )
    return _to_response(token)


@router.get("/me", response_model=AuthUserResponse)
def auth_me(user: SessionUser = Depends(require_auth)) -> AuthUserResponse:
    return AuthUserResponse(sub=user.sub, email=user.email)


def _to_response(token: SessionToken) -> SessionExchangeResponse:
    return SessionExchangeResponse(
        access_token=token.access_token,
        expires_in=token.expires_in,
        user=AuthUserResponse(sub=token.user.sub, email=token.user.email),
    )
