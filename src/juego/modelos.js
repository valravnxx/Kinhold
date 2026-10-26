// Kinhold — modelos low-poly generados por código.
// Todos los modelos se definen con parámetros (P) para poder ajustarlos sin rehacerlos.
// Las piezas ya pasadas al estilo elegido (v5, «realismo en miniatura») se hacen como la cabaña de la prueba de estilo:
// formas redondeadas, color con oclusión horneado en los vértices y texturas por código (src/mundo/estilos.js),
// todo junto en una malla por textura. Las que aún no se han pasado siguen con colores planos.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODULO, ALTURA } from '../logica/piezas.js';
import { Lote, materialTex, material as materialEstilo } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';

export const P = {
  radioTronco: 0.14,      // grosor de los troncos de muro (de canto)
  hiladas: 10,            // troncos por planta: cada hilada mide ALTURA/10 = 0,25 m
  ladosTronco: 7,
  grosorTabla: 0.07,
  anchoPuerta: 1.0, altoPuerta: 2.0,
  anchoVentana: 0.8, bajoVentana: 1.0, altoVentana: 1.75,
  subidaTejado: 1.2,      // lo que sube un tramo de tejado de 2 m
  voladizo: 0.25,
  altoEmpalizada: 3.0,
  superficieCimiento: 0.12,
  superficieSuelo: 0.12,
};

export const COLORES = {
  tronco: 0x7a5a3a, troncoOscuro: 0x5e4329, corte: 0xc9a46c,
  tabla: 0xa47b4f, tablaOscura: 0x8a6440,
  piedra: 0x8d8a82, piedraOscura: 0x6f6c66,
  barro: 0x9b7b55, paja: 0xcfae5f, pajaOscura: 0xb08f45,
  vara: 0x6d5636, hierro: 0x46474a, tela: 0x8f2f2a, lino: 0xd9cfb8,
  piel: 0x8a6a4a, llama: 0xffb347,
  hierba: 0x6f8f4a, tierra: 0x7b6a4c,
};

const cacheMat = new Map();
export function mat(color, opciones = {}) {
  const k = color + JSON.stringify(opciones);
  if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opciones }));
  return cacheMat.get(k);
}

function malla(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function caja(w, h, d, color, x, y, z) { return malla(new THREE.BoxGeometry(w, h, d), color, x, y, z); }
function cilindroX(r, largo, color, x, y, z, lados = P.ladosTronco) {
  const g = new THREE.CylinderGeometry(r, r, largo, lados);
  g.rotateZ(Math.PI / 2);
  return malla(g, color, x, y, z);
}
function cilindroY(r, alto, color, x, y, z, lados = P.ladosTronco, rArriba = r) {
  const g = new THREE.CylinderGeometry(rArriba, r, alto, lados);
  return malla(g, color, x, y + alto / 2, z);
}
function piedra(r, color, x, y, z, semilla) {
  const g = new THREE.DodecahedronGeometry(r, 0);
  const m = malla(g, color, x, y, z);
  m.rotation.set(semilla * 1.3, semilla * 2.1, semilla * 0.7);
  m.scale.set(1, 0.7, 1);
  return m;
}
// pseudoaleatorio estable
function ruido(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }

// ---------- Estilo v5: piezas hechas con un Lote (src/mundo/estilos.js) ----------
const hayDocumento = typeof document !== 'undefined'; // las pruebas de lógica cargan los modelos en node, sin texturas
const cajaR = (w, h, d, radio = 0.02) => new RoundedBoxGeometry(w, h, d, 1, Math.min(radio, w / 2.05, h / 2.05, d / 2.05));
// junta lo del lote en una malla por textura (madera, corte, piedra…), como la escena de la prueba de estilo
function deLote(L) {
  const g = new THREE.Group();
  if (L.hiladas) g.userData.hiladas = [...L.hiladas];
  for (const [tipo, geos] of Object.entries(L.cerrar(null, true))) {
    const m = new THREE.Mesh(mergeGeometries(geos), hayDocumento ? materialTex(tipo) : materialEstilo('fijo'));
    m.castShadow = m.receiveShadow = true; m.name = 'estilo_' + tipo;
    g.add(m);
  }
  return g;
}
const loteMuro = () => new Lote({ variacion: 0.06, rangoSuelo: 0.5 });
// Tronco tumbado a lo largo de X, de x0 a x1, con las testas (cortes claros) a la vista. Un poco más grueso por un
// extremo, como los de verdad: así, donde dos muros seguidos se solapan, las superficies no coinciden (no parpadean).
// alto: lo que ocupa en vertical (el tronco se aplasta un poco para que las hiladas encajen justas).
function troncoX(L, x0, x1, y, z, color, alto = 2 * P.radioTronco) {
  const r = P.radioTronco, largo = x1 - x0, k = alto / (2 * r * 1.03);
  (L.hiladas ??= new Set()).add(y.toFixed(3)); // para la prueba de que las hiladas coinciden entre muros
  const esc = new THREE.Vector3(k, 1, 1);
  L.add(cil(r * 0.97, r * 1.03, largo, 9, true), color, (x0 + x1) / 2, y, z, { z: Math.PI / 2 }, { escala: esc });
  for (const s of [-1, 1]) {
    const rr = s < 0 ? r * 0.97 : r * 1.03;
    const tapa = new THREE.ConeGeometry(rr, rr * 0.22, 9, 1, true); tapa.translate(0, rr * 0.11, 0);
    L.add(tapa, 'corte', s < 0 ? x0 : x1, y, z, { z: -s * Math.PI / 2 }, { escala: esc, sinSuelo: true });
  }
}
// Muros (a lo largo de X, de -1 a 1, altura 0..ALTURA). Hiladas exactas: cada tronco ocupa una hilada entera,
// así todos los muros terminan a la misma altura y las hiladas coinciden entre muros vecinos.
const HILADA = ALTURA / P.hiladas, SALE = 0.15; // lo que asoma cada tronco por los extremos del muro (se ve la testa)
const TESTA = P.radioTronco * 1.03 * 0.22;      // lo que abomba la testa: los troncos que dan a un hueco acaban antes
function troncosHorizontales(L, desde, hasta, y0, y1) {
  const n = Math.max(1, Math.round((y1 - y0) / HILADA));
  const paso = (y1 - y0) / n;
  for (let t = 0; t < n; t++) {
    const yHilada = Math.round((y0 + paso * t) / HILADA);
    const color = ruido(yHilada * 7 + 3) > 0.5 ? 'madera' : 'maderaOsc';
    troncoX(L, desde, hasta, y0 + paso * (t + 0.5), 0, color, paso);
  }
}
function muroTroncos(opc = {}) {
  const L = loteMuro();
  const S = MODULO, H = ALTURA, m = S / 2 + SALE;
  if (opc.puerta) {
    const a = P.anchoPuerta / 2;
    troncosHorizontales(L, -m, -a - TESTA, 0, P.altoPuerta);
    troncosHorizontales(L, a + TESTA, m, 0, P.altoPuerta);
    troncosHorizontales(L, -m, m, P.altoPuerta, H);
    for (const s of [-1, 1]) L.add(cajaR(0.12, P.altoPuerta, 0.3, 0.025), 'maderaOsc', s * (a + 0.06), P.altoPuerta / 2, 0); // jambas
    L.add(cajaR(P.anchoPuerta + 0.3, 0.14, 0.3, 0.03), 'maderaOsc', 0, P.altoPuerta + 0.07, 0); // dintel
  } else if (opc.ventana) {
    const a = P.anchoVentana / 2;
    troncosHorizontales(L, -m, m, 0, P.bajoVentana);
    troncosHorizontales(L, -m, -a - TESTA, P.bajoVentana, P.altoVentana);
    troncosHorizontales(L, a + TESTA, m, P.bajoVentana, P.altoVentana);
    troncosHorizontales(L, -m, m, P.altoVentana, H);
    const alto = P.altoVentana - P.bajoVentana;
    for (const s of [-1, 1]) L.add(cajaR(0.09, alto, 0.32, 0.02), 'maderaOsc', s * (a + 0.045), P.bajoVentana + alto / 2, 0); // marco
    L.add(cajaR(P.anchoVentana + 0.24, 0.08, 0.36, 0.02), 'maderaOsc', 0, P.bajoVentana - 0.01, 0); // alféizar
    L.add(cajaR(P.anchoVentana + 0.24, 0.08, 0.32, 0.02), 'maderaOsc', 0, P.altoVentana + 0.04, 0);
  } else {
    troncosHorizontales(L, -m, m, 0, opc.alto || H);
  }
  return deLote(L);
}
// Zarzo y barro: varas entretejidas entre estacas, tapadas con barro (las estacas asoman)
function muroZarzo() {
  const L = loteMuro();
  const BARRO = 0x8c7356;
  L.add(cajaR(MODULO, ALTURA, 0.16, 0.05), BARRO, 0, ALTURA / 2, 0, null, { tex: 'piedra', rayas: (v) => 0.94 + 0.06 * Math.sin(v.x * 3.1 + v.y * 2.3) });
  for (const x of [-0.93, 0, 0.93]) L.add(cil(0.085, 0.095, ALTURA - 0.12, 8), 'corteza', x, ALTURA / 2, 0); // estacas, asoman del barro
  for (const s of [-1, 1]) L.add(cajaR(MODULO, 0.12, 0.2, 0.03), 'maderaOsc', 0, s > 0 ? ALTURA - 0.06 : 0.06, 0); // durmiente y carrera
  return deLote(L);
}
// Entramado: armazón de vigas con relleno de barro encalado
function muroEntramado() {
  const L = loteMuro();
  L.add(cajaR(MODULO - 0.1, ALTURA - 0.1, 0.13, 0.02), 0xd3c6a6, 0, ALTURA / 2, 0, null, { tex: 'piedra', brillo: 1.02 });
  const c = 'maderaOsc';
  for (const s of [-1, 1]) L.add(cajaR(0.18, ALTURA, 0.2, 0.03), c, s * 0.91, ALTURA / 2, 0);
  L.add(cajaR(MODULO, 0.18, 0.2, 0.03), c, 0, 0.09, 0);
  L.add(cajaR(MODULO, 0.18, 0.2, 0.03), c, 0, ALTURA - 0.09, 0);
  L.add(cajaR(MODULO - 0.3, 0.14, 0.19, 0.03), c, 0, 1.25, 0); // riostra a media altura
  const largo = Math.hypot(1.64, ALTURA - 0.36);
  L.add(cajaR(0.14, largo, 0.19, 0.03), c, 0, ALTURA / 2, 0, { z: Math.atan2(1.64, ALTURA - 0.36) });
  return deLote(L);
}
// Tablas de pie, con durmiente abajo y carrera arriba
function muroTablas(opc = {}) {
  const L = loteMuro();
  const n = 8, w = MODULO / n;
  for (let t = 0; t < n; t++) {
    const x = -MODULO / 2 + w / 2 + t * w;
    const color = ruido(t * 3.7 + 1) > 0.5 ? 'tabla' : 'madera';
    if (opc.puerta && Math.abs(x) < P.anchoPuerta / 2) {
      const h = ALTURA - P.altoPuerta;
      L.add(cajaR(w * 0.95, h, P.grosorTabla, 0.012), color, x, P.altoPuerta + h / 2, 0);
    } else L.add(cajaR(w * 0.95, ALTURA, P.grosorTabla, 0.012), color, x, ALTURA / 2, 0);
  }
  const c = 'maderaOsc';
  if (opc.puerta) {
    // durmiente a los dos lados del hueco, nunca cruzándolo, y jambas
    const a = P.anchoPuerta / 2, lado = (MODULO / 2 - a);
    for (const s of [-1, 1]) {
      L.add(cajaR(lado, 0.12, 0.14, 0.02), c, s * (a + lado / 2), 0.06, 0);
      L.add(cajaR(0.1, P.altoPuerta, 0.14, 0.02), c, s * (a + 0.05), P.altoPuerta / 2, 0);
    }
  } else L.add(cajaR(MODULO, 0.12, 0.14, 0.02), c, 0, 0.06, 0);
  L.add(cajaR(MODULO, 0.12, 0.14, 0.02), c, 0, ALTURA - 0.06, 0);
  return deLote(L);
}
function medioMuro() {
  const L = loteMuro();
  troncosHorizontales(L, -MODULO / 2 - SALE, MODULO / 2 + SALE, 0, ALTURA / 2);
  return deLote(L);
}
function cerca() {
  const g = new THREE.Group();
  for (const x of [-0.95, 0, 0.95]) g.add(cilindroY(0.06, 1.1, COLORES.vara, x, 0, 0, 5));
  g.add(cilindroX(0.04, MODULO, COLORES.vara, 0, 0.45, 0, 5));
  g.add(cilindroX(0.04, MODULO, COLORES.vara, 0, 0.9, 0, 5));
  return g;
}
function empalizada(opc = {}) {
  const g = new THREE.Group();
  if (opc.porton) {
    const hoja = new THREE.Group();
    for (let t = 0; t < 7; t++) {
      const x = 0.14 + t * 0.27;
      hoja.add(caja(0.25, 2.6, 0.12, t % 2 ? COLORES.tabla : COLORES.tablaOscura, x, 1.3, 0));
    }
    for (const y of [0.5, 1.4, 2.3]) hoja.add(caja(1.9, 0.08, 0.15, COLORES.hierro, 1.0, y, 0.04));
    hoja.position.x = -MODULO / 2;
    hoja.name = 'hoja';
    g.add(hoja);
    g.add(cilindroY(0.16, P.altoEmpalizada, COLORES.troncoOscuro, -MODULO / 2, 0, 0));
    g.add(cilindroY(0.16, P.altoEmpalizada, COLORES.troncoOscuro, MODULO / 2, 0, 0));
    return g;
  }
  const n = 7;
  for (let t = 0; t < n; t++) {
    const x = -MODULO / 2 + (t + 0.5) * (MODULO / n);
    const alto = P.altoEmpalizada - 0.15 + ruido(t + 3) * 0.3;
    g.add(cilindroY(0.15, alto, t % 2 ? COLORES.tronco : COLORES.troncoOscuro, x, 0, 0));
    const punta = new THREE.ConeGeometry(0.15, 0.4, P.ladosTronco);
    g.add(malla(punta, COLORES.corte, x, alto + 0.2, 0));
  }
  g.add(cilindroX(0.06, MODULO, COLORES.vara, 0, 1.0, -0.17, 5));
  g.add(cilindroX(0.06, MODULO, COLORES.vara, 0, 2.2, -0.17, 5));
  return g;
}

// ---------- Suelos y cimientos (centrados en la casilla) ----------
function cimientoPiedra() {
  const g = new THREE.Group();
  g.add(caja(MODULO, 0.3, MODULO, COLORES.piedraOscura, 0, P.superficieCimiento - 0.15, 0));
  let s = 1;
  for (let a = -0.75; a <= 0.76; a += 0.5) for (let b = -0.75; b <= 0.76; b += 0.5) {
    const pz = piedra(0.21 + ruido(s) * 0.04, ruido(s + 9) > 0.5 ? COLORES.piedra : COLORES.piedraOscura, a, P.superficieCimiento - 0.07, b, s);
    pz.scale.set(1.15, 0.35, 1.15);
    g.add(pz);
    s++;
  }
  return g;
}
function cimientoTroncos() {
  const g = new THREE.Group();
  for (let t = 0; t < 6; t++) {
    const z = -MODULO / 2 + 0.17 + t * 0.333;
    const c = cilindroX(0.17, MODULO, t % 2 ? COLORES.tronco : COLORES.troncoOscuro, 0, P.superficieCimiento - 0.17, z);
    g.add(c);
  }
  return g;
}
function sueloTroncos() {
  const g = new THREE.Group();
  for (let t = 0; t < 7; t++) {
    const z = -MODULO / 2 + 0.143 + t * 0.286;
    const c = cilindroX(0.14, MODULO, t % 2 ? COLORES.tronco : COLORES.troncoOscuro, 0, P.superficieSuelo - 0.07, z);
    c.scale.set(1, 0.5, 1);
    g.add(c);
  }
  return g;
}
function sueloTablas() {
  const g = new THREE.Group();
  const n = 8, w = MODULO / n;
  for (let t = 0; t < n; t++) {
    g.add(caja(MODULO, 0.06, w * 0.95, t % 2 ? COLORES.tabla : COLORES.tablaOscura, 0, P.superficieSuelo - 0.03, -MODULO / 2 + w / 2 + t * w));
  }
  g.add(caja(MODULO, 0.12, 0.16, COLORES.troncoOscuro, 0, P.superficieSuelo - 0.12, 0));
  return g;
}

// ---------- Estructura ----------
function poste() {
  const L = loteMuro();
  L.add(cil(0.13, 0.15, ALTURA - 0.01, 10), 'corteza', 0, (ALTURA - 0.01) / 2, 0);
  L.add(new THREE.CircleGeometry(0.13, 10), 'corte', 0, ALTURA - 0.01, 0, { x: -Math.PI / 2 }, { sinSuelo: true });
  return deLote(L);
}
function viga() {
  const L = loteMuro();
  L.add(cajaR(MODULO + 0.1, 0.22, 0.22, 0.035), 'maderaOsc', 0, ALTURA - 0.11, 0);
  return deLote(L);
}

// ---------- Tejados ----------
// Tramo que sube hacia +z: alero en z=-1 (y=0) y cumbrera en z=+1 (y=subida)
function tejado(color, color2) {
  const g = new THREE.Group();
  const S = MODULO, sub = P.subidaTejado;
  const largo = Math.hypot(S, sub) + P.voladizo;
  const ang = Math.atan2(sub, S);
  const capa = new THREE.Group();
  capa.add(caja(S + 0.2, 0.16, largo, color, 0, 0, 0));
  for (let t = -0.4; t <= 0.41; t += 0.4) capa.add(caja(S + 0.22, 0.05, 0.08, color2, 0, 0.09, t * largo));
  capa.rotation.x = -ang;
  capa.position.set(0, sub / 2 + 0.05, -P.voladizo / 2 * Math.cos(ang) + 0.0);
  g.add(capa);
  return g;
}
function hastial() {
  const g = new THREE.Group();
  const S = MODULO, sub = P.subidaTejado;
  const forma = new THREE.Shape();
  forma.moveTo(-S / 2, 0); forma.lineTo(S / 2, 0); forma.lineTo(S / 2, sub); forma.closePath();
  const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.2, bevelEnabled: false });
  geo.translate(0, 0, -0.1);
  g.add(malla(geo, COLORES.tronco));
  return g;
}

// ---------- Acceso ----------
function escaleraMano() {
  const g = new THREE.Group();
  const largo = ALTURA + 0.6, ang = 0.32;
  const esc = new THREE.Group();
  esc.add(cilindroY(0.04, largo, COLORES.vara, -0.25, 0, 0, 5));
  esc.add(cilindroY(0.04, largo, COLORES.vara, 0.25, 0, 0, 5));
  for (let y = 0.3; y < largo; y += 0.32) esc.add(cilindroX(0.03, 0.5, COLORES.vara, 0, y, 0, 5));
  esc.rotation.x = -ang;
  esc.position.z = MODULO / 2 - 0.15 - Math.sin(ang) * largo;
  g.add(esc);
  return g;
}
// Escalera de tablas: sube hacia +z local desde el borde -z de la casilla hasta el suelo de la planta de arriba.
function escaleraTablas() {
  const g = new THREE.Group();
  const S = MODULO, y0 = P.superficieSuelo, y1 = ALTURA + P.superficieSuelo;
  const ancho = 1.1, peldanos = 10, sube = (y1 - y0) / peldanos, huella = S / peldanos;
  const largo = Math.hypot(S, y1 - y0), ang = Math.atan2(y1 - y0, S);
  // zancas: dos tablas gruesas en diagonal a los lados
  for (const x of [-ancho / 2, ancho / 2]) {
    const z = caja(0.06, 0.26, largo + 0.1, COLORES.tablaOscura, x, (y0 + y1) / 2 - 0.08, 0);
    z.rotation.x = -ang;
    g.add(z);
  }
  // peldaños de tabla, alternando un poco el tono
  for (let n = 0; n < peldanos; n++) {
    const y = y0 + sube * (n + 1) - 0.03, zc = -S / 2 + huella * (n + 0.5);
    g.add(caja(ancho - 0.04, 0.05, huella + 0.04, n % 2 ? COLORES.tabla : 0x9a7248, 0, y, zc));
  }
  // pie: un taco bajo el arranque para que no flote sobre la tierra
  g.add(caja(ancho + 0.06, y0 + 0.02, 0.12, COLORES.tablaOscura, 0, (y0 + 0.02) / 2, -S / 2 + 0.06));
  return g;
}
function puerta(tipo) {
  const g = new THREE.Group();
  const hoja = new THREE.Group();
  const w = P.anchoPuerta, h = P.altoPuerta - 0.05;
  if (tipo === 'puerta_varas') {
    for (let x = 0.06; x < w; x += 0.13) hoja.add(cilindroY(0.04, h, COLORES.vara, x, 0, 0, 5));
    hoja.add(cilindroX(0.03, w, COLORES.vara, w / 2, 0.4, 0.04, 5));
    hoja.add(cilindroX(0.03, w, COLORES.vara, w / 2, 1.6, 0.04, 5));
  } else {
    for (let t = 0; t < 4; t++) hoja.add(caja(w / 4 * 0.96, h, 0.06, t % 2 ? COLORES.tabla : COLORES.tablaOscura, w / 8 + t * w / 4, h / 2, 0));
    for (const y of [0.4, 1.6]) hoja.add(caja(w * 0.9, 0.06, 0.04, COLORES.hierro, w / 2, y, 0.05));
  }
  hoja.position.x = -w / 2;
  hoja.name = 'hoja';
  g.add(hoja);
  return g;
}

// ---------- Mojón ----------
export function mojon() {
  const g = new THREE.Group();
  g.add(piedra(0.32, COLORES.piedra, 0, 0.2, 0, 1));
  g.add(piedra(0.25, COLORES.piedraOscura, 0.05, 0.55, 0, 2));
  g.add(piedra(0.18, COLORES.piedra, -0.02, 0.82, 0.03, 3));
  g.add(cilindroY(0.04, 1.6, COLORES.vara, 0.3, 0, 0.1, 5));
  g.add(caja(0.35, 0.25, 0.02, COLORES.tela, 0.48, 1.4, 0.1));
  return g;
}

// ---------- Decoración ----------
export function decoracion(tipo) {
  const g = new THREE.Group();
  switch (tipo) {
    case 'cama_paja':
      g.add(caja(1.0, 0.22, 2.0, COLORES.paja, 0, 0.11, 0));
      g.add(caja(0.95, 0.06, 1.2, COLORES.piel, 0, 0.25, 0.3));
      break;
    case 'cama_madera':
      g.add(caja(1.1, 0.3, 2.1, COLORES.tablaOscura, 0, 0.25, 0));
      g.add(caja(1.0, 0.15, 1.95, COLORES.paja, 0, 0.47, 0));
      g.add(caja(0.95, 0.06, 1.2, COLORES.lino, 0, 0.56, 0.3));
      g.add(caja(1.1, 0.6, 0.08, COLORES.tablaOscura, 0, 0.4, -1.05));
      for (const [x, z] of [[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]]) g.add(caja(0.08, 0.3, 0.08, COLORES.troncoOscuro, x, 0.15, z));
      break;
    case 'mesa':
      g.add(caja(1.4, 0.07, 0.8, COLORES.tabla, 0, 0.75, 0));
      for (const [x, z] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) g.add(caja(0.08, 0.72, 0.08, COLORES.tablaOscura, x, 0.36, z));
      break;
    case 'banco':
      g.add(caja(1.2, 0.06, 0.3, COLORES.tabla, 0, 0.45, 0));
      g.add(caja(0.06, 0.42, 0.26, COLORES.tablaOscura, -0.5, 0.21, 0));
      g.add(caja(0.06, 0.42, 0.26, COLORES.tablaOscura, 0.5, 0.21, 0));
      break;
    case 'taburete':
      g.add(cilindroY(0.2, 0.45, COLORES.tronco, 0, 0, 0, 7));
      g.add(cilindroY(0.2, 0.02, COLORES.corte, 0, 0.45, 0, 7));
      break;
    case 'arcon':
      g.add(caja(1.0, 0.5, 0.55, COLORES.tablaOscura, 0, 0.25, 0));
      g.add(caja(1.02, 0.08, 0.57, COLORES.tabla, 0, 0.54, 0));
      for (const x of [-0.35, 0.35]) g.add(caja(0.05, 0.6, 0.58, COLORES.hierro, x, 0.3, 0));
      break;
    case 'barril':
      g.add(cilindroY(0.3, 0.8, COLORES.tabla, 0, 0, 0, 10, 0.28));
      for (const y of [0.12, 0.66]) g.add(cilindroY(0.31, 0.04, COLORES.hierro, 0, y, 0, 10));
      break;
    case 'estanteria':
      for (const x of [-0.48, 0.48]) g.add(caja(0.05, 1.8, 0.35, COLORES.tablaOscura, x, 0.9, 0));
      for (const y of [0.1, 0.65, 1.2, 1.75]) g.add(caja(1.0, 0.04, 0.35, COLORES.tabla, 0, y, 0));
      g.add(caja(0.25, 0.25, 0.2, COLORES.barro, -0.2, 0.8, 0));
      g.add(cilindroY(0.1, 0.25, COLORES.barro, 0.2, 1.22, 0, 7));
      break;
    case 'candil': {
      g.add(cilindroY(0.04, 1.4, COLORES.vara, 0, 0, 0, 5));
      g.add(cilindroY(0.12, 0.12, COLORES.hierro, 0, 1.4, 0, 6, 0.16));
      const llama = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), mat(COLORES.llama, { emissive: COLORES.llama, emissiveIntensity: 1 }));
      llama.position.y = 1.66;
      g.add(llama);
      break;
    }
    case 'alfombra':
      g.add(caja(1.4, 0.02, 1.0, COLORES.piel, 0, 0.01, 0));
      g.add(caja(1.2, 0.025, 0.8, 0x7a5a3e, 0, 0.012, 0));
      break;
    case 'estandarte':
      g.add(cilindroY(0.04, 2.6, COLORES.vara, 0, 0, 0, 5));
      g.add(cilindroX(0.03, 0.8, COLORES.vara, 0, 2.5, 0.0, 5));
      g.add(caja(0.7, 1.0, 0.02, COLORES.tela, 0, 1.95, 0.03));
      g.add(caja(0.2, 0.5, 0.025, 0xd9b44a, 0, 1.95, 0.04));
      break;
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- Fábrica de piezas ----------
export function modeloPieza(tipo) {
  switch (tipo) {
    case 'cim_piedra': return cimientoPiedra();
    case 'cim_tronco': return cimientoTroncos();
    case 'suelo_tronco': return sueloTroncos();
    case 'suelo_tabla': return sueloTablas();
    case 'poste': return poste();
    case 'viga': return viga();
    case 'muro_zarzo': return muroZarzo();
    case 'muro_tronco': return muroTroncos();
    case 'muro_tronco_puerta': return muroTroncos({ puerta: true });
    case 'muro_tronco_ventana': return muroTroncos({ ventana: true });
    case 'muro_entramado': return muroEntramado();
    case 'muro_tabla': return muroTablas();
    case 'muro_tabla_puerta': return muroTablas({ puerta: true });
    case 'medio_muro': return medioMuro();
    case 'tejado_paja': return tejado(COLORES.paja, COLORES.pajaOscura);
    case 'tejado_tablilla': return tejado(COLORES.tablaOscura, COLORES.tabla);
    case 'hastial': return hastial();
    case 'escalera_mano': return escaleraMano();
    case 'escalera_tabla': return escaleraTablas();
    case 'puerta_varas': return puerta('puerta_varas');
    case 'puerta_tabla': return puerta('puerta_tabla');
    case 'cerca': return cerca();
    case 'empalizada': return empalizada();
    case 'empalizada_puerta': return empalizada({ porton: true });
  }
  return new THREE.Group();
}

// ---------- Entorno ----------
export function arbol(semilla) {
  const g = new THREE.Group();
  const alto = 2.5 + ruido(semilla) * 2;
  g.add(cilindroY(0.18, alto * 0.45, COLORES.troncoOscuro, 0, 0, 0, 6, 0.12));
  const verde = ruido(semilla + 4) > 0.5 ? 0x4f6e3a : 0x5d7d3f;
  for (let n = 0; n < 3; n++) {
    const r = (1.3 - n * 0.32) * (0.9 + ruido(semilla + n) * 0.3);
    const cono = new THREE.ConeGeometry(r, alto * 0.38, 7);
    g.add(malla(cono, verde, 0, alto * 0.42 + n * alto * 0.2, 0));
  }
  return g;
}
export function roca(semilla) {
  const g = new THREE.Group();
  g.add(piedra(0.4 + ruido(semilla) * 0.5, COLORES.piedraOscura, 0, 0.15, 0, semilla));
  return g;
}

// ---------- Rellenos de muro bajo el tejado ----------
// En el marco local del tramo de tejado (sube hacia +z; lados en x = ±1; borde alto en z = +1).
// y = 0 es lo alto de la planta de los muros. 'arranque' en tramos.
const COLOR_MURO = {
  muro_zarzo: COLORES.barro, muro_entramado: 0xd8c9a8,
  muro_tabla: COLORES.tabla, muro_tabla_puerta: COLORES.tabla,
};
export function rellenoTejado(rel, arranque) {
  const S = MODULO / 2, sub = P.subidaTejado, grosor = 0.2;
  const color = COLOR_MURO[rel.muro] || COLORES.tronco;
  const forma = new THREE.Shape();
  let geo;
  if (rel.tipo === 'lado') {
    // trapecio en el plano x = ±1, en coordenadas (-z, y) por el giro posterior
    forma.moveTo(S, 0); forma.lineTo(-S, 0); forma.lineTo(-S, rel.hAlto * sub); forma.lineTo(S, rel.hBajo * sub); forma.closePath();
    geo = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: false });
    geo.translate(0, 0, -grosor / 2);
    geo.rotateY(Math.PI / 2);
    geo.translate(rel.lado * S, 0, 0);
  } else {
    forma.moveTo(-S, 0); forma.lineTo(S, 0); forma.lineTo(S, rel.h * sub); forma.lineTo(-S, rel.h * sub); forma.closePath();
    geo = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: false });
    geo.translate(0, 0, S - grosor / 2);
  }
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true; m.receiveShadow = true;
  m.position.y = -arranque * sub;
  return m;
}
