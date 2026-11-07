// Kinhold — las estaciones de fabricar en el mundo (P3, «De nada a una casa»): la piedra de tallar, la hoguera y el
// banco de tronco, donde se pusieron. La lógica (dónde está cada una, sus colas) es la de src/logica/fabricacion.js; en
// línea, las estaciones las manda el servidor ({ tipo: 'estaciones' }, la bienvenida y los trozos) y aquí solo se
// dibujan, con el estilo v5 (los mismos modelos de piedra, ramas y troncos que lo que se recoge y lo del suelo).
//
// Cómo se ve cada una (provisional, hasta las tareas de la hoguera y del banco de tronco, que traen su modelo propio):
//  - piedra de tallar: una losa ancha y baja, con una piedra de percutir y unas lascas al lado.
//  - hoguera: un círculo de piedras con las ramas apoyadas en el centro. Su fuego (src/logica/fuego.js): encendida,
//    brasas, llamas que se mueven, humo que sube y luz (la pone main.js, con las de las chimeneas); apagada después de
//    arder, las cenizas (y las ramas, solo si tiene algo puesto sin arder).
//  - banco de tronco: dos troncos cortos, uno de pie (el tajo) y otro tumbado al lado.
// Lo depositado en cada una (valravnx, 6 nov) se ve puesto, con los mismos modelos que lo del suelo: encima de la losa
// de la piedra de tallar y del tajo del banco (lo que no cabe encima, al pie); junto a la hoguera, alrededor del
// círculo de piedras. Cada tipo, su montón.
// Los puestos son obra (valravnx, 6 nov): mientras no se levantan, se ven como las obras de construcción (src/juego/
// main.js, «Obras»): el puesto muy tenue, como un trazado, dentro de un armazón de varas atadas (cuatro estacas con
// dos vueltas de cordel), y lo que ya se le ha llevado, al pie, en su montón. Cuanto más trabajo lleva, menos tenue.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { modelosRecoleccion } from './recoleccion.js';
import { limpiarDeposito, limpiarObra, ESTACIONES } from '../logica/fabricacion.js';
import { estadoFuego } from '../logica/fuego.js';
import { moverHumo } from '../mundo/modelos.js';
import { troncosConCortes, deLista, modeloDe } from './suelo.js';

const az = (id, k) => { let h = 2166136261; for (const ch of id + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
const mallas = L => {
  const grupos = L.cerrar(null, true), g = new THREE.Group();
  for (const [tex, geos] of Object.entries(grupos)) {
    const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m);
  }
  return g;
};

// una piedra irregular: cada vértice se mueve un poco hacia fuera o hacia dentro (los que coinciden, igual)
function piedraIrregular(r, detalle, id, fuerza = 0.22) {
  const g = new THREE.IcosahedronGeometry(r, detalle), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (az(id, `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`) - 0.5) * 2 * fuerza;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  return g;
}

function piedraTallar(id) {
  const L = new Lote({ rangoSuelo: 0.25, variacion: 0.06 });
  L.add(piedraIrregular(0.36, 1, id), 'piedra', 0, 0.11, 0, { y: az(id, 1) * 6, z: 0.05 }, { escala: new THREE.Vector3(1.3, 0.5, 1), plano: true });
  L.add(piedraIrregular(0.18, 1, id + 'b'), 'piedraOsc', 0.44, 0.05, 0.3, { y: 0.7 }, { escala: new THREE.Vector3(1.2, 0.5, 1), plano: true });
  L.add(piedraIrregular(0.075, 1, id + 'c', 0.15), 'piedra', 0.08, 0.27, -0.05, { y: 1.3 }, { escala: new THREE.Vector3(1.2, 0.85, 1), plano: true, sinSuelo: true }); // la de percutir
  for (let k = 0; k < 5; k++) { // lascas sueltas
    const a = 2.2 + k * 0.5, d = 0.55 + az(id, k + 10) * 0.12;
    L.add(new THREE.TetrahedronGeometry(0.035, 0), 0x6b6762, Math.cos(a) * d, 0.012, Math.sin(a) * d, { y: k, x: 1.2 }, { escala: new THREE.Vector3(1.4, 0.35, 1), plano: true, tex: 'piedra' });
  }
  return mallas(L);
}

function hoguera(id) {
  const g = new THREE.Group(), mods = modelosRecoleccion();
  for (let i = 0; i < 8; i++) { // el círculo de piedras
    const p = deLista(mods.piedra), a = i * Math.PI / 4 + az(id, i) * 0.3;
    p.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); p.rotation.y = a + az(id, i + 20); p.scale.setScalar(1.1 + az(id, i + 40) * 0.35);
    g.add(p);
  }
  const L = new Lote({ rangoSuelo: 0.3, variacion: 0.08 });
  L.add(new THREE.CircleGeometry(0.4, 12), 0x4f4840, 0, 0.012, 0, { x: -Math.PI / 2 }, { sinSuelo: true }); // tierra quemada
  g.add(mallas(L));
  const R = new Lote({ rangoSuelo: 0.3, variacion: 0.08 });
  for (let i = 0; i < 4; i++) { // las ramas, apoyadas unas en otras (lo que tiene puesto para arder)
    const a = i * Math.PI / 2 + 0.4, largo = 0.62;
    const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.62));
    R.add(cil(0.028, 0.038, largo, 6), 'corteza', Math.cos(a) * 0.17, largo * 0.4, -Math.sin(a) * 0.17, m);
  }
  const ramas = mallas(R); ramas.name = 'ramas'; g.add(ramas);
  return g;
}

// ---------- el fuego de la hoguera ----------
const MAT_BRASA = new THREE.MeshLambertMaterial({ color: 0xc2541c, emissive: 0xc2541c, emissiveIntensity: 0.9 });
const MAT_CENIZA = new THREE.MeshLambertMaterial({ color: 0x8d8780 });
const MAT_TIZON = new THREE.MeshLambertMaterial({ color: 0x2b2420 });
const MAT_LLAMA = new THREE.MeshLambertMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 1 });
const MAT_NUCLEO = new THREE.MeshLambertMaterial({ color: 0xffc870, emissive: 0xffc870, emissiveIntensity: 1 });
// Lo que se ve del fuego según su estado: 'ardiendo' (brasas, llamas y humo), 'cenizas' (ceniza y tizones) o nada.
export function modeloFuego(cual, id) {
  const g = new THREE.Group(); g.name = 'fuego';
  g.userData.humo = { x: 0, y: 0.35, z: 0 }; g.userData.fuego = { x: 0, y: 0.35, z: 0 };
  if (cual === 'cenizas' || cual === 'ardiendo') {
    const lecho = new THREE.Mesh(piedraIrregular(0.26, 1, id + 'ceniza', 0.12), cual === 'ardiendo' ? MAT_BRASA : MAT_CENIZA);
    lecho.scale.set(1, 0.12, 1); lecho.position.y = 0.02; lecho.name = cual === 'ardiendo' ? 'llama' : 'ceniza'; g.add(lecho);
    for (let i = 0; i < 3; i++) { // tizones: restos de rama quemados
      const a = i * 2.1 + az(id, 60 + i), t = new THREE.Mesh(cil(0.02, 0.026, 0.3, 5), MAT_TIZON);
      t.position.set(Math.cos(a) * 0.1, 0.04, Math.sin(a) * 0.1); t.rotation.set(Math.PI / 2 - 0.15, 0, a); g.add(t);
    }
  }
  if (cual === 'ardiendo') {
    const llamas = [[-0.08, 0.04, 0.36, 0.09], [0.07, -0.05, 0.42, 0.1], [0.05, 0.08, 0.3, 0.08], [-0.06, -0.07, 0.28, 0.07], [0, 0, 0.22, 0.06]];
    llamas.forEach(([x, z, h, r], i) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), i === llamas.length - 1 ? MAT_NUCLEO : MAT_LLAMA);
      m.geometry.translate(0, h / 2, 0); m.position.set(x, 0.08, z); m.name = 'llama'; m.userData.fase = i * 1.7; g.add(m);
    });
    for (let i = 0; i < 10; i++) { // el humo, tenue: bocanadas pequeñas que suben, se abren y se deshacen
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshLambertMaterial({ color: 0x9a958e, transparent: true, opacity: 0, depthWrite: false }));
      m.name = 'humo'; m.userData.fase = i / 10; g.add(m);
    }
    moverFuego(g, 0);
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = m.name === 'ceniza'; } });
  return g;
}
// Mueve las llamas (como las de las chimeneas) y el humo de la hoguera: más tenue y más fino que el de una chimenea,
// porque sale a la altura de los ojos (t: segundos).
function moverFuego(g, t) {
  for (const m of g.children) {
    if (m.name !== 'humo') continue;
    const u = (m.userData.fase + t * 0.12) % 1, f = m.userData.fase;
    m.position.set(Math.sin(u * 4 + f * 9) * 0.08 + u * 0.25, 0.45 + u * 2.2, Math.cos(u * 3 + f * 7) * 0.07);
    m.scale.setScalar(0.6 + u * 3.2);
    m.material.opacity = 0.16 * Math.min(1, u * 5) * (1 - u);
  }
  moverHumo({ userData: g.userData, children: g.children.filter(m => m.name === 'llama') }, t); // las llamas, como las de las chimeneas
}
// Cómo está el fuego de una estación ahora: 'ardiendo', 'cenizas' o '' (y si tiene algo puesto sin arder).
export function vistaFuego(f, ahora) {
  const st = estadoFuego(f, ahora);
  return { cual: st.encendida ? 'ardiendo' : st.cenizas ? 'cenizas' : '', ramas: st.encendida || st.combustible > 0 };
}

function bancoTronco(id) {
  const g = new THREE.Group();
  const L = new Lote({ rangoSuelo: 0.3, variacion: 0.07 });
  L.add(cil(0.21, 0.23, 0.5, 11), 'corteza', 0, 0.25, 0, { y: az(id, 2) * 6 });   // el tajo, de pie
  L.add(new THREE.CircleGeometry(0.205, 11), 'corte', 0, 0.502, 0, { x: -Math.PI / 2 }, { sinSuelo: true });
  g.add(mallas(L));
  const tumbado = troncosConCortes(1, 0.9, 0.15, id);
  tumbado.position.set(0.15, 0, 0.5); tumbado.rotation.y = 0.25;
  g.add(tumbado);
  return g;
}

export const MODELO_ESTACION = { piedra_tallar: piedraTallar, hoguera, banco_tronco: bancoTronco };

// Dónde se pone lo depositado en cada estación (en su sistema, sin girar): los sitios de encima (y su altura) y, para
// lo que no cabe, un anillo al pie. Lo grande (troncos) siempre al pie.
const DEPOSITO_SITIOS = {
  piedra_tallar: { encima: [[-0.18, 0.2, 0.08], [0.16, 0.2, -0.1], [-0.05, 0.2, -0.18]], radio: 0.75, empieza: -0.6 },
  banco_tronco:  { encima: [[0, 0.5, 0]], radio: 0.7, empieza: 2.6 },
  hoguera:       { encima: [], radio: 0.92, empieza: 0.3 },
  obra:          { encima: [], radio: 0.95, empieza: 1.9 },   // lo entregado a un marco, fuera del armazón
};
const GRANDE = new Set(['tronco_corto', 'tronco_delgado', 'tronco_largo', 'lena']);
// El grupo con lo depositado: un montón por tipo, más pequeño encima que al pie.
export function modeloDeposito(tipo, deposito, id) {
  const g = new THREE.Group(), sit = DEPOSITO_SITIOS[tipo] || { encima: [], radio: 0.8, empieza: 0 };
  let arriba = 0, pie = 0;
  for (const [t, n] of Object.entries(deposito || {})) {
    if (!(n > 0)) continue;
    const m = modeloDe({ id: `${id}:${t}`, cosa: { tipo: t, n } });
    if (!GRANDE.has(t) && arriba < sit.encima.length) {
      const [x, y, z] = sit.encima[arriba++];
      m.position.set(x, y, z); m.scale.setScalar(0.6);
    } else {
      const a = sit.empieza + pie++ * 0.9;
      m.position.set(Math.cos(a) * sit.radio, 0, Math.sin(a) * sit.radio); m.scale.setScalar(GRANDE.has(t) ? 0.8 : 0.85);
    }
    m.rotation.y = az(id + t, 3) * Math.PI * 2;
    m.name = 'deposito_' + t; g.add(m);
  }
  g.name = 'deposito';
  return g;
}

// ---------- el marco de un puesto a medio hacer ----------
const MAT_ARMAZON = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
const MAT_ATADURA = new THREE.MeshLambertMaterial({ color: 0xb8a27a });
const matsObra = new Map();
function matObra(base, nivel) {
  const b = Array.isArray(base) ? base[0] : base, k = nivel + ':' + (b?.map?.uuid || 'liso') + (b?.vertexColors ? 'v' : '');
  if (!matsObra.has(k)) matsObra.set(k, new THREE.MeshLambertMaterial({ color: 0xd8ccb4, emissive: 0x1a140c, vertexColors: !!b?.vertexColors,
    map: b?.map || null, transparent: true, opacity: 0.42 + 0.12 * nivel, depthWrite: false }));
  return matsObra.get(k);
}
const vara = (a, b, r, mat) => {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true;
  return m;
};
// El armazón: cuatro estacas un poco inclinadas hacia dentro alrededor del puesto, con dos vueltas de cordel.
function armazon(tipo, id) {
  const g = new THREE.Group(), r = { hoguera: 0.78, banco_tronco: 0.72, piedra_tallar: 0.62 }[tipo] || 0.7, alto = 0.75;
  const pies = [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * Math.PI / 2 + (az(id, 50 + i) - 0.5) * 0.15; return [Math.cos(a) * r, Math.sin(a) * r]; });
  pies.forEach(([x, z]) => g.add(vara(new THREE.Vector3(x, -0.05, z), new THREE.Vector3(x * 0.92, alto, z * 0.92), 0.022, MAT_ARMAZON)));
  for (const h of [0.32, 0.62]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = pies[i], [x2, z2] = pies[(i + 1) % 4], k = 1 - 0.08 * h / alto;
    g.add(vara(new THREE.Vector3(x1 * k, h, z1 * k), new THREE.Vector3(x2 * k, h - 0.02, z2 * k), 0.006, MAT_ATADURA));
  }
  g.name = 'armazon';
  return g;
}
// Viste de obra el modelo de un puesto (nivel 0..4: cuánto trabajo lleva) o le devuelve sus materiales.
function vestirObra(o, nivel) {
  const modelo = o.getObjectByName('modelo');
  modelo.traverse(m => {
    if (!m.isMesh) return;
    if (!m.userData.matBase) m.userData.matBase = m.material;
    m.material = nivel === null ? m.userData.matBase : matObra(m.userData.matBase, nivel);
    m.castShadow = nivel === null;
  });
  const a = o.getObjectByName('armazon');
  if (nivel === null) { if (a) o.remove(a); }
  else if (!a) o.add(armazon(o.userData.tipo, o.userData.id));
}

// Dibuja las estaciones de fab (una Fabricacion, la del servidor en línea) sobre el terreno. refrescar() al cambiar.
export function crearEstaciones({ raiz, altura, fab }) {
  const grupo = new THREE.Group(); grupo.name = 'estaciones'; raiz.add(grupo);
  const vistas = new Map(); // id → objeto
  // el fuego de una estación (solo la que lo tiene, levantada): se rehace si cambia lo que se ve
  function ponerFuego(o, e) {
    if (!ESTACIONES[e.tipo].fuego) return;
    const v = e.obra || !e.fuego ? { cual: '', ramas: true } : vistaFuego(e.fuego, Date.now()), firma = v.cual + (v.ramas ? '+r' : '');
    if (o.userData.firmaFuego === firma) return;
    o.userData.firmaFuego = firma;
    const viejo = o.getObjectByName('fuego'); if (viejo) o.remove(viejo);
    const r = o.getObjectByName('ramas'); if (r) r.visible = v.ramas;
    if (v.cual) o.add(modeloFuego(v.cual, e.id));
  }
  // Cada fotograma: el fuego que se apaga solo (al pasar su hora), las llamas y el humo. Devuelve dónde arde cada una
  // (en el mundo) para las luces.
  let ultimo = 0;
  const vF = new THREE.Vector3();
  function paso() {
    const t = performance.now();
    if (t - ultimo > 1000) { ultimo = t; for (const [id, o] of vistas) { const e = fab.estaciones[id]; if (e) ponerFuego(o, e); } }
    const arden = [];
    for (const o of vistas.values()) {
      const f = o.getObjectByName('fuego');
      if (!f || o.userData.firmaFuego.indexOf('ardiendo') !== 0) continue;
      moverFuego(f, t / 1000);
      vF.set(0, 0.9, 0); f.localToWorld(vF); arden.push(vF.clone()); // la luz, por encima de las piedras (si no, las quema)
    }
    return arden;
  }
  function refrescar() {
    const hay = fab.estaciones;
    for (const [id, o] of vistas) if (!Object.hasOwn(hay, id)) { grupo.remove(o); vistas.delete(id); }
    for (const e of Object.values(hay)) {
      if (!MODELO_ESTACION[e.tipo]) continue;
      let o = vistas.get(e.id);
      if (!o) {
        o = new THREE.Group();
        const modelo = MODELO_ESTACION[e.tipo](e.id); modelo.name = 'modelo'; o.add(modelo);
        o.position.set(e.x, (Number.isFinite(e.y) ? e.y : altura(e.x, e.z)) - 0.01, e.z); o.rotation.y = az(e.id, 7) * Math.PI * 2;
        o.name = 'estacion_' + e.tipo; o.userData.id = e.id; o.userData.tipo = e.tipo;
        grupo.add(o); vistas.set(e.id, o);
      }
      // en obra: tenue, con su armazón, y lo entregado al pie; levantada: con sus materiales y lo depositado
      const nivel = e.obra ? Math.min(4, Math.floor(4 * (e.obra.trabajo || 0) / ESTACIONES[e.tipo].trabajo)) : null;
      if (o.userData.nivel !== nivel) { vestirObra(o, nivel); o.userData.nivel = nivel; }
      ponerFuego(o, e);
      // lo depositado (o, en obra, lo entregado): se rehace solo si ha cambiado
      const montones = e.obra ? e.obra.entregado : e.deposito, firma = (e.obra ? 'o' : 'd') + JSON.stringify(montones || {});
      if (o.userData.firma !== firma) {
        const viejo = o.getObjectByName('deposito'); if (viejo) o.remove(viejo);
        o.add(modeloDeposito(e.obra ? 'obra' : e.tipo, montones, e.id)); o.userData.firma = firma;
      }
    }
  }
  // las que manda el servidor, con lo depositado (sin colas: lo encargado es de cada uno)
  function poner(lista) {
    if (!Array.isArray(lista)) return;
    const nuevas = {};
    for (const e of lista) if (e && typeof e.id === 'string' && Number.isFinite(e.x) && Number.isFinite(e.z)) {
      const n = nuevas[e.id] = { id: e.id, tipo: e.tipo, x: e.x, z: e.z, autor: e.autor, cola: [], deposito: limpiarDeposito(e.deposito) };
      if (Number.isFinite(e.y)) n.y = e.y;
      const ob = e.obra && limpiarObra(e.obra, e.tipo); if (ob) n.obra = ob;
      // el fuego: con lo que le queda, contado desde que llega (la hora de este navegador)
      if (e.fuego && typeof e.fuego === 'object') n.fuego = { hasta: e.fuego.encendida && Number(e.fuego.queda) > 0 ? Date.now() + Number(e.fuego.queda) * 1000 : 0,
        combustible: Math.max(0, Number(e.fuego.combustible) || 0), cenizas: !!e.fuego.cenizas };
    }
    fab.estaciones = nuevas;
    refrescar();
  }
  return { grupo, refrescar, poner, paso };
}
