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
import * as THREE from 'three';
import { TRONCO_HOMBRO, MANO_TRONCO } from '../src/personajes/medidas_carga.js';
import { AGARRADERAS, GIRO_EMPUJAR, R_RUEDA } from '../src/juego/carretilla.js';

const TALLER = readFileSync('src/mundo/eleccion.js', 'utf8').match(/TALLER = '(taller-v\d+)'/)[1];
// lo más que se separan los nudillos (middle_01_l y _r) de las agarraderas en los fotogramas de `anim`, con el esqueleto
// de `cuerpo` (un documento de gltf-transform): la postura de cada hueso, en el mundo, con three
function distManos(cuerpo, anim) {
  const obj = new Map(), P = {}, escena = new THREE.Object3D(), padres = new Set();
  for (const n of cuerpo.getRoot().listNodes()) { const o = new THREE.Object3D(); o.name = n.getName(); obj.set(n.getName(), [n, o]); P[o.name] = o; }
  for (const [, [n, o]] of obj) for (const c of n.listChildren()) { o.add(P[c.getName()]); padres.add(c.getName()); }
  for (const [k, [, o]] of obj) if (!padres.has(k)) escena.add(o);
  const canales = anim.listChannels().map(c => ({ o: P[c.getTargetNode().getName()], ruta: c.getTargetPath(), s: c.getSampler() }));
  const n = canales[0].s.getInput().getCount();
  const az = AGARRADERAS.delante + AGARRADERAS.z, ax = 0.223; // la x de las agarraderas: carretilla.js, xEn(s, −U_MANO)
  let peor = 0;
  for (let i = 0; i < n; i++) {
    for (const [, [nd, o]] of obj) { o.position.fromArray(nd.getTranslation()); o.quaternion.fromArray(nd.getRotation()); o.scale.fromArray(nd.getScale()); }
    for (const c of canales) { const v = c.s.getOutput().getElement(i, []); if (c.ruta === 'rotation') c.o.quaternion.fromArray(v); else if (c.ruta === 'translation') c.o.position.fromArray(v); }
    escena.updateMatrixWorld(true);
    for (const [l, s] of [['l', 1], ['r', -1]]) peor = Math.max(peor, P['middle_01_' + l].getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(s * ax, AGARRADERAS.y, az)));
  }
  return peor;
}


// El tronco al hombro (revisión del 1 nov): con el esqueleto del juego, en cada fotograma de `anim`, dónde queda el
// tronco (atado a la clavícula derecha como en src/juego/llevado.js, puesto con la postura de estar quieto) respecto a
// la cabeza, al hombro y a la muñeca derecha. Devuelve lo peor de todos los fotogramas.
function troncoAlHombro(cuerpo, anim, quieto) {
  const obj = new Map(), P = {}, escena = new THREE.Object3D(), padres = new Set();
  for (const n of cuerpo.getRoot().listNodes()) { const o = new THREE.Object3D(); o.name = n.getName(); obj.set(n.getName(), [n, o]); P[o.name] = o; }
  for (const [, [n, o]] of obj) for (const c of n.listChildren()) { o.add(P[c.getName()]); padres.add(c.getName()); }
  for (const [k, [, o]] of obj) if (!padres.has(k)) escena.add(o);
  const reposo = () => { for (const [, [nd, o]] of obj) { o.position.fromArray(nd.getTranslation()); o.quaternion.fromArray(nd.getRotation()); o.scale.fromArray(nd.getScale()); } };
  const poner = (a, i) => { for (const c of a.listChannels()) { const o = P[c.getTargetNode().getName()], v = c.getSampler().getOutput().getElement(i, []); if (!o) continue; if (c.getTargetPath() === 'rotation') o.quaternion.fromArray(v); else if (c.getTargetPath() === 'translation') o.position.fromArray(v); } };
  const W = (o) => o.getWorldPosition(new THREE.Vector3());
  // el tronco se ata con la postura de estar quieto (primer fotograma de Idle_Loop)
  reposo(); poner(quieto, 0); escena.updateMatrixWorld(true);
  const local = P.clavicle_r.worldToLocal(W(P.upperarm_r).add(new THREE.Vector3(TRONCO_HOMBRO.x, TRONCO_HOMBRO.y, TRONCO_HOMBRO.z)));
  const r = { cabeza: Infinity, hueco: -Infinity, huecoMin: Infinity, mano: 0 };
  const n = anim.listChannels()[0].getSampler().getInput().getCount();
  for (let i = 0; i < n; i++) {
    reposo(); poner(anim, i); escena.updateMatrixWorld(true);
    const t = P.clavicle_r.localToWorld(local.clone()), cab = W(P.head), hom = W(P.upperarm_r);
    r.cabeza = Math.min(r.cabeza, Math.abs(t.x - cab.x)); // de lado: la cara no queda detrás del tronco
    const hueco = t.y - TRONCO_HOMBRO.r - hom.y; r.hueco = Math.max(r.hueco, hueco); r.huecoMin = Math.min(r.huecoMin, hueco);
    r.mano = Math.max(r.mano, W(P.hand_r).distanceTo(t.add(new THREE.Vector3(MANO_TRONCO.x, MANO_TRONCO.y, MANO_TRONCO.z))));
  }
  return r;
}

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

// Las de cargar hechas en el taller (taller-carga-v3, herramientas/taller/hacer_cargas.mjs): al hombro andando y quieto,
// arrastrar, y empujar la carretilla andando y quieto. MUTAR_CARGAS=1 las mira en taller-carga-v2 (la mano del tronco
// al hombro subía al cuello): tiene que fallar.
{
  const C1 = `docs/recursos/personajes/${process.env.MUTAR_CARGAS ? 'taller-carga-v2' : 'taller-carga-v3'}`;
  const man = JSON.parse(readFileSync(`${C1}/manifiesto.json`, 'utf8'));
  const CARGAS = ['Hombro_Walk_Loop', 'Hombro_Idle_Loop', 'Drag_Walk_Loop', 'Empujar_Walk_Loop', 'Empujar_Idle_Loop'];
  for (const sexo of ['hombre', 'mujer']) {
    const bytes = readFileSync(`${C1}/mh_${sexo}_extra.glb`);
    comprobar(`cargas ${sexo}: el archivo es el del manifiesto`, createHash('sha256').update(bytes).digest('hex') === man[`mh_${sexo}_extra`]?.sha256);
    const doc = await io.readBinary(new Uint8Array(bytes)), anims = new Map(doc.getRoot().listAnimations().map(a => [a.getName(), a]));
    comprobar(`cargas ${sexo}: solo las 5 de cargar, sin mallas`, anims.size === 5 && CARGAS.every(k => anims.has(k)) && doc.getRoot().listMeshes().length === 0, [...anims.keys()].join(', '));
    comprobar(`cargas ${sexo}: pequeñas (menos de 150 KB)`, bytes.length < 150 * 1024, `${Math.round(bytes.length / 1024)} KB`);
    // andando, las piernas se mueven (salen de andar); quieto, casi nada
    const piernas = (k) => anims.get(k) ? Math.max(...['thigh_l', 'thigh_r'].map(h => giro(anims.get(k), h))) : 0;
    comprobar(`cargas ${sexo}: al hombro, arrastrar y empujar, andan (las piernas giran más de 20°)`, ['Hombro_Walk_Loop', 'Drag_Walk_Loop', 'Empujar_Walk_Loop'].every(k => piernas(k) > 20), ['Hombro_Walk_Loop', 'Drag_Walk_Loop', 'Empujar_Walk_Loop'].map(k => piernas(k).toFixed(0) + '°').join(', '));
    // empujar: en cada fotograma, andando y quieto, los nudillos (middle_01) en las agarraderas de la carretilla
    // (src/juego/carretilla.js, AGARRADERAS: a esa altura y a esa distancia por delante del que la empuja), con el
    // esqueleto del personaje del juego
    if (anims.has('Hombro_Walk_Loop')) {
      const cuerpo = await io.read(`docs/recursos/personajes/${TALLER}/mh_${sexo}.glb`);
      const quieto = cuerpo.getRoot().listAnimations().find(a => a.getName() === 'Idle_Loop');
      for (const k of ['Hombro_Walk_Loop', 'Hombro_Idle_Loop']) {
        const r = troncoAlHombro(cuerpo, anims.get(k), quieto);
        // la cabeza mide unos 15 cm de ancho: el centro del tronco, a más de su radio y media cabeza de ella
        comprobar(`hombro ${sexo} (${k}): el tronco va al lado de la cabeza, sin taparla`, r.cabeza > TRONCO_HOMBRO.r + 0.07, `${(r.cabeza * 100).toFixed(1)} cm de lado entre la cabeza y el centro del tronco`);
        comprobar(`hombro ${sexo} (${k}): apoyado sobre el hombro (de 2 a 9 cm por encima de la articulación)`, r.huecoMin > 0.02 && r.hueco < 0.09, `${(r.huecoMin * 100).toFixed(1)}–${(r.hueco * 100).toFixed(1)} cm`);
        comprobar(`hombro ${sexo} (${k}): la mano derecha encima, sujetándolo (a menos de 4 cm de su sitio)`, r.mano < 0.04, `${(r.mano * 100).toFixed(1)} cm`);
      }
    }
    if (anims.has('Empujar_Walk_Loop')) {
      const cuerpo = await io.read(`docs/recursos/personajes/${TALLER}/mh_${sexo}.glb`);
      for (const k of ['Empujar_Walk_Loop', 'Empujar_Idle_Loop']) {
        const peor = distManos(cuerpo, anims.get(k));
        comprobar(`empujar ${sexo} (${k}): los puños en las varas en todos los fotogramas (a menos de 7 cm)`, peor < 0.07, `${(peor * 100).toFixed(1)} cm`);
      }
    }
  }
}
comprobar('la carretilla va poco levantada empujándola (menos de 25°)', (GIRO_EMPUJAR + Math.asin((0.5 - R_RUEDA) / 1.9)) * 180 / Math.PI < 25, `${((GIRO_EMPUJAR + Math.asin((0.5 - R_RUEDA) / 1.9)) * 180 / Math.PI).toFixed(1)}°`);
comprobar('el juego conoce las de empujar (CLIPS_EXTRA) y su texto en el visor', CLIPS_EXTRA.empujarCarretilla === 'Empujar_Walk_Loop' && CLIPS_EXTRA.empujarQuieto === 'Empujar_Idle_Loop' && !!ANIMS_EXTRA.empujarCarretilla && !!ANIMS_EXTRA.empujarQuieto);
comprobar('el juego conoce las de cargar (CLIPS_EXTRA)', CLIPS_EXTRA.hombro === 'Hombro_Walk_Loop' && CLIPS_EXTRA.hombroQuieto === 'Hombro_Idle_Loop' && CLIPS_EXTRA.arrastrar === 'Drag_Walk_Loop');
comprobar('y su texto en el visor', !!ANIMS_EXTRA.hombro && !!ANIMS_EXTRA.hombroQuieto && !!ANIMS_EXTRA.arrastrar);
console.log(fallos ? `${fallos} fallos` : 'Todo correcto');
process.exit(fallos ? 1 : 0);
