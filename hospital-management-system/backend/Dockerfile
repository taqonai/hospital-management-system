# Backend Dockerfile
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client with correct binary targets
ENV PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl.so.node
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Development command
CMD ["npm", "run", "dev"]
