#!/bin/sh
set -e

# 1. Database Setup
mkdir -p /app/data
npx prisma migrate deploy

# 2. Start Backend (Node)
echo "Starting Backend..."
node src/index.js &  

# 3. Start Frontend Server (Nginx)
echo "Starting Nginx..."
exec nginx -g 'daemon off;'