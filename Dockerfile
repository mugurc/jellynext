# syntax=docker/dockerfile:1

# JellyNext ships as one generic image: no server address is baked in, because
# JELLYFIN_SERVER_URL is read at request time rather than at build time. The same
# tag therefore works against any Jellyfin server.

# ---- dependencies -----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# sharp, which Next pulls in for image optimization, needs the glibc shim on musl
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# The `prepare` script installs Husky hooks; there is no .git here, so skip it
ENV HUSKY=0
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 HUSKY=0
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# `output: standalone` deliberately omits these two: upstream assumes a CDN
# serves them, so a self-hosted image has to bring them along itself.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Hits a route Next generates itself, so the check stays up even when no
# Jellyfin server is configured yet.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD \
  node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/manifest.webmanifest').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
