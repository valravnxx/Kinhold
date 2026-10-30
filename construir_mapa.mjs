// Empaqueta el visor del mapa en un único HTML, y el banco de pruebas del terreno por trozos en otro.
// El hilo aparte que hace los trozos (src/mundo/trozos_hilo.js) se empaqueta antes y va dentro como texto
// (__CODIGO_HILO_TROZOS__): el HTML sigue siendo un solo archivo.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const opciones = { bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' };
const hilo = (await build({ ...opciones, entryPoints: ['src/mundo/trozos_hilo.js'] })).outputFiles[0].text;
const define = { __CODIGO_HILO_TROZOS__: JSON.stringify(hilo) };
mkdirSync('dist', { recursive: true });
for (const [entrada, plantilla, salida] of [
  ['src/mapa/main.js', 'src/mapa/plantilla.html', 'dist/kinhold_mapa.html'],
  ['src/mapa/banco_trozos.js', 'src/mapa/banco_trozos.html', 'dist/kinhold_trozos.html'],
]) {
  const r = await build({ ...opciones, entryPoints: [entrada], define });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync(plantilla, 'utf8').replace('/*APP*/', () => js);
  writeFileSync(salida, html);
  console.log(salida, (html.length / 1024).toFixed(0), 'KB');
}
console.log('hilo de los trozos', (hilo.length / 1024).toFixed(0), 'KB');
