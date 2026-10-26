// Mide los modelos de muro: todos deben llegar exactamente a la altura de planta,
// y los huecos de puerta y ventana deben quedar limpios.
import * as THREE from 'three';
import { modeloPieza, P } from '../src/juego/modelos.js';
import { PIEZAS, ALTURA } from '../src/logica/piezas.js';

let ok = 0, mal = 0;
// MUTAR=1 mete un tablón en el hueco de la puerta: la prueba de huecos tiene que fallar
if (process.env.MUTAR) P.anchoPuerta = 0.6;
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
// triángulos que se meten en el hueco (las piezas del estilo v5 van juntas en una malla por textura: se mira cada triángulo)
function hueco(tipo, x0, x1, y0, y1) {
  const g = modeloPieza(tipo); g.updateMatrixWorld(true);
  const dentro = [], v = new THREE.Vector3();
  g.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const b = new THREE.Box3();
      for (let k = 0; k < 3; k++) b.expandByPoint(v.fromBufferAttribute(p, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld));
      if (b.max.x > x0 + 0.02 && b.min.x < x1 - 0.02 && b.max.y > y0 + 0.02 && b.min.y < y1 - 0.02) dentro.push(`${o.name} ${r3(b.min.x)},${r3(b.min.y)}..${r3(b.max.x)},${r3(b.max.y)}`);
    }
  });
  return dentro.slice(0, 4);
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
function alturasTroncos(tipo) { return new Set(modeloPieza(tipo).userData.hiladas || []); }
const lisas = alturasTroncos('muro_tronco');
comprobar('Muro de troncos: diez hiladas', lisas.size === 10, [...lisas].join(' '));
for (const t of ['muro_tronco_puerta', 'muro_tronco_ventana']) {
  const otras = [...alturasTroncos(t)];
  comprobar(`${PIEZAS[t].nombre}: cada tronco a la misma altura que en el muro liso`, otras.every(y => lisas.has(y)), otras.filter(y => !lisas.has(y)).join(' '));
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
