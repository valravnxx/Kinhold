// Fabricar (revisión del 1 nov; GDD, apartado 9; documento de sistemas, apartados 7 y 8): las recetas están siempre a
// la vista, nadie las aprende; se fabrica en cualquier sitio con lo que llevas y lo que hay en el suelo a tu lado; y
// las estaciones son herramientas por uso, no niveles: una receta pide un USO (con las manos, al fuego, en la piedra de
// tallar, en el banco de tronco) y vale cualquier estación que lo dé (el fuego, la hoguera de fuera o el hogar de la
// casa). Lógica pura (sin three.js ni navegador): el servidor podrá usarla tal cual.
//
// Fabricar: lo que se hace con las manos, en cualquier sitio; lo demás, junto a una estación de su uso (la que se diga
// o la más cercana). La receta gasta primero lo que llevas encima y luego lo del suelo a tu lado; el encargo entra en
// la cola de la estación (o de tus manos) y se termina pasado su tiempo, contado por la hora (aunque nadie juegue): se
// guarda cuándo termina, no un contador. Lo terminado espera hasta que su autor lo recoge (solo él).
//
// Decisiones provisionales (el documento no las fija; anotadas en el diario):
//  - Tiempos: con las manos y lo sencillo, de 10 a 30 s; las herramientas, 45 a 60 s; endurecer la lanza al fuego,
//    60 s. Las estaciones se colocan al momento (su obra, con su marco y su tiempo, es otra tarea del hito).
//  - Cola: 3 encargos sin terminar por estación; con las manos, uno solo (las tuyas, solo tú).
//  - Junto a la estación: a 2,5 m como mucho. «El suelo a tu lado»: lo que se podría coger (2 m, src/logica/suelo.js),
//    medido desde donde estás (al colocar una estación, desde donde se pone).
//  - Se gasta primero lo que llevas (manos, hombro y lo guardado en cinturón y mochila) y luego lo del suelo, de lo
//    más cercano a lo más lejano. Lo que llevas puesto (el cinturón, la mochila) no se gasta nunca, ni un contenedor
//    con algo dentro (tampoco en el suelo).
//  - Los almacenajes de la base no cuentan: el acopio es acopio, no abastecimiento (revisión del 1 nov). Hay que sacar
//    lo que se vaya a usar.
//  - «1 piedra grande» de la piedra de tallar es 1 piedra suelta (la que se recoge a mano). El banco de tronco pide
//    «herramienta de piedra»: llevar un hacha de piedra o una lasca de sílex, que no se gasta.
//  - «Rama larga» y «rama curva» son ramas: la rastra gasta 5 ramas (2 largas y 3). La antorcha, con fibra o con
//    resina (dos recetas). La cesta de recolección, con mimbre o con juncos (dos recetas). El cinturón de cuerda es
//    la cuerda trenzada del inventario (2 huecos pequeños).
//  - El hogar da el mismo uso que la hoguera (el fuego); llega como estación con la casa humilde (su tarea del hito).
//  - Quedan para cuando existan sus materiales u objetos: envueltas de piel (no hay prenda de pies de piel), anzuelo
//    (no hay hueso), refugio de ramas (es una obra), carretilla (no hay rodaja de tronco), zurrón y chaleco (no hay
//    piel limpia), vendas, y lo de cocinar y calentarse al fuego.
//  - Lo terminado va donde quepa en lo que llevas (como lo recogido del suelo); si no cabe, sigue esperando.
import { CATALOGO } from './inventario.js';
import { ALCANCE_COGER } from './suelo.js';

export const ALCANCE_ESTACION = 2.5;        // m, del jugador a la estación
export const ALCANCE_SUELO = ALCANCE_COGER; // m, del jugador a lo del suelo que se gasta
export const COLA_ESTACION = 3;             // encargos sin terminar por estación
export const COLA_MANOS = 1;

// Los usos: qué estaciones dan cada uno. Una receta pide un uso, no una estación concreta.
export const USOS = {
  manos:  { nombre: 'Con las manos', estaciones: [] },
  fuego:  { nombre: 'Al fuego', estaciones: ['hoguera', 'hogar'] }, // el hogar, con la casa humilde
  tallar: { nombre: 'En la piedra de tallar', estaciones: ['piedra_tallar'] },
  banco:  { nombre: 'En el banco de tronco', estaciones: ['banco_tronco'] },
};

// un: cómo se nombra en una frase. coste: lo que se gasta al colocarla. requiere: lleva al menos uno de estos (no se gasta). uso: el que da.
export const ESTACIONES = {
  hoguera:       { nombre: 'Hoguera', un: 'una hoguera', uso: 'fuego', coste: { piedra: 6, rama: 4 }, hace: 'Cocinar, calentarse, endurecer al fuego, antorchas' },
  piedra_tallar: { nombre: 'Piedra de tallar', un: 'una piedra de tallar', uso: 'tallar', coste: { piedra: 1 }, hace: 'Herramientas de piedra y sílex' },
  banco_tronco:  { nombre: 'Banco de trabajo de tronco', un: 'un banco de trabajo de tronco', uso: 'banco', coste: { tronco_corto: 2 }, requiere: ['hacha_piedra', 'lasca_silex'], hace: 'Trabajos de madera, mangos, cestería, primeras piezas de construcción' },
};
// Las estaciones que existen de un uso (el hogar aún no), y cómo se nombran juntas («una hoguera o un hogar»).
export const estacionesDeUso = uso => (USOS[uso] ? USOS[uso].estaciones : []).filter(t => Object.hasOwn(ESTACIONES, t));
export const conQue = uso => estacionesDeUso(uso).map(t => ESTACIONES[t].un).join(' o ');

// uso: uno de USOS. da: tipo del catálogo y cuántos. gasta: tipo → cuántos. s: segundos.
const r = (nombre, uso, da, gasta, s, n = 1) => ({ nombre, uso, da, n, gasta, s });
export const RECETAS = {
  // con las manos
  cordel:            r('Cordel de fibra', 'manos', 'cordel', { fibra: 3 }, 15),
  palo_cavador:      r('Palo cavador', 'manos', 'palo_cavador', { rama: 1 }, 10),
  honda:             r('Honda', 'manos', 'honda', { cordel: 2, piel: 1 }, 30),
  lenero:            r('Leñero', 'manos', 'lenero', { rama: 4, cordel: 2 }, 30),
  rastra:            r('Rastra', 'manos', 'rastra', { rama: 5, cordel: 2 }, 30),
  fardo:             r('Fardo atado', 'manos', 'fardo', { cordel: 2 }, 15),
  arpon:             r('Arpón', 'manos', 'arpon', { rama: 1, lasca_silex: 1, cordel: 1 }, 30),
  odre:              r('Odre', 'manos', 'odre', { piel: 1, cordel: 1 }, 30),
  // en la piedra de tallar
  lasca_silex:       r('Lasca de sílex', 'tallar', 'lasca_silex', { silex: 1, piedra: 1 }, 20),
  hacha_piedra:      r('Hacha de piedra', 'tallar', 'hacha_piedra', { piedra: 1, rama: 1, cordel: 2 }, 60),
  // al fuego (hoguera u hogar)
  lanza_endurecida:  r('Lanza endurecida', 'fuego', 'lanza_endurecida', { rama: 1 }, 60),
  antorcha:          r('Antorcha', 'fuego', 'antorcha', { rama: 1, fibra: 1 }, 20),
  antorcha_resina:   r('Antorcha (con resina)', 'fuego', 'antorcha', { rama: 1, resina: 1 }, 20),
  // en el banco de tronco
  cuerda:            r('Cuerda', 'banco', 'cuerda', { cordel: 3 }, 30),
  cuerda_trenzada:   r('Cinturón de cuerda', 'banco', 'cuerda_trenzada', { cuerda: 2 }, 30),
  cesta_recoleccion: r('Cesta de recolección', 'banco', 'cesta_recoleccion', { mimbre: 2 }, 45),
  cesta_juncos:      r('Cesta de recolección (de juncos)', 'banco', 'cesta_recoleccion', { junco: 2 }, 45),
  cesto_pescador:    r('Cesto de pescador', 'banco', 'cesto_pescador', { mimbre: 2 }, 45),
  nasa:              r('Nasa', 'banco', 'nasa', { mimbre: 2 }, 45),
  trampa_lazo:       r('Trampa de lazo', 'banco', 'trampa_lazo', { cuerda: 1, rama: 2 }, 30),
  pala_madera:       r('Pala de madera', 'banco', 'pala_madera', { tronco_corto: 1 }, 60),
  azada:             r('Azada de madera y piedra', 'banco', 'azada', { rama: 1, piedra: 1, cuerda: 1 }, 45),
  hoz_silex:         r('Hoz de sílex', 'banco', 'hoz_silex', { rama: 1, lasca_silex: 3 }, 45),
  mayal:             r('Mayal', 'banco', 'mayal', { rama: 2, cuerda: 1 }, 45),
  cubo:              r('Cubo de madera', 'banco', 'cubo', { tronco_corto: 1 }, 60),
};

const tiene = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------- Materiales: lo que llevas y lo del suelo a tu lado ----------------
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

// Lo del suelo que se puede gastar a tu lado (sitio: { x, z }), de lo más cercano a lo más lejano: no un contenedor
// con algo dentro. suelo: un Suelo (src/logica/suelo.js) o nada.
export function sueloCerca(suelo, sitio, ahora) {
  if (!suelo || !Number.isFinite(sitio.x) || !Number.isFinite(sitio.z)) return [];
  return suelo.cercanos(sitio.x, sitio.z, ahora, ALCANCE_SUELO).filter(o => !(o.cosa.dentro && o.cosa.dentro.some(Boolean)));
}
const enSuelo = (cerca, tipo) => cerca.reduce((t, o) => t + (o.cosa.tipo === tipo ? o.cosa.n : 0), 0);

// De dónde sale cada material de «gasta» (lo que llevas y el suelo a tu lado) y qué falta.
export function cuentas(gasta, inv, cerca) {
  const de = {}, falta = {};
  for (const [tipo, n] of Object.entries(gasta)) {
    const encima = Math.min(n, enInventario(inv, tipo)), suelo = Math.min(n - encima, enSuelo(cerca, tipo));
    de[tipo] = { encima, suelo };
    if (encima + suelo < n) falta[tipo] = n - encima - suelo;
  }
  return { de, faltan: falta };
}
export const faltan = (gasta, inv, cerca) => cuentas(gasta, inv, cerca).faltan;

// Gasta «gasta» de lo que llevas y luego del suelo. Antes hay que mirar que no falte nada (faltan()).
function gastarTodo(gasta, inv, cerca, suelo) {
  const usado = { encima: {}, suelo: {} };
  for (const [tipo, n] of Object.entries(gasta)) {
    let queda = n;
    for (const ruta of rutasGastables(inv, tipo)) {
      if (!queda) break;
      const m = Math.min(queda, inv.buscar(ruta).cosa.n);
      inv.sacar(ruta, m); queda -= m; usado.encima[tipo] = (usado.encima[tipo] || 0) + m;
    }
    for (const o of cerca) {
      if (!queda) break;
      if (o.cosa.tipo !== tipo) continue;
      const m = Math.min(queda, o.cosa.n);
      o.cosa.n -= m; queda -= m; (usado.suelo[o.id] ||= {})[tipo] = m;
      if (o.cosa.n <= 0) suelo.objetos = suelo.objetos.filter(x => x !== o);
    }
  }
  return usado;
}

const textoFaltan = f => 'Te falta: ' + Object.entries(f).map(([t, n]) => `${n} de ${(CATALOGO[t] || {}).nombre || t}`).join(', ') + '.';

// ---------------- Estaciones y colas ----------------
export const VERSION_FABRICACION = 3; // 3: sin lo que sabía cada uno (fuera aprender recetas, revisión del 1 nov)
export class Fabricacion {
  constructor() {
    this.estaciones = {}; // id → { id, tipo, x, z, autor, cola: [{ autor, receta, empieza, fin }] }
    this.manos = {};      // autor → [{ autor, receta, empieza, fin }]
    this.siguiente = 1;
  }

  // La estación de un uso más cercana a pos, a su alcance (o null).
  estacionCerca(uso, pos) {
    const tipos = estacionesDeUso(uso);
    return Object.values(this.estaciones).filter(e => tipos.includes(e.tipo) && dist(e, pos) <= ALCANCE_ESTACION)
      .sort((a, b) => dist(a, pos) - dist(b, pos))[0] || null;
  }

  // Todas las recetas, siempre a la vista, para quien está en pos con inv y el suelo a su lado:
  //  - «ya»: tiene su estación al lado (o es con las manos) y no le falta nada;
  //  - «casi»: tiene su estación al lado, pero le falta algo (faltan);
  //  - «despues»: le falta la estación de su uso (conQue dice cuál).
  // Cada una dice de dónde sale cada material (de: { tipo: { encima, suelo } }) y en qué estación se haría.
  lista(pos, inv, suelo, ahora) {
    const cerca = sueloCerca(suelo, pos, ahora);
    return Object.entries(RECETAS).map(([receta, rc]) => {
      const e = rc.uso === 'manos' ? null : this.estacionCerca(rc.uso, pos);
      const { de, faltan: f } = cuentas(rc.gasta, inv, cerca);
      const grupo = rc.uso !== 'manos' && !e ? 'despues' : Object.keys(f).length ? 'casi' : 'ya';
      return { receta, nombre: rc.nombre, uso: rc.uso, grupo, estacion: e ? e.id : null, conQue: rc.uso === 'manos' ? '' : conQue(rc.uso), de, faltan: f };
    });
  }

  // Colocar una estación en (x, z): gasta su coste de lo que llevas y de lo del suelo al lado de ese sitio.
  colocar(autor, tipo, x, z, inv, suelo = null, ahora = 0) {
    if (!tiene(ESTACIONES, tipo)) return { ok: false, motivo: 'Esa estación no existe.' };
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, motivo: 'Sitio no válido.' };
    const e = ESTACIONES[tipo], sitio = { x, z };
    if (e.requiere && !e.requiere.some(t => inv.cuantos(t) > 0))
      return { ok: false, motivo: `Hace falta llevar ${e.requiere.map(t => CATALOGO[t].nombre.toLowerCase()).join(' o ')}.` };
    const cerca = sueloCerca(suelo, sitio, ahora), f = faltan(e.coste, inv, cerca);
    if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f), faltan: f };
    const usado = gastarTodo(e.coste, inv, cerca, suelo);
    const id = `${tipo}:${this.siguiente++}`;
    this.estaciones[id] = { id, tipo, x, z, autor, cola: [] };
    return { ok: true, id, usado };
  }

  // La cola de una estación (o de las manos de un autor).
  colaDe(estacion, autor) { return estacion ? (this.estaciones[estacion] || {}).cola : (this.manos[autor] ||= []); }

  // Encargar una receta. estacion: id de la estación, o null (con las manos, o la más cercana de su uso). pos: dónde
  // está el autor { x, z }. suelo: el Suelo del mundo (lo que haya a su lado se puede gastar).
  fabricar(autor, receta, estacion, pos, inv, suelo, ahora) {
    if (!tiene(RECETAS, receta)) return { ok: false, motivo: 'Esa receta no existe.' };
    const rc = RECETAS[receta];
    let cola, max = COLA_MANOS;
    if (rc.uso === 'manos') {
      if (estacion) return { ok: false, motivo: 'Eso se hace con las manos.' };
      cola = this.colaDe(null, autor);
    } else {
      let e;
      if (estacion) {
        e = tiene(this.estaciones, estacion) ? this.estaciones[estacion] : null;
        if (!e) return { ok: false, motivo: 'Ahí no hay estación.' };
        if (ESTACIONES[e.tipo].uso !== rc.uso) return { ok: false, motivo: `Eso se hace en ${conQue(rc.uso)}.` };
        if (dist(e, pos) > ALCANCE_ESTACION) return { ok: false, motivo: 'Estás demasiado lejos de la estación.' };
      } else {
        e = this.estacionCerca(rc.uso, pos);
        if (!e) return { ok: false, motivo: `Hace falta ${conQue(rc.uso)} a tu lado.` };
      }
      cola = e.cola; max = COLA_ESTACION;
    }
    const sinTerminar = cola.filter(c => c.fin > ahora);
    if (sinTerminar.length >= max) return { ok: false, motivo: rc.uso === 'manos' ? 'Ya estás haciendo otra cosa.' : 'La cola de la estación está llena.' };
    const cerca = sueloCerca(suelo, pos, ahora), f = faltan(rc.gasta, inv, cerca);
    if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f), faltan: f };
    const usado = gastarTodo(rc.gasta, inv, cerca, suelo);
    // empieza cuando acaba lo anterior de la cola (o ya)
    const empieza = Math.max(ahora, ...cola.map(c => c.fin));
    const encargo = { autor, receta, empieza, fin: empieza + rc.s * 1000 };
    cola.push(encargo);
    const est = Object.values(this.estaciones).find(x => x.cola === cola);
    return { ok: true, encargo: { ...encargo }, estacion: est ? est.id : null, usado };
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
      const uso = ESTACIONES[e.tipo].uso;
      this.estaciones[e.id] = { id: e.id, tipo: e.tipo, x: e.x, z: e.z, autor: e.autor, cola: limpia(e.cola).filter(c => RECETAS[c.receta].uso === uso) };
    }
    for (const [k, l] of Object.entries(d.manos || {})) {
      if (k in Object.prototype) continue;
      const m = limpia(l).filter(c => RECETAS[c.receta].uso === 'manos'); if (m.length) this.manos[k] = m;
    }
    this.siguiente = Number.isInteger(d.siguiente) && d.siguiente > 0 ? d.siguiente : 1;
    return this;
  }
}

// Paso de formatos antiguos al de ahora: MIGRACIONES_FABRICACION[v] pasa de v a v+1. Las estaciones, sus colas y lo de
// las manos se quedan (los nombres de estaciones y recetas no han cambiado).
export const MIGRACIONES_FABRICACION = {
  1: d => ({ ...d, version: 2 }), // la v2 añadió lo que sabía cada uno
  2: d => { const { saber, ...resto } = d; return { ...resto, version: 3 }; }, // y la v3 lo quita: nadie aprende recetas
};
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
// suelo: el Suelo del mundo (lo da quien valida). ahora: la hora del que valida, nunca la del mensaje. Lo gastado sale
// de lo del autor o del suelo a su lado y lo fabricado va al autor, nunca a otro. Se anota en el registro, salga bien o no.
export function ejecutarFabricacion(fab, invs, registro, accion, ahora, suelo = null) {
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
    if (a.tipo === 'colocar_estacion') res = fab.colocar(a.autor, a.estacion, a.x, a.z, inv, suelo, ahora);
    else if (a.tipo === 'fabricar') res = fab.fabricar(a.autor, a.receta, a.estacion || null, pos, inv, suelo, ahora);
    else res = fab.recoger(a.autor, a.estacion || null, pos, inv, ahora);
  }
  const e = registro.anotar(accion || {}, res);
  e.ahora = ahora;
  if (res.ok) {
    e.resultado = res.id ? { estacion: res.id } : res.encargo ? { receta: res.encargo.receta, fin: res.encargo.fin, ...(res.estacion ? { estacion: res.estacion } : {}) } : { dados: res.dados.map(d => [d.objeto, d.cantidad]) };
    if (res.usado && Object.keys(res.usado.suelo).length) e.resultado.delSuelo = JSON.parse(JSON.stringify(res.usado.suelo));
  }
  return res;
}
