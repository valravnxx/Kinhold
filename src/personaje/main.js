// Kinhold — personaje v2: bases CC0 (Quaternius) con personalización, delante de la cabaña de la prueba de estilo.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUCES } from '../mundo/estilos.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { vigilar } from '../mundo/rendimiento.js';
import { crearEscena } from '../estilo/escena.js';
import { crearPersonaje, OPCIONES } from '../personajes/cargar.js';
import { crearPersonajeMH } from '../personajes/makehuman.js';
import { VERSION_PERSONAJE, REGISTRO_PERSONAJE } from './registro.js';
import { BASES, CAPAS, ANIMS } from './textos.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('estilos'));
// En el móvil, el panel de opciones y el resumen quedan justo encima de la barra de vistas de abajo, que en
// otros idiomas (ruso) puede ocupar dos filas: se colocan según lo que mide de verdad.
function colocarPaneles() {
  const inf = document.getElementById('inferior');
  for (const id of ['opciones', 'resumen']) {
    const el = document.getElementById(id);
    if (!el || !inf) continue;
    el.style.bottom = innerWidth > 600 ? '' : Math.ceil(innerHeight - inf.getBoundingClientRect().top + 8) + 'px';
  }
}
requestAnimationFrame(colocarPaneles);
addEventListener('resize', colocarPaneles);

const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_personaje_v2';
// carpeta de los modelos: la versión publicada vive en jugar/personaje/, los modelos en recursos/personajes/v1/
const RECURSOS = new URLSearchParams(location.search).get('recursos') || '../../recursos/personajes/v1/';
// personajes del taller propio (MakeHuman vestido por código), en recursos/personajes/taller-v6/ (las anteriores publicadas no se tocan)
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v6/';
// capas puestas en el taller propio, por sexo (por defecto: túnica en el hombre, vestido en la mujer)
const capasMH = () => (estado.capas && estado.capas[estado.sexo]) || [estado.sexo === 'mujer' ? 'vestido' : 'tunica'];

const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
prepararRenderer(renderer); // sombras blandas, sRGB y ACES: los de la escena común
vigilar(renderer); // fotogramas, triángulos y memoria (src/mundo/rendimiento.js)
const camara = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
const control = new OrbitControls(camara, lienzo);
control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.55; control.minDistance = 0.35; control.maxDistance = 25;

const escena = new THREE.Scene();
escena.add(crearEscena());
// cielo (lo pinta la página), sol, luz del cielo y niebla: el ambiente común (src/mundo/ambiente.js)
const ambiente = crearAmbiente(escena, { alcance: 12, normalBias: 0.03, fondoPagina: true }), sol = ambiente.sol;

const POS = new THREE.Vector3(1.6, 0, 4.8), GIRO = 0.45;
const rel = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), GIRO).add(POS);
// la cara se encuadra con la altura real de la cabeza (las mujeres son algo más bajas)
const alturaCara = () => { if (!pj) return 1.6; const v = new THREE.Vector3(); pj.hueso.Head.getWorldPosition(v); return v.y + 0.08; };
const VISTAS = {
  cuerpo:  () => [rel(0.9, 1.35, 3.1), rel(0, 0.9, 0)],
  cara:    () => { const y = alturaCara(); return [rel(0.22, y + 0.03, 0.78), rel(0, y - 0.02, 0)]; },
  perfil:  () => { const y = alturaCara(); return [rel(0.78, y + 0.02, 0.12), rel(0, y - 0.02, 0.02)]; },
  espalda: () => [rel(-1.9, 1.4, -1.6), rel(0, 1.0, 0)],
};

// calidad alta en todos lados (en el móvil de Pedro va perfecto); la ligera queda como opción
const TACTIL = matchMedia('(pointer: coarse)').matches;
let estado = { luz: 'manana', vista: 'cuerpo', modo: 'quieto', sexo: 'hombre', ropa: 'campesino', pelo: 'raya', colorPelo: 'castano', piel: 'clara', barba: 'si', calidad: 'alta' };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'cuerpo';
if (!ANIMS[estado.modo]) estado.modo = 'quieto';
if (estado.ropa !== 'campesino') estado.ropa = 'campesino'; // el explorador era demasiado de fantasía (Pedro)
estado.sombras ??= true; estado.escena ??= true;
if (!BASES[estado.base]) estado.base = 'makehuman'; // Pedro eligió el taller propio como base (25 oct)
// la v3 ponía «ligera» sola en el móvil: si no la eligió Pedro a mano, vuelve a alta
if (!estado.calidadElegida) estado.calidad = 'alta';
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

let pj = null, cargando = 0;
async function rehacer() {
  const n = ++cargando;
  $('cargando').hidden = false;
  if (!OPCIONES.pelo[estado.sexo][estado.pelo]) estado.pelo = Object.keys(OPCIONES.pelo[estado.sexo])[0];
  const nuevo = estado.base === 'makehuman' ? await crearPersonajeMH({ ...estado, capas: capasMH() }, RECURSOS_MH) : await crearPersonaje(estado, RECURSOS);
  if (n !== cargando) return; // llegó otro cambio mientras cargaba
  if (pj) escena.remove(pj.raiz);
  pj = nuevo;
  pj.raiz.position.copy(POS); pj.raiz.rotation.y = GIRO;
  escena.add(pj.raiz);
  pj.poner(estado.modo, 0); pj.mezclador.update(0.5);
  pj.raiz.updateMatrixWorld(true);
  if (estado.vista === 'cara' || estado.vista === 'perfil') ponerVista(estado.vista);
  medida.trianglesPersonaje = pj.triangulos;
  $('cargando').hidden = true;
  pintarOpciones(); guardar(); dibujar();
}

function ponerLuz(id) {
  estado.luz = id = ambiente.ponerLuz(id);
  marcar('luz', id); guardar(); dibujar();
}
function ponerVista(v) {
  estado.vista = v;
  const [pos, mira] = VISTAS[v]();
  if (camara.aspect < 1) pos.sub(mira).multiplyScalar(v === 'espalda' ? 1.15 : 1.45).add(mira);
  camara.position.copy(pos); control.target.copy(mira); control.update();
  marcar('vista', v); guardar(); dibujar();
}
function ponerModo(m) { estado.modo = m; if (pj) pj.poner(m); marcar('modo', m); guardar(); }
function marcar(tipo, v) { for (const b of document.querySelectorAll(`[data-${tipo}]`)) b.classList.toggle('sel', b.dataset[tipo] === v); }

// panel de personalización
function pintarOpciones() {
  const grupo = (clave, valores, titulo) => `<div class="grupo"><span>${tr(titulo)}</span>${Object.entries(valores).map(([k, v]) =>
    `<button data-op="${clave}" data-v="${k}" class="${estado[clave] === k ? 'sel' : ''}">${Array.isArray(v) ? `<i style="background:#${new THREE.Color(v[1]).getHexString()}"></i>${tr(v[0])}` : tr(v)}</button>`).join('')}</div>`;
  const mh = estado.base === 'makehuman';
  $('opciones').innerHTML = grupo('base', BASES, 'Base del personaje') + grupo('sexo', OPCIONES.sexo, 'Cuerpo') +
    (mh ? `<div class="grupo"><span>${tr(estado.sexo === 'hombre' ? 'Ropa por capas (debajo siempre camisa, calzas y zapatos)' : 'Ropa por capas (debajo siempre camisa y zapatos)')}</span>${(pj?.capasPosibles || []).map(c =>
        `<button data-capa="${c}" class="${capasMH().includes(c) ? 'sel' : ''}">${tr(CAPAS[c])}</button>`).join('')}</div>` +
      `<div class="grupo"><span>${tr('Taller propio: pelo, piel y cara aún no se cambian.')}</span></div>`
      : grupo('ropa', { campesino: OPCIONES.ropa.campesino }, 'Ropa') + grupo('pelo', OPCIONES.pelo[estado.sexo], 'Pelo') +
    grupo('colorPelo', OPCIONES.colorPelo, 'Color del pelo') + grupo('piel', OPCIONES.piel, 'Piel') + (estado.sexo === 'hombre' ? grupo('barba', OPCIONES.barba, 'Barba') : '')) +
    grupo('calidad', { alta: 'Alta', ligera: 'Ligera (móvil)' }, 'Calidad') +
    `<div class="grupo"><span>${tr('Prueba de rendimiento (mira los fps arriba)')}</span><button data-diag="sombras" class="${estado.sombras ? 'sel' : ''}">${tr('Sombras')}</button><button data-diag="escena" class="${estado.escena ? 'sel' : ''}">${tr('Cabaña y suelo')}</button></div>` +
    `<div class="grupo"><span>${tr('Animación')}</span>${Object.entries(ANIMS).map(([k, v]) => `<button data-modo="${k}" class="${estado.modo === k ? 'sel' : ''}">${tr(v)}</button>`).join('')}</div>`;
  for (const b of $('opciones').querySelectorAll('[data-op]')) b.onclick = () => { estado[b.dataset.op] = b.dataset.v; if (b.dataset.op === 'calidad') estado.calidadElegida = true; rehacer(); };
  for (const b of $('opciones').querySelectorAll('[data-modo]')) b.onclick = () => ponerModo(b.dataset.modo);
  for (const b of $('opciones').querySelectorAll('[data-capa]')) b.onclick = () => {
    const l = capasMH(), c = b.dataset.capa;
    estado.capas = { ...(estado.capas || {}), [estado.sexo]: l.includes(c) ? l.filter(x => x !== c) : [...l, c] };
    if (pj?.ponerCapas) { pj.ponerCapas(capasMH()); medida.trianglesPersonaje = pj.triangulos; }
    pintarOpciones(); guardar(); dibujar();
  };
  for (const b of $('opciones').querySelectorAll('[data-diag]')) b.onclick = () => { estado[b.dataset.diag] = !estado[b.dataset.diag]; aplicarDiag(); pintarOpciones(); guardar(); };
}

// interruptores para averiguar en el móvil qué pesa: sombras y escenario
const decorado = escena.children[0];
function aplicarDiag() {
  decorado.visible = estado.escena;
  if (renderer.shadowMap.enabled !== estado.sombras) {
    renderer.shadowMap.enabled = estado.sombras;
    escena.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }
  dibujar();
}
const RES_MAX = Math.min(devicePixelRatio || 1, 2);
let resolucion = Math.min(RES_MAX, 1.5);
const RES_MIN = TACTIL ? 0.5 : 0.75;
function ajustar() {
  renderer.setPixelRatio(resolucion); renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight; camara.fov = camara.aspect < 1 ? 40 : 30; camara.updateProjectionMatrix();
}
addEventListener('resize', () => { ajustar(); dibujar(); });

const medida = { fps: 0, triangulos: 0, dibujados: 0, trianglesPersonaje: 0 };
let pausado = false, antes = performance.now();
function dibujar() { renderer.render(escena, camara); medida.triangulos = renderer.info.render.triangles; medida.dibujados = renderer.info.render.calls; }
control.addEventListener('change', () => { if (pausado) dibujar(); });
let cuenta = 0, t0 = performance.now(), ventanas = 0;
function bucle() {
  requestAnimationFrame(bucle);
  const ahora = performance.now(), dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
  if (pausado) return;
  if (pj) pj.mezclador.update(dt);
  control.update(); dibujar(); cuenta++;
  if (ahora - t0 >= 2000) {
    medida.fps = Math.round(cuenta * 1000 / (ahora - t0)); ventanas++;
    if (medida.fps < 50 && resolucion > RES_MIN) { resolucion = Math.max(RES_MIN, resolucion - 0.25); ajustar(); }
    else if (medida.fps >= 59 && resolucion < RES_MAX && ventanas > 2) { resolucion = Math.min(RES_MAX, resolucion + 0.25); ajustar(); }
    $('medida').textContent = tr('{f} fps · resolución {r}× · personaje {p} mil triángulos · escena {t} mil · {d} dibujados', { f: medida.fps, r: resolucion, p: (medida.trianglesPersonaje / 1000).toFixed(1), t: (medida.triangulos / 1000).toFixed(1), d: medida.dibujados });
    cuenta = 0; t0 = ahora;
  }
}

for (const b of document.querySelectorAll('[data-luz]')) b.onclick = () => ponerLuz(b.dataset.luz);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('btnOpciones').onclick = () => { $('opciones').hidden = !$('opciones').hidden; $('btnOpciones').classList.toggle('sel', !$('opciones').hidden); };
$('notas').innerHTML = `<b>${tr(VERSION_PERSONAJE)}</b><ul>${REGISTRO_PERSONAJE.map(t => `<li>${tr(t)}</li>`).join('')}</ul>`;

// en el móvil el panel tapa medio personaje: empieza cerrado
if (TACTIL) { $('opciones').hidden = true; $('btnOpciones').classList.remove('sel'); }
ajustar();
aplicarDiag();
ponerLuz(estado.luz);
ponerVista(estado.vista);
rehacer().catch(e => { $('cargando').textContent = tr('No se pudo cargar el personaje: {e}', { e: e.message }); console.error(e); });
bucle();

window.__personaje = {
  ponerLuz, ponerVista, ponerModo, dibujar, pausar: (v) => { pausado = v; },
  listo: () => !!pj && $('cargando').hidden,
  cambiar: (o) => { Object.assign(estado, o); return rehacer(); },
  // fija el instante de la animación (para capturas repetibles)
  instante: (t) => {
    if (pj) {
      // solo la animación elegida, con todo su peso, en el instante t
      pj.mezclador.stopAllAction();
      const a = pj.acciones[estado.modo] || pj.acciones.quieto;
      a.reset().setEffectiveWeight(1).play(); a.time = t; pj.mezclador.update(0);
    }
    dibujar();
  },
  medida: () => { dibujar(); return { ...medida, triangulos: renderer.info.render.triangles, dibujados: renderer.info.render.calls }; },
  estado: () => ({ ...estado }),
  // milisegundos por fotograma dibujando n veces (para comparar calidades en las pruebas)
  tiempo: (n = 10) => { const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); dibujar(); sync(); const t = performance.now(); for (let i = 0; i < n; i++) { dibujar(); sync(); } return (performance.now() - t) / n; },
  diag: () => ({ escena, renderer, pj, sol, THREE }),
  hueso: (n) => { const v = new THREE.Vector3(); pj.hueso[n].getWorldPosition(v); return [v.x, v.y, v.z]; },
};
