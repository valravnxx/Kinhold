// Personajes del taller propio: cuerpo de MakeHuman vestido por código, con las animaciones de Quaternius pasadas
// a su esqueleto (herramientas/taller/). Un solo .glb por personaje, con ropa, pelo, ojos y animaciones.
// Devuelve lo mismo que crearPersonaje() de cargar.js, para que el visor y el juego los usen igual.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CLIPS } from './cargar.js';

const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const cargar = (url) => { if (!cache.has(url)) cache.set(url, cargador.loadAsync(url)); return cache.get(url); };

export async function crearPersonajeMH(op = {}, base = 'recursos/personajes/taller-v1/') {
  const o = { sexo: 'hombre', calidad: 'alta', ...op };
  const g = await cargar(`${base}mh_${o.sexo}.glb`);
  const raiz = new THREE.Group();
  const modelo = clone(g.scene);
  raiz.add(modelo);
  let triangulos = 0;
  modelo.traverse(n => {
    if (!n.isMesh) return;
    n.castShadow = n.receiveShadow = true; n.frustumCulled = false;
    const m = n.material;
    // el borde del pelo, la cofia, el escote y las mangas va en la transparencia de la textura: recorte, sin mezcla
    const recorte = !!(m.map && m.transparent);
    n.material = o.calidad === 'alta' ? m.clone() : new THREE.MeshLambertMaterial({ name: m.name, map: m.map, color: m.color.clone(), vertexColors: m.vertexColors });
    // depthWrite: el cargador lo apaga en los materiales con transparencia, y entonces la piel se pinta encima del pelo
    // y la ropa se ve del revés (fallo de la v5, lo vio Pedro). DoubleSide: por dentro del escote y las mangas
    Object.assign(n.material, { transparent: false, depthWrite: true, alphaTest: recorte ? 0.5 : 0, side: THREE.DoubleSide });
    triangulos += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
  });
  const hueso = {};
  modelo.traverse(n => { if (n.isBone || n.type === 'Object3D') hueso[n.name] = n; });
  hueso.Head = hueso.head; hueso.root = hueso.Root; // mismos nombres que el esqueleto de Quaternius
  const mezclador = new THREE.AnimationMixer(modelo);
  const acciones = {};
  for (const clip of g.animations) acciones[clip.name] = mezclador.clipAction(clip);
  for (const [id, nombre] of Object.entries(CLIPS)) if (acciones[nombre]) acciones[id] = acciones[nombre];
  let actual = null;
  const poner = (id, mezcla = 0.25) => {
    const a = acciones[id] || acciones.quieto;
    if (a === actual && a.isRunning()) return;
    a.reset().setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(a, mezcla, false);
    actual = a;
  };
  poner('quieto', 0);
  return { raiz, modelo, mezclador, acciones, poner, triangulos, opciones: o, hueso, clips: g.animations.map(c => c.name) };
}
