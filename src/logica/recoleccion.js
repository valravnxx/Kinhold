// Recoger del suelo y de las plantas (documento de sistemas, apartado 3, nivel N0). Lógica pura (sin three.js ni
// navegador): el servidor podrá usarla tal cual.
//
// Lo que pide el nivel N0, con las manos:
//   Ramas caídas       — bosque            — recoger  — 1–3 ramas        (M) — vuelve en unos días reales
//   Piedra suelta      — ríos, laderas     — recoger  — 1 piedra         (M) — lento (semanas)
//   (y algo de piedra y de sílex sueltos en el claro, menos que en su sitio: valravnx, 1 nov)
//   Sílex              — zonas calizas, ríos — recoger — 1 nódulo        (P) — lento
//   Fibra (ortiga, hierba larga) — claros, riberas — arrancar — 2–4 fibra cruda (P) — una estación
// Y lo que pide la casa humilde y la hoguera (tarea «Materiales del tramo que no tenían origen», 7 nov):
//   Juncos             — riberas (y la orilla) — cuchillo — cortar — 1 haz de juncos (M) — una estación
//   Barro              — la orilla de los ríos — palo cavador o pala — cavar — 1 cesta de barro (M) — inagotable
//   Yesca              — hongos yesqueros en los tocones viejos del bosque — manos — 1–2 yesca (P) — una estación
// Y para comer (P4): bayas (los arbustos del bosque y los claros) y setas (el suelo del bosque), 3–6 cada vez.
//   (y con las manos, de la fibra seca o de la corteza: recetas en src/logica/fabricacion.js)
// Y desbrozar (valravnx, 8 nov; GDD apartado 8 y sistemas apartado 3): los matorrales del mundo (los de la vegetación,
// src/logica/vegetacion.js: cada uno es un punto «matorral:…» por su sitio, idMata) y los arbustos de bayas se quitan
// con el hacha de piedra (o con la lasca, más despacio: los golpes los da el navegador, src/juego/main.js) y dan
// 2–4 ramas y a veces una vara; el sitio se queda vacío (quitado) y rebrota en una estación. Al arbusto de bayas se le
// van también las bayas. Lo cortado cae al suelo donde estaba la mata, como lo que deja un árbol talado (se coge del
// suelo; fuera de tu tierra desaparece pasada una hora, src/logica/suelo.js).
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
//  - Lo que pide herramienta (los juncos, un cuchillo: la lasca de sílex vale; el barro, el palo cavador o la pala)
//    basta con llevarla encima, en la mano o guardada (decisión provisional, 7 nov). «Manos (poco)» del barro no se
//    hace: sin palo no se cava.
//  - El barro es «inagotable»: el sitio no se agota (se cava una cesta cada vez, sin espera).
//  - Lo recogido va a la mano o a los huecos donde quepa (junto a lo mismo primero); si no cabe entero, no se
//    recoge y el punto sigue ahí.
import { CATALOGO } from './inventario.js';

const DIA = 24 * 3600 * 1000;
export const TIEMPOS = { dias: 3 * DIA, semanas: 21 * DIA, estacion: 30 * DIA };
export const ALCANCE_RECOGER = 2; // m
// Lo que vale para cada «con» (lo que pide el documento): basta con llevar una de ellas encima.
export const HERRAMIENTAS_RECOGER = {
  cuchillo: ['lasca_silex', 'cuchillo'],
  cavar: ['palo_cavador', 'pala_madera'],
  desbrozar: ['hacha_piedra', 'hacha_hierro', 'hacha_mano', 'lasca_silex', 'cuchillo'],
};
// Con qué se desbroza más deprisa: los golpes que da el navegador antes de mandar la acción (decisión provisional).
export const GOLPES_DESBROCE = { hacha_hierro: 2, hacha_mano: 2, hacha_piedra: 3, lasca_silex: 6, cuchillo: 5 };
export const QUE_PIDE = { cuchillo: 'Necesitas un cuchillo o una lasca de sílex para cortarlos.', cavar: 'Necesitas un palo cavador o una pala para cavar el barro.', desbrozar: 'Necesitas un hacha o una lasca de sílex para desbrozarlo.' };

// Qué se recoge en cada tipo de punto. donde: zonas del terreno en las que sale. da: tipo del catálogo y cuánto.
export const RECOLECTABLES = {
  ramas:        { nombre: 'Ramas caídas', donde: ['bosque'], con: 'manos', accion: 'recoger', da: 'rama', min: 1, max: 3, vuelve: TIEMPOS.dias },
  piedra:       { nombre: 'Piedra suelta', donde: ['rio', 'ladera', 'claro'], con: 'manos', accion: 'recoger', da: 'piedra', min: 1, max: 1, vuelve: TIEMPOS.semanas },
  silex:        { nombre: 'Sílex', donde: ['caliza', 'rio', 'claro'], con: 'manos', accion: 'recoger', da: 'silex', min: 1, max: 1, vuelve: TIEMPOS.semanas },
  ortiga:       { nombre: 'Ortigas', donde: ['claro', 'ribera'], con: 'manos', accion: 'arrancar', da: 'fibra', min: 2, max: 4, vuelve: TIEMPOS.estacion },
  hierba_larga: { nombre: 'Hierba larga', donde: ['claro', 'ribera'], con: 'manos', accion: 'arrancar', da: 'fibra', min: 2, max: 4, vuelve: TIEMPOS.estacion },
  juncos:       { nombre: 'Juncos', donde: ['rio', 'ribera'], con: 'cuchillo', accion: 'cortar', da: 'junco', min: 1, max: 1, vuelve: TIEMPOS.estacion },
  barro:        { nombre: 'Barro de la orilla', donde: ['rio', 'ribera'], con: 'cavar', accion: 'cavar', da: 'barro', min: 1, max: 1, vuelve: 0 },
  yesquero:     { nombre: 'Hongos yesqueros', donde: ['bosque'], con: 'manos', accion: 'recoger', da: 'yesca', min: 1, max: 2, vuelve: TIEMPOS.estacion },
  // (P4) lo que se come sin cazar (documento de sistemas, apartado 3: «Bayas, setas, frutos secos — bosque (según
  // estación) — manos — recoger — 3–6 unidades — la siguiente temporada»). El arbusto de las bayas se queda: lo que se
  // va son las bayas (src/juego/recoleccion.js). Decisión provisional: salen todo el año (aún no hay estaciones) y
  // vuelven en una estación.
  bayas:        { nombre: 'Arbusto de bayas', donde: ['bosque', 'claro'], con: 'manos', accion: 'recoger', da: 'bayas', min: 3, max: 6, vuelve: TIEMPOS.estacion },
  setas:        { nombre: 'Setas', donde: ['bosque'], con: 'manos', accion: 'recoger', da: 'setas', min: 3, max: 6, vuelve: TIEMPOS.estacion },
  // los matorrales de la vegetación: no se recogen, se desbrozan (no salen en recogida_mundo: donde vacío)
  matorral:     { nombre: 'Matorral', donde: [], con: 'desbrozar', accion: 'desbrozar', da: 'rama', min: 2, max: 4, vuelve: TIEMPOS.estacion, soloDesbroce: true },
};
// Lo que se desbroza (y lo que da: ramas, y una vara con PROB_VARA). Decisión provisional (8 nov): una vara de cada dos
// o tres matas, y en una estación vuelve a estar.
export const DESBROZABLES = new Set(['matorral', 'bayas']);
export const DESBROCE = { da: 'rama', min: 2, max: 4, extra: 'vara', probExtra: 0.4, vuelve: TIEMPOS.estacion };
// El nombre fijo de un matorral: su sitio en la escena (el mismo en el navegador y en el servidor con la misma semilla).
export const idMata = (x, z) => `matorral:${Math.round(x * 10)},${Math.round(z * 10)}`;
// Si lleva encima con qué desbrozar (la mejor que lleve, por GOLPES_DESBROCE), o null.
export function conQueDesbroza(inv) {
  const l = HERRAMIENTAS_RECOGER.desbrozar.filter(t => inv.cuantos(t) > 0);
  return l.sort((a, b) => GOLPES_DESBROCE[a] - GOLPES_DESBROCE[b])[0] || null;
}
// Si inv lleva encima lo que pide un punto de tipo «tipo» (true si no pide nada).
export function tieneCon(inv, tipo) {
  const l = HERRAMIENTAS_RECOGER[RECOLECTABLES[tipo].con];
  return !l || l.some(t => inv.cuantos(t) > 0);
}

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
  // En el mundo, los puntos llegan y se van con los trozos de alrededor del jugador (src/logica/recogida_mundo.js): lo
  // recogido de un punto que se va se guarda igual (en estado), y vuelve con él.
  anadir(lista) {
    for (const p of lista) if (!this.porId.has(p.id)) { this.puntos.push(p); this.porId.set(p.id, p); }
  }
  quitar(ids) {
    const fuera = new Set(ids); if (!fuera.size) return;
    this.puntos = this.puntos.filter(p => !fuera.has(p.id));
    for (const id of fuera) this.porId.delete(id);
  }
  disponible(id, ahora) {
    if (!this.porId.has(id)) return false;
    const e = this.estado[id];
    return !e || ahora >= e.vuelve;
  }
  // Si lo que hay en id sigue en pie (no desbrozado, o ya ha rebrotado); lo de los puntos que no se conocen también.
  enPie(id, ahora) { const e = this.estado[id]; return !e || !e.quitado || ahora >= e.vuelve; }
  // Cuánto falta (ms) para que vuelva a salir; 0 si ya está.
  faltaPara(id, ahora) { const e = this.estado[id]; return e ? Math.max(0, e.vuelve - ahora) : 0; }
  // Los puntos que hay ahora a menos de «dist» m de (x, z), del más cercano al más lejano.
  cercanos(x, z, ahora, dist = ALCANCE_RECOGER) {
    return this.puntos.filter(p => !RECOLECTABLES[p.tipo].soloDesbroce && this.disponible(p.id, ahora) && Math.hypot(p.x - x, p.z - z) <= dist)
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
    if (d.soloDesbroce) return { ok: false, motivo: 'Eso no se recoge: se desbroza con un hacha.' };
    if (!tieneCon(inv, p.tipo)) return { ok: false, motivo: QUE_PIDE[d.con] };
    const n = cantidadDe(p, veces);
    const r = inv.meterDonde(d.da, n, a);
    if (!r.ok) return r;
    this.estado[id] = { vuelve: ahora + d.vuelve, veces: veces + 1 };
    return { ok: true, objeto: d.da, cantidad: n, donde: r.donde, vuelve: this.estado[id].vuelve };
  }
  // Desbrozar lo que hay en id (un matorral o un arbusto de bayas) estando en (x, z). Devuelve lo que deja en el suelo
  // (deja: [{ tipo, n, x, z }]: las ramas y la vara, si sale); el sitio queda quitado hasta que rebrota.
  desbrozar(inv, id, x, z, ahora) {
    const p = this.porId.get(id);
    if (!p || !DESBROZABLES.has(p.tipo)) return { ok: false, motivo: 'Ahí no hay nada que desbrozar.' };
    if (!this.enPie(id, ahora)) return { ok: false, motivo: 'Ya está desbrozado: aún no ha rebrotado.' };
    if (Math.hypot(p.x - x, p.z - z) > ALCANCE_RECOGER) return { ok: false, motivo: 'Está demasiado lejos.' };
    if (inv.manoBloqueada('mano:der') || inv.manoBloqueada('mano:izq')) return { ok: false, motivo: 'Tienes las dos manos ocupadas.' };
    if (inv.hombroCargado()) return { ok: false, motivo: 'Con algo al hombro no puedes desbrozar.' };
    const con = conQueDesbroza(inv);
    if (!con) return { ok: false, motivo: QUE_PIDE.desbrozar };
    const veces = (this.estado[id] && this.estado[id].veces) || 0, D = DESBROCE;
    const n = D.min + Math.floor(hash(numTexto(id), veces, 11) * (D.max - D.min + 1));
    const extra = hash(numTexto(id), veces, 13) < D.probExtra ? 1 : 0;
    this.estado[id] = { vuelve: ahora + D.vuelve, veces: veces + 1, quitado: true };
    const deja = [{ tipo: D.da, n, x: p.x, z: p.z }];
    if (extra) deja.push({ tipo: D.extra, n: extra, x: Math.round((p.x + 0.4) * 100) / 100, z: Math.round((p.z + 0.25) * 100) / 100 });
    return { ok: true, objeto: D.da, cantidad: n, extra: extra ? { objeto: D.extra, cantidad: extra } : null, con, deja, vuelve: this.estado[id].vuelve };
  }
  exportar() { return { version: VERSION_RECOLECCION, estado: Object.fromEntries(Object.entries(this.estado).map(([k, v]) => [k, { ...v }])) }; }
  // Lo guardado de puntos que ya no existen se descarta; con { todo: true } se guarda también lo de los puntos que aún
  // no están (en el mundo, los de los trozos que no se han hecho).
  importar(datos, { todo = false } = {}) {
    const d = migrarRecoleccion(datos);
    this.estado = {};
    if (!d) return this;
    for (const [id, e] of Object.entries(d.estado)) {
      if ((!todo && !this.porId.has(id)) || !e || !Number.isFinite(e.vuelve)) continue;
      this.estado[id] = { vuelve: e.vuelve, veces: Number.isInteger(e.veces) && e.veces > 0 ? e.veces : 1, ...(e.quitado === true ? { quitado: true } : {}) };
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
export function cargarRecoleccion(almacen, rec, clave = CLAVE_RECOLECCION, opc = {}) {
  try { const t = almacen.getItem(clave); if (t) rec.importar(JSON.parse(t), opc); } catch (e) { /* roto o sin almacenamiento */ }
  return rec;
}

// ---------------- Acción con autor ----------------
// { autor, tipo: 'recoger', punto, x, z, a? } — x, z: dónde está el autor (el servidor usará la suya).
// ahora: la hora del que valida (el servidor o este navegador), nunca la que diga el mensaje.
// Lo recogido va al inventario del autor, nunca al de otro. Se anota en el registro, salga bien o no.
// suelo: el de los objetos (src/logica/suelo.js), donde cae lo desbrozado (sin él no se desbroza).
export function ejecutarRecoleccion(rec, invs, registro, accion, ahora, suelo = null) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'recoger' && a.tipo !== 'desbrozar') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!txt(a.punto) || !Number.isFinite(a.x) || !Number.isFinite(a.z) || (a.a !== undefined && !txt(a.a))) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else if (a.tipo === 'desbrozar' && !suelo) r = { ok: false, motivo: 'Aquí no se puede desbrozar.' };
  else if (a.tipo === 'desbrozar') {
    r = rec.desbrozar(invs.de(a.autor), a.punto, a.x, a.z, ahora);
    if (r.ok) r.objetos = r.deja.map((o, i) => suelo.dejar({ tipo: o.tipo, n: o.n }, o.x, o.z, ahora, a.autor, false, i * 1.3).id);
  } else r = rec.recoger(invs.de(a.autor), a.punto, a.x, a.z, ahora, a.a);
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { objeto: r.objeto, cantidad: r.cantidad, ...(r.extra ? { extra: r.extra } : {}) };
  return r;
}

// Nombre de lo que da un punto (para los avisos).
export const nombreDe = tipo => (CATALOGO[RECOLECTABLES[tipo].da] || {}).nombre;
