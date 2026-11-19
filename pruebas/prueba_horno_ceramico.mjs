// Prueba de la arcilla y el horno cerámico (P10, «Hierro y tablas»; src/logica/recoleccion.js, recogida_mundo.js,
// fabricacion.js y fuego.js). Lógica pura, y el servidor, que lo enciende con autor.
// Ejecutar: node pruebas/prueba_horno_ceramico.mjs
// Comprueba:
//   - en el mundo de verdad salen bancos de arcilla en la orilla y la ribera, junto a donde sale el barro (sin mover
//     lo que ya salía en otras celdas);
//   - con la pala de madera se cava 1 cesta de arcilla; con el palo cavador, no; y es inagotable, como el barro;
//   - el horno cerámico (6 cestas de arcilla y 10 piedras; fuera, en tu tierra) se levanta como los demás puestos;
//   - su fuego solo arde leña (ni ramas ni carbón), y se enciende con yesca y el taladro de fuego;
//   - por el servidor, con su autor: le echa leña, lo enciende y todos lo ven encendido.
// MUTAR=1: la arcilla se cava con el palo cavador: tiene que FALLAR.
// MUTAR=2: al horno cerámico se le pueden echar ramas: tiene que FALLAR.
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, HERRAMIENTAS_RECOGER, QUE_PIDE } from '../src/logica/recoleccion.js';
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { Fabricacion, ESTACIONES, USOS, MAX_RATO_ESTACION, motivoTierra } from '../src/logica/fabricacion.js';
import { Inventario, Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { COMO, ARDE } from '../src/logica/fuego.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

const MUTAR = process.env.MUTAR || '';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (MUTAR === '1') HERRAMIENTAS_RECOGER.pala.push('palo_cavador');
if (MUTAR === '2') COMO.horno_ceramico.come = ['lena', 'rama'];
const T0 = Date.UTC(2026, 10, 19, 23, 0, 0);

console.log('Lo que dice la tarea');
{
  const A = RECOLECTABLES.arcilla, E = ESTACIONES.horno_ceramico;
  comprobar('la arcilla: en la orilla y la ribera, se cava, da 1 cesta de arcilla, inagotable', A && igual(A.donde, ['rio', 'ribera']) && A.accion === 'cavar' && A.da === 'arcilla' && A.min === 1 && A.max === 1 && A.vuelve === 0 && CATALOGO.arcilla, JSON.stringify(A));
  comprobar('se cava con la pala de madera (no con el palo cavador)', igual(HERRAMIENTAS_RECOGER[A.con], ['pala_madera']) || MUTAR === '1', JSON.stringify(HERRAMIENTAS_RECOGER[A.con]));
  comprobar('el horno cerámico: 6 cestas de arcilla y 10 piedras; fuera y en tu tierra; con fuego; da el cocer', E && igual(E.coste, { arcilla: 6, piedra: 10 }) && E.donde === 'fuera' && E.tierra && E.fuego && E.uso === 'cocer' && igual(USOS.cocer.estaciones, ['horno_ceramico']), JSON.stringify(E));
  comprobar('su fuego come leña', igual(COMO.horno_ceramico.come, ['lena']), JSON.stringify(COMO.horno_ceramico));
  comprobar('fuera de tu tierra, dice por qué', /horno cerámico/.test(motivoTierra('horno_ceramico')), motivoTierra('horno_ceramico'));
}

console.log('Los bancos de arcilla en el mundo de verdad');
{
  const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
  const terreno = terrenoWhitholm(), O = terreno.origen;
  // (el río más cercano a la salida, a unos 800 m hacia el norte: el de la vega del hierro de pantano)
  const R = 300, cx = O.x - 9, cz = O.z - 802;
  const puntos = recogidaEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: cx - R, z0: cz - R, x1: cx + R, z1: cz + R });
  const arcillas = puntos.filter(p => p.tipo === 'arcilla'), barros = puntos.filter(p => p.tipo === 'barro');
  console.log(`  (${2 * R} m alrededor del río del norte: ${arcillas.length} bancos de arcilla y ${barros.length} sitios de barro)`);
  comprobar('hay al menos un banco de arcilla en el río más cercano a la salida (es inagotable: con uno basta)', arcillas.length >= 1, `${arcillas.length}`);
  comprobar('cada uno en la orilla o la ribera', arcillas.every(p => p.zonas.includes('rio') || p.zonas.includes('ribera')));
  const cerca = arcillas.filter(a => barros.some(b => Math.hypot(a.x - b.x, a.z - b.z) < 60)).length;
  comprobar('junto a donde sale el barro (a menos de 60 m de un sitio de barro)', cerca === arcillas.length, `${cerca} de ${arcillas.length}`);
  comprobar('menos que el barro', arcillas.length < barros.length, `${arcillas.length} < ${barros.length}`);
  const otra = recogidaEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: cx - R, z0: cz - R, x1: cx + R, z1: cz + R }).filter(p => p.tipo === 'arcilla');
  comprobar('los mismos para todos (de la semilla del mundo)', JSON.stringify(otra.map(p => p.id)) === JSON.stringify(arcillas.map(p => p.id)));
  const m = arcillas[0];
  if (m) {   // cavarla por el servidor, con su autor
    const mx = m.x - O.x, mz = m.z - O.z;
    comprobar('el servidor la conoce', !!terreno.punto(m.id, mx, mz));
    const obj = new ObjetosServidor({ terreno, posicion: () => ({ x: mx + 1, z: mz }) });
    const lu = obj.invs.de('lu'); lu.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
    const cavar = (ahora) => obj.ejecutar({ autor: 'lu', tipo: 'recoger', punto: m.id, x: mx + 1, z: mz, px: mx, pz: mz, clase: 'arcilla' }, ahora);
    let r = cavar(T0);
    comprobar('sin la pala, el servidor dice que no', !r.ok && /pala de madera/.test(r.motivo || ''), r.motivo);
    lu.meterDonde('pala_madera', 1);
    r = cavar(T0); const r2 = cavar(T0 + 1000);
    comprobar('con la pala de madera, Lu cava dos cestas de arcilla seguidas', r.ok && r2.ok && lu.cuantos('arcilla') === 2, r.motivo || r2.motivo);
  }
  globalThis.__banco = m;
}

console.log('Cavar la arcilla');
{
  const p = { id: 'arcilla:10,0', tipo: 'arcilla', x: 1, z: 0 };
  const rec = new Recoleccion([p]), invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
  const yo = invs.de('ana'); yo.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  const cavar = (t, autor = 'ana') => ejecutarRecoleccion(rec, invs, reg, { autor, tipo: 'recoger', punto: p.id, x: p.x + 1, z: p.z }, t, suelo);
  let r = cavar(T0);
  comprobar('sin nada, no: dice que hace falta la pala de madera', !r.ok && r.motivo === QUE_PIDE.pala, r.motivo);
  yo.meterDonde('palo_cavador', 1);
  r = cavar(T0);
  comprobar('con el palo cavador, tampoco', !r.ok && /pala de madera/.test(r.motivo || '') && yo.cuantos('arcilla') === 0, r.motivo);
  yo.meterDonde('pala_madera', 1);
  r = cavar(T0);
  comprobar('con la pala de madera, 1 cesta de arcilla', r.ok && yo.cuantos('arcilla') === 1 && r.objeto === 'arcilla' && r.cantidad === 1, JSON.stringify(r));
  r = cavar(T0 + 1000);
  comprobar('y otra enseguida: no se agota', r.ok && yo.cuantos('arcilla') === 2, r.motivo);
  const e = reg.lista ? reg.lista().slice(-1)[0] : null;
  comprobar('queda en el registro con su autor', !e || e.autor === 'ana', JSON.stringify(e));
}

console.log('Levantar el horno cerámico y encenderlo con leña');
{
  const fab = new Fabricacion(), suelo = new Suelo(), inv = Inventario.inicial(), AQUI = { x: 1, z: 0 };
  inv.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  const r0 = fab.colocar('ana', 'horno_ceramico', 0, 0);
  comprobar('se pone su marco', r0.ok, r0.motivo);
  const s = r0.id;
  inv.meterDonde('piedra', 10);
  for (let i = 0; i < 6; i++) suelo.dejar({ tipo: 'arcilla', n: 1 }, 0.4 + i * 0.15, 0.3, T0, 'ana', true);
  for (let i = 0; i < 6; i++) fab.entregarEstacion('ana', s, { x: 0, z: 0 }, inv, suelo, T0);
  for (let i = 0; i < 20 && fab.estaciones[s].obra; i++) fab.trabajarEstacion('ana', s, MAX_RATO_ESTACION, { x: 0, z: 0 }, inv);
  comprobar('se levanta con sus 6 cestas de arcilla y sus 10 piedras', !fab.estaciones[s].obra && inv.cuantos('piedra') === 0 && !suelo.visibles(T0).some(o => o.cosa.tipo === 'arcilla') && fab.estaciones[s].fuego, JSON.stringify(fab.estaciones[s].obra || {}));
  inv.meterDonde('yesca', 1); inv.meterDonde('taladro_fuego', 1); inv.meterDonde('rama', 1); inv.meterDonde('carbon', 1);
  let r = fab.echarFuego('ana', s, 'rama', AQUI, inv, T0);
  comprobar('ramas, no: solo arde leña', !r.ok && inv.cuantos('rama') === 1 && /leña/.test(r.motivo || ''), r.motivo);
  r = fab.echarFuego('ana', s, 'carbon', AQUI, inv, T0);
  comprobar('carbón, tampoco', !r.ok && inv.cuantos('carbon') === 1, r.motivo);
  r = fab.encenderFuego('ana', s, AQUI, inv, T0);
  comprobar('sin nada puesto no se enciende, y dice que le eches leña', !r.ok && /leña/.test(r.motivo || '') && !/ramas/.test(r.motivo || ''), r.motivo);
  let n = 0; for (let k = 0; k < 13; k++) { if (!inv.cuantos('lena')) inv.meterDonde('lena', 1); if (fab.echarFuego('ana', s, 'lena', AQUI, inv, T0).ok) n++; }
  comprobar('le caben 12 leñas (2 h de fuego), y la 13.ª ya no', n === 12 && inv.cuantos('lena') === 1, `${n}`);
  r = fab.encenderFuego('ana', s, AQUI, inv, T0);
  comprobar('con yesca y el taladro, se enciende y arde 2 h', r.ok && inv.cuantos('yesca') === 0 && r.hasta === T0 + 12 * ARDE.lena * 1000, r.motivo);
}

console.log('Por el servidor, con autor');
{
  const pos = { ana: { x: 1, z: 0 } };
  const o = new ObjetosServidor({ posicion: a => pos[a] || null });
  const id = o.fab.colocar('ana', 'horno_ceramico', 0, 0).id; delete o.fab.estaciones[id].obra;   // ya levantado
  o.fab.estaciones[id].fuego = { hasta: 0, combustible: 0, cenizas: false };
  const ana = o.invs.de('ana'), T = Date.now();
  ana.lugares.espalda = { tipo: 'mochila_bastidor', n: 1, dentro: Array(8).fill(null) };
  for (const [t, n] of [['lena', 2], ['rama', 1], ['yesca', 1], ['taladro_fuego', 1]]) ana.meterDonde(t, n);
  let r = o.ejecutar({ autor: 'ana', tipo: 'echar_fuego', estacion: id, objeto: 'rama', x: 1, z: 0 }, T);
  comprobar('Ana no puede echarle una rama', !r.ok, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'echar_fuego', estacion: id, objeto: 'lena', x: 1, z: 0 }, T);
  comprobar('le echa una leña', r.ok && ana.cuantos('lena') === 1, r.motivo);
  r = o.ejecutar({ autor: 'ana', tipo: 'encender_fuego', estacion: id, x: 1, z: 0 }, T);
  comprobar('y lo enciende', r.ok, r.motivo);
  const vista = o.estacionesVisibles(null, T + 1000).find(e => e.id === id);
  comprobar('todos ven su fuego encendido', vista && vista.fuego && vista.fuego.encendida, JSON.stringify(vista && vista.fuego));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
