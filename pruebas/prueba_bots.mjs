// Prueba de los bots (servidor/bots.mjs): jugadores simulados que se conectan al servidor y andan, construyen
// y pelean, para la medición del hito 1f.
// Ejecutar: node pruebas/prueba_bots.mjs
// Seis bots contra un servidor de verdad (puerto libre, mundo en una carpeta temporal), con fases de 17 s en
// este orden: construir, pelear, andar. Comprueba que todos entran con autores distintos y mandan su estado
// unas 10 veces por segundo sin errores; que levantan obras de verdad (en el mundo del servidor, con su autor);
// que al pelear se ponen frente a su pareja y el servidor resuelve golpes con su autor; que al andar se mueven;
// y que al pararlos se van todos. Con MUTAR=1 se prueban bots que mandan el estado mal formado: debe FALLAR.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let ruta = join(raiz, 'servidor/bots.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace("giro: +this.giro.toFixed(3), anim,", "giro: +this.giro.toFixed(3), anim: 7,");
  if (mutada === fuente) { console.log('No se pudieron mutar los bots'); process.exit(1); }
  copia = join(raiz, 'servidor/.bots_mutados.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { Enjambre } = await import(pathToFileURL(ruta).href);

const N = 6, FASE = 17;
const dir = mkdtempSync(join(tmpdir(), 'kinhold-bots-'));
const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl') });
let E = null;
try {
  const puerto = await s.listo;
  E = new Enjambre({ url: `ws://127.0.0.1:${puerto}`, cuantos: N, fase: FASE, fases: ['construir', 'pelear', 'andar'], desfase: 0, piezas: ['cim_tronco'], semilla: 3 });
  await E.arrancar();
  const autores = E.bots.map(b => b.yo);
  console.log('Entran');
  comprobar(`entran los ${N} bots, cada uno con su autor del servidor`, new Set(autores).size === N && autores.every(a => /^jugador:/.test(a)), autores.join(' '));
  comprobar('el primero pone el mojón (sin él no se construye)', !!s.mundo.mojon);

  console.log('Construyen');
  await pausa(4000);
  const pres = s.presencia.todos();
  comprobar('el servidor tiene el estado de todos', autores.every(a => pres.some(e => e.autor === a)), `${pres.length} presentes`);
  comprobar('mientras construyen, trabajan o van a la obra', pres.filter(e => e.anim === 'talar' || e.anim === 'andar').length >= N - 1, pres.map(e => e.anim).join(' '));
  await pausa(FASE * 1000 - 4000 + 500);
  const terminadas = s.mundo.obrasTerminadas;
  const quienes = new Set(terminadas.flatMap(o => o.aportes.filter(x => x.trabajo).map(x => x.autor)));
  comprobar('levantan obras en el mundo del servidor', terminadas.length >= N - 2, `${terminadas.length} obras terminadas`);
  comprobar('cada obra lleva el trabajo de su bot (autor del servidor)', [...quienes].every(a => autores.includes(a)) && quienes.size >= N - 2, `${quienes.size} bots con obra`);
  const reproducido = E.espejo.mundo.construcciones.reduce((n, c) => n + c.piezas.size, 0), enServidor = s.mundo.construcciones.reduce((n, c) => n + c.piezas.size, 0);
  comprobar('la copia del mundo de los bots es igual que la del servidor', reproducido === enServidor && JSON.stringify(E.espejo.mundo.materiales) === JSON.stringify(s.mundo.materiales), `${reproducido} y ${enServidor} piezas`);

  console.log('Pelean');
  await pausa(9000);
  const L = s.combate.luchadores;
  const distancias = [];
  for (let i = 0; i < N; i += 2) { const a = L[autores[i]], b = L[autores[i + 1]]; distancias.push(a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity); }
  comprobar('cada bot se pone frente a su pareja', distancias.every(d => d < 2), distancias.map(d => d.toFixed(2)).join(' m, ') + ' m');
  await pausa(FASE * 1000 - 9000 + 500);
  const golpes = s.combate.registro.entradas.filter(e => e.tipo === 'golpe' && e.ok);
  comprobar('el servidor resuelve golpes entre ellos, con su autor', golpes.length >= N && golpes.every(e => autores.includes(e.autor) && autores.includes(e.datos.objetivo)), `${golpes.length} golpes`);
  const tipos = new Set(golpes.map(e => e.resultado));
  comprobar('hay golpes que hieren y golpes parados o fallados', tipos.has('herida') && [...tipos].some(t => t !== 'herida'), [...tipos].join(', '));

  console.log('Andan');
  const antes = autores.map(a => { const e = s.presencia.todos().find(x => x.autor === a); return e && { x: e.x, z: e.z }; });
  await pausa(3000);
  const despues = autores.map(a => s.presencia.todos().find(x => x.autor === a));
  const movidos = despues.filter((e, i) => e && antes[i] && Math.hypot(e.x - antes[i].x, e.z - antes[i].z) > 1).length;
  comprobar('al andar se mueven por la tierra del mojón', movidos >= N - 1 && despues.every(e => Math.hypot(e.x, e.z) <= 20.5), `${movidos} se han movido`);

  console.log('Lo medido');
  const m = E.medida();
  console.log('  ' + JSON.stringify({ porBotYSegundo: m.porBotYSegundo, latenciaAccionMs: m.latenciaAccionMs, motivos: m.motivos }));
  comprobar('mandan unos 10 estados por segundo (como la demo) y poco más', m.porBotYSegundo.mensajesEnviados >= 9 && m.porBotYSegundo.mensajesEnviados <= 16, `${m.porBotYSegundo.mensajesEnviados} mensajes/s por bot`);
  comprobar('el servidor no les manda ningún error', m.errores === 0, `${m.errores} errores`);
  comprobar('ninguno se queda sin respuesta ni es echado', E.bots.every(b => b.abierto && b.esperando.size <= 1), E.bots.map(b => b.esperando.size).join(' '));
  comprobar('lo medido cuenta lo que se manda y se recibe', m.bytesEnviados > 0 && m.bytesRecibidos > m.bytesEnviados && m.latenciaAccionMs.p50 !== null);

  await E.parar(); E = null;
  await pausa(300);
  comprobar('al pararlos se van todos del servidor', s.clientes.size === 0 && s.presencia.todos().length === 0, `${s.clientes.size} conexiones`);
} catch (e) {
  mal++; console.log('  FALLA la prueba no ha podido seguir: ' + (e && e.stack || e));
} finally {
  if (E) await E.parar();
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
