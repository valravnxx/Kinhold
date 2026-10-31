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
// No se aceptan 'coger' (meter algo que sale de la nada) ni 'soltar' (hacer desaparecer algo): en el navegador sin
// servidor los usaban el panel y los atajos de prueba; aquí lo que se coge sale del suelo y lo que se suelta cae a él.
//
// Dónde está el autor: el servidor lo sabe por su presencia (lo que manda unas 10 veces por segundo). El x, z del
// mensaje solo vale si está a menos de TOLERANCIA m de ahí (el último estado puede llevar un poco de retraso); si no,
// se rechaza. Sin presencia aún, no se acepta nada que dependa del sitio.
//
// Decisiones provisionales (anotadas en el registro de decisiones y en el diario):
//  - TOLERANCIA es 3 m (a 6 m/s corriendo, medio segundo de retraso).
//  - El estado se guarda entero en un archivo (objetos.json) después de cada cambio, y cada acción, salga bien o no,
//    en un registro aparte (objetos.jsonl) para auditarla.
import { Inventarios, ejecutarInventario } from './inventario.js';
import { Suelo, ejecutarSuelo } from './suelo.js';
import { RegistroAcciones } from './acciones.js';

export const TOLERANCIA = 3; // m
export const VERSION_OBJETOS = 1;
const DEL_INVENTARIO = new Set(['mover', 'ponerse', 'quitarse']);
const DEL_SUELO = new Set(['soltar_suelo', 'coger_suelo']);
export const TIPOS_OBJETOS = new Set([...DEL_INVENTARIO, ...DEL_SUELO]);

export class ObjetosServidor {
  // posicion(autor) → { x, z } o null: dónde lo tiene el servidor. enTierras(autor, x, z): si ese sitio es de sus tierras.
  constructor({ posicion = () => null, enTierras = () => false } = {}) {
    this.invs = new Inventarios();
    this.suelo = new Suelo();
    this.posicion = posicion;
    this.enTierras = enTierras;
    this.registro = new RegistroAcciones(1);   // la última; lo que se audita va al archivo
  }

  // accion: { tipo, ...datos } con el autor ya puesto por el servidor. ahora: la hora del servidor (ms).
  // Devuelve { ok, motivo?, entrada, suelo: bool (si ha cambiado el suelo) }.
  ejecutar(accion, ahora) {
    const a = accion && typeof accion === 'object' && !Array.isArray(accion) ? accion : {};
    let r, suelo = false;
    if (!TIPOS_OBJETOS.has(a.tipo)) r = this.anotar(a, { ok: false, motivo: 'Acción desconocida.' }, ahora);
    else if (DEL_INVENTARIO.has(a.tipo)) {
      r = ejecutarInventario(this.invs, this.registro, a);
    } else {
      const p = this.posicion(a.autor);
      const num = v => typeof v === 'number' && Number.isFinite(v);
      if (!p) r = this.anotar(a, { ok: false, motivo: 'El servidor aún no sabe dónde estás.' }, ahora);
      else if (!num(a.x) || !num(a.z)) r = this.anotar(a, { ok: false, motivo: 'Datos no válidos.' }, ahora);
      else if (Math.hypot(a.x - p.x, a.z - p.z) > TOLERANCIA) r = this.anotar(a, { ok: false, motivo: 'No estás ahí.' }, ahora);
      else {
        r = ejecutarSuelo(this.suelo, this.invs, this.registro, a, ahora, this.enTierras);
        suelo = !!r.ok;
      }
    }
    const entrada = this.registro.entradas[this.registro.entradas.length - 1];
    return { ...r, entrada, suelo };
  }
  anotar(a, r, ahora) { const e = this.registro.anotar(a, r); e.ahora = ahora; return r; }

  // Lo que se le manda a un jugador: lo que lleva.
  inventarioDe(autor) { return this.invs.de(autor).exportarJugador(); }
  // Lo que se ve en el suelo ahora (para todos).
  sueloVisible(ahora) { return this.suelo.visibles(ahora).map(o => JSON.parse(JSON.stringify(o))); }
  // Quita lo que ya ha desaparecido; true si ha cambiado algo.
  limpiar(ahora) { return this.suelo.limpiar(ahora) > 0; }

  exportar() { return { version: VERSION_OBJETOS, inventarios: this.invs.exportar(), suelo: this.suelo.exportar() }; }
  // Lo guardado se comprueba con el catálogo de ahora (Inventarios.importar y Suelo.importar); si no se entiende,
  // se empieza de cero.
  importar(datos) {
    if (!datos || typeof datos !== 'object' || datos.version !== VERSION_OBJETOS) return this;
    this.invs = Inventarios.importar(datos.inventarios);
    this.suelo = new Suelo().importar(datos.suelo);
    return this;
  }
}
