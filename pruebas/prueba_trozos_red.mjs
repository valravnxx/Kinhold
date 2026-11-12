// Prueba de lo que el servidor manda por trozos (src/logica/trozos_red.js y servidor/servidor.mjs), con clientes de
// verdad por websocket.
// Ejecutar: node pruebas/prueba_trozos_red.mjs
// Comprueba: los trozos de alrededor (5 × 5) y los que entran al moverse; un árbol talado y un punto recogido llegan
// a quien está cerca y no a quien está lejos (ni en la bienvenida de quien entra lejos); al acercarse, el que estaba
// lejos recibe lo de los trozos que le entran (lo talado, lo recogido y lo del suelo); el suelo de cada uno, solo el
// de sus trozos; lo guardado va por trozos (objetos.json versión 3) y se lee igual, también el formato anterior (2).
// Con MUTAR=1 se prueba un servidor que reparte lo talado a todos, cerca o lejos: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('if (a === autor || (k && vista.tiene(a, k))) hacer(otro, solo);', 'hacer(otro, solo);');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_trozos.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);
const T = await import(pathToFileURL(join(raiz, 'src/logica/trozos_red.js')).href);
const { ObjetosServidor } = await import(pathToFileURL(join(raiz, 'src/logica/objetos_red.js')).href);
const { idArbol } = await import(pathToFileURL(join(raiz, 'src/logica/tala.js')).href);

console.log('Lógica de los trozos');
comprobar('el trozo de un punto', T.trozoDe(0, 0) === '0,0' && T.trozoDe(-1, 0) === '-1,0' && T.trozoDe(T.LADO_RED * 2.5, -T.LADO_RED * 0.5) === '2,-1');
const alr = T.trozosAlrededor(0, 0);
comprobar('alrededor, un cuadro de 5 × 5', alr.size === 25 && alr.has('-2,-2') && alr.has('2,2') && !alr.has('3,0'));
{
  const v = new T.VistaTrozos();
  const e1 = v.mover('a', 10, 10), e2 = v.mover('a', 20, 30), e3 = v.mover('a', T.LADO_RED + 5, 10);
  comprobar('la primera vez entran todos; en el mismo trozo, ninguno; al pasar al de al lado, una columna de 5',
    e1.length === 25 && e2.length === 0 && e3.length === 5 && e3.every(k => k.startsWith('3,')), `${e1.length} · ${e2.length} · ${e3.join(' ')}`);
  v.mover('a', 10, 10);
  const e4 = v.mover('a', T.LADO_RED + 5, 10);
  comprobar('lo que salió se olvida: al volver entra otra vez (por si ha cambiado mientras)', e4.length === 5);
  comprobar('mover con números raros no hace nada', v.mover('a', NaN, 0).length === 0);
}
{
  const g = T.agrupar([{ id: 'p:1', x: 1, z: 1 }, { id: 'p:2', x: 300, z: 1 }, { id: 'p:3', x: 2, z: 3 }], { 'p:1': { vuelve: 5 }, 'p:2': { vuelve: 6 } });
  comprobar('agrupar por trozo', Object.keys(g).sort().join('|') === '0,0|2,0' && g['0,0'].cosas.length === 2 && g['2,0'].estado['p:2'].vuelve === 6);
  const d = T.desagrupar(g);
  comprobar('y desagrupar lo deja como estaba', d.cosas.length === 3 && d.estado['p:1'].vuelve === 5 && d.estado['p:2'].vuelve === 6 && !d.estado['p:3']);
  comprobar('desagrupar algo raro no rompe', T.desagrupar(null).cosas.length === 0 && T.desagrupar([1]).cosas.length === 0 && T.desagrupar({ x: 3, y: { cosas: 'no' } }).cosas.length === 0);
}

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 2000) => new Promise((r, f) => {
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.de = (tipo) => c.recibidos.filter(m => m.tipo === tipo);
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    const b = c.esperar(m => m.tipo === 'bienvenida');
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'kinhold-trozos-'));
const archivo = join(dir, 'mundo.jsonl');
const LEJOS = 1000;   // m: a 7 trozos de la salida
try {
  let s = crearServidor({ arconPruebas: true, puerto: 0, archivo, limiteMovimiento: false });
  const puerto = await s.listo;
  s.objetos.tala.entre = 0;
  const a = await cliente(puerto), b = await cliente(puerto);
  comprobar('la bienvenida dice el lado y el radio de los trozos', a.bienvenida.trozos?.lado === T.LADO_RED && a.bienvenida.trozos?.radio === T.RADIO_RED);
  a.estar(10, 10); b.estar(LEJOS, LEJOS); await pausa(200);
  const tr = b.de('trozos').at(-1);
  comprobar('B, al irse lejos, recibe los trozos que le entran', tr && tr.entran.length === 25 && tr.entran.includes('7,7'), tr && tr.entran.length);

  console.log('Talar cerca de A, con B lejos');
  let r = await a.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  const arbol = idArbol(11, 10);
  let golpes = 0;
  do { r = await a.objeto({ tipo: 'talar', arbol, x: 10, z: 10, ax: 11, az: 10, edad: 'adulto' }); golpes++; } while (r.ok && !r.datos.cae && golpes < 30);
  comprobar('A tala el árbol', r.ok && r.datos.cae, r.motivo);
  await pausa(200);
  const talaA = a.de('tala').at(-1);
  comprobar('A recibe que cae, con el tocón', talaA && talaA.cae.arbol === arbol && talaA.estado.estado[arbol]?.vuelve > Date.now());
  // caído, se queda entero hasta que se limpia con hacha (valravnx, 12 nov): A lo limpia y entonces deja lo suyo
  golpes = 0;
  do { r = await a.objeto({ tipo: 'talar', arbol, x: 10, z: 10, ax: 11, az: 10, edad: 'adulto' }); golpes++; } while (r.ok && !r.datos.limpio && golpes < 30);
  comprobar('A lo limpia', r.ok && r.datos.limpio, r.motivo);
  await pausa(200);
  comprobar('B, lejos, no recibe nada de ese árbol', b.de('tala').length === 0, `${b.de('tala').length} mensajes`);
  comprobar('y en su suelo no está lo que ha dejado', b.de('suelo').length > 0 && b.de('suelo').every(m => !m.objetos.some(o => o.cosa.tipo === 'tronco_largo')));
  comprobar('A sí lo ve en su suelo', a.de('suelo').at(-1)?.objetos.some(o => o.cosa.tipo === 'tronco_largo'));

  console.log('Recoger cerca de A');
  a.estar(5, 5); await pausa(150);
  r = await a.objeto({ tipo: 'recoger', punto: 'piedra:3', x: 5, z: 5, px: 5.5, pz: 5, clase: 'piedra' });
  await pausa(150);
  comprobar('A recoge y se entera', r.ok && a.de('recoleccion').at(-1)?.estado.estado['piedra:3']?.vuelve > Date.now(), r.motivo);
  comprobar('B, lejos, no', b.de('recoleccion').length === 0);

  console.log('Quien entra lejos');
  const c = await cliente(puerto);
  // (sin posición guardada, aparece en la salida: su bienvenida lleva lo de ahí; se le aleja y vuelve a entrar)
  comprobar('quien aparece en la salida lo ve en su bienvenida', c.bienvenida.tala.estado[arbol] && c.bienvenida.recoleccion.estado['piedra:3'] && c.bienvenida.suelo.some(o => o.cosa.tipo === 'tronco_largo'));
  const yoC = c.bienvenida.autor;
  c.estar(LEJOS, LEJOS); await pausa(200);
  c.ws.close(); await pausa(150);
  const c2 = await new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}?ficha=${c.bienvenida.ficha}`);
    ws.on('message', d => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { listo(m); ws.close(); } });
    ws.on('error', fallo);
  });
  comprobar('quien vuelve lejos (donde lo dejó) no recibe en la bienvenida lo de la salida',
    c2.autor === yoC && c2.posicion?.x === LEJOS && !c2.tala.estado[arbol] && !c2.recoleccion.estado['piedra:3'] && !c2.suelo.some(o => o.cosa.tipo === 'tronco_largo'),
    `posición ${JSON.stringify(c2.posicion)} · tala ${Object.keys(c2.tala.estado).length} · rec ${Object.keys(c2.recoleccion.estado).length} · suelo ${c2.suelo.length}`);

  console.log('B se acerca');
  const llega = b.esperar(m => m.tipo === 'trozos' && m.entran.includes('0,0'));
  b.estar(200, 10);   // trozo 1,0: entran los de la salida
  const t2 = await llega;
  comprobar('le entran los trozos de la salida, con el árbol talado y lo recogido', t2.tala.estado[arbol]?.vuelve > Date.now() && t2.recoleccion.estado['piedra:3']?.vuelve > Date.now());
  comprobar('y el suelo de sus trozos, con lo que dejó el árbol', t2.suelo.some(o => o.cosa.tipo === 'tronco_largo') && t2.suelo.some(o => o.cosa.tipo === 'rama'));
  comprobar('lo de los trozos que le entran y nada más', Object.keys(t2.tala.estado).every(id => t2.entran.includes(T.trozoDe(s.objetos.sitioArbol(id).x, s.objetos.sitioArbol(id).z))));

  console.log('Guardado por trozos');
  a.ws.close(); b.ws.close(); await pausa(100);
  // (se compara con lo que hay en el archivo: los inventarios de quien no ha hecho nada no se escriben hasta el siguiente cambio)
  await s.cerrar();
  const guardado = JSON.parse(readFileSync(join(dir, 'objetos.json'), 'utf8'));
  comprobar('objetos.json, versión 3, con lo talado y lo recogido por trozo',
    guardado.version === 3 && guardado.tala.trozos['0,0']?.estado[arbol] && guardado.recoleccion.trozos['0,0']?.estado['piedra:3'], Object.keys(guardado.tala.trozos || {}).join(' '));
  const s2 = crearServidor({ arconPruebas: true, puerto: 0, archivo, limiteMovimiento: false }); await s2.listo;
  { const x = JSON.stringify(s2.objetos.exportar()), y = JSON.stringify(guardado); let i = 0; while (i < x.length && x[i] === y[i]) i++;
    comprobar('al volver a arrancar se lee igual', x === y, x === y ? '' : 'distinto desde: ' + x.slice(i - 80, i + 80) + ' ‖ ' + y.slice(i - 80, i + 80)); }
  await s2.cerrar();
  // el formato anterior (2): todo junto, sin trozos
  const v2 = { version: 2, inventarios: guardado.inventarios, suelo: guardado.suelo, troceo: guardado.troceo,
    arboles: T.desagrupar(guardado.tala.trozos).cosas, tala: { version: guardado.tala.version, estado: T.desagrupar(guardado.tala.trozos).estado },
    puntos: T.desagrupar(guardado.recoleccion.trozos).cosas, recoleccion: { version: guardado.recoleccion.version, estado: T.desagrupar(guardado.recoleccion.trozos).estado } };
  const o2 = new ObjetosServidor({ posicion: () => null, enTierras: () => false }).importar(v2);
  comprobar('lo guardado con el formato anterior (2) se lee igual', JSON.stringify(o2.exportar()) === JSON.stringify(guardado));
} catch (e) {
  mal++; console.log('  FALLA', e.stack || e);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
