// Kinhold — el chat de texto (valravnx, 6 nov: «vamos a poner chat de texto ya, debe verse sobre el jugador, y
// desaparecer al rato»). Lógica pura (sin three.js ni DOM): la usan el servidor (comprueba y reparte) y el navegador
// (el bocadillo sobre la cabeza). Lo que se dice pasa por el servidor con su autor, como toda acción que llega a otros:
//   - limpiarTexto: sin caracteres de control, sin espacios de sobra, como mucho LARGO_MAX letras; vacío no vale.
//   - LimitadorCharla: como mucho una frase cada ESPERA_MIN ms y RAFAGA en VENTANA ms por autor (sin mandar a chorro).
//   - quienOye: le llega a quien está a ALCANCE m o menos del que habla (y a él mismo).
//   - duracionBocadillo: lo que se ve el bocadillo, más cuanto más largo (entre 4 y 12 s); luego se va.
//   - FRASES: las ocho frases rápidas (estudio de la interfaz, aprobado el 7 nov: «ocho frases rápidas que llegan a cada
//     uno en su lengua»). Por la red va solo su número ({ tipo: 'decir', frase }); cada navegador la pone en su idioma.

export const LARGO_MAX = 120;      // letras como mucho por frase
export const ALCANCE = 50;         // m: quien está más lejos no lo oye (ni ve el bocadillo)
export const ESPERA_MIN = 1000;    // ms entre dos frases del mismo
export const RAFAGA = 6;           // frases como mucho…
export const VENTANA = 20000;      // …en estos ms
export const MOTIVO_VACIO = 'Ese mensaje está vacío o no vale.';
export const MOTIVO_DESPACIO = 'Más despacio: espera un poco antes de volver a hablar.';

// El texto tal como se dice, o null si no vale. Se quitan los caracteres de control y los invisibles de dirección (con
// ellos se podía dar la vuelta a lo que se lee), los saltos de línea pasan a espacio y se recorta por letras (no por
// unidades de UTF-16: un emoji no se parte por la mitad).
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g;
export function limpiarTexto(t) {
  if (typeof t !== 'string' || t.length > LARGO_MAX * 8) return null;
  const s = t.replace(/[\r\n\t]+/g, ' ').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const letras = Array.from(s);
  return letras.length > LARGO_MAX ? letras.slice(0, LARGO_MAX).join('').trim() : s;
}

// Las ocho frases rápidas, en español (la clave de la traducción: src/idiomas/*.json). El orden es su número en la red:
// no se cambia ni se quita ninguna (un navegador viejo diría otra cosa); las nuevas, al final.
export const FRASES = Object.freeze(['¡Hola!', 'Sí', 'No', 'Gracias', 'Ven aquí', 'Espera', '¡Ayuda!', '¡Cuidado!']);
// el número de una frase rápida, o null si no es ninguna
export const validarFrase = (n) => (Number.isInteger(n) && n >= 0 && n < FRASES.length ? n : null);

// cuánto se ve el bocadillo (ms): 4 s y 70 ms por letra, como mucho 12 s (la frase más larga, 120 letras, llega al tope)
export const duracionBocadillo = (texto) => Math.min(12000, 4000 + 70 * Array.from(texto || '').length);

// por autor: las horas (ms) de sus últimas frases
export class LimitadorCharla {
  constructor({ espera = ESPERA_MIN, rafaga = RAFAGA, ventana = VENTANA } = {}) { this.espera = espera; this.rafaga = rafaga; this.ventana = ventana; this.horas = new Map(); }
  // ¿puede decir algo ahora? (si puede, cuenta)
  admitir(autor, ahora) {
    const h = (this.horas.get(autor) || []).filter(t => ahora - t < this.ventana);
    if ((h.length && ahora - h[h.length - 1] < this.espera) || h.length >= this.rafaga) { this.horas.set(autor, h); return false; }
    h.push(ahora); this.horas.set(autor, h);
    return true;
  }
  quitar(autor) { this.horas.delete(autor); }
}

// a quién le llega lo que dice `autor`: posiciones = Map autor → { x, z }. Él siempre (si está); los demás, a ALCANCE m
export function quienOye(autor, posiciones, alcance = ALCANCE) {
  const yo = posiciones.get(autor);
  const oyen = [];
  for (const [a, p] of posiciones) {
    if (a === autor) { oyen.push(a); continue; }
    if (yo && p && Math.hypot(p.x - yo.x, p.z - yo.z) <= alcance) oyen.push(a);
  }
  if (!posiciones.has(autor)) oyen.push(autor);
  return oyen;
}

// lo que reparte el servidor ({ tipo: 'dicho', autor, texto } o, si es una frase rápida, { tipo: 'dicho', autor, frase }),
// comprobado otra vez al llegar al navegador: { autor, texto } o { autor, frase }
export function validarDicho(m) {
  if (!m || typeof m.autor !== 'string' || !m.autor || m.autor.length > 64) return null;
  if (m.frase !== undefined) { const frase = validarFrase(m.frase); return frase === null ? null : { autor: m.autor, frase }; }
  const texto = limpiarTexto(m.texto);
  return texto ? { autor: m.autor, texto } : null;
}
