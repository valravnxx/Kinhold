// Genera docs/index.html (la web de progreso) a partir de proyecto/roadmap.json y proyecto/diario.json,
// y copia los documentos de diseño. Comprueba que todo lo enlazado existe.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { leerAgentes, conLatido, fechasRamas } from './carriles.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => JSON.parse(readFileSync(join(raiz, p), 'utf8'));
const roadmap = leer('proyecto/roadmap.json');
const diario = leer('proyecto/diario.json');
const docs = join(raiz, 'docs');
const errores = [];

// documentos de diseño: el español en diseno/, las traducciones en diseno/<idioma>/ (en, ru) con la huella del original
// (<meta name="kinhold-origen" content="sha1 del archivo en español">). Si el español cambia, hay que volver a traducir.
// Al copiarlos a docs/ se les pone arriba el selector ES · EN · RU.
const huella = (txt) => createHash('sha1').update(txt).digest('hex');
const IDIOMAS_DOC = ['en', 'ru'];
const selector = (f, l) => `<div id="kh-idioma" style="position:fixed;top:8px;right:8px;z-index:9;font:700 12.5px system-ui,sans-serif;display:flex;gap:4px">` +
  ['es', ...IDIOMAS_DOC].map(id => {
    const h = id === l ? f : (l === 'es' ? '' : '../') + (id === 'es' ? '' : id + '/') + f;
    return `<a data-l="${id}" href="${h}" onclick="try{localStorage.setItem('kinhold_web_idioma','${id}')}catch(e){}" style="padding:4px 9px;border-radius:8px;text-decoration:none;border:1px solid #8888;${id === l ? 'background:#c9a46a;color:#241b10' : 'background:#8882;color:inherit'}">${id.toUpperCase()}</a>`;
  }).join('') + `</div>`;
const conSelector = (html, f, l) => html.replace(/<body([^>]*)>/, (m) => m + selector(f, l));
for (const l of IDIOMAS_DOC) mkdirSync(join(docs, 'diseno', l), { recursive: true });
for (const f of readdirSync(join(raiz, 'diseno')).filter(f => f.endsWith('.html'))) {
  const es = readFileSync(join(raiz, 'diseno', f), 'utf8');
  writeFileSync(join(docs, 'diseno', f), conSelector(es, f, 'es'));
  for (const l of IDIOMAS_DOC) {
    const ruta = join(raiz, 'diseno', l, f);
    if (!existsSync(ruta)) { errores.push(`falta la traducción diseno/${l}/${f}`); continue; }
    const tr = readFileSync(ruta, 'utf8');
    const origen = (tr.match(/<meta name="kinhold-origen" content="([0-9a-f]+)">/) || [])[1];
    if (origen !== huella(es)) errores.push(`diseno/${f} ha cambiado desde que se tradujo: actualiza diseno/${l}/${f} y pon en su <meta name="kinhold-origen"> la huella ${huella(es)}`);
    writeFileSync(join(docs, 'diseno', l, f), conSelector(tr, f, l));
  }
}

// capturas por carpeta
const capturas = {};
const carpetas = new Set([...roadmap.prototipos.flatMap(p => p.versiones.map(v => v.capturas)), ...diario.map(e => e.capturas)].filter(Boolean));
for (const c of carpetas) {
  const ruta = join(docs, c);
  if (!existsSync(ruta)) { errores.push(`falta la carpeta de capturas ${c}`); continue; }
  capturas[c] = readdirSync(ruta).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
}
// las de cada cambio, primero (valravnx, 29 oct: las noticias salían con toda la batería de pruebas y las del cambio al
// final). Desde el 29 oct se publican solo las del cambio (herramientas/capturas.py pide cuáles); en las carpetas de
// antes, las que no estaban en la versión anterior del mismo prototipo van delante, y la web enseña unas pocas.
for (const c of Object.keys(capturas)) {
  const m = c.match(/^(.*)-v(\d+)$/); if (!m) continue;
  let antes = null;
  for (let n = +m[2] - 1; n > 0 && !antes; n--) if (capturas[`${m[1]}-v${n}`]) antes = new Set(capturas[`${m[1]}-v${n}`]);
  if (antes) capturas[c] = [...capturas[c].filter(f => !antes.has(f)), ...capturas[c].filter(f => antes.has(f))];
}
// versiones jugables
for (const p of roadmap.prototipos) for (const v of p.versiones)
  if (!/^https?:/.test(v.archivo) && !existsSync(join(docs, v.archivo))) errores.push(`falta la versión ${p.id} ${v.v}: ${v.archivo}`);
// estados válidos
const ESTADOS = ['hecho', 'en_curso', 'revision', 'espera_decision', 'pendiente', 'fallo'];
for (const h of roadmap.hitos) {
  if (!ESTADOS.includes(h.estado)) errores.push(`estado raro en el hito ${h.id}: ${h.estado}`);
  for (const t of h.tareas) if (!ESTADOS.includes(t.estado)) errores.push(`estado raro en la tarea "${t.nombre}": ${t.estado}`);
}
// nada de lo que enlaza la web puede estar excluido de git (si no, en GitHub Pages sale roto)
const enlazado = [...Object.keys(capturas).map(c => join('docs', c, capturas[c][0] || '')), ...roadmap.prototipos.flatMap(p => p.versiones.filter(v => !/^https?:/.test(v.archivo)).map(v => join('docs', v.archivo)))];
for (const f of enlazado) {
  try { execFileSync('git', ['check-ignore', '-q', '--no-index', f], { cwd: raiz }); errores.push(`git ignora ${f}: no llegaría a la web`); } catch (e) { /* no ignorado: bien */ }
}
// traducciones: todo texto del roadmap y del diario tiene que estar en proyecto/idiomas/en.json y ru.json
const textos = new Set();
const anade = (x) => { if (typeof x === 'string' && x.trim()) textos.add(x); };
for (const h of roadmap.hitos) { anade(h.nombre); anade(h.jugable); anade(h.nota); for (const t of h.tareas) { anade(t.nombre); anade(t.notas); } }
for (const p of roadmap.prototipos) { anade(p.nombre); anade(p.descripcion); for (const v of p.versiones) anade(v.notas); }
for (const d of roadmap.decisiones_pendientes || []) anade(d.pregunta);
for (const e of diario) { anade(e.titulo); anade(e.pruebas); for (const x of e.hecho || []) anade(x); }
const idiomas = {};
const carpetaIdiomas = join(raiz, 'proyecto/idiomas');
for (const f of existsSync(carpetaIdiomas) ? readdirSync(carpetaIdiomas).filter(f => f.endsWith('.json')) : []) {
  const id = f.slice(0, -5), dic = JSON.parse(readFileSync(join(carpetaIdiomas, f), 'utf8'));
  const faltan = [...textos].filter(t => !dic[t]);
  if (faltan.length) errores.push(`faltan ${faltan.length} traducciones en proyecto/idiomas/${f} (añade la clave en español con su traducción):\n     · ` + faltan.slice(0, 15).join('\n     · ') + (faltan.length > 15 ? '\n     · …' : ''));
  // solo se publica lo que se usa
  idiomas[id] = Object.fromEntries([...textos].filter(t => dic[t]).map(t => [t, dic[t]]));
}
if (!idiomas.en) errores.push('falta proyecto/idiomas/en.json');
if (!idiomas.ru) errores.push('falta proyecto/idiomas/ru.json');
if (errores.length) { console.error('ERRORES:\n - ' + errores.join('\n - ')); process.exit(1); }

// quién trabaja en qué: los agentes anunciados en proyecto/sesion.json, con el último commit de su rama (latido).
// La página vuelve a mirarlo en GitHub al abrirse; esto es lo que se ve si no puede.
let sesion = {};
try { sesion = leer('proyecto/sesion.json'); } catch (e) { /* sin sesiones */ }
const agentes = leerAgentes(conLatido(sesion, fechasRamas())).filter(a => a.tarea)
  .map(({ quien, clave, inicio, tarea, hito, rama, ultimo }) => ({ quien, clave, inicio, tarea, hito, rama, ultimo }));
const datos = { roadmap, diario, capturas, idiomas, agentes, generado: new Date().toISOString() };
const json = JSON.stringify(datos).replace(/</g, '\\u003c');
const html = readFileSync(join(raiz, 'herramientas/plantilla_web.html'), 'utf8').replace('/*DATOS*/null', () => json);
writeFileSync(join(docs, 'index.html'), html);
writeFileSync(join(docs, '.nojekyll'), '');
console.log('docs/index.html listo ·', roadmap.hitos.length, 'hitos ·', diario.length, 'entradas de diario ·', Object.keys(idiomas).map(k => k + ' ' + Object.keys(idiomas[k]).length + ' textos').join(', '));
