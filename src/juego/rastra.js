// Kinhold — la rastra en el juego (roadmap, hito «Equipo y carga»): el modelo con el estilo v5 y cómo va detrás del
// que la arrastra. La lógica (quién la arrastra, lo que lleva, dónde se queda) está en src/logica/rastra.js; el objeto
// es uno más del suelo (src/juego/suelo.js la dibuja con modeloRastra).
//
// El modelo: dos varas largas de 3,2 m (corteza, algo torcidas) que se juntan delante, donde se agarran, y se abren
// detrás, en el suelo; cuatro travesaños atados con cordel a las varas en la mitad de atrás, donde va la carga (los
// troncos cortos a lo largo, las piedras en montón o el bloque). Parada, descansa en el suelo; arrastrándola, las
// puntas de delante suben a las manos (a la altura de la cadera) y lo de atrás roza el suelo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { modelosRecoleccion } from './recoleccion.js';
import { DETRAS, DELANTE_CARRETILLA } from '../logica/rastra.js';
import { inclinarCarretilla, rodarCarretilla } from './carretilla.js';

export const LARGO_VARAS = 3.2;      // m
const ATRAS = 1.5;                    // del centro a las puntas de atrás (en el suelo)
const ANCHO_ATRAS = 0.46, ANCHO_DELANTE = 0.27, R_VARA = 0.035;
export const ALTO_MANOS = 0.86;       // m: a qué altura van las varas en las manos arrastrándola
const A_MANOS = ATRAS + DETRAS - 0.2;  // m: de las puntas de atrás a las manos (van un poco por detrás de la cadera)

export const mallas = L => {
  const grupos = L.cerrar(null, true), g = new THREE.Group();
  for (const [tex, geos] of Object.entries(grupos)) {
    const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m);
  }
  return g;
};
export const az = (id, k) => { let h = 2166136261; for (const ch of id + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
export const deLista = lista => { const g = new THREE.Group(); for (const { geo, mat } of lista) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); } return g; };

// una vara de (x0, z0) a (x1, z1) a la altura y, en tramos un poco quebrados (una rama larga, no un tubo)
export function vara(L, x0, z0, x1, z1, y, r, id, k) {
  const tramos = 3;
  let px = x0, pz = z0;
  for (let i = 1; i <= tramos; i++) {
    const f = i / tramos, d = i < tramos ? (az(id, k * 10 + i) - 0.5) * 0.035 : 0;
    const nx = x0 + (x1 - x0) * f + d, nz = z0 + (z1 - z0) * f;
    const largo = Math.hypot(nx - px, nz - pz), g = Math.atan2(nx - px, nz - pz);
    const rr = r * (1 - 0.18 * f);   // más delgada hacia delante (la punta de la rama)
    const m = new THREE.Matrix4().makeRotationY(g).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    L.add(cil(rr, rr * 1.06, largo + 0.02, 7), 'corteza', (px + nx) / 2, y, (pz + nz) / 2, m);
    px = nx; pz = nz;
  }
  // los cortes de las puntas
  for (const [x, z, s] of [[x0, z0, -1], [x1, z1, 1]]) {
    const g = Math.atan2(x1 - x0, z1 - z0);
    L.add(new THREE.CircleGeometry(r * (s > 0 ? 0.8 : 0.98), 7), 'corte', x + Math.sin(g) * s * 0.011, y, z + Math.cos(g) * s * 0.011,
      new THREE.Matrix4().makeRotationY(g + (s > 0 ? 0 : Math.PI)), { sinSuelo: true });
  }
}

// La rastra, con la cabeza (las puntas de delante) hacia +z y su centro en el origen. carga: { tipo, n } o null.
// Devuelve un grupo con hijo 'cuerpo' (lo que se inclina al arrastrarla: gira sobre las puntas de atrás).
export function modeloRastra(carga, id = 'r') {
  const L = new Lote({ rangoSuelo: 0.25, variacion: 0.07 });
  const zA = 0, zD = LARGO_VARAS;          // en el cuerpo: las puntas de atrás en z = 0, las de delante en z = 3
  const xEn = (s, z) => s * (ANCHO_ATRAS + (ANCHO_DELANTE - ANCHO_ATRAS) * (z / LARGO_VARAS));
  for (const s of [-1, 1]) vara(L, xEn(s, zA), zA, xEn(s, zD), zD, R_VARA, R_VARA, id, s + 2);
  // cuatro travesaños por encima de las varas, en la mitad de atrás, atados en cruz con cordel
  const travs = [0.25, 0.6, 0.95, 1.3];
  travs.forEach((z, i) => {
    const w = xEn(1, z) + 0.07, r = 0.022 + az(id, 30 + i) * 0.006, y = R_VARA * 2 + r * 0.6;
    const m = new THREE.Matrix4().makeRotationY((az(id, 40 + i) - 0.5) * 0.06).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    L.add(cil(r, r * 1.05, w * 2, 6), 'madera', 0, y, z, m);
    for (const s of [-1, 1]) {   // la atadura: dos vueltas de cordel en cada cruce
      for (const k of [-1, 1]) L.add(new THREE.TorusGeometry(0.04, 0.0065, 4, 9), 'lino', xEn(s, z) + k * 0.012, y - 0.01, z, { y: Math.PI / 2 + k * 0.5, x: 0.6 }, { sinSuelo: true, tex: 'tejido' });
    }
  });
  // las agarraderas: un trozo de cordel enrollado en cada punta de delante, donde van las manos
  const zM = A_MANOS + 0.05;
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++)
    L.add(new THREE.TorusGeometry(R_VARA * 0.95, 0.007, 4, 9), 'lino', xEn(s, zM - k * 0.025), R_VARA, zM - k * 0.025, { y: Math.atan2(-s * (ANCHO_ATRAS - ANCHO_DELANTE), LARGO_VARAS) }, { sinSuelo: true, tex: 'tejido' });
  const cuerpo = mallas(L);
  cuerpo.name = 'cuerpo';
  // la carga, sobre los travesaños
  const yC = R_VARA * 2 + 0.05;
  if (carga && carga.n > 0) {
    const C = new Lote({ rangoSuelo: 0.3, variacion: 0.07 });
    if (carga.tipo === 'tronco_corto') {  // a lo largo, dos abajo y uno encima
      const pos = [[-0.15, 0], [0.15, 0], [0, 1]].slice(0, Math.min(3, carga.n));
      pos.forEach(([x, fila], i) => {
        const r = 0.14, y = yC + r + fila * r * 1.7, z = 0.78 + (az(id, 60 + i) - 0.5) * 0.12;
        const m = new THREE.Matrix4().makeRotationY((az(id, 70 + i) - 0.5) * 0.08).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        C.add(cil(r, r * 1.04, 0.9, 9), 'corteza', x, y, z, m);
        for (const s of [-1, 1]) C.add(new THREE.CircleGeometry(r * 0.97, 9), 'corte', x, y, z + s * 0.452, new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI), { sinSuelo: true });
      });
    } else if (carga.tipo === 'tronco_delgado') {  // a lo largo, tres abajo y dos encima, con la punta de atrás por fuera
      const pos = [[-0.19, 0], [0, 0], [0.19, 0], [-0.095, 1], [0.095, 1]].slice(0, Math.min(5, carga.n));
      pos.forEach(([x, fila], i) => {
        const r = 0.09, largo = 2.6, y = yC + r + fila * r * 1.75, z = 0.75 + (az(id, 60 + i) - 0.5) * 0.15;
        const m = new THREE.Matrix4().makeRotationY((az(id, 70 + i) - 0.5) * 0.05).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        C.add(cil(r, r * 1.04, largo, 9), 'corteza', x, y, z, m);
        for (const s of [-1, 1]) C.add(new THREE.CircleGeometry(r * 0.97, 9), 'corte', x, y, z + s * (largo / 2 + 0.002), new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI), { sinSuelo: true });
      });
    } else if (carga.tipo === 'vara') {  // un haz de varas a lo largo, en dos capas
      const vis = Math.min(12, carga.n);
      for (let i = 0; i < vis; i++) {
        const fila = i < 7 ? 0 : 1, k = fila ? i - 7 : i, nf = fila ? 5 : 7, r = 0.018 + az(id, 90 + i) * 0.005;
        const x = (k - (nf - 1) / 2) * 0.05, y = yC + r + fila * 0.034, z = 0.75 + (az(id, 100 + i) - 0.5) * 0.2;
        const m = new THREE.Matrix4().makeRotationY((az(id, 110 + i) - 0.5) * 0.06).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        C.add(cil(r * 0.75, r, 1.6, 7), 'madera', x, y, z, m, { tex: 'veta' });
      }
    } else if (carga.tipo === 'bloque_piedra') {
      C.add(new THREE.DodecahedronGeometry(0.34, 0), 'piedra', 0, yC + 0.2, 0.75, { y: az(id, 80) * 6, x: 0.3 }, { escala: new THREE.Vector3(1.15, 0.62, 1.4), plano: true });
    }
    const g = mallas(C);
    if (carga.tipo === 'piedra') {   // un montón: más alto cuantas más
      const mods = modelosRecoleccion(), vis = Math.min(carga.n, 18);
      for (let i = 0; i < vis; i++) {
        const p = deLista(mods.piedra), capa = i < 8 ? 0 : i < 14 ? 1 : 2, a = i * 2.4 + az(id, i), r = [0.3, 0.18, 0.06][capa];
        p.position.set(Math.cos(a) * r * 0.8, yC + capa * 0.09, 0.75 + Math.sin(a) * r * 1.3);
        p.rotation.y = az(id, i + 20) * 6; p.scale.setScalar(0.85 + az(id, i + 40) * 0.3);
        g.add(p);
      }
    }
    g.name = 'carga';
    cuerpo.add(g);
  }
  const raiz = new THREE.Group();
  cuerpo.position.z = -ATRAS;
  raiz.add(cuerpo);
  return raiz;
}

// Inclina el cuerpo: arrastrando, las puntas de delante a la altura de las manos; parada, en el suelo.
export function inclinarRastra(raiz, arrastrando) {
  const c = raiz.getObjectByName('cuerpo');
  if (c) c.rotation.x = arrastrando ? -Math.asin(Math.min(0.9, (ALTO_MANOS - R_VARA) / A_MANOS)) : 0;
}

// Cada fotograma: las rastras que alguien arrastra van detrás de él, como de una cuerda (el centro, a DETRAS m de él;
// gira hacia donde tira). quien(autor) → { x, z, giro } o null (si no se le ve, se queda en su último sitio).
// altura(x, z): el terreno. Devuelve el sitio de cada una ({ id: { x, z } }), para soltarla donde se ve.
// La carretilla va delante, firme en las manos: su centro a DELANTE_CARRETILLA m, mirando hacia donde mira él, y la
// rueda rueda lo que avanza.
export function moverRastras(grupo, quien, altura) {
  const sitios = {};
  for (const obj of grupo.children) {
    if (obj.name === 'suelo_carretilla') { moverCarretilla(obj, quien, altura, sitios); continue; }
    if (obj.name !== 'suelo_rastra') continue;
    const autor = obj.userData.arrastra, p = autor ? quien(autor) : null;
    inclinarRastra(obj, !!p);
    if (!p) { delete obj.userData.sigue; continue; }
    let s = obj.userData.sigue;
    if (!s) s = obj.userData.sigue = { x: p.x - Math.sin(p.giro) * DETRAS, z: p.z - Math.cos(p.giro) * DETRAS };
    const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz) || 1;
    s.x = p.x + dx / d * DETRAS; s.z = p.z + dz / d * DETRAS;
    obj.position.set(s.x, altura(s.x, s.z) - 0.01, s.z);
    obj.rotation.set(0, Math.atan2(p.x - s.x, p.z - s.z), 0);
    sitios[obj.userData.id] = { x: s.x, z: s.z };
  }
  return sitios;
}

function moverCarretilla(obj, quien, altura, sitios) {
  const autor = obj.userData.arrastra, p = autor ? quien(autor) : null;
  inclinarCarretilla(obj, !!p);
  if (!p) { delete obj.userData.sigue; return; }
  // las agarraderas, para que las manos de quien la empuja vayan a ellas (src/juego/personaje.js)
  if (!obj.userData.agarraderas) { obj.userData.agarraderas = []; obj.traverse(n => { if (n.name === 'agarradera') obj.userData.agarraderas.push(n); }); }
  const x = p.x + Math.sin(p.giro) * DELANTE_CARRETILLA, z = p.z + Math.cos(p.giro) * DELANTE_CARRETILLA;
  const antes = obj.userData.sigue;
  if (antes) rodarCarretilla(obj, (x - antes.x) * Math.sin(p.giro) + (z - antes.z) * Math.cos(p.giro));
  obj.userData.sigue = { x, z };
  obj.position.set(x, altura(x, z) - 0.01, z);
  obj.rotation.set(0, p.giro, 0);
  sitios[obj.userData.id] = { x, z };
}
