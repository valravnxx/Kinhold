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
const casas = [
  casa(m, 2, 2, 'muro_tronco', 'tejado_paja', 'dos'),
  casa(m, 2, 1, 'muro_tabla', 'tejado_tablilla', 'dos'),
  casa(m, 1, 2, 'muro_zarzo', 'tejado_paja', 'una'),
  casa(m, 1, 2, 'muro_entramado', 'tejado_tablilla', 'una'),
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
  const dir = { frente: [0, 0.35, -1], tres: [0.75, 0.6, -0.9], detras: [-0.6, 0.5, 1], cerca: [0.9, 0.25, -0.6] }[vista] || [0, 0.35, -1];
  camara.position.copy(centro).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
  camara.lookAt(centro);
  amb.seguir(centro.x, centro.z);
  renderer.render(escena, camara);
}
window.__muestrario = { listo: true, n: objetos.length, foto };
