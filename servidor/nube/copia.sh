#!/bin/bash
# Copia de seguridad diaria del servidor de Kinhold (auditoría del 4 nov): todo lo que hay junto al mundo
# (/var/lib/kinhold: mundo.jsonl, objetos, posiciones, fichas, cuentas, tierras y los registros) en un .tar.gz con la
# fecha, en /var/backups/kinhold, donde se quedan las últimas 14; y esa carpeta, igual, FUERA de la máquina (en una
# Storage Box de Hetzner, o en cualquier sitio al que se llegue por SSH con rsync), con la clave de /etc/kinhold.
# Lo lanza solo kinhold-copia.timer una vez al día (lo ponen instalar.sh y actualizar.sh); a mano también vale:
#   bash /opt/kinhold/servidor/nube/copia.sh
# El destino de fuera va en /etc/kinhold/copia.env (servidor/nube/LEEME.md, «Copia de seguridad»):
#   KINHOLD_COPIA_DESTINO=u123456@u123456.your-storagebox.de:kinhold   (o una carpeta: /mnt/otro_disco/kinhold)
#   KINHOLD_COPIA_PUERTO=23                                             (el de SSH de la Storage Box; si no, 22)
#   KINHOLD_COPIA_CLAVE=/etc/kinhold/copia_clave                        (la clave privada SSH; es la de por defecto)
# Sin destino de fuera, la copia se hace igual en la máquina, pero sale con error (código 3) para que se vea en
# «systemctl --failed» y en «journalctl -u kinhold-copia»: una copia que solo está en la misma máquina no vale.
# Los .json del servidor se escriben enteros y se cambian de golpe (renombrando) y los .jsonl solo crecen, y el
# servidor descarta una última línea a medias al cargar: por eso se puede copiar con el servidor en marcha.
# Para las pruebas (pruebas/prueba_copia_servidor.mjs) todo se puede cambiar con variables: KINHOLD_DATOS,
# KINHOLD_COPIAS_DIR, KINHOLD_COPIAS, KINHOLD_COPIA_ENV, KINHOLD_COPIA_FECHA y las tres de arriba.
set -euo pipefail
DATOS="${KINHOLD_DATOS:-/var/lib/kinhold}"
COPIAS_DIR="${KINHOLD_COPIAS_DIR:-/var/backups/kinhold}"
QUEDAN="${KINHOLD_COPIAS:-14}"
ENV="${KINHOLD_COPIA_ENV:-/etc/kinhold/copia.env}"
# lo de copia.env manda sobre lo que no venga ya puesto
if [ -r "$ENV" ]; then
  while IFS='=' read -r k v; do
    case "$k" in KINHOLD_COPIA_DESTINO|KINHOLD_COPIA_PUERTO|KINHOLD_COPIA_CLAVE) [ -z "${!k:-}" ] && export "$k=$v";; esac
  done < <(grep -E '^KINHOLD_COPIA_[A-Z]+=' "$ENV" | sed 's/[[:space:]]*$//; s/="\(.*\)"$/=\1/')
fi
DESTINO="${KINHOLD_COPIA_DESTINO:-}"
PUERTO="${KINHOLD_COPIA_PUERTO:-22}"
CLAVE="${KINHOLD_COPIA_CLAVE:-/etc/kinhold/copia_clave}"

[ -d "$DATOS" ] || { echo "No está la carpeta del mundo: $DATOS" >&2; exit 1; }
[ -n "$(ls -A "$DATOS")" ] || { echo "La carpeta del mundo está vacía ($DATOS): no se copia nada" >&2; exit 1; }
mkdir -p "$COPIAS_DIR"; chmod 700 "$COPIAS_DIR"   # dentro van las cuentas (resumidas) y los correos
FECHA="${KINHOLD_COPIA_FECHA:-$(date -u +%Y%m%d-%H%M%S)}"
NOMBRE="kinhold-$FECHA.tar.gz"
TMP="$COPIAS_DIR/.$NOMBRE.tmp"
# con el servidor en marcha, tar avisa (y sale con 1) si un .jsonl crece mientras lo lee: eso vale (lo de arriba)
R=0; tar -czf "$TMP" -C "$DATOS" --exclude='*.tmp' --warning=no-file-changed --warning=no-file-removed . || R=$?
[ "$R" -le 1 ] || { rm -f "$TMP"; echo "tar no pudo hacer la copia (código $R)" >&2; exit 1; }
# que se pueda leer entera y que lleve algo, antes de darla por buena
[ "$(tar -tzf "$TMP" | grep -cv '^\./$')" -gt 0 ] || { rm -f "$TMP"; echo "La copia no se lee bien o está vacía" >&2; exit 1; }
chmod 600 "$TMP"
mv -f "$TMP" "$COPIAS_DIR/$NOMBRE"
# las últimas QUEDAN, por nombre (llevan la fecha), y nada más
ls -1 "$COPIAS_DIR" | grep -E '^kinhold-[0-9]{8}-[0-9]{6}\.tar\.gz$' | sort | head -n "-$QUEDAN" | while read -r v; do rm -f "$COPIAS_DIR/$v"; done
N=$(ls -1 "$COPIAS_DIR" | grep -cE '^kinhold-[0-9]{8}-[0-9]{6}\.tar\.gz$' || true)
echo "Copia hecha: $COPIAS_DIR/$NOMBRE ($(du -h "$COPIAS_DIR/$NOMBRE" | cut -f1)); en la máquina quedan $N"

if [ -z "$DESTINO" ]; then
  echo "SIN COPIA FUERA DE LA MÁQUINA: falta KINHOLD_COPIA_DESTINO en $ENV (servidor/nube/LEEME.md, «Copia de seguridad»)" >&2
  exit 3
fi
# fuera, lo mismo que hay en la carpeta (también las que se van): --delete deja allí las mismas QUEDAN
if [[ "$DESTINO" == /* ]]; then
  mkdir -p "$DESTINO"
  rsync -a --delete --include='kinhold-*.tar.gz' --exclude='*' "$COPIAS_DIR/" "$DESTINO/"
else
  [ -r "$CLAVE" ] || { echo "Falta la clave SSH para la copia de fuera: $CLAVE" >&2; exit 4; }
  rsync -a --delete --include='kinhold-*.tar.gz' --exclude='*' \
    -e "ssh -p $PUERTO -i $CLAVE -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/etc/kinhold/copia_known_hosts" \
    "$COPIAS_DIR/" "$DESTINO/"
fi
echo "Copia fuera de la máquina al día: $DESTINO"
