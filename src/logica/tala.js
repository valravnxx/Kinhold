// Talar los árboles del mundo (documento de sistemas, apartado 3, «De los árboles»). Lógica pura (sin three.js ni
// navegador): el servidor podrá usarla tal cual.
//
// Lo que dice el documento:
//   Talar un árbol joven  — hacha de piedra o hierro                  — 1 tronco delgado + varas (G)
//   Talar un árbol adulto — hacha de hierro (con piedra tarda mucho)  — 1 tronco largo + muchas ramas; queda tocón (E)
// Y la tarea del roadmap: el árbol cae, queda el tocón y vuelve a crecer en semanas reales, contado por tiempo
// transcurrido (se guarda la hora a la que vuelve, no un contador que corra solo mientras se juega).
//
// Cada golpe de hacha es una acción con autor. Cuando el árbol lleva los golpes que pide, cae y deja en el suelo, a lo largo de donde cae, el tronco y lo menudo: varas el joven (revisión del 1 nov:
// «el joven, con hacha de piedra, da tronco delgado y varas»; el tronco delgado es la madera de la casa humilde) y
// ramas el adulto (src/logica/suelo.js: los troncos se quedan como pila; lo menudo, como lo demás que hay en el suelo).
//
// Decisiones provisionales (el documento no las fija; anotadas en el registro de decisiones y en el diario):
//  - Joven o adulto sale del tamaño del árbol en el mundo: menos de 1,1 veces el tamaño de modelo, joven.
//  - Golpes: joven, 8 con piedra y 5 con hierro; adulto, 14 con hierro y 56 con piedra (cuatro veces más: «tarda
//    mucho»). Entre golpe y golpe del mismo autor, 0,8 s como poco (lo que dura el gesto).
//  - El hacha de mano (cabeza de hierro) tala como el hacha de hierro.
//  - Lo menudo: el joven da 2–4 varas (antes, 2–4 ramas: 7 nov, las varas que pide el documento) y el adulto 6–9
//    ramas, de un azar fijo por árbol y por vez.
//  - Los dos dejan tocón. Vuelve a crecer: el joven en 3 semanas reales y el adulto en 6.
//  - Se tala a 1,8 m del centro del tronco como mucho, con el hacha en una mano (en cualquiera de las dos).
//  - Lo que llevan dado los golpes se queda en el árbol (la muesca no se cierra) hasta que cae.
//
// Hacia dónde cae (GDD, apartado 6, y revisión del 1 nov: «gira sobre el tocón hacia la boca que se le corta; si no la
// tiene, hacia donde se inclina o cuesta abajo»). Como al talar con hacha de verdad: primero se abre la boca (la
// muesca) en el lado hacia el que tiene que caer, y luego se corta por detrás hasta que se vence hacia ella.
// Decisiones provisionales (el GDD no fija los números):
//  - La boca la abren los golpes del primer tercio del árbol (PARTE_BOCA), hacia donde está el que los da, sea quien sea.
//  - Si esos golpes vienen de un mismo lado (la media de sus direcciones, COHERENCIA_BOCA, de 0,7 o más: más o menos,
//    todos dentro de un cuarto de vuelta), hay boca y el árbol cae hacia ella, aunque el resto se corte desde
//    cualquier sitio. Quien corta solo desde la boca se lo echa encima (el crujido de aviso y el daño, con su tarea).
//  - Sin boca (golpes de lados opuestos, dos que talan enfrentados): cuesta abajo si el suelo baja un 12 % o más
//    (PENDIENTE_CAIDA, medido a 1,5 m a cada lado del tronco); en llano, hacia donde se inclina el árbol: un lado fijo
//    por árbol, de su nombre (inclinacionDe), el mismo en el navegador y en el servidor.
//
// Y lo que da el árbol en pie (tarea «Origen de la piel, el mimbre, la resina y la corteza», 8 nov; documento de
// sistemas, apartado 3):
//   Corteza — árbol en pie o tronco — cuchillo, hacha — descortezar — 1–2 corteza (M) — «—» (una vez)
//   Resina  — coníferas en pie      — cuchillo        — sangrar (tarda horas reales) — 1 resina (P) — repetible
// Decisiones provisionales (en el registro y en el diario):
//  - Se descorteza el árbol en pie (no el tronco del suelo): una vez por árbol, hasta que se tala y vuelve a crecer.
//    Basta con llevar encima la herramienta (la lasca de sílex vale de cuchillo), como los juncos.
//  - Coníferas: el abeto y el pino. Sangrar es hacerle un corte; a las 4 h reales la resina está lista y se coge con
//    la mano (1); al cogerla, el corte vuelve a sangrar y a las 4 h hay otra. Un árbol a medio sangrar no cambia nada
//    al talarlo (se pierde lo que tenía).
//  - A 1,8 m del tronco como mucho (como al talar).
import { CATALOGO } from './inventario.js';
import { gastar } from './desgaste.js';

const DIA = 24 * 3600 * 1000;
export const SEMANA = 7 * DIA;
export const ALCANCE_TALA = 1.8;        // m, desde el centro del tronco
export const ENTRE_GOLPES = 800;        // ms
export const ESCALA_ADULTO = 1.1;       // desde este tamaño del modelo, el árbol es adulto
export const HACHAS = { hacha_piedra: 'piedra', hacha_hierro: 'hierro', hacha_mano: 'hierro' };
export const GOLPES = { joven: { piedra: 8, hierro: 5 }, adulto: { piedra: 56, hierro: 14 } };
export const DA = {
  joven: { tronco: 'tronco_delgado', menudo: 'vara', ramas: [2, 4], largo: 2.6, vuelve: 3 * SEMANA },
  adulto: { tronco: 'tronco_largo', menudo: 'rama', ramas: [6, 9], largo: 4.5, vuelve: 6 * SEMANA },
};
export const DESCORTEZAR_CON = ['lasca_silex', 'cuchillo', 'hacha_piedra', 'hacha_hierro', 'hacha_mano'];
export const SANGRAR_CON = ['lasca_silex', 'cuchillo'];
export const CORTEZA = [1, 2];
export const CONIFERAS = new Set(['abeto', 'pino']);
export const RESINA_TARDA = 4 * 3600 * 1000;   // ms (4 h reales)
export const PARTE_BOCA = 1 / 3;         // la boca, el primer tercio de los golpes
export const COHERENCIA_BOCA = 0.7;     // de 0 (golpes de todos lados) a 1 (todos del mismo)
export const PENDIENTE_CAIDA = 0.12;    // desde esta cuesta, sin boca, cae cuesta abajo
const PASO_CUESTA = 1.5;                // m a cada lado del tronco para medir la cuesta
export const edadDeEscala = s => (s >= ESCALA_ADULTO ? 'adulto' : 'joven');
// El nombre fijo de un árbol: su sitio en el mundo (el mismo en el navegador y en el servidor con la misma semilla).
export const idArbol = (x, z) => `arbol:${Math.round(x * 10)},${Math.round(z * 10)}`;

function hash(...ns) {
  let h = 2166136261 >>> 0;
  for (const n of ns) { h ^= n >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
const numTexto = t => { let h = 0; for (const ch of t) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0; return h; };
const redondo = v => Math.round(v * 100) / 100;

// Cuánto menudo (varas el joven, ramas el adulto) da el árbol la vez «vez» (0, 1, 2…).
export function ramasDe(arbol, vez) {
  const [a, b] = DA[arbol.edad].ramas;
  return a + Math.floor(hash(numTexto(arbol.id), vez, 3) * (b - a + 1));
}
// Hacia dónde se inclina el árbol (en radianes, como dir): fijo por árbol, de su nombre.
export const inclinacionDe = arbol => redondo(hash(numTexto(arbol.id), 7) * 2 * Math.PI - Math.PI);
// La boca que llevan abierta los golpes de e: { dir } si la hay (ya abierta y de un lado), o null.
export function bocaDe(e) {
  if (!e || !(e.bp >= PARTE_BOCA - 1e-9)) return null;
  const n = Math.hypot(e.bx || 0, e.bz || 0);
  return n / e.bp >= COHERENCIA_BOCA ? { dir: redondo(Math.atan2(e.bx, e.bz)) } : null;
}
// Hacia dónde cae el árbol a con lo que lleva cortado e: { dir, por: 'boca' | 'cuesta' | 'inclinacion' }.
// alturaEn(x, z): la altura del suelo (o null si no se conoce el terreno: entonces, sin cuesta).
export function caidaDe(a, e, alturaEn = null) {
  const b = bocaDe(e);
  if (b) return { dir: b.dir, por: 'boca' };
  if (alturaEn) {
    const h = PASO_CUESTA, gx = (alturaEn(a.x + h, a.z) - alturaEn(a.x - h, a.z)) / (2 * h), gz = (alturaEn(a.x, a.z + h) - alturaEn(a.x, a.z - h)) / (2 * h);
    if (Number.isFinite(gx) && Number.isFinite(gz) && Math.hypot(gx, gz) >= PENDIENTE_CAIDA) return { dir: redondo(Math.atan2(-gx, -gz)), por: 'cuesta' };
  }
  return { dir: inclinacionDe(a), por: 'inclinacion' };
}

// La caída (tarea «La caída», 12 nov; GDD apartado 6): el árbol gira sobre el tocón como una vara rígida que se vence
// con la gravedad (θ'' = 3g/2L · sen θ: cada vez más deprisa), choca con el suelo, rebota un poco y se asienta según
// el terreno (cuesta abajo se tumba más, cuesta arriba menos); si da con otro árbol o una obra por el medio, se queda
// apoyado en ella, y si la coge de refilón, se desvía hacia el otro lado y sigue cayendo. Sale solo de lo que hay:
// la dirección, el árbol, el terreno y lo de alrededor. La calcula quien valida (el servidor) y manda los fotogramas,
// así todos la ven igual. Decisiones provisionales (el GDD no fija los números; en el registro y en el diario):
//  - El alto del árbol, el de su modelo (ALTO_ARBOL, los mismos que src/mundo/especies.js, por su tamaño); se parte a
//    CORTE m del suelo. La copa lo sostiene algo por encima del suelo (hasta 0,5 m en la punta).
//  - Rebote: REBOTE de la velocidad; se asienta cuando ya va a menos de 0,25 rad/s.
//  - Lo de alrededor: los troncos de los árboles en pie y las piezas de las obras (un círculo de 1 m por casilla, del
//    alto de sus plantas). Lo coge de lleno si pasa a menos de la mitad de lo que se tocan: se queda apoyado. Si no,
//    de refilón: se desvía DESVIO hacia el otro lado y sigue con la mitad de la velocidad (dos veces como mucho).
//  - Los fotogramas, cada 1/30 s; 8 s como mucho.
export const G = 9.81;
export const CORTE = 0.3;               // m: a esta altura se parte (encima del tocón)
export const REBOTE = 0.22;
export const DESVIO = 0.4;              // rad
export const INICIO_CAIDA = 0.1;      // rad: lo que ya se ha vencido cuando el último golpe lo suelta
const PASO_SIM = 1 / 240, PASO_FOTO = 1 / 30, MAX_CAIDA = 8;
export const ALTO_ARBOL = { abeto: 10.5, pino: 9.5, abedul: 9, roble: 7.5, haya: 10.8, fresno: 9.2, encina: 5.5 };
export const ALTO_JOVEN = 4;            // el modelo del joven, a escala 1
export const RADIO_ARBOL = { abeto: 0.3, pino: 0.27, abedul: 0.15, roble: 0.52, haya: 0.36, fresno: 0.27, encina: 0.34 };
export const RADIO_JOVEN = { abeto: 0.075, pino: 0.07, abedul: 0.05, roble: 0.08, haya: 0.07, fresno: 0.065, encina: 0.075 };
// el alto (m) y el radio del tronco de un árbol con su edad, especie y tamaño (tam: la escala de su modelo)
export const altoArbol = (edad, especie, tam = 1) => redondo((edad === 'joven' ? ALTO_JOVEN : ALTO_ARBOL[especie] || 9) * (Number.isFinite(tam) && tam > 0 ? tam : 1));
export const radioArbol = (edad, especie, tam = 1) => redondo((edad === 'joven' ? RADIO_JOVEN : RADIO_ARBOL)[especie] * tam || (edad === 'joven' ? 0.07 : 0.3));
const altoDe = a => (Number.isFinite(a.alto) && a.alto > 1 ? a.alto : a.edad === 'joven' ? ALTO_JOVEN : 9);

// El primer ángulo (desde la vertical) al que el árbol, cayendo hacia dir, toca el suelo.
function anguloSuelo(a, dir, L, yp, alturaEn) {
  const sx = Math.sin(dir), sz = Math.cos(dir);
  for (let th = 0.3; th < 2.6; th += 0.004) {
    for (let r = 1; r <= L + 1e-9; r += Math.max(0.5, L / 16)) {
      const d = r * Math.sin(th), y = yp + r * Math.cos(th), h = alturaEn ? alturaEn(a.x + sx * d, a.z + sz * d) : 0;
      if (y - (Number.isFinite(h) ? h : 0) <= 0.12 + 0.38 * (r / L)) return th;
    }
  }
  return 2.6;
}
// Lo primero de alrededor con lo que da cayendo hacia dir (antes que el suelo, a menos de thSuelo): { th, o, de: 'lleno' |
// 'refilon', lado } o null. o: { id, tipo: 'arbol' | 'obra', x, z, r, arriba } (arriba: la altura de lo más alto).
function primerChoque(a, dir, L, yp, thSuelo, obstaculos, rPropio, fuera) {
  const sx = Math.sin(dir), sz = Math.cos(dir), cx = Math.cos(dir), cz = -Math.sin(dir);
  let mejor = null;
  for (const o of obstaculos) {
    if (o.id === a.id || fuera.has(o.id)) continue;
    const dx = o.x - a.x, dz = o.z - a.z, d = dx * sx + dz * sz, l = dx * cx + dz * cz, toca = o.r + rPropio;
    if (d <= 0.2 || d > L || Math.abs(l) >= toca) continue;
    const alto = o.arriba - yp;
    if (alto <= 0) continue;
    const th = Math.max(Math.asin(Math.min(1, d / L)), Math.atan2(d, alto));
    if (th >= thSuelo || (mejor && th >= mejor.th)) continue;
    mejor = { th, o, de: Math.abs(l) <= toca / 2 ? 'lleno' : 'refilon', lado: l >= 0 ? 1 : -1 };
  }
  return mejor;
}
// La caída del árbol a, que empieza hacia dir: { fotos: [[t, ángulo, dir], …], dir, angulo, apoyo: null | { tipo, id },
// dura } (ángulo desde la vertical, en radianes; t en s). alturaEn(x, z): el suelo (o null: llano a 0).
// obstaculos: lo de alrededor (ver primerChoque).
export function simularCaida(a, dir, { alturaEn = null, obstaculos = [] } = {}) {
  const base = alturaEn ? alturaEn(a.x, a.z) : 0, yp = (Number.isFinite(base) ? base : 0) + CORTE;
  const L = Math.max(1, altoDe(a) - CORTE), k = 3 * G / (2 * L), rPropio = radioArbol(a.edad, a.especie, a.tam) + 0.1;
  const fotos = [], fuera = new Set();
  let th = INICIO_CAIDA, w = 0, t = 0, sigFoto = 0, desvios = 0, apoyo = null;
  let thS = anguloSuelo(a, dir, L, yp, alturaEn), ch = primerChoque(a, dir, L, yp, thS, obstaculos, rPropio, fuera);
  const foto = () => fotos.push([redondo3(t), redondo3(th), redondo3(dir)]);
  foto();
  while (t < MAX_CAIDA) {
    w += k * Math.sin(th) * PASO_SIM; th += w * PASO_SIM; t += PASO_SIM;
    if (ch && th >= ch.th) {
      th = ch.th;
      if (ch.de === 'lleno' || desvios >= 2) { apoyo = { tipo: ch.o.tipo, id: ch.o.id }; foto(); break; }
      // de refilón: se va hacia el otro lado y sigue, más despacio
      desvios++; fuera.add(ch.o.id); dir = redondo(dir - ch.lado * DESVIO); w *= 0.5;
      thS = anguloSuelo(a, dir, L, yp, alturaEn); ch = primerChoque(a, dir, L, yp, thS, obstaculos, rPropio, fuera);
      if (th >= thS) { th = thS; foto(); break; }
      foto(); sigFoto = t + PASO_FOTO; continue;
    }
    if (th >= thS) {   // el suelo: rebota un poco, hasta que se asienta
      th = thS;
      if (Math.abs(w) < 0.25) { foto(); break; }
      w = -w * REBOTE; foto(); sigFoto = t + PASO_FOTO; continue;
    }
    if (t >= sigFoto) { foto(); sigFoto = t + PASO_FOTO; }
  }
  if (fotos[fotos.length - 1][0] !== redondo3(t)) foto();
  return { fotos, dir: redondo(dir), angulo: redondo3(th), apoyo, dura: redondo3(t) };
}
const redondo3 = v => Math.round(v * 1000) / 1000;
// El ángulo y la dirección de la caída c (simularCaida) en el momento t (s): { angulo, dir }.
export function caidaEn(c, t) {
  const f = c && c.fotos;
  if (!Array.isArray(f) || !f.length) return { angulo: 0, dir: 0 };
  if (t <= f[0][0]) return { angulo: f[0][1], dir: f[0][2] };
  for (let i = 1; i < f.length; i++) {
    if (t <= f[i][0]) {
      const [t0, a0, d0] = f[i - 1], [t1, a1, d1] = f[i], u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
      return { angulo: a0 + (a1 - a0) * u, dir: d0 + (d1 - d0) * u };
    }
  }
  const u = f[f.length - 1]; return { angulo: u[1], dir: u[2] };
}

// El hacha que lleva en las manos el inventario inv (la de la derecha primero): { ruta, tipo, clase } o null.
// El crujido de aviso y el daño (tarea «Crujido de aviso y daño», 12 nov; GDD apartado 6: «con un crujido de aviso, y
// hiere a quien esté debajo»). Decisiones provisionales (el GDD no fija los números; en el registro y en el diario):
//  - Cruje cuando le quedan AVISO_GOLPES golpes o menos (y al soltarse, al empezar a caer): lo oyen todos los de alrededor,
//    y la caída empieza despacio (desde INICIO_CAIDA), así hay tiempo de apartarse.
//  - Hiere a quien está debajo cuando el tronco le llega: el árbol, girando como dice su caída, baja a menos de
//    ALTO_PERSONA del suelo donde está, a lo ancho de esa parte. Lo mira quien valida (el servidor) con dónde está cada
//    uno en ese momento: el que se ha apartado a tiempo, se libra. Hiere a todos, también al que lo tala y al compañero.
//  - Según la parte: el tronco (hasta PARTE_COPA de su largo) da de lleno, contundente (adulto, muy grave; joven,
//    grave), en la cabeza si le coge de pleno y en un hombro (brazo) si de lado; la copa, ramas (adulto, grave; joven,
//    leve), en el torso. Lo que lleva puesto lo frena como cualquier golpe contundente.
export const AVISO_GOLPES = 2;
export const ALTO_PERSONA = 1.75;       // m
export const PARTE_COPA = 0.55;         // del largo del árbol: desde aquí, la copa
const ANCHO_PERSONA = 0.3;              // m, de medio cuerpo
export const COPA_ANCHO = { joven: 0.9, adulto: 1.8 };   // m, la mitad de lo ancho de la copa
export const DANO_CAIDA = { tronco: { joven: 0.55, adulto: 0.95 }, copa: { joven: 0.2, adulto: 0.5 } };
// ¿Le da el árbol a que cae con la caída c a quien está en (x, z), hasta el segundo t de la caída? null, o
// { t (cuándo le llega), parte: 'tronco' | 'copa', zona, sev, tipo: 'contundente' }. alturaEn: el suelo (o null: llano).
export function golpeDeCaida(a, c, x, z, t = Infinity, alturaEn = null) {
  const f = c && Array.isArray(c.fotos) ? c.fotos : null;
  if (!f || !f.length || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const suelo = (px, pz) => { const h = alturaEn ? alturaEn(px, pz) : 0; return Number.isFinite(h) ? h : 0; };
  const yp = suelo(a.x, a.z) + CORTE, L = Math.max(1, altoDe(a) - CORTE), cabeza = suelo(x, z) + ALTO_PERSONA;
  const rT = radioArbol(a.edad, a.especie, a.tam), edad = a.edad === 'adulto' ? 'adulto' : 'joven';
  const dx = x - a.x, dz = z - a.z;
  for (const [tf, ang, dir] of f) {
    if (tf > t) break;
    if (!(ang > 1e-3)) continue;
    const d = dx * Math.sin(dir) + dz * Math.cos(dir), l = dx * Math.cos(dir) - dz * Math.sin(dir);
    if (d <= rT) continue;                              // detrás del tocón o pegado a él: no le cae encima
    const r = d / Math.sin(ang);
    if (r > L) continue;                                // más allá de la punta
    if (yp + r * Math.cos(ang) > cabeza) continue;      // aún le pasa por encima
    const parte = r / L < PARTE_COPA ? 'tronco' : 'copa', ancho = (parte === 'tronco' ? rT : COPA_ANCHO[edad]) + ANCHO_PERSONA;
    if (Math.abs(l) > ancho) continue;
    const zona = parte === 'copa' ? 'torso' : Math.abs(l) <= rT + 0.15 ? 'cabeza' : l >= 0 ? 'brazoD' : 'brazoI';
    return { t: tf, parte, zona, sev: DANO_CAIDA[parte][edad], tipo: 'contundente' };
  }
  return null;
}
// A quiénes de personas ([{ autor, x, z }]) les llegaría la caída c (con dónde están ahora): [{ autor, t, parte, … }],
// por orden de cuándo les llega. El servidor vuelve a mirarlo con golpeDeCaida en ese momento (por si se apartan).
export function bajoLaCaida(a, c, personas, alturaEn = null) {
  const r = [];
  for (const p of personas || []) { const g = p && golpeDeCaida(a, c, p.x, p.z, Infinity, alturaEn); if (g) r.push({ autor: p.autor, ...g }); }
  return r.sort((u, v) => u.t - v.t);
}

export function hachaEnMano(inv) {
  for (const ruta of ['mano:der', 'mano:izq']) {
    const c = inv.lugares[ruta];
    if (c && HACHAS[c.tipo]) return { ruta, tipo: c.tipo, clase: HACHAS[c.tipo] };
  }
  return null;
}

export const VERSION_TALA = 1;
// arboles: [{ id, x, z, edad: 'joven' | 'adulto' }]
export class Tala {
  constructor(arboles) {
    this.arboles = arboles;
    this.porId = new Map(arboles.map(a => [a.id, a]));
    this.estado = {};       // id → { golpes, parte, veces, bx, bz, bp, caido?, vuelve?, dir? }  (dir: hacia dónde cayó, en
                            // radianes; bx, bz: la suma de las direcciones de los golpes de la boca, y bp, su parte)
    this.ultimoGolpe = {};  // autor → ms (no se guarda: solo frena los golpes demasiado seguidos)
    this.entre = ENTRE_GOLPES; // ms entre golpe y golpe del mismo autor (el servidor pide menos: la red los junta)
    this.alturaEn = null;      // (x, z) → altura del suelo, para la cuesta (el servidor le pone la de su terreno)
    this.obstaculosEn = null;  // (x, z, r) → lo de alrededor para la caída (árboles { id, x, z, edad, especie, alto } y
                               // obras { id, tipo: 'obra', x, z, r, arriba }); sin él, los árboles que conoce
  }
  // Los árboles van llegando y yéndose según por dónde anda el jugador (src/mundo/vegetacion_mundo.js): lo guardado de
  // cada uno se queda aunque no esté cargado y vale en cuanto vuelve a llegar.
  anadir(arboles) {
    for (const a of arboles) if (!this.porId.has(a.id)) { this.porId.set(a.id, a); this.arboles.push(a); }
  }
  quitar(ids) {
    const fuera = new Set(ids); if (!fuera.size) return;
    for (const id of fuera) this.porId.delete(id);
    this.arboles = this.arboles.filter(a => !fuera.has(a.id));
  }
  // ¿Está en pie? (no talado, o ya ha vuelto a crecer)
  enPie(id, ahora) { const e = this.estado[id]; return this.porId.has(id) && (!e || !e.vuelve || ahora >= e.vuelve); }
  // Los tocones de ahora: [{ arbol, caido, vuelve, dir }]
  tocones(ahora) {
    const r = [];
    for (const [id, e] of Object.entries(this.estado)) if (e.vuelve && ahora < e.vuelve && this.porId.has(id)) r.push({ arbol: this.porId.get(id), caido: e.caido, vuelve: e.vuelve, dir: e.dir });
    return r;
  }
  // Lo de alrededor del árbol a con lo que puede dar al caer (simularCaida): los troncos de los árboles en pie (los que
  // conoce, o los de obstaculosEn: el servidor le pone los de su terreno y las obras) a lo que alcanza su alto.
  alrededor(a, ahora) {
    const R = altoDe(a) + 1.5, suelo = (x, z) => { const h = this.alturaEn ? this.alturaEn(x, z) : 0; return Number.isFinite(h) ? h : 0; };
    const lista = this.obstaculosEn ? this.obstaculosEn(a.x, a.z, R) || [] : this.arboles.filter(b => Math.hypot(b.x - a.x, b.z - a.z) <= R);
    const r = [];
    for (const o of lista) {
      if (o.tipo === 'obra') { r.push(o); continue; }
      if (o.id === a.id || (this.estado[o.id] && this.estado[o.id].vuelve > ahora)) continue;   // ni él ni los tocones
      r.push({ id: o.id, tipo: 'arbol', x: o.x, z: o.z, r: radioArbol(o.edad, o.especie, o.tam), arriba: suelo(o.x, o.z) + altoDe(o) });
    }
    return r;
  }
  golpesPara(id, clase) { const a = this.porId.get(id); return a ? GOLPES[a.edad][clase] : 0; }
  // Lo que lleva dado (en fracción, de 0 a 1, con la clase de hacha de ahora; los golpes de otra hacha cuentan por su
  // parte: un golpe de piedra en un adulto es 1/56 del árbol).
  progreso(id) { const e = this.estado[id]; return e && !e.vuelve ? Math.min(1, e.parte || 0) : 0; }

  // Un golpe al árbol id con el inventario inv, estando en (x, z). Si cae, devuelve lo que deja en el suelo.
  golpe(inv, id, x, z, ahora, autor) {
    const a = this.porId.get(id);
    if (!a) return { ok: false, motivo: 'Ahí no hay ningún árbol.' };
    if (!this.enPie(id, ahora)) return { ok: false, motivo: 'Ese árbol ya está talado: solo queda el tocón.' };
    if (Math.hypot(a.x - x, a.z - z) > ALCANCE_TALA) return { ok: false, motivo: 'Está demasiado lejos.' };
    const h = hachaEnMano(inv);
    if (!h) return { ok: false, motivo: 'Necesitas un hacha en la mano para talar.' };
    const ult = this.ultimoGolpe[autor];
    if (ult !== undefined && ahora - ult < this.entre) return { ok: false, motivo: 'Aún no has terminado el golpe anterior.' };
    this.ultimoGolpe[autor] = ahora;
    let e = this.estado[id];
    if (!e || e.vuelve) e = this.estado[id] = { golpes: 0, parte: 0, veces: e ? e.veces : 0 };
    const total = GOLPES[a.edad][h.clase], antes = e.parte || 0;
    // lo que este golpe abre de la boca, hacia donde está el que lo da
    const enBoca = Math.max(0, Math.min(1 / total, PARTE_BOCA - (e.bp || 0)));
    if (enBoca > 0) {
      const lado = Math.atan2(x - a.x, z - a.z);
      e.bx = (e.bx || 0) + Math.sin(lado) * enBoca; e.bz = (e.bz || 0) + Math.cos(lado) * enBoca; e.bp = (e.bp || 0) + enBoca;
    }
    e.golpes++; e.parte = antes + 1 / total;
    // cada golpe gasta el hacha (documento de sistemas, apartado 10; src/logica/desgaste.js): al acabarse, se rompe
    const g = gastar(inv, h.ruta), gasto = g ? { desgaste: { usado: g.usado, vida: g.vida }, ...(g.roto ? { seRompe: h.tipo } : {}) } : {};
    if (e.parte < 1 - 1e-9) {
      const r = { ok: true, cae: false, golpes: e.golpes, faltan: Math.max(1, Math.round((1 - e.parte) * total)), hacha: h.tipo, ...gasto };
      if (r.faltan <= AVISO_GOLPES) r.cruje = true;   // el crujido de aviso: está a punto de caer
      // el golpe que termina la boca dice si la hay (y hacia dónde caerá) o si los golpes no la han hecho de un lado
      if (enBoca > 0 && e.bp >= PARTE_BOCA - 1e-9) { const b = bocaDe(e); r.boca = b ? b.dir : null; }
      return r;
    }
    const { dir: hacia, por } = caidaDe(a, e, this.alturaEn), d = DA[a.edad], ramas = ramasDe(a, e.veces || 0);
    // cómo cae (y dónde se asienta: el desvío cambia hacia dónde), con lo que tiene alrededor
    const caida = simularCaida(a, hacia, { alturaEn: this.alturaEn, obstaculos: this.alrededor(a, ahora) }), dir = caida.dir;
    const sx = Math.sin(dir), sz = Math.cos(dir), en = t => ({ x: redondo(a.x + sx * t), z: redondo(a.z + sz * t) });
    const deja = [{ tipo: d.tronco, n: 1, ...en(d.largo * 0.5 + 0.7) }, { tipo: d.menudo, n: ramas, ...en(d.largo + 1.1) }];
    this.estado[id] = { golpes: 0, parte: 0, veces: (e.veces || 0) + 1, caido: ahora, vuelve: ahora + d.vuelve, dir: redondo(dir) };  // sin boca: la siguiente vez, otra
    // hacia: hacia dónde empieza a caer (la boca, la cuesta o su inclinación); dir: hacia dónde queda (tras desviarse)
    return { ok: true, cae: true, golpes: e.golpes, faltan: 0, hacha: h.tipo, hacia: redondo(hacia), dir: redondo(dir), por, deja, vuelve: ahora + d.vuelve, caida, ...gasto };
  }

  // Lo que se le puede hacer al árbol id en pie: { descortezar, sangrar, resina: 'lista' | 'sangrando' | null }.
  usos(id, ahora) {
    const a = this.porId.get(id), e = this.estado[id] || {};
    if (!a || !this.enPie(id, ahora)) return { descortezar: false, sangrar: false, resina: null };
    const conifera = CONIFERAS.has(a.especie);
    const resina = !conifera || !e.resina ? null : ahora >= e.resina ? 'lista' : 'sangrando';
    return { descortezar: !e.desc, sangrar: conifera && !e.resina, resina };
  }
  // Descortezar el árbol id en pie estando en (x, z): de 1 a 2 cortezas a lo que llevas.
  descortezar(inv, id, x, z, ahora) {
    const a = this.porId.get(id);
    if (!a) return { ok: false, motivo: 'Ahí no hay ningún árbol.' };
    if (!this.enPie(id, ahora)) return { ok: false, motivo: 'Ese árbol ya está talado: solo queda el tocón.' };
    if (Math.hypot(a.x - x, a.z - z) > ALCANCE_TALA) return { ok: false, motivo: 'Está demasiado lejos.' };
    if (!DESCORTEZAR_CON.some(t => inv.cuantos(t) > 0)) return { ok: false, motivo: 'Necesitas un cuchillo, una lasca de sílex o un hacha para descortezarlo.' };
    const e = this.estado[id] || {};
    if (e.desc) return { ok: false, motivo: 'Ese árbol ya está descortezado.' };
    const n = CORTEZA[0] + Math.floor(hash(numTexto(a.id), e.veces || 0, 17) * (CORTEZA[1] - CORTEZA[0] + 1));
    const r = inv.meterDonde('corteza', n);
    if (!r.ok) return r;
    this.estado[id] = { ...e, golpes: e.golpes || 0, parte: e.parte || 0, veces: e.veces || 0, desc: true };
    return { ok: true, objeto: 'corteza', cantidad: n, donde: r.donde };
  }
  // Sangrar una conífera (hacerle el corte) o, si ya está lista, coger su resina (y vuelve a sangrar).
  sangrar(inv, id, x, z, ahora) {
    const a = this.porId.get(id);
    if (!a) return { ok: false, motivo: 'Ahí no hay ningún árbol.' };
    if (!this.enPie(id, ahora)) return { ok: false, motivo: 'Ese árbol ya está talado: solo queda el tocón.' };
    if (!CONIFERAS.has(a.especie)) return { ok: false, motivo: 'Solo los pinos y los abetos dan resina.' };
    if (Math.hypot(a.x - x, a.z - z) > ALCANCE_TALA) return { ok: false, motivo: 'Está demasiado lejos.' };
    const e = this.estado[id] || {};
    const base = { ...e, golpes: e.golpes || 0, parte: e.parte || 0, veces: e.veces || 0 };
    if (e.resina && ahora < e.resina) return { ok: false, motivo: 'La resina aún no ha salido: tarda unas horas.', lista: e.resina };
    if (e.resina) {   // lista: se coge con la mano
      const r = inv.meterDonde('resina', 1);
      if (!r.ok) return r;
      this.estado[id] = { ...base, resina: ahora + RESINA_TARDA };
      return { ok: true, objeto: 'resina', cantidad: 1, donde: r.donde, lista: this.estado[id].resina };
    }
    if (!SANGRAR_CON.some(t => inv.cuantos(t) > 0)) return { ok: false, motivo: 'Necesitas un cuchillo o una lasca de sílex para sangrarlo.' };
    this.estado[id] = { ...base, resina: ahora + RESINA_TARDA };
    return { ok: true, objeto: null, cantidad: 0, lista: this.estado[id].resina };
  }

  exportar() { return { version: VERSION_TALA, estado: Object.fromEntries(Object.entries(this.estado).map(([k, v]) => [k, { ...v }])) }; }
  // Lo guardado de árboles que aún no están cargados se queda (llegan al acercarse el jugador); lo que no tiene forma
  // de árbol (el id) se descarta.
  importar(datos) {
    const d = migrarTala(datos);
    this.estado = {};
    if (!d) return this;
    const num = v => Number.isFinite(v);
    for (const [id, e] of Object.entries(d.estado)) {
      if (!/^arbol:-?\d+,-?\d+$/.test(id) || !e || typeof e !== 'object') continue;
      const x = { golpes: Number.isInteger(e.golpes) && e.golpes > 0 ? e.golpes : 0, parte: num(e.parte) ? Math.min(1, Math.max(0, e.parte)) : 0,
        veces: Number.isInteger(e.veces) && e.veces > 0 ? e.veces : 0 };
      // la boca (guardada desde el 7 nov; lo de antes, sin ella: cae por la cuesta o por su inclinación)
      if (num(e.bp) && e.bp > 0 && num(e.bx) && num(e.bz)) { x.bp = Math.min(PARTE_BOCA, e.bp); x.bx = e.bx; x.bz = e.bz; }
      if (e.desc === true) x.desc = true;            // descortezado (8 nov)
      if (num(e.resina) && e.resina > 0) x.resina = e.resina;   // sangrando: cuándo está lista su resina
      if (num(e.vuelve)) { Object.assign(x, { caido: num(e.caido) ? e.caido : e.vuelve, vuelve: e.vuelve, dir: num(e.dir) ? e.dir : 0, golpes: 0, parte: 0 }); delete x.bx; delete x.bz; delete x.bp; delete x.desc; delete x.resina; }
      this.estado[id] = x;
    }
    return this;
  }
}

// Paso de formatos antiguos al de ahora: MIGRACIONES_TALA[v] pasa de v a v+1. Lo que no se entiende, se descarta.
export const MIGRACIONES_TALA = {};
export function migrarTala(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_TALA) { const paso = MIGRACIONES_TALA[d.version]; if (!paso) return null; d = paso(d); }
  if (!d || d.version !== VERSION_TALA || !d.estado || typeof d.estado !== 'object') return null;
  return d;
}

export const CLAVE_TALA = 'kinhold.tala';
export function guardarTala(almacen, tala, clave = CLAVE_TALA) {
  try { almacen.setItem(clave, JSON.stringify(tala.exportar())); return true; } catch (e) { return false; }
}
export function cargarTala(almacen, tala, clave = CLAVE_TALA) {
  try { const t = almacen.getItem(clave); if (t) tala.importar(JSON.parse(t)); } catch (e) { /* roto o sin almacenamiento */ }
  return tala;
}

// ---------------- Acción con autor ----------------
// { autor, tipo: 'talar', arbol, x, z } — un golpe de hacha. x, z: dónde está el autor (el servidor usará la suya).
// ahora: la hora del que valida (el servidor o este navegador), nunca la que diga el mensaje.
// suelo: un Suelo (src/logica/suelo.js) donde cae lo que deja el árbol, a nombre del autor. Se anota en el registro,
// salga bien o no.
export function ejecutarTala(tala, invs, suelo, registro, accion, ahora) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'talar' && a.tipo !== 'descortezar' && a.tipo !== 'sangrar') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!txt(a.arbol) || !Number.isFinite(a.x) || !Number.isFinite(a.z)) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else if (a.tipo === 'descortezar') r = tala.descortezar(invs.de(a.autor), a.arbol, a.x, a.z, ahora);
  else if (a.tipo === 'sangrar') r = tala.sangrar(invs.de(a.autor), a.arbol, a.x, a.z, ahora);
  else {
    r = tala.golpe(invs.de(a.autor), a.arbol, a.x, a.z, ahora, a.autor);
    // el tronco y las varas, tumbados a lo largo de donde cayó (se dibujan a lo largo de x); las ramas, como caen
    if (r.ok && r.cae) r.objetos = r.deja.map(o => suelo.dejar({ tipo: o.tipo, n: o.n }, o.x, o.z, ahora, a.autor, false, o.tipo === 'rama' ? r.dir : r.dir - Math.PI / 2).id);
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok && a.tipo !== 'talar') e.resultado = { objeto: r.objeto, cantidad: r.cantidad };
  else if (r.ok) e.resultado = r.cae ? { cae: true, deja: r.deja.map(o => ({ tipo: o.tipo, n: o.n })) } : { golpes: r.golpes };
  if (r.ok && r.seRompe) e.resultado.seRompe = r.seRompe;   // el hacha se ha roto con este golpe
  return r;
}

export const nombreTronco = edad => (CATALOGO[DA[edad].tronco] || {}).nombre;
