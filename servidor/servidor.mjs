// Servidor mínimo de la prueba online (hito 1f). Node + paquete ws.
//
// - Cada conexión recibe un autor que pone el servidor («jugador:…»). Lo que diga el cliente como
//   autor se ignora siempre: el servidor lo sobrescribe antes de ejecutar.
// - Las acciones de construcción pasan por la lógica pura (ejecutar, src/logica/acciones.js), igual que
//   en el navegador. Las que salen bien se reparten a todos los conectados.
// - Todas las acciones (bien o mal) se guardan en un archivo, una por línea (JSON), para poder auditarlas.
//   Al arrancar, el mundo se rehace con reproducir a partir de ese archivo.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'accion', id, accion: { tipo, ...datos } }
//   servidor → cliente   { tipo: 'bienvenida', autor, entradas }       al conectar: lo que ha salido bien hasta ahora
//                        { tipo: 'resultado', id, ok, motivo? }         respuesta al que la mandó
//                        { tipo: 'accion', entrada }                    a todos, cuando una acción sale bien
//                        { tipo: 'error', motivo }                      mensaje que no se entiende
//   Presencia (src/logica/presencia.js): el cliente manda { tipo: 'estado', x, y, z, giro, anim } unas 10 veces
//   por segundo; el servidor le pone el autor y su hora, y cada tic (100 ms) manda a cada uno los que han
//   cambiado: { tipo: 'estados', t, jugadores }. Al irse alguien: { tipo: 'sale', autor }. La bienvenida
//   lleva también t y presentes (dónde está cada uno).
//   Aspecto (cuerpo y ropa del taller, y la personalización de src/logica/aspecto.js): el cliente lo manda al
//   conectar, { tipo: 'aspecto', sexo, capas, aspecto }; el
//   servidor lo comprueba (validarAspecto) y lo reparte a los demás, { tipo: 'aspecto', autor, sexo, capas, aspecto }. La bienvenida
//   lleva los de los que ya están (aspectos).
//   Combate (src/logica/combate_servidor.js): cada conexión tiene un luchador; el cliente manda intenciones
//   { tipo: 'combate', que, … } y el servidor lleva los tiempos y resuelve golpes y flechas con el autor de la
//   conexión. A todos: { tipo: 'combate', eventos } en el mismo orden, y cada tic (50 ms) { tipo: 'luchadores',
//   t, lista } con los que han cambiado (también el propio). Una intención que no se puede: { tipo:
//   'combate_rechazo', que, motivo }. La bienvenida lleva tc (reloj del combate, ms) y luchadores. Lo que
//   resuelve el combate (golpes, disparos, impactos) se guarda aparte, en combate.jsonl junto al mundo.
//
//   Conexiones que se cortan (src/logica/limites.js y abajo):
//   - Ficha: la bienvenida lleva una ficha secreta (solo para ese cliente). Si el cliente vuelve a conectar con
//     ?ficha=… en la dirección, es el mismo jugador (mismo autor) y su luchador vuelve como estaba (heridas
//     incluidas) si no han pasado GRACIA ms. Las fichas se guardan (resumidas con sha256) en fichas.jsonl junto
//     al mundo, así que valen también después de reiniciar el servidor.
//   - Si llega una conexión con la ficha de alguien que sigue conectado, la vieja se cierra (código 4001):
//     manda la más nueva (la vieja suele ser una que se ha quedado colgada, p. ej. al salir al menú).
//   - Latido: cada LATIDO ms el servidor manda un ping; quien no contesta (ni manda nada) hasta el siguiente se
//     da por ido y se quita (los demás reciben «sale»).
//   - Límites: cada mensaje, como mucho LIMITES.maxMensaje bytes (si no, ws cierra con 1009); mensajes y bytes
//     por segundo con Limitador. Lo que pasa del límite no se atiende (una acción recibe su resultado con
//     ok: false para que el cliente no se quede esperando); a quien inunda se le echa (código 1008).
//   - Datos mal formados (no JSON, binario, tipos raros, números que no son números): { tipo: 'error' } y nada
//     más; ningún mensaje puede tumbar el servidor (cada uno se atiende dentro de un try).
//
// Uso: node servidor/servidor.mjs [puerto] [archivo]   (por defecto 8080 y servidor/mundo.jsonl)
import { WebSocketServer } from 'ws';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomUUID, createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { PresenciaServidor, CADA, validarAspecto, validarEstado } from '../src/logica/presencia.js';
import { PROTOCOLO } from '../src/logica/protocolo.js';
import { CombateServidor } from '../src/logica/combate_servidor.js';
import { Limitador, LIMITES } from '../src/logica/limites.js';

export const GRACIA = 120000;   // ms que se guarda el luchador de quien se ha cortado (decisión provisional)
export const LATIDO = 10000;    // ms entre pings
const resumen = (ficha) => createHash('sha256').update(ficha).digest('hex').slice(0, 32);
const fichaValida = (f) => typeof f === 'string' && /^[0-9a-f]{32}$/.test(f);

// Lee el archivo del mundo. Una línea cortada al final (el servidor se apagó a mitad) se descarta.
export function leerArchivo(archivo) {
  if (!existsSync(archivo)) return [];
  const entradas = [];
  for (const linea of readFileSync(archivo, 'utf8').split('\n')) {
    if (!linea.trim()) continue;
    try { entradas.push(JSON.parse(linea)); } catch (e) { console.warn('Línea del mundo no válida, se descarta:', linea.slice(0, 80)); }
  }
  return entradas;
}

export function crearServidor({ puerto = 8080, archivo = 'servidor/mundo.jsonl', registrar = () => {}, tico = CADA, ticoCombate = 50, semilla = Date.now(),
  gracia = GRACIA, latido = LATIDO, limites = LIMITES } = {}) {
  archivo = resolve(archivo);
  const archivoCombate = resolve(dirname(archivo), 'combate.jsonl');
  const archivoFichas = resolve(dirname(archivo), 'fichas.jsonl');
  mkdirSync(dirname(archivo), { recursive: true });
  const previas = leerArchivo(archivo);
  // si quedó una línea a medias, lo nuevo empieza en una línea aparte
  if (existsSync(archivo)) { const t = readFileSync(archivo, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivo, '\n'); }
  const mundo = reproducir(previas);
  const registro = new RegistroAcciones();
  registro.total = previas.reduce((m, e) => Math.max(m, e.n || 0), 0);
  const hechas = previas.filter(e => e.ok);   // lo que se manda a cada cliente nuevo

  // fichas: resumen (sha256) → autor
  const fichas = new Map();
  for (const f of leerArchivo(archivoFichas)) if (f && typeof f.h === 'string' && typeof f.autor === 'string') fichas.set(f.h, f.autor);
  if (existsSync(archivoFichas)) { const t = readFileSync(archivoFichas, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivoFichas, '\n'); }

  const wss = new WebSocketServer({ port: puerto, maxPayload: limites.maxMensaje });
  wss.on('error', (e) => registrar(`error del servidor: ${e && e.message}`));
  const clientes = new Map();   // ws → autor
  const conexionDe = new Map(); // autor → ws (la que vale)
  const apartados = new Map();  // autor → { L, hasta }: luchadores de los que se han cortado
  const aspectos = new Map();   // autor → { sexo, capas, aspecto }

  const enviar = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  const reloj = () => Math.round(performance.now());   // hora del servidor (ms), la que llevan los estados

  // combate: el reloj es el del servidor; antes de cada intención se avanza hasta ahora
  const combate = new CombateServidor({ semilla });
  const t0 = reloj();
  const ponerAlDia = () => combate.avanzarHasta((reloj() - t0) / 1000);
  let escritas = 0;
  const repartirCombate = () => {
    const eventos = combate.sacarEventos();
    if (eventos.length) for (const ws of clientes.keys()) enviar(ws, { tipo: 'combate', eventos });
    const nuevas = combate.registro.entradas.filter(e => e.n > escritas);
    if (nuevas.length) { appendFileSync(archivoCombate, nuevas.map(e => JSON.stringify(e)).join('\n') + '\n'); escritas = nuevas[nuevas.length - 1].n; }
  };
  const ticCombate = setInterval(() => {
    ponerAlDia(); repartirCombate();
    const lista = combate.cambiados();
    if (lista.length) for (const ws of clientes.keys()) enviar(ws, { tipo: 'luchadores', t: combate.ms(), lista });
  }, ticoCombate);

  // presencia: cada tic, a cada uno los que han cambiado menos él mismo
  const presencia = new PresenciaServidor();
  const tic = setInterval(() => {
    const lista = presencia.tic();
    if (!lista.length) return;
    const t = reloj();
    for (const [ws, autor] of clientes) {
      const jugadores = lista.filter(e => e.autor !== autor);
      if (jugadores.length) enviar(ws, { tipo: 'estados', t, jugadores });
    }
  }, tico);

  // latido: quien no ha contestado al ping anterior (ni mandado nada) se da por ido
  const ticLatido = setInterval(() => {
    for (const ws of clientes.keys()) {
      if (!ws.vivo) { registrar(`sin latido ${clientes.get(ws)}`); ws.terminate(); continue; }
      ws.vivo = false;
      try { ws.ping(); } catch (e) { /* ya cerrada */ }
    }
    const ahora = reloj();
    for (const [a, x] of apartados) if (x.hasta <= ahora) apartados.delete(a);
  }, latido);

  wss.on('connection', (ws, req) => {
    // ¿vuelve alguien? (su ficha en la dirección: ?ficha=…)
    let ficha = null, autor = null;
    try { ficha = new URL(req.url, 'http://x').searchParams.get('ficha'); } catch (e) { ficha = null; }
    if (fichaValida(ficha) && fichas.has(resumen(ficha))) autor = fichas.get(resumen(ficha));
    const vuelve = !!autor;
    if (!vuelve) {
      autor = 'jugador:' + randomUUID().slice(0, 8);
      ficha = randomUUID().replace(/-/g, '');
      fichas.set(resumen(ficha), autor);
      appendFileSync(archivoFichas, JSON.stringify({ h: resumen(ficha), autor }) + '\n');
    }
    // si seguía conectado con otra (colgada, otra pestaña), manda la nueva
    const vieja = conexionDe.get(autor);
    if (vieja) { conexionDe.delete(autor); clientes.delete(vieja); presencia.quitar(autor); vieja.close(4001, 'Otra conexión'); setTimeout(() => vieja.terminate(), 1000); }
    clientes.set(ws, autor); conexionDe.set(autor, ws);
    ws.vivo = true;
    ws.on('pong', () => { ws.vivo = true; });
    // sin esto, un error de la conexión (p. ej. un mensaje demasiado grande) tumbaría el servidor entero
    ws.on('error', (e) => registrar(`error en la conexión de ${autor}: ${e && (e.code || e.message)}`));
    const limitador = new Limitador(reloj(), limites);
    registrar(`${vuelve ? 'vuelve' : 'entra'} ${autor}`);
    ponerAlDia();
    if (!combate.luchadores[autor]) {
      const ap = apartados.get(autor);
      if (ap) { apartados.delete(autor); combate.volver(autor, ap.L); } else combate.entrar(autor);
    }
    enviar(ws, { tipo: 'bienvenida', protocolo: PROTOCOLO, autor, ficha, vuelve, entradas: hechas, t: reloj(), presentes: presencia.todos().filter(e => e.autor !== autor),
      aspectos: [...aspectos].filter(([a]) => a !== autor).map(([a, e]) => ({ autor: a, ...e })), tc: combate.ms(), luchadores: combate.cambiados(true) });

    ws.on('message', (datos, binario) => {
      if (conexionDe.get(autor) !== ws) return;   // sustituida por otra: ya no cuenta
      ws.vivo = true;
      const tam = datos.length;
      const paso = limitador.admitir(reloj(), tam);
      if (paso === 'echar') { registrar(`echado ${autor} (demasiados mensajes)`); ws.close(1008, 'Demasiados mensajes'); return; }
      if (paso === 'no') {
        if (!ws.avisado) { ws.avisado = true; enviar(ws, { tipo: 'error', motivo: 'Demasiados mensajes.' }); setTimeout(() => { ws.avisado = false; }, 1000); }
        // una acción sí recibe respuesta, para que el cliente quite su copia y no se quede esperando
        if (!binario && tam < 4096) { try { const m = JSON.parse(datos.toString()); if (m && m.tipo === 'accion' && Number.isSafeInteger(m.id)) enviar(ws, { tipo: 'resultado', id: m.id, ok: false, motivo: 'Demasiados mensajes.' }); } catch (e) { /* nada */ } }
        return;
      }
      if (binario) return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      try { atender(datos); } catch (e) {
        registrar(`error atendiendo a ${autor}: ${e && e.message}`);
        enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      }
    });
    function atender(datos) {
      let msg;
      try { msg = JSON.parse(datos.toString()); } catch (e) { return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' }); }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.tipo !== 'string')
        return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      if (msg && msg.tipo === 'estado') {
        if (!presencia.recibir(autor, msg, reloj())) return enviar(ws, { tipo: 'error', motivo: 'Estado no válido.' });
        ponerAlDia();
        const e = validarEstado(msg);
        combate.colocar(autor, e.x, e.z, e.giro);
        return;
      }
      if (msg && msg.tipo === 'combate') {
        // el autor es el de la conexión; lo que diga el mensaje no cuenta
        ponerAlDia();
        const r = combate.intencion(autor, msg);
        if (!r.ok) enviar(ws, { tipo: 'combate_rechazo', que: typeof msg.que === 'string' ? msg.que.slice(0, 24) : null, motivo: r.motivo });
        repartirCombate();
        return;
      }
      if (msg && msg.tipo === 'aspecto') {
        const e = validarAspecto(msg);
        if (!e) return enviar(ws, { tipo: 'error', motivo: 'Aspecto no válido.' });
        aspectos.set(autor, e);
        for (const [otro, a] of clientes) if (a !== autor) enviar(otro, { tipo: 'aspecto', autor, ...e });
        return;
      }
      if (!msg || msg.tipo !== 'accion' || !msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion))
        return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      // el autor lo pone el servidor; el que traiga el cliente se pisa
      const accion = { ...msg.accion, autor };
      const r = ejecutar(mundo, registro, accion);
      const entrada = registro.entradas[registro.entradas.length - 1];
      registro.entradas.length = 0;   // lo guardado va al archivo; en memoria basta con «hechas»
      appendFileSync(archivo, JSON.stringify(entrada) + '\n');
      enviar(ws, { tipo: 'resultado', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: !!r.ok, ...(r.ok ? {} : { motivo: r.motivo }) });
      if (r.ok) {
        hechas.push(entrada);
        for (const otro of clientes.keys()) enviar(otro, { tipo: 'accion', entrada });
      }
    }
    ws.on('close', () => {
      clientes.delete(ws);
      if (conexionDe.get(autor) !== ws) return;   // la sustituyó otra del mismo jugador: él sigue
      conexionDe.delete(autor);
      aspectos.delete(autor); presencia.quitar(autor);
      ponerAlDia();
      const L = combate.apartar(autor);
      if (L) apartados.set(autor, { L, hasta: reloj() + gracia });
      registrar(`sale ${autor}`);
      for (const otro of clientes.keys()) enviar(otro, { tipo: 'sale', autor });
    });
  });

  return {
    wss, mundo, archivo, archivoCombate, archivoFichas, presencia, combate, apartados, clientes,
    listo: new Promise(r => wss.on('listening', () => r(wss.address().port))),
    cerrar: () => new Promise(r => { clearInterval(tic); clearInterval(ticCombate); clearInterval(ticLatido); for (const ws of clientes.keys()) ws.terminate(); wss.close(() => r()); }),
  };
}

// Arranque desde la línea de órdenes
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.argv[2]) || 8080;
  const archivo = process.argv[3] || 'servidor/mundo.jsonl';
  const s = crearServidor({ puerto, archivo, registrar: t => console.log(new Date().toISOString(), t) });
  s.listo.then(p => console.log(`Servidor de Kinhold en el puerto ${p} · mundo en ${s.archivo} · ${s.mundo.construcciones.length} construcciones`));
}
