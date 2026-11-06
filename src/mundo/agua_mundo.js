// Kinhold — el agua en el juego (valravnx, 30 oct): alrededor del jugador, una lámina de agua de los ríos y del mar
// con el agua del mapa (src/mundo/agua_lamina.js: la misma que en la vista «como en el juego» del mapa: corriente,
// hondura, orilla, oleaje en el mar y espuma al pie de los saltos). Más allá, el mar es la lámina grande de
// src/mundo/mundo_juego.js. Cuando el jugador se aleja del centro de la lámina, se rehace alrededor de él poco a poco
// (unos ms por fotograma) y se cambia cuando está entera: el juego no se para.
import * as THREE from 'three';
import { crearMaterialAgua, tiempoAgua, atributosAgua } from '../mapa/agua.js';
import { hacerLaminaAgua } from './agua_lamina.js';

const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
export const LADO_AGUA = movil ? 160 : 240;     // lado de la lámina (m)
const PASO = 2;                                 // su rejilla (m)
const REHACER = movil ? 45 : 70;                // m desde su centro a partir de los que se rehace
const R_LEJOS = movil ? 700 : 1100, REHACER_LEJOS = 200, PASO_CINTA = 6;   // los ríos de lejos: hasta dónde (m), cada cuánto se rehacen y su paso a lo largo

export function crearAguaMundo({ grupo, paisaje, origen, altW }) {
  const material = crearMaterialAgua();
  let malla = null, centro = null, trabajo = null, nuevo = null;
  const n = Math.round(LADO_AGUA / PASO) + 1;

  function* hacer(cx, cz) {
    const x0 = -LADO_AGUA / 2, z0 = -LADO_AGUA / 2;
    const tramos = paisaje.riosEn(cx - LADO_AGUA, cz - LADO_AGUA, cx + LADO_AGUA, cz + LADO_AGUA);
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { H[j * n + i] = altW(cx + x0 + i * PASO, cz + z0 + j * PASO); if (i % 20 === 19) yield; }
    const { malla: m } = yield* hacerLaminaAgua({ pai: paisaje, tramos, cx, cz, x0, z0, n, paso: PASO, H, material });
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
    pasoCinta(xm, zm, ms);
  }
  // Los ríos de lejos (valravnx, 6 nov: «NO LLEGAN AL MAR… solo un estrecho de tierra aleatorio»): más allá de la
  // lámina de cerca no había agua de río, solo el mar de lejos (a la altura del mar), que asomaba donde el cauce queda
  // por debajo: el río se cortaba en el borde de la lámina, seguía seco y volvía a salir, como mar, donde ya iba a la
  // altura del mar. Ahora, hasta R_LEJOS, cada río lleva una cinta de agua por el centro de su cauce (con su meandro), a
  // la altura de su agua y del ancho de su cauce más la orilla (lo que sobra queda bajo el suelo de la orilla), con su
  // corriente. Dentro de la lámina de cerca no se dibuja (ya está ella) ni más allá de donde empieza el horizonte.
  const materialLejos = crearMaterialAgua();
  let cinta = null, centroCinta = null, trabajoCinta = null, nuevaCinta = null;
  function* hacerCinta(cx, cz) {
    const tramos = paisaje.riosEn(cx - R_LEJOS, cz - R_LEJOS, cx + R_LEJOS, cz + R_LEJOS, 0);
    const pos = [], idx = [], fl = [], ho = [], ori = [];
    // (una cinta seguida por río: el tramo que empieza donde acabó el anterior sigue la misma cinta, sin juntas; si no,
    // en las curvas los dos tramos se solapaban o se abrían y salían muescas)
    let antes = -1, finX = NaN, finY = NaN;
    for (const t of tramos) {
      const uno = [t], filas = Math.max(2, Math.ceil(t.largo / PASO_CINTA));
      const sigue = antes >= 0 && Math.abs(t.ax - finX) < 0.01 && Math.abs(t.ay - finY) < 0.01;
      if (!sigue) antes = -1;
      let enMar = 0;
      for (let s = sigue ? 1 : 0; s <= filas; s++) {
        const u = s / filas, [x, y] = paisaje.centroCauce(t, u);
        let w = Math.hypot(x - cx, y - cz) < R_LEJOS + 100 ? paisaje.agua(x, y, uno) : null;
        // en la boca, unos metros mar adentro a la altura del mar: el río entra en el agua del mar, sin una punta seca
        if (w === null && antes >= 0 && enMar < 5 && paisaje.grande(x, y).f < 0) { w = 0; enMar++; }
        if (w === null) { antes = -1; continue; }   // (lejos, o ya en el mar: ahí está el mar)
        const [x1, y1] = paisaje.centroCauce(t, Math.max(0, u - 0.002)), [x2, y2] = paisaje.centroCauce(t, Math.min(1, u + 0.002));
        let dx = x2 - x1, dy = y2 - y1; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const { ancho } = paisaje.rioCerca(x, y, uno), m = ancho / 2 + 1.5, co = paisaje.corriente(x, y, uno);
        const k = pos.length / 3, yy = w + 0.03;
        pos.push(x - dy * m - origen.x, yy, y + dx * m - origen.z, x - origen.x, yy, y - origen.z, x + dy * m - origen.x, yy, y - dx * m - origen.z);
        for (let q = 0; q < 3; q++) fl.push(co.dx * co.vel, co.dy * co.vel);
        ho.push(0, Math.min(2, ancho * 0.15 + 0.4), 0); ori.push(-1.5, ancho / 2, -1.5);
        if (antes >= 0) idx.push(antes, k, antes + 1, antes + 1, k, k + 1, antes + 1, k + 1, antes + 2, antes + 2, k + 1, k + 2);
        antes = k;
      }
      finX = t.bx; finY = t.by;
      yield;
    }
    let m = null;
    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      atributosAgua(g, { flujo: new Float32Array(fl), hondo: new Float32Array(ho), orilla: new Float32Array(ori) });
      m = new THREE.Mesh(g, materialLejos); m.name = 'riosLejos'; m.frustumCulled = false;
    }
    nuevaCinta = { malla: m, cx, cz };
  }
  function pasoCinta(xm, zm, ms) {
    if (!trabajoCinta && (!centroCinta || Math.hypot(xm - centroCinta.cx, zm - centroCinta.cz) > REHACER_LEJOS)) {
      trabajoCinta = hacerCinta(xm, zm); centroCinta = centroCinta || { cx: xm, cz: zm };
    }
    if (trabajoCinta) {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) { if (trabajoCinta.next().done) { trabajoCinta = null; break; } }
      if (!trabajoCinta && nuevaCinta) {
        if (cinta) { grupo.remove(cinta); cinta.geometry.dispose(); }
        cinta = nuevaCinta.malla; centroCinta = { cx: nuevaCinta.cx, cz: nuevaCinta.cz };
        if (cinta) grupo.add(cinta);
        nuevaCinta = null;
      }
    }
    // el hueco de la lámina de cerca (la que se ve, en la escena)
    if (malla) materialLejos.ponerHueco(malla.position.x - LADO_AGUA / 2 + 1, malla.position.z - LADO_AGUA / 2 + 1, malla.position.x + LADO_AGUA / 2 - 1, malla.position.z + LADO_AGUA / 2 - 1);
    else materialLejos.quitarHueco();
  }

  // todo de golpe (para las pruebas y al aparecer)
  function rehacerYa(x, z) { centro = null; trabajo = null; paso(x, z, 1e9); centroCinta = null; trabajoCinta = null; pasoCinta(x + origen.x, z + origen.z, 1e9); }
  // si la lámina que se ve ya está hecha alrededor de (x, z) (coordenadas de la escena)
  const cerca = (x, z) => !!malla && !!centro && !trabajo && Math.hypot(x + origen.x - centro.cx, z + origen.z - centro.cz) <= REHACER;
  // hasta: m desde la cámara hasta donde se dibujan los ríos de lejos (donde empieza el horizonte)
  return { paso, rehacerYa, cerca, get malla() { return malla; }, get cinta() { return cinta; }, material, materialLejos, ponerHasta: (v) => { materialLejos.userData.hasta.value = v; } };
}
