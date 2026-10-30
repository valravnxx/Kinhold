// Comprueba Whitholm, la isla de los playtests (src/logica/whitholm.js), en node y sin three.js:
//   - el cuadro de la isla y el sitio de salida apuntados (ISLA y SALIDA, los que usa el servidor sin generar el mapa)
//     son los que salen del mundo elegido
//   - el sitio de salida es accesible: en tierra de la isla, ni en el mar ni en la playa, ni en un pico (por debajo de
//     la cuarta parte de lo más alto de la isla), llano alrededor y lejos de los ríos; y se puede andar desde él (sin
//     cortados en 30 m a la redonda)
//   - el cuadro de la isla deja fuera las otras regiones y no le falta tierra de la isla
// Uso: node pruebas/prueba_whitholm.mjs   MUTAR=1 → la salida en el centro de la región sin buscar: tiene que fallar.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje, PENDIENTE_ANDAR } from '../src/logica/paisaje.js';
import { ISLA, SALIDA, SALIDA_REQ, limitesIsla, buscarSalida, alturaMundo, dentroDeIsla } from '../src/logica/whitholm.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const pai = crearPaisaje(mapa);
const alt = alturaMundo(pai);
const isla = limitesIsla(mapa);
comprobar('el cuadro de la isla apuntado es el del mapa', JSON.stringify(isla) === JSON.stringify(ISLA), JSON.stringify(isla));

let s = buscarSalida(mapa, pai);
if (MUTAR) { const c = mapa.centros[mapa.paisIsla]; s = { x: (c % mapa.N + 0.5) * mapa.celda, z: (((c / mapa.N) | 0) + 0.5) * mapa.celda - 3000 }; s.y = alt(s.x, s.z); }
comprobar('hay sitio de salida y es el apuntado', s && s.x === SALIDA.x && s.z === SALIDA.z, JSON.stringify(s));

// lo más alto de la isla, en su rejilla de celdas
let maxIsla = 0, tierraFuera = 0, otrasDentro = 0;
const { N, celda } = mapa;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const k = j * N + i, x = (i + 0.5) * celda, z = (j + 0.5) * celda;
  if (mapa.pais[k] === mapa.paisIsla && mapa.tierra[k]) { maxIsla = Math.max(maxIsla, mapa.h[k]); if (!dentroDeIsla(x, z)) tierraFuera++; }
  else if (mapa.tierra[k] && mapa.pais[k] >= 0 && mapa.pais[k] !== mapa.paisIsla && dentroDeIsla(x, z)) otrasDentro++;
}
comprobar('toda la tierra de la isla cae dentro de su cuadro', tierraFuera === 0, `${tierraFuera} celdas fuera`);
comprobar('en el cuadro de la isla no hay tierra de otras regiones', otrasDentro === 0, `${otrasDentro} celdas`);

if (s) {
  const ci = Math.floor(s.z / celda) * N + Math.floor(s.x / celda);
  comprobar('la salida está en Whitholm', mapa.pais[ci] === mapa.paisIsla && dentroDeIsla(s.x, s.z));
  comprobar('la salida no está en el mar ni en la playa', s.y >= SALIDA_REQ.alturaMin, `${s.y.toFixed(1)} m`);
  comprobar('la salida no está en un pico (por debajo de la cuarta parte de lo más alto de la isla)', s.y < maxIsla / 4, `${s.y.toFixed(0)} m de ${maxIsla.toFixed(0)} m`);
  // llano y sin cortados: desnivel en 30 m y pendiente entre puntos a 2 m
  let desnivel = 0, pendMax = 0, agua = false;
  for (let r = 2; r <= 30; r += 2) for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, y = alt(x, z);
    desnivel = Math.max(desnivel, Math.abs(y - s.y));
    const y2 = alt(x - Math.cos(a) * 2, z - Math.sin(a) * 2);
    pendMax = Math.max(pendMax, Math.abs(y - y2) / 2);
    if (pai.agua(x, z, pai.riosEn(x - 10, z - 10, x + 10, z + 10)) !== null) agua = true;
  }
  comprobar('alrededor de la salida es llano (menos de 2,5 m de desnivel en 30 m)', desnivel <= 2.5, `${desnivel.toFixed(2)} m`);
  comprobar('desde la salida se puede andar a todos lados (sin cuestas de más de lo que se anda)', pendMax < PENDIENTE_ANDAR * 0.5, `pendiente máxima ${pendMax.toFixed(2)}`);
  comprobar('sin agua en 30 m a la redonda', !agua);
}

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
