// Kinhold — despiezar y asar (P4, «Un primer día con sentido»; documento de sistemas, apartado 4: «cazar → el animal
// cae → despiezar con cuchillo → productos → la carne se estropea con el tiempo si no se cocina o se conserva»; GDD,
// cocina: lo cocinado sacia más). Lógica pura (sin three.js ni navegador): la lleva el servidor y la usan las pruebas.
//
// - Despiezar: la liebre cazada (src/logica/caza.js) se despieza con las manos llevando la lasca de sílex (que no se
//   gasta): da 1 carne cruda y 1 piel (la «piel pequeña» del documento es la piel del catálogo). Es una receta de las
//   manos (src/logica/fabricacion.js, despiezar_liebre), así que vale la liebre que llevas o la del suelo a tu lado.
// - Asar: la carne cruda, al fuego (la hoguera o el hogar), da carne asada (receta asar_carne).
// - Comer: lo que quita cada una, en src/logica/necesidades.js (NUTRE): la asada, bastante más que la cruda.
// - Estropearse: la carne cruda dura VIDA ms desde que se despieza (lleva hasta cuándo, «hasta»: src/logica/inventario.js
//   lo copia y, al juntar dos montones, se queda el que antes se estropea). Pasada esa hora desaparece de donde esté:
//   lo que llevas encima o lo que hay en el suelo. Lo que no lleva hora (lo dejado en una estación, que se guarda
//   por cuentas) la recibe al volver a cogerlo.
//
// Decisiones provisionales (registro de la demo y diario, 9 nov; el documento no da cifras): la carne cruda dura un día
// de juego (3 horas reales: el hambre llega al máximo en hora y media, medio día); desaparece entera (no hay carne
// podrida que sirva de algo); lo asado no se estropea en este tramo (la carne seca y el ahumado, con sus estaciones).
export const VIDA = { carne_cruda: 3 * 3600 * 1000 };   // ms
export const seEstropea = tipo => Object.hasOwn(VIDA, tipo);

// Repasa una lista de cosas (y lo que llevan dentro): a lo que se estropea y no tiene hora se la pone; lo pasado se
// quita (poner(i, null)). Devuelve cuántas unidades se han estropeado y si algo ha cambiado.
function repasar(cosas, poner, ahora, cuenta) {
  cosas.forEach((c, i) => {
    if (!c || typeof c !== 'object') return;
    if (seEstropea(c.tipo)) {
      if (!Number.isFinite(c.hasta)) { c.hasta = ahora + VIDA[c.tipo]; cuenta.cambia = true; }
      else if (ahora >= c.hasta) { cuenta.estropeadas[c.tipo] = (cuenta.estropeadas[c.tipo] || 0) + c.n; poner(i, null); cuenta.cambia = true; return; }
    }
    if (Array.isArray(c.dentro)) repasar(c.dentro, (j, v) => { c.dentro[j] = v; }, ahora, cuenta);
  });
}

// Lo que lleva un inventario (src/logica/inventario.js: Inventario). Devuelve { cambia, estropeadas: { tipo: n } }.
export function estropearInventario(inv, ahora) {
  const cuenta = { cambia: false, estropeadas: {} };
  const claves = Object.keys(inv.lugares);
  repasar(claves.map(k => inv.lugares[k]), (i, v) => { inv.lugares[claves[i]] = v; }, ahora, cuenta);
  if (Array.isArray(inv.apartado)) { repasar(inv.apartado, (i, v) => { inv.apartado[i] = v; }, ahora, cuenta); inv.apartado = inv.apartado.filter(Boolean); }
  return cuenta;
}

// Lo que hay en el suelo (src/logica/suelo.js: Suelo). Devuelve { cambia, estropeadas }.
export function estropearSuelo(suelo, ahora) {
  const cuenta = { cambia: false, estropeadas: {} }, quitar = new Set();
  repasar(suelo.objetos.map(o => o.cosa), (i) => { quitar.add(suelo.objetos[i]); }, ahora, cuenta);
  if (quitar.size) suelo.objetos = suelo.objetos.filter(o => !quitar.has(o));
  return cuenta;
}
