FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY server/prisma server/prisma
RUN npm ci
COPY . .
RUN npm run build

FROM build AS migrate
CMD ["npx","prisma","migrate","deploy","--schema","server/prisma/schema.prisma"]

FROM build AS api
RUN npm prune --omit=dev --ignore-scripts
ENV NODE_ENV=production
USER node
EXPOSE 5000
CMD ["node","server/dist/index.js"]

FROM nginx:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
