// Kinhold — la naturaleza de Meshy (valravnx, 10 y 11 nov: el arte del juego, con Meshy; «todos los tipos de árboles,
// todos los tipos de arbustos, los tipos de roca y todo eso»): las siete especies de árbol, adultas y jóvenes, el
// matorral, el arbusto de las bayas, los helechos, las rocas y las plantas que se recogen (la hierba y las flores del
// suelo siguen de código: son miles y las de Meshy no bajaban a tan pocos triángulos), en
// docs/recursos/naturaleza/meshy-v1/ (herramientas/meshy/naturaleza.mjs: cada .glb con tres mallas, «cerca» con su
// textura, «medio» y «lejos» con el color en los vértices, el pie en y = 0 y a la medida del juego).
//
// Se cargan antes de entrar en el mundo (src/demo/main.js) y, si alguno no llega, se queda el de código (estilo v5):
// por eso cada sitio pregunta con naturaleza(nombre) y usa lo suyo si sale null. ?naturaleza=codigo: todo el de código
// (para comparar).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const ESPECIES_MESHY = ['abeto', 'pino', 'abedul', 'roble', 'haya', 'fresno', 'encina'];
export const LISTA_NATURALEZA = [...ESPECIES_MESHY, ...ESPECIES_MESHY.map(e => e + '_joven'),
  'matorral', 'arbusto_bayas', 'roca', 'pena', 'canto', 'hierba_larga', 'ortigas', 'juncos', 'helechos',
  'junco_recoger', 'junco_cortado', 'junco_adorno',
  'pared_estratos', 'pared_grietas', 'pared_saliente'];   // (13 nov, valravnx: las piezas de pared de los acantilados)   // (13 nov, valravnx: los juncos que se recogen, cortados y de adorno)

// la carpeta, al lado de la de los personajes que da cada prototipo (src/mundo/eleccion.js: recursosTaller)
export const carpetaNaturaleza = (recursos) => String(recursos || '../../recursos/personajes/taller/').replace(/personajes\/[^/]*\/?$/, 'naturaleza/meshy-v1/');

let cargados = null, cargando = null, carpetaCargada = null, cargandoAlto = null, version = 0;
// las plantas finas (hojas de una sola capa), por las dos caras
const DOS_CARAS = new Set(['hierba_larga', 'ortigas', 'juncos', 'helechos', 'junco_recoger', 'junco_cortado', 'junco_adorno']);
const ROCAS = new Set(['roca', 'pena', 'canto']);
// cuánta luz del cielo de más (o de menos) se llevan las plantas: 1,4 de día y 0,7 de noche (lo cambia el cielo)
export const rellenoPlantas = { value: 1.4 };
const modelo = (g, nombre, cosa) => {
  const o = g.scene.getObjectByName(nombre); if (!o) return null;
  const m = o.isMesh ? o : o.getObjectByProperty('isMesh', true); if (!m) return null;
  const map = m.material.map || null;
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
  // la malla viene cuantizada (meshopt: enteros con la escala y el sitio en su nodo): a números normales y a su medida,
  // que en el mundo va instanciada sin su nodo
  m.updateWorldMatrix(true, false);
  const geo = m.geometry.clone();
  for (const k of ['position', 'normal', 'uv', 'color']) {
    const a = geo.attributes[k]; if (!a || a.array instanceof Float32Array) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
  }
  geo.applyMatrix4(m.matrixWorld);
  if (!geo.attributes.normal) geo.computeVertexNormals();   // (la silueta de lejos del pino joven, hecha sin normales)
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mat = new THREE.MeshLambertMaterial({ map, vertexColors: true, side: DOS_CARAS.has(cosa) ? THREE.DoubleSide : THREE.FrontSide });
  // (12 nov, el aspecto de maqueta: con el sol fuerte, el lado en sombra de las copas se quedaba casi negro y perdía el
  // volumen) algo más de la luz del cielo en las plantas, como la que se cuela entre las hojas; las rocas, no
  // (de noche, al revés: las plantas de hoja clara brillaban frente a lo demás; lo pone el cielo: src/mundo/cielo.js)
  if (!ROCAS.has(cosa)) mat.onBeforeCompile = (s) => {
    s.uniforms.uRellenoPlantas = rellenoPlantas;
    s.fragmentShader = 'uniform float uRellenoPlantas;\n' + s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=uRellenoPlantas;');
  };
  return { geo, mats: mat };
};

// Carga todos (a la vez); devuelve cuántos han llegado. Nunca falla: lo que no llega se queda en código.
export function cargarNaturaleza(carpeta) {
  if (cargando) return cargando;
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && q.get('naturaleza') === 'codigo') { cargados = {}; return (cargando = Promise.resolve(0)); }
  const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
  const r = {};
  cargando = Promise.all(LISTA_NATURALEZA.map(n => l.loadAsync(carpeta + n + '.glb').then(g => {
    const cerca = modelo(g, 'cerca', n); if (!cerca) return;
    r[n] = { cerca, alto: cerca, medio: modelo(g, 'medio', n) || cerca, lejos: modelo(g, 'lejos', n) || cerca };
    // la medida de verdad: [radio de lo ancho, alto] (para no dibujar las copas que tapan al personaje)
    const b = new THREE.Box3().setFromBufferAttribute(cerca.geo.attributes.position);
    r[n].medida = [Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2, b.max.y];
  }).catch(() => {}))).then(() => { cargados = r; carpetaCargada = carpeta; return Object.keys(r).length; });
  return cargando;
}

// El de Meshy de esa cosa ({ cerca, medio, lejos, medida }), o null (sin cargar, o no llegó): el de código.
export const naturaleza = (nombre) => (cargados && cargados[nombre]) || null;
export const hayNaturaleza = () => !!(cargados && Object.keys(cargados).length);

// El detalle según el perfil gráfico (src/posprocesado/perfiles.js, «naturaleza»): hasta qué distancia va el modelo de
// cerca (con textura) y hasta cuál el de más detalle («alto», 0: nunca). Lo pone el juego al elegir el perfil.
let detalle = { cerca: null, alto: 0 };
export const ponerDetalleNaturaleza = (d) => { detalle = { cerca: (d && d.cerca) ?? null, alto: (d && d.alto) || 0 }; };
export const detalleNaturaleza = () => detalle;

// Los de más detalle (<nombre>_alto.glb), aparte: solo los bajan los perfiles gráficos que los usan, cuando se eligen.
// Mientras no llegan, en su sitio va el de cerca. Devuelve una promesa (true si ha llegado alguno).
export function cargarAltoNaturaleza() {
  if (cargandoAlto) return cargandoAlto;
  if (!cargados || !carpetaCargada) return Promise.resolve(false);
  const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
  let alguno = false;
  cargandoAlto = Promise.all(Object.keys(cargados).map(n => l.loadAsync(carpetaCargada + n + '_alto.glb').then(g => {
    const m = modelo(g, 'alto', n); if (m) { cargados[n].alto = m; alguno = true; }
  }).catch(() => {}))).then(() => { if (alguno) version++; return alguno; });
  return cargandoAlto;
}
export const versionNaturaleza = () => version;   // (cambia al llegar los de más detalle: src/mundo/especies.js rehace los suyos)
