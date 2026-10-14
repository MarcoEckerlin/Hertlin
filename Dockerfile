# Produktions-Image: Website, Kundenportale, Verwaltung und WebSocket-Server in einem Container.
# Bauen:   docker compose build      ·   Anleitung: DOCKER.md

# Vollständiges Debian-Image: bringt OpenSSL (für die Datenbank-Engine) und Zertifikate mit,
# funktioniert auf amd64 und arm64 ohne zusätzliche Paketinstallation.
FROM node:22-bookworm AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Abhängigkeiten (eigene Schicht, damit Code-Änderungen sie nicht neu auslösen)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Build: Prisma-Client für Linux erzeugen, Next.js bauen, Entwicklungs-Pakete entfernen
FROM deps AS build
COPY . .
# Leere Datenbank nur für den Build (Next.js ruft beim Vorab-Rendern Firmendaten ab); sie landet nicht im Image
ENV DATABASE_URL=file:/tmp/build.db
RUN npx prisma generate \
 && npx prisma migrate deploy \
 && npm run build \
 && npm prune --omit=dev \
 && rm -rf .next/cache

FROM base AS run
ENV NODE_ENV=production \
    PORT=3000 \
    LISTEN_HOST=0.0.0.0 \
    DATABASE_URL=file:/data/hertlin.db \
    UPLOAD_DIR=/data/uploads \
    MAIL_LOG_FILE=/data/mails.log
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data && chmod +x /app/docker/entrypoint.sh
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Signale sauber weiterreichen: in docker-compose.yml ist "init: true" gesetzt (bzw. docker run --init)
ENTRYPOINT ["/app/docker/entrypoint.sh"]
