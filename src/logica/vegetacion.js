// Kinhold — lo que crece y lo que hay en el suelo del mundo de verdad (Whitholm): los árboles de las siete especies, la
// hierba, las flores, los matorrales y las piedras sueltas. Lógica pura, sin three.js: el servidor podrá saber dónde
// está cada árbol (para validar la tala) con la misma semilla, sin dibujar nada.
//
// Las reglas son las de la vista «Como en el juego» del mapa (src/mapa/juego.js), que valravnx ya vio: el bosque con
// bosqueEn (bioma, lluvia, pendiente, masas y claros, rodales de especie), la hierba más en los claros que bajo el
// bosque, y piedras pocas y sueltas. Siempre en el mismo sitio: el azar de cada cosa sale de su celda del MUNDO
// (azarCelda) y de la semilla del mapa, no del sitio de salida ni del trozo que se esté mirando; así dos cuadros que se
// solapan dan exactamente lo mismo en lo que comparten.
//
// Coordenadas en metros del mundo (x, z). No pone nada en el mar, en la orilla ni en los ríos.
import { azarCelda } from './azar.js';
import { bosqueEn } from './paisaje.js';
import { fbm } from './mapa.js';

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// el tamaño de las celdas de cada cosa (m) y su capa de azar (las mismas que en el mapa)
export const CELDA = { arbol: 4.5, hierba: 0.85, piedra: 2.5 };
const CAPA = { arbol: 1, hierba: 2, piedra: 3 };
export const DENSIDAD_BOSQUE = 0.55;   // de cerca, la densidad de un bosque de verdad (la del mapa)
const PRADO = { pradera: 1, mixto: 0.8, caducifolio: 0.7, encinar: 0.55, taiga: 0.5, brezal: 0.6, matorral: 0.45, turbera: 0.8, alpino: 0.6 };
const PASO_PEND = 3;                   // la pendiente, con vecinos a 3 m (la forma del terreno, no cada piedrecita)

// paisaje: crearPaisaje(mapa). alt(x, z): la altura exacta del suelo (alturaMundo). semilla: la del mapa.
// cuadro: { x0, z0, x1, z1 } (m del mundo) para árboles y piedras; hierba: { x, z, r } el círculo con hierba, flores y
// matas (es lo que más cuesta: solo alrededor de donde se juega), o un cuadro { x0, z0, x1, z1 } (sin el borde de la
// derecha ni el de abajo: así los trozos del juego, uno al lado de otro, no repiten nada). Lo de hierba tiene que caer
// dentro de `cuadro` (la pendiente sale de su rejilla).
// Devuelve { arboles: [{ x, z, y, especie, tam, giro, tono }], hierba: [{ x, z, y, tam, giro, tono }],
//            flores: [{ x, z, y, tam, giro, color }], matas: [ídem hierba], piedras: [{ x, z, y, tam, giro, roca }] }
export function vegetacionEn(paisaje, alt, semilla, cuadro, hierba = null) {
  const { x0, z0, x1, z1 } = cuadro;
  // rejilla de alturas cada 3 m (con un margen) para la pendiente: mucho más barata que preguntar la altura en cada celda
  const M = PASO_PEND * 2, gx0 = Math.floor((x0 - M) / PASO_PEND), gz0 = Math.floor((z0 - M) / PASO_PEND);
  const nx = Math.ceil((x1 + M) / PASO_PEND) - gx0 + 1, nz = Math.ceil((z1 + M) / PASO_PEND) - gz0 + 1;
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = alt((gx0 + i) * PASO_PEND, (gz0 + j) * PASO_PEND);
  const h = (i, j) => H[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  // pendiente (desnivel por metro) en el punto de la rejilla más cercano
  const pendiente = (x, z) => {
    const i = Math.round(x / PASO_PEND) - gx0, j = Math.round(z / PASO_PEND) - gz0;
    return Math.hypot(h(i + 1, j) - h(i - 1, j), h(i, j + 1) - h(i, j - 1)) / (2 * PASO_PEND);
  };
  const tramos = paisaje.riosEn(x0, z0, x1, z1);
  // qué hay en (x, z): nada en el agua ni en la orilla; si no, su sitio (bioma, roca…), la pendiente y la altura
  const sitioEn = (x, z) => {
    const y = alt(x, z);
    if (y < 0.3 || paisaje.agua(x, z, tramos) !== null) return null;
    const st = paisaje.sitio(x, z, y);
    return st && st.bioma ? { st, s: pendiente(x, z), y } : null;
  };
  // las celdas del mundo de lado `paso` en [a0, a1] × [b0, b1], cada una con su azar; con 2 m de margen, porque cada
  // cosa se aparta hasta 2 m del centro de su celda (lo de fuera del cuadro lo quita cada uno después)
  const recorrer = (paso, capa, a0, b0, a1, b1, fn) => {
    const i0 = Math.ceil((a0 - 2) / paso), i1 = Math.floor((a1 + 2) / paso), j0 = Math.ceil((b0 - 2) / paso), j1 = Math.floor((b1 + 2) / paso);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i * paso, j * paso, azarCelda(i, j, capa, semilla));
  };
  const R = { arboles: [], hierba: [], flores: [], matas: [], piedras: [] };

  // árboles: rejilla desordenada de 4,5 m; del tamaño de los del juego (6–11 m), ±15 % cada uno
  recorrer(CELDA.arbol, CAPA.arbol, x0, z0, x1, z1, (cx, cz, r) => {
    const x = cx + (r() - 0.5) * 4, z = cz + (r() - 0.5) * 4, u = r(), q = r(), v = r(), giro = r() * 6.3, tono = 0.82 + r() * 0.3;
    if (x < x0 || x > x1 || z < z0 || z > z1) return;
    const s = sitioEn(x, z); if (!s || s.y < 1.5) return;
    const { d, especie, tam } = bosqueEn(s.st, s.s, x, z, { semilla, u });
    if (!especie || q > d * DENSIDAD_BOSQUE) return;
    R.arboles.push({ x, z, y: s.y, especie, tam: tam * (0.85 + v * 0.3), giro, tono });
  });

  // hierba, flores y matorrales: más en los claros que bajo el bosque; calvas de tierra
  if (hierba) {
    const circulo = hierba.r != null, { x: hx, z: hz, r: hr } = hierba;
    const [a0, b0, a1, b1] = circulo ? [hx - hr, hz - hr, hx + hr, hz + hr] : [hierba.x0, hierba.z0, hierba.x1, hierba.z1];
    const dentro = circulo ? (x, z) => Math.hypot(x - hx, z - hz) <= hr : (x, z) => x >= a0 && x < a1 && z >= b0 && z < b1;
    recorrer(CELDA.hierba, CAPA.hierba, a0, b0, a1, b1, (cx, cz, r) => {
      const x = cx + (r() - 0.5) * 0.8, z = cz + (r() - 0.5) * 0.8, t = r(), a = r(), b = r(), c = r();
      if (!dentro(x, z)) return;
      const s = sitioEn(x, z);
      if (!s || s.st.bioma === 'nieve' || s.y < 1 || s.s > 0.75) return;
      const { d, linde } = bosqueEn(s.st, s.s, x, z, { semilla });
      const prado = PRADO[s.st.bioma] ?? 0.5;
      const calva = suave(0.6, 0.72, fbm(x / 16, z / 16, 41, 3));
      const pHierba = prado * (1 - 0.75 * d) * (1 - calva) * (0.55 + 0.45 * fbm(x / 7, z / 7, 45, 2));
      const pFlor = 0.035 * prado * (1 - d);
      const pMata = 0.007 * (0.4 + d * (1 - d) * 3) + 0.02 * d + 0.03 * linde * (1 - linde) * (d > 0.02);
      if (t < pHierba) R.hierba.push({ x, z, y: s.y, tam: 0.8 + a * 0.9, giro: b * 6.3, tono: 0.85 + c * 0.3 });
      else if (t < pHierba + pFlor) R.flores.push({ x, z, y: s.y, tam: 0.8 + a * 0.5, giro: b * 6.3, color: Math.floor(c * 3) });
      else if (t < pHierba + pFlor + pMata) R.matas.push({ x, z, y: s.y - 0.05, tam: 0.5 + a * 0.6, giro: b * 6.3, tono: 0.85 + c * 0.3 });
    });
  }

  // piedras: pocas y sueltas por el campo; al pie de los cortados, el pedregal (más grandes y juntas)
  recorrer(CELDA.piedra, CAPA.piedra, x0, z0, x1, z1, (cx, cz, r) => {
    const x = cx + (r() - 0.5) * 2.2, z = cz + (r() - 0.5) * 2.2, q = r(), a = r(), giro = r() * 6.3;
    if (x < x0 || x > x1 || z < z0 || z > z1) return;
    if (q > 0.45) return;                                          // ni al pie de un cortado pasaría: no se mira más
    const s = sitioEn(x, z); if (!s || s.y < 0.5 || s.s > 0.8) return;
    let pared = 0; for (let k = 0; k < 8; k++) pared = Math.max(pared, pendiente(x + Math.cos(k * 0.785) * 5, z + Math.sin(k * 0.785) * 5));
    const pie = s.s < 0.7 && pared > 1.1;
    if (q > (pie ? 0.45 : 0.006)) return;
    R.piedras.push({ x, z, y: s.y, tam: pie ? 0.5 + a * 1.5 : 0.3 + a * 0.6, giro, roca: s.st.roca });
  });
  return R;
}

// Lo que crece, por trozos de LADO_VEG m del mundo (el juego los va haciendo alrededor del jugador, unos pocos por
// fotograma). Cada trozo tiene solo lo suyo (sin el borde de la derecha ni el de abajo): los trozos, uno al lado de
// otro, dan exactamente lo mismo que un cuadro grande. conHierba: también la hierba, las flores y las matas.
export const LADO_VEG = 32;
export function vegetacionTrozo(paisaje, alt, semilla, i, j, conHierba = false) {
  const c = { x0: i * LADO_VEG, z0: j * LADO_VEG, x1: (i + 1) * LADO_VEG, z1: (j + 1) * LADO_VEG };
  const v = vegetacionEn(paisaje, alt, semilla, c, conHierba ? c : null);
  const suyo = (e) => e.x >= c.x0 && e.x < c.x1 && e.z >= c.z0 && e.z < c.z1;
  v.arboles = v.arboles.filter(suyo); v.piedras = v.piedras.filter(suyo);
  return v;
}
