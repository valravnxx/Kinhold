// Kinhold — hito 1: construcción
import * as THREE from 'three';
import { Mundo, alAlcance, clave, centroLocal, localAMundo, mundoALocal, RADIO_MOJON, geometriaTejados, escaleraAndando, trampillaCerrada, progresoEscalera, centroMundo, tiempoObra, MAX_RATO, plantaObra, clasePeso, andamioEn, poleaPara, polipastoPara, altoCanon, huellaHogar, adarveEn, adarveDeEscalera, altoTejadoEn, empalizadasDe, ALTO_ADARVE, VARAS_PARA_RODAR, ponerZonas, hayZonas } from '../logica/construccion.js';
import { RegistroAcciones, ejecutar, seAbre, seEnciende, AUTOR_LOCAL, acabarObra, USAN_INVENTARIO, reservaDe } from '../logica/acciones.js';
import { PIEZAS, DECORACION, MATERIALES, MODULO, ALTURA, enEsteTramo } from '../logica/piezas.js';
import { modeloPieza, mojon as modeloMojon, decoracion as modeloDeco, mat, P, rellenoTejado, rampaVaras, troncoSuelto, POLEA, POLIPASTO, colgarPolipasto, tornoSuelto, moverHumo } from '../mundo/modelos.js';
import { llevadoDe } from '../logica/llevado.js';
import { crearJugador, camaraDetalle, usarDetalle, detalleEncendido, nivelesEnUso } from './personaje.js';
import { personajeElegido, recursosTaller } from '../mundo/eleccion.js';
import { REGISTRO, VERSION } from './registro.js';
import { t } from './textos.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';
import { montarCharla } from './charla.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { crearCielo } from '../mundo/cielo.js';
import { validarNecesidades, efectos as efectosNecesidades, hayAguaCerca, saciar as saciarNecesidad, TRAGO, AVISO as AVISO_NEC, NUTRE, comestible } from '../logica/necesidades.js';
import { montarAvisos } from './avisos_necesidades.js';
import { crearDecorado } from '../mundo/decorado.js';
import { crearVegetacionMundo, MEDIDAS_VEGETACION } from '../mundo/vegetacion_mundo.js';
import { vigilar, soloEscena, ofrecerGente } from '../mundo/rendimiento.js';
import { crearGraficos } from './graficos.js';
import { conectarEnLinea } from './en_linea.js';
import { crearFauna } from './fauna.js';
import { armaDeMano } from '../logica/arma_mano.js';
import { REPARAR, desgasteDe } from '../logica/desgaste.js';
import { crearObjetosEnLinea } from './objetos_en_linea.js';
import { cargarInventarios, guardarInventarios, ejecutarInventario, CATALOGO, OBJETO_DE_MATERIAL } from '../logica/inventario.js';
import { montarPanelInventario } from './panel_inventario.js';
import { montarPanelFabricar, carpetaIconos } from './panel_fabricar.js';
import { svgPrenda } from './iconos_ropa.js';
import { CARPETA_INTERFAZ } from '../logica/iconos.js';
import { crearEstaciones, MODELO_ESTACION, SITIO_DORMIR } from './estaciones.js';
import { Fabricacion, ejecutarFabricacion, ESTACIONES, RECETAS, DONDE, MAX_RATO_ESTACION, ALCANCE_ESTACION, esAlmacen, esCama, MOTIVO_MURO } from '../logica/fabricacion.js';
import { estadoFuego, calorEn, COMO as COMO_FUEGO } from '../logica/fuego.js';
import { montarMapaRey } from './mapa_rey.js';
import { montarPanelAdmin } from './panel_admin.js';
import { crearComarcas, zonasDeEscena } from '../logica/comarcas.js';
import { crearZonasRey } from '../logica/zonas_rey.js';
import { crearTierrasRey, vigiaTierras } from '../logica/tierras_rey.js';
import { dibujarRetrato } from './retrato.js';
import { PRENDAS, prendasDeCapas, puestasDe } from '../logica/prendas.js';
import { vestidoDe, rasgosPrenda } from '../logica/hechura.js';
import { crearRecoleccion, crearRecoleccionMundo } from './recoleccion.js';
import { crearSuelo } from './suelo.js';
import { crearMundoJuego } from '../mundo/mundo_juego.js';
import { SALIDA, elegirSalida, esSitioDeSalida, SALIDAS, SALIDAS_INICIO } from '../logica/whitholm.js';
import { nombreDe, RECOLECTABLES, conQueDesbroza, GOLPES_DESBROCE, QUE_PIDE, mazoEnMano } from '../logica/recoleccion.js';
import { crearCombateMundo } from './combate_mundo.js';
import { crearTala } from './tala.js';
import { alturaOla } from '../mapa/agua.js';
import { NADO, modoAgua, factorVadeo, nuevoAguante, pasoAguante, puedeCorrer } from '../logica/nado.js';
import { hachaEnMano, HACHAS, edadDeEscala, DESCORTEZAR_CON, SANGRAR_CON } from '../logica/tala.js';
import { RADIO_MIN as BROCHA_MIN, RADIO_MAX as BROCHA_MAX, BORDE as BORDE_BROCHA } from '../logica/nivelado.js';
import { Troceo, ejecutarTroceo, cargarTroceo, guardarTroceo, seTrocea, ALCANCE_TROCEO } from '../logica/troceo.js';
import { Rastras, ejecutarRastra, ejecutarArconAlSuelo, factorRastra, ALCANCE_RASTRA, sitioRastra, VEHICULOS, esVehiculo } from '../logica/rastra.js';
import { moverRastras } from './rastra.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('menu'));
// En el móvil, los botones de modo van debajo del menú de arriba; en otros idiomas (ruso) el menú
// ocupa más filas, así que se colocan según lo que mida de verdad en vez de a una altura fija.
function colocarModos() {
  const modos = document.getElementById('modos'), menu = document.getElementById('menu');
  if (!modos || !menu) return;
  if (innerWidth > 640) { modos.style.top = ''; return; }
  modos.style.top = Math.max(120, Math.ceil(menu.getBoundingClientRect().bottom) + 10) + 'px';
}
// El aviso va justo debajo del menú de arriba (que en el móvil, y más en inglés o en ruso, ocupa varias filas)
// y, en el móvil, a la izquierda de los botones de modo, para no tapar nada.
function colocarAviso() {
  const a = document.getElementById('aviso'), sup = document.getElementById('superior'), modos = document.getElementById('modos');
  if (!a || !sup) return;
  a.style.top = Math.ceil(sup.getBoundingClientRect().bottom) + 8 + 'px';
  if (innerWidth > 640) { a.style.left = a.style.transform = a.style.maxWidth = ''; return; }
  const izq = 10, der = modos && !modos.hidden ? modos.getBoundingClientRect().left - 8 : innerWidth - 10;
  a.style.left = izq + 'px'; a.style.transform = 'none'; a.style.maxWidth = Math.max(140, der - izq) + 'px';
}
function colocarTodo() { colocarModos(); colocarAviso(); }
colocarTodo();
addEventListener('resize', colocarTodo);
// si el menú cambia de tamaño (la demo añade «Menú» y los fps, o cambia el idioma), se recoloca
if (window.ResizeObserver && document.getElementById('superior')) new ResizeObserver(colocarTodo).observe(document.getElementById('superior'));

const CLAVE_GUARDADO = 'kinhold_h1_v1';
// «Jugar en línea» (?enlinea=1): el mundo es el del servidor; nada se guarda en el navegador (src/juego/en_linea.js)
const EN_LINEA = new URLSearchParams(location.search).get('enlinea') === '1';
let enLinea = null;
let fauna = null;   // las liebres que manda el servidor (P4; src/juego/fauna.js)
let charla = null;   // el chat de texto (src/juego/charla.js), con la conexión
let panelSalida = null;   // el de «¿Dónde empiezas?» (elegirSalidaPanel, más abajo)
// El arcón de pruebas (valravnx, 1 nov: «fuera el arcón infinito» del juego de verdad): en línea, solo si el servidor lo
// tiene (lo dice su bienvenida; el de verdad no lo tiene); sin servidor (las pruebas de navegador), sí.
let arconServidor = false;
const hayArcon = () => !enLinea || arconServidor;
const $ = (id) => document.getElementById(id);

// ---------------- Estado ----------------
let mundo = EN_LINEA ? new Mundo() : cargar();
// quién eres para la tierra: el autor que da el servidor (en línea) o el de sin servidor; y tu mojón, si lo tienes
const yoAutor = () => (enLinea && enLinea.red.yo) || AUTOR_LOCAL;
const miMojon = () => mundo.mojonDe(yoAutor());
// Toda acción que cambia el mundo pasa por la lógica pura con su autor y queda anotada (src/logica/acciones.js).
let registroAcciones = new RegistroAcciones();
function accion(a) {
  if (enLinea) { const r = enLinea.red.accion(a); mundo = enLinea.red.mundo; return r; }
  // obras con lo que llevas: lo que se entrega sale del inventario del jugador, y el material se coge del arcón de pruebas
  // sin servidor (las pruebas de navegador) hay arcón de pruebas, y lo desmontado vuelve a él como antes; en línea, a lo
  // que llevas, y lo que no cabe, al suelo (lo pone el servidor)
  const r = ejecutar(mundo, registroAcciones, { autor: AUTOR_LOCAL, ...a }, a.tipo === 'desmontar' ? null : inventarios);
  if (r.ok && USA_INVENTARIO.has(a.tipo) && almacen) guardarInventarios(almacen, inventarios);
  return r;
}
// lo que cobra de lo que llevas (o te devuelve): las obras, el arcón de pruebas, el mojón y los muebles
const USA_INVENTARIO = USAN_INVENTARIO;
// Lo que lleva el jugador (inventario por huecos, src/logica/inventario.js): también por acciones con autor.
// Cuenta para ir más despacio cargado; se ve y se cambia en el panel de inventario (src/juego/panel_inventario.js).
// En línea (valravnx, 30 oct: siempre en línea), lo que llevas, el suelo, lo talado y lo recogido son los del servidor
// (src/juego/objetos_en_linea.js): nada de eso se guarda ni se lee en el navegador.
const almacenNav = (() => { try { return localStorage; } catch (e) { return null; } })();
const almacen = EN_LINEA ? null : almacenNav;
const inventarios = almacen ? cargarInventarios(almacen) : cargarInventarios({ getItem: () => null });
function accionInventario(a) {
  const r = ejecutarInventario(inventarios, registroAcciones, { autor: AUTOR_LOCAL, ...a });
  // en línea se adelanta aquí (el panel no espera a la red) y lo decide el servidor: si no lo acepta, lo que llevas
  // vuelve a ser el suyo
  if (r.ok && objetosRed) objetosRed.mandar(a, (rs) => { if (!rs.ok) mostrarAviso(tr('El servidor no lo ha aceptado: {m}', { m: tr(rs.motivo) }), true); });
  if (r.ok && almacen) guardarInventarios(almacen, inventarios);
  return r;
}
const inventario = () => inventarios.de(AUTOR_LOCAL);
const estado = {
  modo: 'mover',            // mover | construir | desmontar
  sel: { clase: 'pieza', tipo: 'cim_piedra' },
  planta: 0,
  rotLibre: 0,               // giro de la primera pieza de una construcción (rad)
  dir: 0,                    // orientación de tejado, hastial, escalera
  puntero: null,             // {x,z,y} en el mundo
  candidato: null,
  pendienteDesmontar: null,  // {c, key} o {deco}
  esTactil: matchMedia('(pointer: coarse)').matches,
};

function cargar() {
  try {
    const txt = localStorage.getItem(CLAVE_GUARDADO);
    if (txt) return Mundo.importar(JSON.parse(txt));
  } catch (e) { /* sin almacenamiento */ }
  return new Mundo();
}
function guardar() {
  if (EN_LINEA) return;
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(mundo.exportar())); } catch (e) { /* sin almacenamiento */ }
}

// ---------------- Escena ----------------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0); // el cielo lo pinta la página (un degradado CSS no cuesta nada dibujarlo)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
prepararRenderer(renderer); // sombras blandas, sRGB y ACES: los de la escena común
vigilar(renderer); // fotogramas, triángulos y memoria (src/mundo/rendimiento.js)
const escena = new THREE.Scene();
// En la demo, el mundo de verdad: Whitholm, la isla de los playtests (src/mundo/mundo_juego.js). El mapa lo genera antes el
// menú de la demo (window.__mundoDemo). Sin él (la demo con ?llano=1, que usan las pruebas de navegador de la construcción), el llano.
const MUNDO = window.__mundoDemo || null;
// (en el mundo, lo más cerca que se dibuja a 0,5 m y no a 0,1 (valravnx, 6 nov: «a lo lejos sigue hundido el terreno bajo
// el agua»): la hondura tiene la misma precisión repartida entre lo cerca y lo lejos según el cociente lejos/cerca, y
// con 0,1 a 500 m ya no distinguía 15 cm: la lámina del mar, a ras de la orilla, salía por encima de la tierra baja y la
// arena de la orilla por encima del agua. Con 0,5, cinco veces mejor; la cámara nunca está a menos de 1,5 m del personaje)
const camara = new THREE.PerspectiveCamera(45, 1, MUNDO ? 0.5 : 0.1, MUNDO ? 1600 : 500);
// cielo, sol, luz del cielo y niebla del estilo v5 (src/mundo/ambiente.js); la sombra sigue al jugador
const ambiente = crearAmbiente(escena, { fondoPagina: true, alcance: 30, mapa: 2048, niebla: MUNDO ? [110, 700] : [70, 200] });
// el ciclo de día y noche (valravnx, 7 nov; src/mundo/cielo.js y src/logica/cielo.js): la hora es la del servidor (su
// reloj llega en la bienvenida: todos ven el mismo cielo); mueve el sol, la luna y las estrellas, y con ellos la luz
let desfaseReloj = 0;
let necesidades = null;
const avisosNec = montarAvisos({ sentarse: () => sentarse(), sentado: () => !!estado.sentado });   // sus círculos a la derecha (src/juego/avisos_necesidades.js)   // hambre, sed, frío y cansancio, como las manda el servidor (P4; src/logica/necesidades.js)
const cielo = crearCielo({ ambiente, reloj: () => Date.now() + desfaseReloj });
cielo.paso();
// Dónde apareces (valravnx, 30 oct): un jugador nuevo, en un sitio al azar de las comarcas de inicio (src/logica/whitholm.js),
// que se guarda en el navegador para que vuelvas siempre al mismo. Quien ya jugaba (hay algo guardado de antes) sigue en
// el sitio común, que es donde está lo que construyó. En línea, la escena va relativa al sitio común (las posiciones y
// el mundo del servidor), y a cada personaje nuevo el servidor le da un sitio libre al azar de la lista y se lo manda
// en la bienvenida como su posición (valravnx, 5 nov; servidor/servidor.mjs, darSalida). ?salida=N en la dirección
// fuerza el sitio N de la lista (para las pruebas, sin servidor).
const CLAVE_SALIDA = 'kinhold_salida_v1';
function sitioDeSalida() {
  if (EN_LINEA) return { x: SALIDA.x, z: SALIDA.z };
  const forzada = new URLSearchParams(location.search).get('salida');
  if (forzada !== null && SALIDAS[Number(forzada)]) return { x: SALIDAS[Number(forzada)][0], z: SALIDAS[Number(forzada)][1] };
  // (pruebas) ?salida=x,z: un sitio concreto del mundo (m), p. ej. el de salida en línea
  if (forzada && /^\d+,\d+$/.test(forzada)) { const [x, z] = forzada.split(',').map(Number); return { x, z }; }
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_SALIDA) || 'null');
    if (g && esSitioDeSalida(g.x, g.z)) return { x: g.x, z: g.z };
  } catch (e) { /* guardado roto o sin almacenamiento: se elige otro */ }
  let antes = false; try { antes = !!localStorage.getItem(CLAVE_GUARDADO); } catch (e) { /* sin almacenamiento */ }
  const s = antes ? { x: SALIDA.x, z: SALIDA.z } : elegirSalida();
  try { localStorage.setItem(CLAVE_SALIDA, JSON.stringify(s)); } catch (e) { /* sin almacenamiento: otro sitio la próxima vez */ }
  return s;
}
const mundoJ = MUNDO ? crearMundoJuego({ escena, mapa: MUNDO.mapa, origen: sitioDeSalida(), camara }) : null;
// el perfil gráfico y el posprocesado (valravnx, 5 nov; src/juego/graficos.js): la oclusión ambiental, el mapeo tonal, la
// gradación de color, el brillo de las luces y la niebla, según el perfil (de móvil básico a PC alto); en los altos, el
// horizonte: la isla entera, basta, detrás del terreno de cerca (src/mundo/horizonte.js)
const graficos = crearGraficos(renderer, escena, camara, ambiente, mundoJ ? mundoJ.horizonte : null, cielo.estado);
soloEscena(escena); // el rendimiento cuenta un fotograma por dibujo del mundo, no por cada pasada del posprocesado
// las comarcas de Whitholm (src/logica/comarcas.js): para el mapa del rey y para saber si estás en Strandvang, tierras
// del rey (src/logica/tierras_rey.js), donde nadie puede herir a otro jugador: al entrar y al salir, un cartel
const comarcasMundo = mundoJ ? crearComarcas(MUNDO.mapa) : null;
const tierrasRey = mundoJ ? crearTierrasRey(comarcasMundo, mundoJ.salida) : null;
// tu tierra es la zona entera de tu mojón (valravnx, 4 nov; src/logica/construccion.js): de qué zona es cada sitio
// y las zonas del rey (la de la gran veta, la de la ciudad y la de la salida; src/logica/zonas_rey.js) no se reclaman
const zonasRey = comarcasMundo ? crearZonasRey(comarcasMundo) : null;
if (comarcasMundo) ponerZonas(zonasDeEscena(comarcasMundo, mundoJ.salida), zonasRey.es);
const vigiaRey = tierrasRey ? vigiaTierras(window.__mutarTierras ? () => false : tierrasRey.en) : null;
let cartelTierras = null, cartelHasta = 0, tierrasMirado = 0;
function mirarTierras() {
  const t = performance.now();
  if (cartelTierras && !cartelTierras.hidden && t > cartelHasta) cartelTierras.hidden = true;
  if (t - tierrasMirado < 400) return;
  tierrasMirado = t;
  const cambio = vigiaRey.mirar(pj.x, pj.z);
  if (!cambio) return;
  if (!cartelTierras) {
    // arriba en el PC; en el móvil, más abajo (arriba están los botones), entre ellos y el jugador
    const estilo = document.createElement('style');
    estilo.textContent = `#cartelTierras{position:fixed;left:50%;top:16%;transform:translateX(-50%);width:max-content;max-width:min(88vw,520px);
      padding:10px 18px;border-radius:8px;background:rgba(30,26,20,.82);color:#f2e8d0;font:15px/1.35 Georgia,serif;text-align:center;
      z-index:21;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.35)}
      #cartelTierras b{font-size:17px;letter-spacing:.04em}
      @media (max-width:600px){#cartelTierras{top:40%;font-size:14px}#cartelTierras b{font-size:15px}}`;
    document.head.appendChild(estilo);
    cartelTierras = document.createElement('div'); cartelTierras.id = 'cartelTierras';
    document.body.appendChild(cartelTierras);
  }
  const n = tr(tierrasRey.nombre);
  cartelTierras.innerHTML = cambio === 'entra'
    ? `<b>${tr('Entras en {n}, tierras del rey', { n })}</b><br>${tr('Aquí nadie puede herir a otro jugador.')}`
    : `<b>${tr('Sales de {n}, tierras del rey', { n })}</b><br>${tr('Fuera de sus lindes, otros jugadores pueden herirte.')}`;
  cartelTierras.dataset.cambio = cambio;
  cartelTierras.hidden = false; cartelHasta = t + (window.__duraCartel || 6000);   // (__duraCartel: las pruebas, para las capturas)
}

// decorado común (src/mundo/decorado.js): llano para construir, bosque, hierba y rocas con colisión.
// Como la prueba de estilo v5: hierba densa con flores desde el centro, matorrales, calvas de tierra pisada,
// rocas y algunos árboles sueltos más cerca. Donde se construye, la hierba, las flores y las matas se esconden
// (decorado.despejar, en reconstruir) para que no asomen por los cimientos.
// En el mundo de verdad, lo que crece en cada sitio de Whitholm (src/mundo/vegetacion_mundo.js): las siete especies de
// árbol, la hierba y las piedras, con las reglas del mapa y siempre en el mismo sitio.
// (window.__mutarVegetacion: solo para romper la prueba a propósito, con otra semilla en cada carga)
const decorado = mundoJ ? crearVegetacionMundo({ mundoJ, semilla: MUNDO.mapa.semilla + (window.__mutarVegetacion ? Math.floor(Math.random() * 1e6) : 0) })
  : crearDecorado({ semilla: 7, llano: 60, lejos: 230, arboles: 220, bosqueDesde: 28, bosqueHasta: 175,
    hierba: 3200, flores: 900, hierbaDesde: 0, hierbaHasta: 46, rocas: 40, rocasDesde: 9, matas: 45, matasDesde: 7,
    sueltos: 10, sueltosDesde: 22, calvas: 14, claro: (x, z) => Math.hypot(x, z - 4) > 1.5 }); // sin nada en el sitio de salida
escena.add(decorado.raiz);
const obstaculos = decorado.obstaculos; // {x,z,r}
// lo que se recoge del suelo y de las plantas (N0): ramas, piedra, sílex y fibra (src/juego/recoleccion.js)
// En el mundo, sale del sitio (ramas en el bosque, sílex en la caliza…) y sigue al jugador (src/logica/recogida_mundo.js).
const recoleccion = mundoJ ? crearRecoleccionMundo({ raiz: escena, mundoJ, semilla: MUNDO.mapa.semilla + (window.__mutarRecogida ? 1 + Math.floor(Math.random() * 1e6) : 0), altura: decorado.altura, obstaculos, almacen })
  : crearRecoleccion({ raiz: escena, altura: decorado.altura, obstaculos, almacen });
// lo que se suelta cae al suelo, a tus pies; fuera de tus tierras desaparece pasada 1 hora real (src/juego/suelo.js)
const sueloObjetos = crearSuelo({ raiz: escena, altura: decorado.altura, almacen, enTierras: (autor, x, z) => !!mundo.tierraDe(x, z) });
// los árboles se talan a golpes de hacha, caen, dejan tocón y vuelven a crecer (src/juego/tala.js)
const talaV = crearTala({ raiz: escena, obstaculos, altura: decorado.altura, almacen, sueloObjetos });
// en el mundo, lo que crece sigue al jugador: los árboles que llegan pasan por la tala (su tocón, si se taló) y los
// que se van se sueltan; al ponerlos, los talados no se dibujan
if (decorado.paso) {
  decorado.enPie = (o) => talaV.enPie(o);
  decorado.alLlegar = (lista) => talaV.anadir(lista);
  decorado.alIrse = (ids) => talaV.quitar(ids);
  // los matorrales desbrozados no se dibujan (desbrozar, 8 nov): lo que se sabe de ellos lo lleva la recolección
  decorado.mataEnPie = (id) => recoleccion.mataEnPie(id);
  decorado.rocaEnPie = (id) => recoleccion.rocaEnPie(id);   // (y las rocas rotas con el mazo, 8 nov: cascotes)
  if (decorado.rehacer) decorado.rehacer();   // (lo desbrozado que ya se sabía, sin servidor: lo guardado en el navegador)
}
// los troncos del suelo se tronzan (el largo, en 3–4 cortos) y se parten (el corto, en leña) a golpes de hacha
const troceo = new Troceo(sueloObjetos.suelo);
if (almacen) cargarTroceo(almacen, troceo, Date.now());
// la rastra: un objeto del suelo que se arrastra con las dos manos, con su carga (src/logica/rastra.js)
const rastras = new Rastras(sueloObjetos.suelo);
// en línea, todo eso es lo del servidor (src/juego/objetos_en_linea.js); se pinta de nuevo cuando llega
// las estaciones de fabricar (src/juego/estaciones.js): en línea, las del servidor; sin él, las de este navegador
const fabCliente = new Fabricacion();
const estacionesV = crearEstaciones({ raiz: escena, altura: decorado.altura, fab: fabCliente });
let panelFabricar = null; // se monta más abajo, con el de inventario
const objetosRed = EN_LINEA ? crearObjetosEnLinea({ inventarios, autor: AUTOR_LOCAL, sueloObjetos, talaV, recoleccion, estacionesV,
  alEncargos: (d) => { if (panelFabricar) panelFabricar.ponerEncargos(d); },
  // lo que se te ha estropeado encima (la carne cruda, 9 nov; src/logica/comida.js)
  alEstropear: (e) => { for (const t of Object.keys(e)) mostrarAviso(tr('Se te ha estropeado: {c}.', { c: tr(CATALOGO[t] ? CATALOGO[t].nombre : t).toLowerCase() }), true); },
  // lo que se te ha roto al gastarse del todo en el combate o al cazar (10 nov; src/logica/desgaste.js)
  alRomper: (t) => mostrarAviso(tr('Se te ha roto: {c}.', { c: tr(CATALOGO[t] ? CATALOGO[t].nombre : t).toLowerCase() }), true),
  alCambiar: (que) => { if (que === 'inventario' && typeof pintarTodoInventario === 'function') pintarTodoInventario(); if (que === 'suelo' && typeof pintarLlevas === 'function') pintarLlevas(); if ((que === 'suelo' || que === 'estaciones') && panelFabricar) panelFabricar.pintar(); if (que === 'matas' && decorado.rehacer) decorado.rehacer(); } }) : null;

// ---------------- Personaje y cámara ----------------
// personaje del taller propio (la carpeta, en src/mundo/eleccion.js)
const RECURSOS_MH = recursosTaller();
// el personaje elegido en el visor (cuerpo y ropa); si no se ha elegido ninguno, camisa y calzas de lino (GDD)
const elegido = personajeElegido();
const jugador = elegido ? crearJugador(RECURSOS_MH, elegido.sexo, elegido.capas, elegido.aspecto, { tintes: elegido.tintes, hechuras: elegido.hechuras }) : crearJugador(RECURSOS_MH);
escena.add(jugador.raiz);
const pj = { x: 0, y: 0, z: 4, k: 0, rot: Math.PI, vel: 0 };
const cam = { yaw: Math.PI * 0.25, pitch: 0.9, dist: 16 };
const camLibre = { activa: false, x: 0, y: 0, z: 0, sube: 0 };   // la cámara libre del admin (más abajo, «La herramienta del admin»)
// niveles de detalle de los personajes según lo que miden en pantalla desde esta cámara; ?detalle=0|1|2 lo fija (pruebas)
{ const f = new URLSearchParams(location.search).get('detalle'); camaraDetalle(camara, f === null || f === '' ? null : +f); }

// Gente de prueba, solo para medir el rendimiento con varios personajes (botón de la demo): personajes del taller
// que pasean en corro alrededor de donde estás. No son jugadores ni cambian el mundo: solo se dibujan.
const ROPA_PRUEBA = { hombre: [['tunica'], ['gambeson'], ['gambeson', 'cota', 'sobreveste'], []], mujer: [['vestido'], ['vestido', 'gambeson'], []] };
const gente = [];
ofrecerGente({
  cuantos: () => gente.length,
  // niveles de detalle: cuántos hay en cada uno, y apagarlos para comparar
  niveles: nivelesEnUso, detalle: (si) => { if (si !== undefined) usarDetalle(si); return detalleEncendido(); },
  poner(n) {
    while (gente.length > n) escena.remove(gente.pop().j.raiz);
    while (gente.length < n) {
      const i = gente.length, sexo = i % 2 ? 'mujer' : 'hombre', ropas = ROPA_PRUEBA[sexo];
      const j = crearJugador(RECURSOS_MH, sexo, ropas[Math.floor(i / 2) % ropas.length]);
      escena.add(j.raiz);
      // los 8 primeros, en corro a tu alrededor; los demás, en corros pequeños delante de la cámara, cada vez más lejos
      // (de 10 a 65 m), para medir con los niveles de detalle (src/logica/detalle.js) con todos en pantalla
      if (i < 8) gente.push({ j, cx: pj.x, cz: pj.z, radio: 3 + (i % 4) * 1.2, ang: i * 2.4, sentido: i % 3 ? 1 : -1 });
      else {
        const d = 10 + (i - 8) * 5, a = cam.yaw + Math.PI + (i % 2 ? 0.3 : -0.3) * (1 - (i - 8) / 16);
        gente.push({ j, cx: pj.x + Math.sin(a) * d, cz: pj.z + Math.cos(a) * d, radio: 1.5, ang: i * 2.4, sentido: i % 3 ? 1 : -1 });
      }
    }
  },
});
function moverGente(dt) {
  for (const g of gente) {
    g.ang += g.sentido * 0.97 * dt / g.radio; // a paso de andar (0,97 m/s)
    const gx = g.cx + Math.cos(g.ang) * g.radio, gz = g.cz + Math.sin(g.ang) * g.radio;
    g.j.raiz.position.set(gx, mundoJ ? decorado.altura(gx, gz) : 0, gz);
    g.j.raiz.rotation.y = -g.ang + (g.sentido > 0 ? 0 : Math.PI); // mirando hacia donde anda
    g.j.animar(0.97, dt);
  }
}

function actualizarCamara() {
  if (camLibre.activa) {
    // la cámara libre del admin: donde está, mirando hacia donde dicen yaw y pitch (lo contrario de la cámara que sigue)
    const cp = Math.cos(cam.pitch);
    camara.position.set(camLibre.x, camLibre.y, camLibre.z);
    camara.lookAt(camLibre.x - Math.sin(cam.yaw) * cp, camLibre.y - Math.sin(cam.pitch), camLibre.z - Math.cos(cam.yaw) * cp);
    ambiente.seguir(camLibre.x, camLibre.z);
    return;
  }
  const objetivo = new THREE.Vector3(pj.x, pj.y + 1.2, pj.z);
  const cp = Math.cos(cam.pitch);
  let dist = cam.dist;
  // en el mundo, el terreno no se mete entre la cámara y tú: si una loma o un cortado lo tapa, la cámara se acerca
  // (se mira la línea de ti a la cámara en 12 puntos; cada uno, al menos 0,4 m por encima del suelo)
  if (mundoJ) for (let i = 1; i <= 12; i++) {
    const d = cam.dist * i / 12;
    const x = objetivo.x + Math.sin(cam.yaw) * cp * d, y = objetivo.y + Math.sin(cam.pitch) * d, z = objetivo.z + Math.cos(cam.yaw) * cp * d;
    if (y < decorado.altura(x, z) + 0.4) { dist = Math.max(1.5, cam.dist * (i - 1) / 12); break; }
  }
  camara.position.set(
    objetivo.x + Math.sin(cam.yaw) * cp * dist,
    objetivo.y + Math.sin(cam.pitch) * dist,
    objetivo.z + Math.cos(cam.yaw) * cp * dist);
  camara.lookAt(objetivo);
  ambiente.seguir(pj.x, pj.z);
  // en el mundo, los árboles que se meten entre la cámara y tú no se dibujan (src/mundo/vegetacion_mundo.js)
  if (decorado.destapar && !window.__sinDestapar) decorado.destapar(pj, camara.position, (o) => talaV.enPie(o));
}

// ---------------- Construcciones en pantalla ----------------
const raizConstr = new THREE.Group();
escena.add(raizConstr);
const raizDeco = new THREE.Group();
escena.add(raizDeco);
let mallasMojon = [], anilloTierra = null;
// el material del anillo de la tierra es siempre el mismo: si se tirara al rehacer, se volvería a compilar su sombreador
const MAT_ANILLO = new THREE.MeshBasicMaterial({ color: 0xf2e3b5, transparent: true, opacity: 0.55, depthWrite: false });
const registroMallas = []; // {obj, c, key, deco}
// Construir a la altura del suelo (valravnx, 30 oct): cada construcción tiene su planta baja a la altura del terreno donde
// empezó (c.oy; las de antes, a 0) y los cimientos alisan el suelo de debajo (src/logica/nivelado.js). Lo que va suelto
// en el suelo (cercas, empalizadas) sigue el terreno de su sitio.
const oyDe = (c) => c.oy || 0;
const sueloEn = (x, z) => decorado.altura(x, z);
function aRasDeSuelo(obj, c, p) {
  if (p.k !== 0 || !PIEZAS[p.tipo] || !PIEZAS[p.tipo].suelo) return;
  const m = centroMundo(c, p);
  obj.position.y += sueloEn(m.x, m.z) - oyDe(c);
}

function transformarPieza(obj, p) {
  const l = centroLocal(p);
  obj.position.set(l.lx, p.k * ALTURA, l.lz);
  let ry = 0;
  if (['e', 'b', 'p', 'g', 'q', 'w'].includes(p.hueco) && p.d === 1) ry = -Math.PI / 2;
  if (p.hueco === 'g' && p.dir % 2 === 1) ry += Math.PI;
  if (p.hueco === 'r' || p.hueco === 'l' || p.hueco === 't' || p.hueco === 'h' || p.hueco === 'a') ry = -(p.dir || 0) * Math.PI / 2;
  obj.rotation.y = ry;
}
// las hojas que se abren (puertas, portones, contraventanas, trampillas) se llaman «hoja»; las que no giran como una
// puerta llevan su giro en userData.abre ({ eje, ang })
function aplicarAperturas(obj, p) {
  obj.traverse(o => {
    if (o.name !== 'hoja') return;
    const a = o.userData.abre;
    if (a) o.rotation[a.eje] = p.abierta ? a.ang : 0;
    else o.rotation.y = p.abierta ? -Math.PI / 2 : 0;
  });
}

// Libera en la tarjeta gráfica las mallas que se quitan. Sin esto, cada vez que se colocaba o se quitaba algo se
// rehacían todas las piezas y las viejas se quedaban ocupando memoria gráfica: tras un rato construyendo, el móvil
// se quedaba sin ella y la pantalla en blanco aunque fuera a más de 80 fps (lo vio valravnx). Los materiales son
// compartidos (salen de una caché) y no se liberan.
function liberar(obj) { if (window.__sinLiberar) return; obj.traverse(o => { if (o.isMesh && !o.geometry.userData.compartida) o.geometry.dispose(); }); } // __sinLiberar: solo para comprobar que la prueba de la fuga falla
// Esconde la hierba, las flores y las matas bajo lo construido en la planta baja y bajo los muebles del suelo.
function despejarDecorado() {
  if (window.__sinDespejar) return; // solo para comprobar que la prueba de la hierba bajo lo construido falla
  const circ = [];
  for (const c of mundo.construcciones) for (const p of c.piezas.values()) {
    if (p.k !== 0) continue;
    const l = centroLocal(p), m = localAMundo(c, l.lx, l.lz);
    circ.push([m.x, m.z, p.hueco === 'f' || p.hueco === 'a' || p.hueco === 'l' ? MODULO * 0.78 : MODULO * 0.45]); // casillas enteras (también adarve y escaleras)
  }
  for (const d of mundo.decoracion) if (d.y < 0.3) circ.push([d.x, d.z, 0.8]);
  for (const mj of Object.values(mundo.mojones)) circ.push([mj.x, mj.z, 0.9]);
  const ocupado = (x, z) => circ.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r);
  estado.plantasOcultas = decorado.despejar(ocupado);
  recoleccion.despejar(ocupado); // lo que queda debajo de lo construido no se ve ni se recoge
}
let chimeneasSucias = true, chimeneas = []; // chimeneas con fuego (se buscan de nuevo al rehacer piezas)
const altosCanon = new WeakMap(); // chimenea → hasta dónde sube su cañón (se calcula al dibujarla; lo usa el choque)
// suelos y cimientos de troncos: qué casillas de al lado tienen el mismo suelo terminado, para juntarse con ellas
const TIPOS_QUE_SE_JUNTAN = new Set(['suelo_tronco', 'cim_tronco']);
function contextoSuelo(c, p) {
  // chimenea: hasta dónde sube el cañón (por encima del tejado de su casilla) y si tiene el fuego encendido
  if (p.hueco === 'h') { const alto = altoCanon(c, p, P.subidaTejado); altosCanon.set(p, alto); return { alto, encendido: !p.obra && !p.apagado }; }
  // escalera de mano o de tablas que sube hacia un adarve: más corta (llega a su piso, a 1,5 m)
  if (p.hueco === 'l' && adarveDeEscalera(c, p)) return { forma: 'adarve' };
  if (p.hueco === 'w') { // contraventana: en qué muro va y cuál es su lado de fuera (el que no da a un suelo de la casa)
    const m = c.piezas.get(clave('e', p.i, p.j, p.k, p.d));
    const delante = p.d === 0 ? [p.i, p.j] : [p.i - 1, p.j], detras = p.d === 0 ? [p.i, p.j - 1] : [p.i, p.j]; // +z y -z locales
    const suelo = ([i, j]) => c.piezas.has(clave('f', i, j, p.k));
    return { muro: m && m.tipo, fuera: suelo(delante) && !suelo(detras) ? -1 : 1 };
  }
  if (p.hueco !== 'f' || !TIPOS_QUE_SE_JUNTAN.has(p.tipo) || p.obra) return undefined;
  const igual = (di, dj) => { const q = c.piezas.get(clave('f', p.i + di, p.j + dj, p.k)); return !!q && q.tipo === p.tipo && !q.obra; };
  return { vecinos: { xn: igual(-1, 0), xp: igual(1, 0), zn: igual(0, -1), zp: igual(0, 1) } };
}
// el objeto 3D de una pieza (tj: su tejado, de geometriaTejados)
// Modelos ya hechos, por tipo y contexto (vecinos, tejado): la misma pieza en el mismo sitio sale siempre igual, así
// que se hace una vez y luego se copia compartiendo geometría y materiales. Rehacer todo lo construido costaba unos
// 200 ms con una casa de dos plantas, casi todo en hacer la geometría otra vez, y en línea se rehacía con cada puerta
// y cada obra terminada, en los dos jugadores (los tirones que vio valravnx el 28 oct). Las geometrías compartidas no
// se liberan al quitar una pieza (liberar las salta); nada las cambia después: a las piezas solo se les cambia el
// material entero (obras, velos), nunca el que comparten.
const modelosHechos = new Map();
window.__modelos = { hechos: 0, copiados: 0 };   // para la prueba
function modeloDe(tipo, ctx) {
  if (window.__sinCopiarModelos) return modeloPieza(tipo, ctx);   // solo para comprobar que la prueba de tiempos falla
  const clave = tipo + '|' + (ctx ? JSON.stringify(ctx) : '');
  let plantilla = modelosHechos.get(clave);
  if (!plantilla) {
    plantilla = modeloPieza(tipo, ctx);
    plantilla.traverse(o => { if (o.isMesh) o.geometry.userData.compartida = true; });
    modelosHechos.set(clave, plantilla);
    window.__modelos.hechos++;
  } else window.__modelos.copiados++;
  return plantilla.clone(true);
}
// lo que cierra bajo el tejado, igual: se hace una vez por forma y se copia
function rellenoDe(rel, arranque) {
  if (window.__sinCopiarModelos) return rellenoTejado(rel, arranque);
  const clave = 'relleno|' + arranque + '|' + JSON.stringify(rel);
  let plantilla = modelosHechos.get(clave);
  if (!plantilla) {
    plantilla = rellenoTejado(rel, arranque);
    plantilla.traverse(o => { if (o.isMesh) o.geometry.userData.compartida = true; });
    modelosHechos.set(clave, plantilla);
  }
  return plantilla.clone(true);
}
function objPieza(c, key, p, tj) {
  const obj = modeloDe(p.tipo, tj || contextoSuelo(c, p));
  transformarPieza(obj, p);
  aRasDeSuelo(obj, c, p);
  aplicarAperturas(obj, p);
  if (tj) {
    obj.position.y += tj.arranque * P.subidaTejado;
    for (const rel of tj.rellenos) obj.add(rellenoDe(rel, tj.arranque));
  }
  if (p.obra) vestirObra(obj, p);
  Object.assign(obj.userData, { c, key, k: p.k }); // sin borrar lo que trae el modelo (de dónde salen el fuego y el humo)
  obj.traverse(o => { if (o.isMesh) o.userData.ref = obj; });
  chimeneasSucias = true;
  return obj;
}
// Rehace solo una pieza (una obra que avanza un cuarto). Rehacer todo lo construido cada vez que avanzaba una obra
// tiraba los fotogramas mientras se construía (lo vio valravnx jugando en línea el 27 oct): con una cabaña, cada
// vez son cientos de milisegundos, y más en el móvil.
// Las mallas guardan a qué construcción pertenecen. En línea, el mundo puede pasar a ser otra copia con las mismas
// construcciones (al hacer algo propio, o al confirmarlo el servidor) sin que cambie lo que se ve: entonces no se
// rehace nada, solo se apuntan las mallas a las construcciones del mundo de ahora (por su id).
function reapuntar() {
  const porId = new Map(mundo.construcciones.map(c => [c.id, c]));
  for (const g of raizConstr.children) if (g.userData.c && porId.has(g.userData.c.id)) g.userData.c = porId.get(g.userData.c.id);
  for (const r of registroMallas) if (r.c && porId.has(r.c.id)) { r.c = porId.get(r.c.id); r.obj.userData.c = r.c; }
}
function rehacerPieza(idC, key) {
  reapuntar();
  const i = registroMallas.findIndex(m => m.c && m.c.id === idC && m.key === key);
  const c = mundo.construcciones.find(x => x.id === idC), p = c && c.piezas.get(key);
  if (window.__rehacerTodo || i < 0 || !p || !registroMallas[i].obj.parent) { reconstruir(); return; } // __rehacerTodo: solo para que falle su prueba
  const viejo = registroMallas[i].obj, g = viejo.parent;
  window.__rehechos.pieza++;
  const obj = objPieza(c, key, p, geometriaTejados(c).get(key));
  obj.visible = viejo.visible;
  g.remove(viejo); liberar(viejo); g.add(obj);
  registroMallas[i] = { obj, c, key };
}
window.__rehechos = { todo: 0, pieza: 0 }; // cuántas veces se rehace todo o una pieza (para la prueba)
function reconstruir() {
  window.__rehechos.todo++;
  for (const r of [raizConstr, raizDeco]) for (const h of r.children) liberar(h);
  raizConstr.clear(); raizDeco.clear();
  registroMallas.length = 0;
  for (const c of mundo.construcciones) {
    const g = new THREE.Group();
    g.position.set(c.ox, oyDe(c), c.oz);
    g.rotation.y = c.rot;
    g.userData.c = c;
    const tejados = geometriaTejados(c);
    for (const [key, p] of c.piezas) {
      const obj = objPieza(c, key, p, tejados.get(key));
      g.add(obj);
      registroMallas.push({ obj, c, key });
    }
    raizConstr.add(g);
  }
  for (const d of mundo.decoracion) {
    const obj = modeloDeco(d.tipo);
    obj.position.set(d.x, d.y, d.z);
    obj.rotation.y = d.rot;
    obj.userData = { deco: d };
    obj.traverse(o => { if (o.isMesh) o.userData.ref = obj; });
    raizDeco.add(obj);
    registroMallas.push({ obj, deco: d });
  }
  despejarDecorado();
  // los cimientos alisan el suelo de debajo: se rehacen los trozos del terreno que tocan
  if (mundoJ) mundoJ.nivelar(mundo.marcasNivelado());
  if (decorado.nivelar && !window.__sinNivelarVegetacion) decorado.nivelar(mundo.marcasNivelado()); // la hierba, las matas y lo demás, a la altura nueva
  // los mojones de todos (cada personaje el suyo); el anillo de la tierra, solo sin zonas (sin mundo): con ellas, tu
  // tierra es la zona entera y se ve en el mapa
  for (const g of mallasMojon) { escena.remove(g); liberar(g); }
  mallasMojon = [];
  if (anilloTierra) { escena.remove(anilloTierra); liberar(anilloTierra); anilloTierra = null; }
  for (const [autor, mj] of Object.entries(mundo.mojones)) {
    const g = modeloMojon();
    g.position.set(mj.x, sueloEn(mj.x, mj.z), mj.z);
    // se puede elegir en Desmontar (el tuyo: quitarlo y dejar tu tierra; valravnx, 4 nov)
    g.userData.mojon = autor; g.traverse(o => { o.userData.ref = g; });
    escena.add(g); mallasMojon.push(g);
  }
  const mio = miMojon();
  if (mio && !hayZonas()) {
    const anillo = new THREE.Mesh(new THREE.RingGeometry(RADIO_MOJON - 0.15, RADIO_MOJON, 96), MAT_ANILLO);
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(mio.x, 0.03, mio.z);
    anilloTierra = anillo;
    escena.add(anillo);
  }
  actualizarUI();
}

// ---------------- Obras ----------------
// Una obra a medias (GDD, «Obras»): se ve la pieza muy tenue, como un trazado, dentro de un armazón de varas
// atadas que la envuelve (cuatro pies derechos, largueros arriba y abajo y una riostra en cruz por cara).
// Cuanto más trabajo lleva, menos tenue se ve la pieza.
const MAT_ARMAZON = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
const MAT_ATADURA = new THREE.MeshLambertMaterial({ color: 0xb8a27a });
const matsObra = new Map();
function matObra(base, nivel) {
  const b = Array.isArray(base) ? base[0] : base, k = nivel + ':' + (b?.map?.uuid || 'liso') + (b?.vertexColors ? 'v' : '');
  if (!matsObra.has(k)) matsObra.set(k, new THREE.MeshLambertMaterial({ color: 0xd8ccb4, emissive: 0x1a140c, vertexColors: !!b?.vertexColors,
    map: b?.map || null, transparent: true, opacity: 0.42 + 0.12 * nivel, depthWrite: false }));
  return matsObra.get(k);
}
function vara(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), largo = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, largo, 6), MAT_ARMAZON);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}
function vestirObra(obj, p) {
  const total = tiempoObra(p.tipo), nivel = Math.min(4, Math.floor(4 * p.obra.trabajo / total)); // 0..4
  obj.traverse(o => { if (o.isMesh) { o.material = matObra(o.material, nivel); o.castShadow = false; o.renderOrder = 1; } });
  // caja de la pieza en sus propios ejes, un poco más holgada
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), caja = new THREE.Box3();
  obj.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); caja.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); } });
  if (caja.isEmpty()) return;
  const h = 0.06, x0 = caja.min.x - h, x1 = caja.max.x + h, z0 = caja.min.z - h, z1 = caja.max.z + h;
  const y0 = Math.max(0, caja.min.y), y1 = Math.max(caja.max.y + 0.08, y0 + 0.5), r = 0.035;
  const g = new THREE.Group(); g.name = 'armazon';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const esq = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (const [x, z] of esq) g.add(vara(V(x, y0, z), V(x, y1 + 0.12, z), r));
  for (let i = 0; i < 4; i++) {
    const [xa, za] = esq[i], [xb, zb] = esq[(i + 1) % 4];
    if (Math.hypot(xb - xa, zb - za) < 0.5) continue; // la cara estrecha de un muro: basta con los pies
    for (const y of [y0 + 0.1, y1]) g.add(vara(V(xa, y, za), V(xb, y, zb), r * 0.85));
    g.add(vara(V(xa, y0 + 0.1, za), V(xb, y1, zb), r * 0.7)); // riostra
    for (const [x, z] of [[xa, za], [xb, zb]]) for (const y of [y0 + 0.1, y1]) {
      const at = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.07, 6), MAT_ATADURA); at.position.set(x, y, z); g.add(at);
    }
  }
  obj.add(g);
}

// ---------------- Resaltados ----------------
// Fantasma y resaltados con el estilo v5: la pieza conserva su textura y su color horneado (se ve qué es y cómo
// quedará) con un velo apagado encima: verde si cabe, rojo si no; al desmontar, naranja lo que se quita y rojo lo que caería.
const VELOS = {
  ok: { color: 0xd4efc6, emissive: 0x2a4a28, veladura: true }, mal: { color: 0xffb4a6, emissive: 0x58180f, veladura: true },
  rojo: { color: 0xf09a88, emissive: 0x52150e }, naranja: { color: 0xf3c486, emissive: 0x47290a },
};
const matsVelo = new Map();
function matVelo(base, clase) {
  const b = Array.isArray(base) ? base[0] : base, k = clase + ':' + (b?.map?.uuid || 'liso') + (b?.vertexColors ? 'v' : '');
  if (!matsVelo.has(k)) {
    const v = VELOS[clase];
    matsVelo.set(k, new THREE.MeshLambertMaterial({ color: v.color, emissive: v.emissive, vertexColors: !!b?.vertexColors, map: b?.map || null,
      transparent: !!v.veladura, opacity: v.veladura ? 0.62 : 1, depthWrite: !v.veladura }));
  }
  return matsVelo.get(k);
}
let resaltados = [];
function resaltar(obj, clase) {
  obj.traverse(o => {
    if (o.isMesh) {
      if (!o.userData.matOriginal) o.userData.matOriginal = o.material;
      o.material = matVelo(o.userData.matOriginal, clase);
      resaltados.push(o);
    }
  });
}
function limpiarResaltado() {
  for (const o of resaltados) if (o.userData.matOriginal) { o.material = o.userData.matOriginal; delete o.userData.matOriginal; }
  resaltados = [];
}
function objDe(c, key) { const r = registroMallas.find(m => m.c === c && m.key === key); return r && r.obj; }

// ---------------- Fantasma de colocación ----------------
let fantasma = null, fantasmaTipo = null, fantasmaForma = null;
function velarFantasma() {
  fantasma.traverse(o => { if (o.isMesh) { o.userData.matBase = o.material; o.material = matVelo(o.material, 'ok'); o.castShadow = false; o.renderOrder = 2; } });
}
// el remate de tejado cambia de forma según los tramos de al lado (limatesa o limahoya): el fantasma también
function formaFantasma(forma) {
  if (!fantasma || forma === fantasmaForma) return;
  const viejo = fantasma;
  fantasma = modeloPieza(estado.sel.tipo, { forma });
  fantasma.position.copy(viejo.position); fantasma.quaternion.copy(viejo.quaternion); fantasma.scale.copy(viejo.scale);
  fantasma.visible = viejo.visible;
  escena.remove(viejo); liberar(viejo);
  velarFantasma(); escena.add(fantasma);
  fantasmaForma = forma;
}
function prepararFantasma() {
  const tipo = estado.modo === 'construir' ? estado.sel.clase + ':' + estado.sel.tipo : null;
  if (tipo === fantasmaTipo) return;
  if (fantasma) { escena.remove(fantasma); liberar(fantasma); fantasma = null; }
  fantasmaTipo = tipo; fantasmaForma = null;
  if (!tipo) return;
  if (estado.sel.clase === 'pieza') fantasma = modeloPieza(estado.sel.tipo);
  else if (estado.sel.clase === 'deco') fantasma = modeloDeco(estado.sel.tipo);
  else if (estado.sel.clase === 'puesto') fantasma = MODELO_ESTACION[estado.sel.tipo]('fantasma');
  else if (estado.sel.clase === 'nivelar') fantasma = modeloBrocha();
  else fantasma = modeloMojon();
  if (estado.sel.clase === 'pieza' && PIEZAS[estado.sel.tipo].esquina) fantasmaForma = 'tesa';
  velarFantasma();
  fantasma.visible = false;
  escena.add(fantasma);
}
// ---------------- Brocha de nivelar ----------------
// GDD: «nivelar para cimientos con una brocha redonda que rebaja o alisa con bordes suaves». El fantasma: un disco llano
// a la altura a la que deja el suelo (lo que sobra asoma por encima, lo que falta queda por debajo) y, pegada al suelo,
// la raya de hasta dónde llega el borde suave. Decisiones provisionales (registro.js): la primera pasada alisa a la
// altura del suelo en su centro, y las siguientes siguen a esa misma altura (para hacer un llano grande a pasadas)
// mientras no te alejes más de 12 m de la última o vuelvas a coger la brocha; R o Girar cambian el tamaño.
const RADIOS_BROCHA = [0.5, 1, 2, 3, 4].filter(r => r >= BROCHA_MIN && r <= BROCHA_MAX);
const SEGUIR_BROCHA = 12;
estado.radioBrocha = 2; estado.alturaBrocha = null;
function modeloBrocha() {
  const g = new THREE.Group();
  const disco = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshLambertMaterial({ color: 0xc9b48a }));
  disco.rotation.x = -Math.PI / 2; disco.name = 'disco';
  g.add(disco);
  const raya = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(64 * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.85, depthTest: false }));
  raya.name = 'borde'; raya.renderOrder = 3; raya.frustumCulled = false;
  g.add(raya);
  return g;
}
// la altura a la que alisaría una pasada en (x, z), con lo que haya debajo
function alturaBrocha(x, z, ySuelo) {
  const ul = estado.ultimaBrocha;
  if (estado.alturaBrocha !== null && ul && Math.hypot(x - ul.x, z - ul.z) <= SEGUIR_BROCHA) return estado.alturaBrocha;
  return ySuelo;
}
function ponerBrocha(x, y, z) {
  const r = estado.radioBrocha, disco = fantasma.getObjectByName('disco'), raya = fantasma.getObjectByName('borde');
  fantasma.position.set(0, 0, 0); fantasma.rotation.set(0, 0, 0); fantasma.scale.set(1, 1, 1);
  disco.position.set(x, y + 0.02, z); disco.scale.set(r, r, 1);
  const pos = raya.geometry.attributes.position, n = pos.count, R = r + BORDE_BROCHA;
  for (let q = 0; q < n; q++) {
    const a = q / n * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
    pos.setXYZ(q, px, sueloEn(px, pz) + 0.06, pz);
  }
  pos.needsUpdate = true;
}

function pintarFantasma(valido) {
  if (!fantasma) return;
  fantasma.traverse(o => { if (o.isMesh) o.material = matVelo(o.userData.matBase, valido ? 'ok' : 'mal'); });
}

// Evalúa lo que pasaría al colocar en el puntero actual y lo muestra.
function evaluarColocacion() {
  limpiarResaltado();
  prepararFantasma();
  estado.candidato = null;
  if (estado.modo !== 'construir' || !estado.puntero || !fantasma) { if (fantasma) fantasma.visible = false; mostrarAviso(''); return; }
  let { x, z } = estado.puntero;
  const sel = estado.sel;
  fantasma.visible = true;
  if (sel.clase === 'mojon') {
    fantasma.position.set(x, sueloEn(x, z), z); fantasma.rotation.set(0, 0, 0);
    const pm = mundo.puedeMojon(x, z, yoAutor());
    const v = miMojon() ? { ok: false, motivo: t('yaMojon') } : !pm.ok ? pm : (autoconstruirAdmin() || mundo.puedePagar(PIEZAS.mojon.coste, reservaDe(inventario()))) ? { ok: true } : { ok: false, motivo: t('llevaMateriales') };
    pintarFantasma(v.ok); mostrarAviso(v.ok ? '' : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'mojon', x, z, v };
    return;
  }
  if (sel.clase === 'nivelar') {
    const ys = estado.puntero.ySuelo ?? sueloEn(x, z), y = redondoMm(alturaBrocha(x, z, ys));
    ponerBrocha(x, y, z);
    let v = { ok: true };
    if (!miMojon()) v = { ok: false, motivo: t('primeroMojon') };
    else if (!mundo.dentroDeTierra(x, z, yoAutor())) v = { ok: false, motivo: t('fueraTierra') };
    pintarFantasma(v.ok);
    const r = estado.radioBrocha.toLocaleString(document.documentElement.lang || 'es');
    mostrarAviso(v.ok ? tr('Brocha de {r} m: alisa el suelo a la altura del disco. Cambia el tamaño con R o Girar.', { r }) : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'nivelar', x, y, z, v };
    return;
  }
  if (sel.clase === 'puesto') {
    // un puesto de trabajo (P3): se pone el marco a tu lado; la hoguera, solo fuera (no bajo techo)
    const y = estado.puntero.ySuperficie || 0;
    // lo que va colgado (los colgaderos): se pega a la cara del muro más cercano, mirando a la habitación
    const muro = ESTACIONES[sel.tipo].muro ? mundo.muroCercano(x, z, 1) : null;
    if (muro) { x = muro.x; z = muro.z; }
    fantasma.position.set(x, y, z); fantasma.rotation.set(0, muro ? muro.giro : estado.rotDeco || 0, 0);   // con el giro que se le da (Girar), el que se guarda
    let v = fabCliente.puedeColocar(sel.tipo, x, z, mundo.bajoTecho(x, z));
    if (v.ok && ESTACIONES[sel.tipo].muro && !muro) v = { ok: false, motivo: MOTIVO_MURO(ESTACIONES[sel.tipo].nombre) };
    if (v.ok && Math.hypot(x - pj.x, z - pj.z) > PONER_PUESTO) v = { ok: false, motivo: 'Acércate: el marco se pone a tu lado.' };
    if (v.ok && pj.k > 0) v = { ok: false, motivo: 'Los puestos de trabajo van en la planta baja.' };
    if (v.ok) v = mundo.puedeTocar(x, z, yoAutor());
    // los almacenajes, solo en tu tierra (o en la de quien te invita)
    if (v.ok && ESTACIONES[sel.tipo].tierra && !mundo.dentroDeTierra(x, z, yoAutor())) v = { ok: false, motivo: 'Los almacenajes van en tu tierra (o en la de quien te invita).' };
    pintarFantasma(v.ok);
    const e = ESTACIONES[sel.tipo];
    mostrarAviso(v.ok ? tr('{e}: pon el marco y llévale {c}.', { e: tr(e.nombre), c: Object.entries(e.coste).map(([m, n]) => `${n} ${tr(CATALOGO[m].nombre).toLowerCase()}`).join(', ') }) : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'puesto', x, y, z, v, giro: muro ? muro.giro : null };
    return;
  }
  if (sel.clase === 'deco') {
    const y = estado.puntero.ySuperficie || 0;
    fantasma.position.set(x, y, z); fantasma.rotation.set(0, estado.rotDeco || 0, 0);
    let v = { ok: true };
    if (!miMojon()) v = { ok: false, motivo: t('primeroMojon') };
    else if (!mundo.dentroDeTierra(x, z, yoAutor())) v = { ok: false, motivo: t('fueraTierra') };
    else if (!autoconstruirAdmin() && !mundo.puedePagar(DECORACION[sel.tipo].coste, reservaDe(inventario()))) v = { ok: false, motivo: t('llevaMateriales') };
    pintarFantasma(v.ok); mostrarAviso(v.ok ? '' : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'deco', x, y, z, v };
    return;
  }
  // y: la altura del suelo donde apuntas (si la pieza empieza una construcción, su planta baja queda ahí)
  const datos = { pieza: sel.tipo, x, z, k: estado.planta, rot: estado.rotLibre, dir: estado.dir, y: redondoMm(estado.puntero.ySuelo ?? sueloEn(x, z)) };
  const cand = mundo.candidata(datos.pieza, x, z, datos.k, datos.rot, datos.dir, datos.y);
  const v = mundo.validar(cand, true, yoAutor()); // se pone el marco de la obra: el material se lleva después
  // colocar el fantasma en la rejilla de su construcción
  const c = cand.construccion;
  const tmp = new THREE.Group();
  tmp.position.set(c.ox, oyDe(c), c.oz); tmp.rotation.y = c.rot; tmp.updateMatrixWorld();
  const local = new THREE.Object3D();
  transformarPieza(local, cand.pieza);
  aRasDeSuelo(local, c, cand.pieza);
  tmp.add(local); tmp.updateMatrixWorld(true);
  local.matrixWorld.decompose(fantasma.position, fantasma.quaternion, fantasma.scale);
  if (cand.pieza.hueco === 'r' && !cand.nueva && v.ok) {
    // el tramo continúa la pendiente de los vecinos: arranca más alto
    c.piezas.set(v.clave, cand.pieza);
    const tj = geometriaTejados(c).get(v.clave);
    c.piezas.delete(v.clave);
    if (tj) fantasma.position.y += tj.arranque * P.subidaTejado;
    if (tj && tj.forma) formaFantasma(tj.forma);
  }
  // escalera que sube hacia un adarve: el fantasma ya sale corta
  if (cand.pieza.hueco === 'l' && !PIEZAS[sel.tipo].andamio) formaFantasma(!cand.nueva && adarveDeEscalera(c, cand.pieza) ? 'adarve' : null);
  pintarFantasma(v.ok);
  if (!v.ok && v.debil) {
    const o = objDe(c, v.debil);
    if (o) resaltar(o, 'rojo');
    const pd = c.piezas.get(v.debil) || cand.pieza;
    mostrarAviso(`${tr(v.motivo)} ${t('puntoDebil')}: ${tr(PIEZAS[pd.tipo].nombre)} (${Math.round(v.carga)} / ${v.cap} kg)`, true);
  } else {
    mostrarAviso(v.ok ? (cand.nueva ? t('nuevaConstruccion') : '') : tr(v.motivo), !v.ok);
  }
  estado.candidato = { tipo: 'pieza', cand, v, datos };
}

function colocar() {
  const ca = estado.candidato;
  if (!ca) return;
  if (!ca.v.ok) { mostrarAviso(tr(ca.v.motivo), true); return; }
  if (ca.tipo === 'puesto') { // por la fabricación (en línea, el servidor): el marco, sin gastar nada
    const tipo = estado.sel.tipo;
    hacerFabricacion({ tipo: 'colocar_estacion', estacion: tipo, x: redondoMm(ca.x), z: redondoMm(ca.z), y: redondoMm(ca.y), giro: +(ca.giro ?? estado.rotDeco ?? 0).toFixed(3) }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      mostrarAviso(tr('Marco puesto: llévale {c} y trabaja en él (Usar).', { c: Object.entries(ESTACIONES[tipo].coste).map(([m, n]) => `${n} ${tr(CATALOGO[m].nombre).toLowerCase()}`).join(', ') }));
    });
    return;
  }
  let r;
  if (ca.tipo === 'mojon') r = accion({ tipo: 'mojon', x: ca.x, z: ca.z });
  else if (ca.tipo === 'nivelar') r = accion({ tipo: 'nivelar', x: redondoMm(ca.x), z: redondoMm(ca.z), y: ca.y, radio: estado.radioBrocha });
  else if (ca.tipo === 'deco') r = accion({ tipo: 'decorar', pieza: estado.sel.tipo, x: ca.x, y: ca.y, z: ca.z, rot: estado.rotDeco || 0 });
  else r = accion({ tipo: 'colocar', ...ca.datos });
  if (r.ok) {
    if (ca.tipo === 'mojon') { estado.sel = { clase: 'pieza', tipo: 'cim_piedra' }; marcarSeleccion(); }
    if (ca.tipo === 'nivelar') { estado.alturaBrocha = ca.y; estado.ultimaBrocha = { x: ca.x, z: ca.z }; }
    guardar(); reconstruir(); evaluarColocacion();
    if (r.obra) mostrarAviso(t('marcoPuesto'));
  } else mostrarAviso(tr(r.motivo), true);
}

// ---------------- Desmontar ----------------
function evaluarDesmontaje(hit) {
  limpiarResaltado();
  estado.pendienteDesmontar = null;
  $('btnConfirmar').textContent = tr('Desmontar');
  if (!hit) { mostrarAviso(''); return; }
  const obj = hit.object.userData.ref;
  if (!obj) { mostrarAviso(''); return; }
  if (obj.userData.mojon) {
    // tu mojón: quitarlo deja tu tierra y se pierde todo lo construido en ella (valravnx, 4 nov: que avise)
    if (obj.userData.mojon !== yoAutor()) { mostrarAviso(t('mojonAjeno'), true); return; }
    const p = mundo.perderiaSinMojon(yoAutor());
    if (!p) { mostrarAviso(''); return; }
    resaltar(obj, 'naranja');
    for (const c of p.construcciones) for (const k of c.piezas.keys()) { const o = objDe(c, k); if (o) resaltar(o, 'rojo'); }
    for (const d of p.muebles) { const r = registroMallas.find(m => m.deco === d); if (r) resaltar(r.obj, 'rojo'); }
    estado.pendienteDesmontar = { mojon: true };
    $('btnConfirmar').textContent = tr('Quitar el mojón');
    const n = p.piezas + p.muebles.length;
    mostrarAviso(n ? tr('Quitar tu mojón: dejas tu tierra y PIERDES lo construido en ella ({n} piezas y muebles, sin recuperar nada). Desmonta antes lo que quieras recuperar.', { n }) : t('quitarMojonVacio'), true);
    return;
  }
  if (obj.userData.estacion) {
    // un puesto o un almacenaje (valravnx, 7 nov: que se desmonten): terminado, el 75 % y lo que guarda, al suelo
    const e = fabCliente.estaciones[obj.userData.estacion];
    if (!e || !ESTACIONES[e.tipo]) { mostrarAviso(''); return; }
    const tocar = mundo.puedeTocar(e.x, e.z, yoAutor());
    if (!tocar.ok) { mostrarAviso(tr(tocar.motivo), true); return; }
    if (Math.hypot(e.x - pj.x, e.z - pj.z) > USAR_ESTACION) { mostrarAviso(tr('Acércate para desmontarlo.'), true); return; }
    resaltar(obj, 'naranja');
    estado.pendienteDesmontar = { estacion: e.id };
    const n = tr(ESTACIONES[e.tipo].nombre);
    mostrarAviso(e.obra ? tr('{e}: quitas el marco y lo entregado cae al suelo.', { e: n }) : tr('{e}: recuperas el 75 % del material, y lo que guarda cae al suelo.', { e: n }));
    return;
  }
  if (obj.userData.deco) {
    resaltar(obj, 'naranja');
    estado.pendienteDesmontar = { deco: obj.userData.deco };
    mostrarAviso(`${tr(DECORACION[obj.userData.deco.tipo].nombre)}: ${t('recuperas75')}`);
    return;
  }
  const { c, key } = obj.userData;
  // solo lo que tienes al alcance, en tu planta o la de encima (el servidor lo mira igual con dónde te tiene)
  const al = c.piezas.has(key) ? alAlcance(c, c.piezas.get(key), pj.x, pj.z, pj.k) : { ok: true };
  if (!al.ok) { mostrarAviso(tr(al.motivo), true); return; }
  const pre = mundo.previsualizarDesmontaje(c, key, yoAutor());   // lo de otro, ni se resalta como para desmontar
  resaltar(obj, 'naranja');
  for (const k2 of pre.caen || []) { const o = objDe(c, k2); if (o) resaltar(o, 'rojo'); }
  if (!pre.ok) {
    const o = objDe(c, pre.debil); if (o) resaltar(o, 'rojo');
    mostrarAviso(tr(pre.motivo), true);
    return;
  }
  estado.pendienteDesmontar = { c, key, caen: pre.caen.length };
  const nombre = tr(PIEZAS[c.piezas.get(key).tipo].nombre);
  mostrarAviso(pre.caen.length === 1 ? `${nombre}: ${t('caera1')}` : pre.caen.length ? `${nombre}: ${t('caeran')} ${pre.caen.length} ${t('piezasEncima')}` : `${nombre}: ${t('recuperas75')}`, pre.caen.length > 0);
}
function confirmarDesmontaje() {
  const pd = estado.pendienteDesmontar;
  if (!pd) return;
  if (pd.estacion) {
    estado.pendienteDesmontar = null; limpiarResaltado(); $('confirmar').hidden = true;
    hacerFabricacion({ tipo: 'desmontar_estacion', estacion: pd.estacion, x: pj.x, z: pj.z }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      const dev = Object.entries(r.devuelto || {}).map(([m, n]) => `+${n} ${tr(CATALOGO[m].nombre).toLowerCase()}`).join(', ');
      mostrarAviso(r.quitada ? tr('Marco quitado: lo que tenía, en el suelo.') : `${t('desmontado')}${dev ? ': ' + dev : ''}`);
    });
    return;
  }
  let r;
  if (pd.mojon) r = accion({ tipo: 'quitar_mojon' });
  else if (pd.deco) r = accion({ tipo: 'quitar', id: pd.deco.id });
  else r = accion({ tipo: 'desmontar', construccion: pd.c.id, clave: pd.key });
  estado.pendienteDesmontar = null;
  if (r.ok && pd.mojon) {
    cambiarModo('mover'); guardar(); reconstruir();
    const n = r.perdidas ? r.perdidas.piezas + r.perdidas.muebles : 0;
    // el último: lo que diga la interfaz al cambiar de modo (el consejo del mojón) no lo tapa
    mostrarAviso(n ? tr('Mojón quitado: tu tierra queda libre y se han perdido {n} piezas y muebles. Pon el mojón donde quieras.', { n }) : t('mojonQuitado'));
    limpiarResaltado(); $('confirmar').hidden = true;
    return;
  } else if (r.ok) {
    const dev = Object.entries(r.devuelto || {}).map(([m, n]) => `+${n} ${tr(MATERIALES[m]).toLowerCase()}`).join(', ');
    guardar(); reconstruir();
    mostrarAviso(`${t('desmontado')}${dev ? ': ' + dev : ''}${r.caen && r.caen.length ? ' · ' + r.caen.length + ' ' + (r.caen.length === 1 ? t('destruida1') : t('destruidas')) : ''}`);
  } else mostrarAviso(tr(r.motivo), true);
  limpiarResaltado();
  $('confirmar').hidden = true;
}

// ---------------- Raycast ----------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayoDesde(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camara);
  return ray;
}
function punteroDesde(clientX, clientY) {
  const rr = rayoDesde(clientX, clientY);
  if (estado.modo === 'construir' && (estado.sel.clase === 'deco' || estado.sel.clase === 'puesto')) {
    // la decoración (y los puestos de trabajo) se apoya en los suelos o cimientos de la planta en la que estás, o en el terreno. Solo cuentan
    // los de tu planta: el suelo de arriba (oculto o no) nunca recibe el clic (lo vio valravnx: la cama se iba al
    // altillo estando debajo). Las obras a medias tampoco.
    const objetivos = registroMallas.filter(m => {
      const p = m.c && m.c.piezas.get(m.key);
      return p && p.hueco === 'f' && p.k === pj.k && !p.obra && m.obj.visible;
    }).map(m => m.obj);
    const hits = rr.intersectObjects(objetivos, true);
    if (hits.length) return { x: hits[0].point.x, z: hits[0].point.z, ySuperficie: hits[0].point.y };
    if (pj.k > 0) return null; // arriba, fuera de los suelos de tu planta no hay dónde ponerla
  }
  // el punto del terreno que hay bajo el puntero (no el plano de la altura 0: en ladera, se apuntaba a otro sitio)
  const suelo = sueloBajoRayo(rr.ray);
  if (estado.sel.clase !== 'pieza') return suelo && { x: suelo.x, z: suelo.z, ySuperficie: suelo.y, ySuelo: suelo.y };
  // una pieza: en la planta en la que estás de la construcción que hay ahí (su planta baja está a su altura, oy); si
  // empieza una construcción nueva, en el suelo
  const pto = new THREE.Vector3();
  const c = suelo ? mundo.construccionCercana(suelo.x, suelo.z) : null;
  if (c || estado.planta > 0) {
    const y = (c ? oyDe(c) : suelo ? suelo.y : 0) + estado.planta * ALTURA;
    if (!rr.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), pto)) return null;
    return { x: pto.x, z: pto.z, ySuperficie: y, ySuelo: suelo ? suelo.y : sueloEn(pto.x, pto.z) };
  }
  return suelo && { x: suelo.x, z: suelo.z, ySuperficie: suelo.y, ySuelo: suelo.y };
}
const redondoMm = (v) => Math.round(v * 1000) / 1000;
// Dónde corta el rayo el terreno: se avanza a pasos (más largos cuanto más lejos) hasta pasar por debajo del suelo y
// se afina a medias. Devuelve { x, y, z } o null si no lo corta en 400 m.
function sueloBajoRayo(r) {
  const o = r.origin, d = r.direction, f = (t) => o.y + d.y * t - sueloEn(o.x + d.x * t, o.z + d.z * t);
  let t0 = 0, f0 = f(0);
  if (f0 < 0) return null;
  for (let t = 0.25; t < 400; t += 0.25 + t * 0.01) {
    const ft = f(t);
    if (ft <= 0) {
      let a = t0, b = t;
      for (let k = 0; k < 14; k++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
      const tt = (a + b) / 2;
      return { x: o.x + d.x * tt, y: sueloEn(o.x + d.x * tt, o.z + d.z * tt), z: o.z + d.z * tt };
    }
    t0 = t; f0 = ft;
  }
  return null;
}
function piezaBajo(clientX, clientY) {
  const rr = rayoDesde(clientX, clientY);
  const objs = registroMallas.filter(m => m.obj.visible).map(m => m.obj).concat(mallasMojon);
  const hits = rr.intersectObjects(objs, true).filter(h => h.object.visible && h.object.userData.ref && h.object.userData.ref.visible);
  // y los puestos y almacenajes (src/juego/estaciones.js: un grupo por cada uno, con su id), en planta baja
  if (pj.k === 0) {
    for (const h of rr.intersectObjects(estacionesV.grupo.children, true)) {
      let o = h.object; while (o && o.parent !== estacionesV.grupo) o = o.parent;
      if (!o || !o.userData.id) continue;
      o.userData.estacion = o.userData.id; h.object.userData.ref = o;
      hits.push(h); break;
    }
    hits.sort((a, b) => a.distance - b.distance);
  }
  return hits[0] || null;
}

// ---------------- Entrada: teclado ----------------
// Las teclas se leen por su posición física (e.code), no por la letra que escribe: con la distribución rusa
// (o cualquier otra) W escribe «ц» y antes no movía (lo vio valravnx el 27 oct). Lo que no está en la tabla
// (+, - y demás) sigue por la letra. Al perder el foco se sueltan todas, para que ninguna se quede pulsada.
const TECLAS_FISICAS = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', KeyR: 'r', KeyB: 'b', KeyX: 'x', KeyF: 'f', KeyI: 'i', KeyM: 'm', KeyC: 'c', KeyH: 'h', KeyZ: 'z', Space: ' ',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
  ShiftLeft: 'shift', ShiftRight: 'shift', PageUp: 'pageup', PageDown: 'pagedown', Escape: 'escape',
  NumpadAdd: '+', NumpadSubtract: '-',
};
const nombreTecla = (e) => TECLAS_FISICAS[e.code] || (e.key || '').toLowerCase();
const teclas = new Set();
addEventListener('blur', () => teclas.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) teclas.clear(); });
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return; // atajos del navegador (Ctrl+W, etc.): no mueven
  const k = nombreTecla(e);
  // Intro: escribir en el chat de texto (las teclas pulsadas se sueltan: mientras se escribe no se mueve)
  if (k === 'enter' && charla && !charla.abierta) { e.preventDefault(); charla.abrir(); return; }
  teclas.add(k);
  if (k === 'r') girar();
  if (k === 'b') cambiarModo(estado.modo === 'construir' ? 'mover' : 'construir');
  if (k === 'x') cambiarModo(estado.modo === 'desmontar' ? 'mover' : 'desmontar');
  if (k === 'pageup' || k === '+') cambiarPlanta(1);
  if (k === 'pagedown' || k === '-') cambiarPlanta(-1);
  if (k === 'f') usar();
  if (k === 'z' && !e.repeat) sentarse();
  if (k === 'i') panelInventario.alternar();
  if (k === 'h' && panelFabricar) panelFabricar.alternar();
  if (k === 'm' && mapaRey) { if (panelAdmin && panelAdmin.abierto) panelAdmin.cerrar(); else mapaRey.alternar(); }
  if (k === 'f9' && panelAdmin) { e.preventDefault(); panelAdmin.alternar(); }
  if (k === 'f10' && panelAdmin && panelAdmin.admin) { e.preventDefault(); alternarCamaraLibre(); }
  if (k === ' ' && camLibre.activa) e.preventDefault();   // que Espacio suba la cámara y no mueva la página
  if (k === 'escape') { if (mapaRey && mapaRey.abierto) mapaRey.cerrar(); else cambiarModo('mover'); }
});
addEventListener('keyup', (e) => {
  teclas.delete(nombreTecla(e));
  teclas.delete((e.key || '').toLowerCase()); // por si se pulsó con otra distribución y se suelta con esta
  if (e.key === 'Shift') teclas.delete('shift');
});

// ---------------- Entrada: ratón y táctil ----------------
const punteros = new Map(); // pointerId -> {x,y,x0,y0,t0}
let arrastrando = false, pinzaDist = 0, dedoQuieto = null;
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('pointerdown', (e) => {
  lienzo.setPointerCapture(e.pointerId);
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), boton: e.button });
  arrastrando = false;
  // en táctil, el dedo quieto medio segundo sobre algo abre el menú de usar
  clearTimeout(dedoQuieto);
  if (e.pointerType !== 'mouse' && punteros.size === 1 && estado.modo === 'mover' && !document.body.classList.contains('combate')) {
    const q = punteros.get(e.pointerId);
    dedoQuieto = setTimeout(() => { if (!arrastrando && punteros.size === 1) { q.menu = true; abrirMenuUsar(q.x, q.y, true); } }, 500);
  }
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    pinzaDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
lienzo.addEventListener('pointermove', (e) => {
  const p = punteros.get(e.pointerId);
  if (!p) {
    // ratón sin pulsar: mover el puntero de construcción
    if (e.pointerType === 'mouse') alPasar(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) arrastrando = true;
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinzaDist) cam.dist = THREE.MathUtils.clamp(cam.dist * (pinzaDist / d), 6, 34);
    pinzaDist = d;
    cam.yaw -= dx * 0.004;
    return;
  }
  if (arrastrando) clearTimeout(dedoQuieto);
  // el botón derecho ya no gira la cámara: es para usar lo que tocas (la rueda pulsada gira; valravnx, 31 oct)
  const rotarCamara = e.pointerType !== 'mouse' || p.boton === 1 || (p.boton === 0 && estado.modo === 'mover');
  if (arrastrando && rotarCamara) {
    cam.yaw -= dx * 0.006;
    // hasta casi a ras de suelo (valravnx, 30 oct); con la cámara libre, también mirando hacia arriba
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, camLibre.activa ? -1.3 : 0.06, camLibre.activa ? 1.5 : 1.35);
  }
  if (e.pointerType === 'mouse' && p.boton === 0 && estado.modo === 'construir') alPasar(e.clientX, e.clientY);
});
lienzo.addEventListener('pointerup', (e) => {
  const p = punteros.get(e.pointerId);
  punteros.delete(e.pointerId);
  if (punteros.size < 2) pinzaDist = 0;
  clearTimeout(dedoQuieto);
  if (!p || arrastrando) return;
  if (p.menu) { ignorarClicMenu = performance.now() + 600; return; } // el dedo quieto ya abrió el menú de usar
  // clic derecho sin arrastre: el menú de usar lo que hay ahí
  if (e.pointerType === 'mouse' && p.boton === 2) { if (estado.modo === 'mover' && !document.body.classList.contains('combate')) abrirMenuUsar(e.clientX, e.clientY); return; }
  // toque o clic sin arrastre
  if (e.pointerType === 'mouse' && p.boton !== 0) return;
  if (estado.modo === 'desmontar') {
    // el clic o el toque elige la pieza o el mueble y lo deja fijo hasta confirmar o cancelar
    elegirDesmontaje(e.clientX, e.clientY);
    return;
  }
  alPasar(e.clientX, e.clientY);
  if (e.pointerType === 'mouse' && estado.modo === 'construir') colocar();
});
lienzo.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 6, 34);
}, { passive: false });

function alPasar(cx, cy) {
  if (estado.modo === 'construir') {
    estado.puntero = punteroDesde(cx, cy);
    evaluarColocacion();
  } else if (estado.modo === 'desmontar' && $('confirmar').hidden) {
    // pasar el ratón solo enseña qué se quitaría; si ya hay algo elegido esperando confirmación, no se toca
    evaluarDesmontaje(piezaBajo(cx, cy));
  }
}
function elegirDesmontaje(cx, cy) {
  $('confirmar').hidden = true;
  evaluarDesmontaje(piezaBajo(cx, cy));
  if (estado.pendienteDesmontar) $('confirmar').hidden = false;
}

// Joystick táctil
const joy = { activo: false, id: null, cx: 0, cy: 0, vx: 0, vy: 0 };
{
  const zona = $('joystick'), pomo = $('pomo');
  zona.addEventListener('pointerdown', (e) => {
    zona.setPointerCapture(e.pointerId);
    const r = zona.getBoundingClientRect();
    joy.activo = true; joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
    moverJoy(e);
  });
  const moverJoy = (e) => {
    if (!joy.activo || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const max = 45, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.vx = dx / max; joy.vy = dy / max;
    pomo.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  zona.addEventListener('pointermove', moverJoy);
  const soltar = () => { joy.activo = false; joy.vx = joy.vy = 0; pomo.style.transform = ''; };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);
}

// ---------------- Acciones ----------------
function cambiarModo(m) {
  estado.modo = m;
  estado.pendienteDesmontar = null;
  $('confirmar').hidden = true;
  limpiarResaltado();
  if (m !== 'construir' && fantasma) fantasma.visible = false;
  if (m === 'construir' && !estado.puntero) {
    // en táctil, empezar con el puntero delante del personaje
    estado.puntero = { x: pj.x + Math.sin(pj.rot) * 3, z: pj.z + Math.cos(pj.rot) * 3, ySuperficie: 0 };
  }
  if (m === 'construir') evaluarColocacion(); else mostrarAviso('');
  actualizarUI();
}
function girar() {
  const sel = estado.sel;
  if (estado.modo !== 'construir') return;
  if (sel.clase === 'pieza') {
    const h = PIEZAS[sel.tipo].hueco;
    const nueva = !estado.candidato || !estado.candidato.cand || estado.candidato.cand.nueva;
    if (h === 'r' || h === 'l') estado.dir = (estado.dir + 1) % 4;
    else if (h === 'g') estado.dir = (estado.dir + 1) % 2;
    // el giro libre solo cuenta para la primera pieza de una construcción nueva
    else if (nueva) estado.rotLibre = (estado.rotLibre + Math.PI / 12) % (Math.PI * 2);
    if (nueva && (h === 'r' || h === 'l' || h === 'g')) estado.rotLibre = (estado.rotLibre + Math.PI / 12) % (Math.PI * 2);
  } else if (sel.clase === 'nivelar') {
    estado.radioBrocha = RADIOS_BROCHA[(RADIOS_BROCHA.indexOf(estado.radioBrocha) + 1) % RADIOS_BROCHA.length];
  } else estado.rotDeco = ((estado.rotDeco || 0) + Math.PI / 12) % (Math.PI * 2);
  evaluarColocacion();
}
function cambiarPlanta(d) {
  estado.planta = THREE.MathUtils.clamp(estado.planta + d, 0, 3);
  $('planta').textContent = `${t('planta')} ${estado.planta}`;
  evaluarColocacion();
}

// Usar: puertas y escaleras cercanas
// todos los que están al alcance, del más cercano al más lejano (para el menú de Usar)
function interactivosCercanos() {
  const lista = [];
  for (const c of mundo.construcciones) {
    for (const [key, p] of c.piezas) {
      if (p.obra) continue;
      const puerta = seAbre(p), fuego = seEnciende(p);
      const esc = p.hueco === 'l' && !PIEZAS[p.tipo].andando; // la de tablas se sube andando
      if (!puerta && !esc && !fuego) continue;
      const m = localAMundo(c, centroLocal(p).lx, centroLocal(p).lz);
      const d = Math.hypot(m.x - pj.x, m.z - pj.z);
      let mismaPlanta = p.k === pj.k || (esc && p.k === pj.k - 1) || (p.hueco === 't' && p.k === pj.k + 1); // la trampilla, también desde abajo
      // en una pila de andamios, estando en una plataforma con otro andamio encima, Usar sube (no baja)
      if (PIEZAS[p.tipo].andamio && p.k === pj.k - 1 && andamioEn(c, p.i, p.j, pj.k)) mismaPlanta = false;
      if (mismaPlanta && d < 1.8) lista.push({ c, key, p, d, tipo: puerta ? 'puerta' : fuego ? 'fuego' : 'escalera' });
    }
  }
  return lista.sort((a, b) => a.d - b.d);
}
function interactivoCercano() { return interactivosCercanos()[0] || null; }
// árbol en pie al alcance del hacha (a menos de 1 m de su tronco), en la planta baja
function arbolCercano() {
  if (pj.k !== 0) return null;
  let mejor = null, md = 1.0;
  for (const o of obstaculos) {
    if (!o.arbol || !talaV.enPie(o)) continue;
    const d = Math.hypot(o.x - pj.x, o.z - pj.z) - o.r;
    if (d < md) { md = d; mejor = o; }
  }
  return mejor;
}
// obra a medias al alcance: en tu planta o la de encima (un muro o un tejado que se apoya en lo que pisas)
function obrasCercanas() {
  const lista = [];
  for (const c of mundo.construcciones) for (const [key, p] of c.piezas) {
    if (!p.obra || p.k < pj.k || p.k > pj.k + 1) continue;
    const m = centroMundo(c, p), d = Math.hypot(m.x - pj.x, m.z - pj.z);
    if (d < 2.3) lista.push({ c, key, p, d });
  }
  return lista.sort((a, b) => a.d - b.d);
}
function obraCercana() { return obrasCercanas()[0] || null; }
// Usar junto a una obra: le llevas lo que le falta y, si ya lo tiene todo, te pones a construir (moverse lo para).
// Si la obra está en alto (GDD, «Obras»): lo ligero se lleva a mano subiendo por la escalera (hay que estar en su
// planta) y lo pesado se sube rodándolo por dos varas con una cuerda, de uno en uno (aquí juegas solo: entre dos,
// cuando haya más gente).
const hayQueSubir = (p, m) => plantaObra(p) > 0 && clasePeso(m) !== 'ligero';
function usarObra(o) {
  const { c, key, p } = o;
  const faltan = mundo.faltaEntregar(p);
  let entregado = false, escalera = null, noLlevas = false;
  for (const f of faltan) {
    if (hayQueSubir(p, f.m)) continue;
    const r = accion({ tipo: 'entregar', construccion: c.id, clave: key, material: f.m, cantidad: f.n, desde: pj.k });
    if (r.ok) { entregado = true; continue; }
    if (r.escalera) { escalera = r; continue; }
    // obras con lo que llevas: lo que no llevas encima no se entrega (se coge del arcón de pruebas, en el inventario)
    if (r.faltan) { noLlevas = true; continue; }
    const que = mundo.faltaEntregar(p).map(x => `${x.n} ${tr(MATERIALES[x.m]).toLowerCase()}`).join(', ');
    guardar(); actualizarUI();
    mostrarAviso(`${t('faltanMateriales')} ${t('leFalta')}: ${que}`, true);
    return;
  }
  if (entregado) { guardar(); actualizarUI(); pintarLlevas(); panelInventario.pintar(); }
  const faltaLigero = mundo.faltaEntregar(p).filter(f => !hayQueSubir(p, f.m));
  if (noLlevas && faltaLigero.length) {
    const que = faltaLigero.map(x => `${x.n} ${tr(MATERIALES[x.m]).toLowerCase()}`).join(', ');
    mostrarAviso(`${entregado ? t('materialEntregado') + ' ' : ''}${t('leFalta')}: ${que}. ${t('llevaloEncima')}`, true);
    return;
  }
  estado.talando = null;
  const m = centroMundo(c, p); pj.rot = Math.atan2(m.x - pj.x, m.z - pj.z);
  const pesado = mundo.faltaEntregar(p).find(f => hayQueSubir(p, f.m)) || (p.obra.subida && { m: p.obra.subida.material });
  if (pesado) {
    // con una polea o un polipasto colgado de una viga de esta construcción (a la altura de la obra o más arriba), se
    // usa el que esté más cerca de la obra: de la polea se tira; con el polipasto se da vueltas al torno. Si no hay
    // ninguno, se rueda por dos varas. Lo muy pesado, solo con el polipasto (y hasta que otra persona guía la carga,
    // no pasa de la mitad).
    const dist = (a) => { const u = centroLocal(a), v = centroLocal(p); return Math.hypot(u.lx - v.lx, u.lz - v.lz); };
    let q = clasePeso(pesado.m) === 'muy_pesado' ? null : poleaPara(c, p), qp = polipastoPara(c, p);
    if (q && qp) { if (dist(qp) < dist(q)) q = null; else qp = null; }
    estado.obrando = { c, key, subir: pesado.m, metodo: q ? 'polea' : qp || clasePeso(pesado.m) === 'muy_pesado' ? 'polipasto' : 'varas' };
    if (q) ponerPolea(c, q, p); else if (qp) ponerPolipasto(c, qp, p); else ponerRampa(c, p);
    avisoSubida(p, pesado.m, 0, entregado);
    return;
  }
  if (escalera) {
    const que = mundo.faltaEntregar(p).map(x => `${x.n} ${tr(MATERIALES[x.m]).toLowerCase()}`).join(', ');
    mostrarAviso(`${tr(escalera.motivo)} ${t('leFalta')}: ${que}`, true);
    return;
  }
  estado.obrando = { c, key };
  mostrarAviso(`${entregado ? t('materialEntregado') + ' ' : ''}${t('construyendo')} ${Math.round(100 * p.obra.trabajo / tiempoObra(p.tipo))} %`);
}
function avisoSubida(p, m, progreso, entregado = false, esperaAyuda = false) {
  const quedan = (mundo.faltaEntregar(p).find(f => f.m === m) || { n: 0 }).n;
  const metodo = estado.obrando && estado.obrando.metodo;
  const como = metodo === 'polea' ? t('subiendoPolea') : metodo === 'polipasto' ? t('subiendoPolipasto') : t('subiendoRodando');
  mostrarAviso(`${entregado ? t('materialEntregado') + ' ' : ''}${como} ${tr(MATERIALES[m] || m).toLowerCase()} (${t('quedan')} ${quedan}): ${Math.round(100 * progreso)} %${esperaAyuda ? ' ' + t('esperaGuia') : ''}`);
}
// Las dos varas apoyadas en el borde de la planta de la obra, del lado en el que estás, y el tronco rodando por ellas
// (dos cuerdas lo abrazan y van hasta arriba). Se quita al terminar de subir o al dejarlo.
const MAT_CUERDA = new THREE.MeshLambertMaterial({ color: 0xb59a6a });
let rampa = null;
function quitarRampa() {
  if (!rampa) return;
  escena.remove(rampa.g);
  if (rampa.tipo === 'polipasto') { const o = mallaDe(rampa.c, rampa.qkey); if (o) colgarPolipasto(o, POLIPASTO.yEje - POLIPASTO.bajada, 0.25); }
  rampa = null;
}
const mallaDe = (c, key) => (registroMallas.find(m => m.c === c && m.key === key) || {}).obj;
function ponerRampa(c, p) {
  quitarRampa();
  const m = centroMundo(c, p);
  let nx = pj.x - m.x, nz = pj.z - m.z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
  let ox = 0, oz = 0;
  // en un muro, del lado de la cara (no por el canto), y un poco a un lado para que tú quedes junto a las varas
  if (p.hueco === 'e') {
    const a = c.rot + (p.d === 0 ? 0 : -Math.PI / 2); // a lo largo del muro
    const ax = Math.cos(a), az = -Math.sin(a), lado = Math.sign(nx * -az + nz * ax) || 1;
    nx = -az * lado; nz = ax * lado;
    const lat = (pj.x - m.x) * ax + (pj.z - m.z) * az, s = lat > 0 ? -1 : 1;
    ox = ax * s * 0.5; oz = az * s * 0.5;
  }
  const alto = plantaObra(p) * ALTURA + P.superficieSuelo, largo = alto * 0.85;
  const g = new THREE.Group(); g.name = 'rampa';
  g.position.set(m.x + ox + nx * (largo + 0.2), oyDe(c), m.z + oz + nz * (largo + 0.2));
  g.rotation.y = Math.atan2(-nx, -nz);
  g.add(rampaVaras(alto));
  const tronco = troncoSuelto(); g.add(tronco);
  const cuerdas = [-0.4, 0.4].map(x => { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), MAT_CUERDA); cu.userData.x = x; g.add(cu); return cu; });
  escena.add(g);
  rampa = { g, tronco, cuerdas, alto, largo, t: 0, meta: 0 };
  moverRampa(0);
}
// Subir con la polea: el tronco cuelga de la cuerda, atado por el centro, un poco por fuera de la viga (del lado en
// el que estás), y sube en vertical hasta la planta de la obra; el otro cabo baja de la roldana hasta tus manos.
function cuerdaEntre(cu, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  cu.position.copy(a).addScaledVector(d, 0.5); cu.scale.set(1, Math.max(0.01, d.length()), 1);
  cu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
function ponerPolea(c, q, p) {
  quitarRampa();
  const m = centroMundo(c, q), rot = c.rot + (q.d === 1 ? -Math.PI / 2 : 0);
  const g = new THREE.Group(); g.name = 'polea_subiendo';
  g.position.set(m.x, oyDe(c), m.z); g.rotation.y = rot;
  // lado de la viga en el que estás (z local del grupo)
  const lz = (pj.x - m.x) * Math.sin(rot) + (pj.z - m.z) * Math.cos(rot);
  const lado = Math.sign(lz) || 1;
  const tronco = troncoSuelto(); g.add(tronco);
  const cuerdas = [0, 1].map(() => { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5), MAT_CUERDA); g.add(cu); return cu; });
  escena.add(g);
  const yEje = q.k * ALTURA + POLEA.yEje;
  rampa = { tipo: 'polea', g, tronco, cuerdas, lado, yEje, bajo: 0.35, alto: plantaObra(p) * ALTURA + P.superficieSuelo + 0.3, t: 0, meta: 0 };
  moverRampa(0);
}
// Subir con el polipasto: el torno se pone en el suelo delante de ti, a lo ancho; el tronco (o el sillar) cuelga del
// gancho del motón de abajo, que baja hasta él y sube con él; el cabo de tirar va del motón de arriba al tambor, que
// gira mientras sube. El polipasto es la pieza misma (su motón de abajo se mueve con colgarPolipasto).
function ponerPolipasto(c, q, p) {
  quitarRampa();
  const m = centroMundo(c, q), qkey = clave('q', q.i, q.j, q.k, q.d);
  const g = new THREE.Group(); g.name = 'polipasto_subiendo';
  // el torno, a 0,95 m delante de ti, mirando al polipasto
  const dx = m.x - pj.x, dz = m.z - pj.z, l = Math.hypot(dx, dz) || 1;
  const torno = tornoSuelto();
  torno.position.set(pj.x + dx / l * 0.95, pj.y, pj.z + dz / l * 0.95); torno.rotation.y = Math.atan2(dx, dz);
  g.add(torno);
  // la carga: cuelga bajo la viga, del lado en el que estás
  const rot = c.rot + (q.d === 1 ? -Math.PI / 2 : 0);
  const lz = (pj.x - m.x) * Math.sin(rot) + (pj.z - m.z) * Math.cos(rot), lado = Math.sign(lz) || 1;
  const carga = new THREE.Group(); carga.position.set(m.x, oyDe(c), m.z); carga.rotation.y = rot;
  const tronco = troncoSuelto(); carga.add(tronco);
  const eslinga = [0, 1].map(() => { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1, 5), MAT_CUERDA); carga.add(cu); return cu; });
  g.add(carga);
  escena.add(g);
  const base = q.k * ALTURA;
  rampa = { tipo: 'polipasto', g, c, qkey, torno, carga, tronco, eslinga, lado, base, bajo: 0.35, alto: plantaObra(p) * ALTURA + P.superficieSuelo + 0.3, t: 0, meta: 0, giro: 0 };
  moverRampa(0);
}
// t: 0 al pie, 1 arriba. El tronco va subiendo poco a poco hacia lo que lleva la subida.
function moverRampa(dt) {
  if (!rampa) return;
  rampa.t += Math.max(-1, Math.min(1, rampa.meta - rampa.t)) * Math.min(1, dt * 2.5);
  if (rampa.tipo === 'polipasto') {
    const { tronco, eslinga, base, bajo, alto, t: k, torno, c, qkey } = rampa;
    const fuera = 0.6 * rampa.lado;
    const tope = base + POLIPASTO.yEje - 1.2; // lo más alto que llega la carga, con el motón de abajo junto al de arriba
    const y = bajo + k * (Math.min(alto, tope) - bajo);
    tronco.position.set(0, y, fuera); tronco.rotation.set(0, 0, 0);
    // eslinga: del gancho a los dos lados del tronco
    const gancho = new THREE.Vector3(0, y + 0.5, fuera);
    eslinga.forEach((cu, n) => cuerdaEntre(cu, gancho, new THREE.Vector3((n ? 0.3 : -0.3), y + P.radioTronco, fuera)));
    // el tambor gira con lo que sube
    const tambor = torno.getObjectByName('tambor');
    if (tambor) tambor.rotation.x = -k * 9;
    const o = mallaDe(c, qkey);
    if (o) {
      o.updateWorldMatrix(true, false);
      const ojo = new THREE.Vector3(); tambor.getWorldPosition(ojo); ojo.y += 0.11;
      colgarPolipasto(o, y - base + 0.5 + 0.33, 0, o.worldToLocal(ojo), fuera);
    }
    return;
  }
  if (rampa.tipo === 'polea') {
    const { tronco, cuerdas, lado, yEje, bajo, alto, t: k, g } = rampa, fuera = 0.55 * lado;
    const y = bajo + k * (Math.min(alto, yEje - 0.45) - bajo);
    tronco.position.set(0, y, fuera); tronco.rotation.set(0, 0, 0);
    // cabo del tronco: de la roldana al tronco; cabo de tirar: de la roldana a tus manos
    cuerdaEntre(cuerdas[0], new THREE.Vector3(0, yEje - 0.12, 0.13 * lado), new THREE.Vector3(0, y + P.radioTronco, fuera));
    const manos = g.worldToLocal(new THREE.Vector3(pj.x, pj.y + 1.25, pj.z));
    cuerdaEntre(cuerdas[1], new THREE.Vector3(0, yEje - 0.12, -0.13 * lado), manos);
    return;
  }
  const { tronco, cuerdas, alto, largo, t: k } = rampa, r = P.radioTronco + 0.05;
  const ang = Math.atan2(alto, largo);
  const y = k * alto + r * Math.cos(ang), z = k * largo - r * Math.sin(ang) * 0.2;
  tronco.position.set(0, y, z);
  tronco.rotation.x = -k * Math.hypot(alto, largo) / P.radioTronco; // rueda
  for (const cu of cuerdas) {
    const a = new THREE.Vector3(cu.userData.x, y + 0.05, z), b = new THREE.Vector3(cu.userData.x, alto + 0.05, largo + 0.3);
    const d = new THREE.Vector3().subVectors(b, a);
    cu.position.copy(a).addScaledVector(d, 0.5); cu.scale.set(1, Math.max(0.01, d.length()), 1);
    cu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
}
// cada medio segundo construyendo se manda un rato de trabajo. Cuenta el tiempo de reloj de verdad, no el del
// fotograma (que se recorta a 0,05 s): con pocos fotogramas por segundo la obra no debe ir más lenta.
function pasoObra() {
  const o = estado.obrando;
  if (!o) return;
  const ahora = performance.now();
  if (o.desde === undefined) o.desde = ahora;
  const seg = (ahora - o.desde) / 1000;
  if (seg < 0.5) return;
  if (o.subir) { // subiendo un tronco por las varas
    const r = accion({ tipo: 'subir', construccion: o.c.id, clave: o.key, material: o.subir, segundos: Math.min(seg, MAX_RATO), metodo: o.metodo || 'varas' });
    o.desde = ahora;
    if (!r.ok) { estado.obrando = null; quitarRampa(); mostrarAviso(tr(r.motivo), true); return; }
    guardar(); actualizarUI();
    const p = o.c.piezas.get(o.key);
    if (rampa) rampa.meta = r.progreso;
    if (r.subido) {
      if (rampa) { rampa.t = 0; rampa.meta = 0; }
      if (!mundo.faltaEntregar(p).some(f => f.m === o.subir)) { estado.obrando = null; quitarRampa(); usarObra({ c: o.c, key: o.key, p }); return; }
    }
    avisoSubida(p, o.subir, r.subido ? 0 : r.progreso, false, !!r.esperaAyuda);
    return;
  }
  const r = accion({ tipo: 'trabajar', construccion: o.c.id, clave: o.key, segundos: Math.min(seg, MAX_RATO) });
  o.desde = ahora;
  if (!r.ok) { estado.obrando = null; mostrarAviso(tr(r.motivo), true); return; }
  guardar();
  if (r.terminada) {
    estado.obrando = null; reconstruir();
    mostrarAviso(`${tr(PIEZAS[o.c.piezas.get(o.key).tipo].nombre)}: ${t('obraTerminada')}`);
    return;
  }
  // la pieza se va viendo menos tenue a cada cuarto de la obra
  const cuarto = Math.floor(4 * r.progreso);
  if (cuarto !== o.cuarto) { o.cuarto = cuarto; rehacerPieza(o.c.id, o.key); }
  mostrarAviso(`${t('construyendo')} ${Math.round(100 * r.progreso)} %`);
}
// la estación de fabricar que tienes delante (a 1,8 m como mucho), la más cercana
const USAR_ESTACION = 1.8;
function estacionParaUsar() {
  return Object.values(fabCliente.estaciones).filter(e => ESTACIONES[e.tipo] && Math.hypot(e.x - pj.x, e.z - pj.z) <= USAR_ESTACION)
    .sort((a, b) => Math.hypot(a.x - pj.x, a.z - pj.z) - Math.hypot(b.x - pj.x, b.z - pj.z))[0] || null;
}
// Los puestos de trabajo como obra (valravnx, 6 nov): con Usar delante del marco se le lleva lo que le falta (de lo que
// llevas y del suelo a tu lado) y, con todo, se trabaja en él a ratos (como en las obras) hasta levantarlo. En línea
// cada rato espera la respuesta del servidor antes de mandar el siguiente.
const PONER_PUESTO = 2.5; // m: el marco se pone a tu lado (el servidor da 3)
const costeTxt = f => Object.entries(f).map(([m, n]) => `${n} ${tr(CATALOGO[m].nombre).toLowerCase()}`).join(', ');
function usarPuesto(e) {
  const def = ESTACIONES[e.tipo], falta = {};
  for (const [m, n] of Object.entries(def.coste)) { const q = n - ((e.obra && e.obra.entregado[m]) || 0); if (q > 0) falta[m] = q; }
  pj.rot = Math.atan2(e.x - pj.x, e.z - pj.z);
  const trabajar = (dicho = '') => { estado.talando = null; estado.obrandoPuesto = { id: e.id, desde: performance.now(), esperando: false }; mostrarAviso(`${dicho}${t('construyendo')} ${Math.round(100 * ((e.obra && e.obra.trabajo) || 0) / def.trabajo)} %`); };
  if (!Object.keys(falta).length) { trabajar(); return; }
  hacerFabricacion({ tipo: 'entregar_estacion', estacion: e.id, x: pj.x, z: pj.z }, (r) => {
    if (!r.ok) { mostrarAviso(`${tr(def.nombre)}: ${t('leFalta')}: ${costeTxt(falta)}. ${t('llevaloEncima')}`, true); return; }
    const queda = r.falta || {};
    if (Object.keys(queda).length) { mostrarAviso(`${t('materialEntregado')} ${t('leFalta')}: ${costeTxt(queda)}. ${t('llevaloEncima')}`, true); return; }
    trabajar(t('materialEntregado') + ' ');
  });
}
function pasoPuesto() {
  const o = estado.obrandoPuesto;
  if (!o || o.esperando) return;
  const ahora = performance.now(), seg = (ahora - o.desde) / 1000;
  if (seg < 0.5) return;
  const e = fabCliente.estaciones[o.id];
  if (!e || !e.obra) { estado.obrandoPuesto = null; return; }
  o.esperando = true; o.desde = ahora;
  hacerFabricacion({ tipo: 'trabajar_estacion', estacion: o.id, segundos: +Math.min(seg, MAX_RATO_ESTACION).toFixed(3), x: pj.x, z: pj.z }, (r) => {
    if (estado.obrandoPuesto !== o) return;
    o.esperando = false;
    if (!r.ok) { estado.obrandoPuesto = null; mostrarAviso(tr(r.motivo), true); return; }
    if (r.terminada) { estado.obrandoPuesto = null; mostrarAviso(tr('Puesto terminado ({e}): ya se puede usar.', { e: tr(ESTACIONES[e.tipo].nombre) })); return; }
    mostrarAviso(`${t('construyendo')} ${Math.round(100 * r.progreso)} %`);
  });
}
// Reparar en su puesto (10 nov): lo de la mano de, con lo depositado en el puesto e; lo hace el servidor
function repararEn(e, de) {
  hacerFabricacion({ tipo: 'reparar', estacion: e.id, de, x: pj.x, z: pj.z }, (r) => {
    if (!r.ok) {
      const f = r.faltan && Object.entries(r.faltan).map(([t, n]) => `${n} ${tr(CATALOGO[t] ? CATALOGO[t].nombre : t).toLowerCase()}`).join(', ');
      mostrarAviso(f ? tr('Falta dejar en el puesto: {c}.', { c: f }) : tr(r.motivo), true); return;
    }
    const rp = r.reparado;
    mostrarAviso(rp ? tr('Reparado: {c}. Le quedan {q} usos de {v}.', { c: tr(CATALOGO[rp.objeto].nombre).toLowerCase(), q: rp.vida - rp.usado, v: rp.vida }) : tr('Reparado.'));
  });
}
function usarFuego(e, a) {
  hacerFabricacion({ ...a, estacion: e.id, x: pj.x, z: pj.z }, (r) => {
    mostrarAviso(!r.ok ? tr(r.motivo) : r.avivada ? tr('Avivas el fuego: vuelve la llama.') : a.tipo === 'encender_fuego' ? tr('El fuego prende.') : a.tipo === 'brasas_fuego' ? tr('Cubres el fuego con su ceniza: queda en brasas.') : tr('Echas al fuego: 1 {c}.', { c: tr(CATALOGO[a.objeto].nombre).toLowerCase() }), !r.ok);
  });
}
// La cama ligada (P4; src/logica/fabricacion.js): ligar la que tienes delante (una por personaje: la de antes deja de
// serlo) y dormir en la tuya. Dormido, te tumbas en ella y el cansancio baja deprisa (lo lleva el servidor); al moverte,
// te levantas.
const esMiCama = e => !!(e.ligadas && e.ligadas.includes(yoAutor()));
function ligarCama(e) {
  hacerFabricacion({ tipo: 'ligar_cama', estacion: e.id, x: pj.x, z: pj.z }, (r) => {
    mostrarAviso(r.ok ? tr('{e}: ya es tu cama. Aquí reaparecerás, y aquí puedes dormir.', { e: tr(ESTACIONES[e.tipo].nombre) }) : tr(r.motivo), !r.ok);
  });
}
function dormir(e) {
  hacerFabricacion({ tipo: 'dormir', estacion: e.id, x: pj.x, z: pj.z }, (r) => {
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    estado.talando = null; estado.obrando = null; estado.obrandoPuesto = null;
    // tumbado en su sitio de la cama, a lo largo (el modelo va a lo largo de X: el cuerpo, con la cabeza a la cabecera)
    const g = Number.isFinite(e.giro) ? e.giro : 0, s = SITIO_DORMIR[e.tipo] || { x: 0, z: 0, y: 0 };
    pj.x = e.x + s.x * Math.cos(g) + s.z * Math.sin(g); pj.z = e.z - s.x * Math.sin(g) + s.z * Math.cos(g); pj.rot = g + Math.PI / 2;
    estado.durmiendo = { id: e.id, alto: s.y };
    jugador.durmiendo = true;
    mostrarAviso(tr('Duermes. Muévete para levantarte.'));
  });
}
function despertar() {
  if (!estado.durmiendo) return;
  estado.durmiendo = null; jugador.durmiendo = false;
}
// Sentarse en el suelo a descansar (P4, 8 nov; src/logica/necesidades.js: sentado, el cansancio baja más deprisa que de
// pie). Z en el PC, o el botón de la ficha del cansancio (el círculo gris). Lo dice la presencia (anim «sentado») y el
// servidor lo mira; al moverte, te levantas. No con algo grande en las manos o al hombro, ni con el arma sacada, ni en
// el agua, ni dormido.
function sentarse() {
  if (estado.sentado) { levantarse(); return; }
  if (estado.durmiendo) return;
  if (jugador.cargaDos || jugador.alHombro || jugador.arrastra || jugador.empuja) { mostrarAviso(tr('Suelta lo que llevas para sentarte.'), true); return; }
  if (document.body.classList.contains('combate')) { mostrarAviso(tr('Guarda el arma para sentarte.'), true); return; }
  if (nado.modo && nado.modo !== 'tierra') { mostrarAviso(tr('En el agua no puedes sentarte.'), true); return; }
  estado.talando = null; estado.obrando = null; estado.obrandoPuesto = null;
  estado.sentado = true; jugador.sentado = true;
  mostrarAviso(tr('Te sientas a descansar. Muévete para levantarte.'));
  avisosNec.pintar(necesidades);
}
function levantarse() {
  if (!estado.sentado) return;
  estado.sentado = false; jugador.sentado = false;
  avisosNec.pintar(necesidades);
}
function quitarPuesto(e) {
  hacerFabricacion({ tipo: 'quitar_estacion', estacion: e.id, x: pj.x, z: pj.z }, (r) => {
    mostrarAviso(r.ok ? tr('Marco quitado: lo que tenía, en el suelo.') : tr(r.motivo), !r.ok);
  });
}
// La acción según lo que tienes delante (estudio de la interfaz del 7 nov, octava versión; tarea de P4b): lo que haría
// Usar ahora, sin hacerlo, con su verbo, la imagen de la cosa y dónde está (para el aro del suelo y la etiqueta, y para
// el botón de acción del móvil). Sigue el mismo orden que Usar ha tenido siempre; usar() hace lo que sale de aquí.
// Devuelve { texto, icono (un objeto del catálogo, una estación «est_…» o un glifo del kit «g_…»), pos, y?, alto?,
// hacer, sub? (una línea más: lo que le falta a la obra), barra? (0–1), prog? (0–1, lo que llevas talado), apagada? }
const ICONO_RECOGER = (rc) => RECOLECTABLES[rc.tipo].da || rc.tipo;
function hachaQueLlevas() { const h = hachaEnMano(inventario()); return h ? h.tipo : 'hacha_piedra'; }
function progresoGolpes(a) { return a && a.prog && a.prog.total ? Math.min(1, a.prog.hechos / a.prog.total) : 0; }
function accionObra(o) {
  const { c, p } = o, def = PIEZAS[p.tipo];
  const faltan = mundo.faltaEntregar(p).filter(f => !hayQueSubir(p, f.m));
  const A = { texto: tr('Obra: {p}', { p: tr(def.nombre) }), icono: 'g_construir', pos: centroMundo(c, p), y: oyDe(c) + p.k * ALTURA, alto: 1.2, hacer: () => usarObra(o) };
  const f = faltan[0];
  if (f) {
    const total = (def.coste && def.coste[f.m]) || f.n, puestos = Math.max(0, total - f.n);
    A.sub = tr('{m}: {e} de {t}', { m: tr(MATERIALES[f.m]), e: puestos, t: total }) + (faltan.length > 1 ? ' · ' + tr('y más') : '');
    A.barra = total ? puestos / total : 0;
  } else A.sub = tr('Con todo: a trabajar');
  return A;
}
function accionPrincipal() {
  const A = (texto, icono, pos, hacer, extra = {}) => ({ texto, icono, pos, hacer, ...extra });
  const ob = obraCercana();
  const it = interactivoCercano();
  const yo = { x: pj.x, z: pj.z };
  // al pie de un andamio, con la obra más arriba que tú, Usar sube al andamio (desde allí se le lleva el material)
  const subirAndamio = it && PIEZAS[it.p.tipo].andamio && it.p.k === pj.k && ob && ob.p.k > pj.k;
  if (ob && !subirAndamio) return accionObra(ob);
  // con sed (desde su aviso) y agua al lado, Usar bebe antes que nada (lo demás, desde el menú del clic derecho)
  if (!it && necesidades && necesidades.sed >= AVISO_NEC && aguaAlLado()) return A(tr('Beber agua'), 'agua', yo, beber, { alto: 0.2 });
  // con la lasca encima y una liebre cazada a tus pies, despiezarla (9 nov)
  if (!it && pj.k === 0 && inventario().cuantos('lasca_silex') > 0 && liebreAlLado()) { const l = liebreAlLado(); return A(tr('Despiezar la liebre'), 'liebre', l, despiezar, { alto: 0.2 }); }
  // con un hacha en la mano, junto a un árbol, se tala antes que recoger lo que haya al lado
  if (!it && hachaEnMano(inventario()) && arbolCercano()) { const a = arbolCercano(); return A(tr('Talar el árbol'), hachaQueLlevas(), a, () => empezarTala(a), { alto: 3, prog: estado.talando === a ? progresoGolpes(a) : 0 }); }
  // con el mazo de piedra en la mano, junto a una roca mediana, se rompe a golpes (8 nov)
  if (!it && pj.k === 0 && mazoEnMano(inventario()) && rocaCercana()) { const rq = rocaCercana(); return A(tr('Romper la roca'), mazoEnMano(inventario()).tipo, rq, () => empezarRotura(rq), { alto: 0.7, prog: estado.talando && estado.talando.rotura && estado.talando.rotura.id === rq.id ? progresoGolpes(estado.talando) : 0 }); }
  // con un hacha en la mano, junto a un tronco tumbado, se tronza (el largo) o se parte (el corto)
  if (!it && hachaEnMano(inventario()) && troncoCercano()) { const t0 = troncoCercano(); return A(tr('Trocear: {c}', { c: tr(CATALOGO[t0.cosa.tipo].nombre) }), t0.cosa.tipo, t0, () => empezarTroceo(t0), { alto: 0.4 }); }
  // arrastrando la rastra, Usar la suelta; junto a una parada, con algo que va en ella en las manos o al hombro, se
  // carga, y si no, se engancha (se descarga y se carga del suelo desde el menú del clic derecho)
  if (!it && pj.k === 0 && miRastra()) { const m = miRastra(); return A(tr(segun(m, 'Soltar la rastra', 'Aparcar la carretilla')), m.cosa.tipo, sitiosRastra[m.id] || yo, soltarRastra, { alto: 0.4 }); }
  if (!it && pj.k === 0 && rastraCercana()) {
    const o = rastraCercana(), de = paraCargar(o.cosa.tipo);
    if (de) return A(tr(segun(o, 'Cargar en la rastra: {c}', 'Cargar en la carretilla: {c}'), { c: tr(CATALOGO[inventario().lugares[de].tipo].nombre) }), inventario().lugares[de].tipo, o, () => cargarRastra(o, { de }), { alto: 0.4 });
    return A(tr(segun(o, 'Arrastrar la rastra ({c})', 'Empujar la carretilla ({c})'), { c: nombreCarga(o.cosa.carga) }), o.cosa.tipo, o, () => engancharRastra(o), { alto: 0.4 });
  }
  // delante de una estación de fabricar, Usar abre el panel en su pestaña, con lo que tiene encima (estudio del panel,
  // valravnx, 6 nov)
  const est = !it && pj.k === 0 ? estacionParaUsar() : null;
  if (est && est.obra) return A(tr('Obra: {p}', { p: tr(ESTACIONES[est.tipo].nombre) }), 'est_' + est.tipo, est, () => usarPuesto(est), { alto: 0.6 });
  // delante de una cama terminada: ligarla si no es la tuya; si lo es, dormir en ella
  if (est && esCama(est.tipo)) return esMiCama(est) ? A(tr('Dormir: {e}', { e: tr(ESTACIONES[est.tipo].nombre) }), 'est_' + est.tipo, est, () => dormir(est), { alto: 0.6 })
    : A(tr('Ligar tu cama: {e}', { e: tr(ESTACIONES[est.tipo].nombre) }), 'est_' + est.tipo, est, () => ligarCama(est), { alto: 0.6 });
  if (est && panelFabricar) return A(tr(esAlmacen(est.tipo) ? 'Guardar y sacar: {e}' : 'Usar: {e}', { e: tr(ESTACIONES[est.tipo].nombre) }), 'est_' + est.tipo, est, () => panelFabricar.abrirEstacion(est.id), { alto: 0.6 });
  if (!it && pj.k === 0) {
    // junto a ramas caídas, piedras, sílex u ortigas y hierba larga, se recogen (y van al inventario por huecos)
    const so = sueloObjetos.cercanos(pj.x, pj.z).find(o => !esVehiculo(o.cosa.tipo)); // lo que hay en el suelo, antes que lo que se recoge
    if (so) return A(tr('Coger del suelo: {n} × {c}', { n: so.cosa.n, c: tr(CATALOGO[so.cosa.tipo].nombre) }), so.cosa.tipo, so, () => cogerDelSuelo(so), { alto: 0.3 });
    const rc = recoleccion.cercano(pj.x, pj.z);
    if (rc) return A(verboRecoger(rc), ICONO_RECOGER(rc), rc, () => recoger(rc), { alto: 0.6 });
    // junto a un matorral o un arbusto de bayas (ya sin bayas), con un hacha o una lasca encima, se desbroza (8 nov)
    const db = desbrozableCercano(), con = conQueDesbroza(inventario());
    if (db && con) return A(tr('Desbrozar: {c}', { c: tr(RECOLECTABLES[db.tipo].nombre).toLowerCase() }), con, db, () => empezarDesbroce(db), { alto: 0.8, prog: estado.talando && estado.talando.desbroce && estado.talando.desbroce.id === db.id ? estado.talando.dados / estado.talando.golpes : 0 });
  }
  if (!it) {
    // junto a un árbol, se tala con un hacha en la mano: un golpe cada poco (paso → golpeTala) hasta que cae
    const a = arbolCercano();
    if (a) {
      // sin hacha en la mano, lo que da el árbol en pie (8 nov): su resina si ya está, la corteza o sangrarlo
      if (!hachaEnMano(inventario())) {
        const u = talaV.usos(a), inv = inventario(), con = l => l.find(t => inv.cuantos(t) > 0);
        if (u.resina === 'lista') return A(tr('Coger la resina'), 'resina', a, () => usarArbol(a, 'sangrar'), { alto: 1.2 });
        if (u.descortezar && con(DESCORTEZAR_CON)) return A(tr('Descortezar el árbol'), con(DESCORTEZAR_CON), a, () => usarArbol(a, 'descortezar'), { alto: 1.4 });
        if (u.sangrar && con(SANGRAR_CON)) return A(tr('Sangrar el árbol (resina)'), con(SANGRAR_CON), a, () => usarArbol(a, 'sangrar'), { alto: 1.2 });
      }
      return A(tr('Talar el árbol'), 'hacha_piedra', a, () => mostrarAviso(tr('Necesitas un hacha en la mano para talar.'), true), { alto: 3, apagada: true, sub: tr('Necesitas un hacha en la mano para talar.') });
    }
    if (aguaAlLado()) return A(tr('Beber agua'), 'agua', yo, beber, { alto: 0.2 });   // junto al agua, sin otra cosa que usar, se bebe
    // con hambre (desde su aviso) y algo de comer encima, sin otra cosa que usar, se come
    if (necesidades && necesidades.hambre >= AVISO_NEC && comidaQueLlevas().length) { const c = comidaQueLlevas()[0]; return A(tr('Comer: {c}', { c: tr(CATALOGO[c].nombre).toLowerCase() }), c, yo, () => comer(c), { alto: 1.2 }); }
    return null;
  }
  return A(textoInteractivo(it), it.tipo === 'fuego' ? 'est_hogar' : 'g_colocar', posInteractivo(it).pos, () => usarInteractivo(it), { y: posInteractivo(it).y, alto: 1 });
}
function usar() {
  const a = accionPrincipal();
  if (!a) { mostrarAviso(t('nadaQueUsar')); return; }
  a.hacer();
}
// los juncos se cortan y el barro se cava (con su herramienta: src/logica/recoleccion.js); lo demás, se recoge
const verboRecoger = rc => ({ cortar: tr('Cortar: {c}', { c: tr(RECOLECTABLES[rc.tipo].nombre) }), cavar: tr('Cavar: {c}', { c: tr(RECOLECTABLES[rc.tipo].nombre) }) })[RECOLECTABLES[rc.tipo].accion] || tr('Recoger: {c}', { c: tr(nombreDe(rc.tipo)) });
function textoInteractivo(it) {
  const p = it.p, n = tr(PIEZAS[p.tipo].nombre);
  return it.tipo === 'fuego' ? (p.apagado ? tr('Encender: {p}', { p: n }) : tr('Apagar: {p}', { p: n }))
    : it.tipo === 'puerta' ? (p.abierta ? tr('Cerrar: {p}', { p: n }) : tr('Abrir: {p}', { p: n }))
    : (p.k === pj.k && !(adarveDeEscalera(it.c, p, false) && pj.k !== 0) ? tr('Subir: {p}', { p: n }) : tr('Bajar: {p}', { p: n }));
}
function posInteractivo(it) { const cl = centroLocal(it.p); return { pos: localAMundo(it.c, cl.lx, cl.lz), y: oyDe(it.c) + it.p.k * ALTURA }; }
// Clic derecho en lo que quieras usar (valravnx, 31 oct: «poder hacer clic derecho y seleccionar qué quieres usar si
// es que hay varias opciones en la zona… clicando con clic derecho en lo que quieras usar: pilla lo que toques y muy
// cercanos»). En el móvil, dejando el dedo quieto encima. Sale un menú, junto al puntero, con lo que está al alcance
// (como Usar) y además bajo el puntero o muy cerca de él; cada cosa hace lo mismo que haría Usar con ella. Usar a
// secas (F o el botón) sigue haciendo lo primero de siempre.
function opcionesUsar() {
  const ops = [], nombrePieza = p => tr(PIEZAS[p.tipo].nombre);
  for (const o of obrasCercanas()) ops.push({ texto: tr('Obra: {p}', { p: nombrePieza(o.p) }), pos: centroMundo(o.c, o.p), y: oyDe(o.c) + o.p.k * ALTURA, hacer: () => usarObra(o) });
  for (const it of interactivosCercanos()) { const q = posInteractivo(it); ops.push({ texto: textoInteractivo(it), pos: q.pos, y: q.y, hacer: () => usarInteractivo(it) }); }
  for (const e of Object.values(fabCliente.estaciones)) if (ESTACIONES[e.tipo] && pj.k === 0 && Math.hypot(e.x - pj.x, e.z - pj.z) <= USAR_ESTACION) {
    if (e.obra) {
      ops.push({ texto: tr('Obra: {p}', { p: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => usarPuesto(e) });
      ops.push({ texto: tr('Quitar el marco: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => quitarPuesto(e) });
    } else if (esCama(e.tipo)) {
      // las camas (P4): ligarla (donde reapareces) y dormir en la tuya
      const mia = esMiCama(e);
      if (!mia) ops.push({ texto: tr('Ligar tu cama: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => ligarCama(e) });
      else ops.push({ texto: tr('Dormir: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => dormir(e) });
    } else {
      ops.push({ texto: tr(esAlmacen(e.tipo) ? 'Guardar y sacar: {e}' : 'Usar: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => panelFabricar && panelFabricar.abrirEstacion(e.id) });
      // reparar lo que llevas en la mano, gastado, en su puesto (10 nov; src/logica/desgaste.js): con lo depositado en él
      for (const l of ['mano:der', 'mano:izq']) {
        const c = inventario().lugares[l], d = c && desgasteDe(c);
        if (d && d.usado && REPARAR[c.tipo] && REPARAR[c.tipo].uso === ESTACIONES[e.tipo].uso) ops.push({ texto: tr('Reparar: {c}', { c: tr(CATALOGO[c.tipo].nombre).toLowerCase() }), pos: e, alto: 0.6, hacer: () => repararEn(e, l) });
      }
      // la hoguera: encenderla (con yesca y el taladro de fuego) y echarle una rama o una leña de lo que llevas
      if (ESTACIONES[e.tipo].fuego && e.fuego) {
        const st = estadoFuego(e.fuego, Date.now()), inv = inventario();
        if (st.brasas) ops.push({ texto: tr('Avivar: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => usarFuego(e, { tipo: 'encender_fuego' }) });
        else if (!st.encendida) ops.push({ texto: tr('Encender: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => usarFuego(e, { tipo: 'encender_fuego' }) });
        else if (COMO_FUEGO[e.tipo] && COMO_FUEGO[e.tipo].brasas) ops.push({ texto: tr('Dejar en brasas: {e}', { e: tr(ESTACIONES[e.tipo].nombre) }), pos: e, alto: 0.6, hacer: () => usarFuego(e, { tipo: 'brasas_fuego' }) });
        for (const t of ['rama', 'lena']) if (inv.cuantos(t)) ops.push({ texto: tr('Echar al fuego: 1 {c}', { c: tr(CATALOGO[t].nombre).toLowerCase() }), pos: e, alto: 0.6, hacer: () => usarFuego(e, { tipo: 'echar_fuego', objeto: t }) });
      }
    }
  }
  const a = arbolCercano();
  if (a) ops.push({ texto: tr('Talar el árbol'), pos: a, alto: 3, hacer: () => hachaEnMano(inventario()) ? empezarTala(a) : mostrarAviso(tr('Necesitas un hacha en la mano para talar.'), true) });
  if (a) {   // lo que da el árbol en pie (8 nov): la corteza y, de los pinos y los abetos, la resina
    const u = talaV.usos(a);
    if (u.descortezar) ops.push({ texto: tr('Descortezar el árbol'), pos: a, alto: 1.4, hacer: () => usarArbol(a, 'descortezar') });
    if (u.sangrar) ops.push({ texto: tr('Sangrar el árbol (resina)'), pos: a, alto: 1.2, hacer: () => usarArbol(a, 'sangrar') });
    if (u.resina === 'lista') ops.push({ texto: tr('Coger la resina'), pos: a, alto: 1.2, hacer: () => usarArbol(a, 'sangrar') });
  }
  if (pj.k === 0) {
    const tronco = troncoCercano();
    const rq = rocaCercana();
    if (rq) ops.push({ texto: tr('Romper la roca'), pos: rq, alto: 0.6, hacer: () => empezarRotura(rq) });
    if (tronco && hachaEnMano(inventario())) ops.push({ texto: tr('Trocear: {c}', { c: tr(CATALOGO[tronco.cosa.tipo].nombre) }), pos: tronco, hacer: () => empezarTroceo(tronco) });
    for (const op of opcionesRastra()) ops.push(op);
    for (const so of sueloObjetos.cercanos(pj.x, pj.z)) if (!esVehiculo(so.cosa.tipo)) ops.push({ texto: tr('Coger del suelo: {n} × {c}', { n: so.cosa.n, c: tr(CATALOGO[so.cosa.tipo].nombre) }), pos: so, hacer: () => cogerDelSuelo(so) });
    for (const rc of recoleccion.cercanos(pj.x, pj.z)) ops.push({ texto: verboRecoger(rc), pos: rc, alto: 0.6, hacer: () => recoger(rc) });
    const db = desbrozableCercano();
    if (db) ops.push({ texto: tr('Desbrozar: {c}', { c: tr(RECOLECTABLES[db.tipo].nombre).toLowerCase() }), pos: db, alto: 0.6, hacer: () => empezarDesbroce(db) });
  }
  // la liebre cazada a tus pies: despiezarla (con la lasca; sin ella, el servidor dice qué falta) (9 nov)
  if (pj.k === 0 && liebreAlLado()) ops.push({ texto: tr('Despiezar la liebre'), pos: liebreAlLado(), alto: 0.2, hacer: despiezar });
  // lo que llevas de comer (P4)
  for (const t of comidaQueLlevas()) ops.push({ texto: tr('Comer: {c}', { c: tr(CATALOGO[t].nombre).toLowerCase() }), pos: { x: pj.x, z: pj.z }, alto: 1.2, hacer: () => comer(t) });
  // el agua de al lado: beber con las manos (P4)
  if (aguaAlLado()) ops.push({ texto: tr('Beber agua'), pos: { x: pj.x, z: pj.z }, alto: 0.2, hacer: beber });
  // quien tienes al lado (a menos de 3 m): dejarle construir en tu tierra, o quitárselo (valravnx, 4 nov: la pareja)
  if (enLinea && miMojon()) for (const [autor, r] of enLinea.remotos) {
    if (Math.hypot(r.x - pj.x, r.z - pj.z) > 3) continue;
    const ya = mundo.invitadosDe(yoAutor()).includes(autor);
    ops.push({ texto: ya ? tr('Quitarle de tu tierra') : tr('Invitar a tu tierra'), pos: { x: r.x, z: r.z }, alto: 1.8, hacer: () => invitarATierra(autor, !ya) });
  }
  return ops;
}
function invitarATierra(autor, si) {
  const r = accion({ tipo: si ? 'invitar' : 'desinvitar', a: autor });
  mostrarAviso(r.ok ? tr(si ? 'Ya puede construir en tu tierra.' : 'Ya no puede construir en tu tierra.') : tr(r.motivo), !r.ok);
}
const menuUsar = $('menuUsar');
function cerrarMenuUsar() { menuUsar.hidden = true; menuUsar.innerHTML = ''; }
const CERCA_DEL_PUNTERO = 1.3, PX_DEL_PUNTERO = 48;
// lo que hay bajo el puntero (cx, cy) o muy cerca: a menos de 1,3 m del punto que toca (una pieza o el suelo) o, en la
// pantalla, a menos de 48 px de la cosa (para lo que tiene altura, como un árbol, que el rayo atraviesa por la copa)
function opcionesEn(cx, cy) {
  const hit = piezaBajo(cx, cy), suelo = hit ? null : sueloBajoRayo(rayoDesde(cx, cy).ray);
  const punto = hit ? hit.point : suelo;
  const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3();
  const enPantalla = (x, y, z) => { v.set(x, y, z).project(camara); return v.z < 1 ? Math.hypot((v.x + 1) / 2 * r.width + r.left - cx, (1 - v.y) / 2 * r.height + r.top - cy) : Infinity; };
  return opcionesUsar().map(op => {
    const y0 = op.y ?? sueloEn(op.pos.x, op.pos.z);
    const dMundo = punto ? Math.hypot(op.pos.x - punto.x, op.pos.z - punto.z) : Infinity;
    const dPx = Math.min(...[0, 0.5, 1].map(f => enPantalla(op.pos.x, y0 + f * (op.alto ?? 1.6), op.pos.z)));
    return { op, d: Math.min(dMundo / CERCA_DEL_PUNTERO, dPx / PX_DEL_PUNTERO) };
  }).filter(o => o.d <= 1).sort((a, b) => a.d - b.d).map(o => o.op);
}
let ignorarClicMenu = 0;
function abrirMenuUsar(cx, cy, tactil = false) {
  const ops = window.__menuUsarSinPuntero ? opcionesUsar() : opcionesEn(cx, cy);  // __menuUsarSinPuntero: solo para comprobar que la prueba falla
  if (!ops.length) { cerrarMenuUsar(); mostrarAviso(tr('Ahí no hay nada que usar a tu alcance.')); return; }
  menuUsar.innerHTML = '';
  for (const op of ops.slice(0, 8)) {
    const b = document.createElement('button');
    b.className = 'placa';
    b.innerHTML = `${op.icono && !window.__sinImagenes ? `<img src="${urlIcono(op.icono)}" alt="" onerror="this.style.visibility='hidden'">` : '<img alt="" style="visibility:hidden">'}<span>${esc(op.texto)}</span>`;
    // el clic que el navegador manda al levantar el dedo tras dejarlo quieto no elige nada (caería en el menú)
    b.onclick = (e) => { e.stopPropagation(); if (performance.now() < ignorarClicMenu) return; cerrarMenuUsar(); op.hacer(); };
    menuUsar.appendChild(b);
  }
  menuUsar.hidden = false;
  menuUsar.dataset.x = pj.x; menuUsar.dataset.z = pj.z;
  // junto al puntero, sin salirse de la pantalla
  const w = menuUsar.offsetWidth, h = menuUsar.offsetHeight;
  menuUsar.style.left = Math.max(6, Math.min(innerWidth - w - 6, cx + 10)) + 'px';
  // con el dedo, por encima de él, para no taparlo
  menuUsar.style.top = Math.max(6, Math.min(innerHeight - h - 6, tactil ? cy - h - 40 : cy - 10)) + 'px';
}
// puerta, trampilla, chimenea, escalera o andamio
function usarInteractivo(it) {
  if (it.tipo === 'fuego') { // chimenea: encender o apagar el fuego (solo se rehace ella)
    const r = accion({ tipo: 'usar', construccion: it.c.id, clave: it.key });
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    guardar(); rehacerPieza(it.c.id, it.key);
    mostrarAviso(r.encendido ? t('fuegoEncendido') : t('fuegoApagado'));
    return;
  }
  if (it.tipo === 'puerta') {
    if (it.p.hueco === 't' && it.p.abierta && dentroDeCasilla(it.c, it.p)) { mostrarAviso(t('apartateTrampilla'), true); return; }
    const r = accion({ tipo: 'usar', construccion: it.c.id, clave: it.key });
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    // solo cambia esa hoja: se rehace esa pieza y nada más (rehacerlo todo daba tirones; valravnx, 28 oct)
    guardar(); rehacerPieza(it.c.id, it.key);
    mostrarAviso(it.p.abierta ? t('abierta') : t('cerrada'));
    return;
  }
  // escalera: subir si estás en su planta, bajar si estás encima
  const { c, p } = it;
  if (PIEZAS[p.tipo].andamio) { usarAndamio(c, p); return; }
  const adv = adarveDeEscalera(c, p, false);
  if (adv && pj.k === 0) { // escalera de mano apoyada en un adarve: subes a su piso, junto a la escalera
    const le = centroLocal(p), la = centroLocal(adv);
    const m = localAMundo(c, la.lx + (le.lx - la.lx) * 0.3, la.lz + (le.lz - la.lz) * 0.3);
    pj.x = m.x; pj.z = m.z; pj.k = 1;
    mostrarAviso(t('subesAdarve'));
    return;
  }
  if (pj.k === p.k) {
    const destinos = [[p.i, p.j], [p.i + 1, p.j], [p.i - 1, p.j], [p.i, p.j + 1], [p.i, p.j - 1]];
    for (const [i, j] of destinos) {
      if (c.piezas.has(clave('f', i, j, p.k + 1)) || andamioEn(c, i, j, p.k)) {
        // quedas en el suelo de arriba, pero pegado a la escalera para poder volver a bajar
        const le = centroLocal(p);
        const lx = (i + 0.5) * MODULO + (le.lx - (i + 0.5) * MODULO) * 0.4;
        const lz = (j + 0.5) * MODULO + (le.lz - (j + 0.5) * MODULO) * 0.4;
        const m = localAMundo(c, lx, lz);
        pj.x = m.x; pj.z = m.z; pj.k = p.k + 1;
        mostrarAviso(`${t('subes')} ${pj.k}`);
        return;
      }
    }
    mostrarAviso(t('sinSueloArriba'), true);
  } else {
    const m = localAMundo(c, centroLocal(p).lx, centroLocal(p).lz);
    pj.x = m.x; pj.z = m.z; pj.k = p.k;
    mostrarAviso(`${t('bajas')} ${pj.k}`);
  }
}

// Beber del río con las manos (P4; src/logica/necesidades.js): con agua a tu lado (río, lago o mar) y en el suelo. En
// línea, el trago lo da el servidor (mira dónde te tiene y si hay agua ahí); sin servidor (las pruebas), aquí.
const aguaAlLado = () => !!mundoJ && pj.k === 0 && hayAguaCerca((x, z) => mundoJ.aguaEn(x, z), pj.x, pj.z);
function beber() {
  if (objetosRed) {
    objetosRed.mandar({ tipo: 'beber', x: pj.x, z: pj.z }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      mostrarAviso(r.datos && r.datos.sed > 0 ? tr('Bebes agua con las manos. Aún tienes sed.') : tr('Bebes agua con las manos. Ya no tienes sed.'));
    });
    return;
  }
  if (!aguaAlLado()) { mostrarAviso(tr('Aquí no hay agua: busca un río, un lago o el mar.'), true); return; }
  if (necesidades) { necesidades = saciarNecesidad(necesidades, 'sed', TRAGO); avisosNec.pintar(necesidades); }
  mostrarAviso(tr('Bebes agua con las manos.'));
}
// Comer (P4): una unidad de lo que llevas (bayas, setas…). En línea, por el servidor; sin servidor (pruebas), aquí.
// Despiezar la liebre cazada (9 nov; src/logica/comida.js): la receta de las manos, con la liebre del suelo a tu lado y
// la lasca encima; al terminar, se recoge sola la carne cruda y la piel (como desde el panel de fabricar).
function liebreAlLado() { const o = sueloObjetos.suelo.cercanos(pj.x, pj.z, Date.now()).find(x => x.cosa.tipo === 'liebre'); return o ? { x: o.x, z: o.z, id: o.id } : null; }
function despiezar() {
  hacerFabricacion({ tipo: 'fabricar', receta: 'despiezar_liebre', estacion: null, x: pj.x, z: pj.z }, (r) => {
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    mostrarAviso(tr('Despiezando la liebre…'));
    setTimeout(() => hacerFabricacion({ tipo: 'recoger_fabricado', estacion: null, x: pj.x, z: pj.z }, (q) => { if (!q.ok) mostrarAviso(tr(q.motivo), true); }), RECETAS.despiezar_liebre.s * 1000 + 400);
  });
}
const comidaQueLlevas = () => Object.keys(NUTRE).filter(t => inventario().cuantos(t) > 0);
function comer(tipo) {
  if (objetosRed) {
    objetosRed.mandar({ tipo: 'comer', objeto: tipo }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      mostrarAviso(tr('Comes: {c}.', { c: tr(CATALOGO[tipo].nombre).toLowerCase() }));
    });
    return;
  }
  const r = inventario().gastar(tipo, 1);
  if (!r.ok) { mostrarAviso(tr('No llevas nada de eso.'), true); return; }
  if (necesidades) { necesidades = saciarNecesidad(necesidades, 'hambre', NUTRE[tipo]); avisosNec.pintar(necesidades); }
  panelInventario.pintar(); pintarLlevas(); vestir();
  mostrarAviso(tr('Comes: {c}.', { c: tr(CATALOGO[tipo].nombre).toLowerCase() }));
}
function recoger(punto) {
  if (objetosRed) { // en línea lo recoge el servidor (el punto, como lo ve este navegador: decisión provisional)
    pj.rot = Math.atan2(punto.x - pj.x, punto.z - pj.z);
    objetosRed.mandar({ tipo: 'recoger', punto: punto.id, x: pj.x, z: pj.z, px: punto.x, pz: punto.z, clase: punto.tipo }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      mostrarAviso(tr('Recoges: {n} × {c}.', { n: r.cantidad, c: tr(nombreDe(punto.tipo)) }));
    });
    return;
  }
  const r = recoleccion.recoger(inventarios, registroAcciones, AUTOR_LOCAL, punto.id, pj.x, pj.z);
  if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
  if (almacen) guardarInventarios(almacen, inventarios);
  panelInventario.pintar(); pintarLlevas(); vestir(); // lo recogido sale en el panel o en la línea de lo que llevas
  pj.rot = Math.atan2(punto.x - pj.x, punto.z - pj.z);
  mostrarAviso(tr('Recoges: {n} × {c}.', { n: r.cantidad, c: tr(nombreDe(punto.tipo)) }));
}

// Descortezar un árbol en pie o sangrarlo (y coger su resina cuando sale): src/logica/tala.js, por el servidor.
function usarArbol(a, tipo) {
  pj.rot = Math.atan2(a.x - pj.x, a.z - pj.z);
  const fin = (r) => {
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    if (r.objeto) mostrarAviso(tr('Recoges: {n} × {c}.', { n: r.cantidad, c: tr(CATALOGO[r.objeto].nombre) }));
    else mostrarAviso(tr('Le haces un corte al árbol: la resina saldrá en unas horas.'));
  };
  if (objetosRed) { objetosRed.mandar({ tipo, arbol: a.id, x: pj.x, z: pj.z, ax: a.x, az: a.z, edad: a.edad || edadDeEscala(a.escala), especie: a.especie }, fin); return; }
  const r = talaV.usarArbol(inventarios, registroAcciones, AUTOR_LOCAL, a, tipo, pj.x, pj.z);
  if (r.ok) { if (almacen) guardarInventarios(almacen, inventarios); panelInventario.pintar(); pintarLlevas(); vestir(); }
  fin(r);
}

// Coger del suelo lo que se soltó (todo, o de una pila lo que quepa).
function cogerDelSuelo(o) {
  if (objetosRed) { // en línea, del suelo del servidor
    pj.rot = Math.atan2(o.x - pj.x, o.z - pj.z);
    objetosRed.mandar({ tipo: 'coger_suelo', objeto: o.id, x: pj.x, z: pj.z }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      mostrarAviso(tr('Coges del suelo: {n} × {c}.', { n: r.cantidad, c: tr(CATALOGO[r.objeto].nombre) }) + (r.queda ? ' ' + tr('Quedan {n}.', { n: r.queda }) : ''));
    });
    return;
  }
  const r = sueloObjetos.coger(inventarios, registroAcciones, AUTOR_LOCAL, o.id, pj.x, pj.z);
  if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
  if (almacen) guardarInventarios(almacen, inventarios);
  panelInventario.pintar(); pintarLlevas(); vestir();
  pj.rot = Math.atan2(o.x - pj.x, o.z - pj.z);
  mostrarAviso(tr('Coges del suelo: {n} × {c}.', { n: r.cantidad, c: tr(CATALOGO[r.objeto].nombre) }) + (r.queda ? ' ' + tr('Quedan {n}.', { n: r.queda }) : ''));
}
// Soltar al suelo, a tus pies, lo que hay en un lugar del inventario.
function soltarAlSuelo(de) {
  if (objetosRed) { // en línea, al suelo del servidor (lo ven todos)
    objetosRed.mandar({ tipo: 'soltar_suelo', de, x: pj.x, z: pj.z }, (r) => {
      if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
      mostrarAviso(r.desaparece === null ? tr('Lo dejas en el suelo: aquí se queda.') : tr('Lo dejas en el suelo: fuera de tus tierras desaparece en una hora.'));
    });
    return { ok: true, enviado: true };
  }
  const r = sueloObjetos.soltar(inventarios, registroAcciones, AUTOR_LOCAL, de, pj.x, pj.z);
  if (!r.ok) { mostrarAviso(tr(r.motivo), true); return r; }
  if (almacen) guardarInventarios(almacen, inventarios);
  pintarLlevas(); vestir(); panelInventario.pintar();
  mostrarAviso(r.desaparece === null ? tr('Lo dejas en el suelo: aquí se queda.') : tr('Lo dejas en el suelo: fuera de tus tierras desaparece en una hora.'));
  return r;
}

// ---- La rastra y la carretilla (src/logica/rastra.js, src/juego/rastra.js y src/juego/carretilla.js) ----
// Quién soy en el suelo: en línea, el autor que me da el servidor; sin red, el local.
const yoSuelo = () => (objetosRed && enLinea && enLinea.red.yo) || AUTOR_LOCAL;
const miRastra = () => rastras.deAutor(yoSuelo(), Date.now());
const rastraCercana = () => (miRastra() ? null : rastras.cercanas(pj.x, pj.z, Date.now())[0] || null);
const esCarr = o => o && o.cosa.tipo === 'carretilla';
// el texto de la rastra o el de la carretilla
const segun = (o, deRastra, deCarretilla) => (esCarr(o) ? deCarretilla : deRastra);
// lo que llevas en las manos o al hombro que va en ese vehículo (la ruta), o null
function paraCargar(veh = 'rastra') {
  const inv = inventario(), cabe = (VEHICULOS[veh] || VEHICULOS.rastra).cabe;
  return ['mano:der', 'mano:izq', 'hombro'].find(l => inv.lugares[l] && Object.hasOwn(cabe, inv.lugares[l].tipo)) || null;
}
// Arrastrándola o empujándola, vas despacio: lo que frene más, el vehículo o lo que llevas encima.
function velocidadCarga() { const r = miRastra(); return r ? Math.min(inventario().velocidad(), factorRastra(r.cosa.carga, r.cosa.tipo)) : inventario().velocidad(); }
let sitiosRastra = {};   // id → { x, z }: dónde se ve cada rastra o carretilla que se lleva (para dejarla ahí)
function pasoRastras() {
  const quien = (autor) => {
    if (autor === yoSuelo()) return pj.k === 0 ? { x: pj.x, z: pj.z, giro: pj.rot } : null;
    const r = enLinea && enLinea.remotos.get(autor);
    return r ? { x: r.x, z: r.z, giro: r.j.raiz.rotation.y } : null;
  };
  sitiosRastra = moverRastras(sueloObjetos.grupo, quien, decorado.altura);
  const mia = miRastra();
  jugador.arrastra = !!mia && !esCarr(mia); jugador.empuja = esCarr(mia);
  if (enLinea) for (const [autor, r] of enLinea.remotos) { const o = rastras.deAutor(autor, Date.now()); r.j.arrastra = !!o && !esCarr(o); r.j.empuja = esCarr(o); }
  // las agarraderas de la carretilla que empuja cada uno, para sus manos (src/juego/personaje.js)
  const agarraderas = (autor) => { const c = sueloObjetos.grupo.children.find(o => o.name === 'suelo_carretilla' && o.userData.arrastra === autor); return c ? c.userData.agarraderas || null : null; };
  jugador.agarraderas = jugador.empuja ? agarraderas(yoSuelo()) : null;
  if (enLinea) for (const [autor, r] of enLinea.remotos) r.j.agarraderas = r.j.empuja ? agarraderas(autor) : null;
}
// Una acción de la rastra o la carretilla: en línea, al servidor (se espera su respuesta); sin red, aquí con la misma lógica.
function accionRastra(a, alSalir) {
  const fin = (r) => {
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    if (!objetosRed) { sueloObjetos.guardar(); sueloObjetos.refrescar(); if (almacen) guardarInventarios(almacen, inventarios); }
    pintarLlevas(); panelInventario.pintar(); vestir();
    alSalir(r);
  };
  if (objetosRed) { objetosRed.mandar(a, fin); return; }
  const accionLocal = { autor: AUTOR_LOCAL, ...a };
  fin(a.tipo === 'arcon_al_suelo' ? ejecutarArconAlSuelo(sueloObjetos.suelo, registroAcciones, accionLocal, Date.now(), (au, x, z) => !!mundo.tierraDe(x, z))
    : ejecutarRastra(rastras, inventarios, registroAcciones, accionLocal, Date.now(), (au, x, z) => !!mundo.tierraDe(x, z), pj.rot));
}
const nombreCarga = c => (c ? tr('{n} × {c}', { n: c.n, c: tr(CATALOGO[c.tipo].nombre) }) : tr('vacía'));
function engancharRastra(o) {
  if (esCarr(o)) {
    pj.rot = Math.atan2(o.x - pj.x, o.z - pj.z);   // de cara a ella: va delante
    accionRastra({ tipo: 'empujar_carretilla', objeto: o.id, x: pj.x, z: pj.z }, () => mostrarAviso(tr('Empujas la carretilla ({c}). Usar la aparca.', { c: nombreCarga(o.cosa.carga) })));
    return;
  }
  pj.rot = Math.atan2(pj.x - o.x, pj.z - o.z);   // de espaldas a ella: va detrás
  accionRastra({ tipo: 'enganchar_rastra', objeto: o.id, x: pj.x, z: pj.z }, () => mostrarAviso(tr('Arrastras la rastra ({c}). Vas despacio; Usar la suelta.', { c: nombreCarga(o.cosa.carga) })));
}
function soltarRastra() {
  const o = miRastra(); if (!o) return;
  const s = sitiosRastra[o.id] || {}, carr = esCarr(o);
  accionRastra({ tipo: carr ? 'aparcar_carretilla' : 'soltar_rastra', x: pj.x, z: pj.z, ...(Number.isFinite(s.x) ? { rx: s.x, rz: s.z } : {}) },
    (r) => mostrarAviso(!carr ? tr('Dejas la rastra: se queda aquí, con lo que lleve.')
      : r.guarda ? tr('Aparcas la carretilla en tus tierras: lo que lleva está protegido.') : tr('Aparcas la carretilla fuera de tus tierras: cualquiera puede coger lo que lleva.')));
}
// cargar en la rastra o la carretilla lo de una ruta de lo que llevas ({ de }) o lo de un objeto del suelo ({ suelo })
function cargarRastra(o, que) {
  accionRastra({ tipo: segun(o, 'cargar_rastra', 'cargar_carretilla'), objeto: o.id, x: pj.x, z: pj.z, ...que },
    (r) => mostrarAviso(tr(segun(o, 'Cargas en la rastra: {n} × {c}. Lleva {m}.', 'Cargas en la carretilla: {n} × {c}. Lleva {m}.'), { n: r.cantidad, c: tr(CATALOGO[r.tipo].nombre), m: r.lleva })));
}
function descargarRastra(o) {
  accionRastra({ tipo: segun(o, 'descargar_rastra', 'descargar_carretilla'), objeto: o.id, x: pj.x, z: pj.z },
    (r) => mostrarAviso(tr(segun(o, 'Descargas la rastra: {n} × {c} en el suelo.', 'Descargas la carretilla: {n} × {c} en el suelo.'), { n: r.cantidad, c: tr(CATALOGO[r.tipo].nombre) })));
}
// lo que se puede hacer con la rastra o la carretilla desde el menú del clic derecho (o el dedo quieto)
function opcionesRastra() {
  const ops = [], mia = miRastra(), ahora = Date.now();
  const cargables = (o) => sueloObjetos.cercanos(pj.x, pj.z, ALCANCE_RASTRA).filter(s => s !== o && !esVehiculo(s.cosa.tipo) && sitioRastra(o.cosa.carga, s.cosa.tipo, o.cosa.tipo) > 0);
  const tCargar = o => segun(o, 'Cargar en la rastra: {c}', 'Cargar en la carretilla: {c}'), tCargarN = o => segun(o, 'Cargar en la rastra: {n} × {c}', 'Cargar en la carretilla: {n} × {c}');
  if (mia) {
    const de = paraCargar(mia.cosa.tipo);
    ops.push({ texto: tr(segun(mia, 'Soltar la rastra', 'Aparcar la carretilla')), pos: sitiosRastra[mia.id] || pj, hacer: soltarRastra });
    if (de && sitioRastra(mia.cosa.carga, inventario().lugares[de].tipo, mia.cosa.tipo) > 0) ops.push({ texto: tr(tCargar(mia), { c: tr(CATALOGO[inventario().lugares[de].tipo].nombre) }), pos: pj, hacer: () => cargarRastra(mia, { de }) });
    for (const s of cargables(mia)) ops.push({ texto: tr(tCargarN(mia), { n: Math.min(s.cosa.n, sitioRastra(mia.cosa.carga, s.cosa.tipo, mia.cosa.tipo)), c: tr(CATALOGO[s.cosa.tipo].nombre) }), pos: s, hacer: () => cargarRastra(mia, { suelo: s.id }) });
    return ops;
  }
  for (const o of rastras.cercanas(pj.x, pj.z, ahora)) {
    const de = paraCargar(o.cosa.tipo);
    ops.push({ texto: tr(segun(o, 'Arrastrar la rastra ({c})', 'Empujar la carretilla ({c})'), { c: nombreCarga(o.cosa.carga) }), pos: o, alto: 0.4, hacer: () => engancharRastra(o) });
    if (de && sitioRastra(o.cosa.carga, inventario().lugares[de].tipo, o.cosa.tipo) > 0) ops.push({ texto: tr(tCargar(o), { c: tr(CATALOGO[inventario().lugares[de].tipo].nombre) }), pos: o, alto: 0.4, hacer: () => cargarRastra(o, { de }) });
    for (const s of cargables(o)) ops.push({ texto: tr(tCargarN(o), { n: Math.min(s.cosa.n, sitioRastra(o.cosa.carga, s.cosa.tipo, o.cosa.tipo)), c: tr(CATALOGO[s.cosa.tipo].nombre) }), pos: s, hacer: () => cargarRastra(o, { suelo: s.id }) });
    if (o.cosa.carga) ops.push({ texto: tr(segun(o, 'Descargar la rastra ({c})', 'Descargar la carretilla ({c})'), { c: nombreCarga(o.cosa.carga) }), pos: o, alto: 0.4, hacer: () => descargarRastra(o) });
  }
  return ops;
}
// del arcón de pruebas al suelo, delante de ti (la rastra y la carretilla no caben en el inventario)
function arconAlSuelo(tipo) {
  accionRastra({ tipo: 'arcon_al_suelo', objeto: tipo, x: pj.x + Math.sin(pj.rot) * 1.2, z: pj.z + Math.cos(pj.rot) * 1.2 },
    () => mostrarAviso(tipo === 'carretilla' ? tr('La carretilla está en el suelo, delante de ti: Usar la empuja.') : tr('La rastra está en el suelo, delante de ti: Usar la engancha.')));
  return { ok: true };
}

// Andamio (GDD, «Obras»): Usar al pie sube por su escalerilla a la plataforma, que está a la altura del suelo de la
// planta de encima; arriba, si hay otro andamio encima, sube a ese; en lo alto de la pila, baja hasta el pie.
function usarAndamio(c, p) {
  const m = centroMundo(c, p);
  if (pj.k === p.k) {
    pj.x = m.x; pj.z = m.z; pj.k = p.k + 1;
    mostrarAviso(`${t('subesAndamio')} ${pj.k}`);
    return;
  }
  let k = p.k;
  while (k > 0 && andamioEn(c, p.i, p.j, k - 1)) k--;
  // al pie del andamio de abajo, por fuera (por la escalerilla, lejos del muro)
  const pie = andamioEn(c, p.i, p.j, k) || p, ang = c.rot - (pie.dir || 0) * Math.PI / 2;
  const f = MODULO / 2 + 0.45;
  pj.x = m.x - Math.sin(ang) * f; pj.z = m.z - Math.cos(ang) * f; pj.k = k;
  mostrarAviso(`${t('bajas')} ${pj.k}`);
}

// ¿Está el jugador en la casilla de esta pieza (la de una trampilla: encima de su escalera)?
function dentroDeCasilla(c, p) {
  const l = mundoALocal(c, pj.x, pj.z);
  return Math.floor(l.lx / MODULO) === p.i && Math.floor(l.lz / MODULO) === p.j;
}
// ---------------- Movimiento y colisiones ----------------
function segmentosBloqueo(k) {
  const segs = []; // [x1,z1,x2,z2]
  // las matas escondidas bajo lo construido no chocan; y lo del suelo (árboles, rocas, matas) solo choca a ras de
  // suelo: desde un adarve o una planta de arriba se pasa por encima (una roca bajo el adarve paraba al que andaba por él)
  const circulos = k === 0 ? obstaculos.filter(o => !o.oculto) : [];
  for (const c of mundo.construcciones) {
    for (const [key, p] of c.piezas) {
      // chimenea: en la planta baja no se entra en el hogar; más arriba, su cañón no se atraviesa
      if (p.hueco === 'h' && !p.obra && !window.__sinChoqueHogar && (k === 0 || k * ALTURA < (altosCanon.get(p) ?? altoCanon(c, p, P.subidaTejado)))) {
        const esq = huellaHogar(p, k > 0).map(q => localAMundo(c, q.lx, q.lz));
        for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]);
        continue;
      }
      if (p.k !== k && !(p.hueco === 'a' && k === 1)) continue;
      if (p.obra) continue; // una obra es solo un armazón: no corta el paso
      if (p.hueco === 'a' && !window.__sinChoqueAdarve) {
        // adarve: por debajo de su piso no se pasa (está a 1,5 m); encima, la empalizada no se salta (los otros
        // lados están abiertos: si sales por ellos, caes)
        const esq = [[p.i, p.j], [p.i + 1, p.j], [p.i + 1, p.j + 1], [p.i, p.j + 1]].map(([a, b]) => localAMundo(c, a * MODULO, b * MODULO));
        if (k === 0) { for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]); continue; }
        // los lados de la casilla, por dir (SUBE): 0 → +z (esq 2-3), 1 → -x (3-0), 2 → -z (0-1), 3 → +x (1-2)
        const LADO = [[2, 3], [3, 0], [0, 1], [1, 2]];
        for (const { dir } of empalizadasDe(c, p.i, p.j)) { const [a, b] = LADO[dir]; segs.push([esq[a].x, esq[a].z, esq[b].x, esq[b].z]); }
        continue;
      }
      if (p.hueco === 'v') {
        const m = localAMundo(c, p.i * MODULO, p.j * MODULO);
        circulos.push({ x: m.x, z: m.z, r: 0.16 });
        continue;
      }
      if (p.hueco === 'l' && PIEZAS[p.tipo].andando && trampillaCerrada(c, p.i, p.j, p.k)) {
        // escalera con la trampilla de arriba cerrada: no se puede subir, así que la casilla no se pisa
        const esq = [[p.i, p.j], [p.i + 1, p.j], [p.i + 1, p.j + 1], [p.i, p.j + 1]].map(([a, b]) => localAMundo(c, a * MODULO, b * MODULO));
        for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]);
        continue;
      }
      if (p.hueco !== 'e') continue;
      const def = PIEZAS[p.tipo];
      if (def.portón && p.abierta) continue;
      const a = p.d === 0 ? [p.i * MODULO, p.j * MODULO] : [p.i * MODULO, p.j * MODULO];
      const b = p.d === 0 ? [(p.i + 1) * MODULO, p.j * MODULO] : [p.i * MODULO, (p.j + 1) * MODULO];
      const pa = localAMundo(c, a[0], a[1]), pb = localAMundo(c, b[0], b[1]);
      if (def.conPuerta) {
        const puertaP = c.piezas.get(clave('p', p.i, p.j, p.k, p.d));
        const f = (P.anchoPuerta / 2) / MODULO;
        const m1 = { x: pa.x + (pb.x - pa.x) * (0.5 - f), z: pa.z + (pb.z - pa.z) * (0.5 - f) };
        const m2 = { x: pa.x + (pb.x - pa.x) * (0.5 + f), z: pa.z + (pb.z - pa.z) * (0.5 + f) };
        segs.push([pa.x, pa.z, m1.x, m1.z], [m2.x, m2.z, pb.x, pb.z]);
        if (puertaP && !puertaP.abierta) segs.push([m1.x, m1.z, m2.x, m2.z]);
      } else segs.push([pa.x, pa.z, pb.x, pb.z]);
    }
  }
  return { segs, circulos };
}
function resolverColision(x, z, k) {
  const R = 0.32;
  const { segs, circulos } = segmentosBloqueo(k);
  for (let it = 0; it < 3; it++) {
    for (const [x1, z1, x2, z2] of segs) {
      const dx = x2 - x1, dz = z2 - z1;
      const l2 = dx * dx + dz * dz;
      let u = ((x - x1) * dx + (z - z1) * dz) / l2;
      u = Math.max(0, Math.min(1, u));
      const px = x1 + u * dx, pz = z1 + u * dz;
      const ex = x - px, ez = z - pz, d = Math.hypot(ex, ez);
      const lim = R + 0.14;
      if (d < lim && d > 1e-6) { x = px + ex / d * lim; z = pz + ez / d * lim; }
    }
    for (const o of circulos) {
      const ex = x - o.x, ez = z - o.z, d = Math.hypot(ex, ez), lim = R + o.r;
      if (d < lim && d > 1e-6) { x = o.x + ex / d * lim; z = o.z + ez / d * lim; }
    }
  }
  return { x, z };
}
// Un paso de alguien que anda por el suelo del mundo (el rival de práctica): de (x0, z0) hacia (x1, z1) sin
// atravesar obras ni árboles, sin subir cortados ni salir de la isla y sin meterse donde ya cubre (no nada). Si no
// puede de frente, se desliza por un eje, como tú; si tampoco, se queda donde estaba.
function andarHasta(x0, z0, x1, z1) {
  const r = resolverColision(x1, z1, 0);
  if (!mundoJ) return { x: THREE.MathUtils.clamp(r.x, -190, 190), z: THREE.MathUtils.clamp(r.z, -190, 190) };
  const vale = (x, z) => mundoJ.andable(x0, z0, x, z) && modoAgua(mundoJ.aguaEn(x, z)?.hondo) !== 'nadar';
  if (vale(r.x, r.z)) return r;
  if (vale(r.x, z0)) return { x: r.x, z: z0 };
  if (vale(x0, r.z)) return { x: x0, z: r.z };
  return { x: x0, z: z0 };
}
// altura del suelo bajo el jugador en su planta; baja de planta si no hay suelo
// Escalera de tablas bajo el jugador: se sube andando. Devuelve { k, y } o null.
// Si vienes por debajo del tramo alto (o caes por el hueco desde arriba muy por encima), no cuenta.
function escaleraBajoJugador() {
  for (const c of mundo.construcciones) {
    const l = mundoALocal(c, pj.x, pj.z);
    const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
    for (const k0 of [pj.k, pj.k - 1]) {
      if (k0 < 0) continue;
      const p = escaleraAndando(c, i, j, k0);
      if (!p || trampillaCerrada(c, i, j, k0)) continue; // con la trampilla cerrada, la escalera no sube
      const t = progresoEscalera(p, l.lx, l.lz);
      const base = c.piezas.has(clave('f', i, j, k0)) ? (k0 === 0 ? P.superficieCimiento : P.superficieSuelo) : 0;
      const y0 = oyDe(c) + k0 * ALTURA + base, y1 = oyDe(c) + (adarveDeEscalera(c, p, false) ? ALTO_ADARVE : (k0 + 1) * ALTURA + P.superficieSuelo);
      const y = y0 + t * (y1 - y0);
      if (pj.k === k0 && y - pj.y > 0.8) continue; // estás debajo de la escalera, no encima
      return { k: t > 0.5 ? k0 + 1 : k0, y };
    }
  }
  return null;
}
// Tejado terminado de la casilla (i, j) que cubre la planta k - 1 (sus muros acaban a la altura de la planta k): altura
// de su cara de arriba bajo el jugador, o null. Se pisa (valravnx, 31 oct: «los tejados deben poder ser pisables para
// poder construir tejados con un solo andamio»): desde el andamio se sale al tramo de al lado y desde ahí se alcanza
// el siguiente. Si su cara está muy por encima de tus pies (llegas por debajo, a un tramo alto), no se sube de golpe.
// Grueso de cada tejado por encima de su plano, en vertical (m; del dibujo de modelos.js): paja en dos hiladas,
// tablillas sobre la tablazón, tejas de canal y cobija.
const SOBRE_TEJADO = { paja: 0.44, tablilla: 0.13, teja: 0.25 };
function tejadoBajoJugador(c, i, j, k, l) {
  const key = clave('r', i, j, k), p = c.piezas.get(key);
  if (!p || p.obra || window.__sinPisarTejados) return null;
  const tj = geometriaTejados(c).get(key);
  const material = Object.keys(SOBRE_TEJADO).find(m => p.tipo.endsWith(m)) || 'tablilla';
  const y = oyDe(c) + k * ALTURA + altoTejadoEn(p, tj, l.lx, l.lz) * P.subidaTejado + SOBRE_TEJADO[material];
  return y - pj.y > 0.8 ? null : y;
}
function alturaSuelo() {
  const e = escaleraBajoJugador();
  if (e) { pj.k = e.k; return e.y; }
  for (let k = pj.k; k >= 0; k--) {
    for (const c of mundo.construcciones) {
      const l = mundoALocal(c, pj.x, pj.z);
      const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
      const f = c.piezas.get(clave('f', i, j, k));
      const oy = oyDe(c);
      if (f && !f.obra) { pj.k = k; return oy + k * ALTURA + (k === 0 ? P.superficieCimiento : P.superficieSuelo); }
      if (k === 1 && adarveEn(c, i, j)) { pj.k = 1; return oy + ALTO_ADARVE; } // en el piso del adarve
      if (k > 0 && trampillaCerrada(c, i, j, k - 1)) { pj.k = k; return oy + k * ALTURA + P.superficieSuelo; } // la trampilla cerrada se pisa
      if (k > 0 && andamioEn(c, i, j, k - 1)) { pj.k = k; return oy + k * ALTURA + P.superficieSuelo; } // plataforma del andamio
      if (k > 0) { const y = tejadoBajoJugador(c, i, j, k, l); if (y !== null) { pj.k = k; return y; } } // el tejado terminado se pisa
    }
    // sin suelo construido debajo, el terreno: llano en la zona de construir, y las lomas de más allá (donde está la
    // ladera con la piedra suelta y el sílex), que antes se cruzaban por dentro
    if (k === 0) { pj.k = 0; return decorado.altura(pj.x, pj.z); }
  }
  return 0;
}

// planta en la que está un mueble, por su altura (los del suelo de arriba están a una altura de planta o más)
const plantaDeco = (d) => Math.max(0, Math.floor((d.y - sueloEn(d.x, d.z) + 0.3) / ALTURA));

// ---------------- Fuego de las chimeneas ----------------
// Las llamas se mueven, el humo sube y el fuego alumbra. Luces: solo dos (las de las chimeneas encendidas más cerca
// del jugador) y siempre las mismas: cambiar cuántas luces hay obliga a rehacer todos los sombreadores (un tirón).
// Se crean al encender la primera chimenea.
const lucesFuego = [], vFuego = new THREE.Vector3();
function moverFuegos() {
  if (chimeneasSucias) { chimeneas = registroMallas.filter(r => r.obj.userData.humo && r.obj.getObjectByName('humo')).map(r => r.obj); chimeneasSucias = false; }
  const hogueras = estacionesV.paso(); // las hogueras que arden (src/juego/estaciones.js): también alumbran
  if ((chimeneas.length || hogueras.length) && !lucesFuego.length) for (let i = 0; i < 2; i++) {
    const l = new THREE.PointLight(0xff9a50, 0, 9, 2); l.castShadow = false; escena.add(l); lucesFuego.push(l);
  }
  const t = performance.now() / 1000;
  const cerca = [];
  for (const g of chimeneas) {
    if (!g.parent) continue;
    moverHumo(g, t);
    const f = g.userData.fuego; vFuego.set(f.x, f.y, f.z); g.localToWorld(vFuego);
    cerca.push({ d: Math.hypot(vFuego.x - pj.x, vFuego.z - pj.z), p: vFuego.clone() });
  }
  for (const p of hogueras) cerca.push({ d: Math.hypot(p.x - pj.x, p.z - pj.z), p });
  cerca.sort((a, b) => a.d - b.d);
  lucesFuego.forEach((l, i) => {
    const c = cerca[i];
    if (!c || c.d > 25) { l.intensity = 0; return; }
    l.position.copy(c.p);
    l.intensity = 7 * (c.p.k ?? 1) * (0.86 + 0.08 * Math.sin(t * 9.1 + i) + 0.06 * Math.sin(t * 23.7 + i * 2));
  });
}
window.__fuegos = () => ({ chimeneas: chimeneas.length, hogueras: estacionesV.paso().length, luces: lucesFuego.length, encendidas: lucesFuego.filter(l => l.intensity > 0).length });

// Un golpe de hacha al árbol que talas (con autor, en src/logica/tala.js). Al caer, deja el tronco y las ramas en
// el suelo, donde cae, y el tocón.
function empezarTala(a) { estado.talando = a; estado.golpeEn = 0.45; pj.rot = Math.atan2(a.x - pj.x, a.z - pj.z); mostrarAviso(t('talando')); }
const RITMO_TALA = 0.9; // s entre golpe y golpe (el gesto de talar)
function golpeTala() {
  const a = estado.talando;
  if (a.troceo) { golpeTroceo(a.troceo); return; }
  if (a.desbroce) { golpeDesbroce(a); return; }
  if (a.rotura) { golpeRotura(a); return; }
  estado.golpeEn = RITMO_TALA;
  if (objetosRed) { // en línea, el golpe lo da el servidor (el árbol, como lo ve este navegador: decisión provisional)
    objetosRed.mandar({ tipo: 'talar', arbol: a.id, x: pj.x, z: pj.z, ax: a.x, az: a.z, edad: a.edad || edadDeEscala(a.escala) }, (r) => {
      if (estado.talando !== a) return;   // ya ha dejado de talar
      if (!r.ok) { estado.talando = null; mostrarAviso(tr(r.motivo), true); return; }
      avisoTala(a, r);
    });
    return;
  }
  const r = talaV.golpe(inventarios, registroAcciones, AUTOR_LOCAL, a, pj.x, pj.z);
  if (!r.ok) { estado.talando = null; mostrarAviso(tr(r.motivo), true); return; }
  avisoTala(a, r);
}
function avisoTala(a, r) {
  // lo que llevas talado, para el aro de la acción (el primer golpe dice cuántos faltan)
  if (Number.isFinite(r.faltan)) { if (!a.prog) a.prog = { hechos: 0, total: r.faltan + 1 }; a.prog.hechos = a.prog.total - r.faltan; }
  // el hacha se ha gastado del todo con este golpe (src/logica/desgaste.js): se rompe y se deja de talar
  if (r.seRompe) {
    estado.talando = null;
    mostrarAviso(tr('Se te ha roto: {c}.', { c: tr(CATALOGO[r.seRompe] ? CATALOGO[r.seRompe].nombre : r.seRompe).toLowerCase() }), true);
    if (!r.cae) return;
  }
  // el golpe que termina la boca (src/logica/tala.js): hacia dónde caerá, o que no la hay
  if (!r.cae && r.boca !== undefined) { mostrarAviso(r.boca === null ? tr('Has cortado desde varios lados: sin boca, caerá hacia donde se incline o cuesta abajo.') : tr('La boca está abierta: caerá hacia este lado. Córtalo por detrás y apártate.')); return; }
  if (!r.cae) { mostrarAviso(r.faltan === 1 ? tr('Talas el árbol: falta 1 golpe.') : tr('Talas el árbol: faltan {n} golpes.', { n: r.faltan })); return; }
  estado.talando = null;
  const menudo = r.deja.find(d => d.tipo === 'rama' || d.tipo === 'vara'), tronco = r.deja.find(d => d !== menudo);
  const txt = menudo && menudo.tipo === 'vara' ? '¡El árbol cae! Deja {tronco} y {n} varas.' : '¡El árbol cae! Deja {tronco} y {n} ramas.';
  mostrarAviso(tr(txt, { tronco: tr(CATALOGO[tronco.tipo].nombre).toLowerCase(), n: menudo ? menudo.n : 0 }));
}

// Desbrozar (valravnx, 8 nov; src/logica/recoleccion.js): el matorral (de la vegetación) o el arbusto de bayas más
// cercano, en la planta baja. Se dan unos golpes (más con la lasca que con el hacha: GOLPES_DESBROCE) y, al último, el
// servidor lo quita y deja las ramas (y a veces una vara) en el suelo donde estaba.
function desbrozableCercano() {
  if (pj.k !== 0) return null;
  const m = decorado.matasCerca ? decorado.matasCerca(pj.x, pj.z, 1.6)[0] : null;
  const b = recoleccion.arbustosCerca ? recoleccion.arbustosCerca(pj.x, pj.z, 1.6)[0] : null;
  const d = (o) => (o ? Math.hypot(o.x - pj.x, o.z - pj.z) : Infinity);
  const o = d(m) <= d(b) ? m : b;
  return o ? { id: o.id, tipo: o === m ? 'matorral' : 'bayas', x: o.x, z: o.z } : null;
}
function empezarDesbroce(o) {
  const con = conQueDesbroza(inventario());
  if (!con) { mostrarAviso(tr(QUE_PIDE.desbrozar), true); return; }
  estado.talando = { desbroce: o, x: o.x, z: o.z, golpes: GOLPES_DESBROCE[con], dados: 0 }; estado.golpeEn = 0.45;
  pj.rot = Math.atan2(o.x - pj.x, o.z - pj.z);
  mostrarAviso(tr('Desbrozas: {c}.', { c: tr(RECOLECTABLES[o.tipo].nombre).toLowerCase() }));
}
function golpeDesbroce(a) {
  estado.golpeEn = RITMO_TALA;
  if (++a.dados < a.golpes) return;
  estado.talando = null;
  const o = a.desbroce;
  const fin = (r) => {
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    mostrarAviso(r.extra ? tr('Desbrozado: caen {n} ramas y una vara.', { n: r.cantidad }) : tr('Desbrozado: caen {n} ramas.', { n: r.cantidad }));
  };
  if (objetosRed) { objetosRed.mandar({ tipo: 'desbrozar', punto: o.id, x: pj.x, z: pj.z, px: o.x, pz: o.z, clase: o.tipo }, fin); return; }
  const r = recoleccion.desbrozar(inventarios, registroAcciones, AUTOR_LOCAL, o, pj.x, pj.z, sueloObjetos.suelo);
  if (r.ok) { sueloObjetos.guardar(); sueloObjetos.refrescar(); if (o.tipo === 'matorral' && decorado.rehacer) decorado.rehacer(); }
  fin(r);
}

// Romper rocas (valravnx, 8 nov; src/logica/recoleccion.js): la roca mediana más cercana (de la vegetación, con su
// nombre por su sitio), en la planta baja. Con el mazo de piedra en la mano, un golpe cada poco, cada uno una acción del
// servidor (cansa); al último, la roca se rompe, deja sus piedras sueltas en el suelo donde estaba y unos cascotes.
function rocaCercana() {
  if (pj.k !== 0 || !decorado.rocasCerca) return null;
  const e = decorado.rocasCerca(pj.x, pj.z, 1.2)[0];
  return e ? { id: e.id, x: e.x, z: e.z, tam: e.tam } : null;
}
function empezarRotura(o) {
  if (!mazoEnMano(inventario())) { mostrarAviso(tr(QUE_PIDE.romper), true); return; }
  estado.talando = { rotura: o, x: o.x, z: o.z }; estado.golpeEn = 0.45;
  pj.rot = Math.atan2(o.x - pj.x, o.z - pj.z);
  mostrarAviso(tr('Rompes la roca.'));
}
function golpeRotura(a) {
  estado.golpeEn = RITMO_TALA;
  const o = a.rotura;
  const fin = (r) => {
    if (estado.talando !== a) return;   // ya ha dejado de golpear
    if (!r.ok) { estado.talando = null; mostrarAviso(tr(r.motivo), true); return; }
    if (Number.isFinite(r.faltan)) { if (!a.prog) a.prog = { hechos: 0, total: r.faltan + 1 }; a.prog.hechos = a.prog.total - r.faltan; }   // (el aro de la acción)
    if (!r.rota) { mostrarAviso(r.faltan === 1 ? tr('Rompes la roca: falta 1 golpe.') : tr('Rompes la roca: faltan {n} golpes.', { n: r.faltan })); return; }
    estado.talando = null;
    mostrarAviso(tr('¡La roca se parte! Deja {n} piedras en el suelo.', { n: r.cantidad }));
  };
  if (objetosRed) { objetosRed.mandar({ tipo: 'romper', punto: o.id, x: pj.x, z: pj.z, px: o.x, pz: o.z, clase: 'roca', tam: o.tam }, fin); return; }
  const r = recoleccion.romper(inventarios, registroAcciones, AUTOR_LOCAL, o, pj.x, pj.z, sueloObjetos.suelo);
  if (r.ok && r.rota) { sueloObjetos.guardar(); sueloObjetos.refrescar(); if (decorado.rehacer) decorado.rehacer(); }
  fin(r);
}

// Tronzar y partir (src/logica/troceo.js): el tronco del suelo más cercano que se trocea, en la planta baja.
function troncoCercano() {
  if (pj.k !== 0) return null;
  return sueloObjetos.suelo.cercanos(pj.x, pj.z, Date.now(), ALCANCE_TROCEO - 0.3).find(o => seTrocea(o.cosa.tipo)) || null;
}
function empezarTroceo(o) {
  estado.talando = { troceo: o.id, x: o.x, z: o.z }; estado.golpeEn = 0.45; pj.rot = Math.atan2(o.x - pj.x, o.z - pj.z);
  mostrarAviso(o.cosa.tipo === 'tronco_largo' ? tr('Tronzas el tronco largo.') : tr('Partes el tronco en leña.'));
}
function golpeTroceo(id) {
  estado.golpeEn = RITMO_TALA;
  if (objetosRed) { // en línea, el golpe lo da el servidor, en su suelo
    const yendo = estado.talando;
    objetosRed.mandar({ tipo: 'trocear', objeto: id, x: pj.x, z: pj.z }, (r) => {
      if (estado.talando !== yendo) return;
      if (!r.ok) { estado.talando = null; mostrarAviso(tr(r.motivo), true); return; }
      avisoTroceo(r);
    });
    return { ok: true, enviado: true };
  }
  const r = ejecutarTroceo(troceo, inventarios, registroAcciones, { autor: AUTOR_LOCAL, tipo: 'trocear', objeto: id, x: pj.x, z: pj.z }, Date.now(),
    (autor, x, z) => !!mundo.tierraDe(x, z));
  if (!r.ok) { estado.talando = null; mostrarAviso(tr(r.motivo), true); return r; }
  if (almacen) guardarTroceo(almacen, troceo);
  sueloObjetos.guardar(); sueloObjetos.refrescar();
  return avisoTroceo(r);
}
function avisoTroceo(r) {
  const tronzar = r.accion === 'tronzar';
  if (!r.termina) {
    mostrarAviso(tronzar ? (r.faltan === 1 ? tr('Tronzas el tronco: falta 1 golpe.') : tr('Tronzas el tronco: faltan {n} golpes.', { n: r.faltan }))
      : (r.faltan === 1 ? tr('Partes el tronco: falta 1 golpe.') : tr('Partes el tronco: faltan {n} golpes.', { n: r.faltan })));
    return r;
  }
  estado.talando = null;
  mostrarAviso(tronzar ? tr('Tronzado: {n} troncos cortos.', { n: r.da.n }) : tr('Partido: {n} de leña.', { n: r.da.n }));
  return r;
}

// El terreno por trozos alrededor de donde estás (en el mundo). Al empezar, hasta que están los trozos de alrededor, el
// aviso de «Preparando el paisaje…» (los primeros se hacen con prisa: no hay nada que dibujar mientras).
const msMundo = { max: 0, total: 0, n: 0 };
let mundoListo = false;
function pasoMundo() {
  // y lo que crece, que también sigue al jugador (src/mundo/vegetacion_mundo.js): cuenta en el mismo tiempo
  // (con la cámara libre del admin, el paisaje se prepara alrededor de la cámara)
  const foco = camLibre.activa ? { ...pj, x: camLibre.x, z: camLibre.z } : pj;
  const ms = mundoJ.paso(foco.x, foco.z, { prisa: !mundoListo }) + (decorado.paso ? decorado.paso(foco) : 0);
  // el dosel de cerca empieza donde acaban los árboles de verdad (su cuadro, alrededor de donde se pusieron)
  if (mundoJ.horizonte && decorado.centro) mundoJ.horizonte.cuadroArboles(decorado.centro.x, decorado.centro.z, MEDIDAS_VEGETACION.cuadro);
  if (mundoListo) mirarTierras();
  if (mundoListo) { msMundo.n++; msMundo.total += ms; if (ms > msMundo.max) msMundo.max = ms; }
  if (mundoJ.listo !== mundoListo) {
    mundoListo = mundoJ.listo;
    const av = $('avisoMundo'); if (av) av.hidden = mundoListo;
    if (mundoListo && mapaRey) mapaRey.preparar();   // el mapa del rey se pinta a pasos, ya con el mundo a la vista
  }
}
if (mundoJ) {
  const av = document.createElement('div');
  av.id = 'avisoMundo'; av.textContent = tr('Preparando el paisaje…');
  av.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);padding:10px 16px;border-radius:8px;background:rgba(30,26,20,.78);color:#f2e8d0;font:15px system-ui,sans-serif;z-index:20;pointer-events:none';
  document.body.appendChild(av);
}

// ---------------- Aguante y nado ----------------
const nado = { e: nuevoAguante(), modo: 'tierra', agua: null, muertes: 0 };
let indAguante = null;
function pintarAguante() {
  // un anillo abajo, en el centro: se ve al gastar aguante o en el agua honda; se vacía con el
  // aguante y se pone rojo al ahogarse
  if (!indAguante) { indAguante = document.createElement('div'); indAguante.id = 'aguante'; indAguante.title = tr('Aguante'); document.body.appendChild(indAguante); }
  const e = nado.e, ver = e.aguante < 0.995 || nado.modo === 'nadar';
  indAguante.hidden = !ver;
  if (!ver) return;
  const p = Math.round(e.aguante * 100), color = e.ahogo > 0 ? '#c0442c' : e.aguante < 0.25 ? '#d9a441' : '#e8dcc0';
  indAguante.style.background = `conic-gradient(${color} ${p}%, rgba(30,26,20,.55) ${p}% 100%)`;
  indAguante.classList.toggle('ahogo', e.ahogo > 0);
}
// te has ahogado: de momento, vuelves a tu sitio de salida con el aguante lleno (decisión provisional del 30 oct: lo
// que pasa al morir —la mitad de lo que llevas, saqueable— llega con el hito de supervivencia)
function ahogado() {
  nado.muertes++;
  nado.e = nuevoAguante();
  // en línea lo dice el servidor (mira que estés en el agua honda): él te devuelve a tu cama o a tu salida (alMorir)
  if (enLinea && enLinea.estado === 'conectado') { enLinea.enviar({ tipo: 'morir', motivo: 'ahogado' }); return; }
  pj.x = 0; pj.z = 4; pj.k = 0; pj.y = alturaSuelo();
  mostrarAviso(tr('Te has ahogado. Vuelves a tu sitio de salida.'), true);
}
// Has muerto (P4; GDD, apartado 6; src/logica/muerte.js): de sed, de hambre, en el combate o ahogado. El servidor ya te
// ha puesto donde vuelves; aquí, el personaje va allí (despierto y sin nada en las manos que no sea tuyo ya).
const MUERTES = { 'De sed': 'Has muerto de sed.', 'De hambre': 'Has muerto de hambre.', 'Ahogado': 'Te has ahogado.' };
function alMorir(m) {
  const p = m && m.posicion;
  if (!p || ![p.x, p.y, p.z].every(Number.isFinite)) return;
  nado.muertes++;
  nado.e = nuevoAguante();
  despertar(); levantarse();
  Object.assign(pj, { x: p.x, y: p.y, z: p.z, k: 0, vel: 0, rot: Number.isFinite(p.giro) ? p.giro : pj.rot });
  if (combate.activo) combate.guardar();
  enLinea.mandarEstado({ x: pj.x, y: pj.y, z: pj.z, giro: pj.rot, anim: 'quieto' });
  const que = MUERTES[m.motivo] ? tr(MUERTES[m.motivo]) : tr('Has muerto: {m}.', { m: tr(m.motivo || 'Desangrado') });
  const aviso = que + ' ' + (m.enCama ? tr('Vuelves a tu cama. Tu cuerpo queda donde caíste, con la mitad de lo que llevabas, una hora.') : tr('Vuelves a tu sitio de salida. Tu cuerpo queda donde caíste, con la mitad de lo que llevabas, una hora.'));
  ultimaMuerte = { motivo: m.motivo, enCama: !!m.enCama, cuerpo: m.cuerpo || null, t: Date.now(), aviso };
  mostrarAviso(aviso, true);
}
let ultimaMuerte = null;

// ---------------- La herramienta del admin: velocidad y cámara libre ----------------
// (valravnx, 6 nov: «poder multiplicar la velocidad de carrera y poder ir a freecam volando en 3 dimensiones»; el panel
// está en src/juego/panel_admin.js). La velocidad la confirma el servidor (y solo a la cuenta de admin le deja moverse
// tanto); la cámara libre es solo de este navegador: el personaje se queda donde estaba y no cambia nada del mundo.
// Decisiones provisionales (anotadas en el diario): vuela a 12 m/s, con Mayúsculas a 48; no atraviesa el suelo (queda
// al menos a 0,5 m por encima) y no se aleja más de 3 km del personaje (lo de alrededor llega por el personaje).
const VUELO = 12, VUELO_RAPIDO = 48, VUELO_LEJOS = 3000;
// con el autoconstruir del admin, el mojón y los muebles no piden llevar sus materiales (el servidor no los cobra)
function autoconstruirAdmin() { return !!(enLinea && enLinea.admin && enLinea.red && enLinea.red.modosAdmin && enLinea.red.modosAdmin.autoconstruir); }
const velocidadAdmin = () => (enLinea && enLinea.admin && enLinea.red && enLinea.red.modosAdmin && enLinea.red.modosAdmin.velocidad > 1 ? enLinea.red.modosAdmin.velocidad : 1);
const barraVuelo = document.createElement('div');
barraVuelo.id = 'barraVuelo'; barraVuelo.hidden = true;
// a la izquierda, a media altura: a la derecha están los botones de modo y Usar, y abajo a la izquierda el joystick
barraVuelo.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));top:50%;transform:translateY(-50%);z-index:30;display:flex;flex-direction:column;gap:8px';
for (const [idb, texto, sube] of [['vueloSubir', '▲', 1], ['vueloBajar', '▼', -1], ['vueloIrAqui', tr('Ir aquí'), 0], ['vueloSalir', tr('Cámara'), 0]]) {
  const b = document.createElement('button'); b.id = idb; b.textContent = texto;
  b.style.cssText = 'min-width:52px;min-height:44px;font:600 14px system-ui,sans-serif;color:#f1e8d8;background:rgba(36,30,24,.85);border:1px solid rgba(241,232,216,.3);border-radius:10px;touch-action:none';
  if (sube) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); camLibre.sube = sube; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (camLibre.sube === sube) camLibre.sube = 0; });
  }
  else b.onclick = () => (idb === 'vueloSalir' ? alternarCamaraLibre(false) : panelAdmin && panelAdmin.irAqui());
  barraVuelo.appendChild(b);
}
document.body.appendChild(barraVuelo);
function alternarCamaraLibre(si = !camLibre.activa) {
  if (si === camLibre.activa) return;
  if (si && !(panelAdmin && panelAdmin.admin)) return;
  camLibre.activa = si; camLibre.sube = 0;
  barraVuelo.hidden = !si;
  if (si) {
    // empieza donde estaba la cámara, mirando hacia donde miraba (de cara al personaje)
    camLibre.x = camara.position.x; camLibre.y = camara.position.y; camLibre.z = camara.position.z;
    mostrarAviso(tr('Cámara libre: el personaje se queda aquí.'));
  } else mostrarAviso(tr('Vuelves a tu personaje.'));
}
function moverCamaraLibre(ax, az, dt) {
  const v = (teclas.has('shift') ? VUELO_RAPIDO : VUELO) * dt;
  const cp = Math.cos(cam.pitch), s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  // adelante: hacia donde mira (también hacia arriba o abajo); los lados, en horizontal
  const fx = -s * cp, fy = -Math.sin(cam.pitch), fz = -c * cp;
  const avance = -az, lado = ax;
  camLibre.x += (fx * avance + c * lado) * v;
  camLibre.z += (fz * avance - s * lado) * v;
  camLibre.y += fy * avance * v;
  const sube = (teclas.has(' ') ? 1 : 0) - (teclas.has('c') ? 1 : 0) + camLibre.sube;
  camLibre.y += sube * v;
  // ni bajo el suelo ni demasiado lejos del personaje
  const dx = camLibre.x - pj.x, dz = camLibre.z - pj.z, d = Math.hypot(dx, dz);
  if (d > VUELO_LEJOS) { camLibre.x = pj.x + dx / d * VUELO_LEJOS; camLibre.z = pj.z + dz / d * VUELO_LEJOS; }
  const suelo = mundoJ ? decorado.altura(camLibre.x, camLibre.z) : 0;
  if (camLibre.y < suelo + 0.5) camLibre.y = suelo + 0.5;
}

const reloj = new THREE.Clock();
function paso() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (mundoJ) pasoMundo();
  // el contador de arriba sigue a donde estás (entras o sales de tu tierra) y a lo que cambia en el suelo
  if (enLinea && performance.now() - ultimoMateriales > 500) { ultimoMateriales = performance.now(); pintarMateriales(); }
  // entrada de movimiento relativa a la cámara
  let ax = 0, az = 0;
  if (teclas.has('w') || teclas.has('arrowup')) az -= 1;
  if (teclas.has('s') || teclas.has('arrowdown')) az += 1;
  if (teclas.has('a') || teclas.has('arrowleft')) ax -= 1;
  if (teclas.has('d') || teclas.has('arrowright')) ax += 1;
  ax += joy.vx; az += joy.vy;
  if (teclas.has('q')) cam.yaw += dt * 1.6;
  if (teclas.has('e')) cam.yaw -= dt * 1.6;
  // con la cámara libre, lo que mueve es la cámara (volando en 3D) y el personaje se queda quieto donde estaba
  if (camLibre.activa) { moverCamaraLibre(ax, az, dt); ax = 0; az = 0; }
  const mag = Math.min(1, Math.hypot(ax, az));
  // el agua donde estás (valravnx, 30 oct; src/logica/nado.js): a pie, vadeando o nadando, con un solo aguante para
  // correr y nadar; nadando baja más deprisa cuanto más pesa lo que llevas, y sin aguante te ahogas
  const ag = mundoJ && pj.k === 0 ? mundoJ.aguaEn(pj.x, pj.z) : null;
  const modo = modoAgua(ag ? ag.hondo : null);
  nado.modo = modo; nado.agua = ag;
  if (modo === 'nadar' && combate.activo && !window.__mutarPelea) { combate.guardar(); mostrarAviso(t('armaNadando')); }   // nadando no se lucha
  const rapido = teclas.has('shift');
  // rendido (el cansancio al máximo), no se corre; helado, más lento (P4; src/logica/necesidades.js; el servidor tampoco
  // deja ir más deprisa, src/logica/presencia.js)
  const efNec = necesidades ? efectosNecesidades(necesidades) : null;
  const correr = rapido && modo !== 'nadar' && puedeCorrer(nado.e) && !(efNec && efNec.sinCorrer);
  let vel = (correr ? 6 : 3.6) * mag * velocidadCarga() * combate.factorVelocidad(correr); // cargado al máximo en todo, al 80% (GDD); con el arma sacada, lo que diga el combate
  if (modo === 'vadear') vel *= factorVadeo(ag.hondo);
  if (efNec && efNec.torpe) vel *= 0.8;
  if (modo === 'nadar') vel = (rapido && nado.e.aguante > 0 ? NADO.velNadarRapido : NADO.velNadar) * mag;
  vel *= velocidadAdmin();   // la cuenta de admin con su velocidad multiplicada (src/logica/admin.js; el servidor la deja)
  nado.e = pasoAguante(nado.e, dt, { modo, moviendo: mag > 0.05, rapido, kg: inventario().kilos() });
  if (modo === 'nadar' && ag) { pj.x += ag.dx * NADO.arrastre * dt; pj.z += ag.dz * NADO.arrastre * dt; }   // la corriente te lleva
  if (nado.e.muerto) ahogado();
  pintarAguante();
  if (mag > 0.05) {
    despertar();           // moverse te levanta de la cama
    levantarse();          // y del suelo
    estado.talando = null; // moverse deja de talar
    if (estado.obrando || estado.obrandoPuesto) { estado.obrando = null; estado.obrandoPuesto = null; mostrarAviso(t('dejasObra')); } // y de construir
    const s = Math.sin(cam.yaw), co = Math.cos(cam.yaw);
    const dx = (ax * co + az * s) / Math.hypot(ax, az);
    const dz = (-ax * s + az * co) / Math.hypot(ax, az);
    let nx = pj.x + dx * vel * dt, nz = pj.z + dz * vel * dt;
    const r = resolverColision(nx, nz, pj.k);
    if (!mundoJ) { pj.x = THREE.MathUtils.clamp(r.x, -190, 190); pj.z = THREE.MathUtils.clamp(r.z, -190, 190); }
    // en el mundo: dentro de la isla, sin meterse en el mar ni subir por las paredes de los cortados (si no se puede
    // de frente, se prueba a deslizarse por cada eje)
    else if (pj.k > 0 || mundoJ.andable(pj.x, pj.z, r.x, r.z) || (modo === 'nadar' && modoAgua(mundoJ.aguaEn(r.x, r.z)?.hondo) === 'nadar' && mundoJ.dentro(r.x, r.z))) { pj.x = r.x; pj.z = r.z; }   // nadando, el fondo no frena
    else if (mundoJ.andable(pj.x, pj.z, r.x, pj.z)) pj.x = r.x;
    else if (mundoJ.andable(pj.x, pj.z, pj.x, r.z)) pj.z = r.z;
    const objetivoRot = Math.atan2(dx, dz);
    let dr = objetivoRot - pj.rot;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    pj.rot += dr * Math.min(1, dt * 12);
    // en táctil, el puntero de construcción acompaña al personaje
    if (estado.esTactil && estado.modo === 'construir' && estado.punteroSigue) {
      estado.puntero = { x: pj.x + Math.sin(pj.rot) * 3, z: pj.z + Math.cos(pj.rot) * 3, ySuperficie: 0 };
      evaluarColocacion();
    }
  }
  pj.vel = vel;
  // nadando, el cuerpo va en el agua con la cabeza fuera (el pecho a ras del agua: las olas del mar suben hasta medio metro) y se mece un poco
  // (en el mar, subiendo y bajando con las olas)
  const yObjetivo = modo === 'nadar' ? ag.superficie - 1.25 + (ag.mar ? alturaOla(pj.x, pj.z) : Math.sin(performance.now() / 600) * 0.04) : alturaSuelo();
  // (window.__mutarSuelo: solo para romper a propósito la prueba del mundo, los pies siguen el suelo muy despacio)
  pj.y += (yObjetivo + (estado.durmiendo ? estado.durmiendo.alto : 0) - pj.y) * Math.min(1, dt * (window.__mutarSuelo ? 0.5 : 14));   // dormido, encima del lecho
  jugador.raiz.position.set(pj.x, pj.y, pj.z);
  jugador.raiz.rotation.y = pj.rot;
  pasoObra(); pasoPuesto();
  if (rampa && !(estado.obrando && estado.obrando.subir)) quitarRampa(); // se dejó de subir (moverse, reiniciar…)
  moverRampa(dt);
  jugador.animar(mag > 0.05 ? vel : 0, dt, !!estado.talando || !!estado.obrando || !!estado.obrandoPuesto);
  combate.paso(dt, { corriendo: correr && mag > 0.05, velocidad: mag > 0.05 ? vel : 0 });

  // interiores: ocultar plantas superiores y tejados si estás bajo techo, y también los muebles de esas plantas
  // (antes se veían los del piso de arriba estando abajo; lo vio valravnx el 27 oct)
  let bajoTecho = false;
  for (const g of raizConstr.children) {
    const c = g.userData.c;
    const l = mundoALocal(c, pj.x, pj.z);
    const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
    let techo = false;
    for (let k = pj.k + 1; k <= 4 && !techo; k++) if (c.piezas.has(clave('f', i, j, k)) || c.piezas.has(clave('r', i, j, k))) techo = true;
    if (techo) bajoTecho = true;
    for (const obj of g.children) obj.visible = !techo || obj.userData.k <= pj.k;
  }
  for (const obj of raizDeco.children) obj.visible = !bajoTecho || plantaDeco(obj.userData.deco) <= pj.k;
  if (!menuUsar.hidden && Math.hypot(pj.x - menuUsar.dataset.x, pj.z - menuUsar.dataset.z) > 1) cerrarMenuUsar(); // te alejas: lo de la lista ya no está al alcance
  const it = interactivoCercano();
  recoleccion.paso(pj); // vuelve a salir lo que toca (y en el mundo, lo de alrededor del jugador)
  talaV.paso(dt); // el árbol que cae y los que vuelven a crecer
  if (estado.talando && (estado.golpeEn -= dt) <= 0) golpeTala();
  sueloObjetos.paso(); // desaparece lo soltado hace más de una hora fuera de tus tierras
  pintarAccion();

  moverGente(dt);
  if (fauna) fauna.paso(dt, pj);
  moverFuegos();
  if (charla) charla.paso();
  if (enLinea) enLinea.paso(dt, { x: pj.x, y: pj.y, z: pj.z, giro: pj.rot, anim: mag > 0.05 ? (vel < 1.8 ? 'andar' : 'correr') : estado.durmiendo ? 'dormir' : estado.sentado ? 'sentado' : (estado.talando || estado.obrando ? 'talar' : 'quieto') });
  pasoRastras();
  actualizarCamara();
  cielo.paso();
  graficos.dibujar(dt);
  requestAnimationFrame(paso);
}

// ---------------- Interfaz ----------------
const CATEGORIAS = [
  ['tierra', t('catTierra')], ['base', t('catBase')], ['estructura', t('catEstructura')], ['muro', t('catMuros')],
  ['tejado', t('catTejados')], ['acceso', t('catAcceso')], ['exterior', t('catExterior')], ['puestos', tr('Puestos de trabajo')], ['almacenajes', tr('Almacenajes')], ['camas', tr('Camas')], ['deco', t('catDeco')],
];
let categoria = 'base';
function construirBarra() {
  const tabs = $('pestanas'); tabs.innerHTML = '';
  for (const [id, nombre] of CATEGORIAS) {
    const b = document.createElement('button');
    b.textContent = nombre; b.dataset.cat = id;
    b.className = id === categoria ? 'sel' : '';
    b.onclick = () => { categoria = id; construirBarra(); };
    tabs.appendChild(b);
  }
  const lista = $('piezas'); lista.innerHTML = '';
  const catPuesto = k => esAlmacen(k) ? 'almacenajes' : esCama(k) ? 'camas' : 'puestos';
  const entradas = categoria === 'puestos' || categoria === 'almacenajes' || categoria === 'camas'
    ? Object.entries(ESTACIONES).filter(([k]) => catPuesto(k) === categoria).map(([k, d]) => ({ clase: 'puesto', tipo: k, def: d }))
    : categoria === 'deco'
    ? Object.entries(DECORACION).filter(([, d]) => enEsteTramo(d)).map(([k, d]) => ({ clase: 'deco', tipo: k, def: d }))
    : Object.entries(PIEZAS).filter(([, d]) => d.cat === categoria && enEsteTramo(d)).map(([k, d]) => ({ clase: k === 'mojon' ? 'mojon' : 'pieza', tipo: k, def: d }));
  if (categoria === 'tierra') entradas.push({ clase: 'nivelar', tipo: 'brocha', def: { nombre: 'Brocha de nivelar', coste: {} }, nota: tr('alisa el suelo') });
  for (const e of entradas) {
    const b = document.createElement('button');
    b.className = 'pieza' + (estado.sel.tipo === e.tipo ? ' sel' : '');
    const coste = e.nota || (e.clase === 'puesto'
      ? Object.entries(e.def.coste).map(([m, n]) => `${n} ${tr(CATALOGO[m].nombre).toLowerCase()}`).join(' · ') + ' · ' + tr(DONDE[e.def.donde]).toLowerCase()
      : Object.entries(e.def.coste).map(([m, n]) => `${n} ${tr(MATERIALES[m]).toLowerCase()}`).join(' · '));
    b.innerHTML = `<b>${tr(e.def.nombre)}</b><small>${coste}</small>`;
    if (e.clase === 'nivelar') b.id = 'btnBrocha';
    b.onclick = () => {
      estado.sel = { clase: e.clase, tipo: e.tipo };
      estado.dir = 0;
      if (e.clase === 'nivelar') estado.alturaBrocha = null; // al volver a coger la brocha, la altura se vuelve a tomar del suelo
      if (estado.modo !== 'construir') cambiarModo('construir');
      construirBarra(); evaluarColocacion();
    };
    lista.appendChild(b);
  }
}
function marcarSeleccion() { categoria = estado.sel.clase === 'deco' ? 'deco' : estado.sel.clase === 'puesto' ? 'puestos' : (estado.sel.clase === 'mojon' || estado.sel.clase === 'nivelar' ? 'tierra' : PIEZAS[estado.sel.tipo].cat); construirBarra(); }

// El contador de arriba (valravnx, 1 nov): en línea, solo dentro de tu tierra (la zona de tu mojón) y con lo que tienes
// almacenado en ella; fuera, no sale. Lo almacenado es lo guardado en los almacenajes de la base de tu tierra (7 nov:
// el acopio de troncos, la pila de piedras, la leñera), de los que te llegan del servidor (los trozos de tu alrededor);
// hasta que los hubo, era lo que había en el suelo de tu tierra. Sin servidor (las pruebas de navegador), lo que hay en
// el arcón de pruebas, como antes.
let htmlMateriales = null;
// El contador de arriba (lo almacenado en tu tierra), plegado (valravnx, 9 nov: «desplegable y nunca fijo, porque tapa
// mucha pantalla sobre todo en móvil»): una placa pequeña con el total; tocándola se despliega la lista y se vuelve a
// plegar. Siempre empieza plegado.
let materialesAbierto = false;
function pintarMateriales() {
  const m = $('materiales');
  let html = '', titulo = '', total = 0;
  if (!enLinea) { titulo = tr('En el arcón:'); html = Object.entries(MATERIALES).map(([k, n]) => { total += mundo.materiales[k] ?? 0; return `<span><b>${mundo.materiales[k] ?? 0}</b> ${tr(n).toLowerCase()}</span>`; }).join(''); }
  else {
    const mojon = miMojon(), zona = mojon ? mundo.tierraDe(mojon.x, mojon.z) : null;
    const esMio = (x, z) => zona !== null && mundo.tierraDe(x, z) === zona;
    if (esMio(pj.x, pj.z)) {
      const hay = {};
      for (const e of Object.values(fabCliente.estaciones)) if (esAlmacen(e.tipo) && !e.obra && esMio(e.x, e.z))
        for (const [k, n] of Object.entries(e.deposito || {})) hay[k] = (hay[k] || 0) + n;
      const ks = Object.keys(hay).filter(k => CATALOGO[k]).sort((a, b) => hay[b] - hay[a]);
      titulo = tr('En tu tierra:'); total = ks.reduce((t, k) => t + hay[k], 0);
      html = ks.length ? ks.map(k => `<span><b>${hay[k]}</b> ${tr(CATALOGO[k].nombre).toLowerCase()}</span>`).join('')
        : `<span>${tr('aún no tienes nada almacenado')}</span>`;
    }
  }
  if (html) html = `<button type="button" class="mat-cab" aria-expanded="${materialesAbierto}">${titulo.replace(/:$/, '')} <b>${total}</b><i class="fl"></i></button><div class="mat-lista">${html}</div>`;
  if (html !== htmlMateriales) { htmlMateriales = html; m.innerHTML = html; }
  m.classList.toggle('abierto', materialesAbierto);
  m.hidden = !html;
}
$('materiales').addEventListener('click', (e) => {
  if (!e.target.closest('.mat-cab')) return;
  materialesAbierto = !materialesAbierto; htmlMateriales = null; pintarMateriales();
});
let ultimoMateriales = 0;

// ---------------- La acción, a la vista (estudio de la interfaz del 7 nov) ----------------
// Cada poco (no en cada fotograma: mira todo lo de alrededor) se mira qué haría Usar y qué más hay al alcance; en cada
// fotograma se coloca la etiqueta sobre la cosa y el aro en el suelo bajo ella. En PC, la tecla F; con varias cosas, la
// lista (clic en una para hacerla). En el móvil, el botón de acción grande lleva la imagen de la cosa y el verbo.
document.body.classList.toggle('tactil-ui', !!estado.esTactil);
const aroAccion = new THREE.Group();
{
  const mat = (o) => new THREE.MeshBasicMaterial({ color: 0xf0c46e, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const filo = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.5, 48), mat(0.9));
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.56, 48), mat(0.14));
  for (const m of [halo, filo]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 3; aroAccion.add(m); }
  aroAccion.visible = false;
  escena.add(aroAccion);
}
const RADIO_ARO = { arbol: 1.1, obra: 1.0, est: 0.85 };
let accionVista = null, accionOps = [], accionHasta = 0;
const vProy = new THREE.Vector3();
const urlIcono = (ic) => !ic ? '' : ic.startsWith('g_') ? '../../' + CARPETA_INTERFAZ + ic + '.webp' : carpetaIconos() + ic + '.webp';
function pintarAccion() {
  const ahora = performance.now();
  const etq = $('accionEtq'), lista = $('accionLista'), btn = $('btnUsar');
  const ocultar = estado.modo !== 'mover' || document.body.classList.contains('combate') || !menuUsar.hidden
    || (panelFabricar && panelFabricar.abierto && estado.esTactil) || (panelInventario && panelInventario.abierto && estado.esTactil);
  if (ahora >= accionHasta) {
    accionHasta = ahora + 150;
    accionVista = ocultar ? null : accionPrincipal();
    // la lista: lo demás que hay al alcance (lo mismo que el clic derecho), sin repetir la acción de Usar. Solo cuando se
    // pide (valravnx, 8 nov: «salen solos, siendo un caos… toggle con alt o click derecho, pero no todo el rato»): Alt en
    // PC y mantener pulsado el botón de acción en el móvil la abren y la cierran; sin pedirla, la etiqueta dice que hay más
    const otras = accionVista ? opcionesUsar().filter(o => o.texto !== accionVista.texto) : [];
    // se cierra sola al cambiar de cosa (al alejarte o al hacerla): abrirla vale para lo que tienes delante, no para siempre
    const cosa = accionVista ? `${accionVista.pos.x.toFixed(1)},${accionVista.pos.z.toFixed(1)}` : null;
    if (estado.verLista && cosa !== estado.listaDe) estado.verLista = false;
    accionOps = estado.verLista ? otras.slice(0, 3) : [];
    accionVista && (accionVista.hayMas = !estado.verLista && otras.length > 0);
    pintarBotonAccion(btn, accionVista);
    pintarLista(lista, accionVista, accionOps);
  }
  const a = accionVista;
  btn.classList.toggle('activo', !!a && !a.apagada);
  if (!a) { etq.hidden = true; lista.hidden = true; aroAccion.visible = false; return; }
  const y0 = a.y ?? sueloEn(a.pos.x, a.pos.z);
  // el aro, en el suelo bajo la cosa (algo más grande para un árbol, una obra o una estación)
  const r = a.icono === 'g_construir' ? RADIO_ARO.obra : (a.alto || 0) >= 3 ? RADIO_ARO.arbol : String(a.icono).startsWith('est_') ? RADIO_ARO.est : (a.alto || 0) <= 0.4 ? 0.42 : 0.6;
  aroAccion.visible = !(a.pos.x === pj.x && a.pos.z === pj.z); // (lo que va contigo, como comer, no lleva aro)
  aroAccion.position.set(a.pos.x, y0 + 0.04, a.pos.z); aroAccion.scale.setScalar(r / 0.5);
  // la etiqueta, sobre la cosa (si está delante de la cámara)
  vProy.set(a.pos.x, y0 + Math.min(a.alto ?? 1, 2.2) + 0.15, a.pos.z).project(camara);
  const rc = renderer.domElement.getBoundingClientRect();
  if (vProy.z >= 1 || Math.abs(vProy.x) > 1.1 || Math.abs(vProy.y) > 1.1) { etq.hidden = true; lista.hidden = true; return; }
  const sx = rc.left + (vProy.x + 1) / 2 * rc.width, sy = rc.top + (1 - vProy.y) / 2 * rc.height;
  const clave = [a.texto, a.sub, a.barra, a.apagada, a.hayMas, Math.round((a.prog || 0) * 20)].join('|');
  if (etq.dataset.clave !== clave) {
    etq.dataset.clave = clave;
    const L = 2 * Math.PI * 8;
    const prog = a.prog ? `<svg class="prog" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle cx="10" cy="10" r="8" fill="none" stroke="#f0c46e" stroke-width="3" stroke-dasharray="${L * a.prog} ${L}"/></svg>` : '';
    const mas = a.hayMas ? `<span class="mas">${estado.esTactil ? '' : '<span class="k">Alt</span>'}${esc(tr('más'))}</span>` : '';
    etq.innerHTML = `<div class="etq placa"><div class="lin">${estado.esTactil ? '' : '<span class="k">F</span>'}<span>${esc(a.texto)}</span>${prog}${mas}</div>`
      + (a.sub ? `<small>${esc(a.sub)}</small>` : '') + (a.barra !== undefined ? `<div class="barra"><i style="width:${Math.round(a.barra * 100)}%"></i></div>` : '') + '</div>';
    etq.classList.toggle('apagada', !!a.apagada);
  }
  // en el móvil, sin etiqueta sobre la cosa (valravnx, 9 nov: «cuando paso delante de algo sale»): el botón de acción
  // grande ya lleva su imagen, el verbo y lo que falta; queda el aro en el suelo
  etq.hidden = !!estado.esTactil;
  // (que no se salga por los lados)
  const ancho = etq.offsetWidth / 2 + 8;
  etq.style.left = Math.max(ancho, Math.min(innerWidth - ancho, sx)) + 'px';
  etq.style.top = Math.max(etq.offsetHeight + 8, sy - 10) + 'px';
  if (!lista.hidden && !estado.esTactil) { lista.style.left = Math.min(innerWidth - lista.offsetWidth - 10, sx + ancho - 4) + 'px'; lista.style.top = Math.max(60, sy - etq.offsetHeight - 10) + 'px'; }
}
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function pintarBotonAccion(btn, a) {
  const img = btn.querySelector('.ic'), verbo = btn.querySelector('.verbo'), lleno = btn.querySelector('.lleno'), prog = btn.querySelector('.prog');
  if (!img) return;
  const ic = a ? a.icono : 'g_colocar', src = window.__sinImagenes ? '' : urlIcono(ic);
  if (img.getAttribute('src') !== src) { if (src) img.setAttribute('src', src); else img.removeAttribute('src'); }
  img.classList.toggle('g', String(ic).startsWith('g_'));
  // el verbo, corto: lo de antes de los dos puntos («Coger del suelo: 2 × Rama» → «Coger del suelo»)
  verbo.textContent = a ? a.texto.split(/[:(]/)[0].trim() : tr('Usar');
  btn.setAttribute('aria-label', a ? a.texto : tr('Usar'));
  prog.toggleAttribute('hidden', !(a && a.prog));   // (un svg no tiene .hidden)
  if (a && a.prog) lleno.setAttribute('stroke-dasharray', `${2 * Math.PI * 51 * a.prog} 400`);
}
function pintarLista(lista, a, ops) {
  if (!a || !ops.length) { lista.hidden = true; lista.innerHTML = ''; return; }
  const clave = [a.texto, ...ops.map(o => o.texto)].join('|');
  lista.hidden = false;
  if (lista.dataset.clave === clave) return;
  lista.dataset.clave = clave;
  lista.innerHTML = '';
  const fila = (texto, icono, hacer, sel) => {
    const b = document.createElement('button');
    b.className = 'placa' + (sel ? ' sel' : '');
    b.innerHTML = `${icono && !window.__sinImagenes ? `<img src="${urlIcono(icono)}" alt="" onerror="this.style.visibility='hidden'">` : '<img alt="" style="visibility:hidden">'}<span>${esc(texto)}</span>${sel && !estado.esTactil ? '<span class="k">F</span>' : ''}`;
    b.onclick = (e) => { e.stopPropagation(); hacer(); accionHasta = 0; };
    lista.appendChild(b);
  };
  fila(a.texto, a.icono, a.hacer, true);
  for (const o of ops) fila(o.texto, null, o.hacer, false);
}

function actualizarUI() {
  pintarMateriales();
  for (const b of document.querySelectorAll('#modos button')) b.classList.toggle('sel', b.dataset.modo === estado.modo);
  $('barra').hidden = estado.modo !== 'construir';
  $('btnColocar').hidden = !(estado.modo === 'construir' && estado.esTactil);
  $('btnGirar').hidden = estado.modo !== 'construir';
  $('controlPlanta').hidden = estado.modo !== 'construir';
  document.body.classList.toggle('construyendo', estado.modo === 'construir');
  document.body.classList.toggle('desmontando', estado.modo === 'desmontar');
  $('planta').textContent = `${t('planta')} ${estado.planta}`;
  if (!miMojon() && estado.modo !== 'construir') mostrarAviso(t('consejoMojon'));
}
let temporizadorAviso = null;
function mostrarAviso(txt, error = false) {
  const a = $('aviso');
  a.textContent = txt;
  a.className = error ? 'error' : '';
  a.hidden = !txt;
  colocarAviso();
  // (valravnx, 8 nov) los avisos se van solos a los 2 segundos: tapaban la pantalla y no se quitaban nunca
  clearTimeout(mostrarAviso.t);
  if (txt) mostrarAviso.t = setTimeout(() => { if (a.textContent === txt) a.hidden = true; }, 2000);
}

for (const b of document.querySelectorAll('#modos button')) b.onclick = () => cambiarModo(b.dataset.modo);
$('btnGirar').onclick = girar;
$('btnColocar').onclick = colocar;
$('btnSube').onclick = () => cambiarPlanta(1);
$('btnBaja').onclick = () => cambiarPlanta(-1);
$('btnUsar').onclick = () => { if (estado.listaPorToque) { estado.listaPorToque = false; return; } cerrarMenuUsar(); usar(); };
// la lista de lo demás que hay al alcance, solo cuando se pide: Alt en PC; mantener pulsado el botón de acción en el móvil
function alternarLista() {
  estado.verLista = !estado.verLista; accionHasta = 0;
  estado.listaDe = accionVista ? `${accionVista.pos.x.toFixed(1)},${accionVista.pos.z.toFixed(1)}` : null;
}
addEventListener('keydown', (e) => {
  if (e.key !== 'Alt' || e.repeat || e.ctrlKey || e.metaKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  e.preventDefault(); alternarLista();
});
addEventListener('keyup', (e) => { if (e.key === 'Alt') e.preventDefault(); });   // (que el navegador no se vaya a su menú)
{
  let t = null;
  $('btnUsar').addEventListener('pointerdown', () => { clearTimeout(t); t = setTimeout(() => { estado.listaPorToque = true; alternarLista(); }, 450); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('btnUsar').addEventListener(ev, () => clearTimeout(t));
}
// se cierra al pulsar fuera, con Escape o al alejarse
addEventListener('pointerdown', (e) => { if (!menuUsar.hidden && !menuUsar.contains(e.target)) cerrarMenuUsar(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenuUsar(); });
$('btnConfirmar').onclick = confirmarDesmontaje;
$('btnCancelar').onclick = () => { $('confirmar').hidden = true; limpiarResaltado(); estado.pendienteDesmontar = null; mostrarAviso(''); };
// Panel de inventario (hito 2): lo que llevas encima y un arcón de pruebas para coger equipo.
// El arcón de pruebas tiene también los materiales de obra (el montón común de antes): se cogen con acciones del mundo.
const panelInventario = montarPanelInventario({ panel: $('panelInventario'), boton: $('btnInventario'), inventario, accion: accionInventario, alSuelo: arconAlSuelo, soltarSuelo: (ruta) => soltarAlSuelo(ruta), comer: (t) => comer(t), comestible,
  accionArcon: (a) => { const r = accion(a); if (r.ok) { guardar(); actualizarUI(); } return r; }, materialesArcon: () => (hayArcon() ? mundo.materiales : null), hayArcon,
  alCambiar: () => { pintarLlevas(); vestir(); }, retrato: (lienzo) => dibujarRetrato(renderer, jugador.mh, lienzo) });
// El mapa del rey (valravnx, 31 oct): Whitholm, la isla del rey, cartografiada; lo llevas desde que apareces y se abre con
// M o el botón «Mapa» (src/juego/mapa_rey.js). Solo en el mundo de verdad. Al abrirlo se suelta el ratón (el combate lo
// coge) y las teclas pulsadas, para no seguir andando sin ver.
const mapaRey = mundoJ ? montarMapaRey({ paisaje: mundoJ.paisaje, comarcas: comarcasMundo, esTactil: matchMedia('(pointer: coarse)').matches,
  posicion: () => ({ x: pj.x + mundoJ.salida.x, z: pj.z + mundoJ.salida.z, rot: pj.rot }),
  // tu tierra (la zona entera de tu mojón): dónde está tu mojón, en m del mundo
  tuTierra: () => { const m = miMojon(); return m ? { x: m.x + mundoJ.salida.x, z: m.z + mundoJ.salida.z } : null; },
  // las tierras de los demás (valravnx, 8 nov): cada mojón del mundo (los mojones y los invitados son de todos: los
  // manda el servidor a cada uno), y si su dueño te ha invitado a construir
  tomadas: () => { const yo = yoAutor(); return Object.entries(mundo.mojones)
    .map(([a, m]) => ({ x: m.x + mundoJ.salida.x, z: m.z + mundoJ.salida.z, dueno: a, tuya: a === yo, invita: a !== yo && mundo.invitadosDe(a).includes(yo) })); },
  zonasRey: zonasRey ? zonasRey.lista : [],   // las zonas del rey, de oro viejo
  alAbrir: () => { if (document.pointerLockElement) document.exitPointerLock(); teclas.clear(); cerrarMenuUsar(); } }) : null;
if ($('btnMapa')) { $('btnMapa').hidden = !mapaRey; $('btnMapa').onclick = () => mapaRey && mapaRey.alternar(); }
// El personaje lleva puesto lo que dice el inventario (valravnx, 29 oct: el inventario es el equipo). La ropa elegida
// en el visor de personaje entra en el inventario una vez por cada elección; después manda el inventario.
const SEXO = elegido ? elegido.sexo : 'hombre';
const CLAVE_ROPA_VISOR = 'kinhold_ropa_visor_v1';
// Cada prenda entra con el tinte y la hechura que se le dieron en el visor (src/logica/hechura.js: rasgosPrenda): desde
// ahí son suyos y van con ella (al quitársela, al soltarla, al dejarla en el arcón no: el arcón la devuelve sin coser).
// En línea, la ropa entra en lo que llevas en el servidor (por el arcón de pruebas), al llegar su bienvenida, una vez por
// cada elección y cada jugador del servidor (clave: también su autor; tras un borrado del mundo, otra vez).
function ropaDelVisor() {
  if (!elegido) return;
  if (EN_LINEA && !(enLinea && enLinea.red.yo && objetosRed.deServidor)) return;
  const huella = JSON.stringify([elegido.sexo, elegido.capas, elegido.tintes || null, elegido.hechuras || null]) + (EN_LINEA ? '@' + enLinea.red.yo : '');
  let hecha = null; try { hecha = almacenNav && almacenNav.getItem(CLAVE_ROPA_VISOR + (EN_LINEA ? '_red' : '')); } catch (e) { /* sin almacenamiento */ }
  if (hecha === huella) return;
  for (const p of prendasDeCapas(elegido.capas, elegido.sexo)) {
    const lugar = 'ropa:' + PRENDAS[p].capa, ya = inventario().lugares[lugar], d = PRENDAS[p].dibujo;
    const rasgos = rasgosPrenda(p, { hechura: elegido.hechuras && elegido.hechuras[d], tinte: elegido.tintes && elegido.tintes.prendas && elegido.tintes.prendas[d] });
    if (ya && ya.tipo === p && JSON.stringify(rasgosPrenda(p, ya)) === JSON.stringify(rasgos)) continue;
    if (ya) accionInventario({ tipo: 'soltar', de: lugar });
    accionInventario({ tipo: 'coger', objeto: p, cantidad: 1, a: lugar, ...rasgos });
  }
  try { almacenNav && almacenNav.setItem(CLAVE_ROPA_VISOR + (EN_LINEA ? '_red' : ''), huella); } catch (e) { /* sin almacenamiento */ }
}
// lo que se ve puesto: capas, tintes y hechura de cada prenda del inventario (el blasón, el del visor)
const vestidoAhora = () => vestidoDe(inventario().lugares, SEXO, elegido && elegido.tintes && elegido.tintes.blason);
let vestidoVisto = '';
function vestir() {
  const v = vestidoAhora(), huella = JSON.stringify(v);
  if (jugador.mh) { jugador.mh.ponerHechuras(v.hechuras); jugador.mh.ponerTintes(v.tintes); jugador.mh.ponerCapas(v.capas); }
  // en línea, los demás lo ven igual: se vuelve a mandar el aspecto si ha cambiado lo que se ve
  if (huella !== vestidoVisto) { vestidoVisto = huella; if (enLinea && enLinea.mandarAspecto) enLinea.mandarAspecto(); }
  // el hacha de mano se ve en la mano derecha si la llevas en una mano (lo demás de las manos, con su tarea del hito 2)
  jugador.hachaEnMano = ['mano:der', 'mano:izq'].some(l => HACHAS[inventario().lugares[l]?.tipo] || inventario().lugares[l]?.tipo === 'mazo_piedra');
  // lo demás que llevas (cinturón y lo que cuelga, espalda, hombro y manos) se ve puesto (src/juego/llevado.js); en
  // línea, a los demás se lo cuenta el servidor con tu aspecto, sacado de su inventario
  jugador.ponerLlevado(llevadoDe(inventario().lugares));
}
ropaDelVisor();
jugador.listo.then(vestir);
// El combate en el mundo (valravnx, 30 oct): arma sacada con C o «Arma», ratón cogido, golpes cargados y paradas por lado
const combate = crearCombateMundo({
  escena, camara, lienzo, pj, cam, jugador, recursos: RECURSOS_MH, sexo: SEXO, aspecto: elegido ? elegido.aspecto : undefined,
  capasActuales: () => vestidoAhora().capas,
  // el duelo con lo que llevas (7 nov): lo que frena un golpe sale de las prendas que llevas puestas; en línea las pone
  // el servidor, de su inventario (esto es solo la copia del navegador hasta que llega su foto)
  prendasActuales: () => puestasDe(inventario().lugares),
  // y el arma, lo que llevas en la mano (valravnx, 9 nov; src/logica/arma_mano.js)
  armaMano: () => armaDeMano(inventario().lugares), lugares: () => inventario().lugares,
  modo: () => estado.modo, alturaEn: (x, z) => decorado.altura(x, z),
  registro: { anotar: (a, r) => registroAcciones.anotar(a, r) }, esTactil: estado.esTactil,
  red: () => enLinea,   // en línea, lo que haces con el arma va también al servidor (pelear con los demás)
  // (window.__mutarPelea: solo para romper la prueba a propósito: el rival atraviesa todo y se lucha nadando)
  andarHasta: window.__mutarPelea ? (x0, z0, x1, z1) => ({ x: x1, z: z1 }) : andarHasta,
  puedeLuchar: () => window.__mutarPelea || nado.modo !== 'nadar',
});
// Lo que llevas, abajo (estudio de la interfaz del 7 nov, octava versión; valravnx: «aplica por ahora»): tus dos manos,
// cada una con la imagen de lo que tiene (o vacía), el hombro solo si llevas algo en él, y el cinto con lo primero que
// cuelga de él (tocarlo: a una mano libre). En cada cosa, un botón para soltarla al suelo (a tus pies) y, en lo que se
// lleva al hombro (el tronco), otro para pasarla al hombro o a las manos. Debajo, una raya con lo cargado que vas.
// Las imágenes son las del panel de equipo (sacadas de los modelos del juego; la ropa, dibujada con su tinte) y los
// huecos y botones, los del kit renderizado (recursos/interfaz-v1/). El nombre va también en texto (para lectores de
// pantalla y en el título). Arrastrar la rastra o empujar la carretilla sale aparte, con su botón.
function pintarLlevas() {
  const inv = inventario(), kit = '../../' + CARPETA_INTERFAZ;
  const nombre = c => tr(CATALOGO[c.tipo].nombre) + (c.n > 1 ? ' ×' + c.n : '');
  const imagen = c => window.__sinImagenes ? '' : PRENDAS[c.tipo] ? svgPrenda(c.tipo, c) : `<img src="${carpetaIconos()}${c.tipo}.webp" alt="" onerror="this.style.visibility='hidden'">`;
  const hombroCambia = l => { const c = inv.lugares[l]; return !!c && !!CATALOGO[c.tipo].hombro && !CATALOGO[c.tipo].lugar; };
  const alHombro = !!inv.lugares.hombro;
  const hueco = (l, et, clase = '') => {
    const c = inv.lugares[l], bloq = !c && l.startsWith('mano:') && (inv.manoBloqueada(l) || alHombro);
    if (!c) return `<div class="hu ${clase}${bloq ? ' apagada' : ''}" title="${tr(et)}"></div>`;
    const cambio = hombroCambia(l) ? (l === 'hombro'
      ? `<button data-amanos="1" title="${tr('A las manos')}"><img src="${kit}g_amanos.webp" alt=""><span class="sr">${tr('A las manos')}</span></button>`
      : `<button data-alhombro="${l}" title="${tr('Al hombro')}"><img src="${kit}g_alhombro.webp" alt=""><span class="sr">${tr('Al hombro')}</span></button>`) : '';
    return `<div class="hu ${clase}${l === 'hombro' ? ' sel' : ''}" title="${tr(et)}: ${nombre(c)}">${imagen(c)}${c.n > 1 ? `<span class="n">${c.n}</span>` : ''}
      <span class="sr">${tr(et)}: ${nombre(c)}</span>${cambio}<button data-soltar="${l}" title="${tr('Soltar')}"><img src="${kit}g_soltar.webp" alt=""><span class="sr">${tr('Soltar')}</span></button></div>`;
  };
  const partes = [hueco('mano:der', 'En la mano derecha'), hueco('mano:izq', 'En la mano izquierda')];
  if (alHombro) partes.push('<i class="sep"></i>', hueco('hombro', 'Al hombro', 'hombro'));
  // del cinto, lo primero que cuelga (una herramienta o un arma antes que lo demás)
  const delCinto = inv.huecosCintura().map(x => ({ ruta: x.ruta, c: inv.buscar(x.ruta).cosa })).filter(x => x.c);
  const cin = delCinto.find(x => !CATALOGO[x.c.tipo].recurso) || delCinto[0];
  if (cin) partes.push('<i class="sep"></i>', `<div class="hu cinto" data-cinto="${cin.ruta}" title="${tr('Al cinto')}: ${nombre(cin.c)} · ${tr('tócalo para cogerlo con la mano')}">${imagen(cin.c)}${cin.c.n > 1 ? `<span class="n">${cin.c.n}</span>` : ''}<span class="sr">${tr('Al cinto')}: ${nombre(cin.c)}</span></div>`);
  const ra = miRastra();
  if (ra && esCarr(ra)) partes.push(`<span class="llevo"><span>${tr('Empujas:')}</span><b>${tr('Carretilla')} (${nombreCarga(ra.cosa.carga)})</b><button data-soltarrastra="1">${tr('Aparcar')}</button></span>`);
  else if (ra) partes.push(`<span class="llevo"><span>${tr('Arrastras:')}</span><b>${tr('Rastra')} (${nombreCarga(ra.cosa.carga)})</b><button data-soltarrastra="1">${tr('Soltar')}</button></span>`);
  const f = Math.min(1, inv.lleno().fraccion);
  partes.push(`<span class="carga" title="${tr('Carga: {c}%', { c: Math.round(f * 100) })}"><i style="width:${Math.round(f * 100)}%"></i></span>`);
  $('llevas').hidden = false;
  $('llevas').innerHTML = partes.join('');
}
$('llevas').onclick = (e) => {
  const h = e.target.closest('[data-alhombro]'), m = e.target.closest('[data-amanos]');
  if (h || m) { cambiarHombro(h ? h.dataset.alhombro : null); return; }
  if (e.target.closest('[data-soltarrastra]')) { soltarRastra(); return; }
  const ci = e.target.closest('[data-cinto]');
  if (ci) { cogerDelCinto(ci.dataset.cinto); return; }
  const b = e.target.closest('[data-soltar]'); if (!b) return;
  soltarAlSuelo(b.dataset.soltar);
};
// Lo del cinto, a una mano libre (tocando su hueco abajo).
function cogerDelCinto(ruta) {
  const inv = inventario(), libre = ['mano:der', 'mano:izq'].find(m => !inv.lugares[m] && !inv.manoBloqueada(m));
  if (!libre) { mostrarAviso(tr('Llevas las manos ocupadas: suelta lo que llevas.'), true); return; }
  const r = accionInventario({ tipo: 'mover', de: ruta, a: libre });
  if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
  if (almacen) guardarInventarios(almacen, inventarios);
  pintarLlevas(); vestir(); panelInventario.pintar();
}
// Pasar el tronco corto de las manos al hombro (de: la mano donde está) o del hombro a las manos (de: null).
function cambiarHombro(de) {
  const r = de ? accionInventario({ tipo: 'ponerse', de }) : accionInventario({ tipo: 'quitarse', lugar: 'hombro', a: 'mano:der' });
  if (!r.ok) { mostrarAviso(tr(r.motivo === 'Ya llevas algo ahí: quítatelo antes.' ? 'Ya llevas algo al hombro: suéltalo antes.' : r.motivo), true); return r; }
  if (almacen) guardarInventarios(almacen, inventarios);
  pintarLlevas(); vestir(); panelInventario.pintar();
  mostrarAviso(de ? tr('Lo llevas al hombro.') : tr('Lo llevas con las dos manos.'));
  return r;
}
pintarLlevas();
// en línea, cuando llega lo que llevas en el servidor: el panel, la línea de abajo y lo que se ve puesto
function pintarTodoInventario() { pintarLlevas(); vestir(); panelInventario.pintar(); if (panelFabricar) panelFabricar.pintar(); }
// El panel de fabricación (P3): con H o el botón «Fabricar». En línea manda la acción al servidor (que pone el autor);
// sin él, la hace la lógica aquí mismo.
function hacerFabricacion(a, fin) {
  if (objetosRed) { objetosRed.mandar(a, fin); return; }
  const r = ejecutarFabricacion(fabCliente, inventarios, registroAcciones, { ...a, autor: AUTOR_LOCAL }, Date.now(), sueloObjetos.suelo, (x, z) => !!mundo.tierraDe(x, z), (x, z) => mundo.bajoTecho(x, z), (x, z) => mundo.muroCercano(x, z, 0.5));
  if (r.ok) { if (almacen) guardarInventarios(almacen, inventarios); sueloObjetos.refrescar(); estacionesV.refrescar(); pintarLlevas(); vestir(); panelInventario.pintar(); }
  fin(r.ok ? { ...r, estacion: r.estacion || r.id || null } : r);
}
panelFabricar = montarPanelFabricar({ panel: $('panelFabricar'), boton: $('btnFabricar'), fab: fabCliente, inventario, suelo: () => sueloObjetos.suelo,
  posicion: () => ({ x: pj.x, z: pj.z, rot: pj.rot }), hacer: hacerFabricacion, alAbrir: () => { if (panelInventario.abierto) panelInventario.cerrar(); teclas.clear(); } });
// lo que no cupo al cargar el inventario (por ejemplo, si un contenedor tiene ahora menos huecos) cae a tus pies
// (en línea, lo que lleva el servidor ya viene como cabe)
if (!EN_LINEA && sueloObjetos.dejarApartado(inventario(), AUTOR_LOCAL, pj.x, pj.z)) { if (almacen) guardarInventarios(almacen, inventarios); }
$('btnRellenar').onclick = () => { accion({ tipo: 'rellenar', cantidad: 50 }); guardar(); actualizarUI(); evaluarColocacion(); panelInventario.pintar(); }; // llena el arcón de pruebas
{
  let armado = false, tmr = null;
  $('btnReiniciar').onclick = () => {
    if (!armado) {
      armado = true; mostrarAviso(t('confirmaReinicio'), true);
      clearTimeout(tmr); tmr = setTimeout(() => { armado = false; }, 4000);
      return;
    }
    armado = false;
    mundo = new Mundo(); registroAcciones = new RegistroAcciones(); guardar(); reconstruir(); cambiarModo('mover');
  };
}
$('btnRegistro').onclick = () => { $('panelRegistro').hidden = !$('panelRegistro').hidden; $('panelAyuda').hidden = true; };
$('btnAyuda').onclick = () => { $('panelAyuda').hidden = !$('panelAyuda').hidden; $('panelRegistro').hidden = true; };
for (const b of document.querySelectorAll('.cerrar')) b.onclick = () => { b.closest('.panel').hidden = true; };
$('listaRegistro').innerHTML = REGISTRO.map(r => `<li>${tr(r)}</li>`).join('');
$('version').textContent = tr(VERSION);
$('ayudaPC').hidden = estado.esTactil;
$('ayudaTactil').hidden = !estado.esTactil;
$('joystick').hidden = !estado.esTactil;
$('chkSigue').onchange = (e) => { estado.punteroSigue = e.target.checked; };
estado.punteroSigue = false;
$('filaSigue').hidden = !estado.esTactil;

function redimensionar() {
  const w = innerWidth, h = innerHeight;
  graficos.setSize(w, h);
  camara.aspect = w / h; camara.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();
construirBarra();
reconstruir();
actualizarUI();
if (EN_LINEA) iniciarEnLinea();
paso();

// En línea: lo que llega del servidor cambia el mundo; se redibuja solo si cambia lo que se ve (un rato de trabajo
// de otro solo cuando su obra pasa de cuarto o se termina, como las propias).
function iniciarEnLinea() {
  $('btnReiniciar').hidden = true; // el mundo del servidor no se borra desde aquí
  $('btnRellenar').hidden = true;  // sin arcón, hasta que la bienvenida diga que el servidor lo tiene (el de verdad, no)
  const marca = document.createElement('span');
  marca.id = 'estadoRed';
  marca.style.cssText = 'pointer-events:auto;align-self:center;background:var(--panel);color:var(--acento);border-radius:9px;padding:6px 9px;font-size:12px';
  $('menu').prepend(marca);
  const cuarto = (m, e) => {
    const c = m.construcciones.find(x => x.id === e.datos.construccion), p = c && c.piezas.get(e.datos.clave);
    return !p ? -1 : p.obra ? Math.floor(4 * p.obra.trabajo / tiempoObra(p.tipo)) : 4;
  };
  const vistos = new Map(); // obra → cuarto de trabajo con el que se dibujó
  let colocadoEnLinea = false;
  fauna = crearFauna({ escena, alturaSuelo: (x, z) => sueloEn(x, z) });
  enLinea = conectarEnLinea({
    escena, recursos: RECURSOS_MH,
    alAbrir: (enviar) => objetosRed.conectar(enviar), alCortarse: () => { objetosRed.desconectar(); fauna.vaciar(); },
    // lo que llevas puesto en el inventario, con sus tintes y su hechura (cambia al vestirse: vestir() lo vuelve a mandar)
    aspecto: () => { const v = vestidoAhora(); return { sexo: SEXO, aspecto: elegido ? elegido.aspecto : undefined, capas: v.capas, tintes: v.tintes, hechuras: v.hechuras }; },
    avisar: mostrarAviso,
    alEstado: (txt) => { marca.textContent = txt; },
    alCambiar(info, msg) {
      if (fauna.recibir(msg)) return;   // las liebres de alrededor (src/juego/fauna.js)
      // pelear en el mundo: tus heridas y lo que pasa con tus golpes y los de los demás contra ti (src/juego/combate_mundo.js)
      if (msg.tipo === 'luchadores' || msg.tipo === 'combate' || msg.tipo === 'bienvenida') combate.recibir(msg, enLinea.red.yo || msg.autor, (a) => enLinea.modeloDe(a));
      if (msg.tipo === 'luchadores' || msg.tipo === 'combate' || msg.tipo === 'combate_rechazo') return;
      // lo que llevas, el suelo, lo talado y lo recogido (src/juego/objetos_en_linea.js)
      // tus necesidades (src/logica/necesidades.js): las lleva el servidor; aquí solo se guardan para enseñarlas
      if (msg.necesidades && (msg.tipo === 'necesidades' || msg.tipo === 'bienvenida')) { necesidades = validarNecesidades(msg.necesidades); avisosNec.pintar(necesidades); }
      if (msg.tipo === 'necesidades') return;
      if (msg.tipo === 'bienvenida' && Number.isFinite(msg.ahora)) desfaseReloj = msg.ahora - Date.now();   // (el reloj del servidor: la hora del cielo)
      if (msg.tipo === 'bienvenida') { arconServidor = msg.arcon === true; $('btnRellenar').hidden = !arconServidor; panelInventario.pintar(); }
      if (objetosRed.recibir(msg)) {
        if (msg.tipo === 'bienvenida') ropaDelVisor();
        if (msg.tipo !== 'bienvenida') return;
      }
      const antes = mundo;
      mundo = enLinea.red.mundo;
      const e = info.entrada;
      // la foto de las obras al cambiar de trozo (src/logica/obras_red.js): solo si trae algo distinto (si no, es otro
      // objeto con lo mismo y basta con reapuntar)
      let redibujar = info.cambio || (antes !== mundo && msg.tipo !== 'obras');
      if (e && (e.tipo === 'trabajar' || e.tipo === 'entregar' || e.tipo === 'subir' || e.tipo === 'rellenar')) {
        // el mundo puede ser el mismo objeto antes y después: se compara con el cuarto que se vio la última vez
        redibujar = false;
        if (e.tipo === 'trabajar') {
          const k = e.datos.construccion + '|' + e.datos.clave, n = cuarto(mundo, e), cambia = vistos.get(k) !== n;
          vistos.set(k, n);
          // la obra propia ya la ha redibujado pasoObra; la de otro: solo esa pieza, o todo al terminarse (se junta con las de al lado)
          if (cambia && e.autor !== enLinea.red.yo) { if (n >= 4 || n < 0) redibujar = true; else rehacerPieza(e.datos.construccion, e.datos.clave); }
        }
      }
      if (e && e.tipo === 'usar') {
        // abrir o cerrar una puerta: solo esa pieza (la propia ya se rehízo al usarla)
        redibujar = false;
        if (e.autor !== enLinea.red.yo) rehacerPieza(e.datos.construccion, e.datos.clave);
      }
      // volver donde lo dejaste (valravnx, 31 oct): la primera bienvenida trae dónde estabas al salir (si el servidor
      // lo sabe); al volver a conectar tras un corte no se mueve a nadie
      if (msg.tipo === 'bienvenida' && !colocadoEnLinea) {
        colocadoEnLinea = true;
        const p = msg.posicion;
        if (p && [p.x, p.y, p.z, p.giro].every(Number.isFinite)) Object.assign(pj, { x: p.x, y: p.y, z: p.z, rot: p.giro, vel: 0 });
        else if (!p && mundoJ) elegirSalidaPanel();   // nuevo: elige dónde empieza
      }
      if (msg.tipo === 'bienvenida' || info.rechazo) redibujar = true;
      if (redibujar) { reconstruir(); if (estado.modo === 'construir') evaluarColocacion(); }
      else if (antes !== mundo) reapuntar();
      if (info.cambio || e) actualizarUI();
    },
  });
  // has muerto (P4; src/logica/muerte.js; lo decide el servidor): vuelves a tu cama o a tu sitio de salida, y tu cuerpo
  // se queda donde caíste con la mitad de lo que llevabas
  enLinea.escucharMuerte(alMorir);
  // las obras cobran de lo que llevas, que es el del servidor (objetosRed): hasta que llegue, no se adelanta nada
  const deInventario = { de: () => inventario() };
  Object.defineProperty(enLinea.red, 'invs', { get: () => (objetosRed.deServidor ? deInventario : null) });
  // el chat de texto (valravnx, 6 nov): lo que dices y lo que dicen los de cerca, en un bocadillo sobre la cabeza
  charla = montarCharla({ enLinea, boton: $('btnHablar'), camara, lienzo: $('lienzo'), avisar: mostrarAviso, alAbrir: () => teclas.clear(),
    pies: (a) => { if (a === enLinea.yo) return pj; const m = enLinea.modeloDe(a); return m ? m.position : null; } });
  $('btnHablar').hidden = false;
}

// Dónde empiezas (valravnx, 5 nov: tres salidas en zonas del rey, «lo eligen»; src/logica/whitholm.js, SALIDAS_INICIO):
// un personaje nuevo llega sin posición y elige una de las tres; la pide al servidor y, cuando dice que sí, el
// jugador aparece allí. Queda debajo de la pantalla de la cuenta (sale cuando se quita); mientras no elige, está en la
// salida común. Solo una vez: el servidor lo recuerda.
function elegirSalidaPanel() {
  if (!enLinea || panelSalida) return;
  const estilo = document.createElement('style');
  estilo.textContent = `#panelSalida{position:fixed;inset:0;z-index:57;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(20,16,12,.45);font:15px/1.4 system-ui,sans-serif;color:#efe6d6}
#panelSalida .ps-caja{background:#241e18;border-radius:14px;padding:18px 20px 16px;width:min(400px,100%);box-shadow:0 10px 40px #0006}
#panelSalida h2{margin:0 0 4px;font:600 22px/1.15 Georgia,"Times New Roman",serif;letter-spacing:.04em}
#panelSalida p{margin:0 0 12px;color:#cdbfa8;font-size:14px}
#panelSalida button{display:block;width:100%;text-align:left;margin:0 0 8px;padding:10px 12px;border:1px solid #6b5a44;border-radius:9px;background:#4a3d2e;color:#f3ead9;font:inherit;cursor:pointer}
#panelSalida button b{display:block;font-size:16px}
#panelSalida button span{color:#cdbfa8;font-size:13px}
#panelSalida button:hover,#panelSalida button:focus{background:#5c4b37;outline:none}
#panelSalida button:disabled{opacity:.6;cursor:default}
#panelSalida .ps-motivo{min-height:1.2em;color:#e8a27c;font-size:13px}`;
  document.head.appendChild(estilo);
  const DE = { lindholt: 'La salida común, cerca del centro de la isla.', ciudad: 'Junto a la ciudad del rey, en Strandvang: tierras del rey, donde nadie puede herir a otro jugador.', motdale: 'En Motdale, al oeste de la ciudad.' };
  panelSalida = document.createElement('div');
  panelSalida.id = 'panelSalida';
  panelSalida.innerHTML = `<div class="ps-caja"><h2>${tr('¿Dónde empiezas?')}</h2><p>${tr('Elige una de las tres salidas del rey. Solo se elige una vez.')}</p>`
    + SALIDAS_INICIO.map(e => `<button data-salida="${e.id}"><b>${tr(e.nombre)}</b><span>${tr(DE[e.id])}</span></button>`).join('')
    + `<div class="ps-motivo" id="psMotivo"></div></div>`;
  document.body.appendChild(panelSalida);
  let pedida = 0;
  const quitar = enLinea.escucharSalida((m) => {
    if (m.id !== pedida) return;
    if (!m.ok || !m.posicion) {
      for (const b of panelSalida.querySelectorAll('button')) b.disabled = false;
      panelSalida.querySelector('#psMotivo').textContent = tr(m.motivo || 'No se ha podido.');
      return;
    }
    const p = m.posicion;
    Object.assign(pj, { x: p.x, y: p.y, z: p.z, k: 0, vel: 0, rot: p.giro });
    enLinea.mandarEstado({ x: pj.x, y: pj.y, z: pj.z, giro: pj.rot, anim: 'quieto' });
    quitar(); panelSalida.remove(); panelSalida = 'elegida';
  });
  panelSalida.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-salida]'); if (!b) return;
    for (const x of panelSalida.querySelectorAll('button')) x.disabled = true;
    pedida = Date.now() % 1e9;
    enLinea.enviar({ tipo: 'salida', id: pedida, salida: b.dataset.salida });
  });
}

// Panel de depuración del admin (valravnx, 30 oct; src/juego/panel_admin.js): F9 o el botón «Admin». El mapa con todos
// los conectados y teletransportarse, siempre pedido al servidor con la clave de admin; el jugador se mueve cuando el
// servidor contesta que sí. Se pone en el suelo de allí (o en el piso de una obra, si cae encima de una).
const panelAdmin = mapaRey ? montarPanelAdmin({ mapaRey, enLinea, salida: mundoJ.salida, avisar: mostrarAviso,
  libre: (si) => mundoJ.libre(si),   // la cuenta de admin, por todo el continente
  camaraLibre: { get activa() { return camLibre.activa; }, alternar: (si) => alternarCamaraLibre(si), donde: () => ({ x: camLibre.x, z: camLibre.z }) },
  irA: (x, y, z, giro) => { Object.assign(pj, { x, z, k: 0, vel: 0 }); if (giro !== null) pj.rot = giro; pj.y = alturaSuelo(); } }) : null;

// Atajo de prueba (obras con lo que llevas): coge del arcón de pruebas, con acciones, lo que le falta a la obra p (lo
// pesado de una obra en alto, de uno en uno, y dos varas y una cuerda para rodarlo); si no llevas mochila ni cinturón,
// se pone una mochila de bastidor y un cinto con anillas del arcón. En línea, por el servidor (se adelanta aquí).
function tomarPara(p) {
  const inv = inventario();
  if (!inv.lugares.espalda) accionInventario({ tipo: 'coger', objeto: 'mochila_bastidor', cantidad: 1, a: 'espalda' });
  if (!inv.lugares.cintura) accionInventario({ tipo: 'coger', objeto: 'cinto_anillas', cantidad: 1, a: 'cintura' });
  const tomar = (m, n, a) => { for (let k = n; k >= 1; k--) if (accion({ tipo: 'sacar_arcon', material: m, cantidad: k, a }).ok) return k; return 0; };
  const cogido = {};
  for (const f of mundo.faltaEntregar(p)) {
    if (hayQueSubir(p, f.m)) {
      if (inv.cuantos(OBJETO_DE_MATERIAL[f.m]) < 1) cogido[f.m] = tomar(f.m, 1, f.m === 'tronco' ? 'hombro' : undefined);
      for (const [m, n] of Object.entries(VARAS_PARA_RODAR)) { const q = n - inv.cuantos(OBJETO_DE_MATERIAL[m]); if (q > 0) cogido[m] = (cogido[m] || 0) + tomar(m, q); }
    } else {
      // lo que le falta entero, aunque ya lleves algo (lo que sobre se queda encima); un tronco, al hombro
      let n = f.n, h = 0;
      if (f.m === 'tronco' && !inv.lugares.hombro) h = tomar(f.m, 1, 'hombro');
      cogido[f.m] = h + (n - h > 0 ? tomar(f.m, n - h) : 0);
    }
  }
  return cogido;
}

// acceso para pruebas automáticas
window.__kinhold = {
  get mundo() { return mundo; }, get yo() { return yoAutor(); }, get miMojon() { return miMojon(); }, estado, pj, cam, camara, escena, renderer, graficos, jugador, obstaculos, talaV, decorado, combate, cielo, ambiente,
  // el mundo de verdad (en la demo): el terreno, la altura del suelo, si ya están los trozos de alrededor y cuánto
  // tarda el terreno en cada fotograma (ms, desde que está listo)
  get charla() { return charla; },
  get necesidades() { return necesidades; },   // las del servidor (P4)
  avisosNec,
  // (pruebas, sin servidor) poner unas necesidades como si llegaran del servidor: solo se dibujan y se notan aquí
  beber, aguaAlLado, comer, accionPrincipal, despiezar, liebreAlLado,
  desbrozableCercano, empezarDesbroce,   // desbrozar (8 nov)
  get accionVista() { return accionVista && { texto: accionVista.texto, sub: accionVista.sub, apagada: !!accionVista.apagada, x: accionVista.pos.x, z: accionVista.pos.z }; }, aroAccion,   // la acción a la vista (8 nov)
  rocaCercana, empezarRotura,   // romper rocas (8 nov)
  usarArbol,   // la corteza y la resina (8 nov)
  pintarTodoInventario,   // (pruebas: lo que llevas, otra vez en el panel y puesto, tras cambiarlo a mano)
  ponerNecesidades(n) { necesidades = validarNecesidades(n); avisosNec.pintar(necesidades); },   // el chat de texto (src/juego/charla.js)
  mundoJ, get mundoListo() { return mundoListo; }, tierrasRey, get cartelTierras() { return cartelTierras; }, mapaRey, panelAdmin, camLibre, alternarCamaraLibre, velocidadAdmin, msMundo, alturaSuelo: (x, z) => decorado.altura(x, z),
  // el agua y el nado: el estado del aguante, dónde estás (tierra, vadear, nadar) y cuántas veces te has ahogado
  nado,
  // la última vez que has muerto (P4; src/logica/muerte.js): de qué, si a tu cama, y tu cuerpo
  get ultimaMuerte() { return ultimaMuerte; },
  get fauna() { return fauna; },   // las liebres de alrededor (P4; pruebas: dónde están y qué hacen)
  enLineaRemotos: () => (enLinea ? enLinea.remotos : new Map()),   // (pruebas: los demás y los cuerpos, como se dibujan)
  // un paso de alguien que anda por el suelo del mundo (el rival de práctica)
  andarHasta,
  // los sitios de salida (src/logica/whitholm.js): el común y si uno es de la lista de la salida al azar
  salidas: { comun: SALIDA, total: SALIDAS.length, deLista: (x, z) => SALIDAS.some(s => s[0] === x && s[1] === z) },
  cambiarModo, colocar, girar, cambiarPlanta, usar, confirmarDesmontaje,
  // una acción del mundo, como las del jugador
  accion: (a) => accion(a),
  get brocha() { return { radio: estado.radioBrocha, altura: estado.alturaBrocha }; },
  plantaDeco, get teclas() { return [...teclas]; }, get fantasmaForma() { return fantasmaForma; },
  seleccionar(clase, tipo) { estado.sel = { clase, tipo }; estado.dir = 0; marcarSeleccion(); evaluarColocacion(); },
  apuntar(x, z, y = 0) { estado.puntero = { x, z, ySuperficie: y }; evaluarColocacion(); },
  apuntarPantalla(cx, cy) { estado.puntero = punteroDesde(cx, cy); evaluarColocacion(); return estado.puntero; },
  apuntarPieza(cx, cy) { evaluarDesmontaje(piezaBajo(cx, cy)); },
  elegirPieza(cx, cy) { elegirDesmontaje(cx, cy); },   // como el clic o el toque en Desmontar: deja elegido y saca Confirmar
  proyectar(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camara); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  // atajo de prueba: coge del arcón de pruebas lo que cuesta el mojón o un mueble (se pagan de lo que llevas), con acciones
  llevarPara(clase, tipo) {
    const coste = clase === 'mojon' ? PIEZAS.mojon.coste : DECORACION[tipo] && DECORACION[tipo].coste;
    if (!coste) return false;
    const inv = inventario();
    if (!inv.lugares.espalda) accionInventario({ tipo: 'coger', objeto: 'mochila_bastidor', cantidad: 1, a: 'espalda' });
    if (!inv.lugares.cintura) accionInventario({ tipo: 'coger', objeto: 'cinto_anillas', cantidad: 1, a: 'cintura' });
    // lo que llevas (en las manos, al hombro, que deja las manos sin nada, y en la mochila y el cinto) y no hace falta
    // aquí, si estorba, vuelve al arcón de pruebas
    const soltarManos = () => {
      for (const l of [...inv.rutasGuardar(), 'hombro']) {
        const c = inv.buscar(l).cosa, mat = c && Object.keys(OBJETO_DE_MATERIAL).find(k => OBJETO_DE_MATERIAL[k] === c.tipo);
        if (mat && !coste[mat]) accion({ tipo: 'dejar_arcon', de: l, cantidad: c.n });
      }
    };
    const sacar = (m, q) => {
      // un tronco, al hombro si está libre (en las manos o la mochila puede no caber); si no, donde quepa
      if (m === 'tronco' && q === 1 && !inv.lugares.hombro && accion({ tipo: 'sacar_arcon', material: m, cantidad: 1, a: 'hombro' }).ok) return true;
      return accion({ tipo: 'sacar_arcon', material: m, cantidad: q }).ok;
    };
    let todo = true;
    for (const [m, n] of Object.entries(coste)) {
      const q = n - inv.cuantos(OBJETO_DE_MATERIAL[m]);
      if (q <= 0) continue;
      if (!sacar(m, q)) { soltarManos(); if (!sacar(m, n - inv.cuantos(OBJETO_DE_MATERIAL[m]))) todo = false; }
    }
    return todo;
  },
  terminarObras() {
    if (enLinea) { // en línea, por el servidor: las mismas acciones que haría el jugador (llevar material y trabajar)
      const obras = []; for (const c of mundo.construcciones) for (const [key, p] of c.piezas) if (p.obra) obras.push([c.id, key]);
      // el servidor solo deja hacerlo al alcance de la obra (como a un jugador): se le lleva junto a cada una, en su
      // planta, y se le devuelve después adonde estaba
      const vuelta = { x: pj.x, y: pj.y, z: pj.z, k: pj.k };
      const junto = (c, p) => { const m = centroMundo(c, p); Object.assign(pj, { x: m.x, z: m.z, k: p.k, y: oyDe(c) + p.k * ALTURA + 0.05 }); enLinea.mandarEstado({ x: pj.x, y: pj.y, z: pj.z, giro: pj.rot, anim: 'quieto' }); };
      for (const [id, key] of obras) {
        const pieza = () => { const c = mundo.construcciones.find(x => x.id === id); return c && c.piezas.get(key); };
        { const c = mundo.construcciones.find(x => x.id === id); if (c && pieza()) junto(c, pieza()); }
        const planta = plantaObra(pieza());
        // las obras cobran de lo que llevas: se coge del arcón de pruebas lo que falta y se lleva, hasta que no falte nada
        const queda = () => mundo.faltaEntregar(pieza()).reduce((t, f) => t + f.n, 0);
        for (let vuelta = 0; vuelta < 40 && pieza() && queda() > 0; vuelta++) {
          const antes = queda();
          tomarPara(pieza());
          for (const f of mundo.faltaEntregar(pieza())) {
            if (planta > 0 && clasePeso(f.m) !== 'ligero') { // lo pesado, a una obra en alto, se sube por las varas
              for (let i = 0; i < 10000 && pieza() && mundo.faltaEntregar(pieza()).some(x => x.m === f.m); i++)
                if (!accion({ tipo: 'subir', construccion: id, clave: key, material: f.m, segundos: MAX_RATO, metodo: 'varas' }).ok) break;
            } else accion({ tipo: 'entregar', construccion: id, clave: key, material: f.m, cantidad: f.n, desde: planta });
          }
          if (queda() >= antes) break;
        }
        let r = { ok: true };
        for (let i = 0; i < 1000 && r.ok && pieza() && pieza().obra; i++) r = accion({ tipo: 'trabajar', construccion: id, clave: key, segundos: MAX_RATO });
      }
      if (obras.length) { Object.assign(pj, vuelta); enLinea.mandarEstado({ x: pj.x, y: pj.y, z: pj.z, giro: pj.rot, anim: 'quieto' }); }
      reconstruir(); return;
    }
    for (const c of mundo.construcciones) for (const [key, p] of [...c.piezas]) if (p.obra) acabarObra(mundo, registroAcciones, AUTOR_LOCAL, c.id, key);
    guardar(); reconstruir();
  },
  obraCercana() { const o = obraCercana(); return o && { c: o.c.id, key: o.key }; },
  // atajo de prueba (obras con lo que llevas): coge del arcón de pruebas, con acciones, lo que le falta a la obra
  // cercana (lo pesado de una obra en alto, de uno en uno, y dos varas y una cuerda para rodarlo); si no llevas
  // mochila ni cinturón, se pone una mochila de bastidor y un cinto con anillas del arcón. Sin obra cerca, nada.
  llevar() {
    const o = obraCercana(); if (!o) return null;
    const cogido = tomarPara(o.p);
    guardar(); actualizarUI(); pintarLlevas(); panelInventario.pintar();
    return cogido;
  },
  get obrando() { return estado.obrando; },
  get rampa() { return rampa && { t: rampa.t, meta: rampa.meta, visible: !!rampa.g.parent, tipo: rampa.tipo || 'varas', yTronco: rampa.tronco.position.y, yMoton: rampa.tipo === 'polipasto' ? mallaDe(rampa.c, rampa.qkey)?.getObjectByName('moton_bajo')?.position.y : undefined, torno: !!(rampa.torno && rampa.torno.parent) }; },
  // atajo de prueba para las capturas: deja la subida quieta a medio camino (sin tarjeta gráfica, un rato llega a 5 s)
  fijarSubida(t) { if (estado.obrando) estado.obrando.desde = performance.now() + 1e9; if (rampa) { rampa.t = rampa.meta = t; moverRampa(0); } },
  seguirSubida() { if (estado.obrando) estado.obrando.desde = performance.now(); },
  interactivoCercano() { const o = interactivoCercano(); return o && { c: o.c.id, key: o.key, tipo: o.tipo }; },
  opcionesUsar: () => opcionesUsar().map(o => o.texto), abrirMenuUsar, cerrarMenuUsar, opcionesEn: (cx, cy) => opcionesEn(cx, cy).map(o => o.texto), menuUsar: () => menuUsar.hidden ? null : [...menuUsar.children].map(b => b.textContent),
  reiniciar() { mundo = new Mundo(); registroAcciones = new RegistroAcciones(); inventarios.jugadores = {}; sueloObjetos.suelo.objetos = []; sueloObjetos.refrescar(); talaV.tala.estado = {}; talaV.refrescar(); troceo.estado = {}; reconstruir(); ropaDelVisor(); vestir(); pintarLlevas(); panelInventario.pintar(); },
  get registroAcciones() { return registroAcciones; },
  accionInventario, get inventario() { return inventario(); }, panelInventario, panelFabricar, fabCliente, estacionesV,
  calor() { return calorEn(Object.values(fabCliente.estaciones), pj.x, pj.z, Date.now()); }, // el calor de las hogueras donde estás (para el frío)
  inventarios, golpeTala, arbolCercano, vestir, troceo, troncoCercano, golpeTroceo, usar, cambiarHombro,
  recoleccion, // lo que se recoge del suelo y de las plantas (puntos, estado, recoger)
  sueloObjetos, soltarAlSuelo, cogerDelSuelo, pintarLlevas,
  rastras, miRastra, engancharRastra, soltarRastra, cargarRastra, descargarRastra, arconAlSuelo, opcionesRastra: () => opcionesRastra().map(o => o.texto), velocidadCarga, sitiosRastra: () => sitiosRastra, // la rastra // lo soltado en el suelo (src/juego/suelo.js)
  get enLinea() { return enLinea; }, objetosRed, // en línea: lo que llevas y el suelo del servidor
  reconstruir() { reconstruir(); },
  render() { graficos.dibujar(); },
};
