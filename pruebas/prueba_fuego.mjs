// El fuego de la hoguera (P3, «De nada a una casa»): se levanta apagada con sus ramas puestas, se enciende con yesca y
// el taladro de fuego, arde un rato por cada rama o leña que se le echa, se apaga sola y quedan las cenizas; da calor
// cerca; sus recetas lo piden encendido; y por el servidor, con su autor, todos la ven igual.
// Y el hogar de la casa (8 nov): el mismo fuego, solo dentro, más duradero y que se deja en brasas.
// Ejecutar: node pruebas/prueba_fuego.mjs   (con MUTAR=1 el fuego no se apaga nunca: debe FALLAR)
import { ARDE, FUEGO_MAX, RAMAS_HOGUERA, RADIO_CALOR, BRASAS_LENTO, COMO, fuegoNuevo, estadoFuego, echar, encender, calorEn, limpiarFuego, dejarEnBrasas, avivar } from '../src/logica/fuego.js';
import { ESTACIONES, Fabricacion, ejecutarFabricacion, MAX_RATO_ESTACION, migrarFabricacion } from '../src/logica/fabricacion.js';
import { Inventario, Inventarios } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 10, 7, 18, 0, 0), MIN = 60e3;
// con MUTAR, el estado dice que sigue encendida aunque haya pasado su hora (como si se rompiera el apagarse sola)
const estado = MUTAR ? (f, t) => ({ ...estadoFuego(f, t), encendida: f.hasta > 0 || estadoFuego(f, t).encendida }) : estadoFuego;
function jugador() {
  const inv = Inventario.inicial();
  inv.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  inv.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  return inv;
}
function levantar(fab, autor, x, z, inv, tipo = 'hoguera') {
  const r = fab.colocar(autor, tipo, x, z, tipo === 'hogar'); if (!r.ok) throw new Error(r.motivo);
  for (const [t, n] of Object.entries(ESTACIONES[tipo].coste)) inv.meterDonde(t, n);
  const e = fab.entregarEstacion(autor, r.id, { x, z }, inv, null, T0); if (!e.ok) throw new Error(e.motivo);
  for (let i = 0; i < 10 && fab.estaciones[r.id].obra; i++) fab.trabajarEstacion(autor, r.id, MAX_RATO_ESTACION, { x, z }, inv);
  if (fab.estaciones[r.id].obra) throw new Error(tipo + ' no se levanta');
  return r.id;
}

console.log('El fuego, solo');
{
  comprobar('la hoguera tiene fuego; las otras estaciones no', ESTACIONES.hoguera.fuego === true && !ESTACIONES.piedra_tallar.fuego && !ESTACIONES.banco_tronco.fuego);
  comprobar('sus ramas puestas son las de su coste', RAMAS_HOGUERA === ESTACIONES.hoguera.coste.rama);
  const f = fuegoNuevo();
  comprobar('recién hecha: apagada, sin cenizas, con 12 min de ramas puestas', !estado(f, T0).encendida && !estado(f, T0).cenizas && f.combustible === 4 * ARDE.rama && ARDE.rama === 180, JSON.stringify(f));
  let r = encender(f, T0);
  comprobar('se enciende: arde lo que tenía puesto', r.ok && f.hasta === T0 + 12 * MIN && f.combustible === 0 && estado(f, T0 + MIN).encendida, JSON.stringify(f));
  comprobar('encendida no se vuelve a encender', !encender(f, T0 + MIN).ok);
  r = echar(f, 'lena', T0 + MIN);
  comprobar('una leña la hace arder 10 min más', r.ok && r.encendida && f.hasta === T0 + 22 * MIN && ARDE.lena === 600);
  comprobar('a los 21 min sigue ardiendo; le queda 1 min', estado(f, T0 + 21 * MIN).encendida && Math.abs(estado(f, T0 + 21 * MIN).queda - 60) < 1e-6);
  const st = estado(f, T0 + 23 * MIN);
  comprobar('a los 23 min se ha apagado sola y quedan cenizas', !st.encendida && st.cenizas, JSON.stringify(st));
  comprobar('sin nada puesto no se enciende', !encender(f, T0 + 23 * MIN).ok && /échale/.test(encender(f, T0 + 23 * MIN).motivo));
  r = echar(f, 'rama', T0 + 24 * MIN);
  comprobar('apagada, la rama queda puesta (sigue apagada, con cenizas)', r.ok && !r.encendida && f.combustible === 180 && f.hasta === 0 && estado(f, T0 + 24 * MIN).cenizas);
  comprobar('y se vuelve a encender', encender(f, T0 + 25 * MIN).ok && estado(f, T0 + 27 * MIN).encendida && !estado(f, T0 + 27 * MIN).cenizas);
  comprobar('al fuego solo van ramas o leña', !echar(f, 'piedra', T0 + 25 * MIN).ok && !echar(f, 'toString', T0 + 25 * MIN).ok);
  const g = fuegoNuevo();
  let n = 0; while (echar(g, 'lena', T0).ok && n < 20) n++;
  comprobar(`como mucho ${FUEGO_MAX / 60} min por delante`, g.combustible <= FUEGO_MAX && g.combustible + ARDE.lena > FUEGO_MAX && n === 4, `${n} leñas, ${g.combustible} s`);
  comprobar('lo guardado raro se limpia', JSON.stringify(limpiarFuego({ hasta: -5, combustible: 1e9, cenizas: 1 })) === JSON.stringify({ hasta: 0, combustible: FUEGO_MAX, cenizas: true }) && limpiarFuego(null).combustible === 720);
  const est = [{ x: 0, z: 0, fuego: { hasta: T0 + MIN, combustible: 0, cenizas: false } }, { x: 10, z: 0, fuego: { hasta: 0, combustible: 720, cenizas: false } }];
  comprobar('calor: 1 junto al fuego, la mitad a 2 m, nada a 4 m', calorEn(est, 0, 0, T0) === 1 && Math.abs(calorEn(est, 2, 0, T0) - 0.5) < 1e-9 && calorEn(est, RADIO_CALOR, 0, T0) === 0);
  comprobar('la apagada no calienta, ni la que ya se ha apagado', calorEn(est, 10, 0, T0) === 0 && calorEn(est, 0, 0, T0 + 2 * MIN) === 0);
}

console.log('En la hoguera: encender, echar leña y las recetas al fuego');
{
  const fab = new Fabricacion(), inv = jugador(), yo = { x: 0.5, z: 0 };
  const id = levantar(fab, 'ana', 0, 0, inv);
  const e = fab.estaciones[id];
  comprobar('levantada: tiene su fuego, apagado y con sus ramas', e.fuego && !estado(e.fuego, T0).encendida && e.fuego.combustible === 720, JSON.stringify(e.fuego));
  let r = fab.encenderFuego('ana', id, yo, inv, T0);
  comprobar('sin taladro ni yesca no se enciende', !r.ok && /taladro/.test(r.motivo), r.motivo);
  inv.meterDonde('taladro_fuego', 1);
  r = fab.encenderFuego('ana', id, yo, inv, T0);
  comprobar('con el taladro pero sin yesca, tampoco', !r.ok && /yesca/.test(r.motivo), r.motivo);
  inv.meterDonde('yesca', 2);
  r = fab.encenderFuego('ana', id, { x: 9, z: 0 }, inv, T0);
  comprobar('de lejos, no', !r.ok && /lejos/.test(r.motivo), r.motivo);
  r = fab.encenderFuego('ana', id, yo, inv, T0);
  comprobar('con yesca y taladro, se enciende: gasta 1 yesca y el taladro sigue', r.ok && inv.cuantos('yesca') === 1 && inv.cuantos('taladro_fuego') === 1 && estado(e.fuego, T0 + 1).encendida, r.motivo);
  inv.meterDonde('rama', 1);
  r = fab.echarFuego('ana', id, 'rama', yo, inv, T0);
  comprobar('le echa una rama de lo que lleva: arde 3 min más', r.ok && inv.cuantos('rama') === 0 && e.fuego.hasta === T0 + 15 * MIN, r.motivo);
  r = fab.echarFuego('ana', id, 'lena', yo, inv, T0);
  comprobar('sin leña encima, no echa nada', !r.ok && /No llevas/.test(r.motivo), r.motivo);
  // la lanza al fuego, con su rama depositada
  inv.meterDonde('rama', 2);
  fab.depositar('ana', id, inv.rutasCon('rama')[0], 2, yo, inv);
  r = fab.fabricar('ana', 'lanza_endurecida', id, yo, inv, null, T0 + MIN);
  comprobar('encendida, se endurece la lanza al fuego', r.ok, r.motivo);
  r = fab.fabricar('ana', 'lanza_endurecida', id, yo, inv, null, T0 + 16 * MIN);
  comprobar('apagada sola (a los 15 min), ya no', !r.ok && /apagado/.test(r.motivo), r.motivo);
  comprobar('y en la lista sale casi, con el fuego apagado', fab.lista(yo, inv, null, T0 + 16 * MIN).find(x => x.receta === 'lanza_endurecida').grupo === 'casi');
  const datos = JSON.parse(JSON.stringify(fab.exportar()));
  const otra = new Fabricacion().importar(datos);
  comprobar('el fuego se guarda y se carga', JSON.stringify(otra.estaciones[id].fuego) === JSON.stringify(e.fuego));
  const v5 = { ...datos, version: 5, estaciones: datos.estaciones.map(({ fuego, ...x }) => x) };
  const m = migrarFabricacion(JSON.parse(JSON.stringify(v5)));
  comprobar('un guardado de antes del fuego: la hoguera, apagada y con sus ramas puestas', m && m.version === 6 && m.estaciones[0].fuego && m.estaciones[0].fuego.combustible === 720 && new Fabricacion().importar(v5).estaciones[id].fuego.combustible === 720);
}

console.log('El hogar de la casa: solo dentro, más duradero y en brasas');
{
  const H = ESTACIONES.hogar;
  comprobar('el hogar es del fuego, solo dentro, de piedra y barro', H && H.fuego && H.uso === 'fuego' && H.donde === 'dentro' && H.coste.piedra === 8 && H.coste.barro === 2, JSON.stringify(H && H.coste));
  const fab = new Fabricacion(), inv = jugador(), yo = { x: 0.5, z: 0 };
  comprobar('fuera de la casa no se pone', !fab.colocar('ana', 'hogar', 5, 5, false).ok);
  const id = levantar(fab, 'ana', 0, 0, inv, 'hogar'), e = fab.estaciones[id];
  comprobar('levantado: apagado y sin nada puesto (es de piedra y barro)', e.fuego && e.fuego.combustible === 0 && !estado(e.fuego, T0).encendida, JSON.stringify(e.fuego));
  inv.meterDonde('lena', 1); inv.meterDonde('taladro_fuego', 1); inv.meterDonde('yesca', 1);
  let r = fab.echarFuego('ana', id, 'lena', yo, inv, T0);
  comprobar('una leña en el hogar arde 15 min (1,5 veces más que en la hoguera)', r.ok && e.fuego.combustible === ARDE.lena * 1.5, JSON.stringify(e.fuego));
  r = fab.encenderFuego('ana', id, yo, inv, T0);
  comprobar('se enciende con yesca y taladro', r.ok && inv.cuantos('yesca') === 0 && e.fuego.hasta === T0 + 15 * MIN, r.motivo);
  const g = fuegoNuevo('hogar'); let n = 0; while (echar(g, 'lena', T0, 'hogar').ok && n < 30) n++;
  comprobar('le caben 2 h por delante (la hoguera, 1 h)', COMO.hogar.max === 2 * FUEGO_MAX && g.combustible <= 2 * FUEGO_MAX && n === 8, `${n} leñas`);
  comprobar('la hoguera no se deja en brasas', !dejarEnBrasas({ hasta: T0 + MIN, combustible: 0 }, T0, 'hoguera').ok);
  r = ejecutarFabricacion(fab, { de: () => inv }, { anotar: (a, res) => ({}) }, { autor: 'ana', tipo: 'brasas_fuego', estacion: id, x: 0.5, z: 0 }, T0 + 5 * MIN);
  const st = estado(e.fuego, T0 + 5 * MIN + 1);
  comprobar(`en brasas: sin llama, y los 10 min que le quedaban duran ${BRASAS_LENTO} veces más (40 min)`, r.ok && st.brasas && !st.encendida && e.fuego.hasta === T0 + 45 * MIN, JSON.stringify({ r, f: e.fuego }));
  inv.meterDonde('rama', 1);
  fab.depositar('ana', id, inv.rutasCon('rama')[0], 1, yo, inv);
  r = fab.fabricar('ana', 'lanza_endurecida', id, yo, inv, null, T0 + 6 * MIN);
  comprobar('con brasas no se fabrica (hace falta llama)', !r.ok && /apagado/.test(r.motivo), r.motivo);
  comprobar('las brasas calientan la mitad', Math.abs(calorEn([{ x: 0, z: 0, fuego: e.fuego }], 0, 0, T0 + 6 * MIN) - 0.5) < 1e-9);
  comprobar('mientras hay brasas no se desmonta', !fab.desmontarEstacion('ana', id, yo, null, T0 + 6 * MIN).ok);
  const guard = new Fabricacion().importar(JSON.parse(JSON.stringify(fab.exportar())));
  comprobar('las brasas se guardan y se cargan', guard.estaciones[id].fuego.brasas === true && guard.estaciones[id].fuego.hasta === e.fuego.hasta);
  r = fab.encenderFuego('ana', id, yo, inv, T0 + 25 * MIN);
  comprobar('se aviva sin yesca ni nada: vuelve la llama con lo que quedaba (20 min de brasas son 5 de llama)', r.ok && r.avivada && inv.cuantos('yesca') === 0 && estado(e.fuego, T0 + 25 * MIN + 1).encendida && e.fuego.hasta === T0 + 30 * MIN, JSON.stringify(e.fuego));
  comprobar('avivado, ya se fabrica', fab.fabricar('ana', 'lanza_endurecida', id, yo, inv, null, T0 + 26 * MIN).ok);
  const b = { hasta: T0 + MIN, combustible: 0, cenizas: false }; dejarEnBrasas(b, T0, 'hogar');
  const sb = estado(b, T0 + 5 * MIN);
  comprobar('si se acaban las brasas, se apaga: cenizas', !sb.encendida && !sb.brasas && sb.cenizas && !avivar(b, T0 + 5 * MIN).ok);
}

console.log('Con autor, en el registro');
{
  const fab = new Fabricacion(), invs = new Inventarios(), reg = new RegistroAcciones();
  const ana = invs.de('ana'); ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  const id = levantar(fab, 'ana', 0, 0, ana);
  ana.meterDonde('taladro_fuego', 1); ana.meterDonde('yesca', 1); ana.meterDonde('lena', 1);
  let r = ejecutarFabricacion(fab, invs, reg, { tipo: 'encender_fuego', estacion: id, x: 0, z: 0 }, T0);
  comprobar('sin autor no vale', !r.ok && /autor/.test(r.motivo));
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'blas', tipo: 'encender_fuego', estacion: id, x: 0, z: 0 }, T0);
  comprobar('Blas no la enciende con la yesca de Ana', !r.ok && ana.cuantos('yesca') === 1, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'encender_fuego', estacion: id, x: 0, z: 0, hasta: 9e15 }, T0);
  comprobar('Ana la enciende; la hora la pone quien valida', r.ok && fab.estaciones[id].fuego.hasta === T0 + 12 * MIN, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'echar_fuego', estacion: id, objeto: 'lena', x: 0, z: 0 }, T0);
  comprobar('y le echa su leña', r.ok && ana.cuantos('lena') === 0, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'echar_fuego', estacion: id, x: 0, z: 0 }, T0);
  comprobar('echar sin decir qué: datos no válidos', !r.ok && /no válidos/.test(r.motivo), r.motivo);
  const l = reg.entradas.slice(-3);
  comprobar('el registro anota lo encendido (con la yesca gastada) y lo echado', l[0].resultado && l[0].resultado.encendida && l[0].resultado.gastado.yesca === 1 && l[1].resultado.echado.lena === 1 && l[1].resultado.ardiendo, JSON.stringify(l.map(x => x.resultado)));
}

console.log('Por el servidor: todos la ven igual, y en tierra de otro no se toca');
{
  const pos = { ana: { x: 0.5, z: 0 }, blas: { x: 0.5, z: 0.5 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null, puedeTocar: (a) => a === 'blas' ? { ok: false, motivo: 'Es tierra de otro.' } : { ok: true } });
  const ana = o.invs.de('ana'); ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  const id = levantar(o.fab, 'ana', 0, 0, ana);
  ana.meterDonde('taladro_fuego', 1); ana.meterDonde('yesca', 1);
  const T = Date.now();
  let r = o.ejecutar({ autor: 'ana', tipo: 'encender_fuego', estacion: id, x: 0.5, z: 0 }, T);
  comprobar('Ana la enciende por el servidor y se manda a todos', r.ok && r.estaciones, r.motivo);
  const v = o.estacionesVisibles(null, T + 60e3).find(e => e.id === id);
  comprobar('lo que ven todos: encendida, con lo que le queda (no la hora del servidor)', v && v.fuego && v.fuego.encendida && Math.abs(v.fuego.queda - 11 * 60) < 1 && !('hasta' in v.fuego), JSON.stringify(v && v.fuego));
  const v2 = o.estacionesVisibles(null, T + 13 * MIN).find(e => e.id === id);
  comprobar('pasada su hora, la ven apagada y con cenizas', v2.fuego && !v2.fuego.encendida && v2.fuego.cenizas, JSON.stringify(v2.fuego));
  const blas = o.invs.de('blas'); blas.meterDonde('rama', 1);
  r = o.ejecutar({ autor: 'blas', tipo: 'echar_fuego', estacion: id, objeto: 'rama', x: 0.5, z: 0.5 }, T);
  comprobar('Blas, en tierra de otro, no le echa nada', !r.ok && blas.cuantos('rama') === 1, r.motivo);
  const g = new ObjetosServidor(); g.importar(JSON.parse(JSON.stringify(o.exportar())));
  comprobar('el servidor la guarda encendida y la carga igual', g.fab.estaciones[id] && g.fab.estaciones[id].fuego.hasta === o.fab.estaciones[id].fuego.hasta);
  // el hogar, por el servidor: dejarlo en brasas y lo que ven todos
  const h = levantar(o.fab, 'ana', 3, 0, ana, 'hogar'); ana.meterDonde('lena', 1); ana.meterDonde('yesca', 1);
  pos.ana = { x: 3.5, z: 0 };
  o.ejecutar({ autor: 'ana', tipo: 'echar_fuego', estacion: h, objeto: 'lena', x: 3.5, z: 0 }, T);
  o.ejecutar({ autor: 'ana', tipo: 'encender_fuego', estacion: h, x: 3.5, z: 0 }, T);
  r = o.ejecutar({ autor: 'ana', tipo: 'brasas_fuego', estacion: h, x: 3.5, z: 0 }, T);
  const vh = o.estacionesVisibles(null, T + MIN).find(e => e.id === h);
  comprobar('Ana deja el hogar en brasas por el servidor y todos lo ven en brasas', r.ok && r.estaciones && vh.fuego.brasas && !vh.fuego.encendida && Math.abs(vh.fuego.queda - (15 * 60 * BRASAS_LENTO - 60)) < 1, JSON.stringify(vh && vh.fuego));
  comprobar('y el registro lo anota con su autor', r.entrada && r.entrada.autor === 'ana' && r.entrada.resultado && r.entrada.resultado.brasas, JSON.stringify(r.entrada));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
