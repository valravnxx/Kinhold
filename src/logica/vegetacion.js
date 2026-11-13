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
export const CELDA = { arbol: 4.5, hierba: 0.85, piedra: 2.5, canto: 1.3 };
const CAPA = { arbol: 1, hierba: 2, piedra: 3, canto: 4, soto: 5, ribera: 6, costa: 7, pared: 8 };
export const DENSIDAD_BOSQUE = 0.55;   // de cerca, la densidad de un bosque de verdad (la del mapa)
// Jóvenes y adultos, bien distintos (revisión del 1 nov; GDD apartado 8 y sistemas apartado 3): cada árbol sale con su
// edad. El joven mide de 3 a 5 m (su propio modelo, fino y de copa rala: src/mundo/especies.js, a 4 m a escala 1) y
// sale sobre todo en los bordes del bosque y en los claros; el adulto es CRECE_ADULTO veces el de antes (más alto y más
// grueso: se escala entero). Decisión provisional (6 nov, anotada en el registro y el diario): la parte de jóvenes es
// 0,1 + 0,45 × linde + 0,35 × (1 − densidad del bosque), hasta 0,85; dentro del bosque cerrado, uno de cada seis.
export const CRECE_ADULTO = 1.3;
export const ALTO_JOVEN = [3, 5];   // m
export const parteJovenes = (d, linde) => Math.min(0.85, 0.1 + 0.45 * linde + 0.35 * (1 - d));
export const TAM_ADULTO = 0.95;     // (de antes: ya no decide la edad, que lleva cada árbol; se queda para lo guardado)
export const CLARO_ARBOLES = 8;     // m sin árboles alrededor del sitio de salida (el personaje empieza en (0, 4) de la escena)
const PRADO = { pradera: 1, mixto: 0.8, caducifolio: 0.7, encinar: 0.55, taiga: 0.5, brezal: 0.6, matorral: 0.45, turbera: 0.8, alpino: 0.6 };
// Las calvas de tierra del prado (de 0 a 1), las mismas que pinta el suelo (src/mundo/color_suelo.js): con un ruido grande
// que tuerce su silueta, otro fino en el borde y otro muy grande que cambia su tamaño. Aquí, para no poner flores ni
// sotobosque encima (12 nov: salían flores sobre la tierra desnuda). Sin la pendiente ni la playa, que pone el suelo.
export function calvaTierra(x, z) {
  const ux = x + (fbm(x / 25, z / 25, 51, 2) - 0.5) * 9, uz = z + (fbm(x / 25, z / 25, 53, 2) - 0.5) * 9;
  return suave(0.66, 0.76, fbm(ux / 16, uz / 16, 41, 3) + (fbm(x / 4.5, z / 4.5, 47, 2) - 0.5) * 0.14 + (fbm(x / 90, z / 90, 55, 2) - 0.5) * 0.12);
}
// La marisma (13 nov, riberas y costas): la tierra llana y baja de las desembocaduras, a menos de 700 m del mar por el
// río, que se encharca con las mareas: barro y hierba salada en vez de arena y prado. Devuelve de 0 a 1. y: altura sobre
// el mar (m); s: pendiente; rio: paisaje.rioCerca (con su costa) o null. La pinta el suelo (src/mundo/color_suelo.js) y
// la puebla de juncos el sotobosque (aquí abajo).
export function marismaEn(y, s, rio, x, z) {
  if (!rio || rio.costa == null || !(rio.costa < 700) || y > 1.8 || s > 0.1) return 0;
  const b = rio.dm - rio.ancho / 2;
  if (b < 0) return 0;
  return (1 - suave(450, 700, rio.costa)) * (1 - suave(1.1, 1.8, y)) * (1 - suave(0.05, 0.1, s)) * (1 - suave(60, 140, b)) * (0.75 + 0.25 * fbm(x / 30, z / 30, 85, 2));
}
const PASO_PEND = 3;                   // la pendiente, con vecinos a 3 m (la forma del terreno, no cada piedrecita)

// paisaje: crearPaisaje(mapa). alt(x, z): la altura exacta del suelo (alturaMundo). semilla: la del mapa.
// cuadro: { x0, z0, x1, z1 } (m del mundo) para árboles y piedras; hierba: { x, z, r } el círculo con hierba, flores y
// matas (es lo que más cuesta: solo alrededor de donde se juega), o un cuadro { x0, z0, x1, z1 } (sin el borde de la
// derecha ni el de abajo: así los trozos del juego, uno al lado de otro, no repiten nada). Lo de hierba tiene que caer
// dentro de `cuadro` (la pendiente sale de su rejilla).
// Devuelve { arboles: [{ x, z, y, especie, edad: 'joven' | 'adulto', tam, giro, tono }], hierba: [{ x, z, y, tam, giro, tono }],
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
  // qué hay en (x, z): nada en el agua; si no, su sitio (bioma, roca…), la pendiente y la altura. En la orilla de un río,
  // lo que queda en seco (seco m o más por encima del agua) sí: antes no se ponía nada a menos de 4 m del cauce y el
  // bosque quedaba siempre apartado del río por una franja vacía (valravnx, 13 nov: «en el bosque me gustaría verlo más
  // real… que el bosque casi toque el río»). Los árboles piden algo más de altura que la hierba.
  const sitioEn = (x, z, seco = 0.3) => {
    const y = alt(x, z);
    if (y < 0.3) return null;
    if (!globalThis.__orillaVieja) { const n = paisaje.agua(x, z, tramos); if (n !== null && y < n + seco) return null; }
    else if (paisaje.agua(x, z, tramos) !== null) return null;
    const st = paisaje.sitio(x, z, y);
    return st && st.bioma ? { st, s: pendiente(x, z), y } : null;
  };
  // las celdas del mundo de lado `paso` en [a0, a1] × [b0, b1], cada una con su azar; con 2 m de margen, porque cada
  // cosa se aparta hasta 2 m del centro de su celda (lo de fuera del cuadro lo quita cada uno después)
  const recorrer = (paso, capa, a0, b0, a1, b1, fn) => {
    const i0 = Math.ceil((a0 - 2) / paso), i1 = Math.floor((a1 + 2) / paso), j0 = Math.ceil((b0 - 2) / paso), j1 = Math.floor((b1 + 2) / paso);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i * paso, j * paso, azarCelda(i, j, capa, semilla));
  };
  const R = { arboles: [], hierba: [], flores: [], matas: [], piedras: [], sotobosque: [], paredes: [] };

  // árboles: rejilla desordenada de 4,5 m; los adultos de 8 a 14 m (los de antes, 6–11 m, un 30 % más), ±15 % cada uno;
  // los jóvenes, de 3 a 5 m. arbolDeCelda: lo que sale en una celda (también lo mira el sotobosque, de las celdas de al
  // lado); dentro(x, z): si cae en lo que se pide. Devuelve null (nada), o { arbol, d, linde, s, x, z } (arbol null: el
  // bosque de ahí no llega a tener árbol en esa celda: el sitio de un tocón viejo o de un tronco caído)
  const arbolDeCelda = (cx, cz, r, dentro) => {
    const x = cx + (r() - 0.5) * 4, z = cz + (r() - 0.5) * 4, u = r(), q = r(), v = r(), giro = r() * 6.3, tono = 0.82 + r() * 0.3;
    if (!dentro(x, z)) return null;
    // (por debajo de 1,5 m, solo lejos del mar: antes, nada; y las vegas bajas de los ríos, a menos de 1 m tierra adentro,
    // quedaban sin bosque, con una franja de prado entre el río y los árboles)
    const s = sitioEn(x, z, 0.35); if (!s || (s.y < 1.5 && (!(s.st.costa > 120) || globalThis.__orillaVieja))) return null;
    if (s.y < 1.8 && tramos.length && marismaEn(s.y, s.s, paisaje.rioCerca(x, z, tramos), x, z) > 0.3) return null;   // (en la marisma, no)
    const w = r();   // (el último: así lo de antes de cada árbol sale igual)
    const { d, especie, tam, linde } = bosqueEn(s.st, s.s, x, z, { semilla, u });
    if (!especie || q > d * DENSIDAD_BOSQUE) return { arbol: null, d, linde, s, x, z };
    const pj = parteJovenes(d, linde);
    // el joven: tam es su alto en m / 4 (su modelo mide 4 m), de 3 a 5 m repartidos con el mismo azar w
    const arbol = w < pj ? { x, z, y: s.y, especie, edad: 'joven', tam: (ALTO_JOVEN[0] + (ALTO_JOVEN[1] - ALTO_JOVEN[0]) * (w / pj)) / 4, giro, tono }
      : { x, z, y: s.y, especie, edad: 'adulto', tam: CRECE_ADULTO * tam * (0.85 + v * 0.3), giro, tono };
    return { arbol, d, linde, s, x, z };
  };
  const enCuadro = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  recorrer(CELDA.arbol, CAPA.arbol, x0, z0, x1, z1, (cx, cz, r) => { const a = arbolDeCelda(cx, cz, r, enCuadro); if (a && a.arbol) R.arboles.push(a.arbol); });

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
      else if (t < pHierba + pFlor) { if (calvaTierra(x, z) < 0.3) R.flores.push({ x, z, y: s.y, tam: 0.8 + a * 0.5, giro: b * 6.3, color: Math.floor(c * 3) }); }   // (el reparto de las matas no cambia)
      else if (t < pHierba + pFlor + pMata) R.matas.push({ x, z, y: s.y - 0.05, tam: 0.5 + a * 0.6, giro: b * 6.3, tono: 0.85 + c * 0.3 });
      else {
        // (el sotobosque) manchas de flores, a corros y todas del mismo color en cada mancha; y en las lindes del
        // bosque, hierba alta y ortigas (con un azar más de la celda, el último: lo de antes no cambia)
        const f = r(), mancha = suave(0.6, 0.72, fbm(x / 12, z / 12, 61, 2)), lejosTierra = calvaTierra(x, z) < 0.25;
        if (lejosTierra && f < 0.55 * prado * (1 - d) * mancha * mancha) R.sotobosque.push({ x, z, y: s.y, tipo: 'flor', tam: 0.8 + a * 0.5, giro: b * 6.3, color: Math.min(2, Math.floor(fbm(x / 40, z / 40, 63, 1) * 3)) });
        else if (lejosTierra && f > 1 - 0.07 * linde * (d > 0.02)) R.sotobosque.push({ x, z, y: s.y, tipo: c < 0.7 ? 'hierba_larga' : 'ortigas', tam: 0.65 + a * 0.5, giro: b * 6.3, tono: 0.85 + c * 0.3 });
      }
    });

    // La ribera y la costa (13 nov, riberas y costas). En el río: juncos en el agua somera del borde (donde no corre
    // fuerte), y en la orilla, hierba alta, ortigas y algún helecho; los juncos que se recogen siguen en la orilla seca
    // (src/logica/recogida_mundo.js), estos son solo adorno y van dentro del agua. En la marisma, matas de juncos y hierba
    // salada. En la playa, hierba de duna rala en la parte alta de la arena.
    const gruesos = new Map(), grueso = (x, z) => {
      const i = Math.floor(x / 6), j = Math.floor(z / 6), k = i + ',' + j;
      let g = gruesos.get(k);
      if (!g) { const c = paisaje.rioCerca(i * 6 + 3, j * 6 + 3, tramos); g = { b: c.dm - c.ancho / 2, costa: c.costa }; gruesos.set(k, g); }
      return g;
    };
    if (tramos.length && !globalThis.__sinRibera) recorrer(0.9, CAPA.ribera, a0, b0, a1, b1, (cx, cz, r) => {
      const x = cx + (r() - 0.5) * 0.8, z = cz + (r() - 0.5) * 0.8, q = r(), u = r(), giro = r() * 6.3, tono = 0.85 + r() * 0.3;
      if (!dentro(x, z)) return;
      // (primero, en una rejilla de 6 m: lo lejos del río se salta sin medir cada celda; si no, costaba el triple)
      const g = grueso(x, z); if (g.b > 9 && !(g.costa < 700)) return;
      const c = paisaje.rioCerca(x, z, tramos), b = c.dm - c.ancho / 2;
      if (b < -1.3 || b > 140) return;
      const mancha = suave(0.42, 0.6, fbm(x / 6, z / 6, 81, 2));
      // (el paisaje no deja nada a menos de 4 m del cauce, sitioEn: aquí se mira si el suelo queda bajo el agua o no)
      const y = alt(x, z), nivel = paisaje.agua(x, z, tramos), hondo = nivel === null ? -1 : nivel - y;
      if (y < 0.3) return;
      if (hondo > 0.05) {
        // en el agua somera del borde; donde corre fuerte, solo en el remanso de la misma orilla y menos
        if (hondo > 0.7 || q > 0.45 * mancha || (c.costa ?? Infinity) < 150) return;
        if (paisaje.corriente(x, z, tramos).vel > 1.1 && (hondo > 0.35 || q > 0.15 * mancha)) return;
        R.sotobosque.push({ x, z, y, tipo: 'junco_agua', tam: 0.7 + u * 0.6, giro, tono });
        return;
      }
      const st = paisaje.sitio(x, z, y); if (!st || !st.bioma || st.bioma === 'nieve') return;
      const m = marismaEn(y, pendiente(x, z), c, x, z);
      if (m > 0.3) {
        // (los juncos de la marisma se recogen: son puntos de recogida, src/logica/recogida_mundo.js, que se marcan al
        // acercarse; estos, de adorno, para que se vea como un juncal, y la hierba salada)
        if (q < 0.3 * m * mancha) R.sotobosque.push({ x, z, y, tipo: u < 0.5 ? 'junco_agua' : 'hierba_larga', tam: 0.6 + u * 0.6, giro, tono, sal: true });
        return;
      }
      if (b > 4 || calvaTierra(x, z) > 0.3) return;
      if (q < 0.32 * (1 - b / 4) * (0.35 + 0.65 * mancha)) R.sotobosque.push({ x, z, y, tipo: u < 0.6 ? 'hierba_larga' : u < 0.85 ? 'ortigas' : 'helechos', tam: 0.7 + u * 0.5, giro, tono });
    });
    recorrer(1.6, CAPA.costa, a0, b0, a1, b1, (cx, cz, r) => {
      const x = cx + (r() - 0.5) * 1.4, z = cz + (r() - 0.5) * 1.4, q = r(), u = r(), giro = r() * 6.3, tono = 0.85 + r() * 0.3;
      if (q > 0.12 || !dentro(x, z)) return;
      const s = sitioEn(x, z);
      if (!s || !(s.st.costa < 90) || s.s > 0.25 || s.y < 1.4 || s.y > 3.2 || !(s.st.roca === 'arenisca' || s.st.roca === 'caliza')) return;
      if (q < 0.12 * suave(0.4, 0.6, fbm(x / 9, z / 9, 87, 2))) R.sotobosque.push({ x, z, y: s.y, tipo: 'hierba_duna', tam: 0.55 + u * 0.5, giro, tono });
    });

    // El sotobosque al pie de los árboles (13 nov, el hito «El aspecto»): un corro de 2 a 6 helechos, ortigas, hierbas
    // altas y cantos con musgo, más a un lado que a otro; y donde el bosque no llega a tener árbol, a veces un tocón
    // viejo o un tronco caído. Según el bioma: helechos en los bosques húmedos, pocos en el encinar y el matorral.
    // Solo adorno (no se recoge ni lo valida el servidor); los tocones y los troncos estorban al andar
    // (src/mundo/vegetacion_mundo.js). Se miran las celdas de los árboles de alrededor, también las de fuera: así un
    // corro que cruza el borde de un trozo sale entero.
    const HELECHO = { caducifolio: 1, mixto: 0.9, turbera: 0.8, taiga: 0.6, pradera: 0.45, brezal: 0.35, encinar: 0.2, alpino: 0.2, matorral: 0.12 };
    const pon = (x, z, tipo, tam, giro, tono) => {
      if (!dentro(x, z)) return;
      const s = sitioEn(x, z); if (!s || s.st.bioma === 'nieve' || s.y < 1 || s.s > 0.7 || calvaTierra(x, z) > 0.3) return;
      R.sotobosque.push({ x, z, y: s.y, tipo, tam, giro, tono });
    };
    recorrer(CELDA.arbol, CAPA.arbol, a0 - 4, b0 - 4, a1 + 4, b1 + 4, (cx, cz, r) => {
      const a = arbolDeCelda(cx, cz, r, () => true); if (!a) return;
      const q = azarCelda(Math.round(cx / CELDA.arbol), Math.round(cz / CELDA.arbol), CAPA.soto, semilla), t = q();
      if (!a.arbol) {
        if (a.d < 0.35) return;
        const giro = q() * 6.3, tam = 0.8 + q() * 0.5, tono = 0.85 + q() * 0.25;
        if (t < 0.06 * a.d) pon(a.x, a.z, 'tocon', tam, giro, tono);
        else if (t < 0.11 * a.d) pon(a.x, a.z, 'tronco', tam, giro, tono);
        return;
      }
      const adulto = a.arbol.edad === 'adulto';
      if (t > (adulto ? 0.6 : 0.25) * Math.min(1, 0.35 + 0.6 * a.d + 0.5 * a.linde)) return;
      const hel = (HELECHO[a.s.st.bioma] ?? 0.4) * (0.3 + 0.7 * a.d), ort = 0.08 + 0.35 * a.linde, can = 0.3, alta = 0.3 * (1 - a.d);
      const n = 2 + Math.floor(q() * 5), lado = q() * 6.3, r0 = (adulto ? 0.45 : 0.2) * a.arbol.tam;
      for (let k = 0; k < n; k++) {
        const ang = lado + (q() - 0.5) * 2.6, dd = r0 + 0.35 + q() * 2.2, e = q() * (hel + ort + can + alta), u = q(), giro = q() * 6.3, tono = 0.85 + q() * 0.3;
        const x = a.x + Math.cos(ang) * dd, z = a.z + Math.sin(ang) * dd;
        if (e < hel) pon(x, z, 'helechos', 0.7 + u * 0.6, giro, tono);
        else if (e < hel + ort) pon(x, z, 'ortigas', 0.6 + u * 0.5, giro, tono);
        else if (e < hel + ort + can) pon(x, z, 'canto', 0.18 + u * u * 0.3, giro, tono);
        else pon(x, z, 'hierba_larga', 0.65 + u * 0.5, giro, tono);
      }
    });
  }

  // la roca de los cortados (13 nov, el hito «El aspecto»; valravnx, 5 nov: «habíamos hecho unas rocas muy bonitas para
  // los acantilados… las habéis quitado»): piezas de roca 3D encajadas en las paredes (src/mundo/rocas.js), las mismas que
  // en el visor del mapa (src/mapa/juego.js): de 2 a 8 m, mirando hacia fuera de la pared y medio metidas en ella; en una
  // pared alta, más piezas apiladas hasta arriba. Solo adorno: la pared ya no se puede andar por su pendiente.
  // Cada una: { x, z, y, alto, giro, variante (0–4), inclina, tono, roca }
  recorrer(2.6, CAPA.pared, x0, z0, x1, z1, (cx, cz, r) => {
    const x = cx + (r() - 0.5) * 2, z = cz + (r() - 0.5) * 2, q = r(), u = r(), v = r(), w = r(), k = r(), t = r();
    if (q > 0.4 || x < x0 || x > x1 || z < z0 || z > z1) return;
    const gx = (alt(x + 1, z) - alt(x - 1, z)) / 2, gz = (alt(x, z + 1) - alt(x, z - 1)) / 2, s = Math.hypot(gx, gz);
    if (s < 1.15) return;
    const y = alt(x, z); if (y < 0.3 || (tramos.length && paisaje.agua(x, z, tramos) !== null)) return;
    const nx = -gx / s, nz = -gz / s, alto = 2 + u * 2.5 + Math.min(3, s), roca = paisaje.sitio(x, z, y)?.roca;
    // (valravnx, 13 nov: solo en las paredes anchas y altas; en los barrancos y las laderas estrechas las piezas se veían
    // de perfil, con su corte plano) a 6 m a cada lado, la pared sigue empinada y mirando hacia el mismo sitio, y tiene
    // más de 5 m de la base al borde
    for (const k of [-6, 6]) {
      const px = x - nz * k, pz = z + nx * k, hx = (alt(px + 1, pz) - alt(px - 1, pz)) / 2, hz = (alt(px, pz + 1) - alt(px, pz - 1)) / 2, hs = Math.hypot(hx, hz);
      if (hs < 0.8 || (-hx * nx - hz * nz) / hs < 0.65) return;
    }
    if (alt(x - nx * 5, z - nz * 5) - alt(x + nx * 5, z + nz * 5) < 5) return;
    // (en el juego se ven de cerca: más metidas en la pared que en el visor, para que asomen como un frente y no como un
    // peñasco suelto)
    R.paredes.push({ x: x - nx * alto * 0.3, z: z - nz * alto * 0.3, y: y - alto * 0.25, alto, giro: Math.atan2(nx, nz) + (v - 0.5) * 0.5, variante: Math.floor(w * 5), inclina: (k - 0.5) * 0.25, tono: 0.85 + t * 0.3, roca, pend: s, cara: Math.atan2(nx, nz) });
    const arriba = alt(x - nx * 4, z - nz * 4), abajo = alt(x + nx * 4, z + nz * 4);
    for (let h = abajo + 3; h < arriba - 2; h += 4 + r()) {
      if (Math.abs(h - y) < 3) continue;
      const a2 = 2.2 + r() * 2.5;
      R.paredes.push({ x: x - nx * a2 * 0.3 + (r() - 0.5) * 1.5, z: z - nz * a2 * 0.3 + (r() - 0.5) * 1.5, y: h - a2 * 0.3, alto: a2, giro: Math.atan2(nx, nz) + (r() - 0.5) * 0.6, variante: Math.floor(r() * 5), inclina: (r() - 0.5) * 0.25, tono: 0.8 + r() * 0.35, roca, pend: s, cara: Math.atan2(nx, nz) });
    }
  });

  // piedras: pocas y sueltas por el campo; al pie de los cortados, el pedregal (más grandes y juntas)
  recorrer(CELDA.piedra, CAPA.piedra, x0, z0, x1, z1, (cx, cz, r) => {
    const x = cx + (r() - 0.5) * 2.2, z = cz + (r() - 0.5) * 2.2, q = r(), a = r(), giro = r() * 6.3;
    if (x < x0 || x > x1 || z < z0 || z > z1) return;
    if (q > 0.45) return;                                          // ni al pie de un cortado pasaría: no se mira más
    const s = sitioEn(x, z); if (!s || s.y < 1 || s.s > 0.8) return;   // a 1 m sobre el mar, como lo demás (antes 0,5: salían en la orilla)
    let pared = 0; for (let k = 0; k < 8; k++) pared = Math.max(pared, pendiente(x + Math.cos(k * 0.785) * 5, z + Math.sin(k * 0.785) * 5));
    const pie = s.s < 0.7 && pared > 1.1;
    if (q > (pie ? 0.45 : 0.006)) return;
    R.piedras.push({ x, z, y: s.y, tam: pie ? 0.5 + a * 1.5 : 0.3 + a * 0.6, giro, roca: s.st.roca });
  });

  // los cantos del río (valravnx, 5 nov: «lecho rocoso en el río que lo deje más visual»): piedras de río a manchas
  // por el cauce (dentro del agua) y por la orilla (hasta 1,6 m fuera), de la roca del sitio; más gordas y más juntas
  // donde el río baja con fuerza (la montaña). La grava fina la pinta el color del suelo (src/mundo/color_suelo.js).
  // canto: true (las pequeñas no estorban al andar: src/mundo/vegetacion_mundo.js)
  if (tramos.length && !globalThis.__sinCantos) recorrer(CELDA.canto, CAPA.canto, x0, z0, x1, z1, (cx, cz, r) => {
    const x = cx + (r() - 0.5) * CELDA.canto, z = cz + (r() - 0.5) * CELDA.canto, q = r(), a = r(), giro = r() * 6.3;
    if (x < x0 || x > x1 || z < z0 || z > z1) return;
    const c = paisaje.rioCerca(x, z, tramos), b = c.dm - c.ancho / 2;
    if (b > 1.6) return;
    const y = alt(x, z); if (y < 0.3) return;                       // (en la desembocadura ya es el mar)
    const fuerte = suave(0.7, 2.5, paisaje.corriente(x, z, tramos).vel);   // (la fuerza del río: su corriente, de 0,3 a 3 m/s)
    // a manchas (unos bancos de cantos y tramos limpios), más en la orilla que en lo hondo
    const mancha = suave(0.42, 0.62, fbm(x / 7, z / 7, 71, 2));
    const p = (b < -0.6 ? 0.22 : 0.5) * (0.25 + 0.75 * mancha) * (0.6 + 0.8 * fuerte);
    if (q > p) return;
    const st = paisaje.sitio(x, z, y);
    R.piedras.push({ x, z, y, tam: (0.12 + a * a * 0.45) * (1 + 1.4 * fuerte), giro, roca: (st && st.roca) || 'caliza', canto: true });
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
