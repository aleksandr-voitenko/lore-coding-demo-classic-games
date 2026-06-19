# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.22.2

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
ENV LORE_CODING_INSTALL_HOOKS=0
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY .githooks/install-lore-coding-hooks.mjs ./.githooks/install-lore-coding-hooks.mjs
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0 \
  GAME_LEADERBOARD_SQLITE_PATH=/data/snake-leaderboard.sqlite

RUN mkdir -p /data \
  && chown node:node /data

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "server.js"]
