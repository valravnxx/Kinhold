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
// Correr más suave (Pedro: «la animación de correr me parece fea y exagerada»): la carrera del paquete es de dibujo
// animado (zancada enorme, mucho braceo, cuerpo echado hacia delante y agachado, botes). Se calma por código: el giro
// de cada hueso se acerca a su media en el ciclo (menos vaivén) y la media del tronco se acerca a estar derecho.
// Factores: 1 = como el paquete, 0 = quieto en la media. Se pueden cambiar con variables de entorno para probar.
const f = (n, x) => Number(process.env[n] ?? x);
const SUAVIZAR = { Jog_Fwd_Loop: { brazos: f('S_BRAZOS', 0.5), pegados: f('S_PEGADOS', 0.6), tronco: f('S_TRONCO', 0.55), inclinacion: f('S_INCLINACION', 0.45),
  piernas: f('S_PIERNAS', 0.6), bote: f('S_BOTE', 0.45), agachado: f('S_AGACHADO', 0.4) } };
const grupoDe = (b) => { const n = b.getName().toLowerCase();
  if (ladoBrazo(b) || /^clavicle/.test(n)) return 'brazos';
  if (/^(thigh|calf|foot|ball)/.test(n)) return 'piernas';
  if (/^(pelvis|spine|neck|head)/.test(n)) return 'tronco';
  return null; };
const mediaQ = (lista) => { const s = new THREE.Vector4(), ref = lista[0];
  for (const q of lista) { const k = q.dot(ref) < 0 ? -1 : 1; s.x += k * q.x; s.y += k * q.y; s.z += k * q.z; s.w += k * q.w; }
  return new THREE.Quaternion(s.x, s.y, s.z, s.w).normalize(); };
// giros en el mundo (respecto al reposo) y desplazamiento de la pelvis en cada instante
function girosDe(canales, tiempos) {
  const giros = [], despl = [];
  for (const x of tiempos) {
    const WA = mundoOrigen(canales, x), g = new Map();
    for (const [b, a] of pares) {
      const d = giroDesdeReposo(WA, a);
      if (sesgo.has(b)) d.multiply(sesgo.get(b)); // el tronco, sin la inclinación de estilo del paquete
      const lado = ladoBrazo(b); if (lado) d.premultiply(giroBrazo.get(lado));
      g.set(b, d);
    }
    giros.push(g);
    despl.push(pos(WA.get(pelvisA)).sub(pos(WA0.get(pelvisA))).multiplyScalar(altura));
  }
  return { giros, despl };
}
// hacia dónde apunta de media el brazo (hombro → codo) en un clip
function brazoMedio(giros, lado) {
  const b = B.porNombre.get('upperarm_' + lado), a = A.porNombre.get('upperarm_' + lado);
  const r = pos(WA0.get(A.porNombre.get('lowerarm_' + lado))).sub(pos(WA0.get(a))).normalize();
  const s = new THREE.Vector3(); for (const g of giros) s.add(r.clone().applyQuaternion(g.get(b)));
  return s.normalize();
}
const hechos = [];
for (const clip of CLIPS) {
  const an = S.getRoot().listAnimations().find(a => a.getName() === clip);
  if (!an) { console.log('no está:', clip); continue; }
  const { canales, dur } = canalesDe(an);
  const nf = Math.max(2, Math.round(dur * FPS) + 1), tiempos = new Float32Array(nf);
  const salidaRot = new Map(pares.map(([b]) => [b, new Float32Array(nf * 4)])), salidaPel = new Float32Array(nf * 3);
  for (let fr = 0; fr < nf; fr++) tiempos[fr] = Math.min(dur, fr / FPS);
  const { giros, despl } = girosDe(canales, tiempos);
  // 2) suavizado (solo los clips de SUAVIZAR)
  const su = SUAVIZAR[clip];
  const girosPaquete = giros.map(g => new Map([...g].map(([k, q]) => [k, q.clone()]))), desplPaquete = despl.map(v => v.clone());
  if (su) {
    const ciclo = giros.slice(0, nf - 1); // el último fotograma repite el primero
    for (const [b] of pares) {
      const gr = grupoDe(b); if (!gr) continue;
      let media = mediaQ(ciclo.map(g => g.get(b)));
      if (gr === 'tronco') media = new THREE.Quaternion().slerp(media, su.inclinacion);
      const mediaOrig = mediaQ(ciclo.map(g => g.get(b)));
      for (const g of giros) {
        const resto = mediaOrig.clone().invert().multiply(g.get(b)); // vaivén respecto a la media
        g.set(b, media.clone().multiply(new THREE.Quaternion().slerp(resto, su[gr])));
      }
    }
    // los codos van muy abiertos (de lado): el brazo entero, sin cambiar el codo, se acerca a como cuelga al andar
    const andar = S.getRoot().listAnimations().find(x => x.getName() === 'Walk_Loop');
    if (andar) {
      const ca = canalesDe(andar), ta = []; for (let x = 0; x < ca.dur; x += 1 / FPS) ta.push(x);
      const ga = girosDe(ca.canales, ta).giros;
      for (const lado of ['l', 'r']) {
        const q = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(brazoMedio(ciclo, lado), brazoMedio(ga, lado)), su.pegados);
        for (const g of giros) for (const [b] of pares) if (ladoBrazo(b) === lado) g.get(b).premultiply(q);
      }
    }
    const m = despl.slice(0, nf - 1).reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(nf - 1);
    for (const v of despl) { v.y = m.y * su.agachado + (v.y - m.y) * su.bote; v.x = m.x + (v.x - m.x) * su.tronco; }
  }
  // 3) a giros locales: hace falta el mundo del padre ya animado
  const pies = [];
  const local = (giros, despl, pelvisY) => {
    const altos = [];
    for (let fr = 0; fr < nf; fr++) {
      const WBr = new Map(); for (const [b] of pares) WBr.set(b, giros[fr].get(b).clone().multiply(M.get(b)));
      const mundoB = new Map();
      const deB = (n) => {
        if (mundoB.has(n)) return mundoB.get(n);
        const p = B.padre.get(n), r = B.reposo(n);
        const pw = p ? deB(p) : new THREE.Matrix4();
        let qL = new THREE.Quaternion(...r.r), t = new THREE.Vector3(...r.t);
        if (WBr.has(n)) qL = rot(pw).invert().multiply(WBr.get(n));
        if (n === pelvisB) { // desplazamiento de la pelvis (botes al andar, agacharse)
          const d = despl[fr].clone(); d.y += pelvisY;
          t = pos(WB0.get(pelvisB)).add(d).applyMatrix4(pw.clone().invert());
          salidaPel.set(t.toArray(), fr * 3);
        }
        const w = pw.clone().multiply(new THREE.Matrix4().compose(t, qL, new THREE.Vector3(...r.s)));
        mundoB.set(n, w);
        if (salidaRot.has(n)) salidaRot.get(n).set(qL.toArray(), fr * 4);
        return w;
      };
      for (const [b] of pares) deB(b);
      altos.push(Math.min(...['foot_l', 'foot_r', 'ball_l', 'ball_r'].map(h => pos(mundoB.get(B.porNombre.get(h))).y)));
      if (process.env.VER && fr === 30) {
        const rel = (W, n, p) => pos(W.get(n)).sub(pos(W.get(p))).toArray().map(x => x.toFixed(3));
        console.log(clip, 'destino cabeza', rel(mundoB, B.porNombre.get('head'), pelvisB));
      }
    }
    return altos;
  };
  let altos = local(giros, despl, 0);
  if (su) {
    // con piernas menos dobladas los pies bajan o suben: la pelvis se corrige para que el pie más bajo del ciclo
    // pise donde pisaba en la carrera del paquete
    const orig = local(girosPaquete, desplPaquete, 0);
    const dy = Math.min(...orig) - Math.min(...altos);
    altos = local(giros, despl, dy);
    console.log(clip, 'suavizado: pelvis corregida', (dy * 100).toFixed(1), 'cm');
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
