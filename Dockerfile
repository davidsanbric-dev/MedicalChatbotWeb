# ---- build ----
FROM oven/bun:1.2.12-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---- serve ----
FROM nginx:1.27-alpine
# The official image renders /etc/nginx/templates/*.template with envsubst at
# startup, so API_UPSTREAM is configured per deployment without rebuilding.
# Defaults to the public API so the container always starts; nginx refuses to
# boot if this host can't be resolved. Override it per deployment.
ENV API_UPSTREAM=https://medicalchatbot4p1r3m073api.demos.davieldev.com
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
