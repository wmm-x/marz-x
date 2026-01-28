
FROM node:20-alpine AS backend

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

FROM nginx:alpine

RUN apk add --no-cache nodejs npm openssl libc6-compat zip unzip docker-cli

WORKDIR /app


COPY --from=backend /app /app


COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf


COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh


RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 80

CMD ["sh", "/app/entrypoint.sh"]
