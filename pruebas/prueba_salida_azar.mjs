// Prueba de la salida al azar de verdad en línea (valravnx, 30 oct y 5 nov: «apareces en un punto aleatorio LIBRE, si
// una zona tiene mojón activo, deja de ser spawn»), contra el servidor con el terreno de Whitholm.
// Ejecutar: node pruebas/prueba_salida_azar.mjs
// Comprueba, con clientes de verdad por websocket:
//   - elegirSalidaLibre da siempre un sitio de SALIDAS con la zona libre, reparte por todos y, sin ninguno libre, la común;
//   - un personaje nuevo aparece en un sitio de la salida al azar (no en la común), en el suelo, y su zona no es del rey;
//   - lo recuerda: al volver con su ficha (también tras reiniciar el servidor) sale en el mismo sitio;
//   - con un mojón puesto en la zona de un sitio, ese sitio deja de ser salida para los nuevos;
//   - sin salidaAlAzar (las pruebas que no la usan) un nuevo no trae posición (la salida común).
// Con MUTAR=1 el servidor no mira los mojones al elegir: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { SALIDA, SALIDAS, elegirSalidaLibre } from '../src/logica/whitholm.js';

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
  const mutada = fuente.replace('(x, z) => !mundo.duenoDeZona(terreno.zona(x - O.x, z - O.z))', '() => true');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_salida.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

console.log('La elección (lógica pura)');
{
  const vistos = new Set(); let fuera = 0;
  const libre = (x, z) => !(x === SALIDAS[0][0] && z === SALIDAS[0][1]);   // el primero, tomado
  for (let i = 0; i <= 1000; i++) {
    const s = elegirSalidaLibre(libre, i / 1000);
    if (s.comun || !SALIDAS.some(p => p[0] === s.x && p[1] === s.z) || !libre(s.x, s.z)) fuera++;
    vistos.add(s.x + ',' + s.z);
  }
  comprobar('da siempre un sitio libre de la lista (también con 0 y con 1)', fuera === 0, `${fuera} mal`);
  comprobar('reparte por todos los libres', vistos.size === SALIDAS.length - 1, `${vistos.size} de ${SALIDAS.length - 1}`);
  const n = elegirSalidaLibre(() => false, 0.3);
  comprobar('sin ninguno libre, la salida común', n.comun && n.x === SALIDA.x && n.z === SALIDA.z, JSON.stringify(n));
}

const T = terrenoWhitholm(), O = T.origen;
function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
    const c = { ws };
    c.cerrado = new Promise(r => ws.on('close', r));
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.bienvenida = m; listo(c); } });
    ws.on('error', fallo);
  });
}
const enMundo = (p) => p && { x: p.x + O.x, z: p.z + O.z };
const deLista = (p) => !!p && SALIDAS.some(s => s[0] === p.x && s[1] === p.z);
const salir = async (c) => { c.ws.close(); await c.cerrado; await new Promise(r => setTimeout(r, 100)); };

const dir = mkdtempSync(join(tmpdir(), 'kinhold-salida-'));
const archivo = join(dir, 'mundo.jsonl');
let s = null;
try {
  // azar fijo: el primero de los libres
  s = crearServidor({ puerto: 0, archivo, terreno: T, salidaAlAzar: true, azarSalida: () => 0 });
  let puerto = await s.listo;

  console.log('Un personaje nuevo');
  const a = await cliente(puerto), pa = a.bienvenida.posicion, ma = enMundo(pa);
  comprobar('trae posición en la bienvenida', !!pa && [pa.x, pa.y, pa.z, pa.giro].every(Number.isFinite), JSON.stringify(pa));
  comprobar('es un sitio de la salida al azar, no la común', deLista(ma) && !(ma.x === SALIDA.x && ma.z === SALIDA.z), JSON.stringify(ma));
  comprobar('el primero de la lista (azar 0, todos libres)', !!ma && ma.x === SALIDAS[0][0] && ma.z === SALIDAS[0][1], JSON.stringify(ma));
  comprobar('está en el suelo', !!pa && Math.abs(pa.y - T.suelo(pa.x, pa.z)) < 1e-6, pa && `${pa.y} y el suelo ${T.suelo(pa.x, pa.z)}`);
  comprobar('y el servidor lo deja estar ahí', !!pa && T.posicion(pa) === null, pa && T.posicion(pa));
  const fa = a.bienvenida.ficha;
  await salir(a);

  console.log('Lo recuerda');
  const a2 = await cliente(puerto, fa);
  comprobar('al volver con su ficha sale en el mismo sitio', a2.bienvenida.autor === a.bienvenida.autor && JSON.stringify(a2.bienvenida.posicion) === JSON.stringify(pa), JSON.stringify(a2.bienvenida.posicion));
  await salir(a2);

  console.log('Un mojón en la zona de un sitio: deja de ser salida');
  const zona0 = T.zona(SALIDAS[0][0] - O.x, SALIDAS[0][1] - O.z);
  // (puesto a mano en el mundo: cómo se paga y se pone el mojón lo prueban el recorrido y las de construcción)
  s.mundo.mojones['otro-jugador'] = { x: SALIDAS[0][0] - O.x, z: SALIDAS[0][1] - O.z, zona: zona0 };
  const b = await cliente(puerto), mb = enMundo(b.bienvenida.posicion);
  comprobar('el siguiente nuevo sale en otro sitio de la lista', deLista(mb) && !(mb.x === SALIDAS[0][0] && mb.z === SALIDAS[0][1]), JSON.stringify(mb));
  comprobar('y su zona no tiene mojón', !!mb && !s.mundo.duenoDeZona(T.zona(mb.x - O.x, mb.z - O.z)), JSON.stringify(mb));
  const fb = b.bienvenida.ficha;
  await salir(b);
  delete s.mundo.mojones['otro-jugador'];

  console.log('Tras reiniciar el servidor');
  await s.cerrar();
  s = crearServidor({ puerto: 0, archivo, terreno: T, salidaAlAzar: true, azarSalida: () => 0.5 });
  puerto = await s.listo;
  const b2 = await cliente(puerto, fb);
  comprobar('sigue sabiendo dónde sale cada uno (posiciones.json)', JSON.stringify(b2.bienvenida.posicion) === JSON.stringify(b.bienvenida.posicion), JSON.stringify(b2.bienvenida.posicion));
  await salir(b2);
  await s.cerrar();

  console.log('Sin la salida al azar (las pruebas que no la usan)');
  s = crearServidor({ puerto: 0, archivo: join(dir, 'otro.jsonl'), terreno: T });
  puerto = await s.listo;
  const c = await cliente(puerto);
  comprobar('un nuevo no trae posición: la salida común', c.bienvenida.posicion === null, JSON.stringify(c.bienvenida.posicion));
  await salir(c);
} catch (e) {
  comprobar('la prueba llega al final', false, e && e.stack);
} finally {
  if (s) await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
