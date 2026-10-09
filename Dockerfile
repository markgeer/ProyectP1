# ---------- Etapa 1: build (compila módulos nativos como better-sqlite3) ----------
FROM node:22-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# ---------- Etapa 2: runtime (solo lo necesario para ejecutar) ----------
FROM node:22-slim

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY . .

# La base de datos vive en /data para poder guardarla en un volumen
# y no perderla cuando se actualiza el contenedor
RUN mkdir -p /data
ENV DB_PATH=/data/app.db

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000
EXPOSE 6061

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/products/health/check').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]