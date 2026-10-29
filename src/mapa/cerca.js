// Kinhold — boceto de paisaje de cerca: un trozo de 4 × 4 km del mundo en 3D, con el estilo v5 (luz, niebla, árboles),
// para juzgar si el paisaje es bonito antes de meterlo en el juego. Se abre desde el mapa («Ver de cerca»).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { materialTex } from '../mundo/estilos.js';
import { azar } from '../mundo/decorado.js';
import { modelosEspecies, ESPECIES } from '../mundo/especies.js';
import { crearPaisaje, bosqueEn, azarCelda } from '../logica/paisaje.js';
import { fbm } from '../logica/mapa.js';
import { tr } from '../idioma.js';
import { crearVistaJuego } from './juego.js';
import { materialSuelo } from './suelo.js';
import { crearMaterialAgua, atributosAgua, tiempoAgua, distanciaOrilla } from './agua.js';

export const LADO_CERCA = 4000;                 // m
const movil = Math.min(innerWidth, innerHeight) < 700;
const N = movil ? 260 : 420;                     // vértices por lado
const MAX_ARBOLES = movil ? 9000 : 32000;

// color del suelo (0–1) por bioma: el del suelo que se ve bajo los árboles o en el prado, no el del mapa
const SUELO = {
  taiga: [0.36, 0.42, 0.29], caducifolio: [0.42, 0.5, 0.3], mixto: [0.45, 0.52, 0.32], encinar: [0.5, 0.5, 0.33],
  pradera: [0.55, 0.6, 0.36], brezal: [0.5, 0.46, 0.38], matorral: [0.63, 0.58, 0.42], turbera: [0.4, 0.43, 0.32],
  alpino: [0.55, 0.56, 0.45], nieve: [0.9, 0.91, 0.92],
};
const ROCA = { granito: [0.6, 0.56, 0.53], caliza: [0.74, 0.71, 0.63], pizarra: [0.42, 0.43, 0.47], arenisca: [0.68, 0.55, 0.41] };
const ARENA = [0.76, 0.71, 0.58];

let estado = null;
// color del suelo (sRGB, 0–1) en un punto: bioma, más verde donde llueve, roca desnuda en lo empinado, playa y nieve
export function colorDelSuelo(st, y, s, xm, ym) {
  if (!st || !st.bioma) return [0.42, 0.46, 0.44];                                  // fondo del mar / cauce
  let c = SUELO[st.bioma] || SUELO.pradera;
  const verde = Math.max(-0.5, Math.min(0.5, st.P - 0.6)) + (fbm(xm / 420, ym / 420, 9, 3) - 0.5) * 0.6;
  if (st.bioma !== 'nieve') c = [c[0] * (1 - 0.12 * verde), c[1] * (1 + 0.1 * verde), c[2] * (1 - 0.1 * verde)];
  const roca = ROCA[st.roca] || ROCA.caliza;
  // roca desnuda solo en las paredes de verdad (más de unos 45°); las cuestas, por empinadas que sean, con hierba
  const r = Math.min(1, Math.max(0, (s - 0.85) / 0.4) + (st.bioma === 'alpino' ? 0.25 : 0));
  c = c.map((v, n) => v + (roca[n] - v) * r);
  if (r > 0) {
    // en la pared, los estratos: franjas por la altura (como capas de roca), onduladas, y vetas más oscuras
    const capa = Math.sin(y * 1.7 + fbm(xm / 60, ym / 60, 11, 2) * 7) * 0.5 + 0.5, veta = fbm(xm / 7, ym / 7 + y / 3, 13, 2);
    const k = (1 - r * (0.16 * capa + 0.14 * Math.max(0, veta - 0.55) * 4)) * (1 - 0.28 * r);   // más oscura: lo que asoma entre las piezas de roca se lee como sombra
    c = c.map(v => v * k);
  }
  if (y < 2.6 && (st.roca === 'arenisca' || st.roca === 'caliza') && s < 0.25) c = c.map((v, n) => v + (ARENA[n] - v) * (1 - y / 2.6)); // playa
  if (st.T < -1.5 && s < 0.9) c = SUELO.nieve;
  return c;
}
export const ROCAS_COLOR = ROCA;
export const lin = (c) => Math.pow(Math.max(0, c), 2.2);
// el agua (src/mapa/agua.js): la de lejos deja un hueco bajo el trozo de cerca, que lleva la suya con todo el detalle
let matAguaLejos = null, matAguaCerca = null;
export const aguaLejos = () => (matAguaLejos ||= crearMaterialAgua());
export const aguaCerca = () => (matAguaCerca ||= crearMaterialAgua());
const triangulos = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
export function abrirCerca(mapa, xkm, ykm, alCerrar) {
  if (!estado) estado = iniciar();
  estado.alCerrar = alCerrar;
  document.getElementById('cerca').hidden = false;
  window.__cerca.listo = false;
  // deja pintar el aviso antes del trabajo pesado
  document.getElementById('cercaCargando').hidden = false;
  setTimeout(() => { construir(mapa, xkm * 1000, ykm * 1000); document.getElementById('cercaCargando').hidden = true; window.__cerca.listo = true; }, 30);
}

function iniciar() {
  const cont = document.getElementById('cerca');
  const lienzo = document.getElementById('lienzoCerca');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, movil ? 1.5 : 2));
  prepararRenderer(renderer);
  const escena = new THREE.Scene();
  const amb = crearAmbiente(escena, { luz: 'manana', niebla: [1400, 5200], alcance: 45, mapa: movil ? 1024 : 2048 });
  amb.sol.castShadow = false;
  const camara = new THREE.PerspectiveCamera(50, 1, 1.5, 14000);
  const control = new OrbitControls(camara, lienzo);
  control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.495;
  const raiz = new THREE.Group(); escena.add(raiz);
  const tam = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  addEventListener('resize', tam); tam();
  let activo = true;
  let antes = performance.now();
  const bucle = () => {
    requestAnimationFrame(bucle); const ahora = performance.now(), dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
    if (cont.hidden) return;
    if (!window.__cerca.pararAgua) tiempoAgua.value = ahora / 1000;   // pararAgua: solo para romper la prueba a propósito
    if (estado && estado.juego) estado.juego.actualizar(dt);
    control.update(); renderer.render(escena, camara);
  };
  bucle();
  document.getElementById('btnVolverMapa').onclick = () => { cont.hidden = true; vaciar(); estado.alCerrar && estado.alCerrar(); };
  document.getElementById('btnAlto').onclick = () => vista('alto');
  document.getElementById('btnPie').onclick = () => vista('pie');
  document.getElementById('btnJuego').onclick = () => vista('juego');
  void activo;
  const est = { renderer, escena, camara, control, raiz, amb, alturaEn: null };
  est.juego = crearVistaJuego(est);
  return est;
}

function vaciar() {
  const { raiz } = estado;
  if (estado.juego) estado.juego.salir();
  for (const o of [...raiz.children]) { raiz.remove(o); if (o.name === 'bosque') o.dispose(); else o.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }   // los árboles comparten la malla: solo se sueltan sus instancias
}

function construir(mapa, cx, cy) {
  const t0 = performance.now();
  vaciar();
  const pai = estado.paisaje && estado.paisaje.mapa === mapa ? estado.paisaje : Object.assign(crearPaisaje(mapa), { mapa });
  estado.paisaje = pai;
  const L = LADO_CERCA, x0 = cx - L / 2, y0 = cy - L / 2, paso = L / (N - 1);
  const tramos = pai.riosEn(x0, y0, x0 + L, y0 + L);
  // alturas
  const H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = pai.altura(x0 + i * paso, y0 + j * paso, tramos);
  const alt = (i, j) => H[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  estado.alturaEn = (x, z) => { // x, z en la escena (m, centro en 0)
    const gi = (x + L / 2) / paso, gj = (z + L / 2) / paso, i = Math.floor(gi), j = Math.floor(gj), fx = gi - i, fy = gj - j;
    return alt(i, j) * (1 - fx) * (1 - fy) + alt(i + 1, j) * fx * (1 - fy) + alt(i, j + 1) * (1 - fx) * fy + alt(i + 1, j + 1) * fx * fy;
  };
  // malla del terreno con su color
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
  const pend = new Float32Array(N * N), sitios = new Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = -L / 2 + i * paso, z = -L / 2 + j * paso, y = H[k];
    pos.set([x, y, z], k * 3); uv[k * 2] = x * 0.5; uv[k * 2 + 1] = z * 0.5;
    const gx = (alt(i + 1, j) - alt(i - 1, j)) / (2 * paso), gz = (alt(i, j + 1) - alt(i, j - 1)) / (2 * paso), s = Math.hypot(gx, gz);
    pend[k] = s;
    const xm = x0 + i * paso, ym = y0 + j * paso;
    const st = y > 0.05 ? pai.sitio(xm, ym, y) : null; sitios[k] = st;
    let c = colorDelSuelo(st, y, s, xm, ym);
    // donde hay bosque, el suelo de lejos toma el verde oscuro de las copas: así, desde lo alto, las masas de bosque se
    // leen como masas y no como árboles sueltos sobre la hierba (los árboles van encima)
    if (st && st.bioma) { const d = bosqueEn(st, s, xm, ym).d; if (d > 0) c = c.map((v, q) => v + (DOSEL[q] - v) * Math.min(0.85, d * 1.1)); }
    // concavidad: más oscuro en las vaguadas, más claro en lomas; y una variación suave
    const lap = (alt(i + 1, j) + alt(i - 1, j) + alt(i, j + 1) + alt(i, j - 1) - 4 * y) / (paso * paso);
    const v = 1 - Math.max(-0.12, Math.min(0.18, lap * 6)) + (fbm(xm / 60, ym / 60, 5, 3) - 0.5) * 0.14;
    // los colores de arriba están en sRGB (como los de la paleta); los de los vértices van en lineal
    col.set([lin(c[0]) * v, lin(c[1]) * v, lin(c[2]) * v], k * 3);
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let p = 0;
  // cada cuadro se parte por la diagonal que mejor sigue al terreno (la de menos desnivel): así una arista o el borde de
  // un estrato en diagonal a la rejilla no sale en zigzag
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, c2 = a + N, d = c2 + 1;
    if (Math.abs(H[a] - H[d]) < Math.abs(H[b] - H[c2])) idx.set([a, c2, d, a, d, b], p); else idx.set([a, c2, b, b, c2, d], p);
    p += 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  if (!estado.matLejos) estado.matLejos = materialSuelo({ lejos: true });
  const terreno = new THREE.Mesh(geo, estado.matLejos); terreno.name = 'terreno'; terreno.receiveShadow = true; estado.raiz.add(terreno);
  estado.terreno = terreno; estado.tramos = tramos; estado.L = L; estado.N = N;
  // mar: una malla sobre la misma rejilla, solo donde hay mar, con la hondura en cada vértice (para el color y para
  // las olas que rompen en la costa)
  if (H.some(v => v < 0)) {
    const pm = [], hm = [], im = [], ver = new Int32Array(N * N).fill(-1);
    const seco = new Uint8Array(N * N); for (let k = 0; k < N * N; k++) seco[k] = H[k] > 0 ? 1 : 0;
    const orilla = distanciaOrilla(seco, N, paso, 80), om = [];
    const vert = (k) => { if (ver[k] < 0) { ver[k] = pm.length / 3; pm.push(-L / 2 + (k % N) * paso, 0, -L / 2 + Math.floor(k / N) * paso); hm.push(Math.max(0, -H[k])); om.push(orilla[k]); } return ver[k]; };
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c2 = a + N, d = c2 + 1;
      if (Math.min(H[a], H[b], H[c2], H[d]) > 0.3) continue;
      im.push(vert(a), vert(c2), vert(b), vert(b), vert(c2), vert(d));
    }
    const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.Float32BufferAttribute(pm, 3)); gm.setIndex(im); gm.computeVertexNormals();
    atributosAgua(gm, { hondo: Float32Array.from(hm), tipo: new Float32Array(pm.length / 3).fill(1), orilla: Float32Array.from(om) });
    const mar = new THREE.Mesh(gm, aguaLejos()); mar.name = 'mar'; mar.receiveShadow = true; estado.raiz.add(mar);
  }
  // ríos: cinta de agua sobre el cauce
  const agua = [], aguaIdx = [], flujo = [];
  for (const t of tramos) {
    const largo = Math.hypot(t.bx - t.ax, t.by - t.ay), n = Math.max(1, Math.ceil(largo / 20));
    const nx = -(t.by - t.ay) / (largo || 1), ny = (t.bx - t.ax) / (largo || 1), w = Math.max(3, t.ancho) / 2;
    const co = pai.corriente((t.ax + t.bx) / 2, (t.ay + t.by) / 2, [t]);
    let previo = false;   // solo se une con el punto anterior del mismo tramo
    for (let s = 0; s <= n; s++) {
      const u = s / n, xm = t.ax + (t.bx - t.ax) * u, ym = t.ay + (t.by - t.ay) * u, x = xm - cx, z = ym - cy;
      if (Math.abs(x) > L / 2 || Math.abs(z) > L / 2) { previo = false; continue; }
      // la altura del agua con su propio tramo (si no, donde se juntan dos ríos saldría una pared de agua)
      const y = pai.altura(xm, ym, [t]) + 0.8, base = agua.length / 3;
      const salto = false;   // los saltos de agua se dibujan: la cinta baja por ellos (de lejos, como una franja blanca y empinada)
      agua.push(x + nx * w, y, z + ny * w, x - nx * w, y, z - ny * w);
      flujo.push(co.dx * co.vel, co.dy * co.vel, co.dx * co.vel, co.dy * co.vel);
      if (previo && !salto) aguaIdx.push(base - 2, base - 1, base, base - 1, base + 1, base);
      previo = true;
    }
  }
  if (agua.length) {
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(agua, 3)); g2.setIndex(aguaIdx); g2.computeVertexNormals();
    atributosAgua(g2, { flujo: Float32Array.from(flujo) });
    const rio = new THREE.Mesh(g2, aguaLejos()); rio.name = 'rios'; rio.receiveShadow = true; estado.raiz.add(rio);
  }
  // bosque: candidatos en una rejilla desordenada de 13 m; cada uno se queda según el espesor del bosque en su sitio
  // cada candidato sale de su celda del MUNDO y de la semilla (no del centro de la zona): el mismo sitio tiene los mismos
  // árboles se abra la zona desde donde se abra
  const lista = Object.fromEntries(ESPECIES.map(e => [e, []])), ESP = 13, SEM = mapa.semilla || 0;
  const ci0 = Math.ceil((cx - L / 2 + ESP / 2) / ESP), ci1 = Math.floor((cx + L / 2 - ESP / 2) / ESP), cj0 = Math.ceil((cy - L / 2 + ESP / 2) / ESP), cj1 = Math.floor((cy + L / 2 - ESP / 2) / ESP);
  let r = null;
  for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
    r = azarCelda(ci, cj, 9, SEM);
    const x = ci * ESP - cx, z = cj * ESP - cy;
    const px = x + (r() - 0.5) * ESP, pz = z + (r() - 0.5) * ESP;   // por toda la celda: sin filas
    const gi = Math.round((px + L / 2) / paso), gj = Math.round((pz + L / 2) / paso), k = Math.min(N - 1, gj) * N + Math.min(N - 1, gi);
    const st = sitios[k]; if (!st || !st.bioma || H[k] < 1.5) continue;
    const xm = cx + px, ym = cy + pz;
    const lap = (alt(gi + 3, gj) + alt(gi - 3, gj) + alt(gi, gj + 3) + alt(gi, gj - 3) - 4 * H[k]) / (9 * paso * paso);
    const { d, especie, tam } = bosqueEn(st, pend[k], xm, ym, { humedo: Math.max(0, Math.min(1, lap * 40)), semilla: SEM, u: r() });
    if (r() > d) continue;
    const y = estado.alturaEn(px, pz) - 0.3;
    lista[especie].push([px, y, pz, tam * (0.85 + r() * 0.3), r() * 6.3, 0.82 + r() * 0.3]);
  }
  const contar = () => ESPECIES.reduce((n, e) => n + lista[e].length, 0);
  let total = contar();
  estado.engorde = 1;
  if (total > MAX_ARBOLES) { const q = MAX_ARBOLES / total; estado.engorde = Math.min(1.35, Math.pow(q, -0.25));   // si hay que quitar árboles, los que quedan, algo más grandes (el bosque no se ve ralo)
 for (const k of ESPECIES) lista[k] = lista[k].filter(a => azarCelda(Math.round(cx + a[0]), Math.round(cy + a[2]), 10, SEM)() < q); total = contar(); }   // cada árbol, por su sitio (siempre el mismo)
  estado.arboles = lista;
  poblarArboles(null);
  estado.centro = { cx, cy, H, paso };
  const mods = modelosEspecies({ sencillo: true }), tri = idx.length / 3 + ESPECIES.reduce((n, e) => n + lista[e].length * triangulos(mods[e].geo), 0);
  window.__cerca.medidas = { ms: Math.round(performance.now() - t0), triangulos: Math.round(tri), arboles: total, especies: Object.fromEntries(ESPECIES.map(e => [e, lista[e].length])), rejilla: N, pasoM: +paso.toFixed(1) };
  document.getElementById('cercaDatos').textContent = tr('Zona de {l} × {l} km en {x}, {y} km · {a} árboles · rejilla de {p} m', { l: L / 1000, x: (cx / 1000).toFixed(1), y: (cy / 1000).toFixed(1), a: total.toLocaleString('es'), p: paso.toFixed(0) });
  vista('alto');
}

// árboles instanciados: los que quedan a menos de CERCA_ARBOL m del ojo con el modelo completo, el resto sencillos.
// Escala más alta que ancha: un pino de verdad mide 15–20 m con un tronco de medio metro.
const CERCA_ARBOL = 260;
// de lejos, algo más grandes que de cerca (así se leen las masas de bosque desde lo alto), más altos que anchos
const LEJOS_ALTO = 1.7, LEJOS_ANCHO = 1.35;
const DOSEL = [0.22, 0.29, 0.17];   // el verde de las copas visto desde arriba (sRGB)
export function poblarArboles(ojo, fuera = null) {
  const { raiz, arboles } = estado;
  for (const o of raiz.children.filter(o => o.name === 'bosque')) { raiz.remove(o); o.dispose(); }
  const completo = modelosEspecies(), sencillo = modelosEspecies({ sencillo: true });
  for (const k of ESPECIES) {
    const cerca = [], lejos = [];
    for (const a of arboles[k]) { if (fuera && fuera(a[0], a[2])) continue; (ojo && Math.hypot(a[0] - ojo.x, a[2] - ojo.z) < CERCA_ARBOL ? cerca : lejos).push(a); }
    for (const [lista, m] of [[cerca, completo[k]], [lejos, sencillo[k]]]) {
      if (!lista.length) continue;
      const im = new THREE.InstancedMesh(m.geo, m.mats, lista.length), o = new THREE.Object3D(), c = new THREE.Color();
      lista.forEach(([x, y, z, s, gir, tono], n) => { o.position.set(x, y, z); o.rotation.set(0, gir, 0); const e = estado.engorde || 1; o.scale.set(s * LEJOS_ANCHO * e, s * LEJOS_ALTO * e, s * LEJOS_ANCHO * e); o.updateMatrix(); im.setMatrixAt(n, o.matrix); im.setColorAt(n, c.setScalar(tono)); });
      im.name = 'bosque'; raiz.add(im);
    }
  }
}

// el mirador: un alto cerca del centro (desde donde se ve algo) y la dirección en la que la vista está más abierta
function mirador() {
  const alt = estado.alturaEn;
  let px = 0, pz = 0, mejorSitio = -Infinity;
  for (let rr = 0; rr <= 900; rr += 90) for (let a = 0; a < 6.28; a += rr ? 0.35 : 7) {
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = alt(x, z);
    if (y < 2 || Math.abs(alt(x + 6, z) - alt(x - 6, z)) > 5 || Math.abs(alt(x, z + 6) - alt(x, z - 6)) > 5) continue;
    let media = 0; for (let b = 0; b < 6.28; b += 0.8) media += alt(x + Math.cos(b) * 250, z + Math.sin(b) * 250) / 8;
    const nota = y - media - rr * 0.02;
    if (nota > mejorSitio) { mejorSitio = nota; px = x; pz = z; }
  }
  const ojo = alt(px, pz) + 1.7;
  let dir = 0, mejor = -Infinity;
  for (let a = 0; a < 6.28; a += 0.1) {
    let tapa = -Infinity; for (let d = 15; d < 400; d += 15) tapa = Math.max(tapa, (alt(px + Math.cos(a) * d, pz + Math.sin(a) * d) - ojo) / d);
    let lejos = -Infinity; for (let d = 600; d < 1950; d += 150) lejos = Math.max(lejos, alt(px + Math.cos(a) * d, pz + Math.sin(a) * d));
    const nota = -tapa * 4 + lejos / 2000;
    if (nota > mejor) { mejor = nota; dir = a; }
  }
  return { px, pz, dir };
}

// vistas: desde lo alto (como un pájaro), a pie (a 1,7 m del suelo) y como en el juego (cámara detrás del personaje)
function vista(cual) {
  const { camara, control } = estado, alt = estado.alturaEn;
  if (window.__cerca.vistaActual === 'juego' && cual !== 'juego') estado.juego.salir();
  if (cual === 'juego') {
    const m = mirador();
    estado.juego.entrar(m.px, m.pz, m.dir);
    window.__cerca.vistaActual = cual;
    return;
  }
  if (cual === 'pie') {
    const { px, pz, dir } = mirador(), ojo = alt(px, pz) + 1.7;
    camara.position.set(px, ojo, pz);
    control.target.set(px + Math.cos(dir) * 40, ojo - 2, pz + Math.sin(dir) * 40);
    control.minDistance = 0.1; control.maxDistance = 60;
    poblarArboles(camara.position);
  } else {
    control.minDistance = 50; control.maxDistance = 6000;
    if (window.__cerca.vistaActual === 'pie') poblarArboles(null);
    const y = alt(0, 0);
    control.target.set(0, y, 0);
    camara.position.set(-1500, y + 1100, 1700);
  }
  control.update();
  window.__cerca.vistaActual = cual;
}

window.__cerca = { listo: false, ocultar: (n) => { const o = estado.raiz.getObjectByName(n); if (o) o.visible = false; }, abrir: abrirCerca, vista: (v) => vista(v), camara: (p, d, y) => estado.juego.camara(p, d, y),
  rioCercano: () => { const { cx, cy } = estado.centro; let mejor = null, bd = Infinity; for (const t of estado.tramos) for (let u = 0; u <= 1; u += 0.05) { const x = t.ax + (t.bx - t.ax) * u - cx, z = t.ay + (t.by - t.ay) * u - cy, d = Math.hypot(x, z); if (d < bd) { bd = d; mejor = { x, z, ancho: t.ancho, dir: Math.atan2(t.by - t.ay, t.bx - t.ax) }; } } return mejor; },
  // para las pruebas: un punto de tierra junto al mar (en la escena), cerca del centro de la zona
  costaCercana: (yMin = 0.3, yMax = 12) => { const a = estado.alturaEn; for (let r = 0; r < 1900; r += 20) for (let g = 0; g < 6.28; g += 0.1) { const x = Math.cos(g) * r, z = Math.sin(g) * r, y = a(x, z); if (y > yMin && y < yMax) for (let h = 0; h < 6.28; h += 0.5) if (a(x + Math.cos(h) * 80, z + Math.sin(h) * 80) < -1) return { x, z, dir: h }; } return null; },
  paredCercana: () => estado.juego.paredCercana(),
  // para las pruebas: el salto de agua más cercano al centro de la zona (en la escena), con su alto y su dirección
  saltoCercano: () => { const { cx, cy } = estado.centro; let m = null, bd = Infinity; for (const sa of estado.paisaje.saltosEn(estado.tramos)) { const d = Math.hypot(sa.x - cx, sa.y - cy); if (d < bd) { bd = d; m = { x: sa.x - cx, z: sa.y - cy, alto: sa.arriba - sa.abajo, dir: Math.atan2(sa.dy, sa.dx), ancho: sa.ancho }; } } return m; },
  juegoEn: (x, z, dir = 0) => { if (window.__cerca.vistaActual === 'juego') estado.juego.salir(); estado.juego.entrar(x, z, dir); window.__cerca.vistaActual = 'juego'; }, get medidas() { return this._m; }, set medidas(v) { this._m = v; } };
