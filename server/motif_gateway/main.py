from __future__ import annotations

import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth.deps import optional_auth, require_auth
from .auth.jwt import SessionUser
from .auth.routes import router as auth_router
from .config import AUTH_DISABLED, HOST, PORT, SUPERTONIC_BASE_URL
from .translate import translate_text

app = FastAPI(title="Motif Gateway", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1)
    source: str = "fr"
    target: str = "en"


class TranslateResponse(BaseModel):
    text: str


@app.get("/v1/health")
def health(user: SessionUser | None = Depends(optional_auth)) -> dict:
    payload: dict = {
        "status": "ok",
        "services": {
            "translation": "ready",
            "tts": "pending",
            "stt": "pending",
        },
        "auth": {
            "required": not AUTH_DISABLED,
            "signed_in": user is not None,
        },
    }

    if user is not None:
        payload["user"] = {"sub": user.sub, "email": user.email}
        payload["supertonic_url"] = SUPERTONIC_BASE_URL

    return payload


@app.post("/v1/translate", response_model=TranslateResponse)
def translate(
    request: TranslateRequest,
    _user: SessionUser = Depends(require_auth),
) -> TranslateResponse:
    if request.source != "fr" or request.target != "en":
        raise HTTPException(
            status_code=400,
            detail="Only fr→en translation is supported in v1.",
        )

    try:
        text = translate_text(request.text)
    except Exception as error:  # noqa: BLE001 — surface model failures to client
        raise HTTPException(status_code=500, detail=str(error)) from error

    if not text:
        raise HTTPException(status_code=422, detail="Translation returned empty text.")

    return TranslateResponse(text=text)


def main() -> None:
    uvicorn.run("motif_gateway.main:app", host=HOST, port=PORT, reload=False)


if __name__ == "__main__":
    main()
