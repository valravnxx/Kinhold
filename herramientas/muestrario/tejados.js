// Muestrario de tejados: casas pequeñas montadas con la lógica de construcción (src/logica/construccion.js) y dibujadas
// como en el juego (rellenos bajo el tejado, cumbrera, extremos), para sacar fotos de cerca de los tejados y los
// hastiales al pasarlos al estilo elegido. Se usa con fotos.py: python3 herramientas/muestrario/fotos.py <carpeta> casas=1
import * as THREE from 'three';
import { prepararRenderer, crearAmbiente } from '../../src/mundo/ambiente.js';
import { suelo } from '../../src/mundo/decorado.js';
import { modeloPieza, rellenoTejado, P } from '../../src/juego/modelos.js';
import { Mundo, centroLocal, geometriaTejados } from '../../src/logica/construccion.js';
import { PIEZAS, ALTURA } from '../../src/logica/piezas.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
prepararRenderer(renderer); document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const amb = crearAmbiente(escena, { alcance: 16, mapa: 2048 });
escena.add(suelo({ llano: 40, cerca: 24, lejos: 80 }));

function pieza(c, tipo, i, j, k, d = 0, dir = 0) {
  const p = { tipo, hueco: PIEZAS[tipo].hueco, i, j, k, dir, abierta: false };
  if (['e', 'b', 'g', 'p'].includes(p.hueco)) p.d = d;
  return { construccion: c, nueva: false, pieza: p };
}
// casa de nI×nJ casillas con muros de un tipo y tejado: 'dos' (dos aguas, cumbrera a lo largo de j) o 'una' (una caída hacia +j)
function casa(m, nI, nJ, muro, tejado, forma) {
  const c = { id: m.siguienteId++, ox: 0, oz: 0, rot: 0, piezas: new Map() };
  m.construcciones.push(c);
  const pon = (...a) => { const r = m.colocar(pieza(c, ...a)); if (!r.ok) console.error('no entra', a.join(' '), r.motivo); };
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) pon('cim_piedra', i, j, 0);
  for (let i = 0; i < nI; i++) { pon(i === 0 && muro === 'muro_tronco' ? 'muro_tronco_puerta' : muro, i, 0, 0, 0); pon(muro, i, nJ, 0, 0); }
  for (let j = 0; j < nJ; j++) { pon(muro, 0, j, 0, 1); pon(muro, nI, j, 0, 1); }
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) pon(tejado, i, j, 1, 0, forma === 'dos' ? (i < nI / 2 ? 3 : 1) : 0);
  return c;
}
// casa con la planta que se le pase (casillas) y el tejado pieza a pieza: [tipo, i, j, dir]
function casaPlanta(m, celdas, muro, tejado) {
  const c = { id: m.siguienteId++, ox: 0, oz: 0, rot: 0, piezas: new Map() };
  m.construcciones.push(c);
  const pon = (...a) => { const r = m.colocar(pieza(c, ...a)); if (!r.ok) console.error('no entra', a.join(' '), r.motivo); };
  const hay = new Set(celdas.map(x => x.join()));
  for (const [i, j] of celdas) pon('cim_piedra', i, j, 0);
  for (const [i, j] of celdas) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (hay.has([i + di, j + dj].join())) continue;
    const a = di === 1 ? [i + 1, j, 1] : di === -1 ? [i, j, 1] : dj === 1 ? [i, j + 1, 0] : [i, j, 0];
    pon(muro, a[0], a[1], 0, a[2]);
  }
  for (const [tipo, i, j, dir] of tejado) pon(tipo, i, j, 1, 0, dir);
  return c;
}
// a cuatro aguas (2×3): remates en las cuatro esquinas; en L: ala de 4×2 y ala de 2×2, con limatesa y limahoya
const CUATRO = (t, r) => [[r, 0, 0, 0], [r, 1, 0, 1], [r, 0, 2, 3], [r, 1, 2, 2], [t, 0, 1, 3], [t, 1, 1, 1]];
const PLANTA_2x3 = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
const EN_L = (t, r) => [[t, 0, 0, 0], [t, 1, 0, 0], [t, 2, 0, 0], [t, 0, 1, 2], [t, 1, 1, 2], [r, 3, 0, 1], [t, 3, 1, 1], [r, 2, 1, 3],
  [t, 2, 2, 3], [t, 2, 3, 3], [t, 3, 2, 1], [t, 3, 3, 1]];
const PLANTA_L = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [2, 3], [3, 3]];
function dibujar(c) {
  const g = new THREE.Group(), tj = geometriaTejados(c);
  for (const [key, p] of c.piezas) {
    const t = tj.get(key), o = modeloPieza(p.tipo, t), l = centroLocal(p);
    o.position.set(l.lx, p.k * ALTURA + (t ? t.arranque * P.subidaTejado : 0), l.lz);
    let ry = 0;
    if (['e', 'b', 'p', 'g'].includes(p.hueco) && p.d === 1) ry = -Math.PI / 2;
    if (p.hueco === 'r' || p.hueco === 'l') ry = -(p.dir || 0) * Math.PI / 2;
    o.rotation.y = ry;
    if (t) for (const rel of t.rellenos) o.add(rellenoTejado(rel, t.arranque));
    g.add(o);
  }
  return g;
}
const m = new Mundo(); m.colocarMojon(0, 0);
for (const k in m.materiales) m.materiales[k] = 1e6; // el muestrario no se queda sin material
const casas = [
  casa(m, 2, 2, 'muro_tronco', 'tejado_paja', 'dos'),
  casa(m, 2, 1, 'muro_tabla', 'tejado_tablilla', 'dos'),
  casa(m, 1, 2, 'muro_zarzo', 'tejado_paja', 'una'),
  casa(m, 1, 2, 'muro_entramado', 'tejado_tablilla', 'una'),
  casa(m, 2, 2, 'muro_tronco', 'tejado_teja', 'dos'),
  casa(m, 1, 2, 'muro_entramado', 'tejado_teja', 'una'),
  casaPlanta(m, PLANTA_2x3, 'muro_tronco', CUATRO('tejado_paja', 'remate_paja')),
  casaPlanta(m, PLANTA_L, 'muro_tabla', EN_L('tejado_tablilla', 'remate_tablilla')),
  casaPlanta(m, PLANTA_L, 'muro_entramado', EN_L('tejado_teja', 'remate_teja')),
  casaPlanta(m, PLANTA_L, 'muro_zarzo', EN_L('tejado_paja', 'remate_paja')),
  casaPlanta(m, PLANTA_2x3, 'muro_tabla', CUATRO('tejado_tablilla', 'remate_tablilla')),
  casaPlanta(m, [[0, 0], [1, 0], [0, 1], [1, 1]], 'muro_entramado', [['remate_teja', 0, 0, 0], ['remate_teja', 1, 0, 1], ['remate_teja', 0, 1, 3], ['remate_teja', 1, 1, 2]]),
];
const SEP = 9, objetos = [];
casas.forEach((c, n) => {
  const g = dibujar(c); g.position.set((n - (casas.length - 1) / 2) * SEP - 2, 0, -2);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  escena.add(g); objetos.push(g);
});
const camara = new THREE.PerspectiveCamera(35, 1, 0.05, 300);
function foto(i, vista, ancho, alto) {
  renderer.setSize(ancho, alto, false); camara.aspect = ancho / alto; camara.updateProjectionMatrix();
  const caja = new THREE.Box3(); if (i < 0) objetos.forEach(o => caja.expandByObject(o)); else caja.setFromObject(objetos[i]);
  const tam = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
  const d = Math.max(tam.x, tam.z, tam.y * 1.3) * (vista === 'cerca' ? 0.75 : i < 0 ? 0.9 : 1.5) + 1;
  const dir = { arriba: [0.05, 1, 0.05], izq: [-0.9, 0.6, -0.75], frente: [0, 0.35, -1], tres: [0.75, 0.6, -0.9], detras: [-0.6, 0.5, 1], cerca: [0.9, 0.25, -0.6] }[vista] || [0, 0.35, -1];
  camara.position.copy(centro).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
  camara.lookAt(centro);
  amb.seguir(centro.x, centro.z);
  renderer.render(escena, camara);
}
window.__muestrario = { listo: true, n: objetos.length, foto };
