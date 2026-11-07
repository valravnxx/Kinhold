// Prueba de la revisión del mundo guardado (servidor/revisar_mundo.mjs) y del aviso del servidor al arrancar
// (valravnx, 7 nov: «he muerto en el rio y se me ha borrado TODO lo que habia en mi base»).
// Ejecutar: node pruebas/prueba_revisar_mundo.mjs
// Comprueba, con una carpeta de datos hecha con acciones de verdad (un mojón, un cimiento terminado y un poste a medias,
// y una hoguera en objetos.json):
//   - con el mundo sano: cuenta las construcciones, las piezas y el puesto de la tierra, sin nada raro;
//   - si el terreno de hoy queda 2 m por encima de lo construido (un cambio del terreno con una versión nueva): dice
//     que la construcción y el puesto están enterrados, y cuánto;
//   - si una acción que salió bien ya no sale al rehacer el mundo: la cuenta, y también lo que se cae detrás;
//   - el servidor, al arrancar con ese mundo, lo avisa en su registro y sigue sin tocar el archivo.
// Con MUTAR=1, una revisión que no mira las acciones caídas ni lo enterrado: debe FALLAR.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, acabarObra } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

let ruta = join(raiz, 'servidor/revisar_mundo.mjs'), copia = null;
if (MUTAR) {
  const f = readFileSync(ruta, 'utf8');
  const m = f.replace('if (!r.ok) caidas.push(', 'if (false) caidas.push(').replace('if (peor > ENTERRADO)', 'if (false)').replace("sueloEn(e.x, e.z) - e.y > ENTERRADO", 'false');
  if (m === f) { console.log('No se pudo mutar la revisión'); process.exit(1); }
  copia = join(raiz, 'servidor/.revisar_mundo_mutado.mjs'); writeFileSync(copia, m); ruta = copia;
}
const { revisarMundo, texto } = await import(pathToFileURL(ruta).href);

// un terreno de juguete: zonas de 1 km y el suelo a la altura que se diga
const terreno = (alto) => ({ suelo: () => alto, zona: (x, z) => `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`, esZonaRey: () => false });
const A = 'jugador:ana';

// el mundo, con acciones de verdad, como lo apunta el servidor (una línea por acción, con n y ok)
ponerZonas(terreno(0).zona, terreno(0).esZonaRey);
const m = new Mundo(), reg = new RegistroAcciones();
const E = (a) => { const r = ejecutar(m, reg, a); if (!r.ok) throw new Error(`${a.tipo}: ${r.motivo}`); return r; };
E({ autor: A, tipo: 'rellenar', cantidad: 500 });
E({ autor: A, tipo: 'mojon', x: 500, z: 500 });
E({ autor: A, tipo: 'colocar', pieza: 'cim_piedra', x: 504, z: 500, k: 0, rot: 0, dir: 0, y: 0 });
const c = m.construcciones.at(-1);
{ const r = acabarObra(m, reg, A, c.id, [...c.piezas.keys()][0]); if (!r.ok) throw new Error('obra: ' + r.motivo); }
E({ autor: A, tipo: 'colocar', pieza: 'poste', x: 520, z: 500, k: 0, rot: 0, dir: 0, y: 0 });
const lineas = reg.exportar();
const piezas = m.construcciones.reduce((s, x) => s + x.piezas.size, 0);

// y una hoguera de Ana en su tierra, en objetos.json como lo guarda el servidor
const ob = new ObjetosServidor();
const datosObjetos = ob.exportar();
datosObjetos.fabricacion.estaciones = [{ id: 'e1', tipo: 'hoguera', x: 510, z: 506, y: 0, autor: A, cola: [], deposito: {} }];

const dir = mkdtempSync(join(tmpdir(), 'kinhold-revisar-'));
const poner = (ls) => writeFileSync(join(dir, 'mundo.jsonl'), ls.map(e => JSON.stringify(e)).join('\n') + '\n');
poner(lineas);
writeFileSync(join(dir, 'objetos.json'), JSON.stringify(datosObjetos));

console.log('1. El mundo sano');
{
  const inf = revisarMundo(dir, { terreno: terreno(0) });
  const t = inf.tierras.find(x => x.dueno === A);
  comprobar('rehace el mundo entero: ninguna acción caída', inf.caidas.length === 0 && inf.bien === lineas.length, `${inf.bien} de ${lineas.length}`);
  comprobar('la tierra de Ana, con sus construcciones y piezas', t && t.construcciones === m.construcciones.length && t.piezas === piezas, t ? `${t.construcciones} construcciones, ${t.piezas} piezas` : 'sin tierra');
  comprobar('y su hoguera', t && t.estaciones === 1, t ? `${t.estaciones}` : '');
  comprobar('nada enterrado ni raro', t && !t.enterradas.length && !t.estacionesEnterradas.length && !inf.raro);
}

console.log('2. El terreno de hoy, 2 m por encima de lo construido');
{
  const inf = revisarMundo(dir, { terreno: terreno(2) });
  const t = inf.tierras.find(x => x.dueno === A);
  comprobar('dice que las construcciones están enterradas, y cuánto', t && t.enterradas.length === m.construcciones.length && t.enterradas.every(e => Math.abs(e.metros - 2) < 1e-6), t ? JSON.stringify(t.enterradas) : '');
  comprobar('y el puesto', t && t.estacionesEnterradas.length === 1 && t.estacionesEnterradas[0].tipo === 'hoguera', t ? JSON.stringify(t.estacionesEnterradas) : '');
  comprobar('y lo da por raro (y el texto lo dice)', inf.raro && /ENTERRADA/.test(texto(inf)) && /ENTERRADO/.test(texto(inf)));
}

console.log('3. Una acción que salió bien y hoy ya no sale (el mojón, con datos que hoy no valen)');
{
  const malas = lineas.map(e => (e.tipo === 'mojon' ? { ...e, datos: { ...e.datos, x: 'quinientos' } } : e));
  poner(malas);
  const inf = revisarMundo(dir, { terreno: terreno(0) });
  comprobar('cuenta el mojón caído y lo que cae detrás (las obras de su tierra)', inf.caidas.length >= 2 && inf.caidas[0].tipo === 'mojon', JSON.stringify(inf.caidas.map(x => x.tipo)));
  comprobar('lo da por raro y el texto lo avisa', inf.raro && /YA NO SALEN/.test(texto(inf)));
  // el servidor, al arrancar con ese mundo: lo avisa en su registro y no toca el archivo
  const { crearServidor } = await import(pathToFileURL(join(raiz, 'servidor/servidor.mjs')).href);
  const avisos = [];
  const antes = readFileSync(join(dir, 'mundo.jsonl'), 'utf8');
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), registrar: t => avisos.push(t) });
  await s.listo;
  comprobar('el servidor lo avisa al arrancar', avisos.some(t => /AVISO: \d+ acciones que salieron bien ya no salen/.test(t)) && s.caidasAlRehacer.length === inf.caidas.length, avisos.find(t => /AVISO/.test(t)) || '');
  await s.cerrar();
  comprobar('y el archivo sigue igual (lo construido no se pierde de él)', readFileSync(join(dir, 'mundo.jsonl'), 'utf8') === antes);
}

rmSync(dir, { recursive: true, force: true });
if (copia) rmSync(copia, { force: true });
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
