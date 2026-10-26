# ============================================================
# Tahap 1 - modules: memasang dependensi produksi saja
# ============================================================
FROM node:22-alpine AS modules
WORKDIR /build
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# ============================================================
# Tahap 2 - final: image akhir yang ramping
# ============================================================
FROM node:22-alpine AS final
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /srv/app

# Hanya node_modules hasil tahap 1 yang dibawa ke image akhir
COPY --from=modules --chown=node:node /build/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

# Jalankan sebagai user non-root bawaan image Node
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
