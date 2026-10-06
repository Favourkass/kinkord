# Build stage runs on the TARGET platform: sharp (used to rebuild a photo's
# smaller sizes) ships a native binary per platform, so dependencies must be
# installed for the arch the image runs on. CI builds linux/amd64 natively;
# a cross-build on an ARM Mac runs under emulation, slower but correct.
FROM node:22-alpine AS build
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
