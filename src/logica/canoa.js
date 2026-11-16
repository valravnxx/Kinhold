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
