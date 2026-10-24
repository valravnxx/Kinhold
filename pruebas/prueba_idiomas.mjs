// Comprueba que todos los textos del juego (construcción y combate) tienen traducción al inglés.
// Uso: node pruebas/prueba_idiomas.mjs            → falla y lista los que faltan
//      node pruebas/prueba_idiomas.mjs --faltan   → escribe solo la lista de los que faltan (JSON)
//      MUTAR=1 node pruebas/prueba_idiomas.mjs    → quita una traducción a propósito: tiene que fallar
// Los textos de la página fija (plantillas HTML) se comprueban en el navegador (prueba_idioma_navegador.py).
import { readFileSync } from 'fs';
import { PIEZAS, DECORACION, MATERIALES } from '../src/logica/piezas.js';
import { ARMAS, ARMADURAS, NOMBRE_LINEA, NOMBRE_ZONA } from '../src/combate/logica.js';
import { REGISTRO, VERSION } from '../src/juego/registro.js';
import { REGISTRO_COMBATE, VERSION_COMBATE } from '../src/combate/registro.js';

const EN = JSON.parse(readFileSync('src/idiomas/en.json', 'utf8'));
if (process.env.MUTAR) delete EN['Espada larga'];
const leer = (f) => readFileSync(f, 'utf8');
const textos = new Set();
const meter = (s) => { if (s && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(s)) textos.add(s); };

// 1. tablas de datos que se enseñan
for (const d of [...Object.values(PIEZAS), ...Object.values(DECORACION), ...Object.values(ARMAS), ...Object.values(ARMADURAS)]) meter(d.nombre);
for (const t of [...Object.values(MATERIALES), ...Object.values(NOMBRE_LINEA), ...Object.values(NOMBRE_ZONA)]) meter(t);
for (const t of ['leve', 'grave', 'muy grave', 'corte', 'perforante', 'contundente']) meter(t); // gravedad y tipo de herida
for (const t of [...REGISTRO, ...REGISTRO_COMBATE, VERSION, VERSION_COMBATE]) meter(t);

// 2. textos de la lógica que llegan a la pantalla (motivos de construcción y de caer en combate)
const constr = leer('src/logica/construccion.js');
for (const m of constr.matchAll(/motivo: '([^']+)'/g)) meter(m[1]);
for (const m of constr.slice(constr.indexOf('function motivoSinApoyo')).matchAll(/return '([^']+)'/g)) meter(m[1]);
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
for (const f of ['src/juego/main.js', 'src/combate/main.js']) {
  const src = leer(f);
  literalesEnTr(src);
  for (const m of src.matchAll(/nombre: '([^']+)'/g)) meter(m[1]);
  for (const m of src.matchAll(/\['([^']+)', stats\./g)) meter(m[1]); // filas de la pantalla final
}

const faltan = [...textos].filter(t => EN[t] === undefined);
if (process.argv.includes('--faltan')) { console.log(JSON.stringify(faltan, null, 1)); process.exit(0); }
// las variables {x} de cada plantilla tienen que estar también en la traducción
const malVars = [...textos].filter(t => EN[t] !== undefined && (t.match(/\{\w+\}/g) || []).sort().join() !== (EN[t].match(/\{\w+\}/g) || []).sort().join());
console.log(`Textos del juego: ${textos.size}; sin traducir al inglés: ${faltan.length}; con variables distintas: ${malVars.length}`);
for (const t of faltan.slice(0, 20)) console.log('  FALTA  ' + t);
for (const t of malVars) console.log('  VARIABLES  ' + t);
if (faltan.length || malVars.length) process.exit(1);
console.log('TODO CORRECTO');
