// Kinhold — la tala en la demo: los árboles del decorado (src/mundo/decorado.js) se talan a golpes de hacha, caen,
// dejan su tocón y vuelven a crecer pasadas unas semanas reales. La lógica (golpes, qué deja, cuándo vuelve) está en
// src/logica/tala.js; aquí se dibuja con el estilo v5 y se guarda en el navegador.
//
// Cómo se ve (provisional):
//  - el árbol que cae es el mismo modelo del bosque, que gira sobre su base como dice su caída (src/logica/tala.js,
//    simularCaida: con la gravedad, rebota en el suelo y se asienta según el terreno, o se queda apoyado en lo que
//    tenga delante o se desvía): en línea, los fotogramas del servidor, así todos lo ven igual; y se queda entero donde
//    se asentó (valravnx, 12 nov) hasta que se limpia a golpes de hacha; limpio, quedan el tronco y las ramas como
//    objetos del suelo (src/juego/suelo.js), donde cayó.
//  - el tocón: el pie del tronco con su corteza y el corte claro con anillos arriba.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { RADIO_TRONCO, radioTronco } from '../mundo/especies.js';
import { sonar, oidos } from './sonidos.js';
import { Tala, idArbol, edadDeEscala, ejecutarTala, cargarTala, guardarTala, simularCaida, caidaEn, altoArbol, radioArbol, CORTE, ALCANCE_TALA } from '../logica/tala.js';

const TIEMBLA = 1.4;     // s que tiembla el árbol que cruje (el aviso de que va a caer)

function tocon(o) {
  // el tronco de su especie (los árboles del mundo, src/mundo/vegetacion_mundo.js) o el del llano (pino y árbol de copa)
  const s = o.escala, r = (RADIO_TRONCO[o.especie] ? radioTronco(o) * 0.88 : o.modelo === 'frond' ? 0.25 : 0.23) * s, h = 0.32 + 0.12 * s;
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

// lo que la tala sabe de un árbol del decorado: su sitio, su edad, su especie y su alto (para la caída)
function datosArbol(o, id) {
  const edad = o.edad || edadDeEscala(o.escala);
  return { id, x: o.x, z: o.z, edad, ...(o.especie ? { especie: o.especie, tam: o.escala, alto: altoArbol(edad, o.especie, o.escala) } : {}) };
}

// obstaculos: los del decorado (los árboles llevan escala, modelo, instancia y malla). altura(x, z): el terreno.
// sueloObjetos: el suelo de la demo (crearSuelo), donde cae lo que deja el árbol. oyente(): dónde está quien escucha
// ({ x, z }: los sonidos, más flojos de lejos).
export function crearTala({ raiz, obstaculos, altura, almacen, sueloObjetos, oyente = null }) {
  const lejos = (o) => { const p = oyente && oyente(); return p ? Math.hypot(o.x - p.x, o.z - p.z) : 0; };
  const arboles = [], porId = new Map();
  for (const o of obstaculos) {
    if (!o.arbol || !o.malla) continue;
    const id = idArbol(o.x, o.z);
    if (porId.has(id)) continue;
    o.id = id; porId.set(id, o);
    arboles.push(datosArbol(o, id));
  }
  const tala = new Tala(arboles);
  tala.alturaEn = altura; // sin boca, cuesta abajo (en línea lo decide el servidor con su terreno)
  if (almacen) cargarTala(almacen, tala);
  const grupo = new THREE.Group(); grupo.name = 'tala'; raiz.add(grupo);
  const tocones = new Map();  // id → objeto del tocón
  const cayendo = [];         // { pivote, t, o }
  const tumbados = new Map(); // id → pivote: el árbol caído, entero donde se asentó, hasta que se limpia
  const temblando = new Map(); // id → { o, t }: el que cruje, tiembla un momento
  const cero = new THREE.Matrix4().makeScale(0, 0, 0), eje = new THREE.Vector3();

  function original(o) { // la matriz de su instancia en el bosque (guardada la primera vez)
    if (!o.matriz) { o.matriz = new THREE.Matrix4(); o.malla.getMatrixAt(o.instancia, o.matriz); }
    return o.matriz;
  }
  // (en el mundo, un árbol que está cargado pero lejos no tiene malla: sin dibujar; al ponerlo, el decorado mira si está
  // en pie, src/mundo/vegetacion_mundo.js)
  function esconder(o) {
    if (o.malla) { original(o); o.malla.setMatrixAt(o.instancia, cero); o.malla.instanceMatrix.needsUpdate = true; }
    if (!tocones.has(o.id)) {
      const t = tocon(o); t.position.set(o.x, altura(o.x, o.z), o.z); t.rotation.y = (tala.estado[o.id]?.dir || 0);
      grupo.add(t); tocones.set(o.id, t);
    }
  }
  function mostrar(o) {
    if (o.malla) { o.malla.setMatrixAt(o.instancia, original(o)); o.malla.instanceMatrix.needsUpdate = true; }
    const t = tocones.get(o.id); if (t) { grupo.remove(t); tocones.delete(o.id); }
  }
  // el árbol entero, girando sobre su base encima del tocón (el que cae y el caído)
  function pivoteDe(o) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    original(o).decompose(p, q, s);
    const pivote = new THREE.Group(); pivote.position.copy(p);
    pivote.position.y += CORTE; // se parte encima del tocón: el árbol cae desde ahí, no desde el suelo
    const m = new THREE.Mesh(o.malla.geometry, o.malla.material); m.quaternion.copy(q); m.scale.copy(s);
    m.castShadow = true; m.receiveShadow = true; pivote.add(m);
    // al caer, la base resbala del tocón hacia donde cae (así el tocón se ve, con el tronco al lado): un par de radios
    const a = tala.porId.get(o.id) || datosArbol(o, o.id);
    pivote.userData = { base: pivote.position.clone(), resbala: radioArbol(a.edad, a.especie, a.tam) * 2 + 0.12 };
    return pivote;
  }
  // inclinado «angulo» hacia dir; fin: el ángulo en que se asienta (la base resbala del tocón según lo que lleva caído)
  function inclinar(pivote, angulo, dir, fin = angulo) {
    eje.set(Math.cos(dir), 0, -Math.sin(dir)); pivote.quaternion.setFromAxisAngle(eje, angulo);
    // resbala en el último tramo de la caída (del 60 % al final) y baja lo que estaba encima del tocón
    const u = pivote.userData, k = fin > 0 ? Math.max(0, Math.min(1, (angulo / fin - 0.6) / 0.4)) : 1;
    if (u && u.base) pivote.position.set(u.base.x + Math.sin(dir) * u.resbala * k, u.base.y - CORTE * 0.8 * k, u.base.z + Math.cos(dir) * u.resbala * k);
  }
  // el caído (sin limpiar): entero, como se asentó
  function tumbar(o) {
    if (!o.malla || tumbados.has(o.id) || cayendo.some(c => c.o.id === o.id)) return;
    const e = tala.estado[o.id], p = pivoteDe(o);
    inclinar(p, e.ang, e.dir || 0); p.name = 'arbol_caido';
    grupo.add(p); tumbados.set(o.id, p);
  }
  function levantar(id) { const p = tumbados.get(id); if (p) { grupo.remove(p); tumbados.delete(id); } }
  // lo de ahora: tocones donde se taló, los caídos sin limpiar y árboles donde ya volvieron a crecer
  function refrescar(ahora = Date.now()) {
    for (const o of porId.values()) {
      if (tala.enPie(o.id, ahora)) { if (tocones.has(o.id)) mostrar(o); }
      else if (!tocones.has(o.id)) esconder(o);
      if (tala.caido(o.id, ahora)) tumbar(o); else levantar(o.id);
    }
    for (const id of [...tumbados.keys()]) if (!porId.has(id)) levantar(id);
  }
  refrescar();

  // el árbol que cae: el mismo modelo, girando sobre su base como dice su caída (sin ella, la de aquí, hacia «dir»)
  function caer(o, dir, deja, caida = null) {
    if (!caida || !Array.isArray(caida.fotos) || !caida.fotos.length) caida = simularCaida(tala.porId.get(o.id) || datosArbol(o, o.id), dir, { alturaEn: altura });
    levantar(o.id);
    const pivote = pivoteDe(o); pivote.name = 'arbol_cayendo';
    grupo.add(pivote);
    temblando.delete(o.id);
    cayendo.push({ pivote, t: 0, caida, deja, o });
    sonar('chasquido', lejos(o));
  }

  // los árboles del mundo llegan y se van al andar (src/mundo/vegetacion_mundo.js): lo talado de cada uno se guarda
  // igual, esté o no cargado, y en cuanto vuelve sale su tocón
  function anadir(lista) {
    const nuevos = [];
    for (const o of lista) {
      if (!o.arbol) continue;
      const id = o.id || idArbol(o.x, o.z); o.id = id; porId.set(id, o);
      nuevos.push(datosArbol(o, id));
    }
    tala.anadir(nuevos);
    for (const o of lista) if (o.id && !tala.enPie(o.id, Date.now()) && !tocones.has(o.id)) esconder(o);
    for (const o of lista) if (o.id && tala.caido(o.id, Date.now())) tumbar(o);
  }
  function quitar(ids) {
    for (const id of ids) {
      porId.delete(id); levantar(id);
      const t = tocones.get(id); if (t) { grupo.remove(t); tocones.delete(id); }
    }
    tala.quitar(ids);
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
      if (r.ok && r.cae) { esconder(o); caer(o, r.dir, [], r.caida); }
      // limpio: el caído se va y queda en el suelo lo que deja
      if (r.ok && r.limpio) { levantar(o.id); sueloObjetos.guardar(); sueloObjetos.refrescar(); }
      return r;
    },
    // sin servidor (las pruebas): descortezar o sangrar el árbol o aquí (src/logica/tala.js), a lo que llevas
    usarArbol(invs, registro, autor, o, tipo, x, z, ahora = Date.now()) {
      const r = ejecutarTala(tala, invs, sueloObjetos.suelo, registro, { autor, tipo, arbol: o.id, x, z }, ahora);
      if (r.ok) guardarlo();
      return r;
    },
    usos: (o, ahora = Date.now()) => tala.usos(o.id, ahora),
    paso(dt) {
      for (let i = cayendo.length - 1; i >= 0; i--) {
        const c = cayendo[i]; c.t += dt;
        const { angulo, dir } = caidaEn(c.caida, c.t);
        inclinar(c.pivote, angulo, dir, c.caida.angulo);
        // en el suelo: se queda caído, entero (si aún lo está: otro puede haberlo limpiado mientras)
        if (c.t >= c.caida.dura) {
          sonar('suelo', lejos(c.o)); cayendo.splice(i, 1);
          if (tala.caido(c.o.id, Date.now()) && !tumbados.has(c.o.id)) { c.pivote.name = 'arbol_caido'; tumbados.set(c.o.id, c.pivote); }
          else grupo.remove(c.pivote);
          if (c.deja && c.deja.length) sueloObjetos.mostrar(c.deja);
        }
      }
      // el que cruje tiembla: se mece un poco sobre su base, cada vez menos
      for (const [id, v] of temblando) {
        v.t += dt; const o = v.o;
        if (!o.malla || !tala.enPie(id, Date.now())) { temblando.delete(id); continue; }
        if (v.t >= TIEMBLA) { o.malla.setMatrixAt(o.instancia, original(o)); o.malla.instanceMatrix.needsUpdate = true; temblando.delete(id); continue; }
        const m = original(o), base = new THREE.Vector3().setFromMatrixPosition(m), a = 0.025 * (1 - v.t / TIEMBLA) * Math.sin(v.t * 31);
        const giro = new THREE.Matrix4().makeTranslation(base.x, base.y, base.z).multiply(new THREE.Matrix4().makeRotationAxis(v.eje, a)).multiply(new THREE.Matrix4().makeTranslation(-base.x, -base.y, -base.z));
        o.malla.setMatrixAt(o.instancia, giro.multiply(m)); o.malla.instanceMatrix.needsUpdate = true;
      }
      const t = Date.now(); // lo que vuelve a crecer se mira cada pocos segundos
      if (t - ultimo > 5000) { ultimo = t; refrescar(t); }
    },
    get cayendo() { return cayendo.length; },
    get tumbados() { return tumbados.size; },
    // el árbol caído sin limpiar al alcance del hacha desde (x, z): { o, d, x, z } (x, z: el punto de su tronco más
    // cercano), o null
    caidoCercano(x, z, ahora = Date.now()) {
      let mejor = null;
      for (const c of tala.caidos(ahora)) {
        const o = porId.get(c.arbol.id), d = tala.distanciaCaido(c.arbol.id, x, z, ahora);
        if (!o || d > ALCANCE_TALA || (mejor && d >= mejor.d)) continue;
        const t = tala.tendido(c.arbol.id, ahora), dx = t.x1 - t.x0, dz = t.z1 - t.z0, l2 = dx * dx + dz * dz || 1;
        const k = Math.max(0, Math.min(1, ((x - t.x0) * dx + (z - t.z0) * dz) / l2));
        mejor = { o, d, x: t.x0 + dx * k, z: t.z0 + dz * k };
      }
      return mejor;
    },
    progresoLimpiar: (o) => tala.progresoLimpiar(o.id),
    get temblando() { return temblando.size; },
    get oidos() { return oidos; },   // lo que ha sonado (las pruebas)
    // el crujido de aviso (está a punto de caer): suena (más flojo de lejos) y el árbol tiembla un momento
    crujir(o) {
      if (!o || !tala.enPie(o.id, Date.now())) return;
      sonar('crujido', lejos(o));
      if (o.malla) { const d = (tala.estado[o.id] && Number.isFinite(tala.estado[o.id].bx)) ? Math.atan2(tala.estado[o.id].bx, tala.estado[o.id].bz) : 0; temblando.set(o.id, { o, t: 0, eje: new THREE.Vector3(Math.cos(d), 0, -Math.sin(d)) }); }
    },
    // los que caen ahora: cuánto llevan (s), lo que dura su caída y su ángulo de ahora (las pruebas)
    get caidas() { return cayendo.map(c => ({ t: c.t, dura: c.caida.dura, angulo: caidaEn(c.caida, c.t).angulo, final: c.caida.angulo, apoyo: c.caida.apoyo })); },
    // en línea, el árbol que tala cualquiera lo hace caer el servidor (src/juego/objetos_en_linea.js)
    caer: (o, dir, deja, caida) => { esconder(o); caer(o, dir, deja, caida); },
    refrescar, guardar: guardarlo, anadir, quitar,
  };
}
