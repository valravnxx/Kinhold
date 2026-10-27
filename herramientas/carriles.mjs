// Dos sesiones automáticas en paralelo (carriles A y B) sin pisarse (pedido de valravnx el 27 oct).
// Cada carril coge una tarea de un hito distinto al que ocupa cualquier otra sesión (el otro carril o una sesión de
// chat), la reserva en proyecto/sesion.json y en el roadmap (en_curso) antes de empezar, y antes de fusionar mira que
// los archivos que ha cambiado no los esté cambiando otra rama activa.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/carriles.mjs estado                  quién trabaja en qué, y qué archivos toca cada rama activa
//   node herramientas/carriles.mjs elegir A|B              qué tarea le toca a ese carril (sale con 2 si ninguna)
//   node herramientas/carriles.mjs ocupar A|B <rama> [inicio] reserva la tarea elegida (edita sesion.json y roadmap.json)
//   node herramientas/carriles.mjs choques [rama]          archivos que esta rama cambia y otra rama activa también
//                                                          (sale con 1 si hay alguno)
//   node herramientas/carriles.mjs soltar A|B              libera el carril (al terminar, bien o mal)
// Después de «ocupar» o «soltar» hay que hacer commit y push enseguida; si el push falla porque otra sesión subió
// antes, se hace git pull y se vuelve a «elegir» y «ocupar».
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

export const LIBRE_TRAS_MIN = 70;        // un carril sin noticias desde hace más de esto se da por cortado
export const RAMA_ACTIVA_MIN = 90;       // una rama trabajo/… con un commit más reciente que esto está activa
// archivos que tocan todas las sesiones y se unen solos (o se regeneran): no cuentan como choque
export const COMPARTIDOS = [/^proyecto\/diario\.json$/, /^proyecto\/idiomas\//, /^docs\/index\.html$/, /^proyecto\/roadmap\.json$/,
  /^proyecto\/sesion\.json$/, /^REVISION\.md$/, /^docs\/capturas\//, /^docs\/jugar\/[^/]+\/index\.html$/];

// sesion.json: { A: {inicio, tarea, hito, rama}, B: {...} }. El formato antiguo (una sola sesión arriba del todo)
// se lee como el carril A.
export function leerCarriles(sesion) {
  if (sesion && sesion.inicio) return { A: { ...sesion }, B: null };
  return { A: sesion?.A || null, B: sesion?.B || null };
}
const minutosDesde = (iso, ahora) => (ahora - new Date(iso).getTime()) / 60000;
// ocupado: empezó o subió un avance (último commit de su rama, «ultimo») hace menos de LIBRE_TRAS_MIN
export const ocupado = (c, ahora) => !!(c && c.inicio && Math.min(minutosDesde(c.inicio, ahora), c.ultimo ? minutosDesde(c.ultimo, ahora) : Infinity) < LIBRE_TRAS_MIN);

// hito de una tarea por su nombre (o por el principio del nombre)
export function hitoDeTarea(roadmap, nombre) {
  if (!nombre) return null;
  for (const h of roadmap.hitos) for (const t of h.tareas || []) if (t.nombre === nombre || t.nombre.startsWith(nombre) || nombre.startsWith(t.nombre.slice(0, 40))) return h.id;
  // las sesiones del formato antiguo apuntaban a veces «<nombre del hito>: <tarea>»
  const n = nombre.toLowerCase();
  for (const h of roadmap.hitos) if ((h.nombre && n.startsWith(h.nombre.toLowerCase().slice(0, 14))) || n.includes(`hito ${String(h.num).toLowerCase()}`)) return h.id;
  return null;
}

// Qué tarea le toca a un carril. Mismas reglas que CLAUDE.md, más: no se coge nada de un hito ocupado por otra
// sesión (el otro carril, o cualquier tarea en_curso, que es como marcan su trabajo las sesiones de chat).
export function elegir(roadmap, sesion, carril, ahora = Date.now()) {
  const c = leerCarriles(sesion), otro = carril === 'A' ? 'B' : 'A';
  const ocupados = new Set();
  if (ocupado(c[otro], ahora)) ocupados.add(c[otro].hito || hitoDeTarea(roadmap, c[otro].tarea));
  for (const h of roadmap.hitos) if ((h.tareas || []).some(t => t.estado === 'en_curso')) ocupados.add(h.id);
  // si este mismo carril tenía una tarea a medias (sesión cortada), la retoma
  if (c[carril] && c[carril].tarea && !ocupado(c[carril], ahora)) {
    const id = c[carril].hito || hitoDeTarea(roadmap, c[carril].tarea);
    const h = roadmap.hitos.find(x => x.id === id), t = h && h.tareas.find(x => x.nombre === c[carril].tarea && x.estado === 'en_curso');
    if (t) return { hito: h.id, tarea: t.nombre, retoma: true };
  }
  const hayRevision = roadmap.hitos.some(h => h.estado === 'revision');
  const bloqueado = roadmap.hitos.some(h => h.bloquea && (h.tareas || []).some(t => t.estado === 'espera_decision'));
  for (const h of roadmap.hitos) {
    if (h.estado !== 'en_curso' || ocupados.has(h.id)) continue;
    const t = (h.tareas || []).find(x => x.estado === 'pendiente');
    if (t) return { hito: h.id, tarea: t.nombre };
  }
  if (hayRevision || bloqueado) return null; // no se empieza ningún hito nuevo
  for (const h of roadmap.hitos) {
    if (h.estado !== 'pendiente' || ocupados.has(h.id)) continue;
    const t = (h.tareas || []).find(x => x.estado === 'pendiente') || { nombre: 'Planificar el hito' };
    return { hito: h.id, tarea: t.nombre, hitoNuevo: true };
  }
  return null;
}

// Reserva: escribe el carril y deja la tarea (y el hito, si es nuevo) en_curso. Devuelve [roadmap, sesion] nuevos.
export function ocupar(roadmap, sesion, carril, eleccion, rama, inicio) {
  const c = leerCarriles(sesion);
  const h = roadmap.hitos.find(x => x.id === eleccion.hito);
  if (h.estado === 'pendiente') h.estado = 'en_curso';
  let t = (h.tareas ||= []).find(x => x.nombre === eleccion.tarea);
  if (!t) { t = { nombre: eleccion.tarea, estado: 'pendiente' }; h.tareas.unshift(t); }
  t.estado = 'en_curso'; t.inicio ||= inicio;
  c[carril] = { inicio, tarea: t.nombre, hito: h.id, rama };
  return [roadmap, { A: c.A, B: c.B }];
}

export function soltar(sesion, carril) { const c = leerCarriles(sesion); c[carril] = null; return { A: c.A, B: c.B }; }

// archivos que comparten dos listas, sin los que se unen solos
export function choques(mios, otros) {
  const cuenta = (f) => !COMPARTIDOS.some(r => r.test(f));
  const yo = new Set(mios.filter(cuenta)), res = [];
  for (const [rama, fs] of Object.entries(otros)) for (const f of fs) if (yo.has(f)) res.push({ rama, archivo: f });
  return res;
}

// ---------- uso por línea de órdenes ----------
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
function ramasActivas(propia) {
  try { git('fetch', '-q', 'origin', '+refs/heads/trabajo/*:refs/remotes/origin/trabajo/*', '+refs/heads/main:refs/remotes/origin/main'); } catch (e) { /* sin red: se usa lo que haya */ }
  const res = {};
  const lineas = git('for-each-ref', '--format=%(refname:short) %(committerdate:unix)', 'refs/remotes/origin/trabajo/').split('\n').filter(Boolean);
  for (const l of lineas) {
    const [ref, t] = l.split(' '), rama = ref.replace('origin/', '');
    if (rama === propia || (Date.now() / 1000 - Number(t)) / 60 > RAMA_ACTIVA_MIN) continue;
    let fs = [];
    try { fs = git('diff', '--name-only', `origin/main...${ref}`).split('\n').filter(Boolean); } catch (e) { /* rama sin base común */ }
    if (fs.length) res[rama] = fs;
  }
  return res;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [orden, a1, a2, a3] = process.argv.slice(2);
  const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const escribir = (f, d) => writeFileSync(f, JSON.stringify(d, null, 1) + '\n');
  const roadmap = leer('proyecto/roadmap.json');
  let sesion = {}; try { sesion = leer('proyecto/sesion.json'); } catch (e) { /* sin archivo */ }
  // latido: el último commit subido a la rama de cada carril (los avances cada 15 minutos lo mantienen vivo)
  const conLatido = (s) => { const c = leerCarriles(s);
    for (const k of ['A', 'B']) if (c[k]?.rama) { try { c[k].ultimo = new Date(Number(git('log', '-1', '--format=%ct', `origin/${c[k].rama}`)) * 1000).toISOString(); } catch (e) { /* rama aún sin subir */ } }
    return c; };
  if (orden === 'estado') {
    ramasActivas(null); const c = conLatido(sesion);
    for (const k of ['A', 'B']) console.log(`carril ${k}:`, c[k] ? `${ocupado(c[k], Date.now()) ? 'trabajando' : 'cortado o terminado'} · ${c[k].hito || hitoDeTarea(roadmap, c[k].tarea)} · ${c[k].tarea} · ${c[k].rama}` : 'libre');
    for (const h of roadmap.hitos) for (const t of h.tareas || []) if (t.estado === 'en_curso') console.log(`en curso: ${h.id} · ${t.nombre.slice(0, 90)}`);
    for (const [r, fs] of Object.entries(ramasActivas(null))) console.log(`rama activa ${r}: ${fs.length} archivos (${fs.slice(0, 6).join(', ')}${fs.length > 6 ? '…' : ''})`);
  } else if (orden === 'elegir') {
    const e = elegir(roadmap, conLatido(sesion), a1);
    if (!e) { console.log('nada que hacer en este carril'); process.exit(2); }
    console.log(JSON.stringify(e));
  } else if (orden === 'ocupar') {
    const e = elegir(roadmap, conLatido(sesion), a1);
    if (!e) { console.log('nada que hacer en este carril'); process.exit(2); }
    const [r2, s2] = ocupar(roadmap, sesion, a1, e, a2, a3 || new Date().toISOString());
    escribir('proyecto/roadmap.json', r2); escribir('proyecto/sesion.json', s2);
    console.log(`carril ${a1} ocupa: ${e.hito} · ${e.tarea}`);
  } else if (orden === 'soltar') {
    escribir('proyecto/sesion.json', soltar(sesion, a1)); console.log(`carril ${a1} libre`);
  } else if (orden === 'choques') {
    const propia = a1 || git('rev-parse', '--abbrev-ref', 'HEAD');
    const mios = git('diff', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean);
    const cs = choques(mios, ramasActivas(propia));
    for (const c of cs) console.log(`CHOQUE: ${c.archivo} lo cambia también ${c.rama}`);
    if (cs.length) process.exit(1);
    console.log('sin choques con las ramas activas');
  } else { console.log('órdenes: estado | elegir A|B | ocupar A|B <rama> [inicio] | choques [rama] | soltar A|B'); process.exit(1); }
}
