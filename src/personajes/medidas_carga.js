// Kinhold — medidas que comparten las animaciones de cargar del taller (herramientas/taller/hacer_cargas.mjs) y lo
// que se dibuja encima del personaje (src/juego/llevado.js). Sin three.js ni nada más: lo leen los dos lados.
//
// El tronco corto al hombro (revisión del 1 nov: «tiene que ir apoyado sobre un hombro, al lado de la cabeza, con la
// mano encima»): su centro respecto a la articulación del hombro derecho (upperarm_r), en m y en los ejes del cuerpo
// (+X izquierda, +Y arriba, +Z delante), con la postura de estar quieto; `r`, su radio. Encima del hombro y algo por
// fuera, para que no toque la cabeza; un poco por detrás. Decisión provisional, mirando las capturas.
export const TRONCO_HOMBRO = { x: -0.045, y: 0.14, z: -0.04, r: 0.1 };
// Dónde va la muñeca derecha que lo sujeta, respecto al centro del tronco: por delante del hombro, encima y algo por fuera (la palma encima y los dedos por encima, hacia dentro)
export const MANO_TRONCO = { x: -0.04, y: 0.115, z: 0.24 };
