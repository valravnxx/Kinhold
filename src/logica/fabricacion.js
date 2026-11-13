// Fabricar (revisión del 1 nov; GDD, apartado 9; documento de sistemas, apartados 7 y 8): las recetas están siempre a
// la vista, nadie las aprende; se fabrica en cualquier sitio con lo que llevas y lo que hay en el suelo a tu lado; y
// las estaciones son herramientas por uso, no niveles: una receta pide un USO (con las manos, al fuego, en la piedra de
// tallar, en el banco de tronco) y vale cualquier estación que lo dé (el fuego, la hoguera de fuera o el hogar de la
// casa). Lógica pura (sin three.js ni navegador): el servidor podrá usarla tal cual.
//
// Fabricar: lo que se hace con las manos, en cualquier sitio, con lo que llevas y lo del suelo a tu lado; lo demás,
// junto a una estación de su uso (la que se diga o la más cercana), con lo DEPOSITADO en ella (valravnx, 6 nov: «para
// crafteos de mano, mano y suelo, para crafteos de mesa específica, lo que se deposite en mesa»). Cada estación tiene
// dónde dejar los materiales (encima o junto a ella, y se ven puestos): se dejan desde lo que llevas y se pueden volver
// a coger; quien fabrica tiene que estar delante. La receta de las manos gasta primero lo que llevas encima y luego lo
// del suelo a tu lado; el encargo entra en
// la cola de la estación (o de tus manos) y se termina pasado su tiempo, contado por la hora (aunque nadie juegue): se
// guarda cuándo termina, no un contador. Lo terminado espera hasta que su autor lo recoge (solo él).
//
// Decisiones provisionales (el documento no las fija; anotadas en el diario):
//  - Tiempos: con las manos y lo sencillo, de 10 a 30 s; las herramientas, 45 a 60 s; endurecer la lanza al fuego,
//    60 s.
//  - Los puestos de trabajo son obra (valravnx, 6 nov: «las estaciones como obra, sí, siempre»): se pone el marco desde
//    el menú de construcción (su pestaña «Puestos de trabajo»), sin gastar nada; luego se le lleva su coste (de lo que
//    llevas y del suelo a tu lado, como al fabricar con las manos) y se trabaja en él hasta levantarlo (trabajo, en s
//    de trabajo, sumando los de todos: 5 s la piedra de tallar, 10 s la hoguera, 20 s el banco; provisional). La
//    herramienta que pide (el banco: hacha de piedra o lasca) se lleva al trabajarlo, y no se gasta. Hasta que se
//    termina no se fabrica en él ni se deposita nada. Un marco a medio hacer se puede quitar: lo entregado cae al
//    suelo, donde estaba. Dónde va cada uno (donde): la piedra de tallar y el banco, dentro o fuera; la hoguera, solo
//    fuera (bajo techo no); el hogar, solo dentro (con su tarea). «Dentro» es bajo el techo de una construcción
//    (lo dice quien valida: bajoTecho(x, z)).
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
//  - El hogar (8 nov) da el mismo uso que la hoguera (el fuego), solo dentro de la casa: un lecho de piedras y barro en
//    el suelo, en medio de la casa (el hogar abierto de las casas humildes; el humo sale por el tejado de juncos).
//    Provisional (diario y registro): 8 piedras y 2 cestas de barro, 20 s de trabajo. Lo suyo del fuego (más duradero,
//    se deja en brasas), en src/logica/fuego.js.
//  - Quedan para cuando existan sus materiales u objetos: envueltas de piel (no hay prenda de pies de piel), anzuelo
//    (no hay hueso), refugio de ramas (es una obra), carretilla (no hay rodaja de tronco), zurrón y chaleco (no hay
//    piel limpia), vendas, y lo de cocinar y calentarse al fuego.
//  - Lo terminado va donde quepa en lo que llevas (como lo recogido del suelo); si no cabe, sigue esperando.
//  - Lo depositado en una estación (6 nov): hasta DEPOSITO_MAX unidades en total; solo materiales sueltos (no lo que
//    llevas puesto, ni un contenedor con algo dentro, ni una prenda cosida). Dejar y coger, a ALCANCE_ESTACION; en
//    tierra de otro, solo su dueño y sus invitados (lo mira el servidor, como al poner la estación). Lo depositado es
//    de la estación, no de quien lo dejó: cualquiera que pueda tocarla lo gasta o lo coge. Se gasta al encargar.
//    Levantar la estación (entregarle su coste) gasta de lo que llevas y del suelo (no es fabricar en ella).
//  - Los almacenajes de la base (revisión del 1 nov; GDD, «Almacenajes de la base»; 7 nov): el acopio de troncos, la
//    pila de piedras y la leñera son puestos sin recetas (uso «almacen»): se levantan como obra desde el menú de
//    construcción (su pestaña «Almacenajes»), solo en tu tierra o en la de quien te invita (tierra: true), y guardan
//    solo lo suyo (guarda) y hasta lo que les cabe (cabe), con el mismo dejar y coger que lo depositado en una estación
//    (Usar). Lo guardado es de la tierra: solo su dueño y sus invitados lo tocan (lo mira el servidor). La obra no coge
//    de ellos sola, ni las recetas: hay que sacar lo que se vaya a usar. Provisional (el documento deja sus costes y lo
//    que cabe para cuando se hagan): el acopio, 4 varas y 15 s, 12 troncos; la pila, 4 piedras y 10 s, 40 piedras; la
//    leñera, 4 varas y 6 ramas y 15 s, 30 de leña y ramas. El acopio guarda también el tronco corto (es tronco).
//    Los otros cuatro (8 nov), igual de provisionales: el soporte de varas (dos caballetes de varas cruzadas), 4 varas y
//    10 s, 24 varas, dentro o fuera; el almiar (el montón alrededor de un palo hincado), 2 varas y 10 s, 24 haces de paja
//    y de juncos, fuera; el hoyo de barro (cavado con el palo cavador, que hay que llevar, y bordeado de piedras), 6
//    piedras y 20 s, 16 cestas de barro, fuera; y el cesto (de juncos, como la cesta de recolección), 3 haces de juncos
//    y 15 s, 30 de lo pequeño (sílex y lascas, fibra, yesca, cordel, cuerda, resina, bayas, setas, frutos secos y
//    hierbas), dentro o fuera.
import { CATALOGO } from './inventario.js';
import { VIDA, seEstropea } from './comida.js';
import { ALCANCE_COGER } from './suelo.js';
import { reparacionDe, seRepara, repararCosa, desgasteDe } from './desgaste.js';
import { fuegoNuevo, limpiarFuego, encendida, echar, encender, estadoFuego, dejarEnBrasas, avivar, YESCAS, HERRAMIENTA_FUEGO } from './fuego.js';

export const ALCANCE_ESTACION = 2.5;        // m, del jugador a la estación
export const ALCANCE_SUELO = ALCANCE_COGER; // m, del jugador a lo del suelo que se gasta
export const COLA_ESTACION = 3;             // encargos sin terminar por estación
export const COLA_MANOS = 1;
export const DEPOSITO_MAX = 20;             // unidades depositadas por estación, en total
export const MAX_RATO_ESTACION = 5;         // s de trabajo como mucho en una sola acción (como en las obras)

// Los usos: qué estaciones dan cada uno. Una receta pide un uso, no una estación concreta.
export const USOS = {
  manos:  { nombre: 'Con las manos', estaciones: [] },
  fuego:  { nombre: 'Al fuego', estaciones: ['hoguera', 'hogar'] },
  tallar: { nombre: 'En la piedra de tallar', estaciones: ['piedra_tallar'] },
  banco:  { nombre: 'En el banco de tronco', estaciones: ['banco_tronco'] },
};

// fuego: tiene fuego que se enciende, arde y se apaga (src/logica/fuego.js); sus recetas lo piden encendido.
// un: cómo se nombra en una frase. coste: lo que hay que llevarle a su obra. requiere: lleva al menos uno de estos al
// trabajarla (no se gasta). uso: el que da. donde: 'fuera', 'dentro' o 'ambos'. trabajo: s de trabajo para levantarla.
// lo que guardan los colgaderos: lo que va a la espalda (un contenedor) y las herramientas del catálogo
const DE_ESPALDA = Object.keys(CATALOGO).filter(k => CATALOGO[k].lugar === 'espalda' && CATALOGO[k].huecos);
const HERRAMIENTAS = Object.keys(CATALOGO).filter(k => CATALOGO[k].herramienta);
export const ESTACIONES = {
  hoguera:       { nombre: 'Hoguera', un: 'una hoguera', uso: 'fuego', coste: { piedra: 6, rama: 4 }, donde: 'fuera', trabajo: 10, fuego: true, hace: 'Cocinar, calentarse, endurecer al fuego, antorchas' },
  hogar:         { nombre: 'Hogar', un: 'un hogar', uso: 'fuego', coste: { piedra: 8, barro: 2 }, donde: 'dentro', trabajo: 20, fuego: true, hace: 'El fuego de dentro de la casa: más duradero, se deja en brasas; cocinar, calentarse, endurecer al fuego, antorchas' },
  piedra_tallar: { nombre: 'Piedra de tallar', un: 'una piedra de tallar', uso: 'tallar', coste: { piedra: 1 }, donde: 'ambos', trabajo: 5, hace: 'Herramientas de piedra y sílex' },
  banco_tronco:  { nombre: 'Banco de trabajo de tronco', un: 'un banco de trabajo de tronco', uso: 'banco', coste: { tronco_corto: 2 }, requiere: ['hacha_piedra', 'lasca_silex'], donde: 'ambos', trabajo: 20, hace: 'Trabajos de madera, mangos, cestería, primeras piezas de construcción' },
  // los almacenajes de la base (uso «almacen»: sin recetas): guarda, lo único que se deja en ellos; cabe, cuánto
  acopio_troncos: { nombre: 'Acopio de troncos', un: 'un acopio de troncos', uso: 'almacen', coste: { vara: 4 }, donde: 'fuera', trabajo: 15, tierra: true, guarda: ['tronco_delgado', 'tronco_largo', 'tronco_corto'], cabe: 12, hace: 'Guarda los troncos, apilados fuera' },
  pila_piedras:   { nombre: 'Pila de piedras', un: 'una pila de piedras', uso: 'almacen', coste: { piedra: 4 }, donde: 'fuera', trabajo: 10, tierra: true, guarda: ['piedra'], cabe: 40, hace: 'Guarda la piedra suelta' },
  lenera:         { nombre: 'Leñera', un: 'una leñera', uso: 'almacen', coste: { vara: 4, rama: 6 }, donde: 'ambos', trabajo: 15, tierra: true, guarda: ['lena', 'rama'], cabe: 30, hace: 'Guarda la leña y las ramas, a cubierto' },
  soporte_varas:  { nombre: 'Soporte de varas', un: 'un soporte de varas', uso: 'almacen', coste: { vara: 4 }, donde: 'ambos', trabajo: 10, tierra: true, guarda: ['vara'], cabe: 24, hace: 'Guarda las varas, tumbadas en dos caballetes' },
  almiar:         { nombre: 'Almiar', un: 'un almiar', uso: 'almacen', coste: { vara: 2 }, donde: 'fuera', trabajo: 10, tierra: true, guarda: ['paja', 'junco'], cabe: 24, hace: 'Guarda la paja y los juncos, en montón alrededor de un palo' },
  hoyo_barro:     { nombre: 'Hoyo de barro', un: 'un hoyo de barro', uso: 'almacen', coste: { piedra: 6 }, requiere: ['palo_cavador'], donde: 'fuera', trabajo: 20, tierra: true, guarda: ['barro'], cabe: 16, hace: 'Guarda el barro húmedo, en un hoyo cavado y bordeado de piedras' },
  // los de dentro, colgados en un muro (muro: true; valravnx, 8 nov): lo que se lleva a la espalda, vacío, cada uno de
  // su estaquilla; y las herramientas, colgadas por la cabeza entre dos varas
  colgadero_mochilas:     { nombre: 'Colgadero de mochilas', un: 'un colgadero de mochilas', uso: 'almacen', coste: { vara: 2, rama: 4, cordel: 2 }, donde: 'dentro', muro: true, trabajo: 15, tierra: true, guarda: DE_ESPALDA, guardaTxt: 'lo que se lleva a la espalda (mochilas, leñero, fardo, cestas…), vacío', cabe: 4, hace: 'Cuelga en el muro lo que se lleva a la espalda, vacío: cada uno de su estaquilla' },
  colgadero_herramientas: { nombre: 'Colgadero de herramientas', un: 'un colgadero de herramientas', uso: 'almacen', coste: { vara: 3, cordel: 2 }, donde: 'dentro', muro: true, trabajo: 15, tierra: true, guarda: HERRAMIENTAS, guardaTxt: 'las herramientas', cabe: 8, hace: 'Cuelga en el muro las herramientas, por la cabeza entre dos varas' },
  // las camas (P4, la cama ligada; valravnx, 8 nov: «ambas viables»): uso «cama», sin recetas ni nada que guardar; se
  // levantan como obra y se ligan (ligarCama): donde reapareces y donde se duerme (dormir). El refugio de ramas, para
  // cuando aún no tienes casa (12 ramas caídas del bosque y 4 cordel de fibra, en el suelo, fuera); la cama de juncos,
  // dentro de la casa (un lecho de juncos del río atados con cordel de fibra, de los de la época). Provisional: la cama,
  // 8 haces de juncos y 2 cordel; el refugio, 40 s de trabajo y la cama, 25 s (diario y registro).
  refugio_ramas:  { nombre: 'Refugio de ramas', un: 'un refugio de ramas', uso: 'cama', coste: { rama: 12, cordel: 4 }, donde: 'fuera', trabajo: 40, tierra: true, hace: 'Un tejadillo de ramas apoyado en un travesaño, con un lecho de ramas debajo: para dormir cuando aún no tienes casa' },
  cama_juncos:    { nombre: 'Cama de juncos', un: 'una cama de juncos', uso: 'cama', coste: { junco: 8, cordel: 2 }, donde: 'dentro', trabajo: 25, tierra: true, hace: 'Un lecho de haces de juncos atados con cordel, dentro de la casa' },
  cesto:          { nombre: 'Cesto', un: 'un cesto', uso: 'almacen', coste: { junco: 3 }, donde: 'ambos', trabajo: 15, tierra: true, guarda: ['silex', 'lasca_silex', 'fibra', 'yesca', 'cordel', 'cuerda', 'resina', 'bayas', 'setas', 'frutos_secos', 'hierbas', 'semilla_cebada', 'habas', 'habas_asadas', 'semilla_col', 'semilla_nabo'], guardaTxt: 'lo pequeño (sílex, fibra, cordel, yesca…)', cabe: 30, hace: 'Guarda lo pequeño: sílex, fibra, cordel, yesca, bayas…' },
};
// Los almacenajes (sin recetas) y cuánto cabe en lo depositado de cada estación.
export const esAlmacen = tipo => Object.hasOwn(ESTACIONES, tipo) && ESTACIONES[tipo].uso === 'almacen';
export const ALMACENAJES = Object.keys(ESTACIONES).filter(esAlmacen);
// Las camas (uso «cama»): se ligan (una por personaje) y se duerme en ellas.
export const esCama = tipo => Object.hasOwn(ESTACIONES, tipo) && ESTACIONES[tipo].uso === 'cama';
export const CAMAS = Object.keys(ESTACIONES).filter(esCama);
export const cabeEn = tipo => (Object.hasOwn(ESTACIONES, tipo) && ESTACIONES[tipo].cabe) || DEPOSITO_MAX;
// Si en una estación se puede dejar ese tipo (los almacenajes, solo lo suyo).
export const guardaTipo = (tipo, t) => !Object.hasOwn(ESTACIONES, tipo) || !ESTACIONES[tipo].guarda || ESTACIONES[tipo].guarda.includes(t);
export const MOTIVO_MURO = n => `${n}: va colgado en un muro lleno (sin puerta ni ventana) de la planta baja; pégalo a uno, por dentro.`;
export const DONDE = { fuera: 'Solo fuera', dentro: 'Solo dentro de la casa', ambos: 'Dentro o fuera' };
// Las estaciones que existen de un uso, y cómo se nombran juntas («una hoguera o un hogar»).
export const estacionesDeUso = uso => (USOS[uso] ? USOS[uso].estaciones : []).filter(t => Object.hasOwn(ESTACIONES, t));
export const conQue = uso => estacionesDeUso(uso).map(t => ESTACIONES[t].un).join(' o ');

// uso: uno de USOS. da: tipo del catálogo y cuántos. gasta: tipo → cuántos. s: segundos.
const r = (nombre, uso, da, gasta, s, n = 1) => ({ nombre, uso, da, n, gasta, s });
export const RECETAS = {
  // con las manos
  cordel:            r('Cordel de fibra', 'manos', 'cordel', { fibra: 3 }, 15),
  palo_cavador:      r('Palo cavador', 'manos', 'palo_cavador', { rama: 1 }, 10),
  // el taladro de fuego de arco (7 nov; el documento de sistemas lo nombra para encender la hoguera sin decir de qué se
  // hace): una rama da el arco y el huso, otra la tabla, y el cordel tensa el arco. Provisional (diario y registro)
  taladro_fuego:     r('Taladro de fuego', 'manos', 'taladro_fuego', { rama: 2, cordel: 1 }, 20),
  // (la honda y el odre piden piel: vuelven con la caza, 9 nov; la piel sale de despiezar la liebre)
  honda:             r('Honda', 'manos', 'honda', { cordel: 2, piel: 1 }, 30),
  lenero:            r('Leñero', 'manos', 'lenero', { rama: 4, cordel: 2 }, 30),
  rastra:            r('Rastra', 'manos', 'rastra', { rama: 5, cordel: 2 }, 30),
  fardo:             r('Fardo atado', 'manos', 'fardo', { cordel: 2 }, 15),
  arpon:             r('Arpón', 'manos', 'arpon', { rama: 1, lasca_silex: 1, cordel: 1 }, 30),
  odre:              r('Odre', 'manos', 'odre', { piel: 1, cordel: 1 }, 30),
  // despiezar la liebre cazada (9 nov; src/logica/comida.js): con las manos, llevando la lasca de sílex (requiere: no
  // se gasta); da la carne cruda y, además (tambien), la piel. Tiempo, provisional
  despiezar_liebre:  { ...r('Despiezar la liebre', 'manos', 'carne_cruda', { liebre: 1 }, 30), requiere: ['lasca_silex'], tambien: { piel: 1 } },
  // el mazo de piedra (valravnx, 8 nov): una piedra gorda atada al extremo de una rama con cordel, con las manos; rompe
  // las rocas medianas del mundo (src/logica/recoleccion.js). Tiempo, provisional (como el hacha, algo menos: no se talla)
  mazo_piedra:       r('Mazo de piedra', 'manos', 'mazo_piedra', { piedra: 1, rama: 1, cordel: 2 }, 45),
  // la yesca, para encender el fuego (7 nov): de la fibra seca (frotada y deshecha) o de la corteza (raspada); la de
  // los hongos yesqueros se recoge tal cual (src/logica/recoleccion.js)
  yesca:             r('Yesca de fibra seca', 'manos', 'yesca', { fibra: 2 }, 15),
  yesca_corteza:     r('Yesca de corteza', 'manos', 'yesca', { corteza: 1 }, 20, 2),
  // en la piedra de tallar
  lasca_silex:       r('Lasca de sílex', 'tallar', 'lasca_silex', { silex: 1, piedra: 1 }, 20),
  hacha_piedra:      r('Hacha de piedra', 'tallar', 'hacha_piedra', { piedra: 1, rama: 1, cordel: 2 }, 60),
  // al fuego (hoguera u hogar)
  lanza_endurecida:  r('Lanza endurecida', 'fuego', 'lanza_endurecida', { rama: 1 }, 60),
  antorcha:          r('Antorcha', 'fuego', 'antorcha', { rama: 1, fibra: 1 }, 20),
  antorcha_resina:   r('Antorcha (con resina)', 'fuego', 'antorcha', { rama: 1, resina: 1 }, 20),
  // asar la carne (9 nov; src/logica/comida.js): sacia más que cruda y no se estropea. Tiempo, provisional
  asar_carne:        r('Carne asada', 'fuego', 'carne_asada', { carne_cruda: 1 }, 45),
  // asar las habas (P11, 13 nov): crudas no se comen (son las silvestres: amargas); un puñado de 3 al fuego. Tiempo, provisional
  asar_habas:        r('Habas asadas', 'fuego', 'habas_asadas', { habas: 3 }, 30, 3),
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

// Para qué sirve lo que da cada receta (el panel lo enseña en su ficha): sale de la columna «para qué» del documento de
// sistemas (apartados 7 y 8), con lo que dice el GDD donde lo ha precisado (el hacha de piedra, revisión del 1 nov).
export const PARA = {
  cordel: 'Para atar; también sirve como cinturón de cordel (1 hueco).',
  palo_cavador: 'Cava barro y raíces, poco eficiente.',
  taladro_fuego: 'Con la yesca, enciende la hoguera o el hogar.',
  honda: 'Caza menor.',
  lenero: 'A la espalda: solo leña y troncos cortos.',
  rastra: 'Se arrastra a mano: 3 troncos cortos, 5 troncos delgados, 12 varas o un montón de piedras, despacio; se queda donde la dejas, con lo que lleve.',
  fardo: 'A la espalda: pieles, tela, fibras, paja, juncos y mimbre.',
  arpon: 'Pesca.',
  odre: 'Agua; va al hombro.',
  yesca: 'Prende la chispa para encender la hoguera o el hogar.',
  yesca_corteza: 'Prende la chispa para encender la hoguera o el hogar.',
  lasca_silex: 'Corta fibra y juncos, despieza.',
  mazo_piedra: 'Rompe las rocas medianas en piedras sueltas (las grandes, solo con hierro).',
  hacha_piedra: 'Tala árboles jóvenes (da un tronco delgado y varas); los adultos, muy despacio.',
  lanza_endurecida: 'Caza y defensa.',
  despiezar_liebre: 'Carne cruda (se estropea en unas horas) y una piel pequeña.',
  asar_carne: 'Sacia mucho más que la cruda y no se estropea.',
  asar_habas: 'Las habas silvestres solo se comen asadas.',
  antorcha: 'Luz; dura un rato.',
  antorcha_resina: 'Luz; dura un rato.',
  cuerda: 'Base de casi todo.',
  cuerda_trenzada: 'Cinturón de 2 huecos pequeños.',
  cesta_recoleccion: 'A la espalda: bayas, setas, hierbas, frutos secos y huevos.',
  cesta_juncos: 'A la espalda: bayas, setas, hierbas, frutos secos y huevos.',
  cesto_pescador: 'Pescado y aparejos.',
  nasa: 'Trampa de pesca.',
  trampa_lazo: 'Caza menor.',
  pala_madera: 'Barro, arcilla, arena, tierra.',
  azada: 'Preparar casillas de cultivo.',
  hoz_silex: 'Cosechar cereal.',
  mayal: 'Trillar.',
  cubo: 'Agua, leche.',
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

// Dónde va lo que llevas, para decir de dónde sale (el panel): la mano, el cinturón, la mochila o el hombro.
export const SITIO_DE_RUTA = ruta => ruta.startsWith('mano:') ? 'mano' : ruta.split('/')[0] === 'cintura' ? 'cinturon' : ruta.split('/')[0] === 'espalda' ? 'mochila' : 'hombro';

// De dónde sale cada material de «gasta» (lo que llevas y el suelo a tu lado) y qué falta. de[tipo]: { encima, suelo,
// sitios: { mano, cinturon, mochila, hombro, suelo } } — lo que se gastaría de cada sitio, en el orden en que se gasta.
export function cuentas(gasta, inv, cerca) {
  const de = {}, falta = {};
  for (const [tipo, n] of Object.entries(gasta)) {
    const encima = Math.min(n, enInventario(inv, tipo)), suelo = Math.min(n - encima, enSuelo(cerca, tipo));
    const sitios = {};
    let queda = encima;
    for (const ruta of rutasGastables(inv, tipo)) {
      if (!queda) break;
      const m = Math.min(queda, inv.buscar(ruta).cosa.n), s = SITIO_DE_RUTA(ruta);
      sitios[s] = (sitios[s] || 0) + m; queda -= m;
    }
    if (suelo) sitios.suelo = suelo;
    de[tipo] = { encima, suelo, sitios };
    if (encima + suelo < n) falta[tipo] = n - encima - suelo;
  }
  return { de, faltan: falta };
}
export const faltan = (gasta, inv, cerca) => cuentas(gasta, inv, cerca).faltan;

// Lo mismo con lo depositado en una estación (sus recetas solo gastan de ahí): de[tipo]: { encima: 0, suelo: 0,
// estacion, sitios: { estacion } }.
export function cuentasEstacion(gasta, deposito) {
  const de = {}, falta = {}, dep = deposito || {};
  for (const [tipo, n] of Object.entries(gasta)) {
    const m = Math.min(n, Object.hasOwn(dep, tipo) ? dep[tipo] : 0);
    de[tipo] = { encima: 0, suelo: 0, estacion: m, sitios: m ? { estacion: m } : {} };
    if (m < n) falta[tipo] = n - m;
  }
  return { de, faltan: falta };
}
export const totalDeposito = dep => Object.values(dep || {}).reduce((t, n) => t + n, 0);

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

// lo que hay que llevar para una receta que pide herramienta (que no se gasta)
export const textoRequiere = rc => `Para eso hace falta llevar ${rc.requiere.map(t => CATALOGO[t].nombre.toLowerCase()).join(' o ')}.`;
const textoFaltan = f => 'Te falta: ' + Object.entries(f).map(([t, n]) => `${n} de ${(CATALOGO[t] || {}).nombre || t}`).join(', ') + '.';

// ---------------- Estaciones y colas ----------------
// al desmontar un puesto terminado se recupera esto de su material (GDD: «Al desmontar se recupera el 75% del material»)
export const RECUPERA_ESTACION = 0.75;
// el giro, entre 0 y 2π y a milésimas
const normalGiro = g => +(((g % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(3);
export const VERSION_FABRICACION = 6; // 3: sin lo que sabía cada uno (fuera aprender recetas, revisión del 1 nov); 4: lo depositado; 5: la obra de cada puesto; 6: el fuego de la hoguera
// lo depositado que vale: solo tipos del catálogo (en un almacenaje, solo lo suyo), cantidades enteras positivas,
// hasta lo que cabe en ella (DEPOSITO_MAX en las estaciones de fabricar) en total
export function limpiarDeposito(dep, tipo = null) {
  const max = cabeEn(tipo);
  const o = {};
  let t = 0;
  for (const [k, n] of Object.entries(dep && typeof dep === 'object' && !Array.isArray(dep) ? dep : {})) {
    if (!Object.hasOwn(CATALOGO, k) || !guardaTipo(tipo, k) || !Number.isInteger(n) || n < 1 || t + n > max) continue;
    o[k] = n; t += n;
  }
  return o;
}
// La obra de un puesto, guardada: lo entregado (solo lo de su coste, sin pasarse), el trabajo y quién aportó.
const copiaObra = o => ({ entregado: { ...o.entregado }, trabajo: o.trabajo, aportes: o.aportes.map(a => JSON.parse(JSON.stringify(a))) });
export function limpiarObra(o, tipo) {
  if (!o || typeof o !== 'object' || !tiene(ESTACIONES, tipo)) return null;
  const coste = ESTACIONES[tipo].coste, entregado = {};
  for (const [t, n] of Object.entries(o.entregado && typeof o.entregado === 'object' ? o.entregado : {}))
    if (Object.hasOwn(coste, t) && Number.isInteger(n) && n > 0) entregado[t] = Math.min(n, coste[t]);
  const trabajo = Number.isFinite(o.trabajo) ? Math.max(0, Math.min(ESTACIONES[tipo].trabajo, o.trabajo)) : 0;
  return { entregado, trabajo, aportes: Array.isArray(o.aportes) ? o.aportes.filter(a => a && typeof a === 'object' && typeof a.autor === 'string') : [] };
}
export class Fabricacion {
  constructor() {
    this.estaciones = {}; // id → { id, tipo, x, z, autor, cola: [{ autor, receta, empieza, fin }], deposito: { tipo: n } }
    this.manos = {};      // autor → [{ autor, receta, empieza, fin }]
    this.siguiente = 1;
  }

  // La estación de un uso más cercana a pos, a su alcance (o null). Con gasta, primero la más cercana que tiene
  // depositado todo lo que pide; si ninguna, la más cercana.
  estacionCerca(uso, pos, gasta = null, ahora = 0) {
    const tipos = estacionesDeUso(uso);
    const l = Object.values(this.estaciones).filter(e => !e.obra && tipos.includes(e.tipo) && dist(e, pos) <= ALCANCE_ESTACION)
      .sort((a, b) => dist(a, pos) - dist(b, pos));
    const vale = e => !Object.keys(cuentasEstacion(gasta, e.deposito).faltan).length;
    const arde = e => !ESTACIONES[e.tipo].fuego || encendida(e.fuego, ahora);
    return (gasta && (l.find(e => vale(e) && arde(e)) || l.find(vale))) || l[0] || null;
  }

  // Todas las recetas, siempre a la vista, para quien está en pos con inv y el suelo a su lado:
  //  - «ya»: tiene su estación al lado (o es con las manos) y no le falta nada (en la estación, depositado en ella);
  //  - «casi»: tiene su estación al lado, pero le falta algo (faltan: lo que falta depositar en ella);
  //  - «despues»: le falta la estación de su uso (conQue dice cuál).
  // Cada una dice de dónde sale cada material (de: { tipo: { encima, suelo } }), en qué estación se haría y cuántas
  // veces se podría hacer ya (veces).
  lista(pos, inv, suelo, ahora) {
    const cerca = sueloCerca(suelo, pos, ahora);
    return Object.entries(RECETAS).filter(([, rc]) => !rc.fuera).map(([receta, rc]) => {   // (lo de fuera del tramo, no)
      const e = rc.uso === 'manos' ? null : this.estacionCerca(rc.uso, pos, rc.gasta, ahora);
      const { de, faltan: f } = e ? cuentasEstacion(rc.gasta, e.deposito) : cuentas(rc.gasta, inv, cerca);
      const apagada = !!(e && ESTACIONES[e.tipo].fuego && !encendida(e.fuego, ahora));
      const sinHerramienta = !!rc.requiere && !rc.requiere.some(t => inv.cuantos(t) > 0);
      const grupo = rc.uso !== 'manos' && !e ? 'despues' : Object.keys(f).length || apagada || sinHerramienta ? 'casi' : 'ya';
      // cuántas veces se podría hacer ahora mismo con lo que hay (el panel: «Hacer ×3»)
      const veces = grupo !== 'ya' ? 0 : Math.min(...Object.entries(rc.gasta).map(([t, n]) => Math.floor((e ? ((e.deposito || {})[t] || 0) : enInventario(inv, t) + enSuelo(cerca, t)) / n)));
      return { receta, nombre: rc.nombre, uso: rc.uso, grupo, veces, estacion: e ? e.id : null, conQue: rc.uso === 'manos' ? '' : conQue(rc.uso), gasta: { ...rc.gasta }, da: rc.da, n: rc.n, s: rc.s, de, faltan: f, ...(apagada ? { apagada: true } : {}),
        ...(rc.requiere ? { requiere: [...rc.requiere], ...(sinHerramienta ? { sinHerramienta: true } : {}) } : {}), ...(rc.tambien ? { tambien: { ...rc.tambien } } : {}) };
    });
  }

  // Los puestos que se pueden poner (el menú de construcción): lo que cuesta su obra, lo que hay que llevar al
  // trabajarla (requiere, que no se gasta) y dónde va.
  listaEstaciones() {
    return Object.entries(ESTACIONES).map(([tipo, e]) => ({ tipo, nombre: e.nombre, uso: e.uso, hace: e.hace, coste: { ...e.coste },
      requiere: e.requiere ? [...e.requiere] : [], donde: e.donde, trabajo: e.trabajo }));
  }

  // ¿Se puede poner el marco de tipo en (x, z)? dentro: si ese sitio está bajo techo. enTierra: si es tu tierra (o la
  // de quien te invita); null si no se sabe (lo mira quien llama).
  puedeColocar(tipo, x, z, dentro = false, enTierra = null) {
    if (!tiene(ESTACIONES, tipo)) return { ok: false, motivo: 'Esa estación no existe.' };
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, motivo: 'Sitio no válido.' };
    const e = ESTACIONES[tipo];
    if (e.donde === 'fuera' && dentro) return { ok: false, motivo: `${e.nombre}: solo fuera, no bajo techo.` };
    if (e.donde === 'dentro' && !dentro) return { ok: false, motivo: `${e.nombre}: solo dentro de la casa.` };
    if (e.tierra && enTierra === false) return { ok: false, motivo: e.uso === 'cama' ? 'La cama va en tu tierra (o en la de quien te invita).' : 'Los almacenajes van en tu tierra (o en la de quien te invita).' };
    return { ok: true };
  }
  // Poner el marco de un puesto en (x, z) (y: la altura del suelo en el que se apoya, si se da): no gasta nada; su
  // coste se le lleva luego (entregarEstacion) y se levanta trabajando en él (trabajarEstacion).
  // giro: hacia dónde mira, en radianes, el que se le dio al ponerlo (valravnx, 7 nov: «no se ponen en la dirección de
  // rotación que los has puesto»); sin él, el de antes (al azar por su nombre, en el navegador).
  colocar(autor, tipo, x, z, dentro = false, y = null, enTierra = null, giro = null) {
    const v = this.puedeColocar(tipo, x, z, dentro, enTierra);
    if (!v.ok) return v;
    const id = `${tipo}:${this.siguiente++}`;
    this.estaciones[id] = { id, tipo, x, z, autor, cola: [], deposito: {}, obra: { entregado: {}, trabajo: 0, aportes: [] } };
    if (Number.isFinite(y)) this.estaciones[id].y = y;
    if (Number.isFinite(giro)) this.estaciones[id].giro = normalGiro(giro);
    return { ok: true, id, obra: true };
  }

  // Lo que le falta a la obra de un puesto: { tipo: n }.
  faltaEstacion(e) {
    if (!e || !e.obra) return {};
    const f = {};
    for (const [t, n] of Object.entries(ESTACIONES[e.tipo].coste)) { const q = n - (e.obra.entregado[t] || 0); if (q > 0) f[t] = q; }
    return f;
  }
  obraAlLado(estacion, pos) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { motivo };
    if (!e.obra) return { motivo: 'Esa estación ya está terminada.' };
    return { e };
  }
  // Llevarle a la obra de un puesto lo que le falta: lo que haya de ello en lo que llevas y en el suelo a tu lado
  // (primero lo que llevas). Entrega lo que haya, aunque no sea todo.
  entregarEstacion(autor, estacion, pos, inv, suelo = null, ahora = 0) {
    const { e, motivo } = this.obraAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    const falta = this.faltaEstacion(e);
    if (!Object.keys(falta).length) return { ok: false, motivo: 'Ya tiene todo el material: ahora hay que trabajar en ella.' };
    const cerca = sueloCerca(suelo, pos, ahora), { de } = cuentas(falta, inv, cerca), lleva = {};
    for (const [t, d] of Object.entries(de)) if (d.encima + d.suelo > 0) lleva[t] = d.encima + d.suelo;
    if (!Object.keys(lleva).length) return { ok: false, motivo: textoFaltan(falta).replace('Te falta', 'Le falta') + ' No lo llevas ni lo tienes a tu lado.', faltan: falta };
    const usado = gastarTodo(lleva, inv, cerca, suelo);
    for (const [t, n] of Object.entries(lleva)) e.obra.entregado[t] = (e.obra.entregado[t] || 0) + n;
    e.obra.aportes.push({ autor, entrega: { ...lleva } });
    return { ok: true, estacion: e.id, entregado: lleva, falta: this.faltaEstacion(e), usado };
  }
  // Un rato de trabajo en la obra de un puesto con todo su material (los segundos de todos se suman). Al llegar a su
  // trabajo, queda levantado y ya se puede usar.
  trabajarEstacion(autor, estacion, segundos, pos, inv) {
    const { e, motivo } = this.obraAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (!(segundos > 0 && segundos <= MAX_RATO_ESTACION)) return { ok: false, motivo: 'Rato de trabajo no válido.' };
    const f = this.faltaEstacion(e);
    if (Object.keys(f).length) return { ok: false, motivo: 'Primero hay que llevarle todo el material. ' + textoFaltan(f).replace('Te falta', 'Le falta'), faltan: f };
    const def = ESTACIONES[e.tipo];
    if (def.requiere && !def.requiere.some(t => inv.cuantos(t) > 0))
      return { ok: false, motivo: `Para levantarla hace falta llevar ${def.requiere.map(t => CATALOGO[t].nombre.toLowerCase()).join(' o ')}.` };
    e.obra.trabajo = Math.min(def.trabajo, e.obra.trabajo + segundos);
    const suyo = e.obra.aportes.find(x => x.autor === autor && x.trabajo !== undefined);
    if (suyo) suyo.trabajo = +(suyo.trabajo + segundos).toFixed(3); else e.obra.aportes.push({ autor, trabajo: +segundos.toFixed(3) });
    if (e.obra.trabajo >= def.trabajo - 1e-9) { const aportes = e.obra.aportes; delete e.obra; if (def.fuego) e.fuego = fuegoNuevo(e.tipo); return { ok: true, estacion: e.id, terminada: true, progreso: 1, aportes }; }
    return { ok: true, estacion: e.id, terminada: false, progreso: e.obra.trabajo / def.trabajo };
  }
  // Quitar el marco de un puesto a medio hacer: lo entregado cae al suelo donde estaba (con suelo; sin él, se pierde).
  // enTierras: si ese sitio es de la tierra de quien lo quita (src/logica/suelo.js).
  quitarEstacion(autor, estacion, pos, suelo = null, ahora = 0, enTierras = false) {
    const { e, motivo } = this.obraAlLado(estacion, pos);
    if (!e) return { ok: false, motivo: motivo === 'Esa estación ya está terminada.' ? 'Solo se quita un marco a medio hacer.' : motivo };
    const devuelto = { ...e.obra.entregado }, alSuelo = [];
    if (suelo) for (const [t, n] of Object.entries(devuelto)) if (n > 0) alSuelo.push(suelo.dejar({ tipo: t, n }, e.x, e.z, ahora, autor, !!enTierras).id);
    delete this.estaciones[e.id];
    return { ok: true, estacion: e.id, quitada: true, devuelto, alSuelo };
  }

  // Desmontar un puesto o un almacenaje terminado (valravnx, 7 nov: «no se pueden desmontar de ninguna manera»): como
  // las piezas (GDD: se recupera el 75 % del material), al suelo donde estaba, y lo que guardaba, entero. No mientras
  // arde ni con encargos a medias (se recogen antes). Con suelo; sin él, se pierde. enTierras: si ese sitio es de la
  // tierra de quien lo desmonta (src/logica/suelo.js).
  desmontarEstacion(autor, estacion, pos, suelo = null, ahora = 0, enTierras = false) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (e.obra) return this.quitarEstacion(autor, estacion, pos, suelo, ahora, enTierras);
    if (e.fuego && (estadoFuego(e.fuego, ahora).encendida || estadoFuego(e.fuego, ahora).brasas)) return { ok: false, motivo: 'Está ardiendo: espera a que se apague.' };
    if (e.cola.length) return { ok: false, motivo: 'Tiene encargos a medias: espera a que terminen y recógelos.' };
    const devuelto = {};
    for (const [t, n] of Object.entries(ESTACIONES[e.tipo].coste)) { const r = Math.floor(n * RECUPERA_ESTACION); if (r > 0) devuelto[t] = r; }
    const guardado = { ...e.deposito }, alSuelo = [];
    if (suelo) for (const l of [devuelto, guardado]) for (const [t, n] of Object.entries(l)) if (n > 0) alSuelo.push(suelo.dejar({ tipo: t, n }, e.x, e.z, ahora, autor, !!enTierras).id);
    delete this.estaciones[e.id];
    return { ok: true, estacion: e.id, desmontada: true, devuelto, guardado, alSuelo };
  }

  // La estación de id, a tu alcance desde pos (o el motivo).
  estacionAlLado(estacion, pos) {
    const e = tiene(this.estaciones, estacion) ? this.estaciones[estacion] : null;
    if (!e) return { motivo: 'Ahí no hay estación.' };
    if (dist(e, pos) > ALCANCE_ESTACION) return { motivo: 'Estás demasiado lejos de la estación.' };
    return { e };
  }

  // Dejar en una estación lo que llevas en la ruta de (todo o cantidad). Solo materiales sueltos.
  depositar(autor, estacion, de, cantidad, pos, inv) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (e.obra) return { ok: false, motivo: 'Aún está en obra: llévale su material y trabaja en ella.' };
    const b = typeof de === 'string' ? inv.buscar(de) : { motivo: 'Ahí no hay nada.' };
    if (b.motivo || !b.cosa) return { ok: false, motivo: b.motivo || 'Ahí no hay nada.' };
    const c = b.cosa, d = inv.def(c);
    if (!d) return { ok: false, motivo: 'Objeto desconocido.' };
    // lo que llevas a la espalda se cuelga directamente en el colgadero de mochilas
    const deLaEspalda = de === 'espalda' && guardaTipo(e.tipo, c.tipo) && ESTACIONES[e.tipo].guarda;
    if (!de.includes('/') && !de.startsWith('mano:') && d.lugar && !deLaEspalda) return { ok: false, motivo: 'Eso lo llevas puesto.' };
    if (c.dentro && c.dentro.some(Boolean)) return { ok: false, motivo: 'Vacíalo antes.' };
    if (c.hechura || c.tinte || c.carga) return { ok: false, motivo: 'Eso no se deja en una estación.' };
    const def = ESTACIONES[e.tipo];
    if (!guardaTipo(e.tipo, c.tipo)) return { ok: false, motivo: `${def.nombre}: solo guarda ${def.guardaTxt || def.guarda.map(t => CATALOGO[t].nombre.toLowerCase()).join(', ')}.` };
    const n = cantidad === undefined || cantidad === null ? c.n : cantidad;
    if (!Number.isInteger(n) || n < 1 || n > c.n) return { ok: false, motivo: 'Cantidad no válida.' };
    const hay = totalDeposito(e.deposito), max = cabeEn(e.tipo), donde = def.guarda ? def.nombre : 'En la estación';
    if (hay + n > max) return { ok: false, motivo: hay >= max ? `${donde}: no cabe nada más.` : `${donde}: solo caben ${max - hay} más.` };
    const tipo = c.tipo, s = inv.sacar(de, n);
    if (!s.ok) return s;
    e.deposito[tipo] = (e.deposito[tipo] || 0) + n;
    return { ok: true, estacion: e.id, dejado: { [tipo]: n } };
  }

  // Coger de una estación lo depositado de un tipo (todo o cantidad): va a lo que llevas, donde quepa. Si no cabe
  // todo, coge lo que cabe (valravnx, 8 nov: con una pila grande en el almacén no se quedaba bloqueada para siempre).
  retirar(autor, estacion, tipo, cantidad, pos, inv) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (typeof tipo !== 'string' || !Object.hasOwn(e.deposito, tipo)) return { ok: false, motivo: 'Eso no está en la estación.' };
    const pide = cantidad === undefined || cantidad === null ? e.deposito[tipo] : cantidad;
    if (!Number.isInteger(pide) || pide < 1 || pide > e.deposito[tipo]) return { ok: false, motivo: 'Cantidad no válida.' };
    // lo de la espalda, primero a la espalda si la tienes libre (te lo pones al descolgarlo)
    const aEspalda = CATALOGO[tipo] && CATALOGO[tipo].lugar === 'espalda' && !inv.lugares.espalda && inv.meter('espalda', { tipo, n: 1 }).ok ? 1 : 0;
    const n = aEspalda + (pide > aEspalda ? inv.cabenCuantos(tipo, pide - aEspalda) : 0);
    if (n < 1) return { ok: false, motivo: 'No te cabe: no tienes sitio libre.' };
    const m = n > aEspalda ? inv.meterDonde(tipo, n - aEspalda) : { ok: true, donde: [] };
    if (!m.ok) { if (aEspalda) inv.sacar('espalda'); return m; }
    if (aEspalda) m.donde.unshift(['espalda', 1]);
    e.deposito[tipo] -= n;
    if (!e.deposito[tipo]) delete e.deposito[tipo];
    return { ok: true, estacion: e.id, cogido: { [tipo]: n }, donde: m.donde, ...(n < pide ? { noCabia: pide - n } : {}) };
  }

  // Reparar lo que llevas en de (una mano, casi siempre) en la estación que tienes al lado, con lo depositado en ella
  // (src/logica/desgaste.js, REPARAR: qué puesto, qué material y cuánto recupera). Se hace en el acto.
  reparar(autor, estacion, de, pos, inv) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (e.obra) return { ok: false, motivo: 'Aún está en obra: llévale su material y trabaja en ella.' };
    const b = typeof de === 'string' ? inv.buscar(de) : { motivo: 'Ahí no hay nada.' };
    if (b.motivo || !b.cosa) return { ok: false, motivo: b.motivo || 'Ahí no hay nada.' };
    const c = b.cosa;
    if (!seRepara(c.tipo)) return { ok: false, motivo: 'Eso no se repara.' };
    const rp = reparacionDe(c.tipo);
    if (ESTACIONES[e.tipo].uso !== rp.uso) return { ok: false, motivo: `Eso se repara en ${conQue(rp.uso)}.` };
    if (!desgasteDe(c).usado) return { ok: false, motivo: 'Está como nuevo: no le hace falta.' };
    if (rp.requiere && !rp.requiere.some(t => inv.cuantos(t) > 0)) return { ok: false, motivo: textoRequiere(rp) };
    const f = cuentasEstacion(rp.gasta, e.deposito).faltan;
    if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f).replace('Te falta', 'Falta en la estación'), faltan: f };
    for (const [tipo, n] of Object.entries(rp.gasta)) { e.deposito[tipo] -= n; if (!e.deposito[tipo]) delete e.deposito[tipo]; }
    const g = repararCosa(c);
    return { ok: true, estacion: e.id, reparado: { objeto: c.tipo, ...g }, usado: { encima: {}, suelo: {}, estacion: { ...rp.gasta } } };
  }

  // ---------- el fuego (src/logica/fuego.js) ----------
  fuegoAlLado(estacion, pos) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { motivo };
    if (!ESTACIONES[e.tipo].fuego) return { motivo: 'Eso no tiene fuego.' };
    if (e.obra) return { motivo: 'Aún está en obra: llévale su material y trabaja en ella.' };
    if (!e.fuego) e.fuego = fuegoNuevo(e.tipo);
    return { e };
  }
  // La cama ligada de un autor (la id de su estación), o null. Una por personaje.
  camaDe(autor) {
    for (const e of Object.values(this.estaciones)) if (e.ligadas && e.ligadas.includes(autor)) return e.id;
    return null;
  }
  camaAlLado(estacion, pos) {
    const { e, motivo } = this.estacionAlLado(estacion, pos);
    if (!e) return { motivo };
    if (!esCama(e.tipo)) return { motivo: 'Eso no es una cama.' };
    if (e.obra) return { motivo: 'Aún está a medias: termínala primero.' };
    return { e };
  }
  // Ligar la cama que tienes al lado (la de antes deja de serlo). En tu tierra o en la de quien te ha invitado a
  // construir (enTierra: si está en la tierra de alguien; quién puede tocarla lo mira antes el servidor, puedeTocar).
  // Varios pueden ligar la misma (la pareja o el grupo que vive junto).
  ligarCama(autor, estacion, pos, enTierra = true) {
    const { e, motivo } = this.camaAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (!enTierra) return { ok: false, motivo: 'La cama ligada va en tu tierra o en la de quien te ha invitado a construir.' };
    if (e.ligadas && e.ligadas.includes(autor)) return { ok: false, motivo: 'Ya es tu cama ligada.' };
    for (const o of Object.values(this.estaciones)) if (o.ligadas && o.ligadas.includes(autor)) { o.ligadas = o.ligadas.filter(a => a !== autor); if (!o.ligadas.length) delete o.ligadas; }
    e.ligadas = [...(e.ligadas || []), autor];
    return { ok: true, estacion: e.id, ligada: true };
  }
  // Dormir en tu cama ligada (la que tienes al lado). Lo que hace dormir (el cansancio que baja) lo lleva el servidor.
  dormir(autor, estacion, pos) {
    const { e, motivo } = this.camaAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    if (!e.ligadas || !e.ligadas.includes(autor)) return { ok: false, motivo: 'Solo se duerme en tu cama ligada: lígala primero.' };
    return { ok: true, estacion: e.id, dormir: true };
  }
  // Encender el fuego de una estación: gasta 1 yesca de lo que llevas y pide llevar el taladro de fuego. En brasas (el
  // hogar), se aviva sin nada.
  encenderFuego(autor, estacion, pos, inv, ahora) {
    const { e, motivo } = this.fuegoAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    const st = estadoFuego(e.fuego, ahora);
    if (st.encendida) return { ok: false, motivo: 'Ya está encendida.' };
    if (st.brasas) { const r = avivar(e.fuego, ahora); return r.ok ? { ok: true, estacion: e.id, encendida: true, avivada: true, hasta: r.hasta, gastado: {} } : r; }
    if (!(st.combustible > 0)) return { ok: false, motivo: 'No tiene nada que arder: échale ramas o leña.' };
    if (!(inv.cuantos(HERRAMIENTA_FUEGO) > 0)) return { ok: false, motivo: 'Para encenderla hace falta llevar el taladro de fuego y yesca.' };
    const ruta = YESCAS.flatMap(t => rutasGastables(inv, t))[0];
    if (!ruta) return { ok: false, motivo: 'Para encenderla hace falta llevar yesca.' };
    const tipo = inv.buscar(ruta).cosa.tipo, r = encender(e.fuego, ahora);
    if (!r.ok) return r;
    inv.sacar(ruta, 1);
    return { ok: true, estacion: e.id, encendida: true, hasta: r.hasta, gastado: { [tipo]: 1 } };
  }
  // Echarle al fuego una rama o una leña de lo que llevas (objeto: 'rama' o 'lena').
  echarFuego(autor, estacion, objeto, pos, inv, ahora) {
    const { e, motivo } = this.fuegoAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    const ruta = rutasGastables(inv, objeto)[0];
    if (!ruta) return { ok: false, motivo: objeto === 'lena' ? 'No llevas leña.' : objeto === 'rama' ? 'No llevas ramas.' : 'Al fuego solo se echan ramas o leña.' };
    const r = echar(e.fuego, objeto, ahora, e.tipo);
    if (!r.ok) return r;
    inv.sacar(ruta, 1);
    return { ok: true, estacion: e.id, echado: { [objeto]: 1 }, encendida: r.encendida, segundos: r.segundos };
  }
  // Dejar en brasas el fuego de una estación que lo admite (el hogar): sin gastar nada.
  brasasFuego(autor, estacion, pos, ahora) {
    const { e, motivo } = this.fuegoAlLado(estacion, pos);
    if (!e) return { ok: false, motivo };
    const r = dejarEnBrasas(e.fuego, ahora, e.tipo);
    return r.ok ? { ok: true, estacion: e.id, brasas: true, hasta: r.hasta } : r;
  }

  // La cola de una estación (o de las manos de un autor).
  colaDe(estacion, autor) { return estacion ? (this.estaciones[estacion] || {}).cola : (this.manos[autor] ||= []); }

  // Encargar una receta. estacion: id de la estación, o null (con las manos, o la más cercana de su uso). pos: dónde
  // está el autor { x, z }. suelo: el Suelo del mundo (lo que haya a su lado se puede gastar).
  fabricar(autor, receta, estacion, pos, inv, suelo, ahora) {
    if (!tiene(RECETAS, receta)) return { ok: false, motivo: 'Esa receta no existe.' };
    const rc = RECETAS[receta];
    if (rc.fuera) return { ok: false, motivo: 'Eso aún no se puede hacer: pide piel, y aún no hay caza.' };
    if (rc.requiere && !rc.requiere.some(t => inv.cuantos(t) > 0)) return { ok: false, motivo: textoRequiere(rc) };
    let cola, max = COLA_MANOS, enEst = null;
    if (rc.uso === 'manos') {
      if (estacion) return { ok: false, motivo: 'Eso se hace con las manos.' };
      cola = this.colaDe(null, autor);
    } else {
      let e;
      if (estacion) {
        e = tiene(this.estaciones, estacion) ? this.estaciones[estacion] : null;
        if (!e) return { ok: false, motivo: 'Ahí no hay estación.' };
        if (e.obra) return { ok: false, motivo: 'Esa estación aún está en obra.' };
        if (ESTACIONES[e.tipo].uso !== rc.uso) return { ok: false, motivo: `Eso se hace en ${conQue(rc.uso)}.` };
        if (dist(e, pos) > ALCANCE_ESTACION) return { ok: false, motivo: 'Estás demasiado lejos de la estación.' };
      } else {
        e = this.estacionCerca(rc.uso, pos, rc.gasta, ahora);
        if (!e) return { ok: false, motivo: `Hace falta ${conQue(rc.uso)} a tu lado.` };
      }
      if (ESTACIONES[e.tipo].fuego && !encendida(e.fuego, ahora)) return { ok: false, motivo: estadoFuego(e.fuego, ahora).brasas ? 'Está en brasas: avívalo para que vuelva la llama.' : 'El fuego está apagado: enciéndelo con yesca y el taladro de fuego.' };
      cola = e.cola; max = COLA_ESTACION; enEst = e;
    }
    const sinTerminar = cola.filter(c => c.fin > ahora);
    if (sinTerminar.length >= max) return { ok: false, motivo: rc.uso === 'manos' ? 'Ya estás haciendo otra cosa.' : 'La cola de la estación está llena.' };
    let usado;
    if (enEst) { // con lo depositado en la estación, y nada más
      const f = cuentasEstacion(rc.gasta, enEst.deposito).faltan;
      if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f).replace('Te falta', 'Falta en la estación'), faltan: f };
      for (const [tipo, n] of Object.entries(rc.gasta)) { enEst.deposito[tipo] -= n; if (!enEst.deposito[tipo]) delete enEst.deposito[tipo]; }
      usado = { encima: {}, suelo: {}, estacion: { ...rc.gasta } };
    } else {
      const cerca = sueloCerca(suelo, pos, ahora), f = faltan(rc.gasta, inv, cerca);
      if (Object.keys(f).length) return { ok: false, motivo: textoFaltan(f), faltan: f };
      usado = gastarTodo(rc.gasta, inv, cerca, suelo);
    }
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

  // Recoger lo terminado del autor en una estación (o de sus manos): va a lo que lleva, donde quepa. Lo que no cabe:
  // con suelo, cae a sus pies (enTierras: si ese sitio es de su tierra, src/logica/suelo.js); sin él, sigue esperando.
  recoger(autor, estacion, pos, inv, ahora, suelo = null, enTierras = false) {
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
    // lo que se estropea (la carne cruda) dura desde que se terminó
    const rasgos = (t, c) => (seEstropea(t) ? { hasta: c.fin + VIDA[t] } : null);
    for (const c of mios) {
      const rc = RECETAS[c.receta], m = inv.meterDonde(rc.da, rc.n, undefined, rasgos(rc.da, c));
      if (!m.ok && !suelo) { sinSitio = true; continue; }
      cola.splice(cola.indexOf(c), 1);
      if (!m.ok) dados.push({ objeto: rc.da, cantidad: rc.n, alSuelo: suelo.dejar({ tipo: rc.da, n: rc.n, ...(rasgos(rc.da, c) || {}) }, pos.x, pos.z, ahora, autor, !!enTierras).id });
      else dados.push({ objeto: rc.da, cantidad: rc.n, donde: m.donde });
      // lo que da además (la piel de la liebre): donde quepa; si no cabe, a tus pies (o, sin suelo, también a tus pies:
      // a lo que no cupo al cargar, que cae al suelo en cuanto lo hay)
      for (const [t, n] of Object.entries(rc.tambien || {})) {
        const m2 = inv.meterDonde(t, n, undefined, rasgos(t, c));
        if (m2.ok) dados.push({ objeto: t, cantidad: n, donde: m2.donde });
        else if (suelo) dados.push({ objeto: t, cantidad: n, alSuelo: suelo.dejar({ tipo: t, n }, pos.x, pos.z, ahora, autor, !!enTierras).id });
        else { inv.apartado.push({ tipo: t, n }); dados.push({ objeto: t, cantidad: n, apartado: true }); }
      }
    }
    if (!dados.length) return { ok: false, motivo: 'No te cabe: no tienes sitio libre.' };
    return { ok: true, dados, quedan: sinSitio };
  }

  exportar() {
    const copia = l => l.map(c => ({ ...c }));
    return {
      version: VERSION_FABRICACION, siguiente: this.siguiente,
      estaciones: Object.values(this.estaciones).map(e => ({ ...e, cola: copia(e.cola), deposito: { ...e.deposito }, ...(e.obra ? { obra: copiaObra(e.obra) } : {}), ...(e.fuego ? { fuego: { ...e.fuego } } : {}), ...(e.ligadas ? { ligadas: [...e.ligadas] } : {}) })),
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
      this.estaciones[e.id] = { id: e.id, tipo: e.tipo, x: e.x, z: e.z, autor: e.autor, cola: limpia(e.cola).filter(c => RECETAS[c.receta].uso === uso), deposito: limpiarDeposito(e.deposito, e.tipo) };
      if (Number.isFinite(e.y)) this.estaciones[e.id].y = e.y;
      if (Number.isFinite(e.giro)) this.estaciones[e.id].giro = normalGiro(e.giro);
      const ob = limpiarObra(e.obra, e.tipo); if (ob) this.estaciones[e.id].obra = ob;
      else if (ESTACIONES[e.tipo].fuego) this.estaciones[e.id].fuego = e.fuego ? limpiarFuego(e.fuego, e.tipo) : fuegoNuevo(e.tipo); // las de antes del fuego: con sus ramas puestas
      // quién la tiene ligada (solo las camas terminadas; nombres de autor, sin repetir)
      if (!ob && esCama(e.tipo) && Array.isArray(e.ligadas)) {
        const l = [...new Set(e.ligadas.filter(a => typeof a === 'string' && a.length > 0 && a.length <= 64))];
        if (l.length) this.estaciones[e.id].ligadas = l;
      }
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
  3: d => ({ ...d, version: 4, estaciones: (Array.isArray(d.estaciones) ? d.estaciones : []).map(e => e && typeof e === 'object' ? { ...e, deposito: {} } : e) }), // la v4: lo depositado, vacío
  4: d => ({ ...d, version: 5 }), // la v5: las estaciones de antes ya están levantadas (sin obra)
  5: d => ({ ...d, version: 6, estaciones: (Array.isArray(d.estaciones) ? d.estaciones : []).map(e => e && typeof e === 'object' && e.tipo === 'hoguera' && !e.obra && !e.fuego ? { ...e, fuego: fuegoNuevo() } : e) }), // la v6: las hogueras levantadas, apagadas y con sus ramas puestas
};
export function migrarFabricacion(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_FABRICACION) { const paso = MIGRACIONES_FABRICACION[d.version]; if (!paso) return null; d = paso(d); }
  return d && d.version === VERSION_FABRICACION ? d : null;
}

// ---------------- Acciones con autor ----------------
// { autor, tipo: 'colocar_estacion', estacion: tipo, x, z, y?, giro? } — el marco de un puesto (su obra), sin gastar nada
// { autor, tipo: 'entregar_estacion', estacion: id, x, z }   — llevarle a su obra lo que le falta (lo que llevas y el suelo)
// { autor, tipo: 'trabajar_estacion', estacion: id, segundos, x, z } — un rato de trabajo en su obra
// { autor, tipo: 'quitar_estacion', estacion: id, x, z }     — quitar un marco a medio hacer (lo entregado, al suelo)
// { autor, tipo: 'desmontar_estacion', estacion: id, x, z }  — desmontarla (terminada: el 75 % y lo guardado, al suelo)
// { autor, tipo: 'fabricar', receta, estacion: id | null, x, z }   — x, z: dónde está el autor (el servidor usará la suya)
// { autor, tipo: 'recoger_fabricado', estacion: id | null, x, z }
// { autor, tipo: 'depositar_estacion', estacion: id, de: ruta, cantidad?, x, z } — de lo que llevas a la estación
// { autor, tipo: 'retirar_estacion', estacion: id, objeto: tipo, cantidad?, x, z } — de la estación a lo que llevas
// { autor, tipo: 'ligar_cama', estacion: id, x, z }          — ligar esa cama (la de antes deja de serlo)
// { autor, tipo: 'dormir', estacion: id, x, z }              — dormir en tu cama ligada
// { autor, tipo: 'encender_fuego', estacion: id, x, z }      — encender su fuego (1 yesca; llevar el taladro de fuego)
// { autor, tipo: 'echar_fuego', estacion: id, objeto: 'rama' | 'lena', x, z } — echarle al fuego una de lo que llevas
// { autor, tipo: 'brasas_fuego', estacion: id, x, z }       — dejarlo en brasas (el hogar); encender_fuego lo aviva
// suelo: el Suelo del mundo (lo da quien valida). ahora: la hora del que valida, nunca la del mensaje. Lo gastado sale
// de lo del autor o del suelo a su lado y lo fabricado va al autor (o a sus pies si no le cabe y hay suelo), nunca a
// otro. enTierras(x, z): si ese sitio es de la tierra del autor. bajoTecho(x, z): si ese sitio está bajo techo (dentro
// de una casa). Se anota en el registro, salga bien o no.
export const OBRA_ESTACION = ['colocar_estacion', 'entregar_estacion', 'trabajar_estacion', 'quitar_estacion', 'desmontar_estacion'];
export const DEL_FUEGO = ['encender_fuego', 'echar_fuego', 'brasas_fuego'];
export const DE_LA_CAMA = ['ligar_cama', 'dormir'];
export const TIPOS_FABRICACION = [...OBRA_ESTACION, 'fabricar', 'recoger_fabricado', 'depositar_estacion', 'retirar_estacion', 'reparar', ...DEL_FUEGO, ...DE_LA_CAMA];
export function ejecutarFabricacion(fab, invs, registro, accion, ahora, suelo = null, enTierras = () => false, bajoTecho = () => false, alMuro = () => null) {
  let res;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64 && !(v in Object.prototype);
  const est = v => v === null || v === undefined || txt(v);
  if (!a || typeof a !== 'object') res = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) res = { ok: false, motivo: 'Acción sin autor.' };
  else if (!TIPOS_FABRICACION.includes(a.tipo)) res = { ok: false, motivo: 'Acción desconocida.' };
  else if (!Number.isFinite(a.x) || !Number.isFinite(a.z) || !est(a.estacion) || (a.tipo === 'fabricar' && !txt(a.receta))
    || ((a.tipo === 'depositar_estacion' || a.tipo === 'retirar_estacion') && (!txt(a.estacion) || (a.cantidad !== undefined && a.cantidad !== null && !Number.isInteger(a.cantidad))))
    || (a.tipo === 'reparar' && (!txt(a.estacion) || !txt(a.de))) || (a.tipo === 'depositar_estacion' && !txt(a.de)) || (a.tipo === 'retirar_estacion' && !txt(a.objeto))
    || ((OBRA_ESTACION.includes(a.tipo) || DEL_FUEGO.includes(a.tipo) || DE_LA_CAMA.includes(a.tipo)) && !txt(a.estacion)) || (a.tipo === 'echar_fuego' && !txt(a.objeto)) || (a.tipo === 'trabajar_estacion' && !Number.isFinite(a.segundos))
    || (a.tipo === 'colocar_estacion' && a.y !== undefined && a.y !== null && !Number.isFinite(a.y))
    || (a.tipo === 'colocar_estacion' && a.giro !== undefined && a.giro !== null && !Number.isFinite(a.giro))) res = { ok: false, motivo: 'Datos no válidos.' };
  else if (!Number.isFinite(ahora)) res = { ok: false, motivo: 'Sin hora.' };
  else {
    const inv = invs.de(a.autor), pos = { x: a.x, z: a.z };
    if (a.tipo === 'colocar_estacion') {
      // lo que va colgado (muro: true): pegado a la cara de un muro lleno de la planta baja, mirando a la habitación
      const m = tiene(ESTACIONES, a.estacion) && ESTACIONES[a.estacion].muro ? alMuro(a.x, a.z) : undefined;
      if (m === null || (m && Math.hypot(m.x - a.x, m.z - a.z) > 0.15)) res = { ok: false, motivo: MOTIVO_MURO(ESTACIONES[a.estacion].nombre) };
      else if (m) res = fab.colocar(a.autor, a.estacion, m.x, m.z, !!bajoTecho(m.x, m.z), Number.isFinite(a.y) ? a.y : null, !!enTierras(m.x, m.z), m.giro);
      else res = fab.colocar(a.autor, a.estacion, a.x, a.z, !!bajoTecho(a.x, a.z), Number.isFinite(a.y) ? a.y : null, !!enTierras(a.x, a.z), Number.isFinite(a.giro) ? a.giro : null);
    }
    else if (a.tipo === 'entregar_estacion') res = fab.entregarEstacion(a.autor, a.estacion, pos, inv, suelo, ahora);
    else if (a.tipo === 'trabajar_estacion') res = fab.trabajarEstacion(a.autor, a.estacion, a.segundos, pos, inv);
    else if (a.tipo === 'desmontar_estacion') { const e = fab.estaciones[a.estacion]; res = fab.desmontarEstacion(a.autor, a.estacion, pos, suelo, ahora, suelo && e ? enTierras(e.x, e.z) : false); }
    else if (a.tipo === 'quitar_estacion') { const e = fab.estaciones[a.estacion]; res = fab.quitarEstacion(a.autor, a.estacion, pos, suelo, ahora, suelo && e ? enTierras(e.x, e.z) : false); }
    else if (a.tipo === 'depositar_estacion') res = fab.depositar(a.autor, a.estacion, a.de, a.cantidad, pos, inv);
    else if (a.tipo === 'reparar') res = fab.reparar(a.autor, a.estacion, a.de, pos, inv);
    else if (a.tipo === 'retirar_estacion') res = fab.retirar(a.autor, a.estacion, a.objeto, a.cantidad, pos, inv);
    else if (a.tipo === 'encender_fuego') res = fab.encenderFuego(a.autor, a.estacion, pos, inv, ahora);
    else if (a.tipo === 'echar_fuego') res = fab.echarFuego(a.autor, a.estacion, a.objeto, pos, inv, ahora);
    else if (a.tipo === 'ligar_cama') { const e = fab.estaciones[a.estacion]; res = fab.ligarCama(a.autor, a.estacion, pos, e ? !!enTierras(e.x, e.z) : false); }
    else if (a.tipo === 'dormir') res = fab.dormir(a.autor, a.estacion, pos);
    else if (a.tipo === 'brasas_fuego') res = fab.brasasFuego(a.autor, a.estacion, pos, ahora);
    else if (a.tipo === 'fabricar') res = fab.fabricar(a.autor, a.receta, a.estacion || null, pos, inv, suelo, ahora);
    else res = fab.recoger(a.autor, a.estacion || null, pos, inv, ahora, suelo, suelo ? enTierras(a.x, a.z) : false);
  }
  const e = registro.anotar(accion || {}, res);
  e.ahora = ahora;
  if (res.ok) {
    e.resultado = res.reparado ? { estacion: res.estacion, reparado: { ...res.reparado } } : res.ligada ? { estacion: res.estacion, ligada: true } : res.dormir ? { estacion: res.estacion, dormir: true } : res.brasas ? { estacion: res.estacion, brasas: true, hasta: res.hasta } : res.echado ? { estacion: res.estacion, echado: { ...res.echado }, ...(res.encendida ? { ardiendo: true } : {}) }
      : res.gastado ? { estacion: res.estacion, encendida: true, hasta: res.hasta, gastado: { ...res.gastado }, ...(res.avivada ? { avivada: true } : {}) }
      : res.quitada ? { estacion: res.estacion, quitada: true, devuelto: { ...res.devuelto } } : res.desmontada ? { estacion: res.estacion, desmontada: true, devuelto: { ...res.devuelto }, guardado: { ...res.guardado } } : res.entregado ? { estacion: res.estacion, entregado: { ...res.entregado } }
      : res.progreso !== undefined ? { estacion: res.estacion, progreso: +res.progreso.toFixed(3), ...(res.terminada ? { terminada: true } : {}) }
      : res.dejado ? { estacion: res.estacion, dejado: { ...res.dejado } } : res.cogido ? { estacion: res.estacion, cogido: { ...res.cogido } } : res.id ? { estacion: res.id, ...(res.obra ? { obra: true } : {}) } : res.encargo ? { receta: res.encargo.receta, fin: res.encargo.fin, ...(res.estacion ? { estacion: res.estacion } : {}) } : { dados: res.dados.map(d => d.alSuelo ? [d.objeto, d.cantidad, d.alSuelo] : [d.objeto, d.cantidad]) };
    if (res.usado && res.usado.estacion) e.resultado.deLaEstacion = { ...res.usado.estacion };
    if (res.usado && Object.keys(res.usado.suelo).length) e.resultado.delSuelo = JSON.parse(JSON.stringify(res.usado.suelo));
  }
  return res;
}
