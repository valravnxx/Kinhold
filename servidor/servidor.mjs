// Servidor mínimo de la prueba online (hito 1f). Node + paquete ws.
//
// Partido por sistemas (12 nov): aquí, crearServidor y el arranque; el guardado en archivos, en servidor/guardado.mjs;
// y cada sistema en servidor/sistemas/: cuentas, objetos, posiciones, necesidades, combate, muerte (dormir y morir),
// fauna, tierras (la que vuelve al rey), admin y conexion (la bienvenida, los mensajes, la presencia y el latido).
//
// - Cada conexión recibe un autor que pone el servidor («jugador:…»). Lo que diga el cliente como
//   autor se ignora siempre: el servidor lo sobrescribe antes de ejecutar.
// - Las acciones de construcción pasan por la lógica pura (ejecutar, src/logica/acciones.js), igual que
//   en el navegador. Las que salen bien se reparten a todos los conectados.
// - Todas las acciones (bien o mal) se guardan en un archivo, una por línea (JSON), para poder auditarlas.
//   Al arrancar, el mundo se rehace desde su estado guardado (mundo_estado.json) y lo que vino después (cargarMundo).
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
//   Liebres (src/logica/fauna.js): las mueve el servidor; a cada uno, las de sus trozos: { tipo: 'fauna', liebres, fuera }.
//   Cazar (9 nov): en el modo arma, con la lanza o una piedra en la mano, se lanza apuntando (combate: tensar y soltar);
//   lo lanzado puede dar a una liebre (el evento «flecha» con resultado «presa»): cae muerta y queda en el suelo.
//   Aspecto (cuerpo y ropa del taller, y la personalización de src/logica/aspecto.js): el cliente lo manda al
//   conectar, { tipo: 'aspecto', sexo, capas, aspecto }; el
//   servidor lo comprueba (validarAspecto) y lo reparte a los demás, { tipo: 'aspecto', autor, sexo, capas, aspecto }. La bienvenida
//   lleva los de los que ya están (aspectos).
//   Charla (chat de texto, src/logica/charla.js): el cliente manda { tipo: 'decir', texto }; el servidor lo limpia, mira
//   que no hable a chorro y lo reparte, con el autor de la conexión, a quien está a ALCANCE m (y al que habla):
//   { tipo: 'dicho', autor, texto }. Las frases rápidas (FRASES) van por su número: { tipo: 'decir', frase } y
//   { tipo: 'dicho', autor, frase }, y cada navegador la pone en su idioma. Si no vale: { tipo: 'error', motivo }. Lo dicho queda en charla.jsonl, junto al mundo.
//   Combate (src/logica/combate_servidor.js): cada conexión tiene un luchador; el cliente manda intenciones
//   { tipo: 'combate', que, … } y el servidor lleva los tiempos y resuelve golpes y flechas con el autor de la
//   conexión. A todos: { tipo: 'combate', eventos } en el mismo orden, y cada tic (50 ms) { tipo: 'luchadores',
//   t, lista } con los que han cambiado (también el propio). Una intención que no se puede: { tipo:
//   'combate_rechazo', que, motivo }. La bienvenida lleva tc (reloj del combate, ms), luchadores y ahora (su reloj, ms: la hora del cielo, src/logica/cielo.js). Lo que
//   resuelve el combate (golpes, disparos, impactos) se guarda aparte, en combate.jsonl junto al mundo.
//   Lo que le protege es la ropa que lleva puesta en su inventario del servidor (al entrar y cada vez que cambia).
//
//   Lo que lleva cada uno y lo del suelo (src/logica/objetos_red.js): el cliente manda { tipo: 'objeto', id, accion:
//   { tipo: 'mover'|'ponerse'|'quitarse'|'soltar_suelo'|'coger_suelo'|'talar'|'trocear'|'recoger'|'coger'|'soltar'|
//   'colocar_estacion'|'fabricar'|'recoger_fabricado', … } };
//   el servidor la hace con el autor de la conexión, su hora y el sitio donde lo tiene (su presencia), y contesta
//   { tipo: 'resultado_objeto', id, ok, motivo?, datos? } (datos: lo que ha pasado, p. ej. si el árbol cae y hacia dónde).
//   Al autor le manda lo que lleva tal como queda, { tipo: 'inventario', inventario } (también si sale mal: así el
//   navegador deshace lo que había adelantado), y si cambia el suelo, a todos { tipo: 'suelo', objetos }. Si cae un
//   árbol, a todos { tipo: 'tala', estado, cae: { arbol, dir, autor, caida } }, y al limpiarlo (antes que el suelo) { tipo: 'tala',
//   estado, limpio: { arbol, autor, objetos } } (y a punto de caer,
//   { tipo: 'crujido', arbol, autor }; a quien le cae encima, la herida como evento de combate { tipo: 'arbol', … }); si se recoge algo, { tipo: 'recoleccion',
//   estado }. La bienvenida lleva todo eso (inventario, suelo, tala, recoleccion).
//   Por trozos (src/logica/trozos_red.js): lo del suelo, lo talado y lo recogido llega solo de los trozos que cada uno
//   tiene alrededor (la bienvenida, los de donde aparece). Al cambiar de trozo le llega { tipo: 'trozos', entran,
//   tala, recoleccion, suelo, estaciones } (lo talado y lo recogido de los trozos que le entran, y el suelo y las
//   estaciones de fabricar de todos los suyos).
//   Fabricar (src/logica/fabricacion.js, por la misma vía de 'objeto'): la obra de los puestos (colocar_estacion,
//   entregar_estacion, trabajar_estacion, quitar_estacion), fabricar y recoger_fabricado.
//   Lo gastado sale de lo que lleva el autor y del suelo de al lado de donde el servidor lo tiene; lo hecho va a lo que
//   lleva, o al suelo a sus pies si no cabe. Si se coloca una estación, a todos { tipo: 'estaciones', estaciones } (las
//   de sus trozos; sin las colas: lo encargado es de cada uno). La bienvenida lleva estaciones y encargos (lo suyo).
//   Las obras, la decoración y lo alisado (src/logica/obras_red.js): la bienvenida lleva obras (la foto del mundo de
//   construcción con solo lo de sus trozos) en vez de todas las entradas, y al cambiar de trozo le llega { tipo: 'obras',
//   obras } con la de sus trozos nuevos (también si la pide, { tipo: 'obras' }: el navegador lo hace si una acción que le
//   llega no le sale igual). { tipo: 'accion', entrada, antes } va solo a quien tiene su trozo (y al autor); las de todo
//   el mundo (mojón, arcón), a todos. «antes»: el contador de ids, el arcón y el mojón justo antes de hacerla.
//   'tala' y 'recoleccion' llevan solo lo de su trozo y solo a quien lo tiene; 'suelo', lo de los trozos de cada uno.
//   El navegador junta lo que le llega de lo talado y lo recogido con lo que ya tenía. 'coger' y 'soltar' son el arcón de
//   pruebas (arconPruebas: solo en las pruebas automáticas; el servidor de verdad no lo tiene, valravnx 1 nov: «fuera el arcón
//   infinito»; la bienvenida dice { arcon: true | false }). Se guarda entero en objetos.json junto al mundo, y cada acción (bien o mal)
//   en objetos.jsonl. objetos.json no se reescribe en cada acción (cada hachazo, 12 nov): se apunta que ha cambiado y se
//   escribe como mucho una vez cada guardarCada ms (1 s; KINHOLD_GUARDAR_CADA), sin parar el servidor mientras se escribe;
//   al cerrar (y al apagarlo con SIGTERM o SIGINT), lo que falte, de golpe.
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
//   Recuperar y cambiar (valravnx, 2 nov): { que: 'recuperar', quien } (usuario o correo) manda un código al correo
//   confirmado de esa cuenta (la respuesta es la misma si no existe); { que: 'restablecer', quien, codigo, clave } pone la
//   contraseña nueva, deja sin valer todas las fichas de ese personaje (cierra sus conexiones, 4002) y da una ficha para
//   este aparato. Desde el menú: { que: 'cambiar_clave', actual, clave } (lo mismo, pidiendo la actual) y
//   { que: 'cambiar_correo', actual, correo } (manda el código al correo nuevo; con { que: 'verificar', codigo } se
//   cambia). Cada cambio avisa por correo (el de la contraseña, al correo de la cuenta; el del correo, al de antes).
//   Panel de depuración del admin (src/logica/admin.js): { tipo: 'admin', id, que: 'ver' | 'ir' | 'traer' | 'modo' | 'invocar', … }
//   (modo: autoconstruir y velocidad, de esta conexión; invocar: el arcón de admin). Solo para la
//   conexión cuya cuenta tiene confirmado uno de los correos de admin (adminCorreo, o la variable KINHOLD_ADMIN_CORREO;
//   sin ella, nadie; servidor/nube/LEEME.md). El nombre de usuario no cuenta. Sin clave aparte. La bienvenida dice
//   { admin: true } a esa conexión, y la respuesta al confirmar el correo también. Cada petición, bien o mal, va a admin.jsonl junto al mundo con su autor.
//
//   La tierra vuelve al rey si no se usa (valravnx, 4 nov; src/logica/abandono.js): el servidor apunta cuándo está cada uno
//   en el mundo (abandono.json) y cada revisarCada ms repasa las tierras: avisa por correo una semana antes y el último día,
//   y pasado el plazo (30 días sin entrar el dueño ni sus invitados; 15 sin ninguna obra terminada) hace la acción
//   { autor: 'rey', tipo: 'tierra_al_rey', dueno }, que va al mundo y a todos. Lo construido se queda como ruina. Cada
//   aviso y cada tierra devuelta, en tierras.jsonl junto al mundo. Un jugador no puede hacer esa acción (su autor no es el rey).
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
import { appendFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { PresenciaServidor, CADA } from '../src/logica/presencia.js';
import { llevadoDe, huellaLlevado } from '../src/logica/llevado.js';
import { LIMITES } from '../src/logica/limites.js';
import { correosAdmin } from '../src/logica/admin.js';
import { FICHA_VIDA } from '../src/logica/fichas.js';
import * as claves from './claves.mjs';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { VistaTrozos } from '../src/logica/trozos_red.js';
import { ponerZonas } from '../src/logica/construccion.js';
import { LimitadorCharla } from '../src/logica/charla.js';
import { DURA_CUERPO } from '../src/logica/muerte.js';
import { USO_ROPA_MS } from '../src/logica/desgaste.js';
import { cargarMundo, guardarEstadoMundo, trozo, GUARDAR_CADA } from './guardado.mjs';
// cada sistema del servidor, en su módulo (12 nov: antes, todo dentro de crearServidor); comparten S, el estado del servidor
import { instalarCuentas } from './sistemas/cuentas.mjs';
import { instalarObjetos } from './sistemas/objetos.mjs';
import { instalarPosiciones } from './sistemas/posiciones.mjs';
import { instalarNecesidades, arrancarNecesidades } from './sistemas/necesidades.mjs';
import { instalarCombate, arrancarCombate } from './sistemas/combate.mjs';
import { instalarMuerte } from './sistemas/muerte.mjs';
import { instalarFauna, arrancarFauna } from './sistemas/fauna.mjs';
import { instalarTierras, arrancarTierras } from './sistemas/tierras.mjs';
import { instalarRendimiento } from './sistemas/rendimiento.mjs';
import { instalarConexiones, arrancarPresencia, arrancarLatido } from './sistemas/conexion.mjs';
export { leerArchivo, cargarMundo, guardarEstadoMundo } from './guardado.mjs';

export const GRACIA = 120000;   // ms que se guarda el luchador de quien se ha cortado (decisión provisional)
export const LATIDO = 10000;    // ms entre pings
export const REVISAR_TIERRAS = 10 * 60 * 1000;   // ms entre repasos de las tierras sin usar (src/logica/abandono.js)

// El servidor: un estado S que comparten los sistemas (servidor/sistemas/*.mjs). Cada uno pone en S lo suyo al
// instalarse (instalarX) y lo usa de los demás por S cuando lo necesita; sus tics (arrancarX) empiezan después, en el
// mismo orden de siempre.
export function crearServidor({ puerto = 8080, archivo = 'servidor/mundo.jsonl', registrar = () => {}, tico = CADA, ticoCombate = 50, semilla = Date.now(),
  gracia = GRACIA, latido = LATIDO, limites = LIMITES, arconPruebas = false, horaCampos = false, adminCorreo = process.env.KINHOLD_ADMIN_CORREO, terreno = null,
  tierras = terreno && terreno.tierras, parametrosClave = claves.PARAMETROS, vidaFicha = FICHA_VIDA, altas = {}, cartero = null, limiteMovimiento = true,
  salidaComun = false, guardarCada = GUARDAR_CADA, revisarCada = REVISAR_TIERRAS, ticoNecesidades = 1000, usoRopa = USO_ROPA_MS, horaMundo = () => Date.now(), tiemposDormido = {}, tiemposMuerte = {}, duraCuerpo = DURA_CUERPO, sedInicial = 0,
  fauna: entornoFauna = terreno && terreno.fauna, ticoFauna = 200 } = {}) {
  archivo = resolve(archivo);
  // tu tierra es la zona entera de tu mojón (src/logica/construccion.js): antes de rehacer el mundo del archivo
  ponerZonas(terreno && terreno.zona, terreno && terreno.esZonaRey);   // y las zonas del rey no se reclaman
  const junto = (nombre) => resolve(dirname(archivo), nombre);
  const S = { puerto, archivo, registrar, tico, ticoCombate, semilla, gracia, latido, limites, arconPruebas, horaCampos, terreno, tierras, parametrosClave, vidaFicha, altas, cartero,
    limiteMovimiento, salidaComun, guardarCada, revisarCada, ticoNecesidades, usoRopa, horaMundo, tiemposDormido, tiemposMuerte, duraCuerpo, sedInicial, entornoFauna, ticoFauna,
    archivoCombate: junto('combate.jsonl'),
    archivoFichas: junto('fichas.jsonl'),
    archivoObjetos: junto('objetos.json'),
    archivoObjetosReg: junto('objetos.jsonl'),
    archivoPosiciones: junto('posiciones.json'),
    archivoNecesidades: junto('necesidades.json'),
    archivoSalidas: junto('salidas.json'),   // la salida que eligió cada uno (a ella vuelve al morir sin cama)
    archivoAdmin: junto('admin.jsonl'),
    // la medida de rendimiento de cada aparato, que se manda con un botón (servidor/sistemas/rendimiento.mjs)
    archivoRendimiento: junto('rendimiento.jsonl'),
    // lo que se dice en el chat de texto: quién, qué y dónde (para moderar: la cuenta de admin lo puede revisar)
    archivoCharla: junto('charla.jsonl'),
    charla: new LimitadorCharla(),
    archivoCuentas: junto('cuentas.jsonl'),
    // el registro de seguridad: altas, entradas, fallos y salidas en todos los aparatos (nunca la contraseña ni la ficha)
    archivoSeguridad: junto('seguridad.jsonl'),
    // la tierra que vuelve al rey si no se usa (src/logica/abandono.js): cuándo entró cada uno por última vez y los avisos
    // mandados, en abandono.json; cada aviso y cada tierra devuelta, en tierras.jsonl (la acción, también en el mundo)
    archivoAbandono: junto('abandono.json'),
    archivoTierras: junto('tierras.jsonl'),
    presencia: null,   // (dónde está cada autor; se crea más abajo, y los sistemas la miran por S)
  };
  // los correos de admin (el admin, por la cuenta y su correo confirmado: valravnx, 2 nov); sin ellos, nadie es admin
  S.admins = correosAdmin(adminCorreo);
  if (!S.admins.size) registrar('sin KINHOLD_ADMIN_CORREO: nadie es admin (servidor/nube/LEEME.md)');
  mkdirSync(dirname(archivo), { recursive: true });
  // el mundo: desde su estado guardado (mundo_estado.json) y lo que vino después, o desde el registro entero (cargarMundo)
  const archivoEstado = junto('mundo_estado.json');
  const cargado = cargarMundo(archivo, archivoEstado, registrar);
  const mundo = S.mundo = cargado.mundo;
  const registro = S.registro = new RegistroAcciones();
  registro.total = cargado.total;
  // si quedó una línea a medias, lo nuevo empieza en una línea aparte (mirando solo el último byte)
  if (existsSync(archivo)) { const tam = statSync(archivo).size; if (tam && trozo(archivo, tam - 1, tam)[0] !== 10) appendFileSync(archivo, '\n'); }
  // y se guarda el estado entero una vez: el próximo arranque sigue desde aquí
  guardarEstadoMundo(archivo, archivoEstado, mundo, registro.total, registrar);
  registrar(`mundo: ${cargado.reproducidas} acciones reproducidas${cargado.compactado ? ' desde mundo_estado.json' : ' desde el registro entero'}`);

  // las cuentas (fichas, cuentas, correo, admin, seguridad), lo que lleva cada uno, dónde está y sus necesidades
  instalarCuentas(S);
  instalarObjetos(S);
  instalarPosiciones(S);
  instalarNecesidades(S);

  const wss = S.wss = new WebSocketServer({ port: puerto, maxPayload: limites.maxMensaje });
  wss.on('error', (e) => registrar(`error del servidor: ${e && e.message}`));
  const clientes = S.clientes = new Map();   // ws → autor
  S.conexionDe = new Map(); // autor → ws (la que vale)
  S.apartados = new Map();  // autor → { L, hasta }: luchadores de los que se han cortado
  const aspectos = S.aspectos = new Map();   // autor → { sexo, capas, aspecto }
  const vista = S.vista = new VistaTrozos(); // autor → los trozos que tiene alrededor (lo que se le ha mandado)
  const enviar = S.enviar = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  // el suelo de los trozos de cada uno, a todos
  S.repartirSuelo = (ahora) => { for (const [ws, a] of clientes) enviar(ws, { tipo: 'suelo', objetos: S.objetos.sueloVisible(ahora, vista.trozosDe(a)) }); };
  S.repartirEstaciones = () => { for (const [ws, a] of clientes) enviar(ws, { tipo: 'estaciones', estaciones: S.objetos.estacionesVisibles(vista.trozosDe(a)) }); };
  // Si ha cambiado lo que se ve que lleva (al coger, soltar, ponerse algo…), se vuelve a repartir su aspecto.
  S.repartirLlevado = (autor) => {
    S.vestirLuchador(autor);
    const e = aspectos.get(autor); if (!e) return;
    const l = llevadoDe(S.objetos.invs.de(autor).lugares);
    if (huellaLlevado(l) === huellaLlevado(e.llevado)) return;
    e.llevado = l;
    for (const [otro, a] of clientes) if (a !== autor) enviar(otro, { tipo: 'aspecto', autor, ...e });
  };
  S.reloj = () => Math.round(performance.now());   // hora del servidor (ms), la que llevan los estados

  // el combate, dormir desconectado y morir, las liebres y la tierra que vuelve al rey
  instalarCombate(S);
  instalarMuerte(S);
  instalarFauna(S);
  instalarTierras(S);
  instalarRendimiento(S);
  // los tics, en el orden de siempre: combate, presencia, liebres, necesidades, latido y tierras
  const ticCombate = arrancarCombate(S);
  S.presencia = new PresenciaServidor({ limitar: limiteMovimiento });   // false: solo pruebas que colocan de golpe
  const tic = arrancarPresencia(S);
  const ticFauna = arrancarFauna(S);
  const ticNecesidades = arrancarNecesidades(S);
  const ticLatido = arrancarLatido(S);
  const ticTierras = arrancarTierras(S);
  // y cada conexión que llega
  instalarConexiones(S);

  return {
    wss, mundo, terreno, fauna: S.fauna, abandono: S.abandono, cuerpos: S.cuerpos, morir: S.morir, salidas: S.salidas, archivoSalidas: S.archivoSalidas, revisarTierras: S.revisarTierras,
    dormidos: S.dormidos, revisarDormidos: S.revisarDormidos, ultimaPelea: S.ultimaPelea, archivoAbandono: S.archivoAbandono, archivoTierras: S.archivoTierras, vista, archivo,
    archivoAdmin: S.archivoAdmin, archivoRendimiento: S.archivoRendimiento, archivoCuentas: S.archivoCuentas, archivoSeguridad: S.archivoSeguridad, cuentas: S.cuentas, fichas: S.fichas, verificaciones: S.verificaciones,
    cartero: S.cartero, archivoCombate: S.archivoCombate, archivoFichas: S.archivoFichas, archivoPosiciones: S.archivoPosiciones, posiciones: S.posiciones,
    archivoNecesidades: S.archivoNecesidades, necesidades: S.necesidades, archivoObjetos: S.archivoObjetos, archivoObjetosReg: S.archivoObjetosReg, objetos: S.objetos,
    presencia: S.presencia, combate: S.combate, apartados: S.apartados, clientes,
    listo: new Promise(r => wss.on('listening', () => r(wss.address().port))),
    guardarObjetosYa: S.guardarObjetosYa, escriturasObjetos: S.escriturasObjetos,
    cerrar: () => S.guardarObjetosYa().catch(e => registrar(`no se pudo guardar objetos.json al cerrar: ${e && e.message}`)).then(() => new Promise(r => { clearInterval(tic); clearInterval(ticNecesidades); clearInterval(ticCombate); clearInterval(ticLatido); if (ticTierras) clearInterval(ticTierras); if (ticFauna) clearInterval(ticFauna); for (const ws of clientes.keys()) ws.terminate(); wss.close(() => r()); })),
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
  // KINHOLD_PRUEBAS_MOVIMIENTO=libre: sin el límite de velocidad, solo para la prueba del panel del admin (su jugador
  // simulado aparece de golpe a 1,7 km de la salida). Nunca en el servidor de verdad: también lo dice al arrancar.
  const movimientoLibre = process.env.KINHOLD_PRUEBAS_MOVIMIENTO === 'libre';
  // KINHOLD_PRUEBAS_ARCON=si: con el arcón de materiales infinito, solo para las pruebas de navegador que lo usan.
  // Nunca en el servidor de verdad (valravnx, 1 nov: «fuera el arcón infinito»): también lo dice al arrancar.
  const arconPruebas = process.env.KINHOLD_PRUEBAS_ARCON === 'si';
  // KINHOLD_PRUEBAS_SALIDA=comun: los nuevos empiezan en la salida común sin elegir, solo para las pruebas de navegador
  // que buscan lo de alrededor de ella. Nunca en el servidor de verdad (ahí cada personaje nuevo elige su salida).
  const salidaComun = process.env.KINHOLD_PRUEBAS_SALIDA === 'comun';
  // KINHOLD_PRUEBAS_MUERTE=rapida: los nuevos llegan con la sed al máximo y se mueren de sed en 3 s (y el cuerpo se va a los
  // 45 s), solo para la prueba de navegador de morir. Nunca en el servidor de verdad.
  const muerteRapida = process.env.KINHOLD_PRUEBAS_MUERTE === 'rapida';
  // KINHOLD_PRUEBAS_HORA=campos: en sembrar, el servidor se queda la hora que manda el navegador si es pasada (lo sembrado
  // «hace una semana», ya maduro), solo para la prueba de navegador de cosechar (P11). Nunca en el servidor de verdad.
  const horaCampos = process.env.KINHOLD_PRUEBAS_HORA === 'campos';
  // KINHOLD_PRUEBAS_TIEMPO=seco|lluvia: el tiempo del mundo fijo (src/logica/tiempo.js), para probar el riego (P11b)
  if (process.env.KINHOLD_PRUEBAS_TIEMPO === 'seco' || process.env.KINHOLD_PRUEBAS_TIEMPO === 'lluvia') globalThis.__tiempo = process.env.KINHOLD_PRUEBAS_TIEMPO;
  // KINHOLD_GUARDAR_CADA: cada cuánto, como mucho, se reescribe objetos.json (ms; por defecto 1000)
  const g = process.env.KINHOLD_GUARDAR_CADA, guardarCada = g && Number(g) >= 0 ? Number(g) : GUARDAR_CADA;
  const s = crearServidor({ puerto, archivo, terreno, guardarCada, registrar: t => console.log(new Date().toISOString(), t), altas: altasLibres ? { origen: 1e6, total: 1e6, espera: 0 } : {}, limiteMovimiento: !movimientoLibre, arconPruebas, horaCampos, salidaComun, ...(muerteRapida ? { sedInicial: 100, tiemposMuerte: { sed: 3, hambre: 6 }, duraCuerpo: 45000 } : {}) });
  // al apagarlo (actualizar.sh, Ctrl+C, las pruebas al terminar): lo que falte de objetos.json, antes de salir
  let apagando = false;
  const apagar = (senal) => { if (apagando) return; apagando = true; s.guardarObjetosYa().catch(e => console.error('no se pudo guardar objetos.json al apagar:', e && e.message)).finally(() => process.exit(senal === 'SIGINT' ? 130 : 143)); };
  process.on('SIGTERM', () => apagar('SIGTERM')); process.on('SIGINT', () => apagar('SIGINT'));
  s.listo.then(p => console.log(`Servidor de Kinhold en el puerto ${p} · mundo en ${s.archivo} · ${s.mundo.construcciones.length} construcciones · Whitholm generado en ${ms} ms · correo: ${s.cartero.conClave ? 'Resend' : 'sin clave de Resend, los códigos van al registro'}${altasLibres ? ' · AVISO: altas sin límite (KINHOLD_PRUEBAS_ALTAS=libres), solo para pruebas' : ''}${movimientoLibre ? ' · AVISO: sin límite de velocidad (KINHOLD_PRUEBAS_MOVIMIENTO=libre), solo para pruebas' : ''}${arconPruebas ? ' · AVISO: con el arcón infinito (KINHOLD_PRUEBAS_ARCON=si), solo para pruebas' : ''}${salidaComun ? ' · AVISO: los nuevos en la salida común sin elegir (KINHOLD_PRUEBAS_SALIDA=comun), solo para pruebas' : ''}${muerteRapida ? ' · AVISO: muerte rápida de sed (KINHOLD_PRUEBAS_MUERTE=rapida), solo para pruebas' : ''}${horaCampos ? ' · AVISO: la hora de sembrar la pone el navegador (KINHOLD_PRUEBAS_HORA=campos), solo para pruebas' : ''}${globalThis.__tiempo ? ` · AVISO: el tiempo fijo (KINHOLD_PRUEBAS_TIEMPO=${globalThis.__tiempo}), solo para pruebas` : ''}`));
}
