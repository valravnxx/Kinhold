// La herramienta del admin en el servidor (partido de servidor/servidor.mjs, 12 nov): los mensajes { tipo: 'admin', … }
// (ver, ir, traer, modo, invocar), solo para la cuenta de admin y apuntados en admin.jsonl. Todo lo comparte por S.
import { appendFileSync } from 'fs';
import { validarPeticionAdmin, sitioJunto, sitioTraido, TRAER_FUERA, listaJugadores, NO_ADMIN, aplicarModo, infoServidor } from '../../src/logica/admin.js';

// { tipo: 'admin', id, que, … } de la conexión c ({ ws, autor })
export function atenderAdmin(S, c, msg) {
  const { ws, autor } = c;
  const { archivoAdmin, usuarioDe, enviar, esAdmin, conexionDe, presencia, mundo, terreno, arranque, cuentas, objetos, registro, modosDe, modosAdmin, registrar,
    guardarObjetos, repartirLlevado, repartirSuelo, reloj } = S;
  const id = Number.isSafeInteger(msg.id) ? msg.id : null, que = ['ver', 'ir', 'traer', 'modo', 'invocar'].includes(msg.que) ? msg.que : null;
  const detalle = que === 'ir' ? { x: Number.isFinite(msg.x) ? msg.x : undefined, z: Number.isFinite(msg.z) ? msg.z : undefined, junto: typeof msg.junto === 'string' ? msg.junto.slice(0, 60) : undefined }
    : que === 'traer' ? { quien: typeof msg.quien === 'string' ? msg.quien.slice(0, 60) : undefined }
    : que === 'modo' ? { autoconstruir: typeof msg.autoconstruir === 'boolean' ? msg.autoconstruir : undefined, velocidad: Number.isFinite(msg.velocidad) ? msg.velocidad : undefined }
    : que === 'invocar' ? { objeto: typeof msg.objeto === 'string' ? msg.objeto.slice(0, 40) : undefined, cantidad: Number.isFinite(msg.cantidad) ? msg.cantidad : undefined } : {};
  const apuntar = (r) => appendFileSync(archivoAdmin, JSON.stringify({ t: new Date().toISOString(), autor, cuenta: usuarioDe(autor), que, ...detalle, ok: r.ok, ...(r.ok ? {} : { motivo: r.motivo }) }) + '\n');
  const responder = (r) => { if (que !== 'ver' || !r.ok) apuntar(r); enviar(ws, { tipo: 'admin', id, que, ...r }); };
  // solo la cuenta de admin (la de esta conexión: lo que diga el mensaje no cuenta)
  if (!esAdmin(autor)) return responder({ ok: false, motivo: NO_ADMIN });
  const p = validarPeticionAdmin(msg);
  if (!p) return responder({ ok: false, motivo: 'Petición de admin no válida.' });
  if (p.que === 'ver') {
    const estados = new Map();
    for (const a of conexionDe.keys()) { const e = presencia.ultimo.get(a); if (e) estados.set(a, e); }
    const yo = presencia.ultimo.get(autor) || null;
    let piezas = 0, obrasAMedias = 0;
    for (const c of mundo.construcciones) for (const q of c.piezas.values()) { piezas++; if (q.obra) obrasAMedias++; }
    const zona = yo && terreno && terreno.zona ? terreno.zona(yo.x, yo.z) : null;
    const info = infoServidor({ arranque, ahora: Date.now(), conectados: conexionDe.size, cuentas: cuentas.total, construcciones: mundo.construcciones.length, piezas, obrasAMedias,
      muebles: mundo.decoracion.length, mojones: Object.keys(mundo.mojones).length, enElSuelo: objetos.sueloVisible(Date.now()).length, estaciones: objetos.estacionesVisibles().length,
      entradas: registro.total, sitio: yo, zona, tierraDe: yo ? mundo.tierraDe(yo.x, yo.z) : null, zonaRey: zona !== null && terreno && terreno.esZonaRey ? terreno.esZonaRey(zona) : false });
    return responder({ ok: true, yo: autor, jugadores: listaJugadores(estados, usuarioDe), info, modos: modosDe(autor) });
  }
  if (p.que === 'modo') {
    const m = aplicarModo(modosDe(autor), p);
    modosAdmin.set(autor, m);
    registrar(`admin ${autor} modos: autoconstruir ${m.autoconstruir ? 'sí' : 'no'}, velocidad ×${m.velocidad}`);
    return responder({ ok: true, modos: m });
  }
  if (p.que === 'invocar') {
    // el arcón de admin: a lo que lleva; lo que no cabe, a sus pies (donde lo tiene el servidor)
    const inv = objetos.invs.de(autor), m = inv.meterDonde(p.objeto, p.cantidad);
    let alSuelo = false;
    if (!m.ok) {
      const yo = presencia.ultimo.get(autor);
      if (!yo) return responder({ ok: false, motivo: 'No te cabe y el servidor aún no sabe dónde estás.' });
      objetos.suelo.dejar({ tipo: p.objeto, n: p.cantidad }, yo.x, yo.z, Date.now(), autor, !!mundo.tierraDe(yo.x, yo.z));
      alSuelo = true;
    }
    registrar(`admin ${autor} invoca ${p.cantidad} de ${p.objeto}${alSuelo ? ' (al suelo)' : ''}`);
    guardarObjetos();
    enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
    repartirLlevado(autor);
    if (alSuelo) repartirSuelo(Date.now());
    return responder({ ok: true, objeto: p.objeto, cantidad: p.cantidad, alSuelo });
  }
  if (p.que === 'traer') {
    // traer a otro junto al admin (valravnx, 5 nov): se le pone a su lado y su navegador lo sabe por su conexión
    const e = conexionDe.has(p.quien) && presencia.ultimo.get(p.quien), yo = presencia.ultimo.get(autor);
    if (!e || p.quien === autor) return responder({ ok: false, motivo: 'Ese jugador no está conectado.' });
    if (!yo) return responder({ ok: false, motivo: 'El servidor aún no sabe dónde estás.' });
    const d = sitioTraido(yo);
    if (!d) return responder({ ok: false, motivo: TRAER_FUERA });
    registrar(`admin ${autor} trae a ${p.quien}`);
    presencia.anclar(p.quien, d, reloj());
    enviar(conexionDe.get(p.quien), { tipo: 'admin', que: 'traido', x: d.x, y: d.y, z: d.z, giro: d.giro });
    return responder({ ok: true, quien: p.quien, x: d.x, y: d.y, z: d.z, giro: d.giro });
  }
  if (p.junto !== undefined) {
    const e = conexionDe.has(p.junto) && presencia.ultimo.get(p.junto);
    if (!e || p.junto === autor) return responder({ ok: false, motivo: 'Ese jugador no está conectado.' });
    const d = sitioJunto(e);
    registrar(`admin ${autor} va junto a ${p.junto}`);
    presencia.anclar(autor, d, reloj());
    return responder({ ok: true, x: d.x, y: d.y, z: d.z, giro: d.giro });
  }
  registrar(`admin ${autor} va a ${Math.round(p.x)}, ${Math.round(p.z)}`);
  presencia.anclar(autor, p, reloj());
  return responder({ ok: true, x: p.x, y: null, z: p.z });
}
