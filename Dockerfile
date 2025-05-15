FROM oven/bun:1 AS base
WORKDIR /app

# Development dependencies installation stage
FROM base AS install
RUN mkdir -p /dev
COPY package.json bun.lock /dev/
RUN cd /dev && bun install --frozen-lockfile

# Production dependencies installation stage
RUN mkdir -p /prod
COPY package.json bun.lock /prod/
RUN cd /prod && bun install --frozen-lockfile --production

# Build stage
FROM base AS prerelease
COPY --from=install /dev/node_modules node_modules
COPY . .

# Release stage
FROM base AS release
COPY --from=install /prod/node_modules node_modules
COPY --from=prerelease /app/index.ts ./
COPY --from=prerelease /app/productConfig.json ./
COPY --from=prerelease /app/package.json ./

RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'mkdir -p /app/database' >> /app/start.sh && \
    echo 'bun run index.ts' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE ${PORT}

ENTRYPOINT ["/app/start.sh"]
