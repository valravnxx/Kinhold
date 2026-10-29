// Kinhold — niveles de detalle de los personajes (lógica pura, sin three.js).
// Cuánto detalle lleva un personaje según lo alto que sale en pantalla (en píxeles), no según los metros: así vale
// igual en PC y en móvil y con cualquier cámara. Cerca, entero; a media distancia, con menos triángulos y sin
// ojos (de un píxel); lejos, con
// muchos menos, sin calcos de pelo y en una sola malla con las texturas juntas (una llamada de dibujo); más
// lejos que eso, ya no se dibuja (la niebla lo tapa). Para no ir y venir de un nivel a otro en el borde, se cambia
// con un margen.

// alto: lo menos que mide en pantalla para llevar ese nivel (px). proporcion: los triángulos que se quedan de cada
// pieza; error: lo que se puede mover la forma al simplificar (en partes del tamaño de la pieza). cada: cada cuántos
// fotogramas se mueven los huesos (lejos, la mitad de veces no se nota y ahorra tiempo).
export const NIVELES = [
  { nombre: 'cerca', alto: 90, proporcion: 1, error: 0, ojos: true, calcos: true, juntar: false, cada: 1 },
  { nombre: 'medio', alto: 40, proporcion: 0.4, error: 0.01, ojos: false, calcos: true, juntar: false, cada: 1 },
  { nombre: 'lejos', alto: 6, proporcion: 0.15, error: 0.02, ojos: false, calcos: false, juntar: true, cada: 2 },
];
export const OCULTO = NIVELES.length; // más pequeño que el último: no se dibuja
export const MARGEN = 0.12; // para volver a un nivel con más detalle hay que crecer un 12 % más del umbral
export const ALTO_PERSONA = 1.75; // m

// lo alto que sale en pantalla (px) algo de `alto` metros a `distancia` m, con la cámara de `fov` grados (vertical)
// en una pantalla de `altoPantalla` px
export function pixelesEnPantalla(distancia, altoPantalla, fov, alto = ALTO_PERSONA) {
  const d = Math.max(distancia, 0.01);
  return altoPantalla * alto / (2 * d * Math.tan(fov * Math.PI / 360));
}

// el nivel que toca con `px` en pantalla, sabiendo el de ahora (para el margen)
export function nivelDetalle(px, actual = 0) {
  let n = NIVELES.findIndex(v => px >= v.alto);
  if (n < 0) n = OCULTO;
  // hacia más detalle (n < actual), solo si pasa del umbral con margen; hacia menos, en cuanto baja del suyo
  while (n < actual && px < NIVELES[n].alto * (1 + MARGEN)) n++;
  return n;
}

// distancia (m) a la que se pasa de cada nivel al siguiente, para una pantalla y una cámara (para enseñarlo)
// fuera de la vista de la cámara tampoco se dibuja (ni se mueven sus huesos); con un margen, por su sombra
export const RADIO_VISTA = 2.5; // m alrededor del centro del personaje

export function distanciasDeCambio(altoPantalla, fov, alto = ALTO_PERSONA) {
  return NIVELES.map(v => altoPantalla * alto / (2 * v.alto * Math.tan(fov * Math.PI / 360)));
}
