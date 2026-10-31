// Kinhold — lo que llevas se ve puesto en el personaje del taller (roadmap, hito «Equipo y carga»): el cinturón y lo
// que cuelga de él, la mochila o el bastidor a la espalda con lo que lleva dentro, lo del hombro y lo de las manos.
// Qué se lleva lo dice la lógica pura (src/logica/llevado.js, sacado del inventario); aquí se dibuja con el estilo v5
// (Lote: color por vértice y texturas por código) y se ajusta al cuerpo de cada uno.
//
// Cómo se ajusta: al ponerlo se mide el cuerpo vestido tal como está (los vértices de la piel y de la ropa, ya con
// los huesos; sin los brazos) y se sacan el contorno de la cintura, el pecho y la espalda y lo alto de los hombros.
// Cada pieza se hace en el espacio del cuerpo (mirando a +Z, la izquierda en +X) y se ata a un hueso (la pelvis, la
// espalda o una mano): en cada fotograma sigue a ese hueso como estaba al medirla. Así vale para cualquier
// complexión y cualquier ropa, y se mueve con la animación.
//
// Decisiones provisionales (anotadas en el diario y en el registro de la demo):
//  - Los huecos del cinturón cuelgan en este orden: cadera derecha, cadera izquierda, detrás a la derecha, detrás a
//    la izquierda. Lo pequeño que no es herramienta va en una bolsa de cuero; lo mediano, en un hatillo.
//  - Lo grande en las manos (el tronco corto) se lleva bajo, atravesado delante de los muslos, con las manos en
//    las puntas; sin animación propia de llevar en brazos (está en «espera de decisión»), los brazos no se cierran.
//  - Las hachas de las manos las pone el personaje (src/juego/personaje.js); aquí no se repiten.
import * as THREE from 'three';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { cajaR, deMano } from '../mundo/modelos.js';
import { OCULTO } from '../logica/detalle.js';
import { CATALOGO } from '../logica/inventario.js';
import { huellaLlevado } from '../logica/llevado.js';
import { modeloHacha } from './personaje.js'; // (se usa al montar: el ciclo entre los dos módulos no molesta)

const CUERO = 0x6b4c35, CUERO_OSC = 0x4f3726, FIBRA = 0x9c8a60, MIMBRE = 0xa38b5c, PLUMA = 0xc9c3b4;
const HACHAS = new Set(['hacha_mano', 'hacha_piedra', 'hacha_hierro']);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const nuevoLote = () => new Lote({ variacion: 0.05, rangoSuelo: 0.001, suelo: -100 });
const azar = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- medir el cuerpo ----------
const BRAZO = /upperarm|lowerarm|hand|thumb|index|middle|ring|pinky|metacarpal/;
const CABEZA = /(pelo|barba|ojo|iris|cejas|orejas|vello|cofia|dientes|lengua)/;
// Puntos del cuerpo vestido, en el espacio de `raiz` (el del personaje), sin brazos ni cabeza. También la altura del
// cinturón del taller si se ve (va sobre la última prenda ceñida).
function medir(mh, raiz) {
  raiz.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const pts = [], cint = [], p = new THREE.Vector3(), m = new THREE.Matrix4();
  mh.modelo.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible || o.userData.herramienta || CABEZA.test(o.name)) return;
    const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!pos || !si) return;
    const huesos = o.skeleton.bones.map(b => BRAZO.test(b.name) ? 2 : /head|neck/.test(b.name) ? 1 : 0);
    m.multiplyMatrices(inv, o.matrixWorld);
    const esCinturon = /_cinturon_/.test(o.name), paso = pos.count > 12000 ? 2 : 1;
    for (let i = 0; i < pos.count; i += paso) {
      // el hueso que más pesa: fuera los brazos (cuelgan junto a la cintura) y la cabeza
      let mejor = 0, w = -1;
      for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (wk > w) { w = wk; mejor = si.getComponent(i, k); } }
      if (huesos[mejor]) continue;
      o.getVertexPosition(i, p); p.applyMatrix4(m);
      (esCinturon ? cint : pts).push(p.x, p.y, p.z);
    }
  });
  let yCint = null;
  if (cint.length) { let s = 0; for (let i = 1; i < cint.length; i += 3) s += cint[i]; yCint = s / (cint.length / 3); }
  for (let i = 0; i < cint.length; i++) pts.push(cint[i]);
  return { pts: new Float32Array(pts), yCint };
}
// Contorno a la altura y: el centro (cx, cz) y, por cada uno de `n` ángulos (0 = delante, +Z; positivo hacia la
// izquierda, +X), lo más lejos que llega el cuerpo. Los ángulos sin puntos se rellenan con los vecinos.
function contorno(med, y, banda = 0.02, n = 48) {
  const P = med.pts;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - y) < banda) {
    x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]);
  }
  if (!isFinite(x0)) return null;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = new Float32Array(n);
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - y) < banda) {
    const dx = P[i] - cx, dz = P[i + 2] - cz, a = Math.atan2(dx, dz);
    const k = ((Math.round(a / (2 * Math.PI) * n) % n) + n) % n;
    r[k] = Math.max(r[k], Math.hypot(dx, dz));
  }
  for (let vuelta = 0; vuelta < n; vuelta++) for (let k = 0; k < n; k++) if (!r[k]) r[k] = Math.max(r[(k + n - 1) % n], r[(k + 1) % n]) * 0.999;
  // un poco suavizado: los pliegues de la ropa no se marcan en el cinturón
  const s = r.map((v, k) => (r[(k + n - 1) % n] + 2 * v + r[(k + 1) % n]) / 4);
  return { cx, cz, y, n, r: s, en: (a) => { const t = ((a / (2 * Math.PI) * n) % n + n) % n, k = Math.floor(t), f = t - k; return s[k % n] * (1 - f) + s[(k + 1) % n] * f; } };
}
const puntoEn = (c, a, fuera = 0, dy = 0) => { const r = c.en(a) + fuera; return v3(c.cx + Math.sin(a) * r, c.y + dy, c.cz + Math.cos(a) * r); };
// lo más alto del cuerpo en x (los hombros), cerca del centro de delante a atrás
function altoEn(med, x, z, ancho = 0.025) {
  const P = med.pts; let y = -Infinity;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - x) < ancho && Math.abs(P[i + 2] - z) < 0.07 && P[i + 1] > 1.1) y = Math.max(y, P[i + 1]);
  return isFinite(y) ? y : null;
}

// ---------- piezas ----------
// Banda de cuero que sigue el contorno (el cinto): `alto` de canto, `grueso` de grueso, separada `fuera` del cuerpo.
function banda(c, alto, grueso, fuera) {
  const n = c.n * 2, pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = i / n * 2 * Math.PI, r = c.en(a) + fuera, sx = Math.sin(a), sz = Math.cos(a);
    for (const [dr, dy] of [[0, -alto / 2], [grueso, -alto / 2], [grueso, alto / 2], [0, alto / 2]])
      pos.push(c.cx + sx * (r + dr), c.y + dy, c.cz + sz * (r + dr));
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    const a = i * 4 + k, b = i * 4 + (k + 1) % 4, a2 = a + 4, b2 = b + 4;
    idx.push(a, a2, b, b, a2, b2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// cordón que sigue unos puntos (cerrado o no)
const cordon = (puntos, r, cerrado = false, lados = 5) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos, cerrado, 'catmullrom', 0.3), Math.max(8, puntos.length * 6), r, lados, cerrado);
// Correa plana entre puntos (las de la mochila y la bandolera): tubo aplastado
function correa(L, puntos, ancho = 0.035, grueso = 0.006, color = CUERO) {
  const curva = new THREE.CatmullRomCurve3(puntos, false, 'catmullrom', 0.3), n = Math.max(10, puntos.length * 8);
  const pos = [], idx = [], arriba = v3(0, 1, 0);
  const marcos = curva.computeFrenetFrames(n, false);
  for (let i = 0; i <= n; i++) {
    const p = curva.getPointAt(i / n), t = marcos.tangents[i];
    // lo ancho, de lado sobre el cuerpo: perpendicular a la tangente y lo más horizontal posible
    let lado = new THREE.Vector3().crossVectors(t, arriba); if (lado.lengthSq() < 1e-4) lado.set(1, 0, 0); lado.normalize();
    const nor = new THREE.Vector3().crossVectors(lado, t).normalize();
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(...p.clone().addScaledVector(lado, a * ancho / 2).addScaledVector(nor, b * grueso / 2).toArray());
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4; idx.push(a, a + 4, b, b, a + 4, b + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  L.add(g, color, 0, 0, 0, null, { tex: 'liso' });
}
// leña partida: un cuarto de tronco (corte en cuña), con su corteza y el corte claro
function astilla(L, x, y, z, largo, r, giro, s) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(giro.x || 0, giro.y || 0, giro.z || 0, 'YXZ'));
  const e = v3(1, 1, 0.75 + azar(s) * 0.25);
  L.add(new THREE.CylinderGeometry(r, r * 1.04, largo, 5), azar(s + 1) < 0.5 ? 'corteza' : 'madera', x, y, z, m.clone().multiply(new THREE.Matrix4().makeRotationY(s)), { plano: true, escala: e });
  // los cortes de las puntas, claros
  for (const k of [-1, 1]) {
    const c = new THREE.Vector3(0, k * (largo / 2 + 0.002), 0).applyMatrix4(m);
    L.add(new THREE.CircleGeometry(r * 0.95, 5), 'corte', x + c.x, y + c.y, z + c.z, m.clone().multiply(new THREE.Matrix4().makeRotationY(s)).multiply(new THREE.Matrix4().makeRotationX(k * -Math.PI / 2)), { sinSuelo: true, escala: e });
  }
}
function troncoCorto(L, x, y, z, largo, r, eje = 'x') {
  const giro = eje === 'x' ? { z: Math.PI / 2 } : { x: Math.PI / 2 };
  L.add(cil(r, r * 1.04, largo, 9), 'corteza', x, y, z, giro);
  for (const s of [-1, 1]) {
    const d = s * (largo / 2 + 0.002);
    L.add(new THREE.CircleGeometry(r * 0.97, 9), 'corte', x + (eje === 'x' ? d : 0), y, z + (eje === 'z' ? d : 0), eje === 'x' ? { y: s * Math.PI / 2 } : { y: s > 0 ? 0 : Math.PI }, { sinSuelo: true });
  }
}
function piedra(L, x, y, z, r, s) {
  L.add(new THREE.IcosahedronGeometry(r, 1), azar(s) < 0.5 ? 'piedra' : 'piedraOsc', x, y, z, { y: s * 2.1, x: s * 0.7 }, { escala: v3(1.2, 0.8, 1), plano: true });
}
// bolsa de cuero cerrada con un cordón (lo pequeño colgado del cinto)
function bolsa(L, x, y, z, s = 1, color = CUERO) {
  L.add(new THREE.IcosahedronGeometry(0.05 * s, 1), color, x, y - 0.06 * s, z, null, { escala: v3(1, 1.15, 0.6), plano: true, tex: 'liso' });
  L.add(cil(0.022 * s, 0.03 * s, 0.03 * s, 7), color, x, y - 0.012 * s, z, null, { tex: 'liso' });
  L.add(new THREE.TorusGeometry(0.023 * s, 0.004, 4, 10), FIBRA, x, y - 0.018 * s, z, { x: Math.PI / 2 }, { tex: 'liso' });
}
// hatillo de lino atado (lo mediano que no tiene modelo propio)
function hatillo(L, x, y, z, s = 1) {
  L.add(new THREE.IcosahedronGeometry(0.09 * s, 1), 'lino', x, y - 0.06 * s, z, { y: 0.5 }, { escala: v3(1.1, 0.8, 0.8), plano: true });
  L.add(new THREE.ConeGeometry(0.03 * s, 0.07 * s, 5), 'lino', x, y + 0.02 * s, z, null, { plano: true });
  L.add(new THREE.TorusGeometry(0.022 * s, 0.005, 4, 10), FIBRA, x, y, z, { x: Math.PI / 2 }, { tex: 'liso' });
}
// espada envainada: la vaina de cuero con contera de hierro, y el puño con su cruz y su pomo (en +Y, hacia arriba)
function espadaEnVaina(L) {
  L.add(cajaR(0.05, 0.82, 0.022, 0.01), CUERO_OSC, 0, -0.41, 0, null, { tex: 'liso' });
  L.add(cajaR(0.054, 0.05, 0.026, 0.008), 'hierro', 0, -0.8, 0);
  L.add(cajaR(0.054, 0.04, 0.026, 0.008), 'hierro', 0, 0.0, 0);
  L.add(cajaR(0.2, 0.018, 0.024, 0.006), 'hierro', 0, 0.03, 0);
  L.add(cil(0.014, 0.016, 0.1, 7), CUERO_OSC, 0, 0.09, 0, null, { tex: 'liso' });
  L.add(new THREE.SphereGeometry(0.024, 8, 5), 'hierro', 0, 0.15, 0, null, { escala: v3(1, 0.8, 0.6) });
}
// cuchillo en su funda: la funda de cuero y el mango de madera con el remate
function cuchilloEnFunda(L) {
  L.add(cajaR(0.04, 0.17, 0.016, 0.006), CUERO_OSC, 0, -0.085, 0, null, { tex: 'liso' });
  L.add(cil(0.011, 0.013, 0.1, 6), 'tabla', 0, 0.05, 0, null, { tex: 'veta' });
  L.add(cajaR(0.03, 0.01, 0.02, 0.003), 'hierro', 0, 0.002, 0);
}
// mango de herramienta (la pala, la azada, la hoz…): el mango de fresno y una cabeza sencilla de su material
function herramienta(L, t, largo = 0.7) {
  L.add(cil(0.014, 0.017, largo, 7), 'tabla', 0, largo / 2 - 0.08, 0, null, { tex: 'veta' });
  const y = largo - 0.08;
  if (t === 'pala_madera') L.add(cajaR(0.15, 0.24, 0.02, 0.01), 'tabla', 0, y + 0.1, 0, null, { tex: 'veta' });
  else if (t === 'azada') L.add(cajaR(0.1, 0.03, 0.14, 0.01), 'piedraOsc', 0, y, 0.06);
  else if (t === 'hoz_silex') L.add(new THREE.TorusGeometry(0.1, 0.012, 4, 10, Math.PI * 0.9), 0x3d3a36, 0, y + 0.02, 0.1, { y: Math.PI / 2 }, { plano: true });
  else if (t === 'mayal') { L.add(cil(0.016, 0.016, 0.4, 6), 'madera', 0.03, y + 0.15, 0.06, { x: 0.3 }, { tex: 'veta' }); }
  else if (t === 'arpon' || t === 'lanza_endurecida') L.add(new THREE.ConeGeometry(0.018, 0.14, 6), t === 'arpon' ? 'hierro' : 'maderaOsc', 0, y + 0.1, 0);
  else if (t === 'antorcha') L.add(cil(0.035, 0.025, 0.12, 7), 'paja', 0, y, 0);
  else if (t === 'palo_cavador') L.add(new THREE.ConeGeometry(0.016, 0.1, 6), 'maderaOsc', 0, -0.12, 0, { x: Math.PI });
}
// cesto de mimbre: tronco de cono con las hileras del trenzado y el borde
function cesto(L, alto, r0, r1, tapa = false) {
  L.add(cil(r1, r0, alto, 12, true), MIMBRE, 0, 0, 0, null, { tex: 'paja', rayas: (v) => 0.9 + 0.1 * Math.sin(v.y * 140) });
  L.add(new THREE.CircleGeometry(r0, 12), MIMBRE, 0, -alto / 2, 0, { x: Math.PI / 2 }, { tex: 'paja' });
  L.add(new THREE.TorusGeometry(r1, 0.012, 5, 14), 'madera', 0, alto / 2, 0, { x: Math.PI / 2 }, { tex: 'veta' });
  if (tapa) L.add(cil(r1 * 1.04, r1 * 1.04, 0.025, 12), MIMBRE, 0, alto / 2 + 0.012, 0, null, { tex: 'paja' });
}
// bastidor de palos atados (leñero, porta-piedras, mochila de bastidor): dos largueros, travesaños y la repisa de abajo
function bastidor(L, alto = 0.64, ancho = 0.3, repisa = 0.22) {
  for (const s of [-1, 1]) {
    L.add(cil(0.016, 0.019, alto, 7), 'madera', s * ancho / 2, 0, 0.03, null, { tex: 'veta' });
    L.add(cil(0.014, 0.014, repisa, 6), 'madera', s * ancho / 2, -alto / 2 + 0.03, 0.03 + repisa / 2, { x: Math.PI / 2 }, { tex: 'veta' });
  }
  for (const y of [alto / 2 - 0.05, 0.05, -alto / 2 + 0.03]) {
    L.add(cil(0.012, 0.012, ancho + 0.03, 6), 'maderaOsc', 0, y, 0.03, { z: Math.PI / 2 }, { tex: 'veta' });
    for (const s of [-1, 1]) L.add(new THREE.TorusGeometry(0.02, 0.005, 4, 8), FIBRA, s * ancho / 2, y, 0.03, { x: Math.PI / 2 }, { tex: 'liso' });
  }
  L.add(cil(0.012, 0.012, ancho + 0.03, 6), 'maderaOsc', 0, -alto / 2 + 0.03, 0.03 + repisa, { z: Math.PI / 2 }, { tex: 'veta' });
}

// Lo de la espalda, en su espacio: el origen sobre la espalda a media altura, +Z hacia fuera y +Y arriba.
// Devuelve { L, alto } (alto: lo que mide, para las correas).
function espalda(t, dentro) {
  const L = nuevoLote(), cuenta = (k) => dentro[k] || 0;
  if (t === 'lenero' || t === 'porta_piedras' || t === 'mochila_bastidor') {
    bastidor(L);
    if (t === 'lenero') {
      const troncos = Math.min(2, cuenta('tronco_corto')), lena = Math.min(18, cuenta('lena'));
      let y = -0.27;
      for (let i = 0; i < troncos; i++) { troncoCorto(L, 0, y + 0.115, 0.14, 0.6, 0.11); y += 0.23; }
      for (let i = 0; i < lena; i++) {
        const fila = Math.floor(i / 3), k = i % 3;
        if (y + 0.05 + fila * 0.085 > 0.32) break;
        astilla(L, 0.004 * (azar(i) - 0.5), y + 0.05 + fila * 0.085, 0.07 + k * 0.075, 0.42, 0.045, { z: Math.PI / 2, x: azar(i + 9) * 0.1, y: (azar(i + 3) - 0.5) * 0.12 }, i);
      }
    } else if (t === 'porta_piedras') {
      const n = Math.min(12, cuenta('piedra'));
      for (let i = 0; i < n; i++) { const f = Math.floor(i / 3), k = i % 3; piedra(L, (k - 1) * 0.09, -0.24 + f * 0.08, 0.1 + azar(i) * 0.06, 0.05, i); }
      // la red de cuerda que las sujeta
      for (const y of [-0.22, -0.1]) L.add(cil(0.004, 0.004, 0.32, 4), FIBRA, 0, y, 0.17, { z: Math.PI / 2 }, { tex: 'liso' });
    } else {
      // el saco de lona atado al bastidor, con la solapa de cuero
      L.add(cajaR(0.34, 0.46, 0.2, 0.06), 'lino', 0, 0.02, 0.15, null, { plano: false });
      L.add(cajaR(0.33, 0.14, 0.03, 0.012), CUERO, 0, 0.2, 0.26, { x: -0.18 }, { tex: 'liso' });
      for (const s of [-1, 1]) L.add(cajaR(0.03, 0.18, 0.006, 0.002), CUERO_OSC, s * 0.09, 0.13, 0.255, null, { tex: 'liso' });
    }
    return { L, alto: 0.64, bastidor: true };
  }
  if (t === 'zurron') {
    L.add(cajaR(0.3, 0.34, 0.13, 0.05), CUERO, 0, -0.02, 0.07, null, { tex: 'liso' });
    L.add(cajaR(0.31, 0.16, 0.025, 0.012), CUERO_OSC, 0, 0.09, 0.14, { x: -0.12 }, { tex: 'liso' });
    L.add(cajaR(0.04, 0.035, 0.01, 0.003), 'hierro', 0, 0.02, 0.152);
    return { L, alto: 0.36 };
  }
  if (t === 'fardo') {
    const n = Object.values(dentro).reduce((a, b) => a + b, 0), rollos = n > 6 ? 2 : 1;
    for (let i = 0; i < rollos; i++) {
      L.add(cil(0.1, 0.1, 0.48, 10), i ? 'lana' : 'piel', 0, -0.1 + i * 0.19, 0.1, { z: Math.PI / 2 }, { tex: 'tejido' });
      for (const s of [-1, 1]) L.add(new THREE.TorusGeometry(0.102, 0.007, 4, 12), FIBRA, s * 0.15, -0.1 + i * 0.19, 0.1, { y: Math.PI / 2 }, { tex: 'liso' });
    }
    return { L, alto: 0.4 };
  }
  if (t === 'cesta_recoleccion' || t === 'cesto_pescador') {
    const G = new THREE.Matrix4();
    const C = nuevoLote(); cesto(C, 0.4, 0.13, 0.17, t === 'cesto_pescador');
    for (const p of C.piezas) { p.m.premultiply(G.makeTranslation(0, 0, 0.17)); L.piezas.push(p); }
    // lo de dentro asoma por arriba (bayas oscuras, setas pardas, hierbas verdes…)
    const COLOR = { bayas: 0x5a2a33, setas: 0x9b8160, hierbas: 0x667d45, frutos_secos: 0x7b5a3a, huevo: 0xd8cfbc, pescado: 0x8a9095 };
    if (t === 'cesta_recoleccion') {
      let i = 0;
      for (const [k, n] of Object.entries(dentro)) for (let j = 0; j < Math.min(6, Math.ceil(n / 3)); j++, i++) {
        const a = i * 2.4, r = 0.04 + (i % 3) * 0.035;
        L.add(new THREE.IcosahedronGeometry(0.035, 0), COLOR[k] || 0x7a6a50, Math.cos(a) * r, 0.2, 0.17 + Math.sin(a) * r, { y: a }, { plano: true, escala: v3(1, 0.7, 1) });
      }
    }
    return { L, alto: 0.4 };
  }
  if (t === 'caja_herramientas') {
    L.add(cajaR(0.36, 0.4, 0.17, 0.015), 'tabla', 0, 0, 0.09, null, { tex: 'veta' });
    for (const y of [-0.15, 0.15]) L.add(cajaR(0.37, 0.03, 0.175, 0.006), 'maderaOsc', 0, y, 0.09, null, { tex: 'veta' });
    let i = 0;
    for (const k of Object.keys(dentro)) { if (i > 3) break; L.add(cil(0.014, 0.016, 0.22, 6), 'tabla', -0.12 + i * 0.08, 0.26, 0.06 + (i % 2) * 0.06, { z: (azar(i) - 0.5) * 0.3 }, { tex: 'veta' }); i++; }
    return { L, alto: 0.4 };
  }
  if (t === 'carcaj') {
    // tubo de cuero cruzado (la boca arriba, por detrás del hombro derecho) con las plumas asomando
    const m = new THREE.Matrix4().makeRotationZ(0.45);
    L.add(cil(0.05, 0.045, 0.62, 10), CUERO, 0, 0, 0.06, m, { tex: 'liso' });
    L.add(new THREE.TorusGeometry(0.05, 0.008, 4, 12), CUERO_OSC, -0.13, 0.28, 0.06, new THREE.Matrix4().makeRotationZ(0.45).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), { tex: 'liso' });
    const n = Math.min(8, Math.ceil(((dentro.flecha || 0) + (dentro.virote || 0)) / 3));
    for (let i = 0; i < n; i++) {
      const dx = (azar(i) - 0.5) * 0.05, dz = (azar(i + 4) - 0.5) * 0.05;
      const y = 0.36 + azar(i + 8) * 0.03, x = -Math.sin(0.45) * y + dx;
      L.add(cil(0.004, 0.004, 0.14, 4), 'tabla', x, Math.cos(0.45) * y, 0.06 + dz, m, { tex: 'liso' });
      L.add(cajaR(0.004, 0.06, 0.024, 0.001), PLUMA, x - 0.02, Math.cos(0.45) * y + 0.04, 0.06 + dz, m, { tex: 'liso' });
    }
    return { L, alto: 0.62, cruzada: true };
  }
  if (t === 'correa_escudo') {
    if (dentro.escudo) {
      L.add(cil(0.3, 0.3, 0.02, 18), 'tabla', 0, 0.02, 0.05, { x: Math.PI / 2 }, { tex: 'veta' });
      L.add(new THREE.TorusGeometry(0.3, 0.012, 5, 24), CUERO_OSC, 0, 0.02, 0.05, null, { tex: 'liso' });
      L.add(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'hierro', 0, 0.02, 0.06, { x: Math.PI / 2 });
    }
    return { L, alto: 0.6, cruzada: true };
  }
  hatillo(L, 0, 0.1, 0.1, 2.2);
  return { L, alto: 0.4 };
}

// Lo que va en la mano, en el espacio de la mano (como el hacha de src/juego/personaje.js: +Y del meñique al
// índice, +Z hacia los nudillos, el origen en el puño).
function enMano(t) {
  const L = nuevoLote();
  if (t === 'piedra' || t === 'mineral_hierro') piedra(L, 0, 0, 0.01, 0.06, 3);
  else if (t === 'silex') L.add(new THREE.IcosahedronGeometry(0.045, 1), 0xd8d2c4, 0, 0, 0.01, null, { plano: true, escala: v3(1.3, 0.8, 1), tex: 'piedra' });
  else if (t === 'rama' || t === 'vara') {
    L.add(cil(0.016, 0.022, t === 'vara' ? 1.6 : 1.0, 6), t === 'vara' ? 'madera' : 'corteza', 0, 0.1, 0, { x: 0.05 }, { tex: t === 'vara' ? 'veta' : 'corteza' });
    if (t === 'rama') L.add(cil(0.006, 0.01, 0.3, 5), 'corteza', 0.05, 0.35, 0, { z: -0.5 }, { tex: 'corteza' });
  } else if (t === 'lena') astilla(L, 0, 0, 0.02, 0.42, 0.045, {}, 2);
  else if (t === 'tabla') L.add(cajaR(0.18, 1.0, 0.025, 0.006), 'tabla', 0, 0.1, 0.03, null, { tex: 'veta' });
  else if (t === 'cuchillo' || t === 'lasca_silex') {
    L.add(cil(0.011, 0.013, 0.1, 6), 'tabla', 0, 0, 0, null, { tex: 'veta' });
    L.add(cajaR(0.026, 0.13, 0.004, 0.0015), 0x8e8f8e, 0, 0.11, 0.004, null, { plano: true, brillo: 1.1 });
  } else if (CATALOGO[t] && (CATALOGO[t].herramienta || ['lanza_endurecida', 'antorcha'].includes(t))) {
    const H = nuevoLote(); herramienta(H, t, t === 'lanza_endurecida' || t === 'arpon' ? 1.5 : 0.9);
    for (const p of H.piezas) { p.m.premultiply(new THREE.Matrix4().makeTranslation(0, -0.25, 0)); L.piezas.push(p); }
  } else if (t === 'espada') {
    L.add(cil(0.014, 0.016, 0.1, 7), CUERO_OSC, 0, 0, 0, null, { tex: 'liso' });
    L.add(cajaR(0.2, 0.018, 0.024, 0.006), 'hierro', 0, 0.06, 0, { y: Math.PI / 2 });
    L.add(cajaR(0.045, 0.78, 0.006, 0.002), 0x8e8f8e, 0, 0.46, 0, { y: Math.PI / 2 }, { plano: true, brillo: 1.1 });
    L.add(new THREE.SphereGeometry(0.022, 8, 5), 'hierro', 0, -0.07, 0);
  } else if (t === 'escudo') {
    L.add(cil(0.3, 0.3, 0.02, 18), 'tabla', 0.02, 0, 0.04, { z: Math.PI / 2 }, { tex: 'veta' });
    L.add(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'hierro', 0.035, 0, 0.04, { z: -Math.PI / 2 });
  } else if (CATALOGO[t] && CATALOGO[t].tam === 'P') bolsa(L, 0, 0.04, 0.02, 0.9, 'lino');
  else hatillo(L, 0, 0.04, 0.03, 1);
  return L;
}

// ---------- montar en el personaje ----------
// Atar `obj` (hecho en el espacio del cuerpo) a un hueso: se guarda dónde estaba respecto a él y, en cada fotograma,
// se vuelve a poner así (seguir()).
function atar(obj, hueso, invRaiz) {
  const rel = new THREE.Matrix4().multiplyMatrices(invRaiz, hueso.matrixWorld);
  obj.userData.hueso = hueso;
  obj.userData.desfase = rel.invert().multiply(obj.matrix.clone());
  obj.matrixAutoUpdate = false;
  return obj;
}
const _inv = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function seguir(grupo, raiz) {
  if (globalThis.__sinSeguirLlevado) return; // solo para comprobar que la prueba de seguir a los huesos falla
  // las dos matrices son las del último dibujo: así lo que se ha movido el personaje entre medias no cuenta
  _inv.copy(raiz.matrixWorld).invert();
  for (const o of grupo.children) {
    const em = o.userData.entreManos;
    if (em) { // lo grande en las dos manos: entre las dos, atravesado de una a otra
      em[0].getWorldPosition(_a).applyMatrix4(_inv); em[1].getWorldPosition(_b).applyMatrix4(_inv);
      _x.subVectors(_b, _a); const largo = _x.length(); _x.normalize();
      _y.set(0, 1, 0).addScaledVector(_x, -_x.y).normalize(); _z.crossVectors(_x, _y);
      o.matrix.makeBasis(_x, _y, _z).setPosition(_a.lerp(_b, 0.5).addScaledVector(_z, 0.06).addScaledVector(_y, 0.02));
      o.matrixWorldNeedsUpdate = true; o.userData.largoManos = largo;
      continue;
    }
    const h = o.userData.hueso; if (!h) continue;
    o.matrix.multiplyMatrices(_inv, h.matrixWorld).multiply(o.userData.desfase);
    o.matrixWorldNeedsUpdate = true;
  }
}
// Un modelo del lote en su sitio del cuerpo (matriz `m`) atado al hueso.
function pieza(L, nombre, m, hueso, invRaiz) {
  const g = deMano(L); g.name = 'llevado_' + nombre;
  g.matrix.copy(m); g.matrix.decompose(g.position, g.quaternion, g.scale);
  g.traverse(o => { if (o.isMesh) o.userData.herramienta = true; });
  return atar(g, hueso, invRaiz);
}
// La base de la mano, como empunar() de personaje.js: +Y del meñique al índice, +Z hacia los nudillos (en el cuerpo).
function baseMano(mh, lado, invRaiz, hasta = 1.1) {
  const h = mh.hueso, mano = h['hand_' + lado], med = h['middle_01_' + lado], ind = h['index_01_' + lado], men = h['pinky_01_' + lado];
  if (!mano || !med || !ind || !men) return null;
  const en = b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(invRaiz);
  const o = en(mano), pm = en(med), f = pm.clone().sub(o).normalize();
  const y = en(ind).sub(en(men)); y.addScaledVector(f, -y.dot(f)).normalize();
  const x = new THREE.Vector3().crossVectors(y, f);
  return { mano, m: new THREE.Matrix4().makeBasis(x, y, f).setPosition(o.lerp(pm, hasta)) };
}

// Crea lo que se ve de lo que lleva `j` (el de crearJugador). poner(llevado) lo rehace si ha cambiado; paso() en cada
// fotograma lo lleva con los huesos.
export function crearLlevado(j) {
  const grupo = new THREE.Group(); grupo.name = 'llevado';
  j.raiz.add(grupo);
  let huella = '', ultimo = null, medida = null, claveMedida = '';
  const vaciar = () => {
    for (const o of [...grupo.children]) { grupo.remove(o); o.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }
  };
  function montar(l) {
    vaciar();
    const mh = j.mh; if (!mh || !l) return;
    if (!l.cintura && !l.espalda && !l.hombro && !l.der && !l.izq) return; // nada encima: ni se mide el cuerpo
    // el cuerpo, medido solo si ha cambiado lo que lleva puesto (cuesta unos milisegundos)
    const clave = JSON.stringify([mh.capas, mh.hechuras, mh.nivel]);
    if (!medida || clave !== claveMedida) { medida = medir(mh, j.raiz); claveMedida = clave; }
    j.raiz.updateMatrixWorld(true);
    const invRaiz = new THREE.Matrix4().copy(j.raiz.matrixWorld).invert();
    const H = mh.hueso, pelvis = H.pelvis, pecho = H.spine_03 || H.spine_02 || pelvis;
    if (!pelvis) return;
    const yPelvis = pelvis.getWorldPosition(v3(0, 0, 0)).applyMatrix4(invRaiz).y;
    const yCuello = (H.neck_01 || pecho).getWorldPosition(v3(0, 0, 0)).applyMatrix4(invRaiz).y;
    const I = new THREE.Matrix4();

    // el cinturón: sobre el del taller si se ve, si no algo por encima de la pelvis
    const cinto = l.cintura;
    if (cinto) {
      const yC = medida.yCint ?? yPelvis + 0.075;
      const c = contorno(medida, yC, 0.025);
      if (c) {
        const L = nuevoLote();
        if (cinto === 'cordel' || cinto === 'cuerda_trenzada') {
          const g = cinto === 'cordel' ? 0.005 : 0.008, pts = [];
          for (let i = 0; i < 24; i++) pts.push(puntoEn(c, i / 24 * 2 * Math.PI, 0.004 + g));
          L.add(cordon(pts, g, true, cinto === 'cordel' ? 4 : 6), FIBRA, 0, 0, 0, null, { tex: 'liso', rayas: cinto === 'cuerda_trenzada' ? (v) => 0.85 + 0.15 * Math.sin((v.x + v.z) * 300) : null });
          // el nudo delante, un poco a la izquierda, con los dos cabos colgando
          const a = 0.25, p = puntoEn(c, a, 0.01 + g);
          L.add(new THREE.IcosahedronGeometry(g * 2.4, 1), FIBRA, p.x, p.y, p.z, null, { tex: 'liso', plano: true });
          for (const [k, largo] of [[-1, 0.16], [1, 0.12]]) {
            const q = puntoEn(c, a + k * 0.06, 0.012 + g, -largo);
            L.add(cordon([p, p.clone().lerp(q, 0.5).add(v3(0, 0, 0.01)), q], g * 0.9), FIBRA, 0, 0, 0, null, { tex: 'liso' });
          }
        } else {
          const ancho = cinto === 'cinto_armas' ? 0.048 : 0.036;
          L.add(banda(c, ancho, 0.006, 0.004), cinto === 'cinto_armas' ? CUERO_OSC : CUERO, 0, 0, 0, null, { tex: 'liso' });
          // la hebilla delante (de hierro), y el cabo que sobra cayendo
          const p = puntoEn(c, 0, 0.012), q = puntoEn(c, -0.12, 0.012, -0.12);
          L.add(new THREE.TorusGeometry(ancho * 0.55, 0.005, 4, 4), 'hierro', p.x, p.y, p.z, { z: Math.PI / 4 }, { escala: v3(1, 1.2, 1), plano: true });
          L.add(cajaR(0.004, ancho * 0.9, 0.006, 0.001), 'hierro', p.x, p.y, p.z + 0.004);
          correa(L, [puntoEn(c, -0.06, 0.012), puntoEn(c, -0.11, 0.016, -0.04), q], ancho * 0.9, 0.006, cinto === 'cinto_armas' ? CUERO_OSC : CUERO);
          if (cinto === 'cinto_anillas') for (const a of [0.9, -0.9]) {
            const r = puntoEn(c, a, 0.012, -0.028);
            L.add(new THREE.TorusGeometry(0.018, 0.004, 4, 10), 'hierro', r.x, r.y, r.z, { y: a }, { plano: true });
          }
        }
        grupo.add(pieza(L, 'cinturon', I, pelvis, invRaiz));
        // lo que cuelga de cada hueco: cadera derecha, izquierda, detrás a la derecha, detrás a la izquierda
        const SITIOS = [-1.25, 1.25, -2.2, 2.2];
        (l.colgado || []).forEach((t, i) => {
          if (!t) return;
          const a = t === 'espada' ? 1.15 : SITIOS[i], p = puntoEn(c, a, 0.018, -0.01);
          const C = nuevoLote();
          if (HACHAS.has(t)) { grupo.add(atar(colgarHacha(p, a), pelvis, invRaiz)); return; } // la cabeza arriba, el mango colgando
          if (t === 'espada') espadaEnVaina(C);
          else if (t === 'cuchillo' || t === 'lasca_silex') cuchilloEnFunda(C);
          else if (CATALOGO[t].herramienta) herramienta(C, t, 0.55);
          else if (CATALOGO[t].tam === 'P') bolsa(C, 0, 0, 0, 1);
          else hatillo(C, 0, 0, 0, 0.9);
          // de lado sobre la cadera, mirando hacia fuera; la espada inclinada hacia atrás
          const m = new THREE.Matrix4().makeRotationY(a);
          if (t === 'espada') m.multiply(new THREE.Matrix4().makeRotationZ(0.5)).multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)); // la punta hacia atrás
          else if (CATALOGO[t].herramienta && t !== 'cuchillo') m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, -0.05, 0));
          m.setPosition(p);
          grupo.add(pieza(C, 'colgado_' + i, m, pelvis, invRaiz));
        });
      }
    }

    // la espalda y el pecho, medidos a media espalda y a la altura de las axilas
    const yHombro = yCuello - 0.06;
    const cE = contorno(medida, yHombro - 0.2, 0.03), cH = contorno(medida, yHombro - 0.06, 0.025);
    const hombroDe = (s) => { // lo alto del hombro de ese lado (s: +1 izquierda, -1 derecha)
      const x = (cH ? cH.cx : 0) + s * 0.11, y = altoEn(medida, x, cH ? cH.cz : 0);
      return v3(x, (y ?? yHombro) + 0.006, cH ? cH.cz : 0);
    };
    if (l.espalda && cE && cH) {
      const { L, alto, cruzada, bastidor: esBastidor } = espalda(l.espalda, l.dentro || {});
      // el bastidor sube hasta los hombros; las bolsas y los cestos, algo más abajo
      const yCentro = esBastidor ? yHombro + 0.03 - alto / 2 : yHombro - 0.08 - alto / 2;
      const cC = contorno(medida, Math.max(yCentro, yPelvis + 0.12), 0.03) || cE;
      const zAtras = Math.min(cE.cz - cE.en(Math.PI), cC.cz - cC.en(Math.PI)) - 0.012;
      const m = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(cE.cx, yCentro, zAtras);
      // las correas: de arriba del bulto, por encima del hombro, bajan por delante y vuelven bajo el brazo
      const zDel = cH.cz + cH.en(0);
      if (cruzada) {
        const h = hombroDe(-1), cin = contorno(medida, yPelvis + 0.12, 0.03) || cC;
        correa(L, [v3(h.x - 0.02, h.y - 0.1, zAtras), v3(h.x, h.y, h.z), v3(h.x + 0.06, h.y - 0.08, zDel + 0.01),
          puntoEn(cE, 0.2, 0.01), puntoEn(cin, 0.9, 0.01), puntoEn(cin, 1.6, 0.012), v3(cE.cx + 0.15, cin.y + 0.02, zAtras)].map(p => p.clone().applyMatrix4(new THREE.Matrix4().copy(m).invert())), 0.03);
      } else for (const s of [1, -1]) {
        const h = hombroDe(s), yA = yHombro - 0.16;
        const pts = [v3(cE.cx + s * 0.07, yHombro - 0.1, zAtras + 0.01), v3(h.x - s * 0.01, h.y, h.z - 0.03), v3(h.x + s * 0.005, h.y - 0.02, h.z + 0.04),
          puntoEn(cH, s * 0.6, 0.008, -0.08), puntoEn(contorno(medida, yA, 0.025) || cH, s * 1.15, 0.01), v3(cE.cx + s * 0.13, yCentro - alto * 0.3, zAtras + 0.02)];
        correa(L, pts.map(p => p.clone().applyMatrix4(new THREE.Matrix4().copy(m).invert())), 0.032);
      }
      grupo.add(pieza(L, 'espalda', m, pecho, invRaiz));
    }

    // al hombro
    if (l.hombro && cH && cE) {
      const L = nuevoLote(), h = hombroDe(-1), t = l.hombro;
      if (t === 'tronco_corto') {
        troncoCorto(L, h.x - 0.045, h.y + 0.085, h.z - 0.1, 0.9, 0.1, 'z');
      } else if (t === 'saco') {
        // el saco lleno, echado sobre el hombro derecho y colgando a la espalda; la boca atada por delante
        L.add(new THREE.IcosahedronGeometry(0.2, 2), 'lino', h.x - 0.02, h.y - 0.12, h.z - 0.2, { x: 0.35 }, { escala: v3(0.85, 1.25, 0.65), plano: true });
        L.add(new THREE.IcosahedronGeometry(0.07, 1), 'lino', h.x, h.y + 0.04, h.z - 0.01, null, { escala: v3(1, 0.7, 1.2), plano: true });
        L.add(new THREE.ConeGeometry(0.04, 0.12, 6), 'lino', h.x + 0.005, h.y + 0.02, h.z + 0.1, { x: 1.8 }, { plano: true });
        L.add(new THREE.TorusGeometry(0.022, 0.005, 4, 10), FIBRA, h.x + 0.005, h.y + 0.025, h.z + 0.07, null, { tex: 'liso' });
      } else {
        // bandolera u odre: la correa cruzada del hombro derecho a la cadera izquierda, y la bolsa o el odre allí
        const cin = contorno(medida, yPelvis + 0.05, 0.03) || cE, abajo = puntoEn(cin, 1.35, 0.03);
        const pts = [puntoEn(cE, -2.6, 0.01), v3(h.x, h.y, h.z - 0.04), v3(h.x, h.y - 0.005, h.z + 0.045), puntoEn(cH, -0.35, 0.012, -0.03),
          puntoEn(cE, 0.25, 0.012), puntoEn(contorno(medida, (cE.y + cin.y) / 2, 0.03) || cE, 0.85, 0.015), abajo];
        correa(L, pts, 0.03, 0.006, t === 'odre' ? CUERO_OSC : CUERO);
        if (t === 'odre') {
          L.add(new THREE.IcosahedronGeometry(0.09, 2), CUERO, abajo.x + 0.02, abajo.y - 0.1, abajo.z, null, { escala: v3(0.65, 1.2, 0.7), tex: 'liso' });
          L.add(cil(0.015, 0.02, 0.05, 6), CUERO_OSC, abajo.x + 0.02, abajo.y + 0.01, abajo.z, null, { tex: 'liso' });
          L.add(cil(0.011, 0.011, 0.025, 6), 'tabla', abajo.x + 0.02, abajo.y + 0.045, abajo.z, null, { tex: 'veta' });
        } else {
          L.add(cajaR(0.2, 0.18, 0.07, 0.03), CUERO, abajo.x + 0.03, abajo.y - 0.1, abajo.z, { y: 1.35 }, { tex: 'liso' });
          L.add(cajaR(0.21, 0.09, 0.02, 0.01), CUERO_OSC, abajo.x + 0.06, abajo.y - 0.05, abajo.z + 0.01, { y: 1.35 }, { tex: 'liso' });
        }
      }
      grupo.add(pieza(L, 'hombro', I, pecho, invRaiz));
    }

    // en las manos (el hacha la pone el personaje)
    if (l.dos && l.der) {
      const L = nuevoLote();
      if (l.der === 'tronco_corto' || l.der === 'tronco_delgado') troncoCorto(L, 0, 0, 0, l.der === 'tronco_corto' ? 0.9 : 1.2, l.der === 'tronco_corto' ? 0.13 : 0.09, 'x');
      else hatillo(L, 0, 0.12, 0, 2.2);
      // va entre las dos manos (con la animación de llevar en brazos, delante del pecho): lo pone seguir()
      const g = deMano(L); g.name = 'llevado_manos'; g.matrixAutoUpdate = false;
      g.traverse(o => { if (o.isMesh) o.userData.herramienta = true; });
      if (H.hand_r && H.hand_l) { g.userData.entreManos = [H.hand_r, H.hand_l]; grupo.add(g); }
    } else for (const [lado, t] of [['r', l.der], ['l', l.izq]]) {
      if (!t || HACHAS.has(t)) continue;
      // lo largo (herramientas, ramas, varas) por el puño, como el hacha; lo redondo (una piedra), en la palma
      const largo = ['rama', 'vara', 'tabla', 'lena', 'espada', 'cuchillo', 'lasca_silex'].includes(t) || (CATALOGO[t] && CATALOGO[t].herramienta);
      const b = baseMano(mh, lado, invRaiz, largo ? 1.1 : 0.6); if (!b) continue;
      grupo.add(pieza(enMano(t), 'mano_' + lado, b.m, b.mano, invRaiz));
    }
    seguir(grupo, j.raiz);
  }
  // el hacha por el cinto: el modelo de la mano, la cabeza arriba y el mango por dentro del cinturón
  function colgarHacha(p, a) {
    const g = new THREE.Group(); g.name = 'llevado_hacha_colgada';
    const h = modeloHacha(); h.scale.setScalar(0.8); h.position.set(0, -0.42, 0.0); h.rotation.set(0, Math.PI / 2, -0.12); g.add(h);
    g.traverse(o => { if (o.isMesh) o.userData.herramienta = true; });
    g.matrix.makeRotationY(a).setPosition(p);
    return g;
  }
  return {
    grupo,
    get llevado() { return ultimo; },
    // `l`: lo de src/logica/llevado.js (null: nada). Se rehace solo si ha cambiado o si ha cambiado la ropa.
    poner(l) {
      ultimo = l || null;
      const h = huellaLlevado(ultimo) + (j.mh ? JSON.stringify([j.mh.capas, j.mh.hechuras]) : '-');
      if (h === huella) return;
      huella = j.mh ? h : '';
      montar(ultimo);
    },
    rehacer() { huella = ''; this.poner(ultimo); },
    paso() {
      if (!j.mh) return;
      grupo.visible = j.mh.nivel < OCULTO && j.mh.raiz.visible !== false;
      if (grupo.visible && grupo.children.length) seguir(grupo, j.raiz);
    },
  };
}
