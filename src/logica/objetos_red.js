// Lo que lleva cada jugador y lo que hay en el suelo, en el servidor (hito «Equipo y carga»: inventario y recogida
// por el servidor). Lógica pura (sin three.js ni websocket): la usan el servidor y las pruebas.
//
// En línea, el inventario de cada jugador y los objetos del suelo son los del servidor: el navegador manda lo que
// quiere hacer y el servidor lo comprueba con la misma lógica que en el navegador (inventario.js y suelo.js), con el
// autor de la conexión y su hora. Lo que sale bien cambia el estado del servidor; el navegador recibe su inventario
// tal como queda y todos reciben el suelo.
//
// Lo que se acepta (cada una sobre el inventario de su autor, nunca el de otro):
//   { tipo: 'mover', de, a, cantidad? }        — de un hueco a otro de lo que llevas
//   { tipo: 'ponerse', de }                    — a su lugar (capa, cintura, espalda, hombro)
//   { tipo: 'quitarse', lugar, a }
//   { tipo: 'soltar_suelo', de, cantidad?, x, z } — al suelo, a tus pies
//   { tipo: 'coger_suelo', objeto, x, z, a?, cantidad? } — del suelo a lo que llevas
//   { tipo: 'talar', arbol, x, z, ax, az, edad }  — un golpe de hacha a un árbol (src/logica/tala.js); lo que deja cae al suelo
//   { tipo: 'descortezar' | 'sangrar', arbol, x, z, ax, az, edad, especie } — la corteza y la resina del árbol en pie
//     (src/logica/tala.js), a lo que llevas
//   { tipo: 'trocear', objeto, x, z }             — un golpe de hacha a un tronco del suelo (src/logica/troceo.js)
//   { tipo: 'recoger', punto, x, z, px, pz, clase, a? } — recoger del suelo o de una planta (src/logica/recoleccion.js)
//   { tipo: 'romper', punto, x, z, px, pz, clase: 'roca', tam } — un golpe de mazo a una roca del mundo (ídem); al último,
//     sus piedras al suelo donde estaba
//   { tipo: 'desbrozar', punto, x, z, px, pz, clase } — desbrozar un matorral o un arbusto de bayas (ídem): ramas y alguna
//     vara, al suelo donde estaba
//   { tipo: 'enganchar_rastra' | 'soltar_rastra' | 'cargar_rastra' | 'descargar_rastra', … } — la rastra (src/logica/rastra.js),
//   y las mismas de la carretilla (empujar_carretilla, aparcar_carretilla, cargar_carretilla, descargar_carretilla);
//     al soltarla, si el sitio que dice el navegador no vale, se deja detrás de donde el servidor tiene al autor
//   { tipo: 'colocar_estacion', estacion, x, z, y? } — el marco de un puesto de trabajo (src/logica/fabricacion.js) en
//     (x, z), a tu lado, sin gastar nada (la hoguera, no bajo techo); { tipo: 'entregar_estacion', estacion, x, z } — le
//     llevas lo que le falta, de lo que llevas y del suelo de al lado; { tipo: 'trabajar_estacion', estacion, segundos,
//     x, z } — un rato de trabajo hasta levantarlo; { tipo: 'quitar_estacion', estacion, x, z } — quitar un marco a medio
//     hacer (lo entregado cae al suelo). En tierra de otro, solo su dueño y sus invitados
//   { tipo: 'fabricar', receta, estacion?, x, z }   — encargar una receta: con las manos o en una estación de su uso (la
//     que se diga o la más cercana); gasta de lo que llevas y del suelo de al lado de donde el servidor te tiene
//   { tipo: 'recoger_fabricado', estacion?, x, z }  — lo terminado va a lo que llevas; lo que no cabe, al suelo a tus pies
//   { tipo: 'depositar_estacion', estacion, de, cantidad?, x, z } — dejar en la estación lo que llevas (sus recetas
//     gastan de ahí); { tipo: 'retirar_estacion', estacion, objeto, cantidad?, x, z } — volver a cogerlo. En tierra de
//     otro, solo su dueño y sus invitados (como al poner la estación)
//   { tipo: 'encender_fuego', estacion, x, z } — encender la hoguera (1 yesca de lo que llevas; llevar el taladro de
//     fuego); { tipo: 'echar_fuego', estacion, objeto: 'rama' | 'lena', x, z } — echarle una (src/logica/fuego.js); { tipo: 'brasas_fuego', estacion, x, z } — dejar el hogar en
//     brasas (encender_fuego lo aviva). En
//     tierra de otro, solo su dueño y sus invitados
//   { tipo: 'ligar_cama', estacion, x, z } — ligar esa cama (una por personaje; en tu tierra o en la de quien te ha
//     invitado); { tipo: 'dormir', estacion, x, z } — dormir en tu cama ligada (lo que hace lo lleva el servidor)
//   { tipo: 'arcon_al_suelo', objeto: 'rastra', x, z } — del arcón de pruebas al suelo (solo con arconPruebas)
//   { tipo: 'coger', objeto, cantidad, a, … } y { tipo: 'soltar', de } — el arcón de pruebas del panel (solo con
//     arconPruebas: sacar algo de la nada y hacerlo desaparecer; sin él, se rechazan)
//
// Los árboles y los puntos de recogida: con el terreno (src/logica/terreno_servidor.js; el servidor genera Whitholm con
// la misma semilla que el navegador), el servidor los saca él: del navegador solo cuenta el nombre y por dónde está
// (para saber en qué trozo mirar); el sitio, la edad y la clase son los del servidor. Lo que se guarda (objetos.json) es
// solo lo que ha cambiado: los árboles talados o a medias y los puntos recogidos; los demás salen otra vez del mundo.
// Sin terreno (las pruebas que no generan el mundo), decisión provisional del 31 oct: se fía del árbol o del punto que
// dice el navegador (su sitio, su edad o su clase) si el autor está a su lado; el nombre tiene que cuadrar con el sitio
// (el del árbol sale de él, idArbol) y lo que ya conoce no se cambia.
// Decisión provisional: el arcón de pruebas sigue en línea mientras el servidor sea el de pruebas (sin él, nadie
// tendría un hacha: aún no se fabrica nada); cada cosa que sale o entra queda en el registro con su autor.
//
// Dónde está el autor: el servidor lo sabe por su presencia (lo que manda unas 10 veces por segundo). El x, z del
// mensaje solo vale si está a menos de TOLERANCIA m de ahí (el último estado puede llevar un poco de retraso); si no,
// se rechaza. Sin presencia aún, no se acepta nada que dependa del sitio.
//
// Decisiones provisionales (anotadas en el registro de decisiones y en el diario):
//  - TOLERANCIA es 3 m (a 6 m/s corriendo, medio segundo de retraso).
//  - Entre golpe y golpe de hacha, el servidor pide 0,5 s (el navegador da uno cada 0,9 s; la red puede juntar dos).
//  - El estado se guarda entero en un archivo (objetos.json) después de cada cambio, y cada acción, salga bien o no,
//    en un registro aparte (objetos.jsonl) para auditarla.
import { Inventarios, ejecutarInventario } from './inventario.js';
import { Suelo, ejecutarSuelo } from './suelo.js';
import { RegistroAcciones } from './acciones.js';
import { Tala, ejecutarTala, idArbol, DA, ALCANCE_TALA } from './tala.js';
import { Troceo, ejecutarTroceo } from './troceo.js';
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, ALCANCE_RECOGER, idRoca } from './recoleccion.js';
import { Rastras, ejecutarRastra, TIPOS_RASTRA, ejecutarArconAlSuelo } from './rastra.js';
import { agrupar, desagrupar, estadoEnTrozos, trozoDe } from './trozos_red.js';
import { Fabricacion, ejecutarFabricacion, TIPOS_FABRICACION, OBRA_ESTACION, DEL_FUEGO, DE_LA_CAMA, ESTACIONES } from './fabricacion.js';
import { estadoFuego } from './fuego.js';

export const TOLERANCIA = 3; // m
export const ENTRE_GOLPES_RED = 500; // ms
export const VERSION_OBJETOS = 3;   // 3: lo talado y lo recogido, agrupado por trozo (src/logica/trozos_red.js)
const DEL_INVENTARIO = new Set(['mover', 'ponerse', 'quitarse']);
const DEL_ARCON = new Set(['coger', 'soltar']);
const DE_FABRICAR = new Set(TIPOS_FABRICACION);
const DEL_SUELO = new Set([...DE_FABRICAR, 'soltar_suelo', 'coger_suelo', 'talar', 'descortezar', 'sangrar', 'trocear', 'recoger', 'desbrozar', 'romper', 'arcon_al_suelo', ...TIPOS_RASTRA]);
export const TIPOS_OBJETOS = new Set([...DEL_INVENTARIO, ...DEL_ARCON, ...DEL_SUELO]);
const num = v => typeof v === 'number' && Number.isFinite(v);
const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;

export class ObjetosServidor {
  // posicion(autor) → { x, z } o null: dónde lo tiene el servidor. enTierras(autor, x, z): si ese sitio es de sus tierras.
  // arconPruebas: si se acepta el arcón de pruebas ('coger' y 'soltar').
  // terreno: el mundo que conoce el servidor (crearTerreno), o null. puedeTocar(autor, x, z) → { ok, motivo? }: si puede
  // poner algo ahí (en tierra de otro, solo su dueño y sus invitados; Construccion.puedeTocar).
  // bajoTecho(x, z): si ese sitio está bajo techo (Construccion.bajoTecho; los puestos de trabajo: la hoguera, solo fuera).
  constructor({ posicion = () => null, enTierras = () => false, arconPruebas = false, terreno = null, puedeTocar = () => ({ ok: true }), bajoTecho = () => false, alMuro = () => null, obrasCerca = () => [] } = {}) {
    this.obrasCerca = obrasCerca;  // las piezas de las obras cerca de (x, z): con lo que puede dar un árbol al caer
    this.puedeTocar = puedeTocar;
    this.bajoTecho = bajoTecho;
    this.alMuro = alMuro;  // lo que va colgado en un muro: Construccion.muroCercano
    this.terreno = terreno;
    this.invs = new Inventarios();
    this.ponerSuelo(new Suelo());
    this.tala = new Tala([]); this.tala.entre = ENTRE_GOLPES_RED; this.tala.alturaEn = this.alturaTala(); this.tala.obstaculosEn = this.alrededorTala();
    this.recoleccion = new Recoleccion([]); this.recoleccion.entre = ENTRE_GOLPES_RED;
    this.posicion = posicion;
    this.enTierras = enTierras;
    this.arconPruebas = arconPruebas;
    this.fab = new Fabricacion();
    this.registro = new RegistroAcciones(1);   // la última; lo que se audita va al archivo
  }
  ponerSuelo(suelo) { this.suelo = suelo; this.troceo = new Troceo(suelo); this.troceo.entre = ENTRE_GOLPES_RED; this.rastras = new Rastras(suelo); }

  // accion: { tipo, ...datos } con el autor ya puesto por el servidor. ahora: la hora del servidor (ms).
  // Devuelve { ok, motivo?, entrada, suelo: bool (si ha cambiado el suelo), estaciones: bool (si ha cambiado alguna
  // estación: colocada nueva) }.
  ejecutar(accion, ahora) {
    const a = accion && typeof accion === 'object' && !Array.isArray(accion) ? accion : {};
    let r, suelo = false, estaciones = false;
    if (!TIPOS_OBJETOS.has(a.tipo)) r = this.anotar(a, { ok: false, motivo: 'Acción desconocida.' }, ahora);
    else if (DEL_INVENTARIO.has(a.tipo) || (DEL_ARCON.has(a.tipo) && this.arconPruebas)) {
      r = ejecutarInventario(this.invs, this.registro, a);
    } else if (DEL_ARCON.has(a.tipo)) r = this.anotar(a, { ok: false, motivo: 'Aquí no hay arcón.' }, ahora);
    else {
      const p = this.posicion(a.autor);
      const num = v => typeof v === 'number' && Number.isFinite(v);
      if (!p) r = this.anotar(a, { ok: false, motivo: 'El servidor aún no sabe dónde estás.' }, ahora);
      else if (!num(a.x) || !num(a.z)) r = this.anotar(a, { ok: false, motivo: 'Datos no válidos.' }, ahora);
      else if (Math.hypot(a.x - p.x, a.z - p.z) > TOLERANCIA) r = this.anotar(a, { ok: false, motivo: 'No estás ahí.' }, ahora);
      else if (a.tipo === 'talar' || a.tipo === 'descortezar' || a.tipo === 'sangrar') {
        const fallo = this.conocerArbol(a, p);
        r = fallo ? this.anotar(a, { ok: false, motivo: fallo }, ahora) : ejecutarTala(this.tala, this.invs, this.suelo, this.registro, a, ahora);
        suelo = !!(r.ok && r.limpio);   // (12 nov) lo que deja cae al suelo al limpiar el caído, no al caer
      } else if (a.tipo === 'trocear') {
        r = ejecutarTroceo(this.troceo, this.invs, this.registro, a, ahora, this.enTierras);
        suelo = !!(r.ok && r.termina);
      } else if (a.tipo === 'recoger' || a.tipo === 'desbrozar' || a.tipo === 'romper') {
        const fallo = this.conocerPunto(a, p);
        r = fallo ? this.anotar(a, { ok: false, motivo: fallo }, ahora) : ejecutarRecoleccion(this.recoleccion, this.invs, this.registro, a, ahora, this.suelo);
        suelo = !!(r.ok && (a.tipo === 'desbrozar' || r.rota));
      } else if (DE_FABRICAR.has(a.tipo)) {
        // fabricar y recoger, desde donde el servidor tiene al autor (no donde dice el navegador); la estación se pone
        // donde dice, que ya está a menos de TOLERANCIA de él
        const fa = a.tipo === 'colocar_estacion' ? a : { ...a, x: p.x, z: p.z };
        const est = (a.tipo === 'depositar_estacion' || a.tipo === 'retirar_estacion' || a.tipo === 'reparar' || DEL_FUEGO.includes(a.tipo) || DE_LA_CAMA.includes(a.tipo) || (OBRA_ESTACION.includes(a.tipo) && a.tipo !== 'colocar_estacion')) && typeof a.estacion === 'string' && Object.hasOwn(this.fab.estaciones, a.estacion) ? this.fab.estaciones[a.estacion] : null;
        const tocar = a.tipo === 'colocar_estacion' ? this.puedeTocar(a.autor, a.x, a.z) : est ? this.puedeTocar(a.autor, est.x, est.z) : { ok: true };
        const nSuelo = this.suelo.objetos.length, antes = JSON.stringify(this.suelo.objetos.map(o => [o.id, o.cosa.n]));
        r = !tocar.ok ? this.anotar(a, { ok: false, motivo: tocar.motivo }, ahora)
          : ejecutarFabricacion(this.fab, this.invs, this.registro, fa, ahora, this.suelo, (x, z) => this.enTierras(a.autor, x, z), (x, z) => this.bajoTecho(x, z), (x, z) => this.alMuro(x, z));
        suelo = !!r.ok && (this.suelo.objetos.length !== nSuelo || JSON.stringify(this.suelo.objetos.map(o => [o.id, o.cosa.n])) !== antes);
        // las estaciones se vuelven a mandar si se pone una, cambia su obra o lo depositado en alguna (se ve puesto); el
        // trabajo, cada cuarto (y al terminar), para no mandarlas a todos cada medio segundo
        estaciones = !!r.ok && a.tipo !== 'recoger_fabricado' && a.tipo !== 'dormir' && (a.tipo !== 'trabajar_estacion' || r.terminada || Math.floor(4 * r.progreso) !== Math.floor(4 * (r.progreso - a.segundos / ESTACIONES[this.fab.estaciones[a.estacion].tipo].trabajo)));
      } else if (a.tipo === 'arcon_al_suelo') {
        r = this.arconPruebas ? ejecutarArconAlSuelo(this.suelo, this.registro, a, ahora, this.enTierras) : this.anotar(a, { ok: false, motivo: 'Aquí no hay arcón.' }, ahora);
        suelo = !!r.ok;
      } else if (TIPOS_RASTRA.has(a.tipo)) {
        r = ejecutarRastra(this.rastras, this.invs, this.registro, a, ahora, this.enTierras, p.giro);
        suelo = !!r.ok;
      } else {
        r = ejecutarSuelo(this.suelo, this.invs, this.registro, a, ahora, this.enTierras);
        suelo = !!r.ok;
      }
    }
    const entrada = this.registro.entradas[this.registro.entradas.length - 1];
    return { ...r, entrada, suelo, estaciones };
  }
  // La altura del suelo del mundo, para que el árbol sin boca caiga cuesta abajo (src/logica/tala.js); sin terreno, nada.
  alturaTala() { return this.terreno ? (x, z) => this.terreno.suelo(x, z) : null; }
  // Lo de alrededor de un árbol que cae: los árboles de su terreno (sin terreno, los que conoce la tala) y las obras.
  alrededorTala() {
    return (x, z, r) => [...(this.terreno ? this.terreno.arbolesCerca(x, z, r) : this.tala.arboles.filter(b => Math.hypot(b.x - x, b.z - z) <= r)), ...(this.obrasCerca(x, z, r) || [])];
  }
  // El árbol que dice el navegador (decisión provisional, arriba): su nombre sale de su sitio, y tiene que estar al
  // alcance de donde el servidor tiene al autor. Devuelve el motivo si no vale.
  conocerArbol(a, p) {
    if (this.tala.porId.has(a.arbol)) return null;
    if (this.terreno) {
      const t = this.terreno.arbol(a.arbol, num(a.ax) ? a.ax : a.x, num(a.az) ? a.az : a.z);
      if (!t) return 'Ahí no hay ningún árbol.';
      if (Math.hypot(t.x - p.x, t.z - p.z) > ALCANCE_TALA + TOLERANCIA + this.largoCaido(a.arbol)) return 'Está demasiado lejos.';
      this.tala.anadir([{ ...t }]);
      return null;
    }
    if (!txt(a.arbol) || !num(a.ax) || !num(a.az) || !Object.hasOwn(DA, a.edad)) return 'Datos no válidos.';
    if (idArbol(a.ax, a.az) !== a.arbol) return 'Ahí no hay ningún árbol.';
    if (Math.hypot(a.ax - p.x, a.az - p.z) > ALCANCE_TALA + TOLERANCIA + this.largoCaido(a.arbol)) return 'Está demasiado lejos.';
    this.tala.anadir([{ id: a.arbol, x: Math.round(a.ax * 100) / 100, z: Math.round(a.az * 100) / 100, edad: a.edad, ...(txt(a.especie) && a.especie.length <= 16 ? { especie: a.especie } : {}) }]);
    return null;
  }
  // Un árbol caído sin limpiar (12 nov) se limpia desde cualquier punto de su tronco tumbado: hasta la punta (el más
  // alto, unos 12 m); lo exacto lo mira la tala (src/logica/tala.js, distanciaCaido).
  largoCaido(id) { const e = this.tala.estado[id]; return e && Number.isFinite(e.ang) ? 12 : 0; }
  // Lo mismo con un punto de recogida: su clase (ramas, piedra…) y su sitio.
  conocerPunto(a, p) {
    if (this.recoleccion.porId.has(a.punto)) return null;
    if (this.terreno) {
      const t = this.terreno.punto(a.punto, num(a.px) ? a.px : a.x, num(a.pz) ? a.pz : a.z);
      if (!t) return 'Ahí no hay nada que recoger.';
      if (Math.hypot(t.x - p.x, t.z - p.z) > ALCANCE_RECOGER + (t.tipo === 'roca' ? 1 : 0) + TOLERANCIA) return 'Está demasiado lejos.';
      const q = { ...t }; this.recoleccion.puntos.push(q); this.recoleccion.porId.set(q.id, q);
      return null;
    }
    if (!txt(a.punto) || !num(a.px) || !num(a.pz) || !Object.hasOwn(RECOLECTABLES, a.clase) || !a.punto.startsWith(a.clase + ':')) return 'Datos no válidos.';
    if (a.clase === 'roca' && (!num(a.tam) || a.tam <= 0 || a.tam > 3 || idRoca(a.px, a.pz) !== a.punto)) return 'Datos no válidos.';
    if (Math.hypot(a.px - p.x, a.pz - p.z) > ALCANCE_RECOGER + (a.clase === 'roca' ? 1 : 0) + TOLERANCIA) return 'Está demasiado lejos.';
    const q = { id: a.punto, tipo: a.clase, x: Math.round(a.px * 100) / 100, z: Math.round(a.pz * 100) / 100, ...(a.clase === 'roca' ? { tam: Math.round(a.tam * 1000) / 1000 } : {}) };
    this.recoleccion.puntos.push(q); this.recoleccion.porId.set(q.id, q);
    return null;
  }
  // Lo de los árboles que se ve (tocones y lo que llevan dado no: solo lo talado). Con trozos (un Set de claves de
  // trozo, src/logica/trozos_red.js), solo lo de esos trozos.
  talaVisible(trozos = null) {
    const t = this.tala.exportar();
    if (trozos) t.estado = estadoEnTrozos(t.estado, id => this.tala.porId.get(id), trozos);
    return t;
  }
  // Lo recogido (cuándo vuelve cada punto); con trozos, solo lo de esos trozos.
  recoleccionVisible(trozos = null) {
    const r = this.recoleccion.exportar();
    if (trozos) r.estado = estadoEnTrozos(r.estado, id => this.recoleccion.porId.get(id), trozos);
    return r;
  }
  // Dónde está un árbol o un punto que el servidor conoce (null si no lo conoce).
  sitioArbol(id) { return this.tala.porId.get(id) || null; }
  sitioPunto(id) { return this.recoleccion.porId.get(id) || null; }
  anotar(a, r, ahora) { const e = this.registro.anotar(a, r); e.ahora = ahora; return r; }

  // El que se va del juego suelta la rastra que arrastraba: se queda donde el servidor la tenía, detrás de su último
  // sitio. Devuelve true si ha cambiado el suelo.
  soltarAlSalir(autor, ahora) {
    if (!this.rastras.deAutor(autor, ahora)) return false;
    const p = this.posicion(autor);
    const o = this.rastras.deAutor(autor, ahora);
    const r = this.rastras.soltar(this.invs.de(autor), autor, p ? p.x : o.x, p ? p.z : o.z, undefined, undefined, ahora, p && Number.isFinite(p.giro) ? p.giro : 0, (x, z) => this.enTierras(autor, x, z));
    this.anotar({ autor, tipo: o.cosa.tipo === 'carretilla' ? 'aparcar_carretilla' : 'soltar_rastra', alSalir: true }, r, ahora);
    return !!r.ok;
  }

  // Lo que se le manda a un jugador: lo que lleva.
  inventarioDe(autor) { return this.invs.de(autor).exportarJugador(); }
  // Lo que se ve en el suelo ahora (para todos).
  // Con trozos, solo lo de esos trozos.
  sueloVisible(ahora, trozos = null) {
    const l = this.suelo.visibles(ahora);
    return (trozos ? l.filter(o => trozos.has(trozoDe(o.x, o.z))) : l).map(o => JSON.parse(JSON.stringify(o)));
  }
  // Las estaciones de fabricar que se ven, con lo depositado en ellas (sin sus colas: lo que encarga cada uno es suyo). Con trozos, solo las de
  // esos trozos.
  // El fuego, como lo ve cada uno: encendido o no, los s que le quedan, lo puesto sin arder y si hay cenizas (no la
  // hora del servidor: cada navegador lo cuenta desde que le llega).
  estacionesVisibles(trozos = null, ahora = Date.now()) {
    const fuego = f => { const st = estadoFuego(f, ahora); return { encendida: st.encendida, ...(st.brasas ? { brasas: true } : {}), queda: +st.queda.toFixed(1), combustible: st.combustible, cenizas: st.cenizas }; };
    return Object.values(this.fab.estaciones).filter(e => !trozos || trozos.has(trozoDe(e.x, e.z)))
      .map(e => ({ id: e.id, tipo: e.tipo, x: e.x, z: e.z, autor: e.autor, deposito: { ...e.deposito }, ...(e.fuego ? { fuego: fuego(e.fuego) } : {}),
        ...(Number.isFinite(e.y) ? { y: e.y } : {}), ...(Number.isFinite(e.giro) ? { giro: e.giro } : {}), ...(e.obra ? { obra: { entregado: { ...e.obra.entregado }, trabajo: e.obra.trabajo } } : {}),
        ...(e.ligadas ? { ligadas: [...e.ligadas] } : {}) }));   // las camas: quién la tiene ligada (cada navegador mira si es la suya)
  }
  // Lo que un jugador tiene encargado: en sus manos y en cada estación (con cuánto le falta).
  encargosDe(autor, ahora) {
    const mios = l => l.filter(c => c.autor === autor).map(c => ({ receta: c.receta, fin: c.fin, falta: Math.max(0, c.fin - ahora) }));
    const res = { manos: mios(this.fab.manos[autor] || []), estaciones: {} };
    for (const e of Object.values(this.fab.estaciones)) { const m = mios(e.cola); if (m.length) res.estaciones[e.id] = m; }
    return res;
  }
  // Quita lo que ya ha desaparecido; true si ha cambiado algo.
  limpiar(ahora) { return this.suelo.limpiar(ahora) > 0; }

  // Los árboles y los puntos que el servidor ha conocido se guardan con su estado. Con el terreno, solo los que han
  // cambiado (talados o a medias, recogidos): los demás los vuelve a sacar del mundo.
  exportar() {
    const tala = this.tala.exportar(), rec = this.recoleccion.exportar();
    const arboles = this.terreno ? this.tala.arboles.filter(a => Object.hasOwn(tala.estado, a.id)) : this.tala.arboles;
    const puntos = this.terreno ? this.recoleccion.puntos.filter(q => Object.hasOwn(rec.estado, q.id)) : this.recoleccion.puntos;
    // por trozo (versión 3): { "i,j": { cosas: [árboles o puntos], estado } }
    return { version: VERSION_OBJETOS, inventarios: this.invs.exportar(), suelo: this.suelo.exportar(),
      tala: { version: tala.version, trozos: agrupar(arboles, tala.estado) }, troceo: this.troceo.exportar(),
      recoleccion: { version: rec.version, trozos: agrupar(puntos, rec.estado) }, fabricacion: this.fab.exportar() };
  }
  // Lo guardado se comprueba con el catálogo de ahora (Inventarios.importar y Suelo.importar); si no se entiende,
  // se empieza de cero. La versión 1 (sin tala, troceo ni recogida) y la 2 (sin trozos) se leen igual.
  importar(datos, ahora = Date.now()) {
    if (!datos || typeof datos !== 'object' || ![1, 2, VERSION_OBJETOS].includes(datos.version)) return this;
    // la versión 3 va por trozos: se junta como era la 2 (arboles, tala, puntos, recoleccion) y se sigue igual
    if (datos.version === VERSION_OBJETOS) {
      const t = desagrupar(datos.tala && datos.tala.trozos), r = desagrupar(datos.recoleccion && datos.recoleccion.trozos);
      datos = { ...datos, version: 2, arboles: t.cosas, tala: { version: datos.tala && datos.tala.version, estado: t.estado },
        puntos: r.cosas, recoleccion: { version: datos.recoleccion && datos.recoleccion.version, estado: r.estado } };
    }
    this.invs = Inventarios.importar(datos.inventarios);
    this.ponerSuelo(new Suelo().importar(datos.suelo));
    this.fab = new Fabricacion().importar(datos.fabricacion); // lo guardado antes de fabricar por el servidor no lo trae: sin estaciones
    if (datos.version === 1) return this;
    const lista = (v, bien) => (Array.isArray(v) ? v.filter(bien) : []);
    let arboles = lista(datos.arboles, a => a && txt(a.id) && num(a.x) && num(a.z) && Object.hasOwn(DA, a.edad));
    // con el terreno, solo los que de verdad están en el mundo, y como son en él (lo guardado antes lo decía el navegador)
    if (this.terreno) arboles = arboles.map(a => this.terreno.arbol(a.id, a.x, a.z)).filter(Boolean);
    this.tala = new Tala(arboles.map(a => ({ id: a.id, x: a.x, z: a.z, edad: a.edad, ...(txt(a.especie) ? { especie: a.especie } : {}), ...(num(a.alto) ? { alto: a.alto, tam: a.tam } : {}) }))).importar(datos.tala); this.tala.entre = ENTRE_GOLPES_RED; this.tala.alturaEn = this.alturaTala(); this.tala.obstaculosEn = this.alrededorTala();
    this.troceo.importar(datos.troceo, ahora);
    let puntos = lista(datos.puntos, q => q && txt(q.id) && num(q.x) && num(q.z) && Object.hasOwn(RECOLECTABLES, q.tipo));
    if (this.terreno) puntos = puntos.map(q => this.terreno.punto(q.id, q.x, q.z)).filter(Boolean);
    // (las rocas, con su tamaño: sin él no se sabe cuántos golpes piden)
    if (!this.terreno) puntos = puntos.filter(q => q.tipo !== 'roca' || (num(q.tam) && q.tam > 0));
    this.recoleccion = new Recoleccion(puntos.map(q => ({ id: q.id, tipo: q.tipo, x: q.x, z: q.z, ...(q.tipo === 'roca' ? { tam: q.tam } : {}) }))).importar(datos.recoleccion); this.recoleccion.entre = ENTRE_GOLPES_RED;
    return this;
  }
}
