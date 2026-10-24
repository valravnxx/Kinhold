// Genera docs/index.html (la web de progreso) a partir de proyecto/roadmap.json y proyecto/diario.json,
// y copia los documentos de diseño. Comprueba que todo lo enlazado existe.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => JSON.parse(readFileSync(join(raiz, p), 'utf8'));
const roadmap = leer('proyecto/roadmap.json');
const diario = leer('proyecto/diario.json');
const docs = join(raiz, 'docs');
const errores = [];

// documentos de diseño
mkdirSync(join(docs, 'diseno'), { recursive: true });
for (const f of readdirSync(join(raiz, 'diseno'))) copyFileSync(join(raiz, 'diseno', f), join(docs, 'diseno', f));

// capturas por carpeta
const capturas = {};
const carpetas = new Set([...roadmap.prototipos.flatMap(p => p.versiones.map(v => v.capturas)), ...diario.map(e => e.capturas)].filter(Boolean));
for (const c of carpetas) {
  const ruta = join(docs, c);
  if (!existsSync(ruta)) { errores.push(`falta la carpeta de capturas ${c}`); continue; }
  capturas[c] = readdirSync(ruta).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
}
// versiones jugables
for (const p of roadmap.prototipos) for (const v of p.versiones)
  if (!existsSync(join(docs, v.archivo))) errores.push(`falta la versión ${p.id} ${v.v}: ${v.archivo}`);
// estados válidos
const ESTADOS = ['hecho', 'en_curso', 'revision', 'espera_decision', 'pendiente', 'fallo'];
for (const h of roadmap.hitos) {
  if (!ESTADOS.includes(h.estado)) errores.push(`estado raro en el hito ${h.id}: ${h.estado}`);
  for (const t of h.tareas) if (!ESTADOS.includes(t.estado)) errores.push(`estado raro en la tarea "${t.nombre}": ${t.estado}`);
}
// nada de lo que enlaza la web puede estar excluido de git (si no, en GitHub Pages sale roto)
const enlazado = [...Object.keys(capturas).map(c => join('docs', c, capturas[c][0] || '')), ...roadmap.prototipos.flatMap(p => p.versiones.map(v => join('docs', v.archivo)))];
for (const f of enlazado) {
  try { execFileSync('git', ['check-ignore', '-q', f], { cwd: raiz }); errores.push(`git ignora ${f}: no llegaría a la web`); } catch (e) { /* no ignorado: bien */ }
}
if (errores.length) { console.error('ERRORES:\n - ' + errores.join('\n - ')); process.exit(1); }

const datos = { roadmap, diario, capturas, generado: new Date().toISOString() };
const json = JSON.stringify(datos).replace(/</g, '\\u003c');
const html = readFileSync(join(raiz, 'herramientas/plantilla_web.html'), 'utf8').replace('/*DATOS*/null', () => json);
writeFileSync(join(docs, 'index.html'), html);
writeFileSync(join(docs, '.nojekyll'), '');
console.log('docs/index.html listo ·', roadmap.hitos.length, 'hitos ·', diario.length, 'entradas de diario');
