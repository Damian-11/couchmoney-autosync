FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS builder

WORKDIR /build
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Install deps
RUN pnpm install --frozen-lockfile
# Copy files
COPY tsconfig.*json ./
COPY ./src ./src

# Build the project
RUN pnpm run build
RUN rm -rf node_modules
RUN pnpm install --prod --frozen-lockfile

FROM gcr.io/distroless/nodejs24-debian12 AS production
WORKDIR /app

COPY --from=builder /build/package.json ./
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
# Start node
CMD ["."]