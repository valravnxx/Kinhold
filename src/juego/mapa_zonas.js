// Kinhold — las zonas en el mapa del rey (valravnx, 4 nov): al acercar el mapa salen los lindes de las zonas en que se
// divide cada comarca (src/logica/comarcas.js), y tu tierra, la zona entera de tu mojón, resaltada.
//
// Los lindes van en curva (cada sitio es de la zona del punto más cercano en un plano deformado), así que no hay una
// lista de líneas hecha: se sacan de muestras. Por teselas de TESELA km: se mira de qué zona es cada punto de una
// rejilla de PASO m y, donde dos muestras vecinas son de zonas distintas, pasa un linde (cuadrados que marchan: en cada
// casilla de la rejilla, de la mitad de un lado a la mitad de otro). Salen segmentos en km, que el mapa traza nítidos a
// cualquier zoom. Una tesela son unas 10.000 muestras; se hacen a pasos (paso(presupuesto)) para no parar el juego.
// Tu zona: una máscara de muestras (1 = tuya) alrededor de tu mojón, que el mapa pinta de color, y su borde. Las zonas
// del rey, igual, cada una alrededor de su sitio. Y las zonas ya tomadas por un mojón (valravnx, 8 nov), cada una en la
// suya, hechas una vez por zona (tomadas).
// Sin three.js ni DOM: se prueba en Node (pruebas/prueba_mapa_zonas.mjs).

export const TESELA = 4;        // km de lado de cada tesela de lindes
export const PASO = 40;         // m entre muestras de los lindes
export const PASO_TIERRA = 25;  // m entre muestras de tu zona
export const RADIO_TIERRA = 2600;   // m alrededor del mojón en que se busca tu zona (una zona mide como mucho unos 2 km)

// Los colores de las tierras de los demás: apagados, lejos del rojo de la tuya y del oro del rey
export const COLORES_TIERRAS = [[52, 96, 128], [74, 112, 58], [104, 74, 122], [38, 112, 108], [122, 92, 58], [88, 88, 104], [128, 78, 96], [60, 84, 46]];
export const ROJO_TIERRA = [196, 58, 34];
// el color que prefiere la tierra de un dueño (sale de su autor)
export function colorDeDueno(dueno) {
  let h = 2166136261;
  for (const c of String(dueno)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % COLORES_TIERRAS.length;
}
// los colores de todos los dueños con mojón (el mundo entero, el mismo para todos los que miran): cada uno, el suyo si
// está libre y si no el siguiente libre, por orden de autor; con más dueños que colores, alguno se repite
export function coloresDeDuenos(duenos) {
  const out = new Map(), usados = new Set();
  for (const d of [...new Set(duenos)].sort()) {
    let k = colorDeDueno(d);
    if (usados.size < COLORES_TIERRAS.length) while (usados.has(k)) k = (k + 1) % COLORES_TIERRAS.length;
    usados.add(k); out.set(d, COLORES_TIERRAS[k]);
  }
  return out;
}

// La etiqueta de cada sitio: el id de su zona, o -1 en el mar sin zona.
const etiquetaDe = (comarcas) => (x, z) => { const zz = comarcas.zonaEn(x, z); return zz && zz.comarca >= 0 ? zz.id : -1; };

// Cuadrados que marchan con etiquetas: rejilla de (n + 1) × (n + 1) muestras (fila a fila) con origen (x0, z0) y paso
// h, en km. Devuelve los segmentos [x1, z1, x2, z2, …] en km. Los lindes con el mar sin zona no se trazan (la costa ya
// está en el mapa), ni, con «dentro» (x, z en km → si es tierra), los que caen en el agua: las zonas de la costa llevan
// algo de mar.
export function lindes(et, n, x0, z0, h, dentro = null) {
  const out = [], W = n + 1;
  const linde = (a, b) => a !== b && a >= 0 && b >= 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = et[j * W + i], b = et[j * W + i + 1], c = et[(j + 1) * W + i + 1], d = et[(j + 1) * W + i];
    if (a === b && b === c && c === d) continue;
    const x = x0 + i * h, z = z0 + j * h, p = [];
    if (dentro && !dentro(x + h / 2, z + h / 2)) continue;
    if (linde(a, b)) p.push(x + h / 2, z);          // arriba
    if (linde(b, c)) p.push(x + h, z + h / 2);      // derecha
    if (linde(d, c)) p.push(x + h / 2, z + h);      // abajo
    if (linde(a, d)) p.push(x, z + h / 2);          // izquierda
    if (p.length === 4) out.push(p[0], p[1], p[2], p[3]);
    else if (p.length > 4) for (let k = 0; k < p.length; k += 2) out.push(p[k], p[k + 1], x + h / 2, z + h / 2);
  }
  return out;
}

export function crearZonasMapa(comarcas) {
  const et = etiquetaDe(comarcas);
  let esTierra = null;   // (x, z en km) → si es tierra; lo pone el mapa cuando tiene su imagen (ponerTierra)
  const teselas = new Map();   // «tx,ty» → Float32Array de segmentos en km
  const cola = [];             // teselas pedidas, la primera la más urgente
  let tierra = null;           // { clave, zona, x0, z0, n, h (km), mascara: Uint8Array n × n, segs }

  function hacerTesela(tx, ty) {
    const n = Math.round(TESELA * 1000 / PASO), h = PASO / 1000, x0 = tx * TESELA, z0 = ty * TESELA;
    const e = new Int32Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) e[j * (n + 1) + i] = et((x0 + i * h) * 1000, (z0 + j * h) * 1000);
    teselas.set(`${tx},${ty}`, new Float32Array(lindes(e, n, x0, z0, h, esTierra)));
  }

  // una zona entera: la del sitio (x, z en m del mundo), en una máscara alrededor de él (1 = de esa zona) y su borde
  function hacerMascara(x, z, radio) {
    const zona = et(x, z);
    if (zona < 0) return null;
    const n = Math.round(2 * radio / PASO_TIERRA), h = PASO_TIERRA / 1000;
    const x0 = (x - radio) / 1000, z0 = (z - radio) / 1000;
    const e = new Int32Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) e[j * (n + 1) + i] = et((x0 + i * h) * 1000, (z0 + j * h) * 1000) === zona ? 1 : 0;
    // la máscara (casilla j, i: de la zona si lo es su esquina de arriba a la izquierda) y su borde
    const mascara = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) mascara[j * n + i] = e[j * (n + 1) + i] && (!esTierra || esTierra(x0 + i * h, z0 + j * h)) ? 1 : 0;
    return { zona, x0, z0, n, h, mascara, segs: new Float32Array(lindes(e, n, x0, z0, h, esTierra)) };
  }
  // tu zona: la de tu mojón (x, z en m del mundo)
  function hacerTierra(x, z, radio = RADIO_TIERRA) {
    const zona = et(x, z), clave = `${zona},${radio}`;
    if (tierra && tierra.clave === clave) return tierra;
    const m = hacerMascara(x, z, radio);
    tierra = m ? { clave, ...m } : null;
    return tierra;
  }
  // las zonas del rey (src/logica/zonas_rey.js: crearZonasRey(comarcas).lista, con un sitio de cada una en m del
  // mundo): cada una en su máscara, hechas una vez
  const reyHechas = new Map();   // id → máscara (o null)
  function hacerRey(lista, radio = RADIO_TIERRA) {
    const out = [];
    for (const r of lista || []) {
      if (!reyHechas.has(r.id)) reyHechas.set(r.id, hacerMascara(r.x, r.z, radio));
      const m = reyHechas.get(r.id); if (m) out.push({ ...m, por: r.por, x: r.x, z: r.z });
    }
    return out;
  }

  // las zonas tomadas por un mojón (valravnx, 8 nov: «ver que zonas del mapa están tomadas ya por mojones con colores
  // diferentes»): lista de { x, z (el mojón, en m del mundo), dueno, tuya }; cada zona, en su máscara, hecha una vez
  const tomadasHechas = new Map();   // id de la zona → máscara (o null)
  function hacerTomadas(lista, radio = RADIO_TIERRA) {
    const out = [];
    for (const t of lista || []) {
      const zona = et(t.x, t.z);
      if (zona < 0) continue;
      if (!tomadasHechas.has(zona)) tomadasHechas.set(zona, hacerMascara(t.x, t.z, radio));
      const m = tomadasHechas.get(zona); if (m) out.push({ ...m, dueno: t.dueno, tuya: !!t.tuya, invita: !!t.invita, mx: t.x, mz: t.z });
    }
    return out;
  }

  return {
    // los segmentos de una tesela ya hecha, o null (y la pide)
    tesela(tx, ty) {
      const s = teselas.get(`${tx},${ty}`);
      if (s) return s;
      if (!cola.some(([a, b]) => a === tx && b === ty)) cola.push([tx, ty]);
      return null;
    },
    // las teselas que tocan el recuadro (en km): las que hay, y pide las que faltan, de la del centro hacia fuera
    visibles(x0, z0, x1, z1) {
      const tx0 = Math.floor(x0 / TESELA), tx1 = Math.floor(x1 / TESELA), tz0 = Math.floor(z0 / TESELA), tz1 = Math.floor(z1 / TESELA);
      const cx = (x0 + x1) / 2 / TESELA, cz = (z0 + z1) / 2 / TESELA, hay = [], faltan = [];
      for (let ty = tz0; ty <= tz1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const s = teselas.get(`${tx},${ty}`);
        if (s) hay.push(s); else faltan.push([tx, ty]);
      }
      faltan.sort((a, b) => Math.hypot(a[0] + 0.5 - cx, a[1] + 0.5 - cz) - Math.hypot(b[0] + 0.5 - cx, b[1] + 0.5 - cz));
      // lo que se ve va primero; lo que ya no se ve, fuera de la cola
      cola.length = 0; cola.push(...faltan);
      return { hay, faltan: faltan.length };
    },
    // hace teselas de la cola durante como mucho «presupuesto» ms; true si ha hecho alguna
    paso(presupuesto = 8) {
      const t0 = performance.now(); let hecho = false;
      while (cola.length && performance.now() - t0 < presupuesto) { const [tx, ty] = cola.shift(); if (!teselas.has(`${tx},${ty}`)) { hacerTesela(tx, ty); hecho = true; } }
      return hecho;
    },
    get pendientes() { return cola.length; },
    get hechas() { return teselas.size; },
    tierra: hacerTierra,
    rey: hacerRey,
    tomadas: hacerTomadas,
    // lo que es tierra (x, z en km): desde entonces, los lindes y tu zona no se pintan en el agua
    ponerTierra(f) { esTierra = f; teselas.clear(); tierra = null; reyHechas.clear(); tomadasHechas.clear(); },
    etiqueta: et,
  };
}
