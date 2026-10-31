// Acciones que cambian el mundo. Lógica pura (sin three.js): el servidor podrá usarla tal cual.
//
// Toda acción es un mensaje { autor, tipo, ...datos } con datos sencillos (números, textos, ids),
// nunca objetos de la escena. Se comprueba, se aplica y se anota en un registro, salga bien o no.
// Con el registro de la construcción se puede rehacer el mundo desde cero (reproducir): así el
// servidor podrá validar y auditar lo que pasa, y las pruebas ven si algo cambia el mundo sin pasar por aquí.
import { Mundo, MAX_RATO, plantaObra, clasePeso, poleaPara, polipastoPara } from './construccion.js';
import { PIEZAS } from './piezas.js';
import { OBJETO_DE_MATERIAL, MATERIAL_DE_OBJETO } from './inventario.js';
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
// un texto de datos: no vacío, corto y que no sea el nombre de algo que tienen todos los objetos («constructor»,
// «__proto__», «toString»…), que si no se colaría al buscarlo en las tablas de piezas o materiales
const texto = v => typeof v === 'string' && v.length > 0 && v.length <= 64 && !(v in Object.prototype);

// Comprueba la forma del mensaje: autor, tipo conocido y datos del tipo correcto.
function forma(accion, campos) {
  if (!accion || typeof accion !== 'object') return 'Acción no válida.';
  if (!texto(accion.autor)) return 'Acción sin autor.';
  const c = Object.hasOwn(campos, accion.tipo) ? campos[accion.tipo] : null;   // «constructor», «__proto__»… no son tipos
  if (!c) return 'Acción desconocida.';
  for (const [nombre, tipo] of Object.entries(c)) {
    const v = accion[nombre];
    if (tipo === 'n' && !numero(v)) return 'Datos no válidos.';
    if (tipo === 't' && !texto(v)) return 'Datos no válidos.';
  }
  return null;
}

// ---------------- Construcción ----------------
// Piezas que se abren y cierran con Usar: las puertas de muro, los portones (el de la empalizada y el portillo de la
// cerca), las contraventanas y las trampillas.
// La chimenea se enciende y se apaga con Usar (al terminarla queda encendida; p.apagado la apaga).
export function seEnciende(p) { return !!(PIEZAS[p.tipo] && PIEZAS[p.tipo].hogar); }
export function seAbre(p) { return p.hueco === 'p' || p.hueco === 'w' || p.hueco === 't' || !!(PIEZAS[p.tipo] && PIEZAS[p.tipo].portón); }

const CAMPOS_CONSTRUCCION = {
  mojon: { x: 'n', z: 'n' },
  colocar: { pieza: 't', x: 'n', z: 'n', k: 'n', rot: 'n', dir: 'n' },
  decorar: { pieza: 't', x: 'n', y: 'n', z: 'n', rot: 'n' },
  nivelar: { x: 'n', z: 'n', y: 'n', radio: 'n' },   // una pasada de la brocha redonda (y: la altura a la que deja el suelo)
  desmontar: { construccion: 'n', clave: 't' },
  quitar: { id: 'n' },
  entregar: { construccion: 'n', clave: 't', material: 't', cantidad: 'n' }, // llevar material a una obra (desde: planta en la que estás)
  subir: { construccion: 'n', clave: 't', material: 't', segundos: 'n', metodo: 't' }, // subir lo pesado a una obra en alto
  trabajar: { construccion: 'n', clave: 't', segundos: 'n' },                 // un rato de trabajo en una obra
  usar: { construccion: 'n', clave: 't' },           // abrir o cerrar una puerta o un portón, o encender o apagar una chimenea
  rellenar: { cantidad: 'n' },                        // botón de pruebas del prototipo: llena el arcón de pruebas
  sacar_arcon: { material: 't', cantidad: 'n' },      // coger material del arcón de pruebas (a: ruta preferida, opcional)
  dejar_arcon: { de: 't', cantidad: 'n' },            // dejar en el arcón de pruebas el material de una ruta
};

// Obras con lo que llevas (roadmap, hito «Equipo y carga»): con los inventarios (invs), lo que se entrega a una obra
// sale de lo que lleva el autor encima, no de un montón común. El montón común del mundo (mundo.materiales) pasa a
// ser el arcón de pruebas del prototipo: de ahí se coge el material, y el botón de rellenar lo llena.
// Sin inventarios (en línea, hasta que el servidor los lleve; y el atajo acabarObra) se sigue usando el montón común.
export function reservaDe(inv) {
  const tipo = m => OBJETO_DE_MATERIAL[m];
  return { hay: m => (tipo(m) ? inv.cuantos(tipo(m)) : 0), gastar: (m, n) => { inv.gastar(tipo(m), n); }, parcial: true };
}

function aplicarConstruccion(m, a, invs) {
  switch (a.tipo) {
    case 'mojon': return m.colocarMojon(a.x, a.z);
    // se construye por obras (GDD): colocar pone el marco; luego se entregan los materiales y se trabaja
    // y (opcional): la altura del suelo donde se pone; la planta baja de una construcción nueva queda ahí
    case 'colocar': {
      if (a.y !== undefined && !numero(a.y)) return { ok: false, motivo: 'Datos no válidos.' };
      return m.colocar(m.candidata(a.pieza, a.x, a.z, a.k, a.rot, a.dir, a.y === undefined ? 0 : a.y), true, a.autor);
    }
    case 'nivelar': return m.nivelar(a, a.autor);
    case 'entregar': case 'trabajar': case 'subir': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      if (!c) return { ok: false, motivo: 'No existe.' };
      const reserva = invs ? reservaDe(invs.de(a.autor)) : undefined;
      if (a.tipo === 'entregar') {
        if (a.desde !== undefined && !numero(a.desde)) return { ok: false, motivo: 'Datos no válidos.' };
        return m.entregar(c, a.clave, a.material, a.cantidad, a.autor, a.desde === undefined ? 0 : a.desde, reserva);
      }
      if (a.tipo === 'subir') return m.subir(c, a.clave, a.material, a.segundos, a.autor, a.metodo, reserva);
      return m.trabajar(c, a.clave, a.segundos, a.autor);
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
      if (seEnciende(p)) { p.apagado = !p.apagado; return { ok: true, encendido: !p.apagado }; }
      if (!seAbre(p)) return { ok: false, motivo: 'Eso no se abre.' };
      p.abierta = !p.abierta;
      return { ok: true, abierta: p.abierta };
    }
    case 'rellenar': {
      if (a.cantidad <= 0 || a.cantidad > 1000) return { ok: false, motivo: 'Cantidad no válida.' };
      for (const k of Object.keys(m.materiales)) m.materiales[k] += a.cantidad;
      return { ok: true };
    }
    case 'sacar_arcon': {
      if (!invs) return { ok: false, motivo: 'Aquí no hay arcón.' };
      const tipo = Object.hasOwn(OBJETO_DE_MATERIAL, a.material) ? OBJETO_DE_MATERIAL[a.material] : null;
      if (!tipo) return { ok: false, motivo: 'Eso no está en el arcón.' };
      if (!Number.isInteger(a.cantidad) || a.cantidad < 1) return { ok: false, motivo: 'Cantidad no válida.' };
      if (a.a !== undefined && !texto(a.a)) return { ok: false, motivo: 'Datos no válidos.' };
      if ((m.materiales[a.material] || 0) < a.cantidad) return { ok: false, motivo: 'En el arcón no hay tanto.' };
      // con ruta, justo ahí (como coger del suelo); sin ella, donde quepa
      const inv = invs.de(a.autor), r = a.a !== undefined ? inv.coger(tipo, a.cantidad, a.a) : inv.meterDonde(tipo, a.cantidad);
      if (!r.ok) return r;
      m.materiales[a.material] -= a.cantidad;
      return { ok: true, donde: r.donde };
    }
    case 'dejar_arcon': {
      if (!invs) return { ok: false, motivo: 'Aquí no hay arcón.' };
      const inv = invs.de(a.autor), b = inv.buscar(a.de);
      if (b.motivo) return { ok: false, motivo: b.motivo };
      const mat = b.cosa && Object.hasOwn(MATERIAL_DE_OBJETO, b.cosa.tipo) ? MATERIAL_DE_OBJETO[b.cosa.tipo] : null;
      if (!mat) return { ok: false, motivo: b.cosa ? 'Eso no va en el arcón de materiales.' : 'Ahí no hay nada.' };
      const r = inv.sacar(a.de, a.cantidad);
      if (!r.ok) return r;
      m.materiales[mat] = (m.materiales[mat] || 0) + r.cosa.n;
      return { ok: true, material: mat, n: r.cosa.n };
    }
  }
}

// Ejecuta una acción de construcción sobre el mundo y la anota. Devuelve lo mismo que el método del mundo.
// invs: los inventarios de los jugadores (Inventarios, inventario.js); sin ellos, las obras cobran del montón común.
export function ejecutar(mundo, registro, accion, invs = null) {
  const fallo = forma(accion, CAMPOS_CONSTRUCCION);
  const r = fallo ? { ok: false, motivo: fallo } : aplicarConstruccion(mundo, accion, invs);
  registro.anotar(accion, r);
  return r;
}

// Lleva todo el material que le falta a una obra y trabaja en ella hasta terminarla, siempre con acciones (una
// entrega por material y ratos de MAX_RATO s). Si está en alto, lo ligero se lleva desde su planta y lo pesado se
// sube con la polea si la hay, si no con el polipasto, y si no rodándolo por dos varas (una persona sola; lo muy
// pesado, solo con polipasto y entre dos: una persona sola no lo acaba). Para las pruebas y los atajos de prueba del prototipo.
export function acabarObra(mundo, registro, autor, construccion, claveObra) {
  const c = mundo.construcciones.find(x => x.id === construccion);
  const p = c && c.piezas.get(claveObra);
  if (!p || !p.obra) return { ok: false, motivo: 'No hay obra ahí.' };
  const planta = plantaObra(p);
  for (const f of mundo.faltaEntregar(p)) {
    if (planta > 0 && clasePeso(f.m) !== 'ligero') {
      for (let i = 0; i < 10000 && mundo.faltaEntregar(p).some(x => x.m === f.m); i++) {
        const metodo = clasePeso(f.m) === 'muy_pesado' ? 'polipasto' : poleaPara(c, p) ? 'polea' : polipastoPara(c, p) ? 'polipasto' : 'varas';
        const r = ejecutar(mundo, registro, { autor, tipo: 'subir', construccion, clave: claveObra, material: f.m, segundos: MAX_RATO, metodo });
        if (!r.ok) return r;
        if (r.esperaAyuda) return { ok: false, motivo: 'Lo muy pesado solo se sube con un polipasto con torno, entre dos.' };
      }
      continue;
    }
    const r = ejecutar(mundo, registro, { autor, tipo: 'entregar', construccion, clave: claveObra, material: f.m, cantidad: f.n, desde: planta });
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
  curar: { herida: 'n', metodo: 't' },
};

function luchadorAutor(ctx, a) {
  const L = ctx.luchadores[a.autor];
  if (!L) return { motivo: 'El autor no está en el combate.' };
  if (L.fuera) return { motivo: 'El autor está fuera de combate.' };
  return { L };
}

// Golpe cuerpo a cuerpo en el instante del impacto: { autor, tipo: 'golpe', objetivo, linea }
// Disparo: { autor, tipo: 'disparo', x, y, z, tension, tTenso } → devuelve { ok, proyectil }
// Curarse: { autor, tipo: 'curar', herida (índice en sus heridas), metodo (de TRATAMIENTOS) } → empieza la cura
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
    } else if (accion.tipo === 'curar') {
      const motivo = L.motivoNoCurar(accion.herida, accion.metodo);
      r = motivo ? { ok: false, motivo } : (L.curar(accion.herida, accion.metodo), { ok: true });
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
