// Los ríos llegan al mar (src/logica/paisaje.js: rioCercano cerca de la costa y el cauce mar adentro en altura).
// Ejecutar: node pruebas/prueba_desembocadura.mjs
// valravnx, 5 nov: «los ríos no finalizan en la entrada al mar, ni hay deltas». Antes el cauce, estrecho, se quedaba en
// la playa: la arena (o la orilla) cerraba la boca por encima del agua, y el agua del río acababa antes del mar. Comprueba,
// en las bocas de los ríos de Whitholm que desembocan en el mar (por el eje del último tramo, donde cruza la orilla y
// con tierra detrás): el agua del río llega a la orilla (a 30 m y a 5 m de ella hay agua de río), a la altura del mar
// (como mucho 0,3 m por encima), con el cauce bajo el agua; el cauce sigue en el mar (a 5 y a 30 m de la orilla, el fondo
// a más de 0,3 m: ninguna barra de arena cerrando la boca); y la boca se ensancha (estuario: en la orilla, más del doble
// de ancho que a 1,5 km río arriba); y en las bocas de los ríos grandes, un delta (isletas de arena que asoman del agua).
// Y lo primero (valravnx, 6 nov: «NO LLEGAN AL MAR… ningún río conecta con el océano»): en TODOS los ríos que acaban en
// el mar (no solo en las bocas que se dejan medir por el eje recto), agua seguida por el cauce desde 2,5 km río arriba
// hasta el mar: antes, en 8 de 27, el río del mapa acababa aún en tierra y el agua, en una charca.
// Con MUTAR=1 vuelve la boca de antes y con MUTAR=2, el río que acaba donde acaba el del mapa: deben FALLAR.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA, alturaMundo } from '../src/logica/whitholm.js';

if (process.env.MUTAR === '1') globalThis.__bocaVieja = true;
if (process.env.MUTAR === '2') globalThis.__sinLlegarMar = true;
if (process.env.MUTAR === '3') globalThis.__embudoViejo = true;
if (process.env.MUTAR === '4') globalThis.__mezclaVieja = true;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const P = crearPaisaje(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }));

// el agua seguida hasta el mar, por el cauce (con su meandro: en cada punto del eje del mapa, cada 3 m, se busca a lo
// ancho el centro del cauce), con la altura del juego (la de los trozos)
{
  const alt = alturaMundo(P);
  let n = 0, llegan = 0, sinHueco = 0; const malos = [];
  for (const r of P.rios) {
    if (r.entra || r.une || r.length < 3) continue;
    const L = r.length - 1, bx = r[L].p[0] * 1000, by = r[L].p[1] * 1000;
    if (bx < ISLA.x0 - 3000 || bx > ISLA.x1 + 3000 || by < ISLA.z0 - 3000 || by > ISLA.z1 + 3000) continue;
    const pts = []; let d = 0;
    for (let k = L; k > 0 && d < 2500; k--) {
      const a = r[k].p, b = r[k - 1].p, l = Math.hypot(a[0] - b[0], a[1] - b[1]) * 1000;
      for (let s = 0; s < l; s += 3) pts.push([(a[0] + (b[0] - a[0]) * s / l) * 1000, (a[1] + (b[1] - a[1]) * s / l) * 1000]);
      d += l;
    }
    if (P.grande(...pts[pts.length - 1]).f < 0) continue;            // (todo en el mar)
    const tr = P.riosEn(bx - 3000, by - 3000, bx + 3000, by + 3000, 600);
    let hueco = 0, peor = 0, mar = false;
    for (const [x, y] of pts) {
      let cx = x, cy = y;
      for (let it = 0; it < 3; it++) {
        let m = P.rioCerca(cx, cy, tr).dm, mx = cx, my = cy;
        for (let a = 0; a < 16; a++) for (const rr of [4, 12, 30]) { const qx = cx + Math.cos(a * Math.PI / 8) * rr, qy = cy + Math.sin(a * Math.PI / 8) * rr, q = P.rioCerca(qx, qy, tr).dm; if (q < m) { m = q; mx = qx; my = qy; } }
        cx = mx; cy = my;
      }
      const z = alt(cx, cy), w = P.agua(cx, cy, tr);
      if (P.grande(cx, cy).f < 0 && z < -0.3) mar = true;
      if ((w !== null && w > z + 0.1) || (w === null && z < -0.2)) hueco = 0; else { hueco += 3; peor = Math.max(peor, hueco); }
    }
    n++; if (mar) llegan++; if (peor <= 9) sinHueco++;
    if (!mar || peor > 9) malos.push(`(${bx.toFixed(0)}, ${by.toFixed(0)})${mar ? '' : ' no llega'}${peor > 9 ? ` seco ${peor} m` : ''}`);
  }
  console.log(`${n} ríos que acaban en el mar${malos.length ? ': mal ' + malos.join(', ') : ''}`);
  comprobar('todos los ríos que acaban en el mar llegan al mar por su cauce', n >= 20 && llegan === n, `${llegan} de ${n}`);
  comprobar('con agua seguida, sin tramos secos (más de 9 m) en los últimos 2,5 km', n >= 20 && sinHueco === n, `${sinHueco} de ${n}`);
}
const bocas = [];
for (const r of P.rios) {
  if (r.entra || r.une || r.length < 3) continue;
  const L = r.length - 1, bx = r[L].p[0] * 1000, by = r[L].p[1] * 1000;
  if (bx < ISLA.x0 || bx > ISLA.x1 || by < ISLA.z0 || by > ISLA.z1) continue;
  // el tramo del río del mapa donde cruza la orilla (el primero, río abajo, que acaba en el mar)
  let k = 1; while (k < L && P.grande(r[k].p[0] * 1000, r[k].p[1] * 1000).f >= 0) k++;
  const ax = r[k - 1].p[0] * 1000, ay = r[k - 1].p[1] * 1000, cx = r[k].p[0] * 1000, cy = r[k].p[1] * 1000;
  if (P.grande(ax, ay).f < 0) continue;
  const largo = Math.hypot(cx - ax, cy - ay), ux = (cx - ax) / largo, uy = (cy - ay) / largo;
  let s0 = null;
  for (let s = 0; s <= largo; s += 2) if (P.grande(ax + ux * s, ay + uy * s).f < 0) { s0 = s; break; }
  if (s0 === null || s0 < 40) continue;                             // (con tierra detrás de la orilla, por el eje)
  const en = (d) => [ax + ux * (s0 + d), ay + uy * (s0 + d)];
  const tr = P.riosEn(ax - 50, ay - 50, ax + 50, ay + 50, 2000);
  const c = P.rioCerca(...en(-5), tr);
  if (c.dm > c.ancho / 2 - 1) continue;                             // (el eje recto se sale del cauce: no vale para medir)
  bocas.push({ en, tr, rio: r, k: k - 1 });
}
console.log(`${bocas.length} bocas que medir`);
comprobar('hay bocas que medir', bocas.length >= 5);
let llega = 0, nivel = 0, cauce = 0, sigue = 0, ancha = 0;
for (const { en, tr, rio, k } of bocas) {
  const w30 = P.agua(...en(-30), tr), w5 = P.agua(...en(-5), tr), z5 = P.altura(...en(-5), tr);
  if (w30 !== null && w5 !== null) llega++;
  if (w5 !== null && w5 <= 0.3) nivel++;
  if (w5 !== null && z5 < w5 - 0.2) cauce++;
  if (P.altura(...en(5), tr) < -0.3 && P.altura(...en(30), tr) < -0.3) sigue++;
  // a 1,5 km río arriba (por el río del mapa)
  let q = k, d = 0; while (q > 0 && d < 1500) { d += Math.hypot(rio[q].p[0] - rio[q - 1].p[0], rio[q].p[1] - rio[q - 1].p[1]) * 1000; q--; }
  const ux0 = rio[q].p[0] * 1000, uy0 = rio[q].p[1] * 1000, trA = P.riosEn(ux0 - 50, uy0 - 50, ux0 + 50, uy0 + 50, 2000);
  if (P.rioCerca(...en(-2), tr).ancho > 2 * P.rioCerca(ux0, uy0, trA).ancho) ancha++;
}
// el delta: en las bocas de los ríos grandes, isletas de arena que asoman del agua en los últimos cientos de metros
let grandes = 0, conIslas = 0;
for (const { en, tr } of bocas) {
  const [x0, y0] = en(-1), [x1, y1] = en(-301), ux = (x0 - x1) / 300, uy = (y0 - y1) / 300;
  if (P.rioCerca(x1, y1, tr).anchoRio < 14) continue;   // (14 m de cauce sin el estuario: un río de los medianos para arriba, los que llevan delta)
  grandes++;
  let islas = 0;
  for (let a = 0; a <= 300; a += 4) for (let b = -100; b <= 100; b += 4) { const px = x1 + ux * a - uy * b, py = y1 + uy * a + ux * b, w = P.agua(px, py, tr); if (w !== null && P.altura(px, py, tr) > w + 0.1) islas++; }
  if (islas >= 20) conIslas++;
}
comprobar('en las bocas de los ríos medianos y grandes, un delta (isletas que asoman del agua)', grandes > 0 && conIslas >= Math.ceil(grandes * 0.6), `${conIslas} de ${grandes} bocas`);
const casi = (n) => n >= Math.ceil(bocas.length * 0.8);
// El embudo y las aguas que se funden (valravnx, 6 nov: «acaba como con dos tonos de río diferentes… que fuera
// difuminando las aguas y que la desembocadura se ensanche y se vea más real»). El embudo: en la orilla, el cauce es al
// menos el del río más 30 m (y más de dos veces y media el del río, sin pasar de cuatro veces más 40 m: no un lago), y
// se abre cada vez más deprisa hacia el mar (a 140 m de la orilla, menos de la mitad de lo que se abre en ella). Las aguas: a lo largo de la boca, de 300 m río arriba a 300 m
// mar adentro, cuánto de mar tiene el agua va de río (menos de 0,35 en el primer punto con agua del eje, que en un
// meandro puede quedar ya cerca de la orilla) a mar (más de 0,75) sin saltos (menos de 0,08 en 3 m).
let embudo = 0, funde = 0, peorSalto = 0;
for (const { en, tr } of bocas) {
  const o = P.rioCerca(...en(-2), tr), m = P.rioCerca(...en(-142), tr);
  const abre0 = o.ancho - o.anchoRio, abre230 = m.ancho - m.anchoRio;
  if (o.ancho >= o.anchoRio + 29 && o.ancho >= o.anchoRio * 2.5 && o.ancho <= o.anchoRio * 4 + 40 && abre230 < abre0 * 0.5) embudo++;
  let antes = null, salto = 0, ini = null, fin = null;
  for (let d = -300; d <= 300; d += 3) {
    // (solo en el agua: donde el eje recto del mapa se sale del cauce por un meandro, la orilla seca no cuenta)
    const q = en(d), w = P.agua(...q, tr), z = P.altura(...q, tr);
    if (!((w !== null && w > z + 0.05) || (w === null && z < 0))) { antes = null; continue; }
    const v = P.mezclaMar(...q, tr);
    if (antes !== null) salto = Math.max(salto, Math.abs(v - antes));
    if (ini === null) ini = v; fin = v; antes = v;
  }
  peorSalto = Math.max(peorSalto, salto);
  if (ini < 0.35 && fin > 0.75 && salto < 0.08) funde++;
}
comprobar('la boca se abre en embudo (en la orilla, el río más 30 m y más de dos veces y media, sin ser un lago; a 140 m, menos de la mitad)', casi(embudo), `${embudo} de ${bocas.length}`);
comprobar('el agua del río se funde con la del mar, sin saltos de tono', casi(funde), `${funde} de ${bocas.length} (el peor salto en 3 m: ${peorSalto.toFixed(2)})`);
comprobar('el agua del río llega a la orilla', casi(llega), `${llega} de ${bocas.length}`);
comprobar('a la altura del mar (como mucho 0,3 m por encima)', casi(nivel), `${nivel} de ${bocas.length}`);
comprobar('con el cauce bajo el agua (no la arena)', casi(cauce), `${cauce} de ${bocas.length}`);
comprobar('el cauce sigue en el mar (sin barra que cierre la boca)', casi(sigue), `${sigue} de ${bocas.length}`);
comprobar('la boca se ensancha (estuario)', casi(ancha), `${ancha} de ${bocas.length}`);
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
