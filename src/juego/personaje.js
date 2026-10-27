// Kinhold — el jugador de la construcción: el personaje del taller propio (MakeHuman vestido por código, con las
// animaciones de Quaternius) con camisa y calzas de lino, como empieza según el GDD. Los zapatos se quedan puestos de
// momento: el cuerpo del taller no tiene pies debajo (se quitan al vestir), y descalzo se vería sin pies.
// Mientras se carga (o si no se puede cargar, p. ej. abriendo el html suelto sin servidor) se ve el muñeco inicial.
import * as THREE from 'three';
import { mat, deLote, cajaR } from './modelos.js';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { crearPersonajeMH } from '../personajes/makehuman.js';

const PIEL = 0xd6a77a, LINO = 0xd9cfb8, LINO_OSC = 0xbfb498, PELO = 0x4a3324, CORDEL = 0x8a7a55;


function pieza(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// muñeco provisional (el de siempre), solo mientras carga el del taller
function crearMuneco() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const piernas = [];
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group();
    cadera.position.set(lado * 0.12, 0.9, 0);
    cadera.add(pieza(new THREE.BoxGeometry(0.17, 0.78, 0.2), LINO_OSC, 0, -0.39, 0));
    cadera.add(pieza(new THREE.BoxGeometry(0.15, 0.1, 0.26), PIEL, 0, -0.85, 0.04));
    cuerpo.add(cadera);
    piernas.push(cadera);
  }
  cuerpo.add(pieza(new THREE.BoxGeometry(0.46, 0.62, 0.26), LINO, 0, 1.22, 0));
  cuerpo.add(pieza(new THREE.BoxGeometry(0.48, 0.06, 0.28), CORDEL, 0, 0.93, 0));
  const brazos = [];
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group();
    hombro.position.set(lado * 0.3, 1.48, 0);
    hombro.add(pieza(new THREE.BoxGeometry(0.13, 0.42, 0.14), LINO, 0, -0.21, 0));
    hombro.add(pieza(new THREE.BoxGeometry(0.11, 0.24, 0.12), PIEL, 0, -0.52, 0));
    cuerpo.add(hombro);
    brazos.push(hombro);
  }
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.62, 0);
  cabeza.add(pieza(new THREE.BoxGeometry(0.1, 0.1, 0.1), PIEL, 0, 0.02, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.15, 0), PIEL, 0, 0.2, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.155, 0), PELO, 0, 0.26, -0.03));
  cuerpo.add(cabeza);
  g.userData = { piernas, brazos, cuerpo, fase: 0 };
  return g;
}
function animarMuneco(g, velocidad, dt) {
  const u = g.userData;
  if (velocidad > 0.1) {
    u.fase += dt * velocidad * 2.4;
    const a = Math.sin(u.fase) * Math.min(0.7, velocidad * 0.16);
    u.piernas[0].rotation.x = a; u.piernas[1].rotation.x = -a;
    u.brazos[0].rotation.x = -a * 0.8; u.brazos[1].rotation.x = a * 0.8;
    u.cuerpo.position.y = Math.abs(Math.cos(u.fase)) * 0.03;
  } else {
    for (const p of [...u.piernas, ...u.brazos]) p.rotation.x *= 0.8;
    u.cuerpo.position.y *= 0.8;
  }
}

// Hacha de talar con el estilo v5 (como la del tocón de la prueba): mango de fresno con veta, algo curvado y más
// grueso abajo, cabeza de hierro con el filo más claro y la cuña que la sujeta. Mango a lo largo de +Y (la mano en el
// origen, cerca del extremo) y filo hacia +Z.
export function modeloHacha() {
  const L = new Lote({ variacion: 0.04, rangoSuelo: 0.001, suelo: -100 });
  L.add(cil(0.016, 0.02, 0.72, 8), 'tabla', 0, 0.26, 0, { x: 0.04 }, { tex: 'veta' });
  L.add(new THREE.SphereGeometry(0.022, 8, 5), 'tabla', 0, -0.1, -0.003, null, { escala: new THREE.Vector3(1, 0.7, 1.3), tex: 'veta' });
  const y = 0.56;
  L.add(cajaR(0.034, 0.075, 0.07, 0.01), 'hierro', 0, y, 0.016);                                        // ojo
  L.add(cajaR(0.016, 0.12, 0.1, 0.006), 'hierro', 0, y - 0.01, 0.085);                                    // pala
  L.add(cajaR(0.01, 0.15, 0.022, 0.004), 0x8d8e8e, 0, y - 0.015, 0.142);                                  // filo
  L.add(cajaR(0.03, 0.04, 0.03, 0.008), 'hierro', 0, y, -0.035);                                          // cotillo
  L.add(new THREE.CircleGeometry(0.014, 6), 'corte', 0, y + 0.0385, 0.016, { x: -Math.PI / 2 });          // cuña
  const g = deLote(L); g.name = 'hacha';
  return g;
}
// Pone el hacha en la mano derecha: el mango atravesado a los dedos (del meñique al índice, la cabeza por el lado
// del pulgar) y el filo hacia los nudillos, como se agarra. Se calcula con los huesos, así vale para cualquier cuerpo.
function empunarHacha(mh) {
  const h = mh.hueso, mano = h.hand_r, med = h.middle_01_r, ind = h.index_01_r, men = h.pinky_01_r;
  if (!mano || !med || !ind || !men) return null;
  mh.raiz.updateMatrixWorld(true);
  const loc = (b) => mano.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const pm = loc(med), f = pm.clone().normalize();                       // hacia los nudillos
  const y = loc(ind).sub(loc(men)); y.addScaledVector(f, -y.dot(f)).normalize(); // del meñique al índice
  const x = new THREE.Vector3().crossVectors(y, f);
  const hacha = modeloHacha();
  hacha.matrix.makeBasis(x, y, f).setPosition(pm.multiplyScalar(1.15));
  hacha.matrix.decompose(hacha.position, hacha.quaternion, hacha.scale);
  // la mano tiene la escala del esqueleto: el hacha se deja a su tamaño de verdad
  const e = new THREE.Vector3(); mano.getWorldScale(e); hacha.scale.divideScalar(e.x || 1);
  hacha.visible = false;
  mano.add(hacha);
  return hacha;
}

// Devuelve { raiz, animar(velocidad, dt, talando), cargado(), modo(), mh }. `recursos`: carpeta de los .glb del taller.
// `sexo` y `capas`: los del personaje elegido en el visor (por defecto, hombre con camisa y calzas).
export function crearJugador(recursos, sexo = 'hombre', capas = []) {
  const raiz = new THREE.Group();
  const muneco = crearMuneco();
  raiz.add(muneco);
  const j = { raiz, mh: null, error: null, modo: 'quieto' };
  j.listo = crearPersonajeMH({ sexo, capas }, recursos).then(mh => {
    raiz.remove(muneco);
    raiz.add(mh.raiz);
    j.mh = mh;
    j.hacha = empunarHacha(mh);
  }).catch(e => { j.error = e.message || String(e); console.warn('Personaje del taller no cargado, sigue el muñeco:', e); });
  j.animar = (velocidad, dt, talando = false) => {
    if (!j.mh) { animarMuneco(muneco, velocidad, dt); return; }
    // andar despacio (joystick a medias), correr a partir de 1,8 m/s; la animación se acelera con la velocidad,
    // hasta 1,6× (más rápido se ve atropellado; a 6 m/s los pies resbalan algo)
    let m = 'quieto', ritmo = 1;
    if (velocidad > 0.1) {
      m = velocidad < 1.8 ? 'andar' : 'correr'; ritmo = velocidad / (j.mh.velocidad[m] || 1); // natural, medida al cargar
      ritmo = THREE.MathUtils.clamp(ritmo, 0.6, 1.6);
    } else if (talando) m = 'talar';
    if (m !== j.modo) { j.mh.poner(m, 0.2); j.modo = m; if (j.hacha) j.hacha.visible = m === 'talar'; }
    j.mh.acciones[m].timeScale = ritmo;
    j.mh.mezclador.update(dt);
  };
  return j;
}
