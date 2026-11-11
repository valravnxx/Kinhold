// Kinhold — los objetos que manda valravnx hechos en Meshy (11 nov: «los muebles te los iré enviando yo»; aquí solo se
// meten en el juego), en lugar de los de código: el acopio de troncos y el mojón (docs/recursos/estaciones-meshy-v1/,
// preparados con herramientas/meshy/preparar_mueble.mjs: pocos triángulos, texturas de 1024 y meshopt).
// Cada uno se carga una vez y cada vez que sale lleva una copia (la malla y el material, compartidos: no se liberan).
// Hasta que llega, el de código; al llegar se cambia, salvo el fantasma de poner, ya velado.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const MESHY_OBJETOS = {
  acopio_troncos: 'estaciones-meshy-v1/acopio_troncos.glb',   // estacas en x ±0,69 y z ±0,45; durmientes en el suelo, 0,10 de alto
  mojon: 'estaciones-meshy-v1/mojon.glb',                     // 1,6 m de alto con la estaca; el parche de tierra, 1,3 m
};
const cargas = new Map();
// La carpeta: la de los recursos publicados (../../recursos/ desde docs/jugar/<prototipo>/) o la de ?recursos_meshy=.
function carpeta() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('recursos_meshy') : null;
  return q || '../../recursos/';
}
export function cargarMeshy(cual) {
  if (!cargas.has(cual)) {
    const c = { escena: null, promesa: null };
    c.promesa = (typeof document === 'undefined' ? Promise.reject(new Error('sin navegador'))
      : new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(carpeta() + MESHY_OBJETOS[cual]))
      .then(g => {
        g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.geometry.userData.compartida = true; } });
        return (c.escena = g.scene);
      })
      .catch(e => { if (typeof document !== 'undefined') console.warn('[meshy] sin el modelo de', cual, e?.message || e); return null; });
    cargas.set(cual, c);
  }
  return cargas.get(cual);
}
export const precargarMeshy = () => Promise.all(Object.keys(MESHY_OBJETOS).map(c => cargarMeshy(c).promesa));
export const hayMeshy = (cual) => !!cargarMeshy(cual).escena;
// Un grupo con el de Meshy si ya está; si no, con deCodigo() y el cambio al llegar (alLlegar(grupo) después).
export function conMeshy(cual, deCodigo, alLlegar) {
  const c = cargarMeshy(cual), g = new THREE.Group();
  if (c.escena) { g.add(c.escena.clone()); g.userData.meshy = true; return g; }
  g.add(deCodigo());
  c.promesa.then(escena => {
    if (!escena) return;
    if (g.userData.fantasma) return;   // el fantasma de poner, ya velado (main.js): se queda así hasta el siguiente
    g.clear(); g.add(escena.clone()); g.userData.meshy = true;
    if (alLlegar) alLlegar(g);
  });
  return g;
}
