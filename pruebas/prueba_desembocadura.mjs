// Los ríos llegan al mar (src/logica/paisaje.js: rioCercano cerca de la costa y el cauce mar adentro en altura).
// Ejecutar: node pruebas/prueba_desembocadura.mjs
// valravnx, 5 nov: «los ríos no finalizan en la entrada al mar, ni hay deltas». Antes el cauce, estrecho, se quedaba en
// la playa: la arena (o la orilla) cerraba la boca por encima del agua, y el agua del río acababa antes del mar. Comprueba,
// en las bocas de los ríos de Whitholm que desembocan en el mar (por el eje del último tramo, donde cruza la orilla y
// con tierra detrás): el agua del río llega a la orilla (a 30 m y a 5 m de ella hay agua de río), a la altura del mar
// (como mucho 0,3 m por encima), con el cauce bajo el agua; el cauce sigue en el mar (a 5 y a 30 m de la orilla, el fondo
// a más de 0,3 m: ninguna barra de arena cerrando la boca); y la boca se ensancha (estuario: en la orilla, más del doble
// de ancho que a 1,5 km río arriba); y en las bocas de los ríos grandes, un delta (isletas de arena que asoman del agua).
// Con MUTAR=1 vuelve la boca de antes: debe FALLAR.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA } from '../src/logica/whitholm.js';

if (process.env.MUTAR === '1') globalThis.__bocaVieja = true;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const P = crearPaisaje(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }));
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
  if (P.rioCerca(x1, y1, tr).ancho < 40) continue;   // (40 m de cauce a 300 m de la orilla, con su estuario: un río de los medianos para arriba)
  grandes++;
  let islas = 0;
  for (let a = 0; a <= 300; a += 4) for (let b = -100; b <= 100; b += 4) { const px = x1 + ux * a - uy * b, py = y1 + uy * a + ux * b, w = P.agua(px, py, tr); if (w !== null && P.altura(px, py, tr) > w + 0.1) islas++; }
  if (islas >= 20) conIslas++;
}
comprobar('en las bocas de los ríos medianos y grandes, un delta (isletas que asoman del agua)', grandes > 0 && conIslas >= Math.ceil(grandes * 0.6), `${conIslas} de ${grandes} bocas`);
const casi = (n) => n >= Math.ceil(bocas.length * 0.8);
comprobar('el agua del río llega a la orilla', casi(llega), `${llega} de ${bocas.length}`);
comprobar('a la altura del mar (como mucho 0,3 m por encima)', casi(nivel), `${nivel} de ${bocas.length}`);
comprobar('con el cauce bajo el agua (no la arena)', casi(cauce), `${cauce} de ${bocas.length}`);
comprobar('el cauce sigue en el mar (sin barra que cierre la boca)', casi(sigue), `${sigue} de ${bocas.length}`);
comprobar('la boca se ensancha (estuario)', casi(ancha), `${ancha} de ${bocas.length}`);
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
