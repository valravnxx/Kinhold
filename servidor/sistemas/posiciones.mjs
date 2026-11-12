// Dónde está y dónde empieza cada uno en el servidor (partido de servidor/servidor.mjs, 12 nov): las posiciones al
// salir (posiciones.json), la salida que eligió cada uno (salidas.json) y su sitio de salida al morir sin cama.
// Todo lo comparte por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { validarEstado } from '../../src/logica/presencia.js';
import { salidaInicio, SALIDAS_INICIO } from '../../src/logica/whitholm.js';
import { reemplazar } from '../guardado.mjs';

export function instalarPosiciones(S) {
  const { terreno, registrar, archivoPosiciones, archivoSalidas } = S;
  // Volver donde lo dejaste (valravnx, 31 oct): dónde estaba cada jugador al salir (autor → { x, y, z, giro }, relativo
  // al sitio de salida, como su presencia). Se apunta al salir y, por si el servidor se apaga de golpe, en cada latido
  // con los que están conectados; se manda en la bienvenida para que el cliente ponga ahí a su jugador.
  const posiciones = new Map();
  if (existsSync(archivoPosiciones)) {
    // (con admin: la de la cuenta de admin puede estar fuera de la isla; la de los demás se comprobó al llegar)
    try { for (const [a, p] of Object.entries(JSON.parse(readFileSync(archivoPosiciones, 'utf8')))) { const e = validarEstado({ ...p, anim: 'quieto' }, { admin: true }); if (e) posiciones.set(a, { x: e.x, y: e.y, z: e.z, giro: e.giro }); } }
    catch (e) { registrar(`posiciones.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  S.posicionesCambiadas = false;
  const apuntarPosicion = (a) => {
    const e = S.presencia && S.presencia.ultimo.get(a);
    if (!e) return;
    // con el mundo de verdad, quien aún no ha elegido dónde empieza no tiene posición que apuntar (elegirSalida)
    if (terreno && !posiciones.has(a)) return;
    const p = posiciones.get(a);
    if (p && p.x === e.x && p.y === e.y && p.z === e.z && p.giro === e.giro) return;
    posiciones.set(a, { x: e.x, y: e.y, z: e.z, giro: e.giro }); S.posicionesCambiadas = true;
  };
  const guardarPosiciones = () => {
    if (!S.posicionesCambiadas) return;
    S.posicionesCambiadas = false;
    writeFileSync(archivoPosiciones + '.tmp', JSON.stringify(Object.fromEntries(posiciones))); reemplazar(archivoPosiciones + '.tmp', archivoPosiciones);
  };

  const salidas = new Map();   // autor → id de la salida que eligió (src/logica/whitholm.js, SALIDAS_INICIO)
  if (existsSync(archivoSalidas)) {
    try { for (const [a, id] of Object.entries(JSON.parse(readFileSync(archivoSalidas, 'utf8')))) if (salidaInicio(id)) salidas.set(a, id); }
    catch (e) { registrar(`salidas.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  function guardarSalidas() {
    try { writeFileSync(archivoSalidas + '.tmp', JSON.stringify(Object.fromEntries(salidas))); reemplazar(archivoSalidas + '.tmp', archivoSalidas); }
    catch (e) { registrar(`no se pudo guardar salidas.json: ${e && e.message}`); }
  }
  // Dónde empieza cada uno (valravnx, 5 nov: tres salidas en zonas del rey, «lo eligen»; src/logica/whitholm.js,
  // SALIDAS_INICIO): un personaje nuevo (sin posición apuntada) llega sin posición y elige una con { tipo: 'salida',
  // salida: id }. Se apunta enseguida como su posición: es donde aparece, y lo recuerda. Solo una vez: quien ya tiene
  // posición no vuelve a elegir. Con salidaComun (solo pruebas de navegador), a los nuevos se les pone la común sin
  // preguntar. Devuelve { ok, motivo, posicion }.
  const recienLlegado = new Map();   // autor → la salida que acaba de elegir (ver el mensaje «estado»)
  const elegirSalida = (autor, id) => {
    if (!terreno) return { ok: false, motivo: 'Aquí no hay salidas.' };
    if (posiciones.has(autor)) return { ok: false, motivo: 'Ya has empezado.' };
    const s = salidaInicio(id);
    if (!s) return { ok: false, motivo: 'Esa salida no existe.' };
    const O = terreno.origen, x = s.x - O.x, z = s.z - O.z;
    const p = { x, y: terreno.suelo(x, z), z, giro: 0 };
    posiciones.set(autor, p); S.posicionesCambiadas = true;
    salidas.set(autor, s.id); guardarSalidas();
    registrar(`${autor} empieza en ${s.nombre}`);
    try { guardarPosiciones(); } catch (e) { registrar(`no se pudo guardar posiciones.json: ${e && e.message}`); }
    return { ok: true, posicion: p };
  };
  // su sitio de salida (en la escena); quien empezó antes de que se apuntara, la más cercana a donde murió
  const sitioSalida = (autor, cerca) => {
    if (!terreno) return null;
    const O = terreno.origen;
    let s = salidaInicio(salidas.get(autor));
    if (!s && cerca) s = SALIDAS_INICIO.reduce((m, q) => (Math.hypot(q.x - O.x - cerca.x, q.z - O.z - cerca.z) < Math.hypot(m.x - O.x - cerca.x, m.z - O.z - cerca.z) ? q : m));
    if (!s) s = SALIDAS_INICIO[0];
    const x = s.x - O.x, z = s.z - O.z;
    return { x, y: terreno.suelo(x, z), z, giro: 0 };
  };
  Object.assign(S, { posiciones, apuntarPosicion, guardarPosiciones, salidas, recienLlegado, elegirSalida, sitioSalida });
}
