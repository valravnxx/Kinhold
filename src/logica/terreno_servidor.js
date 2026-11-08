// Kinhold — el servidor conoce el mundo (hito «El juego en el mundo de verdad»). Lógica pura, sin three.js.
//
// El servidor genera Whitholm con la misma semilla que el navegador (generarMapa(SEMILLA_MUNDO), crearPaisaje) y con eso:
//  - saca él los árboles y los puntos de recogida (vegetacionTrozo y recogidaTrozo, por trozos de 32 m, como el
//    navegador): ya no se fía del árbol o del punto que dice el navegador (sitio, edad, clase), solo de su nombre;
//  - comprueba contra el terreno dónde dice estar cada jugador (dentro de la isla y cerca del suelo) y las obras (el
//    mojón en tierra firme, la planta baja de lo que se empieza a ras del suelo, la brocha y la decoración a una altura
//    que tenga sentido).
//
// Coordenadas: las de la escena en línea, en metros desde el sitio común de salida (SALIDA) y la altura desde el suelo
// de ese sitio; como la presencia y el mundo de construcción del servidor.
//
// Decisiones provisionales (anotadas en el registro de decisiones y en el diario):
//  - ALTURAS: hasta dónde puede estar un jugador por debajo del suelo (cavando) y por encima (en lo alto de lo
//    construido); la planta baja de lo que se empieza, a ±1,5 m del suelo (el navegador lo mide en la malla del trozo,
//    que en una ladera puede apartarse algo del suelo exacto); la brocha, a ±6 m (al arrastrarla sigue a la altura de
//    la pasada anterior, ladera arriba o abajo); la decoración, de 0,5 m por debajo a 40 m por encima.
//  - El mojón, en tierra firme (más de 0,15 m sobre el mar, como la orilla del juego) y dentro de la isla.
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from './mapa.js';
import { crearPaisaje } from './paisaje.js';
import { SALIDA, ISLA, MUNDO_ENTERO, dentroDeIsla, alturaMundo } from './whitholm.js';
import { vegetacionTrozo, LADO_VEG, TAM_ADULTO, CLARO_ARBOLES } from './vegetacion.js';
import { recogidaTrozo, LADO_RECOGIDA } from './recogida_mundo.js';
import { idArbol } from './tala.js';
import { idMata, idRoca, rompible } from './recoleccion.js';
import { nivelar as conMarcas, marcasEn } from './nivelado.js';
import { crearComarcas, zonasDeEscena } from './comarcas.js';
import { crearZonasRey } from './zonas_rey.js';
import { crearTierrasRey } from './tierras_rey.js';

export const ALTURAS = { bajoSuelo: 40, sobreSuelo: 120, plantaBaja: 1.5, brocha: 6, decoBajo: 0.5, decoSobre: 40, orilla: 0.15 };
const MAX_TROZOS = 400;   // trozos de lo que crece guardados (los más viejos se van)
const r2 = v => Math.round(v * 100) / 100;

// paisaje: crearPaisaje(mapa); semilla: la del mapa. origen: el 0 de la escena (SALIDA).
export function crearTerreno({ paisaje, semilla, origen = SALIDA, isla = ISLA, alturas = ALTURAS }) {
  const O = { x: origen.x, z: origen.z };
  const alt = alturaMundo(paisaje);
  const y0 = alt(O.x, O.z);
  // los trozos ya hechos (árboles y puntos), por su clave; cuando hay demasiados, se van los primeros
  const guardar = (mapa, k, hacer) => {
    let v = mapa.get(k);
    if (!v) { v = hacer(); mapa.set(k, v); if (mapa.size > MAX_TROZOS) mapa.delete(mapa.keys().next().value); }
    return v;
  };
  const arbolesT = new Map(), puntosT = new Map();
  // los árboles de un trozo, como los tiene el navegador (src/mundo/vegetacion_mundo.js): en la escena, sin los del claro
  // de la salida, con su nombre por su sitio y su edad por su tamaño
  const arbolesDe = (i, j) => guardar(arbolesT, i + ',' + j, () => {
    const m = new Map();
    for (const e of vegetacionTrozo(paisaje, alt, semilla, i, j).arboles) {
      const x = e.x - O.x, z = e.z - O.z;
      if (Math.hypot(x, z - 2) < CLARO_ARBOLES) continue;
      const id = idArbol(x, z);
      m.set(id, { id, x: r2(x), z: r2(z), edad: e.edad });
    }
    return m;
  });
  // los matorrales de un trozo (desbrozar, 8 nov), como los tiene el navegador: en la escena, sin los del claro de la
  // salida (3 m alrededor de (0, 2): src/mundo/vegetacion_mundo.js), cada uno con su nombre por su sitio
  const matasT = new Map();
  const matasDe = (i, j) => guardar(matasT, i + ',' + j, () => {
    const m = new Map();
    for (const e of vegetacionTrozo(paisaje, alt, semilla, i, j, true).matas) {
      const x = e.x - O.x, z = e.z - O.z;
      if (Math.hypot(x, z - 2) < 3) continue;
      const id = idMata(x, z);
      m.set(id, { id, tipo: 'matorral', x: r2(x), z: r2(z) });
    }
    return m;
  });
  // las rocas que se rompen de un trozo (8 nov), como las tiene el navegador: en la escena, sin las del claro de la
  // salida (3 m alrededor de (0, 2): src/mundo/vegetacion_mundo.js) ni los cantos del río, y solo las medianas
  const rocasT = new Map();
  const rocasDe = (i, j) => guardar(rocasT, i + ',' + j, () => {
    const m = new Map();
    for (const e of vegetacionTrozo(paisaje, alt, semilla, i, j).piedras) {
      const x = e.x - O.x, z = e.z - O.z;
      if (e.canto || !rompible(e.tam) || Math.hypot(x, z - 2) < 3) continue;
      const id = idRoca(x, z);
      m.set(id, { id, tipo: 'roca', x: r2(x), z: r2(z), tam: Math.round(e.tam * 1000) / 1000 });
    }
    return m;
  });
  const puntosDe = (i, j) => guardar(puntosT, i + ',' + j, () => {
    const m = new Map();
    for (const p of recogidaTrozo(paisaje, alt, semilla, i, j)) m.set(p.id, { id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) });
    return m;
  });
  const num = v => typeof v === 'number' && Number.isFinite(v);
  // en el trozo de (x, z) y, si está casi en el borde (lo guardado va redondeado a cm), en el de al lado
  const buscar = (de, L, id, x, z) => {
    const vistos = new Set();
    for (const [dx, dz] of [[0, 0], [-0.05, 0], [0.05, 0], [0, -0.05], [0, 0.05]]) {
      const i = Math.floor((x + dx + O.x) / L), j = Math.floor((z + dz + O.z) / L), k = i + ',' + j;
      if (vistos.has(k)) continue; vistos.add(k);
      const v = de(i, j).get(id); if (v) return v;
    }
    return null;
  };

  // la altura del suelo en la escena; con las marcas de nivelado (en la escena: las del mundo de construcción)
  const suelo = (x, z, marcas = null) => {
    const xm = x + O.x, zm = z + O.z;
    if (!marcas || !marcas.length) return alt(xm, zm) - y0;
    const cerca = marcasEn(marcas, x - 8, z - 8, x + 8, z + 8).map(m => ({ ...m, x: m.x + O.x, z: m.z + O.z, y: m.y + y0 }));
    return conMarcas(alt, cerca)(xm, zm) - y0;
  };
  const enIsla = (x, z) => dentroDeIsla(x + O.x, z + O.z, isla);
  // el agua en (x, z) de la escena, como la ve el navegador (src/mundo/mundo_juego.js, aguaEn): lo hondo (m) del río o
  // del mar, o null en seco. Los ríos de alrededor se guardan mientras no se vaya 300 m más allá.
  let rios = null;
  const aguaEn = (x, z) => {
    const xm = x + O.x, zm = z + O.z;
    if (!rios || Math.hypot(xm - rios.x, zm - rios.z) > 300) rios = { x: xm, z: zm, tramos: paisaje.riosEn(xm - 900, zm - 900, xm + 900, zm + 900) };
    const s = alt(xm, zm), w = paisaje.agua(xm, zm, rios.tramos);
    if (w !== null && w > s) return w - s;
    return s < 0 ? -s : null;
  };

  return {
    origen: O, y0, suelo, enIsla, alturas, paisaje, alt, semilla, aguaEn,
    // El árbol de nombre id que el navegador dice tener en (x, z) de la escena: el del servidor ({ id, x, z, edad }) o null.
    arbol(id, x, z) {
      if (typeof id !== 'string' || !num(x) || !num(z) || !enIsla(x, z)) return null;
      return buscar(arbolesDe, LADO_VEG, id, x, z);
    },
    // Lo mismo con un punto de recogida: { id, tipo, x, z } o null.
    punto(id, x, z) {
      if (typeof id !== 'string' || !num(x) || !num(z) || !enIsla(x, z)) return null;
      return id.startsWith('matorral:') ? buscar(matasDe, LADO_VEG, id, x, z) : id.startsWith('roca:') ? buscar(rocasDe, LADO_VEG, id, x, z) : buscar(puntosDe, LADO_RECOGIDA, id, x, z);
    },
    // ¿Puede estar ahí un jugador? { x, y, z } de su presencia. Devuelve el motivo si no. La cuenta de admin (admin),
    // también fuera de la isla, en todo el continente (valravnx, 5 nov: «quiero poder explorar libre»).
    posicion(e, { admin = false } = {}) {
      if (!(admin ? dentroDeIsla(e.x + O.x, e.z + O.z, MUNDO_ENTERO) : enIsla(e.x, e.z))) return 'Fuera de la isla.';
      const s = suelo(e.x, e.z);
      if (e.y < s - alturas.bajoSuelo || e.y > s + alturas.sobreSuelo) return 'Ahí no se puede estar.';
      return null;
    },
    // Una obra contra el terreno (las acciones de construcción, con el autor ya puesto). marcas: las de nivelado del
    // mundo de construcción. Devuelve el motivo si no vale, o null (lo demás lo mira la lógica de la construcción).
    obra(a, marcas = null) {
      if (!a || typeof a !== 'object') return null;
      const t = a.tipo;
      if (t !== 'mojon' && t !== 'colocar' && t !== 'nivelar' && t !== 'decorar') return null;
      if (!num(a.x) || !num(a.z)) return null;   // (la forma la mira la lógica de las acciones)
      if (!enIsla(a.x, a.z)) return 'Fuera de la isla.';
      const s = suelo(a.x, a.z, marcas);
      if (t === 'mojon') return s + y0 > alturas.orilla ? null : 'Ahí no hay tierra firme.';
      if (!num(a.y)) return null;
      if (t === 'colocar') return Math.abs(a.y - s) <= alturas.plantaBaja ? null : 'Ese no es el suelo de ahí.';
      if (t === 'nivelar') return Math.abs(a.y - s) <= alturas.brocha ? null : 'Demasiada diferencia con el suelo de ahí.';
      return a.y >= s - alturas.decoBajo && a.y <= s + alturas.decoSobre ? null : 'Ese no es el suelo de ahí.';
    },
  };
}

// Whitholm tal cual lo ve el navegador: el mapa del mundo elegido (unos 5 s en generarse) y su paisaje.
// Y Strandvang, tierras del rey (src/logica/tierras_rey.js): tierras(x, z) dice si un sitio de la escena es de ahí.
export function terrenoWhitholm(opc = {}) {
  const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
  const t = crearTerreno({ paisaje: crearPaisaje(mapa), semilla: mapa.semilla, ...opc });
  const comarcas = crearComarcas(mapa);
  t.tierras = crearTierrasRey(comarcas, opc.origen || SALIDA).en;
  // y de qué zona es cada sitio: tu tierra es la zona entera de tu mojón (src/logica/construccion.js, ponerZonas)
  t.zona = zonasDeEscena(comarcas, opc.origen || SALIDA);
  // y las zonas del rey (src/logica/zonas_rey.js), que no se reclaman
  t.zonasRey = crearZonasRey(comarcas);
  t.esZonaRey = t.zonasRey.es;
  return t;
}
