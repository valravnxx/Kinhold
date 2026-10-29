// Dos sesiones automáticas en paralelo (carriles A y B) sin pisarse (pedido de valravnx el 27 oct), y las sesiones
// de chat con valravnx a la vez. Cada agente (carril A, carril B o una sesión de chat) anuncia al empezar la tarea que
// coge en proyecto/sesion.json (y la deja en_curso en el roadmap); la web de progreso solo marca «en proceso» las
// tareas que lleva un agente vivo (pedido de valravnx el 28 oct). Una tarea en_curso que no lleva nadie está «a
// medias»: no bloquea su hito y la puede retomar un carril desde su rama. Antes de fusionar, cada sesión mira que
// los archivos que ha cambiado no los esté cambiando otra rama activa.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/carriles.mjs estado                  quién trabaja en qué, qué está a medias y qué archivos toca
//                                                          cada rama activa
//   node herramientas/carriles.mjs elegir A|B              qué tarea le toca a ese carril (sale con 2 si ninguna);
//                                                          si dice «retoma» con una rama, se sigue desde esa rama
//   node herramientas/carriles.mjs ocupar A|B <rama> [inicio] anuncia la tarea elegida (sesion.json y roadmap.json)
//   node herramientas/carriles.mjs chat <rama> <hito> "<tarea>" [inicio]
//                                                          una sesión de chat anuncia su tarea (si no existe en ese
//                                                          hito, la crea)
//   node herramientas/carriles.mjs choques [rama]          archivos que esta rama cambia y otra rama activa también
//                                                          (sale con 1 si hay alguno)
//   node herramientas/carriles.mjs soltar A|B              libera el carril (al terminar, bien o mal)
//   node herramientas/carriles.mjs soltar chat <rama>      la sesión de chat deja de anunciar su tarea
// Después de «ocupar», «chat» o «soltar» hay que hacer commit y push a main enseguida; si el push falla porque otra
// sesión subió antes, se hace git pull y se vuelve a «elegir» y «ocupar».
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

export const LIBRE_TRAS_MIN = 70;        // un agente sin noticias desde hace más de esto se da por cortado
export const RAMA_ACTIVA_MIN = 90;       // una rama trabajo/… con un commit más reciente que esto está activa
// archivos que tocan todas las sesiones y se unen solos (o se regeneran): no cuentan como choque
export const COMPARTIDOS = [/^proyecto\/diario\.json$/, /^proyecto\/idiomas\//, /^docs\/index\.html$/, /^proyecto\/roadmap\.json$/,
  /^proyecto\/sesion\.json$/, /^REVISION\.md$/, /^docs\/capturas\//, /^docs\/jugar\/[^/]+\/index\.html$/];
export const CHAT = 'chat:';             // clave de una sesión de chat en sesion.json: «chat:<rama>»

// sesion.json: { A: {inicio, tarea, hito, rama} | null, B: {...} | null, "chat:<rama>": {inicio, tarea, hito, rama}, … }.
// Cada agente en su propia clave, para que dos sesiones que anuncian a la vez se unan sin choque (unir_json.mjs).
// El formato antiguo (una sola sesión arriba del todo) se lee como el carril A.
export function normalizar(sesion) {
  if (sesion && sesion.inicio) return { A: { ...sesion }, B: null };
  const s = { A: sesion?.A || null, B: sesion?.B || null };
  for (const [k, v] of Object.entries(sesion || {})) if (k.startsWith(CHAT) && v) s[k] = v;
  return s;
}
export function leerCarriles(sesion) { const s = normalizar(sesion); return { A: s.A, B: s.B }; }
// todos los agentes anunciados: [{ quien: 'A' | 'B' | 'chat', clave, inicio, tarea, hito, rama, ultimo }]
export function leerAgentes(sesion) {
  return Object.entries(normalizar(sesion)).filter(([, v]) => v).map(([k, v]) => ({ ...v, quien: k.startsWith(CHAT) ? 'chat' : k, clave: k }));
}
const minutosDesde = (iso, ahora) => (ahora - new Date(iso).getTime()) / 60000;
// vivo: empezó o subió un avance (último commit de su rama, «ultimo») hace menos de LIBRE_TRAS_MIN
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

// tarea → agente vivo que la lleva
export function quienLleva(sesion, ahora = Date.now()) {
  const m = new Map();
  for (const a of leerAgentes(sesion)) if (a.tarea && ocupado(a, ahora)) m.set(a.tarea, a);
  return m;
}
// Tareas en_curso que no lleva ningún agente vivo: están a medias. Margen: una tarea marcada hace poco, o con un
// avance reciente en su rama (ramas: { rama: fecha del último commit }), se da por llevada aunque nadie la anuncie.
export function aMedias(roadmap, sesion, ahora = Date.now(), ramas = {}) {
  const lleva = quienLleva(sesion, ahora), res = [];
  for (const h of roadmap.hitos) for (const t of h.tareas || []) {
    if (t.estado !== 'en_curso' || lleva.has(t.nombre)) continue;
    if ([t.inicio, t.rama && ramas[t.rama]].some(x => x && minutosDesde(x, ahora) < LIBRE_TRAS_MIN)) continue;
    res.push({ hito: h.id, tarea: t.nombre, rama: t.rama || null });
  }
  return res;
}

// Qué tarea le toca a un carril. Mismas reglas que CLAUDE.md, más: no se coge nada de un hito en el que trabaja otro
// agente vivo (el otro carril o una sesión de chat), ni de un hito que lleva el chat. Lo que está a medias va primero.
export function elegir(roadmap, sesion, carril, ahora = Date.now(), ramas = {}) {
  const c = leerCarriles(sesion);
  const lleva = quienLleva(sesion, ahora);
  const medias = aMedias(roadmap, sesion, ahora, ramas), huerfana = new Map(medias.map(m => [m.tarea, m]));
  const ocupados = new Set();
  for (const a of leerAgentes(sesion)) if (a.clave !== carril && ocupado(a, ahora)) ocupados.add(a.hito || hitoDeTarea(roadmap, a.tarea));
  for (const h of roadmap.hitos) if ((h.tareas || []).some(t => t.estado === 'en_curso' && !huerfana.has(t.nombre))) ocupados.add(h.id);
  // hitos que lleva a mano una sesión de chat con valravnx («lleva»: «chat»): los carriles no los tocan nunca
  for (const h of roadmap.hitos) if (h.lleva === 'chat') ocupados.add(h.id);
  // si este mismo carril tenía una tarea a medias (sesión cortada) y nadie la ha cogido, la retoma
  if (c[carril] && c[carril].tarea && !ocupado(c[carril], ahora) && !lleva.has(c[carril].tarea)) {
    const id = c[carril].hito || hitoDeTarea(roadmap, c[carril].tarea);
    const h = roadmap.hitos.find(x => x.id === id), t = h && h.tareas.find(x => x.nombre === c[carril].tarea && x.estado === 'en_curso');
    if (t && h.lleva !== 'chat') return { hito: h.id, tarea: t.nombre, retoma: true, rama: c[carril].rama || t.rama || null };
  }
  const hayRevision = roadmap.hitos.some(h => h.estado === 'revision');
  const bloqueado = roadmap.hitos.some(h => h.bloquea && (h.tareas || []).some(t => t.estado === 'espera_decision'));
  // hitos con «carril» (valravnx, 29 oct: el carril B lleva el arte en paralelo): solo los coge ese carril, y los mira
  // antes que los demás; los hitos sin carril los coge cualquiera, en el orden del roadmap
  const orden = [...roadmap.hitos.filter(h => h.carril === carril), ...roadmap.hitos.filter(h => !h.carril)];
  for (const h of orden) {
    if (h.estado !== 'en_curso' || ocupados.has(h.id)) continue;
    const m = (h.tareas || []).find(x => huerfana.has(x.nombre));
    if (m) return { hito: h.id, tarea: m.nombre, retoma: true, rama: m.rama || null };
    const t = (h.tareas || []).find(x => x.estado === 'pendiente');
    if (t) return { hito: h.id, tarea: t.nombre };
  }
  if (hayRevision || bloqueado) return null; // no se empieza ningún hito nuevo
  for (const h of orden) {
    if (h.estado !== 'pendiente' || ocupados.has(h.id)) continue;
    const t = (h.tareas || []).find(x => x.estado === 'pendiente') || { nombre: 'Planificar el hito' };
    return { hito: h.id, tarea: t.nombre, hitoNuevo: true };
  }
  return null;
}

// deja la tarea en_curso con su rama, y quita los anuncios viejos de otros agentes que la llevaban
function marcar(roadmap, s, clave, hitoId, nombre, rama, inicio, crear) {
  const h = roadmap.hitos.find(x => x.id === hitoId);
  if (!h) throw new Error(`no hay ningún hito «${hitoId}»`);
  if (h.estado === 'pendiente') h.estado = 'en_curso';
  let t = (h.tareas ||= []).find(x => x.nombre === nombre);
  if (!t) { t = { nombre, estado: 'pendiente' }; crear(h.tareas, t); }
  t.estado = 'en_curso'; t.inicio ||= inicio; t.rama = rama;
  for (const [k, v] of Object.entries(s)) if (k !== clave && v && v.tarea === t.nombre) { if (k.startsWith(CHAT)) delete s[k]; else s[k] = null; }
  s[clave] = { inicio, tarea: t.nombre, hito: h.id, rama };
  return s;
}
// Un carril anuncia la tarea elegida. Devuelve [roadmap, sesion] nuevos.
export function ocupar(roadmap, sesion, carril, eleccion, rama, inicio) {
  const s = marcar(roadmap, normalizar(sesion), carril, eleccion.hito, eleccion.tarea, rama, inicio, (l, t) => l.unshift(t));
  return [roadmap, s];
}
// Una sesión de chat anuncia su tarea (la crea al final del hito si no existe). No puede quitársela a otro agente vivo.
// «vivos»: la sesión con el latido de cada agente (conLatido), para saber quién sigue vivo; lo que se escribe es «sesion».
export function anunciarChat(roadmap, sesion, rama, hitoId, tarea, inicio, ahora = Date.now(), vivos = sesion) {
  const otro = quienLleva(vivos, ahora).get(tarea);
  if (otro && otro.clave !== CHAT + rama) throw new Error(`esa tarea ya la lleva ${otro.clave} (rama ${otro.rama})`);
  const s = marcar(roadmap, normalizar(sesion), CHAT + rama, hitoId, tarea, rama, inicio, (l, t) => l.push(t));
  return [roadmap, s];
}

export function soltar(sesion, quien, rama) {
  const s = normalizar(sesion);
  if (quien === 'chat') delete s[CHAT + rama]; else s[quien] = null;
  return s;
}

// archivos que comparten dos listas, sin los que se unen solos
export function choques(mios, otros) {
  const cuenta = (f) => !COMPARTIDOS.some(r => r.test(f));
  const yo = new Set(mios.filter(cuenta)), res = [];
  for (const [rama, fs] of Object.entries(otros)) for (const f of fs) if (yo.has(f)) res.push({ rama, archivo: f });
  return res;
}

// ---------- uso por línea de órdenes ----------
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const traer = () => { try { git('fetch', '-q', 'origin', '+refs/heads/trabajo/*:refs/remotes/origin/trabajo/*', '+refs/heads/main:refs/remotes/origin/main'); } catch (e) { /* sin red: se usa lo que haya */ } };
// fecha del último commit subido a cada rama trabajo/… (de lo que haya traído git fetch)
export function fechasRamas() {
  const res = {};
  try {
    for (const l of git('for-each-ref', '--format=%(refname:short) %(committerdate:iso-strict)', 'refs/remotes/origin/trabajo/').split('\n').filter(Boolean)) {
      const [ref, f] = l.split(' '); res[ref.replace(/^origin\//, '')] = f;
    }
  } catch (e) { /* sin git */ }
  return res;
}
// el latido de cada agente: el último commit de su rama (los avances cada 15 minutos lo mantienen vivo)
export function conLatido(sesion, ramas) {
  const s = normalizar(sesion);
  for (const [k, v] of Object.entries(s)) if (v && v.rama && ramas[v.rama]) s[k] = { ...v, ultimo: ramas[v.rama] };
  return s;
}
function ramasActivas(propia) {
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
  const [orden, a1, a2, a3, a4] = process.argv.slice(2);
  const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const escribir = (f, d) => writeFileSync(f, JSON.stringify(d, null, 1) + '\n');
  const roadmap = leer('proyecto/roadmap.json');
  let sesion = {}; try { sesion = leer('proyecto/sesion.json'); } catch (e) { /* sin archivo */ }
  const ahora = Date.now();
  if (['estado', 'elegir', 'ocupar', 'chat', 'choques'].includes(orden)) traer();
  const ramas = fechasRamas(), vivos = conLatido(sesion, ramas);
  const nombre = (a) => a.quien === 'chat' ? `chat ${a.rama}` : `carril ${a.quien}`;
  if (orden === 'estado') {
    const c = leerCarriles(vivos);
    for (const k of ['A', 'B']) console.log(`carril ${k}:`, c[k] ? `${ocupado(c[k], ahora) ? 'trabajando' : 'cortado o terminado'} · ${c[k].hito || hitoDeTarea(roadmap, c[k].tarea)} · ${c[k].tarea} · ${c[k].rama}` : 'libre');
    for (const a of leerAgentes(vivos).filter(a => a.quien === 'chat')) console.log(`${nombre(a)}: ${ocupado(a, ahora) ? 'trabajando' : 'cortado o terminado'} · ${a.hito} · ${a.tarea}`);
    const lleva = quienLleva(vivos, ahora), medias = new Set(aMedias(roadmap, vivos, ahora, ramas).map(m => m.tarea));
    for (const h of roadmap.hitos) for (const t of h.tareas || []) if (t.estado === 'en_curso') {
      const que = lleva.has(t.nombre) ? `en proceso (${nombre(lleva.get(t.nombre))})` : medias.has(t.nombre) ? `a medias (no la lleva nadie${t.rama ? '; rama ' + t.rama : ''})` : 'en curso (marcada hace poco, sin anunciar)';
      console.log(`${que}: ${h.id} · ${t.nombre.slice(0, 90)}`);
    }
    for (const [r, fs] of Object.entries(ramasActivas(null))) console.log(`rama activa ${r}: ${fs.length} archivos (${fs.slice(0, 6).join(', ')}${fs.length > 6 ? '…' : ''})`);
  } else if (orden === 'elegir') {
    const e = elegir(roadmap, vivos, a1, ahora, ramas);
    if (!e) { console.log('nada que hacer en este carril'); process.exit(2); }
    console.log(JSON.stringify(e));
  } else if (orden === 'ocupar') {
    if (!['A', 'B'].includes(a1) || !a2) { console.log('uso: ocupar A|B <rama> [inicio]'); process.exit(1); }
    const e = elegir(roadmap, vivos, a1, ahora, ramas);
    if (!e) { console.log('nada que hacer en este carril'); process.exit(2); }
    const [r2, s2] = ocupar(roadmap, sesion, a1, e, a2, a3 || new Date().toISOString());
    escribir('proyecto/roadmap.json', r2); escribir('proyecto/sesion.json', s2);
    console.log(`carril ${a1} ocupa: ${e.hito} · ${e.tarea}${e.retoma ? ` (la retoma${e.rama ? ' desde ' + e.rama : ''})` : ''}`);
  } else if (orden === 'chat') {
    if (!a1 || !a2 || !a3) { console.log('uso: chat <rama> <hito> "<tarea>" [inicio]'); process.exit(1); }
    try {
      const [r2, s2] = anunciarChat(roadmap, sesion, a1, a2, a3, a4 || new Date().toISOString(), ahora, vivos);
      escribir('proyecto/roadmap.json', r2); escribir('proyecto/sesion.json', s2);
      console.log(`chat ${a1} anuncia: ${a2} · ${a3}`);
    } catch (err) { console.log(err.message); process.exit(1); }
  } else if (orden === 'soltar') {
    if (a1 === 'chat' && !a2) { console.log('uso: soltar chat <rama>'); process.exit(1); }
    escribir('proyecto/sesion.json', soltar(sesion, a1, a2)); console.log(a1 === 'chat' ? `chat ${a2} suelta su tarea` : `carril ${a1} libre`);
  } else if (orden === 'choques') {
    const propia = a1 || git('rev-parse', '--abbrev-ref', 'HEAD');
    const mios = git('diff', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean);
    const cs = choques(mios, ramasActivas(propia));
    for (const c of cs) console.log(`CHOQUE: ${c.archivo} lo cambia también ${c.rama}`);
    if (cs.length) process.exit(1);
    console.log('sin choques con las ramas activas');
  } else { console.log('órdenes: estado | elegir A|B | ocupar A|B <rama> [inicio] | chat <rama> <hito> "<tarea>" [inicio] | choques [rama] | soltar A|B | soltar chat <rama>'); process.exit(1); }
}
