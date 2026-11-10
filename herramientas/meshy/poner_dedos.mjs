// Kinhold — pone huesos de dedos a un personaje de Meshy (valravnx, 10 nov: «¿cómo podríamos hacer que tenga dedos y
// cierre manos?… prueba tú»). El rig de la API de Meshy acaba en la muñeca (24 huesos), pero la malla sí tiene los
// cuatro dedos y el pulgar separados. Aquí, en la postura de reposo:
//   - de cada mano se cogen sus vértices (los que mueve sobre todo el hueso de la mano) y se mide a lo largo del brazo
//     (del antebrazo a la mano), de ancho (lo que más se abren los dedos) y de canto;
//   - los dedos son las islas de malla que quedan más allá de los nudillos (se busca el corte que deja 4 islas);
//     el pulgar, lo que queda por el lado de delante del índice, más corto;
//   - cada dedo lleva 3 huesos (index_01_r… como el esqueleto de antes del juego), hijos del de la mano, colocados por
//     el centro del dedo, y sus vértices pasan a esos huesos por tramos, con mezcla entre tramo y tramo;
//   - en los extras de cada hueso va el eje para cerrarlo (en su espacio) y el signo que lo cierra hacia la palma
//     (src/personajes/meshy.js: cerrarMano).
// Las animaciones no mueven los dedos: quedan como están y el juego los cierra cuando hay algo en la mano.
// Uso: node herramientas/meshy/poner_dedos.mjs <entrada.glb> <salida.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { meshopt } from '@gltf-transform/functions';
import * as THREE from 'three';

const [entrada, salida] = process.argv.slice(2);
const JUNTAR = 0.7; // lo que se acerca cada dedo al centro de la mano (de lado)
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(entrada);
const raiz = doc.getRoot();
const skin = raiz.listSkins()[0];
const prim = raiz.listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
const idx = prim.getIndices().getArray();
const juntas = () => skin.listJoints();
const ibmArr = [...skin.getInverseBindMatrices().getArray()];
const mundoDe = (i) => new THREE.Matrix4().fromArray(ibmArr.slice(i * 16, i * 16 + 16)).invert();
const posDe = (i) => new THREE.Vector3().setFromMatrixPosition(mundoDe(i));
const iDe = (n) => juntas().findIndex(j => j.getName() === n);
const nv = P.getCount();
const pos = Array.from({ length: nv }, (_, i) => new THREE.Vector3().fromArray(P.getElement(i, [])));
// vecinos por los triángulos
const vec = Array.from({ length: nv }, () => new Set());
for (let t = 0; t < idx.length; t += 3) for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) { vec[a].add(b); vec[b].add(a); }
// los vértices de la malla que están en el mismo sitio (costuras de la textura) cuentan como uno
const clave = (v) => v.toArray().map(x => Math.round(x * 2000)).join(',');
const mismo = new Map(); pos.forEach((v, i) => { const k = clave(v); if (!mismo.has(k)) mismo.set(k, []); mismo.get(k).push(i); });
for (const l of mismo.values()) for (const a of l) for (const b of l) if (a !== b) vec[a].add(b);

const B = skin.listJoints().length; // las juntas nuevas van detrás: la k-ésima es la B + k
const nuevas = []; // { nombre, padre (junta de la mano) o padreNueva (k), pos, giro, signo }
const pesos = new Map(); // vértice → [[junta, peso]…]
const marcas = []; // puntos sin peso, hijos de la mano: { nombre, mano, pos }
const informe = {};
for (const [lado, L] of [['l', 'Left'], ['r', 'Right']]) {
  const hi = iDe(L + 'Hand'), fi = iDe(L + 'ForeArm');
  const H = posDe(hi), a = H.clone().sub(posDe(fi)).normalize();
  const jj = [], ww = [];
  const mano = [];
  for (let i = 0; i < nv; i++) { J.getElement(i, jj); W.getElement(i, ww); let w = 0; for (let k = 0; k < 4; k++) if (jj[k] === hi) w += ww[k]; if (w > 0.5) mano.push(i); }
  const t = new Map(mano.map(i => [i, pos[i].clone().sub(H).dot(a)]));
  const tmax = Math.max(...t.values());
  // las islas de lo que queda más allá de un corte
  const islas = (corte) => {
    const dentro = new Set(mano.filter(i => t.get(i) > corte)), vistos = new Set(), r = [];
    for (const i of dentro) { if (vistos.has(i)) continue; const pila = [i], c = []; vistos.add(i);
      while (pila.length) { const x = pila.pop(); c.push(x); for (const y of vec[x]) if (dentro.has(y) && !vistos.has(y)) { vistos.add(y); pila.push(y); } }
      r.push(c); }
    return r;
  };
  let dedos = null, corte = 0;
  for (let f = 0.25; f <= 0.85; f += 0.01) { const r = islas(tmax * f).filter(c => c.length >= 3); if (r.length === 4 && Math.min(...r.map(c => c.length)) >= 0.35 * Math.max(...r.map(c => c.length))) { dedos = r; corte = tmax * f; break; } }
  if (!dedos) {
    // los dedos juntos (pegados unos a otros): lo que queda más allá del 62 % del largo, partido en 4 por lo ancho
    corte = tmax * 0.62;
    const zona = mano.filter(i => t.get(i) > corte);
    const res = zona.map(i => { const d = pos[i].clone().sub(H); return d.addScaledVector(a, -d.dot(a)); });
    const m = res.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(res.length);
    let e = new THREE.Vector3(1, 0.3, 0.2).normalize(); // el eje en que más se abre (iteración de potencia)
    for (let it = 0; it < 30; it++) { const nx = new THREE.Vector3(); for (const v of res) { const d = v.clone().sub(m); nx.addScaledVector(d, d.dot(e)); } e = nx.normalize(); }
    const s = zona.map((i, k) => res[k].dot(e)); const mn = Math.min(...s), mx = Math.max(...s);
    let cen = [0, 1, 2, 3].map(k => mn + (k + 0.5) * (mx - mn) / 4);
    let grupo = [];
    for (let it = 0; it < 15; it++) {
      grupo = s.map(x => cen.reduce((b, c, k) => Math.abs(x - c) < Math.abs(x - cen[b]) ? k : b, 0));
      cen = cen.map((c, k) => { const l = s.filter((_, j) => grupo[j] === k); return l.length ? l.reduce((p, q) => p + q, 0) / l.length : c; });
    }
    dedos = [0, 1, 2, 3].map(k => zona.filter((_, j) => grupo[j] === k)).filter(c => c.length >= 3);
    if (dedos.length !== 4) throw new Error(`${L}: no salen 4 dedos`);
    informe.juntos = (informe.juntos || []).concat(L);
  }
  // el ancho de la mano: de un dedo extremo al otro, sin lo que va a lo largo del brazo
  const centro = (c) => c.reduce((s, i) => s.add(pos[i]), new THREE.Vector3()).divideScalar(c.length);
  const cs = dedos.map(centro);
  let w = cs[0].clone().sub(cs[1]); let mejor = 0;
  for (const p of cs) for (const q of cs) { const d = p.clone().sub(q); d.addScaledVector(a, -d.dot(a)); if (d.length() > mejor) { mejor = d.length(); w = d; } }
  w.normalize();
  // el pulgar va por delante (+Z del personaje): w apunta del meñique al índice
  if (w.z < 0) w.negate();
  const n = new THREE.Vector3().crossVectors(a, w).normalize();
  // la palma: hacia abajo y hacia el cuerpo (en T, las palmas miran abajo; en A, hacia los muslos)
  const haciaCuerpo = new THREE.Vector3(-H.x, 0, 0).normalize();
  const palma = n.clone().multiplyScalar(Math.sign(n.dot(new THREE.Vector3(0, -1, 0)) + n.dot(haciaCuerpo)) || 1);
  dedos.sort((p, q) => centro(q).dot(w) - centro(p).dot(w)); // del índice al meñique
  const NOMBRES = ['index', 'middle', 'ring', 'pinky'];
  const enDedo = new Set(dedos.flat());
  // el pulgar: lo de la mano por delante del índice que no es dedo, más allá de la muñeca
  const sIndice = Math.max(...dedos[0].map(i => pos[i].clone().sub(H).dot(w)));
  const pulgar = mano.filter(i => !enDedo.has(i) && pos[i].clone().sub(H).dot(w) > sIndice + 0.004 && t.get(i) > tmax * 0.15);
  // (valravnx, 10 nov: «junta todos los dedos menos el pulgar en una manopla»): los cuatro, una sola cadena (middle_…),
  // que se dobla entera; el índice y el meñique quedan como puntos de referencia en la mano (para poner lo que se coge)
  const cadenas = [['middle', dedos.flat()]];
  // los cuatro dedos, juntos de lado (cada uno hacia el centro de la mano), para que se vean como una manopla
  {
    const todos = dedos.flat(), sc = todos.reduce((x, i) => x + pos[i].clone().sub(H).dot(w), 0) / todos.length;
    for (const i of todos) { const si = pos[i].clone().sub(H).dot(w); pos[i].addScaledVector(w, (sc - si) * JUNTAR); P.setElement(i, pos[i].toArray()); }
  }
  for (const [k, nombre] of [[0, 'index'], [3, 'pinky']]) {
    const c = [...dedos[k]].sort((p, q) => pos[p].distanceTo(H) - pos[q].distanceTo(H));
    marcas.push({ nombre: `${nombre}_01_${lado}`, mano: hi, pos: centro(c.slice(0, Math.max(3, c.length >> 2))) });
  }
  if (pulgar.length >= 3) cadenas.push(['thumb', pulgar]);
  informe[L] = { dedos: dedos.map(c => c.length), pulgar: pulgar.length, nudillos_cm: +(corte * 100).toFixed(1), largo_cm: +(tmax * 100).toFixed(1) };
  for (const [nombre, c] of cadenas) {
    // a lo largo del dedo: de su base (lo más cerca de la muñeca) a la punta (lo más lejos)
    const d = (i) => pos[i].distanceTo(H);
    const orden = [...c].sort((p, q) => d(p) - d(q));
    const base = centro(orden.slice(0, Math.max(3, orden.length >> 3)));
    const punta = centro(orden.slice(-Math.max(2, orden.length >> 4)));
    const eje = punta.clone().sub(base); const largo = eje.length(); eje.normalize();
    // el pulgar se dobla sobre la palma por su propio eje; los dedos, por el ancho de la mano
    const giro = nombre === 'thumb' ? new THREE.Vector3().crossVectors(eje, palma).normalize() : w.clone();
    // signo: girar con él lleva la punta hacia la palma
    const prueba = eje.clone().applyAxisAngle(giro, 0.3);
    const signo = prueba.dot(palma) > 0 ? 1 : -1;
    const ids = [];
    for (let k = 0; k < 3; k++) {
      const p = base.clone().addScaledVector(eje, largo * k / 3);
      ids.push(B + nuevas.length);
      nuevas.push({ nombre: `${nombre}_0${k + 1}_${lado}`, padre: k === 0 ? hi : null, padreNueva: k ? ids[k - 1] - B : null, pos: p, giro, signo });
    }
    for (const i of c) {
      const u = THREE.MathUtils.clamp(pos[i].clone().sub(base).dot(eje) / largo, 0, 0.999) * 3;
      const k = Math.floor(u), f = u - k;
      // mezcla con el tramo de al lado cerca del corte
      const p = [];
      if (f < 0.25 && k > 0) p.push([ids[k - 1], 0.5 - f * 2], [ids[k], 0.5 + f * 2]);
      else if (f < 0.25 && k === 0) p.push([hi, 0.5 - f * 2], [ids[0], 0.5 + f * 2]);
      else p.push([ids[k], 1]);
      pesos.set(i, p);
    }
  }
}

// los huesos nuevos: nodos hijos de la mano (o del tramo de antes), con la misma orientación que la mano
const mundoNueva = [];
const ibm = [...ibmArr];
const nodoMano = (i) => juntas()[i];
for (const b of nuevas) {
  const padreMundo = b.padre !== null ? mundoDe(b.padre) : mundoNueva[b.padreNueva];
  const q = new THREE.Quaternion(), s = new THREE.Vector3(); padreMundo.decompose(new THREE.Vector3(), q, s);
  const mundo = new THREE.Matrix4().compose(b.pos, q, s);
  mundoNueva.push(mundo);
  const local = padreMundo.clone().invert().multiply(mundo);
  const tL = new THREE.Vector3(), qL = new THREE.Quaternion(), sL = new THREE.Vector3(); local.decompose(tL, qL, sL);
  b.nodo = doc.createNode(b.nombre).setTranslation(tL.toArray()).setRotation(qL.toArray()).setScale(sL.toArray());
  // el eje de cerrar, en el espacio del hueso (la orientación es la de la mano)
  const ejeL = b.giro.clone().applyQuaternion(q.clone().invert()).normalize();
  b.nodo.setExtras({ cerrar: ejeL.toArray().map(x => +x.toFixed(5)), signo: b.signo });
  (b.padre !== null ? nodoMano(b.padre) : nuevas[b.padreNueva].nodo).addChild(b.nodo);
  ibm.push(...mundo.clone().invert().toArray());
}
for (const m of marcas) {
  const M = mundoDe(m.mano), q = new THREE.Quaternion(), s = new THREE.Vector3(); M.decompose(new THREE.Vector3(), q, s);
  const local = new THREE.Vector3().copy(m.pos).applyMatrix4(M.clone().invert());
  juntas()[m.mano].addChild(doc.createNode(m.nombre).setTranslation(local.toArray()));
}
for (const b of nuevas) skin.addJoint(b.nodo);
skin.getInverseBindMatrices().setArray(new Float32Array(ibm));
// los pesos de los vértices de los dedos (la junta de la mano, o B + k de las nuevas)
const Ja = J.getArray(), Wa = W.getArray();
const Jn = new Uint16Array(Ja.length); Jn.set(Ja);
const div = Wa instanceof Uint8Array ? 255 : Wa instanceof Uint16Array ? 65535 : 1;
const Wn = new Float32Array(Wa.length); for (let i = 0; i < Wa.length; i++) Wn[i] = Wa[i] / div;
for (const [i, p] of pesos) for (let k = 0; k < 4; k++) { Jn[i * 4 + k] = p[k] ? p[k][0] : 0; Wn[i * 4 + k] = p[k] ? p[k][1] : 0; }
J.setArray(Jn); W.setArray(Wn).setNormalized(false);
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(salida, doc);
console.log(JSON.stringify(informe), 'huesos nuevos', nuevas.length, 'marcas', marcas.length);
