// Kinhold — prueba de estilo v2: un solo estilo estilizado y ligero, con presupuesto medido.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUCES } from './estilos.js';
import { crearEscena } from './escena.js';
import { VERSION_ESTILO, REGISTRO_ESTILO } from './registro.js';

const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_estilo_v2';
// Presupuesto de la escena (lo comprueban las pruebas)
export const PRESUPUESTO = { triangulos: 30000, dibujados: 60 };

const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const control = new OrbitControls(camara, lienzo);
control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.48; control.minDistance = 1.5; control.maxDistance = 45;

const VISTAS = {
  escena: () => { const mira = new THREE.Vector3(0.3, 1.6, 0.6), k = camara.aspect < 1 ? 1.75 : 1; return [mira.clone().add(new THREE.Vector3(8.4, 3.0, 10.8).multiplyScalar(k)), mira]; },
  cabana: () => [new THREE.Vector3(4.6, 2.3, 4.9), new THREE.Vector3(1.0, 1.7, 1.3)],
  bosque: () => [new THREE.Vector3(-13, 1.7, 9), new THREE.Vector3(0, 2.2, 0)],
};

let estado = { luz: 'manana', vista: 'escena' };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'escena';
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

// ---------- Escena: se construye una vez; cambiar la luz solo cambia luces, niebla y cielo ----------
const escena = new THREE.Scene();
escena.add(crearEscena());
const hemi = new THREE.HemisphereLight();
const sol = new THREE.DirectionalLight();
sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 70 });
sol.shadow.bias = -0.0008; sol.shadow.normalBias = 0.06;
sol.target.position.set(0, 0, 1);
escena.add(hemi, sol, sol.target);
// cielo: esfera con degradado en los vértices (sin texturas, sin luces)
const cieloGeo = new THREE.SphereGeometry(200, 16, 10);
const cielo = new THREE.Mesh(cieloGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
escena.add(cielo);

function ponerLuz(id) {
  estado.luz = id; const L = LUCES[id];
  sol.color.set(L.sol[0]); sol.intensity = L.sol[1]; sol.position.set(...L.sol[2]);
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  escena.fog = new THREE.Fog(L.niebla[0], L.niebla[1], L.niebla[2]);
  escena.background = new THREE.Color(L.niebla[0]);
  const alto = new THREE.Color(L.cielo[0]), bajo = new THREE.Color(L.cielo[1]), p = cieloGeo.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / 200); c.copy(bajo).lerp(alto, Math.pow(t, 0.6)); col.push(c.r, c.g, c.b); }
  cieloGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  for (const b of document.querySelectorAll('[data-luz]')) b.classList.toggle('sel', b.dataset.luz === id);
  guardar(); dibujar();
}
function ponerVista(v) {
  estado.vista = v;
  const [pos, mira] = VISTAS[v]();
  if (camara.aspect < 1 && v !== 'escena') pos.sub(mira).multiplyScalar(1.6).add(mira); // en vertical, más lejos para que quepa
  camara.position.copy(pos); control.target.copy(mira); control.update();
  for (const b of document.querySelectorAll('[data-vista]')) b.classList.toggle('sel', b.dataset.vista === v);
  guardar(); dibujar();
}

// ---------- Resolución adaptativa ----------
// Empieza a 1,5× como mucho; si en 2 s no llega a 50 fps baja un escalón (hasta 0,75×); si va sobrado, sube.
const RES_MAX = Math.min(devicePixelRatio || 1, 2);
let resolucion = Math.min(RES_MAX, 1.5);
function ajustar() {
  renderer.setPixelRatio(resolucion);
  renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight; camara.fov = camara.aspect < 1 ? 55 : 40; camara.updateProjectionMatrix();
}
addEventListener('resize', () => { ajustar(); dibujar(); });

const medida = { fps: 0, ms: 0, triangulos: 0, dibujados: 0, resolucion };
let pausado = false; // las pruebas automáticas paran el bucle y dibujan a mano (sin tarjeta gráfica va muy lento)
function dibujar() { renderer.render(escena, camara); medida.triangulos = renderer.info.render.triangles; medida.dibujados = renderer.info.render.calls; }
control.addEventListener('change', () => { if (pausado) dibujar(); });
let cuenta = 0, t0 = performance.now(), ventanas = 0;
function bucle() {
  requestAnimationFrame(bucle);
  if (pausado) return;
  control.update();
  dibujar(); cuenta++;
  const t = performance.now();
  if (t - t0 >= 2000) {
    medida.fps = Math.round(cuenta * 1000 / (t - t0)); ventanas++;
    if (medida.fps < 50 && resolucion > 0.75) { resolucion = Math.max(0.75, resolucion - 0.25); ajustar(); }
    else if (medida.fps >= 59 && resolucion < RES_MAX && ventanas > 2) { resolucion = Math.min(RES_MAX, resolucion + 0.25); ajustar(); }
    medida.resolucion = resolucion;
    $('medida').textContent = `${medida.fps} fps · resolución ${resolucion}× · ${(medida.triangulos / 1000).toFixed(1)} mil triángulos · ${medida.dibujados} dibujados`;
    cuenta = 0; t0 = t;
  }
}

// ---------- Interfaz ----------
for (const b of document.querySelectorAll('[data-luz]')) b.onclick = () => ponerLuz(b.dataset.luz);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('notas').innerHTML = `<b>${VERSION_ESTILO}</b><ul>${REGISTRO_ESTILO.map(t => `<li>${t}</li>`).join('')}</ul>`;

ajustar();
ponerLuz(estado.luz);
ponerVista(estado.vista);
bucle();

// para las pruebas automáticas
window.__estilo = {
  ponerLuz, ponerVista, dibujar, pausar: (v) => { pausado = v; },
  medida: () => { dibujar(); return { ...medida, triangulos: renderer.info.render.triangles, dibujados: renderer.info.render.calls }; },
  estado: () => ({ ...estado }), PRESUPUESTO,
};
