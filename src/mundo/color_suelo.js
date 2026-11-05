// Kinhold — el color del suelo (sin three.js): el del paisaje de lejos y el del suelo de cerca, el «como en el juego».
// Está aparte para que lo use igual el hilo que hace los trozos del terreno (src/mundo/trozos_hilo.js), donde no hay
// three.js ni ventana.
import { fbm } from '../logica/mapa.js';
import { bosqueEn } from '../logica/paisaje.js';

// color del suelo (0–1) por bioma: el del suelo que se ve bajo los árboles o en el prado, no el del mapa
const SUELO = {
  taiga: [0.36, 0.42, 0.29], caducifolio: [0.42, 0.5, 0.3], mixto: [0.45, 0.52, 0.32], encinar: [0.5, 0.5, 0.33],
  pradera: [0.55, 0.6, 0.36], brezal: [0.5, 0.46, 0.38], matorral: [0.63, 0.58, 0.42], turbera: [0.4, 0.43, 0.32],
  alpino: [0.55, 0.56, 0.45], nieve: [0.9, 0.91, 0.92],
};
const ROCA = { granito: [0.6, 0.56, 0.53], caliza: [0.74, 0.71, 0.63], pizarra: [0.42, 0.43, 0.47], arenisca: [0.68, 0.55, 0.41] };
const ARENA = [0.76, 0.71, 0.58];

// color del suelo (sRGB, 0–1) en un punto: bioma, más verde donde llueve, roca desnuda en lo empinado, playa y nieve
export function colorDelSuelo(st, y, s, xm, ym) {
  if (!st || !st.bioma) return [0.42, 0.46, 0.44];                                  // fondo del mar / cauce
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
  if (y < 2.6 && (st.roca === 'arenisca' || st.roca === 'caliza') && s < 0.25) c = c.map((v, n) => v + (ARENA[n] - v) * (1 - y / 2.6)); // playa
  if (st.T < -1.5 && s < 0.9) c = SUELO.nieve;
  return c;
}
export const ROCAS_COLOR = ROCA;
export const lin = (c) => Math.pow(Math.max(0, c), 2.2);

// El color del suelo de cerca (el de la vista «Como en el juego»), en lineal y ya con el sombreado de las vaguadas:
//   st: el sitio (paisaje.sitio) o null en el agua; y: altura (m); s: pendiente de la forma (vecinos a 3 m); s1: la de
//   aquí mismo (1 m); lap: concavidad (vecinos a 2 m, m/m²); xm, ym: el punto en el mundo (m)
const TIERRA = [0.5, 0.42, 0.31], HOJARASCA = [0.4, 0.36, 0.24];
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
  // dentro del cauce, el lecho; de ahí hasta 1,2 m fuera, el lecho se va
  const dentro = 1 - suave(-0.3, 1.2, b);
  let r = c.map((v, q) => v + (l[q] - v) * dentro);
  // la orilla mojada, de barro, justo en el borde
  const orilla = suave(-0.8, -0.1, b) * (1 - suave(0.5, 1.4, b)) * 0.55;
  r = r.map((v, q) => v + (BARRO[q] - v) * orilla);
  // algún canto suelto en la hierba de la orilla
  const suelto = (1 - suave(1.2, 3.5, b)) * suave(0.7, 0.74, fbm(xm / 1.1, ym / 1.1, 64, 2)) * (b > 1.2 ? 1 : 0);
  return r.map((v, q) => v + (roca[q] - v) * suelto);
}

export function colorJuego(st, y, s, s1, lap, xm, ym, sal = [0, 0, 0], rio = null) {
  // el color con la pendiente de aquí mismo (1 m): una repisa entre dos paredes tiene su hierba
  let c = colorDelSuelo(st, y, Math.max(s1, s * 0.6), xm, ym);
  // calvas de tierra en el prado y en el bosque, y algo de variación de cerca
  if (st && st.bioma && st.bioma !== 'nieve' && s < 0.6) { const t = suave(0.62, 0.74, fbm(xm / 16, ym / 16, 41, 3)); c = c.map((v, q) => v + (TIERRA[q] - v) * t * 0.7); }
  // bajo el bosque, el suelo es de hojarasca (más pardo y oscuro)
  if (st && st.bioma && st.bioma !== 'nieve') { const d = bosqueEn(st, s, xm, ym).d; c = c.map((v, q) => v + (HOJARASCA[q] - v) * Math.min(1, d * 0.75)); }
  if (rio && rio.dm < rio.ancho / 2 + 3.5 && !window_sinLecho()) c = conLecho(c, st, rio, xm, ym);
  const v = 1 - Math.max(-0.1, Math.min(0.15, lap * 1.5)) + (fbm(xm / 5, ym / 5, 43, 3) - 0.5) * 0.16;
  // los colores de arriba están en sRGB (como los de la paleta); los de los vértices van en lineal
  sal[0] = lin(c[0]) * v; sal[1] = lin(c[1]) * v; sal[2] = lin(c[2]) * v;
  return sal;
}
