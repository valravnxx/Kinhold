// Kinhold — dónde sale lo que se recoge en el mundo de verdad (Whitholm): ramas caídas en el bosque, sílex en la
// caliza y en los ríos, piedra suelta en las laderas y en los ríos, fibra (ortigas y hierba larga) en los claros y
// las riberas, juncos y barro en la orilla y hongos yesqueros en el bosque (documento de sistemas, apartado 3, nivel N0). Lógica pura, sin three.js: el servidor podrá saber dónde
// está cada punto con la misma semilla, sin dibujar nada.
//
// Como lo que crece (src/logica/vegetacion.js): cada punto sale de su celda del MUNDO (azarCelda) y de la semilla del
// mapa, así que es siempre el mismo y dos cuadros que se solapan dan lo mismo en lo que comparten. Su nombre sale de su
// tipo y de su sitio en el mundo (idPunto): el mismo para todos los jugadores, salgan de donde salgan.
//
// Las zonas de un sitio (zonasRecogida):
//   bosque — donde hay árboles (bosqueEn, el de los árboles; también los sueltos de la pradera): cuanto más denso, más ramas.
//   claro  — sin bosque (o casi), en tierra llana o poco empinada y fuera de la nieve.
//   ladera — pendiente de más de 0,2 (y de menos de 0,8, donde aún se anda).
//   caliza — la roca madre del sitio es caliza.
//   rio    — en seco junto al agua de un río (la grava de la orilla, hasta 4 m del agua).
//   ribera — cerca de un río (hasta 16 m de la orilla), en seco.
// Decisiones provisionales (el documento solo dice «M» y «P»; anotadas en el registro de decisiones y en el diario):
//  - Una celda de 8 m da como mucho un punto. Lo «medio» (ramas, piedra) sale en una de cada 3 o 4 celdas de su zona;
//    lo «poco» (sílex, fibra), en una de cada 10 o 20; en los ríos, más (la orilla es estrecha). En el claro, algo de
//    piedra y de sílex sueltos (SUELTOS_CLARO), menos que en su sitio.
//  - Nada a menos de 1,2 m del sitio posible de un árbol (para no caer dentro de un tronco).
import { azarCelda } from './azar.js';
import { bosqueEn } from './paisaje.js';
import { CELDA as CELDA_VEG } from './vegetacion.js';
import { RECOLECTABLES } from './recoleccion.js';

export const CELDA_RECOGIDA = 8;
const CAPA = 4;                           // la capa de azar (los árboles son la 1, la hierba la 2, las piedras la 3)
export const LADO_RECOGIDA = 32;          // por trozos de 32 m (como lo que crece)
// la probabilidad de cada tipo en cada una de sus zonas (por celda); la del bosque se multiplica por su densidad
export const DENSIDAD_RECOGIDA = {
  ramas:        { bosque: 0.32 },
  piedra:       { ladera: 0.22, rio: 0.4 },
  silex:        { caliza: 0.06, rio: 0.12 },
  ortiga:       { ribera: 0.12, claro: 0.03 },
  hierba_larga: { claro: 0.06, ribera: 0.08 },
  // (7 nov) lo que pide la casa humilde y la hoguera: juncos en la orilla y la ribera, barro en la orilla y hongos
  // yesqueros en los tocones viejos del bosque. Se miran después de los sueltos del claro (DESPUES), solo en las celdas
  // que no han dado nada: así lo de antes sigue en el mismo sitio.
  juncos:       { rio: 0.12, ribera: 0.05 },
  barro:        { rio: 0.16, ribera: 0.04 },
  yesquero:     { bosque: 0.05 },
  // (P4) para comer: arbustos de bayas en el bosque (sobre todo en sus bordes, donde es claro: el del bosque se
  // multiplica por su densidad) y en los claros, y setas en el suelo del bosque. También después, en las celdas vacías.
  bayas:        { bosque: 0.03, claro: 0.012 },
  setas:        { bosque: 0.04 },
};
const DESPUES = ['juncos', 'barro', 'yesquero', 'bayas', 'setas'];
// Piedra y sílex sueltos en la pradera abierta (valravnx, 1 nov: «dentro del realismo, accesibilidad»; tarea «Salida
// al azar de verdad en línea»): en el claro, algo de piedra y de sílex, menos que donde les toca (decisión provisional:
// la piedra la séptima parte que en la ladera, el sílex la sexta parte que en la caliza). Se miran después de lo
// demás, solo en las celdas que no han dado nada: así lo que ya salía sigue en el mismo sitio.
export const SUELTOS_CLARO = { piedra: 0.03, silex: 0.01 };
const ORDEN = Object.keys(DENSIDAD_RECOGIDA).filter(t => !DESPUES.includes(t));
const PASO_PEND = 3;

export const idPunto = (tipo, xm, zm) => `${tipo}:${Math.round(xm * 10)},${Math.round(zm * 10)}`;

// Las zonas de (x, z) del mundo, o null si ahí no se recoge nada (el mar, el agua, la nieve, lo muy empinado).
// tramos: los ríos de cerca (paisaje.riosEn). Devuelve { zonas: [...], d (densidad del bosque), y, s (pendiente) }.
export function zonasRecogida(paisaje, alt, semilla, x, z, tramos) {
  const y = alt(x, z);
  if (y < 0.5 || paisaje.agua(x, z, tramos) !== null && y < paisaje.agua(x, z, tramos) + 0.15) return null;
  const st = paisaje.sitio(x, z, y);
  if (!st || !st.bioma || st.bioma === 'nieve') return null;
  const s = Math.hypot(alt(x + PASO_PEND, z) - alt(x - PASO_PEND, z), alt(x, z + PASO_PEND) - alt(x, z - PASO_PEND)) / (2 * PASO_PEND);
  if (s > 0.8) return null;
  const zonas = [];
  const { d } = bosqueEn(st, s, x, z, { semilla });
  if (d > 0.08) zonas.push('bosque');
  if (d < 0.12 && s < 0.45) zonas.push('claro');
  if (s > 0.2) zonas.push('ladera');
  if (st.roca === 'caliza') zonas.push('caliza');
  const { dm, ancho } = paisaje.rioCerca(x, z, tramos), orilla = dm - ancho / 2;
  if (orilla < 4) zonas.push('rio');
  if (orilla < 16) zonas.push('ribera');
  return { zonas, d, y, s };
}

// Los puntos de recogida de un cuadro del mundo { x0, z0, x1, z1 } (sin el borde de la derecha ni el de abajo).
// Devuelve [{ id, tipo, x, z, giro, zonas }] en metros del mundo.
export function recogidaEn(paisaje, alt, semilla, cuadro) {
  const { x0, z0, x1, z1 } = cuadro, P = CELDA_RECOGIDA;
  const tramos = paisaje.riosEn(x0, z0, x1, z1);
  // los sitios posibles de los árboles de alrededor (sin mirar si de verdad hay uno: es lo barato)
  const A = CELDA_VEG.arbol, arboles = [];
  for (let j = Math.floor((z0 - 4) / A); j <= Math.ceil((z1 + 4) / A); j++) for (let i = Math.floor((x0 - 4) / A); i <= Math.ceil((x1 + 4) / A); i++) {
    const r = azarCelda(i, j, 1, semilla); arboles.push([i * A + (r() - 0.5) * 4, j * A + (r() - 0.5) * 4]);
  }
  const puntos = [];
  // (las celdas de alrededor también: cada punto se aparta hasta 3,5 m del centro de la suya)
  for (let j = Math.floor(z0 / P) - 1; j <= Math.ceil(z1 / P) + 1; j++) for (let i = Math.floor(x0 / P) - 1; i <= Math.ceil(x1 / P) + 1; i++) {
    const r = azarCelda(i, j, CAPA, semilla);
    const x = i * P + (r() - 0.5) * (P - 1), z = j * P + (r() - 0.5) * (P - 1), u = r(), giro = r() * Math.PI * 2;
    if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
    if (arboles.some(([ax, az]) => (ax - x) ** 2 + (az - z) ** 2 < 1.44)) continue;
    const zr = zonasRecogida(paisaje, alt, semilla, x, z, tramos); if (!zr) continue;
    // un solo tipo por celda: las probabilidades, una detrás de otra
    let acum = 0, tipo = null;
    const prob = t => {
      let p = 0;
      for (const [zona, q] of Object.entries(DENSIDAD_RECOGIDA[t])) if (zr.zonas.includes(zona)) p = Math.max(p, zona === 'bosque' ? q * Math.min(1, zr.d * 1.4) : q);
      return p;
    };
    for (const t of ORDEN) { acum += prob(t); if (u < acum) { tipo = t; break; } }
    if (!tipo && zr.zonas.includes('claro')) for (const [t, p] of Object.entries(SUELTOS_CLARO)) { acum += p; if (u < acum) { tipo = t; break; } }
    if (!tipo) for (const t of DESPUES) { acum += prob(t); if (u < acum) { tipo = t; break; } }
    if (!tipo) continue;
    puntos.push({ id: idPunto(tipo, x, z), tipo, x, z, giro, zonas: zr.zonas });
  }
  return puntos;
}

// Los de un trozo de LADO_RECOGIDA m del mundo (i, j).
export function recogidaTrozo(paisaje, alt, semilla, i, j) {
  const L = LADO_RECOGIDA;
  return recogidaEn(paisaje, alt, semilla, { x0: i * L, z0: j * L, x1: (i + 1) * L, z1: (j + 1) * L });
}

// Comprobación de que cada tipo sale solo en las zonas del documento (las de RECOLECTABLES).
export const zonasDelDocumento = (tipo) => RECOLECTABLES[tipo].donde;
