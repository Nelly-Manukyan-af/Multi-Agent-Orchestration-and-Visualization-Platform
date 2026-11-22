# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

FROM manifests AS frontend
RUN npm ci --workspace=apps/web --workspace=packages/shared --include-workspace-root
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM manifests AS production-dependencies
RUN npm ci --omit=dev --workspace=apps/server --workspace=packages/shared --include-workspace-root \
    && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/apps/web/dist \
    SHUTDOWN_TIMEOUT_MS=10000
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/ ./
COPY --chown=node:node apps/server ./apps/server
COPY --chown=node:node packages/shared ./packages/shared
COPY --from=frontend --chown=node:node /app/apps/web/dist ./apps/web/dist
USER node
WORKDIR /app/apps/server
EXPOSE 3000
CMD ["node", "src/index.ts"]
