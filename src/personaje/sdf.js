// Kinhold — escultura por campos de distancia (SDF) para personajes.
// Matemática pura (sin three.js): se usa al hornear en node y se puede usar en el navegador.
// Cada forma devuelve la distancia con signo a su superficie (negativa dentro).
// Las formas se funden con una unión suave (smin) de radio k, como arcilla.

export const v3 = (x, y, z) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// unión suave polinómica (Quilez)
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) { return -smin(-a, -b, k); }

// rotación por ángulos (x, y, z) → matriz 3×3 (filas) que lleva del mundo al marco de la forma
function rotacion(rx = 0, ry = 0, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz·Ry·Rx ; la inversa es la traspuesta
  const R = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
  return [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
}
const mul = (M, p) => [M[0][0] * p[0] + M[0][1] * p[1] + M[0][2] * p[2], M[1][0] * p[0] + M[1][1] * p[1] + M[1][2] * p[2], M[2][0] * p[0] + M[2][1] * p[1] + M[2][2] * p[2]];

// ---------- Formas ----------
// opciones comunes: hueso (nombre), k (radio de fusión con lo anterior), color (0xRRGGBB, opcional), quitar (true = se resta)
export function esfera(c, r, op = {}) {
  return { ...op, centro: c, alcance: r, d: (p) => len(sub(p, c)) - r };
}
export function elipsoide(c, radios, op = {}) {
  const M = op.giro ? rotacion(...op.giro) : null, [a, b, cc] = radios;
  return {
    ...op, centro: c, alcance: Math.max(a, b, cc),
    d: (p) => {
      let q = sub(p, c); if (M) q = mul(M, q);
      const k0 = Math.hypot(q[0] / a, q[1] / b, q[2] / cc), k1 = Math.hypot(q[0] / (a * a), q[1] / (b * b), q[2] / (cc * cc));
      return k1 < 1e-9 ? -Math.min(a, b, cc) : k0 * (k0 - 1) / k1;
    },
  };
}
// cono redondeado (cápsula que adelgaza) entre a (radio ra) y b (radio rb) — Quilez
export function cono(a, b, ra, rb, op = {}) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  return {
    ...op, centro: lerp(a, b, 0.5), alcance: Math.sqrt(l2) / 2 + Math.max(ra, rb),
    d: (p) => {
      const pa = sub(p, a), y = dot(pa, ba), z = y - l2;
      const xv = [pa[0] * l2 - ba[0] * y, pa[1] * l2 - ba[1] * y, pa[2] * l2 - ba[2] * y];
      const x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
      if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
      return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
    },
  };
}
export const capsula = (a, b, r, op = {}) => cono(a, b, r, r, op);
// caja redondeada (centro, semilados, radio de canto)
export function caja(c, s, r, op = {}) {
  const M = op.giro ? rotacion(...op.giro) : null;
  return {
    ...op, centro: c, alcance: Math.hypot(s[0], s[1], s[2]) + r,
    d: (p) => {
      let q = sub(p, c); if (M) q = mul(M, q);
      const qx = Math.abs(q[0]) - s[0], qy = Math.abs(q[1]) - s[1], qz = Math.abs(q[2]) - s[2];
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
    },
  };
}

// ---------- Capas ----------
// Una capa es una lista de formas fundidas (piel, túnica, pelo...). Opciones:
//  inflar: grosor que se añade (la ropa es el cuerpo inflado), recorte(p): distancia extra que corta
//  la capa (se aplica con max), relieve(p): pequeño desplazamiento (pliegues, mechones), color(p, forma).
export function capa(nombre, formas, op = {}) { return { nombre, formas, inflar: op.inflar ?? 0, recorte: op.recorte, relieve: op.relieve, color: op.color, pesos: op.pesos, k: op.k ?? 0.01, kRecorte: op.kRecorte ?? 0.0025 }; }

// distancia de una capa y la forma que más aporta (para color y pesos)
export function evaluarCapa(C, p) {
  // fases: 1) se funde lo normal, 2) se resta lo marcado 'quitar', 3) se funde lo marcado 'despues'
  // (p. ej. los párpados, que van dentro de la cuenca ya hundida), 4) se resta lo 'quitar' + 'final'
  let d = Infinity, mejor = null, mejorD = Infinity;
  const fundir = (f) => {
    const k = f.k ?? C.k;
    const lejos = len(sub(p, f.centro)) - f.alcance;
    if (lejos > d + k && lejos > mejorD) return; // lejos: no cambia nada (gran ahorro)
    const df = f.d(p);
    if (df < mejorD) { mejorD = df; mejor = f; }
    d = smin(d, df, k);
  };
  const restar = (f) => {
    const lejos = len(sub(p, f.centro)) - f.alcance;
    if (lejos > (f.k ?? 0) + 0.001) return;
    d = smax(d, -f.d(p), f.k ?? 0);
  };
  for (const f of C.formas) if (!f.quitar && !f.despues) fundir(f);
  for (const f of C.formas) if (f.quitar && !f.final) restar(f);
  for (const f of C.formas) if (f.despues) fundir(f);
  for (const f of C.formas) if (f.quitar && f.final) restar(f);
  d -= C.inflar;
  if (C.relieve) d += C.relieve(p);
  if (C.recorte) d = smax(d, C.recorte(p), C.kRecorte); // borde de la capa (dobladillo, línea del pelo), algo suavizado
  return { d, forma: mejor };
}
// campo total: la capa más exterior manda
export function evaluar(capas, p) {
  let d = Infinity, capaGana = null, formaGana = null;
  let dS = Infinity;
  for (const C of capas) {
    const r = evaluarCapa(C, p);
    dS = smin(dS, r.d, UNION_CAPAS);
    if (r.d < d) { d = r.d; capaGana = C; formaGana = r.forma; }
  }
  return { d: dS, capa: capaGana, forma: formaGana };
}
// entre capas, una unión muy suave: quita el escalón de rejilla donde el pelo o la ropa tocan la piel
const UNION_CAPAS = 0.0015;
export function distancia(capas, p) { let d = Infinity; for (const C of capas) d = smin(d, evaluarCapa(C, p).d, UNION_CAPAS); return d; }
