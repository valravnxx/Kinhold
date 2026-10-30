// Kinhold — banco de pruebas del terreno por trozos: anda en línea recta por Whitholm con el terreno por trozos
// (src/mundo/terreno_trozos.js) y mide los fotogramas al cruzar los bordes de los trozos. No es una versión jugable: es
// para medir y para la prueba de navegador (pruebas/prueba_trozos_navegador.py).
// En la dirección: ?hilo=0 hace los trozos en el hilo de dibujo (para comparar); ?rumbo=<grados>.
// window.__banco: listo, error, medidas() y, para la prueba, andar(metrosPorFotograma, fotogramas) → promesa.
import * as THREE from 'three';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { generar, SEMILLA_MUNDO, LADO_MUNDO } from '../logica/mapa.js';
import { crearPaisaje } from '../logica/paisaje.js';
import { trozoDe, LADO } from '../logica/trozos.js';
import { crearTerrenoTrozos } from '../mundo/terreno_trozos.js';
import { materialSuelo } from './suelo.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const ENHILO = q.get('hilo') !== '0';
const movil = Math.min(innerWidth, innerHeight) < 700;
const B = window.__banco = { listo: false, error: null, enHilo: ENHILO, movil };
addEventListener('error', (e) => { B.error = String(e.message || e); });

// el sitio de salida: el centro de la región de la isla (Whitholm) o, si cae en el agua o en un cortado, el punto llano
// en tierra más cercano
function salida(mapa, pai) {
  const c = mapa.centros[mapa.paisIsla >= 0 ? mapa.paisIsla : 0], N = mapa.N, celda = mapa.celda;
  const cx = (c % N + 0.5) * celda, cz = (((c / N) | 0) + 0.5) * celda;
  for (let r = 0; r < 4000; r += 50) for (let a = 0; a < 16; a++) {
    const x = cx + Math.cos(a / 16 * 6.283) * r, z = cz + Math.sin(a / 16 * 6.283) * r, y = pai.altura(x, z);
    if (y < 4) continue;
    const s = Math.hypot(pai.altura(x + 3, z) - pai.altura(x - 3, z), pai.altura(x, z + 3) - pai.altura(x, z - 3)) / 6;
    if (s < 0.25) return { x, z };
  }
  return { x: cx, z: cz };
}

function arrancar(mapa) {
  const pai = crearPaisaje(mapa);
  const ini = salida(mapa, pai);
  const origen = { x: Math.round(ini.x), z: Math.round(ini.z) };
  const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, movil ? 1.5 : 2));
  prepararRenderer(renderer);
  const escena = new THREE.Scene();
  const amb = crearAmbiente(escena, { luz: 'manana', niebla: [260, 760], alcance: 40, mapa: movil ? 1024 : 2048 });
  const camara = new THREE.PerspectiveCamera(55, 1, 0.5, 2000);
  const tam = () => { renderer.setSize(innerWidth, innerHeight, false); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); };
  addEventListener('resize', tam); tam();
  const grupo = new THREE.Group(); escena.add(grupo);
  // el mar: una lámina lisa a la altura 0 (en el juego va el agua de verdad; aquí solo para no ver el fondo)
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4d6670 }));
  mar.position.y = 0.02; escena.add(mar);
  const W = mapa.lado * 1000;
  const terreno = crearTerrenoTrozos({ grupo, material: materialSuelo(), mapa, paisaje: pai, origen, limites: { x0: 0, z0: 0, x1: W, z1: W },
    enHilo: ENHILO, verticesPorFotograma: movil ? 12000 : 20000 });
  B.conHilo = terreno.conHilo; B.hilos = terreno.hilos;

  const rumbo = (Number(q.get('rumbo')) || 35) * Math.PI / 180;
  const jug = { x: ini.x, z: ini.z, dx: Math.cos(rumbo), dz: Math.sin(rumbo) };
  let marcha = null;        // { paso, quedan, fin }: andar un tanto por fotograma (la prueba)
  let velocidad = 0;        // m/s, andando de verdad (los botones)
  const fot = [];           // { dt, trabajo, cruce }
  let antes = performance.now(), trozoAntes = trozoDe(jug.x, jug.z), ultimoCruce = -1e9;
  const t0 = performance.now();

  function bucle() {
    requestAnimationFrame(bucle);
    const t = performance.now(), dt = t - antes; antes = t;
    let paso = 0;
    if (marcha) { paso = marcha.paso; if (--marcha.quedan <= 0) { const f = marcha.fin; marcha = null; setTimeout(f, 0); } }
    else paso = velocidad * Math.min(0.1, dt / 1000);
    jug.x += jug.dx * paso; jug.z += jug.dz * paso;
    const tr = trozoDe(jug.x, jug.z), cruce = tr.i !== trozoAntes.i || tr.j !== trozoAntes.j;
    if (cruce) { trozoAntes = tr; ultimoCruce = t; }
    const trabajo = terreno.actualizar(jug.x, jug.z, { prisa: !B.listo });
    // la cámara: detrás y por encima del jugador, mirando adelante (semiisométrica, como en el juego)
    const y = terreno.alturaEn(jug.x, jug.z) ?? pai.altura(jug.x, jug.z);
    const px = jug.x - origen.x, pz = jug.z - origen.z;
    camara.position.set(px - jug.dx * 9, y + 6.5, pz - jug.dz * 9);
    camara.lookAt(px + jug.dx * 6, y + 1.2, pz + jug.dz * 6);
    amb.seguir(px, pz, y);
    mar.position.x = px; mar.position.z = pz;
    renderer.render(escena, camara);
    if (B.listo) fot.push({ dt, trabajo, cruce: t - ultimoCruce < 600 });
    if (!B.listo && terreno.listo && terreno.faltan() === 0) { B.listo = true; B.msCarga = Math.round(t - t0); }
    if (fot.length % 15 === 0) pintarDatos();
  }

  function estadistica(lista) {
    if (!lista.length) return { n: 0 };
    const v = lista.slice().sort((a, b) => a - b), p = (f) => v[Math.min(v.length - 1, Math.floor(v.length * f))];
    return { n: v.length, media: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), p95: +p(0.95).toFixed(2), max: +v[v.length - 1].toFixed(2) };
  }
  B.medidas = () => {
    const m = terreno.medidas;
    return {
      enHilo: ENHILO, conHilo: terreno.conHilo, hilos: terreno.hilos, movil, msCarga: B.msCarga,
      fotograma: estadistica(fot.map(f => f.dt)), fotogramaCruce: estadistica(fot.filter(f => f.cruce).map(f => f.dt)),
      trabajo: estadistica(fot.map(f => f.trabajo)), trabajoCruce: estadistica(fot.filter(f => f.cruce).map(f => f.trabajo)),
      trozos: terreno.vivos.size, faltan: terreno.faltan(), sinMalla: terreno.sinMalla(), triangulos: terreno.triangulos(),
      llamadas: renderer.info.render.calls, montados: m.montados, tirados: m.tirados, pedidos: m.pedidos,
      msTrozoMax: +m.msHiloMax.toFixed(1), msTrozoMedia: m.montados ? +(m.msHiloTotal / m.montados).toFixed(1) : 0, errores: m.errores.slice(0, 3),
      memoriaMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      jugador: { x: +jug.x.toFixed(1), z: +jug.z.toFixed(1) },
      // la altura que se ve donde está el jugador y la de verdad (con el detalle fino)
      altura: { malla: terreno.alturaEn(jug.x, jug.z), paisaje: pai.altura(jug.x, jug.z, pai.riosEn(jug.x - 64, jug.z - 64, jug.x + 64, jug.z + 64, 2600), true) },
    };
  };
  B.andar = (paso, fotogramas) => new Promise((fin) => { fot.length = 0; marcha = { paso, quedan: fotogramas, fin }; });
  B.vaciarMedidas = () => { fot.length = 0; };
  B.cruces = () => fot.filter(f => f.cruce).length;
  function pintarDatos() {
    const m = B.medidas();
    $('datos').textContent = `${ENHILO && m.conHilo ? `en ${m.hilos} hilo(s) aparte` : 'en el hilo de dibujo'} · ${m.trozos} trozos (${m.faltan} por hacer) · ${(m.triangulos / 1000).toFixed(0)} mil triángulos · ${m.llamadas} llamadas · fotograma más largo ${m.fotograma.max ?? '–'} ms (al cruzar ${m.fotogramaCruce.max ?? '–'}) · trabajo ${m.trabajo.max ?? '–'} ms`;
  }
  $('btnAndar').onclick = () => { velocidad = velocidad ? 0 : 5; $('btnAndar').classList.toggle('on', !!velocidad); };
  $('btnCorrer').onclick = () => { velocidad = velocidad === 14 ? 0 : 14; $('btnCorrer').classList.toggle('on', velocidad === 14); };
  $('cargando').hidden = true;
  bucle();
}

// el mapa se genera por pasos, enseñando el avance
const gen = generar(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const seguir = () => {
  try {
    const r = gen.next();
    if (r.done) { B.msMapa = Math.round(performance.now() - tMapa); arrancar(r.value); return; }
    $('fase').textContent = Math.round(r.value.avance * 100) + ' %';
    setTimeout(seguir, 0);
  } catch (er) { B.error = String(er && er.stack || er); }
};
const tMapa = performance.now();
setTimeout(seguir, 30);
void LADO;
