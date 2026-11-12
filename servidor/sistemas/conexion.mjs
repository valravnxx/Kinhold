// Las conexiones del servidor (partido de servidor/servidor.mjs, 12 nov): quién entra (con su ficha) y su bienvenida, los
// mensajes de cada uno (moverse, la salida, ahogarse, las obras, el combate, el aspecto, la charla y las acciones del
// mundo; las cuentas, los objetos y el admin, en sus módulos), quién se va (se queda dormido en el mundo), el tic de la
// presencia y el latido. Todo lo comparte por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { appendFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { ejecutar, USAN_INVENTARIO, fueraDeAlcance } from '../../src/logica/acciones.js';
import { validarAspecto, validarEstado } from '../../src/logica/presencia.js';
import { llevadoDe } from '../../src/logica/llevado.js';
import { PROTOCOLO } from '../../src/logica/protocolo.js';
import { Limitador } from '../../src/logica/limites.js';
import { GRATIS_AUTOCONSTRUIR } from '../../src/logica/admin.js';
import { trozoDe, LADO_RED, RADIO_RED } from '../../src/logica/trozos_red.js';
import { sitioAccion, sitioColocada, comunDe, obrasEnTrozos } from '../../src/logica/obras_red.js';
import { dejarSobra } from '../../src/logica/suelo.js';
import { limpiarTexto, validarFrase, FRASES, quienOye, MOTIVO_VACIO, MOTIVO_DESPACIO } from '../../src/logica/charla.js';
import { redondear as redondearNecesidades, factorVelocidad as velocidadNecesidades } from '../../src/logica/necesidades.js';
import { DESCONECTADO } from '../../src/logica/dormidos.js';
import { MOTIVOS } from '../../src/logica/muerte.js';
import { NADO } from '../../src/logica/nado.js';
import { estropearInventario, estropearSuelo } from '../../src/logica/comida.js';
import { resumen, fichaValida, SIN_CORREO, atenderCuenta } from './cuentas.mjs';
import { atenderObjeto } from './objetos.mjs';
import { atenderAdmin } from './admin.mjs';
import { atenderRendimiento } from './rendimiento.mjs';

// presencia: cada tic, a cada uno los que han cambiado menos él mismo
export function arrancarPresencia(S) {
  const { presencia, reloj, clientes, enviar } = S;
  return setInterval(() => {
    const lista = presencia.tic();
    if (!lista.length) return;
    const t = reloj();
    for (const [ws, autor] of clientes) {
      const jugadores = lista.filter(e => e.autor !== autor);
      if (jugadores.length) enviar(ws, { tipo: 'estados', t, jugadores });
    }
  }, S.tico);
}

// latido: quien no ha contestado al ping anterior (ni mandado nada) se da por ido; y lo que se guarda o caduca cada rato
export function arrancarLatido(S) {
  const { clientes, registrar, apuntarPosicion, apuntarVisto, guardarPosiciones, guardarNecesidades, guardarAbandono, revisarDormidos, reloj, apartados, objetos, conexionDe,
    enviar, repartirLlevado, archivoObjetosReg, guardarObjetos, repartirSuelo } = S;
  return setInterval(() => {
    for (const ws of clientes.keys()) {
      if (!ws.vivo) { registrar(`sin latido ${clientes.get(ws)}`); ws.terminate(); continue; }
      ws.vivo = false;
      try { ws.ping(); } catch (e) { /* ya cerrada */ }
    }
    for (const a of clientes.values()) { apuntarPosicion(a); apuntarVisto(a); }
    guardarPosiciones();
    try { guardarNecesidades(); } catch (e) { registrar(`no se pudo guardar necesidades.json: ${e && e.message}`); }
    try { guardarAbandono(); } catch (e) { registrar(`no se pudo guardar abandono.json: ${e && e.message}`); }
    revisarDormidos();
    const ahora = reloj();
    for (const [a, x] of apartados) if (x.hasta <= ahora) apartados.delete(a);
    // lo soltado fuera de las tierras desaparece pasada su hora
    const t = Date.now();
    let sueloCambia = objetos.limpiar(t) > 0, guardar = sueloCambia;
    // la carne cruda se estropea (P4, 9 nov; src/logica/comida.js): la de lo que lleva cada uno y la del suelo
    try {
      for (const [a, inv] of Object.entries(objetos.invs.jugadores)) {
        const e = estropearInventario(inv, t);
        if (!e.cambia) continue;
        guardar = true;
        if (Object.keys(e.estropeadas).length) {
          const ws = conexionDe.get(a);
          if (ws) { enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(a), estropeadas: e.estropeadas }); repartirLlevado(a); }
          appendFileSync(archivoObjetosReg, JSON.stringify({ autor: a, tipo: 'estropeado', estropeadas: e.estropeadas, ahora: t }) + '\n');
        }
      }
      const s = estropearSuelo(objetos.suelo, t);
      if (s.cambia) { guardar = true; if (Object.keys(s.estropeadas).length) sueloCambia = true; }
    } catch (e) { registrar(`error al estropear: ${e && e.message}`); }
    if (guardar) guardarObjetos();
    if (sueloCambia) repartirSuelo(t);
  }, S.latido);
}

// cada conexión nueva
export function instalarConexiones(S) {
  const { wss, fichas, fichaPara, conexionDe, clientes, apuntarPosicion, presencia, registrar, limites, reloj, seguridad, apuntarVisto, dormidos, ponerAlDia, combate, apartados,
    vestirLuchador, salidaComun, terreno, posiciones, elegirSalida, vista, faunaRed, antesFauna, enviar, mundo, registro, aspectos, objetos, necesidadesDe, usuarioDe, esAdmin,
    estadoCorreo, arconPruebas } = S;
  wss.on('connection', (ws, req) => {
    // ¿vuelve alguien? (su ficha en la dirección: ?ficha=…)
    let ficha = null, autor = null, caducada = null;
    try { ficha = new URL(req.url, 'http://x').searchParams.get('ficha'); } catch (e) { ficha = null; }
    if (fichaValida(ficha)) {
      const r = fichas.de(resumen(ficha), Date.now());
      autor = r.autor;
      if (r.caducada) caducada = true;
    }
    const vuelve = !!autor;
    if (!vuelve) {
      autor = 'jugador:' + randomUUID().slice(0, 8);
      ficha = fichaPara(autor);
    }
    // si seguía conectado con otra (colgada, otra pestaña), manda la nueva
    const vieja = conexionDe.get(autor);
    if (vieja) { conexionDe.delete(autor); clientes.delete(vieja); apuntarPosicion(autor); presencia.quitar(autor); vieja.close(4001, 'Otra conexión'); setTimeout(() => vieja.terminate(), 1000); }
    clientes.set(ws, autor); conexionDe.set(autor, ws);
    ws.vivo = true;
    ws.on('pong', () => { ws.vivo = true; });
    // sin esto, un error de la conexión (p. ej. un mensaje demasiado grande) tumbaría el servidor entero
    ws.on('error', (e) => registrar(`error en la conexión de ${autor}: ${e && (e.code || e.message)}`));
    const limitador = new Limitador(reloj(), limites);
    // de dónde viene (para los intentos de las cuentas): detrás de Caddy, lo que dice él; si no, la conexión
    const directa = (req.socket && req.socket.remoteAddress) || '?';
    // (la última de la lista: la que pone Caddy; las de antes las podría haber escrito el propio cliente)
    const reenviada = String((req.headers && req.headers['x-forwarded-for']) || '').split(',').pop().trim();
    const origen = (/^(::1|127\.|::ffff:127\.)/.test(directa) && reenviada) ? reenviada.slice(0, 64) : directa;
    if (caducada) seguridad({ que: 'ficha_caducada', origen });
    registrar(`${vuelve ? 'vuelve' : 'entra'} ${autor}`);
    apuntarVisto(autor);
    // dormido en el mundo: se despierta donde duerme (lo que manda su navegador desde ahí sigue a su presencia)
    if (dormidos.despertar(autor)) presencia.quitar(autor);   // (dónde duerme ya es su posición: posiciones)
    ponerAlDia();
    if (!combate.luchadores[autor]) {
      const ap = apartados.get(autor);
      if (ap) { apartados.delete(autor); combate.volver(autor, ap.L); } else combate.entrar(autor);
    }
    vestirLuchador(autor);
    // lo de alrededor de donde aparece: donde lo dejó o la salida (si es nuevo, la común hasta que elija)
    if (salidaComun && terreno && !posiciones.has(autor)) elegirSalida(autor, 'lindholt');
    vista.quitar(autor); faunaRed.quitar(autor); antesFauna.delete(autor);   // (las liebres de alrededor le llegan enteras otra vez)
    { const p = posiciones.get(autor); vista.mover(autor, p ? p.x : 0, p ? p.z : 0); presencia.anclar(autor, p || { x: 0, z: 0 }, reloj()); }
    const suyos = vista.trozosDe(autor);
    enviar(ws, { tipo: 'bienvenida', protocolo: PROTOCOLO, autor, ficha, vuelve, obras: obrasEnTrozos(mundo, suyos), n: registro.total, t: reloj(), presentes: presencia.todos().filter(e => e.autor !== autor),
      aspectos: [...aspectos].filter(([a]) => a !== autor).map(([a, e]) => ({ autor: a, ...e })), tc: combate.ms(), ahora: Date.now(), luchadores: combate.cambiados(true),
      inventario: objetos.inventarioDe(autor), necesidades: redondearNecesidades(necesidadesDe(autor)), suelo: objetos.sueloVisible(Date.now(), suyos), tala: objetos.talaVisible(suyos), recoleccion: objetos.recoleccionVisible(suyos),
      estaciones: objetos.estacionesVisibles(suyos), encargos: objetos.encargosDe(autor, Date.now()),
      trozos: { lado: LADO_RED, radio: RADIO_RED }, posicion: posiciones.get(autor) || null, cuenta: usuarioDe(autor), admin: esAdmin(autor), correo: estadoCorreo(autor), arcon: !!arconPruebas });

    const c = { ws, autor, origen };
    ws.on('message', (datos, binario) => {
      if (conexionDe.get(autor) !== ws) return;   // sustituida por otra: ya no cuenta
      ws.vivo = true;
      const tam = datos.length;
      const paso = limitador.admitir(reloj(), tam);
      if (paso === 'echar') { registrar(`echado ${autor} (demasiados mensajes)`); ws.close(1008, 'Demasiados mensajes'); return; }
      if (paso === 'no') {
        if (!ws.avisado) { ws.avisado = true; enviar(ws, { tipo: 'error', motivo: 'Demasiados mensajes.' }); setTimeout(() => { ws.avisado = false; }, 1000); }
        // una acción sí recibe respuesta, para que el cliente quite su copia y no se quede esperando
        if (!binario && tam < 4096) { try { const m = JSON.parse(datos.toString()); if (m && (m.tipo === 'accion' || m.tipo === 'objeto') && Number.isSafeInteger(m.id)) enviar(ws, { tipo: m.tipo === 'objeto' ? 'resultado_objeto' : 'resultado', id: m.id, ok: false, motivo: 'Demasiados mensajes.' }); } catch (e) { /* nada */ } }
        return;
      }
      if (binario) return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      try { atender(S, c, datos); } catch (e) {
        registrar(`error atendiendo a ${autor}: ${e && e.message}`);
        enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      }
    });
    ws.on('close', () => cerrar(S, c));
  });
}

// un mensaje de la conexión c ({ ws, autor, origen })
function atender(S, c, datos) {
  const { ws, autor } = c;
  const { enviar, cuentas } = S;
  let msg;
  try { msg = JSON.parse(datos.toString()); } catch (e) { return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' }); }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.tipo !== 'string')
    return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
  // sin el correo confirmado no se entra en el mundo (las acciones y los objetos reciben su respuesta)
  if (['estado', 'obras', 'combate', 'aspecto', 'accion', 'objeto', 'admin', 'salida', 'decir'].includes(msg.tipo) && cuentas.sinConfirmar(autor)) {
    const id = Number.isSafeInteger(msg.id) ? msg.id : null;
    if (msg.tipo === 'accion' || msg.tipo === 'objeto') enviar(ws, { tipo: msg.tipo === 'objeto' ? 'resultado_objeto' : 'resultado', id, ok: false, motivo: SIN_CORREO });
    else if (msg.tipo === 'admin') enviar(ws, { tipo: 'admin', id, que: null, ok: false, motivo: SIN_CORREO });
    else if (msg.tipo === 'salida') enviar(ws, { tipo: 'salida', id, ok: false, motivo: SIN_CORREO });
    return;
  }
  if (msg.tipo === 'salida') return atenderSalida(S, c, msg);
  if (msg.tipo === 'estado') return atenderEstado(S, c, msg);
  if (msg.tipo === 'morir') return atenderMorir(S, c, msg);
  if (msg.tipo === 'obras') return enviar(ws, { tipo: 'obras', obras: obrasEnTrozos(S.mundo, S.vista.trozosDe(autor)) });
  if (msg.tipo === 'combate') {
    // el autor es el de la conexión; lo que diga el mensaje no cuenta
    S.ponerAlDia();
    const r = S.combate.intencion(autor, msg);
    if (!r.ok) enviar(ws, { tipo: 'combate_rechazo', que: typeof msg.que === 'string' ? msg.que.slice(0, 24) : null, motivo: r.motivo });
    S.repartirCombate();
    return;
  }
  if (msg.tipo === 'aspecto') {
    const e = validarAspecto(msg);
    if (!e) return enviar(ws, { tipo: 'error', motivo: 'Aspecto no válido.' });
    // lo que lleva encima (cinturón, espalda, hombro y manos) lo pone el servidor, de su inventario: el del
    // navegador no se cree (src/logica/llevado.js)
    e.llevado = llevadoDe(S.objetos.invs.de(autor).lugares);
    S.aspectos.set(autor, e);
    for (const [otro, a] of S.clientes) if (a !== autor) enviar(otro, { tipo: 'aspecto', autor, ...e });
    return;
  }
  if (msg.tipo === 'decir') return atenderDecir(S, c, msg);
  if (msg.tipo === 'cuenta') return atenderCuenta(S, c, msg);
  if (msg.tipo === 'admin') return atenderAdmin(S, c, msg);
  if (msg.tipo === 'rendimiento') return atenderRendimiento(S, c, msg);   // la medida de este aparato, con un botón
  if (msg.tipo === 'objeto') return atenderObjeto(S, c, msg);
  if (msg.tipo !== 'accion' || !msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion))
    return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
  return atenderAccion(S, c, msg);
}

// la salida que elige un personaje nuevo: queda apuntada como su posición, y el movimiento sin trampas cuenta
// desde ahí (lo de alrededor le llega con el siguiente estado, al cambiar de trozo)
function atenderSalida(S, c, msg) {
  const { ws, autor } = c;
  const id = Number.isSafeInteger(msg.id) ? msg.id : null;
  const r = S.elegirSalida(autor, typeof msg.salida === 'string' ? msg.salida : '');
  if (r.ok) { S.presencia.anclar(autor, r.posicion, S.reloj()); S.recienLlegado.set(autor, r.posicion); }
  return S.enviar(ws, { tipo: 'salida', id, ...r });
}

// dónde está (unas 10 veces por segundo)
function atenderEstado(S, c, msg) {
  const { ws, autor } = c;
  const { terreno, esAdmin, enviar, reaparecido, reloj, recienLlegado, presencia, modosDe, necesidadesDe, anotarRecorte, ponerAlDia, combate, vista, objetos, mundo } = S;
  // con el terreno, dentro de la isla (la cuenta de admin, en todo el continente) y cerca del suelo
  if (terreno) {
    const ad = esAdmin(autor), e = validarEstado(msg, { admin: ad }), mal = e ? terreno.posicion(e, { admin: ad }) : null;
    if (mal) return enviar(ws, { tipo: 'error', motivo: mal });
  }
  // recién muerto, lo que su navegador mandó antes de saberlo (desde donde murió) no cuenta: hasta el primero de
  // donde ha vuelto (o 5 s)
  const rp = reaparecido.get(autor);
  if (rp) {
    if (Number.isFinite(msg.x) && Number.isFinite(msg.z) && Math.hypot(msg.x - rp.x, msg.z - rp.z) > 3 && reloj() - rp.t < 5000) return;
    reaparecido.delete(autor);
  }
  // recién elegida la salida, los estados que el navegador mandó desde la común antes de saberlo no cuentan (si no,
  // moverían el ancla del movimiento sin trampas otra vez allí): hasta el primero junto a la salida elegida
  const ll = recienLlegado.get(autor);
  if (ll) {
    if (Number.isFinite(msg.x) && Number.isFinite(msg.z) && Math.hypot(msg.x - ll.x, msg.z - ll.z) > 50) return;
    recienLlegado.delete(autor);
  }
  // movimiento sin trampas: lo que llega más lejos de lo que se puede andar se recorta (src/logica/presencia.js)
  if (msg.anim === DESCONECTADO) msg.anim = 'dormir';   // (desconectado solo lo pone el servidor)
  const rec = presencia.recibir(autor, msg, reloj(), { admin: esAdmin(autor), vel: (modosDe(autor).velocidad || 1) * velocidadNecesidades(necesidadesDe(autor)) });   // (rendido, no corre; helado, más lento)
  if (!rec) return enviar(ws, { tipo: 'error', motivo: 'Estado no válido.' });
  if (rec.recortado) anotarRecorte(autor, rec.recortado);
  ponerAlDia();
  const e = rec.estado;
  combate.colocar(autor, e.x, e.z, e.giro);
  // si ha cambiado de trozo, lo de los trozos que le entran
  const entran = vista.mover(autor, e.x, e.z);
  if (entran.length) {
    const nuevos = new Set(entran);
    enviar(ws, { tipo: 'trozos', entran, tala: objetos.talaVisible(nuevos), recoleccion: objetos.recoleccionVisible(nuevos), suelo: objetos.sueloVisible(Date.now(), vista.trozosDe(autor)), estaciones: objetos.estacionesVisibles(vista.trozosDe(autor)) });
    enviar(ws, { tipo: 'obras', obras: obrasEnTrozos(mundo, vista.trozosDe(autor)) });
  }
}

// ahogado (src/logica/nado.js: lo lleva su navegador): el servidor mira que esté en el agua honda (sin terreno, las
// pruebas sin mundo, se fía); otros motivos no se aceptan (la sed, el hambre y el combate los ve el servidor solo)
function atenderMorir(S, c, msg) {
  const { ws, autor } = c;
  const p = S.presencia.ultimo.get(autor);
  if (msg.motivo !== 'ahogado' || !p) return S.enviar(ws, { tipo: 'error', motivo: 'No se puede.' });
  const hondo = S.terreno ? S.terreno.aguaEn(p.x, p.z) : Infinity;
  if (!(hondo >= NADO.hondoNadar)) return S.enviar(ws, { tipo: 'error', motivo: 'Aquí no te ahogas.' });
  S.ponerAlDia();
  S.morir(autor, MOTIVOS.ahogado);
}

// el chat de texto: limpio, sin hablar a chorro, y a quien está cerca del que habla
// (una frase rápida va por su número: a cada uno le llega en su lengua)
function atenderDecir(S, c, msg) {
  const { ws, autor } = c;
  const { enviar, charla, reloj, conexionDe, presencia, archivoCharla, usuarioDe, registrar } = S;
  const frase = msg.frase !== undefined ? validarFrase(msg.frase) : null;
  const texto = msg.frase !== undefined ? (frase === null ? null : FRASES[frase]) : limpiarTexto(msg.texto);
  if (!texto) return enviar(ws, { tipo: 'error', motivo: MOTIVO_VACIO });
  if (!charla.admitir(autor, reloj())) return enviar(ws, { tipo: 'error', motivo: MOTIVO_DESPACIO });
  const posiciones = new Map();
  for (const a of conexionDe.keys()) { const e = presencia.ultimo.get(a); if (e) posiciones.set(a, e); }
  const yo = presencia.ultimo.get(autor) || null;
  const oyen = quienOye(autor, posiciones);
  try { appendFileSync(archivoCharla, JSON.stringify({ t: Date.now(), autor, cuenta: usuarioDe(autor), x: yo ? Math.round(yo.x) : null, z: yo ? Math.round(yo.z) : null, texto, ...(frase !== null ? { frase } : {}), oyen: oyen.length }) + '\n'); }
  catch (e) { registrar(`no se pudo apuntar la charla: ${e && e.message}`); }
  for (const a of oyen) { const k = conexionDe.get(a); if (k) enviar(k, frase !== null ? { tipo: 'dicho', autor, frase } : { tipo: 'dicho', autor, texto }); }
}

// una acción del mundo de construcción (src/logica/acciones.js), con el autor de la conexión
function atenderAccion(S, c, msg) {
  const { ws, autor } = c;
  const { modosDe, arconPruebas, mundo, terreno, presencia, registro, objetos, archivo, repartirSuelo, guardarObjetos, enviar, repartirLlevado, cansar, clientes, vista } = S;
  // el autor lo pone el servidor; el que traiga el cliente se pisa
  const accion = { ...msg.accion, autor };
  // el modo autoconstruir de la cuenta de admin (src/logica/admin.js): el mojón y los muebles, sin cobrar (quedan
  // «ya pagados», lleva: true); y cada obra que pone, terminada al momento (más abajo, admin_terminar)
  const auto = modosDe(autor).autoconstruir === true;
  const gratis = auto && GRATIS_AUTOCONSTRUIR.has(accion.tipo);
  if (gratis) accion.lleva = true; else delete accion.lleva;   // «lleva» solo lo pone el servidor
  // las obras cobran de lo que llevas (los inventarios del servidor); el arcón de materiales y rellenarlo, solo si hay arcón de pruebas
  const usaInventario = USAN_INVENTARIO.has(accion.tipo) && !gratis;
  // admin_terminar solo la crea el servidor: nunca se acepta de un navegador
  const soloServidor = accion.tipo === 'admin_terminar' || accion.tipo === 'tierra_al_rey';
  const sinArcon = soloServidor || (!arconPruebas && (accion.tipo === 'sacar_arcon' || accion.tipo === 'dejar_arcon' || accion.tipo === 'rellenar'));
  // con el terreno, las obras se miran contra él (la planta baja, solo si empieza una construcción nueva)
  const nueva = accion.tipo !== 'colocar' || !Number.isFinite(accion.x) || !Number.isFinite(accion.z) || !mundo.construccionCercana(accion.x, accion.z);
  const contraTerreno = terreno && nueva ? terreno.obra(accion, mundo.marcasNivelado()) : null;
  // dónde cae (antes de hacerla: desmontar puede quitar la construcción) y lo de todos tal como estaba
  const sitioAntes = sitioAccion(mundo, accion), antes = comunDe(mundo);
  // las obras, solo al alcance de donde el servidor tiene al jugador (lo que diga el navegador no cuenta)
  const lejos = sinArcon || contraTerreno ? null : fueraDeAlcance(mundo, accion, presencia.ultimo.get(autor));
  const r = soloServidor ? { ok: false, motivo: 'Acción desconocida.' } : sinArcon ? { ok: false, motivo: 'Aquí no hay arcón.' } : contraTerreno ? { ok: false, motivo: contraTerreno } : lejos || ejecutar(mundo, registro, accion, usaInventario ? objetos.invs : null);
  if (sinArcon || contraTerreno || lejos) registro.anotar(accion, r);
  const entrada = registro.entradas[registro.entradas.length - 1];
  registro.entradas.length = 0;   // lo guardado va al archivo; en memoria basta con el mundo
  appendFileSync(archivo, JSON.stringify(entrada) + '\n');
  // lo desmontado que no le cabe cae al suelo a sus pies, donde el servidor lo tiene (sin arcón, valravnx 1 nov)
  const pos = presencia.ultimo.get(autor);
  if (r.ok && r.sobra && pos && dejarSobra(objetos.suelo, r.sobra, pos.x, pos.z, Date.now(), autor, !!mundo.tierraDe(pos.x, pos.z))) repartirSuelo(Date.now());
  if (usaInventario && r.ok) guardarObjetos();
  enviar(ws, { tipo: 'resultado', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: !!r.ok, ...(r.ok ? {} : { motivo: r.motivo }) });
  // lo que llevas tal como queda (también si sale mal: el navegador lo había adelantado)
  if (usaInventario) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
  if (usaInventario && r.ok) repartirLlevado(autor);
  if (r.ok && accion.tipo === 'trabajar') cansar(autor, 'trabajar');   // cada rato de obra cansa
  if (r.ok) {
    // solo a quien tiene su trozo alrededor (y al autor); lo que no tiene sitio, a todos
    const sitio = accion.tipo === 'colocar' ? (sitioColocada(r) || sitioAntes) : sitioAntes;
    const k = sitio ? trozoDe(sitio.x, sitio.z) : null;
    for (const [otro, a] of clientes) if (!k || a === autor || vista.tiene(a, k)) enviar(otro, { tipo: 'accion', entrada, antes });
    // autoconstruir: la obra que acaba de poner queda terminada, con otra acción apuntada y repartida como las demás
    if (auto && accion.tipo === 'colocar' && r.obra && r.construccion) {
      const fin = { autor, tipo: 'admin_terminar', construccion: r.construccion.id, clave: r.clave }, antes2 = comunDe(mundo);
      const r2 = ejecutar(mundo, registro, fin, null);
      const entrada2 = registro.entradas[registro.entradas.length - 1];
      registro.entradas.length = 0;
      appendFileSync(archivo, JSON.stringify(entrada2) + '\n');
      if (r2.ok) for (const [otro, a] of clientes) if (!k || a === autor || vista.tiene(a, k)) enviar(otro, { tipo: 'accion', entrada: entrada2, antes: antes2 });
    }
  }
}

// se va: se queda dormido en el mundo, donde el servidor lo tiene (si ha llegado a estar en él)
function cerrar(S, c) {
  const { ws, autor } = c;
  const { clientes, conexionDe, modosAdmin, apuntarPosicion, guardarPosiciones, antesNec, ultimoTrago, reaparecido, durmiendo, tempDe, alientoAntes, guardarNecesidades, registrar,
    objetos, guardarObjetos, repartirSuelo, recienLlegado, vista, faunaRed, antesFauna, ponerAlDia, presencia, cuentas, terreno, posiciones, dormidos, mundo, ultimaPelea,
    presenciaDormida, combate, apartados, aspectos, reloj, gracia, enviar } = S;
  clientes.delete(ws);
  if (conexionDe.get(autor) !== ws) return;   // la sustituyó otra del mismo jugador: él sigue
  conexionDe.delete(autor);
  modosAdmin.delete(autor);   // los modos del admin se apagan al irse
  apuntarPosicion(autor); guardarPosiciones();
  antesNec.delete(autor); ultimoTrago.delete(autor); reaparecido.delete(autor); durmiendo.delete(autor); tempDe.delete(autor); alientoAntes.delete(autor);
  try { guardarNecesidades(); } catch (e) { registrar(`no se pudo guardar necesidades.json: ${e && e.message}`); }
  // la rastra que arrastraba se queda donde estaba (antes de olvidar dónde estaba él)
  if (objetos.soltarAlSalir(autor, Date.now())) { guardarObjetos(); repartirSuelo(Date.now()); }
  recienLlegado.delete(autor); vista.quitar(autor); faunaRed.quitar(autor); antesFauna.delete(autor);
  ponerAlDia();
  // se queda dormido en el mundo, donde el servidor lo tiene (si ha llegado a estar en él)
  const p = presencia.ultimo.get(autor), ahora = Date.now();
  if (p && !cuentas.sinConfirmar(autor) && (!terreno || posiciones.has(autor))) {
    const idCama = objetos.fab.camaDe(autor), cm = idCama ? objetos.fab.estaciones[idCama] : null;
    const cama = cm ? { x: cm.x, y: terreno ? terreno.suelo(cm.x, cm.z) : p.y, z: cm.z } : null;
    const d = dormidos.dormir(autor, p, { ahora, enTierra: !!mundo.tierraDe(p.x, p.z) && mundo.dentroDeTierra(p.x, p.z, autor), ultimaPelea: ultimaPelea.get(autor) ?? null, cama });
    presenciaDormida(autor, d);
    if (d.enCama) { posiciones.set(autor, { x: d.x, y: d.y, z: d.z, giro: d.giro }); S.posicionesCambiadas = true; guardarPosiciones(); }
    const L = combate.luchadores[autor];
    if (d.hasta > ahora && L) {
      // atacable donde está: su luchador sigue, quieto y con el arma guardada
      L.bloquear(false); if (L.accion === 'preparando') L.fintar(); L.sacada = false;
      combate.colocar(autor, d.x, d.z, d.giro);
    } else { const A = combate.apartar(autor); if (A) apartados.set(autor, { L: A, hasta: Infinity }); }
    registrar(`sale ${autor}: dormido ${d.enCama ? 'en su cama' : 'donde estaba'}, ${d.hasta > ahora ? `atacable ${Math.round((d.hasta - ahora) / 60000)} min` : 'protegido'}`);
    return;
  }
  aspectos.delete(autor); presencia.quitar(autor);
  const L = combate.apartar(autor);
  if (L) apartados.set(autor, { L, hasta: reloj() + gracia });
  registrar(`sale ${autor}`);
  for (const otro of clientes.keys()) enviar(otro, { tipo: 'sale', autor });
}
