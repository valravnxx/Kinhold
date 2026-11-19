// Kinhold — las vetas pequeñas de hierro en el mundo de verdad (P10, «Hierro y tablas», 19 nov). Lógica pura (sin
// three.js): el servidor y el navegador saben dónde está cada una con la misma cuenta.
//
// El GDD: «hay vetas pequeñas de hierro y de carbón por todo el mundo (una de cada en cada zona de unos 14 km), así que
// nadie tiene que irse lejos para lo de diario»; el documento de sistemas: «mineral de hierro de roca — vetas de montaña
// — pico — 1 mineral». El mapa (src/logica/mapa.js) pone una veta pequeña de hierro en cada bloque de 14 km con
// tierra, en la celda de 1 km que mejor le va a la roca. Aquí se busca, dentro de esa celda, el sitio del mundo donde
// aflora: un trozo de ladera (pendiente de 0,15 a 0,6) en seco, sin árboles ni rocas encima, lo más cerca del centro de
// la celda. Allí se ve un afloramiento de roca rojiza y, con el pico, da mineral de hierro (src/logica/recoleccion.js,
// el punto «veta_hierro»; lo dibuja src/juego/recoleccion.js).
//
// Lo que cuesta buscarlas es generar el mapa; por eso los sitios de la isla van apuntados en VETAS_HIERRO (en m del
// mundo), y la prueba (pruebas/prueba_vetas_hierro.mjs) genera el mapa y comprueba que siguen siendo los mismos.
// Decisiones provisionales (19 nov): la gran veta de la sierra no entra aquí (es para explotar a fondo, con mina: otra
// tarea); se busca en una rejilla de 16 m hasta 450 m del centro de la celda, y el sitio queda limpio en 4 m alrededor.
import { dentroDeIsla, ISLA } from './whitholm.js';
import { zonasRecogida } from './recogida_mundo.js';
import { vegetacionTrozo, LADO_VEG } from './vegetacion.js';
import { enZonaCastillo } from './castillo_rey.js';

export const BUSCAR_VETA = { paso: 16, radio: 450, pendiente: [0.15, 0.6], limpio: 4 };

// Los sitios de las vetas pequeñas de hierro de la isla (m del mundo), como los da buscarVetasHierro con el mundo elegido.
export const VETAS_HIERRO = [
  { x: 194370, z: 27594 }, { x: 203514, z: 26450 }, { x: 195498, z: 40498 }, { x: 197514, z: 40498 },
  { x: 211498, z: 39498 }, { x: 165498, z: 55498 }, { x: 180498, z: 55498 }, { x: 182498, z: 55498 },
  { x: 204466, z: 42514 }, { x: 210482, z: 42498 }, { x: 178498, z: 60530 }, { x: 183498, z: 59498 },
  { x: 196434, z: 57418 }, { x: 174610, z: 70450 }, { x: 182610, z: 73466 }, { x: 198386, z: 77562 },
];

// Busca el sitio de cada veta pequeña de hierro de la isla. mapa: generarMapa; paisaje: crearPaisaje(mapa); alt:
// alturaMundo(paisaje). Devuelve [{ x, z }] (m del mundo, redondeados a cm) en el orden de mapa.vetas.
export function buscarVetasHierro(mapa, paisaje, alt, isla = ISLA, B = BUSCAR_VETA) {
  const l = [];
  const vegT = new Map();
  const veg = (i, j) => { const k = i + ',' + j; let v = vegT.get(k); if (!v) { v = vegetacionTrozo(paisaje, alt, mapa.semilla, i, j); vegT.set(k, v); } return v; };
  const limpio = (x, z) => {
    const r = B.limpio;
    for (let j = Math.floor((z - r - 3) / LADO_VEG); j <= Math.floor((z + r + 3) / LADO_VEG); j++) for (let i = Math.floor((x - r - 3) / LADO_VEG); i <= Math.floor((x + r + 3) / LADO_VEG); i++) {
      const v = veg(i, j);
      if (v.arboles.some(e => Math.hypot(e.x - x, e.z - z) < r)) return false;
      if (v.piedras.some(e => Math.hypot(e.x - x, e.z - z) < r + e.tam * 1.1)) return false;
      if ((v.paredes || []).some(e => Math.hypot(e.x - x, e.z - z) < r + 4)) return false;
    }
    return true;
  };
  for (const v of mapa.vetas) {
    if (v.tipo !== 'hierroVeta') continue;
    const cx = (v.x + 0.5) * mapa.celda, cz = (v.y + 0.5) * mapa.celda;
    if (!dentroDeIsla(cx, cz, isla)) continue;
    const cand = [];
    for (let dz = -B.radio; dz <= B.radio; dz += B.paso) for (let dx = -B.radio; dx <= B.radio; dx += B.paso) {
      const d = Math.hypot(dx, dz); if (d > B.radio) continue;
      cand.push({ x: cx + dx, z: cz + dz, d });
    }
    cand.sort((a, b) => a.d - b.d);
    let sitio = null;
    for (const c of cand) {
      if (enZonaCastillo(c.x, c.z)) continue;
      const tramos = paisaje.riosEn(c.x - 40, c.z - 40, c.x + 40, c.z + 40);
      const zr = zonasRecogida(paisaje, alt, mapa.semilla, c.x, c.z, tramos);
      if (!zr || zr.s < B.pendiente[0] || zr.s > B.pendiente[1] || zr.zonas.includes('ribera')) continue;
      if (!limpio(c.x, c.z)) continue;
      sitio = { x: Math.round(c.x * 100) / 100, z: Math.round(c.z * 100) / 100 };
      break;
    }
    if (sitio) l.push(sitio);
  }
  return l;
}
