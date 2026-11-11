// Prueba de las herramientas y armas que se gastan (P4; src/logica/desgaste.js, src/logica/tala.js y
// src/logica/inventario.js). Lógica pura, sin servidor (el servidor, en el recorrido: pruebas/prueba_recorrido.mjs).
// Ejecutar: node pruebas/prueba_desgaste.mjs
// Comprueba:
//   - las vidas salen del documento de sistemas (apartado 10): el hacha de piedra, unos 3 árboles adultos; el hacha de
//     hierro, unos 30; un arma de madera o piedra, unos 50 golpes; de hierro, unos 400;
//   - cada golpe de tala gasta el hacha de la mano, y el hacha de piedra tala 3 adultos y se rompe al acabar el tercero;
//   - el desgaste va con la cosa: al soltarla al suelo y cogerla, al guardar y cargar el inventario;
//   - gastar un arma en la mano, y la lanza suelta (la que vuela), hasta que se rompe.
//   - reparar en su puesto con su material: el hacha y el mazo de piedra en la piedra de tallar con un cordel
//     depositado; la lanza en el banco de tronco con fibra y llevando la lasca; lo que no se repara, en otro puesto, sin
//     material o nuevo, no; y por la acción, con su autor en el registro.
//   - la ropa y la armadura (apartado 10: «se desgasta al recibir golpes y con el uso; se repara en su estación con su
//     material»): su vida sale de su material; el golpe que hiere gasta solo lo que cubre esa zona; el uso, todo lo
//     puesto; al acabarse se rompe y sale de su lugar; se repara puesta en el banco de tronco (el lino, con fibra; el
//     cuero, con piel y cordel) y lo que pide algo que aún no sale de ningún sitio (el gambesón, la paja), no.
// MUTAR=1: el hacha no se gasta al talar: tiene que FALLAR. MUTAR=2: reparar no gasta el material: tiene que FALLAR.
// MUTAR=3: el golpe gasta toda la ropa, cubra o no su zona: tiene que FALLAR.
import { VIDA, desgasteDe, gastar, gastarCosa, seGasta, GASTA_AL_DAR, GASTA_AL_PARAR } from '../src/logica/desgaste.js';
import { Tala, GOLPES, ENTRE_GOLPES, idArbol, ejecutarTala } from '../src/logica/tala.js';
import { Inventario, Inventarios } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { REPARAR, seRepara, gastarRopa, vidaDe, reparacionDe, VIDA_ROPA, GOLPE_ROPA } from '../src/logica/desgaste.js';
import { PRENDAS } from '../src/logica/prendas.js';
import { Fabricacion, ejecutarFabricacion } from '../src/logica/fabricacion.js';

if (process.env.MUTAR === '1') VIDA.hacha_piedra = 1e9;
if (process.env.MUTAR === '2') REPARAR.hacha_piedra.gasta = {};
const MUTAR3 = process.env.MUTAR === '3';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 10, 10, 8);

console.log('Lo que dice el documento de sistemas (apartado 10, «Durabilidad»)');
{
  comprobar('hacha de piedra: unos 3 árboles adultos', VIDA.hacha_piedra === 3 * GOLPES.adulto.piedra, `${VIDA.hacha_piedra} golpes`);
  comprobar('hacha de hierro: unos 30 árboles adultos', VIDA.hacha_hierro === 30 * GOLPES.adulto.hierro && VIDA.hacha_mano === VIDA.hacha_hierro, `${VIDA.hacha_hierro} golpes`);
  comprobar('armas de madera o piedra: unos 50 golpes', ['lanza_endurecida', 'palo_cavador', 'mazo_piedra'].every(t => VIDA[t] === 50));
  comprobar('armas de hierro: unos 400 golpes', VIDA.espada === 400 && VIDA.cuchillo === 400);
  comprobar('lo que no es herramienta, arma ni ropa no se gasta', !seGasta('piedra') && !seGasta('rama') && !seGasta('lasca_silex') && desgasteDe({ tipo: 'piedra', n: 3 }) === null);
  comprobar('el golpe que alcanza gasta al que lo da; el parado, también al que para', GASTA_AL_DAR.has('herida') && GASTA_AL_DAR.has('parada') && !GASTA_AL_DAR.has('al aire') && GASTA_AL_PARAR.has('parada') && !GASTA_AL_PARAR.has('herida'));
}

console.log('El hacha de piedra se gasta talando');
{
  const adultos = [0, 1, 2, 3].map(i => ({ id: idArbol(i * 10, 0), x: i * 10, z: 0, edad: 'adulto' }));
  const tala = new Tala(adultos), invs = new Inventarios(), suelo = new Suelo(), reg = new RegistroAcciones();
  const inv = invs.de('ana');
  inv.coger('hacha_piedra', 1, 'mano:der');
  let t = T0, caidos = 0, rotaEn = null, ultimo = null, primero = null;
  for (const a of adultos) {
    for (let n = 0; n < 200; n++) {
      const r = ejecutarTala(tala, invs, suelo, reg, { autor: 'ana', tipo: 'talar', arbol: a.id, x: a.x, z: -1 }, t);
      t += ENTRE_GOLPES;
      if (!r.ok) { ultimo = r; break; }
      if (!primero) primero = r;
      if (r.seRompe) rotaEn = { arbol: a.id, cae: !!r.cae };
      if (r.cae) { caidos++; break; }
    }
    if (ultimo) break;
  }
  comprobar('cada golpe dice cuánto lleva gastado', primero && primero.desgaste && primero.desgaste.usado === 1 && primero.desgaste.vida === VIDA.hacha_piedra);
  comprobar('tala 3 árboles adultos', caidos === 3, `${caidos} talados`);
  comprobar('se rompe con el golpe que tumba el tercero', rotaEn && rotaEn.arbol === adultos[2].id && rotaEn.cae, JSON.stringify(rotaEn));
  comprobar('roto, sale de la mano', !inv.lugares['mano:der']);
  comprobar('y el cuarto ya no se puede talar', ultimo && !ultimo.ok && /hacha/.test(ultimo.motivo), ultimo && ultimo.motivo);
  comprobar('el registro anota que se rompe, con su autor', reg.entradas.some(e => e.autor === 'ana' && e.resultado && e.resultado.seRompe === 'hacha_piedra'));
}

console.log('El desgaste va con la cosa');
{
  const inv = Inventario.inicial(), suelo = new Suelo();
  inv.coger('hacha_piedra', 1, 'mano:der');
  for (let i = 0; i < 40; i++) gastar(inv, 'mano:der');
  comprobar('la ficha lo sabe', (d => d && d.usado === 40 && d.queda === VIDA.hacha_piedra - 40)(desgasteDe(inv.lugares['mano:der'])));
  const s = suelo.soltar(inv, 'mano:der', undefined, 0, 0, T0, 'ana', false);
  comprobar('al soltarla al suelo lo lleva', s.ok && suelo.porId(s.objeto, T0).cosa.usado === 40);
  const c = suelo.coger(inv, s.objeto, 0, 0, T0 + 1000, 'mano:izq');
  comprobar('y al cogerla, también', c.ok && inv.lugares['mano:izq'] && inv.lugares['mano:izq'].usado === 40, JSON.stringify(inv.lugares['mano:izq']));
  const inv2 = Inventario.importarJugador(JSON.parse(JSON.stringify(inv.exportarJugador())));
  comprobar('al guardar y cargar', inv2.lugares['mano:izq'] && inv2.lugares['mano:izq'].usado === 40);
  comprobar('al moverla de una mano a la otra', inv2.mover('mano:izq', 'mano:der').ok && inv2.lugares['mano:der'].usado === 40);
  const raro = Inventario.importarJugador({ lugares: { 'mano:der': { tipo: 'hacha_piedra', n: 1, usado: 'mucho' } } });
  comprobar('un desgaste no válido se descarta', raro.lugares['mano:der'] && raro.lugares['mano:der'].usado === undefined);
}

console.log('Las armas se gastan hasta romperse');
{
  const inv = Inventario.inicial();
  inv.coger('lanza_endurecida', 1, 'mano:der');
  let g;
  for (let i = 0; i < VIDA.lanza_endurecida; i++) g = gastar(inv, 'mano:der');
  comprobar('la lanza aguanta 50 golpes y se rompe con el último', g && g.roto && g.usado === 50 && !inv.lugares['mano:der']);
  comprobar('sin nada en la mano, no se gasta nada', gastar(inv, 'mano:der') === null);
  const suelta = { tipo: 'lanza_endurecida', n: 1, usado: 48 };
  comprobar('la lanza que vuela se gasta al dar a una presa', !gastarCosa(suelta).roto && gastarCosa(suelta).roto && suelta.usado === 50);
}

console.log('Reparar en su puesto con su material');
{
  const fab = new Fabricacion(), invs = new Inventarios(), reg = new RegistroAcciones(), inv = invs.de('ana');
  const puesto = (tipo, x) => { const r = fab.colocar('ana', tipo, x, 0); delete fab.estaciones[r.id].obra; return r.id; };
  const pt = puesto('piedra_tallar', 0), bt = puesto('banco_tronco', 1.5);
  inv.coger('hacha_piedra', 1, 'mano:der');
  const hacha = () => inv.lugares['mano:der'];
  const rep = (estacion, de = 'mano:der', x = 0) => ejecutarFabricacion(fab, invs, reg, { autor: 'ana', tipo: 'reparar', estacion, de, x, z: 0.5 }, T0);
  let r = rep(pt);
  comprobar('nueva, no le hace falta', !r.ok && /nuevo/.test(r.motivo), r.motivo);
  for (let i = 0; i < 150; i++) gastar(inv, 'mano:der');
  r = rep(pt);
  comprobar('sin cordel depositado en la piedra de tallar, no', !r.ok && /Falta en la estación/.test(r.motivo) && hacha().usado === 150, r.motivo);
  const dejar = (est, tipo, x) => { inv.coger(tipo, 1, 'mano:izq'); return fab.depositar('ana', est, 'mano:izq', 1, { x, z: 0.5 }, inv).ok; };
  comprobar('deja 2 cordeles en la piedra de tallar', dejar(pt, 'cordel', 0) && dejar(pt, 'cordel', 0) && fab.estaciones[pt].deposito.cordel === 2);
  r = rep(bt, 'mano:der', 1.5);
  comprobar('el hacha de piedra no se repara en el banco de tronco', !r.ok && /piedra de tallar/.test(r.motivo), r.motivo);
  r = rep(pt);
  comprobar('en la piedra de tallar, con un cordel, recupera 84 golpes (la mitad)', r.ok && r.reparado.recuperado === 84 && hacha().usado === 66 && fab.estaciones[pt].deposito.cordel === 1, JSON.stringify(r.reparado));
  comprobar('queda en el registro, con su autor', (e => e && e.autor === 'ana' && e.tipo === 'reparar' && e.resultado && e.resultado.reparado.objeto === 'hacha_piedra')(reg.entradas.at(-1)));
  r = rep(pt);
  comprobar('no pasa de nueva', r.ok && r.reparado.recuperado === 66 && hacha().usado === undefined && !fab.estaciones[pt].deposito.cordel, JSON.stringify(hacha()));
  inv.coger('mazo_piedra', 1, 'mano:izq');
  for (let i = 0; i < 40; i++) gastar(inv, 'mano:izq');
  r = rep(pt, 'mano:izq');
  comprobar('el mazo también, pero ya no queda cordel', !r.ok && /cordel/i.test(r.motivo), r.motivo);
  inv.sacar('mano:izq'); inv.sacar('mano:der');
  inv.coger('lanza_endurecida', 1, 'mano:der');
  for (let i = 0; i < 40; i++) gastar(inv, 'mano:der');
  dejar(bt, 'fibra', 1.5);
  r = rep(bt, 'mano:der', 1.5);
  comprobar('la lanza, en el banco, pide llevar la lasca', !r.ok && /lasca/i.test(r.motivo), r.motivo);
  inv.coger('lasca_silex', 1, 'mano:izq');
  r = rep(bt, 'mano:der', 1.5);
  comprobar('con la lasca y la fibra depositada, recupera 25 golpes; la lasca no se gasta', r.ok && inv.lugares['mano:der'].usado === 15 && inv.cuantos('lasca_silex') === 1 && !fab.estaciones[bt].deposito.fibra, r.motivo || JSON.stringify(inv.lugares['mano:der']));
  comprobar('lo de hierro y el palo cavador no se reparan (aún)', !seRepara('espada') && !seRepara('hacha_hierro') && !seRepara('palo_cavador'));
  r = rep(pt, 'mano:der', 9);
  comprobar('lejos del puesto, no', !r.ok && /lejos/.test(r.motivo), r.motivo);
}

console.log('\nLa ropa y la armadura');
{
  comprobar('cada prenda tiene su vida, de su material', Object.keys(PRENDAS).every(t => vidaDe(t) === VIDA_ROPA[PRENDAS[t].material] && seGasta(t)));
  comprobar('la malla aguanta más que el lino, y el lino, unos 60 golpes', vidaDe('cota_malla') > vidaDe('gambeson') && vidaDe('gambeson') > vidaDe('camisa_lino') && vidaDe('camisa_lino') / GOLPE_ROPA === 60);
  const fab = new Fabricacion(), invs = new Inventarios(), reg = new RegistroAcciones(), inv = invs.de('eva');
  inv.lugares['ropa:sobre'] = { tipo: 'manto_lana', n: 1 };     // (cubre el torso y las piernas, no los brazos ni la cabeza)
  inv.lugares['ropa:cabeza'] = { tipo: 'capucha_lana', n: 1 };
  inv.lugares['ropa:pies'] = { tipo: 'zapatos_cuero', n: 1 };
  const golpe = zona => MUTAR3 ? gastarRopa(inv, GOLPE_ROPA) : gastarRopa(inv, GOLPE_ROPA, zona);
  const camisa = () => inv.lugares['ropa:interior'], pantalon = () => inv.lugares['ropa:piernas'];
  comprobar('empieza con la camisa y el pantalón de lino, nuevos', camisa().tipo === 'camisa_lino' && pantalon().tipo === 'pantalon_lino' && desgasteDe(camisa()).usado === 0);
  let l = golpe('brazoD');
  comprobar('un golpe en el brazo gasta la camisa (tiene mangas), y no el pantalón, la capa ni la capucha', camisa().usado === GOLPE_ROPA && !pantalon().usado && !inv.lugares['ropa:sobre'].usado && !inv.lugares['ropa:cabeza'].usado && l.length === 1, JSON.stringify(l));
  golpe('cabeza');
  comprobar('uno en la cabeza, solo la capucha', inv.lugares['ropa:cabeza'].usado === GOLPE_ROPA && camisa().usado === GOLPE_ROPA);
  l = gastarRopa(inv, 1);
  comprobar('el uso gasta todo lo puesto, un uso cada cosa', l.length === 5 && inv.lugares['ropa:pies'].usado === 1 && camisa().usado === GOLPE_ROPA + 1, l.map(g => g.tipo).join(', '));
  inv.lugares['ropa:cabeza'].usado = vidaDe('capucha_lana') - 5;
  l = golpe('cabeza');
  comprobar('al acabarse se rompe y sale de su lugar', l.length === 1 && l[0].roto && inv.lugares['ropa:cabeza'] === null, JSON.stringify(l));
  const puesto = (tipo, x) => { const r = fab.colocar('eva', tipo, x, 0); delete fab.estaciones[r.id].obra; return r.id; };
  const bt = puesto('banco_tronco', 0), pt = puesto('piedra_tallar', 3);
  const rep = (estacion, de, x = 0) => ejecutarFabricacion(fab, invs, reg, { autor: 'eva', tipo: 'reparar', estacion, de, x, z: 0.5 }, T0);
  const dejar = (est, tipo, x = 0) => { inv.coger(tipo, 1, 'mano:izq'); return fab.depositar('eva', est, 'mano:izq', 1, { x, z: 0.5 }, inv).ok; };
  camisa().usado = 400;
  let r = rep(bt, 'ropa:interior');
  comprobar('la camisa, sin fibra en el banco, no', !r.ok && /fibra/i.test(r.motivo), r.motivo);
  r = rep(pt, 'ropa:interior', 3);
  comprobar('ni en la piedra de tallar', !r.ok && /banco/.test(r.motivo), r.motivo);
  dejar(bt, 'fibra');
  r = rep(bt, 'ropa:interior');
  comprobar('puesta, en el banco con una fibra, recupera la mitad de su vida', r.ok && camisa().usado === 100 && r.reparado.recuperado === 300 && !fab.estaciones[bt].deposito.fibra && camisa().tipo === 'camisa_lino', r.motivo || JSON.stringify(camisa()));
  comprobar('y queda en el registro, con su autor', (e => e && e.autor === 'eva' && e.resultado.reparado.objeto === 'camisa_lino')(reg.entradas.at(-1)));
  inv.lugares['ropa:pies'].usado = 900;
  dejar(bt, 'piel');
  r = rep(bt, 'ropa:pies');
  comprobar('los zapatos de cuero, con la piel sola, no: piden también un cordel', !r.ok && /cordel/i.test(r.motivo), r.motivo);
  dejar(bt, 'cordel');
  r = rep(bt, 'ropa:pies');
  comprobar('con piel y cordel, sí: la mitad de su vida', r.ok && inv.lugares['ropa:pies'].usado === 300, r.motivo);
  comprobar('el gambesón (tela), lo de paja y la cota de malla (fragua), aún no se reparan', !reparacionDe('gambeson') && !reparacionDe('sombrero_paja') && !reparacionDe('cota_malla') && !!reparacionDe('tunica_lana'));
  // (lo que gasta reparar sale del mundo: lo mira pruebas/prueba_origenes.mjs)
  // el desgaste va con la prenda al guardarla y cargarla
  const invs2 = Inventarios.importar(JSON.parse(JSON.stringify(invs.exportar())));
  comprobar('el desgaste de la ropa se guarda y se carga', invs2.de('eva').lugares['ropa:interior'].usado === 100, JSON.stringify(invs2.de('eva').lugares['ropa:interior']));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
