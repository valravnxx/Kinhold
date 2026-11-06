// Kinhold — Strandvang, tierras del rey (valravnx, 31 oct). Lógica pura (sin three.js): la usan el servidor, para
// rechazar los golpes, y el navegador, para avisar al entrar y al salir, con la misma cuenta.
//
// Whitholm es la isla del rey y Strandvang (la comarca E) su dominio, con su ciudad: ahí nadie puede herir a otro
// jugador. El servidor rechaza el golpe o la flecha (queda en el registro de combate con su autor y el motivo) y no hay
// herida; los duelos contra NPCs (el rival de práctica) sí valen.
//
// Decisión provisional (1 nov, anotada en el registro de decisiones y en el diario): cuenta dónde están los dos. Basta
// con que el que ataca o el que recibe esté en Strandvang para que no haya herida, así no se puede herir desde fuera a
// quien está dentro (con una flecha por encima de la frontera) ni salir a herir desde dentro y volver.
// Lo que dice qué comarca es cada sitio es comarcaEn (src/logica/comarcas.js): sus zonas, como el mapa del rey.

export const COMARCA_REY = 'E';
export const MOTIVO_TIERRAS = 'En Strandvang, tierras del rey, nadie puede herir a otro jugador.';
export const RESULTADO_TIERRAS = 'tierras del rey';

// comarcas: la de crearComarcas(mapa). origen: el 0 de la escena en m del mundo (SALIDA en línea, la salida de cada uno
// en el navegador). Devuelve en(x, z) con coordenadas de la escena.
export function crearTierrasRey(comarcas, origen = { x: 0, z: 0 }) {
  const k = comarcas.letras.indexOf(COMARCA_REY);
  const nombre = k >= 0 ? comarcas.nombres[k] : COMARCA_REY;
  const en = (x, z) => Number.isFinite(x) && Number.isFinite(z) && comarcas.comarcaEn(x + origen.x, z + origen.z) === COMARCA_REY;
  return { nombre, en };
}

// ¿Se rechaza que A hiera a B? A y B: luchadores (src/combate/logica.js) con x, z de la escena. Los NPCs (npc: true)
// no cuentan. Devuelve el motivo o null.
export function motivoProtegido(en, A, B) {
  if (!en || !A || !B || A.npc || B.npc) return null;
  return en(A.x, A.z) || en(B.x, B.z) ? MOTIVO_TIERRAS : null;
}

// Para avisar al entrar y al salir: lleva si estabas dentro y devuelve 'entra', 'sale' o null cuando cambia.
export function vigiaTierras(en) {
  let dentro = null;
  return {
    get dentro() { return dentro; },
    mirar(x, z) {
      const ahora = en(x, z);
      if (dentro === ahora) return null;
      const antes = dentro; dentro = ahora;
      if (antes === null) return ahora ? 'entra' : null;   // al aparecer: solo si apareces dentro
      return ahora ? 'entra' : 'sale';
    },
  };
}
