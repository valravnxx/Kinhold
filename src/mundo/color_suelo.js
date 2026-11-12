// Kinhold — el color del suelo (sin three.js): el del paisaje de lejos y el del suelo de cerca, el «como en el juego».
// Está aparte para que lo use igual el hilo que hace los trozos del terreno (src/mundo/trozos_hilo.js), donde no hay
// three.js ni ventana.
import { fbm } from '../logica/mapa.js';
import { bosqueEn } from '../logica/paisaje.js';

// color del suelo (0–1) por bioma: el del suelo que se ve bajo los árboles o en el prado, no el del mapa
// (12 nov, el aspecto de maqueta: los verdes tiraban a mostaza con el sol cálido; menos rojo en los biomas de hierba)
const SUELO = {
  taiga: [0.33, 0.42, 0.27], caducifolio: [0.38, 0.49, 0.27], mixto: [0.41, 0.51, 0.29], encinar: [0.47, 0.5, 0.31],
  pradera: [0.49, 0.58, 0.31], brezal: [0.48, 0.46, 0.37], matorral: [0.61, 0.58, 0.41], turbera: [0.38, 0.43, 0.31],
  alpino: [0.53, 0.56, 0.44], nieve: [0.9, 0.91, 0.92],
};
const ROCA = { granito: [0.6, 0.56, 0.53], caliza: [0.74, 0.71, 0.63], pizarra: [0.42, 0.43, 0.47], arenisca: [0.68, 0.55, 0.41] };
const ARENA = [0.76, 0.71, 0.58];

// color del suelo (sRGB, 0–1) en un punto: bioma, más verde donde llueve, roca desnuda en lo empinado, playa y nieve
export function colorDelSuelo(st, y, s, xm, ym) {
  if (!st || !st.bioma) {
    if (y >= 0.3) return [0.42, 0.46, 0.44];                                         // cauce
    // el fondo del mar (valravnx, 5 nov: «debería verse la arena debajo del agua a bastante distancia»): arena donde
    // es llano, la roca del sitio donde es empinado (al pie de los acantilados), con ondas en la arena y manchas de
    // algas; y cuanto más hondo, más se pierde en el azul verdoso del agua (lo que se ve a través del mar)
    const roca = (st && ROCA[st.roca]) || ROCA.caliza;
    // (arena donde la costa es de caliza o arenisca; donde es de granito o pizarra, cantos de su roca, como en tierra)
    const fondo = st && (st.roca === 'granito' || st.roca === 'pizarra') ? roca.map(v => v * 0.85) : ARENA;
    let c = fondo.map((v, n) => v + (roca[n] * 0.8 - v) * Math.min(1, Math.max(0, (s - 0.35) / 0.4)));
    const onda = 1 - 0.035 * suave(0.2, 1.5, -y) * (0.5 + 0.5 * Math.sin(xm * 0.9 + fbm(xm / 9, ym / 9, 71, 2) * 9)),   // (las ondas, solo bajo el agua)
          alga = suave(0.6, 0.72, fbm(xm / 25, ym / 25, 72, 3)) * suave(1.5, 4, -y);
    c = c.map((v, n) => v * onda + ([0.24, 0.3, 0.2][n] - v) * alga * 0.6);
    const hondo = 1 - Math.exp(Math.min(0, y) / 7);
    return c.map((v, n) => v + ([0.13, 0.25, 0.28][n] - v) * hondo);
  }
  let c = SUELO[st.bioma] || SUELO.pradera;
  const verde = Math.max(-0.5, Math.min(0.5, st.P - 0.6)) + (fbm(xm / 420, ym / 420, 9, 3) - 0.5) * 0.6;
  if (st.bioma !== 'nieve') c = [c[0] * (1 - 0.12 * verde), c[1] * (1 + 0.1 * verde), c[2] * (1 - 0.1 * verde)];
  const roca = ROCA[st.roca] || ROCA.caliza;
  // roca desnuda solo en las paredes de verdad (más de unos 45°); las cuestas, por empinadas que sean, con hierba
  const r = Math.min(1, Math.max(0, (s - 0.85) / 0.4) + (st.bioma === 'alpino' ? 0.25 : 0));
  c = c.map((v, n) => v + (roca[n] - v) * r);
  if (r > 0) {
    // en la pared, los estratos: franjas por la altura (como capas de roca), onduladas, y vetas más oscuras
    const capa = Math.sin(y * 1.7 + fbm(xm / 60, ym / 60, 11, 2) * 7) * 0.5 + 0.5, veta = fbm(xm / 7, ym / 7 + y / 3, 13, 2);
    const k = (1 - r * (0.16 * capa + 0.14 * Math.max(0, veta - 0.55) * 4)) * (1 - 0.28 * r);   // más oscura: lo que asoma entre las piezas de roca se lee como sombra
    c = c.map(v => v * k);
  }
  // la playa, solo junto al mar (valravnx, 6 nov: salía arena en las vegas de los ríos tierra adentro, que quedan bajas)
  const junto = 1 - suave(45, 90, st.costa ?? 0);
  if (y < 2.8 && (st.roca === 'arenisca' || st.roca === 'caliza') && s < 0.25) c = c.map((v, n) => v + (ARENA[n] - v) * arenaDe(y) * junto); // playa
  else if (y < 1.2 && (st.roca === 'granito' || st.roca === 'pizarra') && s < 0.4) c = c.map((v, n) => v + (roca[n] * 0.85 - v) * (1 - y / 1.2) * junto); // orilla de cantos
  if (st.T < -1.5 && s < 0.9) c = SUELO.nieve;
  return c;
}
export const ROCAS_COLOR = ROCA;
export const ARENA_PLAYA = ARENA;
// cuánto es arena la playa a esa altura sobre el mar (0–1): entera hasta 1 m, y se va hasta 2,8 m
export const arenaDe = (y) => 1 - Math.min(1, Math.max(0, (y - 1) / 1.8)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, (y - 1) / 1.8)));
export const lin = (c) => Math.pow(Math.max(0, c), 2.2);

// El color del suelo de cerca (el de la vista «Como en el juego»), en lineal y ya con el sombreado de las vaguadas:
//   st: el sitio (paisaje.sitio) o null en el agua; y: altura (m); s: pendiente de la forma (vecinos a 3 m); s1: la de
//   aquí mismo (1 m); lap: concavidad (vecinos a 2 m, m/m²); xm, ym: el punto en el mundo (m)
const TIERRA = [0.54, 0.48, 0.43], HOJARASCA = [0.36, 0.32, 0.23];   // (12 nov: pardo gris cálido, como el camino de la referencia; antes se leía como paja, y luego como caqui)
// (la prueba quita el lecho a propósito para comprobar que falla)
const window_sinLecho = () => typeof globalThis !== 'undefined' && !!globalThis.__sinLecho;
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// El lecho de los ríos (valravnx, 5 nov: «ahora es hierba con agua a ratos»): grava y cantos rodados en el fondo (del
// color de la roca del sitio), alguna barra de arena, una franja de barro húmedo en la orilla y algún canto suelto al
// salir del agua. rio: { dm, ancho } (paisaje.rioCerca) o null; b, lo que hay del borde del cauce hacia fuera (m).
const GRAVA_OSC = [0.31, 0.29, 0.26], ARENA_RIO = [0.62, 0.55, 0.42], BARRO = [0.34, 0.28, 0.21];
function conLecho(c, st, rio, xm, ym) {
  const b = rio.dm - rio.ancho / 2;
  if (b > 3.5) return c;
  const roca = (st && ROCA[st.roca]) || ROCA.caliza;
  // la grava: la roca del sitio, más oscura y mojada, a manchas; los cantos, claros, sueltos
  const n = fbm(xm / 3.5, ym / 3.5, 61, 3), canto = suave(0.6, 0.66, fbm(xm / 0.9, ym / 0.9, 62, 2));
  let l = GRAVA_OSC.map((v, q) => v + (roca[q] * 0.8 - v) * n);
  l = l.map((v, q) => v + (roca[q] * 1.05 - v) * canto * 0.8);
  // barras de arena en los ríos anchos, por dentro del cauce
  if (rio.ancho > 6) { const t = suave(0.58, 0.68, fbm(xm / 14, ym / 14, 63, 3)) * suave(-rio.ancho * 0.45, -rio.ancho * 0.2, b); l = l.map((v, q) => v + (ARENA_RIO[q] - v) * t * 0.85); }
  // en el estuario (los últimos 600 m hasta el mar), arena: el fondo, las isletas del delta y las orillas
  const estuario = 1 - suave(150, 600, rio.costa ?? Infinity);
  if (estuario > 0) l = l.map((v, q) => v + (ARENA_RIO[q] * (0.92 + 0.08 * n) - v) * estuario);
  // dentro del cauce, el lecho; de ahí hasta 1,2 m fuera, el lecho se va
  const dentro = 1 - suave(-0.3, 1.2, b);
  let r = c.map((v, q) => v + (l[q] - v) * dentro);
  // la orilla mojada, de barro, justo en el borde
  const orilla = suave(-0.8, -0.1, b) * (1 - suave(0.5, 1.4, b)) * 0.55 * (1 - 0.6 * estuario);
  r = r.map((v, q) => v + (BARRO[q] - v) * orilla);
  // algún canto suelto en la hierba de la orilla
  const suelto = (1 - suave(1.2, 3.5, b)) * suave(0.7, 0.74, fbm(xm / 1.1, ym / 1.1, 64, 2)) * (b > 1.2 ? 1 : 0) * (1 - estuario);
  return r.map((v, q) => v + (roca[q] - v) * suelto);
}

// pesos (opcional, 12 nov, el suelo con materiales: src/mapa/suelo.js): cuánto hay en ese punto de cada material del
// suelo [hierba, tierra, roca, hojarasca], que suman 1; con ellos el sombreador mezcla sus texturas. Salen de lo mismo que
// el color: la roca de las paredes, la tierra de las calvas, la playa y el lecho de los ríos, y la hojarasca del bosque.
export function colorJuego(st, y, s, s1, lap, xm, ym, sal = [0, 0, 0], rio = null, pesos = null) {
  // el color con la pendiente de aquí mismo (1 m): una repisa entre dos paredes tiene su hierba
  const sp = Math.max(s1, s * 0.6);
  let c = colorDelSuelo(st, y, sp, xm, ym);
  let pRoca = 0, pTierra = 0, pHoja = 0;
  if (!st || !st.bioma) pTierra = 1;                                   // (el fondo del agua y los cauces: arena, cantos)
  else {
    pRoca = Math.min(1, Math.max(0, (sp - 1.0) / 0.4) + (st.bioma === 'alpino' ? 0.25 : 0));
    if (st.bioma === 'nieve' || st.T < -1.5) pTierra = 1 - pRoca;
  }
  // calvas de tierra en el prado y en el bosque, y algo de variación de cerca
  // (en la arena de la playa, ni calvas ni hojarasca: salían manchas pardas)
  const playa = st && (st.roca === 'arenisca' || st.roca === 'caliza') && s < 0.25 && y < 2.8 ? arenaDe(y) * (1 - suave(45, 90, st.costa ?? 0)) : 0;
  pTierra = Math.max(pTierra, playa);
  if (st && st.bioma && st.bioma !== 'nieve' && s < 0.6) { // (la pendiente las apaga poco a poco: con el corte seco, en las laderas salían franjas rectas a lo largo de la curva de nivel)
    // (con un ruido más fino en el borde: si no, salían óvalos lisos, como pegatinas)
    // (y torcidas con un ruido grande, que cambia su silueta y su tamaño: si no, eran óvalos iguales en fila)
    const ux = xm + (fbm(xm / 25, ym / 25, 51, 2) - 0.5) * 9, uy = ym + (fbm(xm / 25, ym / 25, 53, 2) - 0.5) * 9;
    const t = suave(0.66, 0.76, fbm(ux / 16, uy / 16, 41, 3) + (fbm(xm / 4.5, ym / 4.5, 47, 2) - 0.5) * 0.14 + (fbm(xm / 90, ym / 90, 55, 2) - 0.5) * 0.12) * (1 - playa) * (1 - suave(0.3, 0.6, s)); c = c.map((v, q) => v + (TIERRA[q] - v) * t * 0.93); pTierra = Math.max(pTierra, t); }
  // bajo el bosque, el suelo es de hojarasca (más pardo y oscuro)
  if (st && st.bioma && st.bioma !== 'nieve') { const d = bosqueEn(st, s, xm, ym).d * (1 - playa); c = c.map((v, q) => v + (HOJARASCA[q] - v) * Math.min(1, d * 0.75)); pHoja = Math.min(1, d * 0.9); }
  if (rio && rio.dm < rio.ancho / 2 + 3.5 && !window_sinLecho()) { c = conLecho(c, st, rio, xm, ym); pTierra = Math.max(pTierra, 1 - suave(-0.3, 1.6, rio.dm - rio.ancho / 2)); }
  // la hierba, algo menos chillona: hacia el verde oliva pajizo de la referencia (diseno/referencia/aspecto_del_juego.jpg)
  const g = (1 - pRoca) * (1 - pTierra) * (1 - pHoja) * 0.3, L = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  c = [c[0] + (L * 1.06 - c[0]) * g, c[1] + (L - c[1]) * g, c[2] + (L * 0.86 - c[2]) * g];
  // y a gran escala, zonas del prado más ocres y otras más oscuras, como en la referencia (de lejos no era un verde plano)
  { const gp = (1 - pRoca) * (1 - pTierra) * (1 - pHoja), z = fbm(xm / 140, ym / 140, 57, 3) - 0.5, o = fbm(xm / 60, ym / 60, 59, 2) - 0.5;
    const k = 1 + z * 0.45 * gp, oc = Math.max(0, o) * 0.7 * gp;
    c = [c[0] * k * (1 + oc * 0.5), c[1] * k * (1 + oc * 0.2), c[2] * k * (1 - oc * 0.3)]; }
  const v = 1 - Math.max(-0.1, Math.min(0.15, lap * 1.5)) + (fbm(xm / 5, ym / 5, 43, 3) - 0.5) * 0.16;
  // los colores de arriba están en sRGB (como los de la paleta); los de los vértices van en lineal
  sal[0] = lin(c[0]) * v; sal[1] = lin(c[1]) * v; sal[2] = lin(c[2]) * v;
  if (pesos) {
    // la roca manda; de lo que queda, la tierra; de lo que queda, la hojarasca; el resto, hierba
    const r = pRoca, ti = (1 - r) * pTierra, h = (1 - r - ti) * pHoja;
    pesos[0] = Math.max(0, 1 - r - ti - h); pesos[1] = ti; pesos[2] = r; pesos[3] = h;
  }
  return sal;
}
