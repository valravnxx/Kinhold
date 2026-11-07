#!/bin/bash
# Vuelve a poner el servidor de Kinhold como estaba en una copia de seguridad (las hace copia.sh).
# Uso (en la máquina, como root):
#   bash /opt/kinhold/servidor/nube/restaurar.sh /var/backups/kinhold/kinhold-20261107-034100.tar.gz
#   bash /opt/kinhold/servidor/nube/restaurar.sh --ultima        (la más nueva de /var/backups/kinhold)
# Si la máquina se ha perdido, en una nueva (cloud-config.yaml) se trae primero la copia de fuera, por ejemplo:
#   rsync -e "ssh -p 23 -i /etc/kinhold/copia_clave" u123456@u123456.your-storagebox.de:kinhold/ /var/backups/kinhold/
# Para el servidor, deja lo que había al lado (/var/lib/kinhold.antes-<fecha>, no se borra nada), saca la copia en su
# sitio con el dueño del servicio y lo vuelve a arrancar.
# Para las pruebas: KINHOLD_DATOS, KINHOLD_COPIAS_DIR y KINHOLD_SIN_SERVICIO=1 (no para ni arranca nada).
set -euo pipefail
DATOS="${KINHOLD_DATOS:-/var/lib/kinhold}"
COPIAS_DIR="${KINHOLD_COPIAS_DIR:-/var/backups/kinhold}"
SIN_SERVICIO="${KINHOLD_SIN_SERVICIO:-}"
COPIA="${1:-}"
if [ "$COPIA" = "--ultima" ]; then
  V=$(ls -1 "$COPIAS_DIR" 2>/dev/null | grep -E '^kinhold-[0-9]{8}-[0-9]{6}\.tar\.gz$' | sort | tail -1 || true)
  [ -n "$V" ] || { echo "No hay copias en $COPIAS_DIR" >&2; exit 1; }
  COPIA="$COPIAS_DIR/$V"
fi
[ -n "$COPIA" ] && [ -r "$COPIA" ] || { echo "Uso: restaurar.sh <copia.tar.gz> | --ultima" >&2; exit 1; }
[ -n "$SIN_SERVICIO" ] || [ "$(id -u)" -eq 0 ] || { echo "Hay que lanzarlo como root (sudo)." >&2; exit 1; }
# antes de tocar nada, que la copia se lea entera y lleve algo
N=$(tar -tzf "$COPIA" 2>/dev/null | grep -cv '^\./$' || true)
[ "${N:-0}" -gt 0 ] || { echo "La copia no se lee bien o está vacía: no se toca nada" >&2; exit 1; }
[ -n "$SIN_SERVICIO" ] || systemctl stop kinhold
ANTES=""
if [ -d "$DATOS" ]; then ANTES="$DATOS.antes-$(date -u +%Y%m%d-%H%M%S)"; mv "$DATOS" "$ANTES"; fi
mkdir -p "$DATOS"
tar -xzf "$COPIA" -C "$DATOS"
if [ -z "$SIN_SERVICIO" ]; then
  id kinhold >/dev/null 2>&1 && chown -R kinhold:kinhold "$DATOS"
  systemctl start kinhold
fi
echo "Restaurado desde $COPIA${ANTES:+ (lo de antes, en $ANTES)}"
