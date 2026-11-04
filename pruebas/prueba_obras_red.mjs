// Prueba de las obras, la decoración y lo alisado por trozos (src/logica/obras_red.js y servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_obras_red.mjs
// Comprueba: la foto de las obras lleva solo lo de los trozos dados; cada acción de construcción llega solo a quien
// tiene su trozo (las de todo el mundo, como el mojón, a todos); con «antes», el navegador hace las que le llegan igual
// que el servidor aunque no le hayan llegado las de otros trozos (mismos ids y mismo arcón); al acercarse le llega la
// foto de los trozos nuevos y su mundo queda como el del servidor; la bienvenida lleva la foto y no las entradas.
// Con MUTAR=1 se prueba un servidor que reparte las obras a todos, cerca o lejos: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
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

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('if (!k || a === autor || vista.tiene(a, k)) enviar(otro, { tipo: \'accion\', entrada, antes });', 'enviar(otro, { tipo: \'accion\', entrada, antes });');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_obras.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);
const { trozoDe, trozosAlrededor } = await import(pathToFileURL(join(raiz, 'src/logica/trozos_red.js')).href);
const { sitioAccion, sitioColocada, obrasEnTrozos, comunDe, ponerComun } = await import(pathToFileURL(join(raiz, 'src/logica/obras_red.js')).href);
const { Mundo } = await import(pathToFileURL(join(raiz, 'src/logica/construccion.js')).href);
const { RegistroAcciones, ejecutar } = await import(pathToFileURL(join(raiz, 'src/logica/acciones.js')).href);
const { MundoEnLinea } = await import(pathToFileURL(join(raiz, 'src/logica/en_linea.js')).href);
const foto = (m) => JSON.stringify(m.exportar());

// El mojón en el borde de dos trozos: su tierra (20 m) cae en el 0,0 y en el 1,0
const MX = 126, MZ = 0;
const DENTRO0 = 110, DENTRO1 = 140;   // x de una obra en el trozo 0,0 y en el 1,0

console.log('Lógica');
{
  const m = new Mundo(), reg = new RegistroAcciones();
  const hacer = (a) => ejecutar(m, reg, { autor: 'jugador:a', ...a });
  hacer({ tipo: 'mojon', x: MX, z: MZ });
  const r0 = hacer({ tipo: 'colocar', pieza: 'cim_piedra', x: DENTRO0, z: 0, k: 0, rot: 0, dir: 0 });
  const r1 = hacer({ tipo: 'colocar', pieza: 'cim_piedra', x: DENTRO1, z: 0, k: 0, rot: 0, dir: 0 });
  const d1 = hacer({ tipo: 'decorar', pieza: 'mesa', x: DENTRO1 - 2, y: 0.2, z: 3, rot: 0 });
  const n0 = hacer({ tipo: 'nivelar', x: DENTRO0 + 3, z: 4, y: 0, radio: 2 });
  comprobar('el mundo de la prueba se construye', r0.ok && r1.ok && d1.ok && n0.ok, [r0, r1, d1, n0].map(r => r.ok ? 'ok' : r.motivo).join(', '));
  // (una construcción va en el trozo de su origen, que es la esquina de su primera casilla)
  const k0 = trozoDe(sitioColocada(r0).x, sitioColocada(r0).z), k1 = trozoDe(sitioColocada(r1).x, sitioColocada(r1).z);
  comprobar('dos construcciones, una en cada trozo', m.construcciones.length === 2 && k0.startsWith('0,') && k1.startsWith('1,'),
    m.construcciones.map(c => `${c.ox},${c.oz}`).join(' · '));
  const c1 = sitioColocada(r1);
  comprobar('sitio de cada acción: obras por su construcción, mueble y brocha por su punto; mojón y arcón, de todos',
    sitioAccion(m, { tipo: 'entregar', construccion: r1.construccion.id }).x === c1.x && sitioAccion(m, { tipo: 'quitar', id: d1.deco.id }).x === DENTRO1 - 2 &&
    sitioAccion(m, { tipo: 'nivelar', x: 5, z: 6 }).z === 6 && sitioAccion(m, { tipo: 'mojon', x: 1, z: 1 }) === null && sitioAccion(m, { tipo: 'sacar_arcon' }) === null &&
    sitioAccion(m, { tipo: 'desmontar', construccion: 999 }) === null);
  const solo0 = obrasEnTrozos(m, new Set(['0,0', k0]));
  comprobar('la foto de un trozo lleva solo lo suyo', solo0.construcciones.length === 1 && solo0.construcciones[0].id === r0.construccion.id && solo0.decoracion.length === 0 &&
    solo0.nivelados.every(n => n.x < 128) && solo0.nivelados.some(n => n.de === 'brocha'));
  comprobar('y lo de todos: el contador de ids, el arcón y el mojón', solo0.siguienteId === m.siguienteId && solo0.mojones['jugador:a'].x === MX && JSON.stringify(solo0.materiales) === JSON.stringify(m.materiales));
  const copia = Mundo.importar(JSON.parse(JSON.stringify(solo0)));
  comprobar('la foto se lee como un mundo', copia.construcciones.length === 1 && copia.construcciones[0].piezas.size === 1);
  const otro = new Mundo(); ponerComun(otro, comunDe(m));
  comprobar('lo de todos se copia de un mundo a otro', otro.siguienteId === m.siguienteId && otro.mojonDe('jugador:a').x === MX && otro.materiales.madera === m.materiales.madera);
  ponerComun(otro, { sid: 'x', materiales: [1], mojones: [1] });
  comprobar('lo de todos mal formado no rompe nada', otro.siguienteId === m.siguienteId && otro.materiales.madera === m.materiales.madera && !!otro.mojonDe('jugador:a'));
}

function cliente(puerto, conRed = false) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    // con conRed, el mundo en línea del navegador (src/logica/en_linea.js) recibe todo lo que llega
    if (conRed) c.red = new MundoEnLinea((m) => ws.send(JSON.stringify(m)));
    c.esperar = (cond, ms = 2000) => new Promise((r, f) => {
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.de = (tipo) => c.recibidos.filter(m => m.tipo === tipo);
    c.accion = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado' && m.id === id); ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return p; };
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      if (c.red) c.red.recibir(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    const b = c.esperar(m => m.tipo === 'bienvenida');
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'kinhold-obras-'));
const archivo = join(dir, 'mundo.jsonl');
const LEJOS = -200;   // m: B tiene alrededor el trozo 0,0 pero no el 1,0
try {
  const s = crearServidor({ puerto: 0, archivo });
  const puerto = await s.listo;
  const a = await cliente(puerto), b = await cliente(puerto, true);
  comprobar('la bienvenida lleva la foto de las obras (no la lista de entradas) y el número de la última acción',
    !!b.bienvenida.obras && !('entradas' in b.bienvenida) && b.bienvenida.n === 0 && b.red.conectado);
  a.estar(MX, MZ); b.estar(LEJOS, 0); await pausa(200);
  const tB = trozosAlrededor(LEJOS, 0), fotosB = b.de('obras').length;
  comprobar('B tiene alrededor el trozo 0,0 y no el 1,0', tB.has('0,0') && !tB.has('1,0'));

  console.log('A construye en los dos trozos, con B lejos');
  const accionesB = () => b.de('accion').map(m => m.entrada.tipo + (m.entrada.datos.x !== undefined ? '@' + m.entrada.datos.x : ''));
  let r = await a.accion({ tipo: 'mojon', x: MX, z: MZ });
  await pausa(100);
  comprobar('el mojón es de todo el mundo: le llega también a B', r.ok && b.de('accion').some(m => m.entrada.tipo === 'mojon'), r.motivo || accionesB().join(' '));
  const r1 = await a.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: DENTRO1, z: 0, k: 0, rot: 0, dir: 0 });
  const d1 = await a.accion({ tipo: 'decorar', pieza: 'mesa', x: DENTRO1 - 2, y: 0.2, z: 3, rot: 0 });
  const n1 = await a.accion({ tipo: 'nivelar', x: DENTRO1 + 2, z: -4, y: 0, radio: 2 });
  await pausa(150);
  comprobar('A construye, pone un mueble y alisa en el trozo 1,0', r1.ok && d1.ok && n1.ok, [r1, d1, n1].map(x => x.ok ? 'ok' : x.motivo).join(', '));
  comprobar('a A le llega lo suyo', a.de('accion').filter(m => m.entrada.datos.x !== undefined && m.entrada.datos.x >= 128).length === 3);
  comprobar('a B no le llega nada de lo del trozo 1,0', !b.de('accion').some(m => m.entrada.datos.x !== undefined && m.entrada.datos.x >= 128), accionesB().join(' '));
  const c1 = s.mundo.construcciones[0];
  const e1 = await a.accion({ tipo: 'entregar', construccion: c1.id, clave: [...c1.piezas.keys()][0], material: 'piedra', cantidad: 1 });
  await pausa(100);
  comprobar('ni lo que se hace después en esa obra (entregar), aunque no lleve sitio', !b.de('accion').some(m => m.entrada.tipo === 'entregar'), e1.ok ? 'entregado' : 'no entregado: ' + e1.motivo);

  console.log('A construye en el trozo 0,0, que B sí tiene');
  const r0 = await a.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: DENTRO0, z: 0, k: 0, rot: 0, dir: 0 });
  const d0 = await a.accion({ tipo: 'decorar', pieza: 'mesa', x: DENTRO0 + 2, y: 0.2, z: 3, rot: 0 });
  const n0 = await a.accion({ tipo: 'nivelar', x: DENTRO0 + 3, z: -4, y: 0, radio: 2 });
  await pausa(150);
  comprobar('A construye, pone un mueble y alisa en el trozo 0,0', r0.ok && d0.ok && n0.ok, [r0, d0, n0].map(x => x.ok ? 'ok' : x.motivo).join(', '));
  comprobar('a B le llegan las tres, con «antes»', b.de('accion').filter(m => m.entrada.tipo !== 'mojon' && m.entrada.datos.x !== undefined && m.entrada.datos.x < 128 && m.antes).length === 3, accionesB().join(' '));
  const esperado = Mundo.importar(JSON.parse(JSON.stringify(obrasEnTrozos(s.mundo, tB))));
  comprobar('el mundo de B es el del servidor en sus trozos: los mismos ids aunque no le llegó lo del otro trozo, y el mismo arcón',
    foto(b.red.base) === foto(esperado), `B: ids ${b.red.base.construcciones.map(c => c.id)} · servidor: ${esperado.construcciones.map(c => c.id)}`);
  comprobar('B no ha tenido que pedir la foto otra vez (todo le ha salido igual)', b.de('obras').length === fotosB && fotosB === 1, `${fotosB} al irse lejos, ${b.de('obras').length} ahora`);

  console.log('B se acerca');
  b.estar(MX, MZ - 5); await pausa(200);
  const ob = b.de('obras').at(-1);
  comprobar('al cambiar de trozo le llega la foto de las obras de sus trozos nuevos', !!ob && ob.obras.construcciones.length === 2);
  comprobar('y su mundo queda igual que el del servidor', foto(b.red.base) === foto(s.mundo) && b.red.mundo === b.red.base);
  // un mojón por personaje (4 nov): B pone el suyo para construir (sin las zonas del mundo de verdad, su círculo)
  const mb = await b.accion({ tipo: 'mojon', x: DENTRO1, z: 12 });
  const rb = mb.ok ? await b.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: DENTRO1, z: 6, k: 0, rot: 0, dir: 0 }) : mb;
  await pausa(150);
  comprobar('B construye junto a lo de A y A lo recibe', rb.ok && a.de('accion').some(m => m.entrada.autor === b.bienvenida.autor), rb.motivo || '');
  comprobar('después, el mundo de B sigue igual que el del servidor', foto(b.red.base) === foto(s.mundo));

  console.log('Quien llega nuevo, y pedir la foto');
  const c = await cliente(puerto, true);
  comprobar('quien llega a la salida recibe en la bienvenida las obras de alrededor, iguales que en el servidor', foto(c.red.base) === foto(s.mundo) && c.bienvenida.n > 0,
    `${c.bienvenida.obras.construcciones.length} construcciones`);
  c.ws.send(JSON.stringify({ tipo: 'obras' }));
  const pedida = await c.esperar(m => m.tipo === 'obras');
  comprobar('si la pide, le llega la foto de sus trozos', pedida.obras.construcciones.length === s.mundo.construcciones.length);
  a.ws.close(); b.ws.close(); c.ws.close();
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA la prueba se cortó:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
