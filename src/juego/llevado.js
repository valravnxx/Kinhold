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
//  - Lo grande en las manos (el tronco corto) va entre las dos manos, con la animación de llevar en brazos
//    («cargar», Walk_Carry_Loop): los brazos lo sujetan delante; quieto, la misma postura.
//  - Las hachas de las manos las pone el personaje (src/juego/personaje.js); aquí no se repiten.
import * as THREE from 'three';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { cajaR, deMano } from '../mundo/modelos.js';
import { OCULTO } from '../logica/detalle.js';
import { CATALOGO } from '../logica/inventario.js';
import { huellaLlevado } from '../logica/llevado.js';
import { TRONCO_HOMBRO } from '../personajes/medidas_carga.js';
import { modeloHachaDe } from './personaje.js'; // (se usa al montar: el ciclo entre los dos módulos no molesta)
import { loteHachaPiedra, piezasArcoTaladro, piezasHuso, estacaEn } from './modelos_objetos.js';

const CUERO = 0x6b4c35, CUERO_OSC = 0x4f3726, PIEL_CRUDA = 0x9a7a56, PIEL_CRUDA_OSC = 0x634632, FIBRA = 0x9c8a60, MIMBRE = 0xa38b5c, PLUMA = 0xc9c3b4;
const CORDEL = 0xa8946a, CUERDA = 0x96805a, SILEX = 0x5d564e, SILEX_CLARO = 0x7a7064, CORTEZA_SILEX = 0xcfc6b2, TOSTADO = 0x2f2620;
const HACHAS = new Set(['hacha_mano', 'hacha_piedra', 'hacha_hierro', 'mazo_piedra']);   // (el mazo, por el cinto como el hacha)
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const nuevoLote = () => new Lote({ variacion: 0.05, rangoSuelo: 0.001, suelo: -100 });
const azar = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- medir el cuerpo ----------
const BRAZO = /upperarm|lowerarm|hand|thumb|index|middle|ring|pinky|metacarpal|Arm$|Hand$/; // (Arm, ForeArm y Hand: el esqueleto de Meshy)
const CABEZA = /(pelo|barba|ojo|iris|cejas|orejas|vello|cofia|dientes|lengua)/;
// Puntos del cuerpo vestido, en el espacio de `raiz` (el del personaje), sin brazos ni cabeza. También la altura del
// cinturón del taller si se ve (va sobre la última prenda ceñida).
function medir(mh, raiz) {
  raiz.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const pts = [], cint = [], tris = [], p = new THREE.Vector3(), m = new THREE.Matrix4();
  const cuello = mh.hueso && (mh.hueso.neck_01 || mh.hueso.spine_03), yAxila = cuello ? cuello.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).y - 0.14 : 1.25;
  mh.modelo.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible || o.userData.herramienta || CABEZA.test(o.name)) return;
    const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!pos || !si) return;
    const huesos = o.skeleton.bones.map(b => BRAZO.test(b.name) ? 2 : /head|neck/i.test(b.name) ? 1 : 0);
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
    // y la superficie del tronco (los triángulos sin brazos ni cabeza): a ella se pegan las correas (pegarAlCuerpo)
    // (de los brazos, solo lo de encima de las axilas: lo alto y lo de delante del hombro, por donde pasa la correa; lo de
    // más abajo cuelga junto al cuerpo y no es donde se apoya)
    const cuelloDe = o.skeleton.bones.map(b => /neck/i.test(b.name) ? 1 : 0);
    const idx = g.index, n = idx ? idx.count : pos.count, vale = new Int8Array(pos.count), xyz = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      let mejor = 0, w = -1;
      for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (wk > w) { w = wk; mejor = si.getComponent(i, k); } }
      if (huesos[mejor] === 1 && cuelloDe[mejor] === 0) continue;   // (del cuello, solo lo de más abajo: el pecho que asoma por la camisa)
      o.getVertexPosition(i, p); p.applyMatrix4(m);
      if (p.y < 0.8 || p.y > 1.8 || (huesos[mejor] === 2 && p.y < yAxila) || (huesos[mejor] === 1 && p.y > yAxila + 0.04)) continue;
      vale[i] = 1; xyz[i * 3] = p.x; xyz[i * 3 + 1] = p.y; xyz[i * 3 + 2] = p.z;
    }
    for (let t = 0; t + 2 < n; t += 3) {
      const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
      if (vale[a] && vale[b] && vale[c]) for (const v of [a, b, c]) tris.push(xyz[v * 3], xyz[v * 3 + 1], xyz[v * 3 + 2]);
    }
  });
  let yCint = null;
  if (cint.length) { let s = 0; for (let i = 1; i < cint.length; i += 3) s += cint[i]; yCint = s / (cint.length / 3); }
  for (let i = 0; i < cint.length; i++) pts.push(cint[i]);
  const sup = new THREE.BufferGeometry(); sup.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  return { pts: new Float32Array(pts), yCint, superficie: new THREE.Mesh(sup, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })) };
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

// Una correa pegada al cuerpo: la curva por los puntos de guía, en muchos puntos, y cada uno llevado a la superficie del
// tronco medida (lo más de fuera que se cruza, separado `fuera`), mirando desde dentro del cuerpo: por debajo de las
// axilas (cH.y), desde el eje del tronco a esa altura; por encima (el hombro), desde debajo del hombro, en su corte de
// lado. Así no queda en el aire ni entra en el cuerpo.
const _rayo = new THREE.Raycaster();
function pegarAlCuerpo(med, guia, cE, cH, fuera = 0.008, n = 56) {
  const sup = med.superficie; sup.geometry.computeBoundingSphere();
  // por delante, casi tocando (de lado se veía el aire entre la correa y el pecho); por detrás y por encima del hombro,
  // algo más, que al respirar suben los omóplatos y la tapaban
  const fueraDe = (d) => fuera - (fuera - 0.007) * Math.min(1, Math.max(0, d.z * 1.5));
  // cada punto, por su rayo desde dentro: lo más de fuera que cruza; donde no cruza nada (la abertura del cuello de la
  // camisa, algún hueco de la malla), lo que sale de sus vecinos
  const pegar = (lista) => {
    const r = lista.map(p => {
      const o = p.y >= cH.y ? v3(p.x, cH.y, cH.cz) : v3(cE.cx, p.y, (cE.cz + cH.cz) / 2), d = p.clone().sub(o).normalize();
      _rayo.set(o, d); _rayo.far = 0.6;
      let lejos = -1; for (const c of _rayo.intersectObject(sup, false)) lejos = Math.max(lejos, c.distance);
      return { o, d, lejos: lejos > 0 ? lejos : null };
    });
    const ok = r.map((x, i) => x.lejos != null ? i : -1).filter(i => i >= 0);
    return r.map((x, i) => {
      let l = x.lejos;
      if (l == null) {
        const a = ok.filter(k => k < i).pop(), b = ok.find(k => k > i);
        l = a == null && b == null ? 0.15 : a == null ? r[b].lejos : b == null ? r[a].lejos : r[a].lejos + (r[b].lejos - r[a].lejos) * (i - a) / (b - a);
      }
      const q = x.o.clone().addScaledVector(x.d, l + fueraDe(x.d)); q.nor = x.d; q.lejos = l; return q;
    });
  };
  const curva = new THREE.CatmullRomCurve3(guia, false, 'centripetal');
  if (globalThis.__correaSinPegar) return curva.getSpacedPoints(n).map(p => Object.assign(p, { nor: v3(0, 0, 1) })); // solo para comprobar que la prueba falla
  let pts = pegar(curva.getSpacedPoints(n));
  // y tensa, como va una correa de verdad: cada vuelta tira de cada punto hacia sus vecinos y, si así se mete en el
  // cuerpo, se queda en su superficie; donde el cuerpo se hunde (la abertura de la camisa, entre el pecho y el hombro)
  // pasa por encima, recta, sin escalones
  // (donde el rayo no cruza nada, un agujero de la malla medida, lo que dio al pegarla: si no, se metía en la espalda)
  const base = pts.map(p => p.lejos);
  const fuera_ = (p, i) => {
    const o = p.y >= cH.y ? v3(p.x, cH.y, cH.cz) : v3(cE.cx, p.y, (cE.cz + cH.cz) / 2), d = p.clone().sub(o), r = d.length(); d.normalize();
    _rayo.set(o, d); _rayo.far = 0.6;
    let lejos = -1; for (const c of _rayo.intersectObject(sup, false)) lejos = Math.max(lejos, c.distance);
    if (lejos <= 0) lejos = base[i];
    const f = fueraDe(d), q = lejos > 0 && r < lejos + f ? o.addScaledVector(d, lejos + f) : p.clone(); q.nor = d; return q;
  };
  for (let vuelta = 0; vuelta < 24; vuelta++)
    pts = pts.map((p, i) => i === 0 || i === pts.length - 1 ? p : fuera_(p.clone().multiplyScalar(2).add(pts[i - 1]).add(pts[i + 1]).multiplyScalar(1 / 4), i));
  // las normales, suavizadas (la malla es de pocas caras: de una a otra, la correa daba saltos de luz)
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const N = pts.map(p => p.nor.clone());
    pts.forEach((p, i) => { p.nor = N[i].clone().multiplyScalar(2).add(N[Math.max(0, i - 1)]).add(N[Math.min(N.length - 1, i + 1)]).normalize(); });
  }
  return pts;
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
// `normales` (si se dan, una por punto): hacia fuera del cuerpo; lo ancho va entonces tendido sobre él.
function correa(L, puntos, ancho = 0.035, grueso = 0.006, color = CUERO, normales = null) {
  const curva = new THREE.CatmullRomCurve3(puntos, false, 'catmullrom', 0.3), n = Math.max(10, Math.min(puntos.length * 8, 200));
  const pos = [], idx = [], arriba = v3(0, 1, 0);
  const marcos = curva.computeFrenetFrames(n, false);
  let antes = null;
  for (let i = 0; i <= n; i++) {
    const p = curva.getPointAt(i / n), t = marcos.tangents[i];
    // lo ancho, de lado sobre el cuerpo: perpendicular a la tangente y lo más horizontal posible; sin dar la vuelta de
    // un punto al siguiente (donde la correa va casi vertical, el de antes: si no, se retorcía)
    let lado = normales ? new THREE.Vector3().crossVectors(normales[Math.round(i / n * (normales.length - 1))], t) : new THREE.Vector3().crossVectors(t, arriba);
    if (lado.lengthSq() < 0.04 && antes) lado.copy(antes).addScaledVector(t, -antes.dot(t));
    if (lado.lengthSq() < 1e-6) lado.set(1, 0, 0);
    lado.normalize(); if (antes && lado.dot(antes) < 0) lado.negate(); antes = lado;
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

// Lo que se fabrica con las manos (tarea de P3, 7 nov), cada uno con su modelo en la mano y colgado del cinturón.
// La lasca de sílex: una esquirla de piedra oscura, fina y con filo, con un trozo de su costra clara (sin mango: se
// coge entre los dedos). A lo largo de +Y.
function lasca(L, x, y, z) {
  // facetada como sale al golpearla: un icosaedro aplastado y estirado, de sombreado plano, con el bulbo del golpe
  L.add(new THREE.IcosahedronGeometry(0.03, 0), SILEX, x, y, z, { z: 0.25, y: 0.4 }, { escala: v3(0.8, 1.55, 0.28), plano: true, tex: 'piedra', brillo: 1.08 });
  L.add(new THREE.IcosahedronGeometry(0.014, 0), SILEX_CLARO, x + 0.004, y + 0.02, z + 0.004, { y: 1.1 }, { escala: v3(0.9, 1.2, 0.35), plano: true, tex: 'piedra' });
  L.add(new THREE.IcosahedronGeometry(0.012, 0), CORTEZA_SILEX, x - 0.01, y - 0.032, z, null, { escala: v3(1, 0.8, 0.45), plano: true, tex: 'piedra' });
}
// El palo cavador: una rama recta pelada (1,1 m), más gruesa por arriba, con la punta en bisel endurecida al fuego.
// `abajo` es lo que sobresale del puño por debajo; la punta va hacia +Y.
function paloCavador(L, abajo) {
  L.add(cil(0.017, 0.021, 1.0, 7), 'madera', 0, 0.5 - abajo, 0, null, { tex: 'veta' });
  L.add(new THREE.ConeGeometry(0.017, 0.12, 7), 0x5a4532, 0, 1.06 - abajo, 0.004, null, { escala: v3(1, 1, 0.55), plano: true, tex: 'veta' });
  L.add(new THREE.ConeGeometry(0.008, 0.04, 6), TOSTADO, 0, 1.1 - abajo, 0.003, null, { escala: v3(1, 1, 0.55), plano: true });
  L.add(new THREE.CircleGeometry(0.021, 7), 'corte', 0, -abajo - 0.001, 0, { x: Math.PI / 2 });
}
// Una madeja (cordel) o una adujada (cuerda) cogida por un lado: espiras apretadas en el plano YZ, con la mano en el
// borde, y la vuelta que la ata.
function madeja(L, r, g, espiras, color) {
  // las espiras se abren en abanico desde la mano (giradas sobre el eje por el que cuelgan), no apiladas: así no
  // parece un tambor macizo
  for (let i = 0; i < espiras; i++) {
    const a = Math.PI / 2 + (i - (espiras - 1) / 2) * 0.32 + (azar(i) - 0.5) * 0.1, ri = r * (0.92 + azar(i + 5) * 0.12);
    L.add(new THREE.TorusGeometry(ri, g, 5, 22), color, 0, ri, 0, { y: a, x: (azar(i + 2) - 0.5) * 0.1 }, { tex: 'paja' });
  }
  L.add(new THREE.TorusGeometry(g * 2.2, g * 0.8, 4, 10), color, 0, 0.004, 0, { x: Math.PI / 2 }, { tex: 'liso' });   // la vuelta que las ata, en la mano
  L.add(cordon([v3(0, 0.004, 0), v3(0.02, 0.6 * r, 0.03), v3(0.01, 1.3 * r, 0.05)], g * 0.9), color, 0, 0, 0, null, { tex: 'paja' }); // el cabo suelto
}
// El taladro de fuego llevado: el arco cogido por una punta (a lo largo de +Y) con el huso metido en el cordel.
function arcoTaladro(L, y0) {
  piezasArcoTaladro(L, { y0, enSuelo: false });
  piezasHuso(L, 0, y0 + 0.3, 0.012, { z: Math.PI / 2, y: 0.3 });
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
    // (P9, 13 nov: ya se hace, de 2 pieles limpias y 1 cordel) un morral de piel sin curtir, panzudo y blando: el cuerpo
    // redondeado, plano contra la espalda; la solapa de borde redondo que cae por delante, cerrada con un palito
    // atravesado en un lazo de cordel
    // el cuerpo y la solapa, del mismo óvalo deformado (casi cuadrado, plano detrás, más lleno abajo); la solapa, la parte
    // de arriba y de delante, algo mayor, como una concha que cae por encima
    const forma = (g, k) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        x = Math.sign(x) * Math.abs(x) ** 0.65; y = Math.sign(y) * Math.abs(y) ** 0.75;   // más cuadrado
        p.setXYZ(i, x * (1 - 0.1 * Math.max(0, y)) * k, (y < 0 ? y * 0.92 : y) * k, (z < 0 ? z * 0.3 : z * (1 - 0.3 * Math.max(0, y))) * k);
      }
      g.computeVertexNormals();
      return g;
    };
    const E = v3(0.14, 0.17, 0.085), Y0 = 0.07, Z0 = -0.04;   // (pegado a la espalda: plano detrás)
    L.add(forma(new THREE.SphereGeometry(1, 16, 12), 1), PIEL_CRUDA, 0, Y0, Z0, null, { escala: E, tex: 'liso', rayas: v => 0.92 + 0.08 * Math.cos(v.x * 30 + v.y * 12) });
    // la superficie de delante del cuerpo en (x, y): la deformación de forma(), al revés
    const delante = (x, y) => {
      let yn = (y - Y0) / E.y; yn = yn < 0 ? yn / 0.92 : yn;
      const xn = x / (E.x * (1 - 0.1 * Math.max(0, yn))), x0 = Math.min(1, Math.abs(xn)) ** (1 / 0.65), y0 = Math.min(1, Math.abs(yn)) ** (1 / 0.75);
      return Z0 + E.z * Math.sqrt(Math.max(0, 1 - x0 * x0 - y0 * y0)) * (1 - 0.3 * Math.max(0, yn));
    };
    // la solapa: una hoja de arriba abajo, de borde redondo, pegada a la panza (y por arriba, doblada hacia atrás)
    const arriba = Y0 + E.y, abajo = Y0 - 0.025, ancho = 0.118, sol = new THREE.PlaneGeometry(2 * ancho, arriba - abajo, 10, 12), q = sol.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const x = q.getX(i), y = q.getY(i) + (arriba + abajo) / 2, u = x / ancho;
      const yy = Math.max(y, abajo + 0.07 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));   // el borde de abajo, redondo
      q.setXYZ(i, x * (1 - 0.1 * Math.max(0, (yy - Y0) / E.y)), yy, delante(x, Math.min(yy, arriba - 0.004)) + 0.007 + 0.014 * u * u + 0.01 * Math.max(0, (yy - Y0) / E.y) ** 3);
    }
    sol.computeVertexNormals();
    L.add(sol, PIEL_CRUDA_OSC, 0, 0, 0, null, { tex: 'liso', sinSuelo: true });
    const yb = abajo + 0.004, zb = delante(0, yb) + 0.012;
    L.add(cil(0.009, 0.008, 0.08, 6), 0xb59a72, 0, yb - 0.016, zb + 0.004, { z: Math.PI / 2 + 0.12 }, { tex: 'veta' });   // el palito, de madera pelada
    L.add(new THREE.TorusGeometry(0.012, 0.003, 4, 8), FIBRA, 0, yb, zb - 0.002, { x: 0.2 }, { tex: 'liso' });   // su lazo, de la solapa
    return { L, alto: 0.2, cruzada: true, morral: 0.07 };   // (una sola correa, cruzada del hombro a la cadera, como se lleva un morral; más arriba en la espalda: entre los omóplatos y los riñones)
  }
  if (t === 'fardo') {
    const n = Object.values(dentro).reduce((a, b) => a + b, 0), rollos = n > 6 ? 2 : 1;
    // con plantas (juncos, mimbre, paja, fibra) y sin pieles ni tela: haces de tallos atados, a lo ancho de la espalda
    const PLANTA = { junco: 'junco', mimbre: 'madera', paja: 'paja', fibra: 'paja' };
    const tipos = Object.keys(dentro).filter(k => dentro[k] > 0);
    if (tipos.length && tipos.every(k => PLANTA[k])) {
      const haces = Math.min(3, Math.max(1, Math.ceil(n / 4)));
      for (let i = 0; i < haces; i++) {
        const k = tipos[i % tipos.length], y = -0.12 + i * 0.13, z = 0.1 + (i % 2) * 0.03;
        L.add(cil(0.07, 0.075, 0.95, 9), PLANTA[k], 0, y, z, { z: Math.PI / 2 + (i - 1) * 0.04 }, { tex: k === 'mimbre' ? 'veta' : 'paja' });
        for (const s of [-1, 1]) L.add(new THREE.TorusGeometry(0.073, 0.007, 4, 12), FIBRA, s * 0.22, y, z, { y: Math.PI / 2 }, { tex: 'liso' });
      }
      return { L, alto: 0.4 };
    }
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
    const COLOR = { bayas: 0x5a2a33, setas: 0x9b8160, hierbas: 0x667d45, frutos_secos: 0x7b5a3a, huevo: 0xd8cfbc, pescado: 0x8a9095, semilla_cebada: 0xcdb46a, habas: 0x8a7a4e, semilla_col: 0x7a4a32, semilla_nabo: 0x2e2622 };
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

// Para las imágenes del panel de fabricar (herramientas/iconos/): el lote de lo de la espalda y de lo de la mano.
export { espalda as loteEspalda, enMano as loteEnMano };

// Lo que va en la mano, en el espacio de la mano (como el hacha de src/juego/personaje.js: +Y del meñique al
// índice, +Z hacia los nudillos, el origen en el puño).
// lo que se fabrica con las manos y tiene ya su modelo en la mano y en el cinturón (7 nov). __sinModelosManos (solo
// para comprobar que la prueba falla) los vuelve a dibujar con la bolsa o el hatillo de antes.
const HECHOS_A_MANO = new Set(['lasca_silex', 'palo_cavador', 'cordel', 'cuerda', 'taladro_fuego', 'lenero']);
const sinModelo = t => globalThis.__sinModelosManos && HECHOS_A_MANO.has(t);
function enMano(t) {
  const L = nuevoLote();
  if (sinModelo(t)) { hatillo(L, 0, 0.04, 0.03, 1); L.generico = true; }
  else if (t === 'piedra' || t === 'mineral_hierro') piedra(L, 0, 0, 0.01, 0.06, 3);
  else if (t === 'silex') L.add(new THREE.IcosahedronGeometry(0.045, 1), 0xd8d2c4, 0, 0, 0.01, null, { plano: true, escala: v3(1.3, 0.8, 1), tex: 'piedra' });
  else if (t === 'estaca') estacaEn(L, 0, -0.42, 0, { x: 0.05 });   // cogida por el medio, la punta abajo (P11)
  else if (t === 'rama' || t === 'vara') {
    L.add(cil(0.016, 0.022, t === 'vara' ? 1.6 : 1.0, 6), t === 'vara' ? 'madera' : 'corteza', 0, 0.1, 0, { x: 0.05 }, { tex: t === 'vara' ? 'veta' : 'corteza' });
    if (t === 'rama') L.add(cil(0.006, 0.01, 0.3, 5), 'corteza', 0.05, 0.35, 0, { z: -0.5 }, { tex: 'corteza' });
  } else if (t === 'lena') astilla(L, 0, 0, 0.02, 0.42, 0.045, {}, 2);
  else if (t === 'tabla') L.add(cajaR(0.18, 1.0, 0.025, 0.006), 'tabla', 0, 0.1, 0.03, null, { tex: 'veta' });
  else if (t === 'lasca_silex') lasca(L, 0, 0.045, 0.012);
  else if (t === 'palo_cavador') paloCavador(L, 0.4);
  else if (t === 'cordel') madeja(L, 0.045, 0.004, 7, CORDEL);
  else if (t === 'cuerda') madeja(L, 0.075, 0.009, 5, CUERDA);
  else if (t === 'taladro_fuego') arcoTaladro(L, -0.04);
  else if (t === 'cuchillo') {
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
  } else if (CATALOGO[t] && CATALOGO[t].tam === 'P') { bolsa(L, 0, 0.04, 0.02, 0.9, 'lino'); L.generico = true; }
  else { hatillo(L, 0, 0.04, 0.03, 1); L.generico = true; }
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
    const sh = o.userData.sobreHombro;
    if (sh) { sh.hueso.getWorldPosition(_a).applyMatrix4(_inv).sub(sh.de); o.matrix.makeTranslation(_a.x, _a.y, _a.z); o.matrixWorldNeedsUpdate = true; continue; }
    const h = o.userData.hueso; if (!h) continue;
    o.matrix.multiplyMatrices(_inv, h.matrixWorld).multiply(o.userData.desfase);
    o.matrixWorldNeedsUpdate = true;
  }
}
// Un modelo del lote en su sitio del cuerpo (matriz `m`) atado al hueso.
function pieza(L, nombre, m, hueso, invRaiz) {
  const g = deMano(L); g.name = 'llevado_' + nombre; g.userData.generico = !!L.generico; // con la bolsa o el hatillo de lo que aún no tiene modelo
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
    // (con correa cruzada, siempre: va pegada al pecho en la postura de ahora, y la de la última medida puede ser otra)
    const cruza = l.espalda && ['zurron', 'carcaj', 'correa_escudo'].includes(l.espalda);
    if (!medida || clave !== claveMedida || cruza) { medida = medir(mh, j.raiz); claveMedida = clave; }
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
          if (HACHAS.has(t)) { grupo.add(atar(colgarHacha(p, a, t), pelvis, invRaiz)); return; } // la cabeza arriba, el mango colgando
          if (sinModelo(t)) { hatillo(C, 0, 0, 0, 0.9); C.generico = true; }
          else if (t === 'espada') espadaEnVaina(C);
          else if (t === 'cuchillo') cuchilloEnFunda(C);
          else if (t === 'lasca_silex') { bolsa(C, 0, 0, 0, 0.8); lasca(C, 0.012, -0.025, 0.03); } // en su bolsita, asomando
          else if (t === 'palo_cavador') paloCavador(C, 0.82);       // metido en el cinto: cuelga por la pierna, la punta asoma arriba
          else if (t === 'cordel') madeja(C, 0.04, 0.004, 6, CORDEL);
          else if (t === 'cuerda') madeja(C, 0.07, 0.009, 5, CUERDA);
          else if (t === 'taladro_fuego') arcoTaladro(C, -0.3);
          else if (CATALOGO[t].herramienta) herramienta(C, t, 0.55);
          else if (CATALOGO[t].tam === 'P') { bolsa(C, 0, 0, 0, 1); C.generico = true; }
          else { hatillo(C, 0, 0, 0, 0.9); C.generico = true; }
          // de lado sobre la cadera, mirando hacia fuera; la espada inclinada hacia atrás
          const m = new THREE.Matrix4().makeRotationY(a);
          if (t === 'espada') m.multiply(new THREE.Matrix4().makeRotationZ(0.5)).multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)); // la punta hacia atrás
          else if (['cordel', 'cuerda'].includes(t)) m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, -0.01, 0)); // cuelga de su atadura
          else if (CATALOGO[t].herramienta && !['cuchillo', 'lasca_silex', 'palo_cavador', 'taladro_fuego'].includes(t)) m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, -0.05, 0));
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
      const { L, alto, cruzada, morral, bastidor: esBastidor } = espalda(l.espalda, l.dentro || {});
      // el bastidor sube hasta los hombros; las bolsas y los cestos, algo más abajo
      const yCentro = esBastidor ? yHombro + 0.03 - alto / 2 : yHombro - 0.08 - alto / 2;
      const cC = contorno(medida, Math.max(yCentro, yPelvis + 0.12), 0.03) || cE;
      const zAtras = Math.min(cE.cz - cE.en(Math.PI), cC.cz - cC.en(Math.PI)) - 0.012;
      const m = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(cE.cx, yCentro, zAtras);
      // las correas: de arriba del bulto, por encima del hombro, bajan por delante y vuelven bajo el brazo
      const zDel = cH.cz + cH.en(0);
      let correaCruzada = null;
      if (cruzada) {
        // una sola correa, cruzada del hombro derecho a la cadera izquierda, pegada al cuerpo (segunda mirada del zurrón,
        // 14 nov: de lado hacía un arco en el aire sobre el hombro y por el costado entraba en el antebrazo): se traza
        // por unos puntos de guía y cada tramo se pega a la superficie medida (pegarAlCuerpo)
        const h = hombroDe(-1), cin = contorno(medida, yPelvis + 0.12, 0.03) || cC;
        // (los puntos de guía solo dan la dirección desde dentro del cuerpo: luego se pegan a él)
        const x0 = cE.cx, zA = cE.cz - 0.3, zD = cE.cz + 0.3, yM = (h.y + cin.y) / 2;   // (yM: media altura, para el tahalí por la espalda)
        // por encima del hombro derecho: de la espalda a lo alto y al pecho
        const hombro = [v3(h.x + 0.01, h.y - 0.09, cH.cz - 0.3), v3(h.x, h.y + 0.05, cH.cz - 0.03), v3(h.x + 0.01, h.y + 0.05, cH.cz + 0.04)];
        // cruzando el pecho en diagonal hasta la cadera izquierda, y por el costado (por encima de la cadera) a la espalda
        // (en línea recta del hombro a la cadera, sin bajar primero en vertical)
        const F = v3(h.x + 0.01, h.y, zD), Hc = v3(x0 + 0.13, cin.y + 0.05, zD);
        const delante = [F.clone().lerp(Hc, 0.2), F.clone().lerp(Hc, 0.45), F.clone().lerp(Hc, 0.7), Hc, v3(x0 + 0.3, cin.y + 0.03, cE.cz + 0.12), v3(x0 + 0.3, cin.y + 0.03, cE.cz - 0.12)];
        let guia, ini = [], fin = [];
        if (morral != null) {
          // el morral (el zurrón): sale de lo alto de la bolsa, sube por la espalda al hombro y, tras el costado, vuelve a la bolsa
          const yB = yCentro + morral;
          // (sale de lo alto de la bolsa algo a la derecha, por donde sube al hombro: sin dar la vuelta en gancho)
          ini = [v3(cE.cx - 0.03, yB + 0.17, zAtras - 0.01)];
          guia = [v3(x0 - 0.04, yB + 0.25, zA), v3(x0 - 0.07, (yB + 0.25 + h.y) / 2, zA), ...hombro, ...delante];
          fin = [v3(cE.cx + 0.12, yB + 0.02, zAtras - 0.03)];
        } else {
          // el carcaj y el escudo: un tahalí entero, de la cadera izquierda por la espalda al hombro derecho y por el pecho a la cadera
          guia = [v3(x0 + 0.3, cin.y + 0.03, cE.cz - 0.12), v3(x0 + 0.1, cin.y + 0.08, zA), v3(x0 - 0.02, yM + 0.05, zA), ...hombro, ...delante];
        }
        const pegada = pegarAlCuerpo(medida, guia, cE, cH, 0.014), pts = [...ini, ...pegada, ...fin];
        correaCruzada = pegada.map(p => p.toArray());
        const nor = [...ini.map(() => pegada[0].nor), ...pegada.map(p => p.nor), ...fin.map(() => pegada[pegada.length - 1].nor)];
        const mi = new THREE.Matrix4().copy(m).invert();
        correa(L, pts.map(p => p.clone().applyMatrix4(mi)), 0.03, 0.006, CUERO, nor.map(d => d.clone().transformDirection(mi)));
      } else for (const s of [1, -1]) {
        const h = hombroDe(s), yA = yHombro - 0.16;
        const pts = [v3(cE.cx + s * 0.07, yHombro - 0.1, zAtras + 0.01), v3(h.x - s * 0.01, h.y, h.z - 0.03), v3(h.x + s * 0.005, h.y - 0.02, h.z + 0.04),
          puntoEn(cH, s * 0.6, 0.008, -0.08), puntoEn(contorno(medida, yA, 0.025) || cH, s * 1.15, 0.01), v3(cE.cx + s * 0.13, yCentro - alto * 0.3, zAtras + 0.02)];
        correa(L, pts.map(p => p.clone().applyMatrix4(new THREE.Matrix4().copy(m).invert())), 0.032);
      }
      const ge = pieza(L, 'espalda', m, pecho, invRaiz);
      if (correaCruzada) ge.userData.correa = correaCruzada;   // (la prueba mide si va pegada al cuerpo)
      grupo.add(ge);
    }

    // al hombro
    if (l.hombro && cH && cE) {
      const L = nuevoLote(), h = hombroDe(-1), t = l.hombro;
      let hueso = pecho, agarre = null;
      if (t === 'tronco_corto' || t === 'tronco_delgado') {
        // el delgado (7 nov: la madera de la casa humilde), igual pero más fino y más largo: con el mismo centro, así la
        // mano de la animación del taller lo sujeta igual por encima (queda 1 cm más alto sobre el hombro)
        const largo = t === 'tronco_delgado' ? 1.6 : 0.9, r = t === 'tronco_delgado' ? 0.09 : TRONCO_HOMBRO.r;
        // apoyado en lo alto del hombro derecho, encima de la articulación (no junto al cuello: ahí tapaba la cabeza,
        // revisión del 1 nov), y atado a la clavícula para que suba con el hombro en la postura de llevarlo.
        // La mano derecha lo sujeta por encima (la animación del taller, taller-carga-v3, con las mismas medidas).
        const s = H.upperarm_r && H.clavicle_r && !globalThis.__troncoComoAntes /* solo para comprobar que la prueba falla */ ? H.upperarm_r.getWorldPosition(v3(0, 0, 0)).applyMatrix4(invRaiz) : null;
        if (s) {
          // (en los de Meshy, algo más afuera, más alto y más adelante: su hombro es más estrecho y va más atrás que el del taller)
          const ms = mh.meshy ? { x: -0.035, y: 0.025, z: 0.04 } : { x: 0, y: 0, z: 0 };
          const x = s.x + TRONCO_HOMBRO.x + ms.x, z = s.z + TRONCO_HOMBRO.z + ms.z, yT = s.y + TRONCO_HOMBRO.y + ms.y;
          troncoCorto(L, x, yT, z, largo, r, 'z');
          hueso = H.clavicle_r;
          // donde van los nudillos de la mano derecha: encima del tronco, algo por delante del hombro (los personajes de
          // Meshy no traen la postura: el brazo se pone ahí, src/juego/personaje.js)
          agarre = v3(x, yT + r + 0.035, z + 0.04);
        } else troncoCorto(L, h.x - 0.045, h.y + 0.085, h.z - 0.1, largo, r, 'z');
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
      const g = pieza(L, 'hombro', I, hueso, invRaiz);
      if (agarre) g.userData.agarre = agarre;
      // (en los de Meshy el tronco no gira con ningún hueso: va recto, siguiendo solo dónde está el hombro derecho; sus
      // animaciones doblan mucho el pecho y la clavícula, y el tronco atado a ellos se cruzaba)
      if (agarre && mh.meshy && H.upperarm_r) { g.userData.hueso = null; g.userData.sobreHombro = { hueso: H.upperarm_r, de: H.upperarm_r.getWorldPosition(v3(0, 0, 0)).applyMatrix4(invRaiz) }; }
      grupo.add(g);
    }

    // en las manos (el hacha la pone el personaje)
    if (l.dos && l.der) {
      const L = nuevoLote();
      if (l.der === 'tronco_corto' || l.der === 'tronco_delgado') troncoCorto(L, 0, 0, 0, l.der === 'tronco_corto' ? 0.9 : 1.2, l.der === 'tronco_corto' ? 0.13 : 0.09, 'x');
      else if (CATALOGO[l.der] && CATALOGO[l.der].lugar === 'espalda' && !sinModelo(l.der)) { const E = espalda(l.der, {}).L; for (const p of E.piezas) { p.m.premultiply(new THREE.Matrix4().makeRotationY(Math.PI)).premultiply(new THREE.Matrix4().makeTranslation(0, -0.12, 0.1)); L.piezas.push(p); } } // la mochila o el bastidor, cogido delante por los largueros, la repisa hacia el pecho
      else { hatillo(L, 0, 0.12, 0, 2.2); L.generico = true; }
      // va entre las dos manos (con la animación de llevar en brazos, delante del pecho): lo pone seguir()
      const g = deMano(L); g.name = 'llevado_manos'; g.matrixAutoUpdate = false; g.userData.generico = !!L.generico;
      g.traverse(o => { if (o.isMesh) o.userData.herramienta = true; });
      if (H.hand_r && H.hand_l) { g.userData.entreManos = [H.hand_r, H.hand_l]; grupo.add(g); }
    } else for (const [lado, t] of [['r', l.der], ['l', l.izq]]) {
      if (!t || HACHAS.has(t)) continue;
      // lo largo (herramientas, ramas, varas) por el puño, como el hacha; lo redondo (una piedra), en la palma
      const largo = ['rama', 'vara', 'tabla', 'lena', 'espada', 'cuchillo'].includes(t) || (CATALOGO[t] && CATALOGO[t].herramienta && t !== 'lasca_silex');
      const b = baseMano(mh, lado, invRaiz, largo ? 1.1 : 0.6); if (!b) continue;
      grupo.add(pieza(enMano(t), 'mano_' + lado, b.m, b.mano, invRaiz));
    }
    seguir(grupo, j.raiz);
  }
  // el hacha por el cinto: el modelo de la mano, la cabeza arriba y el mango por dentro del cinturón
  function colgarHacha(p, a, t) {
    const g = new THREE.Group(); g.name = 'llevado_hacha_colgada';
    const h = modeloHachaDe(t); h.scale.setScalar(0.8); h.position.set(0, -0.42, 0.0); h.rotation.set(0, Math.PI / 2, -0.12); g.add(h);
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
    // dónde agarra la mano derecha lo que va al hombro (en el mundo), o null
    agarreHombro() {
      const g = grupo.children.find(o => o.userData.agarre);
      if (!g || !grupo.visible) return null;
      g.updateWorldMatrix(true, false);
      return g.userData.agarre.clone().applyMatrix4(g.matrixWorld);
    },
    paso() {
      if (!j.mh) return;
      grupo.visible = j.mh.nivel < OCULTO && j.mh.raiz.visible !== false;
      if (grupo.visible && grupo.children.length) seguir(grupo, j.raiz);
    },
  };
}
