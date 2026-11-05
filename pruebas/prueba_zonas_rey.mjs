// Pruebas de las zonas del rey (valravnx, 4 nov; src/logica/zonas_rey.js): las zonas con una veta marcada en el mapa,
// un sitio de salida o la ciudad no se reclaman. Con el mundo de verdad: que los sitios apuntados siguen siendo los
// que salen del mapa, que el mojón no se puede poner en ellas (sí en la de al lado) y que el mapa del rey las pinta.
// Cuenta también, para el diario, cuántas zonas tienen cada cosa (veta, vado, salida al azar, ciudad).
// Ejecutar: node pruebas/prueba_zonas_rey.mjs
// Con MUTAR=1 el mundo no sabe cuáles son las zonas del rey (como si se olvidara pasarlas): debe FALLAR.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearComarcas, zonasDeEscena } from '../src/logica/comarcas.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { ISLA, SALIDA, SALIDAS, CIUDAD_REY, COMARCAS_INICIO } from '../src/logica/whitholm.js';
import { SITIOS_REY, buscarZonasRey, crearZonasRey, MOTIVO_REY, POR_QUE } from '../src/logica/zonas_rey.js';
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { crearZonasMapa } from '../src/juego/mapa_zonas.js';

const MUTAR = process.env.MUTAR === '1';
let bien = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) bien++; else mal++;
  console.log(`  ${cond ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

const t0 = Date.now();
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const comarcas = crearComarcas(mapa);
console.log(`(mapa y comarcas en ${Date.now() - t0} ms)`);

console.log('Los sitios de las zonas del rey');
const buscados = buscarZonasRey(mapa, comarcas);
comprobar('los apuntados en SITIOS_REY son los que salen del mapa', JSON.stringify(buscados) === JSON.stringify(SITIOS_REY), JSON.stringify(buscados));
const rey = crearZonasRey(comarcas);
const nombre = (id) => { for (const r of rey.lista) if (r.id === id) { const zz = comarcas.zonaEn(r.x, r.z); return comarcas.nombres[zz.comarca]; } return null; };
comprobar('son tres zonas distintas: la de la gran veta, la de la ciudad y la de la salida', rey.lista.length === 3 && rey.ids.size === 3,
  rey.lista.map(r => `${r.por} (${nombre(r.id)})`).join(', '));
comprobar('la de la gran veta está en Breiddal, la de la ciudad en Strandvang y la de la salida en Lindholt',
  rey.lista.map(r => nombre(r.id)).join(',') === 'Breiddal,Strandvang,Lindholt');
comprobar('cada una dice por qué es del rey', rey.lista.every(r => POR_QUE[r.por] && rey.porQue(r.id) === r.por));

console.log('El mojón no se pone en ellas (con las coordenadas de la escena, como el servidor: el 0 en la salida)');
const O = SALIDA, zonaEscena = zonasDeEscena(comarcas, O);
ponerZonas(zonaEscena, MUTAR ? null : rey.es);
try {
  const m = new Mundo(), autor = 'jugador:prueba';
  const enEscena = (x, z) => ({ x: x - O.x, z: z - O.z });
  for (const r of rey.lista) {
    const p = enEscena(r.x, r.z), v = m.puedeMojon(p.x, p.z, autor);
    comprobar(`en la zona de ${POR_QUE[r.por]} no se puede poner el mojón`, !v.ok && v.motivo === MOTIVO_REY, v.motivo || 'se podía');
  }
  // la de al lado de la salida (al oeste, a unos 400 m) sí
  let al = null;
  for (let r = 50; r < 3000 && !al; r += 25) { const id = zonaEscena(-r, 4); if (id !== null && id !== zonaEscena(0, 4) && !rey.es(id)) al = { x: -r - 40, z: 4 }; }
  const v = al ? m.puedeMojon(al.x, al.z, autor) : { ok: false, motivo: 'no hay zona al lado' };
  comprobar('en la zona de al lado de la salida sí', v.ok, `${al && Math.round(-al.x)} m al oeste ${v.motivo || ''}`);
  const c = al && m.colocarMojon(al.x, al.z, autor);
  comprobar('y se pone', !!c && c.ok, c && c.motivo);
  // y en la salida nadie construye: no es de nadie y nadie puede tener ahí su tierra
  comprobar('la zona de la salida no es tierra de nadie que pueda construir en ella', m.tierraDe(0, 4) === null && !m.dentroDeTierra(0, 4, autor));
} finally { ponerZonas(null); }

console.log('El mapa del rey las pinta');
{
  const z = crearZonasMapa(comarcas), l = z.rey(rey.lista);
  comprobar('una máscara por zona del rey, con su sitio dentro', l.length === 3 && l.every(r => {
    const i = Math.floor((r.x / 1000 - r.x0) / r.h), j = Math.floor((r.z / 1000 - r.z0) / r.h);
    return r.mascara[j * r.n + i] === 1 && r.segs.length > 40;
  }), l.map(r => `${r.por}: ${r.mascara.reduce((a, b) => a + b, 0)} muestras`).join(', '));
  const km2 = l.map(r => r.mascara.reduce((a, b) => a + b, 0) * r.h * r.h);
  comprobar('del tamaño de una zona (entre 0,4 y 2,5 km²)', km2.every(a => a > 0.4 && a < 2.5), km2.map(a => a.toFixed(2)).join(', '));
}

// Para el diario: cuántas zonas de Whitholm tienen cada cosa
console.log('Cuántas zonas tienen cada cosa (para que las del rey sean las justas)');
{
  const paisaje = crearPaisaje(mapa), zonas = new Map(), km = mapa.celda;
  for (let z = ISLA.z0; z < ISLA.z1; z += 100) for (let x = ISLA.x0; x < ISLA.x1; x += 100) {
    const ci = Math.floor(z / km) * mapa.N + Math.floor(x / km); if (!mapa.tierra[ci]) continue;
    const zz = comarcas.zonaEn(x, z); if (!zz || zz.comarca < 0) continue;
    if (!zonas.has(zz.id)) zonas.set(zz.id, { c: comarcas.nombres[zz.comarca], que: new Set() });
  }
  const marca = (x, z, q) => { const zz = comarcas.zonaEn(x, z), e = zz && zonas.get(zz.id); if (e) e.que.add(q); };
  for (const v of mapa.vetas) marca((v.x + 0.5) * km, (v.y + 0.5) * km, v.tipo.startsWith('gran') ? 'veta marcada' : 'veta pequeña');
  for (const v of paisaje.vadosEn(paisaje.riosEn(ISLA.x0, ISLA.z0, ISLA.x1, ISLA.z1, 0))) marca(v.x, v.y, 'vado');
  for (const [x, z] of SALIDAS) marca(x, z, 'salida al azar');
  marca(SALIDA.x, SALIDA.z, 'salida común'); marca(CIUDAD_REY.x, CIUDAD_REY.z, 'ciudad');
  const cuenta = {}; for (const e of zonas.values()) for (const q of e.que) cuenta[q] = (cuenta[q] || 0) + 1;
  const inicio = [...zonas.values()].filter(e => COMARCAS_INICIO.includes(e.c)).length;
  console.log(`  ${zonas.size} zonas con tierra; ${inicio} en las comarcas de inicio. ${Object.entries(cuenta).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
  comprobar('la salida al azar caería en muchas zonas (por eso no son del rey hasta que lo diga valravnx)', cuenta['salida al azar'] > 100, `${cuenta['salida al azar']} de ${inicio}`);
}

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
