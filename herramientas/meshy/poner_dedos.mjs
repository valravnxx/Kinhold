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
import { meshopt, dequantize } from '@gltf-transform/functions';
import * as THREE from 'three';

const [entrada, salida] = process.argv.slice(2);
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(entrada);
await doc.transform(dequantize()); // las posiciones y las UV, en números normales (se vuelven a comprimir al final)
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
const manoplas = []; // por mano: los dedos que se quitan y la manopla que va en su lugar
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
  // (valravnx, 10 nov: «manopla es usar la mano con dedos juntos»): los cuatro dedos de la malla, juntos de lado, uno
  // pegado al otro sin hueco y centrados donde estaban; cerca del nudillo se mueven menos (para no rasgar la palma)
  {
    const lat = (i) => pos[i].clone().sub(H).dot(w);
    const info = dedos.map(c => { const l = c.map(lat); return { c, min: Math.min(...l), max: Math.max(...l) }; });
    const anchos = info.map(f => f.max - f.min), total = anchos.reduce((x, y) => x + y, 0);
    const centroTodo = info.reduce((x, f) => x + (f.min + f.max) / 2, 0) / info.length;
    let borde = centroTodo + total / 2; // del índice (lado del pulgar, +w) al meñique
    for (const [k, f] of info.entries()) {
      const nuevo = borde - anchos[k] / 2, mover = nuevo - (f.min + f.max) / 2; borde -= anchos[k];
      const tmin = Math.min(...f.c.map(i => t.get(i))), tmx = Math.max(...f.c.map(i => t.get(i)));
      for (const i of f.c) { const r = THREE.MathUtils.clamp((t.get(i) - tmin) / Math.max(1e-4, (tmx - tmin) * 0.3), 0, 1); pos[i].addScaledVector(w, mover * (0.5 + 0.5 * r)); P.setElement(i, pos[i].toArray()); }
    }
    informe['juntados_' + L] = info.map(f => +((f.max - f.min) * 100).toFixed(1));
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
    const eje = punta.clone().sub(base); let largo = eje.length(); eje.normalize();
    // la manopla, del largo de unos dedos de verdad (de 7,5 a 9,5 cm) aunque la malla los deje cortos o largos
    if (nombre === 'middle') largo = THREE.MathUtils.clamp(largo, 0.075, 0.095);
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
    // pesos suaves: cada vértice, entre el hueso de su tramo y el siguiente (y cerca del nudillo, con la mano), para que
    // al doblarse los dedos de pocos vértices no se arruguen en picos
    const pesoEn = (u01) => {
      const u = THREE.MathUtils.clamp(u01, -0.2, 1) * 3;
      if (u < 0.35) { const f = THREE.MathUtils.clamp((u + 0.6) / 0.95, 0, 1); return [[hi, 1 - f], [ids[0], f]]; }
      const x = Math.min(u - 0.35, 1.999 - 0.0001) / 1.0, k = Math.min(1, Math.floor(x)), f = x - k;
      return [[ids[k], 1 - f], [ids[k + 1], f]];
    };
    for (const i of c) pesos.set(i, pesoEn(pos[i].clone().sub(base).dot(eje) / largo));
    if (nombre === 'middle') {
      // la manopla: los cuatro dedos fuera y en su lugar una pieza de sección ovalada algo cuadrada, del ancho de los
      // cuatro y del grueso de un dedo, que se estrecha un poco hacia la punta
      const lado_ = new THREE.Vector3().crossVectors(palma, eje).normalize(), grueso = new THREE.Vector3().crossVectors(eje, lado_).normalize();
      const rel = c.map(i => pos[i].clone().sub(base));
      const sl = rel.map(v => v.dot(lado_)), sg = rel.map(v => v.dot(grueso));
      const cl = (Math.max(...sl) + Math.min(...sl)) / 2, cg = (Math.max(...sg) + Math.min(...sg)) / 2;
      // (el grueso, el de un dedo de verdad: los dedos de la malla no están a la misma altura y su alto total engaña)
      const hl = Math.min((Math.max(...sl) - Math.min(...sl)) / 2, 0.04), hg = 0.0095; // (como mucho 8 cm de ancho: en T los dedos van abiertos)
      // el color: la UV de un punto del dorso de la mano, para toda la manopla (piel lisa, sin trozos de otras partes)
      const dorso = mano.filter(i => !c.includes(i)).sort((p, q) => Math.abs(t.get(p) - corte * 0.8) - Math.abs(t.get(q) - corte * 0.8))[0];
      manoplas.push({ quitar: new Set(c), base, eje, largo, lado: lado_, grueso, cl, cg, hl, hg, pesoEn, uv: dorso });
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
let Jn2, Wn2;
const div = Wa instanceof Uint8Array ? 255 : Wa instanceof Uint16Array ? 65535 : 1;
const Wn = new Float32Array(Wa.length); for (let i = 0; i < Wa.length; i++) Wn[i] = Wa[i] / div;
for (const [i, p] of pesos) for (let k = 0; k < 4; k++) { Jn[i * 4 + k] = p[k] ? p[k][0] : 0; Wn[i * 4 + k] = p[k] ? p[k][1] : 0; }
// la manopla: anillos a lo largo, cerrada en la punta; sus UV, las del vértice de los dedos más cercano (el color de la piel)
const N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0');
const nP = [], nN = [], nT = [], nJ = [], nW = [];
let tri = [...idx];
const quitar = new Set(); // (los dedos de la malla se quedan: la manopla son esos mismos dedos, juntos)
tri = (() => { const r = []; for (let k = 0; k < tri.length; k += 3) if (!quitar.has(tri[k]) && !quitar.has(tri[k + 1]) && !quitar.has(tri[k + 2])) r.push(tri[k], tri[k + 1], tri[k + 2]); return r; })();
let siguiente = nv;
const LADOS = 12, ANILLOS = [-0.35, -0.1, 0.2, 0.45, 0.7, 0.9]; // (empieza dentro de la palma: tapa el hueco de los dedos quitados)
for (const m of []) {
  const cerca = (p) => { let b = -1, d = Infinity; for (const i of m.quitar) { const x = pos[i].distanceToSquared(p); if (x < d) { d = x; b = i; } } return b; };
  const anillo0 = siguiente;
  for (const [ka, u] of ANILLOS.entries()) {
    const estrecha = u > 0.75 ? 0.82 : u > 0.5 ? 0.94 : 1;
    for (let k = 0; k < LADOS; k++) {
      const ang = (k / LADOS) * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
      const cx = Math.sign(c) * Math.abs(c) ** 0.6, sy = Math.sign(sn) * Math.abs(sn) ** 0.6; // óvalo algo cuadrado
      const p = m.base.clone().addScaledVector(m.eje, m.largo * u).addScaledVector(m.lado, m.cl + cx * m.hl * estrecha).addScaledVector(m.grueso, m.cg + sy * m.hg * estrecha);
      const nrm = m.lado.clone().multiplyScalar(c).addScaledVector(m.grueso, sn).normalize();
      nP.push(...p.toArray()); nN.push(...nrm.toArray()); nT.push(...T.getElement(m.uv, []));
      const pw = m.pesoEn(Math.max(0, u)); for (let j = 0; j < 4; j++) { nJ.push(pw[j] ? pw[j][0] : 0); nW.push(pw[j] ? pw[j][1] : 0); }
      siguiente++;
    }
  }
  // la punta
  const punta = m.base.clone().addScaledVector(m.eje, m.largo * 1.0).addScaledVector(m.lado, m.cl).addScaledVector(m.grueso, m.cg);
  nP.push(...punta.toArray()); nN.push(...m.eje.toArray()); nT.push(...T.getElement(m.uv, []));
  { const pw = m.pesoEn(0.99); for (let j = 0; j < 4; j++) { nJ.push(pw[j] ? pw[j][0] : 0); nW.push(pw[j] ? pw[j][1] : 0); } }
  const iPunta = siguiente++;
  for (let a_ = 0; a_ < ANILLOS.length - 1; a_++) for (let k = 0; k < LADOS; k++) {
    const i0 = anillo0 + a_ * LADOS + k, i1 = anillo0 + a_ * LADOS + (k + 1) % LADOS, j0 = i0 + LADOS, j1 = i1 + LADOS;
    tri.push(i0, i1, j0, i1, j1, j0); // (hacia fuera)
  }
  const ult = anillo0 + (ANILLOS.length - 1) * LADOS;
  for (let k = 0; k < LADOS; k++) tri.push(ult + k, ult + (k + 1) % LADOS, iPunta);
}
const junta = (a_, b_) => { const r = new a_.constructor(a_.length + b_.length); r.set(a_); r.set(b_, a_.length); return r; };
P.setArray(junta(P.getArray(), new Float32Array(nP)));
N.setArray(junta(N.getArray(), new Float32Array(nN)));
T.setArray(junta(T.getArray(), new Float32Array(nT)));
Jn2 = junta(Jn, new Uint16Array(nJ)); Wn2 = junta(Wn, new Float32Array(nW));
// los triángulos de la manopla miran hacia fuera: si salen al revés (según el orden), se dan la vuelta
prim.getIndices().setArray(new Uint32Array(tri));
J.setArray(Jn2); W.setArray(Wn2).setNormalized(false);


await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(salida, doc);
console.log(JSON.stringify(informe), 'huesos nuevos', nuevas.length, 'marcas', marcas.length);
