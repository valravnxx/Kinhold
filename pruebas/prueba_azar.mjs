// Comprueba que el módulo único de azar y ruido (src/logica/azar.js) da exactamente los mismos números que daban los
// generadores sueltos de antes (mapa, paisaje, combate, mina, decorado, rocas, texturas y modelos): si cambiara una
// cifra, se moverían los árboles, las rocas, el mapa entero o los golpes. Las huellas son de antes de juntarlos.
// También comprueba que los que siguen ofreciéndolo (mapa.js, paisaje.js, combate/logica.js, malla.js) dan lo mismo.
// Uso: node pruebas/prueba_azar.mjs      MUTAR=1 → cambia una cifra del generador lineal: tiene que fallar.
import * as az from '../src/logica/azar.js';
import * as mapa from '../src/logica/mapa.js';
import * as paisaje from '../src/logica/paisaje.js';
import * as combate from '../src/combate/logica.js';
import * as malla from '../src/mina/malla.js';

let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };
const h = (n, f, k = 1e12) => { let a = 0; for (let i = 0; i < n; i++) a = (a * 31 + Math.round(f(i) * k)) % 1000000007; return a; };
const serie = (g) => h(500, () => g());
const lineal = process.env.MUTAR ? (s) => az.azarLineal(s + 1) : az.azarLineal;

const HUELLAS = { azar: 847454008, azarCombate: 10719496, lineal: 63869155, celda: 793587416, ruido: 122642932, fbm: 28648969,
  ruido3: 892316433, pseudo: 179709936, pseudo3: 524151805, mapa: 564191350, paisaje: -726957235 };
const tiene = { azar: serie(az.azar(4242)), azarCombate: serie(az.azar(17)), lineal: serie(lineal(99991)), celda: serie(az.azarCelda(12, -7, 3, 66172)),
  ruido: h(500, i => az.ruido(i * 0.37, i * 0.11, 5)), fbm: h(500, i => az.fbm(i * 0.73, -i * 0.29, 66172)),
  ruido3: h(500, i => az.ruido3(i * 0.31, i * 0.17, -i * 0.07, 11)), pseudo: h(500, i => az.pseudo(i * 1.7 - 300)), pseudo3: h(500, i => az.pseudo3(i * 0.3, i * 0.7, -i * 1.1)) };
const m = mapa.generarMapa(4242, { N: 96 }), pai = paisaje.crearPaisaje(m);
tiene.mapa = h(m.h.length, i => m.h[i], 1e6);
tiene.paisaje = h(2000, i => pai.altura((i % 50) * 37.3 + 500, Math.floor(i / 50) * 41.7 + 500), 1e6);
for (const k of Object.keys(HUELLAS)) comprobar(`${k}: los mismos números que antes`, tiene[k] === HUELLAS[k], `${tiene[k]} (antes ${HUELLAS[k]})`);

comprobar('mapa.js ofrece el mismo azar, ruido y fbm', mapa.azar === az.azar && mapa.ruido === az.ruido && mapa.fbm === az.fbm);
comprobar('paisaje.js ofrece el mismo azarCelda', paisaje.azarCelda === az.azarCelda);
comprobar('combate/logica.js ofrece el mismo azar', combate.azar === az.azar);
comprobar('mina/malla.js ofrece el mismo ruido3', malla.ruido3 === az.ruido3);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
