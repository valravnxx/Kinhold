// Comprueba la capa (manto) del taller (desde taller-v15, rehecha porque valravnx la vio «la capa que no es capa»: era la
// malla del cuerpo empujada hacia fuera y parecía un chaleco sin mangas que se metía en la cintura). Mira, en el hombre
// y en la mujer:
//  - que está, en una sola pieza (sin «_falda»), con el tinte de la ropa y la prenda «manto», y con su broche;
//  - que cae: por detrás, a la altura de la cintura, queda igual o más atrás que a la altura del pecho (no se mete);
//  - que cuelga ancha: abajo es al menos tan ancha como en los hombros, y el bajo pasa de la rodilla (más de 90 cm de largo);
//  - que va abierta por delante: a media altura no hay tela delante del centro del pecho.
// Uso: node pruebas/prueba_manto.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v14, con la capa de antes: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v14` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const puntos = (n) => {
  const r = [], v = [];
  for (const p of n.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION'); for (let k = 0; k < a.getCount(); k++) { a.getElement(k, v); r.push([...v]); } }
  return r;
};
const cm = (x) => `${(x * 100).toFixed(1)} cm`;
console.log('Capa en', carpeta);
for (const sexo of ['hombre', 'mujer']) {
  const nodos = (await io.read(`${carpeta}/mh_${sexo}.glb`)).getRoot().listNodes();
  const nodo = (s) => nodos.find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const m = nodo('capa_manto');
  comprobar(`${sexo}: hay capa`, !!m);
  if (!m) continue;
  const ex = m.getExtras() || {};
  comprobar(`${sexo}: tinte de la ropa, prenda «manto»`, ex.tinte === 'ropa' && ex.prenda === 'manto', JSON.stringify(ex));
  comprobar(`${sexo}: en una sola pieza (sin falda aparte)`, !nodo('capa_manto_falda'));
  comprobar(`${sexo}: con broche`, !!nodo('capa_manto_broche'));
  // glTF: y arriba, z delante, x a los lados
  const P = puntos(m);
  const arriba = Math.max(...P.map(p => p[1])), abajo = Math.min(...P.map(p => p[1]));
  const franja = (y, ancho = 0.02) => P.filter(p => Math.abs(p[1] - y) < ancho);
  const atras = (y) => Math.min(...franja(y).filter(p => Math.abs(p[0]) < 0.06).map(p => p[2]));
  const ancho = (y) => { const f = franja(y); return Math.max(...f.map(p => p[0])) - Math.min(...f.map(p => p[0])); };
  const pecho = arriba - 0.25, cintura = arriba - 0.5;
  comprobar(`${sexo}: por detrás cae, no se mete en la cintura`, atras(cintura) <= atras(pecho) + 0.005, `atrás en el pecho ${cm(-atras(pecho))}, en la cintura ${cm(-atras(cintura))}`);
  comprobar(`${sexo}: abajo, al menos tan ancha como en los hombros`, ancho(abajo + 0.04) >= ancho(arriba - 0.12), `hombros ${cm(ancho(arriba - 0.12))}, bajo ${cm(ancho(abajo + 0.04))}`);
  comprobar(`${sexo}: larga (más de 90 cm de alto)`, arriba - abajo > 0.9, cm(arriba - abajo));
  const delante = franja(arriba - 0.4).filter(p => Math.abs(p[0]) < 0.05 && p[2] > 0);
  comprobar(`${sexo}: abierta por delante (nada delante del pecho a media altura)`, delante.length === 0, `${delante.length} puntos`);
}
console.log(`Capa: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
