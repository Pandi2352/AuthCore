# syntax=docker/dockerfile:1
#
# AuthCore backend: production image.
#
#   docker build -t authcore-backend .
#   docker run --rm -p 3000:3000 --env-file .env.production authcore-backend
#
# Configuration comes only from runtime environment variables. No .env file
# is copied into the image (see .dockerignore).

ARG NODE_IMAGE=node:20.19.4-alpine3.22

# -----------------------------------------------------------------------------
# 1. build: install all dependencies and compile TypeScript to dist/
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# -----------------------------------------------------------------------------
# 2. prod-deps: production dependencies only (no TypeScript, ESLint, CLI, ...)
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && npm cache clean --force

# -----------------------------------------------------------------------------
# 3. runtime: minimal image that runs as a non-root user
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# tini runs as PID 1: forwards SIGTERM/SIGINT to Node (graceful shutdown)
# and reaps zombie processes. npm/yarn aren't needed at runtime, so remove them.
RUN apk add --no-cache tini \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
     /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# App files stay owned by root (read-only for the app user). Only the
# optional log directory (LOG_FILE_ENABLED=true) is writable.
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/logs && chown node:node /app/logs

# Built-in non-root user from the official Node image (uid 1000).
USER node

EXPOSE 3000

# Liveness: the process answers. (Readiness, including the database, is
# /api/v1/health/ready; use it for load balancer / orchestrator checks.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/' + (process.env.API_PREFIX || 'api') + '/v1/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

STOPSIGNAL SIGTERM
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
