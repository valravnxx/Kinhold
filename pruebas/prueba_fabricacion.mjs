// Pruebas de fabricar (src/logica/fabricacion.js): recetas siempre a la vista, por uso, con lo que llevas y lo del
// suelo a tu lado (revisión del 1 nov). Ejecutar: node pruebas/prueba_fabricacion.mjs
// Con MUTAR=1 el hacha de piedra no gasta cordel y se hace al momento, y la hoguera deja de dar el fuego:
// las pruebas deben FALLAR.
import { ESTACIONES, RECETAS, USOS, Fabricacion, ejecutarFabricacion, sueloCerca, cuentas, SITIO_DE_RUTA, estacionesDeUso, ALCANCE_ESTACION, ALCANCE_SUELO,
  COLA_ESTACION, VERSION_FABRICACION, migrarFabricacion } from '../src/logica/fabricacion.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') { delete RECETAS.hacha_piedra.gasta.cordel; RECETAS.hacha_piedra.s = 0; ESTACIONES.hoguera.uso = 'tallar'; }
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

console.log('Colocar estaciones, con lo que llevas y lo del suelo');
{
  const fab = new Fabricacion(), inv = jugador(), suelo = new Suelo();
  let r = fab.colocar('ana', 'hoguera', 0, 0, inv, suelo, T0);
  comprobar('sin materiales no se coloca, y dice qué falta', !r.ok && r.faltan.piedra === 6 && r.faltan.rama === 4, r.motivo);
  inv.meterDonde('piedra', 3); inv.meterDonde('rama', 3);
  suelo.dejar({ tipo: 'piedra', n: 5 }, 1, 0, T0, 'ana', false);
  const ramas = suelo.dejar({ tipo: 'rama', n: 2 }, 0, 1, T0, 'ana', false);
  const lejos = suelo.dejar({ tipo: 'rama', n: 50 }, 20, 0, T0, 'ana', false);
  r = fab.colocar('ana', 'hoguera', 0, 0, inv, suelo, T0);
  comprobar('con lo que llevas y lo del suelo al lado, se coloca', r.ok, r.motivo || r.id);
  const pila = suelo.objetos.find(o => o.cosa.tipo === 'piedra');
  comprobar('gasta primero lo que llevas y luego lo del suelo', inv.cuantos('piedra') === 0 && inv.cuantos('rama') === 0 && pila.cosa.n === 2 && ramas.cosa.n === 1, JSON.stringify(r.usado));
  comprobar('lo del suelo lejos no se toca ni cuenta', lejos.cosa.n === 50 && sueloCerca(suelo, { x: 0, z: 0 }, T0).every(o => o !== lejos) && ALCANCE_SUELO < 20);
  const inv2 = jugador(); inv2.lugares.hombro = { tipo: 'tronco_corto', n: 1 }; inv2.lugares['mano:der'] = { tipo: 'tronco_corto', n: 1 };
  r = fab.colocar('ana', 'banco_tronco', 5, 5, inv2, null, T0);
  comprobar('el banco de tronco pide llevar una herramienta de piedra', !r.ok && /hacha de piedra/.test(r.motivo), r.motivo);
  inv2.meterDonde('lasca_silex', 1);
  r = fab.colocar('ana', 'banco_tronco', 5, 5, inv2, null, T0);
  comprobar('con una lasca y 2 troncos cortos (uno al hombro), se coloca y la lasca no se gasta', r.ok && inv2.cuantos('tronco_corto') === 0 && inv2.cuantos('lasca_silex') === 1, r.motivo || r.id);
  comprobar('una estación desconocida no se coloca', !fab.colocar('ana', 'constructor', 0, 0, inv, suelo, T0).ok && !fab.colocar('ana', '__proto__', 0, 0, inv, suelo, T0).ok);
  comprobar('colocar no enseña nada (nadie aprende recetas)', !('aprendidas' in r));
}

console.log('Fabricar con las manos, en cualquier sitio: el cordel');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('fibra', 7);
  let r = fab.fabricar('ana', 'cordel', null, { x: 123, z: -456 }, inv, null, T0);
  comprobar('cordel con 3 fibra, en medio de ninguna parte: se encarga', r.ok && inv.cuantos('fibra') === 4, r.motivo);
  comprobar('termina pasado su tiempo', r.ok && r.encargo.fin === T0 + RECETAS.cordel.s * 1000);
  r = fab.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, inv, null, T0 + 1000);
  comprobar('con las manos, una cosa a la vez', !r.ok && inv.cuantos('fibra') === 4, r.motivo);
  r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + 5000);
  comprobar('antes de tiempo no se recoge', !r.ok, r.motivo);
  const antes = inv.cuantos('cordel');
  r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + RECETAS.cordel.s * 1000);
  comprobar('pasado el tiempo se recoge y va a lo que llevas', r.ok && inv.cuantos('cordel') === antes + 1, r.motivo || JSON.stringify(r.dados));
  comprobar('el cinturón de cordel puesto no se gasta nunca', inv.lugares.cintura && inv.lugares.cintura.tipo === 'cordel');
  r = fab.fabricar('ana', 'hacha_piedra', null, { x: 0, z: 0 }, inv, null, T0);
  comprobar('el hacha de piedra no se hace con las manos: pide la piedra de tallar', !r.ok && /piedra de tallar/.test(r.motivo), r.motivo);
  r = fab.fabricar('ana', 'cordel', 'hoguera:1', { x: 0, z: 0 }, inv, null, T0 + 100000);
  comprobar('el cordel no se hace en una estación', !r.ok, r.motivo);
  // con la fibra en el suelo, a tus pies
  const f2 = new Fabricacion(), i2 = jugador(), suelo = new Suelo();
  const fibra = suelo.dejar({ tipo: 'fibra', n: 3 }, 0.5, 0, T0, 'blas', false);
  r = f2.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, i2, suelo, T0);
  comprobar('con la fibra en el suelo a tu lado, sin llevar nada, se hace el cordel', r.ok && !suelo.objetos.includes(fibra) && igual(r.usado.suelo, { [fibra.id]: { fibra: 3 } }), r.motivo);
  const f3 = new Fabricacion(), s3 = new Suelo(); s3.dejar({ tipo: 'fibra', n: 3 }, ALCANCE_SUELO + 0.5, 0, T0, 'blas', false);
  r = f3.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, jugador(), s3, T0);
  comprobar('si la fibra está a más de un paso, no', !r.ok && r.faltan.fibra === 3, r.motivo);
  const s4 = new Suelo(); s4.dejar({ tipo: 'fibra', n: 3 }, 0, 0, T0, 'blas', false);
  r = new Fabricacion().fabricar('ana', 'cordel', null, { x: 0, z: 0 }, jugador(), s4, T0 + 2 * 3600e3);
  comprobar('lo que ya ha desaparecido del suelo no cuenta', !r.ok, r.motivo);
  const s5 = new Suelo(); s5.dejar({ tipo: 'lenero', n: 1, dentro: [{ tipo: 'rama', n: 4 }] }, 0, 0, T0, 'blas', false);
  r = new Fabricacion().fabricar('ana', 'palo_cavador', null, { x: 0, z: 0 }, jugador(), s5, T0);
  comprobar('lo que hay dentro de un contenedor del suelo no se gasta', !r.ok && r.faltan.rama === 1, r.motivo);
}

console.log('Fabricar por uso: piedra de tallar y fuego');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('piedra', 3); inv.meterDonde('silex', 1); inv.meterDonde('rama', 3);
  const tallar = fab.colocar('ana', 'piedra_tallar', 10, 0, inv, null, T0).id;
  comprobar('la piedra de tallar gasta 1 piedra', inv.cuantos('piedra') === 2);
  let r = fab.fabricar('ana', 'lasca_silex', tallar, { x: 20, z: 0 }, inv, null, T0);
  comprobar('lejos de la estación no se fabrica', !r.ok && inv.cuantos('silex') === 1, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', null, { x: 20, z: 0 }, inv, null, T0);
  comprobar('sin decir la estación y sin ninguna al lado, dice cuál hace falta', !r.ok && /piedra de tallar/.test(r.motivo) && inv.cuantos('silex') === 1, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', null, { x: 10 + ALCANCE_ESTACION - 0.1, z: 0 }, inv, null, T0);
  comprobar('junto a ella, sin decir cuál, la lasca usa la más cercana y gasta 1 sílex y 1 piedra', r.ok && r.estacion === tallar && inv.cuantos('silex') === 0 && inv.cuantos('piedra') === 1, r.motivo);
  r = fab.fabricar('ana', 'hacha_piedra', tallar, { x: 10, z: 0 }, inv, null, T0);
  comprobar('el hacha, siempre a la vista: sin cordel no se encarga y no gasta nada', !r.ok && r.faltan && r.faltan.cordel === 2 && inv.cuantos('piedra') === 1 && inv.cuantos('rama') === 3, r.motivo);
  inv.meterDonde('cordel', 1); inv.meterDonde('cordel', 1);
  r = fab.fabricar('ana', 'hacha_piedra', tallar, { x: 10, z: 0 }, inv, null, T0 + 1000);
  const finLasca = T0 + RECETAS.lasca_silex.s * 1000;
  comprobar('con 2 cordel sí, sin haber hecho nada antes en ella, y gasta piedra, rama y los dos cordeles', r.ok && inv.cuantos('piedra') === 0 && inv.cuantos('rama') === 2 && inv.cuantos('cordel') === 1, r.motivo || JSON.stringify(r.usado));
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
  r = fab.fabricar('blas', 'lasca_silex', null, { x: 10, z: 1 }, invB, null, T0 + 3600e3);
  comprobar('Blas usa la piedra de tallar de Ana sin haber construido una', r.ok && r.estacion === tallar && invB.cuantos('silex') === 0, r.motivo);
  // el fuego: la cola de la hoguera, con ramas del suelo
  const inv3 = jugador(), suelo = new Suelo(); inv3.meterDonde('piedra', 6); inv3.meterDonde('rama', 3); inv3.meterDonde('rama', 1);
  const hog = fab.colocar('blas', 'hoguera', 0, 0, inv3, suelo, T0).id;
  inv3.meterDonde('rama', 1);
  suelo.dejar({ tipo: 'rama', n: 10 }, 1, 0, T0, 'blas', true);
  let n = 0;
  for (let i = 0; i < COLA_ESTACION + 1; i++) if (fab.fabricar('blas', 'lanza_endurecida', null, { x: 1, z: 0 }, inv3, suelo, T0).ok) n++;
  comprobar('la lanza se hace al fuego de la hoguera', n > 0);
  comprobar(`la cola de una estación admite ${COLA_ESTACION} encargos sin terminar`, n === COLA_ESTACION, `${n}`);
  const enSuelo = suelo.objetos.find(o => o.cosa.tipo === 'rama');
  comprobar('las ramas salieron de lo que lleva y del suelo a su lado', inv3.cuantos('rama') === 0 && enSuelo.cosa.n === 10 - (COLA_ESTACION - 1), JSON.stringify(enSuelo.cosa));
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
  fab.colocar('ana', 'piedra_tallar', 1, 0, inv, null, T0);
  l = fab.lista({ x: 0, z: 0 }, inv, suelo, T0);
  comprobar('con la piedra de tallar al lado, la lasca ya, con el sílex del suelo', de('lasca_silex').grupo === 'ya' && de('lasca_silex').de.silex.suelo === 1 && de('lasca_silex').de.silex.sitios.suelo === 1 && de('lasca_silex').de.piedra.encima === 1 && de('lasca_silex').estacion, JSON.stringify(de('lasca_silex')));
  comprobar('y el hacha, casi', de('hacha_piedra').grupo === 'casi');
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
  const le = fab.listaEstaciones({ x: 0, z: 0 }, inv, suelo, T0), pt = le.find(e => e.tipo === 'piedra_tallar'), bt = le.find(e => e.tipo === 'banco_tronco');
  comprobar('las estaciones que se pueden poner, con su coste y qué falta', le.length === Object.keys(ESTACIONES).length && !pt.puede && igual(pt.faltan, { piedra: 1 }) && !bt.puede && bt.sinHerramienta, JSON.stringify(pt));
  inv.meterDonde('piedra', 1);
  comprobar('con una piedra, la piedra de tallar se puede poner', fab.listaEstaciones({ x: 0, z: 0 }, inv, suelo, T0).find(e => e.tipo === 'piedra_tallar').puede);
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
  const id = fab.colocar('ana', 'piedra_tallar', 4, 4, inv, null, T0).id;
  fab.fabricar('ana', 'lasca_silex', id, { x: 4, z: 4 }, inv, null, T0);
  fab.fabricar('ana', 'cordel', null, { x: 4, z: 4 }, inv, null, T0);
  const datos = JSON.parse(JSON.stringify(fab.exportar()));
  const otra = new Fabricacion().importar(datos);
  comprobar('se guarda la versión', datos.version === VERSION_FABRICACION && VERSION_FABRICACION === 3);
  comprobar('al cargar, las estaciones, sus colas y lo de las manos son lo mismo', igual(otra.exportar(), fab.exportar()));
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
  comprobar('un guardado de la v2 se carga sin lo que sabía cada uno', igual(m2.exportar().estaciones, m.exportar().estaciones) && !('saber' in m2.exportar()) && m2.exportar().version === 3);
  const blas = jugador(); blas.meterDonde('silex', 1); blas.meterDonde('piedra', 1);
  comprobar('y con él, cualquiera hace cualquier receta (Blas, la lasca en la piedra de tallar de Ana)', m2.fabricar('blas', 'lasca_silex', null, { x: 0, z: 0 }, blas, null, T0).ok);
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
  comprobar('colocar con autor gasta de lo de Ana', r.ok && ana.cuantos('piedra') === 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'blas', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 0, z: 0 }, T0, suelo);
  comprobar('Blas no fabrica con lo que lleva Ana', !r.ok && ana.cuantos('piedra') === 1, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'lasca_silex', estacion: null, x: 0, z: 0, fin: 0 }, T0, suelo);
  comprobar('Ana sí, con el sílex del suelo, y el tiempo lo pone quien valida, no el mensaje', r.ok && r.encargo.fin === T0 + RECETAS.lasca_silex.s * 1000 && !suelo.objetos.includes(sx), r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 0, z: 0 }, T0 + 3600e3, suelo);
  comprobar('recoger con autor', r.ok && ana.cuantos('lasca_silex') === 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'toString', estacion: id, x: 0, z: 0 }, T0, suelo);
  comprobar('nombres raros de receta no cuelan', !r.ok);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 'a', z: 0 }, T0, suelo);
  comprobar('datos no válidos', !r.ok && /no válidos/.test(r.motivo));
  comprobar('todo queda en el registro, salga bien o no', reg.entradas.length === 7 && reg.entradas.filter(e => e.ok).length === 3 && reg.entradas[1].resultado.estacion === id);
  comprobar('el registro anota en qué estación se hizo y lo que se gastó del suelo', reg.entradas[3].resultado.estacion === id && igual(reg.entradas[3].resultado.delSuelo, { [sx.id]: { silex: 1 } }), JSON.stringify(reg.entradas[3].resultado));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
