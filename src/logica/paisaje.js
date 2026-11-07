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
import { fbm, clasificarBioma, riosDelMapa, anchoCauce, ARROYO_HASTA, GRANDE_DESDE } from './mapa.js';
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
  // Hasta el mar (valravnx, 6 nov: «NO LLEGAN AL MAR… ningún río conecta con el océano»). El río del mapa acaba en el
  // centro de la primera celda de mar (de 1 km), pero la costa de cerca no coincide con la de las celdas: en 8 de las 27
  // bocas de Whitholm ese punto queda aún en tierra (hasta 440 m de la orilla) y el río acababa en una charca. Ahora,
  // si el final del río no está ya mar adentro, sigue cuesta abajo de la forma (hacia el mar más cercano), en pasos de
  // 120 m, hasta 150 m dentro del mar.
  if (!globalThis.__sinLlegarMar) for (const r of rios) {
    if (r.entra || r.length < 2) continue;
    let q = r[r.length - 1], dx = q.p[0] - r[r.length - 2].p[0], dy = q.p[1] - r[r.length - 2].p[1];
    let l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    for (let paso = 0; paso < 40; paso++) {
      const x = q.p[0] * 1000, y = q.p[1] * 1000, f = grande(x, y).f;
      if (f < -0.6) {                                       // (ya en el mar: 150 m más y basta)
        let fin = true;
        for (let s = 30; s <= 150; s += 30) if (grande(x + dx * s, y + dy * s).f >= 0) fin = false;
        if (fin) break;
      }
      const gx = grande(x + 20, y).f - grande(x - 20, y).f, gy = grande(x, y + 20).f - grande(x, y - 20).f, gl = Math.hypot(gx, gy);
      if (gl > 1e-6) { dx = 0.4 * dx - 0.6 * gx / gl; dy = 0.4 * dy - 0.6 * gy / gl; l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
      q = { p: [q.p[0] + dx * 0.12, q.p[1] + dy * 0.12], a: q.a, h: q.h };
      r.push(q);
    }
  }
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
  // Las uniones (valravnx, 5 nov): el afluente acaba en el cauce del río que lo recibe (src/logica/mapa.js, unirRios) y
  // su agua llega a la altura de ese río ahí (si no, quedaba un escalón de agua en la unión). Si el río que lo recibe va
  // más alto que el afluente justo antes, es el río el que baja ahí (y desde ahí, río abajo): el agua nunca sube. Unas
  // vueltas, por los afluentes de afluentes.
  for (let vuelta = 0; vuelta < 4; vuelta++) for (const r of rios) {
    if (!r.une || r.length < 2) continue;
    const L = r.length - 1, o = r.uneRio, nivel = Math.min(r[L - 1].h, r.une.h);
    r[L].h = nivel;
    if (o && r.une.h > nivel) { r.une.h = nivel; for (let k = o.indexOf(r.une) + 1; k > 0 && k < o.length; k++) o[k].h = Math.min(o[k].h, o[k - 1].h); }
  }
  // y lo que lleva recorrido cada punto desde donde nace el río (m): el río nace estrecho y se ensancha (NACE)
  for (const r of rios) { let d = 0; for (let k = 0; k < r.length; k++) { if (k) d += Math.hypot(r[k].p[0] - r[k - 1].p[0], r[k].p[1] - r[k - 1].p[1]) * 1000; r[k].d = d; } }

  // los tramos de río que pasan cerca de una zona (para no recorrerlos todos en cada punto)
  function riosEn(x0, y0, x1, y1, margen = 600) {
    const tramos = [];
    for (const r of rios) for (let k = 0; k < r.length - 1; k++) {
      const a = r[k], b = r[k + 1], ax = a.p[0] * 1000, ay = a.p[1] * 1000, bx = b.p[0] * 1000, by = b.p[1] * 1000;
      if (Math.max(ax, bx) < x0 - margen || Math.min(ax, bx) > x1 + margen || Math.max(ay, by) < y0 - margen || Math.min(ay, by) > y1 + margen) continue;
      // el ancho, en cada punta del tramo (va cambiando a lo largo, sin escalones entre tramos)
      const anchoA = anchoDe(a), anchoB = anchoDe(b);
      const t = { ax, ay, bx, by, ha: a.h, hb: b.h, ga: a.g, gb: b.g, anchoA, anchoB, ancho: Math.max(anchoA, anchoB), fuente: k === 0 };
      t.largo = Math.hypot(bx - ax, by - ay) || 1;
      t.salto = saltoDe(t);
      t.hondoA = hondoDe(ax, ay, anchoA); t.hondoB = hondoDe(bx, by, anchoB);
      t.vado = vadoDe(t); t.meandro = meandroDe(t);
      tramos.push(t);
    }
    return tramos;
  }
  // El ancho del cauce en un punto del río (m): el del juego (anchoCauce, el doble que el del mapa), y donde nace, más
  // estrecho, hasta el ancho entero a NACE m (valravnx, 5 nov: antes el río salía de golpe con todo su ancho)
  const NACE = 900;
  function anchoDe(q) { return Math.max(2, anchoCauce(q.a) * (0.35 + 0.65 * suave(0, NACE, q.d ?? NACE))); }
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
    return ancho < ARROYO_HASTA ? 0.3 + 0.3 * h : ancho < GRANDE_DESDE ? 1.5 + 1.0 * h : 2.8 + 1.5 * h;
  }
  // Vado: en uno de cada ocho tramos de río mediano (sin salto de agua), un trecho de 20 m más el ancho del río en el
  // que el agua cubre unos 0,7 m y se cruza andando (unos 2 km entre vado y vado)
  function vadoDe(t) {
    if (t.salto || t.ancho < ARROYO_HASTA || t.ancho >= GRANDE_DESDE) return null;
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
  // (arriba y abajo: la altura del agua de verdad a cada lado, con lo que el suelo recorta por arriba (lechoDe); si así
  // el salto se queda en menos de 3,5 m, no es un salto de agua sino una bajada del cauce)
  function saltosEn(tramos) {
    const aguaEn = (t, u) => { const nivel = nivelTramo(t, u); return lechoDe(nivel, nivel - lerp(t.ha, t.hb, u), lerp(t.ga ?? Infinity, t.gb ?? Infinity, u)) + 1.2; };
    return tramos.filter(t => t.salto).map(t => {
      const u = t.salto.u, x = lerp(t.ax, t.bx, u), y = lerp(t.ay, t.by, u), w = Math.min(0.2, 3 / t.largo);
      return { x, y, arriba: aguaEn(t, u - w), abajo: aguaEn(t, u + w), dx: (t.bx - t.ax) / t.largo, dy: (t.by - t.ay) / t.largo, ancho: t.ancho };
    }).filter(sa => sa.arriba - sa.abajo >= 3.5);
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
    if (f < 0) {                                           // mar: el fondo, según la costa (fondoMar)
      const fondo = fondoMar(xm, ym, f);
      if (!tramos || globalThis.__bocaVieja) return fondo;
      // y el cauce del río que desemboca sigue mar adentro (hasta que el fondo del mar va más hondo que él)
      const R = rioCercano(xm, ym, tramos), borde = R.ancho / 2 + 1.5;
      if (R.dm >= borde + 30) return fondo;
      const fr = R.dm / borde, forma = fr < 0.7 ? 0.25 * Math.pow(fr / 0.7, 3) : 0.25 + 0.75 * suave(0.7, 1, fr);
      const cauce = Math.min(R.lecho + 0.2 - R.hondo, -R.hondo);
      const perfil = R.dm < borde ? lerp(cauce, Math.min(0, fondo), forma) : lerp(Math.min(0, fondo), fondo, suave(borde, borde + 30, R.dm));
      return Math.min(fondo, perfil);
    }
    const { dm, nivel, ancho, anchoRio, salto, lecho, lechoValle, hondo, cabeza, costa } = rioCercano(xm, ym, tramos);
    const monte = suave(120, 600, r);                      // 0 en el llano, 1 en la montaña
    // junto al río, el detalle se apaga: el fondo del valle lo marca el río (que ya talló el valle grande del mapa),
    // no el ruido; si no, el ruido levanta el fondo decenas de metros y el río queda en una zanja
    const calma = dm === Infinity ? 1 : 0.12 + 0.88 * suave(anchoRio / 2, anchoRio / 2 + (180 + anchoRio * 12) * (1 - 0.45 * monte), dm);   // (sin el estuario)
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
    // La playa (valravnx, 5 nov): antes, junto al mar, la tierra baja quedaba a ras del agua (f · 0,5, con un tope de
    // 0,4 m) en una franja de cientos de metros, casi al nivel del mar: un llano enorme que se pintaba como fondo. Ahora
    // sube desde la orilla por la distancia a ella (m): un 3 % la arena (1,2 m a 40 m) y luego un 2 %.
    if (f < 3) {
      const rampa = rampaPlaya(xm, ym, f);
      if (hm < 8) z = lerp(rampa, z, suave(0, 2.5, f));    // costa baja: la playa baja suave hasta el agua
      z = Math.max(Math.min(rampa, 0.4 + f), z);
    }
    // (en tierra, nunca por debajo del mar). Tierra adentro (valravnx, 7 nov: «hay tramos que no aparece vegetacion ni
    // nada en la estepa… a momentos aparece un manto azul»): lo que quedaba por debajo del mar se ponía a 0,4 m justos,
    // y salían llanos de kilómetros del todo planos a ras del mar, donde no crece nada (la hierba pide 1 m; los árboles,
    // 1,5) y que de lejos perdían contra el mar de lejos. Ahora, pasada la costa, el suelo no baja de unos 2 m y lo que
    // iba a quedar más hondo sube como un relieve suave (cada metro de hoyo, un cuarto de metro de loma), sin pliegue.
    if (f >= 3 && !globalThis.__llanosViejos) {
      const piso = 0.4 + 1.6 * suave(3, 12, f), d = z - piso;
      if (d < 6) { const g = 0.375 * d + 0.625 * Math.sqrt(d * d + 1); z = piso + lerp(g, d, suave(3, 6, d)); }
    }
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
      const cauce = lecho, orilla = Math.max(cauce, lechoValle) + 0.8, borde = ancho / 2 + 1.5;   // (en la boca, el cauce baja al mar pero la orilla y la vega se quedan donde estaban)
      const vega = (anchoRio * 2.5 + 25) * (1 - 0.8 * monte);   // (con el ancho del río sin el estuario: la vega no crece en la boca)
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
      // (valravnx, 5 nov: el cauce era una rampa en V de hierba) un fondo casi llano y la orilla marcada: hasta el 70 %
      // del medio ancho el fondo sube poco (un cuarto de lo que hay hasta la orilla); de ahí, la orilla sube de golpe
      const f = dm / borde, forma = f < 0.7 ? 0.25 * Math.pow(f / 0.7, 3) : 0.25 + 0.75 * suave(0.7, 1, f);
      const perfil = dm < borde ? lerp(cauce + 0.2 - hondo, orilla, forma) : valle;
      const tallado = fuera > vega && !valleLiso ? sminimo(z, perfil, Math.max(0.01, Math.min(24, (fuera - vega) * ladera * 0.4))) : Math.min(z, perfil);   // (junto a la vega, sin redondeo: no baja del suelo del valle)
      z = lerp(perfil, tallado, suave(vega * 0.6, vega + 40, fuera));
      // el delta de los ríos medianos y grandes (desde 14 m de cauce): en los últimos 600 m, dentro del estuario, isletas
      // de arena que asoman medio metro del agua y reparten el río en brazos (manchas de unos 45 m, ni en el eje ni pegadas a la orilla)
      if (costa < 600 && anchoRio >= 14 && dm < borde) {
        const e = dm / borde, t = suave(0.5, 0.72, fbm(xm / 45, ym / 45, S + 171, 3)) * suave(0.12, 0.25, e) * (1 - suave(0.8, 0.95, e)) * (1 - suave(350, 600, costa));
        if (t > 0) z = Math.max(z, lerp(z, lecho + 0.7, t));
      }
    }
    return z;
  }

  // la subida de la playa desde la orilla (m sobre el mar), con la distancia a la línea de costa
  function rampaPlaya(xm, ym, f) {
    const g1 = grande(xm + 4, ym).f, g2 = grande(xm, ym + 4).f, grad = Math.max(0.002, Math.hypot(g1 - f, g2 - f) / 4);
    const d = f / grad;
    return d < 40 ? 0.03 * d : 1.2 + 0.02 * (d - 40);
  }

  // El fondo del mar (valravnx, 5 nov: «tienes una distancia gigantesca en la cual el agua no cubre… El mar tendría que
  // no cubrir un poquito, pero luego ya hundirse… sobre todo en zonas de acantilado»). Antes era f · 1,6 (la forma del
  // mapa, que cambia por kilómetros): a 100 m de la orilla, 0,8 m; a 400 m, de 1 a 3 m, también al pie de los
  // acantilados. Ahora sale de la distancia a la línea de costa (d, en m) y de lo alta que es la tierra de detrás:
  //   - playa (tierra baja): una franja somera (1,2 m a 25 m de la orilla, la arena a la vista), luego un escalón hasta
  //     unos 8 m a 70 m (el «se hunde») y de ahí bajando poco a poco;
  //   - acantilado (tierra alta): unos 3 m a pocos metros del pie y un 30 % de pendiente (18 m a 50 m).
  // Hasta 60 m.
  function fondoMar(xm, ym, f) {
    if (globalThis.__marViejo) return Math.max(-60, f * 1.6);   // (la prueba vuelve al de antes a propósito, para ver que falla)
    const g1 = grande(xm + 4, ym).f, g2 = grande(xm, ym + 4).f, gx = (g1 - f) / 4, gy = (g2 - f) / 4;
    const grad = Math.max(0.002, Math.hypot(gx, gy));      // (con un mínimo: donde la forma es casi llana, d no se dispara)
    // la distancia: de cerca, con la pendiente de la forma aquí (exacta en los primeros cientos de metros); más lejos,
    // con una pendiente fija (la forma cambia unos 0,005 por metro junto a la costa): así el fondo, mar adentro, baja
    // siempre y no hace olas al cambiar la pendiente de la forma
    const dCerca = -f / grad, dLejos = -f / 0.005, d = lerp(dCerca, dLejos, suave(80, 250, Math.min(dCerca, dLejos))), ux = gx / grad, uy = gy / grad;
    // lo alto de la tierra de detrás de la orilla (la del mapa, 150 m hacia tierra desde aquí: un sitio que se mueve
    // suave con el punto; si dependiera de la distancia a la orilla, saltaba de playa a acantilado entre vecinos)
    // (la del mapa más su relieve de detalle: la del mapa sola, por celdas de 1 km, junto a la costa sale baja)
    const tx = xm + ux * 150, ty = ym + uy * 150, G = grande(tx, ty), tierra = G.hm + detalle(tx, ty, G.r);
    const alto = suave(5, 14, tierra);
    const playa = (d < 25 ? 0.05 * d : 1.25 + 6.75 * suave(25, 70, d) + 0.04 * Math.max(0, d - 70)) + (fbm(xm / 40, ym / 40, S + 161, 2) - 0.5) * 1.2 * suave(5, 30, d);
    const acant = (3 + 0.3 * d) * suave(0, 6, d);   // (sin escalón en la misma orilla)
    // mar adentro (de 120 a 300 m de la orilla) se olvida el tipo de costa: el mismo fondo para todas, que baja siempre
    const lejos = 10 + 0.035 * d;
    return Math.max(-60, -lerp(lerp(playa, acant, alto), lejos, suave(120, 300, d)));
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
      if (dd < dm) { dm = dd; nivel = nivelTramo(t, u); salto = nivel - lerp(t.ha, t.hb, u); ancho = lerp(t.anchoA, t.anchoB, u); tramo = t; uu = u; suelo = lerp(t.ga ?? Infinity, t.gb ?? Infinity, u); cabeza = t.fuente ? Math.max(0, -u0 * t.largo) : 0; }
    }
    // La desembocadura (valravnx, 5 nov: «los ríos no finalizan en la entrada al mar»). El río del mapa acaba en el
    // centro de la primera celda de mar (a cientos de metros de la orilla) y su nivel bajaba en línea recta hasta allí:
    // en la orilla el agua iba aún metros por encima del mar y se cortaba en seco, con la arena de la playa cerrando
    // el cauce. Ahora, cerca de la costa, el río baja hasta el nivel del mar en la misma orilla (como mucho un 0,25 %
    // de pendiente en los últimos metros), se ensancha en un estuario (hasta 3,5 veces su ancho en la boca, en los
    // últimos 600 m) y su cauce sigue mar adentro hasta que el fondo del mar es más hondo que él.
    let costa = Infinity, anchoRio = ancho;
    const lechoValle = lechoDe(nivel, salto, suelo);   // (el del río sin bajar al mar: la vega y las laderas no cambian, solo el cauce)
    if (tramo && dm < 2500 && !globalThis.__bocaVieja) {   // (la prueba lo quita a propósito, para ver que falla)
      costa = distCosta(xm, ym);
      if (costa < 2000) {
        // (solo donde el río ya va cerca del nivel del mar: el que llega por encima de un acantilado no se toca, y se
        // apaga del todo a 2 km de la orilla, sin saltos)
        const alMar = 1 + 0.0025 * costa, aNivel = 1 - suave(1, 4, nivel - alMar), w = aNivel * (1 - suave(300, 700, costa));
        if (nivel > alMar && w > 0) { nivel = lerp(nivel, alMar, w); if (w > 0.5) salto = 0; }
        anchoRio = ancho;
        if (globalThis.__embudoViejo) ancho *= 1 + 2.5 * (1 - suave(0, 600, costa));
        else {
          // el embudo (valravnx, 6 nov: «que la desembocadura se ensanche y se vea más real»): como en los estuarios de
          // verdad, el ancho crece hacia el mar cada vez más deprisa (exponencial, unos 140 m de largo de convergencia),
          // hasta el ancho del río más dos veces él (y al menos 30 m) en la orilla. Solo en el río que llega al nivel
          // del mar (el que cae por un acantilado no se abre). (Con tres veces y 230 m, la boca era un lago)
          const boca = Math.max(ancho * 2, 30) * aNivel;
          ancho += boca * Math.exp(-costa / 140);
        }
      }
    }
    return { dm, nivel, ancho, anchoRio, tramo, u: uu, salto, cabeza, costa, lechoValle, lecho: lechoDe(nivel, salto, suelo), hondo: tramo ? hondoTramo(tramo, uu) : 1.2 };   // salto: lo que el salto de agua sube o baja el cauce aquí
  }
  // lo lejos que está un punto de la orilla del mar, tierra adentro (m; 0 en el mar; Infinity si lejos, a más de unos
  // 1,6 km), con la pendiente de la forma (como el cortado de la costa)
  function distCosta(xm, ym) {
    const f = grande(xm, ym).f;
    if (f <= 0) return 0;
    if (f >= 8) return Infinity;
    const g1 = grande(xm + 4, ym).f, g2 = grande(xm, ym + 4).f, grad = Math.max(0.002, Math.hypot(g1 - f, g2 - f) / 4);
    // (cerca del límite de la forma la distancia se estira hasta el infinito: sin salto en f = 8)
    return f / grad / Math.max(1e-6, 1 - suave(5, 7.9, f));
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
    // costa: m hasta la orilla del mar (solo en lo bajo, donde puede haber playa: valravnx, 6 nov, la arena salía en
    // todo lo que queda a menos de 2,8 m sobre el mar, también en las vegas de los ríos, kilómetros tierra adentro)
    return { roca: roca[ci] || 'caliza', bioma: bioma[ci] || z > 0.3 ? b : null, T, P, pais: pais[ci], costa: z < 3 ? distCosta(xm, ym) : Infinity };   // tierra aunque la celda del mapa sea de mar (la costa de cerca no coincide al metro)
  }

  // lo hondo del agua en un punto (m: lo que hay de la superficie al suelo), o null si no hay agua de río ni mar
  function hondura(xm, ym, tramos, fino = false) {
    const z = altura(xm, ym, tramos, fino);
    if (grande(xm, ym).f < 0 || z < 0) return Math.max(0, -z);            // el mar (su superficie, a 0 m)
    const w = agua(xm, ym, tramos);
    return w === null ? null : Math.max(0, w - z);
  }
  // lo lejos que está un punto del eje del río más cercano (m) y el ancho de ese río (para las riberas)
  // Cuánto de mar tiene el agua en un punto (0: agua de río; 1: mar), para que el agua del río se funda con la del mar
  // (valravnx, 6 nov: «acaba como con dos tonos de río diferentes… que fuera difuminando las aguas»): el río se va
  // pareciendo al mar en sus últimos 250 m (hasta 0,6 en la orilla) y, en el mar, su agua sigue mar adentro en un
  // abanico que se abre y se apaga en unos 150 m (la mancha del río en el mar)
  function mezclaMar(xm, ym, tramos) {
    const G = grande(xm, ym), f = G.f;
    const { dm, ancho, costa } = rioCercano(xm, ym, tramos);
    if (globalThis.__mezclaVieja) return f > 0 && dm <= ancho / 2 + 3 ? 0 : 1;   // (la prueba vuelve a las dos aguas de antes, para ver que falla)
    if (dm === Infinity) return f > 0 ? 0 : 1;
    // a lo ancho: el agua del río (en su cauce) y, fuera, la del mar; mar adentro el abanico se abre (y se apaga)
    let lejos = 0;
    if (f < 0) { const g1 = grande(xm + 4, ym).f, g2 = grande(xm, ym + 4).f, grad = Math.max(0.002, Math.hypot(g1 - f, g2 - f) / 4); lejos = -f / grad; }
    const lado = 1 - suave(ancho / 2, ancho / 2 + 15 + lejos * 0.6, dm);
    const rio = f > 0 ? 0.6 * (1 - suave(0, 250, costa)) : 1 - 0.4 * (1 - suave(0, 150, lejos));
    return lerp(1, rio, lado);
  }
  function rioCerca(xm, ym, tramos) { const { dm, ancho, anchoRio, costa } = rioCercano(xm, ym, tramos); return { dm, ancho, anchoRio, costa }; }   // (anchoRio: sin el estuario; costa: m hasta la orilla del mar)
  // el centro del cauce de un tramo en u (0–1, de la fuente a la boca), con su meandro (m del mundo)
  function centroCauce(t, u) {
    const vx = t.bx - t.ax, vy = t.by - t.ay, d = desvio(t, u) / t.largo;
    return [t.ax + vx * u - vy * d, t.ay + vy * u + vx * d];
  }
  return { altura, agua, hondura, corriente, saltosEn, vadosEn, sitio, riosEn, rioCerca, rios, celda, grande, centroCauce, mezclaMar };   // grande: la forma de lejos (el mapa del rey)
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
