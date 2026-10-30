// Kinhold — el paisaje «como en el juego»: alrededor del personaje, un trozo de terreno con todo el detalle (rejilla de
// 1 m, relieve de hasta 2 m, sombras), con hierba, flores, matorrales, piedras y árboles completos del estilo v5,
// colocados con las mismas reglas que el bosque de lejos (bioma, pendiente, claros). Lo de más allá es el paisaje de
// lejos (4 × 4 km), que se hunde bajo el trozo de cerca para no asomar. Se anda tocando el suelo; si te alejas, el
// trozo de cerca se rehace donde estás.
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
import { colorJuego } from '../mundo/color_suelo.js';
const _c = [0, 0, 0];
import { modelosRocaPared, materialRoca } from '../mundo/rocas.js';

const movil = Math.min(innerWidth, innerHeight) < 700;
export const CERCA = movil ? 170 : 240;           // lado del trozo con todo el detalle (m)
const PASO = movil ? 1.25 : 1;                     // rejilla (m)
const R_HIERBA = movil ? 48 : 80;                  // radio con hierba (m)
const R_ARBOL = movil ? 60 : 80;                   // radio con los árboles enteros; más allá, con la forma sencilla (m)
const MAX = movil ? { hierba: 9000, flores: 900, matas: 400, rocas: 250, arboles: 1500, paredes: 700 } : { hierba: 30000, flores: 2600, matas: 1200, rocas: 600, arboles: 4000, paredes: 2400 };
// radio de la copa y alto (m) de cada especie a escala 1, para no dibujar los que tapan al personaje
const TAMANO = { abeto: [2.1, 10.5], pino: [2.3, 9.5], abedul: [1.6, 9], roble: [3.2, 7.5], haya: [2.3, 10.8], fresno: [2.6, 9.2], encina: [2.6, 5.5] };
const totalArbCerca = (L) => ESPECIES.reduce((n, e) => n + L.arboles[e].length, 0);
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function crearVistaJuego(est) {
  const vj = { activo: false, grupo: null, jugador: null, destino: null, centro: null, hundidos: null };
  const ayuda = () => document.getElementById('juegoAyuda');

  // la altura de cerca (con todo el detalle) en la escena; fuera del trozo, la de lejos
  vj.altura = (x, z) => {
    const c = vj.centro; if (!c) return est.alturaEn(x, z);
    const gi = (x - c.x0) / PASO, gj = (z - c.z0) / PASO, i = Math.floor(gi), j = Math.floor(gj);
    if (i < 0 || j < 0 || i >= c.n - 1 || j >= c.n - 1) return est.alturaEn(x, z);
    const fx = gi - i, fy = gj - j, H = c.H, n = c.n;
    return H[j * n + i] * (1 - fx) * (1 - fy) + H[j * n + i + 1] * fx * (1 - fy) + H[(j + 1) * n + i] * (1 - fx) * fy + H[(j + 1) * n + i + 1] * fx * fy;
  };

  function quitarGrupo() {
    if (!vj.grupo) return;
    est.raiz.remove(vj.grupo);
    vj.grupo.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh) o.geometry.dispose(); });
    vj.grupo = null;
  }
  // hunde el terreno de lejos bajo el trozo de cerca (y lo devuelve a su sitio al salir)
  function hundirLejos(px, pz) {
    devolverLejos();
    const pos = est.terreno.geometry.attributes.position, m = CERCA / 2 - 14, lista = [];
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), z = pos.getZ(k); if (Math.abs(x - px) < m && Math.abs(z - pz) < m) { lista.push(k, pos.getY(k)); pos.setY(k, pos.getY(k) - 6); } }
    pos.needsUpdate = true; vj.hundidos = lista;
  }
  function devolverLejos() {
    if (!vj.hundidos || !est.terreno) return;
    const pos = est.terreno.geometry.attributes.position, l = vj.hundidos;
    for (let k = 0; k < l.length; k += 2) pos.setY(l[k], l[k + 1]);
    pos.needsUpdate = true; vj.hundidos = null;
  }

  function construir(px, pz) {
    const t0 = performance.now();
    quitarGrupo();
    const pai = est.paisaje, { cx, cy } = est.centro, tramos = est.tramos;
    const n = Math.round(CERCA / PASO) + 1, x0 = px - CERCA / 2, z0 = pz - CERCA / 2;
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = pai.altura(cx + x0 + i * PASO, cy + z0 + j * PASO, tramos, true);
    vj.centro = { x0, z0, n, H, px, pz };
    const alt = (i, j) => H[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
    const g = new THREE.Group(); g.name = 'juego';
    // terreno
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    const pend = new Float32Array(n * n), sitios = new Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, x = x0 + i * PASO, z = z0 + j * PASO, y = H[k], xm = cx + x, ym = cy + z;
      pos.set([x, y, z], k * 3); uv[k * 2] = x * 0.5; uv[k * 2 + 1] = z * 0.5;
      // pendiente con vecinos a 3 m (la de la forma del terreno, no la de cada piedrecita)
      const s = Math.hypot(alt(i + 3, j) - alt(i - 3, j), alt(i, j + 3) - alt(i, j - 3)) / (6 * PASO); pend[k] = s;
      const st = y > 0.05 ? pai.sitio(xm, ym, y) : null; sitios[k] = st;
      const s1 = Math.hypot(alt(i + 1, j) - alt(i - 1, j), alt(i, j + 1) - alt(i, j - 1)) / (2 * PASO);
      const lap = (alt(i + 2, j) + alt(i - 2, j) + alt(i, j + 2) + alt(i, j - 2) - 4 * y) / (4 * PASO * PASO);
      col.set(colorJuego(st, y, s, s1, lap, xm, ym, _c), k * 3);
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6); let p = 0;
    // cada cuadro se parte por la diagonal que mejor sigue al terreno (la de menos desnivel): así una arista o el borde de
  // un estrato en diagonal a la rejilla no sale en zigzag
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
    if (Math.abs(H[a] - H[d]) < Math.abs(H[b] - H[c2])) idx.set([a, c2, d, a, d, b], p); else idx.set([a, c2, b, b, c2, d], p);
    p += 6;
  }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
    const terreno = new THREE.Mesh(geo, materialSuelo()); terreno.receiveShadow = true; terreno.name = 'terrenoCerca'; g.add(terreno);
    vj.terreno = terreno;
    // el agua en el trozo de cerca (ríos y mar): una lámina a la altura del agua sobre la misma rejilla; donde corta el
    // terreno sale la orilla, lisa. Cada vértice lleva su hondura, la corriente del río y, en el mar, el oleaje (que se
    // apaga en lo somero y en el borde del trozo, donde sigue el mar de lejos, plano)
    const W = new Float32Array(n * n).fill(NaN), T = new Uint8Array(n * n);
    let hayAgua = false;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, w = pai.agua(cx + x0 + i * PASO, cy + z0 + j * PASO, tramos);
      if (w !== null) { W[k] = w; hayAgua = true; } else if (H[k] < 0.3) { W[k] = 0; T[k] = 1; hayAgua = true; }
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
      }
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
        if (isNaN(W[a]) && isNaN(W[b]) && isNaN(W[c2]) && isNaN(W[d])) continue;
        ia.push(a, c2, b, b, c2, d);
      }
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
      const lamina = new THREE.Mesh(ga, aguaCerca()); lamina.name = 'aguaCerca'; lamina.receiveShadow = true; g.add(lamina);
    }
    aguaLejos().ponerHueco(x0, z0, x0 + (n - 1) * PASO, z0 + (n - 1) * PASO);

    // lo que crece y lo que hay en el suelo, con las reglas del bosque de lejos
    // El azar de cada cosa sale de su celda en el MUNDO (no del trozo de cerca) y de la semilla del mundo: así, al
    // rehacer el trozo en otro sitio, lo que ya estaba sale exactamente igual (cada árbol, mata y piedra en su sitio).
    // recorrer(paso, …): las celdas del mundo de ese tamaño que caen dentro del trozo, cada una con su azar propio.
    // (azarCentro: solo para romper la prueba a propósito, como era antes: el azar cambia con el centro del trozo)
    const SEM = ((est.paisaje.mapa && est.paisaje.mapa.semilla) || 0) + (vj.azarCentro ? Math.round(px * 7 + pz * 13) : 0);
    const recorrer = (paso, capa, margen, fn) => {
      const i0 = Math.ceil((cx + x0 + margen) / paso), i1 = Math.floor((cx + x0 + CERCA - margen) / paso);
      const j0 = Math.ceil((cy + z0 + margen) / paso), j1 = Math.floor((cy + z0 + CERCA - margen) / paso);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i * paso - cx, j * paso - cy, azarCelda(i, j, capa, SEM));
    };
    const sitioEn = (x, z) => { const i = Math.round((x - x0) / PASO), j = Math.round((z - z0) / PASO); const k = Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i)); const y = vj.altura(x, z); return { st: W[k] > y - 0.3 ? null : sitios[k], s: pend[k], y }; };   // en el agua (o en su orilla) no crece nada
    const espesor = (x, z, st, s, u = 0.5) => bosqueEn(st, s, cx + x, cy + z, { semilla: SEM, u });
    const L = { arboles: Object.fromEntries(ESPECIES.map(e => [e, []])), hierba: [], flores: [], matas: [], rocas: [] };
    const dentro = (x, z, m = 2) => Math.abs(x - px) < CERCA / 2 - m && Math.abs(z - pz) < CERCA / 2 - m;
    // árboles: rejilla desordenada de 4,5 m
    recorrer(4.5, 1, 2, (x, z, r) => {
      const ax = x + (r() - 0.5) * 4, az = z + (r() - 0.5) * 4, { st, s, y } = sitioEn(ax, az);
      if (!st || !st.bioma || y < 1.5) return;
      const { d, especie, tam } = espesor(ax, az, st, s, r());
      if (r() > d * 0.55) return;                                          // 0,55: de cerca, la densidad de un bosque de verdad
      // del tamaño de los del juego (6–11 m), ±15 % cada uno; [x, y, z, escala, giro, tono]
      L.arboles[especie].push([ax, y - 0.2, az, tam * (0.85 + r() * 0.3), r() * 6.3, 0.82 + r() * 0.3]);
    });
    // hierba, flores y matorrales: más en los claros que bajo el bosque
    recorrer(0.85, 2, CERCA / 2 - R_HIERBA - 1, (x, z, r) => {
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
    recorrer(2.5, 3, 2, (x, z, r) => {
      const ax = x + (r() - 0.5) * 2.2, az = z + (r() - 0.5) * 2.2, { st, s, y } = sitioEn(ax, az);
      if (!st || !st.bioma || y < 0.5 || s > 0.8) return;
      const pie = s < 0.7 && paredCerca(ax, az) > 1.1;
      if (r() > (pie ? 0.45 : 0.006)) return;
      L.rocas.push([ax, y - 0.2, az, pie ? 0.5 + r() * 1.5 : 0.3 + r() * 0.6, r() * 6.3, st.roca]);
    });
    // la roca de los cortados: piezas de roca 3D encajadas en las paredes, de 2 a 8 m, mirando hacia fuera de la pared
    // y medio metidas en ella; en las paredes más altas, más grandes
    const PR = [];
    recorrer(2.6, 4, 3, (x, z, r) => {
      const ax = x + (r() - 0.5) * 2, az = z + (r() - 0.5) * 2, gi = Math.round((ax - x0) / PASO), gj = Math.round((az - z0) / PASO);
      const gx = (alt(gi + 1, gj) - alt(gi - 1, gj)) / (2 * PASO), gz = (alt(gi, gj + 1) - alt(gi, gj - 1)) / (2 * PASO), s = Math.hypot(gx, gz);
      if (s < 1.15 || r() > 0.4 || !isNaN(W[gj * n + gi])) return;   // en el agua (el salto) no
      const y = vj.altura(ax, az); if (y < -0.5) return;
      const nx = -gx / s, nz = -gz / s, alto = 2 + r() * 2.5 + Math.min(3, s);
      const roca = sitioEn(ax, az).st?.roca || sitios[gj * n + gi]?.roca;
      PR.push([ax + nx * alto * 0.05, y - alto * 0.2, az + nz * alto * 0.05, alto, Math.atan2(nx, nz) + (r() - 0.5) * 0.5, Math.floor(r() * 5), (r() - 0.5) * 0.25, 0.85 + r() * 0.3, roca]);
      // en una pared alta (más de 8 m de la base al borde), más piezas apiladas hasta arriba, cada 4 a 5 m
      const arriba = vj.altura(ax - nx * 4, az - nz * 4), abajo = vj.altura(ax + nx * 4, az + nz * 4);
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

    const arb = modelosEspecies(), arbS = modelosEspecies({ sencillo: true }), pl = modelosPlantas(), o = new THREE.Object3D(), c = new THREE.Color();
    const poner = (lista, geo, mats, nombre, { ancho = 1, sombra = false, color = (e) => c.setScalar(e[5]) } = {}) => {
      if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mats, lista.length);
      lista.forEach((e, k) => { o.position.set(e[0], e[1], e[2]); o.rotation.set(0, e[4], 0); o.scale.set(e[3] * ancho, e[3], e[3] * ancho); o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, color(e)); });
      im.castShadow = sombra; im.receiveShadow = true; im.name = nombre; g.add(im);
    };
    // los árboles a más de R_ARBOL m del personaje, con la forma sencilla (menos caras; de ahí en adelante no se nota)
    vj.arboles = [];
    for (const e of ESPECIES) {
      const cerca = L.arboles[e].filter(a => Math.hypot(a[0] - px, a[2] - pz) < R_ARBOL), lejos = L.arboles[e].filter(a => Math.hypot(a[0] - px, a[2] - pz) >= R_ARBOL);
      poner(cerca, arb[e].geo, arb[e].mats, 'arbolesCerca_' + e, { sombra: true });
      poner(lejos, arbS[e].geo, arbS[e].mats, 'arbolesMedios_' + e, { sombra: true });
      vj.arboles.push([cerca, g.getObjectByName('arbolesCerca_' + e), e], [lejos, g.getObjectByName('arbolesMedios_' + e), e]);
    }
    vj.arboles = vj.arboles.filter(a => a[1]);
    vj.tapan = new Set();
    poner(L.hierba, pl.mata, materialHierba(), 'hierba');
    const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];
    poner(L.flores, pl.flor, materialFlor(), 'flores', { color: (e) => c.set(FLORES[e[5]]) });
    poner(L.matas, pl.matorral.geo, pl.matorral.mats, 'matorralesCerca', { sombra: true });
    L.paredes = recortar(L.paredes, MAX.paredes);
    vj.L = L;
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

    est.raiz.add(g); vj.grupo = g;
    // el suelo de lejos no se dibuja bajo el trozo de cerca (salvo un borde de 3 m, que queda debajo y tapa la junta)
    materialSuelo({ lejos: true }).ponerHueco(x0 + 3, z0 + 3, x0 + (n - 1) * PASO - 3, z0 + (n - 1) * PASO - 3);
    poblarArboles(null, (x, z) => Math.abs(x - px) < CERCA / 2 && Math.abs(z - pz) < CERCA / 2);
    const tris = (gg) => (gg.index ? gg.index.count : gg.attributes.position.count) / 3;
    vj.medidas = {
      ms: Math.round(performance.now() - t0), rejilla: n, pasoM: PASO,
      arboles: totalArbCerca(L), especies: Object.fromEntries(ESPECIES.map(e => [e, L.arboles[e].length])), hierba: L.hierba.length, flores: L.flores.length, matas: L.matas.length, rocas: L.rocas.length, paredes: L.paredes.length,
      triangulos: Math.round(idx.length / 3 + L.paredes.length * tris(modelosRocaPared()[0]) + vj.arboles.reduce((n, [l, im]) => n + l.length * tris(im.geometry), 0) + L.hierba.length * tris(pl.mata) + L.matas.length * tris(pl.matorral.geo)),
    };
    window.__cerca.juego = vj.medidas; window.__cerca.vj = vj;
  }

  vj.entrar = (px, pz, dir = 0) => {
    vj.activo = true; ayuda().hidden = false;
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
  };
  vj.salir = () => {
    if (!vj.activo) return;
    vj.activo = false; ayuda().hidden = true;
    quitarGrupo(); devolverLejos(); vj.centro = null; aguaLejos().quitarHueco(); materialSuelo({ lejos: true }).quitarHueco();
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
    vj.jugador.raiz.position.copy(vj.pos);
    vj.jugador.animar(vel, dt);
    destapar();
    est.amb.seguir(vj.pos.x, vj.pos.z, vj.pos.y);
    // la cámara nunca por debajo del suelo (al girarla mucho se metía en la ladera y se veía el cielo por debajo)
    const cam = est.camara.position, suelo = vj.altura(cam.x, cam.z) + 1.5;
    if (cam.y < suelo) cam.y = suelo;
    const c = vj.centro;
    if (c && Math.hypot(vj.pos.x - c.px, vj.pos.z - c.pz) > CERCA / 2 - 50 && !vj.destino) construir(vj.pos.x, vj.pos.z);
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
    const hit = ray.intersectObject(vj.terreno, false)[0];
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
