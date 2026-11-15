FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY backend/package.json backend/tsconfig.json ./backend/
RUN pnpm install --frozen-lockfile || pnpm install
COPY backend/src ./backend/src
RUN pnpm --filter @smartblood/backend build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
RUN pnpm install --prod
COPY --from=builder /app/backend/dist ./backend/dist
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
