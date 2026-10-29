// Niveles de detalle de los personajes del taller (makehuman.js). Los niveles y cuándo se cambia salen de
// src/logica/detalle.js; aquí se hacen las versiones reducidas:
// - Menos triángulos: cada pieza se simplifica con meshoptimizer (el mismo de la compresión de los .glb) sobre sus
//   propios vértices, así que solo cambia la lista de triángulos: los pesos de los huesos, las formas de la cara y del
//   cuerpo y las UV siguen valiendo. Los bordes de cada pieza no se mueven (si no, se abrirían rendijas entre la piel y
//   la ropa). La lista reducida se calcula una vez por pieza y la comparten todos los personajes.
// - Lejos, todas las piezas que se ven se juntan en una sola malla con las texturas juntas en una (128 px por pieza) y
//   el color de cada una en los vértices: una sola llamada de dibujo por personaje (y otra para su sombra). Sin ojos ni
//   calcos de pelo (de lejos no se ven), sin el dibujo de la tela ni el blasón (se apagan antes, por finos).
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import { NIVELES, OCULTO } from '../logica/detalle.js';
import { TALLER } from '../logica/prendas.js';

// De lejos, con menos triángulos, una capa de debajo puede asomar por la de encima (la cota por la sobreveste, la
// manga de la camisa por la de la cota). En la malla de lejos, cada capa se mete hacia dentro un poco por cada capa
// que tiene encima (la de fuera nada); la piel, poco, porque la cara y las manos se ven.
const HUNDIR = 0.004; // m por capa
function capaDe(n) {
  const m = n.name.match(/_(capa|cinturon)_([a-z]+)/);
  if (!m) return /_(piel|pies)$/.test(n.name) ? 0 : null; // pelo, barba, orejas: no se mueven
  const k = TALLER.orden.indexOf(m[2]);
  if (k < 0) return 1; // calzas, zapatos, botas, tocados: justo sobre la piel
  return 2 + k + (m[1] === 'cinturon' ? 0.5 : 0);
}

const listo = MeshoptSimplifier.ready;
const reducidas = new WeakMap(); // índice original → [índice de cada nivel]
const atlas = new Map(); // piezas (nombres) → textura con todas juntas
const CELDA = 128, LADO = 4; // 4×4 piezas de 128 px: 512×512

const esCalco = (n) => /_(vello|barba_[a-z]+)$/.test(n.name);
const esOjo = (n) => /_(ojo|iris)_[lr]$/.test(n.name);

// la lista de triángulos de la pieza para un nivel (la original en el nivel 0)
function indiceDe(n, nivel) {
  const base = n.userData.indiceOriginal || (n.userData.indiceOriginal = n.geometry.index);
  if (!base || nivel === 0 || nivel >= OCULTO) return base;
  let r = reducidas.get(base);
  if (!r) reducidas.set(base, r = []);
  if (!r[nivel]) {
    const v = NIVELES[nivel];
    const pos = (n.userData.formas ? n.userData.formas.base : n.geometry.attributes.position);
    const p = pos.array instanceof Float32Array && pos.itemSize === 3 && !pos.isInterleavedBufferAttribute ? pos.array : Float32Array.from({ length: pos.count * 3 }, (_, i) => pos.getComponent(i / 3 | 0, i % 3));
    const ind = base.array instanceof Uint32Array ? base.array : Uint32Array.from(base.array);
    const objetivo = Math.floor(ind.length * v.proporcion / 3) * 3;
    const [res] = MeshoptSimplifier.simplify(ind, p, 3, objetivo, v.error, ['LockBorder']);
    r[nivel] = new THREE.BufferAttribute(base.array instanceof Uint16Array ? Uint16Array.from(res) : res, 1);
  }
  return r[nivel];
}

// la geometría de la pieza con la lista de triángulos del nivel (las mismas posiciones, normales, UV y huesos)
function geometriaNivel(n, nivel) {
  const g = n.userData.geoNivel || (n.userData.geoNivel = []);
  const actual = n.geometry;
  if (!n.userData.geoBase) n.userData.geoBase = actual;
  const base = n.userData.geoBase;
  if (nivel === 0) return base;
  // si la geometría de base cambia de posiciones (formas), las del nivel la comparten: mismo atributo
  if (!g[nivel] || g[nivel].attributes.position !== base.attributes.position) {
    const nueva = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(base.attributes)) nueva.setAttribute(k, a);
    nueva.setIndex(indiceDe(n, nivel));
    nueva.boundingSphere = base.boundingSphere; nueva.boundingBox = base.boundingBox;
    g[nivel] = nueva;
  }
  return g[nivel];
}

// textura con las piezas juntas; la misma para todos los personajes con las mismas piezas
function atlasDe(piezas) {
  const clave = piezas.map(n => n.material.map ? n.material.map.uuid : '-').join(',');
  if (atlas.has(clave)) return atlas.get(clave);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = CELDA * LADO;
  const c = lienzo.getContext('2d');
  piezas.forEach((n, i) => {
    const x = (i % LADO) * CELDA, y = Math.floor(i / LADO) * CELDA, img = n.material.map && n.material.map.image;
    if (img) c.drawImage(img, x, y, CELDA, CELDA);
    else { c.fillStyle = '#fff'; c.fillRect(x, y, CELDA, CELDA); }
  });
  const t = new THREE.CanvasTexture(lienzo);
  // sin mipmaps: en los más pequeños se mezclarían las piezas de al lado (de lejos, 128 px por pieza ya es poco)
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  atlas.set(clave, t);
  return t;
}

// la malla de lejos: todas las piezas que se ven, juntas, con la lista reducida y las texturas juntas
function juntar(mh, nivel) {
  const piezas = [];
  let principal = null;
  mh.modelo.traverse(n => {
    if (!n.isSkinnedMesh || !n.userData.visibleLogico || esCalco(n) || esOjo(n)) return;
    if (/_piel$/.test(n.name)) principal = n;
    piezas.push(n);
  });
  if (!principal) principal = piezas[0];
  if (!principal || piezas.length > LADO * LADO) return null;
  // un solo esqueleto: los huesos de todas las piezas, sin repetir
  const huesos = [], inversas = [], sitio = new Map();
  const indiceHueso = (n, k) => {
    const h = n.skeleton.bones[k];
    if (!sitio.has(h)) { sitio.set(h, huesos.length); huesos.push(h); inversas.push(n.skeleton.boneInverses[k].clone()); }
    return sitio.get(h);
  };
  const pos = [], nor = [], uv = [], col = [], si = [], sw = [], ind = [];
  const cortes = mh.corteDe || (() => -100);
  const rangos = piezas.map(capaDe);
  const orden = [...new Set(rangos.filter(r => r !== null))].sort((a, b) => a - b);
  piezas.forEach((n, p) => {
    const g = n.userData.geoBase || n.geometry, A = g.attributes, I = indiceDe(n, nivel);
    const cx = (p % LADO) / LADO, cy = Math.floor(p / LADO) / LADO;
    const c = n.material.color, corte = cortes(n), vc = n.material.vertexColors && A.color;
    const nuevo = new Map(), b = pos.length / 3;
    // la piel, solo un poco (la cara no puede quedar por detrás del pelo y las orejas)
    const hundir = rangos[p] === null ? 0 : rangos[p] === 0 ? Math.min(1.5, orden.length - 1) * HUNDIR : (orden.length - 1 - orden.indexOf(rangos[p])) * HUNDIR;
    const tomar = (v) => {
      if (nuevo.has(v)) return nuevo.get(v);
      const k = b + nuevo.size; nuevo.set(v, k);
      const nx = A.normal ? A.normal.getX(v) : 0, ny = A.normal ? A.normal.getY(v) : 1, nz = A.normal ? A.normal.getZ(v) : 0;
      pos.push(A.position.getX(v) - nx * hundir, A.position.getY(v) - ny * hundir, A.position.getZ(v) - nz * hundir);
      nor.push(nx, ny, nz);
      const u = A.uv ? THREE.MathUtils.clamp(A.uv.getX(v), 0, 1) : 0.5, w = A.uv ? THREE.MathUtils.clamp(A.uv.getY(v), 0, 1) : 0.5;
      // píxel y medio hacia dentro de la celda, para que no se cuele la de al lado
      const m = 1.5 / CELDA;
      uv.push(cx + (m + u * (1 - 2 * m)) / LADO, cy + (m + w * (1 - 2 * m)) / LADO);
      // el color de la pieza, por el de sus vértices si lo lleva (el cinturón)
      if (vc) col.push(c.r * vc.getX(v), c.g * vc.getY(v), c.b * vc.getZ(v)); else col.push(c.r, c.g, c.b);
      for (let k = 0; k < 4; k++) { si.push(indiceHueso(n, A.skinIndex.getComponent(v, k))); sw.push(A.skinWeight.getComponent(v, k)); }
      return k;
    };
    for (let t = 0; t < I.count; t += 3) {
      const a = I.getX(t), bb = I.getX(t + 1), cc = I.getX(t + 2);
      // la falda cortada (hechura): lo que queda por debajo del bajo no va
      if (corte > -50 && Math.max(A.position.getY(a), A.position.getY(bb), A.position.getY(cc)) < corte) continue;
      ind.push(tomar(a), tomar(bb), tomar(cc));
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(ind, 1) : new THREE.Uint16BufferAttribute(ind, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ map: atlasDe(piezas), vertexColors: true, roughness: 0.9, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide });
  const malla = new THREE.SkinnedMesh(geo, mat);
  malla.name = 'juntas_lejos';
  malla.castShadow = malla.receiveShadow = true; malla.frustumCulled = false;
  malla.position.copy(principal.position); malla.quaternion.copy(principal.quaternion); malla.scale.copy(principal.scale);
  principal.parent.add(malla);
  malla.bind(new THREE.Skeleton(huesos, inversas), principal.bindMatrix);
  malla.userData.piezas = new Set(piezas); malla.userData.triangulos = ind.length / 3;
  return malla;
}

// Pone en `mh` (lo que devuelve crearPersonajeMH): ponerNivel(n), nivel, triangulosNivel y cambiado() (para avisar de
// que han cambiado las capas, el aspecto, los tintes o la hechura y hay que volver a juntar la malla de lejos).
export function prepararDetalle(mh) {
  mh.nivel = 0;
  let juntas = null, sucio = true, pedido = 0;
  const quitarJuntas = () => { if (!juntas) return; juntas.parent.remove(juntas); juntas.geometry.dispose(); juntas.material.dispose(); juntas = null; };
  // la visibilidad que piden las capas se guarda aparte: el nivel solo esconde
  const aplicar = () => {
    const n = mh.nivel, v = NIVELES[Math.min(n, NIVELES.length - 1)];
    mh.raiz.visible = n < OCULTO;
    if (n >= OCULTO) return;
    if (v.juntar && (sucio || !juntas)) { quitarJuntas(); juntas = juntar(mh, n); sucio = false; }
    const usarJuntas = v.juntar && juntas;
    let tri = 0;
    mh.modelo.traverse(o => {
      if (!o.isMesh || o === juntas) return;
      const ver = o.userData.visibleLogico && !(usarJuntas && juntas.userData.piezas.has(o)) && (v.ojos || !esOjo(o)) && (v.calcos || !esCalco(o));
      o.visible = ver;
      if (ver && o.geometry.index) { o.geometry = geometriaNivel(o, n); tri += o.geometry.index.count / 3; }
    });
    if (juntas) juntas.visible = !!usarJuntas;
    if (usarJuntas) tri += juntas.userData.triangulos;
    mh.triangulosNivel = tri;
  };
  mh.ponerNivel = (n) => {
    pedido = n;
    if (n === mh.nivel && !(sucio && NIVELES[n]?.juntar)) return;
    mh.nivel = n;
    return listo.then(() => { if (pedido === n) aplicar(); });
  };
  // las capas, el aspecto, los tintes y la hechura cambian lo que se ve, la forma o el color: antes, cada pieza vuelve a
  // lo que se ve de verdad; después, eso se apunta y se vuelve a aplicar el nivel (la malla de lejos se rehace)
  const restaurar = () => mh.modelo.traverse(o => { if (o.isMesh && o !== juntas && 'visibleLogico' in o.userData) o.visible = o.userData.visibleLogico; });
  const cambiado = () => {
    sucio = true;
    mh.modelo.traverse(o => { if (o.isMesh && o !== juntas) o.userData.visibleLogico = o.visible; });
    if (mh.nivel !== 0) listo.then(aplicar);
    else quitarJuntas();
  };
  for (const k of ['ponerCapas', 'ponerAspecto', 'ponerTintes', 'ponerHechuras']) {
    const f = mh[k]; if (!f) continue;
    mh[k] = (...a) => { restaurar(); const r = f(...a); cambiado(); return r; };
  }
  cambiado();
  return listo;
}
