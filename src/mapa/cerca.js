// Kinhold — boceto de paisaje de cerca: un trozo de 4 × 4 km del mundo en 3D, con el estilo v5 (luz, niebla, árboles),
// para juzgar si el paisaje es bonito antes de meterlo en el juego. Se abre desde el mapa («Ver de cerca»).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { materialTex } from '../mundo/estilos.js';
import { modelosArbol, azar } from '../mundo/decorado.js';
import { crearPaisaje, bosqueEn } from '../logica/paisaje.js';
import { fbm } from '../logica/mapa.js';
import { tr } from '../idioma.js';
import { crearVistaJuego } from './juego.js';

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
  const r = Math.min(1, Math.max(0, (s - 0.62) / 0.3) + (st.bioma === 'alpino' ? 0.25 : 0));
  c = c.map((v, n) => v + (roca[n] - v) * r);                                       // lo empinado, roca desnuda
  if (y < 2.6 && (st.roca === 'arenisca' || st.roca === 'caliza') && s < 0.25) c = c.map((v, n) => v + (ARENA[n] - v) * (1 - y / 2.6)); // playa
  if (st.T < -1.5 && s < 0.9) c = SUELO.nieve;
  return c;
}
export const ROCAS_COLOR = ROCA;
export const lin = (c) => Math.pow(Math.max(0, c), 2.2);
// el agua de los ríos (la misma de lejos y de cerca, para que no se vea la costura): algo de brillo del cielo
let matAgua = null;
export function materialAgua() { return (matAgua ||= new THREE.MeshPhongMaterial({ color: 0x55707c, specular: 0x8899a0, shininess: 60, side: THREE.DoubleSide })); }
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
    const c = colorDelSuelo(st, y, s, xm, ym);
    // concavidad: más oscuro en las vaguadas, más claro en lomas; y una variación suave
    const lap = (alt(i + 1, j) + alt(i - 1, j) + alt(i, j + 1) + alt(i, j - 1) - 4 * y) / (paso * paso);
    const v = 1 - Math.max(-0.12, Math.min(0.18, lap * 6)) + (fbm(xm / 60, ym / 60, 5, 3) - 0.5) * 0.14;
    // los colores de arriba están en sRGB (como los de la paleta); los de los vértices van en lineal
    col.set([lin(c[0]) * v, lin(c[1]) * v, lin(c[2]) * v], k * 3);
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let p = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, c2 = a + N, d = c2 + 1; idx.set([a, c2, b, b, c2, d], p); p += 6; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  if (!estado.matLejos) { estado.matLejos = materialTex('suelo').clone(); Object.assign(estado.matLejos, { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 }); }
  const terreno = new THREE.Mesh(geo, estado.matLejos); terreno.name = 'terreno'; terreno.receiveShadow = true; estado.raiz.add(terreno);
  estado.terreno = terreno; estado.tramos = tramos; estado.L = L; estado.N = N;
  // mar
  if (H.some(v => v < 0)) {
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(L, L).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5b7584, transparent: true, opacity: 0.88 }));
    mar.position.y = 0; mar.name = 'mar'; estado.raiz.add(mar);
  }
  // ríos: cinta de agua sobre el cauce
  const agua = [], aguaIdx = [];
  for (const t of tramos) {
    const largo = Math.hypot(t.bx - t.ax, t.by - t.ay), n = Math.max(1, Math.ceil(largo / 20));
    const nx = -(t.by - t.ay) / (largo || 1), ny = (t.bx - t.ax) / (largo || 1), w = Math.max(3, t.ancho) / 2;
    let previo = false;   // solo se une con el punto anterior del mismo tramo
    for (let s = 0; s <= n; s++) {
      const u = s / n, xm = t.ax + (t.bx - t.ax) * u, ym = t.ay + (t.by - t.ay) * u, x = xm - cx, z = ym - cy;
      if (Math.abs(x) > L / 2 || Math.abs(z) > L / 2) { previo = false; continue; }
      // la altura del agua con su propio tramo (si no, donde se juntan dos ríos saldría una pared de agua)
      const y = pai.altura(xm, ym, [t]) + 0.8, base = agua.length / 3;
      const salto = previo && Math.abs(y - agua[agua.length - 2]) > 6;   // un salto grande: se corta (los saltos de agua van luego)
      agua.push(x + nx * w, y, z + ny * w, x - nx * w, y, z - ny * w);
      if (previo && !salto) aguaIdx.push(base - 2, base - 1, base, base - 1, base + 1, base);
      previo = true;
    }
  }
  if (agua.length) {
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(agua, 3)); g2.setIndex(aguaIdx); g2.computeVertexNormals();
    const rio = new THREE.Mesh(g2, materialAgua()); rio.name = 'rios'; estado.raiz.add(rio);
  }
  // bosque: candidatos en una rejilla desordenada de 13 m; cada uno se queda según el espesor del bosque en su sitio
  const r = azar((Math.round(cx) * 73856093) ^ (Math.round(cy) * 19349663));
  const lista = { pino: [], frond: [] }, ESP = 13;
  for (let z = -L / 2 + ESP / 2; z < L / 2; z += ESP) for (let x = -L / 2 + ESP / 2; x < L / 2; x += ESP) {
    const px = x + (r() - 0.5) * ESP * 0.9, pz = z + (r() - 0.5) * ESP * 0.9;
    const gi = Math.round((px + L / 2) / paso), gj = Math.round((pz + L / 2) / paso), k = Math.min(N - 1, gj) * N + Math.min(N - 1, gi);
    const st = sitios[k]; if (!st || !st.bioma || H[k] < 1.5) continue;
    const xm = cx + px, ym = cy + pz;
    const claro = fbm(xm / 380, ym / 380, 31, 4) * 0.7 + fbm(xm / 90, ym / 90, 33, 3) * 0.3;
    const lap = (alt(gi + 3, gj) + alt(gi - 3, gj) + alt(gi, gj + 3) + alt(gi, gj - 3) - 4 * H[k]) / (9 * paso * paso);
    const { d, pino } = bosqueEn(st.bioma, st.T, pend[k], claro, Math.max(0, Math.min(1, lap * 40)));
    if (r() > d) continue;
    const y = estado.alturaEn(px, pz) - 0.3;
    (pino ? lista.pino : lista.frond).push([px, y, pz, (pino ? 3.2 : 2.9) * (0.8 + r() * 0.45), r() * 6.3, 0.82 + r() * 0.3]);
  }
  let total = lista.pino.length + lista.frond.length;
  if (total > MAX_ARBOLES) { const q = MAX_ARBOLES / total; for (const k of ['pino', 'frond']) lista[k] = lista[k].filter(() => r() < q); total = lista.pino.length + lista.frond.length; }
  estado.arboles = lista;
  poblarArboles(null);
  estado.centro = { cx, cy, H, paso };
  const mods = modelosArbol({ sencillo: true }), tri = idx.length / 3 + lista.pino.length * triangulos(mods.pino.geo) + lista.frond.length * triangulos(mods.frond.geo);
  window.__cerca.medidas = { ms: Math.round(performance.now() - t0), triangulos: Math.round(tri), arboles: total, rejilla: N, pasoM: +paso.toFixed(1) };
  document.getElementById('cercaDatos').textContent = tr('Zona de {l} × {l} km en {x}, {y} km · {a} árboles · rejilla de {p} m', { l: L / 1000, x: (cx / 1000).toFixed(1), y: (cy / 1000).toFixed(1), a: total.toLocaleString('es'), p: paso.toFixed(0) });
  vista('alto');
}

// árboles instanciados: los que quedan a menos de CERCA_ARBOL m del ojo con el modelo completo, el resto sencillos.
// Escala más alta que ancha: un pino de verdad mide 15–20 m con un tronco de medio metro.
const CERCA_ARBOL = 260;
export function poblarArboles(ojo, fuera = null) {
  const { raiz, arboles } = estado;
  for (const o of raiz.children.filter(o => o.name === 'bosque')) { raiz.remove(o); o.dispose(); }
  const completo = modelosArbol(), sencillo = modelosArbol({ sencillo: true });
  for (const k of ['pino', 'frond']) {
    const cerca = [], lejos = [];
    for (const a of arboles[k]) { if (fuera && fuera(a[0], a[2])) continue; (ojo && Math.hypot(a[0] - ojo.x, a[2] - ojo.z) < CERCA_ARBOL ? cerca : lejos).push(a); }
    for (const [lista, m] of [[cerca, completo[k]], [lejos, sencillo[k]]]) {
      if (!lista.length) continue;
      const im = new THREE.InstancedMesh(m.geo, m.mats, lista.length), o = new THREE.Object3D(), c = new THREE.Color();
      lista.forEach(([x, y, z, s, gir, tono], n) => { o.position.set(x, y, z); o.rotation.set(0, gir, 0); o.scale.set(s * 0.62, s, s * 0.62); o.updateMatrix(); im.setMatrixAt(n, o.matrix); im.setColorAt(n, c.setScalar(tono)); });
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
  juegoEn: (x, z, dir = 0) => { if (window.__cerca.vistaActual === 'juego') estado.juego.salir(); estado.juego.entrar(x, z, dir); window.__cerca.vistaActual = 'juego'; }, get medidas() { return this._m; }, set medidas(v) { this._m = v; } };
