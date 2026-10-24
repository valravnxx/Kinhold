// Kinhold — prototipo del personaje por código (hito 1b), delante de la cabaña de la prueba de estilo v5.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUCES } from '../estilo/estilos.js';
import { crearEscena } from '../estilo/escena.js';
import { crearPersonaje, animar } from './cuerpo.js';
import { VERSION_PERSONAJE, REGISTRO_PERSONAJE } from './registro.js';

const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_personaje_v1';

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
const pj = crearPersonaje();
pj.position.copy(POS); pj.rotation.y = GIRO;
escena.add(pj);

// vistas relativas al personaje (en su marco: z hacia donde mira)
const rel = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), GIRO).add(POS);
const VISTAS = {
  cuerpo:  () => [rel(0.9, 1.35, 3.1), rel(0, 0.9, 0)],
  cara:    () => [rel(0.18, 1.69, 0.62), rel(0, 1.66, 0)],
  perfil:  () => [rel(0.62, 1.68, 0.12), rel(0, 1.66, 0.02)],
  manos:   () => [rel(0.75, 1.05, 0.55), rel(0.2, 0.84, 0)],
  espalda: () => [rel(-1.9, 1.4, -1.5), rel(0, 1.0, 0)],
};

let estado = { luz: 'manana', vista: 'cuerpo', modo: 'quieto' };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'cuerpo';
if (!['quieto', 'andar'].includes(estado.modo)) estado.modo = 'quieto';
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

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
function ponerModo(m) { estado.modo = m; marcar('modo', m); guardar(); animar(pj, reloj, m); dibujar(); }
function marcar(tipo, v) { for (const b of document.querySelectorAll(`[data-${tipo}]`)) b.classList.toggle('sel', b.dataset[tipo] === v); }

const RES_MAX = Math.min(devicePixelRatio || 1, 2);
let resolucion = Math.min(RES_MAX, 1.5);
function ajustar() {
  renderer.setPixelRatio(resolucion); renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight; camara.fov = camara.aspect < 1 ? 40 : 30; camara.updateProjectionMatrix();
}
addEventListener('resize', () => { ajustar(); dibujar(); });

const medida = { fps: 0, triangulos: 0, dibujados: 0, trianglesPersonaje: pj.geometry.index.count / 3 };
let pausado = false, reloj = 0, antes = performance.now();
function dibujar() { renderer.render(escena, camara); medida.triangulos = renderer.info.render.triangles; medida.dibujados = renderer.info.render.calls; }
control.addEventListener('change', () => { if (pausado) dibujar(); });
let cuenta = 0, t0 = performance.now(), ventanas = 0;
function bucle() {
  requestAnimationFrame(bucle);
  const ahora = performance.now(), dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
  if (pausado) return;
  reloj += dt;
  // andando, da vueltas en un círculo pequeño delante de la cabaña
  animar(pj, reloj, estado.modo);
  control.update(); dibujar(); cuenta++;
  if (ahora - t0 >= 2000) {
    medida.fps = Math.round(cuenta * 1000 / (ahora - t0)); ventanas++;
    if (medida.fps < 50 && resolucion > 0.75) { resolucion = Math.max(0.75, resolucion - 0.25); ajustar(); }
    else if (medida.fps >= 59 && resolucion < RES_MAX && ventanas > 2) { resolucion = Math.min(RES_MAX, resolucion + 0.25); ajustar(); }
    $('medida').textContent = `${medida.fps} fps · resolución ${resolucion}× · personaje ${(medida.trianglesPersonaje / 1000).toFixed(1)} mil triángulos · escena ${(medida.triangulos / 1000).toFixed(1)} mil · ${medida.dibujados} dibujados`;
    cuenta = 0; t0 = ahora;
  }
}

for (const b of document.querySelectorAll('[data-luz]')) b.onclick = () => ponerLuz(b.dataset.luz);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
for (const b of document.querySelectorAll('[data-modo]')) b.onclick = () => ponerModo(b.dataset.modo);
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('notas').innerHTML = `<b>${VERSION_PERSONAJE}</b><ul>${REGISTRO_PERSONAJE.map(t => `<li>${t}</li>`).join('')}</ul>`;

ajustar();
ponerLuz(estado.luz);
ponerModo(estado.modo);
ponerVista(estado.vista);
bucle();

window.__personaje = {
  ponerLuz, ponerVista, ponerModo, dibujar, pausar: (v) => { pausado = v; },
  // fija el instante de la animación (para capturas reproducibles)
  instante: (t) => { reloj = t; animar(pj, reloj, estado.modo); dibujar(); },
  medida: () => { dibujar(); return { ...medida, triangulos: renderer.info.render.triangles, dibujados: renderer.info.render.calls }; },
  estado: () => ({ ...estado }),
  // posición en pantalla de un hueso (para comprobar que la animación mueve de verdad)
  hueso: (n) => { const v = new THREE.Vector3(); pj.userData.huesos[pj.userData.H[n]].getWorldPosition(v); return [v.x, v.y, v.z]; },
};
