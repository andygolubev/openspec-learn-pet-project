# Build from repository root: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=@portal/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build --workspace=@portal/api

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace=@portal/api --include-workspace-root
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/src/db/migrations apps/api/dist/db/migrations
COPY docker/entrypoint-api.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
