// Kinhold — personaje v2: bases CC0 (Quaternius) con personalización, delante de la cabaña de la prueba de estilo.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUCES } from '../estilo/estilos.js';
import { crearEscena } from '../estilo/escena.js';
import { crearPersonaje, OPCIONES } from '../personajes/cargar.js';
import { crearPersonajeMH } from '../personajes/makehuman.js';
import { VERSION_PERSONAJE, REGISTRO_PERSONAJE } from './registro.js';

const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_personaje_v2';
// carpeta de los modelos: la versión publicada vive en jugar/personaje/, los modelos en recursos/personajes/v1/
const RECURSOS = new URLSearchParams(location.search).get('recursos') || '../../recursos/personajes/v1/';
// personajes del taller propio (MakeHuman vestido por código), en recursos/personajes/taller-v1/
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v1/';
const BASES = { quaternius: 'Paquete Quaternius', makehuman: 'Taller propio (MakeHuman)' };

const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const camara = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
const control = new OrbitControls(camara, lienzo);
control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.55; control.minDistance = 0.35; control.maxDistance = 25;

const escena = new THREE.Scene();
escena.add(crearEscena());
const hemi = new THREE.HemisphereLight(), sol = new THREE.DirectionalLight();
sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 4;
Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.03;
escena.add(hemi, sol, sol.target);

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
const ANIMS = { quieto: 'Quieto', andar: 'Andar', talar: 'Talar', guardia: 'En guardia', golpe: 'Golpe', cargar: 'Cargar' };

// calidad alta en todos lados (en el móvil de Pedro va perfecto); la ligera queda como opción
const TACTIL = matchMedia('(pointer: coarse)').matches;
let estado = { luz: 'manana', vista: 'cuerpo', modo: 'quieto', sexo: 'hombre', ropa: 'campesino', pelo: 'raya', colorPelo: 'castano', piel: 'clara', barba: 'si', calidad: 'alta' };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'cuerpo';
if (!ANIMS[estado.modo]) estado.modo = 'quieto';
if (estado.ropa !== 'campesino') estado.ropa = 'campesino'; // el explorador era demasiado de fantasía (Pedro)
estado.sombras ??= true; estado.escena ??= true;
if (!BASES[estado.base]) estado.base = 'quaternius';
// la v3 ponía «ligera» sola en el móvil: si no la eligió Pedro a mano, vuelve a alta
if (!estado.calidadElegida) estado.calidad = 'alta';
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

let pj = null, cargando = 0;
async function rehacer() {
  const n = ++cargando;
  $('cargando').hidden = false;
  if (!OPCIONES.pelo[estado.sexo][estado.pelo]) estado.pelo = Object.keys(OPCIONES.pelo[estado.sexo])[0];
  const nuevo = estado.base === 'makehuman' ? await crearPersonajeMH(estado, RECURSOS_MH) : await crearPersonaje(estado, RECURSOS);
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
  estado.luz = id; const L = LUCES[id];
  sol.color.set(L.sol[0]); sol.intensity = L.sol[1]; sol.position.set(...L.sol[2]).multiplyScalar(1.6);
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  const [a, b] = L.fondo.map(c => '#' + new THREE.Color(c).getHexString());
  document.body.style.background = `linear-gradient(${b} 0%, ${a} 60%, ${a} 100%)`;
  escena.fog = new THREE.Fog(L.fondo[0], 45, 130);
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
  const grupo = (clave, valores, titulo) => `<div class="grupo"><span>${titulo}</span>${Object.entries(valores).map(([k, v]) =>
    `<button data-op="${clave}" data-v="${k}" class="${estado[clave] === k ? 'sel' : ''}">${Array.isArray(v) ? `<i style="background:#${new THREE.Color(v[1]).getHexString()}"></i>${v[0]}` : v}</button>`).join('')}</div>`;
  const mh = estado.base === 'makehuman';
  $('opciones').innerHTML = grupo('base', BASES, 'Base del personaje') + grupo('sexo', OPCIONES.sexo, 'Cuerpo') +
    (mh ? '<div class="grupo"><span>Taller propio: de momento un hombre (túnica, calzas, barba) y una mujer (vestido y cofia). Pelo, piel y ropa aún no se cambian.</span></div>'
      : grupo('ropa', { campesino: OPCIONES.ropa.campesino }, 'Ropa') + grupo('pelo', OPCIONES.pelo[estado.sexo], 'Pelo') +
    grupo('colorPelo', OPCIONES.colorPelo, 'Color del pelo') + grupo('piel', OPCIONES.piel, 'Piel') + (estado.sexo === 'hombre' ? grupo('barba', OPCIONES.barba, 'Barba') : '')) +
    grupo('calidad', { alta: 'Alta', ligera: 'Ligera (móvil)' }, 'Calidad') +
    `<div class="grupo"><span>Prueba de rendimiento (mira los fps arriba)</span><button data-diag="sombras" class="${estado.sombras ? 'sel' : ''}">Sombras</button><button data-diag="escena" class="${estado.escena ? 'sel' : ''}">Cabaña y suelo</button></div>` +
    `<div class="grupo"><span>Animación</span>${Object.entries(ANIMS).map(([k, v]) => `<button data-modo="${k}" class="${estado.modo === k ? 'sel' : ''}">${v}</button>`).join('')}</div>`;
  for (const b of $('opciones').querySelectorAll('[data-op]')) b.onclick = () => { estado[b.dataset.op] = b.dataset.v; if (b.dataset.op === 'calidad') estado.calidadElegida = true; rehacer(); };
  for (const b of $('opciones').querySelectorAll('[data-modo]')) b.onclick = () => ponerModo(b.dataset.modo);
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
    $('medida').textContent = `${medida.fps} fps · resolución ${resolucion}× · personaje ${(medida.trianglesPersonaje / 1000).toFixed(1)} mil triángulos · escena ${(medida.triangulos / 1000).toFixed(1)} mil · ${medida.dibujados} dibujados`;
    cuenta = 0; t0 = ahora;
  }
}

for (const b of document.querySelectorAll('[data-luz]')) b.onclick = () => ponerLuz(b.dataset.luz);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('btnOpciones').onclick = () => { $('opciones').hidden = !$('opciones').hidden; $('btnOpciones').classList.toggle('sel', !$('opciones').hidden); };
$('notas').innerHTML = `<b>${VERSION_PERSONAJE}</b><ul>${REGISTRO_PERSONAJE.map(t => `<li>${t}</li>`).join('')}</ul>`;

// en el móvil el panel tapa medio personaje: empieza cerrado
if (TACTIL) { $('opciones').hidden = true; $('btnOpciones').classList.remove('sel'); }
ajustar();
aplicarDiag();
ponerLuz(estado.luz);
ponerVista(estado.vista);
rehacer().catch(e => { $('cargando').textContent = 'No se pudo cargar el personaje: ' + e.message; console.error(e); });
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
