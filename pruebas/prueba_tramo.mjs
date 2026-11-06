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
// paja, escalera de mano, andamio, puerta de varas, cercas y los muebles de paja o de tronco.
const humildes = ['mojon', 'cim_piedra', 'cim_tronco', 'suelo_tronco', 'poste', 'viga', 'muro_zarzo', 'muro_tronco', 'muro_tronco_puerta',
  'muro_tronco_ventana', 'medio_muro', 'tejado_paja', 'remate_paja', 'escalera_mano', 'andamio', 'puerta_varas', 'cerca', 'cerca_portillo'];
for (const k of humildes) comprobar(`a la vista: ${PIEZAS[k].nombre}`, enTramo(PIEZAS[k]));
for (const k of ['cama_paja', 'taburete', 'candil', 'alfombra', 'estandarte']) comprobar(`mueble a la vista: ${DECORACION[k].nombre}`, enTramo(DECORACION[k]));

// Ninguna pestaña del menú se queda vacía.
for (const cat of ['tierra', 'base', 'estructura', 'muro', 'tejado', 'acceso', 'exterior'])
  comprobar(`la pestaña «${cat}» tiene algo`, Object.values(PIEZAS).some(d => d.cat === cat && enTramo(d)));
comprobar('la pestaña de muebles tiene algo', Object.values(DECORACION).some(d => enTramo(d)));

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
