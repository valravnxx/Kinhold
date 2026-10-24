// Hornea el humano esculpido por campos de distancia en mallas listas para el juego.
// Pasos: muestrear el campo en una rejilla fina (3 mm) → superficie por «surface nets» →
// simplificar con meshoptimizer (deja detalle donde hay forma: cara, manos) → recolocar cada vértice
// sobre la superficie → normales por gradiente del campo → color por capa, con oclusión de contacto →
// pesos de huesos según las formas cercanas. Salen dos niveles de detalle (cerca y lejos).
// Uso: node herramientas/hornear_personaje.mjs   (escribe src/personaje/datos_humano.js)
import { writeFileSync } from 'fs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { esculpir, HUESOS, posicionHueso, PADRE, COLORES, OJOS, RADIO_OJO } from '../src/personaje/humano.js';
import { evaluar, evaluarCapa, distancia } from '../src/personaje/sdf.js';

const t0 = Date.now();
const capas = esculpir();
const campo = (x, y, z) => distancia(capas, [x, y, z]);

// ---------- 1. Rejilla: primero gruesa, luego fina solo cerca de la superficie ----------
const h = 0.003, MIN = [-0.33, -0.012, -0.2], MAX = [0.33, 1.8, 0.23];
const nx = Math.ceil((MAX[0] - MIN[0]) / h) + 1, ny = Math.ceil((MAX[1] - MIN[1]) / h) + 1, nz = Math.ceil((MAX[2] - MIN[2]) / h) + 1;
const G = 4, gx = Math.ceil(nx / G) + 1, gy = Math.ceil(ny / G) + 1, gz = Math.ceil(nz / G) + 1;
const grueso = new Float32Array(gx * gy * gz);
for (let k = 0; k < gz; k++) for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++)
  grueso[i + gx * (j + gy * k)] = campo(MIN[0] + i * G * h, MIN[1] + j * G * h, MIN[2] + k * G * h);
console.log(`rejilla gruesa ${gx}×${gy}×${gz} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const F = new Float32Array(nx * ny * nz);
const banda = G * h * 1.8;
let evaluados = 0;
for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const c = grueso[Math.round(i / G) + gx * (Math.round(j / G) + gy * Math.round(k / G))];
  F[i + nx * (j + ny * k)] = Math.abs(c) > banda ? c : (evaluados++, campo(MIN[0] + i * h, MIN[1] + j * h, MIN[2] + k * h));
}
console.log(`rejilla fina ${nx}×${ny}×${nz}, ${evaluados} puntos evaluados, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---------- 2. Surface nets ----------
const idx = (i, j, k) => i + nx * (j + ny * k);
const verticeDe = new Int32Array(nx * ny * nz).fill(-1);
const pos = [];
const ESQ = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const ARISTAS = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
  const v = ESQ.map(([a, b, c]) => F[idx(i + a, j + b, k + c)]);
  let dentro = 0; for (const x of v) if (x < 0) dentro++;
  if (dentro === 0 || dentro === 8) continue;
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const [a, b] of ARISTAS) {
    if ((v[a] < 0) === (v[b] < 0)) continue;
    const t = v[a] / (v[a] - v[b]);
    sx += ESQ[a][0] + (ESQ[b][0] - ESQ[a][0]) * t; sy += ESQ[a][1] + (ESQ[b][1] - ESQ[a][1]) * t; sz += ESQ[a][2] + (ESQ[b][2] - ESQ[a][2]) * t; n++;
  }
  verticeDe[idx(i, j, k)] = pos.length / 3;
  pos.push(MIN[0] + (i + sx / n) * h, MIN[1] + (j + sy / n) * h, MIN[2] + (k + sz / n) * h);
}
const tris = [];
for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
  const a = F[idx(i, j, k)];
  for (const eje of [0, 1, 2]) {
    const [di, dj, dk] = eje === 0 ? [1, 0, 0] : eje === 1 ? [0, 1, 0] : [0, 0, 1];
    const b = F[idx(i + di, j + dj, k + dk)];
    if ((a < 0) === (b < 0)) continue;
    // las cuatro celdas que comparten esta arista
    let q;
    if (eje === 0) q = [idx(i, j, k), idx(i, j - 1, k), idx(i, j - 1, k - 1), idx(i, j, k - 1)];
    else if (eje === 1) q = [idx(i, j, k), idx(i, j, k - 1), idx(i - 1, j, k - 1), idx(i - 1, j, k)];
    else q = [idx(i, j, k), idx(i - 1, j, k), idx(i - 1, j - 1, k), idx(i, j - 1, k)];
    const w = q.map(c => verticeDe[c]);
    if (w.some(x => x < 0)) continue;
    if (a < 0) { tris.push(w[0], w[1], w[2], w[0], w[2], w[3]); } else { tris.push(w[0], w[2], w[1], w[0], w[3], w[2]); }
  }
}
console.log(`superficie: ${pos.length / 3} vértices, ${tris.length / 3} triángulos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---------- 3. Color de cada vértice (para que la simplificación respete los bordes de color) ----------
const RGB = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
function colorEn(p) {
  const r = evaluar(capas, p), C = r.capa;
  if (C.nombre === 'ojos') {
    const c = r.forma.centroOjo, d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], l = Math.hypot(...d);
    const z = d[2] / l, radial = Math.hypot(d[0], d[1] + 0.0004) / l;
    if (z > 0.6 && radial < 0.2) return RGB(COLORES.pupila);
    if (z > 0.4 && radial < 0.64) return RGB(COLORES.iris);
    return RGB(COLORES.blancoOjo);
  }
  if (r.forma && r.forma.color && C.nombre === 'piel') {
    // mezcla suave entre la piel y el labio según la distancia a la forma de color
    const df = r.forma.d(p);
    const t = Math.max(0, Math.min(1, 1 - df / 0.0025));
    const a = RGB(COLORES.piel), b = RGB(r.forma.color);
    return a.map((x, i) => x + (b[i] - x) * t);
  }
  const col = typeof C.color === 'function' ? C.color(p) : C.color;
  return RGB(col);
}
const nV = pos.length / 3, P = new Float32Array(pos), COL = new Float32Array(nV * 3);
for (let i = 0; i < nV; i++) { const c = colorEn([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); COL.set(c, i * 3); }
console.log(`colores, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---------- 4. Simplificar a cada nivel de detalle ----------
await MeshoptSimplifier.ready;
// La cabeza (por encima del cuello de la camisa) se simplifica aparte con más presupuesto,
// con el borde bloqueado para que las dos partes sigan cosidas.
function simplificarParte(indices, objetivo, p, c) {
  const ind = new Uint32Array(indices);
  const [n] = MeshoptSimplifier.simplifyWithUpdate(ind, p, 3, c, 3, [1.5, 1.5, 1.5], null, objetivo * 3, 0.02, ['LockBorder']);
  return ind.subarray(0, n);
}
function nivel(objetivo, parteCabeza) {
  const p = P.slice(), c = COL.slice();
  const cab = [], resto = [];
  for (let t = 0; t < tris.length; t += 3) {
    const y = (P[tris[t] * 3 + 1] + P[tris[t + 1] * 3 + 1] + P[tris[t + 2] * 3 + 1]) / 3;
    (y > 1.505 ? cab : resto).push(tris[t], tris[t + 1], tris[t + 2]);
  }
  const a = simplificarParte(cab, Math.round(objetivo * parteCabeza), p, c);
  const b = simplificarParte(resto, Math.round(objetivo * (1 - parteCabeza)), p, c);
  const usados = new Uint32Array(a.length + b.length); usados.set(a); usados.set(b, a.length);
  const n = usados.length;
  const mapa = new Int32Array(nV).fill(-1), vp = [];
  const out = new Uint32Array(n);
  for (let i = 0; i < n; i++) { const v = usados[i]; if (mapa[v] < 0) { mapa[v] = vp.length / 3; vp.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); } out[i] = mapa[v]; }
  return { pos: new Float32Array(vp), ind: out };
}

// ---------- 5. Recolocar, normales, color con oclusión y pesos ----------
const grad = (p) => {
  const e = 0.0006;
  const gx = campo(p[0] + e, p[1], p[2]) - campo(p[0] - e, p[1], p[2]);
  const gy = campo(p[0], p[1] + e, p[2]) - campo(p[0], p[1] - e, p[2]);
  const gz = campo(p[0], p[1], p[2] + e) - campo(p[0], p[1], p[2] - e);
  const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l];
};
function oclusion(p, n) { // oclusión ambiental por muestreo del campo a lo largo de la normal (Quilez)
  let o = 0, peso = 1;
  for (const s of [0.004, 0.009, 0.016, 0.028, 0.045]) {
    const d = campo(p[0] + n[0] * s, p[1] + n[1] * s, p[2] + n[2] * s);
    o += (s - Math.max(0, d)) * peso; peso *= 0.6;
  }
  return Math.max(0.55, Math.min(1, 1 - 8 * o));
}
const indHueso = Object.fromEntries(HUESOS.map((n, i) => [n, i]));
function pesosEn(p, r) {
  const C = r.capa, acum = new Map();
  for (const f of C.formas) {
    if (f.quitar || !f.hueso) continue;
    const d = f.d(p) - C.inflar, w = Math.exp(-Math.max(0, d) / 0.012);
    if (w < 1e-4) continue;
    acum.set(f.hueso, (acum.get(f.hueso) || 0) + w);
  }
  let lista = [...acum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (C.pesos) lista = C.pesos(p, lista);
  if (!lista.length) lista = [['pecho', 1]];
  const s = lista.reduce((a, [, w]) => a + w, 0);
  return lista.map(([n, w]) => [indHueso[n], w / s]);
}
function terminar(L) {
  const n = L.pos.length / 3, nor = new Float32Array(n * 3), col = new Uint8Array(n * 3), hi = new Uint8Array(n * 4), hw = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let p = [L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2]];
    // sobre la superficie (la simplificación mueve un poco los vértices)
    for (let it = 0; it < 2; it++) { const d = campo(...p), g = grad(p); p = [p[0] - g[0] * d, p[1] - g[1] * d, p[2] - g[2] * d]; }
    L.pos.set(p, i * 3);
    const g = grad(p); nor.set(g, i * 3);
    const r = evaluar(capas, p);
    const c = colorEn(p), o = oclusion(p, g), suelo = 0.75 + 0.25 * Math.min(1, p[1] / 0.2);
    for (let k = 0; k < 3; k++) col[i * 3 + k] = Math.round(Math.min(1, c[k] * o * suelo) * 255);
    const w = pesosEn(p, r);
    w.forEach(([b, x], k) => { hi[i * 4 + k] = b; hw[i * 4 + k] = Math.round(x * 255); });
  }
  return { ...L, nor, col, hi, hw };
}
// ---------- 6. Empaquetar ----------
const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');
function empaquetar(L) {
  const n = L.pos.length / 3, q = new Uint16Array(n * 3), nq = new Int8Array(n * 3);
  for (let i = 0; i < n * 3; i++) { const e = i % 3; q[i] = Math.round((L.pos[i] - MIN[e]) / (MAX[e] - MIN[e]) * 65535); nq[i] = Math.round(L.nor[i] * 127); }
  return { vertices: n, triangulos: L.ind.length / 3, pos: b64(q), nor: b64(nq), col: b64(L.col), hi: b64(L.hi), hw: b64(L.hw), ind: b64(new Uint16Array(L.ind)) };
}
// ojos: esferas finas aparte (la rejilla de 3 mm no da para un ojo), con iris y pupila, en el hueso de la cabeza
function anadirOjos(L, lados, pisos) {
  const pos = [...L.pos], nor = [...L.nor], col = [...L.col], hi = [...L.hi], hw = [...L.hw], ind = [...L.ind];
  const iris = RGB(COLORES.iris), pupila = RGB(COLORES.pupila), blanco = RGB(COLORES.blancoOjo), cab = HUESOS.indexOf('cabeza');
  for (const c of OJOS) {
    const base = pos.length / 3;
    for (let j = 0; j <= pisos; j++) for (let i = 0; i <= lados; i++) {
      const th = j / pisos * Math.PI, ph = i / lados * Math.PI * 2;
      // el polo del globo mira al frente (+z)
      const d = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
      pos.push(c[0] + d[0] * RADIO_OJO, c[1] + d[1] * RADIO_OJO, c[2] + d[2] * RADIO_OJO); nor.push(...d);
      const k = th < 0.17 ? pupila : th < 0.5 ? iris.map(x => x * (0.85 + 0.3 * (th - 0.17) / 0.33)) : th < 0.56 ? iris.map((x, n) => (x + blanco[n]) / 2) : blanco;
      col.push(...k.map(x => Math.round(Math.min(1, x) * 255)));
      hi.push(cab, 0, 0, 0); hw.push(255, 0, 0, 0);
    }
    for (let j = 0; j < pisos; j++) for (let i = 0; i < lados; i++) {
      const a = base + j * (lados + 1) + i, b = a + 1, cc = a + lados + 1, d = cc + 1;
      ind.push(a, cc, b, b, cc, d);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Uint8Array(col), hi: new Uint8Array(hi), hw: new Uint8Array(hw), ind: new Uint32Array(ind) };
}
const niveles = {};
for (const [nombre, objetivo, lados, cab] of [['cerca', 22000, 16, 0.4], ['lejos', 3800, 8, 0.3]]) {
  const L = anadirOjos(terminar(nivel(objetivo, cab)), lados, lados * 0.75);
  niveles[nombre] = empaquetar(L);
  console.log(`nivel ${nombre}: ${niveles[nombre].vertices} vértices, ${niveles[nombre].triangulos} triángulos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const huesos = HUESOS.map(n => ({ nombre: n, padre: PADRE[n] ?? null, pos: posicionHueso(n) }));
const salida = `// GENERADO por herramientas/hornear_personaje.mjs a partir de src/personaje/humano.js. No editar a mano.
export const HUMANO = ${JSON.stringify({ min: MIN, max: MAX, huesos, niveles })};
`;
writeFileSync(new URL('../src/personaje/datos_humano.js', import.meta.url), salida);
console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(1)} s, ${(salida.length / 1024).toFixed(0)} KB`);
