FROM node:20-alpine AS node

FROM node AS node-with-gyp
RUN apk add g++ make python3

FROM node-with-gyp AS builder
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY apps/hydration-data-lake-aggregator/package.json ./apps/hydration-data-lake-aggregator/

# Install all dependencies (including workspace)
RUN npm ci

# Copy source code
COPY apps/hydration-data-lake-aggregator/ ./apps/hydration-data-lake-aggregator/

# Build the specific app
WORKDIR /app/apps/hydration-data-lake-aggregator
RUN npm run build

FROM node-with-gyp AS deps
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY apps/hydration-data-lake-aggregator/package.json ./apps/hydration-data-lake-aggregator/

# Install production dependencies
RUN npm ci --omit=dev --workspace=hydration-data-lake-aggregator

FROM node AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/hydration-data-lake-aggregator/node_modules ./apps/hydration-data-lake-aggregator/node_modules
COPY --from=builder /app/apps/hydration-data-lake-aggregator/dist ./apps/hydration-data-lake-aggregator/dist
COPY --from=builder /app/apps/hydration-data-lake-aggregator/package.json ./apps/hydration-data-lake-aggregator/

WORKDIR /app/apps/hydration-data-lake-aggregator

