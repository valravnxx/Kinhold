// Comprueba en los personajes del taller que cada cinturón ciñe su prenda y no se estira hasta los brazos
// (en taller-v4 y v5 el de la cota llegaba a los brazos: los rayos que miden el contorno chocaban con las mangas).
// Mide, a la altura del cinturón, el ancho del cuerpo de la prenda y lo compara con el del cinturón.
// Uso: node pruebas/prueba_cinturones.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v5, que tiene el fallo: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v5` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const puntos = (m) => { const r = []; for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), v = [];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); r.push([...v]); } } return r; };

console.log('Cinturones de', carpeta);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const mallas = new Map(d.getRoot().listNodes().filter(n => n.getMesh()).map(n => [n.getName(), n.getMesh()]));
  for (const [nombre, m] of mallas) {
    const k = nombre.match(/^(.*)_cinturon_(.*)$/); if (!k) continue;
    const prenda = mallas.get(`${k[1]}_capa_${k[2]}`);
    if (!prenda) { comprobar(`${f}: ${nombre} tiene su prenda`, false); continue; }
    const c = puntos(m), y0 = Math.min(...c.map(p => p[1])), y1 = Math.max(...c.map(p => p[1]));
    const anchoC = Math.max(...c.map(p => Math.abs(p[0])));
    const tela = puntos(prenda).filter(p => p[1] > y0 - 0.02 && p[1] < y1 + 0.02);
    const anchoP = Math.max(...tela.map(p => Math.abs(p[0])));
    comprobar(`${f}: ${nombre} ciñe la prenda (medio ancho ${anchoC.toFixed(3)} m, prenda ${anchoP.toFixed(3)} m)`, anchoC < anchoP + 0.025);
  }
}
console.log(`Resultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal || !ok ? 1 : 0);
