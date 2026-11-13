// Comprueba dónde sale lo que se recoge en el mundo de verdad (src/logica/recogida_mundo.js), en node y sin three.js:
//   - cada tipo sale solo en las zonas del documento de sistemas (ramas en el bosque, piedra en laderas y ríos, sílex
//     en la caliza y los ríos, fibra en claros y riberas), y de verdad en ese sitio (el bosque es denso, la roca es
//     caliza, la ladera empinada, el río cerca)
//   - nada en el mar, en el agua ni en la nieve, ni encima del sitio de un árbol
//   - siempre lo mismo: repetir da lo mismo, y cuatro trozos juntos dan lo mismo que su cuadro; el nombre, por su sitio
//   - alrededor de cada sitio de salida hay de todo lo que se necesita para empezar, y en la isla salen los cinco tipos
//   - lo recogido de un punto que se va (su trozo queda lejos) se guarda y vuelve con él
// Uso: node pruebas/prueba_recogida_mundo.mjs    MUTAR=2 → como si no hubiera col ni nabo silvestres (tiene que fallar)
//      MUTAR=1 → los puntos, con las zonas del llano (por distancia al centro,
// como antes): tiene que fallar.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje, bosqueEn } from '../src/logica/paisaje.js';
import { alturaMundo, SALIDA, SALIDAS, ISLA } from '../src/logica/whitholm.js';
import { recogidaEn, recogidaTrozo, zonasRecogida, idPunto, LADO_RECOGIDA, DENSIDAD_RECOGIDA, SUELTOS_CLARO } from '../src/logica/recogida_mundo.js';
import { RECOLECTABLES, Recoleccion } from '../src/logica/recoleccion.js';
import { CELDA } from '../src/logica/vegetacion.js';
import { azarCelda } from '../src/logica/azar.js';
import { Inventarios } from '../src/logica/inventario.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const pai = crearPaisaje(mapa), alt = alturaMundo(pai), sem = mapa.semilla;
const cuadro = (x, z, r) => ({ x0: x - r, z0: z - r, x1: x + r, z1: z + r });
// MUTAR=1: las zonas de antes (las del llano de la demo, por distancia a la salida), sin mirar el terreno
const puntosDe = MUTAR === '1'
  ? (c) => recogidaEn(pai, alt, sem, c).map((p, k) => { const d = Math.hypot(p.x - SALIDA.x, p.z - SALIDA.z); return { ...p, tipo: d < 25 ? 'ortiga' : d < 62 ? 'ramas' : ['piedra', 'silex'][k % 2] }; })
  : (c) => recogidaEn(pai, alt, sem, c);

// 1) muestra de la isla: 150 cuadros de 64 m repartidos, más los de alrededor de las salidas
const muestras = [];
for (let k = 0; k < 150; k++) muestras.push([ISLA.x0 + ((k * 7919) % 997) / 997 * (ISLA.x1 - ISLA.x0), ISLA.z0 + ((k * 104729) % 991) / 991 * (ISLA.z1 - ISLA.z0)]);
const todos = [];
for (const [x, z] of muestras) todos.push(...puntosDe({ x0: x, z0: z, x1: x + 64, z1: z + 64 }));
const cuenta = {}; for (const p of todos) cuenta[p.tipo] = (cuenta[p.tipo] || 0) + 1;
console.log('  en la muestra de la isla:', JSON.stringify(cuenta));
// (los juncos, el barro, las mimbreras y (P11) la col y el nabo silvestres solo salen en la orilla y la ribera: se miran junto a un río, en el 4)
const DE_ORILLA = ['juncos', 'barro', 'mimbre', 'col_silvestre', 'nabo_silvestre'];
comprobar('en la isla salen todos los tipos (menos los de la orilla y el matorral, que sale de la vegetación)', Object.keys(RECOLECTABLES).every(t => DE_ORILLA.includes(t) || !RECOLECTABLES[t].donde.length || cuenta[t] > 0), JSON.stringify(cuenta));

// 2) cada punto, en su sitio (se vuelve a mirar el terreno, sin fiarse de las zonas que trae)
const malos = { zona: [], agua: [], arbol: [], nombre: [] };
for (const p of todos) {
  const tramos = pai.riosEn(p.x - 50, p.z - 50, p.x + 50, p.z + 50);
  const y = alt(p.x, p.z), w = pai.agua(p.x, p.z, tramos), st = pai.sitio(p.x, p.z, y);
  if (y < 0.5 || (w !== null && y < w + 0.15) || !st || st.bioma === 'nieve') { malos.agua.push(p.id); continue; }
  const s = Math.hypot(alt(p.x + 3, p.z) - alt(p.x - 3, p.z), alt(p.x, p.z + 3) - alt(p.x, p.z - 3)) / 6;
  const { dm, ancho } = pai.rioCerca(p.x, p.z, tramos), orilla = dm - ancho / 2;
  const { d } = bosqueEn(st, s, p.x, p.z, { semilla: sem });
  const de = { bosque: d > 0.08, claro: d < 0.12 && s < 0.45, ladera: s > 0.2, caliza: st.roca === 'caliza', rio: orilla < 4, ribera: orilla < 16 };
  if (!RECOLECTABLES[p.tipo].donde.some(zona => de[zona])) malos.zona.push(`${p.id} (${Object.keys(de).filter(k => de[k]).join('+') || 'ninguna'})`);
  if (p.id !== idPunto(p.tipo, p.x, p.z)) malos.nombre.push(p.id);
  // el sitio posible de un árbol, a menos de 1,2 m
  const A = CELDA.arbol;
  for (let j = Math.floor(p.z / A) - 1; j <= Math.floor(p.z / A) + 1; j++) for (let i = Math.floor(p.x / A) - 1; i <= Math.floor(p.x / A) + 1; i++) {
    const r = azarCelda(i, j, 1, sem), ax = i * A + (r() - 0.5) * 4, az = j * A + (r() - 0.5) * 4;
    if (Math.hypot(ax - p.x, az - p.z) < 1.2) malos.arbol.push(p.id);
  }
}
comprobar(`cada punto sale en una zona suya del documento (${todos.length} puntos)`, todos.length > 300 && !malos.zona.length, malos.zona.slice(0, 4).join(', '));
comprobar('nada en el mar, en el agua ni en la nieve', !malos.agua.length, malos.agua.slice(0, 4).join(', '));
comprobar('nada encima del sitio de un árbol', !malos.arbol.length, malos.arbol.slice(0, 4).join(', '));
comprobar('el nombre de cada punto sale de su tipo y su sitio', !malos.nombre.length, malos.nombre.slice(0, 3).join(', '));
comprobar('las densidades solo usan zonas del documento', Object.entries(DENSIDAD_RECOGIDA).every(([t, z]) => Object.keys(z).every(w => RECOLECTABLES[t].donde.includes(w))));

// 3) las ramas, más en el bosque denso; el sílex, en la caliza o junto al río
{
  const ramas = todos.filter(p => p.tipo === 'ramas'), silex = todos.filter(p => p.tipo === 'silex');
  comprobar('las ramas, todas en el bosque', ramas.length > 0 && ramas.every(p => p.zonas.includes('bosque')), `${ramas.length}`);
  comprobar('el sílex, en la caliza o junto al río (o algo en el claro)', silex.length > 0 && silex.every(p => p.zonas.includes('caliza') || p.zonas.includes('rio') || p.zonas.includes('claro')), `${silex.length}`);
  // piedra y sílex sueltos en la pradera abierta (valravnx, 1 nov: «dentro del realismo, accesibilidad»): algo en el
  // claro, pero menos que donde les toca
  const soloClaro = (t) => todos.filter(p => p.tipo === t && !RECOLECTABLES[t].donde.filter(w => w !== 'claro').some(w => p.zonas.includes(w))).length;
  comprobar('en el claro sale algo de piedra y de sílex sueltos', soloClaro('piedra') > 0 && soloClaro('silex') > 0, `piedra ${soloClaro('piedra')}, sílex ${soloClaro('silex')}`);
  comprobar('menos que donde les toca (la densidad del claro, por debajo de la de cada zona suya)',
    Object.entries(SUELTOS_CLARO).every(([t, q]) => Object.values(DENSIDAD_RECOGIDA[t]).every(v => q < v)), JSON.stringify(SUELTOS_CLARO));
  // y en una pradera abierta (claro sin bosque ni río) de verdad: en cada sitio de la salida al azar, en 120 m
  let conPiedra = 0;
  for (const [x, z] of SALIDAS) if (puntosDe(cuadro(x, z, 120)).some(p => p.tipo === 'piedra')) conPiedra++;
  comprobar('alrededor de casi todos los sitios de la salida al azar hay piedra a menos de 120 m', conPiedra >= SALIDAS.length * 0.9, `${conPiedra} de ${SALIDAS.length}`);
}

// 4) a lo largo de un río de la isla: la piedra y el sílex de la orilla
{
  const r = pai.rios.find(r => r.length > 10 && r.every(q => q.p[0] * 1000 > ISLA.x0 && q.p[0] * 1000 < ISLA.x1 && q.p[1] * 1000 > ISLA.z0 && q.p[1] * 1000 < ISLA.z1));
  const cr = {};
  if (r) for (let k = 2; k < r.length - 1; k += Math.max(1, Math.floor(r.length / 12))) {
    const x = r[k].p[0] * 1000, z = r[k].p[1] * 1000;
    for (const q of puntosDe(cuadro(x, z, 40))) if (q.zonas.includes('rio') || q.zonas.includes('ribera')) cr[q.tipo] = (cr[q.tipo] || 0) + 1;
  }
  console.log('  junto a un río:', JSON.stringify(cr));
  comprobar('junto a los ríos sale piedra, sílex y fibra', cr.piedra > 0 && cr.silex > 0 && (cr.ortiga || 0) + (cr.hierba_larga || 0) > 0, JSON.stringify(cr));
  comprobar('y juncos y barro (lo que pide la casa humilde)', cr.juncos > 0 && cr.barro > 0, JSON.stringify(cr));
  // (P11) las semillas de la ribera, para el huerto
  // (son pocas: se buscan a lo largo de los ríos de la isla hasta dar con las dos, en la ribera)
  const sem = {};
  for (const rr of pai.rios.filter(q => q.length > 10).slice(0, 6)) for (let k = 2; k < rr.length - 1 && !(sem.col_silvestre && sem.nabo_silvestre); k += Math.max(1, Math.floor(rr.length / 8))) {
    const x = rr[k].p[0] * 1000, z = rr[k].p[1] * 1000;
    for (const q of puntosDe(cuadro(x, z, 48))) if (q.tipo === 'col_silvestre' || q.tipo === 'nabo_silvestre') { if (!q.zonas.includes('ribera')) sem.fuera = (sem.fuera || 0) + 1; else sem[q.tipo] = (sem[q.tipo] || 0) + 1; }
  }
  comprobar('y col silvestre y nabo silvestre en la ribera (las semillas del huerto)', MUTAR === '2' ? false : sem.col_silvestre > 0 && sem.nabo_silvestre > 0 && !sem.fuera, JSON.stringify(sem));
}

// 5) la marisma de una desembocadura (valravnx, 13 nov: «potenciar… una desembocadura para tener mucho más surplus de
// juncos»): muchos más juncos que a lo largo de un río (en un cuadro de 200 m de cada uno, junto a la salida de la demo)
{
  const cuenta = (x, z) => puntosDe(cuadro(x, z, 100)).filter(q => q.tipo === 'juncos').length;
  const des = cuenta(217470, 30960), rio = MUTAR === 'marisma' ? cuenta(217470, 30960) * 10 : cuenta(216297, 31463);
  comprobar('en la marisma de una desembocadura, muchos más juncos que en la orilla de un río (al menos 5 veces)', des >= 5 * Math.max(1, rio), `${des} frente a ${rio}`);
}

// 5) alrededor del sitio de salida común (a menos de 300 m): ramas, piedra, sílex y fibra para empezar. De los sitios de
// la salida al azar solo se dice lo que hay a menos de 500 m (en la pradera abierta hay sitios sin sílex ni piedra
// cerca: es una decisión pendiente de valravnx, no un fallo de esto)
{
  const de = (x, z, R) => { const c = {}; for (const p of puntosDe(cuadro(x, z, R))) c[p.tipo] = (c[p.tipo] || 0) + 1; return c; };
  const c = de(SALIDA.x, SALIDA.z, 300), fibra = (c.ortiga || 0) + (c.hierba_larga || 0);
  comprobar('alrededor de la salida común hay ramas, piedra, sílex y fibra', c.ramas > 0 && c.piedra > 0 && c.silex > 0 && fibra > 0, JSON.stringify(c));
  const sin = { ramas: 0, piedra: 0, silex: 0, fibra: 0 }, lista = SALIDAS.filter((_, k) => k % Math.ceil(SALIDAS.length / 12) === 0);
  for (const [x, z] of lista) { const q = de(x, z, 500); for (const t of ['ramas', 'piedra', 'silex']) if (!q[t]) sin[t]++; if (!(q.ortiga || q.hierba_larga)) sin.fibra++; }
  console.log(`  de ${lista.length} sitios de la salida al azar, sin cada cosa a menos de 500 m:`, JSON.stringify(sin));
  comprobar('en todos los sitios de salida hay fibra cerca', sin.fibra === 0);
}

// 6) siempre lo mismo: repetir, y por trozos
{
  const firma = (l) => l.map(p => `${p.id}:${p.giro.toFixed(4)}`).sort().join('|');
  const X = Math.floor(SALIDA.x / LADO_RECOGIDA), Z = Math.floor(SALIDA.z / LADO_RECOGIDA);
  const grande = recogidaEn(pai, alt, sem, { x0: X * LADO_RECOGIDA, z0: Z * LADO_RECOGIDA, x1: (X + 2) * LADO_RECOGIDA, z1: (Z + 2) * LADO_RECOGIDA });
  const otra = recogidaEn(pai, alt, sem, { x0: X * LADO_RECOGIDA, z0: Z * LADO_RECOGIDA, x1: (X + 2) * LADO_RECOGIDA, z1: (Z + 2) * LADO_RECOGIDA });
  const cuatro = [[0, 0], [1, 0], [0, 1], [1, 1]].flatMap(([a, b]) => recogidaTrozo(pai, alt, sem, X + a, Z + b));
  comprobar('repetir el mismo cuadro da lo mismo', firma(grande) === firma(otra) && grande.length > 0, `${grande.length}`);
  comprobar('cuatro trozos juntos dan lo mismo que su cuadro', firma(cuatro) === firma(grande), `${cuatro.length} y ${grande.length}`);
  comprobar('ningún nombre repetido', new Set(todos.map(p => p.id)).size === todos.length);
}

// 7) lo recogido de un punto que se va se guarda y vuelve con él
{
  const ps = recogidaTrozo(pai, alt, sem, Math.floor(SALIDA.x / LADO_RECOGIDA), Math.floor(SALIDA.z / LADO_RECOGIDA));
  const rec = new Recoleccion([]); rec.anadir(ps);
  const p = ps[0], invs = new Inventarios();
  const r = rec.recoger(invs.de('a'), p.id, p.x, p.z, 1000);
  rec.quitar(ps.map(q => q.id));
  const fuera = !rec.disponible(p.id, 2000) && rec.estado[p.id];
  const copia = new Recoleccion([]).importar(rec.exportar(), { todo: true });
  rec.anadir(ps); copia.anadir(ps);
  comprobar('recoger un punto del mundo va bien', r.ok, r.motivo || '');
  comprobar('al irse su trozo se guarda lo recogido, y al volver sigue recogido', !!fuera && !rec.disponible(p.id, 2000) && !copia.disponible(p.id, 2000) && copia.disponible(ps[1].id, 2000));
}

// 8) lo que cuesta: un trozo de 32 m
{
  const t0 = performance.now(); let n = 0;
  for (let k = 0; k < 20; k++) n += recogidaTrozo(pai, alt, sem, Math.floor(SALIDA.x / LADO_RECOGIDA) + k, Math.floor(SALIDA.z / LADO_RECOGIDA)).length;
  console.log(`  un trozo de ${LADO_RECOGIDA} m: ${((performance.now() - t0) / 20).toFixed(1)} ms (en node, ${n} puntos en 20 trozos)`);
}

console.log(fallos ? `\n${fallos} comprobaciones fallan` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
