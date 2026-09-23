# syntax=docker/dockerfile:1
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt \
    && pip install --no-cache-dir --prefix=/install gunicorn redis psycopg2-binary

# Runtime stage
FROM python:3.11-slim

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

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WEB_CONCURRENCY=4

EXPOSE 8000

# Healthcheck targeting the liveness endpoint
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/healthz || exit 1

# Launch with Gunicorn process manager running Uvicorn workers
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "30", "--graceful-timeout", "10", "--access-logfile", "-", "backend.main:app"]
