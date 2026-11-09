# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# The official image renders /etc/nginx/templates/*.template with envsubst at
# startup, so API_UPSTREAM is configured per deployment without rebuilding.
ENV API_UPSTREAM=http://host.docker.internal:8001
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
