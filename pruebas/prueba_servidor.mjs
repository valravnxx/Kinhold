// Prueba del servidor mínimo (servidor/servidor.mjs) con dos clientes de verdad por websocket.
// Ejecutar: node pruebas/prueba_servidor.mjs
// Comprueba: el autor lo pone el servidor (no el cliente), las acciones pasan por la lógica pura,
// lo que sale bien se reparte a los dos, todo se guarda en el archivo y al volver a arrancar el mundo
// se rehace igual. Con MUTAR=1 se prueba un servidor que se fía del autor que manda el cliente: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { reproducir } from '../src/logica/acciones.js';
import { PROTOCOLO, protocoloDe, servidorAntiguo } from '../src/logica/protocolo.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const foto = (m) => JSON.stringify(m.exportar());

// Con MUTAR=1, una copia del servidor que deja pasar el autor del cliente.
let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('{ ...msg.accion, autor }', '{ autor, ...msg.accion }');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

// Cliente de prueba: guarda todo lo que recibe y deja esperar a un mensaje concreto.
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 2000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond);
      if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'kinhold-servidor-'));
const archivo = join(dir, 'mundo.jsonl');
try {
  console.log('Dos clientes en el mismo mundo');
  let s = crearServidor({ puerto: 0, archivo });
  let puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);
  comprobar('cada conexión recibe un autor del servidor, distinto', /^jugador:/.test(A.bienvenida.autor) && A.bienvenida.autor !== B.bienvenida.autor,
    `${A.bienvenida.autor} y ${B.bienvenida.autor}`);
  comprobar('un mundo nuevo empieza vacío', A.bienvenida.entradas.length === 0);
  // versión del protocolo: el servidor la dice y el juego sabe si es antiguo (valravnx, 28 oct: un servidor de antes
  // del duelo en línea dejaba a los dos «esperando rival» sin avisar)
  comprobar('la bienvenida dice la versión del protocolo del servidor', A.bienvenida.protocolo === PROTOCOLO && !servidorAntiguo(A.bienvenida), `protocolo ${A.bienvenida.protocolo}`);
  comprobar('un servidor de antes del combate (sin versión ni reloj del combate) es antiguo', servidorAntiguo({ tipo: 'bienvenida', autor: 'x', entradas: [] }) && protocoloDe({ tipo: 'bienvenida' }) === 0);
  comprobar('uno con combate pero sin versión cuenta como la 1; uno con una versión menor es antiguo',
    protocoloDe({ tipo: 'bienvenida', tc: 0 }) === 1 && !servidorAntiguo({ tipo: 'bienvenida', tc: 0 }) && servidorAntiguo({ tipo: 'bienvenida', protocolo: PROTOCOLO - 1, tc: 0 }));

  // A coloca el mojón diciendo que es otro: el servidor lo pisa
  const r1 = await A.accion({ tipo: 'mojon', x: 0, z: 0, autor: 'jugador:falso' });
  comprobar('el mojón sale bien', r1.ok, r1.motivo || '');
  const vistaB = await B.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'mojon');
  const vistaA = await A.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'mojon');
  comprobar('los dos clientes reciben la acción', !!vistaA && !!vistaB);
  comprobar('el autor es el que puso el servidor, no el que dijo el cliente', vistaB.entrada.autor === A.bienvenida.autor, `autor: ${vistaB.entrada.autor}`);

  // B construye sobre la obra de A; A lo ve
  const r2 = await B.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  const r3 = await A.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 2, z: 0, k: 0, rot: 0, dir: 0 });
  comprobar('los dos construyen en el mismo mundo', r2.ok && r3.ok, [r2, r3].map(r => r.ok ? 'ok' : r.motivo).join(', '));
  await A.esperar(m => m.tipo === 'accion' && m.entrada.autor === B.bienvenida.autor);
  await B.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'colocar' && m.entrada.autor === A.bienvenida.autor);

  // lo que la lógica rechaza no se reparte
  const repartidas = () => B.recibidos.filter(m => m.tipo === 'accion').length;   // (los luchadores van aparte, cada tic)
  const antes = repartidas();
  const r4 = await A.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 }); // ya ocupado
  const r5 = await A.accion({ tipo: 'volar', x: 1 });
  await pausa(100);
  comprobar('la lógica pura sigue mandando: lo ocupado y lo desconocido se rechazan', !r4.ok && !r5.ok, `${r4.motivo} · ${r5.motivo}`);
  comprobar('lo rechazado no se reparte a los demás', repartidas() === antes);

  // basura: el servidor responde con un error y sigue vivo
  A.ws.send('esto no es json');
  const e1 = await A.esperar(m => m.tipo === 'error');
  A.ws.send(JSON.stringify({ tipo: 'accion', accion: [1, 2] }));
  await pausa(50);
  const r6 = await B.accion({ tipo: 'decorar', pieza: 'mesa', x: 0.3, y: 0.2, z: 0.3, rot: 0.5 });
  comprobar('un mensaje roto recibe un error y el servidor sigue', !!e1 && r6.ok, r6.ok ? '' : r6.motivo);
  await A.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'decorar');

  // los clientes rehacen el mismo mundo que el servidor con lo que reciben
  const deA = reproducir(A.recibidos.filter(m => m.tipo === 'accion').map(m => m.entrada));
  comprobar('lo recibido por un cliente rehace el mismo mundo que el del servidor', foto(deA) === foto(s.mundo),
    `${s.mundo.construcciones[0].piezas.size} piezas, ${s.mundo.decoracion.length} mueble`);

  // todo queda en el archivo, también lo rechazado (para auditar)
  const lineas = readFileSync(archivo, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('el archivo guarda todas las acciones con su autor y numeradas', lineas.length === 6 && lineas.every((e, i) => e.n === i + 1 && /^jugador:/.test(e.autor)),
    `${lineas.length} líneas, ${lineas.filter(e => e.ok).length} correctas`);

  const mundoAntes = foto(s.mundo);
  A.ws.close(); B.ws.close();
  await s.cerrar();

  console.log('El servidor se apaga y vuelve a arrancar');
  appendFileSync(archivo, '{"n":7,"autor":"jugador:x","tip');   // apagado a mitad de escribir
  s = crearServidor({ puerto: 0, archivo });
  puerto = await s.listo;
  comprobar('al arrancar, el mundo se rehace igual desde el archivo', foto(s.mundo) === mundoAntes);
  const C = await cliente(puerto);
  comprobar('un cliente nuevo recibe lo hecho hasta ahora', C.bienvenida.entradas.length === 4 && foto(reproducir(C.bienvenida.entradas)) === mundoAntes,
    `${C.bienvenida.entradas.length} acciones`);
  const r7 = await C.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 4, z: 0, k: 0, rot: 0, dir: 0 });
  comprobar('y puede seguir construyendo', r7.ok, r7.motivo || '');
  const ultima = JSON.parse(readFileSync(archivo, 'utf8').trim().split('\n').pop());
  comprobar('la numeración sigue donde se quedó', ultima.n === 7 && ultima.autor === C.bienvenida.autor, `n=${ultima.n}`);
  C.ws.close();
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA la prueba se cortó:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
