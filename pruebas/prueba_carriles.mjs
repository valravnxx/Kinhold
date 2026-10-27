// Prueba de los dos carriles en paralelo (herramientas/carriles.mjs): eligen tareas de hitos distintos, respetan las
// sesiones de chat (tareas en_curso), la regla de no empezar hitos nuevos con uno en revisión, los carriles cortados y
// los choques de archivos. MUTAR=1 hace que los dos carriles ignoren lo que hace el otro: tiene que fallar.
import { elegir, ocupar, soltar, choques, leerCarriles, LIBRE_TRAS_MIN } from '../herramientas/carriles.mjs';
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const T = (nombre, estado = 'pendiente') => ({ nombre, estado });
const base = () => ({ hitos: [
  { id: 'h1', estado: 'hecho', tareas: [T('a', 'hecho')] },
  { id: 'h2', estado: 'en_curso', tareas: [T('h2-1', 'hecho'), T('h2-2'), T('h2-3')] },
  { id: 'h3', estado: 'en_curso', tareas: [T('h3-1')] },
  { id: 'h4', estado: 'pendiente', tareas: [] },
  { id: 'h5', estado: 'pendiente', tareas: [] },
] });
const ahora = Date.parse('2026-10-27T10:00:00Z'), hace = (m) => new Date(ahora - m * 60000).toISOString();
const el = (r, s, c) => process.env.MUTAR ? elegir(JSON.parse(JSON.stringify(r).replaceAll('"lleva":"chat"', '"x":1')), {}, c, ahora) : elegir(r, s, c, ahora);

let r = base(), s = {};
const a = el(r, s, 'A');
comprobar('A coge la primera tarea pendiente del primer hito en curso', a && a.hito === 'h2' && a.tarea === 'h2-2', JSON.stringify(a));
[r, s] = ocupar(r, s, 'A', a, 'trabajo/a', hace(5));
const b = el(r, s, 'B');
comprobar('B coge otro hito, nunca el de A', b && b.hito !== a.hito && b.hito === 'h3', JSON.stringify(b));
[r, s] = ocupar(r, s, 'B', b, 'trabajo/b', hace(3));
comprobar('al ocupar, la tarea queda en_curso en el roadmap', r.hitos[1].tareas[1].estado === 'en_curso' && r.hitos[2].tareas[0].estado === 'en_curso');
// una sesión de chat trabaja en h4 (tarea en_curso): A, al terminar h2-2, no coge h2 (sigue su otra tarea) ni h4
r.hitos[1].tareas[1].estado = 'hecho'; s = soltar(s, 'A');
r.hitos[3].estado = 'en_curso'; r.hitos[3].tareas = [T('chat', 'en_curso'), T('h4-2')];
const a2 = el(r, s, 'A');
comprobar('A no coge nada del hito de una sesión de chat', a2 && a2.hito !== 'h4' && a2.hito !== 'h3', JSON.stringify(a2));
// con un hito en revisión no se empiezan hitos nuevos
const r2 = base(); r2.hitos[1].estado = 'revision'; r2.hitos[1].tareas.forEach(t => t.estado = 'hecho');
let s2 = {}; const x = el(r2, s2, 'A'); [, s2] = ocupar(structuredClone(r2), s2, 'A', x, 'trabajo/a', hace(1));
const y = el(r2, s2, 'B');
comprobar('con un hito en revisión, B no abre un hito nuevo', x && x.hito === 'h3' && y === null, JSON.stringify([x, y]));
// carril cortado: más de LIBRE_TRAS_MIN sin noticias → el otro puede usar su hito
let r3 = base(), s3 = {};
const a3 = el(r3, s3, 'A'); [r3, s3] = ocupar(r3, s3, 'A', a3, 'trabajo/a', hace(LIBRE_TRAS_MIN + 20));
const b3 = el(r3, { ...s3 }, 'B');
comprobar('un carril cortado no bloquea su hito por el carril (pero su tarea sigue en_curso)', b3 && b3.hito === 'h3', JSON.stringify(b3));
const a3b = el(r3, s3, 'A');
comprobar('el carril cortado retoma su tarea a medias', a3b && a3b.retoma && a3b.tarea === 'h2-2', JSON.stringify(a3b));
// latido: un carril que empezó hace mucho pero subió un avance hace poco sigue vivo
const s4 = { A: { ...leerCarriles(s3).A, ultimo: hace(5) } };
const b4 = el(r3, s4, 'B');
comprobar('un avance reciente mantiene vivo el carril', b4 && b4.hito !== 'h2', JSON.stringify(b4));
// formato antiguo de sesion.json = carril A
comprobar('el sesion.json antiguo se lee como el carril A', leerCarriles({ inicio: hace(1), tarea: 'x', rama: 'r' }).A.rama === 'r');
// un hito que lleva a mano la sesión de chat no lo coge ningún carril, aunque no tenga nada en curso
const r5 = base(); r5.hitos[1].lleva = 'chat'; r5.hitos[2].lleva = 'chat';
const a5 = el(r5, {}, 'A');
comprobar('ningún carril coge un hito que lleva la sesión de chat', a5 && a5.hito !== 'h2' && a5.hito !== 'h3', JSON.stringify(a5));
// choques de archivos
const cs = choques(['src/juego/modelos.js', 'proyecto/diario.json', 'docs/index.html'], { 'trabajo/b': ['src/juego/modelos.js', 'proyecto/diario.json'], 'trabajo/c': ['src/combate/main.js'] });
comprobar('choque: solo los archivos de verdad, no los que se unen solos', cs.length === 1 && cs[0].archivo === 'src/juego/modelos.js' && cs[0].rama === 'trabajo/b', JSON.stringify(cs));
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
