// Kinhold — los objetos en el suelo de la demo: lo que se suelta cae a tus pies y se ve donde cae; con Usar se
// coge. La lógica (cuándo desaparece, las pilas, quién lo coge) está en src/logica/suelo.js; aquí se dibuja con el
// estilo v5 (texturas por código, color por vértice, sombra de contacto) y se guarda en el navegador.
//
// Cómo se ve cada cosa (provisional, hasta que cada objeto tenga su modelo):
//  - ramas, piedra y sílex: los mismos modelos que lo que se recoge (src/juego/recoleccion.js); la piedra en montón,
//    más alto cuantas más haya.
//  - troncos y leña: troncos tumbados con su corteza y el corte con anillos, apilados.
//  - el hacha de mano: el modelo de la mano, tumbada.
//  - lo que piden y dan las recetas de P3 (fibra, juncos, mimbre, piel, resina, cordel, cuerda, honda, odre, nasa,
//    trampa, cubo, hacha de piedra…): su modelo, en src/juego/modelos_objetos.js.
//  - lo demás (bayas, ropa, mochilas…): un hatillo de lino atado, más grande si es grande.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { modelosRecoleccion } from './recoleccion.js';
import { modeloHacha } from './personaje.js';
import { modeloRastra } from './rastra.js';
import { modeloCarretilla } from './carretilla.js';
import { Suelo, cargarSuelo, guardarSuelo, ejecutarSuelo } from '../logica/suelo.js';
import { CATALOGO } from '../logica/inventario.js';
import { MODELO_OBJETO } from './modelos_objetos.js';
import { crearModeloLanza, crearLiebreMuerta } from './fauna.js';

const mallas = L => {
  const grupos = L.cerrar(null, true), g = new THREE.Group();
  for (const [tex, geos] of Object.entries(grupos)) {
    const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m);
  }
  return g;
};
export const deLista = lista => { const g = new THREE.Group(); for (const { geo, mat } of lista) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); } return g; };

// azar fijo por objeto (para que el montón no cambie al redibujar)
const az = (id, k) => { let h = 2166136261; for (const ch of id + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };

// Troncos tumbados en pirámide (la fila de abajo con más), con un disco de anillos en cada punta.
export function troncosConCortes(n, largo, radio, id) {
  const L = new Lote({ rangoSuelo: radio * 3, variacion: 0.07 });
  const vis = Math.min(n, 10), base = Math.ceil((Math.sqrt(8 * vis + 1) - 1) / 2);
  let puestos = 0;
  for (let fila = 0; puestos < vis; fila++) {
    const cuantos = Math.min(base - fila, vis - puestos);
    for (let i = 0; i < cuantos; i++) {
      const z = (i - (cuantos - 1) / 2) * radio * 2.05, y = radio + fila * radio * 1.75, dx = (az(id, puestos) - 0.5) * largo * 0.1;
      const g = (az(id, puestos + 50) - 0.5) * 0.08;
      const m = new THREE.Matrix4().makeRotationY(g).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      L.add(cil(radio, radio * 1.04, largo, 9), 'corteza', dx, y, z, m);
      for (const s of [-1, 1]) {
        const mc = new THREE.Matrix4().makeRotationY(g + s * Math.PI / 2);
        L.add(new THREE.CircleGeometry(radio * 0.97, 9), 'corte', dx + Math.cos(g) * s * (largo / 2 + 0.002), y, z - Math.sin(g) * s * (largo / 2 + 0.002), mc, { sinSuelo: true });
      }
      puestos++;
    }
  }
  return mallas(L);
}

// Varas (las del árbol joven al talarlo, 7 nov): palos rectos de 1,6 m (como la vara de la mano), algo más finos en la
// punta, tumbados a lo largo de X casi en paralelo y un poco abiertos; de 4 en adelante, alguna cruzada encima.
export function varasEnSuelo(n, id) {
  const L = new Lote({ rangoSuelo: 0.06, variacion: 0.07 });
  const vis = Math.min(n, 8), largo = 1.6;
  for (let i = 0; i < vis; i++) {
    const encima = i >= 3 && i % 2 === 1, r = 0.017 + az(id, i + 70) * 0.006;
    const z = encima ? (az(id, i + 80) - 0.5) * 0.12 : (i - Math.min(vis, 3) / 2) * 0.055 + (az(id, i) - 0.5) * 0.02;
    const y = r + (encima ? 0.038 : 0), dx = (az(id, i + 20) - 0.5) * 0.25, g = (az(id, i + 50) - 0.5) * (encima ? 0.5 : 0.12);
    const m = new THREE.Matrix4().makeRotationY(g).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    L.add(cil(r * 0.75, r, largo, 7), 'madera', dx, y, z, m, { tex: 'veta' });
    for (const sg of [-1, 1]) {
      const rr = sg > 0 ? r * 0.75 : r, mc = new THREE.Matrix4().makeRotationY(g + sg * Math.PI / 2);
      L.add(new THREE.CircleGeometry(rr * 0.95, 7), 'corte', dx + Math.cos(g) * sg * (largo / 2 + 0.002), y, z - Math.sin(g) * sg * (largo / 2 + 0.002), mc, { sinSuelo: true });
    }
  }
  return mallas(L);
}

function hatillo(grande, id) { // un paño de lino con las cuatro puntas atadas arriba: bulto con pliegues y el nudo
  const L = new Lote({ rangoSuelo: 0.2, variacion: 0.06 });
  const s = grande ? 1.6 : 1;
  L.add(new THREE.IcosahedronGeometry(0.16 * s, 1), 'lino', 0, 0.085 * s, 0, { y: az(id, 1) * 6 }, { escala: new THREE.Vector3(1.25, 0.55, 0.95), plano: true });
  for (let k = 0; k < 4; k++) { // las puntas del paño, juntas en el nudo
    const a = k * Math.PI / 2 + 0.4;
    L.add(new THREE.ConeGeometry(0.03 * s, 0.1 * s, 4), 'lino', Math.cos(a) * 0.025 * s, 0.19 * s, Math.sin(a) * 0.025 * s, { z: Math.cos(a) * 0.7, x: -Math.sin(a) * 0.7 }, { sinSuelo: true, plano: true });
  }
  L.add(new THREE.TorusGeometry(0.03 * s, 0.008 * s, 4, 10), 'madera', 0, 0.165 * s, 0, { x: Math.PI / 2 }, { sinSuelo: true, tex: 'liso' }); // la atadura
  return mallas(L);
}

// El modelo de un objeto del suelo ({ id, cosa: { tipo, n } }); también lo depositado en una estación (estaciones.js).
export function modeloDe(o) {
  const t = o.cosa.tipo, n = o.cosa.n, mods = modelosRecoleccion();
  if (t === 'rastra') return modeloRastra(o.cosa.carga || null, o.id);
  if (t === 'carretilla') return modeloCarretilla(o.cosa.carga || null, o.id);
  if (t === 'rama') return deLista(mods.ramas);
  if (t === 'vara') return varasEnSuelo(n, o.id);
  if (t === 'silex') return deLista(mods.silex);
  if (t === 'piedra') { // montón: más ancho y más alto cuantas más
    const g = new THREE.Group(), vis = Math.min(n, 14);
    for (let i = 0; i < vis; i++) {
      const p = deLista(mods.piedra), a = i * 2.4 + az(o.id, i), capa = i < 5 ? 0 : i < 9 ? 1 : 2, r = capa === 2 ? 0.05 : capa ? 0.12 : 0.22;
      p.position.set(Math.cos(a) * r, capa * 0.085, Math.sin(a) * r); p.rotation.y = az(o.id, i + 20) * 6; p.scale.setScalar(0.85 + az(o.id, i + 40) * 0.3);
      g.add(p);
    }
    return g;
  }
  // la caza (9 nov): la lanza tirada en la hierba y la liebre muerta, de lado
  if (t === 'lanza_endurecida') { const g = new THREE.Group(), l = crearModeloLanza(); l.rotation.y = az(o.id, 3) * 6; l.position.y = 0.02; g.add(l); return g; }
  if (t === 'liebre') { const g = new THREE.Group(), l = crearLiebreMuerta(); l.rotation.y = az(o.id, 3) * 6; g.add(l); return g; }
  if (t === 'tronco_corto') return troncosConCortes(n, 0.9, 0.14, o.id);
  if (t === 'tronco_delgado') return troncosConCortes(n, 2.6, 0.09, o.id);
  if (t === 'tronco_largo') return troncosConCortes(n, 4.5, 0.18, o.id);
  if (t === 'lena') return troncosConCortes(Math.ceil(n / 2), 0.45, 0.06, o.id);
  if (Object.hasOwn(MODELO_OBJETO, t)) return MODELO_OBJETO[t](n, o.id); // lo de las recetas de P3 (src/juego/modelos_objetos.js)
  if (t === 'hacha_mano' || t === 'hacha_hierro' || t === 'hacha_piedra') { const h = modeloHacha(); h.rotation.set(Math.PI / 2, 0, az(o.id, 3) * 6); h.position.y = 0.03; const g = new THREE.Group(); g.add(h); return g; }
  const d = CATALOGO[t];
  return hatillo(d && (d.tam === 'G' || d.huecos), o.id);
}

// Crea el suelo de la demo. altura(x, z): el terreno. almacen: localStorage (o null). enTierras(autor, x, z).
export function crearSuelo({ raiz, altura, almacen, enTierras }) {
  const suelo = new Suelo();
  if (almacen) cargarSuelo(almacen, suelo);
  const grupo = new THREE.Group(); grupo.name = 'suelo_objetos'; raiz.add(grupo);
  const vistos = new Map(); // id → { obj, firma }
  const escondidos = new Set(); // ids que aún no se dibujan (lo que deja un árbol mientras cae)
  function refrescar(ahora = Date.now()) {
    const hay = suelo.visibles(ahora).filter(o => !escondidos.has(o.id)), ids = new Set(hay.map(o => o.id));
    for (const [id, v] of vistos) if (!ids.has(id)) { grupo.remove(v.obj); vistos.delete(id); }
    for (const o of hay) {
      const firma = o.cosa.tipo + ':' + o.cosa.n + (o.cosa.carga ? ':' + o.cosa.carga.tipo + o.cosa.carga.n : '') + (o.arrastra ? '@' + o.arrastra : ''), v = vistos.get(o.id);
      if (v && v.firma === firma) { if (!o.arrastra && (v.obj.position.x !== o.x || v.obj.position.z !== o.z)) { v.obj.position.set(o.x, altura(o.x, o.z) - 0.01, o.z); if (Number.isFinite(o.giro)) v.obj.rotation.set(0, o.giro, 0); } continue; }
      if (v) grupo.remove(v.obj);
      const obj = modeloDe(o); obj.position.set(o.x, altura(o.x, o.z) - 0.01, o.z); obj.rotation.y += Number.isFinite(o.giro) ? o.giro : az(o.id, 9) * Math.PI * 2;
      obj.name = 'suelo_' + o.cosa.tipo; obj.userData.id = o.id; obj.userData.arrastra = o.arrastra || null;
      if (v && v.obj.userData.sigue && o.arrastra) obj.userData.sigue = v.obj.userData.sigue;   // la que arrastras no salta al cargarla
      grupo.add(obj); vistos.set(o.id, { obj, firma });
    }
  }
  refrescar();
  const guardarlo = () => { if (almacen) guardarSuelo(almacen, suelo); };
  let ultimo = 0;
  return {
    suelo, grupo,
    // lo que desaparece pasada la hora se quita (por tiempo transcurrido): se mira cada pocos segundos
    paso() { const t = Date.now(); if (t - ultimo > 5000) { ultimo = t; if (suelo.limpiar(t)) guardarlo(); refrescar(t); } },
    cercano(x, z, dist = 1.6, ahora = Date.now()) { return suelo.cercanos(x, z, ahora, dist)[0] || null; },
    cercanos(x, z, dist = 1.6, ahora = Date.now()) { return suelo.cercanos(x, z, ahora, dist); },
    // soltar y coger con autor; se guarda en el navegador y se redibuja
    soltar(invs, registro, autor, de, x, z, cantidad, ahora = Date.now()) {
      const r = ejecutarSuelo(suelo, invs, registro, { autor, tipo: 'soltar_suelo', de, x, z, ...(cantidad ? { cantidad } : {}) }, ahora, enTierras);
      if (r.ok) { guardarlo(); refrescar(ahora); }
      return r;
    },
    // a (opcional): la ruta de lo que llevas donde va (el panel de equipo); sin ella, donde quepa
    coger(invs, registro, autor, objeto, x, z, ahora = Date.now(), a = undefined) {
      const r = ejecutarSuelo(suelo, invs, registro, { autor, tipo: 'coger_suelo', objeto, x, z, ...(a ? { a } : {}) }, ahora, enTierras);
      if (r.ok) { guardarlo(); refrescar(ahora); }
      return r;
    },
    // lo que no cupo al cargar el inventario cae a tus pies
    dejarApartado(inv, autor, x, z, ahora = Date.now()) {
      if (!inv.apartado.length) return 0;
      const n = suelo.dejarApartado(inv, x, z, ahora, autor, !!enTierras(autor, x, z));
      guardarlo(); refrescar(ahora);
      return n;
    },
    esconder(ids) { for (const id of ids) escondidos.add(id); refrescar(); },
    mostrar(ids) { for (const id of ids) escondidos.delete(id); refrescar(); },
    refrescar, guardar: guardarlo,
  };
}
