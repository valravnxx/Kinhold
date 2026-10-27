// Pruebas del generador del mapa del mundo (lógica pura, src/logica/mapa.js).
// Uso: node pruebas/prueba_mapa.mjs        MUTAR=1 estropea el resultado a propósito: tiene que fallar.
import { generarMapa, resumen, anchoRio, claseRio, BIOMAS, ROCAS } from '../src/logica/mapa.js';

let bien = 0, mal = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ` — ${d}` : '')); c ? bien++ : mal++; };
const MUTAR = !!process.env.MUTAR;

const huella = (m) => { let h = 0; for (let i = 0; i < m.h.length; i += 7) h = (h * 31 + Math.round(m.h[i])) | 0; return h; };

for (const [semilla, lado] of [[2, 256], [7, 256], [42, 256], [3, 188]]) {
  const t0 = Date.now(), m = generarMapa(semilla, { lado }), ms = Date.now() - t0;
  const N = m.N, NN = N * N, r = resumen(m), n = `semilla ${semilla}, ${lado} km`;
  if (MUTAR) { m.separacionIsla = 4; m.vetas.push({ tipo: 'carbon', x: 0, y: 0 }); const i = m.tierra.indexOf(1); m.rec[i] = i; m.pais.fill(1, 0, NN / 2); }
  console.log(`${n}: ${ms} ms · ${JSON.stringify(r)}`);
  if (semilla === 2) comprobar(`${n}: la misma semilla da el mismo mundo`, huella(generarMapa(2, { lado })) === huella(m));
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
  // vetas donde tocan
  const ok = { hierroPantano: (i) => m.bioma[i] === 'turbera', hierroVeta: (i) => m.roca[i] === 'granito' || m.roca[i] === 'pizarra', carbon: (i) => m.roca[i] === 'arenisca' };
  const malas = m.vetas.filter(v => !ok[v.tipo](v.y * N + v.x));
  comprobar(`${n}: hierro de pantano en turberas, vetas de hierro en granito o pizarra y carbón en arenisca`, malas.length === 0, `${m.vetas.length} vetas, ${malas.length} mal puestas`);
  comprobar(`${n}: hay vetas de hierro en la roca`, m.vetas.some(v => v.tipo === 'hierroVeta'));
  // ríos
  comprobar(`${n}: desembocan ríos (de más de 5 m)`, r.bocas.rio + r.bocas.grande >= 10, JSON.stringify(r.bocas));
}
// la regla del ancho de los ríos (los gruesos del GDD)
comprobar('ancho de río: 10 km² → unos 2 m (arroyo)', Math.round(anchoRio(10e6)) === 2 && claseRio(anchoRio(10e6)) === 'arroyo');
comprobar('ancho de río: 1.000 km² → unos 20 m (río)', Math.round(anchoRio(1000e6)) === 20 && claseRio(anchoRio(1000e6)) === 'rio');
comprobar('ancho de río: 10.000 km² → unos 63 m (gran río)', Math.round(anchoRio(10000e6)) === 63 && claseRio(anchoRio(10000e6)) === 'grande');

console.log(`\nResultado: ${bien} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
