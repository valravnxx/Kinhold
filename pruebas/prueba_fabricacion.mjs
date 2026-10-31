// Pruebas de estaciones y recetas (src/logica/fabricacion.js). Ejecutar: node pruebas/prueba_fabricacion.mjs
// Con MUTAR=1 el hacha de piedra no gasta cordel y se hace al momento: las pruebas deben FALLAR.
import { ESTACIONES, RECETAS, Fabricacion, ejecutarFabricacion, faltan, arconesCerca, ALCANCE_ESTACION, ALCANCE_ARCONES,
  COLA_ESTACION, VERSION_FABRICACION, migrarFabricacion } from '../src/logica/fabricacion.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') { delete RECETAS.hacha_piedra.gasta.cordel; RECETAS.hacha_piedra.s = 0; }
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
  comprobar('hoguera: N0, 6 piedras sueltas y 4 ramas', E.hoguera.nivel === 'N0' && igual(E.hoguera.coste, { piedra: 6, rama: 4 }));
  comprobar('piedra de tallar: N0, 1 piedra', E.piedra_tallar.nivel === 'N0' && igual(E.piedra_tallar.coste, { piedra: 1 }));
  comprobar('banco de tronco: N1, 2 troncos cortos y herramienta de piedra', E.banco_tronco.nivel === 'N1' && igual(E.banco_tronco.coste, { tronco_corto: 2 }) && E.banco_tronco.requiere.includes('hacha_piedra'));
  const R = RECETAS;
  comprobar('cordel: 3 fibra cruda, con las manos', R.cordel.donde === 'manos' && igual(R.cordel.gasta, { fibra: 3 }));
  comprobar('lasca de sílex: 1 sílex y 1 piedra, en la piedra de tallar', R.lasca_silex.donde === 'piedra_tallar' && igual(R.lasca_silex.gasta, { silex: 1, piedra: 1 }));
  comprobar('hacha de piedra: 1 piedra, 1 rama y 2 cordel, en la piedra de tallar', R.hacha_piedra.donde === 'piedra_tallar' && igual(R.hacha_piedra.gasta, { piedra: 1, rama: 1, cordel: 2 }), JSON.stringify(R.hacha_piedra.gasta));
  comprobar('lanza endurecida: 1 rama, en la hoguera', R.lanza_endurecida.donde === 'hoguera' && igual(R.lanza_endurecida.gasta, { rama: 1 }));
  comprobar('leñero: 4 ramas y 2 cordel, con las manos', R.lenero.donde === 'manos' && igual(R.lenero.gasta, { rama: 4, cordel: 2 }));
  comprobar('cuerda: 3 cordel, en el banco', R.cuerda.donde === 'banco_tronco' && igual(R.cuerda.gasta, { cordel: 3 }));
  comprobar('pala de madera y cubo: 1 tronco corto, en el banco', ['pala_madera', 'cubo'].every(k => R[k].donde === 'banco_tronco' && igual(R[k].gasta, { tronco_corto: 1 })));
  const malas = Object.entries(R).filter(([, r]) => !CATALOGO[r.da] || Object.keys(r.gasta).some(t => !CATALOGO[t]) || !(r.donde === 'manos' || ESTACIONES[r.donde]));
  comprobar('todas las recetas dan y gastan cosas del catálogo, en una estación que existe', !malas.length, malas.map(m => m[0]).join());
  comprobar('todas tienen un tiempo de más de 0 s', Object.values(R).every(r => r.s > 0));
  comprobar('todas las estaciones cuestan cosas del catálogo', Object.values(ESTACIONES).every(e => Object.keys(e.coste).every(t => CATALOGO[t])));
}

console.log('Colocar estaciones');
{
  const fab = new Fabricacion(), inv = jugador();
  let r = fab.colocar('ana', 'hoguera', 0, 0, inv, []);
  comprobar('sin materiales no se coloca, y dice qué falta', !r.ok && r.faltan.piedra === 6 && r.faltan.rama === 4, r.motivo);
  inv.meterDonde('piedra', 3); inv.meterDonde('rama', 3);
  const arcon = { id: 'arcon:1', x: 3, z: 0, contenido: { piedra: 5, rama: 2 } };
  const lejos = { id: 'arcon:2', x: 20, z: 0, contenido: { piedra: 50, rama: 50 } };
  r = fab.colocar('ana', 'hoguera', 0, 0, inv, [lejos, arcon]);
  comprobar('con lo que llevas y un arcón a pocos pasos, se coloca', r.ok, r.motivo || r.id);
  comprobar('gasta primero lo que llevas y luego el arcón cercano', inv.cuantos('piedra') === 0 && inv.cuantos('rama') === 0 && arcon.contenido.piedra === 2 && arcon.contenido.rama === 1, JSON.stringify(arcon.contenido));
  comprobar('el arcón lejano no se toca', lejos.contenido.piedra === 50 && lejos.contenido.rama === 50);
  comprobar('el arcón lejano no cuenta', arconesCerca([lejos], { x: 0, z: 0 }).length === 0 && ALCANCE_ARCONES < 20);
  inv.meterDonde('tronco_corto', 1); inv.lugares['mano:der'] = null; inv.lugares['mano:izq'] = null;
  const inv2 = jugador(); inv2.lugares.hombro = { tipo: 'tronco_corto', n: 1 }; inv2.lugares['mano:der'] = { tipo: 'tronco_corto', n: 1 };
  r = fab.colocar('ana', 'banco_tronco', 5, 5, inv2, []);
  comprobar('el banco de tronco pide llevar una herramienta de piedra', !r.ok && /hacha de piedra/.test(r.motivo), r.motivo);
  inv2.meterDonde('lasca_silex', 1);
  r = fab.colocar('ana', 'banco_tronco', 5, 5, inv2, []);
  comprobar('con una lasca y 2 troncos cortos (uno al hombro), se coloca y la lasca no se gasta', r.ok && inv2.cuantos('tronco_corto') === 0 && inv2.cuantos('lasca_silex') === 1, r.motivo || r.id);
  comprobar('una estación desconocida no se coloca', !fab.colocar('ana', 'constructor', 0, 0, inv, []).ok && !fab.colocar('ana', '__proto__', 0, 0, inv, []).ok);
}

console.log('Fabricar con las manos: el cordel');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('fibra', 7);
  let r = fab.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, inv, [], T0);
  comprobar('cordel con 3 fibra: se encarga', r.ok && inv.cuantos('fibra') === 4, r.motivo);
  comprobar('termina pasado su tiempo', r.ok && r.encargo.fin === T0 + RECETAS.cordel.s * 1000);
  r = fab.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, inv, [], T0 + 1000);
  comprobar('con las manos, una cosa a la vez', !r.ok && inv.cuantos('fibra') === 4, r.motivo);
  r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + 5000);
  comprobar('antes de tiempo no se recoge', !r.ok, r.motivo);
  const antes = inv.cuantos('cordel');
  r = fab.recoger('ana', null, { x: 0, z: 0 }, inv, T0 + RECETAS.cordel.s * 1000);
  comprobar('pasado el tiempo se recoge y va a lo que llevas', r.ok && inv.cuantos('cordel') === antes + 1, r.motivo || JSON.stringify(r.dados));
  comprobar('el cinturón de cordel puesto no se gasta nunca', inv.lugares.cintura && inv.lugares.cintura.tipo === 'cordel');
  r = fab.fabricar('ana', 'hacha_piedra', null, { x: 0, z: 0 }, inv, [], T0);
  comprobar('el hacha de piedra no se hace con las manos', !r.ok, r.motivo);
  r = fab.fabricar('ana', 'cordel', 'hoguera:1', { x: 0, z: 0 }, inv, [], T0 + 100000);
  comprobar('el cordel no se hace en una estación', !r.ok, r.motivo);
}

console.log('Fabricar en una estación: piedra de tallar y hoguera');
{
  const fab = new Fabricacion(), inv = jugador();
  inv.meterDonde('piedra', 3); inv.meterDonde('silex', 1); inv.meterDonde('rama', 3);
  const tallar = fab.colocar('ana', 'piedra_tallar', 10, 0, inv, []).id;
  comprobar('la piedra de tallar gasta 1 piedra', inv.cuantos('piedra') === 2);
  let r = fab.fabricar('ana', 'lasca_silex', tallar, { x: 20, z: 0 }, inv, [], T0);
  comprobar('lejos de la estación no se fabrica', !r.ok && inv.cuantos('silex') === 1, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', tallar, { x: 10 + ALCANCE_ESTACION - 0.1, z: 0 }, inv, [], T0);
  comprobar('junto a ella, la lasca gasta 1 sílex y 1 piedra', r.ok && inv.cuantos('silex') === 0 && inv.cuantos('piedra') === 1, r.motivo);
  r = fab.fabricar('ana', 'hacha_piedra', tallar, { x: 10, z: 0 }, inv, [], T0);
  comprobar('el hacha sin cordel no se encarga y no gasta nada', !r.ok && r.faltan && r.faltan.cordel === 2 && inv.cuantos('piedra') === 1 && inv.cuantos('rama') === 3, r.motivo);
  inv.meterDonde('cordel', 1); inv.meterDonde('cordel', 1);
  r = fab.fabricar('ana', 'hacha_piedra', tallar, { x: 10, z: 0 }, inv, [], T0 + 1000);
  const finLasca = T0 + RECETAS.lasca_silex.s * 1000;
  comprobar('con 2 cordel sí, y gasta piedra, rama y los dos cordeles', r.ok && inv.cuantos('piedra') === 0 && inv.cuantos('rama') === 2 && inv.cuantos('cordel') === 1, r.motivo || JSON.stringify(r.usado));
  comprobar('en la cola, empieza cuando acaba la lasca', r.ok && r.encargo.empieza === finLasca && r.encargo.fin === finLasca + RECETAS.hacha_piedra.s * 1000);
  const est = fab.estado(tallar, 'ana', finLasca + 1000);
  comprobar('el estado dice qué está terminado y cuánto falta', est.length === 2 && est[0].terminado && !est[1].terminado && est[1].falta === RECETAS.hacha_piedra.s * 1000 - 1000);
  r = fab.recoger('blas', tallar, { x: 10, z: 0 }, Inventario.inicial(), finLasca + 1000);
  comprobar('otro jugador no recoge lo de Ana', !r.ok, r.motivo);
  r = fab.recoger('ana', tallar, { x: 10, z: 0 }, inv, finLasca + 1000);
  comprobar('Ana recoge la lasca; el hacha sigue en la cola', r.ok && inv.cuantos('lasca_silex') === 1 && inv.cuantos('hacha_piedra') === 0 && fab.estaciones[tallar].cola.length === 1, r.motivo);
  r = fab.recoger('ana', tallar, { x: 10, z: 0 }, inv, T0 + 3600e3);
  comprobar('pasada una hora, aunque nadie juegue, el hacha está hecha', r.ok && inv.cuantos('hacha_piedra') === 1, r.motivo);
  // la cola de la hoguera
  const inv3 = jugador(); inv3.meterDonde('piedra', 6); inv3.meterDonde('rama', 3);
  const arcon = { id: 'arcon:9', x: 2, z: 2, contenido: { rama: 10 } };
  const hog = fab.colocar('blas', 'hoguera', 0, 0, inv3, [arcon]).id;
  let n = 0;
  for (let i = 0; i < COLA_ESTACION + 1; i++) if (fab.fabricar('blas', 'lanza_endurecida', hog, { x: 1, z: 0 }, inv3, [arcon], T0).ok) n++;
  comprobar(`la cola de una estación admite ${COLA_ESTACION} encargos sin terminar`, n === COLA_ESTACION, `${n}`);
  comprobar('las ramas salieron de lo que lleva y del arcón junto a la hoguera', inv3.cuantos('rama') === 0 && arcon.contenido.rama === 10 - 1 - COLA_ESTACION, JSON.stringify(arcon.contenido));
  r = fab.fabricar('ana', 'lanza_endurecida', hog, { x: 1, z: 0 }, inv, [arcon], T0 + RECETAS.lanza_endurecida.s * 1000);
  comprobar('cuando termina el primero, hay sitio en la cola (también para otro jugador)', r.ok, r.motivo);
  r = fab.fabricar('ana', 'lasca_silex', hog, { x: 1, z: 0 }, inv, [], T0);
  comprobar('la lasca no se hace en la hoguera', !r.ok && /piedra de tallar/.test(r.motivo), r.motivo);
}

console.log('Si no te cabe');
{
  const fab = new Fabricacion(), inv = Inventario.inicial(); // sin cinturón ni mochila: solo las manos
  inv.lugares['mano:der'] = { tipo: 'fibra', n: 3 };
  const r1 = fab.fabricar('ana', 'cordel', null, { x: 0, z: 0 }, inv, [], T0);
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
  const id = fab.colocar('ana', 'piedra_tallar', 4, 4, inv, []).id;
  fab.fabricar('ana', 'lasca_silex', id, { x: 4, z: 4 }, inv, [], T0);
  fab.fabricar('ana', 'cordel', null, { x: 4, z: 4 }, inv, [], T0);
  const datos = JSON.parse(JSON.stringify(fab.exportar()));
  const otra = new Fabricacion().importar(datos);
  comprobar('se guarda la versión', datos.version === VERSION_FABRICACION);
  comprobar('al cargar, las estaciones, sus colas y lo de las manos son lo mismo', igual(otra.exportar(), fab.exportar()));
  const x = new Fabricacion().importar(datos);
  comprobar('y se sigue contando por la hora: lo que acabó mientras tanto se recoge', x.recoger('ana', id, { x: 4, z: 4 }, inv, T0 + 86400e3).ok);
  const roto = { version: VERSION_FABRICACION, estaciones: [{ id: 'z:1', tipo: 'altar', x: 0, z: 0, cola: [] }, { id: 'h:1', tipo: 'hoguera', x: 0, z: 0, cola: [{ autor: 'a', receta: 'nada', empieza: 0, fin: 1 }, { autor: 'a', receta: 'lasca_silex', empieza: 0, fin: 1 }] }] };
  const y = new Fabricacion().importar(roto);
  comprobar('lo que no se entiende se descarta (estación o receta que no existe, receta de otra estación)', !y.estaciones['z:1'] && y.estaciones['h:1'] && y.estaciones['h:1'].cola.length === 0);
  comprobar('un guardado sin versión no se carga', migrarFabricacion({ estaciones: [] }) === null && Object.keys(new Fabricacion().importar(null).estaciones).length === 0);
}

console.log('Acciones con autor');
{
  const fab = new Fabricacion(), invs = new Inventarios(), reg = new RegistroAcciones();
  const ana = invs.de('ana'); ana.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  ana.meterDonde('piedra', 2); ana.meterDonde('silex', 1);
  let r = ejecutarFabricacion(fab, invs, reg, { tipo: 'colocar_estacion', estacion: 'piedra_tallar', x: 0, z: 0 }, T0);
  comprobar('sin autor no vale', !r.ok && /autor/.test(r.motivo));
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'colocar_estacion', estacion: 'piedra_tallar', x: 0, z: 0 }, T0);
  const id = r.id;
  comprobar('colocar con autor gasta de lo de Ana', r.ok && ana.cuantos('piedra') === 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'blas', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 0, z: 0 }, T0);
  comprobar('Blas no fabrica con lo que lleva Ana', !r.ok && ana.cuantos('silex') === 1, r.motivo);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 0, z: 0, fin: 0 }, T0);
  comprobar('Ana sí, y el tiempo lo pone quien valida, no el mensaje', r.ok && r.encargo.fin === T0 + RECETAS.lasca_silex.s * 1000);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 0, z: 0 }, T0 + 3600e3);
  comprobar('recoger con autor', r.ok && ana.cuantos('lasca_silex') === 1);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'toString', estacion: id, x: 0, z: 0 }, T0);
  comprobar('nombres raros de receta no cuelan', !r.ok);
  r = ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'fabricar', receta: 'lasca_silex', estacion: id, x: 'a', z: 0 }, T0);
  comprobar('datos no válidos', !r.ok && /no válidos/.test(r.motivo));
  comprobar('todo queda en el registro, salga bien o no', reg.entradas.length === 7 && reg.entradas.filter(e => e.ok).length === 3 && reg.entradas[1].resultado.estacion === id);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
