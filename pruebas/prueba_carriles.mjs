// Prueba de los dos carriles en paralelo (herramientas/carriles.mjs): eligen tareas de hitos distintos, respetan las
// sesiones de chat (tareas en_curso), la regla de no empezar hitos nuevos con uno en revisión, los carriles cortados y
// los choques de archivos. MUTAR=1 hace que los dos carriles ignoren lo que hace el otro: tiene que fallar.
import { elegir, ocupar, soltar, choques, leerCarriles, leerAgentes, quienLleva, aMedias, anunciarChat, conLatido, LIBRE_TRAS_MIN } from '../herramientas/carriles.mjs';
import { unirTextos } from '../herramientas/unir_json.mjs';
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
comprobar('un carril cortado deja su tarea a medias: el otro carril la retoma desde su rama', b3 && b3.hito === 'h2' && b3.tarea === 'h2-2' && b3.retoma && b3.rama === 'trabajo/a', JSON.stringify(b3));
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

// ---------- quién trabaja en qué (pedido de valravnx, 28 oct) ----------
// una sesión de chat anuncia su tarea: queda en_curso con su rama, la lleva ella y ningún carril toca su hito
{
  let r = base(), s = {};
  [r, s] = anunciarChat(r, s, 'trabajo/chat1', 'h3', 'web: quién trabaja', hace(2), ahora);
  const t = r.hitos[2].tareas.find(x => x.nombre === 'web: quién trabaja');
  comprobar('el chat anuncia su tarea: la crea en su hito, en_curso con su rama', t && t.estado === 'en_curso' && t.rama === 'trabajo/chat1' && s['chat:trabajo/chat1'].hito === 'h3', JSON.stringify(s));
  comprobar('la tarea anunciada la lleva el chat', quienLleva(s, ahora).get('web: quién trabaja')?.quien === 'chat');
  const a = el(r, s, 'A'); [r, s] = ocupar(r, s, 'A', a, 'trabajo/a', hace(1));
  const b = el(r, s, 'B');
  comprobar('con el chat en h3 y A en h2, B no coge ninguno de los dos', a.hito === 'h2' && b && b.hito !== 'h2' && b.hito !== 'h3', JSON.stringify([a, b]));
  comprobar('ocupar no borra el anuncio del chat', !!s['chat:trabajo/chat1'] && s.A.tarea === a.tarea && leerAgentes(s).length === 2);
  let error = '';
  try { anunciarChat(r, s, 'trabajo/chat2', 'h2', a.tarea, hace(0), ahora); } catch (e) { error = e.message; }
  comprobar('un chat no puede quitarle la tarea a un carril vivo', /la lleva A/.test(error), error);
  // al soltar, la tarea marcada hace poco aún no está a medias (margen), pero pasado el margen sí, y la retoma un carril
  let s2 = soltar(s, 'chat', 'trabajo/chat1');
  comprobar('soltar el chat quita su anuncio y nada más', !s2['chat:trabajo/chat1'] && s2.A && s2.A.tarea === a.tarea);
  comprobar('recién soltada, no está a medias (margen)', !aMedias(r, s2, ahora).some(m => m.tarea === 'web: quién trabaja'));
  const luego = ahora + (LIBRE_TRAS_MIN + 5) * 60000;
  const m = aMedias(r, { ...s2, A: { ...s2.A, ultimo: new Date(luego).toISOString() } }, luego);
  comprobar('pasado el margen, la que no lleva nadie está a medias (con su rama)', m.length === 1 && m[0].tarea === 'web: quién trabaja' && m[0].rama === 'trabajo/chat1', JSON.stringify(m));
  const vivoA = { ...s2, A: { ...s2.A, ultimo: new Date(luego).toISOString() } };
  const b2 = elegir(r, vivoA, 'B', luego);
  comprobar('lo que está a medias va primero y no bloquea su hito', b2 && b2.hito === 'h3' && b2.tarea === 'web: quién trabaja' && b2.retoma && b2.rama === 'trabajo/chat1', JSON.stringify(b2));
  // un avance reciente en la rama de una tarea sin anunciar la mantiene llevada
  const m2 = aMedias(r, s2, luego, { 'trabajo/chat1': new Date(luego - 10 * 60000).toISOString() });
  comprobar('un avance reciente en su rama la mantiene llevada', !m2.some(x => x.tarea === 'web: quién trabaja'));
  // el latido de un chat sale de su rama
  const s3 = conLatido(s, { 'trabajo/chat1': new Date(luego - 5 * 60000).toISOString() });
  comprobar('el chat con avances recientes sigue vivo', quienLleva(s3, luego).has('web: quién trabaja') && !quienLleva(s, luego).has('web: quién trabaja'));
  // un carril retoma una tarea a medias de otro agente: el anuncio viejo se quita
  const [, s4] = ocupar(structuredClone(r), { ...s, B: { inicio: hace(200), tarea: 'web: quién trabaja', hito: 'h3', rama: 'trabajo/b' } }, 'A', { hito: 'h3', tarea: 'web: quién trabaja', retoma: true }, 'trabajo/chat1', hace(0));
  comprobar('al retomar, se quitan los anuncios viejos de esa tarea', s4.A.tarea === 'web: quién trabaja' && s4.B === null && !s4['chat:trabajo/chat1'], JSON.stringify(s4));
}
// dos agentes que anuncian a la vez (A en main y un chat en otra copia) se unen sin choque
{
  const b = JSON.stringify({ A: null, B: null }, null, 1);
  const n = JSON.stringify({ A: { inicio: hace(1), tarea: 'x', hito: 'h2', rama: 'trabajo/a' }, B: null }, null, 1);
  const o = JSON.stringify({ A: null, B: null, 'chat:trabajo/c': { inicio: hace(1), tarea: 'y', hito: 'h3', rama: 'trabajo/c' } }, null, 1);
  const u = unirTextos(b, n, o), j = JSON.parse(u.texto);
  comprobar('sesion.json: dos anuncios a la vez se unen solos', !u.choques.length && j.A.tarea === 'x' && j['chat:trabajo/c'].tarea === 'y', u.texto);
}
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
