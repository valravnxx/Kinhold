// Kinhold — el hilo aparte (Web Worker) que hace los trozos del terreno: recibe el mapa una vez, monta el paisaje y,
// por cada trozo que se le pide, devuelve su suelo listo para dibujar (trozo_suelo.js), moviendo los búferes sin
// copiarlos. Así el hilo de dibujo no se para mientras se calculan alturas, colores y normales.
// Mensajes que recibe: { tipo: 'mapa', mapa }, { tipo: 'marcas', marcas } (el suelo nivelado para construir, en metros
// del mundo: src/logica/nivelado.js) y { tipo: 'trozo', id, i, j, paso }.
// Mensajes que manda: { tipo: 'listo', ms } y { tipo: 'trozo', id, ...suelo } (o { tipo: 'error', id, texto }).
import { crearPaisaje } from '../logica/paisaje.js';
import { hacerSueloTrozo, buferesDe } from './trozo_suelo.js';

let paisaje = null, marcas = [];
self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.tipo === 'mapa') {
      const t0 = performance.now();
      paisaje = crearPaisaje(m.mapa);
      self.postMessage({ tipo: 'listo', ms: performance.now() - t0 });
    } else if (m.tipo === 'marcas') {
      marcas = m.marcas || [];
    } else if (m.tipo === 'trozo') {
      const r = hacerSueloTrozo(paisaje, m.i, m.j, m.paso, { marcas });
      self.postMessage({ tipo: 'trozo', id: m.id, ...r }, buferesDe(r));
    }
  } catch (er) {
    self.postMessage({ tipo: 'error', id: m.id, texto: String(er && er.stack || er) });
  }
};
