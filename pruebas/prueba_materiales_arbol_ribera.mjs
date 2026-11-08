// Prueba de lógica: de dónde salen la piel, el mimbre, la resina y la corteza (tarea del hito crafting, 8 nov; documento
// de sistemas, apartado 3). En la lógica pura y en el servidor con el terreno de Whitholm, con su autor:
//   - el mimbre: las mimbreras salen en la ribera y en la orilla (y solo ahí), se cortan con un cuchillo o la lasca (con
//     las manos, no), dan un haz de mimbre y vuelven en una estación;
//   - la corteza: un árbol en pie se descorteza una vez (de 1 a 2 cortezas) con un cuchillo, la lasca o un hacha;
//   - la resina: un pino o un abeto se sangra con un cuchillo o la lasca; a las 4 h reales da 1 resina, que se coge con
//     la mano, y vuelve a sangrar (repetible); los demás árboles no dan;
//   - lo descortezado y lo sangrado se guarda; la honda y el odre (piel, de la caza) quedan fuera del tramo: ni salen en
//     la lista del panel ni se pueden hacer;
//   - en el servidor, cada árbol con su especie (la del mundo, no la que diga el navegador).
// MUTAR=1: se descorteza sin fin; MUTAR=2: la resina se coge sin esperar. Tienen que FALLAR.
import { Tala, ejecutarTala, idArbol, RESINA_TARDA, CONIFERAS } from '../src/logica/tala.js';
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, TIEMPOS } from '../src/logica/recoleccion.js';
import { DENSIDAD_RECOGIDA } from '../src/logica/recogida_mundo.js';
import { Fabricacion, RECETAS } from '../src/logica/fabricacion.js';
import { Inventarios } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

const MUTAR = process.env.MUTAR;
let fallos = 0, total = 0;
function comprobar(nombre, cond, detalle = '') {
  total++; if (!cond) fallos++;
  console.log(`${cond ? '  bien' : '  MAL '}  ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
if (MUTAR === '1') { const d = Tala.prototype.descortezar; Tala.prototype.descortezar = function (...a) { const r = d.apply(this, a); if (r.ok) delete this.estado[a[1]].desc; return r; }; }
if (MUTAR === '2') { const d = Tala.prototype.sangrar; Tala.prototype.sangrar = function (inv, id, x, z, ahora) { const e = this.estado[id]; if (e && e.resina) e.resina = ahora; return d.call(this, inv, id, x, z, ahora); }; }

const T0 = Date.UTC(2026, 10, 8, 17);
const invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
const yo = 'ana', inv = invs.de(yo);

console.log('El mimbre');
const mimbre = RECOLECTABLES.mimbre;
comprobar('las mimbreras salen en la ribera y la orilla (y solo ahí)', mimbre && JSON.stringify(mimbre.donde) === '["rio","ribera"]' && Object.keys(DENSIDAD_RECOGIDA.mimbre).every(z => mimbre.donde.includes(z)));
const rec = new Recoleccion([{ id: 'mimbre:10,0', tipo: 'mimbre', x: 1, z: 0 }]);
const recoger = (ahora) => ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'recoger', punto: 'mimbre:10,0', x: 1.5, z: 0 }, ahora);
let r = recoger(T0);
comprobar('con las manos no se corta', !r.ok && /cuchillo/.test(r.motivo), r.motivo);
inv.meterDonde('lasca_silex', 1, 'mano:izq');
r = recoger(T0);
comprobar('con la lasca se cortan sus varas: un haz de mimbre', r.ok && inv.cuantos('mimbre') === 1, r.motivo);
comprobar('y vuelve en una estación', !rec.disponible('mimbre:10,0', T0 + TIEMPOS.estacion - 1000) && rec.disponible('mimbre:10,0', T0 + TIEMPOS.estacion + 1000));

console.log('La corteza y la resina, del árbol en pie');
inv.sacar('mano:der');   // (el haz de mimbre, fuera de la mano: hace sitio)
const pino = { id: idArbol(5, 5), x: 5, z: 5, edad: 'adulto', especie: 'pino' }, roble = { id: idArbol(9, 5), x: 9, z: 5, edad: 'adulto', especie: 'roble' };
const tala = new Tala([pino, roble]);
const usar = (a, tipo, ahora, x = a.x + 1) => ejecutarTala(tala, invs, suelo, reg, { autor: yo, tipo, arbol: a.id, x, z: a.z }, ahora);
const i2 = new Inventarios().de('luis'), t2 = new Tala([{ ...roble }]);
r = t2.descortezar(i2, roble.id, 10, 5, T0);
comprobar('sin cuchillo, lasca ni hacha no se descorteza', !r.ok, r.motivo);
const c0 = inv.cuantos('corteza');
r = usar(roble, 'descortezar', T0);
comprobar('con la lasca se descorteza un roble: de 1 a 2 cortezas a lo que llevas', r.ok && inv.cuantos('corteza') - c0 >= 1 && inv.cuantos('corteza') - c0 <= 2, r.motivo);
r = usar(roble, 'descortezar', T0 + 1000);
comprobar('una sola vez por árbol', !r.ok && /descortezado/.test(r.motivo), r.motivo);
r = usar(roble, 'descortezar', T0 + 1000, 30);
comprobar('lejos no', !r.ok);
r = usar(roble, 'sangrar', T0);
comprobar('un roble no da resina', !r.ok && /pinos/.test(r.motivo), r.motivo);
comprobar('el pino y el abeto son las coníferas', CONIFERAS.has('pino') && CONIFERAS.has('abeto') && CONIFERAS.size === 2);
for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]?.tipo === 'corteza') inv.sacar(l);   // (la corteza, fuera: una mano libre para la resina)
r = usar(pino, 'sangrar', T0);
comprobar('al pino se le hace un corte (aún sin resina)', r.ok && r.cantidad === 0 && tala.usos(pino.id, T0 + 1).resina === 'sangrando', r.motivo);
r = usar(pino, 'sangrar', T0 + RESINA_TARDA - 60000);
comprobar('la resina tarda horas: antes, no', !r.ok && inv.cuantos('resina') === 0, r.motivo);
const guardado = JSON.parse(JSON.stringify(tala.exportar()));
const otra = new Tala([{ ...pino }, { ...roble }]).importar(guardado);
comprobar('lo sangrado y lo descortezado se guarda', otra.usos(pino.id, T0 + 1).resina === 'sangrando' && !otra.usos(roble.id, T0).descortezar);
r = usar(pino, 'sangrar', T0 + RESINA_TARDA + 1000);
comprobar('a las 4 h, 1 resina con la mano', r.ok && inv.cuantos('resina') === 1, r.motivo);
r = usar(pino, 'sangrar', T0 + RESINA_TARDA + 2000);
comprobar('y vuelve a sangrar (repetible): otra a las 4 h más', !r.ok && usar(pino, 'sangrar', T0 + 2 * RESINA_TARDA + 3000).ok && inv.cuantos('resina') === 2);
comprobar('queda en el registro con su autor', reg.entradas.some(e => e.tipo === 'sangrar' && e.autor === yo && e.ok && e.resultado.objeto === 'resina'));

console.log('La piel: fuera del tramo');
const fab = new Fabricacion();
const lista = fab.lista({ x: 0, z: 0 }, inv, suelo, T0).map(x => x.receta);
comprobar('la honda y el odre no salen en el panel', !lista.includes('honda') && !lista.includes('odre') && lista.includes('mazo_piedra'), lista.length + ' recetas');
comprobar('ni se pueden hacer', !fab.fabricar(yo, 'odre', null, { x: 0, z: 0 }, inv, suelo, T0).ok && RECETAS.odre.fuera === 'caza');

console.log('En el servidor, con el terreno de Whitholm');
const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
const { ObjetosServidor } = await import('../src/logica/objetos_red.js');
const { vegetacionEn, CLARO_ARBOLES } = await import('../src/logica/vegetacion.js');
const { recogidaEn } = await import('../src/logica/recogida_mundo.js');
const terreno = terrenoWhitholm(), O = terreno.origen;
// (en Whitholm, los pinos y los abetos más cerca de la salida están a unos 4 km, hacia el sudeste: (2854, 3070) de la
// escena es uno de esos sitios, mirado a mano; los de cerca de la salida son robles, hayas y fresnos)
let p1 = null, m1 = null;
for (let R = 60; !m1 && R < 1500; R += 120) m1 = recogidaEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: O.x - R, z0: O.z - R, x1: O.x + R, z1: O.z + R }).find(p => p.tipo === 'mimbre') || null;
{ const cx = O.x + 2854, cz = O.z + 3070, R = 40;
  p1 = vegetacionEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: cx - R, z0: cz - R, x1: cx + R, z1: cz + R }).arboles.map(e => ({ ...e, x: e.x - O.x, z: e.z - O.z })).find(e => CONIFERAS.has(e.especie)) || null; }
comprobar('hay mimbreras en el mundo', !!m1, m1 ? `a ${Math.hypot(m1.x - O.x, m1.z - O.z).toFixed(0)} m de la salida` : '');
comprobar('hay pinos o abetos en el mundo', !!p1, p1 ? p1.especie : '');
const ta = p1 && terreno.arbol(idArbol(p1.x, p1.z), p1.x, p1.z);
comprobar('el servidor conoce su especie', ta && ta.especie === p1.especie, JSON.stringify(ta));
const obj = new ObjetosServidor({ terreno, posicion: () => ({ x: p1.x + 1, z: p1.z }) });
obj.invs.de('eva').meterDonde('lasca_silex', 1, 'mano:der');
const accion = (tipo, ahora, especie = 'pino') => obj.ejecutar({ autor: 'eva', tipo, arbol: idArbol(p1.x, p1.z), x: p1.x + 1, z: p1.z, ax: p1.x, az: p1.z, edad: 'adulto', especie }, ahora);
r = accion('descortezar', T0);
comprobar('en el servidor se descorteza, a lo que llevas', r.ok && obj.invs.de('eva').cuantos('corteza') >= 1, r.motivo);
r = accion('sangrar', T0, 'roble');
comprobar('y se sangra (con la especie del mundo, diga lo que diga el navegador)', r.ok, r.motivo);
for (const l of ['mano:der', 'mano:izq']) if (obj.invs.de('eva').lugares[l]?.tipo === 'corteza') obj.invs.de('eva').sacar(l);
r = accion('sangrar', T0 + RESINA_TARDA + 1000);
comprobar('y a las 4 h se coge su resina', r.ok && obj.invs.de('eva').cuantos('resina') === 1, r.motivo);
const vis = obj.talaVisible().estado[idArbol(p1.x, p1.z)];
comprobar('todos lo saben (lo que se reparte)', vis && vis.desc === true && vis.resina > 0);
const otro = new ObjetosServidor({ terreno, posicion: () => ({ x: p1.x + 1, z: p1.z }) }).importar(JSON.parse(JSON.stringify(obj.exportar())));
comprobar('y se guarda al volver a abrir el servidor', otro.tala.usos(idArbol(p1.x, p1.z), T0 + RESINA_TARDA + 2000).descortezar === false);

console.log(`\n${total - fallos}/${total} bien`);
process.exit(fallos ? 1 : 0);
