// Kinhold — la tala en la demo: los árboles del decorado (src/mundo/decorado.js) se talan a golpes de hacha, caen,
// dejan su tocón y vuelven a crecer pasadas unas semanas reales. La lógica (golpes, qué deja, cuándo vuelve) está en
// src/logica/tala.js; aquí se dibuja con el estilo v5 y se guarda en el navegador.
//
// Cómo se ve (provisional):
//  - el árbol que cae es el mismo modelo del bosque, que gira sobre su base hacia el lado contrario al del que tala,
//    cada vez más deprisa (como al caer), y se queda un momento en el suelo; después quedan el tronco y las ramas
//    como objetos del suelo (src/juego/suelo.js), donde cayó.
//  - el tocón: el pie del tronco con su corteza y el corte claro con anillos arriba.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { RADIO_TRONCO } from '../mundo/especies.js';
import { Tala, idArbol, edadDeEscala, ejecutarTala, cargarTala, guardarTala } from '../logica/tala.js';

const CAE = 1.7, EN_EL_SUELO = 1.3; // s: lo que tarda en caer y lo que se queda tumbado antes de ser tronco y ramas

function tocon(o) {
  // el tronco de su especie (los árboles del mundo, src/mundo/vegetacion_mundo.js) o el del llano (pino y árbol de copa)
  const s = o.escala, r = (RADIO_TRONCO[o.especie] ? RADIO_TRONCO[o.especie] * 0.88 : o.modelo === 'frond' ? 0.25 : 0.23) * s, h = 0.32 + 0.12 * s;
  const L = new Lote({ rangoSuelo: 0.5, variacion: 0.06 });
  L.add(cil(r * 0.92, r * 1.08, h, 9), 'corteza', 0, h / 2 - 0.05, 0);
  // el corte, un poco inclinado (el último golpe nunca es del todo plano), con los anillos
  L.add(new THREE.CircleGeometry(r * 0.9, 9), 'corte', 0, h - 0.05 + 0.004, 0, { x: -Math.PI / 2 + 0.08 }, { sinSuelo: true });
  // la astilla que queda en el lado por donde cayó
  L.add(new THREE.ConeGeometry(r * 0.28, 0.12, 4), 'corte', 0, h - 0.02, r * 0.45, { x: 0.15 }, { sinSuelo: true, plano: true });
  const g = new THREE.Group();
  for (const [tex, geos] of Object.entries(L.cerrar(null, true))) {
    const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m);
  }
  g.name = 'tocon';
  return g;
}

// obstaculos: los del decorado (los árboles llevan escala, modelo, instancia y malla). altura(x, z): el terreno.
// sueloObjetos: el suelo de la demo (crearSuelo), donde cae lo que deja el árbol.
export function crearTala({ raiz, obstaculos, altura, almacen, sueloObjetos }) {
  const arboles = [], porId = new Map();
  for (const o of obstaculos) {
    if (!o.arbol || !o.malla) continue;
    const id = idArbol(o.x, o.z);
    if (porId.has(id)) continue;
    o.id = id; porId.set(id, o);
    arboles.push({ id, x: o.x, z: o.z, edad: o.edad || edadDeEscala(o.escala) });
  }
  const tala = new Tala(arboles);
  if (almacen) cargarTala(almacen, tala);
  const grupo = new THREE.Group(); grupo.name = 'tala'; raiz.add(grupo);
  const tocones = new Map();  // id → objeto del tocón
  const cayendo = [];         // { pivote, t, o }
  const cero = new THREE.Matrix4().makeScale(0, 0, 0);

  function original(o) { // la matriz de su instancia en el bosque (guardada la primera vez)
    if (!o.matriz) { o.matriz = new THREE.Matrix4(); o.malla.getMatrixAt(o.instancia, o.matriz); }
    return o.matriz;
  }
  function esconder(o) {
    original(o); o.malla.setMatrixAt(o.instancia, cero); o.malla.instanceMatrix.needsUpdate = true;
    if (!tocones.has(o.id)) {
      const t = tocon(o); t.position.set(o.x, altura(o.x, o.z), o.z); t.rotation.y = (tala.estado[o.id]?.dir || 0);
      grupo.add(t); tocones.set(o.id, t);
    }
  }
  function mostrar(o) {
    o.malla.setMatrixAt(o.instancia, original(o)); o.malla.instanceMatrix.needsUpdate = true;
    const t = tocones.get(o.id); if (t) { grupo.remove(t); tocones.delete(o.id); }
  }
  // lo de ahora: tocones donde se taló y árboles donde ya volvieron a crecer
  function refrescar(ahora = Date.now()) {
    for (const o of porId.values()) {
      if (tala.enPie(o.id, ahora)) { if (tocones.has(o.id)) mostrar(o); }
      else if (!tocones.has(o.id)) esconder(o);
    }
  }
  refrescar();

  // el árbol que cae: el mismo modelo, girando sobre su base hacia «dir»
  function caer(o, dir, deja) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    original(o).decompose(p, q, s);
    const pivote = new THREE.Group(); pivote.position.copy(p);
    pivote.position.y += 0.27 + 0.12 * o.escala; // se parte encima del tocón: el árbol cae desde ahí, no desde el suelo
    const m = new THREE.Mesh(o.malla.geometry, o.malla.material); m.quaternion.copy(q); m.scale.copy(s);
    m.castShadow = true; m.receiveShadow = true; pivote.add(m); pivote.name = 'arbol_cayendo';
    grupo.add(pivote);
    cayendo.push({ pivote, t: 0, eje: new THREE.Vector3(Math.cos(dir), 0, -Math.sin(dir)), deja });
  }

  const guardarlo = () => { if (almacen) guardarTala(almacen, tala); };
  let ultimo = 0;
  return {
    tala, grupo, porId,
    enPie: (o, ahora = Date.now()) => !!o.id && tala.enPie(o.id, ahora),
    // un golpe de hacha del autor al árbol o (un obstáculo del decorado) estando en (x, z)
    golpe(invs, registro, autor, o, x, z, ahora = Date.now()) {
      const r = ejecutarTala(tala, invs, sueloObjetos.suelo, registro, { autor, tipo: 'talar', arbol: o.id, x, z }, ahora);
      if (r.ok) guardarlo();
      // lo que deja no se ve hasta que el árbol está en el suelo
      if (r.ok && r.cae) { sueloObjetos.guardar(); sueloObjetos.esconder(r.objetos); esconder(o); caer(o, r.dir, r.objetos); }
      return r;
    },
    paso(dt) {
      for (let i = cayendo.length - 1; i >= 0; i--) {
        const c = cayendo[i]; c.t += dt;
        const f = Math.min(1, c.t / CAE);
        c.pivote.quaternion.setFromAxisAngle(c.eje, f * f * (Math.PI / 2 - 0.06)); // cada vez más deprisa, como al caer
        if (c.t > CAE + EN_EL_SUELO) { grupo.remove(c.pivote); cayendo.splice(i, 1); sueloObjetos.mostrar(c.deja); }
      }
      const t = Date.now(); // lo que vuelve a crecer se mira cada pocos segundos
      if (t - ultimo > 5000) { ultimo = t; refrescar(t); }
    },
    get cayendo() { return cayendo.length; },
    refrescar, guardar: guardarlo,
  };
}
