// Comprueba en los personajes del taller lo que necesita la personalización (src/logica/aspecto.js):
//  - las formas de MakeHuman como formas del modelo: peso y músculo en la piel y en la ropa; cara, nariz y mentón solo
//    en la cabeza (no en la túnica); cada forma mueve de verdad (más de 3 mm en algún punto: la nariz es pequeña);
//  - las piezas que cambian de color llevan su tinte (piel, pelo u ojos) y su color de referencia en los «extras»;
//  - el iris va aparte del blanco del ojo, y están los calcos de pelo (cejas; en el hombre, barba corta y bigote);
//  - cada peinado y cada barba que se pueden elegir tienen sus piezas en el modelo (melena, coleta, trenzas, barba larga,
//    perilla…), con el color del pelo.
// Uso: node pruebas/prueba_aspecto_modelos.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v8, que no los tiene: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';
import { FORMAS, PEINADOS, BARBAS, piezasCabeza } from '../src/logica/aspecto.js';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v8` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const formasDe = (nodo) => (nodo?.getMesh()?.getExtras()?.targetNames) || [];
// lo que más mueve una forma (en metros) en una pieza
function cuanto(nodo, forma) {
  const i = formasDe(nodo).indexOf(forma); if (i < 0) return 0;
  let max = 0;
  for (const p of nodo.getMesh().listPrimitives()) {
    const a = p.listTargets()[i]?.getAttribute('POSITION'), v = [];
    if (a) for (let k = 0; k < a.getCount(); k++) { a.getElement(k, v); max = Math.max(max, Math.hypot(...v)); }
  }
  return max;
}

console.log('Personalización en', carpeta);
const esperadas = Object.keys(FORMAS).filter(k => k !== 'altura').flatMap(k => [`${k}_mas`, `${k}_menos`]);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const nodos = d.getRoot().listNodes();
  const sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const nodo = (s) => nodos.find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const piel = nodo('piel'), tunica = nodo(sexo === 'mujer' ? 'capa_vestido' : 'capa_tunica');
  const faltan = esperadas.filter(k => !formasDe(piel).includes(k));
  comprobar(`${f}: la piel tiene todas las formas`, !faltan.length, faltan.length ? 'faltan ' + faltan.join(', ') : formasDe(piel).join(', '));
  const mueve = (k) => Math.max(...nodos.filter(n => n.getMesh()).map(n => cuanto(n, k)));
  const flojas = esperadas.filter(k => mueve(k) < 0.003);
  comprobar(`${f}: cada forma mueve algún punto más de 3 mm`, !flojas.length, flojas.length ? 'no mueven: ' + flojas.join(', ') : esperadas.map(k => `${k} ${(mueve(k) * 1000).toFixed(0)}`).join(', ') + ' mm');
  const ft = formasDe(tunica);
  comprobar(`${f}: la ropa engorda y adelgaza con el cuerpo, pero no lleva las formas de la cara`,
    ['peso_mas', 'peso_menos', 'musculo_mas', 'musculo_menos'].every(k => ft.includes(k)) && !ft.some(k => /^(cara|nariz|menton)/.test(k)), ft.join(', '));
  const tinte = (s) => { const n = nodo(s), e = n && n.getExtras(); return e && e.tinte ? `${e.tinte}/${e.ref}` : null; };
  const piezas = { piel: 'piel', vello: 'pelo', cejas: 'pelo', iris_l: 'ojos', iris_r: 'ojos', ...(sexo === 'hombre' ? { pelo: 'pelo', orejas: 'piel', barba_corta: 'pelo', barba_bigote: 'pelo' } : {}) };
  const mal_ = Object.entries(piezas).filter(([s, t]) => !(tinte(s) || '').startsWith(t + '/'));
  comprobar(`${f}: piel, pelo, cejas, barba e iris llevan su tinte y su color de referencia`, !mal_.length, mal_.map(([s]) => `${s}: ${tinte(s)}`).join(', '));
  comprobar(`${f}: el blanco del ojo no cambia de color (sin tinte)`, nodo('ojo_l') && !tinte('ojo_l'));
  // cada peinado y cada barba que se pueden elegir: están todas las piezas que se enseñan, y las de pelo llevan su tinte
  const faltanP = new Set(), sinTinte = new Set();
  for (const peinado of Object.keys(PEINADOS[sexo])) for (const barba of Object.keys(BARBAS[sexo])) {
    for (const [k, ver] of Object.entries(piezasCabeza({ peinado, barba }))) {
      if (!ver) continue;
      const s = k.slice(1);
      if (!nodo(s)) faltanP.add(s);
      else if (/^(pelo|barba)/.test(s) && !(tinte(s) || '').startsWith('pelo/')) sinTinte.add(s);
    }
  }
  comprobar(`${f}: cada peinado y cada barba tienen sus piezas`, !faltanP.size, faltanP.size ? 'faltan ' + [...faltanP].join(', ') : Object.keys(PEINADOS[sexo]).join(', ') + ' · ' + Object.keys(BARBAS[sexo]).join(', '));
  comprobar(`${f}: el pelo largo y las barbas llevan el color del pelo`, !sinTinte.size, [...sinTinte].join(', '));
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
