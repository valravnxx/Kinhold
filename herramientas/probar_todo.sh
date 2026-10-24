#!/bin/bash
# Construye todo y pasa todas las pruebas. Capturas en /tmp/kinhold_capturas/<grupo>/.
# Uso: bash herramientas/probar_todo.sh     (sale con error si algo falla)
cd "$(dirname "$0")/.." || exit 1
C=/tmp/kinhold_capturas; rm -rf "$C"; mkdir -p "$C"
fallo=0
paso() { echo; echo "== $1"; shift; "$@" 2>&1 | tail -4; [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "!! FALLA: $*"; fallo=1; }; }
paso "Construir construcción" node construir.mjs
paso "Construir combate" node construir_combate.mjs
paso "Construir pruebas de estilo" node construir_estilo.mjs
paso "Lógica de construcción" node pruebas/prueba_logica.mjs
paso "Modelos" node pruebas/prueba_modelos.mjs
paso "Lógica de combate" node pruebas/prueba_combate.mjs
paso "Navegador: construcción" python3 pruebas/prueba_navegador.py dist/kinhold_hito1.html "$C/construccion"
paso "Navegador: combate" python3 pruebas/prueba_combate_navegador.py dist/kinhold_combate.html "$C/combate"
paso "Navegador: pruebas de estilo" python3 pruebas/prueba_estilo_navegador.py dist/kinhold_estilo.html "$C/estilo"
paso "Web de progreso" node herramientas/construir_web.mjs
paso "Navegador: web" python3 pruebas/prueba_web.py "$C/web"
echo
[ $fallo -eq 0 ] && echo "TODO CORRECTO · capturas en $C" || echo "HAY FALLOS"
exit $fallo
