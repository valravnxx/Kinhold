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
// mínimo suave (sin esquina): k es el ancho del redondeo, en las mismas unidades
const sminimo = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k / 4; };

// Catmull-Rom en una rejilla N × N (sin escalones ni pliegues entre celdas, a diferencia de la bilineal)
function cubica(arr, N, gx, gy) {
  const x = Math.floor(gx), y = Math.floor(gy), fx = gx - x, fy = gy - y;
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const v = (i, j) => arr[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  const fila = (j) => cr(v(x - 1, j), v(x, j), v(x + 1, j), v(x + 2, j), fx);
  return cr(fila(y - 1), fila(y), fila(y + 1), fila(y + 2), fy);
}

export const DETALLE = { mayor: 2000, octavas: 8 };
// cuánto resiste cada roca a la erosión: las duras dan cortados y escarpes; la arenisca, lomas redondeadas
export const DUREZA = { granito: 1, caliza: 0.9, pizarra: 0.8, arenisca: 0.25 };
// lo más empinado que se puede subir andando (desnivel por metro: 1 = 45°); más, es pared
export const PENDIENTE_ANDAR = 1;

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
  function detalle(xm, ym, r, fino = false) {
    const wx = xm + (fbm(xm / 1500, ym / 1500, S + 81, 3) - 0.5) * 500, wy = ym + (fbm(xm / 1500 + 9, ym / 1500, S + 82, 3) - 0.5) * 500;
    let px = wx / DETALLE.mayor, py = wy / DETALLE.mayor, a = 0, b = 1, dx = 0, dy = 0;
    for (let o = 0, n = DETALLE.octavas + (fino ? 3 : 0); o < n; o++) {   // fino: tres capas más, hasta unos 2 m (el suelo de cerca)
      ruidoD(px, py, S + 90 + o);
      dx += _d[1]; dy += _d[2];
      a += b * _d[0] / (1 + dx * dx + dy * dy);
      b *= 0.5;
      const nx = 0.8 * px - 0.6 * py, ny = 0.6 * px + 0.8 * py; px = nx * 2; py = ny * 2;
    }
    return a * (45 + 0.35 * r);
  }

  // altura del terreno (m) en un punto (en metros del mundo); tramos: los de riosEn() de esa zona
  // fino: con el detalle de hasta 2 m, para lo que rodea al jugador
  function altura(xm, ym, tramos = null, fino = false) {
    const { f, hm, r } = grande(xm, ym);
    if (f < 0) return Math.max(-60, f * 1.6);              // mar: el fondo baja desde la línea de costa (sin escalón)
    const { dm, nivel, ancho } = rioCercano(xm, ym, tramos);
    const monte = suave(120, 600, r);                      // 0 en el llano, 1 en la montaña
    // junto al río, el detalle se apaga: el fondo del valle lo marca el río (que ya talló el valle grande del mapa),
    // no el ruido; si no, el ruido levanta el fondo decenas de metros y el río queda en una zanja
    const calma = dm === Infinity ? 1 : 0.12 + 0.88 * suave(ancho / 2, ancho / 2 + (180 + ancho * 12) * (1 - 0.45 * monte), dm);
    let z = hm + detalle(xm, ym, r, fino) * suave(0, 3, f) * calma;
    // roca dura donde ya es empinado: el terreno se rompe en estratos, paredes de roca con repisas (ver escarpe())
    const duro = DUREZA[rocaEn(xm, ym)] ?? 0.5;
    // por zonas: unas laderas se rompen en cortados y otras quedan de hierba (más cortados en la montaña)
    const zona = duro > 0.5 && f > 3 && calma > 0.9 ? suave(0.5 - 0.12 * monte, 0.62 - 0.12 * monte, fbm(xm / 900, ym / 900, S + 125, 3)) : 0;
    if (zona > 0.001) z = escarpe(xm, ym, z, r, fino, duro * zona, calma);
    if (hm < 8) z = lerp(f * 0.5, z, suave(0, 2.5, f));    // costa baja: la playa baja suave hasta el agua
    z = Math.max(Math.min(0.4, f * 0.5), z);
    if (f < 10 && z > 2) {
      // junto al mar, la tierra alta baja en un cortado empinado (unos 60°) y no en una pared: la pared, en la rejilla,
      // sale en dientes de sierra. La distancia a la línea de costa sale de lo que cambia la forma alrededor
      const g1 = grande(xm + 4, ym).f, g2 = grande(xm, ym + 4).f, grad = Math.hypot(g1 - f, g2 - f) / 4 || 1e-3;
      // con las esquinas redondeadas arriba y abajo: un pliegue en diagonal a la rejilla se dibuja en zigzag
      const d = Math.max(0, f / grad);
      // el acantilado es roca: estratos casi verticales con repisas estrechas (cada capa a su altura) y la cara con
      // bultos y entrantes, no un plano liso
      let cortado = 0.3 + 2.4 * (Math.sqrt(d * d + 9) - 3);
      if (cortado > 3) cortado = 3 + estratos(xm, ym, cortado - 3, 0.7, 2.2).z + rugosidad(xm, ym) * suave(3, 8, cortado);   // capas grandes: la rejilla de 1 m las dibuja sin dientes
      z = sminimo(z, cortado, 4);
    }
    if (dm < 2500) {
      // el río talla su cauce, una vega llana a los lados y laderas con la pendiente limitada (suaves en el llano,
      // más cerradas en la montaña, donde salen gargantas); nunca una zanja de paredes verticales
      const cauce = Math.min(nivel, hm) - 1.2, orilla = cauce + 0.8, borde = ancho / 2 + 1.5;
      const vega = (ancho * 2.5 + 25) * (1 - 0.8 * monte);
      const ladera = lerp(0.14, 0.75, monte);              // desnivel por metro de distancia
      const fuera = Math.max(0, dm - borde);
      const valle = fuera < vega ? orilla + fuera * 0.015 : orilla + vega * 0.015 + (fuera - vega) * ladera;
      // el lecho baja hasta un metro bajo el cauce y sube a la orilla en rampa (sin escalón: el borde del agua
      // sale liso y no en dientes de sierra). Hasta el final de la vega el suelo es el del río (rebaja o rellena:
      // si no, donde el terreno queda más bajo el agua se saldría); más allá, el río solo rebaja (nunca levanta muros)
      const perfil = dm < borde ? lerp(cauce - 1, orilla, Math.pow(dm / borde, 1.5)) : valle;
      z = lerp(perfil, Math.min(z, perfil), suave(vega * 0.6, vega + 40, fuera));
    }
    return z;
  }

  // la roca madre de un punto (con el borde de la celda deformado como en sitio(), para que coincidan)
  function rocaEn(xm, ym) {
    const gx = g(xm), gy = g(ym);
    const dx = (fbm(xm / 900, ym / 900, S + 101, 3) - 0.5) * 2.4, dy = (fbm(xm / 900 + 5, ym / 900, S + 102, 3) - 0.5) * 2.4;
    return roca[Math.min(N - 1, Math.max(0, Math.round(gy + dy))) * N + Math.min(N - 1, Math.max(0, Math.round(gx + dx)))] || 'caliza';
  }
  // Escarpes y cortados: donde la roca es dura y la ladera ya es empinada, el terreno se escalona en estratos (el
  // «terraceado» de los generadores de terreno): cada estrato es una repisa casi llana y una pared de roca. Para que no
  // parezcan bancales, los estratos van inclinados (buzamiento) y ondulados, cada uno de altura distinta, y solo salen
  // donde la pendiente ya es fuerte: en lo suave no hay pared. La pendiente se mide con dos puntos más (solo aquí).
  function escarpe(xm, ym, z, r, fino, fuerza, calma) {
    const h = 4, zx = grande(xm + h, ym).hm + detalle(xm + h, ym, r, fino) * calma, zy = grande(xm, ym + h).hm + detalle(xm, ym + h, r, fino) * calma;
    const pend = Math.hypot(zx - z, zy - z) / h;
    const w = suave(0.22, 0.5, pend) * fuerza;
    if (w <= 0.001) return z;
    const bx = (fbm(xm / 6000, ym / 6000, S + 121, 2) - 0.5) * 0.12, by = (fbm(xm / 6000 + 3, ym / 6000, S + 122, 2) - 0.5) * 0.12;
    const plano = xm * bx + ym * by + (fbm(xm / 260, ym / 260, S + 123, 3) - 0.5) * 14;      // buzamiento y ondulación
    const e = estratos(xm, ym, z - plano, 0.16);
    return lerp(z, e.z + plano + rugosidad(xm, ym) * e.pared, w);
  }
  // escalona una altura en estratos de 6 a 15 m (por escala) (cada uno con su pared en otro sitio de su altura); ancho: cuánto de
  // cada estrato es pared (0,16: repisas anchas; 0,85: casi todo pared). pared: 0–1, si el punto cae en la pared
  function estratos(xm, ym, z, ancho, escala = 1) {
    const paso = (6 + 9 * fbm(xm / 2200, ym / 2200, S + 124, 2)) * escala;
    const u = z / paso, k = Math.floor(u), fr = u - k;
    const salto = 0.5 + (hash2(k, 7, S) - 0.5) * (0.9 - ancho) * 0.6;
    const a = Math.max(0.02, salto - ancho / 2), b = Math.min(0.98, salto + ancho / 2);
    return { z: (k + suave(a, b, fr)) * paso, pared: suave(a - 0.05, a + 0.05, fr) * (1 - suave(b - 0.05, b + 0.05, fr)) };
  }
  // los bultos y entrantes de una cara de roca (m)
  function rugosidad(xm, ym) { return (fbm(xm / 9, ym / 9, S + 126, 3) - 0.5) * 3 + (fbm(xm / 2.5, ym / 2.5, S + 127, 2) - 0.5) * 0.4; }

  // el río más cercano a un punto: distancia (m), altura del río en ese tramo y ancho
  function rioCercano(xm, ym, tramos) {
    let dm = Infinity, nivel = 0, ancho = 2, tramo = null;
    if (tramos) for (const t of tramos) {
      const vx = t.bx - t.ax, vy = t.by - t.ay, l2 = vx * vx + vy * vy || 1;
      const u = Math.max(0, Math.min(1, ((xm - t.ax) * vx + (ym - t.ay) * vy) / l2));
      const dd = Math.hypot(xm - t.ax - vx * u, ym - t.ay - vy * u);
      if (dd < dm) { dm = dd; nivel = lerp(t.ha, t.hb, u); ancho = t.ancho; tramo = t; }
    }
    return { dm, nivel, ancho, tramo };
  }
  // la corriente del río en un punto: dirección (hacia donde baja: los tramos van de la fuente a la boca) y velocidad
  // (m/s), que crece con la pendiente del cauce: unos 0,5 m/s en la vega y hasta 3 m/s en los torrentes de montaña
  function corriente(xm, ym, tramos) {
    const { tramo: t } = rioCercano(xm, ym, tramos);
    if (!t) return { dx: 0, dy: 0, vel: 0 };
    const vx = t.bx - t.ax, vy = t.by - t.ay, l = Math.hypot(vx, vy) || 1;
    const pend = Math.max(0, (t.ha - t.hb) / l);
    return { dx: vx / l, dy: vy / l, vel: Math.min(3, Math.max(0.3, Math.sqrt(pend) * 22)) };
  }
  // altura del agua del río en un punto cercano al cauce (m), o null si el punto no está junto a un río
  function agua(xm, ym, tramos) {
    const { dm, nivel, ancho } = rioCercano(xm, ym, tramos);
    if (dm > ancho / 2 + 4) return null;
    const { f, hm } = grande(xm, ym);
    if (f < 0) return null;                                  // en la desembocadura ya es el mar
    return Math.min(nivel, hm) - 1.2 + 0.2;   // un poco por encima del cauce: el agua cubre el lecho
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
    return { roca: roca[ci] || 'caliza', bioma: bioma[ci] || z > 0.3 ? b : null, T, P, pais: pais[ci] };   // tierra aunque la celda del mapa sea de mar (la costa de cerca no coincide al metro)
  }

  return { altura, agua, corriente, sitio, riosEn, rios, celda };
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

// El azar de una celda del mundo (i, j enteros) para una capa de cosas (árboles, hierba…) y una semilla: un generador
// que da siempre la misma serie para la misma celda. Así lo que se coloca depende solo de su sitio en el mundo.
export function azarCelda(i, j, capa, semilla) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(capa, 1274126177) ^ Math.imul(semilla | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  let s = h >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
