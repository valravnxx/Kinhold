// Tronzar y partir los troncos del suelo (documento de sistemas, apartado 3, «De los árboles»). Lógica pura (sin
// three.js ni navegador): el servidor podrá usarla tal cual.
//
// Lo que dice el documento:
//   Tronzar el tronco largo — hacha (lento) o sierra de tronzar (rápido, mejor entre dos) — 3–4 troncos cortos (G)
//   Partir tronco corto     — hacha + cuñas y mazo                                    — leña o medios troncos (M–G)
// Y la tarea del roadmap: el tronco corto se lleva con las dos manos o al hombro y la leña en el leñero (eso está en
// src/logica/inventario.js: el tronco corto se puede llevar al hombro).
//
// Se trocea lo que está en el suelo (src/logica/suelo.js), a golpes de hacha, como la tala: cada golpe es una acción
// con autor. Cuando el tronco lleva los golpes que pide, la pila pierde uno y al lado cae lo que da.
//
// Decisiones provisionales (el documento no las fija; anotadas en el registro de decisiones y en el diario):
//  - Mientras no haya sierra de tronzar ni cuñas y mazo (llegan con la fabricación), se tronza y se parte con el hacha
//    sola (la de piedra, la de hierro o la de mano, como al talar).
//  - Golpes: tronzar un tronco largo, 18 con hierro y 54 con piedra (más que talar un adulto: «lento»); partir un
//    tronco corto, 3 con hierro y 6 con piedra. Entre golpe y golpe del mismo autor, 0,8 s como poco (como al talar).
//  - El tronco largo da 3 o 4 troncos cortos, de un azar fijo por tronco; el corto da 6 de leña (el leñero lleva 18:
//    tres troncos partidos). Medios troncos, no: llegarán con lo que los pida (el documento dice «leña o medios»).
//  - Lo que da cae a 1,2 m del tronco, de lado (los troncos cortos, tumbados como estaba el largo), y se suma a una pila
//    de lo mismo si la hay a menos de 1 m, como todo lo que cae al suelo.
//  - Se trocea a 2,5 m del centro del tronco como mucho (el largo mide 4,5 m: se llega desde cualquier punto de él).
//  - Cualquiera puede trocear lo que hay en el suelo (el GDD no protege el suelo, tampoco el de tus tierras).
//  - Lo que llevan dado los golpes se queda en ese montón hasta que se termina; si la pila desaparece o se coge, se olvida.
//  - El tronco delgado no se tronza (es el de las obras); el bloque de piedra, con su tarea.
import { hachaEnMano } from './tala.js';

export const ALCANCE_TROCEO = 2.5;      // m, desde el centro del tronco
export const ENTRE_GOLPES = 800;        // ms
export const TROCEO = {
  tronco_largo: { accion: 'tronzar', golpes: { piedra: 54, hierro: 18 }, da: 'tronco_corto', n: [3, 4] },
  tronco_corto: { accion: 'partir', golpes: { piedra: 6, hierro: 3 }, da: 'lena', n: [6, 6] },
};
export const seTrocea = tipo => !!TROCEO[tipo];

function hash(...ns) {
  let h = 2166136261 >>> 0;
  for (const n of ns) { h ^= n >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
const numTexto = t => { let h = 0; for (const ch of t) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0; return h; };
const redondo = v => Math.round(v * 100) / 100;

// Cuánto da el objeto del suelo id al trocearlo la vez «vez» (0, 1, 2…: una pila de varios se trocea de uno en uno).
export function cuantoDa(tipo, id, vez) {
  const [a, b] = TROCEO[tipo].n;
  return a + Math.floor(hash(numTexto(String(id)), vez, 7) * (b - a + 1));
}

export class Troceo {
  constructor(suelo) {
    this.suelo = suelo;
    this.estado = {};       // id del objeto del suelo → { parte, golpes, veces }
    this.ultimoGolpe = {};  // autor → ms (no se guarda: solo frena los golpes demasiado seguidos)
    this.entre = ENTRE_GOLPES; // ms entre golpe y golpe del mismo autor (el servidor pide menos: la red los junta)
  }
  progreso(id) { const e = this.estado[id]; return e ? Math.min(1, e.parte) : 0; }
  // Olvida lo que ya no está en el suelo (se cogió, desapareció) o ha cambiado de tipo.
  limpiar(ahora) {
    for (const id of Object.keys(this.estado)) { const o = this.suelo.porId(id, ahora); if (!o || !seTrocea(o.cosa.tipo)) delete this.estado[id]; }
  }

  // Un golpe al objeto del suelo id con el inventario inv, estando en (x, z). enTierras(x, z): si ese sitio es de las
  // tierras del autor (para lo que cae). Si se termina, devuelve lo que cae.
  golpe(inv, id, x, z, ahora, autor, enTierras = () => false) {
    const o = this.suelo.porId(id, ahora);
    if (!o) return { ok: false, motivo: 'Ahí no hay nada que trocear.' };
    const t = TROCEO[o.cosa.tipo];
    if (!t) return { ok: false, motivo: 'Eso no se trocea.' };
    if (Math.hypot(o.x - x, o.z - z) > ALCANCE_TROCEO) return { ok: false, motivo: 'Está demasiado lejos.' };
    const h = hachaEnMano(inv);
    if (!h) return { ok: false, motivo: t.accion === 'tronzar' ? 'Necesitas un hacha en la mano para tronzar.' : 'Necesitas un hacha en la mano para partir leña.' };
    const ult = this.ultimoGolpe[autor];
    if (ult !== undefined && ahora - ult < this.entre) return { ok: false, motivo: 'Aún no has terminado el golpe anterior.' };
    this.ultimoGolpe[autor] = ahora;
    const e = this.estado[id] || (this.estado[id] = { parte: 0, golpes: 0, veces: 0 });
    const total = t.golpes[h.clase];
    e.golpes++; e.parte += 1 / total;
    const base = { accion: t.accion, tipo: o.cosa.tipo, hacha: h.tipo };
    if (e.parte < 1 - 1e-9) return { ok: true, termina: false, golpes: e.golpes, faltan: Math.max(1, Math.round((1 - e.parte) * total)), ...base };
    // terminado: la pila pierde uno y al lado cae lo que da
    const n = cuantoDa(o.cosa.tipo, id, e.veces);
    const giro = Number.isFinite(o.giro) ? o.giro : 0;
    // de lado: perpendicular a como está tumbado (los troncos del suelo se dibujan a lo largo de x, girados «giro»)
    const px = redondo(o.x + Math.sin(giro) * 1.2), pz = redondo(o.z + Math.cos(giro) * 1.2);
    const veces = e.veces + 1;
    o.cosa.n -= 1;
    if (o.cosa.n <= 0) { this.suelo.objetos = this.suelo.objetos.filter(x => x !== o); delete this.estado[id]; }
    else this.estado[id] = { parte: 0, golpes: 0, veces };
    const cae = this.suelo.dejar({ tipo: t.da, n }, px, pz, ahora, autor, !!enTierras(px, pz), t.da === 'lena' ? undefined : giro);
    return { ok: true, termina: true, golpes: e.golpes, faltan: 0, ...base, da: { tipo: t.da, n }, objeto: cae.id, queda: Math.max(0, o.cosa.n) };
  }

  // Lo que va a medias se guarda con el suelo (lo que no esté ya en el suelo se descarta al cargar).
  exportar() { return { version: 1, estado: JSON.parse(JSON.stringify(this.estado)) }; }
  importar(datos, ahora) {
    this.estado = {};
    if (!datos || datos.version !== 1 || !datos.estado || typeof datos.estado !== 'object') return this;
    for (const [id, e] of Object.entries(datos.estado)) {
      if (!e || typeof e !== 'object') continue;
      const parte = Number.isFinite(e.parte) ? Math.min(0.999, Math.max(0, e.parte)) : 0;
      this.estado[id] = { parte, golpes: Number.isInteger(e.golpes) && e.golpes > 0 ? e.golpes : 0, veces: Number.isInteger(e.veces) && e.veces > 0 ? e.veces : 0 };
    }
    this.limpiar(ahora);
    return this;
  }
}

export const CLAVE_TROCEO = 'kinhold.troceo';
export function guardarTroceo(almacen, tr, clave = CLAVE_TROCEO) {
  try { almacen.setItem(clave, JSON.stringify(tr.exportar())); return true; } catch (e) { return false; }
}
export function cargarTroceo(almacen, tr, ahora, clave = CLAVE_TROCEO) {
  try { const t = almacen.getItem(clave); if (t) tr.importar(JSON.parse(t), ahora); } catch (e) { /* roto o sin almacenamiento */ }
  return tr;
}

// ---------------- Acción con autor ----------------
// { autor, tipo: 'trocear', objeto, x, z } — un golpe de hacha a un tronco del suelo (tronzar el largo, partir el
// corto). x, z: dónde está el autor (el servidor usará la suya). ahora: la hora del que valida, nunca la del mensaje.
// enTierras(autor, x, z): si ese sitio es de las tierras del autor. Se anota en el registro, salga bien o no.
export function ejecutarTroceo(troceo, invs, registro, accion, ahora, enTierras = () => false) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'trocear') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!txt(a.objeto) || !Number.isFinite(a.x) || !Number.isFinite(a.z)) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else r = troceo.golpe(invs.de(a.autor), a.objeto, a.x, a.z, ahora, a.autor, (x, z) => enTierras(a.autor, x, z));
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = r.termina ? { termina: true, da: r.da } : { golpes: r.golpes };
  return r;
}
