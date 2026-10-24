// Publica una versión jugable en la web sin borrar las anteriores.
// Uso: node herramientas/publicar_version.mjs <prototipo> <version> <html_construido> "<notas>" [carpeta_capturas]
// Ejemplo: node herramientas/publicar_version.mjs combate v3 dist/kinhold_combate.html "Cámara táctil con un dedo" capturas/combate-v3
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, v, archivo, notas = '', capt = null] = process.argv.slice(2);
if (!id || !v || !archivo) { console.error('Uso: publicar_version.mjs <prototipo> <version> <html> "<notas>" [capturas]'); process.exit(1); }
const dest = `jugar/${id}/${v}.html`;
if (existsSync(join(raiz, 'docs', dest))) { console.error(`Ya existe ${dest}: usa otra versión, las publicadas no se sobrescriben.`); process.exit(1); }
mkdirSync(join(raiz, 'docs/jugar', id), { recursive: true });
copyFileSync(join(raiz, archivo), join(raiz, 'docs', dest));
// la última versión también en jugar/<id>/ (enlace fijo)
copyFileSync(join(raiz, archivo), join(raiz, 'docs/jugar', id, 'index.html'));
const p = join(raiz, 'proyecto/roadmap.json');
const r = JSON.parse(readFileSync(p, 'utf8'));
let proto = r.prototipos.find(x => x.id === id);
if (!proto) { proto = { id, nombre: id, descripcion: '', versiones: [] }; r.prototipos.push(proto); }
proto.versiones.push({ v, fecha: new Date().toISOString().slice(0, 10), archivo: dest, capturas: capt, notas });
writeFileSync(p, JSON.stringify(r, null, 1));
console.log('publicada', dest);
