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
//   { tipo: 'trocear', objeto, x, z }             — un golpe de hacha a un tronco del suelo (src/logica/troceo.js)
//   { tipo: 'recoger', punto, x, z, px, pz, clase, a? } — recoger del suelo o de una planta (src/logica/recoleccion.js)
//   { tipo: 'coger', objeto, cantidad, a, … } y { tipo: 'soltar', de } — el arcón de pruebas del panel (solo con
//     arconPruebas: sacar algo de la nada y hacerlo desaparecer; sin él, se rechazan)
//
// El servidor aún no conoce el mundo (los árboles y los puntos de recogida los pone el navegador con la semilla del
// mapa). Decisión provisional (tarea del juego en línea, 31 oct): se fía del árbol o del punto que dice el navegador
// (su sitio, su edad o su clase) si el autor está a su lado; el nombre tiene que cuadrar con el sitio (el del árbol
// sale de él, idArbol) y lo que ya conoce no se cambia. Cuando el servidor genere el mundo, lo sacará de ahí.
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
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, ALCANCE_RECOGER } from './recoleccion.js';

export const TOLERANCIA = 3; // m
export const ENTRE_GOLPES_RED = 500; // ms
export const VERSION_OBJETOS = 2;
const DEL_INVENTARIO = new Set(['mover', 'ponerse', 'quitarse']);
const DEL_ARCON = new Set(['coger', 'soltar']);
const DEL_SUELO = new Set(['soltar_suelo', 'coger_suelo', 'talar', 'trocear', 'recoger']);
export const TIPOS_OBJETOS = new Set([...DEL_INVENTARIO, ...DEL_ARCON, ...DEL_SUELO]);
const num = v => typeof v === 'number' && Number.isFinite(v);
const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;

export class ObjetosServidor {
  // posicion(autor) → { x, z } o null: dónde lo tiene el servidor. enTierras(autor, x, z): si ese sitio es de sus tierras.
  // arconPruebas: si se acepta el arcón de pruebas ('coger' y 'soltar').
  constructor({ posicion = () => null, enTierras = () => false, arconPruebas = false } = {}) {
    this.invs = new Inventarios();
    this.ponerSuelo(new Suelo());
    this.tala = new Tala([]); this.tala.entre = ENTRE_GOLPES_RED;
    this.recoleccion = new Recoleccion([]);
    this.posicion = posicion;
    this.enTierras = enTierras;
    this.arconPruebas = arconPruebas;
    this.registro = new RegistroAcciones(1);   // la última; lo que se audita va al archivo
  }
  ponerSuelo(suelo) { this.suelo = suelo; this.troceo = new Troceo(suelo); this.troceo.entre = ENTRE_GOLPES_RED; }

  // accion: { tipo, ...datos } con el autor ya puesto por el servidor. ahora: la hora del servidor (ms).
  // Devuelve { ok, motivo?, entrada, suelo: bool (si ha cambiado el suelo) }.
  ejecutar(accion, ahora) {
    const a = accion && typeof accion === 'object' && !Array.isArray(accion) ? accion : {};
    let r, suelo = false;
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
      else if (a.tipo === 'talar') {
        const fallo = this.conocerArbol(a, p);
        r = fallo ? this.anotar(a, { ok: false, motivo: fallo }, ahora) : ejecutarTala(this.tala, this.invs, this.suelo, this.registro, a, ahora);
        suelo = !!(r.ok && r.cae);
      } else if (a.tipo === 'trocear') {
        r = ejecutarTroceo(this.troceo, this.invs, this.registro, a, ahora, this.enTierras);
        suelo = !!(r.ok && r.termina);
      } else if (a.tipo === 'recoger') {
        const fallo = this.conocerPunto(a, p);
        r = fallo ? this.anotar(a, { ok: false, motivo: fallo }, ahora) : ejecutarRecoleccion(this.recoleccion, this.invs, this.registro, a, ahora);
      } else {
        r = ejecutarSuelo(this.suelo, this.invs, this.registro, a, ahora, this.enTierras);
        suelo = !!r.ok;
      }
    }
    const entrada = this.registro.entradas[this.registro.entradas.length - 1];
    return { ...r, entrada, suelo };
  }
  // El árbol que dice el navegador (decisión provisional, arriba): su nombre sale de su sitio, y tiene que estar al
  // alcance de donde el servidor tiene al autor. Devuelve el motivo si no vale.
  conocerArbol(a, p) {
    if (this.tala.porId.has(a.arbol)) return null;
    if (!txt(a.arbol) || !num(a.ax) || !num(a.az) || !Object.hasOwn(DA, a.edad)) return 'Datos no válidos.';
    if (idArbol(a.ax, a.az) !== a.arbol) return 'Ahí no hay ningún árbol.';
    if (Math.hypot(a.ax - p.x, a.az - p.z) > ALCANCE_TALA + TOLERANCIA) return 'Está demasiado lejos.';
    this.tala.anadir([{ id: a.arbol, x: Math.round(a.ax * 100) / 100, z: Math.round(a.az * 100) / 100, edad: a.edad }]);
    return null;
  }
  // Lo mismo con un punto de recogida: su clase (ramas, piedra…) y su sitio.
  conocerPunto(a, p) {
    if (this.recoleccion.porId.has(a.punto)) return null;
    if (!txt(a.punto) || !num(a.px) || !num(a.pz) || !Object.hasOwn(RECOLECTABLES, a.clase) || !a.punto.startsWith(a.clase + ':')) return 'Datos no válidos.';
    if (Math.hypot(a.px - p.x, a.pz - p.z) > ALCANCE_RECOGER + TOLERANCIA) return 'Está demasiado lejos.';
    const q = { id: a.punto, tipo: a.clase, x: Math.round(a.px * 100) / 100, z: Math.round(a.pz * 100) / 100 };
    this.recoleccion.puntos.push(q); this.recoleccion.porId.set(q.id, q);
    return null;
  }
  // Lo de los árboles que se ve (tocones y lo que llevan dado no: solo lo talado), para todos.
  talaVisible() { return this.tala.exportar(); }
  // Lo recogido (cuándo vuelve cada punto), para todos.
  recoleccionVisible() { return this.recoleccion.exportar(); }
  anotar(a, r, ahora) { const e = this.registro.anotar(a, r); e.ahora = ahora; return r; }

  // Lo que se le manda a un jugador: lo que lleva.
  inventarioDe(autor) { return this.invs.de(autor).exportarJugador(); }
  // Lo que se ve en el suelo ahora (para todos).
  sueloVisible(ahora) { return this.suelo.visibles(ahora).map(o => JSON.parse(JSON.stringify(o))); }
  // Quita lo que ya ha desaparecido; true si ha cambiado algo.
  limpiar(ahora) { return this.suelo.limpiar(ahora) > 0; }

  // Los árboles y los puntos que el servidor ha conocido se guardan con su estado (no los genera él).
  exportar() {
    return { version: VERSION_OBJETOS, inventarios: this.invs.exportar(), suelo: this.suelo.exportar(),
      arboles: this.tala.arboles.map(a => ({ ...a })), tala: this.tala.exportar(), troceo: this.troceo.exportar(),
      puntos: this.recoleccion.puntos.map(q => ({ ...q })), recoleccion: this.recoleccion.exportar() };
  }
  // Lo guardado se comprueba con el catálogo de ahora (Inventarios.importar y Suelo.importar); si no se entiende,
  // se empieza de cero. La versión 1 (sin tala, troceo ni recogida) se lee igual.
  importar(datos, ahora = Date.now()) {
    if (!datos || typeof datos !== 'object' || ![1, VERSION_OBJETOS].includes(datos.version)) return this;
    this.invs = Inventarios.importar(datos.inventarios);
    this.ponerSuelo(new Suelo().importar(datos.suelo));
    if (datos.version === 1) return this;
    const lista = (v, bien) => (Array.isArray(v) ? v.filter(bien) : []);
    const arboles = lista(datos.arboles, a => a && txt(a.id) && num(a.x) && num(a.z) && Object.hasOwn(DA, a.edad));
    this.tala = new Tala(arboles.map(a => ({ id: a.id, x: a.x, z: a.z, edad: a.edad }))).importar(datos.tala); this.tala.entre = ENTRE_GOLPES_RED;
    this.troceo.importar(datos.troceo, ahora);
    const puntos = lista(datos.puntos, q => q && txt(q.id) && num(q.x) && num(q.z) && Object.hasOwn(RECOLECTABLES, q.tipo));
    this.recoleccion = new Recoleccion(puntos.map(q => ({ id: q.id, tipo: q.tipo, x: q.x, z: q.z }))).importar(datos.recoleccion);
    return this;
  }
}
