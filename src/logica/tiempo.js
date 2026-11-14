// El tiempo del mundo (P11b, «La lluvia y el riego»; valravnx, 14 nov: «adelantamos hito de lluvia»). Lógica pura, sin
// three.js: la usan el servidor (riega los cultivos) y el navegador (los ve mustios y, en sus tareas, ve y oye la lluvia
// y la niebla).
// El GDD: el clima (despejado, nublado, lluvia, nieve y niebla) va por zonas grandes y según la estación. Aquí, sin
// estaciones todavía (la nieve y la estación, cuando lleguen):
//   - por zonas de ZONA_TIEMPO m (unas como las de cada comarca) y por la hora del servidor (la que da a todos);
//   - la lluvia: un día real (UTC) es de lluvia con PROB_DIA_LLUVIA; ese día llueve en algunos ratos de BLOQUE_TIEMPO
//     (PROB_RATO). Es la que riega el huerto (src/logica/campos.js) y no cambia con lo demás;
//   - nublado: MARGEN_NUBES antes y después de cada rato de lluvia (se cierra el cielo antes de llover y tarda en abrir);
//   - la niebla: algunas mañanas del mundo (PROB_NIEBLA por zona y por día del mundo, src/logica/cielo.js), espesa al
//     amanecer y se levanta a media mañana (NIEBLA_DESDE … NIEBLA_HASTA, horas del mundo); no con lluvia;
//   - sale de la hora y del sitio, nada más: igual para todos, sin guardar nada y sin que el servidor lo reparta.
// Decisiones provisionales (diario y registro de la demo): los números, para ajustar probando.
// Para las pruebas: globalThis.__tiempo = 'seco' (despejado siempre), 'lluvia', 'nublado' o 'niebla' (siempre ese); el
// servidor lo pone con KINHOLD_PRUEBAS_TIEMPO.
import { horaDe } from './cielo.js';

export const ZONA_TIEMPO = 1000;                    // m
export const BLOQUE_TIEMPO = 3 * 3600 * 1000;       // ms: un rato (8 al día)
export const DIA = 24 * 3600 * 1000;
export const PROB_DIA_LLUVIA = 0.3;                 // de cada 10 días, unos 3 con lluvia (provisional)
export const PROB_RATO = 0.4;                       // un día de lluvia, llueve en unos 3 de sus 8 ratos (provisional)
export const MARGEN_NUBES = 45 * 60 * 1000;         // ms de nublado antes y después de cada rato de lluvia (provisional)
export const PROB_NIEBLA = 0.2;                     // de cada 10 mañanas del mundo, unas 2 con niebla (provisional)
export const NIEBLA_DESDE = 4.5, NIEBLA_ESPESA = 8, NIEBLA_HASTA = 10;   // horas del mundo: espesa hasta las 8, se va a las 10
export const TIEMPOS = ['despejado', 'nublado', 'lluvia', 'niebla'];

// un número fijo de 0 a 1 para tres enteros
function azar(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const zona = (x, z) => [Math.floor(x / ZONA_TIEMPO), Math.floor(z / ZONA_TIEMPO)];

// ¿Llueve en (x, z) a la hora t (ms)? (la del riego: no cambia)
export function lloviendo(x, z, t) {
  const fijo = globalThis.__tiempo;
  if (fijo) return fijo === 'lluvia';
  const [zx, zz] = zona(x, z);
  if (azar(zx, zz, Math.floor(t / DIA)) >= PROB_DIA_LLUVIA) return false;
  return azar(zx + 7919, zz - 104729, Math.floor(t / BLOQUE_TIEMPO)) < PROB_RATO;
}

// cuánta niebla hay (0–1) en (x, z) a la hora t: solo las mañanas que toca en esa zona
export function niebla(x, z, t) {
  const fijo = globalThis.__tiempo;
  if (fijo) return fijo === 'niebla' ? 1 : 0;
  if (lloviendo(x, z, t)) return 0;
  const { hora, dias } = horaDe(t);
  if (hora < NIEBLA_DESDE || hora >= NIEBLA_HASTA) return 0;
  const [zx, zz] = zona(x, z);
  if (azar(zx - 31337, zz + 2741, dias) >= PROB_NIEBLA) return 0;
  if (hora < NIEBLA_DESDE + 0.5) return (hora - NIEBLA_DESDE) / 0.5;                    // se forma antes de amanecer
  if (hora <= NIEBLA_ESPESA) return 1;
  return (NIEBLA_HASTA - hora) / (NIEBLA_HASTA - NIEBLA_ESPESA);                        // se levanta
}

// cuánto cubren las nubes (0–1): 1 lloviendo; antes y después de cada rato de lluvia, de 0 a 1 en MARGEN_NUBES
export function nubes(x, z, t) {
  const fijo = globalThis.__tiempo;
  if (fijo) return fijo === 'lluvia' || fijo === 'nublado' ? 1 : 0;
  if (lloviendo(x, z, t)) return 1;
  // lo que falta hasta el rato de lluvia más cercano (antes o después), mirando solo los bordes de los ratos vecinos
  const ini = Math.floor(t / BLOQUE_TIEMPO) * BLOQUE_TIEMPO, fin = ini + BLOQUE_TIEMPO;
  let lejos = Infinity;
  if (lloviendo(x, z, ini - 1)) lejos = Math.min(lejos, t - ini);
  if (lloviendo(x, z, fin) && !globalThis.__mutarTiempo) lejos = Math.min(lejos, fin - t);   // (la prueba lo rompe a propósito)
  if (lejos >= MARGEN_NUBES) return 0;
  return 1 - lejos / MARGEN_NUBES * 0.5;     // de 0,5 en el borde del margen a 1 al empezar o acabar la lluvia
}

// El tiempo que hace en (x, z) a la hora t: { tiempo: 'despejado' | 'nublado' | 'lluvia' | 'niebla', nubes, niebla,
// lluvia } (las tres de 0 a 1, para que el navegador pase de un tiempo a otro sin saltos). Igual para todos.
export function tiempoEn(x, z, t) {
  const lluvia = lloviendo(x, z, t) ? 1 : 0;
  const n = nubes(x, z, t), nb = niebla(x, z, t);
  const tiempo = lluvia ? 'lluvia' : nb > 0 ? 'niebla' : n > 0 ? 'nublado' : 'despejado';
  return { tiempo, nubes: n, niebla: nb, lluvia };
}
