// Panel de depuración del admin (valravnx, 30 oct): ver a todos los jugadores conectados en el mapa y teletransportarse
// a un punto o junto a otro jugador. Lógica pura (sin three.js ni crypto): el servidor la usa para entender y comprobar
// las peticiones, y el navegador para saber dónde ponerse.
//
// El admin, por la cuenta (revisión del 1 nov con valravnx: «el admin, por la cuenta de valravnx»; P1): ya no hay clave
// aparte. El servidor solo acepta el panel de la conexión cuyo personaje es de una cuenta de admin. Y por su correo
// (valravnx, 2 nov: «el admin por la cuenta y su correo»): es admin la cuenta cuyo correo CONFIRMADO esté en la lista de
// la máquina, la variable KINHOLD_ADMIN_CORREO (correos separados por comas; servidor/nube/LEEME.md). El nombre de
// usuario ya no cuenta: así nadie se hace admin por quedarse antes el nombre «valravnx» (un correo confirmado solo
// puede tenerlo una cuenta, y para confirmarlo hay que leer el código que llega a él). Sin esa variable, no hay admin.
// La bienvenida dice { admin: true } a esa conexión (y la respuesta al confirmar el correo), y solo entonces el
// navegador enseña el panel. Cada petición (bien o mal) se apunta en admin.jsonl junto al mundo.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'admin', id, que: 'ver' }
//                        { tipo: 'admin', id, que: 'ir', x, z }           a un punto (m, relativos a la salida)
//                        { tipo: 'admin', id, que: 'ir', junto: autor }   junto a otro jugador
//                        { tipo: 'admin', id, que: 'traer', quien: autor } traer a otro jugador junto a ti (valravnx,
//                                                                          5 nov: «poder tpearlos a mi»)
//   servidor → cliente   { tipo: 'admin', id, que, ok: true, jugadores: [{ autor, cuenta, x, y, z, giro }] }   (ver)
//                        { tipo: 'admin', id, que, ok: true, x, y, z }   (ir: y es null si es un punto: el navegador pone
//                                                                          el suelo)
//                        { tipo: 'admin', id, que, ok: true, quien, x, y, z, giro }   (traer: dónde se le ha puesto)
//                        { tipo: 'admin', id, que, ok: false, motivo }
//                        { tipo: 'admin', id, que: 'modo', autoconstruir?, velocidad? }   los modos del admin
//                        { tipo: 'admin', id, que: 'invocar', objeto, cantidad }            el arcón de admin
//   servidor → el traído { tipo: 'admin', que: 'traido', x, y, z, giro }   (sin id: no lo ha pedido él)
//   La respuesta a 'ver' lleva además `info` (lo del servidor y lo de donde estás, infoServidor) y `modos`; la de
//   'modo', los modos como quedan; la de 'invocar', lo que se ha dado ({ objeto, cantidad, alSuelo }).
//
// La herramienta del admin (valravnx, 6 nov: «al clicar en admin en vez de salir el mapa solo, saldrá más
// información, y el poder activar modo autoconstruir (construir de una sin materiales), el poder abrir el arcón de
// admin para invocarse lo que sea, poder multiplicar la velocidad de carrera y poder ir a freecam volando en 3
// dimensiones»). Los modos son de la conexión de la cuenta de admin y los guarda el servidor (no el navegador):
//  - autoconstruir: el mojón y los muebles no cobran nada de lo que llevas (la entrada queda «ya pagada», lleva: true)
//    y cada obra que pone queda terminada al momento (el servidor apunta detrás una acción admin_terminar).
//  - velocidad: multiplica lo rápido que anda y corre (el servidor le deja moverse tanto más deprisa).
//  - invocar: el arcón de admin mete en lo que lleva cualquier objeto del catálogo; lo que no le cabe cae a sus pies.
//  - La cámara libre es solo del navegador (no mueve al personaje ni cambia nada del mundo).
// Decisiones provisionales (anotadas en el diario): los modos se apagan al desconectarse (no se guardan); velocidades
// 1, 2, 3, 5 y 10; invocar, de 1 a 999 de una vez.
// Moverse no cambia el mundo: el navegador pone ahí a su jugador y sigue mandando su estado como siempre.
// Al traído, el servidor le mueve el ancla de la presencia al sitio nuevo (así su siguiente estado vale allí).

import { SALIDA, dentroDePermitido } from './whitholm.js';
import { CATALOGO } from './inventario.js';
import { motivoCorreo, claveDeCorreo } from './correo.js';

export const JUNTO = 1.6;            // m al lado del otro jugador (a su lado, para no caerle encima)
export const NO_ADMIN = 'Solo la cuenta de admin puede usar el panel.';
export const VELOCIDADES = [1, 2, 3, 5, 10];   // por cuánto puede multiplicar su velocidad
export const INVOCAR_MAX = 999;
export const MODOS_INICIALES = Object.freeze({ autoconstruir: false, velocidad: 1 });
// Las acciones que el autoconstruir deja sin cobrar (las obras se ponen sin cobrar siempre: su marco es gratis).
export const GRATIS_AUTOCONSTRUIR = new Set(['mojon', 'decorar']);

const AUTOR = /^[a-z]{1,12}:[0-9a-z_-]{1,40}$/;   // cómo es un autor («jugador:…»)
const numero = (v) => typeof v === 'number' && Number.isFinite(v);

// Los correos de admin, de la lista de la máquina («yo@ejemplo.com» o «yo@ejemplo.com, otra@ejemplo.com»): un conjunto
// con cada correo sin mayúsculas (como se comparan los correos). Lo que no es un correo válido se descarta; vacía o sin
// poner, ninguno (nadie es admin).
export function correosAdmin(lista) {
  const correos = typeof lista === 'string' ? lista.split(',') : Array.isArray(lista) ? lista : [];
  return new Set(correos.filter(c => typeof c === 'string').map(c => c.trim()).filter(c => c && !motivoCorreo(c)).map(claveDeCorreo));
}
// ¿Es de admin esta cuenta? `e` es su correo como lo da Cuentas.correoDe ({ correo, verificado }, o null sin cuenta):
// solo si está confirmado y en la lista.
export const esCorreoAdmin = (e, admins) => !!e && e.verificado === true && typeof e.correo === 'string' && admins.has(claveDeCorreo(e.correo));

// Comprueba una petición del panel (si es de admin lo mira el servidor, con la cuenta de la conexión). Devuelve la petición limpia o null.
export function validarPeticionAdmin(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  if (m.que === 'ver') return { que: 'ver' };
  if (m.que === 'modo') {
    const r = { que: 'modo' };
    if (m.autoconstruir !== undefined) { if (typeof m.autoconstruir !== 'boolean') return null; r.autoconstruir = m.autoconstruir; }
    if (m.velocidad !== undefined) { if (!VELOCIDADES.includes(m.velocidad)) return null; r.velocidad = m.velocidad; }
    return Object.keys(r).length > 1 ? r : null;
  }
  if (m.que === 'invocar') {
    if (typeof m.objeto !== 'string' || !Object.hasOwn(CATALOGO, m.objeto)) return null;
    if (!Number.isInteger(m.cantidad) || m.cantidad < 1 || m.cantidad > INVOCAR_MAX) return null;
    return { que: 'invocar', objeto: m.objeto, cantidad: m.cantidad };
  }
  if (m.que === 'traer') return typeof m.quien === 'string' && AUTOR.test(m.quien) ? { que: 'traer', quien: m.quien } : null;
  if (m.que !== 'ir') return null;
  if (m.junto !== undefined) return typeof m.junto === 'string' && AUTOR.test(m.junto) ? { que: 'ir', junto: m.junto } : null;
  if (![m.x, m.z].every(numero)) return null;
  // a cualquier sitio del continente (valravnx, 5 nov: «quiero poder explorar libre»): el panel solo es de admin
  if (!dentroDePermitido(SALIDA.x + m.x, SALIDA.z + m.z, true)) return null;
  return { que: 'ir', x: m.x, z: m.z };
}

// Los modos del admin tras una petición 'modo' (lo que no dice, como estaba).
export const aplicarModo = (modos, p) => ({ ...MODOS_INICIALES, ...modos, ...(p.autoconstruir !== undefined ? { autoconstruir: p.autoconstruir } : {}), ...(p.velocidad !== undefined ? { velocidad: p.velocidad } : {}) });

// Lo que enseña el panel (la respuesta a 'ver'): lo del servidor y lo de donde está el admin. d: los datos que reúne
// el servidor (números ya contados); se limpian aquí para que el navegador reciba siempre lo mismo.
export function infoServidor(d) {
  const n = v => (Number.isFinite(v) ? Math.round(v) : 0);
  const sitio = d.sitio && Number.isFinite(d.sitio.x) && Number.isFinite(d.sitio.z) ? { x: Math.round(d.sitio.x * 10) / 10, y: Number.isFinite(d.sitio.y) ? Math.round(d.sitio.y * 10) / 10 : null, z: Math.round(d.sitio.z * 10) / 10 } : null;
  return {
    arranque: n(d.arranque), ahora: n(d.ahora), conectados: n(d.conectados), cuentas: n(d.cuentas),
    construcciones: n(d.construcciones), piezas: n(d.piezas), obrasAMedias: n(d.obrasAMedias), muebles: n(d.muebles), mojones: n(d.mojones),
    enElSuelo: n(d.enElSuelo), estaciones: n(d.estaciones), entradas: n(d.entradas),
    sitio, zona: d.zona === null || d.zona === undefined ? null : String(d.zona), tierraDe: typeof d.tierraDe === 'string' ? d.tierraDe : null,
    zonaRey: !!d.zonaRey,
  };
}

// Dónde se pone uno al ir junto a otro: a JUNTO m a un lado, a su altura y mirándole.
// Si ese sitio se sale de lo que se puede pisar, en el mismo sitio que él.
export function sitioJunto(otro) {
  const dx = Math.cos(otro.giro) * JUNTO, dz = -Math.sin(otro.giro) * JUNTO;
  const x = otro.x + dx, z = otro.z + dz;
  if (!dentroDePermitido(SALIDA.x + x, SALIDA.z + z, true)) return { x: otro.x, y: otro.y, z: otro.z, giro: otro.giro };
  return { x, y: otro.y, z, giro: Math.atan2(-dx, -dz) };
}

// Dónde se pone al que trae el admin: a su lado y mirándole, como al ir junto a otro (sitioJunto, desde el admin). Un
// jugador que no es admin no puede estar fuera de la isla: si el admin anda fuera, no se le trae (null).
export function sitioTraido(admin) {
  const d = sitioJunto(admin);
  return dentroDePermitido(SALIDA.x + d.x, SALIDA.z + d.z, false) ? d : null;
}
export const TRAER_FUERA = 'Fuera de la isla no se puede traer a nadie.';

// La lista de jugadores que ve el panel, a partir de los estados de la presencia (autor → { x, y, z, giro }).
// cuenta(autor): el usuario de su cuenta, o null (sale en la lista para saber quién es quién)
export function listaJugadores(estados, cuenta = () => null) {
  const l = [];
  for (const [autor, e] of estados) l.push({ autor, cuenta: cuenta(autor) || null, x: e.x, y: e.y, z: e.z, giro: e.giro });
  return l.sort((a, b) => (a.autor < b.autor ? -1 : a.autor > b.autor ? 1 : 0));
}
