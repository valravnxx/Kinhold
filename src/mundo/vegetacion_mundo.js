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
import { vegetacionEn } from '../logica/vegetacion.js';
import { alturaMundo } from '../logica/whitholm.js';

// Medidas (decisión provisional del 30 oct): árboles y piedras en un cuadro de 400 m alrededor de la salida (260 m en
// el móvil); hierba, flores y matas en un círculo de 60 m (40 m en el móvil); los árboles a más de 80 m (60 m), con la
// forma sencilla; un claro de 8 m sin árboles en el sitio de salida (y de 3 m sin nada más) para no aparecer dentro de
// un tronco ni con la cámara metida en una copa.
const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
export const MEDIDAS_VEGETACION = movil ? { cuadro: 130, hierba: 40, arbolEntero: 60, max: 1600 } : { cuadro: 200, hierba: 60, arbolEntero: 80, max: 4000 };
const CLARO_ARBOLES = 8, CLARO = 3;
export const TAM_ADULTO = 0.95;     // desde este tamaño (1 = adulto normal de su especie), el árbol es adulto al talarlo
const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];

// mundoJ: el mundo del juego (src/mundo/mundo_juego.js). semilla: la del mapa.
export function crearVegetacionMundo({ mundoJ, semilla, medidas = MEDIDAS_VEGETACION }) {
  const t0 = performance.now();
  // la altura exacta (no la de la malla que ya haya llegado): así sale lo mismo esté o no cargado el suelo
  const O = mundoJ.salida, y0 = mundoJ.y0, altW = alturaMundo(mundoJ.paisaje);
  const C = medidas.cuadro;
  const v = vegetacionEn(mundoJ.paisaje, altW, semilla, { x0: O.x - C, z0: O.z - C, x1: O.x + C, z1: O.z + C },
    { x: O.x, z: O.z, r: medidas.hierba });
  const raiz = new THREE.Group(); raiz.name = 'decorado';
  const obstaculos = [], mallas = [], o = new THREE.Object3D(), c = new THREE.Color();
  // a la escena: relativo a la salida, y la altura desde su suelo
  const esc = (e) => ({ ...e, x: e.x - O.x, z: e.z - O.z, y: e.y - y0 });
  const lejos = (e, r) => Math.hypot(e.x, e.z - 2) >= r;   // el personaje empieza en (0, 4): el claro, entre la salida y él

  // árboles: si hay más de los que aguanta el aparato, se quitan los más lejanos (no al azar: lo de cerca no cambia)
  let arboles = v.arboles.map(esc).filter(e => lejos(e, CLARO_ARBOLES));
  if (arboles.length > medidas.max) arboles = arboles.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, medidas.max);
  const entero = modelosEspecies(), sencillo = modelosEspecies({ sencillo: true });
  for (const especie of ESPECIES) {
    for (const cerca of [true, false]) {
      const lista = arboles.filter(e => e.especie === especie && (Math.hypot(e.x, e.z) < medidas.arbolEntero) === cerca);
      if (!lista.length) continue;
      const mod = cerca ? entero[especie] : sencillo[especie];
      const im = new THREE.InstancedMesh(mod.geo, mod.mats, lista.length);
      lista.forEach((e, k) => {
        o.position.set(e.x, e.y - 0.2, e.z); o.rotation.set(0, e.giro, 0); o.scale.setScalar(e.tam); o.updateMatrix();
        im.setMatrixAt(k, o.matrix); im.setColorAt(k, c.setScalar(e.tono));
        // matriz: la de su instancia, guardada ya (la tala y destapar la esconden y la vuelven a poner)
        obstaculos.push({ x: e.x, z: e.z, y: e.y - 0.2, r: RADIO_TRONCO[especie] * e.tam + 0.1, arbol: true, especie, modelo: especie, escala: e.tam,
          edad: e.tam >= TAM_ADULTO ? 'adulto' : 'joven', instancia: k, malla: im, matriz: o.matrix.clone() });
      });
      im.castShadow = cerca; im.receiveShadow = true; im.name = (cerca ? 'arboles_' : 'arbolesLejos_') + especie;
      raiz.add(im);
    }
  }

  // hierba, flores y matas, que se esconden donde se construye (despejar)
  const pl = modelosPlantas();
  const poner = (lista, geo, mats, nombre, color, { sombra = false, obst = null, esconder = true } = {}) => {
    if (!lista.length) return;
    const im = new THREE.InstancedMesh(geo, mats, lista.length), matrices = [];
    lista.forEach((e, k) => {
      o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.giro, 0); o.scale.setScalar(e.tam); o.updateMatrix();
      im.setMatrixAt(k, o.matrix); im.setColorAt(k, color(e)); matrices.push(o.matrix.clone());
    });
    im.castShadow = sombra; im.receiveShadow = true; im.name = nombre; raiz.add(im);
    if (esconder) mallas.push({ im, sitios: lista.map(e => [e.x, e.z]), matrices, obst });
  };
  const fuera = (l) => l.map(esc).filter(e => lejos(e, CLARO));
  poner(fuera(v.hierba), pl.mata, material('doble'), 'hierba', e => c.setScalar(e.tono));
  poner(fuera(v.flores), pl.flor, material('fijo'), 'flores', e => c.set(FLORES[e.color]));
  const matas = fuera(v.matas), obMatas = matas.map(e => ({ x: e.x, z: e.z, r: 0.55 * e.tam, mata: true }));
  poner(matas, pl.matorral.geo, pl.matorral.mats, 'matorrales', e => c.setScalar(e.tono), { sombra: true, obst: obMatas });
  obstaculos.push(...obMatas);

  // piedras sueltas, del color de la roca del sitio a medias con el gris de las del estilo v5 (la arenisca sola salía
  // anaranjada), hundidas 0,2 m como en el mapa;
  // no se esconden al construir (chocan, como antes)
  const piedras = fuera(v.piedras).map(e => ({ ...e, y: e.y - 0.2 }));
  poner(piedras, pl.roca.geo, pl.roca.mats, 'rocas', e => { const k = ROCAS_COLOR[e.roca] || ROCAS_COLOR.caliza, t = (v) => 0.5 * lin(v) / 0.4 + 0.5 * 0.8; return c.setRGB(t(k[0]), t(k[1]), t(k[2])); }, { sombra: true, esconder: false });
  for (const e of piedras) obstaculos.push({ x: e.x, z: e.z, r: e.tam * 1.1 });

  const cuenta = { arboles: arboles.length, especies: Object.fromEntries(ESPECIES.map(e => [e, arboles.filter(a => a.especie === e).length])),
    hierba: v.hierba.length, flores: v.flores.length, matas: matas.length, piedras: piedras.length, ms: Math.round(performance.now() - t0) };

  // Los árboles que quedan entre la cámara y el personaje no se dibujan (si no, en el bosque una copa tapa media
  // pantalla), como en la vista «Como en el juego» del mapa. P: el personaje; C: la cámara; enPie(o): si no está talado.
  const cero = new THREE.Matrix4().makeScale(0, 0, 0), deArboles = obstaculos.filter(o => o.arbol);
  let tapan = new Set();
  function destapar(P, C, enPie = () => true) {
    const vx = C.x - P.x, vz = C.z - P.z, l2 = vx * vx + vz * vz || 1, l = Math.sqrt(l2), ahora = new Set(), cambio = new Set();
    for (const o of deArboles) {
      const u = ((o.x - P.x) * vx + (o.z - P.z) * vz) / l2;
      if (u * l < -1 || u > 1.1) continue;          // también los que están pegados al personaje
      const d = Math.hypot(o.x - P.x - vx * u, o.z - P.z - vz * u), [radio, alto] = TAMANO_ESPECIE[o.especie];
      if (d < o.escala * radio + 1 && o.y + o.escala * alto > P.y + (C.y - P.y) * u - 1) ahora.add(o);
    }
    for (const o of tapan) if (!ahora.has(o) && enPie(o)) { o.malla.setMatrixAt(o.instancia, o.matriz); cambio.add(o.malla); }
    for (const o of ahora) if (!tapan.has(o)) { o.malla.setMatrixAt(o.instancia, cero); cambio.add(o.malla); }
    for (const m of cambio) m.instanceMatrix.needsUpdate = true;
    tapan = ahora;
    return ahora.size;
  }
  return { raiz, obstaculos, altura: mundoJ.altura, despejar: (ocupado) => despejarMallas(mallas, ocupado), destapar, cuenta,
    get tapan() { return tapan.size; } };
}
