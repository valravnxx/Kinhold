// El fondo del mar junto a la costa (src/logica/paisaje.js, fondoMar). Ejecutar: node pruebas/prueba_mar.mjs
// valravnx, 5 nov: «tienes una distancia gigantesca en la cual el agua no cubre… El mar tendría que no cubrir un
// poquito, pero luego ya hundirse… sobre todo en zonas de acantilado». Comprueba, en las costas de Whitholm que miran al
// oeste (filas cada 500 m; antes cada 1,5 km, con solo 4 o 5 playas: un río más que llegaba al mar cambiaba el resultado): en todas, a 80 m de la orilla ya cubre de sobra (más de 4 m); en las playas, una franja
// somera (a 20 m, entre 0,2 y 3 m de agua: la arena a la vista); al pie de los acantilados, hondo ya (a 20 m, más de
// 4 m; las filas cruzan la costa en sesgo, así que la distancia de verdad a la orilla es algo menor; sin las costas
// a menos de 250 m de un río, donde el valle y la boca cambian la tierra de detrás); y mar adentro el fondo no vuelve a subir hasta la superficie.
// Y la arena de la playa, solo junto al mar (valravnx, 6 nov: salía arena en todo lo que queda a menos de 2,8 m sobre el
// mar, también en las vegas de los ríos, kilómetros tierra adentro): en lo bajo y llano a más de 400 m del mar, nada de
// arena; en las playas (de caliza o arenisca), arena junto a la orilla.
// Con MUTAR=1 vuelve el fondo de antes (la forma del mapa · 1,6) y con MUTAR=2, la arena por la altura sola: deben FALLAR.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA, alturaMundo } from '../src/logica/whitholm.js';
import { colorDelSuelo, ARENA_PLAYA } from '../src/mundo/color_suelo.js';

if (process.env.MUTAR === '1') globalThis.__marViejo = true;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const P = crearPaisaje(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO })), alt = alturaMundo(P);

const costas = [];
for (let z = ISLA.z0 + 2000; z < ISLA.z1 - 1000; z += 500) {
  let prev = alt(ISLA.x0, z);
  for (let x = ISLA.x0 + 10; x < ISLA.x1; x += 10) {
    const y = alt(x, z);
    if (prev <= 0 && y > 0) {
      // (junto a la boca de un río, el valle cambia la tierra de detrás: no vale para decir si es playa o acantilado)
      const tr = P.riosEn(x - 500, z - 500, x + 500, z + 500), rio = P.rioCerca(x, z, tr).dm < 250;
      costas.push({ x, z, rio, tierra50: alt(x + 50, z), tierra200: alt(x + 200, z), hondo: (d) => -alt(x - d, z) });
      break;
    }
    prev = y;
  }
}
console.log(`${costas.length} costas que miran al oeste`);
comprobar('hay costas que medir', costas.length > 20);

const a80 = costas.filter(c => c.hondo(80) > 4);
comprobar('a 80 m de la orilla ya cubre de sobra (más de 4 m) en casi todas', a80.length >= costas.length * 0.9, `${a80.length} de ${costas.length}`);
const playas = costas.filter(c => !c.rio && c.tierra200 < 6 && c.tierra200 > 0);   // (con tierra detrás: no un islote)
const someras = playas.filter(c => c.hondo(20) > 0.2 && c.hondo(20) < 3);
// (en la mayoría: en un tercio de las costas bajas la tierra sube detrás en otra dirección que la de la fila, y el
// fondo las toma por costa alta; medido el 6 nov con filas cada 500 m, 13 de 19 antes de este cambio)
comprobar('en las playas, una franja somera (a 20 m, entre 0,2 y 3 m)', playas.length > 10 && someras.length >= playas.length * 0.6, `${someras.length} de ${playas.length} playas`);
const acantilados = costas.filter(c => !c.rio && c.tierra50 > 20);
const hondos = acantilados.filter(c => c.hondo(20) > 4);
comprobar('al pie de los acantilados, hondo ya (a 20 m, más de 4 m)', acantilados.length > 3 && hondos.length >= acantilados.length * 0.8, `${hondos.length} de ${acantilados.length} acantilados`);
let sube = 0;
for (const c of costas) for (let d = 100; d <= 1500; d += 50) if (c.hondo(d) < 0.5) { sube++; break; }
comprobar('mar adentro (de 100 a 1500 m) el fondo no sale a flote', sube <= costas.length * 0.1, `${sube} de ${costas.length} con un bajo de menos de 0,5 m`);


// la arena: lo que se parece el color del suelo al de la arena (0: nada; 1: arena entera)
const arena = (x, z) => {
  const y = alt(x, z), st = P.sitio(x, z, y);
  if (process.env.MUTAR === '2') st.costa = 0;
  const c = colorDelSuelo(st, y, 0.05, x, z), base = colorDelSuelo({ ...st, costa: Infinity }, y, 0.05, x, z);
  const d = Math.hypot(...base.map((v, n) => v - ARENA_PLAYA[n])), e = Math.hypot(...c.map((v, n) => v - ARENA_PLAYA[n]));
  return d > 1e-6 ? 1 - e / d : 0;
};
let dentro = 0, conArena = 0;
for (let z = ISLA.z0 + 1000; z < ISLA.z1 - 1000 && dentro < 400; z += 173) for (let x = ISLA.x0 + 1000; x < ISLA.x1 - 1000; x += 211) {
  const y = alt(x, z);
  if (y < 0.3 || y > 2.5) continue;
  const st = P.sitio(x, z, y);
  if (!st.bioma || st.costa < 400 || (st.roca !== 'caliza' && st.roca !== 'arenisca')) continue;
  dentro++; if (arena(x, z) > 0.3) conArena++;
}
comprobar('tierra adentro (a más de 400 m del mar, en lo bajo), sin arena de playa', dentro > 30 && conArena === 0, `${conArena} de ${dentro} puntos con arena`);
const enPlaya = playas.filter(c => P.sitio(c.x + 15, c.z, alt(c.x + 15, c.z)).roca !== 'granito').map(c => arena(c.x + 15, c.z));
comprobar('en las playas, arena junto a la orilla (a 15 m)', enPlaya.length > 5 && enPlaya.filter(a => a > 0.6).length >= enPlaya.length * 0.6, `${enPlaya.filter(a => a > 0.6).length} de ${enPlaya.length}`);

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
