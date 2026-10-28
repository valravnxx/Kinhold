// Medición del servidor de la prueba online (hito 1f): cuánta CPU, memoria, tráfico y disco gasta con N
// jugadores simulados (los bots de servidor/bots.mjs, que andan, construyen y pelean).
//
// El servidor va en un proceso aparte (el mismo crearServidor que se usa de verdad, en un puerto libre y con el
// mundo en una carpeta temporal), para que su CPU y su memoria se midan solas, sin los bots. Ese proceso manda
// cada segundo una muestra por IPC:
//   - cpu: % de un núcleo (tiempo de usuario + sistema del proceso entre una muestra y la siguiente);
//   - rss y heap: memoria del proceso (MB);
//   - bucle: retraso del bucle de eventos (ms, p50, p99 y máximo del segundo): si crece, el servidor no da abasto
//     y los tics de presencia (100 ms) y de combate (50 ms) se retrasan;
//   - bytes de red que salen y entran por los sockets (lo que manda y recibe WebSocket, con sus cabeceras de
//     trama; sin las de TCP/IP, que añaden unos 52 bytes por paquete);
//   - conectados, construcciones y lo que ocupan en disco los archivos del mundo.
// Los bots van en este proceso (con su propia cuenta de mensajes y latencias de las acciones).
//
// Al final se conecta un cliente nuevo para medir lo que pesa la bienvenida (crece con el mundo).
//
// Uso: node servidor/medir.mjs [bots] [segundos] [salida.json]
//      (por defecto 100 bots y 120 s; los primeros CALENTAR s después de entrar todos no cuentan en el resumen).
import { fork } from 'child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir, cpus, totalmem } from 'os';
import { fileURLToPath } from 'url';
import { monitorEventLoopDelay, performance } from 'perf_hooks';
import { WebSocket } from 'ws';

const ESTE = fileURLToPath(import.meta.url);
export const CALENTAR = 10;   // s que no cuentan en el resumen (se están colocando y poniendo el mojón)

// ---------- proceso del servidor ----------
async function procesoServidor(archivo) {
  const { crearServidor } = await import('./servidor.mjs');
  const s = crearServidor({ puerto: 0, archivo });
  const puerto = await s.listo;
  const sockets = new Set();
  let salidaCerrados = 0, entradaCerrados = 0;
  s.wss.on('connection', (ws, req) => {
    const so = req.socket; sockets.add(so);
    so.on('close', () => { salidaCerrados += so.bytesWritten; entradaCerrados += so.bytesRead; sockets.delete(so); });
  });
  const h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
  let cpuAntes = process.cpuUsage(), tAntes = performance.now();
  const tam = (f) => (existsSync(f) ? statSync(f).size : 0);
  setInterval(() => {
    const cpu = process.cpuUsage(cpuAntes), t = performance.now();
    const pc = (cpu.user + cpu.system) / 1000 / (t - tAntes) * 100;
    cpuAntes = process.cpuUsage(); tAntes = t;
    let salida = salidaCerrados, entrada = entradaCerrados;
    for (const so of sockets) { salida += so.bytesWritten; entrada += so.bytesRead; }
    const m = process.memoryUsage();
    process.send({ tipo: 'muestra', cpu: +pc.toFixed(1), rss: +(m.rss / 1048576).toFixed(1), heap: +(m.heapUsed / 1048576).toFixed(1),
      bucle: { p50: +(h.percentile(50) / 1e6).toFixed(1), p99: +(h.percentile(99) / 1e6).toFixed(1), max: +(h.max / 1e6).toFixed(1) },
      salida, entrada, conectados: s.clientes.size, construcciones: s.mundo.construcciones.length,
      disco: tam(s.archivo) + tam(s.archivoCombate) + tam(s.archivoFichas) });
    h.reset();
  }, 1000);
  process.send({ tipo: 'listo', puerto });
  process.on('message', async (m) => { if (m === 'cerrar') { await s.cerrar(); process.exit(0); } });
}

// ---------- resumen ----------
const media = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pct = (a, p) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const r1 = (x) => Math.round(x * 10) / 10;

export function resumir(muestras, bots, segundos) {
  const M = muestras.filter(m => m.t >= CALENTAR);
  if (M.length < 2) return null;
  const a = M[0], z = M[M.length - 1], dur = z.t - a.t;
  const salidaSeg = (z.salida - a.salida) / dur, entradaSeg = (z.entrada - a.entrada) / dur;
  const discoHora = (z.disco - a.disco) / dur * 3600;
  return {
    bots, segundosMedidos: r1(dur),
    cpuNucleoPct: { media: r1(media(M.map(m => m.cpu))), p95: r1(pct(M.map(m => m.cpu), 0.95)), max: r1(Math.max(...M.map(m => m.cpu))) },
    memoriaMB: { rssMax: r1(Math.max(...M.map(m => m.rss))), heapMax: r1(Math.max(...M.map(m => m.heap))) },
    bucleMs: { p99Medio: r1(media(M.map(m => m.bucle.p99))), p99Max: r1(Math.max(...M.map(m => m.bucle.p99))), max: r1(Math.max(...M.map(m => m.bucle.max))) },
    red: {
      salidaKBs: r1(salidaSeg / 1024), entradaKBs: r1(entradaSeg / 1024),
      salidaPorJugadorKBs: r1(salidaSeg / bots / 1024), entradaPorJugadorKBs: r1(entradaSeg / bots / 1024),
      salidaPorJugadorHoraMB: r1(salidaSeg / bots * 3600 / 1048576),
      salidaMbps: +(salidaSeg * 8 / 1e6).toFixed(2),
    },
    disco: { crecimientoMBHora: r1(discoHora / 1048576), alFinalMB: r1(z.disco / 1048576) },
    conectadosMin: Math.min(...M.map(m => m.conectados)),
    construccionesAlFinal: z.construcciones,
  };
}

// lo que pesa la bienvenida para alguien que entra ahora
function medirBienvenida(url) {
  return new Promise((r) => {
    const ws = new WebSocket(url);
    ws.on('message', (d) => { const t = d.length; ws.close(); r(t); });
    ws.on('error', () => r(null));
  });
}

export async function medir({ bots = 100, segundos = 120, avisar = () => {} } = {}) {
  const { Enjambre } = await import('./bots.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-medir-'));
  const hijo = fork(ESTE, ['--servidor', join(dir, 'mundo.jsonl')], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const muestras = [];
  let t0 = null;
  const puerto = await new Promise((r, f) => {
    hijo.on('message', (m) => {
      if (m.tipo === 'listo') r(m.puerto);
      else if (m.tipo === 'muestra' && t0 !== null) { m.t = r1((performance.now() - t0) / 1000); muestras.push(m); }
    });
    hijo.on('exit', (c) => f(new Error('El servidor se ha parado: ' + c)));
  });
  const url = `ws://127.0.0.1:${puerto}`;
  const E = new Enjambre({ url, cuantos: bots, escalonar: 20 });
  await E.arrancar();
  t0 = performance.now();
  avisar(`${bots} bots dentro; midiendo ${segundos} s`);
  await new Promise(r => setTimeout(r, (segundos + 0.5) * 1000));
  const bienvenidaBytes = await medirBienvenida(url);
  const deBots = E.medida();
  await E.parar();
  hijo.send('cerrar');
  await new Promise(r => hijo.on('exit', r));
  rmSync(dir, { recursive: true, force: true });
  return {
    fecha: new Date().toISOString(),
    maquina: { cpu: cpus()[0]?.model || '?', nucleos: cpus().length, memoriaGB: r1(totalmem() / 1073741824), node: process.version },
    bots, segundos, resumen: resumir(muestras, bots, segundos), bienvenidaBytes,
    deLosBots: { conectados: deBots.conectados, accionesOk: deBots.accionesOk, accionesMal: deBots.accionesMal, obrasTerminadas: deBots.obrasTerminadas,
      golpesDados: deBots.golpesDados, intenciones: deBots.intenciones, rechazos: deBots.rechazos, errores: deBots.errores,
      latenciaAccionMs: deBots.latenciaAccionMs, porBotYSegundo: deBots.porBotYSegundo, motivos: deBots.motivos },
    muestras,
  };
}

// ---------- línea de órdenes ----------
if (process.argv[1] && resolve(process.argv[1]) === ESTE) {
  if (process.argv[2] === '--servidor') await procesoServidor(process.argv[3]);
  else {
    const bots = Number(process.argv[2]) || 100, segundos = Number(process.argv[3]) || 120, salida = process.argv[4];
    const r = await medir({ bots, segundos, avisar: (t) => console.log(t) });
    console.log(JSON.stringify({ ...r, muestras: undefined }, null, 1));
    if (salida) writeFileSync(salida, JSON.stringify(r, null, 1) + '\n');
    process.exit(0);
  }
}
