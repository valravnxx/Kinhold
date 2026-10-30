// Kinhold — el terreno por trozos en el navegador (three.js): con la posición del jugador, el gestor de trozos
// (src/logica/trozos.js) dice qué trozos tener y con qué detalle; el suelo de cada uno lo calcula un hilo aparte
// (trozos_hilo.js, un Web Worker) y aquí solo se monta la malla, unos pocos trozos por fotograma, para que el juego no se
// pare al cruzar un borde.
//
// - Un trozo que cambia de detalle se queda con su malla vieja hasta que llega la nueva: nunca queda un agujero.
// - Lo que se pide al hilo va de cerca a lejos, y con pocos pedidos en vuelo por hilo: si el jugador se mueve, lo que
//   pasa a estar cerca se pide antes que lo que ya estaba en cola.
// - Si llega un trozo que ya no hace falta (se soltó o cambió otra vez de detalle mientras se hacía), se tira.
// - Sin hilos (navegador sin Web Worker, o enHilo: false para medir), el suelo se calcula en el hilo de dibujo, como
//   mucho `porFotograma` trozos en cada uno: sirve de comparación y de reserva.
//
// El código del hilo va dentro del mismo HTML: lo mete el empaquetado como __CODIGO_HILO_TROZOS__ (construir_mapa.mjs) y
// se arranca desde un Blob.
import * as THREE from 'three';
import { crearGestor, claveTrozo, distanciaTrozo, alturaEnMalla, trozoDe, LADO } from '../logica/trozos.js';
import { hacerSueloTrozo } from './trozo_suelo.js';

/* global __CODIGO_HILO_TROZOS__ */
const CODIGO = typeof __CODIGO_HILO_TROZOS__ !== 'undefined' ? __CODIGO_HILO_TROZOS__ : null;
const ahora = () => performance.now();

// opciones:
//   grupo: el THREE.Group donde van las mallas; material: el del suelo; mapa: el del mundo (se manda al hilo)
//   paisaje: el mismo paisaje en este hilo (solo hace falta sin hilos)
//   origen: { x, z } del mundo que cae en el 0 de la escena (las mallas van relativas a él, por precisión)
//   limites: { x0, z0, x1, z1 } (m del mundo) fuera de los que no se carga nada
//   hilos: cuántos hilos (por defecto, los núcleos menos uno, de 1 a 3); enHilo: false para hacerlo todo aquí
//   verticesPorFotograma: lo que se monta como mucho en cada fotograma, contado en vértices (lo que cuesta subirlo a la
//   tarjeta gráfica; un trozo de rejilla de 1 m tiene unos 4.500 y uno de 8 m, unos 120); msPorFotograma: y sin pasar
//   de estos ms. Siempre se monta al menos uno. porFotograma: sin hilos, los trozos que se calculan aquí en cada uno.
export function crearTerrenoTrozos({ grupo, material, mapa, paisaje = null, origen = { x: 0, z: 0 }, limites = null,
  hilos = null, enHilo = true, porFotograma = 2, verticesPorFotograma = 20000, msPorFotograma = 3, gestor = null } = {}) {
  const g = gestor || crearGestor({ limites });
  const vivos = new Map();          // clave → { i, j, nivel, malla, suelo, pedido }
  const pendientes = new Set();     // claves que esperan a pedirse
  const llegados = [];              // suelos que han vuelto del hilo y esperan a montarse
  const med = { fotogramas: 0, trabajoMax: 0, trabajoTotal: 0, montados: 0, tirados: 0, msHiloMax: 0, msHiloTotal: 0, pedidos: 0, errores: [] };
  let idSig = 1, ultimo = null, listoHilos = false;

  // los hilos
  const lista = [];
  if (enHilo && CODIGO && typeof Worker !== 'undefined') {
    const url = URL.createObjectURL(new Blob([CODIGO], { type: 'text/javascript' }));
    const nh = hilos || Math.max(1, Math.min(3, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));
    let listos = 0;
    for (let h = 0; h < nh; h++) {
      const w = new Worker(url);
      const hilo = { w, enVuelo: 0 };
      w.onmessage = (e) => {
        const m = e.data;
        if (m.tipo === 'listo') { if (++listos === nh) { listoHilos = true; if (ultimo) pedir(ultimo.x, ultimo.z, ahora(), false); } return; }
        hilo.enVuelo--;
        if (m.tipo === 'error') { med.errores.push(m.texto); return; }
        llegados.push(m);
        // el hilo queda libre: se le da lo siguiente ya, sin esperar al próximo fotograma
        if (ultimo) pedir(ultimo.x, ultimo.z, ahora(), false);
      };
      w.onerror = (e) => med.errores.push(String(e.message || e));
      w.postMessage({ tipo: 'mapa', mapa });
      lista.push(hilo);
    }
  }
  const conHilo = lista.length > 0;
  if (!conHilo && !paisaje) throw new Error('sin hilos hace falta el paisaje en este hilo');
  const EN_VUELO = 6;               // pedidos a la vez por hilo (al volver uno, se manda otro enseguida)

  function pasoDe(nivel) { return g.anillos[nivel].paso; }

  function soltarMalla(v) {
    if (!v.malla) return;
    grupo.remove(v.malla); v.malla.geometry.dispose(); v.malla = null;
  }

  function montar(s) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(s.posiciones, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(s.normales, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(s.colores, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(s.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(s.indices, 1));
    // la esfera que lo envuelve, sin recorrer los vértices: el cuadrado del trozo y lo más alto y lo más bajo
    let lo = Infinity, hi = -Infinity; const H = s.H;
    for (let k = 0; k < H.length; k++) { const y = H[k]; if (y < lo) lo = y; if (y > hi) hi = y; }
    lo -= Math.max(...s.faldon);
    const L = s.lado;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(L / 2, (lo + hi) / 2, L / 2), Math.hypot(L / 2, (hi - lo) / 2, L / 2));
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(0, lo, 0), new THREE.Vector3(L, hi, L));
    const malla = new THREE.Mesh(geo, material);
    malla.position.set(s.x0 - origen.x, 0, s.z0 - origen.z);
    malla.receiveShadow = true; malla.name = 'trozo ' + s.i + ',' + s.j + ' ' + s.paso + 'm';
    malla.matrixAutoUpdate = false; malla.updateMatrix();
    return malla;
  }

  // un suelo que ha llegado: si aún es el que se espera, sustituye a la malla que hubiera
  function aplicar(s) {
    const v = vivos.get(claveTrozo(s.i, s.j));
    if (!v || v.pedido !== s.id) { med.tirados++; return false; }
    v.pedido = null;
    soltarMalla(v);
    v.malla = montar(s); v.suelo = { x0: s.x0, z0: s.z0, n: s.n, paso: s.paso, H: s.H };
    grupo.add(v.malla); med.montados++;
    if (s.ms > med.msHiloMax) med.msHiloMax = s.ms; med.msHiloTotal += s.ms;
    return true;
  }

  // pide al hilo (o hace aquí) los pendientes, de cerca a lejos
  function pedir(x, z, t0, prisa) {
    if (!pendientes.size) return;
    const orden = [...pendientes].map(k => vivos.get(k)).filter(Boolean)
      .map(v => ({ v, d: distanciaTrozo(x, z, v.i, v.j, g.lado) })).sort((a, b) => a.d - b.d);
    let q = 0;
    if (conHilo) {
      if (!listoHilos) return;
      for (const hilo of lista) {
        while (hilo.enVuelo < EN_VUELO && q < orden.length) {
          const { v } = orden[q++], id = idSig++;
          v.pedido = id; pendientes.delete(claveTrozo(v.i, v.j));
          hilo.w.postMessage({ tipo: 'trozo', id, i: v.i, j: v.j, paso: pasoDe(v.nivel) });
          hilo.enVuelo++; med.pedidos++;
        }
      }
    } else {
      // sin hilos: aquí mismo, unos pocos por fotograma
      let hechos = 0;
      while (q < orden.length && (prisa ? ahora() - t0 < 40 : hechos < porFotograma && (hechos === 0 || ahora() - t0 < msPorFotograma))) {
        const { v } = orden[q++], id = idSig++;
        v.pedido = id; pendientes.delete(claveTrozo(v.i, v.j));
        aplicar({ id, ...hacerSueloTrozo(paisaje, v.i, v.j, pasoDe(v.nivel), { lado: g.lado }) });
        hechos++; med.pedidos++;
      }
    }
  }

  // cada fotograma, con la posición del jugador en metros del mundo. prisa: al cargar (con la pantalla de espera), se
  // monta todo lo que haya llegado, hasta 40 ms
  function actualizar(x, z, { prisa = false } = {}) {
    const t0 = ahora();
    if (!ultimo || Math.hypot(x - ultimo.x, z - ultimo.z) > 1) {
      ultimo = { x, z };
      const r = g.actualizar(x, z);
      for (const t of r.soltar) { const k = claveTrozo(t.i, t.j), v = vivos.get(k); if (v) { soltarMalla(v); vivos.delete(k); } pendientes.delete(k); }
      for (const t of r.cargar) { const k = claveTrozo(t.i, t.j); vivos.set(k, { i: t.i, j: t.j, nivel: t.nivel, malla: null, suelo: null, pedido: null }); pendientes.add(k); }
      for (const t of r.cambiar) { const k = claveTrozo(t.i, t.j), v = vivos.get(k); if (!v) continue; v.nivel = t.nivel; v.pedido = null; pendientes.add(k); }
    }
    // montar lo que ha llegado, de cerca a lejos y sin pasarse del presupuesto del fotograma
    if (llegados.length) {
      llegados.sort((a, b) => distanciaTrozo(x, z, a.i, a.j, g.lado) - distanciaTrozo(x, z, b.i, b.j, g.lado));
      let vertices = 0;
      const tope = prisa ? Infinity : verticesPorFotograma, ms = prisa ? 40 : msPorFotograma;
      while (llegados.length && (vertices === 0 || (vertices + llegados[0].posiciones.length / 3 <= tope && ahora() - t0 < ms))) {
        const s = llegados.shift(); if (aplicar(s)) vertices += s.posiciones.length / 3;
      }
    }
    pedir(x, z, t0, prisa);
    const ms = ahora() - t0;
    med.fotogramas++; med.trabajoTotal += ms; if (ms > med.trabajoMax) med.trabajoMax = ms;
    return ms;
  }

  // la altura del suelo que se ve (m), en metros del mundo; null si ese trozo aún no está
  function alturaEn(x, z) {
    const { i, j } = trozoDe(x, z, g.lado), v = vivos.get(claveTrozo(i, j));
    return v && v.suelo ? alturaEnMalla(v.suelo, x, z) : null;
  }

  // cuántos trozos faltan por tener su malla con el detalle que toca (0: todo al día)
  function faltan() {
    let n = 0;
    for (const v of vivos.values()) if (!v.malla || v.pedido !== null || pendientes.has(claveTrozo(v.i, v.j))) n++;
    return n;
  }
  function sinMalla() { let n = 0; for (const v of vivos.values()) if (!v.malla) n++; return n; }

  function triangulos() { let n = 0; for (const v of vivos.values()) if (v.malla) n += v.malla.geometry.index.count / 3; return n; }

  function soltarTodo() {
    for (const v of vivos.values()) soltarMalla(v);
    vivos.clear(); pendientes.clear(); llegados.length = 0;
    for (const h of lista) h.w.terminate();
  }

  return { actualizar, alturaEn, faltan, sinMalla, triangulos, soltarTodo, medidas: med, gestor: g, vivos, conHilo, hilos: lista.length,
    get listo() { return conHilo ? listoHilos : true; }, lado: LADO };
}
