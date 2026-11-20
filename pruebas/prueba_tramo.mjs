// Lo de niveles posteriores, escondido (roadmap, hito «Jugar entre dos sin trampas»): el menú de construir solo enseña
// lo de este tramo. Ejecutar: node pruebas/prueba_tramo.mjs. Con MUTAR=1 se esconde todo: la prueba debe FALLAR.
import { PIEZAS, DECORACION, enEsteTramo as enTramo } from '../src/logica/piezas.js';

const enEsteTramo = process.env.MUTAR === '1' ? () => false : enTramo;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// (20 nov, P10, «Las piezas de nivel 2 a la vista»: la tabla, el clavo y la barra de hierro ya salen del mundo, y el tramo
// pasa al nivel 2: lo que antes se guardaba se enseña. Lo de nivel 3, si lo hubiera, seguiría escondido.)
const nivel2 = ['suelo_tabla', 'muro_tabla', 'muro_tabla_puerta', 'muro_tabla_ventana', 'escalera_tabla', 'tejado_tablilla', 'remate_tablilla',
  'puerta_tabla', 'contraventana', 'trampilla', 'hogar', 'adarve', 'polea', 'polipasto'];
for (const k of nivel2) comprobar(`a la vista, de nivel 2: ${PIEZAS[k].nombre}`, enEsteTramo(PIEZAS[k]));
const muebles2 = ['cama_madera', 'mesa', 'banco', 'arcon', 'barril', 'estanteria'];
for (const k of muebles2) comprobar(`mueble de tablas a la vista: ${DECORACION[k].nombre}`, enEsteTramo(DECORACION[k]));
comprobar('lo de nivel 3 sigue escondido', !enEsteTramo({ nivel: 3, coste: { piedra: 1 } }));

// Lo de la casa humilde sigue a la vista: el mojón, cimientos, postes y vigas, muros de tronco y de zarzo, tejado de
// juncos, escalera de mano, andamio, puerta de varas, cercas y los muebles de tronco. Lo de paja, escondido del 7 al 13 nov;
// desde «La era y trillar» (P11) la paja sale de trillar y se enseña (pruebas/prueba_origenes.mjs).
const humildes = ['mojon', 'cim_piedra', 'cim_tronco', 'suelo_tronco', 'poste', 'viga', 'muro_zarzo', 'muro_zarzo_puerta', 'muro_zarzo_ventana', 'muro_tronco', 'muro_tronco_puerta',
  'muro_tronco_ventana', 'medio_muro', 'tejado_juncos', 'remate_juncos', 'escalera_mano', 'andamio', 'puerta_varas', 'cerca', 'cerca_portillo'];
for (const k of humildes) comprobar(`a la vista: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));
for (const k of ['taburete', 'estandarte']) comprobar(`mueble a la vista: ${DECORACION[k].nombre}`, enTramo(DECORACION[k]));
for (const k of ['tejado_paja', 'remate_paja']) comprobar(`a la vista, con la paja de la era: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));
// (20 nov, P10) el tejado y el remate de teja, con las tejas del horno cerámico
for (const k of ['tejado_teja', 'remate_teja']) comprobar(`a la vista, con las tejas del horno cerámico: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));
for (const k of ['cama_paja', 'candil', 'alfombra']) comprobar(`mueble a la vista, con la paja de la era: ${DECORACION[k].nombre}`, enTramo(DECORACION[k]));
// La empalizada (P11c, «La casa más fuerte»): de nivel 2, pero sale de 6 troncos delgados del árbol joven; se enseña.
comprobar('a la vista, de nivel 2 pero destapada: Empalizada', enTramo(PIEZAS.empalizada));
// Su portón sin hierro (P11c): 4 troncos delgados y 2 cuerdas, con goznes de madera y cuerda; también se enseña.
comprobar('a la vista, de nivel 2 pero destapada: Puerta de empalizada (sin hierro)', enTramo(PIEZAS.empalizada_puerta) && !PIEZAS.empalizada_puerta.coste.hierro);
// El muro de entramado (P11c), con su puerta y su ventana: troncos delgados, varas y barro; también se enseñan.
for (const k of ['muro_entramado', 'muro_entramado_puerta', 'muro_entramado_ventana']) comprobar(`a la vista, de nivel 2 pero destapado: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));

// Ninguna pestaña del menú se queda vacía.
for (const cat of ['tierra', 'base', 'estructura', 'muro', 'tejado', 'acceso', 'exterior'])
  comprobar(`la pestaña «${cat}» tiene algo`, Object.values(PIEZAS).some(d => d.cat === cat && enTramo(d)));
comprobar('la pestaña de muebles tiene algo', Object.values(DECORACION).some(d => enTramo(d)));

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
