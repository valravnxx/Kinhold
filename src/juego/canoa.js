// Kinhold — cómo se ve la canoa de un tronco (P11d; la lógica, en src/logica/canoa.js). Con el estilo v5: madera con
// sus vetas y color por vértice, oclusión de contacto horneada (el Lote) y sombra.
//  - La canoa a medias, sin desbastar del todo: el tronco largo, con astillas alrededor (más cuantos más golpes).
//  - Desbastada: el casco con la corteza por fuera y la cara de arriba aplanada; el hueco, más hondo con cada vuelta
//    de brasas y raspado. Con las brasas echadas, el hueco negro de carbón y las brasas encendidas encima; raspando,
//    el fondo quemado.
//  - La canoa: el casco entero, vaciado, de madera desnuda por dentro y con las puntas macizas.
// Medidas (provisionales): 4,4 m de largo, 0,54 m de ancho y 0,38 m de hondo por fuera (cabe otro sentado).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { faseDe, VUELTAS, GOLPES_DESBASTAR, GOLPES_RASPAR } from '../logica/canoa.js';

export const LARGO_CANOA = 4.4, MANGA = 0.27, PUNTAL = 0.38, GRUESO = 0.045;
const QUEMADO = 0x4a3b30;

const az = (id, k) => { let h = 2166136261; for (const ch of id + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
const suave = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Una superficie de rejilla: f(i/N, j/M) → [x, y, z]; con índices y normales.
function rejilla(N, M, f) {
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) pos.push(...f(i / N, j / M));
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// El perfil del casco en s (−1 a 1, de punta a punta): ancho y hondo por fuera, la borda, y lo que deja el hueco.
const H = LARGO_CANOA / 2;
const anchoFuera = s => MANGA * Math.sqrt(Math.max(0, 1 - Math.abs(s) ** 3));
const hondoFuera = s => PUNTAL * (1 - 0.5 * s ** 4);
const borda = s => PUNTAL + 0.05 * s * s;          // la borda sube un poco hacia las puntas
const hueco = s => 1 - suave(0.78, 0.92, Math.abs(s));   // las puntas, macizas

// El casco: hondo (0: aplanado por arriba, sin hueco; 1: vaciado del todo). Devuelve las tres partes.
export function geometriasCasco(hondo) {
  const N = 28, M = 10;
  const fuera = rejilla(N, M, (a, b) => {
    const s = a * 2 - 1, f = b * Math.PI;
    return [s * H, borda(s) - hondoFuera(s) * Math.sin(f), anchoFuera(s) * Math.cos(f)];
  });
  const anchoDentro = s => Math.max(0, anchoFuera(s) - GRUESO) * hueco(s);
  const hondoDentro = s => hondo * Math.max(0, hondoFuera(s) - GRUESO) * hueco(s);
  const dentro = rejilla(N, M, (a, b) => {
    const s = a * 2 - 1, f = Math.PI - b * Math.PI;   // al revés: las caras miran adentro (arriba)
    return [s * H, borda(s) - hondoDentro(s) * Math.sin(f) + 0.001, anchoDentro(s) * Math.cos(f)];
  });
  // las dos bordas: de lo de fuera a lo de dentro, planas
  const bordas = [1, -1].map(l => rejilla(N, 1, (a, b) => {
    const s = a * 2 - 1, w = b ? anchoDentro(s) : anchoFuera(s);
    return [s * H, borda(s), l * w];
  }));
  // (las caras, hacia arriba: si la rejilla salió al revés, se le da la vuelta)
  for (const g of bordas) {
    if (g.attributes.normal.getY(0) >= 0) continue;
    const ix = g.index.array;
    for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    g.computeVertexNormals();
  }
  const [der, izq] = bordas;
  return { fuera, dentro, bordas: mergeGeometries([der.toNonIndexed(), izq.toNonIndexed()]) };
}

function mallas(L) {
  const grupos = L.cerrar(null, true), g = new THREE.Group();
  for (const [tex, geos] of Object.entries(grupos)) {
    const m = new THREE.Mesh(mergeGeometries(geos.map(x => (x.index ? x.toNonIndexed() : x))), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m);
  }
  return g;
}

// Astillas de madera alrededor (las del desbaste), de un azar fijo por objeto.
function astillas(L, n, id) {
  for (let i = 0; i < n; i++) {
    const x = (az(id, i) - 0.5) * LARGO_CANOA * 0.9, lado = az(id, i + 30) < 0.5 ? -1 : 1, z = lado * (0.3 + az(id, i + 60) * 0.5);
    const geo = new THREE.BoxGeometry(0.12 + az(id, i + 90) * 0.1, 0.018, 0.04 + az(id, i + 120) * 0.03);
    L.add(geo, az(id, i + 150) < 0.35 ? 'corteza' : 'corte', x, 0.04, z, { y: az(id, i + 180) * 6, z: (az(id, i + 210) - 0.5) * 0.5 }, { sinSuelo: true, tex: 'veta' });
  }
}

// El casco con lo que lleve: hondo (0 a 1), por dentro quemado o no, con brasas o no, con o sin corteza por fuera.
function casco(L, hondo, { quemado = false, corteza = true } = {}) {
  const c = geometriasCasco(hondo);
  L.add(c.fuera, corteza ? 'corteza' : 'madera', 0, 0, 0, null, { tex: corteza ? 'corteza' : 'veta', brillo: 1.25 });
  L.add(c.dentro, quemado ? QUEMADO : 'tabla', 0, 0, 0, null, { tex: 'veta', sinSuelo: true, brillo: quemado ? 1 : 1.1 });
  L.add(c.bordas, 'tabla', 0, 0, 0, null, { tex: 'veta', sinSuelo: true });
}

// Las brasas echadas en el hueco: trozos encendidos a lo largo, con luz propia (sin sombra).
function brasas(g, hondo, id) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a2010, emissive: 0xb03c14, emissiveIntensity: 0.6, roughness: 0.9 });
  const ceniza = new THREE.MeshStandardMaterial({ color: 0x5a524b, roughness: 1 });
  const y = PUNTAL - hondo * (PUNTAL - GRUESO);   // el fondo del hueco, en el centro
  // el lecho de brasas: una capa que brilla a lo largo del hueco
  const lecho = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshStandardMaterial({ color: 0x2c2420, emissive: 0x7a2a0c, emissiveIntensity: 0.35, roughness: 1 }));
  lecho.rotation.x = -Math.PI / 2; lecho.scale.set(LARGO_CANOA * 0.36, MANGA * 0.62, 1); lecho.position.set(0, y + 0.012, 0); lecho.name = 'brasa';
  g.add(lecho);
  for (let i = 0; i < 90; i++) {
    const x = (az(id, i + 400) - 0.5) * LARGO_CANOA * 0.66, z = (az(id, i + 430) - 0.5) * MANGA * 0.9 * Math.sqrt(1 - (2 * x / (LARGO_CANOA * 0.72)) ** 2);
    const r = 0.018 + az(id, i + 460) * 0.022;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), az(id, i + 490) < 0.55 ? mat : ceniza);
    m.position.set(x, y + r * 0.3, z); m.rotation.set(az(id, i + 520) * 6, az(id, i + 550) * 6, 0); m.scale.y = 0.6; m.name = 'brasa';
    g.add(m);
  }
  const luz = new THREE.PointLight(0xff8a3a, 1.2, 4, 2); luz.position.set(0, y + 0.3, 0); luz.name = 'luz_brasas'; g.add(luz);
}

// Lo hondo que va el hueco con lo hecho (0 tras desbastar; 1 con la última vuelta raspada).
export function hondoDe(v, ahora = Date.now()) {
  if (!v) return 0;
  const f = faseDe(v, ahora), paso = 1 / VUELTAS;
  const raspado = f === 'raspar' ? Math.min(1, v.golpes / GOLPES_RASPAR.piedra) : 0;
  return Math.min(1, 0.2 + (v.vuelta + raspado) * paso * 0.8);
}

// El modelo del suelo: la canoa a medias ({ cosa: { tipo: 'canoa_a_medias', vaciado } }) o la canoa.
export function modeloCanoa(o, troncoLargo, ahora = Date.now()) {
  const id = String(o.id), L = new Lote({ rangoSuelo: 0.5, variacion: 0.06 });
  if (o.cosa.tipo === 'canoa') {
    casco(L, 1, { corteza: false });
    return mallas(L);
  }
  const v = o.cosa.vaciado, f = faseDe(v, ahora);
  if (!v || f === 'desbastar') {   // aún es el tronco, con las astillas que suelta
    const g = troncoLargo();
    astillas(L, 4 + Math.round(18 * Math.min(1, (v ? v.golpes : 0) / GOLPES_DESBASTAR.piedra)), id);
    g.add(mallas(L));
    return g;
  }
  const hondo = hondoDe(v, ahora);
  casco(L, hondo, { quemado: f === 'quemando' || f === 'raspar' || v.vuelta > 0 });
  astillas(L, 22, id);
  const g = mallas(L);
  if (f === 'quemando') brasas(g, hondo, id);
  return g;
}
// Lo que cambia lo que se ve (para no rehacer el modelo si no cambia).
export function firmaCanoa(o, ahora = Date.now()) {
  const v = o.cosa.vaciado;
  if (!v) return '';
  const f = faseDe(v, ahora);
  return f + v.vuelta + (f === 'desbastar' ? ':' + Math.floor(v.golpes / 8) : f === 'raspar' ? ':' + Math.floor(v.golpes / 5) : '');
}
