// Comprueba que las manos de los personajes del taller están enteras y que las botas de la mujer no atraviesan la falda:
//  - la piel de cada cuerpo tiene al menos 2000 triángulos cuyos tres vértices van sobre todo con la mano o los dedos
//    (en la taller-v8 eran unos 3100; en la v9 y la v10 la reducción de triángulos dejó 5 en el hombre y ninguno en la
//    mujer, y las manos salían como una tira: lo vio valravnx el 29 oct);
//  - las botas de la mujer son bajas (la caña acaba a menos de 25 cm del suelo), porque la falda larga sigue los muslos
//    y una caña alta la atravesaba por detrás; las del hombre siguen siendo altas (más de 35 cm).
// Uso: node pruebas/prueba_manos.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v10, que tiene los dos fallos: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v10` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const HUESOS_MANO = /hand|thumb|index|middle|ring|pinky/;

// triángulos de una malla con piel cuyos tres vértices tienen su mayor peso en un hueso de la mano o de los dedos
function triangulosDeMano(nodo) {
  const juntas = nodo.getSkin().listJoints().map(j => j.getName());
  let mano = 0;
  for (const p of nodo.getMesh().listPrimitives()) {
    const J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'), I = p.getIndices(), j = [], w = [];
    const esMano = new Uint8Array(J.getCount());
    for (let i = 0; i < J.getCount(); i++) {
      J.getElement(i, j); W.getElement(i, w);
      let b = 0; for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k;
      esMano[i] = HUESOS_MANO.test(juntas[j[b]]) ? 1 : 0;
    }
    for (let t = 0; t < I.getCount() / 3; t++)
      if (esMano[I.getScalar(3 * t)] && esMano[I.getScalar(3 * t + 1)] && esMano[I.getScalar(3 * t + 2)]) mano++;
  }
  return mano;
}
const alto = (m) => { let hi = -1e9, lo = 1e9; const v = [];
  for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); hi = Math.max(hi, v[1]); lo = Math.min(lo, v[1]); } }
  return hi - lo; };

console.log('Manos y botas de', carpeta);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const nodo = (s) => d.getRoot().listNodes().find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const piel = nodo('piel');
  comprobar(`${f}: tiene la piel`, !!piel);
  if (!piel) continue;
  const n = triangulosDeMano(piel);
  comprobar(`${f}: las manos están enteras`, n >= 2000, `${n} triángulos en las manos (la v8 tenía unos 3100)`);
  const botas = nodo('capa_botas');
  comprobar(`${f}: tiene botas`, !!botas);
  if (!botas) continue;
  const h = alto(botas.getMesh());
  if (sexo === 'mujer') comprobar(`${f}: las botas de la mujer son bajas (no atraviesan la falda larga)`, h < 0.25, `caña de ${(h * 100).toFixed(0)} cm`);
  else comprobar(`${f}: las botas del hombre siguen siendo altas`, h > 0.35, `caña de ${(h * 100).toFixed(0)} cm`);
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
