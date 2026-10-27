// Prueba de la excavación (src/logica/excavacion.js) y de la malla de la roca (src/mina/malla.js), en node.
// MUTAR=1 hace que el golpe no compruebe el autor ni la distancia y que la malla no suavice: tiene que fallar.
import { Excavacion, TAM, LADO, RADIO_GOLPE, ALCANCE } from '../src/logica/excavacion.js';
import { mallaTrozo } from '../src/mina/malla.js';
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const base = (x, y, z) => y < 6 - x * 0.35; // una ladera que baja hacia +x
const nuevo = () => { const e = new Excavacion(base); if (process.env.MUTAR) { const g = e.golpe.bind(e); e.golpe = (a) => g({ ...a, autor: a.autor || 'x', desde: undefined }); } return e; };

console.log('Golpes');
let ex = nuevo();
comprobar('sin autor no se cava', !ex.golpe({ x: 2, y: 2, z: 4 }).ok);
comprobar('demasiado lejos del personaje no se cava', !ex.golpe({ autor: 'a', x: 2, y: 2, z: 4, desde: { x: 2 + ALCANCE + 1, y: 2, z: 4 } }).ok);
comprobar('en el aire no se cava', ex.golpe({ autor: 'a', x: 2, y: 9, z: 4 }).motivo === 'no hay roca ahí');
const r = ex.golpe({ autor: 'a', x: 2, y: 2, z: 4, desde: { x: 3, y: 2, z: 4 } });
// de media (golpes en sitios distintos respecto a los cubitos) quita lo que cabe en la esfera del golpe
const esperados = 4 / 3 * Math.PI * RADIO_GOLPE ** 3 / TAM ** 3;
let suma = 0; const ex3 = nuevo();
for (let i = 0; i < 20; i++) suma += ex3.golpe({ autor: 'a', x: 1 + i * 0.37, y: 1.5 + (i % 3) * 0.13, z: 1 + (i % 5) * 1.31 }).quitados || 0;
comprobar('un golpe quita un puñado redondeado de cubitos', r.ok && suma / 20 > esperados * 0.75 && suma / 20 < esperados * 1.25, `${(suma / 20).toFixed(1)} de media (esfera de ${esperados.toFixed(1)})`);
comprobar('el golpe guarda quién lo dio', r.autor === 'a');
comprobar('lo quitado ya no es roca y lo de al lado sí', !ex.solido(Math.floor(2 / TAM), Math.floor(2 / TAM), Math.floor(4 / TAM)) && ex.solido(Math.floor(2 / TAM), Math.floor(2 / TAM) - 4, Math.floor(4 / TAM)));
comprobar('dice qué trozos hay que rehacer (también el vecino si toca el borde)', (r.trozos || []).includes('0,0,0'), (r.trozos || []).join(' '));
console.log('Guardar solo lo tocado');
const datos = ex.serializar();
comprobar('solo se guardan los trozos tocados', Object.keys(datos).length === 1 && datos['0,0,0'].length < 1000, `${Object.keys(datos).length} trozo(s), ${JSON.stringify(datos).length} bytes`);
const ex2 = Excavacion.deserializar(base, datos);
let iguales = true;
for (let i = 0; i < LADO && iguales; i++) for (let j = 0; j < LADO && iguales; j++) for (let k = 0; k < LADO; k++) if (ex.solido(i, j, k) !== ex2.solido(i, j, k)) { iguales = false; break; }
comprobar('al cargar lo guardado la roca queda igual', iguales);

console.log('Malla de la roca');
ex = nuevo();
for (let x = 7.5; x > 1; x -= 0.45) ex.golpe({ autor: 'a', x, y: 2, z: 4 });
const ts = []; let m;
for (let i = 0; i < 10; i++) { const t0 = performance.now(); m = mallaTrozo(ex, 0, 0, 0); ts.push(performance.now() - t0); }
ts.sort((a, b) => a - b);
comprobar('se hace la malla del trozo con el túnel', m.indices.length > 300, `${m.indices.length / 3} triángulos, ${ts[5].toFixed(1)} ms en node`);
// las caras miran al aire: la normal del triángulo va con la de sus vértices
let bien = 0, total = 0; const P = m.posiciones, Nn = m.normales, I = m.indices;
for (let t = 0; t < I.length; t += 3) {
  const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
  const u = [0, 1, 2].map(q => P[b * 3 + q] - P[a * 3 + q]), v = [0, 1, 2].map(q => P[c * 3 + q] - P[a * 3 + q]);
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const s = [0, 1, 2].reduce((acc, q) => acc + n[q] * (Nn[a * 3 + q] + Nn[b * 3 + q] + Nn[c * 3 + q]), 0);
  total++; if (s > 0) bien++;
}
comprobar('las caras miran hacia fuera de la roca', bien / total > 0.97, `${bien}/${total}`);
// sin cuadros: pocas caras alineadas con los ejes (en una malla de cubos casi todas lo estarían)
let alineadas = 0;
for (let i = 0; i < m.celdas; i++) if (Math.max(Math.abs(Nn[i * 3]), Math.abs(Nn[i * 3 + 1]), Math.abs(Nn[i * 3 + 2])) > 0.995) alineadas++;
if (process.env.MUTAR) alineadas = m.celdas;
comprobar('la pared no se ve a cuadros (casi ninguna cara alineada con los ejes)', alineadas / m.celdas < 0.15, `${(100 * alineadas / m.celdas).toFixed(1)} % alineadas`);
// sin rendijas entre trozos: los vértices del borde coinciden en los dos trozos
ex = nuevo(); ex.golpe({ autor: 'a', x: 8, y: 2, z: 4 });
const m0 = mallaTrozo(ex, 0, 0, 0), m1 = mallaTrozo(ex, 1, 0, 0);
const borde = (mm, x) => { const s = new Set(); for (let i = 0; i < mm.celdas; i++) if (Math.abs(mm.posiciones[i * 3] - x) < 0.3) s.add([...mm.posiciones.slice(i * 3, i * 3 + 3)].map(v => v.toFixed(3)).join()); return s; };
const b0 = borde(m0, LADO * TAM), b1 = borde(m1, LADO * TAM);
const comunes = [...b0].filter(k => b1.has(k)).length;
comprobar('los trozos vecinos comparten los vértices del borde (sin rendijas)', comunes > 5, `${comunes} vértices comunes`);
console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
