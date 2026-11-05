// Prueba del movimiento sin trampas (src/logica/presencia.js y servidor/servidor.mjs, auditoría del 4 nov): el servidor
// no se cree un estado que esté más lejos del anterior de lo que se puede andar en ese tiempo; lo recorta y lo anota.
// Ejecutar: node pruebas/prueba_movimiento.mjs
// Comprueba: correr a 6 m/s (y nadar con corriente) nunca se recorta, ni cuando la red junta los estados; saltarse
// 100 m se queda en lo que da el crédito y luego a VEL_MAX; volver a la salida (al ahogarse) es libre; la liza no
// cuenta para el mundo; el servidor (al conectar y el admin) pone el ancla. En el servidor: los demás ven lo recortado,
// se apunta en seguridad.jsonl y lo que se guarda al salir es lo recortado.
// Con MUTAR=1 el servidor no recorta nada: debe FALLAR.
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

let ruta = join(raiz, 'src/logica/presencia.js'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('else if (d > a.credito) {', 'else if (false) {');
  if (mutada === fuente) { console.log('No se pudo mutar la presencia'); process.exit(1); }
  copia = join(raiz, 'src/logica/.presencia_mutada_mov.js');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { PresenciaServidor, VEL_MAX, CREDITO_MAX } = await import(pathToFileURL(ruta).href);
const r1 = v => Math.round(v * 10) / 10;
const est = (x, z, y = 0) => ({ x, y, z, giro: 0, anim: 'correr' });

console.log('Lógica: el crédito de metros');
{
  // correr 20 s a 6 m/s en línea recta, un estado cada 100 ms
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 20, z: 0 }, 0);
  let recortes = 0;
  for (let i = 1; i <= 200; i++) recortes += ps.recibir('a', est(20 + 0.6 * i, 0), i * 100).recortado > 0 ? 1 : 0;
  comprobar('correr 20 s a 6 m/s no se recorta nunca', recortes === 0 && r1(ps.ultimo.get('a').x) === 140, `x=${r1(ps.ultimo.get('a').x)}`);
}
{
  // 1 s sin nada que llegue (tirón de la red) y luego los 10 estados de golpe
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 30, z: 0 }, 0);
  for (let i = 1; i <= 10; i++) ps.recibir('a', est(30 + 0.6 * i, 0), i * 100);
  let recortes = 0;
  for (let i = 11; i <= 20; i++) recortes += ps.recibir('a', est(30 + 0.6 * i, 0), 2000).recortado > 0 ? 1 : 0;
  comprobar('los estados que llegan juntos tras un tirón de la red pasan enteros', recortes === 0 && r1(ps.ultimo.get('a').x) === 42, `x=${r1(ps.ultimo.get('a').x)}`);
}
{
  // nadando a favor de la corriente: 1,5 + 0,8 × 3 = 3,9 m/s
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 0, z: 30 }, 0);
  let recortes = 0;
  for (let i = 1; i <= 100; i++) recortes += ps.recibir('a', est(0.39 * i, 30), i * 100).recortado > 0 ? 1 : 0;
  comprobar('nadar con la corriente a favor no se recorta', recortes === 0);
}
{
  // saltarse 100 m de golpe
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 30, z: 0 }, 0);
  ps.recibir('a', est(30, 0), 100);
  const r = ps.recibir('a', est(130, 0, 10), 200);
  const x1 = ps.ultimo.get('a').x;
  comprobar('saltarse 100 m se queda en lo que da el crédito, en la misma dirección', r.recortado > 80 && Math.abs(x1 - (30 + CREDITO_MAX)) < 0.01 && ps.ultimo.get('a').z === 0,
    `x=${r1(x1)}, recortado ${r1(r.recortado)} m`);
  comprobar('la altura del recortado va con lo recortado (no se queda en la del sitio saltado)', ps.ultimo.get('a').y < 10, `y=${r1(ps.ultimo.get('a').y)}`);
  // sigue mandando el sitio lejano cada 100 ms: avanza a VEL_MAX
  for (let i = 3; i <= 12; i++) ps.recibir('a', est(130, 0), i * 100);
  const x2 = ps.ultimo.get('a').x;
  comprobar('si insiste, avanza a VEL_MAX y no más', Math.abs(x2 - x1 - VEL_MAX) < 0.01, `${r1(x2 - x1)} m en 1 s`);
}
{
  // ahogado: vuelve a la salida (0, 4) desde lejos
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 300, z: 300 }, 0);
  const r = ps.recibir('a', est(0, 4), 100);
  comprobar('volver a la salida al ahogarse es libre', r.recortado === 0 && ps.ultimo.get('a').x === 0 && ps.ultimo.get('a').z === 4);
}
{
  // la liza del «Duelo» es otra escena: sus estados no cuentan ni mueven el ancla del mundo
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 50, z: 50 }, 0);
  const rl = ps.recibir('a', est(-200, 300), 100, { aparte: true });
  const rm = ps.recibir('a', est(-200, 300), 200);
  comprobar('en la liza no se recorta, pero de la liza no se sale al mundo en otro sitio', rl.recortado === 0 && rm.recortado > 0 && Math.hypot(ps.ultimo.get('a').x - 50, ps.ultimo.get('a').z - 50) <= CREDITO_MAX + 0.01,
    `en el mundo a ${r1(Math.hypot(ps.ultimo.get('a').x - 50, ps.ultimo.get('a').z - 50))} m del ancla`);
}
{
  // el admin va junto a alguien: el servidor pone el ancla allí
  const ps = new PresenciaServidor(); ps.anclar('a', { x: 30, z: 0 }, 0);
  ps.recibir('a', est(30, 0), 100);
  ps.anclar('a', { x: 500, z: -400 }, 150);
  const r = ps.recibir('a', est(500.5, -400), 200);
  comprobar('cuando el servidor lo mueve (admin), el primer estado allí no se recorta', r.recortado === 0 && ps.ultimo.get('a').x === 500.5);
}
{
  const ps = new PresenciaServidor({ limitar: false });
  ps.recibir('a', est(0, 0), 100);
  const r = ps.recibir('a', est(900, 0), 200);
  comprobar('sin límite (solo pruebas que colocan de golpe) no se recorta', r.recortado === 0 && ps.ultimo.get('a').x === 900);
}

// en el servidor de verdad, por websocket
const { crearServidor } = await import('../servidor/servidor.mjs');
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '?ficha=' + encodeURIComponent(ficha) : ''}`);
    const c = { ws, vistos: new Map(), recibidos: [] };
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'correr' }));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()); c.recibidos.push(m);
      if (m.tipo === 'estados') for (const j of m.jugadores) c.vistos.set(j.autor, j);
      if (m.tipo === 'bienvenida') { c.autor = m.autor; c.ficha = m.ficha; c.posicion = m.posicion; listo(c); }
    });
    ws.on('error', fallo);
  });
}

console.log('En el servidor');
const dir = mkdtempSync(join(tmpdir(), 'kinhold-movimiento-'));
try {
  const archivo = join(dir, 'mundo.jsonl');
  let s = crearServidor({ puerto: 0, archivo });
  let puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);
  A.estar(0, 4); await pausa(150);
  for (let i = 1; i <= 10; i++) { A.estar(0.6 * i, 4); await pausa(100); }   // corre 6 m
  await pausa(250);
  const corrido = B.vistos.get(A.autor);
  comprobar('B ve a A donde ha corrido', corrido && Math.abs(corrido.x - 6) < 0.01, corrido && `x=${r1(corrido.x)}`);
  A.estar(400, -300); await pausa(300);   // se salta 500 m
  const visto = B.vistos.get(A.autor), d = visto ? Math.hypot(visto.x - 6, visto.z - 4) : null;
  comprobar('B ve a A recortado, no en el sitio saltado', visto && d <= CREDITO_MAX + 1, visto && `a ${r1(d)} m de donde estaba, no a 500`);
  const seg = join(dir, 'seguridad.jsonl');
  const lineas = existsSync(seg) ? readFileSync(seg, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const nota = lineas.find(l => l.que === 'movimiento_recortado' && l.autor === A.autor);
  comprobar('se anota en seguridad.jsonl quién y cuánto', !!nota && nota.metros > 400, nota && `${nota.metros} m`);
  for (let i = 0; i < 30; i++) { A.estar(400, -300); await pausa(10); }   // insiste muy deprisa
  await pausa(200);
  const lineas2 = readFileSync(seg, 'utf8').trim().split('\n').filter(l => l.includes('movimiento_recortado'));
  comprobar('insistir no llena el registro (uno cada 10 s como mucho)', lineas2.length === 1, `${lineas2.length} líneas`);
  const fichaA = A.ficha;
  A.ws.close(); B.ws.close(); await pausa(300);
  await s.cerrar();
  // vuelve: el sitio guardado es el recortado, y desde ahí sigue el límite
  s = crearServidor({ puerto: 0, archivo }); puerto = await s.listo;
  const A2 = await cliente(puerto, fichaA), C = await cliente(puerto);
  const p = A2.posicion;
  comprobar('lo que se guarda al salir es lo recortado', p && Math.hypot(p.x, p.z) < 60, p && `x=${r1(p.x)}, z=${r1(p.z)}`);
  A2.estar(400, -300); await pausa(300);   // al volver a conectar no vale saltar
  const v2 = C.vistos.get(A2.autor);
  comprobar('al volver a conectar tampoco se salta: el servidor lo ancla donde lo dejó', v2 && p && Math.hypot(v2.x - p.x, v2.z - p.z) <= CREDITO_MAX + 1, v2 && `x=${r1(v2.x)}, z=${r1(v2.z)}`);
  A2.ws.close(); C.ws.close(); await pausa(200);
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA la prueba se cortó:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
