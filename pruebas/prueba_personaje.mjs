// Pruebas del personaje horneado (datos_humano.js). Con MUTAR=1 se rompen datos a propósito: deben fallar.
import { HUMANO } from '../src/personaje/datos_humano.js';
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const deB64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
if (process.env.MUTAR === '1') { HUMANO.niveles.cerca.hw = Buffer.from(new Uint8Array(HUMANO.niveles.cerca.vertices * 4)).toString('base64'); HUMANO.max[1] = 2.5; }
for (const [nombre, L] of Object.entries(HUMANO.niveles)) {
  console.log('Nivel', nombre);
  const q = deB64(L.pos, Uint16Array), ind = deB64(L.ind, Uint16Array), hw = deB64(L.hw, Uint8Array), hi = deB64(L.hi, Uint8Array);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 1; i < q.length; i += 3) { const y = HUMANO.min[1] + q[i] / 65535 * (HUMANO.max[1] - HUMANO.min[1]); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  comprobar('mide 1,76 m de los pies a la coronilla, más el pelo (1,75 a 1,78 m)', ymax - ymin > 1.75 && ymax - ymin < 1.78 && Math.abs(ymin) < 0.01, `${(ymax - ymin).toFixed(3)} m, pies en ${ymin.toFixed(3)}`);
  comprobar('índices válidos', ind.every(i => i < L.vertices) && ind.length === L.triangulos * 3);
  let malos = 0; for (let v = 0; v < L.vertices; v++) { const s = hw[v * 4] + hw[v * 4 + 1] + hw[v * 4 + 2] + hw[v * 4 + 3]; if (Math.abs(s - 255) > 3) malos++; }
  comprobar('cada vértice reparte su peso entre huesos (suma 1)', malos === 0, `${malos} mal`);
  comprobar('huesos válidos', hi.every(h => h < HUMANO.huesos.length));
  const presu = nombre === 'cerca' ? 26000 : 4500;
  comprobar(`presupuesto de triángulos (≤ ${presu})`, L.triangulos <= presu, `${L.triangulos}`);
}
comprobar('17 huesos con la pelvis de raíz', HUMANO.huesos.length === 17 && HUMANO.huesos[0].nombre === 'pelvis' && HUMANO.huesos[0].padre === null);
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
