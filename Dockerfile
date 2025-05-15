FROM oven/bun:1 AS base
WORKDIR /app

# Development dependencies installation stage
FROM base AS install
RUN mkdir -p /app/dev
COPY package.json /app/dev/
RUN cd /app/dev && bun install

# Production dependencies installation stage
FROM base AS prod-deps
RUN mkdir -p /app/prod
COPY package.json /app/prod/
RUN cd /app/prod && bun install --production

# Build stage
FROM base AS prerelease
COPY --from=install /app/dev/node_modules node_modules
COPY . .

# Release stage
FROM base AS release
COPY --from=prod-deps /app/prod/node_modules node_modules
COPY --from=prerelease /app/index.ts ./
COPY --from=prerelease /app/productConfig.json ./
COPY --from=prerelease /app/package.json ./

# No need to create a separate script
# Just run index.ts directly
EXPOSE 5000

CMD ["bun", "index.ts"]
