// Kinhold — escena de la prueba de estilo v2: claro con cabaña de troncos y tejado de paja.
// Todo lo fijo va en una sola malla; árboles, rocas y matas, instanciados.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETA, Lote, material } from './estilos.js';

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cil = (r1, r2, h, lados, abierto = false) => new THREE.CylinderGeometry(r1, r2, h, lados, 1, abierto);
const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// Medidas de la cabaña (las del juego: hiladas de 25 cm)
export const CAB = { AX: 2.0, AZ: 1.8, BASE: 0.3, HIL: 0.25, N: 9, RAD: 0.135, SAL: 0.3, SUB: 1.6, VUELO: 0.55 };

export function crearEscena() {
  const raiz = new THREE.Group();
  const r = azar(11);
  raiz.add(suelo());
  const fijo = new Lote({ variacion: 0.08 });
  cabana(fijo, r);
  enseres(fijo, r);
  const { AX, AZ, BASE, N, HIL } = CAB, ALTO = BASE + N * HIL + HIL / 2;
  const geos = fijo.cerrar((v) => {
    // bajo el alero y dentro de los huecos, más oscuro
    const dentro = Math.abs(v.x) < AX + 0.35 && Math.abs(v.z) < AZ + 0.35;
    return dentro && v.y > ALTO - 0.5 && v.y < ALTO + 0.1 ? 0.75 : 1;
  });
  const m = new THREE.Mesh(mergeGeometries(geos), material('fijo'));
  m.castShadow = m.receiveShadow = true; m.name = 'fijo';
  raiz.add(m);
  vegetacion(raiz, r);
  return raiz;
}

// ---------- Suelo con color por vértice (hierba, claros, tierra pisada y camino) ----------
function suelo() {
  const n = 40, L = 110;
  const geo = new THREE.PlaneGeometry(L, L, n, n); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = [];
  const H = new THREE.Color(PALETA.hierba), C = new THREE.Color(PALETA.hierbaClara), T = new THREE.Color(PALETA.tierra), K = new THREE.Color(PALETA.camino), k = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z);
    const ond = (Math.sin(x * 0.09) * Math.cos(z * 0.08) + Math.sin((x - z) * 0.045)) * 0.9;
    pos.setY(i, d > 10 ? ond * Math.min(1, (d - 10) / 10) : 0);
    const m = Math.sin(x * 0.35 + 1) * Math.cos(z * 0.3) * 0.5 + 0.5;
    k.copy(H).lerp(C, m * 0.55);
    const camino = Math.max(0, 1 - Math.abs(x - 0.2 - Math.sin(z * 0.4) * 0.6) / 1.1) * (z > 1.8 ? 1 : 0);
    k.lerp(K, Math.min(0.9, camino * 1.2));
    k.lerp(T, d < 3.4 ? 0.6 : d < 4.6 ? 0.6 * (4.6 - d) / 1.2 : 0);
    col.push(k.r, k.g, k.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material('fijo')); m.receiveShadow = true; m.name = 'suelo';
  return m;
}

// ---------- Cabaña ----------
function cabana(L, r) {
  const { AX, AZ, BASE, HIL, N, RAD, SAL, SUB, VUELO } = CAB;
  // tronco tumbado a lo largo de X o Z, con el corte claro en las puntas
  const tronco = (largo, x, y, z, eje, color) => {
    const giro = eje === 'x' ? { z: Math.PI / 2 } : { x: Math.PI / 2 };
    L.add(cil(RAD, RAD, largo, 7, true), color, x, y, z, giro); // abierto: las puntas son los cortes
    for (const s of [-1, 1]) {
      const d = largo / 2 + 0.004;
      L.add(new THREE.CircleGeometry(RAD * 0.85, 7), 'corte', x + (eje === 'x' ? s * d : 0), y, z + (eje === 'z' ? s * d : 0),
        eje === 'x' ? { y: s * Math.PI / 2 } : { y: s > 0 ? 0 : Math.PI });
    }
  };
  // vetas de la paja: franjas suaves de color a lo largo de la pendiente
  const rayasPaja = (v) => 1 + Math.sin(v.x * 9.3 + Math.sin(v.x * 2.1) * 2) * 0.07 + Math.sin(v.x * 23.7) * 0.04;
  // cimiento de piedras
  const per = 2 * (2 * AX + 2 * AZ), nP = 26;
  for (let i = 0; i < nP; i++) {
    let s = (i + 0.5) / nP * per, x, z;
    if (s < 2 * AX) { x = -AX + s; z = AZ; } else if ((s -= 2 * AX) < 2 * AZ) { x = AX; z = AZ - s; } else if ((s -= 2 * AZ) < 2 * AX) { x = AX - s; z = -AZ; } else { s -= 2 * AX; x = -AX; z = -AZ + s; }
    L.add(new THREE.DodecahedronGeometry(0.25 + r() * 0.07, 0), r() > 0.5 ? 'piedra' : 'piedraOsc', x, 0.12, z, { x: r() * 3, y: r() * 3 }, { escala: new THREE.Vector3(1.25, 0.6, 1.05) });
  }
  const PUERTA = [-0.5, 0.5], ALTO_P = 2.0, VENT = [-0.45, 0.45], VY = [1.05, 1.65];
  for (let k = 0; k < N; k++) {
    const yX = BASE + RAD + k * HIL, yZ = yX + HIL / 2;
    const c = r() > 0.5 ? 'madera' : 'maderaOsc';
    for (const z of [AZ, -AZ]) {
      if (z > 0 && yX < BASE + ALTO_P) {
        const a = -AX - SAL, b = PUERTA[0], cc = PUERTA[1], d = AX + SAL;
        tronco(b - a, (a + b) / 2, yX, z, 'x', c); tronco(d - cc, (cc + d) / 2, yX, z, 'x', c);
      } else tronco(2 * (AX + SAL), 0, yX, z, 'x', c);
    }
    for (const x of [AX, -AX]) {
      if (x > 0 && yZ > BASE + VY[0] && yZ < BASE + VY[1]) {
        const a = -AZ - SAL, b = VENT[0], cc = VENT[1], d = AZ + SAL;
        tronco(b - a, x, yZ, (a + b) / 2, 'z', c); tronco(d - cc, x, yZ, (cc + d) / 2, 'z', c);
      } else tronco(2 * (AZ + SAL), x, yZ, 0, 'z', c);
    }
  }
  const ALTO = BASE + N * HIL + HIL / 2;
  // interior en penumbra (se ve por la puerta y la ventana)
  L.add(caja(2 * AX - 0.32, 0.02, 2 * AZ - 0.32), 'maderaOsc', 0, BASE + 0.02, 0, null, { brillo: 0.45 });
  L.add(caja(2 * AX - 0.32, ALTO - BASE, 0.02), 'maderaOsc', 0, (ALTO + BASE) / 2, -AZ + 0.17, null, { brillo: 0.35 });
  L.add(caja(0.02, ALTO - BASE, 2 * AZ - 0.32), 'maderaOsc', -AX + 0.17, (ALTO + BASE) / 2, 0, null, { brillo: 0.35 });
  L.add(caja(0.02, ALTO - BASE, 2 * AZ - 0.32), 'maderaOsc', AX - 0.17, (ALTO + BASE) / 2, 0, null, { brillo: 0.3 });
  // puerta de tablas entreabierta, con marco, dintel y umbral de piedra
  {
    const piv = new THREE.Matrix4().makeRotationY(-0.6);
    const w = (PUERTA[1] - PUERTA[0] - 0.04) / 5;
    for (let t = 0; t < 5; t++) {
      const p = new THREE.Vector3(w * (t + 0.5), (ALTO_P - 0.03) / 2, 0).applyMatrix4(piv);
      L.add(caja(w * 0.94, ALTO_P - 0.03, 0.05), t % 2 ? 'tabla' : 'madera', PUERTA[0] + 0.02 + p.x, BASE + p.y, AZ - 0.02 + p.z, { y: -0.6 });
    }
    for (const y of [0.35, 1.6]) {
      const p = new THREE.Vector3(w * 2.5, y, -0.045).applyMatrix4(piv);
      L.add(caja(w * 4.6, 0.1, 0.035), 'maderaOsc', PUERTA[0] + 0.02 + p.x, BASE + p.y, AZ - 0.02 + p.z, { y: -0.6 });
      const q = new THREE.Vector3(0.16, y, 0.032).applyMatrix4(piv);
      L.add(caja(0.3, 0.035, 0.012), 'hierro', PUERTA[0] + 0.02 + q.x, BASE + q.y, AZ - 0.02 + q.z, { y: -0.6 });
    }
    for (const x of PUERTA) L.add(caja(0.1, ALTO_P, 0.3), 'maderaOsc', x, BASE + ALTO_P / 2, AZ);
    L.add(caja(1.3, 0.14, 0.3), 'maderaOsc', 0, BASE + ALTO_P + 0.07, AZ);
    L.add(caja(1.15, 0.14, 0.5), 'piedraOsc', 0, 0.2, AZ + 0.14);
  }
  // ventana con marco y contraventana abierta
  {
    const y0 = BASE + VY[0], y1 = BASE + VY[1];
    for (const z of VENT) L.add(caja(0.3, y1 - y0 + 0.12, 0.08), 'maderaOsc', AX, (y0 + y1) / 2, z);
    for (const y of [y0, y1]) L.add(caja(0.34, 0.08, VENT[1] - VENT[0] + 0.18), 'maderaOsc', AX, y, 0);
    const wV = VENT[1] - VENT[0], th = 1.15; // contraventana abierta hacia fuera, colgada del lado derecho
    L.add(caja(0.04, y1 - y0, wV), 'tabla', AX + 0.17 + Math.sin(th) * wV / 2, (y0 + y1) / 2, VENT[1] + 0.06 + Math.cos(th) * wV / 2, { y: th });
  }
  // tejado a dos aguas de paja gruesa: losa, alero con flecos y cumbrera
  {
    const media = AZ + VUELO, pend = SUB / (AZ + 0.15), ang = Math.atan(pend);
    const largo = Math.hypot(media, media * pend) + 0.05, ancho = 2 * (AX + SAL) + 0.5, GR = 0.36;
    for (const s of [-1, 1]) {
      // matriz del faldón: gira desde la cumbrera
      const M = (lx, ly, lz) => {
        const m = new THREE.Matrix4().makeRotationX(s * ang);
        const p = new THREE.Vector3(lx, ly, lz).applyMatrix4(m);
        m.setPosition(p.x, ALTO + SUB + 0.05 + p.y, p.z);
        return m;
      };
      const losa = M(0, 0, s * largo / 2); const pl = new THREE.Vector3().setFromMatrixPosition(losa);
      L.add(new THREE.BoxGeometry(ancho, GR, largo, 28, 1, 4), 'paja', pl.x, pl.y, pl.z, losa, { rayas: rayasPaja });
      // bordes redondeados de la paja: rollo en el alero y en los dos lados
      { const mm = M(0, 0, s * largo); const p = new THREE.Vector3().setFromMatrixPosition(mm);
        mm.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        L.add(cil(GR * 0.58, GR * 0.58, ancho + 0.04, 7), 'paja', p.x, p.y, p.z, mm, { rayas: rayasPaja }); }
      for (const sx of [-1, 1]) {
        const mm = M(sx * ancho / 2, 0, s * largo / 2); const p = new THREE.Vector3().setFromMatrixPosition(mm);
        mm.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        L.add(cil(GR * 0.55, GR * 0.55, largo, 7), 'paja', p.x, p.y, p.z, mm);
      }
      // flecos del alero: cuñas que cuelgan y rompen la línea recta
      const nF = 22;
      for (let i = 0; i < nF; i++) {
        const x = -ancho / 2 + (i + 0.5) * ancho / nF, h = 0.16 + r() * 0.1;
        const mm = M(x, -GR / 2 - h / 2 + 0.06, s * (largo - 0.04)); const p = new THREE.Vector3().setFromMatrixPosition(mm);
        mm.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
        L.add(new THREE.ConeGeometry(ancho / nF * 0.62, h, 4), r() > 0.5 ? 'paja' : 'pajaOsc', p.x, p.y, p.z, mm);
      }
    }
    L.add(cil(0.22, 0.22, ancho + 0.08, 7), 'pajaOsc', 0, ALTO + SUB + 0.12, 0, { z: Math.PI / 2 });
    // hastiales de tablas verticales
    for (const sx of [-1, 1]) {
      const nT = 10, w = 2 * (AZ + 0.15) / nT;
      for (let t = 0; t < nT; t++) {
        const z = -AZ - 0.15 + w * (t + 0.5), h = Math.max(0.05, SUB * (1 - Math.abs(z) / (AZ + 0.15)));
        L.add(caja(0.06, h, w * 0.94), t % 2 ? 'tabla' : 'madera', sx * (AX + 0.02), ALTO + h / 2, z);
      }
    }
  }
}

// ---------- Leña, tocón con hacha, barril, banco y cerca ----------
function enseres(L, r) {
  const { AX, AZ } = CAB;
  for (let f = 0; f < 4; f++) for (let i = 0; i < 6 - (f % 2); i++) {
    const z = -0.75 + i * 0.155 + (f % 2) * 0.078, y = 0.08 + f * 0.135;
    L.add(cil(0.075, 0.075, 0.55, 6, true), r() > 0.5 ? 'madera' : 'maderaOsc', -AX - 0.55, y, z + 0.2, { z: Math.PI / 2 });
    for (const s of [-1, 1]) L.add(new THREE.CircleGeometry(0.065, 6), 'corte', -AX - 0.55 + s * 0.278, y, z + 0.2, { y: s * Math.PI / 2 });
  }
  L.add(cil(0.3, 0.34, 0.5, 9), 'madera', -1.9, 0.25, 2.9);
  L.add(cil(0.29, 0.29, 0.02, 9), 'corte', -1.9, 0.505, 2.9);
  const hacha = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0.6, 0.45, 'YXZ'));
  const ph = new THREE.Vector3(0, 0.36, 0).applyMatrix4(hacha);
  L.add(cil(0.018, 0.022, 0.75, 5), 'tabla', -1.85 + ph.x, 0.5 + ph.y, 2.9 + ph.z, hacha);
  const pc = new THREE.Vector3(0, 0.03, 0.04).applyMatrix4(hacha);
  L.add(caja(0.03, 0.09, 0.17), 'hierro', -1.85 + pc.x, 0.5 + pc.y, 2.9 + pc.z, hacha);
  // barril
  const bx = AX + 0.6, bz = AZ + 0.5;
  L.add(cil(0.27, 0.25, 0.8, 10), 'tabla', bx, 0.4, bz);
  L.add(cil(0.3, 0.3, 0.32, 10), 'tabla', bx, 0.4, bz);
  for (const y of [0.12, 0.68]) L.add(cil(0.285, 0.285, 0.04, 10), 'hierro', bx, y, bz);
  L.add(new THREE.CircleGeometry(0.26, 10), 'maderaOsc', bx, 0.802, bz, { x: -Math.PI / 2 });
  // banco junto a la pared
  L.add(caja(1.3, 0.07, 0.32), 'tabla', -1.1, 0.46, AZ + 0.42);
  for (const x of [-1.6, -0.6]) L.add(caja(0.08, 0.44, 0.28), 'maderaOsc', x, 0.22, AZ + 0.42);
  // cerca de varas
  for (let i = 0; i < 6; i++) {
    const x = 3.8 + i * 1.4, z = 4.5 - i * 0.35;
    L.add(cil(0.06, 0.075, 1.2, 6), 'maderaOsc', x, 0.6, z, { y: r() });
    if (i < 5) for (const y of [0.45, 0.95]) L.add(cil(0.035, 0.035, 1.45, 5), 'madera', x + 0.7, y, z - 0.175, { y: Math.atan2(0.35, 1.4), z: Math.PI / 2 });
  }
}

// ---------- Vegetación instanciada ----------
function modelo(fn, opc) { const L = new Lote(opc); fn(L); return mergeGeometries(L.cerrar()); }
function instancias(raiz, geo, lista, sombra = true, mat = material('fijo')) {
  const im = new THREE.InstancedMesh(geo, mat, lista.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  lista.forEach((p, i) => {
    o.position.set(p.x, p.y || 0, p.z); o.rotation.set(0, p.giro || 0, 0); o.scale.setScalar(p.esc || 1); o.updateMatrix();
    im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.setScalar(p.tono || 1));
  });
  im.castShadow = sombra; im.receiveShadow = true;
  raiz.add(im);
  return im;
}
function vegetacion(raiz, r) {
  const pino = modelo((L) => {
    L.add(cil(0.12, 0.24, 3.2, 6), 'corteza', 0, 1.6, 0);
    const pisos = [[2.2, 2.6, 1.7], [1.75, 2.3, 3.0], [1.25, 2.0, 4.2], [0.75, 1.7, 5.3]];
    pisos.forEach(([rad, h, y], i) => L.add(new THREE.ConeGeometry(rad, h, 6), i % 2 ? 'pinoOsc' : 'pino', 0, y, 0, { y: i * 0.7 }));
  }, { rangoSuelo: 2.5 });
  const frondoso = modelo((L) => {
    L.add(cil(0.16, 0.28, 2.8, 6), 'corteza', 0, 1.4, 0);
    L.add(cil(0.07, 0.1, 1.2, 5), 'corteza', 0.35, 2.6, 0, { z: -0.6 });
    const bolas = [[0, 3.6, 0, 1.5], [1.0, 3.1, 0.3, 1.1], [-0.9, 3.2, -0.2, 1.15], [0.2, 3.0, -1.0, 1.05], [-0.2, 3.1, 1.0, 1.0], [0.3, 4.4, 0.2, 0.95]];
    bolas.forEach(([x, y, z, s], i) => L.add(new THREE.IcosahedronGeometry(s, 0), ['hoja', 'hojaOsc', 'hojaClara'][i % 3], x, y, z, { x: i, y: i * 2 }));
  }, { rangoSuelo: 2.5 });
  const pinos = [], frond = [];
  for (let i = 0; i < 60; i++) {
    const ang = r() * Math.PI * 2, d = 12 + r() * 38;
    const x = Math.cos(ang) * d, z = Math.sin(ang) * d - 6;
    if (z > -2 && x > -9 && x < 30 && d < 30) continue; // libre la vista desde delante
    const p = { x, z, giro: r() * 6, esc: 0.8 + r() * 0.6, tono: 0.85 + r() * 0.3 };
    (i % 4 === 0 ? frond : pinos).push(p);
  }
  frond.push({ x: -7, z: -3, giro: 1, esc: 1.1, tono: 1 }, { x: 6.5, z: -6, giro: 2, esc: 0.9, tono: 0.95 });
  // solo los árboles cercanos echan sombra (la sombra cubre 13 m alrededor: más lejos sería gastar)
  const cerca = (p) => Math.hypot(p.x, p.z) < 16;
  instancias(raiz, pino, pinos.filter(cerca)); instancias(raiz, pino, pinos.filter(p => !cerca(p)), false);
  instancias(raiz, frondoso, frond.filter(cerca)); instancias(raiz, frondoso, frond.filter(p => !cerca(p)), false);
  // rocas
  const roca = modelo((L) => L.add(new THREE.DodecahedronGeometry(0.5, 0), 'piedraOsc', 0, 0.15, 0, null, { escala: new THREE.Vector3(1.2, 0.6, 1) }), { rangoSuelo: 0.4 });
  const rocas = [];
  for (let i = 0; i < 16; i++) { const a = r() * 7, d = 6 + r() * 20; rocas.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, giro: r() * 6, esc: 0.4 + r() * 1.1, tono: 0.85 + r() * 0.3 }); }
  instancias(raiz, roca, rocas, false);
  // matas de hierba: tres hojas en abanico
  const mata = modelo((L) => {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.ConeGeometry(0.035, 0.32, 3); g.translate(0, 0.16, 0);
      L.add(g, k === 1 ? 'hierbaClara' : 'hierba', 0, 0, 0, { y: k * 2.1, z: (k - 1) * 0.35 }, { brillo: 1.15 });
    }
  }, { rangoSuelo: 0.25, variacion: 0 });
  const matas = [];
  for (let i = 0; i < 480; i++) {
    const a = r() * 7, d = 4.2 + Math.pow(r(), 0.7) * 22, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x - 0.2) < 1.2 && z > 1.8 && z < 14) continue; // el camino
    matas.push({ x, z, giro: r() * 6, esc: 0.7 + r() * 0.9, tono: 0.85 + r() * 0.35 });
  }
  instancias(raiz, mata, matas, false, material('doble'));
}
