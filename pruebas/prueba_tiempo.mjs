// El tiempo del mundo entero (P11b, «La lluvia y el riego»). Ejecutar: node pruebas/prueba_tiempo.mjs
// Comprueba, en la lógica pura (src/logica/tiempo.js): despejado, nublado, lluvia y niebla salen de la hora y del sitio,
// igual para todos y por zonas grandes; la lluvia (la que riega el huerto) es la de siempre; antes y después de cada rato
// de lluvia está nublado (y las nubes crecen hacia la lluvia, sin saltos); la niebla sale algunas mañanas del mundo, nunca
// por la tarde ni de noche, ni con lluvia, y se levanta a media mañana; y el tiempo fijo de las pruebas manda.
// Con MUTAR=1 no hay nubes antes de la lluvia: debe FALLAR.
import * as T from '../src/logica/tiempo.js';
import { horaDe, msDeHora } from '../src/logica/cielo.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const { DIA, BLOQUE_TIEMPO: B, MARGEN_NUBES: M } = T;
const T0 = Math.floor(Date.UTC(2026, 10, 14) / DIA) * DIA;
if (process.env.MUTAR === '1') globalThis.__mutarTiempo = true;
globalThis.__tiempo = undefined;

// la lluvia de antes (la del riego), copiada tal cual: no debe cambiar
function azar(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const llovíaAntes = (x, z, t) => { const zx = Math.floor(x / 1000), zz = Math.floor(z / 1000); return azar(zx, zz, Math.floor(t / DIA)) < 0.3 && azar(zx + 7919, zz - 104729, Math.floor(t / B)) < 0.4; };

console.log('La lluvia, la de siempre');
{
  let iguales = 0, n = 0;
  for (let i = 0; i < 4000; i++) { const x = (i * 733) % 20000 - 3000, z = (i * 1291) % 17000 - 5000, t = T0 + i * 977_000; n++; if (T.lloviendo(x, z, t) === llovíaAntes(x, z, t) && (T.tiempoEn(x, z, t).tiempo === 'lluvia') === llovíaAntes(x, z, t)) iguales++; }
  comprobar('llueve justo donde y cuando llovía (y tiempoEn lo dice igual)', iguales === n, `${iguales}/${n}`);
}

console.log('Igual para todos, por zonas grandes');
{
  const a = [...Array(300)].map((_, i) => JSON.stringify(T.tiempoEn(i * 37, i * 11, T0 + i * 3e6)));
  const b = [...Array(300)].map((_, i) => JSON.stringify(T.tiempoEn(i * 37, i * 11, T0 + i * 3e6)));
  comprobar('el mismo sitio y la misma hora dan el mismo tiempo', a.every((v, i) => v === b[i]));
  let dentro = 0, n = 0;
  for (let i = 0; i < 500; i++) { const t = T0 + i * 1_700_000; n++; if (JSON.stringify(T.tiempoEn(1100, 2100, t)) === JSON.stringify(T.tiempoEn(1950, 2900, t))) dentro++; }
  comprobar('dentro de una misma zona de 1 km hace el mismo tiempo', dentro === n, `${dentro}/${n}`);
  let distintas = 0; for (let i = 0; i < 500; i++) { const t = T0 + i * 1_700_000; if (T.tiempoEn(500, 500, t).tiempo !== T.tiempoEn(6500, 500, t).tiempo) distintas++; }
  comprobar('a 6 km no siempre hace el mismo tiempo', distintas > 20, `${distintas} de 500`);
}

console.log('Nublado antes y después de la lluvia');
{
  // nublado, o niebla con las nubes encima (una mañana de niebla puede tocar la lluvia): nunca despejado
  const cubierto = (x, z, t) => { const e = T.tiempoEn(x, z, t); return e.nubes > 0 && (e.tiempo === 'nublado' || e.tiempo === 'niebla' || e.tiempo === 'lluvia'); };
  const cuenta = { despejado: 0, nublado: 0, lluvia: 0, niebla: 0 };
  let ratos = 0, acaban = 0, antes = 0, despues = 0, sube = 0, conLluvia = 0;
  for (let zx = 0; zx < 30; zx++) for (let k = 0; k < 400; k++) {
    const x = zx * 1000 + 500, t = T0 + k * B;
    for (let m = 0; m < B; m += B / 6) cuenta[T.tiempoEn(x, 300, t + m).tiempo]++;
    if (T.lloviendo(x, 300, t) && !T.lloviendo(x, 300, t - 1)) {   // empieza un rato de lluvia
      ratos++;
      if (cubierto(x, 300, t - M / 2) && cubierto(x, 300, t - 60e3)) antes++;
      if (T.nubes(x, 300, t - 60e3) > T.nubes(x, 300, t - M * 0.9)) sube++;
      if (T.tiempoEn(x, 300, t + 60e3).nubes === 1 && T.tiempoEn(x, 300, t + 60e3).lluvia === 1) conLluvia++;
    }
    if (T.lloviendo(x, 300, t) && !T.lloviendo(x, 300, t + B)) {    // acaba
      acaban++;
      if (cubierto(x, 300, t + B + M / 2) && cubierto(x, 300, t + B + 60e3)) despues++;
    }
  }
  comprobar('antes de cada rato de lluvia, nublado', ratos > 50 && antes === ratos, `${antes}/${ratos}`);
  comprobar('las nubes crecen hacia la lluvia (sin saltos)', sube === ratos, `${sube}/${ratos}`);
  comprobar('lloviendo, todo cubierto', conLluvia === ratos);
  comprobar('después de cada rato, aún nublado', acaban > 50 && despues === acaban, `${despues}/${acaban}`);
  const total = Object.values(cuenta).reduce((a, b) => a + b, 0);
  comprobar('los cuatro tiempos salen', Object.values(cuenta).every(v => v > 0), Object.entries(cuenta).map(([k, v]) => `${k} ${(100 * v / total).toFixed(1)} %`).join(', '));
  comprobar('lo más del tiempo, despejado', cuenta.despejado / total > 0.6);
}

console.log('La niebla, algunas mañanas');
{
  let mananas = 0, conNiebla = 0, fuera = 0, conLluvia = 0, seLevanta = 0, espesa = 0;
  for (let zx = 0; zx < 20; zx++) for (let d = 0; d < 60; d++) {
    const x = zx * 1000 + 300, base = T0 + d * 3 * 3600e3;
    const t6 = msDeHora(6.5, base), t9 = msDeHora(9.5, base);
    mananas++;
    const n6 = T.niebla(x, 800, t6);
    if (n6 > 0) { conNiebla++; if (n6 === 1 || T.lloviendo(x, 800, msDeHora(4.9, base))) espesa++; if (T.niebla(x, 800, t9) < n6 && T.niebla(x, 800, msDeHora(10.2, base)) === 0) seLevanta++; }
    for (const h of [11, 14, 17, 20, 23, 2]) if (T.niebla(x, 800, msDeHora(h, base)) > 0) fuera++;
    for (let h = 4.5; h < 10; h += 0.5) { const t = msDeHora(h, base); if (T.lloviendo(x, 800, t) && T.niebla(x, 800, t) > 0) conLluvia++; }
  }
  comprobar('unas 2 mañanas de cada 10 con niebla (entre 1 y 3)', conNiebla / mananas > 0.1 && conNiebla / mananas < 0.3, `${conNiebla}/${mananas}`);
  comprobar('a las 6:30 la niebla es espesa', espesa === conNiebla, `${espesa}/${conNiebla}`);
  comprobar('se levanta a media mañana (a las 10 ya no hay)', seLevanta === conNiebla, `${seLevanta}/${conNiebla}`);
  comprobar('nunca por la tarde ni de noche', fuera === 0, `${fuera}`);
  comprobar('nunca a la vez que la lluvia', conLluvia === 0);
  const h = horaDe(msDeHora(7, T0)).hora;
  comprobar('la hora es la del mundo (src/logica/cielo.js)', Math.abs(h - 7) < 1e-6, h.toFixed(3));
}

console.log('El tiempo fijo de las pruebas');
{
  const visto = {};
  for (const f of ['seco', 'lluvia', 'nublado', 'niebla']) { globalThis.__tiempo = f; visto[f] = [...Array(50)].map((_, i) => T.tiempoEn(i * 911, i * 313, T0 + i * 7e6).tiempo); }
  globalThis.__tiempo = undefined;
  comprobar('seco: despejado siempre', visto.seco.every(v => v === 'despejado'));
  comprobar('lluvia, nublado y niebla: siempre ese', ['lluvia', 'nublado', 'niebla'].every(f => visto[f].every(v => v === f)));
  globalThis.__tiempo = 'niebla'; const l = T.lloviendo(0, 0, T0); globalThis.__tiempo = undefined;
  comprobar('con niebla fija no llueve (el huerto no se riega solo)', l === false);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
