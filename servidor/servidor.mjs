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
//   servidor → cliente   { tipo: 'bienvenida', autor, obras }          al conectar: el mundo de construcción de sus trozos (abajo)
//                        { tipo: 'resultado', id, ok, motivo? }         respuesta al que la mandó
//                        { tipo: 'accion', entrada, antes }             cuando una acción sale bien (a quien tiene su trozo)
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
//   Lo que lleva cada uno y lo del suelo (src/logica/objetos_red.js): el cliente manda { tipo: 'objeto', id, accion:
//   { tipo: 'mover'|'ponerse'|'quitarse'|'soltar_suelo'|'coger_suelo'|'talar'|'trocear'|'recoger'|'coger'|'soltar', … } };
//   el servidor la hace con el autor de la conexión, su hora y el sitio donde lo tiene (su presencia), y contesta
//   { tipo: 'resultado_objeto', id, ok, motivo?, datos? } (datos: lo que ha pasado, p. ej. si el árbol cae y hacia dónde).
//   Al autor le manda lo que lleva tal como queda, { tipo: 'inventario', inventario } (también si sale mal: así el
//   navegador deshace lo que había adelantado), y si cambia el suelo, a todos { tipo: 'suelo', objetos }. Si cae un
//   árbol, a todos (antes que el suelo) { tipo: 'tala', estado, cae: { arbol, dir, autor, objetos } }; si se recoge algo, { tipo: 'recoleccion',
//   estado }. La bienvenida lleva todo eso (inventario, suelo, tala, recoleccion).
//   Por trozos (src/logica/trozos_red.js): lo del suelo, lo talado y lo recogido llega solo de los trozos que cada uno
//   tiene alrededor (la bienvenida, los de donde aparece). Al cambiar de trozo le llega { tipo: 'trozos', entran,
//   tala, recoleccion, suelo } (lo talado y lo recogido de los trozos que le entran, y el suelo de todos los suyos).
//   Las obras, la decoración y lo alisado (src/logica/obras_red.js): la bienvenida lleva obras (la foto del mundo de
//   construcción con solo lo de sus trozos) en vez de todas las entradas, y al cambiar de trozo le llega { tipo: 'obras',
//   obras } con la de sus trozos nuevos (también si la pide, { tipo: 'obras' }: el navegador lo hace si una acción que le
//   llega no le sale igual). { tipo: 'accion', entrada, antes } va solo a quien tiene su trozo (y al autor); las de todo
//   el mundo (mojón, arcón), a todos. «antes»: el contador de ids, el arcón y el mojón justo antes de hacerla.
//   'tala' y 'recoleccion' llevan solo lo de su trozo y solo a quien lo tiene; 'suelo', lo de los trozos de cada uno.
//   El navegador junta lo que le llega de lo talado y lo recogido con lo que ya tenía. 'coger' y 'soltar' son el arcón de
//   pruebas (arconPruebas, sí por ahora). Se guarda entero en objetos.json junto al mundo, y cada acción (bien o mal)
//   en objetos.jsonl.
//   Las obras cobran de ahí (src/logica/acciones.js): entregar, subir y el arcón de materiales (sacar_arcon y dejar_arcon,
//   solo con arconPruebas) se ejecutan con los inventarios del servidor; la entrada que se guarda y se reparte va ya
//   pagada («lleva» y la cantidad de verdad), así que al volver a arrancar y en los demás navegadores el mundo se rehace
//   igual sin conocer lo que lleva cada uno. Al autor le llega además { tipo: 'inventario' } (bien o mal).
//
//   Cuentas (src/logica/cuentas.js; usuario y contraseña): { tipo: 'cuenta', id, que: 'crear' | 'entrar', usuario, clave }.
//   Crear: la cuenta es del personaje de esta conexión (su autor). Entrar: contesta con una ficha de ese personaje y el
//   cliente vuelve a conectar con ?ficha=… (abajo). Las contraseñas, resumidas con scrypt y sal (servidor/claves.mjs) en
//   cuentas.jsonl junto al mundo; nunca en claro ni en el registro. La bienvenida dice { cuenta: usuario | null }.
//   { tipo: 'cuenta', que: 'salir_todos' }: todas las fichas de ese personaje dejan de valer y sus conexiones se cierran
//   (código 4002). Las fichas de los personajes con cuenta caducan (src/logica/fichas.js). Altas, entradas, fallos,
//   salidas y fichas caducadas van a seguridad.jsonl junto al mundo (con la dirección; nunca la contraseña ni la ficha).
//   El correo de la cuenta (valravnx, 2 nov; src/logica/correo.js): al crear la cuenta va también { correo } y se manda
//   el código (servidor/correo.mjs: con Resend, o al registro si no hay clave). { tipo: 'cuenta', id, que: 'correo', correo }
//   pone o cambia el correo sin confirmar y manda el código; { que: 'reenviar' } manda otro; { que: 'verificar', codigo }
//   lo confirma. Mientras la cuenta de esta conexión no tenga el correo confirmado, no entra en el mundo: no se atienden
//   sus acciones, objetos, combate, movimientos ni admin (las acciones y objetos reciben «Confirma tu correo…»). La
//   bienvenida dice { correo: null (sin cuenta) | { correo: a***@d***.com | null, verificado } }.
//   Panel de depuración del admin (src/logica/admin.js): { tipo: 'admin', id, que: 'ver' | 'ir', … }. Solo para la
//   conexión cuyo personaje es de una cuenta de admin (cuentasAdmin, o la variable KINHOLD_ADMIN_CUENTA; por defecto la
//   cuenta «valravnx»; servidor/nube/LEEME.md). Sin clave aparte. La bienvenida dice { admin: true } a esa conexión, y la
//   respuesta al crear la cuenta también. Cada petición, bien o mal, va a admin.jsonl junto al mundo con su autor.
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
import { readFileSync, appendFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomUUID, createHash, randomInt } from 'crypto';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { RegistroAcciones, ejecutar, reproducir, USAN_INVENTARIO } from '../src/logica/acciones.js';
import { PresenciaServidor, CADA, validarAspecto, validarEstado } from '../src/logica/presencia.js';
import { llevadoDe, huellaLlevado } from '../src/logica/llevado.js';
import { PROTOCOLO } from '../src/logica/protocolo.js';
import { CombateServidor } from '../src/logica/combate_servidor.js';
import { Limitador, LIMITES } from '../src/logica/limites.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';
import { validarPeticionAdmin, sitioJunto, listaJugadores, cuentasAdmin as listaAdmin, esCuentaAdmin, NO_ADMIN } from '../src/logica/admin.js';
import { Cuentas, validarPeticionCuenta, claveDeUsuario } from '../src/logica/cuentas.js';
import { Verificaciones, enmascarar, codigoValido, CODIGO_CIFRAS } from '../src/logica/correo.js';
import { crearCartero } from './correo.mjs';
import { Fichas, FICHA_VIDA } from '../src/logica/fichas.js';
import * as claves from './claves.mjs';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { VistaTrozos, trozoDe, LADO_RED, RADIO_RED } from '../src/logica/trozos_red.js';
import { sitioAccion, sitioColocada, comunDe, obrasEnTrozos } from '../src/logica/obras_red.js';
import { ponerZonas } from '../src/logica/construccion.js';

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
  gracia = GRACIA, latido = LATIDO, limites = LIMITES, arconPruebas = true, cuentasAdmin = process.env.KINHOLD_ADMIN_CUENTA, terreno = null,
  tierras = terreno && terreno.tierras, parametrosClave = claves.PARAMETROS, vidaFicha = FICHA_VIDA, altas = {}, cartero = null } = {}) {
  archivo = resolve(archivo);
  // tu tierra es la zona entera de tu mojón (src/logica/construccion.js): antes de rehacer el mundo del archivo
  ponerZonas(terreno && terreno.zona);
  const archivoCombate = resolve(dirname(archivo), 'combate.jsonl');
  const archivoFichas = resolve(dirname(archivo), 'fichas.jsonl');
  const archivoObjetos = resolve(dirname(archivo), 'objetos.json');
  const archivoObjetosReg = resolve(dirname(archivo), 'objetos.jsonl');
  const archivoPosiciones = resolve(dirname(archivo), 'posiciones.json');
  const archivoAdmin = resolve(dirname(archivo), 'admin.jsonl');
  const archivoCuentas = resolve(dirname(archivo), 'cuentas.jsonl');
  // el registro de seguridad: altas, entradas, fallos y salidas en todos los aparatos (nunca la contraseña ni la ficha)
  const archivoSeguridad = resolve(dirname(archivo), 'seguridad.jsonl');
  const seguridad = (e) => { try { appendFileSync(archivoSeguridad, JSON.stringify({ t: new Date().toISOString(), ...e }) + '\n'); } catch (x) { registrar(`no se pudo apuntar en seguridad.jsonl: ${x && x.message}`); } };
  // las cuentas de admin (el admin, por la cuenta: revisión del 1 nov)
  const admins = listaAdmin(cuentasAdmin);
  mkdirSync(dirname(archivo), { recursive: true });
  const previas = leerArchivo(archivo);
  // si quedó una línea a medias, lo nuevo empieza en una línea aparte
  if (existsSync(archivo)) { const t = readFileSync(archivo, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivo, '\n'); }
  const mundo = reproducir(previas);
  const registro = new RegistroAcciones();
  registro.total = previas.reduce((m, e) => Math.max(m, e.n || 0), 0);

  // fichas: resumen (sha256) → autor
  // (caducan a los vidaFicha ms si su personaje tiene cuenta; «salir en todos los aparatos»: src/logica/fichas.js)
  const fichas = new Fichas({ vida: vidaFicha, conCuenta: (a) => !!cuentas.deAutor(a), lineas: leerArchivo(archivoFichas), ahora: Date.now() });
  if (existsSync(archivoFichas)) { const t = readFileSync(archivoFichas, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivoFichas, '\n'); }

  // cuentas: usuario → su personaje (autor), con la contraseña resumida (scrypt con sal); nunca en claro
  if (existsSync(archivoCuentas)) { const t = readFileSync(archivoCuentas, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivoCuentas, '\n'); }
  const cuentas = new Cuentas({ resumir: (c, s) => claves.resumir(c, s, parametrosClave), sal: claves.sal, iguales: claves.iguales, previas: leerArchivo(archivoCuentas), altas });
  const usuarioDe = (autor) => (cuentas.deAutor(autor) || {}).usuario || null;
  // el correo: los códigos pendientes (en memoria, resumidos) y quien los manda
  const verificaciones = new Verificaciones({ azar: () => randomInt(0, 10 ** CODIGO_CIFRAS), resumir: (x) => createHash('sha256').update(x).digest('hex') });
  if (!cartero) cartero = crearCartero({ registrar });
  const SIN_CORREO = 'Confirma tu correo para entrar en el mundo.';
  const estadoCorreo = (autor) => { const e = cuentas.correoDe(autor); return e ? { correo: e.correo ? enmascarar(e.correo) : null, verificado: e.verificado } : null; };
  // un código nuevo para la cuenta de ese personaje, y a mandarlo. Promise<{ ok, motivo? }>
  const mandarCodigo = async (autor, origen, idioma) => {
    const e = cuentas.correoDe(autor);
    if (!e || !e.correo) return { ok: false, motivo: 'Falta el correo.' };
    if (e.verificado) return { ok: false, motivo: 'El correo de esta cuenta ya está confirmado.' };
    const k = claveDeUsuario(e.usuario), r = verificaciones.pedir(k, e.correo, Date.now());
    if (!r.ok) { seguridad({ que: 'codigo', ok: false, usuario: e.usuario, autor, origen, motivo: r.motivo }); return r; }
    const s = await cartero.enviar({ para: e.correo, usuario: e.usuario, codigo: r.codigo, idioma });
    seguridad({ que: 'codigo', ok: !!s.ok, usuario: e.usuario, autor, origen, correo: enmascarar(e.correo), ...(s.ok ? {} : { motivo: s.motivo }) });
    if (!s.ok) verificaciones.olvidar(k);
    return s.ok ? { ok: true } : { ok: false, motivo: s.motivo };
  };
  const esAdmin = (autor) => esCuentaAdmin(usuarioDe(autor), admins);
  // una ficha nueva para un autor (al entrar con la cuenta: con ella vuelve a conectar y es su personaje)
  const fichaPara = (autor) => {
    const f = randomUUID().replace(/-/g, '');
    const t = Date.now();
    fichas.poner(resumen(f), autor, t);
    appendFileSync(archivoFichas, JSON.stringify({ h: resumen(f), autor, t }) + '\n');
    return f;
  };

  // lo que lleva cada uno y lo del suelo: dónde está cada autor lo dice su presencia (más abajo)
  let presencia = null;
  const objetos = new ObjetosServidor({
    posicion: (a) => { const e = presencia && presencia.ultimo.get(a); return e ? { x: e.x, z: e.z, giro: e.giro } : null; },
    enTierras: (a, x, z) => !!mundo.tierraDe(x, z),   // en la tierra de alguien, lo soltado no se pierde
    arconPruebas, terreno,
  });
  if (existsSync(archivoObjetos)) {
    try { objetos.importar(JSON.parse(readFileSync(archivoObjetos, 'utf8'))); } catch (e) { registrar(`objetos.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  // se escribe en uno aparte y se cambia de nombre: si el servidor se apaga a mitad, queda el anterior entero
  const guardarObjetos = () => { writeFileSync(archivoObjetos + '.tmp', JSON.stringify(objetos.exportar())); renameSync(archivoObjetos + '.tmp', archivoObjetos); };

  // Volver donde lo dejaste (valravnx, 31 oct): dónde estaba cada jugador al salir (autor → { x, y, z, giro }, relativo
  // al sitio de salida, como su presencia). Se apunta al salir y, por si el servidor se apaga de golpe, en cada latido
  // con los que están conectados; se manda en la bienvenida para que el cliente ponga ahí a su jugador.
  const posiciones = new Map();
  if (existsSync(archivoPosiciones)) {
    try { for (const [a, p] of Object.entries(JSON.parse(readFileSync(archivoPosiciones, 'utf8')))) { const e = validarEstado({ ...p, anim: 'quieto' }); if (e) posiciones.set(a, { x: e.x, y: e.y, z: e.z, giro: e.giro }); } }
    catch (e) { registrar(`posiciones.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  let posicionesCambiadas = false;
  // (en el «Duelo» se está en la liza, una escena aparte: esa posición no es la del mundo y no se apunta)
  const apuntarPosicion = (a) => {
    const e = presencia && presencia.ultimo.get(a);
    if (!e || (combate.luchadores[a] && combate.luchadores[a].liza)) return;
    const p = posiciones.get(a);
    if (p && p.x === e.x && p.y === e.y && p.z === e.z && p.giro === e.giro) return;
    posiciones.set(a, { x: e.x, y: e.y, z: e.z, giro: e.giro }); posicionesCambiadas = true;
  };
  const guardarPosiciones = () => {
    if (!posicionesCambiadas) return;
    posicionesCambiadas = false;
    writeFileSync(archivoPosiciones + '.tmp', JSON.stringify(Object.fromEntries(posiciones))); renameSync(archivoPosiciones + '.tmp', archivoPosiciones);
  };

  const wss = new WebSocketServer({ port: puerto, maxPayload: limites.maxMensaje });
  wss.on('error', (e) => registrar(`error del servidor: ${e && e.message}`));
  const clientes = new Map();   // ws → autor
  const conexionDe = new Map(); // autor → ws (la que vale)
  const apartados = new Map();  // autor → { L, hasta }: luchadores de los que se han cortado
  const aspectos = new Map();   // autor → { sexo, capas, aspecto }
  const vista = new VistaTrozos(); // autor → los trozos que tiene alrededor (lo que se le ha mandado)
  // el suelo de los trozos de cada uno, a todos
  const repartirSuelo = (ahora) => { for (const [ws, a] of clientes) enviar(ws, { tipo: 'suelo', objetos: objetos.sueloVisible(ahora, vista.trozosDe(a)) }); };

  const enviar = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  // Si ha cambiado lo que se ve que lleva (al coger, soltar, ponerse algo…), se vuelve a repartir su aspecto.
  const repartirLlevado = (autor) => {
    const e = aspectos.get(autor); if (!e) return;
    const l = llevadoDe(objetos.invs.de(autor).lugares);
    if (huellaLlevado(l) === huellaLlevado(e.llevado)) return;
    e.llevado = l;
    for (const [otro, a] of clientes) if (a !== autor) enviar(otro, { tipo: 'aspecto', autor, ...e });
  };
  const reloj = () => Math.round(performance.now());   // hora del servidor (ms), la que llevan los estados

  // combate: el reloj es el del servidor; antes de cada intención se avanza hasta ahora
  // Strandvang, tierras del rey: ahí no se hiere a otro jugador (tierras: en(x, z) de src/logica/tierras_rey.js)
  const combate = new CombateServidor({ semilla, tierras: tierras || null });
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
  presencia = new PresenciaServidor();
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
    for (const a of clientes.values()) apuntarPosicion(a);
    guardarPosiciones();
    const ahora = reloj();
    for (const [a, x] of apartados) if (x.hasta <= ahora) apartados.delete(a);
    // lo soltado fuera de las tierras desaparece pasada su hora
    const t = Date.now();
    if (objetos.limpiar(t)) { guardarObjetos(); repartirSuelo(t); }
  }, latido);

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
    ponerAlDia();
    if (!combate.luchadores[autor]) {
      const ap = apartados.get(autor);
      if (ap) { apartados.delete(autor); combate.volver(autor, ap.L); } else combate.entrar(autor);
    }
    // lo de alrededor de donde aparece: donde lo dejó o la salida
    vista.quitar(autor);
    { const p = posiciones.get(autor); vista.mover(autor, p ? p.x : 0, p ? p.z : 0); }
    const suyos = vista.trozosDe(autor);
    enviar(ws, { tipo: 'bienvenida', protocolo: PROTOCOLO, autor, ficha, vuelve, obras: obrasEnTrozos(mundo, suyos), n: registro.total, t: reloj(), presentes: presencia.todos().filter(e => e.autor !== autor),
      aspectos: [...aspectos].filter(([a]) => a !== autor).map(([a, e]) => ({ autor: a, ...e })), tc: combate.ms(), luchadores: combate.cambiados(true),
      inventario: objetos.inventarioDe(autor), suelo: objetos.sueloVisible(Date.now(), suyos), tala: objetos.talaVisible(suyos), recoleccion: objetos.recoleccionVisible(suyos),
      trozos: { lado: LADO_RED, radio: RADIO_RED }, posicion: posiciones.get(autor) || null, cuenta: usuarioDe(autor), admin: esAdmin(autor), correo: estadoCorreo(autor) });

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
      // sin el correo confirmado no se entra en el mundo (las acciones y los objetos reciben su respuesta)
      if (['estado', 'obras', 'combate', 'aspecto', 'accion', 'objeto', 'admin'].includes(msg.tipo) && cuentas.sinConfirmar(autor)) {
        const id = Number.isSafeInteger(msg.id) ? msg.id : null;
        if (msg.tipo === 'accion' || msg.tipo === 'objeto') enviar(ws, { tipo: msg.tipo === 'objeto' ? 'resultado_objeto' : 'resultado', id, ok: false, motivo: SIN_CORREO });
        else if (msg.tipo === 'admin') enviar(ws, { tipo: 'admin', id, que: null, ok: false, motivo: SIN_CORREO });
        return;
      }
      if (msg && msg.tipo === 'estado') {
        // con el terreno, dentro de la isla y cerca del suelo (en la liza del «Duelo» no: es una escena aparte)
        if (terreno && !(combate.luchadores[autor] && combate.luchadores[autor].liza)) {
          const e = validarEstado(msg), mal = e ? terreno.posicion(e) : null;
          if (mal) return enviar(ws, { tipo: 'error', motivo: mal });
        }
        if (!presencia.recibir(autor, msg, reloj())) return enviar(ws, { tipo: 'error', motivo: 'Estado no válido.' });
        ponerAlDia();
        const e = validarEstado(msg);
        combate.colocar(autor, e.x, e.z, e.giro);
        // si ha cambiado de trozo, lo de los trozos que le entran (en la liza no: es una escena aparte)
        if (!(combate.luchadores[autor] && combate.luchadores[autor].liza)) {
          const entran = vista.mover(autor, e.x, e.z);
          if (entran.length) {
            const nuevos = new Set(entran);
            enviar(ws, { tipo: 'trozos', entran, tala: objetos.talaVisible(nuevos), recoleccion: objetos.recoleccionVisible(nuevos), suelo: objetos.sueloVisible(Date.now(), vista.trozosDe(autor)) });
            enviar(ws, { tipo: 'obras', obras: obrasEnTrozos(mundo, vista.trozosDe(autor)) });
          }
        }
        return;
      }
      if (msg && msg.tipo === 'obras') return enviar(ws, { tipo: 'obras', obras: obrasEnTrozos(mundo, vista.trozosDe(autor)) });
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
        // lo que lleva encima (cinturón, espalda, hombro y manos) lo pone el servidor, de su inventario: el del
        // navegador no se cree (src/logica/llevado.js)
        e.llevado = llevadoDe(objetos.invs.de(autor).lugares);
        aspectos.set(autor, e);
        for (const [otro, a] of clientes) if (a !== autor) enviar(otro, { tipo: 'aspecto', autor, ...e });
        return;
      }
      if (msg && msg.tipo === 'cuenta') {
        const id = Number.isSafeInteger(msg.id) ? msg.id : null, que = ['crear', 'entrar', 'salir_todos', 'correo', 'reenviar', 'verificar'].includes(msg.que) ? msg.que : null;
        const responder = (r) => enviar(ws, { tipo: 'cuenta', id, que, ...r });
        // salir en todos los aparatos: todas las fichas de este personaje dejan de valer y se cierran sus conexiones
        // (también esta: se vuelve a entrar con usuario y contraseña)
        if (que === 'salir_todos') {
          const usuario = usuarioDe(autor);
          if (!usuario) { seguridad({ que, ok: false, autor, origen, motivo: 'sin cuenta' }); return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' }); }
          const n = fichas.fuera(autor);
          appendFileSync(archivoFichas, JSON.stringify({ fuera: autor, t: Date.now() }) + '\n');
          seguridad({ que, ok: true, usuario, autor, origen, fichas: n });
          registrar(`sale en todos los aparatos «${usuario}» (${n} fichas)`);
          responder({ ok: true });
          for (const [w, a] of clientes) if (a === autor) setTimeout(() => { try { w.close(4002, 'Sesión cerrada'); } catch (e) { /* ya cerrada */ } }, 100);
          return;
        }
        // una a la vez por conexión (resumir la contraseña cuesta): la que llega mientras, se rechaza
        if (ws.cuentaEnCurso) return responder({ ok: false, motivo: 'Espera a la respuesta anterior.' });
        const idioma = ['es', 'en', 'ru'].includes(msg.idioma) ? msg.idioma : 'es';
        // el correo: ponerlo o cambiarlo (sin confirmar), pedir otro código, confirmarlo
        if (que === 'correo' || que === 'reenviar' || que === 'verificar') {
          const usuario = usuarioDe(autor);
          if (!usuario) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
          if (que === 'verificar') {
            const r = verificaciones.comprobar(claveDeUsuario(usuario), typeof msg.codigo === 'string' ? msg.codigo.slice(0, 20) : '', Date.now());
            const c = r.ok ? cuentas.confirmarCorreo(autor, r.correo, Date.now()) : r;
            seguridad({ que: 'verificar', ok: c.ok, usuario, autor, origen, ...(c.ok ? {} : { motivo: c.motivo }) });
            if (!c.ok) return responder({ ok: false, motivo: c.motivo });
            appendFileSync(archivoCuentas, JSON.stringify(c.linea) + '\n');
            registrar(`correo confirmado de «${usuario}»`);
            return responder({ ok: true, admin: esAdmin(autor), correo: estadoCorreo(autor) });
          }
          if (que === 'correo') {
            const m = cuentas.motivoCorreoDe(autor, typeof msg.correo === 'string' ? msg.correo : null);
            if (m) { seguridad({ que: 'correo', ok: false, usuario, autor, origen, motivo: m }); return responder({ ok: false, motivo: m }); }
            // antes de cambiarlo, que se pueda mandar el código (si no, se cambiaría de correo sin espera)
            const e = cuentas.correoDe(autor);
            if (e.correo && verificaciones.falta(claveDeUsuario(usuario), msg.correo, Date.now()) > 0) {
              const r = verificaciones.pedir(claveDeUsuario(usuario), msg.correo, Date.now());
              return responder({ ok: false, motivo: r.motivo });
            }
            const r = cuentas.ponerCorreo(autor, msg.correo, Date.now());
            appendFileSync(archivoCuentas, JSON.stringify(r.linea) + '\n');
            verificaciones.olvidar(claveDeUsuario(usuario));
          }
          ws.cuentaEnCurso = true;
          mandarCodigo(autor, origen, idioma)
            .then((r) => responder({ ...r, correo: estadoCorreo(autor) }))
            .catch((e) => { registrar(`error con el correo: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
            .finally(() => { ws.cuentaEnCurso = false; });
          return;
        }
        const p = validarPeticionCuenta(msg);
        if (p.motivo) { seguridad({ que: que === 'crear' ? 'alta' : 'entrar', ok: false, autor, origen, motivo: p.motivo }); return responder({ ok: false, motivo: p.motivo }); }
        ws.cuentaEnCurso = true;
        const ahora = Date.now();
        (p.que === 'crear' ? cuentas.crear({ usuario: p.usuario, clave: p.clave, correo: p.correo, autor, origen, ahora }) : cuentas.entrar({ usuario: p.usuario, clave: p.clave, origen, ahora }))
          .then((r) => {
            if (p.que === 'crear' && r.ok) {
              appendFileSync(archivoCuentas, JSON.stringify(r.cuenta) + '\n');
              registrar(`cuenta nueva «${r.cuenta.usuario}» para ${autor} (desde ${origen})`);
              seguridad({ que: 'alta', ok: true, usuario: r.cuenta.usuario, autor, origen, correo: enmascarar(r.cuenta.correo) });
              // y el código para confirmar el correo (si no sale, se pide otro desde la pantalla)
              return mandarCodigo(autor, origen, idioma).then((m) =>
                responder({ ok: true, usuario: r.cuenta.usuario, autor, admin: esAdmin(autor), correo: estadoCorreo(autor), ...(m.ok ? {} : { aviso: m.motivo }) }));
            }
            if (p.que === 'entrar' && r.ok) {
              registrar(`entra con la cuenta «${r.usuario}» → ${r.autor} (desde ${origen})`);
              seguridad({ que: 'entrar', ok: true, usuario: r.usuario, autor: r.autor, origen });
              return responder({ ok: true, usuario: r.usuario, autor: r.autor, ficha: fichaPara(r.autor) });
            }
            registrar(`cuenta: ${p.que} «${p.usuario}» rechazado (${r.motivo}) desde ${origen}`);
            seguridad({ que: p.que === 'crear' ? 'alta' : 'entrar', ok: false, usuario: p.usuario, autor, origen, motivo: r.motivo, ...(r.bloqueado ? { bloqueado: true } : {}) });
            responder({ ok: false, motivo: r.motivo });
          })
          .catch((e) => { registrar(`error con la cuenta: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
          .finally(() => { ws.cuentaEnCurso = false; });
        return;
      }
      if (msg && msg.tipo === 'admin') {
        const id = Number.isSafeInteger(msg.id) ? msg.id : null, que = msg.que === 'ver' || msg.que === 'ir' ? msg.que : null;
        const apuntar = (r) => appendFileSync(archivoAdmin, JSON.stringify({ t: new Date().toISOString(), autor, cuenta: usuarioDe(autor), que, ...(que === 'ir' ? { x: Number.isFinite(msg.x) ? msg.x : undefined, z: Number.isFinite(msg.z) ? msg.z : undefined, junto: typeof msg.junto === 'string' ? msg.junto.slice(0, 60) : undefined } : {}), ok: r.ok, ...(r.ok ? {} : { motivo: r.motivo }) }) + '\n');
        const responder = (r) => { if (que !== 'ver' || !r.ok) apuntar(r); enviar(ws, { tipo: 'admin', id, que, ...r }); };
        // solo la cuenta de admin (la de esta conexión: lo que diga el mensaje no cuenta)
        if (!esAdmin(autor)) return responder({ ok: false, motivo: NO_ADMIN });
        const p = validarPeticionAdmin(msg);
        if (!p) return responder({ ok: false, motivo: 'Petición de admin no válida.' });
        if (p.que === 'ver') {
          const estados = new Map();
          for (const a of conexionDe.keys()) { const e = presencia.ultimo.get(a); if (e) estados.set(a, e); }
          return responder({ ok: true, yo: autor, jugadores: listaJugadores(estados, usuarioDe) });
        }
        if (p.junto !== undefined) {
          const e = conexionDe.has(p.junto) && presencia.ultimo.get(p.junto);
          if (!e || p.junto === autor) return responder({ ok: false, motivo: 'Ese jugador no está conectado.' });
          const d = sitioJunto(e);
          registrar(`admin ${autor} va junto a ${p.junto}`);
          return responder({ ok: true, x: d.x, y: d.y, z: d.z, giro: d.giro });
        }
        registrar(`admin ${autor} va a ${Math.round(p.x)}, ${Math.round(p.z)}`);
        return responder({ ok: true, x: p.x, y: null, z: p.z });
      }
      if (msg && msg.tipo === 'objeto') {
        if (!msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion)) return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
        // el autor lo pone el servidor, y la hora también
        const ahora = Date.now();
        const r = objetos.ejecutar(Object.assign({}, msg.accion, { autor }), ahora);
        if (r.entrada) appendFileSync(archivoObjetosReg, JSON.stringify(r.entrada) + '\n');
        if (r.ok) guardarObjetos();
        const { ok: _o, motivo: _m, entrada: _e, suelo: _s, ...datos } = r;
        enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: !!r.ok, ...(r.ok ? { datos } : { motivo: r.motivo }) });
        enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
        if (r.ok) repartirLlevado(autor);
        // lo talado antes que el suelo: así el navegador esconde lo que deja el árbol hasta que lo ve caer
        // lo talado y lo recogido, solo lo de su trozo y solo a quien lo tiene alrededor (el autor siempre)
        const aSuTrozo = (sitio, hacer) => {
          const k = sitio ? trozoDe(sitio.x, sitio.z) : null, solo = k ? new Set([k]) : new Set();
          for (const [otro, a] of clientes) if (a === autor || (k && vista.tiene(a, k))) hacer(otro, solo);
        };
        if (r.ok && r.cae) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro, solo) => enviar(otro, { tipo: 'tala', estado: objetos.talaVisible(solo), cae: { arbol: msg.accion.arbol, dir: r.dir, autor, objetos: r.objetos } }));
        if (r.suelo) repartirSuelo(ahora);
        if (r.ok && msg.accion.tipo === 'recoger') aSuTrozo(objetos.sitioPunto(msg.accion.punto), (otro, solo) => enviar(otro, { tipo: 'recoleccion', estado: objetos.recoleccionVisible(solo) }));
        return;
      }
      if (!msg || msg.tipo !== 'accion' || !msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion))
        return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      // el autor lo pone el servidor; el que traiga el cliente se pisa
      const accion = { ...msg.accion, autor };
      // las obras cobran de lo que llevas (los inventarios del servidor); el arcón de materiales, solo si hay arcón de pruebas
      const usaInventario = USAN_INVENTARIO.has(accion.tipo);
      const sinArcon = !arconPruebas && (accion.tipo === 'sacar_arcon' || accion.tipo === 'dejar_arcon');
      // con el terreno, las obras se miran contra él (la planta baja, solo si empieza una construcción nueva)
      const nueva = accion.tipo !== 'colocar' || !Number.isFinite(accion.x) || !Number.isFinite(accion.z) || !mundo.construccionCercana(accion.x, accion.z);
      const contraTerreno = terreno && nueva ? terreno.obra(accion, mundo.marcasNivelado()) : null;
      // dónde cae (antes de hacerla: desmontar puede quitar la construcción) y lo de todos tal como estaba
      const sitioAntes = sitioAccion(mundo, accion), antes = comunDe(mundo);
      const r = sinArcon ? { ok: false, motivo: 'Aquí no hay arcón.' } : contraTerreno ? { ok: false, motivo: contraTerreno } : ejecutar(mundo, registro, accion, usaInventario ? objetos.invs : null);
      if (sinArcon || contraTerreno) registro.anotar(accion, r);
      const entrada = registro.entradas[registro.entradas.length - 1];
      registro.entradas.length = 0;   // lo guardado va al archivo; en memoria basta con el mundo
      appendFileSync(archivo, JSON.stringify(entrada) + '\n');
      if (usaInventario && r.ok) guardarObjetos();
      enviar(ws, { tipo: 'resultado', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: !!r.ok, ...(r.ok ? {} : { motivo: r.motivo }) });
      // lo que llevas tal como queda (también si sale mal: el navegador lo había adelantado)
      if (usaInventario) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
      if (usaInventario && r.ok) repartirLlevado(autor);
      if (r.ok) {
        // solo a quien tiene su trozo alrededor (y al autor); lo que no tiene sitio, a todos
        const sitio = accion.tipo === 'colocar' ? (sitioColocada(r) || sitioAntes) : sitioAntes;
        const k = sitio ? trozoDe(sitio.x, sitio.z) : null;
        for (const [otro, a] of clientes) if (!k || a === autor || vista.tiene(a, k)) enviar(otro, { tipo: 'accion', entrada, antes });
      }
    }
    ws.on('close', () => {
      clientes.delete(ws);
      if (conexionDe.get(autor) !== ws) return;   // la sustituyó otra del mismo jugador: él sigue
      conexionDe.delete(autor);
      apuntarPosicion(autor); guardarPosiciones();
      // la rastra que arrastraba se queda donde estaba (antes de olvidar dónde estaba él)
      if (objetos.soltarAlSalir(autor, Date.now())) { guardarObjetos(); repartirSuelo(Date.now()); }
      aspectos.delete(autor); presencia.quitar(autor); vista.quitar(autor);
      ponerAlDia();
      const L = combate.apartar(autor);
      if (L) apartados.set(autor, { L, hasta: reloj() + gracia });
      registrar(`sale ${autor}`);
      for (const otro of clientes.keys()) enviar(otro, { tipo: 'sale', autor });
    });
  });

  return {
    wss, mundo, terreno, vista, archivo, archivoAdmin, archivoCuentas, archivoSeguridad, cuentas, fichas, verificaciones, cartero, archivoCombate, archivoFichas, archivoPosiciones, posiciones, archivoObjetos, archivoObjetosReg, objetos, presencia, combate, apartados, clientes,
    listo: new Promise(r => wss.on('listening', () => r(wss.address().port))),
    cerrar: () => new Promise(r => { clearInterval(tic); clearInterval(ticCombate); clearInterval(ticLatido); for (const ws of clientes.keys()) ws.terminate(); wss.close(() => r()); }),
  };
}

// Arranque desde la línea de órdenes
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.argv[2]) || 8080;
  const archivo = process.argv[3] || 'servidor/mundo.jsonl';
  // el mundo de verdad, con la misma semilla que el navegador (unos segundos al arrancar)
  // (lo primero que escribe es la línea de «en el puerto», cuando ya escucha: las pruebas la esperan para conectar)
  const t0 = Date.now(), terreno = terrenoWhitholm(), ms = Date.now() - t0;
  // KINHOLD_PRUEBAS_ALTAS=libres: sin límite de altas, solo para las pruebas de navegador (crean varias cuentas seguidas
  // desde la misma máquina). Nunca en el servidor de verdad: lo dice en la línea de arranque.
  const altasLibres = process.env.KINHOLD_PRUEBAS_ALTAS === 'libres';
  const s = crearServidor({ puerto, archivo, terreno, registrar: t => console.log(new Date().toISOString(), t), altas: altasLibres ? { origen: 1e6, total: 1e6, espera: 0 } : {} });
  s.listo.then(p => console.log(`Servidor de Kinhold en el puerto ${p} · mundo en ${s.archivo} · ${s.mundo.construcciones.length} construcciones · Whitholm generado en ${ms} ms · correo: ${s.cartero.conClave ? 'Resend' : 'sin clave de Resend, los códigos van al registro'}${altasLibres ? ' · AVISO: altas sin límite (KINHOLD_PRUEBAS_ALTAS=libres), solo para pruebas' : ''}`));
}
