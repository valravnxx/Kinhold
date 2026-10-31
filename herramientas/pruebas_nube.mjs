// Pasa todas las pruebas fuera de esta máquina (GitHub Actions, .github/workflows/pruebas.yml): primero mira si el PC
// de valravnx está encendido para pruebas (herramientas/pc_grafica/: su tarjeta gráfica, solo cuando él lo permite;
// lo pidió el 31 oct) y, si lo está, los grupos de navegador van allí; si no, o si lo apaga a medias, a la nube, cada
// grupo en su máquina y a la vez. «logica» va siempre a la nube (no necesita tarjeta). Sube la rama actual si hace falta,
// espera, trae las capturas (en JPG) y la salida de cada grupo a /tmp/kinhold_capturas/ (como probar_todo.sh) y dice qué
// ha fallado. Sale con error si algo falla.
// Uso: node herramientas/pruebas_nube.mjs                       todos los grupos
//      node herramientas/pruebas_nube.mjs cavar web             solo esos grupos (bash herramientas/probar_todo.sh --grupos)
//      SIN_TRAER=1 node herramientas/pruebas_nube.mjs           sin traer capturas
//      SOLO_NUBE=1 node herramientas/pruebas_nube.mjs           sin mirar el PC de valravnx
// Lo lanza la subida de una rama nube-pedido/<id>/<grupos> (la nube) o pc-pedido/<id>/<grupos> (su PC); esas ramas y las
// nube/ que devuelven los grupos las borra la propia nube (desde las sesiones no se pueden borrar ramas). Hace falta gh
// con permiso sobre el repositorio (lo tienen las sesiones).
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REPO = 'valravnxx/Kinhold';
const C = '/tmp/kinhold_capturas';
const ESPERA_PC = 45;          // s que se le dan al PC, después de la lista de grupos, para coger el primero
const PARADO_PC = 4 * 60;      // s sin ningún grupo en marcha en el PC (con grupos esperando) para darlo por apagado
const sh = (c, a, o = {}) => execFileSync(c, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...o }).trim();
const gh = (...a) => JSON.parse(sh('gh', ['api', ...a]) || 'null');
const dormir = (s) => new Promise(r => setTimeout(r, s * 1000));
const min = (a, b) => ((new Date(b) - new Date(a)) / 60000).toFixed(1);
const ahora = () => Date.now();

const rama = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (rama === 'HEAD') { console.error('No estás en ninguna rama.'); process.exit(2); }
if (sh('git', ['status', '--porcelain', '--untracked-files=no'])) console.log('Aviso: hay cambios sin commit; fuera se prueba lo subido.');
sh('git', ['push', '-q', 'origin', `HEAD:refs/heads/${rama}`]);
const sha = sh('git', ['rev-parse', 'HEAD']);
if (!sh('git', ['ls-tree', 'HEAD', '.github/workflows/pruebas.yml'])) { console.error('Esta rama no tiene .github/workflows/pruebas.yml: une main primero.'); process.exit(2); }

const todos = JSON.parse(sh('bash', ['herramientas/probar_todo.sh', '--grupos']));
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : todos;
const alPC = process.env.SOLO_NUBE ? [] : pedidos.filter(g => g !== 'logica');
const aNube = pedidos.filter(g => !alPC.includes(g));
console.log(`Pruebas de ${rama} (${sha.slice(0, 7)})${process.argv.length > 2 ? ': ' + pedidos.join(', ') : ''}`);

// sube la rama del pedido y encuentra su ejecución. Los grupos van en el nombre de la rama: si no caben (GitHub no
// acepta nombres de más de 255 letras; pasaba al repetir en la nube lo que no volvía del PC), van en varios pedidos.
const LARGO_MAX = 150;
async function lanzar(donde, grupos) {
  const enTodos = donde === 'pc' ? todos.filter(g => g !== 'logica') : todos;
  if (grupos.length === enTodos.length && enTodos.every(g => grupos.includes(g))) return [await lanzarUno(donde, grupos)];
  const tandas = [[]];
  for (const g of grupos) {
    const t = tandas[tandas.length - 1];
    if (t.length && [...t, g].join('+').length > LARGO_MAX) tandas.push([g]); else t.push(g);
  }
  const r = [];
  for (const t of tandas) r.push(await lanzarUno(donde, t));
  return r;
}
async function lanzarUno(donde, grupos) {
  const id = `${ahora().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const enTodos = donde === 'pc' ? todos.filter(g => g !== 'logica') : todos;
  const nombre = grupos.length === enTodos.length && enTodos.every(g => grupos.includes(g)) ? 'todos' : grupos.join('+');
  const pedido = `${donde === 'pc' ? 'pc' : 'nube'}-pedido/${id}/${nombre}`;
  sh('git', ['push', '-q', 'origin', `HEAD:refs/heads/${pedido}`]);
  let run = null;
  for (let i = 0; i < 40 && !run; i++) {
    await dormir(6);
    const r = gh(`repos/${REPO}/actions/runs?branch=${encodeURIComponent(pedido)}&per_page=5`);
    run = r.workflow_runs.find(w => w.head_branch === pedido);
  }
  if (!run) { console.error(`No aparece la ejecución de ${pedido} en GitHub.`); process.exit(2); }
  if (run.head_sha !== sha) console.log(`Aviso: la ejecución prueba ${run.head_sha.slice(0, 7)}, no ${sha.slice(0, 7)}.`);
  console.log(`${donde === 'pc' ? 'En el PC de valravnx' : 'En la nube'}: ${grupos.join(', ')}\n  ejecución ${run.id}: ${run.html_url}`);
  return { donde, grupos: [...grupos], run, inicio: ahora(), listaHecha: null, aceptado: false, ultimo: ahora(), dejado: false, vistos: new Set() };
}
const cancelar = (e) => { try { sh('gh', ['api', '-X', 'POST', `repos/${REPO}/actions/runs/${e.run.id}/cancel`]); } catch {} e.dejado = true; };
const ramasDe = (runId) => sh('git', ['ls-remote', 'origin', `refs/heads/nube/${runId}-*`]).split('\n').filter(Boolean).map(l => l.split('\t')[1]);

const resultado = new Map();   // grupo → { bien, min, donde }
const ejecuciones = [];
if (alPC.length) ejecuciones.push(...await lanzar('pc', alPC));
if (aNube.length) ejecuciones.push(...await lanzar('nube', aNube));

for (;;) {
  const activas = ejecuciones.filter(e => !e.dejado && !e.terminada);
  if (!activas.length) break;
  await dormir(activas.some(e => e.donde === 'pc' && !e.aceptado) ? 10 : 30);
  for (const e of activas) {
    let jobs;
    try { jobs = gh(`repos/${REPO}/actions/runs/${e.run.id}/jobs?per_page=100`).jobs; } catch { continue; }
    const lista = jobs.find(j => j.name === 'lista');
    const grupos = jobs.filter(j => !['lista', 'limpiar'].includes(j.name));
    if (lista?.status === 'completed' && !e.listaHecha) e.listaHecha = ahora();
    let nuevos = 0;
    for (const j of grupos) if (j.status === 'completed' && !e.vistos.has(j.name)) {
      e.vistos.add(j.name); nuevos++;
      resultado.set(j.name, { bien: j.conclusion === 'success', min: min(j.started_at, j.completed_at), donde: e.donde, conclusion: j.conclusion });
      console.log(`  ${j.conclusion === 'success' ? 'bien ' : 'FALLA'} ${j.name} (${min(j.started_at, j.completed_at)} min${e.donde === 'pc' ? ', en el PC' : ''})`);
    }
    if (e.donde === 'pc') {
      const enMarcha = grupos.some(j => j.status === 'in_progress');
      if (enMarcha || nuevos) e.ultimo = ahora();
      if (!e.aceptado && (enMarcha || e.vistos.size)) { e.aceptado = true; console.log('  El PC de valravnx está encendido: los grupos van en su tarjeta gráfica.'); }
      const esperando = grupos.filter(j => j.status === 'queued' || j.status === 'waiting');
      // no lo coge: apagado (o ocupado con las pruebas de otra sesión)
      if (!e.aceptado && e.listaHecha && ahora() - e.listaHecha > ESPERA_PC * 1000) {
        cancelar(e);
        console.log('  El PC de valravnx no está encendido para pruebas (o está ocupado): todo a la nube.');
        ejecuciones.push(...await lanzar('nube', e.grupos));
        continue;
      }
      // lo ha apagado a medias: lo que falta, a la nube
      if (e.aceptado && !enMarcha && esperando.length && ahora() - e.ultimo > PARADO_PC * 1000) {
        cancelar(e);
        // (también los que se cortaron al apagarlo: acaban sin devolver su resumen)
        const devueltos = new Set(ramasDe(e.run.id).map(r => r.slice(`refs/heads/nube/${e.run.id}-`.length)));
        const faltan = e.grupos.filter(g => !devueltos.has(g));
        for (const g of faltan) resultado.delete(g);
        console.log(`  El PC de valravnx se ha apagado: ${faltan.join(', ')}, a la nube.`);
        ejecuciones.push(...await lanzar('nube', faltan));
        continue;
      }
    }
    try { e.run = gh(`repos/${REPO}/actions/runs/${e.run.id}`); } catch {}
    // terminada cuando han acabado todos sus grupos (no se espera a «limpiar», que borra las ramas viejas)
    e.terminada = e.run.status === 'completed' || (lista?.status === 'completed' && grupos.length > 0 && grupos.every(j => j.status === 'completed'));
    // el PC ha terminado: los grupos sin su resumen (se cortaron, o no llegó a la tarjeta), otra vez en la nube
    if (e.donde === 'pc' && e.terminada && !e.repasado) {
      e.repasado = true;
      const devueltos = new Set(ramasDe(e.run.id).map(r => r.slice(`refs/heads/nube/${e.run.id}-`.length)));
      const sinResumen = e.grupos.filter(g => !devueltos.has(g));
      if (sinResumen.length) {
        console.log(`  Del PC no han vuelto ${sinResumen.join(', ')}: otra vez en la nube.`);
        for (const g of sinResumen) resultado.delete(g);
        ejecuciones.push(...await lanzar('nube', sinResumen));
      }
    }
  }
}

// trae lo que devolvió cada grupo por su rama nube/<ejecución>-<grupo> (si un grupo se hizo dos veces, vale la última)
if (!process.env.SIN_TRAER) {
  rmSync(C, { recursive: true, force: true }); mkdirSync(C, { recursive: true });
  let n = 0;
  for (const e of ejecuciones) {
    const refs = ramasDe(e.run.id);
    if (!refs.length) continue;
    sh('git', ['fetch', '-q', 'origin', ...refs.map(r => `+${r}:refs/nube/${r.slice(16)}`)]);
    for (const r of refs) {
      const local = `refs/nube/${r.slice(16)}`;
      execFileSync('bash', ['-c', `git archive ${local} | tar -x -C ${C}`]);
      sh('git', ['update-ref', '-d', local]); n++;
    }
  }
  console.log(`Capturas y salida en ${C}/ (${n} grupos)`);
  for (const [g, r] of resultado) if (!r.bien) {
    const f = join(C, `resumen_${g}.txt`);
    console.log(`\n---- ${g}: ${r.conclusion}${r.donde === 'pc' ? ' (en el PC)' : ''}`);
    if (existsSync(f)) console.log(readFileSync(f, 'utf8').split('\n').filter(l => /FALLA|Error|error|Traceback|tardó/.test(l)).slice(0, 30).join('\n'));
    const s = join(C, `salida_${g}`);
    if (existsSync(s)) for (const x of readdirSync(s)) {
      const t = readFileSync(join(s, x), 'utf8');
      if (/FALLA|Traceback|Error:/.test(t)) console.log(`  (${x})\n` + t.split('\n').filter(l => /FALLA|Error|Traceback/.test(l)).slice(0, 15).join('\n'));
    }
  }
}
const faltan = pedidos.filter(g => !resultado.has(g));
const malos = [...resultado].filter(([, r]) => !r.bien).map(([g]) => g).concat(faltan);
const enPC = [...resultado.values()].filter(r => r.donde === 'pc').length;
const total = (ahora() - Math.min(...ejecuciones.map(e => e.inicio))) / 60000;
if (faltan.length) console.log(`Sin resultado: ${faltan.join(', ')}`);
console.log(`\n${malos.length ? 'HAY FALLOS: ' + malos.join(', ') : 'TODO CORRECTO'} · ${resultado.size} grupos${enPC ? ` (${enPC} en el PC de valravnx)` : ''} · ${total.toFixed(1)} min en total`);
process.exit(malos.length ? 1 : 0);
