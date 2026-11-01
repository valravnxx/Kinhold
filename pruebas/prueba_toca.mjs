// Comprueba el cuello de la ropa en los personajes del taller (desde la taller-v18; antes, entre el escote y el cuello
// asomaba una mancha de piel rota, con huecos negros a los lados): por delante, la piel baja hasta bien por debajo de
// cualquier escote (al menos 10 cm por debajo de lo alto de la camisa; el escote más hondo baja unos 5 cm desde ahí),
// así su borde queda siempre tapado por la ropa; y la cofia de la mujer baja también bajo el escote (desde la taller-v23).
// Que bajo la toca no vaya la cofia lo mira prueba_aspecto.mjs.
// Uso: node pruebas/prueba_toca.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v17, de antes del arreglo: tiene que fallar. MUTAR=2 → la taller-v22 (cofia de antes).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR === '2' ? `${base}/taller-v22` : process.env.MUTAR ? `${base}/taller-v17` : (process.argv[2] || `${base}/${ultima}`);
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

console.log('Cuello de la ropa de', carpeta);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const nodo = (s) => d.getRoot().listNodes().find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const piel = nodo('piel'), camisa = nodo('capa_camisa');
  comprobar(`${f}: tiene piel y camisa`, !!piel && !!camisa);
  if (!piel || !camisa) continue;
  const centro = (p) => Math.abs(p[0]) < 0.04 && p[2] > 0;
  const altoCamisa = Math.max(...puntos(camisa).filter(centro).map(p => p[1]));
  // la piel del pecho: la de delante por debajo de la barbilla (las manos quedan lejos del centro)
  const bajoPiel = Math.min(...puntos(piel).filter(p => centro(p) && p[1] > altoCamisa - 0.4).map(p => p[1]));
  comprobar(`${f}: por delante, la piel baja bajo cualquier escote`, altoCamisa - bajoPiel >= 0.10,
    `${((altoCamisa - bajoPiel) * 100).toFixed(1)} cm por debajo de lo alto de la camisa`);
  // la cofia baja por debajo de cualquier escote, delante y detrás (desde la taller-v23; antes acababa 6 mm por encima
  // del cuello y entre ella y el escote asomaba una cuña de piel). Lo alto de la camisa queda 3 cm por encima del cuello;
  // el escote más hondo (el del vestido, por delante) baja 2,4 cm por debajo del cuello, y el bajo de la cofia (su
  // transparencia) está a 3 cm: su malla tiene que llegar al menos a 6 cm por debajo de lo alto de la camisa
  const cofia = nodo('cofia');
  if (sexo === 'mujer') {
    comprobar(`${f}: tiene cofia`, !!cofia);
    if (cofia) for (const [lado, sel] of [['delante', centro], ['detrás', (p) => Math.abs(p[0]) < 0.04 && p[2] < 0]]) {
      const bajo = Math.min(...puntos(cofia).filter(sel).map(p => p[1]));
      comprobar(`${f}: la cofia baja bajo el escote (${lado})`, altoCamisa - bajo >= 0.06, `${((altoCamisa - bajo) * 100).toFixed(1)} cm por debajo de lo alto de la camisa`);
    }
  }
}
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
