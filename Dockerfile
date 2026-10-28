FROM node:22-alpine AS ui
WORKDIR /ui
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=ui /ui/dist ./static
RUN useradd -m app && mkdir -p /tmp/wind_cache && chown -R app /app /tmp/wind_cache
USER app
ENV PORT=8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import os,urllib.request as u;u.urlopen(f'http://localhost:{os.environ[\"PORT\"]}/api/health')"
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
