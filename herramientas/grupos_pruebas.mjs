// Kinhold — qué grupos de pruebas pasa cada cambio (valravnx, 8 nov: «hay que quitar toda la prueba que no sea
// imprescindible y hacer de las actualizaciones algo mucho más rápido… solo verificar lo esencial, no pasar mil pruebas
// para cosas pequeñas»).
//
// Antes, cada cambio pasaba la batería entera (42 grupos, unos 85 minutos en la nube, y otra vez al unir main). Ahora:
//   - ESENCIALES, siempre: la lógica (todas las pruebas de node, con el recorrido de jugador), que la demo arranca y se
//     juega, y la web.
//   - más los grupos de lo que toca el cambio: los de cada archivo cambiado según TOCA (abajo) y los de cada archivo de
//     prueba cambiado (el de su paso en probar_todo.sh);
//   - más los que se nombren a mano (lo que se ha tocado y la tabla no sabe: por ejemplo, un cambio en
//     src/juego/main.js que es del panel de fabricar → «panel-de-fabricacion»).
// La batería entera, solo al llevar un hito a revisión (o si valravnx lo pide): pruebas_nube.mjs --todo.
// Sin three.js ni red: lo usa herramientas/pruebas_nube.mjs y se prueba con node herramientas/grupos_pruebas.mjs.

export const ESENCIALES = ['logica', 'demo-unica', 'web'];

// grupo → archivos (expresiones sobre la ruta) que, si cambian, piden ese grupo. Lo de todo el juego (main.js,
// plantilla, idiomas) no pide nada aquí: la demo única lo cubre y quien lo toca nombra lo suyo.
export const TOCA = {
  'construccion': [/^src\/logica\/(construccion|piezas|obras_red)\.js$/, /^src\/mundo\/modelos\.js$/],
  'quitar-el-mojon': [/^src\/logica\/(construccion|abandono)\.js$/],
  'posprocesado-y-perfiles-graficos': [/^src\/posprocesado\//, /^construir_posprocesado\.mjs$/],
  'el-perfil-grafico-en-el-juego': [/^src\/juego\/graficos\.js$/, /^src\/posprocesado\//],
  'el-dia-y-la-noche': [/^src\/(logica|mundo)\/cielo\.js$/, /^src\/mundo\/ambiente\.js$/],
  'los-avisos-de-las-necesidades': [/^src\/juego\/avisos_necesidades\.js$/, /^src\/logica\/necesidades\.js$/],
  'las-bayas-y-las-setas': [/^src\/logica\/recoleccion\.js$/],
  'el-bosque-de-lejos-visto-de-cerca': [/^src\/mundo\/(horizonte|vegetacion_mundo|especies)\.js$/, /^src\/logica\/horizonte\.js$/],
  'recoger-del-suelo-y-de-las-plantas': [/^src\/(logica|juego)\/recoleccion\.js$/],
  'tala-de-los-arboles': [/^src\/(logica|juego)\/tala\.js$/],
  'tronzar-y-partir': [/^src\/logica\/troceo\.js$/],
  'la-rastra': [/^src\/(logica|juego)\/rastra\.js$/],
  'la-carretilla': [/^src\/juego\/carretilla\.js$/],
  'panel-de-fabricacion': [/^src\/logica\/(fabricacion|iconos)\.js$/, /^src\/juego\/(panel_fabricar|estaciones)\.js$/],
  'la-hoguera': [/^src\/logica\/fuego\.js$/],
  'los-almacenajes-de-la-base': [/^src\/juego\/estaciones\.js$/],
  'los-colgaderos-de-mochilas-y-de-herramientas': [/^src\/juego\/estaciones\.js$/],
  'panel-de-inventario': [/^src\/juego\/(panel_inventario|retrato|iconos_ropa)\.js$/, /^src\/logica\/inventario\.js$/],
  'lo-que-llevas-se-ve-puesto': [/^src\/(logica|juego)\/llevado\.js$/, /^src\/logica\/prendas\.js$/],
  'objetos-en-el-suelo': [/^src\/(logica|juego)\/suelo\.js$/],
  'combate-en-el-mundo': [/^src\/juego\/combate_mundo\.js$/, /^src\/combate\//],
  'pelear-en-cualquier-sitio-del-mundo': [/^src\/juego\/combate_mundo\.js$/],
  'pruebas-de-estilo': [/^src\/estilo\//, /^construir_estilo\.mjs$/],
  'personaje': [/^src\/personaje\//, /^src\/personajes\//, /^src\/logica\/(aspecto|hechura|tintes)\.js$/, /^herramientas\/taller\//, /^construir_personaje\.mjs$/],
  'animaciones-para-cargar': [/^src\/personajes\/medidas_carga\.js$/],
  'la-demo-en-el-mundo': [/^src\/mundo\/(mundo_juego|terreno_trozos|trozo_suelo|rendimiento)\.js$/, /^src\/demo\/rendimiento\.js$/],
  'lo-que-se-recoge-en-el-mundo': [/^src\/logica\/recogida_mundo\.js$/, /^src\/mundo\/rocas\.js$/],
  'construir-a-la-altura-del-suelo': [/^src\/logica\/nivelado\.js$/],
  'recursos-de-personaje-v2': [/^docs\/recursos\/personajes\//],
  'juego-en-ingles': [],   // los textos los mira la web y cada grupo con su idioma; este, en la batería entera
  'cavar': [/^src\/mina\//, /^src\/logica\/excavacion\.js$/, /^construir_mina\.mjs$/],
  'niveles-de-detalle-del-personaje': [/^src\/(personajes|logica)\/detalle\.js$/],
  'terreno-por-trozos': [/^src\/logica\/(trozos|trozos_red)\.js$/, /^src\/mundo\/(trozos_hilo|terreno_trozos)\.js$/],
  'mapa-del-mundo': [/^src\/mapa\//, /^src\/logica\/(mapa|paisaje)\.js$/, /^construir_mapa\.mjs$/],
  'mapa-del-rey': [/^src\/juego\/mapa_(rey|rey_pintar|zonas)\.js$/, /^src\/logica\/(comarcas|zonas_rey)\.js$/],
  'rios-de-verdad': [/^src\/mundo\/agua_(lamina|mundo)\.js$/],
  'tierras-del-rey': [/^src\/logica\/(tierras_rey|zonas_rey)\.js$/],
  'panel-del-admin': [/^src\/juego\/panel_admin\.js$/, /^src\/logica\/admin\.js$/],
  'el-chat-de-texto': [/^src\/(logica|juego)\/charla\.js$/],
  'entrar-con-la-cuenta': [/^src\/mundo\/(pantalla_cuenta|eleccion|conexion)\.js$/, /^src\/logica\/(cuentas|correo|fichas)\.js$/],
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

// los grupos que pide un cambio: los esenciales, los de lo tocado y los nombrados (solo los que existen)
export function gruposPara(archivos, { todos, pruebas = {}, nombrados = [] }) {
  const out = new Set(ESENCIALES.filter(g => todos.includes(g)));
  for (const f of archivos) {
    for (const [g, l] of Object.entries(TOCA)) if (l.some(r => r.test(f))) out.add(g);
    for (const [g, l] of Object.entries(pruebas)) if (l.includes(f)) out.add(g);
  }
  for (const g of nombrados) out.add(g);
  return todos.filter(g => out.has(g));
}

// prueba: node herramientas/grupos_pruebas.mjs (con MUTAR=1, sin los esenciales: tiene que fallar)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFileSync } = await import('child_process');
  const { readFileSync } = await import('fs');
  const todos = JSON.parse(execFileSync('bash', ['herramientas/probar_todo.sh', '--grupos'], { encoding: 'utf8' }));
  const grupoDe = (n) => execFileSync('bash', ['-c', `source <(sed -n '/^grupo_de()/,/^}/p' herramientas/probar_todo.sh); grupo_de "$1"`, '_', n], { encoding: 'utf8' }).trim();
  const pruebas = pruebasDeGrupos(readFileSync('herramientas/probar_todo.sh', 'utf8'), grupoDe);
  if (process.env.MUTAR === '1') ESENCIALES.length = 0;
  let mal = 0;
  const ver = (n, c, d = '') => { console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); if (!c) mal++; };
  const sinNada = gruposPara([], { todos, pruebas });
  ver('sin cambios de código, solo los esenciales (lógica, la demo y la web)', sinNada.join() === 'logica,demo-unica,web' || sinNada.sort().join() === ['demo-unica', 'logica', 'web'].join(), sinNada.join(', '));
  const mapa = gruposPara(['src/juego/mapa_rey.js', 'pruebas/prueba_mapa_rey_navegador.py'], { todos, pruebas });
  ver('tocar el mapa del rey pide su grupo y los esenciales, nada más', mapa.length === 4 && mapa.includes('mapa-del-rey'), mapa.join(', '));
  const prueba = gruposPara(['pruebas/prueba_hoguera_navegador.py'], { todos, pruebas });
  ver('tocar el archivo de prueba de un grupo pide ese grupo', prueba.includes('la-hoguera'), prueba.join(', '));
  ver('lo nombrado a mano entra', gruposPara([], { todos, pruebas, nombrados: ['cavar'] }).includes('cavar'));
  const sobran = Object.keys(TOCA).filter(g => !todos.includes(g));
  ver('la tabla solo nombra grupos que existen', !sobran.length, sobran.join(', '));
  const sinPrueba = todos.filter(g => g !== 'logica' && !pruebas[g]);
  ver('cada grupo de navegador tiene su archivo de prueba', !sinPrueba.length, sinPrueba.join(', '));
  console.log(mal ? `\n${mal} mal` : '\nTodo bien');
  process.exit(mal ? 1 : 0);
}
