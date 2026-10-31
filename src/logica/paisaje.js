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
import { hash2, ruidoD as ruidoDerivadas, azarCelda } from './azar.js';

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
const ruidoD = (x, y, s) => ruidoDerivadas(x, y, s, _d);

// opciones.afloramientos: qué parte del mundo es afloramiento de roca, donde salen cortados (0,66 de umbral del ruido:
// un 8 % del mundo); para las pruebas se puede bajar a 0 (todo afloramiento, como era antes de separar laderas y cortados)
// opciones.valleLiso: solo para las pruebas, las laderas de los valles de antes del 31 oct (planos lisos y rectos)
export function crearPaisaje(mapa, { afloramientos = 0.66, valleLiso = false } = {}) {
  const { N, lado, h, forma, temp, lluvia, bioma, roca, pais } = mapa;
  const celda = lado * 1000 / N, S = mapa.semilla % 100000;
  // rugosidad del mapa: diferencia entre lo más alto y lo más bajo alrededor de cada celda (m)
  const rug = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let lo = Infinity, hi = -Infinity;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const xx = Math.min(N - 1, Math.max(0, x + a)), yy = Math.min(N - 1, Math.max(0, y + b)); const v = h[yy * N + xx]; if (v < lo) lo = v; if (v > hi) hi = v; }
    rug[y * N + x] = hi - lo;
  }
  const g = (m) => m / celda - 0.5;
  const rios = riosDelMapa(mapa, 15e6);
  // Los ríos se adaptan al terreno (valravnx, 30 oct): la altura de cada punto del río sale del mapa (celdas de 1 km),
  // pero el relieve de detalle puede dejar el suelo de alrededor decenas de metros más bajo; entonces el río iba por
  // encima, en un terraplén, como un puente sobre el valle. Ahora el agua de cada punto queda por debajo del suelo de
  // detalle de ese sitio y del camino hasta el siguiente (sin lo que el detalle sube, que junto al río se apaga), y
  // nunca sube río abajo. Se guarda también el suelo (g) para que el salto de agua no levante el cauce por encima.
  for (const r of rios) {
    let antes = Infinity;
    for (let k = 0; k < r.length; k++) {
      const q = r[k], n = r[Math.min(r.length - 1, k + 1)];
      q.g = Math.min(sueloRio(q.p[0] * 1000, q.p[1] * 1000), sueloRio((q.p[0] + n.p[0]) * 500, (q.p[1] + n.p[1]) * 500));
      q.h = antes = Math.max(1, Math.min(antes, q.h, q.g - 1));   // (como poco 1 m: el agua, al nivel del mar)
    }
  }

  // los tramos de río que pasan cerca de una zona (para no recorrerlos todos en cada punto)
  function riosEn(x0, y0, x1, y1, margen = 600) {
    const tramos = [];
    for (const r of rios) for (let k = 0; k < r.length - 1; k++) {
      const a = r[k], b = r[k + 1], ax = a.p[0] * 1000, ay = a.p[1] * 1000, bx = b.p[0] * 1000, by = b.p[1] * 1000;
      if (Math.max(ax, bx) < x0 - margen || Math.min(ax, bx) > x1 + margen || Math.max(ay, by) < y0 - margen || Math.min(ay, by) > y1 + margen) continue;
      const t = { ax, ay, bx, by, ha: a.h, hb: b.h, ga: a.g, gb: b.g, ancho: Math.max(2, anchoRio(Math.max(a.a, b.a))), fuente: k === 0 };
      t.largo = Math.hypot(bx - ax, by - ay) || 1;
      t.salto = saltoDe(t);
      t.hondoA = hondoDe(ax, ay, t.ancho); t.hondoB = hondoDe(bx, by, t.ancho);
      t.vado = vadoDe(t); t.meandro = meandroDe(t);
      tramos.push(t);
    }
    return tramos;
  }
  // Salto de agua: donde el río baja mucho en un tramo que va por roca dura, casi todo ese desnivel se concentra en un
  // punto (el salto) en vez de repartirse por el tramo, como pasa en los ríos de verdad: la roca dura aguanta y forma el
  // escalón, y aguas abajo el río queda más hondo y talla su garganta. Uno de cada siete de esos tramos tiene salto.
  function saltoDe(t) {
    const caida = t.ha - t.hb;
    if (caida < 5 || caida / t.largo < 0.012) return null;
    const mx = (t.ax + t.bx) / 2, my = (t.ay + t.by) / 2;
    if ((DUREZA[rocaEn(mx, my)] ?? 0.5) < 0.6) return null;
    const h = hash2(Math.round(mx / 7), Math.round(my / 7), S + 131);
    if (h > 0.14) return null;
    return { u: 0.3 + 0.4 * hash2(Math.round(mx / 11), Math.round(my / 11), S + 132), alto: Math.min(33, caida * 0.7) };   // de 4 a 35 m (33 más la bajada de los 3 m de alrededor)
  }
  // Ríos de verdad (valravnx, 30 oct): lo hondo del río en el centro del cauce (m), según su grueso (GDD: los arroyos
  // se vadean; los ríos tienen vados escasos; los grandes piden barca o puente). Sale del sitio del punto del río, así
  // que dos tramos que se tocan tienen la misma hondura en la junta.
  function hondoDe(x, y, ancho) {
    const h = hash2(Math.round(x / 13), Math.round(y / 13), S + 141);
    return ancho < 5 ? 0.3 + 0.3 * h : ancho < 40 ? 1.5 + 1.0 * h : 2.8 + 1.5 * h;
  }
  // Vado: en uno de cada ocho tramos de río mediano (sin salto de agua), un trecho de 20 m más el ancho del río en el
  // que el agua cubre unos 0,7 m y se cruza andando (unos 2 km entre vado y vado)
  function vadoDe(t) {
    if (t.salto || t.ancho < 5 || t.ancho >= 40) return null;
    const mx = (t.ax + t.bx) / 2, my = (t.ay + t.by) / 2;
    if (hash2(Math.round(mx / 7), Math.round(my / 7), S + 142) > 0.125) return null;
    return { u: 0.25 + 0.5 * hash2(Math.round(mx / 9), Math.round(my / 9), S + 143), largo: 20 + t.ancho };
  }
  // Meandros: el cauce no va recto de un punto al siguiente sino en curvas, con una curva cada unos 11 anchos de río
  // (como los de verdad) y de lado hasta 1,2 anchos (nunca más del 15 % de lo que mide la curva). En los tramos con
  // salto de agua, recto (garganta). Se anula en las juntas: los tramos siguen unidos.
  function meandroDe(t) {
    if (t.salto) return null;
    const mx = (t.ax + t.bx) / 2, my = (t.ay + t.by) / 2, h = hash2(Math.round(mx / 5), Math.round(my / 5), S + 144);
    const curva = Math.min(450, Math.max(30, t.ancho * 11)), k = Math.max(1, Math.round(t.largo / curva)), l = t.largo / k;
    return { k, a: Math.min(0.15 * l, 1.2 * t.ancho + 2) * (0.4 + 0.6 * h) * (h > 0.5 ? 1 : -1) };
  }
  const desvio = (t, u) => t.meandro ? t.meandro.a * Math.sin(2 * Math.PI * t.meandro.k * u) : 0;
  // lo hondo del agua en el centro del cauce en u
  function hondoTramo(t, u) {
    const h = lerp(t.hondoA ?? 1.2, t.hondoB ?? 1.2, u);
    if (!t.vado) return h;
    return lerp(0.7, h, suave(t.vado.largo / 2, t.vado.largo / 2 + 15, Math.abs(u - t.vado.u) * t.largo));
  }
  // los vados de unos tramos: dónde están (m del mundo), dirección del río, ancho y largo
  function vadosEn(tramos) {
    return tramos.filter(t => t.vado).map(t => {
      const u = t.vado.u, dx = (t.bx - t.ax) / t.largo, dy = (t.by - t.ay) / t.largo, o = desvio(t, u);
      return { x: lerp(t.ax, t.bx, u) - dy * o, y: lerp(t.ay, t.by, u) + dx * o, dx, dy, ancho: t.ancho, largo: t.vado.largo };
    });
  }
  // la altura del río a lo largo de un tramo (u de 0 a 1, de arriba abajo): recta, o con el salto
  function nivelTramo(t, u) {
    if (!t.salto) return lerp(t.ha, t.hb, u);
    const { u: u0, alto } = t.salto, resto = (t.ha - t.hb - alto) / 2, w = Math.min(0.2, 3 / t.largo);
    const arriba = t.ha - resto * Math.min(1, u / u0), abajo = t.hb + resto * Math.min(1, (1 - u) / (1 - u0));
    return lerp(arriba, abajo, suave(u0 - w / 2, u0 + w / 2, u));
  }
  // los saltos de agua de unos tramos: dónde están (m del mundo), alto de arriba y de abajo, dirección del río y ancho
  function saltosEn(tramos) {
    return tramos.filter(t => t.salto).map(t => {
      const u = t.salto.u, x = lerp(t.ax, t.bx, u), y = lerp(t.ay, t.by, u), w = Math.min(0.2, 3 / t.largo);
      return { x, y, arriba: nivelTramo(t, u - w), abajo: nivelTramo(t, u + w), dx: (t.bx - t.ax) / t.largo, dy: (t.by - t.ay) / t.largo, ancho: t.ancho };
    });
  }

  // la forma grande (m): altura del mapa, línea de costa y cuánto de abrupto es el sitio
  function grande(xm, ym) {
    const gx = g(xm), gy = g(ym);
    const f = cubica(forma, N, gx, gy) + (fbm(xm / 2500, ym / 2500, S + 77, 3) - 0.5) * 4 + (fbm(xm / 350, ym / 350, S + 78, 3) - 0.5) * 1.6;
    return { f, hm: Math.max(0, cubica(h, N, gx, gy)), r: Math.max(0, cubica(rug, N, gx, gy)) };
  }

  // el suelo junto al río (m): el del mapa con lo que el detalle lo baja (lo que lo sube, junto al río se apaga)
  function sueloRio(xm, ym) {
    const { f, hm, r } = grande(xm, ym);
    if (f < 0) return 0;
    return Math.max(0.5, hm + Math.min(0, detalle(xm, ym, r) * suave(0, 3, f)));
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
    const { dm, nivel, ancho, salto, lecho, hondo, cabeza } = rioCercano(xm, ym, tramos);
    const monte = suave(120, 600, r);                      // 0 en el llano, 1 en la montaña
    // junto al río, el detalle se apaga: el fondo del valle lo marca el río (que ya talló el valle grande del mapa),
    // no el ruido; si no, el ruido levanta el fondo decenas de metros y el río queda en una zanja
    const calma = dm === Infinity ? 1 : 0.12 + 0.88 * suave(ancho / 2, ancho / 2 + (180 + ancho * 12) * (1 - 0.45 * monte), dm);
    // (solo se apaga lo que sube: lo que baja se queda, y el río, que ya va por debajo de ese suelo, no queda en alto)
    const det = detalle(xm, ym, r, fino) * suave(0, 3, f);
    let z = hm + (det > 0 ? det * calma : det);
    // roca dura donde ya es empinado: el terreno se rompe en estratos, paredes de roca con repisas (ver escarpe())
    const duro = DUREZA[rocaEn(xm, ym)] ?? 0.5;
    // por zonas: unas laderas se rompen en cortados y otras quedan de hierba (más cortados en la montaña)
    // los afloramientos: manchas sueltas de unos cientos de metros donde la roca sale a la luz (no toda la montaña); el
    // resto de la ladera queda continua, con su hierba, su pedregal o su nieve
    const zona = duro > 0.5 && f > 3 && calma > 0.9 ? suave(afloramientos - 0.03 * monte, afloramientos + 0.06 - 0.03 * monte, fbm(xm / 700, ym / 700, S + 125, 3)) : 0;
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
      // (el escalón del salto de agua va encima: si no, al recortar el cauce a la altura del mapa se perdía)
      const cauce = lecho, orilla = cauce + 0.8, borde = ancho / 2 + 1.5;
      const vega = (ancho * 2.5 + 25) * (1 - 0.8 * monte);
      // desnivel por metro de distancia; río arriba de donde nace (cabeza: cuánto, en m), poco a poco hasta la mitad: el
      // valle se cierra en una cabecera suave y no en una pared (el río nace ya en lo hondo del valle del mapa)
      const ladera = lerp(0.14, 0.75, monte) * (valleLiso ? 1 : 1 - 0.5 * suave(0, 200, cabeza));
      const fuera = Math.max(0, dm - borde), pie = orilla + vega * 0.015;
      let valle = fuera < vega ? orilla + fuera * 0.015 : pie + (fuera - vega) * ladera;
      // Las laderas del valle no son planos (valravnx, 31 oct: «una separación de alturas anormal recta que ocupa
      // kilómetros»): donde el río va muy por debajo del terreno de alrededor, el valle tallado con una pendiente fija
      // dejaba una pared lisa, recta a lo largo del tramo y con una arista viva arriba. Ahora la pendiente cambia por
      // trechos de unos cientos de metros (el borde de arriba no va recto), la ladera lleva el relieve de detalle del
      // sitio y la arista de arriba se redondea (mínimo suave, más abajo)
      if (fuera > vega && !valleLiso) {
        const alto = valle - pie;
        valle = pie + Math.max(alto * 0.5, alto * (0.7 + 0.6 * fbm(xm / 450, ym / 450, S + 151, 3)) + det * 0.6 * suave(0, 150, alto));   // (nunca por debajo de la vega: nada de hoyos junto al río)
      }
      // el lecho baja hasta un metro bajo el cauce y sube a la orilla en rampa (sin escalón: el borde del agua
      // sale liso y no en dientes de sierra). Hasta el final de la vega el suelo es el del río (rebaja o rellena:
      // si no, donde el terreno queda más bajo el agua se saldría); más allá, el río solo rebaja (nunca levanta muros)
      const perfil = dm < borde ? lerp(cauce + 0.2 - hondo, orilla, Math.pow(dm / borde, 1.5)) : valle;
      const tallado = fuera > vega && !valleLiso ? sminimo(z, perfil, Math.max(0.01, Math.min(24, (fuera - vega) * ladera * 0.4))) : Math.min(z, perfil);   // (junto a la vega, sin redondeo: no baja del suelo del valle)
      z = lerp(perfil, tallado, suave(vega * 0.6, vega + 40, fuera));
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
    const w = suave(0.5, 0.85, pend) * fuerza;                                                // solo en lo que ya es muy empinado
    if (w <= 0.001) return z;
    const bx = (fbm(xm / 6000, ym / 6000, S + 121, 2) - 0.5) * 0.12, by = (fbm(xm / 6000 + 3, ym / 6000, S + 122, 2) - 0.5) * 0.12;
    const plano = xm * bx + ym * by + (fbm(xm / 260, ym / 260, S + 123, 3) - 0.5) * 14;      // buzamiento y ondulación
    const e = estratos(xm, ym, z - plano, 0.45, 3);                                          // pocos escalones grandes (de 15 a 40 m), no peldaños
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
    let dm = Infinity, nivel = 0, ancho = 2, tramo = null, uu = 0, salto = 0, suelo = 0, cabeza = 0;
    if (tramos) for (const t of tramos) {
      const vx = t.bx - t.ax, vy = t.by - t.ay, l2 = vx * vx + vy * vy || 1;
      const u0 = ((xm - t.ax) * vx + (ym - t.ay) * vy) / l2, u = Math.max(0, Math.min(1, u0));
      // dentro del tramo, la distancia al cauce con su meandro (a lo ancho); en las puntas, al punto
      const dd = u0 > 0 && u0 < 1 && t.meandro ? Math.abs(((ym - t.ay) * vx - (xm - t.ax) * vy) / t.largo - desvio(t, u)) : Math.hypot(xm - t.ax - vx * u, ym - t.ay - vy * u);
      if (dd < dm) { dm = dd; nivel = nivelTramo(t, u); salto = nivel - lerp(t.ha, t.hb, u); ancho = t.ancho; tramo = t; uu = u; suelo = lerp(t.ga ?? Infinity, t.gb ?? Infinity, u); cabeza = t.fuente ? Math.max(0, -u0 * t.largo) : 0; }
    }
    return { dm, nivel, ancho, tramo, u: uu, salto, cabeza, lecho: lechoDe(nivel, salto, suelo), hondo: tramo ? hondoTramo(tramo, uu) : 1.2 };   // salto: lo que el salto de agua sube o baja el cauce aquí
  }
  // la altura del cauce (m): la del río, 1,2 m por debajo del agua. Por encima del salto de agua el río va más alto que
  // la línea recta del tramo, pero nunca por encima del suelo de alrededor (si no, quedaba en terraplén); por debajo
  // del salto va más hondo (su garganta)
  function lechoDe(nivel, salto, suelo) {
    const recto = nivel - salto;
    return (salto > 0 ? Math.min(nivel, Math.max(recto, suelo)) : nivel) - 1.2;
  }
  // la corriente del río en un punto: dirección (hacia donde baja: los tramos van de la fuente a la boca) y velocidad
  // (m/s), que crece con la pendiente del cauce: unos 0,5 m/s en la vega y hasta 3 m/s en los torrentes de montaña
  function corriente(xm, ym, tramos) {
    const { tramo: t, u } = rioCercano(xm, ym, tramos);
    if (!t) return { dx: 0, dy: 0, vel: 0 };
    const vx = t.bx - t.ax, vy = t.by - t.ay, l = t.largo;
    // la pendiente de aquí mismo (unos 10 m de cauce): en el salto y justo antes, el agua va a toda velocidad
    const du = Math.min(0.5, 5 / l), pend = Math.max(0, (nivelTramo(t, Math.max(0, u - du)) - nivelTramo(t, Math.min(1, u + du))) / (2 * du * l));
    // en el meandro, el agua sigue la curva
    const m = t.meandro, giro = m ? Math.atan(m.a * 2 * Math.PI * m.k / l * Math.cos(2 * Math.PI * m.k * u)) : 0, c = Math.cos(giro), s = Math.sin(giro);
    return { dx: (vx * c - vy * s) / l, dy: (vx * s + vy * c) / l, vel: Math.min(3, Math.max(0.3, Math.sqrt(pend) * 22)) };
  }
  // altura del agua del río en un punto cercano al cauce (m), o null si el punto no está junto a un río
  function agua(xm, ym, tramos) {
    const { dm, ancho, lecho } = rioCercano(xm, ym, tramos);
    if (dm > ancho / 2 + 4) return null;
    const { f } = grande(xm, ym);
    if (f < 0) return null;                                  // en la desembocadura ya es el mar
    return lecho + 0.2;                                      // un poco por encima del cauce: el agua cubre el lecho
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

  // lo hondo del agua en un punto (m: lo que hay de la superficie al suelo), o null si no hay agua de río ni mar
  function hondura(xm, ym, tramos, fino = false) {
    const z = altura(xm, ym, tramos, fino);
    if (grande(xm, ym).f < 0 || z < 0) return Math.max(0, -z);            // el mar (su superficie, a 0 m)
    const w = agua(xm, ym, tramos);
    return w === null ? null : Math.max(0, w - z);
  }
  return { altura, agua, hondura, corriente, saltosEn, vadosEn, sitio, riosEn, rios, celda, grande };   // grande: la forma de lejos (el mapa del rey)
}

// El bosque en un punto del mundo (xm, ym en metros): cuánto de espeso (d, 0–1), qué especie, de qué tamaño (tam,
// 1 = adulto normal) y si es linde (0 dentro del bosque, 1 en campo abierto).
//   - Espesor según el bioma, la lluvia (más ralo donde llueve poco), la pendiente (nada en los cortados) y lo hondo
//     del sitio (más en el fondo de los valles y junto al agua: «humedo», 0–1).
//   - Masas de bosque y claros de cientos de metros, con lindes graduales (unos 60–100 m en los que se aclara y los
//     árboles son más bajos), y fuera del bosque cerrado, árboles en corros, no sueltos al azar.
//   - Especies: 2 o 3 por bioma, en rodales (cada rodal, de unos 120 m, tiene la suya, y en sus bordes se mezclan);
//     las del documento de sistemas: abeto y abedul al norte, roble, haya y fresno en lo templado, pino y encina al sur.
//   - Límite del bosque en la montaña: con el frío se aclara, los árboles se quedan bajos y solo quedan coníferas.
// u: un número al azar (0–1) del árbol, para mezclar las especies en el borde de los rodales.
const BASE_BOSQUE = { taiga: 0.85, caducifolio: 0.9, mixto: 0.75, encinar: 0.6, brezal: 0.35, pradera: 0.35, matorral: 0.3, turbera: 0.25, alpino: 0.3, nieve: 0 };
const ABIERTO = { brezal: 1, pradera: 1, matorral: 1, turbera: 1, alpino: 1 };   // campo abierto: árboles solo en corros y bosquetes
export const MEZCLA_BOSQUE = {
  taiga: [['abeto', 0.6], ['pino', 0.25], ['abedul', 0.15]],
  mixto: [['haya', 0.4], ['abeto', 0.35], ['abedul', 0.25]],
  caducifolio: [['roble', 0.45], ['haya', 0.35], ['fresno', 0.2]],
  encinar: [['encina', 0.65], ['pino', 0.25], ['roble', 0.1]],
  brezal: [['abedul', 0.55], ['pino', 0.45]],
  pradera: [['roble', 0.6], ['fresno', 0.4]],
  matorral: [['encina', 0.7], ['pino', 0.3]],
  turbera: [['abedul', 0.7], ['pino', 0.3]],
  alpino: [['abeto', 0.6], ['pino', 0.4]],
};
const CONIFERA = { abeto: 1, pino: 1 };
const RODAL = 120;
export function bosqueEn(st, pendiente, xm, ym, { humedo = 0, semilla = 0, u = 0.5 } = {}) {
  const nada = { d: 0, especie: null, tam: 1, linde: 1 };
  const base = st && BASE_BOSQUE[st.bioma];
  if (!base) return nada;
  const frio = suave(0.8, 4, st.T);                                    // límite del bosque
  if (frio <= 0) return nada;
  const lluvia = st.P ?? 0.5, seco = 0.45 + 0.55 * suave(0.18, 0.65, lluvia);
  const pend = 1 - suave(0.55, 0.95, pendiente);
  // masas y claros (ruido grande) con lindes anchas; fuera de la masa, corros (ruido de unos 30 m)
  const masa = fbm(xm / 380, ym / 380, 31, 3) * 0.75 + fbm(xm / 150, ym / 150, 33, 2) * 0.25;
  const dentro = suave(0.35, 0.65, masa);
  const corro = suave(0.55, 0.72, fbm(xm / 30, ym / 30, 37, 2));
  const grupo = ABIERTO[st.bioma] ? corro * (0.3 + 0.7 * dentro) : dentro + (1 - dentro) * corro * 0.7;
  const d = Math.min(1, base * frio * seco * pend * (0.04 + 0.96 * grupo) * (1 + humedo * 0.4));
  // tamaño: más bajos en la linde y junto al límite del bosque
  const tam = (0.72 + 0.28 * dentro) * (0.45 + 0.55 * frio);
  // especie: la del rodal más cercano (centros al azar en celdas de RODAL m; el azar u desplaza un poco la distancia
  // para que en los bordes se mezclen)
  const mezcla = MEZCLA_BOSQUE[st.bioma];
  let mejor = Infinity, cual = mezcla[0][0];
  const ci = Math.floor(xm / RODAL), cj = Math.floor(ym / RODAL);
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const r = azarCelda(i, j, 21, semilla);
    const cx = (i + r()) * RODAL, cy = (j + r()) * RODAL;
    const dist = Math.hypot(xm - cx, ym - cy) + (r() * 2 - 1) * (u - 0.5) * 60;
    if (dist < mejor) {
      mejor = dist;
      let q = r(); cual = mezcla[mezcla.length - 1][0];
      for (const [e, w] of mezcla) { if (q < w) { cual = e; break; } q -= w; }
    }
  }
  // cerca del límite del bosque solo aguantan las coníferas
  if (frio < 0.6 && !CONIFERA[cual]) cual = mezcla.find(([e]) => CONIFERA[e])?.[0] ?? (u < 0.6 ? 'abeto' : 'pino');
  return { d, especie: cual, tam, linde: 1 - dentro };
}

// azarCelda (el azar de una celda del mundo para una capa de cosas) está en src/logica/azar.js
export { azarCelda };
