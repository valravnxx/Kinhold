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
//   árbol, a todos (antes que el suelo) { tipo: 'tala', estado, cae: { arbol, dir, autor, objetos } } (y a punto de caer,
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
import { readFileSync, appendFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'fs';
import { writeFile, rename } from 'fs/promises';
import { dirname, resolve } from 'path';
import { randomUUID, createHash, randomInt } from 'crypto';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { RegistroAcciones, ejecutar, reproducir, USAN_INVENTARIO, fueraDeAlcance } from '../src/logica/acciones.js';
import { PresenciaServidor, CADA, validarAspecto, validarEstado } from '../src/logica/presencia.js';
import { llevadoDe, huellaLlevado } from '../src/logica/llevado.js';
import { PROTOCOLO } from '../src/logica/protocolo.js';
import { CombateServidor } from '../src/logica/combate_servidor.js';
import { Limitador, LIMITES } from '../src/logica/limites.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';
import { validarPeticionAdmin, sitioJunto, sitioTraido, TRAER_FUERA, listaJugadores, correosAdmin, esCorreoAdmin, NO_ADMIN, MODOS_INICIALES, GRATIS_AUTOCONSTRUIR, aplicarModo, infoServidor } from '../src/logica/admin.js';
import { Cuentas, validarPeticionCuenta, claveDeUsuario, claveDeOrigen, Contador, motivoClave } from '../src/logica/cuentas.js';
import { claveDeCorreo } from '../src/logica/correo.js';
import { Verificaciones, enmascarar, codigoValido, CODIGO_CIFRAS, RECUPERAR_ORIGEN } from '../src/logica/correo.js';
import { crearCartero } from './correo.mjs';
import { Fichas, FICHA_VIDA } from '../src/logica/fichas.js';
import * as claves from './claves.mjs';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { VistaTrozos, trozoDe, LADO_RED, RADIO_RED } from '../src/logica/trozos_red.js';
import { sitioAccion, sitioColocada, comunDe, obrasEnTrozos } from '../src/logica/obras_red.js';
import { ponerZonas } from '../src/logica/construccion.js';
import { salidaInicio, SALIDAS_INICIO } from '../src/logica/whitholm.js';
import { dejarSobra } from '../src/logica/suelo.js';
import { Abandono, AUTOR_REY } from '../src/logica/abandono.js';
import { limpiarTexto, validarFrase, FRASES, LimitadorCharla, quienOye, MOTIVO_VACIO, MOTIVO_DESPACIO } from '../src/logica/charla.js';
import { nuevas as necesidadesNuevas, validarNecesidades, avanzar as avanzarNecesidades, esfuerzo as esfuerzoNecesidad, redondear as redondearNecesidades, factorVelocidad as velocidadNecesidades, saciar as saciarNecesidad, delCombate, alientoMinimo, hayAguaCerca, TRAGO, ESPERA_TRAGO, NUTRE, comestible, frioDelSitio, nocheDe } from '../src/logica/necesidades.js';
import { puestasDe, abrigo as abrigoDe } from '../src/logica/prendas.js';
import { horaDe } from '../src/logica/cielo.js';
import { calorEn } from '../src/logica/fuego.js';
import { Dormidos, DESCONECTADO } from '../src/logica/dormidos.js';
import { Cuerpos, despojar, repartir, sitiosAlrededor, necesidadesAlVolver, reaparicion, sangrePerdida, motivoNecesidades, MOTIVOS, MUERTO, DURA_CUERPO } from '../src/logica/muerte.js';
import { RECUPERAR_SANGRE } from '../src/combate/logica.js';
import { NADO } from '../src/logica/nado.js';
import { Fauna, FaunaEnRed } from '../src/logica/fauna.js';
import { estropearInventario, estropearSuelo } from '../src/logica/comida.js';
import { armaDeMano, loQueSeLanza } from '../src/logica/arma_mano.js';
import { bajoLaCaida, golpeDeCaida } from '../src/logica/tala.js';
import { gastar, gastarCosa, gastarRopa, GASTA_AL_DAR, GASTA_AL_PARAR, GOLPE_ROPA, USO_ROPA_MS } from '../src/logica/desgaste.js';

export const GRACIA = 120000;   // ms que se guarda el luchador de quien se ha cortado (decisión provisional)
export const LATIDO = 10000;    // ms entre pings
export const REVISAR_TIERRAS = 10 * 60 * 1000;   // ms entre repasos de las tierras sin usar (src/logica/abandono.js)
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

// Cambia el guardado por el nuevo (escrito en .tmp). En Windows, si alguien tiene el archivo abierto en ese momento
// (las pruebas lo leen a menudo), cambiarlo falla con EPERM o EBUSY: se reintenta un poco y, si no, se dice y se sigue
// (se guardará la vez siguiente). Antes, el fallo cortaba la acción antes de contestar al jugador.
const ESPERA = new Int32Array(new SharedArrayBuffer(4));
// Lo mismo sin bloquear (para objetos.json, que se guarda a menudo): si falla, se dice y se guardará la vez siguiente.
async function reemplazarSinEsperar(tmp, dest, registrar = console.error) {
  for (let i = 0; ; i++) {
    try { await rename(tmp, dest); return true; } catch (e) {
      if (i >= 25 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { registrar(`no se ha podido guardar ${dest} (${e.code}); se guardará la próxima vez`); return false; }
      await new Promise(r => setTimeout(r, 8));
    }
  }
}
// Cada cuánto, como mucho, se reescribe objetos.json (ms)
const GUARDAR_CADA = 1000;
function reemplazar(tmp, dest, registrar = console.error) {
  for (let i = 0; ; i++) {
    try { renameSync(tmp, dest); return true; } catch (e) {
      if (i >= 25 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { registrar(`no se ha podido guardar ${dest} (${e.code}); se guardará la próxima vez`); return false; }
      Atomics.wait(ESPERA, 0, 0, 8);
    }
  }
}
export function crearServidor({ puerto = 8080, archivo = 'servidor/mundo.jsonl', registrar = () => {}, tico = CADA, ticoCombate = 50, semilla = Date.now(),
  gracia = GRACIA, latido = LATIDO, limites = LIMITES, arconPruebas = false, adminCorreo = process.env.KINHOLD_ADMIN_CORREO, terreno = null,
  tierras = terreno && terreno.tierras, parametrosClave = claves.PARAMETROS, vidaFicha = FICHA_VIDA, altas = {}, cartero = null, limiteMovimiento = true,
  salidaComun = false, guardarCada = GUARDAR_CADA, revisarCada = REVISAR_TIERRAS, ticoNecesidades = 1000, usoRopa = USO_ROPA_MS, horaMundo = () => Date.now(), tiemposDormido = {}, tiemposMuerte = {}, duraCuerpo = DURA_CUERPO, sedInicial = 0,
  fauna: entornoFauna = terreno && terreno.fauna, ticoFauna = 200 } = {}) {
  archivo = resolve(archivo);
  // tu tierra es la zona entera de tu mojón (src/logica/construccion.js): antes de rehacer el mundo del archivo
  ponerZonas(terreno && terreno.zona, terreno && terreno.esZonaRey);   // y las zonas del rey no se reclaman
  const archivoCombate = resolve(dirname(archivo), 'combate.jsonl');
  const archivoFichas = resolve(dirname(archivo), 'fichas.jsonl');
  const archivoObjetos = resolve(dirname(archivo), 'objetos.json');
  const archivoObjetosReg = resolve(dirname(archivo), 'objetos.jsonl');
  const archivoPosiciones = resolve(dirname(archivo), 'posiciones.json');
  const archivoNecesidades = resolve(dirname(archivo), 'necesidades.json');
  const archivoSalidas = resolve(dirname(archivo), 'salidas.json');   // la salida que eligió cada uno (a ella vuelve al morir sin cama)
  const archivoAdmin = resolve(dirname(archivo), 'admin.jsonl');
  // lo que se dice en el chat de texto: quién, qué y dónde (para moderar: la cuenta de admin lo puede revisar)
  const archivoCharla = resolve(dirname(archivo), 'charla.jsonl');
  const charla = new LimitadorCharla();
  const archivoCuentas = resolve(dirname(archivo), 'cuentas.jsonl');
  // el registro de seguridad: altas, entradas, fallos y salidas en todos los aparatos (nunca la contraseña ni la ficha)
  const archivoSeguridad = resolve(dirname(archivo), 'seguridad.jsonl');
  // la tierra que vuelve al rey si no se usa (src/logica/abandono.js): cuándo entró cada uno por última vez y los avisos
  // mandados, en abandono.json; cada aviso y cada tierra devuelta, en tierras.jsonl (la acción, también en el mundo)
  const archivoAbandono = resolve(dirname(archivo), 'abandono.json');
  const archivoTierras = resolve(dirname(archivo), 'tierras.jsonl');
  // los recortes del movimiento (quien se salta metros que no puede andar): al registro de seguridad, como mucho uno
  // por jugador cada 10 s con lo que se ha recortado entre medias (un tramposo manda 10 estados por segundo)
  const recortes = new Map();   // autor → { desde, n, metros }
  const anotarRecorte = (autor, metros) => {
    const r = recortes.get(autor) || { desde: -Infinity, n: 0, metros: 0 };
    r.n++; r.metros += metros; recortes.set(autor, r);
    if (Date.now() - r.desde < 10000) return;
    seguridad({ que: 'movimiento_recortado', autor, cuenta: usuarioDe(autor), veces: r.n, metros: Math.round(r.metros * 10) / 10 });
    r.desde = Date.now(); r.n = 0; r.metros = 0;
  };
  const seguridad = (e) => { try { appendFileSync(archivoSeguridad, JSON.stringify({ t: new Date().toISOString(), ...e }) + '\n'); } catch (x) { registrar(`no se pudo apuntar en seguridad.jsonl: ${x && x.message}`); } };
  // los correos de admin (el admin, por la cuenta y su correo confirmado: valravnx, 2 nov); sin ellos, nadie es admin
  const admins = correosAdmin(adminCorreo);
  if (!admins.size) registrar('sin KINHOLD_ADMIN_CORREO: nadie es admin (servidor/nube/LEEME.md)');
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
  let abandono = new Abandono();
  if (existsSync(archivoAbandono)) {
    try { abandono = new Abandono(JSON.parse(readFileSync(archivoAbandono, 'utf8'))); } catch (e) { registrar(`abandono.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  let abandonoCambiado = false;
  const guardarAbandono = () => {
    if (!abandonoCambiado) return;
    abandonoCambiado = false;
    writeFileSync(archivoAbandono + '.tmp', JSON.stringify(abandono.exportar())); reemplazar(archivoAbandono + '.tmp', archivoAbandono);
  };
  // está en el mundo (si su cuenta puede entrar: con el correo confirmado); se apunta con un minuto de precisión
  const apuntarVisto = (a, t = Date.now()) => {
    if (cuentas.sinConfirmar(a)) return;
    if (!(t - (abandono.vistos[a] || 0) < 60000)) { abandono.visto(a, t); abandonoCambiado = true; }
  };
  const anotarTierra = (e) => { try { appendFileSync(archivoTierras, JSON.stringify({ t: new Date().toISOString(), ...e }) + '\n'); } catch (x) { registrar(`no se pudo apuntar en tierras.jsonl: ${x && x.message}`); } };
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
  const esAdmin = (autor) => esCorreoAdmin(cuentas.correoDe(autor), admins);
  // los modos de la herramienta del admin (src/logica/admin.js): de su conexión, en memoria; se apagan al desconectarse
  const modosAdmin = new Map();
  const modosDe = (autor) => (esAdmin(autor) && modosAdmin.get(autor)) || MODOS_INICIALES;
  const arranque = Date.now();
  // recuperar la contraseña: sus códigos aparte de los del correo, y cuántas peticiones por dirección
  const recuperaciones = new Verificaciones({ azar: () => randomInt(0, 10 ** CODIGO_CIFRAS), resumir: (x) => createHash('sha256').update('rec:' + x).digest('hex') });
  const recuperarOrigen = new Contador(RECUPERAR_ORIGEN, 60 * 60 * 1000);
  // avisa por correo (si no sale, solo se apunta: el cambio ya está hecho)
  const avisarCorreo = (para, usuario, tipo, idioma, nuevo = '') => cartero.enviar({ para, usuario, tipo, idioma, nuevo })
    .then((s) => { if (!s.ok) registrar(`no ha salido el aviso (${tipo}) a «${usuario}»`); }).catch(() => registrar(`no ha salido el aviso (${tipo}) a «${usuario}»`));
  // todas las fichas de ese personaje dejan de valer y se cierran sus conexiones (menos la de `salvo`)
  const cerrarSesiones = (autor, salvo = null) => {
    const n = fichas.fuera(autor);
    appendFileSync(archivoFichas, JSON.stringify({ fuera: autor, t: Date.now() }) + '\n');
    for (const [w, a] of clientes) if (a === autor && w !== salvo) setTimeout(() => { try { w.close(4002, 'Sesión cerrada'); } catch (e) { /* ya cerrada */ } }, 100);
    return n;
  };
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
    puedeTocar: (a, x, z) => mundo.puedeTocar(x, z, a),   // las estaciones de fabricar, en tierra de otro solo si te ha invitado
    bajoTecho: (x, z) => mundo.bajoTecho(x, z),           // los puestos de trabajo: la hoguera, solo fuera
    alMuro: (x, z) => mundo.muroCercano(x, z, 0.5),       // los colgaderos, pegados a un muro
    obrasCerca: (x, z, r) => mundo.obrasCerca(x, z, r),   // con lo que puede dar un árbol al caer (src/logica/tala.js)
  });
  if (existsSync(archivoObjetos)) {
    try { objetos.importar(JSON.parse(readFileSync(archivoObjetos, 'utf8'))); } catch (e) { registrar(`objetos.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  // se escribe en uno aparte y se cambia de nombre: si el servidor se apaga a mitad, queda el anterior entero
  // (12 nov) guardarObjetos() solo apunta que hay cambios: se escribe como mucho una vez cada guardarCada ms, sin bloquear,
  // y nunca dos escrituras a la vez (si cambia mientras se escribe, se vuelve a escribir después). Así un hachazo por
  // segundo, o varios jugadores a la vez, no reescriben el archivo entero en cada acción.
  let objetosSucios = false, escribiendoObjetos = null, plazoObjetos = null, escriturasObjetos = 0;
  const escribirObjetos = () => {
    plazoObjetos = null;
    if (!objetosSucios || escribiendoObjetos) return;
    objetosSucios = false; escriturasObjetos++;
    const texto = JSON.stringify(objetos.exportar());   // lo de este momento; lo que cambie mientras se escribe, en la siguiente
    escribiendoObjetos = writeFile(archivoObjetos + '.tmp', texto).then(() => reemplazarSinEsperar(archivoObjetos + '.tmp', archivoObjetos, registrar))
      .catch(e => { objetosSucios = true; registrar(`no se pudo guardar objetos.json: ${e && e.message}`); })
      .finally(() => { escribiendoObjetos = null; if (objetosSucios && !plazoObjetos) plazoObjetos = setTimeout(escribirObjetos, guardarCada); });
  };
  const guardarObjetos = () => { objetosSucios = true; if (!plazoObjetos && !escribiendoObjetos) plazoObjetos = setTimeout(escribirObjetos, guardarCada); };
  // al cerrar o apagarse: espera a la que esté a medias y escribe lo que falte, de golpe
  const guardarObjetosYa = async () => {
    if (plazoObjetos) { clearTimeout(plazoObjetos); plazoObjetos = null; }
    if (escribiendoObjetos) await escribiendoObjetos;
    if (plazoObjetos) { clearTimeout(plazoObjetos); plazoObjetos = null; }
    if (!objetosSucios) return;
    objetosSucios = false; escriturasObjetos++;
    writeFileSync(archivoObjetos + '.tmp', JSON.stringify(objetos.exportar())); reemplazar(archivoObjetos + '.tmp', archivoObjetos, registrar);
  };

  // Volver donde lo dejaste (valravnx, 31 oct): dónde estaba cada jugador al salir (autor → { x, y, z, giro }, relativo
  // al sitio de salida, como su presencia). Se apunta al salir y, por si el servidor se apaga de golpe, en cada latido
  // con los que están conectados; se manda en la bienvenida para que el cliente ponga ahí a su jugador.
  const posiciones = new Map();
  if (existsSync(archivoPosiciones)) {
    // (con admin: la de la cuenta de admin puede estar fuera de la isla; la de los demás se comprobó al llegar)
    try { for (const [a, p] of Object.entries(JSON.parse(readFileSync(archivoPosiciones, 'utf8')))) { const e = validarEstado({ ...p, anim: 'quieto' }, { admin: true }); if (e) posiciones.set(a, { x: e.x, y: e.y, z: e.z, giro: e.giro }); } }
    catch (e) { registrar(`posiciones.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  let posicionesCambiadas = false;
  const apuntarPosicion = (a) => {
    const e = presencia && presencia.ultimo.get(a);
    if (!e) return;
    // con el mundo de verdad, quien aún no ha elegido dónde empieza no tiene posición que apuntar (elegirSalida)
    if (terreno && !posiciones.has(a)) return;
    const p = posiciones.get(a);
    if (p && p.x === e.x && p.y === e.y && p.z === e.z && p.giro === e.giro) return;
    posiciones.set(a, { x: e.x, y: e.y, z: e.z, giro: e.giro }); posicionesCambiadas = true;
  };
  const guardarPosiciones = () => {
    if (!posicionesCambiadas) return;
    posicionesCambiadas = false;
    writeFileSync(archivoPosiciones + '.tmp', JSON.stringify(Object.fromEntries(posiciones))); reemplazar(archivoPosiciones + '.tmp', archivoPosiciones);
  };
  // Las necesidades (P4; src/logica/necesidades.js): hambre, sed, frío y cansancio de cada personaje (autor → sus
  // cuatro números). Las lleva el servidor: suben con el tiempo mientras está conectado (decisión provisional: sin
  // conectar no cambian, hasta que el personaje se quede dormido en el mundo, en la tarea de desconectarse), con lo que
  // corre y carga (lo que mide el servidor, no lo que diga el navegador) y con lo que hace (sus acciones, con su
  // autor). Cada ticoNecesidades ms se avanzan y a cada uno le llegan las suyas, { tipo: 'necesidades', necesidades };
  // también en la bienvenida. Se guardan en necesidades.json en cada latido y al salir.
  const necesidades = new Map();
  if (existsSync(archivoNecesidades)) {
    try { for (const [a, n] of Object.entries(JSON.parse(readFileSync(archivoNecesidades, 'utf8')))) necesidades.set(a, validarNecesidades(n)); }
    catch (e) { registrar(`necesidades.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  let necesidadesCambiadas = false;
  const necesidadesDe = (a) => { let n = necesidades.get(a); if (!n) { n = { ...necesidadesNuevas(), sed: sedInicial }; necesidades.set(a, n); } return n; };   // (sedInicial: solo pruebas)
  const guardarNecesidades = () => {
    if (!necesidadesCambiadas) return;
    necesidadesCambiadas = false;
    writeFileSync(archivoNecesidades + '.tmp', JSON.stringify(Object.fromEntries([...necesidades].map(([a, n]) => [a, redondearNecesidades(n)])))); reemplazar(archivoNecesidades + '.tmp', archivoNecesidades);
  };
  const cansar = (a, tipo) => { necesidades.set(a, esfuerzoNecesidad(necesidadesDe(a), tipo)); necesidadesCambiadas = true; };
  // Beber del río con las manos (P4): con agua a tu lado (donde el servidor te tiene), un trago baja la sed; uno cada
  // ESPERA_TRAGO ms. Devuelve { ok, motivo, sed }.
  const ultimoTrago = new Map();
  const beber = (a, ahora) => {
    const p = presencia && presencia.ultimo.get(a);
    if (!terreno || !p || !hayAguaCerca(terreno.aguaEn, p.x, p.z)) return { ok: false, motivo: 'Aquí no hay agua: busca un río, un lago o el mar.' };
    if (ahora - (ultimoTrago.get(a) || -Infinity) < ESPERA_TRAGO) return { ok: false, motivo: 'Despacio: trago a trago.' };
    ultimoTrago.set(a, ahora);
    const n = saciarNecesidad(necesidadesDe(a), 'sed', TRAGO);
    necesidades.set(a, n); necesidadesCambiadas = true;
    return { ok: true, sed: Math.round(n.sed * 100) / 100 };
  };

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
    posiciones.set(autor, p); posicionesCambiadas = true;
    salidas.set(autor, s.id); guardarSalidas();
    registrar(`${autor} empieza en ${s.nombre}`);
    try { guardarPosiciones(); } catch (e) { registrar(`no se pudo guardar posiciones.json: ${e && e.message}`); }
    return { ok: true, posicion: p };
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
  const repartirEstaciones = () => { for (const [ws, a] of clientes) enviar(ws, { tipo: 'estaciones', estaciones: objetos.estacionesVisibles(vista.trozosDe(a)) }); };

  const enviar = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  // Si ha cambiado lo que se ve que lleva (al coger, soltar, ponerse algo…), se vuelve a repartir su aspecto.
  const repartirLlevado = (autor) => {
    vestirLuchador(autor);
    const e = aspectos.get(autor); if (!e) return;
    const l = llevadoDe(objetos.invs.de(autor).lugares);
    if (huellaLlevado(l) === huellaLlevado(e.llevado)) return;
    e.llevado = l;
    for (const [otro, a] of clientes) if (a !== autor) enviar(otro, { tipo: 'aspecto', autor, ...e });
  };
  const reloj = () => Math.round(performance.now());   // hora del servidor (ms), la que llevan los estados

  // combate: el reloj es el del servidor; antes de cada intención se avanza hasta ahora
  // Strandvang, tierras del rey: ahí no se hiere a otro jugador (tierras: en(x, z) de src/logica/tierras_rey.js)
  // el arma es lo de la mano (valravnx, 9 nov; src/logica/arma_mano.js): lo que se lanza sale de su inventario al soltar
  // (la lanza entera, una piedra de la pila; las dos caen al suelo); con el terreno, alturas sobre el suelo y liebres
  const combate = new CombateServidor({ semilla, tierras: tierras || null,
    mundo: { suelo: terreno ? (x, z) => terreno.suelo(x, z) : null, presas: () => (fauna ? fauna.todas() : []) },
    alLanzar: (autor) => {
      const inv = objetos.invs.de(autor), q = loQueSeLanza(inv.lugares);
      if (!q) return null;
      const r = inv.sacar(q.mano, q.cuanto);
      if (!r.ok) return null;
      guardarObjetos(); enviar(conexionDe.get(autor), { tipo: 'inventario', inventario: objetos.inventarioDe(autor) }); repartirLlevado(autor);
      return { tipo: r.cosa.tipo, n: r.cosa.n, gasta: q.gasta, ...(r.cosa.usado ? { usado: r.cosa.usado } : {}) };
    } });
  // Desconectarse (GDD, apartado 6; src/logica/dormidos.js): quien se va se queda dormido en el mundo, donde estaba, y los
  // demás lo ven tumbado con su símbolo de desconectado (su presencia sigue, con la animación DESCONECTADO). En su tierra
  // (o en la de quien le ha invitado), protegido enseguida, y a su cama ligada si la tiene; fuera, su luchador sigue en
  // el combate unos minutos (atacable; más si peleó en el último minuto) y luego se aparta (ya no se le puede hacer nada)
  // y, con cama, pasa a ella. Al volver con su ficha, se despierta donde duerme. Decisiones provisionales: las
  // necesidades no avanzan mientras duerme desconectado (como antes); al reiniciar el servidor no queda nadie dormido
  // a la vista (lo que se guarda es dónde estaba: posiciones.json).
  const dormidos = new Dormidos(tiemposDormido);
  const ultimaPelea = new Map();   // autor → hora (ms) de su último golpe o flecha dada o recibida
  // su presencia, tumbado y desconectado donde dice d (a los demás les llega con el tic de la presencia)
  const presenciaDormida = (autor, d) => {
    const previo = presencia.ultimo.get(autor);
    presencia.ultimo.set(autor, { autor, t: Math.max(reloj(), previo ? previo.t + 1 : 0), x: d.x, y: d.y, z: d.z, giro: d.giro, anim: DESCONECTADO });
    presencia.cambiados.add(autor);
  };
  // se acaba su tiempo atacable: fuera del combate (como al cortarse, pero se guarda mientras duerma) y, con cama, a ella
  const revisarDormidos = (ahora = Date.now()) => {
    for (const f of dormidos.revisar(ahora)) {
      ponerAlDia();
      const L = combate.apartar(f.autor);
      if (L) apartados.set(f.autor, { L, hasta: Infinity });
      if (f.cama) {
        presenciaDormida(f.autor, f.d);
        posiciones.set(f.autor, { x: f.d.x, y: f.d.y, z: f.d.z, giro: f.d.giro }); posicionesCambiadas = true;
        registrar(`${f.autor} pasa dormido a su cama`);
      }
    }
  };
  // Morir y que te saqueen (P4; GDD, apartado 6; src/logica/muerte.js). Se muere de sed y de hambre (el tic de las
  // necesidades le quita sangre a su luchador), en el combate (su luchador cae) o ahogado (lo dice su navegador, con
  // { tipo: 'morir', motivo: 'ahogado' }, y el servidor mira que esté en el agua honda). Mueras como mueras: tu cuerpo
  // queda donde caíste 1 hora (lo ven todos: una presencia «cuerpo:…» tumbada con tu aspecto) y la mitad de lo que
  // llevabas, al azar del servidor, cae a su alrededor (cualquiera puede cogerlo); la otra mitad se rompe. Tú vuelves
  // sano a tu cama ligada o, sin ella, a tu sitio de salida, y tu navegador lo sabe con { tipo: 'muerte', … }.
  const cuerpos = new Cuerpos(duraCuerpo);
  const salidas = new Map();   // autor → id de la salida que eligió (src/logica/whitholm.js, SALIDAS_INICIO)
  if (existsSync(archivoSalidas)) {
    try { for (const [a, id] of Object.entries(JSON.parse(readFileSync(archivoSalidas, 'utf8')))) if (salidaInicio(id)) salidas.set(a, id); }
    catch (e) { registrar(`salidas.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  function guardarSalidas() {
    try { writeFileSync(archivoSalidas + '.tmp', JSON.stringify(Object.fromEntries(salidas))); reemplazar(archivoSalidas + '.tmp', archivoSalidas); }
    catch (e) { registrar(`no se pudo guardar salidas.json: ${e && e.message}`); }
  }
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
  const reaparecido = new Map();   // autor → { x, z, t }: hasta que su navegador mande un estado de allí
  const morir = (autor, motivo, ahora = Date.now()) => {
    const p = presencia.ultimo.get(autor);
    if (!p || p.anim === MUERTO) return null;
    const conectado = conexionDe.has(autor), dormido = dormidos.de(autor);
    if (objetos.soltarAlSalir(autor, ahora)) { /* la rastra que arrastraba se queda donde estaba */ }
    // el cuerpo, con su aspecto (lo que llevaba encima no: está en el suelo)
    const cuerpo = cuerpos.dejar(autor, p, motivo, ahora);
    const asp = aspectos.get(autor) || { sexo: 'hombre', capas: [] };
    aspectos.set(cuerpo.id, { ...asp, llevado: null });
    for (const ws of clientes.keys()) enviar(ws, { tipo: 'aspecto', autor: cuerpo.id, ...aspectos.get(cuerpo.id) });
    presencia.ultimo.set(cuerpo.id, { autor: cuerpo.id, t: reloj(), x: p.x, y: p.y, z: p.z, giro: p.giro, anim: MUERTO });
    presencia.cambiados.add(cuerpo.id);
    // la mitad de lo que llevaba, al suelo alrededor; la otra mitad se rompe
    const { quedan, rotas } = repartir(despojar(objetos.invs.de(autor)), Math.random);
    sitiosAlrededor(p.x, p.z, quedan.length).forEach((q, i) => objetos.suelo.dejar(quedan[i], q.x, q.z, ahora, autor, !!mundo.tierraDe(q.x, q.z)));
    const entrada = { autor, tipo: 'morir', motivo, x: p.x, z: p.z, cuerpo: cuerpo.id, quedan: quedan.map(c => [c.tipo, c.n]), rotas: rotas.map(c => [c.tipo, c.n]), ok: true, ahora };
    try { appendFileSync(archivoObjetosReg, JSON.stringify(entrada) + '\n'); } catch (e) { registrar(`no se pudo apuntar la muerte: ${e && e.message}`); }
    // dónde vuelve: su cama ligada o su sitio de salida
    const idCama = objetos.fab.camaDe(autor), cm = idCama ? objetos.fab.estaciones[idCama] : null;
    const r = reaparicion({ cama: cm ? { x: cm.x, y: terreno ? terreno.suelo(cm.x, cm.z) : p.y, z: cm.z, giro: p.giro } : null, salida: sitioSalida(autor, p), porDefecto: { x: 0, y: 0, z: 0, giro: 0 } });
    const pos = { x: r.x, y: r.y, z: r.z, giro: r.giro || 0 };
    necesidades.set(autor, necesidadesAlVolver(necesidadesDe(autor))); necesidadesCambiadas = true;
    // sano: un luchador nuevo (con la misma arma de combate), y vestido con lo que le queda
    const L = combate.luchadores[autor];
    combate.quitar(autor);
    const N = combate.entrar(autor, { arma: L ? L.arma : undefined, x: pos.x, z: pos.z, rot: pos.giro });
    combate.pendientes.push({ tipo: 'reinicio', autor, t: combate.ms() });
    vestirLuchador(autor);
    alientoAntes.delete(autor); durmiendo.delete(autor); antesNec.delete(autor);
    posiciones.set(autor, pos); posicionesCambiadas = true;
    if (dormido) {
      // dormido en el mundo (desconectado) y muerto: duerme ya en su cama o en su salida, protegido
      Object.assign(dormido, { x: pos.x, y: pos.y, z: pos.z, giro: pos.giro, hasta: ahora, protegido: true, enCama: r.enCama });
      presenciaDormida(autor, dormido);
      const A = combate.apartar(autor); if (A) apartados.set(autor, { L: A, hasta: Infinity });
    } else if (conectado) {
      presencia.anclar(autor, pos, reloj());
      presencia.ultimo.set(autor, { autor, t: reloj(), x: pos.x, y: pos.y, z: pos.z, giro: pos.giro, anim: 'quieto' }); presencia.cambiados.add(autor);
      combate.colocar(autor, pos.x, pos.z, pos.giro);
      reaparecido.set(autor, { x: pos.x, z: pos.z, t: reloj() });
      const ws = conexionDe.get(autor);
      enviar(ws, { tipo: 'muerte', motivo, posicion: pos, enCama: r.enCama, cuerpo: { id: cuerpo.id, x: cuerpo.x, z: cuerpo.z, hasta: cuerpo.hasta } });
      enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
      enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidades.get(autor)) });
      repartirLlevado(autor);
    }
    guardarObjetos(); repartirSuelo(ahora); repartirCombate();
    try { guardarPosiciones(); } catch (e) { registrar(`no se pudo guardar posiciones.json: ${e && e.message}`); }
    registrar(`muere ${autor} (${motivo}): vuelve ${r.enCama ? 'a su cama' : 'a su salida'}; en su cuerpo quedan ${quedan.reduce((s, c) => s + c.n, 0)}, se rompen ${rotas.reduce((s, c) => s + c.n, 0)}`);
    return { cuerpo, posicion: pos, enCama: r.enCama, quedan, rotas, N };
  };
  // los que han caído en el combate (o sin sangre por la sed o el hambre): mueren
  const revisarMuertes = () => {
    for (const [a, L] of Object.entries(combate.luchadores)) if (L.fuera && (conexionDe.has(a) || dormidos.esta(a))) morir(a, L.motivoFuera || 'Desangrado');
  };
  // los cuerpos que ya llevan su hora: se van (los demás dejan de verlos)
  const revisarCuerpos = (ahora = Date.now()) => {
    for (const c of cuerpos.limpiar(ahora)) {
      presencia.quitar(c.id); aspectos.delete(c.id);
      for (const ws of clientes.keys()) enviar(ws, { tipo: 'sale', autor: c.id });
    }
  };
  // el duelo con lo que llevas (7 nov): lo que le protege es la ropa que tiene puesta en su inventario del servidor
  // y su arma, lo que lleva en la mano (valravnx, 9 nov: antes, siempre la espada larga)
  const vestirLuchador = (autor) => { const l = objetos.invs.de(autor).lugares; combate.vestir(autor, puestasDe(l)); combate.armar(autor, armaDeMano(l)); };
  const t0 = reloj();
  let muriendo = false;   // (morir no vuelve a mirar las muertes)
  const ponerAlDia = () => { combate.avanzarHasta((reloj() - t0) / 1000); if (!muriendo) { muriendo = true; try { revisarMuertes(); } finally { muriendo = false; } } };
  // La ropa y la armadura que se gastan (10 nov; src/logica/desgaste.js, gastarRopa): con los golpes que hieren y con
  // el uso. Lo que se acaba, se rompe: se le avisa, se vuelve a vestir su luchador y se reparte su aspecto.
  const gastarRopaDe = (autor, n, zona = null) => {
    const l = gastarRopa(objetos.invs.de(autor), n, zona);
    if (!l.length) return;
    guardarObjetos();
    const rotas = l.filter(g => g.roto), ws = conexionDe.get(autor);
    if (ws) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor), ...(rotas.length ? { roto: rotas[0].tipo } : {}) });
    if (rotas.length) {
      repartirLlevado(autor);
      for (const g of rotas) appendFileSync(archivoObjetosReg, JSON.stringify({ autor, tipo: 'se_rompe', objeto: g.tipo, ahora: Date.now() }) + '\n');
    }
  };
  const puestaDe = new Map();   // autor → ms que lleva la ropa puesta en el mundo desde el último uso contado
  let escritas = 0;
  const repartirCombate = () => {
    const eventos = combate.sacarEventos();
    if (eventos.length) for (const ws of clientes.keys()) enviar(ws, { tipo: 'combate', eventos });
    // lo lanzado que cae (P4, 9 nov): la lanza y la piedra quedan en el suelo donde acaban; la liebre a la que da,
    // muerta, sale de la fauna y queda en el suelo para despiezarla
    let suelo = false;
    // herramientas y armas que se gastan (10 nov; src/logica/desgaste.js): el golpe que alcanza gasta el arma de quien lo
    // da, y el que se para, también la de quien lo para; la lanza lanzada, al dar a una presa. Al acabarse, se rompe.
    const gastarArma = (autor) => {
      const inv = objetos.invs.de(autor), m = armaDeMano(inv.lugares).mano, g = m ? gastar(inv, m) : null;
      if (!g) return;
      guardarObjetos();
      const ws = conexionDe.get(autor);
      if (ws) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor), ...(g.roto ? { roto: g.tipo } : {}) });
      if (g.roto) { repartirLlevado(autor); appendFileSync(archivoObjetosReg, JSON.stringify({ autor, tipo: 'se_rompe', objeto: g.tipo, ahora: Date.now() }) + '\n'); }
    };
    for (const e of eventos) {
      if (e.tipo !== 'golpe' || !e.objetivo) continue;
      if (GASTA_AL_DAR.has(e.resultado)) gastarArma(e.autor);
      if (GASTA_AL_PARAR.has(e.resultado)) gastarArma(e.objetivo);
    }
    // la ropa y la armadura (10 nov): el golpe o lo lanzado que hiere gasta lo que cubre esa zona a quien lo recibe
    for (const e of eventos) if ((e.tipo === 'golpe' || e.tipo === 'flecha' || e.tipo === 'arbol') && e.objetivo && e.zona && objetos.invs.de(e.objetivo)) gastarRopaDe(e.objetivo, GOLPE_ROPA, e.zona);
    for (const e of eventos) {
      if (e.tipo !== 'flecha') continue;
      const ahora = Date.now(), enT = (x, z) => !!mundo.tierraDe(x, z);
      const lanzado = e.objeto && !e.objeto.gasta ? { tipo: e.objeto.tipo, n: e.objeto.n, ...(e.objeto.usado ? { usado: e.objeto.usado } : {}) } : null;
      const roto = lanzado && e.presa ? gastarCosa(lanzado) : null;   // la lanza que da a una presa se gasta
      if (roto && roto.roto) { const ws = conexionDe.get(e.autor); if (ws) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(e.autor), roto: lanzado.tipo }); appendFileSync(archivoObjetosReg, JSON.stringify({ autor: e.autor, tipo: 'se_rompe', objeto: lanzado.tipo, ahora }) + '\n'); }
      else if (lanzado) { objetos.suelo.dejar(lanzado, e.x, e.z, ahora, e.autor, enT(e.x, e.z)); suelo = true; }
      if (e.presa && fauna) {
        const l = fauna.de(e.presa);
        if (l && fauna.matar(e.presa)) { objetos.suelo.dejar({ tipo: 'liebre', n: 1 }, l.x, l.z, ahora, e.autor, enT(l.x, l.z)); suelo = true; }
        appendFileSync(archivoObjetosReg, JSON.stringify({ autor: e.autor, tipo: 'caza', presa: e.presa, arma: e.arma, ok: !!l, ahora }) + '\n');
      }
    }
    if (suelo) { guardarObjetos(); repartirSuelo(Date.now()); }
    // quién ha peleado (un golpe o una flecha dada o recibida): si se desconecta en el minuto siguiente, más tiempo atacable
    for (const e of eventos) if (e.objetivo && (e.tipo === 'golpe' || e.tipo === 'flecha')) { const t = Date.now(); ultimaPelea.set(e.autor, t); ultimaPelea.set(e.objetivo, t); }
    const nuevas = combate.registro.entradas.filter(e => e.n > escritas);
    if (nuevas.length) { appendFileSync(archivoCombate, nuevas.map(e => JSON.stringify(e)).join('\n') + '\n'); escritas = nuevas[nuevas.length - 1].n; }
  };
  // Lo que hiere un árbol al caer (tarea «Crujido de aviso y daño», 12 nov)
  const caidaHiere = (autor, id, caida) => {
    const a = objetos.sitioArbol(id); if (!a) return;
    const alt = objetos.tala.alturaEn, desde = Date.now();
    const personas = Object.entries(combate.luchadores).map(([quien, L]) => ({ autor: quien, x: L.x, z: L.z }));
    for (const b of bajoLaCaida(a, caida, personas, alt)) {
      setTimeout(() => {
        const L = combate.luchadores[b.autor]; if (!L || L.fuera) return;
        const g = golpeDeCaida(a, caida, L.x, L.z, (Date.now() - desde) / 1000 + 0.05, alt);
        if (!g) return;
        ponerAlDia(); combate.herirConArbol(autor, b.autor, g, id); repartirCombate();
      }, Math.max(0, b.t * 1000 - (Date.now() - desde))).unref?.();
    }
  };
  const ticCombate = setInterval(() => {
    ponerAlDia(); repartirCombate();
    const lista = combate.cambiados();
    if (lista.length) for (const ws of clientes.keys()) enviar(ws, { tipo: 'luchadores', t: combate.ms(), lista });
  }, ticoCombate);

  // presencia: cada tic, a cada uno los que han cambiado menos él mismo
  presencia = new PresenciaServidor({ limitar: limiteMovimiento });   // false: solo pruebas que colocan de golpe
  const tic = setInterval(() => {
    const lista = presencia.tic();
    if (!lista.length) return;
    const t = reloj();
    for (const [ws, autor] of clientes) {
      const jugadores = lista.filter(e => e.autor !== autor);
      if (jugadores.length) enviar(ws, { tipo: 'estados', t, jugadores });
    }
  }, tico);

  // Las liebres (P4, 9 nov; src/logica/fauna.js): las mueve el servidor, para que todos vean la misma. Cada ticoFauna ms
  // avanzan las de los trozos que tiene alguien cerca (huyen de quien se acerca) y a cada uno le llegan las de sus
  // trozos: { tipo: 'fauna', liebres: [{ id, x, z, giro, anim }], fuera: [id] } (enteras las que le entran; luego, solo
  // las que cambian). Sin terreno (las pruebas sin mundo), solo si la prueba da por dónde andan (fauna: { habitat, pisable }).
  const fauna = entornoFauna ? new Fauna({ ...entornoFauna, semilla: terreno ? terreno.semilla : 1 }) : null, faunaRed = new FaunaEnRed();
  const antesFauna = new Map();   // autor → { x, z, t }: para ver si viene corriendo
  const ticFauna = fauna ? setInterval(() => {
    try {
      const t = reloj(), jugadores = [], autores = [];
      for (const [ws, a] of clientes) {
        if (conexionDe.get(a) !== ws || cuentas.sinConfirmar(a) || (terreno && !posiciones.has(a))) continue;
        const e = presencia.ultimo.get(a); if (!e || e.anim === MUERTO) continue;
        const q = antesFauna.get(a), dt = q ? (t - q.t) / 1000 : 0;
        jugadores.push({ x: e.x, z: e.z, vel: dt > 0 ? Math.hypot(e.x - q.x, e.z - q.z) / dt : 0 });
        antesFauna.set(a, { x: e.x, z: e.z, t }); autores.push(a);
      }
      fauna.avanzar(ticoFauna / 1000, jugadores);
      for (const [a, m] of faunaRed.repartir(fauna, fauna.sacarCambios(), autores, (x) => vista.trozosDe(x))) enviar(conexionDe.get(a), { tipo: 'fauna', ...m });
    } catch (e) { registrar(`error en la fauna: ${e && e.message}`); }
  }, ticoFauna) : null;


  // las necesidades de los conectados: el tiempo, lo que corren (la distancia que el servidor les ha visto andar desde
  // el tic anterior) y lo que cargan suelto
  const antesNec = new Map();   // autor → { x, z, t }
  // quién duerme en su cama ligada (P4; src/logica/fabricacion.js, dormir): autor → { x, z, t } de la cama. Se despierta
  // cuando su presencia deja de decir «dormir» (pasado 1,5 s, lo que tarda en llegar), al alejarse de la cama (más de
  // 2,5 m) o al irse; mientras duerme, el cansancio baja deprisa (src/logica/necesidades.js)
  const durmiendo = new Map();
  const alientoAntes = new Map();   // autor → el aliento (cansancio) de su luchador en el tic anterior de las necesidades
  // El frío que pide el sitio de cada uno (P4, 8 nov; src/logica/necesidades.js, frioDelSitio): la temperatura de su
  // bioma (la del paisaje, guardada mientras no se aleje 20 m), la noche (la hora del cielo: horaMundo, la real; las
  // pruebas la cambian), lo que lleva puesto, si está bajo techo y el calor de los fuegos encendidos a su lado. Sin
  // terreno (las pruebas sin mundo) no hay clima: no pide frío.
  const tempDe = new Map();   // autor → { x, z, T }
  const frioPedido = (a, e, inv) => {
    if (!terreno || !e) return 0;
    let c = tempDe.get(a);
    if (!c || Math.hypot(c.x - e.x, c.z - e.z) > 20) {
      const xm = e.x + terreno.origen.x, zm = e.z + terreno.origen.z, st = terreno.paisaje.sitio(xm, zm, terreno.alt(xm, zm));
      c = { x: e.x, z: e.z, T: st && Number.isFinite(st.T) ? st.T : 10 }; tempDe.set(a, c);
    }
    const ahora = Date.now(), cerca = Object.values(objetos.fab.estaciones).filter(s => s.fuego && Math.abs(s.x - e.x) < 5 && Math.abs(s.z - e.z) < 5);
    return frioDelSitio({ T: c.T, noche: nocheDe(horaDe(horaMundo()).hora), abrigo: abrigoDe(puestasDe(inv.lugares)), techo: mundo.bajoTecho(e.x, e.z), calor: calorEn(cerca, e.x, e.z, ahora) });
  };
  const ticNecesidades = setInterval(() => {
    const t = reloj();
    for (const [ws, a] of clientes) {
      if (conexionDe.get(a) !== ws) continue;
      const e = presencia.ultimo.get(a), p = antesNec.get(a);
      const dt = p ? (t - p.t) / 1000 : 0;
      const velocidad = e && p && dt > 0 ? Math.hypot(e.x - p.x, e.z - p.z) / dt : 0;
      if (e) antesNec.set(a, { x: e.x, z: e.z, t }); else antesNec.set(a, { x: 0, z: 0, t });
      if (!(dt > 0)) continue;
      const inv = objetos.invs.de(a), d = durmiendo.get(a);
      if (d && (!e || Math.hypot(e.x - d.x, e.z - d.z) > 2.5 || (t - d.t > 1500 && e.anim !== 'dormir'))) durmiendo.delete(a);
      // sentado a descansar (8 nov): lo dice su presencia (anim «sentado») y no se mueve; descansa más deprisa que de pie
      const sentado = !!e && e.anim === 'sentado' && velocidad < 0.3;
      let n = avanzarNecesidades(necesidadesDe(a), Math.min(dt, 10), { velocidad, kilos: inv.kilosSueltos(), frioObjetivo: frioPedido(a, e, inv), durmiendo: durmiendo.has(a), sentado });
      // el combate (8 nov; src/logica/necesidades.js, delCombate y alientoMinimo): lo que ha subido el aliento de su
      // luchador desde el tic anterior cansa, y el aliento no baja de lo que pide este cansancio
      const L = combate.luchadores[a];
      if (L) {
        const antes = alientoAntes.get(a);
        if (Number.isFinite(antes) && L.cansancio > antes) n = delCombate(n, L.cansancio - antes);
        const min = alientoMinimo(n);
        L.alientoMinimo = min;   // al recuperarse en el combate, no baja de aquí (src/combate/logica.js)
        if (L.cansancio < min) L.cansancio = min;
        alientoAntes.set(a, L.cansancio);
        // con la sed o el hambre al máximo (P4; src/logica/muerte.js): pierde sangre y no la recupera; sin sangre, muere
        // (solo quien ya está en el mundo: con su presencia y, con el terreno, su salida elegida)
        const pierde = e && (!terreno || posiciones.has(a)) && !cuentas.sinConfirmar(a) ? sangrePerdida(n, tiemposMuerte) : 0;
        if (pierde > 0 && !L.fuera) {
          const sangra = L.heridas.reduce((s, h) => s + h.sangrado, 0) > 0.05;   // (si nada sangra, su luchador la recuperaría)
          L.sangre -= (pierde + (sangra ? 0 : RECUPERAR_SANGRE)) * Math.min(dt, 10);
          if (L.sangre <= 0) { L.sangre = 0; L.caer(motivoNecesidades(n)); }
        }
      }
      // la ropa puesta se gasta con el uso (10 nov): un uso cada usoRopa ms en el mundo (USO_ROPA_MS; las pruebas, menos) (solo quien ya está en él)
      if (e && (!terreno || posiciones.has(a))) {
        const p = (puestaDe.get(a) || 0) + Math.min(dt, 10) * 1000;
        if (p >= usoRopa) { puestaDe.set(a, p - usoRopa); gastarRopaDe(a, 1); } else puestaDe.set(a, p);
      }
      necesidades.set(a, n);
      necesidadesCambiadas = true;
      enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidades.get(a)) });
    }
    ponerAlDia();   // (quien se ha quedado sin sangre, muere ya)
    revisarCuerpos();
  }, ticoNecesidades);

  // latido: quien no ha contestado al ping anterior (ni mandado nada) se da por ido
  const ticLatido = setInterval(() => {
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
  }, latido);

  // La tierra que no se usa vuelve al rey (src/logica/abandono.js): cada revisarCada ms (y cuando lo pide una prueba, con
  // su hora) se repasan las tierras. Los avisos van al correo confirmado de la cuenta del dueño (sin cuenta o sin correo,
  // solo se apuntan); la tierra se devuelve con la acción del rey (autor AUTOR_REY), que va al mundo y a todos, como el
  // mojón. Todo, en tierras.jsonl.
  const revisarTierras = (ahora = Date.now()) => {
    for (const a of clientes.values()) apuntarVisto(a, ahora);
    const r = abandono.revisar(mundo, ahora);
    for (const v of r.avisar) {
      const c = cuentas.correoDe(v.dueno), quedan = Math.max(1, Math.ceil(v.quedan / 86400000));
      const conCorreo = !!(c && c.verificado && typeof c.correo === 'string');
      anotarTierra({ que: 'aviso', aviso: v.que, dueno: v.dueno, cuenta: usuarioDe(v.dueno), dias: v.dias, quedan, correo: conCorreo ? enmascarar(c.correo) : null });
      if (conCorreo) cartero.enviar({ para: c.correo, usuario: c.usuario, tipo: v.que === 'ultimo' ? 'tierra_ultimo' : 'tierra_semana', idioma: abandono.idiomas[v.dueno] || 'es', dias: quedan })
        .then((x) => { if (!x.ok) registrar(`no ha salido el aviso de la tierra a «${c.usuario}»`); }).catch(() => registrar(`no ha salido el aviso de la tierra a «${c.usuario}»`));
    }
    for (const l of r.liberar) {
      const antes = comunDe(mundo);
      const x = ejecutar(mundo, registro, { autor: AUTOR_REY, tipo: 'tierra_al_rey', dueno: l.dueno });
      const entrada = registro.entradas[registro.entradas.length - 1];
      registro.entradas.length = 0;
      appendFileSync(archivo, JSON.stringify(entrada) + '\n');
      anotarTierra({ que: 'al_rey', dueno: l.dueno, cuenta: usuarioDe(l.dueno), desde: new Date(l.desde).toISOString(), dias: l.dias, ok: !!x.ok, ...(x.ok ? { ruinas: x.ruinas } : { motivo: x.motivo }) });
      registrar(`la tierra de ${l.dueno} vuelve al rey (${l.dias} días sin entrar nadie)`);
      if (x.ok) for (const ws of clientes.keys()) enviar(ws, { tipo: 'accion', entrada, antes });
    }
    if (r.avisar.length || r.liberar.length || Object.keys(mundo.mojones).length) abandonoCambiado = true;
    try { guardarAbandono(); } catch (e) { registrar(`no se pudo guardar abandono.json: ${e && e.message}`); }
    return r;
  };
  const ticTierras = revisarCada > 0 ? setInterval(() => { try { revisarTierras(); } catch (e) { registrar(`error al repasar las tierras: ${e && e.message}`); } }, revisarCada) : null;

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
      if (['estado', 'obras', 'combate', 'aspecto', 'accion', 'objeto', 'admin', 'salida', 'decir'].includes(msg.tipo) && cuentas.sinConfirmar(autor)) {
        const id = Number.isSafeInteger(msg.id) ? msg.id : null;
        if (msg.tipo === 'accion' || msg.tipo === 'objeto') enviar(ws, { tipo: msg.tipo === 'objeto' ? 'resultado_objeto' : 'resultado', id, ok: false, motivo: SIN_CORREO });
        else if (msg.tipo === 'admin') enviar(ws, { tipo: 'admin', id, que: null, ok: false, motivo: SIN_CORREO });
        else if (msg.tipo === 'salida') enviar(ws, { tipo: 'salida', id, ok: false, motivo: SIN_CORREO });
        return;
      }
      if (msg && msg.tipo === 'salida') {
        // la salida que elige un personaje nuevo: queda apuntada como su posición, y el movimiento sin trampas cuenta
        // desde ahí (lo de alrededor le llega con el siguiente estado, al cambiar de trozo)
        const id = Number.isSafeInteger(msg.id) ? msg.id : null;
        const r = elegirSalida(autor, typeof msg.salida === 'string' ? msg.salida : '');
        if (r.ok) { presencia.anclar(autor, r.posicion, reloj()); recienLlegado.set(autor, r.posicion); }
        return enviar(ws, { tipo: 'salida', id, ...r });
      }
      if (msg && msg.tipo === 'estado') {
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
        return;
      }
      if (msg && msg.tipo === 'morir') {
        // ahogado (src/logica/nado.js: lo lleva su navegador): el servidor mira que esté en el agua honda (sin terreno, las
        // pruebas sin mundo, se fía); otros motivos no se aceptan (la sed, el hambre y el combate los ve el servidor solo)
        const p = presencia.ultimo.get(autor);
        if (msg.motivo !== 'ahogado' || !p) return enviar(ws, { tipo: 'error', motivo: 'No se puede.' });
        const hondo = terreno ? terreno.aguaEn(p.x, p.z) : Infinity;
        if (!(hondo >= NADO.hondoNadar)) return enviar(ws, { tipo: 'error', motivo: 'Aquí no te ahogas.' });
        ponerAlDia();
        morir(autor, MOTIVOS.ahogado);
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
      if (msg && msg.tipo === 'decir') {
        // el chat de texto: limpio, sin hablar a chorro, y a quien está cerca del que habla
        // (una frase rápida va por su número: a cada uno le llega en su lengua)
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
        for (const a of oyen) { const c = conexionDe.get(a); if (c) enviar(c, frase !== null ? { tipo: 'dicho', autor, frase } : { tipo: 'dicho', autor, texto }); }
        return;
      }
      if (msg && msg.tipo === 'cuenta') {
        const id = Number.isSafeInteger(msg.id) ? msg.id : null, que = ['crear', 'entrar', 'salir_todos', 'correo', 'reenviar', 'verificar', 'recuperar', 'restablecer', 'cambiar_clave', 'cambiar_correo'].includes(msg.que) ? msg.que : null;
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
        if (abandono.idiomas[autor] !== idioma && ['es', 'en', 'ru'].includes(msg.idioma)) { abandono.idiomas[autor] = idioma; abandonoCambiado = true; }
        // el correo: ponerlo o cambiarlo (sin confirmar), pedir otro código, confirmarlo
        if (que === 'correo' || que === 'reenviar' || que === 'verificar') {
          const usuario = usuarioDe(autor);
          if (!usuario) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
          if (que === 'verificar') {
            const r = verificaciones.comprobar(claveDeUsuario(usuario), typeof msg.codigo === 'string' ? msg.codigo.slice(0, 20) : '', Date.now());
            // con el correo ya confirmado, el código es el del correo nuevo (cambiar el correo desde el menú)
            const antes = cuentas.correoDe(autor);
            if (r.ok && antes.verificado) {
              const c = cuentas.cambiarCorreo(autor, r.correo, Date.now());
              seguridad({ que: 'cambiar_correo', ok: c.ok, usuario, autor, origen, ...(c.ok ? { correo: enmascarar(r.correo) } : { motivo: c.motivo }) });
              if (!c.ok) return responder({ ok: false, motivo: c.motivo });
              appendFileSync(archivoCuentas, JSON.stringify(c.linea) + '\n');
              registrar(`correo cambiado de «${usuario}»`);
              if (c.antes) avisarCorreo(c.antes, usuario, 'aviso_correo', idioma, r.correo);
              return responder({ ok: true, cambiado: true, admin: esAdmin(autor), correo: estadoCorreo(autor) });
            }
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
        // recuperar la contraseña: el código va al correo confirmado de esa cuenta (la respuesta, la misma si no existe)
        if (que === 'recuperar') {
          const MISMO = 'Si hay una cuenta con ese usuario o correo, y su correo está confirmado, le llegará un código.';
          const ahora = Date.now(), o = claveDeOrigen(origen);
          if (typeof msg.quien !== 'string' || !msg.quien.trim()) return responder({ ok: false, motivo: 'Escribe tu usuario o tu correo.' });
          if (recuperarOrigen.lleno(o, ahora)) { seguridad({ que, ok: false, autor, origen, motivo: 'demasiadas' }); return responder({ ok: false, motivo: `Demasiados intentos; prueba dentro de ${Math.max(1, Math.ceil(recuperarOrigen.falta(o, ahora) / 60000))} min.` }); }
          recuperarOrigen.sumar(o, ahora);
          const c = cuentas.buscar(msg.quien);
          if (!c || !c.verificado || typeof c.correo !== 'string') { seguridad({ que, ok: false, autor, origen, motivo: c ? 'sin correo confirmado' : 'no existe' }); return responder({ ok: true, motivo: MISMO }); }
          const r = recuperaciones.pedir(claveDeUsuario(c.usuario), c.correo, ahora);
          if (!r.ok) { seguridad({ que, ok: false, usuario: c.usuario, autor, origen, motivo: r.motivo }); return responder({ ok: true, motivo: MISMO }); }
          ws.cuentaEnCurso = true;
          cartero.enviar({ para: c.correo, usuario: c.usuario, codigo: r.codigo, idioma, tipo: 'recuperar' })
            .then((e) => {
              seguridad({ que, ok: !!e.ok, usuario: c.usuario, autor, origen, correo: enmascarar(c.correo), ...(e.ok ? {} : { motivo: e.motivo }) });
              if (!e.ok) { recuperaciones.olvidar(claveDeUsuario(c.usuario)); return responder({ ok: false, motivo: e.motivo }); }
              responder({ ok: true, motivo: MISMO });
            })
            .catch((e) => { registrar(`error al recuperar: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
            .finally(() => { ws.cuentaEnCurso = false; });
          return;
        }
        // la contraseña nueva con el código; o, desde el menú, con la actual
        if (que === 'restablecer' || que === 'cambiar_clave') {
          const ahora = Date.now();
          let c = null;
          if (que === 'restablecer') {
            const o = claveDeOrigen(origen), f = cuentas.fallosOrigen.falta(o, ahora);
            if (f > 0) return responder({ ok: false, motivo: `Demasiados intentos; prueba dentro de ${Math.max(1, Math.ceil(f / 60000))} min.` });
            c = cuentas.buscar(msg.quien);
            const mc = motivoClave(msg.clave, c ? c.usuario : msg.quien);
            if (mc) return responder({ ok: false, motivo: mc });
            const r = c ? recuperaciones.comprobar(claveDeUsuario(c.usuario), typeof msg.codigo === 'string' ? msg.codigo.slice(0, 20) : '', ahora) : { ok: false, motivo: 'El código no es correcto.' };
            if (r.ok && claveDeCorreo(r.correo) !== claveDeCorreo(c.correo || '')) r.ok = false, r.motivo = 'El correo ha cambiado; pide otro código.';
            if (!r.ok) {
              cuentas.fallosOrigen.sumar(o, ahora);
              seguridad({ que, ok: false, ...(c ? { usuario: c.usuario } : {}), autor, origen, motivo: r.motivo });
              return responder({ ok: false, motivo: c ? r.motivo : 'El código no es correcto.' });
            }
          } else {
            c = cuentas.deAutor(autor);
            if (!c) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
            const mc = motivoClave(msg.clave, c.usuario);
            if (mc) return responder({ ok: false, motivo: mc });
          }
          ws.cuentaEnCurso = true;
          (que === 'cambiar_clave' ? cuentas.comprobarClave(autor, msg.actual, origen, ahora) : Promise.resolve({ ok: true }))
            .then(async (v) => {
              if (!v.ok) { seguridad({ que, ok: false, usuario: c.usuario, autor, origen, motivo: v.motivo, ...(v.bloqueado ? { bloqueado: true } : {}) }); return responder({ ok: false, motivo: v.motivo }); }
              const r = await cuentas.cambiarClave(c.usuario, msg.clave, ahora);
              if (!r.ok) return responder({ ok: false, motivo: r.motivo });
              appendFileSync(archivoCuentas, JSON.stringify(r.linea) + '\n');
              // fuera la sesión en todos los aparatos de ese personaje; este sigue con una ficha nueva
              const n = cerrarSesiones(c.autor, ws);
              const ficha = fichaPara(c.autor);
              seguridad({ que, ok: true, usuario: c.usuario, autor, origen, fichas: n });
              registrar(`contraseña cambiada de «${c.usuario}» (${que}; ${n} fichas fuera)`);
              if (c.verificado && typeof c.correo === 'string') avisarCorreo(c.correo, c.usuario, 'aviso_clave', idioma);
              responder({ ok: true, usuario: c.usuario, autor: c.autor, ficha });
            })
            .catch((e) => { registrar(`error al cambiar la contraseña: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
            .finally(() => { ws.cuentaEnCurso = false; });
          return;
        }
        // cambiar el correo desde el menú (con el de ahora confirmado): pide la contraseña y manda el código al nuevo
        if (que === 'cambiar_correo') {
          const c = cuentas.deAutor(autor);
          if (!c) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
          if (!c.verificado) return responder({ ok: false, motivo: 'Confirma primero el correo de tu cuenta.' });
          const nuevo = typeof msg.correo === 'string' ? msg.correo.trim().normalize('NFC') : null;
          const m = cuentas.motivoCorreoNuevo(autor, nuevo);
          if (m) return responder({ ok: false, motivo: m });
          const ahora = Date.now(), k = claveDeUsuario(c.usuario);
          ws.cuentaEnCurso = true;
          cuentas.comprobarClave(autor, msg.actual, origen, ahora)
            .then(async (v) => {
              if (!v.ok) { seguridad({ que, ok: false, usuario: c.usuario, autor, origen, motivo: v.motivo }); return responder({ ok: false, motivo: v.motivo }); }
              const r = verificaciones.pedir(k, nuevo, ahora);
              if (!r.ok) return responder({ ok: false, motivo: r.motivo });
              const e = await cartero.enviar({ para: nuevo, usuario: c.usuario, codigo: r.codigo, idioma });
              seguridad({ que: 'codigo', ok: !!e.ok, usuario: c.usuario, autor, origen, correo: enmascarar(nuevo), para: 'cambiar_correo' });
              if (!e.ok) { verificaciones.olvidar(k); return responder({ ok: false, motivo: e.motivo }); }
              responder({ ok: true, pendiente: enmascarar(nuevo) });
            })
            .catch((e) => { registrar(`error al cambiar el correo: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
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
      if (msg && msg.tipo === 'objeto') {
        if (!msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion)) return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
        // el autor lo pone el servidor, y la hora también
        const ahora = Date.now();
        // comer (P4): una unidad de lo que llevas (src/logica/necesidades.js, NUTRE), de tu inventario, por el servidor
        if (msg.accion.tipo === 'comer') {
          const tipo = msg.accion.objeto, inv = objetos.invs.de(autor);
          let r;
          if (typeof tipo !== 'string' || !comestible(tipo)) r = { ok: false, motivo: 'Eso no se come.' };
          else r = inv.gastar(tipo, 1);
          if (r.ok) { necesidades.set(autor, saciarNecesidad(necesidadesDe(autor), 'hambre', NUTRE[tipo])); necesidadesCambiadas = true; guardarObjetos(); }
          else if (r.motivo === 'No llevas tanto.') r.motivo = 'No llevas nada de eso.';
          enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: r.ok, ...(r.ok ? { datos: { hambre: Math.round(necesidadesDe(autor).hambre * 100) / 100 } } : { motivo: r.motivo }) });
          enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
          if (r.ok) { enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidadesDe(autor)) }); repartirLlevado(autor); }
          return;
        }
        // beber del río (P4): lo llevan las necesidades, no los objetos
        if (msg.accion.tipo === 'beber') {
          const r = beber(autor, ahora);
          enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: r.ok, ...(r.ok ? { datos: { sed: r.sed } } : { motivo: r.motivo }) });
          if (r.ok) enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidadesDe(autor)) });
          return;
        }
        const r = objetos.ejecutar(Object.assign({}, msg.accion, { autor }), ahora);
        if (r.entrada) appendFileSync(archivoObjetosReg, JSON.stringify(r.entrada) + '\n');
        if (r.ok) guardarObjetos();
        const { ok: _o, motivo: _m, entrada: _e, suelo: _s, estaciones: _es, ...datos } = r;
        enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: !!r.ok, ...(r.ok ? { datos } : { motivo: r.motivo }) });
        enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
        if (r.ok) repartirLlevado(autor);
        if (r.ok) cansar(autor, msg.accion.tipo);   // talar, trocear, fabricar y recoger cansan (src/logica/necesidades.js)
        // dormir en la cama ligada: hasta que se mueva de donde se tumbó (el tic de las necesidades)
        if (r.ok && msg.accion.tipo === 'dormir') { const c = objetos.fab.estaciones[msg.accion.estacion]; if (c) durmiendo.set(autor, { x: c.x, z: c.z, t: reloj() }); }
        // lo talado antes que el suelo: así el navegador esconde lo que deja el árbol hasta que lo ve caer
        // lo talado y lo recogido, solo lo de su trozo y solo a quien lo tiene alrededor (el autor siempre)
        const aSuTrozo = (sitio, hacer) => {
          const k = sitio ? trozoDe(sitio.x, sitio.z) : null, solo = k ? new Set([k]) : new Set();
          for (const [otro, a] of clientes) if (a === autor || (k && vista.tiene(a, k))) hacer(otro, solo);
        };
        if (r.ok && r.cae) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro, solo) => enviar(otro, { tipo: 'tala', estado: objetos.talaVisible(solo), cae: { arbol: msg.accion.arbol, dir: r.dir, autor, objetos: r.objetos, caida: r.caida } }));
        // el crujido de aviso (12 nov): a punto de caer, lo oyen todos los de alrededor (al soltarse, con el 'tala' de arriba)
        if (r.ok && r.cruje) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro) => enviar(otro, { tipo: 'crujido', arbol: msg.accion.arbol, autor }));
        // y quien quede debajo (src/logica/tala.js, golpeDeCaida): se mira cuándo le llegaría con dónde está ahora y, en
        // ese momento, otra vez con dónde está entonces (el que se aparta a tiempo se libra). La herida lleva su autor.
        if (r.ok && r.cae && r.caida) caidaHiere(autor, msg.accion.arbol, r.caida);
        // lo descortezado y lo sangrado (8 nov): lo de ese árbol, a quien lo tiene alrededor
        if (r.ok && (msg.accion.tipo === 'descortezar' || msg.accion.tipo === 'sangrar')) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro, solo) => enviar(otro, { tipo: 'tala', estado: objetos.talaVisible(solo) }));
        if (r.suelo) repartirSuelo(ahora);
        if (r.estaciones) repartirEstaciones();
        if (r.ok && (msg.accion.tipo === 'recoger' || msg.accion.tipo === 'desbrozar' || r.rota)) aSuTrozo(objetos.sitioPunto(msg.accion.punto), (otro, solo) => enviar(otro, { tipo: 'recoleccion', estado: objetos.recoleccionVisible(solo) }));
        return;
      }
      if (!msg || msg.tipo !== 'accion' || !msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion))
        return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
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
    ws.on('close', () => {
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
        const idCama = objetos.fab.camaDe(autor), c = idCama ? objetos.fab.estaciones[idCama] : null;
        const cama = c ? { x: c.x, y: terreno ? terreno.suelo(c.x, c.z) : p.y, z: c.z } : null;
        const d = dormidos.dormir(autor, p, { ahora, enTierra: !!mundo.tierraDe(p.x, p.z) && mundo.dentroDeTierra(p.x, p.z, autor), ultimaPelea: ultimaPelea.get(autor) ?? null, cama });
        presenciaDormida(autor, d);
        if (d.enCama) { posiciones.set(autor, { x: d.x, y: d.y, z: d.z, giro: d.giro }); posicionesCambiadas = true; guardarPosiciones(); }
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
    });
  });

  return {
    wss, mundo, terreno, fauna, abandono, cuerpos, morir, salidas, archivoSalidas, revisarTierras, dormidos, revisarDormidos, ultimaPelea, archivoAbandono, archivoTierras, vista, archivo, archivoAdmin, archivoCuentas, archivoSeguridad, cuentas, fichas, verificaciones, cartero, archivoCombate, archivoFichas, archivoPosiciones, posiciones, archivoNecesidades, necesidades, archivoObjetos, archivoObjetosReg, objetos, presencia, combate, apartados, clientes,
    listo: new Promise(r => wss.on('listening', () => r(wss.address().port))),
    guardarObjetosYa, escriturasObjetos: () => escriturasObjetos,
    cerrar: () => guardarObjetosYa().catch(e => registrar(`no se pudo guardar objetos.json al cerrar: ${e && e.message}`)).then(() => new Promise(r => { clearInterval(tic); clearInterval(ticNecesidades); clearInterval(ticCombate); clearInterval(ticLatido); if (ticTierras) clearInterval(ticTierras); if (ticFauna) clearInterval(ticFauna); for (const ws of clientes.keys()) ws.terminate(); wss.close(() => r()); })),
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
  // KINHOLD_GUARDAR_CADA: cada cuánto, como mucho, se reescribe objetos.json (ms; por defecto 1000)
  const g = process.env.KINHOLD_GUARDAR_CADA, guardarCada = g && Number(g) >= 0 ? Number(g) : GUARDAR_CADA;
  const s = crearServidor({ puerto, archivo, terreno, guardarCada, registrar: t => console.log(new Date().toISOString(), t), altas: altasLibres ? { origen: 1e6, total: 1e6, espera: 0 } : {}, limiteMovimiento: !movimientoLibre, arconPruebas, salidaComun, ...(muerteRapida ? { sedInicial: 100, tiemposMuerte: { sed: 3, hambre: 6 }, duraCuerpo: 45000 } : {}) });
  // al apagarlo (actualizar.sh, Ctrl+C, las pruebas al terminar): lo que falte de objetos.json, antes de salir
  let apagando = false;
  const apagar = (senal) => { if (apagando) return; apagando = true; s.guardarObjetosYa().catch(e => console.error('no se pudo guardar objetos.json al apagar:', e && e.message)).finally(() => process.exit(senal === 'SIGINT' ? 130 : 143)); };
  process.on('SIGTERM', () => apagar('SIGTERM')); process.on('SIGINT', () => apagar('SIGINT'));
  s.listo.then(p => console.log(`Servidor de Kinhold en el puerto ${p} · mundo en ${s.archivo} · ${s.mundo.construcciones.length} construcciones · Whitholm generado en ${ms} ms · correo: ${s.cartero.conClave ? 'Resend' : 'sin clave de Resend, los códigos van al registro'}${altasLibres ? ' · AVISO: altas sin límite (KINHOLD_PRUEBAS_ALTAS=libres), solo para pruebas' : ''}${movimientoLibre ? ' · AVISO: sin límite de velocidad (KINHOLD_PRUEBAS_MOVIMIENTO=libre), solo para pruebas' : ''}${arconPruebas ? ' · AVISO: con el arcón infinito (KINHOLD_PRUEBAS_ARCON=si), solo para pruebas' : ''}${salidaComun ? ' · AVISO: los nuevos en la salida común sin elegir (KINHOLD_PRUEBAS_SALIDA=comun), solo para pruebas' : ''}${muerteRapida ? ' · AVISO: muerte rápida de sed (KINHOLD_PRUEBAS_MUERTE=rapida), solo para pruebas' : ''}`));
}
