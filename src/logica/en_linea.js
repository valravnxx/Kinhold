// El mundo de construcción cuando se juega en línea (hito 1f). Lógica pura (sin three.js ni websocket).
//
// El mundo de verdad es el del servidor: `base` es lo que el servidor ha confirmado (las entradas que
// reparte, aplicadas en su orden). Para que construir no espere a la red, cada acción propia se hace
// enseguida en una copia (`mundo` = base + acciones propias aún sin confirmar) y se manda al servidor.
// - Si el servidor la acepta, llega su entrada y pasa a la base; la copia ya no hace falta.
// - Si la rechaza, se quita y el mundo vuelve a ser el del servidor.
// - Si llega una acción de otro mientras hay propias por confirmar, la copia se rehace: base + las propias.
// Sin acciones por confirmar, `mundo` es la misma base (no hay copia).
//
// El autor de cada acción lo pone el servidor; aquí se usa el de la bienvenida solo para la copia local.
import { Mundo } from './construccion.js';
import { RegistroAcciones, ejecutar, reproducir, USAN_INVENTARIO } from './acciones.js';

const copiar = (m) => Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));

export class MundoEnLinea {
  // enviar(msg): lo pone quien la usa (el websocket en el navegador, o la prueba)
  constructor(enviar) {
    this.enviar = enviar;
    this.yo = null;           // autor que dio el servidor
    this.base = new Mundo();
    this.mundo = this.base;
    this.pendientes = [];     // { id, accion } propias sin respuesta, en orden
    this.caidas = new Set();  // ids propias que ya no salían al rehacer (lo de otro llegó antes): su rechazo se espera
    this.id = 0;
    this.registro = new RegistroAcciones(200);   // lo hecho aquí (la copia), para mirarlo; el que vale es el del servidor
    // Lo que llevas (hito «Equipo y carga»): las obras cobran de ahí. Lo pone quien la usa ({ de: () => Inventario },
    // el del jugador tal como lo manda el servidor). Entregar, subir y el arcón de materiales se adelantan con él (lo que
    // llevas cambia ya; el servidor manda luego el suyo, que manda); la acción queda ya pagada («lleva») y al rehacer
    // la copia no vuelve a cobrar. Sin él, no se adelantan: «No llevas ese material».
    this.invs = null;
  }
  get conectado() { return this.yo !== null; }

  // Una acción propia. Devuelve lo mismo que ejecutar (en la copia local). Si sale mal aquí, ni se manda.
  accion(a) {
    if (!this.conectado) return { ok: false, motivo: 'Sin conexión con el servidor.' };
    const accion = { ...a, autor: this.yo };
    if (this.mundo === this.base) this.mundo = copiar(this.base);
    delete accion.lleva;   // eso solo lo pone la lógica al cobrar
    const usa = USAN_INVENTARIO.has(accion.tipo);
    if (usa && !this.invs) { if (!this.pendientes.length) this.mundo = this.base; return { ok: false, motivo: 'No llevas ese material.', faltan: [] }; }
    const r = ejecutar(this.mundo, this.registro, accion, usa ? this.invs : null);
    if (!r.ok) { if (!this.pendientes.length) this.mundo = this.base; return r; }
    const id = ++this.id;
    const { autor, lleva, ...sinAutor } = accion;   // el autor no se manda (lo pone el servidor), ni «lleva»
    this.pendientes.push({ id, accion });
    this.enviar({ tipo: 'accion', id, accion: sinAutor });
    return r;
  }

  // Un mensaje del servidor. Devuelve qué ha cambiado: { cambio: bool, entrada?, rechazo? }
  recibir(msg) {
    if (msg.tipo === 'bienvenida') {
      this.yo = msg.autor;
      this.base = reproducir(msg.entradas || []);
      this.mundo = this.base; this.pendientes = []; this.caidas.clear();
      return { cambio: true };
    }
    if (msg.tipo === 'resultado') {
      if (this.caidas.delete(msg.id)) return msg.ok ? { cambio: false } : { cambio: false, rechazo: msg.motivo || 'El servidor no lo ha aceptado.' };
      const i = this.pendientes.findIndex(p => p.id === msg.id);
      if (i < 0) return { cambio: false };
      this.pendientes.splice(i, 1);
      if (msg.ok) return { cambio: false };   // su entrada llega justo detrás (mismo orden en el websocket)
      this.rehacer();
      return { cambio: true, rechazo: msg.motivo || 'El servidor no lo ha aceptado.' };
    }
    if (msg.tipo === 'accion' && msg.entrada) {
      const e = msg.entrada;
      ejecutar(this.base, new RegistroAcciones(1), { autor: e.autor, tipo: e.tipo, ...e.datos });
      const propia = e.autor === this.yo;
      if (!this.pendientes.length) {
        // sin nada propio por confirmar, lo que se ve es la base (una propia ya estaba en la copia: igual)
        this.mundo = this.base;
        return { cambio: !propia, entrada: e };
      }
      if (!propia) { this.rehacer(); return { cambio: true, entrada: e }; }
      return { cambio: false, entrada: e };
    }
    return { cambio: false };
  }

  // base + las propias aún sin confirmar (las que ya no salen, fuera: el servidor también las rechazará)
  rehacer() {
    if (!this.pendientes.length) { this.mundo = this.base; return; }
    this.mundo = copiar(this.base);
    const reg = new RegistroAcciones(1);
    this.pendientes = this.pendientes.filter(p => ejecutar(this.mundo, reg, p.accion).ok || (this.caidas.add(p.id), false));
  }
}
