// Kinhold — escena de las pruebas de estilo: claro con cabaña de troncos y tejado de paja,
// leña, tocón con hacha, barril, cerca, árboles, rocas y hierba.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { material, lados, PALETA, hornear } from './estilos.js';

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function crearEscena(estilo) {
  const M = (clave, extra) => material(estilo, clave, extra);
  const seg = (a, b, c) => lados(estilo, a, b, c);
  const raiz = new THREE.Group();
  const r = azar(7);
  const malla = (geo, clave, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, M(clave)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
  };
  // tronco horizontal a lo largo de X o Z, con cortes vistos en las puntas
  const tronco = (padre, largo, rad, x, y, z, eje, clave = 'madera') => {
    const geo = new THREE.CylinderGeometry(rad, rad, largo, seg(6, 9, 12));
    geo.rotateZ(Math.PI / 2); if (eje === 'z') geo.rotateY(Math.PI / 2);
    padre.add(malla(geo, clave, x, y, z));
    if (estilo.detalle >= 1) for (const s of [-1, 1]) {
      const tapa = new THREE.CircleGeometry(rad * 0.88, seg(6, 9, 12));
      if (eje === 'x') tapa.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); else tapa.rotateY(s > 0 ? 0 : Math.PI);
      const d = largo / 2 + 0.002;
      padre.add(malla(tapa, 'corte', x + (eje === 'x' ? s * d : 0), y, z + (eje === 'z' ? s * d : 0)));
    }
  };

  // ---------- Suelo ----------
  {
    const n = seg(50, 80, 110), L = 90;
    const geo = new THREE.PlaneGeometry(L, L, n, n); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = [];
    const cH = new THREE.Color(PALETA.hierba), cS = new THREE.Color(PALETA.hierbaSeca), cT = new THREE.Color(PALETA.tierra), k = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z);
      const ond = (Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.sin((x - z) * 0.05)) * 0.6;
      pos.setY(i, d > 9 ? ond * Math.min(1, (d - 9) / 8) : 0);
      const m = (Math.sin(x * 0.7) * Math.cos(z * 0.6) + Math.sin(x * 0.23 + z * 0.31)) * 0.5;
      k.copy(cH).lerp(cS, Math.max(0, m) * 0.6);
      // tierra pisada alrededor de la cabaña y camino hacia la puerta
      const camino = Math.abs(x - 0.2) < 0.9 + Math.sin(z) * 0.2 && z > 1.8 ? 1 : 0;
      const pisado = Math.max(camino * 0.85, d < 3.6 ? 0.55 : d < 5 ? 0.55 * (5 - d) / 1.4 : 0);
      k.lerp(cT, pisado);
      const v = 1 + (Math.sin(x * 3.1 + z * 2.3) * 0.5) * estilo.variacion;
      col.push(k.r * v, k.g * v, k.b * v);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const op = { vertexColors: true, flatShading: estilo.sombreado === 'plano' };
    let mat;
    if (estilo.material === 'estandar') mat = new THREE.MeshStandardMaterial({ roughness: 1, ...op });
    else mat = new THREE.MeshLambertMaterial(op);
    if (estilo.texturas) { mat.map = M('hierba').map.clone(); mat.map.repeat.set(30, 30); mat.map.needsUpdate = true; }
    const suelo = new THREE.Mesh(geo, mat); suelo.receiveShadow = true; suelo.userData.sinHornear = true;
    raiz.add(suelo);
  }

  // ---------- Cabaña de troncos: 4 × 3,6 m, hiladas de 25 cm, esquinas entrelazadas ----------
  const cab = new THREE.Group(); raiz.add(cab);
  const AX = 2.0, AZ = 1.8, BASE = 0.3, HIL = 0.25, N = 9, RAD = 0.135, SAL = 0.32;
  // cimiento de piedras
  const nPiedras = seg(14, 22, 30);
  for (let i = 0; i < nPiedras; i++) {
    const t = i / nPiedras, per = 2 * (2 * AX + 2 * AZ);
    let s = t * per, x, z;
    if (s < 2 * AX) { x = -AX + s; z = AZ; } else if ((s -= 2 * AX) < 2 * AZ) { x = AX; z = AZ - s; } else if ((s -= 2 * AZ) < 2 * AX) { x = AX - s; z = -AZ; } else { s -= 2 * AX; x = -AX; z = -AZ + s; }
    const p = malla(new THREE.DodecahedronGeometry(0.26 + r() * 0.08, estilo.detalle >= 2 ? 1 : 0), r() > 0.5 ? 'piedra' : 'piedraOsc', x, 0.13, z);
    p.scale.set(1.2, 0.65, 1); p.rotation.set(r() * 3, r() * 3, r() * 3);
    if (estilo.detalle >= 2) deformar(p.geometry, r, 0.05);
    cab.add(p);
  }
  const PUERTA = [-0.5, 0.5], ALTO_PUERTA = 2.0, VENT = [-0.45, 0.45], VENT_Y = [1.05, 1.65];
  for (let k = 0; k < N; k++) {
    const yX = BASE + RAD + k * HIL, yZ = yX + HIL / 2;
    const clave = r() > 0.5 ? 'madera' : 'maderaOsc';
    // muros a lo largo de X (delante z=+AZ con puerta, detrás z=-AZ)
    for (const z of [AZ, -AZ]) {
      if (z > 0 && yX < BASE + ALTO_PUERTA) {
        const a = -AX - SAL, b = PUERTA[0], c = PUERTA[1], d = AX + SAL;
        tronco(cab, b - a, RAD, (a + b) / 2, yX, z, 'x', clave); tronco(cab, d - c, RAD, (c + d) / 2, yX, z, 'x', clave);
      } else tronco(cab, 2 * (AX + SAL), RAD, 0, yX, z, 'x', clave);
    }
    // muros a lo largo de Z (lado derecho con ventana)
    for (const x of [AX, -AX]) {
      if (x > 0 && yZ > BASE + VENT_Y[0] && yZ < BASE + VENT_Y[1]) {
        const a = -AZ - SAL, b = VENT[0], c = VENT[1], d = AZ + SAL;
        tronco(cab, b - a, RAD, x, yZ, (a + b) / 2, 'z', clave); tronco(cab, d - c, RAD, x, yZ, (c + d) / 2, 'z', clave);
      } else tronco(cab, 2 * (AZ + SAL), RAD, x, yZ, 0, 'z', clave);
    }
  }
  const ALTO = BASE + N * HIL + HIL / 2;
  // interior oscuro (para que la puerta y la ventana no dejen ver el cielo)
  const dentro = malla(new THREE.BoxGeometry(2 * AX - 0.3, ALTO - BASE, 2 * AZ - 0.3), 'maderaOsc', 0, BASE + (ALTO - BASE) / 2, 0);
  dentro.material = M('maderaOsc', { side: THREE.BackSide }); cab.add(dentro);
  // puerta de tablas entreabierta, con marco
  {
    const hoja = new THREE.Group(); hoja.position.set(PUERTA[0] + 0.02, BASE, AZ - 0.02);
    const nt = seg(3, 5, 6), w = (PUERTA[1] - PUERTA[0] - 0.04) / nt;
    for (let t = 0; t < nt; t++) hoja.add(malla(new THREE.BoxGeometry(w * 0.97, ALTO_PUERTA - 0.03, 0.05), t % 2 ? 'tabla' : 'madera', w * (t + 0.5), (ALTO_PUERTA - 0.03) / 2, 0));
    for (const y of [0.35, 1.6]) hoja.add(malla(new THREE.BoxGeometry(w * nt * 0.92, 0.1, 0.035), 'maderaOsc', w * nt / 2, y, -0.04));
    if (estilo.detalle >= 1) for (const y of [0.35, 1.6]) hoja.add(malla(new THREE.BoxGeometry(0.28, 0.035, 0.012), 'hierro', 0.15, y, 0.032));
    hoja.rotation.y = -0.55; cab.add(hoja);
    for (const x of PUERTA) cab.add(malla(new THREE.BoxGeometry(0.1, ALTO_PUERTA, 0.3), 'maderaOsc', x, BASE + ALTO_PUERTA / 2, AZ));
    cab.add(malla(new THREE.BoxGeometry(1.25, 0.14, 0.3), 'maderaOsc', 0, BASE + ALTO_PUERTA + 0.07, AZ));
    cab.add(malla(new THREE.BoxGeometry(1.1, 0.12, 0.45), 'piedraOsc', 0, 0.2, AZ + 0.12)); // umbral
  }
  // ventana con marco y contraventana abierta
  {
    const y0 = BASE + VENT_Y[0], y1 = BASE + VENT_Y[1];
    for (const z of VENT) cab.add(malla(new THREE.BoxGeometry(0.3, y1 - y0 + 0.1, 0.08), 'maderaOsc', AX, (y0 + y1) / 2, z));
    for (const y of [y0, y1]) cab.add(malla(new THREE.BoxGeometry(0.32, 0.08, VENT[1] - VENT[0] + 0.16), 'maderaOsc', AX, y, 0));
    const cv = new THREE.Group(); cv.position.set(AX + 0.16, y0, VENT[1] + 0.04);
    cv.add(malla(new THREE.BoxGeometry(0.04, y1 - y0, VENT[1] - VENT[0]), 'tabla', 0, (y1 - y0) / 2, (VENT[1] - VENT[0]) / 2));
    cv.rotation.y = -1.25; cab.add(cv);
  }
  // tejado a dos aguas de paja, cumbrera a lo largo de X
  {
    const SUB = 1.55, VUELO = 0.55, GROSOR = estilo.detalle === 0 ? 0.28 : 0.34;
    const media = AZ + VUELO, ang = Math.atan2(SUB, AZ + 0.15), largo = Math.hypot(media, SUB * media / (AZ + 0.15));
    const anchoT = 2 * (AX + SAL) + 0.5;
    for (const s of [-1, 1]) {
      const agua = new THREE.Group(); agua.position.set(0, ALTO + SUB + 0.02, 0); agua.rotation.x = s * ang; // gira desde la cumbrera
      const capas = seg(1, 4, 6);
      for (let c = 0; c < capas; c++) { // capas de paja escalonadas, de la cumbrera al alero
        const l = largo / capas * (c === capas - 1 ? 1 : 1.18), z0 = s * (largo / capas) * c;
        const geo = new THREE.BoxGeometry(anchoT - c * 0.02, GROSOR, l, seg(1, 6, 10), 1, seg(1, 2, 3));
        if (estilo.detalle >= 1) deformar(geo, r, 0.02);
        const m = malla(geo, c % 2 ? 'pajaOsc' : 'paja', 0, -c * 0.035, z0 + s * l / 2);
        m.userData.ao = (v) => 1; agua.add(m);
      }
      cab.add(agua);
    }
    // cumbrera
    const cum = new THREE.CylinderGeometry(0.2, 0.2, anchoT + 0.06, seg(5, 8, 10)); cum.rotateZ(Math.PI / 2);
    cab.add(malla(cum, 'pajaOsc', 0, ALTO + SUB + 0.06, 0));
    // hastiales de tablas verticales
    for (const sx of [-1, 1]) {
      const nT = seg(1, 8, 12);
      if (nT === 1) {
        const f = new THREE.Shape(); f.moveTo(-AZ - 0.15, 0); f.lineTo(AZ + 0.15, 0); f.lineTo(0, SUB); f.closePath();
        const geo = new THREE.ExtrudeGeometry(f, { depth: 0.12, bevelEnabled: false }); geo.rotateY(Math.PI / 2);
        cab.add(malla(geo, 'tabla', sx * AX - 0.06, ALTO, 0));
      } else {
        const w = 2 * (AZ + 0.15) / nT;
        for (let t = 0; t < nT; t++) {
          const z = -AZ - 0.15 + w * (t + 0.5), h = Math.max(0.05, SUB * (1 - Math.abs(z) / (AZ + 0.15)));
          cab.add(malla(new THREE.BoxGeometry(0.06, h, w * 0.94), t % 2 ? 'tabla' : 'madera', sx * (AX + 0.02), ALTO + h / 2, z));
        }
      }
    }
  }
  // oclusión bajo el alero: más oscuro arriba de los muros
  cab.traverse(o => { if (o.isMesh && !o.userData.ao) o.userData.ao = (v) => v.y > 2.2 && Math.abs(v.x) < AX + 0.2 && Math.abs(v.z) < AZ + 0.2 ? 0.8 : 1; });

  // ---------- Leña, tocón con hacha, barril, cerca ----------
  {
    const lena = new THREE.Group(); lena.position.set(-AX - 0.55, 0, 0.2); raiz.add(lena);
    const filas = seg(3, 4, 5);
    for (let f = 0; f < filas; f++) for (let i = 0; i < 6 - (f % 2); i++)
      tronco(lena, 0.55, 0.075, 0, 0.08 + f * 0.135, -0.75 + i * 0.155 + (f % 2) * 0.078, 'x', r() > 0.5 ? 'madera' : 'maderaOsc');
    const toc = new THREE.Group(); toc.position.set(-1.9, 0, 2.9); raiz.add(toc);
    toc.add(malla(new THREE.CylinderGeometry(0.3, 0.34, 0.5, seg(7, 11, 14)), 'madera', 0, 0.25, 0));
    toc.add(malla(new THREE.CylinderGeometry(0.29, 0.29, 0.02, seg(7, 11, 14)), 'corte', 0, 0.505, 0));
    const hacha = new THREE.Group(); hacha.position.set(0.05, 0.5, 0); hacha.rotation.set(0, 0.6, 0.45); toc.add(hacha);
    hacha.add(malla(new THREE.CylinderGeometry(0.018, 0.022, 0.75, seg(5, 7, 8)), 'tabla', 0, 0.36, 0));
    const hoja = new THREE.BoxGeometry(0.03, 0.09, 0.17); hoja.translate(0, 0, 0.04);
    hacha.add(malla(hoja, 'hierro', 0, 0.03, 0));
    const barril = new THREE.Group(); barril.position.set(AX + 0.6, 0, AZ + 0.5); raiz.add(barril);
    barril.add(malla(new THREE.CylinderGeometry(0.28, 0.25, 0.8, seg(8, 12, 16)), 'tabla', 0, 0.4, 0));
    barril.add(malla(new THREE.CylinderGeometry(0.31, 0.31, 0.3, seg(8, 12, 16)), 'tabla', 0, 0.4, 0));
    for (const y of [0.12, 0.68]) barril.add(malla(new THREE.CylinderGeometry(0.29, 0.29, 0.04, seg(8, 12, 16)), 'hierro', 0, y, 0));
    // cerca de varas
    for (let i = 0; i < 6; i++) {
      const x = 3.8 + i * 1.4, z = 4.5 - i * 0.35;
      raiz.add(malla(new THREE.CylinderGeometry(0.06, 0.07, 1.2, seg(5, 7, 8)), 'maderaOsc', x, 0.6, z));
      if (i < 5) for (const y of [0.45, 0.95]) {
        const vara = new THREE.CylinderGeometry(0.035, 0.035, 1.45, seg(4, 6, 7)); vara.rotateZ(Math.PI / 2); vara.rotateY(Math.atan2(0.35, 1.4));
        raiz.add(malla(vara, 'madera', x + 0.7, y, z - 0.175));
      }
    }
  }

  // ---------- Árboles, rocas y hierba ----------
  for (let i = 0; i < 22; i++) {
    const ang = i * 2.4 + r() * 0.5, d = 11 + r() * 22;
    const x = Math.cos(ang) * d, z = Math.sin(ang) * d - 4;
    if (z > 1 && x > -6) continue; // deja libre la vista desde delante (donde está la cámara)
    raiz.add(i % 3 ? conifera(x, z, r) : frondoso(x, z, r));
  }
  for (let i = 0; i < 14; i++) {
    const ang = r() * 7, d = 6 + r() * 18;
    const p = malla(new THREE.DodecahedronGeometry(0.2 + r() * 0.5, estilo.detalle >= 2 ? 1 : 0), 'piedraOsc', Math.cos(ang) * d, 0.05, Math.sin(ang) * d);
    p.scale.y = 0.55; p.rotation.set(r() * 3, r() * 3, r() * 3); if (estilo.detalle >= 2) deformar(p.geometry, r, 0.06); raiz.add(p);
  }
  if (estilo.detalle >= 1) { // matas de hierba (instanciadas para que pese poco)
    const n = estilo.detalle === 2 ? 900 : 350;
    const geo = new THREE.ConeGeometry(0.028, 0.22, 3); geo.translate(0, 0.11, 0);
    const col = new Float32Array(geo.attributes.position.count * 3).fill(1); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const im = new THREE.InstancedMesh(geo, M('hierba'), n); im.userData.sinHornear = true; im.receiveShadow = true;
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const ang = r() * 7, d = 4.5 + r() * 16;
      o.position.set(Math.cos(ang) * d + (r() - 0.5), 0, Math.sin(ang) * d);
      o.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5); o.scale.setScalar(0.7 + r() * 0.8); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.setScalar(0.95 + r() * 0.3));
    }
    raiz.add(im);
  }

  function conifera(x, z, r) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const alto = 6 + r() * 5;
    g.add(malla(new THREE.CylinderGeometry(0.12, 0.25, alto * 0.5, seg(5, 7, 8)), 'maderaOsc', 0, alto * 0.25, 0));
    const pisos = seg(3, 5, 6);
    for (let n = 0; n < pisos; n++) {
      const t = n / pisos, rad = (1.9 - t * 1.5) * (0.85 + r() * 0.3);
      const cono = new THREE.ConeGeometry(rad, alto * 0.32, seg(6, 8, 9), 1);
      if (estilo.detalle >= 1) deformar(cono, r, 0.12);
      g.add(malla(cono, n % 2 ? 'hojaOsc' : 'hoja', 0, alto * (0.32 + t * 0.6), 0));
    }
    g.rotation.y = r() * 6;
    return g;
  }
  function frondoso(x, z, r) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const alto = 4 + r() * 2.5;
    g.add(malla(new THREE.CylinderGeometry(0.16, 0.3, alto * 0.65, seg(5, 7, 9)), 'madera', 0, alto * 0.32, 0));
    const bolas = seg(3, 6, 8);
    for (let n = 0; n < bolas; n++) {
      const a = n / bolas * 6.28, rr = 1.0 + r() * 0.7;
      const geo = new THREE.IcosahedronGeometry(rr, estilo.detalle >= 2 ? 1 : 0); deformar(geo, r, 0.15);
      g.add(malla(geo, r() > 0.5 ? 'hoja' : 'hojaOsc', Math.cos(a) * 0.9, alto * 0.75 + r() * 0.9, Math.sin(a) * 0.9));
    }
    return g;
  }

  hornear(raiz, estilo);
  return fusionar(raiz);
}

// Mueve un poco cada vértice (mismo desplazamiento en vértices repetidos, para no abrir grietas)
function deformar(geo, r, cant) {
  const p = geo.attributes.position, mapa = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!mapa.has(k)) mapa.set(k, [(r() - 0.5) * cant, (r() - 0.5) * cant, (r() - 0.5) * cant]);
    const d = mapa.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
}

// Junta todas las mallas fijas que comparten material en una sola (menos dibujados: clave en móvil)
function fusionar(raiz) {
  raiz.updateMatrixWorld(true);
  const grupos = new Map(), quitar = [];
  raiz.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.sinHornear) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!grupos.has(o.material)) grupos.set(o.material, []);
    grupos.get(o.material).push(g); quitar.push(o);
  });
  for (const o of quitar) o.removeFromParent();
  for (const [mat, geos] of grupos) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; m.receiveShadow = true;
    m.userData.fusionada = true; raiz.add(m);
  }
  return raiz;
}
