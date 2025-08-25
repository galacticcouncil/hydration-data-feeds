FROM node:20-alpine AS node

FROM node AS node-with-gyp
RUN apk add g++ make python3

FROM node-with-gyp AS builder
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY apps/hydration-data-lake-adapter/package.json ./apps/hydration-data-lake-adapter/

# Install all dependencies (including workspace)
RUN npm ci

# Copy source code
COPY apps/hydration-data-lake-adapter/ ./apps/hydration-data-lake-adapter/

# Build the specific app
WORKDIR /app/apps/hydration-data-lake-adapter
RUN npm run build

FROM node-with-gyp AS deps
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY apps/hydration-data-lake-adapter/package.json ./apps/hydration-data-lake-adapter/

# Install production dependencies
RUN npm ci --production --workspace=hydration-data-lake-adapter

FROM node AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/hydration-data-lake-adapter/node_modules ./apps/hydration-data-lake-adapter/node_modules
COPY --from=builder /app/apps/hydration-data-lake-adapter/dist ./apps/hydration-data-lake-adapter/dist
COPY --from=builder /app/apps/hydration-data-lake-adapter/package.json ./apps/hydration-data-lake-adapter/

WORKDIR /app/apps/hydration-data-lake-adapter

