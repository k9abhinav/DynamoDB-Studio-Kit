FROM node:22-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY tsconfig.base.json ./
RUN pnpm --filter @dynamo-studio/shared build \
  && pnpm --filter @dynamo-studio/server build \
  && pnpm --filter @dynamo-studio/web build \
  && pnpm --filter @dynamo-studio/server deploy --prod /deploy/apps/server \
  && cp -a apps/server/dist /deploy/apps/server/dist \
  && cp -a packages/shared/dist /deploy/apps/server/node_modules/@dynamo-studio/shared/dist \
  && mkdir -p /deploy/apps/web \
  && cp -a apps/web/dist /deploy/apps/web/dist

FROM node:22-bookworm-slim

RUN groupadd --gid 1001 studio \
  && useradd --uid 1001 --gid studio --create-home --shell /usr/sbin/nologin studio

WORKDIR /opt/dynamo-studio
COPY --from=build --chown=studio:studio /deploy /opt/dynamo-studio

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
USER studio

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/v1/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--max-old-space-size=128", "apps/server/dist/index.js"]
