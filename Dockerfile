# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN pnpm install
COPY frontend/ ./
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install backend dependencies (including tsx for TS runtime)
COPY backend/package.json ./
RUN pnpm install

# Copy backend source first (Prisma generates into src/generated/)
COPY backend/src ./src
COPY backend/tsconfig.json ./tsconfig.json

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts
RUN npx prisma generate
# Strip @ts-nocheck from generated Prisma files for proper type inference
RUN find src/generated -name '*.ts' -exec sed -i '/@ts-nocheck/d' {} +

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push && npx tsx src/index.ts"]
