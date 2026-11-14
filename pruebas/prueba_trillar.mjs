// La era, trillar y cribar el grano (P11, la granja básica). Ejecutar: node pruebas/prueba_trillar.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/fabricacion.js, src/logica/objetos_red.js): la
// era (8 piedras, fuera y en tu tierra) se levanta como obra; en ella, cada gavilla (dejada en ella, como en las demás
// estaciones), con el mayal en lo que llevas (no se gasta), da 1 puñado de grano sin limpiar y 1 haz de paja; sin mayal o sin
// era, no; con la criba de grano en lo que llevas (1 piel limpia y 1 vara en el banco de tronco; no se gasta), cada
// puñado de grano sin limpiar se criba con las manos y da 1 grano de cebada limpio (el que se siembra); sin criba, no; la paja ya no se esconde (el tejado de paja, la cama de paja) y va al almiar; y por el servidor,
// con el autor y mirando que estés cerca.
// Con MUTAR=1 trillar no da paja y cribar no pide la criba: debe FALLAR.
import { Fabricacion, RECETAS, ESTACIONES, MAX_RATO_ESTACION, guardaTipo } from '../src/logica/fabricacion.js';
import { Inventario } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { PIEZAS, DECORACION, enEsteTramo } from '../src/logica/piezas.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

if (process.env.MUTAR === '1') { delete RECETAS.trillar.tambien; delete RECETAS.cribar.requiere; }
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function jugador() {
  const inv = Inventario.inicial();
  inv.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  inv.lugares.espalda = { tipo: 'fardo', n: 1, dentro: Array(4).fill(null) };
  return inv;
}
const T0 = Date.UTC(2026, 10, 13, 6, 0, 0);

console.log('La era');
{
  const E = ESTACIONES.era, R = RECETAS.trillar;
  comprobar('la era: 8 piedras, fuera y en tu tierra; trilla', igual(E.coste, { piedra: 8 }) && E.donde === 'fuera' && E.tierra && E.uso === 'trillar', JSON.stringify(E));
  comprobar('trillar: 1 gavilla, con el mayal (no se gasta), da 1 grano sin limpiar y 1 paja', R.uso === 'trillar' && igual(R.gasta, { gavilla: 1 }) && R.da === 'grano_sucio' && R.n === 1 && igual(R.requiere, ['mayal']) && igual(R.tambien, { paja: 1 }), JSON.stringify(R));
  const fab = new Fabricacion();
  comprobar('bajo techo no', !fab.puedeColocar('era', 0, 0, true).ok);
  const r = fab.puedeColocar('era', 0, 0, false, false);
  comprobar('fuera de tu tierra no, y lo dice', !r.ok && r.motivo === 'La era va en tu tierra (o en la de quien te invita).', r.motivo);
}

console.log('Trillar en la era');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador(), aqui = { x: 1, z: 0 };
  for (let i = 0; i < 8; i++) suelo.dejar({ tipo: 'piedra', n: 1 }, 0.4 + (i % 4) * 0.2, 0.3 + Math.floor(i / 4) * 0.2, T0, 'ana', true);
  const e = fab.colocar('ana', 'era', 0, 0).id;
  fab.entregarEstacion('ana', e, aqui, inv, suelo, T0);
  for (let i = 0; i < 20 && fab.estaciones[e].obra; i++) fab.trabajarEstacion('ana', e, MAX_RATO_ESTACION, aqui, inv);
  comprobar('se levanta con las 8 piedras del suelo', !fab.estaciones[e].obra && !suelo.objetos.some(o => o.cosa.tipo === 'piedra'), JSON.stringify(fab.estaciones[e].obra));
  inv.meterDonde('gavilla', 2);   // las gavillas, segadas y traídas en el fardo
  let r = fab.depositar('ana', e, inv.rutasCon('gavilla')[0], 2, aqui, inv);
  comprobar('las gavillas se dejan en la era (sus recetas gastan de ahí)', r.ok && fab.estaciones[e].deposito.gavilla === 2, r.motivo);
  r = fab.fabricar('ana', 'trillar', e, aqui, inv, suelo, T0);
  comprobar('sin el mayal no se trilla, y lo dice', !r.ok && /mayal/i.test(r.motivo || ''), r.motivo);
  inv.lugares['mano:der'] = { tipo: 'mayal', n: 1 };
  r = fab.fabricar('ana', 'trillar', e, aqui, inv, suelo, T0);
  comprobar('con el mayal, se trilla una de las gavillas dejadas', r.ok && fab.estaciones[e].deposito.gavilla === 1, r.motivo);
  r = fab.recoger('ana', e, aqui, inv, T0 + RECETAS.trillar.s * 1000, suelo);
  const enSuelo = t => suelo.objetos.filter(o => o.cosa.tipo === t).reduce((n, o) => n + o.cosa.n, 0);
  const grano = inv.cuantos('grano_sucio') + enSuelo('grano_sucio'), paja = inv.cuantos('paja') + enSuelo('paja');
  comprobar('da 1 grano sin limpiar y 1 haz de paja (aún no grano de cebada)', r.ok && grano === 1 && paja === 1 && inv.cuantos('semilla_cebada') + enSuelo('semilla_cebada') === 0, `${JSON.stringify(r)} grano ${grano}, paja ${paja}`);
  comprobar('el mayal no se gasta', inv.cuantos('mayal') === 1);
  const fab2 = new Fabricacion(), inv2 = jugador();
  inv2.lugares['mano:der'] = { tipo: 'mayal', n: 1 };
  inv2.meterDonde('gavilla', 1);
  r = fab2.fabricar('ana', 'trillar', null, aqui, inv2, new Suelo(), T0);
  comprobar('sin era no se trilla', !r.ok, r.motivo);
}

console.log('Cribar el grano');
{
  const R = RECETAS.cribar, C = RECETAS.criba_grano;
  comprobar('la criba de grano: 1 piel limpia y 1 vara en el banco de tronco, con la lasca', C.uso === 'banco' && igual(C.gasta, { piel_limpia: 1, vara: 1 }) && C.da === 'criba_grano' && igual(C.requiere, ['lasca_silex']), JSON.stringify(C));
  comprobar('cribar: con las manos, 1 grano sin limpiar da 1 grano de cebada, con la criba (no se gasta)', R.uso === 'manos' && igual(R.gasta, { grano_sucio: 1 }) && R.da === 'semilla_cebada' && R.n === 1 && igual(R.requiere, ['criba_grano']), JSON.stringify(R));
  comprobar('el grano sin limpiar va al cesto y no al almiar; la paja, al almiar y no al cesto', guardaTipo('cesto', 'grano_sucio') && !guardaTipo('almiar', 'grano_sucio') && guardaTipo('almiar', 'paja') && !guardaTipo('cesto', 'paja'));
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador(), aqui = { x: 0, z: 0 };
  inv.meterDonde('grano_sucio', 2);
  let r = fab.fabricar('ana', 'cribar', null, aqui, inv, suelo, T0);
  comprobar('sin la criba no se criba, y dice qué hace falta', !r.ok && /criba de grano/i.test(r.motivo || ''), r.motivo);
  const l = fab.lista(aqui, inv, suelo, T0).find(x => x.receta === 'cribar');
  comprobar('el panel la enseña casi, sin herramienta', l && l.grupo === 'casi' && l.sinHerramienta, JSON.stringify(l));
  inv.lugares[inv.lugares['mano:der'] ? 'mano:izq' : 'mano:der'] = { tipo: 'criba_grano', n: 1 };   // (en la mano libre)
  r = fab.fabricar('ana', 'cribar', null, aqui, inv, suelo, T0);
  comprobar('con la criba, en cualquier sitio, se criba un puñado', r.ok && inv.cuantos('grano_sucio') === 1, r.motivo);
  r = fab.recoger('ana', null, aqui, inv, T0 + R.s * 1000, suelo);
  comprobar('y da 1 grano de cebada limpio, el que se siembra', r.ok && inv.cuantos('semilla_cebada') === 1, JSON.stringify(r));
  comprobar('la criba no se gasta', inv.cuantos('criba_grano') === 1);
}

console.log('La paja, ya a la vista');
{
  comprobar('el tejado de paja se enseña (en este tramo)', enEsteTramo(PIEZAS.tejado_paja) && enEsteTramo(PIEZAS.remate_paja));
  comprobar('la cama de paja también', enEsteTramo(DECORACION.cama_paja));
  comprobar('la paja va al almiar', guardaTipo('almiar', 'paja'));
  comprobar('lo de después sigue escondido (la teja, lo de tablas)', !enEsteTramo(PIEZAS.tejado_teja || { coste: { teja: 1 } }) && !enEsteTramo(DECORACION.cama_madera));
}

console.log('Por el servidor, con su autor');
{
  const pos = { ana: { x: 1, z: 0 }, bruno: { x: 40, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'era', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantada
  const T = Date.now();
  o.fab.estaciones[id].deposito = { gavilla: 1 };
  for (const a of ['ana', 'bruno']) o.invs.de(a).lugares['mano:der'] = { tipo: 'mayal', n: 1 };
  let r = o.ejecutar({ autor: 'bruno', tipo: 'fabricar', receta: 'trillar', estacion: id, x: 40, z: 0 }, T);
  comprobar('lejos de la era, no', !r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'trillar', estacion: id, x: 1, z: 0 }, T);
  comprobar('cerca, se encarga', r.ok && !o.fab.estaciones[id].deposito.gavilla, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + RECETAS.trillar.s * 1000);
  const ana = o.invs.de('ana');
  const dado = t => (r.dados || []).filter(d => d.objeto === t).reduce((n, d) => n + d.cantidad, 0);   // (lo que no cabe, al suelo a sus pies)
  comprobar('y se recoge: grano sin limpiar y paja', r.ok && dado('grano_sucio') === 1 && dado('paja') === 1 && ana.cuantos('grano_sucio') === 1, `${JSON.stringify(r)} ${ana.cuantos('grano_sucio')} ${ana.cuantos('paja')}`);
  ana.lugares['mano:der'] = { tipo: 'criba_grano', n: 1 };
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'cribar', x: 1, z: 0 }, T + 60000);
  comprobar('con la criba, cribar se encarga en el servidor', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', x: 1, z: 0 }, T + 60000 + RECETAS.cribar.s * 1000);
  comprobar('y da el grano de cebada limpio', r.ok && ana.cuantos('semilla_cebada') === 1 && ana.cuantos('grano_sucio') === 0, `${JSON.stringify(r)} ${ana.cuantos('semilla_cebada')}`);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
