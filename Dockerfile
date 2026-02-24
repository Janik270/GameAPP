# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Install only production dependencies if needed, 
# but we need ts-node and typescript to run the server.ts
# Alternatively, we could compile server.ts, but ts-node is easier for now.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig.server.json ./
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD ["npm", "start"]
