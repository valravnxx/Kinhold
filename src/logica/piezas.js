// Kinhold — definición de piezas de construcción (hito 1)
// Unidades: metros y kg. Módulo de rejilla: 2 m en horizontal, 2,5 m por planta.
// Todos los valores son iniciales y se ajustan probando.

export const MODULO = 2;      // lado de casilla
export const ALTURA = 2.5;    // altura de planta
export const RECUPERACION = 0.75; // material recuperado al desmontar
export const MAX_PLANTA = 3;  // plantas 0..3

// Tipos de hueco en la rejilla:
//  f = casilla (suelo / cimiento)         clave i,j,k
//  v = vértice (poste)                    clave i,j,k
//  e = arista vertical (muro)             clave i,j,k,d  (d=0 a lo largo de x, d=1 a lo largo de z)
//  b = arista superior (viga)             clave i,j,k,d  (en lo alto de la planta k)
//  r = tejado sobre casilla               clave i,j,k
//  g = hastial (triángulo) sobre arista   clave i,j,k,d
//  p = hueco de puerta en un muro         clave i,j,k,d
//  l = escalera de mano en casilla        clave i,j,k

export const MATERIALES = {
  piedra: 'Piedra', tronco: 'Tronco', vara: 'Vara', barro: 'Barro', paja: 'Paja',
  cuerda: 'Cuerda', tabla: 'Tabla', clavo: 'Clavo', hierro: 'Hierro',
};

// suelo: true = se apoya directamente en el terreno (solo planta 0)
export const PIEZAS = {
  mojon:              { nombre: 'Mojón', hueco: 'libre', nivel: 0, peso: 0,   cap: 0,    coste: { piedra: 3 }, cat: 'tierra' },

  cim_piedra:         { nombre: 'Cimiento de piedra', hueco: 'f', nivel: 1, peso: 400, cap: 6000, coste: { piedra: 8 }, soloPlanta0: true, cat: 'base' },
  cim_tronco:         { nombre: 'Cimiento de troncos', hueco: 'f', nivel: 1, peso: 150, cap: 2000, coste: { tronco: 2 }, soloPlanta0: true, cat: 'base' },
  suelo_tronco:       { nombre: 'Suelo de troncos', hueco: 'f', nivel: 1, peso: 120, cap: 900, coste: { tronco: 2 }, noPlanta0: true, cat: 'base' },
  suelo_tabla:        { nombre: 'Suelo de tablas', hueco: 'f', nivel: 2, peso: 100, cap: 1000, coste: { tabla: 4, clavo: 4 }, noPlanta0: true, cat: 'base' },

  poste:              { nombre: 'Poste', hueco: 'v', nivel: 1, peso: 60, cap: 2000, coste: { tronco: 1 }, cat: 'estructura' },
  viga:               { nombre: 'Viga', hueco: 'b', nivel: 1, peso: 60, cap: 1000, coste: { tronco: 1 }, cat: 'estructura' },

  muro_zarzo:         { nombre: 'Muro de zarzo y barro', hueco: 'e', nivel: 1, peso: 150, cap: 250, coste: { vara: 4, barro: 4 }, cat: 'muro' },
  muro_tronco:        { nombre: 'Muro de troncos', hueco: 'e', nivel: 1, peso: 300, cap: 1200, coste: { tronco: 4 }, cat: 'muro' },
  muro_tronco_puerta: { nombre: 'Muro de troncos con puerta', hueco: 'e', nivel: 1, peso: 220, cap: 850, coste: { tronco: 3 }, conPuerta: true, cat: 'muro' },
  muro_tronco_ventana:{ nombre: 'Muro de troncos con ventana', hueco: 'e', nivel: 1, peso: 260, cap: 1000, coste: { tronco: 3 }, conVentana: true, cat: 'muro' },
  muro_entramado:     { nombre: 'Muro de entramado', hueco: 'e', nivel: 2, peso: 250, cap: 1400, coste: { tronco: 2, vara: 2, barro: 3 }, cat: 'muro' },
  muro_tabla:         { nombre: 'Muro de tablas', hueco: 'e', nivel: 2, peso: 200, cap: 900, coste: { tabla: 6, clavo: 6 }, cat: 'muro' },
  muro_tabla_puerta:  { nombre: 'Muro de tablas con puerta', hueco: 'e', nivel: 2, peso: 150, cap: 600, coste: { tabla: 4, clavo: 4 }, conPuerta: true, cat: 'muro' },
  medio_muro:         { nombre: 'Medio muro', hueco: 'e', nivel: 1, peso: 80, cap: 0, coste: { tronco: 1, vara: 2 }, medio: true, cat: 'muro' },

  tejado_paja:        { nombre: 'Tejado de paja', hueco: 'r', nivel: 1, peso: 80, cap: 400, coste: { vara: 2, paja: 4 }, cat: 'tejado' },
  tejado_tablilla:    { nombre: 'Tejado de tablillas', hueco: 'r', nivel: 2, peso: 100, cap: 500, coste: { tabla: 3, clavo: 4 }, cat: 'tejado' },
  // El hastial ya se dibuja solo con el tejado; la pieza queda oculta para no romper partidas guardadas.
  hastial:            { nombre: 'Hastial (remate)', hueco: 'g', nivel: 1, peso: 100, cap: 0, coste: { tronco: 2 }, cat: 'oculto' },

  escalera_mano:      { nombre: 'Escalera de mano', hueco: 'l', nivel: 1, peso: 15, cap: 0, coste: { vara: 2, cuerda: 1 }, cat: 'acceso' },
  puerta_varas:       { nombre: 'Puerta de varas', hueco: 'p', nivel: 1, peso: 20, cap: 0, coste: { vara: 4, cuerda: 1 }, cat: 'acceso' },
  puerta_tabla:       { nombre: 'Puerta de tablas', hueco: 'p', nivel: 2, peso: 40, cap: 0, coste: { tabla: 4, clavo: 4, hierro: 1 }, cat: 'acceso' },

  cerca:              { nombre: 'Cerca de varas', hueco: 'e', nivel: 1, peso: 20, cap: 0, coste: { vara: 4, cuerda: 1 }, suelo: true, soloPlanta0: true, bajo: true, cat: 'exterior' },
  empalizada:         { nombre: 'Empalizada', hueco: 'e', nivel: 2, peso: 500, cap: 0, coste: { tronco: 6 }, suelo: true, soloPlanta0: true, alto: true, cat: 'exterior' },
  empalizada_puerta:  { nombre: 'Puerta de empalizada', hueco: 'e', nivel: 2, peso: 400, cap: 0, coste: { tronco: 4, hierro: 2 }, suelo: true, soloPlanta0: true, alto: true, portón: true, cat: 'exterior' },
};

// Decoración: colocación libre, no participa en la carga.
export const DECORACION = {
  cama_paja:   { nombre: 'Cama de paja', coste: { paja: 4 }, cama: true },
  cama_madera: { nombre: 'Cama de madera', coste: { tabla: 4, clavo: 4, paja: 2 }, cama: true },
  mesa:        { nombre: 'Mesa', coste: { tabla: 3, clavo: 4 } },
  banco:       { nombre: 'Banco', coste: { tabla: 2, clavo: 2 } },
  taburete:    { nombre: 'Taburete', coste: { tronco: 1 } },
  arcon:       { nombre: 'Arcón', coste: { tabla: 3, clavo: 4 } },
  barril:      { nombre: 'Barril', coste: { tabla: 3, hierro: 1 } },
  estanteria:  { nombre: 'Estantería', coste: { tabla: 3, clavo: 4 } },
  candil:      { nombre: 'Antorcha de pie', coste: { vara: 1, paja: 1 } },
  alfombra:    { nombre: 'Alfombra de piel', coste: { paja: 1 } },
  estandarte:  { nombre: 'Estandarte', coste: { vara: 2, cuerda: 1 } },
};

export const MATERIALES_INICIALES = {
  piedra: 120, tronco: 120, vara: 120, barro: 80, paja: 80, cuerda: 40, tabla: 80, clavo: 120, hierro: 20,
};
