// Kinhold — los personajes de Meshy (valravnx, 10 nov: «integrar a la alpha el modelo masculino y femenino retirando
// del juego los modelos antiguos»). Un hombre y una mujer hechos por valravnx en Meshy, con el esqueleto de la API de
// Meshy (24 huesos, sin dedos) y 59 animaciones de su biblioteca, unidos en un .glb por sexo
// (docs/recursos/personajes/meshy-v1/, herramientas/meshy/unir_personaje.mjs).
//
// Devuelve lo mismo que crearPersonajeMH (src/personajes/makehuman.js) para que el juego no tenga que cambiar: raiz,
// modelo, mezclador, acciones (con los nombres del juego: quieto, andar, correr, talar…), poner, velocidad, hueso
// (con los nombres del esqueleto de antes: hand_r, pelvis, spine_03…), ponerNivel. La ropa por capas, el aspecto, los
// tintes y las hechuras aún no se ven en estos modelos («poco a poco, sin prisa»): sus funciones se quedan, sin efecto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { OCULTO } from '../logica/detalle.js';

const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
function cargar(url) {
  if (!cache.has(url)) cache.set(url, new Promise((ok, mal) => cargador.load(url, ok, undefined, mal)));
  return cache.get(url);
}

// los huesos del esqueleto de antes (MakeHuman y Quaternius) con los que el juego los busca
const HUESOS = {
  pelvis: 'Hips', root: 'Hips', Root: 'Hips', spine_01: 'Spine', spine_02: 'Spine01', spine_03: 'Spine02', neck_01: 'neck', head: 'Head',
  clavicle_l: 'LeftShoulder', upperarm_l: 'LeftArm', lowerarm_l: 'LeftForeArm', hand_l: 'LeftHand',
  clavicle_r: 'RightShoulder', upperarm_r: 'RightArm', lowerarm_r: 'RightForeArm', hand_r: 'RightHand',
  thigh_l: 'LeftUpLeg', calf_l: 'LeftLeg', foot_l: 'LeftFoot', ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg', calf_r: 'RightLeg', foot_r: 'RightFoot', ball_r: 'RightToeBase',
};
// las animaciones del juego y la de Meshy que hace de cada una (por sexo, si cambia)
export const CLIPS_MESHY = {
  quieto: 'Idle', andar: { hombre: 'Quick_Walk', mujer: 'Walking_Woman' }, correr: 'Run_02', talar: 'Heavy_Hammer_Swing',
  guardia: 'Combat_Stance', golpe: 'Right_Hand_Sword_Slash', parar: 'Sword_Parry', cargar: 'mov_cargar_brazos', recoger: 'Collect_Object',
  minar: 'Heavy_Hammer_Swing', segar: 'Reaping_Swing', cogerFruta: 'Female_Stand_Pick_Fruit_Basket', plantar: 'Pull_Radish',
  cogerDeMesa: 'Female_Crouch_Pick_Up_Place_Side', agacharse: 'Male_Bend_Over_Pick_Up', comer: 'Stand_and_Drink', abrirCofre: 'open_door',
  golpeLigero1: 'Left_Slash', golpeLigero2: 'Thrust_Slash', golpePesado1: 'Charged_Upward_Slash', pararDos: 'Two_Handed_Parry', bloquear: 'Block1',
  rodar: 'Roll_Dodge', esquivar: 'Stand_Dodge', empujado: 'Hit_Reaction', derribado: 'Knock_Down', morir: 'dying_backwards', muerto: 'Dead',
  disparar: 'Archery_Shot', lanzar: 'Crouch_Pull_and_Throw', andarAtras: 'Walk_Backward', andarDeprisa: 'Quick_Walk', correrDeprisa: 'RunFast',
  saltar: 'Regular_Jump', trepar: 'Climb_Stairs', escalera: 'Ladder_Climb_Loop', nadarQuieto: 'Swim_Idle', nadar: 'Swim_Forward',
  // (las «mov_», hechas con Text to Motion de Meshy, 10 nov: lo que la biblioteca no trae; los brazos se ajustan además donde
  // agarran: src/juego/personaje.js)
  hombro: 'mov_hombro_andar', hombroQuieto: 'mov_hombro_quieto', arrastrar: 'mov_arrastrar', empujar: 'Push_and_Walk_Forward',
  empujarCarretilla: 'mov_empujar_andar', empujarQuieto: 'mov_empujar_quieto',
  tumbarse: 'Stand_to_Sit_Transition_M', dormido: 'Sleep_Normally', levantarse: 'Wake_Up_and_Look_Up', sentado: 'Sit_Cross_Legged_on_Floor',
  brazosCruzados: 'Idle_02', mirarAlrededor: 'Axe_Breathe_and_Look_Around', saludar: 'Wave_One_Hand', asentir: 'Agree_Gesture',
  charlar: 'Stand_and_Chat', reverencia: 'Formal_Bow', herido: 'Injured_Walk', agazapado: 'Cautious_Crouch_Walk_Forward',
};

// Los dedos que el juego usa para poner lo que se lleva en la mano (índice, corazón y meñique: src/juego/personaje.js
// empunar y src/juego/llevado.js): este esqueleto no tiene, así que se ponen puntos atados a la mano donde estarían
// sus nudillos, medidos en la postura de reposo (brazos abiertos, palmas abajo, el pulgar hacia delante).
function ponerDedos(hueso, modelo) {
  modelo.updateMatrixWorld(true);
  const p = (b) => b.getWorldPosition(new THREE.Vector3());
  for (const l of ['l', 'r']) {
    const mano = hueso['hand_' + l], ante = hueso['lowerarm_' + l];
    if (!mano || !ante) continue;
    const m = p(mano), dir = m.clone().sub(p(ante)).normalize();
    // delante, quitando lo que va a lo largo del brazo
    const fr = new THREE.Vector3(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
    const punto = (nombre, largo, lado) => {
      const o = new THREE.Object3D(); o.name = `${nombre}_${l}`;
      o.position.copy(mano.worldToLocal(m.clone().addScaledVector(dir, largo).addScaledVector(fr, lado)));
      mano.add(o); hueso[o.name] = o;
    };
    punto('middle_01', 0.085, 0); punto('index_01', 0.08, 0.03); punto('pinky_01', 0.07, -0.03);
  }
}

// la carpeta de los de Meshy, al lado de la del taller que da cada prototipo (src/mundo/eleccion.js: recursosTaller)
export const carpetaMeshy = (recursos) => String(recursos || '../../recursos/personajes/taller/').replace(/[^/]+\/?$/, 'meshy-v1/');

// `base`: la carpeta de los .glb de Meshy (con barra final)
export async function crearPersonajeMeshy(op = {}, base = 'recursos/personajes/meshy-v1/') {
  const o = { sexo: 'hombre', ...op };
  const sexo = o.sexo === 'mujer' ? 'mujer' : 'hombre';
  const g = await cargar(`${base}${sexo}.glb`);
  const raiz = new THREE.Group();
  const modelo = clone(g.scene);
  raiz.add(modelo);
  let triangulos = 0;
  modelo.traverse(n => {
    if (!n.isMesh) return;
    n.castShadow = n.receiveShadow = true; n.frustumCulled = false;
    n.material = n.material.clone();
    triangulos += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
  });
  const hueso = {};
  // (los dedos: la manopla middle_01…03 y el pulgar, hechos con herramientas/meshy/poner_dedos.mjs, y los puntos index_01
  // y pinky_01 de la mano)
  modelo.traverse(n => { if (n.isBone || /^(index|pinky|middle|thumb)_0\d_[lr]$/.test(n.name)) hueso[n.name] = n; });
  for (const [k, v] of Object.entries(HUESOS)) if (hueso[v]) hueso[k] = hueso[v];
  hueso.Head = hueso.Head || hueso.head;
  if (!hueso.middle_01_r) ponerDedos(hueso, modelo); // (los .glb sin dedos)
  // cerrar la mano (valravnx, 10 nov: «una manopla… haciendo una O cuando agarre algo de asta»): la manopla se dobla por
  // sus tres tramos y el pulgar la mitad; k de 0 (abierta) a 1 (cerrada)
  const giran = { l: [], r: [] };
  modelo.traverse(n => { const e = n.userData && n.userData.cerrar; if (!e) return; const l = n.name.endsWith('_l') ? 'l' : 'r'; giran[l].push({ n, eje: new THREE.Vector3(...e), signo: n.userData.signo, q0: n.quaternion.clone(), pulgar: n.name.startsWith('thumb') }); });
  const cierre = { l: -1, r: -1 }, _qc = new THREE.Quaternion();
  const cerrarMano = (lado, k) => {
    if (cierre[lado] === k) return; cierre[lado] = k;
    for (const g of giran[lado]) g.n.quaternion.copy(g.q0).multiply(_qc.setFromAxisAngle(g.eje, g.signo * k * (g.pulgar ? 0.5 : 0.95)));
  };

  const mezclador = new THREE.AnimationMixer(modelo);
  const acciones = {};
  for (const clip of g.animations) acciones[clip.name] = mezclador.clipAction(clip);
  for (const [id, c] of Object.entries(CLIPS_MESHY)) { const n = typeof c === 'string' ? c : c[sexo]; if (acciones[n]) acciones[id] = acciones[n]; }
  // las de una vez (tumbarse, levantarse, morir…) se quedan en la última postura
  for (const id of ['tumbarse', 'levantarse', 'morir', 'derribado']) if (acciones[id]) { acciones[id].setLoop(THREE.LoopOnce, 1); acciones[id].clampWhenFinished = true; }

  // velocidad natural de andar y correr (m/s), medida en el propio clip como en makehuman.js: lo que retrocede el pie
  // apoyado respecto al cuerpo. El juego acelera la animación con velocidad / natural para que los pies no resbalen.
  const velocidad = {};
  {
    const mz = new THREE.AnimationMixer(modelo), pie = [hueso.ball_l, hueso.ball_r], v = new THREE.Vector3();
    for (const id of ['andar', 'correr', 'hombro', 'empujarCarretilla', 'arrastrar', 'cargar']) {
      const clip = acciones[id]?.getClip(); if (!clip || !pie[0]) continue;
      const a = mz.clipAction(clip).play(), N = 120, m = [];
      for (let i = 0; i <= N; i++) {
        mz.setTime(clip.duration * i / N); modelo.updateMatrixWorld(true);
        m.push(pie.map(p => { p.getWorldPosition(v); return [v.y, v.z]; }));
      }
      a.stop();
      const suelo = Math.min(...m.flat().map(x => x[0])), vs = [];
      for (let i = 0; i < N; i++) for (const k of [0, 1])
        if (m[i][k][0] < suelo + 0.05 && m[i + 1][k][0] < suelo + 0.05) vs.push((m[i][k][1] - m[i + 1][k][1]) / (clip.duration / N));
      vs.sort((x, y) => x - y);
      if (vs.length) velocidad[id] = vs[vs.length >> 1];
    }
    mz.uncacheRoot(modelo);
  }
  // los pies, en el suelo: el modelo de Meshy trae la planta unos 17-19 cm por debajo de su origen (valravnx, 10 nov:
  // «los pies muy hundidos en el suelo»). Se mide lo más bajo del cuerpo ya en la postura de quieto (con los huesos) y
  // se sube eso.
  {
    const mz = new THREE.AnimationMixer(modelo), clip = acciones.quieto?.getClip();
    if (clip) { mz.clipAction(clip).play(); mz.setTime(0); }
    modelo.updateMatrixWorld(true);
    let bajo = Infinity;
    modelo.traverse(n => { if (n.isSkinnedMesh) { n.computeBoundingBox(); bajo = Math.min(bajo, n.boundingBox.clone().applyMatrix4(n.matrixWorld).min.y); } });
    mz.stopAllAction(); mz.uncacheRoot(modelo);
    if (Number.isFinite(bajo)) modelo.position.y -= bajo;
    modelo.traverse(n => { if (n.isSkinnedMesh) n.boundingBox = null; });
  }

  let actual = null;
  const poner = (id, mezcla = 0.25) => {
    const a = acciones[id] || acciones.quieto;
    if (a === actual && a.isRunning()) return;
    a.reset().setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(a, mezcla, false);
    actual = a;
  };
  poner('quieto', 0);

  const resultado = {
    cerrarMano, tieneDedos: giran.r.length > 0,
    raiz, modelo, mezclador, acciones, poner, triangulos, triangulosNivel: triangulos, velocidad, hueso, opciones: o, meshy: true,
    clips: g.animations.map(c => c.name),
    // aún sin ropa por capas, aspecto, tintes ni hechuras: el modelo se ve como lo hizo valravnx
    capas: [], hechuras: {}, tintes: null, aspecto: null, tenibles: [], capasPosibles: [], tocados: [],
    // (lo que lleva puesto se apunta, para el resto del juego, aunque aún no se vea)
    ponerCapas(l) { resultado.capas = Array.isArray(l) ? [...l] : []; }, ponerAspecto() {}, ponerTintes() {}, ponerHechuras() {}, corteDe: () => -100, vueloCapa: () => ({ x: 0, z: 0, onda: 0 }),
    // niveles de detalle (src/logica/detalle.js): con unos 3.000 triángulos no hace falta otra malla; lejos de la vista, no se dibuja
    nivel: 0,
    ponerNivel(n) { resultado.nivel = n; raiz.visible = n < OCULTO; },
  };
  resultado.ponerCapas(o.capas);
  return resultado;
}
