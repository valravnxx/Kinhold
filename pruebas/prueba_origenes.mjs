// De dónde sale cada cosa (valravnx, 7 nov: «si se ha hecho el paso a paso… no se ha tenido en cuenta el maldito techo?»
// y «añade pasos de revisiones o lo que sea para que jamas se escurran estas cosas con temas tan esenciales»).
// Sigue la cadena entera desde el mundo, sin arcón: lo que se recoge con las manos; lo que se recoge con una herramienta
// si esa herramienta se puede tener; lo que da talar (con un hacha que se pueda tener) y trocear; lo que se fabrica si
// todo lo que gasta y su estación se pueden tener; y vuelta a empezar hasta que no sale nada nuevo. Con eso:
//  1. La casa humilde (GDD, revisión del 1 nov) se puede hacer entera: un cimiento, postes, muros, un tejado y una
//     puerta, cada uno con alguna de sus piezas hecha solo con lo que se consigue. Esto no tiene excepciones.
//  2. Cada pieza y cada mueble que el menú de construir enseña en este tramo, cada estación y cada receta, o se puede
//     hacer, o está en PENDIENTES con la tarea viva del roadmap que le dará su origen (que exista y no esté hecha).
//  3. Nada sobra en PENDIENTES (lo que ya se puede hacer sale de la lista).
// Uso: node pruebas/prueba_origenes.mjs
//      MUTAR=1 → como si los juncos no se pudieran cortar (sin tejado de la casa humilde: tiene que fallar)
//      MUTAR=2 → como si la tarea de lo pendiente ya estuviera hecha (tiene que fallar)
import { readFileSync } from 'fs';
import { PIEZAS, DECORACION, enEsteTramo } from '../src/logica/piezas.js';
import { OBJETO_DE_MATERIAL } from '../src/logica/inventario.js';
import { RECOLECTABLES, HERRAMIENTAS_RECOGER } from '../src/logica/recoleccion.js';
import { HACHAS, DA, DESCORTEZAR_CON, SANGRAR_CON } from '../src/logica/tala.js';
import { TROCEO } from '../src/logica/troceo.js';
import { RECETAS, ESTACIONES, USOS } from '../src/logica/fabricacion.js';
import { SE_LANZA } from '../src/logica/caza.js';

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
// (la paja no está aquí: sale del cereal, que no hay en este tramo, y lo que la pide se esconde del menú como lo de
// después: src/logica/piezas.js, MATERIALES_POSTERIORES)
// (8 nov: vacío. El mimbre, la resina y la corteza ya salen del mundo; 9 nov: la piel, de despiezar la liebre que se
// caza con la lanza, y con ella vuelven la honda y el odre)
const PENDIENTES = {};

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
    if ((r.con === 'manos' || tieneAlguna(HERRAMIENTAS_RECOGER[r.con] || [])) && poner(r.da, `se recoge (${k})`)) nuevo = true;
  for (const [edad, d] of Object.entries(DA))
    if (tieneAlguna(Object.keys(HACHAS))) { if (poner(d.tronco, `talar un árbol ${edad}`)) nuevo = true; if (poner(d.menudo, `talar un árbol ${edad}`)) nuevo = true; }
  // lo que da el árbol en pie (8 nov): la corteza, descortezándolo; la resina, sangrando un pino o un abeto
  if (tieneAlguna(DESCORTEZAR_CON) && poner('corteza', 'descortezar un árbol en pie')) nuevo = true;
  if (tieneAlguna(SANGRAR_CON) && poner('resina', 'sangrar un pino o un abeto')) nuevo = true;
  // la caza (9 nov; src/logica/caza.js): con una lanza que se pueda tener, la liebre (entera, para despiezarla)
  if (tieneAlguna([...SE_LANZA]) && poner('liebre', 'cazar con la lanza')) nuevo = true;
  for (const [t, d] of Object.entries(TROCEO)) if (hay.has(t) && tieneAlguna(Object.keys(HACHAS)) && poner(d.da, `${d.accion} un ${t}`)) nuevo = true;
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
console.log('\nLo que el juego enseña ya');
for (const [m, quien] of falta) {
  const p = PENDIENTES[m];
  ok(`«${m}» sale de algún sitio o tiene su tarea viva`, !!p && viva(p[1]),
    `lo piden ${quien.join(', ')}${p ? ` · pendiente: ${p[0]} (tarea «${p[1]}»${viva(p[1]) ? '' : ': no existe o ya está hecha'})` : ' · no está en PENDIENTES'}`);
}
// ---- 3. nada sobra en PENDIENTES ----
for (const m of Object.keys(PENDIENTES)) ok(`«${m}», en PENDIENTES, de verdad aún no sale de ningún sitio`, falta.has(m));

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
