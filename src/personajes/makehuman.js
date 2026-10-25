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
  // ropa por capas, de dentro afuera. Lo que queda tapado del todo no se dibuja: el cuerpo de una capa se esconde si
  // lleva otra encima, y su falda solo asoma si es más larga que las de encima (así no se atraviesan al moverse).
  const ORDEN = ['camisa', 'tunica', 'vestido', 'gambeson'];
  const SIEMPRE = ['calzas', 'zapatos'];
  const capaDe = (n) => { const m = n.name.match(/_(capa|cinturon)_([a-z]+)(_falda)?/); return m && { tipo: m[1], capa: m[2], falda: !!m[3] }; };
  const bajo = new Map(); // altura del bajo de cada falda (en reposo)
  modelo.traverse(n => { const c = n.isMesh && capaDe(n); if (c && c.falda) { n.geometry.computeBoundingBox(); bajo.set(c.capa, n.geometry.boundingBox.min.y); } });
  const ponerCapas = (lista) => {
    const puestas = ORDEN.filter(c => c === 'camisa' || lista.includes(c));
    const fuera = puestas[puestas.length - 1];
    let tri = 0;
    modelo.traverse(n => {
      if (!n.isMesh) return;
      const c = capaDe(n);
      if (c && c.tipo === 'cinturon') n.visible = c.capa === fuera && c.capa !== 'camisa';
      else if (c && SIEMPRE.includes(c.capa)) n.visible = true;
      else if (c) {
        const k = puestas.indexOf(c.capa), encima = puestas.slice(k + 1);
        n.visible = k >= 0 && (c.falda ? encima.every(e => bajo.get(c.capa) < bajo.get(e) - 0.01) : encima.length === 0);
      }
      if (n.visible) tri += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
    });
    resultado.triangulos = tri; resultado.capas = [...lista];
  };
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
  const resultado = { raiz, modelo, mezclador, acciones, poner, triangulos, opciones: o, hueso, clips: g.animations.map(c => c.name), ponerCapas,
    capasPosibles: ORDEN.filter(c => c !== 'camisa' && modelo.getObjectByName(`${o.sexo}_capa_${c}`)) };
  ponerCapas(o.capas || [o.sexo === 'mujer' ? 'vestido' : 'tunica']);
  return resultado;
}
