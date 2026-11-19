// Prueba de la fragua y la barra de hierro (P10, «Hierro y tablas»; src/logica/fabricacion.js, src/logica/fuego.js y
// src/logica/inventario.js). Lógica pura, sin servidor; y el servidor, que la enciende y bate la barra con autor.
// Ejecutar: node pruebas/prueba_fragua.mjs
// Comprueba:
//   - el fuelle: 2 cueros y 2 varas, en el banco de tronco;
//   - la fragua (12 piedras, 4 barros y el fuelle; fuera, en tu tierra) se levanta como los demás puestos;
//   - su fuego solo arde carbón (ni ramas ni leña), y se enciende con yesca y el taladro de fuego;
//   - encendida, 1 lupia y 1 carbón dejados en ella dan 1 barra de hierro, llevando el mazo de piedra (no se gasta);
//   - sin el mazo, o apagada, no; y por el servidor, con su autor.
// MUTAR=1: la barra se bate sin llevar el mazo de piedra: tiene que FALLAR.
// MUTAR=2: a la fragua se le puede echar leña: tiene que FALLAR.
import { Fabricacion, RECETAS, ESTACIONES, USOS, MAX_RATO_ESTACION, motivoTierra } from '../src/logica/fabricacion.js';
import { Inventario, CATALOGO } from '../src/logica/inventario.js';
import { COMO } from '../src/logica/fuego.js';
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
if (MUTAR === '1') delete RECETAS.barra_hierro.requiere;
if (MUTAR === '2') COMO.fragua.come = ['carbon', 'lena'];
const T0 = Date.UTC(2026, 10, 19, 9, 0, 0);
const AQUI = { x: 1, z: 0 };
const dejar = (fab, s, inv, tipo, n) => fab.depositar('ana', s, inv.rutasCon(tipo)[0], n, AQUI, inv);

console.log('Lo que dice la tarea');
{
  const E = ESTACIONES.fragua, F = RECETAS.fuelle, B = RECETAS.barra_hierro;
  comprobar('el fuelle: 2 cueros y 2 varas, en el banco de tronco', F && F.uso === 'banco' && igual(F.gasta, { cuero: 2, vara: 2 }) && F.da === 'fuelle' && CATALOGO.fuelle, JSON.stringify(F));
  comprobar('la fragua: 12 piedras, 4 barros y el fuelle; fuera y en tu tierra; con fuego; da el forjar', E && igual(E.coste, { piedra: 12, barro: 4, fuelle: 1 }) && E.donde === 'fuera' && E.tierra && E.fuego && E.uso === 'forjar' && igual(USOS.forjar.estaciones, ['fragua']), JSON.stringify(E));
  comprobar('en la fragua, con el mazo de piedra, 1 lupia y 1 carbón dan 1 barra de hierro', B.uso === 'forjar' && igual(B.gasta, { lupia: 1, carbon: 1 }) && B.da === 'barra_hierro' && B.n === 1 && igual(B.requiere, ['mazo_piedra']), JSON.stringify(B));
  comprobar('fuera de tu tierra, dice por qué', /fragua/.test(motivoTierra('fragua')), motivoTierra('fragua'));
}

console.log('El fuelle en el banco');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const b = fab.colocar('ana', 'banco_tronco', 0, 0).id; delete fab.estaciones[b].obra;
  inv.meterDonde('cuero', 2); inv.meterDonde('vara', 2);
  dejar(fab, b, inv, 'cuero', 2); dejar(fab, b, inv, 'vara', 2);
  let r = fab.fabricar('ana', 'fuelle', null, AQUI, inv, suelo, T0);
  comprobar('se encarga en el banco', r.ok, r.motivo);
  r = fab.recoger('ana', b, AQUI, inv, T0 + RECETAS.fuelle.s * 1000, suelo);
  comprobar('y a su hora se recoge el fuelle', r.ok && inv.cuantos('fuelle') === 1, JSON.stringify(r));
}

console.log('Levantar la fragua, encenderla con carbón y batir la barra');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const r0 = fab.colocar('ana', 'fragua', 0, 0);
  comprobar('se pone su marco', r0.ok, r0.motivo);
  const s = r0.id;
  inv.meterDonde('fuelle', 1); inv.meterDonde('piedra', 12);
  for (let i = 0; i < 4; i++) suelo.dejar({ tipo: 'barro', n: 1 }, 0.4 + i * 0.2, 0.3, T0, 'ana', true);
  for (let i = 0; i < 6; i++) fab.entregarEstacion('ana', s, { x: 0, z: 0 }, inv, suelo, T0);
  for (let i = 0; i < 20 && fab.estaciones[s].obra; i++) fab.trabajarEstacion('ana', s, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('se levanta con sus piedras, barros y el fuelle', !fab.estaciones[s].obra && inv.cuantos('piedra') === 0 && inv.cuantos('fuelle') === 0 && fab.estaciones[s].fuego, JSON.stringify(fab.estaciones[s].obra || {}));
  inv.meterDonde('lena', 1); inv.meterDonde('rama', 1); inv.meterDonde('carbon', 3); inv.meterDonde('yesca', 1); inv.meterDonde('taladro_fuego', 1);
  let r = fab.echarFuego('ana', s, 'lena', AQUI, inv, T0);
  comprobar('leña, no: solo arde carbón', !r.ok && inv.cuantos('lena') === 1, r.motivo);
  r = fab.echarFuego('ana', s, 'rama', AQUI, inv, T0);
  comprobar('ramas, tampoco', !r.ok && inv.cuantos('rama') === 1, r.motivo);
  r = fab.encenderFuego('ana', s, AQUI, inv, T0);
  comprobar('sin nada puesto no se enciende, y dice que le eches carbón', !r.ok && /carbón/.test(r.motivo || ''), r.motivo);
  r = fab.echarFuego('ana', s, 'carbon', AQUI, inv, T0);
  comprobar('se le echa un carbón', r.ok && inv.cuantos('carbon') === 2, r.motivo);
  inv.meterDonde('lupia', 1); dejar(fab, s, inv, 'lupia', 1); dejar(fab, s, inv, 'carbon', 1);
  inv.meterDonde('mazo_piedra', 1);
  r = fab.fabricar('ana', 'barra_hierro', null, AQUI, inv, suelo, T0);
  comprobar('apagada, no se bate', !r.ok && /apagado/.test(r.motivo || ''), r.motivo);
  r = fab.encenderFuego('ana', s, AQUI, inv, T0);
  comprobar('con yesca y el taladro, se enciende', r.ok && inv.cuantos('yesca') === 0, r.motivo);
  const mazo = inv.rutasCon('mazo_piedra')[0]; inv.sacar(mazo);
  r = fab.fabricar('ana', 'barra_hierro', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('sin el mazo de piedra, no se bate', !r.ok && /mazo/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('mazo_piedra', 1);
  r = fab.fabricar('ana', 'barra_hierro', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('encendida y con el mazo, se bate: gasta la lupia y el carbón dejados', r.ok && !Object.keys(fab.estaciones[s].deposito).length, r.motivo || JSON.stringify(fab.estaciones[s].deposito));
  comprobar('y el mazo no se gasta', inv.cuantos('mazo_piedra') === 1);
  r = fab.recoger('ana', s, AQUI, inv, T0 + 1000 + RECETAS.barra_hierro.s * 1000, suelo);
  comprobar('a su hora, 1 barra de hierro', r.ok && inv.cuantos('barra_hierro') === 1, JSON.stringify(r));
}

console.log('Por el servidor, con autor');
{
  const pos = { ana: { x: 1, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'fragua', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantada
  const ana = o.invs.de('ana'), T = Date.now();
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  for (const [t, n] of [['lupia', 1], ['carbon', 2], ['yesca', 1], ['taladro_fuego', 1], ['mazo_piedra', 1]]) ana.meterDonde(t, n);
  let r = o.ejecutar({ autor: 'ana', tipo: 'echar_fuego', estacion: id, objeto: 'carbon', x: 1, z: 0 }, T);
  comprobar('Ana le echa un carbón', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'encender_fuego', estacion: id, x: 1, z: 0 }, T);
  comprobar('y la enciende', r.ok, r.motivo);
  for (const t of ['lupia', 'carbon']) {
    r = o.ejecutar({ autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon(t)[0], cantidad: 1, x: 1, z: 0 }, T);
    comprobar(`deja en ella 1 ${t}`, r.ok, r.motivo);
  }
  const vista = o.estacionesVisibles(null, T + 1000).find(e => e.id === id);
  comprobar('todos ven su fuego encendido', vista && vista.fuego && vista.fuego.encendida, JSON.stringify(vista && vista.fuego));
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'barra_hierro', estacion: id, x: 1, z: 0 }, T + 1000);
  comprobar('bate la barra', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + 1000 + RECETAS.barra_hierro.s * 1000);
  comprobar('y la recoge', r.ok && ana.cuantos('barra_hierro') === 1, r.motivo);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
