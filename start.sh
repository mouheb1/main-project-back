#!/bin/sh

echo "[Startup] Running database migrations..."
npx prisma db push --skip-generate

echo "[Startup] Starting application..."
node dist/server.js
