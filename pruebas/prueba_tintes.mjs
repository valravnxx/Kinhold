// Tintes de la ropa y blasón de la sobreveste (src/logica/tintes.js) y los modelos del taller que los llevan:
//  - lógica: por defecto, cada prenda con su tinte inicial; lo que no existe vuelve al defecto; el blasón se valida;
//    «natural» da el color sin teñir de la prenda;
//  - modelos (la última taller-vN): cada prenda teñible (camisa, túnica o vestido, gambesón, sobreveste, manto,
//    capucha, calzado…) lleva en sus extras tinte «ropa», qué prenda es y el gris de referencia; con los tintes por
//    defecto su color es el mismo que el que llevaba pintado antes (se ve igual que la taller-v12); la cota de malla
//    no se tiñe.
// Uso: node pruebas/prueba_tintes.mjs [carpeta de recursos]   MUTAR=1 → mira la taller-v12 (sin tintes): tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';
import { TINTES, CUEROS, BLASONES, PRENDAS_TENIBLES, normalizarTintes, colorPrenda, colorFigura, NUM_BLASON } from '../src/logica/tintes.js';

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };

console.log('Lógica de los tintes');
for (const sexo of ['hombre', 'mujer']) {
  const t = normalizarTintes(undefined, sexo);
  comprobar(`${sexo}: todas las prendas teñibles tienen tinte`, Object.keys(PRENDAS_TENIBLES).every(p => t.prendas[p]));
  comprobar(`${sexo}: sobreveste roja de rubia y lisa por defecto`, t.prendas.sobreveste === 'rubia' && t.blason.dibujo === 'liso');
  const raro = normalizarTintes({ prendas: { camisa: 'fucsia', botas: 'rubia', zapatos: 'negro', manto: 'glasto' }, blason: { dibujo: 'dragon', color: 'natural' } }, sexo);
  comprobar(`${sexo}: un tinte que no existe vuelve al de por defecto`, raro.prendas.camisa === 'natural');
  comprobar(`${sexo}: el cuero solo con tintes de cuero`, raro.prendas.botas === 'natural' && raro.prendas.zapatos === 'negro');
  comprobar(`${sexo}: se guarda un tinte válido`, raro.prendas.manto === 'glasto');
  comprobar(`${sexo}: blasón y color de figura que no valen vuelven al defecto`, raro.blason.dibujo === 'liso' && raro.blason.color === 'blanco');
  comprobar(`${sexo}: el resultado ya normalizado no cambia`, JSON.stringify(normalizarTintes(raro, sexo)) === JSON.stringify(raro));
}
comprobar('«Sin teñir» da el color propio de cada prenda', Object.entries(PRENDAS_TENIBLES).every(([p, d]) => colorPrenda(p, 'natural') === d.natural));
comprobar('un tinte da su color', colorPrenda('sobreveste', 'glasto') === TINTES.glasto[1] && colorPrenda('botas', 'negro') === CUEROS.negro[1]);
comprobar('cada blasón tiene su número en el sombreado (liso = 0)', NUM_BLASON.liso === 0 && new Set(Object.values(NUM_BLASON)).size === Object.keys(BLASONES).length);
comprobar('la figura del blasón tiene color', colorFigura('gualda') === TINTES.gualda[1] && colorFigura('nada') === TINTES.blanco[1]);
comprobar('colores apagados (nada chillón: saturación ≤ 0,7)', [...Object.values(TINTES), ...Object.values(CUEROS)].every(([, c]) => !c || (Math.max(...c) - Math.min(...c)) / Math.max(...c) <= 0.7));

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v12` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const lineal = (c) => c.map(x => (x / 255) ** 2.2);
console.log('Modelos de', carpeta);
for (const f of readdirSync(carpeta).filter(f => /^mh_(hombre|mujer)\.glb$/.test(f))) {
  const d = await io.read(`${carpeta}/${f}`), sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const ini = normalizarTintes(undefined, sexo);
  const nodos = d.getRoot().listNodes().filter(n => n.getMesh());
  const tenidas = nodos.filter(n => n.getExtras()?.tinte === 'ropa');
  const prendas = new Set(tenidas.map(n => n.getExtras().prenda));
  const deben = ['camisa', sexo === 'mujer' ? 'vestido' : 'tunica', 'gambeson', 'sobreveste', 'manto', 'capucha', 'zapatos', 'botas', ...(sexo === 'mujer' ? ['toca'] : ['calzas'])];
  comprobar(`${f}: se tiñen ${deben.join(', ')}`, deben.every(p => prendas.has(p)), [...prendas].join(', '));
  comprobar(`${f}: cada pieza teñible dice qué prenda es (de las teñibles) y su gris de referencia`, tenidas.length > 0 && tenidas.every(n => PRENDAS_TENIBLES[n.getExtras().prenda] && n.getExtras().ref > 0));
  let peor = 0, cual = '';
  for (const n of tenidas) {
    const e = n.getExtras(), c = lineal(colorPrenda(e.prenda, ini.prendas[e.prenda])).map(x => x / e.ref);
    const fac = n.getMesh().listPrimitives()[0].getMaterial().getBaseColorFactor();
    const dif = Math.max(...c.map((x, k) => Math.abs(x - fac[k])));
    if (dif > peor) { peor = dif; cual = n.getName(); }
  }
  comprobar(`${f}: con los tintes por defecto, cada prenda tiene el color de antes`, tenidas.length > 0 && peor < 0.002, `diferencia mayor ${peor.toFixed(4)} (${cual})`);
  comprobar(`${f}: la cota de malla no se tiñe`, nodos.filter(n => /_capa_cota/.test(n.getName())).every(n => n.getExtras()?.tinte !== 'ropa'));
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
