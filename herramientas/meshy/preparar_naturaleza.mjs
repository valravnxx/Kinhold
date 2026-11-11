// Prepara para el juego los modelos de naturaleza que ha devuelto Meshy (herramientas/meshy/encargo.py, acción «modelos»):
//   node herramientas/meshy/preparar_naturaleza.mjs <carpeta con los .glb de Meshy> [nombre…]
// Cada <nombre>.glb de la carpeta, con sus medidas de naturaleza_lista.json, a docs/recursos/naturaleza/meshy-v1/.
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
const [carpeta, ...solo] = process.argv.slice(2);
const lista = JSON.parse(readFileSync('herramientas/meshy/naturaleza_lista.json', 'utf8')), dest = 'docs/recursos/naturaleza/meshy-v1';
mkdirSync(dest, { recursive: true });
for (const [n, v] of Object.entries(lista)) {
  if (n === '_' || (solo.length && !solo.includes(n))) continue;
  const ent = `${carpeta}/${n}.glb`;
  if (!existsSync(ent)) { console.log('falta', ent); continue; }
  const [alto, c, m, l, op] = v;
  console.log(execFileSync('node', ['herramientas/meshy/naturaleza.mjs', ent, `${dest}/${n}.glb`, String(alto), String(c), String(m), String(l), ...op.split(' ').filter(Boolean)], { encoding: 'utf8' }).trim().split('\n').pop());
}
