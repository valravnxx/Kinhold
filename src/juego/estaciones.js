// Kinhold — las estaciones de fabricar en el mundo (P3, «De nada a una casa»): la piedra de tallar, la hoguera y el
// banco de tronco, donde se pusieron. La lógica (dónde está cada una, sus colas) es la de src/logica/fabricacion.js; en
// línea, las estaciones las manda el servidor ({ tipo: 'estaciones' }, la bienvenida y los trozos) y aquí solo se
// dibujan, con el estilo v5 (los mismos modelos de piedra, ramas y troncos que lo que se recoge y lo del suelo).
//
// Cómo se ve cada una (provisional, hasta las tareas de la hoguera y del banco de tronco, que traen su modelo propio):
//  - piedra de tallar: una losa ancha y baja, con una piedra de percutir y unas lascas al lado.
//  - hoguera: un círculo de piedras con las ramas apoyadas en el centro. Su fuego (src/logica/fuego.js): encendida,
//    brasas, llamas que se mueven, humo que sube y luz (la pone main.js, con las de las chimeneas); apagada después de
//    arder, las cenizas (y las ramas, solo si tiene algo puesto sin arder).
//  - banco de tronco: dos troncos cortos, uno de pie (el tajo) y otro tumbado al lado.
//  - los almacenajes (7 nov): el acopio de troncos (durmientes y dos pares de estacas de vara), la pila de piedras (un
//    lecho de losas) y la leñera (tejadillo de ramas sobre cuatro postes); lo guardado se ve puesto como se guarda de
//    verdad y llena el almacenaje hasta lo que le cabe (los troncos en filas, las piedras en montón, la leña apilada).
//    Y (8 nov) el soporte de varas (dos caballetes en aspa), el almiar (el palo hincado sobre dos varas cruzadas), el
//    hoyo de barro (cavado y bordeado de piedras) y el cesto (de juncos trenzados): las varas tumbadas en la horquilla,
//    la paja en montón alrededor del palo y los juncos de pie apoyados en él, el barro llenando el hoyo y lo pequeño
//    subiendo dentro del cesto.
//  - las camas (8 nov): el refugio de ramas (tejadillo a un agua sobre un travesaño, con ramaje verde encima y un
//    lecho seco dentro) y la cama de juncos (un lecho de juncos en capas entre dos varas, atado con cordel y con su
//    almohada de juncos).
// Lo depositado en cada una (valravnx, 6 nov) se ve puesto, con los mismos modelos que lo del suelo: encima de la losa
// de la piedra de tallar y del tajo del banco (lo que no cabe encima, al pie); junto a la hoguera, alrededor del
// círculo de piedras. Cada tipo, su montón.
// Los puestos son obra (valravnx, 6 nov): mientras no se levantan, se ven como las obras de construcción (src/juego/
// main.js, «Obras»): el puesto muy tenue, como un trazado, dentro de un armazón de varas atadas (cuatro estacas con
// dos vueltas de cordel), y lo que ya se le ha llevado, al pie, en su montón. Cuanto más trabajo lleva, menos tenue.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { modelosRecoleccion } from './recoleccion.js';
import { limpiarDeposito, limpiarObra, ESTACIONES } from '../logica/fabricacion.js';
import { estadoFuego } from '../logica/fuego.js';
import { moverHumo } from '../mundo/modelos.js';
import { troncosConCortes, deLista, modeloDe } from './suelo.js';
import { loteEnMano, loteEspalda } from './llevado.js';
import { modeloHacha } from './personaje.js';
import { modeloHachaPiedra } from './modelos_objetos.js';

const az = (id, k) => { let h = 2166136261; for (const ch of id + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
const mallas = L => {
  const grupos = L.cerrar(null, true), g = new THREE.Group();
  for (const [tex, geos] of Object.entries(grupos)) {
    const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m);
  }
  return g;
};

// una piedra irregular: cada vértice se mueve un poco hacia fuera o hacia dentro (los que coinciden, igual)
function piedraIrregular(r, detalle, id, fuerza = 0.22) {
  const g = new THREE.IcosahedronGeometry(r, detalle), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (az(id, `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`) - 0.5) * 2 * fuerza;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  return g;
}

function piedraTallar(id) {
  const L = new Lote({ rangoSuelo: 0.25, variacion: 0.06 });
  L.add(piedraIrregular(0.36, 1, id), 'piedra', 0, 0.11, 0, { y: az(id, 1) * 6, z: 0.05 }, { escala: new THREE.Vector3(1.3, 0.5, 1), plano: true });
  L.add(piedraIrregular(0.18, 1, id + 'b'), 'piedraOsc', 0.44, 0.05, 0.3, { y: 0.7 }, { escala: new THREE.Vector3(1.2, 0.5, 1), plano: true });
  L.add(piedraIrregular(0.075, 1, id + 'c', 0.15), 'piedra', 0.08, 0.27, -0.05, { y: 1.3 }, { escala: new THREE.Vector3(1.2, 0.85, 1), plano: true, sinSuelo: true }); // la de percutir
  for (let k = 0; k < 5; k++) { // lascas sueltas
    const a = 2.2 + k * 0.5, d = 0.55 + az(id, k + 10) * 0.12;
    L.add(new THREE.TetrahedronGeometry(0.035, 0), 0x6b6762, Math.cos(a) * d, 0.012, Math.sin(a) * d, { y: k, x: 1.2 }, { escala: new THREE.Vector3(1.4, 0.35, 1), plano: true, tex: 'piedra' });
  }
  return mallas(L);
}

function hoguera(id) {
  const g = new THREE.Group(), mods = modelosRecoleccion();
  for (let i = 0; i < 8; i++) { // el círculo de piedras
    const p = deLista(mods.piedra), a = i * Math.PI / 4 + az(id, i) * 0.3;
    p.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); p.rotation.y = a + az(id, i + 20); p.scale.setScalar(1.1 + az(id, i + 40) * 0.35);
    g.add(p);
  }
  const L = new Lote({ rangoSuelo: 0.3, variacion: 0.08 });
  L.add(new THREE.CircleGeometry(0.4, 12), 0x4f4840, 0, 0.012, 0, { x: -Math.PI / 2 }, { sinSuelo: true }); // tierra quemada
  g.add(mallas(L));
  const R = new Lote({ rangoSuelo: 0.3, variacion: 0.08 });
  for (let i = 0; i < 4; i++) { // las ramas, apoyadas unas en otras (lo que tiene puesto para arder)
    const a = i * Math.PI / 2 + 0.4, largo = 0.62;
    const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.62));
    R.add(cil(0.028, 0.038, largo, 6), 'corteza', Math.cos(a) * 0.17, largo * 0.4, -Math.sin(a) * 0.17, m);
  }
  const ramas = mallas(R); ramas.name = 'ramas'; g.add(ramas);
  return g;
}

// ---------- el fuego de la hoguera ----------
const MAT_BRASA = new THREE.MeshLambertMaterial({ color: 0xc2541c, emissive: 0xc2541c, emissiveIntensity: 0.9 });
const MAT_CENIZA = new THREE.MeshLambertMaterial({ color: 0x8d8780 });
const MAT_TIZON = new THREE.MeshLambertMaterial({ color: 0x2b2420 });
const MAT_LLAMA = new THREE.MeshLambertMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 1 });
const MAT_NUCLEO = new THREE.MeshLambertMaterial({ color: 0xffc870, emissive: 0xffc870, emissiveIntensity: 1 });
// Lo que se ve del fuego según su estado: 'ardiendo' (brasas, llamas y humo), 'cenizas' (ceniza y tizones) o nada.
export function modeloFuego(cual, id) {
  const g = new THREE.Group(); g.name = 'fuego';
  g.userData.humo = { x: 0, y: 0.35, z: 0 }; g.userData.fuego = { x: 0, y: 0.35, z: 0 };
  if (cual === 'cenizas' || cual === 'ardiendo') {
    const lecho = new THREE.Mesh(piedraIrregular(0.26, 1, id + 'ceniza', 0.12), cual === 'ardiendo' ? MAT_BRASA : MAT_CENIZA);
    lecho.scale.set(1, 0.12, 1); lecho.position.y = 0.02; lecho.name = cual === 'ardiendo' ? 'llama' : 'ceniza'; g.add(lecho);
    for (let i = 0; i < 3; i++) { // tizones: restos de rama quemados
      const a = i * 2.1 + az(id, 60 + i), t = new THREE.Mesh(cil(0.02, 0.026, 0.3, 5), MAT_TIZON);
      t.position.set(Math.cos(a) * 0.1, 0.04, Math.sin(a) * 0.1); t.rotation.set(Math.PI / 2 - 0.15, 0, a); g.add(t);
    }
  }
  if (cual === 'ardiendo') {
    const llamas = [[-0.08, 0.04, 0.36, 0.09], [0.07, -0.05, 0.42, 0.1], [0.05, 0.08, 0.3, 0.08], [-0.06, -0.07, 0.28, 0.07], [0, 0, 0.22, 0.06]];
    llamas.forEach(([x, z, h, r], i) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), i === llamas.length - 1 ? MAT_NUCLEO : MAT_LLAMA);
      m.geometry.translate(0, h / 2, 0); m.position.set(x, 0.08, z); m.name = 'llama'; m.userData.fase = i * 1.7; g.add(m);
    });
    for (let i = 0; i < 10; i++) { // el humo, tenue: bocanadas pequeñas que suben, se abren y se deshacen
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: 0x8f8a84, transparent: true, opacity: 0, depthWrite: false, fog: true }));
      m.name = 'humo'; m.userData.fase = i / 10; g.add(m);
    }
    moverFuego(g, 0);
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = m.name === 'ceniza'; } });
  return g;
}
// Mueve las llamas (como las de las chimeneas) y el humo de la hoguera: más tenue y más fino que el de una chimenea,
// porque sale a la altura de los ojos, y sin luz propia (si no, la del fuego lo pinta en discos naranjas) (t: segundos).
function moverFuego(g, t) {
  for (const m of g.children) {
    if (m.name !== 'humo') continue;
    const u = (m.userData.fase + t * 0.12) % 1, f = m.userData.fase;
    m.position.set(Math.sin(u * 4 + f * 9) * 0.08 + u * 0.25, 0.45 + u * 2.2, Math.cos(u * 3 + f * 7) * 0.07);
    m.scale.setScalar(0.6 + u * 3.2);
    m.material.opacity = 0.12 * Math.min(1, u * 5) * (1 - u);
  }
  moverHumo({ userData: g.userData, children: g.children.filter(m => m.name === 'llama') }, t); // las llamas, como las de las chimeneas
}
// Cómo está el fuego de una estación ahora: 'ardiendo', 'cenizas' o '' (y si tiene algo puesto sin arder).
export function vistaFuego(f, ahora) {
  const st = estadoFuego(f, ahora);
  return { cual: st.encendida ? 'ardiendo' : st.cenizas ? 'cenizas' : '', ramas: st.encendida || st.combustible > 0 };
}

function bancoTronco(id) {
  const g = new THREE.Group();
  const L = new Lote({ rangoSuelo: 0.3, variacion: 0.07 });
  L.add(cil(0.21, 0.23, 0.5, 11), 'corteza', 0, 0.25, 0, { y: az(id, 2) * 6 });   // el tajo, de pie
  L.add(new THREE.CircleGeometry(0.205, 11), 'corte', 0, 0.502, 0, { x: -Math.PI / 2 }, { sinSuelo: true });
  g.add(mallas(L));
  const tumbado = troncosConCortes(1, 0.9, 0.15, id);
  tumbado.position.set(0.15, 0, 0.5); tumbado.rotation.y = 0.25;
  g.add(tumbado);
  return g;
}

// ---------- los almacenajes de la base (revisión del 1 nov): el soporte, y lo guardado se ve puesto, lleno ----------
// una vara de pie o tumbada, de a a b (como las del árbol joven: madera con veta y un corte en cada punta)
function varaEntre(L, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), largo = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1));
  const c = a.clone().addScaledVector(d, 0.5);
  L.add(cil(r * 0.8, r, largo, 7), 'madera', c.x, c.y, c.z, m, { tex: 'veta', sinSuelo: true });
}
// El acopio de troncos: dos durmientes de vara en el suelo (los troncos no tocan la tierra) y dos pares de estacas que
// sujetan la pila por los lados. Los troncos van a lo largo de X, entre las estacas.
const ACOPIO = { x: 1.05, z: 0.46, alto: 1.05 };
function acopioTroncos(id) {
  const L = new Lote({ rangoSuelo: 0.12, variacion: 0.07 });
  for (const sx of [-1, 1]) {
    const x = sx * ACOPIO.x * 0.72;
    varaEntre(L, new THREE.Vector3(x, 0.035, -ACOPIO.z - 0.12), new THREE.Vector3(x + (az(id, sx) - 0.5) * 0.04, 0.035, ACOPIO.z + 0.12), 0.035); // durmiente
    for (const sz of [-1, 1]) { // estacas, un poco abiertas hacia fuera
      const x0 = sx * ACOPIO.x * 0.72 + (az(id, sx * 3 + sz) - 0.5) * 0.05, z0 = sz * ACOPIO.z;
      varaEntre(L, new THREE.Vector3(x0, -0.1, z0), new THREE.Vector3(x0, ACOPIO.alto, z0 * 1.06), 0.026);
    }
  }
  return mallas(L);
}
// La pila de piedras: un lecho de cuatro losas planas donde se amontonan.
function pilaPiedras(id) {
  const L = new Lote({ rangoSuelo: 0.2, variacion: 0.06 });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.6 + (az(id, i) - 0.5) * 0.3;
    L.add(piedraIrregular(0.26, 1, id + 'l' + i, 0.18), i % 2 ? 'piedraOsc' : 'piedra', Math.cos(a) * 0.3, 0.035, Math.sin(a) * 0.3, { y: az(id, i + 5) * 6 }, { escala: new THREE.Vector3(1.25, 0.28, 1), plano: true });
  }
  return mallas(L);
}
// La leñera: un tejadillo de ramas a un agua sobre cuatro postes de vara (más altos delante), con dos durmientes.
const LENERA = { x: 0.75, z: 0.42, delante: 1.15, detras: 0.85 };
function lenera(id) {
  const L = new Lote({ rangoSuelo: 0.12, variacion: 0.07 }), { x: X, z: Z, delante, detras } = LENERA;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) varaEntre(L, new THREE.Vector3(sx * X, -0.1, sz * Z), new THREE.Vector3(sx * X, sz > 0 ? delante : detras, sz * Z), 0.028);
  for (const sz of [-1, 1]) { const y = sz > 0 ? delante : detras; varaEntre(L, new THREE.Vector3(-X - 0.1, y, sz * Z), new THREE.Vector3(X + 0.1, y + 0.01, sz * Z), 0.022); } // travesaños
  for (const sx of [-0.5, 0.5]) varaEntre(L, new THREE.Vector3(sx * X, 0.03, -Z), new THREE.Vector3(sx * X, 0.03, Z), 0.03); // durmientes
  for (let i = 0; i < 34; i++) { // el tejadillo: ramas de delante atrás, apretadas, en dos capas
    const capa = i % 2, x = -X - 0.08 + (i >> 1) * (2 * X + 0.16) / 16 + capa * 0.04, dz = (az(id, i + 30) - 0.5) * 0.14, r = 0.02 + az(id, i + 60) * 0.01;
    varaEntre(L, new THREE.Vector3(x, delante + 0.03 + capa * 0.03, Z + 0.2 + dz), new THREE.Vector3(x + (az(id, i) - 0.5) * 0.1, detras + 0.03 + capa * 0.03, -Z - 0.2 + dz), r);
  }
  return mallas(L);
}

// El soporte de varas: dos caballetes de varas cruzadas en aspa, atados en el cruce; las varas se tumban a lo largo de X
// en la horquilla de arriba, sin tocar el suelo.
const SOPORTE = { x: 0.6, cruce: 0.62, abre: 0.34 };
function soporteVaras(id) {
  const L = new Lote({ rangoSuelo: 0.12, variacion: 0.07 }), { x: X, cruce, abre } = SOPORTE;
  for (const sx of [-1, 1]) {
    const x = sx * X + (az(id, sx) - 0.5) * 0.04;
    for (const sz of [-1, 1]) varaEntre(L, new THREE.Vector3(x, -0.08, sz * abre), new THREE.Vector3(x + sz * 0.02, cruce + 0.32, -sz * abre * 0.55), 0.024);
    L.add(new THREE.TorusGeometry(0.03, 0.009, 5, 10), 0xb8a27a, x, cruce, 0, { y: Math.PI / 2 }, { tex: 'paja', sinSuelo: true }); // la atadura
  }
  varaEntre(L, new THREE.Vector3(-X - 0.06, cruce - 0.22, 0), new THREE.Vector3(X + 0.06, cruce - 0.21, 0), 0.02); // el travesaño que los une, bajo el cruce
  return mallas(L);
}
// El almiar: el palo hincado (una vara alta) sobre un lecho de dos varas cruzadas, para que la paja no toque la tierra.
function almiar(id) {
  const L = new Lote({ rangoSuelo: 0.12, variacion: 0.07 });
  varaEntre(L, new THREE.Vector3(0, -0.2, 0), new THREE.Vector3((az(id, 1) - 0.5) * 0.05, 1.95, (az(id, 2) - 0.5) * 0.05), 0.03);
  for (const a of [0.3, 0.3 + Math.PI / 2]) varaEntre(L, new THREE.Vector3(Math.cos(a) * 0.75, 0.03, Math.sin(a) * 0.75), new THREE.Vector3(-Math.cos(a) * 0.75, 0.03, -Math.sin(a) * 0.75), 0.026);
  return mallas(L);
}
// El hoyo de barro: un hoyo cavado (la tierra del corte, oscura) bordeado de seis piedras.
const HOYO = 0.42;
function hoyoBarro(id) {
  const L = new Lote({ rangoSuelo: 0.2, variacion: 0.06 });
  L.add(new THREE.CircleGeometry(HOYO + 0.08, 16), 'tierraCorte', 0, 0.008, 0, { x: -Math.PI / 2 }, { sinSuelo: true, tex: 'piedra' }); // la tierra sacada
  L.add(new THREE.CircleGeometry(HOYO, 16), 'tierraCorteOsc', 0, 0.012, 0, { x: -Math.PI / 2 }, { sinSuelo: true, tex: 'piedra' }); // el fondo
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + (az(id, i) - 0.5) * 0.3;
    L.add(piedraIrregular(0.13, 1, id + 'h' + i, 0.22), i % 2 ? 'piedraOsc' : 'piedra', Math.cos(a) * (HOYO + 0.1), 0.05, Math.sin(a) * (HOYO + 0.1), { y: az(id, i + 7) * 6 }, { escala: new THREE.Vector3(1.3, 0.6, 1), plano: true });
  }
  return mallas(L);
}
// El cesto: de juncos trenzados, redondo y algo más ancho de boca, con su borde enrollado.
const CESTO = { r0: 0.22, r1: 0.27, alto: 0.3 };
// en espiral, como se cosen los cestos de juncos: rollos de juncos uno encima de otro (y las puntadas, más claras)
const trenza = v => 0.66 + 0.34 * Math.abs(Math.sin(v.y * 88)) - (Math.sin(Math.atan2(v.z, v.x) * 18 + v.y * 40) > 0.9 ? 0.14 : 0);
function cesto(id) {
  const L = new Lote({ rangoSuelo: 0.2, variacion: 0.05 }), { r0, r1, alto } = CESTO;
  L.add(new THREE.CylinderGeometry(r1, r0, alto, 26, 24, true), 'junco', 0, alto / 2, 0, { y: az(id, 1) * 6 }, { tex: 'paja', rayas: trenza });
  L.add(cil(r1 - 0.012, r0 - 0.012, alto - 0.01, 22, true), 'juncoOsc', 0, alto / 2 + 0.005, 0, null, { tex: 'paja', sinSuelo: true, escala: new THREE.Vector3(-1, 1, 1) }); // por dentro (en espejo: las caras miran adentro)
  L.add(new THREE.CircleGeometry(r0, 22), 'juncoOsc', 0, 0.015, 0, { x: -Math.PI / 2 }, { tex: 'paja', sinSuelo: true }); // el fondo
  L.add(new THREE.TorusGeometry(r1, 0.014, 5, 26), 'junco', 0, alto, 0, { x: Math.PI / 2 }, { tex: 'paja', sinSuelo: true }); // el borde
  return mallas(L);
}

// ---------- los colgaderos (valravnx, 8 nov): de dentro, colgados en la cara de un muro ----------
// En su sistema: el muro en z = 0 (la estación se pone pegada a su cara, src/logica/construccion.js, muroCercano) y la
// habitación hacia +Z. Como se hacía en las casas de entonces: varas descortezadas atadas con cordel y sujetas al muro
// con estaquillas de madera (tacos hincados entre los troncos o en el barro), sin clavos ni tablas.
const CUERO_COLG = 0x7a5a3e, CORDEL_COLG = 0xb8a27a;
const atadura = (L, x, y, z, r, eje) => L.add(new THREE.TorusGeometry(r, 0.007, 4, 10), CORDEL_COLG, x, y, z, eje === 'x' ? { y: Math.PI / 2 } : eje === 'z' ? null : { x: Math.PI / 2 }, { tex: 'paja', sinSuelo: true });
const taco = (L, x, y) => { L.add(cil(0.016, 0.016, 0.05, 7), 'maderaOsc', x, y, 0.025, { x: Math.PI / 2 }, { tex: 'veta', sinSuelo: true });
  L.add(new THREE.CircleGeometry(0.016, 7), 'corte', x, y, 0.0505, null, { sinSuelo: true }); };
// El de herramientas: dos listones de vara de pie contra el muro y, arriba, dos varas tumbadas, una pegada al muro y
// otra delante, separadas por dos tacos: el mango cae por la ranura y la cabeza se queda encima (como los colgaderos
// de herramientas de siempre). Abajo, otra vara contra el muro para que los mangos no bailen.
const COLG_H = { ancho: 0.78, barra: 1.42, abajo: 1.0, atras: 0.035, delante: 0.12, hueco: 0.165 };
function colgaderoHerramientas(id) {
  const L = new Lote({ rangoSuelo: 0.1, variacion: 0.07 }), { ancho, barra, abajo, atras, delante } = COLG_H, xl = ancho - 0.05;
  for (const s of [-1, 1]) {
    const x = s * xl + (az(id, s) - 0.5) * 0.02;
    varaEntre(L, new THREE.Vector3(x, abajo - 0.12, 0.028), new THREE.Vector3(x, barra + 0.12, 0.028), 0.022);    // el listón de pie
    taco(L, x, barra + 0.07); taco(L, x, abajo - 0.07);                                                          // sujeto al muro
    L.add(cil(0.02, 0.02, delante - atras, 7), 'maderaOsc', x, barra, (atras + delante) / 2, { x: Math.PI / 2 }, { tex: 'veta', sinSuelo: true }); // el taco que separa las dos varas
    atadura(L, x, barra, atras + 0.004, 0.03, 'z'); atadura(L, x, barra, delante, 0.028, 'x'); atadura(L, x, abajo, 0.03, 0.03, 'z');
  }
  for (const [z, y] of [[atras, barra], [delante, barra + 0.004], [atras, abajo]])
    varaEntre(L, new THREE.Vector3(-ancho, y, z), new THREE.Vector3(ancho, y + (az(id, z * 100 + y) - 0.5) * 0.008, z), 0.021);
  return mallas(L);
}
// El de mochilas: un riel de vara gruesa partida por la mitad (la cara plana contra el muro), sujeto con dos tacos, y
// cuatro estaquillas inclinadas hacia arriba, de las que se cuelga cada cosa por su correa.
const COLG_M = { ancho: 0.78, alto: 1.56, sitios: [-0.6, -0.2, 0.2, 0.6] };
function colgaderoMochilas(id) {
  const L = new Lote({ rangoSuelo: 0.1, variacion: 0.07 }), { ancho, alto, sitios } = COLG_M;
  L.add(new THREE.CylinderGeometry(0.045, 0.045, ancho * 2, 10, 1, false, -Math.PI / 2, Math.PI), 'madera', 0, alto, 0.002, { z: Math.PI / 2 }, { tex: 'veta', sinSuelo: true, escala: new THREE.Vector3(1, 1, 0.75) }); // medio tronco, lo plano contra el muro
  for (const s of [-1, 1]) { const x = s * (ancho - 0.1); L.add(cil(0.014, 0.014, 0.012, 7), 'maderaOsc', x, alto + 0.012, 0.034, { x: Math.PI / 2 }, { tex: 'veta', sinSuelo: true }); }
  sitios.forEach((x, i) => {
    const e = 0.42 + (az(id, i) - 0.5) * 0.06, largo = 0.17, y0 = alto - 0.005;
    const m = new THREE.Matrix4().makeRotationX(Math.PI / 2 - e);
    L.add(cil(0.011, 0.016, largo, 7), 'maderaOsc', x, y0 + Math.sin(e) * largo / 2, 0.03 + Math.cos(e) * largo / 2, m, { tex: 'veta', sinSuelo: true });
    L.add(new THREE.SphereGeometry(0.013, 7, 5), 'maderaOsc', x, y0 + Math.sin(e) * largo, 0.03 + Math.cos(e) * largo, null, { sinSuelo: true });
  });
  return mallas(L);
}


// ---------- las camas (P4, la cama ligada; valravnx, 8 nov) ----------
// El refugio de ramas (un tejadillo «a un agua», como los de los leñadores y carboneros): dos postes de vara con
// horquilla delante, un travesaño encima y las ramas apoyadas en él hasta el suelo de atrás, tapadas con ramaje verde;
// los lados, cerrados con ramas de pie; dentro, un lecho de ramaje seco. Lo largo, en X; la boca, hacia +Z.
const REFUGIO = { x: 1.05, delante: 0.38, atras: -1.0, alto: 1.18 };
const alturaRefugio = z => REFUGIO.alto * (z - REFUGIO.atras) / (REFUGIO.delante - REFUGIO.atras);
function refugioRamas(id) {
  const L = new Lote({ rangoSuelo: 0.15, variacion: 0.08 }), { x: X, delante: Zd, atras: Za, alto: H } = REFUGIO;
  for (const sx of [-1, 1]) { // los postes, con su horquilla arriba
    const x = sx * X + (az(id, sx) - 0.5) * 0.04;
    varaEntre(L, new THREE.Vector3(x, -0.12, Zd), new THREE.Vector3(x, H + 0.06, Zd + 0.02), 0.036);
    varaEntre(L, new THREE.Vector3(x, H - 0.1, Zd + 0.01), new THREE.Vector3(x + sx * 0.09, H + 0.16, Zd + 0.03), 0.018);
  }
  varaEntre(L, new THREE.Vector3(-X - 0.18, H + 0.03, Zd), new THREE.Vector3(X + 0.2, H + 0.04, Zd + 0.01), 0.03); // el travesaño
  const pendiente = Math.atan2(H, Zd - Za);
  for (let i = 0; i < 26; i++) { // las ramas del tejadillo, del travesaño al suelo de atrás
    const x = -X + 0.02 + i * (2 * X - 0.04) / 25 + (az(id, i) - 0.5) * 0.04, r = 0.017 + az(id, i + 40) * 0.012;
    varaEntre(L, new THREE.Vector3(x, H + 0.06, Zd + 0.06 + az(id, i + 80) * 0.05), new THREE.Vector3(x + (az(id, i + 9) - 0.5) * 0.12, -0.02, Za - 0.08 - az(id, i + 20) * 0.1), r);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) { // los lados: ramas de pie, apoyadas en la primera del tejadillo
    const z = Za + 0.12 + i * (Zd - Za - 0.2) / 6, y = alturaRefugio(z);
    varaEntre(L, new THREE.Vector3(sx * (X + 0.14), -0.04, z + (az(id, i + sx * 7) - 0.5) * 0.08), new THREE.Vector3(sx * (X - 0.02), y, z), 0.015 + az(id, i + 50) * 0.008);
  }
  for (let i = 0; i < 22; i++) { // el ramaje verde encima, en matas aplastadas a lo largo de la pendiente
    const u = (i % 5 + 0.5 + (az(id, i + 100) - 0.5) * 0.6) / 5, v = (Math.floor(i / 5) + 0.5 + (az(id, i + 120) - 0.5) * 0.5) / 4.4;
    const x = -X + 0.1 + v * (2 * X - 0.2), z = Za + 0.05 + u * (Zd - Za - 0.1), y = alturaRefugio(z) + 0.07;
    L.add(piedraIrregular(0.3, 1, id + 'r' + i, 0.3), i % 3 ? 'hoja' : 'hojaOsc', x, y, z, { x: pendiente, y: (az(id, i + 140) - 0.5) * 0.6 }, { escala: new THREE.Vector3(1.15, 0.22, 0.85), sinSuelo: true });
  }
  for (let i = 0; i < 9; i++) { // el lecho de dentro: ramaje seco, bajo y aplastado
    const x = -X + 0.3 + (i % 3) * (2 * X - 0.6) / 2 + (az(id, i + 160) - 0.5) * 0.15, z = Za + 0.35 + Math.floor(i / 3) * 0.32;
    L.add(piedraIrregular(0.3, 1, id + 'l' + i, 0.25), i % 2 ? 0x7d6f48 : 0x8a7a50, x, 0.04, z, { y: az(id, i + 180) * 6 }, { escala: new THREE.Vector3(1.2, 0.16, 0.8), tex: 'paja', sinSuelo: true });
  }
  return mallas(L);
}
// La cama de juncos (dentro de la casa): un lecho de juncos tumbados a lo largo, en tres capas, ceñido por dos varas a
// los lados y atado con cordel de trecho en trecho; a la cabecera, un haz enrollado de almohada. 1,9 × 0,8 m.
const CAMA_J = { x: 0.95, z: 0.4 };
const JUNCO_C = 0x7f8a4c, JUNCO_SECO = 0x9a9560, CORDEL_C = 0x9c8a60;
function camaJuncos(id) {
  const L = new Lote({ rangoSuelo: 0.12, variacion: 0.07 }), { x: X, z: Z } = CAMA_J;
  for (const sz of [-1, 1]) varaEntre(L, new THREE.Vector3(-X - 0.05, 0.035, sz * (Z + 0.02)), new THREE.Vector3(X + 0.05, 0.035, sz * (Z + 0.02) + (az(id, sz) - 0.5) * 0.03), 0.034);
  const r = 0.0085;
  for (let capa = 0; capa < 3; capa++) {
    const n = 44 - capa * 4;
    for (let i = 0; i < n; i++) {
      const z = -Z + 0.02 + (i + (capa % 2) * 0.5) * (2 * Z - 0.04) / n, y = 0.012 + capa * 0.016 + Math.sin(Math.PI * (z + Z) / (2 * Z)) * 0.02 * capa;
      const dx = (az(id, capa * 100 + i) - 0.5) * 0.12, largo = 2 * X - 0.04 - az(id, capa * 100 + i + 50) * 0.12;
      L.add(cil(r * 0.8, r, largo, 5), (i + capa) % 4 ? JUNCO_C : JUNCO_SECO, dx, y + r, z, { z: Math.PI / 2, y: (az(id, capa * 100 + i + 70) - 0.5) * 0.03 }, { tex: 'paja', sinSuelo: true });
    }
  }
  for (const fx of [-0.62, -0.2, 0.22, 0.64]) { // las ataduras de cordel, de lado a lado por encima
    const x = fx * X + (az(id, fx * 10) - 0.5) * 0.04;
    L.add(cil(0.006, 0.006, 2 * Z + 0.1, 4), CORDEL_C, x, 0.088, 0, { x: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
    for (const sz of [-1, 1]) L.add(new THREE.TorusGeometry(0.04, 0.006, 4, 10), CORDEL_C, x, 0.045, sz * (Z + 0.02), { y: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
  }
  // la almohada: un haz de juncos más corto, atravesado a la cabecera (-X)
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399, d = 0.07 * Math.sqrt((i + 0.5) / 26);
    L.add(cil(r * 0.8, r, 2 * Z - 0.1, 5), i % 3 ? JUNCO_C : JUNCO_SECO, -X + 0.16 + Math.cos(a) * d, 0.13 + Math.sin(a) * d * 0.7, (az(id, i + 300) - 0.5) * 0.06, { x: Math.PI / 2 }, { tex: 'paja', sinSuelo: true });
  }
  for (const fz of [-0.55, 0.55]) L.add(new THREE.TorusGeometry(0.075, 0.006, 4, 12), CORDEL_C, -X + 0.16, 0.13, fz * Z, null, { tex: 'liso', sinSuelo: true });
  return mallas(L);
}
export const MODELO_ESTACION = { piedra_tallar: piedraTallar, hoguera, banco_tronco: bancoTronco, acopio_troncos: acopioTroncos, pila_piedras: pilaPiedras, lenera,
  soporte_varas: soporteVaras, almiar, hoyo_barro: hoyoBarro, cesto, colgadero_mochilas: colgaderoMochilas, colgadero_herramientas: colgaderoHerramientas,
  refugio_ramas: refugioRamas, cama_juncos: camaJuncos };

// Lo guardado en un almacenaje, puesto como se guarda de verdad (cada uno lleno hasta lo que le cabe; nada flota):
const TRONCO = { tronco_delgado: [2.6, 0.09], tronco_corto: [0.9, 0.14], tronco_largo: [4.5, 0.18] };
//  - el acopio: los troncos tumbados entre las estacas, en filas de 4 sobre los durmientes.
function llenoAcopio(dep, id) {
  const L = new Lote({ rangoSuelo: 0.6, variacion: 0.07 }), lista = [];
  for (const t of ['tronco_largo', 'tronco_delgado', 'tronco_corto']) for (let i = 0; i < (dep[t] || 0); i++) lista.push(t);
  let y = 0.07, i = 0;
  while (i < lista.length) {
    const fila = lista.slice(i, i + 4), rMax = Math.max(...fila.map(t => TRONCO[t][1]));
    fila.forEach((t, k) => {
      const [largo, r] = TRONCO[t], z = (k - (fila.length - 1) / 2) * (2 * ACOPIO.z - 0.06) / 4, dx = (az(id, i + k) - 0.5) * 0.12, g = (az(id, i + k + 50) - 0.5) * 0.04;
      const m = new THREE.Matrix4().makeRotationY(g).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      L.add(cil(r, r * 1.04, largo, 9), 'corteza', dx, y + r, z, m, { sinSuelo: true });
      for (const s of [-1, 1]) L.add(new THREE.CircleGeometry(r * 0.97, 9), 'corte', dx + Math.cos(g) * s * (largo / 2 + 0.002), y + r, z - Math.sin(g) * s * (largo / 2 + 0.002), new THREE.Matrix4().makeRotationY(g + s * Math.PI / 2), { sinSuelo: true });
    });
    y += rMax * 1.9; i += 4;
  }
  return mallas(L);
}
//  - la pila: las piedras en montón sobre su lecho, capa a capa (cada capa, anillos alrededor de una del centro, más
//    estrecha que la de debajo): 40 caben en cuatro capas.
const CAPAS_PILA = [[[1, 0], [6, 0.21], [11, 0.43]], [[1, 0], [6, 0.19], [6, 0.35]], [[1, 0], [6, 0.18]], [[2, 0.06]]];
function llenoPila(dep, id) {
  const g = new THREE.Group(), mods = modelosRecoleccion();
  let n = dep.piedra || 0, i = 0;
  CAPAS_PILA.forEach((anillos, capa) => {
    for (const [cuantas, r] of anillos) for (let k = 0; k < cuantas && n > 0; k++, n--, i++) {
      const p = deLista(mods.piedra), a = k / cuantas * Math.PI * 2 + capa * 0.7 + az(id, i) * 0.4;
      p.position.set(Math.cos(a) * r, 0.05 + capa * 0.11, Math.sin(a) * r); p.rotation.y = az(id, i + 20) * 6; p.scale.setScalar(0.95 + az(id, i + 40) * 0.3);
      g.add(p);
    }
  });
  return g;
}
//  - la leñera: la leña apilada bajo el tejadillo, en filas de 6 a lo largo de Z (cortes al frente), y las ramas en
//    haces atados encima de los durmientes, a un lado.
function llenoLenera(dep, id) {
  const g = new THREE.Group(), L = new Lote({ rangoSuelo: 0.6, variacion: 0.07 }), mods = modelosRecoleccion();
  const lena = dep.lena || 0, r = 0.055, largo = 0.48;
  for (let i = 0; i < lena; i++) {
    const fila = Math.floor(i / 6), k = i % 6, x = -LENERA.x * 0.85 + k * r * 2.05 + (fila % 2 ? r : 0), y = 0.06 + r + fila * r * 1.8;
    const m = new THREE.Matrix4().makeRotationY((az(id, i) - 0.5) * 0.08).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    L.add(cil(r, r * 1.05, largo, 6), 'corteza', x, y, (az(id, i + 9) - 0.5) * 0.05, m, { sinSuelo: true });
    for (const s of [-1, 1]) L.add(new THREE.CircleGeometry(r * 0.96, 6), 'corte', x, y, s * (largo / 2 + 0.002), new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI), { sinSuelo: true });
  }
  g.add(mallas(L));
  const haces = Math.ceil((dep.rama || 0) / 3);
  for (let h = 0; h < haces; h++) {
    const m = deLista(mods.ramas), col = h % 3, capa = Math.floor(h / 3);
    m.position.set(LENERA.x * 0.5 + (col - 1) * 0.1, 0.05 + capa * 0.08, (col - 1) * 0.12); m.rotation.y = Math.PI / 2 + (az(id, h) - 0.5) * 0.3; m.scale.setScalar(0.85);
    g.add(m);
  }
  return g;
}
//  - el soporte: las varas tumbadas en la horquilla de los caballetes, en filas que se abren hacia arriba (como la V).
function llenoSoporte(dep, id) {
  const L = new Lote({ rangoSuelo: 0.6, variacion: 0.07 }), r = 0.02, largo = 1.6;
  let n = dep.vara || 0, fila = 0, i = 0;
  while (n > 0) {
    const cuantas = Math.min(n, 3 + fila), y = SOPORTE.cruce + 0.03 + fila * r * 1.8, ancho = (cuantas - 1) * r * 2.1;
    for (let k = 0; k < cuantas; k++, i++) {
      const z = -ancho / 2 + k * r * 2.1 + (fila % 2 ? r * 0.5 : 0), dx = (az(id, i) - 0.5) * 0.18, g = (az(id, i + 40) - 0.5) * 0.03;
      varaEntre(L, new THREE.Vector3(dx - largo / 2, y, z - g), new THREE.Vector3(dx + largo / 2, y + (az(id, i + 80) - 0.5) * 0.01, z + g), r);
    }
    n -= cuantas; fila++;
  }
  return mallas(L);
}
//  - el almiar: la paja en un montón redondo alrededor del palo, que crece con lo que se le echa (de bulto, con la
//    superficie desigual); los haces de juncos, tumbados en corro al pie del montón (o, sin paja, de pie y apoyados
//    en el palo, en cono).
function llenoAlmiar(dep, id) {
  const g = new THREE.Group(), L = new Lote({ rangoSuelo: 0.5, variacion: 0.08 }), cabe = ESTACIONES.almiar.cabe;
  const paja = dep.paja || 0, junco = dep.junco || 0;
  let radio = 0.12, alto = 0.3;
  if (paja > 0) {
    const f = Math.min(1, paja / cabe); radio = 0.4 + 0.5 * Math.sqrt(f); alto = 0.35 + 1.25 * Math.sqrt(f);
    const perfil = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10; perfil.push(new THREE.Vector2(radio * Math.sqrt(Math.max(0, 1 - u * u * u)) * (1 - 0.15 * u) + 0.02, alto * u)); }
    const geo = new THREE.LatheGeometry(perfil, 18), p = geo.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) { // bultos: los vértices que coinciden se mueven igual (sin grietas)
      v.fromBufferAttribute(p, k);
      const e = 1 + (az(id, `${Math.round(v.x * 40)},${Math.round(v.y * 40)},${Math.round(v.z * 40)}`) - 0.5) * 0.14 * Math.min(1, v.y / 0.1 + 0.2);
      p.setXYZ(k, v.x * e, v.y, v.z * e);
    }
    geo.computeVertexNormals();
    L.add(geo, 'paja', 0, 0.02, 0, { y: az(id, 3) * 6 }, { tex: 'paja' });
    g.add(mallas(L));
  }
  const haz = modeloDe({ id: id + ':junco', cosa: { tipo: 'junco', n: 1 } });
  haz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(haz), largo = caja.max.x - caja.min.x, centro = caja.getCenter(new THREE.Vector3());
  for (let h = 0; h < junco; h++) {
    const g2 = new THREE.Group(), m = haz.clone(); m.position.sub(centro); g2.add(m); // el haz, centrado
    if (paja > 0) { // con paja: los haces tumbados al pie del montón, en corro y unos sobre otros
      const capa = Math.floor(h / 6), a = (h % 6) * Math.PI / 3 + capa * 0.5 + az(id, h) * 0.2, d = radio + 0.14;
      g2.position.set(Math.cos(a) * d, 0.035 + capa * 0.05, Math.sin(a) * d); g2.rotation.y = -a + Math.PI / 2;
    } else { // sin paja: de pie y apoyados en el palo, en cono (como se secan)
      const a = h * 2.4 + az(id, h) * 0.3, arriba = 1.05;
      const pie = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(Math.sqrt(Math.max(0.01, largo * largo - arriba * arriba)) * 0.97 + 0.04).setY(0.02);
      const dir = new THREE.Vector3(-pie.x, arriba, -pie.z);
      g2.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
      g2.position.copy(pie).addScaledVector(dir, 0.5);
    }
    g.add(g2);
  }
  return g;
}
const BARRO_HUMEDO = 0x6a5442; // el barro mojado, más oscuro que el seco
//  - el hoyo: el barro llena el hoyo y, con mucho, hace un montón húmedo y liso encima, con algún terrón.
function llenoHoyo(dep, id) {
  const L = new Lote({ rangoSuelo: 0.4, variacion: 0.05 }), n = dep.barro || 0, f = Math.min(1, n / ESTACIONES.hoyo_barro.cabe);
  if (n > 0) {
    L.add(piedraIrregular(HOYO * 0.96, 2, id + 'barro', 0.05), BARRO_HUMEDO, 0, 0.01, 0, { y: az(id, 1) * 6 }, { escala: new THREE.Vector3(1, 0.04 + 0.5 * f, 1), sinSuelo: true, tex: 'piedra' });
    for (let k = 0; k < Math.min(5, Math.ceil(n / 3)); k++) {
      const a = k * 1.3 + az(id, k), d = HOYO * (0.2 + 0.5 * az(id, k + 9));
      L.add(piedraIrregular(0.07 + 0.03 * az(id, k + 4), 1, id + 't' + k, 0.25), BARRO_HUMEDO, Math.cos(a) * d, 0.01 + (0.04 + 0.5 * f) * HOYO * 0.9, Math.sin(a) * d, null, { escala: new THREE.Vector3(1, 0.55, 1), sinSuelo: true, tex: 'piedra' });
    }
  }
  return mallas(L);
}
//  - el cesto: lo de dentro sube con lo que se guarda (un lecho del color de lo que más hay) y encima asoma un poco
//    de cada cosa: piedrecillas de sílex, mechones de fibra, bayas…, cada una de su color.
const COLOR_PEQUENO = { silex: 'piedraOsc', lasca_silex: 'piedraOsc', fibra: 'lino', yesca: 'cortezaRoja', cordel: 'paja', cuerda: 'paja', resina: 0x9a6a2a, bayas: 0x5a2a36, setas: 0xb59a7a, frutos_secos: 'madera', hierbas: 'hoja' };
function llenoCesto(dep, id) {
  const tipos = Object.entries(dep).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const L = new Lote({ rangoSuelo: 0.2, variacion: 0.1 });
  if (!tipos.length) return mallas(L);
  const total = tipos.reduce((a, [, n]) => a + n, 0), f = Math.min(1, total / ESTACIONES.cesto.cabe), { r0, r1, alto } = CESTO;
  const y = 0.04 + (alto - 0.08) * f, r = r0 + (r1 - r0) * (y / alto) - 0.012;
  L.add(new THREE.CircleGeometry(r, 22), COLOR_PEQUENO[tipos[0][0]] || 'lino', 0, y, 0, { x: -Math.PI / 2 }, { sinSuelo: true, tex: 'tejido' });
  // cada cosa, en su rincón y mezclada por los bordes: muchos trocitos pequeños y desiguales (más de lo que más hay)
  const piezas = [];
  for (const [t, n] of tipos) for (let k = 0; k < Math.min(18, 4 + n); k++) piezas.push(t);
  const total2 = piezas.length;
  piezas.forEach((t, i) => {
    const a = i * 2.39996 + (az(id, i) - 0.5) * 0.5, d = Math.min(r - 0.02, r * 0.95 * Math.sqrt((i + 0.5) / total2)), tam = 0.011 + 0.011 * az(id, i + 50);
    const fino = t === 'fibra' || t === 'cordel' || t === 'cuerda' || t === 'hierbas';
    L.add(piedraIrregular(tam, 1, id + 'p' + i, 0.35), COLOR_PEQUENO[t] || 'lino', Math.cos(a) * d, y + tam * 0.25, Math.sin(a) * d, { y: az(id, i + 9) * 6, x: (az(id, i + 70) - 0.5) * 0.6 },
      { escala: fino ? new THREE.Vector3(3.2, 0.45, 0.7) : new THREE.Vector3(1.2, 0.7, 1), sinSuelo: true });
  });
  return mallas(L);
}
//  - los colgaderos: cada herramienta colgada por la cabeza en la ranura de las dos varas, de canto contra el muro y
//    una al lado de otra; cada mochila (o leñero, fardo, cesta…) de su estaquilla, por una correa de cuero.
function herramientaSuelta(t) {
  if (t === 'hacha_piedra') return modeloHachaPiedra();
  if (t === 'hacha_mano' || t === 'hacha_hierro') return modeloHacha();
  return mallas(loteEnMano(t));
}
// pone o en x con su lado delgado contra el muro (de canto) y lo sube o lo baja hasta que su punto más alto quede en y
function colgarEn(o, x, y, z, giro = 0) {
  const g = new THREE.Group(); g.add(o);
  o.updateMatrixWorld(true);
  let caja = new THREE.Box3().setFromObject(o), t = caja.getSize(new THREE.Vector3());
  if (t.z > t.x) { o.rotation.y += Math.PI / 2; o.updateMatrixWorld(true); caja = new THREE.Box3().setFromObject(o); }
  o.rotation.z += giro; o.updateMatrixWorld(true); caja = new THREE.Box3().setFromObject(o);
  const c = caja.getCenter(new THREE.Vector3());
  o.position.set(x - c.x, y - caja.max.y, z - c.z);
  return g;
}
function llenoHerramientas(dep, id) {
  const g = new THREE.Group(), { barra, atras, delante, hueco } = COLG_H, lista = [];
  for (const [t, n] of Object.entries(dep)) for (let k = 0; k < n; k++) lista.push(t);
  lista.slice(0, ESTACIONES.colgadero_herramientas.cabe).forEach((t, i) => {
    const x = (i - 3.5) * hueco, o = herramientaSuelta(t);
    g.add(colgarEn(o, x, barra + 0.09, (atras + delante) / 2, (az(id, i) - 0.5) * 0.04));
  });
  return g;
}
function llenoMochilas(dep, id) {
  const g = new THREE.Group(), L = new Lote({ rangoSuelo: 0.6, variacion: 0.05 }), { alto, sitios } = COLG_M, lista = [];
  for (const [t, n] of Object.entries(dep)) for (let k = 0; k < n; k++) lista.push(t);
  lista.slice(0, sitios.length).forEach((t, i) => {
    const x = sitios[i], { L: E } = loteEspalda(t, {}), o = mallas(E);
    o.updateMatrixWorld(true);
    let caja = new THREE.Box3().setFromObject(o);
    // lo largo de lado a lado (el fardo enrollado), de pie: que no pise al de al lado
    if (caja.max.x - caja.min.x > 0.4) { o.rotation.z = Math.PI / 2; o.updateMatrixWorld(true); caja = new THREE.Box3().setFromObject(o); }
    const arriba = alto - 0.05;
    o.position.set(x - (caja.min.x + caja.max.x) / 2, arriba - caja.max.y, 0.012 - caja.min.z);
    o.rotation.z += (az(id, i + 9) - 0.5) * 0.05;
    g.add(o);
    // la correa: de la cosa a la estaquilla, en lazo
    const yp = alto + 0.05, zp = 0.15;
    for (const s of [-1, 1]) varaCorrea(L, new THREE.Vector3(x + s * 0.05, arriba - 0.01, 0.045), new THREE.Vector3(x + s * 0.01, yp, zp));
    L.add(new THREE.TorusGeometry(0.02, 0.006, 4, 10, Math.PI), CUERO_COLG, x, yp + 0.004, zp, { y: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
  });
  if (L.piezas.length) g.add(mallas(L));
  return g;
}
function varaCorrea(L, a, b) {
  const d = new THREE.Vector3().subVectors(b, a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1)), c = a.clone().addScaledVector(d, 0.5);
  L.add(new THREE.BoxGeometry(0.02, d.length(), 0.004), CUERO_COLG, c.x, c.y, c.z, m, { tex: 'liso', sinSuelo: true });
}
const LLENO = { colgadero_herramientas: llenoHerramientas, colgadero_mochilas: llenoMochilas, acopio_troncos: llenoAcopio, pila_piedras: llenoPila, lenera: llenoLenera, soporte_varas: llenoSoporte, almiar: llenoAlmiar, hoyo_barro: llenoHoyo, cesto: llenoCesto };

// Dónde se pone lo depositado en cada estación (en su sistema, sin girar): los sitios de encima (y su altura) y, para
// lo que no cabe, un anillo al pie. Lo grande (troncos) siempre al pie.
const DEPOSITO_SITIOS = {
  piedra_tallar: { encima: [[-0.18, 0.2, 0.08], [0.16, 0.2, -0.1], [-0.05, 0.2, -0.18]], radio: 0.75, empieza: -0.6 },
  banco_tronco:  { encima: [[0, 0.5, 0]], radio: 0.7, empieza: 2.6 },
  hoguera:       { encima: [], radio: 0.92, empieza: 0.3 },
  obra:          { encima: [], radio: 0.95, empieza: 1.9 },   // lo entregado a un marco, fuera del armazón
};
const GRANDE = new Set(['tronco_corto', 'tronco_delgado', 'tronco_largo', 'lena']);
// El grupo con lo depositado: un montón por tipo, más pequeño encima que al pie.
export function modeloDeposito(tipo, deposito, id) {
  if (LLENO[tipo]) { const g = LLENO[tipo](deposito || {}, id); g.name = 'deposito'; return g; }
  const g = new THREE.Group(), sit = DEPOSITO_SITIOS[tipo] || { encima: [], radio: 0.8, empieza: 0 };
  let arriba = 0, pie = 0;
  for (const [t, n] of Object.entries(deposito || {})) {
    if (!(n > 0)) continue;
    const m = modeloDe({ id: `${id}:${t}`, cosa: { tipo: t, n } });
    if (!GRANDE.has(t) && arriba < sit.encima.length) {
      const [x, y, z] = sit.encima[arriba++];
      m.position.set(x, y, z); m.scale.setScalar(0.6);
    } else {
      const a = sit.empieza + pie++ * 0.9;
      m.position.set(Math.cos(a) * sit.radio, 0, Math.sin(a) * sit.radio); m.scale.setScalar(GRANDE.has(t) ? 0.8 : 0.85);
    }
    m.rotation.y = az(id + t, 3) * Math.PI * 2;
    m.name = 'deposito_' + t; g.add(m);
  }
  g.name = 'deposito';
  return g;
}

// ---------- el marco de un puesto a medio hacer ----------
const MAT_ARMAZON = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
const MAT_ATADURA = new THREE.MeshLambertMaterial({ color: 0xb8a27a });
const matsObra = new Map();
function matObra(base, nivel) {
  const b = Array.isArray(base) ? base[0] : base, k = nivel + ':' + (b?.map?.uuid || 'liso') + (b?.vertexColors ? 'v' : '');
  if (!matsObra.has(k)) matsObra.set(k, new THREE.MeshLambertMaterial({ color: 0xd8ccb4, emissive: 0x1a140c, vertexColors: !!b?.vertexColors,
    map: b?.map || null, transparent: true, opacity: 0.42 + 0.12 * nivel, depthWrite: false }));
  return matsObra.get(k);
}
const vara = (a, b, r, mat) => {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true;
  return m;
};
// El armazón: cuatro estacas un poco inclinadas hacia dentro alrededor del puesto, con dos vueltas de cordel.
function armazon(tipo, id) {
  const g = new THREE.Group(), r = { hoguera: 0.78, banco_tronco: 0.72, piedra_tallar: 0.62, acopio_troncos: 1.2, pila_piedras: 0.7, lenera: 1.0, soporte_varas: 0.95, almiar: 0.95, hoyo_barro: 0.7, cesto: 0.45, colgadero_mochilas: 0.75, colgadero_herramientas: 0.65, refugio_ramas: 1.35, cama_juncos: 1.05 }[tipo] || 0.7, alto = ESTACIONES[tipo] && ESTACIONES[tipo].muro ? 1.7 : 0.75;
  const pies = [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * Math.PI / 2 + (az(id, 50 + i) - 0.5) * 0.15; return [Math.cos(a) * r, Math.sin(a) * r]; });
  pies.forEach(([x, z]) => g.add(vara(new THREE.Vector3(x, -0.05, z), new THREE.Vector3(x * 0.92, alto, z * 0.92), 0.022, MAT_ARMAZON)));
  for (const h of [0.32, 0.62]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = pies[i], [x2, z2] = pies[(i + 1) % 4], k = 1 - 0.08 * h / alto;
    g.add(vara(new THREE.Vector3(x1 * k, h, z1 * k), new THREE.Vector3(x2 * k, h - 0.02, z2 * k), 0.006, MAT_ATADURA));
  }
  if (ESTACIONES[tipo] && ESTACIONES[tipo].muro) g.position.z = r + 0.05; // lo colgado: el armazón, delante del muro
  g.name = 'armazon';
  return g;
}
// Viste de obra el modelo de un puesto (nivel 0..4: cuánto trabajo lleva) o le devuelve sus materiales.
function vestirObra(o, nivel) {
  const modelo = o.getObjectByName('modelo');
  modelo.traverse(m => {
    if (!m.isMesh) return;
    if (!m.userData.matBase) m.userData.matBase = m.material;
    m.material = nivel === null ? m.userData.matBase : matObra(m.userData.matBase, nivel);
    m.castShadow = nivel === null;
  });
  const a = o.getObjectByName('armazon');
  if (nivel === null) { if (a) o.remove(a); }
  else if (!a) o.add(armazon(o.userData.tipo, o.userData.id));
}

// Dibuja las estaciones de fab (una Fabricacion, la del servidor en línea) sobre el terreno. refrescar() al cambiar.
export function crearEstaciones({ raiz, altura, fab }) {
  const grupo = new THREE.Group(); grupo.name = 'estaciones'; raiz.add(grupo);
  const vistas = new Map(); // id → objeto
  // el fuego de una estación (solo la que lo tiene, levantada): se rehace si cambia lo que se ve
  function ponerFuego(o, e) {
    if (!ESTACIONES[e.tipo].fuego) return;
    const v = e.obra || !e.fuego ? { cual: '', ramas: true } : vistaFuego(e.fuego, Date.now()), firma = v.cual + (v.ramas ? '+r' : '');
    if (o.userData.firmaFuego === firma) return;
    o.userData.firmaFuego = firma;
    const viejo = o.getObjectByName('fuego'); if (viejo) o.remove(viejo);
    const r = o.getObjectByName('ramas'); if (r) r.visible = v.ramas;
    if (v.cual) o.add(modeloFuego(v.cual, e.id));
  }
  // Cada fotograma: el fuego que se apaga solo (al pasar su hora), las llamas y el humo. Devuelve dónde arde cada una
  // (en el mundo) para las luces.
  let ultimo = 0;
  const vF = new THREE.Vector3();
  function paso() {
    const t = performance.now();
    if (t - ultimo > 1000) { ultimo = t; for (const [id, o] of vistas) { const e = fab.estaciones[id]; if (e) ponerFuego(o, e); } }
    const arden = [];
    for (const o of vistas.values()) {
      const f = o.getObjectByName('fuego');
      if (!f || o.userData.firmaFuego.indexOf('ardiendo') !== 0) continue;
      moverFuego(f, t / 1000);
      vF.set(0, 0.9, 0); f.localToWorld(vF); arden.push(vF.clone()); // la luz, por encima de las piedras (si no, las quema)
    }
    return arden;
  }
  function refrescar() {
    const hay = fab.estaciones;
    for (const [id, o] of vistas) if (!Object.hasOwn(hay, id)) { grupo.remove(o); vistas.delete(id); }
    for (const e of Object.values(hay)) {
      if (!MODELO_ESTACION[e.tipo]) continue;
      let o = vistas.get(e.id);
      if (!o) {
        o = new THREE.Group();
        const modelo = MODELO_ESTACION[e.tipo](e.id); modelo.name = 'modelo'; o.add(modelo);
        o.position.set(e.x, (Number.isFinite(e.y) ? e.y : altura(e.x, e.z)) - 0.01, e.z); o.rotation.y = Number.isFinite(e.giro) ? e.giro : az(e.id, 7) * Math.PI * 2;   // el giro con que se puso (7 nov); las de antes, al azar
        o.name = 'estacion_' + e.tipo; o.userData.id = e.id; o.userData.tipo = e.tipo;
        grupo.add(o); vistas.set(e.id, o);
      }
      // en obra: tenue, con su armazón, y lo entregado al pie; levantada: con sus materiales y lo depositado
      const nivel = e.obra ? Math.min(4, Math.floor(4 * (e.obra.trabajo || 0) / ESTACIONES[e.tipo].trabajo)) : null;
      if (o.userData.nivel !== nivel) { vestirObra(o, nivel); o.userData.nivel = nivel; }
      ponerFuego(o, e);
      // lo depositado (o, en obra, lo entregado): se rehace solo si ha cambiado
      const montones = e.obra ? e.obra.entregado : e.deposito, firma = (e.obra ? 'o' : 'd') + JSON.stringify(montones || {});
      if (o.userData.firma !== firma) {
        const viejo = o.getObjectByName('deposito'); if (viejo) o.remove(viejo);
        o.add(modeloDeposito(e.obra ? 'obra' : e.tipo, montones, e.id)); o.userData.firma = firma;
      }
    }
  }
  // las que manda el servidor, con lo depositado (sin colas: lo encargado es de cada uno)
  function poner(lista) {
    if (!Array.isArray(lista)) return;
    const nuevas = {};
    for (const e of lista) if (e && typeof e.id === 'string' && Number.isFinite(e.x) && Number.isFinite(e.z)) {
      const n = nuevas[e.id] = { id: e.id, tipo: e.tipo, x: e.x, z: e.z, autor: e.autor, cola: [], deposito: limpiarDeposito(e.deposito, e.tipo) };
      if (Number.isFinite(e.y)) n.y = e.y;
      if (Number.isFinite(e.giro)) n.giro = e.giro;
      const ob = e.obra && limpiarObra(e.obra, e.tipo); if (ob) n.obra = ob;
      // el fuego: con lo que le queda, contado desde que llega (la hora de este navegador)
      if (e.fuego && typeof e.fuego === 'object') n.fuego = { hasta: e.fuego.encendida && Number(e.fuego.queda) > 0 ? Date.now() + Number(e.fuego.queda) * 1000 : 0,
        combustible: Math.max(0, Number(e.fuego.combustible) || 0), cenizas: !!e.fuego.cenizas };
    }
    fab.estaciones = nuevas;
    refrescar();
  }
  return { grupo, refrescar, poner, paso };
}
