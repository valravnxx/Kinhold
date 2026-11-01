// Lo que el servidor manda a cada jugador, por trozos del mundo (hito «El juego en el mundo de verdad»). Lógica pura
// (sin three.js ni websocket): la usan el servidor y las pruebas.
//
// El mundo se parte en trozos cuadrados de LADO_RED m (en las coordenadas de la escena en línea: metros desde la
// salida). A cada jugador se le manda lo que ha cambiado (lo talado, lo recogido y lo que hay en el suelo) solo de los
// trozos que tiene alrededor: los de hasta RADIO_RED trozos de distancia del suyo (un cuadro de 5 × 5 trozos). Cuando
// cambia de trozo, se le mandan los que le entran; los que le salen se olvidan, y si vuelve se le mandan otra vez (así
// le llega lo que haya cambiado mientras estaba lejos). Lo que cambia en un trozo se reparte solo a quien lo tiene.
//
// Decisión provisional (1 nov): LADO_RED 128 m y RADIO_RED 2. Con el jugador en cualquier punto de su trozo, lo
// mandado llega al menos a 256 m de él en cada dirección, más que los 200 m hasta los que el navegador pone árboles
// en PC (MEDIDAS_VEGETACION.cuadro; 130 m en el móvil).
//
// También se guarda por trozo (objetos.json, versión 3): lo talado y lo recogido van agrupados por el trozo en que
// está cada árbol o cada punto (ver agrupar y desagrupar).

export const LADO_RED = 128;   // m
export const RADIO_RED = 2;    // trozos alrededor del del jugador

export const trozoDe = (x, z) => `${Math.floor(x / LADO_RED)},${Math.floor(z / LADO_RED)}`;

// Las claves de los trozos alrededor de (x, z).
export function trozosAlrededor(x, z, radio = RADIO_RED) {
  const i0 = Math.floor(x / LADO_RED), j0 = Math.floor(z / LADO_RED), r = new Set();
  for (let j = j0 - radio; j <= j0 + radio; j++) for (let i = i0 - radio; i <= i0 + radio; i++) r.add(`${i},${j}`);
  return r;
}

// Lo que tiene cada jugador: el trozo en que está y los trozos que ya se le han mandado.
export class VistaTrozos {
  constructor(radio = RADIO_RED) { this.radio = radio; this.de = new Map(); }   // autor → { trozo, tiene: Set }
  // Pone al jugador en (x, z). Devuelve los trozos que le entran (todos la primera vez; vacío si sigue en el mismo).
  mover(autor, x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return [];
    const t = trozoDe(x, z), v = this.de.get(autor);
    if (v && v.trozo === t) return [];
    const ahora = trozosAlrededor(x, z, this.radio);
    const entran = [...ahora].filter(k => !v || !v.tiene.has(k));
    this.de.set(autor, { trozo: t, tiene: ahora });
    return entran;
  }
  tiene(autor, clave) { const v = this.de.get(autor); return !!v && v.tiene.has(clave); }
  trozosDe(autor) { const v = this.de.get(autor); return v ? v.tiene : new Set(); }
  quitar(autor) { this.de.delete(autor); }
}

// De un estado { id: … } (el de Tala o Recoleccion), lo de los trozos dados. sitio(id) → { x, z } o null (lo que no
// tiene sitio conocido no se manda).
export function estadoEnTrozos(estado, sitio, trozos) {
  const r = {};
  for (const [id, e] of Object.entries(estado || {})) {
    const p = sitio(id);
    if (p && trozos.has(trozoDe(p.x, p.z))) r[id] = e;
  }
  return r;
}

// Para guardar: una lista de cosas con sitio ({ id, x, z, … }) y su estado, agrupadas por trozo:
// { "i,j": { cosas: [...], estado: { id: … } } }.
export function agrupar(cosas, estado) {
  const r = {};
  for (const c of cosas) {
    const k = trozoDe(c.x, c.z);
    const t = r[k] || (r[k] = { cosas: [], estado: {} });
    t.cosas.push({ ...c });
    if (estado && Object.hasOwn(estado, c.id)) t.estado[c.id] = { ...estado[c.id] };
  }
  return r;
}
// Y al revés: { cosas, estado } de todos los trozos juntos (lo que no tiene forma se descarta).
export function desagrupar(trozos) {
  const cosas = [], estado = {};
  if (!trozos || typeof trozos !== 'object' || Array.isArray(trozos)) return { cosas, estado };
  for (const t of Object.values(trozos)) {
    if (!t || typeof t !== 'object') continue;
    if (Array.isArray(t.cosas)) cosas.push(...t.cosas);
    if (t.estado && typeof t.estado === 'object' && !Array.isArray(t.estado)) Object.assign(estado, t.estado);
  }
  return { cosas, estado };
}
