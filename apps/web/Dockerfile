# Build from repository root: docker build -f apps/web/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@portal/web --include-workspace-root
COPY apps/web apps/web
RUN npm run build --workspace=@portal/web

FROM nginx:1.27-alpine AS runner
COPY docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
