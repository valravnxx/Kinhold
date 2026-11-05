// Lo tuyo es tuyo (hito «Jugar entre dos sin trampas»): en tu tierra solo tú y tus invitados desmontáis, abrís y
// cerráis puertas y encendéis o apagáis el fuego; en tierra de nadie, cualquiera. Ejecutar: node pruebas/prueba_lo_tuyo.mjs
// Comprueba, en la lógica pura y con el autor de la acción: Bruno no desmonta ni abre lo de Ana (y no cambia nada);
// Ana sí; invitado, Bruno sí, y al quitarle la invitación, otra vez no; la vista previa de desmontar ya lo dice (el
// navegador no lo resalta como para desmontar); con zonas y sin ellas; rehecho desde el registro da el mismo mundo; y en
// línea (MundoEnLinea, la copia del navegador) lo de otro se rechaza sin mandarlo; y el servidor de verdad, aunque el
// navegador se lo mande igual (un navegador tramposo), lo rechaza con el autor de la conexión.
// Con MUTAR=1 la comprobación de la tierra deja pasar a cualquiera: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';
import { MundoEnLinea } from '../src/logica/en_linea.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
if (MUTAR) Mundo.prototype.puedeTocar = () => ({ ok: true });
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana', B = 'jugador:bruno';
const foto = (m) => JSON.stringify(m.exportar());
const AJENO = 'Es tierra de otro: solo su dueño y sus invitados.';

// Ana: mojón en (500, 500) y una casita con muro con hueco de puerta, su puerta y dos cimientos; Bruno, su mojón lejos.
function montar(m, reg) {
  const E = (autor, a) => { const r = ejecutar(m, reg, { autor, ...a }); return r.ok && r.obra ? acabarObra(m, reg, autor, r.construccion.id, r.clave) : r; };
  const pasos = [
    [A, { tipo: 'rellenar', cantidad: 500 }],
    [A, { tipo: 'mojon', x: 500, z: 500 }],
    [B, { tipo: 'mojon', x: 3000, z: 3000 }],
    [A, { tipo: 'colocar', pieza: 'cim_piedra', x: 504, z: 500, k: 0, rot: 0, dir: 0 }],
    [A, { tipo: 'colocar', pieza: 'cim_piedra', x: 506, z: 500, k: 0, rot: 0, dir: 0 }],
    [A, { tipo: 'colocar', pieza: 'muro_tronco_puerta', x: 504, z: 499.05, k: 0, rot: 0, dir: 0 }],
    [A, { tipo: 'colocar', pieza: 'puerta_varas', x: 504, z: 499.05, k: 0, rot: 0, dir: 0 }],
  ];
  for (const [autor, a] of pasos) { const r = E(autor, a); if (!r.ok) throw new Error(`${a.tipo} ${a.pieza || ''}: ${r.motivo}`); }
  const c = m.construcciones[0];
  const puerta = [...c.piezas.entries()].find(([, p]) => p.tipo === 'puerta_varas');
  const cim = [...c.piezas.entries()].find(([, p]) => p.tipo === 'cim_piedra' && p.i === 1);
  if (!puerta || !cim) throw new Error('falta la puerta o el segundo cimiento');
  return { c, kPuerta: puerta[0], kCim: cim[0] };
}

for (const conZonas of [false, true]) {
  ponerZonas(conZonas ? (x, z) => `${Math.floor(x / 1000)},${Math.floor(z / 1000)}` : null);
  console.log(conZonas ? 'Con zonas (tu tierra es la zona entera)' : 'Sin zonas (el círculo del mojón)');
  const m = new Mundo(), reg = new RegistroAcciones();
  const { c, kPuerta, kCim } = montar(m, reg);
  const H = (autor, a) => ejecutar(m, reg, { autor, ...a });

  let antes = foto(m);
  const u = H(B, { tipo: 'usar', construccion: c.id, clave: kPuerta });
  comprobar('Bruno no abre la puerta de Ana', !u.ok && u.motivo === AJENO, u.motivo || 'abrió');
  const d = H(B, { tipo: 'desmontar', construccion: c.id, clave: kCim });
  comprobar('Bruno no desmonta lo de Ana', !d.ok && d.motivo === AJENO, d.motivo || 'desmontó');
  comprobar('lo rechazado no cambia nada (ni la puerta ni las piezas)', foto(m) === antes);
  comprobar('queda anotado con su autor y su motivo', reg.entradas.slice(-2).every(e => e.autor === B && !e.ok && e.motivo === AJENO));
  const pv = m.previsualizarDesmontaje(c, kCim, B);
  comprobar('la vista previa de desmontar ya se lo dice a Bruno', !pv.ok && pv.motivo === AJENO);
  comprobar('sin autor, la vista previa no mira la tierra (las pruebas sueltas)', m.previsualizarDesmontaje(c, kCim).ok);

  const ua = H(A, { tipo: 'usar', construccion: c.id, clave: kPuerta });
  comprobar('Ana abre su puerta', ua.ok && ua.abierta === true);
  comprobar('Ana tiene la vista previa de desmontar', m.previsualizarDesmontaje(c, kCim, A).ok);

  comprobar('Ana invita a Bruno', H(A, { tipo: 'invitar', a: B }).ok);
  const ub = H(B, { tipo: 'usar', construccion: c.id, clave: kPuerta });
  comprobar('invitado, Bruno cierra la puerta', ub.ok && ub.abierta === false);
  comprobar('Ana le quita la invitación', H(A, { tipo: 'desinvitar', a: B }).ok);
  const ub2 = H(B, { tipo: 'usar', construccion: c.id, clave: kPuerta });
  comprobar('sin invitación, Bruno otra vez no', !ub2.ok && ub2.motivo === AJENO);
  H(A, { tipo: 'invitar', a: B });
  const db = H(B, { tipo: 'desmontar', construccion: c.id, clave: kCim });
  comprobar('invitado, Bruno desmonta', db.ok, db.motivo || '');

  // rehecho desde el registro (el servidor al volver a arrancar): lo mismo
  comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === foto(m));

  // en tierra de nadie (Ana quita su mojón: hoy se pierde lo construido; se prueba con una construcción suelta)
  const m2 = new Mundo(), r2 = new RegistroAcciones();
  const x = montar(m2, r2);
  delete m2.mojones[A];   // sin dueño: tierra de nadie (como quedará la ruina de una tierra que vuelve al rey)
  const un = ejecutar(m2, r2, { autor: B, tipo: 'usar', construccion: x.c.id, clave: x.kPuerta });
  comprobar('en tierra de nadie, cualquiera abre', un.ok);
}

console.log('En línea: la copia del navegador lo rechaza sin mandarlo');
{
  ponerZonas(null);
  const m = new Mundo(), reg = new RegistroAcciones();
  const { c, kPuerta, kCim } = montar(m, reg);
  const enviados = [];
  const red = new MundoEnLinea((msg) => enviados.push(msg));
  red.recibir({ tipo: 'bienvenida', autor: B, obras: m.exportar() });
  const u = red.accion({ tipo: 'usar', construccion: c.id, clave: kPuerta });
  const d = red.accion({ tipo: 'desmontar', construccion: c.id, clave: kCim });
  comprobar('Bruno, en línea: ni abre ni desmonta lo de Ana', !u.ok && !d.ok && u.motivo === AJENO && d.motivo === AJENO);
  comprobar('y no se manda nada al servidor', enviados.length === 0);
}

console.log('El servidor de verdad: un navegador tramposo lo manda igual');
{
  ponerZonas(null);
  const cliente = (puerto) => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond); if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.recibidos.push(m); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-lotuyo-'));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  try {
    const puerto = await s.listo;
    const Ana = await cliente(puerto), Bruno = await cliente(puerto);
    await Ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });   // el mojón se paga de lo que llevas
    const rm = await Ana.accion({ tipo: 'mojon', x: 0, z: 0 });
    const rc = await Ana.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 2, z: 0, k: 0, rot: 0, dir: 0 });
    comprobar('Ana pone su mojón y un cimiento en el servidor', rm.ok && rc.ok, [rm, rc].map(r => r.ok ? 'ok' : r.motivo).join(', '));
    const c = s.mundo.construcciones[0], k = c && [...c.piezas.keys()][0];
    const rb = await Bruno.accion({ tipo: 'desmontar', construccion: c.id, clave: k });
    comprobar('el servidor no deja a Bruno desmontar lo de Ana', !rb.ok && rb.motivo === AJENO && s.mundo.construcciones[0] && s.mundo.construcciones[0].piezas.has(k), rb.motivo || 'desmontó');
    const ra = await Ana.accion({ tipo: 'desmontar', construccion: c.id, clave: k });
    comprobar('a Ana, sí', ra.ok, ra.motivo || '');
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
