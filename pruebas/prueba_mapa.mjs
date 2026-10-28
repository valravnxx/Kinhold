// Pruebas del generador del mapa del mundo (lógica pura, src/logica/mapa.js).
// Uso: node pruebas/prueba_mapa.mjs        MUTAR=1 estropea el resultado a propósito: tiene que fallar.
import { generarMapa, resumen, anchoRio, claseRio, BIOMAS, ROCAS } from '../src/logica/mapa.js';

let bien = 0, mal = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ` — ${d}` : '')); c ? bien++ : mal++; };
const MUTAR = !!process.env.MUTAR;

const huella = (m) => { let h = 0; for (let i = 0; i < m.h.length; i += 7) h = (h * 31 + Math.round(m.h[i])) | 0; return h; };

for (const [semilla, lado] of [[66172, 256], [7, 256], [42, 256], [3, 188]]) {
  const t0 = Date.now(), m = generarMapa(semilla, { lado }), ms = Date.now() - t0;
  const N = m.N, NN = N * N, r = resumen(m), n = `semilla ${semilla}, ${lado} km`;
  if (MUTAR) { m.separacionIsla = 4; m.vetas.push({ tipo: 'granCarbon', x: 0, y: 0 }); m.vetas = m.vetas.filter(v => v.tipo !== 'hierroVeta'); const i = m.tierra.indexOf(1); m.rec[i] = i; m.pais.fill(1, 0, NN / 2); }
  console.log(`${n}: ${ms} ms · ${JSON.stringify(r)}`);
  if (semilla === 66172) comprobar(`${n}: la misma semilla da el mismo mundo`, huella(generarMapa(66172, { lado })) === huella(m));
  comprobar(`${n}: hay tierra y mar (entre el 30 y el 60 % de tierra)`, r.fraccionTierra > 0.3 && r.fraccionTierra < 0.6, `${(r.fraccionTierra * 100).toFixed(0)} %`);
  comprobar(`${n}: cumbres de unos 3.000 m`, r.cumbre > 2200 && r.cumbre < 3900, `${r.cumbre} m`);
  comprobar(`${n}: la isla grande queda a más de 20 km de mar de cualquier otra costa`, m.separacionIsla >= 20, `${Math.round(m.separacionIsla)} km`);
  // la isla es un país entero y solo ese
  const ci = m.centros[0]; let fuera = 0, dentro = 0;
  for (let i = 0; i < NN; i++) if (m.pais[i] === 0) dentro++;
  comprobar(`${n}: la isla es un país (País 1)`, m.pais[ci] === 0 && dentro > 0, `${Math.round(dentro * (m.celda / 1000) ** 2)} km²`);
  // todo el agua llega al mar: siguiendo la receptora desde cualquier celda de tierra se llega al mar sin dar vueltas
  let atascadas = 0;
  for (let i = 0; i < NN; i++) { if (!m.tierra[i]) continue; let c = i, k = 0; while (m.tierra[c] && k < NN) { const s = m.rec[c]; if (s < 0 || s === c) { k = NN; break; } c = s; k++; } if (k >= NN) atascadas++; }
  comprobar(`${n}: toda la lluvia llega al mar (sin ciclos ni hoyos sin salida)`, atascadas === 0, `${atascadas} celdas atascadas`);
  // países: cinco, y los del continente de tamaño parecido
  const cont = r.areaPais.slice(1), media = cont.reduce((a, b) => a + b, 0) / cont.length;
  comprobar(`${n}: cinco países, los del continente parecidos (±35 %)`, r.areaPais.every(a => a > 0) && cont.every(a => Math.abs(a / media - 1) < 0.35), r.areaPais.join(' / ') + ' km²');
  let sinPais = 0, mitad = 0; for (let i = 0; i < NN; i++) if (m.tierra[i]) { if (m.pais[i] < 0) sinPais++; } else if (m.pais[i] >= 0) mitad++;
  comprobar(`${n}: el mar no es de ningún país`, mitad === 0, `${mitad} celdas de mar con país`);
  comprobar(`${n}: casi toda la tierra tiene país (salvo islas sueltas)`, sinPais < NN * 0.04, `${sinPais} celdas sin país`);
  // biomas y roca en toda la tierra
  let malBioma = 0; for (let i = 0; i < NN; i++) if (m.tierra[i] && (!BIOMAS[m.bioma[i]] || !ROCAS[m.roca[i]])) malBioma++;
  comprobar(`${n}: cada sitio de tierra tiene bioma y roca`, malBioma === 0, `${malBioma} sin`);
  // vetas: las grandes donde tocan, separadas y pocas; las pequeñas, cerca de cualquier sitio con país
  const ok = { hierroPantano: (i) => m.bioma[i] === 'turbera', hierroVeta: (i) => m.tierra[i] === 1, carbon: (i) => m.tierra[i] === 1,
    granHierro: (i) => m.roca[i] === 'granito' || m.roca[i] === 'pizarra', granCarbon: (i) => m.roca[i] === 'arenisca' };
  const malas = m.vetas.filter(v => !ok[v.tipo](v.y * N + v.x));
  comprobar(`${n}: cada veta en su sitio (grandes de hierro en granito o pizarra, de carbón en arenisca, pantano en turberas)`, malas.length === 0, `${m.vetas.length} vetas, ${malas.length} mal puestas`);
  for (const [tipo, nombre] of [['granHierro', 'hierro'], ['granCarbon', 'carbón']]) {
    const g = m.vetas.filter(v => v.tipo === tipo); let minSep = Infinity;
    for (const a of g) for (const b of g) if (a !== b) minSep = Math.min(minSep, Math.hypot(a.x - b.x, a.y - b.y) * m.celda / 1000);
    comprobar(`${n}: pocas grandes vetas de ${nombre} (2 a 8) y a más de 45 km entre sí`, g.length >= 2 && g.length <= 8 && minSep > 45, `${g.length}, a ${Math.round(minSep)} km como poco`);
  }
  for (const [tipos, nombre] of [[['hierroVeta', 'granHierro'], 'hierro'], [['carbon', 'granCarbon'], 'carbón']]) {
    const vs = m.vetas.filter(v => tipos.includes(v.tipo)); let max = 0;
    for (let i = 0; i < NN; i += 3) if (m.tierra[i] && m.pais[i] >= 0) { const x = i % N + 0.5, y = Math.floor(i / N) + 0.5; let d = 1e9;
      for (const v of vs) d = Math.min(d, Math.hypot(v.x + 0.5 - x, v.y + 0.5 - y)); max = Math.max(max, d * m.celda / 1000); }
    comprobar(`${n}: desde cualquier sitio con país hay ${nombre} a menos de 25 km`, max < 25, `el más lejano a ${max.toFixed(1)} km`);
  }
  // ríos
  comprobar(`${n}: desembocan ríos (de más de 5 m)`, r.bocas.rio + r.bocas.grande >= 10, JSON.stringify(r.bocas));
}
// la regla del ancho de los ríos (los gruesos del GDD)
comprobar('ancho de río: 10 km² → unos 2 m (arroyo)', Math.round(anchoRio(10e6)) === 2 && claseRio(anchoRio(10e6)) === 'arroyo');
comprobar('ancho de río: 1.000 km² → unos 20 m (río)', Math.round(anchoRio(1000e6)) === 20 && claseRio(anchoRio(1000e6)) === 'rio');
comprobar('ancho de río: 10.000 km² → unos 63 m (gran río)', Math.round(anchoRio(10000e6)) === 63 && claseRio(anchoRio(10000e6)) === 'grande');

console.log(`\nResultado: ${bien} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
