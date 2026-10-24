// Kinhold — personaje por código (hito 1b), con el estilo de maqueta.
// Una sola malla continua: el cuerpo se describe como una suma suave de formas (campo de distancias)
// y se convierte en malla con «surface nets» sobre una rejilla más fina en la cara y las manos.
// Lleva esqueleto (16 huesos), pesos calculados por cercanía a las formas de cada hueso,
// oclusión ambiental horneada en los vértices y dos animaciones por código: quieto y andar.
// Ropa base pintada en la propia malla (camisa de lino, calzas de lana, cinturón y zapatos);
// la ropa por capas llega en su propia tarea.
import * as THREE from 'three';

// ---------- Medidas (metros, en reposo «A»: brazos abiertos 38° respecto a la vertical) ----------
// Mira hacia +Z. Altura 1,72 m; cabeza algo grande (1/7 de la altura) para que se lea en miniatura.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DIR_BRAZO = V(0.62, -0.785, 0).normalize();
function brazo(s) { // s = +1 izquierda (x+), -1 derecha
  const d = V(DIR_BRAZO.x * s, DIR_BRAZO.y, 0);
  const hombro = V(0.19 * s, 1.425, -0.015);
  const codo = hombro.clone().addScaledVector(d, 0.29);
  const muneca = codo.clone().addScaledVector(d, 0.255);
  return { d, hombro, codo, muneca };
}
const BR = { 1: brazo(1), [-1]: brazo(-1) };
const PIERNA = (s) => ({ cadera: V(0.092 * s, 0.93, 0), rodilla: V(0.1 * s, 0.505, 0.012), tobillo: V(0.102 * s, 0.085, -0.01) });

// Huesos: [nombre, padre, posición en reposo]
const HUESOS = [
  ['cadera', -1, V(0, 0.95, 0)], ['columna', 0, V(0, 1.08, -0.005)], ['pecho', 1, V(0, 1.27, -0.01)],
  ['cuello', 2, V(0, 1.47, -0.012)], ['cabeza', 3, V(0, 1.575, -0.004)],
];
for (const [s, n] of [[1, 'I'], [-1, 'D']]) {
  const b = BR[s];
  HUESOS.push(['brazo' + n, 2, b.hombro], ['antebrazo' + n, -2, b.codo], ['mano' + n, -2, b.muneca]);
}
for (const [s, n] of [[1, 'I'], [-1, 'D']]) {
  const p = PIERNA(s);
  HUESOS.push(['muslo' + n, 0, p.cadera], ['pierna' + n, -2, p.rodilla], ['pie' + n, -2, p.tobillo]);
}
// padre -2 = el hueso anterior de la lista
HUESOS.forEach((h, i) => { if (h[1] === -2) h[1] = i - 1; });
const H = Object.fromEntries(HUESOS.map((h, i) => [h[0], i]));

// ---------- Funciones de distancia ----------
const tmp = new THREE.Vector3();
function dElipsoide(p, c, r) {
  const x = (p.x - c.x) / r.x, y = (p.y - c.y) / r.y, z = (p.z - c.z) / r.z;
  const k0 = Math.hypot(x, y, z), k1 = Math.hypot(x / r.x, y / r.y, z / r.z);
  return k1 < 1e-9 ? -Math.min(r.x, r.y, r.z) : k0 * (k0 - 1) / k1;
}
function dConoRedondo(p, a, b, r1, r2) { // cápsula de radio variable (a con r1, b con r2)
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = p.x - a.x, pay = p.y - a.y, paz = p.z - a.z;
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function dCaja(p, c, ejes, h, r) { // caja redondeada orientada (ejes: tres vectores unitarios)
  tmp.subVectors(p, c);
  const qx = Math.abs(tmp.dot(ejes[0])) - h.x + r, qy = Math.abs(tmp.dot(ejes[1])) - h.y + r, qz = Math.abs(tmp.dot(ejes[2])) - h.z + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

// ---------- Las formas del cuerpo ----------
// Cada forma: { f(p) distancia, k suavidad de la unión, hueso, zona (para el color), resta }
function formas(cx = {}) {
  const F = [];
  const add = (hueso, zona, k, f, extra = {}) => F.push({ hueso: H[hueso], zona, k, f, ...extra });
  const elip = (c, r) => (p) => dElipsoide(p, c, r), cono = (a, b, r1, r2) => (p) => dConoRedondo(p, a, b, r1, r2);
  const anchoH = cx.hombros ?? 1, vientre = cx.vientre ?? 0;
  // tronco
  add('cadera', 'cuerpo', 0.05, elip(V(0, 0.95, -0.005), V(0.152, 0.115, 0.11)));
  for (const s of [1, -1]) add('cadera', 'cuerpo', 0.05, elip(V(0.062 * s, 0.9, -0.05), V(0.075, 0.085, 0.07))); // nalgas
  add('columna', 'cuerpo', 0.07, elip(V(0, 1.1, 0.008 + vientre * 0.03), V(0.148, 0.13, 0.105 + vientre * 0.03)));
  add('pecho', 'cuerpo', 0.07, elip(V(0, 1.3, -0.008), V(0.178 * anchoH, 0.16, 0.112)));
  add('pecho', 'cuerpo', 0.05, cono(V(-0.16 * anchoH, 1.41, -0.025), V(0.16 * anchoH, 1.41, -0.025), 0.058, 0.058)); // trapecios y hombros
  add('cuello', 'cuello', 0.04, cono(V(0, 1.43, -0.02), V(0, 1.6, -0.005), 0.054, 0.05));
  // cabeza
  add('cabeza', 'cara', 0.03, elip(V(0, 1.675, -0.012), V(0.08, 0.1, 0.098)));          // cráneo
  add('cabeza', 'cara', 0.035, elip(V(0, 1.618, 0.024), V(0.066, 0.072, 0.07)));        // cara y mandíbula
  add('cabeza', 'cara', 0.02, elip(V(0, 1.565, 0.06), V(0.03, 0.022, 0.026)));          // barbilla
  for (const s of [1, -1]) add('cabeza', 'cara', 0.02, elip(V(0.045 * s, 1.632, 0.058), V(0.024, 0.02, 0.022))); // pómulos
  add('cabeza', 'ceja', 0.018, cono(V(-0.042, 1.688, 0.083), V(0.042, 1.688, 0.083), 0.014, 0.014)); // arco de las cejas
  add('cabeza', 'nariz', 0.012, cono(V(0, 1.678, 0.093), V(0, 1.627, 0.118), 0.009, 0.013)); // nariz
  add('cabeza', 'nariz', 0.01, elip(V(0, 1.627, 0.109), V(0.02, 0.011, 0.012)));        // aletas
  add('cabeza', 'boca', 0.012, elip(V(0, 1.6, 0.092), V(0.026, 0.011, 0.012)));         // labios
  for (const s of [1, -1]) add('cabeza', 'oreja', 0.012, elip(V(0.081 * s, 1.645, -0.008), V(0.013, 0.031, 0.02)));
  // párpados de arriba: tapan el tercio alto del ojo
  for (const s of [1, -1]) add('cabeza', 'cara', 0.006, elip(V(0.033 * s, 1.6705, 0.087), V(0.0145, 0.0075, 0.011)));
  // cuencas de los ojos (resta suave)
  for (const s of [1, -1]) add('cabeza', 'cara', 0.012, elip(V(0.033 * s, 1.663, 0.096), V(0.019, 0.013, 0.014)), { resta: true });
  // pelo: casquete algo mayor que el cráneo, por encima de la línea del pelo (cortado en diagonal)
  const pelo = cx.pelo ?? 1;
  if (pelo) add('cabeza', 'pelo', 0.012, (p) => {
    const d = dElipsoide(p, V(0, 1.68, -0.016), V(0.087, 0.108, 0.106));
    const linea = 1.722 - (0.105 - p.z) * 0.45 - Math.max(0, -p.z) * 0.55; // frente alta, nuca baja
    return smax(d, linea - p.y, 0.016);
  });
  // cinturón de cuero: un aro algo abultado sobre la camisa
  add('columna', 'cinto', 0.008, (p) => { const d = dElipsoide(p, V(0, 0.99, 0.0), V(0.158, 0.06, 0.118)); return smax(d, Math.abs(p.y - 0.99) - 0.017, 0.006); });
  // barba corta (opcional): capa sobre mandíbula y barbilla, por debajo de los pómulos
  if (cx.barba ?? 1) add('cabeza', 'barba', 0.01, (p) => {
    const d = Math.min(dElipsoide(p, V(0, 1.612, 0.022), V(0.073, 0.078, 0.077)), dElipsoide(p, V(0, 1.562, 0.058), V(0.037, 0.03, 0.033)));
    const arriba = p.y - (1.618 - Math.max(0, 0.04 - Math.abs(p.x)) * 0.3 + Math.max(0, -p.z) * 0.9); // por debajo de la línea de los pómulos
    const boca = dElipsoide(p, V(0, 1.601, 0.098), V(0.024, 0.009, 0.03));
    return smax(smax(smax(d, arriba, 0.01), -p.z, 0.01), -boca, 0.006);
  });
  // brazos
  for (const s of [1, -1]) {
    const n = s > 0 ? 'I' : 'D', b = BR[s];
    add('brazo' + n, 'brazo', 0.045, cono(b.hombro, b.codo, 0.05, 0.039));
    add('brazo' + n, 'brazo', 0.04, elip(b.hombro.clone().addScaledVector(b.d, 0.035), V(0.05, 0.05, 0.048))); // deltoides
    add('antebrazo' + n, 'brazo', 0.025, cono(b.codo, b.muneca, 0.039, 0.027));
    add('antebrazo' + n, 'brazo', 0.025, elip(b.codo.clone().addScaledVector(b.d, 0.07), V(0.04, 0.04, 0.038)));
    // mano: palma (caja redondeada) y pulgar; la palma mira hacia el muslo
    const largo = b.d, palma = V(-b.d.y * s, b.d.x * s, 0).multiplyScalar(-1).normalize(), anchoE = V(0, 0, 1);
    const cm = b.muneca.clone().addScaledVector(largo, 0.07);
    add('mano' + n, 'mano', 0.02, (p) => dCaja(p, cm, [largo, anchoE, palma], V(0.055, 0.043, 0.015), 0.014));
    add('mano' + n, 'mano', 0.015, (p) => dCaja(p, b.muneca.clone().addScaledVector(largo, 0.145), [largo, anchoE, palma], V(0.032, 0.038, 0.011), 0.01)); // dedos juntos
    const p0 = b.muneca.clone().addScaledVector(largo, 0.025).addScaledVector(anchoE, 0.036).addScaledVector(palma, 0.01);
    const p1 = p0.clone().addScaledVector(largo, 0.05).addScaledVector(anchoE, 0.02).addScaledVector(palma, 0.012);
    add('mano' + n, 'mano', 0.012, cono(p0, p1, 0.014, 0.01));
  }
  // piernas
  for (const s of [1, -1]) {
    const n = s > 0 ? 'I' : 'D', p = PIERNA(s);
    add('muslo' + n, 'pierna', 0.06, cono(p.cadera, p.rodilla, 0.088, 0.054));
    add('pierna' + n, 'pierna', 0.035, cono(p.rodilla, p.tobillo, 0.052, 0.034));
    add('pierna' + n, 'pierna', 0.04, elip(V(p.rodilla.x, 0.37, -0.012), V(0.05, 0.1, 0.05))); // gemelo
    const eje = V(0, 0, 1), arriba = V(0, 1, 0), lado = V(1, 0, 0);
    add('pie' + n, 'pie', 0.03, (q) => dCaja(q, V(p.tobillo.x * 1.03, 0.042, 0.055), [lado, arriba, eje], V(0.045, 0.042, 0.125), 0.035));
  }
  return F;
}

// ---------- Rejilla con más detalle en cara y manos ----------
function eje(min, max, grueso, finos) {
  const xs = []; let x = min;
  while (x < max) { xs.push(x); let h = grueso; for (const [a, b, hf] of finos) if (x >= a - 1e-6 && x < b) h = Math.min(h, hf); x += h; }
  xs.push(x); return Float64Array.from(xs);
}

export function crearPersonaje(opc = {}) {
  const F = formas(opc);
  const cuerpo = F.filter(f => !f.resta), restas = F.filter(f => f.resta);
  const p = new THREE.Vector3();
  const sdf = (q) => {
    let d = 1e9;
    for (const f of cuerpo) d = d > 1e8 ? f.f(q) : smin(d, f.f(q), f.k);
    for (const f of restas) d = smax(d, -f.f(q), f.k);
    return d;
  };
  const G = opc.grueso ?? 0.032, FINO = opc.fino ?? 0.011, FM = opc.finoMano ?? 0.02;
  const X = opc.bandas ?? {}; const xs = eje(-0.72, 0.72, G, [[-(X.cx ?? 0.075), X.cx ?? 0.075, FINO], [0.47, 0.66, FM], [-0.66, -0.47, FM]]);
  const ys = eje(-0.02, 1.83, G, [[1.53, 1.8, FINO], [1.44, 1.53, FM], [0.78, 1.04, FM]]);
  const zs = eje(-0.2, 0.2, G, X.sinZ ? [] : [[X.z0 ?? 0.07, 0.135, FINO]]);
  const nx = xs.length, ny = ys.length, nz = zs.length, idx = (i, j, k) => (k * ny + j) * nx + i;
  const val = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { p.set(xs[i], ys[j], zs[k]); val[idx(i, j, k)] = sdf(p); }

  // vértices: uno por celda que corta la superficie, en la media de los cortes de sus aristas
  const celda = new Int32Array((nx - 1) * (ny - 1) * nz).fill(-1), cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const A = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let sx = 0, sy = 0, sz = 0, c = 0;
    for (const [a0, b0, c0, a1, b1, c1] of A) {
      const v0 = val[idx(i + a0, j + b0, k + c0)], v1 = val[idx(i + a1, j + b1, k + c1)];
      if ((v0 < 0) === (v1 < 0)) continue;
      const t = v0 / (v0 - v1);
      sx += xs[i + a0] + (xs[i + a1] - xs[i + a0]) * t; sy += ys[j + b0] + (ys[j + b1] - ys[j + b0]) * t; sz += zs[k + c0] + (zs[k + c1] - zs[k + c0]) * t; c++;
    }
    if (!c) continue;
    celda[cid(i, j, k)] = pos.length / 3; pos.push(sx / c, sy / c, sz / c);
  }
  // caras: un cuadrado por cada arista de la rejilla que cruza la superficie
  const caras = [];
  const quad = (a, b, c, d, dentro) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; caras.push(dentro ? [a, b, c, d] : [d, c, b, a]); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { // aristas en x
    const v0 = val[idx(i, j, k)], v1 = val[idx(i + 1, j, k)]; if ((v0 < 0) === (v1 < 0)) continue;
    quad(celda[cid(i, j - 1, k - 1)], celda[cid(i, j, k - 1)], celda[cid(i, j, k)], celda[cid(i, j - 1, k)], v0 < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // en y
    const v0 = val[idx(i, j, k)], v1 = val[idx(i, j + 1, k)]; if ((v0 < 0) === (v1 < 0)) continue;
    quad(celda[cid(i - 1, j, k - 1)], celda[cid(i - 1, j, k)], celda[cid(i, j, k)], celda[cid(i, j, k - 1)], v0 < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // en z
    const v0 = val[idx(i, j, k)], v1 = val[idx(i, j, k + 1)]; if ((v0 < 0) === (v1 < 0)) continue;
    quad(celda[cid(i - 1, j - 1, k)], celda[cid(i, j - 1, k)], celda[cid(i, j, k)], celda[cid(i - 1, j, k)], v0 < 0);
  }
  // acercar cada vértice a la superficie exacta y sacar su normal del campo
  const nv = pos.length / 3, nor = new Float32Array(nv * 3), e = 4e-4;
  const grad = (q, out) => {
    const x = q.x, y = q.y, z = q.z;
    out.set(sdf(p.set(x + e, y, z)) - sdf(p.set(x - e, y, z)), sdf(p.set(x, y + e, z)) - sdf(p.set(x, y - e, z)), sdf(p.set(x, y, z + e)) - sdf(p.set(x, y, z - e)));
    return out.normalize();
  };
  const q = new THREE.Vector3(), g = new THREE.Vector3();
  for (let v = 0; v < nv; v++) {
    q.fromArray(pos, v * 3);
    for (let it = 0; it < 2; it++) { const d = sdf(p.copy(q)); grad(q, g); q.addScaledVector(g, -d); }
    grad(q, g); q.toArray(pos, v * 3); g.toArray(nor, v * 3);
  }
  // triángulos (la diagonal más corta) y orientación según la normal del campo
  const ind = [], a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3(), n3 = new THREE.Vector3();
  const tri = (a, b, c) => {
    a3.fromArray(pos, a * 3); b3.fromArray(pos, b * 3); c3.fromArray(pos, c * 3);
    n3.subVectors(b3, a3).cross(c3.sub(a3));
    const m = nor[a * 3] + nor[b * 3] + nor[c * 3], m2 = nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1], m3 = nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2];
    if (n3.x * m + n3.y * m2 + n3.z * m3 < 0) ind.push(a, c, b); else ind.push(a, b, c);
  };
  const dist = (a, b) => Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
  for (const [a, b, c, d] of caras) { if (dist(a, c) < dist(b, d)) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); } }

  // ---------- Color, oclusión y pesos por vértice ----------
  const col = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const C = colores(opc), k = new THREE.Color();
  const dHueso = new Float32Array(HUESOS.length);
  for (let v = 0; v < nv; v++) {
    q.fromArray(pos, v * 3); g.fromArray(nor, v * 3);
    // color: mezcla suave de las zonas más cercanas (bordes limpios aunque la rejilla sea gruesa)
    dHueso.fill(1e9); const dZona = {};
    for (const f of cuerpo) { const d = f.f(q); if (d < dHueso[f.hueso]) dHueso[f.hueso] = d; if (!(f.zona in dZona) || d < dZona[f.zona]) dZona[f.zona] = d; }
    const dmin = Math.min(...Object.values(dZona)); let r = 0, gg = 0, bb = 0, wt = 0;
    for (const [zona, d] of Object.entries(dZona)) {
      const w = Math.exp(-(d - dmin) / 0.0025); if (w < 0.01) continue;
      pintar(k, zona, q, C); r += k.r * w; gg += k.g * w; bb += k.b * w; wt += w;
    }
    k.setRGB(r / wt, gg / wt, bb / wt);
    // oclusión ambiental con el propio campo (más oscuro en pliegues, axilas, entre las piernas)
    let ao = 0;
    for (const [h, w] of [[0.012, 0.5], [0.03, 0.3], [0.06, 0.2]]) ao += w * Math.max(0, h - sdf(p.copy(q).addScaledVector(g, h))) / h;
    const o = (1 - 0.55 * Math.min(1, ao)) * (0.86 + 0.14 * (g.y * 0.5 + 0.5)) * (0.97 + 0.06 * ruido(q.x * 40, q.y * 40, q.z * 40));
    col[v * 3] = k.r * o; col[v * 3 + 1] = k.g * o; col[v * 3 + 2] = k.b * o;
    // pesos: los cuatro huesos más cercanos, con caída suave
    const orden = [...dHueso.keys()].sort((a, b) => dHueso[a] - dHueso[b]).slice(0, 4);
    const d0 = dHueso[orden[0]], ws = orden.map(h => Math.exp(-(dHueso[h] - d0) / 0.012));
    const suma = ws.reduce((a, b) => a + b, 0);
    orden.forEach((h, t) => { si[v * 4 + t] = h; sw[v * 4 + t] = ws[t] / suma; });
  }

  // ojos: esferitas brillantes en las cuencas (otro material, misma malla)
  const posT = Array.from(pos), norT = Array.from(nor), colT = Array.from(col), siT = Array.from(si), swT = Array.from(sw), indOjos = [];
  for (const s of [1, -1]) {
    const o = new THREE.SphereGeometry(0.0088, 10, 8).toNonIndexed(), base = posT.length / 3;
    o.translate(0.033 * s, 1.6635, 0.0835);
    const op = o.attributes.position, on = o.attributes.normal;
    for (let t = 0; t < op.count; t++) {
      posT.push(op.getX(t), op.getY(t), op.getZ(t)); norT.push(on.getX(t), on.getY(t), on.getZ(t));
      const fr = on.getZ(t) > 0.7; k.set(fr ? C.ojo : C.blanco); colT.push(k.r, k.g, k.b);
      siT.push(H.cabeza, 0, 0, 0); swT.push(1, 0, 0, 0); indOjos.push(base + t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posT, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norT, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colT, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(siT, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(swT, 4));
  geo.setIndex([...ind, ...indOjos]);
  geo.addGroup(0, ind.length, 0); geo.addGroup(ind.length, indOjos.length, 1);

  // esqueleto
  const huesos = HUESOS.map(([nombre]) => { const b = new THREE.Bone(); b.name = nombre; return b; });
  HUESOS.forEach(([, padre, w], i) => {
    if (padre < 0) huesos[i].position.copy(w);
    else { huesos[i].position.copy(w).sub(HUESOS[padre][2]); huesos[padre].add(huesos[i]); }
  });
  const mats = [
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x666666 }),
  ];
  const malla = new THREE.SkinnedMesh(geo, mats);
  malla.add(huesos[0]); malla.bind(new THREE.Skeleton(huesos));
  malla.castShadow = malla.receiveShadow = true; malla.name = 'personaje';
  malla.frustumCulled = false; // la caja de reposo no sigue a la animación
  const raiz = new THREE.Group(); raiz.add(malla); raiz.name = 'personaje';
  const reposo = huesos.map(b => b.position.clone());
  return { raiz, malla, huesos: Object.fromEntries(huesos.map(b => [b.name, b])), reposo, triangulos: (ind.length + indOjos.length) / 3, vertices: posT.length / 3 };
}

// ---------- Colores (apagados y naturales) ----------
function colores(opc) {
  return {
    piel: opc.piel ?? 0xc39a7c, labio: 0xa8705e, pelo: opc.colorPelo ?? 0x4b3828, ceja: 0x5a4433,
    camisa: 0xc9bc9f, camisaOsc: 0xa89c81, calzas: 0x5d5a48, cinto: 0x463324, hebilla: 0x8a7f6a, zapato: 0x4a3426, suela: 0x2e241c,
    ojo: 0x2a1e16, blanco: 0x5e4c3e,
  };
}
function ruido(x, y, z) { const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.71) * 43758.55; return s - Math.floor(s); }
function pintar(k, zona, q, C) {
  const ax = Math.abs(q.x);
  if (zona === 'barba') { k.set(C.pelo).multiplyScalar(0.95 + 0.15 * ruido(Math.round(q.x * 220), Math.round(q.y * 220), 0)); if (Math.abs(q.y - 1.6) < 0.006 && q.z > 0.08 && Math.abs(q.x) < 0.02) k.set(C.labio); return; }
  if (zona === 'pelo') { k.set(C.pelo).multiplyScalar(0.9 + 0.2 * ruido(Math.round(q.x * 180), 0, Math.round(q.z * 60))); return; }
  if (['cara', 'nariz', 'oreja', 'cuello'].includes(zona)) {
    k.set(C.piel);
    if (zona === 'cuello' && q.y < 1.49 - Math.max(0, q.z) * 0.6) k.set(C.camisa); // cuello de la camisa
    return;
  }
  if (zona === 'ceja') { k.set(C.piel).lerp(new THREE.Color(C.ceja), q.y > 1.686 && q.y < 1.7 && ax > 0.013 && ax < 0.052 && q.z > 0.07 ? 0.8 : 0); return; }
  if (zona === 'boca') { k.set(C.piel).lerp(new THREE.Color(C.labio), Math.max(0, 1 - Math.abs(q.y - 1.6) / 0.009) * 0.75); return; }
  if (zona === 'mano') { k.set(C.piel); return; }
  if (zona === 'brazo') {
    // manga hasta la muñeca, con el puño un poco más oscuro
    k.set(C.camisa);
    const s = Math.sign(q.x) || 1, b = BR[s], t = tmp.subVectors(q, b.muneca).dot(b.d);
    if (t > -0.012) k.set(C.piel); else if (t > -0.035) k.set(C.camisaOsc);
    return;
  }
  if (zona === 'cinto') { k.set(q.z > 0.09 && Math.abs(q.x) < 0.02 ? C.hebilla : C.cinto); return; }
  if (zona === 'pie') { k.set(q.y < 0.022 ? C.suela : C.zapato); return; }
  // tronco y piernas: camisa metida, cinturón y calzas de lana hasta la cintura
  if (q.y < 0.99) { k.set(q.y > 0.11 ? C.calzas : C.zapato); return; }
  k.set(C.camisa);
}

// ---------- Animación por código ----------
// modo 'quieto' (respira, se balancea un poco) o 'andar' (ciclo de paso). t en segundos.
const eu = new THREE.Euler(), qq = new THREE.Quaternion();
const rot = (b, x, y, z) => { b.quaternion.setFromEuler(eu.set(x, y, z, 'XYZ')); };
export function posar(per, modo, t) {
  const B = per.huesos;
  per.reposo.forEach((r, i) => per.malla.skeleton.bones[i].position.copy(r));
  for (const b of per.malla.skeleton.bones) b.quaternion.identity();
  const BAJAR = 0.6; // de los 38° del reposo a unos 5° de la vertical
  if (modo === 'andar') {
    const f = t * Math.PI * 2 * 0.95, s = Math.sin(f), c = Math.cos(f);
    B.cadera.position.y += 0.012 * Math.cos(2 * f) - 0.012;
    rot(B.cadera, 0.03, 0.08 * s, 0.025 * c);
    rot(B.columna, 0.04, -0.05 * s, -0.02 * c);
    rot(B.pecho, 0.03, -0.07 * s, 0);
    rot(B.cabeza, -0.04, 0.05 * s, 0);
    for (const [n, lado] of [['I', 1], ['D', -1]]) {
      const ph = lado > 0 ? s : -s, ph2 = lado > 0 ? c : -c;
      rot(B['muslo' + n], -0.42 * ph - 0.06, 0, 0);
      rot(B['pierna' + n], Math.max(0, 0.25 + 0.75 * ph2) * 0.95, 0, 0); // la rodilla se dobla al pasar la pierna
      rot(B['pie' + n], 0.25 * Math.max(0, -ph) - 0.28 * Math.max(0, ph2), 0, 0);
      rot(B['brazo' + n], 0.38 * ph + 0.05, 0, -lado * BAJAR);
      rot(B['antebrazo' + n], -0.25 - 0.2 * Math.max(0, ph), 0, 0.12 * lado);
      rot(B['mano' + n], 0, 0, 0.05 * lado);
    }
  } else {
    const r = Math.sin(t * Math.PI * 2 / 4.2), b = Math.sin(t * Math.PI * 2 / 7.3);
    rot(B.cadera, 0, 0.03 * b, 0.02 * b);
    rot(B.columna, 0.01 * r, 0, -0.012 * b);
    rot(B.pecho, -0.015 * r, 0, -0.01 * b);
    rot(B.cabeza, 0.03 * b - 0.02, 0.12 * Math.sin(t * 0.37), 0);
    for (const [n, lado] of [['I', 1], ['D', -1]]) {
      rot(B['brazo' + n], 0.04 + 0.015 * r, 0, -lado * (BAJAR - 0.02 * r));
      rot(B['antebrazo' + n], -0.18, 0, 0.12 * lado);
      rot(B['mano' + n], 0, 0.2 * lado, 0.08 * lado);
      rot(B['muslo' + n], lado > 0 ? -0.02 : 0.03, 0, -0.035 * lado);
      rot(B['pierna' + n], lado > 0 ? 0.04 : 0.02, 0, 0);
      rot(B['pie' + n], 0, 0, 0.035 * lado);
    }
  }
  per.raiz.updateMatrixWorld(true);
}
export const PERSONAJE_INFO = { huesos: HUESOS.length, altura: 1.72 };
