// Kinhold — pruebas de estilo (hito 1b): la misma escena dibujada de tres maneras.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ESTILOS, hornear } from './estilos.js';
import { crearPersonaje } from './personaje.js';
import { crearEscena } from './escena.js';
import { VERSION_ESTILO, REGISTRO_ESTILO } from './registro.js';

const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_estilo_v1';

const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camara = new THREE.PerspectiveCamera(40, 1, 0.05, 300);
const control = new OrbitControls(camara, lienzo);
control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.49; control.minDistance = 0.3; control.maxDistance = 40;

const POS_PERSONAJE = new THREE.Vector3(1.3, 0, 3.4), GIRO_PERSONAJE = 0.35;
// vistas: [posición de cámara, punto mirado] relativas al mundo
const VISTAS = {
  escena:    () => { // en vertical la cámara se aleja para que quepa la cabaña entera
    const mira = new THREE.Vector3(0.3, 1.5, 0.8), lejos = camara.aspect < 1 ? 1.7 : 1;
    return [mira.clone().add(new THREE.Vector3(8.2, 2.7, 10.7).multiplyScalar(lejos)), mira];
  },
  personaje: () => [POS_PERSONAJE.clone().add(new THREE.Vector3(0.9, 1.25, 2.7)), POS_PERSONAJE.clone().add(new THREE.Vector3(0, 0.92, 0))],
  cara:      () => [POS_PERSONAJE.clone().add(new THREE.Vector3(0.28, 1.68, 0.72)), POS_PERSONAJE.clone().add(new THREE.Vector3(0.02, 1.64, 0))],
};

let estado = { estilo: 'B', vista: 'escena' };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!ESTILOS[estado.estilo]) estado.estilo = 'B';
if (!VISTAS[estado.vista]) estado.vista = 'escena';
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

let escena = null;
function construir() {
  const E = ESTILOS[estado.estilo];
  if (escena) escena.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  escena = new THREE.Scene();
  escena.background = new THREE.Color(E.cielo);
  escena.fog = new THREE.Fog(E.niebla[0], E.niebla[1], E.niebla[2]);
  renderer.toneMapping = E.tono; renderer.toneMappingExposure = E.exposicion;
  const hemi = new THREE.HemisphereLight(E.cieloLuz[0], E.cieloLuz[1], E.cieloLuz[2]);
  const sol = new THREE.DirectionalLight(E.sol.color, E.sol.fuerza);
  sol.position.set(...E.sol.pos); sol.target.position.set(0, 0, 1);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.radius = E.sombraSuave;
  Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02;
  escena.add(hemi, sol, sol.target);
  escena.add(crearEscena(E));
  const pj = crearPersonaje(E);
  pj.position.copy(POS_PERSONAJE); pj.rotation.y = GIRO_PERSONAJE;
  pj.userData.rangoAO = 0.3;
  escena.add(pj); hornear(pj, E);
  lienzo.style.filter = E.filtro;
  $('vineta').style.opacity = E.vineta;
  $('resumen').textContent = E.resumen;
  for (const b of document.querySelectorAll('[data-estilo]')) b.classList.toggle('sel', b.dataset.estilo === estado.estilo);
  renderer.render(escena, camara);
  medida.triangulos = renderer.info.render.triangles;
}
function ponerVista(v) {
  estado.vista = v;
  const [pos, mira] = VISTAS[v]();
  camara.position.copy(pos); control.target.copy(mira); control.update();
  for (const b of document.querySelectorAll('[data-vista]')) b.classList.toggle('sel', b.dataset.vista === v);
  guardar();
}
function ponerEstilo(id) { estado.estilo = id; construir(); guardar(); }

function ajustar() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camara.aspect = w / h;
  camara.fov = w < h ? 55 : 40; // en vertical, más campo para que quepa el personaje
  camara.updateProjectionMatrix();
}
addEventListener('resize', ajustar);

// ---------- medida de rendimiento (fotogramas reales, no estimados) ----------
const medida = { fps: 0, ms: 0, triangulos: 0, llamadas: 0 };
let cuenta = 0, t0 = performance.now(), msTotal = 0;
let pausado = false; // las pruebas automáticas paran el bucle y dibujan a mano (el navegador sin tarjeta gráfica es muy lento)
function dibujar() { renderer.render(escena, camara); }
control.addEventListener('change', () => { if (pausado) dibujar(); });
function bucle() {
  requestAnimationFrame(bucle);
  if (pausado) return;
  const a = performance.now();
  control.update();
  renderer.render(escena, camara);
  msTotal += performance.now() - a; cuenta++;
  const t = performance.now();
  if (t - t0 >= 1000) {
    medida.fps = Math.round(cuenta * 1000 / (t - t0)); medida.ms = +(msTotal / cuenta).toFixed(1);
    medida.triangulos = renderer.info.render.triangles; medida.llamadas = renderer.info.render.calls;
    $('medida').textContent = `${medida.fps} fps · ${(medida.triangulos / 1000).toFixed(0)} mil triángulos · ${medida.llamadas} dibujados`;
    cuenta = 0; msTotal = 0; t0 = t;
  }
}

// ---------- interfaz ----------
for (const b of document.querySelectorAll('[data-estilo]')) b.onclick = () => ponerEstilo(b.dataset.estilo);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('notas').innerHTML = `<b>${VERSION_ESTILO}</b><ul>${REGISTRO_ESTILO.map(t => `<li>${t}</li>`).join('')}</ul>`;
for (const id of Object.keys(ESTILOS)) document.querySelector(`[data-estilo="${id}"]`).textContent = ESTILOS[id].nombre;

ajustar();
construir();
ponerVista(estado.vista);
bucle();

// para las pruebas automáticas
window.__estilo = { ponerEstilo, ponerVista, pausar: (v) => { pausado = v; }, dibujar, medida: () => ({ ...medida, triangulosAhora: renderer.info.render.triangles, llamadasAhora: renderer.info.render.calls }), estado: () => ({ ...estado }) };
