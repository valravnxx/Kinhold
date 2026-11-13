// Kinhold — el horizonte (lógica pura, sin three.js): el terreno de toda la isla, basto, para verlo de lejos.
// valravnx, 5 nov: «me interesaría que los altos aumentaran muchísimo la distancia de dibujado de mapa aunque sea sin
// detalle para ver las montañas y las formas». El terreno de cerca llega a 768 m (en el móvil, a 288); más allá solo
// estaba el mar. Esto da, para los perfiles altos, una malla de la isla entera con la altura de verdad (paisaje.altura,
// sin los ríos) y el color del paisaje de lejos (el de la vista de cerca del mapa: bioma, roca, nieve y el verde
// oscuro de las copas donde hay bosque), en una rejilla de 100 m que se calcula poco a poco: primero cada 400 m,
// luego cada 200 y luego cada 100, para que se vea pronto y se vaya afinando.
//
// La compresión: lo que está a más de R0 de la cámara se acerca a ella por la misma línea de mirada (se ve igual desde
// donde estás) hasta caber dentro del alcance de la cámara del juego; así no hace falta alargar la cámara, que haría
// perder precisión de hondura de cerca. La niebla del posprocesado deshace la compresión para saber la distancia de
// verdad (src/posprocesado/niebla.js).
import { colorDelSuelo } from '../mundo/color_suelo.js';
import { bosqueEn } from './paisaje.js';

export const BASE = 100;                 // m entre puntos de la rejilla más fina
export const NIVELES = [4, 2, 1];        // de basto a fino: cada 400, 200 y 100 m
// m que se baja la malla. Era 6 (para que de cerca el terreno de verdad quedara siempre por encima), pero así la tierra
// baja quedaba bajo el mar y, al acabar el terreno de cerca, salía un escalón de 6 m (valravnx, 5 nov: «parecen bajo el
// agua… como clipeados a más altura o menos, como si tuviera cortes»). Ahora va a su altura y pierde en la hondura
// contra el terreno de cerca (polygonOffset, src/mundo/horizonte.js)
export const HUNDIDO = 0;
export const MAR = 0.3;                  // m: por debajo, mar (la malla baja mucho y la lámina del mar lo tapa)
const DOSEL = [0.22, 0.29, 0.17];        // el verde de las copas visto desde arriba (sRGB; el de src/mapa/cerca.js)

// La compresión de la distancia: r0, a partir de dónde (m), y s, cuánto (1 m de verdad pasa a ser s m). Con la
// distancia más larga posible dentro de la isla (su diagonal) y el alcance de la cámara (lejos), deja todo dentro.
//
// Sin esquina (valravnx, 6 nov: «a lo lejos sigue hundido el terreno bajo el agua… y los glitches de lo parecido a los
// árboles»): la compresión iba de golpe en r0 (de 1 a s ≈ 0,008), y la malla lejana, por cuadros de 100 a 500 m, tiene
// triángulos con un vértice antes de r0 (sin comprimir) y otro después (comprimido): el triángulo, plano entre ellos, no
// sigue la compresión y se levantaba. El mar de lejos (cuadros de 500 m) subía así varios metros entre unos 300 y 800 m
// y tapaba la costa y la tierra baja («hundida bajo el agua»), y el dosel y el suelo salían en franjas que flotan. Ahora
// la compresión entra poco a poco en w m (de 1 a s, la pendiente baja en línea recta): en un triángulo de 100 m el error
// es de un par de metros de distancia, y el mar va en cuadros de 250 m.
export const TRANSICION = 500;
export function compresion(hasta, lejos, diagonal, w = TRANSICION) {
  const r0 = hasta + 60;
  // lo más lejos, comprimido: r0 + w (1 + s) / 2 + (diagonal − r0 − w) s ≤ lejos · 0,95
  return { r0, w, s: Math.max(1e-4, (lejos * 0.95 - r0 - w / 2) / Math.max(1, diagonal - r0 - w / 2)) };
}
// lo que hace la malla con la distancia d (m de la cámara) y lo que deshace la niebla
export function comprimir(d, { r0, s, w = 0 }) {
  if (d <= r0) return d;
  const u = d - r0;
  if (u < w) return r0 + u - (1 - s) * u * u / (2 * w);
  return r0 + w * (1 + s) / 2 + (u - w) * s;
}
export function descomprimir(d, { r0, s, w = 0 }) {
  if (d <= r0) return d;
  const c = d - r0, cw = w * (1 + s) / 2;
  if (c < cw) { const a = (1 - s) / (2 * w); return r0 + (1 - Math.sqrt(Math.max(0, 1 - 4 * a * c))) / (2 * a); }
  return r0 + w + (c - cw) / s;
}
// lo mismo en GLSL (la malla lejana y la niebla): hzComp(d, r0, s, w) y hzDescomp(d, r0, s, w)
export const GLSL_COMPRESION = `
float hzComp(float d, float r0, float s, float w) {
  if (d <= r0) return d;
  float u = d - r0;
  if (u < w) return r0 + u - (1.0 - s) * u * u / (2.0 * w);
  return r0 + w * (1.0 + s) * 0.5 + (u - w) * s;
}
float hzDescomp(float d, float r0, float s, float w) {
  if (d <= r0) return d;
  float c = d - r0, cw = w * (1.0 + s) * 0.5;
  if (c < cw) { float a = (1.0 - s) / (2.0 * w); return r0 + (1.0 - sqrt(max(0.0, 1.0 - 4.0 * a * c))) / (2.0 * a); }
  return r0 + w + (c - cw) / s;
}
`;

// Las muestras de la isla: alto (m del mundo; NaN si aún no) y color (sRGB 0–255; listo cuando colorListo[k])
// rect: { x0, z0, x1, z1 } en m del mundo (el cuadro de la isla)
// especies (opcional): { abeto: { alto, color: [r, g, b] (sRGB 0–1) }, … } para el dosel (doselEn); sin ellas, sin dosel
export function crearMuestras(paisaje, rect, base = BASE, especies = null) {
  const nx = Math.floor((rect.x1 - rect.x0) / base) + 1, nz = Math.floor((rect.z1 - rect.z0) / base) + 1;
  const alto = new Float32Array(nx * nz).fill(NaN), color = new Uint8Array(nx * nz * 3);
  const dosel = new Float32Array(nx * nz), colorDosel = new Uint8Array(nx * nz * 3);   // m de copas sobre el suelo y su color
  const listo = { altos: new Set(), colores: new Set() };   // niveles (4, 2, 1) con todos sus altos o sus colores
  let nivel = 0, fase = 'altos', ix = 0, iz = 0;            // por dónde va
  const xm = (i) => rect.x0 + i * base, zm = (j) => rect.z0 + j * base;
  const A = (i, j) => alto[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  function uno() {
    const k = NIVELES[nivel], n = ix + iz * nx;
    if (fase === 'altos') {
      if (Number.isNaN(alto[n])) alto[n] = paisaje.altura(xm(ix), zm(iz));
    } else {
      // el color, con la pendiente de los vecinos de este nivel (que ya tienen su alto)
      const y = alto[n], d = k * base;
      const gx = (A(ix + k, iz) - A(ix - k, iz)) / (2 * d), gz = (A(ix, iz + k) - A(ix, iz - k)) / (2 * d), s = Math.hypot(gx, gz);
      let c;
      if (y <= MAR) c = [0.21, 0.32, 0.37];   // (el azul del mar de lejos, src/mundo/mundo_juego.js)
      else {
        const st = paisaje.sitio(xm(ix), zm(iz), y);
        c = colorDelSuelo(st, y, s, xm(ix), zm(iz));
        if (st && st.bioma && st.bioma !== 'nieve') {
          const b = bosqueEn(st, s, xm(ix), zm(iz));
          if (b.d > 0) c = c.map((v, q) => v + (DOSEL[q] - v) * Math.min(0.85, b.d * 1.1));
          const dd = especies ? doselDe(b, especies, xm(ix), zm(iz)) : null;
          if (dd) { dosel[n] = dd.h; for (let q = 0; q < 3; q++) colorDosel[n * 3 + q] = Math.round(Math.min(1, dd.c[q]) * 255); }
        }
      }
      color[n * 3] = Math.round(Math.min(1, c[0]) * 255); color[n * 3 + 1] = Math.round(Math.min(1, c[1]) * 255); color[n * 3 + 2] = Math.round(Math.min(1, c[2]) * 255);
    }
    // el siguiente punto de este nivel (los múltiplos de k), o la siguiente fase, o el siguiente nivel
    ix += k;
    if (ix >= nx) { ix = 0; iz += k; }
    if (iz >= nz) {
      ix = 0; iz = 0;
      if (fase === 'altos') { listo.altos.add(k); fase = 'colores'; }
      else { listo.colores.add(k); fase = 'altos'; nivel++; }
    }
  }
  return {
    nx, nz, base, rect, alto, color, dosel, colorDosel, listo,
    get terminado() { return nivel >= NIVELES.length; },
    // sigue calculando hasta gastar ms milisegundos (o hasta terminar); devuelve cuántos puntos ha hecho
    avanzar(ms, ahora = () => performance.now()) {
      if (nivel >= NIVELES.length) return 0;
      const t0 = ahora(); let n = 0;
      while (nivel < NIVELES.length) { uno(); n++; if ((n & 63) === 0 && ahora() - t0 >= ms) break; }
      return n;
    },
    // ¿está entero (alto y color) el nivel k?
    tiene: (k) => listo.colores.has(k),
  };
}

// La malla de un nivel (cada k puntos): posiciones (m de la escena: x − ox, y − y0 − HUNDIDO, z − oz), colores
// (lineal, 0–1) e índices de los triángulos. El mar baja mucho (lo tapa la lámina del mar).
export function mallaDe(m, k, { ox = 0, oz = 0, y0 = 0 } = {}) {
  const cx = Math.floor((m.nx - 1) / k) + 1, cz = Math.floor((m.nz - 1) / k) + 1;
  const pos = new Float32Array(cx * cz * 3), col = new Float32Array(cx * cz * 3);
  const lin = (v) => Math.pow(v / 255, 2.2);
  for (let b = 0; b < cz; b++) for (let a = 0; a < cx; a++) {
    const i = a * k, j = b * k, n = j * m.nx + i, v = b * cx + a;
    const y = m.alto[n];
    pos[v * 3] = m.rect.x0 + i * m.base - ox;
    // hundida, pero sin bajar de 0,2 m sobre el mar: si no, la tierra baja de la costa quedaba bajo la lámina del mar y
    // salía como agua
    pos[v * 3 + 1] = (y <= MAR || Number.isNaN(y) ? -60 - HUNDIDO : Math.max(y - HUNDIDO, Math.min(y, 0.2))) - y0;
    pos[v * 3 + 2] = m.rect.z0 + j * m.base - oz;
    col[v * 3] = lin(m.color[n * 3]); col[v * 3 + 1] = lin(m.color[n * 3 + 1]); col[v * 3 + 2] = lin(m.color[n * 3 + 2]);
  }
  // sin los cuadros que son todo mar (casi la mitad de la isla: los tapa la lámina del mar)
  // (por el alto de verdad: la y de la malla depende del 0 de la escena y antes quitaba también tierra baja)
  const seco = (v) => { const a = v % cx, b = (v - a) / cx, y = m.alto[b * k * m.nx + a * k]; return y > MAR; };
  const tmp = new Uint32Array((cx - 1) * (cz - 1) * 6);
  let t = 0;
  for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) {
    const p = b * cx + a, q = p + 1, r = p + cx, s = r + 1;
    if (!seco(p) && !seco(q) && !seco(r) && !seco(s)) continue;
    tmp[t++] = p; tmp[t++] = r; tmp[t++] = q; tmp[t++] = q; tmp[t++] = r; tmp[t++] = s;
  }
  return { pos, col, idx: tmp.slice(0, t), cx, cz };
}

// El mar de lejos: una rejilla lisa del cuadro de la isla (cada «paso» m), a la altura y (m de la escena). Tiene que ir
// en trozos (no en un solo cuadro) porque la compresión se hace en cada vértice: así la lámina sigue la curva. La
// lámina del mar de cerca acaba donde acaba la cámara (1,6 km); esta sigue hasta el borde de la isla.
export const PASO_MAR = 250;   // (con 500, el mar se levantaba entre los vértices: ver la compresión)
export function mallaMar(rect, { ox = 0, oz = 0, y = 0, paso = PASO_MAR } = {}) {
  const cx = Math.ceil((rect.x1 - rect.x0) / paso) + 1, cz = Math.ceil((rect.z1 - rect.z0) / paso) + 1;
  const pos = new Float32Array(cx * cz * 3), idx = new Uint32Array((cx - 1) * (cz - 1) * 6);
  for (let b = 0; b < cz; b++) for (let a = 0; a < cx; a++) {
    const v = b * cx + a;
    pos[v * 3] = Math.min(rect.x1, rect.x0 + a * paso) - ox; pos[v * 3 + 1] = y; pos[v * 3 + 2] = Math.min(rect.z1, rect.z0 + b * paso) - oz;
  }
  let t = 0;
  for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) {
    const p = b * cx + a, q = p + 1, r = p + cx, s = r + 1;
    idx[t++] = p; idx[t++] = r; idx[t++] = q; idx[t++] = q; idx[t++] = r; idx[t++] = s;
  }
  return { pos, idx, cx, cz };
}

// ---------------------------------------------------------------------------------------------------------------
// El dosel (valravnx, 5 nov: «simular las zonas donde el bioma es bosque… para que a toda distancia ya puedas
// diferenciar bastante bien los biomas»). Los árboles de verdad llegan a 200 m (130 en el móvil); más allá, el bosque era
// un suelo teñido de verde, plano. El dosel es una capa levantada a la altura de las copas solo donde hay bosque: de lejos
// da el volumen (las crestas con su perfil dentado, el borde del bosque en el linde) y el sombreador le pone las copas.
// Donde el bosque es claro, más bajo y fino; fuera del bosque, la capa se mete bajo el suelo (el linde hace de pared).
export const DOSEL_DESDE = 0.22, DOSEL_LLENO = 0.55;   // densidad del bosque (bosqueEn().d) donde empieza y donde ya es entero
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// un azar fijo de cada sitio (0–1): el mismo bulto en el mismo sitio, lo calcule quien lo calcule
export function azarSitio(x, z) { const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return n - Math.floor(n); }

// b: lo que da bosqueEn; especies: { especie: { alto, color } }. Devuelve { h (m sobre el suelo), c (sRGB 0–1) } o null
export function doselDe(b, especies, x, z) {
  if (!b || !b.especie || b.d < DOSEL_DESDE) return null;
  const e = especies[b.especie]; if (!e) return null;
  const lleno = suave(DOSEL_DESDE, DOSEL_LLENO, b.d), r = azarSitio(x, z);
  // lo alto de las copas (un 90 % del árbol), algo más bajo donde el bosque es claro, y con su bulto (±45 %: de lejos, el
  // perfil dentado de las copas)
  const h = e.alto * b.tam * 0.9 * (0.6 + 0.4 * lleno) * (0.55 + 0.9 * r);
  const t = 0.88 + 0.2 * azarSitio(z + 7.1, x - 3.3);
  return { h, c: e.color.map(v => v * t) };
}

// Las copas lejanas: la malla del dosel de un nivel (cada k puntos), en m de la escena como mallaDe; solo los cuadros
// con algo de bosque. El linde (valravnx, 5 nov: «se corta de manera así»): antes, las esquinas sin bosque bajaban de
// golpe bajo el suelo y en el borde del bosque quedaba una pared de unos 20 m con dientes de sierra (la diagonal de cada
// cuadro de 200 m), más oscura que la ladera. Ahora cada punto lleva cuánto bosque tiene alrededor (sus 3 × 3 vecinos,
// el centro pesa más): dentro del bosque, las copas a su alto; hacia el linde bajan poco a poco y pasan al color del
// suelo, y donde ya no hay nada alrededor quedan en el suelo (un poco por debajo), del color del suelo: sin pared ni corte.
export const PESOS_LINDE = [1, 2, 1, 2, 4, 2, 1, 2, 1];   // los 3 × 3 vecinos (suman 16)
export function mallaDosel(m, k, { ox = 0, oz = 0, y0 = 0 } = {}) {
  const cx = Math.floor((m.nx - 1) / k) + 1, cz = Math.floor((m.nz - 1) / k) + 1;
  const n = (a, b) => (Math.min(cz - 1, Math.max(0, b)) * k) * m.nx + Math.min(cx - 1, Math.max(0, a)) * k;
  // cuánto bosque hay alrededor de cada punto (0–1), y el alto y el color medios de sus copas
  const dens = new Float32Array(cx * cz), alto = new Float32Array(cx * cz), copa = new Float32Array(cx * cz * 3);
  for (let b = 0; b < cz; b++) for (let a = 0; a < cx; a++) {
    let d = 0, pb = 0, h = 0, r = 0, g = 0, z = 0;
    for (let e = -1; e <= 1; e++) for (let f = -1; f <= 1; f++) {
      const i = n(a + f, b + e), w = PESOS_LINDE[(e + 1) * 3 + f + 1];
      if (!(m.dosel[i] > 0) || globalThis.__mutarLinde) continue;   // (la prueba lo rompe a propósito: sin linde suave)
      d += w; pb += w; h += m.dosel[i] * w;
      r += m.colorDosel[i * 3] * w; g += m.colorDosel[i * 3 + 1] * w; z += m.colorDosel[i * 3 + 2] * w;
    }
    const q = b * cx + a, aqui = m.dosel[n(a, b)] > 0;
    dens[q] = globalThis.__mutarLinde ? (aqui ? 1 : 0) : d / 16;
    if (pb) { alto[q] = h / pb; copa[q * 3] = r / pb; copa[q * 3 + 1] = g / pb; copa[q * 3 + 2] = z / pb; }
    else if (aqui) { const i = n(a, b); alto[q] = m.dosel[i]; for (let c = 0; c < 3; c++) copa[q * 3 + c] = m.colorDosel[i * 3 + c]; }
  }
  const usar = new Int32Array(cx * cz).fill(-1), idx = [];
  let nv = 0;
  const v = (a, b) => { const q = b * cx + a; if (usar[q] < 0) usar[q] = nv++; return usar[q]; };
  const D = (a, b) => dens[b * cx + a];
  for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) {
    if (!(D(a, b) > 0 || D(a + 1, b) > 0 || D(a, b + 1) > 0 || D(a + 1, b + 1) > 0)) continue;
    const p = v(a, b), q = v(a + 1, b), r = v(a, b + 1), t = v(a + 1, b + 1);
    idx.push(p, r, q, q, r, t);
  }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), sube = new Float32Array(cx * cz);
  const lin = (c) => Math.pow(c / 255, 2.2);
  for (let q = 0; q < cx * cz; q++) {
    { const d = dens[q]; sube[q] = alto[q] * d * d * (3 - 2 * d); }
    const w = usar[q]; if (w < 0) continue;
    const a = q % cx, b = (q - a) / cx, i = n(a, b), y = Math.max(m.alto[i], 0), d = dens[q];
    // lo que sube y lo que se tiñe: suave, con lo que hay de bosque alrededor (sin nada, nada; rodeado, entero). Con
    // más prisa (subir del todo con la mitad) quedaban saltos de unos 11 m entre vecinos; así, de menos de 9
    const u = d * d * (3 - 2 * d);
    pos[w * 3] = m.rect.x0 + a * k * m.base - ox;
    pos[w * 3 + 1] = (u > 0 ? y + alto[q] * u : y - HUNDIDO - 1) - y0;
    pos[w * 3 + 2] = m.rect.z0 + b * k * m.base - oz;
    for (let c = 0; c < 3; c++) col[w * 3 + c] = lin(m.color[i * 3 + c] + (copa[q * 3 + c] - m.color[i * 3 + c]) * u);
  }
  // (por punto del nivel: dens y copa, el horizonte las pone en una textura; sube, lo que sube el suelo lejano con sus
  // copas, src/mundo/horizonte.js)
  return { pos, col, idx: Uint32Array.from(idx), dens, copa, sube, cx, cz };
}

// la media de cada punto con bosque y sus vecinos con bosque (el centro pesa el doble); lo que no tiene bosque, igual
export function suavizar(h, nx, nz) {
  const r = new Float32Array(h.length);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const q = b * nx + a;
    if (!(h[q] > 0)) { r[q] = h[q]; continue; }
    let s = h[q] * 2, n = 2;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (!i && !j) continue;
      const x = a + i, z = b + j; if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
      const v = h[z * nx + x]; if (v > 0) { s += v; n++; }
    }
    r[q] = s / n;
  }
  return r;
}

// hay(x, z) (opcional): ¿está ya el terreno de cerca en (x, z)? Donde aún no ha llegado no se pone dosel (flotaría sobre
// nada: valravnx, 5 nov, tiras verdes en el cielo); «faltan» dice cuántos puntos se quedaron sin mirar por eso.
// Las copas de cerca: una rejilla fina (cada «paso» m) en un cuadro alrededor de (cx, cz) (m del mundo), con la altura
// exacta del suelo (alt, la del juego) y la pendiente como la de los árboles (src/logica/vegetacion.js: vecinos a 3 m),
// sin nada en el agua. Se calcula poco a poco (avanzar) y luego se pide la malla (en m de la escena).
export const PASO_DOSEL_CERCA = 16;
export function crearDoselCerca(paisaje, alt, especies, cx, cz, radio, paso = PASO_DOSEL_CERCA, hay = null) {
  const x0 = Math.floor((cx - radio) / paso) * paso, z0 = Math.floor((cz - radio) / paso) * paso;
  const nx = Math.ceil((cx + radio - x0) / paso) + 1, nz = Math.ceil((cz + radio - z0) / paso) + 1;
  const suelo = new Float32Array(nx * nz), h = new Float32Array(nx * nz), col = new Float32Array(nx * nz * 3);
  const tramos = paisaje.riosEn(x0, z0, x0 + (nx - 1) * paso, z0 + (nz - 1) * paso);
  let i = 0, faltan = 0;
  function uno() {
    const a = i % nx, b = (i - a) / nx, x = x0 + a * paso, z = z0 + b * paso, y = alt(x, z);
    suelo[i] = y;
    let c = null;
    const aqui = !hay || hay(x, z);
    if (!aqui) faltan++;
    // (en la orilla, el dosel llega hasta el agua, como los árboles de cerca: src/logica/vegetacion.js, sitioEn)
    const nivelAgua = paisaje.agua(x, z, tramos);
    if (aqui && y >= 0.3 && (nivelAgua === null || y >= nivelAgua + 0.35)) {
      const st = paisaje.sitio(x, z, y);
      if (st && st.bioma) {
        const s = Math.hypot(alt(x + 3, z) - alt(x - 3, z), alt(x, z + 3) - alt(x, z - 3)) / 6;
        c = doselDe(bosqueEn(st, s, x, z), especies, x, z);
      }
    }
    if (c) { h[i] = c.h; for (let q = 0; q < 3; q++) col[i * 3 + q] = Math.pow(Math.min(1, c.c[q]), 2.2); }
    i++;
  }
  return {
    cx, cz, radio, get listo() { return i >= nx * nz; }, get faltan() { return faltan; },
    avanzar(ms, ahora = () => performance.now()) {
      const t0 = ahora(); let k = 0;
      while (i < nx * nz) { uno(); k++; if ((k & 15) === 0 && ahora() - t0 >= ms) break; }
      return k;
    },
    // la malla (m de la escena): solo los cuadros con bosque; las esquinas sin él, 3 m bajo el suelo. Con alto, el
    // atributo de lo que sube cada punto sobre el suelo (lo que el sombreador le quita al empezar, cerca del jugador).
    // El alto, suavizado (valravnx, 7 nov: «crea este glitch grafico de monticulos que equivaldrian rollo a 50 metros
    // cada uno»): cada punto lleva su bulto (±45 %, el perfil dentado que de lejos hace de copas) y, a pocos cientos de
    // metros, cada 16 m, salían lomas de copas una al lado de otra; aquí, la media con sus vecinos (dos veces), y el
    // perfil de las copas lo dan las manchas del sombreador.
    malla({ ox = 0, oz = 0, y0 = 0 } = {}) {
      const hs = globalThis.__mutarMonticulos ? h : suavizar(suavizar(h, nx, nz), nx, nz);
      const usar = new Int32Array(nx * nz).fill(-1), idx = [];
      let nv = 0;
      const v = (q) => { if (usar[q] < 0) usar[q] = nv++; return usar[q]; };
      for (let b = 0; b < nz - 1; b++) for (let a = 0; a < nx - 1; a++) {
        const p = b * nx + a, q = p + 1, r = p + nx, t = r + 1;
        if (!(h[p] > 0 || h[q] > 0 || h[r] > 0 || h[t] > 0)) continue;
        idx.push(v(p), v(r), v(q), v(q), v(r), v(t));
      }
      const pos = new Float32Array(nv * 3), cc = new Float32Array(nv * 3), alto = new Float32Array(nv);
      for (let q = 0; q < nx * nz; q++) {
        const w = usar[q]; if (w < 0) continue;
        const a = q % nx, b = (q - a) / nx;
        alto[w] = h[q] > 0 ? hs[q] : -3;
        pos[w * 3] = x0 + a * paso - ox; pos[w * 3 + 1] = suelo[q] + alto[w] - y0; pos[w * 3 + 2] = z0 + b * paso - oz;
        if (h[q] > 0) { cc[w * 3] = col[q * 3]; cc[w * 3 + 1] = col[q * 3 + 1]; cc[w * 3 + 2] = col[q * 3 + 2]; }
        else { cc[w * 3] = 0.05; cc[w * 3 + 1] = 0.07; cc[w * 3 + 2] = 0.035; }   // el linde: la sombra bajo las copas
      }
      return { pos, col: cc, idx: Uint32Array.from(idx), alto };
    },
  };
}
