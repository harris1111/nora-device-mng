# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install build tools for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --production && apk del python3 make g++ && apk add --no-cache libstdc++

# Copy backend source
COPY backend/src ./src

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

# Create data directory for SQLite
RUN mkdir -p data

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
