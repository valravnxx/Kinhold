// Kinhold — lo que crece en el mundo de verdad, dibujado: los árboles de las siete especies (src/mundo/especies.js), la
// hierba, las flores, los matorrales y las piedras, con el estilo v5 y en su sitio de siempre (dónde va cada cosa lo
// dice la lógica, src/logica/vegetacion.js, con el azar de su celda del mundo). Sustituye en el mundo al decorado del
// llano (src/mundo/decorado.js), que ponía pinos y árboles de copa al azar en anillos alrededor de la salida.
//
// Devuelve lo mismo que crearDecorado: { raiz, obstaculos, altura, despejar }. Los árboles son obstáculos que se talan
// (src/juego/tala.js): llevan su especie, su tamaño, su edad, su malla y su número en ella.
import * as THREE from 'three';
import { modelosPlantas, despejarMallas } from './decorado.js';
import { modelosEspecies, ESPECIES, radioTronco, tamanoArbol } from './especies.js';
import { naturaleza, hayNaturaleza, detalleNaturaleza } from './naturaleza_meshy.js';
import { material } from './estilos.js';
import { ROCAS_COLOR, lin } from './color_suelo.js';
import { vegetacionTrozo, LADO_VEG, TAM_ADULTO, CLARO_ARBOLES } from '../logica/vegetacion.js';
export { TAM_ADULTO };
import { idArbol } from '../logica/tala.js';
import { idMata, idRoca, rompible } from '../logica/recoleccion.js';
import { alturaMundo } from '../logica/whitholm.js';
import { aplicar, marcasEn, caja } from '../logica/nivelado.js';

// Medidas (decisión provisional del 30 oct): árboles y piedras en un cuadro de 400 m alrededor del jugador (260 m en
// el móvil); hierba, flores y matas en un círculo de 45 m (32 m en el móvil); los árboles enteros hasta 60 m (45 m) y
// más allá con la forma sencilla; solo echan sombra los de menos de 40 m (30 m); un claro de 8 m sin árboles en el sitio
// de salida (y de 3 m sin nada más) para no aparecer dentro de un tronco ni con la cámara metida en una copa. Con dos
// páginas a la vez en la máquina de pruebas (sin tarjeta gráfica), más que esto no daba abasto.
const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
export const MEDIDAS_VEGETACION = movil ? { cuadro: 130, hierba: 32, arbolEntero: 45, sombra: 30, max: 1200 } : { cuadro: 200, hierba: 45, arbolEntero: 60, sombra: 40, max: 3000 };
const CLARO = 3;   // (el de los árboles, CLARO_ARBOLES, y TAM_ADULTO están en la lógica: el servidor saca los mismos árboles)
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
  const jovenE = modelosEspecies({ joven: true }), jovenS = modelosEspecies({ joven: true, sencillo: true });
  // con los de Meshy (src/mundo/naturaleza_meshy.js), una banda más: los de cerca con su textura, los de media distancia
  // con el color en los vértices y menos triángulos (si no, de 60 m para dentro eran cientos de árboles de 8000)
  const meshy = hayNaturaleza(), medio = meshy ? modelosEspecies({ nivel: 'medio' }) : entero, jovenM = meshy ? modelosEspecies({ nivel: 'medio', joven: true }) : jovenE;
  // hasta dónde va cada modelo: según el perfil gráfico (src/posprocesado/perfiles.js, «naturaleza»), que el juego pone
  // con ponerDetalleNaturaleza; sin él, 16 m en el móvil y 24 en PC, y sin el de más detalle
  // (se mira otra vez en cada poner: el perfil puede cambiar en juego y los de más detalle llegan después)
  let CERCA, ALTO, alto, jovenA;
  const mirarDetalle = () => {
    const det = detalleNaturaleza(); CERCA = meshy ? (det.cerca ?? (movil ? 16 : 24)) : medidas.sombra; ALTO = meshy ? det.alto : 0;
    alto = ALTO ? modelosEspecies({ nivel: 'alto' }) : entero; jovenA = ALTO ? modelosEspecies({ nivel: 'alto', joven: true }) : jovenE;
  };
  mirarDetalle();
  const M = (n) => naturaleza(n);   // las plantas y las rocas de Meshy (null: las de código)

  // Los trozos hechos: clave → { i, j, arboles (obstáculos), piedras, hierba? { hierba, flores, matas } }
  const trozos = new Map(), clave = (i, j) => i + ',' + j;
  function hacerTrozo(i, j, conHierba) {
    const v = vegetacionTrozo(pai, altW, semilla, i, j, conHierba);
    let t = trozos.get(clave(i, j));
    if (!t) {
      t = { i, j, hierba: null };
      t.arboles = v.arboles.map(esc).filter(e => lejos(e, CLARO_ARBOLES)).map(e => ({ x: e.x, z: e.z, y: e.y - 0.2,
        r: radioTronco(e) * e.tam + 0.1, arbol: true, veg: true, especie: e.especie, modelo: e.especie, escala: e.tam,
        edad: e.edad, giro: e.giro, tono: e.tono, id: idArbol(e.x, e.z), malla: null, instancia: -1, matriz: null }));
      t.piedras = v.piedras.map(esc).filter(e => lejos(e, CLARO)).map(e => ({ ...e, y: e.y - (e.canto ? e.tam * 0.35 : 0.2), ob: e.canto && e.tam < 0.45 ? null : { x: e.x, z: e.z, r: e.tam * 1.1, veg: true, canto: !!e.canto },
        id: !e.canto && rompible(e.tam) ? idRoca(e.x, e.z) : null }));   // (las medianas se rompen con el mazo: su nombre, por su sitio)   // (los cantos del río, medio hundidos; los pequeños no estorban)
      trozos.set(clave(i, j), t);
      for (const e of [...t.arboles, ...t.piedras]) e.yb = e.y;
      alNivel([...t.arboles, ...t.piedras], cajaTrozo(i, j));
    }
    if (conHierba && !t.hierba) {
      const fuera = (l) => l.map(esc).filter(e => lejos(e, CLARO));
      t.hierba = { hierba: fuera(v.hierba), flores: fuera(v.flores), matas: fuera(v.matas).map(e => ({ ...e, id: idMata(e.x, e.z), ob: { x: e.x, z: e.z, r: 0.55 * e.tam, mata: true, veg: true } })) };
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
  const api = { enPie: () => true, mataEnPie: () => true, rocaEnPie: () => true, alLlegar: null, alIrse: null, hierbaDensa: false };   // (mataEnPie(id): si no está desbrozada; rocaEnPie(id): si no está rota)
  const cero = new THREE.Matrix4().makeScale(0, 0, 0);
  function poner(P) {
    mirarDetalle();
    const nuevas = [], nuevasMallas = [];
    const dist = (e) => Math.hypot(e.x - P.x, e.z - P.z), enCuadro = (e) => Math.abs(e.x - P.x) <= C && Math.abs(e.z - P.z) <= C;
    const H = medidas.hierba;
    let arboles = [], piedras = [], hierba = [], flores = [], matas = [], cascotes = [];
    for (const t of trozos.values()) {
      for (const a of t.arboles) if (enCuadro(a)) arboles.push(a);
      for (const e of t.piedras) if (enCuadro(e)) { if (!e.id || api.rocaEnPie(e.id)) piedras.push(e); else cascotes.push(...cascotesDe(e)); }
      if (t.hierba) {
        for (const e of t.hierba.hierba) if (dist(e) <= H) hierba.push(e);
        for (const e of t.hierba.flores) if (dist(e) <= H) flores.push(e);
        for (const e of t.hierba.matas) if (dist(e) <= H && api.mataEnPie(e.id)) matas.push(e);
      }
    }
    // árboles: si hay más de los que aguanta el aparato, se quitan los más lejanos (no al azar: lo de cerca no cambia)
    if (arboles.length > medidas.max) arboles = arboles.sort((a, b) => dist(a) - dist(b)).slice(0, medidas.max);
    // los que llegan, a la tala (antes de mirar si están en pie: su tocón, si se taló, sale de lo guardado)
    const llegan = arboles.filter(a => !a.visto);
    for (const a of llegan) a.visto = true;
    if (llegan.length && api.alLlegar) api.alLlegar(llegan);
    for (const a of deArboles) { a.malla = null; a.instancia = -1; }
    // bandas por especie: los de cerca (con sombra), enteros con sombra, enteros sin sombra y sencillos (sin sombra); con
    // los de Meshy, la banda de los de cerca es la única con textura y las dos siguientes van con el modelo «medio»
    const banda = (e) => { const d = dist(e); return d < ALTO ? 4 : d < CERCA ? 3 : d < medidas.sombra ? 0 : d < medidas.arbolEntero ? 1 : 2; };
    // (y cada especie, en jóvenes y adultos: el joven tiene su propio modelo, src/mundo/especies.js)
    for (const especie of ESPECIES) for (const joven of [false, true]) {
      for (const b of [4, 3, 0, 1, 2]) {
        const lista = arboles.filter(e => e.especie === especie && (e.edad === 'joven') === joven && banda(e) === b);
        if (!lista.length) continue;
        const mod = (b === 4 ? (joven ? jovenA : alto) : b === 3 ? (joven ? jovenE : entero) : b < 2 ? (joven ? jovenM : medio) : (joven ? jovenS : sencillo))[especie];
        const im = new THREE.InstancedMesh(mod.geo, mod.mats, lista.length);
        lista.forEach((e, k) => {
          o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.giro, 0); o.scale.setScalar(e.escala); o.updateMatrix();
          // matriz: la de su instancia, guardada ya (la tala y destapar la esconden y la vuelven a poner)
          e.malla = im; e.instancia = k; e.matriz = o.matrix.clone();
          im.setMatrixAt(k, api.enPie(e) ? o.matrix : cero); im.setColorAt(k, c.setScalar(e.tono));
        });
        im.castShadow = b === 0 || b >= 3; im.receiveShadow = b < 2 || b >= 3; im.name = ['arboles_', 'arbolesMedios_', 'arbolesLejos_', 'arbolesCerca_', 'arbolesAlto_'][b] + especie + (joven ? '_joven' : '');
        nuevas.push(im);
      }
    }
    // hierba, flores y matas, que se esconden donde se construye (despejar)
    const instancias = (lista, geo, mats, nombre, color, { sombra = false, obst = null, esconder = true, subir = null } = {}) => {
      if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mats, lista.length), matrices = [];
      lista.forEach((e, k) => {
        o.position.set(e.x, e.y + (subir ? subir(e) : 0), e.z); o.rotation.set(0, e.giro, 0); o.scale.setScalar(e.tam); o.updateMatrix();
        im.setMatrixAt(k, o.matrix); im.setColorAt(k, color(e)); matrices.push(o.matrix.clone());
      });
      im.castShadow = sombra; im.receiveShadow = true; im.name = nombre; nuevas.push(im);
      if (esconder) nuevasMallas.push({ im, sitios: lista.map(e => [e.x, e.z]), matrices, obst });
    };
    // (con los de Meshy: la hierba y las flores, en su versión de media distancia, que son miles; las flores llevan su
    // color y se tiñen solo un poco del de cada una)
    const hM = M('hierba'), fM = M('flores'), mM = M('matorral'), blanco = new THREE.Color(1, 1, 1);
    const HC = movil ? 7 : 10;   // (la hierba de Meshy, que son miles: la de cerca entera, la de más allá con muy pocos triángulos)
    // (con la hierba densa puesta, src/mundo/hierba_densa.js, las briznas sueltas de antes sobran)
    if (api.hierbaDensa) { /* nada */ }
    else if (hM) { instancias(hierba.filter(e => dist(e) < HC), hM.cerca.geo, hM.cerca.mats, 'hierbaCerca', e => c.setScalar(e.tono)); instancias(hierba.filter(e => dist(e) >= HC), hM.lejos.geo, hM.lejos.mats, 'hierba', e => c.setScalar(e.tono)); }
    else instancias(hierba, pl.mata, material('doble'), 'hierba', e => c.setScalar(e.tono));
    if (fM) { instancias(flores.filter(e => dist(e) < HC), fM.cerca.geo, fM.cerca.mats, 'floresCerca', e => c.set(FLORES[e.color]).lerp(blanco, 0.65)); instancias(flores.filter(e => dist(e) >= HC), fM.lejos.geo, fM.lejos.mats, 'flores', e => c.set(FLORES[e.color]).lerp(blanco, 0.65)); }
    else instancias(flores, pl.flor, material('fijo'), 'flores', e => c.set(FLORES[e.color]));
    // (con los de Meshy, una de cada tres matas es una mata de helechos: se desbroza igual)
    const heM = M('helechos'), esHelecho = (e) => heM && (Math.floor(Math.abs(e.x * 7.31 + e.z * 3.17)) % 3 === 0);
    const matasM = matas.filter(e => !esHelecho(e)), helechos = matas.filter(esHelecho);
    // (en los perfiles altos, las de al lado con el modelo de más detalle)
    const matasA = mM && ALTO ? matasM.filter(e => dist(e) < ALTO) : [], matasC = matasA.length ? matasM.filter(e => dist(e) >= ALTO) : matasM;
    instancias(matasC, (mM ? mM.cerca : pl.matorral).geo, (mM ? mM.cerca : pl.matorral).mats, 'matorrales', e => c.setScalar(e.tono), { sombra: true, obst: matasC.map(e => e.ob) });
    if (matasA.length) instancias(matasA, mM.alto.geo, mM.alto.mats, 'matorralesAlto', e => c.setScalar(e.tono), { sombra: true, obst: matasA.map(e => e.ob) });
    if (heM) instancias(helechos, heM.cerca.geo, heM.cerca.mats, 'helechos', e => c.setScalar(e.tono), { sombra: true, obst: helechos.map(e => e.ob), subir: () => 0.03 });
    // piedras sueltas, del color de la roca del sitio a medias con el gris de las del estilo v5 (la arenisca sola salía
    // anaranjada), hundidas 0,2 m como en el mapa; no se esconden al construir (chocan, como antes)
    const colorRoca = e => { const k = ROCAS_COLOR[e.roca] || ROCAS_COLOR.caliza, t = (v) => 0.5 * lin(v) / 0.4 + 0.5 * 0.8; return c.setRGB(t(k[0]), t(k[1]), t(k[2])); };
    // (con los de Meshy: la roca, la peña para las grandes del pedregal y el canto rodado para las del río; tienen su
    // color de piedra y el del sitio solo las tiñe, y van con el pie en el suelo: se suben lo que se hundían las de código)
    const rM = M('roca'), pM = M('pena'), cM = M('canto');
    if (rM) {
      const tinte = e => colorRoca(e).lerp(blanco, 0.45), suben = e => (e.canto ? e.tam * 0.27 : 0.12);
      const grandes = pM ? piedras.filter(e => !e.canto && e.tam >= 1.2) : [], cantos = cM ? piedras.filter(e => e.canto) : [];
      const resto = piedras.filter(e => !grandes.includes(e) && !cantos.includes(e));
      const RC = CERCA;   // (las de más allá, con el modelo de media distancia; las de al lado, en los perfiles altos, con el de más detalle)
      instancias(resto.filter(e => dist(e) < ALTO), rM.alto.geo, rM.alto.mats, 'rocasAlto', tinte, { sombra: true, esconder: false, subir: suben });
      instancias(resto.filter(e => dist(e) >= ALTO && dist(e) < RC), rM.cerca.geo, rM.cerca.mats, 'rocas', tinte, { sombra: true, esconder: false, subir: suben });
      instancias(resto.filter(e => dist(e) >= RC), rM.medio.geo, rM.medio.mats, 'rocasLejos', tinte, { sombra: true, esconder: false, subir: suben });
      if (pM) instancias(grandes, pM.cerca.geo, pM.cerca.mats, 'rocasGrandes', tinte, { sombra: true, esconder: false, subir: suben });
      if (cM) instancias(cantos, cM.cerca.geo, cM.cerca.mats, 'cantos', tinte, { sombra: true, esconder: false, subir: suben });
      instancias(cascotes, rM.medio.geo, rM.medio.mats, 'cascotes', e => tinte(e).multiplyScalar(e.tono), { sombra: true, esconder: false, subir: () => 0.05 });
    } else {
      instancias(piedras, pl.roca.geo, pl.roca.mats, 'rocas', colorRoca, { sombra: true, esconder: false });
      // lo que queda de una roca rota con el mazo (8 nov): un corro de cascotes del color de la roca, sin chocar
      instancias(cascotes, pl.roca.geo, pl.roca.mats, 'cascotes', e => colorRoca(e).multiplyScalar(e.tono), { sombra: true, esconder: false });
    }

    // el cambio: fuera las mallas de antes, dentro las nuevas; en los obstáculos, lo de antes que no es de aquí se queda
    // (las peñas de lo que se recoge, src/juego/recoleccion.js)
    for (const im of vivas) { raiz.remove(im); im.dispose(); }
    for (const im of nuevas) raiz.add(im);
    vivas = nuevas; mallas = nuevasMallas; deArboles = arboles; tapan = new Set(); centro = { x: P.x, z: P.z };
    const otros = obstaculos.filter(q => !q.veg);
    obstaculos.length = 0;
    obstaculos.push(...otros, ...arboles, ...matas.map(e => e.ob), ...piedras.map(e => e.ob).filter(Boolean));
    if (ocupadoUlt) despejarMallas(mallas, ocupadoUlt);
    cuenta = { ...(cuenta || {}), arboles: arboles.length, especies: Object.fromEntries(ESPECIES.map(e => [e, arboles.filter(a => a.especie === e).length])),
      jovenes: arboles.filter(a => a.edad === 'joven').length,
      hierba: hierba.length, flores: flores.length, matas: matas.length, piedras: piedras.length, trozos: trozos.size, puestas: (cuenta?.puestas || 0) + 1 };
  }

  // Los cascotes de una roca rota: de 7 a 9 trozos de un azar fijo por su nombre, por donde estaba, a ras de suelo.
  function cascotesDe(e) {
    let h = 0; for (const ch of e.id) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0;
    const r = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h / 4294967296; };
    const n = 7 + Math.floor(r() * 3), R = e.tam * 1.05, l = [];
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, tam = e.tam * (0.09 + r() * 0.13);
      l.push({ x: e.x + Math.cos(a) * d, z: e.z + Math.sin(a) * d, y: e.y + 0.2 - tam * 0.25, tam, giro: r() * 6.3, roca: e.roca, tono: 0.82 + r() * 0.2 });
    }
    return l;
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
      const uc = Math.min(1, u), [radio, alto] = tamanoArbol(o), copa = o.escala * radio;
      const d = Math.hypot(o.x - P.x - vx * uc, o.z - P.z - vz * uc), un = Math.max(0, Math.min(1, u - copa / l));
      if (d < copa + 1 && o.y + o.escala * alto > P.y + (C.y - P.y) * un - 1) ahora.add(o);
    }
    for (const o of tapan) if (!ahora.has(o) && enPie(o)) { o.malla.setMatrixAt(o.instancia, o.matriz); cambio.add(o.malla); }
    for (const o of ahora) if (!tapan.has(o)) { o.malla.setMatrixAt(o.instancia, cero); cambio.add(o.malla); }
    for (const m of cambio) m.instanceMatrix.needsUpdate = true;
    tapan = ahora;
    return ahora.size;
  }
  // Las matas en pie a menos de d m de (x, z), de la más cercana a la más lejana (desbrozar, 8 nov); y rehacer las
  // mallas donde se estaba (cuando se desbroza una o rebrota).
  const matasCerca = (x, z, d = 1.6) => {
    const r = [];
    for (const t of trozos.values()) if (t.hierba) for (const e of t.hierba.matas) if (Math.hypot(e.x - x, e.z - z) <= d && api.mataEnPie(e.id) && !(e.ob && e.ob.oculto)) r.push(e);
    return r.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  };
  // Las rocas que se rompen, en pie, a menos de d m de su borde (romper rocas, 8 nov), de la más cercana a la más lejana.
  const rocasCerca = (x, z, d = 1.2) => {
    const r = [], borde = e => Math.hypot(e.x - x, e.z - z) - e.tam * 1.1;
    for (const t of trozos.values()) for (const e of t.piedras) if (e.id && borde(e) <= d && api.rocaEnPie(e.id)) r.push(e);
    return r.sort((a, b) => borde(a) - borde(b));
  };
  const rehacer = () => { if (centro) poner(centro); };
  // (pruebas y capturas: lo que crece en un trozo del mundo, en metros de la escena, para buscar una especie lejos)
  const trozoEscena = (i, j) => { const v = vegetacionTrozo(pai, altW, semilla, i, j); return { arboles: v.arboles.map(esc), piedras: v.piedras.map(esc) }; };
  return Object.defineProperties(api, Object.getOwnPropertyDescriptors({ raiz, obstaculos, altura: mundoJ.altura, destapar, paso, nivelar, matasCerca, rocasCerca, rehacer, trozoEscena, ladoTrozo: L, origen: O,
    despejar: (ocupado) => { ocupadoUlt = ocupado; return despejarMallas(mallas, ocupado); },
    get cuenta() { return cuenta; }, get tapan() { return tapan.size; }, get centro() { return centro; },
    get pendientes() { return pendientes.length; }, get msMax() { return msMax; }, set msMax(v) { msMax = v; } }));
}
