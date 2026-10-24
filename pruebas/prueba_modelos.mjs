// Mide los modelos de muro: todos deben llegar exactamente a la altura de planta,
// y los huecos de puerta y ventana deben quedar limpios.
import * as THREE from 'three';
import { modeloPieza, P } from '../src/juego/modelos.js';
import { PIEZAS, ALTURA } from '../src/logica/piezas.js';

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const caja = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
const r3 = (x) => x.toFixed(3);

const muros = Object.entries(PIEZAS).filter(([, d]) => d.cat === 'muro');
console.log('Altura de cada muro');
for (const [tipo, def] of muros) {
  const b = caja(modeloPieza(tipo));
  const objetivo = def.medio ? ALTURA / 2 : ALTURA;
  comprobar(`${def.nombre}: arriba a ${objetivo} m`, Math.abs(b.max.y - objetivo) < 0.005, `arriba=${r3(b.max.y)} abajo=${r3(b.min.y)}`);
  comprobar(`${def.nombre}: abajo a 0 m`, Math.abs(b.min.y) < 0.005);
}

console.log('Huecos limpios');
function hueco(tipo, x0, x1, y0, y1) {
  const g = modeloPieza(tipo); g.updateMatrixWorld(true);
  const dentro = [];
  g.traverse(o => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    const solapaX = b.max.x > x0 + 0.02 && b.min.x < x1 - 0.02;
    const solapaY = b.max.y > y0 + 0.02 && b.min.y < y1 - 0.02;
    if (solapaX && solapaY) dentro.push(`${r3(b.min.y)}..${r3(b.max.y)}`);
  });
  return dentro;
}
const a = P.anchoPuerta / 2;
for (const t of ['muro_tronco_puerta', 'muro_tabla_puerta']) {
  const d = hueco(t, -a, a, 0, P.altoPuerta);
  comprobar(`${PIEZAS[t].nombre}: hueco de puerta libre hasta ${P.altoPuerta} m`, d.length === 0, d.join(' '));
}
const v = P.anchoVentana / 2;
const dv = hueco('muro_tronco_ventana', -v, v, P.bajoVentana + 0.05, P.altoVentana);
comprobar(`Muro con ventana: hueco libre de ${P.bajoVentana} a ${P.altoVentana} m`, dv.length === 0, dv.join(' '));

console.log('Hiladas alineadas entre muros de troncos');
function alturasTroncos(tipo) {
  const g = modeloPieza(tipo); g.updateMatrixWorld(true);
  const ys = new Set();
  g.traverse(o => {
    if (!o.isMesh || o.geometry.type !== 'CylinderGeometry') return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    // troncos horizontales: más largos en x que altos
    if (bb.max.x - bb.min.x > bb.max.y - bb.min.y) ys.add(o.position.y.toFixed(3));
  });
  return ys;
}
const lisas = alturasTroncos('muro_tronco');
for (const t of ['muro_tronco_puerta', 'muro_tronco_ventana']) {
  const otras = [...alturasTroncos(t)];
  comprobar(`${PIEZAS[t].nombre}: cada tronco a la misma altura que en el muro liso`, otras.every(y => lisas.has(y)), otras.filter(y => !lisas.has(y)).join(' '));
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
