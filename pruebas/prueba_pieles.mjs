// Prueba del raspador de pieles, la piel limpia y el zurrón (P9, «Oficios del asentamiento»; src/logica/fabricacion.js
// y src/logica/inventario.js). Lógica pura, sin servidor; y el servidor, que lo levanta, lo raspa y lo cose con autor.
// Ejecutar: node pruebas/prueba_pieles.mjs
// Comprueba:
//   - el raspador (un bastidor de 4 varas y 1 cuerda, fuera) se levanta como los demás puestos;
//   - en él, 1 piel da 1 piel limpia, solo llevando la lasca de sílex (que no se gasta), al cabo de su tiempo;
//   - sin raspador, o sin la lasca, no;
//   - el zurrón de piel (2 pieles limpias y 1 cordel, en el banco de tronco) es la mochila mixta pequeña: se pone a la
//     espalda y guarda lo que sea en sus 2 huecos medianos y 2 pequeños;
//   - la piel limpia cabe en el fardo (con las pieles), y no en el cesto (lo pequeño).
// MUTAR=1: la piel se raspa sin llevar la lasca: tiene que FALLAR.
import { Fabricacion, RECETAS, ESTACIONES, USOS, MAX_RATO_ESTACION } from '../src/logica/fabricacion.js';
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
  inv.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  inv.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  return inv;
}
if (MUTAR === '1') delete RECETAS.raspar_piel.requiere;
const T0 = Date.UTC(2026, 10, 13, 20, 0, 0);
const AQUI = { x: 1, z: 0 };

console.log('Lo que dice el documento de sistemas');
{
  const E = ESTACIONES.raspador, R = RECETAS.raspar_piel, Z = RECETAS.zurron;
  comprobar('el raspador de pieles: un bastidor de 4 varas y 1 cuerda, fuera; da el raspar', igual(E.coste, { vara: 4, cuerda: 1 }) && E.uso === 'raspar' && E.donde === 'fuera' && igual(USOS.raspar.estaciones, ['raspador']), JSON.stringify(E));
  comprobar('en él, 1 piel da 1 piel limpia, llevando la lasca de sílex', R.uso === 'raspar' && igual(R.gasta, { piel: 1 }) && R.da === 'piel_limpia' && R.n === 1 && igual(R.requiere, ['lasca_silex']), JSON.stringify(R));
  comprobar('el zurrón: 2 pieles limpias y 1 cordel, en el banco de tronco', Z.uso === 'banco' && igual(Z.gasta, { piel_limpia: 2, cordel: 1 }) && Z.da === 'zurron', JSON.stringify(Z));
  comprobar('el zurrón es la mochila mixta pequeña: a la espalda, 2 huecos medianos y 2 pequeños, sin límite de qué', CATALOGO.zurron.lugar === 'espalda' && igual(CATALOGO.zurron.huecos.map(h => h.tam), ['M', 'M', 'P', 'P']) && !CATALOGO.zurron.admite);
  comprobar('la piel limpia es mediana, cabe en el fardo y no en el cesto', CATALOGO.piel_limpia.tam === 'M' && CATALOGO.fardo.admite.includes('piel_limpia') && !ESTACIONES.cesto.guarda.includes('piel_limpia'));
}

console.log('Levantar el raspador y raspar una piel');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  inv.meterDonde('vara', 4); inv.meterDonde('cuerda', 1);
  const r0 = fab.colocar('ana', 'raspador', 0, 0);
  comprobar('se pone su marco', r0.ok, r0.motivo);
  const s = r0.id;
  fab.entregarEstacion('ana', s, { x: 0, z: 0 }, inv, suelo, T0);
  for (let i = 0; i < 10 && fab.estaciones[s].obra; i++) fab.trabajarEstacion('ana', s, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('se levanta con las 4 varas y la cuerda', !fab.estaciones[s].obra && inv.cuantos('vara') === 0 && inv.cuantos('cuerda') === 0, JSON.stringify(fab.estaciones[s].obra));
  inv.meterDonde('piel', 3);
  let r = fab.depositar('ana', s, inv.rutasCon('piel')[0], 3, AQUI, inv);
  comprobar('las pieles se dejan en el raspador (como en los demás puestos)', r.ok && fab.estaciones[s].deposito.piel === 3, r.motivo);
  r = fab.fabricar('ana', 'raspar_piel', null, AQUI, inv, suelo, T0);
  comprobar('sin la lasca de sílex, no se raspa', !r.ok && /lasca/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('lasca_silex', 1);
  r = fab.fabricar('ana', 'raspar_piel', null, AQUI, inv, suelo, T0);
  comprobar('con la lasca, se pone a raspar una piel (se gasta una de las dejadas)', r.ok && fab.estaciones[s].deposito.piel === 2, r.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + RECETAS.raspar_piel.s * 1000 - 1, suelo);
  comprobar('antes de su tiempo no está', !r.ok && inv.cuantos('piel_limpia') === 0, r.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + RECETAS.raspar_piel.s * 1000, suelo);
  comprobar('después, se recoge la piel limpia y la lasca sigue (no se gasta)', r.ok && inv.cuantos('piel_limpia') === 1 && inv.cuantos('lasca_silex') === 1, JSON.stringify(r));
  const lejos = fab.fabricar('ana', 'raspar_piel', null, { x: 30, z: 0 }, inv, suelo, T0);
  comprobar('lejos del raspador, no', !lejos.ok, lejos.motivo);
  const sinR = new Fabricacion(), inv2 = jugador(); inv2.meterDonde('piel', 1); inv2.meterDonde('lasca_silex', 1);
  const r2 = sinR.fabricar('ana', 'raspar_piel', null, AQUI, inv2, new Suelo(), T0);
  comprobar('sin raspador, no (ni con las manos)', !r2.ok && inv2.cuantos('piel') === 1, r2.motivo);
}

console.log('El zurrón de piel');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const b = fab.colocar('ana', 'banco_tronco', 0, 0).id; delete fab.estaciones[b].obra;   // ya levantado
  inv.meterDonde('piel_limpia', 1); inv.meterDonde('cordel', 1);
  fab.depositar('ana', b, inv.rutasCon('piel_limpia')[0], 1, AQUI, inv); fab.depositar('ana', b, inv.rutasCon('cordel').find(r => r !== 'cintura'), 1, AQUI, inv);
  let r = fab.fabricar('ana', 'zurron', null, AQUI, inv, suelo, T0);
  comprobar('con una sola piel limpia, no', !r.ok, r.motivo);
  inv.meterDonde('piel_limpia', 1); fab.depositar('ana', b, inv.rutasCon('piel_limpia')[0], 1, AQUI, inv);
  r = fab.fabricar('ana', 'zurron', null, AQUI, inv, suelo, T0);
  comprobar('con dos y un cordel, en el banco, sí (y el cordel de la cintura no se gasta)', r.ok && !fab.estaciones[b].deposito.piel_limpia && inv.lugares.cintura && inv.lugares.cintura.tipo === 'cordel', r.motivo);
  r = fab.recoger('ana', b, AQUI, inv, T0 + RECETAS.zurron.s * 1000, suelo);
  comprobar('se recoge el zurrón', r.ok && inv.cuantos('zurron') === 1, JSON.stringify(r));
  // ponérselo: quitar la mochila de bastidor y poner el zurrón a la espalda; guarda de todo
  const inv3 = Inventario.inicial(); inv3.lugares.espalda = null; inv3.meterDonde('zurron', 1);
  const p = inv3.ponerse(inv3.rutasCon('zurron')[0]);
  comprobar('el zurrón se pone a la espalda', p.ok && inv3.lugares.espalda && inv3.lugares.espalda.tipo === 'zurron', JSON.stringify(p));
  const huecos = inv3.rutasGuardar().filter(r => r.startsWith('espalda/'));
  comprobar('con sus 4 huecos', huecos.length === 4, JSON.stringify(huecos));
  const m1 = inv3.meterDonde('piedra', 1, 'espalda/0'), m2 = inv3.meterDonde('silex', 1, 'espalda/2');
  comprobar('y guarda lo que sea (una piedra, mediana; un sílex, pequeño)', inv3.rutasCon('piedra').some(r => r.startsWith('espalda/')) && inv3.rutasCon('silex').some(r => r.startsWith('espalda/')), JSON.stringify([m1, m2, inv3.lugares.espalda]));
}

console.log('Por el servidor, con autor');
{
  const pos = { ana: { x: 1, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'raspador', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantado
  const ana = o.invs.de('ana'), T = Date.now();
  ana.meterDonde('piel', 1); ana.meterDonde('lasca_silex', 1);
  let r = o.ejecutar({ autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon('piel')[0], cantidad: 1, x: 1, z: 0 }, T);
  comprobar('Ana deja una piel en el raspador', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'raspar_piel', estacion: id, x: 1, z: 0 }, T);
  comprobar('y la raspa', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + RECETAS.raspar_piel.s * 1000);
  comprobar('y recoge su piel limpia', r.ok && ana.cuantos('piel_limpia') === 1, r.motivo);
  r = o.ejecutar({ autor: 'bea', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + RECETAS.raspar_piel.s * 1000);
  comprobar('otro no se lleva lo de Ana', !r.ok || o.invs.de('bea').cuantos('piel_limpia') === 0, r.motivo);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
