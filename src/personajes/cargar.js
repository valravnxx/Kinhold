// Personajes a partir de las bases CC0 de Quaternius (preparadas con herramientas/preparar_personajes.mjs).
// Un personaje = cabeza de la base (solo cabeza y cuello: el resto lo tapa la ropa) + ropa + pelo (+ barba),
// todo atado al mismo esqueleto de 65 huesos, más las animaciones compartidas.
// Recursos v2: los mismos modelos comprimidos (meshopt y WebP, herramientas/preparar_personajes_v2.mjs), y
// opcionalmente las 39 animaciones extra (op.extra = true: se bajan aparte, ~1 MB).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const OPCIONES = {
  sexo: { hombre: 'Hombre', mujer: 'Mujer' },
  ropa: { campesino: 'Campesino', explorador: 'Explorador' },
  pelo: {
    hombre: { raya: 'Raya al lado', rapado: 'Rapado', largo: 'Largo' },
    mujer: { largo: 'Largo', mono: 'Moño', rapado_mujer: 'Rapado' },
  },
  colorPelo: { negro: ['Negro', 0x2a2420], castano: ['Castaño', 0x5a3c26], claro: ['Castaño claro', 0x8a6440], rubio: ['Rubio', 0xc9a66b], pelirrojo: ['Pelirrojo', 0x8e3f1f], canoso: ['Canoso', 0xb8b2a8] },
  piel: { clara: ['Clara', 0xffffff], media: ['Media', 0xe9d2c0], morena: ['Morena', 0xc9a184], oscura: ['Oscura', 0x8a6650] },
  barba: { si: 'Con barba', no: 'Sin barba' },
};
export const CLIPS = {
  quieto: 'Idle_Loop', andar: 'Walk_Loop', correr: 'Jog_Fwd_Loop', talar: 'TreeChopping_Loop',
  guardia: 'Sword_Idle', golpe: 'Sword_Regular_A', parar: 'Sword_Block', cargar: 'Walk_Carry_Loop', recoger: 'Farm_Harvest',
};
// las de animaciones_extra.glb (solo con op.extra); todas se pueden poner también por su nombre original
export const CLIPS_EXTRA = {
  vendarse: 'Bandage_Loop', apuntar: 'Bow_Aim_Neutral', apuntarArriba: 'Bow_Aim_Up', apuntarAbajo: 'Bow_Aim_Down', flecha: 'Bow_Notch', disparar: 'Bow_Shoot',
  minar: 'Mining_Loop', cogerFruta: 'Farm_PickingTree', sembrarVoleo: 'Farm_ScatteringSeeds', plantar: 'Farm_PlantSeed', regar: 'Farm_Watering',
  lanzarCana: 'Fish_Cast', pescar: 'Fish_Cast_Idle_Loop', recogerSedal: 'Fish_Reel',
  golpeLigero1: 'Sword_Light_A', golpeLigero2: 'Sword_Light_B', golpeLigero3: 'Sword_Light_C', golpeLigero4: 'Sword_Light_D',
  golpePesado1: 'Sword_Heavy_A', golpePesado2: 'Sword_Heavy_B', golpePesado3: 'Sword_Heavy_C', golpePesado4: 'Sword_Heavy_D',
  guardiaEscudo: 'Idle_Shield_Loop', golpeEscudo: 'Shield_OneShot',
  andarAdelante: 'Walk_Fwd_Loop', andarAtras: 'Walk_Bwd_Loop', andarIzquierda: 'Walk_L_Loop', andarDerecha: 'Walk_R_Loop', girarIzquierda: 'Turn180_L', girarDerecha: 'Turn180_R',
  trepar: 'ClimbUp_1m', comer: 'Consume', abrirCofre: 'Chest_Open', tumbarse: 'IdleToLay', levantarse: 'LayToIdle', brazosCruzados: 'Idle_FoldArms_Loop',
  empujado: 'Hit_Knockback', lanzar: 'OverhandThrow',
  // para cargar (taller-anim-v2): empujar (carretilla, rastra) y coger algo de una mesa (con una mano)
  empujar: 'Push_Loop', cogerDeMesa: 'PickUp_Table',
};

const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // la v2 va comprimida con meshopt
const cache = new Map();
function cargar(url) {
  if (!cache.has(url)) cache.set(url, new Promise((ok, mal) => cargador.load(url, ok, undefined, mal)));
  return cache.get(url);
}

const CABEZA = new Set(['Head', 'neck_01']);
// geometría de la base reducida a cabeza y cuello (triángulos cuyos tres vértices dependen sobre todo de esos huesos)
function soloCabeza(malla) {
  const g = malla.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index.array;
  const nombres = malla.skeleton.bones.map(b => b.name);
  const enCabeza = (v) => { let w = 0; for (let k = 0; k < 4; k++) if (CABEZA.has(nombres[si.getComponent(v, k)])) w += sw.getComponent(v, k); return w > 0.5; };
  const quedan = [];
  for (let t = 0; t < idx.length; t += 3) if (enCabeza(idx[t]) && enCabeza(idx[t + 1]) && enCabeza(idx[t + 2])) quedan.push(idx[t], idx[t + 1], idx[t + 2]);
  g.setIndex(quedan);
  return g;
}

// Crea un personaje. `base` es la carpeta de los .glb (con barra final).
export async function crearPersonaje(op = {}, base = 'recursos/personajes/') {
  const o = { sexo: 'hombre', ropa: 'campesino', pelo: null, colorPelo: 'castano', piel: 'clara', barba: 'si', calidad: 'alta', extra: false, ...op };
  if (!OPCIONES.pelo[o.sexo][o.pelo]) o.pelo = Object.keys(OPCIONES.pelo[o.sexo])[0];
  const conBarba = o.sexo === 'hombre' && o.barba === 'si';
  const [ropa, cuerpo, pelo, barba, anim, animExtra] = await Promise.all([
    cargar(`${base}ropa_${o.ropa}_${o.sexo}.glb`), cargar(`${base}base_${o.sexo}.glb`), cargar(`${base}pelo_${o.pelo}.glb`),
    conBarba ? cargar(`${base}barba.glb`) : null, cargar(`${base}animaciones.glb`), o.extra ? cargar(`${base}animaciones_extra.glb`) : null]);

  const raiz = new THREE.Group();
  // la ropa trae el esqueleto que manda; se clona para poder tener varios personajes a la vez
  const modelo = clone(ropa.scene);
  raiz.add(modelo);
  let esqueleto = null;
  modelo.traverse(n => { if (n.isSkinnedMesh && !esqueleto) esqueleto = n.skeleton; });
  const hueso = Object.fromEntries(esqueleto.bones.map(b => [b.name, b]));

  const colorPiel = new THREE.Color(OPCIONES.piel[o.piel][1]), colorPelo = new THREE.Color(OPCIONES.colorPelo[o.colorPelo][1]);
  const materiales = new Map(); // cada personaje con sus propios materiales (color de piel y pelo)
  // calidad «ligera» (móvil): material sencillo solo con el color, sin relieve ni rugosidad
  const simplificar = (m) => o.calidad === 'alta' ? m.clone() : new THREE.MeshLambertMaterial({ name: m.name, map: m.map, color: m.color.clone(), transparent: m.transparent, alphaTest: m.alphaTest, side: THREE.FrontSide });
  const material = (m) => {
    if (!materiales.has(m)) {
      const c = simplificar(m);
      if (/Hair/.test(m.name)) c.color.copy(colorPelo);
      else if (/Superhero|Regular/.test(m.name)) c.color.copy(colorPiel);
      materiales.set(m, c);
    }
    return materiales.get(m);
  };
  // ata una malla con piel de otro archivo al esqueleto de la ropa (los huesos se llaman igual)
  const atar = (m, geometria) => {
    const huesos = m.skeleton.bones.map(b => hueso[b.name]);
    const nueva = new THREE.SkinnedMesh(geometria || m.geometry, Array.isArray(m.material) ? m.material.map(material) : material(m.material));
    nueva.name = m.name;
    modelo.add(nueva);
    nueva.bind(new THREE.Skeleton(huesos, m.skeleton.boneInverses.map(x => x.clone())), m.bindMatrix.clone());
    return nueva;
  };
  modelo.traverse(n => { if (n.isSkinnedMesh) n.material = Array.isArray(n.material) ? n.material.map(material) : material(n.material); });
  const sueltas = [];
  cuerpo.scene.traverse(n => { if (n.isSkinnedMesh) sueltas.push(n); });
  for (const m of sueltas) atar(m, /Face/.test(m.name) ? null : soloCabeza(m)); // ojos y cejas enteros; del cuerpo, solo la cabeza
  for (const extra of [pelo, barba]) if (extra) extra.scene.traverse(n => { if (n.isSkinnedMesh) atar(n); });

  // un solo esqueleto para todas las mallas que comparten posición de reposo (ropa, pelo, barba):
  // así los huesos se calculan y se suben a la tarjeta una vez por fotograma, no una vez por malla
  const mallas = [];
  modelo.traverse(n => { if (n.isSkinnedMesh) mallas.push(n); });
  const ref = esqueleto;
  for (const m of mallas) {
    if (m.skeleton === ref || m.skeleton.bones.length !== ref.bones.length) continue;
    const iguales = m.skeleton.bones.every((b, i) => b === ref.bones[i] && m.skeleton.boneInverses[i].equals(ref.boneInverses[i]));
    if (iguales) m.bind(ref, m.bindMatrix);
  }
  let triangulos = 0;
  modelo.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; triangulos += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3; } });

  const mezclador = new THREE.AnimationMixer(modelo);
  const acciones = {};
  for (const clip of anim.animations) acciones[clip.name] = mezclador.clipAction(clip);
  for (const [id, nombre] of Object.entries(CLIPS)) if (acciones[nombre]) acciones[id] = acciones[nombre];
  // cinco extra se llaman igual que una de las básicas (son otra versión): la básica conserva el nombre y la extra va como «nombre_2»
  const extra = {};
  for (const clip of animExtra ? animExtra.animations : []) {
    extra[clip.name] = acciones[clip.name] ? clip.name + '_2' : clip.name;
    acciones[extra[clip.name]] = mezclador.clipAction(clip);
  }
  for (const [id, nombre] of Object.entries(CLIPS_EXTRA)) if (extra[nombre]) acciones[id] = acciones[extra[nombre]];
  let actual = null;
  const poner = (id, mezcla = 0.25) => {
    const a = acciones[id] || acciones.quieto;
    if (a === actual && a.isRunning()) return;
    a.reset().setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(a, mezcla, false);
    actual = a;
  };
  poner('quieto', 0);
  const clips = [...anim.animations.map(c => c.name), ...Object.values(extra)];
  return { raiz, modelo, mezclador, acciones, poner, triangulos, opciones: o, hueso, clips };
}
