#!/bin/bash
# Construye todo y pasa todas las pruebas. Capturas en /tmp/kinhold_capturas/<grupo>/; la salida entera de cada paso,
# en /tmp/kinhold_capturas/salida/.
# Uso: bash herramientas/probar_todo.sh                  todo aquí (sale con error si algo falla)
#      bash herramientas/probar_todo.sh --grupo <g>      solo ese grupo (lo usa la nube: .github/workflows/pruebas.yml)
#      bash herramientas/probar_todo.sh --grupos         la lista de grupos, en JSON
# Grupos: cada «Navegador: …» es el suyo (lo de antes del paréntesis); «Web de progreso» va con «Navegador: web»;
# lo demás, en «logica». Lo que empieza por «Construir» va en todos (tarda segundos). Un paso nuevo se añade como
# siempre y cae solo en su grupo. Lo normal es pasarlo en la nube: node herramientas/pruebas_nube.mjs
cd "$(dirname "$0")/.." || exit 1
GRUPO=""; LISTAR=""; [ "$1" = "--grupo" ] && GRUPO="$2"; [ "$1" = "--grupos" ] && LISTAR=1
C=/tmp/kinhold_capturas; [ -n "$LISTAR" ] || { rm -rf "$C"; mkdir -p "$C/salida"; }
fallo=0; grupos=()
grupo_de() {
  local n="$1"
  case "$n" in Construir*) echo "construir"; return;; "Web de progreso") echo "web"; return;; Navegador:*) ;; *) echo "logica"; return;; esac
  n="${n#Navegador: }"; n="${n%%(*}"
  echo "$n" | sed 's/á/a/g; s/é/e/g; s/í/i/g; s/ó/o/g; s/ú/u/g; s/ñ/n/g' | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//'
}
paso() {
  local g; g=$(grupo_de "$1")
  if [ -n "$LISTAR" ]; then [ "$g" = construir ] || [[ " ${grupos[*]} " == *" $g "* ]] || grupos+=("$g"); return; fi
  [ -z "$GRUPO" ] || [ "$g" = construir ] || [ "$g" = "$GRUPO" ] || return 0
  local f; f="$C/salida/$(echo "$1" | tr -c 'A-Za-z0-9\n' '_').txt"
  echo; echo "== $1"; shift; "$@" > "$f" 2>&1; local r=$?; tail -4 "$f"
  [ $r -eq 0 ] || { echo "!! FALLA: $*"; fallo=1; }
}
paso "Construir construcción" node construir.mjs
paso "Construir combate" node construir_combate.mjs
paso "Construir pruebas de estilo" node construir_estilo.mjs
paso "Construir personaje" node construir_personaje.mjs
paso "Construir demo única" node construir_demo.mjs
paso "Construir prueba de cavar" node construir_mina.mjs
paso "Construir visor del mapa" node construir_mapa.mjs
paso "Lógica de construcción" node pruebas/prueba_logica.mjs
paso "Modelos" node pruebas/prueba_modelos.mjs
paso "Lógica de combate" node pruebas/prueba_combate.mjs
paso "Acciones con autor" node pruebas/prueba_acciones.mjs
paso "Inventario por huecos" node pruebas/prueba_inventario.mjs
paso "Recoger del suelo y de las plantas" node pruebas/prueba_recoleccion.mjs
paso "Datos de cada prenda (zonas, protección, abrigo y peso)" node pruebas/prueba_ropa.mjs
paso "Aspecto del personaje (personalización)" node pruebas/prueba_aspecto.mjs
paso "Servidor mínimo con dos clientes" node pruebas/prueba_servidor.mjs
paso "Jugadores que se ven, con lag simulado" node pruebas/prueba_presencia.mjs
paso "Mundo en línea: dos clientes con el servidor" node pruebas/prueba_en_linea.mjs
paso "Conexiones que se cortan y datos mal formados" node pruebas/prueba_conexiones.mjs
paso "Combate en el servidor, con lag simulado" node pruebas/prueba_combate_servidor.mjs
paso "Bots: jugadores simulados contra el servidor" node pruebas/prueba_bots.mjs
paso "Medición del servidor (CPU, memoria, red y disco)" node pruebas/prueba_medir.mjs
[ -z "$LISTAR" ] && { [ -z "$GRUPO" ] || [ "$GRUPO" = logica ]; } && ! command -v caddy >/dev/null && {  apt-get install -y -q caddy >/dev/null 2>&1 || { apt-get update -q >/dev/null 2>&1; apt-get install -y -q caddy >/dev/null 2>&1; } || true; }
paso "Servidor de prueba en internet (Caddy con HTTPS delante del juego)" node pruebas/prueba_nube.mjs
paso "Taller: los cinturones ciñen su prenda" node pruebas/prueba_cinturones.mjs
paso "Taller: capa, calzado y tocados" node pruebas/prueba_prendas.mjs
paso "Taller: formas y colores para personalizar" node pruebas/prueba_aspecto_modelos.mjs
paso "Taller: manos enteras y botas de la mujer bajo la falda" node pruebas/prueba_manos.mjs
paso "Taller: versiones fijadas" python3 herramientas/taller/comprobar_taller.py --prueba
paso "Unión del diario y las traducciones" node pruebas/prueba_unir_json.mjs
paso "Dos carriles en paralelo sin pisarse" node pruebas/prueba_carriles.mjs
paso "Excavación y malla de la roca" node pruebas/prueba_excavacion.mjs
paso "Generador del mapa del mundo" node pruebas/prueba_mapa.mjs
paso "Textos traducidos" node pruebas/prueba_idiomas.mjs
paso "Navegador: construcción" python3 pruebas/prueba_navegador.py dist/kinhold_hito1.html "$C/construccion"
paso "Navegador: recoger del suelo y de las plantas" python3 pruebas/prueba_recoleccion_navegador.py dist/kinhold_hito1.html "$C/recoleccion"
paso "Navegador: panel de inventario" python3 pruebas/prueba_inventario_navegador.py dist/kinhold_hito1.html "$C/inventario"
paso "Navegador: combate" python3 pruebas/prueba_combate_navegador.py dist/kinhold_combate.html "$C/combate"
paso "Navegador: pruebas de estilo" python3 pruebas/prueba_estilo_navegador.py dist/kinhold_estilo.html "$C/estilo"
paso "Navegador: personaje" python3 pruebas/prueba_personaje_navegador.py dist/kinhold_personaje.html "$C/personaje"
paso "Navegador: demo única" python3 pruebas/prueba_demo_navegador.py dist/kinhold_demo.html "$C/demo"
paso "Navegador: jugar en línea (dos páginas y un servidor)" python3 pruebas/prueba_en_linea_navegador.py dist/kinhold_demo.html "$C/en_linea"
paso "Navegador: duelo en línea (dos páginas y un servidor)" python3 pruebas/prueba_duelo_en_linea_navegador.py dist/kinhold_demo.html "$C/duelo_en_linea"
paso "Navegador: recursos de personaje v2" python3 pruebas/prueba_recursos_personaje.py "$C/recursos"
paso "Navegador: juego en inglés (también estilo y personaje)" python3 pruebas/prueba_idioma_navegador.py dist/kinhold_hito1.html dist/kinhold_combate.html dist/kinhold_estilo.html dist/kinhold_personaje.html "$C/idioma"
paso "Navegador: cavar" python3 pruebas/prueba_mina_navegador.py dist/kinhold_mina.html "$C/mina"
paso "Navegador: mapa del mundo" python3 pruebas/prueba_mapa_navegador.py dist/kinhold_mapa.html "$C/mapa"
paso "Web de progreso" node herramientas/construir_web.mjs
paso "Navegador: web" python3 pruebas/prueba_web.py "$C/web"
if [ -n "$LISTAR" ]; then printf '['; sep=; for g in "${grupos[@]}"; do printf '%s"%s"' "$sep" "$g"; sep=,; done; echo ']'; exit 0; fi
echo
[ $fallo -eq 0 ] && echo "TODO CORRECTO · capturas en $C" || echo "HAY FALLOS"
exit $fallo
