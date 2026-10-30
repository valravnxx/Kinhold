// Pruebas de tronzar y partir (src/logica/troceo.js) y de llevar el tronco corto al hombro (src/logica/inventario.js).
// Ejecutar: node pruebas/prueba_troceo.mjs
// Con MUTAR=1 tronzar con piedra va tan rápido como con hierro y el tronco largo da un solo tronco corto: las pruebas
// deben FALLAR.
import { Troceo, TROCEO, ALCANCE_TROCEO, ENTRE_GOLPES, cuantoDa, seTrocea, ejecutarTroceo, guardarTroceo, cargarTroceo } from '../src/logica/troceo.js';
import { Inventarios, Inventario, CATALOGO, capacidad } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') { TROCEO.tronco_largo.golpes.piedra = TROCEO.tronco_largo.golpes.hierro; TROCEO.tronco_largo.n = [1, 1]; }
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 9, 30, 16);
function nuevo() {
  const suelo = new Suelo();
  const largo = suelo.dejar({ tipo: 'tronco_largo', n: 1 }, 0, 0, T0, 'ana', false, 0.5);
  const corto = suelo.dejar({ tipo: 'tronco_corto', n: 2 }, 20, 0, T0, 'ana', false);
  return { suelo, troceo: new Troceo(suelo), invs: new Inventarios(), reg: new RegistroAcciones(), largo: largo.id, corto: corto.id };
}
const conHacha = (invs, autor, tipo) => invs.de(autor).coger(tipo, 1, 'mano:der');
// golpea hasta terminar (o hasta «max»); devuelve [golpes, último resultado, hora]
function hasta(m, autor, objeto, x, z, t, max = 300) {
  let r, n = 0;
  for (; n < max; n++) {
    r = ejecutarTroceo(m.troceo, m.invs, m.reg, { autor, tipo: 'trocear', objeto, x, z }, t);
    t += ENTRE_GOLPES;
    if (!r.ok || r.termina) { n++; break; }
  }
  return [n, r, t];
}
const enSuelo = (m, tipo) => m.suelo.visibles(T0 + 1e9).filter(o => o.cosa.tipo === tipo).reduce((s, o) => s + o.cosa.n, 0);

console.log('Lo que dice el documento de sistemas (apartado 3, «De los árboles»)');
{
  comprobar('se tronza el tronco largo y se parte el corto; el delgado no', seTrocea('tronco_largo') && seTrocea('tronco_corto') && !seTrocea('tronco_delgado'));
  comprobar('el largo da 3–4 troncos cortos (grandes)', TROCEO.tronco_largo.da === 'tronco_corto' && TROCEO.tronco_largo.n[0] === 3 && TROCEO.tronco_largo.n[1] === 4 && CATALOGO.tronco_corto.tam === 'G');
  comprobar('el corto da leña (mediana)', TROCEO.tronco_corto.da === 'lena' && CATALOGO.lena.tam === 'M');
  comprobar('tronzar con hacha es lento: más golpes que partir', TROCEO.tronco_largo.golpes.hierro > 3 * TROCEO.tronco_corto.golpes.hierro);
  comprobar('con hacha de piedra, bastante más lento', TROCEO.tronco_largo.golpes.piedra >= 3 * TROCEO.tronco_largo.golpes.hierro, `${TROCEO.tronco_largo.golpes.piedra} y ${TROCEO.tronco_largo.golpes.hierro}`);
  const vistos = new Set(); for (let v = 0; v < 40; v++) vistos.add(cuantoDa('tronco_largo', 's7', v));
  comprobar('salen 3 y 4 troncos, según el tronco y la vez', vistos.has(3) && vistos.has(4) && vistos.size === 2);
  comprobar('fijo: el mismo tronco y la misma vez dan lo mismo', cuantoDa('tronco_largo', 's9', 2) === cuantoDa('tronco_largo', 's9', 2));
}

console.log('Tronzar el tronco largo');
{
  const m = nuevo();
  let r = ejecutarTroceo(m.troceo, m.invs, m.reg, { autor: 'ana', tipo: 'trocear', objeto: m.largo, x: 1, z: 0 }, T0);
  comprobar('sin hacha no se tronza', !r.ok && /hacha/.test(r.motivo), r.motivo);
  conHacha(m.invs, 'ana', 'hacha_hierro');
  r = ejecutarTroceo(m.troceo, m.invs, m.reg, { autor: 'ana', tipo: 'trocear', objeto: m.largo, x: ALCANCE_TROCEO + 1, z: 0 }, T0 + 1000);
  comprobar('de lejos no', !r.ok && /lejos/.test(r.motivo));
  const [n, ult] = hasta(m, 'ana', m.largo, 1, 0, T0 + 2000);
  comprobar('con hacha de hierro, los golpes que pide', ult.ok && ult.termina && n === TROCEO.tronco_largo.golpes.hierro, `${n} golpes`);
  comprobar('el tronco largo ya no está', enSuelo(m, 'tronco_largo') === 0 && !m.suelo.porId(m.largo, T0));
  const cortos = enSuelo(m, 'tronco_corto') - 2;
  comprobar('en el suelo, 3 o 4 troncos cortos más', cortos >= 3 && cortos <= 4 && ult.da.n === cortos, `${cortos}`);
  const caido = m.suelo.porId(ult.objeto, T0 + 60000);
  comprobar('caen al lado, tumbados como estaba el largo, y no desaparecen', caido && Math.abs(Math.hypot(caido.x, caido.z) - 1.2) < 0.02 && caido.giro === 0.5 && caido.desaparece === null);
  const reg = m.reg.entradas.filter(e => e.tipo === 'trocear');
  comprobar('cada golpe queda en el registro con su autor', reg.length === n + 2 && reg.every(e => e.autor === 'ana') && reg.at(-1).resultado.termina);
  // con piedra
  const p = nuevo(); conHacha(p.invs, 'eva', 'hacha_piedra');
  const [np, up] = hasta(p, 'eva', p.largo, 0, 1, T0);
  comprobar('con hacha de piedra, muchos más golpes', up.termina && np === TROCEO.tronco_largo.golpes.piedra, `${np}`);
  // de una pila de dos largos, se tronza de uno en uno
  const q = nuevo(); q.suelo.dejar({ tipo: 'tronco_largo', n: 1 }, 0.3, 0, T0, 'ana', false); conHacha(q.invs, 'ana', 'hacha_mano');
  const [, uq] = hasta(q, 'ana', q.largo, 1, 0, T0);
  comprobar('de una pila de dos, queda uno', uq.termina && uq.queda === 1 && enSuelo(q, 'tronco_largo') === 1 && q.troceo.progreso(q.largo) === 0);
}

console.log('Partir el tronco corto');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra');
  const [n, r] = hasta(m, 'ana', m.corto, 21, 0, T0);
  comprobar('con hacha de piedra, los golpes que pide', r.termina && n === TROCEO.tronco_corto.golpes.piedra, `${n}`);
  comprobar('da 6 de leña y queda un tronco corto', enSuelo(m, 'lena') === 6 && enSuelo(m, 'tronco_corto') === 1);
  const [, r2] = hasta(m, 'ana', m.corto, 21, 0, T0 + 60000);
  comprobar('el segundo: la leña se suma a la misma pila', r2.termina && enSuelo(m, 'lena') === 12 && m.suelo.visibles(T0).filter(o => o.cosa.tipo === 'lena').length === 1 && enSuelo(m, 'tronco_corto') === 0);
  const r3 = ejecutarTroceo(m.troceo, m.invs, m.reg, { autor: 'ana', tipo: 'trocear', objeto: r2.objeto, x: 21, z: 1 }, T0 + 120000);
  comprobar('la leña no se trocea más', !r3.ok && /no se trocea/.test(r3.motivo));
  // la leña va en el leñero: 18 (tres troncos partidos)
  const inv = new Inventario(); inv.coger('lenero', 1, 'espalda');
  comprobar('el leñero lleva 18 de leña: tres troncos partidos', capacidad('lenero').porTipo.lena === 3 * TROCEO.tronco_corto.n[0]);
  inv.coger('tronco_corto', 1, 'mano:der'); // con las manos ocupadas por un tronco, la leña solo cabe en el leñero
  comprobar('y la leña se guarda ahí (con un tronco en las manos)', inv.meterDonde('lena', 18).ok && inv.cuantos('lena') === 18 && !inv.meterDonde('lena', 1).ok);
}

console.log('Golpes, autores y acciones');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_hierro'); conHacha(m.invs, 'eva', 'hacha_hierro');
  const a = { autor: 'ana', tipo: 'trocear', objeto: m.largo, x: 1, z: 0 };
  ejecutarTroceo(m.troceo, m.invs, m.reg, a, T0);
  const r = ejecutarTroceo(m.troceo, m.invs, m.reg, a, T0 + ENTRE_GOLPES / 2);
  comprobar('dos golpes demasiado seguidos del mismo autor, no', !r.ok && /golpe anterior/.test(r.motivo));
  const r2 = ejecutarTroceo(m.troceo, m.invs, m.reg, { ...a, autor: 'eva' }, T0 + ENTRE_GOLPES / 2);
  comprobar('otro autor sí (entre dos va más rápido)', r2.ok && r2.golpes === 2);
  comprobar('sin autor, no', !ejecutarTroceo(m.troceo, m.invs, m.reg, { tipo: 'trocear', objeto: m.largo, x: 1, z: 0 }, T0 + 5000).ok);
  comprobar('sin hora, no', !ejecutarTroceo(m.troceo, m.invs, m.reg, { ...a }, NaN).ok);
  comprobar('datos raros, no', !ejecutarTroceo(m.troceo, m.invs, m.reg, { ...a, x: 'a' }, T0 + 6000).ok && !ejecutarTroceo(m.troceo, m.invs, m.reg, { ...a, tipo: 'talar' }, T0 + 7000).ok);
  comprobar('lo que no existe, no', !ejecutarTroceo(m.troceo, m.invs, m.reg, { ...a, objeto: 's999' }, T0 + 8000).ok);
  // dentro de tus tierras: lo que cae es tuyo y se queda (los troncos se quedan siempre)
  const t = nuevo(); conHacha(t.invs, 'ana', 'hacha_hierro');
  let tierras = null;
  for (let i = 0, h = T0; i < 10; i++, h += ENTRE_GOLPES) ejecutarTroceo(t.troceo, t.invs, t.reg, { autor: 'ana', tipo: 'trocear', objeto: t.corto, x: 20, z: 1 }, h, (autor, x, z) => { tierras = autor; return true; });
  comprobar('las tierras se miran con el autor de la acción', tierras === 'ana');
}

console.log('Llevar el tronco corto: con las dos manos o al hombro');
{
  const inv = new Inventario();
  comprobar('se coge con las dos manos', inv.coger('tronco_corto', 1, 'mano:der').ok && !inv.coger('piedra', 1, 'mano:izq').ok);
  comprobar('«Ponérselo» lo pasa al hombro y deja las manos libres', inv.ponerse('mano:der').ok && inv.lugares.hombro?.tipo === 'tronco_corto' && !inv.lugares['mano:der'] && inv.coger('hacha_hierro', 1, 'mano:der').ok);
  comprobar('al hombro cuenta como el hombro lleno', inv.lleno().lugares.hombro === 1);
  comprobar('no caben dos al hombro', !inv.coger('tronco_corto', 1, 'hombro').ok);
  comprobar('del hombro vuelve a las manos si están libres', !inv.quitarse('hombro', 'mano:izq').ok && inv.soltar('mano:der').ok && inv.quitarse('hombro', 'mano:der').ok && inv.lugares['mano:der'].tipo === 'tronco_corto');
  const otro = new Inventario();
  comprobar('el largo y el delgado no van al hombro', !otro.coger('tronco_delgado', 1, 'hombro').ok && !otro.coger('tronco_largo', 1, 'hombro').ok && !otro.coger('piedra', 1, 'hombro').ok);
  comprobar('va en el leñero (2 troncos cortos)', capacidad('lenero').porTipo.tronco_corto === 2);
  // al cargar un guardado con el tronco al hombro, sigue ahí
  const g = new Inventario(); g.coger('tronco_corto', 1, 'hombro');
  comprobar('se guarda y se carga al hombro', Inventario.importarJugador(g.exportarJugador()).lugares.hombro?.tipo === 'tronco_corto');
}

console.log('Guardado');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_hierro');
  hasta(m, 'ana', m.largo, 1, 0, T0, 5);
  const almacen = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  comprobar('se guarda', guardarTroceo(almacen, m.troceo));
  const t2 = cargarTroceo(almacen, new Troceo(m.suelo), T0);
  comprobar('lo que va a medias sigue al cargar', Math.abs(t2.progreso(m.largo) - 5 / TROCEO.tronco_largo.golpes.hierro) < 1e-9);
  comprobar('lo que ya no está en el suelo se olvida', Object.keys(cargarTroceo(almacen, new Troceo(new Suelo()), T0).estado).length === 0);
  const roto = { getItem() { return '{no'; } };
  comprobar('un guardado ilegible no rompe nada', Object.keys(cargarTroceo(roto, new Troceo(m.suelo), T0).estado).length === 0);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
