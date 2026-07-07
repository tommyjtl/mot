from __future__ import annotations

from functools import lru_cache

from transformers import pipeline

from .config import TRANSLATION_MODEL


@lru_cache(maxsize=1)
def get_translation_pipeline():
    return pipeline("translation", model=TRANSLATION_MODEL)


def translate_text(text: str) -> str:
    trimmed = text.strip()
    if not trimmed:
        return ""

    result = get_translation_pipeline()(trimmed)
    if isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, dict) and "translation_text" in first:
            return str(first["translation_text"]).strip()

    if isinstance(result, dict) and "translation_text" in result:
        return str(result["translation_text"]).strip()

    raise RuntimeError("Unexpected translation pipeline response")
