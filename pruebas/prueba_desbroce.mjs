// Prueba de lógica: desbrozar matorrales y arbustos de bayas (valravnx, 8 nov; GDD apartado 8 y sistemas apartado 3).
// En la lógica pura (src/logica/recoleccion.js) y en el servidor con el terreno de Whitholm (src/logica/terreno_servidor.js
// y src/logica/objetos_red.js), con su autor:
//   - sin hacha ni lasca no se desbroza; con el hacha de piedra, sí: de 2 a 4 ramas y a veces una vara, al suelo donde
//     estaba la mata (como lo que deja un árbol talado);
//   - el matorral queda quitado (no en pie) y no se vuelve a desbrozar hasta que rebrota, en una estación;
//   - un matorral no se recoge (se desbroza), y no sale entre lo que se recoge;
//   - el arbusto de bayas también se desbroza: se van sus bayas y el arbusto, y en una estación vuelve todo;
//   - con algo al hombro, no;
//   - lo guardado y vuelto a cargar recuerda lo quitado;
//   - el servidor conoce los matorrales del mundo (los mismos que dibuja el navegador, por su nombre) y rechaza los que
//     no existen; desbrozar cansa.
// MUTAR=1: el matorral no queda quitado (se puede desbrozar sin fin); MUTAR=2: sin herramienta también. Tienen que FALLAR.
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, TIEMPOS, idMata, conQueDesbroza, GOLPES_DESBROCE } from '../src/logica/recoleccion.js';
import { Inventarios } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ESFUERZOS } from '../src/logica/necesidades.js';

const MUTAR = process.env.MUTAR;
let fallos = 0, total = 0;
function comprobar(nombre, cond, detalle = '') {
  total++; if (!cond) fallos++;
  console.log(`${cond ? '  bien' : '  MAL '}  ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
if (MUTAR === '1') { const d = Recoleccion.prototype.desbrozar; Recoleccion.prototype.desbrozar = function (...a) { const r = d.apply(this, a); if (r.ok) delete this.estado[a[1]]; return r; }; }

const T0 = Date.UTC(2026, 10, 8, 9);
const mata = { id: idMata(10, 4), tipo: 'matorral', x: 10, z: 4 };
const baya = { id: 'bayas:7,3', tipo: 'bayas', x: 20, z: 4 };
const rec = new Recoleccion([mata, baya]);
const invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
const yo = 'ana', inv = invs.de(yo);
const desbrozar = (punto, x, z, ahora = T0) => ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'desbrozar', punto, x, z }, ahora, suelo);
const enSuelo = (tipo) => suelo.objetos.filter(o => o.cosa.tipo === tipo).reduce((n, o) => n + o.cosa.n, 0);
if (MUTAR === '2') { const orig = inv.cuantos.bind(inv); inv.cuantos = (t) => (t === 'hacha_piedra' ? 1 : orig(t)); }

console.log('Desbrozar en la lógica');
comprobar('el nombre del matorral sale de su sitio', mata.id === 'matorral:100,40', mata.id);
let r = desbrozar(mata.id, 10.5, 4);
comprobar('sin hacha ni lasca no se desbroza', !r.ok && /hacha o una lasca/.test(r.motivo), r.motivo);
r = inv.coger('hacha_piedra', 1, 'mano:der');
comprobar('(se pone un hacha de piedra en la mano)', r.ok, r.motivo);
comprobar('con el hacha se desbroza más deprisa que con la lasca', GOLPES_DESBROCE.hacha_piedra < GOLPES_DESBROCE.lasca_silex, JSON.stringify(GOLPES_DESBROCE));
r = desbrozar(mata.id, 30, 4);
comprobar('lejos no', !r.ok && /lejos/.test(r.motivo), r.motivo);
r = desbrozar(mata.id, 10.5, 4);
const ramas = enSuelo('rama'), varas = enSuelo('vara');
comprobar('con el hacha de piedra se desbroza: de 2 a 4 ramas y como mucho una vara', r.ok && ramas >= 2 && ramas <= 4 && varas <= 1 && r.cantidad === ramas, `${r.motivo || ''} ramas ${ramas}, varas ${varas}`);
comprobar('caen al suelo donde estaba la mata (no a lo que llevas)', inv.cuantos('rama') === 0 && suelo.objetos.every(o => Math.hypot(o.x - 10, o.z - 4) < 1), JSON.stringify(suelo.objetos.map(o => [o.cosa.tipo, o.x, o.z])));
comprobar('el matorral queda quitado', !rec.enPie(mata.id, T0 + 1000));
r = desbrozar(mata.id, 10.5, 4, T0 + 1000);
comprobar('no se vuelve a desbrozar hasta que rebrota', !r.ok && /rebrotado/.test(r.motivo), r.motivo);
comprobar('rebrota en una estación', !rec.enPie(mata.id, T0 + TIEMPOS.estacion - 1000) && rec.enPie(mata.id, T0 + TIEMPOS.estacion + 1000));
comprobar('un matorral no está entre lo que se recoge', !rec.cercanos(10, 4, T0 + TIEMPOS.estacion + 1000, 3).some(p => p.id === mata.id));
r = ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'recoger', punto: mata.id, x: 10.5, z: 4 }, T0 + TIEMPOS.estacion + 1000);
comprobar('ni se recoge: se desbroza', !r.ok && /desbroza/.test(r.motivo), r.motivo);
comprobar('cada vez da su azar fijo (el mismo en el navegador y en el servidor)', (() => { const a = new Recoleccion([{ ...mata }]), b = new Recoleccion([{ ...mata }]); const ia = new Inventarios(), ib = new Inventarios(); for (const i of [ia, ib]) i.de('x').coger('hacha_piedra', 1, 'mano:der'); const ra = a.desbrozar(ia.de('x'), mata.id, 10, 4, T0), rb = b.desbrozar(ib.de('x'), mata.id, 10, 4, T0); return ra.ok && ra.cantidad === rb.cantidad && JSON.stringify(ra.extra) === JSON.stringify(rb.extra); })());
comprobar('sin el suelo (donde cae lo cortado) no se desbroza', !ejecutarRecoleccion(new Recoleccion([{ ...mata }]), invs, reg, { autor: yo, tipo: 'desbrozar', punto: mata.id, x: 10, z: 4 }, T0).ok);

console.log('El arbusto de bayas');
const nb = inv.cuantos('bayas');
r = ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'recoger', punto: baya.id, x: 20.5, z: 4 }, T0);
comprobar('primero se le cogen las bayas (el arbusto sigue en pie)', r.ok && rec.enPie(baya.id, T0 + 1) && !rec.disponible(baya.id, T0 + 1), r.motivo);
const r0 = enSuelo('rama');
r = desbrozar(baya.id, 20.5, 4, T0 + 2000);
comprobar('y luego se desbroza: da ramas y el arbusto se va', r.ok && enSuelo('rama') > r0 && !rec.enPie(baya.id, T0 + 3000), r.motivo);
comprobar('en una estación vuelven el arbusto y sus bayas', rec.enPie(baya.id, T0 + 2000 + TIEMPOS.estacion + 1) && rec.disponible(baya.id, T0 + 2000 + TIEMPOS.estacion + 1));

console.log('Las manos, y lo guardado');
const lleno = new Recoleccion([{ id: idMata(50, 50), tipo: 'matorral', x: 50, z: 50 }]);
const invs2 = new Inventarios(), j = invs2.de('luis');
j.coger('tronco_corto', 1, 'hombro');
r = lleno.desbrozar(j, idMata(50, 50), 50, 50, T0);
comprobar('con algo al hombro no se desbroza', !r.ok && /hombro/.test(r.motivo), r.motivo);
const datos = JSON.parse(JSON.stringify(rec.exportar()));
const otra = new Recoleccion([{ ...mata }, { ...baya }]).importar(datos);
comprobar('lo guardado recuerda lo quitado', !otra.enPie(mata.id, T0 + 1000) && !otra.enPie(baya.id, T0 + 3000));
comprobar('desbrozar cansa (como un rato de obra)', ESFUERZOS.desbrozar >= 1, String(ESFUERZOS.desbrozar));
comprobar('y queda en el registro con su autor', reg.entradas.some(e => e.tipo === 'desbrozar' && e.autor === yo && e.ok));

console.log('En el servidor, con el terreno de Whitholm');
const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
const { ObjetosServidor } = await import('../src/logica/objetos_red.js');
const { vegetacionEn } = await import('../src/logica/vegetacion.js');
const terreno = terrenoWhitholm();
// el primer matorral a más de 10 m de la salida, como lo ve el navegador (la vegetación del mundo, en la escena)
const O = terreno.origen;
let m1 = null;
for (let R = 20; !m1 && R < 400; R += 30) {
  const v = vegetacionEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: O.x - R, z0: O.z - R, x1: O.x + R, z1: O.z + R }, { x: O.x, z: O.z, r: R });
  const l = v.matas.map(e => ({ x: e.x - O.x, z: e.z - O.z })).filter(e => Math.hypot(e.x, e.z) > 10).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  if (l.length) m1 = l[0];
}
comprobar('hay matorrales cerca de la salida', !!m1, m1 ? `a ${Math.hypot(m1.x, m1.z).toFixed(0)} m` : '');
const t1 = m1 && terreno.punto(idMata(m1.x, m1.z), m1.x, m1.z);
comprobar('el servidor lo conoce por su nombre (el mismo que el del navegador)', !!t1 && t1.tipo === 'matorral', JSON.stringify(t1));
comprobar('y un matorral que no existe, no', !terreno.punto(idMata(m1.x + 0.73, m1.z + 0.41), m1.x + 0.73, m1.z + 0.41));
const obj = new ObjetosServidor({ terreno, posicion: () => ({ x: m1.x + 0.5, z: m1.z }) });
obj.invs.de('eva').coger('hacha_piedra', 1, 'mano:der');
r = obj.ejecutar({ autor: 'eva', tipo: 'desbrozar', punto: idMata(m1.x, m1.z), x: m1.x + 0.5, z: m1.z, px: m1.x, pz: m1.z, clase: 'matorral' }, T0);
comprobar('en el servidor, con el hacha, se desbroza y las ramas caen a su suelo', r.ok && r.suelo && obj.suelo.objetos.filter(o => o.cosa.tipo === 'rama').reduce((n, o) => n + o.cosa.n, 0) >= 2, r.motivo);
r = obj.ejecutar({ autor: 'eva', tipo: 'desbrozar', punto: idMata(m1.x + 0.73, m1.z + 0.41), x: m1.x + 0.5, z: m1.z, px: m1.x + 0.73, pz: m1.z + 0.41, clase: 'matorral' }, T0);
comprobar('uno que no existe, no', !r.ok, r.motivo);
const vis = obj.recoleccionVisible();
comprobar('lo desbrozado sale en lo que se reparte (quitado)', vis.estado[idMata(m1.x, m1.z)] && vis.estado[idMata(m1.x, m1.z)].quitado === true);

console.log(`\n${total - fallos}/${total} bien`);
process.exit(fallos ? 1 : 0);
