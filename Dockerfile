# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Install system dependencies for C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt \
    && pip install --no-cache-dir --prefix=/install gunicorn redis psycopg2-binary

# Runtime stage (Minimal, hardened image)
FROM python:3.11-slim-bookworm

WORKDIR /app

# Install runtime libpq for PostgreSQL support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed wheels from builder
COPY --from=builder /install /usr/local

# Copy application source code and models
COPY backend/ ./backend/
COPY ml/ ./ml/

# Create unprivileged non-root user (appuser:1000) for security isolation
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/backend/data && \
    chown -R appuser:appuser /app

USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WEB_CONCURRENCY=4

EXPOSE 8000

# Healthcheck targeting the liveness endpoint with dynamic PORT support
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD sh -c "curl -f http://127.0.0.1:${PORT:-8000}/healthz || exit 1"

# Launch with Gunicorn process manager running Uvicorn workers on dynamic Railway PORT
CMD ["sh", "-c", "exec gunicorn -w ${WEB_CONCURRENCY:-4} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 30 --graceful-timeout 10 --access-logfile - backend.main:app"]
