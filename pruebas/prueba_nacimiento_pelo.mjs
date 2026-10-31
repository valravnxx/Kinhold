// Comprueba el nacimiento del pelo en los personajes del taller (desde la taller-v19; antes el pelo corto cortaba en
// seco en la frente, como un casquete: la cáscara del pelo salía ya despegada de la piel unos 5-6 mm justo en su borde).
// Ahora el bulto del pelo crece desde el borde hacia dentro: por delante, en el centro de la frente, los puntos más bajos
// de la cáscara (los del borde) van pegados a la piel (a menos de 2,5 mm), y más arriba el pelo sí tiene su bulto.
// Uso: node pruebas/prueba_nacimiento_pelo.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v18, de antes del arreglo: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v18` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
// puntos de una pieza (en el glTF: y arriba, z hacia delante; las piezas no llevan transformación propia)
function puntos(nodo) {
  const r = [], v = [];
  for (const p of nodo.getMesh().listPrimitives()) { const P = p.getAttribute('POSITION'); for (let i = 0; i < P.getCount(); i++) r.push([...P.getElement(i, v)]); }
  return r;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const media = (l) => l.reduce((s, x) => s + x, 0) / l.length;

console.log('Nacimiento del pelo de', carpeta);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const nodo = (s) => d.getRoot().listNodes().find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const piel = nodo('piel'), pelo = nodo('pelo');
  comprobar(`${f}: tiene piel y pelo corto`, !!piel && !!pelo);
  if (!piel || !pelo) continue;
  const P = puntos(piel);
  const separacion = (p) => Math.min(...P.map(q => dist(p, q)));
  // la frente: puntos de la cáscara en el centro y por delante (la cara mira hacia +z)
  const frente = puntos(pelo).filter(p => Math.abs(p[0]) < 0.025);
  const zDelante = Math.max(...frente.map(p => p[2]));
  const delante = frente.filter(p => p[2] > zDelante - 0.045).sort((a, b) => a[1] - b[1]);
  const borde = delante.slice(0, 6), arriba = delante.filter(p => p[1] > delante[0][1] + 0.035);
  const sBorde = media(borde.map(separacion)), sArriba = arriba.length ? media(arriba.map(separacion)) : 0;
  comprobar(`${f}: en el borde de la frente el pelo va pegado a la piel`, sBorde < 0.0025, `${(sBorde * 1000).toFixed(1)} mm`);
  comprobar(`${f}: más arriba el pelo tiene bulto`, sArriba > 0.004, `${(sArriba * 1000).toFixed(1)} mm a más de 3,5 cm por encima del borde`);
}
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
