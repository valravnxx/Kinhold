// Kinhold — el mundo de verdad en el juego: Whitholm, la isla de los playtests (valravnx, 29 oct). El suelo es el del
// mapa del mundo, por trozos de 64 m hechos en un hilo aparte (src/mundo/terreno_trozos.js), con rejilla de 1 m cerca y
// más basta lejos; alrededor, el mar. La escena tiene su 0 en el sitio de salida (src/logica/whitholm.js): x y z, en
// metros desde él, y la altura, desde el suelo de ese sitio (así lo que se construye junto a la salida queda a ras de
// suelo, como en el llano de antes, hasta que llegue «Construir en el mundo»).
//
// El mapa se genera antes (lo hace el menú de la demo, con su barra de progreso: tarda unos segundos) y llega hecho.
import * as THREE from 'three';
import { crearPaisaje, PENDIENTE_ANDAR } from '../logica/paisaje.js';
import { SALIDA, ISLA, dentroDeIsla, alturaMundo } from '../logica/whitholm.js';
import { crearGestor, ANILLOS, LADO as LADO_TROZO, claveTrozo } from '../logica/trozos.js';
import { crearTerrenoTrozos } from './terreno_trozos.js';
import { materialSuelo } from '../mapa/suelo.js';

const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
// los anillos de detalle: en el PC, los del juego (src/logica/trozos.js); en el móvil, los de la vista de juego del mapa
// (rejilla de 1 m hasta 32 m, 2 m hasta 128 y 4 m hasta 288; decisión provisional del 30 oct)
export const ANILLOS_MUNDO = movil ? [{ paso: 1, hasta: 32 }, { paso: 2, hasta: 128 }, { paso: 4, hasta: 288 }] : ANILLOS;
export const ORILLA = 0.15;  // m sobre el mar (la lámina del mar está a 0,05): más abajo ya es agua y no se anda

export function crearMundoJuego({ escena, mapa }) {
  const paisaje = crearPaisaje(mapa);
  const altW = alturaMundo(paisaje);
  const y0 = altW(SALIDA.x, SALIDA.z);          // el suelo del sitio de salida es el 0 de la escena
  const grupo = new THREE.Group(); grupo.name = 'trozos'; grupo.position.y = -y0;
  escena.add(grupo);
  const gestor = crearGestor({ anillos: ANILLOS_MUNDO, limites: ISLA });
  // ?hilos=N en la dirección: cuántos hilos para el terreno (las pruebas con dos páginas en una máquina sin tarjeta gráfica)
  const nh = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('hilos')) || null : null;
  const terreno = crearTerrenoTrozos({ grupo, material: materialSuelo(), mapa, paisaje, origen: SALIDA, gestor, hilos: nh,
    verticesPorFotograma: movil ? 12000 : 20000, msPorFotograma: movil ? 2 : 3 });

  // el mar: una lámina a la altura 0 del mundo, del tamaño de la isla y algo más (de momento lisa; el agua de verdad,
  // con su oleaje y los ríos, llega en otra tarea)
  const ancho = ISLA.x1 - ISLA.x0 + 6000, largo = ISLA.z1 - ISLA.z0 + 6000;
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(ancho, largo).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x4a6470 }));
  mar.name = 'mar';
  mar.position.set((ISLA.x0 + ISLA.x1) / 2 - SALIDA.x, -y0 + 0.05, (ISLA.z0 + ISLA.z1) / 2 - SALIDA.z);
  mar.receiveShadow = true;
  escena.add(mar);

  // la altura del suelo en la escena: la de la malla del trozo que se ve; si aún no ha llegado, la exacta
  function altura(x, z) {
    const xm = x + SALIDA.x, zm = z + SALIDA.z;
    const y = terreno.alturaEn(xm, zm);
    return (y === null ? altW(xm, zm) : y) - y0;
  }
  // la altura sobre el nivel del mar (m)
  const sobreMar = (x, z) => altura(x, z) + y0;

  // ¿puede haber hierba, matas, piedras o árboles en (x, z)? En tierra (no en el mar ni en la orilla) y fuera de los
  // ríos. Los tramos de río, los de alrededor de la salida (el decorado de cerca no va más allá)
  const tramos = paisaje.riosEn(SALIDA.x - 400, SALIDA.z - 400, SALIDA.x + 400, SALIDA.z + 400);
  const seco = (x, z) => sobreMar(x, z) > 1 && paisaje.agua(x + SALIDA.x, z + SALIDA.z, tramos) === null;

  // ¿se puede andar de (x0, z0) a (x1, z1)? Dentro de la isla, sin meterse en el mar y sin subir cuestas de más de
  // PENDIENTE_ANDAR (las paredes de los cortados). Bajar sí se puede (se resbala, como en el mapa).
  function andable(x0, z0, x1, z1) {
    if (!dentroDeIsla(x1 + SALIDA.x, z1 + SALIDA.z)) return false;
    if (sobreMar(x1, z1) < ORILLA) return false;
    const d = Math.hypot(x1 - x0, z1 - z0);
    if (d < 1e-6) return true;
    const sube = altura(x1, z1) - altura(x0, z0);
    return sube / d <= PENDIENTE_ANDAR || sube < 0.05;
  }

  // los trozos que tocan donde estás; listo: los que hay alrededor (de cerca) ya tienen su malla
  let listo = false;
  function paso(x, z, opc) {
    const ms = terreno.actualizar(x + SALIDA.x, z + SALIDA.z, opc);
    // listo cuando los trozos de los 3 × 3 de alrededor tienen su malla
    const i = Math.floor((x + SALIDA.x) / LADO_TROZO), j = Math.floor((z + SALIDA.z) / LADO_TROZO);
    let ok = true;
    for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1 && ok; a++) { const v = terreno.vivos.get(claveTrozo(i + a, j + b)); ok = !!(v && v.malla); }
    listo = ok;
    return ms;
  }

  return { altura, sobreMar, seco, andable, paso, terreno, paisaje, grupo, mar, y0,
    get listo() { return listo; }, salida: SALIDA, isla: ISLA };
}
