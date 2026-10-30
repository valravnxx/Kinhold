// Hechura de cada prenda fabricada (GDD, apartado 12: «lo que se ve se elige al tejer y coser: corte, tejido, tinte»;
// «nada de calidades: lo que hace una prenda sale solo de su capa y su material»). Lógica pura, sin three.js, para que
// el servidor pueda validarla y registrarla luego tal cual.
//
// Una prenda fabricada lleva su hechura: { material, corte, tejido, tinte }. El material decide lo que abriga y protege
// (src/logica/prendas.js) y su aspecto (color sin teñir y grano de la tela); el corte, el largo; el tejido, el dibujo
// de la tela; el tinte, el color (src/logica/tintes.js). El cargador del taller (src/personajes/makehuman.js:
// ponerHechuras) lo dibuja todo sobre el mismo modelo y el mismo esqueleto, sin volver a cargarlo.
//
// Decisiones provisionales (el GDD no da cifras; anotadas en el registro del personaje y en el diario):
//  - Materiales de tela por prenda: lino o lana (el gambesón, por fuera, lino o lana; el relleno no se ve). El manto y la
//    capucha, solo lana; la toca, solo lino. La cota de malla, el sombrero de paja y el calzado no tienen hechura de tela.
//  - Color sin teñir: el lino crudo, claro y amarillento; la lana sin teñir, parda grisácea. El de cada prenda del taller
//    (tintes.js: PRENDAS_TENIBLES) es el de su material de siempre: con la hechura por defecto se ve igual que antes.
//  - Cortes: el largo de la falda de la prenda, como fracción de lo que mide en el taller (1 = como está). Solo se puede
//    acortar (el modelo no tiene tela de más). La túnica, la camisa y el gambesón, largos o cortos; la sobreveste, larga,
//    a media pierna o corta.
//  - Tejidos: liso, sarga, espiguilla, cuadros y rayas (los del GDD), en el tono de la propia tela (más claro y más
//    oscuro), sin segundo color: con dos tintes por prenda habría que doblar la receta.
//  - Recetas: las de sistemas.html (camisa y pantalón: 2 telas + hilo; gambesón: 4 telas + relleno + hilo; capa: 2 telas
//    de lana; capucha: 1), en el banco. La tela del tejido elegido sale del telar; el tinte, de una tina con la planta.

import { paletaDe, PRENDAS_TENIBLES, normalizarTintes } from './tintes.js';
import { PRENDAS, DIBUJO_EN_OTRO_CUERPO, capasDibujo } from './prendas.js';

export const MATERIALES_TELA = {
  lino: { nombre: 'Lino', natural: [206, 196, 172], grano: 0.035 },
  lana: { nombre: 'Lana', natural: [128, 112, 90], grano: 0.07 },
};

export const CORTES = {
  largo: { nombre: 'Largo', largo: 1 },
  medio: { nombre: 'A media pierna', largo: 0.72 },
  corto: { nombre: 'Corto', largo: 0.45 },
};

export const TEJIDOS = {
  liso: 'Liso',
  sarga: 'Sarga',
  espiguilla: 'Espiguilla',
  cuadros: 'Cuadros',
  rayas: 'Rayas',
};
// el número de cada tejido en el sombreado (src/personajes/makehuman.js)
export const NUM_TEJIDO = Object.fromEntries(Object.keys(TEJIDOS).map((k, i) => [k, i]));

// Las prendas del taller con hechura de tela (por su pieza del taller): materiales posibles (el primero, el de siempre),
// cortes posibles (el primero, el de siempre) y receta.
export const HECHURAS = {
  camisa:     { nombre: 'Camisa',     materiales: ['lino', 'lana'], cortes: ['largo', 'corto'],          telas: 2, extra: {} },
  calzas:     { nombre: 'Calzas',     materiales: ['lino', 'lana'], cortes: ['largo'],                   telas: 2, extra: {} },
  tunica:     { nombre: 'Túnica',     materiales: ['lana', 'lino'], cortes: ['largo', 'corto'],          telas: 2, extra: {} },
  vestido:    { nombre: 'Vestido',    materiales: ['lana', 'lino'], cortes: ['largo'],                   telas: 3, extra: {} },
  gambeson:   { nombre: 'Gambesón',   materiales: ['lino', 'lana'], cortes: ['largo', 'corto'],          telas: 4, extra: { relleno: 1 } },
  sobreveste: { nombre: 'Sobreveste', materiales: ['lino', 'lana'], cortes: ['largo', 'medio', 'corto'], telas: 2, extra: {} },
  manto:      { nombre: 'Manto',      materiales: ['lana'],         cortes: ['largo'],                   telas: 2, extra: {} },
  capucha:    { nombre: 'Capucha',    materiales: ['lana'],         cortes: ['largo'],                   telas: 1, extra: {} },
  toca:       { nombre: 'Toca',       materiales: ['lino'],         cortes: ['largo'],                   telas: 1, extra: {} },
  // la cota de malla no se cose (es de anillas, de la forja): solo tiene corte, larga hasta la rodilla o corta
  cota:       { nombre: 'Cota de malla', materiales: ['malla'],     cortes: ['largo', 'corto'],          telas: 0, extra: {}, forja: true },
};

// devuelve una hechura válida para esa prenda: { material, corte, tejido }. Lo que falte o no valga, el de siempre.
// (El tinte va aparte, en tintes.js, con su propia paleta: una prenda fabricada lo lleva como un tinte más.)
export function normalizarHechura(prenda, h) {
  const d = HECHURAS[prenda];
  if (!d) return null;
  const o = h !== null && typeof h === 'object' ? h : {};
  return {
    material: d.materiales.includes(o.material) ? o.material : d.materiales[0],
    corte: d.cortes.includes(o.corte) ? o.corte : d.cortes[0],
    tejido: Object.hasOwn(TEJIDOS, o.tejido) ? o.tejido : 'liso',
  };
}
// hechuras de todas las prendas: { prenda: hechura }
export function normalizarHechuras(hs) {
  const o = hs !== null && typeof hs === 'object' ? hs : {};
  return Object.fromEntries(Object.keys(HECHURAS).map(p => [p, normalizarHechura(p, o[p])]));
}
// ¿es la de siempre? (la del taller: se ve igual que antes)
export const deSiempre = (prenda, h) => { const n = normalizarHechura(prenda, h), d = HECHURAS[prenda]; return !!n && n.material === d.materiales[0] && n.corte === d.cortes[0] && n.tejido === 'liso'; };

// color sin teñir de la prenda con ese material (sRGB 0-255): el de siempre si es su material de siempre
export function naturalDe(prenda, material, naturalDeSiempre) {
  const d = HECHURAS[prenda];
  if (!d || !MATERIALES_TELA[material] || material === d.materiales[0]) return naturalDeSiempre;
  return MATERIALES_TELA[material].natural;
}
// fracción del largo de la falda que queda con ese corte
export const largoDe = (corte) => (CORTES[corte] || CORTES.largo).largo;
// grano de la tela (lo que varía el tono de un hilo a otro)
export const granoDe = (material) => (MATERIALES_TELA[material] || MATERIALES_TELA.lino).grano;

// Lo que hace falta para coserla en el banco (sistemas.html): telas del material y del tejido elegidos, hilo y, el
// gambesón, relleno. El tinte se da a la tela antes de coser.
export function recetaHechura(prenda, h) {
  const n = normalizarHechura(prenda, h);
  if (!n) return null;
  const d = HECHURAS[prenda];
  if (d.forja) return null; // la cota no sale del banco de coser
  const tela = `tela_${n.material}${n.tejido === 'liso' ? '' : '_' + n.tejido}`;
  return { estacion: 'banco', piden: { [tela]: d.telas, hilo: 1, ...d.extra } };
}

// Coser una prenda: con lo que piden en `tengo` ({ cosa: cantidad }), devuelve la prenda hecha ({ prenda, hechura,
// tinte, autor }) y lo que se gasta; si falta algo, { falta: { cosa: cuánto } }. Lleva el autor, como toda acción que
// cambia el mundo (el servidor la validará igual).
export function coserPrenda({ autor, prenda, hechura, tinte = 'natural' }, tengo = {}) {
  const r = recetaHechura(prenda, hechura);
  if (!r) return { error: 'esa prenda no se cose' };
  if (!autor) return { error: 'falta el autor' };
  const falta = {};
  for (const [k, n] of Object.entries(r.piden)) if ((tengo[k] || 0) < n) falta[k] = n - (tengo[k] || 0);
  if (Object.keys(falta).length) return { falta };
  return { hecha: { prenda, hechura: normalizarHechura(prenda, hechura), tinte: Object.hasOwn(paletaDe(prenda), tinte) ? tinte : 'natural', autor }, gasta: r.piden };
}

// ---- La prenda que se lleva: su hechura y su tinte van con ella en el inventario ----
// Cada prenda del inventario (src/logica/inventario.js) puede llevar { hechura, tinte }: los de cuando se
// cosió. Sin ellos, la de siempre (como antes: los guardados viejos se ven igual). El material de la hechura es el de
// la prenda del catálogo (la camisa de lana es de lana) si esa prenda lo admite; el gambesón (acolchado) lleva por
// fuera lino o lana, el que diga su hechura. Devuelve solo lo que vale y no es lo de siempre: {} si no hay nada.
export function rasgosPrenda(tipo, o) {
  const p = PRENDAS[tipo];
  if (!p || o === null || typeof o !== 'object') return {};
  const r = {}, d = HECHURAS[p.dibujo];
  if (d && o.hechura !== null && typeof o.hechura === 'object') {
    const propio = d.materiales.includes(p.material) ? p.material : null;
    const h = normalizarHechura(p.dibujo, { ...o.hechura, ...(propio ? { material: propio } : {}) });
    const base = normalizarHechura(p.dibujo, propio ? { material: propio } : {});
    if (h.material !== base.material || h.corte !== base.corte || h.tejido !== base.tejido) r.hechura = h;
  }
  if (PRENDAS_TENIBLES[p.dibujo] && typeof o.tinte === 'string' && Object.hasOwn(paletaDe(p.dibujo), o.tinte)) r.tinte = o.tinte;
  return r;
}
// ¿Son la misma prenda (mismo tipo, hechura y tinte)? Las que no, no se juntan.
export const mismosRasgos = (a, b) => JSON.stringify(rasgosPrenda(a.tipo, a)) === JSON.stringify(rasgosPrenda(b.tipo, b));

// Lo que se ve puesto: con lo que lleva en sus lugares ropa:<capa>, las capas del taller, los tintes ({ prendas,
// blason }) y las hechuras ({ pieza: hechura }) para el cargador (ponerCapas, ponerTintes, ponerHechuras). Las piezas
// que no lleva puestas quedan con lo de siempre (el taller las lleva siempre: la camisa y las calzas bajo todo).
// blason: el de la sobreveste (aún no va con la prenda: se elige en el visor).
export function vestidoDe(lugares, sexo = 'hombre', blason = undefined) {
  const cambia = DIBUJO_EN_OTRO_CUERPO[sexo] || {};
  const puestas = Object.entries(lugares || {}).filter(([l, c]) => l.startsWith('ropa:') && c && PRENDAS[c.tipo]).map(([, c]) => c);
  const tintes = {}, hechuras = {};
  for (const c of puestas) {
    const p = PRENDAS[c.tipo];
    let d = p.dibujo;
    if (d in cambia) d = cambia[d];
    if (!d) continue;
    const r = rasgosPrenda(c.tipo, c);
    if (r.tinte) tintes[d] = r.tinte;
    // sin hechura propia, la de su material (la camisa de lana se ve de lana)
    const h = r.hechura || (HECHURAS[d] && HECHURAS[d].materiales.includes(p.material) ? { material: p.material } : null);
    if (h && HECHURAS[d]) hechuras[d] = normalizarHechura(d, h);
  }
  return {
    capas: capasDibujo(puestas.map(c => c.tipo), sexo),
    tintes: normalizarTintes({ prendas: tintes, blason }, sexo),
    hechuras: normalizarHechuras(hechuras),
  };
}

// Nombre de una prenda con su hechura y su tinte, para el inventario: «Túnica de lana · corta, sarga · Rojo de rubia».
export function nombrePrenda(tipo, o, tr = (x) => x) {
  const p = PRENDAS[tipo];
  if (!p) return '';
  const r = rasgosPrenda(tipo, o), partes = [];
  if (r.hechura) {
    const d = HECHURAS[p.dibujo], b = [];
    if (r.hechura.material !== d.materiales[0] && !d.materiales.includes(p.material)) b.push(tr(MATERIALES_TELA[r.hechura.material].nombre));
    if (r.hechura.corte !== d.cortes[0]) b.push(tr(CORTES[r.hechura.corte].nombre));
    if (r.hechura.tejido !== 'liso') b.push(tr(TEJIDOS[r.hechura.tejido]));
    if (b.length) partes.push(b.join(', '));
  }
  if (r.tinte) partes.push(tr(paletaDe(p.dibujo)[r.tinte][0]));
  return [tr(p.nombre), ...partes].join(' · ');
}
