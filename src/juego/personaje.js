// Kinhold — personaje inicial: camisa y pantalón de lino, descalzo.
import * as THREE from 'three';
import { mat } from './modelos.js';

const PIEL = 0xd6a77a, LINO = 0xd9cfb8, LINO_OSC = 0xbfb498, PELO = 0x4a3324, CORDEL = 0x8a7a55;

function pieza(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function crearPersonaje() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);

  // piernas (pivotan en la cadera)
  const piernas = [];
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group();
    cadera.position.set(lado * 0.12, 0.9, 0);
    cadera.add(pieza(new THREE.BoxGeometry(0.17, 0.78, 0.2), LINO_OSC, 0, -0.39, 0));
    cadera.add(pieza(new THREE.BoxGeometry(0.15, 0.1, 0.26), PIEL, 0, -0.85, 0.04));
    cuerpo.add(cadera);
    piernas.push(cadera);
  }
  // torso
  cuerpo.add(pieza(new THREE.BoxGeometry(0.46, 0.62, 0.26), LINO, 0, 1.22, 0));
  cuerpo.add(pieza(new THREE.BoxGeometry(0.48, 0.06, 0.28), CORDEL, 0, 0.93, 0)); // cordel a la cintura
  // brazos (pivotan en el hombro)
  const brazos = [];
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group();
    hombro.position.set(lado * 0.3, 1.48, 0);
    hombro.add(pieza(new THREE.BoxGeometry(0.13, 0.42, 0.14), LINO, 0, -0.21, 0));
    hombro.add(pieza(new THREE.BoxGeometry(0.11, 0.24, 0.12), PIEL, 0, -0.52, 0));
    cuerpo.add(hombro);
    brazos.push(hombro);
  }
  // cabeza
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.62, 0);
  cabeza.add(pieza(new THREE.BoxGeometry(0.1, 0.1, 0.1), PIEL, 0, 0.02, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.15, 0), PIEL, 0, 0.2, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.155, 0), PELO, 0, 0.26, -0.03));
  cabeza.add(pieza(new THREE.BoxGeometry(0.03, 0.03, 0.02), 0x2a2018, -0.055, 0.21, 0.135));
  cabeza.add(pieza(new THREE.BoxGeometry(0.03, 0.03, 0.02), 0x2a2018, 0.055, 0.21, 0.135));
  cuerpo.add(cabeza);

  g.userData = { piernas, brazos, cuerpo, fase: 0 };
  return g;
}

// velocidad en m/s; dt en segundos
export function animarPersonaje(g, velocidad, dt) {
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
