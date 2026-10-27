// Prueba de los jugadores que se ven (src/logica/presencia.js y servidor/servidor.mjs) con lag simulado.
// Ejecutar: node pruebas/prueba_presencia.mjs
// Dos clientes de verdad por websocket, cada mensaje retrasado 60–140 ms en cada sentido (en orden, como TCP).
// A corre en círculo y manda su estado 10 veces por segundo; B lo dibuja en cada fotograma.
// Comprueba: el autor lo pone el servidor, el movimiento de A en B es suave y sigue el círculo, el giro pasa
// por el camino corto, la animación llega, lo roto se rechaza y al irse A desaparece.
// Con MUTAR=1 el cliente salta al último estado en vez de mezclar (sin interpolación): debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { performance } from 'perf_hooks';
import { fileURLToPath, pathToFileURL } from 'url';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// Con MUTAR=1, una copia de la presencia del cliente que no mezcla: salta al estado más nuevo.
let ruta = join(raiz, 'src/logica/presencia.js'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('const f = (t - a.t) / (b.t - a.t);', 'const f = 1;');
  if (mutada === fuente) { console.log('No se pudo mutar la presencia'); process.exit(1); }
  copia = join(raiz, 'src/logica/.presencia_mutada.js');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { PresenciaCliente, mezclarAngulo, normalizarAngulo, validarEstado, Interpolador } = await import(pathToFileURL(ruta).href);

const ahora = () => performance.now();
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const LAG = 60, VAIVEN = 80;   // ms: cada mensaje tarda entre 60 y 140 ms en cada sentido
const lag = () => LAG + Math.random() * VAIVEN;

// Cliente con lag simulado en los dos sentidos. Los mensajes no se adelantan unos a otros (como en TCP).
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], bytes: 0, salida: 0, llegada: 0 };
    const mandar = (msg) => { const t = Math.max(c.salida, ahora() + lag()); c.salida = t; setTimeout(() => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg)), t - ahora()); };
    c.presencia = new PresenciaCliente(mandar);
    c.mandar = mandar;
    ws.on('message', (d) => {
      const t = Math.max(c.llegada, ahora() + lag()); c.llegada = t;
      setTimeout(() => {
        const m = JSON.parse(d.toString());
        c.bytes += d.length; c.recibidos.push(m);
        c.presencia.recibir(m, ahora());
        if (m.tipo === 'bienvenida') { c.autor = m.autor; listo(c); }
      }, t - ahora());
    });
    ws.on('error', fallo);
  });
}

console.log('Ángulos y estados');
const a180 = mezclarAngulo(170 * Math.PI / 180, -170 * Math.PI / 180, 0.5);
comprobar('el giro de 170° a -170° pasa por 180° (camino corto)', Math.abs(Math.abs(a180) - Math.PI) < 1e-9, `${(a180 * 180 / Math.PI).toFixed(1)}°`);
comprobar('un estado roto no vale (NaN, lejísimos, animación rara)',
  !validarEstado({ x: NaN, y: 0, z: 0, giro: 0, anim: 'andar' }) && !validarEstado({ x: 1e9, y: 0, z: 0, giro: 0, anim: 'andar' }) &&
  !validarEstado({ x: 0, y: 0, z: 0, giro: 0, anim: '<script>' }) && !!validarEstado({ x: 1, y: 0, z: 2, giro: 7, anim: 'correr' }));
const it = new Interpolador();
it.meter({ t: 0, x: 0, y: 0, z: 0, giro: 0, anim: 'andar' }); it.meter({ t: 100, x: 1, y: 0, z: 0, giro: 0, anim: 'andar' });
it.meter({ t: 50, x: 9, y: 0, z: 0, giro: 0, anim: 'andar' });   // desordenado: se ignora
const m50 = it.muestra(50), m1000 = it.muestra(1000);
comprobar('a mitad de camino, a mitad de sitio; lo desordenado no cuenta', Math.abs(m50.x - 0.5) < 1e-9, `x=${m50.x}`);
comprobar('sin estados nuevos sigue un poco y se para', Math.abs(m1000.x - 3.5) < 1e-9, `x=${m1000.x} a los 900 ms`);

const dir = mkdtempSync(join(tmpdir(), 'kinhold-presencia-'));
try {
  console.log(`Dos clientes con lag de ${LAG}–${LAG + VAIVEN} ms en cada sentido`);
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  const puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);

  // A corre en círculo (radio 5 m, 3 m/s) y B está quieto; los dos «dibujan» cada 16 ms
  const R = 5, V = 3, w = V / R;
  const t0 = ahora(), verdad = [], vista = [];
  const posA = (t) => { const ang = w * (t - t0) / 1000; return { x: R * Math.cos(ang), y: 0, z: R * Math.sin(ang), giro: ang + Math.PI / 2, anim: 'correr' }; };
  const DURA = 5000;
  await new Promise(fin => {
    const fot = setInterval(() => {
      const t = ahora();
      const p = posA(t); verdad.push({ t, ...p });
      // A intenta firmar como otro: el servidor no le hace caso
      A.presencia.actualizar(t, { ...p, autor: 'jugador:falso' });
      B.presencia.actualizar(t, { x: 20, y: 0, z: 0, giro: 0, anim: 'quieto' });
      const v = B.presencia.ver(t);
      vista.push({ t, v });
      if (t - t0 > DURA) { clearInterval(fot); fin(); }
    }, 16);
  });

  const deA = vista.map(f => ({ t: f.t, p: f.v.find(j => j.autor === A.autor), n: f.v.length })).filter(f => f.t - t0 > 1000 && f.p);
  const otros = vista.flatMap(f => f.v).filter(j => j.autor !== A.autor);
  comprobar('B ve a A con el autor que puso el servidor, y no se ve a sí mismo', deA.length > 200 && otros.length === 0,
    `${deA.length} fotogramas con A; autores vistos: ${[...new Set(vista.flatMap(f => f.v.map(j => j.autor)))].join(', ')}`);
  const vistoPorA = A.presencia.ver(ahora());
  comprobar('A ve a B quieto donde está', vistoPorA.length === 1 && vistoPorA[0].autor === B.autor && Math.abs(vistoPorA[0].x - 20) < 1e-9 && vistoPorA[0].anim === 'quieto');

  // sigue el círculo
  const fuera = Math.max(...deA.map(f => Math.abs(Math.hypot(f.p.x, f.p.z) - R)));
  comprobar('A sigue el círculo en la pantalla de B (menos de 10 cm fuera)', fuera < 0.1, `${(fuera * 100).toFixed(1)} cm como mucho`);

  // suave: cada fotograma avanza más o menos lo que toca a 3 m/s
  const pasos = [];
  for (let i = 1; i < deA.length; i++) {
    const dt = (deA[i].t - deA[i - 1].t) / 1000;
    pasos.push(Math.hypot(deA[i].p.x - deA[i - 1].p.x, deA[i].p.z - deA[i - 1].p.z) / (V * dt));
  }
  const maxPaso = Math.max(...pasos), parados = pasos.filter(p => p < 0.2).length;
  comprobar('el movimiento es suave: ningún salto de más de 2,5 veces lo que toca y casi ningún fotograma parado',
    maxPaso < 2.5 && parados <= pasos.length * 0.02, `paso mayor ${maxPaso.toFixed(2)}×, ${parados} de ${pasos.length} parados`);

  // el giro también, y cruza ±180° sin dar la vuelta
  let maxGiro = 0;
  for (let i = 1; i < deA.length; i++) maxGiro = Math.max(maxGiro, Math.abs(normalizarAngulo(deA[i].p.giro - deA[i - 1].p.giro)));
  const cruza = deA.some((f, i) => i && Math.sign(f.p.giro) !== Math.sign(deA[i - 1].p.giro) && Math.abs(f.p.giro) > 3);
  comprobar('el giro cambia poco a poco, también al pasar por 180°', maxGiro < 0.15 && cruza, `giro mayor por fotograma ${maxGiro.toFixed(3)} rad`);
  comprobar('llega la animación', deA.every(f => f.p.anim === 'correr'));

  // cuánto va por detrás: el momento de la verdad que mejor encaja con lo que ve B
  const retrasos = deA.filter((f, i) => i % 10 === 0).map(f => {
    const ang = Math.atan2(f.p.z, f.p.x);
    let mejor = Infinity, tm = 0;
    for (const v of verdad) { if (v.t > f.t) break; const d = Math.abs(normalizarAngulo(ang - Math.atan2(v.z, v.x))); if (d < mejor) { mejor = d; tm = v.t; } }
    return f.t - tm;
  });
  const medio = retrasos.reduce((a, b) => a + b, 0) / retrasos.length;
  comprobar('B ve a A con menos de medio segundo de retraso', Math.max(...retrasos) < 500, `medio ${medio.toFixed(0)} ms, máximo ${Math.max(...retrasos).toFixed(0)} ms`);

  // tráfico
  const kbs = B.bytes / ((ahora() - t0) / 1000) / 1024;
  console.log(`  (tráfico que recibe B con un jugador a la vista: ${kbs.toFixed(2)} KB/s)`);

  // un estado roto no se reparte
  await pausa(400);
  const antes = B.recibidos.length;
  A.mandar({ tipo: 'estado', x: 'mucho', y: 0, z: 0, giro: 0, anim: 'correr' });
  await pausa(500);
  comprobar('un estado roto recibe un error y no se reparte', A.recibidos.some(m => m.tipo === 'error' && /Estado/.test(m.motivo)) &&
    B.recibidos.slice(antes).every(m => m.tipo !== 'estados'));

  // un tercero que llega ve a los que ya estaban
  const C = await cliente(puerto);
  await pausa(50);
  const vistosC = C.presencia.ver(ahora()).map(j => j.autor).sort();
  comprobar('el que llega después ve dónde están los demás', vistosC.join() === [A.autor, B.autor].sort().join(), vistosC.join(', '));

  // A se va
  A.ws.close();
  await pausa(600);
  comprobar('cuando A se va, desaparece de B y de C', B.presencia.ver(ahora()).length === 0 && C.presencia.ver(ahora()).every(j => j.autor !== A.autor));
  B.ws.close(); C.ws.close();
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA la prueba se cortó:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
