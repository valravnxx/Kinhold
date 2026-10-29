// Comprueba que todos los textos del juego (construcción, combate, prueba de estilo y visor de personaje)
// tienen traducción al inglés y al ruso.
// Uso: node pruebas/prueba_idiomas.mjs            → falla y lista los que faltan
//      node pruebas/prueba_idiomas.mjs --faltan   → escribe solo la lista de los que faltan (JSON)
//      MUTAR=1 (o MUTAR=ru) node pruebas/prueba_idiomas.mjs → quita una traducción (inglés o ruso) a propósito: tiene que fallar
// Los textos de la página fija (plantillas HTML) se comprueban en el navegador (prueba_idioma_navegador.py).
import { readFileSync } from 'fs';
import { PIEZAS, DECORACION, MATERIALES } from '../src/logica/piezas.js';
import { ARMAS, ARMADURAS, NOMBRE_LINEA, NOMBRE_ZONA } from '../src/combate/logica.js';
import { REGISTRO, VERSION } from '../src/juego/registro.js';
import { REGISTRO_COMBATE, VERSION_COMBATE } from '../src/combate/registro.js';
import { REGISTRO_ESTILO, VERSION_ESTILO } from '../src/estilo/registro.js';
import { REGISTRO_MINA, VERSION_MINA } from '../src/mina/registro.js';
import { REGISTRO_MAPA, VERSION_MAPA } from '../src/mapa/registro.js';
import { BIOMAS, ROCAS, VETAS } from '../src/logica/mapa.js';
import { REGISTRO_PERSONAJE, VERSION_PERSONAJE } from '../src/personaje/registro.js';
import { BASES, CAPAS, ANIMS, ZONAS_TABLA, GOLPES_TABLA } from '../src/personaje/textos.js';
import { PRENDAS } from '../src/logica/prendas.js';
import { PALETAS, FORMAS, PEINADOS, BARBAS } from '../src/logica/aspecto.js';
import { REGISTRO_DEMO, VERSION_DEMO } from '../src/demo/registro.js';
import { RECOLECTABLES } from '../src/logica/recoleccion.js';
import { CATALOGO as CATALOGO_REC } from '../src/logica/inventario.js';

const DICC = { en: JSON.parse(readFileSync('src/idiomas/en.json', 'utf8')), ru: JSON.parse(readFileSync('src/idiomas/ru.json', 'utf8')) };
if (process.env.MUTAR) delete DICC[process.env.MUTAR === 'ru' ? 'ru' : 'en']['Espada larga'];
const leer = (f) => readFileSync(f, 'utf8');
const textos = new Set();
const meter = (s) => { if (s && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(s)) textos.add(s); };

// 1. tablas de datos que se enseñan
for (const d of [...Object.values(PIEZAS), ...Object.values(DECORACION), ...Object.values(ARMAS), ...Object.values(ARMADURAS)]) meter(d.nombre);
for (const t of [...Object.values(MATERIALES), ...Object.values(NOMBRE_LINEA), ...Object.values(NOMBRE_ZONA)]) meter(t);
for (const t of ['leve', 'grave', 'muy grave', 'corte', 'perforante', 'contundente']) meter(t); // gravedad y tipo de herida
for (const t of [...REGISTRO, ...REGISTRO_COMBATE, VERSION, VERSION_COMBATE, ...REGISTRO_ESTILO, VERSION_ESTILO, ...REGISTRO_PERSONAJE, VERSION_PERSONAJE, ...REGISTRO_DEMO, VERSION_DEMO, ...REGISTRO_MINA, VERSION_MINA, ...REGISTRO_MAPA, VERSION_MAPA]) meter(t);
// nombres del mapa del mundo y fases de su generación
for (const d of [...Object.values(BIOMAS), ...Object.values(ROCAS), ...Object.values(VETAS)]) meter(d.nombre);
for (const m of readFileSync('src/logica/mapa.js', 'utf8').matchAll(/fase: '([^']+)'/g)) meter(m[1]);
{ const src = readFileSync('src/mapa/main.js', 'utf8');
  for (const m of src.matchAll(/'((?:gran )?(?:arroyo|río) de \{a\} m)'/g)) meter(m[1]);
  for (const m of src.matchAll(/\['\w+', '([A-ZÁÉÍÓÚ][^']+)'\]/g)) meter(m[1]); }
// opciones del visor de personaje (las de cargar.js se leen del código: el cargador necesita el navegador)
for (const t of [...Object.values(BASES), ...Object.values(CAPAS), ...Object.values(ANIMS)]) meter(t);
for (const p of Object.values(PRENDAS)) meter(p.nombre);
for (const [t] of [...ZONAS_TABLA, ...GOLPES_TABLA]) meter(t); // datos de cada prenda (lo que llevas, en el visor)
// personalización del taller (aspecto): nombres de los colores, formas, peinados y barbas
for (const p of Object.values(PALETAS)) for (const [n] of Object.values(p)) meter(n);
for (const t of [...Object.values(FORMAS), ...Object.values(PEINADOS.hombre), ...Object.values(PEINADOS.mujer), ...Object.values(BARBAS.hombre), ...Object.values(BARBAS.mujer)]) meter(t);
const cargarJs = leer('src/personajes/cargar.js');
const opciones = cargarJs.slice(cargarJs.indexOf('export const OPCIONES'), cargarJs.indexOf('export const CLIPS'));
for (const m of opciones.matchAll(/:\s*\[?'([^']+)'/g)) meter(m[1]);

// 2. textos de la lógica que llegan a la pantalla (motivos de construcción y de caer en combate)
const constr = leer('src/logica/construccion.js');
for (const m of constr.matchAll(/motivo: '([^']+)'/g)) meter(m[1]);
for (const m of leer('src/logica/acciones.js').matchAll(/motivo: '([^']+)'|return '([^']+)'/g)) meter(m[1] || m[2]);
for (const m of leer('src/logica/en_linea.js').matchAll(/motivo: '([^']+)'|\|\| '([^']+)'/g)) meter(m[1] || m[2]); // jugar en línea
for (const m of constr.slice(constr.indexOf('function motivoSinApoyo')).matchAll(/return '([^']+)'/g)) meter(m[1]);
// recoger del suelo y de las plantas: sus motivos, lo que se recoge (avisos) y el motivo de no caber en el inventario
for (const m of leer('src/logica/recoleccion.js').matchAll(/motivo: '([^']+)'/g)) meter(m[1]);
for (const d of Object.values(RECOLECTABLES)) meter(CATALOGO_REC[d.da].nombre);
for (const m of leer('src/logica/inventario.js').matchAll(/motivo: '(No te cabe[^']+)'/g)) meter(m[1]);
for (const linea of leer('src/combate/logica.js').split('\n')) if (/(this|\w+)\.caer\(/.test(linea)) for (const m of linea.matchAll(/'([A-ZÁÉÍÓÚ][^']+)'/g)) meter(m[1]);

// 3. textos.js de la construcción
for (const m of leer('src/juego/textos.js').matchAll(/:\s*'([^']+)'/g)) meter(m[1]);

// 4. todo literal dentro de tr( … ) y las opciones { nombre: '…' } de los menús
function literalesEnTr(src) {
  let i = 0;
  while ((i = src.indexOf('tr(', i)) !== -1) {
    if (/[\w.]/.test(src[i - 1] || '')) { i += 3; continue; }
    let j = i + 3, prof = 1, llaves = 0;
    while (j < src.length && prof > 0) {
      const c = src[j];
      if (c === "'") {
        const k = src.indexOf("'", j + 1);
        // un literal comparado (x === 'arco') es una condición, no un texto
        if (!llaves && !/[!=]==\s*$/.test(src.slice(Math.max(0, j - 6), j))) meter(src.slice(j + 1, k));
        j = k + 1; continue;
      }
      if (c === '(') prof++; else if (c === ')') prof--;
      else if (c === '{') llaves++; else if (c === '}') llaves--;
      j++;
    }
    i = j;
  }
}
for (const f of ['src/juego/main.js', 'src/combate/main.js', 'src/estilo/main.js', 'src/personaje/main.js', 'src/demo/main.js', 'src/demo/rendimiento.js', 'src/mina/main.js', 'src/mapa/main.js', 'src/mapa/cerca.js', 'src/juego/en_linea.js']) {
  const src = leer(f);
  literalesEnTr(src);
  // títulos y opciones de los grupos del panel del personaje: grupo('clave', valores, 'Título')
  for (const m of src.matchAll(/grupo\('\w+', ([^;]*?), '([^']+)'\)/g)) { meter(m[2]); for (const v of m[1].matchAll(/: '([^']+)'/g)) meter(v[1]); }
  for (const m of src.matchAll(/nombre: '([^']+)'/g)) meter(m[1]);
  for (const m of src.matchAll(/\['([^']+)', stats\./g)) meter(m[1]); // filas de la pantalla final
}

let fallo = false;
const todasFaltan = [];
for (const [id, D] of Object.entries(DICC)) {
  const faltan = [...textos].filter(t => D[t] === undefined);
  todasFaltan.push(...faltan.map(t => id + ': ' + t));
  // las variables {x} de cada plantilla tienen que estar también en la traducción
  const malVars = [...textos].filter(t => D[t] !== undefined && (t.match(/\{\w+\}/g) || []).sort().join() !== (D[t].match(/\{\w+\}/g) || []).sort().join());
  // el ruso tiene que estar escrito en cirílico (si no, es que se copió el español o el inglés)
  const sinCirilico = id === 'ru' ? [...textos].filter(t => D[t] !== undefined && /[A-Za-zñ]{4,}/.test(t) && !/[А-Яа-яЁё]/.test(D[t]) && !/^Kinhold|^v\d/.test(t)) : [];
  console.log(`Textos del juego: ${textos.size}; sin traducir (${id}): ${faltan.length}; con variables distintas: ${malVars.length}` + (id === 'ru' ? `; sin cirílico: ${sinCirilico.length}` : ''));
  for (const t of faltan.slice(0, 20)) console.log(`  FALTA (${id})  ` + t);
  for (const t of malVars) console.log(`  VARIABLES (${id})  ` + t);
  for (const t of sinCirilico) console.log(`  SIN CIRÍLICO  ` + t + ' → ' + D[t]);
  if (faltan.length || malVars.length || sinCirilico.length) fallo = true;
}
if (process.argv.includes('--faltan')) { console.log(JSON.stringify(todasFaltan, null, 1)); process.exit(0); }
if (fallo) process.exit(1);
console.log('TODO CORRECTO');
