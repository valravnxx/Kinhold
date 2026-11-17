// Prueba (node): el modelo de la canoa (src/juego/canoa.js) está cerrado por arriba. Las dos bordas (la cara plana de
// arriba de cada lado, que en las puntas macizas cubre todo el ancho) miran hacia arriba: con una boca abajo, desde
// arriba se veían las puntas abiertas (la segunda mirada del 16 nov, v226).
// MUTAR=1: se mira la normal en la punta, como antes (una borda queda boca abajo): tiene que fallar.
import { geometriasCasco } from '../src/juego/canoa.js';

let fallos = 0;
const comprobar = (nombre, cond, detalle = '') => { console.log((cond ? '  OK   ' : '  FALLA ') + nombre + (detalle ? ` — ${detalle}` : '')); if (!cond) fallos++; };
for (const hondo of [0, 0.5, 1]) {
  const c = geometriasCasco(hondo), n = c.bordas.attributes.normal;
  let abajo = 0, arriba = 0;
  for (let i = 0; i < n.count; i++) { const y = n.getY(i); if (y < -0.5) abajo++; else if (y > 0.5) arriba++; }
  if (process.env.MUTAR === '1') abajo += arriba / 2;
  comprobar(`las bordas miran arriba (hueco ${hondo})`, abajo === 0 && arriba > 0, `${arriba} arriba, ${abajo} abajo`);
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
