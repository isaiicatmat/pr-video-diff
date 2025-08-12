# Imagen con navegadores Playwright preinstalados
FROM mcr.microsoft.com/playwright:v1.46.1-jammy

WORKDIR /app

# Dependencias
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# Asegurar ffmpeg y navegadores (ffmpeg suele venir, pero instalamos por si acaso)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Garantiza navegadores
RUN npx playwright install --with-deps chromium

# Entrypoint (TypeScript con tsx)
ENTRYPOINT ["npx", "tsx", "src/index.ts"]
