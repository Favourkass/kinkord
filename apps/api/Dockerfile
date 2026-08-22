# Build stage runs on the BUILDER's native arch (fast on ARM Macs) — all
# dependencies are pure JS, so the output is architecture-neutral and the
# final stage can be stamped for any target platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .prettierrc.json ./
# All workspace manifests must exist for lockfile resolution, even when only
# api's dependencies get installed.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY infra/package.json infra/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter api
COPY apps/api apps/api
RUN pnpm --filter api build && pnpm --filter api deploy --prod --legacy /out \
  && cp -r apps/api/dist /out/dist \
  && cp -r apps/api/drizzle /out/drizzle

# Runtime stage
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
EXPOSE 4000
CMD ["node", "dist/main.js"]
