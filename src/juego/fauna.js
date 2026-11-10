// Kinhold — las liebres en el navegador (P4, 9 nov): las dibuja donde dice el servidor (src/logica/fauna.js: pastan,
// se ponen alerta y huyen de quien se acerca; todos ven la misma) y les da su animación.
//
// El modelo (estilo v5, por código como el resto del mundo que no es un personaje): una liebre parda de unos 55 cm,
// con sus proporciones de verdad — el cuarto trasero grande, las patas de atrás largas, las orejas largas con la punta
// negra, el vientre y la barbilla claros, la cola blanca por debajo y negra por encima, los ojos grandes a los lados.
// Piezas suaves con su color por vértice, un moteado de pelo (el pardo «canoso» de la liebre) y la oclusión de contacto
// al pie. Antes de hacerlo se buscó uno libre (CC0, 9 nov): lo que sale de liebre o conejo animado es de pago o de
// dibujos (estética infantil, que el juego no quiere); por código encaja con el resto y se anima pieza a pieza.
//
// La animación, por piezas (tronco, cabeza, orejas, patas de delante y de detrás), según lo que hace:
//   pastar — agachada, la cabeza al suelo mordisqueando, las orejas echadas atrás.
//   alerta — sentada erguida sobre las patas de atrás, la cabeza alta, las orejas tiesas (y alguna se mueve).
//   saltar — saltitos cortos y despacio.
//   huir   — a la carrera, estirada, en saltos largos con las orejas pegadas al lomo.
// Entre una y otra, la postura cambia poco a poco. El sitio y el giro siguen a lo que manda el servidor, suavizados.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, material } from '../mundo/estilos.js';
import { pseudo3 } from '../logica/azar.js';

const PARDO = 0x7a6a53, PARDO_CLARO = 0x94805f, VIENTRE = 0xd6cbb8, NEGRO = 0x1d1916, BLANCO = 0xe4dfd4, NARIZ = 0x5a4540, OJO = 0x2e1c0e, BRILLO_OJO = 0x7a5420;
export const VISTA_FAUNA = 160;   // m: más lejos no se dibujan (una liebre es pequeña)

// el moteado del pelo: cada punto, un poco más claro o más oscuro (el pardo canoso de la liebre)
const pelo = (v) => 0.78 + 0.4 * pseudo3(Math.round(v.x * 90), Math.round(v.y * 90), Math.round(v.z * 90));
const bola = (seg = 12) => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
const esc = (x, y, z) => ({ escala: new THREE.Vector3(x, y, z) });
function malla(L) {
  const geos = L.cerrar(null, false);
  const m = new THREE.Mesh(mergeGeometries(geos), material('fijo'));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// una pieza: un Lote cerrado en una malla, dentro de un grupo que hace de articulación en (x, y, z)
function pieza(padre, x, y, z, hacer, suelo = -0.2) {
  const g = new THREE.Group(); g.position.set(x, y, z); padre.add(g);
  const L = new Lote({ variacion: 0.04, rangoSuelo: 0.12, suelo }); hacer(L); g.add(malla(L));
  return g;
}

// El modelo de una liebre: { raiz, tronco, cabeza, orejas: [i, d], delante, detras }. La raíz, en el suelo, mirando a +Z.
export function crearModeloLiebre() {
  const raiz = new THREE.Group();
  const pel = { rayas: pelo };
  // el tronco (articulación a media altura, entre los cuartos): el cuerpo, el cuarto trasero, el pecho, el vientre y la cola
  const tronco = pieza(raiz, 0, 0.2, 0, (L) => {
    L.add(bola(), PARDO, 0, 0.012, -0.01, null, { ...esc(0.088, 0.088, 0.19), ...pel });
    L.add(bola(), PARDO, 0, 0.01, -0.1, null, { ...esc(0.098, 0.1, 0.11), ...pel });            // el cuarto trasero
    L.add(bola(), PARDO_CLARO, 0, -0.005, 0.1, null, { ...esc(0.068, 0.078, 0.085), ...pel });         // el pecho
    L.add(bola(), VIENTRE, 0, -0.045, 0.0, null, { ...esc(0.065, 0.045, 0.15), ...pel });           // el vientre claro
    L.add(bola(8), BLANCO, 0, 0.0, -0.215, null, { ...esc(0.035, 0.035, 0.03), sinSuelo: true });  // la cola, blanca debajo
    L.add(bola(8), NEGRO, 0, 0.025, -0.21, null, { ...esc(0.03, 0.022, 0.028), sinSuelo: true });  // y negra por encima
  }, -0.2);
  // la cabeza (articulación en la nuca)
  const cabeza = pieza(tronco, 0, 0.055, 0.17, (L) => {
    L.add(bola(), PARDO, 0, 0.02, 0.045, null, { ...esc(0.052, 0.058, 0.075), ...pel });
    L.add(bola(), PARDO_CLARO, 0, 0.0, 0.1, null, { ...esc(0.036, 0.037, 0.045), ...pel });       // el hocico
    L.add(bola(8), VIENTRE, 0, -0.025, 0.09, null, { ...esc(0.028, 0.018, 0.04), sinSuelo: true }); // la barbilla clara
    L.add(bola(6), NARIZ, 0, 0.012, 0.142, null, { ...esc(0.012, 0.009, 0.008), sinSuelo: true });  // la nariz
    for (const s of [-1, 1]) {
      L.add(bola(8), OJO, s * 0.04, 0.04, 0.07, null, { ...esc(0.012, 0.014, 0.014), sinSuelo: true, brillo: 1.1 });
      L.add(bola(6), BRILLO_OJO, s * 0.05, 0.041, 0.071, null, { ...esc(0.005, 0.009, 0.009), sinSuelo: true });   // el iris ámbar
    }
  }, -0.2);
  // las orejas (cada una con su articulación en la base): largas, finas, con la punta negra
  const orejas = [-1, 1].map(s => pieza(cabeza, s * 0.022, 0.065, 0.025, (L) => {
    L.add(bola(), PARDO, 0, 0.095, 0, null, { ...esc(0.021, 0.1, 0.011), ...pel });
    L.add(bola(8), VIENTRE, s * -0.002, 0.09, 0.006, null, { ...esc(0.013, 0.08, 0.006), sinSuelo: true });   // el claro de dentro
    L.add(bola(8), NEGRO, 0, 0.185, 0, null, { ...esc(0.016, 0.025, 0.009), sinSuelo: true });               // la punta negra
  }, -0.5));
  orejas.forEach((o, i) => { o.rotation.z = (i ? -1 : 1) * 0.12; });
  // las patas de delante (articulación en el hombro): finas, hasta el suelo
  const delante = pieza(tronco, 0, -0.05, 0.1, (L) => {
    for (const s of [-1, 1]) {
      L.add(new THREE.CylinderGeometry(0.014, 0.012, 0.15, 7), PARDO_CLARO, s * 0.038, -0.075, 0, null, pel);
      L.add(bola(8), VIENTRE, s * 0.038, -0.148, 0.012, null, esc(0.016, 0.01, 0.026));
    }
  }, -0.15);
  // las de detrás (articulación en la cadera): el muslo grande, la caña hacia atrás hasta el talón y el pie largo
  // apoyado hacia delante (como se sienta una liebre: el pie entero en el suelo bajo el cuarto trasero)
  const detras = pieza(tronco, 0, -0.02, -0.11, (L) => {
    for (const s of [-1, 1]) {
      L.add(bola(), PARDO, s * 0.062, -0.035, 0.0, null, { ...esc(0.036, 0.07, 0.07), ...pel });   // el muslo
      L.add(new THREE.CylinderGeometry(0.016, 0.013, 0.1, 7), PARDO, s * 0.064, -0.11, -0.04, { x: -0.6 }, pel);   // la caña
      L.add(bola(8), PARDO_CLARO, s * 0.064, -0.165, 0.0, null, { ...esc(0.021, 0.017, 0.064), ...pel });   // el pie largo
    }
  }, -0.18);
  raiz.traverse(o => { o.userData.liebre = true; });
  return { raiz, tronco, cabeza, orejas, delante, detras };
}

// La postura de cada cosa que hace, en el instante t (s): alto del tronco, su inclinación (+ hocico abajo), la de la
// cabeza, las orejas (respecto al suelo: 0 tiesas, − echadas atrás), las patas y el salto (m).
function postura(anim, t, u) {
  const ciclo = (f) => (t * f + u) % 1, onda = (f) => Math.sin(ciclo(f) * Math.PI * 2);
  if (anim === 'huir') {
    const s = onda(3.6);
    return { alto: 0.19, inclina: 0.05 + s * 0.22, cabeza: -0.05, orejas: -1.45, delante: s * 0.9, detras: -s * 1.0, salto: Math.max(0, s) * 0.17 };
  }
  if (anim === 'saltar') {
    const s = onda(2.2);
    return { alto: 0.18, inclina: 0.1 + s * 0.12, cabeza: 0.1, orejas: -0.6, delante: s * 0.5, detras: -s * 0.6, salto: Math.max(0, s) * 0.07 };
  }
  if (anim === 'alerta') {
    return { alto: 0.2, inclina: -0.5, cabeza: 0.45 + Math.sin(t * 0.7 + u * 6) * 0.08, orejas: 0.1 + Math.sin(t * 2.1 + u * 9) * 0.06, delante: 0.12, detras: -0.1, salto: 0 };
  }
  // pastar: agachada, el hocico en la hierba, mordisqueando
  return { alto: 0.17, inclina: 0.32, cabeza: 0.95 + Math.max(0, Math.sin(t * 9 + u * 5)) * 0.08, orejas: -1.25, delante: 0.05, detras: 0.15, salto: 0 };
}

// La lanza endurecida (1,8 m): el asta de fresno pelada, más gruesa hacia atrás, y la punta tostada al fuego, oscura.
// La raíz en su centro, a lo largo de +Z (la punta hacia +Z). Sirve para la de la mano en el modo arma, la que vuela y
// la del suelo.
const ASTA = 0x9a8262, TOSTADA = 0x3a2c1f, QUEMADA = 0x5e4733;
export function crearModeloLanza() {
  const L = new Lote({ variacion: 0.05, rangoSuelo: 0 });
  const rx = { x: Math.PI / 2 };
  L.add(new THREE.CylinderGeometry(0.014, 0.019, 1.45, 7), ASTA, 0, 0, -0.15, rx, { tex: 'veta', sinSuelo: true });
  L.add(new THREE.CylinderGeometry(0.009, 0.014, 0.22, 7), QUEMADA, 0, 0, 0.68, rx, { tex: 'veta', sinSuelo: true });
  L.add(new THREE.ConeGeometry(0.009, 0.14, 7), TOSTADA, 0, 0, 0.86, rx, { sinSuelo: true });
  const m = malla(L); m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}

// La liebre muerta en el suelo (la cazada, hasta despiezarla): tumbada de lado, las patas estiradas.
export function crearLiebreMuerta() {
  const M = crearModeloLiebre(), g = new THREE.Group();
  M.tronco.position.y = 0; M.tronco.rotation.x = 0.05;
  M.cabeza.rotation.x = -0.25;
  for (const e of M.orejas) e.rotation.x = -1.5;
  M.delante.rotation.x = -0.75; M.detras.rotation.x = 0.55;
  M.raiz.rotation.z = Math.PI / 2; M.raiz.position.y = 0.075;
  M.raiz.traverse(o => { delete o.userData.liebre; });
  g.add(M.raiz);
  return g;
}

// Las liebres de la escena. alturaSuelo(x, z): la del suelo del mundo. Devuelve { recibir(msg), paso(dt, yo), liebres }.
export function crearFauna({ escena, alturaSuelo }) {
  const raiz = new THREE.Group(); raiz.name = 'fauna'; escena.add(raiz);
  const liebres = new Map();   // id → { m, x, z, giro, obj: { x, z, giro }, anim, p (postura actual), u }
  let t = 0;
  const angulo = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  function recibir(msg) {
    if (!msg || msg.tipo !== 'fauna') return false;
    if (globalThis.__mutarFauna) return true;   // (la prueba de navegador, rota a propósito: no se dibuja ninguna)
    for (const f of msg.liebres || []) {
      if (!f || typeof f.id !== 'string' || !Number.isFinite(f.x) || !Number.isFinite(f.z)) continue;
      let l = liebres.get(f.id);
      if (!l) {
        const m = crearModeloLiebre();
        let u = 0; for (const ch of f.id) u = (u * 31 + ch.charCodeAt(0)) % 997;
        l = { m, x: f.x, z: f.z, giro: f.giro || 0, u: u / 997, anim: f.anim, p: postura(f.anim, 0, u / 997) };
        liebres.set(f.id, l); raiz.add(m.raiz);
      }
      l.obj = { x: f.x, z: f.z, giro: f.giro || 0 }; l.anim = f.anim || 'pastar';
    }
    for (const id of msg.fuera || []) { const l = liebres.get(id); if (l) { raiz.remove(l.m.raiz); liebres.delete(id); } }
    return true;
  }
  // al cortarse la conexión: fuera todas (al volver, el servidor las manda otra vez)
  function vaciar() { for (const l of liebres.values()) raiz.remove(l.m.raiz); liebres.clear(); }
  function paso(dt, yo) {
    t += dt;
    const k = Math.min(1, dt * 7), kp = Math.min(1, dt * 6);
    for (const l of liebres.values()) {
      const o = l.obj || l;
      l.x += (o.x - l.x) * k; l.z += (o.z - l.z) * k;
      l.giro += angulo(o.giro - l.giro) * Math.min(1, dt * 9);
      const lejos = yo && Math.hypot(l.x - yo.x, l.z - yo.z) > VISTA_FAUNA;
      l.m.raiz.visible = !lejos;
      if (lejos) continue;
      const q = postura(l.anim, t, l.u);
      for (const c of Object.keys(q)) l.p[c] += (q[c] - l.p[c]) * (c === 'salto' || c === 'delante' || c === 'detras' || c === 'inclina' ? Math.min(1, dt * 18) : kp);
      const P = l.p, M = l.m;
      M.raiz.position.set(l.x, alturaSuelo(l.x, l.z), l.z);
      M.raiz.rotation.y = l.giro;
      M.tronco.position.y = P.alto + P.salto;
      M.tronco.rotation.x = P.inclina;
      M.cabeza.rotation.x = P.cabeza;
      for (const e of M.orejas) e.rotation.x = P.orejas - P.inclina - P.cabeza;
      M.delante.rotation.x = -P.delante - P.inclina * 0.8;   // (las patas siguen buscando el suelo)
      M.detras.rotation.x = -P.detras - P.inclina * 0.8;
    }
  }
  return { recibir, paso, vaciar, liebres, raiz };
}
