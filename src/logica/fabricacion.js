// Estaciones y recetas (documento de sistemas, apartados 7 y 8): las primeras estaciones, hoguera y piedra de tallar
// (N0) y banco de trabajo de tronco (entrada a N1), y lo que se hace en ellas y con las manos. Lógica pura (sin
// three.js ni navegador): el servidor podrá usarla tal cual.
//
// Fabricar: el autor está junto a la estación; la receta gasta lo que lleva encima y, si no le llega, lo de los
// arcones a pocos pasos de la estación; el encargo entra en la cola de la estación y se termina pasado su tiempo,
// contado por la hora (aunque nadie juegue): se guarda cuándo termina, no un contador. Lo terminado espera en la
// estación hasta que su autor lo recoge (solo él).
//
// Decisiones provisionales (el documento no las fija; anotadas en el diario):
//  - Tiempos: con las manos y lo sencillo, de 10 a 30 s; las herramientas, 45 a 60 s; endurecer la lanza al fuego,
//    60 s. Las estaciones se colocan al momento (su obra, con su marco y su tiempo, es otra tarea del hito).
//  - Cola: 3 encargos sin terminar por estación; con las manos, uno solo (las tuyas, solo tú).
//  - Junto a la estación: a 2,5 m como mucho. Arcones «a pocos pasos»: a 6 m de la estación.
//  - Se gasta primero lo que llevas (manos, hombro y lo guardado en cinturón y mochila) y luego lo de los arcones,
//    del más cercano al más lejano. Lo que llevas puesto (el cinturón, la mochila) no se gasta nunca, ni un
//    contenedor con algo dentro.
//  - «1 piedra grande» de la piedra de tallar es 1 piedra suelta (la que se recoge a mano). El banco de tronco pide
//    «herramienta de piedra»: llevar un hacha de piedra o una lasca de sílex, que no se gasta.
//  - «Rama larga» y «rama curva» son ramas: la rastra gasta 5 ramas (2 largas y 3). La antorcha, con fibra o con
//    resina (dos recetas). La cesta de recolección, con mimbre o con juncos (dos recetas). El cinturón de cuerda es
//    la cuerda trenzada del inventario (2 huecos pequeños).
//  - Quedan para cuando existan sus materiales u objetos: envueltas de piel (no hay prenda de pies de piel), anzuelo
//    (no hay hueso), refugio de ramas (es una obra), carretilla (no hay rodaja de tronco), zurrón y chaleco (no hay
//    piel limpia), vendas, y lo de cocinar y calentarse en la hoguera.
//  - Lo terminado va donde quepa en lo que llevas (como lo recogido del suelo); si no cabe, sigue en la estación.
import { CATALOGO } from './inventario.js';

export const ALCANCE_ESTACION = 2.5; // m, del jugador a la estación
export const ALCANCE_ARCONES = 6;    // m, de la estación a un arcón
export const COLA_ESTACION = 3;      // encargos sin terminar por estación
export const COLA_MANOS = 1;

// coste: lo que se gasta al colocarla. requiere: lleva al menos uno de estos (no se gasta).
export const ESTACIONES = {
  hoguera:       { nombre: 'Hoguera', nivel: 'N0', coste: { piedra: 6, rama: 4 }, hace: 'Cocinar, calentarse, endurecer al fuego, antorchas' },
  piedra_tallar: { nombre: 'Piedra de tallar', nivel: 'N0', coste: { piedra: 1 }, hace: 'Herramientas de piedra y sílex' },
  banco_tronco:  { nombre: 'Banco de trabajo de tronco', nivel: 'N1', coste: { tronco_corto: 2 }, requiere: ['hacha_piedra', 'lasca_silex'], hace: 'Trabajos de madera, mangos, cestería, primeras piezas de construcción' },
};

// donde: 'manos' o una estación. da: tipo del catálogo y cuántos. gasta: tipo → cuántos. s: segundos.
const r = (nombre, donde, da, gasta, s, n = 1) => ({ nombre, donde, da, n, gasta, s });
export const RECETAS = {
  // N0, con las manos
  cordel:            r('Cordel de fibra', 'manos', 'cordel', { fibra: 3 }, 15),
  palo_cavador:      r('Palo cavador', 'manos', 'palo_cavador', { rama: 1 }, 10),
  honda:             r('Honda', 'manos', 'honda', { cordel: 2, piel: 1 }, 30),
  lenero:            r('Leñero', 'manos', 'lenero', { rama: 4, cordel: 2 }, 30),
  rastra:            r('Rastra', 'manos', 'rastra', { rama: 5, cordel: 2 }, 30),
  fardo:             r('Fardo atado', 'manos', 'fardo', { cordel: 2 }, 15),
  arpon:             r('Arpón', 'manos', 'arpon', { rama: 1, lasca_silex: 1, cordel: 1 }, 30),
  // N0, en la piedra de tallar
  lasca_silex:       r('Lasca de sílex', 'piedra_tallar', 'lasca_silex', { silex: 1, piedra: 1 }, 20),
  hacha_piedra:      r('Hacha de piedra', 'piedra_tallar', 'hacha_piedra', { piedra: 1, rama: 1, cordel: 2 }, 60),
  // N0, en la hoguera
  lanza_endurecida:  r('Lanza endurecida', 'hoguera', 'lanza_endurecida', { rama: 1 }, 60),
  antorcha:          r('Antorcha', 'hoguera', 'antorcha', { rama: 1, fibra: 1 }, 20),
  antorcha_resina:   r('Antorcha (con resina)', 'hoguera', 'antorcha', { rama: 1, resina: 1 }, 20),
  // N1, con las manos
  odre:              r('Odre', 'manos', 'odre', { piel: 1, cordel: 1 }, 30),
  // N1, en el banco de tronco
  cuerda:            r('Cuerda', 'banco_tronco', 'cuerda', { cordel: 3 }, 30),
  cuerda_trenzada:   r('Cinturón de cuerda', 'banco_tronco', 'cuerda_trenzada', { cuerda: 2 }, 30),
  cesta_recoleccion: r('Cesta de recolección', 'banco_tronco', 'cesta_recoleccion', { mimbre: 2 }, 45),
  cesta_juncos:      r('Cesta de recolección (de juncos)', 'banco_tronco', 'cesta_recoleccion', { junco: 2 }, 45),
  cesto_pescador:    r('Cesto de pescador', 'banco_tronco', 'cesto_pescador', { mimbre: 2 }, 45),
  nasa:              r('Nasa', 'banco_tronco', 'nasa', { mimbre: 2 }, 45),
  trampa_lazo:       r('Trampa de lazo', 'banco_tronco', 'trampa_lazo', { cuerda: 1, rama: 2 }, 30),
  pala_madera:       r('Pala de madera', 'banco_tronco', 'pala_madera', { tronco_corto: 1 }, 60),
  azada:             r('Azada de madera y piedra', 'banco_tronco', 'azada', { rama: 1, piedra: 1, cuerda: 1 }, 45),
  hoz_silex:         r('Hoz de sílex', 'banco_tronco', 'hoz_silex', { rama: 1, lasca_silex: 3 }, 45),
  mayal:             r('Mayal', 'banco_tronco', 'mayal', { rama: 2, cuerda: 1 }, 45),
  cubo:              r('Cubo de madera', 'banco_tronco', 'cubo', { tronco_corto: 1 }, 60),
};

const tiene = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------- Materiales: lo que llevas y lo de los arcones ----------------
// Las rutas de lo que se puede gastar de un tipo: no lo puesto (un cinturón, una mochila o un saco en su lugar), ni
// un contenedor con algo dentro.
function rutasGastables(inv, tipo) {
  return inv.rutasCon(tipo).filter(ruta => {
    const c = inv.buscar(ruta).cosa, d = inv.def(c);
    if (!ruta.includes('/') && !ruta.startsWith('mano:') && d && d.lugar) return false; // lo llevas puesto
    return !(c.dentro && c.dentro.some(Boolean));
  });
}
const enInventario = (inv, tipo) => rutasGastables(inv, tipo).reduce((t, ruta) => t + inv.buscar(ruta).cosa.n, 0);

// Los arcones a pocos pasos de un sitio, del más cercano al más lejano. Un arcón: { id, x, z, contenido: {tipo: n} }.
export function arconesCerca(arcones, sitio) {
  return (arcones || []).filter(a => a && Number.isFinite(a.x) && Number.isFinite(a.z) && a.contenido && dist(a, sitio) <= ALCANCE_ARCONES)
    .sort((a, b) => dist(a, sitio) - dist(b, sitio));
}

// Cuánto hay de cada material de «gasta» (lo que llevas y los arcones) y qué falta.
export function faltan(gasta, inv, arcones) {
  const res = {};
  for (const [tipo, n] of Object.entries(gasta)) {
    const hay = enInventario(inv, tipo) + arcones.reduce((t, a) => t + (tiene(a.contenido, tipo) ? a.contenido[tipo] : 0), 0);
    if (hay < n) res[tipo] = n - hay;
  }
  return res;
}

// Gasta «gasta» de lo que llevas y luego de los arcones. Antes hay que mirar que no falte nada (faltan()).
function gastarTodo(gasta, inv, arcones) {
  const usado = { encima: {}, arcones: {} };
  for (const [tipo, n] of Object.entries(gasta)) {
    let queda = n;
    for (const ruta of rutasGastables(inv, tipo)) {
      if (!queda) break;
      const m = Math.min(queda, inv.buscar(ruta).cosa.n);
      inv.sacar(ruta, m); queda -= m; usado.encima[tipo] = (usado.encima[tipo] || 0) + m;
    }
    for (const a of arcones) {
      if (!queda) break;
      const hay = tiene(a.contenido, tipo) ? a.contenido[tipo] : 0, m = Math.min(queda, hay);
      if (!m) continue;
      a.contenido[tipo] = hay - m; if (!a.contenido[tipo]) delete a.contenido[tipo];
      queda -= m; (usado.arcones[a.id] ||= {})[tipo] = m;
    }
  }
  return usado;
}

const textoFaltan = f => 'Te falta: ' + Object.entries(f).map(([t, n]) => `${n} de ${(CATALOGO[t] || {}).nombre || t}`).join(', ') + '.';

// ---------------- Estaciones y colas ----------------
export const VERSION_FABRICACION = 1;
export class Fabricacion {
  constructor() {
    this.estaciones = {}; // id → { id, tipo, x, z, autor, cola: [{ autor, receta, empieza, fin }] }
    this.manos = {};      // autor → [{ autor, receta, empieza, fin }]
    this.siguiente = 1;
  }

  // Colocar una estación en (x, z): gasta su coste de lo que llevas y de los arcones a pocos pasos de ese sitio.
  colocar(autor, tipo, x, z, inv, arcones = []) {
    if (!tiene(ESTACIONES, tipo)) return { ok: false, motivo: 'Esa estación no existe.' };
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, motivo: 'Sitio no válido.' };
    const e = ESTACIONES[tipo], sitio = { x, z };
    if (e.requiere && !e.requiere.some(t => inv.cuantos(t) > 0))
      return { ok: false, motivo: `Hace falta llevar ${e.requiere.map(t => CATALOGO[t].nombre.toLowerCase()).join(' o ')}.` };
    const cerca = arconesCerca(arcones, sitio), f = faltan(e.coste, inv, cerca);
    if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f), faltan: f };
    const usado = gastarTodo(e.coste, inv, cerca);
    const id = `${tipo}:${this.siguiente++}`;
    this.estaciones[id] = { id, tipo, x, z, autor, cola: [] };
    return { ok: true, id, usado };
  }

  // La cola de una estación (o de las manos de un autor).
  colaDe(estacion, autor) { return estacion ? (this.estaciones[estacion] || {}).cola : (this.manos[autor] ||= []); }

  // Encargar una receta. estacion: id de la estación, o null para las manos. pos: dónde está el autor { x, z }.
  fabricar(autor, receta, estacion, pos, inv, arcones, ahora) {
    if (!tiene(RECETAS, receta)) return { ok: false, motivo: 'Esa receta no existe.' };
    const rc = RECETAS[receta];
    let sitio = pos, cola, max = COLA_MANOS;
    if (rc.donde === 'manos') {
      if (estacion) return { ok: false, motivo: 'Eso se hace con las manos.' };
      cola = this.colaDe(null, autor);
    } else {
      const e = estacion && tiene(this.estaciones, estacion) ? this.estaciones[estacion] : null;
      if (!e) return { ok: false, motivo: `Hace falta ${ESTACIONES[rc.donde].nombre.toLowerCase()}.` };
      if (e.tipo !== rc.donde) return { ok: false, motivo: `Eso se hace en ${ESTACIONES[rc.donde].nombre.toLowerCase()}.` };
      if (dist(e, pos) > ALCANCE_ESTACION) return { ok: false, motivo: 'Estás demasiado lejos de la estación.' };
      sitio = e; cola = e.cola; max = COLA_ESTACION;
    }
    const sinTerminar = cola.filter(c => c.fin > ahora);
    if (sinTerminar.length >= max) return { ok: false, motivo: rc.donde === 'manos' ? 'Ya estás haciendo otra cosa.' : 'La cola de la estación está llena.' };
    const cerca = arconesCerca(arcones, sitio), f = faltan(rc.gasta, inv, cerca);
    if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f), faltan: f };
    const usado = gastarTodo(rc.gasta, inv, cerca);
    // empieza cuando acaba lo anterior de la cola (o ya)
    const empieza = Math.max(ahora, ...cola.map(c => c.fin));
    const encargo = { autor, receta, empieza, fin: empieza + rc.s * 1000 };
    cola.push(encargo);
    return { ok: true, encargo: { ...encargo }, usado };
  }

  // Lo que hay en una cola, con lo que le falta a cada encargo (ms) y si está terminado.
  estado(estacion, autor, ahora) {
    const cola = this.colaDe(estacion, autor) || [];
    return cola.map(c => ({ ...c, falta: Math.max(0, c.fin - ahora), terminado: ahora >= c.fin }));
  }

  // Recoger lo terminado del autor en una estación (o de sus manos): va a lo que lleva, donde quepa; lo que no cabe
  // sigue esperando.
  recoger(autor, estacion, pos, inv, ahora) {
    let cola;
    if (estacion) {
      const e = tiene(this.estaciones, estacion) ? this.estaciones[estacion] : null;
      if (!e) return { ok: false, motivo: 'Ahí no hay estación.' };
      if (dist(e, pos) > ALCANCE_ESTACION) return { ok: false, motivo: 'Estás demasiado lejos de la estación.' };
      cola = e.cola;
    } else cola = this.colaDe(null, autor);
    const mios = cola.filter(c => c.autor === autor && ahora >= c.fin);
    if (!mios.length) return { ok: false, motivo: cola.some(c => c.autor === autor) ? 'Aún no está terminado.' : 'Aquí no tienes nada.' };
    const dados = [];
    let sinSitio = false;
    for (const c of mios) {
      const rc = RECETAS[c.receta], m = inv.meterDonde(rc.da, rc.n);
      if (!m.ok) { sinSitio = true; continue; }
      cola.splice(cola.indexOf(c), 1);
      dados.push({ objeto: rc.da, cantidad: rc.n, donde: m.donde });
    }
    if (!dados.length) return { ok: false, motivo: 'No te cabe: no tienes sitio libre.' };
    return { ok: true, dados, quedan: sinSitio };
  }

  exportar() {
    const copia = l => l.map(c => ({ ...c }));
    return {
      version: VERSION_FABRICACION, siguiente: this.siguiente,
      estaciones: Object.values(this.estaciones).map(e => ({ ...e, cola: copia(e.cola) })),
      manos: Object.fromEntries(Object.entries(this.manos).filter(([, l]) => l.length).map(([k, l]) => [k, copia(l)])),
    };
  }
  // Lo guardado que no se entiende (estaciones o recetas que ya no existen) se descarta.
  importar(datos) {
    const d = migrarFabricacion(datos);
    this.estaciones = {}; this.manos = {}; this.siguiente = 1;
    if (!d) return this;
    const bueno = c => c && typeof c.autor === 'string' && tiene(RECETAS, c.receta) && Number.isFinite(c.empieza) && Number.isFinite(c.fin);
    const limpia = l => (Array.isArray(l) ? l : []).filter(bueno).map(c => ({ autor: c.autor, receta: c.receta, empieza: c.empieza, fin: c.fin }));
    for (const e of d.estaciones || []) {
      if (!e || typeof e.id !== 'string' || !tiene(ESTACIONES, e.tipo) || !Number.isFinite(e.x) || !Number.isFinite(e.z)) continue;
      this.estaciones[e.id] = { id: e.id, tipo: e.tipo, x: e.x, z: e.z, autor: e.autor, cola: limpia(e.cola).filter(c => RECETAS[c.receta].donde === e.tipo) };
    }
    for (const [k, l] of Object.entries(d.manos || {})) { const m = limpia(l); if (m.length) this.manos[k] = m; }
    this.siguiente = Number.isInteger(d.siguiente) && d.siguiente > 0 ? d.siguiente : 1;
    return this;
  }
}

// Paso de formatos antiguos al de ahora: MIGRACIONES_FABRICACION[v] pasa de v a v+1.
export const MIGRACIONES_FABRICACION = {};
export function migrarFabricacion(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_FABRICACION) { const paso = MIGRACIONES_FABRICACION[d.version]; if (!paso) return null; d = paso(d); }
  return d && d.version === VERSION_FABRICACION ? d : null;
}

// ---------------- Acciones con autor ----------------
// { autor, tipo: 'colocar_estacion', estacion: tipo, x, z }
// { autor, tipo: 'fabricar', receta, estacion: id | null, x, z }   — x, z: dónde está el autor (el servidor usará la suya)
// { autor, tipo: 'recoger_fabricado', estacion: id | null, x, z }
// arcones: los del mundo (los da quien valida). ahora: la hora del que valida, nunca la del mensaje. Lo gastado sale
// de lo del autor y lo fabricado va al autor, nunca a otro. Se anota en el registro, salga bien o no.
export function ejecutarFabricacion(fab, invs, registro, accion, ahora, arcones = []) {
  let res;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64 && !(v in Object.prototype);
  const est = v => v === null || v === undefined || txt(v);
  if (!a || typeof a !== 'object') res = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) res = { ok: false, motivo: 'Acción sin autor.' };
  else if (!['colocar_estacion', 'fabricar', 'recoger_fabricado'].includes(a.tipo)) res = { ok: false, motivo: 'Acción desconocida.' };
  else if (!Number.isFinite(a.x) || !Number.isFinite(a.z) || !est(a.estacion) || (a.tipo === 'fabricar' && !txt(a.receta))) res = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) res = { ok: false, motivo: 'Sin hora.' };
  else {
    const inv = invs.de(a.autor), pos = { x: a.x, z: a.z };
    if (a.tipo === 'colocar_estacion') res = fab.colocar(a.autor, a.estacion, a.x, a.z, inv, arcones);
    else if (a.tipo === 'fabricar') res = fab.fabricar(a.autor, a.receta, a.estacion || null, pos, inv, arcones, ahora);
    else res = fab.recoger(a.autor, a.estacion || null, pos, inv, ahora);
  }
  const e = registro.anotar(accion || {}, res);
  e.ahora = ahora;
  if (res.ok) e.resultado = res.id ? { estacion: res.id } : res.encargo ? { receta: res.encargo.receta, fin: res.encargo.fin } : { dados: res.dados.map(d => [d.objeto, d.cantidad]) };
  return res;
}
