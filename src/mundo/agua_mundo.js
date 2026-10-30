// Kinhold — el agua en el juego (valravnx, 30 oct): alrededor del jugador, una lámina de agua de los ríos y del mar
// con el agua del mapa (src/mundo/agua_lamina.js: la misma que en la vista «como en el juego» del mapa: corriente,
// hondura, orilla, oleaje en el mar y espuma al pie de los saltos). Más allá, el mar es la lámina grande de
// src/mundo/mundo_juego.js. Cuando el jugador se aleja del centro de la lámina, se rehace alrededor de él poco a poco
// (unos ms por fotograma) y se cambia cuando está entera: el juego no se para.
import * as THREE from 'three';
import { crearMaterialAgua, tiempoAgua } from '../mapa/agua.js';
import { hacerLaminaAgua } from './agua_lamina.js';

const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
export const LADO_AGUA = movil ? 160 : 240;     // lado de la lámina (m)
const PASO = 2;                                 // su rejilla (m)
const REHACER = movil ? 45 : 70;                // m desde su centro a partir de los que se rehace

export function crearAguaMundo({ grupo, paisaje, origen, altW }) {
  const material = crearMaterialAgua();
  let malla = null, centro = null, trabajo = null, nuevo = null;
  const n = Math.round(LADO_AGUA / PASO) + 1;

  function* hacer(cx, cz) {
    const x0 = -LADO_AGUA / 2, z0 = -LADO_AGUA / 2;
    const tramos = paisaje.riosEn(cx - LADO_AGUA, cz - LADO_AGUA, cx + LADO_AGUA, cz + LADO_AGUA);
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) { for (let i = 0; i < n; i++) H[j * n + i] = altW(cx + x0 + i * PASO, cz + z0 + j * PASO); yield; }
    const m = yield* hacerLaminaAgua({ pai: paisaje, tramos, cx, cz, x0, z0, n, paso: PASO, H, material });
    nuevo = { malla: m, cx, cz };
  }

  // cada fotograma: x, z del jugador en la escena; ms: lo que se puede tardar
  function paso(x, z, ms = movil ? 2 : 3, t = performance.now() / 1000) {
    tiempoAgua.value = t;
    const xm = x + origen.x, zm = z + origen.z;
    if (!trabajo && (!centro || Math.hypot(xm - centro.cx, zm - centro.cz) > REHACER)) {
      const cx = Math.round(xm / PASO) * PASO, cz = Math.round(zm / PASO) * PASO;
      trabajo = hacer(cx, cz); centro = centro || { cx, cz };
    }
    if (trabajo) {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) { if (trabajo.next().done) { trabajo = null; break; } }
      if (!trabajo && nuevo) {
        if (malla) { grupo.remove(malla); malla.geometry.dispose(); }
        malla = nuevo.malla; centro = { cx: nuevo.cx, cz: nuevo.cz };
        if (malla) { malla.position.set(nuevo.cx - origen.x, 0, nuevo.cz - origen.z); grupo.add(malla); }
        nuevo = null;
      }
    }
  }
  // todo de golpe (para las pruebas y al aparecer)
  function rehacerYa(x, z) { centro = null; trabajo = null; paso(x, z, 1e9); }
  return { paso, rehacerYa, get malla() { return malla; }, material };
}
