// Lo mojado que está el suelo (P11b, «La lluvia y el riego»: la lluvia moja). Lógica pura, sin three.js: sale del
// tiempo del mundo (src/logica/tiempo.js), así que es igual para todos y no se guarda nada.
//   - mientras llueve, se va mojando: del todo en MOJAR desde que empieza a llover;
//   - cuando para, se va secando poco a poco: seco en SECAR (un rato después de la lluvia, no de golpe).
// Lo usa el navegador (el suelo y las piezas más oscuros, src/mundo/tiempo_vista.js). Decisión provisional (diario y
// registro de la demo): los dos tiempos, para ajustar probando; sin sol ni viento que sequen más deprisa.
import { lloviendo, BLOQUE_TIEMPO } from './tiempo.js';

export const MOJAR = 4 * 60 * 1000;    // ms: lo que tarda en mojarse del todo
export const SECAR = 30 * 60 * 1000;   // ms: lo que tarda en secarse del todo cuando para

// 0 (seco) a 1 (empapado) en (x, z) a la hora t (ms). La lluvia va por ratos de BLOQUE_TIEMPO (más largos que MOJAR y
// que SECAR), así que basta con mirar este rato y el de antes.
export function mojado(x, z, t) {
  const ini = Math.floor(t / BLOQUE_TIEMPO) * BLOQUE_TIEMPO;
  const antes = lloviendo(x, z, ini - 1);
  if (lloviendo(x, z, t)) return antes ? 1 : Math.min(1, (t - ini) / MOJAR);
  if (!antes) return 0;
  return Math.max(0, 1 - (t - ini) / SECAR);
}

// El mismo paso, de a poco, para lo que no sale de la hora (el tiempo fijo de las pruebas y las capturas): de m hacia
// mojado si llueve, o hacia seco si no, en dt ms.
export function pasoMojado(m, llueve, dt) {
  return llueve ? Math.min(1, m + dt / MOJAR) : Math.max(0, m - dt / SECAR);
}
