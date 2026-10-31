// Kinhold — Whitholm, la isla de los playtests (valravnx, 29 oct): el juego, de momento, solo en la isla norte de
// Kinland. Aquí, en lógica pura (sin three.js, para que la use también el servidor): hasta dónde llega la isla y el sitio
// de salida.
//
//  - SALIDA: el sitio común, el 0 de las posiciones en línea (presencia y mundo del servidor) y el de quien ya jugaba
//    antes de la salida al azar (lo construido en su navegador está ahí).
//  - SALIDAS: dónde aparece cada jugador nuevo (valravnx, 30 oct): un sitio al azar de las tres comarcas de inicio
//    (Motdale, Breiddal y Strandvang), en biomas normales (nunca en la montaña, el pasto alpino ni la nieve), llano y lejos
//    de los ríos.
//
// Lo que se calcula con el mapa (limitesIsla, buscarSalida, buscarSalidas) es caro: generar el mundo tarda unos segundos.
// Por eso el resultado para el mundo elegido va también apuntado en ISLA, SALIDA y SALIDAS, que el servidor usa sin
// generar nada; la prueba (pruebas/prueba_whitholm.mjs) genera el mapa y comprueba que siguen siendo los mismos.
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

// ---------------- Salida al azar (valravnx, 30 oct) ----------------
// Las comarcas donde aparecen los jugadores nuevos (las de vega y pradera, elegidas por el chat el 30 oct) y los biomas
// en los que no (la montaña: el pasto alpino y la roca con nieve).
export const COMARCAS_INICIO = ['Motdale', 'Breiddal', 'Strandvang'];
export const BIOMAS_FUERA = ['alpino', 'nieve'];
export const PASO_SALIDAS = 1000;   // m entre los puntos que se prueban (una rejilla sobre el cuadro de la isla)

// Busca los sitios de salida al azar: los puntos de la rejilla (cada PASO_SALIDAS m) que caen en una comarca de inicio,
// fuera de los biomas de montaña y que valen como sitio de salida (esSalida). `comarcas`: la de src/logica/comarcas.js.
// Devuelve [[x, z], …] (m del mundo, enteros), por filas de norte a sur.
export function buscarSalidas(mapa, paisaje, comarcas, paso = PASO_SALIDAS) {
  const alt = alturaMundo(paisaje), lista = [];
  for (let z = ISLA.z0; z < ISLA.z1; z += paso) for (let x = ISLA.x0; x < ISLA.x1; x += paso) {
    if (!COMARCAS_INICIO.includes(comarcas.nombreEn(x, z))) continue;
    if (!esSalida(mapa, paisaje, alt, x, z)) continue;
    const b = paisaje.sitio(x, z, alt(x, z)).bioma;
    if (!b || BIOMAS_FUERA.includes(b)) continue;
    lista.push([x, z]);
  }
  return lista;
}

// Los sitios de salida al azar del mundo elegido (los que da buscarSalidas; la prueba comprueba que siguen siendo esos)
export const SALIDAS = [
  [216000, 31000], [217000, 32000], [216000, 33000], [217000, 33000], [216000, 34000], [217000, 34000], [215000, 35000], [216000, 35000],
  [217000, 35000], [218000, 35000], [215000, 36000], [218000, 36000], [217000, 37000], [218000, 37000], [219000, 37000], [216000, 38000],
  [218000, 38000], [219000, 38000], [219000, 39000], [218000, 41000], [219000, 42000], [219000, 45000], [215000, 46000], [219000, 46000],
  [214000, 47000], [215000, 47000], [217000, 47000], [209000, 48000], [212000, 48000], [214000, 48000], [215000, 48000], [219000, 48000],
  [210000, 49000], [211000, 49000], [217000, 49000], [218000, 49000], [204000, 50000], [211000, 50000], [217000, 50000], [203000, 51000],
  [210000, 51000], [212000, 51000], [213000, 51000], [214000, 51000], [217000, 51000], [207000, 52000], [210000, 52000], [215000, 52000],
  [217000, 52000], [199000, 53000], [201000, 53000], [204000, 53000], [208000, 53000], [211000, 53000], [212000, 53000], [214000, 53000],
  [215000, 53000], [197000, 54000], [199000, 54000], [201000, 54000], [203000, 54000], [207000, 54000], [209000, 54000], [214000, 54000],
  [215000, 54000], [196000, 55000], [197000, 55000], [198000, 55000], [199000, 55000], [200000, 55000], [202000, 55000], [204000, 55000],
  [205000, 55000], [207000, 55000], [208000, 55000], [209000, 55000], [210000, 55000], [211000, 55000], [212000, 55000], [213000, 55000],
  [200000, 56000], [203000, 56000], [207000, 56000], [208000, 56000], [209000, 56000], [211000, 56000], [196000, 57000], [197000, 57000],
  [198000, 57000], [200000, 57000], [201000, 57000], [203000, 57000], [204000, 57000], [205000, 57000], [207000, 57000], [208000, 57000],
  [209000, 57000], [210000, 57000], [211000, 57000], [212000, 57000], [196000, 58000], [197000, 58000], [202000, 58000], [205000, 58000],
  [207000, 58000], [209000, 58000], [210000, 58000], [193000, 59000], [194000, 59000], [196000, 59000], [198000, 59000], [199000, 59000],
  [200000, 59000], [202000, 59000], [204000, 59000], [205000, 59000], [206000, 59000], [207000, 59000], [209000, 59000], [210000, 59000],
  [192000, 60000], [193000, 60000], [194000, 60000], [196000, 60000], [198000, 60000], [199000, 60000], [201000, 60000], [203000, 60000],
  [204000, 60000], [205000, 60000], [193000, 61000], [194000, 61000], [196000, 61000], [198000, 61000], [199000, 61000], [200000, 61000],
  [201000, 61000], [205000, 61000], [206000, 61000], [189000, 62000], [193000, 62000], [194000, 62000], [195000, 62000], [197000, 62000],
  [200000, 62000], [201000, 62000], [203000, 62000], [205000, 62000], [190000, 63000], [192000, 63000], [194000, 63000], [195000, 63000],
  [196000, 63000], [198000, 63000], [199000, 63000], [200000, 63000], [202000, 63000], [203000, 63000], [204000, 63000], [190000, 64000],
  [191000, 64000], [192000, 64000], [193000, 64000], [195000, 64000], [203000, 64000], [204000, 64000], [192000, 65000], [193000, 65000],
  [196000, 65000], [201000, 65000], [202000, 65000], [203000, 65000], [204000, 65000], [190000, 66000], [193000, 66000], [194000, 66000],
  [195000, 66000], [189000, 67000], [190000, 67000], [193000, 67000], [194000, 67000], [195000, 67000], [196000, 67000], [201000, 67000],
  [202000, 67000], [203000, 67000], [189000, 68000], [191000, 68000], [192000, 68000], [201000, 68000], [202000, 68000], [203000, 68000],
  [191000, 69000], [192000, 69000], [193000, 69000], [194000, 69000], [195000, 69000], [196000, 69000], [198000, 69000], [201000, 69000],
  [191000, 70000], [194000, 70000], [196000, 70000], [197000, 70000], [200000, 70000], [189000, 71000], [190000, 71000], [191000, 71000],
  [192000, 71000], [193000, 71000], [194000, 71000], [195000, 71000], [196000, 71000], [197000, 71000], [195000, 72000], [197000, 72000],
  [200000, 72000], [188000, 73000], [190000, 73000], [191000, 73000], [192000, 73000], [195000, 73000], [189000, 74000], [191000, 74000],
  [195000, 74000], [196000, 74000], [199000, 74000], [190000, 75000], [191000, 75000], [192000, 75000], [194000, 75000], [195000, 75000],
  [196000, 75000], [197000, 75000], [198000, 75000], [199000, 75000], [193000, 76000], [195000, 76000], [196000, 76000], [197000, 76000],
  [198000, 76000], [199000, 76000], [190000, 77000], [193000, 77000], [194000, 77000], [195000, 77000], [196000, 77000], [198000, 77000],
  [191000, 79000], [192000, 79000], [193000, 79000], [194000, 79000], [195000, 79000], [196000, 79000], [191000, 80000], [192000, 80000],
  [193000, 80000], [195000, 80000], [192000, 81000], [194000, 81000]
];

// Elige el sitio de un jugador nuevo: uno de SALIDAS al azar. `azar`: un número de 0 a 1 (Math.random, o uno fijo en
// las pruebas). Devuelve { x, z }.
export function elegirSalida(azar = Math.random()) {
  const k = Math.min(SALIDAS.length - 1, Math.max(0, Math.floor(azar * SALIDAS.length)));
  return { x: SALIDAS[k][0], z: SALIDAS[k][1] };
}

// ¿Es (x, z) uno de los sitios de salida conocidos (SALIDA o uno de SALIDAS)? Para no fiarse de lo guardado en el navegador.
export const esSitioDeSalida = (x, z) => (x === SALIDA.x && z === SALIDA.z) || SALIDAS.some(s => s[0] === x && s[1] === z);

// ---------------- La ciudad del rey (valravnx, 31 oct) ----------------
// Whitholm es la isla del rey y Strandvang (la comarca E) su dominio; ahí está la única ciudad NPC. Dónde exactamente,
// decisión provisional del 31 oct (hasta el boceto de la ciudad, en el hito Mundo): junto a la desembocadura del río
// principal de Strandvang (su boca, en el mar, en 217767, 53292), en el primer llano de pradera río arriba, fuera del
// cauce y algo por encima del mar. Sale de buscarCiudad con CIUDAD_REQ; la prueba comprueba que sigue valiendo.
export const CIUDAD_REY = { x: 217558, z: 52730 };
export const CIUDAD_REQ = { alturaMin: 3, alturaMax: 60, radio: 60, desnivel: 3, rio: 80 };
export const BOCA_STRANDVANG = { x: 217767, z: 53292 };

// Busca el sitio de la ciudad: en corros desde la boca del río, el primer punto de Strandvang que cumple CIUDAD_REQ.
export function buscarCiudad(mapa, paisaje, comarcas, boca = BOCA_STRANDVANG, req = CIUDAD_REQ) {
  const alt = alturaMundo(paisaje);
  for (let r = 200; r < 4000; r += 50) {
    const n = Math.max(8, Math.round(2 * Math.PI * r / 50));
    for (let k = 0; k < n; k++) {
      const x = Math.round(boca.x + Math.cos(k / n * 2 * Math.PI) * r), z = Math.round(boca.z + Math.sin(k / n * 2 * Math.PI) * r);
      if (comarcas.nombreEn(x, z) !== 'Strandvang' || !esSalida(mapa, paisaje, alt, x, z, req)) continue;
      return { x, z, y: alt(x, z) };
    }
  }
  return null;
}
