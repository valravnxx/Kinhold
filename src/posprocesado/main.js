// Kinhold — prueba de posprocesado y de los seis perfiles gráficos (valravnx, 4 nov), sobre la escena de la prueba de
// estilo v5 (la referencia aprobada), con dos antorchas encendidas para que el brillo tenga algo que difuminar y el sol
// en el cielo para los haces de luz.
// Arriba: los seis perfiles y la luz. A la derecha: los siete efectos de la tabla de valravnx, que se pueden quitar y
// poner sobre el perfil, y «Sin posprocesado» para comparar con la v5 tal cual. Abajo: las vistas y «Medir», que mide
// lo que de verdad cuesta cada perfil en este aparato (ms por fotograma, sin el tope de la pantalla) y dice cuál le va.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUCES } from '../mundo/estilos.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { decoracion } from '../mundo/modelos.js';
import { crearEscena, RADIO } from '../estilo/escena.js';
import { PERFILES, EFECTOS, COMUN, perfil, efectosDe, sugerirPerfil, elegirPorMedida } from './perfiles.js';
import { crearPosprocesado } from './efectos.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';

traducirPagina();
botonesIdioma(document.getElementById('idiomas'));
const $ = (id) => document.getElementById(id);
const CLAVE = 'kinhold_posprocesado_v1';

// una luz de atardecer solo para esta prueba (para ver el brillo de las antorchas y los haces a contraluz)
LUCES.ocaso = { nombre: 'Atardecer', sol: [0xffb070, 1.7, [14, 2.6, -6]], hemi: [0xc4bccc, 0x5a4636, 1.15], fondo: [0xe8bc90, 0x8e9cb4] };

const lienzo = $('lienzo');
// sin el suavizado del navegador: con posprocesado lo hace la cadena (MSAA o SMAA, según el perfil)
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
prepararRenderer(renderer);
const camara = new THREE.PerspectiveCamera(26, 1, 0.5, 420);
const control = new OrbitControls(camara, lienzo);
control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.47; control.minDistance = 0.7; control.maxDistance = 60; control.enablePan = false;

const escena = new THREE.Scene();
escena.add(crearEscena());
// dos antorchas a los lados del camino, delante de la puerta; sus llamas brillan más de 1 para que el brillo las coja
for (const [x, z] of [[1.15, 2.55], [-0.85, 2.55]]) {
  const a = decoracion('antorcha'); a.position.set(x, 0, z);
  a.traverse(o => { if (o.name === 'llama' && o.material) { o.material = o.material.clone(); o.material.emissiveIntensity = 3.2; } });
  escena.add(a);
}
const ambiente = crearAmbiente(escena, { luz: 'manana', alcance: RADIO + 1, fondoPagina: false, niebla: COMUN.niebla });
// el disco del sol (para los haces de luz): lejos, en la dirección de la luz; sin niebla
const sol = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false }));
sol.visible = false; escena.add(sol);
function ponerSol() { const d = new THREE.Vector3().copy(ambiente.sol.position).sub(ambiente.sol.target.position).normalize(); sol.position.copy(d.multiplyScalar(300)); sol.material.color.set(LUCES[estado.luz].sol[0]).lerp(new THREE.Color(0xffffff), 0.5); }

const VISTAS = {
  maqueta: () => [new THREE.Vector3(21, 18, 28), new THREE.Vector3(0, -0.2, 0.4)],
  cabana: () => [new THREE.Vector3(8.5, 5.0, 10.5), new THREE.Vector3(0.2, 1.5, 0.6)],
  rincon: () => [new THREE.Vector3(4.2, 1.6, 5.2), new THREE.Vector3(0.6, 0.6, 1.8)],
  // detrás de la cabaña, mirando al sol: el tejado se recorta contra él (para que los haces tengan por dónde pasar)
  contraluz: () => {
    const s = new THREE.Vector3().copy(ambiente.sol.position).sub(ambiente.sol.target.position).normalize();
    const h = s.clone().setY(0).normalize(), alto = Math.atan2(s.y, Math.hypot(s.x, s.z));
    const pos = h.clone().multiplyScalar(-11).setY(1.7);
    // mira un poco por debajo del sol, para que quede dentro del encuadre, arriba
    const mira = pos.clone().add(h.clone().multiplyScalar(20)).setY(1.7 + 20 * Math.tan(Math.max(0, alto - 0.07)));
    return [pos, mira];
  },
};

// el perfil de inicio, por lo que se sabe del aparato (luego, «Medir» lo afina)
const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
const aparato = {
  tactil: matchMedia('(pointer: coarse)').matches, memoria: navigator.deviceMemory || null, nucleos: navigator.hardwareConcurrency || null,
  grafica: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), dpr: devicePixelRatio || 1,
};
const sugerido = sugerirPerfil(aparato);

let estado = { perfil: sugerido, luz: 'manana', vista: 'maqueta', on: null, v5: false };
try { const g = JSON.parse(localStorage.getItem(CLAVE) || '{}'); estado = { ...estado, ...g }; } catch (e) { /* sin almacenamiento */ }
if (!PERFILES.some(p => p.id === estado.perfil)) estado.perfil = sugerido;
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'maqueta';
if (!estado.on) estado.on = efectosDe(perfil(estado.perfil));
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

// ponerLuz del ambiente crea una niebla nueva con el color de esa luz: la que se pone y se quita es esa
const niebla = { actual: escena.fog };
const post = crearPosprocesado(renderer, escena, camara, { sol, foco: control.target, niebla: () => niebla.actual, luzSol: ambiente.sol });
function rehacer() { post.montar(perfil(estado.perfil), estado.on, estado.v5); pintarBotones(); guardar(); dibujar(); }

// ---------- Interfaz ----------
function pintarBotones() {
  const p = perfil(estado.perfil);
  for (const b of document.querySelectorAll('[data-perfil]')) b.classList.toggle('sel', !estado.v5 && b.dataset.perfil === estado.perfil);
  for (const b of document.querySelectorAll('[data-luz]')) b.classList.toggle('sel', b.dataset.luz === estado.luz);
  for (const b of document.querySelectorAll('[data-vista]')) b.classList.toggle('sel', b.dataset.vista === estado.vista);
  for (const b of document.querySelectorAll('[data-efecto]')) {
    const id = b.dataset.efecto, cabe = id === 'ao' ? !!p.ao : id === 'brillo' ? !!p.brillo : id === 'rayos' ? !!p.rayos : id === 'desenfoque' ? p.desenfoque : true;
    b.classList.toggle('sel', !estado.v5 && cabe && !!estado.on[id]);
    b.disabled = estado.v5 || !cabe;
    b.title = cabe ? '' : tr('Este perfil no lo lleva');
  }
  $('btnV5').classList.toggle('sel', estado.v5);
  $('resumen').textContent = estado.v5 ? tr('Sin posprocesado: como la prueba de estilo v5') : tr('{p}: {n} pasadas · resolución {r}× · sombras {s} px · suavizado {a}', {
    p: tr(p.nombre), n: post.pasadas, r: Math.min(devicePixelRatio || 1, p.res), s: p.sombras, a: tr(p.suavizado),
  });
}
$('perfiles').innerHTML = PERFILES.map(p => `<button data-perfil="${p.id}">${tr(p.nombre)}${p.id === sugerido ? ' ★' : ''}</button>`).join('');
$('efectos').innerHTML = EFECTOS.map(e => `<button data-efecto="${e.id}"><b>${tr(e.nombre)}</b><small>${tr(e.que)}</small></button>`).join('') + `<button id="btnV5"><b>${tr('Sin posprocesado')}</b><small>${tr('la v5 tal cual, para comparar')}</small></button>`;
for (const b of document.querySelectorAll('[data-perfil]')) b.onclick = () => { estado.perfil = b.dataset.perfil; estado.on = efectosDe(perfil(estado.perfil)); estado.v5 = false; rehacer(); };
for (const b of document.querySelectorAll('[data-efecto]')) b.onclick = () => { estado.on[b.dataset.efecto] = !estado.on[b.dataset.efecto]; rehacer(); };
$('btnV5').onclick = () => { estado.v5 = !estado.v5; rehacer(); };
for (const b of document.querySelectorAll('[data-luz]')) b.onclick = () => ponerLuz(b.dataset.luz);
for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => ponerVista(b.dataset.vista);
$('btnEfectos').onclick = () => { $('efectos').classList.toggle('abierto'); };

function ponerLuz(id) { estado.luz = ambiente.ponerLuz(id); niebla.actual = escena.fog; ponerSol(); rehacer(); if (estado.vista === 'contraluz') ponerVista('contraluz'); }
function ponerVista(v) {
  estado.vista = v;
  const [pos, mira] = VISTAS[v]();
  // a contraluz se mira hacia arriba, al sol: el control de la cámara no lo deja con el tope de siempre
  control.maxPolarAngle = v === 'contraluz' ? Math.PI * 0.8 : Math.PI * 0.47;
  if (camara.aspect < 1 && v !== 'contraluz') pos.sub(mira).multiplyScalar(v === 'maqueta' ? 1.7 : 1.45).add(mira);
  camara.position.copy(pos); control.target.copy(mira); control.update();
  pintarBotones(); guardar(); dibujar();
}

// ---------- Dibujo ----------
function ajustar() {
  camara.aspect = innerWidth / innerHeight; camara.fov = camara.aspect < 1 ? 34 : 26; camara.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight);
}
addEventListener('resize', () => { ajustar(); dibujar(); });
let pausado = false;
function dibujar() { post.dibujar(); }
control.addEventListener('change', () => { if (pausado) dibujar(); });
let cuenta = 0, t0 = performance.now();
const medida = { fps: 0 };
function bucle() {
  requestAnimationFrame(bucle);
  if (pausado) return;
  control.update(); dibujar(); cuenta++;
  const t = performance.now();
  if (t - t0 >= 1500) { medida.fps = Math.round(cuenta * 1000 / (t - t0)); $('fps').textContent = `${medida.fps} fps`; cuenta = 0; t0 = t; }
}

// ---------- Medir ----------
// Cada perfil con todos sus efectos (y la v5 sin nada), en ms por fotograma; luego el perfil que le va a este aparato.
// Y, del perfil elegido, lo que cuesta cada efecto (quitándolo).
async function medirTodo(n = 16) {
  const antes = JSON.parse(JSON.stringify(estado)), espera = () => new Promise(r => setTimeout(r, 30));
  pausado = true; $('medicion').hidden = false; $('medicion').innerHTML = `<b>${tr('Midiendo…')}</b>`;
  const filas = [], ms = {};
  estado.v5 = true; post.montar(perfil(estado.perfil), estado.on, true); await espera();
  const base = post.medir(n); filas.push([tr('Sin posprocesado'), base]);
  estado.v5 = false;
  for (const p of PERFILES) {
    post.montar(p, efectosDe(p)); await espera();
    ms[p.id] = post.medir(n); filas.push([tr(p.nombre), ms[p.id], p.objetivo]);
    $('medicion').innerHTML = `<b>${tr('Midiendo…')}</b> ${tr(p.nombre)}`;
  }
  const elegido = elegirPorMedida(ms, aparato.tactil);
  // lo que cuesta cada efecto en el elegido: con todo menos ese
  const pe = perfil(elegido), todo = efectosDe(pe), costes = [];
  post.montar(pe, todo); await espera(); const conTodo = post.medir(n);
  for (const e of EFECTOS) {
    if (!todo[e.id]) continue;
    post.montar(pe, { ...todo, [e.id]: false }); await espera();
    costes.push([tr(e.nombre), conTodo - post.medir(n)]);
  }
  estado = antes; pausado = false; rehacer();
  const f = (x) => `${x.toFixed(1)} ms · ${Math.round(1000 / x)} fps`;
  const resultado = { base, perfiles: ms, elegido, costes: Object.fromEntries(costes), aparato };
  window.__post.ultimaMedida = resultado;
  $('medicion').innerHTML = `<b>${tr('Medida en este aparato')}</b> <small>${tr('(ms por fotograma, sin el tope de la pantalla)')}</small>
    <table>${filas.map(([n, x, o]) => `<tr><td>${n}</td><td>${f(x)}</td><td>${o ? (1000 / x >= o ? '✓' : '✗') + ' ' + o : ''}</td></tr>`).join('')}</table>
    <p>${tr('Le va: <b>{p}</b>', { p: tr(perfil(elegido).nombre) })}</p>
    <b>${tr('Lo que cuesta cada efecto en ese perfil')}</b>
    <table>${costes.map(([n, x]) => `<tr><td>${n}</td><td>${x >= 0 ? '+' : ''}${x.toFixed(1)} ms</td></tr>`).join('')}</table>
    <p><small>${aparato.grafica || ''}</small></p><button id="btnUsarElegido">${tr('Usar {p}', { p: tr(perfil(elegido).nombre) })}</button> <button id="btnCerrarMedida">${tr('Cerrar')}</button>`;
  $('btnUsarElegido').onclick = () => { estado.perfil = elegido; estado.on = efectosDe(perfil(elegido)); estado.v5 = false; rehacer(); };
  $('btnCerrarMedida').onclick = () => { $('medicion').hidden = true; };
  return resultado;
}
$('btnMedir').onclick = () => medirTodo();

ajustar();
ambiente.ponerLuz(estado.luz); niebla.actual = escena.fog; ponerSol();
rehacer();
ponerVista(estado.vista);
bucle();

window.__post = {
  PERFILES, sugerido, aparato, escena, renderer, pausar: (v) => { pausado = v; }, dibujar,
  estado: () => JSON.parse(JSON.stringify(estado)),
  poner({ perfil: p, on, v5, luz, vista } = {}) {
    if (p) { estado.perfil = p; estado.on = efectosDe(perfil(p)); }
    if (on) estado.on = { ...estado.on, ...on };
    if (v5 !== undefined) estado.v5 = v5;
    if (luz) { estado.luz = ambiente.ponerLuz(luz); niebla.actual = escena.fog; ponerSol(); }
    rehacer();
    if (vista) ponerVista(vista); else if (luz && estado.vista === 'contraluz') ponerVista('contraluz');
    dibujar();
  },
  pasadas: () => post.pasadas, medir: (n) => post.medir(n), medirTodo, ultimaMedida: null,
};
