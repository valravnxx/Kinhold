// Kinhold — nivelar el terreno para construir (lógica pura, sin three.js): GDD, apartado de cavar: «nivelar para
// cimientos con una brocha redonda que rebaja o alisa con bordes suaves», y el relieve pesa: «en ladera hay que nivelar
// para poner cimientos» (valravnx, 30 oct: «los suelos de base que coloques alisen el suelo de abajo para construir»).
//
// Una marca de nivelado es una pasada de la brocha redonda: { x, z, y, r, borde }. Dentro del radio r el suelo queda
// a la altura y (se rebaja lo que sobra y se rellena lo que falta); de r a r + borde pasa suavemente a la altura de
// antes. Varias marcas se aplican por orden: la última manda donde se pisan.
//
// No se guarda la malla del suelo: solo las marcas (unos pocos números cada una). La altura de antes sale de la semilla
// del mundo, así que el servidor y cada jugador sacan el mismo suelo a partir de lo mismo.
//
// Decisiones provisionales (el GDD no da cifras; anotadas en el registro de decisiones y en el diario):
//  - Cada cimiento (suelo de base de la planta baja) alisa su casilla de 2 m: una marca redonda en su centro que tapa
//    también las esquinas (radio 1,45 m) y con 1,5 m de borde suave. Las casillas de al lado se juntan en un llano.
//  - La brocha a mano: radio de 0,5 a 4 m, borde suave de 1,5 m, solo en tu tierra.
import { PIEZAS, MODULO } from './piezas.js';

export const RADIO_CIMIENTO = 1.45;   // m: tapa la casilla de 2 m entera (media diagonal, 1,41)
export const BORDE = 1.5;             // m de borde suave alrededor
export const RADIO_MIN = 0.5, RADIO_MAX = 4;

const liso = (t) => t * t * (3 - 2 * t);

// Peso de una marca en (x, z): 1 dentro del radio, 0 fuera del borde, y en medio, suave.
export function peso(m, x, z) {
  const d = Math.hypot(x - m.x, z - m.z);
  if (d <= m.r) return 1;
  const b = m.borde ?? BORDE;
  if (d >= m.r + b) return 0;
  return 1 - liso((d - m.r) / b);
}

// La altura en (x, z) con las marcas: h, la de antes.
export function aplicar(h, x, z, marcas) {
  for (const m of marcas) {
    const w = peso(m, x, z);
    if (w > 0) h += (m.y - h) * w;
  }
  return h;
}

// base(x, z) → altura de antes. Devuelve la función de la altura nivelada (la misma si no hay marcas).
export function nivelar(base, marcas) {
  if (!marcas || !marcas.length) return base;
  return (x, z) => aplicar(base(x, z), x, z, marcas);
}

// Las marcas que tocan el rectángulo [x0, x1] × [z0, z1] (para no mirarlas todas en cada punto de un trozo).
export function marcasEn(marcas, x0, z0, x1, z1) {
  return (marcas || []).filter(m => { const a = m.r + (m.borde ?? BORDE); return m.x + a >= x0 && m.x - a <= x1 && m.z + a >= z0 && m.z - a <= z1; });
}
// El rectángulo que toca una marca.
export function caja(m) { const a = m.r + (m.borde ?? BORDE); return { x0: m.x - a, z0: m.z - a, x1: m.x + a, z1: m.z + a }; }

// ¿Es un suelo de base (alisa el terreno de debajo)? Los cimientos de la planta baja.
export const alisa = (p) => !!p && p.k === 0 && p.hueco === 'f' && !!PIEZAS[p.tipo] && !!PIEZAS[p.tipo].soloPlanta0;

// Comprueba una pasada de la brocha a mano (sin el suelo: eso lo mira quien lo tiene). accion = { x, z, y, radio }.
export function validarPasada(a) {
  if (![a.x, a.z, a.y, a.radio].every(Number.isFinite)) return 'Datos no válidos.';
  if (a.radio < RADIO_MIN || a.radio > RADIO_MAX) return 'La brocha va de 0,5 a 4 m.';
  return null;
}

// el centro (local, en metros) de la casilla de un suelo
export const centroCasilla = (p) => ({ lx: (p.i + 0.5) * MODULO, lz: (p.j + 0.5) * MODULO });
