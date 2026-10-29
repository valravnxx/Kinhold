// Kinhold — modelos y animación del campo de pruebas de combate (low-poly por código)
import * as THREE from 'three';
import { mat, deLote, deMano, cajaR } from '../mundo/modelos.js';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { vestirConTaller, pintarHeridaTaller, animarTaller } from './taller.js';

const PIEL = 0xd6a77a, LINO = 0xd9cfb8, LINO_OSC = 0xbfb498, PELO = 0x4a3324, CORDEL = 0x8a7a55;
const ROPA = { lino: [LINO, LINO_OSC], gambeson: [0xb59a6a, 0x8f7a52], malla: [0x8a8f94, 0x5f6368] };
const SANGRE = 0x8a1410;

function pieza(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function marcador(g, nombre, y) { const o = new THREE.Object3D(); o.name = nombre; o.position.y = y; g.add(o); }
// ---------- Armas, escudo, proyectiles, poste y diana con el estilo v5 ----------
// Como las piezas de la construcción: formas redondeadas, madera con veta, cortes claros, hierro oscuro, tela tejida,
// todo junto en una malla por textura (deLote). Lo que se lleva en la mano no se oscurece «al pie» (no toca el suelo).
const ACERO = 0xc6c9c8, ACERO_OSC = 0x8a8c8c, HIERRO = 0x6a6b6e, CUERO = 0x4a3526, CUERO_CLARO = 0x6b4e36, PLUMA = 0xd5ccb8, PLUMA_OSC = 0x5b5149;
const loteMano = () => new Lote({ variacion: 0.04, rangoSuelo: 0.001, suelo: -100 });
// hoja de sección de rombo (con su arista en medio), de ancho a0 abajo a a1 arriba, a lo largo de +Y
function hoja(L, a0, a1, largo, grueso, y0) {
  // el cilindro de 4 lados ya tiene sus aristas en los ejes: se aplasta en z hasta el grueso
  const plana = new THREE.Vector3(1, 1, grueso / a0);
  L.add(new THREE.CylinderGeometry(a1 / 2, a0 / 2, largo, 4, 1), ACERO, 0, y0 + largo / 2, 0, null, { escala: plana, plano: true, brillo: 1.2, tex: 'acero' });
  L.add(new THREE.ConeGeometry(a1 / 2, a1 * 1.6, 4, 1), ACERO, 0, y0 + largo + a1 * 0.8, 0, null, { escala: plana, plano: true, brillo: 1.2, tex: 'acero' });
  // vaceo (la acanaladura del centro), algo más oscuro, en las dos caras
  for (const s of [-1, 1]) L.add(cajaR(a0 * 0.22, largo * 0.62, 0.004, 0.002), ACERO_OSC, 0, y0 + largo * 0.34, s * grueso * 0.32, null, { tex: 'acero' });
}
// puño forrado de cuero con su atadura en espiral (anillos algo más claros)
function puno(L, r, largo, y0) {
  L.add(cil(r, r * 1.08, largo, 8), CUERO, 0, y0 + largo / 2, 0, null, { tex: 'tejido' });
  for (let k = 1; k < 5; k++) L.add(new THREE.TorusGeometry(r * 1.06, 0.0035, 3, 10), CUERO_CLARO, 0, y0 + largo * k / 5, 0, { x: Math.PI / 2 + 0.25 });
}
function espada({ largoHoja, anchoBase, anchoPunta, largoPuno, anchoCruz }) {
  const L = loteMano();
  puno(L, 0.016, largoPuno, -largoPuno / 2);
  // pomo de rueda: disco de hierro con su botón
  L.add(cil(0.034, 0.034, 0.022, 12), HIERRO, 0, -largoPuno / 2 - 0.028, 0, { x: Math.PI / 2 });
  L.add(new THREE.SphereGeometry(0.012, 6, 4), HIERRO, 0, -largoPuno / 2 - 0.058, 0);
  // cruz: barra de hierro redondeada, un poco más fina en los extremos, con los remates
  const yc = largoPuno / 2 + 0.012;
  L.add(cil(0.011, 0.011, anchoCruz, 6), HIERRO, 0, yc, 0, { z: Math.PI / 2 }, { escala: new THREE.Vector3(1, 1, 1.25) });
  for (const s of [-1, 1]) L.add(new THREE.SphereGeometry(0.015, 6, 4), HIERRO, s * anchoCruz / 2, yc, 0);
  hoja(L, anchoBase, anchoPunta, largoHoja, 0.009, yc + 0.012);
  return deMano(L);
}
export function modeloArma(tipo) {
  let g = new THREE.Group();
  if (tipo === 'espada_larga') {
    // espada de mano y media: empuñadura en el origen; la hoja sale hacia +Y (hasta 1,2 m)
    g = espada({ largoHoja: 0.98, anchoBase: 0.048, anchoPunta: 0.018, largoPuno: 0.3, anchoCruz: 0.26 });
    marcador(g, 'punta', 1.2); marcador(g, 'medio', 0.55);
  } else if (tipo === 'espada_escudo') {
    // espada de una mano: más corta y con el puño para una sola mano
    g = espada({ largoHoja: 0.74, anchoBase: 0.046, anchoPunta: 0.018, largoPuno: 0.11, anchoCruz: 0.2 });
    marcador(g, 'punta', 0.88); marcador(g, 'medio', 0.4);
  } else if (tipo === 'palo') {
    // vara de fresno descortezada, algo más gruesa abajo, con un par de nudos y los cortes a la vista
    const L = loteMano();
    L.add(cil(0.028, 0.04, 1.4, 8), 'madera', 0, 0.45, 0, { z: 0.012 });
    for (const [y, a] of [[0.25, 0.4], [0.82, 2.6]]) L.add(new THREE.SphereGeometry(0.014, 5, 3), 'maderaOsc', Math.cos(a) * 0.032, y, Math.sin(a) * 0.032, null, { escala: new THREE.Vector3(1, 1.6, 1) });
    L.add(new THREE.CircleGeometry(0.027, 8), 'corte', 0.0115, 1.151, 0, { x: -Math.PI / 2 });
    L.add(new THREE.CircleGeometry(0.039, 8), 'corte', -0.0028, -0.251, 0, { x: Math.PI / 2 });
    g = deMano(L);
    marcador(g, 'punta', 1.15); marcador(g, 'medio', 0.5);
  } else if (tipo === 'arco') {
    // arco largo de una pieza de tejo: madera con veta, más gruesa en el centro, puño de cuero y los extremos con la muesca
    const L = loteMano();
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, 0, 0.32), new THREE.Vector3(0, 0.75, 0));
    const tubo = new THREE.TubeGeometry(curva, 18, 0.019, 6), p = tubo.attributes.position, c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { // adelgaza hacia las puntas
      const y = p.getY(i), t = Math.abs(y) / 0.75, k = 1 - 0.5 * t * t;
      curva.getPoint(0.5 + y / 1.5 * 0.999, c);
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, y, c.z + (p.getZ(i) - c.z) * k);
    }
    tubo.computeVertexNormals();
    L.add(tubo, 'madera', 0, 0, 0, null, { tex: 'veta' });
    L.add(cil(0.023, 0.023, 0.13, 8), CUERO, 0, 0, 0.24, null, { tex: 'tejido' });
    for (const s of [-1, 1]) L.add(cil(0.012, 0.006, 0.05, 6), 'maderaOsc', 0, s * 0.74, 0.003, s < 0 ? { x: Math.PI } : null);
    g = deMano(L);
    // la cuerda, una línea fina de lino (se tensa al tirar)
    const cuerda = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.75, 0)]);
    const linea = new THREE.Line(cuerda, new THREE.LineBasicMaterial({ color: 0xcbbf9f }));
    linea.name = 'cuerda';
    g.add(linea);
  } else if (tipo === 'piedras') {
    g = modeloPiedra();
  }
  g.userData.tipo = tipo;
  return g;
}
// Tablas que forman el escudo: el trozo del círculo entre x0 y x1 (forma para extruir)
function tablaRedonda(radio, x0, x1) {
  const s = new THREE.Shape(), n = 10;
  const a0 = Math.acos(Math.max(-1, Math.min(1, x0 / radio))), a1 = Math.acos(Math.max(-1, Math.min(1, x1 / radio))); // ángulos de los cantos en el borde
  s.moveTo(x0, -Math.sin(a0) * radio);
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; s.lineTo(Math.cos(-a) * radio, Math.sin(-a) * radio); } // borde de abajo
  for (let i = 0; i <= n; i++) { const a = a1 + (a0 - a1) * i / n; s.lineTo(Math.cos(a) * radio, Math.sin(a) * radio); }   // borde de arriba
  s.closePath();
  return s;
}
// Escudo redondo de tablas con el canto forrado de cuero cosido, umbo de hierro con clavos. Mira hacia +z; el asa queda en el origen.
export function modeloEscudo(radio = 0.32) {
  const L = loteMano(), nT = 6, R = radio - 0.004, w = 2 * R / nT;
  for (let i = 0; i < nT; i++) { // juntas de 4 mm entre tablas; las de los lados llegan al borde
    const x0 = -R + i * w + (i ? 0.002 : 0), x1 = -R + (i + 1) * w - (i < nT - 1 ? 0.002 : 0);
    const g = new THREE.ExtrudeGeometry(tablaRedonda(R, x0, x1), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 });
    L.add(g, i % 2 ? 'tabla' : 'madera', 0, 0, 0.039); // la veta va a lo largo de cada tabla (vertical)
  }
  L.add(new THREE.TorusGeometry(radio, 0.014, 5, 32), CUERO, 0, 0, 0.05, null, { tex: 'tejido' });
  // puntadas del forro, cada poco
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; L.add(new THREE.BoxGeometry(0.004, 0.012, 0.006), CUERO_CLARO, Math.cos(a) * (radio - 0.012), Math.sin(a) * (radio - 0.012), 0.065, { z: a }); }
  const umbo = new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); umbo.rotateX(Math.PI / 2);
  L.add(umbo, 'hierro', 0, 0, 0.062);
  L.add(new THREE.TorusGeometry(0.082, 0.008, 4, 16), 'hierro', 0, 0, 0.063);
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; L.add(new THREE.SphereGeometry(0.008, 5, 3), 'hierro', Math.cos(a) * 0.088, Math.sin(a) * 0.088, 0.064); }
  const g = deMano(L); g.name = 'escudo';
  return g;
}
export function modeloFlecha() {
  const L = loteMano();
  L.add(cil(0.0045, 0.0045, 0.74, 6), 'tabla', 0, 0, 0, { x: Math.PI / 2 });
  // punta de hierro forjada (punzón) con su cubo
  const punta = new THREE.ConeGeometry(0.009, 0.06, 4); punta.rotateX(Math.PI / 2);
  L.add(punta, 'hierro', 0, 0, 0.4, null, { plano: true });
  L.add(cil(0.006, 0.007, 0.03, 6), 'hierro', 0, 0, 0.36, { x: Math.PI / 2 });
  // tres plumas recortadas (una de otro color, la «guía») y la atadura
  for (const [a, c] of [[0, PLUMA_OSC], [2.1, PLUMA], [4.2, PLUMA]]) {
    const pl = new THREE.BoxGeometry(0.0015, 0.016, 0.09); pl.translate(0, 0.012, 0);
    L.add(pl, c, 0, 0, -0.3, { z: a }, { tex: 'tejido' });
  }
  for (const z of [-0.348, -0.252]) L.add(cil(0.0055, 0.0055, 0.008, 6), 0x6b5a45, 0, 0, z, { x: Math.PI / 2 });
  return deMano(L);
}
export function modeloPiedra() {
  const L = loteMano();
  L.add(new THREE.IcosahedronGeometry(0.06, 1), 'piedra', 0, 0, 0, { y: 0.7, x: 0.3 }, { escala: new THREE.Vector3(1.15, 0.8, 1), plano: true });
  return deMano(L);
}

// ---------- Poste de práctica y diana ----------
// Poste de práctica: tronco descortezado clavado en la tierra, con dos haces de paja atados con cuerda donde se golpea
export function modeloPoste() {
  const L = new Lote({ variacion: 0.05, rangoSuelo: 0.5 });
  L.add(cil(0.14, 0.17, 1.9, 9), 'madera', 0, 0.95, 0);
  L.add(new THREE.CircleGeometry(0.14, 9), 'corte', 0, 1.901, 0, { x: -Math.PI / 2 }, { sinSuelo: true });
  for (const [y, alto] of [[1.45, 0.5], [0.7, 0.35]]) {
    L.add(cil(0.19, 0.2, alto, 12), 'paja', 0, y, 0);
    for (const s of [-0.36, 0, 0.36]) L.add(new THREE.TorusGeometry(0.2, 0.011, 4, 14), 0x8a7a55, 0, y + s * alto, 0, { x: Math.PI / 2 });
  }
  // tierra removida y unas piedras calzando el pie
  L.add(cil(0.3, 0.38, 0.08, 10), 'tierra', 0, 0.02, 0, null, { tex: 'piedra' });
  for (let k = 0; k < 5; k++) { const a = k * 1.3; L.add(new THREE.IcosahedronGeometry(0.07 + (k % 2) * 0.03, 0), k % 2 ? 'piedra' : 'piedraOsc', Math.cos(a) * 0.27, 0.05, Math.sin(a) * 0.27, { y: a }, { escala: new THREE.Vector3(1.2, 0.7, 1), plano: true }); }
  return deLote(L);
}
// Diana: un haz grueso de paja atado, con un paño de lino delante pintado con tierras (ocre, almagre y carbón),
// sobre dos patas de madera. Mira hacia +z; el centro, en el origen.
export function modeloDiana(radio = 0.6) {
  const L = loteMano();
  L.add(cil(radio, radio, 0.24, 20), 'paja', 0, 0, -0.06, { x: Math.PI / 2 });
  for (const s of [-1, 1]) L.add(new THREE.TorusGeometry(radio + 0.004, 0.012, 4, 24), 0x8a7a55, 0, 0, -0.06 + s * 0.08);
  const anillos = [[1, 'lino'], [0.78, 0xa88a52], [0.56, 'pano'], [0.34, 0xc8bb98], [0.14, 0x3a332c]];
  anillos.forEach(([f, c], n) => L.add(new THREE.CircleGeometry(radio * f * 0.92, 28), c, 0, 0, 0.061 + n * 0.0015, null, { tex: 'tejido' }));
  for (const x of [-0.35, 0.35]) L.add(cajaR(0.07, 1.6, 0.07, 0.015), 'maderaOsc', x, -0.55, -0.15, { x: -0.15 });
  return deLote(L);
}

// ---------- Poses (manos y dirección del arma en el marco del personaje: mira hacia +z, su izquierda es +x) ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POSES = {
  base:      { m: V(0, 1.15, 0.38),     d: V(0, 0.6, 1) },
  // preparación y final de cada golpe
  alto:      { p: { m: V(0.08, 1.8, 0.0), d: V(0, 0.85, -0.5) },  f: { m: V(0, 1.0, 0.48), d: V(0, -0.5, 1) } },
  izquierda: { p: { m: V(0.38, 1.5, 0.05), d: V(1, 0.5, -0.4) },  f: { m: V(-0.35, 1.15, 0.42), d: V(-1, -0.1, 0.6) } },
  derecha:   { p: { m: V(-0.38, 1.5, 0.05), d: V(-1, 0.5, -0.4) }, f: { m: V(0.35, 1.15, 0.42), d: V(1, -0.1, 0.6) } },
  bajo:      { p: { m: V(-0.3, 0.95, 0.05), d: V(-0.6, -0.5, -0.5) }, f: { m: V(0.25, 0.95, 0.45), d: V(0.6, -0.6, 0.8) } },
  estocada:  { p: { m: V(0, 1.22, 0.08), d: V(0, 0.1, 1) },       f: { m: V(0, 1.3, 0.8), d: V(0, 0.03, 1) } },
};
// Con escudo, la espada se lleva en la derecha, adelantada; al parar se retira un poco detrás del escudo
const POSE_ESCUDO = { m: V(-0.24, 1.15, 0.36), d: V(-0.05, 0.6, 1) };
const POSE_ESCUDO_PARANDO = { m: V(-0.3, 1.25, 0.2), d: V(-0.2, 0.9, 0.5) };
const PARADAS = {
  alto:      { m: V(0, 1.72, 0.36),  d: V(1, 0.15, 0) },
  izquierda: { m: V(0.3, 1.3, 0.36), d: V(0.15, 1, 0.2) },
  derecha:   { m: V(-0.3, 1.3, 0.36), d: V(-0.15, 1, 0.2) },
  bajo:      { m: V(0, 0.95, 0.42),  d: V(0.3, -1, 0.25) },
  estocada:  { m: V(0, 1.3, 0.42),   d: V(0.25, 0.9, 0.35) },
};
const GUARDIAS_POSE = {
  vom_tag: { m: V(-0.22, 1.62, 0.06), d: V(0, 1, -0.25) },
  ochs:    { m: V(0.16, 1.62, 0.25),  d: V(-0.15, -0.15, 1) },
  pflug:   { m: V(-0.15, 1.0, 0.3),   d: V(0, 0.5, 1) },
  alber:   { m: V(0, 0.85, 0.36),     d: V(0, -0.6, 1) },
};
function mezclar(a, b, t) { return { m: a.m.clone().lerp(b.m, t), d: a.d.clone().normalize().lerp(b.d.clone().normalize(), t).normalize() }; }
const suave = (t) => t * t * (3 - 2 * t);

// ---------- Combatiente ----------
// recursos: carpeta de los .glb del taller; con ella el muñeco se cambia por el personaje del taller en cuanto carga
export function crearCombatiente({ armadura = 'lino', colorCinta = 0xc0392b, recursos = null, sexo = 'hombre', capas = null, aspecto = undefined } = {}) {
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group(); raiz.add(cuerpo);
  const [c1, c2] = ROPA[armadura] || ROPA.lino;
  const zonas = {};
  const piernas = [];
  for (const [lado, nombre] of [[1, 'piernaI'], [-1, 'piernaD']]) {
    const cadera = new THREE.Group(); cadera.position.set(lado * 0.12, 0.9, 0);
    cadera.add(pieza(new THREE.BoxGeometry(0.17, 0.78, 0.2), c2, 0, -0.39, 0));
    cadera.add(pieza(new THREE.BoxGeometry(0.15, 0.1, 0.26), PIEL, 0, -0.85, 0.04));
    cuerpo.add(cadera); piernas.push(cadera); zonas[nombre] = cadera;
  }
  const torso = new THREE.Group(); cuerpo.add(torso);
  torso.add(pieza(new THREE.BoxGeometry(0.46, 0.62, 0.26), c1, 0, 1.22, 0));
  torso.add(pieza(new THREE.BoxGeometry(0.48, 0.06, 0.28), CORDEL, 0, 0.93, 0));
  torso.add(pieza(new THREE.BoxGeometry(0.06, 0.3, 0.02), colorCinta, 0.15, 1.3, 0.14)); // distintivo
  zonas.torso = torso;
  const brazos = [];
  for (const [lado, nombre] of [[1, 'brazoI'], [-1, 'brazoD']]) {
    const hombro = new THREE.Group(); hombro.position.set(lado * 0.3, 1.48, 0);
    hombro.add(pieza(new THREE.BoxGeometry(0.13, 0.42, 0.14), c1, 0, -0.21, 0));
    hombro.add(pieza(new THREE.BoxGeometry(0.11, 0.24, 0.12), PIEL, 0, -0.52, 0));
    cuerpo.add(hombro); brazos.push(hombro); zonas[nombre] = hombro;
  }
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.62, 0);
  cabeza.add(pieza(new THREE.BoxGeometry(0.1, 0.1, 0.1), PIEL, 0, 0.02, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.15, 0), PIEL, 0, 0.2, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.155, 0), armadura === 'malla' ? 0x5f6368 : PELO, 0, 0.26, -0.03));
  cabeza.add(pieza(new THREE.BoxGeometry(0.03, 0.03, 0.02), 0x2a2018, -0.055, 0.21, 0.135));
  cabeza.add(pieza(new THREE.BoxGeometry(0.03, 0.03, 0.02), 0x2a2018, 0.055, 0.21, 0.135));
  cuerpo.add(cabeza); zonas.cabeza = cabeza;
  // las manos (con el arma) y el escudo van en su propio grupo: con el personaje del taller sube o baja con sus hombros
  const armas = new THREE.Group(); cuerpo.add(armas);
  const manos = new THREE.Group(); armas.add(manos);
  raiz.userData = { cuerpo, piernas, brazos, zonas, armas, manos, arma: null, fase: 0, heridasPintadas: 0, pose: { m: POSES.base.m.clone(), d: POSES.base.d.clone() } };
  if (recursos) raiz.userData.listo = vestirConTaller(raiz, { armadura, colorCinta, sexo, capas, aspecto }, recursos);
  return raiz;
}
export function ponerArma(raiz, tipo) {
  const u = raiz.userData;
  if (u.arma) u.manos.remove(u.arma);
  u.arma = modeloArma(tipo);
  u.manos.add(u.arma);
  if (u.escudo) { u.escudo.removeFromParent(); u.escudo = null; }
  if (tipo === 'espada_escudo') {
    u.escudo = modeloEscudo();
    u.escudo.position.copy(ESCUDO_REPOSO.p); u.escudo.rotation.y = ESCUDO_REPOSO.giro;
    u.armas.add(u.escudo);
  }
}
// Escudo en el brazo izquierdo (+x): bajado al costado o levantado delante al parar
const ESCUDO_REPOSO = { p: new THREE.Vector3(0.34, 1.05, 0.26), giro: 0.55, inclina: 0.15 };
const ESCUDO_ALTO = { p: new THREE.Vector3(0.1, 1.3, 0.44), giro: 0.08, inclina: -0.05 };

// Apunta un brazo (que cuelga hacia -Y desde el hombro) hacia un punto del cuerpo
const abajo = V(0, -1, 0);
function apuntarBrazo(hombro, objetivo) {
  const dir = objetivo.clone().sub(hombro.position);
  if (dir.lengthSq() < 1e-6) return;
  hombro.quaternion.setFromUnitVectors(abajo, dir.normalize());
}

// Mancha de sangre en la zona herida
const COLOR_GRAVEDAD = { leve: [0.07, 0.6], grave: [0.11, 0.85], 'muy grave': [0.16, 1] };
export function pintarHeridas(raiz, heridas) {
  const u = raiz.userData;
  const taller = u.taller && u.taller.estado === 'listo';
  // si una herida ya pintada ha cambiado (tratada, sanada o curada del todo), se quitan todas y se pintan otra vez
  const firma = (h) => [h.zona, h.gravedad, h.tipo, h.vendada, h.cosida, h.cauterizada, h.entablillada].join(',');
  const firmas = heridas.map(firma);
  const antes = u.firmasHeridas || [];
  if (u.heridasPintadas > heridas.length || antes.slice(0, u.heridasPintadas).some((f, i) => f !== firmas[i])) {
    const quitar = [];
    raiz.traverse(o => { if (o.name === 'herida') quitar.push(o); });
    for (const o of quitar) { o.parent.remove(o); o.geometry.dispose(); if (o.userData.materialPropio) o.material.dispose(); } // los del muñeco son de la caché
    u.heridasPintadas = 0;
  }
  u.firmasHeridas = firmas;
  for (let n = u.heridasPintadas; n < heridas.length; n++) {
    const h = heridas[n];
    if (taller) { pintarHeridaTaller(u, h, n); continue; }
    const [tam] = COLOR_GRAVEDAD[h.gravedad];
    const zona = u.zonas[h.zona];
    const m = pieza(new THREE.BoxGeometry(tam, tam * 1.3, 0.02), h.vendada || h.entablillada ? 0xcfc3a8 : h.cauterizada ? 0x3b2418 : h.tipo === 'contundente' ? 0x5b3a5e : SANGRE);
    m.name = 'herida';
    const desplaz = ((n * 37) % 7 - 3) * 0.02;
    if (h.zona === 'cabeza') m.position.set(desplaz, 0.22, 0.15);
    else if (h.zona === 'torso') m.position.set(desplaz * 2, 1.2 + desplaz, 0.14);
    else if (h.zona.startsWith('brazo')) m.position.set(0, -0.25 + desplaz, 0.08);
    else m.position.set(0, -0.35 + desplaz * 2, 0.11);
    zona.add(m);
  }
  u.heridasPintadas = heridas.length;
}

// Retroceso visual al recibir un golpe o una parada
export function sacudir(raiz, fuerza = 1) { raiz.userData.retroceso = 0.25 * fuerza; }

// Giro de torso según la línea y la fase del golpe (en radianes, eje vertical)
const GIRO = { alto: [0.15, -0.1], izquierda: [0.55, -0.5], derecha: [-0.55, 0.5], bajo: [-0.35, 0.3], estocada: [0.25, -0.15] };

// Pose del combatiente a partir del estado del luchador de la lógica.
// lineaParada: línea visual de la parada (por dónde viene el golpe, desde el punto de vista del que para)
export function animarCombatiente(raiz, L, dt, velocidad, cojea, lineaParada) {
  const u = raiz.userData;
  if (L.fuera) {
    u.cuerpo.rotation.x += (-Math.PI / 2 - u.cuerpo.rotation.x) * Math.min(1, dt * 4);
    u.cuerpo.position.y += (0.15 - u.cuerpo.position.y) * Math.min(1, dt * 4);
    u.cuerpo.position.z = 0;
    animarTaller(u, L, dt, 0, null);
    return;
  }
  // piernas
  if (velocidad > 0.1) {
    u.fase += dt * velocidad * 2.4;
    const a = Math.sin(u.fase) * Math.min(0.7, velocidad * 0.16);
    u.piernas[0].rotation.x = a; u.piernas[1].rotation.x = -a * (cojea ? 0.3 : 1);
    u.cuerpo.position.y = Math.abs(Math.cos(u.fase)) * 0.03 - (cojea && Math.sin(u.fase) < 0 ? 0.05 : 0);
  } else {
    for (const p of u.piernas) p.rotation.x *= 0.8;
    u.cuerpo.position.y *= 0.8;
  }
  // paso al frente al golpear y retroceso al recibir
  const t = L.duracion > 0 ? Math.min(1, L.tAccion / L.duracion) : 1;
  let avance = 0, giro = 0, inclina = 0;
  if (L.accion === 'preparando' && L.linea) { giro = GIRO[L.linea][0] * suave(t); avance = -0.08 * suave(t); }
  else if (L.accion === 'golpeando' && L.linea) { giro = GIRO[L.linea][0] + (GIRO[L.linea][1] - GIRO[L.linea][0]) * suave(t); avance = (L.linea === 'estocada' ? 0.45 : 0.28) * Math.sin(t * Math.PI / 2); inclina = 0.12; }
  else if (L.accion === 'recuperando' && L.linea) { giro = GIRO[L.linea][1] * (1 - suave(t)); avance = (L.linea === 'estocada' ? 0.45 : 0.28) * (1 - suave(t)); inclina = 0.12 * (1 - t); }
  u.retroceso = Math.max(0, (u.retroceso || 0) - dt);
  avance -= (u.retroceso || 0) * 1.2;
  if (L.accion === 'aturdido') { inclina = -0.18; giro = Math.sin(L.tAccion * 14) * 0.08; }
  const k = Math.min(1, dt * 18);
  u.cuerpo.position.z += (avance - u.cuerpo.position.z) * k;
  u.cuerpo.rotation.y += (giro - u.cuerpo.rotation.y) * k;
  u.cuerpo.rotation.x += (inclina - u.cuerpo.rotation.x) * k;
  u.cuerpo.rotation.z = 0;
  // arma
  const tipo = L.arma;
  let obj;
  if (tipo === 'espada_larga' || tipo === 'palo' || tipo === 'espada_escudo') {
    const conEscudo = tipo === 'espada_escudo';
    const base = L.modo === 'guardias' ? GUARDIAS_POSE[L.guardia] : conEscudo ? POSE_ESCUDO : POSES.base;
    if (L.accion === 'preparando') obj = mezclar(base, POSES[L.linea].p, suave(t));
    else if (L.accion === 'golpeando') obj = mezclar(POSES[L.linea].p, POSES[L.linea].f, suave(t));
    else if (L.accion === 'recuperando' && L.linea) obj = mezclar(POSES[L.linea].f, base, suave(t));
    else if (L.accion === 'aturdido') obj = { m: V(0.1, 1.55, -0.05), d: V(0.3, 0.9, -0.6) }; // arma desviada hacia atrás
    else if (L.bloqueando) obj = conEscudo ? POSE_ESCUDO_PARANDO : PARADAS[lineaParada || 'estocada'];
    else obj = base;
    const kk = L.accion === 'golpeando' ? 1 : Math.min(1, dt * 16);
    u.pose.m.lerp(obj.m, kk); u.pose.d.lerp(obj.d, kk).normalize();
    u.manos.position.copy(u.pose.m);
    u.manos.quaternion.setFromUnitVectors(V(0, 1, 0), u.pose.d);
    if (conEscudo && u.escudo) {
      // la espada va solo en la derecha; el escudo sube al parar
      const e = L.bloqueando ? ESCUDO_ALTO : ESCUDO_REPOSO;
      const ke = Math.min(1, dt * 14);
      u.escudo.position.lerp(e.p, ke);
      u.escudo.rotation.y += (e.giro - u.escudo.rotation.y) * ke;
      u.escudo.rotation.x += (e.inclina - u.escudo.rotation.x) * ke;
      apuntarBrazo(u.brazos[0], u.escudo.position.clone().add(V(0, 0, -0.04)));
      apuntarBrazo(u.brazos[1], u.pose.m);
      const ejeEscudo = V(0, 1, 0).applyEuler(u.escudo.rotation);
      // la mano izquierda agarra el asa por detrás de las tablas
      const asa = V(0, 0, -0.07).applyEuler(u.escudo.rotation).add(u.escudo.position);
      animarTaller(u, L, dt, velocidad, { d: u.pose.m.clone(), i: asa }, { d: u.pose.d, i: ejeEscudo });
    } else {
      apuntarBrazo(u.brazos[0], u.pose.m.clone().add(V(0.05, 0, 0)));
      apuntarBrazo(u.brazos[1], u.pose.m.clone().add(V(-0.05, 0, 0)));
      // dos manos en el puño: la derecha junto a la cruz y la izquierda junto al pomo (en el palo, más separadas)
      const [sd, si] = tipo === 'palo' ? [0.1, -0.22] : [0.07, -0.07];
      animarTaller(u, L, dt, velocidad, { d: u.pose.m.clone().addScaledVector(u.pose.d, sd), i: u.pose.m.clone().addScaledVector(u.pose.d, si), dosManos: true }, { d: u.pose.d, i: u.pose.d });
    }
  } else if (tipo === 'arco') {
    const tensando = L.accion === 'tensando';
    const manoArco = tensando ? V(0.05, 1.42, 0.6) : V(0.3, 1.0, 0.2);
    u.manos.position.copy(manoArco);
    u.manos.quaternion.setFromEuler(tensando ? new THREE.Euler(0, 0, 0) : new THREE.Euler(0.35, 0, 0.25));
    const cuerda = u.arma && u.arma.getObjectByName('cuerda');
    const tirada = tensando ? L.tension * 0.55 : 0;
    if (cuerda) { const pos = cuerda.geometry.attributes.position; pos.setXYZ(1, 0, 0, -tirada); pos.needsUpdate = true; }
    const manoCuerda = tensando ? V(-0.05, 1.42, 0.6 - tirada) : V(-0.3, 1.0, 0.1);
    apuntarBrazo(u.brazos[0], manoArco);
    apuntarBrazo(u.brazos[1], manoCuerda);
    animarTaller(u, L, dt, velocidad, { i: manoArco.clone(), d: manoCuerda, arma: false }, { i: V(0, 1, 0).applyQuaternion(u.manos.quaternion) });
  } else if (tipo === 'piedras') {
    const tensando = L.accion === 'tensando';
    const m = tensando ? V(-0.3, 1.5 + L.tension * 0.2, -0.25 - L.tension * 0.2) : V(-0.3, 1.0, 0.15);
    u.manos.position.copy(m);
    if (u.arma) u.arma.visible = L.accion !== 'recuperando';
    apuntarBrazo(u.brazos[1], m);
    apuntarBrazo(u.brazos[0], V(0.35, 1.0, 0.15));
    animarTaller(u, L, dt, velocidad, { d: m.clone() }, null);
  }
}

// ---------- Rastro de la hoja ----------
export class Rastro {
  constructor(escena, n = 10) {
    this.n = n; this.puntos = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.alfa = new Float32Array(n * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.malla = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    this.malla.frustumCulled = false;
    escena.add(this.malla);
  }
  actualizar(raiz, activo) {
    const arma = raiz.userData.arma;
    const p = arma && arma.getObjectByName('punta'), m = arma && arma.getObjectByName('medio');
    if (activo && p && m) {
      raiz.updateMatrixWorld(true);
      this.puntos.unshift([p.getWorldPosition(new THREE.Vector3()), m.getWorldPosition(new THREE.Vector3())]);
    } else if (this.puntos.length) this.puntos.pop();
    this.puntos.length = Math.min(this.puntos.length, this.n);
    this.malla.visible = this.puntos.length > 2;
    for (let i = 0; i < this.n; i++) {
      const par = this.puntos[Math.min(i, this.puntos.length - 1)];
      if (!par) continue;
      this.pos.set([par[0].x, par[0].y, par[0].z], i * 6);
      this.pos.set([par[1].x, par[1].y, par[1].z], i * 6 + 3);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------- Partículas: chispas y sangre ----------
export class Particulas {
  constructor(escena, max = 240) {
    this.max = max; this.vivas = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.puntos = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false }));
    this.puntos.frustumCulled = false;
    escena.add(this.puntos);
  }
  emitir(x, y, z, n, color, vel = 3, gravedad = 9.8, vida = 0.45) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.vivas.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1;
      const v = vel * (0.4 + Math.random() * 0.8);
      this.vivas.push({ x, y, z, vx: Math.cos(a) * v * (1 - e * 0.5), vy: e * v, vz: Math.sin(a) * v * (1 - e * 0.5), vida, max: vida, c, g: gravedad });
    }
  }
  actualizar(dt) {
    this.vivas = this.vivas.filter(p => (p.vida -= dt) > 0);
    for (let i = 0; i < this.max; i++) {
      const p = this.vivas[i];
      if (!p) { this.pos[i * 3 + 1] = -100; continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vx *= 0.5; p.vz *= 0.5; p.vy = 0; }
      this.pos.set([p.x, p.y, p.z], i * 3);
      const k = p.vida / p.max;
      this.col.set([p.c.r * (0.4 + 0.6 * k), p.c.g * (0.4 + 0.6 * k), p.c.b * (0.4 + 0.6 * k)], i * 3);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
