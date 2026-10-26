// Kinhold — hito 1: construcción
import * as THREE from 'three';
import { Mundo, clave, centroLocal, localAMundo, mundoALocal, RADIO_MOJON, geometriaTejados, escaleraAndando, progresoEscalera } from '../logica/construccion.js';
import { RegistroAcciones, ejecutar, seAbre, AUTOR_LOCAL } from '../logica/acciones.js';
import { PIEZAS, DECORACION, MATERIALES, MODULO, ALTURA } from '../logica/piezas.js';
import { modeloPieza, mojon as modeloMojon, decoracion as modeloDeco, mat, P, rellenoTejado } from './modelos.js';
import { crearJugador } from './personaje.js';
import { personajeElegido } from '../demo/eleccion.js';
import { REGISTRO, VERSION } from './registro.js';
import { t } from './textos.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { crearDecorado } from '../mundo/decorado.js';
import { vigilar, ofrecerGente } from '../mundo/rendimiento.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('menu'));
// En el móvil, los botones de modo van debajo del menú de arriba; en otros idiomas (ruso) el menú
// ocupa más filas, así que se colocan según lo que mida de verdad en vez de a una altura fija.
function colocarModos() {
  const modos = document.getElementById('modos'), menu = document.getElementById('menu');
  if (!modos || !menu) return;
  if (innerWidth > 640) { modos.style.top = ''; return; }
  modos.style.top = Math.max(120, Math.ceil(menu.getBoundingClientRect().bottom) + 10) + 'px';
}
// El aviso va justo debajo del menú de arriba (que en el móvil, y más en inglés o en ruso, ocupa varias filas)
// y, en el móvil, a la izquierda de los botones de modo, para no tapar nada.
function colocarAviso() {
  const a = document.getElementById('aviso'), sup = document.getElementById('superior'), modos = document.getElementById('modos');
  if (!a || !sup) return;
  a.style.top = Math.ceil(sup.getBoundingClientRect().bottom) + 8 + 'px';
  if (innerWidth > 640) { a.style.left = a.style.transform = a.style.maxWidth = ''; return; }
  const izq = 10, der = modos && !modos.hidden ? modos.getBoundingClientRect().left - 8 : innerWidth - 10;
  a.style.left = izq + 'px'; a.style.transform = 'none'; a.style.maxWidth = Math.max(140, der - izq) + 'px';
}
function colocarTodo() { colocarModos(); colocarAviso(); }
colocarTodo();
addEventListener('resize', colocarTodo);
// si el menú cambia de tamaño (la demo añade «Menú» y los fps, o cambia el idioma), se recoloca
if (window.ResizeObserver && document.getElementById('superior')) new ResizeObserver(colocarTodo).observe(document.getElementById('superior'));

const CLAVE_GUARDADO = 'kinhold_h1_v1';
const $ = (id) => document.getElementById(id);

// ---------------- Estado ----------------
let mundo = cargar();
// Toda acción que cambia el mundo pasa por la lógica pura con su autor y queda anotada (src/logica/acciones.js).
let registroAcciones = new RegistroAcciones();
function accion(a) { return ejecutar(mundo, registroAcciones, { autor: AUTOR_LOCAL, ...a }); }
const estado = {
  modo: 'mover',            // mover | construir | desmontar
  sel: { clase: 'pieza', tipo: 'cim_piedra' },
  planta: 0,
  rotLibre: 0,               // giro de la primera pieza de una construcción (rad)
  dir: 0,                    // orientación de tejado, hastial, escalera
  puntero: null,             // {x,z,y} en el mundo
  candidato: null,
  pendienteDesmontar: null,  // {c, key} o {deco}
  esTactil: matchMedia('(pointer: coarse)').matches,
};

function cargar() {
  try {
    const txt = localStorage.getItem(CLAVE_GUARDADO);
    if (txt) return Mundo.importar(JSON.parse(txt));
  } catch (e) { /* sin almacenamiento */ }
  return new Mundo();
}
function guardar() {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(mundo.exportar())); } catch (e) { /* sin almacenamiento */ }
}

// ---------------- Escena ----------------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0); // el cielo lo pinta la página (un degradado CSS no cuesta nada dibujarlo)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
prepararRenderer(renderer); // sombras blandas, sRGB y ACES: los de la escena común
vigilar(renderer); // fotogramas, triángulos y memoria (src/mundo/rendimiento.js)
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
// cielo, sol, luz del cielo y niebla del estilo v5 (src/mundo/ambiente.js); la sombra sigue al jugador
const ambiente = crearAmbiente(escena, { fondoPagina: true, alcance: 30, mapa: 2048, niebla: [70, 200] });

// decorado común (src/mundo/decorado.js): llano para construir, bosque, hierba y rocas con colisión.
// La hierba empieza a 16 m: dentro se construye y asomaría por los cimientos (decisión provisional).
const decorado = crearDecorado({ semilla: 7, llano: 60, lejos: 230, arboles: 220, bosqueDesde: 28, bosqueHasta: 175,
  hierba: 1400, flores: 380, hierbaDesde: 16, hierbaHasta: 48, rocas: 40 });
escena.add(decorado.raiz);
const obstaculos = decorado.obstaculos; // {x,z,r}

// ---------------- Personaje y cámara ----------------
// personaje del taller propio: la versión publicada vive en jugar/construccion/, los modelos en recursos/personajes/taller-v7/
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v7/';
// el personaje elegido en el visor (cuerpo y ropa); si no se ha elegido ninguno, camisa y calzas de lino (GDD)
const elegido = personajeElegido();
const jugador = elegido ? crearJugador(RECURSOS_MH, elegido.sexo, elegido.capas) : crearJugador(RECURSOS_MH);
escena.add(jugador.raiz);
const pj = { x: 0, y: 0, z: 4, k: 0, rot: Math.PI, vel: 0 };
const cam = { yaw: Math.PI * 0.25, pitch: 0.9, dist: 16 };

// Gente de prueba, solo para medir el rendimiento con varios personajes (botón de la demo): personajes del taller
// que pasean en corro alrededor de donde estás. No son jugadores ni cambian el mundo: solo se dibujan.
const ROPA_PRUEBA = { hombre: [['tunica'], ['gambeson'], ['gambeson', 'cota', 'sobreveste'], []], mujer: [['vestido'], ['vestido', 'gambeson'], []] };
const gente = [];
ofrecerGente({
  cuantos: () => gente.length,
  poner(n) {
    while (gente.length > n) escena.remove(gente.pop().j.raiz);
    while (gente.length < n) {
      const i = gente.length, sexo = i % 2 ? 'mujer' : 'hombre', ropas = ROPA_PRUEBA[sexo];
      const j = crearJugador(RECURSOS_MH, sexo, ropas[Math.floor(i / 2) % ropas.length]);
      escena.add(j.raiz);
      gente.push({ j, cx: pj.x, cz: pj.z, radio: 3 + (i % 4) * 1.2, ang: i * 2.4, sentido: i % 3 ? 1 : -1 });
    }
  },
});
function moverGente(dt) {
  for (const g of gente) {
    g.ang += g.sentido * 0.97 * dt / g.radio; // a paso de andar (0,97 m/s)
    g.j.raiz.position.set(g.cx + Math.cos(g.ang) * g.radio, 0, g.cz + Math.sin(g.ang) * g.radio);
    g.j.raiz.rotation.y = -g.ang + (g.sentido > 0 ? 0 : Math.PI); // mirando hacia donde anda
    g.j.animar(0.97, dt);
  }
}

function actualizarCamara() {
  const objetivo = new THREE.Vector3(pj.x, pj.y + 1.2, pj.z);
  const cp = Math.cos(cam.pitch);
  camara.position.set(
    objetivo.x + Math.sin(cam.yaw) * cp * cam.dist,
    objetivo.y + Math.sin(cam.pitch) * cam.dist,
    objetivo.z + Math.cos(cam.yaw) * cp * cam.dist);
  camara.lookAt(objetivo);
  ambiente.seguir(pj.x, pj.z);
}

// ---------------- Construcciones en pantalla ----------------
const raizConstr = new THREE.Group();
escena.add(raizConstr);
const raizDeco = new THREE.Group();
escena.add(raizDeco);
let mallaMojon = null, anilloTierra = null;
const registroMallas = []; // {obj, c, key, deco}

function transformarPieza(obj, p) {
  const l = centroLocal(p);
  obj.position.set(l.lx, p.k * ALTURA, l.lz);
  let ry = 0;
  if (['e', 'b', 'p', 'g'].includes(p.hueco) && p.d === 1) ry = -Math.PI / 2;
  if (p.hueco === 'g' && p.dir % 2 === 1) ry += Math.PI;
  if (p.hueco === 'r' || p.hueco === 'l') ry = -(p.dir || 0) * Math.PI / 2;
  obj.rotation.y = ry;
}
function aplicarAperturas(obj, p) {
  const hoja = obj.getObjectByName('hoja');
  if (hoja) hoja.rotation.y = p.abierta ? -Math.PI / 2 : 0;
}

// Libera en la tarjeta gráfica las mallas que se quitan. Sin esto, cada vez que se colocaba o se quitaba algo se
// rehacían todas las piezas y las viejas se quedaban ocupando memoria gráfica: tras un rato construyendo, el móvil
// se quedaba sin ella y la pantalla en blanco aunque fuera a más de 80 fps (lo vio Pedro). Los materiales son
// compartidos (salen de una caché) y no se liberan.
function liberar(obj) { if (window.__sinLiberar) return; obj.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); } // __sinLiberar: solo para comprobar que la prueba de la fuga falla
function reconstruir() {
  for (const r of [raizConstr, raizDeco]) for (const h of r.children) liberar(h);
  raizConstr.clear(); raizDeco.clear();
  registroMallas.length = 0;
  for (const c of mundo.construcciones) {
    const g = new THREE.Group();
    g.position.set(c.ox, 0, c.oz);
    g.rotation.y = c.rot;
    g.userData.c = c;
    const tejados = geometriaTejados(c);
    for (const [key, p] of c.piezas) {
      const obj = modeloPieza(p.tipo);
      transformarPieza(obj, p);
      aplicarAperturas(obj, p);
      const tj = tejados.get(key);
      if (tj) {
        obj.position.y += tj.arranque * P.subidaTejado;
        for (const rel of tj.rellenos) obj.add(rellenoTejado(rel, tj.arranque));
      }
      obj.userData = { c, key, k: p.k };
      obj.traverse(o => { if (o.isMesh) o.userData.ref = obj; });
      g.add(obj);
      registroMallas.push({ obj, c, key });
    }
    raizConstr.add(g);
  }
  for (const d of mundo.decoracion) {
    const obj = modeloDeco(d.tipo);
    obj.position.set(d.x, d.y, d.z);
    obj.rotation.y = d.rot;
    obj.userData = { deco: d };
    obj.traverse(o => { if (o.isMesh) o.userData.ref = obj; });
    raizDeco.add(obj);
    registroMallas.push({ obj, deco: d });
  }
  if (mallaMojon) { escena.remove(mallaMojon); liberar(mallaMojon); mallaMojon = null; }
  if (anilloTierra) { escena.remove(anilloTierra); liberar(anilloTierra); anilloTierra.material.dispose(); anilloTierra = null; }
  if (mundo.mojon) {
    mallaMojon = modeloMojon();
    mallaMojon.position.set(mundo.mojon.x, 0, mundo.mojon.z);
    escena.add(mallaMojon);
    const anillo = new THREE.Mesh(new THREE.RingGeometry(RADIO_MOJON - 0.15, RADIO_MOJON, 96), new THREE.MeshBasicMaterial({ color: 0xf2e3b5, transparent: true, opacity: 0.55, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(mundo.mojon.x, 0.03, mundo.mojon.z);
    anilloTierra = anillo;
    escena.add(anillo);
  }
  actualizarUI();
}

// ---------------- Resaltados ----------------
const MAT_FANTASMA_OK = new THREE.MeshLambertMaterial({ color: 0x6fd27a, transparent: true, opacity: 0.55, depthWrite: false });
const MAT_FANTASMA_MAL = new THREE.MeshLambertMaterial({ color: 0xe0574f, transparent: true, opacity: 0.55, depthWrite: false });
const MAT_ROJO = new THREE.MeshLambertMaterial({ color: 0xd83a32, emissive: 0x5a0d0a });
const MAT_NARANJA = new THREE.MeshLambertMaterial({ color: 0xf0a030, emissive: 0x4a2a00 });
let resaltados = [];
function resaltar(obj, material) {
  obj.traverse(o => {
    if (o.isMesh) {
      if (!o.userData.matOriginal) o.userData.matOriginal = o.material;
      o.material = material;
      resaltados.push(o);
    }
  });
}
function limpiarResaltado() {
  for (const o of resaltados) if (o.userData.matOriginal) { o.material = o.userData.matOriginal; delete o.userData.matOriginal; }
  resaltados = [];
}
function objDe(c, key) { const r = registroMallas.find(m => m.c === c && m.key === key); return r && r.obj; }

// ---------------- Fantasma de colocación ----------------
let fantasma = null, fantasmaTipo = null;
function prepararFantasma() {
  const tipo = estado.modo === 'construir' ? estado.sel.clase + ':' + estado.sel.tipo : null;
  if (tipo === fantasmaTipo) return;
  if (fantasma) { escena.remove(fantasma); liberar(fantasma); fantasma = null; }
  fantasmaTipo = tipo;
  if (!tipo) return;
  if (estado.sel.clase === 'pieza') fantasma = modeloPieza(estado.sel.tipo);
  else if (estado.sel.clase === 'deco') fantasma = modeloDeco(estado.sel.tipo);
  else fantasma = modeloMojon();
  fantasma.traverse(o => { if (o.isMesh) { o.material = MAT_FANTASMA_OK; o.castShadow = false; o.renderOrder = 2; } });
  fantasma.visible = false;
  escena.add(fantasma);
}
function pintarFantasma(valido) {
  if (!fantasma) return;
  fantasma.traverse(o => { if (o.isMesh) o.material = valido ? MAT_FANTASMA_OK : MAT_FANTASMA_MAL; });
}

// Evalúa lo que pasaría al colocar en el puntero actual y lo muestra.
function evaluarColocacion() {
  limpiarResaltado();
  prepararFantasma();
  estado.candidato = null;
  if (estado.modo !== 'construir' || !estado.puntero || !fantasma) { if (fantasma) fantasma.visible = false; mostrarAviso(''); return; }
  const { x, z } = estado.puntero;
  const sel = estado.sel;
  fantasma.visible = true;
  if (sel.clase === 'mojon') {
    fantasma.position.set(x, 0, z); fantasma.rotation.set(0, 0, 0);
    const v = mundo.mojon ? { ok: false, motivo: t('yaMojon') } : mundo.puedePagar(PIEZAS.mojon.coste) ? { ok: true } : { ok: false, motivo: t('faltanMateriales') };
    pintarFantasma(v.ok); mostrarAviso(v.ok ? '' : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'mojon', x, z, v };
    return;
  }
  if (sel.clase === 'deco') {
    const y = estado.puntero.ySuperficie || 0;
    fantasma.position.set(x, y, z); fantasma.rotation.set(0, estado.rotDeco || 0, 0);
    let v = { ok: true };
    if (!mundo.mojon) v = { ok: false, motivo: t('primeroMojon') };
    else if (!mundo.dentroDeTierra(x, z)) v = { ok: false, motivo: t('fueraTierra') };
    else if (!mundo.puedePagar(DECORACION[sel.tipo].coste)) v = { ok: false, motivo: t('faltanMateriales') };
    pintarFantasma(v.ok); mostrarAviso(v.ok ? '' : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'deco', x, y, z, v };
    return;
  }
  const datos = { pieza: sel.tipo, x, z, k: estado.planta, rot: estado.rotLibre, dir: estado.dir };
  const cand = mundo.candidata(datos.pieza, x, z, datos.k, datos.rot, datos.dir);
  const v = mundo.validar(cand);
  // colocar el fantasma en la rejilla de su construcción
  const c = cand.construccion;
  const tmp = new THREE.Group();
  tmp.position.set(c.ox, 0, c.oz); tmp.rotation.y = c.rot; tmp.updateMatrixWorld();
  const local = new THREE.Object3D();
  transformarPieza(local, cand.pieza);
  tmp.add(local); tmp.updateMatrixWorld(true);
  local.matrixWorld.decompose(fantasma.position, fantasma.quaternion, fantasma.scale);
  if (cand.pieza.hueco === 'r' && !cand.nueva && v.ok) {
    // el tramo continúa la pendiente de los vecinos: arranca más alto
    c.piezas.set(v.clave, cand.pieza);
    const tj = geometriaTejados(c).get(v.clave);
    c.piezas.delete(v.clave);
    if (tj) fantasma.position.y += tj.arranque * P.subidaTejado;
  }
  pintarFantasma(v.ok);
  if (!v.ok && v.debil) {
    const o = objDe(c, v.debil);
    if (o) resaltar(o, MAT_ROJO);
    const pd = c.piezas.get(v.debil) || cand.pieza;
    mostrarAviso(`${tr(v.motivo)} ${t('puntoDebil')}: ${tr(PIEZAS[pd.tipo].nombre)} (${Math.round(v.carga)} / ${v.cap} kg)`, true);
  } else {
    mostrarAviso(v.ok ? (cand.nueva ? t('nuevaConstruccion') : '') : tr(v.motivo), !v.ok);
  }
  estado.candidato = { tipo: 'pieza', cand, v, datos };
}

function colocar() {
  const ca = estado.candidato;
  if (!ca) return;
  if (!ca.v.ok) { mostrarAviso(tr(ca.v.motivo), true); return; }
  let r;
  if (ca.tipo === 'mojon') r = accion({ tipo: 'mojon', x: ca.x, z: ca.z });
  else if (ca.tipo === 'deco') r = accion({ tipo: 'decorar', pieza: estado.sel.tipo, x: ca.x, y: ca.y, z: ca.z, rot: estado.rotDeco || 0 });
  else r = accion({ tipo: 'colocar', ...ca.datos });
  if (r.ok) {
    if (ca.tipo === 'mojon') { estado.sel = { clase: 'pieza', tipo: 'cim_piedra' }; marcarSeleccion(); }
    guardar(); reconstruir(); evaluarColocacion();
  } else mostrarAviso(tr(r.motivo), true);
}

// ---------------- Desmontar ----------------
function evaluarDesmontaje(hit) {
  limpiarResaltado();
  estado.pendienteDesmontar = null;
  if (!hit) { mostrarAviso(''); return; }
  const obj = hit.object.userData.ref;
  if (!obj) { mostrarAviso(''); return; }
  if (obj.userData.deco) {
    resaltar(obj, MAT_NARANJA);
    estado.pendienteDesmontar = { deco: obj.userData.deco };
    mostrarAviso(`${tr(DECORACION[obj.userData.deco.tipo].nombre)}: ${t('recuperas75')}`);
    return;
  }
  const { c, key } = obj.userData;
  const pre = mundo.previsualizarDesmontaje(c, key);
  resaltar(obj, MAT_NARANJA);
  for (const k2 of pre.caen || []) { const o = objDe(c, k2); if (o) resaltar(o, MAT_ROJO); }
  if (!pre.ok) {
    const o = objDe(c, pre.debil); if (o) resaltar(o, MAT_ROJO);
    mostrarAviso(tr(pre.motivo), true);
    return;
  }
  estado.pendienteDesmontar = { c, key, caen: pre.caen.length };
  const nombre = tr(PIEZAS[c.piezas.get(key).tipo].nombre);
  mostrarAviso(pre.caen.length === 1 ? `${nombre}: ${t('caera1')}` : pre.caen.length ? `${nombre}: ${t('caeran')} ${pre.caen.length} ${t('piezasEncima')}` : `${nombre}: ${t('recuperas75')}`, pre.caen.length > 0);
}
function confirmarDesmontaje() {
  const pd = estado.pendienteDesmontar;
  if (!pd) return;
  let r;
  if (pd.deco) r = accion({ tipo: 'quitar', id: pd.deco.id });
  else r = accion({ tipo: 'desmontar', construccion: pd.c.id, clave: pd.key });
  estado.pendienteDesmontar = null;
  if (r.ok) {
    const dev = Object.entries(r.devuelto || {}).map(([m, n]) => `+${n} ${tr(MATERIALES[m]).toLowerCase()}`).join(', ');
    guardar(); reconstruir();
    mostrarAviso(`${t('desmontado')}${dev ? ': ' + dev : ''}${r.caen && r.caen.length ? ' · ' + r.caen.length + ' ' + (r.caen.length === 1 ? t('destruida1') : t('destruidas')) : ''}`);
  } else mostrarAviso(tr(r.motivo), true);
  limpiarResaltado();
  $('confirmar').hidden = true;
}

// ---------------- Raycast ----------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayoDesde(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camara);
  return ray;
}
function punteroDesde(clientX, clientY) {
  const rr = rayoDesde(clientX, clientY);
  if (estado.modo === 'construir' && estado.sel.clase === 'deco') {
    // la decoración se apoya en suelos, cimientos o el terreno
    const objetivos = registroMallas.filter(m => m.c && ['f'].includes(m.c.piezas.get(m.key)?.hueco)).map(m => m.obj);
    const hits = rr.intersectObjects(objetivos, true);
    if (hits.length) return { x: hits[0].point.x, z: hits[0].point.z, ySuperficie: hits[0].point.y };
  }
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -estado.planta * ALTURA * (estado.sel.clase === 'pieza' ? 1 : 0));
  const pto = new THREE.Vector3();
  if (!rr.ray.intersectPlane(plano, pto)) return null;
  return { x: pto.x, z: pto.z, ySuperficie: 0 };
}
function piezaBajo(clientX, clientY) {
  const rr = rayoDesde(clientX, clientY);
  const objs = registroMallas.filter(m => m.obj.visible).map(m => m.obj);
  const hits = rr.intersectObjects(objs, true).filter(h => h.object.visible && h.object.userData.ref && h.object.userData.ref.visible);
  return hits[0] || null;
}

// ---------------- Entrada: teclado ----------------
const teclas = new Set();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  teclas.add(k);
  if (k === 'r') girar();
  if (k === 'b') cambiarModo(estado.modo === 'construir' ? 'mover' : 'construir');
  if (k === 'x') cambiarModo(estado.modo === 'desmontar' ? 'mover' : 'desmontar');
  if (k === 'pageup' || k === '+') cambiarPlanta(1);
  if (k === 'pagedown' || k === '-') cambiarPlanta(-1);
  if (k === 'f') usar();
  if (k === 'escape') cambiarModo('mover');
});
addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));

// ---------------- Entrada: ratón y táctil ----------------
const punteros = new Map(); // pointerId -> {x,y,x0,y0,t0}
let arrastrando = false, pinzaDist = 0;
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('pointerdown', (e) => {
  lienzo.setPointerCapture(e.pointerId);
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), boton: e.button });
  arrastrando = false;
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    pinzaDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
lienzo.addEventListener('pointermove', (e) => {
  const p = punteros.get(e.pointerId);
  if (!p) {
    // ratón sin pulsar: mover el puntero de construcción
    if (e.pointerType === 'mouse') alPasar(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) arrastrando = true;
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinzaDist) cam.dist = THREE.MathUtils.clamp(cam.dist * (pinzaDist / d), 6, 34);
    pinzaDist = d;
    cam.yaw -= dx * 0.004;
    return;
  }
  const rotarCamara = e.pointerType !== 'mouse' || p.boton === 2 || p.boton === 1 || (p.boton === 0 && estado.modo === 'mover');
  if (arrastrando && rotarCamara) {
    cam.yaw -= dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.45, 1.35);
  }
  if (e.pointerType === 'mouse' && p.boton === 0 && estado.modo === 'construir') alPasar(e.clientX, e.clientY);
});
lienzo.addEventListener('pointerup', (e) => {
  const p = punteros.get(e.pointerId);
  punteros.delete(e.pointerId);
  if (punteros.size < 2) pinzaDist = 0;
  if (!p || arrastrando) return;
  // toque o clic sin arrastre
  if (e.pointerType === 'mouse' && p.boton !== 0) return;
  if (estado.modo === 'desmontar') {
    // el clic o el toque elige la pieza o el mueble y lo deja fijo hasta confirmar o cancelar
    elegirDesmontaje(e.clientX, e.clientY);
    return;
  }
  alPasar(e.clientX, e.clientY);
  if (e.pointerType === 'mouse' && estado.modo === 'construir') colocar();
});
lienzo.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 6, 34);
}, { passive: false });

function alPasar(cx, cy) {
  if (estado.modo === 'construir') {
    estado.puntero = punteroDesde(cx, cy);
    evaluarColocacion();
  } else if (estado.modo === 'desmontar' && $('confirmar').hidden) {
    // pasar el ratón solo enseña qué se quitaría; si ya hay algo elegido esperando confirmación, no se toca
    evaluarDesmontaje(piezaBajo(cx, cy));
  }
}
function elegirDesmontaje(cx, cy) {
  $('confirmar').hidden = true;
  evaluarDesmontaje(piezaBajo(cx, cy));
  if (estado.pendienteDesmontar) $('confirmar').hidden = false;
}

// Joystick táctil
const joy = { activo: false, id: null, cx: 0, cy: 0, vx: 0, vy: 0 };
{
  const zona = $('joystick'), pomo = $('pomo');
  zona.addEventListener('pointerdown', (e) => {
    zona.setPointerCapture(e.pointerId);
    const r = zona.getBoundingClientRect();
    joy.activo = true; joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
    moverJoy(e);
  });
  const moverJoy = (e) => {
    if (!joy.activo || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const max = 45, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.vx = dx / max; joy.vy = dy / max;
    pomo.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  zona.addEventListener('pointermove', moverJoy);
  const soltar = () => { joy.activo = false; joy.vx = joy.vy = 0; pomo.style.transform = ''; };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);
}

// ---------------- Acciones ----------------
function cambiarModo(m) {
  estado.modo = m;
  estado.pendienteDesmontar = null;
  $('confirmar').hidden = true;
  limpiarResaltado();
  if (m !== 'construir' && fantasma) fantasma.visible = false;
  if (m === 'construir' && !estado.puntero) {
    // en táctil, empezar con el puntero delante del personaje
    estado.puntero = { x: pj.x + Math.sin(pj.rot) * 3, z: pj.z + Math.cos(pj.rot) * 3, ySuperficie: 0 };
  }
  if (m === 'construir') evaluarColocacion(); else mostrarAviso('');
  actualizarUI();
}
function girar() {
  const sel = estado.sel;
  if (estado.modo !== 'construir') return;
  if (sel.clase === 'pieza') {
    const h = PIEZAS[sel.tipo].hueco;
    const nueva = !estado.candidato || !estado.candidato.cand || estado.candidato.cand.nueva;
    if (h === 'r' || h === 'l') estado.dir = (estado.dir + 1) % 4;
    else if (h === 'g') estado.dir = (estado.dir + 1) % 2;
    // el giro libre solo cuenta para la primera pieza de una construcción nueva
    else if (nueva) estado.rotLibre = (estado.rotLibre + Math.PI / 12) % (Math.PI * 2);
    if (nueva && (h === 'r' || h === 'l' || h === 'g')) estado.rotLibre = (estado.rotLibre + Math.PI / 12) % (Math.PI * 2);
  } else estado.rotDeco = ((estado.rotDeco || 0) + Math.PI / 12) % (Math.PI * 2);
  evaluarColocacion();
}
function cambiarPlanta(d) {
  estado.planta = THREE.MathUtils.clamp(estado.planta + d, 0, 3);
  $('planta').textContent = `${t('planta')} ${estado.planta}`;
  evaluarColocacion();
}

// Usar: puertas y escaleras cercanas
function interactivoCercano() {
  let mejor = null, md = 1.8;
  for (const c of mundo.construcciones) {
    for (const [key, p] of c.piezas) {
      const puerta = seAbre(p);
      const esc = p.hueco === 'l' && !PIEZAS[p.tipo].andando; // la de tablas se sube andando
      if (!puerta && !esc) continue;
      const m = localAMundo(c, centroLocal(p).lx, centroLocal(p).lz);
      const d = Math.hypot(m.x - pj.x, m.z - pj.z);
      const mismaPlanta = p.k === pj.k || (esc && p.k === pj.k - 1);
      if (mismaPlanta && d < md) { md = d; mejor = { c, key, p, tipo: puerta ? 'puerta' : 'escalera' }; }
    }
  }
  return mejor;
}
// árbol al alcance del hacha (a menos de 1 m de su tronco), en la planta baja
function arbolCercano() {
  if (pj.k !== 0) return null;
  let mejor = null, md = 1.0;
  for (const o of obstaculos) {
    if (!o.arbol) continue;
    const d = Math.hypot(o.x - pj.x, o.z - pj.z) - o.r;
    if (d < md) { md = d; mejor = o; }
  }
  return mejor;
}
function usar() {
  const it = interactivoCercano();
  if (!it) {
    // junto a un árbol, se tala (por ahora solo el gesto: la madera llega con la recolección)
    const a = arbolCercano();
    if (a) { estado.talando = a; pj.rot = Math.atan2(a.x - pj.x, a.z - pj.z); mostrarAviso(t('talando')); return; }
    mostrarAviso(t('nadaQueUsar')); return;
  }
  if (it.tipo === 'puerta') {
    const r = accion({ tipo: 'usar', construccion: it.c.id, clave: it.key });
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    guardar(); reconstruir();
    mostrarAviso(it.p.abierta ? t('abierta') : t('cerrada'));
    return;
  }
  // escalera: subir si estás en su planta, bajar si estás encima
  const { c, p } = it;
  if (pj.k === p.k) {
    const destinos = [[p.i, p.j], [p.i + 1, p.j], [p.i - 1, p.j], [p.i, p.j + 1], [p.i, p.j - 1]];
    for (const [i, j] of destinos) {
      if (c.piezas.has(clave('f', i, j, p.k + 1))) {
        // quedas en el suelo de arriba, pero pegado a la escalera para poder volver a bajar
        const le = centroLocal(p);
        const lx = (i + 0.5) * MODULO + (le.lx - (i + 0.5) * MODULO) * 0.4;
        const lz = (j + 0.5) * MODULO + (le.lz - (j + 0.5) * MODULO) * 0.4;
        const m = localAMundo(c, lx, lz);
        pj.x = m.x; pj.z = m.z; pj.k = p.k + 1;
        mostrarAviso(`${t('subes')} ${pj.k}`);
        return;
      }
    }
    mostrarAviso(t('sinSueloArriba'), true);
  } else {
    const m = localAMundo(c, centroLocal(p).lx, centroLocal(p).lz);
    pj.x = m.x; pj.z = m.z; pj.k = p.k;
    mostrarAviso(`${t('bajas')} ${pj.k}`);
  }
}

// ---------------- Movimiento y colisiones ----------------
function segmentosBloqueo(k) {
  const segs = []; // [x1,z1,x2,z2]
  const circulos = [...obstaculos];
  for (const c of mundo.construcciones) {
    for (const [key, p] of c.piezas) {
      if (p.k !== k) continue;
      if (p.hueco === 'v') {
        const m = localAMundo(c, p.i * MODULO, p.j * MODULO);
        circulos.push({ x: m.x, z: m.z, r: 0.16 });
        continue;
      }
      if (p.hueco !== 'e') continue;
      const def = PIEZAS[p.tipo];
      if (def.portón && p.abierta) continue;
      const a = p.d === 0 ? [p.i * MODULO, p.j * MODULO] : [p.i * MODULO, p.j * MODULO];
      const b = p.d === 0 ? [(p.i + 1) * MODULO, p.j * MODULO] : [p.i * MODULO, (p.j + 1) * MODULO];
      const pa = localAMundo(c, a[0], a[1]), pb = localAMundo(c, b[0], b[1]);
      if (def.conPuerta) {
        const puertaP = c.piezas.get(clave('p', p.i, p.j, p.k, p.d));
        const f = (P.anchoPuerta / 2) / MODULO;
        const m1 = { x: pa.x + (pb.x - pa.x) * (0.5 - f), z: pa.z + (pb.z - pa.z) * (0.5 - f) };
        const m2 = { x: pa.x + (pb.x - pa.x) * (0.5 + f), z: pa.z + (pb.z - pa.z) * (0.5 + f) };
        segs.push([pa.x, pa.z, m1.x, m1.z], [m2.x, m2.z, pb.x, pb.z]);
        if (puertaP && !puertaP.abierta) segs.push([m1.x, m1.z, m2.x, m2.z]);
      } else segs.push([pa.x, pa.z, pb.x, pb.z]);
    }
  }
  return { segs, circulos };
}
function resolverColision(x, z, k) {
  const R = 0.32;
  const { segs, circulos } = segmentosBloqueo(k);
  for (let it = 0; it < 3; it++) {
    for (const [x1, z1, x2, z2] of segs) {
      const dx = x2 - x1, dz = z2 - z1;
      const l2 = dx * dx + dz * dz;
      let u = ((x - x1) * dx + (z - z1) * dz) / l2;
      u = Math.max(0, Math.min(1, u));
      const px = x1 + u * dx, pz = z1 + u * dz;
      const ex = x - px, ez = z - pz, d = Math.hypot(ex, ez);
      const lim = R + 0.14;
      if (d < lim && d > 1e-6) { x = px + ex / d * lim; z = pz + ez / d * lim; }
    }
    for (const o of circulos) {
      const ex = x - o.x, ez = z - o.z, d = Math.hypot(ex, ez), lim = R + o.r;
      if (d < lim && d > 1e-6) { x = o.x + ex / d * lim; z = o.z + ez / d * lim; }
    }
  }
  return { x, z };
}
// altura del suelo bajo el jugador en su planta; baja de planta si no hay suelo
// Escalera de tablas bajo el jugador: se sube andando. Devuelve { k, y } o null.
// Si vienes por debajo del tramo alto (o caes por el hueco desde arriba muy por encima), no cuenta.
function escaleraBajoJugador() {
  for (const c of mundo.construcciones) {
    const l = mundoALocal(c, pj.x, pj.z);
    const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
    for (const k0 of [pj.k, pj.k - 1]) {
      if (k0 < 0) continue;
      const p = escaleraAndando(c, i, j, k0);
      if (!p) continue;
      const t = progresoEscalera(p, l.lx, l.lz);
      const base = c.piezas.has(clave('f', i, j, k0)) ? (k0 === 0 ? P.superficieCimiento : P.superficieSuelo) : 0;
      const y0 = k0 * ALTURA + base, y1 = (k0 + 1) * ALTURA + P.superficieSuelo;
      const y = y0 + t * (y1 - y0);
      if (pj.k === k0 && y - pj.y > 0.8) continue; // estás debajo de la escalera, no encima
      return { k: t > 0.5 ? k0 + 1 : k0, y };
    }
  }
  return null;
}
function alturaSuelo() {
  const e = escaleraBajoJugador();
  if (e) { pj.k = e.k; return e.y; }
  for (let k = pj.k; k >= 0; k--) {
    for (const c of mundo.construcciones) {
      const l = mundoALocal(c, pj.x, pj.z);
      const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
      const f = c.piezas.get(clave('f', i, j, k));
      if (f) { pj.k = k; return k * ALTURA + (k === 0 ? P.superficieCimiento : P.superficieSuelo); }
    }
    if (k === 0) { pj.k = 0; return 0; }
  }
  return 0;
}

const reloj = new THREE.Clock();
function paso() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  // entrada de movimiento relativa a la cámara
  let ax = 0, az = 0;
  if (teclas.has('w') || teclas.has('arrowup')) az -= 1;
  if (teclas.has('s') || teclas.has('arrowdown')) az += 1;
  if (teclas.has('a') || teclas.has('arrowleft')) ax -= 1;
  if (teclas.has('d') || teclas.has('arrowright')) ax += 1;
  ax += joy.vx; az += joy.vy;
  if (teclas.has('q')) cam.yaw += dt * 1.6;
  if (teclas.has('e')) cam.yaw -= dt * 1.6;
  const mag = Math.min(1, Math.hypot(ax, az));
  const correr = teclas.has('shift');
  const vel = (correr ? 6 : 3.6) * mag;
  if (mag > 0.05) {
    estado.talando = null; // moverse deja de talar
    const s = Math.sin(cam.yaw), co = Math.cos(cam.yaw);
    const dx = (ax * co + az * s) / Math.hypot(ax, az);
    const dz = (-ax * s + az * co) / Math.hypot(ax, az);
    let nx = pj.x + dx * vel * dt, nz = pj.z + dz * vel * dt;
    const r = resolverColision(nx, nz, pj.k);
    pj.x = THREE.MathUtils.clamp(r.x, -190, 190); pj.z = THREE.MathUtils.clamp(r.z, -190, 190);
    const objetivoRot = Math.atan2(dx, dz);
    let dr = objetivoRot - pj.rot;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    pj.rot += dr * Math.min(1, dt * 12);
    // en táctil, el puntero de construcción acompaña al personaje
    if (estado.esTactil && estado.modo === 'construir' && estado.punteroSigue) {
      estado.puntero = { x: pj.x + Math.sin(pj.rot) * 3, z: pj.z + Math.cos(pj.rot) * 3, ySuperficie: 0 };
      evaluarColocacion();
    }
  }
  pj.vel = vel;
  const yObjetivo = alturaSuelo();
  pj.y += (yObjetivo - pj.y) * Math.min(1, dt * 14);
  jugador.raiz.position.set(pj.x, pj.y, pj.z);
  jugador.raiz.rotation.y = pj.rot;
  jugador.animar(mag > 0.05 ? vel : 0, dt, !!estado.talando);

  // interiores: ocultar plantas superiores y tejados si estás bajo techo
  for (const g of raizConstr.children) {
    const c = g.userData.c;
    const l = mundoALocal(c, pj.x, pj.z);
    const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
    let techo = false;
    for (let k = pj.k + 1; k <= 4 && !techo; k++) if (c.piezas.has(clave('f', i, j, k)) || c.piezas.has(clave('r', i, j, k))) techo = true;
    for (const obj of g.children) obj.visible = !techo || obj.userData.k <= pj.k;
  }
  const it = interactivoCercano();
  $('btnUsar').classList.toggle('activo', !!it || !!arbolCercano());

  moverGente(dt);
  actualizarCamara();
  renderer.render(escena, camara);
  requestAnimationFrame(paso);
}

// ---------------- Interfaz ----------------
const CATEGORIAS = [
  ['tierra', t('catTierra')], ['base', t('catBase')], ['estructura', t('catEstructura')], ['muro', t('catMuros')],
  ['tejado', t('catTejados')], ['acceso', t('catAcceso')], ['exterior', t('catExterior')], ['deco', t('catDeco')],
];
let categoria = 'base';
function construirBarra() {
  const tabs = $('pestanas'); tabs.innerHTML = '';
  for (const [id, nombre] of CATEGORIAS) {
    const b = document.createElement('button');
    b.textContent = nombre; b.dataset.cat = id;
    b.className = id === categoria ? 'sel' : '';
    b.onclick = () => { categoria = id; construirBarra(); };
    tabs.appendChild(b);
  }
  const lista = $('piezas'); lista.innerHTML = '';
  const entradas = categoria === 'deco'
    ? Object.entries(DECORACION).map(([k, d]) => ({ clase: 'deco', tipo: k, def: d }))
    : Object.entries(PIEZAS).filter(([, d]) => d.cat === categoria).map(([k, d]) => ({ clase: k === 'mojon' ? 'mojon' : 'pieza', tipo: k, def: d }));
  for (const e of entradas) {
    const b = document.createElement('button');
    b.className = 'pieza' + (estado.sel.tipo === e.tipo ? ' sel' : '');
    const coste = Object.entries(e.def.coste).map(([m, n]) => `${n} ${tr(MATERIALES[m]).toLowerCase()}`).join(' · ');
    b.innerHTML = `<b>${tr(e.def.nombre)}</b><small>${coste}</small>`;
    b.onclick = () => {
      estado.sel = { clase: e.clase, tipo: e.tipo };
      estado.dir = 0;
      if (estado.modo !== 'construir') cambiarModo('construir');
      construirBarra(); evaluarColocacion();
    };
    lista.appendChild(b);
  }
}
function marcarSeleccion() { categoria = estado.sel.clase === 'deco' ? 'deco' : (estado.sel.clase === 'mojon' ? 'tierra' : PIEZAS[estado.sel.tipo].cat); construirBarra(); }

function actualizarUI() {
  const m = $('materiales');
  m.innerHTML = Object.entries(MATERIALES).map(([k, n]) => `<span><b>${mundo.materiales[k] ?? 0}</b> ${tr(n).toLowerCase()}</span>`).join('');
  for (const b of document.querySelectorAll('#modos button')) b.classList.toggle('sel', b.dataset.modo === estado.modo);
  $('barra').hidden = estado.modo !== 'construir';
  $('btnColocar').hidden = !(estado.modo === 'construir' && estado.esTactil);
  $('btnGirar').hidden = estado.modo !== 'construir';
  $('controlPlanta').hidden = estado.modo !== 'construir';
  document.body.classList.toggle('construyendo', estado.modo === 'construir');
  $('planta').textContent = `${t('planta')} ${estado.planta}`;
  if (!mundo.mojon && estado.modo !== 'construir') mostrarAviso(t('consejoMojon'));
}
let temporizadorAviso = null;
function mostrarAviso(txt, error = false) {
  const a = $('aviso');
  a.textContent = txt;
  a.className = error ? 'error' : '';
  a.hidden = !txt;
  colocarAviso();
}

for (const b of document.querySelectorAll('#modos button')) b.onclick = () => cambiarModo(b.dataset.modo);
$('btnGirar').onclick = girar;
$('btnColocar').onclick = colocar;
$('btnSube').onclick = () => cambiarPlanta(1);
$('btnBaja').onclick = () => cambiarPlanta(-1);
$('btnUsar').onclick = usar;
$('btnConfirmar').onclick = confirmarDesmontaje;
$('btnCancelar').onclick = () => { $('confirmar').hidden = true; limpiarResaltado(); estado.pendienteDesmontar = null; mostrarAviso(''); };
$('btnRellenar').onclick = () => { accion({ tipo: 'rellenar', cantidad: 50 }); guardar(); actualizarUI(); evaluarColocacion(); };
{
  let armado = false, tmr = null;
  $('btnReiniciar').onclick = () => {
    if (!armado) {
      armado = true; mostrarAviso(t('confirmaReinicio'), true);
      clearTimeout(tmr); tmr = setTimeout(() => { armado = false; }, 4000);
      return;
    }
    armado = false;
    mundo = new Mundo(); registroAcciones = new RegistroAcciones(); guardar(); reconstruir(); cambiarModo('mover');
  };
}
$('btnRegistro').onclick = () => { $('panelRegistro').hidden = !$('panelRegistro').hidden; $('panelAyuda').hidden = true; };
$('btnAyuda').onclick = () => { $('panelAyuda').hidden = !$('panelAyuda').hidden; $('panelRegistro').hidden = true; };
for (const b of document.querySelectorAll('.cerrar')) b.onclick = () => { b.closest('.panel').hidden = true; };
$('listaRegistro').innerHTML = REGISTRO.map(r => `<li>${tr(r)}</li>`).join('');
$('version').textContent = tr(VERSION);
$('ayudaPC').hidden = estado.esTactil;
$('ayudaTactil').hidden = !estado.esTactil;
$('joystick').hidden = !estado.esTactil;
$('chkSigue').onchange = (e) => { estado.punteroSigue = e.target.checked; };
estado.punteroSigue = false;
$('filaSigue').hidden = !estado.esTactil;

function redimensionar() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camara.aspect = w / h; camara.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();
construirBarra();
reconstruir();
actualizarUI();
paso();

// acceso para pruebas automáticas
window.__kinhold = {
  get mundo() { return mundo; }, estado, pj, cam, escena, renderer, jugador, obstaculos,
  cambiarModo, colocar, girar, cambiarPlanta, usar, confirmarDesmontaje,
  seleccionar(clase, tipo) { estado.sel = { clase, tipo }; estado.dir = 0; marcarSeleccion(); evaluarColocacion(); },
  apuntar(x, z, y = 0) { estado.puntero = { x, z, ySuperficie: y }; evaluarColocacion(); },
  apuntarPieza(cx, cy) { evaluarDesmontaje(piezaBajo(cx, cy)); },
  proyectar(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camara); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  reiniciar() { mundo = new Mundo(); registroAcciones = new RegistroAcciones(); reconstruir(); },
  get registroAcciones() { return registroAcciones; },
  reconstruir() { reconstruir(); },
  render() { renderer.render(escena, camara); },
};
