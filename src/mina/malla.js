// Kinhold — malla de la roca excavada («vóxeles suavizados», sin three.js para poder medirla en node).
// Método «surface nets» (redes de superficie), el habitual para terreno de vóxeles liso: en cada celda que cruza la
// superficie se pone UN vértice, en la media de los puntos donde la densidad cruza 0,5 por sus aristas; y por cada
// arista que cruza se une un cuadrilátero con las cuatro celdas que la rodean. Así la pared no tiene caras de cubo.
// - La densidad de cada esquina es la media de los 8 cubitos que la tocan (1 = roca): suaviza los escalones.
// - Encima, la rugosidad de la roca: cada vértice se empuja a lo largo de la normal con un ruido 3D de semilla fija
//   que depende solo de la posición, así que todos los jugadores ven la misma pared irregular.
// - Cada trozo hace su malla solo con sus aristas; los vértices del borde salen iguales en los dos trozos vecinos
//   porque se calculan del mismo campo, así que no quedan rendijas.
import { TAM, LADO } from '../logica/excavacion.js';
import { ruido3 } from '../logica/azar.js';

// ruido de valor 3D suave (semilla fija; vive en src/logica/azar.js): mismo resultado en cualquier aparato
export { ruido3 };
export const RUGOSIDAD = 0.11;
// rugosidad de la roca: tres escalas (bultos de más de un metro, de unos 40 cm y grano de unos 15 cm)
export const rugosidad = (x, y, z) => (ruido3(x * 0.7, y * 0.7, z * 0.7, 3) - 0.5) * 2 * RUGOSIDAD * 1.2 + (ruido3(x * 2.3, y * 2.3, z * 2.3, 11) - 0.5) * 2 * RUGOSIDAD + (ruido3(x * 6.7, y * 6.7, z * 6.7, 23) - 0.5) * RUGOSIDAD * 0.7;

// Malla del trozo (cx, cy, cz) de una Excavacion. Devuelve { posiciones, normales, indices, celdas } (arrays planos).
export function mallaTrozo(ex, cx, cy, cz) {
  const N = LADO, S = N + 2;                                 // muestras de -1 a N (esquinas de los cubitos)
  const ox = cx * N, oy = cy * N, oz = cz * N;               // primer cubito del trozo
  // cubitos de -3 a N+1 (N + 5 por eje): roca = 1
  const V = N + 5, vox = new Uint8Array(V * V * V);
  for (let k = 0; k < V; k++) for (let j = 0; j < V; j++) for (let i = 0; i < V; i++)
    vox[(k * V + j) * V + i] = ex.solido(ox + i - 3, oy + j - 3, oz + k - 3) ? 1 : 0;
  // suavizado: cada cubito toma la media de sus 27 vecinos (de -2 a N), y la densidad de cada esquina es la media de
  // los 8 cubitos que la tocan. Así un hueco de cubitos queda redondeado, sin escalones ni planos a 45°.
  const B = N + 3, suav = new Float32Array(B * B * B);
  for (let k = 0; k < B; k++) for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
    let n = 0;
    for (let c = 0; c < 3; c++) for (let b = 0; b < 3; b++) for (let a = 0; a < 3; a++) n += vox[((k + c) * V + (j + b)) * V + (i + a)];
    suav[(k * B + j) * B + i] = n / 27;
  }
  const vx = (i, j, k) => suav[((k + 2) * B + (j + 2)) * B + (i + 2)];
  // densidad en la esquina s (de -1 a N): media de los 8 cubitos (s-1 .. s) que la tocan
  const dens = new Float32Array(S * S * S);
  const di = (i, j, k) => ((k + 1) * S + (j + 1)) * S + (i + 1);
  for (let k = -1; k <= N; k++) for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) {
    let n = 0;
    for (let a = -1; a <= 0; a++) for (let b = -1; b <= 0; b++) for (let c = -1; c <= 0; c++) n += vx(i + a, j + b, k + c);
    dens[di(i, j, k)] = n / 8;
  }
  const d = (i, j, k) => dens[di(i, j, k)];
  // un vértice por celda que cruza (celdas de -1 a N-1: la celda c va de la muestra c a c+1)
  const C = N + 1, idCelda = new Int32Array(C * C * C).fill(-1);
  const ci = (i, j, k) => ((k + 1) * C + (j + 1)) * C + (i + 1);
  const pos = [], nor = [];
  const ARISTAS = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const esq = new Float32Array(8);
  for (let k = -1; k < N; k++) for (let j = -1; j < N; j++) for (let i = -1; i < N; i++) {
    let dentro = 0;
    for (let e = 0; e < 8; e++) { esq[e] = d(i + (e & 1), j + ((e >> 1) & 1), k + ((e >> 2) & 1)); if (esq[e] > 0.5) dentro++; }
    if (dentro === 0 || dentro === 8) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of ARISTAS) {
      const da = esq[a], db = esq[b];
      if ((da > 0.5) === (db > 0.5)) continue;
      const t = (0.5 - da) / (db - da);
      px += (a & 1) + t * ((b & 1) - (a & 1)); py += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); pz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
      n++;
    }
    // normal: hacia donde baja la densidad (de la roca al aire)
    const gx = (esq[0] + esq[2] + esq[4] + esq[6]) - (esq[1] + esq[3] + esq[5] + esq[7]);
    const gy = (esq[0] + esq[1] + esq[4] + esq[5]) - (esq[2] + esq[3] + esq[6] + esq[7]);
    const gz = (esq[0] + esq[1] + esq[2] + esq[3]) - (esq[4] + esq[5] + esq[6] + esq[7]);
    const gl = Math.hypot(gx, gy, gz) || 1;
    let x = (ox + i + px / n) * TAM, y = (oy + j + py / n) * TAM, z = (oz + k + pz / n) * TAM;
    const r = rugosidad(x, y, z);
    x += gx / gl * r; y += gy / gl * r; z += gz / gl * r;
    idCelda[ci(i, j, k)] = pos.length / 3;
    pos.push(x, y, z); nor.push(gx / gl, gy / gl, gz / gl);
  }
  // cuadriláteros: por cada arista del trozo (muestra de inicio de 0 a N-1) que cruza la superficie
  const ind = [];
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d0 = d(i, j, k);
    for (let eje = 0; eje < 3; eje++) {
      const [ai, aj, ak] = eje === 0 ? [1, 0, 0] : eje === 1 ? [0, 1, 0] : [0, 0, 1];
      const d1 = d(i + ai, j + aj, k + ak);
      if ((d0 > 0.5) === (d1 > 0.5)) continue;
      // las cuatro celdas alrededor de la arista (desplazadas -1 en los otros dos ejes)
      const [ui, uj, uk] = eje === 0 ? [0, 1, 0] : eje === 1 ? [0, 0, 1] : [1, 0, 0];
      const [wi, wj, wk] = eje === 0 ? [0, 0, 1] : eje === 1 ? [1, 0, 0] : [0, 1, 0];
      const a = idCelda[ci(i - ui - wi, j - uj - wj, k - uk - wk)], b = idCelda[ci(i - wi, j - wj, k - wk)];
      const c = idCelda[ci(i, j, k)], e = idCelda[ci(i - ui, j - uj, k - uk)];
      if (a < 0 || b < 0 || c < 0 || e < 0) continue;
      // orientación: la cara mira hacia el aire
      if (d0 > 0.5) ind.push(a, b, c, a, c, e); else ind.push(a, c, b, a, e, c);
    }
  }
  return { posiciones: new Float32Array(pos), normales: new Float32Array(nor), indices: new Uint32Array(ind), celdas: pos.length / 3 };
}
