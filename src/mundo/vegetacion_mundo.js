// Kinhold — lo que crece en el mundo de verdad, dibujado: los árboles de las siete especies (src/mundo/especies.js), la
// hierba, las flores, los matorrales y las piedras, con el estilo v5 y en su sitio de siempre (dónde va cada cosa lo
// dice la lógica, src/logica/vegetacion.js, con el azar de su celda del mundo). Sustituye en el mundo al decorado del
// llano (src/mundo/decorado.js), que ponía pinos y árboles de copa al azar en anillos alrededor de la salida.
//
// Devuelve lo mismo que crearDecorado: { raiz, obstaculos, altura, despejar }. Los árboles son obstáculos que se talan
// (src/juego/tala.js): llevan su especie, su tamaño, su edad, su malla y su número en ella.
import * as THREE from 'three';
import { modelosPlantas, despejarMallas } from './decorado.js';
import { modelosEspecies, ESPECIES, RADIO_TRONCO, TAMANO_ESPECIE } from './especies.js';
import { material } from './estilos.js';
import { ROCAS_COLOR, lin } from './color_suelo.js';
import { vegetacionTrozo, LADO_VEG } from '../logica/vegetacion.js';
import { idArbol } from '../logica/tala.js';
import { alturaMundo } from '../logica/whitholm.js';
import { aplicar, marcasEn, caja } from '../logica/nivelado.js';

// Medidas (decisión provisional del 30 oct): árboles y piedras en un cuadro de 400 m alrededor del jugador (260 m en
// el móvil); hierba, flores y matas en un círculo de 45 m (32 m en el móvil); los árboles enteros hasta 60 m (45 m) y
// más allá con la forma sencilla; solo echan sombra los de menos de 40 m (30 m); un claro de 8 m sin árboles en el sitio
// de salida (y de 3 m sin nada más) para no aparecer dentro de un tronco ni con la cámara metida en una copa. Con dos
// páginas a la vez en la máquina de pruebas (sin tarjeta gráfica), más que esto no daba abasto.
const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
export const MEDIDAS_VEGETACION = movil ? { cuadro: 130, hierba: 32, arbolEntero: 45, sombra: 30, max: 1200 } : { cuadro: 200, hierba: 45, arbolEntero: 60, sombra: 40, max: 3000 };
const CLARO_ARBOLES = 8, CLARO = 3;
export const TAM_ADULTO = 0.95;     // desde este tamaño (1 = adulto normal de su especie), el árbol es adulto al talarlo
const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];

// Lo que crece sigue al jugador por la isla (30 oct): se hace por trozos de 32 m del mundo (vegetacionTrozo, siempre lo
// mismo en cada sitio), los más cercanos primero y unos pocos ms en cada fotograma (paso); al andar más de PASO_REHACER
// m, o cuando han llegado trozos nuevos, se vuelven a poner las mallas alrededor de donde estás (con su detalle por
// distancia). Los trozos que quedan lejos se sueltan. Lo talado no se pierde: cada árbol es siempre el mismo obstáculo
// (con su id por su sitio) mientras su trozo está cargado, y la tala (src/juego/tala.js) guarda lo de todos, estén o no.
const MS_FOTOGRAMA = movil ? 3 : 4, PASO_REHACER = movil ? 8 : 10;

// mundoJ: el mundo del juego (src/mundo/mundo_juego.js). semilla: la del mapa.
export function crearVegetacionMundo({ mundoJ, semilla, medidas = MEDIDAS_VEGETACION }) {
  const t0 = performance.now();
  // la altura exacta (no la de la malla que ya haya llegado): así sale lo mismo esté o no cargado el suelo
  const O = mundoJ.salida, y0 = mundoJ.y0, altW = alturaMundo(mundoJ.paisaje), pai = mundoJ.paisaje;
  const C = medidas.cuadro, L = LADO_VEG;
  const raiz = new THREE.Group(); raiz.name = 'decorado';
  const obstaculos = [], o = new THREE.Object3D(), c = new THREE.Color();
  // a la escena: relativo a la salida, y la altura desde su suelo
  const esc = (e) => ({ ...e, x: e.x - O.x, z: e.z - O.z, y: e.y - y0 });
  const lejos = (e, r) => Math.hypot(e.x, e.z - 2) >= r;   // el personaje empieza en (0, 4): el claro, entre la salida y él
  const entero = modelosEspecies(), sencillo = modelosEspecies({ sencillo: true }), pl = modelosPlantas();

  // Los trozos hechos: clave → { i, j, arboles (obstáculos), piedras, hierba? { hierba, flores, matas } }
  const trozos = new Map(), clave = (i, j) => i + ',' + j;
  function hacerTrozo(i, j, conHierba) {
    const v = vegetacionTrozo(pai, altW, semilla, i, j, conHierba);
    let t = trozos.get(clave(i, j));
    if (!t) {
      t = { i, j, hierba: null };
      t.arboles = v.arboles.map(esc).filter(e => lejos(e, CLARO_ARBOLES)).map(e => ({ x: e.x, z: e.z, y: e.y - 0.2,
        r: RADIO_TRONCO[e.especie] * e.tam + 0.1, arbol: true, veg: true, especie: e.especie, modelo: e.especie, escala: e.tam,
        edad: e.tam >= TAM_ADULTO ? 'adulto' : 'joven', giro: e.giro, tono: e.tono, id: idArbol(e.x, e.z), malla: null, instancia: -1, matriz: null }));
      t.piedras = v.piedras.map(esc).filter(e => lejos(e, CLARO)).map(e => ({ ...e, y: e.y - 0.2, ob: { x: e.x, z: e.z, r: e.tam * 1.1, veg: true } }));
      trozos.set(clave(i, j), t);
      for (const e of [...t.arboles, ...t.piedras]) e.yb = e.y;
      alNivel([...t.arboles, ...t.piedras], cajaTrozo(i, j));
    }
    if (conHierba && !t.hierba) {
      const fuera = (l) => l.map(esc).filter(e => lejos(e, CLARO));
      t.hierba = { hierba: fuera(v.hierba), flores: fuera(v.flores), matas: fuera(v.matas).map(e => ({ ...e, ob: { x: e.x, z: e.z, r: 0.55 * e.tam, mata: true, veg: true } })) };
      const todo = [...t.hierba.hierba, ...t.hierba.flores, ...t.hierba.matas];
      for (const e of todo) e.yb = e.y;
      alNivel(todo, cajaTrozo(i, j));
    }
    return t;
  }

  // El suelo nivelado (src/logica/nivelado.js; la brocha y los cimientos): lo que crece donde se ha alisado sube o
  // baja con el suelo. Cada cosa guarda su altura de antes (yb) y se le suma lo que el nivelado ha movido el suelo en
  // su sitio. Las marcas, en metros de la escena (las del mundo de construcción).
  let marcasV = [], claveV = '[]';
  const baseEsc = (x, z) => altW(x + O.x, z + O.z) - y0;
  const cajaTrozo = (i, j) => ({ x0: i * L - O.x, z0: j * L - O.z, x1: (i + 1) * L - O.x, z1: (j + 1) * L - O.z });
  function alNivel(lista, b) {
    const ms = marcasEn(marcasV, b.x0, b.z0, b.x1, b.z1);
    for (const e of lista) {
      if (!ms.length) { e.y = e.yb; continue; }
      const h = baseEsc(e.x, e.z);
      e.y = e.yb + aplicar(h, e.x, e.z, ms) - h;
    }
  }
  // Devuelve cuántas cosas se han movido de altura (0 si las marcas no han cambiado).
  function nivelar(marcas) {
    const k = JSON.stringify(marcas || []);
    if (k === claveV) return 0;
    const antes = marcasV;
    marcasV = (marcas || []).map(m => ({ ...m })); claveV = k;
    const cajas = [...antes, ...marcasV].map(caja);
    let n = 0;
    for (const t of trozos.values()) {
      const b = cajaTrozo(t.i, t.j);
      if (!cajas.some(c => c.x1 >= b.x0 && c.x0 <= b.x1 && c.z1 >= b.z0 && c.z0 <= b.z1)) continue;
      const lista = [...t.arboles, ...t.piedras, ...(t.hierba ? [...t.hierba.hierba, ...t.hierba.flores, ...t.hierba.matas] : [])];
      const antesY = lista.map(e => e.y);
      alNivel(lista, b);
      lista.forEach((e, q) => { if (Math.abs(e.y - antesY[q]) > 1e-4) n++; });
    }
    if (n && centro) poner(centro);
    return n;
  }
  // los trozos que hacen falta alrededor de P (escena): los de los árboles en el cuadro y los de la hierba en su
  // círculo, los más cercanos primero
  const enMundo = (P) => ({ x: P.x + O.x, z: P.z + O.z });
  function faltan(P) {
    const W = enMundo(P), r = [], H = medidas.hierba;
    const i0 = Math.floor((W.x - C) / L), i1 = Math.floor((W.x + C) / L), j0 = Math.floor((W.z - C) / L), j1 = Math.floor((W.z + C) / L);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      // la distancia de P al trozo (0 si está dentro)
      const dx = Math.max(i * L - W.x, 0, W.x - (i + 1) * L), dz = Math.max(j * L - W.z, 0, W.z - (j + 1) * L), d = Math.hypot(dx, dz);
      const conHierba = d < H, t = trozos.get(clave(i, j));
      if (!t || (conHierba && !t.hierba)) r.push({ i, j, conHierba, d });
    }
    return r.sort((a, b) => a.d - b.d);
  }
  // los que han quedado lejos se sueltan (y la hierba antes: es lo que más ocupa)
  function soltar(P) {
    const W = enMundo(P), fuera = [];
    for (const [k, t] of trozos) {
      const dx = Math.max(t.i * L - W.x, 0, W.x - (t.i + 1) * L), dz = Math.max(t.j * L - W.z, 0, W.z - (t.j + 1) * L);
      if (Math.max(dx, dz) > C + 2 * L) { trozos.delete(k); fuera.push(...t.arboles.map(a => a.id)); }
      else if (t.hierba && Math.hypot(dx, dz) > medidas.hierba + 2 * L) t.hierba = null;
    }
    return fuera;
  }

  // Las mallas de ahora, alrededor de P (escena): se hacen enteras y se cambian de golpe por las de antes.
  let mallas = [], vivas = [], deArboles = [], centro = null, ocupadoUlt = null, cuenta = null, tapan = new Set();
  const api = { enPie: () => true, alLlegar: null, alIrse: null };
  const cero = new THREE.Matrix4().makeScale(0, 0, 0);
  function poner(P) {
    const nuevas = [], nuevasMallas = [];
    const dist = (e) => Math.hypot(e.x - P.x, e.z - P.z), enCuadro = (e) => Math.abs(e.x - P.x) <= C && Math.abs(e.z - P.z) <= C;
    const H = medidas.hierba;
    let arboles = [], piedras = [], hierba = [], flores = [], matas = [];
    for (const t of trozos.values()) {
      for (const a of t.arboles) if (enCuadro(a)) arboles.push(a);
      for (const e of t.piedras) if (enCuadro(e)) piedras.push(e);
      if (t.hierba) {
        for (const e of t.hierba.hierba) if (dist(e) <= H) hierba.push(e);
        for (const e of t.hierba.flores) if (dist(e) <= H) flores.push(e);
        for (const e of t.hierba.matas) if (dist(e) <= H) matas.push(e);
      }
    }
    // árboles: si hay más de los que aguanta el aparato, se quitan los más lejanos (no al azar: lo de cerca no cambia)
    if (arboles.length > medidas.max) arboles = arboles.sort((a, b) => dist(a) - dist(b)).slice(0, medidas.max);
    // los que llegan, a la tala (antes de mirar si están en pie: su tocón, si se taló, sale de lo guardado)
    const llegan = arboles.filter(a => !a.visto);
    for (const a of llegan) a.visto = true;
    if (llegan.length && api.alLlegar) api.alLlegar(llegan);
    for (const a of deArboles) { a.malla = null; a.instancia = -1; }
    // tres bandas por especie: enteros con sombra, enteros sin sombra y sencillos (sin sombra)
    const banda = (e) => { const d = dist(e); return d < medidas.sombra ? 0 : d < medidas.arbolEntero ? 1 : 2; };
    for (const especie of ESPECIES) {
      for (const b of [0, 1, 2]) {
        const lista = arboles.filter(e => e.especie === especie && banda(e) === b);
        if (!lista.length) continue;
        const mod = b < 2 ? entero[especie] : sencillo[especie];
        const im = new THREE.InstancedMesh(mod.geo, mod.mats, lista.length);
        lista.forEach((e, k) => {
          o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.giro, 0); o.scale.setScalar(e.escala); o.updateMatrix();
          // matriz: la de su instancia, guardada ya (la tala y destapar la esconden y la vuelven a poner)
          e.malla = im; e.instancia = k; e.matriz = o.matrix.clone();
          im.setMatrixAt(k, api.enPie(e) ? o.matrix : cero); im.setColorAt(k, c.setScalar(e.tono));
        });
        im.castShadow = b === 0; im.receiveShadow = b < 2; im.name = ['arboles_', 'arbolesMedios_', 'arbolesLejos_'][b] + especie;
        nuevas.push(im);
      }
    }
    // hierba, flores y matas, que se esconden donde se construye (despejar)
    const instancias = (lista, geo, mats, nombre, color, { sombra = false, obst = null, esconder = true } = {}) => {
      if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mats, lista.length), matrices = [];
      lista.forEach((e, k) => {
        o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.giro, 0); o.scale.setScalar(e.tam); o.updateMatrix();
        im.setMatrixAt(k, o.matrix); im.setColorAt(k, color(e)); matrices.push(o.matrix.clone());
      });
      im.castShadow = sombra; im.receiveShadow = true; im.name = nombre; nuevas.push(im);
      if (esconder) nuevasMallas.push({ im, sitios: lista.map(e => [e.x, e.z]), matrices, obst });
    };
    instancias(hierba, pl.mata, material('doble'), 'hierba', e => c.setScalar(e.tono));
    instancias(flores, pl.flor, material('fijo'), 'flores', e => c.set(FLORES[e.color]));
    instancias(matas, pl.matorral.geo, pl.matorral.mats, 'matorrales', e => c.setScalar(e.tono), { sombra: true, obst: matas.map(e => e.ob) });
    // piedras sueltas, del color de la roca del sitio a medias con el gris de las del estilo v5 (la arenisca sola salía
    // anaranjada), hundidas 0,2 m como en el mapa; no se esconden al construir (chocan, como antes)
    instancias(piedras, pl.roca.geo, pl.roca.mats, 'rocas', e => { const k = ROCAS_COLOR[e.roca] || ROCAS_COLOR.caliza, t = (v) => 0.5 * lin(v) / 0.4 + 0.5 * 0.8; return c.setRGB(t(k[0]), t(k[1]), t(k[2])); }, { sombra: true, esconder: false });

    // el cambio: fuera las mallas de antes, dentro las nuevas; en los obstáculos, lo de antes que no es de aquí se queda
    // (las peñas de lo que se recoge, src/juego/recoleccion.js)
    for (const im of vivas) { raiz.remove(im); im.dispose(); }
    for (const im of nuevas) raiz.add(im);
    vivas = nuevas; mallas = nuevasMallas; deArboles = arboles; tapan = new Set(); centro = { x: P.x, z: P.z };
    const otros = obstaculos.filter(q => !q.veg);
    obstaculos.length = 0;
    obstaculos.push(...otros, ...arboles, ...matas.map(e => e.ob), ...piedras.map(e => e.ob));
    if (ocupadoUlt) despejarMallas(mallas, ocupadoUlt);
    cuenta = { ...(cuenta || {}), arboles: arboles.length, especies: Object.fromEntries(ESPECIES.map(e => [e, arboles.filter(a => a.especie === e).length])),
      hierba: hierba.length, flores: flores.length, matas: matas.length, piedras: piedras.length, trozos: trozos.size, puestas: (cuenta?.puestas || 0) + 1 };
  }

  // al empezar, todo de una vez (aún no hay nada que dibujar: la pantalla de «Preparando el paisaje…»)
  const P0 = { x: 0, z: 4 };
  for (const f of faltan(P0)) hacerTrozo(f.i, f.j, f.conHierba);
  poner(P0);
  cuenta.ms = Math.round(performance.now() - t0);

  // En cada fotograma, con P: dónde está el personaje (escena). Devuelve los ms gastados.
  let pendientes = [], desdeP = null, nuevos = false, msMax = 0;
  function paso(P) {
    const t = performance.now();
    if (!desdeP || Math.hypot(P.x - desdeP.x, P.z - desdeP.z) > 4) {
      desdeP = { x: P.x, z: P.z }; pendientes = faltan(P);
      const idos = soltar(P); if (idos.length && api.alIrse) api.alIrse(idos);
    }
    // (deGolpe: solo para romper la prueba a propósito: todos los trozos que faltan en un fotograma)
    while (pendientes.length && (window.__vegetacionDeGolpe || performance.now() - t < MS_FOTOGRAMA)) {
      const f = pendientes.shift(); hacerTrozo(f.i, f.j, f.conHierba); nuevos = true;
    }
    const lejosDe = Math.hypot(P.x - centro.x, P.z - centro.z);
    if (lejosDe > PASO_REHACER || (nuevos && !pendientes.length)) { nuevos = false; poner(P); }
    const ms = performance.now() - t; if (ms > msMax) msMax = ms;
    return ms;
  }

  // Los árboles que quedan entre la cámara y el personaje no se dibujan (si no, en el bosque una copa tapa media
  // pantalla), como en la vista «Como en el juego» del mapa. P: el personaje; C: la cámara; enPie(o): si no está talado.
  function destapar(P, C, enPie = () => true) {
    const vx = C.x - P.x, vz = C.z - P.z, l2 = vx * vx + vz * vz || 1, l = Math.sqrt(l2), ahora = new Set(), cambio = new Set();
    for (const o of deArboles) {
      if (!o.malla) continue;
      const u = ((o.x - P.x) * vx + (o.z - P.z) * vz) / l2;
      if (u * l < -1) continue;                     // también los que están pegados al personaje
      // la distancia al tramo personaje–cámara (si la cámara se ha acercado por una loma, el árbol puede quedar justo
      // detrás de ella con la copa encima); y la altura de la línea donde empieza la copa, no en el tronco: la copa
      // se abre hacia el personaje, donde la línea va más baja (lo vio la prueba en el móvil: un roble de 5,7 m
      // con la línea a 5,8 m en el tronco, y la copa tapando media pantalla)
      const uc = Math.min(1, u), [radio, alto] = TAMANO_ESPECIE[o.especie], copa = o.escala * radio;
      const d = Math.hypot(o.x - P.x - vx * uc, o.z - P.z - vz * uc), un = Math.max(0, Math.min(1, u - copa / l));
      if (d < copa + 1 && o.y + o.escala * alto > P.y + (C.y - P.y) * un - 1) ahora.add(o);
    }
    for (const o of tapan) if (!ahora.has(o) && enPie(o)) { o.malla.setMatrixAt(o.instancia, o.matriz); cambio.add(o.malla); }
    for (const o of ahora) if (!tapan.has(o)) { o.malla.setMatrixAt(o.instancia, cero); cambio.add(o.malla); }
    for (const m of cambio) m.instanceMatrix.needsUpdate = true;
    tapan = ahora;
    return ahora.size;
  }
  return Object.defineProperties(api, Object.getOwnPropertyDescriptors({ raiz, obstaculos, altura: mundoJ.altura, destapar, paso, nivelar,
    despejar: (ocupado) => { ocupadoUlt = ocupado; return despejarMallas(mallas, ocupado); },
    get cuenta() { return cuenta; }, get tapan() { return tapan.size; }, get centro() { return centro; },
    get pendientes() { return pendientes.length; }, get msMax() { return msMax; }, set msMax(v) { msMax = v; } }));
}
