// Versiones antiguas a las releases: qué se va, qué se queda y que la descarga se juega sola.
// MUTAR=1 rompe a propósito la elección (se irían también las recientes) para ver que la prueba lo caza.
import { aArchivar, paraDescargar, urlDescarga, RECIENTES, WEB } from '../herramientas/archivar_versiones.mjs';
import { readFileSync } from 'fs';

let mal = 0, bien = 0;
const comprobar = (n, ok, extra = '') => { if (ok) bien++; else { mal++; console.log(`FALLA: ${n} ${extra}`); } };
const elegir = process.env.MUTAR ? (r) => aArchivar(r, 0) : (r) => aArchivar(r);

const vs = (p, n) => Array.from({ length: n }, (_, i) => ({ v: `v${i + 1}`, archivo: `jugar/${p}/v${i + 1}.html` }));
const r = { prototipos: [
  { id: 'demo', versiones: vs('demo', 8) },
  { id: 'mina', versiones: vs('mina', 1) },
  { id: 'estilo', versiones: vs('estilo', 10) },
] };
r.prototipos[0].versiones[0].archivo = urlDescarga('demo', 'v1');
const x = elegir(r);
const de = (p) => x.filter(y => y.p === p).map(y => y.v).join(' ');
comprobar(`se quedan las ${RECIENTES} últimas y no se repite lo ya archivado`, de('demo') === 'v2 v3', de('demo'));
comprobar('un prototipo con una sola versión no pierde nada', de('mina') === '', de('mina'));
comprobar('la prueba de estilo aprobada (v5) se queda siempre', de('estilo') === 'v1 v2 v3 v4', de('estilo'));
comprobar('la descarga apunta a la release del prototipo', urlDescarga('demo', 'v2') === 'https://github.com/valravnxx/Kinhold/releases/download/jugar-demo/demo-v2.html');

const h = paraDescargar('<a href="../../index.html"></a><script>cargar("../../recursos/personajes/taller-v4/a.glb")</script>');
comprobar('la descarga carga los recursos de la web publicada', h.includes(`"${WEB}recursos/personajes/taller-v4/a.glb"`) && !h.includes('../'), h);

// con el roadmap de verdad: ninguna de las últimas versiones se va
const real = JSON.parse(readFileSync(new URL('../proyecto/roadmap.json', import.meta.url), 'utf8'));
const xr = elegir(real);
for (const p of real.prototipos) {
  const ult = p.versiones.at(-1);
  comprobar(`la última de ${p.id} se queda en la web`, !xr.some(y => y.p === p.id && y.v === ult.v));
}

console.log(`Archivar versiones: ${bien}/${bien + mal}`);
process.exit(mal ? 1 : 0);
