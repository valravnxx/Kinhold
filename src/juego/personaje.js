// Kinhold — el jugador de la construcción: el personaje del taller propio (MakeHuman vestido por código, con las
// animaciones de Quaternius) con camisa y calzas de lino, como empieza según el GDD. Los zapatos se quedan puestos de
// momento: el cuerpo del taller no tiene pies debajo (se quitan al vestir), y descalzo se vería sin pies.
// Mientras se carga (o si no se puede cargar, p. ej. abriendo el html suelto sin servidor) se ve el muñeco inicial.
import * as THREE from 'three';
import { mat } from './modelos.js';
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
    if (m !== j.modo) { j.mh.poner(m, 0.2); j.modo = m; }
    j.mh.acciones[m].timeScale = ritmo;
    j.mh.mezclador.update(dt);
  };
  return j;
}
