// Comprueba el terreno por trozos (src/logica/trozos.js), en node y sin three.js:
//   - el gestor tiene cargados justo los trozos que tocan alrededor del jugador, sin huecos ni repetidos, con el detalle
//     de su anillo, y nunca dos vecinos a más de un nivel; lo que dice cargar, cambiar y soltar cuadra con lo que tiene
//   - al ir y venir por una frontera (menos que el margen) no se carga ni se suelta nada otra vez
//   - las mallas de trozos vecinos dan la misma altura en su borde común (con el paisaje de verdad, junto a un río), y
//     entre trozos de distinto detalle el faldón cuelga lo bastante para tapar la rendija
//   - las mallas están bien hechas: triángulos hacia arriba, faldones hacia fuera, índices dentro
// Uso: node pruebas/prueba_trozos.mjs   MUTAR=1 → mallas sin faldón; MUTAR=2 → gestor sin margen: tiene que fallar.
import * as T from '../src/logica/trozos.js';
import { generarMapa } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };
const { LADO, ANILLOS, MARGEN } = T;
const ULTIMO = ANILLOS[ANILLOS.length - 1].hasta;
const margen = MUTAR === '2' ? 0 : MARGEN;

// ── 1. El gestor, andando por el mundo ─────────────────────────────────────────────────────────────────────────────
{
  const limites = { x0: 0, z0: 0, x1: 20000, z1: 20000 };
  const g = T.crearGestor({ margen, limites });
  const espejo = new Map();
  let x = 1000, z = 1000, rumbo = 0.3, pasos = 0;
  const malos = { hueco: 0, sobra: 0, nivel: 0, vecinos: 0, espejo: 0, fuera: 0 };
  let maxTrozos = 0;
  const porNivel = ANILLOS.map(() => 0);
  for (let s = 0; s < 1500; s++) {
    // un paseo con curvas, a ratos hacia atrás, y a veces pegado al borde del mundo
    rumbo += Math.sin(s * 0.05) * 0.12 + (s % 300 === 150 ? Math.PI : 0);
    x = Math.min(19990, Math.max(5, x + Math.cos(rumbo) * 6.3)); z = Math.min(19990, Math.max(5, z + Math.sin(rumbo) * 6.3));
    if (s === 700) { x = 30; z = 25; }   // un salto, como al aparecer en otro sitio
    const { cargar, cambiar, soltar } = g.actualizar(x, z);
    pasos++;
    for (const t of soltar) { if (!espejo.delete(T.claveTrozo(t.i, t.j))) malos.espejo++; }
    for (const t of cargar) { const k = T.claveTrozo(t.i, t.j); if (espejo.has(k)) malos.espejo++; espejo.set(k, t.nivel); }
    for (const t of cambiar) { const k = T.claveTrozo(t.i, t.j); if (espejo.get(k) !== t.antes) malos.espejo++; espejo.set(k, t.nivel); }
    if (espejo.size !== g.trozos.size) malos.espejo++;
    maxTrozos = Math.max(maxTrozos, g.trozos.size);
    const { i: pi, j: pj } = T.trozoDe(x, z);
    const r = Math.ceil((ULTIMO + MARGEN) / LADO) + 2;
    for (let j = pj - r; j <= pj + r; j++) for (let i = pi - r; i <= pi + r; i++) {
      const d = T.distanciaTrozo(x, z, i, j), n = g.nivelDe(i, j);
      const enMundo = i >= 0 && j >= 0 && i * LADO < limites.x1 && j * LADO < limites.z1;
      if (!enMundo) { if (n !== -1) malos.fuera++; continue; }
      if (d < ULTIMO && n === -1) malos.hueco++;
      if (d >= ULTIMO + margen && n !== -1) malos.sobra++;
      if (n === -1) continue;
      if (espejo.get(T.claveTrozo(i, j)) !== n) malos.espejo++;
      porNivel[n]++;
      // el nivel que toca o, como mucho a `margen` m de distancia, el anterior más fino
      const lo = T.nivelPara(Math.max(0, d - margen)), hi = T.nivelPara(d);
      if (n < lo || (hi !== -1 && n > hi)) malos.nivel++;
      for (const [a, b] of [[1, 0], [0, 1]]) { const m = g.nivelDe(i + a, j + b); if (m !== -1 && Math.abs(m - n) > 1) malos.vecinos++; }
    }
  }
  comprobar(`sin huecos: todo trozo a menos de ${ULTIMO} m está cargado (${pasos} pasos)`, malos.hueco === 0, `${malos.hueco} huecos`);
  comprobar('no sobra nada: más allá del último anillo y su margen no queda nada', malos.sobra === 0, `${malos.sobra}`);
  comprobar('fuera del mundo no se carga nada', malos.fuera === 0, `${malos.fuera}`);
  comprobar('cada trozo con el detalle de su anillo (o el de antes, dentro del margen)', malos.nivel === 0, `${malos.nivel} mal`);
  comprobar('dos trozos vecinos nunca se llevan más de un nivel', malos.vecinos === 0, `${malos.vecinos}`);
  comprobar('lo que dicen cargar, cambiar y soltar cuadra con lo cargado (sin repetidos)', malos.espejo === 0, `${malos.espejo}`);
  console.log(`         como mucho ${maxTrozos} trozos cargados a la vez; vistos por nivel (suma de pasos): ${porNivel.map((v, k) => `${ANILLOS[k].paso} m: ${v}`).join(', ')}`);
}

// ── 2. Ir y venir por una frontera ─────────────────────────────────────────────────────────────────────────────────
{
  const g = T.crearGestor({ margen });
  // justo en el borde entre dos trozos (x = 640): cambia la distancia a los trozos de todos los anillos
  g.actualizar(640 + 4, 5000);
  let ops = 0, vueltas = 0;
  for (let k = 0; k < 60; k++) {
    const x = 640 + (k % 2 ? 4 : -4) + Math.sin(k) * 0.5;
    const { cargar, cambiar, soltar } = g.actualizar(x, 5000 + Math.cos(k) * 0.5);
    if (k >= 2) ops += cargar.length + cambiar.length + soltar.length;
    vueltas++;
  }
  comprobar(`ir y venir 8 m sobre una frontera ${vueltas} veces no carga ni suelta nada otra vez`, ops === 0, `${ops} cambios`);
  // y alejarse de verdad sí cambia
  const { cargar, soltar } = g.actualizar(640 + 200, 5000);
  comprobar('alejarse de verdad sí carga y suelta', cargar.length > 0 && soltar.length > 0, `${cargar.length} cargados, ${soltar.length} soltados`);
}

// ── 3. Mallas con el paisaje de verdad, junto a un río ─────────────────────────────────────────────────────────────
{
  const mapa = generarMapa(4242, { N: 96 }), pai = crearPaisaje(mapa);
  const rio = pai.rios.slice().sort((a, b) => b.length - a.length)[0], p = rio[Math.floor(rio.length / 2)];
  const px = p.p[0] * 1000, pz = p.p[1] * 1000;
  const g = T.crearGestor();
  g.actualizar(px, pz);
  const mallas = new Map(), tiempos = ANILLOS.map(() => []);
  // los trozos de los tres primeros anillos (y alguno del cuarto en el borde, para probar todos los saltos de nivel)
  for (const t of g.trozos.values()) {
    if (T.distanciaTrozo(px, pz, t.i, t.j) > ANILLOS[2].hasta + LADO) continue;
    const t0 = performance.now();
    const m = T.mallaTrozo(t.i, t.j, ANILLOS[t.nivel].paso, T.alturaDeTrozo(pai, t.i, t.j), { faldon: MUTAR !== '1' });
    tiempos[t.nivel].push(performance.now() - t0);
    mallas.set(T.claveTrozo(t.i, t.j), m);
  }
  let iguales = 0, distintos = 0, malIgual = 0, malComun = 0, rendijas = 0, peorRendija = 0, peorFaldon = 0, pares = 0;
  const hBorde = (m, eje, u) => {   // altura en la línea del borde: eje 'e' (x = x0 + lado), 's' (z = z0 + lado), 'o', 'n'; u en m
    const f = u / m.paso, a = Math.floor(f), r = f - a, c = m.n - 1;
    const v = (k) => eje === 'e' ? m.H[k * m.n + c] : eje === 'o' ? m.H[k * m.n] : eje === 's' ? m.H[c * m.n + k] : m.H[k];
    return r ? v(a) + (v(a + 1) - v(a)) * r : v(a);
  };
  const ladoCara = { n: 0, e: 1, s: 2, o: 3 };
  for (const m of mallas.values()) for (const [di, dj, mio, suyo] of [[1, 0, 'e', 'o'], [0, 1, 's', 'n']]) {
    const v = mallas.get(T.claveTrozo(m.i + di, m.j + dj));
    if (!v) continue;
    pares++;
    if (m.paso === v.paso) {
      iguales++;
      for (let k = 0; k < m.n; k++) if (hBorde(m, mio, k * m.paso) !== hBorde(v, suyo, k * m.paso)) malIgual++;
    } else {
      distintos++;
      const [basto, fino, cb, cf] = m.paso > v.paso ? [m, v, mio, suyo] : [v, m, suyo, mio];
      for (let k = 0; k < basto.n; k++) if (hBorde(basto, cb, k * basto.paso) !== hBorde(fino, cf, k * basto.paso)) malComun++;
      const cuelga = basto.faldon[ladoCara[cb]];
      for (let u = 0; u <= LADO; u++) {
        const hueco = Math.abs(hBorde(basto, cb, u) - hBorde(fino, cf, u));
        peorRendija = Math.max(peorRendija, hueco);
        if (hueco > cuelga + 1e-4) rendijas++;
      }
      peorFaldon = Math.max(peorFaldon, cuelga);
    }
  }
  comprobar(`junto a un río (${(px / 1000).toFixed(1)}, ${(pz / 1000).toFixed(1)} km): ${mallas.size} mallas, ${pares} bordes compartidos`, mallas.size > 50 && iguales > 20 && distintos > 10, `${iguales} con el mismo detalle, ${distintos} con distinto`);
  comprobar('mismo detalle: la misma altura, exacta, en todo el borde común', malIgual === 0, `${malIgual} puntos distintos`);
  comprobar('distinto detalle: los puntos del basto, exactos en el fino', malComun === 0, `${malComun} puntos distintos`);
  comprobar('distinto detalle: el faldón del basto tapa la rendija en todo el borde (cada metro)', rendijas === 0,
    `${rendijas} metros sin tapar; rendija mayor ${peorRendija.toFixed(2)} m, faldón mayor ${peorFaldon.toFixed(2)} m`);
  // con los tramos de río de cada trozo: dos trozos vecinos ven el mismo río más cercano
  const rioCerca = [...mallas.values()].some(m => pai.riosEn(m.x0, m.z0, m.x0 + LADO, m.z0 + LADO, 50).length > 0);
  comprobar('el río pasa por alguno de los trozos probados', rioCerca);

  // la malla, bien hecha
  let malIndice = 0, abajo = 0, hacia = 0, malAltura = 0, triSuelo = 0;
  for (const m of mallas.values()) {
    const P = m.posiciones, I = m.indices, total = P.length / 3;
    for (let q = 0; q < I.length; q += 3) {
      const a = I[q], b = I[q + 1], c = I[q + 2];
      if (a >= total || b >= total || c >= total) { malIndice++; continue; }
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (a < m.superficie && b < m.superficie && c < m.superficie) { triSuelo++; if (ny <= 0) abajo++; }
      else {
        // faldón: hacia fuera del trozo (desde su centro)
        const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3 - LADO / 2, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3 - LADO / 2;
        if (nx * cx + nz * cz <= 0 && Math.hypot(nx, ny, nz) > 1e-9) hacia++;
      }
    }
    for (let b = 0; b < m.n; b += 3) for (let a = 0; a < m.n; a += 3)
      if (Math.abs(T.alturaEnMalla(m, m.x0 + a * m.paso, m.z0 + b * m.paso) - m.H[b * m.n + a]) > 1e-6) malAltura++;
  }
  comprobar('índices dentro de la malla', malIndice === 0, `${malIndice}`);
  comprobar(`los ${triSuelo} triángulos del suelo miran hacia arriba`, abajo === 0, `${abajo} hacia abajo`);
  comprobar('los triángulos del faldón miran hacia fuera del trozo', hacia === 0, `${hacia} hacia dentro`);
  comprobar('alturaEnMalla da la altura de la rejilla en sus puntos', malAltura === 0, `${malAltura}`);
  const media = (l) => l.length ? (l.reduce((s, v) => s + v, 0) / l.length).toFixed(1) : '-';
  console.log('         tiempo por trozo (este procesador, en ms): ' + ANILLOS.map((a, k) => `${a.paso} m: ${media(tiempos[k])} (${tiempos[k].length})`).join(', '));
  const m0 = [...mallas.values()].find(m => m.paso === 1);
  console.log(`         malla de 1 m: ${m0.superficie} vértices del suelo y ${m0.posiciones.length / 3 - m0.superficie} del faldón, ${m0.indices.length / 3} triángulos`);
}

// ── 4. Detalles ────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const llano = (x, z) => 0.05 * x + 0.02 * z;      // en un plano, la recta del borde es exacta: el faldón, el mínimo
  const m = T.mallaTrozo(3, -2, 8, llano);
  comprobar('en un plano el faldón cuelga solo lo mínimo', m.faldon.every(v => Math.abs(v - T.FALDON_EXTRA) < 1e-6), m.faldon.join(', '));
  comprobar('la malla va relativa a la esquina del trozo', m.x0 === 192 && m.z0 === -128 && m.posiciones[0] === 0 && m.posiciones[2] === 0);
  let lanza = false; try { T.mallaTrozo(0, 0, 3, llano); } catch { lanza = true; }
  comprobar('un paso que no cabe en el trozo se rechaza', lanza);
  comprobar('trozoDe con negativos', T.trozoDe(-0.5, 64).i === -1 && T.trozoDe(-0.5, 64).j === 1);
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
