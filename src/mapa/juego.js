// Kinhold — el paisaje «como en el juego»: alrededor del personaje, un trozo de terreno con todo el detalle (rejilla de
// 1 m, relieve de hasta 2 m, sombras), con hierba, flores, matorrales, piedras y árboles completos del estilo v5,
// colocados con las mismas reglas que el bosque de lejos (bioma, pendiente, claros). Lo de más allá es el paisaje de
// lejos (4 × 4 km), que se hunde bajo el trozo de cerca para no asomar. Se anda tocando el suelo; si te alejas, el
// trozo de cerca se rehace donde estás.
import * as THREE from 'three';
import { modelosArbol, modelosPlantas, azar } from '../mundo/decorado.js';
import { materialTex } from '../mundo/estilos.js';
import { bosqueEn } from '../logica/paisaje.js';
import { fbm } from '../logica/mapa.js';
import { crearJugador } from '../juego/personaje.js';
import { colorDelSuelo, lin, poblarArboles, ROCAS_COLOR, aguaLejos, aguaCerca } from './cerca.js';
import { atributosAgua, distanciaOrilla } from './agua.js';

const movil = Math.min(innerWidth, innerHeight) < 700;
export const CERCA = movil ? 170 : 240;           // lado del trozo con todo el detalle (m)
const PASO = movil ? 1.25 : 1;                     // rejilla (m)
const R_HIERBA = movil ? 48 : 80;                  // radio con hierba (m)
const MAX = movil ? { hierba: 9000, flores: 900, matas: 400, rocas: 250, arboles: 1500 } : { hierba: 30000, flores: 2600, matas: 1200, rocas: 600, arboles: 4000 };
const ANCHO = 0.8;                                 // los árboles, algo más altos que anchos
const TIERRA = [0.5, 0.42, 0.31], HOJARASCA = [0.4, 0.36, 0.24];
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v7/';
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
      let c = colorDelSuelo(st, y, s, xm, ym);
      // calvas de tierra en el prado y en el bosque, y algo de variación de cerca
      if (st && st.bioma && st.bioma !== 'nieve' && s < 0.6) { const t = suave(0.62, 0.74, fbm(xm / 16, ym / 16, 41, 3)); c = c.map((v, q) => v + (TIERRA[q] - v) * t * 0.7); }
      // bajo el bosque, el suelo es de hojarasca (más pardo y oscuro)
      if (st && st.bioma && st.bioma !== 'nieve') { const claro = fbm(xm / 380, ym / 380, 31, 4) * 0.7 + fbm(xm / 90, ym / 90, 33, 3) * 0.3, d = bosqueEn(st.bioma, st.T, s, claro, 0).d; c = c.map((v, q) => v + (HOJARASCA[q] - v) * d * 0.45); }
      const lap = (alt(i + 2, j) + alt(i - 2, j) + alt(i, j + 2) + alt(i, j - 2) - 4 * y) / (4 * PASO * PASO);
      const v = 1 - Math.max(-0.1, Math.min(0.15, lap * 1.5)) + (fbm(xm / 5, ym / 5, 43, 3) - 0.5) * 0.16;
      col.set([lin(c[0]) * v, lin(c[1]) * v, lin(c[2]) * v], k * 3);
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6); let p = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1; idx.set([a, c2, b, b, c2, d], p); p += 6; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
    const terreno = new THREE.Mesh(geo, materialTex('suelo')); terreno.receiveShadow = true; terreno.name = 'terrenoCerca'; g.add(terreno);
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
      atributosAgua(ga, { flujo: fl, hondo: ho, tipo: ti, ola: ol, orilla: distanciaOrilla(seco, n, PASO, 60, sem) });
      const lamina = new THREE.Mesh(ga, aguaCerca()); lamina.name = 'aguaCerca'; lamina.receiveShadow = true; g.add(lamina);
    }
    aguaLejos().ponerHueco(x0, z0, x0 + (n - 1) * PASO, z0 + (n - 1) * PASO);

    // lo que crece y lo que hay en el suelo, con las reglas del bosque de lejos
    const r = azar((Math.round(cx + px) * 73856093) ^ (Math.round(cy + pz) * 19349663) ^ 77);
    const sitioEn = (x, z) => { const i = Math.round((x - x0) / PASO), j = Math.round((z - z0) / PASO); const k = Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i)); const y = vj.altura(x, z); return { st: W[k] > y - 0.3 ? null : sitios[k], s: pend[k], y }; };   // en el agua (o en su orilla) no crece nada
    const espesor = (x, z, st, s) => {
      const xm = cx + x, ym = cy + z;
      const claro = fbm(xm / 380, ym / 380, 31, 4) * 0.7 + fbm(xm / 90, ym / 90, 33, 3) * 0.3;
      return bosqueEn(st.bioma, st.T, s, claro, 0);
    };
    const L = { pino: [], frond: [], hierba: [], flores: [], matas: [], rocas: [] };
    const dentro = (x, z, m = 2) => Math.abs(x - px) < CERCA / 2 - m && Math.abs(z - pz) < CERCA / 2 - m;
    // árboles: rejilla desordenada de 4,5 m
    for (let z = z0 + 2; z < z0 + CERCA - 2; z += 4.5) for (let x = x0 + 2; x < x0 + CERCA - 2; x += 4.5) {
      const ax = x + (r() - 0.5) * 4, az = z + (r() - 0.5) * 4, { st, s, y } = sitioEn(ax, az);
      if (!st || !st.bioma || y < 1.5) continue;
      const { d, pino } = espesor(ax, az, st, s);
      if (r() > d * 0.55) continue;                                        // 0,55: de cerca, la densidad de un bosque de verdad
      (pino ? L.pino : L.frond).push([ax, y - 0.2, az, (pino ? 1.75 : 1.55) * (0.75 + r() * 0.5), r() * 6.3, 0.8 + r() * 0.35]);   // del tamaño de los del juego (7–11 m)
    }
    // hierba, flores y matorrales: más en los claros que bajo el bosque
    for (let z = pz - R_HIERBA; z < pz + R_HIERBA; z += 0.85) for (let x = px - R_HIERBA; x < px + R_HIERBA; x += 0.85) {
      const hx = x + (r() - 0.5) * 0.8, hz = z + (r() - 0.5) * 0.8;
      if (Math.hypot(hx - px, hz - pz) > R_HIERBA || !dentro(hx, hz)) continue;
      const { st, s, y } = sitioEn(hx, hz);
      if (!st || !st.bioma || st.bioma === 'nieve' || y < 1 || s > 0.75) continue;
      const { d } = espesor(hx, hz, st, s), xm = cx + hx, ym = cy + hz;
      const prado = { pradera: 1, mixto: 0.8, caducifolio: 0.7, encinar: 0.55, taiga: 0.5, brezal: 0.6, matorral: 0.45, turbera: 0.8, alpino: 0.6 }[st.bioma] ?? 0.5;
      const calva = suave(0.6, 0.72, fbm(xm / 16, ym / 16, 41, 3));
      const pHierba = prado * (1 - 0.75 * d) * (1 - calva) * (0.55 + 0.45 * fbm(xm / 7, ym / 7, 45, 2));
      const t = r();
      if (t < pHierba) L.hierba.push([hx, y, hz, 0.8 + r() * 0.9, r() * 6.3, 0.85 + r() * 0.3]);
      else if (t < pHierba + 0.035 * prado * (1 - d)) L.flores.push([hx, y, hz, 0.8 + r() * 0.5, r() * 6.3, Math.floor(r() * 3)]);
      else if (t < pHierba + 0.035 * prado * (1 - d) + 0.007 * (0.4 + d * (1 - d) * 3) + 0.02 * d) L.matas.push([hx, y - 0.05, hz, 0.5 + r() * 0.6, r() * 6.3, 0.85 + r() * 0.3]);
    }
    // piedras: sueltas, y más en lo empinado (donde asoma la roca)
    for (let z = z0 + 2; z < z0 + CERCA - 2; z += 3.5) for (let x = x0 + 2; x < x0 + CERCA - 2; x += 3.5) {
      const ax = x + (r() - 0.5) * 3, az = z + (r() - 0.5) * 3, { st, s, y } = sitioEn(ax, az);
      if (!st || !st.bioma || y < 0.5) continue;
      if (r() > 0.012 + 0.35 * suave(0.45, 0.95, s)) continue;
      L.rocas.push([ax, y - 0.15, az, 0.35 + r() * (s > 0.5 ? 1.6 : 0.7), r() * 6.3, st.roca]);
    }
    // recorte a lo que aguanta el aparato
    for (const [k, m] of [['hierba', MAX.hierba], ['flores', MAX.flores], ['matas', MAX.matas], ['rocas', MAX.rocas]]) if (L[k].length > m) { const q = m / L[k].length; L[k] = L[k].filter(() => r() < q); }
    const totalArb = L.pino.length + L.frond.length;
    if (totalArb > MAX.arboles) { const q = MAX.arboles / totalArb; L.pino = L.pino.filter(() => r() < q); L.frond = L.frond.filter(() => r() < q); }

    const arb = modelosArbol(), pl = modelosPlantas(), o = new THREE.Object3D(), c = new THREE.Color();
    const poner = (lista, geo, mats, nombre, { ancho = 1, sombra = false, color = (e) => c.setScalar(e[5]) } = {}) => {
      if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mats, lista.length);
      lista.forEach((e, k) => { o.position.set(e[0], e[1], e[2]); o.rotation.set(0, e[4], 0); o.scale.set(e[3] * ancho, e[3], e[3] * ancho); o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, color(e)); });
      im.castShadow = sombra; im.receiveShadow = true; im.name = nombre; g.add(im);
    };
    poner(L.pino, arb.pino.geo, arb.pino.mats, 'pinosCerca', { ancho: ANCHO, sombra: true });
    poner(L.frond, arb.frond.geo, arb.frond.mats, 'frondososCerca', { ancho: ANCHO, sombra: true });
    vj.arboles = [[L.pino, g.getObjectByName('pinosCerca')], [L.frond, g.getObjectByName('frondososCerca')]].filter(a => a[1]);
    vj.tapan = new Set();
    poner(L.hierba, pl.mata, materialHierba(), 'hierba');
    const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];
    poner(L.flores, pl.flor, materialFlor(), 'flores', { color: (e) => c.set(FLORES[e[5]]) });
    poner(L.matas, pl.matorral.geo, pl.matorral.mats, 'matorralesCerca', { sombra: true });
    poner(L.rocas, pl.roca.geo, pl.roca.mats, 'rocasCerca', { sombra: true, color: (e) => { const k = ROCAS_COLOR[e[5]] || ROCAS_COLOR.caliza; return c.setRGB(lin(k[0]) / 0.4, lin(k[1]) / 0.4, lin(k[2]) / 0.4); } });

    est.raiz.add(g); vj.grupo = g;
    hundirLejos(px, pz);
    poblarArboles(null, (x, z) => Math.abs(x - px) < CERCA / 2 && Math.abs(z - pz) < CERCA / 2);
    const tris = (gg) => (gg.index ? gg.index.count : gg.attributes.position.count) / 3;
    vj.medidas = {
      ms: Math.round(performance.now() - t0), rejilla: n, pasoM: PASO,
      arboles: L.pino.length + L.frond.length, hierba: L.hierba.length, flores: L.flores.length, matas: L.matas.length, rocas: L.rocas.length,
      triangulos: Math.round(idx.length / 3 + L.pino.length * tris(arb.pino.geo) + L.frond.length * tris(arb.frond.geo) + L.hierba.length * tris(pl.mata) + L.matas.length * tris(pl.matorral.geo)),
    };
    window.__cerca.juego = vj.medidas; window.__cerca.vj = vj;
  }

  vj.entrar = (px, pz, dir = 0) => {
    vj.activo = true; ayuda().hidden = false;
    construir(px, pz);
    est.amb.sol.castShadow = true;
    if (!vj.jugador) { vj.jugador = crearJugador(RECURSOS_MH); vj.jugador.raiz.traverse(m => { if (m.isMesh) m.castShadow = true; }); }
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
    quitarGrupo(); devolverLejos(); vj.centro = null; aguaLejos().quitarHueco();
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
        vj.pos.x += dx / d * paso; vj.pos.z += dz / d * paso; vj.pos.y = vj.altura(vj.pos.x, vj.pos.z);
        vj.jugador.raiz.rotation.y = Math.atan2(dx, dz);
        const mov = vj.pos.clone().sub(antes);
        est.camara.position.add(mov); est.control.target.add(mov);
      }
    }
    vj.jugador.raiz.position.copy(vj.pos);
    vj.jugador.animar(vel, dt);
    destapar();
    est.amb.seguir(vj.pos.x, vj.pos.z, vj.pos.y);
    const c = vj.centro;
    if (c && Math.hypot(vj.pos.x - c.px, vj.pos.z - c.pz) > CERCA / 2 - 50 && !vj.destino) construir(vj.pos.x, vj.pos.z);
  };
  // los árboles que quedan entre la cámara y el personaje no se dibujan (si no, una copa tapa media pantalla)
  const _o = new THREE.Object3D(), _cero = new THREE.Matrix4().makeScale(0, 0, 0);
  function destapar() {
    if (!vj.arboles) return;
    const P = vj.pos, C = est.camara.position, vx = C.x - P.x, vz = C.z - P.z, l2 = vx * vx + vz * vz || 1;
    const ahora = new Set();
    for (const [lista, im] of vj.arboles) lista.forEach((e, k) => {
      const u = ((e[0] - P.x) * vx + (e[2] - P.z) * vz) / l2;
      if (u * Math.sqrt(l2) < -1 || u > 1.1) return;   // también los que están pegados al personaje
      const d = Math.hypot(e[0] - P.x - vx * u, e[2] - P.z - vz * u);
      if (d < e[3] * 1.4 + 1 && e[1] + e[3] * 5 > P.y + (C.y - P.y) * u - 1) ahora.add(im.name + ':' + k);
    });
    let cambio = new Set();
    for (const [lista, im] of vj.arboles) {
      lista.forEach((e, k) => {
        const id = im.name + ':' + k, antes = vj.tapan.has(id), ya = ahora.has(id);
        if (antes === ya) return;
        if (ya) im.setMatrixAt(k, _cero);
        else { _o.position.set(e[0], e[1], e[2]); _o.rotation.set(0, e[4], 0); _o.scale.set(e[3] * ANCHO, e[3], e[3] * ANCHO); _o.updateMatrix(); im.setMatrixAt(k, _o.matrix); }
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
  vj.andarA = (x, z) => { vj.destino = new THREE.Vector3(x, 0, z); };
  return vj;
}

// la hierba y las flores, con sus caras por los dos lados
let matHierba = null, matFlor = null;
function materialHierba() { return (matHierba ||= new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide })); }
function materialFlor() { return (matFlor ||= new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true })); }
