// Comprueba que herramientas/capturas.py publica solo las capturas del cambio (valravnx, 29 oct: las noticias salían con
// toda la batería de pruebas): sin decir cuáles no copia nada, con más de 12 tampoco, y con nombres o patrones copia
// solo esas. Uso: node pruebas/prueba_capturas.mjs   ·   MUTAR=1 usa una copia que lo copia todo: tiene que fallar.
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const tmp = mkdtempSync(join(tmpdir(), 'capt-')), origen = join(tmp, 'origen'); mkdirSync(origen);
// 20 imágenes de 1×1 (PNG válido)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==', 'base64');
for (let i = 0; i < 20; i++) writeFileSync(join(origen, `${String(i).padStart(2, '0')}_vista.png`), png);
let script = 'herramientas/capturas.py';
if (process.env.MUTAR) { mkdirSync(join(tmp, 'herramientas')); script = join(tmp, 'herramientas', 'capturas.py'); writeFileSync(script, readFileSync('herramientas/capturas.py', 'utf8').replace("if len(sys.argv) < 4:", "if False:").replace("if len(elegidas) > 12", "if False").replace("origen, nombre, pedidas = sys.argv[1], sys.argv[2], sys.argv[3:]", "origen, nombre, pedidas = sys.argv[1], sys.argv[2], sys.argv[3:] or ['*']")); }
const destino = `prueba-capturas-${process.pid}`, carpeta = join('docs', 'capturas', destino);
const correr = (...a) => { rmSync(carpeta, { recursive: true, force: true }); const r = spawnSync('python3', [script, origen, destino, ...a], { encoding: 'utf8' }); return { r, hay: existsSync(carpeta) ? readdirSync(carpeta).sort() : [] }; };
let x = correr();
comprobar('sin decir cuáles, no publica nada', x.r.status !== 0 && x.hay.length === 0, `${x.hay.length} copiadas`);
x = correr('*');
comprobar('más de 12, no publica nada', x.r.status !== 0 && x.hay.length === 0, `${x.hay.length} copiadas`);
x = correr('03_vista', '1?_vista.png');
comprobar('con nombres y patrones, solo esas (en JPG)', x.r.status === 0 && x.hay.join() === ['03_vista.jpg', ...Array.from({ length: 10 }, (_, i) => `1${i}_vista.jpg`)].join(), x.hay.join(' '));
x = correr('no_existe');
comprobar('un nombre que no está, falla', x.r.status !== 0 && x.hay.length === 0);
rmSync(carpeta, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true });
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
