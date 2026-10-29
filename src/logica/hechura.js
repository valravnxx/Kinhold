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

import { paletaDe } from './tintes.js';

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
