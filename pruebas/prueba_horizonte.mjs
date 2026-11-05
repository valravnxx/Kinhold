// El horizonte de los perfiles altos (src/logica/horizonte.js). Ejecutar: node pruebas/prueba_horizonte.mjs
// Comprueba: la compresión deja toda la isla dentro del alcance de la cámara, no toca lo de cerca y se deshace bien
// (la niebla lo necesita para saber la distancia de verdad); las muestras se calculan poco a poco, de basto a fino,
// con el alto de verdad del paisaje; la malla quita lo que es todo mar y deja la tierra (con las montañas); el mar de
// lejos cubre el cuadro de la isla; y los perfiles: los bajos no lo llevan, los altos sí y cada uno al menos tan fino
// como el anterior. Con MUTAR=1 la compresión se calcula con la mitad de la diagonal (lo lejano se saldría de la
// cámara): debe FALLAR.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA } from '../src/logica/whitholm.js';
import { crearMuestras, mallaDe, mallaMar, compresion, comprimir, descomprimir, NIVELES, HUNDIDO, MAR, BASE } from '../src/logica/horizonte.js';
import { PERFILES, HORIZONTE } from '../src/posprocesado/perfiles.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const MUTAR = process.env.MUTAR === '1';

console.log('La compresión');
const LEJOS = 1600, HASTA = 768;   // el alcance de la cámara del juego y dónde acaba el terreno de cerca (PC)
const diag = Math.hypot(ISLA.x1 - ISLA.x0, ISLA.z1 - ISLA.z0);
const c = compresion(HASTA, LEJOS, MUTAR ? diag / 2 : diag);
comprobar('empieza pasado el terreno de cerca', c.r0 > HASTA, `r0 ${c.r0} m`);
comprobar('lo más lejos de la isla (su diagonal) cabe en la cámara', comprimir(diag, c) < LEJOS, `${Math.round(comprimir(diag, c))} m de ${LEJOS}`);
comprobar('lo de cerca no cambia', comprimir(300, c) === 300 && comprimir(c.r0, c) === c.r0);
const vuelta = [1000, 5000, 20000, diag].every(d => Math.abs(descomprimir(comprimir(d, c), c) - d) < 1e-6 * d);
comprobar('se deshace (la niebla sabe la distancia de verdad)', vuelta);
comprobar('lo más lejano sigue detrás de lo menos lejano', comprimir(20000, c) > comprimir(10000, c));

console.log('Las muestras, poco a poco');
const paisaje = crearPaisaje(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }));
const m = crearMuestras(paisaje, ISLA);
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

console.log('Los perfiles');
const bajos = PERFILES.filter(p => !p.horizonte).map(p => p.id), altos = PERFILES.filter(p => p.horizonte);
comprobar('los dos móviles más baratos no lo llevan', bajos.join() === 'movil-1,movil-2', bajos.join());
comprobar('cada perfil de PC al menos tan fino como el anterior', altos.filter(p => p.id.startsWith('pc')).every((p, i, l) => !i || p.horizonte.paso <= l[i - 1].horizonte.paso));
comprobar('los pasos son niveles que hay', altos.every(p => NIVELES.includes(p.horizonte.paso)));
comprobar('la niebla de cerca no tapa las montañas', HORIZONTE.tope < 1 && HORIZONTE.max < 1 && HORIZONTE.lejos > c.r0);

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
