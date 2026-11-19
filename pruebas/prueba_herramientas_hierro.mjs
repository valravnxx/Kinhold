// Prueba de las primeras herramientas de hierro (P10, «Hierro y tablas»; src/logica/fabricacion.js y
// src/logica/inventario.js). Lógica pura, sin servidor; y el servidor, que las bate en la fragua con autor.
// Ejecutar: node pruebas/prueba_herramientas_hierro.mjs
// Comprueba:
//   - el mango: 1 vara, en el banco de tronco;
//   - en la fragua encendida, con el mazo de piedra (no se gasta): 1 barra y 1 mango dan el hacha de hierro; 1 barra y
//     1 mango, el pico; 1 barra, 10 clavos;
//   - apagada, o sin el mazo, no;
//   - el hacha de hierro tala los adultos y trocea más deprisa que la de piedra (lo que ya sabe la tala);
//   - por el servidor, con su autor.
// MUTAR=1: el pico se bate sin el mango: tiene que FALLAR.
// MUTAR=2: la barra da 1 clavo y no 10: tiene que FALLAR.
import { Fabricacion, RECETAS, USOS } from '../src/logica/fabricacion.js';
import { Inventario, CATALOGO } from '../src/logica/inventario.js';
import { HACHAS, GOLPES } from '../src/logica/tala.js';
import { TROCEO } from '../src/logica/troceo.js';
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
if (MUTAR === '1') RECETAS.pico.gasta = { barra_hierro: 1 };
if (MUTAR === '2') RECETAS.clavos.n = 1;
const T0 = Date.UTC(2026, 10, 19, 9, 0, 0);
const AQUI = { x: 1, z: 0 };
const dejar = (fab, s, inv, tipo, n) => fab.depositar('ana', s, inv.rutasCon(tipo)[0], n, AQUI, inv);

console.log('Lo que dice la tarea');
{
  const M = RECETAS.mango, H = RECETAS.hacha_hierro, P = RECETAS.pico, C = RECETAS.clavos;
  comprobar('el mango: 1 vara, en el banco de tronco', M && M.uso === 'banco' && igual(M.gasta, { vara: 1 }) && M.da === 'mango' && M.n === 1 && CATALOGO.mango, JSON.stringify(M));
  comprobar('el hacha de hierro: 1 barra y 1 mango, en la fragua, con el mazo', H && H.uso === 'forjar' && igual(H.gasta, { barra_hierro: 1, mango: 1 }) && H.da === 'hacha_hierro' && H.n === 1 && igual(H.requiere, ['mazo_piedra']), JSON.stringify(H));
  comprobar('el pico: 1 barra y 1 mango, en la fragua, con el mazo', P && P.uso === 'forjar' && igual(P.gasta, { barra_hierro: 1, mango: 1 }) && P.da === 'pico' && P.n === 1 && igual(P.requiere, ['mazo_piedra']) && CATALOGO.pico && CATALOGO.pico.herramienta, JSON.stringify(P));
  comprobar('los clavos: 1 barra da 10, en la fragua, con el mazo', C && C.uso === 'forjar' && igual(C.gasta, { barra_hierro: 1 }) && C.da === 'clavo' && C.n === 10 && igual(C.requiere, ['mazo_piedra']), JSON.stringify(C));
  comprobar('la fragua es la estación del forjar', igual(USOS.forjar.estaciones, ['fragua']));
  comprobar('el hacha de hierro tala con hierro: el adulto en menos golpes que con piedra', HACHAS.hacha_hierro === 'hierro' && GOLPES.adulto.hierro < GOLPES.adulto.piedra, JSON.stringify(GOLPES.adulto));
  comprobar('y tronza y parte en menos golpes que con piedra', TROCEO.tronco_largo.golpes.hierro < TROCEO.tronco_largo.golpes.piedra && TROCEO.tronco_corto.golpes.hierro < TROCEO.tronco_corto.golpes.piedra);
}

console.log('El mango en el banco');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const b = fab.colocar('ana', 'banco_tronco', 0, 0).id; delete fab.estaciones[b].obra;
  inv.meterDonde('vara', 2);
  dejar(fab, b, inv, 'vara', 2);
  let r = fab.fabricar('ana', 'mango', null, AQUI, inv, suelo, T0);
  comprobar('se encarga en el banco', r.ok, r.motivo);
  r = fab.fabricar('ana', 'mango', null, AQUI, inv, suelo, T0);
  comprobar('y otro, con la otra vara', r.ok, r.motivo);
  r = fab.recoger('ana', b, AQUI, inv, T0 + RECETAS.mango.s * 2000, suelo);
  comprobar('a su hora se recogen los 2 mangos', r.ok && inv.cuantos('mango') === 2, JSON.stringify(r));
}

console.log('En la fragua: el hacha, el pico y los clavos');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const s = fab.colocar('ana', 'fragua', 0, 0).id; delete fab.estaciones[s].obra;
  for (const [t, n] of [['mazo_piedra', 1], ['taladro_fuego', 1], ['barra_hierro', 3], ['mango', 2], ['carbon', 2], ['yesca', 1]]) inv.meterDonde(t, n);
  dejar(fab, s, inv, 'barra_hierro', 1); dejar(fab, s, inv, 'mango', 1);
  let r = fab.fabricar('ana', 'hacha_hierro', null, AQUI, inv, suelo, T0);
  comprobar('apagada, no se bate', !r.ok && /apagado/.test(r.motivo || ''), r.motivo);
  fab.echarFuego('ana', s, 'carbon', AQUI, inv, T0); fab.echarFuego('ana', s, 'carbon', AQUI, inv, T0);
  r = fab.encenderFuego('ana', s, AQUI, inv, T0);
  comprobar('se enciende con su carbón', r.ok, r.motivo);
  const mazo = inv.rutasCon('mazo_piedra')[0]; inv.sacar(mazo);
  r = fab.fabricar('ana', 'hacha_hierro', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('sin el mazo de piedra, no se bate', !r.ok && /mazo/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('mazo_piedra', 1);
  r = fab.fabricar('ana', 'hacha_hierro', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('encendida y con el mazo, el hacha: gasta la barra y el mango dejados', r.ok && !Object.keys(fab.estaciones[s].deposito).length, r.motivo || JSON.stringify(fab.estaciones[s].deposito));
  r = fab.fabricar('ana', 'pico', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('sin barra ni mango dejados, el pico no', !r.ok, r.motivo);
  dejar(fab, s, inv, 'barra_hierro', 1);
  r = fab.fabricar('ana', 'pico', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('con la barra y sin el mango, el pico tampoco', !r.ok, r.motivo);
  dejar(fab, s, inv, 'mango', 1);
  r = fab.fabricar('ana', 'pico', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('con la barra y el mango, el pico', r.ok, r.motivo);
  dejar(fab, s, inv, 'barra_hierro', 1);
  r = fab.fabricar('ana', 'clavos', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('y con otra barra, los clavos', r.ok, r.motivo);
  const fin = T0 + 1000 + (RECETAS.hacha_hierro.s + RECETAS.pico.s + RECETAS.clavos.s) * 1000;
  r = fab.recoger('ana', s, AQUI, inv, fin, suelo);
  comprobar('a su hora, el hacha de hierro, el pico y 10 clavos', r.ok && inv.cuantos('hacha_hierro') === 1 && inv.cuantos('pico') === 1 && inv.cuantos('clavo') + suelo.visibles(fin).filter(o => o.cosa.tipo === 'clavo').reduce((t, o) => t + o.cosa.n, 0) === 10,
    `hacha ${inv.cuantos('hacha_hierro')}, pico ${inv.cuantos('pico')}, clavos ${inv.cuantos('clavo')}`);
  comprobar('y el mazo no se gasta', inv.cuantos('mazo_piedra') === 1);
}

console.log('Por el servidor, con autor');
{
  const pos = { ana: { x: 1, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'fragua', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantada
  const ana = o.invs.de('ana'), T = Date.now();
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  for (const [t, n] of [['mazo_piedra', 1], ['taladro_fuego', 1], ['barra_hierro', 1], ['mango', 1], ['carbon', 1], ['yesca', 1]]) ana.meterDonde(t, n);
  let r = o.ejecutar({ autor: 'ana', tipo: 'echar_fuego', estacion: id, objeto: 'carbon', x: 1, z: 0 }, T);
  r = r.ok ? o.ejecutar({ autor: 'ana', tipo: 'encender_fuego', estacion: id, x: 1, z: 0 }, T) : r;
  comprobar('Ana le echa carbón y la enciende', r.ok, r.motivo);
  for (const t of ['barra_hierro', 'mango']) {
    r = o.ejecutar({ autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon(t)[0], cantidad: 1, x: 1, z: 0 }, T);
    comprobar(`deja en ella 1 ${t}`, r.ok, r.motivo);
  }
  r = o.ejecutar({ autor: 'bea', tipo: 'fabricar', receta: 'pico', estacion: id, x: 1, z: 0 }, T + 1000);
  comprobar('Bea, que no está al lado, no le bate el pico', !r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'pico', estacion: id, x: 1, z: 0 }, T + 1000);
  comprobar('Ana bate el pico', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + 1000 + RECETAS.pico.s * 1000);
  comprobar('y lo recoge', r.ok && ana.cuantos('pico') === 1, r.motivo);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
