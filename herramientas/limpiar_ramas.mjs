// Kinhold — borra las ramas de pruebas viejas (más de 3 horas): nube-pedido/<id>/…, pc-pedido/<id>/… y
// nube/<ejecución>-<grupo>. Lo lanza la nube al acabar cada ejecución (.github/workflows/pruebas.yml, «limpiar»).
// Antes se miraba la fecha del último commit de cada rama, una llamada por rama: con cientos de ramas tardaba unos 30
// minutos y tenía ocupada una máquina de las 20 que hay a la vez (8 nov, revisión de las pruebas). Ahora la hora sale
// del nombre: el <id> de un pedido empieza por la hora en base 36 (pruebas_nube.mjs: Date.now().toString(36) y 4 letras
// al azar), y las nube/ se miran por su ejecución, una llamada por ejecución.
// Uso (en la nube): GH_TOKEN=… GITHUB_REPOSITORY=dueño/repo node herramientas/limpiar_ramas.mjs [rama a dejar]
// Con PROBAR=1 no borra nada: dice qué borraría (y comprueba que sabe leer la hora de un id).
const REPO = process.env.GITHUB_REPOSITORY, TOKEN = process.env.GH_TOKEN, DEJAR = process.argv[2] || '';
const LIMITE = Date.now() - 3 * 3600 * 1000;
const PROBAR = process.env.PROBAR === '1';

// la hora de un id de pedido (ms), o null si no lo es
export const horaDeId = (id) => {
  if (!/^[0-9a-z]{9,}$/.test(id)) return null;
  const t = parseInt(id.slice(0, -4), 36);
  return t > 1.7e12 && t < 4e12 ? t : null;
};

async function api(ruta, metodo = 'GET') {
  const r = await fetch(`https://api.github.com/${ruta}`, { method: metodo, headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json' } });
  if (metodo === 'DELETE') return r.ok;
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${ruta}`);
  return r.json();
}

// todas las páginas de una lista
async function lista(ruta) {
  const out = [];
  for (let p = 1; p < 50; p++) { const l = (await api(`${ruta}?per_page=100&page=${p}`)) || []; out.push(...l); if (l.length < 100) break; }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = Date.now().toString(36) + 'abcd';
  if (Math.abs(horaDeId(id) - Date.now()) > 5000 || horaDeId('todos') !== null) { console.error('no sé leer la hora de un id'); process.exit(1); }
  if (!REPO || !TOKEN) { console.log('Bien (sin GITHUB_REPOSITORY ni GH_TOKEN no se borra nada).'); process.exit(0); }
  let borradas = 0;
  const borrar = async (ref) => { if (ref === `refs/heads/${DEJAR}`) return; if (PROBAR) { console.log('borraría', ref); return; } if (await api(`repos/${REPO}/git/${ref.replace(/^refs\//, '')}`, 'DELETE')) borradas++; };
  for (const prefijo of ['nube-pedido', 'pc-pedido']) {
    for (const { ref } of await lista(`repos/${REPO}/git/matching-refs/heads/${prefijo}/`)) {
      const t = horaDeId(ref.split('/')[3] || '');
      if (t !== null && t < LIMITE) await borrar(ref);
    }
  }
  const porEjecucion = new Map();
  for (const { ref } of await lista(`repos/${REPO}/git/matching-refs/heads/nube/`)) {
    const run = (ref.split('/')[3] || '').split('-')[0];
    if (!/^\d+$/.test(run)) continue;
    if (!porEjecucion.has(run)) porEjecucion.set(run, []);
    porEjecucion.get(run).push(ref);
  }
  for (const [run, refs] of porEjecucion) {
    const r = await api(`repos/${REPO}/actions/runs/${run}`);
    if (r && new Date(r.created_at).getTime() >= LIMITE) continue;
    for (const ref of refs) await borrar(ref);
  }
  console.log(`${borradas} ramas borradas (${porEjecucion.size} ejecuciones con ramas nube/)`);
}
