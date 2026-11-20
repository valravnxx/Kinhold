// De dónde sale cada cosa (valravnx, 7 nov: «si se ha hecho el paso a paso… no se ha tenido en cuenta el maldito techo?»
// y «añade pasos de revisiones o lo que sea para que jamas se escurran estas cosas con temas tan esenciales»).
// Sigue la cadena entera desde el mundo, sin arcón: lo que se recoge con las manos; lo que se recoge con una herramienta
// si esa herramienta se puede tener; lo que da talar (con un hacha que se pueda tener) y trocear; lo que se fabrica si
// todo lo que gasta y su estación se pueden tener; y vuelta a empezar hasta que no sale nada nuevo. Con eso:
//  1. La casa humilde (GDD, revisión del 1 nov) se puede hacer entera: un cimiento, postes, muros, un tejado y una
//     puerta, cada uno con alguna de sus piezas hecha solo con lo que se consigue. Esto no tiene excepciones.
//  2. Cada pieza y cada mueble que el menú de construir enseña en este tramo, cada estación y cada receta, o se puede
//     hacer, o está en PENDIENTES con la tarea viva del roadmap que le dará su origen (que exista y no esté hecha).
//  3. Lo esencial de cada hito vivo (ESENCIAL) se puede tener, o espera en PENDIENTES con su tarea viva.
//  4. Nada sobra en PENDIENTES (lo que ya se puede hacer sale de la lista).
// Uso: node pruebas/prueba_origenes.mjs
//      MUTAR=1 → como si los juncos no se pudieran cortar (sin tejado de la casa humilde: tiene que fallar)
//      MUTAR=2 → como si la tarea de lo pendiente ya estuviera hecha (tiene que fallar)
//      MUTAR=3 → como si la empalizada siguiera escondida (tiene que fallar)
//      MUTAR=4 → como si el pico no rompiera las rocas grandes (sin bloques de piedra: tiene que fallar)
import { readFileSync } from 'fs';
import { PIEZAS, DECORACION, enEsteTramo } from '../src/logica/piezas.js';
import { OBJETO_DE_MATERIAL } from '../src/logica/inventario.js';
import { RECOLECTABLES, HERRAMIENTAS_RECOGER, PICOS, MAZOS } from '../src/logica/recoleccion.js';
import { HACHAS, DA, DESCORTEZAR_CON, SANGRAR_CON, cortezaDe } from '../src/logica/tala.js';
import { TROCEO, MODOS_TROCEO } from '../src/logica/troceo.js';
import { RECETAS, ESTACIONES, USOS } from '../src/logica/fabricacion.js';
import { REPARAR, reparacionDe } from '../src/logica/desgaste.js';
import { PRENDAS } from '../src/logica/prendas.js';

const MUTAR = process.env.MUTAR;
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { if (c) bien++; else mal++; console.log(`${c ? '  OK   ' : '  FALLA'} ${t}${d ? ' — ' + d : ''}`); };

// La casa humilde (GDD: «cimiento de piedra, postes de tronco delgado, muros de tronco delgado o de zarzo con barro,
// tejado de juncos o de paja y puerta de varas»): cada parte, con las piezas que valen para ella.
const CASA_HUMILDE = {
  cimiento: ['cim_piedra'],
  postes: ['poste'],
  muros: ['muro_tronco', 'muro_zarzo'],
  'muro con puerta': ['muro_tronco_puerta', 'muro_zarzo_puerta'],   // (8 nov: también de barro)
  tejado: ['tejado_juncos', 'tejado_paja'],
  puerta: ['puerta_varas'],
};
// Lo que aún no tiene de dónde salir: por qué, y la tarea viva del roadmap que se lo dará (un trozo de su nombre).
// (la paja, desde el 13 nov, sale de trillar las gavillas en la era: P11)
// (8 nov: vacío. El mimbre, la resina y la corteza ya salen del mundo; 9 nov: la piel, de despiezar la liebre que se
// caza con la lanza, y con ella vuelven la honda y el odre)
const PENDIENTES = {
  // P9, Oficios del asentamiento (planificado el 13 nov): lo que deja hecho, en ESENCIAL; cada tarea, al hacerlo, lo quita de aquí
  // P11, la granja básica (planificada el 13 nov, con el estudio diseno/estudios/granja.html)
  // P10, Hierro y tablas (planificado el 13 nov): el primer mineral, el de pantano (el pico ya pide hierro)
  // (20 nov: la teja sale del horno cerámico, de cocer arcilla)
};
// Lo que cada hito vivo tiene que dejar hecho (la cadena de cada cosa, al planificarlo; CLAUDE.md, paso 4): se puede
// tener partiendo de nada, o espera en PENDIENTES con su tarea viva. Antes de pasar el hito a revisión (paso 9), nada
// suyo puede quedar en PENDIENTES. Las estaciones, con «est_» delante.
const ESENCIAL = {
  oficios: ['est_secadero', 'carne_seca', 'est_raspador', 'piel_limpia', 'zurron', 'agua', 'corteza_roble', 'est_cubas_curtido',
    'cuero', 'huso', 'hilo', 'zapatos_cuero', 'cinto_cuero', 'est_carbonera', 'carbon'],
  granja: ['semilla_cebada', 'habas', 'semilla_col', 'semilla_nabo', 'estaca', 'gavilla', 'col', 'nabo', 'est_era', 'paja', 'grano_sucio', 'criba_grano'],   // (el grano de cebada es su semilla: semilla_cebada)
  lluvia: ['cubo', 'cubo_agua', 'col', 'nabo', 'est_pozo'],   // (regar el huerto: el cubo lleno en el río, y la col y el nabo que se riegan)
  'casa-fuerte': ['tronco_largo', 'rodaja', 'carretilla'],   // (P11c; sus piezas, en PIEZAS_ESENCIALES)
  canoa: ['canoa', 'remo'],   // (P11d)
  hierro: ['criba', 'mineral_hierro', 'est_horno_reduccion', 'lupia', 'fuelle', 'est_fragua', 'barra_hierro', 'mango', 'hacha_hierro',
    'pico', 'clavo', 'sierra', 'tabla', 'bloque_piedra', 'arcilla', 'est_horno_ceramico', 'teja'],
};
// Las piezas de construir que cada hito vivo deja a la vista en el menú, con todo su coste saliendo del mundo.
const PIEZAS_ESENCIALES = {
  'casa-fuerte': ['empalizada', 'empalizada_puerta', 'muro_entramado', 'muro_entramado_puerta', 'muro_entramado_ventana'],   // (P11c)
  hierro: ['tejado_teja', 'remate_teja'],   // (P10: con las tejas del horno cerámico)
};
if (MUTAR === '3') delete PIEZAS.empalizada.destapada;

// ---- lo que se puede tener, partiendo de nada ----
const hay = new Set(), como = {};   // tipo del catálogo → cómo se consigue (la primera vez)
const poner = (t, c) => { if (!hay.has(t)) { hay.add(t); como[t] = c; return true; } return false; };
const tieneAlguna = l => l.some(t => hay.has(t));
const recolectables = { ...RECOLECTABLES };
if (MUTAR === '1') delete recolectables.juncos;
const estacionHecha = e => Object.keys(ESTACIONES[e].coste).every(t => hay.has(t)) && (ESTACIONES[e].requiere || []).every(t => hay.has(t));
for (let nuevo = true; nuevo;) {
  nuevo = false;
  for (const [k, r] of Object.entries(recolectables))
    if ((r.con === 'manos' || tieneAlguna(HERRAMIENTAS_RECOGER[r.con] || [])) && (r.tambien || []).every(t => hay.has(t)) && poner(r.da, `se recoge (${k})`)) nuevo = true;
  for (const [edad, d] of Object.entries(DA))
    if (tieneAlguna(Object.keys(HACHAS))) { if (poner(d.tronco, `talar un árbol ${edad}`)) nuevo = true; if (poner(d.menudo, `talar un árbol ${edad}`)) nuevo = true; }
  // lo que da el árbol en pie (8 nov): la corteza, descortezándolo; la resina, sangrando un pino o un abeto
  if (tieneAlguna(DESCORTEZAR_CON) && poner('corteza', 'descortezar un árbol en pie')) nuevo = true;
  // (17 nov) el roble da su corteza, la de curtir (src/logica/tala.js, cortezaDe); los robles, en los bosques templados
  if (tieneAlguna(DESCORTEZAR_CON) && poner(cortezaDe('roble'), 'descortezar un roble en pie')) nuevo = true;
  // el cubo lleno (P11b, regar el huerto): el cubo vacío en la mano, junto al río (src/logica/campos.js, llenarCubo)
  if (hay.has('cubo') && poner('cubo_agua', 'llenar el cubo en el río')) nuevo = true;
  // (17 nov) el agua de las cubas: la del cubo lleno (se vacía en ellas; mientras no las haya, en cualquier sitio)
  if (hay.has('cubo_agua') && poner('agua', 'el cubo lleno en el río')) nuevo = true;
  // el pozo (P11b; src/logica/pozo.js): se cava con la pala de madera, se reviste de piedra y se remata con el brocal
  // de piedra y el travesaño de varas con su cuerda; de él se saca agua con el cubo
  if (['pala_madera', 'piedra', 'vara', 'cuerda'].every(t => hay.has(t)) && poner('est_pozo', 'cavar, revestir y rematar un pozo')) nuevo = true;
  if (tieneAlguna(SANGRAR_CON) && poner('resina', 'sangrar un pino o un abeto')) nuevo = true;
  // romper rocas (src/logica/recoleccion.js): las medianas con el mazo dan piedra; las grandes, con el pico (la cantera,
  // 19 nov), bloques de piedra en bruto y piedra
  if (tieneAlguna([...MAZOS, ...PICOS]) && poner('piedra', 'romper una roca')) nuevo = true;
  if (MUTAR !== '4' && tieneAlguna([...PICOS]) && poner('bloque_piedra', 'romper una roca grande con el pico')) nuevo = true;
  // las vetas pequeñas de hierro en la roca (19 nov; src/logica/vetas_hierro.js): con el pico, mineral de hierro
  if (tieneAlguna([...PICOS]) && poner('mineral_hierro', 'picar una veta de hierro con el pico')) nuevo = true;
  // la canoa de un tronco (P11d; src/logica/canoa.js): el tronco largo, vaciado a golpes de hacha y con brasas de una hoguera
  if (hay.has('tronco_largo') && tieneAlguna(Object.keys(HACHAS)) && hay.has('est_hoguera') && poner('canoa', 'vaciar un tronco largo con el hacha y las brasas de la hoguera')) nuevo = true;
  // la caza (9 nov; en el modo arma, src/logica/arma_mano.js): lanzando la lanza endurecida, la liebre (entera, para despiezarla)
  if (tieneAlguna(['lanza_endurecida']) && poner('liebre', 'cazar lanzando la lanza')) nuevo = true;
  // la granja (P11): el campo se marca con estacas y se labra con la azada; se siembra lo silvestre y, maduro, la cebada
  // se siega con la hoz (gavillas) y la col y el nabo se cogen a mano
  const campo = hay.has('estaca') && tieneAlguna(['azada']);
  if (campo && hay.has('semilla_cebada') && tieneAlguna(['hoz_silex']) && poner('gavilla', 'segar la cebada sembrada')) nuevo = true;
  if (campo && hay.has('semilla_col') && poner('col', 'coger la col sembrada')) nuevo = true;
  if (campo && hay.has('semilla_nabo') && poner('nabo', 'coger el nabo sembrado')) nuevo = true;
  for (const [t, d] of Object.entries(TROCEO)) if (hay.has(t) && tieneAlguna(Object.keys(HACHAS)) && poner(d.da, `${d.accion} un ${t}`)) nuevo = true;
  // los otros modos de trocear (P11c): la rodaja del tronco largo, con el resto en troncos cortos
  for (const modo of Object.values(MODOS_TROCEO)) for (const [t, d] of Object.entries(modo))
    if (hay.has(t) && tieneAlguna(Object.keys(HACHAS))) { if (poner(d.da, `cortar la ${d.da} de un ${t}`)) nuevo = true; if (d.resto && poner(d.resto, `cortar la ${d.da} de un ${t}`)) nuevo = true; }
  for (const [e, d] of Object.entries(ESTACIONES)) if (estacionHecha(e) && poner('est_' + e, 'se levanta')) nuevo = true;
  for (const [k, r] of Object.entries(RECETAS)) {
    if (r.fuera) continue;   // (fuera del tramo: no se enseña ni se hace)
    const sitio = r.uso === 'manos' || (USOS[r.uso]?.estaciones || []).some(e => hay.has('est_' + e));
    if (sitio && Object.keys(r.gasta).every(t => hay.has(t)) && (!r.requiere || tieneAlguna(r.requiere))) {
      if (poner(r.da, `se fabrica (${k})`)) nuevo = true;
      for (const t of Object.keys(r.tambien || {})) if (poner(t, `se fabrica (${k}, además)`)) nuevo = true;
    }
  }
}
const sePuede = (coste) => Object.keys(coste).filter(m => !hay.has(OBJETO_DE_MATERIAL[m] || m));
console.log(`Se puede tener, sin arcón: ${[...hay].filter(t => !t.startsWith('est_')).sort().join(', ')}`);

// ---- 1. la casa humilde, entera ----
console.log('\nLa casa humilde');
for (const [parte, piezas] of Object.entries(CASA_HUMILDE)) {
  const vale = piezas.filter(p => PIEZAS[p] && !sePuede(PIEZAS[p].coste).length);
  ok(`${parte}: alguna pieza se hace solo con lo que se consigue`, vale.length > 0,
    vale.length ? vale.join(', ') : piezas.map(p => PIEZAS[p] ? `${p} sin ${sePuede(PIEZAS[p].coste).join(', ')}` : `${p} no existe`).join('; '));
}

// ---- 2. lo que se enseña en este tramo ----
const roadmap = JSON.parse(readFileSync(new URL('../proyecto/roadmap.json', import.meta.url), 'utf8'));
const tareas = roadmap.hitos.filter(h => h.estado !== 'congelado').flatMap(h => h.tareas || []);
const viva = (trozo) => { const t = tareas.find(x => x.nombre.includes(trozo)); return !!t && t.estado !== 'hecho' && MUTAR !== '2'; };
const falta = new Map();   // material o cosa sin origen → lo que la pide
const anotar = (quien, lista) => { for (const m of lista) { if (!falta.has(m)) falta.set(m, []); falta.get(m).push(quien); } };
for (const [k, d] of Object.entries(PIEZAS)) if (!d.oculta && enEsteTramo(d)) anotar(`pieza ${k}`, sePuede(d.coste));
for (const [k, d] of Object.entries(DECORACION)) if (enEsteTramo(d)) anotar(`mueble ${k}`, sePuede(d.coste));
for (const [k, d] of Object.entries(ESTACIONES)) anotar(`estación ${k}`, [...Object.keys(d.coste), ...(d.requiere || [])].filter(t => !hay.has(t)));
for (const [k, r] of Object.entries(RECETAS)) if (!r.fuera) anotar(`receta ${k}`, [...Object.keys(r.gasta), ...(r.requiere && !tieneAlguna(r.requiere) ? r.requiere : [])].filter(t => !hay.has(t)));
// reparar (10 nov; src/logica/desgaste.js): lo que se repara, con lo que gasta y lo que hay que llevar (la ropa, también)
for (const t of [...Object.keys(REPARAR), ...Object.keys(PRENDAS)]) {
  const rp = reparacionDe(t);
  if (rp) anotar(`reparar ${t}`, [...Object.keys(rp.gasta), ...(rp.requiere && !tieneAlguna(rp.requiere) ? rp.requiere : [])].filter(m => !hay.has(m)));
}
console.log('\nLo que el juego enseña ya');
for (const [m, quien] of falta) {
  const p = PENDIENTES[m];
  ok(`«${m}» sale de algún sitio o tiene su tarea viva`, !!p && viva(p[1]),
    `lo piden ${quien.join(', ')}${p ? ` · pendiente: ${p[0]} (tarea «${p[1]}»${viva(p[1]) ? '' : ': no existe o ya está hecha'})` : ' · no está en PENDIENTES'}`);
}
// ---- 3. lo esencial de cada hito vivo ----
const esencial = new Set();
console.log('\nLo que cada hito vivo deja hecho');
for (const [id, lista] of Object.entries(ESENCIAL)) {
  const hito = roadmap.hitos.find(x => x.id === id);
  if (!hito || hito.estado === 'congelado' || hito.estado === 'hecho') continue;
  for (const m of lista) {
    esencial.add(m);
    const p = PENDIENTES[m];
    ok(`${id}: «${m}» se puede tener o espera su tarea viva`, hay.has(m) || (!!p && viva(p[1])),
      hay.has(m) ? como[m] : p ? `pendiente: ${p[0]} (tarea «${p[1]}»${viva(p[1]) ? '' : ': no existe o ya está hecha'})` : 'no está en PENDIENTES');
  }
}
for (const [id, lista] of Object.entries(PIEZAS_ESENCIALES)) {
  const hito = roadmap.hitos.find(x => x.id === id);
  if (!hito || hito.estado === 'congelado' || hito.estado === 'hecho') continue;
  for (const k of lista) {
    const d = PIEZAS[k], sin = d ? sePuede(d.coste) : [];
    ok(`${id}: la pieza «${k}» se enseña en el menú y se hace con lo que sale del mundo`, !!d && enEsteTramo(d) && !sin.length,
      !d ? 'no existe' : !enEsteTramo(d) ? 'escondida' : sin.length ? `sin ${sin.join(', ')}` : Object.keys(d.coste).map(m => `${m}: ${como[OBJETO_DE_MATERIAL[m] || m]}`).join('; '));
  }
}
// ---- 4. nada sobra en PENDIENTES ----
for (const m of Object.keys(PENDIENTES)) ok(`«${m}», en PENDIENTES, de verdad aún no sale de ningún sitio`, falta.has(m) || (esencial.has(m) && !hay.has(m)));

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
