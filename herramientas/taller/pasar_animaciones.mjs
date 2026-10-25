// Pasa animaciones de un esqueleto a otro con distinta postura de reposo (Quaternius → MakeHuman «game_engine»).
// Método habitual del «retargeting» por rotaciones en el mundo:
//   1. Se lleva el reposo del destino a la postura del origen: cada hueso se gira lo justo para que apunte
//      hacia su hijo en la misma dirección que el hueso del origen (los brazos pasan de «A» a la postura del origen).
//   2. En cada fotograma, el giro de cada hueso respecto a su reposo (en el mundo) se copia del origen al destino.
//   3. La pelvis copia también su desplazamiento, escalado por la diferencia de altura.
// Los huesos se emparejan por nombre (sin distinguir mayúsculas: «Head» = «head», «root» = «Root»).
// Uso: node herramientas/taller/pasar_animaciones.mjs <animaciones.glb> <personaje.glb> <salida.glb> [clip,clip…]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';

const [origen, destino, salida, lista] = process.argv.slice(2);
const CLIPS = lista ? lista.split(',') : ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'TreeChopping_Loop', 'Sword_Idle', 'Sword_Regular_A', 'Sword_Block', 'Walk_Carry_Loop', 'Farm_Harvest'];
const FPS = 30;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const S = await io.read(origen), T = await io.read(destino);

// hacia qué hijo apunta cada hueso (para igualar las direcciones del reposo)
const HIJO = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'head',
  clavicle: 'upperarm', upperarm: 'lowerarm', lowerarm: 'hand', hand: 'middle_01', thigh: 'calf', calf: 'foot', foot: 'ball',
  index_01: 'index_02', index_02: 'index_03', middle_01: 'middle_02', middle_02: 'middle_03', ring_01: 'ring_02', ring_02: 'ring_03',
  pinky_01: 'pinky_02', pinky_02: 'pinky_03', thumb_01: 'thumb_02', thumb_02: 'thumb_03' };
const hijoDe = (n) => { const m = n.match(/^(.*?)(_[lr])$/); return m ? (HIJO[m[1]] ? HIJO[m[1]] + m[2] : null) : HIJO[n] || null; };

// ---- árbol con matrices del reposo ----
function arbol(doc) {
  const nodos = doc.getRoot().listNodes(), padre = new Map();
  for (const n of nodos) for (const c of n.listChildren()) padre.set(c, n);
  const porNombre = new Map(nodos.map(n => [n.getName().toLowerCase(), n]));
  const local = (n, trs) => new THREE.Matrix4().compose(new THREE.Vector3(...trs.t), new THREE.Quaternion(...trs.r), new THREE.Vector3(...trs.s));
  const reposo = (n) => ({ t: n.getTranslation(), r: n.getRotation(), s: n.getScale() });
  // mundo de cada nodo con unos TRS dados (por defecto, el reposo)
  const mundo = (trsDe) => {
    const m = new Map();
    const de = (n) => { if (m.has(n)) return m.get(n); const p = padre.get(n); const w = local(n, trsDe(n)); if (p) w.premultiply(de(p)); m.set(n, w); return w; };
    for (const n of nodos) de(n);
    return m;
  };
  return { nodos, padre, porNombre, reposo, mundo };
}
const A = arbol(S), B = arbol(T);
const rot = (m) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));
const pos = (m) => new THREE.Vector3().setFromMatrixPosition(m);

// pares destino → origen
const pares = [];
for (const n of B.nodos) { const o = A.porNombre.get(n.getName().toLowerCase()); if (o && !n.getMesh()) pares.push([n, o]); }
const WA0 = A.mundo(A.reposo), WB0 = B.mundo(B.reposo);
const RA0 = new Map(pares.map(([b, a]) => [a, rot(WA0.get(a))]));
// reposo del destino girado a la postura del origen (M)
const M = new Map(), alinear = new Map();
for (const [b, a] of pares) {
  const h = hijoDe(b.getName().toLowerCase());
  const hb = h && B.porNombre.get(h), ha = h && A.porNombre.get(h);
  let q = null;
  if (hb && ha) {
    const db = pos(WB0.get(hb)).sub(pos(WB0.get(b))).normalize(), da = pos(WA0.get(ha)).sub(pos(WA0.get(a))).normalize();
    q = new THREE.Quaternion().setFromUnitVectors(db, da);
  }
  alinear.set(b, q);
}
// los huesos sin hijo (cabeza, puntas de los dedos, punta del pie) heredan el giro de su padre
for (const [b] of pares) {
  let q = alinear.get(b), p = b;
  while (!q && (p = B.padre.get(p))) q = alinear.get(p);
  M.set(b, (q || new THREE.Quaternion()).clone().multiply(rot(WB0.get(b))));
}

// ---- evaluar las animaciones del origen ----
function muestreador(s) {
  const t = s.getInput().getArray(), v = s.getOutput().getArray(), k = v.length / t.length, interp = s.getInterpolation();
  return (x) => {
    let i = 0; while (i < t.length - 1 && t[i + 1] <= x) i++;
    const j = Math.min(i + 1, t.length - 1), f = j === i || interp === 'STEP' ? 0 : Math.min(1, Math.max(0, (x - t[i]) / (t[j] - t[i])));
    if (interp === 'CUBICSPLINE') throw new Error('interpolación CUBICSPLINE no soportada');
    const ki = k, a = Array.from(v.slice(i * k, i * k + k)), b = Array.from(v.slice(j * k, j * k + k));
    if (ki === 4) return new THREE.Quaternion(...a).slerp(new THREE.Quaternion(...b), f).toArray();
    return a.map((x, n) => x + (b[n] - x) * f);
  };
}
const altura = pos(WB0.get(B.porNombre.get('pelvis'))).y / pos(WA0.get(A.porNombre.get('pelvis'))).y;
const pelvisB = B.porNombre.get('pelvis'), pelvisA = A.porNombre.get('pelvis');
const buf = T.getRoot().listBuffers()[0];
for (const anim of T.getRoot().listAnimations()) anim.dispose();
const hechos = [];
for (const clip of CLIPS) {
  const an = S.getRoot().listAnimations().find(a => a.getName() === clip);
  if (!an) { console.log('no está:', clip); continue; }
  const canales = new Map();
  let dur = 0;
  for (const c of an.listChannels()) {
    const n = c.getTargetNode(); if (!n) continue;
    if (!canales.has(n)) canales.set(n, {});
    canales.get(n)[c.getTargetPath()] = muestreador(c.getSampler());
    dur = Math.max(dur, c.getSampler().getInput().getMax([])[0]);
  }
  const nf = Math.max(2, Math.round(dur * FPS) + 1), tiempos = new Float32Array(nf);
  const salidaRot = new Map(pares.map(([b]) => [b, new Float32Array(nf * 4)])), salidaPel = new Float32Array(nf * 3);
  for (let f = 0; f < nf; f++) {
    const x = Math.min(dur, f / FPS); tiempos[f] = x;
    const WA = A.mundo((n) => {
      const r = A.reposo(n), c = canales.get(n);
      return c ? { t: c.translation ? c.translation(x) : r.t, r: c.rotation ? c.rotation(x) : r.r, s: r.s } : r;
    });
    // giros en el mundo del destino
    const WBr = new Map();
    for (const [b, a] of pares) WBr.set(b, rot(WA.get(a)).multiply(RA0.get(a).clone().invert()).multiply(M.get(b)));
    // a giros locales: hace falta el mundo del padre ya animado
    const mundoB = new Map();
    const deB = (n) => {
      if (mundoB.has(n)) return mundoB.get(n);
      const p = B.padre.get(n), r = B.reposo(n);
      const pw = p ? deB(p) : new THREE.Matrix4();
      let qL = new THREE.Quaternion(...r.r), t = new THREE.Vector3(...r.t);
      if (WBr.has(n)) qL = rot(pw).invert().multiply(WBr.get(n));
      if (n === pelvisB) { // desplazamiento de la pelvis (botes al andar, agacharse)
        const d = pos(WA.get(pelvisA)).sub(pos(WA0.get(pelvisA))).multiplyScalar(altura);
        t = pos(WB0.get(pelvisB)).add(d).applyMatrix4(pw.clone().invert());
        salidaPel.set(t.toArray(), f * 3);
      }
      const w = pw.clone().multiply(new THREE.Matrix4().compose(t, qL, new THREE.Vector3(...r.s)));
      mundoB.set(n, w);
      if (salidaRot.has(n)) salidaRot.get(n).set(qL.toArray(), f * 4);
      return w;
    };
    for (const [b] of pares) deB(b);
  }
  const nueva = T.createAnimation(clip);
  const entrada = T.createAccessor().setType('SCALAR').setArray(tiempos).setBuffer(buf);
  const canal = (nodo, camino, datos, tipo) => {
    const s = T.createAnimationSampler().setInput(entrada).setOutput(T.createAccessor().setType(tipo).setArray(datos).setBuffer(buf)).setInterpolation('LINEAR');
    nueva.addSampler(s).addChannel(T.createAnimationChannel().setTargetNode(nodo).setTargetPath(camino).setSampler(s));
  };
  for (const [b, datos] of salidaRot) canal(b, 'rotation', datos, 'VEC4');
  canal(pelvisB, 'translation', salidaPel, 'VEC3');
  hechos.push(`${clip} (${nf} fotogramas)`);
}
await io.write(salida, T);
console.log('huesos emparejados', pares.length, '· clips', hechos.join(', '));
