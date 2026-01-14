# Frontend Dockerfile - Production Build
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build argument for API URL (allows bypassing Cloudflare proxy for AI endpoints)
ARG VITE_API_URL=http://localhost:3001/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build for production (VITE_API_URL will be baked into the bundle)
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
