// Comprueba los materiales del suelo (12 nov, hito «El aspecto»: src/mundo/color_suelo.js, pesos, y
// src/mundo/trozo_suelo.js, el atributo «mezcla» que usa src/mapa/suelo.js), en node y sin three.js:
//   - cada punto del suelo lleva cuánto tiene de hierba, tierra, roca y hojarasca, y suman 1
//   - la roca sale en las paredes, la tierra en el lecho de los ríos y en la playa, la hojarasca bajo el bosque y la
//     hierba en el prado; y hay de las cuatro en el mundo
//   - en el borde común de dos trozos, la mezcla es la misma a los dos lados (no se ve la junta)
//   - el paquete de texturas (docs/recursos/suelo/cc0-v1/) tiene sus cuatro capas, con su relieve, y su procedencia CC0
// Uso: node pruebas/prueba_suelo_materiales.mjs   MUTAR=1 → todo hierba: tiene que fallar.
import fs from 'fs';
import * as T from '../src/logica/trozos.js';
import { generarMapa } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { hacerSueloTrozo } from '../src/mundo/trozo_suelo.js';
import { colorJuego } from '../src/mundo/color_suelo.js';
import { CAPAS_SUELO } from '../src/mapa/suelo.js';

const MUTAR = process.env.MUTAR === '1';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };
const pesosDe = (r, k) => MUTAR ? [1, 0, 0, 0] : [...r.mezcla.subarray(k * 4, k * 4 + 4)];

console.log('Lo que hay en cada punto');
const mapa = generarMapa(4242, { N: 96 }), pai = crearPaisaje(mapa);
// unos cuantos trozos repartidos por la isla, y el de un río
const rio = pai.rios.slice().sort((a, b) => b.length - a.length)[0], pr = rio[Math.floor(rio.length / 3)];
const trozos = [T.trozoDe(pr.p[0] * 1000, pr.p[1] * 1000)];
for (let a = 0.15; a < 0.9; a += 0.11) for (let b = 0.15; b < 0.9; b += 0.13) trozos.push(T.trozoDe(a * mapa.N * 1000, b * mapa.N * 1000));
let mal = 0, n = 0; const suma = [0, 0, 0, 0], max = [0, 0, 0, 0];
let rocaEmpinado = 0, empinados = 0, rocaLlano = 0, llanos = 0;
for (const { i, j } of trozos) {
  const r = hacerSueloTrozo(pai, i, j, 4);
  if (!r.mezcla || r.mezcla.length !== (r.posiciones.length / 3) * 4) { mal++; continue; }
  for (let k = 0; k < r.superficie; k++) {
    const p = pesosDe(r, k), s = p[0] + p[1] + p[2] + p[3]; n++;
    if (p.some(v => !(v >= 0 && v <= 1)) || Math.abs(s - 1) > 1e-4) mal++;
    p.forEach((v, q) => { suma[q] += v; max[q] = Math.max(max[q], v); });
    const ny = r.normales[k * 3 + 1];
    if (ny < 0.6) { empinados++; rocaEmpinado += p[2]; } else if (ny > 0.97) { llanos++; rocaLlano += p[2]; }
  }
}
comprobar('cada punto lleva sus cuatro pesos (hierba, tierra, roca, hojarasca), entre 0 y 1, y suman 1', mal === 0 && n > 10000, `${n} puntos, ${mal} mal`);
comprobar('en el mundo hay de los cuatro materiales (en algún sitio, cada uno manda)', max.every(v => v > 0.6), CAPAS_SUELO.map((c, q) => `${c} hasta ${max[q].toFixed(2)}, media ${(suma[q] / n).toFixed(2)}`).join(' · '));
comprobar('la roca sale en lo empinado y casi nada en lo llano', empinados > 0 && rocaEmpinado / empinados > 0.5 && rocaLlano / Math.max(1, llanos) < 0.05,
  `en lo empinado ${(rocaEmpinado / Math.max(1, empinados)).toFixed(2)} (${empinados} puntos), en lo llano ${(rocaLlano / Math.max(1, llanos)).toFixed(3)}`);

// los sitios uno a uno, con colorJuego: el prado, el bosque, la playa y el lecho de un río
{
  const p = [0, 0, 0, 0], c = [0, 0, 0];
  const pr0 = { bioma: 'pradera', roca: 'granito', P: 0.6, T: 10, costa: 2000 };
  const de = (st, y, s, x, z, rio) => { colorJuego(st, y, s, s, 0, x, z, c, rio, p); return MUTAR ? [1, 0, 0, 0] : [...p]; };
  // en el prado, lejos de calvas: se busca un punto con poca tierra
  let prado = null; for (let x = 0; x < 400 && !prado; x += 7) { const q = de(pr0, 20, 0.05, x, 13, null); if (q[1] < 0.05) prado = q; }
  comprobar('en el prado, sobre todo hierba', prado && prado[0] >= 0.85, prado && prado.map(v => v.toFixed(2)).join(' '));
  const pared = de(pr0, 20, 1.4, 50, 50, null);
  comprobar('en una pared, roca', pared[2] > 0.95, pared.map(v => v.toFixed(2)).join(' '));
  const playa = de({ ...pr0, roca: 'arenisca', costa: 10 }, 1.2, 0.05, 50, 50, null);
  comprobar('en la playa, tierra (la arena)', playa[1] > 0.9, playa.map(v => v.toFixed(2)).join(' '));
  const lecho = de(pr0, 3, 0.05, 50, 50, { dm: 0.5, ancho: 6, costa: 5000 });
  comprobar('en el lecho de un río, tierra (la grava)', lecho[1] > 0.9, lecho.map(v => v.toFixed(2)).join(' '));
  // bajo el bosque: el primer punto del mapa con bosque espeso
  let bosque = null;
  for (let a = 0.1; a < 0.9 && !bosque; a += 0.01) for (let b = 0.1; b < 0.9 && !bosque; b += 0.03) {
    const x = a * mapa.N * 1000, z = b * mapa.N * 1000, y = pai.altura(x, z);
    if (y < 3) continue;
    const st = pai.sitio(x, z, y); if (!st || !st.bioma || st.bioma === 'nieve') continue;
    const q = de(st, y, 0.05, x, z, null); if (q[3] > 0.6) bosque = q;
  }
  comprobar('bajo el bosque, hojarasca', !!bosque, bosque && bosque.map(v => v.toFixed(2)).join(' '));
}

console.log('Entre trozos');
{
  const { i, j } = trozos[0];
  const A = hacerSueloTrozo(pai, i, j, 2), E = hacerSueloTrozo(pai, i + 1, j, 2);
  const c = A.n - 1; let distintos = 0;
  for (let k = 0; k < A.n; k++) for (let q = 0; q < 4; q++) if (Math.abs(A.mezcla[(k * A.n + c) * 4 + q] - E.mezcla[(k * A.n) * 4 + q]) > 1e-5) distintos++;
  comprobar('en el borde común de dos trozos, la misma mezcla a los dos lados', distintos === 0, `${distintos} distintos`);
}

console.log('Las texturas');
{
  const d = 'docs/recursos/suelo/cc0-v1/';
  const faltan = CAPAS_SUELO.flatMap(c => [c + '.webp', c + '_relieve.webp']).filter(f => !fs.existsSync(d + f) || fs.statSync(d + f).size < 10000);
  comprobar('las cuatro capas, con su color (y la altura en el alfa) y su relieve', faltan.length === 0, faltan.join(', '));
  const medias = JSON.parse(fs.readFileSync(d + 'medias.json', 'utf8'));
  comprobar('el color medio de cada una, para usarlas como detalle', CAPAS_SUELO.every(c => medias[c] && medias[c].length === 3 && medias[c].every(v => v > 0.01 && v < 1)), JSON.stringify(medias));
  const proc = fs.existsSync(d + 'PROCEDENCIA.md') ? fs.readFileSync(d + 'PROCEDENCIA.md', 'utf8') : '';
  comprobar('su procedencia, CC0', /CC0/.test(proc) && /ambientCG/.test(proc));
}

console.log(fallos ? `\n${fallos} fallos` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
