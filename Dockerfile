# Multi-stage Dockerfile for FairShift — Google Cloud Run Deployment
# Prompt Wars 2026 | SRMIST ACM Hackathon

# Stage 1: Build Frontend and Server
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig*.json vite.config.ts index.html ./
RUN npm ci

COPY server ./server
COPY src ./src

RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Non-root user for Cloud Run security best practices
USER node

EXPOSE 8080

CMD ["node", "dist/server/index.js"]
