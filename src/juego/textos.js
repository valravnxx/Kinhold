// Textos de la interfaz. Español completo; inglés y ruso se añaden en sus diccionarios.
const ES = {
  yaMojon: 'Ya tienes un mojón.',
  faltanMateriales: 'Faltan materiales.',
  primeroMojon: 'Primero coloca tu mojón.',
  fueraTierra: 'Fuera de tu tierra.',
  puntoDebil: 'Punto débil',
  nuevaConstruccion: 'Primera pieza: fija la rejilla de una construcción nueva. Gira con R o el botón Girar.',
  recuperas75: 'recuperas el 75% del material',
  caeran: 'caerán',
  caera1: 'caerá 1 pieza que tiene encima (se destruye)',
  destruida1: 'pieza destruida',
  piezasEncima: 'piezas que tiene encima (se destruyen)',
  desmontado: 'Desmontado',
  destruidas: 'piezas destruidas',
  planta: 'Planta',
  nadaQueUsar: 'No hay nada que usar cerca.',
  abierta: 'Abierta.',
  cerrada: 'Cerrada.',
  subes: 'Subes a la planta',
  bajas: 'Bajas a la planta',
  sinSueloArriba: 'No hay suelo arriba al que subir.',
  catTierra: 'Tierra', catBase: 'Base', catEstructura: 'Estructura', catMuros: 'Muros',
  catTejados: 'Tejados', catAcceso: 'Acceso', catExterior: 'Exterior', catDeco: 'Decoración',
  consejoMojon: 'Pulsa Construir → Tierra → Mojón para reclamar tu tierra.',
  confirmaReinicio: '¿Seguro? Pulsa otra vez para borrar todo.',
};
const EN = {};
const RU = {};
const DICC = { es: ES, en: EN, ru: RU };
let idioma = 'es';
export function ponerIdioma(i) { if (DICC[i]) idioma = i; }
export function t(k) { return (DICC[idioma] && DICC[idioma][k]) || ES[k] || k; }
