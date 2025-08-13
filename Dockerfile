# Imagen con navegadores Playwright preinstalados
FROM mcr.microsoft.com/playwright:v1.46.1-jammy

WORKDIR /app

# --- Dependencias ---
# Solo copiamos package.json para aprovechar la cache de Docker
COPY package.json ./
# Usamos npm install (no requiere package-lock)
RUN npm install --no-audit --no-fund

# Copiamos el resto del código
COPY tsconfig.json ./
COPY src ./src

# FFmpeg (por si la imagen base no lo trae)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Asegura navegadores Playwright
RUN npx playwright install --with-deps chromium

# Entrypoint (TypeScript con tsx)
ENTRYPOINT ["npx", "tsx", "src/index.ts"]
