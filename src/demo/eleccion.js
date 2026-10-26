// Kinhold — el personaje elegido en el visor de personaje, para usarlo en la construcción y en el duelo.
// Lo guarda el visor (src/personaje/main.js) en el navegador con la clave kinhold_personaje_v2.
// Por ahora el taller solo cambia el cuerpo (hombre o mujer) y la ropa por capas: es lo único que se pasa.
export const CLAVE_PERSONAJE = 'kinhold_personaje_v2';

// la misma regla que el visor: si no se ha tocado la ropa, túnica en el hombre y vestido en la mujer
export const capasPorDefecto = (sexo) => [sexo === 'mujer' ? 'vestido' : 'tunica'];

// { sexo, capas } del personaje elegido; null si nunca se ha elegido (se queda lo de cada prototipo)
export function personajeElegido() {
  let e = null;
  try { e = JSON.parse(localStorage.getItem(CLAVE_PERSONAJE) || 'null'); } catch (err) { return null; }
  if (!e || typeof e !== 'object') return null;
  const sexo = e.sexo === 'mujer' ? 'mujer' : 'hombre';
  const lista = e.capas && Array.isArray(e.capas[sexo]) ? e.capas[sexo] : capasPorDefecto(sexo);
  return { sexo, capas: lista.filter(c => typeof c === 'string') };
}

// Capas del luchador en el duelo: la armadura manda (lo que protege es lo que se ve). Con «lino» va la ropa
// elegida sin piezas de armadura; con gambesón o cota, esas piezas y, si se eligió, la sobreveste por encima.
export function capasDuelo(elegidas, armadura, CAPAS_ARMADURA) {
  const armas = ['gambeson', 'cota'];
  if (armadura === 'lino' || !CAPAS_ARMADURA[armadura]) return elegidas.filter(c => !armas.includes(c));
  return [...CAPAS_ARMADURA[armadura], ...(elegidas.includes('sobreveste') ? ['sobreveste'] : [])];
}
