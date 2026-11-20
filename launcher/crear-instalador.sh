#!/bin/bash
# Crea el instalador de Windows con la dirección de TU servidor adentro.
# Uso:  ./crear-instalador.sh ws://IP_DE_TU_SERVIDOR:7666
# El instalador queda en launcher/dist/FenixAO-Instalador.exe
set -e
cd "$(dirname "$0")"
SERVIDOR="$1"
if [ -z "$SERVIDOR" ]; then
  echo "Uso: ./crear-instalador.sh ws://IP_DE_TU_SERVIDOR:7666"
  exit 1
fi
command -v makensis >/dev/null || { echo "Falta NSIS: instalalo con 'sudo apt-get install -y nsis'"; exit 1; }
[ -d node_modules ] || npm install

echo ">> Armando la aplicación..."
rm -rf dist/win-unpacked
npx electron-builder --win dir --x64 >/dev/null

echo ">> Configurando el servidor: $SERVIDOR"
CFG="dist/win-unpacked/resources/client/config.js"
cat > "$CFG" <<EOF
// Configuración del cliente (generada por crear-instalador.sh)
window.AO_CONFIG = {
  servidor: '$SERVIDOR',
};
EOF

echo ">> Creando el instalador..."
[ -f icono.ico ] || python3 -c "from PIL import Image; Image.open('icono.png').save('icono.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])"
makensis -V2 instalador.nsi
ls -lh dist/FenixAO-Instalador.exe
echo ">> Listo: dist/FenixAO-Instalador.exe"
