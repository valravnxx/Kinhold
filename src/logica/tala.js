// Talar los árboles del mundo (documento de sistemas, apartado 3, «De los árboles»). Lógica pura (sin three.js ni
// navegador): el servidor podrá usarla tal cual.
//
// Lo que dice el documento:
//   Talar un árbol joven  — hacha de piedra o hierro                  — 1 tronco delgado + ramas (G)
//   Talar un árbol adulto — hacha de hierro (con piedra tarda mucho)  — 1 tronco largo + muchas ramas; queda tocón (E)
// Y la tarea del roadmap: el árbol cae, queda el tocón y vuelve a crecer en semanas reales, contado por tiempo
// transcurrido (se guarda la hora a la que vuelve, no un contador que corra solo mientras se juega).
//
// Cada golpe de hacha es una acción con autor. Cuando el árbol lleva los golpes que pide, cae hacia el lado contrario
// al del que tala y deja en el suelo, a lo largo de donde cae, el tronco y las ramas (src/logica/suelo.js: los troncos
// se quedan como pila; las ramas, como lo demás que hay en el suelo).
//
// Decisiones provisionales (el documento no las fija; anotadas en el registro de decisiones y en el diario):
//  - Joven o adulto sale del tamaño del árbol en el mundo: menos de 1,1 veces el tamaño de modelo, joven.
//  - Golpes: joven, 8 con piedra y 5 con hierro; adulto, 14 con hierro y 56 con piedra (cuatro veces más: «tarda
//    mucho»). Entre golpe y golpe del mismo autor, 0,8 s como poco (lo que dura el gesto).
//  - El hacha de mano (cabeza de hierro) tala como el hacha de hierro.
//  - Ramas: el joven da 2–4 y el adulto 6–9, de un azar fijo por árbol y por vez.
//  - Los dos dejan tocón. Vuelve a crecer: el joven en 3 semanas reales y el adulto en 6.
//  - Se tala a 1,8 m del centro del tronco como mucho, con el hacha en una mano (en cualquiera de las dos).
//  - Lo que llevan dado los golpes se queda en el árbol (la muesca no se cierra) hasta que cae.
import { CATALOGO } from './inventario.js';

const DIA = 24 * 3600 * 1000;
export const SEMANA = 7 * DIA;
export const ALCANCE_TALA = 1.8;        // m, desde el centro del tronco
export const ENTRE_GOLPES = 800;        // ms
export const ESCALA_ADULTO = 1.1;       // desde este tamaño del modelo, el árbol es adulto
export const HACHAS = { hacha_piedra: 'piedra', hacha_hierro: 'hierro', hacha_mano: 'hierro' };
export const GOLPES = { joven: { piedra: 8, hierro: 5 }, adulto: { piedra: 56, hierro: 14 } };
export const DA = {
  joven: { tronco: 'tronco_delgado', ramas: [2, 4], largo: 2.6, vuelve: 3 * SEMANA },
  adulto: { tronco: 'tronco_largo', ramas: [6, 9], largo: 4.5, vuelve: 6 * SEMANA },
};
export const edadDeEscala = s => (s >= ESCALA_ADULTO ? 'adulto' : 'joven');
// El nombre fijo de un árbol: su sitio en el mundo (el mismo en el navegador y en el servidor con la misma semilla).
export const idArbol = (x, z) => `arbol:${Math.round(x * 10)},${Math.round(z * 10)}`;

function hash(...ns) {
  let h = 2166136261 >>> 0;
  for (const n of ns) { h ^= n >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
const numTexto = t => { let h = 0; for (const ch of t) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0; return h; };
const redondo = v => Math.round(v * 100) / 100;

// Cuántas ramas da el árbol la vez «vez» (0, 1, 2…).
export function ramasDe(arbol, vez) {
  const [a, b] = DA[arbol.edad].ramas;
  return a + Math.floor(hash(numTexto(arbol.id), vez, 3) * (b - a + 1));
}
// El hacha que lleva en las manos el inventario inv (la de la derecha primero): { ruta, tipo, clase } o null.
export function hachaEnMano(inv) {
  for (const ruta of ['mano:der', 'mano:izq']) {
    const c = inv.lugares[ruta];
    if (c && HACHAS[c.tipo]) return { ruta, tipo: c.tipo, clase: HACHAS[c.tipo] };
  }
  return null;
}

export const VERSION_TALA = 1;
// arboles: [{ id, x, z, edad: 'joven' | 'adulto' }]
export class Tala {
  constructor(arboles) {
    this.arboles = arboles;
    this.porId = new Map(arboles.map(a => [a.id, a]));
    this.estado = {};       // id → { golpes, veces, caido?, vuelve?, dir? }  (dir: hacia dónde cayó, en radianes)
    this.ultimoGolpe = {};  // autor → ms (no se guarda: solo frena los golpes demasiado seguidos)
  }
  // ¿Está en pie? (no talado, o ya ha vuelto a crecer)
  enPie(id, ahora) { const e = this.estado[id]; return this.porId.has(id) && (!e || !e.vuelve || ahora >= e.vuelve); }
  // Los tocones de ahora: [{ arbol, caido, vuelve, dir }]
  tocones(ahora) {
    const r = [];
    for (const [id, e] of Object.entries(this.estado)) if (e.vuelve && ahora < e.vuelve) r.push({ arbol: this.porId.get(id), caido: e.caido, vuelve: e.vuelve, dir: e.dir });
    return r;
  }
  golpesPara(id, clase) { const a = this.porId.get(id); return a ? GOLPES[a.edad][clase] : 0; }
  // Lo que lleva dado (en fracción, de 0 a 1, con la clase de hacha de ahora; los golpes de otra hacha cuentan por su
  // parte: un golpe de piedra en un adulto es 1/56 del árbol).
  progreso(id) { const e = this.estado[id]; return e && !e.vuelve ? Math.min(1, e.parte || 0) : 0; }

  // Un golpe al árbol id con el inventario inv, estando en (x, z). Si cae, devuelve lo que deja en el suelo.
  golpe(inv, id, x, z, ahora, autor) {
    const a = this.porId.get(id);
    if (!a) return { ok: false, motivo: 'Ahí no hay ningún árbol.' };
    if (!this.enPie(id, ahora)) return { ok: false, motivo: 'Ese árbol ya está talado: solo queda el tocón.' };
    if (Math.hypot(a.x - x, a.z - z) > ALCANCE_TALA) return { ok: false, motivo: 'Está demasiado lejos.' };
    const h = hachaEnMano(inv);
    if (!h) return { ok: false, motivo: 'Necesitas un hacha en la mano para talar.' };
    const ult = this.ultimoGolpe[autor];
    if (ult !== undefined && ahora - ult < ENTRE_GOLPES) return { ok: false, motivo: 'Aún no has terminado el golpe anterior.' };
    this.ultimoGolpe[autor] = ahora;
    let e = this.estado[id];
    if (!e || e.vuelve) e = this.estado[id] = { golpes: 0, parte: 0, veces: e ? e.veces : 0 };
    const total = GOLPES[a.edad][h.clase];
    e.golpes++; e.parte = (e.parte || 0) + 1 / total;
    if (e.parte < 1 - 1e-9) return { ok: true, cae: false, golpes: e.golpes, faltan: Math.max(1, Math.round((1 - e.parte) * total)), hacha: h.tipo };
    // cae hacia el lado contrario al del que tala
    const dir = Math.atan2(a.x - x, a.z - z), d = DA[a.edad], ramas = ramasDe(a, e.veces || 0);
    const sx = Math.sin(dir), sz = Math.cos(dir), en = t => ({ x: redondo(a.x + sx * t), z: redondo(a.z + sz * t) });
    const deja = [{ tipo: d.tronco, n: 1, ...en(d.largo * 0.5 + 0.7) }, { tipo: 'rama', n: ramas, ...en(d.largo + 1.1) }];
    this.estado[id] = { golpes: 0, parte: 0, veces: (e.veces || 0) + 1, caido: ahora, vuelve: ahora + d.vuelve, dir: redondo(dir) };
    return { ok: true, cae: true, golpes: e.golpes, faltan: 0, hacha: h.tipo, dir: redondo(dir), deja, vuelve: ahora + d.vuelve };
  }

  exportar() { return { version: VERSION_TALA, estado: Object.fromEntries(Object.entries(this.estado).map(([k, v]) => [k, { ...v }])) }; }
  // Lo guardado de árboles que ya no existen se descarta.
  importar(datos) {
    const d = migrarTala(datos);
    this.estado = {};
    if (!d) return this;
    const num = v => Number.isFinite(v);
    for (const [id, e] of Object.entries(d.estado)) {
      if (!this.porId.has(id) || !e || typeof e !== 'object') continue;
      const x = { golpes: Number.isInteger(e.golpes) && e.golpes > 0 ? e.golpes : 0, parte: num(e.parte) ? Math.min(1, Math.max(0, e.parte)) : 0,
        veces: Number.isInteger(e.veces) && e.veces > 0 ? e.veces : 0 };
      if (num(e.vuelve)) Object.assign(x, { caido: num(e.caido) ? e.caido : e.vuelve, vuelve: e.vuelve, dir: num(e.dir) ? e.dir : 0, golpes: 0, parte: 0 });
      this.estado[id] = x;
    }
    return this;
  }
}

// Paso de formatos antiguos al de ahora: MIGRACIONES_TALA[v] pasa de v a v+1. Lo que no se entiende, se descarta.
export const MIGRACIONES_TALA = {};
export function migrarTala(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_TALA) { const paso = MIGRACIONES_TALA[d.version]; if (!paso) return null; d = paso(d); }
  if (!d || d.version !== VERSION_TALA || !d.estado || typeof d.estado !== 'object') return null;
  return d;
}

export const CLAVE_TALA = 'kinhold.tala';
export function guardarTala(almacen, tala, clave = CLAVE_TALA) {
  try { almacen.setItem(clave, JSON.stringify(tala.exportar())); return true; } catch (e) { return false; }
}
export function cargarTala(almacen, tala, clave = CLAVE_TALA) {
  try { const t = almacen.getItem(clave); if (t) tala.importar(JSON.parse(t)); } catch (e) { /* roto o sin almacenamiento */ }
  return tala;
}

// ---------------- Acción con autor ----------------
// { autor, tipo: 'talar', arbol, x, z } — un golpe de hacha. x, z: dónde está el autor (el servidor usará la suya).
// ahora: la hora del que valida (el servidor o este navegador), nunca la que diga el mensaje.
// suelo: un Suelo (src/logica/suelo.js) donde cae lo que deja el árbol, a nombre del autor. Se anota en el registro,
// salga bien o no.
export function ejecutarTala(tala, invs, suelo, registro, accion, ahora) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'talar') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!txt(a.arbol) || !Number.isFinite(a.x) || !Number.isFinite(a.z)) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    r = tala.golpe(invs.de(a.autor), a.arbol, a.x, a.z, ahora, a.autor);
    // el tronco, tumbado a lo largo de donde cayó (los troncos del suelo se dibujan a lo largo de x)
    if (r.ok && r.cae) r.objetos = r.deja.map(o => suelo.dejar({ tipo: o.tipo, n: o.n }, o.x, o.z, ahora, a.autor, false, o.tipo === 'rama' ? r.dir : r.dir - Math.PI / 2).id);
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = r.cae ? { cae: true, deja: r.deja.map(o => ({ tipo: o.tipo, n: o.n })) } : { golpes: r.golpes };
  return r;
}

export const nombreTronco = edad => (CATALOGO[DA[edad].tronco] || {}).nombre;
