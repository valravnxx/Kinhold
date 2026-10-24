// Kinhold — modelos y animación del campo de pruebas de combate (low-poly por código)
import * as THREE from 'three';
import { mat, COLORES } from '../juego/modelos.js';

const PIEL = 0xd6a77a, LINO = 0xd9cfb8, LINO_OSC = 0xbfb498, PELO = 0x4a3324, CORDEL = 0x8a7a55;
const ROPA = { lino: [LINO, LINO_OSC], gambeson: [0xb59a6a, 0x8f7a52], malla: [0x8a8f94, 0x5f6368] };
const SANGRE = 0x8a1410;

function pieza(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------- Armas ----------
function marcador(g, nombre, y) { const o = new THREE.Object3D(); o.name = nombre; o.position.y = y; g.add(o); }
export function modeloArma(tipo) {
  const g = new THREE.Group();
  if (tipo === 'espada_larga') {
    // empuñadura en el origen; la hoja sale hacia +Y
    g.add(pieza(new THREE.CylinderGeometry(0.018, 0.02, 0.3, 6), 0x3a2618, 0, 0.0, 0));       // puño
    g.add(pieza(new THREE.IcosahedronGeometry(0.035, 0), 0x6f6f72, 0, -0.17, 0));             // pomo
    g.add(pieza(new THREE.BoxGeometry(0.26, 0.025, 0.03), 0x6f6f72, 0, 0.16, 0));             // cruz
    const hoja = new THREE.BoxGeometry(0.045, 0.95, 0.008);
    hoja.translate(0, 0.65, 0);
    g.add(pieza(hoja, 0xc9ccd0));
    const punta = new THREE.ConeGeometry(0.026, 0.1, 4);
    punta.translate(0, 1.17, 0);
    const mp = pieza(punta, 0xc9ccd0); mp.scale.z = 0.25; g.add(mp);
    marcador(g, 'punta', 1.2); marcador(g, 'medio', 0.55);
  } else if (tipo === 'espada_escudo') {
    // espada de una mano: más corta y con el puño para una sola mano
    g.add(pieza(new THREE.CylinderGeometry(0.017, 0.019, 0.13, 6), 0x3a2618, 0, 0.0, 0));      // puño
    g.add(pieza(new THREE.IcosahedronGeometry(0.03, 0), 0x6f6f72, 0, -0.085, 0));             // pomo
    g.add(pieza(new THREE.BoxGeometry(0.2, 0.022, 0.028), 0x6f6f72, 0, 0.075, 0));            // cruz
    const hoja = new THREE.BoxGeometry(0.042, 0.72, 0.008);
    hoja.translate(0, 0.45, 0);
    g.add(pieza(hoja, 0xc9ccd0));
    const punta = new THREE.ConeGeometry(0.024, 0.09, 4);
    punta.translate(0, 0.855, 0);
    const mp = pieza(punta, 0xc9ccd0); mp.scale.z = 0.25; g.add(mp);
    marcador(g, 'punta', 0.88); marcador(g, 'medio', 0.4);
  } else if (tipo === 'palo') {
    g.add(pieza(new THREE.CylinderGeometry(0.03, 0.045, 1.4, 6), COLORES.vara, 0, 0.45, 0));
    marcador(g, 'punta', 1.15); marcador(g, 'medio', 0.5);
  } else if (tipo === 'arco') {
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, 0, 0.32), new THREE.Vector3(0, 0.75, 0));
    g.add(pieza(new THREE.TubeGeometry(curva, 12, 0.02, 5), 0x6b4a2a));
    const cuerda = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.75, 0)]);
    const linea = new THREE.Line(cuerda, new THREE.LineBasicMaterial({ color: 0xe8e0c8 }));
    linea.name = 'cuerda';
    g.add(linea);
  } else if (tipo === 'piedras') {
    const p = pieza(new THREE.DodecahedronGeometry(0.06, 0), COLORES.piedra);
    g.add(p);
  }
  g.userData.tipo = tipo;
  return g;
}
// Escudo redondo de tablas con borde de cuero y umbo de hierro. Mira hacia +z; el asa queda en el origen.
export function modeloEscudo(radio = 0.32) {
  const g = new THREE.Group();
  const disco = new THREE.CylinderGeometry(radio, radio, 0.025, 16); disco.rotateX(Math.PI / 2);
  g.add(pieza(disco, 0x7d5f3e, 0, 0, 0.05));
  // juntas entre tablas (líneas verticales algo más oscuras en la cara)
  for (const x of [-0.17, -0.06, 0.06, 0.17]) {
    const alto = 2 * Math.sqrt(radio * radio - x * x) - 0.02;
    g.add(pieza(new THREE.BoxGeometry(0.008, alto, 0.004), 0x5c452c, x, 0, 0.064));
  }
  const borde = new THREE.TorusGeometry(radio, 0.014, 4, 18);
  g.add(pieza(borde, 0x4a3424, 0, 0, 0.05));
  const umbo = new THREE.SphereGeometry(0.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); umbo.rotateX(Math.PI / 2);
  g.add(pieza(umbo, 0x66676a, 0, 0, 0.062));
  g.name = 'escudo';
  return g;
}
export function modeloFlecha() {
  const g = new THREE.Group();
  const asta = new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5); asta.rotateX(Math.PI / 2);
  g.add(pieza(asta, 0x9b7a50));
  const punta = new THREE.ConeGeometry(0.018, 0.06, 4); punta.rotateX(Math.PI / 2); punta.translate(0, 0, 0.4);
  g.add(pieza(punta, 0x5a5a5e));
  for (const a of [0, 2.1, 4.2]) {
    const pl = pieza(new THREE.BoxGeometry(0.003, 0.04, 0.1), 0xe8e0c8, Math.cos(a) * 0.012, Math.sin(a) * 0.012, -0.32);
    pl.rotation.z = a; g.add(pl);
  }
  return g;
}
export function modeloPiedra() { return pieza(new THREE.DodecahedronGeometry(0.06, 0), COLORES.piedra); }

// ---------- Poste de práctica y diana ----------
export function modeloPoste() {
  const g = new THREE.Group();
  g.add(pieza(new THREE.CylinderGeometry(0.14, 0.17, 1.9, 7), COLORES.tronco, 0, 0.95, 0));
  g.add(pieza(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 7), 0xb79a62, 0, 1.45, 0));
  g.add(pieza(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 7), 0xb79a62, 0, 0.7, 0));
  return g;
}
export function modeloDiana(radio = 0.6) {
  const g = new THREE.Group();
  const colores = [0xe8dcc0, 0x2a2a2a, 0x3b6db0, 0xc0392b, 0xe0b23a];
  for (let n = 0; n < 5; n++) {
    const r = radio * (1 - n * 0.2);
    const disco = new THREE.CylinderGeometry(r, r, 0.12 + n * 0.005, 20); disco.rotateX(Math.PI / 2);
    g.add(pieza(disco, colores[n], 0, 0, n * 0.004));
  }
  for (const x of [-0.35, 0.35]) {
    const pata = pieza(new THREE.BoxGeometry(0.06, 1.6, 0.06), COLORES.troncoOscuro, x, -0.55, -0.15);
    pata.rotation.x = -0.15; g.add(pata);
  }
  return g;
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
export function crearCombatiente({ armadura = 'lino', colorCinta = 0xc0392b } = {}) {
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
  const manos = new THREE.Group(); cuerpo.add(manos);
  raiz.userData = { cuerpo, piernas, brazos, zonas, manos, arma: null, fase: 0, heridasPintadas: 0, pose: { m: POSES.base.m.clone(), d: POSES.base.d.clone() } };
  return raiz;
}
export function ponerArma(raiz, tipo) {
  const u = raiz.userData;
  if (u.arma) u.manos.remove(u.arma);
  u.arma = modeloArma(tipo);
  u.manos.add(u.arma);
  if (u.escudo) { u.cuerpo.remove(u.escudo); u.escudo = null; }
  if (tipo === 'espada_escudo') {
    u.escudo = modeloEscudo();
    u.escudo.position.copy(ESCUDO_REPOSO.p); u.escudo.rotation.y = ESCUDO_REPOSO.giro;
    u.cuerpo.add(u.escudo);
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
  for (let n = u.heridasPintadas; n < heridas.length; n++) {
    const h = heridas[n];
    const [tam] = COLOR_GRAVEDAD[h.gravedad];
    const zona = u.zonas[h.zona];
    const m = pieza(new THREE.BoxGeometry(tam, tam * 1.3, 0.02), h.tipo === 'contundente' ? 0x5b3a5e : SANGRE);
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
    } else {
      apuntarBrazo(u.brazos[0], u.pose.m.clone().add(V(0.05, 0, 0)));
      apuntarBrazo(u.brazos[1], u.pose.m.clone().add(V(-0.05, 0, 0)));
    }
  } else if (tipo === 'arco') {
    const tensando = L.accion === 'tensando';
    const manoArco = tensando ? V(0.05, 1.42, 0.6) : V(0.3, 1.0, 0.2);
    u.manos.position.copy(manoArco);
    u.manos.quaternion.setFromEuler(tensando ? new THREE.Euler(0, 0, 0) : new THREE.Euler(0.35, 0, 0.25));
    const cuerda = u.arma && u.arma.getObjectByName('cuerda');
    const tirada = tensando ? L.tension * 0.55 : 0;
    if (cuerda) { const pos = cuerda.geometry.attributes.position; pos.setXYZ(1, 0, 0, -tirada); pos.needsUpdate = true; }
    apuntarBrazo(u.brazos[0], manoArco);
    apuntarBrazo(u.brazos[1], tensando ? V(-0.05, 1.42, 0.6 - tirada) : V(-0.3, 1.0, 0.1));
  } else if (tipo === 'piedras') {
    const tensando = L.accion === 'tensando';
    const m = tensando ? V(-0.3, 1.5 + L.tension * 0.2, -0.25 - L.tension * 0.2) : V(-0.3, 1.0, 0.15);
    u.manos.position.copy(m);
    if (u.arma) u.arma.visible = L.accion !== 'recuperando';
    apuntarBrazo(u.brazos[1], m);
    apuntarBrazo(u.brazos[0], V(0.35, 1.0, 0.15));
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
