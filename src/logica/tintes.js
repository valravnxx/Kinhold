// Tintes de la ropa y blasón de la sobreveste (personalización): lógica pura, sin three.js, para que el servidor pueda
// validarlo luego. Como el aspecto, es un objeto pequeño que se guarda y se manda tal cual: el tinte de cada prenda va
// por su nombre (paletas de aquí abajo) y el blasón, por su dibujo y el color de la figura.
// Desde la taller-v13, la tela y el cuero de las prendas se pintan en gris y su color va aparte, en el material
// (herramientas/taller/vestir_mpfb.py: REF_ROPA); el cargador (src/personajes/makehuman.js) los pone con ponerTintes.

// Tintes de la tela: los de siempre en la Edad Media (rubia, glasto, gualda, nogal…), apagados como la prueba de estilo
// v5. «natural» es la tela sin teñir de cada prenda (su color propio, el de PRENDAS_TENIBLES).
export const TINTES = {
  natural: ['Sin teñir', null],
  rubia: ['Rojo de rubia', [118, 46, 38]],
  glasto: ['Azul de glasto', [58, 74, 100]],
  glasto_claro: ['Azul claro de glasto', [70, 84, 98]], // el del vestido de la mujer del taller
  gualda: ['Amarillo de gualda', [170, 140, 66]],
  verde: ['Verde', [66, 84, 54]],
  pardo: ['Pardo de nogal', [96, 72, 52]],
  morado: ['Morado', [88, 48, 62]],
  negro: ['Negro', [40, 37, 35]],
  blanco: ['Blanqueado', [222, 216, 200]],
};
// el cuero se tiñe o se curte en pocos colores
export const CUEROS = {
  natural: ['Sin teñir', null],
  oscuro: ['Oscuro', [40, 28, 20]],
  negro: ['Negro', [28, 25, 23]],
  rojizo: ['Rojizo', [92, 50, 32]],
  claro: ['Claro', [112, 84, 56]],
};

// Las prendas del taller que se tiñen, con su color sin teñir (sRGB, el del taller) y su paleta. La cota de malla
// (hierro), el sombrero de paja y los cinturones no se tiñen.
export const PRENDAS_TENIBLES = {
  camisa: { nombre: 'Camisa', natural: [206, 196, 172], paleta: 'tela' },
  calzas: { nombre: 'Calzas', natural: [70, 62, 54], paleta: 'tela' },
  tunica: { nombre: 'Túnica', natural: [128, 112, 90], paleta: 'tela' },
  vestido: { nombre: 'Vestido', natural: [128, 112, 90], paleta: 'tela' },
  gambeson: { nombre: 'Gambesón', natural: [172, 156, 122], paleta: 'tela' },
  sobreveste: { nombre: 'Sobreveste', natural: [150, 138, 116], paleta: 'tela' },
  manto: { nombre: 'Manto', natural: [78, 70, 58], paleta: 'tela' },
  capucha: { nombre: 'Capucha', natural: [92, 76, 58], paleta: 'tela' },
  toca: { nombre: 'Toca', natural: [226, 220, 204], paleta: 'tela' },
  zapatos: { nombre: 'Zapatos', natural: [52, 34, 22], paleta: 'cuero' },
  botas: { nombre: 'Botas', natural: [60, 42, 28], paleta: 'cuero' },
};
const PALETA = { tela: TINTES, cuero: CUEROS };
export const paletaDe = (prenda) => PALETA[PRENDAS_TENIBLES[prenda]?.paleta] || TINTES;

// Blasón de la sobreveste: particiones y piezas sencillas de la heráldica de la época, sobre toda la prenda (el campo es
// el tinte de la sobreveste; la figura, otro color). Lo dibuja el cargador con un sombreado por la posición en el cuerpo.
export const BLASONES = {
  liso: 'Lisa',
  partido: 'Partido',
  cortado: 'Cortado',
  cuartelado: 'Cuartelado',
  palo: 'Palo (franja vertical)',
  faja: 'Faja',
  banda: 'Banda',
  cruz: 'Cruz',
  sotuer: 'Sotuer',
  cheuron: 'Cheurón',
};
// el número de cada dibujo en el sombreado (src/personajes/makehuman.js)
export const NUM_BLASON = Object.fromEntries(Object.keys(BLASONES).map((k, i) => [k, i]));

// Por defecto, la ropa de los personajes del taller hasta la taller-v12 (se ven igual que antes): túnica parda en el
// hombre, vestido azul en la mujer y sobreveste roja; lo demás sin teñir. Sobreveste lisa, con figura blanqueada.
export const TINTES_INICIALES = {
  hombre: { tunica: 'pardo', sobreveste: 'rubia' },
  mujer: { vestido: 'glasto_claro', sobreveste: 'rubia' },
};
export const BLASON_INICIAL = { dibujo: 'liso', color: 'blanco' };

// devuelve tintes válidos: { prenda: tinte } de todas las prendas que se tiñen, y el blasón { dibujo, color }.
// Lo que falte o no exista se pone por defecto.
export function normalizarTintes(t, sexo = 'hombre') {
  if (sexo !== 'mujer') sexo = 'hombre';
  const ok = (v) => v !== null && typeof v === 'object' ? v : {};
  const o = ok(t), ini = TINTES_INICIALES[sexo], r = { prendas: {} };
  const dadas = ok(o.prendas);
  for (const p of Object.keys(PRENDAS_TENIBLES)) {
    const pal = paletaDe(p);
    r.prendas[p] = Object.hasOwn(pal, dadas[p]) ? dadas[p] : (ini[p] || 'natural');
  }
  const b = ok(o.blason);
  r.blason = {
    dibujo: Object.hasOwn(BLASONES, b.dibujo) ? b.dibujo : BLASON_INICIAL.dibujo,
    color: Object.hasOwn(TINTES, b.color) && b.color !== 'natural' ? b.color : BLASON_INICIAL.color,
  };
  return r;
}

// color sRGB (0-255) de una prenda con un tinte (el natural, si el tinte es «natural» o no vale)
export function colorPrenda(prenda, tinte) {
  const p = PRENDAS_TENIBLES[prenda];
  if (!p) return null;
  const c = paletaDe(prenda)[tinte];
  return (c && c[1]) || p.natural;
}
// color sRGB de la figura del blasón
export const colorFigura = (id) => (TINTES[id] && TINTES[id][1]) || TINTES.blanco[1];
