// Comprueba en los personajes del taller las piezas de la capa, el calzado y los tocados:
//  - están todas (capa y su falda, con su broche desde la taller-v15, botas, capucha y sombrero; la toca, en la mujer);
//  - el sombrero va entero en el hueso de la cabeza (no se deforma con el cuello);
//  - la capucha y el sombrero quedan por encima del pelo (o de la cofia) y la capucha baja hasta los hombros;
//  - las botas llegan al suelo como los zapatos y suben más que ellos (en la mujer son bajas desde la taller-v11, para
//    que no atraviesen la falda larga: suben menos, pero siguen por encima del zapato).
// Uso: node pruebas/prueba_prendas.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v7, que no las tiene: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v7` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const caja = (m) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), v = [];
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } } }
  return { lo, hi }; };

console.log('Capa, calzado y tocados de', carpeta);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const nodos = d.getRoot().listNodes();
  const sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const nodo = (s) => nodos.find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  // desde la taller-v15 la capa cae de los hombros (prueba_manto.mjs) y lleva broche
  const nuevaCapa = +(carpeta.match(/taller-v(\d+)/) || [0, 0])[1] >= 15;
  const hace = ['capa_manto', 'capa_manto_falda', ...(nuevaCapa ? ['capa_manto_broche'] : []), 'capa_botas', 'capa_capucha', 'capa_sombrero', ...(sexo === 'mujer' ? ['capa_toca'] : [])];
  const faltan = hace.filter(s => !nodo(s));
  comprobar(`${f}: están la capa, las botas y los tocados`, !faltan.length, faltan.length ? 'faltan ' + faltan.join(', ') : '');
  if (faltan.length) continue;
  // sombrero: todos sus vértices con peso 1 en un solo hueso, la cabeza
  const som = nodo('capa_sombrero'), skin = som.getSkin(), juntas = skin.listJoints().map(j => j.getName());
  let otros = 0;
  for (const p of som.getMesh().listPrimitives()) {
    const J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'), j = [], w = [];
    for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w);
      for (let k = 0; k < 4; k++) if (w[k] > 0.001 && juntas[j[k]] !== 'head') otros++; }
  }
  comprobar(`${f}: el sombrero va entero en el hueso de la cabeza`, otros === 0, `${otros} pesos en otros huesos`);
  const pelo = nodo('capa_cofia') || nodo('pelo') || nodo('cofia');
  const cabeza = caja(pelo.getMesh()), cap = caja(nodo('capa_capucha').getMesh()), sb = caja(som.getMesh());
  comprobar(`${f}: la capucha cubre el pelo y baja hasta los hombros`, cap.hi[1] > cabeza.hi[1] + 0.008 && cap.lo[1] < cabeza.lo[1] - 0.08,
    `arriba ${(cap.hi[1] - cabeza.hi[1]) * 100 | 0} cm por encima, abajo ${(cabeza.lo[1] - cap.lo[1]) * 100 | 0} cm por debajo`);
  comprobar(`${f}: el sombrero queda por encima del pelo y con ala ancha`, sb.hi[1] > cabeza.hi[1] + 0.02 && sb.hi[0] - sb.lo[0] > 0.35,
    `copa ${(sb.hi[1] - cabeza.hi[1]) * 100 | 0} cm por encima, ala ${(sb.hi[0] - sb.lo[0]) * 100 | 0} cm`);
  const za = caja(nodo('capa_zapatos').getMesh()), bo = caja(nodo('capa_botas').getMesh());
  comprobar(`${f}: las botas llegan al suelo y suben más que los zapatos`, Math.abs(bo.lo[1] - za.lo[1]) < 0.02 && bo.hi[1] > za.hi[1] + (sexo === 'mujer' ? 0.03 : 0.2),
    `suela ${bo.lo[1].toFixed(3)} / ${za.lo[1].toFixed(3)} m, caña hasta ${bo.hi[1].toFixed(2)} m (zapato ${za.hi[1].toFixed(2)} m)`);
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
