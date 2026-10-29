// Recoger del suelo y de las plantas (documento de sistemas, apartado 3, nivel N0). Lógica pura (sin three.js ni
// navegador): el servidor podrá usarla tal cual.
//
// Lo que pide el nivel N0, con las manos:
//   Ramas caídas       — bosque            — recoger  — 1–3 ramas        (M) — vuelve en unos días reales
//   Piedra suelta      — ríos, laderas     — recoger  — 1 piedra         (M) — lento (semanas)
//   Sílex              — zonas calizas, ríos — recoger — 1 nódulo        (P) — lento
//   Fibra (ortiga, hierba larga) — claros, riberas — arrancar — 2–4 fibra cruda (P) — una estación
//
// Cada sitio de recogida es un punto del mundo que sale de una semilla y de las zonas del terreno (las mismas para
// todos). Al recogerlo se agota y vuelve a salir pasado su tiempo, contado por tiempo transcurrido: se guarda la hora
// a la que vuelve (milisegundos), no un contador que corra solo mientras se juega.
//
// Decisiones provisionales (el documento no las fija; anotadas en el registro de decisiones y en el diario):
//  - «Unos días reales» son 3 días; «lento (semanas)» son 3 semanas, también para el sílex.
//  - «Una estación» es un mes real: un año de juego son 4 meses reales (documento de sistemas, apartado 5).
//  - Lo que da cada vez (1–3 ramas, 2–4 de fibra) sale de un azar fijo por punto y por vez, para que el servidor y
//    las pruebas den lo mismo.
//  - Se recoge a 2 m como mucho y con las manos: si llevas algo grande (las dos manos ocupadas), no se puede.
//  - Lo recogido va a la mano o a los huecos donde quepa (junto a lo mismo primero); si no cabe entero, no se
//    recoge y el punto sigue ahí.
import { CATALOGO } from './inventario.js';

const DIA = 24 * 3600 * 1000;
export const TIEMPOS = { dias: 3 * DIA, semanas: 21 * DIA, estacion: 30 * DIA };
export const ALCANCE_RECOGER = 2; // m

// Qué se recoge en cada tipo de punto. donde: zonas del terreno en las que sale. da: tipo del catálogo y cuánto.
export const RECOLECTABLES = {
  ramas:        { nombre: 'Ramas caídas', donde: ['bosque'], con: 'manos', accion: 'recoger', da: 'rama', min: 1, max: 3, vuelve: TIEMPOS.dias },
  piedra:       { nombre: 'Piedra suelta', donde: ['rio', 'ladera'], con: 'manos', accion: 'recoger', da: 'piedra', min: 1, max: 1, vuelve: TIEMPOS.semanas },
  silex:        { nombre: 'Sílex', donde: ['caliza', 'rio'], con: 'manos', accion: 'recoger', da: 'silex', min: 1, max: 1, vuelve: TIEMPOS.semanas },
  ortiga:       { nombre: 'Ortigas', donde: ['claro', 'ribera'], con: 'manos', accion: 'arrancar', da: 'fibra', min: 2, max: 4, vuelve: TIEMPOS.estacion },
  hierba_larga: { nombre: 'Hierba larga', donde: ['claro', 'ribera'], con: 'manos', accion: 'arrancar', da: 'fibra', min: 2, max: 4, vuelve: TIEMPOS.estacion },
};

// azar fijo a partir de números (el mismo en el navegador y en el servidor)
function hash(...ns) {
  let h = 2166136261 >>> 0;
  for (const n of ns) { h ^= n >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
const numTexto = t => { let h = 0; for (const ch of t) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0; return h; };

// Cuánto da un punto la vez «vez» (0, 1, 2…).
export function cantidadDe(punto, vez) {
  const d = RECOLECTABLES[punto.tipo];
  return d.min + Math.floor(hash(numTexto(punto.id), vez, 7) * (d.max - d.min + 1));
}

// Reparte los puntos de recogida: para cada tipo, «cuantos[tipo]» puntos en sitios cuyas zonas (zonas(x, z) → lista
// de nombres) incluyan alguna de las del documento. Sitios dentro de un círculo de «radio» m alrededor de (cx, cz);
// libre(x, z) para no ponerlos dentro de un tronco o una roca. Siempre lo mismo con la misma semilla.
export function repartirPuntos({ semilla = 1, cuantos, zonas, radio = 120, cx = 0, cz = 0, libre = null, separacion = 1.2 }) {
  const puntos = [];
  for (const [tipo, n] of Object.entries(cuantos)) {
    const d = RECOLECTABLES[tipo]; if (!d) continue;
    let hechos = 0;
    for (let t = 0; hechos < n && t < n * 400; t++) {
      const a = hash(semilla, numTexto(tipo), t, 1) * Math.PI * 2, r = Math.sqrt(hash(semilla, numTexto(tipo), t, 2)) * radio;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const zs = zonas(x, z);
      if (!d.donde.some(w => zs.includes(w))) continue;
      if (libre && !libre(x, z)) continue;
      if (puntos.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < separacion * separacion)) continue;
      puntos.push({ id: `${tipo}:${hechos}`, tipo, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, giro: hash(semilla, numTexto(tipo), t, 3) * Math.PI * 2 });
      hechos++;
    }
  }
  return puntos;
}

// Los puntos de recogida de un mundo y su estado (cuándo vuelve cada uno y cuántas veces se ha recogido).
export const VERSION_RECOLECCION = 1;
export class Recoleccion {
  constructor(puntos) {
    this.puntos = puntos;
    this.porId = new Map(puntos.map(p => [p.id, p]));
    this.estado = {}; // id → { vuelve (ms), veces }
  }
  disponible(id, ahora) {
    if (!this.porId.has(id)) return false;
    const e = this.estado[id];
    return !e || ahora >= e.vuelve;
  }
  // Cuánto falta (ms) para que vuelva a salir; 0 si ya está.
  faltaPara(id, ahora) { const e = this.estado[id]; return e ? Math.max(0, e.vuelve - ahora) : 0; }
  // Los puntos que hay ahora a menos de «dist» m de (x, z), del más cercano al más lejano.
  cercanos(x, z, ahora, dist = ALCANCE_RECOGER) {
    return this.puntos.filter(p => this.disponible(p.id, ahora) && Math.hypot(p.x - x, p.z - z) <= dist)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }
  // Recoger el punto id estando en (x, z): lo recogido va al inventario inv por huecos (o a la ruta «a» si se da y cabe).
  recoger(inv, id, x, z, ahora, a) {
    const p = this.porId.get(id);
    if (!p) return { ok: false, motivo: 'Ahí no hay nada que recoger.' };
    if (!this.disponible(id, ahora)) return { ok: false, motivo: 'Ya lo han recogido: aún no ha vuelto a salir.' };
    if (Math.hypot(p.x - x, p.z - z) > ALCANCE_RECOGER) return { ok: false, motivo: 'Está demasiado lejos.' };
    if (inv.manoBloqueada('mano:der') || inv.manoBloqueada('mano:izq')) return { ok: false, motivo: 'Tienes las dos manos ocupadas.' };
    const d = RECOLECTABLES[p.tipo], veces = (this.estado[id] && this.estado[id].veces) || 0;
    const n = cantidadDe(p, veces);
    const r = inv.meterDonde(d.da, n, a);
    if (!r.ok) return r;
    this.estado[id] = { vuelve: ahora + d.vuelve, veces: veces + 1 };
    return { ok: true, objeto: d.da, cantidad: n, donde: r.donde, vuelve: this.estado[id].vuelve };
  }
  exportar() { return { version: VERSION_RECOLECCION, estado: Object.fromEntries(Object.entries(this.estado).map(([k, v]) => [k, { ...v }])) }; }
  // Lo guardado de puntos que ya no existen se descarta.
  importar(datos) {
    const d = migrarRecoleccion(datos);
    this.estado = {};
    if (!d) return this;
    for (const [id, e] of Object.entries(d.estado)) {
      if (!this.porId.has(id) || !e || !Number.isFinite(e.vuelve)) continue;
      this.estado[id] = { vuelve: e.vuelve, veces: Number.isInteger(e.veces) && e.veces > 0 ? e.veces : 1 };
    }
    return this;
  }
}

// Paso de formatos antiguos al de ahora: MIGRACIONES_RECOLECCION[v] pasa de v a v+1. Lo que no se entiende, se descarta.
export const MIGRACIONES_RECOLECCION = {};
export function migrarRecoleccion(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_RECOLECCION) { const paso = MIGRACIONES_RECOLECCION[d.version]; if (!paso) return null; d = paso(d); }
  if (!d || d.version !== VERSION_RECOLECCION || !d.estado || typeof d.estado !== 'object') return null;
  return d;
}

export const CLAVE_RECOLECCION = 'kinhold.recoleccion';
export function guardarRecoleccion(almacen, rec, clave = CLAVE_RECOLECCION) {
  try { almacen.setItem(clave, JSON.stringify(rec.exportar())); return true; } catch (e) { return false; }
}
export function cargarRecoleccion(almacen, rec, clave = CLAVE_RECOLECCION) {
  try { const t = almacen.getItem(clave); if (t) rec.importar(JSON.parse(t)); } catch (e) { /* roto o sin almacenamiento */ }
  return rec;
}

// ---------------- Acción con autor ----------------
// { autor, tipo: 'recoger', punto, x, z, a? } — x, z: dónde está el autor (el servidor usará la suya).
// ahora: la hora del que valida (el servidor o este navegador), nunca la que diga el mensaje.
// Lo recogido va al inventario del autor, nunca al de otro. Se anota en el registro, salga bien o no.
export function ejecutarRecoleccion(rec, invs, registro, accion, ahora) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'recoger') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!txt(a.punto) || !Number.isFinite(a.x) || !Number.isFinite(a.z) || (a.a !== undefined && !txt(a.a))) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else r = rec.recoger(invs.de(a.autor), a.punto, a.x, a.z, ahora, a.a);
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { objeto: r.objeto, cantidad: r.cantidad };
  return r;
}

// Nombre de lo que da un punto (para los avisos).
export const nombreDe = tipo => (CATALOGO[RECOLECTABLES[tipo].da] || {}).nombre;
