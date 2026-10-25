#!/bin/bash
# Monta desde cero el taller de personajes con las versiones fijadas en herramientas/taller/versiones.json:
# Blender por pip (bpy), numpy y Pillow; MPFB2 clonado en su commit y enlazado como extensión de Blender;
# los paquetes de node con npm ci (package-lock.json). Al final lo comprueba con comprobar_taller.py.
# Uso: bash herramientas/taller/montar_taller.sh [carpeta donde clonar MPFB2]   (por defecto ~/mpfb2)
# Guía completa: herramientas/taller/LEEME.md
set -e
cd "$(dirname "$0")/../.."
V=herramientas/taller/versiones.json
leer() { python3 -c "import json,sys; d=json.load(open('$V')); print(eval(sys.argv[1], {}, {'d': d}))" "$1"; }

PY=$(leer "d['python']")
TIENE=$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')
if [ "$TIENE" != "$PY" ]; then
  echo "Este python3 es $TIENE y el taller está fijado en $PY: el paquete bpy solo existe para esa versión de Python."
  exit 1
fi

echo "== Paquetes de Python (Blender sin pantalla, numpy, Pillow)"
PIP_ARGS=$(leer "' '.join(f'{p}=={v}' for p, v in d['pip'].items())")
# --break-system-packages: en estas máquinas no hay entorno virtual; quitarlo si se usa uno
python3 -m pip install $PIP_ARGS --break-system-packages -q

echo "== MPFB2 (MakeHuman para Blender) en su commit fijado"
DESTINO=${1:-$HOME/mpfb2}
REPO=$(leer "d['mpfb2']['repositorio']")
COMMIT=$(leer "d['mpfb2']['commit']")
[ -d "$DESTINO/.git" ] || git clone -q "$REPO" "$DESTINO"
git -C "$DESTINO" fetch -q origin
git -C "$DESTINO" checkout -q "$COMMIT"
BPY=$(leer "d['pip']['bpy']")
EXT="$HOME/.config/blender/${BPY%.*}/extensions/user_default"
mkdir -p "$EXT"
ln -sfn "$(cd "$DESTINO" && pwd)/src/mpfb" "$EXT/mpfb"

echo "== Paquetes de node (package-lock.json)"
npm ci -s

echo "== Comprobación"
python3 herramientas/taller/comprobar_taller.py | grep -v '^[ {}"]'
[ "${PIPESTATUS[0]}" -eq 0 ] && echo "Taller montado con las versiones fijadas." || exit 1
