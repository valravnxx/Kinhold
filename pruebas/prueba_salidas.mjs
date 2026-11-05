// Prueba de las salidas en línea (valravnx, 5 nov: «se han marcado las zonas de inicio como zonas del rey, así que pon
// dos más, una será en la ciudad y otra en la otra comarca de inicio», «motdale», «lo eligen»), contra el servidor con
// el terreno de Whitholm.
// Ejecutar: node pruebas/prueba_salidas.mjs
// Comprueba:
//   - las tres salidas (SALIDAS_INICIO): Lindholt (la común), junto a la ciudad del rey y en Motdale; cada una vale
//     como sitio de salida, está en su comarca y en una zona del rey (no se reclama); la de la ciudad, en la de la ciudad;
//   - con clientes de verdad por websocket: un personaje nuevo llega sin posición y elige; aparece en el suelo de la
//     que elige; no puede volver a elegir; una que no existe no vale; el servidor lo recuerda al volver con su ficha y
//     tras reiniciarse; quien ya tiene posición no elige; con salidaComun (solo pruebas de navegador), la común sin elegir.
// Con MUTAR=1 el servidor deja volver a elegir: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { crearComarcas } from '../src/logica/comarcas.js';
import { SALIDA, SALIDAS_INICIO, salidaInicio, esSalida, alturaMundo, CIUDAD_REY } from '../src/logica/whitholm.js';

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
  const mutada = fuente.replace("if (posiciones.has(autor)) return { ok: false, motivo: 'Ya has empezado.' };", '');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_salidas.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

console.log('Las tres salidas');
const T = terrenoWhitholm(), O = T.origen;
{
  const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), pai = crearPaisaje(mapa), alt = alturaMundo(pai), com = crearComarcas(mapa);
  comprobar('son tres, con nombres distintos: Lindholt, la ciudad y Motdale', SALIDAS_INICIO.map(s => s.id).join() === 'lindholt,ciudad,motdale');
  comprobar('la de Lindholt es la salida común', salidaInicio('lindholt').x === SALIDA.x && salidaInicio('lindholt').z === SALIDA.z);
  const comarca = SALIDAS_INICIO.map(s => com.nombreEn(s.x, s.z));
  comprobar('cada una en su comarca (Lindholt, Strandvang, Motdale)', comarca.join() === 'Lindholt,Strandvang,Motdale', comarca.join());
  comprobar('cada una vale como sitio de salida (tierra firme, llano, lejos de los ríos)', SALIDAS_INICIO.every(s => esSalida(mapa, pai, alt, s.x, s.z)));
  comprobar('y está en una zona del rey: no se reclama', SALIDAS_INICIO.every(s => T.esZonaRey(T.zona(s.x - O.x, s.z - O.z))));
  const c = salidaInicio('ciudad'), dc = Math.hypot(c.x - CIUDAD_REY.x, c.z - CIUDAD_REY.z);
  comprobar('la de la ciudad, junto a ella (fuera de su sitio, a menos de 150 m) y en su zona', dc > 60 && dc < 150 && T.zona(c.x - O.x, c.z - O.z) === T.zona(CIUDAD_REY.x - O.x, CIUDAD_REY.z - O.z), `${Math.round(dc)} m`);
}

function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
    const c = { ws, n: 0, esperas: [] };
    c.cerrado = new Promise(r => ws.on('close', r));
    c.salida = (salida) => new Promise((r, f) => {
      const id = ++c.n, t = setTimeout(() => f(new Error('sin respuesta a la salida')), 5000);
      c.esperas.push({ id, r: (m) => { clearTimeout(t); r(m); } });
      ws.send(JSON.stringify({ tipo: 'salida', id, salida }));
    });
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') { c.bienvenida = m; listo(c); }
      if (m.tipo === 'salida') c.esperas = c.esperas.filter(e => { if (e.id === m.id) { e.r(m); return false; } return true; });
    });
    ws.on('error', fallo);
  });
}
const salir = async (c) => { c.ws.close(); await c.cerrado; await new Promise(r => setTimeout(r, 100)); };
const enEscena = (s) => ({ x: s.x - O.x, z: s.z - O.z });

const dir = mkdtempSync(join(tmpdir(), 'kinhold-salidas-'));
const archivo = join(dir, 'mundo.jsonl');
let s = null;
try {
  s = crearServidor({ puerto: 0, archivo, terreno: T });
  let puerto = await s.listo;

  console.log('Un personaje nuevo elige');
  const a = await cliente(puerto);
  comprobar('llega sin posición (aún no ha elegido)', a.bienvenida.posicion === null, JSON.stringify(a.bienvenida.posicion));
  let r = await a.salida('isla_secreta');
  comprobar('una salida que no existe no vale', !r.ok && !r.posicion, r.motivo);
  r = await a.salida('motdale');
  const m = enEscena(salidaInicio('motdale'));
  comprobar('elige Motdale y aparece allí', r.ok && r.posicion.x === m.x && r.posicion.z === m.z, JSON.stringify(r.posicion));
  comprobar('en el suelo, donde el servidor lo deja estar', r.ok && Math.abs(r.posicion.y - T.suelo(m.x, m.z)) < 1e-6 && T.posicion(r.posicion) === null);
  const pa = r.posicion;
  r = await a.salida('ciudad');
  comprobar('no puede volver a elegir', !r.ok, r.motivo);
  const fa = a.bienvenida.ficha;
  await salir(a);

  console.log('Lo recuerda');
  const a2 = await cliente(puerto, fa);
  comprobar('al volver con su ficha sale donde eligió', a2.bienvenida.autor === a.bienvenida.autor && JSON.stringify(a2.bienvenida.posicion) === JSON.stringify(pa), JSON.stringify(a2.bienvenida.posicion));
  await salir(a2);

  const b = await cliente(puerto);
  r = await b.salida('ciudad');
  const c0 = enEscena(salidaInicio('ciudad'));
  comprobar('otro nuevo elige la ciudad y aparece junto a ella', r.ok && r.posicion.x === c0.x && r.posicion.z === c0.z, JSON.stringify(r.posicion));
  const fb = b.bienvenida.ficha, pb = r.posicion;
  await salir(b);

  console.log('Tras reiniciar el servidor');
  await s.cerrar();
  s = crearServidor({ puerto: 0, archivo, terreno: T });
  puerto = await s.listo;
  const b2 = await cliente(puerto, fb);
  comprobar('sigue sabiendo dónde empezó cada uno (posiciones.json)', JSON.stringify(b2.bienvenida.posicion) === JSON.stringify(pb), JSON.stringify(b2.bienvenida.posicion));
  r = await b2.salida('lindholt');
  comprobar('y tampoco deja elegir otra vez', !r.ok, r.motivo);
  await salir(b2);
  await s.cerrar();

  console.log('Con salidaComun (solo las pruebas de navegador)');
  s = crearServidor({ puerto: 0, archivo: join(dir, 'otro.jsonl'), terreno: T, salidaComun: true });
  puerto = await s.listo;
  const c = await cliente(puerto);
  comprobar('un nuevo empieza en la común sin elegir', !!c.bienvenida.posicion && c.bienvenida.posicion.x === 0 && c.bienvenida.posicion.z === 0, JSON.stringify(c.bienvenida.posicion));
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
