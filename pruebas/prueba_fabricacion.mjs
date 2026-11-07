// Pruebas de fabricar (src/logica/fabricacion.js): recetas siempre a la vista, por uso, con lo que llevas y lo del
// suelo a tu lado (revisión del 1 nov); las de una estación, con lo depositado en ella (valravnx, 6 nov). Ejecutar: node pruebas/prueba_fabricacion.mjs
// Con MUTAR=1 el hacha de piedra no gasta cordel y se hace al momento, la hoguera deja de dar el fuego y se puede poner
// bajo techo, y el banco se levanta sin trabajo:
// las pruebas deben FALLAR.
import { ESTACIONES, RECETAS, USOS, Fabricacion, ejecutarFabricacion, sueloCerca, cuentas, SITIO_DE_RUTA, estacionesDeUso, ALCANCE_ESTACION, ALCANCE_SUELO,
  COLA_ESTACION, VERSION_FABRICACION, migrarFabricacion, DEPOSITO_MAX, cuentasEstacion, MAX_RATO_ESTACION } from '../src/logica/fabricacion.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { Mundo, clave } from '../src/logica/construccion.js';
import { MODULO } from '../src/logica/piezas.js';

if (process.env.MUTAR === '1') { delete RECETAS.hacha_piedra.gasta.cordel; RECETAS.hacha_piedra.s = 0; ESTACIONES.hoguera.uso = 'tallar'; ESTACIONES.hoguera.donde = 'ambos'; ESTACIONES.banco_tronco.trabajo = 0; }
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
  comprobar('cada estación da un uso que la nombra, y dice cómo se nombra en una frase', Object.entries(E).every(([t, e]) => USOS[e.uso] && USOS[e.uso].estaciones.includes(t) && /^una? /.test(e.un)));
  comprobar('de los usos, solo falta el hogar como estación (llega con la casa humilde)', igual(Object.values(USOS).flatMap(u => u.estaciones).filter(t => !E[t]), ['hogar']) && igual(estacionesDeUso('fuego'), ['hoguera']));
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
  ESTACIONES.prueba_hogar = { ...ESTACIONES.piedra_tallar, nombre: 'Hogar', donde: 'dentro' };
  comprobar('lo que va solo dentro (el hogar, con su tarea), fuera no', !fab.colocar('ana', 'prueba_hogar', 0, 0, false).ok && fab.colocar('ana', 'prueba_hogar', 0, 0, true).ok);
  delete ESTACIONES.prueba_hogar;
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
  comprobar('salen todas las recetas, sin conocer ninguna', l.length === Object.keys(RECETAS).length && igual(l.map(x => x.receta), Object.keys(RECETAS)));
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
  comprobar('se guarda la versión', datos.version === VERSION_FABRICACION && VERSION_FABRICACION === 5);
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
  comprobar('un guardado de la v2 se carga sin lo que sabía cada uno', igual(m2.exportar().estaciones, m.exportar().estaciones) && !('saber' in m2.exportar()) && m2.exportar().version === 5);
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

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
