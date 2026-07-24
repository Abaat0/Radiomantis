FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY chat.js ./

# Inside the container we must bind all interfaces so other containers on the
# Docker network (e.g. Nginx Proxy Manager) can reach it. The container is only
# attached to the internal proxy_network and publishes no host port, so this is
# not exposed to the public internet.
ENV CHAT_HOST=0.0.0.0
ENV CHAT_PORT=8081
EXPOSE 8081

CMD ["node", "chat.js"]
