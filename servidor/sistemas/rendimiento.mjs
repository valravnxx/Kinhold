// La medida de rendimiento de cada aparato, en el servidor (hito «Orden», 12 nov; src/logica/rendimiento.js).
// Mensajes { tipo: 'rendimiento', id, que: 'enviar', medida } de cualquiera con conexión (una cada ENVIAR_CADA_MS como
// mucho), que se apuntan en rendimiento.jsonl con la hora, el autor y la cuenta; y { que: 'ver' }, solo de la cuenta de
// admin, que devuelve las últimas ULTIMAS (las del archivo al arrancar y las que llegan). Todo lo comparte por S.
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { validarMedida, puedeMandar, ULTIMAS, DEMASIADO_PRONTO, NO_VALE } from '../../src/logica/rendimiento.js';
import { NO_ADMIN } from '../../src/logica/admin.js';

export function instalarRendimiento(S) {
  const archivo = S.archivoRendimiento;
  const ultimas = [];
  // al arrancar, las últimas del archivo (crece despacio: una medida a mano de vez en cuando)
  if (existsSync(archivo)) {
    try {
      for (const l of readFileSync(archivo, 'utf8').split('\n').slice(-ULTIMAS - 1)) { if (!l.trim()) continue; try { ultimas.push(JSON.parse(l)); } catch (e) { /* línea a medias */ } }
    } catch (e) { S.registrar(`no se pudo leer rendimiento.jsonl: ${e && e.message}`); }
    ultimas.splice(0, Math.max(0, ultimas.length - ULTIMAS));
  }
  S.rendimiento = { ultimas, ultimoDe: new Map() };   // autor → hora del último envío
}

export function atenderRendimiento(S, c, msg) {
  const { ws, autor } = c;
  const { enviar, esAdmin, usuarioDe, archivoRendimiento, rendimiento, registrar } = S;
  const id = Number.isSafeInteger(msg.id) ? msg.id : null;
  const responder = (r) => enviar(ws, { tipo: 'rendimiento', id, que: msg.que === 'ver' ? 'ver' : 'enviar', ...r });
  if (msg.que === 'ver') {
    if (!esAdmin(autor)) return responder({ ok: false, motivo: NO_ADMIN });
    return responder({ ok: true, medidas: rendimiento.ultimas.slice().reverse() });
  }
  if (msg.que !== 'enviar') return responder({ ok: false, motivo: NO_VALE });
  const ahora = Date.now();
  if (!puedeMandar(rendimiento.ultimoDe.get(autor), ahora)) return responder({ ok: false, motivo: DEMASIADO_PRONTO });
  const m = validarMedida(msg.medida);
  if (!m) return responder({ ok: false, motivo: NO_VALE });
  rendimiento.ultimoDe.set(autor, ahora);
  const e = { t: new Date(ahora).toISOString(), autor, cuenta: usuarioDe(autor) || null, ...m };
  try { appendFileSync(archivoRendimiento, JSON.stringify(e) + '\n'); } catch (x) { registrar(`no se pudo apuntar la medida de rendimiento: ${x && x.message}`); return responder({ ok: false, motivo: 'El servidor no ha podido guardarla.' }); }
  rendimiento.ultimas.push(e);
  if (rendimiento.ultimas.length > ULTIMAS) rendimiento.ultimas.shift();
  registrar(`rendimiento de ${e.cuenta || autor}: ${Math.round(m.resultado.fps)} fps, peor ${m.resultado.peor} ms`);
  return responder({ ok: true });
}
