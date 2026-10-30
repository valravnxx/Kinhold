// Kinhold — el suelo de un trozo del terreno, listo para dibujar (sin three.js): alturas, triángulos y faldones
// (src/logica/trozos.js) y además lo que antes se hacía en el hilo de dibujo: normales, color por vértice (el del suelo
// de cerca, con la concavidad de las vaguadas) y coordenadas de textura. Lo usa el hilo aparte (trozos_hilo.js); y,
// como no necesita ventana ni three.js, también la prueba en node y, si el navegador no deja hilos, el hilo de dibujo.
//
// Para que los trozos vecinos casen (la misma luz y el mismo color en su borde común), todo sale de una rejilla
// ampliada con BORDE puntos más a cada lado: la pendiente, la concavidad y la normal de un punto del borde se calculan
// con las alturas de verdad del vecino, no recortadas.
import { mallaTrozo, alturaDeTrozo, LADO } from '../logica/trozos.js';
import { colorJuego } from './color_suelo.js';

const BORDE = 3;
const _c = [0, 0, 0];

// paisaje: el de crearPaisaje(mapa); (i, j): el trozo; paso: su rejilla (m).
// Devuelve lo de mallaTrozo (posiciones relativas a la esquina x0, z0) más normales, colores (lineales), uvs, y ms (lo
// que ha tardado).
export function hacerSueloTrozo(paisaje, i, j, paso, { lado = LADO } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const altura = alturaDeTrozo(paisaje, i, j, lado);
  const x0 = i * lado, z0 = j * lado, c = lado / paso, n = c + 1, m = n + 2 * BORDE;
  // la rejilla ampliada: E[(b + BORDE) · m + (a + BORDE)] es la altura del punto (a, b) del trozo, con a y b de -BORDE a
  // n - 1 + BORDE
  const E = new Float32Array(m * m);
  for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) E[b * m + a] = altura(x0 + (a - BORDE) * paso, z0 + (b - BORDE) * paso);
  const en = (a, b) => E[(b + BORDE) * m + a + BORDE];
  // la malla reutiliza las alturas ya hechas; los puntos que no son de la rejilla (los del faldón, a 1 m) se calculan
  const alturaRejilla = (x, z) => {
    const ga = (x - x0) / paso, gb = (z - z0) / paso;
    return Number.isInteger(ga) && Number.isInteger(gb) && ga >= -BORDE && gb >= -BORDE && ga < n + BORDE && gb < n + BORDE ? en(ga, gb) : altura(x, z);
  };
  const malla = mallaTrozo(i, j, paso, alturaRejilla, { lado });
  const { posiciones, superficie } = malla, total = posiciones.length / 3;
  const normales = new Float32Array(total * 3), colores = new Float32Array(total * 3), uvs = new Float32Array(total * 2);
  // vecinos para la pendiente de la forma (unos 3 m), la de aquí mismo (1 m) y la concavidad (2 m), en puntos de rejilla
  const k3 = Math.max(1, Math.min(BORDE, Math.round(3 / paso))), k2 = Math.max(1, Math.min(BORDE, Math.round(2 / paso)));
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const k = b * n + a, y = en(a, b), xm = x0 + a * paso, zm = z0 + b * paso;
    const dx = (en(a + 1, b) - en(a - 1, b)) / (2 * paso), dz = (en(a, b + 1) - en(a, b - 1)) / (2 * paso);
    const l = Math.hypot(dx, 1, dz);
    normales[k * 3] = -dx / l; normales[k * 3 + 1] = 1 / l; normales[k * 3 + 2] = -dz / l;
    const s = Math.hypot(en(a + k3, b) - en(a - k3, b), en(a, b + k3) - en(a, b - k3)) / (2 * k3 * paso);
    const s1 = Math.hypot(dx, dz);
    const lap = (en(a + k2, b) + en(a - k2, b) + en(a, b + k2) + en(a, b - k2) - 4 * y) / (4 * k2 * k2 * paso * paso);
    const st = y > 0.05 ? paisaje.sitio(xm, zm, y) : null;
    colorJuego(st, y, s, s1, lap, xm, zm, _c);
    colores[k * 3] = _c[0]; colores[k * 3 + 1] = _c[1]; colores[k * 3 + 2] = _c[2];
    // la textura va por el mundo (no por el trozo), para que siga sin cortes de un trozo a otro
    uvs[k * 2] = xm * 0.5; uvs[k * 2 + 1] = zm * 0.5;
  }
  // los faldones: la normal, el color y la textura de su punto del borde (no se ven de frente: solo tapan rendijas)
  if (total > superficie) {
    for (let v = superficie; v < total; v++) {
      const a = Math.round(posiciones[v * 3] / paso), b = Math.round(posiciones[v * 3 + 2] / paso), k = b * n + a;
      normales.set(normales.subarray(k * 3, k * 3 + 3), v * 3); colores.set(colores.subarray(k * 3, k * 3 + 3), v * 3);
      uvs[v * 2] = uvs[k * 2]; uvs[v * 2 + 1] = uvs[k * 2 + 1];
    }
  }
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { ...malla, normales, colores, uvs, ms };
}

// lo que se pasa de un hilo a otro sin copiar (los búferes se mueven)
export const buferesDe = (r) => [r.posiciones.buffer, r.normales.buffer, r.colores.buffer, r.uvs.buffer, r.indices.buffer, r.H.buffer];
