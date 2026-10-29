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
import { BASES, CAPAS, ANIMS, ANIMS_EXTRA, ZONAS_TABLA, GOLPES_TABLA } from './textos.js';
import { PRENDAS, prendasDeCapas, proteccion, abrigo, peso } from '../logica/prendas.js';
import { PALETAS, FORMAS, PEINADOS, BARBAS, normalizarAspecto } from '../logica/aspecto.js';
import { TINTES, BLASONES, PRENDAS_TENIBLES, paletaDe, normalizarTintes, colorPrenda } from '../logica/tintes.js';
import { HECHURAS, MATERIALES_TELA, CORTES, TEJIDOS, normalizarHechuras } from '../logica/hechura.js';
import { tr, traducirPagina, botonesIdioma, idioma } from '../idioma.js';

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
// personajes del taller propio (MakeHuman vestido por código), en recursos/personajes/taller-v13/ (las anteriores publicadas no se tocan)
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v13/';
// las 39 animaciones extra del taller propio, pasadas a su esqueleto (aparte: taller-anim-v1/)
const DETALLE = +(new URLSearchParams(location.search).get('detalle') || 0);
const RECURSOS_ANIM_MH = new URLSearchParams(location.search).get('animMH') || '../../recursos/personajes/taller-anim-v1/';
// capas puestas en el taller propio, por sexo (por defecto: túnica en el hombre, vestido en la mujer)
const capasMH = () => (estado.capas && estado.capas[estado.sexo]) || [estado.sexo === 'mujer' ? 'vestido' : 'tunica'];
// aspecto del taller propio (forma, colores, peinado y barba), por sexo; se guarda con lo demás (src/logica/aspecto.js)
const aspectoMH = () => normalizarAspecto(estado.aspecto && estado.aspecto[estado.sexo], estado.sexo);
const cambiarAspecto = (cambio) => {
  const a = aspectoMH();
  estado.aspecto = { ...(estado.aspecto || {}), [estado.sexo]: normalizarAspecto({ ...a, ...cambio, formas: { ...a.formas, ...(cambio.formas || {}) } }, estado.sexo) };
  if (pj?.ponerAspecto) { pj.ponerAspecto(aspectoMH()); medida.trianglesPersonaje = pj.triangulos; }
  guardar(); dibujar();
};

// tintes de la ropa y blasón de la sobreveste, por sexo; se guardan con lo demás (src/logica/tintes.js)
const tintesMH = () => normalizarTintes(estado.tintes && estado.tintes[estado.sexo], estado.sexo);
const cambiarTintes = (cambio) => {
  const t = tintesMH();
  estado.tintes = { ...(estado.tintes || {}), [estado.sexo]: normalizarTintes({ prendas: { ...t.prendas, ...(cambio.prendas || {}) }, blason: { ...t.blason, ...(cambio.blason || {}) } }, estado.sexo) };
  if (pj?.ponerTintes) pj.ponerTintes(tintesMH());
  pintarOpciones(); guardar(); dibujar();
};

// hechura de cada prenda de tela (material, corte y tejido), por sexo; se guarda con lo demás (src/logica/hechura.js)
const hechurasMH = () => normalizarHechuras(estado.hechuras && estado.hechuras[estado.sexo]);
const cambiarHechura = (prenda, cambio) => {
  const h = hechurasMH();
  estado.hechuras = { ...(estado.hechuras || {}), [estado.sexo]: normalizarHechuras({ ...h, [prenda]: { ...h[prenda], ...cambio } }) };
  if (pj?.ponerHechuras) { pj.ponerHechuras(hechurasMH()); medida.trianglesPersonaje = pj.triangulos; }
  pintarOpciones(); guardar(); dibujar();
};

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
  pies:    () => [rel(0.55, 0.5, 1.35), rel(0, 0.14, 0)], // de cerca: zapatos, botas o descalzo
};

// calidad alta en todos lados (en el móvil de valravnx va perfecto); la ligera queda como opción
const TACTIL = matchMedia('(pointer: coarse)').matches;
let estado = { luz: 'manana', vista: 'cuerpo', modo: 'quieto', sexo: 'hombre', ropa: 'campesino', pelo: 'raya', colorPelo: 'castano', piel: 'clara', barba: 'si', calidad: 'alta' };
try { estado = { ...estado, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { /* sin almacenamiento */ }
if (!LUCES[estado.luz]) estado.luz = 'manana';
if (!VISTAS[estado.vista]) estado.vista = 'cuerpo';
if (!ANIMS[estado.modo] && !ANIMS_EXTRA[estado.modo]) estado.modo = 'quieto';
if (estado.ropa !== 'campesino') estado.ropa = 'campesino'; // el explorador era demasiado de fantasía (valravnx)
estado.sombras ??= true; estado.escena ??= true;
if (!BASES[estado.base]) estado.base = 'makehuman'; // valravnx eligió el taller propio como base (25 oct)
// la v3 ponía «ligera» sola en el móvil: si no la eligió valravnx a mano, vuelve a alta
if (!estado.calidadElegida) estado.calidad = 'alta';
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } };

let pj = null, cargando = 0;
async function rehacer() {
  const n = ++cargando;
  $('cargando').hidden = false;
  if (!OPCIONES.pelo[estado.sexo][estado.pelo]) estado.pelo = Object.keys(OPCIONES.pelo[estado.sexo])[0];
  const nuevo = estado.base === 'makehuman' ? await crearPersonajeMH({ ...estado, capas: capasMH(), aspecto: aspectoMH(), tintes: tintesMH(), hechuras: hechurasMH(), extra: RECURSOS_ANIM_MH }, RECURSOS_MH) : await crearPersonaje(estado, RECURSOS);
  if (n !== cargando) return; // llegó otro cambio mientras cargaba
  if (pj) escena.remove(pj.raiz);
  pj = nuevo;
  pj.raiz.position.copy(POS); pj.raiz.rotation.y = GIRO;
  escena.add(pj.raiz);
  pj.poner(estado.modo, 0); pj.mezclador.update(0.5);
  // ?detalle=1 o 2: el personaje con el nivel de detalle de media distancia o de lejos, visto de cerca (para revisarlos)
  if (pj.ponerNivel && DETALLE) { await pj.ponerNivel(DETALLE); medida.nivel = pj.nivel; }
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
    (mh ? `<div class="grupo"><span>${tr(estado.sexo === 'hombre' ? 'Ropa por capas (debajo siempre camisa y calzas, y zapatos si no vas descalzo)' : 'Ropa por capas (debajo siempre camisa, y zapatos si no vas descalza)')}</span>${(pj?.capasPosibles || []).map(c =>
        `<button data-capa="${c}" class="${capasMH().includes(c) ? 'sel' : ''}">${tr(CAPAS[c])}</button>`).join('')}</div>` +
      pintarTintes() + pintarHechuras() + pintarRopa() + pintarAspecto()
      : grupo('ropa', { campesino: OPCIONES.ropa.campesino }, 'Ropa') + grupo('pelo', OPCIONES.pelo[estado.sexo], 'Pelo') +
    grupo('colorPelo', OPCIONES.colorPelo, 'Color del pelo') + grupo('piel', OPCIONES.piel, 'Piel') + (estado.sexo === 'hombre' ? grupo('barba', OPCIONES.barba, 'Barba') : '')) +
    grupo('calidad', { alta: 'Alta', ligera: 'Ligera (móvil)' }, 'Calidad') +
    `<div class="grupo"><span>${tr('Prueba de rendimiento (mira los fps arriba)')}</span><button data-diag="sombras" class="${estado.sombras ? 'sel' : ''}">${tr('Sombras')}</button><button data-diag="escena" class="${estado.escena ? 'sel' : ''}">${tr('Cabaña y suelo')}</button></div>` +
    `<div class="grupo"><span>${tr('Animación')}</span>${Object.entries(ANIMS).map(([k, v]) => `<button data-modo="${k}" class="${estado.modo === k ? 'sel' : ''}">${tr(v)}</button>`).join('')}</div>` +
    (mh ? `<div class="grupo" id="anims-extra"><span>${tr('Más animaciones')}</span>${Object.entries(ANIMS_EXTRA).filter(([k]) => pj?.acciones[k]).map(([k, v]) => `<button data-modo="${k}" class="${estado.modo === k ? 'sel' : ''}">${tr(v)}</button>`).join('')}</div>` : '');
  for (const b of $('opciones').querySelectorAll('[data-op]')) b.onclick = () => { estado[b.dataset.op] = b.dataset.v; if (b.dataset.op === 'calidad') estado.calidadElegida = true; rehacer(); };
  for (const b of $('opciones').querySelectorAll('[data-modo]')) b.onclick = () => ponerModo(b.dataset.modo);
  for (const b of $('opciones').querySelectorAll('[data-capa]')) b.onclick = () => {
    const l = capasMH(), c = b.dataset.capa;
    // los tocados van de uno en uno: poner uno quita el que hubiera
    const tocados = pj?.tocados || [], sin = tocados.includes(c) ? l.filter(x => !tocados.includes(x)) : l;
    estado.capas = { ...(estado.capas || {}), [estado.sexo]: l.includes(c) ? l.filter(x => x !== c) : [...sin, c] };
    if (pj?.ponerCapas) { pj.ponerCapas(capasMH()); medida.trianglesPersonaje = pj.triangulos; }
    pintarOpciones(); guardar(); dibujar();
  };
  for (const b of $('opciones').querySelectorAll('[data-asp]')) b.onclick = () => { cambiarAspecto({ [b.dataset.asp]: b.dataset.v }); pintarOpciones(); };
  for (const b of $('opciones').querySelectorAll('[data-tinte]')) b.onclick = () => cambiarTintes({ prendas: { [b.dataset.tinte]: b.dataset.v } });
  for (const b of $('opciones').querySelectorAll('[data-hechura]')) b.onclick = () => cambiarHechura(b.dataset.hechura, { [b.dataset.que]: b.dataset.v });
  for (const b of $('opciones').querySelectorAll('[data-blason]')) b.onclick = () => cambiarTintes({ blason: { [b.dataset.blason]: b.dataset.v } });
  for (const r of $('opciones').querySelectorAll('[data-forma]')) r.oninput = () => cambiarAspecto({ formas: { [r.dataset.forma]: Number(r.value) } });
  for (const b of $('opciones').querySelectorAll('[data-diag]')) b.onclick = () => { estado[b.dataset.diag] = !estado[b.dataset.diag]; aplicarDiag(); pintarOpciones(); guardar(); };
}

// tinte de cada prenda que se ve puesta (muestras de color) y, con la sobreveste, su blasón (dibujo y color de la figura)
function pintarTintes() {
  const t = tintesMH(), capas = capasMH(), tenibles = pj?.tenibles || [];
  if (!tenibles.length) return '';
  const calzado = capas.includes('botas') ? 'botas' : capas.includes('descalzo') ? null : 'zapatos';
  const puestas = Object.keys(PRENDAS_TENIBLES).filter(p => tenibles.includes(p) && (p === 'camisa' || p === 'calzas' || p === calzado || capas.includes(p))); // de dentro afuera
  const rgb = (c) => `rgb(${c.join(',')})`;
  const muestra = (attr, clave, k, nombre, c, sel) => `<button data-${attr}="${clave}" data-v="${k}" title="${tr(nombre)}" aria-label="${tr(nombre)}" class="muestra ${sel ? 'sel' : ''}"><i style="background:${rgb(c)}"></i></button>`;
  let h = `<div class="grupo tintes"><span>${tr('Tinte de la ropa')}</span>` + puestas.map(p => `<div class="fila"><b>${tr(PRENDAS_TENIBLES[p].nombre)}</b>` +
    Object.entries(paletaDe(p)).map(([k, [n]]) => muestra('tinte', p, k, n, colorPrenda(p, k), t.prendas[p] === k)).join('') + '</div>').join('') + '</div>';
  if (capas.includes('sobreveste') && tenibles.includes('sobreveste')) {
    h += `<div class="grupo" id="blason"><span>${tr('Blasón de la sobreveste')}</span>` + Object.entries(BLASONES).map(([k, n]) =>
      `<button data-blason="dibujo" data-v="${k}" class="${t.blason.dibujo === k ? 'sel' : ''}">${tr(n)}</button>`).join('') +
      (t.blason.dibujo === 'liso' ? '' : `<div class="fila"><b>${tr('Figura')}</b>` + Object.entries(TINTES).filter(([k]) => k !== 'natural').map(([k, [n, c]]) =>
        muestra('blason', 'color', k, n, c, t.blason.color === k)).join('') + '</div>') + '</div>';
  }
  return h;
}

// hechura de cada prenda de tela puesta (la que se fabrica: material, corte y tejido; el tinte va arriba)
function pintarHechuras() {
  if (!pj?.ponerHechuras || !(pj.tenibles || []).length) return '';
  const h = hechurasMH(), capas = capasMH();
  const puestas = Object.keys(HECHURAS).filter(p => pj.tenibles.includes(p) && (p === 'camisa' || p === 'calzas' || capas.includes(p)));
  const boton = (p, que, k, n) => `<button data-hechura="${p}" data-que="${que}" data-v="${k}" class="${h[p][que] === k ? 'sel' : ''}">${tr(n)}</button>`;
  return `<div class="grupo hechuras" id="hechuras"><span>${tr('Hechura de la ropa (material, corte y tejido)')}</span>` + puestas.map(p => {
    const d = HECHURAS[p];
    return `<div class="fila"><b>${tr(d.nombre)}</b>` +
      (d.materiales.length > 1 ? d.materiales.map(k => boton(p, 'material', k, MATERIALES_TELA[k].nombre)).join('') : '') +
      (d.cortes.length > 1 ? d.cortes.map(k => boton(p, 'corte', k, CORTES[k].nombre)).join('') : '') +
      Object.entries(TEJIDOS).map(([k, n]) => boton(p, 'tejido', k, n)).join('') + '</div>';
  }).join('') + '</div>';
}

// lo que hace la ropa puesta: sale de los datos de cada prenda (src/logica/prendas.js), los mismos que deciden qué se dibuja
function pintarRopa() {
  const puestas = prendasDeCapas(capasMH(), estado.sexo);
  const num = (n) => (Math.round(n * 10) / 10).toLocaleString(idioma);
  const filas = ZONAS_TABLA, golpes = GOLPES_TABLA;
  const celda = (z, g) => { const f = Math.round((1 - proteccion(puestas, z, g)) * 100); return `<td>${f ? f + ' %' : '—'}</td>`; };
  return `<div class="grupo" id="ropa-datos"><span>${tr('Lo que frena tu ropa de cada golpe')}</span>` +
    `<table><tr><th></th>${golpes.map(([t]) => `<th>${tr(t)}</th>`).join('')}</tr>` +
    filas.map(([t, z]) => `<tr><th>${tr(t)}</th>${golpes.map(([, g]) => celda(z, g)).join('')}</tr>`).join('') + '</table>' +
    `<p>${tr('Peso')}: ${num(peso(puestas))} kg · ${tr('Abrigo')}: ${num(abrigo(puestas))}</p>` +
    `<p class="llevas">${tr('Llevas')}: ${puestas.map(t => tr(PRENDAS[t].nombre)).join(', ')}</p></div>`;
}

// personalización del taller propio: colores (muestras), peinado, barba y formas (deslizadores de -1 a 1)
function pintarAspecto() {
  const a = aspectoMH();
  const muestras = (clave, titulo) => `<div class="grupo"><span>${titulo}</span>${Object.entries(PALETAS[clave]).map(([k, [n, c]]) =>
    `<button data-asp="${clave}" data-v="${k}" class="${a[clave] === k ? 'sel' : ''}"><i style="background:rgb(${c.join(',')})"></i>${tr(n)}</button>`).join('')}</div>`;
  const lista = (clave, valores, titulo) => Object.keys(valores).length < 2 ? '' : `<div class="grupo"><span>${titulo}</span>${Object.entries(valores).map(([k, n]) =>
    `<button data-asp="${clave}" data-v="${k}" class="${a[clave] === k ? 'sel' : ''}">${tr(n)}</button>`).join('')}</div>`;
  return muestras('piel', tr('Piel')) + muestras('ojos', tr('Ojos')) + muestras('pelo', tr('Color del pelo')) +
    lista('peinado', PEINADOS[estado.sexo], tr('Peinado')) + lista('barba', BARBAS[estado.sexo], tr('Barba')) +
    `<div class="grupo formas"><span>${tr('Cuerpo y cara')}</span>${Object.entries(FORMAS).map(([k, n]) =>
      `<label>${tr(n)}<input type="range" min="-1" max="1" step="0.05" value="${a.formas[k]}" data-forma="${k}"></label>`).join('')}</div>`;
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
  tintes: (t) => { if (t) cambiarTintes(t); return pj?.tintes; },
  hechuras: (p, c) => { if (p) cambiarHechura(p, c); return pj?.hechuras; },
  // milisegundos por fotograma dibujando n veces (para comparar calidades en las pruebas)
  tiempo: (n = 10) => { const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); dibujar(); sync(); const t = performance.now(); for (let i = 0; i < n; i++) { dibujar(); sync(); } return (performance.now() - t) / n; },
  diag: () => ({ escena, renderer, pj, sol, THREE }),
  // nivel de detalle (src/logica/detalle.js) del personaje, visto donde esté: devuelve sus triángulos y piezas
  nivel: async (n) => {
    await pj.ponerNivel(n); dibujar();
    let piezas = 0, triangulos = 0;
    pj.modelo.traverse(o => { if (o.isMesh && o.visible) { piezas++; triangulos += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    return { nivel: pj.nivel, triangulos, piezas };
  },
  hueso: (n) => { const v = new THREE.Vector3(); pj.hueso[n].getWorldPosition(v); return [v.x, v.y, v.z]; },
};
