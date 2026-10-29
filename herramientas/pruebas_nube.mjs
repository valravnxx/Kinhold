// Pasa todas las pruebas en la nube (GitHub Actions, .github/workflows/pruebas.yml): cada grupo en su máquina, a la vez.
// Sube la rama actual si hace falta, lanza las pruebas sobre ella, espera, trae las capturas (en JPG) y la salida de
// cada grupo a /tmp/kinhold_capturas/ (como probar_todo.sh) y dice qué ha fallado. Sale con error si algo falla.
// Uso: node herramientas/pruebas_nube.mjs                       todos los grupos
//      node herramientas/pruebas_nube.mjs cavar web             solo esos grupos (bash herramientas/probar_todo.sh --grupos)
//      SIN_TRAER=1 node herramientas/pruebas_nube.mjs           sin traer capturas
// Lo lanza la subida de una rama nube-pedido/<id>/<grupos>; esa rama y las nube/ que devuelven los grupos las borra la
// propia nube (desde las sesiones no se pueden borrar ramas). Hace falta gh con permiso sobre el repositorio (lo tienen las sesiones).
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REPO = 'valravnxx/Kinhold';
const C = '/tmp/kinhold_capturas';
const sh = (c, a, o = {}) => execFileSync(c, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...o }).trim();
const gh = (...a) => JSON.parse(sh('gh', ['api', ...a]) || 'null');
const dormir = (s) => new Promise(r => setTimeout(r, s * 1000));
const min = (a, b) => ((new Date(b) - new Date(a)) / 60000).toFixed(1);

const rama = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (rama === 'HEAD') { console.error('No estás en ninguna rama.'); process.exit(2); }
if (sh('git', ['status', '--porcelain', '--untracked-files=no'])) console.log('Aviso: hay cambios sin commit; en la nube se prueba lo subido.');
sh('git', ['push', '-q', 'origin', `HEAD:refs/heads/${rama}`]);
const sha = sh('git', ['rev-parse', 'HEAD']);
if (!sh('git', ['ls-tree', 'HEAD', '.github/workflows/pruebas.yml'])) { console.error('Esta rama no tiene .github/workflows/pruebas.yml: une main primero.'); process.exit(2); }
const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const grupos = process.argv.slice(2);
const pedido = `nube-pedido/${id}/${grupos.length ? grupos.join('+') : 'todos'}`;
sh('git', ['push', '-q', 'origin', `HEAD:refs/heads/${pedido}`]);
console.log(`Pruebas en la nube de ${rama} (${sha.slice(0, 7)})${grupos.length ? ': ' + grupos.join(', ') : ''}`);

let run = null;
for (let i = 0; i < 40 && !run; i++) {
  await dormir(6);
  const r = gh(`repos/${REPO}/actions/runs?branch=${encodeURIComponent(pedido)}&per_page=5`);
  run = r.workflow_runs.find(w => w.head_branch === pedido);
}
if (!run) { console.error('No aparece la ejecución en GitHub.'); process.exit(2); }
console.log(`Ejecución ${run.id}: ${run.html_url}`);
if (run.head_sha !== sha) console.log(`Aviso: la ejecución prueba ${run.head_sha.slice(0, 7)}, no ${sha.slice(0, 7)}.`);

// espera, contando cada grupo al terminar
const vistos = new Set();
for (;;) {
  await dormir(30);
  let jobs;
  try { jobs = gh(`repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`).jobs; } catch { continue; }
  for (const j of jobs) if (j.status === 'completed' && !['lista', 'limpiar'].includes(j.name) && !vistos.has(j.name)) {
    vistos.add(j.name);
    console.log(`  ${j.conclusion === 'success' ? 'bien ' : 'FALLA'} ${j.name} (${min(j.started_at, j.completed_at)} min)`);
  }
  run = gh(`repos/${REPO}/actions/runs/${run.id}`);
  if (run.status === 'completed') break;
}
const jobs = gh(`repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`).jobs.filter(j => !['lista', 'limpiar'].includes(j.name));
const malos = jobs.filter(j => j.conclusion !== 'success');
if (!jobs.length) console.log('Ningún grupo ha llegado a arrancar (¿falló la lista?).');

// trae lo que devolvió cada grupo por su rama nube/<ejecución>-<grupo>, y borra esas ramas
if (!process.env.SIN_TRAER) {
  rmSync(C, { recursive: true, force: true }); mkdirSync(C, { recursive: true });
  const refs = sh('git', ['ls-remote', 'origin', `refs/heads/nube/${run.id}-*`]).split('\n').filter(Boolean).map(l => l.split('\t')[1]);
  if (refs.length) {
    sh('git', ['fetch', '-q', 'origin', ...refs.map(r => `+${r}:refs/nube/${r.slice(16)}`)]);
    for (const r of refs) {
      const local = `refs/nube/${r.slice(16)}`;
      execFileSync('bash', ['-c', `git archive ${local} | tar -x -C ${C}`]);
      sh('git', ['update-ref', '-d', local]);
    }
  }
  console.log(`Capturas y salida en ${C}/ (${refs.length} grupos)`);
  for (const j of malos) {
    const f = join(C, `resumen_${j.name}.txt`);
    console.log(`\n---- ${j.name}: ${j.conclusion}`);
    if (existsSync(f)) console.log(readFileSync(f, 'utf8').split('\n').filter(l => /FALLA|Error|error|Traceback|tardó/.test(l)).slice(0, 30).join('\n'));
    const s = join(C, `salida_${j.name}`);
    if (existsSync(s)) for (const x of readdirSync(s)) {
      const t = readFileSync(join(s, x), 'utf8');
      if (/FALLA|Traceback|Error:/.test(t)) console.log(`  (${x})\n` + t.split('\n').filter(l => /FALLA|Error|Traceback/.test(l)).slice(0, 15).join('\n'));
    }
  }
}
const total = jobs.length ? Math.max(...jobs.map(j => new Date(j.completed_at))) - new Date(run.run_started_at || run.created_at) : 0;
console.log(`\n${malos.length ? 'HAY FALLOS: ' + malos.map(j => j.name).join(', ') : 'TODO CORRECTO'} · ${jobs.length} grupos · ${(total / 60000).toFixed(1)} min en total`);
process.exit(malos.length ? 1 : 0);
