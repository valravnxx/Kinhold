// La lluvia moja (P11b, «La lluvia y el riego»). Ejecutar: node pruebas/prueba_mojado.mjs
// Comprueba, en la lógica pura (src/logica/mojado.js): sin lluvia, seco; al empezar a llover se va mojando y está
// empapado a los MOJAR; cuando para, sigue mojado un rato y se seca de a poco, seco del todo a los SECAR; sale del tiempo
// del mundo (igual para todos: misma zona, mismo valor); y el paso a poco de las pruebas hace lo mismo.
// Con MUTAR=1 se seca de golpe al parar: debe FALLAR.
import * as T from '../src/logica/tiempo.js';
import { mojado as mojadoDe, pasoMojado, MOJAR, SECAR } from '../src/logica/mojado.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const MUTAR = process.env.MUTAR === '1';
const mojado = MUTAR ? (x, z, t) => (T.lloviendo(x, z, t) ? mojadoDe(x, z, t) : 0) : mojadoDe;
globalThis.__tiempo = undefined;
const { BLOQUE_TIEMPO: B } = T;
const T0 = Date.UTC(2026, 10, 1);

// un rato de lluvia que empieza tras uno seco y le sigue uno seco (en la zona 0,0), y otro de dos ratos seguidos
let suelto = null, doble = null;
for (let b = Math.floor(T0 / B); b < Math.floor(T0 / B) + 8 * 400 && !(suelto && doble); b++) {
  const ll = (k) => T.lloviendo(500, 500, k * B + 1);
  if (!suelto && !ll(b - 1) && ll(b) && !ll(b + 1)) suelto = b;
  if (!doble && !ll(b - 1) && ll(b) && ll(b + 1)) doble = b;
}
comprobar('hay ratos de lluvia sueltos y seguidos en 400 días', suelto !== null && doble !== null, `${suelto} ${doble}`);

console.log('Se moja y se seca');
{
  const ini = suelto * B, fin = ini + B;
  comprobar('antes de llover, seco', mojado(500, 500, ini - 1000) === 0);
  const m1 = mojado(500, 500, ini + MOJAR / 4);
  comprobar('al poco de empezar, algo mojado (no de golpe)', m1 > 0.1 && m1 < 0.5, String(m1));
  comprobar(`a los ${MOJAR / 60000} min de lluvia, empapado`, mojado(500, 500, ini + MOJAR) === 1);
  comprobar('lloviendo un rato largo, empapado', mojado(500, 500, ini + B / 2) === 1);
  const d1 = mojado(500, 500, fin + 60 * 1000);
  comprobar('un minuto después de parar, sigue casi empapado', d1 > 0.9, String(d1));
  const d2 = mojado(500, 500, fin + SECAR / 2);
  comprobar('a la mitad del secado, a medias', d2 > 0.4 && d2 < 0.6, String(d2));
  comprobar(`a los ${SECAR / 60000} min de parar, seco`, mojado(500, 500, fin + SECAR) === 0);
  let baja = true, prev = 1;
  for (let t = fin; t <= fin + SECAR; t += 30000) { const m = mojado(500, 500, t); if (m > prev + 1e-9) baja = false; prev = m; }
  comprobar('se seca sin volver a mojarse a saltos', baja);
}
{
  const ini = doble * B;
  comprobar('el segundo rato seguido de lluvia, empapado desde el principio', mojado(500, 500, ini + B + 1000) === 1);
}

console.log('Igual para todos');
{
  const t = suelto * B + MOJAR / 2;
  comprobar('el mismo sitio de la zona, el mismo valor', mojado(500, 500, t) === mojado(900, 100, t));
}

console.log('El paso a poco (el tiempo fijo de las pruebas)');
{
  let m = 0; for (let i = 0; i < 10; i++) m = pasoMojado(m, true, MOJAR / 10);
  comprobar('lloviendo, se moja en MOJAR', Math.abs(m - 1) < 1e-9, String(m));
  const p = pasoMojado(1, false, 60000);
  comprobar('al parar, un minuto después sigue mojado', p > 0.9 && p < 1, String(p));
  m = 1; for (let i = 0; i < 10; i++) m = pasoMojado(m, false, SECAR / 10);
  comprobar('y seco en SECAR', m < 1e-9, String(m));
}

console.log(`\n${ok} correctas, ${mal} fallan`);
process.exit(mal ? 1 : 0);
