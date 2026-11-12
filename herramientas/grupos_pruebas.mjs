// Kinhold — qué grupos de pruebas pasa cada cambio (valravnx, 8 nov: «hay que quitar toda la prueba que no sea
// imprescindible y hacer de las actualizaciones algo mucho más rápido… solo verificar lo esencial, no pasar mil pruebas
// para cosas pequeñas»).
//
// El revisor (valravnx, 8 nov, después: «solo añade un revisor de cuán importante es cada prueba para lo exacto que se
// haga, si no es inmediatamente importante, no se hace, hay que priorizar el progreso»): no hay pruebas «de siempre».
// Cada grupo se pasa solo si lo pide un archivo que cambia el cambio, y el revisor dice cuál (porQue):
//   - los de cada archivo cambiado según TOCA (abajo) y los de cada archivo de prueba cambiado (su paso en
//     probar_todo.sh); la lógica y el recorrido, solo si cambia la lógica o el servidor; la demo única, solo si cambia
//     lo que la arranca;
//   - más los que se nombren a mano, con su porqué (lo que la tabla no sabe: un cambio en src/juego/main.js que es del
//     panel de fabricar → «panel-de-fabricacion»).
// Sin nada que lo pida, no se pasa nada en la nube. Las traducciones y la web las comprueba construir_web.mjs aquí, en
// segundos. La batería entera (--todo), solo si valravnx la pide.
// Sin three.js ni red: lo usa herramientas/pruebas_nube.mjs y se prueba con node herramientas/grupos_pruebas.mjs.

export const ESENCIALES = [];   // (8 nov: ninguna de siempre; cada una, solo si la pide lo cambiado)

// grupo → archivos (expresiones sobre la ruta) que, si cambian, piden ese grupo. Lo de todo el juego (main.js,
// plantilla, idiomas) no pide nada aquí: la demo única lo cubre y quien lo toca nombra lo suyo.
export const TOCA = {
  'logica': [/^src\/logica\//, /^src\/combate\/logica\.js$/, /^servidor\//, /^pruebas\/prueba_(?!recorrido)[^/]*\.mjs$/],
  'recorrido': [/^src\/logica\/(acciones|construccion|piezas|fabricacion|recoleccion|recogida_mundo|inventario|necesidades|muerte|tala|troceo|fuego|suelo|objetos_red|obras_red|presencia|arma_mano|combate_servidor|fauna|desgaste)\.js$/, /^servidor\/(servidor|guardado)\.mjs$/, /^servidor\/sistemas\//, /^pruebas\/prueba_recorrido\.mjs$/],
  'demo-unica': [/^src\/demo\//, /^src\/plantilla\.html$/, /^construir_demo\.mjs$/, /^src\/mundo\/(cliente|conexion|mundo_juego)\.js$/],
  'la-accion-a-la-vista': [/^src\/juego\/accion_vista\.js$/],
  'construccion': [/^src\/logica\/(construccion|piezas|obras_red)\.js$/, /^src\/mundo\/modelos\.js$/, /^src\/juego\/(movimiento|barra_construir)\.js$/],
  'quitar-el-mojon': [/^src\/logica\/(construccion|abandono)\.js$/],
  'posprocesado-y-perfiles-graficos': [/^src\/posprocesado\//, /^construir_posprocesado\.mjs$/],
  'el-perfil-grafico-en-el-juego': [/^src\/juego\/graficos\.js$/, /^src\/posprocesado\//],
  'la-hierba-densa': [/^src\/mundo\/hierba_densa\.js$/],
  'el-dia-y-la-noche': [/^src\/(logica|mundo)\/cielo\.js$/, /^src\/mundo\/ambiente\.js$/],
  'los-avisos-de-las-necesidades': [/^src\/juego\/avisos_necesidades\.js$/, /^src\/logica\/necesidades\.js$/],
  'las-bayas-y-las-setas': [/^src\/logica\/recoleccion\.js$/],
  'el-bosque-de-lejos-visto-de-cerca': [/^src\/mundo\/(horizonte|vegetacion_mundo|especies)\.js$/, /^src\/logica\/horizonte\.js$/],
  'el-mazo-de-piedra-y-romper-rocas': [/^src\/mundo\/vegetacion_mundo\.js$/, /^src\/juego\/modelos_objetos\.js$/],
  'el-mimbre-la-corteza-y-la-resina': [/^src\/juego\/tala\.js$/],
  'recoger-del-suelo-y-de-las-plantas': [/^src\/(logica|juego)\/recoleccion\.js$/],
  'tala-de-los-arboles': [/^src\/(logica|juego)\/tala\.js$/],
  'tronzar-y-partir': [/^src\/logica\/troceo\.js$/],
  'la-rastra': [/^src\/(logica|juego)\/rastra\.js$/],
  'la-carretilla': [/^src\/juego\/carretilla\.js$/],
  'panel-de-fabricacion': [/^src\/logica\/(fabricacion|iconos)\.js$/, /^src\/juego\/(panel_fabricar|estaciones)\.js$/],
  'la-hoguera': [/^src\/logica\/fuego\.js$/],
  'el-hogar': [/^src\/logica\/fuego\.js$/, /^src\/juego\/estaciones\.js$/],
  'los-almacenajes-de-la-base': [/^src\/juego\/estaciones\.js$/],
  'los-colgaderos-de-mochilas-y-de-herramientas': [/^src\/juego\/estaciones\.js$/],
  'la-cama-ligada': [/^src\/juego\/estaciones\.js$/, /^src\/logica\/fabricacion\.js$/, /^src\/juego\/personaje\.js$/],
  'panel-de-inventario': [/^src\/juego\/(panel_inventario|retrato|iconos_ropa)\.js$/, /^src\/logica\/inventario\.js$/],
  'lo-que-llevas-se-ve-puesto': [/^src\/(logica|juego)\/llevado\.js$/, /^src\/logica\/prendas\.js$/],
  'objetos-en-el-suelo': [/^src\/(logica|juego)\/suelo\.js$/],
  'combate-en-el-mundo': [/^src\/juego\/combate_mundo\.js$/, /^src\/combate\//],
  'pelear-en-cualquier-sitio-del-mundo': [/^src\/juego\/combate_mundo\.js$/],
  'pruebas-de-estilo': [/^src\/estilo\//, /^construir_estilo\.mjs$/],
  'personaje': [/^src\/personaje\//, /^src\/personajes\//, /^src\/logica\/(aspecto|hechura|tintes)\.js$/, /^herramientas\/taller\//, /^construir_personaje\.mjs$/],
  'la-demo-en-el-mundo': [/^src\/mundo\/(mundo_juego|terreno_trozos|trozo_suelo|rendimiento)\.js$/, /^src\/demo\/rendimiento\.js$/],
  'lo-que-se-recoge-en-el-mundo': [/^src\/logica\/recogida_mundo\.js$/, /^src\/mundo\/rocas\.js$/],
  'construir-a-la-altura-del-suelo': [/^src\/logica\/nivelado\.js$/, /^src\/juego\/movimiento\.js$/],
  'recursos-de-personaje-v2': [/^docs\/recursos\/personajes\//],
  'juego-en-ingles': [],   // los textos los mira la web y cada grupo con su idioma; este, en la batería entera
  'cavar': [/^src\/mina\//, /^src\/logica\/excavacion\.js$/, /^construir_mina\.mjs$/],
  'niveles-de-detalle-del-personaje': [/^src\/(personajes|logica)\/detalle\.js$/],
  'terreno-por-trozos': [/^src\/logica\/(trozos|trozos_red)\.js$/, /^src\/mundo\/(trozos_hilo|terreno_trozos)\.js$/],
  'mapa-del-mundo': [/^src\/mapa\//, /^src\/logica\/(mapa|paisaje)\.js$/, /^construir_mapa\.mjs$/],
  'mapa-del-rey': [/^src\/juego\/mapa_(rey|rey_pintar|zonas)\.js$/, /^src\/logica\/(comarcas|zonas_rey)\.js$/],
  'rios-de-verdad': [/^src\/mundo\/agua_(lamina|mundo)\.js$/],
  'tierras-del-rey': [/^src\/logica\/(tierras_rey|zonas_rey)\.js$/],
  'panel-del-admin': [/^src\/juego\/(panel_admin|camara_libre)\.js$/, /^src\/logica\/admin\.js$/],
  'el-chat-de-texto': [/^src\/(logica|juego)\/charla\.js$/],
  'dormido-al-desconectarse': [/^src\/logica\/dormidos\.js$/, /^src\/juego\/en_linea\.js$/, /^pruebas\/prueba_desconectado_navegador\.py$/],
  'morir-y-que-te-saqueen': [/^src\/logica\/muerte\.js$/, /^pruebas\/prueba_muerte_navegador\.py$/],
  'las-liebres': [/^src\/(logica|juego)\/fauna\.js$/, /^pruebas\/prueba_fauna_navegador\.py$/],
  'despiezar-y-asar': [/^src\/logica\/comida\.js$/, /^src\/juego\/modelos_objetos\.js$/, /^pruebas\/prueba_comida_navegador\.py$/],
  'el-modo-arma-con-lo-de-la-mano-y-cazar-con-la-lanza': [/^src\/logica\/arma_mano\.js$/, /^src\/juego\/(fauna|combate_mundo)\.js$/, /^src\/combate\/modelos\.js$/, /^pruebas\/prueba_caza_navegador\.py$/],
  'entrar-con-la-cuenta': [/^src\/mundo\/(pantalla_cuenta|eleccion|conexion)\.js$/, /^src\/logica\/(cuentas|correo|fichas)\.js$/],
  'construir-con-el-acabado-nuevo': [/^docs\/recursos\/piezas-v\d+\//, /^herramientas\/iconos\//, /^pruebas\/prueba_construir_menu_navegador\.py$/],
  'web': [/^herramientas\/(construir_web\.mjs|plantilla_web\.html)$/],
};

// el archivo de prueba de cada grupo de navegador (lo que va tras «python3» en su paso de probar_todo.sh)
export function pruebasDeGrupos(textoProbarTodo, grupoDe) {
  const out = {};
  for (const l of textoProbarTodo.split('\n')) {
    const m = l.match(/^paso "([^"]+)"\s+\S+\s+(pruebas\/\S+)/);
    if (!m) continue;
    const g = grupoDe(m[1]);
    (out[g] ||= []).push(m[2]);
  }
  return out;
}

// el revisor: cada grupo que pide el cambio, con los archivos que lo piden (o «nombrado a mano»); solo los que existen
export function porQue(archivos, { todos, pruebas = {}, nombrados = [] }) {
  const out = new Map(ESENCIALES.filter(g => todos.includes(g)).map(g => [g, ['de siempre']]));
  const pide = (g, por) => { if (!out.has(g)) out.set(g, []); if (!out.get(g).includes(por)) out.get(g).push(por); };
  for (const f of archivos) {
    for (const [g, l] of Object.entries(TOCA)) if (l.some(r => r.test(f))) pide(g, f);
    for (const [g, l] of Object.entries(pruebas)) if (l.includes(f)) pide(g, f);
  }
  for (const g of nombrados) pide(g, 'nombrado a mano');
  return new Map(todos.filter(g => out.has(g)).map(g => [g, out.get(g)]));
}
// los grupos que pide un cambio (los del revisor)
export const gruposPara = (archivos, o) => [...porQue(archivos, o).keys()];

// prueba: node herramientas/grupos_pruebas.mjs (con MUTAR=1, sin los esenciales: tiene que fallar)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFileSync } = await import('child_process');
  const { readFileSync } = await import('fs');
  const todos = JSON.parse(execFileSync('bash', ['herramientas/probar_todo.sh', '--grupos'], { encoding: 'utf8' }));
  const grupoDe = (n) => execFileSync('bash', ['-c', `source <(sed -n '/^grupo_de()/,/^}/p' herramientas/probar_todo.sh); grupo_de "$1"`, '_', n], { encoding: 'utf8' }).trim();
  const pruebas = pruebasDeGrupos(readFileSync('herramientas/probar_todo.sh', 'utf8'), grupoDe);
  if (process.env.MUTAR === '1') ESENCIALES.push('logica', 'demo-unica');   // (rota a propósito: pruebas de siempre)
  let mal = 0;
  const ver = (n, c, d = '') => { console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); if (!c) mal++; };
  const sinNada = gruposPara(['proyecto/diario.json', 'docs/index.html', 'src/idiomas/en.json'], { todos, pruebas });
  ver('sin cambios de código (diario, web, traducciones), nada en la nube', sinNada.length === 0, sinNada.join(', '));
  const mapa = gruposPara(['src/juego/mapa_rey.js', 'pruebas/prueba_mapa_rey_navegador.py'], { todos, pruebas });
  ver('tocar el mapa del rey pide solo su grupo', mapa.join() === 'mapa-del-rey', mapa.join(', '));
  const fuego = porQue(['src/logica/fuego.js'], { todos, pruebas });
  ver('tocar la lógica del fuego pide la lógica, el recorrido, la hoguera y el hogar, y dice por qué', [...fuego.keys()].sort().join() === 'el-hogar,la-hoguera,logica,recorrido' && fuego.get('la-hoguera')[0] === 'src/logica/fuego.js', JSON.stringify([...fuego]));
  const prueba = gruposPara(['pruebas/prueba_hoguera_navegador.py'], { todos, pruebas });
  ver('tocar el archivo de prueba de un grupo pide ese grupo', prueba.join() === 'la-hoguera', prueba.join(', '));
  ver('lo nombrado a mano entra', gruposPara([], { todos, pruebas, nombrados: ['cavar'] }).join() === 'cavar');
  const sobran = Object.keys(TOCA).filter(g => !todos.includes(g));
  ver('la tabla solo nombra grupos que existen', !sobran.length, sobran.join(', '));
  const sinPrueba = todos.filter(g => g !== 'logica' && g !== 'recorrido' && !pruebas[g]);
  ver('cada grupo de navegador tiene su archivo de prueba', !sinPrueba.length, sinPrueba.join(', '));
  console.log(mal ? `\n${mal} mal` : '\nTodo bien');
  process.exit(mal ? 1 : 0);
}
