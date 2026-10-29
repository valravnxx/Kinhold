// Comprueba que los personajes del taller tienen pies descalzos (el GDD empieza descalzo; antes de la taller-v12 el
// cuerpo no tenía pies bajo los zapatos y, sin ellos, no se veían pies):
//  - cada cuerpo tiene la pieza <sexo>_pies, con piel (pesos de huesos), del color de la piel (tinte «piel»);
//  - llega al suelo, sube por encima del tobillo y no pasa de media pierna (en el hombre, por encima de donde empiezan
//    las calzas, para que no quede hueco);
//  - va con los huesos de los pies y los dedos (foot, ball) y tiene los dos pies, con sus dedos (bastantes triángulos);
//  - los zapatos la tapan: la caja de los pies cabe en la de los zapatos.
// Uso: node pruebas/prueba_pies.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v11, que no tiene pies: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v11` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };

// caja (en el mundo del modelo: los nodos de las piezas no llevan transformación propia) y huesos principales
function medir(nodo) {
  const juntas = nodo.getSkin() ? nodo.getSkin().listJoints().map(j => j.getName()) : [];
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], huesos = {}, v = [], j = [], w = [];
  let tri = 0;
  for (const p of nodo.getMesh().listPrimitives()) {
    const P = p.getAttribute('POSITION'), J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0');
    tri += (p.getIndices() ? p.getIndices().getCount() : P.getCount()) / 3;
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
      if (J && W) { J.getElement(i, j); W.getElement(i, w); let b = 0; for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k; huesos[juntas[j[b]]] = (huesos[juntas[j[b]]] || 0) + 1; }
    }
  }
  return { lo, hi, huesos, tri };
}

console.log('Pies descalzos de', carpeta);
for (const f of readdirSync(carpeta).filter(f => f.endsWith('.glb'))) {
  const d = await io.read(`${carpeta}/${f}`);
  const sexo = f.includes('mujer') ? 'mujer' : 'hombre';
  const nodo = (s) => d.getRoot().listNodes().find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const pies = nodo('pies');
  comprobar(`${f}: tiene pies (pieza ${sexo}_pies)`, !!pies);
  if (!pies) continue;
  comprobar(`${f}: los pies se mueven con el esqueleto`, !!pies.getSkin());
  comprobar(`${f}: los pies son del color de la piel (tinte «piel»)`, pies.getExtras()?.tinte === 'piel', JSON.stringify(pies.getExtras()));
  const m = medir(pies);
  const alto = m.hi[1] - m.lo[1];
  comprobar(`${f}: llegan al suelo`, m.lo[1] < 0.03, `abajo a ${(m.lo[1] * 100).toFixed(1)} cm`);
  comprobar(`${f}: suben por encima del tobillo sin pasar de media pierna`, alto > 0.1 && alto < 0.25, `${(alto * 100).toFixed(0)} cm de alto`);
  comprobar(`${f}: los dos pies (a los dos lados)`, m.lo[0] < -0.05 && m.hi[0] > 0.05, `x de ${m.lo[0].toFixed(2)} a ${m.hi[0].toFixed(2)}`);
  const deDedos = Object.entries(m.huesos).filter(([h]) => /^(foot|ball)_[lr]$/.test(h)).reduce((s, [, n]) => s + n, 0);
  const total = Object.values(m.huesos).reduce((s, n) => s + n, 0);
  comprobar(`${f}: van con los huesos del pie y de los dedos`, deDedos > total * 0.6, `${deDedos} de ${total} vértices (foot, ball)`);
  comprobar(`${f}: tienen detalle (dedos)`, m.tri > 800, `${m.tri} triángulos`);
  const zapatos = nodo('capa_zapatos');
  if (zapatos) {
    const z = medir(zapatos), dentro = [0, 2].every(k => m.lo[k] >= z.lo[k] - 0.002 && m.hi[k] <= z.hi[k] + 0.002);
    comprobar(`${f}: los zapatos tapan los pies`, dentro, `pies ${m.lo.map(x => x.toFixed(3))}…${m.hi.map(x => x.toFixed(3))}, zapatos ${z.lo.map(x => x.toFixed(3))}…${z.hi.map(x => x.toFixed(3))}`);
  }
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
