#!/bin/bash
# Pone la última versión del servidor de Kinhold (lo que hay en main) y lo reinicia. El mundo no se toca.
# Uso (en la máquina, como root): bash /opt/kinhold/servidor/nube/actualizar.sh
set -euo pipefail
DIR=/opt/kinhold
[ "$(id -u)" -eq 0 ] || { echo "Hay que lanzarlo como root (sudo)." >&2; exit 1; }
git -C "$DIR" pull --ff-only
(cd "$DIR" && npm ci --omit=dev --no-audit --no-fund)
# por si han cambiado las plantillas
KINHOLD_DOMINIO="$(cat /etc/kinhold-dominio 2>/dev/null || true)" bash "$DIR/servidor/nube/instalar.sh" --solo-archivos /tmp/kinhold-nube >/dev/null
cp /tmp/kinhold-nube/kinhold.service /etc/systemd/system/kinhold.service
cp /tmp/kinhold-nube/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl restart kinhold
systemctl reload caddy || systemctl restart caddy
echo "Actualizado a $(git -C "$DIR" log -1 --format='%h %s')"
