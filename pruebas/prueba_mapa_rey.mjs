// Comprueba el mapa del rey en node, sin página ni three.js (src/juego/mapa_rey_pintar.js), con el mundo elegido:
//   - la costa del mapa es la del juego (paisaje.grande): en puntos al azar, tierra en el mapa ⇔ tierra al andar
//   - cada comarca tiene su nombre, dentro de ella y lejos de su frontera; el de Strandvang, lejos de la ciudad
//   - la ciudad del rey cae en tierra de Strandvang
//   - los ríos son los del juego y acaban en el mar o en otro río (no en mitad de la tierra a lo tonto); ningún árbol ni
//     monte en el mar, y ningún árbol pegado a la ciudad
//   - se pinta a pasos cortos: con 4 filas por paso, el 99 % de los pasos por debajo de 25 ms y ninguno de más de 80 ms
//     (sin contar el primero, en el que el motor de JavaScript compila el código; medido en node)
// Uso: node pruebas/prueba_mapa_rey.mjs        MUTAR=1 → los nombres cambiados de comarca: tiene que fallar.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { crearComarcas } from '../src/logica/comarcas.js';
import { CIUDAD_REY } from '../src/logica/whitholm.js';
import { pintarMapaRey, COMARCA_REY } from '../src/juego/mapa_rey_pintar.js';
import { hash2 } from '../src/logica/azar.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const pai = crearPaisaje(mapa), C = crearComarcas(mapa);
const g = pintarMapaRey(pai, C, { filas: 4 });
let r, t0 = performance.now(); const pasos = [];
do { const a = performance.now(); r = g.next(); pasos.push(performance.now() - a); } while (!r.done);
const resto = pasos.slice(1).sort((a, b) => a - b), max = resto[resto.length - 1], p99 = resto[Math.floor(resto.length * 0.99)];
const d = r.value;
console.log(`  (${d.ancho} × ${d.alto} px, ${Math.round(performance.now() - t0)} ms en total, ${d.rios.length} ríos, ${d.montes.length} montes, ${d.arboles.length} árboles)`);
comprobar('se pinta a pasos cortos (el 99 % en menos de 25 ms, ninguno de más de 80)', p99 <= 25 && max <= 80, `${pasos.length} pasos; 99 %: ${p99.toFixed(1)} ms; el más largo: ${max.toFixed(1)} ms`);
if (MUTAR === '1') d.etiquetas.forEach(e => { e.k = (e.k + 1) % 8; });

const px = (x, y) => { const a = Math.floor((x - d.cuadro.x0) * d.pxKm), b = Math.floor((y - d.cuadro.y0) * d.pxKm); return a < 0 || b < 0 || a >= d.ancho || b >= d.alto ? -1 : b * d.ancho + a; };
// la costa: 3.000 puntos al azar del cuadro
let malos = 0, n = 0;
for (let k = 0; k < 3000; k++) {
  const x = d.cuadro.x0 + hash2(k, 1, 5) * (d.cuadro.x1 - d.cuadro.x0), y = d.cuadro.y0 + hash2(k, 2, 5) * (d.cuadro.y1 - d.cuadro.y0);
  const i = px(x, y); if (i < 0) continue; n++;
  const cx = d.cuadro.x0 + (i % d.ancho + 0.5) / d.pxKm, cy = d.cuadro.y0 + (((i / d.ancho) | 0) + 0.5) / d.pxKm;
  if ((pai.grande(cx * 1000, cy * 1000).f >= 0) !== (d.tierra[i] === 1)) malos++;
}
comprobar('la costa del mapa es la del juego', malos === 0, `${malos} de ${n} puntos no casan`);
// los nombres
comprobar('las 8 comarcas tienen su nombre', d.etiquetas.length === 8 && new Set(d.etiquetas.map(e => e.k)).size === 8);
const mal = d.etiquetas.filter(e => C.zonaEn(e.x * 1000, e.y * 1000).comarca !== e.k).map(e => C.nombres[e.k]);
comprobar('cada nombre está dentro de su comarca', mal.length === 0, mal.join(', '));
const ciu = [CIUDAD_REY.x / 1000, CIUDAD_REY.z / 1000], es = d.etiquetas.find(e => e.k === COMARCA_REY);
comprobar('el nombre de Strandvang no tapa la ciudad (a más de 3 km)', es && Math.hypot(es.x - ciu[0], es.y - ciu[1]) > 3, es ? `${Math.hypot(es.x - ciu[0], es.y - ciu[1]).toFixed(1)} km` : '');
const ic = px(ciu[0], ciu[1]);
comprobar('la ciudad del rey cae en tierra de Strandvang', ic >= 0 && d.tierra[ic] === 1 && d.comarca[ic] === COMARCA_REY);
// los ríos: los del juego, y cada uno acaba en el mar o en otro río
const fin = (rr) => rr[rr.length - 1];
let sueltos = 0;
for (const rr of d.rios) {
  const [x, y] = fin(rr), i = px(x, y);
  if (i < 0 || !d.tierra[i]) continue;   // en el mar
  const otro = d.rios.some(o => o !== rr && o.some(q => Math.hypot(q[0] - x, q[1] - y) < 0.8));
  if (!otro) sueltos++;
}
comprobar('hay ríos y son los del juego', d.rios.length >= 10 && d.rios.length <= pai.rios.length, `${d.rios.length} de ${pai.rios.length}`);
comprobar('los ríos acaban en el mar o en otro río', sueltos === 0, `${sueltos} sueltos`);
const enMar = (x, y) => { const i = px(x, y); return i < 0 || !d.tierra[i]; };
comprobar('ningún árbol ni monte en el mar', !d.arboles.some(a => enMar(a[0], a[1])) && !d.montes.some(a => enMar(a[0], a[1])));
comprobar('ningún árbol pegado a la ciudad (1,6 km)', !d.arboles.some(a => Math.hypot(a[0] - ciu[0], a[1] - ciu[1]) < 1.6));
comprobar('hay montes y bosques dibujados', d.montes.length >= 20 && d.arboles.length >= 200, `${d.montes.length} montes, ${d.arboles.length} árboles`);

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
