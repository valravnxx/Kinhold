#!/bin/bash
# Pone la última versión del servidor de Kinhold (lo que hay en main) y lo reinicia. El mundo no se toca.
# Desde el 31 oct lo lanza solo auto_actualizar.sh con cada versión nueva de la demo; a mano sigue valiendo.
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
# y el que lo pone al día solo con cada versión nueva de la demo (si aún no estaba, entra con esta actualización)
cp /tmp/kinhold-nube/kinhold-actualizar.service /etc/systemd/system/kinhold-actualizar.service
cp "$DIR/servidor/nube/kinhold-actualizar.timer" /etc/systemd/system/kinhold-actualizar.timer
systemctl daemon-reload
systemctl restart kinhold
systemctl reload caddy || systemctl restart caddy
systemctl enable --now kinhold-actualizar.timer >/dev/null 2>&1 || true
# la versión de la demo que queda puesta (la mira auto_actualizar.sh)
mkdir -p /var/lib/kinhold-actualizar
git -C "$DIR" ls-tree --name-only HEAD docs/jugar/demo/ | sed -n 's|.*/v\([0-9]\{1,\}\)\.html$|\1|p' | sort -n | tail -1 > /var/lib/kinhold-actualizar/version
echo "Actualizado a $(git -C "$DIR" log -1 --format='%h %s') (demo v$(cat /var/lib/kinhold-actualizar/version))"
