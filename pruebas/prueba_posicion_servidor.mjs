// Prueba de «volver donde lo dejaste» (valravnx, 31 oct): el servidor apunta dónde estaba cada jugador al salir y se
// lo manda en la bienvenida cuando vuelve con su ficha, también tras reiniciar el servidor.
// Ejecutar: node pruebas/prueba_posicion_servidor.mjs
// Comprueba, con clientes de verdad por websocket:
//   - un jugador nuevo no trae posición; al volver con su ficha, la bienvenida trae la última que mandó;
//   - otro jugador (sin ficha) no recibe la de nadie;
//   - tras reiniciar el servidor sigue sabiéndola (posiciones.json), y un archivo roto no tumba el servidor;
//   - en el «Duelo» (la liza, una escena aparte) no se apunta: vuelve al sitio del mundo de antes;
//   - con el servidor encendido, el latido la guarda aunque el jugador no haya salido (por si se apaga de golpe).
// Con MUTAR=1 se prueba un servidor que no manda la posición en la bienvenida: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
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
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('posicion: posiciones.get(autor) || null', 'posicion: null');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_posicion.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
    const c = { ws };
    c.cerrado = new Promise(r => ws.on('close', r));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estado = (x, z, giro = 0.5, y = 1.25) => c.mandar({ tipo: 'estado', x, y, z, giro, anim: 'andar' });
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.bienvenida = m; listo(c); } });
    ws.on('error', fallo);
  });
}
const cerca = (p, x, z) => !!p && Math.abs(p.x - x) < 1e-9 && Math.abs(p.z - z) < 1e-9;

const dir = mkdtempSync(join(tmpdir(), 'kinhold-posicion-'));
const archivo = join(dir, 'mundo.jsonl');
try {
  let s = crearServidor({ puerto: 0, archivo, latido: 200 });
  let puerto = await s.listo;

  console.log('Volver con la ficha');
  const a = await cliente(puerto);
  comprobar('un jugador nuevo no trae posición', a.bienvenida.posicion === null, JSON.stringify(a.bienvenida.posicion));
  const ficha = a.bienvenida.ficha;
  a.estado(10, -20); await pausa(50); a.estado(12.5, -21.25, 1.2); await pausa(100);
  a.ws.close(); await a.cerrado; await pausa(100);
  const a2 = await cliente(puerto, ficha);
  const p = a2.bienvenida.posicion;
  comprobar('al volver con su ficha, la bienvenida trae dónde estaba al salir', cerca(p, 12.5, -21.25) && Math.abs(p.giro - 1.2) < 1e-9 && p.y === 1.25, JSON.stringify(p));
  const b = await cliente(puerto);
  comprobar('otro jugador (sin ficha) no recibe la de nadie', b.bienvenida.posicion === null);
  b.ws.close(); await b.cerrado;

  console.log('El latido la guarda sin salir');
  a2.estado(30, 5); await pausa(600);
  const guardadas = existsSync(s.archivoPosiciones) ? JSON.parse(readFileSync(s.archivoPosiciones, 'utf8')) : {};
  comprobar('en posiciones.json, la de ahora de quien sigue conectado', cerca(guardadas[a.bienvenida.autor], 30, 5), JSON.stringify(guardadas[a.bienvenida.autor]));

  console.log('En el duelo no se apunta');
  a2.mandar({ tipo: 'combate', que: 'liza' }); await pausa(100);
  a2.estado(1.75, 0); await pausa(100);
  a2.ws.close(); await a2.cerrado; await pausa(100);
  const a3 = await cliente(puerto, ficha);
  comprobar('vuelve al sitio del mundo, no al de la liza', cerca(a3.bienvenida.posicion, 30, 5), JSON.stringify(a3.bienvenida.posicion));
  a3.mandar({ tipo: 'combate', que: 'mundo' }); await pausa(50);
  a3.estado(-40, 15); await pausa(100);
  a3.ws.close(); await a3.cerrado; await pausa(100);

  console.log('Tras reiniciar el servidor');
  await s.cerrar();
  s = crearServidor({ puerto: 0, archivo, latido: 200 });
  puerto = await s.listo;
  const a4 = await cliente(puerto, ficha);
  comprobar('sigue sabiendo dónde estaba', cerca(a4.bienvenida.posicion, -40, 15), JSON.stringify(a4.bienvenida.posicion));
  a4.ws.close(); await a4.cerrado;
  await s.cerrar();

  console.log('Archivo roto');
  writeFileSync(join(dir, 'posiciones.json'), '{ esto no es json');
  s = crearServidor({ puerto: 0, archivo, latido: 200, registrar: () => {} });
  puerto = await s.listo;
  const a5 = await cliente(puerto, ficha);
  comprobar('con posiciones.json roto, el servidor arranca y no da posición', a5.bienvenida.posicion === null && a5.bienvenida.autor === a.bienvenida.autor);
  a5.ws.close(); await a5.cerrado;
  await s.cerrar();
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
