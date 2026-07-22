FROM python:3.12-slim

ARG KOKORO_ONNX_VERSION=0.5.0
ARG KOKORO_ONNX_PACKAGE=kokoro-onnx
ARG KOKORO_MODEL_URL=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
ARG KOKORO_VOICES_URL=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PIP_NO_CACHE_DIR=1 \
	KOKORO_MODEL_PATH=/models/kokoro-v1.0.int8.onnx \
	KOKORO_VOICES_PATH=/models/voices-v1.0.bin

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends ca-certificates curl libsndfile1 \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --gid 10001 kokoro \
	&& useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin kokoro

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
	&& pip install --no-cache-dir "${KOKORO_ONNX_PACKAGE}==${KOKORO_ONNX_VERSION}"

RUN mkdir --parents /models \
	&& curl --silent --show-error --fail --location --retry 3 --retry-delay 2 "${KOKORO_MODEL_URL}" --output /models/kokoro-v1.0.int8.onnx \
	&& curl --silent --show-error --fail --location --retry 3 --retry-delay 2 "${KOKORO_VOICES_URL}" --output /models/voices-v1.0.bin \
	&& chown --recursive kokoro:kokoro /app /models

COPY server.py ./
RUN chown kokoro:kokoro /app/server.py

USER 10001:10001
EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
