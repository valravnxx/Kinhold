// Kinhold — el paisaje «como en el juego»: el suelo va por trozos de 64 m (src/mundo/terreno_trozos.js: rejilla de 1 m
// cerca del personaje y más basta lejos, hecha en un hilo aparte, unos pocos trozos por fotograma). Encima, alrededor
// del personaje, el decorado de cerca: hierba, flores, matorrales, piedras, roca de los cortados, agua y árboles completos
// del estilo v5, colocados con las mismas reglas que el bosque de lejos (bioma, pendiente, claros). Lo de más allá de los
// trozos es el paisaje de lejos (4 × 4 km), con un hueco donde ya hay trozos. Se anda tocando el suelo; al alejarse, el
// decorado se rehace donde estás poco a poco (unos ms por fotograma) y se cambia cuando está entero: el juego no se para.
import * as THREE from 'three';
import { modelosPlantas } from '../mundo/decorado.js';
import { azarLineal as azar } from '../logica/azar.js';
import { modelosEspecies, ESPECIES } from '../mundo/especies.js';
import { azarCelda } from '../logica/paisaje.js';
import { materialTex } from '../mundo/estilos.js';
import { bosqueEn, PENDIENTE_ANDAR } from '../logica/paisaje.js';
import { fbm } from '../logica/mapa.js';
import { crearJugador } from '../juego/personaje.js';
import { personajeElegido, recursosTaller } from '../mundo/eleccion.js';
import { lin, poblarArboles, ROCAS_COLOR, aguaLejos, aguaCerca } from './cerca.js';
import { atributosAgua, distanciaOrilla } from './agua.js';
import { materialSuelo } from './suelo.js';
import { modelosRocaPared, materialRoca } from '../mundo/rocas.js';
import { crearTerrenoTrozos } from '../mundo/terreno_trozos.js';
import { crearGestor, ANILLOS, LADO as LADO_TROZO, alturaDeTrozo, claveTrozo } from '../logica/trozos.js';

const movil = Math.min(innerWidth, innerHeight) < 700;
export const CERCA = movil ? 150 : 240;           // lado del decorado de cerca (m)
const PASO = 1;                                    // su rejilla (m): la misma que la de los trozos de cerca, en metros enteros del mundo
// Decisión provisional (30 oct): en el móvil, anillos más cortos (rejilla de 1 m hasta 32 m, 2 m hasta 128 y 4 m hasta
// 288; nada de 8 m): menos triángulos lejos. Cada anillo es más ancho que un trozo en diagonal (91 m): dos trozos
// vecinos nunca se llevan más de un nivel. En el PC, los del juego (src/logica/trozos.js).
export const ANILLOS_JUEGO = movil ? [{ paso: 1, hasta: 32 }, { paso: 2, hasta: 128 }, { paso: 4, hasta: 288 }] : ANILLOS;
const MS_FOTOGRAMA = movil ? 3 : 4;                 // lo que puede tardar en cada fotograma rehacer el decorado (ms)
const R_HIERBA = movil ? 48 : 80;                  // radio con hierba (m)
const R_ARBOL = movil ? 60 : 80;                   // radio con los árboles enteros; más allá, con la forma sencilla (m)
const MAX = movil ? { hierba: 9000, flores: 900, matas: 400, rocas: 250, arboles: 1500, paredes: 700 } : { hierba: 30000, flores: 2600, matas: 1200, rocas: 600, arboles: 4000, paredes: 2400 };
// radio de la copa y alto (m) de cada especie a escala 1, para no dibujar los que tapan al personaje
const TAMANO = { abeto: [2.1, 10.5], pino: [2.3, 9.5], abedul: [1.6, 9], roble: [3.2, 7.5], haya: [2.3, 10.8], fresno: [2.6, 9.2], encina: [2.6, 5.5] };
const totalArbCerca = (L) => ESPECIES.reduce((n, e) => n + L.arboles[e].length, 0);
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function crearVistaJuego(est) {
  const vj = { activo: false, grupo: null, jugador: null, destino: null, centro: null, trozos: null, haciendo: null };
  const ayuda = () => document.getElementById('juegoAyuda');
  const grupoTrozos = new THREE.Group(); grupoTrozos.name = 'trozos';

  // la altura del suelo que se ve (la de los trozos); si ese trozo aún no ha llegado, la del decorado de cerca (que
  // sale de la misma función de altura) y, fuera de él, la de lejos
  vj.altura = (x, z) => {
    const t = vj.trozos;
    if (t) { const y = t.alturaEn(x + t.origen.x, z + t.origen.z); if (y !== null) return y; }
    const y = alturaDecorado(vj.centro, x, z);
    return y === null ? est.alturaEn(x, z) : y;
  };
  function alturaDecorado(c, x, z) {
    if (!c) return null;
    const gi = (x - c.x0) / PASO, gj = (z - c.z0) / PASO, i = Math.floor(gi), j = Math.floor(gj);
    if (i < 0 || j < 0 || i >= c.n - 1 || j >= c.n - 1) return null;
    const fx = gi - i, fy = gj - j, H = c.H, n = c.n;
    return H[j * n + i] * (1 - fx) * (1 - fy) + H[j * n + i + 1] * fx * (1 - fy) + H[(j + 1) * n + i] * (1 - fx) * fy + H[(j + 1) * n + i + 1] * fx * fy;
  }

  // el terreno por trozos de esta zona (con sus hilos): se guarda mientras no cambie la zona abierta
  function prepararTrozos() {
    const { cx, cy } = est.centro, clave = est.paisaje.mapa.semilla + ':' + cx + ',' + cy;
    if (vj.trozos && vj.trozos.clave === clave) return;
    soltarTrozos();
    const L2 = (est.L || 4000) / 2;
    const gestor = crearGestor({ anillos: ANILLOS_JUEGO, limites: { x0: cx - L2, z0: cy - L2, x1: cx + L2, z1: cy + L2 } });
    vj.trozos = crearTerrenoTrozos({ grupo: grupoTrozos, material: materialSuelo(), mapa: est.paisaje.mapa, paisaje: est.paisaje,
      origen: { x: cx, z: cy }, gestor, verticesPorFotograma: movil ? 12000 : 20000, msPorFotograma: movil ? 2 : 3 });
    vj.trozos.clave = clave; vj.trozos.origen = { x: cx, z: cy };
  }
  function soltarTrozos() { if (vj.trozos) { vj.trozos.soltarTodo(); vj.trozos = null; } }
  // Lo que se ve de los trozos: el cuadrado más grande alrededor del jugador con todos sus trozos ya hechos. Ahí el suelo
  // de lejos tiene un hueco (no asoma ni se pisa con los trozos) y fuera no se dibuja ningún trozo (así nunca hay dos
  // suelos en el mismo sitio, ni agujeros mientras llegan).
  function cuadroTrozos() {
    const t = vj.trozos; if (!t) return;
    const xm = vj.pos.x + t.origen.x, zm = vj.pos.z + t.origen.z, pi = Math.floor(xm / LADO_TROZO), pj = Math.floor(zm / LADO_TROZO);
    const hecho = (i, j) => { const v = t.vivos.get(claveTrozo(i, j)); return !!(v && v.malla); };
    let R = -1;
    for (let r = 0; r < 20; r++) {
      let ok = true;
      for (let k = -r; k <= r && ok; k++) ok = hecho(pi + k, pj - r) && hecho(pi + k, pj + r) && hecho(pi - r, pj + k) && hecho(pi + r, pj + k);
      if (!ok) break; R = r;
    }
    for (const v of t.vivos.values()) if (v.malla) v.malla.visible = R >= 0 && Math.abs(v.i - pi) <= R && Math.abs(v.j - pj) <= R;
    const lejos = materialSuelo({ lejos: true });
    if (R < 0) lejos.quitarHueco();
    else lejos.ponerHueco((pi - R) * LADO_TROZO - t.origen.x + 2, (pj - R) * LADO_TROZO - t.origen.z + 2, (pi + R + 1) * LADO_TROZO - t.origen.x - 2, (pj + R + 1) * LADO_TROZO - t.origen.z - 2);
    vj.cuadro = { R, pi, pj, ladoM: (2 * R + 1) * LADO_TROZO };
  }

  function quitarGrupo() {
    if (!vj.grupo) return;
    est.raiz.remove(vj.grupo);
    vj.grupo.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh) o.geometry.dispose(); });
    vj.grupo = null;
  }

  // El decorado de cerca, hecho a trozos de trabajo: cada `yield` deja seguir al fotograma. Devuelve lo hecho, sin
  // ponerlo en la escena (eso lo hace ponerDecorado, de golpe y barato).
  function* hacerDecorado(px, pz) {
    const t0 = performance.now(); let msTrabajo = 0;
    const pai = est.paisaje, { cx, cy } = est.centro, tramos = est.tramos;
    // la rejilla en metros enteros del mundo, como la de los trozos de 1 m: las alturas son las mismas que las del suelo
    const n = Math.round(CERCA / PASO) + 1, x0 = Math.round(cx + px - CERCA / 2) - cx, z0 = Math.round(cy + pz - CERCA / 2) - cy;
    const H = new Float32Array(n * n), funciones = new Map();
    const alturaMundo = (xm, zm) => {
      const i = Math.floor(xm / LADO_TROZO), j = Math.floor(zm / LADO_TROZO), k = claveTrozo(i, j);
      let f = funciones.get(k); if (!f) funciones.set(k, f = alturaDeTrozo(pai, i, j));
      return f(xm, zm);
    };
    for (let j = 0; j < n; j++) { for (let i = 0; i < n; i++) H[j * n + i] = alturaMundo(cx + x0 + i * PASO, cy + z0 + j * PASO); if (j % 8 === 7) yield; }
    const centro = { x0, z0, n, H, px, pz };
    const altC = (x, z) => { const y = alturaDecorado(centro, x, z); return y === null ? est.alturaEn(x, z) : y; };
    const alt = (i, j) => H[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
    const g = new THREE.Group(); g.name = 'juego';
    const pend = new Float32Array(n * n), sitios = new Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i, y = H[k];
        // pendiente con vecinos a 3 m (la de la forma del terreno, no la de cada piedrecita)
        pend[k] = Math.hypot(alt(i + 3, j) - alt(i - 3, j), alt(i, j + 3) - alt(i, j - 3)) / (6 * PASO);
        sitios[k] = y > 0.05 ? pai.sitio(cx + x0 + i * PASO, cy + z0 + j * PASO, y) : null;
      }
      if (j % 6 === 5) yield;
    }
    // el agua en el trozo de cerca (ríos y mar): una lámina a la altura del agua sobre la misma rejilla; donde corta el
    // terreno sale la orilla, lisa. Cada vértice lleva su hondura, la corriente del río y, en el mar, el oleaje (que se
    // apaga en lo somero y en el borde del trozo, donde sigue el mar de lejos, plano)
    const W = new Float32Array(n * n).fill(NaN), T = new Uint8Array(n * n);
    let hayAgua = false;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i, w = pai.agua(cx + x0 + i * PASO, cy + z0 + j * PASO, tramos);
        if (w !== null) { W[k] = w; hayAgua = true; } else if (H[k] < 0.3) { W[k] = 0; T[k] = 1; hayAgua = true; }
      }
      if (j % 8 === 7) yield;
    }
    if (hayAgua) {
      const pa = new Float32Array(n * n * 3), ia = [], fl = new Float32Array(n * n * 2), ho = new Float32Array(n * n), ti = new Float32Array(n * n), ol = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i, x = x0 + i * PASO, z = z0 + j * PASO;
        // un vértice seco junto al agua se queda a la altura del agua de al lado: la lámina sigue plana bajo la orilla
        // (si bajara al terreno, en un cortado subiría como una cortina)
        let yv = W[k];
        if (isNaN(yv)) { let sm = 0, c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n && !isNaN(W[jj * n + ii])) { sm += W[jj * n + ii]; c++; } } yv = c ? sm / c - 0.05 : H[k] - 0.5; }
        pa.set([x, yv, z], k * 3);
        if (isNaN(W[k])) continue;
        ho[k] = Math.max(0, W[k] - H[k]); ti[k] = T[k];
        if (T[k]) { const borde = Math.min(i, j, n - 1 - i, n - 1 - j) * PASO; ol[k] = suave(0.4, 4, ho[k]) * suave(4, 30, borde); }
        else { const co = pai.corriente(cx + x, cy + z, tramos); fl[k * 2] = co.dx * co.vel; fl[k * 2 + 1] = co.dy * co.vel; }
        if (i === n - 1 && j % 16 === 15) yield;
      }
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
        if (isNaN(W[a]) && isNaN(W[b]) && isNaN(W[c2]) && isNaN(W[d])) continue;
        ia.push(a, c2, b, b, c2, d);
      }
      yield;
      const ga = new THREE.BufferGeometry(); ga.setAttribute('position', new THREE.BufferAttribute(pa, 3)); ga.setIndex(ia); ga.computeVertexNormals();
      // la orilla exacta: hondura con signo (negativa en seco, con el agua de al lado) y, en cada lado de la rejilla que
      // cruza la orilla, dónde corta el agua; la distancia sale de ahí (no de los puntos), y la línea queda lisa
      const seco = new Uint8Array(n * n), hs = new Float32Array(n * n), sem = new Float32Array(n * n).fill(NaN);
      for (let k = 0; k < n * n; k++) { hs[k] = pa[k * 3 + 1] - H[k]; seco[k] = hs[k] <= 0 ? 1 : 0; }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          const q = jj * n + ii; if (seco[k] === seco[q]) continue;
          const t = hs[k] / (hs[k] - hs[q]);                   // de k (0) a q (1), dónde la hondura pasa por 0
          const v = seco[k] ? -t * PASO : t * PASO;
          if (isNaN(sem[k]) || Math.abs(v) < Math.abs(sem[k])) sem[k] = v;
        }
      }
      yield;
      // la poza de espuma al pie de cada salto de agua: se apaga en unos 15 m aguas abajo y a los lados
      const es = new Float32Array(n * n);
      for (const sa of pai.saltosEn(tramos)) {
        const bx = sa.x - cx + sa.dx * 2, bz = sa.y - cy + sa.dy * 2, R = 8 + sa.ancho;
        const i0 = Math.max(0, Math.floor((bx - R * 2 - x0) / PASO)), i1 = Math.min(n - 1, Math.ceil((bx + R * 2 - x0) / PASO));
        const j0 = Math.max(0, Math.floor((bz - R * 2 - z0) / PASO)), j1 = Math.min(n - 1, Math.ceil((bz + R * 2 - z0) / PASO));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const ux = x0 + i * PASO - bx, uz = z0 + j * PASO - bz, a = ux * sa.dx + uz * sa.dy, l = -ux * sa.dy + uz * sa.dx;
          if (a < -2) continue;
          es[j * n + i] = Math.max(es[j * n + i], Math.max(0, 1 - Math.hypot(a / (R * 1.8), l / R)));
        }
      }
      atributosAgua(ga, { flujo: fl, hondo: ho, tipo: ti, ola: ol, orilla: distanciaOrilla(seco, n, PASO, 60, sem), espuma: es });
      yield;
      const lamina = new THREE.Mesh(ga, aguaCerca()); lamina.name = 'aguaCerca'; lamina.receiveShadow = true; g.add(lamina);
    }

    // lo que crece y lo que hay en el suelo, con las reglas del bosque de lejos
    // El azar de cada cosa sale de su celda en el MUNDO (no del trozo de cerca) y de la semilla del mundo: así, al
    // rehacer el trozo en otro sitio, lo que ya estaba sale exactamente igual (cada árbol, mata y piedra en su sitio).
    // recorrer(paso, …): las celdas del mundo de ese tamaño que caen dentro del trozo, cada una con su azar propio.
    // (azarCentro: solo para romper la prueba a propósito, como era antes: el azar cambia con el centro del trozo)
    const SEM = ((est.paisaje.mapa && est.paisaje.mapa.semilla) || 0) + (vj.azarCentro ? Math.round(px * 7 + pz * 13) : 0);
    const recorrer = function* (paso, capa, margen, fn) {
      const i0 = Math.ceil((cx + x0 + margen) / paso), i1 = Math.floor((cx + x0 + CERCA - margen) / paso);
      const j0 = Math.ceil((cy + z0 + margen) / paso), j1 = Math.floor((cy + z0 + CERCA - margen) / paso);
      let hechos = 0;
      for (let j = j0; j <= j1; j++) { for (let i = i0; i <= i1; i++) fn(i * paso - cx, j * paso - cy, azarCelda(i, j, capa, SEM)); if ((hechos += i1 - i0 + 1) > 1500) { hechos = 0; yield; } }
    };
    const sitioEn = (x, z) => { const i = Math.round((x - x0) / PASO), j = Math.round((z - z0) / PASO); const k = Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i)); const y = altC(x, z); return { st: W[k] > y - 0.3 ? null : sitios[k], s: pend[k], y }; };   // en el agua (o en su orilla) no crece nada
    const espesor = (x, z, st, s, u = 0.5) => bosqueEn(st, s, cx + x, cy + z, { semilla: SEM, u });
    const L = { arboles: Object.fromEntries(ESPECIES.map(e => [e, []])), hierba: [], flores: [], matas: [], rocas: [] };
    const dentro = (x, z, m = 2) => Math.abs(x - px) < CERCA / 2 - m && Math.abs(z - pz) < CERCA / 2 - m;
    // árboles: rejilla desordenada de 4,5 m
    yield* recorrer(4.5, 1, 2, (x, z, r) => {
      const ax = x + (r() - 0.5) * 4, az = z + (r() - 0.5) * 4, { st, s, y } = sitioEn(ax, az);
      if (!st || !st.bioma || y < 1.5) return;
      const { d, especie, tam } = espesor(ax, az, st, s, r());
      if (r() > d * 0.55) return;                                          // 0,55: de cerca, la densidad de un bosque de verdad
      // del tamaño de los del juego (6–11 m), ±15 % cada uno; [x, y, z, escala, giro, tono]
      L.arboles[especie].push([ax, y - 0.2, az, tam * (0.85 + r() * 0.3), r() * 6.3, 0.82 + r() * 0.3]);
    });
    // hierba, flores y matorrales: más en los claros que bajo el bosque
    yield* recorrer(0.85, 2, CERCA / 2 - R_HIERBA - 1, (x, z, r) => {
      const hx = x + (r() - 0.5) * 0.8, hz = z + (r() - 0.5) * 0.8;
      if (Math.hypot(hx - px, hz - pz) > R_HIERBA || !dentro(hx, hz)) return;
      const { st, s, y } = sitioEn(hx, hz);
      if (!st || !st.bioma || st.bioma === 'nieve' || y < 1 || s > 0.75) return;
      const { d, linde } = espesor(hx, hz, st, s), xm = cx + hx, ym = cy + hz;
      const prado = { pradera: 1, mixto: 0.8, caducifolio: 0.7, encinar: 0.55, taiga: 0.5, brezal: 0.6, matorral: 0.45, turbera: 0.8, alpino: 0.6 }[st.bioma] ?? 0.5;
      const calva = suave(0.6, 0.72, fbm(xm / 16, ym / 16, 41, 3));
      const pHierba = prado * (1 - 0.75 * d) * (1 - calva) * (0.55 + 0.45 * fbm(xm / 7, ym / 7, 45, 2));
      const t = r();
      if (t < pHierba) L.hierba.push([hx, y, hz, 0.8 + r() * 0.9, r() * 6.3, 0.85 + r() * 0.3]);
      else if (t < pHierba + 0.035 * prado * (1 - d)) L.flores.push([hx, y, hz, 0.8 + r() * 0.5, r() * 6.3, Math.floor(r() * 3)]);
      else if (t < pHierba + 0.035 * prado * (1 - d) + 0.007 * (0.4 + d * (1 - d) * 3) + 0.02 * d + 0.03 * linde * (1 - linde) * (d > 0.02)) L.matas.push([hx, y - 0.05, hz, 0.5 + r() * 0.6, r() * 6.3, 0.85 + r() * 0.3]);
    });
    // piedras: pocas y sueltas por el campo; en las paredes ninguna (son roca maciza) y al pie de las paredes, el
    // pedregal de lo que se desprende (bloques más grandes y juntos)
    const paredCerca = (x, z) => { let m = 0; for (let a = 0; a < 6.28; a += 0.785) m = Math.max(m, sitioEn(x + Math.cos(a) * 5, z + Math.sin(a) * 5).s); return m; };
    yield* recorrer(2.5, 3, 2, (x, z, r) => {
      const ax = x + (r() - 0.5) * 2.2, az = z + (r() - 0.5) * 2.2, { st, s, y } = sitioEn(ax, az);
      if (!st || !st.bioma || y < 0.5 || s > 0.8) return;
      const pie = s < 0.7 && paredCerca(ax, az) > 1.1;
      if (r() > (pie ? 0.45 : 0.006)) return;
      L.rocas.push([ax, y - 0.2, az, pie ? 0.5 + r() * 1.5 : 0.3 + r() * 0.6, r() * 6.3, st.roca]);
    });
    // la roca de los cortados: piezas de roca 3D encajadas en las paredes, de 2 a 8 m, mirando hacia fuera de la pared
    // y medio metidas en ella; en las paredes más altas, más grandes
    const PR = [];
    yield* recorrer(2.6, 4, 3, (x, z, r) => {
      const ax = x + (r() - 0.5) * 2, az = z + (r() - 0.5) * 2, gi = Math.round((ax - x0) / PASO), gj = Math.round((az - z0) / PASO);
      const gx = (alt(gi + 1, gj) - alt(gi - 1, gj)) / (2 * PASO), gz = (alt(gi, gj + 1) - alt(gi, gj - 1)) / (2 * PASO), s = Math.hypot(gx, gz);
      if (s < 1.15 || r() > 0.4 || !isNaN(W[gj * n + gi])) return;   // en el agua (el salto) no
      const y = altC(ax, az); if (y < -0.5) return;
      const nx = -gx / s, nz = -gz / s, alto = 2 + r() * 2.5 + Math.min(3, s);
      const roca = sitioEn(ax, az).st?.roca || sitios[gj * n + gi]?.roca;
      PR.push([ax + nx * alto * 0.05, y - alto * 0.2, az + nz * alto * 0.05, alto, Math.atan2(nx, nz) + (r() - 0.5) * 0.5, Math.floor(r() * 5), (r() - 0.5) * 0.25, 0.85 + r() * 0.3, roca]);
      // en una pared alta (más de 8 m de la base al borde), más piezas apiladas hasta arriba, cada 4 a 5 m
      const arriba = altC(ax - nx * 4, az - nz * 4), abajo = altC(ax + nx * 4, az + nz * 4);
      for (let h = abajo + 3; h < arriba - 2; h += 4 + r()) {
        if (Math.abs(h - y) < 3) continue;
        const a2 = 2.2 + r() * 2.5;
        PR.push([ax + nx * a2 * 0.05 + (r() - 0.5) * 1.5, h - a2 * 0.3, az + nz * a2 * 0.05 + (r() - 0.5) * 1.5, a2, Math.atan2(nx, nz) + (r() - 0.5) * 0.6, Math.floor(r() * 5), (r() - 0.5) * 0.25, 0.8 + r() * 0.35, roca]);
      }
    });
    L.paredes = PR;
    // recorte a lo que aguanta el aparato
    // (si hay más de lo que aguanta el aparato, se quitan los más lejanos del personaje: no al azar, para que lo que se
    // ve de cerca no cambie)
    const recortar = (lista, m) => lista.length <= m ? lista : lista.map(e => [e, (e[0] - px) ** 2 + (e[2] - pz) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, m).map(a => a[0]);
    for (const [k, m] of [['hierba', MAX.hierba], ['flores', MAX.flores], ['matas', MAX.matas], ['rocas', MAX.rocas]]) L[k] = recortar(L[k], m);
    const totalArb = ESPECIES.reduce((n, e) => n + L.arboles[e].length, 0);
    if (totalArb > MAX.arboles) { const q = MAX.arboles / totalArb; for (const e of ESPECIES) L.arboles[e] = recortar(L.arboles[e], Math.round(L.arboles[e].length * q)); }

    yield;
    const arb = modelosEspecies(), arbS = modelosEspecies({ sencillo: true }), pl = modelosPlantas(), o = new THREE.Object3D(), c = new THREE.Color();
    const poner = (lista, geo, mats, nombre, { ancho = 1, sombra = false, color = (e) => c.setScalar(e[5]) } = {}) => {
      if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mats, lista.length);
      lista.forEach((e, k) => { o.position.set(e[0], e[1], e[2]); o.rotation.set(0, e[4], 0); o.scale.set(e[3] * ancho, e[3], e[3] * ancho); o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, color(e)); });
      im.castShadow = sombra; im.receiveShadow = true; im.name = nombre; g.add(im);
    };
    // los árboles a más de R_ARBOL m del personaje, con la forma sencilla (menos caras; de ahí en adelante no se nota)
    let arboles = [];
    for (const e of ESPECIES) {
      const cerca = L.arboles[e].filter(a => Math.hypot(a[0] - px, a[2] - pz) < R_ARBOL), lejos = L.arboles[e].filter(a => Math.hypot(a[0] - px, a[2] - pz) >= R_ARBOL);
      poner(cerca, arb[e].geo, arb[e].mats, 'arbolesCerca_' + e, { sombra: true });
      poner(lejos, arbS[e].geo, arbS[e].mats, 'arbolesMedios_' + e, { sombra: true });
      arboles.push([cerca, g.getObjectByName('arbolesCerca_' + e), e], [lejos, g.getObjectByName('arbolesMedios_' + e), e]);
    }
    arboles = arboles.filter(a => a[1]);
    yield;
    poner(L.hierba, pl.mata, materialHierba(), 'hierba');
    const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];
    poner(L.flores, pl.flor, materialFlor(), 'flores', { color: (e) => c.set(FLORES[e[5]]) });
    poner(L.matas, pl.matorral.geo, pl.matorral.mats, 'matorralesCerca', { sombra: true });
    L.paredes = recortar(L.paredes, MAX.paredes);
    yield;
    const piezas = modelosRocaPared(), mr = materialRoca();
    piezas.forEach((geo, v) => {
      const lista = L.paredes.filter(e => e[5] === v); if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mr, lista.length);
      lista.forEach((e, k) => {
        o.position.set(e[0], e[1], e[2]); o.rotation.set(e[6], e[4], (e[7] - 1) * 0.4, 'YXZ'); o.scale.set(e[3] * (0.9 + e[7] * 0.4), e[3], e[3] * 0.9); o.updateMatrix(); im.setMatrixAt(k, o.matrix);
        const kc = ROCAS_COLOR[e[8]] || ROCAS_COLOR.caliza; im.setColorAt(k, c.setRGB(lin(kc[0]) / 0.62 * e[7], lin(kc[1]) / 0.62 * e[7], lin(kc[2]) / 0.62 * e[7]));   // el tono de su roca, apagado como el del estilo v5
      });
      im.castShadow = true; im.receiveShadow = true; im.name = 'rocaPared'; g.add(im);
    });
    poner(L.rocas, pl.roca.geo, pl.roca.mats, 'rocasCerca', { sombra: true, color: (e) => { const k = ROCAS_COLOR[e[5]] || ROCAS_COLOR.caliza; return c.setRGB(lin(k[0]) / 0.4, lin(k[1]) / 0.4, lin(k[2]) / 0.4); } });

    const tris = (gg) => (gg.index ? gg.index.count : gg.attributes.position.count) / 3;
    const medidas = {
      ms: Math.round(performance.now() - t0), rejilla: n, pasoM: PASO,
      arboles: totalArbCerca(L), especies: Object.fromEntries(ESPECIES.map(e => [e, L.arboles[e].length])), hierba: L.hierba.length, flores: L.flores.length, matas: L.matas.length, rocas: L.rocas.length, paredes: L.paredes.length,
      triangulosDecorado: Math.round(L.paredes.length * tris(modelosRocaPared()[0]) + arboles.reduce((n, [l, im]) => n + l.length * tris(im.geometry), 0) + L.hierba.length * tris(pl.mata) + L.matas.length * tris(pl.matorral.geo)),
    };
    return { g, centro, L, arboles, medidas, x1: x0 + (n - 1) * PASO, z1: z0 + (n - 1) * PASO };
  }

  // pone en la escena un decorado ya hecho (y quita el anterior)
  function ponerDecorado(d) {
    quitarGrupo();
    est.raiz.add(d.g); vj.grupo = d.g; vj.centro = d.centro; vj.L = d.L; vj.arboles = d.arboles; vj.tapan = new Set();
    const { x0, z0, px, pz } = d.centro;
    aguaLejos().ponerHueco(x0, z0, d.x1, d.z1);
    poblarArboles(null, (x, z) => Math.abs(x - px) < CERCA / 2 && Math.abs(z - pz) < CERCA / 2);
    vj.medidas = d.medidas; medir();
    window.__cerca.juego = vj.medidas; window.__cerca.vj = vj;
  }
  // las medidas de ahora: triángulos del suelo (los trozos que se ven) y del decorado, y lo más que ha tardado un fotograma
  function medir() {
    const m = vj.medidas; if (!m) return;
    let suelo = 0, trozos = 0;
    if (vj.trozos) for (const v of vj.trozos.vivos.values()) if (v.malla && v.malla.visible) { suelo += v.malla.geometry.index.count / 3; trozos++; }
    m.triangulosSuelo = Math.round(suelo); m.trozos = trozos; m.triangulos = m.triangulosSuelo + m.triangulosDecorado;
    m.ladoTrozosM = vj.cuadro ? vj.cuadro.ladoM : 0; m.msFotogramaMax = Math.round(vj.msMax * 10) / 10; m.rehechos = vj.rehechos;
  }
  // hace un decorado entero de una vez (al entrar, con la escena parada)
  function construir(px, pz) {
    const it = hacerDecorado(px, pz); let r;
    do r = it.next(); while (!r.done);
    ponerDecorado(r.value);
  }

  vj.entrar = (px, pz, dir = 0) => {
    vj.activo = true; ayuda().hidden = false; vj.haciendo = null; vj.msMax = 0; vj.rehechos = 0; vj.fotogramas = 0;
    prepararTrozos();
    if (!grupoTrozos.parent) est.escena.add(grupoTrozos);
    construir(px, pz);
    est.amb.sol.castShadow = true;
    if (!vj.jugador) {   // el personaje elegido en el visor, con el taller de ahora (como la construcción y el duelo)
      const el = personajeElegido();
      vj.jugador = el ? crearJugador(recursosTaller(), el.sexo, el.capas, el.aspecto) : crearJugador(recursosTaller()); vj.jugador.raiz.traverse(m => { if (m.isMesh) m.castShadow = true; }); }
    est.escena.add(vj.jugador.raiz);
    vj.pos = new THREE.Vector3(px, vj.altura(px, pz), pz); vj.destino = null;
    vj.jugador.raiz.position.copy(vj.pos); vj.jugador.raiz.rotation.y = Math.PI / 2 - dir;
    // cámara como en el juego: detrás y por encima del personaje (la de la construcción: 16 m, 52° de inclinación)
    const { camara, control } = est, yaw = Math.PI / 2 + dir + Math.PI, pitch = 0.9, dist = 16;
    control.minDistance = 3; control.maxDistance = 90;
    control.target.set(px, vj.pos.y + 1.2, pz);
    camara.position.set(px + Math.cos(yaw) * Math.cos(pitch) * dist, vj.pos.y + 1.2 + Math.sin(pitch) * dist, pz + Math.sin(yaw) * Math.cos(pitch) * dist);
    control.update();
    vj.trozos.actualizar(px + vj.trozos.origen.x, pz + vj.trozos.origen.z, { prisa: true }); cuadroTrozos(); medir();
  };
  vj.salir = () => {
    if (!vj.activo) return;
    vj.activo = false; ayuda().hidden = true;
    quitarGrupo(); vj.centro = null; vj.haciendo = null;
    est.escena.remove(grupoTrozos);
    // el terreno por trozos se queda (con sus hilos) por si se vuelve a entrar en la misma zona; si cambia, se suelta
    aguaLejos().quitarHueco(); materialSuelo({ lejos: true }).quitarHueco();
    if (vj.jugador) est.escena.remove(vj.jugador.raiz);
    est.amb.sol.castShadow = false;
    poblarArboles(null);
  };
  // andar: hacia donde se tocó; la cámara le sigue; si se aleja del centro del trozo de cerca, se rehace
  vj.actualizar = (dt) => {
    if (!vj.activo || !vj.jugador) return;
    let vel = 0;
    if (vj.destino) {
      const dx = vj.destino.x - vj.pos.x, dz = vj.destino.z - vj.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.2) vj.destino = null;
      else {
        vel = d > 6 ? 3.2 : 1.4; const paso = Math.min(d, vel * dt);
        const antes = vj.pos.clone();
        // una pared de roca no se sube ni se baja andando: se mira la pendiente medio metro por delante
        const nx = vj.pos.x + dx / d * 0.5, nz = vj.pos.z + dz / d * 0.5;
        // (sinLimite: solo para romper la prueba a propósito)
        if (!vj.sinLimite && Math.abs(vj.altura(nx, nz) - vj.pos.y) / 0.5 > PENDIENTE_ANDAR) { vj.destino = null; vj.parado = 'pared'; }
        else {
          vj.parado = null;
          vj.pos.x += dx / d * paso; vj.pos.z += dz / d * paso; vj.pos.y = vj.altura(vj.pos.x, vj.pos.z);
          vj.jugador.raiz.rotation.y = Math.atan2(dx, dz);
          const mov = vj.pos.clone().sub(antes);
          est.camara.position.add(mov); est.control.target.add(mov);
        }
      }
    }
    vj.pos.y = vj.altura(vj.pos.x, vj.pos.z);   // también parado: el trozo de debajo puede haber llegado con más detalle
    vj.jugador.raiz.position.copy(vj.pos);
    vj.jugador.animar(vel, dt);
    destapar();
    est.amb.seguir(vj.pos.x, vj.pos.z, vj.pos.y);
    // la cámara nunca por debajo del suelo (al girarla mucho se metía en la ladera y se veía el cielo por debajo)
    const cam = est.camara.position, suelo = vj.altura(cam.x, cam.z) + 1.5;
    if (cam.y < suelo) cam.y = suelo;
    // el suelo por trozos (en el hilo aparte) y lo que se ve de él
    const t1 = performance.now();
    vj.trozos.actualizar(vj.pos.x + vj.trozos.origen.x, vj.pos.z + vj.trozos.origen.z);
    cuadroTrozos();
    // el decorado: al acercarse al borde del de ahora, se empieza otro donde está el personaje, unos ms por fotograma
    const c = vj.centro;
    if (!vj.haciendo && c && Math.hypot(vj.pos.x - c.px, vj.pos.z - c.pz) > CERCA / 2 - (movil ? 55 : 70)) vj.haciendo = hacerDecorado(vj.pos.x, vj.pos.z);
    if (vj.haciendo) {
      const t2 = performance.now(); let r;
      // (deGolpe: solo para romper la prueba a propósito: todo en un fotograma, como antes)
      do r = vj.haciendo.next(); while (!r.done && (vj.deGolpe || performance.now() - t2 < MS_FOTOGRAMA));
      if (r.done) { vj.haciendo = null; vj.rehechos++; ponerDecorado(r.value); }
    }
    // lo que se ha tardado en este fotograma en el suelo y el decorado (sin el primero tras entrar, que es la carga)
    const ms = performance.now() - t1;
    if (vj.fotogramas++ > 2 && ms > vj.msMax) vj.msMax = ms;
    medir();
  };
  // los árboles que quedan entre la cámara y el personaje no se dibujan (si no, una copa tapa media pantalla)
  const _o = new THREE.Object3D(), _cero = new THREE.Matrix4().makeScale(0, 0, 0);
  function destapar() {
    if (!vj.arboles) return;
    const P = vj.pos, C = est.camara.position, vx = C.x - P.x, vz = C.z - P.z, l2 = vx * vx + vz * vz || 1;
    const ahora = new Set();
    for (const [lista, im, esp] of vj.arboles) lista.forEach((e, k) => {
      const u = ((e[0] - P.x) * vx + (e[2] - P.z) * vz) / l2;
      if (u * Math.sqrt(l2) < -1 || u > 1.1) return;   // también los que están pegados al personaje
      const d = Math.hypot(e[0] - P.x - vx * u, e[2] - P.z - vz * u), [radio, alto] = TAMANO[esp];
      if (d < e[3] * radio + 1 && e[1] + e[3] * alto > P.y + (C.y - P.y) * u - 1) ahora.add(im.name + ':' + k);
    });
    let cambio = new Set();
    for (const [lista, im] of vj.arboles) {
      lista.forEach((e, k) => {
        const id = im.name + ':' + k, antes = vj.tapan.has(id), ya = ahora.has(id);
        if (antes === ya) return;
        if (ya) im.setMatrixAt(k, _cero);
        else { _o.position.set(e[0], e[1], e[2]); _o.rotation.set(0, e[4], 0); _o.scale.setScalar(e[3]); _o.updateMatrix(); im.setMatrixAt(k, _o.matrix); }
        cambio.add(im);
      });
    }
    for (const im of cambio) im.instanceMatrix.needsUpdate = true;
    vj.tapan = ahora;
  }
  // tocar el suelo (sin arrastrar) para andar
  const lienzo = est.renderer.domElement, ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let abajo = null;
  lienzo.addEventListener('pointerdown', (e) => { abajo = { x: e.clientX, y: e.clientY }; });
  lienzo.addEventListener('pointerup', (e) => {
    if (!vj.activo || !abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 8) return;
    const rc = lienzo.getBoundingClientRect();
    ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, est.camara);
    const hit = ray.intersectObjects(grupoTrozos.children.filter(m => m.visible), false)[0];
    if (hit) vj.destino = hit.point.clone();
  });
  // pone la cámara del juego alrededor del personaje: inclinación (rad), distancia (m) y giro (rad)
  vj.camara = (pitch, dist, yaw) => {
    const t = est.control.target.set(vj.pos.x, vj.pos.y + 1.2, vj.pos.z);
    est.camara.position.set(t.x + Math.cos(yaw) * Math.cos(pitch) * dist, t.y + Math.sin(pitch) * dist, t.z + Math.sin(yaw) * Math.cos(pitch) * dist);
    est.control.update();
  };
  // para las pruebas: un punto al pie de una pared de roca cerca del centro del trozo, y hacia dónde queda la pared
  vj.paredCercana = () => {
    const c = vj.centro; if (!c) return null; const { n, H } = c, P = PASO;
    let mejor = null;
    for (let j = 3; j < n - 3; j++) for (let i = 3; i < n - 3; i++) {
      const k = j * n + i, gx = (H[k + 1] - H[k - 1]) / (2 * P), gz = (H[k + n] - H[k - n]) / (2 * P), s = Math.hypot(gx, gz);
      if (s < 1.3) continue;
      const x = c.x0 + i * P, z = c.z0 + j * P, d = Math.hypot(x - c.px, z - c.pz);
      if (!mejor || d < mejor.d) mejor = { d, x: x - gx / s * 9, z: z - gz / s * 9, dir: Math.atan2(gz, gx) };
    }
    return mejor;
  };
  vj.andarA = (x, z) => { vj.destino = new THREE.Vector3(x, 0, z); };
  return vj;
}

// la hierba y las flores, con sus caras por los dos lados
let matHierba = null, matFlor = null;
function materialHierba() { return (matHierba ||= new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide })); }
function materialFlor() { return (matFlor ||= new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true })); }
