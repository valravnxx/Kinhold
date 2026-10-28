#!/bin/bash
# Instala el servidor de prueba de Kinhold en una máquina Ubuntu 24.04 recién creada (hito 1f).
# Lo llama cloud-config.yaml al crear la máquina; también se puede lanzar a mano como root:
#   bash /opt/kinhold/servidor/nube/instalar.sh
# Deja: Node.js 22, el juego en /opt/kinhold, el servicio «kinhold» (el mundo en /var/lib/kinhold), Caddy con
# HTTPS delante y el cortafuegos con solo SSH, HTTP y HTTPS abiertos. Repetirlo no hace daño.
#
# Variables (todas opcionales):
#   KINHOLD_DOMINIO  dirección propia (si no, <ip-con-guiones>.sslip.io, que apunta sola a la IP)
#   KINHOLD_IP       la IP pública (si no, la de la máquina)
#   KINHOLD_PUERTO   puerto interno del servidor del juego (8080)
#
# Para las pruebas: «instalar.sh --solo-archivos <carpeta>» escribe ahí el Caddyfile y el servicio ya
# rellenos, sin instalar nada.
set -euo pipefail

REPO=https://github.com/valravnxx/Kinhold.git
DIR=/opt/kinhold
JUEGO=https://valravnxx.github.io/Kinhold/jugar/demo/index.html
NUBE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUERTO="${KINHOLD_PUERTO:-8080}"

ip_publica() {
  [ -n "${KINHOLD_IP:-}" ] && { echo "$KINHOLD_IP"; return; }
  local ip
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -1)"
  # si la máquina solo tiene una IP privada (detrás de un router), se pregunta fuera
  if [ -z "$ip" ] || [[ "$ip" =~ ^(10\.|127\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]]; then
    ip="$(curl -4fsS --max-time 10 https://api.ipify.org || true)"
  fi
  echo "$ip"
}

dominio() {
  if [ -n "${KINHOLD_DOMINIO:-}" ]; then echo "$KINHOLD_DOMINIO"; return; fi
  local ip; ip="$(ip_publica)"
  [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "No se sabe la IP pública (sale «$ip»). Pon KINHOLD_IP o KINHOLD_DOMINIO." >&2; exit 1; }
  echo "${ip//./-}.sslip.io"
}

# rellena una plantilla: @@DOMINIO@@, @@PUERTO@@, @@JUEGO@@, @@DIR@@, @@NODE@@
rellenar() {
  sed -e "s|@@DOMINIO@@|$DOMINIO|g" -e "s|@@PUERTO@@|$PUERTO|g" -e "s|@@JUEGO@@|$JUEGO|g" \
      -e "s|@@DIR@@|$DIR|g" -e "s|@@NODE@@|$NODE|g" "$1"
}

if [ "${1:-}" = "--solo-archivos" ]; then
  [ -n "${2:-}" ] || { echo "Uso: instalar.sh --solo-archivos <carpeta>" >&2; exit 1; }
  DOMINIO="$(dominio)"; NODE="${KINHOLD_NODE:-/usr/bin/node}"
  mkdir -p "$2"
  rellenar "$NUBE/Caddyfile.plantilla" > "$2/Caddyfile"
  rellenar "$NUBE/kinhold.service.plantilla" > "$2/kinhold.service"
  echo "$DOMINIO"
  exit 0
fi

[ "$(id -u)" -eq 0 ] || { echo "Hay que lanzarlo como root (sudo)." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
echo "== $(date -Iseconds) Instalando el servidor de Kinhold"

apt-get update -q
apt-get install -y -q git curl ca-certificates gnupg ufw debian-keyring debian-archive-keyring apt-transport-https

# Node.js 22 (el de Ubuntu es más viejo)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
NODE="$(command -v node)"
echo "Node $("$NODE" -v) en $NODE"

# Caddy: el paquete oficial (el más nuevo); si su repositorio falla, el de Ubuntu
if ! command -v caddy >/dev/null; then
  if curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
     && curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list \
     && apt-get update -q; then
    apt-get install -y -q caddy
  else
    rm -f /etc/apt/sources.list.d/caddy-stable.list; apt-get update -q; apt-get install -y -q caddy
  fi
fi

# El juego
id kinhold >/dev/null 2>&1 || useradd --system --home-dir /var/lib/kinhold --shell /usr/sbin/nologin kinhold
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$DIR"; fi
(cd "$DIR" && npm ci --omit=dev --no-audit --no-fund)

DOMINIO="$(dominio)"
rellenar "$DIR/servidor/nube/kinhold.service.plantilla" > /etc/systemd/system/kinhold.service
rellenar "$DIR/servidor/nube/Caddyfile.plantilla" > /etc/caddy/Caddyfile
caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile

# Cortafuegos: SSH, HTTP (para el certificado) y HTTPS. El puerto del juego queda cerrado por fuera.
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable

systemctl daemon-reload
systemctl enable --now kinhold
systemctl restart kinhold
systemctl enable caddy
systemctl restart caddy
echo "$DOMINIO" > /etc/kinhold-dominio

echo
echo "== LISTO. El servidor de Kinhold está en marcha."
echo "   Abre en los dos aparatos:  https://$DOMINIO"
echo "   (lleva a la demo con el servidor ya puesto: wss://$DOMINIO)"
