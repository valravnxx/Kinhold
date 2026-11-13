// Kinhold — cómo se ven los campos marcados con estacas (P11; la lógica, en src/logica/campos.js).
// Cada estaca, clavada de pie con un cuarto de su largo en la tierra; y el linde, una franja estrecha de tierra pisada
// que va de estaca en estaca pegada al suelo (y de la última a la primera cuando el campo está cerrado). Todo se rehace
// cuando cambia el mundo de construcción (main.js, reconstruir).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { estacaEn } from './modelos_objetos.js';
import { ladosDe, casillasLabradas, dentroPoligono } from '../logica/campos.js';

const ALTO_ESTACA = 1.15;      // m sobre el suelo: recias y altas, para que se vean entre la hierba
const GROSOR_ESTACA = 1.7;     // más gruesas que la de la mano (para leerlas de lejos como mojones de campo)
const HUNDIDA = 0.28;          // lo que va bajo tierra
const ALTO_CUERDA = 0.82;      // m: la cuerda de esparto atada de estaca en estaca marca el linde por encima de la hierba
const MAT_CUERDA = new THREE.MeshLambertMaterial({ color: 0xc9b483 });
const ANCHO_LINDE = 0.34;      // m: una banda de tierra pisada, bien visible (como los caminos de la referencia)
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

export function crearCamposVista({ escena, sueloEn }) {
  const raiz = new THREE.Group();
  raiz.name = 'campos';
  escena.add(raiz);
  const vaciar = () => { for (const h of raiz.children) h.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); raiz.clear(); };

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
      pos.push(x, sueloEn(x, z) + SOBRE + 0.012, z); uv.push((x * co - z * si) * 0.5, x * si + z * co); col.push(v, v * 0.985, v * 0.97, al); alfa.push(al);
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

  // campos: los del mundo (Mundo.campos).
  function poner(campos, ahora = Date.now()) {
    vaciar();
    const L = new Lote({ rangoSuelo: 0.3, variacion: 0.06 }), lindes = [], cuerdas = [], labrados = [];
    for (const c of campos || []) {
      c.puntos.forEach((p, i) => estacaEn(L, p.x, sueloEn(p.x, p.z) - HUNDIDA, p.z, { y: (i * 1.7 + c.id) % 6.28, x: 0.04, z: ((i * 0.37) % 0.1) - 0.05 }, `${c.id}:${i}`, GROSOR_ESTACA, ALTO_ESTACA + HUNDIDA, 1.5));
      for (const [a, b] of ladosDe(c)) { linde(a, b, lindes); cuerda(a, b, cuerdas); }
      if (c.cerrado) labrado(c, ahora, labrados);
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
  return { poner, raiz };
}
