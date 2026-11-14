// Kinhold — cómo se ven los campos marcados con estacas (P11; la lógica, en src/logica/campos.js).
// Cada estaca, clavada de pie con un cuarto de su largo en la tierra; y el linde, una franja estrecha de tierra pisada
// que va de estaca en estaca pegada al suelo (y de la última a la primera cuando el campo está cerrado). Todo se rehace
// cuando cambia el mundo de construcción (main.js, reconstruir).
// Lo sembrado (P11, «Sembrar y crecer»): las plantas, como la hierba densa, en instancias (una llamada de dibujo por
// cultivo y fase en cada campo), con su forma de cada fase (brote, verde, espiga o cabeza, maduro); de lejos no se
// dibujan y la tierra sembrada toma el color del cultivo. Al cambiar de fase, se rehace.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { estacaEn } from './modelos_objetos.js';
import { ladosDe, casillasLabradas, dentroPoligono, casillasVoleo, voleoEn, fase, siguienteCambio, conHierbas, escardadoEn } from '../logica/campos.js';

const ALTO_ESTACA = 1.15;      // m sobre el suelo: recias y altas, para que se vean entre la hierba
const GROSOR_ESTACA = 1.7;     // más gruesas que la de la mano (para leerlas de lejos como mojones de campo)
const HUNDIDA = 0.28;          // lo que va bajo tierra
const ALTO_CUERDA = 0.82;      // m: la cuerda de esparto atada de estaca en estaca marca el linde por encima de la hierba
const MAT_CUERDA = new THREE.MeshLambertMaterial({ color: 0xc9b483 });
const ANCHO_LINDE = 0.34;      // m: una banda de tierra pisada, bien visible (como los caminos de la referencia)
const HIERBAS_M2 = 2;          // matas de malas hierbas por m² de lo sembrado sin escardar (escardar, 14 nov)
const SOBRE = 0.03;            // m sobre el suelo (para que no parpadee con él)
const COLOR_LINDE = new THREE.Color(0x9a8566);   // el pardo cálido del camino (src/mundo/estilos.js)
const MAT_LINDE = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

// La tierra labrada (P11, «Labrar con la azada»): tierra parda recién volteada, con sus surcos (4 por metro) de lomo claro
// y fondo oscuro y terrones sueltos. Textura hecha en un lienzo una vez; se repite cada 2 m a lo largo y cada metro de través, en coordenadas del mundo,
// girada a lo largo del lado más largo del campo (así los surcos van rectos de una punta a otra).
let texLabrado = null;
function texturaLabrado() {
  if (texLabrado) return texLabrado;
  if (typeof document === 'undefined') return null;
  const N = 256, cv = document.createElement('canvas'); cv.width = N * 2; cv.height = N;   // 2 m a lo largo, 1 m de través
  const g = cv.getContext('2d');
  let s = 7; const az = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // el perfil del surco: lomo (claro) y fondo (oscuro), cuatro por metro, algo ondulados y desiguales (no de regla)
  const img = g.createImageData(N * 2, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N * 2; x++) {
    const ax = x / (N * 2) * Math.PI * 2;
    const f = Math.cos((y / N) * Math.PI * 2 * 4 + 0.35 * Math.sin(ax * 3) + 0.2 * Math.sin(ax * 7 + y * 0.05));
    const l = 0.8 + 0.2 * f * (0.75 + 0.25 * Math.sin(ax * 5 + 1.3)), o = (y * N * 2 + x) * 4;
    img.data[o] = 146 * l; img.data[o + 1] = 124 * l; img.data[o + 2] = 100 * l; img.data[o + 3] = 255;   // pardo gris cálido, como la tierra de la referencia
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 5200; k++) {   // los terrones y el grano de la tierra
    const x = az() * N * 2, y = az() * N, r = 0.6 + az() * az() * 3.2, v = 0.6 + az() * 0.6;
    g.fillStyle = `rgba(${Math.round(156 * v)},${Math.round(134 * v)},${Math.round(108 * v)},${0.35 + az() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, r * 1.6, r, 0, 0, 6.283); g.fill();
  }
  texLabrado = new THREE.CanvasTexture(cv);
  texLabrado.wrapS = texLabrado.wrapT = THREE.RepeatWrapping;
  texLabrado.colorSpace = THREE.SRGBColorSpace;
  texLabrado.anisotropy = 4;
  return texLabrado;
}
let matLabrado = null;      // (uno para todos: no se rehace con cada cambio)

// ---------- Las plantas de lo sembrado (P11) ----------
const LEJOS_PLANTAS = 45;          // m: más lejos que esto (del borde del campo), solo el color del suelo
const MATAS_CEBADA = 9;            // matas de cebada por m² sembrado a voleo
const C = (h) => new THREE.Color(h);
// el color que toma de lejos la tierra sembrada de cebada en cada fase (multiplica la textura de la tierra)
const TINTE_CEBADA = [[0.92, 1, 0.8], [0.62, 1, 0.5], [0.8, 1, 0.52], [1.18, 1.05, 0.6]];
// Un constructor de mallas pequeñas con color por vértice (las normales hacia arriba, como la hierba densa: luz suave).
function constructor() {
  const pos = [], col = [], nor = [], idx = [];
  // (los colores, apagados como los de la referencia: algo hacia el gris y algo más oscuros, que con la normal hacia
  // arriba todo sale muy iluminado)
  const apagar = (c) => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; return [(c.r + (l - c.r) * 0.25) * 0.8, (c.g + (l - c.g) * 0.25) * 0.8, (c.b + (l - c.b) * 0.25) * 0.74]; };
  const v = (x, y, z, c, ny = 1) => { pos.push(x, y, z); col.push(...apagar(c)); nor.push(0, ny, 0); return pos.length / 3 - 1; };
  return {
    // una hoja o un tallo: de (x, z) en el suelo, hacia el ángulo a, que sube «alto», se abre «fuera» y cae «cae» en la
    // punta; ancho en la base; c0 en el pie, c1 en la punta. ancha: hoja ancha (rombo) en vez de tira
    hoja(x, z, a, alto, fuera, ancho, c0, c1, { cae = 0, y0 = 0, ancha = false } = {}) {
      const ca = Math.cos(a), sa = Math.sin(a), px = -sa * ancho, pz = ca * ancho, cm = c0.clone().lerp(c1, 0.55);
      const b = v(x - px * 0.5, y0, z - pz * 0.5, c0), b2 = v(x + px * 0.5, y0, z + pz * 0.5, c0);
      const mx = x + ca * fuera * 0.5, mz = z + sa * fuera * 0.5, my = y0 + alto * (ancha ? 0.55 : 0.6);
      const m1 = v(mx - px * (ancha ? 1.2 : 0.7), my, mz - pz * (ancha ? 1.2 : 0.7), cm), m2 = v(mx + px * (ancha ? 1.2 : 0.7), my, mz + pz * (ancha ? 1.2 : 0.7), cm);
      const t = v(x + ca * fuera, y0 + alto - cae, z + sa * fuera, c1);
      idx.push(b, b2, m1, b2, m2, m1, m1, m2, t);
    },
    // una bola (la cabeza de la col, el nabo que asoma): un icosaedro pequeño, algo achatado
    bola(x, y, z, r, c, achata = 0.85) {
      const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, n = g.attributes.normal;
      const base = pos.length / 3;
      const ca = apagar(c);
      for (let i = 0; i < p.count; i++) { pos.push(x + p.getX(i), y + p.getY(i) * achata, z + p.getZ(i)); const k = 0.82 + 0.18 * (p.getY(i) / r * 0.5 + 0.5); col.push(ca[0] * k, ca[1] * k, ca[2] * k); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
      const ix = g.index ? g.index.array : [...Array(p.count).keys()];
      for (const i of ix) idx.push(base + i);
      g.dispose();
    },
    // la espiga: un huso fino de (x, y, z) hacia (dx, dy, dz)
    espiga(x, y, z, dx, dy, dz, r, c) {
      const L = Math.hypot(dx, dy, dz), ux = dx / L, uy = dy / L, uz = dz / L;
      let ax = -uz, az = ux; const la = Math.hypot(ax, az) || 1; ax /= la; az /= la;
      const b = v(x, y, z, c), t = v(x + dx, y + dy, z + dz, c);
      const s = [];
      for (let k = 0; k < 3; k++) { const ang = k * 2.094, ox = ax * Math.cos(ang) * r, oz = az * Math.cos(ang) * r, oy = Math.sin(ang) * r; s.push(v(x + dx * 0.45 + ox, y + dy * 0.45 + oy, z + dz * 0.45 + oz, c)); }
      for (let k = 0; k < 3; k++) { const a1 = s[k], a2 = s[(k + 1) % 3]; idx.push(b, a1, a2, a1, t, a2); }
    },
    cerrar() {
      // las hojas, por las dos caras con la misma normal hacia arriba (con DoubleSide, la de detrás saldría oscura)
      const n = idx.length;
      for (let i = 0; i < n; i += 3) idx.push(idx[i], idx[i + 2], idx[i + 1]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      return g;
    },
  };
}
// La forma de cada cultivo en cada fase (una por instancia; la instancia la gira y le da algo de tamaño).
function formaPlanta(cultivo, f) {
  const k = constructor(), r = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  if (cultivo === 'cebada') {   // una mata de cebada: varias hojas y, desde la espiga, sus tallos con la espiga
    const verde = [C(0x74983e), C(0x62893a), C(0x6a8838), C(0xb8954e)][f], punta = [C(0x9cb85a), C(0x93ae52), C(0xa2a856), C(0xdcb768)][f];
    const n = [5, 6, 5, 5][f], alto = [0.13, 0.34, 0.5, 0.58][f];
    for (let i = 0; i < n; i++) { const a = i * 2.4 + r(i) * 0.6; k.hoja(Math.cos(a) * 0.03, Math.sin(a) * 0.03, a, alto * (0.75 + 0.35 * r(i + 7)), alto * (f ? 0.32 : 0.5), 0.022, verde, punta, { cae: f ? alto * 0.18 : 0 }); }
    if (f >= 2) {
      const espiga = f === 2 ? C(0xbab86a) : C(0xe0b864);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257 + r(i + 3), sx = Math.cos(a) * 0.035, sz = Math.sin(a) * 0.035, h = alto * (1.05 + 0.25 * r(i + 11)), lean = 0.06 + 0.05 * r(i + 5);
        k.hoja(sx, sz, a, h, lean, 0.008, verde, espiga);
        const tx = sx + Math.cos(a) * lean, tz = sz + Math.sin(a) * lean;
        if (f === 2) k.espiga(tx, h - 0.01, tz, Math.cos(a) * 0.025, 0.12, Math.sin(a) * 0.025, 0.02, espiga);
        else k.espiga(tx, h - 0.01, tz, Math.cos(a) * 0.08, -0.06, Math.sin(a) * 0.08, 0.02, espiga);   // madura, la espiga se dobla
      }
    }
  } else if (cultivo === 'habas') {   // un tallo recto con pares de hojas redondas, luego vainas; seca, negruzca
    const tallo = [C(0x6a9a4a), C(0x4f7d38), C(0x4f7d38), C(0x6a5238)][f], hoja = [C(0x7fae58), C(0x56843e), C(0x5a8642), C(0x8a6e48)][f];
    const alto = [0.06, 0.3, 0.55, 0.5][f];
    if (f === 0) { k.hoja(0, 0, 0.3, 0.08, 0.05, 0.035, tallo, hoja, { ancha: true }); k.hoja(0, 0, 3.4, 0.07, 0.05, 0.035, tallo, hoja, { ancha: true }); }
    else {
      k.hoja(0, 0, 0, alto, 0.01, 0.018, tallo, tallo); k.hoja(0, 0, 1.57, alto, 0.01, 0.018, tallo, tallo);
      const pisos = f === 1 ? 3 : 4;
      for (let p = 0; p < pisos; p++) {
        const y0 = alto * (0.2 + 0.75 * p / pisos), a = p * 1.9;
        for (const s of [0, Math.PI]) k.hoja(0, 0, a + s, 0.05, 0.09, 0.04, hoja, hoja, { y0, ancha: true });
      }
      if (f >= 2) {
        const vaina = f === 2 ? C(0x86a654) : C(0x4a3826);
        for (let p = 0; p < 3; p++) { const a = p * 2.1 + 0.5, y = alto * (0.3 + 0.18 * p); k.espiga(Math.cos(a) * 0.02, y, Math.sin(a) * 0.02, Math.cos(a) * 0.06, -0.11, Math.sin(a) * 0.06, 0.022, vaina); }
      }
    }
  } else if (cultivo === 'col') {   // una roseta de hojas anchas azuladas y, en el centro, el cogollo
    const hoja = [C(0x7fa868), C(0x6e9266), C(0x6c8e62), C(0x6e8c5e)][f], borde = [C(0x9ac07a), C(0x93ae7c), C(0x90aa78), C(0x8ea672)][f];
    const n = [3, 7, 9, 10][f], largo = [0.08, 0.22, 0.26, 0.3][f];
    for (let i = 0; i < n; i++) { const a = i * 2.4; { const fuera = i < n / 2 ? 1 : 0.6; k.hoja(0, 0, a, largo * (f ? (fuera < 1 ? 1.1 : 0.75) : 1), largo * fuera, largo * 0.45, hoja, borde, { ancha: true, cae: f ? largo * 0.12 : 0, y0: f ? 0.02 : 0 }); } }
    if (f >= 2) k.bola(0, f === 2 ? 0.1 : 0.13, 0, f === 2 ? 0.1 : 0.14, C(0xa6be8a), 0.8);
  } else if (cultivo === 'hierbas') {   // las malas hierbas (escardar, 14 nov): una roseta de hojas anchas y oscuras, más
    // baja y más ancha que lo sembrado, con alguna brizna; en espiga, tallos con la flor roja de la amapola y la azul del
    // aciano (las de los campos de cereal), de colores apagados
    const hoja = C(0x4a6e30), borde = C(0x5f8238), brizna = C(0x7d9a48);
    const n = f === 1 ? 6 : 8, largo = f === 1 ? 0.11 : 0.16;
    for (let i = 0; i < n; i++) { const a = i * 2.4 + r(i) * 0.5; k.hoja(0, 0, a, largo * 0.35, largo * (0.8 + 0.4 * r(i + 4)), largo * 0.38, hoja, borde, { ancha: true, cae: largo * 0.05 }); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.7; k.hoja(Math.cos(a) * 0.05, Math.sin(a) * 0.05, a, (f === 1 ? 0.14 : 0.24) * (0.8 + 0.4 * r(i + 9)), 0.04, 0.012, hoja, brizna); }
    if (f >= 2) {
      const flores = [[0.4, 0.34, C(0x9e3a2c)], [2.6, 0.29, C(0x9e3a2c)], [4.6, 0.31, C(0x56689e)]];
      for (const [a, h, fl] of flores) {
        const sx = Math.cos(a) * 0.04, sz = Math.sin(a) * 0.04;
        k.hoja(sx, sz, a, h, 0.03, 0.007, hoja, brizna);
        k.bola(sx + Math.cos(a) * 0.03, h, sz + Math.sin(a) * 0.03, 0.022, fl, 0.6);
      }
    }
  } else {   // el nabo: hojas rectas y algo rizadas y, al engordar, la raíz blanca y morada que asoma
    const hoja = [C(0x7aac58), C(0x5e9444), C(0x5a8e42), C(0x6a8a44)][f], punta = [C(0x92c06c), C(0x7aac58), C(0x76a656), C(0x8a9a52)][f];
    const n = [3, 6, 7, 7][f], alto = [0.08, 0.2, 0.28, 0.3][f];
    for (let i = 0; i < n; i++) { const a = i * 2.4 + r(i); k.hoja(0, 0, a, alto * (0.8 + 0.3 * r(i + 2)), alto * 0.45, alto * 0.18, hoja, punta, { ancha: true, cae: alto * 0.1, y0: f >= 2 ? 0.03 : 0 }); }
    if (f >= 2) { const rr = f === 2 ? 0.045 : 0.065; k.bola(0, 0, 0, rr, C(0xe6dcd6), 1); k.bola(0, rr * 0.75, 0, rr * 0.8, C(0x8e5a7c), 0.6); }
  }
  return k.cerrar();
}
const FORMAS = {};
const forma = (cultivo, f) => (FORMAS[cultivo + f] ||= formaPlanta(cultivo, f));
let matPlantas = null;
// un número fijo (0–1) para un punto, para que cada planta salga siempre igual
const fijo = (x, z, s = 0) => { const h = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };

export function crearCamposVista({ escena, sueloEn }) {
  const raiz = new THREE.Group();
  raiz.name = 'campos';
  escena.add(raiz);
  const vaciar = () => { for (const h of raiz.children) h.traverse(o => { if (o.isMesh && !o.userData.compartida) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }); raiz.clear(); grupos = []; };
  let grupos = [], ultimos = null, proximoCambio = Infinity, mirado = 0;

  // la franja del linde de a a b, cada medio metro a la altura del suelo, con algo de variación de color
  function linde(a, b, geos) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 0.05) return;
    const n = Math.max(1, Math.ceil(L / 0.5)), nx = -(b.z - a.z) / L * ANCHO_LINDE / 2, nz = (b.x - a.x) / L * ANCHO_LINDE / 2;
    const pos = [], col = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      for (const s of [-1, 1]) {
        const px = x + nx * s, pz = z + nz * s;
        pos.push(px, sueloEn(px, pz) + SOBRE, pz);
        const v = 0.92 + 0.12 * (Math.sin(px * 7.1 + pz * 3.3) * 0.5 + 0.5);   // poca variación: una banda continua de tierra pisada
        col.push(COLOR_LINDE.r * v, COLOR_LINDE.g * v, COLOR_LINDE.b * v);
      }
      if (k < n) { const i = k * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    geos.push(g);
  }

  // la cuerda que va de una estaca a la otra, a ALTO_CUERDA del suelo, con algo de comba (la parte que se ve del linde
  // mientras el campo aún tiene hierba; luego, al limpiarlo, se ve también la banda de tierra pisada)
  function cuerda(a, b, geos) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 0.05) return;
    const n = Math.max(2, Math.ceil(L / 0.6)), pts = [];
    const ya = sueloEn(a.x, a.z) + ALTO_CUERDA, yb = sueloEn(b.x, b.z) + ALTO_CUERDA;
    for (let k = 0; k <= n; k++) {
      const t = k / n, comba = Math.sin(t * Math.PI) * Math.min(0.12, L * 0.03);
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, ya + (yb - ya) * t - comba, a.z + (b.z - a.z) * t));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.012, 4, false);
    geos.push(g);
  }

  // lo labrado de un campo: una malla de cuartos de metro pegada al suelo sobre las casillas labradas, opaca dentro y que
  // se funde con la hierba en el borde (un canto irregular, no un recorte), sin pasar del linde; con la textura de los
  // surcos girada a lo largo del campo (uv en metros del mundo) y algo de variación de color para que no se vea repetida
  function labrado(c, ahora, geos) {
    const casillas = casillasLabradas(c, ahora);
    if (!casillas.length) return;
    let mejor = null;   // el lado más largo: hacia dónde van los surcos
    for (const [a, b] of ladosDe(c)) { const L = Math.hypot(b.x - a.x, b.z - a.z); if (!mejor || L > mejor.L) mejor = { L, ang: Math.atan2(b.z - a.z, b.x - a.x) }; }
    const co = Math.cos(-mejor.ang), si = Math.sin(-mejor.ang);
    const hay = new Set(casillas.map(k => `${k.x},${k.z}`));
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const k of casillas) { x0 = Math.min(x0, k.x - 1); z0 = Math.min(z0, k.z - 1); x1 = Math.max(x1, k.x + 2); z1 = Math.max(z1, k.z + 2); }
    const P = 0.25, nx = Math.round((x1 - x0) / P), nz = Math.round((z1 - z0) / P);
    const ruido = (x, z) => Math.sin(x * 2.7 + z * 1.3) * Math.cos(z * 2.1 - x * 0.8) * 0.6 + Math.sin(x * 7.3 - z * 5.9) * 0.4;   // −1…1
    // lo lejos que está (x, z) de la casilla labrada más cercana (0 dentro de una)
    const lejos = (x, z) => {
      let d = Infinity;
      const cx = Math.floor(x), cz = Math.floor(z);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const kx = cx + i, kz = cz + j;
        if (!hay.has(`${kx},${kz}`)) continue;
        const dx = Math.max(kx - x, 0, x - kx - 1), dz = Math.max(kz - z, 0, z - kz - 1);
        d = Math.min(d, Math.hypot(dx, dz));
      }
      return d;
    };
    const suave = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const pos = [], uv = [], col = [], idx = [], alfa = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * P, z = z0 + j * P;
      // el canto: opaco en lo labrado y hasta 0,1 m fuera; de ahí a 0,3 m se funde con la hierba, irregular; nada fuera del linde
      let al = suave(0.3, 0.12, lejos(x, z) + ruido(x, z) * 0.1);
      if (!dentroPoligono(c.puntos, x, z)) al = 0;
      const v = 0.9 + 0.1 * ruido(x * 0.37 + 5, z * 0.41 - 3);   // manchas grandes, más claras y más oscuras
      // sembrada de cebada, la tierra toma de lejos el color de su fase (P11, sembrar)
      const tv = voleoEn(c, x, z), ti = tv === null ? [1, 0.985, 0.97] : TINTE_CEBADA[fase(tv, ahora)];
      pos.push(x, sueloEn(x, z) + SOBRE + 0.012, z); uv.push((x * co - z * si) * 0.5, x * si + z * co); col.push(v * ti[0], v * ti[1], v * ti[2], al); alfa.push(al);
    }
    const fila = nx + 1;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * fila + i, b = a + 1, d = a + fila, e = d + 1;
      if (alfa[a] + alfa[b] + alfa[d] + alfa[e] <= 0) continue;
      idx.push(a, d, b, b, d, e);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx); g.computeVertexNormals();
    geos.push(g);
  }

  // lo sembrado de un campo: un grupo con una malla de instancias por cultivo y fase (las matas de cebada, unas cuantas
  // por casilla en sitios fijos; las demás, una por planta), que se esconde de lejos (paso)
  function sembrado(c, ahora) {
    const porForma = new Map(), poner = (cultivo, f, x, z, s) => { const k = cultivo + f; if (!porForma.has(k)) porForma.set(k, { cultivo, f, l: [] }); porForma.get(k).l.push([x, z, s]); };
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const k of casillasVoleo(c)) {
      const f = fase(k.t, ahora);
      proximoCambio = Math.min(proximoCambio, siguienteCambio(k.t, ahora));
      for (let i = 0; i < MATAS_CEBADA; i++) {
        const x = k.x + fijo(k.x, k.z, i), z = k.z + fijo(k.z, k.x, i + 9);
        if (!dentroPoligono(c.puntos, x, z)) continue;
        poner('cebada', f, x, z, 0.8 + 0.4 * fijo(x, z, 3));
      }
      // las malas hierbas, entre la cebada verde o en espiga que no se ha escardado (escardar, 14 nov): dos por m²
      if (conHierbas(k.t, ahora, escardadoEn(c, k.x + 0.5, k.z + 0.5)))
        for (let i = 0; i < HIERBAS_M2; i++) {
          const x = k.x + 0.1 + 0.8 * fijo(k.x, k.z, i + 21), z = k.z + 0.1 + 0.8 * fijo(k.z, k.x, i + 33);
          if (dentroPoligono(c.puntos, x, z)) poner('hierbas', f, x, z, 0.85 + 0.35 * fijo(x, z, 13));
        }
      x0 = Math.min(x0, k.x); z0 = Math.min(z0, k.z); x1 = Math.max(x1, k.x + 1); z1 = Math.max(z1, k.z + 1);
    }
    for (const p of c.plantas || []) {
      const f = fase(p.t, ahora);
      proximoCambio = Math.min(proximoCambio, siguienteCambio(p.t, ahora));
      poner(p.c, f, p.x, p.z, 0.85 + 0.3 * fijo(p.x, p.z, 5));
      if (conHierbas(p.t, ahora, p.e)) { const a = fijo(p.x, p.z, 17) * 6.283; poner('hierbas', f, p.x + Math.cos(a) * 0.22, p.z + Math.sin(a) * 0.22, 0.9 + 0.3 * fijo(p.x, p.z, 19)); }
      x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z);
    }
    if (!porForma.size) return;
    if (!matPlantas) matPlantas = new THREE.MeshLambertMaterial({ vertexColors: true });
    const g = new THREE.Group(); g.name = 'sembrado';
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
    for (const { cultivo, f, l } of porForma.values()) {
      const im = new THREE.InstancedMesh(forma(cultivo, f), matPlantas, l.length);
      im.userData.compartida = true; im.name = `planta_${cultivo}_${f}`;
      l.forEach(([x, z, s], i) => {
        E.set((fijo(x, z, 7) - 0.5) * 0.12, fijo(x, z, 1) * 6.283, (fijo(x, z, 8) - 0.5) * 0.12);
        M.compose(P.set(x, sueloEn(x, z) + SOBRE, z), Q.setFromEuler(E), S.set(s, s, s));
        im.setMatrixAt(i, M);
      });
      im.receiveShadow = true; im.castShadow = false;
      im.computeBoundingSphere();
      g.add(im);
    }
    g.userData.centro = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 };
    raiz.add(g); grupos.push(g);
  }

  // campos: los del mundo (Mundo.campos).
  function poner(campos, ahora = Date.now()) {
    vaciar();
    ultimos = campos; proximoCambio = Infinity;
    const L = new Lote({ rangoSuelo: 0.3, variacion: 0.06 }), lindes = [], cuerdas = [], labrados = [];
    for (const c of campos || []) {
      c.puntos.forEach((p, i) => estacaEn(L, p.x, sueloEn(p.x, p.z) - HUNDIDA, p.z, { y: (i * 1.7 + c.id) % 6.28, x: 0.04, z: ((i * 0.37) % 0.1) - 0.05 }, `${c.id}:${i}`, GROSOR_ESTACA, ALTO_ESTACA + HUNDIDA, 1.5));
      for (const [a, b] of ladosDe(c)) { linde(a, b, lindes); cuerda(a, b, cuerdas); }
      if (c.cerrado) { labrado(c, ahora, labrados); sembrado(c, ahora); }
    }
    for (const [tex, geos] of Object.entries(L.cerrar(null, true))) {
      const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; raiz.add(m);
    }
    if (lindes.length) { const m = new THREE.Mesh(mergeGeometries(lindes), MAT_LINDE); m.receiveShadow = true; raiz.add(m); }
    if (cuerdas.length) { const m = new THREE.Mesh(mergeGeometries(cuerdas), MAT_CUERDA); m.castShadow = true; raiz.add(m); }
    if (labrados.length) {
      if (!matLabrado) { const t = texturaLabrado(); matLabrado = new THREE.MeshLambertMaterial({ map: t, color: t ? 0xffffff : 0x8a7058, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); }
      const m = new THREE.Mesh(mergeGeometries(labrados), matLabrado);
      m.receiveShadow = true; m.name = 'tierra_labrada'; raiz.add(m);
    }
  }
  // cada fotograma: de lejos, lo sembrado no se dibuja (queda el color de la tierra); y al cambiar de fase, se rehace
  function paso(foco) {
    for (const g of grupos) { const c = g.userData.centro; g.visible = Math.hypot(c.x - foco.x, c.z - foco.z) - c.r < LEJOS_PLANTAS; }
    const t = performance.now();
    if (t - mirado > 5000) { mirado = t; if (Date.now() >= proximoCambio && ultimos) poner(ultimos); }
  }
  return { poner, paso, raiz };
}
