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
//    o un bloque de piedra en bruto (el inventario ya decía «el bloque es enorme: rastra o carro»). Y (valravnx, 7 nov:
//    «metelo ya») hasta 5 troncos delgados (75 kg, lo mismo que los 3 cortos: va igual de despacio), apoyados en los
//    travesaños con la punta de atrás arrastrando, o 12 varas: lo que da la tala del árbol joven, en un viaje. El
//    tronco largo no (60 kg y 4,5 m: es cosa de carro), ni el delgado en la carretilla (2,6 m no caben en ella).
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
//  - Lo que se descarga cae a 1,1 m de su centro, de lado (los troncos, a lo largo de ella), y se suma a una pila de lo mismo si la hay, como todo lo del suelo.
//  - Si el que la arrastra se va del juego, la rastra se queda donde la tiene el servidor (su último sitio conocido).
//
// La carretilla de rueda maciza (GDD, «Transporte desde el inicio»: «la carretilla de rueda maciza (N1: la rueda es una
// rodaja de tronco). La carretilla se aparca y hace de contenedor: dentro de tus tierras está protegida; fuera,
// cualquiera puede coger lo que lleva») va con la misma lógica: es otro vehículo de mano (VEHICULOS), con sus acciones
// (empujar_carretilla, aparcar_carretilla, cargar_carretilla, descargar_carretilla; mismos campos que las de la rastra).
// Decisiones provisionales de la carretilla (anotadas en el registro de decisiones y en el diario):
//  - Lleva una sola clase de cosa a la vez, más que la rastra: hasta 4 troncos cortos, 40 de leña, 36 piedras o un
//    bloque de piedra en bruto.
//  - Se empuja con las dos manos y va delante: su centro, 1,4 m por delante (las varas son largas: así las agarraderas quedan en las manos) del que la empuja. Más ligera que la
//    rastra: la velocidad baja del 85 % (vacía) al 65 % (100 kg: cuatro troncos cortos).
//  - «Protegida en tus tierras»: si se aparca dentro de las tierras del que la aparca, queda a su guarda (guarda: autor)
//    y nadie más puede empujarla, cargarla ni descargarla. Aparcada fuera, no tiene guarda: cualquiera la descarga o se
//    la lleva. Mientras no haya tierras de cada uno (hito «Tierras y familias»), vale lo que diga enTierras.
import { CATALOGO, KILOS, KILOS_TAMANO } from './inventario.js';

export const CABE_RASTRA = { tronco_corto: 3, tronco_delgado: 5, vara: 12, piedra: 24, bloque_piedra: 1 };
export const ALCANCE_RASTRA = 2;      // m, desde su centro
export const DETRAS = 1.6;            // m: el centro de la rastra, por detrás del que la arrastra
export const MARGEN_SOLTAR = 0.8;     // m
export const VEL_VACIA = 0.7, VEL_LLENA = 0.5, KILOS_LLENA = 75;
export const LADO_DESCARGA = 1.1;     // m

export const CABE_CARRETILLA = { tronco_corto: 4, lena: 40, piedra: 36, bloque_piedra: 1 };
export const DELANTE_CARRETILLA = 1.4; // m: el centro de la carretilla, por delante del que la empuja

// Los vehículos de mano: lo que cabe, dónde va su centro respecto al que la lleva (off: + delante, − detrás), lo que
// frena (del factor vacía al de llena, en kilos) y si se protege en tus tierras.
export const VEHICULOS = {
  rastra: { nombre: 'la rastra', cabe: CABE_RASTRA, off: -DETRAS, vacia: VEL_VACIA, llena: VEL_LLENA, kilosLlena: KILOS_LLENA, protege: false },
  carretilla: { nombre: 'la carretilla', cabe: CABE_CARRETILLA, off: DELANTE_CARRETILLA, vacia: 0.85, llena: 0.65, kilosLlena: 100, protege: true },
};
export const esVehiculo = tipo => Object.hasOwn(VEHICULOS, tipo);

const redondo = v => Math.round(v * 100) / 100;
// (lo que no tiene sus kilos, los de su tamaño: una vara, 2 kg)
export const kilosCarga = carga => (carga ? (KILOS[carga.tipo] ?? KILOS_TAMANO[(CATALOGO[carga.tipo] || {}).tam] ?? 0) * carga.n : 0);
// Lo que se multiplica la velocidad llevando un vehículo (la rastra si no se dice) con esa carga.
export function factorRastra(carga, veh = 'rastra') {
  const v = VEHICULOS[veh] || VEHICULOS.rastra;
  const k = Math.min(v.kilosLlena, Math.max(0, kilosCarga(carga)));
  return v.vacia - (v.vacia - v.llena) * k / v.kilosLlena;
}
// Lo que cabe aún de un tipo en un vehículo (la rastra si no se dice) con esa carga.
export function sitioRastra(carga, tipo, veh = 'rastra') {
  const cabe = (VEHICULOS[veh] || VEHICULOS.rastra).cabe;
  if (!Object.hasOwn(cabe, tipo)) return 0;
  if (carga && carga.tipo !== tipo) return 0;
  return cabe[tipo] - (carga ? carga.n : 0);
}
// Dónde va el centro de la rastra detrás de alguien en (x, z) mirando a giro (radianes; 0 mira a +z).
export function detrasDe(x, z, giro) { return { x: x - Math.sin(giro) * DETRAS, z: z - Math.cos(giro) * DETRAS }; }
// Dónde va el centro de un vehículo respecto a alguien en (x, z) mirando a giro.
export function sitioDe(x, z, giro, veh = 'rastra') {
  const off = (VEHICULOS[veh] || VEHICULOS.rastra).off;
  return { x: x + Math.sin(giro) * off, z: z + Math.cos(giro) * off };
}
const MAY = s => s.charAt(0).toUpperCase() + s.slice(1);

export class Rastras {
  constructor(suelo, cat = CATALOGO) { this.suelo = suelo; this.cat = cat; }
  todas(ahora) { return this.suelo.visibles(ahora).filter(o => esVehiculo(o.cosa.tipo)); }
  // La que arrastra un autor, o null.
  deAutor(autor, ahora) { return this.todas(ahora).find(o => o.arrastra === autor) || null; }
  // Las que están paradas a menos de dist m de (x, z), de la más cercana a la más lejana.
  cercanas(x, z, ahora, dist = ALCANCE_RASTRA) {
    return this.todas(ahora).filter(o => !o.arrastra && Math.hypot(o.x - x, o.z - z) <= dist)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }
  rastra(id, ahora) {
    const o = this.suelo.porId(id, ahora);
    return o && esVehiculo(o.cosa.tipo) ? o : null;
  }
  // Lo que dice que no es tuyo: una carretilla aparcada en las tierras de otro.
  ajena(o, autor) { return o.guarda && o.guarda !== autor ? MAY(VEHICULOS[o.cosa.tipo].nombre) + ' está aparcada en las tierras de otro: no puedes tocarla.' : null; }

  enganchar(inv, id, x, z, ahora, autor) {
    const o = this.rastra(id, ahora);
    if (!o) return { ok: false, motivo: 'Ahí no hay ninguna rastra.' };
    const carr = o.cosa.tipo === 'carretilla';
    if (o.arrastra) return { ok: false, motivo: o.arrastra === autor ? (carr ? 'Ya la estás empujando.' : 'Ya la estás arrastrando.') : (carr ? 'Esa carretilla la empuja otro.' : 'Esa rastra la arrastra otro.') };
    const otra = this.deAutor(autor, ahora);
    if (otra) return { ok: false, motivo: otra.cosa.tipo === 'carretilla' ? 'Ya empujas una carretilla.' : 'Ya arrastras una rastra.' };
    if (Math.hypot(o.x - x, o.z - z) > ALCANCE_RASTRA) return { ok: false, motivo: 'Está demasiado lejos.' };
    const aj = this.ajena(o, autor); if (aj) return { ok: false, motivo: aj };
    if (inv.lugares['mano:der'] || inv.lugares['mano:izq']) return { ok: false, motivo: carr ? 'Para empujarla necesitas las dos manos libres.' : 'Para arrastrarla necesitas las dos manos libres.' };
    o.arrastra = autor;
    o.desaparece = null;
    delete o.guarda;
    inv.manosEn = o.cosa.tipo;   // mientras la llevas, no se coge nada con las manos (Inventario.noCabe)
    return { ok: true, objeto: o.id };
  }

  // enTierras(x, z): si ese sitio es de las tierras del autor (la carretilla aparcada ahí queda a su guarda).
  soltar(inv, autor, x, z, rx, rz, ahora, giro = 0, enTierras = () => false) {
    const o = this.deAutor(autor, ahora);
    if (!o) { if (inv) inv.manosEn = null; return { ok: false, motivo: 'No arrastras ninguna rastra.' }; }
    if (inv) inv.manosEn = null;
    const v = VEHICULOS[o.cosa.tipo], d = Math.abs(v.off);
    let p = { x: rx, z: rz };
    if (!Number.isFinite(rx) || !Number.isFinite(rz) || Math.abs(Math.hypot(rx - x, rz - z) - d) > MARGEN_SOLTAR) p = sitioDe(x, z, giro, o.cosa.tipo);
    o.x = redondo(p.x); o.z = redondo(p.z);
    // la rastra, mirando hacia donde estaba el que la arrastraba; la carretilla, hacia donde la empujaba
    o.giro = redondo(v.off < 0 ? Math.atan2(x - p.x, z - p.z) : Math.atan2(p.x - x, p.z - z));
    delete o.arrastra;
    if (v.protege && enTierras(o.x, o.z)) o.guarda = autor; else delete o.guarda;
    return { ok: true, objeto: o.id, x: o.x, z: o.z, ...(o.guarda ? { guarda: o.guarda } : {}) };
  }

  // Una rastra a mano para cargarla o descargarla: parada a su alcance, o (cargar) la que arrastras.
  aMano(id, x, z, ahora, autor, arrastrandoVale) {
    const o = this.rastra(id, ahora);
    if (!o) return { motivo: 'Ahí no hay ninguna rastra.' };
    const carr = o.cosa.tipo === 'carretilla';
    if (o.arrastra && o.arrastra !== autor) return { motivo: carr ? 'Esa carretilla la empuja otro.' : 'Esa rastra la arrastra otro.' };
    if (o.arrastra && !arrastrandoVale) return { motivo: carr ? 'Aparca antes la carretilla.' : 'Suelta antes la rastra.' };
    if (!o.arrastra && Math.hypot(o.x - x, o.z - z) > ALCANCE_RASTRA) return { motivo: 'Está demasiado lejos.' };
    const aj = this.ajena(o, autor); if (aj) return { motivo: aj };
    return { o };
  }

  // Meter en la rastra lo de la ruta de (todo lo que quepa) o lo del objeto del suelo idSuelo (lo que quepa).
  cargar(inv, id, x, z, ahora, autor, de, idSuelo) {
    const m = this.aMano(id, x, z, ahora, autor, true);
    if (m.motivo) return { ok: false, motivo: m.motivo };
    const o = m.o, carga = o.cosa.carga || null, veh = o.cosa.tipo, carr = veh === 'carretilla';
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
    if (!Object.hasOwn(VEHICULOS[veh].cabe, tipo)) return { ok: false, motivo: carr ? 'En la carretilla solo van troncos cortos, leña, piedras o un bloque de piedra.' : 'En la rastra solo van troncos (cortos o delgados), varas, piedras o un bloque de piedra.' };
    if (carga && carga.tipo !== tipo) return { ok: false, motivo: carr ? 'La carretilla ya lleva otra cosa: descárgala antes.' : 'La rastra ya lleva otra cosa: descárgala antes.' };
    const sitio = sitioRastra(carga, tipo, veh);
    if (sitio < 1) return { ok: false, motivo: carr ? 'La carretilla va llena.' : 'La rastra va llena.' };
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
    if (!carga || carga.n < 1) return { ok: false, motivo: o.cosa.tipo === 'carretilla' ? 'La carretilla va vacía.' : 'La rastra va vacía.' };
    const g = Number.isFinite(o.giro) ? o.giro : 0;
    const dx = o.x + Math.cos(g) * LADO_DESCARGA, dz = o.z - Math.sin(g) * LADO_DESCARGA;
    const s = this.suelo.dejar({ tipo: carga.tipo, n: carga.n }, dx, dz, ahora, autor, !!enTierras(dx, dz), g + Math.PI / 2);   // los troncos, a lo largo de ella
    o.cosa.carga = null;
    return { ok: true, objeto: o.id, tipo: carga.tipo, cantidad: carga.n, pila: s.id };
  }
}

const CAMPOS = {
  enganchar_rastra: ['objeto'],
  soltar_rastra: [],
  cargar_rastra: ['objeto'],
  descargar_rastra: ['objeto'],
};
// las de la carretilla: las mismas, con su nombre (lo que se anota en el registro dice qué se hizo)
export const DE_CARRETILLA = { empujar_carretilla: 'enganchar_rastra', aparcar_carretilla: 'soltar_rastra', cargar_carretilla: 'cargar_rastra', descargar_carretilla: 'descargar_rastra' };
for (const [k, v] of Object.entries(DE_CARRETILLA)) CAMPOS[k] = CAMPOS[v];
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
    || ((a.tipo === 'soltar_rastra' || a.tipo === 'aparcar_carretilla') && ((a.rx !== undefined && !num(a.rx)) || (a.rz !== undefined && !num(a.rz))))
    || ((a.tipo === 'cargar_rastra' || a.tipo === 'cargar_carretilla') && (a.de === undefined) === (a.suelo === undefined))
    || (a.de !== undefined && !txt(a.de)) || (a.suelo !== undefined && !txt(a.suelo))) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!num(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    const inv = invs.de(a.autor), base = DE_CARRETILLA[a.tipo] || a.tipo;
    // la acción de la carretilla, sobre una carretilla; la de la rastra, sobre una rastra
    const o = base === 'soltar_rastra' ? rastras.deAutor(a.autor, ahora) : rastras.rastra(a.objeto, ahora);
    if (o && (o.cosa.tipo === 'carretilla') !== !!DE_CARRETILLA[a.tipo]) r = { ok: false, motivo: o.cosa.tipo === 'carretilla' ? 'Eso es una carretilla.' : 'Eso es una rastra.' };
    else switch (base) {
      case 'enganchar_rastra': r = rastras.enganchar(inv, a.objeto, a.x, a.z, ahora, a.autor); break;
      case 'soltar_rastra': r = rastras.soltar(inv, a.autor, a.x, a.z, a.rx, a.rz, ahora, num(giro) ? giro : 0, (x, z) => enTierras(a.autor, x, z)); break;
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
export const DEL_ARCON_AL_SUELO = ['rastra', 'carretilla'];
export function ejecutarArconAlSuelo(suelo, registro, accion, ahora, enTierras = () => false) {
  let r;
  const a = accion;
  if (!a || typeof a !== 'object' || typeof a.autor !== 'string' || !a.autor) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'arcon_al_suelo') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!DEL_ARCON_AL_SUELO.includes(a.objeto) || !Number.isFinite(a.x) || !Number.isFinite(a.z)) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    const dentro = !!enTierras(a.autor, a.x, a.z);
    const o = suelo.dejar({ tipo: a.objeto, n: 1, carga: null }, a.x, a.z, ahora, a.autor, dentro);
    if (VEHICULOS[a.objeto].protege && dentro) o.guarda = a.autor;
    r = { ok: true, objeto: o.id };
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { objeto: r.objeto };
  return r;
}
