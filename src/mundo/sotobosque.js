// Kinhold — el tocón viejo y el tronco caído del sotobosque (13 nov, el hito «El aspecto»): la madera muerta del bosque,
// donde el bosque no llega a tener árbol (dónde va cada uno lo dice la lógica: src/logica/vegetacion.js, «sotobosque»).
// Hechos por código con las mismas texturas que el tocón y los troncos de la tala (src/juego/tala.js, src/juego/suelo.js),
// pero viejos: la corteza más oscura, el corte gastado, roto y no de hacha, raíces que asoman y musgo encima. Los
// helechos, las ortigas, la hierba alta y los cantos del sotobosque son los de Meshy (src/mundo/naturaleza_meshy.js).
//
// Cada uno vuelve como { geo, mats } (una sola geometría con un grupo por textura), para dibujarlo instanciado.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from './estilos.js';
import { cil } from './decorado.js';

let cache = null;

// junta lo de un Lote con textura en una geometría con grupos, y su lista de materiales en el mismo orden
function juntar(L) {
  const grupos = L.cerrar(null, true), geos = [], mats = [];
  for (const [tex, lista] of Object.entries(grupos)) { geos.push(mergeGeometries(lista)); mats.push(materialTex(tex)); }
  const geo = mergeGeometries(geos, true);
  geo.computeBoundingSphere();
  return { geo, mats };
}

// El tocón viejo: unos 0,3 m de radio y 0,5 m de alto (a escala 1), la boca rota en picos (no el corte limpio del hacha),
// cuatro raíces que asoman y una mancha de musgo en un lado.
function toconViejo() {
  const L = new Lote({ rangoSuelo: 0.6, variacion: 0.08 });
  const r = 0.3, h = 0.42;
  L.add(cil(r * 0.9, r * 1.12, h, 10), 'corteza', 0, h / 2 - 0.06, 0);
  // la boca: el corte gastado, un poco más abajo que el borde, y tres picos de madera rota alrededor
  L.add(new THREE.CircleGeometry(r * 0.86, 10), 'corte', 0, h - 0.1, 0, { x: -Math.PI / 2 + 0.05 }, { sinSuelo: true, brillo: 0.7 });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.2 + 0.4, alto = 0.12 + 0.07 * k;
    L.add(new THREE.ConeGeometry(r * 0.3, alto, 4), 'corteza', Math.cos(a) * r * 0.62, h - 0.08 + alto / 2, Math.sin(a) * r * 0.62, { y: a }, { sinSuelo: true, plano: true });
  }
  // las raíces: conos tumbados que salen del pie y se meten en el suelo
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + 0.3, m = new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2 + 0.35));
    L.add(cil(0.015, r * 0.32, 0.5, 6), 'corteza', Math.cos(a) * r * 1.05, 0.02, Math.sin(a) * r * 1.05, m);
  }
  // el musgo: una media cáscara aplastada en un lado del pie
  L.add(new THREE.SphereGeometry(r * 0.75, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'hojaOsc', r * 0.55, 0.0, -r * 0.2, null, { escala: new THREE.Vector3(1, 0.45, 1.1), sinSuelo: true });
  return juntar(L);
}

// El tronco caído: 3,6 m de largo y 0,24 m de radio (a escala 1), tumbado a lo largo de X y algo hundido, una punta
// rota en pico y la otra con el pie y sus raíces al aire, dos muñones de rama y musgo por encima.
function troncoCaido() {
  const L = new Lote({ rangoSuelo: 0.5, variacion: 0.08 });
  const largo = 3.6, r = 0.24, tumbado = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  L.add(cil(r * 0.85, r, largo, 10), 'corteza', 0, r * 0.75, 0, tumbado);
  // la punta rota (hacia +X): un cono corto en pico
  L.add(new THREE.ConeGeometry(r * 0.85, 0.35, 6), 'corteza', largo / 2 + 0.16, r * 0.75, 0, new THREE.Matrix4().makeRotationZ(-Math.PI / 2), { plano: true });
  // el pie (hacia −X): más ancho, con el corte gastado y las raíces al aire
  L.add(cil(r * 1.05, r * 1.3, 0.4, 10), 'corteza', -largo / 2 - 0.15, r * 0.85, 0, tumbado);
  L.add(new THREE.CircleGeometry(r * 1.2, 10), 'corte', -largo / 2 - 0.36, r * 0.85, 0, { y: -Math.PI / 2 }, { sinSuelo: true, brillo: 0.65 });
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + 0.6, m = new THREE.Matrix4().makeRotationX(a).multiply(new THREE.Matrix4().makeRotationZ(0.5));
    L.add(cil(0.012, r * 0.3, 0.55, 5), 'corteza', -largo / 2 - 0.3, r * 0.85 + Math.sin(a) * r * 0.9, Math.cos(a) * r * 0.9, m);
  }
  // dos muñones de rama, hacia arriba y a un lado
  L.add(cil(0.03, 0.06, 0.4, 6), 'corteza', 0.5, r * 0.75 + r + 0.12, 0.05, { z: -0.5 });
  L.add(cil(0.025, 0.05, 0.32, 6), 'corteza', -0.7, r * 0.75 + 0.1, r + 0.1, { x: 1.1 });
  // el musgo: tiras aplastadas por encima del tronco
  for (const [x, l] of [[-0.9, 1.1], [0.7, 0.8]]) {
    L.add(new THREE.SphereGeometry(r * 0.9, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 'hojaOsc', x, r * 1.35, 0, null, { escala: new THREE.Vector3(l / (r * 1.8), 0.35, 0.95), sinSuelo: true });
  }
  return juntar(L);
}

export function modelosSotobosque() {
  return cache || (cache = { tocon: toconViejo(), tronco: troncoCaido() });
}
// lo que estorba al andar, a escala 1: el radio del tocón, y el tronco como tres círculos a lo largo de él
export const RADIO_TOCON = 0.42, LARGO_TRONCO = 3.6;
