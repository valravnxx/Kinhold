// Kinhold — escena de la prueba de estilo v3 («maqueta en miniatura»):
// un pedazo de tierra redondo con su corte de tierra visto, cabaña de troncos sobre zócalo de piedra,
// leña, tocón con hacha, barril, banco, cerca, árboles, matas y flores.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETA, Lote, material } from './estilos.js';

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cil = (r1, r2, h, lados, abierto = false) => new THREE.CylinderGeometry(r1, r2, h, lados, 1, abierto);
const caja = (w, h, d, radio = 0.025) => new RoundedBoxGeometry(w, h, d, 1, Math.min(radio, w / 2.05, h / 2.05, d / 2.05));

export const CAB = { AX: 2.0, AZ: 1.8, ZOCALO: 0.42, HIL: 0.25, N: 9, RAD: 0.135, SAL: 0.3, SUB: 1.6, VUELO: 0.5 };
export const RADIO = 11.5; // radio de la maqueta

// borde irregular de la maqueta
const borde = (a) => RADIO * (1 + 0.035 * Math.sin(3 * a + 0.4) + 0.025 * Math.sin(7 * a + 1.3) + 0.012 * Math.sin(13 * a));

export function crearEscena() {
  const raiz = new THREE.Group();
  const r = azar(21);
  const fijo = new Lote();
  const sombras = []; // manchas de oclusión en el suelo: [x, z, radio, fuerza]
  cabana(fijo, r, sombras);
  enseres(fijo, r, sombras);
  arboles(fijo, r, sombras);
  const { AX, AZ, ZOCALO, N, HIL } = CAB, ALTO = ZOCALO + N * HIL + HIL / 2;
  const geos = fijo.cerrar((v, n) => {
    const dentro = Math.abs(v.x) < AX + 0.35 && Math.abs(v.z) < AZ + 0.35;
    return dentro && v.y > ALTO - 0.6 && v.y < ALTO + 0.1 && n.y < 0.5 ? 0.72 : 1; // bajo el alero
  });
  const m = new THREE.Mesh(mergeGeometries(geos), material('fijo'));
  m.castShadow = m.receiveShadow = true; m.name = 'fijo';
  raiz.add(m);
  raiz.add(base(sombras));
  plantas(raiz, r);
  return raiz;
}

// ---------- La base: tierra con hierba arriba y el corte de tierra a la vista ----------
function base(sombras) {
  const ANILLOS = 18, LADOS = 72;
  const H = new THREE.Color(PALETA.hierba), C = new THREE.Color(PALETA.hierbaClara), T = new THREE.Color(PALETA.tierra), K = new THREE.Color(PALETA.camino);
  const pos = [], col = [], idx = [], k = new THREE.Color();
  const { AX, AZ } = CAB;
  // superficie: anillos concéntricos hasta el borde irregular
  pos.push(0, 0, 0); col.push(...colorSuelo(0, 0));
  for (let i = 1; i <= ANILLOS; i++) for (let j = 0; j < LADOS; j++) {
    const a = j / LADOS * Math.PI * 2, t = i / ANILLOS, rr = borde(a) * t;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const y = t > 0.55 ? Math.sin(a * 2 + 1) * 0.25 * (t - 0.55) / 0.45 * Math.sin(t * Math.PI) : 0; // lomas suaves hacia el borde
    pos.push(x, y, z); col.push(...colorSuelo(x, z));
  }
  const id = (i, j) => (i === 0 ? 0 : 1 + (i - 1) * LADOS + (j % LADOS));
  for (let j = 0; j < LADOS; j++) idx.push(0, id(1, j + 1), id(1, j));
  for (let i = 1; i < ANILLOS; i++) for (let j = 0; j < LADOS; j++) {
    const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j), d = id(i + 1, j + 1);
    idx.push(a, b, d, a, d, c);
  }
  function colorSuelo(x, z) {
    const d = Math.hypot(x, z);
    const m = Math.sin(x * 0.45 + 1) * Math.cos(z * 0.4) * 0.5 + 0.5;
    k.copy(H).lerp(C, m * 0.5);
    const camino = Math.max(0, 1 - Math.abs(x - 0.2 - Math.sin(z * 0.5) * 0.5) / 1.0) * (z > 1.9 ? 1 : 0) * (d < RADIO - 0.6 ? 1 : 0);
    k.lerp(K, Math.min(0.85, camino * 1.2));
    const dCab = Math.hypot(Math.max(0, Math.abs(x) - AX), Math.max(0, Math.abs(z) - AZ));
    k.lerp(T, dCab < 0.6 ? 0.55 : dCab < 1.4 ? 0.55 * (1.4 - dCab) / 0.8 : 0);
    let o = 1 - 0.38 * Math.max(0, 1 - dCab / 0.9); // sombra de contacto al pie de la cabaña
    for (const [sx, sz, sr, f] of sombras) { const dd = Math.hypot(x - sx, z - sz); if (dd < sr) o *= 1 - f * (1 - dd / sr) ** 2; }
    return [k.r * o, k.g * o, k.b * o];
  }
  const sup = new THREE.BufferGeometry();
  sup.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sup.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  sup.setIndex(idx); sup.computeVertexNormals();
  // corte de tierra: pared alrededor con franjas (hierba arriba, tierra, tierra oscura abajo) y fondo
  const ALTO_CORTE = 1.6, FR = [[0, PALETA.hierba], [0.12, PALETA.tierraCorte], [0.5, PALETA.tierraCorte], [0.62, PALETA.tierraCorteOsc], [1, PALETA.tierraCorteOsc]];
  const p2 = [], c2 = [], i2 = [];
  for (let f = 0; f < FR.length; f++) for (let j = 0; j <= LADOS; j++) {
    const a = j / LADOS * Math.PI * 2, rr = borde(a) * (1 - FR[f][0] * 0.04);
    const ruido = f > 0 && f < FR.length - 1 ? Math.sin(a * 11 + f * 3) * 0.04 : 0;
    p2.push(Math.cos(a) * rr, -FR[f][0] * ALTO_CORTE + ruido, Math.sin(a) * rr);
    const cc = new THREE.Color(FR[f][1]).multiplyScalar(0.92 + Math.sin(a * 5 + f) * 0.06);
    c2.push(cc.r, cc.g, cc.b);
  }
  for (let f = 0; f < FR.length - 1; f++) for (let j = 0; j < LADOS; j++) {
    const a = f * (LADOS + 1) + j, b = a + 1, c = a + LADOS + 1, d = c + 1;
    i2.push(a, c, b, b, c, d);
  }
  const corte = new THREE.BufferGeometry();
  corte.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
  corte.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
  corte.setIndex(i2); corte.computeVertexNormals();
  const g = new THREE.Group();
  const ms = new THREE.Mesh(sup, material('fijo')); ms.receiveShadow = true; ms.name = 'suelo';
  const mc = new THREE.Mesh(corte, material('doble')); mc.name = 'corte';
  g.add(ms, mc);
  return g;
}

// ---------- Cabaña ----------
function cabana(L, r, sombras) {
  const { AX, AZ, ZOCALO, HIL, N, RAD, SAL, SUB, VUELO } = CAB;
  const tronco = (largo, x, y, z, eje, color) => {
    const giro = eje === 'x' ? { z: Math.PI / 2 } : { x: Math.PI / 2 };
    L.add(cil(RAD, RAD, largo, 8, true), color, x, y, z, giro);
    for (const s of [-1, 1]) { // punta redondeada con el corte claro
      const d = largo / 2;
      const tapa = new THREE.SphereGeometry(RAD, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2); tapa.scale(1, 0.3, 1);
      const rot = eje === 'x' ? { z: -s * Math.PI / 2 } : { x: s * Math.PI / 2 };
      L.add(tapa, 'corte', x + (eje === 'x' ? s * d : 0), y, z + (eje === 'z' ? s * d : 0), rot);
    }
  };
  // zócalo continuo: muro de mampostería (núcleo de mortero) con piedras redondeadas bien juntas
  for (const [w, d, x, z] of [[2 * AX + 0.3, 0.34, 0, AZ], [2 * AX + 0.3, 0.34, 0, -AZ], [0.34, 2 * AZ + 0.3, AX, 0], [0.34, 2 * AZ + 0.3, -AX, 0]])
    L.add(caja(w, ZOCALO, d, 0.06), 'mortero', x, ZOCALO / 2, z);
  const piedra = (x, y, z, s, giro) => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    L.add(g, r() > 0.5 ? 'piedra' : 'piedraOsc', x, y, z, { y: giro + r() * 0.4, x: r() * 0.3 }, { escala: new THREE.Vector3(s * 1.25, s * 0.75, s * 0.85), plano: true });
  };
  for (const fila of [0, 1]) {
    const y = 0.11 + fila * 0.2, paso = 0.27, desf = fila * paso / 2;
    for (const sz of [1, -1]) for (let x = -AX - 0.1 + desf; x <= AX + 0.1; x += paso)
      if (!(sz > 0 && fila === 1 && Math.abs(x) < 0.55)) piedra(x, y, sz * (AZ + 0.12), 0.13 + r() * 0.03, 0);
    for (const sx of [1, -1]) for (let z = -AZ - 0.1 + desf; z <= AZ + 0.1; z += paso) piedra(sx * (AX + 0.12), y, z, 0.13 + r() * 0.03, Math.PI / 2);
  }
  const PUERTA = [-0.5, 0.5], ALTO_P = 2.0, VENT = [-0.45, 0.45], VY = [1.0, 1.6];
  for (let k = 0; k < N; k++) {
    const yX = ZOCALO + RAD + k * HIL, yZ = yX + HIL / 2;
    const c = r() > 0.5 ? 'madera' : 'maderaOsc';
    for (const z of [AZ, -AZ]) {
      if (z > 0 && yX < ZOCALO + ALTO_P) {
        const a = -AX - SAL, b = PUERTA[0], cc = PUERTA[1], d = AX + SAL;
        tronco(b - a, (a + b) / 2, yX, z, 'x', c); tronco(d - cc, (cc + d) / 2, yX, z, 'x', c);
      } else tronco(2 * (AX + SAL), 0, yX, z, 'x', c);
    }
    for (const x of [AX, -AX]) {
      if (x > 0 && yZ > ZOCALO + VY[0] && yZ < ZOCALO + VY[1]) {
        const a = -AZ - SAL, b = VENT[0], cc = VENT[1], d = AZ + SAL;
        tronco(b - a, x, yZ, (a + b) / 2, 'z', c); tronco(d - cc, x, yZ, (cc + d) / 2, 'z', c);
      } else tronco(2 * (AZ + SAL), x, yZ, 0, 'z', c);
    }
  }
  const ALTO = ZOCALO + N * HIL + HIL / 2;
  // interior en penumbra
  L.add(caja(2 * AX - 0.3, 0.04, 2 * AZ - 0.3), 'maderaOsc', 0, ZOCALO, 0, null, { brillo: 0.4 });
  for (const [w, d, x, z, b] of [[2 * AX - 0.3, 0.04, 0, -AZ + 0.16, 0.32], [0.04, 2 * AZ - 0.3, -AX + 0.16, 0, 0.32], [0.04, 2 * AZ - 0.3, AX - 0.16, 0, 0.28]])
    L.add(caja(w, ALTO - ZOCALO, d, 0.01), 'maderaOsc', x, (ALTO + ZOCALO) / 2, z, null, { brillo: b });
  // puerta entreabierta
  {
    const ang = -0.6, piv = new THREE.Matrix4().makeRotationY(ang), w = (PUERTA[1] - PUERTA[0] - 0.04) / 4;
    const en = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(piv).add(new THREE.Vector3(PUERTA[0] + 0.02, ZOCALO, AZ - 0.02));
    for (let t = 0; t < 4; t++) { const p = en(w * (t + 0.5), (ALTO_P - 0.03) / 2, 0); L.add(caja(w * 0.95, ALTO_P - 0.03, 0.06, 0.02), t % 2 ? 'tabla' : 'madera', p.x, p.y, p.z, { y: ang }); }
    for (const y of [0.35, 1.6]) {
      const p = en(w * 2, y, -0.05); L.add(caja(w * 3.7, 0.11, 0.04, 0.015), 'maderaOsc', p.x, p.y, p.z, { y: ang });
      const q = en(0.17, y, 0.035); L.add(caja(0.32, 0.04, 0.015, 0.007), 'hierro', q.x, q.y, q.z, { y: ang });
    }
    for (const x of PUERTA) L.add(caja(0.12, ALTO_P, 0.32, 0.03), 'maderaOsc', x, ZOCALO + ALTO_P / 2, AZ);
    L.add(caja(1.32, 0.16, 0.32, 0.04), 'maderaOsc', 0, ZOCALO + ALTO_P + 0.08, AZ);
    L.add(caja(1.2, 0.18, 0.55, 0.06), 'piedra', 0, 0.09, AZ + 0.32); // escalón de piedra
  }
  // ventana con marco y contraventana abierta
  {
    const y0 = ZOCALO + VY[0], y1 = ZOCALO + VY[1];
    for (const z of VENT) L.add(caja(0.3, y1 - y0 + 0.14, 0.09, 0.025), 'maderaOsc', AX, (y0 + y1) / 2, z);
    for (const y of [y0, y1]) L.add(caja(0.36, 0.09, VENT[1] - VENT[0] + 0.2, 0.025), 'maderaOsc', AX, y, 0);
    const wV = VENT[1] - VENT[0], th = 1.15;
    L.add(caja(0.045, y1 - y0 - 0.02, wV, 0.015), 'tabla', AX + 0.17 + Math.sin(th) * wV / 2, (y0 + y1) / 2, VENT[1] + 0.07 + Math.cos(th) * wV / 2, { y: th });
  }
  // tejado de paja: almohadón grueso y redondeado en cada agua, cumbrera redonda
  {
    const media = AZ + VUELO, pend = SUB / (AZ + 0.15), ang = Math.atan(pend);
    const largo = Math.hypot(media, media * pend) + 0.1, ancho = 2 * (AX + SAL) + 0.55, GR = 0.42;
    const rayas = (v) => 1 + Math.sin(v.x * 8.1 + Math.sin(v.x * 1.7) * 2) * 0.05 + Math.sin(v.x * 21.3) * 0.03;
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().makeRotationX(s * ang);
      // tres hiladas de paja escalonadas: cada una monta sobre la de abajo y asoma su canto redondeado
      const FILAS = 3, lf = largo / FILAS;
      for (let f = 0; f < FILAS; f++) {
        const l = f === FILAS - 1 ? lf + 0.02 : lf * 1.35, zc = s * (f * lf + l / 2), yc = (FILAS - 1 - f) * 0.07;
        const p = new THREE.Vector3(0, yc, zc).applyMatrix4(m);
        const losa = new RoundedBoxGeometry(ancho - f * 0.03, GR, l, 2, 0.16);
        L.add(losa, f % 2 ? 'pajaOsc' : 'paja', p.x, ALTO + SUB + 0.06 + p.y, p.z, m, { rayas });
      }
    }
    L.add(cil(0.25, 0.25, ancho + 0.02, 14), 'pajaOsc', 0, ALTO + SUB + 0.2, 0, { z: Math.PI / 2 });
    for (const sx of [-1, 1]) L.add(new THREE.SphereGeometry(0.25, 14, 8), 'pajaOsc', sx * (ancho / 2 + 0.01), ALTO + SUB + 0.2, 0, null, { escala: new THREE.Vector3(0.3, 1, 1) });
    // hastiales de tablas verticales
    for (const sx of [-1, 1]) {
      const nT = 9, w = 2 * (AZ + 0.15) / nT;
      for (let t = 0; t < nT; t++) {
        const z = -AZ - 0.15 + w * (t + 0.5), h = Math.max(0.08, SUB * (1 - Math.abs(z) / (AZ + 0.15)));
        L.add(caja(0.07, h, w * 0.94, 0.015), t % 2 ? 'tabla' : 'madera', sx * (AX + 0.02), ALTO + h / 2, z);
      }
    }
  }
}

// ---------- Leña, tocón con hacha, barril, banco y cerca ----------
function enseres(L, r, sombras) {
  const { AX, AZ } = CAB;
  for (let f = 0; f < 4; f++) for (let i = 0; i < 6 - (f % 2); i++) {
    const z = -0.55 + i * 0.16 + (f % 2) * 0.08, y = 0.08 + f * 0.14;
    L.add(cil(0.075, 0.075, 0.6, 8), r() > 0.5 ? 'madera' : 'maderaOsc', -AX - 0.58, y, z, { z: Math.PI / 2 });
    for (const s of [-1, 1]) L.add(new THREE.CircleGeometry(0.066, 8), 'corte', -AX - 0.58 + s * 0.302, y, z, { y: s * Math.PI / 2 }, { sinSuelo: true });
  }
  sombras.push([-AX - 0.58, -0.15, 1.1, 0.4]);
  const tx = -1.9, tz = 3.0;
  L.add(cil(0.3, 0.35, 0.5, 14), 'madera', tx, 0.25, tz);
  L.add(cil(0.295, 0.295, 0.02, 14), 'corte', tx, 0.505, tz, null, { sinSuelo: true });
  const hacha = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0.6, 0.45, 'YXZ'));
  const ph = new THREE.Vector3(0, 0.36, 0).applyMatrix4(hacha);
  L.add(cil(0.02, 0.024, 0.75, 6), 'tabla', tx + 0.05 + ph.x, 0.5 + ph.y, tz + ph.z, hacha);
  const pc = new THREE.Vector3(0, 0.03, 0.04).applyMatrix4(hacha);
  L.add(caja(0.035, 0.1, 0.18, 0.012), 'hierro', tx + 0.05 + pc.x, 0.5 + pc.y, tz + pc.z, hacha);
  sombras.push([tx, tz, 0.8, 0.45]);
  const bx = AX + 0.62, bz = AZ + 0.55;
  L.add(cil(0.27, 0.25, 0.8, 14), 'tabla', bx, 0.4, bz);
  L.add(cil(0.3, 0.3, 0.34, 14), 'tabla', bx, 0.4, bz);
  for (const y of [0.12, 0.68]) L.add(cil(0.285, 0.285, 0.045, 14), 'hierro', bx, y, bz);
  L.add(new THREE.CircleGeometry(0.265, 14), 'maderaOsc', bx, 0.803, bz, { x: -Math.PI / 2 }, { sinSuelo: true });
  sombras.push([bx, bz, 0.7, 0.45]);
  L.add(caja(1.3, 0.08, 0.34, 0.03), 'tabla', -1.1, 0.46, AZ + 0.5);
  for (const x of [-1.6, -0.6]) L.add(caja(0.09, 0.42, 0.3, 0.025), 'maderaOsc', x, 0.21, AZ + 0.5);
  // cerca de varas siguiendo el borde
  for (let i = 0; i < 7; i++) {
    const a = 0.25 + i * 0.16, d = RADIO - 1.6, x = Math.cos(a) * d, z = Math.sin(a) * d;
    L.add(cil(0.065, 0.08, 1.15, 8), 'maderaOsc', x, 0.575, z, { y: r() });
    sombras.push([x, z, 0.45, 0.35]);
    if (i < 6) {
      const a2 = a + 0.16, x2 = Math.cos(a2) * d, z2 = Math.sin(a2) * d, lg = Math.hypot(x2 - x, z2 - z);
      for (const y of [0.45, 0.92]) L.add(cil(0.035, 0.035, lg + 0.1, 6), 'madera', (x + x2) / 2, y, (z + z2) / 2, { y: Math.atan2(z2 - z, x2 - x) * -1, z: Math.PI / 2 });
    }
  }
}

// ---------- Árboles y rocas (pocos y en la maqueta: van en la malla fija) ----------
function arboles(L, r, sombras) {
  const frondoso = (x, z, s) => {
    L.add(cil(0.14 * s, 0.24 * s, 2.4 * s, 10), 'corteza', x, 1.2 * s, z);
    L.add(cil(0.06 * s, 0.09 * s, 1.0 * s, 8), 'corteza', x + 0.3 * s, 2.3 * s, z, { z: -0.6 });
    const bolas = [[0, 3.3, 0, 1.25], [0.85, 2.85, 0.25, 0.9], [-0.8, 2.95, -0.15, 0.95], [0.15, 2.8, -0.85, 0.85], [-0.2, 2.9, 0.85, 0.85], [0.25, 4.0, 0.15, 0.8]];
    bolas.forEach(([bx, by, bz, br], i) => L.add(new THREE.IcosahedronGeometry(br * s, 1), ['hoja', 'hojaOsc', 'hojaClara'][i % 3], x + bx * s, by * s, z + bz * s));
    sombras.push([x, z, 2.2 * s, 0.4]);
  };
  const pino = (x, z, s) => {
    L.add(cil(0.1 * s, 0.2 * s, 2.0 * s, 8), 'corteza', x, 1.0 * s, z);
    [[1.5, 1.9, 1.6], [1.2, 1.7, 2.6], [0.85, 1.5, 3.5], [0.5, 1.2, 4.3]].forEach(([rad, h, y], i) =>
      L.add(new THREE.ConeGeometry(rad * s, h * s, 10), i % 2 ? 'pinoOsc' : 'pino', x, y * s, z));
    sombras.push([x, z, 1.7 * s, 0.4]);
  };
  frondoso(-6.2, -3.2, 1.05); frondoso(5.6, -5.4, 0.9); frondoso(-4.6, 5.8, 0.8);
  pino(-3.2, -6.8, 1.1); pino(-7.8, 1.2, 0.95); pino(2.4, -8.2, 1.2); pino(7.6, -1.6, 0.85); pino(-8.4, -4.6, 0.8);
  // matorrales redondos
  for (const [x, z, s] of [[-2.9, -2.4, 0.55], [3.0, -2.6, 0.5], [-5.5, 2.0, 0.6], [6.4, 2.6, 0.5], [2.9, 6.6, 0.45]]) {
    L.add(new THREE.IcosahedronGeometry(s, 1), 'hojaOsc', x, s * 0.6, z, null, { escala: new THREE.Vector3(1.2, 0.8, 1) });
    L.add(new THREE.IcosahedronGeometry(s * 0.7, 1), 'hoja', x + s * 0.5, s * 0.5, z + s * 0.2);
    sombras.push([x, z, s * 1.8, 0.4]);
  }
  // rocas
  for (const [x, z, s] of [[4.5, 3.6, 0.5], [-6.8, -0.4, 0.4], [1.5, -6.0, 0.6], [8.6, 4.0, 0.45], [-3.4, 8.2, 0.4]]) {
    L.add(new THREE.IcosahedronGeometry(1, 1), 'piedraOsc', x, s * 0.25, z, { y: r() * 6 }, { escala: new THREE.Vector3(s * 1.3, s * 0.65, s), plano: true });
    sombras.push([x, z, s * 1.6, 0.35]);
  }
}

// ---------- Hierba y flores instanciadas ----------
function plantas(raiz, r) {
  const { AX, AZ } = CAB;
  const libre = (x, z) => {
    const d = Math.hypot(x, z);
    if (d > RADIO - 0.7) return false;
    if (Math.abs(x) < AX + 1.0 && Math.abs(z) < AZ + 1.0) return false; // al pie de la cabaña, tierra
    if (Math.abs(x - 0.2) < 1.1 && z > 1.9) return false; // el camino
    return true;
  };
  const sitios = (n, sem) => { const lista = []; let t = 0; while (lista.length < n && t++ < n * 10) { const a = r() * 7, d = Math.sqrt(r()) * RADIO; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (libre(x, z)) lista.push([x, z]); } return lista; };
  const mata = (() => { const L = new Lote({ rangoSuelo: 0.3, variacion: 0 }); for (let k = 0; k < 3; k++) { const g = new THREE.ConeGeometry(0.03, 0.26, 3); g.translate(0, 0.13, 0); L.add(g, k % 2 ? 'hierbaClara' : 'hierba', 0, 0, 0, { y: k * 2.1, z: (k - 1) * 0.3 }, { brillo: 1.1 }); } return mergeGeometries(L.cerrar()); })();
  const flor = (() => { const L = new Lote({ variacion: 0, rangoSuelo: 0.01 }); L.add(cil(0.006, 0.006, 0.2, 3), 'hierba', 0, 0.1, 0, null, { sinSuelo: true }); L.add(new THREE.IcosahedronGeometry(0.035, 0), 0xffffff, 0, 0.21, 0, null, { sinSuelo: true }); return mergeGeometries(L.cerrar()); })();
  const poner = (geo, lista, color, mat) => {
    const im = new THREE.InstancedMesh(geo, mat, lista.length), o = new THREE.Object3D(), c = new THREE.Color();
    lista.forEach(([x, z], i) => {
      o.position.set(x, 0, z); o.rotation.set(0, r() * 6, 0); o.scale.setScalar(0.7 + r() * 0.8); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, color(c));
    });
    im.receiveShadow = true; raiz.add(im);
  };
  poner(mata, sitios(320), (c) => c.setScalar(0.85 + r() * 0.3), material('doble'));
  // flores de colores apagados (blanco roto, amarillo pálido, malva)
  const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];
  poner(flor, sitios(70), (c) => c.set(FLORES[Math.floor(r() * 3)]), material('fijo'));
}
