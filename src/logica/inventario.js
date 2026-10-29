// Inventario por huecos (GDD, apartado 7). Lógica pura (sin three.js ni navegador): el servidor podrá usarla tal cual.
//
// Cada jugador lleva cosas en lugares de su cuerpo:
//   mano:der, mano:izq   — lo pequeño (P) y lo mediano (M) en una mano; lo grande (G) ocupa las dos.
//   espalda              — vacía o con una mochila o bastidor, que tiene sus huecos interiores.
//   cintura              — el cinturón; sin cinturón no hay huecos de cintura (los define el que lleves).
//   hombro               — un saco, una bandolera o un odre.
//   ropa:<capa>          — la ropa por capas (interior, piernas, abrigo, exterior, sobre, cabeza, guantes, pies).
// Dentro de un contenedor puesto, cada hueco se nombra con su número: 'cintura/0', 'espalda/3'. Si en ese hueco
// hay otro contenedor, se sigue: 'cintura/0/1'.
// Lo enorme (E) no se lleva encima: se arrastra, va en carro o entre varios.
//
// Decisiones provisionales (el GDD no las da; anotadas en el diario):
//  - Cuántas unidades caben en un hueco (pila) va por tamaño: P 10, M 3, G y E 1. Las herramientas, la ropa y los
//    contenedores no se apilan (1 por hueco).
//  - Un hueco admite lo de su tamaño o más pequeño. La mano es un hueco mediano.
//  - La capa interior del GDD («camisa y pantalón») son dos lugares: interior (camisa) y piernas (pantalón o calzas).
//  - Lo que tenía guardado un jugador y ya no cabe al cargar (por ejemplo, si un cinturón pasa a tener menos huecos)
//    no se pierde: queda «a tus pies» (lista apartado) hasta que haya objetos en el suelo.
//
// Equipo de carga (GDD, apartado 7: cinturones, mochilas y bastidores de función única, y lo de hombro). El GDD da
// los huecos de los cinturones; de las mochilas dice qué llevan y si es «mucho» o «poco». Decisiones provisionales
// para las mochilas y lo de hombro (anotadas en el diario; se ajustan al probar):
//  - Leñero: 2 huecos grandes y 4 medianos, solo leña y troncos cortos (hasta 2 troncos cortos y 12 de leña, o 18 de leña).
//  - Cesta de recolección: 6 huecos pequeños para bayas, setas, hierbas, frutos secos y huevos (60 unidades).
//  - Fardo atado: 4 huecos medianos para pieles, telas, fibras y paja.
//  - Zurrón de piel (mixto, poco): 2 medianos y 2 pequeños. Mochila de bastidor (mixto, más): 4 medianos y 4 pequeños.
//  - Porta-piedras: 4 huecos medianos para piedras (12). El bloque de piedra en bruto es enorme: rastra o carro.
//  - Caja de herramientas de espalda: 4 huecos medianos, solo herramientas. Carcaj: 2 huecos de flechas o virotes (20).
//  - Cesto de pescador: 4 huecos medianos para pescado y aparejos (anzuelos). Correa del escudo: el escudo y nada más.
//  - Hombro: saco con 2 huecos medianos (grano, harina, arena); bandolera con 3 pequeños (mixta); odre con 1 de agua.
//  - Tamaño de lo que se lleva puesto: mochilas y bastidores G (en las manos ocupan las dos), cinturones M (el cordel P),
//    saco y odre M, bandolera P. La espada y el escudo son M (se llevan en una mano).
//  - Los añadidos al cinturón (bolsas, vainas, ganchos) llegan con la fabricación.
//
// Ralentización por carga (GDD, apartado 7: «solo si vas cargado al máximo en todo, la velocidad al caminar baja
// hasta el 80%; con poca carga no se nota»). Decisiones provisionales (anotadas en el diario y en el registro):
//  - Lo lleno que vas es la media de los cuatro lugares de carga: manos, espalda, cintura y hombro. Cada uno cuenta
//    de 0 (vacío o sin nada puesto) a 1 (todos sus huecos llenos). Lo grande en las manos las llena las dos.
//  - Cada hueco cuenta lo que tiene entre lo que cabe (5 piedras de 10 → medio). Un contenedor dentro de otro
//    cuenta como hueco lleno.
//  - La reducción crece con el cuadrado de lo lleno que vas: 1 − 0,2·f². Con poco no se nota (las manos llenas,
//    nada más: 1,25%) y todo lleno da el 80%. Se aplica al andar y al correr.
//  - La ropa y la armadura no cuentan aquí (su peso está en src/logica/prendas.js; lo que ralentiza la armadura va
//    con el combate con armadura).
import { PRENDAS } from './prendas.js';

export const TAMANOS = ['P', 'M', 'G', 'E'];
const orden = t => TAMANOS.indexOf(t);
export const PILA_POR_TAMANO = { P: 10, M: 3, G: 1, E: 1 };

export const MANOS = ['mano:der', 'mano:izq'];
export const CAPAS = ['interior', 'piernas', 'abrigo', 'exterior', 'sobre', 'cabeza', 'guantes', 'pies'];
export const LUGARES = [...MANOS, 'espalda', 'cintura', 'hombro', ...CAPAS.map(c => 'ropa:' + c)];

// Catálogo: recursos (se apilan) del documento de sistemas, y objetos.
// tam: P, M, G, E. recurso: true → se apila. lugar: dónde se pone (espalda, cintura, hombro). capa: prenda.
// huecos: los huecos interiores de un contenedor, cada uno con su tamaño y, si hace falta, lo que admite
// (tipos de objeto). admite en el contenedor vale para todos sus huecos.
const R = (nombre, tam) => ({ nombre, tam, recurso: true });
const hs = (tam, n) => Array.from({ length: n }, () => ({ tam }));
export const CATALOGO = {
  // del suelo y las plantas
  rama: R('Rama', 'M'), piedra: R('Piedra', 'M'), silex: R('Sílex', 'P'), fibra: R('Fibra cruda', 'P'),
  junco: R('Haz de juncos', 'M'), mimbre: R('Haz de mimbre', 'M'), bayas: R('Bayas', 'P'), setas: R('Setas', 'P'),
  frutos_secos: R('Frutos secos', 'P'), hierbas: R('Manojo de hierbas', 'P'), corteza: R('Corteza', 'M'),
  resina: R('Resina', 'P'), barro: R('Cesta de barro', 'M'), arcilla: R('Cesta de arcilla', 'M'), arena: R('Saco de arena', 'M'),
  turba: R('Bloque de turba', 'M'), panal: R('Panal', 'P'), huevo: R('Huevo', 'P'),
  // de los árboles
  tronco_delgado: R('Tronco delgado', 'G'), tronco_largo: R('Tronco largo', 'E'), tronco_corto: R('Tronco corto', 'G'),
  lena: R('Leña', 'M'),
  // de la tierra
  bloque_piedra: R('Bloque de piedra en bruto', 'E'), mineral_hierro: R('Mineral de hierro', 'M'),
  // de los animales, el campo y el agua
  piel: R('Piel', 'M'), tela: R('Tela', 'M'), paja: R('Haz de paja', 'M'), pescado: R('Pescado', 'M'),
  grano: R('Grano', 'P'), harina: R('Harina', 'P'), agua: R('Agua', 'P'),
  flecha: R('Flecha', 'P'), virote: R('Virote', 'P'), anzuelo: R('Anzuelo y sedal', 'P'),
  // herramientas y armas (herramienta: true → van en la caja de herramientas)
  cuchillo: { nombre: 'Cuchillo', tam: 'P', herramienta: true },
  hacha_mano: { nombre: 'Hacha de mano', tam: 'M', herramienta: true },
  espada: { nombre: 'Espada', tam: 'M' },
  escudo: { nombre: 'Escudo', tam: 'M' },
  // cinturones (GDD: sus huecos). El cordel de fibra es el de inicio.
  cordel: { nombre: 'Cordel de fibra', tam: 'P', lugar: 'cintura', huecos: [{ tam: 'P' }] },
  cuerda_trenzada: { nombre: 'Cuerda trenzada', tam: 'M', lugar: 'cintura', huecos: [{ tam: 'P' }, { tam: 'P' }] },
  cinto_cuero: { nombre: 'Cinto de cuero', tam: 'M', lugar: 'cintura', huecos: [{ tam: 'M' }, { tam: 'P' }, { tam: 'P' }] },
  cinto_anillas: { nombre: 'Cinto con hebilla de hierro y anillas', tam: 'M', lugar: 'cintura', huecos: [{ tam: 'M' }, { tam: 'M' }, { tam: 'P' }, { tam: 'P' }] },
  cinto_armas: { nombre: 'Cinto de armas', tam: 'M', lugar: 'cintura', huecos: [{ tam: 'M', admite: ['espada'] }, { tam: 'P' }, { tam: 'P' }] },
  // mochilas y bastidores de función única (espalda)
  lenero: { nombre: 'Leñero', tam: 'G', lugar: 'espalda', huecos: [...hs('G', 2), ...hs('M', 4)], admite: ['lena', 'tronco_corto'] },
  cesta_recoleccion: { nombre: 'Cesta de recolección', tam: 'G', lugar: 'espalda', huecos: hs('P', 6), admite: ['bayas', 'setas', 'hierbas', 'frutos_secos', 'huevo'] },
  fardo: { nombre: 'Fardo atado', tam: 'G', lugar: 'espalda', huecos: hs('M', 4), admite: ['piel', 'tela', 'fibra', 'paja'] },
  zurron: { nombre: 'Zurrón de piel', tam: 'G', lugar: 'espalda', huecos: [...hs('M', 2), ...hs('P', 2)] },
  mochila_bastidor: { nombre: 'Mochila de bastidor', tam: 'G', lugar: 'espalda', huecos: [...hs('M', 4), ...hs('P', 4)] },
  porta_piedras: { nombre: 'Porta-piedras', tam: 'G', lugar: 'espalda', huecos: hs('M', 4), admite: ['piedra'] },
  caja_herramientas: { nombre: 'Caja de herramientas de espalda', tam: 'G', lugar: 'espalda', huecos: hs('M', 4), admiteHerramientas: true },
  carcaj: { nombre: 'Carcaj', tam: 'G', lugar: 'espalda', huecos: hs('P', 2), admite: ['flecha', 'virote'] },
  cesto_pescador: { nombre: 'Cesto de pescador', tam: 'G', lugar: 'espalda', huecos: hs('M', 4), admite: ['pescado', 'anzuelo'] },
  correa_escudo: { nombre: 'Escudo a la espalda (correa)', tam: 'G', lugar: 'espalda', huecos: hs('M', 1), admite: ['escudo'] },
  // al hombro
  saco: { nombre: 'Saco', tam: 'M', lugar: 'hombro', huecos: hs('M', 2), admite: ['grano', 'harina', 'arena'] },
  bandolera: { nombre: 'Bandolera', tam: 'P', lugar: 'hombro', huecos: hs('P', 3) },
  odre: { nombre: 'Odre', tam: 'M', lugar: 'hombro', huecos: hs('P', 1), admite: ['agua'] },
  // ropa: sale de los datos de cada prenda (src/logica/prendas.js), con su capa. Toda es mediana.
  ...Object.fromEntries(Object.entries(PRENDAS).map(([k, p]) => [k, { nombre: p.nombre, tam: 'M', capa: p.capa }])),
};

// La caja de herramientas admite todo lo que sea herramienta en el catálogo.
for (const d of Object.values(CATALOGO)) if (d.admiteHerramientas) d.admite = Object.keys(CATALOGO).filter(k => CATALOGO[k].herramienta);

// Equipo de carga por su lugar: los cinturones, lo de la espalda y lo del hombro del catálogo.
export const EQUIPO_CARGA = lugar => Object.keys(CATALOGO).filter(k => CATALOGO[k].lugar === lugar && CATALOGO[k].huecos);

// Lo que admite un contenedor y cuánto: por cada tipo que admite, cuántas unidades caben como mucho (llenando con
// eso los huecos que lo admiten por nombre). mixto: hay algún hueco que admite cualquier cosa de su tamaño o menor.
export function capacidad(tipo, cat = CATALOGO) {
  const d = cat[tipo];
  if (!d || !d.huecos) return null;
  const r = { huecos: d.huecos.map(h => h.tam), mixto: d.huecos.some(h => !(h.admite || d.admite)), porTipo: {} };
  for (const t of Object.keys(cat)) {
    const n = d.huecos.reduce((s, h) => {
      const adm = h.admite || d.admite;
      if (!adm || !adm.includes(t)) return s;
      return orden(cat[t].tam) <= orden(h.tam) ? s + pila(t, cat) : s;
    }, 0);
    if (n) r.porTipo[t] = n;
  }
  return r;
}

export function pila(tipo, cat = CATALOGO) {
  const d = cat[tipo];
  return d && d.recurso ? (d.pila || PILA_POR_TAMANO[d.tam]) : 1;
}

export const LUGARES_CARGA = ['espalda', 'cintura', 'hombro']; // y las manos
export const RALENTIZACION_MAXIMA = 0.2; // al máximo en todo, el 80% de la velocidad (GDD)
export function factorVelocidad(fraccion) {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraccion) ? fraccion : 0));
  return 1 - RALENTIZACION_MAXIMA * f * f;
}

const cosa = (tipo, n = 1) => ({ tipo, n });
const copiar = c => c && ({ tipo: c.tipo, n: c.n, ...(c.dentro ? { dentro: c.dentro.map(copiar) } : {}) });

// Inventario de un jugador. cat: catálogo (por defecto, el del juego; las pruebas pueden darle otro).
export class Inventario {
  constructor(cat = CATALOGO) {
    this.cat = cat;
    this.lugares = Object.fromEntries(LUGARES.map(l => [l, null]));
    this.apartado = []; // lo que no cupo al cargar un guardado (a tus pies)
  }

  // Empiezas casi con lo puesto: camisa y pantalón de lino (GDD).
  static inicial(cat = CATALOGO) {
    const inv = new Inventario(cat);
    inv.lugares['ropa:interior'] = cosa('camisa_lino');
    inv.lugares['ropa:piernas'] = cosa('pantalon_lino');
    return inv;
  }

  def(c) { return c && this.cat[c.tipo]; }

  // Busca lo que hay en una ruta. Devuelve { cosa, padre, hueco, regla } o { motivo }.
  //  padre: el objeto contenedor (o null si es un lugar del cuerpo); hueco: el número de hueco o el lugar.
  //  regla: { tam, admite } del hueco (para los lugares del cuerpo, { lugar }).
  buscar(ruta) {
    if (typeof ruta !== 'string') return { motivo: 'Lugar no válido.' };
    const [lugar, ...resto] = ruta.split('/');
    if (!(lugar in this.lugares)) return { motivo: 'Lugar no válido.' };
    let padre = null, hueco = lugar, regla = { lugar }, c = this.lugares[lugar];
    for (const parte of resto) {
      const d = this.def(c);
      if (!d || !d.huecos) return { motivo: 'Ahí no hay huecos.' };
      const i = Number(parte);
      if (!Number.isInteger(i) || i < 0 || i >= d.huecos.length) return { motivo: 'Ese hueco no existe.' };
      if (!c.dentro) c.dentro = d.huecos.map(() => null);
      padre = c; hueco = i; regla = { tam: d.huecos[i].tam, admite: d.huecos[i].admite || d.admite };
      c = c.dentro[i];
    }
    return { cosa: c, padre, hueco, regla };
  }

  poner(b, c) { if (b.padre) b.padre.dentro[b.hueco] = c; else this.lugares[b.hueco] = c; }

  // La mano que queda bloqueada porque la otra lleva algo grande.
  manoBloqueada(mano) {
    const otra = this.lugares[mano === 'mano:der' ? 'mano:izq' : 'mano:der'];
    return !!otra && this.def(otra).tam === 'G';
  }

  // ¿Puede ir la cosa c (sin contar lo que ya hay) en el sitio b? Devuelve null o el motivo.
  noCabe(b, c, origen) {
    const d = this.def(c), r = b.regla;
    if (!d) return 'Objeto desconocido.';
    if (d.tam === 'E') return 'Eso es enorme: se arrastra, va en carro o entre varios.';
    if (r.lugar) {
      const l = r.lugar;
      if (l.startsWith('mano:')) {
        if (this.manoBloqueada(l)) return 'Tienes las dos manos ocupadas.';
        if (d.tam === 'G') {
          const otra = l === 'mano:der' ? 'mano:izq' : 'mano:der';
          if (this.lugares[otra] && otra !== origen) return 'Eso es grande: necesitas las dos manos libres.';
        }
        return null;
      }
      if (l.startsWith('ropa:')) return d.capa === l.slice(5) ? null : 'Eso no se pone ahí.';
      if (l === 'cintura' && d.lugar !== 'cintura') return 'Eso no es un cinturón.';
      if (l !== 'cintura' && d.lugar !== l) return 'Eso no se lleva ahí.';
      return null;
    }
    if (orden(d.tam) > orden(r.tam)) return 'No cabe en ese hueco.';
    if (r.admite && !r.admite.includes(c.tipo)) return 'Eso no va en ese hueco.';
    return null;
  }

  // Mete n unidades de c en la ruta: el hueco tiene que estar vacío o tener lo mismo con sitio.
  // origen: ruta de donde sale (para no contar dos veces lo que se mueve).
  meter(ruta, c, origen) {
    const b = this.buscar(ruta);
    if (b.motivo) return { ok: false, motivo: b.motivo };
    if (origen && (ruta === origen || ruta.startsWith(origen + '/'))) return { ok: false, motivo: 'No se puede meter dentro de sí mismo.' };
    const no = this.noCabe(b, c, origen);
    if (no) return { ok: false, motivo: no };
    const hay = b.cosa;
    if (hay) {
      if (hay.tipo !== c.tipo || pila(c.tipo, this.cat) === 1) return { ok: false, motivo: 'Ese sitio está ocupado.' };
      const sitio = pila(c.tipo, this.cat) - hay.n;
      if (c.n > sitio) return { ok: false, motivo: sitio > 0 ? `No cabe tanto: caben ${sitio}.` : 'Ese hueco está lleno.' };
      hay.n += c.n;
      return { ok: true };
    }
    if (c.n > pila(c.tipo, this.cat)) return { ok: false, motivo: `No cabe tanto: caben ${pila(c.tipo, this.cat)}.` };
    this.poner(b, copiar(c));
    return { ok: true };
  }

  // Saca n unidades (o todo) de la ruta. Devuelve { ok, cosa } con lo sacado.
  sacar(ruta, n) {
    const b = this.buscar(ruta);
    if (b.motivo) return { ok: false, motivo: b.motivo };
    if (!b.cosa) return { ok: false, motivo: 'Ahí no hay nada.' };
    const total = b.cosa.n;
    if (n === undefined) n = total;
    if (!Number.isInteger(n) || n < 1 || n > total) return { ok: false, motivo: 'Cantidad no válida.' };
    if (n === total) { this.poner(b, null); return { ok: true, cosa: b.cosa }; }
    b.cosa.n -= n;
    return { ok: true, cosa: cosa(b.cosa.tipo, n) };
  }

  // Coger algo de fuera (del suelo, de un arcón) y llevarlo a la ruta.
  coger(tipo, n, ruta) {
    if (!this.cat[tipo]) return { ok: false, motivo: 'Objeto desconocido.' };
    if (!Number.isInteger(n) || n < 1) return { ok: false, motivo: 'Cantidad no válida.' };
    return this.meter(ruta, cosa(tipo, n));
  }

  // Soltar lo que hay en la ruta (todo o n unidades). Devuelve lo soltado, con lo que lleve dentro.
  soltar(ruta, n) { return this.sacar(ruta, n); }

  // Mover de una ruta a otra (todo o n unidades). Si no cabe, todo queda como estaba.
  mover(de, a, n) {
    const b = this.buscar(de);
    if (b.motivo) return { ok: false, motivo: b.motivo };
    if (!b.cosa) return { ok: false, motivo: 'Ahí no hay nada.' };
    if (de === a) return { ok: false, motivo: 'Ya está ahí.' };
    const cant = n === undefined ? b.cosa.n : n;
    if (!Number.isInteger(cant) || cant < 1 || cant > b.cosa.n) return { ok: false, motivo: 'Cantidad no válida.' };
    const antes = this.exportarJugador();
    const s = this.sacar(de, cant);
    // si se mueve el objeto entero, lo que tenía dentro va con él (las rutas de dentro ya no valen como destino)
    const r = this.meter(a, s.cosa, cant === b.cosa.n ? de : undefined);
    if (!r.ok) { this.restaurar(antes); return r; }
    return { ok: true };
  }

  // Ponerse lo que hay en la ruta en el lugar que le toca (la prenda en su capa, el cinturón en la cintura…).
  ponerse(de) {
    const b = this.buscar(de);
    if (b.motivo) return { ok: false, motivo: b.motivo };
    if (!b.cosa) return { ok: false, motivo: 'Ahí no hay nada.' };
    const d = this.def(b.cosa);
    const lugar = d.capa ? 'ropa:' + d.capa : d.lugar;
    if (!lugar) return { ok: false, motivo: 'Eso no se pone.' };
    if (this.lugares[lugar]) return { ok: false, motivo: 'Ya llevas algo ahí: quítatelo antes.' };
    if (b.cosa.n !== 1) return { ok: false, motivo: 'Cantidad no válida.' };
    return this.mover(de, lugar);
  }

  // Quitarse lo puesto en un lugar y llevarlo a la ruta a (una mano, un hueco…), con lo que tenga dentro.
  quitarse(lugar, a) {
    if (!(lugar === 'espalda' || lugar === 'cintura' || lugar === 'hombro' || (lugar || '').startsWith('ropa:')) || !(lugar in this.lugares))
      return { ok: false, motivo: 'Lugar no válido.' };
    return this.mover(lugar, a);
  }

  // Todas las rutas donde se puede guardar algo, en orden: las manos y luego los huecos de lo que llevas en la
  // cintura, al hombro y a la espalda (y los de los contenedores que haya dentro).
  rutasGuardar() {
    const rutas = [...MANOS];
    const dentro = (c, base) => {
      const d = this.def(c); if (!d || !d.huecos) return;
      d.huecos.forEach((h, i) => { const r = base + '/' + i; rutas.push(r); dentro(c.dentro && c.dentro[i], r); });
    };
    for (const l of ['cintura', 'hombro', 'espalda']) dentro(this.lugares[l], l);
    return rutas;
  }

  // Guarda n unidades de un tipo donde quepan, repartidas si hace falta (lo que se recoge «va al inventario por
  // huecos»): primero en una ruta preferida si se da, luego junto a lo mismo que ya llevas, luego en huecos vacíos.
  // Todo o nada: si no cabe entero, nada cambia. Devuelve { ok, donde: [[ruta, n]…] } o { ok: false, motivo }.
  meterDonde(tipo, n, preferida) {
    if (!this.cat[tipo]) return { ok: false, motivo: 'Objeto desconocido.' };
    if (!Number.isInteger(n) || n < 1) return { ok: false, motivo: 'Cantidad no válida.' };
    const antes = this.exportarJugador(), donde = [];
    const rutas = this.rutasGuardar();
    const conLoMismo = rutas.filter(r => { const b = this.buscar(r); return b.cosa && b.cosa.tipo === tipo; });
    const vacias = rutas.filter(r => !this.buscar(r).cosa);
    const orden = [...(preferida ? [preferida] : []), ...conLoMismo, ...vacias];
    let queda = n;
    for (const r of orden) {
      if (!queda) break;
      const b = this.buscar(r);
      if (b.motivo || this.noCabe(b, cosa(tipo, 1))) continue;
      if (b.cosa && b.cosa.tipo !== tipo) continue;
      const sitio = pila(tipo, this.cat) - (b.cosa ? b.cosa.n : 0);
      const m = Math.min(sitio, queda);
      if (m > 0 && this.meter(r, cosa(tipo, m)).ok) { donde.push([r, m]); queda -= m; }
    }
    if (queda) { this.restaurar(antes); return { ok: false, motivo: 'No te cabe: no tienes sitio libre.' }; }
    return { ok: true, donde };
  }

  // Cuántas unidades de un tipo lleva encima (en todos los huecos, dentro de los contenedores también).
  cuantos(tipo) {
    let t = 0;
    const ver = c => { if (!c) return; if (c.tipo === tipo) t += c.n; if (c.dentro) c.dentro.forEach(ver); };
    Object.values(this.lugares).forEach(ver);
    return t;
  }

  // Los huecos de cintura que hay ahora (sin cinturón, ninguno).
  huecosCintura() {
    const d = this.def(this.lugares.cintura);
    return d && d.huecos ? d.huecos.map((h, i) => ({ ruta: 'cintura/' + i, tam: h.tam })) : [];
  }

  // Lo lleno que vas, de 0 a 1, y cuánto en cada lugar de carga (ver arriba).
  lleno() {
    const hueco = (c, h) => !c ? 0 : (this.def(c).huecos ? 1 : Math.min(1, c.n / pila(c.tipo, this.cat)));
    const enManos = MANOS.reduce((s, m) => { const c = this.lugares[m]; return s + (!c ? 0 : this.def(c).tam === 'G' ? 2 : hueco(c)); }, 0);
    const lugares = { manos: Math.min(1, enManos / 2) };
    for (const l of LUGARES_CARGA) {
      const c = this.lugares[l], d = this.def(c);
      lugares[l] = d && d.huecos && d.huecos.length ? d.huecos.reduce((s, h, i) => s + hueco(c.dentro && c.dentro[i]), 0) / d.huecos.length : 0;
    }
    const v = Object.values(lugares);
    return { fraccion: v.reduce((a, b) => a + b, 0) / v.length, lugares };
  }

  // Lo que se multiplica la velocidad al moverse por lo que llevas (1 sin carga, 0,8 al máximo en todo).
  velocidad() { return factorVelocidad(this.lleno().fraccion); }

  exportarJugador() {
    return { lugares: Object.fromEntries(Object.entries(this.lugares).map(([k, v]) => [k, copiar(v)])), apartado: this.apartado.map(copiar) };
  }
  restaurar(datos) {
    this.lugares = Object.fromEntries(LUGARES.map(l => [l, copiar(datos.lugares[l]) || null]));
    this.apartado = datos.apartado.map(copiar);
  }

  // Rehace un inventario desde datos guardados, comprobando cada cosa con el catálogo de ahora: lo desconocido se
  // descarta y lo que ya no cabe (un contenedor con menos huecos, una pila más corta) se aparta, sin perderlo.
  static importarJugador(datos, cat = CATALOGO) {
    const inv = new Inventario(cat);
    const apartar = c => { if (c && cat[c.tipo]) inv.apartado.push(c); };
    const limpiar = (c) => { // cosa válida con su contenido ajustado al contenedor de ahora
      if (!c || typeof c !== 'object' || !cat[c.tipo]) return null;
      const n = Number.isInteger(c.n) && c.n > 0 ? c.n : 1;
      const r = cosa(c.tipo, n), d = cat[c.tipo];
      if (n > pila(c.tipo, cat)) { r.n = pila(c.tipo, cat); apartar(cosa(c.tipo, n - r.n)); }
      if (Array.isArray(c.dentro)) {
        if (d.huecos) r.dentro = d.huecos.map(() => null);
        c.dentro.forEach((x, i) => {
          const y = limpiar(x); if (!y) return;
          const h = d.huecos && d.huecos[i];
          if (h && orden(cat[y.tipo].tam) <= orden(h.tam) && !((h.admite || d.admite) && !(h.admite || d.admite).includes(y.tipo))) r.dentro[i] = y;
          else apartar(y);
        });
      }
      return r;
    };
    if (datos && datos.lugares) for (const l of LUGARES) {
      const c = limpiar(datos.lugares[l]); if (!c) continue;
      const no = inv.noCabe(inv.buscar(l), c);
      if (no) apartar(c); else inv.lugares[l] = c;
    }
    if (datos && Array.isArray(datos.apartado)) datos.apartado.forEach(c => apartar(limpiar(c)));
    return inv;
  }
}

// ---------------- Inventarios de todos los jugadores ----------------
export const VERSION_INVENTARIO = 1;

export class Inventarios {
  constructor(cat = CATALOGO) { this.cat = cat; this.jugadores = {}; }
  // El de un jugador; si aún no tiene, empieza con lo puesto.
  de(autor) { return this.jugadores[autor] || (this.jugadores[autor] = Inventario.inicial(this.cat)); }
  exportar() {
    return { version: VERSION_INVENTARIO, jugadores: Object.fromEntries(Object.entries(this.jugadores).map(([k, v]) => [k, v.exportarJugador()])) };
  }
  static importar(datos, cat = CATALOGO) {
    const t = new Inventarios(cat);
    const d = migrar(datos);
    if (!d) return t;
    for (const [autor, j] of Object.entries(d.jugadores)) t.jugadores[autor] = Inventario.importarJugador(j, cat);
    return t;
  }
}

// Pasa un guardado antiguo al formato de ahora. Cada versión nueva añade aquí su paso: MIGRACIONES[v] pasa de v a v+1.
// Lo que no se entiende (sin versión, de una versión futura, roto) se descarta y se empieza con lo puesto.
export const MIGRACIONES = {};
export function migrar(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_INVENTARIO) {
    const paso = MIGRACIONES[d.version];
    if (!paso) return null;
    d = paso(d);
  }
  if (!d || d.version !== VERSION_INVENTARIO || !d.jugadores || typeof d.jugadores !== 'object') return null;
  return d;
}

// Guardado en el navegador: almacen es localStorage (o algo con getItem y setItem, para las pruebas).
export const CLAVE_INVENTARIO = 'kinhold.inventario';
export function guardarInventarios(almacen, invs, clave = CLAVE_INVENTARIO) {
  try { almacen.setItem(clave, JSON.stringify(invs.exportar())); return true; } catch (e) { return false; }
}
export function cargarInventarios(almacen, cat = CATALOGO, clave = CLAVE_INVENTARIO) {
  try { const t = almacen.getItem(clave); if (t) return Inventarios.importar(JSON.parse(t), cat); } catch (e) { /* roto o sin almacenamiento */ }
  return new Inventarios(cat);
}

// ---------------- Acciones con autor ----------------
// { autor, tipo: 'coger', objeto, cantidad, a }     — de fuera (suelo, arcón) a la ruta a
// { autor, tipo: 'soltar', de, cantidad? }          — devuelve lo soltado en resultado.cosa
// { autor, tipo: 'mover', de, a, cantidad? }
// { autor, tipo: 'ponerse', de }                   — a su lugar (capa, cintura, espalda, hombro)
// { autor, tipo: 'quitarse', lugar, a }
// Cada una se aplica al inventario de su autor, nunca al de otro.
const CAMPOS = {
  coger: { objeto: 't', cantidad: 'n', a: 't' },
  soltar: { de: 't' },
  mover: { de: 't', a: 't' },
  ponerse: { de: 't' },
  quitarse: { lugar: 't', a: 't' },
};
function formaInventario(a) {
  if (!a || typeof a !== 'object') return 'Acción no válida.';
  if (typeof a.autor !== 'string' || !a.autor) return 'Acción sin autor.';
  const c = CAMPOS[a.tipo];
  if (!c) return 'Acción desconocida.';
  for (const [k, t] of Object.entries(c)) {
    if (t === 'n' && !(typeof a[k] === 'number' && Number.isFinite(a[k]))) return 'Datos no válidos.';
    if (t === 't' && !(typeof a[k] === 'string' && a[k])) return 'Datos no válidos.';
  }
  if (a.cantidad !== undefined && !(typeof a.cantidad === 'number' && Number.isFinite(a.cantidad))) return 'Datos no válidos.';
  return null;
}

// registro: un RegistroAcciones (acciones.js). Devuelve { ok, motivo?, cosa? }.
export function ejecutarInventario(invs, registro, accion) {
  const fallo = formaInventario(accion);
  let r;
  if (fallo) r = { ok: false, motivo: fallo };
  else {
    const inv = invs.de(accion.autor), a = accion;
    switch (a.tipo) {
      case 'coger': r = inv.coger(a.objeto, a.cantidad, a.a); break;
      case 'soltar': r = inv.soltar(a.de, a.cantidad); break;
      case 'mover': r = inv.mover(a.de, a.a, a.cantidad); break;
      case 'ponerse': r = inv.ponerse(a.de); break;
      case 'quitarse': r = inv.quitarse(a.lugar, a.a); break;
    }
  }
  const e = registro.anotar(accion, r);
  if (r.ok && r.cosa) e.resultado = copiar(r.cosa);
  return r;
}
