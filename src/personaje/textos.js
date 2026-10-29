// Textos de las opciones del visor de personaje (en español; la traducción está en src/idiomas/).
// Van aparte para que la prueba de idiomas los pueda leer sin navegador.
export const BASES = { quaternius: 'Paquete Quaternius', makehuman: 'Taller propio (MakeHuman)' };
export const CAPAS = { tunica: 'Túnica', vestido: 'Vestido', gambeson: 'Gambesón', cota: 'Cota de malla', sobreveste: 'Sobreveste', manto: 'Capa',
  capucha: 'Capucha', sombrero: 'Sombrero de paja', toca: 'Toca', botas: 'Botas', descalzo: 'Descalzo' };
export const ANIMS = { quieto: 'Quieto', andar: 'Andar', correr: 'Correr', talar: 'Talar', guardia: 'En guardia', golpe: 'Golpe', cargar: 'Cargar' };
// tabla de lo que frena la ropa (filas: zona que se mira; columnas: tipo de golpe de src/logica/prendas.js)
export const ZONAS_TABLA = [['Cabeza', 'cabeza'], ['Torso', 'torso'], ['Brazos', 'brazoD'], ['Piernas', 'piernaD']];
export const GOLPES_TABLA = [['Corte', 'corte'], ['Estocada', 'perforante'], ['Contundente', 'contundente']];
