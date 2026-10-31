// Comprueba que los valles de los ríos no dejan paredes lisas y rectas de kilómetros (valravnx, 31 oct: «una separación
// de alturas anormal recta que ocupa kilómetros [...] esto no puede pasar en NINGÚN LUGAR DEL MUNDO»).
// En toda Whitholm, en una rejilla de 25 m alrededor de los ríos, se mira dónde el valle del río ha rebajado el terreno
// más de 20 m (la altura con los ríos frente a la de sin ellos) y, de eso, lo que ha quedado como un plano liso (sin
// relieve: la curvatura en la rejilla casi nula). Las manchas de plano liso unidas se miden a lo largo: ninguna puede
// pasar de 800 m (antes del arreglo, la más larga medía 1,6 km y había más de una de 1 km), y lo liso tiene que ser
// menos del 11 % de lo tallado (antes, el 13 %).
// Uso: node pruebas/prueba_valles.mjs   MUTAR=1 → las laderas de antes (planos lisos y rectos): tiene que fallar.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA } from '../src/logica/whitholm.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

const t0 = Date.now();
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const pai = crearPaisaje(mapa, { valleLiso: MUTAR === '1' });
const P = 25, B = 2000, W = Math.ceil((ISLA.x1 - ISLA.x0) / P), H = Math.ceil((ISLA.z1 - ISLA.z0) / P);
const z = new Float32Array(W * H).fill(NaN), corte = new Float32Array(W * H);

// los cuadros de 2 km con algún río a menos de 1,5 km (lo demás no lo toca ningún valle)
const cerca = new Set();
for (const r of pai.rios) for (const q of r) {
  const x = q.p[0] * 1000, y = q.p[1] * 1000;
  for (let dy = -1500; dy <= 1500; dy += 500) for (let dx = -1500; dx <= 1500; dx += 500) {
    const i = Math.floor((x + dx - ISLA.x0) / B), j = Math.floor((y + dy - ISLA.z0) / B);
    if (i >= 0 && j >= 0 && i * B < ISLA.x1 - ISLA.x0 && j * B < ISLA.z1 - ISLA.z0) cerca.add(i + ',' + j);
  }
}
for (const c of cerca) {
  const [bi, bj] = c.split(',').map(Number), bx = ISLA.x0 + bi * B, bz = ISLA.z0 + bj * B;
  const tr = pai.riosEn(bx, bz, bx + B, bz + B, 2600);
  for (let j = bj * B / P; j < Math.min(H, (bj + 1) * B / P); j++) for (let i = bi * B / P; i < Math.min(W, (bi + 1) * B / P); i++) {
    const x = ISLA.x0 + i * P, y = ISLA.z0 + j * P, k = j * W + i;
    z[k] = pai.altura(x, y, tr); corte[k] = pai.altura(x, y, null) - z[k];
  }
}

// lo tallado (más de 20 m, en ladera) y, de eso, lo liso: la curvatura (laplaciana en la rejilla) casi nula
const liso = new Uint8Array(W * H);
let tallado = 0, lisos = 0;
for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
  const k = j * W + i;
  if (!(corte[k] > 20) || z[k] < 1) continue;
  const a = z[k - 1], b = z[k + 1], c = z[k - W], d = z[k + W];
  if ([a, b, c, d].some(Number.isNaN)) continue;
  if (Math.hypot(b - a, d - c) / (2 * P) < 0.1) continue;
  tallado++;
  if (Math.abs(a + b + c + d - 4 * z[k]) < 0.3125) { liso[k] = 1; lisos++; }
}
// las manchas de liso unidas, y su largo (4 desviaciones típicas a lo largo de su eje mayor)
const visto = new Uint8Array(W * H), largos = [];
for (let k0 = 0; k0 < W * H; k0++) {
  if (!liso[k0] || visto[k0]) continue;
  const pila = [k0], pts = []; visto[k0] = 1;
  while (pila.length) {
    const k = pila.pop(); pts.push(k);
    for (const v of [k - 1, k + 1, k - W, k + W]) if (v >= 0 && v < W * H && liso[v] && !visto[v]) { visto[v] = 1; pila.push(v); }
  }
  if (pts.length < 20) continue;
  let mx = 0, my = 0; for (const k of pts) { mx += k % W; my += (k / W) | 0; } mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const k of pts) { const dx = k % W - mx, dy = ((k / W) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= pts.length; syy /= pts.length; sxy /= pts.length;
  const l1 = (sxx + syy) / 2 + Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
  largos.push({ m: 4 * Math.sqrt(l1) * P, x: Math.round(ISLA.x0 + mx * P), z: Math.round(ISLA.z0 + my * P) });
}
largos.sort((a, b) => b.m - a.m);
const peor = largos[0] || { m: 0 };
console.log(`  ${cerca.size} cuadros de 2 km junto a ríos · ${tallado} puntos tallados · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
comprobar('ninguna ladera de valle es un plano liso de más de 800 m', peor.m < 800, `la más larga, ${Math.round(peor.m)} m${peor.x ? ` (en ${peor.x}, ${peor.z})` : ''}`);
comprobar('lo liso es menos del 11 % de lo que tallan los valles', tallado > 1000 && lisos / tallado < 0.11, `${(lisos / Math.max(1, tallado) * 100).toFixed(1)} % de ${tallado}`);
console.log(`\nResultado: ${fallos ? fallos + ' fallidas' : 'todo correcto'}`);
process.exit(fallos ? 1 : 0);
