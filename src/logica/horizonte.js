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
export function compresion(hasta, lejos, diagonal) {
  const r0 = hasta + 60;
  return { r0, s: Math.max(1e-4, (lejos * 0.95 - r0) / diagonal) };
}
// lo que hace la malla con la distancia d (m de la cámara) y lo que deshace la niebla
export const comprimir = (d, { r0, s }) => (d <= r0 ? d : r0 + (d - r0) * s);
export const descomprimir = (d, { r0, s }) => (d <= r0 ? d : r0 + (d - r0) / s);

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
      if (y <= MAR) c = [0.29, 0.39, 0.44];
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
export const PASO_MAR = 500;
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
// con algo de bosque. Las esquinas sin bosque bajan bajo la malla del horizonte (que va hundida) para cerrar el linde.
export function mallaDosel(m, k, { ox = 0, oz = 0, y0 = 0 } = {}) {
  const cx = Math.floor((m.nx - 1) / k) + 1, cz = Math.floor((m.nz - 1) / k) + 1;
  const n = (a, b) => (b * k) * m.nx + a * k;
  const usar = new Int32Array(cx * cz).fill(-1), idx = [];
  let nv = 0;
  const v = (a, b) => { const q = b * cx + a; if (usar[q] < 0) usar[q] = nv++; return usar[q]; };
  for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) {
    if (!(m.dosel[n(a, b)] > 0 || m.dosel[n(a + 1, b)] > 0 || m.dosel[n(a, b + 1)] > 0 || m.dosel[n(a + 1, b + 1)] > 0)) continue;
    const p = v(a, b), q = v(a + 1, b), r = v(a, b + 1), t = v(a + 1, b + 1);
    idx.push(p, r, q, q, r, t);
  }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const lin = (c) => Math.pow(c / 255, 2.2);
  for (let q = 0; q < cx * cz; q++) {
    const w = usar[q]; if (w < 0) continue;
    const a = q % cx, b = (q - a) / cx, i = n(a, b), y = m.alto[i], h = m.dosel[i];
    pos[w * 3] = m.rect.x0 + a * k * m.base - ox;
    pos[w * 3 + 1] = (h > 0 ? y + h : Math.max(y, 0) - HUNDIDO - 4) - y0;
    pos[w * 3 + 2] = m.rect.z0 + b * k * m.base - oz;
    const c = h > 0 ? m.colorDosel : m.color;
    col[w * 3] = lin(c[i * 3]); col[w * 3 + 1] = lin(c[i * 3 + 1]); col[w * 3 + 2] = lin(c[i * 3 + 2]);
  }
  return { pos, col, idx: Uint32Array.from(idx) };
}

// Las copas de cerca: una rejilla fina (cada «paso» m) en un cuadro alrededor de (cx, cz) (m del mundo), con la altura
// exacta del suelo (alt, la del juego) y la pendiente como la de los árboles (src/logica/vegetacion.js: vecinos a 3 m),
// sin nada en el agua. Se calcula poco a poco (avanzar) y luego se pide la malla (en m de la escena).
export const PASO_DOSEL_CERCA = 16;
// hay(x, z) (opcional): ¿está ya el terreno de cerca en (x, z)? Donde aún no ha llegado no se pone dosel (flotaría sobre
// nada: valravnx, 5 nov, tiras verdes en el cielo); «faltan» dice cuántos puntos se quedaron sin mirar por eso.
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
    if (aqui && y >= 0.3 && paisaje.agua(x, z, tramos) === null) {
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
    // la malla (m de la escena): solo los cuadros con bosque; las esquinas sin él, 3 m bajo el suelo
    malla({ ox = 0, oz = 0, y0 = 0 } = {}) {
      const usar = new Int32Array(nx * nz).fill(-1), idx = [];
      let nv = 0;
      const v = (q) => { if (usar[q] < 0) usar[q] = nv++; return usar[q]; };
      for (let b = 0; b < nz - 1; b++) for (let a = 0; a < nx - 1; a++) {
        const p = b * nx + a, q = p + 1, r = p + nx, t = r + 1;
        if (!(h[p] > 0 || h[q] > 0 || h[r] > 0 || h[t] > 0)) continue;
        idx.push(v(p), v(r), v(q), v(q), v(r), v(t));
      }
      const pos = new Float32Array(nv * 3), cc = new Float32Array(nv * 3);
      for (let q = 0; q < nx * nz; q++) {
        const w = usar[q]; if (w < 0) continue;
        const a = q % nx, b = (q - a) / nx;
        pos[w * 3] = x0 + a * paso - ox; pos[w * 3 + 1] = (h[q] > 0 ? suelo[q] + h[q] : suelo[q] - 3) - y0; pos[w * 3 + 2] = z0 + b * paso - oz;
        if (h[q] > 0) { cc[w * 3] = col[q * 3]; cc[w * 3 + 1] = col[q * 3 + 1]; cc[w * 3 + 2] = col[q * 3 + 2]; }
        else { cc[w * 3] = 0.05; cc[w * 3 + 1] = 0.07; cc[w * 3 + 2] = 0.035; }   // el linde: la sombra bajo las copas
      }
      return { pos, col: cc, idx: Uint32Array.from(idx) };
    },
  };
}
