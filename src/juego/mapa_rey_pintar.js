// Kinhold — el mapa del rey (valravnx, 31 oct): Whitholm, la isla del rey, cartografiada. Se lleva desde que apareces y
// enseña la costa, las comarcas con su nombre, los ríos, la ciudad del rey y dónde estás tú.
//
// Aquí se calcula todo lo del mapa sin página ni three.js (se puede medir y probar en node). El estilo, el de las cartas
// pintadas a mano (mirado el 31 oct): papel envejecido; el mar entintado con líneas de agua que siguen la costa; la
// tierra con un lavado apagado del color de su bioma y un sombreado suave del relieve, siempre con la luz del noroeste;
// los montes y los bosques, dibujados como símbolos (montes de perfil con el lado de la sombra rayado y árboles uno a uno,
// redondos o de copa en punta); las fronteras de las comarcas con su raya de puntos y una franja de color por dentro
// (como el iluminado de las cartas de la época), y Strandvang, las tierras del rey, en dorado.
//
// La costa, la altura y los biomas son los del juego (paisaje.grande y paisaje.sitio, src/logica/paisaje.js): la costa
// del mapa es la que se ve al andar, y los ríos, los mismos que corren por el mundo (paisaje.rios).
//
// Aquí sale la imagen de fondo (papel, mar, tierra, fronteras) y las listas de lo que se dibuja encima: montes, árboles,
// ríos y el sitio del nombre de cada comarca. Lo dibuja src/juego/mapa_rey.js, en la página.
//
// Cuesta alrededor de un segundo en el PC (medido el 31 oct en node); por eso pintarMapaRey es un generador que hace
// unas pocas filas en cada paso y deja seguir al juego entre medias.
import { fbm, hash2 } from '../logica/azar.js';
import { BIOMAS } from '../logica/mapa.js';
import { ISLA, CIUDAD_REY } from '../logica/whitholm.js';

export const PX_KM = 14;          // resolución de la imagen de fondo (px por km)
export const MARGEN_KM = 2;       // mar alrededor del cuadro de la isla
// los colores de la franja de cada comarca (A a H), apagados como tintas viejas; Strandvang (E), el dorado del rey
export const TINTAS = [[104, 128, 66], [176, 128, 52], [52, 92, 70], [126, 140, 96], [204, 156, 44], [160, 84, 50], [72, 96, 132], [124, 74, 108]];
export const COMARCA_REY = 4;     // Strandvang
const PAPEL = [232, 214, 172], TINTA = [58, 42, 30], MAR = [128, 156, 164], RAYA = [124, 40, 30];
export const BOSQUES = { taiga: 'conifera', caducifolio: 'redondo', mixto: 'mixto', encinar: 'redondo' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// el cuadro del mapa en km del mundo
export function cuadroMapa() {
  return { x0: ISLA.x0 / 1000 - MARGEN_KM, y0: ISLA.z0 / 1000 - MARGEN_KM, x1: ISLA.x1 / 1000 + MARGEN_KM, y1: ISLA.z1 / 1000 + MARGEN_KM };
}

// Lo pinta a pasos. `filas`: cuántas filas por paso. Al terminar devuelve
// { ancho, alto, pxKm, cuadro, rgba, comarca (Int8Array por píxel), tierra (Uint8Array), rios: [[[xkm, ykm, anchoM], …], …],
//   montes: [[xkm, ykm, alto (0–1)], …], arboles: [[xkm, ykm, tipo], …], etiquetas: [{ k, x, y }] }
export function* pintarMapaRey(paisaje, comarcas, { pxKm = PX_KM, filas = 16 } = {}) {
  const cuadro = cuadroMapa();
  const W = Math.ceil((cuadro.x1 - cuadro.x0) * pxKm), H = Math.ceil((cuadro.y1 - cuadro.y0) * pxKm), NP = W * H;
  const kmX = (px) => cuadro.x0 + (px + 0.5) / pxKm, kmY = (py) => cuadro.y0 + (py + 0.5) / pxKm;
  const tierra = new Uint8Array(NP), alt = new Float32Array(NP), com = new Int8Array(NP).fill(-1), bio = new Array(NP);

  // 1) lo caro, por filas: tierra, altura, bioma y comarca de cada píxel
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px, xm = kmX(px) * 1000, ym = kmY(py) * 1000;
      const g = paisaje.grande(xm, ym);
      if (g.f < 0) continue;
      tierra[i] = 1;
      // la altura del mapa con algo de relieve de detalle (como el visor del mapa), para que el sombreado no salga liso
      const a = alt[i] = Math.max(1, g.hm + (fbm(xm / 2200, ym / 2200, 79, 4) - 0.5) * (40 + g.hm * 0.12));
      bio[i] = paisaje.sitio(xm, ym, a).bioma;
      com[i] = comarcas.zonaEn(xm, ym).comarca;
    }
    if (py % filas === filas - 1) yield { avance: (py + 1) / H * 0.75 };
  }

  // 2) distancias (en px, a saltos de 4 vecinos): del mar a la costa, de la tierra a la costa y de cada sitio de tierra
  // a la frontera de su comarca
  const dMar = new Float32Array(NP).fill(1e9), dCosta = new Float32Array(NP).fill(1e9), dBorde = new Float32Array(NP).fill(1e9);
  // (a pasos: cada 40.000 casillas deja seguir al juego)
  function* extender(D, cola, puede) {
    for (let q = 0; q < cola.length; q++) {
      if (q % 20000 === 19999) yield { avance: 0.77 };
      const c = cola[q], x = c % W, y = (c / W) | 0;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, y > 0 ? c - W : -1, y < H - 1 ? c + W : -1]) {
        if (j < 0 || !puede(j, c) || D[j] <= D[c] + 1) continue;
        D[j] = D[c] + 1; cola.push(j);
      }
    }
  }
  const colaMar = [], colaCosta = [], colaBorde = [];
  for (let i = 0; i < NP; i++) {
    if (i % (W * 48) === W * 48 - 1) yield { avance: 0.76 };
    if (!tierra[i]) continue;
    dMar[i] = 0; colaMar.push(i);
    const x = i % W, y = (i / W) | 0, c = com[i];
    const mar = (j) => !tierra[j], otra = (j) => tierra[j] && com[j] !== c;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || mar(i - 1) || mar(i + 1) || mar(i - W) || mar(i + W)) { dCosta[i] = 0; colaCosta.push(i); }
    if ((x > 0 && otra(i - 1)) || (x < W - 1 && otra(i + 1)) || (y > 0 && otra(i - W)) || (y < H - 1 && otra(i + W))) { dBorde[i] = 0; colaBorde.push(i); }
  }
  yield* extender(dMar, colaMar, (j) => !tierra[j]);
  yield* extender(dCosta, colaCosta, (j) => tierra[j] === 1);
  yield* extender(dBorde, colaBorde, (j, c) => tierra[j] && com[j] === com[c]);
  yield { avance: 0.8 };

  // 3) los colores, por filas
  const rgba = new Uint8ClampedArray(NP * 4), paso = 1000 / pxKm;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px, o = i * 4, xk = kmX(px), yk = kmY(py);
      // el papel: manchas grandes y suaves, fibra fina y los bordes del pliego algo más oscuros
      const mancha = fbm(xk / 9, yk / 9, 311, 3), fibra = hash2(px, py, 17) - 0.5;
      const bx = Math.min(px, W - 1 - px) / W, by = Math.min(py, H - 1 - py) / H, vin = clamp(Math.min(bx, by) * 8, 0, 1);
      const luzPapel = (0.88 + 0.16 * mancha) * (0.86 + 0.14 * vin);
      let col = [PAPEL[0] * luzPapel + fibra * 8, PAPEL[1] * luzPapel + fibra * 8, PAPEL[2] * luzPapel + fibra * 7];
      if (!tierra[i]) {
        const d = dMar[i];
        col = mezclar(col, MAR, 0.42 + 0.2 * clamp(d / 90, 0, 1));
        // líneas de agua a lo largo de la costa, cada vez más separadas y claras mar adentro
        for (const [r, fuerza] of [[4.5, 0.55], [9.5, 0.4], [16, 0.28], [24, 0.16]]) {
          const e = Math.abs(d - r); if (e < 0.9) col = mezclar(col, [62, 84, 92], fuerza * (1 - e / 0.9));
        }
        if (d <= 2) col = mezclar(col, TINTA, d <= 1 ? 0.92 : 0.45);   // la costa entintada
      } else {
        const b = bio[i], a = alt[i];
        col = mezclar(col, BIOMAS[b] ? BIOMAS[b].color : [146, 152, 92], b === 'nieve' ? 0.15 : 0.3);
        // lo alto, hacia el ocre y, en las cumbres, hacia el papel
        if (a > 500) col = mezclar(col, [168, 136, 98], clamp((a - 500) / 900, 0, 0.4));
        if (a > 1600) col = mezclar(col, [236, 228, 208], clamp((a - 1600) / 900, 0, 0.6));
        // sombreado suave del relieve, luz del noroeste, en sepia
        const xa = Math.max(px - 1, 0), xb = Math.min(px + 1, W - 1), ya = Math.max(py - 1, 0), yb = Math.min(py + 1, H - 1);
        const dzx = (alt[py * W + xb] - alt[py * W + xa]) / (2 * paso), dzy = (alt[yb * W + px] - alt[ya * W + px]) / (2 * paso);
        const nx = -dzx * 2, ny = -dzy * 2, nl = Math.hypot(nx, ny, 1);
        const luz = (nx * -0.55 + ny * -0.55 + 0.63) / nl, s = clamp(0.8 + 0.6 * (luz - 0.45), 0.6, 1.1);
        col = s < 1 ? mezclar(col, [88, 64, 44], (1 - s) * 1.2) : mezclar(col, [248, 238, 212], (s - 1) * 1.8);
        // la comarca: franja de su color por dentro de la frontera, y la raya de puntos
        const c = com[i];
        if (c >= 0) {
          const db = dBorde[i], ancho = c === COMARCA_REY ? 11 : 7;
          if (c === COMARCA_REY) col = mezclar(col, TINTAS[c], 0.12);
          if (db < ancho) col = mezclar(col, TINTAS[c], 0.55 * Math.pow(1 - db / ancho, 1.4));
          if (db < 1.5 && ((Math.floor(px / 4) + Math.floor(py / 4)) & 1)) col = mezclar(col, RAYA, 0.9);
        }
        if (dCosta[i] < 1) col = mezclar(col, TINTA, 0.8);   // la costa por el lado de tierra
      }
      rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 255;
    }
    if (py % filas === filas - 1) yield { avance: 0.8 + (py + 1) / H * 0.15 };
  }

  // 4) los símbolos: montes donde la tierra es alta (cada 1,6 km, movidos un poco al azar) y árboles en los bosques
  // (cada 0,8 km), nunca en el agua ni pegados a la costa ni a la ciudad
  const ciu = [CIUDAD_REY.x / 1000, CIUDAD_REY.z / 1000];
  const enPx = (x, y) => { const px = Math.floor((x - cuadro.x0) * pxKm), py = Math.floor((y - cuadro.y0) * pxKm); return px < 0 || py < 0 || px >= W || py >= H ? -1 : py * W + px; };
  const lejosCiudad = (x, y, r) => Math.hypot(x - ciu[0], y - ciu[1]) > r;
  const montes = [], arboles = [];
  const cumbre = alt.reduce((m, v) => Math.max(m, v), 0);
  for (let gy = 0, y = cuadro.y0; y < cuadro.y1; y += 1.3, gy++) for (let gx = 0, x = cuadro.x0 + (gy % 2) * 0.8; x < cuadro.x1; x += 1.6, gx++) {
    const xx = x + (hash2(gx, gy, 41) - 0.5) * 0.9, yy = y + (hash2(gx, gy, 42) - 0.5) * 0.7, i = enPx(xx, yy);
    if (i < 0 || !tierra[i] || dCosta[i] < 0.8 * pxKm || alt[i] < 620) continue;
    montes.push([xx, yy, clamp((alt[i] - 620) / (cumbre - 620), 0, 1)]);
  }
  for (let gy = 0, y = cuadro.y0; y < cuadro.y1; y += 0.62, gy++) for (let gx = 0, x = cuadro.x0 + (gy % 2) * 0.4; x < cuadro.x1; x += 0.8, gx++) {
    const xx = x + (hash2(gx, gy, 43) - 0.5) * 0.6, yy = y + (hash2(gx, gy, 44) - 0.5) * 0.45, i = enPx(xx, yy);
    if (i < 0 || !tierra[i] || dCosta[i] < 0.5 * pxKm || !BOSQUES[bio[i]] || alt[i] > 1300 || !lejosCiudad(xx, yy, 1.6)) continue;
    let tipo = BOSQUES[bio[i]]; if (tipo === 'mixto') tipo = hash2(gx, gy, 45) < 0.5 ? 'conifera' : 'redondo';
    if (montes.some(m => Math.abs(m[0] - xx) < 0.9 && Math.abs(m[1] - yy) < 0.7)) continue;   // sin árboles encima de un monte
    arboles.push([xx, yy, tipo]);
  }
  montes.sort((a, b) => a[1] - b[1]); arboles.sort((a, b) => a[1] - b[1]);   // de arriba abajo: los de delante tapan a los de detrás
  yield { avance: 0.96 };

  // 5) los ríos del juego que pasan por el mapa (en km, con su ancho en m), cortados en la costa
  const rios = [];
  for (const r of paisaje.rios) {
    const pts = [];
    for (const q of r) {
      const i = enPx(q.p[0], q.p[1]); if (i < 0) continue;
      pts.push([q.p[0], q.p[1], 0.63 * Math.sqrt(q.a / 1e6)]);
      if (!tierra[i]) break;   // llega al mar
    }
    // la boca: el río del juego acaba en la línea de costa (unos metros antes, a veces), y en el mapa se quedaba un píxel
    // antes del mar; si acaba en tierra y no en otro río, se alarga en su dirección hasta el agua (como mucho 1,5 km)
    const n = pts.length, ult = pts[n - 1], iu = n > 1 ? enPx(ult[0], ult[1]) : -1;
    if (iu >= 0 && tierra[iu] && dCosta[iu] < 1 * pxKm) {
      const pen = pts[n - 2], dx = ult[0] - pen[0], dy = ult[1] - pen[1], l = Math.hypot(dx, dy) || 1;
      for (let a = 0.05; a <= 1.5; a += 0.05) {
        const x = ult[0] + dx / l * a, y = ult[1] + dy / l * a, i = enPx(x, y);
        if (i < 0) break;
        if (!tierra[i]) { pts.push([x, y, ult[2]]); break; }
      }
    }
    if (pts.length > 1) rios.push(pts);
  }
  yield { avance: 0.98 };

  // 6) dónde va el nombre de cada comarca: el sitio más lejos de su frontera y de la costa (no su centro de masas, que en
  // las comarcas alargadas cae fuera); el de Strandvang, además, lejos de la ciudad, para no taparla
  const mejor = comarcas.letras.map(() => ({ nota: -1, x: 0, y: 0 }));
  for (let i = 0; i < NP; i++) {
    const c = com[i]; if (c < 0 || !tierra[i]) continue;
    const x = kmX(i % W), y = kmY((i / W) | 0);
    let nota = Math.min(dBorde[i], dCosta[i]) / pxKm;
    if (c === COMARCA_REY) nota = Math.min(nota, Math.hypot(x - ciu[0], y - ciu[1]) / 2);
    if (nota > mejor[c].nota) mejor[c] = { nota, x, y };
  }
  yield { avance: 1 };
  return { ancho: W, alto: H, pxKm, cuadro, rgba, comarca: com, tierra, rios, montes, arboles,
    etiquetas: mejor.map((m, k) => (m.nota < 0 ? null : { k, x: m.x, y: m.y })).filter(Boolean) };
}
