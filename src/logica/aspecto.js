// Aspecto del personaje (personalización): lógica pura, sin three.js, para que el servidor pueda validarlo luego.
// El aspecto es un objeto pequeño que se guarda y se manda tal cual: los colores van por su nombre (paletas de
// aquí abajo) y la forma en números de -1 a 1 (cada uno mueve una forma de MakeHuman hecha en el taller).
// Los valores por defecto son los de los personajes del taller (herramientas/taller/vestir_mpfb.py), así que un
// personaje sin aspecto guardado se ve igual que antes.

// colores en sRGB (0-255), como en el taller
export const PALETAS = {
  piel: {
    muy_clara: ['Muy clara', [238, 204, 182]],
    clara: ['Clara', [230, 190, 165]],
    clara_rosada: ['Clara rosada', [224, 180, 152]],
    tostada: ['Tostada', [200, 152, 114]],
    morena: ['Morena', [160, 112, 78]],
    oscura: ['Oscura', [104, 70, 48]],
  },
  ojos: {
    castanos: ['Castaños', [92, 70, 48]],
    oscuros: ['Muy oscuros', [50, 36, 26]],
    avellana: ['Avellana', [112, 92, 52]],
    verdes: ['Verdes', [82, 104, 70]],
    azules: ['Azules', [70, 100, 126]],
    grises: ['Grises', [80, 96, 104]],
  },
  pelo: {
    negro: ['Negro', [30, 24, 20]],
    castano_oscuro: ['Castaño oscuro', [62, 44, 30]],
    castano: ['Castaño', [96, 66, 40]],
    rubio: ['Rubio', [168, 136, 86]],
    pelirrojo: ['Pelirrojo', [128, 62, 32]],
    canoso: ['Canoso', [150, 146, 140]],
  },
};

// formas: cada una va de -1 a 1 (0 = la del taller). Altura: escala del personaje entero (decisión provisional,
// apuntada en el registro del prototipo); las demás, formas de MakeHuman pasadas a la malla en el taller.
export const FORMAS = {
  altura: 'Altura',
  peso: 'Peso',
  musculo: 'Músculo',
  cara: 'Cara ancha',
  nariz: 'Nariz ancha',
  nariz_larga: 'Nariz larga',
  menton: 'Mentón',
};
export const ESCALA_ALTURA = 0.06; // ±6 % de la altura del personaje del taller

// melena, coleta y trenzas: mallas propias del taller sobre el pelo corto (taller-v10). La barba larga lleva debajo la corta
export const PEINADOS = {
  hombre: { corto: 'Corto', rapado: 'Rapado', melena: 'Melena', coleta: 'Coleta', trenzas: 'Trenzas' },
  mujer: { cofia: 'Recogido bajo la cofia', melena: 'Melena', coleta: 'Coleta', trenzas: 'Trenzas' },
};
export const BARBAS = {
  hombre: { corta: 'Barba corta', larga: 'Barba larga', perilla: 'Perilla', bigote: 'Bigote', ninguna: 'Afeitado' },
  mujer: { ninguna: 'Sin barba' },
};
export const PELO_LARGO = ['melena', 'coleta', 'trenzas'];

// qué piezas del pelo y de la barba se ven (por el final de su nombre en el modelo) con un aspecto y un tocado.
// Bajo la capucha o la toca no se ve el pelo largo (provisional: no hay una versión aplastada por la tela)
export function piezasCabeza(aspecto, tocado = null) {
  const p = aspecto.peinado, b = aspecto.barba, tapada = tocado === 'capucha' || tocado === 'toca';
  return {
    _pelo: p !== 'rapado' && p !== 'cofia',
    _pelo_melena: p === 'melena' && !tapada,
    _pelo_coleta: p === 'coleta' && !tapada,
    _pelo_trenzas: p === 'trenzas' && !tapada,
    _cofia: p === 'cofia',
    _orejas: p !== 'cofia' && !tapada,
    _barba_corta: b === 'corta' || b === 'larga',
    _barba_larga: b === 'larga',
    _barba_perilla: b === 'perilla',
    _barba_bigote: b === 'bigote',
  };
}

export const ASPECTO_INICIAL = {
  hombre: { piel: 'clara_rosada', ojos: 'castanos', pelo: 'castano_oscuro', peinado: 'corto', barba: 'corta' },
  mujer: { piel: 'clara', ojos: 'grises', pelo: 'castano_oscuro', peinado: 'cofia', barba: 'ninguna' },
};

const redondear = (x) => Math.round(x * 100) / 100;

// devuelve un aspecto válido: lo que falte o no exista se pone por defecto, los números se recortan a [-1, 1]
export function normalizarAspecto(a, sexo = 'hombre') {
  if (sexo !== 'mujer') sexo = 'hombre';
  const ini = ASPECTO_INICIAL[sexo], r = {};
  const ok = (v) => v !== null && typeof v === 'object' ? v : {};
  const o = ok(a);
  for (const k of ['piel', 'ojos', 'pelo']) r[k] = Object.hasOwn(PALETAS[k], o[k]) ? o[k] : ini[k];
  r.peinado = Object.hasOwn(PEINADOS[sexo], o.peinado) ? o.peinado : ini.peinado;
  r.barba = Object.hasOwn(BARBAS[sexo], o.barba) ? o.barba : ini.barba;
  r.formas = {};
  const f = ok(o.formas);
  for (const k of Object.keys(FORMAS)) {
    const v = Number(f[k]);
    r.formas[k] = Number.isFinite(v) ? redondear(Math.max(-1, Math.min(1, v))) : 0;
  }
  return r;
}

// color sRGB (0-255) de una opción de paleta
export const colorDe = (paleta, id) => (PALETAS[paleta][id] || Object.values(PALETAS[paleta])[0])[1];

// pesos de las formas del modelo (morph targets) para un aspecto: cada forma de -1 a 1 usa su forma «_mas» o «_menos»
export function pesosFormas(aspecto) {
  const p = {};
  for (const [k, v] of Object.entries(aspecto.formas || {})) {
    if (k === 'altura') continue;
    p[`${k}_mas`] = Math.max(0, v);
    p[`${k}_menos`] = Math.max(0, -v);
  }
  return p;
}
export const escalaAltura = (aspecto) => 1 + ESCALA_ALTURA * ((aspecto.formas && aspecto.formas.altura) || 0);
