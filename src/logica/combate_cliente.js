// El combate visto desde un cliente en línea (hito 1f). Lógica pura (sin three.js ni websocket): la usa el
// «Duelo en línea» (src/combate/en_linea.js) y la prueba en node.
//
// Lo que vale es lo del servidor (src/logica/combate_servidor.js): él resuelve golpes, heridas y flechas. Aquí
// cada luchador (el propio y los de los demás) es una copia que se pone al día con lo que reparte el servidor
// (aplicarFoto), y entre una foto y otra avanza sola (Luchador.actualizar) para que la animación sea continua.
// Sus impactos no cuentan: los golpes y las heridas solo llegan como eventos del servidor.
//
// Para que el propio no espere a la red, lo que pulsa el jugador se hace enseguida en su copia (atacar, parar…)
// y se manda. Durante PREDICCION segundos su acción no se pisa con lo del servidor (que aún no la sabe), salvo
// lo que solo decide el servidor: quedar descolocado o caer. Las heridas, la sangre y el cansancio, siempre.

import { MARCAS_CURA } from './combate_servidor.js';
export const PREDICCION = 0.5;   // s: lo que se respeta la acción propia antes de seguir al servidor

// Pone al luchador L como dice la foto f del servidor. propio: es el del jugador; prediciendo: hace menos de
// PREDICCION que el jugador hizo algo (su acción aún no se pisa).
export function aplicarFoto(L, f, { propio = false, prediciendo = false } = {}) {
  if (!L || !f) return;
  if (L.arma !== f.arma && !(propio && prediciendo)) L.arma = f.arma;
  L.armadura = f.armadura;
  L.cansancio = f.cansancio;
  L.sangre = f.sangre;
  L.liza = !!f.liza;
  if (Array.isArray(f.lista)) {
    L.heridas = f.lista.map(([zona, gravedad, tipo, sangrado, marcas = '']) => {
      const h = { zona, gravedad, tipo, sangrado: +sangrado || 0 };
      for (const m of String(marcas)) if (MARCAS_CURA[m]) h[MARCAS_CURA[m]] = true;
      if (h.cauterizada) h.secuela = true;
      return h;
    });
  }
  if (f.botiquin && typeof f.botiquin === 'object') L.botiquin = { ...f.botiquin };
  // el contraataque: lo abre el servidor (tras una parada perfecta); aquí se lleva con el reloj de la copia
  if (f.contra) { if (!L.puedeContraatacar()) L.contraHasta = L.reloj + 0.8; } else L.contraHasta = -1;
  const manda = !propio || !prediciendo || f.fuera || f.accion === 'aturdido' || f.accion === 'caido' || (L.fuera && !f.fuera);
  L.fuera = !!f.fuera; L.motivoFuera = f.motivoFuera || '';
  if (!manda) return;
  if (L.accion !== f.accion || L.linea !== f.linea || Math.abs(L.tAccion * 1000 - f.tAccion) > 150) {
    L.accion = f.accion; L.linea = f.linea;
    L.duracion = f.duracion / 1000; L.tAccion = f.tAccion / 1000;
    if (f.accion === 'preparando') L.prepTotal = L.duracion;
  }
  L.bloqueando = !!f.bloqueando; L.guardia = f.guardia;
  L.tension = f.tension;
}

// Avanza una copia sin dejar que resuelva nada: devuelve sus eventos (que se tiran) y no la deja caer por su
// cuenta (desangrarse lo decide el servidor).
export function avanzarCopia(L, dt, corriendo = false) {
  const fuera = L.fuera, motivo = L.motivoFuera, accion = L.accion, sangre = L.sangre;
  L.actualizar(dt, corriendo);
  if (!fuera && L.fuera) { L.fuera = false; L.motivoFuera = motivo; L.accion = accion; L.sangre = Math.max(0.5, sangre); }
}

// Un evento de golpe del servidor, en el formato de resolverGolpe (el que entienden los textos y los efectos)
export function resultadoDeEvento(e) {
  const resultado = e.resultado === 'al aire' ? 'fallo' : e.resultado;
  return { ok: true, resultado, zona: e.zona, gravedad: e.gravedad, tipo: e.danio, nota: e.nota };
}

// El rival al que se encara el jugador: el más cercano en pie de los de su liza (lista de { autor, L })
export function rivalCercano(yo, otros) {
  let mejor = null, d0 = Infinity;
  for (const o of otros) {
    if (!o.L || !o.L.liza) continue;
    const d = Math.hypot(o.L.x - yo.x, o.L.z - yo.z) + (o.L.fuera ? 1000 : 0);
    if (d < d0) { d0 = d; mejor = o; }
  }
  return mejor;
}
