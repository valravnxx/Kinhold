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
  juntaPaja: 0,           // lo que monta un tramo de paja sobre el de al lado (0: lados planos que se tocan, sin surco)
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
// Portillo de la cerca: dos postes y una hoja de varas con su tornapunta, que gira en el poste de la izquierda.
function portillo() {
  const g = new THREE.Group();
  for (const x of [-0.95, 0.95]) g.add(cilindroY(0.07, 1.2, COLORES.troncoOscuro, x, 0, 0, 6));
  const hoja = new THREE.Group();
  const largo = 1.76; // de poste a poste, con holgura
  for (const y of [0.3, 0.62, 0.94]) hoja.add(cilindroX(0.035, largo, COLORES.vara, 0.1 + largo / 2, y, 0, 5));
  for (const x of [0.12, 0.1 + largo - 0.04]) hoja.add(cilindroY(0.04, 0.82, COLORES.vara, x, 0.22, 0, 5));
  // tornapunta en diagonal, de abajo junto a las bisagras hacia arriba en el lado que cuelga
  const dx = largo - 0.2, dy = 0.6, l = Math.hypot(dx, dy);
  const t = cilindroX(0.03, l, COLORES.vara, 0.2 + dx / 2, 0.32 + dy / 2, 0.03, 5);
  t.rotation.z = Math.atan2(dy, dx);
  hoja.add(t);
  // dos lazos de cuerda como bisagras
  for (const y of [0.3, 0.94]) hoja.add(caja(0.09, 0.05, 0.16, COLORES.lino, 0.06, y, 0));
  hoja.position.x = -0.95;
  hoja.name = 'hoja';
  g.add(hoja);
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

// ---------- Suelos y cimientos (centrados en la casilla), con el estilo v5 ----------
// Lo que se pisa va sin el oscurecido de contacto (sinSuelo): la oclusión solo en los costados, junto a la tierra.
const loteSuelo = () => new Lote({ variacion: 0.07, rangoSuelo: 0.35 });
// tronco tumbado a lo largo de X con las testas claras; escV aplasta el tronco en vertical (suelo de troncos)
function troncoTumbado(L, largo, x, y, z, r, color, escV = 1, opc = {}) {
  const esc = new THREE.Vector3(escV, 1, 1);
  L.add(cil(r * 0.97, r * 1.03, largo, 9, true), color, x, y, z, { z: Math.PI / 2 }, { escala: esc, ...opc });
  for (const s of [-1, 1]) {
    const rr = s < 0 ? r * 0.97 : r * 1.03;
    const tapa = new THREE.ConeGeometry(rr, rr * 0.22, 9, 1, true); tapa.translate(0, rr * 0.11, 0);
    L.add(tapa, 'corte', x + s * largo / 2, y, z, { z: -s * Math.PI / 2 }, { escala: esc, sinSuelo: true });
  }
}
// tabla a lo largo de X con la veta a lo largo (la caja se hace a lo largo de Z y se gira)
function tablaX(L, largo, alto, ancho, color, x, y, z, opc = {}) {
  L.add(cajaR(ancho, alto, largo, 0.012), color, x, y, z, { y: Math.PI / 2 }, opc);
}
// Cimiento de piedra: un macizo de mortero con losas encima y una hilada de piedras redondeadas en los costados,
// como el zócalo de la cabaña de la prueba de estilo
function cimientoPiedra() {
  const L = loteSuelo(), S = MODULO, top = P.superficieCimiento;
  L.add(cajaR(S - 0.02, 0.27, S - 0.02, 0.05), 'mortero', 0, top - 0.05 - 0.135, 0); // el mortero queda 5 cm bajo las losas: se ven las juntas
  // losas: cuadrícula de 4×4 con juntas y un poco de giro, la cara de arriba justo en la superficie
  const n = 4, w = S / n;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const s = a * 7 + b * 3 + 1, ga = (ruido(s) - 0.5) * 0.08;
    const lw = w - 0.05 - ruido(s + 2) * 0.04, ld = w - 0.05 - ruido(s + 5) * 0.04;
    L.add(cajaR(lw, 0.08, ld, 0.03), 'piedra', -S / 2 + w * (a + 0.5), top - 0.04 - ruido(s + 4) * 0.008, -S / 2 + w * (b + 0.5), { y: ga }, { sinSuelo: true, plano: true, brillo: 0.86 + ruido(s + 9) * 0.16 });
  }
  // piedras de los costados (no sobresalen de la casilla más de 4 cm: los cimientos vecinos se juntan)
  const piedraLado = (x, y, z, giro, s) => L.add(new THREE.IcosahedronGeometry(1, 0), ruido(s * 3.1) > 0.5 ? 'piedra' : 'piedraOsc', x, y, z,
    { y: giro + ruido(s) * 0.4, x: ruido(s + 1) * 0.3 }, { escala: new THREE.Vector3(0.15, 0.085, 0.07), plano: true });
  let s = 11;
  for (const lado of [-1, 1]) for (let t = -S / 2 + 0.14; t < S / 2 - 0.1; t += 0.24) {
    piedraLado(t, -0.01, lado * (S / 2 - 0.035), 0, s++);
    piedraLado(lado * (S / 2 - 0.035), -0.01, t + 0.06, Math.PI / 2, s++);
  }
  return deLote(L);
}
// Cimiento de troncos: seis troncos gruesos tumbados, con las testas a la vista
function cimientoTroncos() {
  const L = loteSuelo(), r = 0.17, testa = r * 1.03 * 0.22;
  for (let t = 0; t < 6; t++) {
    const z = -MODULO / 2 + 0.17 + t * 0.333;
    troncoTumbado(L, MODULO - 2 * testa, 0, P.superficieCimiento - r, z, r, ruido(t * 5 + 2) > 0.5 ? 'madera' : 'maderaOsc');
  }
  return deLote(L);
}
// Suelo de troncos: siete troncos partidos (aplastados) sobre dos durmientes de corteza
function sueloTroncos() {
  const L = loteSuelo(), r = 0.14, testa = r * 1.03 * 0.22;
  for (const x of [-0.7, 0.7]) L.add(cajaR(0.16, 0.08, MODULO - 0.06, 0.03), 'corteza', x, P.superficieSuelo - 0.13, 0);
  for (let t = 0; t < 7; t++) {
    const z = -MODULO / 2 + 0.143 + t * 0.286;
    troncoTumbado(L, MODULO - 2 * testa, 0, P.superficieSuelo - 0.07, z, r, ruido(t * 3 + 7) > 0.5 ? 'madera' : 'maderaOsc', 0.5);
  }
  return deLote(L);
}
// Suelo de tablas: ocho tablas con juntas, clavadas a dos rastreles
function sueloTablas() {
  const L = loteSuelo(), n = 8, w = MODULO / n, top = P.superficieSuelo;
  for (const x of [-0.7, 0.7]) L.add(cajaR(0.14, 0.12, MODULO - 0.04, 0.025), 'maderaOsc', x, top - 0.12, 0);
  for (let t = 0; t < n; t++) {
    const z = -MODULO / 2 + w / 2 + t * w;
    tablaX(L, MODULO - 0.01, 0.06, w * 0.93, ruido(t * 3.7 + 2) > 0.5 ? 'tabla' : 'madera', 0, top - 0.03 - ruido(t + 1) * 0.004, z, { sinSuelo: true });
  }
  return deLote(L);
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

// ---------- Tejados, con el estilo v5 ----------
// Tramo que sube hacia +z: alero en z=-1 (y=0) y borde alto en z=+1 (y=subida). ctx (de geometriaTejados, en el juego):
//   extremos: lados (±1 en x) sin tramo que siga, donde el tejado vuela y se remata; cumbrera: pone el remate de la
//   cumbrera (solo uno de los dos tramos que la cierran); par: paridad de la casilla, para que los tramos vecinos se
//   monten uno sobre otro sin coincidir (si coinciden, parpadean). Sin ctx (fantasma, muestrario): tramo suelto.
const CTX_TEJADO = { extremos: [1, -1], cumbrera: false, par: 0 };
const loteTejado = () => new Lote({ variacion: 0.05, rangoSuelo: 0.35 });
function marcoTejado(ctx, junta = 0.03) {
  const S = MODULO, sub = P.subidaTejado, ang = Math.atan2(sub, S), largo = Math.hypot(S, sub), V = P.voladizo;
  const vuela = l => (ctx.extremos || []).includes(l) ? 0.2 : junta;
  const x0 = -S / 2 - vuela(-1), x1 = S / 2 + vuela(1);
  const giro = new THREE.Matrix4().makeRotationX(-ang);
  // punto del plano del tejado a una distancia s del alero (por la pendiente) y t por encima (perpendicular)
  const punto = (s, t) => new THREE.Vector3(0, s * Math.sin(ang) + t * Math.cos(ang), -S / 2 + s * Math.cos(ang) - t * Math.sin(ang));
  return { S, sub, ang, largo, V, x0, x1, ancho: x1 - x0, cx: (x0 + x1) / 2, giro, punto, alza: (ctx.par ? 0.012 : 0) };
}
// Paja: dos hiladas gruesas y redondeadas (la del alero monta sobre la de arriba, como en la cabaña de la prueba v5),
// con un fleco de mechones en el alero y la cumbrera redonda
const RAYAS_PAJA = (v) => 1 + Math.sin(v.x * 8.1 + Math.sin(v.x * 1.7) * 2) * 0.05 + Math.sin(v.x * 21.3) * 0.03;
const GRUESO_PAJA = 0.32;
// una hilada: perfil redondeado por arriba y por abajo de la pendiente, pero con los lados planos, para que los tramos
// vecinos se junten sin surco (si los lados fueran redondos, el tejado se vería acolchado, a cuadros)
function hiladaPaja(ancho, grueso, largo, r = 0.14) {
  const f = new THREE.Shape(), a = largo / 2, b = grueso / 2;
  f.moveTo(-a + r, -b); f.lineTo(a - r, -b); f.quadraticCurveTo(a, -b, a, -b + r); f.lineTo(a, b - r); f.quadraticCurveTo(a, b, a - r, b);
  f.lineTo(-a + r, b); f.quadraticCurveTo(-a, b, -a, b - r); f.lineTo(-a, -b + r); f.quadraticCurveTo(-a, -b, -a + r, -b);
  const g = new THREE.ExtrudeGeometry(f, { depth: ancho, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -ancho / 2); g.rotateY(-Math.PI / 2);
  return g;
}
function tejadoPaja(ctx = CTX_TEJADO) {
  const L = loteTejado(), M = marcoTejado(ctx, P.juntaPaja), GR = GRUESO_PAJA, FILAS = 2;
  const total = M.largo + M.V, lf = total / FILAS;
  for (let f = 0; f < FILAS; f++) {
    const s0 = -M.V + f * lf, l = f === FILAS - 1 ? lf + 0.02 : lf * 1.3;
    const c = M.punto(s0 + l / 2, GR / 2 + (FILAS - 1 - f) * 0.06);
    L.add(hiladaPaja(M.ancho, GR, l), f % 2 ? 'pajaOsc' : 'paja', M.cx, c.y, c.z, M.giro, { rayas: RAYAS_PAJA, sinSuelo: true });
  }
  // mechones: manojos cortos y romos de paja que asoman del canto del alero, en dos filas, cada uno con su largo y giro
  const bajada = new THREE.Vector3(0, -Math.sin(M.ang), -Math.cos(M.ang));
  const n = Math.round(M.ancho / 0.05);
  for (let fila = 0; fila < 2; fila++) for (let i = 0; i < n; i++) {
    const sd = i * 3.3 + fila * 17.1;
    const x = M.x0 + 0.02 + (i + 0.5 * fila + 0.25) * (M.ancho - 0.04) / n + (ruido(sd) - 0.5) * 0.03;
    if (x > M.x1 - 0.02) continue;
    const largo = 0.08 + ruido(sd + 5) * 0.08, t = GR * (fila ? 0.68 : 0.32) + (ruido(sd + 3) - 0.5) * 0.08 + (FILAS - 1) * 0.06;
    const base = M.punto(-M.V + 0.04, t);
    const dir = bajada.clone().add(new THREE.Vector3((ruido(sd + 9) - 0.5) * 0.35, -0.15 - fila * 0.1, 0)).normalize();
    const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    const manojo = cil(0.022, 0.032, largo, 5); manojo.translate(0, largo / 2 - 0.02, 0);
    L.add(manojo, ruido(sd + 2) > 0.5 ? 'paja' : 'pajaOsc', x, base.y, base.z, m, { sinSuelo: true, escala: new THREE.Vector3(1.3, 1, 0.8), brillo: 0.85 + ruido(sd + 7) * 0.2 });
  }
  if (ctx.cumbrera) {
    const yC = M.sub + GR * 0.78, r = 0.24;
    L.add(cil(r, r, M.ancho, 14), 'pajaOsc', M.cx, yC, M.S / 2, { z: Math.PI / 2 }, { sinSuelo: true, rayas: RAYAS_PAJA });
    for (const l of [-1, 1]) if ((ctx.extremos || []).includes(l))
      L.add(new THREE.SphereGeometry(r, 14, 8), 'pajaOsc', l < 0 ? M.x0 : M.x1, yC, M.S / 2, null, { sinSuelo: true, escala: new THREE.Vector3(0.3, 1, 1) });
  }
  return deLote(L);
}
// Tablillas: tablazón debajo y filas de tablillas solapadas, cada fila desplazada media tablilla, con el pie un poco
// levantado (se ve el canto de cada fila); tabla de remate en los lados que vuelan y caballete en la cumbrera
function tejadoTablillas(ctx = CTX_TEJADO) {
  const L = loteTejado(), M = marcoTejado(ctx);
  const tz = M.punto(-M.V + (M.largo + M.V) / 2, 0.02 + M.alza);
  L.add(cajaR(M.ancho, 0.04, M.largo + M.V, 0.01), 'maderaOsc', M.cx, tz.y, tz.z, M.giro, { sinSuelo: true, brillo: 0.6 });
  const LARGO = 0.38, PASO = 0.19, GROSOR = 0.03, inclina = 0.11;
  const filas = Math.ceil((M.largo + M.V - LARGO) / PASO) + 1;
  const giroT = new THREE.Matrix4().makeRotationX(-(M.ang - inclina));
  for (let f = 0; f < filas; f++) {
    const s0 = Math.min(-M.V + f * PASO, M.largo + 0.01 - LARGO);
    const c = M.punto(s0 + LARGO / 2, 0.04 + GROSOR / 2 + LARGO / 2 * Math.sin(inclina) + M.alza);
    let x = M.x0 - (f % 2) * 0.1, k = 0;
    while (x < M.x1 - 0.02) {
      const w = Math.min(0.17 + ruido(f * 13.1 + k * 3.7) * 0.08, M.x1 - x), a = Math.max(x, M.x0), b = x + w;
      const sd = f * 31 + k * 7;
      L.add(new THREE.BoxGeometry(b - a - 0.012, GROSOR, LARGO), ruido(sd) > 0.45 ? 'tabla' : 'madera', (a + b) / 2, c.y, c.z, giroT,
        { sinSuelo: true, brillo: 0.74 + ruido(sd + 3) * 0.36 });
      x += w; k++;
    }
  }
  // tablas de remate en los lados que vuelan
  for (const l of [-1, 1]) if ((ctx.extremos || []).includes(l)) {
    const c = M.punto(-M.V + (M.largo + M.V) / 2, 0.02 + M.alza);
    L.add(cajaR(0.04, 0.2, M.largo + M.V, 0.01), 'maderaOsc', l < 0 ? M.x0 - 0.02 : M.x1 + 0.02, c.y, c.z, M.giro, { sinSuelo: true });
  }
  if (ctx.cumbrera) L.add(cajaR(M.ancho + 0.04, 0.17, 0.17, 0.02), 'maderaOsc', M.cx, M.sub + 0.1 + M.alza, M.S / 2, { x: Math.PI / 4 }, { sinSuelo: true });
  return deLote(L);
}
// Tablas de pie que cierran un hueco bajo el tejado, en un plano vertical: u0..u1 a lo ancho, de yBajo hasta arriba(u)
// (el corte de arriba sigue la pendiente). plano: 'x' (a lo largo de X, en z=pos) o 'z' (a lo largo de Z, en x=pos).
function tablasDePie(L, u0, u1, yBajo, arriba, plano, pos, grosor = 0.07) {
  const n = Math.max(1, Math.round((u1 - u0) / 0.22)), w = (u1 - u0) / n;
  for (let t = 0; t < n; t++) {
    const a = u0 + t * w + 0.006, b = u0 + (t + 1) * w - 0.006;
    const ya = Math.max(yBajo + 0.04, arriba(a)), yb = Math.max(yBajo + 0.04, arriba(b));
    const f = new THREE.Shape(); f.moveTo(a, yBajo); f.lineTo(b, yBajo); f.lineTo(b, yb); f.lineTo(a, ya); f.closePath();
    const g = new THREE.ExtrudeGeometry(f, { depth: grosor, bevelEnabled: false }); g.translate(0, 0, -grosor / 2);
    if (plano === 'z') { g.rotateY(-Math.PI / 2); g.translate(pos, 0, 0); } else g.translate(0, 0, pos);
    L.add(g, ruido(t * 3.7 + u0 * 5) > 0.5 ? 'tabla' : 'madera', 0, 0, 0, null, { sinSuelo: true, brillo: 0.92 });
  }
}
// Relleno liso (barro del zarzo, encalado del entramado) con la misma forma
function rellenoLiso(L, u0, u1, yBajo, arriba, plano, pos, color) {
  const f = new THREE.Shape(); f.moveTo(u0, yBajo); f.lineTo(u1, yBajo); f.lineTo(u1, arriba(u1)); f.lineTo(u0, arriba(u0)); f.closePath();
  const g = new THREE.ExtrudeGeometry(f, { depth: 0.14, bevelEnabled: false }); g.translate(0, 0, -0.07);
  if (plano === 'z') { g.rotateY(-Math.PI / 2); g.translate(pos, 0, 0); } else g.translate(0, 0, pos);
  L.add(g, color, 0, 0, 0, null, { sinSuelo: true, tex: 'piedra', rayas: (v) => 0.94 + 0.06 * Math.sin(v.x * 3.1 + v.y * 2.3 + v.z * 1.7) });
}
// Lo que asoma del relleno liso, como en su muro: estacas del zarzo o postes del entramado, hasta el tejado
function armazonRelleno(L, u0, u1, yBajo, arriba, plano, pos, muro) {
  const us = muro === 'muro_zarzo' ? [-0.93, 0, 0.93] : [u0 + 0.09, (u0 + u1) / 2, u1 - 0.09];
  for (const u of us) {
    const h = arriba(u) - yBajo - 0.03;
    if (h < 0.08) continue;
    const [x, z] = plano === 'z' ? [pos, u] : [u, pos];
    if (muro === 'muro_zarzo') L.add(cil(0.085, 0.095, h, 8), 'corteza', x, yBajo + h / 2, z, null, { sinSuelo: true });
    else L.add(cajaR(plano === 'z' ? 0.2 : 0.18, h, plano === 'z' ? 0.18 : 0.2, 0.03), 'maderaOsc', x, yBajo + h / 2, z, null, { sinSuelo: true });
  }
}
// Hastial suelto (ya no está en el menú, pero puede haberlo en construcciones guardadas): tablas de pie en triángulo
function hastial() {
  const L = loteMuro(), S = MODULO, sub = P.subidaTejado;
  tablasDePie(L, -S / 2, S / 2, 0, u => (u + S / 2) / S * sub, 'x', 0);
  return deLote(L);
}

// ---------- Acceso, con el estilo v5 ----------
// añade una pieza con una matriz completa (giro y sitio de la escalera entera × los de la pieza)
function addM(L, geo, color, M, opc) { const e = M.elements; L.add(geo, color, e[12], e[13], e[14], M, opc); }
const mParte = (base, x, y, z, eu) => base.clone().multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(eu?.x || 0, eu?.y || 0, eu?.z || 0, 'YXZ')).setPosition(x, y, z));
// Escalera de mano: dos varas descortezadas y travesaños, apoyada hacia +z
function escaleraMano() {
  const L = loteSuelo();
  const largo = ALTURA + 0.6, ang = 0.32;
  const base = new THREE.Matrix4().makeTranslation(0, 0, MODULO / 2 - 0.15 - Math.sin(ang) * largo).multiply(new THREE.Matrix4().makeRotationX(-ang));
  for (const x of [-0.25, 0.25]) addM(L, cil(0.04, 0.047, largo, 7), x < 0 ? 'madera' : 'maderaOsc', mParte(base, x, largo / 2, 0));
  let k = 0;
  for (let y = 0.3; y < largo; y += 0.32) addM(L, cil(0.028, 0.03, 0.58, 6), ruido(k++ + 4) > 0.5 ? 'tabla' : 'madera', mParte(base, 0, y, 0, { z: Math.PI / 2 }));
  return deLote(L);
}
// Escalera de tablas: sube hacia +z local desde el borde -z de la casilla hasta el suelo de la planta de arriba.
function escaleraTablas() {
  const L = loteSuelo();
  const S = MODULO, y0 = P.superficieSuelo, y1 = ALTURA + P.superficieSuelo;
  const ancho = 1.1, peldanos = 10, sube = (y1 - y0) / peldanos, huella = S / peldanos;
  const largo = Math.hypot(S, y1 - y0), ang = Math.atan2(y1 - y0, S);
  // zancas: dos tablones gruesos en diagonal a los lados (la caja va a lo largo de Y para que la veta siga el tablón)
  for (const x of [-ancho / 2, ancho / 2]) L.add(cajaR(0.06, largo + 0.1, 0.26, 0.015), 'maderaOsc', x, (y0 + y1) / 2 - 0.08, 0, { x: Math.PI / 2 - ang });
  // peldaños de tabla, con la veta a lo ancho
  for (let n = 0; n < peldanos; n++) {
    const y = y0 + sube * (n + 1) - 0.03, zc = -S / 2 + huella * (n + 0.5);
    tablaX(L, ancho - 0.04, 0.05, huella + 0.04, ruido(n * 2.3 + 1) > 0.5 ? 'tabla' : 'madera', 0, y, zc);
  }
  // pie: un taco bajo el arranque para que no flote sobre la tierra
  L.add(cajaR(ancho + 0.06, y0 + 0.02, 0.12, 0.015), 'maderaOsc', 0, (y0 + 0.02) / 2, -S / 2 + 0.06);
  return deLote(L);
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
export function modeloPieza(tipo, ctx) {
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
    case 'tejado_paja': return tejadoPaja(ctx || CTX_TEJADO);
    case 'tejado_tablilla': return tejadoTablillas(ctx || CTX_TEJADO);
    case 'hastial': return hastial();
    case 'escalera_mano': return escaleraMano();
    case 'escalera_tabla': return escaleraTablas();
    case 'puerta_varas': return puerta('puerta_varas');
    case 'puerta_tabla': return puerta('puerta_tabla');
    case 'cerca': return cerca();
    case 'cerca_portillo': return portillo();
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

// ---------- Rellenos de muro bajo el tejado, con el estilo v5 ----------
// En el marco local del tramo de tejado (sube hacia +z; lados en x = ±1; borde alto en z = +1).
// y = 0 es lo alto de la planta de los muros. 'arranque' en tramos. Como en la cabaña de la prueba v5, bajo el tejado
// se cierra con tablas de pie (muros de troncos y de tablas); el zarzo con su barro y el entramado con su encalado.
const RELLENO_LISO = { muro_zarzo: 0x8c7356, muro_entramado: 0xd3c6a6 };
export function rellenoTejado(rel, arranque) {
  const S = MODULO / 2, sub = P.subidaTejado, L = loteMuro(), yBajo = -arranque * sub;
  let u0, u1, arriba, plano, pos;
  if (rel.tipo === 'lado') {
    // trapecio en el plano x = ±1: de z = -1 (alto hBajo) a z = +1 (alto hAlto)
    u0 = -S; u1 = S; plano = 'z'; pos = rel.lado * S;
    arriba = z => yBajo + (rel.hBajo + (rel.hAlto - rel.hBajo) * (z + S) / (2 * S)) * sub;
  } else {
    u0 = -S; u1 = S; plano = 'x'; pos = S; arriba = () => yBajo + rel.h * sub;
  }
  if (RELLENO_LISO[rel.muro]) {
    rellenoLiso(L, u0, u1, yBajo, arriba, plano, pos, RELLENO_LISO[rel.muro]);
    armazonRelleno(L, u0, u1, yBajo, arriba, plano, pos, rel.muro);
  }
  else tablasDePie(L, u0, u1, yBajo, arriba, plano, pos);
  return deLote(L);
}
