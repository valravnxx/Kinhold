// Kinhold — Whitholm, la isla de los playtests (valravnx, 29 oct): el juego, de momento, solo en la isla norte de
// Kinland. Aquí, en lógica pura (sin three.js, para que la use también el servidor): hasta dónde llega la isla y el sitio
// de salida, el mismo para todos (todos en la misma comarca).
//
// Lo que se calcula con el mapa (limitesIsla, buscarSalida) es caro: generar el mundo tarda unos segundos. Por eso el
// resultado para el mundo elegido va también apuntado en ISLA y SALIDA, que el servidor usa sin generar nada; la prueba
// (pruebas/prueba_whitholm.mjs) genera el mapa y comprueba que siguen siendo los mismos.
import { LADO as LADO_TROZO, alturaDeTrozo, claveTrozo } from './trozos.js';

// el cuadro de la isla en metros del mundo (las celdas de tierra de la región de la isla, con una celda de margen de mar)
export const ISLA = { x0: 160000, z0: 21000, x1: 221000, z1: 84000 };
// el sitio de salida en metros del mundo, en metros enteros
export const SALIDA = { x: 184596, z: 46280 };

// ¿está (x, z) (m del mundo) dentro del cuadro de la isla?
export const dentroDeIsla = (x, z, isla = ISLA) => x >= isla.x0 && x <= isla.x1 && z >= isla.z0 && z <= isla.z1;

// el cuadro de las celdas de tierra de la región de la isla (m del mundo), con `margen` celdas de más alrededor
export function limitesIsla(mapa, margen = 1) {
  const { N, celda, pais, tierra, paisIsla } = mapa;
  let i0 = N, j0 = N, i1 = -1, j1 = -1;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (pais[k] !== paisIsla || !tierra[k]) continue;
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  return { x0: Math.max(0, i0 - margen) * celda, z0: Math.max(0, j0 - margen) * celda, x1: Math.min(N, i1 + 1 + margen) * celda, z1: Math.min(N, j1 + 1 + margen) * celda };
}

// La altura exacta del suelo (la de los trozos) en metros del mundo, con las funciones de cada trozo guardadas.
export function alturaMundo(paisaje) {
  const f = new Map();
  return (x, z) => {
    const i = Math.floor(x / LADO_TROZO), j = Math.floor(z / LADO_TROZO), k = claveTrozo(i, j);
    let a = f.get(k); if (!a) { if (f.size > 64) f.clear(); f.set(k, a = alturaDeTrozo(paisaje, i, j)); }
    return a(x, z);
  };
}

// Requisitos del sitio de salida: tierra firme (no el mar ni la playa), lejos de los ríos, llano alrededor (para andar y
// construir sin nivelar) y no en lo alto (nunca en un pico: por debajo de esta altura).
export const SALIDA_REQ = { alturaMin: 6, alturaMax: 220, radio: 30, desnivel: 2.5, rio: 60 };

// Busca el sitio de salida: en espiral desde el centro de la región de la isla, el primer punto que cumple SALIDA_REQ.
// Devuelve { x, z, y } (m del mundo, x y z enteros) o null.
export function buscarSalida(mapa, paisaje, req = SALIDA_REQ) {
  const c = mapa.centros[mapa.paisIsla >= 0 ? mapa.paisIsla : 0], N = mapa.N, celda = mapa.celda;
  const cx = (c % N + 0.5) * celda, cz = (((c / N) | 0) + 0.5) * celda;
  const alt = alturaMundo(paisaje);
  const isla = limitesIsla(mapa, 0);
  for (let r = 0; r < 20000; r += 40) {
    const vueltas = Math.max(1, Math.round(2 * Math.PI * r / 40));
    for (let a = 0; a < vueltas; a++) {
      const x = Math.round(cx + Math.cos(a / vueltas * 2 * Math.PI) * r), z = Math.round(cz + Math.sin(a / vueltas * 2 * Math.PI) * r);
      if (!dentroDeIsla(x, z, isla) || !esSalida(mapa, paisaje, alt, x, z, req)) continue;
      return { x, z, y: alt(x, z) };
    }
  }
  return null;
}

// ¿Vale (x, z) como sitio de salida? (ver SALIDA_REQ)
export function esSalida(mapa, paisaje, alt, x, z, req = SALIDA_REQ) {
  const y = alt(x, z);
  if (!(y >= req.alturaMin && y <= req.alturaMax)) return false;
  const ci = Math.min(mapa.N - 1, Math.floor(z / mapa.celda)) * mapa.N + Math.min(mapa.N - 1, Math.floor(x / mapa.celda));
  if (mapa.pais[ci] !== mapa.paisIsla) return false;
  // llano: en un corro de `radio` m, nada más alto ni más bajo que `desnivel` m, y todo por encima del agua
  for (let rr = 6; rr <= req.radio; rr += 6) for (let k = 0; k < 12; k++) {
    const yy = alt(x + Math.cos(k * Math.PI / 6) * rr, z + Math.sin(k * Math.PI / 6) * rr);
    if (Math.abs(yy - y) > req.desnivel || yy < req.alturaMin - 2) return false;
  }
  // lejos de los ríos (ni en el cauce ni en su orilla)
  const tramos = paisaje.riosEn(x - req.rio, z - req.rio, x + req.rio, z + req.rio, req.rio);
  for (const t of tramos) {
    const vx = t.bx - t.ax, vy = t.by - t.ay, l2 = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((x - t.ax) * vx + (z - t.ay) * vy) / l2));
    if (Math.hypot(x - t.ax - vx * u, z - t.ay - vy * u) < req.rio + t.ancho / 2) return false;
  }
  return true;
}
