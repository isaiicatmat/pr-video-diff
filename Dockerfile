# Imagen con navegadores Playwright preinstalados
FROM mcr.microsoft.com/playwright:v1.46.1-jammy

WORKDIR /app

# --- Dependencias ---
COPY package.json ./
# Si no usas package-lock.json, usa npm install
RUN npm install --no-audit --no-fund

# Código
COPY tsconfig.json ./
COPY src ./src

# FFmpeg (por si la imagen base no lo trae)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Instalación de navegadores Playwright
RUN npx playwright install --with-deps chromium

# 🔑 CLAVE: forzamos ejecutar dentro de /app para que encuentre /app/node_modules
ENTRYPOINT ["bash","-lc","cd /app && npx --no-install tsx src/index.ts"]
