// Kinhold — las zonas del rey (valravnx, 4 nov). Lógica pura (sin three.js): la usan el servidor, para no dejar poner
// un mojón en ellas, y el navegador, para avisar y para pintarlas en el mapa del rey, con la misma cuenta.
//
// «Las zonas con una veta marcada en el mapa, un sitio de salida o la ciudad no se reclaman; en ellas cava y recoge
// cualquiera. Las vetas pequeñas sin marcar sí pueden quedar dentro de tierras privadas.» Como no tienen dueño, en
// ellas cualquiera recoge (y cavará), y nadie construye (construir pide estar en tu tierra o en la de quien te invita).
//
// Cuáles son (contadas el 5 nov con el mundo elegido, ver el diario): de las 1.840 zonas con tierra de Whitholm,
//  - la de la gran veta de hierro de la sierra (la única veta marcada de la isla; en Breiddal),
//  - la de la ciudad del rey (en Strandvang),
//  - la de la salida común (en Lindholt): el 0 de la escena en línea, y donde sale un nuevo si no queda sitio libre.
// Los 259 sitios de la salida al azar (SALIDAS, uno por km² que vale en las tres comarcas de inicio) caen en 235 zonas,
// el 28 % de esas tres comarcas, y NO son del rey (valravnx, 5 nov: «podemos hacer que sean zonas sin tomar por nadie
// siempre… apareces en un punto aleatorio LIBRE, si una zona tiene mojón activo, deja de ser spawn»): se reclaman como
// las demás, y el servidor da a cada personaje nuevo uno de los sitios cuya zona sigue libre (servidor/servidor.mjs).
//
// Lo que cuesta calcularlas (buscarZonasRey) es generar el mapa; por eso los sitios van apuntados en SITIOS_REY, que el
// servidor y el navegador pasan a zonas con comarcas.zonaEn (9 puntos cada uno). La prueba (pruebas/prueba_zonas_rey.mjs)
// genera el mapa y comprueba que siguen siendo los mismos.
import { ISLA, SALIDA, CIUDAD_REY, dentroDeIsla } from './whitholm.js';

// Por qué es del rey cada una (el texto sale en el mapa y en el aviso)
export const POR_QUE = {
  veta: 'gran veta de hierro',
  carbon: 'gran veta de carbón',
  ciudad: 'la ciudad',
  salida: 'sitio de salida',
};
export const MOTIVO_REY = 'Es zona del rey: no se reclama (aquí cava y recoge cualquiera).';

// Los sitios del mundo elegido (m del mundo) y por qué. Los da buscarZonasRey; la prueba comprueba que siguen siendo esos.
export const SITIOS_REY = [
  { x: 180500, z: 60500, por: 'veta' },
  { x: CIUDAD_REY.x, z: CIUDAD_REY.z, por: 'ciudad' },
  { x: SALIDA.x, z: SALIDA.z, por: 'salida' },
];

// Busca los sitios con el mapa: las vetas marcadas (las grandes) de la isla, la ciudad y la salida común.
export function buscarZonasRey(mapa, comarcas, isla = ISLA) {
  const l = [];
  for (const v of mapa.vetas) {
    if (!v.tipo.startsWith('gran')) continue;
    const x = (v.x + 0.5) * mapa.celda, z = (v.y + 0.5) * mapa.celda;
    const zz = comarcas.zonaEn(x, z);
    if (!dentroDeIsla(x, z, isla) || !zz || zz.comarca < 0) continue;
    l.push({ x, z, por: v.tipo === 'granCarbon' ? 'carbon' : 'veta' });
  }
  l.push({ x: CIUDAD_REY.x, z: CIUDAD_REY.z, por: 'ciudad' });
  l.push({ x: SALIDA.x, z: SALIDA.z, por: 'salida' });
  return l;
}

// Las zonas del rey con las comarcas de ese mundo: { ids: Set de ids de zona, lista: [{ id, x, z, por }], es(id),
// porQue(id) } (por: la clave de POR_QUE; si una zona tiene dos, la primera).
export function crearZonasRey(comarcas, sitios = SITIOS_REY) {
  const lista = [], porId = new Map();
  for (const s of sitios) {
    const zz = comarcas.zonaEn(s.x, s.z);
    if (!zz || zz.comarca < 0 || porId.has(zz.id)) continue;
    porId.set(zz.id, s.por); lista.push({ id: zz.id, x: s.x, z: s.z, por: s.por });
  }
  return { ids: new Set(porId.keys()), lista, es: (id) => porId.has(id), porQue: (id) => porId.get(id) || null };
}
