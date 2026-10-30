// Comprueba las comarcas de Whitholm y sus zonas (src/logica/comarcas.js), en node y sin three.js:
//   - lo mismo da lo mismo: dos veces el mismo mundo, las mismas zonas y comarcas
//   - en el mundo elegido, las 8 comarcas aprobadas por valravnx el 30 oct, cada una con su tamaño (±15 %)
//   - toda la tierra de la isla tiene zona y comarca; la salida de los jugadores también
//   - las zonas miden aproximadamente 1 km² (de media entre 0,8 y 1,5; ninguna de más de 3)
//   - la tabla de las comarcas aprobadas casa con las cuencas (si cambia la rejilla de zonas, deja de casar)
//   - los lindes de las zonas van en curva: en una línea recta larga se cruzan lindes con ángulos distintos
// Uso: node pruebas/prueba_comarcas.mjs   MUTAR=1 → el reparto sin la tabla aprobada (por cuencas sueltas): tiene que fallar.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearComarcas } from '../src/logica/comarcas.js';
import { SALIDA } from '../src/logica/whitholm.js';

const MUTAR = process.env.MUTAR || '';
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
if (MUTAR) mapa.semilla = 1;           // deja de ser el mundo aprobado: comarcas por cuencas sueltas, sin la tabla
const C = crearComarcas(mapa), C2 = crearComarcas(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }));
const { N, celda, tierra, pais, paisIsla } = mapa;
const esIsla = (x, z) => { const i = Math.floor(x / celda), j = Math.floor(z / celda); return i >= 0 && j >= 0 && i < N && j < N && tierra[j * N + i] && pais[j * N + i] === paisIsla; };

// muestreo de la isla cada 100 m (con la tierra de las celdas de 1 km del mapa)
const P = 100, km2 = (P / 1000) ** 2, porComarca = {}, porZona = new Map(), zonas = new Map();
let sinComarca = 0, iguales = 0, total = 0;
for (let z = 0; z < mapa.lado * 1000; z += P) for (let x = 0; x < mapa.lado * 1000; x += P) {
  if (!esIsla(x + P / 2, z + P / 2)) continue;
  const zz = C.zonaEn(x + P / 2, z + P / 2), l = zz.comarca >= 0 ? C.letras[zz.comarca] : null;
  total++; if (!l) sinComarca++; else porComarca[l] = (porComarca[l] || 0) + km2;
  porZona.set(zz.id, (porZona.get(zz.id) || 0) + km2); zonas.set(zz.id, zz);
  if (total % 37 === 0) { const b = C2.zonaEn(x + P / 2, z + P / 2); if (b.id === zz.id && b.comarca === zz.comarca) iguales++; }
}
comprobar('lo mismo da lo mismo (dos veces el mismo mundo, las mismas zonas y comarcas)', iguales === Math.floor(total / 37), `${iguales} de ${Math.floor(total / 37)}`);

const APROBADAS = { A: 435, B: 307, C: 333, D: 248, E: 245, F: 173, G: 156, H: 169 };
const mal = Object.entries(APROBADAS).filter(([l, a]) => !(Math.abs((porComarca[l] || 0) - a) <= a * 0.15));
comprobar('las 8 comarcas aprobadas (A a H), cada una con su tamaño (±15 %)', C.letras.join('') === 'ABCDEFGH' && mal.length === 0,
  Object.entries(porComarca).map(([l, a]) => `${l} ${Math.round(a)} km²`).join(', '));
comprobar('las comarcas tienen los nombres que eligió valravnx (30 oct)', C.nombres.join(' ') === 'Breiddal Motdale Nordwold Lindholt Strandvang Furulid Sudholt Ravnsnes', C.nombres.join(', '));
comprobar('toda la tierra de la isla tiene zona y comarca', sinComarca === 0, `${sinComarca} de ${total} puntos sin comarca`);
const s = C.zonaEn(SALIDA.x, SALIDA.z);
comprobar('la salida de los jugadores está en una zona con comarca', s && s.comarca >= 0, s ? `comarca ${C.letras[s.comarca]}, zona ${s.id}` : '');

// tamaño de las zonas: las de dentro (las de la costa salen recortadas por el mar)
const enteras = [...porZona.values()];
const dentro = enteras.filter(a => a > 0.4), media = dentro.reduce((a, b) => a + b, 0) / dentro.length, max = Math.max(...enteras);
comprobar('zonas de aproximadamente 1 km² (de media entre 0,8 y 1,5 km², ninguna de más de 3)', media >= 0.8 && media <= 1.5 && max <= 3,
  `${porZona.size} zonas, media ${media.toFixed(2)} km², la mayor ${max.toFixed(2)} km²`);

// la tabla aprobada casa con las cuencas: en casi todas las zonas, la comarca de la tabla es la de la celda de su punto
let casan = 0, vistas = 0;
const lab = C.comarcaDeCelda;   // las comarcas por celdas de 1 km (por cuencas), sin la tabla
for (const zz of zonas.values()) {
  if (zz.comarca < 0) continue;
  const ci = Math.floor(zz.x / celda), cj = Math.floor(zz.z / celda);
  if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
  const v = lab[cj * N + ci]; if (v < 0) continue;
  vistas++; if (zz.comarca === v) casan++;
}
comprobar('la tabla de las comarcas aprobadas casa con las cuencas (más del 85 % de las zonas)', vistas > 500 && casan / vistas > 0.85, `${casan} de ${vistas}`);

// lindes en curva: a lo largo de líneas rectas, los cambios de zona no caen a distancias fijas
// (con zonas de lados rectos y una rejilla sin deformar, la separación entre cruces sería casi constante)
const sep = [];
for (const z0 of [40000, 50000, 60000]) { let ant = null, x0 = null;
  for (let x = 170000; x < 215000; x += 10) { const id = C.zonaEn(x, z0).id; if (ant !== null && id !== ant) { if (x0 !== null) sep.push(x - x0); x0 = x; } ant = id; } }
const ms = sep.reduce((a, b) => a + b, 0) / sep.length, desv = Math.sqrt(sep.reduce((a, b) => a + (b - ms) ** 2, 0) / sep.length);
comprobar('los lindes no son una rejilla: la separación entre lindes en una recta varía mucho', desv / ms > 0.3, `media ${Math.round(ms)} m, desviación ${Math.round(desv)} m`);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
