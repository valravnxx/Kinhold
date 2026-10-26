// Muestrario de piezas: pone en fila los modelos de la construcción (src/juego/modelos.js) con la luz y el suelo del
// juego, para sacar fotos de cerca de cada pieza al pasarla al estilo elegido. Se empaqueta con esbuild y se abre con
// ?piezas=muro_tronco,muro_zarzo… (o ?deco=mesa,banco…). Expone window.__muestrario.foto(i, vista, ancho, alto).
import * as THREE from 'three';
import { prepararRenderer, crearAmbiente } from '../../src/mundo/ambiente.js';
import { suelo } from '../../src/mundo/decorado.js';
import { modeloPieza, decoracion } from '../../src/juego/modelos.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
prepararRenderer(renderer); document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const amb = crearAmbiente(escena, { alcance: 14, mapa: 2048 });
escena.add(suelo({ llano: 30, cerca: 20, lejos: 80 }));
const q = new URLSearchParams(location.search);
const lista = [...(q.get('piezas') || '').split(',').filter(Boolean).map(t => ['pieza', t]), ...(q.get('deco') || '').split(',').filter(Boolean).map(t => ['deco', t])];
const SEP = 3.2, objetos = [];
lista.forEach(([clase, t], i) => {
  const o = clase === 'pieza' ? modeloPieza(t) : decoracion(t);
  o.position.set((i - (lista.length - 1) / 2) * SEP, 0, 0);
  o.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  escena.add(o); objetos.push(o);
});
const camara = new THREE.PerspectiveCamera(35, 1, 0.05, 300);
// vista: 'frente', 'tres' (tres cuartos), 'detras', 'cerca' (de cerca, a la altura de los ojos)
function foto(i, vista, ancho, alto) {
  renderer.setSize(ancho, alto, false); camara.aspect = ancho / alto; camara.updateProjectionMatrix();
  const c = i < 0 ? new THREE.Vector3() : objetos[i].position.clone();
  const caja = new THREE.Box3(); if (i < 0) objetos.forEach(o => caja.expandByObject(o)); else caja.setFromObject(objetos[i]);
  const tam = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
  const d = Math.max(tam.x, tam.y * 1.3, 1.2) * (vista === 'cerca' ? 1.0 : 1.7) + 1;
  const dir = { frente: [0, 0.35, 1], tres: [0.75, 0.45, 0.9], detras: [-0.6, 0.4, -1], cerca: [0.45, 0.15, 1] }[vista] || [0, 0.35, 1];
  camara.position.copy(centro).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
  camara.lookAt(centro);
  amb.seguir(c.x, c.z);
  renderer.render(escena, camara);
}
window.__muestrario = { listo: true, n: objetos.length, foto };
