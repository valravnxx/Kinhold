// Kinhold — prueba de estilo: «realismo en miniatura» (la escena; el personaje está en el visor de personaje).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUCES } from '../mundo/estilos.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { crearEscena, RADIO } from './escena.js';
import { VERSION_ESTILO, REGISTRO_ESTILO } from './registro.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('estilos'));

const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_estilo_v4'; // misma clave: el campo «andar» de la v6-v8 se ignora; una vista de personaje guardada vuelve a la general
// Presupuesto de la escena (lo comprueban las pruebas)
// v3: 50 mil (la v2 tenía 30 mil): las formas redondeadas piden más triángulos; a cambio, 6 dibujados en vez de 12.
// v9: vuelve a 50 mil al quitar el muñeco por código (el de la v6 subió a 72 mil).
export const PRESUPUESTO = { triangulos: 50000, dibujados: 60 };

const lienzo = $('lienzo');
// fondo transparente: el degradado del fondo lo pone la página (no cuesta nada dibujarlo)
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
prepararRenderer(renderer); // sombras blandas, sRGB y ACES: los de la escena común
// teleobjetivo: poca perspectiva, como al fotografiar una maqueta
const camara = new THREE.PerspectiveCamera(26, 1, 0.5, 200);
const control = new OrbitControls(camara, lienzo);
control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.42; control.minDistance = 0.7; control.maxDistance = 60; control.enablePan = false;

const VISTAS = {
  maqueta: () => [new THREE.Vector3(21, 18, 28), new THREE.Vector3(0, -0.2, 0.4)],
  cabana:  () => [new THREE.Vector3(8.5, 5.0, 10.5), new THREE.Vector3(0.2, 1.5, 0.6)],
  lado:    () => [new THREE.Vector3(-24, 10, 15), new THREE.Vector3(0, 0.3, 0)],
};

let estado = { luz: 'manana', vista: 'maqueta', desenfoque: true };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'maqueta';
delete estado.andar; // guardado de la v6-v8
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

const escena = new THREE.Scene();
escena.add(crearEscena());
// cielo (lo pinta la página), sol, luz del cielo y niebla: el ambiente común (src/mundo/ambiente.js)
const ambiente = crearAmbiente(escena, { luz: estado.luz, alcance: RADIO + 1, fondoPagina: true });

function ponerLuz(id) {
  estado.luz = ambiente.ponerLuz(id);
  for (const btn of document.querySelectorAll('[data-luz]')) btn.classList.toggle('sel', btn.dataset.luz === estado.luz);
  guardar(); dibujar();
}
function ponerVista(v) {
  estado.vista = v;
  const [pos, mira] = VISTAS[v]();
  if (camara.aspect < 1) pos.sub(mira).multiplyScalar(v === 'cabana' ? 1.5 : 1.7).add(mira); // en vertical, más lejos para que quepa
  camara.position.copy(pos); control.target.copy(mira); control.update();
  for (const btn of document.querySelectorAll('[data-vista]')) btn.classList.toggle('sel', btn.dataset.vista === v);
  guardar(); dibujar();
}
// desenfoque de maqueta: bandas arriba y abajo desenfocadas por el navegador (sin pasadas extra de dibujo)
function ponerDesenfoque(v) {
  estado.desenfoque = v;
  document.body.classList.toggle('desenfoque', v);
  $('btnDesenfoque').classList.toggle('sel', v);
  guardar();
}

// ---------- Resolución adaptativa ----------
const RES_MAX = Math.min(devicePixelRatio || 1, 2);
let resolucion = Math.min(RES_MAX, 1.5);
function ajustar() {
  renderer.setPixelRatio(resolucion);
  renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight; camara.fov = camara.aspect < 1 ? 34 : 26; camara.updateProjectionMatrix();
}
addEventListener('resize', () => { ajustar(); dibujar(); });

const medida = { fps: 0, triangulos: 0, dibujados: 0, resolucion };
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
    $('medida').textContent = tr('{f} fps · resolución {r}× · {t} mil triángulos · {d} dibujados', { f: medida.fps, r: resolucion, t: (medida.triangulos / 1000).toFixed(1), d: medida.dibujados });
    cuenta = 0; t0 = t;
  }
}

for (const b of document.querySelectorAll('[data-luz]')) b.onclick = () => ponerLuz(b.dataset.luz);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
$('btnDesenfoque').onclick = () => ponerDesenfoque(!estado.desenfoque);
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('notas').innerHTML = `<b>${tr(VERSION_ESTILO)}</b><ul>${REGISTRO_ESTILO.map(t => `<li>${tr(t)}</li>`).join('')}</ul>`;

ajustar();
ponerDesenfoque(estado.desenfoque);
ponerLuz(estado.luz);
ponerVista(estado.vista);
bucle();

window.__estilo = {
  ponerLuz, ponerVista, ponerDesenfoque, dibujar, pausar: (v) => { pausado = v; },
  medida: () => { dibujar(); return { ...medida, triangulos: renderer.info.render.triangles, dibujados: renderer.info.render.calls }; },
  estado: () => ({ ...estado }), PRESUPUESTO,
};
