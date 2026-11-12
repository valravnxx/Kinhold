// Prueba del guardado de objetos.json en el servidor (servidor/servidor.mjs, 12 nov): no se reescribe el archivo entero
// en cada acción (cada hachazo) ni se para el servidor mientras se escribe.
// Ejecutar: node pruebas/prueba_guardado_objetos.mjs
// Comprueba: muchas acciones seguidas (coger y soltar del arcón de pruebas) no escriben el archivo en cada una, sino
// como mucho una vez cada guardarCada ms; justo después de una acción el archivo aún no ha cambiado (no se escribe de
// golpe en medio de la acción); pasado el plazo, lo guardado es lo mismo que tiene el servidor; al cerrar se escribe lo
// que falte; al volver a arrancar se lee igual; y el servidor de verdad (node servidor/servidor.mjs), apagado con
// SIGTERM antes del plazo, guarda lo último antes de salir.
// Con MUTAR=1 se prueba un servidor que vuelve a escribir en cada acción: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

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
  const mutada = fuente.replace('const guardarObjetos = () => { objetosSucios = true;', 'const guardarObjetos = () => { objetosSucios = true; plazoObjetos = null; escribirObjetos(); return;');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_guardado.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, esperas: [], id: 0 };
    c.esperar = (cond, ms = 4000) => new Promise((r, f) => {
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    const b = c.esperar(m => m.tipo === 'bienvenida', 60000);
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const leer = (f) => existsSync(f) ? readFileSync(f, 'utf8') : null;

const dir = mkdtempSync(join(tmpdir(), 'kinhold-guardado-'));
const archivo = join(dir, 'mundo.jsonl'), archivoObjetos = join(dir, 'objetos.json');
try {
  const CADA = 400;
  let s = crearServidor({ arconPruebas: true, puerto: 0, archivo, guardarCada: CADA });
  let puerto = await s.listo;
  const a = await cliente(puerto);
  await pausa(CADA + 200);   // lo que se haya guardado al llegar
  const antes = leer(archivoObjetos), n0 = s.escriturasObjetos();

  console.log('Una acción no escribe el archivo de golpe');
  let r = await a.objeto({ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:der' });
  comprobar('coge una piedra del arcón de pruebas', r.ok, r.motivo);
  comprobar('justo después, objetos.json aún no ha cambiado', leer(archivoObjetos) === antes && s.escriturasObjetos() === n0, `${s.escriturasObjetos() - n0} escrituras`);

  console.log('Muchas acciones seguidas, pocas escrituras');
  const t0 = Date.now(); let acciones = 1, bien = true;
  for (let i = 0; i < 30; i++) {
    r = await a.objeto({ tipo: i % 2 ? 'coger' : 'soltar', objeto: 'piedra', cantidad: 1, ...(i % 2 ? { a: 'mano:der' } : { de: 'mano:der' }) });
    bien = bien && r.ok; acciones++;
  }
  const ms = Date.now() - t0;
  comprobar('30 acciones más (soltar y coger) salen bien', bien, r.motivo);
  const escritas = s.escriturasObjetos() - n0, tope = Math.ceil(ms / CADA) + 1;
  comprobar(`se escribe como mucho una vez cada ${CADA} ms, no en cada acción`, escritas <= tope && escritas < acciones, `${acciones} acciones en ${ms} ms, ${escritas} escrituras (tope ${tope})`);

  console.log('Pasado el plazo, lo guardado es lo del servidor');
  r = await a.objeto({ tipo: 'coger', objeto: 'rama', cantidad: 1, a: 'mano:izq' });
  comprobar('coge una rama', r.ok, r.motivo);
  await pausa(CADA * 2 + 300);
  comprobar('objetos.json es lo mismo que tiene el servidor (con la rama)', leer(archivoObjetos) === JSON.stringify(s.objetos.exportar()) && leer(archivoObjetos).includes('"rama"'));
  comprobar('sin el .tmp a medias', !existsSync(archivoObjetos + '.tmp'));

  console.log('Al cerrar, lo que falte');
  r = await a.objeto({ tipo: 'soltar', objeto: 'rama', cantidad: 1, de: 'mano:izq' });
  comprobar('suelta la rama', r.ok, r.motivo);
  const final = JSON.stringify(s.objetos.exportar());
  comprobar('aún no está en el archivo', leer(archivoObjetos) !== final);
  a.ws.close(); await s.cerrar();
  comprobar('al cerrar se escribe', leer(archivoObjetos) === final);
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo, guardarCada: CADA }); await s.listo;
  comprobar('y al volver a arrancar se lee igual', JSON.stringify(s.objetos.exportar()) === final);
  await s.cerrar();

  console.log('El servidor de verdad, apagado con SIGTERM antes del plazo');
  const dir2 = mkdtempSync(join(tmpdir(), 'kinhold-guardado-'));
  const obj2 = join(dir2, 'objetos.json'), PUERTO = 18000 + Math.floor(Math.random() * 2000);
  const p = spawn('node', [ruta, String(PUERTO), join(dir2, 'mundo.jsonl')], { cwd: raiz, env: { ...process.env, KINHOLD_PRUEBAS_ARCON: 'si', KINHOLD_GUARDAR_CADA: '600000' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  p.stdout.on('data', d => salida += d); p.stderr.on('data', d => salida += d);
  const fin = new Promise(r => p.on('exit', (code, senal) => r({ code, senal })));
  const t1 = Date.now(); while (!/en el puerto/.test(salida) && Date.now() - t1 < 90000) await pausa(100);
  comprobar('arranca', /en el puerto/.test(salida), /en el puerto/.test(salida) ? '' : salida.slice(-300));
  const c = await cliente(PUERTO);
  r = await c.objeto({ tipo: 'coger', objeto: 'piedra', cantidad: 2, a: 'mano:der' });
  comprobar('coge dos piedras', r.ok, r.motivo);
  await pausa(300);
  comprobar('con un plazo de 10 min, aún no se ha escrito', !existsSync(obj2) || !leer(obj2).includes(c.bienvenida.autor));
  p.kill('SIGTERM');
  const e = await fin;
  const g = leer(obj2);
  comprobar('al apagarse, lo ha guardado antes de salir', !!g && g.includes(c.bienvenida.autor) && g.includes('"piedra"'), `salida ${e.code ?? e.senal}`);
  rmSync(dir2, { recursive: true, force: true });
} catch (e) {
  mal++; console.log('  FALLA ' + (e && e.stack || e));
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
