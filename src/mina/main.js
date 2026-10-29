// Kinhold — prueba de cavar (hito 1g): una loma de roca donde se cava con clics o toques, para medir lo que cuesta
// rehacer la malla de la roca en cada golpe («vóxeles suavizados», src/mina/malla.js) en PC y en el móvil.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { PALETA, materialTex, DENSIDAD } from '../mundo/estilos.js';
import { suelo, bosque } from '../mundo/decorado.js';
import { azarLineal as azar } from '../logica/azar.js';
import { Excavacion, TAM, LADO } from '../logica/excavacion.js';
import { mallaTrozo, ruido3 } from './malla.js';
import { VERSION_MINA, REGISTRO_MINA } from './registro.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';

traducirPagina();
botonesIdioma(document.getElementById('botones'));
const $ = (id) => document.getElementById(id);

// ---------- la loma: roca hasta la altura h(x, z), y roca bajo todo el suelo (se puede cavar hacia abajo) ----------
const CX = 16, CZ = 12, ALTO = 6.5;
export function altura(x, z) {
  const r = Math.hypot((x - CX) / 13, (z - CZ) / 10);
  if (r >= 1) return 0;
  const t = 1 - r, forma = t * t * (3 - 2 * t);
  return Math.max(0, ALTO * forma + (ruido3(x * 0.25, 0, z * 0.25, 5) - 0.5) * 1.6 * forma);
}
const base = (x, y, z) => y < altura(x, z) && (y >= 0 || Math.hypot((x - CX) / 13, (z - CZ) / 10) < 1);
// trozos que se dibujan: los que cubren la loma y su pie (4 × 3 × 3 trozos de 8 m)
const TROZOS = [];
for (let cx = 0; cx < 4; cx++) for (let cy = -1; cy < 2; cy++) for (let cz = 0; cz < 3; cz++) TROZOS.push([cx, cy, cz]);

const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
prepararRenderer(renderer);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const escena = new THREE.Scene();
const amb = crearAmbiente(escena, { alcance: 22, mapa: 2048 });
amb.seguir(CX, CZ);
// suelo y bosque de la escena común, un poco por debajo: dentro de la zona la que se ve es la roca (su cara de arriba)
const sueloComun = suelo({ llano: 40, cerca: 40, lejos: 120 }); sueloComun.position.set(CX, -0.02, CZ); escena.add(sueloComun);
const fondo = new THREE.Group(); bosque(fondo, azar(3), { n: 30, desde: 30, hasta: 80, llano: 40 }); fondo.position.set(CX, 0, CZ); escena.add(fondo);

const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
camara.position.set(CX - 18, 11, CZ + 16);
const control = new OrbitControls(camara, lienzo);
control.target.set(CX - 4, 2.5, CZ); control.enableDamping = true; control.maxPolarAngle = Math.PI * 0.49; control.minDistance = 2; control.maxDistance = 45;

// ---------- material de la roca: textura de piedra (y de tierra con hierba arriba), color por vértice ----------
// proyección triple (por los tres ejes, mezclada según hacia dónde mira la pared): la textura de la piedra no se estira
// en las paredes inclinadas de las galerías
function triplanar(mat, escala) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo; varying vec3 vNormMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz; vNormMundo = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo; varying vec3 vNormMundo;')
      .replace('#include <map_fragment>', `vec3 pesoT = pow(abs(normalize(vNormMundo)), vec3(4.0)); pesoT /= (pesoT.x + pesoT.y + pesoT.z);
        vec4 sampledDiffuseColor = texture2D(map, vPosMundo.zy * ${escala.toFixed(3)}) * pesoT.x + texture2D(map, vPosMundo.xz * ${escala.toFixed(3)}) * pesoT.y + texture2D(map, vPosMundo.xy * ${escala.toFixed(3)}) * pesoT.z;
        diffuseColor *= sampledDiffuseColor;`);
  };
  m.customProgramCacheKey = () => 'triplanar' + escala;
  return m;
}
const matRoca = triplanar(materialTex('piedra'), DENSIDAD.piedra), matHierba = triplanar(materialTex('suelo'), 0.5);
const ROCA = new THREE.Color(PALETA.piedra), ROCA2 = new THREE.Color(PALETA.piedraOsc), TIERRA = new THREE.Color(PALETA.tierraCorte), HIERBA = new THREE.Color(PALETA.hierba);
function geometriaDe(m) {
  const g = new THREE.BufferGeometry(), n = m.celdas, P = m.posiciones, N = m.normales;
  const col = new Float32Array(n * 3), uv = new Float32Array(n * 2), hierba = new Uint8Array(n), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ny = N[i * 3 + 1];
    // cara de arriba de la loma (la que había antes de cavar): hierba; dentro y en los cortes: roca con vetas de tierra
    const fuera = ny > 0.55 && !base(x, y + 0.45, z) && y > altura(x, z) - 0.6;
    hierba[i] = fuera ? 1 : 0;
    const k = ruido3(x * 0.9, y * 0.9, z * 0.9, 31);
    if (fuera) c.copy(HIERBA).multiplyScalar(0.92 + k * 0.16);
    else { c.copy(ROCA).lerp(ROCA2, k); if (y > altura(x, z) - 1.0 && y > 0.3) c.lerp(TIERRA, 0.5); } // capa de tierra bajo la hierba
    const sombra = 0.75 + 0.25 * (ny * 0.5 + 0.5); // más oscuro lo que mira abajo (techos de la galería)
    col[i * 3] = c.r * sombra; col[i * 3 + 1] = c.g * sombra; col[i * 3 + 2] = c.b * sombra;
    // UV por la cara dominante (sin costuras visibles en la piedra)
    const ax = Math.abs(N[i * 3]), ay = Math.abs(ny), az = Math.abs(N[i * 3 + 2]), D = DENSIDAD.piedra;
    if (ay >= ax && ay >= az) { uv[i * 2] = x * D; uv[i * 2 + 1] = z * D; } else if (ax >= az) { uv[i * 2] = z * D; uv[i * 2 + 1] = y * D; } else { uv[i * 2] = x * D; uv[i * 2 + 1] = y * D; }
  }
  // dos grupos: triángulos de hierba y de roca
  const I = m.indices, deHierba = [], deRoca = [];
  for (let t = 0; t < I.length; t += 3) (hierba[I[t]] + hierba[I[t + 1]] + hierba[I[t + 2]] >= 2 ? deHierba : deRoca).push(I[t], I[t + 1], I[t + 2]);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex([...deRoca, ...deHierba]);
  g.addGroup(0, deRoca.length, 0); g.addGroup(deRoca.length, deHierba.length, 1);
  g.computeVertexNormals();
  return g;
}

// ---------- mundo y mallas por trozo ----------
let ex = new Excavacion(base);
const mallas = new Map(), raizRoca = new THREE.Group(); escena.add(raizRoca);
const medidas = { rehechas: 0, ms: [], ultimoGolpe: null, triangulos: 0 };
function rehacer(cx, cy, cz) {
  const k = `${cx},${cy},${cz}`;
  if (!TROZOS.some(t => t[0] === cx && t[1] === cy && t[2] === cz)) return 0;
  const t0 = performance.now();
  const m = mallaTrozo(ex, cx, cy, cz);
  const g = geometriaDe(m);
  const ms = performance.now() - t0;
  const viejo = mallas.get(k);
  if (viejo) { raizRoca.remove(viejo); viejo.geometry.dispose(); }
  if (m.indices.length) {
    const malla = new THREE.Mesh(g, [matRoca, matHierba]); malla.castShadow = malla.receiveShadow = true; malla.name = 'roca_' + k;
    raizRoca.add(malla); mallas.set(k, malla);
  } else { g.dispose(); mallas.delete(k); }
  return ms;
}
function rehacerTodo() {
  let total = 0; for (const [cx, cy, cz] of TROZOS) total += rehacer(cx, cy, cz);
  contarTriangulos(); return total;
}
function contarTriangulos() { medidas.triangulos = 0; for (const m of mallas.values()) medidas.triangulos += m.geometry.index.count / 3; }

// Un golpe de pico en el punto p (un poco hacia dentro de la roca); rehace solo los trozos tocados
function golpe(p) {
  const r = ex.golpe({ autor: 'valravnx', x: p.x, y: p.y, z: p.z });
  if (!r.ok) return r;
  const t0 = performance.now();
  for (const k of r.trozos) { const [cx, cy, cz] = k.split(',').map(Number); rehacer(cx, cy, cz); }
  const ms = performance.now() - t0;
  medidas.ms.push(ms); medidas.rehechas += r.trozos.length; medidas.ultimoGolpe = { ...r, ms };
  contarTriangulos();
  return { ...r, ms };
}

// ---------- tocar la roca para cavar ----------
const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
let abajo = null;
lienzo.addEventListener('pointerdown', (e) => { abajo = { x: e.clientX, y: e.clientY }; });
lienzo.addEventListener('pointerup', (e) => {
  if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) return; // arrastrar gira la cámara
  puntero.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rayo.setFromCamera(puntero, camara);
  const hit = rayo.intersectObjects(raizRoca.children, false)[0];
  if (hit) golpe(hit.point.clone().addScaledVector(rayo.ray.direction, 0.3));
});

// túnel de prueba: golpes en línea recta hacia el centro de la loma, a 2 m de altura (para medir sin tocar)
function cavarTunel(pasos = 14) {
  const r = [];
  for (let i = 0; i < pasos; i++) r.push(golpe(new THREE.Vector3(CX - 13 + 2.2 + i * 0.45, 1.6, CZ)));
  return r;
}
$('btnTunel').onclick = () => cavarTunel();
$('btnReiniciar').onclick = () => { ex = new Excavacion(base); medidas.ms = []; medidas.rehechas = 0; rehacerTodo(); };
$('btnNotas').onclick = () => { const n = $('notas'); n.hidden = !n.hidden; $('ayuda').hidden = !n.hidden; };
$('notas').innerHTML = `<b>${tr(VERSION_MINA)}</b><ul>${REGISTRO_MINA.map(t => `<li>${tr(t)}</li>`).join('')}</ul>`;

// ---------- bucle y medidas en pantalla ----------
let ultimo = performance.now(), cuadros = 0, fps = 0, tMedida = 0;
function medirTexto() {
  const ms = medidas.ms, media = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0, peor = ms.length ? Math.max(...ms) : 0;
  return tr('{fps} fps · {tri} mil triángulos · malla por golpe: {media} ms de media, {peor} ms el peor ({n} golpes)',
    { fps, tri: (medidas.triangulos / 1000).toFixed(1), media: media.toFixed(1), peor: peor.toFixed(1), n: ms.length });
}
function bucle(t) {
  requestAnimationFrame(bucle);
  const w = innerWidth, h = innerHeight;
  if (lienzo.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camara.aspect = w / h; camara.fov = w < h ? 58 : 40; camara.updateProjectionMatrix(); } // en vertical, más campo de visión
  control.update();
  renderer.render(escena, camara);
  cuadros++;
  if (t - tMedida > 1000) { fps = Math.round(cuadros * 1000 / (t - tMedida)); cuadros = 0; tMedida = t; $('medida').textContent = medirTexto(); }
}
const msInicial = rehacerTodo();
requestAnimationFrame(bucle);

window.__mina = { golpe: (x, y, z) => golpe(new THREE.Vector3(x, y, z)), cavarTunel, medidas, msInicial, renderer, camara, control, escena,
  reiniciar: () => $('btnReiniciar').onclick(), serializar: () => ex.serializar(), dibujar: () => renderer.render(escena, camara),
  mirar: (px, py, pz, tx, ty, tz) => { camara.position.set(px, py, pz); control.target.set(tx, ty, tz); control.update(); renderer.render(escena, camara); } };
