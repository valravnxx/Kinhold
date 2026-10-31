// Prueba del panel de depuración del admin en el servidor (valravnx, 30 oct; src/logica/admin.js).
// Ejecutar: node pruebas/prueba_admin_servidor.mjs
// Comprueba, con clientes de verdad por websocket:
//   - sin clave de admin puesta en el servidor (o con una demasiado corta), el panel no responde a nadie;
//   - con la clave mal: no se ve nada, se apunta, y a la quinta seguida se cierra la conexión;
//   - con la buena: «ver» da los conectados con su posición (también el que pregunta), y nada de los que se han ido;
//   - «ir» a un punto de la isla responde ese punto; fuera de la isla o con datos raros, no;
//   - «ir» junto a otro: a su lado (a 1,6 m) y mirándole; junto a uno que no está o junto a sí mismo, no;
//   - cada petición queda en admin.jsonl con su autor y sin la clave; la lógica pura comprueba las peticiones.
// Con MUTAR=1 se prueba un servidor que no mira la clave: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { validarPeticionAdmin, sitioJunto, JUNTO, claveUsable } from '../src/logica/admin.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('if (!esAdmin(msg.clave)) {', 'if (false) {');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_admin.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, admin: [], cerradoCon: null };
    c.cerrado = new Promise(r => ws.on('close', (codigo) => { c.cerradoCon = codigo; r(codigo); }));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estado = (x, z, giro = 0, y = 2) => c.mandar({ tipo: 'estado', x, y, z, giro, anim: 'quieto' });
    let id = 0;
    // una petición del panel y su respuesta (o null si no llega en 1 s)
    c.admin1 = async (m) => {
      const n = ++id; c.mandar({ tipo: 'admin', id: n, ...m });
      for (let k = 0; k < 50; k++) { const r = c.admin.find(a => a.id === n); if (r) return r; await pausa(20); }
      return null;
    };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.yo = m.autor; listo(c); } if (m.tipo === 'admin') c.admin.push(m); });
    ws.on('error', fallo);
  });
}

const CLAVE = 'clave-de-prueba-0123456789';
const dir = mkdtempSync(join(tmpdir(), 'kinhold-admin-'));
try {
  console.log('Lógica pura');
  comprobar('«ver» vale', JSON.stringify(validarPeticionAdmin({ que: 'ver' })) === '{"que":"ver"}');
  comprobar('«ir» a un punto de la isla vale', !!validarPeticionAdmin({ que: 'ir', x: 120, z: -300 }));
  comprobar('«ir» fuera de la isla no vale', validarPeticionAdmin({ que: 'ir', x: 900000, z: 0 }) === null);
  comprobar('«ir» con números raros no vale', [NaN, Infinity, '3', null].every(v => validarPeticionAdmin({ que: 'ir', x: v, z: 0 }) === null));
  comprobar('«ir» junto a un autor con forma rara no vale', validarPeticionAdmin({ que: 'ir', junto: 'x'.repeat(80) }) === null && validarPeticionAdmin({ que: 'ir', junto: 3 }) === null);
  comprobar('otra cosa no vale', validarPeticionAdmin({ que: 'borrar' }) === null && validarPeticionAdmin(null) === null && validarPeticionAdmin([]) === null);
  const j = sitioJunto({ x: 10, y: 3, z: 20, giro: 0.7 });
  comprobar('junto a otro: a 1,6 m, a su altura y mirándole', Math.abs(Math.hypot(j.x - 10, j.z - 20) - JUNTO) < 1e-9 && j.y === 3
    && Math.abs(Math.sin(j.giro) * JUNTO - (10 - j.x)) < 1e-9 && Math.abs(Math.cos(j.giro) * JUNTO - (20 - j.z)) < 1e-9, JSON.stringify(j));
  comprobar('una clave corta no se acepta como clave del servidor', !claveUsable('corta') && claveUsable(CLAVE));

  console.log('Sin clave en el servidor');
  for (const [nombre, claveAdmin] of [['sin clave', undefined], ['clave demasiado corta', 'corta']]) {
    const s = crearServidor({ puerto: 0, archivo: join(dir, nombre.replace(/ /g, '_'), 'mundo.jsonl'), claveAdmin });
    const p = await s.listo;
    const a = await cliente(p);
    const r = await a.admin1({ clave: claveAdmin || 'loquesea-loquesea', que: 'ver' });
    comprobar(`${nombre}: no hay panel`, r && r.ok === false && !r.jugadores, JSON.stringify(r));
    a.ws.close(); await a.cerrado; await s.cerrar();
  }

  console.log('Con clave');
  const archivo = join(dir, 'mundo.jsonl');
  const s = crearServidor({ puerto: 0, archivo, claveAdmin: CLAVE });
  const puerto = await s.listo;
  const admin = await cliente(puerto), otro = await cliente(puerto), tercero = await cliente(puerto);
  admin.estado(1, 2, 0); otro.estado(40, -30, 1.1, 5.5); tercero.estado(-12, 8); await pausa(150);

  // la clave mal
  let r = await otro.admin1({ clave: 'no-es-la-clave-buena', que: 'ver' });
  comprobar('clave mal: no se ve nada', r && r.ok === false && !r.jugadores && r.motivo === 'Clave de admin incorrecta.', JSON.stringify(r));
  r = await otro.admin1({ que: 'ver' });
  comprobar('sin clave en la petición: no se ve nada', r && r.ok === false && !r.jugadores, JSON.stringify(r));
  r = await otro.admin1({ clave: 'no-es-la-clave-buena', que: 'ir', x: 5, z: 5 });
  comprobar('clave mal: no se va a ningún sitio', r && r.ok === false && r.x === undefined, JSON.stringify(r));

  // la buena
  r = await admin.admin1({ clave: CLAVE, que: 'ver' });
  const lista = r && r.jugadores || [];
  const de = (a) => lista.find(e => e.autor === a);
  comprobar('clave buena: «ver» da los tres conectados', r && r.ok && lista.length === 3 && r.yo === admin.yo, JSON.stringify(r && { n: lista.length, yo: r.yo }));
  comprobar('con su posición', de(otro.yo) && de(otro.yo).x === 40 && de(otro.yo).z === -30 && de(otro.yo).y === 5.5 && de(tercero.yo).x === -12, JSON.stringify(de(otro.yo)));
  tercero.ws.close(); await tercero.cerrado; await pausa(100);
  r = await admin.admin1({ clave: CLAVE, que: 'ver' });
  comprobar('el que se ha ido ya no sale', r && r.ok && r.jugadores.length === 2 && !r.jugadores.some(e => e.autor === tercero.yo));

  r = await admin.admin1({ clave: CLAVE, que: 'ir', x: 250.5, z: -1200 });
  comprobar('«ir» a un punto: el servidor responde ese punto (la altura la pone el navegador)', r && r.ok && r.x === 250.5 && r.z === -1200 && r.y === null, JSON.stringify(r));
  r = await admin.admin1({ clave: CLAVE, que: 'ir', x: 1e6, z: 0 });
  comprobar('«ir» fuera de la isla: no', r && r.ok === false, JSON.stringify(r));
  r = await admin.admin1({ clave: CLAVE, que: 'ir', junto: otro.yo });
  comprobar('«ir» junto a otro: a su lado y a su altura', r && r.ok && Math.abs(Math.hypot(r.x - 40, r.z + 30) - JUNTO) < 1e-6 && r.y === 5.5 && Number.isFinite(r.giro), JSON.stringify(r));
  r = await admin.admin1({ clave: CLAVE, que: 'ir', junto: tercero.yo });
  comprobar('«ir» junto a uno que no está: no', r && r.ok === false, JSON.stringify(r));
  r = await admin.admin1({ clave: CLAVE, que: 'ir', junto: admin.yo });
  comprobar('«ir» junto a sí mismo: no', r && r.ok === false, JSON.stringify(r));

  // el registro
  const reg = readFileSync(s.archivoAdmin, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('cada petición queda en admin.jsonl con su autor', reg.length >= 8 && reg.some(e => e.autor === otro.yo && !e.ok) && reg.some(e => e.autor === admin.yo && e.ok && e.que === 'ir'), `${reg.length} líneas`);
  comprobar('la clave no se apunta nunca', !readFileSync(s.archivoAdmin, 'utf8').includes(CLAVE) && !readFileSync(s.archivoAdmin, 'utf8').includes('no-es-la-clave-buena'));

  // a la quinta clave mal seguida, fuera
  for (let k = 0; k < 4; k++) await otro.admin1({ clave: 'otra-clave-que-no-vale-' + k, que: 'ver' });
  const codigo = await Promise.race([otro.cerrado, pausa(1500).then(() => null)]);
  comprobar('a la quinta clave mal seguida se cierra la conexión', codigo === 1008, String(codigo));
  comprobar('el admin sigue conectado', admin.ws.readyState === WebSocket.OPEN);

  admin.ws.close(); await admin.cerrado;
  await s.cerrar();
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia && existsSync(copia)) rmSync(copia);
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
