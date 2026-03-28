### Stage 1 — Build React frontend ###
FROM node:20-slim AS frontend-build
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

### Stage 2 — Python runtime ###
FROM python:3.11-slim

WORKDIR /opt/tim

COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code (excluding tests and cache)
COPY app/*.py app/
COPY app/*.yml app/

# Non-root user for security
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

COPY --from=frontend-build /build/dist web/

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
