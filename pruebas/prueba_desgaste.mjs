// Prueba de las herramientas y armas que se gastan (P4; src/logica/desgaste.js, src/logica/tala.js y
// src/logica/inventario.js). Lógica pura, sin servidor (el servidor, en el recorrido: pruebas/prueba_recorrido.mjs).
// Ejecutar: node pruebas/prueba_desgaste.mjs
// Comprueba:
//   - las vidas salen del documento de sistemas (apartado 10): el hacha de piedra, unos 3 árboles adultos; el hacha de
//     hierro, unos 30; un arma de madera o piedra, unos 50 golpes; de hierro, unos 400;
//   - cada golpe de tala gasta el hacha de la mano, y el hacha de piedra tala 3 adultos y se rompe al acabar el tercero;
//   - el desgaste va con la cosa: al soltarla al suelo y cogerla, al guardar y cargar el inventario;
//   - gastar un arma en la mano, y la lanza suelta (la que vuela), hasta que se rompe.
// MUTAR=1: el hacha no se gasta al talar: tiene que FALLAR.
import { VIDA, desgasteDe, gastar, gastarCosa, seGasta, GASTA_AL_DAR, GASTA_AL_PARAR } from '../src/logica/desgaste.js';
import { Tala, GOLPES, ENTRE_GOLPES, idArbol, ejecutarTala } from '../src/logica/tala.js';
import { Inventario, Inventarios } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') VIDA.hacha_piedra = 1e9;
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
  comprobar('lo que no es herramienta ni arma no se gasta', !seGasta('piedra') && !seGasta('rama') && !seGasta('camisa_lino') && desgasteDe({ tipo: 'piedra', n: 3 }) === null);
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

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
