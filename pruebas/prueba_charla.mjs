// Pruebas del chat de texto (valravnx, 6 nov: «vamos a poner chat de texto ya, debe verse sobre el jugador, y
// desaparecer al rato»): la lógica pura (src/logica/charla.js) y el servidor de verdad con tres conexiones:
//   - el texto se limpia (sin control ni invisibles de dirección, sin saltos, como mucho 120 letras sin partir un emoji);
//   - el bocadillo dura entre 4 y 12 s, más cuanto más largo;
//   - no se puede hablar a chorro (una frase por segundo, 6 en 20 s);
//   - le llega a quien está a 50 m o menos, y al que habla; al de 200 m, no;
//   - el autor es el de la conexión (lo que diga el mensaje no cuenta);
//   - lo vacío no vale; lo dicho queda en charla.jsonl.
// Ejecutar: node pruebas/prueba_charla.mjs
// MUTAR=1: un servidor que se lo reparte a todos (también al de lejos): debe FALLAR.
// MUTAR=2: un servidor que deja hablar a chorro: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { limpiarTexto, duracionBocadillo, LimitadorCharla, quienOye, validarDicho, LARGO_MAX, ALCANCE, MOTIVO_VACIO, MOTIVO_DESPACIO } from '../src/logica/charla.js';

const MUTAR = process.env.MUTAR || '';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

console.log('Lógica pura');
comprobar('un texto normal se queda igual', limpiarTexto('Hola, ¿qué tal?') === 'Hola, ¿qué tal?');
comprobar('sin espacios de sobra ni saltos de línea', limpiarTexto('  hola\n\n  qué   tal\t ') === 'hola qué tal');
comprobar('sin caracteres de control ni invisibles de dirección (con ellos se da la vuelta a lo que se lee)', limpiarTexto('ho\u0000la‮ mal​') === 'hola mal');
comprobar('vacío, solo espacios o lo que no es texto: no vale', [limpiarTexto(''), limpiarTexto('   \n '), limpiarTexto('‮'), limpiarTexto(42), limpiarTexto(null), limpiarTexto({})].every(x => x === null));
const largo = limpiarTexto('a'.repeat(500));
comprobar(`como mucho ${LARGO_MAX} letras`, largo && Array.from(largo).length === LARGO_MAX);
const emojis = limpiarTexto('😀'.repeat(200));
comprobar('y un emoji no se parte por la mitad', emojis && Array.from(emojis).length === LARGO_MAX && emojis.endsWith('😀') && !/[\ud800-\udbff]$/.test(emojis));
comprobar('un mensaje enorme ni se mira', limpiarTexto('a'.repeat(LARGO_MAX * 8 + 1)) === null);
comprobar('el bocadillo dura entre 4 y 12 s, más cuanto más largo', duracionBocadillo('hola') >= 4000 && duracionBocadillo('a'.repeat(120)) === 12000 && duracionBocadillo('a'.repeat(40)) > duracionBocadillo('hola'));
{
  const L = new LimitadorCharla();
  comprobar('la primera frase pasa', L.admitir('a', 0));
  comprobar('otra antes de un segundo, no', !L.admitir('a', 500));
  comprobar('pasado el segundo, sí; y otro jugador no cuenta', L.admitir('a', 1100) && L.admitir('b', 1100));
  let t = 1100, n = 2; while (L.admitir('a', t += 1100)) n++;
  comprobar('como mucho 6 en 20 s', n === 6, `${n}`);
  comprobar('pasado el rato, vuelve a poder', L.admitir('a', t + 20000));
}
{
  const pos = new Map([['a', { x: 0, z: 0 }], ['b', { x: 30, z: 40 }], ['c', { x: 31, z: 40 }]]);
  const o = quienOye('a', pos);
  comprobar(`le llega al que habla y a quien está a ${ALCANCE} m o menos`, o.includes('a') && o.includes('b') && !o.includes('c'), JSON.stringify(o));
  comprobar('y al que habla aunque aún no tenga sitio', quienOye('z', pos).join() === 'z');
}
comprobar('lo que llega al navegador se comprueba otra vez', validarDicho({ autor: 'x', texto: ' hola‮ ' }).texto === 'hola' && validarDicho({ autor: 'x', texto: '' }) === null && validarDicho({ texto: 'hola' }) === null);

console.log('Con el servidor de verdad');
let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR === '1' || MUTAR === '2') {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = MUTAR === '1' ? fuente.replace('const oyen = quienOye(autor, posiciones);', 'const oyen = [...conexionDe.keys()];')
    : fuente.replace('if (!charla.admitir(autor, reloj()))', 'if (false)');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_charla.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, dichos: [], errores: [] };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estado = (x, z) => c.mandar({ tipo: 'estado', x, y: 2, z, giro: 0, anim: 'quieto' });
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.yo = m.autor; listo(c); } if (m.tipo === 'dicho') c.dichos.push(m); if (m.tipo === 'error') c.errores.push(m.motivo); });
    ws.on('error', fallo);
  });
}
const dir = mkdtempSync(join(tmpdir(), 'kinhold-charla-'));
const srv = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), altas: { origen: 1e6, total: 1e6, espera: 0 }, limiteMovimiento: false });
try {
  const p = await srv.listo;
  const a = await cliente(p), b = await cliente(p), c = await cliente(p);
  a.estado(0, 0); b.estado(20, 0); c.estado(200, 0);
  await pausa(300);
  a.mandar({ tipo: 'decir', texto: 'Buenas,\n vecino‮', autor: b.yo });
  await pausa(300);
  const deA = (x) => x.dichos.filter(d => d.autor === a.yo);
  comprobar('lo que dice A le llega a él (lo que ha aceptado el servidor)', deA(a).length === 1 && deA(a)[0].texto === 'Buenas, vecino', JSON.stringify(a.dichos));
  comprobar('y a B, a 20 m', deA(b).length === 1 && deA(b)[0].texto === 'Buenas, vecino', JSON.stringify(b.dichos));
  comprobar('pero no a C, a 200 m', c.dichos.length === 0, JSON.stringify(c.dichos));
  comprobar('el autor es el de la conexión (aunque el mensaje diga otro)', b.dichos.every(d => d.autor === a.yo) && !b.dichos.some(d => d.autor === b.yo));
  a.mandar({ tipo: 'decir', texto: 'otra vez' });
  await pausa(300);
  comprobar('hablar otra vez antes de un segundo: no, y se le dice por qué', deA(b).length === 1 && a.errores.includes(MOTIVO_DESPACIO), JSON.stringify(a.errores));
  await pausa(900);
  b.mandar({ tipo: 'decir', texto: '   ' });
  b.mandar({ tipo: 'decir', texto: 42 });
  await pausa(300);
  comprobar('lo vacío o lo que no es texto no vale', b.errores.filter(e => e === MOTIVO_VACIO).length === 2 && a.dichos.every(d => d.autor !== b.yo), JSON.stringify(b.errores));
  b.mandar({ tipo: 'decir', texto: '<b>hola</b>' });
  await pausa(300);
  comprobar('B contesta y A lo recibe tal cual (como texto: el navegador no lo pone como HTML)', a.dichos.some(d => d.autor === b.yo && d.texto === '<b>hola</b>'));
  const reg = existsSync(join(dir, 'charla.jsonl')) ? readFileSync(join(dir, 'charla.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  comprobar('lo dicho queda en charla.jsonl, con su autor, dónde y a cuántos llegó', reg.length === 2 && reg[0].autor === a.yo && reg[0].texto === 'Buenas, vecino' && reg[0].x === 0 && reg[0].oyen === 2 && reg[1].autor === b.yo, JSON.stringify(reg));
  for (const x of [a, b, c]) x.ws.close();
} finally {
  await srv.cerrar();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
