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
//
// El hogar de la casa (revisión del 1 nov: «hogar dentro de la casa, fijo, más duradero»; P3): el mismo fuego, con lo
// suyo (COMO[tipo]). Provisional (diario y registro, 8 nov):
//  - Más duradero: lo que se le echa arde 1,5 veces más (el lecho de piedra y barro guarda el calor) y caben 2 h de
//    fuego por delante. Recién hecho no tiene nada puesto (su coste es piedra y barro): hay que echarle ramas o leña.
//  - Se puede dejar en brasas (cubrirlo con su ceniza, como se hacía de noche): sin llama ni humo, con la mitad del
//    calor y poca luz, y lo que le quedaba arde 4 veces más despacio. Desde las brasas se aviva sin yesca ni taladro
//    (vuelve la llama con lo que le quede). Si se acaban, se apaga (cenizas). Con brasas no se fabrica: hace falta llama.
//  - Mientras arde (con llama o en brasas) no se quita.
//  e.fuego.brasas: si está en brasas; entonces hasta es la hora a la que se acaban.

export const ARDE = { rama: 180, lena: 600 };   // s de fuego por cada una
export const FUEGO_MAX = 3600;                  // s de fuego por delante, como mucho
export const RAMAS_HOGUERA = 4;                 // las de su coste: quedan puestas
export const RADIO_CALOR = 4;                   // m
export const RADIO_LUZ = 9;                     // m
export const YESCAS = ['yesca'];                // lo que prende (la de fibra, la de corteza y la del hongo son la misma yesca)
export const HERRAMIENTA_FUEGO = 'taladro_fuego';
export const BRASAS_LENTO = 4;                  // en brasas, lo que queda arde 4 veces más despacio
export const CALOR_BRASAS = 0.5;                // y calienta la mitad
// Lo de cada fuego: dura (cuánto más arde lo que se le echa), max (s de fuego por delante), puestas (s que trae al
// levantarlo) y brasas (si se puede dejar en brasas).
export const COMO = {
  hoguera: { dura: 1, max: FUEGO_MAX, puestas: RAMAS_HOGUERA * ARDE.rama, brasas: false },
  hogar:   { dura: 1.5, max: 2 * FUEGO_MAX, puestas: 0, brasas: true },
};
const como = tipo => COMO[tipo] || COMO.hoguera;

// El fuego de una hoguera (o de un hogar) recién levantado: apagado, con lo que traiga puesto.
export const fuegoNuevo = (tipo = 'hoguera') => ({ hasta: 0, combustible: como(tipo).puestas, cenizas: false });

// Lo guardado que vale (o uno nuevo si no vale).
export function limpiarFuego(f, tipo = 'hoguera') {
  if (!f || typeof f !== 'object') return fuegoNuevo(tipo);
  const hasta = Number.isFinite(f.hasta) && f.hasta > 0 ? f.hasta : 0;
  const combustible = Number.isFinite(f.combustible) ? Math.max(0, Math.min(como(tipo).max, f.combustible)) : 0;
  return { hasta, combustible, cenizas: !!f.cenizas, ...(f.brasas && hasta && como(tipo).brasas ? { brasas: true } : {}) };
}

// Si ya se ha apagado (o se le han acabado las brasas), lo deja apagado y con cenizas.
export function asentar(f, ahora) {
  if (f.hasta && f.hasta <= ahora) { f.hasta = 0; f.cenizas = true; delete f.brasas; }
  return f;
}

// Cómo está: { encendida (con llama), brasas (en brasas), queda (s que le quedan con llama o en brasas), combustible
// (s puestos sin arder), cenizas }.
export function estadoFuego(f, ahora) {
  if (!f) return { encendida: false, brasas: false, queda: 0, combustible: 0, cenizas: false };
  const vivo = f.hasta > ahora, brasas = vivo && !!f.brasas, encendida = vivo && !brasas;
  return { encendida, brasas, queda: vivo ? (f.hasta - ahora) / 1000 : 0, combustible: f.combustible || 0, cenizas: vivo ? false : !!(f.cenizas || f.hasta) };
}
export const encendida = (f, ahora) => !!f && f.hasta > ahora && !f.brasas;
export const vivo = (f, ahora) => !!f && f.hasta > ahora; // con llama o en brasas

// Echarle una cosa (tipo: 'rama' o 'lena'). No gasta nada: eso lo hace quien llama, si sale bien. En brasas, se queda
// en brasas (arde despacio) hasta que se aviva.
export function echar(f, tipo, ahora, deTipo = 'hoguera') {
  if (!Object.hasOwn(ARDE, tipo)) return { ok: false, motivo: 'Al fuego solo se echan ramas o leña.' };
  asentar(f, ahora);
  const c = como(deTipo), s = ARDE[tipo] * c.dura, arde = f.hasta > ahora, lento = arde && f.brasas ? BRASAS_LENTO : 1;
  const hay = arde ? (f.hasta - ahora) / 1000 / lento : f.combustible;
  if (hay + s > c.max + 1e-6) return { ok: false, motivo: 'Ya tiene leña de sobra: espera a que arda.' };
  if (arde) f.hasta += s * lento * 1000; else f.combustible += s;
  return { ok: true, encendida: arde && !f.brasas, brasas: arde && !!f.brasas, segundos: s };
}

// Encenderlo (quien llama gasta la yesca y mira que lleva el taladro). En brasas, mejor avivar().
export function encender(f, ahora) {
  asentar(f, ahora);
  if (f.hasta > ahora) return { ok: false, motivo: f.brasas ? 'Está en brasas: avívalo.' : 'Ya está encendida.' };
  if (!(f.combustible > 0)) return { ok: false, motivo: 'No tiene nada que arder: échale ramas o leña.' };
  f.hasta = ahora + f.combustible * 1000; f.combustible = 0; f.cenizas = false;
  return { ok: true, hasta: f.hasta };
}

// Dejarlo en brasas (solo el fuego que lo admite y con llama): lo que le queda arde BRASAS_LENTO veces más despacio.
export function dejarEnBrasas(f, ahora, deTipo = 'hoguera') {
  asentar(f, ahora);
  if (!como(deTipo).brasas) return { ok: false, motivo: 'Este fuego no se deja en brasas.' };
  if (!(f.hasta > ahora)) return { ok: false, motivo: 'No está encendido.' };
  if (f.brasas) return { ok: false, motivo: 'Ya está en brasas.' };
  f.hasta = ahora + (f.hasta - ahora) * BRASAS_LENTO; f.brasas = true;
  return { ok: true, hasta: f.hasta };
}

// Avivarlo desde las brasas (sin yesca ni taladro): vuelve la llama con lo que le quede.
export function avivar(f, ahora) {
  asentar(f, ahora);
  if (!(f.hasta > ahora && f.brasas)) return { ok: false, motivo: 'No está en brasas.' };
  f.hasta = ahora + (f.hasta - ahora) / BRASAS_LENTO; delete f.brasas;
  return { ok: true, hasta: f.hasta };
}

// El calor en (x, z) de los fuegos encendidos de estaciones (una lista de { x, z, fuego }): de 1 junto al fuego a 0 a
// RADIO_CALOR m (en brasas, la mitad); el mayor. Para el frío (hito de supervivencia).
export function calorEn(estaciones, x, z, ahora) {
  let c = 0;
  for (const e of estaciones) {
    if (!e || !vivo(e.fuego, ahora)) continue;
    c = Math.max(c, (e.fuego.brasas ? CALOR_BRASAS : 1) * (1 - Math.hypot(e.x - x, e.z - z) / RADIO_CALOR));
  }
  return Math.max(0, c);
}
