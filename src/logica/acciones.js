// Acciones que cambian el mundo. Lógica pura (sin three.js): el servidor podrá usarla tal cual.
//
// Toda acción es un mensaje { autor, tipo, ...datos } con datos sencillos (números, textos, ids),
// nunca objetos de la escena. Se comprueba, se aplica y se anota en un registro, salga bien o no.
// Con el registro de la construcción se puede rehacer el mundo desde cero (reproducir): así el
// servidor podrá validar y auditar lo que pasa, y las pruebas ven si algo cambia el mundo sin pasar por aquí.
import { Mundo, MAX_RATO } from './construccion.js';
import { PIEZAS } from './piezas.js';
import { resolverGolpe, crearProyectil, moverProyectil } from '../combate/logica.js';

// Autor provisional mientras no haya cuentas (hito de servidor): el jugador de este navegador.
export const AUTOR_LOCAL = 'jugador:local';

export class RegistroAcciones {
  // max: cuántas entradas se guardan como mucho (las más antiguas se van). Sin límite por defecto.
  constructor(max = Infinity) { this.entradas = []; this.total = 0; this.max = max; }
  anotar(accion, r) {
    const { autor, tipo, ...datos } = accion;
    const e = { n: ++this.total, autor, tipo, datos, ok: !!r.ok };
    if (!r.ok && r.motivo) e.motivo = r.motivo;
    if (r.resultado) e.resultado = r.resultado;
    this.entradas.push(e);
    if (this.entradas.length > this.max) this.entradas.shift();
    return e;
  }
  exportar() { return this.entradas.map(e => ({ ...e, datos: { ...e.datos } })); }
}

const numero = v => typeof v === 'number' && Number.isFinite(v);
const texto = v => typeof v === 'string' && v.length > 0;

// Comprueba la forma del mensaje: autor, tipo conocido y datos del tipo correcto.
function forma(accion, campos) {
  if (!accion || typeof accion !== 'object') return 'Acción no válida.';
  if (!texto(accion.autor)) return 'Acción sin autor.';
  const c = campos[accion.tipo];
  if (!c) return 'Acción desconocida.';
  for (const [nombre, tipo] of Object.entries(c)) {
    const v = accion[nombre];
    if (tipo === 'n' && !numero(v)) return 'Datos no válidos.';
    if (tipo === 't' && !texto(v)) return 'Datos no válidos.';
  }
  return null;
}

// ---------------- Construcción ----------------
// Piezas que se abren y cierran con Usar: las puertas de muro y los portones (el de la empalizada y el portillo de la cerca).
export function seAbre(p) { return p.hueco === 'p' || !!(PIEZAS[p.tipo] && PIEZAS[p.tipo].portón); }

const CAMPOS_CONSTRUCCION = {
  mojon: { x: 'n', z: 'n' },
  colocar: { pieza: 't', x: 'n', z: 'n', k: 'n', rot: 'n', dir: 'n' },
  decorar: { pieza: 't', x: 'n', y: 'n', z: 'n', rot: 'n' },
  desmontar: { construccion: 'n', clave: 't' },
  quitar: { id: 'n' },
  entregar: { construccion: 'n', clave: 't', material: 't', cantidad: 'n' }, // llevar material a una obra
  trabajar: { construccion: 'n', clave: 't', segundos: 'n' },                 // un rato de trabajo en una obra
  usar: { construccion: 'n', clave: 't' },           // abrir o cerrar una puerta o un portón
  rellenar: { cantidad: 'n' },                        // botón de pruebas del prototipo
};

function aplicarConstruccion(m, a) {
  switch (a.tipo) {
    case 'mojon': return m.colocarMojon(a.x, a.z);
    // se construye por obras (GDD): colocar pone el marco; luego se entregan los materiales y se trabaja
    case 'colocar': return m.colocar(m.candidata(a.pieza, a.x, a.z, a.k, a.rot, a.dir), true);
    case 'entregar': case 'trabajar': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      if (!c) return { ok: false, motivo: 'No existe.' };
      return a.tipo === 'entregar' ? m.entregar(c, a.clave, a.material, a.cantidad, a.autor) : m.trabajar(c, a.clave, a.segundos, a.autor);
    }
    case 'decorar': return m.colocarDecoracion(a.pieza, a.x, a.y, a.z, a.rot);
    case 'quitar': return m.quitarDecoracion(a.id);
    case 'desmontar': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      if (!c) return { ok: false, motivo: 'No existe.' };
      return m.desmontar(c, a.clave);
    }
    case 'usar': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      const p = c && c.piezas.get(a.clave);
      if (!p) return { ok: false, motivo: 'No existe.' };
      if (p.obra) return { ok: false, motivo: 'Está en obras.' };
      if (!seAbre(p)) return { ok: false, motivo: 'Eso no se abre.' };
      p.abierta = !p.abierta;
      return { ok: true, abierta: p.abierta };
    }
    case 'rellenar': {
      if (a.cantidad <= 0 || a.cantidad > 1000) return { ok: false, motivo: 'Cantidad no válida.' };
      for (const k of Object.keys(m.materiales)) m.materiales[k] += a.cantidad;
      return { ok: true };
    }
  }
}

// Ejecuta una acción de construcción sobre el mundo y la anota. Devuelve lo mismo que el método del mundo.
export function ejecutar(mundo, registro, accion) {
  const fallo = forma(accion, CAMPOS_CONSTRUCCION);
  const r = fallo ? { ok: false, motivo: fallo } : aplicarConstruccion(mundo, accion);
  registro.anotar(accion, r);
  return r;
}

// Lleva todo el material que le falta a una obra y trabaja en ella hasta terminarla, siempre con acciones (una
// entrega por material y ratos de MAX_RATO s). Para las pruebas y los atajos de prueba del prototipo.
export function acabarObra(mundo, registro, autor, construccion, claveObra) {
  const c = mundo.construcciones.find(x => x.id === construccion);
  const p = c && c.piezas.get(claveObra);
  if (!p || !p.obra) return { ok: false, motivo: 'No hay obra ahí.' };
  for (const f of mundo.faltaEntregar(p)) {
    const r = ejecutar(mundo, registro, { autor, tipo: 'entregar', construccion, clave: claveObra, material: f.m, cantidad: f.n });
    if (!r.ok) return r;
  }
  let r = { ok: true, terminada: false };
  for (let i = 0; i < 1000 && r.ok && !r.terminada; i++) r = ejecutar(mundo, registro, { autor, tipo: 'trabajar', construccion, clave: claveObra, segundos: MAX_RATO });
  return r;
}

// Rehace un mundo desde cero aplicando, en orden, las acciones que salieron bien.
export function reproducir(entradas) {
  const m = new Mundo();
  const reg = new RegistroAcciones();
  for (const e of entradas) if (e.ok) ejecutar(m, reg, { autor: e.autor, tipo: e.tipo, ...e.datos });
  return m;
}

// ---------------- Combate ----------------
// ctx = { luchadores: { id: Luchador }, r: azar }. Los luchadores se nombran por su id.
const CAMPOS_COMBATE = {
  golpe: { objetivo: 't', linea: 't' },
  disparo: { x: 'n', y: 'n', z: 'n', tension: 'n', tTenso: 'n' },
};

function luchadorAutor(ctx, a) {
  const L = ctx.luchadores[a.autor];
  if (!L) return { motivo: 'El autor no está en el combate.' };
  if (L.fuera) return { motivo: 'El autor está fuera de combate.' };
  return { L };
}

// Golpe cuerpo a cuerpo en el instante del impacto: { autor, tipo: 'golpe', objetivo, linea }
// Disparo: { autor, tipo: 'disparo', x, y, z, tension, tTenso } → devuelve { ok, proyectil }
export function ejecutarCombate(ctx, registro, accion) {
  let r;
  const fallo = forma(accion, CAMPOS_COMBATE);
  if (fallo) r = { ok: false, motivo: fallo };
  else {
    const { L, motivo } = luchadorAutor(ctx, accion);
    if (!L) r = { ok: false, motivo };
    else if (accion.tipo === 'golpe') {
      const de = ctx.luchadores[accion.objetivo];
      if (!de) r = { ok: false, motivo: 'El objetivo no está en el combate.' };
      else r = { ok: true, ...resolverGolpe(L, de, accion.linea, ctx.r) };
    } else {
      const p = crearProyectil(L, { x: accion.x, y: accion.y, z: accion.z }, { tension: accion.tension, tTenso: accion.tTenso }, ctx.r);
      p.autor = accion.autor;
      r = { ok: true, proyectil: p };
    }
  }
  const e = registro.anotar(accion, r);
  if (r.ok && accion.tipo === 'golpe') { if (r.zona) e.zona = r.zona; if (r.gravedad) e.gravedad = r.gravedad; }
  return r;
}

// Avanza un proyectil disparado con ejecutarCombate. Si da a alguien (herida o escudo), lo anota
// como consecuencia del disparo, con el mismo autor.
// blancos: a quién puede dar (por defecto, todos los luchadores del combate).
export function avanzarProyectil(ctx, registro, p, dt, blancos = Object.values(ctx.luchadores), dianas = []) {
  const res = moverProyectil(p, dt, blancos, ctx.r, dianas);
  if (res && (res.tipo === 'blanco' || res.tipo === 'escudo')) {
    const objetivo = Object.keys(ctx.luchadores).find(id => ctx.luchadores[id] === res.luchador);
    const e = registro.anotar({ autor: p.autor || 'desconocido', tipo: 'impacto', objetivo, arma: p.arma }, { ok: true, resultado: res.tipo === 'blanco' ? 'herida' : 'escudo' });
    if (res.zona) { e.zona = res.zona; e.gravedad = res.gravedad; }
  }
  return res;
}
