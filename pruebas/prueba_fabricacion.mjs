// Pruebas de fabricar (src/logica/fabricacion.js): recetas siempre a la vista, por uso, con lo que llevas y lo del
// suelo a tu lado (revisión del 1 nov); las de una estación, con lo depositado en ella (valravnx, 6 nov). Ejecutar: node pruebas/prueba_fabricacion.mjs
// Con MUTAR=1 el hacha de piedra no gasta cordel y se hace al momento, la hoguera deja de dar el fuego y se puede poner
// bajo techo, y el banco se levanta sin trabajo:
// Con MUTAR=2 la pila de piedras guarda de todo y se pone fuera de tu tierra: las de los almacenajes deben FALLAR.
// Con MUTAR=3 los puestos no guardan su giro y lo terminado no se desmonta (como antes del 7 nov): las de desmontar deben FALLAR.
// las pruebas deben FALLAR.
import { ESTACIONES, RECETAS, USOS, CAMAS, Fabricacion, ejecutarFabricacion, sueloCerca, cuentas, SITIO_DE_RUTA, estacionesDeUso, ALCANCE_ESTACION, ALCANCE_SUELO,
  COLA_ESTACION, VERSION_FABRICACION, migrarFabricacion, DEPOSITO_MAX, cuentasEstacion, MAX_RATO_ESTACION, ALMACENAJES, cabeEn, limpiarDeposito } from '../src/logica/fabricacion.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { Mundo, clave } from '../src/logica/construccion.js';
import { MODULO } from '../src/logica/piezas.js';

if (process.env.MUTAR === '1') { delete RECETAS.hacha_piedra.gasta.cordel; RECETAS.hacha_piedra.s = 0; ESTACIONES.hoguera.uso = 'tallar'; ESTACIONES.hoguera.donde = 'ambos'; ESTACIONES.banco_tronco.trabajo = 0; }
// Con MUTAR=4 las camas se ligan sin estar en una tierra y se duerme en cualquiera: las de las camas deben FALLAR.
if (process.env.MUTAR === '4') {
  const ligar = Fabricacion.prototype.ligarCama; Fabricacion.prototype.ligarCama = function (a, e, p) { return ligar.call(this, a, e, p, true); };
  const dormir = Fabricacion.prototype.dormir; Fabricacion.prototype.dormir = function (a, e, p) { const c = this.estaciones[e]; if (c) c.ligadas = [...(c.ligadas || []), a]; return dormir.call(this, a, e, p); };
}
if (process.env.MUTAR === '2') { delete ESTACIONES.pila_piedras.guarda; delete ESTACIONES.pila_piedras.tierra; }
if (process.env.MUTAR === '3') {
  const colocar = Fabricacion.prototype.colocar; Fabricacion.prototype.colocar = function (a, t, x, z, d, y, en) { return colocar.call(this, a, t, x, z, d, y, en); };
  Fabricacion.prototype.desmontarEstacion = Fabricacion.prototype.quitarEstacion;
}
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// un jugador con cinturón de cordel puesto y una mochila de bastidor a la espalda, para poder llevar cosas
function jugador() {
  const inv = Inventario.inicial();
  inv.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  inv.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  return inv;
}
const T0 = Date.UTC(2026, 9, 31, 6, 0, 0);
// deja en la estación id lo de «cosas» ({ tipo: n }), con un jugador de paso que lo lleva y lo deposita
function depositar(fab, id, cosas) {
  const e = fab.estaciones[id], inv = jugador();
  for (const [t, n] of Object.entries(cosas)) {
    const m = inv.meterDonde(t, n); if (!m.ok) throw new Error('no cabe ' + t);
    for (const [ruta, k] of m.donde) { const r = fab.depositar('paso', id, ruta, k, { x: e.x, z: e.z }, inv); if (!r.ok) throw new Error(r.motivo); }
  }
}

// pone el marco de un puesto y lo levanta: le lleva su coste de inv (y del suelo de al lado) y trabaja en él hasta
// terminarlo, con una lasca en la mano (la herramienta del banco). Devuelve su id.
function levantar(fab, autor, tipo, x, z, inv = jugador(), suelo = null) {
  const r = fab.colocar(autor, tipo, x, z); if (!r.ok) throw new Error(r.motivo);
  const pos = { x, z };
  const e = fab.entregarEstacion(autor, r.id, pos, inv, suelo, T0); if (!e.ok) throw new Error(e.motivo);
  if (Object.keys(fab.faltaEstacion(fab.estaciones[r.id])).length) throw new Error('le falta material: ' + JSON.stringify(e.falta));
  const herr = jugador(); herr.meterDonde('lasca_silex', 1);
  for (let i = 0; i < 20 && fab.estaciones[r.id].obra; i++) { const t = fab.trabajarEstacion(autor, r.id, MAX_RATO_ESTACION, pos, herr); if (!t.ok) throw new Error(t.motivo); }
  return r.id;
}

console.log('Lo que dice el documento de sistemas (apartados 7 y 8)');
{
  const E = ESTACIONES;
  comprobar('hoguera: 6 piedras sueltas y 4 ramas; da el fuego', E.hoguera.uso === 'fuego' && igual(E.hoguera.coste, { piedra: 6, rama: 4 }));
  comprobar('piedra de tallar: 1 piedra; da el tallar', E.piedra_tallar.uso === 'tallar' && igual(E.piedra_tallar.coste, { piedra: 1 }));
  comprobar('banco de tronco: 2 troncos cortos y herramienta de piedra; da el banco', E.banco_tronco.uso === 'banco' && igual(E.banco_tronco.coste, { tronco_corto: 2 }) && E.banco_tronco.requiere.includes('hacha_piedra'));
  comprobar('por uso, no por nivel: ni las estaciones ni las recetas llevan nivel', Object.values(E).every(e => !('nivel' in e)) && Object.values(RECETAS).every(r => !('nivel' in r) && !('donde' in r)));
  comprobar('los usos: con las manos, al fuego (hoguera y hogar), piedra de tallar y banco de tronco', igual(Object.keys(USOS), ['manos', 'fuego', 'tallar', 'banco']) && igual(USOS.fuego.estaciones, ['hoguera', 'hogar']));
  comprobar('cada estación da un uso que la nombra (o es un almacenaje o una cama, sin recetas), y dice cómo se nombra en una frase', Object.entries(E).every(([t, e]) => (e.uso === 'almacen' || e.uso === 'cama' ? !Object.values(RECETAS).some(r => r.uso === e.uso) : USOS[e.uso] && USOS[e.uso].estaciones.includes(t)) && /^una? /.test(e.un)));
  comprobar('cada estación de los usos existe (el hogar, también, 8 nov)', igual(Object.values(USOS).flatMap(u => u.estaciones).filter(t => !E[t]), []) && igual(estacionesDeUso('fuego'), ['hoguera', 'hogar']));
  const R = RECETAS;
  comprobar('cordel: 3 fibra cruda, con las manos', R.cordel.uso === 'manos' && igual(R.cordel.gasta, { fibra: 3 }));
  comprobar('lasca de sílex: 1 sílex y 1 piedra, en la piedra de tallar', R.lasca_silex.uso === 'tallar' && igual(R.lasca_silex.gasta, { silex: 1, piedra: 1 }));
  comprobar('hacha de piedra: 1 piedra, 1 rama y 2 cordel, en la piedra de tallar', R.hacha_piedra.uso === 'tallar' && igual(R.hacha_piedra.gasta, { piedra: 1, rama: 1, cordel: 2 }), JSON.stringify(R.hacha_piedra.gasta));
  comprobar('lanza endurecida: 1 rama, en la hoguera', R.lanza_endurecida.uso === 'fuego' && igual(R.lanza_endurecida.gasta, { rama: 1 }));
  comprobar('leñero: 4 ramas y 2 cordel, con las manos', R.lenero.uso === 'manos' && igual(R.lenero.gasta, { rama: 4, cordel: 2 }));
  comprobar('cuerda: 3 cordel, en el banco', R.cuerda.uso === 'banco' && igual(R.cuerda.gasta, { cordel: 3 }));
  comprobar('pala de madera y cubo: 1 tronco corto, en el banco', ['pala_madera', 'cubo'].every(k => R[k].uso === 'banco' && igual(R[k].gasta, { tronco_corto: 1 })));
  const malas = Object.entries(R).filter(([, r]) => !CATALOGO[r.da] || Object.keys(r.gasta).some(t => !CATALOGO[t]) || !(r.uso === 'manos' || estacionesDeUso(r.uso).length));
  comprobar('todas las recetas dan y gastan cosas del catálogo, con un uso que tiene estación (o con las manos)', !malas.length, malas.map(m => m[0]).join());
  comprobar('todas tienen un tiempo de más de 0 s', Object.values(R).every(r => r.s > 0));
  comprobar('todas las estaciones cuestan cosas del catálogo', Object.values(ESTACIONES).every(e => Object.keys(e.coste).every(t => CATALOGO[t])));
}

console.log('Los puestos son obra: el marco, su material (de lo que llevas y del suelo) y el trabajo');
{
  const fab = new Fabricacion(), inv = jugador(), suelo = new Suelo();
  let r = fab.colocar('ana', 'hoguera', 0, 0);
  const id = r.id, e = fab.estaciones[id];
  comprobar('se pone el marco sin gastar nada', r.ok && r.obra && e.obra && igual(e.obra.entregado, {}) && e.obra.trabajo === 0, r.motivo || id);
  comprobar('le falta todo su coste', igual(fab.faltaEstacion(e), { piedra: 6, rama: 4 }));
  r = fab.trabajarEstacion('ana', id, 2, { x: 0, z: 0 }, inv);
  comprobar('sin su material no se trabaja', !r.ok && /material/.test(r.motivo), r.motivo);
  r = fab.entregarEstacion('ana', id, { x: 0, z: 0 }, inv, suelo, T0);
  comprobar('sin llevar nada no se entrega, y dice qué le falta', !r.ok && r.faltan.piedra === 6, r.motivo);
  inv.meterDonde('piedra', 3); inv.meterDonde('rama', 3);
  suelo.dejar({ tipo: 'piedra', n: 5 }, 1, 0, T0, 'ana', false);
  const ramas = suelo.dejar({ tipo: 'rama', n: 2 }, 0, 1, T0, 'ana', false);
  const lejos = suelo.dejar({ tipo: 'rama', n: 50 }, 20, 0, T0, 'ana', false);
  r = fab.entregarEstacion('ana', id, { x: 9, z: 0 }, inv, suelo, T0);
  comprobar('lejos del marco no se entrega', !r.ok && /lejos/.test(r.motivo), r.motivo);
  r = fab.entregarEstacion('ana', id, { x: 0, z: 0 }, inv, suelo, T0);
  const pila = suelo.objetos.find(o => o.cosa.tipo === 'piedra');
  comprobar('se le lleva de lo que llevas y del suelo a tu lado: primero lo que llevas', r.ok && igual(r.entregado, { piedra: 6, rama: 4 }) && inv.cuantos('piedra') === 0 && inv.cuantos('rama') === 0 && pila.cosa.n === 2 && ramas.cosa.n === 1, JSON.stringify(r));
  comprobar('lo del suelo lejos no se toca', lejos.cosa.n === 50 && ALCANCE_SUELO < 20);
  comprobar('en obra no se fabrica ni se deposita', !fab.fabricar('ana', 'lanza_endurecida', id, { x: 0, z: 0 }, inv, suelo, T0).ok
    && fab.estacionCerca('fuego', { x: 0, z: 0 }) === null && !fab.depositar('ana', id, 'mano:der', 1, { x: 0, z: 0 }, inv).ok);
  r = fab.trabajarEstacion('ana', id, MAX_RATO_ESTACION + 1, { x: 0, z: 0 }, inv);
  comprobar('un rato de trabajo de más de lo que vale no cuela', !r.ok);
  r = fab.trabajarEstacion('ana', id, 4, { x: 0, z: 0 }, inv);
  const r2 = fab.trabajarEstacion('blas', id, 4, { x: 0.5, z: 0 }, inv);
  comprobar('el trabajo de todos se suma', r.ok && !r.terminada && r2.ok && Math.abs(r2.progreso - 8 / ESTACIONES.hoguera.trabajo) < 1e-9, JSON.stringify(r2));
  r = fab.trabajarEstacion('ana', id, 5, { x: 0, z: 0 }, inv);
  comprobar('al llegar a su trabajo queda levantada (sin obra) y ya da el fuego', r.ok && r.terminada && !fab.estaciones[id].obra && fab.estacionCerca('fuego', { x: 0, z: 0 }).id === id, JSON.stringify(r));
  comprobar('y en sus aportes, quién llevó qué y quién trabajó', r.aportes.some(a => a.autor === 'ana' && a.entrega) && r.aportes.some(a => a.autor === 'blas' && a.trabajo === 4));
  comprobar('levantada, ya no se le entrega ni se quita como marco', !fab.entregarEstacion('ana', id, { x: 0, z: 0 }, inv, suelo, T0).ok && !fab.quitarEstacion('ana', id, { x: 0, z: 0 }, suelo, T0).ok);
  // el banco: la herramienta se lleva al trabajarlo, y no se gasta
  const b = fab.colocar('ana', 'banco_tronco', 5, 5).id;
  const inv2 = jugador(); inv2.lugares.hombro = { tipo: 'tronco_corto', n: 1 }; inv2.lugares['mano:der'] = { tipo: 'tronco_corto', n: 1 };
  r = fab.entregarEstacion('ana', b, { x: 5, z: 5 }, inv2, null, T0);
  comprobar('2 troncos cortos (uno al hombro) se le llevan', r.ok && inv2.cuantos('tronco_corto') === 0 && !Object.keys(fab.faltaEstacion(fab.estaciones[b])).length, r.motivo);
  r = fab.trabajarEstacion('ana', b, 5, { x: 5, z: 5 }, inv2);
  comprobar('el banco pide llevar una herramienta de piedra para levantarlo', !r.ok && /hacha de piedra/.test(r.motivo), r.motivo);
  inv2.meterDonde('lasca_silex', 1);
  for (let k = 0; k < 4; k++) r = fab.trabajarEstacion('ana', b, 5, { x: 5, z: 5 }, inv2);
  comprobar('con una lasca, se levanta en su trabajo (20 s) y la lasca no se gasta', r.ok && r.terminada && inv2.cuantos('lasca_silex') === 1, r.motivo);
  comprobar('una estación desconocida no se coloca', !fab.colocar('ana', 'constructor', 0, 0).ok && !fab.colocar('ana', '__proto__', 0, 0).ok);
  comprobar('colocar no enseña nada (nadie aprende recetas)', !('aprendidas' in r));
}

console.log('Dónde va cada puesto: la hoguera, solo fuera');
{
  const fab = new Fabricacion();
  comprobar('la hoguera, solo fuera; la piedra de tallar y el banco, dentro o fuera', ESTACIONES.hoguera.donde === 'fuera' && ESTACIONES.piedra_tallar.donde === 'ambos' && ESTACIONES.banco_tronco.donde === 'ambos');
  let r = fab.colocar('ana', 'hoguera', 0, 0, true);
  comprobar('bajo techo no se pone una hoguera', !r.ok && /fuera/.test(r.motivo), r.motivo);
  comprobar('la piedra de tallar y el banco, bajo techo sí', fab.colocar('ana', 'piedra_tallar', 0, 0, true, 0.3).ok && fab.colocar('ana', 'banco_tronco', 2, 0, true).ok);
  comprobar('y se guarda la altura del suelo en que se apoya, si se da', Object.values(fab.estaciones).find(e => e.tipo === 'piedra_tallar').y === 0.3);
  comprobar('el hogar, solo dentro de la casa: fuera no', !fab.colocar('ana', 'hogar', 0, 0, false).ok && fab.colocar('ana', 'hogar', 0, 0, true).ok);
  // «bajo techo» lo dice el mundo de las construcciones: un tejado o un suelo terminado encima, en su casilla
  const m = new Mundo(), c = { id: 1, ox: 0, oz: 0, rot: 0, piezas: new Map() }; m.construcciones.push(c);
  const dentro = { x: MODULO * 0.5, z: MODULO * 0.5 }, al_lado = { x: MODULO * 1.5, z: MODULO * 0.5 };
  comprobar('sin tejado, fuera', !m.bajoTecho(dentro.x, dentro.z));
  c.piezas.set(clave('r', 0, 0, 1), { tipo: 'tejado_paja', hueco: 'r', i: 0, j: 0, k: 1, obra: { entregado: {}, trabajo: 0, aportes: [] } });
  comprobar('con el tejado aún en obra, fuera', !m.bajoTecho(dentro.x, dentro.z));
  delete c.piezas.get(clave('r', 0, 0, 1)).obra;
  comprobar('con el tejado terminado, dentro; en la casilla de al lado, fuera', m.bajoTecho(dentro.x, dentro.z) && !m.bajoTecho(al_lado.x, al_lado.z));
}

console.log('Quitar un marco a medio hacer');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const id = fab.colocar('ana', 'hoguera', 3, 3).id;
  inv.meterDonde('piedra', 2); inv.meterDonde('rama', 1);
  fab.entregarEstacion('ana', id, { x: 3, z: 3 }, inv, null, T0);
  const r = fab.quitarEstacion('ana', id, { x: 3, z: 3 }, suelo, T0, true);
  const en = t => suelo.objetos.filter(o => o.cosa.tipo === t).reduce((n, o) => n + o.cosa.n, 0);
  comprobar('se quita y lo entregado cae al suelo donde estaba', r.ok && !fab.estaciones[id] && en('piedra') === 2 && en('rama') === 1 && suelo.objetos.every(o => Math.hypot(o.x - 3, o.z - 3) < 1.5), JSON.stringify(r));
}

console.log('Desmontar un puesto o un almacenaje terminado, y el giro con que se pone (valravnx, 7 nov)');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador(), reg = new RegistroAcciones();
  inv.meterDonde('vara', 4);
  const r0 = fab.colocar('ana', 'acopio_troncos', 3, 3, false, 0.2, true, -Math.PI / 2);
  comprobar('el puesto guarda el giro con que se pone (entre 0 y 2π)', r0.ok && Math.abs(fab.estaciones[r0.id].giro - 3 * Math.PI / 2) < 1e-3, JSON.stringify(fab.estaciones[r0.id]));
  fab.entregarEstacion('ana', r0.id, { x: 3, z: 3 }, inv, null, T0);
  for (let k = 0; k < 4 && fab.estaciones[r0.id].obra; k++) fab.trabajarEstacion('ana', r0.id, MAX_RATO_ESTACION, { x: 3, z: 3 }, inv);
  comprobar('levantado', fab.estaciones[r0.id] && !fab.estaciones[r0.id].obra);
  const copia = new Fabricacion().importar(JSON.parse(JSON.stringify(fab.exportar())));
  comprobar('y lo guarda al guardar y volver a leer el mundo', Math.abs(copia.estaciones[r0.id].giro - fab.estaciones[r0.id].giro) < 1e-9);
  depositar(fab, r0.id, { tronco_delgado: 1 }); depositar(fab, r0.id, { tronco_delgado: 1 });
  comprobar('desde lejos no se desmonta', !fab.desmontarEstacion('ana', r0.id, { x: 9, z: 3 }, suelo, T0, true).ok);
  const r = ejecutarFabricacion(fab, new Inventarios(), reg, { autor: 'ana', tipo: 'desmontar_estacion', estacion: r0.id, x: 3, z: 3 }, T0, suelo, () => true);
  const en = t => suelo.objetos.filter(o => o.cosa.tipo === t).reduce((n, o) => n + o.cosa.n, 0);
  comprobar('terminado se desmonta: el 75 % de su material y lo que guardaba, al suelo donde estaba', r.ok && !fab.estaciones[r0.id] && en('vara') === 3 && en('tronco_delgado') === 2
    && suelo.objetos.every(o => Math.hypot(o.x - 3, o.z - 3) < 1.5), JSON.stringify(r));
  comprobar('y queda en el registro con su autor', reg.entradas.at(-1).tipo === 'desmontar_estacion' && reg.entradas.at(-1).autor === 'ana' && reg.entradas.at(-1).ok);
  // un marco a medio hacer también se quita por ahí (lo entregado, entero)
  const m = fab.colocar('ana', 'hoguera', 6, 6).id;
  inv.meterDonde('piedra', 2); fab.entregarEstacion('ana', m, { x: 6, z: 6 }, inv, null, T0);
  const rm = fab.desmontarEstacion('ana', m, { x: 6, z: 6 }, suelo, T0, true);
  comprobar('el marco a medio hacer, por el mismo sitio: lo entregado, entero', rm.ok && rm.quitada && en('piedra') === 2, JSON.stringify(rm));
  // con encargos a medias, no
  const p = levantar(fab, 'ana', 'piedra_tallar', 10, 0, jugador3());
  fab.estaciones[p].cola.push({ autor: 'ana', receta: 'lasca_silex', empieza: T0, fin: T0 + 60000 });
  comprobar('con encargos a medias no se desmonta', !fab.desmontarEstacion('ana', p, { x: 10, z: 0 }, suelo, T0).ok);
  comprobar('el giro, si no es un número, no vale', !ejecutarFabricacion(fab, new Inventarios(), reg, { autor: 'ana', tipo: 'colocar_estacion', estacion: 'hoguera', x: 0, z: 0, giro: 'norte' }, T0).ok);
}
function jugador3() { const i = jugador(); i.meterDonde('piedra', 3); return i; }

console.log('Fabricar por uso: piedra de tallar y fuego');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('piedra', 3); inv.meterDonde('silex', 1); inv.meterDonde('rama', 3);
  const tallar = levantar(fab, 'ana', 'piedra_tallar', 10, 0, inv);
  comprobar('la piedra de tallar gasta 1 piedra', inv.cuantos('piedra') === 2);
  let r = fab.fabricar('ana', 'lasca_silex', tallar, { x: 20, z: 0 }, inv, null, T0);
  comprobar('lejos de la estación no se fabrica', !r.ok && inv.cuantos('silex') === 1, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', null, { x: 20, z: 0 }, inv, null, T0);
  comprobar('sin decir la estación y sin ninguna al lado, dice cuál hace falta', !r.ok && /piedra de tallar/.test(r.motivo) && inv.cuantos('silex') === 1, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', null, { x: 10 + ALCANCE_ESTACION - 0.1, z: 0 }, inv, null, T0);
  comprobar('junto a ella, con el sílex y la piedra encima pero sin depositar, no: dice que faltan en la estación', !r.ok && /en la estación/.test(r.motivo) && inv.cuantos('silex') === 1 && inv.cuantos('piedra') === 2, r.motivo);
  const rs = inv.rutasCon('silex')[0], rp = inv.rutasCon('piedra')[0];
  r = fab.depositar('ana', tallar, rs, undefined, { x: 10 + ALCANCE_ESTACION + 0.5, z: 0 }, inv);
  comprobar('lejos de la estación no se deposita', !r.ok && inv.cuantos('silex') === 1, r.motivo);
  r = fab.depositar('ana', tallar, rs, undefined, { x: 10 + ALCANCE_ESTACION - 0.1, z: 0 }, inv);
  const r2 = fab.depositar('ana', tallar, rp, 1, { x: 10 + ALCANCE_ESTACION - 0.1, z: 0 }, inv);
  comprobar('deposita en ella el sílex y una piedra: salen de lo que lleva', r.ok && r2.ok && inv.cuantos('silex') === 0 && inv.cuantos('piedra') === 1 && igual(fab.estaciones[tallar].deposito, { silex: 1, piedra: 1 }), r.motivo || r2.motivo);
  r = fab.fabricar('ana', 'lasca_silex', null, { x: 10 + ALCANCE_ESTACION - 0.1, z: 0 }, inv, null, T0);
  comprobar('y ahora sí: sin decir cuál, la más cercana, y gasta lo depositado (no lo que lleva)', r.ok && r.estacion === tallar && igual(fab.estaciones[tallar].deposito, {}) && inv.cuantos('piedra') === 1 && igual(r.usado.estacion, { silex: 1, piedra: 1 }), r.motivo);
  depositar(fab, tallar, { piedra: 1, rama: 1 });
  inv.meterDonde('cordel', 1); inv.meterDonde('cordel', 1);
  r = fab.fabricar('ana', 'hacha_piedra', tallar, { x: 10, z: 0 }, inv, null, T0);
  comprobar('el hacha, siempre a la vista: sin cordel en la estación no se encarga y no gasta nada (aunque lo lleve)', !r.ok && r.faltan && r.faltan.cordel === 2 && igual(fab.estaciones[tallar].deposito, { piedra: 1, rama: 1 }) && inv.cuantos('cordel') === 3, r.motivo); // 2 en la mano y el cinturón puesto
  for (const ruta of inv.rutasCon('cordel')) fab.depositar('ana', tallar, ruta, undefined, { x: 10, z: 0 }, inv);
  r = fab.fabricar('ana', 'hacha_piedra', tallar, { x: 10, z: 0 }, inv, null, T0 + 1000);
  const finLasca = T0 + RECETAS.lasca_silex.s * 1000;
  comprobar('con 2 cordel depositados sí, sin haber hecho nada antes en ella, y gasta piedra, rama y los dos cordeles de la estación', r.ok && igual(fab.estaciones[tallar].deposito, {}) && inv.cuantos('cordel') === 1 && inv.lugares.cintura && inv.cuantos('rama') === 3, r.motivo || JSON.stringify(r.usado));
  comprobar('en la cola, empieza cuando acaba la lasca', r.ok && r.encargo.empieza === finLasca && r.encargo.fin === finLasca + RECETAS.hacha_piedra.s * 1000);
  const est = fab.estado(tallar, 'ana', finLasca + 1000);
  comprobar('el estado dice qué está terminado y cuánto falta', est.length === 2 && est[0].terminado && !est[1].terminado && est[1].falta === RECETAS.hacha_piedra.s * 1000 - 1000);
  r = fab.recoger('blas', tallar, { x: 10, z: 0 }, Inventario.inicial(), finLasca + 1000);
  comprobar('otro jugador no recoge lo de Ana', !r.ok, r.motivo);
  r = fab.recoger('ana', tallar, { x: 10, z: 0 }, inv, finLasca + 1000);
  comprobar('Ana recoge la lasca; el hacha sigue en la cola', r.ok && inv.cuantos('lasca_silex') === 1 && inv.cuantos('hacha_piedra') === 0 && fab.estaciones[tallar].cola.length === 1, r.motivo);
  r = fab.recoger('ana', tallar, { x: 10, z: 0 }, inv, T0 + 3600e3);
  comprobar('pasada una hora, aunque nadie juegue, el hacha está hecha', r.ok && inv.cuantos('hacha_piedra') === 1, r.motivo);
  // la piedra de tallar de otro: cualquiera la usa
  const invB = jugador(); invB.meterDonde('silex', 1); invB.meterDonde('piedra', 1);
  for (const t of ['silex', 'piedra']) fab.depositar('blas', tallar, invB.rutasCon(t)[0], undefined, { x: 10, z: 1 }, invB);
  r = fab.fabricar('blas', 'lasca_silex', null, { x: 10, z: 1 }, invB, null, T0 + 3600e3);
  comprobar('Blas usa la piedra de tallar de Ana sin haber construido una, con lo que deposita él', r.ok && r.estacion === tallar && invB.cuantos('silex') === 0, r.motivo);
  // el fuego: la cola de la hoguera, con ramas depositadas; las del suelo de al lado no cuentan
  const inv3 = jugador(), suelo = new Suelo(); inv3.meterDonde('piedra', 6); inv3.meterDonde('rama', 3); inv3.meterDonde('rama', 1);
  const hog = levantar(fab, 'blas', 'hoguera', 0, 0, inv3, suelo);
  suelo.dejar({ tipo: 'rama', n: 10 }, 1, 0, T0, 'blas', true);
  comprobar('las ramas del suelo de al lado no valen para la hoguera', !fab.fabricar('blas', 'lanza_endurecida', null, { x: 1, z: 0 }, inv3, suelo, T0).ok);
  depositar(fab, hog, { rama: COLA_ESTACION + 1 });
  r = fab.fabricar('blas', 'lanza_endurecida', null, { x: 1, z: 0 }, inv3, suelo, T0);
  comprobar('con la hoguera apagada no se hace nada al fuego', !r.ok && /apagado/.test(r.motivo), r.motivo);
  comprobar('y el panel lo dice: casi, con el fuego apagado', fab.lista({ x: 1, z: 0 }, inv3, suelo, T0).find(x => x.receta === 'lanza_endurecida').apagada === true);
  inv3.meterDonde('taladro_fuego', 1); inv3.meterDonde('yesca', 1);
  r = fab.encenderFuego('blas', hog, { x: 1, z: 0 }, inv3, T0);
  comprobar('la enciende con la yesca y el taladro', r.ok, r.motivo);
  let n = 0;
  for (let i = 0; i < COLA_ESTACION + 1; i++) if (fab.fabricar('blas', 'lanza_endurecida', null, { x: 1, z: 0 }, inv3, suelo, T0).ok) n++;
  comprobar('la lanza se hace al fuego de la hoguera', n > 0);
  comprobar(`la cola de una estación admite ${COLA_ESTACION} encargos sin terminar`, n === COLA_ESTACION, `${n}`);
  const enSuelo = suelo.objetos.find(o => o.cosa.tipo === 'rama');
  comprobar('las ramas salieron de la hoguera: queda una y el suelo sigue igual', igual(fab.estaciones[hog].deposito, { rama: 1 }) && enSuelo.cosa.n === 10, JSON.stringify(enSuelo.cosa));
  r = fab.fabricar('ana', 'lanza_endurecida', hog, { x: 1, z: 0 }, inv, suelo, T0 + RECETAS.lanza_endurecida.s * 1000);
  comprobar('cuando termina el primero, hay sitio en la cola (también para otro jugador)', r.ok, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', hog, { x: 1, z: 0 }, inv, null, T0);
  comprobar('la lasca no se hace en la hoguera', !r.ok && /piedra de tallar/.test(r.motivo), r.motivo);
  r = fab.fabricar('ana', 'antorcha', null, { x: 50, z: 50 }, inv, null, T0);
  comprobar('sin fuego al lado, la antorcha dice que hace falta una hoguera', !r.ok && /hoguera/.test(r.motivo), r.motivo);
}

console.log('Todas las recetas a la vista: lo que puedes ya, lo que casi y lo que se abre después');
{
  const fab = new Fabricacion(), inv = jugador(), suelo = new Suelo();
  inv.meterDonde('fibra', 3); inv.meterDonde('piedra', 1);
  suelo.dejar({ tipo: 'silex', n: 1 }, 0.5, 0.5, T0, 'ana', false);
  let l = fab.lista({ x: 0, z: 0 }, inv, suelo, T0);
  const de = k => l.find(x => x.receta === k);
  { const delTramo = Object.keys(RECETAS).filter(k => !RECETAS[k].fuera);   // (8 nov: la honda y el odre, fuera del tramo hasta la caza)
  comprobar('salen todas las recetas del tramo, sin conocer ninguna', l.length === delTramo.length && igual(l.map(x => x.receta), delTramo) && delTramo.length === Object.keys(RECETAS).length - 2); }
  comprobar('el cordel, ya (3 fibra encima)', de('cordel').grupo === 'ya' && de('cordel').de.fibra.encima === 3 && de('cordel').de.fibra.suelo === 0, JSON.stringify(de('cordel').de));
  comprobar('y dice de qué sitio sale (lo que llevas, por sitios)', Object.values(de('cordel').de.fibra.sitios).reduce((a, b) => a + b, 0) === 3 && !de('cordel').de.fibra.sitios.suelo, JSON.stringify(de('cordel').de));
  comprobar('cada receta lleva lo que gasta, lo que da y su tiempo', igual(de('cordel').gasta, { fibra: 3 }) && de('cordel').da === 'cordel' && de('cordel').s === 15);
  comprobar('el leñero, casi: falta en rojo lo que no hay', de('lenero').grupo === 'casi' && igual(de('lenero').faltan, { rama: 4, cordel: 2 }), JSON.stringify(de('lenero')));
  comprobar('la lasca, después, con la piedra de tallar', de('lasca_silex').grupo === 'despues' && de('lasca_silex').conQue === 'una piedra de tallar');
  comprobar('la lanza, después, con la hoguera', de('lanza_endurecida').grupo === 'despues' && /hoguera/.test(de('lanza_endurecida').conQue));
  inv.meterDonde('piedra', 1);
  const pt = levantar(fab, 'ana', 'piedra_tallar', 1, 0, inv);
  l = fab.lista({ x: 0, z: 0 }, inv, suelo, T0);
  comprobar('con la piedra de tallar al lado y nada en ella, la lasca casi: falta depositar sílex y piedra', de('lasca_silex').grupo === 'casi' && igual(de('lasca_silex').faltan, { silex: 1, piedra: 1 }) && de('lasca_silex').estacion === pt, JSON.stringify(de('lasca_silex')));
  depositar(fab, pt, { silex: 1, piedra: 1 });
  l = fab.lista({ x: 0, z: 0 }, inv, suelo, T0);
  comprobar('con ellos depositados, ya, y dice que salen de la estación', de('lasca_silex').grupo === 'ya' && de('lasca_silex').de.silex.sitios.estacion === 1 && de('lasca_silex').de.piedra.estacion === 1 && !de('lasca_silex').de.silex.sitios.suelo, JSON.stringify(de('lasca_silex')));
  comprobar('y el hacha, casi', de('hacha_piedra').grupo === 'casi');
  comprobar('lo de las manos sigue con lo que llevas y el suelo (el cordel, ya)', de('cordel').grupo === 'ya' && de('cordel').de.fibra.encima === 3);
}

console.log('Depositar en las estaciones y volver a coger');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('piedra', 1);
  const pt = levantar(fab, 'ana', 'piedra_tallar', 0, 0, inv);
  inv.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  let r = fab.depositar('ana', pt, 'cintura', undefined, { x: 0, z: 0 }, inv);
  comprobar('lo que llevas puesto no se deja', !r.ok && inv.lugares.cintura, r.motivo);
  r = fab.depositar('ana', pt, 'espalda', undefined, { x: 0, z: 0 }, inv);
  comprobar('ni la mochila', !r.ok && inv.lugares.espalda, r.motivo);
  inv.lugares['mano:der'] = { tipo: 'tunica_lana', n: 1, tinte: 'rubia' };
  r = CATALOGO.tunica_lana ? fab.depositar('ana', pt, 'mano:der', undefined, { x: 0, z: 0 }, inv) : { ok: false, motivo: '(sin túnica en el catálogo)' };
  comprobar('ni una prenda cosida', !r.ok, r.motivo);
  inv.lugares['mano:der'] = { tipo: 'rama', n: 3 };
  r = fab.depositar('ana', pt, 'mano:der', 4, { x: 0, z: 0 }, inv);
  comprobar('ni más de lo que hay', !r.ok && inv.cuantos('rama') === 3, r.motivo);
  r = fab.depositar('ana', pt, 'mano:der', 2, { x: 0, z: 0 }, inv);
  comprobar('una parte, sí', r.ok && inv.cuantos('rama') === 1 && fab.estaciones[pt].deposito.rama === 2, r.motivo);
  depositar(fab, pt, { piedra: DEPOSITO_MAX - 2 });
  r = fab.depositar('ana', pt, 'mano:der', 1, { x: 0, z: 0 }, inv);
  comprobar(`caben ${DEPOSITO_MAX} en total, no más`, !r.ok && inv.cuantos('rama') === 1, r.motivo);
  r = fab.retirar('blas', pt, 'rama', 1, { x: 9, z: 0 }, jugador());
  comprobar('lejos no se coge', !r.ok, r.motivo);
  r = fab.retirar('ana', pt, 'rama', 1, { x: 0, z: 0 }, inv);
  comprobar('se vuelve a coger lo depositado: a lo que llevas', r.ok && inv.cuantos('rama') === 2 && fab.estaciones[pt].deposito.rama === 1, r.motivo);
  r = fab.retirar('ana', pt, 'silex', 1, { x: 0, z: 0 }, inv);
  comprobar('lo que no está no se coge', !r.ok, r.motivo);
  r = fab.retirar('ana', pt, 'toString', 1, { x: 0, z: 0 }, inv);
  comprobar('nombres raros no cuelan', !r.ok, r.motivo);
  const lleno = Inventario.inicial(); lleno.lugares['mano:der'] = { tipo: 'silex', n: 1 }; lleno.lugares['mano:izq'] = { tipo: 'fibra', n: 1 };
  r = fab.retirar('blas', pt, 'piedra', 3, { x: 0, z: 0 }, lleno);
  comprobar('si no te cabe, no se coge y sigue en la estación', !r.ok && fab.estaciones[pt].deposito.piedra === DEPOSITO_MAX - 2, r.motivo);
  // valravnx, 8 nov: con más de lo que cabe, se coge lo que cabe y el resto se queda (antes, todo o nada: bloqueado)
  const casi = Inventario.inicial(); casi.lugares['mano:izq'] = { tipo: 'fibra', n: 1 };
  const cabeP = casi.cabenCuantos('piedra', 99), antesP = fab.estaciones[pt].deposito.piedra;
  r = fab.retirar('blas', pt, 'piedra', undefined, { x: 0, z: 0 }, casi);
  comprobar(`si no cabe todo, coge lo que cabe (${cabeP} de ${antesP}) y el resto sigue en la estación`,
    r.ok && cabeP >= 1 && cabeP < antesP && casi.cuantos('piedra') === cabeP && fab.estaciones[pt].deposito.piedra === antesP - cabeP && r.noCabia === antesP - cabeP, r.motivo);
  fab.estaciones[pt].deposito.piedra = antesP;
  r = fab.retirar('ana', pt, 'rama', undefined, { x: 0, z: 0 }, inv);
  comprobar('sin cantidad, todo lo de ese tipo; y el tipo sale de la lista', r.ok && !('rama' in fab.estaciones[pt].deposito), r.motivo);
  comprobar('cuentasEstacion dice lo que falta', igual(cuentasEstacion({ piedra: 1, silex: 2 }, { piedra: 4 }).faltan, { silex: 2 }));
  // con dos piedras de tallar al lado, sin decir cuál, la que tiene lo que pide
  const inv2 = jugador(); inv2.meterDonde('piedra', 2);
  const a1 = levantar(fab, 'ana', 'piedra_tallar', 3, 0, inv2), a2 = levantar(fab, 'ana', 'piedra_tallar', 4, 0, inv2);
  depositar(fab, a2, { silex: 1, piedra: 1 });
  r = fab.fabricar('ana', 'lasca_silex', null, { x: 3.2, z: 0 }, inv2, null, T0);
  comprobar('con dos al lado, sin decir cuál, usa la que tiene lo depositado aunque esté más lejos', r.ok && r.estacion === a2 && a1 !== a2, r.motivo || r.estacion);
}

console.log('Los almacenajes de la base: acopio de troncos, pila de piedras y leñera (revisión del 1 nov)');
{
  const E = ESTACIONES;
  comprobar('los siete del documento de sistemas y los dos colgaderos (8 nov), sin recetas: guardan lo suyo (troncos; piedra suelta; leña y ramas; varas; paja y juncos; barro; lo de la espalda; las herramientas; lo pequeño)',
    igual(ALMACENAJES, ['acopio_troncos', 'pila_piedras', 'lenera', 'soporte_varas', 'almiar', 'hoyo_barro', 'colgadero_mochilas', 'colgadero_herramientas', 'cesto'])
    && E.colgadero_mochilas.guarda.includes('lenero') && E.colgadero_mochilas.guarda.every(t => CATALOGO[t].lugar === 'espalda')
    && E.colgadero_herramientas.guarda.includes('hacha_piedra') && E.colgadero_herramientas.guarda.every(t => CATALOGO[t].herramienta)
    && igual(E.soporte_varas.guarda, ['vara']) && igual(E.almiar.guarda, ['paja', 'junco']) && igual(E.hoyo_barro.guarda, ['barro'])
    && ['silex', 'fibra', 'cordel', 'yesca'].every(t => E.cesto.guarda.includes(t)) && E.cesto.guarda.every(t => CATALOGO[t] && CATALOGO[t].tam === 'P')
    && E.acopio_troncos.guarda.includes('tronco_delgado') && igual(E.pila_piedras.guarda, ['piedra']) && igual(E.lenera.guarda, ['lena', 'rama']) && !Object.values(RECETAS).some(r => r.uso === 'almacen'));
  comprobar('su coste sale del mundo (varas, piedras, ramas y juncos; y el cordel de fibra de los colgaderos)', ALMACENAJES.every(t => Object.keys(E[t].coste).every(m => ['vara', 'piedra', 'rama', 'junco', 'cordel'].includes(m))));
  comprobar('el almiar y el hoyo de barro, solo fuera; el soporte de varas y el cesto, dentro o fuera', E.almiar.donde === 'fuera' && E.hoyo_barro.donde === 'fuera' && E.soporte_varas.donde === 'ambos' && E.cesto.donde === 'ambos');
  const fab = new Fabricacion();
  let r = fab.colocar('ana', 'pila_piedras', 0, 0, false, null, false);
  comprobar('fuera de tu tierra no se pone', !r.ok && /tierra/.test(r.motivo || ''), r.motivo);
  r = fab.colocar('ana', 'acopio_troncos', 0, 0, true, null, true);
  comprobar('el acopio de troncos, solo fuera', !r.ok, r.motivo);
  const inv = jugador(); inv.meterDonde('piedra', 4);
  const pila = (() => { const c = fab.colocar('ana', 'pila_piedras', 0, 0, false, null, true); if (!c.ok) throw new Error(c.motivo); return c.id; })();
  r = fab.depositar('ana', pila, inv.rutasCon('piedra')[0], 1, { x: 0, z: 0 }, inv);
  comprobar('en obra no guarda nada', !r.ok, r.motivo);
  fab.entregarEstacion('ana', pila, { x: 0, z: 0 }, inv, null, T0);
  for (let i = 0; i < 4 && fab.estaciones[pila].obra; i++) fab.trabajarEstacion('ana', pila, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('se levanta como obra: sus 4 piedras y su trabajo', !fab.estaciones[pila].obra && inv.cuantos('piedra') === 0);
  inv.lugares['mano:der'] = { tipo: 'rama', n: 2 };
  r = fab.depositar('ana', pila, 'mano:der', 1, { x: 0, z: 0 }, inv);
  comprobar('la pila de piedras no guarda ramas', !r.ok && /solo guarda/.test(r.motivo || '') && inv.cuantos('rama') === 2, r.motivo);
  inv.lugares['mano:izq'] = { tipo: 'piedra', n: 5 };
  r = fab.depositar('ana', pila, 'mano:izq', undefined, { x: 0, z: 0 }, inv);
  comprobar('guarda piedras (Usar: dejar)', r.ok && fab.estaciones[pila].deposito.piedra === 5 && !inv.lugares['mano:izq'], r.motivo);
  for (let q = cabeEn('pila_piedras') - 5; q > 0; q -= 5) depositar(fab, pila, { piedra: Math.min(5, q) });
  comprobar(`le caben ${cabeEn('pila_piedras')}, más que a una estación (${DEPOSITO_MAX})`, fab.estaciones[pila].deposito.piedra === cabeEn('pila_piedras') && cabeEn('pila_piedras') > DEPOSITO_MAX);
  const otra = jugador(); otra.lugares['mano:der'] = { tipo: 'piedra', n: 1 };
  r = fab.depositar('ana', pila, 'mano:der', 1, { x: 0, z: 0 }, otra);
  comprobar('llena, no cabe ni una más', !r.ok && /no cabe/.test(r.motivo || ''), r.motivo);
  r = fab.retirar('ana', pila, 'piedra', 2, { x: 0, z: 0 }, inv);
  comprobar('y se sacan (Usar: coger)', r.ok && inv.cuantos('piedra') === 2 && fab.estaciones[pila].deposito.piedra === cabeEn('pila_piedras') - 2, r.motivo);
  // la obra no coge de ellos sola: un marco de hoguera al lado de la pila llena, sin nada encima, no recibe nada
  const hg = fab.colocar('ana', 'hoguera', 0.5, 0).id, vacio = jugador();
  r = fab.entregarEstacion('ana', hg, { x: 0.3, z: 0 }, vacio, null, T0);
  comprobar('la obra no coge de los almacenajes: sin llevar piedras, la hoguera de al lado no recibe ninguna', !r.ok && !Object.keys(fab.estaciones[hg].obra.entregado).length && fab.estaciones[pila].deposito.piedra === cabeEn('pila_piedras') - 2, r.motivo);
  comprobar('ni las recetas: nada se hace con lo de la pila', fab.lista({ x: 0, z: 0 }, vacio, null, T0).every(x => x.estacion !== pila));
  comprobar('lo guardado se guarda y se carga (más de 20, solo lo suyo)', new Fabricacion().importar(fab.exportar()).estaciones[pila].deposito.piedra === cabeEn('pila_piedras') - 2
    && igual(limpiarDeposito({ piedra: 30, rama: 3 }, 'pila_piedras'), { piedra: 30 }) && igual(limpiarDeposito({ lena: 25, piedra: 2 }, 'lenera'), { lena: 25 }));
  // el tronco delgado, del hombro al acopio y de vuelta al hombro
  const ac = levantar(fab, 'ana', 'acopio_troncos', 5, 0, (() => { const i = jugador(); i.meterDonde('vara', 4); return i; })());
  const hom = Inventario.inicial(); hom.lugares.hombro = { tipo: 'tronco_delgado', n: 1 };
  r = fab.depositar('ana', ac, 'hombro', undefined, { x: 5, z: 0 }, hom);
  comprobar('el tronco delgado, del hombro al acopio de troncos', r.ok && !hom.lugares.hombro && fab.estaciones[ac].deposito.tronco_delgado === 1, r.motivo);
  r = fab.retirar('ana', ac, 'tronco_delgado', 1, { x: 5, z: 0 }, hom);
  comprobar('y se vuelve a sacar', r.ok && hom.cuantos('tronco_delgado') === 1, r.motivo);
  // los otros cuatro (8 nov): cada uno, lo suyo y nada más
  const prueba = (tipo, x, coste, bien, mal) => {
    const i = jugador(); for (const [t, n] of Object.entries(coste)) i.meterDonde(t, n);
    const id = levantar(fab, 'ana', tipo, x, 0, i), q = jugador(); q.lugares['mano:der'] = { tipo: bien, n: 2 }; q.lugares['mano:izq'] = { tipo: mal, n: 1 };
    const rb = fab.depositar('ana', id, 'mano:der', undefined, { x, z: 0 }, q), rm = fab.depositar('ana', id, 'mano:izq', undefined, { x, z: 0 }, q);
    comprobar(`${E[tipo].nombre.toLowerCase()}: guarda ${CATALOGO[bien].nombre.toLowerCase()} y no ${CATALOGO[mal].nombre.toLowerCase()}`, rb.ok && fab.estaciones[id].deposito[bien] === 2 && !rm.ok && /solo guarda/.test(rm.motivo || ''), `${rb.motivo || ''} ${rm.motivo || ''}`);
    return id;
  };
  prueba('soporte_varas', 10, { vara: 4 }, 'vara', 'rama');
  prueba('almiar', 15, { vara: 2 }, 'junco', 'piedra');
  prueba('almiar', 20, { vara: 2 }, 'paja', 'vara');
  const cs = prueba('cesto', 25, { junco: 3 }, 'fibra', 'piedra');
  { const q = jugador(); q.lugares['mano:der'] = { tipo: 'silex', n: 3 }; q.lugares['mano:izq'] = { tipo: 'cordel', n: 1 };
    const r1 = fab.depositar('ana', cs, 'mano:der', undefined, { x: 25, z: 0 }, q), r2 = fab.depositar('ana', cs, 'mano:izq', undefined, { x: 25, z: 0 }, q);
    comprobar('en el cesto, también el sílex y un cordel suelto', r1.ok && r2.ok && fab.estaciones[cs].deposito.silex === 3 && fab.estaciones[cs].deposito.cordel === 1, `${r1.motivo || ''} ${r2.motivo || ''}`); }
  // el hoyo de barro: hay que llevar el palo cavador para cavarlo
  { const i = jugador(); i.meterDonde('piedra', 6);
    const c = fab.colocar('ana', 'hoyo_barro', 30, 0, false, null, true);
    fab.entregarEstacion('ana', c.id, { x: 30, z: 0 }, i, null, T0);
    const sin = fab.trabajarEstacion('ana', c.id, MAX_RATO_ESTACION, { x: 30, z: 0 }, i);
    comprobar('el hoyo de barro no se cava sin el palo cavador', c.ok && !sin.ok && /palo cavador/.test(sin.motivo || ''), sin.motivo);
    i.lugares['mano:der'] = { tipo: 'palo_cavador', n: 1 };
    for (let k = 0; k < 10 && fab.estaciones[c.id].obra; k++) fab.trabajarEstacion('ana', c.id, MAX_RATO_ESTACION, { x: 30, z: 0 }, i);
    comprobar('con él, sí (y el palo no se gasta)', !fab.estaciones[c.id].obra && i.cuantos('palo_cavador') === 1);
    const q = jugador(); q.lugares['mano:der'] = { tipo: 'barro', n: 1 }; q.lugares['mano:izq'] = { tipo: 'junco', n: 1 };
    const rb = fab.depositar('ana', c.id, 'mano:der', undefined, { x: 30, z: 0 }, q), rm = fab.depositar('ana', c.id, 'mano:izq', undefined, { x: 30, z: 0 }, q);
    comprobar('y guarda el barro, no los juncos', rb.ok && fab.estaciones[c.id].deposito.barro === 1 && !rm.ok, `${rb.motivo || ''} ${rm.motivo || ''}`); }
  // los colgaderos (valravnx, 8 nov): de dentro y colgados en un muro
  {
    const sube = (tipo, x) => {
      const i = jugador(); for (const [t, n] of Object.entries(E[tipo].coste)) i.meterDonde(t, n);
      const c = fab.colocar('ana', tipo, x, 0, true, null, true); if (!c.ok) throw new Error(c.motivo);
      fab.entregarEstacion('ana', c.id, { x, z: 0 }, i, null, T0);
      for (let k = 0; k < 10 && fab.estaciones[c.id].obra; k++) fab.trabajarEstacion('ana', c.id, MAX_RATO_ESTACION, { x, z: 0 }, i);
      return c.id;
    };
    comprobar('los colgaderos, solo dentro', !fab.colocar('ana', 'colgadero_mochilas', 40, 0, false, null, true).ok && !fab.colocar('ana', 'colgadero_herramientas', 40, 0, false, null, true).ok);
    const cm = sube('colgadero_mochilas', 40), ch = sube('colgadero_herramientas', 45);
    comprobar('se levantan con su coste (varas, ramas y cordel; varas y cordel)', !fab.estaciones[cm].obra && !fab.estaciones[ch].obra);
    // la mochila que llevas a la espalda, vacía, se cuelga tal cual; llena, no
    const q = Inventario.inicial(); q.lugares.espalda = { tipo: 'lenero', n: 1, dentro: [] };
    r = fab.depositar('ana', cm, 'espalda', undefined, { x: 40, z: 0 }, q);
    comprobar('el leñero vacío, de la espalda al colgadero', r.ok && !q.lugares.espalda && fab.estaciones[cm].deposito.lenero === 1, r.motivo);
    const ll = Inventario.inicial(); ll.lugares.espalda = { tipo: 'porta_piedras', n: 1, dentro: [{ tipo: 'piedra', n: 2 }] };
    r = fab.depositar('ana', cm, 'espalda', undefined, { x: 40, z: 0 }, ll);
    comprobar('con algo dentro, no: vacíalo antes', !r.ok && /Vacíalo/.test(r.motivo || '') && ll.lugares.espalda, r.motivo);
    q.lugares['mano:der'] = { tipo: 'piedra', n: 1 };
    r = fab.depositar('ana', cm, 'mano:der', undefined, { x: 40, z: 0 }, q);
    comprobar('el colgadero de mochilas no guarda piedras', !r.ok && /solo guarda/.test(r.motivo || ''), r.motivo);
    r = fab.retirar('ana', cm, 'lenero', 1, { x: 40, z: 0 }, q);
    comprobar('al descolgarlo, a la espalda si está libre', r.ok && q.lugares.espalda && q.lugares.espalda.tipo === 'lenero' && !fab.estaciones[cm].deposito.lenero, r.motivo);
    // las herramientas
    const h = jugador(); h.lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 }; h.lugares['mano:izq'] = { tipo: 'rama', n: 1 };
    const rh = fab.depositar('ana', ch, 'mano:der', undefined, { x: 45, z: 0 }, h), rr = fab.depositar('ana', ch, 'mano:izq', undefined, { x: 45, z: 0 }, h);
    comprobar('el colgadero de herramientas guarda el hacha y no la rama', rh.ok && fab.estaciones[ch].deposito.hacha_piedra === 1 && !rr.ok, `${rh.motivo || ''} ${rr.motivo || ''}`);
    comprobar(`le caben ${cabeEn('colgadero_herramientas')} herramientas y ${cabeEn('colgadero_mochilas')} mochilas`, cabeEn('colgadero_herramientas') === 8 && cabeEn('colgadero_mochilas') === 4);
    // el muro: el servidor pega el colgadero a la cara de un muro lleno, mirando a la habitación; sin muro, no se pone
    const m = new Mundo(), cons = { ox: 100, oz: 0, rot: 0, piezas: new Map() };
    const muro = (tipo, i, j, d, obra = false) => cons.piezas.set(clave('e', i, j, 0, d), { tipo, hueco: 'e', i, j, k: 0, d, ...(obra ? { obra: {} } : {}) });
    muro('muro_tronco', 0, 0, 0); muro('muro_tronco_puerta', 0, 1, 0); muro('muro_tronco', 2, 0, 1, true);
    m.construcciones = new Map([[1, cons]]);
    const a = m.muroCercano(101, 0.4, 1);
    comprobar('muroCercano: pegado a la cara del muro, del lado de dentro, mirando a +Z', a && Math.abs(a.x - 101) < 1e-6 && Math.abs(a.z - 0.17) < 1e-6 && Math.abs(a.giro) < 1e-6, JSON.stringify(a));
    const b = m.muroCercano(100.1, -0.3, 1);
    comprobar('del otro lado mira al otro lado, y lejos de la esquina', b && Math.abs(b.z + 0.17) < 1e-6 && Math.abs(Math.abs(b.giro) - Math.PI) < 1e-3 && b.x >= 100.8 - 1e-6, JSON.stringify(b));
    comprobar('ni en un muro con puerta ni en uno en obras', !m.muroCercano(101, 2.3, 0.5) && !m.muroCercano(104.2, 1, 0.5));
    const invs = new Inventarios(), reg = new RegistroAcciones();
    const alMuro = (x, z) => m.muroCercano(x, z, 0.5);
    r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'colocar_estacion', estacion: 'colgadero_herramientas', x: 101.2, z: 0.17 }, T0, null, () => true, () => true, alMuro);
    comprobar('en línea: junto al muro se pone, pegado y girado', r.ok && fab.estaciones[r.id].z === 0.17 && fab.estaciones[r.id].giro === 0, r.motivo);
    r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'colocar_estacion', estacion: 'colgadero_herramientas', x: 101, z: 1.2 }, T0, null, () => true, () => true, alMuro);
    comprobar('en medio del cuarto, no', !r.ok && /muro/.test(r.motivo || ''), r.motivo);
  }
}

console.log('De qué sitio sale cada cosa: la mano, el cinturón o el suelo');
{
  const fab = new Fabricacion(), inv = jugador(), suelo = new Suelo();
  inv.lugares['mano:der'] = { tipo: 'fibra', n: 1 };
  inv.lugares.cintura.dentro[0] = { tipo: 'fibra', n: 1 };
  suelo.dejar({ tipo: 'fibra', n: 4 }, 0.3, 0, T0, 'ana', false);
  const c = cuentas({ fibra: 3 }, inv, sueloCerca(suelo, { x: 0, z: 0 }, T0)).de.fibra;
  comprobar('1 de la mano, 1 del cinturón y 1 del suelo', c.sitios.mano === 1 && c.sitios.cinturon === 1 && c.sitios.suelo === 1 && c.encima === 2, JSON.stringify(c));
  comprobar('SITIO_DE_RUTA nombra cada sitio', SITIO_DE_RUTA('mano:izq') === 'mano' && SITIO_DE_RUTA('cintura/1') === 'cinturon' && SITIO_DE_RUTA('espalda/0') === 'mochila' && SITIO_DE_RUTA('hombro') === 'hombro');
  const le = fab.listaEstaciones(), pt = le.find(e => e.tipo === 'piedra_tallar'), bt = le.find(e => e.tipo === 'banco_tronco');
  comprobar('los puestos que se pueden poner (el menú de construcción), con su coste, su herramienta y dónde van', le.length === Object.keys(ESTACIONES).length && igual(pt.coste, { piedra: 1 }) && bt.requiere.includes('lasca_silex') && pt.donde === 'ambos', JSON.stringify(pt));
}

console.log('Si no te cabe');
{
  const fab = new Fabricacion(), inv = Inventario.inicial(); // sin cinturón ni mochila: solo las manos
  inv.lugares['mano:der'] = { tipo: 'fibra', n: 3 };
  const r1 = fab.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, inv, null, T0);
  inv.lugares['mano:der'] = { tipo: 'piedra', n: 1 }; inv.lugares['mano:izq'] = { tipo: 'piedra', n: 1 };
  const r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + 3600e3);
  comprobar('con las manos llenas no se recoge y lo hecho sigue esperando', r1.ok && !r.ok && fab.manos.ana.length === 1, r.motivo);
  inv.lugares['mano:izq'] = null;
  comprobar('al hacer sitio, se recoge', fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + 3600e3).ok && inv.cuantos('cordel') === 1);
}

console.log('Guardar y cargar');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('piedra', 2); inv.meterDonde('silex', 1); inv.meterDonde('fibra', 3);
  const id = levantar(fab, 'ana', 'piedra_tallar', 4, 4, inv);
  depositar(fab, id, { silex: 1, piedra: 1, rama: 2 });
  fab.fabricar('ana', 'lasca_silex', id, { x: 4, z: 4 }, inv, null, T0);
  fab.fabricar('ana', 'cordel', null, { x: 4, z: 4 }, inv, null, T0);
  const datos = JSON.parse(JSON.stringify(fab.exportar()));
  const otra = new Fabricacion().importar(datos);
  comprobar('se guarda la versión', datos.version === VERSION_FABRICACION && VERSION_FABRICACION === 6);
  comprobar('al cargar, las estaciones, sus colas, lo depositado y lo de las manos son lo mismo', igual(otra.exportar(), fab.exportar()) && igual(otra.estaciones[id].deposito, { rama: 2 }));
  const malo = JSON.parse(JSON.stringify(datos)); malo.estaciones[0].deposito = { rama: 2, nada: 3, piedra: -1, silex: 1.5, toString: 1, fibra: DEPOSITO_MAX };
  comprobar('lo depositado que no vale se descarta (tipos que no existen, cantidades raras, más del máximo)', igual(new Fabricacion().importar(malo).estaciones[id].deposito, { rama: 2 }));
  comprobar('ya no se guarda lo que sabe cada uno', !('saber' in datos));
  const x = new Fabricacion().importar(datos);
  comprobar('y se sigue contando por la hora: lo que acabó mientras tanto se recoge', x.recoger('ana', id, { x: 4, z: 4 }, inv, T0 + 86400e3).ok);
  const roto = { version: VERSION_FABRICACION, estaciones: [{ id: 'z:1', tipo: 'altar', x: 0, z: 0, cola: [] }, { id: 'h:1', tipo: 'hoguera', x: 0, z: 0, cola: [{ autor: 'a', receta: 'nada', empieza: 0, fin: 1 }, { autor: 'a', receta: 'lasca_silex', empieza: 0, fin: 1 }] }],
    manos: { a: [{ autor: 'a', receta: 'lanza_endurecida', empieza: 0, fin: 1 }] } };
  const y = new Fabricacion().importar(roto);
  comprobar('lo que no se entiende se descarta (estación o receta que no existe, receta de otro uso)', !y.estaciones['z:1'] && y.estaciones['h:1'] && y.estaciones['h:1'].cola.length === 0 && !y.manos.a);
  // migraciones: la v1 y la v2 (que guardaba lo que sabía cada uno)
  const v1 = { version: 1, siguiente: 3, estaciones: [{ id: 'piedra_tallar:1', tipo: 'piedra_tallar', x: 0, z: 0, autor: 'ana', cola: [{ autor: 'ana', receta: 'lasca_silex', empieza: T0, fin: T0 + 20000 }] }, { id: 'hoguera:2', tipo: 'hoguera', x: 5, z: 0, autor: 'blas', cola: [{ autor: 'blas', receta: 'lanza_endurecida', empieza: T0, fin: T0 + 60000 }] }], manos: {} };
  const m = new Fabricacion().importar(JSON.parse(JSON.stringify(v1)));
  comprobar('un guardado de la v1 se carga: estaciones y colas siguen', m.estaciones['piedra_tallar:1'] && m.estaciones['piedra_tallar:1'].cola.length === 1 && m.estaciones['hoguera:2'].cola.length === 1 && m.siguiente === 3);
  const v2 = { ...JSON.parse(JSON.stringify(v1)), version: 2, saber: { ana: { conoce: ['lasca_silex'], practica: { piedra_tallar: 1 } } } };
  const m2 = new Fabricacion().importar(v2);
  comprobar('un guardado de la v2 se carga sin lo que sabía cada uno', igual(m2.exportar().estaciones, m.exportar().estaciones) && !('saber' in m2.exportar()) && m2.exportar().version === 6);
  comprobar('un guardado de la v3 se carga con las estaciones vacías (nada depositado)', Object.values(m.estaciones).every(e => igual(e.deposito, {})));
  const blas = jugador(); depositar(m2, 'piedra_tallar:1', { silex: 1, piedra: 1 });
  comprobar('y con él, cualquiera hace cualquier receta (Blas, la lasca en la piedra de tallar de Ana)', m2.fabricar('blas', 'lasca_silex', null, { x: 0, z: 0 }, blas, null, T0).ok);
  const fo = new Fabricacion(), ob = fo.colocar('ana', 'hoguera', 1, 1).id, invO = jugador(); invO.meterDonde('piedra', 2);
  fo.entregarEstacion('ana', ob, { x: 1, z: 1 }, invO, null, T0);
  const dObra = JSON.parse(JSON.stringify(fo.exportar())), cargada = new Fabricacion().importar(dObra).estaciones[ob];
  comprobar('un marco a medio hacer se guarda y se carga con lo entregado', cargada.obra && igual(cargada.obra.entregado, { piedra: 2 }) && igual(cargada.obra, fo.estaciones[ob].obra));
  dObra.estaciones[0].obra.entregado = { piedra: 99, nada: 1, rama: 1.5 };
  comprobar('lo entregado que no vale se descarta, y no pasa de su coste', igual(new Fabricacion().importar(dObra).estaciones[ob].obra.entregado, { piedra: 6 }));
  const v4 = { version: 4, siguiente: 3, estaciones: [{ id: 'hoguera:1', tipo: 'hoguera', x: 0, z: 0, autor: 'ana', cola: [], deposito: {} }], manos: {} };
  comprobar('lo guardado en la v4 se carga con sus estaciones ya levantadas', (() => { const e = new Fabricacion().importar(v4).estaciones['hoguera:1']; return e && !e.obra; })());
  comprobar('un guardado sin versión no se carga', migrarFabricacion({ estaciones: [] }) === null && Object.keys(new Fabricacion().importar(null).estaciones).length === 0);
}

console.log('Acciones con autor');
{
  const fab = new Fabricacion(), invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
  const ana = invs.de('ana'); ana.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  ana.meterDonde('piedra', 2);
  const sx = suelo.dejar({ tipo: 'silex', n: 1 }, 0.5, 0, T0, 'ana', false);
  let r = ejecutarFabricacion(fab, invs, reg, { tipo: 'colocar_estacion', estacion: 'piedra_tallar', x: 0, z: 0 }, T0, suelo);
  comprobar('sin autor no vale', !r.ok && /autor/.test(r.motivo));
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'colocar_estacion', estacion: 'piedra_tallar', x: 0, z: 0 }, T0, suelo);
  const id = r.id;
  comprobar('el marco, con autor, no gasta nada', r.ok && r.obra && ana.cuantos('piedra') === 2);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'entregar_estacion', estacion: id, x: 0, z: 0 }, T0, suelo);
  comprobar('entregarle con autor gasta de lo de Ana', r.ok && ana.cuantos('piedra') === 1, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'trabajar_estacion', estacion: id, segundos: 5, x: 0, z: 0 }, T0, suelo);
  comprobar('y trabajar en él lo levanta', r.ok && r.terminada && !fab.estaciones[id].obra, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'blas', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 0, z: 0 }, T0, suelo);
  comprobar('Blas no fabrica con lo que lleva Ana', !r.ok && ana.cuantos('piedra') === 1, r.motivo);
  ana.meterDonde('silex', 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon('silex')[0], x: 0, z: 0 }, T0, suelo);
  comprobar('Ana deposita su sílex con autor', r.ok && ana.cuantos('silex') === 0 && fab.estaciones[id].deposito.silex === 1, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon('piedra')[0], cantidad: 1.5, x: 0, z: 0 }, T0, suelo);
  comprobar('cantidades raras no cuelan', !r.ok && /no válidos/.test(r.motivo), r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon('piedra')[0], cantidad: 1, x: 0, z: 0 }, T0, suelo);
  comprobar('y su piedra', r.ok && ana.cuantos('piedra') === 0, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'lasca_silex', estacion: null, x: 0, z: 0, fin: 0 }, T0, suelo);
  comprobar('fabrica con lo depositado (el sílex del suelo no se toca), y el tiempo lo pone quien valida, no el mensaje', r.ok && r.encargo.fin === T0 + RECETAS.lasca_silex.s * 1000 && suelo.objetos.includes(sx), r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 0, z: 0 }, T0 + 3600e3, suelo);
  comprobar('recoger con autor', r.ok && ana.cuantos('lasca_silex') === 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'toString', estacion: id, x: 0, z: 0 }, T0, suelo);
  comprobar('nombres raros de receta no cuelan', !r.ok);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 'a', z: 0 }, T0, suelo);
  comprobar('datos no válidos', !r.ok && /no válidos/.test(r.motivo));
  comprobar('todo queda en el registro, salga bien o no', reg.entradas.length === 12 && reg.entradas.filter(e => e.ok).length === 7 && reg.entradas[1].resultado.estacion === id && reg.entradas[1].resultado.obra && igual(reg.entradas[2].resultado, { estacion: id, entregado: { piedra: 1 } }) && reg.entradas[3].resultado.terminada);
  comprobar('el registro anota lo depositado, en qué estación se hizo y lo que se gastó de ella', igual(reg.entradas[5].resultado, { estacion: id, dejado: { silex: 1 } }) && reg.entradas[8].resultado.estacion === id && igual(reg.entradas[8].resultado.deLaEstacion, { silex: 1, piedra: 1 }), JSON.stringify(reg.entradas[8].resultado));
  ana.meterDonde('rama', 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: ana.rutasCon('rama')[0], x: 0, z: 0 }, T0, suelo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'retirar_estacion', estacion: id, objeto: 'rama', x: 0, z: 0 }, T0, suelo);
  comprobar('y lo que se vuelve a coger', r.ok && ana.cuantos('rama') === 1 && igual(reg.entradas[reg.entradas.length - 1].resultado, { estacion: id, cogido: { rama: 1 } }), r.motivo);
}

// ---------------- Las camas (P4, la cama ligada; valravnx, 8 nov) ----------------
{
  const fab = new Fabricacion(), E = ESTACIONES, T0 = 1e6;
  comprobar('dos camas: el refugio de ramas (fuera) y la cama de juncos (dentro), sin recetas ni nada que guardar',
    CAMAS.join() === 'refugio_ramas,cama_juncos' && E.refugio_ramas.donde === 'fuera' && E.cama_juncos.donde === 'dentro' && !Object.values(RECETAS).some(r => r.uso === 'cama'));
  comprobar('el refugio, de 12 ramas y 4 cordel; la cama, de juncos y cordel (todo sale del mundo)',
    E.refugio_ramas.coste.rama === 12 && E.refugio_ramas.coste.cordel === 4 && Object.keys(E.cama_juncos.coste).sort().join() === 'cordel,junco');
  const sube = (tipo, x, dentro, autor = 'ana') => {
    const i = jugador(); for (const [t, n] of Object.entries(E[tipo].coste)) i.meterDonde(t, n);
    const c = fab.colocar(autor, tipo, x, 0, dentro, null, true); if (!c.ok) throw new Error(c.motivo);
    fab.entregarEstacion(autor, c.id, { x, z: 0 }, i, null, T0);
    for (let k = 0; k < 20 && fab.estaciones[c.id].obra; k++) fab.trabajarEstacion(autor, c.id, MAX_RATO_ESTACION, { x, z: 0 }, i);
    return c.id;
  };
  comprobar('el refugio no va bajo techo y la cama no va fuera', !fab.colocar('ana', 'refugio_ramas', 0, 0, true, null, true).ok && !fab.colocar('ana', 'cama_juncos', 0, 0, false, null, true).ok);
  const fuera = fab.colocar('ana', 'refugio_ramas', 0, 0, false, null, false);
  comprobar('ni fuera de una tierra', !fuera.ok && /tu tierra/.test(fuera.motivo || ''), fuera.motivo);
  const marco = fab.colocar('ana', 'refugio_ramas', 5, 0, false, null, true);
  let r = fab.ligarCama('ana', marco.id, { x: 5, z: 0 }, true);
  comprobar('a medias no se liga', !r.ok && /a medias/.test(r.motivo || ''), r.motivo);
  const ref = sube('refugio_ramas', 10, false), cama = sube('cama_juncos', 20, true);
  comprobar('se levantan con su coste', !fab.estaciones[ref].obra && !fab.estaciones[cama].obra);
  r = fab.dormir('ana', ref, { x: 10, z: 0 });
  comprobar('sin ligarla no se duerme en ella', !r.ok && /ligada/.test(r.motivo || ''), r.motivo);
  r = fab.ligarCama('ana', ref, { x: 10, z: 0 }, false);
  comprobar('en tierra de nadie no se liga', !r.ok && /tu tierra/.test(r.motivo || ''), r.motivo);
  r = fab.ligarCama('ana', ref, { x: 30, z: 0 }, true);
  comprobar('de lejos, tampoco', !r.ok && /lejos/.test(r.motivo || ''), r.motivo);
  r = fab.ligarCama('ana', ref, { x: 10, z: 0 }, true);
  comprobar('ligada (en tu tierra o en la de quien te invita)', r.ok && fab.camaDe('ana') === ref, r.motivo);
  r = fab.dormir('ana', ref, { x: 10, z: 0 });
  comprobar('y se duerme en ella', r.ok && r.dormir, r.motivo);
  r = fab.ligarCama('ana', cama, { x: 20, z: 0 }, true);
  comprobar('una por personaje: al ligar la cama de juncos, el refugio deja de ser la suya', r.ok && fab.camaDe('ana') === cama && !fab.estaciones[ref].ligadas, r.motivo);
  r = fab.dormir('ana', ref, { x: 10, z: 0 });
  comprobar('y en el refugio ya no duerme', !r.ok, r.motivo);
  r = fab.ligarCama('bea', cama, { x: 20, z: 0 }, true);
  comprobar('la pareja puede ligar la misma cama', r.ok && fab.camaDe('bea') === cama && fab.camaDe('ana') === cama, r.motivo);
  const otra = new Fabricacion().importar(JSON.parse(JSON.stringify(fab.exportar())));
  comprobar('lo ligado se guarda y se vuelve a leer', otra.camaDe('ana') === cama && otra.camaDe('bea') === cama);
  const datos = fab.exportar(); datos.estaciones.find(e => e.id === ref).ligadas = ['x', 7, 'x', ''];
  comprobar('lo guardado raro se limpia', JSON.stringify(new Fabricacion().importar(datos).estaciones[ref].ligadas) === '["x"]');
  const piedra = fab.colocar('ana', 'piedra_tallar', 25, 0, false, null, true);
  r = fab.ligarCama('ana', piedra.id, { x: 25, z: 0 }, true);
  comprobar('lo que no es cama no se liga', !r.ok && /no es una cama/.test(r.motivo || ''), r.motivo);
  const invs = new Inventarios(), reg = new RegistroAcciones();
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'cai', tipo: 'ligar_cama', estacion: cama, x: 20, z: 0 }, T0, null, () => true);
  comprobar('con autor, ligar y dormir quedan en el registro', r.ok && reg.entradas[0].resultado.ligada
    && ejecutarFabricacion(fab, invs, reg, { autor: 'cai', tipo: 'dormir', estacion: cama, x: 20, z: 0 }, T0).ok && reg.entradas[1].resultado.dormir);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'cai', tipo: 'ligar_cama', estacion: ref, x: 10, z: 0 }, T0, null, () => false);
  comprobar('y la tierra la dice el servidor (enTierras)', !r.ok, r.motivo);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
