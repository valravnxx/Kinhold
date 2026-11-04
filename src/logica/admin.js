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
//   servidor → cliente   { tipo: 'admin', id, que, ok: true, jugadores: [{ autor, cuenta, x, y, z, giro }] }   (ver)
//                        { tipo: 'admin', id, que, ok: true, x, y, z }   (ir: y es null si es un punto: el navegador pone
//                                                                          el suelo)
//                        { tipo: 'admin', id, que, ok: false, motivo }
// Moverse no cambia el mundo: el navegador pone ahí a su jugador y sigue mandando su estado como siempre.

import { SALIDA, dentroDeIsla } from './whitholm.js';
import { motivoCorreo, claveDeCorreo } from './correo.js';

export const JUNTO = 1.6;            // m al lado del otro jugador (a su lado, para no caerle encima)
export const NO_ADMIN = 'Solo la cuenta de admin puede usar el panel.';

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
  if (m.que !== 'ir') return null;
  if (m.junto !== undefined) return typeof m.junto === 'string' && /^[a-z]{1,12}:[0-9a-z_-]{1,40}$/.test(m.junto) ? { que: 'ir', junto: m.junto } : null;
  if (![m.x, m.z].every(numero)) return null;
  if (!dentroDeIsla(SALIDA.x + m.x, SALIDA.z + m.z)) return null;
  return { que: 'ir', x: m.x, z: m.z };
}

// Dónde se pone uno al ir junto a otro: a JUNTO m a un lado, a su altura y mirándole.
// Si ese sitio se sale de la isla, en el mismo sitio que él.
export function sitioJunto(otro) {
  const dx = Math.cos(otro.giro) * JUNTO, dz = -Math.sin(otro.giro) * JUNTO;
  const x = otro.x + dx, z = otro.z + dz;
  if (!dentroDeIsla(SALIDA.x + x, SALIDA.z + z)) return { x: otro.x, y: otro.y, z: otro.z, giro: otro.giro };
  return { x, y: otro.y, z, giro: Math.atan2(-dx, -dz) };
}

// La lista de jugadores que ve el panel, a partir de los estados de la presencia (autor → { x, y, z, giro }).
// cuenta(autor): el usuario de su cuenta, o null (sale en la lista para saber quién es quién)
export function listaJugadores(estados, cuenta = () => null) {
  const l = [];
  for (const [autor, e] of estados) l.push({ autor, cuenta: cuenta(autor) || null, x: e.x, y: e.y, z: e.z, giro: e.giro });
  return l.sort((a, b) => (a.autor < b.autor ? -1 : a.autor > b.autor ? 1 : 0));
}
