#!/bin/bash
# Pone el servidor de Kinhold al día solo cuando en main hay una versión nueva de la demo (lo pidió valravnx el 31 oct:
# «que el servidor se actualice automáticamente con cada versión»). Lo lanza cada 5 minutos el temporizador
# kinhold-actualizar.timer (lo instalan instalar.sh y actualizar.sh). Si la última docs/jugar/demo/vN.html de main no
# es la que ya está puesta, lanza actualizar.sh (trae main, reinicia el servidor; el mundo no se toca) y apunta la nueva.
# Con lo demás de main (el diario, la web, avances) no hace nada: así no se reinicia sin necesidad.
# Lo que hace sale en «journalctl -u kinhold-actualizar».
# Para la prueba (pruebas/prueba_auto_actualizar.mjs) se puede cambiar con KINHOLD_DIR, KINHOLD_ESTADO y
# KINHOLD_ACTUALIZAR (la orden que pone al día).
set -euo pipefail
DIR="${KINHOLD_DIR:-/opt/kinhold}"
ESTADO="${KINHOLD_ESTADO:-/var/lib/kinhold-actualizar/version}"
ACTUALIZAR="${KINHOLD_ACTUALIZAR:-bash $DIR/servidor/nube/actualizar.sh}"

ultima() {   # la versión de la demo más alta en un árbol de git (v61 → 61)
  git -C "$DIR" ls-tree --name-only "$1" docs/jugar/demo/ | sed -n 's|.*/v\([0-9]\{1,\}\)\.html$|\1|p' | sort -n | tail -1
}
git -C "$DIR" fetch -q origin main   # (sin --depth: la copia es corta y actualizar.sh hace «git pull --ff-only»)
nueva="$(ultima FETCH_HEAD)"
[ -n "$nueva" ] || { echo "En main no hay ninguna versión de la demo (¿ha cambiado la carpeta?)."; exit 1; }
mkdir -p "$(dirname "$ESTADO")"
# la primera vez se apunta la que ya está puesta (la de la copia de aquí), sin reiniciar nada
[ -f "$ESTADO" ] || ultima HEAD > "$ESTADO"
puesta="$(cat "$ESTADO")"
if [ "$nueva" = "$puesta" ]; then exit 0; fi
echo "Versión nueva de la demo: v$nueva (puesta: v${puesta:-?}). Poniendo el servidor al día…"
bash -c "$ACTUALIZAR"
echo "$nueva" > "$ESTADO"
echo "Servidor al día con la demo v$nueva."
