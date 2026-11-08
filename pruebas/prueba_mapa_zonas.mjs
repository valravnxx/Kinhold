// Pruebas de las zonas en el mapa del rey (src/juego/mapa_zonas.js): los lindes sacados de muestras y tu tierra, la
// zona entera de tu mojón (valravnx, 4 nov). Ejecutar: node pruebas/prueba_mapa_zonas.mjs
// Y las zonas tomadas por los demás mojones (valravnx, 8 nov), cada dueño de un color.
// Con MUTAR=1 tu tierra se busca demasiado cerca del mojón (se queda cortada): debe FALLAR. Con MUTAR=2, todos los
// dueños del mismo color: también.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearComarcas, zonasDeEscena } from '../src/logica/comarcas.js';
import { SALIDA, SALIDAS } from '../src/logica/whitholm.js';
import * as Z from '../src/juego/mapa_zonas.js';

let bien = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) bien++; else mal++;
  console.log(`  ${cond ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

console.log('Los lindes de una rejilla de etiquetas (cuadrados que marchan)');
{
  // 3 × 3 casillas: la columna de la izquierda es de la zona 1, el resto de la 2; abajo a la derecha, mar (-1)
  const et = Int32Array.from([1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, -1, 1, 2, -1, -1]);
  const s = Z.lindes(et, 3, 0, 0, 1);
  const xs = new Set(); for (let k = 0; k < s.length; k += 2) xs.add(s[k]);
  comprobar('entre la zona 1 y la 2, una línea recta a medio camino (x = 0,5) de arriba abajo', s.length === 12 && [...xs].every(x => x === 0.5), JSON.stringify(Array.from(s)));
  comprobar('y con el mar sin zona no se traza nada', Z.lindes(Int32Array.from([2, -1, 2, -1]), 1, 0, 0, 1).length === 0);
  comprobar('donde no cambia, nada', Z.lindes(new Int32Array(16).fill(7), 3, 0, 0, 1).length === 0);
}

console.log('Con el mundo de verdad');
const t0 = Date.now();
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const comarcas = crearComarcas(mapa);
console.log(`  (mapa y comarcas en ${Date.now() - t0} ms)`);
const zonas = Z.crearZonasMapa(comarcas);
{
  // la tesela de la salida
  const tx = Math.floor(SALIDA.x / 1000 / Z.TESELA), tz = Math.floor(SALIDA.z / 1000 / Z.TESELA);
  comprobar('una tesela que aún no está se pide', zonas.tesela(tx, tz) === null && zonas.pendientes === 1);
  const a = performance.now(); zonas.paso(1); const ms = performance.now() - a;
  const s = zonas.tesela(tx, tz);
  comprobar('y a pasos se hace', !!s && zonas.pendientes === 0, `${ms.toFixed(0)} ms`);
  comprobar(`una tesela de ${Z.TESELA} km lleva lindes (las zonas miden aproximadamente 1 km)`, s && s.length / 4 > 100, `${s && s.length / 4} segmentos`);
  // cada segmento está entre dos zonas distintas: sus dos lados, a medio paso, son de zonas distintas
  let buenos = 0, vistos = 0;
  for (let k = 0; k < s.length && vistos < 200; k += 4 * 7) {
    vistos++;
    const mx = (s[k] + s[k + 2]) / 2 * 1000, mz = (s[k + 1] + s[k + 3]) / 2 * 1000, dx = s[k + 2] - s[k], dz = s[k + 3] - s[k + 1], l = Math.hypot(dx, dz);
    const nx = -dz / l * Z.PASO * 0.75, nz = dx / l * Z.PASO * 0.75;
    if (zonas.etiqueta(mx + nx, mz + nz) !== zonas.etiqueta(mx - nx, mz - nz)) buenos++;
  }
  comprobar('casi todos los lindes separan dos zonas (a un paso a cada lado)', buenos >= vistos * 0.85, `${buenos} de ${vistos}`);
  // con lo que es tierra puesto (la imagen del mapa), los lindes no van por el agua
  const soloOeste = Z.crearZonasMapa(comarcas); soloOeste.ponerTierra((x) => x < tx * Z.TESELA + Z.TESELA / 2);
  soloOeste.tesela(tx, tz); soloOeste.paso(50);
  const so = soloOeste.tesela(tx, tz);
  let fuera = 0; for (let k = 0; k < so.length; k += 4) if ((so[k] + so[k + 2]) / 2 > tx * Z.TESELA + Z.TESELA / 2 + Z.PASO / 1000) fuera++;
  comprobar('con lo que es tierra puesto, los lindes no van por el agua', so.length > 0 && so.length < s.length && fuera === 0, `${so.length / 4} de ${s.length / 4}, ${fuera} en el agua`);
  const v = zonas.visibles(SALIDA.x / 1000 - 10, SALIDA.z / 1000 - 6, SALIDA.x / 1000 + 10, SALIDA.z / 1000 + 6);
  comprobar('lo que se ve: las que ya hay y las que faltan, en cola', v.hay.length === 1 && v.faltan > 10 && zonas.pendientes === v.faltan, `${v.hay.length} hay, ${v.faltan} faltan`);
}
{
  // tu tierra, en cada sitio de salida (un mojón en cada uno)
  const radio = process.env.MUTAR === '1' ? 400 : Z.RADIO_TIERRA;
  let enteras = 0, conMojon = 0, areas = [];
  const zonaEscena = zonasDeEscena(comarcas, { x: 0, z: 0 });
  for (const [x, z] of SALIDAS.slice(0, 12)) {
    const z2 = Z.crearZonasMapa(comarcas);
    const t = z2.tierra(x, z, radio);
    if (!t) continue;
    const { n, mascara, h } = t;
    let borde = false, cuantas = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (mascara[j * n + i]) { cuantas++; if (i === 0 || j === 0 || i === n - 1 || j === n - 1) borde = true; }
    if (!borde) enteras++;
    areas.push(cuantas * h * h);
    const i = Math.floor((x / 1000 - t.x0) / h + 0.5), j = Math.floor((z / 1000 - t.z0) / h + 0.5);
    if (mascara[j * n + i] && t.zona === zonaEscena(x, z)) conMojon++;
  }
  const total = Math.min(12, SALIDAS.length);
  comprobar('tu tierra sale entera (no toca el borde de lo que se mira)', enteras === total, `${enteras} de ${total}`);
  comprobar('y en ella está tu mojón (la misma zona que la del juego)', conMojon === total, `${conMojon} de ${total}`);
  const media = areas.reduce((a, b) => a + b, 0) / areas.length;
  comprobar('una zona mide aproximadamente 1,2 km² (entre 0,5 y 2,5)', areas.every(a => a > 0.5 && a < 2.5) && media > 0.8 && media < 1.8, areas.map(a => a.toFixed(2)).join(' '));
  const z3 = Z.crearZonasMapa(comarcas), a1 = z3.tierra(SALIDA.x, SALIDA.z), a2 = z3.tierra(SALIDA.x + 1, SALIDA.z);
  comprobar('mientras no cambies de zona, se hace una vez', a1 === a2);
  comprobar('en alta mar no hay tierra', z3.tierra(-50000, -50000) === null);
}

console.log('Las zonas tomadas por los demás mojones, cada dueño de su color (valravnx, 8 nov)');
{
  const z4 = Z.crearZonasMapa(comarcas);
  const [a, b, c] = SALIDAS.slice(0, 3);
  const lista = [{ x: a[0], z: a[1], dueno: 'ana' }, { x: b[0], z: b[1], dueno: 'beto', invita: true }, { x: c[0], z: c[1], dueno: 'yo', tuya: true }, { x: a[0] + 1, z: a[1], dueno: 'ana' }];
  const t = z4.tomadas(lista);
  comprobar('cada mojón da su zona entera, con su dueño y si te invita', t.length === 4 && t[0].dueno === 'ana' && !t[0].invita && t[1].invita && t[2].tuya && t[0].zona === z4.etiqueta(a[0], a[1]), t.map(o => `${o.dueno}:${o.zona}`).join(' '));
  comprobar('la máscara de una zona se hace una vez (dos mojones en la misma zona, la misma)', t[0].mascara === t[3].mascara);
  comprobar('en alta mar, nada', z4.tomadas([{ x: -50000, z: -50000, dueno: 'nadie' }]).length === 0);
  const duenos = ['ana', 'beto', 'carla', 'dani', 'eva', 'fede', 'gala', 'hugo'];
  let col = Z.coloresDeDuenos(duenos);
  if (process.env.MUTAR === '2') col = new Map(duenos.map(d => [d, Z.COLORES_TIERRAS[0]]));
  comprobar('ocho dueños, ocho colores distintos', new Set([...col.values()].map(c => c.join())).size === 8);
  const otra = Z.coloresDeDuenos([...duenos].reverse());
  comprobar('el mismo color para cada dueño, se mire como se mire (no depende del orden)', duenos.every(d => otra.get(d) === col.get(d)) || process.env.MUTAR === '2');
  const rojo = Z.ROJO_TIERRA, lejos = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  comprobar('ninguno se confunde con el rojo de tu tierra ni con el oro del rey', Z.COLORES_TIERRAS.every(c => lejos(c, rojo) > 80 && lejos(c, [190, 140, 40]) > 60));
  comprobar('con más dueños que colores, cada uno tiene uno', Z.coloresDeDuenos([...duenos, 'iris', 'juan']).size === 10);
}

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
