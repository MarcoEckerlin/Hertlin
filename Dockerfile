# Produktions-Image für Website, Kundenportal und Verwaltung
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/hertlin.db \
    UPLOAD_DIR=/data/uploads
COPY --from=build /app /app
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
