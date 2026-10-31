// Comprueba la barba larga del taller (desde taller-v14, rehecha porque valravnx vio las barbas «horribles»): ya no es
// la piel estirada (una lámina hueca que de perfil salía como una aleta) sino una malla con volumen. Mira, en el hombre:
//  - que está y que lleva el tinte del pelo;
//  - que cuelga bajo la boca (la punta, más de 8 cm por debajo del bigote);
//  - que tiene grosor: en el centro, 3 cm por encima de la punta, hay cara de delante y cara de detrás separadas más de
//    1,5 cm (una lámina sola no las tiene);
//  - (desde taller-v17) que hay bigote con volumen: abombado, donde el bigote pintado y cayendo por las comisuras;
//  - que el cargador no la trata como calco pintado (eso es solo para corta, bigote y perilla).
// Uso: node pruebas/prueba_barbas.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v13, con la barba de antes: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync, readFileSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v13` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };

console.log('Barbas en', carpeta);
const d = await io.read(`${carpeta}/mh_hombre.glb`);
const nodos = d.getRoot().listNodes();
const nodo = (s) => nodos.find(n => n.getName() === `hombre_${s}` && n.getMesh());
// puntos que usan sus triángulos (los calcos guardan todos los de la piel, aunque solo pinten unos pocos); los nodos de
// las piezas no llevan transformación propia
const puntos = (n) => {
  const r = [], v = [];
  for (const p of n.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION'), ind = p.getIndices(), usados = new Set();
    if (ind) for (let k = 0; k < ind.getCount(); k++) usados.add(ind.getScalar(k)); else for (let k = 0; k < a.getCount(); k++) usados.add(k);
    for (const k of usados) { a.getElement(k, v); r.push([...v]); }
  }
  return r;
};
const larga = nodo('barba_larga'), bigote = nodo('barba_bigote');
comprobar('hay barba larga y bigote', !!larga && !!bigote);
if (larga && bigote) {
  comprobar('la barba larga lleva el tinte del pelo', larga.getExtras()?.tinte === 'pelo', JSON.stringify(larga.getExtras()));
  // glTF: y hacia arriba, z hacia delante
  const P = puntos(larga), B = puntos(bigote);
  const punta = Math.min(...P.map(p => p[1])), boca = Math.min(...B.map(p => p[1]));
  comprobar('cuelga: la punta, más de 8 cm por debajo del bigote', boca - punta > 0.08, `${((boca - punta) * 100).toFixed(1)} cm`);
  const franja = P.filter(p => Math.abs(p[0]) < 0.012 && Math.abs(p[1] - (punta + 0.03)) < 0.006);
  const grosor = franja.length ? Math.max(...franja.map(p => p[2])) - Math.min(...franja.map(p => p[2])) : 0;
  comprobar('tiene grosor (cara de delante y de detrás) 3 cm por encima de la punta', grosor > 0.015, `${(grosor * 100).toFixed(1)} cm con ${franja.length} puntos`);
}
// el bigote con volumen (desde taller-v17; antes solo pintado, plano): malla propia, con el tinte del pelo, a la altura
// del bigote pintado, que se aparta de la piel (abombado: entre su punto más hundido y el más saliente en el centro, más
// de 3 mm) y que por los lados baja más que en el centro (cae por las comisuras)
const most = nodo('barba_mostacho');
comprobar('hay bigote con volumen', !!most);
if (most && bigote) {
  comprobar('el bigote con volumen lleva el tinte del pelo', most.getExtras()?.tinte === 'pelo');
  const M = puntos(most), B = puntos(bigote);
  const centro = M.filter(p => Math.abs(p[0]) < 0.004);
  const bulto = centro.length ? Math.max(...centro.map(p => p[2])) - Math.min(...centro.map(p => p[2])) : 0;
  comprobar('el bigote tiene bulto en el centro (más de 3 mm hacia fuera)', bulto > 0.003, `${(bulto * 1000).toFixed(1)} mm`);
  const yb = B.reduce((s, p) => s + p[1], 0) / B.length, ym = M.reduce((s, p) => s + p[1], 0) / M.length;
  comprobar('está donde el bigote pintado (a menos de 1,5 cm de altura)', Math.abs(yb - ym) < 0.015, `${((ym - yb) * 100).toFixed(1)} cm`);
  const bajoC = Math.min(...centro.map(p => p[1])), bajoL = Math.min(...M.map(p => p[1]));
  comprobar('por los lados cae más que en el centro (por las comisuras)', bajoC - bajoL > 0.008, `${((bajoC - bajoL) * 100).toFixed(1)} cm`);
}
const fuente = readFileSync('src/personajes/makehuman.js', 'utf8') + readFileSync('src/personajes/detalle.js', 'utf8');
const regs = [...fuente.matchAll(/\/_\(vello\|(?:cejas\|)?barba_[^/]+\/\.test|const CALCO = (\/[^;]+\/);/g)].map(m => m[1] || m[0].replace('.test', ''));
const esCalco = (nombre) => regs.length > 0 && regs.every(r => new RegExp(r.slice(1, r.lastIndexOf('/'))).test(nombre));
comprobar('el cargador pinta corta, bigote y perilla como calcos, y la larga no', regs.length >= 2 && ['hombre_barba_corta', 'hombre_barba_bigote', 'hombre_barba_perilla'].every(esCalco) && !regs.some(r => new RegExp(r.slice(1, r.lastIndexOf('/'))).test('hombre_barba_larga')), regs.join(' '));
console.log(`Barbas: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
