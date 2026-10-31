// Textos de las opciones del visor de personaje (en español; la traducción está en src/idiomas/).
// Van aparte para que la prueba de idiomas los pueda leer sin navegador.
export const BASES = { quaternius: 'Paquete Quaternius', makehuman: 'Taller propio (MakeHuman)' };
export const CAPAS = { tunica: 'Túnica', vestido: 'Vestido', gambeson: 'Gambesón', cota: 'Cota de malla', sobreveste: 'Sobreveste', manto: 'Capa',
  capucha: 'Capucha', sombrero: 'Sombrero de paja', toca: 'Toca', botas: 'Botas', descalzo: 'Descalzo' };
export const ANIMS = { quieto: 'Quieto', andar: 'Andar', correr: 'Correr', talar: 'Talar', guardia: 'En guardia', golpe: 'Golpe', cargar: 'Cargar' };
// las 39 extra (src/personajes/cargar.js: CLIPS_EXTRA, y la otra versión de parar), en el taller propio
export const ANIMS_EXTRA = {
  vendarse: 'Vendarse', apuntar: 'Apuntar con el arco', apuntarArriba: 'Apuntar hacia arriba', apuntarAbajo: 'Apuntar hacia abajo', flecha: 'Poner la flecha', disparar: 'Disparar',
  minar: 'Picar', cogerFruta: 'Coger fruta', sembrarVoleo: 'Sembrar a voleo', plantar: 'Plantar', regar: 'Regar',
  lanzarCana: 'Lanzar la caña', pescar: 'Pescar', recogerSedal: 'Recoger el sedal',
  golpeLigero1: 'Golpe ligero 1', golpeLigero2: 'Golpe ligero 2', golpeLigero3: 'Golpe ligero 3', golpeLigero4: 'Golpe ligero 4',
  golpePesado1: 'Golpe pesado 1', golpePesado2: 'Golpe pesado 2', golpePesado3: 'Golpe pesado 3', golpePesado4: 'Golpe pesado 4',
  guardiaEscudo: 'Guardia con escudo', golpeEscudo: 'Golpe de escudo',
  andarAdelante: 'Paso adelante', andarAtras: 'Paso atrás', andarIzquierda: 'Paso a la izquierda', andarDerecha: 'Paso a la derecha', girarIzquierda: 'Media vuelta a la izquierda', girarDerecha: 'Media vuelta a la derecha',
  trepar: 'Trepar', comer: 'Comer', abrirCofre: 'Abrir un arcón', tumbarse: 'Tumbarse', levantarse: 'Levantarse', brazosCruzados: 'Brazos cruzados',
  empujado: 'Empujado', lanzar: 'Lanzar',
  empujar: 'Empujar', cogerDeMesa: 'Coger de una mesa', // solo con taller-anim-v2
  hombro: 'Al hombro', hombroQuieto: 'Al hombro, quieto', arrastrar: 'Arrastrar', // las de taller-carga-v1
  Sword_Block_2: 'Parar con la espada (otra)', // la de las extra que se llama igual que una básica
};
// tabla de lo que frena la ropa (filas: zona que se mira; columnas: tipo de golpe de src/logica/prendas.js)
export const ZONAS_TABLA = [['Cabeza', 'cabeza'], ['Torso', 'torso'], ['Brazos', 'brazoD'], ['Piernas', 'piernaD']];
export const GOLPES_TABLA = [['Corte', 'corte'], ['Estocada', 'perforante'], ['Contundente', 'contundente']];
