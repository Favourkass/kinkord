# Build stage runs on the BUILDER's native arch (fast on ARM Macs). The
# standalone output is pure JS (images unoptimized, no sharp), so the final
# stage can be stamped for any target platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .prettierrc.json ./
# All workspace manifests must exist for lockfile resolution, even when only
# web's dependencies get installed.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY infra/package.json infra/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter web
COPY apps/web apps/web
# Inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# next build's TS phase OOMs on node's default heap (same fix as ci.yml).
ARG NODE_HEAP=4096
ENV NODE_OPTIONS=--max-old-space-size=${NODE_HEAP}
RUN pnpm --filter web build \
  && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
  && cp -r apps/web/public apps/web/.next/standalone/apps/web/public

# Runtime stage
FROM node:22-alpine
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone /app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
