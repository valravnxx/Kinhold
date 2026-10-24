// Empaqueta el juego en un único HTML que funciona sin internet.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const r = await build({
  entryPoints: ['src/juego/main.js'],
  bundle: true, minify: true, format: 'iife', write: false, target: 'es2020',
  legalComments: 'none',
});
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const plantilla = readFileSync('src/plantilla.html', 'utf8');
const html = plantilla.replace('/*APP*/', () => js);
mkdirSync('dist/publicar', { recursive: true });
writeFileSync('dist/kinhold_hito1.html', html);
console.log('dist/kinhold_hito1.html', (html.length / 1024).toFixed(0), 'KB');
// versión para publicar: sin doctype/html/head/body (los pone la plataforma)
const titulo = html.match(/<title>[\s\S]*?<\/title>/)[0];
const estilo = html.match(/<style>[\s\S]*?<\/style>/)[0];
const cuerpo = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync('dist/publicar/kinhold.html', `${titulo}\n${estilo}\n${cuerpo}`);
console.log('dist/publicar/kinhold.html listo');
