// Prueba de los niveles de detalle de los personajes (src/logica/detalle.js), sin navegador.
// MUTAR=1 rompe el margen a propósito para comprobar que la prueba lo detecta.
import { NIVELES, OCULTO, MARGEN, nivelDetalle, pixelesEnPantalla, distanciasDeCambio } from '../src/logica/detalle.js';

let ok = 0, mal = 0;
const comprobar = (c, txt) => { if (c) ok++; else { mal++; console.log('MAL:', txt); } };
const nivel = process.env.MUTAR ? (px) => nivelDetalle(px, 0) : nivelDetalle;

// los niveles van de más a menos detalle
for (let i = 1; i < NIVELES.length; i++) {
  comprobar(NIVELES[i].alto < NIVELES[i - 1].alto, `umbral del nivel ${i} menor que el del ${i - 1}`);
  comprobar(NIVELES[i].proporcion < NIVELES[i - 1].proporcion, `el nivel ${i} lleva menos triángulos`);
}
comprobar(NIVELES[0].proporcion === 1 && NIVELES[0].ojos && NIVELES[0].calcos && !NIVELES[0].juntar, 'de cerca, entero');
comprobar(NIVELES[NIVELES.length - 1].juntar, 'el último nivel junta las piezas en una malla');

// lo alto en pantalla: 1,75 m a 16 m con 45° en 800 px (la cámara de la demo) son unos 106 px
const px16 = pixelesEnPantalla(16, 800, 45);
comprobar(Math.abs(px16 - 105.6) < 1, `a 16 m salen ${px16.toFixed(1)} px`);
comprobar(nivelDetalle(px16, 0) === 0, 'el jugador, a la distancia normal de la cámara, sale entero');
comprobar(pixelesEnPantalla(32, 800, 45) < px16 / 1.99, 'al doble de distancia, la mitad de alto');

// sin margen, de lejos a cerca
comprobar(nivelDetalle(200, 0) === 0 && nivelDetalle(50, 0) === 1 && nivelDetalle(10, 0) === 2 && nivelDetalle(3, 0) === OCULTO, 'el nivel según el alto');
// el margen: justo por encima del umbral no se vuelve al nivel con más detalle
const u = NIVELES[0].alto;
comprobar(nivel(u + 1, 1) === 1, 'con 1 px más que el umbral sigue en el nivel medio (margen)');
comprobar(nivel(u * (1 + MARGEN) + 0.1, 1) === 0, 'pasado el margen, vuelve a cerca');
comprobar(nivel(u - 0.1, 0) === 1, 'hacia menos detalle, en cuanto baja del umbral');
comprobar(nivel(NIVELES[2].alto + 0.2, OCULTO) === OCULTO, 'el oculto no reaparece justo en el borde');
comprobar(nivel(u + 2, OCULTO) === 1, 'de oculto a mucho más cerca de golpe, con el margen del nivel que toca');
// ir y venir en el borde no cambia de nivel a cada paso
let n = 0, cambios = 0;
for (let i = 0; i < 200; i++) { const px = u + Math.sin(i) * 3; const m = nivel(px, n); if (m !== n) cambios++; n = m; }
comprobar(cambios <= 2, `ir y venir 3 px por el borde: ${cambios} cambios`);

// las distancias de cambio salen ordenadas
const d = distanciasDeCambio(800, 45);
comprobar(d[0] < d[1] && d[1] < d[2], 'distancias de cambio ordenadas: ' + d.map(x => x.toFixed(0)).join(', ') + ' m');

console.log(`Niveles de detalle: ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
