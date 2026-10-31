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

// Contornos (marching squares): las líneas por donde v(x, y) pasa por `nivel`, con los puntos en los centros de los
// píxeles y el corte de cada lado interpolado. vale(x, y): si la casilla (x, y)–(x+1, y+1) cuenta (null: todas).
// Solo dentro del recuadro `caja` ([x0, y0, x1, y1] en px; si no, todo). Es un generador: cada 24 filas deja seguir al
// juego, y al final devuelve las polilíneas en px, ya encadenadas.
const CASOS = { 1: [['L', 'B']], 2: [['B', 'R']], 3: [['L', 'R']], 4: [['T', 'R']], 5: [['L', 'T'], ['B', 'R']], 6: [['T', 'B']], 7: [['L', 'T']],
  8: [['L', 'T']], 9: [['T', 'B']], 10: [['T', 'R'], ['L', 'B']], 11: [['T', 'R']], 12: [['L', 'R']], 13: [['B', 'R']], 14: [['L', 'B']] };
export function* contornos(W, H, v, nivel, vale, caja = null) {
  const segs = [], porLado = new Map();
  const [X0, Y0, X1, Y1] = caja ? [Math.max(0, caja[0] - 1), Math.max(0, caja[1] - 1), Math.min(W - 1, caja[2] + 1), Math.min(H - 1, caja[3] + 1)] : [0, 0, W - 1, H - 1];
  for (let y = Y0; y < Y1; y++) {
    if ((y - Y0) % 24 === 23) yield null;
    let a = v(X0, y), d = v(X0, y + 1);
    for (let x = X0; x < X1; x++) {
      const b = v(x + 1, y), c = v(x + 1, y + 1);
      const caso = (a > nivel ? 8 : 0) | (b > nivel ? 4 : 0) | (c > nivel ? 2 : 0) | (d > nivel ? 1 : 0);
      if (caso && caso !== 15 && (!vale || vale(x, y))) {
        const t = (p, q) => (nivel - p) / (q - p || 1e-9);
        const lado = { T: [`${x},${y},h`, x + t(a, b), y], R: [`${x + 1},${y},v`, x + 1, y + t(b, c)], B: [`${x},${y + 1},h`, x + t(d, c), y + 1], L: [`${x},${y},v`, x, y + t(a, d)] };
        for (const [p, q] of CASOS[caso]) {
          const k = segs.length; segs.push([lado[p], lado[q]]);
          for (const e of [lado[p][0], lado[q][0]]) { const l = porLado.get(e); if (l) l.push(k); else porLado.set(e, [k]); }
        }
      }
      a = b; d = c;
    }
  }
  // encadenar: desde cada segmento sin usar, hacia los dos lados
  const usado = new Uint8Array(segs.length), lineas = [];
  const siguiente = (clave) => { for (const k of porLado.get(clave) || []) if (!usado[k]) return k; return -1; };
  for (let k0 = 0; k0 < segs.length; k0++) {
    if (usado[k0]) continue;
    usado[k0] = 1;
    const linea = [[segs[k0][0][1], segs[k0][0][2]], [segs[k0][1][1], segs[k0][1][2]]];
    for (const [punta, alPrincipio] of [[segs[k0][1][0], false], [segs[k0][0][0], true]]) {
      let clave = punta;
      for (;;) {
        const k = siguiente(clave); if (k < 0) break;
        usado[k] = 1;
        const [p, q] = segs[k], otro = p[0] === clave ? q : p;
        if (alPrincipio) linea.unshift([otro[1], otro[2]]); else linea.push([otro[1], otro[2]]);
        clave = otro[0];
      }
    }
    if (linea.length > 2) lineas.push(linea);
  }
  return lineas;
}
// suaviza una polilínea (esquinas cortadas): los escalones de las fronteras, que salen de la rejilla de píxeles
export function chaikin(l) {
  if (l.length < 3) return l;
  const r = [l[0]];
  for (let k = 0; k < l.length - 1; k++) {
    const [ax, ay] = l[k], [bx, by] = l[k + 1];
    r.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
  }
  r.push(l[l.length - 1]);
  return r;
}

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
  const cajas = [];   // el recuadro de cada comarca en px (para no recorrer la imagen entera al sacar sus fronteras)
  const tierra = new Uint8Array(NP), alt = new Float32Array(NP), com = new Int8Array(NP).fill(-1), bio = new Array(NP), forma = new Float32Array(NP);

  // 1) lo caro, por filas: tierra, altura, bioma y comarca de cada píxel
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px, xm = kmX(px) * 1000, ym = kmY(py) * 1000;
      const g = paisaje.grande(xm, ym);
      forma[i] = g.f;
      if (g.f < 0) continue;
      tierra[i] = 1;
      // la altura del mapa con algo de relieve de detalle (como el visor del mapa), para que el sombreado no salga liso
      const a = alt[i] = Math.max(1, g.hm + (fbm(xm / 2200, ym / 2200, 79, 4) - 0.5) * (40 + g.hm * 0.12));
      bio[i] = paisaje.sitio(xm, ym, a).bioma;
      const c = com[i] = comarcas.zonaEn(xm, ym).comarca;
      if (c >= 0) { const k = cajas[c] || (cajas[c] = [px, py, px, py]); if (px < k[0]) k[0] = px; if (px > k[2]) k[2] = px; if (py > k[3]) k[3] = py; }
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
        if (d <= 3) col = mezclar(col, [70, 92, 98], 0.25 * (1 - d / 3));   // el agua de la orilla, algo más oscura (la costa va como línea)
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
        }
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

  // 5) la costa y las fronteras como líneas (contornos, nítidos a cualquier zoom): la costa, donde la forma del juego
  // pasa por 0; las fronteras, donde cambia la comarca (cada una una sola vez, de la comarca de número menor)
  const costa = (yield* contornos(W, H, (x, y) => forma[y * W + x], 0, null)).map(l => l.map(([x, y]) => [kmX(x), kmY(y)]));
  yield { avance: 0.965 };
  const fronteras = [];
  for (let c = 0; c < comarcas.letras.length; c++) {
    const v = (x, y) => { const i = y * W + x; return tierra[i] && com[i] === c ? 1 : 0; };
    const vale = (x, y) => {
      for (const i of [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1]) if (!tierra[i] || com[i] < c) return false;
      return true;
    };
    if (!cajas[c]) continue;
    for (const l of yield* contornos(W, H, v, 0.5, vale, cajas[c])) fronteras.push(chaikin(chaikin(l)).map(([x, y]) => [kmX(x), kmY(y)]));
    yield { avance: 0.965 + c * 0.002 };
  }

  // 6) los ríos del juego que pasan por el mapa (en km, con su ancho en m), cortados en la costa
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

  // 7) dónde va el nombre de cada comarca: el sitio más lejos de su frontera y de la costa (no su centro de masas, que en
  // las comarcas alargadas cae fuera); el de Strandvang, además, lejos de la ciudad, para no taparla
  const mejor = comarcas.letras.map(() => ({ nota: -1, x: 0, y: 0 }));
  for (let i = 0; i < NP; i++) {
    if (i % (W * 64) === W * 64 - 1) yield { avance: 0.99 };
    const c = com[i]; if (c < 0 || !tierra[i]) continue;
    const x = kmX(i % W), y = kmY((i / W) | 0);
    let nota = Math.min(dBorde[i], dCosta[i]) / pxKm;
    if (c === COMARCA_REY) nota = Math.min(nota, Math.hypot(x - ciu[0], y - ciu[1]) / 2);
    if (nota > mejor[c].nota) mejor[c] = { nota, x, y };
  }
  yield { avance: 1 };
  return { ancho: W, alto: H, pxKm, cuadro, rgba, comarca: com, tierra, rios, montes, arboles, costa, fronteras,
    etiquetas: mejor.map((m, k) => (m.nota < 0 ? null : { k, x: m.x, y: m.y })).filter(Boolean) };
}
