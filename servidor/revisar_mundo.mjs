// Revisar el mundo guardado del servidor, sin tocarlo (valravnx, 7 nov: «he muerto en el rio y se me ha borrado TODO lo
// que habia en mi base, la casa, lo del suelo, estaciones de trabajo, TODO»). Solo lee los archivos: se puede lanzar con
// el servidor en marcha. Dice, para cada tierra (cada mojón):
//   - cuántas construcciones y piezas tiene, y si alguna ha quedado ENTERRADA (su base, por debajo del terreno de hoy:
//     pasa si el terreno cambia con una versión nueva, como el relieve de los llanos del 7 nov);
//   - cuántos puestos de trabajo (estaciones) y cuántas cosas en el suelo hay en ella, y los puestos enterrados;
// y, del mundo entero, si al rehacerlo con el código de hoy (como hace el servidor al arrancar) se cae alguna acción que
// en su día salió bien: eso borraría lo construido después sin que el archivo lo pierda.
//
// Uso (en la máquina del servidor):  node /opt/kinhold/servidor/revisar_mundo.mjs [carpeta]   (por defecto /var/lib/kinhold)
//   --json     la salida en JSON (para las pruebas)
// Sale con código 2 si encuentra algo raro (acciones que ya no salen o cosas enterradas), 0 si no.
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Mundo, ponerZonas, centroMundo } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';

// Lo que se considera enterrado: la base más de 0,5 m por debajo del terreno de hoy (al ponerla, quedaba a ras).
export const ENTERRADO = 0.5;

const leerLineas = (f) => !existsSync(f) ? [] : readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch (e) { return []; } });

// Revisa la carpeta de datos con el terreno dado (por defecto, el de Whitholm). Devuelve el informe.
export function revisarMundo(dir, { terreno = terrenoWhitholm(), ahora = Date.now() } = {}) {
  const T = terreno;
  ponerZonas(T && T.zona, T && T.esZonaRey);   // como el servidor, antes de rehacer el mundo
  // 1. rehacer el mundo como al arrancar, mirando las acciones que salieron bien y ahora no
  const entradas = leerLineas(join(dir, 'mundo.jsonl'));
  const m = new Mundo(), reg = new RegistroAcciones();
  const caidas = [];
  let bien = 0;
  for (const e of entradas) {
    if (!e.ok) continue;
    bien++;
    const r = ejecutar(m, reg, { autor: e.autor, tipo: e.tipo, ...e.datos });
    if (!r.ok) caidas.push({ n: e.n, autor: e.autor, tipo: e.tipo, motivo: r.motivo });
  }
  // 2. los objetos (lo del suelo y los puestos de trabajo), como los lee el servidor
  const objetos = new ObjetosServidor({ terreno: T, enTierras: (a, x, z) => !!m.tierraDe(x, z) });
  let objetosMal = null;
  const fo = join(dir, 'objetos.json');
  if (existsSync(fo)) { try { objetos.importar(JSON.parse(readFileSync(fo, 'utf8')), ahora); } catch (e) { objetosMal = e && e.message; } }
  const suelo = objetos.suelo.visibles(ahora), estaciones = Object.values(objetos.fab.estaciones);
  const sueloEn = (x, z) => (T && T.suelo ? T.suelo(x, z) : 0);
  // 3. por cada tierra
  const tierras = [];
  for (const [dueno, mj] of Object.entries(m.mojones)) {
    const deEl = (x, z) => m.tierraDe(x, z) === dueno;
    const cons = m.construcciones.filter(c => deEl(c.ox, c.oz));
    let piezas = 0;
    const enterradas = [];
    for (const c of cons) {
      piezas += c.piezas.size;
      // la base de la construcción contra el terreno de hoy, bajo cada pieza de la planta baja (la más alta)
      let peor = -Infinity;
      for (const p of c.piezas.values()) { if (p.k !== 0) continue; const q = centroMundo(c, p); peor = Math.max(peor, sueloEn(q.x, q.z) - (c.oy || 0)); }
      if (peor > ENTERRADO) enterradas.push({ id: c.id, x: Math.round(c.ox), z: Math.round(c.oz), oy: +(c.oy || 0).toFixed(2), metros: +peor.toFixed(2) });
    }
    const est = estaciones.filter(e => deEl(e.x, e.z));
    const estEnterradas = est.filter(e => Number.isFinite(e.y) && sueloEn(e.x, e.z) - e.y > ENTERRADO)
      .map(e => ({ id: e.id, tipo: e.tipo, x: Math.round(e.x), z: Math.round(e.z), metros: +(sueloEn(e.x, e.z) - e.y).toFixed(2) }));
    tierras.push({ dueno, mojon: { x: Math.round(mj.x), z: Math.round(mj.z) }, construcciones: cons.length, piezas, enterradas,
      estaciones: est.length, estacionesEnterradas: estEnterradas, suelo: suelo.filter(o => deEl(o.x, o.z)).length });
  }
  const raro = caidas.length > 0 || !!objetosMal || tierras.some(t => t.enterradas.length || t.estacionesEnterradas.length);
  return { entradas: entradas.length, bien, caidas, objetosMal, construcciones: m.construcciones.length, suelo: suelo.length, estaciones: estaciones.length, tierras, raro };
}

export function texto(inf) {
  const l = [];
  l.push(`Mundo: ${inf.entradas} acciones en mundo.jsonl (${inf.bien} salieron bien); al rehacerlo hoy, ${inf.construcciones} construcciones.`);
  if (inf.caidas.length) {
    l.push(`AVISO: ${inf.caidas.length} acciones que salieron bien YA NO SALEN al rehacer el mundo con el código de hoy (lo que dependía de ellas no está):`);
    for (const c of inf.caidas.slice(0, 15)) l.push(`  n.º ${c.n} · ${c.tipo} de ${c.autor}: ${c.motivo}`);
    if (inf.caidas.length > 15) l.push(`  … y ${inf.caidas.length - 15} más`);
  } else l.push('Todas las acciones que salieron bien salen igual al rehacer el mundo.');
  if (inf.objetosMal) l.push(`AVISO: objetos.json no se puede leer (el servidor empezaría de cero): ${inf.objetosMal}`);
  l.push(`Objetos: ${inf.suelo} cosas en el suelo y ${inf.estaciones} puestos de trabajo.`);
  for (const t of inf.tierras) {
    l.push(`Tierra de ${t.dueno} (mojón en ${t.mojon.x}, ${t.mojon.z}): ${t.construcciones} construcciones (${t.piezas} piezas), ${t.estaciones} puestos, ${t.suelo} cosas en el suelo.`);
    for (const e of t.enterradas) l.push(`  ENTERRADA: la construcción ${e.id} en ${e.x}, ${e.z}, ${e.metros} m por debajo del terreno de hoy`);
    for (const e of t.estacionesEnterradas) l.push(`  ENTERRADO: el puesto ${e.tipo} (${e.id}) en ${e.x}, ${e.z}, ${e.metros} m por debajo del terreno de hoy`);
  }
  return l.join('\n');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2), json = args.includes('--json');
  const dir = resolve(args.find(a => !a.startsWith('--')) || '/var/lib/kinhold');
  if (!existsSync(join(dir, 'mundo.jsonl'))) { console.error(`En ${dir} no hay mundo.jsonl.`); process.exit(1); }
  const inf = revisarMundo(dir);
  console.log(json ? JSON.stringify(inf, null, 1) : texto(inf));
  process.exit(inf.raro ? 2 : 0);
}
void fileURLToPath;
