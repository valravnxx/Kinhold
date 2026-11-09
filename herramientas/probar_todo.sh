#!/bin/bash
# Construye todo y pasa todas las pruebas. Capturas en /tmp/kinhold_capturas/<grupo>/; la salida entera de cada paso,
# en /tmp/kinhold_capturas/salida/.
# Uso: bash herramientas/probar_todo.sh                  todo aquí (sale con error si algo falla)
#      bash herramientas/probar_todo.sh --grupo <g>      solo ese grupo (lo usa la nube: .github/workflows/pruebas.yml)
#      bash herramientas/probar_todo.sh --grupos         la lista de grupos, en JSON
# Grupos: cada «Navegador: …» es el suyo (lo de antes del paréntesis); «Web de progreso» va con «Navegador: web»;
# el recorrido de jugador, en «recorrido» (8 nov: en su máquina, a la vez que la lógica); lo demás, en «logica». Lo que empieza por «Construir» va en todos (tarda segundos). Un paso nuevo se añade como
# siempre y cae solo en su grupo. Lo normal es pasarlo en la nube: node herramientas/pruebas_nube.mjs
cd "$(dirname "$0")/.." || exit 1
GRUPO=""; LISTAR=""; [ "$1" = "--grupo" ] && GRUPO="$2"; [ "$1" = "--grupos" ] && LISTAR=1
C=/tmp/kinhold_capturas; [ -n "$LISTAR" ] || { rm -rf "$C"; mkdir -p "$C/salida"; }
fallo=0; grupos=()
grupo_de() {
  local n="$1"
  case "$n" in Construir*) echo "construir"; return;; "Web de progreso") echo "web"; return;; "Recorrido de jugador"*) echo "recorrido"; return;; Navegador:*) ;; *) echo "logica"; return;; esac
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
paso "Construir pruebas de estilo" node construir_estilo.mjs
paso "Construir personaje" node construir_personaje.mjs
paso "Construir demo única" node construir_demo.mjs
paso "Construir posprocesado y perfiles gráficos" node construir_posprocesado.mjs
paso "Construir prueba de cavar" node construir_mina.mjs
paso "Construir visor del mapa" node construir_mapa.mjs
paso "Lógica de construcción" node pruebas/prueba_logica.mjs
paso "Lo de niveles posteriores, escondido: el menú de construir solo enseña lo de este tramo" node pruebas/prueba_tramo.mjs
paso "Construir a la altura del suelo y nivelar" node pruebas/prueba_nivelado.mjs
paso "Modelos" node pruebas/prueba_modelos.mjs
paso "Lógica de combate" node pruebas/prueba_combate.mjs
paso "Acciones con autor" node pruebas/prueba_acciones.mjs
paso "Quitar el mojón: dejar tu tierra y perder lo construido, para reposicionar" node pruebas/prueba_quitar_mojon.mjs
paso "Alcance de las obras: el servidor solo deja entregar, subir, trabajar y desmontar junto a la obra y en su planta" node pruebas/prueba_alcance_obras.mjs
paso "Lo tuyo es tuyo: en tu tierra solo tú y tus invitados desmontáis y usáis puertas y fuego; el servidor lo comprueba" node pruebas/prueba_lo_tuyo.mjs
paso "La tierra vuelve al rey si no se usa: 30 días sin entrar el dueño ni sus invitados (15 sin obra terminada), avisos por correo y ruinas" node pruebas/prueba_tierra_al_rey.mjs
paso "Perfiles gráficos: seis perfiles, gradación de color y perfil de inicio" node pruebas/prueba_perfiles_graficos.mjs
paso "El ciclo de día y noche: la hora, el sol, la luna, las estrellas y la luz de cada momento" node pruebas/prueba_cielo.mjs
paso "Las necesidades: hambre, sed, frío y cansancio, en la lógica y en el servidor" node pruebas/prueba_necesidades.mjs
paso "Desconectarse: dormido en el mundo, atacable unos minutos fuera de tu tierra, en el servidor" node pruebas/prueba_dormidos.mjs
paso "Morir y que te saqueen: de sed, de hambre, en el combate o ahogado; el cuerpo con la mitad, y a tu cama" node pruebas/prueba_muerte.mjs
paso "Las liebres: pastan, se ponen alerta y huyen de quien se acerca; las mueve el servidor" node pruebas/prueba_fauna.mjs
paso "Cazar con la lanza: vuela, el servidor decide si acierta, la liebre cae y la lanza queda en el suelo" node pruebas/prueba_caza.mjs
paso "Desbrozar matorrales y arbustos, en la lógica y en el servidor" node pruebas/prueba_desbroce.mjs
paso "El mazo de piedra y romper rocas, en la lógica y en el servidor" node pruebas/prueba_rocas.mjs
paso "El mimbre, la corteza y la resina, en la lógica y en el servidor" node pruebas/prueba_materiales_arbol_ribera.mjs
paso "Horizonte de los perfiles altos" node pruebas/prueba_horizonte.mjs
paso "De dónde sale cada cosa (la casa humilde entera, sin arcón)" node pruebas/prueba_origenes.mjs
paso "Sin llanos pelados a ras del mar tierra adentro" node pruebas/prueba_llanos.mjs
paso "El fondo del mar junto a la costa" node pruebas/prueba_mar.mjs
paso "Los ríos llegan al mar" node pruebas/prueba_desembocadura.mjs
paso "Inventario por huecos" node pruebas/prueba_inventario.mjs
paso "Recoger del suelo y de las plantas" node pruebas/prueba_recoleccion.mjs
paso "Estaciones y recetas" node pruebas/prueba_fabricacion.mjs
paso "El fuego de la hoguera" node pruebas/prueba_fuego.mjs
paso "Objetos en el suelo" node pruebas/prueba_suelo.mjs
paso "Tala de los árboles" node pruebas/prueba_tala.mjs
paso "Tronzar y partir" node pruebas/prueba_troceo.mjs
paso "La rastra" node pruebas/prueba_rastra.mjs
paso "La carretilla" node pruebas/prueba_carretilla.mjs
paso "Obras con lo que llevas" node pruebas/prueba_obras_llevas.mjs
paso "Datos de cada prenda (zonas, protección, abrigo y peso)" node pruebas/prueba_ropa.mjs
paso "Aspecto del personaje (personalización)" node pruebas/prueba_aspecto.mjs
paso "Servidor mínimo con dos clientes" node pruebas/prueba_servidor.mjs
paso "Jugadores que se ven, con lag simulado" node pruebas/prueba_presencia.mjs
paso "Movimiento sin trampas (el servidor recorta lo que no se puede andar)" node pruebas/prueba_movimiento.mjs
paso "Mundo en línea: dos clientes con el servidor" node pruebas/prueba_en_linea.mjs
paso "Conexiones que se cortan y datos mal formados" node pruebas/prueba_conexiones.mjs
paso "Volver donde lo dejaste (posiciones en el servidor)" node pruebas/prueba_posicion_servidor.mjs
paso "Copia de seguridad diaria del servidor: las 14 últimas, en la máquina y fuera, y restaurar" node pruebas/prueba_copia_servidor.mjs
paso "Salidas en línea: cada personaje nuevo elige una de las tres del rey (Lindholt, la ciudad, Motdale) y el servidor lo recuerda" node pruebas/prueba_salidas.mjs
paso "Panel del admin en el servidor (por la cuenta, ver a todos, teletransportarse)" node pruebas/prueba_admin_servidor.mjs
paso "Herramienta del admin en el servidor (información, autoconstruir, arcón de admin, velocidad)" node pruebas/prueba_admin_herramienta.mjs
paso "Cuentas: usuario y contraseña (resumida con sal), crear, entrar, intentos y lo que no debe dejar" node pruebas/prueba_cuentas.mjs
paso "Combate en el servidor, con lag simulado" node pruebas/prueba_combate_servidor.mjs
paso "Inventario y suelo en el servidor, con dos clientes" node pruebas/prueba_objetos_servidor.mjs
paso "El servidor conoce el mundo (árboles, recogida, posiciones y obras contra el terreno)" node pruebas/prueba_terreno_servidor.mjs
paso "Lo talado, lo recogido y el suelo, por trozos: a cada uno lo de su alrededor" node pruebas/prueba_trozos_red.mjs
paso "Las obras y lo alisado, por trozos: a cada uno lo de su alrededor, con los mismos ids que el servidor" node pruebas/prueba_obras_red.mjs
paso "Obras con lo que llevas en línea, con dos clientes" node pruebas/prueba_obras_en_linea.mjs
paso "Chat de texto: lo que se dice, limpio, sin hablar a chorro, a los de cerca y apuntado" node pruebas/prueba_charla.mjs
paso "Recorrido de jugador: uno nuevo, sin arcón y con lo que recoge, de principio a fin" node pruebas/prueba_recorrido.mjs
paso "Bots: jugadores simulados contra el servidor" node pruebas/prueba_bots.mjs
paso "Terreno por trozos: anillos, bordes y faldones" node pruebas/prueba_trozos.mjs
paso "Whitholm: cuadro de la isla y sitio de salida" node pruebas/prueba_whitholm.mjs
paso "Lo que crece en el mundo: siempre en el mismo sitio, nada en el agua, especies de su bioma" node pruebas/prueba_vegetacion.mjs
paso "Lo que se recoge en el mundo: del sitio (bosque, caliza, laderas, ríos, claros y riberas), siempre igual" node pruebas/prueba_recogida_mundo.mjs
paso "Ríos de verdad: uniones, nacimiento, ancho y hondo" node pruebas/prueba_rios.mjs
paso "Comarcas y zonas de Whitholm" node pruebas/prueba_comarcas.mjs
paso "Qué grupos de pruebas pasa cada cambio (lo esencial y lo tocado)" node herramientas/grupos_pruebas.mjs
paso "Las zonas en el mapa del rey y tu tierra" node pruebas/prueba_mapa_zonas.mjs
paso "Las zonas del rey: veta marcada, ciudad y salida no se reclaman" node pruebas/prueba_zonas_rey.mjs
paso "Mapa del rey: costa del juego, nombres, ciudad y ríos" node pruebas/prueba_mapa_rey.mjs
paso "Strandvang, tierras del rey: nadie hiere a otro jugador (el servidor lo rechaza, con su autor)" node pruebas/prueba_tierras_rey.mjs
paso "Aguante, agua y nado" node pruebas/prueba_nado.mjs
paso "Medición del servidor (CPU, memoria, red y disco)" node pruebas/prueba_medir.mjs
[ -z "$LISTAR" ] && { [ -z "$GRUPO" ] || [ "$GRUPO" = logica ]; } && ! command -v caddy >/dev/null && {  apt-get install -y -q caddy >/dev/null 2>&1 || { apt-get update -q >/dev/null 2>&1; apt-get install -y -q caddy >/dev/null 2>&1; } || true; }
paso "Servidor de prueba en internet (Caddy con HTTPS delante del juego)" node pruebas/prueba_nube.mjs
paso "Servidor de prueba: al día solo con cada versión nueva de la demo" node pruebas/prueba_auto_actualizar.mjs
paso "Taller: los cinturones ciñen su prenda" node pruebas/prueba_cinturones.mjs
paso "Taller: capa, calzado y tocados" node pruebas/prueba_prendas.mjs
paso "Taller: formas y colores para personalizar" node pruebas/prueba_aspecto_modelos.mjs
paso "Taller: manos enteras y botas de la mujer bajo la falda" node pruebas/prueba_manos.mjs
paso "Taller: pies descalzos" node pruebas/prueba_pies.mjs
paso "Taller: barba larga con volumen" node pruebas/prueba_barbas.mjs
paso "Taller: cejas y barba pintadas (calcos)" node pruebas/prueba_calcos.mjs
paso "Taller: capa que cae de los hombros" node pruebas/prueba_manto.mjs
paso "Taller: la piel bajo el escote" node pruebas/prueba_toca.mjs
paso "Taller: el nacimiento del pelo" node pruebas/prueba_nacimiento_pelo.mjs
paso "Taller: tintes de la ropa y blasón" node pruebas/prueba_tintes.mjs
paso "Hechura de la ropa (material, corte y tejido)" node pruebas/prueba_hechura.mjs
paso "Niveles de detalle de los personajes" node pruebas/prueba_detalle.mjs
paso "Animaciones para cargar (taller-anim-v2)" node pruebas/prueba_anim_carga.mjs
paso "Lo que llevas se ve puesto: del inventario y por el servidor" node pruebas/prueba_llevado.mjs
paso "Taller: versiones fijadas" python3 herramientas/taller/comprobar_taller.py --prueba
paso "Capturas: solo las del cambio" node pruebas/prueba_capturas.mjs
paso "Unión del diario y las traducciones" node pruebas/prueba_unir_json.mjs
paso "Dos carriles en paralelo sin pisarse" node pruebas/prueba_carriles.mjs
paso "Excavación y malla de la roca" node pruebas/prueba_excavacion.mjs
paso "Versiones antiguas a las releases" node pruebas/prueba_archivar.mjs
paso "Generador del mapa del mundo" node pruebas/prueba_mapa.mjs
paso "Valles sin paredes lisas de kilómetros" node pruebas/prueba_valles.mjs
paso "Azar y ruido: un solo módulo, los mismos números" node pruebas/prueba_azar.mjs
paso "Textos traducidos" node pruebas/prueba_idiomas.mjs
paso "Imágenes de cada cosa para el panel de fabricar" node pruebas/prueba_iconos.mjs
paso "Noticias del desarrollo en Discord" node pruebas/prueba_discord_noticias.mjs
paso "Navegador: construcción" python3 pruebas/prueba_navegador.py dist/kinhold_demo.html "$C/construccion"
paso "Navegador: quitar el mojón" python3 pruebas/prueba_quitar_mojon_navegador.py dist/kinhold_demo.html "$C/quitar_mojon"
paso "Navegador: posprocesado y perfiles gráficos" python3 pruebas/prueba_posprocesado_navegador.py dist/kinhold_posprocesado.html "$C/posprocesado"
paso "Navegador: el perfil gráfico en el juego" python3 pruebas/prueba_graficos_juego_navegador.py dist/kinhold_demo.html "$C/graficos_juego"
paso "Navegador: el día y la noche" python3 pruebas/prueba_cielo_navegador.py dist/kinhold_demo.html "$C/cielo"
paso "Navegador: los avisos de las necesidades" python3 pruebas/prueba_avisos_navegador.py dist/kinhold_demo.html "$C/avisos"
paso "Navegador: las bayas y las setas" python3 pruebas/prueba_bayas_navegador.py dist/kinhold_demo.html "$C/bayas"
paso "Navegador: desbrozar matorrales y arbustos" python3 pruebas/prueba_desbroce_navegador.py dist/kinhold_demo.html "$C/desbroce"
paso "Navegador: la acción a la vista (etiqueta, aro, lista y botón de acción)" python3 pruebas/prueba_accion_navegador.py dist/kinhold_demo.html "$C/accion"
paso "Navegador: el mazo de piedra y romper rocas" python3 pruebas/prueba_rocas_navegador.py dist/kinhold_demo.html "$C/rocas"
paso "Navegador: el mimbre, la corteza y la resina" python3 pruebas/prueba_materiales_navegador.py dist/kinhold_demo.html "$C/materiales"
paso "Navegador: el bosque de lejos visto de cerca" python3 pruebas/prueba_dosel_cerca_navegador.py dist/kinhold_demo.html "$C/dosel_cerca"
paso "Navegador: recoger del suelo y de las plantas" python3 pruebas/prueba_recoleccion_navegador.py dist/kinhold_demo.html "$C/recoleccion"
paso "Navegador: tala de los árboles" python3 pruebas/prueba_tala_navegador.py dist/kinhold_demo.html "$C/tala"
paso "Navegador: tronzar y partir" python3 pruebas/prueba_troceo_navegador.py dist/kinhold_demo.html "$C/troceo"
paso "Navegador: la rastra" python3 pruebas/prueba_rastra_navegador.py dist/kinhold_demo.html "$C/rastra"
paso "Navegador: la carretilla" python3 pruebas/prueba_carretilla_navegador.py dist/kinhold_demo.html "$C/carretilla"
paso "Navegador: panel de fabricación" python3 pruebas/prueba_fabricar_navegador.py dist/kinhold_demo.html "$C/fabricar"
paso "Navegador: la hoguera" python3 pruebas/prueba_hoguera_navegador.py dist/kinhold_demo.html "$C/hoguera"
paso "Navegador: los almacenajes de la base" python3 pruebas/prueba_almacenajes_navegador.py dist/kinhold_demo.html "$C/almacenajes"
paso "Navegador: los colgaderos de mochilas y de herramientas" python3 pruebas/prueba_colgaderos_navegador.py dist/kinhold_demo.html "$C/colgaderos"
paso "Navegador: el hogar" python3 pruebas/prueba_hogar_navegador.py dist/kinhold_demo.html "$C/hogar"
paso "Navegador: la cama ligada" python3 pruebas/prueba_camas_navegador.py dist/kinhold_demo.html "$C/camas"
paso "Navegador: panel de inventario" python3 pruebas/prueba_inventario_navegador.py dist/kinhold_demo.html "$C/inventario"
paso "Navegador: lo que llevas se ve puesto" python3 pruebas/prueba_llevado_navegador.py dist/kinhold_demo.html "$C/llevado"
paso "Navegador: objetos en el suelo" python3 pruebas/prueba_suelo_navegador.py dist/kinhold_demo.html "$C/suelo"
paso "Navegador: combate en el mundo" python3 pruebas/prueba_combate_mundo_navegador.py dist/kinhold_demo.html "$C/combate_mundo"
paso "Navegador: pelear en cualquier sitio del mundo" python3 pruebas/prueba_pelear_mundo_navegador.py dist/kinhold_demo.html "$C/pelear_mundo"
paso "Navegador: pruebas de estilo" python3 pruebas/prueba_estilo_navegador.py dist/kinhold_estilo.html "$C/estilo"
paso "Navegador: personaje" python3 pruebas/prueba_personaje_navegador.py dist/kinhold_personaje.html "$C/personaje"
paso "Navegador: animaciones para cargar" python3 pruebas/prueba_anim_carga_navegador.py dist/kinhold_personaje.html "$C/anim_carga"
paso "Navegador: demo única" python3 pruebas/prueba_demo_navegador.py dist/kinhold_demo.html "$C/demo"
paso "Navegador: la demo en el mundo (Whitholm)" python3 pruebas/prueba_mundo_navegador.py dist/kinhold_demo.html "$C/mundo"
paso "Navegador: lo que se recoge en el mundo" python3 pruebas/prueba_recogida_mundo_navegador.py dist/kinhold_demo.html "$C/recogida_mundo"
paso "Navegador: construir a la altura del suelo (ladera de Whitholm)" python3 pruebas/prueba_nivelado_navegador.py dist/kinhold_demo.html "$C/nivelado"
paso "Navegador: volver donde lo dejaste" python3 pruebas/prueba_volver_navegador.py dist/kinhold_demo.html "$C/volver"
paso "Navegador: lo que llevas en línea (inventario, suelo, tala y recogida por el servidor)" python3 pruebas/prueba_objetos_en_linea_navegador.py dist/kinhold_demo.html "$C/objetos_en_linea"
paso "Navegador: recursos de personaje v2" python3 pruebas/prueba_recursos_personaje.py "$C/recursos"
paso "Navegador: juego en inglés (también estilo y personaje)" python3 pruebas/prueba_idioma_navegador.py dist/kinhold_demo.html dist/kinhold_estilo.html dist/kinhold_personaje.html "$C/idioma"
paso "Navegador: cavar" python3 pruebas/prueba_mina_navegador.py dist/kinhold_mina.html "$C/mina"
paso "Navegador: niveles de detalle del personaje" python3 pruebas/prueba_detalle_navegador.py dist/kinhold_personaje.html dist/kinhold_demo.html "$C/detalle"
paso "Navegador: terreno por trozos (en un hilo aparte)" python3 pruebas/prueba_trozos_navegador.py dist/kinhold_trozos.html "$C/trozos"
paso "Navegador: mapa del mundo" python3 pruebas/prueba_mapa_navegador.py dist/kinhold_mapa.html "$C/mapa"
paso "Navegador: mapa del rey" python3 pruebas/prueba_mapa_rey_navegador.py dist/kinhold_demo.html "$C/mapa_rey"
paso "Navegador: ríos de verdad" python3 pruebas/prueba_rios_navegador.py dist/kinhold_demo.html "$C/rios"
paso "Navegador: tierras del rey" python3 pruebas/prueba_tierras_rey_navegador.py dist/kinhold_demo.html "$C/tierras_rey"
paso "Navegador: panel del admin" python3 pruebas/prueba_admin_navegador.py dist/kinhold_demo.html "$C/admin"
paso "Navegador: el chat de texto" python3 pruebas/prueba_charla_navegador.py dist/kinhold_demo.html "$C/charla"
paso "Navegador: dormido al desconectarse" python3 pruebas/prueba_desconectado_navegador.py dist/kinhold_demo.html "$C/desconectado"
paso "Navegador: morir y que te saqueen" python3 pruebas/prueba_muerte_navegador.py dist/kinhold_demo.html "$C/muerte"
paso "Navegador: las liebres" python3 pruebas/prueba_fauna_navegador.py dist/kinhold_demo.html "$C/liebres"
paso "Navegador: cazar con la lanza" python3 pruebas/prueba_caza_navegador.py dist/kinhold_demo.html "$C/caza"
paso "Navegador: entrar con la cuenta" python3 pruebas/prueba_cuenta_navegador.py dist/kinhold_demo.html "$C/cuenta"
paso "Web de progreso" node herramientas/construir_web.mjs
paso "Navegador: web" python3 pruebas/prueba_web.py "$C/web"
if [ -n "$LISTAR" ]; then printf '['; sep=; for g in "${grupos[@]}"; do printf '%s"%s"' "$sep" "$g"; sep=,; done; echo ']'; exit 0; fi
echo
[ $fallo -eq 0 ] && echo "TODO CORRECTO · capturas en $C" || echo "HAY FALLOS"
exit $fallo
