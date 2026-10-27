// Empaqueta el visor del mapa en un único HTML.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const r = await build({ entryPoints: ['src/mapa/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/mapa/plantilla.html', 'utf8').replace('/*APP*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/kinhold_mapa.html', html);
console.log('dist/kinhold_mapa.html', (html.length / 1024).toFixed(0), 'KB');
