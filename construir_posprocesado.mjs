// Empaqueta la prueba de posprocesado y perfiles gráficos en un único HTML.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const r = await build({ entryPoints: ['src/posprocesado/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/posprocesado/plantilla.html', 'utf8').replace('/*APP*/', () => js);
mkdirSync('dist/publicar', { recursive: true });
writeFileSync('dist/kinhold_posprocesado.html', html);
const titulo = html.match(/<title>[\s\S]*?<\/title>/)[0];
const estilo = html.match(/<style>[\s\S]*?<\/style>/)[0];
const cuerpo = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync('dist/publicar/kinhold_posprocesado.html', `${titulo}\n${estilo}\n${cuerpo}`);
console.log('dist/kinhold_posprocesado.html', (html.length / 1024).toFixed(0), 'KB');
