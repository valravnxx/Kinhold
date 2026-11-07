// El horizonte de los perfiles altos (src/logica/horizonte.js). Ejecutar: node pruebas/prueba_horizonte.mjs
// Comprueba: la compresión deja toda la isla dentro del alcance de la cámara, no toca lo de cerca y se deshace bien
// (la niebla lo necesita para saber la distancia de verdad); las muestras se calculan poco a poco, de basto a fino,
// con el alto de verdad del paisaje; la malla quita lo que es todo mar y deja la tierra (con las montañas); el mar de
// lejos cubre el cuadro de la isla; y los perfiles: los bajos no lo llevan, los altos sí y cada uno al menos tan fino
// como el anterior. Con MUTAR=1 la compresión se calcula con la mitad de la diagonal (lo lejano se saldría de la
// cámara): debe FALLAR. Con MUTAR=monticulos, el dosel de cerca sin suavizar y desde el jugador (como antes): debe
// FALLAR. Con MUTAR=2 las especies del dosel miden 40 m (copas que no son de estos árboles): debe FALLAR.
// El dosel (el bosque de lejos): solo donde hay bosque y en tierra, de la altura de las copas, más fino de cerca.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA } from '../src/logica/whitholm.js';
import { readFileSync } from 'fs';
import { crearMuestras, mallaDe, mallaMar, mallaDosel, crearDoselCerca, doselDe, compresion, comprimir, descomprimir, NIVELES, HUNDIDO, MAR, BASE, DOSEL_DESDE } from '../src/logica/horizonte.js';
import { SALIDAS, alturaMundo } from '../src/logica/whitholm.js';
import { PERFILES, HORIZONTE } from '../src/posprocesado/perfiles.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const MUTAR = process.env.MUTAR === '1', MUTAR2 = process.env.MUTAR === '2', MUTAR3 = process.env.MUTAR === '3';
// las especies como las da el juego (src/mundo/horizonte.js: el alto de TAMANO_ESPECIE y un verde)
const ALTO = { abeto: 10.5, pino: 9.5, abedul: 9, roble: 7.5, haya: 10.8, fresno: 9.2, encina: 5.5 };
const ESPECIES = Object.fromEntries(Object.entries(ALTO).map(([e, a]) => [e, { alto: MUTAR2 ? 40 : a, color: [0.2, 0.27, 0.15] }]));

console.log('La compresión');
const LEJOS = 1600, HASTA = 768;   // el alcance de la cámara del juego y dónde acaba el terreno de cerca (PC)
const diag = Math.hypot(ISLA.x1 - ISLA.x0, ISLA.z1 - ISLA.z0);
const c = compresion(HASTA, LEJOS, MUTAR ? diag / 2 : diag, MUTAR3 ? 0 : undefined);
comprobar('empieza pasado el terreno de cerca', c.r0 > HASTA, `r0 ${c.r0} m`);
comprobar('lo más lejos de la isla (su diagonal) cabe en la cámara', comprimir(diag, c) < LEJOS, `${Math.round(comprimir(diag, c))} m de ${LEJOS}`);
comprobar('lo de cerca no cambia', comprimir(300, c) === 300 && comprimir(c.r0, c) === c.r0);
const vuelta = [1000, 5000, 20000, diag].every(d => Math.abs(descomprimir(comprimir(d, c), c) - d) < 1e-6 * d);
comprobar('se deshace (la niebla sabe la distancia de verdad)', vuelta);
comprobar('lo más lejano sigue detrás de lo menos lejano', comprimir(20000, c) > comprimir(10000, c));
// Sin franjas levantadas (valravnx, 6 nov: «a lo lejos sigue hundido el terreno bajo el agua… y los glitches de lo
// parecido a los árboles»): la malla lejana es de triángulos planos entre vértices comprimidos. Con la compresión de
// golpe en r0, un cuadro del mar de lejos (a 4 m bajo el nivel) con un vértice antes de r0 y otro lejos (comprimido
// hasta casi r0, y por eso alto, cerca de la línea de mirada) era una rampa que subía metros entre unos 700 y 850 m y
// tapaba la tierra de cerca (se veía mar donde hay tierra). Con la cámara a 8, 30 y 80 m de alto, en cuadros del mar
// (250 m) y del suelo llano a 0,5 m (100 m) en cualquier sitio y dirección: dentro de donde llega el terreno de cerca
// (HASTA), lo dibujado no sube más de 0,5 m sobre su altura de verdad.
{
  let peorMar = -1e9, peorSuelo = -1e9;
  for (const H of [8, 30, 80]) {
    const comp3 = (x, y, z) => { const d = Math.hypot(x, y - H, z), k = comprimir(d, c) / d; return [x * k, H + (y - H) * k, z * k]; };
    for (let a = 0; a < 48; a++) for (let d0 = HASTA - 600; d0 < c.r0 + 3000; d0 += 25) for (const [L, y, cual] of [[250, -4, 'mar'], [100, 0.5, 'suelo']]) {
      const ux = Math.cos(a / 48 * 2 * Math.PI), uz = Math.sin(a / 48 * 2 * Math.PI), A = [d0, y, 0], B = [d0 + ux * L, y, uz * L];
      const CA = comp3(...A), CB = comp3(...B);
      for (let t = 0; t <= 1; t += 0.05) {
        const x = CA[0] + (CB[0] - CA[0]) * t, yy = CA[1] + (CB[1] - CA[1]) * t, z = CA[2] + (CB[2] - CA[2]) * t;
        if (Math.hypot(x, z) > HASTA) continue;
        if (cual === 'mar') peorMar = Math.max(peorMar, yy - y); else peorSuelo = Math.max(peorSuelo, yy - y);
      }
    }
  }
  comprobar('el mar de lejos no sube dentro del terreno de cerca (como mucho 0,5 m sobre sus -4 m)', peorMar < 0.5, `${peorMar.toFixed(2)} m`);
  comprobar('el suelo de lejos no sube dentro del terreno de cerca (como mucho 0,5 m)', peorSuelo < 0.5, `${peorSuelo.toFixed(2)} m`);
}

console.log('Las muestras, poco a poco');
const paisaje = crearPaisaje(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }));
const m = crearMuestras(paisaje, ISLA, undefined, ESPECIES);
let reloj = 0; const ahora = () => reloj;
const n1 = m.avanzar(2, () => ++reloj);   // el reloj sube 1 ms cada vez que se mira (cada 64 puntos)
comprobar('un fotograma hace poco (con el tope de milisegundos)', n1 > 0 && n1 <= 256, `${n1} puntos`);
comprobar('aún no hay ningún nivel', !NIVELES.some(k => m.tiene(k)));
const orden = [];
while (!m.terminado) { m.avanzar(1e9, ahora); for (const k of NIVELES) if (m.tiene(k) && !orden.includes(k)) orden.push(k); }
comprobar('llega primero lo basto y luego lo fino (cada 400, 200 y 100 m)', orden.join() === NIVELES.join(), orden.join());
let iguales = 0, prob = 0;
for (let i = 0; i < 200; i++) {
  const ix = (i * 37) % m.nx, iz = (i * 53) % m.nz;
  prob++; if (Math.abs(m.alto[iz * m.nx + ix] - paisaje.altura(ISLA.x0 + ix * BASE, ISLA.z0 + iz * BASE)) < 1e-3) iguales++;   // (se guarda en Float32)
}
comprobar('el alto es el del paisaje', iguales === prob, `${iguales}/${prob}`);
let maxAlto = -1e9; for (const y of m.alto) maxAlto = Math.max(maxAlto, y);
comprobar('hay montañas (lo que se quiere ver)', maxAlto > 300, `lo más alto ${Math.round(maxAlto)} m`);

console.log('La malla');
const g4 = mallaDe(m, 4), g1 = mallaDe(m, 1, { ox: 1000, oz: 2000, y0: 50 });
comprobar('lo fino tiene más triángulos que lo basto', g1.idx.length > g4.idx.length * 8, `${g4.idx.length / 3} y ${g1.idx.length / 3}`);
const enteros = (g1.cx - 1) * (g1.cz - 1) * 2;
comprobar('quita los cuadros que son todo mar', g1.idx.length / 3 < enteros, `${g1.idx.length / 3} de ${enteros}`);
let ymax = -1e9; for (let v = 0; v < g1.cx * g1.cz; v++) ymax = Math.max(ymax, g1.pos[v * 3 + 1]);
comprobar('va hundida y en metros de la escena', Math.abs(ymax - (maxAlto - 50 - HUNDIDO)) < 1e-3, `${ymax.toFixed(1)} m`);
let mares = 0, malMar = 0;
for (let v = 0; v < g1.cx * g1.cz; v++) if (m.alto[v] <= MAR) { mares++; if (g1.pos[v * 3 + 1] > -50) malMar++; }
comprobar('el mar baja mucho (la costa la hace el mar de lejos)', mares > 0 && malMar === 0);
comprobar('los colores son lineales y entre 0 y 1', g1.col.every(v => v >= 0 && v <= 1));

console.log('El mar de lejos');
const mm = mallaMar(ISLA, { y: -1.5 });
let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
for (let v = 0; v < mm.cx * mm.cz; v++) { x0 = Math.min(x0, mm.pos[v * 3]); x1 = Math.max(x1, mm.pos[v * 3]); z0 = Math.min(z0, mm.pos[v * 3 + 2]); z1 = Math.max(z1, mm.pos[v * 3 + 2]); }
comprobar('cubre el cuadro de la isla y no se sale', x0 === ISLA.x0 && x1 === ISLA.x1 && z0 === ISLA.z0 && z1 === ISLA.z1);
comprobar('en trozos (para que siga la compresión)', mm.cx > 50 && mm.cz > 50, `${mm.cx}×${mm.cz}`);

console.log('El dosel (el bosque de lejos)');
let conDosel = 0, enMar = 0, hMax = 0;
for (let i = 0; i < m.dosel.length; i++) if (m.dosel[i] > 0) { conDosel++; if (m.alto[i] <= MAR) enMar++; hMax = Math.max(hMax, m.dosel[i]); }
comprobar('hay dosel en una parte de la isla (los bosques), no en toda', conDosel > m.dosel.length * 0.05 && conDosel < m.dosel.length * 0.6, `${(100 * conDosel / m.dosel.length).toFixed(0)} % de los puntos`);
comprobar('nada en el mar', enMar === 0);
comprobar('las copas, de la altura de estos árboles (hasta unos 14 m)', hMax > 4 && hMax < 14.5, `lo más alto ${hMax.toFixed(1)} m`);
comprobar('sin bosque, sin dosel', doselDe({ d: DOSEL_DESDE * 0.9, especie: 'haya', tam: 1 }, ESPECIES, 0, 0) === null && doselDe({ d: 0.8, especie: null, tam: 1 }, ESPECIES, 0, 0) === null);
const d1 = mallaDosel(m, 1), d4 = mallaDosel(m, 4);
comprobar('la malla del dosel, solo donde hay bosque (menos que la del suelo)', d1.idx.length > 0 && d1.idx.length < g1.idx.length, `${d1.idx.length / 3} triángulos (el suelo, ${g1.idx.length / 3})`);
comprobar('y más basta de lejos en los perfiles bajos', d4.idx.length * 8 < d1.idx.length, `${d4.idx.length / 3} cada 400 m`);
// el linde (valravnx, 5 nov: «se corta de manera así»): entre dos puntos vecinos de la malla del dosel, lo que suben
// las copas sobre el suelo no salta de golpe (antes, de unos 14 m a 4 m bajo el suelo: una pared con dientes de sierra);
// y donde acaba, el color es el del suelo. MUTAR=linde: sin el linde suave (como antes): tiene que fallar
if (process.env.MUTAR === 'linde') globalThis.__mutarLinde = true;
function linde(k) {
  const g = mallaDosel(m, k), cx = Math.floor((m.nx - 1) / k) + 1, cz = Math.floor((m.nz - 1) / k) + 1;
  const n = (a, b) => (b * k) * m.nx + a * k, usado = new Map();
  for (const w of g.idx) usado.set(w, true);
  // el sitio de cada punto en la malla: lo que va de él sobre el suelo, y su color contra el del suelo
  const sobre = new Map(), color = new Map();
  for (let b = 0; b < cz; b++) for (let a = 0; a < cx; a++) { const q = b * cx + a; sobre.set(q, null); }
  let vx = 0;
  const pos = g.pos, col = g.col, lin = (c) => Math.pow(c / 255, 2.2);
  // (los puntos van en el orden en que entran en la malla: se rehace el mapa punto → sitio como lo hace mallaDosel)
  const usar = new Int32Array(cx * cz).fill(-1); let nv = 0;
  const D = (a, b) => g.dens[b * cx + a];
  for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) {
    if (!(D(a, b) > 0 || D(a + 1, b) > 0 || D(a, b + 1) > 0 || D(a + 1, b + 1) > 0)) continue;
    for (const q of [b * cx + a, b * cx + a + 1, (b + 1) * cx + a, (b + 1) * cx + a + 1]) if (usar[q] < 0) usar[q] = nv++;
  }
  let salto = 0, malColor = 0, bordes = 0;
  const alto = (q) => { const a = q % cx, b = (q - a) / cx, w = usar[q]; return pos[w * 3 + 1] - Math.max(m.alto[n(a, b)], 0); };
  for (let b = 0; b < cz; b++) for (let a = 0; a < cx; a++) {
    const q = b * cx + a, w = usar[q]; if (w < 0) continue;
    for (const [da, db] of [[1, 0], [0, 1]]) { const a2 = a + da, b2 = b + db; if (a2 >= cx || b2 >= cz) continue; const r = b2 * cx + a2; if (usar[r] < 0) continue; salto = Math.max(salto, Math.abs(alto(q) - alto(r))); }
    if (g.dens[q] === 0) { bordes++; const i = n(a, b); for (let c = 0; c < 3; c++) if (Math.abs(col[w * 3 + c] - lin(m.color[i * 3 + c])) > 1e-6) { malColor++; break; } }
  }
  return { salto, malColor, bordes };
}
for (const k of [1, 2]) {
  const l = linde(k);
  comprobar(`el linde del bosque de lejos sin pared (cada ${k * 100} m): las copas no saltan más de 10 m entre vecinos`, l.salto < 10, `salto máximo ${l.salto.toFixed(1)} m`);
  comprobar(`y donde acaba, del color del suelo (cada ${k * 100} m)`, l.bordes > 0 && l.malColor === 0, `${l.malColor} de ${l.bordes}`);
}
if (process.env.MUTAR === 'monticulos') globalThis.__mutarMonticulos = true;
const alt = alturaMundo(paisaje);
// (el bosque mixto de cerca: el sitio de salida (193000, 79000); por su sitio, no por su número en la lista, que cambia)
const MIXTO = SALIDAS.findIndex(s => s[0] === 193000 && s[1] === 79000);
const cercaDe = (i) => { const [x, z] = SALIDAS[i], c = crearDoselCerca(paisaje, alt, ESPECIES, Math.round(x / 16) * 16, Math.round(z / 16) * 16, 500); while (!c.listo) c.avanzar(1e9); return { c, g: c.malla({ ox: x, oz: z }) }; };
const bosque = cercaDe(MIXTO), prado = cercaDe(0);
comprobar('de cerca, en un bosque mixto hay copas', bosque.g.idx.length > 3000, `${bosque.g.idx.length / 3} triángulos`);
comprobar('y en la pradera abierta (corros sueltos) casi nada', prado.g.idx.length < bosque.g.idx.length / 10, `${prado.g.idx.length / 3} triángulos`);
let fuera = 0; for (let v = 0; v < bosque.g.pos.length / 3; v++) if (Math.abs(bosque.g.pos[v * 3]) > 520 || Math.abs(bosque.g.pos[v * 3 + 2]) > 520) fuera++;
comprobar('de cerca, en su cuadro y en metros de la escena', fuera === 0);
// sin montículos (valravnx, 7 nov: «crea este glitch grafico de monticulos que equivaldrian rollo a 50 metros cada uno»):
// dentro del bosque, las copas de cerca no saltan de un punto al de al lado (cada 16 m) más de 1 m de media (sin suavizar, unos 2,2), y cada
// punto lleva lo que sube sobre el suelo (el sombreador lo mete bajo el suelo cerca del jugador)
{
  const g = bosque.g, P = 16, nx = Math.round(1000 / P) + 2;   // (la rejilla: en el cuadro de 500 m de radio)
  const pos = new Map(); for (let v = 0; v < g.pos.length / 3; v++) if (g.alto[v] > 0) pos.set(Math.round(g.pos[v * 3] / P) + ',' + Math.round(g.pos[v * 3 + 2] / P), g.alto[v]);
  let suma = 0, n = 0;
  for (const [k, h] of pos) { const [a, b] = k.split(',').map(Number); const d = pos.get((a + 1) + ',' + b); if (d !== undefined) { suma += Math.abs(d - h); n++; } }
  const media = suma / n;
  comprobar('de cerca, las copas sin montículos: entre vecinos, menos de 1 m de media', n > 500 && media < 1, `${media.toFixed(2)} m en ${n} pares`);
  comprobar('y cada punto dice lo que sube sobre el suelo', g.alto && g.alto.length === g.pos.length / 3 && g.alto.some(v => v > 5) && g.alto.some(v => v === -3));
}
{
  const fuente = readFileSync(new URL('../src/mundo/horizonte.js', import.meta.url), 'utf8');
  const ini = Number((/DOSEL_INICIO = (\d+)/.exec(fuente) || [])[1]), rampa = Number((/DOSEL_RAMPA = (\d+)/.exec(fuente) || [])[1]);
  const usa = /uIni: \{ value: globalThis.__mutarMonticulos \? 0 : DOSEL_INICIO \}/.test(fuente) && !globalThis.__mutarMonticulos;
  comprobar('las copas de cerca empiezan más allá de los árboles de verdad (200 m) y suben poco a poco', usa && ini >= 240 && rampa >= 100, `desde ${ini} m, enteras ${rampa} m más allá`);
}
// donde aún no ha llegado el terreno de cerca, nada (flotaría): aquí, sin terreno al este de la salida
{
  const [x, z] = SALIDAS[MIXTO], c = crearDoselCerca(paisaje, alt, ESPECIES, Math.round(x / 16) * 16, Math.round(z / 16) * 16, 500, undefined, (px) => MUTAR2 || px < x);
  while (!c.listo) c.avanzar(1e9);
  const g = c.malla({ ox: x, oz: z });
  let este = 0; for (let v = 0; v < g.pos.length / 3; v++) if (g.pos[v * 3] > 20 && g.pos[v * 3 + 1] > alt(g.pos[v * 3] + x, g.pos[v * 3 + 2] + z) - 1) este++;
  comprobar('sin terreno de cerca debajo, sin dosel (y dice que faltan puntos)', este === 0 && c.faltan > 0 && g.idx.length > 0, `${este} copas al este; faltan ${c.faltan}`);
}

console.log('Los perfiles');
const bajos = PERFILES.filter(p => !p.horizonte).map(p => p.id), altos = PERFILES.filter(p => p.horizonte);
comprobar('los dos móviles más baratos no lo llevan', bajos.join() === 'movil-1,movil-2', bajos.join());
comprobar('cada perfil de PC al menos tan fino como el anterior', altos.filter(p => p.id.startsWith('pc')).every((p, i, l) => !i || p.horizonte.paso <= l[i - 1].horizonte.paso));
comprobar('los pasos son niveles que hay', altos.every(p => NIVELES.includes(p.horizonte.paso)));
comprobar('la niebla de cerca no tapa las montañas', HORIZONTE.tope < 1 && HORIZONTE.max < 1 && HORIZONTE.lejos > c.r0);

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
