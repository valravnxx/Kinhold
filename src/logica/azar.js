// Azar y ruido con semilla: un solo sitio para todos los generadores del juego (lógica pura, sin three.js, para que el
// servidor dé los mismos números que el navegador). Cada función da exactamente la misma serie que daba antes en su
// sitio de origen: cambiar una sola cifra movería árboles, rocas, golpes o el mapa entero.

// Generador rápido de buena calidad (mulberry32): combate y mapa del mundo.
export function azar(semilla = 1) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Generador congruencial lineal: decorado, rocas, texturas y piezas (lo que se dibuja).
export function azarLineal(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// El azar de una celda del mundo (i, j enteros) para una capa de cosas (árboles, hierba…) y una semilla: un generador
// que da siempre la misma serie para la misma celda. Así lo que se coloca depende solo de su sitio en el mundo.
export function azarCelda(i, j, capa, semilla) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(capa, 1274126177) ^ Math.imul(semilla | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  let s = h >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Número fijo (0 a 1) para un punto entero del plano o del espacio, con semilla.
export function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash3(x, y, z, s) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const suave = (t) => t * t * (3 - 2 * t);

// Ruido de valor en el plano (0 a 1) y su suma por octavas.
export function ruido(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = suave(x - xi), fy = suave(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s, oct = 5) {
  let r = 0, amp = 0.5, f = 1, tot = 0;
  for (let o = 0; o < oct; o++) { r += ruido(x * f, y * f, s + o * 31) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return r / tot;
}

// Ruido de valor (−1 a 1) con sus derivadas: deja en d = [valor, d/dx, d/dy].
export function ruidoD(x, y, s, d) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), dux = 6 * fx * (1 - fx), duy = 6 * fy * (1 - fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), k = a - b - c + hash2(xi + 1, yi + 1, s);
  d[0] = (a + (b - a) * ux + (c - a) * uy + k * ux * uy) * 2 - 1;
  d[1] = dux * ((b - a) + k * uy) * 2; d[2] = duy * ((c - a) + k * ux) * 2;
}

// Ruido de valor en el espacio (0 a 1).
export function ruido3(x, y, z, semilla = 7) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = suave(x - xi), fy = suave(y - yi), fz = suave(z - zi);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++)
    r += hash3(xi + dx, yi + dy, zi + dz, semilla) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
  return r;
}

// Pseudoazar rápido sin estado (0 a 1) para variaciones pequeñas de color o de forma en lo que se dibuja.
export function pseudo(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
export function pseudo3(x, y, z) { const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.71) * 43758.55; return s - Math.floor(s); }
