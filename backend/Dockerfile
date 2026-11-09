FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Only production packages go into the final image
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY migrations ./migrations

# Run as a normal user, not root
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/live || exit 1

CMD ["node", "src/server.js"]