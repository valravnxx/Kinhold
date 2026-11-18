// Prueba de la carbonera y el carbón (P9, «Oficios del asentamiento»; src/logica/fabricacion.js).
// Lógica pura, sin servidor; y el servidor, que la enciende y la recoge con autor, enseña su humo a todos y la quita
// de todos al deshacerse.
// Ejecutar: node pruebas/prueba_carbonera.mjs
// Comprueba:
//   - la carbonera (10 leñas; fuera) se levanta llevando el palo cavador o la pala de madera (la tierra que la tapa no
//     gasta material; las herramientas no se gastan); sin ninguna de las dos, no;
//   - se enciende dejando en ella la yesca y llevando el taladro de fuego (no se gasta); sin él o sin yesca, no;
//   - arde horas reales (por tiempo transcurrido) y deja 4 carbones vegetales, que solo recoge quien la encendió;
//   - una vez encendida, no se vuelve a encender ni se desmonta; recogido el carbón, se deshace (no queda nada);
//   - la cadena: la leña sale de partir un tronco corto con el hacha;
//   - el servidor manda a todos que arde (para el humo), sin decir de quién es, y la quita al deshacerse.
// MUTAR=1: la carbonera no se deshace al sacar el carbón: tiene que FALLAR.
import { Fabricacion, RECETAS, ESTACIONES, USOS, MAX_RATO_ESTACION, CARBONEAR, CARBONES } from '../src/logica/fabricacion.js';
import { Inventario, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';
import { TROCEO } from '../src/logica/troceo.js';

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
if (MUTAR === '1') delete ESTACIONES.carbonera.seDeshace;
const T0 = Date.UTC(2026, 10, 18, 13, 0, 0);
const AQUI = { x: 1, z: 0 };
const dejarLena = (suelo, n) => { for (let i = 0; i < n; i++) suelo.dejar({ tipo: 'lena', n: 1 }, 0.4 + (i % 5) * 0.2, (Math.floor(i / 5) - 0.5) * 0.3, T0, 'ana', false); };

console.log('Lo que dice la tarea');
{
  const E = ESTACIONES.carbonera, R = RECETAS.carbonear;
  comprobar('la carbonera: 10 leñas, cavando con el palo cavador o la pala de madera; fuera; da el carbonear', E && igual(E.coste, { lena: 10 }) && igual(E.requiere, ['palo_cavador', 'pala_madera']) && E.donde === 'fuera' && E.uso === 'carbonear' && igual(USOS.carbonear.estaciones, ['carbonera']), JSON.stringify(E));
  comprobar('encendida con la yesca y el taladro de fuego, da 4 carbones vegetales', R && R.uso === 'carbonear' && igual(R.gasta, { yesca: 1 }) && R.da === 'carbon' && R.n === 4 && CARBONES === 4 && igual(R.requiere, ['taladro_fuego']), JSON.stringify(R));
  comprobar('tarda horas reales (4 h, provisional), echa humo y se enciende una vez', R.s === CARBONEAR && CARBONEAR >= 3600 && E.humea && E.carga === 1 && E.seDeshace);
  comprobar('el carbón vegetal está en el catálogo', CATALOGO.carbon && CATALOGO.carbon.recurso);
  comprobar('la leña sale de partir un tronco corto con el hacha', TROCEO.tronco_corto && TROCEO.tronco_corto.accion === 'partir' && TROCEO.tronco_corto.da === 'lena', JSON.stringify(TROCEO.tronco_corto));
  comprobar('el palo cavador y la pala de madera se hacen', RECETAS.palo_cavador && Object.values(RECETAS).some(r => r.da === 'pala_madera'));
}

console.log('Levantarla, encenderla y sacar el carbón');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const r0 = fab.colocar('ana', 'carbonera', 0, 0);
  comprobar('se pone su marco en cualquier sitio de fuera', r0.ok, r0.motivo);
  comprobar('bajo techo, no', !fab.colocar('ana', 'carbonera', 5, 5, true).ok);
  const s = r0.id;
  dejarLena(suelo, 10);
  fab.entregarEstacion('ana', s, { x: 0, z: 0 }, inv, suelo, T0);
  comprobar('se le llevan las 10 leñas del suelo de al lado', !Object.keys(fab.faltaEstacion(fab.estaciones[s])).length, JSON.stringify(fab.faltaEstacion(fab.estaciones[s])));
  let t = fab.trabajarEstacion('ana', s, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('sin palo cavador ni pala, no se tapa de tierra', !t.ok && /palo cavador|pala/i.test(t.motivo || ''), t.motivo);
  inv.meterDonde('pala_madera', 1);
  for (let i = 0; i < 20 && fab.estaciones[s].obra; i++) fab.trabajarEstacion('ana', s, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('con la pala de madera, se levanta; la pala no se gasta', !fab.estaciones[s].obra && inv.cuantos('pala_madera') === 1, JSON.stringify(fab.estaciones[s].obra || {}));
  inv.meterDonde('taladro_fuego', 1);
  let r = fab.fabricar('ana', 'carbonear', null, AQUI, inv, suelo, T0);
  comprobar('sin yesca dejada en ella, no se enciende', !r.ok && /yesca/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('yesca', 2);
  const dp2 = fab.depositar('ana', s, inv.rutasCon('yesca')[0], 2, AQUI, inv);
  const dp = fab.depositar('ana', s, inv.rutasCon('yesca')[0], 1, AQUI, inv);
  comprobar('solo cabe una yesca', !dp2.ok && dp.ok && fab.estaciones[s].deposito.yesca === 1, JSON.stringify([dp2, dp]));
  inv.meterDonde('lena', 1);
  comprobar('y nada más que la yesca', !fab.depositar('ana', s, inv.rutasCon('lena')[0], 1, AQUI, inv).ok);
  const taladro = inv.rutasCon('taladro_fuego')[0]; inv.sacar(taladro);
  r = fab.fabricar('ana', 'carbonear', null, AQUI, inv, suelo, T0);
  comprobar('sin el taladro de fuego, no se enciende', !r.ok && /taladro/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('taladro_fuego', 1);
  r = fab.fabricar('ana', 'carbonear', null, AQUI, inv, suelo, T0);
  comprobar('con la yesca y el taladro, se enciende; el taladro no se gasta', r.ok && !fab.estaciones[s].deposito.yesca && inv.cuantos('taladro_fuego') === 1, r.motivo);
  inv.meterDonde('yesca', 1); fab.depositar('ana', s, inv.rutasCon('yesca')[0], 1, AQUI, inv);
  const otra = fab.fabricar('ana', 'carbonear', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('ya encendida, no se vuelve a encender', !otra.ok && /ya arde/.test(otra.motivo || ''), otra.motivo);
  const d = fab.desmontarEstacion('ana', s, AQUI, suelo, T0 + 1000);
  comprobar('mientras arde no se desmonta', !d.ok, d.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + CARBONEAR * 1000 - 1, suelo);
  comprobar('antes de su hora no hay carbón', !r.ok && inv.cuantos('carbon') === 0, r.motivo);
  r = fab.recoger('bea', s, AQUI, jugador(), T0 + CARBONEAR * 1000, suelo);
  comprobar('a su hora, otro no se lo lleva', !r.ok, r.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + CARBONEAR * 1000, suelo);
  comprobar('a su hora, quien la encendió saca 4 carbones vegetales', r.ok && inv.cuantos('carbon') === 4, JSON.stringify(r));
  comprobar('y la carbonera se deshace: no queda nada de ella', r.deshecha === s && !fab.estaciones[s], JSON.stringify(Object.keys(fab.estaciones)));
  const sin = new Fabricacion(), inv2 = jugador();
  inv2.meterDonde('yesca', 1); inv2.meterDonde('taladro_fuego', 1);
  const r2 = sin.fabricar('ana', 'carbonear', null, AQUI, inv2, new Suelo(), T0);
  comprobar('sin carbonera, no (ni con las manos)', !r2.ok && inv2.cuantos('yesca') === 1, r2.motivo);
}

console.log('Por el servidor, con autor; el humo, para todos; deshecha, para todos');
{
  const pos = { ana: { x: 1, z: 0 }, bea: { x: 1.5, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'carbonera', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantada
  const ana = o.invs.de('ana'), T = Date.now();
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  for (const [t, n] of [['yesca', 1], ['taladro_fuego', 1]]) ana.meterDonde(t, n);
  let r = o.ejecutar({ autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon('yesca')[0], cantidad: 1, x: 1, z: 0 }, T);
  comprobar('Ana deja la yesca en la carbonera', r.ok, r.motivo);
  let vista = o.estacionesVisibles(null, T).find(e => e.id === id);
  comprobar('apagada, no se ve que arda', vista && igual(vista.colgado, []), JSON.stringify(vista));
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'carbonear', estacion: id, x: 1, z: 0 }, T);
  comprobar('y la enciende', r.ok, r.motivo);
  vista = o.estacionesVisibles(null, T + 1000).find(e => e.id === id);
  comprobar('todos ven que arde (lo que le queda), sin saber de quién es', vista && vista.colgado.length === 1 && vista.colgado[0].queda > 0 && !JSON.stringify(vista.colgado).includes('ana'), JSON.stringify(vista && vista.colgado));
  r = o.ejecutar({ autor: 'bea', tipo: 'recoger_fabricado', estacion: id, x: 1.5, z: 0 }, T + CARBONEAR * 1000);
  comprobar('Bea no se lleva el carbón de Ana', !r.ok && o.invs.de('bea').cuantos('carbon') === 0, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + CARBONEAR * 1000);
  comprobar('Ana saca sus 4 carbones', r.ok && ana.cuantos('carbon') === 4, r.motivo);
  comprobar('y la carbonera deshecha ya no la ve nadie', !o.estacionesVisibles(null, T + CARBONEAR * 1000).some(e => e.id === id));
  const ultima = o.registro.entradas[o.registro.entradas.length - 1];
  comprobar('el registro dice quién la deshizo', ultima && ultima.autor === 'ana' && ultima.resultado && ultima.resultado.deshecha === id, JSON.stringify(ultima && ultima.resultado));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
