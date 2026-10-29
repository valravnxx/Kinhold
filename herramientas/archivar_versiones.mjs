// Versiones jugables antiguas a las «releases» de GitHub, sin perder ninguna (lo decidió valravnx el 29 oct: la web
// por debajo de 1 GB). En la web se quedan las RECIENTES últimas de cada prototipo; las demás se pueden descargar de
// la release «jugar-<prototipo>» como <prototipo>-vN.html, y el selector de versiones de la web enlaza esa descarga.
// El archivo descargado se juega tal cual: sus rutas relativas (../../recursos/…, ../../index.html) se cambian por
// las de la web publicada, y los recursos publicados nunca se borran.
//
// Tres pasos (las releases no se pueden crear desde las sesiones, solo desde una acción de GitHub):
//   node herramientas/archivar_versiones.mjs           lista lo que pasaría a las releases y cuánto pesa
//   (acción «releases» en GitHub, botón «Run workflow»: .github/workflows/releases.yml ejecuta el paso «subir»)
//   node herramientas/archivar_versiones.mjs quitar    comprueba en GitHub que cada versión está en su release y solo
//                                                      entonces la quita de docs/ y apunta el roadmap a la descarga;
//                                                      después, node herramientas/construir_web.mjs
// Nunca se sobrescribe un archivo ya subido a una release.
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, statSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const RECIENTES = 5;
// versiones que se quedan siempre en la web: la prueba de estilo aprobada, referencia de todo lo que se ve
export const FIJAS = { estilo: ['v5'] };
export const REPO = 'valravnxx/Kinhold';
export const WEB = 'https://valravnxx.github.io/Kinhold/';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const rutaRoadmap = join(raiz, 'proyecto', 'roadmap.json');

export const etiqueta = (p) => `jugar-${p}`;
export const nombreAsset = (p, v) => `${p}-${v}.html`;
export const urlDescarga = (p, v) => `https://github.com/${REPO}/releases/download/${etiqueta(p)}/${nombreAsset(p, v)}`;
// las rutas relativas a la web pasan a ser absolutas, para que la versión descargada cargue los personajes
export const paraDescargar = (html) => html.replaceAll('../../', WEB);

// versiones que se van: todas menos las RECIENTES últimas de cada prototipo y las que ya están en una release
export function aArchivar(roadmap, recientes = RECIENTES) {
  const r = [];
  for (const p of roadmap.prototipos) {
    const vs = p.versiones.slice(0, Math.max(0, p.versiones.length - recientes));
    for (const v of vs) if (!/^https?:/.test(v.archivo) && !(FIJAS[p.id] || []).includes(v.v)) r.push({ p: p.id, v: v.v, archivo: v.archivo });
  }
  return r;
}

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }).trim();
const assetsDe = (tag) => {
  try { return new Set(JSON.parse(gh('api', `repos/${REPO}/releases/tags/${tag}`)).assets.map(a => a.name)); } catch { return null; }
};

function lista(roadmap) {
  const xs = aArchivar(roadmap);
  let total = 0;
  for (const x of xs) { const f = join(raiz, 'docs', x.archivo); if (existsSync(f)) total += statSync(f).size; }
  const porP = {};
  for (const x of xs) (porP[x.p] ||= []).push(x.v);
  for (const [p, vs] of Object.entries(porP)) console.log(`${p}: ${vs.join(' ')}`);
  console.log(`${xs.length} versiones, ${(total / 2 ** 20).toFixed(0)} MB (se quedan en la web las ${RECIENTES} últimas de cada prototipo)`);
}

// en la acción de GitHub: crea las releases que falten y sube lo que falte, sin sobrescribir nada
function subir(roadmap) {
  const tmp = join(raiz, '.releases');
  mkdirSync(tmp, { recursive: true });
  const porP = {};
  for (const x of aArchivar(roadmap)) (porP[x.p] ||= []).push(x);
  let subidas = 0;
  for (const [p, xs] of Object.entries(porP)) {
    const tag = etiqueta(p);
    let hay = assetsDe(tag);
    if (!hay) {
      const nombre = roadmap.prototipos.find(q => q.id === p).nombre;
      gh('release', 'create', tag, '--repo', REPO, '--target', 'main', '--title', `Kinhold · ${nombre}: versiones antiguas`,
        '--notes', `Versiones jugables antiguas de «${nombre}», para descargar y abrir en el navegador. Las recientes se juegan en ${WEB}`);
      hay = new Set();
    }
    for (const x of xs) {
      const n = nombreAsset(p, x.v);
      if (hay.has(n)) continue;
      const f = join(tmp, n);
      writeFileSync(f, paraDescargar(readFileSync(join(raiz, 'docs', x.archivo), 'utf8')));
      gh('release', 'upload', tag, f, '--repo', REPO);
      subidas++;
      console.log(`subida ${tag}/${n}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${subidas} versiones subidas`);
}

// en una sesión, después de la acción: quita de docs/ solo lo que ya está en su release
function quitar(roadmap) {
  const xs = aArchivar(roadmap);
  const assets = {};
  let quitadas = 0, faltan = 0;
  for (const x of xs) {
    const tag = etiqueta(x.p);
    if (!(tag in assets)) assets[tag] = assetsDe(tag) || new Set();
    if (!assets[tag].has(nombreAsset(x.p, x.v))) { faltan++; console.log(`no está en la release (se queda): ${x.p} ${x.v}`); continue; }
    const v = roadmap.prototipos.find(q => q.id === x.p).versiones.find(w => w.v === x.v);
    v.archivo = urlDescarga(x.p, x.v);
    const f = join(raiz, 'docs', x.archivo);
    if (existsSync(f)) rmSync(f);
    quitadas++;
  }
  writeFileSync(rutaRoadmap, JSON.stringify(roadmap, null, 1) + '\n');
  console.log(`${quitadas} versiones quitadas de docs/ (en sus releases)${faltan ? `; ${faltan} no estaban en su release y se quedan` : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const roadmap = JSON.parse(readFileSync(rutaRoadmap, 'utf8'));
  const orden = process.argv[2] || 'lista';
  if (orden === 'lista') lista(roadmap);
  else if (orden === 'subir') subir(roadmap);
  else if (orden === 'quitar') quitar(roadmap);
  else { console.error('Uso: node herramientas/archivar_versiones.mjs [lista|subir|quitar]'); process.exit(2); }
}
