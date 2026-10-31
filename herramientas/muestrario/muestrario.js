// Muestrario de piezas: pone en fila los modelos de la construcción (src/mundo/modelos.js) con la luz y el suelo del
// juego, para sacar fotos de cerca de cada pieza al pasarla al estilo elegido. Se empaqueta con esbuild y se abre con
// ?piezas=muro_tronco,muro_zarzo… (o ?deco=mesa,banco…). Expone window.__muestrario.foto(i, vista, ancho, alto).
import * as THREE from 'three';
import { prepararRenderer, crearAmbiente } from '../../src/mundo/ambiente.js';
import { suelo } from '../../src/mundo/decorado.js';
import { modeloPieza, decoracion, mojon } from '../../src/mundo/modelos.js';
import { modeloArma, modeloEscudo, modeloFlecha, modeloPoste, modeloDiana } from '../../src/combate/modelos.js';
import { modeloHacha, modeloPico } from '../../src/juego/personaje.js';
// ?armas=espada_larga,espada_escudo,palo,arco,escudo,flecha,poste,diana,hacha,pico: lo que se lleva en la mano, de pie sobre el suelo
const ARMAS = { escudo: () => modeloEscudo(), flecha: () => { const g = new THREE.Group(), f = modeloFlecha(); f.rotation.x = -Math.PI / 2; g.add(f); return g; },
  poste: modeloPoste, diana: () => modeloDiana(), hacha: modeloHacha, pico: modeloPico };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
prepararRenderer(renderer); document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const amb = crearAmbiente(escena, { alcance: 14, mapa: 2048 });
escena.add(suelo({ llano: 30, cerca: 20, lejos: 80 }));
const q = new URLSearchParams(location.search);
const lista = [...(q.get('piezas') || '').split(',').filter(Boolean).map(t => ['pieza', t]), ...(q.get('deco') || '').split(',').filter(Boolean).map(t => ['deco', t]),
  ...(q.get('armas') || '').split(',').filter(Boolean).map(t => ['arma', t])];
const SEP = 3.2, objetos = [];
lista.forEach(([clase, t], i) => {
  // «tipo@abierta»: con la hoja abierta (puertas y portillos); «mojon»: el mojón
  const [tipo, extra] = t.split('@');
  const o = clase === 'arma' ? (ARMAS[tipo] || (() => modeloArma(tipo)))() : clase !== 'pieza' ? decoracion(tipo) : tipo === 'mojon' ? mojon() : modeloPieza(tipo);
  if (clase === 'arma') { const g = new THREE.Group(); g.add(o); o.updateMatrixWorld(true); o.position.y = -new THREE.Box3().setFromObject(o).min.y; o.userData.pie = true; lista[i].obj = g; }
  if (extra === 'abierta' && o.getObjectByName('hoja')) o.getObjectByName('hoja').rotation.y = -Math.PI / 2;
  const raiz = lista[i].obj || o, sep = clase === 'arma' ? 1.2 : SEP;
  raiz.position.set((i - (lista.length - 1) / 2) * sep, 0, 0);
  raiz.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  escena.add(raiz); objetos.push(raiz);
});
const camara = new THREE.PerspectiveCamera(35, 1, 0.05, 300);
// vista: 'frente', 'tres' (tres cuartos), 'detras', 'cerca' (de cerca, a la altura de los ojos)
function foto(i, vista, ancho, alto) {
  renderer.setSize(ancho, alto, false); camara.aspect = ancho / alto; camara.updateProjectionMatrix();
  const c = i < 0 ? new THREE.Vector3() : objetos[i].position.clone();
  const caja = new THREE.Box3(); if (i < 0) objetos.forEach(o => caja.expandByObject(o)); else caja.setFromObject(objetos[i]);
  const tam = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
  const mano = i >= 0 && objetos[i].children[0]?.userData.pie; // lo de la mano es pequeño: más cerca
  const d = mano ? Math.max(tam.x, tam.y * 1.3, 0.5) * (vista === 'cerca' ? 1.0 : 1.5) + 0.4 : Math.max(tam.x, tam.y * 1.3, 1.2) * (vista === 'cerca' ? 1.0 : 1.7) + 1;
  const dir = { frente: [0, 0.35, 1], tres: [0.75, 0.45, 0.9], detras: [-0.6, 0.4, -1], cerca: [0.45, 0.15, 1] }[vista] || [0, 0.35, 1];
  camara.position.copy(centro).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
  camara.lookAt(centro);
  amb.seguir(c.x, c.z);
  renderer.render(escena, camara);
}
window.__muestrario = { listo: true, n: objetos.length, foto };
