// Prueba de la sierra de tronzar y las tablas (P10, «Hierro y tablas»; src/logica/fabricacion.js, src/logica/troceo.js
// y src/logica/inventario.js). Lógica pura, sin servidor; y el servidor, con autor.
// Ejecutar: node pruebas/prueba_sierra_tablas.mjs
// Comprueba:
//   - la sierra: 2 barras y 2 mangos, en la fragua encendida, con el mazo de piedra (no se gasta);
//   - con la sierra en la mano, el tronco largo se tronza en menos golpes que con el hacha de hierro (y la rodaja);
//     partir sigue pidiendo el hacha;
//   - las tablas: en el banco de tronco, llevando la sierra (no se gasta), 1 tronco corto da 4; sin la sierra, no;
//   - el acopio de troncos guarda las tablas;
//   - por el servidor, con su autor: tronzar con la sierra y serrar tablas.
// MUTAR=1: la sierra tronza en los mismos golpes que el hacha de hierro: tiene que FALLAR.
// MUTAR=2: las tablas se hacen sin la sierra: tiene que FALLAR.
import { Fabricacion, RECETAS, ESTACIONES } from '../src/logica/fabricacion.js';
import { Inventario, Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Troceo, TROCEO, ejecutarTroceo, ENTRE_GOLPES, puedeTrocear } from '../src/logica/troceo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { Suelo } from '../src/logica/suelo.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

const MUTAR = process.env.MUTAR || '';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function jugador() {
  const inv = Inventario.inicial();
  inv.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  return inv;
}
if (MUTAR === '1') TROCEO.tronco_largo.golpes.sierra = TROCEO.tronco_largo.golpes.hierro;
if (MUTAR === '2') delete RECETAS.tablas.requiere;
const T0 = Date.UTC(2026, 10, 19, 9, 0, 0);
const AQUI = { x: 1, z: 0 };
const dejar = (fab, s, inv, tipo, n) => fab.depositar('ana', s, inv.rutasCon(tipo)[0], n, AQUI, inv);

console.log('Lo que dice la tarea');
{
  const S = RECETAS.sierra, T = RECETAS.tablas;
  comprobar('la sierra de tronzar: 2 barras y 2 mangos, en la fragua, con el mazo', S && S.uso === 'forjar' && igual(S.gasta, { barra_hierro: 2, mango: 2 }) && S.da === 'sierra' && S.n === 1 && igual(S.requiere, ['mazo_piedra']) && CATALOGO.sierra && CATALOGO.sierra.herramienta, JSON.stringify(S));
  comprobar('las tablas: 1 tronco corto da 4, en el banco de tronco, con la sierra', T && T.uso === 'banco' && igual(T.gasta, { tronco_corto: 1 }) && T.da === 'tabla' && T.n === 4 && igual(T.requiere, ['sierra']), JSON.stringify(T));
  comprobar('el acopio de troncos guarda las tablas', ESTACIONES.acopio_troncos.guarda.includes('tabla'));
}

console.log('La sierra en la fragua');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const s = fab.colocar('ana', 'fragua', 0, 0).id; delete fab.estaciones[s].obra;
  for (const [t, n] of [['mazo_piedra', 1], ['taladro_fuego', 1], ['barra_hierro', 2], ['mango', 2], ['carbon', 1], ['yesca', 1]]) inv.meterDonde(t, n);
  fab.echarFuego('ana', s, 'carbon', AQUI, inv, T0);
  let r = fab.encenderFuego('ana', s, AQUI, inv, T0);
  comprobar('la fragua se enciende', r.ok, r.motivo);
  dejar(fab, s, inv, 'barra_hierro', 2); dejar(fab, s, inv, 'mango', 1);
  r = fab.fabricar('ana', 'sierra', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('con un mango solo, no', !r.ok, r.motivo);
  dejar(fab, s, inv, 'mango', 1);
  r = fab.fabricar('ana', 'sierra', null, AQUI, inv, suelo, T0 + 1000);
  comprobar('con 2 barras y 2 mangos, se bate', r.ok, r.motivo);
  r = fab.recoger('ana', s, AQUI, inv, T0 + 1000 + RECETAS.sierra.s * 1000, suelo);
  comprobar('a su hora, la sierra; el mazo no se gasta', r.ok && inv.cuantos('sierra') === 1 && inv.cuantos('mazo_piedra') === 1, JSON.stringify(r));
}

console.log('Tronzar con la sierra');
{
  const nuevo = () => {
    const suelo = new Suelo(), l = suelo.dejar({ tipo: 'tronco_largo', n: 1 }, 0, 0, T0, 'ana', false, 0.5);
    const c = suelo.dejar({ tipo: 'tronco_corto', n: 1 }, 20, 0, T0, 'ana', false);
    return { suelo, troceo: new Troceo(suelo), invs: new Inventarios(), reg: new RegistroAcciones(), largo: l.id, corto: c.id };
  };
  const hasta = (m, objeto, x, modo) => {
    let r, n = 0, t = T0;
    for (; n < 300; n++) { r = ejecutarTroceo(m.troceo, m.invs, m.reg, { autor: 'ana', tipo: 'trocear', objeto, x, z: 0, ...(modo ? { modo } : {}) }, t); t += ENTRE_GOLPES; if (!r.ok || r.termina) { n++; break; } }
    return [n, r];
  };
  const a = nuevo(); a.invs.de('ana').coger('hacha_hierro', 1, 'mano:der');
  const [nh, rh] = hasta(a, a.largo, 0);
  const b = nuevo(); b.invs.de('ana').coger('sierra', 1, 'mano:der');
  comprobar('con la sierra en la mano se puede tronzar el largo, pero no partir el corto', puedeTrocear(b.invs.de('ana'), 'tronco_largo') && !puedeTrocear(b.invs.de('ana'), 'tronco_corto'));
  const [ns, rs] = hasta(b, b.largo, 0);
  comprobar('la sierra tronza el tronco largo', rs.ok && rs.termina && rs.hacha === 'sierra' && rs.da.tipo === 'tronco_corto' && rs.da.n >= 3, JSON.stringify(rs));
  comprobar('en menos golpes que el hacha de hierro', rh.termina && ns < nh, `sierra ${ns}, hacha de hierro ${nh}`);
  const c = nuevo(); c.invs.de('ana').coger('sierra', 1, 'mano:der');
  const [, rr] = hasta(c, c.largo, 0, 'rodaja');
  comprobar('y corta la rodaja', rr.ok && rr.termina && rr.da.tipo === 'rodaja', JSON.stringify(rr));
  const [, rp] = hasta(b, b.corto, 20);
  comprobar('partir el corto, con la sierra sola no', !rp.ok && /hacha/.test(rp.motivo || ''), rp.motivo);
  const d = nuevo(); d.invs.de('ana').coger('sierra', 1, 'mano:der'); d.invs.de('ana').coger('hacha_hierro', 1, 'mano:izq');
  const [nd, rd] = hasta(d, d.largo, 0);
  comprobar('con la sierra y el hacha, tronza la sierra', rd.hacha === 'sierra' && nd === ns, `${nd} golpes, ${rd.hacha}`);
}

console.log('Las tablas en el banco');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = jugador();
  const b = fab.colocar('ana', 'banco_tronco', 0, 0).id; delete fab.estaciones[b].obra;
  inv.lugares.hombro = { tipo: 'tronco_corto', n: 1 };
  let r = fab.depositar('ana', b, 'hombro', 1, AQUI, inv);
  comprobar('se deja el tronco corto en el banco', r.ok, r.motivo);
  r = fab.fabricar('ana', 'tablas', null, AQUI, inv, suelo, T0);
  comprobar('sin la sierra, no se sierra', !r.ok && /sierra/i.test(r.motivo || ''), r.motivo);
  inv.meterDonde('sierra', 1);
  r = fab.fabricar('ana', 'tablas', null, AQUI, inv, suelo, T0);
  comprobar('con la sierra, se sierra', r.ok, r.motivo);
  const fin = T0 + RECETAS.tablas.s * 1000;
  r = fab.recoger('ana', b, AQUI, inv, fin, suelo);
  const tablas = inv.cuantos('tabla') + suelo.visibles(fin).filter(o => o.cosa.tipo === 'tabla').reduce((t, o) => t + o.cosa.n, 0);
  comprobar('a su hora, 4 tablas; la sierra no se gasta', r.ok && tablas === 4 && inv.cuantos('sierra') === 1, `tablas ${tablas}`);
  // al acopio de troncos
  const ac = fab.colocar('ana', 'acopio_troncos', 5, 0, false, null, true).id; delete fab.estaciones[ac].obra;
  const mano = Inventario.inicial(); mano.lugares['mano:der'] = { tipo: 'tabla', n: 2 };
  r = fab.depositar('ana', ac, 'mano:der', undefined, { x: 5, z: 0 }, mano);
  comprobar('las tablas se guardan en el acopio de troncos', r.ok && fab.estaciones[ac].deposito.tabla === 2, r.motivo);
  r = fab.retirar('ana', ac, 'tabla', 2, { x: 5, z: 0 }, mano);
  comprobar('y se vuelven a sacar', r.ok && mano.cuantos('tabla') === 2, r.motivo);
}

console.log('Por el servidor, con autor');
{
  const pos = { ana: { x: 1, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'banco_tronco', 0, 0).id; delete o.fab.estaciones[id].obra;
  const ana = o.invs.de('ana'), T = Date.now();
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  ana.lugares.hombro = { tipo: 'tronco_corto', n: 1 };
  let r = o.ejecutar({ autor: 'ana', tipo: 'depositar_estacion', estacion: id, de: 'hombro', cantidad: 1, x: 1, z: 0 }, T);
  comprobar('Ana deja el tronco corto en el banco', r.ok, r.motivo);
  ana.coger('sierra', 1, 'mano:der');   // (con algo al hombro, las manos no llevan nada: la sierra, después)
  r = o.ejecutar({ autor: 'bea', tipo: 'fabricar', receta: 'tablas', estacion: id, x: 1, z: 0 }, T + 1000);
  comprobar('Bea, que no está al lado, no le sierra las tablas', !r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'fabricar', receta: 'tablas', estacion: id, x: 1, z: 0 }, T + 1000);
  comprobar('Ana sierra las tablas', r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'recoger_fabricado', estacion: id, x: 1, z: 0 }, T + 1000 + RECETAS.tablas.s * 1000);
  comprobar('y las recoge', r.ok && ana.cuantos('tabla') + o.suelo.visibles(T + 1e7).filter(x => x.cosa.tipo === 'tabla').reduce((t, x) => t + x.cosa.n, 0) === 4, r.motivo);
  // tronzar con la sierra, por el servidor
  const l = o.suelo.dejar({ tipo: 'tronco_largo', n: 1 }, 1, 0, T, 'ana', false, 0);
  let t = T + 5000, n = 0;
  do { r = o.ejecutar({ autor: 'ana', tipo: 'trocear', objeto: l.id, x: 1, z: 0 }, t); t += 2000; n++; } while (r.ok && !r.termina && n < 100);
  comprobar('Ana tronza un tronco largo con la sierra', r.ok && r.termina && r.hacha === 'sierra' && n === TROCEO.tronco_largo.golpes.sierra, `${n} golpes; ${r.motivo || ''}`);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
