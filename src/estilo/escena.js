// Kinhold — escena de la prueba de estilo v4 (suelo, bosque y hierba vienen de la escena común, src/mundo/) («realismo en miniatura»):
// claro abierto que sigue hasta el horizonte, cabaña de troncos sobre zócalo de piedra,
// leña, tocón con hacha, barril, banco, cerca, árboles, matas y flores.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETA, Lote, materialTex } from '../mundo/estilos.js';
import { azarLineal as azar } from '../logica/azar.js';
import { cil, copa, pisoPino, suelo as sueloComun, bosque as bosqueComun, plantas as plantasComun } from '../mundo/decorado.js';

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
  const grupos = fijo.cerrar((v, n) => {
    const dentro = Math.abs(v.x) < AX + 0.35 && Math.abs(v.z) < AZ + 0.35;
    return dentro && v.y > ALTO - 0.6 && v.y < ALTO + 0.1 && n.y < 0.5 ? 0.72 : 1; // bajo el alero
  }, true);
  // una malla por textura (madera, paja, piedra, corteza, hojas, cortes y lo liso)
  for (const [tipo, geos] of Object.entries(grupos)) {
    const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tipo));
    m.castShadow = m.receiveShadow = true; m.name = 'fijo_' + tipo;
    raiz.add(m);
  }
  raiz.add(suelo(sombras));
  bosque(raiz, r);
  plantas(raiz, r);
  return raiz;
}

// ---------- Suelo, bosque lejano y hierba: los de la escena común, con lo propio de la cabaña ----------
function suelo(sombras) {
  const T = new THREE.Color(PALETA.tierra), K = new THREE.Color(PALETA.camino);
  const { AX, AZ } = CAB;
  const tinte = (x, z, k) => {
    const camino = Math.max(0, 1 - Math.abs(x - 0.2 - Math.sin(z * 0.5) * 0.5) / 1.0) * (z > 1.9 ? 1 : 0);
    k.lerp(K, Math.min(0.85, camino * 1.2));
    const dCab = Math.hypot(Math.max(0, Math.abs(x) - AX), Math.max(0, Math.abs(z) - AZ));
    k.lerp(T, dCab < 0.6 ? 0.55 : dCab < 1.4 ? 0.55 * (1.4 - dCab) / 0.8 : 0);
    return 1 - 0.38 * Math.max(0, 1 - dCab / 0.9);
  };
  return sueloComun({ llano: 12, cerca: RADIO * 1.3, lejos: 90, sombras, tinte });
}
function bosque(raiz, r) {
  bosqueComun(raiz, r, { n: 36, desde: 15, hasta: 60, reparto: 0.8, llano: 12, libre: (x, z, d) => !(x > -4 && z > 4 && d < 38) }); // libre la vista desde la cámara
}
function plantas(raiz, r) {
  const { AX, AZ } = CAB;
  const libre = (x, z) => {
    const d = Math.hypot(x, z);
    if (d > RADIO - 0.7) return false;
    if (Math.abs(x) < AX + 1.0 && Math.abs(z) < AZ + 1.0) return false; // al pie de la cabaña, tierra
    if (Math.abs(x - 0.2) < 1.1 && z > 1.9) return false; // el camino
    return true;
  };
  plantasComun(raiz, r, { hierba: 170, flores: 70, radio: RADIO, libre });
}

// ---------- Cabaña ----------
function cabana(L, r, sombras) {
  const { AX, AZ, ZOCALO, HIL, N, RAD, SAL, SUB, VUELO } = CAB;
  const tronco = (largo, x, y, z, eje, color) => {
    const giro = eje === 'x' ? { z: Math.PI / 2 } : { x: Math.PI / 2 };
    L.add(cil(RAD, RAD, largo, 8, true), color, x, y, z, giro);
    for (const s of [-1, 1]) { // punta redondeada con el corte claro
      const d = largo / 2;
      const tapa = new THREE.ConeGeometry(RAD, RAD * 0.25, 8, 1, true); tapa.translate(0, RAD * 0.125, 0); // punta un poco abombada, 8 triángulos
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
    bolas.forEach(([bx, by, bz, br], i) => L.add(copa(br * s, 1, i + x), ['hoja', 'hojaOsc', 'hojaClara'][i % 3], x + bx * s, by * s, z + bz * s, null, { copa: 2.4 * s }));
    sombras.push([x, z, 2.2 * s, 0.4]);
  };
  const pino = (x, z, s) => {
    L.add(cil(0.1 * s, 0.2 * s, 2.0 * s, 8), 'corteza', x, 1.0 * s, z);
    [[1.5, 1.9, 1.6], [1.2, 1.7, 2.6], [0.85, 1.5, 3.5], [0.5, 1.2, 4.3]].forEach(([rad, h, y], i) =>
      L.add(pisoPino(rad * s, h * s, 10, i + z), i % 2 ? 'pinoOsc' : 'pino', x, y * s, z, { y: i * 0.7 }, { copa: 0 }));
    sombras.push([x, z, 1.7 * s, 0.4]);
  };
  frondoso(-6.2, -3.2, 1.05); frondoso(5.6, -5.4, 0.9); frondoso(-4.6, 5.8, 0.8);
  pino(-3.2, -6.8, 1.1); pino(-7.8, 1.2, 0.95); pino(2.4, -8.2, 1.2); pino(7.6, -1.6, 0.85); pino(-8.4, -4.6, 0.8);
  // matorrales redondos
  for (const [x, z, s] of [[-2.9, -2.4, 0.55], [3.0, -2.6, 0.5], [-5.5, 2.0, 0.6], [6.4, 2.6, 0.5], [2.9, 6.6, 0.45]]) {
    L.add(copa(s, 1, x), 'hojaOsc', x, s * 0.6, z, null, { escala: new THREE.Vector3(1.2, 0.8, 1), copa: 0 });
    L.add(copa(s * 0.7, 1, z), 'hoja', x + s * 0.5, s * 0.5, z + s * 0.2, null, { copa: 0 });
    sombras.push([x, z, s * 1.8, 0.4]);
  }
  // rocas
  for (const [x, z, s] of [[4.5, 3.6, 0.5], [-6.8, -0.4, 0.4], [1.5, -6.0, 0.6], [8.6, 4.0, 0.45], [-3.4, 8.2, 0.4]]) {
    L.add(new THREE.IcosahedronGeometry(1, 1), 'piedraOsc', x, s * 0.25, z, { y: r() * 6 }, { escala: new THREE.Vector3(s * 1.3, s * 0.65, s), plano: true });
    sombras.push([x, z, s * 1.6, 0.35]);
  }
}
