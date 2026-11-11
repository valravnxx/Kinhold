// Muestrario de la naturaleza de Meshy al lado de la de hoy (estilo v5, src/mundo/especies.js y decorado.js), con la luz,
// la sombra y el suelo del juego: para las capturas de la prueba de estilo que aprueba valravnx. Se empaqueta con esbuild
// (herramientas/meshy/fotos_naturaleza.py) y lee los .glb aligerados de ./modelos/<nombre>.glb.
// Expone window.__muestrario.foto(i, vista, ancho, alto): i = número de la pareja (-1, todas); vista 'tres' o 'cerca'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepararRenderer, crearAmbiente } from '../../src/mundo/ambiente.js';
import { suelo, modelosPlantas } from '../../src/mundo/decorado.js';
import { modelosEspecies } from '../../src/mundo/especies.js';

// cada pareja: lo de hoy (a la izquierda) y lo de Meshy (a la derecha)
const pl = modelosPlantas(), adulto = modelosEspecies(), joven = modelosEspecies({ joven: true });
const HOY = { arbol_adulto: adulto.roble, arbol_joven: joven.roble, arbusto: pl.matorral, arbusto_bayas: pl.matorral, matorral: pl.matorral, roca_mediana: pl.roca };
const ESCALA_HOY = { arbusto: 1.4, arbusto_bayas: 1.2, matorral: 1, roca_mediana: 1 };
const nombres = new URLSearchParams(location.search).get('cosas').split(',');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
prepararRenderer(renderer); document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const amb = crearAmbiente(escena, { alcance: 30, mapa: 2048 });
escena.add(suelo({ llano: 60, cerca: 40, lejos: 120 }));
const camara = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
const parejas = [];
const cargador = new GLTFLoader();
let x = 0;
for (const n of nombres) {
  const g = await cargador.loadAsync(`modelos/${n}.glb`), m = g.scene;
  const hoy = new THREE.Mesh(HOY[n].geo, HOY[n].mats); hoy.scale.setScalar(ESCALA_HOY[n] || 1);
  const ancho = Math.max(new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).x, new THREE.Box3().setFromObject(hoy).getSize(new THREE.Vector3()).x);
  const sep = ancho * 1.25 + 0.6;
  x += sep / 2 + 4;
  hoy.position.set(x - sep / 2, 0, 0); m.position.set(x + sep / 2, 0, 0);
  for (const o of [hoy, m]) { o.traverse(k => { if (k.isMesh) k.castShadow = k.receiveShadow = true; }); escena.add(o); }
  parejas.push({ n, hoy, m, centro: x }); x += sep / 2 + 4;
}
// todo centrado en 0
const medio = x / 2;
for (const p of parejas) { p.hoy.position.x -= medio; p.m.position.x -= medio; p.centro -= medio; }

function foto(i, vista, ancho, alto) {
  renderer.setSize(ancho, alto, false); camara.aspect = ancho / alto; camara.updateProjectionMatrix();
  const caja = new THREE.Box3();
  for (const p of i < 0 ? parejas : [parejas[i]]) caja.expandByObject(p.hoy).expandByObject(p.m);
  const tam = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
  // tres: desde arriba, como la cámara del juego; cerca: más bajo y más cerca, a la altura de la copa
  const dir = new THREE.Vector3(...(vista === 'cerca' ? [0.25, 0.3, 1] : [0.35, 0.75, 1])).normalize();
  // la distancia a la que cabe entera (alto y ancho, con margen), por el campo de visión de la cámara
  const t = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)), r = Math.max(tam.x, tam.z) / 2;
  const dist = Math.max(tam.y / 2 / t, r / (t * camara.aspect)) * (vista === 'cerca' ? 1.15 : 1.35) + r;
  camara.position.copy(centro).add(dir.multiplyScalar(dist));
  camara.lookAt(centro);
  amb.seguir(centro.x, centro.z);
  renderer.render(escena, camara);
}
window.__muestrario = { listo: true, n: parejas.length, foto, nombres };
