// Kinhold — modelos low-poly generados por código.
// Todos los modelos se definen con parámetros (P) para poder ajustarlos sin rehacerlos.
// Las piezas ya pasadas al estilo elegido (v5, «realismo en miniatura») se hacen como la cabaña de la prueba de estilo:
// formas redondeadas, color con oclusión horneado en los vértices y texturas por código (src/mundo/estilos.js),
// todo junto en una malla por textura (todas las piezas y los muebles ya lo están).
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

// pseudoaleatorio estable
function ruido(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }

// ---------- Estilo v5: piezas hechas con un Lote (src/mundo/estilos.js) ----------
const hayDocumento = typeof document !== 'undefined'; // las pruebas de lógica cargan los modelos en node, sin texturas
export const cajaR = (w, h, d, radio = 0.02) => new RoundedBoxGeometry(w, h, d, 1, Math.min(radio, w / 2.05, h / 2.05, d / 2.05));
// junta lo del lote en una malla por textura (madera, corte, piedra…), como la escena de la prueba de estilo
export function deLote(L) {
  const g = new THREE.Group();
  if (L.hiladas) g.userData.hiladas = [...L.hiladas];
  for (const [tipo, geos] of Object.entries(L.cerrar(null, true))) {
    const m = new THREE.Mesh(mergeGeometries(geos), hayDocumento ? materialTex(tipo) : materialEstilo('fijo'));
    m.castShadow = m.receiveShadow = true; m.name = 'estilo_' + tipo;
    g.add(m);
  }
  return g;
}
// lo que se lleva en la mano es tan fino (una hoja de 9 mm) que el mapa de sombras lo sombrea entero sobre sí mismo:
// echa sombra pero no la recibe, como antes
// Y con sombreado plano calculado al dibujar (como las armas de antes): en la mano del personaje la cara que se ve
// siempre recibe la luz que le toca, sin depender de las normales de vértice.
const matsMano = new Map();
function matMano(m) { if (!matsMano.has(m)) { const c = m.clone(); c.flatShading = true; matsMano.set(m, c); } return matsMano.get(m); }
// El acero pulido (opc.tex 'acero') refleja el cielo: aunque su cara quede a contraluz no se ve negro.
let matAcero = null;
export function deMano(L) {
  const g = deLote(L);
  g.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = false;
    if (o.name === 'estilo_acero' && hayDocumento) o.material = matAcero ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x3b3f43 });
    else o.material = matMano(o.material);
  });
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
// ---------- Cercas, portillo y empalizada, con el estilo v5 ----------
// Lo que se abre (la hoja) va en su propio grupo «hoja», que gira en las bisagras; el resto, fijo. Cada parte junta
// lo suyo en una malla por textura, como las demás piezas del estilo v5.
function conHoja(Lfijo, Lhoja, xBisagra) {
  const g = Lfijo ? deLote(Lfijo) : new THREE.Group();
  const hoja = deLote(Lhoja);
  hoja.position.x = xBisagra; hoja.name = 'hoja';
  g.add(hoja);
  return g;
}
const CUERDA = 0xa8977a;
// poste redondo descortezado, un poco más grueso al pie, con el corte claro arriba (como los de la cerca de la v5)
function posteVara(L, x, alto, r, color = 'maderaOsc', z = 0, s = 1) {
  L.add(cil(r * 0.82, r, alto, 8), color, x, alto / 2, z, { y: ruido(s) * 3 });
  L.add(new THREE.CircleGeometry(r * 0.82, 8), 'corte', x, alto + 0.002, z, { x: -Math.PI / 2 }, { sinSuelo: true });
}
// vara tumbada a lo largo de X (con la veta a lo largo)
function varaX(L, largo, r, color, x, y, z, giroZ = 0) { L.add(cil(r, r * 1.08, largo, 6), color, x, y, z, { z: Math.PI / 2 + giroZ }); }
// lazada de cuerda alrededor de una vara vertical, a una altura
function lazada(L, x, y, z, r) { L.add(new THREE.TorusGeometry(r + 0.012, 0.012, 4, 8), CUERDA, x, y, z, { x: Math.PI / 2 }, { sinSuelo: true }); }
// Cerca de varas: como la de la prueba v5 (postes redondos y dos varas atadas); las varas llegan justo al borde de
// la casilla, así los tramos seguidos parecen una sola cerca
function cerca() {
  const L = loteMuro();
  [-0.95, 0, 0.95].forEach((x, i) => { posteVara(L, x, 1.15, 0.075, 'maderaOsc', 0, i + 1); for (const y of [0.45, 0.92]) lazada(L, x, y, 0, 0.065); });
  varaX(L, MODULO, 0.035, 'madera', 0, 0.45, 0.06, 0.004);
  varaX(L, MODULO, 0.035, 'madera', 0, 0.92, 0.06, -0.004);
  return deLote(L);
}
// Portillo de la cerca: dos postes más gruesos y una hoja de varas con su tornapunta y lazadas de cuerda de bisagra,
// que gira en el poste de la izquierda
function portillo() {
  const F = loteMuro();
  for (const [i, x] of [-0.95, 0.95].entries()) posteVara(F, x, 1.25, 0.085, 'maderaOsc', 0, i + 5);
  const H = loteMuro(), largo = 1.76; // de poste a poste, con holgura
  for (const [i, y] of [0.3, 0.62, 0.94].entries()) varaX(H, largo, 0.033, i % 2 ? 'maderaOsc' : 'madera', 0.1 + largo / 2, y, 0.06);
  for (const x of [0.13, 0.06 + largo]) H.add(cil(0.036, 0.04, 0.86, 6), 'madera', x, 0.2 + 0.43, 0.06);
  // tornapunta en diagonal, de abajo junto a las bisagras hacia arriba en el lado que cuelga
  const dx = largo - 0.2, dy = 0.6, l = Math.hypot(dx, dy);
  H.add(cil(0.028, 0.03, l, 6), 'maderaOsc', 0.2 + dx / 2, 0.32 + dy / 2, 0.1, { z: Math.atan2(dy, dx) - Math.PI / 2 });
  // lazos de cuerda que hacen de bisagra, y ataduras en los cruces
  for (const y of [0.3, 0.94]) H.add(new THREE.TorusGeometry(0.1, 0.014, 4, 10), CUERDA, 0.02, y, 0.03, { x: Math.PI / 2 }, { sinSuelo: true, escala: new THREE.Vector3(1, 0.7, 1) });
  for (const x of [0.13, 0.06 + largo]) for (const y of [0.3, 0.94]) lazada(H, x, y, 0.06, 0.036);
  return conHoja(F, H, -0.95);
}
// Empalizada: troncos descortezados clavados de pie (como los de la cabaña de la prueba v5), cada uno de su alto y algo torcido, con la punta tallada (se ve la
// madera clara) y dos traviesas detrás que los atan
function empalizada(opc = {}) {
  if (opc.porton) {
    const F = loteMuro();
    for (const s of [-1, 1]) {
      F.add(cil(0.15, 0.17, P.altoEmpalizada + 0.2, 10), 'maderaOsc', s * MODULO / 2, (P.altoEmpalizada + 0.2) / 2, 0);
      F.add(new THREE.ConeGeometry(0.15, 0.32, 10), 'tabla', s * MODULO / 2, P.altoEmpalizada + 0.36, 0, null, { sinSuelo: true });
    }
    const H = loteMuro(), n = 7, w = 0.27;
    for (let t = 0; t < n; t++) {
      const x = 0.15 + t * w, h = 2.6 + (t % 2 ? 0 : 0.06);
      H.add(cajaR(w * 0.95, h, 0.12, 0.03), ruido(t * 2.7 + 4) > 0.5 ? 'tabla' : 'madera', x, h / 2 + 0.04, 0);
      H.add(new THREE.ConeGeometry(w * 0.48, 0.22, 4, 1), 'tabla', x, h + 0.15, 0, { y: Math.PI / 4 }, { sinSuelo: true, escala: new THREE.Vector3(1, 1, 0.3), plano: true });
    }
    const ancho = n * w;
    for (const y of [0.5, 1.4, 2.3]) {
      H.add(cajaR(ancho, 0.16, 0.08, 0.02), 'maderaOsc', 0.15 - w / 2 + ancho / 2, y, -0.1); // traviesas por detrás
      H.add(cajaR(ancho * 0.94, 0.07, 0.015, 0.006), 'hierro', 0.15 - w / 2 + ancho * 0.5, y, 0.068); // pletinas de hierro
      for (let t = 0; t < n; t += 2) H.add(new THREE.SphereGeometry(0.022, 6, 4), 'hierro', 0.15 + t * w, y, 0.078, null, { sinSuelo: true }); // clavos
    }
    H.add(new THREE.TorusGeometry(0.08, 0.016, 5, 10), 'hierro', ancho - 0.25, 1.15, 0.09); // argolla
    return conHoja(F, H, -MODULO / 2);
  }
  const L = loteMuro(), n = 7;
  for (let t = 0; t < n; t++) {
    const x = -MODULO / 2 + (t + 0.5) * (MODULO / n), alto = P.altoEmpalizada - 0.15 + ruido(t + 3) * 0.3;
    const r = 0.135 + ruido(t * 5.1) * 0.025, inclina = (ruido(t * 1.9 + 2) - 0.5) * 0.04;
    L.add(cil(r * 0.94, r, alto, 9), ruido(t * 7.7 + 1) > 0.5 ? 'madera' : 'maderaOsc', x, alto / 2, 0, { z: inclina, y: ruido(t) * 3 });
    const punta = new THREE.ConeGeometry(r * 0.94, 0.4, 9); // la punta tallada a hachazos: madera clara, caras planas
    L.add(punta, ruido(t * 3.3) > 0.5 ? 'tabla' : 'madera', x - Math.sin(inclina) * alto / 2, alto + 0.2, 0, { z: inclina }, { sinSuelo: true, plano: true });
  }
  for (const y of [1.0, 2.2]) varaX(L, MODULO, 0.06, 'maderaOsc', 0, y, -0.2, y > 2 ? 0.006 : -0.006);
  return deLote(L);
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
  // losas: cuatro hileras de losas de largo desigual (a soga, como un enlosado hecho a mano), con juntas, un poco de giro
  // y tonos de dos piedras; la cara de arriba justo en la superficie. Una cuadrícula igual parecía baldosa moderna.
  const n = 4, w = S / n;
  let s = 1;
  for (let b = 0; b < n; b++) {
    // cortes de la hilera: 3 o 4 losas, cada una entre 0,6 y 1,4 veces el largo medio
    const k = ruido(b * 13 + 2) > 0.45 ? 4 : 3, largos = [];
    for (let i = 0; i < k; i++) largos.push(0.6 + ruido(b * 17 + i * 5 + 3) * 0.8);
    const suma = largos.reduce((a, c) => a + c, 0);
    let x0 = -S / 2;
    for (const l of largos) {
      const lx = l / suma * S; s++;
      const ga = (ruido(s) - 0.5) * 0.06, lw = lx - 0.045 - ruido(s + 2) * 0.03, ld = w - 0.045 - ruido(s + 5) * 0.035;
      L.add(cajaR(lw, 0.08, ld, 0.03), ruido(s + 7) > 0.65 ? 'piedraOsc' : 'piedra', x0 + lx / 2, top - 0.04 - ruido(s + 4) * 0.01, -S / 2 + w * (b + 0.5), { y: ga }, { sinSuelo: true, plano: true, brillo: 0.74 + ruido(s + 9) * 0.2 });
      x0 += lx;
    }
  }
  // piedras de los costados (no sobresalen de la casilla más de 4 cm: los cimientos vecinos se juntan)
  const piedraLado = (x, y, z, giro, s) => L.add(new THREE.IcosahedronGeometry(1, 0), ruido(s * 3.1) > 0.5 ? 'piedra' : 'piedraOsc', x, y, z,
    { y: giro + ruido(s) * 0.4, x: ruido(s + 1) * 0.3 }, { escala: new THREE.Vector3(0.15, 0.085, 0.07), plano: true });
  s = 11;
  for (const lado of [-1, 1]) for (let t = -S / 2 + 0.14; t < S / 2 - 0.1; t += 0.24) {
    piedraLado(t, -0.01, lado * (S / 2 - 0.035), 0, s++);
    piedraLado(lado * (S / 2 - 0.035), -0.01, t + 0.06, Math.PI / 2, s++);
  }
  return deLote(L);
}
// Cimiento de troncos: seis troncos gruesos tumbados, con las testas a la vista
function cimientoTroncos() {
  const L = loteSuelo(), r = 0.17, testa = r * 1.03 * 0.22;
  // relleno oscuro entre los troncos (tierra apisonada y madera): no se ve el suelo verde por las juntas
  L.add(cajaR(MODULO - 0.04, r, MODULO - 0.04, 0.01), 'maderaOsc', 0, P.superficieCimiento - r, 0);
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
  // tablazón oscura a media altura de los troncos: entre tronco y tronco ya no se ve el suelo de abajo (valravnx:
  // «que tapen del todo»); solo asoma en el canal entre las dos curvas, como el relleno de barro y musgo
  L.add(cajaR(MODULO - 0.04, 0.1, MODULO - 0.04, 0.01), 'maderaOsc', 0, P.superficieSuelo - 0.1, 0);
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
    const x = M.x0 + 0.05 + (i + 0.5 * fila + 0.25) * (M.ancho - 0.1) / n + (ruido(sd) - 0.5) * 0.02;
    if (x > M.x1 - 0.05) continue; // los manojos no pasan del borde del tramo (no se meten en el de al lado)
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
    const ya = Math.max(yBajo + 0.005, arriba(a)), yb = Math.max(yBajo + 0.005, arriba(b));
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
// Puertas que van en el hueco de un muro, con el estilo v5: la de tablas como la de la cabaña de la prueba (cuatro
// tablas, dos peinazos por detrás y bisagras largas de hierro); la de varas, varas atadas con su tornapunta
function puerta(tipo) {
  const H = loteMuro(), w = P.anchoPuerta - 0.02, h = P.altoPuerta - 0.05;
  if (tipo === 'puerta_varas') {
    let k = 0;
    for (let x = 0.07; x < w - 0.03; x += 0.125) H.add(cil(0.038, 0.043, h - 0.04, 6), ruido(k++ * 2.3) > 0.5 ? 'madera' : 'maderaOsc', x, 0.02 + (h - 0.04) / 2, 0, { y: k });
    for (const y of [0.4, 1.6]) { varaX(H, w, 0.032, 'maderaOsc', w / 2, y, 0.06); for (let x = 0.07; x < w - 0.03; x += 0.25) lazada(H, x, y, 0.03, 0.04); }
    const dx = w - 0.2, dy = 1.1;
    H.add(cil(0.03, 0.032, Math.hypot(dx, dy), 6), 'madera', w / 2, 1.0, 0.08, { z: Math.atan2(dy, dx) - Math.PI / 2 });
    for (const y of [0.4, 1.6]) H.add(new THREE.TorusGeometry(0.04, 0.014, 4, 10), CUERDA, 0.06, y, 0.0, { x: Math.PI / 2 }, { sinSuelo: true });
  } else {
    const n = 4, tw = w / n;
    for (let t = 0; t < n; t++) H.add(cajaR(tw * 0.96, h, 0.06, 0.012), t % 2 ? 'tabla' : 'madera', tw * (t + 0.5), h / 2, 0);
    for (const y of [0.35, 1.6]) {
      H.add(cajaR(w * 0.92, 0.11, 0.04, 0.015), 'maderaOsc', w / 2, y, -0.05); // peinazos por detrás
      H.add(cajaR(w * 0.42, 0.045, 0.015, 0.007), 'hierro', 0.2, y, 0.037);   // bisagra larga
      for (const x of [0.06, 0.2, 0.34]) H.add(new THREE.SphereGeometry(0.016, 6, 4), 'hierro', x, y, 0.045, null, { sinSuelo: true });
    }
    H.add(new THREE.TorusGeometry(0.055, 0.012, 5, 10), 'hierro', w - 0.13, 1.0, 0.05); // tirador de argolla
  }
  return conHoja(null, H, -P.anchoPuerta / 2 + 0.01);
}

// ---------- Mojón, con el estilo v5 ----------
// Piedras apiladas (caras planas, como las de los cimientos) y una vara con un trapo atado
export function mojon() {
  const L = loteSuelo();
  // las grandes con más caras (detalle 1, como las rocas de la prueba v5); las pequeñas del pie, con 20 bastan
  const piedraM = (r, x, y, z, s, color) => L.add(new THREE.IcosahedronGeometry(1, r > 0.15 ? 1 : 0), color, x, y, z,
    { y: ruido(s) * 3, x: (ruido(s + 1) - 0.5) * 0.4 }, { escala: new THREE.Vector3(r, r * 0.68, r * 0.92), plano: true, brillo: 0.9 + ruido(s + 2) * 0.15 });
  piedraM(0.36, 0, 0.2, 0, 1, 'piedra');
  piedraM(0.28, 0.04, 0.52, -0.02, 2, 'piedraOsc');
  piedraM(0.2, -0.02, 0.79, 0.03, 3, 'piedra');
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; piedraM(0.1 + ruido(i + 7) * 0.05, Math.cos(a) * 0.4, 0.04, Math.sin(a) * 0.4, i + 11, i % 2 ? 'piedraOsc' : 'piedra'); }
  L.add(cil(0.032, 0.04, 1.62, 6), 'madera', 0.3, 0.81, 0.1, { z: -0.04 });
  L.add(cajaR(0.34, 0.24, 0.015, 0.006), 0x7d3c30, 0.48, 1.4, 0.1, { y: 0.15, z: -0.06 }, { sinSuelo: true });
  for (const y of [1.3, 1.5]) L.add(new THREE.TorusGeometry(0.045, 0.012, 4, 8), CUERDA, 0.305, y, 0.1, { x: Math.PI / 2 }, { sinSuelo: true });
  return deLote(L);
}

// ---------- Muebles y enseres, con el estilo v5 ----------
// Como el banco, el barril y el tocón de la prueba de estilo: madera con veta, cortes claros, hierro oscuro, y los
// paños (lino, lana, piel) con su textura de tejido. Mismo tamaño y apoyo que antes (la lógica no cambia).
// La llama de la antorcha va aparte, en su malla «llama» que brilla.
const loteMueble = () => new Lote({ variacion: 0.06, rangoSuelo: 0.4 });
// pata o poste redondo con el corte claro arriba, inclinado (ix, iz: lo que se abre por abajo)
function pata(L, x, z, alto, r, color = 'maderaOsc', ix = 0, iz = 0) {
  const l = Math.hypot(alto, ix, iz);
  const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-ix, alto, -iz).normalize()));
  L.add(cil(r * 0.85, r, l, 7), color, x + ix / 2, alto / 2, z + iz / 2, m);
}
// colchón o saco relleno: caja redondeada y abombada (los bordes bajan un poco), con su tela
function relleno(L, w, h, d, color, x, y, z, opc = {}) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(h * 0.45, 0.1));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const ux = p.getX(i) / (w / 2), uz = p.getZ(i) / (d / 2); if (p.getY(i) > 0) p.setY(i, p.getY(i) * (1 - 0.35 * Math.max(ux * ux, uz * uz) ** 2)); }
  g.computeVertexNormals();
  L.add(g, color, x, y, z, null, { sinSuelo: true, ...opc });
}
// manta doblada encima de algo: paño fino que cae por los lados
function manta(L, w, d, yTop, z, color, cae = 0.12) {
  L.add(cajaR(w, 0.035, d, 0.015), color, 0, yTop + 0.017, z, null, { sinSuelo: true });
  for (const s of [-1, 1]) L.add(cajaR(0.03, cae, d, 0.012), color, s * (w / 2 - 0.004), yTop + 0.03 - cae / 2, z, { z: s * 0.08 }, { sinSuelo: true, brillo: 0.85 });
}
// borde de pelo de una piel: mechones cortos alrededor de un contorno
function pelo(L, puntos, y, color, s0 = 0) {
  puntos.forEach(([x, z], i) => {
    const mech = new THREE.ConeGeometry(0.035, 0.07, 4); mech.rotateZ(Math.PI / 2);
    L.add(mech, color, x, y, z, { y: Math.atan2(-z, x) + (ruido(i + s0) - 0.5) * 0.4 }, { sinSuelo: true, escala: new THREE.Vector3(1, 0.4, 1), brillo: 0.85 + ruido(i * 3 + s0) * 0.25 });
  });
}
// contorno de una piel curtida (lomo a lo largo de z, cuatro patas y cuello)
function contornoPiel(largo, ancho) {
  const a = ancho / 2, l = largo / 2, f = new THREE.Shape();
  const pts = [[0, l], [a * 0.35, l * 0.92], [a * 0.5, l * 0.72], [a * 1.05, l * 0.78], [a * 0.9, l * 0.5], [a * 0.75, l * 0.1], [a * 0.8, -l * 0.45],
    [a * 1.08, -l * 0.72], [a * 0.6, -l * 0.7], [a * 0.3, -l * 0.95], [0, -l]];
  const todo = [...pts, ...pts.slice(1, -1).reverse().map(([x, z]) => [-x * (0.96 + 0.06 * Math.sin(z * 9)), z])];
  todo.forEach(([x, z], i) => i ? f.lineTo(x, -z) : f.moveTo(x, -z));
  return { forma: f, puntos: todo };
}
function camaPaja() {
  const L = loteMueble();
  // cuatro troncos finos hacen el marco en el suelo, y dentro la paja amontonada con un jergón de lino encima
  for (const s of [-1, 1]) {
    const tl = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    const tmp = new Lote(); troncoTumbado(tmp, 2.0, 0, 0.08, s * 0.42, 0.08, s < 0 ? 'madera' : 'maderaOsc');
    for (const q of tmp.piezas) { q.m.premultiply(tl); L.piezas.push(q); }
  }
  for (const s of [-1, 1]) troncoTumbado(L, 0.8, 0, 0.07, s * 0.93, 0.07, 'maderaOsc');
  relleno(L, 0.86, 0.16, 1.8, 'paja', 0, 0.1, 0, { rayas: RAYAS_PAJA });
  relleno(L, 0.78, 0.1, 1.55, 'lino', 0, 0.21, 0.05);
  manta(L, 0.82, 0.55, 0.26, 0.55, 'lana');
  // mechones de paja que asoman por los lados
  for (let i = 0; i < 18; i++) {
    const s = i % 2 ? 1 : -1, z = -0.85 + (i >> 1) * 0.2, m = cil(0.012, 0.018, 0.16 + ruido(i) * 0.08, 4);
    L.add(m, ruido(i + 3) > 0.5 ? 'paja' : 'pajaOsc', s * (0.4 + ruido(i + 7) * 0.02), 0.17, z, { z: -s * (0.7 + ruido(i + 1) * 0.4), y: ruido(i + 2) }, { sinSuelo: true });
  }
  return deLote(L);
}
function camaMadera() {
  const L = loteMueble();
  // cuatro postes con el corte arriba, largueros y travesaños de tabla, cabecero de tablas de pie
  for (const [x, z, h] of [[-0.5, -1.0, 0.85], [0.5, -1.0, 0.85], [-0.5, 1.0, 0.5], [0.5, 1.0, 0.5]]) {
    L.add(cajaR(0.09, h, 0.09, 0.02), 'maderaOsc', x, h / 2, z);
    L.add(new THREE.ConeGeometry(0.06, 0.06, 4), 'corte', x, h + 0.03, z, { y: Math.PI / 4 }, { sinSuelo: true, plano: true });
  }
  for (const s of [-1, 1]) L.add(cajaR(0.05, 0.16, 1.92, 0.012), 'madera', s * 0.5, 0.32, 0); // largueros (veta a lo largo)
  for (const z of [-1.0, 1.0]) tablaX(L, 0.92, 0.16, 0.05, 'madera', 0, 0.32, z);
  for (let t = 0; t < 4; t++) L.add(cajaR(0.22, 0.42, 0.04, 0.01), t % 2 ? 'tabla' : 'madera', -0.345 + t * 0.23, 0.6, -1.0); // cabecero
  tablaX(L, 1.04, 0.06, 0.08, 'maderaOsc', 0, 0.83, -1.0);
  for (let t = 0; t < 7; t++) tablaX(L, 0.92, 0.025, 0.2, 'tabla', 0, 0.39, -0.84 + t * 0.28, { brillo: 0.7 }); // tablas del somier
  relleno(L, 0.94, 0.15, 1.9, 'lino', 0, 0.475, 0);
  relleno(L, 0.55, 0.09, 0.28, 'lino', 0, 0.58, -0.78, { brillo: 1.05 }); // almohada
  manta(L, 1.0, 1.15, 0.54, 0.35, 'lana', 0.16);
  tablaX(L, 1.0, 0.04, 0.14, 'lanaOsc', 0, 0.58, -0.2, { sinSuelo: true }); // embozo vuelto
  return deLote(L);
}
function mesa() {
  const L = loteMueble();
  // tablero de tres tablas sobre dos caballetes (patas en tijera) y un travesaño
  for (let t = 0; t < 3; t++) tablaX(L, 1.4, 0.06, 0.26, t === 1 ? 'tabla' : 'madera', 0, 0.72, -0.27 + t * 0.27, { brillo: 0.96 + t * 0.03 });
  for (const sx of [-0.52, 0.52]) {
    L.add(cajaR(0.1, 0.07, 0.72, 0.015), 'maderaOsc', sx, 0.655, 0); // cabezal del caballete
    for (const sz of [-1, 1]) pata(L, sx, sz * 0.18, 0.63, 0.035, 'maderaOsc', 0, sz * 0.2);
  }
  varaX(L, 1.04, 0.03, 'madera', 0, 0.25, 0);
  return deLote(L);
}
function banco() {
  const L = loteMueble();
  // como el banco de la prueba v5: tabla gruesa sobre dos tablones de pie
  tablaX(L, 1.2, 0.08, 0.3, 'tabla', 0, 0.44, 0);
  for (const x of [-0.45, 0.45]) {
    L.add(cajaR(0.08, 0.4, 0.27, 0.02), 'maderaOsc', x, 0.2, 0);
    L.add(cajaR(0.075, 0.004, 0.2, 0.001), 'corte', x, 0.481, 0, null, { sinSuelo: true, brillo: 0.85 }); // la espiga pasante, a ras
  }
  return deLote(L);
}
function taburete() {
  const L = loteMueble();
  // asiento redondo de una rodaja (se ve el corte) y tres patas abiertas
  L.add(cil(0.2, 0.2, 0.06, 14), 'madera', 0, 0.42, 0);
  L.add(new THREE.CircleGeometry(0.198, 14), 'corte', 0, 0.451, 0, { x: -Math.PI / 2 }, { sinSuelo: true });
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.3; pata(L, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.4, 0.03, 'maderaOsc', Math.cos(a) * 0.09, Math.sin(a) * 0.09); }
  return deLote(L);
}
function arcon() {
  const L = loteMueble();
  // caja de tablas tumbadas, tapa de tres tablas, flejes y bisagras de hierro con clavos, y la cerradura
  for (let t = 0; t < 3; t++) for (const s of [-1, 1]) tablaX(L, 1.0, 0.16, 0.035, t % 2 ? 'madera' : 'tabla', 0, 0.06 + 0.08 + t * 0.155, s * 0.258, { brillo: 0.95 + ruido(t + s) * 0.08 });
  for (const s of [-1, 1]) L.add(cajaR(0.035, 0.47, 0.55, 0.01), 'maderaOsc', s * 0.483, 0.295, 0);
  for (const s of [-1, 1]) L.add(cajaR(0.07, 0.06, 0.55, 0.012), 'maderaOsc', s * 0.45, 0.03, 0); // patines
  for (let t = 0; t < 3; t++) tablaX(L, 1.04, 0.05, 0.19, t === 1 ? 'tabla' : 'madera', 0, 0.555, -0.19 + t * 0.19);
  for (const x of [-0.32, 0.32]) {
    L.add(cajaR(0.06, 0.012, 0.6, 0.005), 'hierro', x, 0.585, 0); // fleje por la tapa
    for (const s of [-1, 1]) L.add(cajaR(0.06, 0.5, 0.012, 0.005), 'hierro', x, 0.3, s * 0.282);
    for (const y of [0.12, 0.3, 0.48]) L.add(new THREE.SphereGeometry(0.014, 5, 3), 'hierro', x, y, 0.29, null, { sinSuelo: true });
  }
  L.add(cajaR(0.1, 0.12, 0.02, 0.006), 'hierro', 0, 0.47, 0.29); // cerradura
  L.add(cajaR(0.035, 0.1, 0.015, 0.005), 'hierro', 0, 0.54, 0.297); // aldaba
  return deLote(L);
}
function barril() {
  const L = loteMueble();
  // duelas abombadas (se ven las juntas), dos aros de hierro y la tapa de tablas
  const perfil = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; perfil.push(new THREE.Vector2(0.26 + 0.045 * Math.sin(Math.PI * t), t * 0.8)); }
  const N = 14, hueco = 0.012;
  for (let k = 0; k < N; k++) { // cada duela aparte, con una junta fina entre ellas
    const duela = new THREE.LatheGeometry(perfil, 3, k * 2 * Math.PI / N + hueco / 2, 2 * Math.PI / N - hueco);
    L.add(duela, ruido(k * 2.1 + 5) > 0.5 ? 'tabla' : 'madera', 0, 0, 0, null, { brillo: 0.92 + ruido(k + 1) * 0.14 });
  }
  L.add(cil(0.27, 0.25, 0.79, 14), 'maderaOsc', 0, 0.395, 0, null, { brillo: 0.4 }); // por dentro, se ve por las juntas
  for (const y of [0.13, 0.67]) { const r = 0.26 + 0.045 * Math.sin(Math.PI * y / 0.8) + 0.008; L.add(cil(r, r, 0.05, 28, true), 'hierro', 0, y, 0, null, { sinSuelo: true }); }
  for (let t = 0; t < 4; t++) tablaX(L, 0.5 - Math.abs(t - 1.5) * 0.08, 0.02, 0.125, t % 2 ? 'maderaOsc' : 'madera', 0, 0.775, -0.19 + t * 0.127, { sinSuelo: true, brillo: 0.8 });
  return deLote(L);
}
// vasija de barro torneada
function vasija(L, x, y, z, alto, r, s) {
  const p = [[0.02, 0], [r * 0.7, 0], [r, alto * 0.35], [r * 0.85, alto * 0.75], [r * 0.5, alto * 0.9], [r * 0.6, alto]].map(([a, b]) => new THREE.Vector2(a, b));
  L.add(new THREE.LatheGeometry(p, 12), 'barro', x, y, z, { y: s }, { sinSuelo: true, brillo: 0.9 + ruido(s) * 0.2 });
}
function estanteria() {
  const L = loteMueble();
  for (const x of [-0.48, 0.48]) L.add(cajaR(0.05, 1.8, 0.35, 0.012), 'maderaOsc', x, 0.9, 0);
  for (const y of [0.1, 0.65, 1.2, 1.75]) tablaX(L, 1.0, 0.04, 0.35, 'tabla', 0, y, 0, { sinSuelo: true, brillo: 0.95 });
  for (let t = 0; t < 5; t++) L.add(cajaR(0.19, 1.7, 0.02, 0.006), t % 2 ? 'maderaOsc' : 'madera', -0.38 + t * 0.19, 0.9, -0.165, null, { brillo: 0.55 }); // trasera de tablas
  // enseres: vasijas, un cuenco, un rollo de paño y un manojo
  vasija(L, -0.25, 0.12, 0.02, 0.3, 0.12, 1); vasija(L, 0.02, 0.12, 0.04, 0.22, 0.09, 2);
  L.add(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'madera', 0.27, 0.78, 0.03, { x: Math.PI }, { sinSuelo: true }); // cuenco
  L.add(cil(0.08, 0.08, 0.42, 12), 'lana', -0.18, 0.75, 0.04, { z: Math.PI / 2 }, { sinSuelo: true }); // rollo de paño
  vasija(L, 0.25, 1.22, 0.0, 0.26, 0.1, 3);
  for (let i = 0; i < 6; i++) L.add(cil(0.01, 0.014, 0.4, 4), 'paja', -0.2 + i * 0.012, 1.24, 0.02 - i * 0.01, { z: Math.PI / 2 - 0.05 + i * 0.02 }, { sinSuelo: true });
  return deLote(L);
}
function antorcha() {
  const L = loteMueble();
  // vara clavada entre piedras, con un cesto de hierro arriba y la estopa (paja) dentro
  L.add(cil(0.03, 0.04, 1.42, 7), 'madera', 0, 0.71, 0);
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; L.add(new THREE.IcosahedronGeometry(1, 0), i % 2 ? 'piedra' : 'piedraOsc', Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12, { y: a }, { escala: new THREE.Vector3(0.09, 0.06, 0.07), plano: true }); }
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; L.add(cil(0.008, 0.008, 0.2, 4), 'hierro', Math.cos(a) * 0.09, 1.48, Math.sin(a) * 0.09, { y: -a, z: 0.35 }, { sinSuelo: true }); }
  for (const [y, r] of [[1.4, 0.06], [1.57, 0.125]]) L.add(new THREE.TorusGeometry(r, 0.01, 4, 12), 'hierro', 0, y, 0, { x: Math.PI / 2 }, { sinSuelo: true });
  relleno(L, 0.17, 0.12, 0.17, 'pajaOsc', 0, 1.5, 0, { rayas: RAYAS_PAJA, brillo: 0.6 });
  const g = deLote(L);
  const llama = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), mat(COLORES.llama, { emissive: COLORES.llama, emissiveIntensity: 1 }));
  llama.position.y = 1.7; llama.name = 'llama'; llama.castShadow = false;
  const nucleo = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), mat(0xffe2a0, { emissive: 0xffe2a0, emissiveIntensity: 1 }));
  nucleo.position.y = 1.64; nucleo.name = 'llama'; nucleo.castShadow = false;
  g.add(llama, nucleo);
  return g;
}
function alfombra() {
  const L = loteMueble();
  // piel curtida con su forma (patas y cuello), el pelo más oscuro por el lomo y mechones por el borde
  const { forma, puntos } = contornoPiel(1.4, 1.0);
  const g = new THREE.ExtrudeGeometry(forma, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  L.add(g, 'piel', 0, 0.004, 0, null, { sinSuelo: true, tex: 'hojas' });
  // el lomo, más oscuro: la misma forma estrecha encima
  const lomo = new THREE.ExtrudeGeometry(contornoPiel(1.15, 0.38).forma, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.03, bevelSegments: 2 });
  lomo.rotateX(-Math.PI / 2);
  L.add(lomo, 0x6a5038, 0, 0.03, 0, null, { sinSuelo: true, tex: 'hojas' });
  pelo(L, puntos, 0.02, 'piel', 5);
  const piel = deLote(L);
  piel.children.forEach(m => m.geometry.rotateY(Math.PI / 2)); // a lo largo de x, como la alfombra de antes
  return piel;
}
function estandarte() {
  const L = loteMueble();
  // asta clavada entre piedras, travesaño atado y el paño colgando en pliegues, acabado en dos puntas, con una banda
  L.add(cil(0.03, 0.042, 2.65, 7), 'madera', 0, 1.325, 0);
  L.add(new THREE.ConeGeometry(0.035, 0.1, 6), 'hierro', 0, 2.7, 0, null, { sinSuelo: true });
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.9; L.add(new THREE.IcosahedronGeometry(1, 0), i % 2 ? 'piedra' : 'piedraOsc', Math.cos(a) * 0.13, 0.04, Math.sin(a) * 0.13, { y: a }, { escala: new THREE.Vector3(0.1, 0.06, 0.08), plano: true }); }
  varaX(L, 0.82, 0.022, 'maderaOsc', 0, 2.48, 0.05);
  lazada(L, 0, 2.48, 0.0, 0.035);
  const n = 7, ancho = 0.7, w = ancho / n, top = 2.46;
  for (let t = 0; t < n; t++) {
    const x = -ancho / 2 + w * (t + 0.5), u = Math.abs(x) / (ancho / 2);
    const largo = 1.0 - 0.22 * (1 - u); // dos puntas: el centro más corto
    const z = 0.06 + Math.sin(t * 1.9) * 0.025, gy = Math.cos(t * 1.9) * 0.25;
    const tela = cajaR(w * 1.04, largo, 0.012, 0.004);
    L.add(tela, 'pano', x, top - largo / 2, z, { y: gy }, { sinSuelo: true, brillo: 0.88 + 0.12 * Math.cos(t * 1.9) });
    L.add(cajaR(w * 1.05, 0.16, 0.014, 0.004), 0xa88a4a, x, top - 0.45, z + Math.cos(gy) * 0.002, { y: gy }, { sinSuelo: true, tex: 'tejido', brillo: 0.88 + 0.12 * Math.cos(t * 1.9) });
  }
  return deLote(L);
}
const MUEBLES = { cama_paja: camaPaja, cama_madera: camaMadera, mesa, banco, taburete, arcon, barril, estanteria, candil: antorcha, alfombra, estandarte };
// ---------- Obras: andamio y polea (GDD, «Obras»), con el estilo v5 ----------
// Andamio pegado al muro: cuatro pies de vara descortezada, largueros atados con cuerda, una plataforma de varas
// juntas (como un zarzo) con su cara de arriba a la altura del suelo de la planta de encima, barandilla por fuera y
// una escalerilla de varas por la cara de fuera. El muro queda hacia +z (la lógica lo gira solo hacia el muro).
function varaZ(L, largo, r, color, x, y, z) { L.add(cil(r, r * 1.08, largo, 6), color, x, y, z, { x: Math.PI / 2 }); }
function andamio() {
  const L = loteSuelo();
  const A = 0.78, tope = ALTURA + P.superficieSuelo, alto = tope + 1.0;
  [[-A, -A], [A, -A], [-A, A], [A, A]].forEach(([x, z], n) => posteVara(L, x, z < 0 ? alto : tope - 0.02, 0.05, 'maderaOsc', z, n + 3));
  // largueros a media altura y bajo la plataforma, por los cuatro lados, atados en cada pie
  for (const y of [1.2, tope - 0.14]) {
    for (const z of [-A, A]) varaX(L, 2 * A + 0.3, 0.032, 'madera', 0, y, z + (z < 0 ? -0.05 : 0.05));
    for (const x of [-A, A]) varaZ(L, 2 * A + 0.3, 0.032, 'madera', x + (x < 0 ? -0.05 : 0.05), y + 0.05, 0);
    for (const x of [-A, A]) for (const z of [-A, A]) lazada(L, x, y, z, 0.05);
  }
  // tornapuntas en cruz por los lados, para que no se ladee
  const dy = tope - 0.35, largoD = Math.hypot(2 * A, dy);
  for (const x of [-A, A]) L.add(cil(0.028, 0.03, largoD, 6), 'madera', x + (x < 0 ? -0.09 : 0.09), 0.2 + dy / 2, 0, { x: (x < 0 ? 1 : -1) * Math.atan2(2 * A, dy) });
  // plataforma: varas juntas a lo largo de X sobre los largueros, con las puntas claras
  const n = 14, paso = (2 * A + 0.1) / n;
  for (let t = 0; t < n; t++) {
    const z = -A - 0.05 + paso * (t + 0.5);
    varaX(L, 2 * A + 0.16, paso * 0.5, ruido(t * 1.7 + 2) > 0.5 ? 'madera' : 'tabla', 0, tope - paso * 0.5, z, (ruido(t + 9) - 0.5) * 0.01);
  }
  // barandilla por fuera (-z) y por los lados, con hueco donde llega la escalerilla
  for (const y of [tope + 0.5, tope + 0.95]) {
    for (const s of [-1, 1]) varaX(L, A - 0.3, 0.028, 'madera', s * (A + 0.3) / 2, y, -A - 0.06);
    for (const x of [-A, A]) varaZ(L, 2 * A, 0.028, 'madera', x + (x < 0 ? -0.06 : 0.06), y, 0);
  }
  // escalerilla de varas por fuera, de la tierra a la plataforma
  const le = tope + 0.9;
  for (const x of [-0.24, 0.24]) L.add(cil(0.034, 0.04, le, 7), x < 0 ? 'madera' : 'maderaOsc', x, le / 2, -A - 0.16);
  let k = 0;
  for (let y = 0.3; y < le - 0.1; y += 0.31) L.add(cil(0.024, 0.026, 0.56, 6), ruido(k++ + 6) > 0.5 ? 'tabla' : 'madera', 0, y, -A - 0.16, { z: Math.PI / 2 });
  for (const x of [-0.24, 0.24]) for (const y of [1.2, tope - 0.14]) lazada(L, x, y, -A - 0.16, 0.036);
  return deLote(L);
}
// Polea simple colgada de una viga (a lo largo de X, en lo alto de la planta como la viga): una gaza de cuerda
// abraza la viga; de ella cuelga un motón de madera (dos quijadas y la roldana con su eje de hierro), y la cuerda
// baja por los dos lados de la roldana, con un gancho de hierro en un extremo.
export const POLEA = { yViga: ALTURA - 0.11, yEje: ALTURA - 0.62, rRoldana: 0.12 };
function polea() {
  const L = loteSuelo();
  const { yViga, yEje, rRoldana: r } = POLEA;
  L.add(new THREE.TorusGeometry(0.16, 0.016, 5, 12), CUERDA, 0, yViga, 0, { y: Math.PI / 2 }, { sinSuelo: true }); // gaza
  for (const x of [-0.03, 0.03]) L.add(cil(0.014, 0.014, yViga - 0.16 - (yEje + 0.2), 5), CUERDA, x, (yViga - 0.16 + yEje + 0.2) / 2, 0, null, { sinSuelo: true });
  for (const x of [-0.055, 0.055]) L.add(cajaR(0.03, 0.42, 0.3, 0.012), 'maderaOsc', x, yEje, 0); // quijadas
  L.add(cil(r, r, 0.05, 12), 'madera', 0, yEje, 0, { z: Math.PI / 2 }); // roldana
  L.add(cil(0.018, 0.018, 0.16, 6), 'hierro', 0, yEje, 0, { z: Math.PI / 2 }); // eje
  L.add(new THREE.TorusGeometry(0.035, 0.012, 5, 8), 'hierro', 0, yEje + 0.24, 0, { y: Math.PI / 2 }, { sinSuelo: true }); // argolla
  // la cuerda baja por los dos lados de la roldana; en un extremo, el gancho
  const largos = [1.1, 0.75];
  [-1, 1].forEach((s, n) => {
    const l = largos[n];
    L.add(cil(0.014, 0.014, l, 5), CUERDA, 0, yEje - l / 2, s * (r + 0.012), null, { sinSuelo: true });
  });
  const yg = yEje - largos[0] - 0.06;
  L.add(cil(0.012, 0.012, 0.14, 5), 'hierro', 0, yg + 0.02, -(r + 0.012));
  L.add(new THREE.TorusGeometry(0.045, 0.012, 5, 8, Math.PI * 1.3), 'hierro', 0, yg - 0.06, -(r + 0.012) + 0.03, { y: Math.PI / 2, z: Math.PI * 0.85 }, { sinSuelo: true });
  return deLote(L);
}

export function decoracion(tipo) {
  const g = MUEBLES[tipo] ? MUEBLES[tipo]() : new THREE.Group();
  g.traverse(o => { if (o.isMesh && o.name !== 'llama') { o.castShadow = true; o.receiveShadow = true; } });
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
    case 'andamio': return andamio();
    case 'polea': return polea();
    case 'puerta_varas': return puerta('puerta_varas');
    case 'puerta_tabla': return puerta('puerta_tabla');
    case 'cerca': return cerca();
    case 'cerca_portillo': return portillo();
    case 'empalizada': return empalizada();
    case 'empalizada_puerta': return empalizada({ porton: true });
  }
  return new THREE.Group();
}

// (Los árboles y las rocas del entorno están en src/mundo/decorado.js, con el estilo v5.)

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

// ---------- Subir un tronco rodándolo por dos varas con una cuerda (GDD, «Obras») ----------
// Dos varas descortezadas apoyadas en el borde de la planta de la obra: van a lo largo de +z, desde el pie (z = 0,
// en el suelo) hasta la cabeza (z = largo·cos, a la altura «alto»). Se ve mientras se sube algo pesado.
export function rampaVaras(alto) {
  const L = loteSuelo();
  const ang = Math.atan2(alto, alto * 0.85), largo = Math.hypot(alto, alto * 0.85) + 0.35;
  const base = new THREE.Matrix4().makeRotationX(Math.PI / 2 - ang);
  for (const x of [-0.55, 0.55]) addM(L, cil(0.045, 0.055, largo, 7), x < 0 ? 'madera' : 'maderaOsc', mParte(base, x, largo / 2, 0));
  return deLote(L);
}
// El tronco que se rueda: tumbado a lo largo de X, con las testas claras
export function troncoSuelto(largo = 1.7, r = P.radioTronco) {
  const L = loteSuelo();
  troncoTumbado(L, largo, 0, 0, 0, r, 'corteza');
  return deLote(L);
}
