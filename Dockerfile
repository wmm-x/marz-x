# ---------- Backend build ----------
FROM node:20-alpine AS backend

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

# ---------- Final image ----------
FROM nginx:alpine

RUN apk add --no-cache nodejs npm openssl libc6-compat

WORKDIR /app

# Backend: Copy the prepared node_modules and source from the builder
COPY --from=backend /app /app

# Frontend: Copy your local 'dist' folder to where Nginx expects it
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint: Copy and make executable
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# SQLite directory setup
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 80

CMD ["sh", "/app/entrypoint.sh"]