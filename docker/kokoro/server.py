from __future__ import annotations

import io
import os
import threading
from contextlib import asynccontextmanager

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from kokoro_onnx import Kokoro
from pydantic import BaseModel, Field


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1)
    voice: str | None = None
    speed: float = Field(default=1.0, ge=0.5, le=1.5)
    lang: str = Field(default="en-us", min_length=2, max_length=16)


max_text_length = int(os.getenv("KOKORO_MAX_TEXT_LENGTH", "2000"))
default_voice = os.getenv("KOKORO_DEFAULT_VOICE", "af_sarah")
engine: Kokoro | None = None
engine_lock = threading.Lock()


@asynccontextmanager
async def lifespan(_: FastAPI):
    global engine
    engine = Kokoro(
        os.environ["KOKORO_MODEL_PATH"],
        os.environ["KOKORO_VOICES_PATH"],
    )
    yield
    engine = None


app = FastAPI(
    title="MOONDAY Local Kokoro TTS",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    if engine is None:
        raise HTTPException(status_code=503, detail="Kokoro model is not ready")
    return {"status": "ok"}


@app.post("/v1/audio/speech")
def create_speech(request: SpeechRequest) -> Response:
    if engine is None:
        raise HTTPException(status_code=503, detail="Kokoro model is not ready")

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text cannot be blank")
    if len(text) > max_text_length:
        raise HTTPException(
            status_code=422,
            detail=f"Text exceeds the {max_text_length} character limit",
        )

    try:
        with engine_lock:
            samples, sample_rate = engine.create(
                text,
                voice=request.voice or default_voice,
                speed=request.speed,
                lang=request.lang,
            )
    except Exception as error:
        raise HTTPException(status_code=422, detail="Speech generation failed") from error

    output = io.BytesIO()
    sf.write(output, samples, sample_rate, format="WAV")
    return Response(
        content=output.getvalue(),
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )
