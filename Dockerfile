# Docker Hub rate-limits anonymous pulls from CI runners (429), so the base
# image comes from ECR Public's mirror of the official images, and the
# BuildKit built-in Dockerfile frontend is used (no docker/dockerfile pull).
FROM mirror.gcr.io/library/node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install deps in the builder (no COPY of node_modules between stages).
# Layer cache: this RUN is reused whenever package-lock.json is unchanged.
FROM base AS builder
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .

ARG NEXT_PUBLIC_API_URL=/api-backend
ARG NEXT_PUBLIC_HERE_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_APP_NAME=
ARG NEXT_PUBLIC_ENV=production
ARG NEXT_PUBLIC_STOREFRONT_COMPANY_ID=
ARG NEXT_PUBLIC_CONSOLE_HOSTS=
ARG BACKEND_URL=http://host.docker.internal:3000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_HERE_API_KEY=$NEXT_PUBLIC_HERE_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV
ENV NEXT_PUBLIC_STOREFRONT_COMPANY_ID=$NEXT_PUBLIC_STOREFRONT_COMPANY_ID
ENV NEXT_PUBLIC_CONSOLE_HOSTS=$NEXT_PUBLIC_CONSOLE_HOSTS
ENV BACKEND_URL=$BACKEND_URL
ENV NODE_ENV=production
# Backend is not reachable during `next build` in CI/Docker — use placeholders for ISR pages.
ENV STOREFRONT_BUILD_FALLBACK=true

# Reuse Next.js compile cache across builds when only app code changes.
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001

CMD ["node", "server.js"]
