# Local Kokoro-82M speech output

This optional service produces MOONDAY speech entirely on your machine. It uses the CPU ONNX runtime and Kokoro-82M's quantized `int8` model. No transcript, generated audio, or API key leaves the machine while it is running.

The first build downloads the pinned Kokoro ONNX package and model files into the Docker image. Once built, normal container starts do not download models or call a cloud TTS provider.

## Start

```sh
bun run tts:up
```

The API is available only to the local machine at `http://127.0.0.1:8880`. It is deliberately not published to your LAN.

Wait for the model to load, then verify it:

```sh
docker compose -f docker-compose.kokoro.yml ps
curl http://127.0.0.1:8880/healthz
```

The service is healthy when it returns:

```json
{ "status": "ok" }
```

## Generate a local test clip

```sh
curl --request POST http://127.0.0.1:8880/v1/audio/speech \
  --header 'Content-Type: application/json' \
  --data '{"text":"Hello from your private MOONDAY voice.","voice":"af_sarah","lang":"en-us"}' \
  --output moonday-test.wav
```

The endpoint accepts `text`, optional `voice`, `speed` (`0.5`–`1.5`), and `lang`. It returns `audio/wav` and accepts at most 2,000 characters per request. The service intentionally does not persist generated audio.

## Operational safeguards

- The port binds to `127.0.0.1` only.
- The container runs as an unprivileged user with all Linux capabilities dropped.
- Its filesystem is read-only except for an in-memory `/tmp`. Kokoro's phonemizer needs to load its own temporary `libespeak-ng` copy there, so this mount explicitly uses `exec` rather than Docker's default `noexec`.
- It has PID, CPU, and memory limits and runs a single worker because ONNX model loading is memory-heavy.
- The health endpoint and speech endpoint are the only exposed routes; interactive API docs are disabled.

Use these commands for routine operations:

```sh
bun run tts:logs
bun run tts:down
```

## Optional NVIDIA GPU acceleration

The normal Compose file is CPU-first and works everywhere. On a host with a supported NVIDIA driver and NVIDIA Container Toolkit, use the GPU override:

```sh
docker compose -f docker-compose.kokoro.yml -f docker-compose.kokoro.gpu.yml up -d --build
```

Or use `bun run tts:up:gpu`.

This installs Kokoro's GPU ONNX runtime extra, exposes the GPU, and selects `CUDAExecutionProvider`. It is optional: do not use it on machines without a working NVIDIA Docker runtime.

## MOONDAY configuration

The environment template includes these values for the later application integration:

```env
KOKORO_TTS_URL="http://127.0.0.1:8880"
KOKORO_TTS_VOICE="af_sarah"
KOKORO_TTS_TIMEOUT_MS="60000"
```

MOONDAY's chat UI sends English assistant replies to its same-origin `/api/speech` route, which proxies them to this local service. The browser never calls port `8880` directly. If the container is stopped or a language has no suitable Kokoro voice, MOONDAY falls back to browser speech synthesis.

Kokoro voices are language-specific. `af_sarah` is an English voice; choose a voice and language that Kokoro supports instead of expecting English voices to pronounce Indonesian naturally. The default service allocation is four CPU cores; lower it only if your machine needs the capacity more than voice latency.
