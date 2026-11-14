// Prueba de lógica: el hierro de pantano (P10, 14 nov; GDD: «tierra encharcada, agua rojiza»; documento de sistemas:
// «hierro de pantano — turberas, vegas — pala y criba»). En la lógica pura y en el servidor con el terreno de
// Whitholm, con su autor:
//   - las manchas salen solo en la vega (la ribera llana) y en las turberas, de la semilla del mundo (las mismas para
//     todos), y hay alguna cerca del río más cercano a la salida;
//   - sin la pala de madera y la criba encima (las dos), no se saca nada; con ellas, cada pasada da 1 mineral de hierro,
//     que se deja en el suelo junto a la mancha (un montoncito que crece), y se anota en el registro con su autor;
//   - cada mancha da de 3 a 5 pasadas, se agota y vuelve a salir pasados unos meses reales (90 días); lo que llevan
//     sacado las pasadas se guarda;
//   - la criba se hace en el banco de tronco con 2 mimbres y 1 vara.
// MUTAR=1: la mancha no se agota nunca. Tiene que FALLAR.
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, QUE_PIDE, pasadasDe } from '../src/logica/recoleccion.js';
import { DENSIDAD_RECOGIDA, recogidaEn } from '../src/logica/recogida_mundo.js';
import { RECETAS } from '../src/logica/fabricacion.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { Suelo } from '../src/logica/suelo.js';

const MUTAR = process.env.MUTAR;
let fallos = 0, total = 0;
function comprobar(nombre, cond, detalle = '') {
  total++; if (!cond) fallos++;
  console.log(`${cond ? '  bien' : '  MAL '}  ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
if (MUTAR === '1') RECOLECTABLES.hierro_pantano.pasadas = [1000, 1000];
const DIA = 24 * 3600 * 1000, T0 = Date.UTC(2026, 10, 14, 1);

console.log('La mancha y lo que pide');
const d = RECOLECTABLES.hierro_pantano;
comprobar('sale en la vega y en las turberas (y solo ahí)', d && JSON.stringify(d.donde) === '["vega","turbera"]' && Object.keys(DENSIDAD_RECOGIDA.hierro_pantano).every(z => d.donde.includes(z)));
comprobar('da mineral de hierro, de 1 en 1', d.da === 'mineral_hierro' && d.min === 1 && d.max === 1 && !!CATALOGO.mineral_hierro);
comprobar('la criba existe y se hace en el banco con 2 mimbres y 1 vara', !!CATALOGO.criba && RECETAS.criba && RECETAS.criba.uso === 'banco' && RECETAS.criba.gasta.mimbre === 2 && RECETAS.criba.gasta.vara === 1 && Object.keys(RECETAS.criba.gasta).length === 2, JSON.stringify(RECETAS.criba));

const id = 'hierro_pantano:10,0', invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
const rec = new Recoleccion([{ id, tipo: 'hierro_pantano', x: 1, z: 0 }]);
const cribar = (autor, ahora) => ejecutarRecoleccion(rec, invs, reg, { autor, tipo: 'recoger', punto: id, x: 1.5, z: 0 }, ahora, suelo);
const enSuelo = (ahora) => suelo.visibles(ahora).filter(o => o.cosa.tipo === 'mineral_hierro');
const ana = invs.de('ana'), eva = invs.de('eva');
let r = cribar('ana', T0);
comprobar('sin nada, no se saca', !r.ok && r.motivo === QUE_PIDE.cribar, r.motivo);
ana.meterDonde('criba', 1, 'mano:izq');
r = cribar('ana', T0);
comprobar('con la criba sola, tampoco', !r.ok && ana.cuantos('mineral_hierro') === 0, r.motivo);
ana.sacar('mano:izq'); ana.meterDonde('pala_madera', 1, 'mano:der');
r = cribar('ana', T0);
comprobar('con la pala sola, tampoco', !r.ok && ana.cuantos('mineral_hierro') === 0, r.motivo);
ana.meterDonde('criba', 1, 'mano:izq');
comprobar('(lleva la pala en una mano y la criba en la otra)', ana.cuantos('criba') === 1 && ana.cuantos('pala_madera') === 1);
const total0 = pasadasDe({ id, tipo: 'hierro_pantano' }, 0);
comprobar('la mancha da de 3 a 5 pasadas', total0 >= 3 && total0 <= 5, `${total0}`);
let pasadas = 0, ultimo = null;
for (let k = 0; k < 20; k++) {
  r = cribar('ana', T0 + k * 60000);
  if (!r.ok) break;
  pasadas++; ultimo = r;
}
const montones = enSuelo(T0 + 10 * 60000);
comprobar('con las dos, cada pasada da 1 mineral de hierro, hasta agotarla', pasadas === total0, `${pasadas} pasadas`);
comprobar('lo sacado queda en un montoncito junto a la mancha, con todo', montones.length === 1 && montones[0].cosa.n === pasadas && Math.hypot(montones[0].x - 1, montones[0].z) < 1.5, JSON.stringify(montones.map(o => [o.cosa.n, o.x, o.z])));
comprobar('la última dice que se ha agotado', ultimo && ultimo.quedan === 0);
comprobar('y ya no da más', !rec.disponible(id, T0 + 30 * DIA) && !cribar('ana', T0 + 30 * DIA).ok);
const e = reg.entradas ? reg.entradas.filter(x => x.resultado && x.resultado.objeto === 'mineral_hierro') : [];
comprobar('cada pasada, en el registro con su autor', e.length === pasadas && e.every(x => x.autor === 'ana'), `${e.length}`);
comprobar('y nada en lo de otro jugador', eva.cuantos('mineral_hierro') === 0);
comprobar('sin suelo donde dejarlo, no se criba', !ejecutarRecoleccion(new Recoleccion([{ id, tipo: 'hierro_pantano', x: 1, z: 0 }]), invs, reg, { autor: 'ana', tipo: 'recoger', punto: id, x: 1.5, z: 0 }, T0).ok);
comprobar('vuelve a salir pasados 90 días', rec.disponible(id, T0 + (pasadas - 1) * 60000 + 90 * DIA + 1000));

// lo que llevan sacado las pasadas se guarda (una mancha a medias)
const rec2 = new Recoleccion([{ id, tipo: 'hierro_pantano', x: 1, z: 0 }]), invs2 = new Inventarios();
invs2.de('eva').meterDonde('pala_madera', 1); invs2.de('eva').meterDonde('criba', 1);
ejecutarRecoleccion(rec2, invs2, new RegistroAcciones(), { autor: 'eva', tipo: 'recoger', punto: id, x: 1, z: 0 }, T0, new Suelo());
const rec3 = new Recoleccion([{ id, tipo: 'hierro_pantano', x: 1, z: 0 }]).importar(JSON.parse(JSON.stringify(rec2.exportar())));
comprobar('una mancha a medias se guarda con sus pasadas', rec3.estado[id] && rec3.estado[id].sacadas === 1 && rec3.disponible(id, T0), JSON.stringify(rec3.estado[id]));

console.log('En el mundo de Whitholm y en el servidor');
const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
const { ObjetosServidor } = await import('../src/logica/objetos_red.js');
const terreno = terrenoWhitholm(), O = terreno.origen;
// (la vega del río más cercano a la salida, a unos 800 m hacia el norte: mirado a mano el 14 nov)
const R = 120, cx = O.x - 9, cz = O.z - 802;
const puntos = recogidaEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: cx - R, z0: cz - R, x1: cx + R, z1: cz + R });
const manchas = puntos.filter(p => p.tipo === 'hierro_pantano');
comprobar('hay manchas de hierro de pantano en la vega del río más cercano', manchas.length > 0, `${manchas.length}`);
comprobar('todas en la vega o en la turbera', manchas.every(p => p.zonas.includes('vega') || p.zonas.includes('turbera')));
const otra = recogidaEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: cx - R, z0: cz - R, x1: cx + R, z1: cz + R }).filter(p => p.tipo === 'hierro_pantano');
comprobar('las mismas para todos (de la semilla del mundo)', JSON.stringify(otra.map(p => p.id)) === JSON.stringify(manchas.map(p => p.id)));
const m = manchas[0];
if (m) {
  const mx = m.x - O.x, mz = m.z - O.z;
  comprobar('el servidor la conoce', !!terreno.punto(m.id, mx, mz));
  const obj = new ObjetosServidor({ terreno, posicion: () => ({ x: mx + 1, z: mz }) });
  const lu = obj.invs.de('lu');
  const accion = (ahora) => obj.ejecutar({ autor: 'lu', tipo: 'recoger', punto: m.id, x: mx + 1, z: mz, px: mx, pz: mz, clase: 'hierro_pantano' }, ahora);
  r = accion(T0);
  comprobar('en el servidor, sin pala ni criba, no', !r.ok, r.motivo);
  lu.meterDonde('pala_madera', 1, 'mano:der'); lu.meterDonde('criba', 1, 'mano:izq');
  r = accion(T0);
  const deja = obj.suelo.visibles(T0).filter(o => o.cosa.tipo === 'mineral_hierro');
  comprobar('con ellas, el servidor deja 1 mineral de hierro junto a la mancha, de quien criba', r.ok && deja.length === 1 && deja[0].cosa.n === 1 && deja[0].autor === 'lu', r.motivo || JSON.stringify(deja));
  const vis = obj.exportar();
  const otro = new ObjetosServidor({ terreno, posicion: () => ({ x: mx + 1, z: mz }) }).importar(JSON.parse(JSON.stringify(vis)));
  comprobar('y se guarda al volver a abrir el servidor (la mancha a medias)', otro.recoleccion.estado[m.id] && otro.recoleccion.estado[m.id].sacadas === 1, JSON.stringify(otro.recoleccion.estado[m.id]));
}

console.log(`\n${total - fallos}/${total} bien`);
process.exit(fallos ? 1 : 0);
