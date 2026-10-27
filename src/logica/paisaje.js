// Kinhold — el paisaje de cerca (lógica pura, sin three.js): la altura de cualquier punto del mundo en metros y lo
// que hay en él, a partir del mapa del mundo (src/logica/mapa.js), que tiene una celda por kilómetro.
//
// El mapa solo da la forma grande. De cerca, el terreno de verdad tiene pendientes de todos los tamaños a la vez
// (medido en terreno real, las pendientes siguen la misma distribución a cualquier escala), así que encima de la forma
// grande se suman capas de detalle, de 1,8 km a unos 15 m, con más fuerza donde el mapa ya es abrupto:
//   - en la montaña, crestas afiladas (ruido «de cresta»);
//   - en el llano, lomas y ondulaciones (nunca un llano liso de kilómetros);
//   - junto a la costa el detalle se apaga, y donde la tierra alta llega al mar queda un cortado (acantilado);
//   - los ríos tallan su cauce y el valle a su alrededor (más cerrado en la montaña).
// Todo depende solo de la posición y de la semilla del mundo: todos ven el mismo paisaje.
import { fbm, clasificarBioma, riosDelMapa, anchoRio } from './mapa.js';

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Catmull-Rom en una rejilla N × N (sin escalones ni pliegues entre celdas, a diferencia de la bilineal)
function cubica(arr, N, gx, gy) {
  const x = Math.floor(gx), y = Math.floor(gy), fx = gx - x, fy = gy - y;
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const v = (i, j) => arr[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  const fila = (j) => cr(v(x - 1, j), v(x, j), v(x + 1, j), v(x + 2, j), fx);
  return cr(fila(y - 1), fila(y), fila(y + 1), fila(y + 2), fy);
}

export const DETALLE = { mayor: 2000, octavas: 8 };

// ruido de valor (−1 a 1) con sus derivadas, en _d = [valor, d/dx, d/dy]
const _d = new Float64Array(3);
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function ruidoD(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), dux = 6 * fx * (1 - fx), duy = 6 * fy * (1 - fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s), k = a - b - c + d;
  _d[0] = (a + (b - a) * ux + (c - a) * uy + k * ux * uy) * 2 - 1;
  _d[1] = dux * ((b - a) + k * uy) * 2; _d[2] = duy * ((c - a) + k * ux) * 2;
}

export function crearPaisaje(mapa) {
  const { N, lado, h, forma, temp, lluvia, bioma, roca, pais } = mapa;
  const celda = lado * 1000 / N, S = mapa.semilla % 100000;
  // rugosidad del mapa: diferencia entre lo más alto y lo más bajo alrededor de cada celda (m)
  const rug = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let lo = Infinity, hi = -Infinity;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const xx = Math.min(N - 1, Math.max(0, x + a)), yy = Math.min(N - 1, Math.max(0, y + b)); const v = h[yy * N + xx]; if (v < lo) lo = v; if (v > hi) hi = v; }
    rug[y * N + x] = hi - lo;
  }
  const rios = riosDelMapa(mapa, 15e6);
  const g = (m) => m / celda - 0.5;

  // los tramos de río que pasan cerca de una zona (para no recorrerlos todos en cada punto)
  function riosEn(x0, y0, x1, y1, margen = 600) {
    const tramos = [];
    for (const r of rios) for (let k = 0; k < r.length - 1; k++) {
      const a = r[k], b = r[k + 1], ax = a.p[0] * 1000, ay = a.p[1] * 1000, bx = b.p[0] * 1000, by = b.p[1] * 1000;
      if (Math.max(ax, bx) < x0 - margen || Math.min(ax, bx) > x1 + margen || Math.max(ay, by) < y0 - margen || Math.min(ay, by) > y1 + margen) continue;
      tramos.push({ ax, ay, bx, by, ha: a.h, hb: b.h, ancho: Math.max(2, anchoRio(Math.max(a.a, b.a))) });
    }
    return tramos;
  }

  // la forma grande (m): altura del mapa, línea de costa y cuánto de abrupto es el sitio
  function grande(xm, ym) {
    const gx = g(xm), gy = g(ym);
    const f = cubica(forma, N, gx, gy) + (fbm(xm / 2500, ym / 2500, S + 77, 3) - 0.5) * 4 + (fbm(xm / 350, ym / 350, S + 78, 3) - 0.5) * 1.6;
    return { f, hm: Math.max(0, cubica(h, N, gx, gy)), r: Math.max(0, cubica(rug, N, gx, gy)) };
  }

  // las capas de detalle (m): ruido con sus derivadas, y cada capa se apaga donde la pendiente acumulada ya es grande
  // (el «fbm con derivadas» de Íñigo Quílez): las laderas quedan lisas y las crestas y vaguadas, marcadas, como si la
  // erosión hubiera trabajado. Cada capa va girada respecto a la anterior para que nada se alinee en cuadrícula.
  function detalle(xm, ym, r) {
    const wx = xm + (fbm(xm / 1500, ym / 1500, S + 81, 3) - 0.5) * 500, wy = ym + (fbm(xm / 1500 + 9, ym / 1500, S + 82, 3) - 0.5) * 500;
    let px = wx / DETALLE.mayor, py = wy / DETALLE.mayor, a = 0, b = 1, dx = 0, dy = 0;
    for (let o = 0; o < DETALLE.octavas; o++) {
      ruidoD(px, py, S + 90 + o);
      dx += _d[1]; dy += _d[2];
      a += b * _d[0] / (1 + dx * dx + dy * dy);
      b *= 0.5;
      const nx = 0.8 * px - 0.6 * py, ny = 0.6 * px + 0.8 * py; px = nx * 2; py = ny * 2;
    }
    return a * (45 + 0.35 * r);
  }

  // altura del terreno (m) en un punto (en metros del mundo); tramos: los de riosEn() de esa zona
  function altura(xm, ym, tramos = null) {
    const { f, hm, r } = grande(xm, ym);
    if (f < 0) return Math.max(-60, -1.5 + f * 0.8);       // mar: el fondo baja al alejarse de la costa
    let z = hm + detalle(xm, ym, r) * suave(0, 3, f);
    if (hm < 8) z = lerp(0.6, z, suave(0, 2.5, f));        // costa baja: playa o marisma, sin escalón
    z = Math.max(0.4, z);
    if (tramos) {
      // el río talla su cauce y su valle (más cerrado donde el sitio es abrupto)
      let dm = Infinity, nivel = 0, ancho = 2;
      for (const t of tramos) {
        const vx = t.bx - t.ax, vy = t.by - t.ay, l2 = vx * vx + vy * vy || 1;
        const u = Math.max(0, Math.min(1, ((xm - t.ax) * vx + (ym - t.ay) * vy) / l2));
        const dd = Math.hypot(xm - t.ax - vx * u, ym - t.ay - vy * u);
        if (dd < dm) { dm = dd; nivel = lerp(t.ha, t.hb, u); ancho = t.ancho; }
      }
      if (dm < 1500) {
        const valle = (70 + ancho * 4) * (1 - 0.55 * suave(150, 700, r)) + 30;
        const cauce = Math.min(nivel, hm) - 1.2;
        const orilla = cauce + 0.8 + Math.max(0, dm - ancho / 2) * 0.12;
        // el río solo rebaja (nunca levanta muros): cauce, orilla y valle que se abre hasta el terreno
        z = Math.min(z, dm < ancho / 2 ? cauce - 1 : lerp(orilla, z, suave(ancho / 2, ancho / 2 + valle, dm)));
      }
    }
    return z;
  }

  // qué hay en un punto: celda del mapa (con el borde deformado, sin escalones), bioma con la temperatura de su altura
  function sitio(xm, ym, z) {
    const gx = g(xm), gy = g(ym);
    const dx = (fbm(xm / 900, ym / 900, S + 101, 3) - 0.5) * 2.4, dy = (fbm(xm / 900 + 5, ym / 900, S + 102, 3) - 0.5) * 2.4;
    const ci = Math.min(N - 1, Math.max(0, Math.round(gy + dy))) * N + Math.min(N - 1, Math.max(0, Math.round(gx + dx)));
    const hm = Math.max(0, cubica(h, N, gx, gy));
    const T = cubica(temp, N, gx, gy) - (z - hm) * 0.0065;
    const P = cubica(lluvia, N, gx, gy) * (0.85 + 0.3 * fbm(xm / 3000, ym / 3000, S + 83, 3));
    const b = clasificarBioma(T, P, mapa.pend[ci], z, mapa.A[ci] / (celda * celda));
    return { roca: roca[ci] || 'caliza', bioma: bioma[ci] ? b : null, T, P, pais: pais[ci] };
  }

  return { altura, sitio, riosEn, rios, celda };
}

// Espesor del bosque (0–1) y qué árbol: según bioma, temperatura, pendiente (en tanto por uno) y un ruido de claros.
// Más denso en el fondo de los valles y junto al agua, menos en lomas y cumbres, nada en los cortados ni por encima
// del límite del bosque.
export function bosqueEn(bioma, T, pendiente, claro, humedo = 0) {
  const base = { taiga: 0.85, caducifolio: 0.9, mixto: 0.7, encinar: 0.6, brezal: 0.12, pradera: 0.1, matorral: 0.08, turbera: 0.05, alpino: 0.06, nieve: 0 }[bioma] ?? 0;
  let d = base * (1 - suave(0.55, 0.95, pendiente)) * suave(0.5, 3.5, T);
  d *= 0.08 + 0.92 * suave(0.44, 0.58, claro);            // bosquetes y claros bien marcados (no un reparto uniforme)
  d = Math.min(1, d * (1 + humedo * 0.4));
  const pino = bioma === 'taiga' || bioma === 'alpino' || bioma === 'brezal' || (bioma === 'mixto' && claro > 0.5) || T < 5;
  return { d, pino };
}
