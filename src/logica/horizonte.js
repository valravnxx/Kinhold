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
export const HUNDIDO = 6;                // m que se baja la malla: de cerca, el terreno de verdad queda siempre por encima
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
export function crearMuestras(paisaje, rect, base = BASE) {
  const nx = Math.floor((rect.x1 - rect.x0) / base) + 1, nz = Math.floor((rect.z1 - rect.z0) / base) + 1;
  const alto = new Float32Array(nx * nz).fill(NaN), color = new Uint8Array(nx * nz * 3);
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
        if (st && st.bioma && st.bioma !== 'nieve') { const b = bosqueEn(st, s, xm(ix), zm(iz)).d; if (b > 0) c = c.map((v, q) => v + (DOSEL[q] - v) * Math.min(0.85, b * 1.1)); }
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
    nx, nz, base, rect, alto, color, listo,
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
    pos[v * 3 + 1] = (y <= MAR || Number.isNaN(y) ? -60 : y) - y0 - HUNDIDO;
    pos[v * 3 + 2] = m.rect.z0 + j * m.base - oz;
    col[v * 3] = lin(m.color[n * 3]); col[v * 3 + 1] = lin(m.color[n * 3 + 1]); col[v * 3 + 2] = lin(m.color[n * 3 + 2]);
  }
  // sin los cuadros que son todo mar (casi la mitad de la isla: los tapa la lámina del mar)
  const seco = (v) => pos[v * 3 + 1] > -50;
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
