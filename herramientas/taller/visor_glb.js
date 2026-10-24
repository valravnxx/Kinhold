// Visor del taller: enseña los .glb vestidos por código (vestir_mpfb.py) con la luz y el escenario de la prueba de estilo,
// tal como los dibujaría el juego (three.js). Uso: se empaqueta con esbuild y se abre con ?glb=a.glb,b.glb
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LUCES } from '../../src/estilo/estilos.js';
import { crearEscena } from '../../src/estilo/escena.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const L = LUCES.manana;
escena.background = new THREE.Color(L.fondo[0]); escena.fog = new THREE.Fog(L.fondo[0], 45, 130);
escena.add(crearEscena());
const hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]);
const sol = new THREE.DirectionalLight(L.sol[0], L.sol[1]); sol.position.set(...L.sol[2]).multiplyScalar(1.6);
sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 60 });
sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
escena.add(hemi, sol, sol.target);
const camara = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
const POS = new THREE.Vector3(1.6, 0, 4.8);

const archivos = (new URLSearchParams(location.search).get('glb') || '').split(',').filter(Boolean);
const cargador = new GLTFLoader();
const gente = [];
let triangulos = 0;
Promise.all(archivos.map(a => cargador.loadAsync(a))).then(res => {
  res.forEach((g, k) => {
    const m = g.scene;
    m.position.copy(POS).add(new THREE.Vector3((k - (res.length - 1) / 2) * 1.1, 0, 0));
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      const mat = o.material;
      // las cáscaras (pelo, barba, cofia) y la túnica llevan el borde en la transparencia: recorte, sin mezcla
      if (mat.map && mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true; }
      mat.side = THREE.DoubleSide; // por dentro de las mangas y el escote
      triangulos += o.geometry.index.count / 3;
    });
    escena.add(m); gente.push(m);
  });
  window.__visor = { listo: true, triangulos, foto };
});

function foto(cual, ancho, alto) {
  renderer.setSize(ancho, alto, false); camara.aspect = ancho / alto; camara.updateProjectionMatrix();
  const m = gente[cual.persona ?? 0], c = m.position.clone();
  const cabeza = new THREE.Vector3(); m.getObjectByName('head')?.getWorldPosition(cabeza);
  if (cual.vista === 'cuerpo') { camara.position.set(POS.x, 1.2, POS.z + 4.4); camara.lookAt(POS.x, 0.85, POS.z); }
  else if (cual.vista === 'cara') { camara.position.set(c.x + 0.15, cabeza.y + 0.1, c.z + 0.75); camara.lookAt(c.x, cabeza.y + 0.07, c.z); }
  else if (cual.vista === 'espalda') { camara.position.set(c.x - 1.2, 1.4, c.z - 2.6); camara.lookAt(c.x, 0.9, c.z); }
  renderer.render(escena, camara);
}
