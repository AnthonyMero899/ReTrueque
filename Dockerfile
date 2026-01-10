# --- Stage 1: Build Frontend ---
FROM node:20-alpine as frontend_build

WORKDIR /app/frontend

# Copiar dependencias frontend
COPY frontend/package*.json ./
RUN npm install

# Copiar código fuente frontend
COPY frontend/ .

# Configurar URL de API relativa para que funcione en el mismo dominio
ENV VITE_API_URL=/api

# Construir (genera carpeta dist)
RUN npm run build

# --- Stage 2: Setup Backend & Serve ---
FROM node:20-alpine

WORKDIR /app

# Copiar dependencias backend
COPY backend/package*.json ./
RUN npm install

# Copiar esquema Prisma y generar cliente
COPY backend/prisma ./prisma/
RUN npx prisma generate

# Copiar código fuente backend
COPY backend/ .

# Copiar el build del frontend al directorio 'public' del backend
COPY --from=frontend_build /app/frontend/dist ./public

# Exponer puerto
EXPOSE 3000

# Iniciar servidor
CMD ["npm", "start"]
