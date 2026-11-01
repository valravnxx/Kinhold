// Kinhold — el personaje elegido en el visor de personaje, para usarlo en la construcción y en el duelo.
// Lo guarda el visor (src/personaje/main.js) en el navegador con la clave kinhold_personaje_v2.
// Se pasan el cuerpo (hombre o mujer), la ropa por capas y el aspecto (forma, colores, peinado y barba).
import { normalizarAspecto } from '../logica/aspecto.js';
export const CLAVE_PERSONAJE = 'kinhold_personaje_v2';

// La carpeta de los personajes del taller propio que usan la construcción, el duelo y el visor del mapa (las versiones
// publicadas viven en jugar/<prototipo>/ y los modelos en recursos/personajes/taller-vN/; las anteriores no se tocan).
// Se puede cambiar con ?recursosMH= para las pruebas. Un solo sitio: al publicar un taller nuevo se cambia aquí.
export const TALLER = 'taller-v21';
export const recursosTaller = () => new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/' + TALLER + '/';

// la misma regla que el visor: si no se ha tocado la ropa, túnica en el hombre y vestido en la mujer
export const capasPorDefecto = (sexo) => [sexo === 'mujer' ? 'vestido' : 'tunica'];

// { sexo, capas, aspecto, tintes, hechuras } del personaje elegido; null si nunca se ha elegido (se queda lo de cada prototipo)
export function personajeElegido() {
  let e = null;
  try { e = JSON.parse(localStorage.getItem(CLAVE_PERSONAJE) || 'null'); } catch (err) { return null; }
  if (!e || typeof e !== 'object') return null;
  const sexo = e.sexo === 'mujer' ? 'mujer' : 'hombre';
  const lista = e.capas && Array.isArray(e.capas[sexo]) ? e.capas[sexo] : capasPorDefecto(sexo);
  // los tintes y la hechura de la ropa elegida en el visor (desde el personaje v22 y v23), tal cual: los limpia quien los usa
  const de = (k) => e[k] && typeof e[k] === 'object' && e[k][sexo] && typeof e[k][sexo] === 'object' ? e[k][sexo] : undefined;
  return { sexo, capas: lista.filter(c => typeof c === 'string'), aspecto: normalizarAspecto(e.aspecto && e.aspecto[sexo], sexo), tintes: de('tintes'), hechuras: de('hechuras') };
}

// Capas del luchador en el duelo: la armadura manda (lo que protege es lo que se ve). Con «lino» va la ropa
// elegida sin piezas de armadura; con gambesón o cota, esas piezas y, si se eligió, la sobreveste por encima.
export function capasDuelo(elegidas, armadura, CAPAS_ARMADURA) {
  const armas = ['gambeson', 'cota'];
  if (armadura === 'lino' || !CAPAS_ARMADURA[armadura]) return elegidas.filter(c => !armas.includes(c));
  // lo que no es armadura (sobreveste, capa, tocado, botas) se queda como se eligió
  const encima = ['sobreveste', 'manto', 'capucha', 'sombrero', 'toca', 'botas'];
  return [...CAPAS_ARMADURA[armadura], ...elegidas.filter(c => encima.includes(c))];
}
