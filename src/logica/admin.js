// Panel de depuración del admin (valravnx, 30 oct): ver a todos los jugadores conectados en el mapa y teletransportarse
// a un punto o junto a otro jugador. Lógica pura (sin three.js ni crypto): el servidor la usa para entender y comprobar
// las peticiones, y el navegador para saber dónde ponerse.
//
// Todo pasa por el servidor con el autor de la conexión, y solo lo acepta con la clave de admin que valravnx pone en la
// máquina (variable KINHOLD_ADMIN; servidor/nube/LEEME.md). Sin clave puesta en el servidor, el panel no funciona.
// Cada petición (bien o mal) se apunta en admin.jsonl junto al mundo, sin la clave.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'admin', id, clave, que: 'ver' }
//                        { tipo: 'admin', id, clave, que: 'ir', x, z }           a un punto (m, relativos a la salida)
//                        { tipo: 'admin', id, clave, que: 'ir', junto: autor }   junto a otro jugador
//   servidor → cliente   { tipo: 'admin', id, que, ok: true, jugadores: [{ autor, x, y, z, giro }] }   (ver)
//                        { tipo: 'admin', id, que, ok: true, x, y, z }   (ir: y es null si es un punto: el navegador pone
//                                                                          el suelo)
//                        { tipo: 'admin', id, que, ok: false, motivo }
// Moverse no cambia el mundo: el navegador pone ahí a su jugador y sigue mandando su estado como siempre.

import { SALIDA, dentroDeIsla } from './whitholm.js';

export const ADMIN_MIN_CLAVE = 12;   // una clave más corta no vale (el servidor no abre el panel)
export const ADMIN_FALLOS = 5;       // claves mal seguidas antes de cerrar la conexión
export const JUNTO = 1.6;            // m al lado del otro jugador (a su lado, para no caerle encima)

const numero = (v) => typeof v === 'number' && Number.isFinite(v);

// ¿Vale esta clave para el servidor? (la que pone valravnx en la máquina)
export const claveUsable = (c) => typeof c === 'string' && c.length >= ADMIN_MIN_CLAVE && c.length <= 200;

// Comprueba una petición del panel (sin la clave: eso lo mira el servidor). Devuelve la petición limpia o null.
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
export function listaJugadores(estados) {
  const l = [];
  for (const [autor, e] of estados) l.push({ autor, x: e.x, y: e.y, z: e.z, giro: e.giro });
  return l.sort((a, b) => (a.autor < b.autor ? -1 : a.autor > b.autor ? 1 : 0));
}
