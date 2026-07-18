# Travel Hub Armenia — apps/api production image.
# Per BACKEND_ARCHITECTURE.md §7/§58: the application runs OUTSIDE Docker
# during local development (nodemon, fast hot-reload against the Docker
# Compose backing services); this Dockerfile is validated in CI
# (.github/workflows/ci.yml) and used for staging/production deploys only.

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies for the whole workspace (npm workspaces need the
# root package.json + lockfile present to resolve @travelhub/* packages).
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci --workspace apps/api --include-workspace-root

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 4000

# Readiness is checked via the real endpoint, not a synthetic Docker-only
# script — BACKEND_ARCHITECTURE.md §50's readiness/liveness distinction
# applies identically here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
