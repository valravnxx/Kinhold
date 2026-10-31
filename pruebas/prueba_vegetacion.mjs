// Comprueba lo que crece en el mundo de verdad (src/logica/vegetacion.js), en node y sin three.js:
//   - siempre en el mismo sitio: dos cuadros que se solapan dan exactamente los mismos árboles, piedras y hierba en lo
//     que comparten (el azar sale de la celda del mundo, no del cuadro), y repetir da lo mismo
//   - nada en el mar, en la orilla ni en los ríos
//   - cada árbol es de una de las especies de su bioma (las de MEZCLA_BOSQUE), y en la isla salen varias especies
//   - la hierba solo dentro de su círculo, y más hierba en los claros que bajo el bosque cerrado
// Uso: node pruebas/prueba_vegetacion.mjs    MUTAR=1 → el segundo cuadro con otra semilla: tiene que fallar.
// MUTAR=2 → dos de los cuatro trozos con otra semilla: tiene que fallar.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje, MEZCLA_BOSQUE, bosqueEn } from '../src/logica/paisaje.js';
import { alturaMundo, SALIDA, SALIDAS } from '../src/logica/whitholm.js';
import { vegetacionEn, vegetacionTrozo, LADO_VEG } from '../src/logica/vegetacion.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const pai = crearPaisaje(mapa), alt = alturaMundo(pai), sem = mapa.semilla;
const cuadro = (x, z, r) => ({ x0: x - r, z0: z - r, x1: x + r, z1: z + r });

// mismo sitio: el cuadro de la salida común y otro movido 130 m, con su parte en común
const X = SALIDA.x, Z = SALIDA.z;
const a = vegetacionEn(pai, alt, sem, cuadro(X, Z, 150), { x: X, z: Z, r: 40 });
const b = vegetacionEn(pai, alt, MUTAR === '1' ? sem + 1 : sem, cuadro(X + 130, Z - 70, 150), { x: X + 20, z: Z, r: 40 });
const a2 = vegetacionEn(pai, alt, sem, cuadro(X, Z, 150), { x: X, z: Z, r: 40 });
const firma = (l) => l.map(e => `${e.x.toFixed(3)},${e.z.toFixed(3)},${e.especie || e.roca || ''},${e.tam.toFixed(3)},${e.giro.toFixed(3)}`).sort().join('|');
const comun = { x0: X - 20, z0: Z - 150, x1: X + 150, z1: Z + 80 };
const en = (l, c) => l.filter(e => e.x >= c.x0 && e.x <= c.x1 && e.z >= c.z0 && e.z <= c.z1);
comprobar('repetir el mismo cuadro da lo mismo', firma(a.arboles) === firma(a2.arboles) && firma(a.hierba) === firma(a2.hierba) && firma(a.piedras) === firma(a2.piedras));
const fa = firma(en(a.arboles, comun)), fb = firma(en(b.arboles, comun));
comprobar('los árboles de la parte en común, iguales en los dos cuadros', fa === fb && fa.length > 0, `${en(a.arboles, comun).length} y ${en(b.arboles, comun).length}`);
comprobar('las piedras de la parte en común, iguales', firma(en(a.piedras, comun)) === firma(en(b.piedras, comun)) && en(a.piedras, comun).length > 0, `${en(a.piedras, comun).length}`);
// la hierba: donde se solapan los dos círculos (a 20 m de distancia entre centros, radio 40)
const enAmbos = (e) => Math.hypot(e.x - X, e.z - Z) < 39 && Math.hypot(e.x - X - 20, e.z - Z) < 39;
comprobar('la hierba de donde se solapan, igual', firma(a.hierba.filter(enAmbos)) === firma(b.hierba.filter(enAmbos)) && a.hierba.filter(enAmbos).length > 0, `${a.hierba.filter(enAmbos).length}`);
comprobar('la hierba, solo dentro de su círculo', a.hierba.every(e => Math.hypot(e.x - X, e.z - Z) <= 40.5));

// por trozos (los que el juego va haciendo alrededor del jugador): cuatro trozos juntos dan lo mismo que su cuadro
{
  const i0 = Math.floor(X / LADO_VEG), j0 = Math.floor(Z / LADO_VEG), L = LADO_VEG;
  const c = { x0: i0 * L, z0: j0 * L, x1: (i0 + 2) * L, z1: (j0 + 2) * L };
  const g = vegetacionEn(pai, alt, sem, c, c), suyo = (e) => e.x >= c.x0 && e.x < c.x1 && e.z >= c.z0 && e.z < c.z1;
  const t = { arboles: [], piedras: [], hierba: [], flores: [], matas: [] };
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const v = vegetacionTrozo(pai, alt, MUTAR === '2' && di ? sem + 1 : sem, i0 + di, j0 + dj, true);
    for (const k of Object.keys(t)) t[k].push(...v[k]);
  }
  const igual = Object.keys(t).every(k => firma(g[k].filter(suyo)) === firma(t[k]));
  comprobar('cuatro trozos juntos dan lo mismo que su cuadro (árboles, piedras, hierba, flores y matas), sin repetir nada', igual && t.hierba.length > 0,
    Object.keys(t).map(k => `${k} ${t[k].length}/${g[k].filter(suyo).length}`).join(', '));
}

// por la isla: en varios sitios de salida y alrededor
let enAgua = 0, malEspecie = 0, total = 0;
const especies = new Set();
let hClaro = 0, nClaro = 0, hBosque = 0, nBosque = 0;
for (const [x, z] of SALIDAS.filter((_, i) => i % 13 === 0)) {
  const v = vegetacionEn(pai, alt, sem, cuadro(x, z, 120), { x, z, r: 30 });
  const tramos = pai.riosEn(x - 120, z - 120, x + 120, z + 120);
  for (const e of [...v.arboles, ...v.hierba, ...v.piedras, ...v.matas]) {
    if (alt(e.x, e.z) < 0.3 || pai.agua(e.x, e.z, tramos) !== null) enAgua++;
  }
  for (const e of v.arboles) {
    total++; especies.add(e.especie);
    const st = pai.sitio(e.x, e.z, alt(e.x, e.z));
    if (!MEZCLA_BOSQUE[st.bioma].some(([n]) => n === e.especie) && !['abeto', 'pino'].includes(e.especie)) malEspecie++;
  }
  // hierba en celdas de 10 m: los claros (bosque ralo) frente al bosque cerrado
  for (let j = -3; j < 3; j++) for (let i = -3; i < 3; i++) {
    const cx = x + i * 10 + 5, cz = z + j * 10 + 5, y = alt(cx, cz); if (y < 1) continue;
    const st = pai.sitio(cx, cz, y), d = bosqueEn(st, 0, cx, cz, { semilla: sem }).d;
    const n = v.hierba.filter(e => Math.abs(e.x - cx) < 5 && Math.abs(e.z - cz) < 5).length;
    if (d < 0.2) { hClaro += n; nClaro++; } else if (d > 0.6) { hBosque += n; nBosque++; }
  }
}
comprobar('nada en el mar, en la orilla ni en los ríos', enAgua === 0, `${enAgua} cosas en el agua`);
comprobar('cada árbol es de una especie de su bioma (o una conífera en el límite del bosque)', malEspecie === 0 && total > 500, `${total} árboles, ${malEspecie} fuera de su bioma`);
comprobar('en la isla salen varias especies', especies.size >= 4, [...especies].join(', '));
comprobar('más hierba en los claros que bajo el bosque cerrado', nClaro > 0 && nBosque > 0 && hClaro / nClaro > hBosque / nBosque, `${(hClaro / Math.max(1, nClaro)).toFixed(1)} frente a ${(hBosque / Math.max(1, nBosque)).toFixed(1)} matas por 100 m²`);

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
