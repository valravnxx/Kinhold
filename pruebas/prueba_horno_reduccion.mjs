// Prueba del horno de reducción y la lupia (P10, «Hierro y tablas»; src/logica/fabricacion.js y src/logica/inventario.js).
// Lógica pura, sin servidor; y el servidor, que lo carga, lo enciende y lo recoge con autor y enseña su humo a todos.
// Ejecutar: node pruebas/prueba_horno_reduccion.mjs
// Comprueba:
//   - el horno (20 barros, 10 piedras y 4 carbones; fuera, en tu tierra) se levanta como los demás puestos;
//   - cargado con 3 minerales de hierro, 4 carbones y la yesca, y encendido llevando el taladro de fuego (no se gasta),
//     da 1 lupia de hierro al cabo de su tiempo (por tiempo transcurrido), que solo recoge quien lo encendió;
//   - sin el taladro, o con la carga incompleta, no; una carga cada vez; no se desmonta mientras reduce;
//   - el servidor manda a todos que está reduciendo (para el humo), sin decir de quién es la carga.
// MUTAR=1: el horno se enciende sin llevar el taladro de fuego: tiene que FALLAR.
import { Fabricacion, RECETAS, ESTACIONES, USOS, MAX_RATO_ESTACION, REDUCIR, motivoTierra } from '../src/logica/fabricacion.js';
import { Inventario, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

const MUTAR = process.env.MUTAR || '';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function jugador() {
  const inv = Inventario.inicial();
  inv.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  return inv;
}
if (MUTAR === '1') delete RECETAS.reducir.requiere;
const T0 = Date.UTC(2026, 10, 17, 9, 0, 0);
const AQUI = { x: 1, z: 0 };
const dejar = (fab, s, inv, tipo, n) => fab.depositar('ana', s, inv.rutasCon(tipo)[0], n, AQUI, inv);

console.log('Lo que dice la tarea');
{
  const E = ESTACIONES.horno_reduccion, R = RECETAS.reducir;
  comprobar('el horno: 20 barros, 10 piedras y 4 carbones; fuera y en tu tierra; da el reducir', E && igual(E.coste, { barro: 20, piedra: 10, carbon: 4 }) && E.donde === 'fuera' && E.tierra && E.uso === 'reducir' && igual(USOS.reducir.estaciones, ['horno_reduccion']), JSON.stringify(E));
  comprobar('la carga: 3 minerales de hierro y 4 carbones (con la yesca), encendida con el taladro de fuego, da 1 lupia', R.uso === 'reducir' && igual(R.gasta, { mineral_hierro: 3, carbon: 4, yesca: 1 }) && R.da === 'lupia' && R.n === 1 && igual(R.requiere, ['taladro_fuego']), JSON.stringify(R));
  comprobar('tarda un rato real (1 h, provisional) y echa humo mientras', R.s === REDUCIR && REDUCIR === 3600 && E.humea && E.carga === 1);
  comprobar('el carbón y la lupia están en el catálogo', CATALOGO.carbon && CATALOGO.carbon.recurso && CATALOGO.lupia && CATALOGO.lupia.recurso);
  comprobar('fuera de tu tierra, dice por qué', /horno de reducción/.test(motivoTierra('horno_reduccion')), motivoTierra('horno_reduccion'));
}

console.log('Levantar el horno, cargarlo y encenderlo');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const r0 = fab.colocar('ana', 'horno_reduccion', 0, 0);
  comprobar('se pone su marco', r0.ok, r0.motivo);
  const s = r0.id;
  inv.meterDonde('piedra', 10); inv.meterDonde('carbon', 4);
  for (let i = 0; i < 20; i++) suelo.dejar({ tipo: 'barro', n: 1 }, 0.4 + (i % 5) * 0.2, (Math.floor(i / 5) - 1.5) * 0.3, T0, 'ana', true);   // las 20 cestas de barro, al lado
  for (let i = 0; i < 6; i++) fab.entregarEstacion('ana', s, { x: 0, z: 0 }, inv, suelo, T0);
  for (let i = 0; i < 20 && fab.estaciones[s].obra; i++) fab.trabajarEstacion('ana', s, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('se levanta con sus barros, piedras y carbones', !fab.estaciones[s].obra && inv.cuantos('barro') === 0 && inv.cuantos('piedra') === 0 && inv.cuantos('carbon') === 0, JSON.stringify(fab.estaciones[s].obra || {}));
  inv.meterDonde('mineral_hierro', 3); inv.meterDonde('carbon', 4); inv.meterDonde('yesca', 1);
  for (const [t, n] of [['mineral_hierro', 3], ['carbon', 3], ['yesca', 1]]) dejar(fab, s, inv, t, n);
  inv.meterDonde('taladro_fuego', 1);
  let r = fab.fabricar('ana', 'reducir', null, AQUI, inv, suelo, T0);
  comprobar('con 3 carbones (falta uno), no se enciende', !r.ok && /carb/i.test(r.motivo || ''), r.motivo);
  dejar(fab, s, inv, 'carbon', 1);
  const taladro = inv.rutasCon('taladro_fuego')[0]; inv.sacar(taladro);
  r = fab.fabricar('ana', 'reducir', null, AQUI, inv, suelo, T0);
  comprobar('sin el taladro de fuego, no se enciende', !r.ok && /taladro/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('taladro_fuego', 1);
  r = fab.fabricar('ana', 'reducir', null, AQUI, inv, suelo, T0);
  comprobar('cargado y con el taladro, se enciende: gasta la carga entera', r.ok && !Object.keys(fab.estaciones[s].deposito).length, r.motivo || JSON.stringify(fab.estaciones[s].deposito));
  comprobar('y el taladro no se gasta', inv.cuantos('taladro_fuego') === 1);
  for (const [t, n] of [['mineral_hierro', 3], ['carbon', 4], ['yesca', 1]]) { inv.meterDonde(t, n); dejar(fab, s, inv, t, n); }
  const otra = fab.fabricar('ana', 'reducir', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('una carga cada vez: mientras reduce, otra no', !otra.ok && /encendido/.test(otra.motivo || ''), otra.motivo);
  const d = fab.desmontarEstacion('ana', s, AQUI, suelo, T0 + 1000);
  comprobar('mientras reduce no se desmonta', !d.ok, d.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + REDUCIR * 1000 - 1, suelo);
  comprobar('antes de su hora no hay lupia', !r.ok && inv.cuantos('lupia') === 0, r.motivo);
  r = fab.recoger('bea', s, AQUI, jugador(), T0 + REDUCIR * 1000, suelo);
  comprobar('a su hora, otro no se la lleva', !r.ok, r.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + REDUCIR * 1000, suelo);
  comprobar('a su hora, quien lo encendió recoge 1 lupia de hierro', r.ok && inv.cuantos('lupia') === 1, JSON.stringify(r));
  r = fab.fabricar('ana', 'reducir', null, AQUI, inv, suelo, T0 + REDUCIR * 1000 + 1);
  comprobar('y ya se puede encender otra carga', r.ok, r.motivo);
  const sin = new Fabricacion(), inv2 = jugador();
  for (const [t, n] of Object.entries(RECETAS.reducir.gasta)) inv2.meterDonde(t, n);
  inv2.meterDonde('taladro_fuego', 1);
  const r2 = sin.fabricar('ana', 'reducir', null, AQUI, inv2, new Suelo(), T0);
  comprobar('sin horno, no (ni con las manos)', !r2.ok && inv2.cuantos('mineral_hierro') === 3, r2.motivo);
}

console.log('Por el servidor, con autor; el humo, para todos');
{
  const pos = { ana: { x: 1, z: 0 }, bea: { x: 1.5, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'horno_reduccion', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantado
  const ana = o.invs.de('ana'), T = Date.now();
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  for (const [t, n] of [['mineral_hierro', 3], ['carbon', 4], ['yesca', 1], ['taladro_fuego', 1]]) ana.meterDonde(t, n);
  for (const [t, n] of [['mineral_hierro', 3], ['carbon', 4], ['yesca', 1]]) {
    const r = o.ejecutar({ autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon(t)[0], cantidad: n, x: 1, z: 0 }, T);
    comprobar(`Ana carga el horno: ${n} ${t}`, r.ok, r.motivo);
  }
  let vista = o.estacionesVisibles(null, T).find(e => e.id === id);
  comprobar('apagado, no se ve que reduzca', vista && igual(vista.colgado, []), JSON.stringify(vista));
  let r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'reducir', estacion: id, x: 1, z: 0 }, T);
  comprobar('y lo enciende', r.ok, r.motivo);
  vista = o.estacionesVisibles(null, T + 1000).find(e => e.id === id);
  comprobar('todos ven que reduce (lo que le queda), sin saber de quién es', vista && vista.colgado.length === 1 && vista.colgado[0].queda > 0 && !JSON.stringify(vista.colgado).includes('ana'), JSON.stringify(vista && vista.colgado));
  r = o.ejecutar({ autor: 'bea', tipo: 'recoger_fabricado', estacion: id, x: 1.5, z: 0 }, T + REDUCIR * 1000);
  comprobar('Bea no se lleva la lupia de Ana', !r.ok && o.invs.de('bea').cuantos('lupia') === 0, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + REDUCIR * 1000);
  comprobar('Ana recoge su lupia', r.ok && ana.cuantos('lupia') === 1, r.motivo);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
