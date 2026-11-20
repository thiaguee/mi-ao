#!/bin/bash
# =====================================================================
#  Instalador del SERVIDOR de Fénix AO para Ubuntu (22.04 o 24.04)
#  Uso (como root, dentro de la carpeta del proyecto):
#      sudo bash instalar-servidor.sh
#  Deja el servidor andando las 24 hs (se reinicia solo si se cae
#  o si se reinicia la máquina) y crea el instalador de Windows
#  con la dirección de este servidor adentro.
# =====================================================================
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PUERTO="${PUERTO:-7666}"

if [ "$(id -u)" != "0" ]; then echo "Ejecutalo con sudo: sudo bash instalar-servidor.sh"; exit 1; fi

echo "=== 1/5 Instalando programas necesarios ==="
apt-get update -y
apt-get install -y curl ca-certificates git nsis python3-pil
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "=== 2/5 Instalando el servidor ==="
cd "$DIR/server"
npm install --omit=dev

echo "=== 3/5 Detectando la IP pública ==="
IP="${IP:-$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')}"
echo "IP del servidor: $IP"

echo "=== 4/5 Creando el instalador de Windows (tarda unos minutos) ==="
cd "$DIR/launcher"
npm install
bash crear-instalador.sh "ws://$IP:$PUERTO"

echo "=== 5/5 Dejando el servidor encendido siempre ==="
cat > /etc/systemd/system/fenixao.service <<EOF
[Unit]
Description=Servidor Fenix AO
After=network.target

[Service]
WorkingDirectory=$DIR/server
ExecStart=$(command -v node) src/main.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable fenixao
systemctl restart fenixao
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow "$PUERTO/tcp"; fi

sleep 2
systemctl --no-pager status fenixao | head -5 || true
echo
echo "=================================================================="
echo " ¡LISTO! Tu servidor de Fénix AO está funcionando."
echo
echo "  Descarga del juego (pasale este link a los jugadores):"
echo "      http://$IP:$PUERTO/descargar"
echo "  Jugar desde el navegador:"
echo "      http://$IP:$PUERTO"
echo
echo "  IMPORTANTE: el PRIMER personaje que se cree será el ADMINISTRADOR."
echo "  Crealo vos antes de pasarle el link a nadie."
echo
echo "  Comandos útiles en esta máquina:"
echo "    systemctl restart fenixao    (reiniciar el servidor)"
echo "    systemctl stop fenixao       (apagarlo)"
echo "    journalctl -u fenixao -f     (ver lo que pasa en vivo)"
echo "=================================================================="
