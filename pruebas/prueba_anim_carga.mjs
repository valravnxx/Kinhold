// Prueba de las animaciones para cargar del taller propio (recursos/personajes/taller-anim-v2/): las 39 extra de la v1
// siguen igual y se añaden empujar (Push_Loop) y coger algo de una mesa (PickUp_Table), de la Universal Animation Library
// de Quaternius (CC0), pasadas al esqueleto del taller con pasar_animaciones.mjs.
// Comprueba: los archivos son los del manifiesto (sha256), cada sexo lleva los 41 clips, los nuevos mueven los brazos
// de verdad, las 39 de antes no cambian respecto a taller-anim-v1 y el juego sabe cómo se llaman (CLIPS_EXTRA y textos).
// MUTAR=1 compara con la v1 en vez de con la v2: tiene que fallar.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { CLIPS_EXTRA } from '../src/personajes/cargar.js';
import { ANIMS_EXTRA } from '../src/personaje/textos.js';

const V2 = `docs/recursos/personajes/${process.env.MUTAR ? 'taller-anim-v1' : 'taller-anim-v2'}`, V1 = 'docs/recursos/personajes/taller-anim-v1';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ` — ${d}` : '')); if (!c) fallos++; };

const manifiesto = JSON.parse(readFileSync(`${V2}/manifiesto.json`, 'utf8'));
const NUEVOS = ['Push_Loop', 'PickUp_Table'];
// giro de un hueso a lo largo de un clip: el ángulo mayor entre dos fotogramas cualesquiera (en grados)
const giro = (anim, hueso) => {
  const c = anim.listChannels().find(c => c.getTargetNode()?.getName() === hueso && c.getTargetPath() === 'rotation');
  if (!c) return 0;
  const v = c.getSampler().getOutput(), n = v.getCount(), q = [];
  for (let i = 0; i < n; i++) q.push(v.getElement(i, []));
  let max = 0;
  for (const a of q) for (const b of q) max = Math.max(max, 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI);
  return max;
};
for (const sexo of ['hombre', 'mujer']) {
  const f = `${V2}/mh_${sexo}_extra.glb`, bytes = readFileSync(f);
  comprobar(`${sexo}: el archivo es el del manifiesto`, createHash('sha256').update(bytes).digest('hex') === manifiesto[`mh_${sexo}_extra`]?.sha256);
  const doc = await io.readBinary(new Uint8Array(bytes)), viejo = await io.read(`${V1}/mh_${sexo}_extra.glb`);
  const anims = new Map(doc.getRoot().listAnimations().map(a => [a.getName(), a]));
  const antes = new Map(viejo.getRoot().listAnimations().map(a => [a.getName(), a]));
  comprobar(`${sexo}: lleva las 39 de antes y las 2 nuevas`, anims.size === 41 && [...antes.keys(), ...NUEVOS].every(k => anims.has(k)), `${anims.size} clips`);
  comprobar(`${sexo}: solo esqueleto, sin mallas`, doc.getRoot().listMeshes().length === 0);
  for (const k of NUEVOS) {
    const a = anims.get(k);
    // empujar lleva los brazos casi quietos y anda; coger de la mesa mueve sobre todo los brazos
    const brazos = Math.max(...['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'].map(h => a ? giro(a, h) : 0));
    const dur = a ? Math.max(...a.listSamplers().map(s => s.getInput().getMax([])[0])) : 0;
    comprobar(`${sexo}: ${k} mueve brazos o piernas (más de 20°) y dura de verdad`, brazos > 20 && dur > 0.5, `giro ${brazos.toFixed(0)}°, ${dur.toFixed(2)} s`);
  }
  // las de antes, iguales: mismos canales y mismos valores (salen del mismo origen con las mismas correcciones)
  const distintas = [];
  for (const [k, a] of antes) {
    const b = anims.get(k);
    if (!b) { distintas.push(k); continue; }
    const canal = (x) => new Map(x.listChannels().map(c => [`${c.getTargetNode()?.getName()}.${c.getTargetPath()}`, c.getSampler().getOutput()]));
    const ca = canal(a), cb = canal(b);
    let dif = 0;
    for (const [n, va] of ca) {
      const vb = cb.get(n); if (!vb) { dif = Infinity; break; }
      const xa = va.getElement(Math.floor(va.getCount() / 2), []), xb = vb.getElement(Math.floor(vb.getCount() / 2), []);
      dif = Math.max(dif, ...xa.map((x, i) => Math.abs(Math.abs(x) - Math.abs(xb[i]))));
    }
    if (dif > 0.01) distintas.push(`${k} ${dif.toFixed(3)}`);
  }
  comprobar(`${sexo}: las 39 de antes no cambian`, distintas.length === 0, distintas.slice(0, 4).join(', '));
}
comprobar('el juego conoce los nombres nuevos (CLIPS_EXTRA)', CLIPS_EXTRA.empujar === 'Push_Loop' && CLIPS_EXTRA.cogerDeMesa === 'PickUp_Table');
comprobar('y tienen su texto en el visor', !!ANIMS_EXTRA.empujar && !!ANIMS_EXTRA.cogerDeMesa);
console.log(fallos ? `${fallos} fallos` : 'Todo correcto');
process.exit(fallos ? 1 : 0);
