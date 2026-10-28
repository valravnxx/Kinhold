// Sirve la web (carpeta docs/) en este ordenador, para jugar en línea en casa sin internet de por medio.
// Uso: node herramientas/servir_web.mjs [puerto]   (por defecto 8000). Lo usa jugar_en_casa.bat.
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, normalize, extname, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const puerto = Number(process.argv[2]) || 8000;

createServer(async (pet, res) => {
  try {
    let ruta = decodeURIComponent(new URL(pet.url, 'http://x').pathname);
    let archivo = normalize(join(RAIZ, ruta));
    if (archivo !== RAIZ && !archivo.startsWith(RAIZ + sep)) { res.writeHead(403); return res.end(); }   // nada fuera de docs/
    if ((await stat(archivo)).isDirectory()) archivo = join(archivo, 'index.html');
    const datos = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(datos);
  } catch (e) { res.writeHead(404); res.end('No encontrado'); }
}).listen(puerto, () => console.log(`Web de Kinhold en el puerto ${puerto} (carpeta ${RAIZ})`));
