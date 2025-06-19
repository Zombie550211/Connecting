#!/bin/bash
# Script de despliegue para sitio estático en Render, VPS o cualquier servidor Linux

# CONFIGURACIÓN
LOCAL_DIR="./"                     # Carpeta local de tu proyecto (ajusta si es necesario)
REMOTE_USER="usuario"              # Cambia por tu usuario SSH en el servidor
REMOTE_HOST="mi-servidor.com"      # Cambia por tu dominio/IP de Render/VPS
REMOTE_DIR="/var/www/html"         # Carpeta destino en el servidor (ajusta según tu server/Render)
EXCLUDE="--exclude=.git --exclude=node_modules --exclude=deploy.sh"

# 1. Construir proyecto si es necesario (descomenta si usas build tools)
# npm run build

# 2. Sincronizar archivos al servidor (usa rsync para eficiencia y seguridad)
rsync -avz --delete $EXCLUDE $LOCAL_DIR $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR

# 3. (Opcional) Limpiar cache del servidor si usas NGINX o un CDN
# ssh $REMOTE_USER@$REMOTE_HOST 'sudo systemctl reload nginx'
# o para limpiar cache específica:
# ssh $REMOTE_USER@$REMOTE_HOST 'rm -rf /ruta/cache/*'

echo "✅ Despliegue completado. Revisa $REMOTE_HOST"
