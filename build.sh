#!/bin/bash
set -e

echo "🔧 Configurando entorno para Node.js 18..."

# Forzar Node.js 18
export NODE_VERSION=18.18.0
export PATH="/opt/render/project/.render/node/18.18.0/bin:$PATH"

# Navegar al directorio backend
cd backend

echo "🧹 Limpiando dependencias..."
rm -rf node_modules package-lock.json

echo "📦 Instalando dependencias con Node.js 18..."
npm install --legacy-peer-deps --no-audit --no-fund

echo "✅ Build completado exitosamente"
