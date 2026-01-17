# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Generate Prisma client for production
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Sync schema and start the app
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
