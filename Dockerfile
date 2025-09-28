# Multi-stage build for Conn-PTY (API + Console)
# - builder: installs deps and builds both packages
# - api: Bun runtime serving API on :3000
# - web: Nginx serving console build on :80, proxying /api and /socket.io to api:3000

# 1) Builder
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy manifests for better cache (workspaces)
COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/console/package.json ./packages/console/package.json
COPY packages/ssh-client-wasm/package.json ./packages/ssh-client-wasm/package.json

# Install deps for all workspaces
RUN bun install

# Install Rust toolchain for building WASM
RUN apt-get update && apt-get install -y curl build-essential pkg-config libssl-dev \
 && curl -fsSL https://sh.rustup.rs -o rustup-init.sh && sh rustup-init.sh -y \
 && rm -f rustup-init.sh
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown

# Copy sources
COPY packages/api ./packages/api
COPY packages/console ./packages/console
COPY packages/ssh-client-wasm ./packages/ssh-client-wasm

# Build (API, WASM client, Console)
RUN cd packages/api && bun run build \
 && cd /app/packages/ssh-client-wasm && bun run build \
 && cd /app/packages/console && bun run build


# 2) API runtime
FROM oven/bun:1 AS api
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json

EXPOSE 3000
CMD ["bun", "run", "packages/api/dist/index.js"]


# 3) Web runtime
FROM nginx:1.27-alpine AS web
ENV NODE_ENV=production

# Static assets
COPY --from=builder /app/packages/console/dist /usr/share/nginx/html

# Configure nginx to proxy API and Socket.IO to api:3000
RUN rm -f /etc/nginx/conf.d/default.conf \
 && printf '%s\n' \
 'server {' \
 '  listen 80;' \
 '  server_name _;' \
 '  root /usr/share/nginx/html;' \
 '  index index.html;' \
 '  # Single Page App routing' \
 '  location / {' \
 '    try_files $uri /index.html;' \
 '  }' \
 '  # REST API' \
 '  location /api/ {' \
 '    proxy_pass http://api:3000/api/;' \
 '    proxy_set_header Host $host;' \
 '    proxy_set_header X-Real-IP $remote_addr;' \
 '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
 '    proxy_set_header X-Forwarded-Proto $scheme;' \
 '  }' \
 '  # WebSocket SSH' \
 '  location /ws/ssh {' \
 '    proxy_http_version 1.1;' \
 '    proxy_set_header Upgrade $http_upgrade;' \
 '    proxy_set_header Connection "Upgrade";' \
 '    proxy_set_header Host $host;' \
 '    proxy_pass http://api:3000/ws/ssh;' \
 '  }' \
 '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
# default CMD of nginx is used