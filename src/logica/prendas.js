// Datos de cada prenda (GDD, apartado 7: «cada prenda tiene sus datos en la lógica pura: qué zonas cubre,
// protección por tipo de golpe, abrigo y peso; lo que se ve y lo que protege salen de lo mismo»).
// Lógica pura (sin three.js ni navegador): el servidor podrá usarla tal cual.
//
// Cada prenda dice qué pieza del taller de personajes la dibuja (`dibujo`: el nombre de la capa en los .glb,
// <sexo>_capa_<dibujo>) y de qué partes es (cuerpo, mangas, falda…). Las zonas que cubre salen de esas partes, que
// son las mismas mallas que se ven puestas: si una prenda no tiene mangas en el modelo, no protege los brazos.
// Lo que protege y abriga sale solo de su material (GDD: «nada de calidades; lo que hace una prenda sale solo de su
// capa y su material»).
//
// Decisiones provisionales (el GDD no da cifras; anotadas en el diario y en el registro del prototipo de personaje):
//  - Protección: la parte del golpe que pasa (1 = no frena nada). Las prendas que cubren la misma zona se multiplican.
//    El lino y la lana no frenan; el gambesón y la cota de malla salen de lo que ya usaba el combate (lino,
//    gambesón y malla): camisa + gambesón da el «gambesón» del combate y camisa + gambesón + cota, la «malla».
//  - Abrigo: el del material por cada zona que cubre la prenda (paja 0,5, lino 1, lana 2, cuero 1,5, acolchado 3,
//    malla 0).
//  - Peso en kg, aproximado al de las prendas de la época: la cota de malla 10, el gambesón 3,5, la ropa de lino o
//    lana de 0,2 a 2.
//  - La túnica y el vestido son la misma capa (abrigo); el taller tiene túnica solo en el hombre y vestido solo en
//    la mujer, así que en el otro cuerpo se dibuja la otra (DIBUJO_EN_OTRO_CUERPO). El pantalón de la mujer queda
//    bajo el vestido y no se dibuja; la toca solo está en la mujer.
//  - El peso de la ropa y la armadura aún no ralentiza ni cansa (el GDD lo pide para la armadura pesada; va con el
//    combate con armadura).

// Zonas del cuerpo: las del combate (src/combate/logica.js) y los pies.
export const ZONAS_CUERPO = ['cabeza', 'torso', 'brazoI', 'brazoD', 'piernaI', 'piernaD', 'pies'];
export const GOLPES = ['corte', 'perforante', 'contundente'];

// Qué zonas cubre cada parte de una pieza del taller (cuerpo, mangas y falda son mallas aparte en los .glb).
export const ZONAS_PARTE = {
  cuerpo: ['torso'], mangas: ['brazoI', 'brazoD'], falda: ['piernaI', 'piernaD'],
  piernas: ['piernaI', 'piernaD'], cabeza: ['cabeza'], pies: ['pies'],
};

const NADA = { corte: 1, perforante: 1, contundente: 1 };
export const MATERIALES_ROPA = {
  lino: { nombre: 'Lino', abrigo: 1, proteccion: NADA },
  lana: { nombre: 'Lana', abrigo: 2, proteccion: NADA },
  cuero: { nombre: 'Cuero', abrigo: 1.5, proteccion: NADA },
  paja: { nombre: 'Paja', abrigo: 0.5, proteccion: NADA },
  acolchado: { nombre: 'Acolchado', abrigo: 3, proteccion: { corte: 0.55, perforante: 0.8, contundente: 0.8 } },
  malla: { nombre: 'Malla de hierro', abrigo: 0, proteccion: { corte: 0.36, perforante: 0.69, contundente: 0.875 } },
};

// capa: el lugar del inventario (ropa:<capa>, src/logica/inventario.js). dibujo: la capa del taller.
// partes: las piezas de esa capa en el taller (cuerpo, mangas y falda: <sexo>_capa_<dibujo>, _mangas, _falda; las
// calzas, los tocados y el calzado son una pieza sola, que cubre las piernas, la cabeza o los pies).
export const PRENDAS = {
  camisa_lino:     { nombre: 'Camisa de lino',      capa: 'interior', material: 'lino',      dibujo: 'camisa',     partes: ['cuerpo', 'mangas', 'falda'], peso: 0.3 },
  camisa_lana:     { nombre: 'Camisa de lana',      capa: 'interior', material: 'lana',      dibujo: 'camisa',     partes: ['cuerpo', 'mangas', 'falda'], peso: 0.5 },
  pantalon_lino:   { nombre: 'Pantalón de lino',    capa: 'piernas',  material: 'lino',      dibujo: 'calzas',     partes: ['piernas'], peso: 0.3 },
  calzas_lana:     { nombre: 'Calzas de lana',      capa: 'piernas',  material: 'lana',      dibujo: 'calzas',     partes: ['piernas'], peso: 0.4 },
  tunica_lana:     { nombre: 'Túnica de lana',      capa: 'abrigo',   material: 'lana',      dibujo: 'tunica',     partes: ['cuerpo', 'mangas', 'falda'], peso: 0.8 },
  vestido_lana:    { nombre: 'Vestido de lana',     capa: 'abrigo',   material: 'lana',      dibujo: 'vestido',    partes: ['cuerpo', 'mangas', 'falda'], peso: 1.0 },
  gambeson:        { nombre: 'Gambesón',            capa: 'abrigo',   material: 'acolchado', dibujo: 'gambeson',   partes: ['cuerpo', 'mangas', 'falda'], peso: 3.5 },
  cota_malla:      { nombre: 'Cota de malla',       capa: 'exterior', material: 'malla',     dibujo: 'cota',       partes: ['cuerpo', 'mangas', 'falda'], peso: 10 },
  sobreveste_lino: { nombre: 'Sobreveste de lino',  capa: 'sobre',    material: 'lino',      dibujo: 'sobreveste', partes: ['cuerpo', 'falda'], peso: 0.6 },
  manto_lana:      { nombre: 'Capa de lana',        capa: 'sobre',    material: 'lana',      dibujo: 'manto',      partes: ['cuerpo', 'falda'], peso: 2 },
  capucha_lana:    { nombre: 'Capucha de lana',     capa: 'cabeza',   material: 'lana',      dibujo: 'capucha',    partes: ['cabeza'], peso: 0.3 },
  sombrero_paja:   { nombre: 'Sombrero de paja',    capa: 'cabeza',   material: 'paja',      dibujo: 'sombrero',   partes: ['cabeza'], peso: 0.2 },
  toca_lino:       { nombre: 'Toca de lino',        capa: 'cabeza',   material: 'lino',      dibujo: 'toca',       partes: ['cabeza'], peso: 0.1 },
  zapatos_cuero:   { nombre: 'Zapatos de cuero',    capa: 'pies',     material: 'cuero',     dibujo: 'zapatos',    partes: ['pies'], peso: 0.6 },
  botas_cuero:     { nombre: 'Botas de cuero',      capa: 'pies',     material: 'cuero',     dibujo: 'botas',      partes: ['pies'], peso: 1.2 },
};

// Cómo se ponen las capas en el taller (lo usa src/personajes/makehuman.js para dibujarlas).
//  orden: de dentro afuera; lo tapado del todo no se dibuja. abiertas: dejan ver lo de debajo.
//  siempre: el taller las lleva puestas (las calzas y los zapatos, bajo todo). tocados: uno cada vez.
//  calzado: va en lugar de los zapatos.
export const TALLER = {
  orden: ['camisa', 'tunica', 'vestido', 'gambeson', 'cota', 'sobreveste', 'manto'],
  siempre: ['calzas', 'zapatos'],
  abiertas: ['sobreveste', 'manto'],
  tocados: ['capucha', 'sombrero', 'toca'],
  calzado: ['botas'],
};
// En el cuerpo que no tiene esa pieza, se dibuja esta otra (null: no se dibuja).
export const DIBUJO_EN_OTRO_CUERPO = { hombre: { vestido: 'tunica', toca: null }, mujer: { tunica: 'vestido', calzas: null } };
// La prenda que corresponde a cada pieza del taller cuando solo se sabe la pieza (el visor de personajes).
export const PRENDA_DE_DIBUJO = {
  camisa: 'camisa_lino', calzas: 'pantalon_lino', zapatos: 'zapatos_cuero', tunica: 'tunica_lana', vestido: 'vestido_lana',
  gambeson: 'gambeson', cota: 'cota_malla', sobreveste: 'sobreveste_lino', manto: 'manto_lana',
  capucha: 'capucha_lana', sombrero: 'sombrero_paja', toca: 'toca_lino', botas: 'botas_cuero',
};

// Las zonas que cubre una prenda (salen de sus partes).
export function zonasDe(tipo) {
  const p = PRENDAS[tipo];
  if (!p) return [];
  return ZONAS_CUERPO.filter(z => p.partes.some(pa => ZONAS_PARTE[pa].includes(z)));
}

const validas = puestas => (puestas || []).filter(t => PRENDAS[t]);

// La parte de un golpe de ese tipo que pasa a esa zona con lo puesto (1 = nada lo frena).
export function proteccion(puestas, zona, golpe) {
  let f = 1;
  for (const t of validas(puestas)) if (zonasDe(t).includes(zona)) f *= MATERIALES_ROPA[PRENDAS[t].material].proteccion[golpe];
  return f;
}

// Abrigo total: el del material por cada zona cubierta, sumado.
export function abrigo(puestas) {
  let a = 0;
  for (const t of validas(puestas)) a += MATERIALES_ROPA[PRENDAS[t].material].abrigo * zonasDe(t).length;
  return Math.round(a * 10) / 10;
}

// Peso total en kg.
export function peso(puestas) {
  return Math.round(validas(puestas).reduce((s, t) => s + PRENDAS[t].peso, 0) * 100) / 100;
}

// Lo que lleva puesto un jugador del inventario (sus lugares ropa:<capa>).
export function puestasDe(lugares) {
  return Object.entries(lugares || {}).filter(([l, c]) => l.startsWith('ropa:') && c && PRENDAS[c.tipo]).map(([, c]) => c.tipo);
}

// Lo puesto → la lista de capas que se le pasa al taller (ponerCapas). La camisa, las calzas y los zapatos del
// taller están siempre; las demás piezas salen de lo puesto, en el cuerpo que toca.
export function capasDibujo(puestas, sexo = 'hombre') {
  const cambia = DIBUJO_EN_OTRO_CUERPO[sexo] || {};
  const capas = [];
  for (const t of validas(puestas)) {
    let d = PRENDAS[t].dibujo;
    if (d in cambia) d = cambia[d];
    if (d && !capas.includes(d) && d !== 'camisa' && !TALLER.siempre.includes(d)) capas.push(d);
  }
  return capas;
}

// Al revés: la lista de capas del taller (la del visor) → las prendas que lleva puestas, con las de siempre
// (camisa, pantalón si el cuerpo tiene calzas y zapatos si no lleva botas).
export function prendasDeCapas(capas, sexo = 'hombre') {
  const l = capas || [];
  const piezas = ['camisa', ...(sexo === 'mujer' ? [] : ['calzas']), ...(l.includes('botas') ? [] : ['zapatos']), ...l];
  return [...new Set(piezas.map(d => PRENDA_DE_DIBUJO[d]).filter(Boolean))];
}
