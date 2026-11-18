import { writeFileSync } from 'fs';
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../../src/logica/mapa.js';
import { crearPaisaje } from '../../src/logica/paisaje.js';
import { alturaMundo } from '../../src/logica/whitholm.js';
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), pai = crearPaisaje(mapa), alt = alturaMundo(pai);
const x0 = 217100, z0 = 52650, L = 600, P = 2, N = L / P;
const tramos = pai.riosEn(x0, z0, x0 + L, z0 + L, 800);
const out = { x0, z0, P, N, h: [], t: [] };   // t: 0 tierra, 1 río, 2 mar
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = x0 + (i + .5) * P, z = z0 + (j + .5) * P, y = alt(x, z);
  const mar = pai.grande(x, z).f < 0 || y < 0, w = pai.agua(x, z, tramos);
  out.h.push(+y.toFixed(2)); out.t.push(mar ? 2 : (w !== null && w > y ? 1 : 0));
}
writeFileSync(new URL('./terreno.json', import.meta.url), JSON.stringify(out));
