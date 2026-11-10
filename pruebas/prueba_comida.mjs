// Prueba de despiezar y asar (P4; src/logica/comida.js, src/logica/fabricacion.js, src/logica/inventario.js y
// src/logica/suelo.js). Lógica pura, sin servidor (el servidor, en el recorrido: pruebas/prueba_recorrido.mjs).
// Ejecutar: node pruebas/prueba_comida.mjs
// Comprueba:
//   - la liebre del suelo se despieza con las manos, solo llevando la lasca de sílex (que no se gasta), y da carne cruda
//     y una piel; la honda y el odre vuelven (piden piel);
//   - la carne cruda se asa al fuego encendido de la hoguera y da carne asada; la asada sacia más que la cruda;
//   - la carne cruda lleva hasta cuándo dura, la conserva al soltarla y cogerla del suelo, al juntar dos montones se queda
//     la que antes se estropea, y pasada su hora desaparece de lo que llevas y del suelo; la asada no se estropea.
// MUTAR=1: la carne cruda no se estropea nunca: tiene que FALLAR.
import { Fabricacion, RECETAS, MAX_RATO_ESTACION } from '../src/logica/fabricacion.js';
import { Inventario } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { NUTRE, comestible } from '../src/logica/necesidades.js';
import * as comida from '../src/logica/comida.js';

const MUTAR = process.env.MUTAR || '';
const { VIDA } = comida;
const estropearInventario = MUTAR === '1' ? () => ({ cambia: false, estropeadas: {} }) : comida.estropearInventario;
const estropearSuelo = MUTAR === '1' ? () => ({ cambia: false, estropeadas: {} }) : comida.estropearSuelo;
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
const T0 = Date.UTC(2026, 10, 9, 6, 0, 0);

console.log('Despiezar la liebre');
{
  const R = RECETAS.despiezar_liebre;
  comprobar('con las manos, gasta 1 liebre, pide la lasca de sílex y da carne cruda y una piel', R.uso === 'manos' && igual(R.gasta, { liebre: 1 }) && igual(R.requiere, ['lasca_silex']) && R.da === 'carne_cruda' && R.n === 1 && igual(R.tambien, { piel: 1 }));
  comprobar('la honda y el odre vuelven al panel (ya hay piel)', !RECETAS.honda.fuera && !RECETAS.odre.fuera);
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  suelo.dejar({ tipo: 'liebre', n: 1 }, 1, 0, T0, 'ana', false);
  let r = fab.fabricar('ana', 'despiezar_liebre', null, { x: 0, z: 0 }, inv, suelo, T0);
  comprobar('sin la lasca no se despieza, y dice qué hace falta', !r.ok && /lasca de sílex/.test(r.motivo), r.motivo);
  const l = fab.lista({ x: 0, z: 0 }, inv, suelo, T0).find(x => x.receta === 'despiezar_liebre');
  comprobar('el panel la enseña casi, sin herramienta, y con lo que da además', l.grupo === 'casi' && l.sinHerramienta && igual(l.requiere, ['lasca_silex']) && igual(l.tambien, { piel: 1 }), JSON.stringify(l));
  inv.meterDonde('lasca_silex', 1);
  r = fab.fabricar('ana', 'despiezar_liebre', null, { x: 0, z: 0 }, inv, suelo, T0);
  comprobar('con la lasca, se despieza la liebre del suelo de al lado', r.ok && !suelo.objetos.some(o => o.cosa.tipo === 'liebre'), r.motivo);
  comprobar('la lasca no se gasta', inv.cuantos('lasca_silex') === 1);
  r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + 1000, suelo);
  comprobar('antes de su tiempo no está', !r.ok);
  const fin = T0 + R.s * 1000;
  r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, fin, suelo);
  comprobar('al terminar se recogen la carne cruda y la piel', r.ok && inv.cuantos('carne_cruda') === 1 && inv.cuantos('piel') === 1, JSON.stringify(r));
  const c = inv.buscar(inv.rutasCon('carne_cruda')[0]).cosa;
  comprobar(`la carne cruda dura ${VIDA.carne_cruda / 3600000} h desde que se despiezó`, c.hasta === fin + VIDA.carne_cruda, String(c.hasta));
  // sin sitio: la piel cae a tus pies
  const inv2 = Inventario.inicial(); inv2.lugares['mano:der'] = { tipo: 'lasca_silex', n: 1 };
  suelo.dejar({ tipo: 'liebre', n: 1 }, 1, 0, T0, 'blas', false);
  fab.fabricar('blas', 'despiezar_liebre', null, { x: 0, z: 0 }, inv2, suelo, T0);
  r = fab.recoger('blas', null, { x: 0, z: 0 }, inv2, fin, suelo);
  comprobar('con una mano libre, la carne a la mano y la piel, que no cabe, al suelo', r.ok && inv2.cuantos('carne_cruda') === 1 && suelo.objetos.some(o => o.cosa.tipo === 'piel'), JSON.stringify(r.dados));
}

console.log('Asar la carne y comerla');
{
  const R = RECETAS.asar_carne;
  comprobar('al fuego, 1 carne cruda da 1 carne asada', R.uso === 'fuego' && igual(R.gasta, { carne_cruda: 1 }) && R.da === 'carne_asada' && R.n === 1);
  comprobar('las dos se comen y la asada sacia bastante más', comestible('carne_cruda') && comestible('carne_asada') && NUTRE.carne_asada >= 2 * NUTRE.carne_cruda, JSON.stringify(NUTRE));
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  inv.meterDonde('piedra', 6); inv.meterDonde('rama', 4);
  const h = fab.colocar('ana', 'hoguera', 0, 0).id;
  fab.entregarEstacion('ana', h, { x: 0, z: 0 }, inv, suelo, T0);
  for (let i = 0; i < 5 && fab.estaciones[h].obra; i++) fab.trabajarEstacion('ana', h, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  inv.meterDonde('carne_cruda', 1, undefined, { hasta: T0 + 5000 });
  const ruta = inv.rutasCon('carne_cruda')[0];
  let r = fab.depositar('ana', h, ruta, 1, { x: 1, z: 0 }, inv);
  comprobar('la carne cruda se deja en la hoguera', r.ok && fab.estaciones[h].deposito.carne_cruda === 1, r.motivo);
  r = fab.fabricar('ana', 'asar_carne', null, { x: 1, z: 0 }, inv, suelo, T0);
  comprobar('con el fuego apagado no se asa', !r.ok && /apagado/.test(r.motivo), r.motivo);
  inv.meterDonde('taladro_fuego', 1); inv.meterDonde('yesca', 1);
  comprobar('se enciende', fab.encenderFuego('ana', h, { x: 1, z: 0 }, inv, T0).ok);
  r = fab.fabricar('ana', 'asar_carne', null, { x: 1, z: 0 }, inv, suelo, T0);
  comprobar('con el fuego encendido se asa', r.ok, r.motivo);
  r = fab.recoger('ana', h, { x: 1, z: 0 }, inv, T0 + R.s * 1000, suelo);
  const a = inv.buscar(inv.rutasCon('carne_asada')[0] || 'mano:der').cosa;
  comprobar('y se recoge la carne asada, que no lleva hora (no se estropea)', r.ok && inv.cuantos('carne_asada') === 1 && a && !('hasta' in a), JSON.stringify(r));
}

console.log('La carne cruda se estropea');
{
  const inv = jugador(), suelo = new Suelo();
  inv.meterDonde('carne_cruda', 1, undefined, { hasta: T0 + 1000 });
  inv.meterDonde('carne_cruda', 1, undefined, { hasta: T0 + 9000 });
  const rs = inv.rutasCon('carne_cruda');
  comprobar('al juntar dos montones, se queda la hora de la que antes se estropea', rs.length === 1 && inv.buscar(rs[0]).cosa.n === 2 && inv.buscar(rs[0]).cosa.hasta === T0 + 1000, JSON.stringify(rs.map(r => inv.buscar(r).cosa)));
  const s = suelo.soltar(inv, rs[0], 1, 0, 0, T0, 'ana', false);
  const o = suelo.objetos.find(x => x.id === s.objeto);
  comprobar('al soltarla, la del suelo lleva su hora', o && o.cosa.hasta === T0 + 1000, JSON.stringify(o && o.cosa));
  const inv2 = jugador();
  const cg = suelo.coger(inv2, s.objeto, 0, 0, T0, undefined, undefined);
  comprobar('al cogerla, la conserva (no vuelve a empezar)', cg.ok && inv2.buscar(inv2.rutasCon('carne_cruda')[0]).cosa.hasta === T0 + 1000, JSON.stringify(cg));
  const exp = Inventario.importarJugador(inv2.exportarJugador());
  comprobar('y se guarda con ella', exp.buscar(exp.rutasCon('carne_cruda')[0]).cosa.hasta === T0 + 1000);
  // lo que no lleva hora (lo dejado en una estación y vuelto a coger) la recibe al repasarlo
  const inv3 = jugador(); inv3.meterDonde('carne_cruda', 2); inv3.meterDonde('carne_asada', 1);
  let e = estropearInventario(inv3, T0);
  comprobar('la que no lleva hora la recibe al repasarla (desde ahora)', e.cambia && inv3.buscar(inv3.rutasCon('carne_cruda')[0]).cosa.hasta === T0 + VIDA.carne_cruda);
  e = estropearInventario(inv3, T0 + VIDA.carne_cruda - 1);
  comprobar('antes de su hora sigue ahí', !e.cambia && inv3.cuantos('carne_cruda') === 2);
  e = estropearInventario(inv3, T0 + VIDA.carne_cruda);
  comprobar('pasada su hora desaparece de lo que llevas (y dice cuánta)', inv3.cuantos('carne_cruda') === 0 && igual(e.estropeadas, { carne_cruda: 2 }), JSON.stringify(e));
  comprobar('la asada sigue ahí', inv3.cuantos('carne_asada') === 1);
  // dentro de un contenedor también
  const inv4 = jugador(); inv4.lugares.espalda.dentro[3] = { tipo: 'carne_cruda', n: 1, hasta: T0 };
  estropearInventario(inv4, T0 + 1);
  comprobar('la de dentro de la mochila, también', inv4.cuantos('carne_cruda') === 0);
  // en el suelo
  suelo.dejar({ tipo: 'carne_cruda', n: 1, hasta: T0 + 500 }, 5, 5, T0, 'ana', true);
  suelo.dejar({ tipo: 'piel', n: 1 }, 5, 6, T0, 'ana', true);
  const antes = suelo.objetos.length;
  e = estropearSuelo(suelo, T0 + 2000);
  comprobar('la del suelo pasada su hora desaparece; lo demás, no', !suelo.objetos.some(x => x.cosa.tipo === 'carne_cruda') && suelo.objetos.some(x => x.cosa.tipo === 'piel') && suelo.objetos.length === antes - 1, JSON.stringify(e));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
