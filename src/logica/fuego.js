// El fuego de la hoguera (P3, «De nada a una casa»; revisión del 1 nov: «hoguera fuera: se enciende con yesca, se
// alimenta con leña, se apaga»; documento de sistemas, apartado 11: «enciende la hoguera fuera (yesca y taladro de
// fuego) para la noche; se alimenta con leña y se apaga»). Lógica pura (sin three.js ni navegador): la usan el
// servidor, las pruebas y el navegador (para dibujarlo y para el calor).
//
// El fuego de una estación (e.fuego) es { hasta, combustible, cenizas }:
//  - hasta: la hora (ms) a la que se apaga si está encendido; 0 si está apagado. Se guarda cuándo se apaga, no un
//    contador: arde aunque nadie juegue, y se apaga solo.
//  - combustible: los segundos de fuego que tiene puestos sin arder (lo que se le echa apagado).
//  - cenizas: si se ha apagado después de arder (se ven las cenizas).
// Encender: con la yesca (se gasta 1) y el taladro de fuego (no se gasta), si tiene algo que arder. Echarle una rama o
// una leña: si arde, arde más rato; si no, queda puesta para cuando se encienda.
//
// Decisiones provisionales (el documento no fija los tiempos; anotadas en el diario y en el registro):
//  - Una rama arde 3 min y una leña 10 min. La hoguera recién hecha tiene sus 4 ramas puestas: 12 min.
//  - Como mucho 60 min de fuego por delante (entre lo que arde y lo puesto): lo demás no cabe.
//  - El calor llega a 4 m (de 1 junto al fuego a 0 a 4 m), y la luz alumbra unos 9 m (como las chimeneas).
//  - Las recetas «al fuego» (la lanza endurecida, las antorchas) piden el fuego encendido al encargarlas.
//  - Encender y echar leña, como dejar cosas en la estación: en tierra de otro, solo su dueño y sus invitados.

export const ARDE = { rama: 180, lena: 600 };   // s de fuego por cada una
export const FUEGO_MAX = 3600;                  // s de fuego por delante, como mucho
export const RAMAS_HOGUERA = 4;                 // las de su coste: quedan puestas
export const RADIO_CALOR = 4;                   // m
export const RADIO_LUZ = 9;                     // m
export const YESCAS = ['yesca'];                // lo que prende (la de fibra, la de corteza y la del hongo son la misma yesca)
export const HERRAMIENTA_FUEGO = 'taladro_fuego';

// El fuego de una hoguera recién levantada: apagado, con sus ramas puestas.
export const fuegoNuevo = () => ({ hasta: 0, combustible: RAMAS_HOGUERA * ARDE.rama, cenizas: false });

// Lo guardado que vale (o uno nuevo si no vale).
export function limpiarFuego(f) {
  if (!f || typeof f !== 'object') return fuegoNuevo();
  const hasta = Number.isFinite(f.hasta) && f.hasta > 0 ? f.hasta : 0;
  const combustible = Number.isFinite(f.combustible) ? Math.max(0, Math.min(FUEGO_MAX, f.combustible)) : 0;
  return { hasta, combustible, cenizas: !!f.cenizas };
}

// Si ya se ha apagado, lo deja apagado y con cenizas.
export function asentar(f, ahora) {
  if (f.hasta && f.hasta <= ahora) { f.hasta = 0; f.cenizas = true; }
  return f;
}

// Cómo está: { encendida, queda (s que le quedan ardiendo), combustible (s puestos sin arder), cenizas }.
export function estadoFuego(f, ahora) {
  if (!f) return { encendida: false, queda: 0, combustible: 0, cenizas: false };
  const encendida = f.hasta > ahora;
  return { encendida, queda: encendida ? (f.hasta - ahora) / 1000 : 0, combustible: f.combustible || 0, cenizas: encendida ? false : !!(f.cenizas || f.hasta) };
}
export const encendida = (f, ahora) => !!f && f.hasta > ahora;

// Echarle una cosa (tipo: 'rama' o 'lena'). No gasta nada: eso lo hace quien llama, si sale bien.
export function echar(f, tipo, ahora) {
  if (!Object.hasOwn(ARDE, tipo)) return { ok: false, motivo: 'Al fuego solo se echan ramas o leña.' };
  asentar(f, ahora);
  const s = ARDE[tipo], arde = f.hasta > ahora, hay = arde ? (f.hasta - ahora) / 1000 : f.combustible;
  if (hay + s > FUEGO_MAX + 1e-6) return { ok: false, motivo: 'Ya tiene leña de sobra: espera a que arda.' };
  if (arde) f.hasta += s * 1000; else f.combustible += s;
  return { ok: true, encendida: arde, segundos: s };
}

// Encenderlo (quien llama gasta la yesca y mira que lleva el taladro).
export function encender(f, ahora) {
  asentar(f, ahora);
  if (f.hasta > ahora) return { ok: false, motivo: 'Ya está encendida.' };
  if (!(f.combustible > 0)) return { ok: false, motivo: 'No tiene nada que arder: échale ramas o leña.' };
  f.hasta = ahora + f.combustible * 1000; f.combustible = 0; f.cenizas = false;
  return { ok: true, hasta: f.hasta };
}

// El calor en (x, z) de los fuegos encendidos de estaciones (una lista de { x, z, fuego }): de 1 junto al fuego a 0 a
// RADIO_CALOR m; el del más cercano. Para el frío (hito de supervivencia).
export function calorEn(estaciones, x, z, ahora) {
  let c = 0;
  for (const e of estaciones) {
    if (!e || !encendida(e.fuego, ahora)) continue;
    c = Math.max(c, 1 - Math.hypot(e.x - x, e.z - z) / RADIO_CALOR);
  }
  return Math.max(0, c);
}
