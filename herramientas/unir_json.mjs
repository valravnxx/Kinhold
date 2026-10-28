// Une proyecto/diario.json, proyecto/idiomas/*.json y proyecto/sesion.json al fusionar ramas de varias sesiones, sin choques.
// Dos sesiones que añaden cada una su entrada al final del diario (o sus textos al final de en.json)
// chocan en git aunque no se pisen; esta herramienta une las dos listas a la manera de tres vías:
//   - lo que solo añade una rama, entra; lo que añaden las dos igual, entra una vez;
//   - lo que cambia una sola rama respecto al ancestro común, gana ese cambio; lo que quita una rama
//     sin que la otra lo cambie, se quita;
//   - si las dos cambian lo mismo de forma distinta, es un choque de verdad: no se resuelve solo.
// En el diario cada entrada se reconoce por su «inicio» y su «titulo»; en las traducciones, por la clave.
//
// Uso:
//   node herramientas/unir_json.mjs --instalar          activa la unión automática en este clon
//                                                        (git config + .gitattributes; una vez por clon)
//   node herramientas/unir_json.mjs ANCESTRO NUESTRO SUYO [RUTA]
//        (lo llama git como «merge driver»: escribe el resultado en NUESTRO; sale con 1 si hay choque,
//         y entonces deja NUESTRO sin tocar y git marca el archivo en conflicto)
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const claveDiario = (e) => `${e.inicio}|${e.titulo}`;

// Unión de tres vías de dos mapas clave→valor. Devuelve { claves: [orden], valores: Map, choques: [] }.
// Orden: el de NUESTRO, y detrás lo nuevo de SUYO en su orden.
function unirMapas(base, nuestro, suyo) {
  const valores = new Map(), choques = [];
  const claves = [...nuestro.keys(), ...[...suyo.keys()].filter((k) => !nuestro.has(k))];
  for (const k of claves) {
    const b = base.get(k), n = nuestro.get(k), s = suyo.get(k);
    const enB = base.has(k), enN = nuestro.has(k), enS = suyo.has(k);
    let r, quitar = false;
    if (enN && enS) {
      if (igual(n, s)) r = n;
      else if (enB && igual(b, n)) r = s;
      else if (enB && igual(b, s)) r = n;
      else { choques.push(k); r = n; }
    } else if (enN) { // no está en SUYO: o lo añadimos nosotros o lo quitaron ellos
      if (!enB) r = n;
      else if (igual(b, n)) quitar = true;
      else { choques.push(k); r = n; } // ellos lo quitan y nosotros lo cambiamos
    } else { // solo en SUYO
      if (!enB) r = s;
      else if (igual(b, s)) quitar = true;
      else { choques.push(k); r = s; }
    }
    if (!quitar) valores.set(k, r);
  }
  return { claves: claves.filter((k) => valores.has(k)), valores, choques };
}

const aMapaDiario = (lista) => {
  const m = new Map();
  for (const e of lista) {
    const k = claveDiario(e);
    if (m.has(k)) throw new Error(`entrada repetida en el diario: ${k}`);
    m.set(k, e);
  }
  return m;
};

// Diario: lista de entradas. base puede ser [] (archivo nuevo en las dos ramas).
export function unirDiario(base, nuestro, suyo) {
  const u = unirMapas(aMapaDiario(base), aMapaDiario(nuestro), aMapaDiario(suyo));
  // Lo nuestro queda en su orden; cada entrada nueva de la otra rama se mete por su hora de inicio
  // (detrás de la última que empezó antes o a la vez), para que el diario siga en orden de tiempo.
  const nuestras = new Set(nuestro.map(claveDiario)), resultado = [];
  for (const k of u.claves) {
    const e = u.valores.get(k);
    if (nuestras.has(k)) { resultado.push(e); continue; }
    const t = Date.parse(e.inicio);
    let i = resultado.length;
    while (i > 0 && Date.parse(resultado[i - 1].inicio) > t) i--;
    resultado.splice(i, 0, e);
  }
  return { resultado, choques: u.choques };
}

// Traducciones: objeto texto en español → traducción.
export function unirTraducciones(base, nuestro, suyo) {
  const M = (o) => new Map(Object.entries(o));
  const u = unirMapas(M(base), M(nuestro), M(suyo));
  return { resultado: Object.fromEntries(u.claves.map((k) => [k, u.valores.get(k)])), choques: u.choques };
}

// Une tres textos JSON y devuelve el texto resultante con el mismo formato que NUESTRO.
export function unirTextos(tBase, tNuestro, tSuyo) {
  const n = JSON.parse(tNuestro), s = JSON.parse(tSuyo);
  const b = tBase.trim() ? JSON.parse(tBase) : (Array.isArray(n) ? [] : {});
  if (Array.isArray(n) !== Array.isArray(s) || Array.isArray(n) !== Array.isArray(b)) throw new Error('los tres archivos no tienen la misma forma');
  const u = Array.isArray(n) ? unirDiario(b, n, s) : unirTraducciones(b, n, s);
  const sangria = (tNuestro.match(/\n( +|\t)/) || [, 1])[1];
  const texto = JSON.stringify(u.resultado, null, sangria) + (tNuestro.endsWith('\n') ? '\n' : '');
  return { texto, choques: u.choques };
}

const NOMBRE = 'kinhold-json';
// sesion.json: cada agente (A, B, «chat:<rama>») en su clave, así que se une igual que las traducciones
const ATRIBUTOS = ['proyecto/diario.json merge=kinhold-json', 'proyecto/idiomas/*.json merge=kinhold-json', 'proyecto/sesion.json merge=kinhold-json'];

function instalar(raiz) {
  const g = (...a) => execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8' });
  g('config', `merge.${NOMBRE}.name`, 'Unión del diario y las traducciones de Kinhold');
  g('config', `merge.${NOMBRE}.driver`, 'node herramientas/unir_json.mjs %O %A %B %P');
  const ruta = `${raiz}/.gitattributes`;
  const ya = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
  const faltan = ATRIBUTOS.filter((l) => !ya.split('\n').includes(l));
  if (faltan.length) writeFileSync(ruta, ya + (ya && !ya.endsWith('\n') ? '\n' : '') + faltan.join('\n') + '\n');
  console.log(`Unión automática activada en este clon (${faltan.length ? 'añadido a .gitattributes' : '.gitattributes ya estaba'}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args[0] === '--instalar') {
    instalar(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
  } else if (args.length >= 3) {
    const [O, A, B, P = A] = args;
    try {
      const { texto, choques } = unirTextos(readFileSync(O, 'utf8'), readFileSync(A, 'utf8'), readFileSync(B, 'utf8'));
      if (choques.length) {
        console.error(`unir_json: ${P}: las dos ramas cambian de forma distinta ${choques.length} elemento(s); hay que unirlos a mano:`);
        for (const c of choques) console.error('  - ' + c);
        process.exit(1);
      }
      writeFileSync(A, texto);
      console.error(`unir_json: ${P} unido sin choques.`);
    } catch (e) {
      console.error(`unir_json: ${P}: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error('Uso: node herramientas/unir_json.mjs --instalar | ANCESTRO NUESTRO SUYO [RUTA]');
    process.exit(2);
  }
}
