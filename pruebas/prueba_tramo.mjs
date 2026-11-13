// Lo de niveles posteriores, escondido (roadmap, hito «Jugar entre dos sin trampas»): el menú de construir solo enseña
// lo de este tramo. Ejecutar: node pruebas/prueba_tramo.mjs. Con MUTAR=1 se deja pasar todo: la prueba debe FALLAR.
import { PIEZAS, DECORACION, enEsteTramo as enTramo } from '../src/logica/piezas.js';

const enEsteTramo = process.env.MUTAR === '1' ? () => true : enTramo;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

const guardadas = ['tejado_teja', 'remate_teja', 'hogar', 'adarve', 'empalizada', 'empalizada_puerta', 'polea', 'polipasto', 'escalera_tabla'];
for (const k of guardadas) comprobar(`guardada para su nivel: ${PIEZAS[k].nombre}`, !enEsteTramo(PIEZAS[k]));
const caros = ['cama_madera', 'mesa', 'banco', 'arcon', 'barril', 'estanteria'];
for (const k of caros) comprobar(`mueble caro guardado: ${DECORACION[k].nombre}`, !enEsteTramo(DECORACION[k]));

// Lo de la casa humilde sigue a la vista: el mojón, cimientos, postes y vigas, muros de tronco y de zarzo, tejado de
// juncos, escalera de mano, andamio, puerta de varas, cercas y los muebles de tronco. Lo de paja, escondido del 7 al 13 nov;
// desde «La era y trillar» (P11) la paja sale de trillar y se enseña (pruebas/prueba_origenes.mjs).
const humildes = ['mojon', 'cim_piedra', 'cim_tronco', 'suelo_tronco', 'poste', 'viga', 'muro_zarzo', 'muro_zarzo_puerta', 'muro_zarzo_ventana', 'muro_tronco', 'muro_tronco_puerta',
  'muro_tronco_ventana', 'medio_muro', 'tejado_juncos', 'remate_juncos', 'escalera_mano', 'andamio', 'puerta_varas', 'cerca', 'cerca_portillo'];
for (const k of humildes) comprobar(`a la vista: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));
for (const k of ['taburete', 'estandarte']) comprobar(`mueble a la vista: ${DECORACION[k].nombre}`, enTramo(DECORACION[k]));
for (const k of ['tejado_paja', 'remate_paja']) comprobar(`a la vista, con la paja de la era: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));
for (const k of ['cama_paja', 'candil', 'alfombra']) comprobar(`mueble a la vista, con la paja de la era: ${DECORACION[k].nombre}`, enTramo(DECORACION[k]));

// Ninguna pestaña del menú se queda vacía.
for (const cat of ['tierra', 'base', 'estructura', 'muro', 'tejado', 'acceso', 'exterior'])
  comprobar(`la pestaña «${cat}» tiene algo`, Object.values(PIEZAS).some(d => d.cat === cat && enTramo(d)));
comprobar('la pestaña de muebles tiene algo', Object.values(DECORACION).some(d => enTramo(d)));

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
