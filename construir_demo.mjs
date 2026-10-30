// Empaqueta la demo única (menú + construcción + duelo + personaje) en un único HTML.
// Las páginas de cada parte salen de sus plantillas de siempre (estilo y cuerpo), metidas como textos.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const parte = (archivo) => {
  const h = readFileSync(archivo, 'utf8');
  const estilo = h.match(/<style>([\s\S]*?)<\/style>/)[1];
  const cuerpo = h.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script>\/\*APP\*\/<\/script>/, '');
  return { estilo, cuerpo };
};
const PLANTILLAS = { construir: parte('src/plantilla.html'), duelo: parte('src/combate/plantilla.html'), personaje: parte('src/personaje/plantilla.html') };
const virtual = { name: 'plantillas-demo', setup(b) {
  b.onResolve({ filter: /^plantillas-demo$/ }, () => ({ path: 'plantillas-demo', namespace: 'pd' }));
  b.onLoad({ filter: /.*/, namespace: 'pd' }, () => ({ contents: JSON.stringify(PLANTILLAS), loader: 'json' }));
} };
// el código del hilo del terreno por trozos va dentro del mismo HTML (como en el mapa: construir_mapa.mjs)
const hilo = (await build({ entryPoints: ['src/mundo/trozos_hilo.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' })).outputFiles[0].text;
const r = await build({ entryPoints: ['src/demo/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', plugins: [virtual],
  define: { __CODIGO_HILO_TROZOS__: JSON.stringify(hilo) } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/demo/plantilla.html', 'utf8').replace('/*APP*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/kinhold_demo.html', html);
console.log('dist/kinhold_demo.html', (html.length / 1024).toFixed(0), 'KB');
