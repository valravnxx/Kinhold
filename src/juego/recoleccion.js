// Kinhold — lo que se recoge del suelo y de las plantas en la demo (nivel N0): ramas caídas, piedra suelta, sílex y
// fibra de ortigas y hierba larga. La lógica (dónde sale, qué da, cuándo vuelve) está en src/logica/recoleccion.js;
// aquí se dibuja con el estilo v5 y se decide qué zonas tiene el terreno de la demo.
//
// Zonas del terreno de la demo (provisional; el mundo generado traerá las suyas):
//  - claro: el llano de hierba antes del bosque (a menos de 25 m del centro).
//  - bosque: entre los árboles (de 30 a 110 m).
//  - ladera: donde empiezan las lomas, pasado el llano (más de 62 m).
//  - caliza: un afloramiento de roca caliza en la ladera del nordeste, con sus peñas claras.
// La demo no tiene ríos ni riberas: allí también saldrían la piedra, el sílex y la fibra cuando haya agua.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex, material } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { Recoleccion, repartirPuntos, RECOLECTABLES, cargarRecoleccion, guardarRecoleccion, ejecutarRecoleccion } from '../logica/recoleccion.js';

export const CALIZA = { x: 50, z: -46, r: 8 }; // el afloramiento calizo (a unos 68 m del centro)

export function zonasDemo(x, z) {
  const d = Math.hypot(x, z), zs = [];
  if (d < 25) zs.push('claro');
  if (d > 30 && d < 110) zs.push('bosque');
  if (d > 62) zs.push('ladera');
  if (Math.hypot(x - CALIZA.x, z - CALIZA.z) < CALIZA.r) zs.push('caliza');
  return zs;
}

// ---------- Modelos (estilo v5: texturas por código, color por vértice, sombra de contacto) ----------
const PIEL_SILEX = 0xcfc6b0, NUCLEO_SILEX = 0x3e3b3c, CALIZA_COLOR = 0xbcb4a0, ORTIGA = 0x4a6436, ORTIGA_OSC = 0x3d5530;

function geoLote(fn, opc = {}) { // un modelo por tipo de textura: [{ geo, mat }]
  const L = new Lote({ rangoSuelo: opc.rangoSuelo ?? 0.25, variacion: 0.08 }); fn(L);
  const grupos = L.cerrar(null, true);
  return Object.entries(grupos).map(([tex, geos]) => ({ geo: mergeGeometries(geos), mat: opc.doble ? material('doble') : materialTex(tex) }));
}
// rama curvada: tramos de cilindro que siguen una curva suave, con dos ramitas
function rama(L, largo, grosor, x, z, giro, semilla) {
  const tramos = 4, puntos = [];
  for (let i = 0; i <= tramos; i++) {
    const t = i / tramos;
    puntos.push(new THREE.Vector3(t * largo - largo / 2, grosor * 0.9 + Math.sin(t * 3 + semilla) * 0.03, Math.sin(t * 2.2 + semilla) * 0.09 * largo));
  }
  const m = new THREE.Matrix4().makeRotationY(giro).setPosition(x, 0, z), eje = new THREE.Vector3(0, 1, 0);
  const tramo = (a, b, r1, r2) => {
    const d = new THREE.Vector3().subVectors(b, a), l = d.length();
    const g = cil(r2, r1, l, 5); const q = new THREE.Quaternion().setFromUnitVectors(eje, d.normalize());
    const mm = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1)).premultiply(m);
    const pos = new THREE.Vector3().setFromMatrixPosition(mm); mm.setPosition(0, 0, 0); // Lote.add pone la posición aparte
    L.add(g, 'corteza', pos.x, pos.y, pos.z, mm);
  };
  for (let i = 0; i < tramos; i++) tramo(puntos[i], puntos[i + 1], grosor * (1 - i * 0.15), grosor * (1 - (i + 1) * 0.15));
  // ramitas
  for (const [i, s] of [[1, 1], [3, -1]]) {
    const a = puntos[i], b = a.clone().add(new THREE.Vector3(0.18, 0.02, 0.16 * s).multiplyScalar(largo * 0.6));
    tramo(a, b, grosor * 0.45, grosor * 0.25);
  }
}
let cache = null;
export function modelosRecoleccion() {
  if (cache) return cache;
  const ramas = geoLote(L => { rama(L, 1.15, 0.035, 0, 0, 0.2, 1); rama(L, 0.9, 0.028, 0.05, 0.12, -0.5, 2); rama(L, 0.7, 0.022, -0.1, -0.1, 1.2, 3); }, { rangoSuelo: 0.12 });
  const piedra = geoLote(L => {
    L.add(new THREE.IcosahedronGeometry(0.14, 1), 'piedra', 0, 0.07, 0, { y: 0.4 }, { escala: new THREE.Vector3(1.25, 0.72, 1), plano: true });
  }, { rangoSuelo: 0.12 });
  const silex = geoLote(L => { // nódulo de corteza blanquecina con una cara rota que deja ver el sílex oscuro
    L.add(new THREE.IcosahedronGeometry(0.11, 1), PIEL_SILEX, 0, 0.08, 0, { y: 0.3, z: 0.2 }, { escala: new THREE.Vector3(1.3, 0.8, 1), plano: true, tex: 'piedra' });
    L.add(new THREE.IcosahedronGeometry(0.08, 0), NUCLEO_SILEX, 0.065, 0.09, 0.01, { y: 0.9, z: 0.5 }, { escala: new THREE.Vector3(0.8, 0.95, 0.95), plano: true, sinSuelo: true, tex: 'piedra' });
    L.add(new THREE.IcosahedronGeometry(0.07, 1), PIEL_SILEX, -0.17, 0.04, 0.09, { y: 2 }, { escala: new THREE.Vector3(1.2, 0.7, 1), plano: true, tex: 'piedra' });
  }, { rangoSuelo: 0.08 });
  // ortigas: tallos rectos con hojas opuestas, dentadas y apuntadas, de verde oscuro
  const hojaOrtiga = (() => {
    const s = new THREE.Shape(); s.moveTo(0, 0);
    const pts = [[0.022, 0.012], [0.03, 0.03], [0.026, 0.05], [0.032, 0.062], [0.02, 0.08], [0.016, 0.1], [0, 0.125]];
    for (const [x, y] of pts) s.lineTo(x, y);
    for (const [x, y] of pts.slice(0, -1).reverse()) s.lineTo(-x, y);
    s.lineTo(0, 0);
    return new THREE.ShapeGeometry(s);
  })();
  const ortiga = geoLote(L => {
    for (let k = 0; k < 11; k++) {
      const a = k * 2.4, d = 0.04 + (k % 4) * 0.06, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.6 + (k % 3) * 0.16;
      L.add(cil(0.006, 0.009, h, 4), ORTIGA_OSC, x, h / 2, z);
      for (let n = 0; n < 5; n++) {
        const y = h * (0.25 + n * 0.15), giro = a + n * Math.PI / 2, esc = 1.5 - n * 0.2;
        for (const lado of [0, Math.PI]) L.add(hojaOrtiga, n % 2 ? ORTIGA : ORTIGA_OSC, x, y, z, new THREE.Matrix4().makeRotationY(giro + lado).multiply(new THREE.Matrix4().makeRotationX(-1.0)), { escala: new THREE.Vector3(esc, esc, esc), sinSuelo: n > 0 });
      }
      L.add(hojaOrtiga, ORTIGA, x, h, z, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(-0.3)), { escala: new THREE.Vector3(0.6, 0.6, 0.6), sinSuelo: true });
    }
  }, { doble: true, rangoSuelo: 0.2 });
  // hierba larga: mata alta de hojas finas que se doblan, con espigas pajizas
  const hierbaLarga = geoLote(L => {
    for (let k = 0; k < 40; k++) {
      const a = k * 2.399, d = 0.02 + (k % 6) * 0.03, h = 0.7 + ((k * 7) % 5) * 0.1;
      const g = new THREE.ConeGeometry(0.012, h, 3, 3); g.translate(0, h / 2, 0);
      const p = g.attributes.position; // se dobla hacia fuera con la altura
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), f = (y / h) ** 2 * 0.22 * h; p.setX(i, p.getX(i) + f); }
      L.add(g, k % 3 ? 'hierbaClara' : 'hierba', Math.cos(a) * d, 0, Math.sin(a) * d, { y: -a }, { brillo: 1.05 });
      if (k % 4 === 0) L.add(new THREE.CylinderGeometry(0.012, 0.005, 0.14, 4), 0xb7a676, Math.cos(a) * d, h * 1.02, Math.sin(a) * d, { y: -a, z: -0.25 }, { sinSuelo: true });
    }
  }, { doble: true, rangoSuelo: 0.3 });
  // peña de caliza del afloramiento (decorado, no se recoge)
  const pena = geoLote(L => L.add(new THREE.IcosahedronGeometry(1, 1), CALIZA_COLOR, 0, 0.35, 0, null, { escala: new THREE.Vector3(1.4, 0.8, 1.05), plano: true, tex: 'piedra' }), { rangoSuelo: 0.8 });
  return (cache = { ramas, piedra, silex, ortiga, hierba_larga: hierbaLarga, pena });
}

const CERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Crea los puntos de recogida de la demo y sus mallas. altura(x, z): el terreno. obstaculos: troncos y rocas (para no
// ponerlos dentro) — las peñas del afloramiento se añaden a la lista. almacen: localStorage (o null).
export function crearRecoleccion({ raiz, altura, obstaculos, almacen, semilla = 11 }) {
  const libre = (x, z) => !obstaculos.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + 0.4) ** 2) && Math.hypot(x, z - 4) > 2.5;
  // peñas de caliza (antes de repartir, para no poner nada dentro)
  const penas = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3 + 0.4, d = (i % 3 + 0.5) * CALIZA.r * 0.3, x = CALIZA.x + Math.cos(a) * d, z = CALIZA.z + Math.sin(a) * d, s = 0.5 + (i * 37 % 10) / 14;
    penas.push([x, z, s, a]); obstaculos.push({ x, z, r: s * 1.2 });
  }
  const puntos = [
    ...repartirPuntos({ semilla, cuantos: { ramas: 30, piedra: 14, ortiga: 10, hierba_larga: 12 }, zonas: zonasDemo, radio: 100, libre }),
    ...repartirPuntos({ semilla, cuantos: { silex: 8, piedra: 0 }, zonas: zonasDemo, radio: CALIZA.r, cx: CALIZA.x, cz: CALIZA.z, libre }),
  ];
  const rec = new Recoleccion(puntos);
  if (almacen) cargarRecoleccion(almacen, rec);
  const grupo = new THREE.Group(); grupo.name = 'recoleccion'; raiz.add(grupo);
  const mods = modelosRecoleccion(), o = new THREE.Object3D();
  // las peñas
  for (const { geo, mat } of mods.pena) {
    const im = new THREE.InstancedMesh(geo, mat, penas.length);
    penas.forEach(([x, z, s, a], i) => { o.position.set(x, altura(x, z) - 0.15 * s, z); o.rotation.set(0, a, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = im.receiveShadow = true; im.name = 'caliza'; grupo.add(im);
  }
  // una malla instanciada por tipo y textura; cada punto, su ejemplar
  const mallas = [];
  for (const tipo of Object.keys(RECOLECTABLES)) {
    const lista = puntos.filter(p => p.tipo === tipo); if (!lista.length) continue;
    for (const { geo, mat } of mods[tipo]) {
      const im = new THREE.InstancedMesh(geo, mat, lista.length), matrices = [];
      lista.forEach((p, i) => { o.position.set(p.x, altura(p.x, p.z) - 0.01, p.z); o.rotation.set(0, p.giro, 0); o.scale.setScalar(0.9 + (i % 4) * 0.08); o.updateMatrix(); matrices.push(o.matrix.clone()); im.setMatrixAt(i, o.matrix); });
      im.castShadow = tipo !== 'hierba_larga'; im.receiveShadow = true; im.name = 'recoger_' + tipo; grupo.add(im);
      mallas.push({ im, lista, matrices });
    }
  }
  let ocupado = () => false;
  const visible = (p, ahora) => rec.disponible(p.id, ahora) && !ocupado(p.x, p.z);
  function refrescar(ahora = Date.now()) {
    for (const { im, lista, matrices } of mallas) {
      lista.forEach((p, i) => im.setMatrixAt(i, visible(p, ahora) ? matrices[i] : CERO));
      im.instanceMatrix.needsUpdate = true;
    }
  }
  refrescar();
  // vuelve a salir lo que toca (por tiempo transcurrido): se mira cada pocos segundos
  let ultimo = 0;
  return {
    rec, puntos, grupo,
    paso() { const t = Date.now(); if (t - ultimo > 5000) { ultimo = t; refrescar(t); } },
    // donde se construye no se recoge (queda debajo): ocupado(x, z) como el del decorado
    despejar(fn) { ocupado = fn; refrescar(); },
    // el punto disponible más cercano a (x, z) a menos de dist m
    cercano(x, z, dist = 1.6, ahora = Date.now()) { return rec.cercanos(x, z, ahora, dist).find(p => !ocupado(p.x, p.z)) || null; },
    // todos los disponibles a menos de dist m, del más cercano al más lejano (para el menú de Usar)
    cercanos(x, z, dist = 1.6, ahora = Date.now()) { return rec.cercanos(x, z, ahora, dist).filter(p => !ocupado(p.x, p.z)); },
    // recoger con autor; lo guarda en el navegador y esconde el punto
    recoger(invs, registro, autor, punto, x, z, ahora = Date.now()) {
      const r = ejecutarRecoleccion(rec, invs, registro, { autor, tipo: 'recoger', punto, x, z }, ahora);
      if (r.ok) { if (almacen) guardarRecoleccion(almacen, rec); refrescar(ahora); }
      return r;
    },
    refrescar,
  };
}
