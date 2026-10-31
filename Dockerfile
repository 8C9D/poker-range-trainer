# syntax=docker/dockerfile:1

# The production image: one Node process serving the API and the built web app.
# Build it from the repo root: docker build -t poker-range-trainer .

FROM node:24.15.0-bookworm-slim AS build
WORKDIR /app
# Manifests first, so a source change does not reinstall every dependency.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/e2e/package.json apps/e2e/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
RUN npm ci
COPY apps ./apps
COPY packages ./packages
RUN npm run build:packages \
  && npm run build:web \
  && npm --workspace @poker-range-trainer/api run build

# Only what the API needs at run time: no compilers, no test tools, no web sources.
FROM build AS production-dependencies
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
  && npm ci --omit=dev --workspace @poker-range-trainer/api

FROM node:24.15.0-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV WEB_DIST_DIR=/app/apps/web/dist
WORKDIR /app
COPY --from=production-dependencies /app/package.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/api/package.json ./apps/api/
COPY --from=production-dependencies /app/apps/api/dist ./apps/api/dist
COPY --from=production-dependencies /app/apps/web/dist ./apps/web/dist
COPY --from=production-dependencies /app/packages/contracts/package.json ./packages/contracts/
COPY --from=production-dependencies /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=production-dependencies /app/packages/database/package.json ./packages/database/
COPY --from=production-dependencies /app/packages/database/dist ./packages/database/dist
COPY --from=production-dependencies /app/packages/domain/package.json ./packages/domain/
COPY --from=production-dependencies /app/packages/domain/dist ./packages/domain/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/v1/health/ready`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node directly, not npm: npm does not forward SIGTERM, and shutdown drains on it.
CMD ["node", "apps/api/dist/server.js"]
