// El tiempo del mundo (P11b, «La lluvia y el riego»; valravnx, 14 nov: «adelantamos hito de lluvia»). Lógica pura, sin
// three.js: la usan el servidor (riega los cultivos) y el navegador (los ve mustios y, en su tarea, ve y oye la lluvia).
// El GDD: el clima va por zonas grandes y según la estación. Aquí, de momento, solo si llueve o no:
//   - por zonas de ZONA_TIEMPO m (unas como las de cada comarca) y por días reales (UTC);
//   - un día es de lluvia con PROB_DIA_LLUVIA; ese día llueve en algunos ratos de BLOQUE_TIEMPO (PROB_RATO);
//   - sale de la hora y del sitio, nada más: igual para todos, sin guardar nada y sin que el servidor lo reparta.
// Decisiones provisionales (registro de la demo y diario): los números, para ajustar probando. La estación, la nieve y
// la niebla llegan con su tarea.
// Para las pruebas: globalThis.__tiempo = 'seco' (nunca llueve) o 'lluvia' (siempre); el servidor lo pone con
// KINHOLD_PRUEBAS_TIEMPO.
export const ZONA_TIEMPO = 1000;                    // m
export const BLOQUE_TIEMPO = 3 * 3600 * 1000;       // ms: un rato (8 al día)
export const DIA = 24 * 3600 * 1000;
export const PROB_DIA_LLUVIA = 0.3;                 // de cada 10 días, unos 3 con lluvia (provisional)
export const PROB_RATO = 0.4;                       // un día de lluvia, llueve en unos 3 de sus 8 ratos (provisional)

// un número fijo de 0 a 1 para tres enteros
function azar(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ¿Llueve en (x, z) a la hora t (ms)?
export function lloviendo(x, z, t) {
  if (globalThis.__tiempo === 'seco') return false;
  if (globalThis.__tiempo === 'lluvia') return true;
  const zx = Math.floor(x / ZONA_TIEMPO), zz = Math.floor(z / ZONA_TIEMPO);
  if (azar(zx, zz, Math.floor(t / DIA)) >= PROB_DIA_LLUVIA) return false;
  return azar(zx + 7919, zz - 104729, Math.floor(t / BLOQUE_TIEMPO)) < PROB_RATO;
}
