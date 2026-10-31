// La rastra (GDD, «Transporte desde el inicio»: «la rastra (N0: dos varas largas con travesaños, se arrastra a
// mano)»; documento de sistemas, apartado 8: «se arrastra a mano: 2–3 troncos cortos o un montón de piedras,
// despacio; se queda donde la dejas, con lo que lleve»). Lógica pura (sin three.js ni navegador): el servidor la usa
// tal cual (src/logica/objetos_red.js).
//
// La rastra es un objeto del suelo (src/logica/suelo.js) de tipo 'rastra', enorme (no se lleva encima). Lo que lleva
// va en su cosa: { tipo: 'rastra', n: 1, carga: { tipo, n } | null }. Mientras alguien la arrastra, el objeto del suelo
// tiene arrastra: autor; su x, z es el último sitio donde se dejó (los navegadores la dibujan detrás del que la
// arrastra) y al soltarla se queda donde está, detrás de él.
//
// Acciones con autor (cada una se anota en el registro, salga bien o no):
//   { autor, tipo: 'enganchar_rastra', objeto, x, z }        — coger las varas y empezar a arrastrarla
//   { autor, tipo: 'soltar_rastra', x, z, rx, rz }           — dejarla donde está (rx, rz: dónde la ve su navegador)
//   { autor, tipo: 'cargar_rastra', objeto, x, z, de? | suelo? } — meter lo de una ruta de lo que llevas (de) o lo de
//                                                               un objeto del suelo (suelo: su id) en la rastra
//   { autor, tipo: 'descargar_rastra', objeto, x, z }        — lo que lleva, al suelo, a su lado
//
// Decisiones provisionales (el GDD no las fija; anotadas en el registro de decisiones y en el diario):
//  - Lleva una sola clase de cosa a la vez: hasta 3 troncos cortos, hasta 24 piedras (dos porta-piedras: «un montón»)
//    o un bloque de piedra en bruto (el inventario ya decía «el bloque es enorme: rastra o carro»).
//  - Se arrastra con las dos manos: para engancharla hay que tenerlas libres, y mientras la arrastras no se coge nada
//    con ellas. Uno solo la arrastra a la vez; cada uno, una.
//  - «Despacio»: arrastrándola, la velocidad baja con lo que pesa lo que lleva, en línea recta del 70 % (vacía) al
//    50 % (75 kg: tres troncos cortos). No se suma a lo que frena lo que llevas encima: se toma lo que frene más.
//  - Va 1,6 m por detrás del que la arrastra (el centro de la rastra). Al soltarla, el sitio que dice el navegador vale
//    si está a esa distancia de él (con 0,8 m de margen); si no, se deja justo detrás.
//  - Se engancha, se carga y se descarga a 2 m como mucho de su centro. Mientras la arrastras, se carga sin mirar la
//    distancia (va detrás de ti), pero para descargarla hay que soltarla antes.
//  - No desaparece nunca, esté donde esté (src/logica/suelo.js: NO_DESAPARECE), y cualquiera puede descargarla o
//    llevársela (proteger lo que lleva en tus tierras es de la carretilla, la tarea siguiente).
//  - Lo que se descarga cae a 1 m de su centro, de lado, y se suma a una pila de lo mismo si la hay, como todo lo del suelo.
//  - Si el que la arrastra se va del juego, la rastra se queda donde la tiene el servidor (su último sitio conocido).
import { CATALOGO, KILOS } from './inventario.js';

export const CABE_RASTRA = { tronco_corto: 3, piedra: 24, bloque_piedra: 1 };
export const ALCANCE_RASTRA = 2;      // m, desde su centro
export const DETRAS = 1.6;            // m: el centro de la rastra, por detrás del que la arrastra
export const MARGEN_SOLTAR = 0.8;     // m
export const VEL_VACIA = 0.7, VEL_LLENA = 0.5, KILOS_LLENA = 75;
export const LADO_DESCARGA = 1;       // m

const redondo = v => Math.round(v * 100) / 100;
export const kilosCarga = carga => (carga ? (KILOS[carga.tipo] ?? 0) * carga.n : 0);
// Lo que se multiplica la velocidad arrastrando una rastra con esa carga.
export function factorRastra(carga) {
  const k = Math.min(KILOS_LLENA, Math.max(0, kilosCarga(carga)));
  return VEL_VACIA - (VEL_VACIA - VEL_LLENA) * k / KILOS_LLENA;
}
// Lo que cabe aún de un tipo en una rastra con esa carga.
export function sitioRastra(carga, tipo) {
  if (!Object.hasOwn(CABE_RASTRA, tipo)) return 0;
  if (carga && carga.tipo !== tipo) return 0;
  return CABE_RASTRA[tipo] - (carga ? carga.n : 0);
}
// Dónde va el centro de la rastra detrás de alguien en (x, z) mirando a giro (radianes; 0 mira a +z).
export function detrasDe(x, z, giro) { return { x: x - Math.sin(giro) * DETRAS, z: z - Math.cos(giro) * DETRAS }; }

export class Rastras {
  constructor(suelo, cat = CATALOGO) { this.suelo = suelo; this.cat = cat; }
  todas(ahora) { return this.suelo.visibles(ahora).filter(o => o.cosa.tipo === 'rastra'); }
  // La que arrastra un autor, o null.
  deAutor(autor, ahora) { return this.todas(ahora).find(o => o.arrastra === autor) || null; }
  // Las que están paradas a menos de dist m de (x, z), de la más cercana a la más lejana.
  cercanas(x, z, ahora, dist = ALCANCE_RASTRA) {
    return this.todas(ahora).filter(o => !o.arrastra && Math.hypot(o.x - x, o.z - z) <= dist)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }
  rastra(id, ahora) {
    const o = this.suelo.porId(id, ahora);
    return o && o.cosa.tipo === 'rastra' ? o : null;
  }

  enganchar(inv, id, x, z, ahora, autor) {
    const o = this.rastra(id, ahora);
    if (!o) return { ok: false, motivo: 'Ahí no hay ninguna rastra.' };
    if (o.arrastra) return { ok: false, motivo: o.arrastra === autor ? 'Ya la estás arrastrando.' : 'Esa rastra la arrastra otro.' };
    if (this.deAutor(autor, ahora)) return { ok: false, motivo: 'Ya arrastras una rastra.' };
    if (Math.hypot(o.x - x, o.z - z) > ALCANCE_RASTRA) return { ok: false, motivo: 'Está demasiado lejos.' };
    if (inv.lugares['mano:der'] || inv.lugares['mano:izq']) return { ok: false, motivo: 'Para arrastrarla necesitas las dos manos libres.' };
    o.arrastra = autor;
    o.desaparece = null;
    inv.manosEn = 'rastra';   // mientras la arrastras, no se coge nada con las manos (Inventario.noCabe)
    return { ok: true, objeto: o.id };
  }

  soltar(inv, autor, x, z, rx, rz, ahora, giro = 0) {
    const o = this.deAutor(autor, ahora);
    if (!o) { if (inv) inv.manosEn = null; return { ok: false, motivo: 'No arrastras ninguna rastra.' }; }
    if (inv) inv.manosEn = null;
    let p = { x: rx, z: rz };
    if (!Number.isFinite(rx) || !Number.isFinite(rz) || Math.abs(Math.hypot(rx - x, rz - z) - DETRAS) > MARGEN_SOLTAR) p = detrasDe(x, z, giro);
    o.x = redondo(p.x); o.z = redondo(p.z);
    o.giro = redondo(Math.atan2(x - p.x, z - p.z));   // mirando hacia donde estaba el que la arrastraba
    delete o.arrastra;
    return { ok: true, objeto: o.id, x: o.x, z: o.z };
  }

  // Una rastra a mano para cargarla o descargarla: parada a su alcance, o (cargar) la que arrastras.
  aMano(id, x, z, ahora, autor, arrastrandoVale) {
    const o = this.rastra(id, ahora);
    if (!o) return { motivo: 'Ahí no hay ninguna rastra.' };
    if (o.arrastra && o.arrastra !== autor) return { motivo: 'Esa rastra la arrastra otro.' };
    if (o.arrastra && !arrastrandoVale) return { motivo: 'Suelta antes la rastra.' };
    if (!o.arrastra && Math.hypot(o.x - x, o.z - z) > ALCANCE_RASTRA) return { motivo: 'Está demasiado lejos.' };
    return { o };
  }

  // Meter en la rastra lo de la ruta de (todo lo que quepa) o lo del objeto del suelo idSuelo (lo que quepa).
  cargar(inv, id, x, z, ahora, autor, de, idSuelo) {
    const m = this.aMano(id, x, z, ahora, autor, true);
    if (m.motivo) return { ok: false, motivo: m.motivo };
    const o = m.o, carga = o.cosa.carga || null;
    let tipo, hay;
    if (de !== undefined) {
      const b = inv.buscar(de);
      if (b.motivo) return { ok: false, motivo: b.motivo };
      if (!b.cosa) return { ok: false, motivo: 'Ahí no hay nada.' };
      tipo = b.cosa.tipo; hay = b.cosa.n;
    } else {
      const s = this.suelo.porId(idSuelo, ahora);
      if (!s || s === o) return { ok: false, motivo: 'Ahí no hay nada que cargar.' };
      if (Math.hypot(s.x - x, s.z - z) > ALCANCE_RASTRA) return { ok: false, motivo: 'Está demasiado lejos.' };
      tipo = s.cosa.tipo; hay = s.cosa.n;
    }
    if (!Object.hasOwn(CABE_RASTRA, tipo)) return { ok: false, motivo: 'En la rastra solo van troncos cortos, piedras o un bloque de piedra.' };
    if (carga && carga.tipo !== tipo) return { ok: false, motivo: 'La rastra ya lleva otra cosa: descárgala antes.' };
    const sitio = sitioRastra(carga, tipo);
    if (sitio < 1) return { ok: false, motivo: 'La rastra va llena.' };
    const n = Math.min(sitio, hay);
    if (de !== undefined) { const r = inv.sacar(de, n); if (!r.ok) return r; }
    else {
      const s = this.suelo.porId(idSuelo, ahora);
      s.cosa.n -= n;
      if (s.cosa.n <= 0) this.suelo.objetos = this.suelo.objetos.filter(q => q !== s);
    }
    o.cosa.carga = { tipo, n: (carga ? carga.n : 0) + n };
    return { ok: true, objeto: o.id, tipo, cantidad: n, lleva: o.cosa.carga.n };
  }

  // Lo que lleva, al suelo, a su lado (a la derecha de hacia donde mira).
  descargar(id, x, z, ahora, autor, enTierras) {
    const m = this.aMano(id, x, z, ahora, autor, false);
    if (m.motivo) return { ok: false, motivo: m.motivo };
    const o = m.o, carga = o.cosa.carga;
    if (!carga || carga.n < 1) return { ok: false, motivo: 'La rastra va vacía.' };
    const g = Number.isFinite(o.giro) ? o.giro : 0;
    const dx = o.x + Math.cos(g) * LADO_DESCARGA, dz = o.z - Math.sin(g) * LADO_DESCARGA;
    const s = this.suelo.dejar({ tipo: carga.tipo, n: carga.n }, dx, dz, ahora, autor, !!enTierras(dx, dz), g);
    o.cosa.carga = null;
    return { ok: true, objeto: o.id, tipo: carga.tipo, cantidad: carga.n, suelo: s.id };
  }
}

const CAMPOS = {
  enganchar_rastra: ['objeto'],
  soltar_rastra: [],
  cargar_rastra: ['objeto'],
  descargar_rastra: ['objeto'],
};
export const TIPOS_RASTRA = new Set(Object.keys(CAMPOS));

// rastras: un Rastras; invs: los Inventarios; ahora: la hora del que valida. enTierras(autor, x, z).
// giro: hacia dónde mira el autor (para soltarla detrás si el sitio que dice no vale); lo da quien lo sabe.
export function ejecutarRastra(rastras, invs, registro, accion, ahora, enTierras = () => false, giro = 0) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  const num = v => typeof v === 'number' && Number.isFinite(v);
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (!TIPOS_RASTRA.has(a.tipo)) r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!num(a.x) || !num(a.z) || CAMPOS[a.tipo].some(k => !txt(a[k]))
    || (a.tipo === 'soltar_rastra' && ((a.rx !== undefined && !num(a.rx)) || (a.rz !== undefined && !num(a.rz))))
    || (a.tipo === 'cargar_rastra' && (a.de === undefined) === (a.suelo === undefined))
    || (a.de !== undefined && !txt(a.de)) || (a.suelo !== undefined && !txt(a.suelo))) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!num(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    const inv = invs.de(a.autor);
    switch (a.tipo) {
      case 'enganchar_rastra': r = rastras.enganchar(inv, a.objeto, a.x, a.z, ahora, a.autor); break;
      case 'soltar_rastra': r = rastras.soltar(inv, a.autor, a.x, a.z, a.rx, a.rz, ahora, num(giro) ? giro : 0); break;
      case 'cargar_rastra': r = rastras.cargar(inv, a.objeto, a.x, a.z, ahora, a.autor, a.de, a.suelo); break;
      case 'descargar_rastra': r = rastras.descargar(a.objeto, a.x, a.z, ahora, a.autor, (x, z) => enTierras(a.autor, x, z)); break;
    }
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { objeto: r.objeto, ...(r.tipo ? { tipo: r.tipo, cantidad: r.cantidad } : {}), ...(r.x !== undefined ? { x: r.x, z: r.z } : {}) };
  return r;
}

// El arcón de pruebas (mientras no se fabrique nada): la rastra no cabe en el inventario, así que sale de él al suelo,
// a los pies del autor. { autor, tipo: 'arcon_al_suelo', objeto: 'rastra', x, z }. Solo lo enorme que se arrastra.
export const DEL_ARCON_AL_SUELO = ['rastra'];
export function ejecutarArconAlSuelo(suelo, registro, accion, ahora, enTierras = () => false) {
  let r;
  const a = accion;
  if (!a || typeof a !== 'object' || typeof a.autor !== 'string' || !a.autor) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'arcon_al_suelo') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!DEL_ARCON_AL_SUELO.includes(a.objeto) || !Number.isFinite(a.x) || !Number.isFinite(a.z)) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    const o = suelo.dejar({ tipo: a.objeto, n: 1, carga: null }, a.x, a.z, ahora, a.autor, !!enTierras(a.autor, a.x, a.z));
    r = { ok: true, objeto: o.id };
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { objeto: r.objeto };
  return r;
}
