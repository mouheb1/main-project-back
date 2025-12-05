# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy prisma schema first for client generation
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose port
EXPOSE 3009

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3009

# Start with database migration and seed
CMD ["./start.sh"]
