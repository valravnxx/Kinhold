// Kinhold — el arma es lo que llevas en la mano (valravnx, 9 nov: «modo arma tendría que ser modo emplear el equipo que
// tengas en la mano»; antes, en el modo arma salía siempre la espada larga de pruebas). Lógica pura: la usan el servidor
// (que pone el arma de cada luchador desde su inventario, sin preguntar al navegador) y el navegador (para dibujarla).
//
// Cada cosa que sirve para pelear, con su arma del combate (src/combate/logica.js, ARMAS). Con las manos vacías, o con
// algo que no es un arma (cordel, juncos…), puños (valravnx, 9 nov). Mira primero la mano derecha y luego la izquierda.
// La piedra (valravnx, 9 nov: «con piedra en mano, se puede lanzar gastándola»; y luego: «la piedra sí queda en el suelo,
// igual que con la lanza, queda donde cae») solo se lanza: cada una que lanzas sale de la mano y queda donde cae. La lanza
// endurecida clava y se lanza (al lanzarla sale de la mano y cae al suelo, para recogerla).
//
// Decisiones provisionales (registro de la demo y diario, 9 nov): la lasca de sílex es un cuchillo; el palo cavador,
// la vara, la rama y la antorcha son palo.
export const ARMA_DE = {
  hacha_mano: 'hacha', hacha_piedra: 'hacha', hacha_hierro: 'hacha',
  cuchillo: 'cuchillo', lasca_silex: 'cuchillo',
  mazo_piedra: 'mazo',
  palo_cavador: 'palo', vara: 'palo', rama: 'palo', antorcha: 'palo',
  lanza_endurecida: 'lanza',
  piedra: 'piedras',
  espada: 'espada_larga',
};
export const MANOS = ['mano:der', 'mano:izq'];

// El arma de lo que se lleva en las manos (lugares del inventario): { arma, objeto, mano } (objeto y mano, null con puños).
export function armaDeMano(lugares) {
  for (const mano of MANOS) {
    const c = lugares && lugares[mano];
    if (c && Object.hasOwn(ARMA_DE, c.tipo)) return { arma: ARMA_DE[c.tipo], objeto: c.tipo, mano };
  }
  return { arma: 'punos', objeto: null, mano: null };
}

// Lo que se lanza ahora: { mano, objeto, cuanto: 1, gasta } o null. La lanza sale entera de la mano; la piedra, una de
// la pila. Las dos caen al suelo donde acaban (gasta: false; lo que se gastara del todo, true).
export function loQueSeLanza(lugares) {
  const a = armaDeMano(lugares);
  if (a.objeto === 'lanza_endurecida') return { mano: a.mano, objeto: a.objeto, cuanto: 1, gasta: false };
  if (a.objeto === 'piedra') return { mano: a.mano, objeto: a.objeto, cuanto: 1, gasta: false };
  return null;
}
