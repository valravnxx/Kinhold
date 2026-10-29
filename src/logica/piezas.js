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
//  l = escalera (de mano o de tablas) o andamio en casilla  clave i,j,k
//  q = polea o polipasto colgado de una viga  clave i,j,k,d  (la de la viga b:i,j,k,d)
//  w = contraventana en la ventana de un muro  clave i,j,k,d  (la del muro e:i,j,k,d)
//  t = trampilla en el hueco de una escalera de tablas  clave i,j,k  (planta del hueco: la escalera está en k - 1)
//  a = adarve (pasarela) en una casilla de la planta baja junto a una empalizada  clave i,j,k (k = 0)
//  h = hogar (chimenea) en una casilla de la planta baja  clave i,j,k  (sobre el cimiento de piedra f:i,j,0)

export const MATERIALES = {
  piedra: 'Piedra', tronco: 'Tronco', vara: 'Vara', barro: 'Barro', paja: 'Paja',
  cuerda: 'Cuerda', tabla: 'Tabla', clavo: 'Clavo', hierro: 'Hierro', teja: 'Teja',
};

// Clase de peso de cada material (GDD, «Obras»): decide cómo se sube hasta la altura de la obra.
//  ligero     → a mano, por escalera o andamio
//  pesado     → entre dos personas, una sola con polea, o una sola rodándolo por dos varas con una cuerda (más despacio)
//  muy pesado → polipasto con torno (entre dos: uno tira y otro guía) o grúa de rueda. Piedra tallada (sillares):
//               aún no hay ningún material de esta clase; llega con los muros de piedra.
// La piedra (sin tallar) va como pesada: el GDD sube «piedras pequeñas» con polea (provisional).
export const CLASES_PESO = { ligero: 'Ligero', pesado: 'Pesado', muy_pesado: 'Muy pesado' };
export const CLASE_PESO = {
  tabla: 'ligero', vara: 'ligero', paja: 'ligero', clavo: 'ligero', cuerda: 'ligero', barro: 'ligero', hierro: 'ligero',
  teja: 'ligero', // las tejas se suben de pocas en pocas, a mano
  tronco: 'pesado', piedra: 'pesado',
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
  // Peso, carga y coste provisionales (sistemas no lo trae): en la proporción del muro de troncos con ventana.
  muro_tabla_ventana: { nombre: 'Muro de tablas con ventana', hueco: 'e', nivel: 2, peso: 175, cap: 780, coste: { tabla: 5, clavo: 5 }, conVentana: true, cat: 'muro' },
  medio_muro:         { nombre: 'Medio muro', hueco: 'e', nivel: 1, peso: 80, cap: 0, coste: { tronco: 1, vara: 2 }, medio: true, cat: 'muro' },

  tejado_paja:        { nombre: 'Tejado de paja', hueco: 'r', nivel: 1, peso: 80, cap: 400, coste: { vara: 2, paja: 4 }, cat: 'tejado' },
  tejado_tablilla:    { nombre: 'Tejado de tablillas', hueco: 'r', nivel: 2, peso: 100, cap: 500, coste: { tabla: 3, clavo: 4 }, cat: 'tejado' },
  // Sistemas: «Tejado de teja — N2, 10 tejas + vigas, 200 kg; no se pudre ni arde fácil; pesa». Las vigas de debajo
  // (los pares que sostienen las tejas) van como 1 tronco (provisional). Lo de pudrirse y arder queda anotado para
  // cuando haya mantenimiento y fuego; hoy solo cambia el peso que cargan los muros.
  tejado_teja:        { nombre: 'Tejado de teja', hueco: 'r', nivel: 2, peso: 200, cap: 500, coste: { teja: 10, tronco: 1 }, noSePudre: true, ardePoco: true, cat: 'tejado' },
  // Sistemas: «Remate de tejado — N1, materiales: igual, 40 kg; cumbrera y esquinas». La cumbrera ya la pone sola el
  // tejado; el remate es la pieza de la esquina, donde se juntan dos caídas en ángulo recto (limatesa en la esquina de
  // fuera, limahoya en el rincón de un tejado en L: la forma sale sola de los tramos de al lado). «Igual» se lee como
  // del mismo material que el tejado que remata: uno por material, con la mitad del coste y del peso de su tramo
  // (provisional; la paja, 40 kg como dice sistemas).
  remate_paja:        { nombre: 'Remate de paja (esquina)', hueco: 'r', nivel: 1, peso: 40, cap: 400, coste: { vara: 1, paja: 2 }, esquina: true, cat: 'tejado' },
  remate_tablilla:    { nombre: 'Remate de tablillas (esquina)', hueco: 'r', nivel: 2, peso: 50, cap: 500, coste: { tabla: 2, clavo: 2 }, esquina: true, cat: 'tejado' },
  remate_teja:        { nombre: 'Remate de teja (esquina)', hueco: 'r', nivel: 2, peso: 100, cap: 500, coste: { teja: 5, tronco: 1 }, esquina: true, noSePudre: true, ardePoco: true, cat: 'tejado' },
  // El hastial ya se dibuja solo con el tejado; la pieza queda oculta para no romper partidas guardadas.
  hastial:            { nombre: 'Hastial (remate)', hueco: 'g', nivel: 1, peso: 100, cap: 0, coste: { tronco: 2 }, cat: 'oculto' },

  escalera_mano:      { nombre: 'Escalera de mano', hueco: 'l', nivel: 1, peso: 15, cap: 0, coste: { vara: 2, cuerda: 1 }, cat: 'acceso' },
  // andando: se sube andando (sin botón); deja abierto el hueco del suelo de encima
  escalera_tabla:     { nombre: 'Escalera de tablas', hueco: 'l', nivel: 2, peso: 100, cap: 0, coste: { tabla: 6, clavo: 6 }, andando: true, cat: 'acceso' },
  // Obras (GDD): andamio pegado al muro, para trabajar y dejar material por encima de la planta baja. Varas atadas con
  // cuerda y una plataforma de zarzo arriba, a la altura del suelo de la planta de encima; se sube con Usar por su
  // escalerilla y se apilan uno sobre otro. Sostiene a quien trabaja encima y al andamio de arriba, nada más.
  andamio:            { nombre: 'Andamio', hueco: 'l', nivel: 1, peso: 40, cap: 200, coste: { vara: 8, cuerda: 2 }, andamio: true, cat: 'acceso' },
  // Polea simple colgada de una viga (GDD): una persona sola sube con ella lo pesado (un tronco, piedras) a las obras
  // en alto de su construcción.
  polea:              { nombre: 'Polea', hueco: 'q', nivel: 1, peso: 10, cap: 0, coste: { tabla: 1, cuerda: 2, hierro: 1 }, cat: 'acceso' },
  // Polipasto de varias poleas con torno (GDD, «Obras»): para lo muy pesado (vigas grandes, sillares) hacen falta dos,
  // uno en el torno y otro que guía la carga. Lo pesado (un tronco) lo sube también una persona sola, como con polea.
  // Nivel y coste provisionales (el GDD lo pone con la mampostería, que aún no tiene recetas).
  polipasto:          { nombre: 'Polipasto con torno', hueco: 'q', nivel: 2, peso: 40, cap: 0, coste: { tronco: 1, tabla: 2, cuerda: 4, hierro: 3 }, polipasto: true, cat: 'acceso' },
  puerta_varas:       { nombre: 'Puerta de varas', hueco: 'p', nivel: 1, peso: 20, cap: 0, coste: { vara: 4, cuerda: 1 }, cat: 'acceso' },
  puerta_tabla:       { nombre: 'Puerta de tablas', hueco: 'p', nivel: 2, peso: 40, cap: 0, coste: { tabla: 4, clavo: 4, hierro: 1 }, cat: 'acceso' },
  // Sistemas: «Contraventana, trampilla — N2, 2 tablas + clavos, 20 kg». Se abren y se cierran con Usar.
  // La contraventana va en un muro con ventana; la trampilla, en el hueco que deja arriba una escalera de tablas
  // (cerrada se pisa como el suelo y no deja subir ni bajar por la escalera).
  contraventana:      { nombre: 'Contraventana', hueco: 'w', nivel: 2, peso: 20, cap: 0, coste: { tabla: 2, clavo: 2 }, cat: 'acceso' },
  trampilla:          { nombre: 'Trampilla', hueco: 't', nivel: 2, peso: 20, cap: 0, coste: { tabla: 2, clavo: 2 }, cat: 'acceso' },
  // Sistemas: «Chimenea / hogar interior — N2, piedras + barro, 600 kg; calor dentro sin que arda la casa». Va en la
  // planta baja, sobre un cimiento de piedra terminado (le carga sus 600 kg), arrimada a un lado de la casilla: el
  // hogar con su campana y el cañón de piedra que sube hasta salir por encima del tejado. El fuego se enciende y se
  // apaga con Usar. Cantidades provisionales (sistemas no las da): 10 piedras y 4 de barro, en la proporción del
  // cimiento de piedra (8 piedras, 400 kg). El calor (frío, abrigo) llega con la supervivencia: hoy solo se ve.
  hogar:              { nombre: 'Chimenea', hueco: 'h', nivel: 2, peso: 600, cap: 0, coste: { piedra: 10, barro: 4 }, soloPlanta0: true, hogar: true, cat: 'estructura' },

  cerca:              { nombre: 'Cerca de varas', hueco: 'e', nivel: 1, peso: 20, cap: 0, coste: { vara: 4, cuerda: 1 }, suelo: true, soloPlanta0: true, bajo: true, cat: 'exterior' },
  // portón: se abre y se cierra con Usar (abierto no corta el paso)
  cerca_portillo:     { nombre: 'Portillo de varas', hueco: 'e', nivel: 1, peso: 20, cap: 0, coste: { vara: 4, cuerda: 1 }, suelo: true, soloPlanta0: true, bajo: true, portón: true, cat: 'exterior' },
  empalizada:         { nombre: 'Empalizada', hueco: 'e', nivel: 2, peso: 500, cap: 0, coste: { tronco: 6 }, suelo: true, soloPlanta0: true, alto: true, cat: 'exterior' },
  // Sistemas: «Adarve (pasarela) — N2, tablas + postes, 100 kg, sostiene 300; por detrás de la empalizada». Un piso de
  // tablas a 1,5 m sobre cuatro postes, en la casilla de detrás de una empalizada terminada (se arrima sola a ella).
  // Coste provisional (sistemas no da cantidades): el del suelo de tablas (4 tablas y 4 clavos, también 100 kg) y dos
  // troncos para los postes. Sostiene 300 kg: a quien está encima (el peso de la gente aún no se cuenta).
  adarve:             { nombre: 'Adarve', hueco: 'a', nivel: 2, peso: 100, cap: 300, coste: { tabla: 4, clavo: 4, tronco: 2 }, soloPlanta0: true, adarve: true, cat: 'exterior' },
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
  piedra: 120, tronco: 120, vara: 120, barro: 80, paja: 80, cuerda: 40, tabla: 80, clavo: 120, hierro: 20, teja: 100,
};
