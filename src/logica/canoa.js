// Kinhold — la canoa de un tronco (P11d, «La canoa»; lógica pura, sin three.js, comprobable en Node).
// valravnx, 14 nov: «me flipa lo de la canoa». La canoa de un solo tronco se vaciaba a mano, con la azuela o el hacha
// y con fuego: se echan brasas encima de la madera, se dejan quemar y luego se raspa lo carbonizado, y se vuelve a
// empezar hasta que el hueco es bastante hondo. Así aquí:
//   1. Desbastar: con el hacha en la mano, a golpes, se le quita la corteza y se aplana por arriba (GOLPES_DESBASTAR).
//      Al primer golpe el tronco largo deja de ser un tronco: es una canoa a medias (enorme; no desaparece).
//   2. Echar brasas: con una hoguera (o un hogar) ardiendo a ALCANCE_FUEGO m como mucho del que las echa, se cogen
//      sus brasas y se echan en el hueco. Arden QUEMA ms, por tiempo transcurrido (en el servidor: aunque nadie juegue).
//   3. Raspar lo quemado, con el hacha, a golpes (GOLPES_RASPAR). Y otra vuelta de brasas, hasta VUELTAS vueltas.
//   Al terminar la última, queda la canoa en el suelo (enorme: se arrastra con cuerda hasta la orilla).
// Todo es una sola acción con autor, «vaciar» (src/logica/objetos_red.js): hace lo que le toca a la canoa.
//
// Lo que va a medias se guarda en la propia cosa del suelo: { tipo: 'canoa_a_medias', n: 1, vaciado: { fase, golpes,
// vuelta, hasta } }; fase: 'desbastar', 'brasas' (toca echarlas), 'quemando' (arden hasta «hasta»; pasada esa hora,
// toca raspar) o 'raspar'.
//
// Decisiones provisionales (el GDD no las fija; anotadas en el diario y en el registro de decisiones, 16 nov):
//  - Golpes: desbastar, 40 con hacha de piedra y 14 con la de hierro; raspar cada vuelta, 20 y 8. Entre golpe y golpe,
//    como al tronzar.
//  - Las brasas arden 10 min de reloj y son 3 vueltas: unos 30 min de brasas y 100 golpes con hacha de piedra.
//  - Las brasas salen de una hoguera o un hogar que arda (con llama o en brasas) a 6 m como mucho del que las echa, y
//    no la gastan. No hace falta yesca: ya arde.
//  - No hace falta estar junto al agua para vaciarla: se vacía donde esté el tronco (y la canoa se arrastra luego).
//  - Se vacía a 2,5 m del centro del tronco como mucho, como al tronzar; cualquiera puede seguir la de otro (el suelo
//    no tiene dueño).
import { hachaEnMano } from './tala.js';
import { vivo } from './fuego.js';
import { NADO } from './nado.js';

export const GOLPES_DESBASTAR = { piedra: 40, hierro: 14 };
export const GOLPES_RASPAR = { piedra: 20, hierro: 8 };
export const VUELTAS = 3;
export const QUEMA = 10 * 60 * 1000;      // ms que arden las brasas echadas
export const ALCANCE_VACIAR = 2.5;        // m, desde el centro del tronco
export const ALCANCE_FUEGO = 6;           // m, del que echa las brasas al fuego
export const ENTRE_GOLPES = 800;          // ms
export const FUEGOS = ['hoguera', 'hogar'];
export const SE_VACIA = ['tronco_largo', 'canoa_a_medias'];

// La fase de un vaciado a la hora ahora (la de quemando pasa sola a raspar cuando se acaban las brasas).
export function faseDe(v, ahora) {
  if (!v) return 'desbastar';
  if (v.fase === 'quemando' && ahora >= v.hasta) return 'raspar';
  return v.fase;
}
// Lo hecho, de 0 a 1 (para la barra): el desbaste vale una vuelta más.
export function progresoVaciado(v, ahora, clase = 'piedra') {
  if (!v) return 0;
  const f = faseDe(v, ahora), total = VUELTAS + 1;
  if (f === 'desbastar') return (v.golpes / GOLPES_DESBASTAR[clase]) / total;
  let parte = f === 'brasas' ? 0 : f === 'quemando' ? 0.5 * Math.min(1, 1 - (v.hasta - ahora) / QUEMA) : 0.5 + 0.5 * Math.min(1, v.golpes / GOLPES_RASPAR[clase]);
  return Math.min(1, (1 + v.vuelta + parte) / total);
}
// ¿Hay un fuego vivo (hoguera u hogar) a ALCANCE_FUEGO m de (x, z)? estaciones: las de fabricar, con su fuego.
export function fuegoCerca(estaciones, x, z, ahora) {
  return Object.values(estaciones || {}).some(e => e && FUEGOS.includes(e.tipo) && vivo(e.fuego, ahora) && Math.hypot(e.x - x, e.z - z) <= ALCANCE_FUEGO);
}

export class Vaciado {
  constructor(suelo) { this.suelo = suelo; this.ultimoGolpe = {}; this.entre = ENTRE_GOLPES; }

  // Lo que le toca al objeto del suelo id estando en (x, z). conFuego(x, z): si hay un fuego vivo a mano. Devuelve
  // { ok, paso: 'desbastar' | 'brasas' | 'raspar', termina?, canoa?, … } o { ok: false, motivo }.
  paso(inv, id, x, z, ahora, autor, conFuego = () => false) {
    let o = this.suelo.porId(id, ahora);
    if (!o || !SE_VACIA.includes(o.cosa.tipo)) return { ok: false, motivo: 'Ahí no hay ningún tronco largo que vaciar.' };
    if (o.arrastra) return { ok: false, motivo: 'Ese tronco está atado: que suelten antes la cuerda.' };
    if (Math.hypot(o.x - x, o.z - z) > ALCANCE_VACIAR) return { ok: false, motivo: 'Está demasiado lejos.' };
    const v = o.cosa.vaciado || { fase: 'desbastar', golpes: 0, vuelta: 0, hasta: 0 };
    const f = faseDe(v, ahora);
    if (f === 'quemando') return { ok: false, motivo: 'Las brasas aún arden en el hueco: espera a que se consuman para raspar.', paso: 'quemando', hasta: v.hasta };
    if (f === 'brasas') {
      if (!conFuego(x, z)) return { ok: false, motivo: 'Para echar brasas en el hueco necesitas una hoguera encendida al lado.' };
      o.cosa.vaciado = { fase: 'quemando', golpes: 0, vuelta: v.vuelta, hasta: ahora + QUEMA };
      return { ok: true, paso: 'brasas', vuelta: v.vuelta, hasta: ahora + QUEMA };
    }
    // desbastar o raspar: a golpes de hacha
    const h = hachaEnMano(inv);
    if (!h) return { ok: false, motivo: f === 'raspar' ? 'Necesitas un hacha en la mano para raspar lo quemado.' : 'Necesitas un hacha en la mano para vaciar el tronco.' };
    const ult = this.ultimoGolpe[autor];
    if (ult !== undefined && ahora - ult < this.entre) return { ok: false, motivo: 'Aún no has terminado el golpe anterior.' };
    this.ultimoGolpe[autor] = ahora;
    if (o.cosa.tipo === 'tronco_largo') {   // al primer golpe deja de ser un tronco (de una pila se aparta uno)
      if (o.cosa.n > 1) {
        o.cosa.n -= 1;
        const u = { id: 's' + this.suelo.siguiente++, cosa: null, x: o.x, z: o.z, autor, soltado: ahora, desaparece: null };
        if (Number.isFinite(o.giro)) u.giro = o.giro;
        this.suelo.objetos.push(u);
        o = u;
      }
      o.cosa = { tipo: 'canoa_a_medias', n: 1 };
      o.desaparece = null;
    }
    const total = (f === 'raspar' ? GOLPES_RASPAR : GOLPES_DESBASTAR)[h.clase];
    const golpes = (f === v.fase ? v.golpes : 0) + 1;
    if (golpes < total) {
      o.cosa.vaciado = { fase: f, golpes, vuelta: v.vuelta, hasta: 0 };
      return { ok: true, paso: f, termina: false, golpes, faltan: total - golpes, objeto: o.id, hacha: h.tipo };
    }
    if (f === 'desbastar') { o.cosa.vaciado = { fase: 'brasas', golpes: 0, vuelta: 0, hasta: 0 }; return { ok: true, paso: f, termina: true, objeto: o.id, hacha: h.tipo }; }
    const vuelta = v.vuelta + 1;
    if (vuelta < VUELTAS) { o.cosa.vaciado = { fase: 'brasas', golpes: 0, vuelta, hasta: 0 }; return { ok: true, paso: f, termina: true, vuelta, objeto: o.id, hacha: h.tipo }; }
    o.cosa = { tipo: 'canoa', n: 1 };
    return { ok: true, paso: f, termina: true, vuelta, canoa: true, objeto: o.id, hacha: h.tipo };
  }
}

// ---------------- Al agua, subir y remar (P11d) ----------------
// valravnx, 14 nov: «debe ser más rápida (bastante más) que correr y poder usar un remo para remar en ella, si no irías
// a la deriva». La canoa del suelo (tipo 'canoa') está en tierra o a flote (agua: true). Mientras alguien va en ella,
// el objeto lleva rema: autor (el de atrás, que rema y gobierna) y, si cabe otro, pasajero: autor; su x, z es el último
// sitio donde se dejó (los navegadores la dibujan debajo del que rema, como la rastra detrás del que la arrastra) y al
// bajarse el que rema se queda donde el servidor lo tenía.
// Acciones con autor:
//   { autor, tipo: 'echar_canoa', objeto, x, z, rx, rz } — empujarla desde la orilla al agua (rx, rz: hasta dónde, en el agua)
//   { autor, tipo: 'subir_canoa', objeto, x, z }         — subir desde la orilla o el agua poco honda (el primero rema)
//   { autor, tipo: 'bajar_canoa', x, z, bx, bz }         — bajar a la orilla (bx, bz: donde pisa al bajar)
// Decisiones provisionales (el GDD no las fija; anotadas en el registro de decisiones y en el diario, 16 nov):
//  - Remando, 9 m/s (correr es 6): «bastante más rápido que corriendo». Sin remo en la mano, o sin remar, a la deriva
//    con la corriente del río (toda); en el mar, despacio (un cuarto de su corriente, y como mucho 0,5 m/s).
//  - Flota con 0,3 m de agua. Se empuja hasta 4,5 m desde donde está, con las manos libres y a 3 m como mucho de ella.
//  - Se sube a 3 m como mucho de su centro, desde tierra o con el agua por debajo del pecho (sin nadar). El primero que
//    sube rema; cabe otro sentado delante. Si se baja el que rema, rema el otro.
//  - Se baja a la orilla: donde se pisa tiene que estar a 3 m como mucho y con poca agua (menos de 0,5 m).
//  - Con alguien dentro no se ata ni se vacía; atada con cuerda, sale del agua (se arrastra a la orilla).
export const VEL_REMAR = 9;          // m/s
export const DERIVA_RIO = 1, DERIVA_MAR = 0.25, DERIVA_MAR_MAX = 0.5;
export const HONDO_FLOTA = 0.3;      // m de agua
export const ALCANCE_CANOA = 3;      // m, desde su centro (mide 4,4 m)
export const ECHAR = 4.5;            // m que se empuja como mucho
export const HONDO_BAJAR = 0.5;      // m de agua, como mucho, donde se pisa al bajar
export const ADELANTE = 1.1;         // m: el centro de la canoa, por delante del que rema (sentado atrás); el otro va otro tanto más
export const VEL_MAX_CANOA = VEL_REMAR + 3 * DERIVA_RIO;   // lo más deprisa: remando río abajo en un torrente (3 m/s)

// Lo que mueve la canoa en un paso (lógica del navegador del que rema; el servidor lo limita con VEL_MAX_CANOA):
// dir: { x, z } hacia donde rema (unitario o 0), remando: si rema (con el remo en la mano), corriente: { dx, dz } m/s
// del agua, mar: si es del mar. Devuelve { vx, vz } en m/s.
export function velocidadCanoa({ dir = { x: 0, z: 0 }, remando = false, corriente = { dx: 0, dz: 0 }, mar = false } = {}) {
  let cx = (corriente && corriente.dx) || 0, cz = (corriente && corriente.dz) || 0;
  if (mar) {
    cx *= DERIVA_MAR; cz *= DERIVA_MAR;
    const v = Math.hypot(cx, cz); if (v > DERIVA_MAR_MAX) { cx *= DERIVA_MAR_MAX / v; cz *= DERIVA_MAR_MAX / v; }
  } else { cx *= DERIVA_RIO; cz *= DERIVA_RIO; }
  const r = remando ? VEL_REMAR : 0, n = Math.hypot(dir.x || 0, dir.z || 0);
  return { vx: cx + (n > 0 ? r * dir.x / n : 0), vz: cz + (n > 0 ? r * dir.z / n : 0) };
}
export const remoEnMano = inv => !!inv && ['mano:der', 'mano:izq'].some(l => inv.lugares[l] && inv.lugares[l].tipo === 'remo');

export class Canoas {
  // aguaEn(x, z): lo hondo del agua ahí (m) o null en seco (el terreno del servidor).
  constructor(suelo, aguaEn = () => null) { this.suelo = suelo; this.aguaEn = aguaEn; }
  canoa(id, ahora) { const o = this.suelo.porId(id, ahora); return o && o.cosa.tipo === 'canoa' ? o : null; }
  // La canoa en la que va un autor (remando o sentado), o null.
  deAutor(autor, ahora) { return this.suelo.visibles(ahora).find(o => o.cosa.tipo === 'canoa' && (o.rema === autor || o.pasajero === autor)) || null; }
  hondo(x, z) { const h = this.aguaEn(x, z); return Number.isFinite(h) ? h : 0; }

  echar(inv, id, x, z, rx, rz, ahora, autor) {
    const o = this.canoa(id, ahora);
    if (!o) return { ok: false, motivo: 'Ahí no hay ninguna canoa.' };
    if (this.deAutor(autor, ahora)) return { ok: false, motivo: 'Ya vas en una canoa.' };
    if (o.arrastra) return { ok: false, motivo: 'La canoa está atada: suelta antes la cuerda.' };
    if (o.agua) return { ok: false, motivo: 'La canoa ya está en el agua.' };
    if (Math.hypot(o.x - x, o.z - z) > ALCANCE_CANOA) return { ok: false, motivo: 'Está demasiado lejos.' };
    if (inv && (inv.manosEn || inv.lugares['mano:der'] && inv.lugares['mano:der'].tipo !== 'remo' || inv.lugares['mano:izq'] && inv.lugares['mano:izq'].tipo !== 'remo')) return { ok: false, motivo: 'Para empujarla necesitas las manos libres (el remo puede ir en ellas).' };
    if (!Number.isFinite(rx) || !Number.isFinite(rz) || Math.hypot(rx - o.x, rz - o.z) > ECHAR) return { ok: false, motivo: 'El agua está demasiado lejos: acércala a la orilla.' };
    if (this.hondo(rx, rz) < HONDO_FLOTA) return { ok: false, motivo: 'Ahí no hay agua bastante para que flote.' };
    o.giro = redondo(Math.atan2(rx - o.x, rz - o.z) - Math.PI / 2);   // a lo largo de hacia donde se empuja (el modelo va a lo largo de X)
    o.x = redondo(rx); o.z = redondo(rz); o.agua = true; o.desaparece = null;
    return { ok: true, objeto: o.id, x: o.x, z: o.z };
  }

  subir(inv, id, x, z, ahora, autor) {
    const o = this.canoa(id, ahora);
    if (!o) return { ok: false, motivo: 'Ahí no hay ninguna canoa.' };
    if (this.deAutor(autor, ahora)) return { ok: false, motivo: 'Ya vas en una canoa.' };
    if (!o.agua) return { ok: false, motivo: 'Échala antes al agua.' };
    if (o.rema && o.pasajero) return { ok: false, motivo: 'En la canoa ya van dos.' };
    const ref = o.rema ? (this.posRema ? this.posRema(o.rema) : null) || o : o;   // (si ya va uno, la canoa está donde está él)
    if (Math.hypot(ref.x - x, ref.z - z) > ALCANCE_CANOA) return { ok: false, motivo: 'Está demasiado lejos.' };
    if (this.hondo(x, z) >= NADO.hondoNadar) return { ok: false, motivo: 'Nadando no se sube: acércate a la orilla o a lo poco hondo.' };
    if (inv && inv.manosEn) return { ok: false, motivo: 'Tienes las manos ocupadas.' };
    if (!o.rema) o.rema = autor; else o.pasajero = autor;
    return { ok: true, objeto: o.id, rema: o.rema === autor };
  }

  // p: dónde tiene el servidor al que se baja (si rema, ahí se queda la canoa).
  bajar(autor, p, bx, bz, ahora, forzar = false) {
    const o = this.deAutor(autor, ahora);
    if (!o) return { ok: false, motivo: 'No vas en ninguna canoa.' };
    if (!forzar) {
      if (!Number.isFinite(bx) || !Number.isFinite(bz) || Math.hypot(bx - p.x, bz - p.z) > ALCANCE_CANOA) return { ok: false, motivo: 'La orilla está demasiado lejos.' };
      if (this.hondo(bx, bz) >= HONDO_BAJAR) return { ok: false, motivo: 'Aquí no se puede bajar: acércate a la orilla.' };
    }
    if (o.rema === autor) {
      const g = Number.isFinite(p.giro) ? p.giro : null;   // (el que rema va sentado atrás: la canoa, ADELANTE m por delante)
      o.x = redondo(p.x + (g === null ? 0 : Math.sin(g) * ADELANTE)); o.z = redondo(p.z + (g === null ? 0 : Math.cos(g) * ADELANTE));
      if (g !== null) o.giro = redondo(g - Math.PI / 2);
      if (o.pasajero) { o.rema = o.pasajero; delete o.pasajero; } else delete o.rema;
    } else delete o.pasajero;
    return { ok: true, objeto: o.id, x: o.x, z: o.z };
  }
}
const redondo = v => Math.round(v * 100) / 100;

export const TIPOS_CANOA = new Set(['echar_canoa', 'subir_canoa', 'bajar_canoa']);
// canoas: un Canoas; p: dónde tiene el servidor al autor ({ x, z, giro }).
export function ejecutarCanoa(canoas, invs, registro, accion, ahora, p) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  const num = v => typeof v === 'number' && Number.isFinite(v);
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (!TIPOS_CANOA.has(a.tipo)) r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!num(a.x) || !num(a.z) || (a.tipo !== 'bajar_canoa' && !txt(a.objeto))
    || (a.tipo === 'echar_canoa' && (!num(a.rx) || !num(a.rz))) || (a.tipo === 'bajar_canoa' && (!num(a.bx) || !num(a.bz)))) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!num(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    const inv = invs.de(a.autor), q = p || { x: a.x, z: a.z };
    if (a.tipo === 'echar_canoa') r = canoas.echar(inv, a.objeto, q.x, q.z, a.rx, a.rz, ahora, a.autor);
    else if (a.tipo === 'subir_canoa') r = canoas.subir(inv, a.objeto, q.x, q.z, ahora, a.autor);
    else r = canoas.bajar(a.autor, q, a.bx, a.bz, ahora);
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { objeto: r.objeto, ...(r.x !== undefined ? { x: r.x, z: r.z } : {}) };
  return r;
}

// ---------------- Acción con autor ----------------
// { autor, tipo: 'vaciar', objeto, x, z } — lo que le toca al tronco que se vacía (un golpe de hacha o echar brasas).
// x, z: dónde está el autor (el servidor usa la suya). ahora: la hora del que valida. estaciones: las de fabricar.
export function ejecutarVaciado(vaciado, invs, registro, accion, ahora, estaciones = {}) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'vaciar') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!txt(a.objeto) || !Number.isFinite(a.x) || !Number.isFinite(a.z)) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else r = vaciado.paso(invs.de(a.autor), a.objeto, a.x, a.z, ahora, a.autor, (x, z) => fuegoCerca(estaciones, x, z, ahora));
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = { paso: r.paso, ...(r.termina ? { termina: true } : {}), ...(r.canoa ? { canoa: true } : {}) };
  return r;
}
