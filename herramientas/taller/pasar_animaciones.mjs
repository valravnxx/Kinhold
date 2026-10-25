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
  // solo los brazos y las manos cambian de verdad de postura (brazos en «A» → en cruz). El tronco, la pelvis y las
  // piernas ya están de pie en los dos: si se «igualan», las pequeñas diferencias de cómo están puestos los huesos
  // (la pelvis apunta 35° distinto) doblan el cuerpo hacia delante (fallo de la v5/v6, lo vio Pedro)
  // la clavícula tampoco: si se iguala, el hombro se va hacia atrás (Pedro: «hombros muy para atrás»)
  const brazo = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(b.getName().toLowerCase());
  if (!brazo) q = new THREE.Quaternion();
  else if (hb && ha) {
    const db = pos(WB0.get(hb)).sub(pos(WB0.get(b))).normalize(), da = pos(WA0.get(ha)).sub(pos(WA0.get(a))).normalize();
    q = new THREE.Quaternion().setFromUnitVectors(db, da);
  }
  if (q && process.env.VER) console.log(b.getName().padEnd(14), (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI).toFixed(1), '°');
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
function canalesDe(an) {
  const canales = new Map(); let dur = 0;
  for (const c of an.listChannels()) {
    const n = c.getTargetNode(); if (!n) continue;
    if (!canales.has(n)) canales.set(n, {});
    canales.get(n)[c.getTargetPath()] = muestreador(c.getSampler());
    dur = Math.max(dur, c.getSampler().getInput().getMax([])[0]);
  }
  return { canales, dur };
}
const mundoOrigen = (canales, x) => A.mundo((n) => {
  const r = A.reposo(n), c = canales.get(n);
  return c ? { t: c.translation ? c.translation(x) : r.t, r: c.rotation ? c.rotation(x) : r.r, s: r.s } : r;
});
const giroDesdeReposo = (WA, a) => rot(WA.get(a)).multiply(RA0.get(a).clone().invert());
// Postura: las animaciones del paquete van con el cuello y la cabeza adelantados (estilo de sus muñecos de cabeza grande).
// En un cuerpo de proporciones reales queda encorvado (Pedro: «doblado hacia adelante»). Se mide esa inclinación en
// la animación de estar quieto y se quita de todas, dejando solo una parte (ENDEREZAR = cuánto se quita).
const ENDEREZAR = Number(process.env.ENDEREZAR ?? 0.7);
const TRONCO = ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'clavicle_l', 'clavicle_r']; // con las clavículas: si no, los hombros se quedan adelantados
const sesgo = new Map();
{
  const { canales, dur } = canalesDe(S.getRoot().listAnimations().find(a => a.getName() === 'Idle_Loop'));
  for (const nombre of TRONCO) {
    const a = A.porNombre.get(nombre), suma = new THREE.Vector4(); let ref = null;
    for (let x = 0; x <= dur; x += 1 / FPS) {
      const q = giroDesdeReposo(mundoOrigen(canales, x), a);
      if (ref && q.dot(ref) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      ref = ref || q.clone(); suma.add(new THREE.Vector4(q.x, q.y, q.z, q.w));
    }
    const media = new THREE.Quaternion(suma.x, suma.y, suma.z, suma.w).normalize();
    // corrección = media⁻¹ · (parte de la media que se deja)
    sesgo.set(B.porNombre.get(nombre), media.clone().invert().premultiply(new THREE.Quaternion().slerp(media, 1 - ENDEREZAR)));
  }
}
// Brazos: en las animaciones del paquete los brazos cuelgan unos 14° hacia atrás (va con su cuerpo inclinado hacia
// delante). Con el tronco enderezado quedan por detrás del cuerpo. Se mide su ángulo al estar quieto y se gira todo
// el brazo desde el hombro, en todas las animaciones, para que cuelgue recto (DELANTE_BRAZO grados hacia delante).
const DELANTE_BRAZO = Number(process.env.DELANTE_BRAZO ?? 0);
const giroBrazo = new Map(); // 'l' / 'r' → giro en el mundo para toda la cadena del brazo
{
  // un mismo giro para los dos brazos (la media de los dos): el quieto del paquete es asimétrico a propósito
  const { canales, dur } = canalesDe(S.getRoot().listAnimations().find(a => a.getName() === 'Idle_Loop'));
  let suma = 0, n = 0;
  for (let x = 0; x <= dur; x += 1 / FPS) {
    const WA = mundoOrigen(canales, x);
    for (const lado of ['l', 'r']) {
      const d = pos(WA.get(A.porNombre.get('lowerarm_' + lado))).sub(pos(WA.get(A.porNombre.get('upperarm_' + lado))));
      suma += Math.atan2(d.z, -d.y); n++; // ángulo hacia delante (z) respecto a la vertical
    }
  }
  const angulo = suma / n, falta = DELANTE_BRAZO * Math.PI / 180 - angulo;
  // girar alrededor del eje lateral (x): llevar -y hacia +z es un giro negativo
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -falta);
  giroBrazo.set('l', q); giroBrazo.set('r', q);
  if (process.env.VER) console.log('brazos: cuelgan', (angulo * 180 / Math.PI).toFixed(1), '° → se giran', (falta * 180 / Math.PI).toFixed(1), '°');
}
const ladoBrazo = (b) => { const m = b.getName().toLowerCase().match(/^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb).*_([lr])$/); return m && m[2]; };
const hechos = [];
for (const clip of CLIPS) {
  const an = S.getRoot().listAnimations().find(a => a.getName() === clip);
  if (!an) { console.log('no está:', clip); continue; }
  const { canales, dur } = canalesDe(an);
  const nf = Math.max(2, Math.round(dur * FPS) + 1), tiempos = new Float32Array(nf);
  const salidaRot = new Map(pares.map(([b]) => [b, new Float32Array(nf * 4)])), salidaPel = new Float32Array(nf * 3);
  for (let f = 0; f < nf; f++) {
    const x = Math.min(dur, f / FPS); tiempos[f] = x;
    const WA = mundoOrigen(canales, x);
    // giros en el mundo del destino (el tronco, sin la inclinación de estilo del paquete)
    const WBr = new Map();
    for (const [b, a] of pares) {
      const d = giroDesdeReposo(WA, a);
      if (sesgo.has(b)) d.multiply(sesgo.get(b));
      const lado = ladoBrazo(b); if (lado) d.premultiply(giroBrazo.get(lado));
      WBr.set(b, d.multiply(M.get(b)));
    }
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
    if (process.env.VER && f === 30) { // postura: dónde quedan cuello y cabeza respecto a la pelvis (adelante = +z)
      const rel = (W, n, p) => pos(W.get(n)).sub(pos(W.get(p))).toArray().map(x => x.toFixed(3));
      console.log(clip, 'origen cabeza', rel(WA, A.porNombre.get('head'), pelvisA), 'destino cabeza', rel(mundoB, B.porNombre.get('head'), pelvisB));
      for (const h of ['upperarm_l', 'lowerarm_l', 'hand_l']) console.log(clip, h, 'origen', rel(WA, A.porNombre.get(h), pelvisA), 'destino', rel(mundoB, B.porNombre.get(h), pelvisB), 'reposo destino', rel(WB0, B.porNombre.get(h), pelvisB));
      console.log(clip, 'reposo origen', rel(WA0, A.porNombre.get('head'), pelvisA), 'reposo destino', rel(WB0, B.porNombre.get('head'), pelvisB));
    }
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
