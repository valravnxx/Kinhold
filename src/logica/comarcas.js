// Kinhold — las comarcas de Whitholm y sus zonas (valravnx, 29 y 30 oct). Lógica pura (sin three.js), para que el
// servidor sepa igual que el navegador en qué comarca y en qué zona está cada punto.
//
//  - Comarcas: una o varias cuencas de río enteras, así que sus fronteras van por las divisorias de aguas, como las de
//    verdad. En el mundo elegido van las 8 que vio y aprobó valravnx el 30 oct (A a H; los nombres, por decidir).
//  - Zonas: piezas fijas de aproximadamente 1 km² (donde cabe un castillo) en las que se divide cada comarca; las reclaman
//    los clanes con una pieza propia, aparte del mojón (GDD, apartado 11). Salen de puntos repartidos en una rejilla
//    irregular: cada sitio es de la zona del punto más cercano, medido con el plano algo deformado por ruido, así que los
//    lindes van en curva y no hay dos zonas iguales.
//  - La comarca de un sitio es la de su zona: una zona nunca queda partida entre dos comarcas y la frontera de la
//    comarca sigue los lindes de sus zonas (curvos, no a escalones de 1 km).
//
// Cuesta poco: crearComarcas recorre una vez las celdas del mapa (1 km), y zonaEn mira 9 puntos y dos ruidos.
import { fbm } from './azar.js';

export const LADO_ZONA = 1180;          // m entre puntos de zona: zonas de aproximadamente 1,2 km² de media
const FILA = LADO_ZONA * Math.sqrt(3) / 2;
const ALABEO = 0.45 * LADO_ZONA;        // cuánto se deforma el plano para que los lindes vayan en curva
const ESCALA_ALABEO = 1600;             // m: tamaño de las ondas de los lindes
const SEM = 6617;

// El reparto aprobado (mundo 66172, 256 km): cada comarca, las desembocaduras (celda x, y) de sus cuencas principales.
// Las cuencas pequeñas de la costa se unen a la comarca con la que más lindan; la península del oeste es la H.
const APROBADO = {
  A: [[201, 70], [200, 73]], B: [[209, 60], [205, 63]], C: [[195, 23], [197, 23]], D: [[186, 29], [185, 34]],
  E: [[217, 53], [217, 30]], F: [[179, 42], [173, 48]], G: [[182, 80], [178, 77]],
};
const PENINSULA = { letra: 'H', x1: 168, y0: 50, y1: 70 };
// Y la comarca de cada zona tal como la aprobó valravnx (fila j, columna i de la rejilla de zonas, desde J0 e I0): los
// bordes finos salieron de las divisorias de aguas calculadas con el relieve a 50 m, más finas que las celdas de 1 km
// del mapa. «.» es zona sin comarca (mar). Si cambia la rejilla de zonas, la prueba lo detecta (la tabla deja de casar
// con las cuencas).
const TABLA = { J0: 21, I0: 136, filas: [
  '................................C.CCCCC.............',
  '................................CCCCCCCC............',
  '.......................CCCCCCCCCCCCCCCCCC...........',
  '.......................CCCCCCCCCCCCCCCCCCCC.........',
  '......................CCCCCCCCCCCCCCCCCCCCCCCC......',
  '......................CCCCCCCCCCCCCCCCCCCCCCCCC.....',
  '......................DDDDCCCCCCCCCCCCCCCCCCCCC.....',
  '......................DDDDDCCCCCCCCCCCCCCCCCCCCE....',
  '.....................DDDDDDCCCCCCCCCCCCCCCCCCCCE....',
  '......................DDDDDCCCCCCCCCCCCCCCCCCCCEEE..',
  '.....................DDDDDDCCCCCCCCCCCCCCCCCCCEEE...',
  '.....................DDDDDDDCCCCCCCCCCCCCCCEEEEEEEE.',
  '.....................DDDDDDDDCCCCCCCCCCCCCEEEEEEEE..',
  '.....................DDDDDDDDDCCCCCCCCCCCEEEEEEEEEE.',
  '....................DDDDDDDDDDCCCCCCCCCCCEEEEEEEEEE.',
  '.....................DDDDDDDDDDCCCCCCCCCCCEEEEEEEEE.',
  '....................DDDDDDDDDDDCCCCCCCCCCCEEEEEEEEE.',
  '...................DDDDDDDDDDDDDCCCCCCCCCCEEEEEEEEEE',
  '..................DDDDDDDDDDDDDDCCCCCCCCCEEEEEEEEEE.',
  '.................FDDDDDDDDDDDDDDDCCBBCCCEEEEEEEEEEEE',
  '...............FFFDDDDDDDDDDDDDDDBBBBBBEEEEEEEEEEEE.',
  '..............FFFFDDDDDDDDDDDDDDDBBBBBBBEEEEEEEEEEEE',
  '............FFFFFFDDDDDDDDDDDDDBBBBBBBBEEEEEEEEEEEE.',
  '...........FFFFFFFFFDDDDDDDDDDDBBBBBBBBBEEEEEEEEEEEE',
  '..HHH......FFFFFFFFDDDDDDDDDDBBBBBBBBBBBBEEEEEEEEEE.',
  '.HHHHH......FFFFFFFFDDDDDDDDDBBBBBBBBBBBBBEEEEEEEEE.',
  'HHHHHH.....FFFFFFFFFDDDDDDDDBBBBBBBBBBBBBBEEEEEEEE..',
  '.HHHHH.....FFFFFFFFFFFDDDDDBBBBBBBBBBBBBBBBBEEEEEEE.',
  '.HHHHH....FFFFFFFFFFFFDDAABBBBBBBBBBBBBBBBBBEEEEEE..',
  '...HHHHH..FFFFFFFFFFFFFAAAABBBBBBBBBBBBBBBBBEEEEEE..',
  '...HHHHHH.FFFFFFFFFFFFFAAAAABBBBBBBBBBBBBBBEEEEEE...',
  '...HHHHHHH.FFFFFFFFFFFFAAAAAABBBBBBBBBBBBBBEEEEEE...',
  '..HHHHHHH..FFFFFFFFFAAAAAAAABBBBBBBBBBBBBBEEEEEE....',
  '...HHHHHHH.FFFFFFFFAAAAAAAAAABBBBBBBBBBBBBBEEEEE....',
  '...HHHHHHHHFFFFFFFAAAAAAAAAAABBBBBBBBBBBBBEEEEE.....',
  '....HHHHHHHHFFFFFFAAAAAAAAAAAAABBBBBBBBBBBBEEE......',
  '.....HHHHHHFFFFFFAAAAAAAAAAAAAABBBBBBBBBBBBE........',
  '.....HHHHHHHFFFFFFAAAAAAAAAAAAAABBBBBBBBBBBB........',
  '.....HHHHHHHHHFFFAAAAAAAAAAAAAAABBBBBBBBBBB.........',
  '......HHHHHHHHHHFAAAAAAAAAAAAAAAABBBBBBBBB..........',
  '.....HHHHHHHHHHHAAAAAAAAAAAAAAAAABBBBBBB............',
  '......HHHHHHHHHHHAAAAAAAAAAAAAAAAAAABBB.............',
  '......HHHHHHHHHHHAAAAAAAAAAAAAAAAAAABB..............',
  '.......HHHHHHHHHHGAAAAAAAAAAAAAAAAAAAAB.............',
  '.......H.HHHHHHHGGGAAAAAAAAAAAAAAAAAAA..............',
  '..........HHHHHHGGGGAAAAAAAAAAAAAAAAAA..............',
  '..........HHHHHGGGGGAAAAAAAAAAAAAAAAAA..............',
  '...........HHHHGGGGGGAAAAAAAAAAAAAAAA...............',
  '...........HHHGGGGGGGAAAAAAAAAAAAAAA................',
  '...........HHGGGGGGGGGGAAAAAAAAAAAA.................',
  '...........HGGGGGGGGGGGAAAAAAAAAAA..................',
  '............GGGGGGGGGGGGAAAAAAAAAA..................',
  '............GGGGGGGGGGGGAAAAAAAAAA..................',
  '..............GGGGGGGGGGGAAAAAAAAA..................',
  '..............GGGGGGGGGGAAAAAAAAAA..................',
  '................GGGGGGGGGGAAAAAAAA..................',
  '................GGGGGGGGGAAAAAAAA...................',
  '..................GGGGGGGGAAAAAA....................',
  '..................GGGGGGGGAAAAA.....................',
  '....................GGGGGGGAAAA.....................',
  '.....................GGGGGGG........................',
  '.......................GG...........................',
] };
const mundoAprobado = (m) => m.semilla === 66172 && m.lado === 256;

// Comarcas de la isla, celda a celda: Int8Array con el número de comarca (0, 1, …) o -1 fuera de la isla.
function comarcasPorCelda(m) {
  const { N, tierra, pais, rec } = m, isla = m.paisIsla >= 0 ? m.paisIsla : 0;
  const boca = new Int32Array(N * N).fill(-1), celdasDe = new Map();
  for (let i = 0; i < N * N; i++) {
    if (!tierra[i] || pais[i] !== isla) continue;
    let c = i, k = 0; while (tierra[c] && k++ < 5000) { const s = rec[c]; if (s < 0 || s === c) break; c = s; }
    boca[i] = c; if (!celdasDe.has(c)) celdasDe.set(c, []); celdasDe.get(c).push(i);
  }
  const letras = [], lab = new Int8Array(N * N).fill(-1), deCuenca = new Map();
  if (mundoAprobado(m)) {
    for (const [l, bocas] of Object.entries(APROBADO)) { letras.push(l); for (const [x, y] of bocas) deCuenca.set(y * N + x, letras.length - 1); }
    letras.push(PENINSULA.letra);
  } else {
    // otro mundo: cada cuenca de más de 60 km² es una comarca (hasta 12, de la más grande a la más pequeña)
    const km2 = (m.celda / 1000) ** 2;
    [...celdasDe.entries()].filter(([, c]) => c.length * km2 >= 60).sort((a, b) => b[1].length - a[1].length).slice(0, 12)
      .forEach(([b]) => { deCuenca.set(b, letras.length); letras.push(String.fromCharCode(65 + letras.length)); });
  }
  for (const [b, cs] of celdasDe) {
    let l = deCuenca.has(b) ? deCuenca.get(b) : -1;
    if (l < 0 && mundoAprobado(m)) { const x = cs[0] % N, y = (cs[0] / N) | 0; if (x <= PENINSULA.x1 && y >= PENINSULA.y0 && y <= PENINSULA.y1) l = letras.length - 1; }
    if (l >= 0) for (const i of cs) lab[i] = l;
  }
  // las cuencas sin comarca toman la de las celdas con las que más lindan (cuenca entera, varias pasadas)
  for (let pasada = 0; pasada < 60; pasada++) {
    let cambio = false;
    for (const cs of celdasDe.values()) {
      if (lab[cs[0]] >= 0) continue;
      const votos = new Map();
      for (const i of cs) { const x = i % N, y = (i / N) | 0;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + a, yy = y + b; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          const v = lab[yy * N + xx]; if (v >= 0) votos.set(v, (votos.get(v) || 0) + 1); } }
      if (!votos.size) continue;
      let mejor = -1, n = -1; for (const [v, c] of votos) if (c > n) { n = c; mejor = v; }
      for (const i of cs) lab[i] = mejor; cambio = true;
    }
    if (!cambio) break;
  }
  return { letras, lab };
}

export function crearComarcas(m) {
  const { N, celda } = m, { letras, lab } = comarcasPorCelda(m);
  // comarca de la celda (o de la celda de la isla más cercana, hasta 3 km): para los puntos de zona que caen en el mar
  const comarcaCelda = (x, z) => {
    const ci = Math.floor(x / celda), cj = Math.floor(z / celda);
    for (let r = 0; r <= 3; r++) {
      let mejor = -1, dm = Infinity;
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= N || j >= N) continue;
        const v = lab[j * N + i]; if (v < 0) continue;
        const d = Math.hypot((i + 0.5) * celda - x, (j + 0.5) * celda - z); if (d < dm) { dm = d; mejor = v; }
      }
      if (mejor >= 0) return mejor;
    }
    return -1;
  };
  // el punto de la zona (fila j, columna i): rejilla de filas desplazadas, con algo de azar
  const punto = (i, j) => {
    const ax = fbm(i * 3.1, j * 2.7, SEM, 1), az = fbm(i * 2.3 + 40, j * 3.7, SEM + 1, 1);
    return [(i + (j & 1) * 0.5 + (ax - 0.5) * 0.7) * LADO_ZONA, (j + (az - 0.5) * 0.7) * FILA];
  };
  const aprobado = mundoAprobado(m);
  const deTabla = (i, j) => { if (!aprobado) return null; const f = TABLA.filas[j - TABLA.J0], c = f && f[i - TABLA.I0];
    return c && c !== '.' ? letras.indexOf(c) : null; };
  const zonas = new Map();   // cache: clave → { id, i, j, x, z, comarca }
  const zona = (i, j) => {
    const k = j * 100000 + i; let z = zonas.get(k);
    if (!z) { const [x, zz] = punto(i, j); z = { id: k, i, j, x, z: zz, comarca: deTabla(i, j) ?? comarcaCelda(x, zz) }; zonas.set(k, z); }
    return z;
  };
  // ¿de qué zona es el sitio (x, z) en m del mundo? (la del punto más cercano en el plano deformado)
  function zonaEn(x, z) {
    const wx = x + (fbm(x / ESCALA_ALABEO, z / ESCALA_ALABEO, SEM + 7, 3) - 0.5) * 2 * ALABEO;
    const wz = z + (fbm(x / ESCALA_ALABEO + 91, z / ESCALA_ALABEO, SEM + 9, 3) - 0.5) * 2 * ALABEO;
    const j0 = Math.round(wz / FILA);
    let mejor = null, dm = Infinity;
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const i0 = Math.round(wx / LADO_ZONA - (j & 1) * 0.5);
      for (let i = i0 - 1; i <= i0 + 1; i++) { const p = zona(i, j), d = (p.x - wx) ** 2 + (p.z - wz) ** 2; if (d < dm) { dm = d; mejor = p; } }
    }
    return mejor;
  }
  const comarcaEn = (x, z) => { const zz = zonaEn(x, z); return zz.comarca >= 0 ? letras[zz.comarca] : null; };
  return { letras, comarcaDeCelda: lab, zonaEn, comarcaEn };
}
