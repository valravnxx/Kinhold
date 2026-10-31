// Animaciones de cargar hechas en el taller (roadmap, «Equipo y carga», valravnx 31 oct: «las tratamos de hacer
// nosotros»): llevar al hombro (andando y quieto) y arrastrar (la rastra), a partir de las del taller que ya hay
// (andar y estar quieto, Walk_Loop e Idle_Loop; la mano cerrada de llevar en brazos, Walk_Carry_Loop), moviendo el
// tronco y los brazos por código sobre el mismo esqueleto «game_engine» de MakeHuman.
//
// Cómo (lo habitual para retocar animaciones por capas, «additive layer» + IK de dos huesos):
//   1. En cada fotograma se pone la postura de la animación de partida (las piernas y la cadera quedan tal cual).
//   2. El tronco se inclina girando un poco cada vértebra en el mundo (spine_01, _02, _03).
//   3. Cada brazo que sujeta algo va por IK de dos huesos (brazo y antebrazo): la mano a un punto fijo respecto al
//      pecho (al hombro) o a la cadera (arrastrar), con el codo hacia donde se dobla un brazo de verdad.
//   4. Los dedos, cerrados como al llevar en brazos.
// Uso: node herramientas/taller/hacer_cargas.mjs <personaje.glb> <salida.glb>
//   La salida lleva solo el esqueleto y las tres animaciones nuevas (como SOLO_ANIM=1 de pasar_animaciones.mjs); luego
//   EXTRA=1 node herramientas/taller/preparar_mh.mjs la comprime para la web.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';

const [entrada, salida] = process.argv.slice(2);
const FPS = 30;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const T = await io.read(entrada);
for (const d of T.getRoot().listExtensionsUsed()) if (d.extensionName === 'EXT_meshopt_compression') d.dispose();
const raizDoc = T.getRoot();

// ---- el esqueleto como objetos de three (para medir en el mundo) ----
const obj = new Map(), porNombre = {};
for (const n of raizDoc.listNodes()) { const o = new THREE.Object3D(); o.name = n.getName(); obj.set(n, o); porNombre[o.name] = o; }
const escena = new THREE.Object3D();
const padres = new Set();
for (const n of raizDoc.listNodes()) for (const c of n.listChildren()) { obj.get(n).add(obj.get(c)); padres.add(c); }
for (const n of raizDoc.listNodes()) if (!padres.has(n)) escena.add(obj.get(n));
const reposo = () => { for (const [n, o] of obj) { o.position.fromArray(n.getTranslation()); o.quaternion.fromArray(n.getRotation()); o.scale.fromArray(n.getScale()); } };

// muestras de un clip en el tiempo t (lineal / slerp), para todos sus canales
const clips = new Map(raizDoc.listAnimations().map(a => [a.getName(), a]));
function muestrear(anim, t) {
  for (const c of anim.listChannels()) {
    const n = c.getTargetNode(), o = obj.get(n), s = c.getSampler(), ti = s.getInput().getArray(), v = s.getOutput(), ruta = c.getTargetPath();
    const dur = ti[ti.length - 1], tt = dur > 0 ? Math.min(t, dur) : 0;
    let i = 0; while (i < ti.length - 2 && ti[i + 1] < tt) i++;
    const f = ti.length > 1 && ti[i + 1] > ti[i] ? THREE.MathUtils.clamp((tt - ti[i]) / (ti[i + 1] - ti[i]), 0, 1) : 0;
    const a = v.getElement(i, []), b = v.getElement(Math.min(i + 1, v.getCount() - 1), []);
    if (ruta === 'rotation') o.quaternion.fromArray(a).slerp(new THREE.Quaternion().fromArray(b), f);
    else if (ruta === 'translation') o.position.fromArray(a).lerp(new THREE.Vector3().fromArray(b), f);
  }
}
const duracion = (anim) => Math.max(...anim.listSamplers().map(s => s.getInput().getMax([])[0]));

// ---- ayudas en el mundo ----
const W = (o) => { escena.updateMatrixWorld(true); return o.getWorldPosition(new THREE.Vector3()); };
const WQ = (o) => { escena.updateMatrixWorld(true); return o.getWorldQuaternion(new THREE.Quaternion()); };
// gira un hueso `q` en el mundo (alrededor de su propio origen)
function girarMundo(o, q) {
  const pq = WQ(o.parent), wq = WQ(o);
  o.quaternion.copy(pq.clone().invert().multiply(q.clone().multiply(wq)));
}
// que el hueso `o` apunte con su hijo `h` hacia `destino` (en el mundo)
function apuntar(o, h, destino) {
  const a = W(o), dir = W(h).sub(a).normalize(), nueva = destino.clone().sub(a).normalize();
  girarMundo(o, new THREE.Quaternion().setFromUnitVectors(dir, nueva));
}
// IK de dos huesos: hombro (brazo) → codo (antebrazo) → muñeca (mano) a `objetivo`, con el codo hacia `polo`
function ik(brazo, antebrazo, mano, objetivo, polo) {
  const S = W(brazo), E = W(antebrazo), M = W(mano);
  const a = S.distanceTo(E), b = E.distanceTo(M);
  const d = THREE.MathUtils.clamp(S.distanceTo(objetivo), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const eje = objetivo.clone().sub(S).normalize();
  // el codo en el plano de (eje, polo), a la distancia que dan los dos largos
  const x = (a * a - b * b + d * d) / (2 * d), y = Math.sqrt(Math.max(0, a * a - x * x));
  const p = polo.clone().sub(eje.clone().multiplyScalar(polo.dot(eje))).normalize();
  const codo = S.clone().add(eje.clone().multiplyScalar(x)).add(p.multiplyScalar(y));
  apuntar(brazo, antebrazo, codo);
  apuntar(antebrazo, mano, S.clone().add(eje.multiplyScalar(d)));
}
const inclinar = (grados, eje) => { // repartido entre las tres vértebras
  for (const v of ['spine_01', 'spine_02', 'spine_03']) girarMundo(porNombre[v], new THREE.Quaternion().setFromAxisAngle(eje, THREE.MathUtils.degToRad(grados / 3)));
};

// el personaje mira a +Z, su izquierda en +X, arriba +Y (como en el juego)
const ARRIBA = new THREE.Vector3(0, 1, 0), DELANTE = new THREE.Vector3(0, 0, 1), IZQ = new THREE.Vector3(1, 0, 0);
const DEDOS = /^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/;
// la mano cerrada (agarrando), del primer fotograma de llevar en brazos
const cerrada = {};
{ reposo(); muestrear(clips.get('Walk_Carry_Loop'), 0); for (const o of Object.values(porNombre)) if (DEDOS.test(o.name)) cerrada[o.name] = o.quaternion.clone(); }

// En el pecho (spine_03), los puntos de cada carga. Medidas en m, respecto al hombro derecho (upperarm_r) en reposo
// del clip, en los ejes del personaje: decisiones provisionales, mirando las capturas.
const NUEVAS = {
  // al hombro, andando: el tronco corto sobre el hombro derecho (src/juego/llevado.js lo pone ahí), la mano derecha
  // encima, sujetándolo; el tronco se inclina un poco hacia la izquierda (contrapeso) y adelante. La izquierda, libre.
  Hombro_Walk_Loop: { de: 'Walk_Loop', hombro: true },
  Hombro_Idle_Loop: { de: 'Idle_Loop', hombro: true },
  // arrastrar la rastra: inclinado adelante, los brazos casi estirados a los lados, un poco por detrás de la cadera,
  // agarrando las dos varas
  Drag_Walk_Loop: { de: 'Walk_Loop', arrastrar: true },
};
function postura(cfg) {
  const pecho = porNombre.spine_03, cadera = porNombre.pelvis;
  if (cfg.hombro) {
    inclinar(5, DELANTE.clone().negate());          // hacia la izquierda (contrapeso del tronco a la derecha)
    inclinar(5, IZQ);                                // y un poco adelante
    girarMundo(porNombre.clavicle_r, new THREE.Quaternion().setFromAxisAngle(DELANTE, THREE.MathUtils.degToRad(-6))); // el hombro arriba
    // la mano sobre el tronco: encima del hombro y algo por delante, con el codo hacia delante y abajo
    const s = W(porNombre.upperarm_r);
    const objetivo = s.clone().add(new THREE.Vector3(-0.06, 0.13, 0.07)); // la derecha es −X
    ik(porNombre.upperarm_r, porNombre.lowerarm_r, porNombre.hand_r, objetivo, new THREE.Vector3(-0.25, -1, 0.9).normalize());
    // la palma sobre el tronco: los dedos por encima, hacia atrás y algo hacia dentro
    const m = porNombre.hand_r;
    apuntar(m, porNombre.middle_01_r, W(m).add(new THREE.Vector3(0.08, 0.05, -1)));
    for (const [k, v] of Object.entries(cerrada)) if (k.endsWith('_r')) porNombre[k].quaternion.copy(v);
  }
  if (cfg.arrastrar) {
    inclinar(14, IZQ);                               // adelante
    for (const [lado, s] of [['l', 1], ['r', -1]]) {
      const p = W(cadera), h = W(porNombre['upperarm_' + lado]);
      const objetivo = new THREE.Vector3(h.x + s * 0.07, p.y - 0.06, p.z - 0.2);
      ik(porNombre['upperarm_' + lado], porNombre['lowerarm_' + lado], porNombre['hand_' + lado], objetivo, new THREE.Vector3(s * 0.6, 0, -1).normalize());
      for (const [k, v] of Object.entries(cerrada)) if (k.endsWith('_' + lado)) porNombre[k].quaternion.copy(v);
    }
  }
}

// ---- hacer cada clip: todos los huesos (rotación) y la pelvis (también su posición), a 30 fps ----
const buf = raizDoc.listBuffers()[0];
const huesos = raizDoc.listSkins()[0].listJoints();
const hechos = [];
for (const [nombre, cfg] of Object.entries(NUEVAS)) {
  const base = clips.get(cfg.de), dur = duracion(base), N = Math.max(2, Math.round(dur * FPS) + 1);
  const tiempos = new Float32Array(N), rot = new Map(huesos.map(h => [h, new Float32Array(N * 4)])), tra = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = dur * i / (N - 1); tiempos[i] = t;
    reposo(); muestrear(base, t); postura(cfg);
    for (const h of huesos) { const q = obj.get(h).quaternion.normalize(); rot.get(h).set([q.x, q.y, q.z, q.w], i * 4); }
    const pv = porNombre.pelvis.position; tra.set([pv.x, pv.y, pv.z], i * 3);
  }
  const anim = T.createAnimation(nombre);
  const ent = T.createAccessor().setType('SCALAR').setArray(tiempos).setBuffer(buf);
  const canal = (nodo, ruta, tipo, datos) => {
    const s = T.createAnimationSampler().setInput(ent).setOutput(T.createAccessor().setType(tipo).setArray(datos).setBuffer(buf)).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(T.createAnimationChannel().setTargetNode(nodo).setTargetPath(ruta).setSampler(s));
  };
  for (const h of huesos) canal(h, 'rotation', 'VEC4', rot.get(h));
  canal(huesos.find(h => h.getName() === 'pelvis'), 'translation', 'VEC3', tra);
  hechos.push(`${nombre} (${dur.toFixed(2)} s, de ${cfg.de})`);
}
// fuera las de partida: solo quedan las nuevas
for (const a of [...clips.values()]) a.dispose();
for (const n of raizDoc.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const x of [...raizDoc.listMeshes(), ...raizDoc.listSkins(), ...raizDoc.listMaterials(), ...raizDoc.listTextures()]) x.dispose();
await T.transform(prune({ keepLeaves: true }));
await io.write(salida, T);
console.log('clips', hechos.join(', '));
