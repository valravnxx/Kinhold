// Personajes del taller propio: cuerpo de MakeHuman vestido por código, con las animaciones de Quaternius pasadas
// a su esqueleto (herramientas/taller/). Un solo .glb por personaje, con ropa, pelo, ojos y animaciones.
// Devuelve lo mismo que crearPersonaje() de cargar.js, para que el visor y el juego los usen igual.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CLIPS } from './cargar.js';
import { normalizarAspecto, colorDe, pesosFormas, escalaAltura } from '../logica/aspecto.js';
import { TALLER } from '../logica/prendas.js';

const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const cargar = (url) => { if (!cache.has(url)) cache.set(url, cargador.loadAsync(url)); return cache.get(url); };

const CALCO = /_(vello|barba_[a-z]+)$/;
// Formas del modelo (peso, músculo, cara…): se ponen en la malla una vez, al cambiar el aspecto, y no en cada fotograma.
// Con las formas en la GPU, cada vértice de cada pieza las recorre todas en cada fotograma aunque estén a 0, y el aspecto
// casi nunca cambia. Cada personaje lleva su propia copia de las posiciones; lo demás (normales, UV, pesos de los huesos
// y las formas) se comparte entre personajes.
function sacarFormas(n) {
  const geo = n.geometry, formas = geo.morphAttributes.position;
  if (!formas || !formas.length) return;
  const nueva = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) nueva.setAttribute(k, k === 'position' ? a.clone() : a);
  nueva.setIndex(geo.index);
  for (const gr of geo.groups) nueva.addGroup(gr.start, gr.count, gr.materialIndex);
  n.userData.formas = { base: geo.attributes.position, deltas: formas, nombres: { ...n.morphTargetDictionary }, pesos: {} };
  n.geometry = nueva;
  n.morphTargetInfluences = undefined; n.morphTargetDictionary = undefined;
}
function ponerFormas(n, pesos) {
  const f = n.userData.formas; if (!f) return;
  const usar = Object.entries(f.nombres).filter(([k]) => pesos[k] > 0);
  const igual = Object.keys(f.nombres).every(k => (pesos[k] || 0) === (f.pesos[k] || 0));
  if (igual && n.geometry.userData.formasPuestas) return;
  const pos = n.geometry.attributes.position, b = f.base, N = pos.count;
  for (let i = 0; i < N; i++) {
    let x = b.getX(i), y = b.getY(i), z = b.getZ(i);
    for (const [k, t] of usar) { const d = f.deltas[t], w = pesos[k]; x += w * d.getX(i); y += w * d.getY(i); z += w * d.getZ(i); }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  n.geometry.userData.formasPuestas = true;
  f.pesos = Object.fromEntries(Object.keys(f.nombres).map(k => [k, pesos[k] || 0]));
}
// color sRGB (0-255) a lineal, igual que en el taller (potencia 2,2)
const lineal = (c) => c.map(x => (x / 255) ** 2.2);

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
    // y la ropa se ve del revés (fallo de la v5, lo vio valravnx). DoubleSide: por dentro del escote y las mangas
    Object.assign(n.material, { transparent: false, depthWrite: true, alphaTest: recorte ? 0.5 : 0, side: THREE.DoubleSide });
    // calcos de pelo pintados sobre la piel (cejas, pelo rapado, barba): mezcla suave, encima de la piel y sin tapar nada
    if (CALCO.test(n.name)) Object.assign(n.material, { transparent: true, depthWrite: false, alphaTest: 0, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    sacarFormas(n);
    triangulos += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
  });
  // ropa por capas, de dentro afuera. Lo que queda tapado del todo no se dibuja: el cuerpo de una capa se esconde si
  // lleva otra encima, y su falda solo asoma si es más larga que las de encima (así no se atraviesan al moverse).
  // El orden y cómo se tapan salen de los datos de cada prenda (src/logica/prendas.js): lo que se ve y lo que protege.
  const ORDEN = TALLER.orden;
  const SIEMPRE = TALLER.siempre;
  // abiertas: dejan ver lo de debajo (la sobreveste no tiene mangas; el manto va abierto por delante)
  const ABIERTAS = TALLER.abiertas;
  // aparte de las capas: tocados (uno cada vez) y calzado. Las botas van en lugar de los zapatos
  const TOCADOS = TALLER.tocados, CALZADO = TALLER.calzado, SUELTAS = [...TOCADOS, ...CALZADO];
  const capaDe = (n) => { const m = n.name.match(/_(capa|cinturon)_([a-z]+)(_falda|_mangas)?/); return m && { tipo: m[1], capa: m[2], falda: m[3] === '_falda', mangas: m[3] === '_mangas' }; };
  // dónde acaba cada manga (distancia a la muñeca, en m): una manga de debajo asoma si las de encima son más cortas
  const MANGA = { camisa: 0.041, tunica: 0.043, vestido: 0.043, gambeson: 0.04, cota: 0.09 };
  const bajo = new Map(); // altura del bajo de cada falda (en reposo)
  modelo.traverse(n => { const c = n.isMesh && capaDe(n); if (c && c.falda) { n.geometry.computeBoundingBox(); bajo.set(c.capa, n.geometry.boundingBox.min.y); } });
  const ponerCapas = (lista) => {
    const puestas = ORDEN.filter(c => c === 'camisa' || lista.includes(c));
    const ceñidas = puestas.filter(c => c !== 'manto');
    const fuera = ceñidas[ceñidas.length - 1]; // el cinturón va sobre la última prenda ceñida, bajo el manto
    const tocado = TOCADOS.find(t => lista.includes(t));
    let tri = 0;
    modelo.traverse(n => {
      if (!n.isMesh) return;
      const c = capaDe(n);
      if (n.name.endsWith('_orejas')) n.visible = tocado !== 'capucha' && tocado !== 'toca'; // bajo la tela no asoman
      else if (c && c.tipo === 'cinturon') n.visible = c.capa === fuera && c.capa !== 'camisa';
      else if (c && c.capa === 'zapatos') n.visible = !lista.includes('botas');
      else if (c && SIEMPRE.includes(c.capa)) n.visible = true;
      else if (c && TOCADOS.includes(c.capa)) n.visible = c.capa === tocado;
      else if (c && CALZADO.includes(c.capa)) n.visible = lista.includes(c.capa);
      else if (c) {
        const k = puestas.indexOf(c.capa), encima = puestas.slice(k + 1).filter(e => e !== 'manto');
        if (k < 0) n.visible = false;
        else if (c.falda) n.visible = encima.every(e => !bajo.has(e) || bajo.get(c.capa) < bajo.get(e) - 0.01);
        else if (c.mangas) n.visible = encima.every(e => !(e in MANGA) || MANGA[e] > MANGA[c.capa] + 0.005);
        else n.visible = encima.every(e => ABIERTAS.includes(e)); // la sobreveste deja ver el cuello y los hombros de lo de debajo
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
  // velocidad natural de andar y correr (m/s): lo que retrocede el pie apoyado respecto al cuerpo, medido en el propio
  // clip al cargar. El juego acelera la animación con velocidad / natural para que los pies no resbalen. (Antes era un
  // número fijo para correr, 2,59, que no salía de medir bien: la carrera del paquete iba a 5,8 m/s y se veía a cámara
  // lenta con zancadas enormes, una de las cosas por las que valravnx la vio «fea y exagerada».)
  const velocidad = {};
  {
    const mz = new THREE.AnimationMixer(modelo), pie = [hueso.ball_l, hueso.ball_r], v = new THREE.Vector3();
    for (const id of ['andar', 'correr']) {
      const clip = acciones[CLIPS[id]]?.getClip(); if (!clip || !pie[0]) continue;
      const a = mz.clipAction(clip).play(), N = 120, m = [];
      for (let i = 0; i <= N; i++) {
        mz.setTime(clip.duration * i / N); modelo.updateMatrixWorld(true);
        m.push(pie.map(p => { p.getWorldPosition(v); return [v.y, v.z]; }));
      }
      a.stop();
      const suelo = Math.min(...m.flat().map(x => x[0])), vs = [];
      for (let i = 0; i < N; i++) for (const k of [0, 1])
        if (m[i][k][0] < suelo + 0.05 && m[i + 1][k][0] < suelo + 0.05) vs.push((m[i][k][1] - m[i + 1][k][1]) / (clip.duration / N));
      vs.sort((x, y) => x - y);
      if (vs.length) velocidad[id] = vs[vs.length >> 1];
    }
    mz.uncacheRoot(modelo);
  }
  let actual = null;
  const poner = (id, mezcla = 0.25) => {
    const a = acciones[id] || acciones.quieto;
    if (a === actual && a.isRunning()) return;
    a.reset().setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(a, mezcla, false);
    actual = a;
  };
  poner('quieto', 0);
  // ---- aspecto (personalización): forma, colores, peinado y barba, sin volver a cargar el modelo ----
  // Las piezas que cambian de color llevan en sus «extras» qué color (tinte: piel, pelo u ojos) y el color de referencia
  // en el que se pintó su textura; el color nuevo va en el material (color lineal / referencia).
  const ponerAspecto = (a) => {
    const asp = normalizarAspecto(a, o.sexo), pesos = pesosFormas(asp);
    modelo.scale.setScalar(escalaAltura(asp));
    modelo.traverse(n => {
      if (!n.isMesh) return;
      const t = n.userData.tinte;
      if (t) { const c = lineal(colorDe(t, asp[t])), r = n.userData.ref || 1; n.material.color.setRGB(c[0] / r, c[1] / r, c[2] / r, THREE.LinearSRGBColorSpace); }
      ponerFormas(n, pesos);
      if (n.name.endsWith('_pelo')) n.visible = asp.peinado === 'corto';
      const b = n.name.match(/_barba_([a-z]+)$/);
      if (b) n.visible = asp.barba === b[1];
    });
    resultado.aspecto = asp;
    resultado.triangulos = 0;
    modelo.traverse(n => { if (n.isMesh && n.visible) resultado.triangulos += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3; });
  };
  const resultado = { raiz, modelo, mezclador, acciones, poner, triangulos, velocidad, opciones: o, hueso, clips: g.animations.map(c => c.name), ponerCapas, ponerAspecto,
    capasPosibles: [...ORDEN, ...SUELTAS].filter(c => c !== 'camisa' && modelo.getObjectByName(`${o.sexo}_capa_${c}`)), tocados: TOCADOS };
  ponerCapas(o.capas || [o.sexo === 'mujer' ? 'vestido' : 'tunica']);
  ponerAspecto(o.aspecto);
  return resultado;
}
