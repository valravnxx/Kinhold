// Prueba de las conexiones que se cortan y de la protección básica del servidor (hito 1f).
// Ejecutar: node pruebas/prueba_conexiones.mjs
// Comprueba, con clientes de verdad por websocket:
//   - volver a conectar con la ficha: mismo autor y el mismo luchador (con sus heridas); sin ficha o con una falsa,
//     otro jugador; la ficha nunca llega a los demás; vale también tras reiniciar el servidor;
//   - quitar al que se va: al cerrar, los demás reciben «sale» enseguida; al que deja de contestar al latido se
//     le quita; si entra otra vez con su ficha estando aún conectado, manda la nueva (la vieja se cierra con 4001);
//   - límites: un mensaje demasiado grande cierra esa conexión (1009); una ráfaga de acciones recibe todas sus
//     respuestas (las de más, rechazadas); quien inunda es echado (1008); los demás siguen jugando;
//   - datos mal formados (y acciones con datos al azar): error y nada más; el servidor no se cae, no lanza
//     excepciones y el mundo no cambia.
// Con MUTAR=1 se prueba un servidor que no hace caso de la ficha (cada conexión, un jugador nuevo): debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { Limitador, LIMITES } from '../src/logica/limites.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const foto = (m) => JSON.stringify(m.exportar());

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace("if (fichaValida(ficha) && fichas.has(resumen(ficha)))", 'if (false)');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_conexiones.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

// Cliente de prueba. opciones: ficha, sinPong (no contesta al latido, como una conexión colgada)
function cliente(puerto, { ficha = null, sinPong = false } = {}) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`, sinPong ? { autoPong: false } : {});
    const c = { ws, recibidos: [], crudos: [], esperas: [], id: 0, cierre: null };
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond);
      if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.cerrado = new Promise(r => ws.on('close', (codigo) => { c.cierre = codigo; r(codigo); }));
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    ws.on('message', (d) => {
      c.crudos.push(d.toString());
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    ws.on('open', async () => { try { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); } catch (e) { fallo(e); } });
    ws.on('error', () => {});
  });
}

const dir = mkdtempSync(join(tmpdir(), 'kinhold-conexiones-'));
const archivo = join(dir, 'mundo.jsonl');
const avisos = [];
const servir = () => crearServidor({ puerto: 0, archivo, latido: 200, gracia: 3000, registrar: t => avisos.push(t) });
try {
  // ---------------- Límites (lógica pura, con reloj de mentira) ----------------
  console.log('Limitador');
  {
    const l = new Limitador(0);
    let si = 0, no = 0;
    for (let i = 0; i < 400; i++) { const r = l.admitir(0, 100); if (r === 'si') si++; else if (r === 'no') no++; }
    comprobar('una ráfaga deja pasar hasta su tamaño y no más', si === LIMITES.rafagaMensajes && no === 100, `${si} pasan, ${no} no`);
    comprobar('al pasar un segundo vuelve a haber sitio para lo de un segundo', [...Array(LIMITES.mensajesSeg + 5)].filter(() => l.admitir(1000, 100) === 'si').length === LIMITES.mensajesSeg);
    const j = new Limitador(0);
    let n = 0, r = 'si';
    for (; n < 10000 && r !== 'echar'; n++) r = j.admitir(n, 10);   // 1000 mensajes por segundo seguidos
    comprobar('quien manda sin parar mucho más de lo permitido acaba echado', r === 'echar', `tras ${n} mensajes en ${n} ms`);
    const k = new Limitador(0);
    let echado = false;
    for (let t = 0; t < 60000; t += 100) for (let i = 0; i < 2; i++) if (k.admitir(t, 120) !== 'si') echado = true;   // 20 por segundo, un minuto
    comprobar('un jugador normal (20 mensajes por segundo, un minuto) siempre pasa', !echado);
    comprobar('un mensaje más grande del máximo no pasa', new Limitador(0).admitir(0, LIMITES.maxMensaje + 1) === 'echar');
  }

  // ---------------- Volver a conectar ----------------
  console.log('Volver a conectar con la ficha');
  let s = servir();
  let puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);
  const yoA = A.bienvenida.autor;
  comprobar('la bienvenida trae una ficha secreta', /^[0-9a-f]{32}$/.test(A.bienvenida.ficha || ''));
  comprobar('la ficha de uno no llega a los demás', !B.crudos.some(t => t.includes(A.bienvenida.ficha)) && !A.crudos.some(t => t.includes(B.bienvenida.ficha)));
  // A tiene una herida en su luchador
  const L = s.combate.luchadores[yoA];
  L.recibirHerida('brazoI', 0.1, 'corte'); L.arma = 'hacha';
  const sangreAntes = L.sangre;
  A.ws.close();
  const t0 = Date.now();
  await B.esperar(m => m.tipo === 'sale' && m.autor === yoA);
  comprobar('al irse, los demás lo saben enseguida («sale»)', Date.now() - t0 < 500, `${Date.now() - t0} ms`);
  comprobar('mientras no está, su luchador no está en el combate (nadie le puede dar)', !s.combate.luchadores[yoA] && s.apartados.has(yoA));
  const A2 = await cliente(puerto, { ficha: A.bienvenida.ficha });
  comprobar('al volver con su ficha es el mismo jugador', A2.bienvenida.autor === yoA && A2.bienvenida.vuelve === true, A2.bienvenida.autor);
  const L2 = s.combate.luchadores[yoA];
  comprobar('y su luchador vuelve como estaba (heridas, sangre, arma)', !!L2 && L2.heridas.length === 1 && L2.heridas[0].zona === 'brazoI' && L2.arma === 'hacha' && L2.sangre <= sangreAntes,
    `${L2 && L2.heridas.length} herida, sangre ${L2 && L2.sangre.toFixed(2)}`);
  const r1 = await A2.accion({ tipo: 'mojon', x: 0, z: 0 });
  const vista = await B.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'mojon');
  comprobar('lo que hace después lleva el mismo autor', r1.ok && vista.entrada.autor === yoA);
  const N = await cliente(puerto), F = await cliente(puerto, { ficha: '0123456789abcdef0123456789abcdef' }), X = await cliente(puerto, { ficha: '../../etc' });
  comprobar('sin ficha, o con una inventada o rota, es otro jugador', [N, F, X].every(c => c.bienvenida.autor !== yoA && !c.bienvenida.vuelve) && new Set([N, F, X].map(c => c.bienvenida.autor)).size === 3);
  N.ws.close(); F.ws.close(); X.ws.close();

  console.log('Dos conexiones con la misma ficha');
  const salesAntes = B.recibidos.filter(m => m.tipo === 'sale' && m.autor === yoA).length;
  const A3 = await cliente(puerto, { ficha: A.bienvenida.ficha });
  const cod = await Promise.race([A2.cerrado, pausa(2000).then(() => null)]);
  comprobar('si entra otra vez estando conectado, la conexión vieja se cierra (4001)', cod === 4001, `código ${cod}`);
  await pausa(150);
  comprobar('y los demás no lo ven irse: sigue siendo uno', B.recibidos.filter(m => m.tipo === 'sale' && m.autor === yoA).length === salesAntes && [...s.clientes.values()].filter(a => a === yoA).length === 1);
  const r2 = await A3.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  comprobar('la conexión nueva sigue jugando', r2.ok, r2.motivo || '');

  console.log('Latido: quien deja de contestar se quita');
  const Z = await cliente(puerto, { sinPong: true });
  const t1 = Date.now();
  await B.esperar(m => m.tipo === 'sale' && m.autor === Z.bienvenida.autor, 3000).catch(() => null);
  const quitado = B.recibidos.some(m => m.tipo === 'sale' && m.autor === Z.bienvenida.autor);
  comprobar('una conexión colgada (no contesta al ping) se quita en dos latidos', quitado && Date.now() - t1 < 1000, `${Date.now() - t1} ms con latido de 200 ms`);
  comprobar('las que contestan siguen', B.ws.readyState === 1 && A3.ws.readyState === 1);

  console.log('Pasada la gracia, el luchador se olvida');
  const G = await cliente(puerto);
  s.combate.luchadores[G.bienvenida.autor].recibirHerida('piernaD', 0.1, 'corte');
  G.ws.close(); await G.cerrado;
  await pausa(3500);
  comprobar('tras la gracia ya no se guarda', !s.apartados.has(G.bienvenida.autor));
  const G2 = await cliente(puerto, { ficha: G.bienvenida.ficha });
  comprobar('vuelve el mismo jugador, con un luchador nuevo (sano)', G2.bienvenida.autor === G.bienvenida.autor && s.combate.luchadores[G.bienvenida.autor].heridas.length === 0);
  G2.ws.close();

  // ---------------- Límites ----------------
  console.log('Límites por conexión');
  const Grande = await cliente(puerto);
  Grande.ws.send(JSON.stringify({ tipo: 'estado', x: 0, y: 0, z: 0, giro: 0, anim: 'quieto', relleno: 'x'.repeat(20000) }));
  const codG = await Promise.race([Grande.cerrado, pausa(2000).then(() => null)]);
  comprobar('un mensaje de más de 16 KiB cierra esa conexión (1009)', codG === 1009, `código ${codG}`);
  const R = await cliente(puerto);
  const ids = [];
  for (let i = 0; i < 400; i++) { const id = 1000 + i; ids.push(id); R.ws.send(JSON.stringify({ tipo: 'accion', id, accion: { tipo: 'volar' } })); }
  await R.esperar(m => m.tipo === 'resultado' && m.id === ids[ids.length - 1], 4000).catch(() => null);
  const res = R.recibidos.filter(m => m.tipo === 'resultado');
  const demas = res.filter(m => m.motivo === 'Demasiados mensajes.').length;
  comprobar('en una ráfaga de 400 acciones, todas reciben respuesta (las de más, «Demasiados mensajes»)', res.length === 400 && demas === 400 - LIMITES.rafagaMensajes, `${res.length} respuestas, ${demas} por el límite`);
  comprobar('y se avisa con un error (una vez, no 100)', R.recibidos.filter(m => m.tipo === 'error' && m.motivo === 'Demasiados mensajes.').length === 1);
  comprobar('una ráfaga suelta no echa a nadie', R.ws.readyState === 1);
  const I = await cliente(puerto);
  const estado = JSON.stringify({ tipo: 'estado', x: 1, y: 0, z: 1, giro: 0, anim: 'quieto' });
  for (let i = 0; i < 2000; i++) I.ws.send(estado);
  const codI = await Promise.race([I.cerrado, pausa(2000).then(() => null)]);
  comprobar('quien inunda (2000 mensajes de golpe) es echado (1008)', codI === 1008, `código ${codI}`);
  const r3 = await B.accion({ tipo: 'decorar', pieza: 'mesa', x: 0.3, y: 0.2, z: 0.3, rot: 0.5 });
  comprobar('los demás siguen jugando', r3.ok, r3.motivo || '');

  // ---------------- Datos mal formados ----------------
  console.log('Datos mal formados');
  const M = await cliente(puerto);
  const mundoAntes = foto(s.mundo);
  const errAntes = avisos.filter(t => t.startsWith('error atendiendo')).length;
  let anidado = '1'; for (let i = 0; i < 3000; i++) anidado = '[' + anidado + ']';
  const basura = [
    'esto no es json', '', '[]', 'null', '5', '"texto"', '{}', '{"tipo":5}', '{"tipo":"nada"}', '{"tipo":"accion"}', anidado,
    { tipo: 'accion', accion: [] }, { tipo: 'accion', accion: null }, { tipo: 'accion', id: 'x', accion: { tipo: 'colocar' } },
    { tipo: 'accion', id: 1e30, accion: { tipo: 'colocar', pieza: 'cim_piedra', x: '0', z: 0, k: 0, rot: 0, dir: 0 } },
    { tipo: 'accion', id: 2, accion: { tipo: 'colocar', pieza: 'cim_piedra', x: 1e308, z: -1e308, k: 1e9, rot: 0, dir: 0 } },
    { tipo: 'accion', id: 3, accion: { tipo: 'colocar', pieza: '__proto__', x: 0, z: 0, k: 0, rot: 0, dir: 0 } },
    { tipo: 'accion', id: 4, accion: { tipo: 'constructor', x: 0 } },
    { tipo: 'accion', id: 5, accion: { tipo: 'trabajar', construccion: {}, clave: [], segundos: 'mucho' } },
    { tipo: 'accion', id: 6, accion: { tipo: 'trabajar', construccion: 1, clave: '0,0,0', segundos: -1e9 } },
    { tipo: 'accion', id: 7, accion: { tipo: 'entregar', construccion: 1, clave: 'x', material: 'oro', cantidad: 1e12 } },
    { tipo: 'accion', id: 8, accion: { tipo: 'quitar', id: -1 } },
    { tipo: 'accion', id: 9, accion: { tipo: 'mojon', x: 0, z: 0, __proto__: { autor: 'jugador:falso' } } },
    { tipo: 'estado', x: 'a', y: 0, z: 0, giro: 0, anim: 'quieto' }, { tipo: 'estado', x: 0, y: 0, z: 0, giro: 0, anim: '<script>' },
    { tipo: 'estado', x: 0, y: 0, z: 0, giro: 0, anim: 'quieto', tc: 'ayer' },
    { tipo: 'combate', que: {} }, { tipo: 'combate', que: 'atacar', linea: 99 }, { tipo: 'combate', que: 'soltar', x: 'a' },
    { tipo: 'combate', que: 'equipar', arma: 'cañón', armadura: 7 }, { tipo: 'combate', que: 'x'.repeat(5000) },
    { tipo: 'aspecto', sexo: 'hombre', capas: 'camisa' }, { tipo: 'aspecto', sexo: 'otro', capas: [] },
    { tipo: 'aspecto', sexo: 'mujer', capas: Array(50).fill('camisa') }, { tipo: '__proto__' }, { tipo: 'bienvenida', autor: 'yo' },
  ];
  for (const b of basura) M.ws.send(typeof b === 'string' ? b : JSON.stringify(b));
  M.ws.send(Buffer.from([0, 1, 2, 255]), { binary: true });
  // acciones con datos al azar, de todos los tipos que conoce la lógica
  let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const valores = [0, 1, -1, 0.5, 1e9, -1e9, 1e308, null, true, '', 'x', '0,0,0', [], {}, 'cim_piedra', 'mesa', 'tronco', 'varas'];
  const tipos = ['mojon', 'colocar', 'decorar', 'desmontar', 'quitar', 'entregar', 'subir', 'trabajar', 'usar', 'rellenar'];
  const campos = ['x', 'y', 'z', 'k', 'rot', 'dir', 'pieza', 'construccion', 'clave', 'material', 'cantidad', 'segundos', 'metodo', 'id', 'desde'];
  for (let i = 0; i < 200; i++) {
    const a = { tipo: tipos[Math.floor(azar() * tipos.length)] };
    for (const c of campos) if (azar() < 0.6) a[c] = valores[Math.floor(azar() * valores.length)];
    if (a.tipo === 'rellenar') a.cantidad = 'x';   // que no cambie el mundo de verdad
    M.ws.send(JSON.stringify({ tipo: 'accion', id: 5000 + i, accion: a }));
  }
  await M.esperar(m => m.tipo === 'resultado' && m.id === 5199, 5000).catch(() => null);
  await pausa(200);
  const errores = M.recibidos.filter(m => m.tipo === 'error').length;
  const excepciones = avisos.filter(t => t.startsWith('error atendiendo')).slice(errAntes);
  comprobar('cada mensaje roto recibe un error y la conexión sigue', errores >= 20 && M.ws.readyState === 1, `${errores} errores`);
  comprobar('ningún mensaje hace saltar una excepción en el servidor', excepciones.length === 0, excepciones.slice(0, 3).join(' | '));
  comprobar('las 200 acciones al azar reciben respuesta', M.recibidos.filter(m => m.tipo === 'resultado' && m.id >= 5000).length === 200);
  const aceptadas = M.recibidos.filter(m => m.tipo === 'resultado' && m.ok);
  comprobar('lo roto no cambia el mundo (o lo que cambia, lo acepta la lógica pura y se reparte)', aceptadas.length > 0 || foto(s.mundo) === mundoAntes, `${aceptadas.length} aceptadas`);
  comprobar('nadie se hace pasar por otro con __proto__', !M.recibidos.some(m => m.tipo === 'accion' && m.entrada.autor === 'jugador:falso'));
  const r4 = await B.accion({ tipo: 'decorar', pieza: 'mesa', x: 0.6, y: 0.2, z: 0.6, rot: 0 });
  comprobar('después, el servidor sigue atendiendo a los demás', r4.ok, r4.motivo || '');
  const fichaA = A.bienvenida.ficha;
  for (const c of [A3, B, R, M]) c.ws.close();
  await s.cerrar();

  console.log('El servidor se reinicia');
  s = servir();
  puerto = await s.listo;
  const A4 = await cliente(puerto, { ficha: fichaA });
  comprobar('la ficha sigue valiendo tras reiniciar el servidor', A4.bienvenida.autor === yoA, A4.bienvenida.autor);
  comprobar('el archivo de fichas no guarda las fichas, solo su resumen', !readFileSync(s.archivoFichas, 'utf8').includes(fichaA));
  A4.ws.close();
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA la prueba se cortó:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
