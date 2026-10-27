// Kinhold — generador del mapa del mundo por semilla (lógica pura, sin three.js ni navegador: el servidor lo puede
// ejecutar igual y todos los jugadores obtienen el mismo mundo).
//
// Método (GDD, apartado 4: «primero el agua, después el terreno»), el de Cordonnier y otros (2016), «Large Scale
// Terrain Generation from Tectonic Uplift and Fluvial Erosion»:
//   1. Silueta del continente y un mapa de LEVANTAMIENTO: dónde crece el terreno y a qué ritmo (fuerte en las
//      cordilleras, flojo en las llanuras).
//   2. Erosión de los ríos («stream power»): dh/dt = u − k·A^m·s^n, con A el área que drena a cada celda y s la
//      pendiente hacia su receptora. Con n = 1 se resuelve de forma implícita en orden de río abajo a río arriba, que
//      es estable con pasos de tiempo grandes. Cada paso: rellenar depresiones (inundación por prioridad), receptora
//      de cada celda (la de mayor pendiente), área drenada y actualizar alturas. Un límite de talud evita picos de
//      aguja. Así los valles salen donde corre el agua y los collados donde dos valles se acercan por arriba.
//   3. Clima (temperatura por latitud y altura; lluvia con el viento del oeste que descarga al subir), biomas, cinco
//      países que crecen desde su centro y se frenan en las cumbres y los ríos grandes (fronteras naturales), roca
//      madre por provincias y vetas (hierro de pantano en turberas, hierro de veta en el contacto del granito o la
//      pizarra con la caliza, carbón en las cuencas de arenisca al pie de las sierras).
// Todo sale de la semilla: mismo número, mismo mundo.

export const LADO_KM = 188;             // GDD: mundo de unos 188 × 188 km con el mar
export const K = 5.61e-7, M = 0.5;      // constante de erosión (1/año) y exponente del área (Cordonnier y otros)
export const DT = 2.5e5;                // paso de tiempo (años)
export const U_MAX = 3.9e-4;            // levantamiento máximo (m/año); ajustado para cumbres de unos 3.000 m
export const PASOS = 140;
export const BLOQUE_KM = 14;             // cada cuánto hay una veta pequeña de hierro y otra de carbón
export const SEMILLA_MUNDO = 66172, LADO_MUNDO = 256;   // el mundo elegido por valravnx el 27 oct

export const BIOMAS = {
  nieve: { nombre: 'Roca y nieve', color: [214, 214, 208] },
  alpino: { nombre: 'Pasto alpino', color: [148, 150, 112] },
  taiga: { nombre: 'Bosque de coníferas', color: [62, 84, 62] },
  brezal: { nombre: 'Brezal', color: [128, 112, 94] },
  caducifolio: { nombre: 'Bosque caducifolio', color: [78, 104, 60] },
  mixto: { nombre: 'Bosque mixto con claros', color: [98, 116, 70] },
  pradera: { nombre: 'Pradera', color: [146, 152, 92] },
  encinar: { nombre: 'Encinar', color: [104, 112, 66] },
  matorral: { nombre: 'Matorral seco', color: [164, 150, 104] },
  turbera: { nombre: 'Turbera', color: [96, 104, 84] },
};
export const ROCAS = {
  granito: { nombre: 'Granito', dura: true, color: [168, 150, 146] },
  pizarra: { nombre: 'Pizarra', dura: false, color: [104, 110, 122] },
  caliza: { nombre: 'Caliza', dura: true, color: [196, 188, 160] },
  arenisca: { nombre: 'Arenisca', dura: false, color: [186, 146, 108] },
};
export const VETAS = {
  hierroPantano: { nombre: 'Hierro de pantano (poco y malo)' },
  hierroVeta: { nombre: 'Veta pequeña de hierro' },
  carbon: { nombre: 'Veta pequeña de carbón' },
  granHierro: { nombre: 'Gran veta de hierro' },
  granCarbon: { nombre: 'Gran veta de carbón' },
};

// ---------- azar con semilla ----------
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const suave = (t) => t * t * (3 - 2 * t);
export function ruido(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = suave(x - xi), fy = suave(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s, oct = 5) {
  let r = 0, amp = 0.5, f = 1, tot = 0;
  for (let o = 0; o < oct; o++) { r += ruido(x * f, y * f, s + o * 31) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return r / tot;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// montículo binario (prioridad = altura) para la inundación por prioridad
class Monticulo {
  constructor(n) { this.k = new Float64Array(n); this.v = new Int32Array(n); this.n = 0; }
  meter(k, v) {
    let i = this.n++; const K_ = this.k, V = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (K_[p] <= k) break; K_[i] = K_[p]; V[i] = V[p]; i = p; }
    K_[i] = k; V[i] = v;
  }
  sacar() {
    const K_ = this.k, V = this.v, v = V[0], k = K_[--this.n], w = V[this.n]; let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && K_[c + 1] < K_[c]) c++; if (K_[c] >= k) break; K_[i] = K_[c]; V[i] = V[c]; i = c; }
    K_[i] = k; V[i] = w; return v;
  }
}

const VEC = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Generador por pasos (para enseñar el progreso en el navegador): yield { fase, avance } y al final devuelve el mapa.
export function* generar(semilla, { lado = LADO_KM, N = 256, pasos = PASOS } = {}) {
  semilla = semilla >>> 0;
  const az = azar(semilla), S = semilla % 100000;
  const celda = lado * 1000 / N, area = celda * celda, NN = N * N;
  const idx = (x, y) => y * N + x;
  const dentro = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

  // distancia (km) desde las celdas «fuente» pasando solo por las «pasables»: transformada de chaflán de dos pasadas
  // (vecinas a 1 y a √2), repetida hasta que no cambia (hace falta en zonas con recovecos)
  const chaflan = (fuente, pasable) => {
    const D = new Float32Array(NN).fill(1e9), k1 = celda / 1000, k2 = k1 * Math.SQRT2;
    for (let i = 0; i < NN; i++) if (fuente(i)) D[i] = 0;
    const ADEL = [[-1, 0, k1], [0, -1, k1], [-1, -1, k2], [1, -1, k2]], ATRAS = [[1, 0, k1], [0, 1, k1], [1, 1, k2], [-1, 1, k2]];
    for (let vuelta = 0; vuelta < 8; vuelta++) {
      let cambia = false;
      for (const [V, y0, y1, dy, x0, x1, dx] of [[ADEL, 0, N, 1, 0, N, 1], [ATRAS, N - 1, -1, -1, N - 1, -1, -1]])
        for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
          const i = idx(x, y); if (D[i] === 0 || !pasable(i)) continue;
          let m = D[i];
          for (const [ax, ay, w] of V) { const xx = x + ax, yy = y + ay; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const v = D[idx(xx, yy)] + w; if (v < m) m = v; }
          if (m < D[i]) { D[i] = m; cambia = true; }
        }
      if (!cambia) break;
    }
    return D;
  };

  // ---------- 1. forma de las tierras ----------
  // Nada de figuras fijas: el relieve de partida se suma con muchas piezas al azar, como en los generadores de mapas
  // de fantasía más usados (plantillas de colinas, sierras, fosas, hoyas y estrechos, y nivel del mar por cuantil):
  //   - colinas grandes que hacen la masa del continente y pequeñas que dan penínsulas, cabos e islas;
  //   - sierras (franjas que suben) y fosas (franjas que bajan), que rompen la masa en golfos, rías y brazos de mar;
  //   - hoyas que dejan mares interiores;
  // todo con las distancias deformadas por ruido (dominio deformado) y un ruido fractal encima para que la costa sea
  // irregular a todas las escalas (las costas de verdad son fractales: Gran Bretaña ~1,25, Noruega ~1,5). Luego un
  // filtro quita motas sueltas de tierra o de agua. La isla grande se añade aparte, donde quede a más de 20 km de mar.
  yield { fase: 'Silueta del continente', avance: 0 };
  const L = lado, C = L / 2, km = celda / 1000;
  const kmX = (i) => (i % N + 0.5) * km, kmY = (i) => (((i / N) | 0) + 0.5) * km;
  // deformación del dominio (en km), dos escalas
  const defX = new Float32Array(NN), defY = new Float32Array(NN);
  for (let i = 0; i < NN; i++) { const x = kmX(i), y = kmY(i);
    defX[i] = x + (fbm(x / 45, y / 45, S + 1, 3) - 0.5) * 34 + (fbm(x / 12, y / 12, S + 4, 3) - 0.5) * 8;
    defY[i] = y + (fbm(x / 45 + 7, y / 45, S + 2, 3) - 0.5) * 34 + (fbm(x / 12 + 3, y / 12, S + 6, 3) - 0.5) * 8; }
  const T = new Float32Array(NN), Rm = new Float32Array(NN);    // forma (0–100) y sierras (levantamiento de montaña)
  // el trazado se da en un marco girado al azar: a = 0 lado del mar abierto … 1 lado del continente; b = de través
  const angC = az() * Math.PI * 2, dir = [Math.cos(angC), Math.sin(angC)], perp = [-dir[1], dir[0]];
  const enMarco = (a, b) => [C + dir[0] * (a - 0.5) * L + perp[0] * (b - 0.5) * L * 0.9, C + dir[1] * (a - 0.5) * L + perp[1] * (b - 0.5) * L * 0.9];
  const entre = (a, b) => a + az() * (b - a);
  const colina = (cx, cy, h, r) => { for (let i = 0; i < NN; i++) { const d = Math.hypot(defX[i] - cx, defY[i] - cy); if (d < r * 2.2) T[i] += h * Math.exp(-((d / r) ** 2)); } };
  // franja a lo largo de un camino al azar (sierra si h > 0, fosa si h < 0); devuelve los puntos del camino
  const franja = (x, y, ang, largo, ancho, h, giro, monte) => {
    const pts = [[x, y]], tramo = 8 * L / 256;
    for (let t = 0; t < largo / tramo; t++) { ang += (az() - 0.5) * giro; x += Math.cos(ang) * tramo; y += Math.sin(ang) * tramo; pts.push([x, y]); }
    for (let i = 0; i < NN; i++) {
      let d = 1e9; const px = defX[i], py = defY[i];
      for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(px, py, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
      if (d > ancho * 2.5) continue;
      const w = Math.exp(-((d / ancho) ** 2));
      T[i] += h * w; if (monte) Rm[i] = Math.max(Rm[i], monte * w);
    }
    return pts;
  };
  const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)); return Math.hypot(px - ax - vx * t, py - ay - vy * t); };
  const angHacia = (haciaTierra, abre) => Math.atan2(dir[1], dir[0]) + (haciaTierra ? 0 : Math.PI) + (az() - 0.5) * abre;
  // masa del continente: colinas grandes hacia su lado
  for (let k = 0, n = 3 + Math.floor(az() * 3); k < n; k++) { const [x, y] = enMarco(entre(0.6, 0.95), entre(0.05, 0.95)); colina(x, y, entre(45, 70), entre(0.13, 0.22) * L); }
  // colinas medianas y pequeñas por todo el mapa: penínsulas, cabos, islas
  for (let k = 0, n = 10 + Math.floor(az() * 9); k < n; k++) { const [x, y] = enMarco(entre(0.1, 0.9), entre(0, 1)); colina(x, y, entre(20, 48), entre(0.02, 0.07) * L); }
  // cordilleras del continente (más o menos de través)
  const sierras = [];
  for (let k = 0, n = 2 + Math.floor(az() * 2); k < n; k++) { const [x, y] = enMarco(entre(0.55, 0.9), entre(0.1, 0.9));
    sierras.push(franja(x, y, Math.atan2(perp[1], perp[0]) + (az() < 0.5 ? Math.PI : 0) + (az() - 0.5) * 0.9, entre(0.3, 0.6) * L, entre(0.035, 0.05) * L, entre(18, 30), 0.7, entre(0.8, 1))); }
  // espinazos que salen hacia el mar: penínsulas largas con su sierra
  for (let k = 0, n = 1 + Math.floor(az() * 3); k < n; k++) { const [x, y] = enMarco(entre(0.5, 0.7), entre(0.1, 0.9));
    sierras.push(franja(x, y, angHacia(false, 1.4), entre(0.22, 0.42) * L, entre(0.04, 0.06) * L, entre(30, 42), 0.6, entre(0.5, 0.75))); }
  // fosas que entran desde el mar: golfos, rías y brazos de mar
  for (let k = 0, n = 5 + Math.floor(az() * 5); k < n; k++) { const [x, y] = enMarco(entre(0.15, 0.6), entre(0.05, 0.95));
    franja(x, y, angHacia(true, 1.8), entre(0.1, 0.32) * L, entre(0.015, 0.04) * L, -entre(30, 55), 1.1, 0); }
  // hoyas: mares interiores
  for (let k = 0, n = Math.floor(az() * 2.3); k < n; k++) { const [x, y] = enMarco(entre(0.6, 0.85), entre(0.2, 0.8)); colina(x, y, -entre(40, 70), entre(0.04, 0.07) * L); }
  // ruido fractal (la costa irregular a todas las escalas) y mar en los bordes del mundo
  for (let i = 0; i < NN; i++) { const x = kmX(i), y = kmY(i);
    T[i] += (fbm(x / 40, y / 40, S + 3, 6) - 0.5) * 50 + (fbm(x / 11, y / 11, S + 8, 4) - 0.5) * 18;
    const borde = Math.max(Math.abs(defX[i] - C), Math.abs(defY[i] - C)) / C;
    T[i] -= smooth(0.66, 0.93, borde) * 150 + smooth(0.88, 1, Math.max(Math.abs(x - C), Math.abs(y - C)) / C) * 200; }
  // la isla grande se reserva antes: su sitio y un anillo de MAR_ISLA km de mar alrededor quedan fuera del continente
  const MAR_ISLA = 20, R_ISLA = 0.16 * L;
  let isla = null;
  {
    let [ix, iy] = enMarco(entre(0.1, 0.24), entre(0.12, 0.88));
    const m = R_ISLA + 6; ix = Math.max(m, Math.min(L - m, ix)); iy = Math.max(m, Math.min(L - m, iy));
    isla = { c: [ix, iy], R: R_ISLA };
    // el borde de la reserva va deformado y con ruido para que la costa de enfrente no salga en arco
    const fuera = R_ISLA + MAR_ISLA + 4;
    for (let i = 0; i < NN; i++) { const r = Math.hypot(kmX(i) - ix, kmY(i) - iy) + (fbm(kmX(i) / 18, kmY(i) / 18, S + 71, 4) - 0.5) * 28;
      if (r < fuera + 26) T[i] -= 120 * smooth(fuera + 26, fuera, r); }
  }
  // nivel del mar: cuantil para que el continente sea en torno al 35 % del mapa (con la isla, algo más)
  const ord = Float32Array.from(T).sort(), nivel = ord[Math.floor(NN * 0.65)];
  for (let i = 0; i < NN; i++) T[i] -= nivel;
  // la isla: varias colinas y una sierra dentro de su radio, así que no sale redonda
  {
    if (isla) {
      const I = new Float32Array(NN), [ix, iy] = isla.c, R = isla.R;
      const col = (cx, cy, h, r) => { for (let i = 0; i < NN; i++) { const d = Math.hypot(defX[i] - cx, defY[i] - cy); I[i] += h * Math.exp(-((d / r) ** 2)); } };
      // colinas a lo largo de un eje curvo: isla alargada e irregular, no redonda
      { let ang = az() * Math.PI * 2; const curva = (az() - 0.5) * 1.2, n = 5 + Math.floor(az() * 3);
        let x = ix - Math.cos(ang) * R * 0.5, y = iy - Math.sin(ang) * R * 0.5;
        for (let k = 0; k < n; k++) { col(x + (az() - 0.5) * R * 0.25, y + (az() - 0.5) * R * 0.25, entre(40, 58), entre(0.2, 0.32) * R);
          ang += curva / n; x += Math.cos(ang) * R / (n - 1); y += Math.sin(ang) * R / (n - 1); } }
      // su sierra
      { let x = ix - R * 0.4, y = iy, ang = az() * Math.PI * 2; x = ix - Math.cos(ang) * R * 0.45; y = iy - Math.sin(ang) * R * 0.45;
        const pts = [[x, y]]; for (let t = 0; t < 6; t++) { ang += (az() - 0.5) * 0.7; x += Math.cos(ang) * R * 0.16; y += Math.sin(ang) * R * 0.16; pts.push([x, y]); }
        const m = entre(0.55, 0.8);
        for (let i = 0; i < NN; i++) { let d = 1e9; for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(defX[i], defY[i], pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
          const w = Math.exp(-((d / (R * 0.22)) ** 2)); I[i] += 15 * w; const r = Math.hypot(kmX(i) - ix, kmY(i) - iy); if (r < R) Rm[i] = Math.max(Rm[i], m * w); }
        sierras.push(pts); }
      for (let i = 0; i < NN; i++) { const r = Math.hypot(kmX(i) - ix, kmY(i) - iy); if (r > R) continue;
        // la costa la marcan las colinas y el ruido; el radio solo apaga lo que se salga
        const vi = I[i] - 18 + (fbm(kmX(i) / 40, kmY(i) / 40, S + 3, 6) - 0.5) * 50 + (fbm(kmX(i) / 11, kmY(i) / 11, S + 8, 4) - 0.5) * 18 - 80 * smooth(R * 0.88, R, r);
        if (vi > T[i]) T[i] = vi; }
    }
  }
  const tierra = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) tierra[i] = T[i] > 0 ? 1 : 0;
  for (let i = 0; i < N; i++) { tierra[idx(i, 0)] = tierra[idx(i, N - 1)] = tierra[idx(0, i)] = tierra[idx(N - 1, i)] = 0; }
  // filtro de costa: el agua rodeada de tierra pasa a tierra y al revés (quita motas sueltas)
  for (let pasada = 0; pasada < 2; pasada++) {
    const t2 = Uint8Array.from(tierra);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { let n = 0; for (const [ax, ay] of VEC) n += tierra[idx(x + ax, y + ay)];
      const i = idx(x, y); if (!tierra[i] && n >= 6) t2[i] = 1; else if (tierra[i] && n <= 2) t2[i] = 0; }
    tierra.set(t2);
  }
  // charcas encerradas de pocas celdas: tierra (los lagos los hace la hidrología); un mar interior cerrado se queda
  const grupo = new Int32Array(NN).fill(-1);
  for (let i = 0; i < NN; i++) if (!tierra[i] && grupo[i] < 0) {
    const cola = [i]; grupo[i] = i; let toca = false;
    for (let k = 0; k < cola.length; k++) { const c = cola[k], x = c % N, y = (c / N) | 0; if (x === 0 || y === 0 || x === N - 1 || y === N - 1) toca = true;
      for (const [ax, ay] of VEC.slice(0, 4)) { const xx = x + ax, yy = y + ay; if (!dentro(xx, yy)) continue; const j = idx(xx, yy); if (!tierra[j] && grupo[j] < 0) { grupo[j] = i; cola.push(j); } } }
    if (!toca && cola.length < 150) for (const c of cola) tierra[c] = 1;
  }
  // islotes de menos de 6 celdas: al agua
  const isl = new Int32Array(NN).fill(-1);
  for (let i = 0; i < NN; i++) if (tierra[i] && isl[i] < 0) {
    const cola = [i]; isl[i] = i;
    for (let k = 0; k < cola.length; k++) { const c = cola[k], x = c % N, y = (c / N) | 0;
      for (const [ax, ay] of VEC) { const xx = x + ax, yy = y + ay; if (!dentro(xx, yy)) continue; const j = idx(xx, yy); if (tierra[j] && isl[j] < 0) { isl[j] = i; cola.push(j); } } }
    if (cola.length < 6) for (const c of cola) tierra[c] = 0;
  }
  // distancia a la costa (km), por anchura de búsqueda
  const costa = chaflan((i) => !tierra[i], () => true);
  const celdaDe = ([kx, ky]) => idx(Math.max(0, Math.min(N - 1, Math.floor(kx * 1000 / celda))), Math.max(0, Math.min(N - 1, Math.floor(ky * 1000 / celda))));
  // separación real de la isla: del trozo de tierra de la isla, la distancia por mar hasta la tierra más cercana
  let separacionIsla = null, celdaIsla = -1;
  if (isla) {
    let ci = celdaDe(isla.c);
    if (!tierra[ci]) { let dm = 1e9; for (let i = 0; i < NN; i++) if (tierra[i]) { const d = Math.hypot(i % N - ci % N, ((i / N) | 0) - ((ci / N) | 0)); if (d < dm) { dm = d; celdaIsla = i; } } ci = celdaIsla; }
    celdaIsla = ci;
    // lo de la isla: su trozo de tierra y los islotes que tenga dentro de su radio
    const g = isl[ci], suya = (i) => tierra[i] && (isl[i] === g || Math.hypot(kmX(i) - isla.c[0], kmY(i) - isla.c[1]) <= isla.R);
    const dd = chaflan(suya, (i) => !tierra[i]);
    separacionIsla = Infinity;
    for (let i = 0; i < NN; i++) if (tierra[i] && !suya(i)) { const x = i % N, y = (i / N) | 0;
      for (const [ax, ay] of VEC) { const xx = x + ax, yy = y + ay; if (!dentro(xx, yy)) continue; const j = idx(xx, yy);
        if (!tierra[j]) separacionIsla = Math.min(separacionIsla, dd[j] + Math.hypot(ax, ay) * celda / 1000); } }
  }

  // ---------- 2. levantamiento: llanuras flojas, tierras altas donde la forma es alta, y las sierras fuertes ----------
  yield { fase: 'Cordilleras', avance: 0.05 };
  const U = new Float32Array(NN);
  let tMax = 1; for (let i = 0; i < NN; i++) if (tierra[i] && T[i] > tMax) tMax = T[i];
  for (let i = 0; i < NN; i++) {
    if (!tierra[i]) continue;
    const x = kmX(i), y = kmY(i);
    let u = 0.02 + 0.09 * fbm(x / 40, y / 40, S + 5, 4) ** 2 * 1.6 + 0.12 * Math.max(0, T[i] / tMax) ** 1.5;   // llanuras y colinas
    u *= smooth(0, 6, costa[i]) * 0.6 + 0.4;
    // a lo largo de la sierra el levantamiento sube y baja: los tramos bajos son collados
    const a = Rm[i] * (0.55 + 0.45 * smooth(0.25, 0.7, fbm(x / 22, y / 22, S + 9, 3))) * (0.75 + 0.5 * fbm(x / 9, y / 9, S + 17, 4));
    U[i] = Math.max(u, a) + Math.min(u, a) * 0.3;
  }

  // ---------- 3. erosión de los ríos (implícita) ----------
  const h = new Float64Array(NN), hf = new Float64Array(NN), rec = new Int32Array(NN), pila = new Int32Array(NN);
  const A = new Float64Array(NN), dist = new Float32Array(NN), visto = new Uint8Array(NN);
  // cada celda tiene su punto un poco desplazado (una rejilla desordenada, como el grafo aleatorio del artículo):
  // las pendientes y los cauces no salen alineados con la rejilla (sin rayas a 45°)
  const jx = new Float32Array(NN), jy = new Float32Array(NN);
  for (let i = 0; i < NN; i++) { jx[i] = (hash2(i, 1, S) - 0.5) * 0.8; jy[i] = (hash2(i, 2, S) - 0.5) * 0.8; }
  const separa = (i, j, ax, ay) => Math.hypot(ax + jx[j] - jx[i], ay + jy[j] - jy[i]) * celda;
  const talud = new Float32Array(NN);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) talud[idx(x, y)] = Math.tan((22 + 18 * fbm(x * celda / 6000, y * celda / 6000, S + 21, 3)) * Math.PI / 180);
  const mont = new Monticulo(NN * 2);
  let nPila = 0;
  const hidrologia = () => {
    // inundación por prioridad desde el mar: rellena depresiones (con un pequeño desnivel para que todo drene)
    visto.fill(0); mont.n = 0; nPila = 0;
    for (let i = 0; i < NN; i++) if (!tierra[i]) { hf[i] = 0; visto[i] = 1; rec[i] = i; }
    for (let i = 0; i < NN; i++) if (!tierra[i]) {
      const x = i % N, y = (i / N) | 0; let toca = false;
      for (const [ax, ay] of VEC) { const xx = x + ax, yy = y + ay; if (dentro(xx, yy) && tierra[idx(xx, yy)]) { toca = true; break; } }
      if (toca) mont.meter(0, i);
    }
    while (mont.n) {
      const c = mont.sacar(); pila[nPila++] = c; const x = c % N, y = (c / N) | 0;
      for (const [ax, ay] of VEC) { const xx = x + ax, yy = y + ay; if (!dentro(xx, yy)) continue; const j = idx(xx, yy);
        if (visto[j]) continue; visto[j] = 1; hf[j] = Math.max(h[j], hf[c] + 1e-3); mont.meter(hf[j], j); }
    }
    // receptora: la vecina de mayor pendiente sobre la superficie rellena
    for (let k = 0; k < nPila; k++) { const i = pila[k]; if (!tierra[i]) continue;
      const x = i % N, y = (i / N) | 0; let mejor = -1, pm = 0, dm = celda;
      for (const [ax, ay] of VEC) { const xx = x + ax, yy = y + ay; if (!dentro(xx, yy)) continue; const j = idx(xx, yy), dd = separa(i, j, ax, ay), p = (hf[i] - hf[j]) / dd;
        if (p > pm) { pm = p; mejor = j; dm = dd; } }
      rec[i] = mejor; dist[i] = dm; }
    // área drenada: de río arriba a río abajo (pila al revés)
    for (let i = 0; i < NN; i++) A[i] = tierra[i] ? area : 0;
    for (let k = nPila - 1; k >= 0; k--) { const i = pila[k]; if (tierra[i] && rec[i] >= 0) A[rec[i]] += A[i]; }
  };
  for (let paso = 0; paso < pasos; paso++) {
    hidrologia();
    for (let k = 0; k < nPila; k++) {
      const i = pila[k]; if (!tierra[i]) continue; const j = rec[i];
      const f = K * Math.pow(A[i], M) * DT / dist[i];
      let nh = (h[i] + DT * U[i] * U_MAX + f * h[j]) / (1 + f);
      const tope = h[j] + dist[i] * talud[i];
      if (nh > tope) nh = Math.max(tope, h[j]);
      h[i] = nh;
    }
    if (paso % 7 === 0) yield { fase: 'Ríos y valles', avance: 0.1 + 0.7 * paso / pasos };
  }
  hidrologia();

  // ---------- 4. clima ----------
  yield { fase: 'Clima y biomas', avance: 0.82 };
  const temp = new Float32Array(NN), lluvia = new Float32Array(NN);
  for (let y = 0; y < N; y++) {
    const lat = y / (N - 1);                       // 0 norte, 1 sur
    let carga = 1;                                 // humedad que trae el viento del oeste
    for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      temp[i] = 8 + 8 * lat - 6.5 * h[i] / 1000 + (fbm(x / 30, y / 30, S + 31, 3) - 0.5) * 2;
      if (!tierra[i]) { carga = Math.min(1, carga + 0.08); continue; }
      const sube = x > 0 ? Math.max(0, h[i] - h[idx(x - 1, y)]) / celda : 0;
      const llueve = carga * (0.012 + sube * 2.2);
      lluvia[i] = llueve * 40 * (1 - 0.4 * lat) * (0.8 + 0.4 * fbm(x / 20, y / 20, S + 33, 3));
      carga = Math.max(0.15, carga - llueve);
    }
  }
  // suavizar la lluvia
  const ll2 = new Float32Array(NN);
  for (let r = 0; r < 2; r++) { for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { let s = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const j = idx(x + a, y + b); if (tierra[j]) { s += lluvia[j]; n++; } } ll2[idx(x, y)] = n ? s / n : 0; } lluvia.set(ll2); }

  // pendiente local
  const pend = new Float32Array(NN);
  for (let i = 0; i < NN; i++) if (tierra[i] && rec[i] >= 0) pend[i] = (h[i] - h[rec[i]]) / dist[i];
  const bioma = new Array(NN).fill(null);
  for (let i = 0; i < NN; i++) if (tierra[i]) bioma[i] = clasificarBioma(temp[i], lluvia[i], pend[i], h[i], A[i] / area);

  // ---------- 5. países: crecen desde 5 centros; cumbres y ríos grandes frenan (fronteras naturales) ----------
  yield { fase: 'Países', avance: 0.88 };
  // centros: la isla es un país; cada península, otro; el resto, en el continente lo más lejos posible
  const centros = [];
  const llanos = []; for (let i = 0; i < NN; i++) if (tierra[i] && costa[i] > 4 && h[i] < 900) llanos.push(i);
  // el continente: el trozo de tierra más grande que no es la isla (los países 2 a 5 nacen ahí, para que puedan crecer)
  const tamGrupo = new Map(); for (let i = 0; i < NN; i++) if (tierra[i]) tamGrupo.set(isl[i], (tamGrupo.get(isl[i]) || 0) + 1);
  const grupoIsla = celdaIsla >= 0 ? isl[celdaIsla] : -2;
  let grupoCont = -1, tamCont = 0; for (const [g, n] of tamGrupo) if (g !== grupoIsla && n > tamCont) { tamCont = n; grupoCont = g; }
  const continente = llanos.filter(i => isl[i] === grupoCont);
  const cercano = (k) => { let mejor = -1, dm = 1e9; const x0 = k % N, y0 = (k / N) | 0;
    for (const i of continente) { const d = Math.hypot(i % N - x0, ((i / N) | 0) - y0); if (d < dm) { dm = d; mejor = i; } } return mejor; };
  if (celdaIsla >= 0) centros.push(celdaIsla);
  while (centros.length < 5 && continente.length) {        // el punto llano más lejos de los centros ya puestos
    let mejor = -1, dm = -1;
    for (let k = 0; k < continente.length; k += 3) { const i = continente[k], x = i % N, y = (i / N) | 0; let d = 1e9;
      for (const c of centros) d = Math.min(d, Math.hypot(x - c % N, y - ((c / N) | 0)));
      d *= 0.85 + 0.3 * hash2(i, 0, S); if (d > dm) { dm = d; mejor = i; } }
    centros.push(mejor);
  }
  // varias vueltas: el país que sale grande crece más despacio en la siguiente (GDD: países de unos 60 × 60 km)
  const pais = new Int8Array(NN).fill(-1), coste = new Float64Array(NN), hecho = new Uint8Array(NN);
  const m2 = new Monticulo(NN * 8), ritmo = [1, 1, 1, 1, 1];
  let mejorPais = null, mejorDesvio = Infinity;
  // los países pueden saltar estrechos de hasta unos 14 km de mar (islas cercanas), con más coste; la isla grande
  // está a más de 20 km, así que sigue siendo un país aparte
  const desdeTierra = chaflan((i) => tierra[i] === 1, () => true);
  const paisable = (j) => tierra[j] || desdeTierra[j] < 7;
  for (let vuelta = 0; vuelta < 16; vuelta++) {
    pais.fill(-1); coste.fill(Infinity); hecho.fill(0); m2.n = 0;
    centros.forEach((c, k) => { pais[c] = k; coste[c] = 0; m2.meter(0, c); });
    while (m2.n) {
      const c = m2.sacar(); if (hecho[c]) continue; hecho[c] = 1; const x = c % N, y = (c / N) | 0;
      for (const [ax, ay] of VEC) { const xx = x + ax, yy = y + ay; if (!dentro(xx, yy)) continue; const j = idx(xx, yy); if (!paisable(j) || hecho[j]) continue;
        const paso = ritmo[pais[c]] * Math.hypot(ax, ay) * (tierra[j] ? 1 + Math.abs(h[j] - h[c]) / 60 + h[j] / 900 + (anchoRio(A[j]) > 40 ? 6 : 0) : 4);
        if (coste[c] + paso < coste[j]) { coste[j] = coste[c] + paso; pais[j] = pais[c]; m2.meter(coste[j], j); } }
    }
    for (let i = 0; i < NN; i++) if (!tierra[i]) pais[i] = -1;   // el mar no es de nadie
    const cuenta = [0, 0, 0, 0, 0]; let tot = 0;
    for (let i = 0; i < NN; i++) if (pais[i] >= 0) { cuenta[pais[i]]++; tot++; }
    // la isla no se equilibra (no puede crecer más allá de su costa); los otros cuatro se reparten el continente
    const fijo = celdaIsla >= 0 ? cuenta[0] : 0, resto = celdaIsla >= 0 ? 4 : 5;
    for (let k = celdaIsla >= 0 ? 1 : 0; k < 5; k++) ritmo[k] = Math.min(8, Math.max(0.125, ritmo[k] * Math.pow(Math.max(cuenta[k], 1) / ((tot - fijo) / resto), 0.2)));
    // se queda el reparto más igualado de todas las vueltas
    let desvio = 0; for (let k = celdaIsla >= 0 ? 1 : 0; k < 5; k++) desvio = Math.max(desvio, Math.abs(cuenta[k] / ((tot - fijo) / resto) - 1));
    if (desvio < mejorDesvio) { mejorDesvio = desvio; mejorPais = Int8Array.from(pais); }
  }

  if (mejorPais) pais.set(mejorPais);
  // islas grandes sueltas (más de 300 km²): del país con la costa más cercana; los islotes quedan sin dueño
  {
    const tam = new Map(); for (let i = 0; i < NN; i++) if (tierra[i] && pais[i] < 0) tam.set(isl[i], (tam.get(isl[i]) || 0) + 1);
    for (const [g, n] of tam) {
      if (n * km * km < 300) continue;
      let mejor = -1, dm = Infinity;
      for (let i = 0; i < NN; i++) { if (isl[i] !== g || i % 3) continue;
        for (let j = 0; j < NN; j += 2) if (pais[j] >= 0) { const d = (i % N - j % N) ** 2 + (((i / N) | 0) - ((j / N) | 0)) ** 2; if (d < dm) { dm = d; mejor = pais[j]; } } }
      if (mejor >= 0) for (let i = 0; i < NN; i++) if (isl[i] === g) pais[i] = mejor;
    }
  }

  // ---------- 6. roca madre por provincias, y vetas ----------
  yield { fase: 'Roca y vetas', avance: 0.94 };
  const provincias = [];
  for (let k = 0; k < 46; k++) { const x = az() * N, y = az() * N; provincias.push({ x, y }); }
  const roca = new Array(NN).fill(null), prov = new Int16Array(NN).fill(-1);
  const umedia = new Float64Array(provincias.length), cuenta = new Float64Array(provincias.length);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y); if (!tierra[i]) continue;
    const wx = x + (fbm(x / 18, y / 18, S + 41, 3) - 0.5) * 22, wy = y + (fbm(x / 18, y / 18, S + 43, 3) - 0.5) * 22;
    let mejor = 0, dm = 1e9; provincias.forEach((p, k) => { const d = (p.x - wx) ** 2 + (p.y - wy) ** 2; if (d < dm) { dm = d; mejor = k; } });
    prov[i] = mejor; umedia[mejor] += U[i]; cuenta[mejor]++;
  }
  const rocaProv = provincias.map((p, k) => {
    const u = cuenta[k] ? umedia[k] / cuenta[k] : 0, r = hash2(k, 7, S);
    if (u > 0.45) return r < 0.6 ? 'granito' : 'pizarra';
    if (u > 0.22) return r < 0.6 ? 'caliza' : r < 0.85 ? 'pizarra' : 'granito';
    return r < 0.55 ? 'arenisca' : 'caliza';
  });
  for (let i = 0; i < NN; i++) if (tierra[i]) roca[i] = rocaProv[prov[i]];
  // Recursos (pedido de valravnx el 27 oct): lo normal, cerca de cualquiera; lo grande, poco y marcado.
  //  - Vetas pequeñas de hierro y de carbón repartidas por bloques de BLOQUE_KM: en cada bloque con tierra, una de
  //    cada, en el sitio que mejor le va a la geología (así nadie tiene que irse lejos para lo de diario).
  //  - Grandes vetas, pocas y separadas, en los mejores sitios: hierro donde el granito o la pizarra tocan la caliza;
  //    carbón en la arenisca al pie de las sierras. Se marcan en el mapa: son para explotar a fondo.
  //  - Hierro de pantano (poco y malo) en las turberas, como antes.
  const vetas = [];
  const contactoCaliza = new Uint8Array(NN);
  for (let y = 3; y < N - 3; y++) for (let x = 3; x < N - 3; x++) {
    const i = idx(x, y); if (!tierra[i] || (roca[i] !== 'granito' && roca[i] !== 'pizarra')) continue;
    for (let b = -3; b <= 3 && !contactoCaliza[i]; b++) for (let a = -3; a <= 3; a++) if (roca[idx(x + a, y + b)] === 'caliza') { contactoCaliza[i] = 1; break; }
  }
  const notaHierro = (i) => (roca[i] === 'granito' || roca[i] === 'pizarra' ? 1 : roca[i] === 'caliza' ? 0.45 : 0.25) + contactoCaliza[i] * 1.2 + U[i] * 0.6 + hash2(i, 61, S) * 0.5;
  const notaCarbon = (i) => (roca[i] === 'arenisca' ? 1.2 : roca[i] === 'caliza' ? 0.4 : 0.15) + (U[i] > 0.08 && U[i] < 0.45 ? 0.6 : 0) + Math.min(pend[i], 0.08) * 4 + hash2(i, 67, S) * 0.5;
  for (let i = 0; i < NN; i++) if (tierra[i] && bioma[i] === 'turbera' && hash2(i, 51, S) < 0.10) vetas.push({ tipo: 'hierroPantano', x: i % N, y: (i / N) | 0 });
  // grandes vetas: unas 4 de hierro y 3 de carbón por cada 25.000 km² de tierra, a más de 45 km entre las del mismo tipo
  let celdasTierra = 0; for (let i = 0; i < NN; i++) celdasTierra += tierra[i];
  const kmTierra = celdasTierra * km * km;
  const grandes = (tipo, nota, apta, n) => {
    const cand = []; for (let i = 0; i < NN; i++) if (tierra[i] && costa[i] > 2 && apta(i)) cand.push(i);
    cand.sort((a, b) => nota(b) - nota(a));
    const puestas = [];
    for (const i of cand) { if (puestas.length >= n) break;
      if (puestas.every(j => Math.hypot(i % N - j % N, ((i / N) | 0) - ((j / N) | 0)) * km > 45)) puestas.push(i); }
    for (const i of puestas) vetas.push({ tipo, x: i % N, y: (i / N) | 0 });
  };
  grandes('granHierro', notaHierro, (i) => contactoCaliza[i] === 1, Math.max(2, Math.round(4 * kmTierra / 25000)));
  grandes('granCarbon', notaCarbon, (i) => roca[i] === 'arenisca' && U[i] > 0.08, Math.max(2, Math.round(3 * kmTierra / 25000)));
  // vetas pequeñas por bloques
  const BLOQUE = Math.max(4, Math.round(BLOQUE_KM / km));
  for (let by = 0; by < N; by += BLOQUE) for (let bx = 0; bx < N; bx += BLOQUE) {
    let mh = -1, mc = -1, nt = 0;
    for (let y = by; y < Math.min(N, by + BLOQUE); y++) for (let x = bx; x < Math.min(N, bx + BLOQUE); x++) {
      const i = idx(x, y); if (!tierra[i]) continue; nt++;
      if (mh < 0 || notaHierro(i) > notaHierro(mh)) mh = i;
      if (mc < 0 || notaCarbon(i) > notaCarbon(mc)) mc = i;
    }
    if (nt < BLOQUE * BLOQUE * 0.08) continue;   // islotes y puntas casi sin tierra: nada
    vetas.push({ tipo: 'hierroVeta', x: mh % N, y: (mh / N) | 0 });
    vetas.push({ tipo: 'carbon', x: mc % N, y: (mc / N) | 0 });
  }

  yield { fase: 'Listo', avance: 1 };
  return { semilla, lado, N, celda, forma: T, tierra, costa, jx, jy, pend, separacionIsla, paisIsla: celdaIsla >= 0 ? 0 : -1, h: Float32Array.from(h), rec, A, temp, lluvia, bioma, pais, centros, roca, vetas, sierras };
}

// Bioma por temperatura media (°C), lluvia (0–1 aprox.), pendiente, altura (m) y celdas que drenan.
export function clasificarBioma(T, P, pendiente, h, celdasArriba) {
  if (T < -2) return 'nieve';
  if (T < 1) return 'alpino';
  if (pendiente < 0.004 && h < 600 && T < 12 && P > 0.55 && celdasArriba > 40) return 'turbera';
  if (T < 6) return P > 0.45 ? 'taiga' : 'brezal';
  if (T < 12) return P > 0.6 ? 'caducifolio' : P > 0.35 ? 'mixto' : 'pradera';
  return P > 0.45 ? 'encinar' : P > 0.25 ? 'mixto' : 'matorral';
}

// Sin pasos (servidor, pruebas): genera del tirón.
export function generarMapa(semilla, opciones) {
  const g = generar(semilla, opciones); let r;
  do { r = g.next(); } while (!r.done);
  return r.value;
}

// Ancho del río (m) por el área que drena: geometría hidráulica, ancho ∝ caudal^0,5 (y caudal ∝ área). Ajustado para
// los gruesos del GDD: 10 km² → 2 m, 1.000 km² → 20 m, 10.000 km² → 63 m.
export const anchoRio = (areaM2) => 0.63 * Math.sqrt(areaM2 / 1e6);
export const claseRio = (ancho) => ancho < 5 ? 'arroyo' : ancho < 40 ? 'rio' : 'grande';

// Resumen para enseñar y comprobar.
export function resumen(m) {
  const { N, tierra, h, A, pais, rec, celda } = m, NN = N * N, ar = celda * celda / 1e6;
  let nt = 0, max = 0; const areaPais = [0, 0, 0, 0, 0];
  const bocas = { arroyo: 0, rio: 0, grande: 0 };
  for (let i = 0; i < NN; i++) {
    if (!tierra[i]) continue; nt++; if (h[i] > max) max = h[i]; if (pais[i] >= 0) areaPais[pais[i]] += ar;
    if (!tierra[rec[i]]) { const c = claseRio(anchoRio(A[i])); if (A[i] > 20e6) bocas[c]++; }
  }
  return { tierraKm2: Math.round(nt * ar), fraccionTierra: nt / NN, separacionIsla: m.separacionIsla == null ? null : Math.round(m.separacionIsla), cumbre: Math.round(max), areaPais: areaPais.map(Math.round), bocas,
    vetas: m.vetas.reduce((o, v) => (o[v.tipo] = (o[v.tipo] || 0) + 1, o), {}) };
}
