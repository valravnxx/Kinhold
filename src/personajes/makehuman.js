// Personajes del taller propio: cuerpo de MakeHuman vestido por código, con las animaciones de Quaternius pasadas
// a su esqueleto (herramientas/taller/). Un solo .glb por personaje, con ropa, pelo, ojos y animaciones.
// Devuelve lo mismo que crearPersonaje() de cargar.js, para que el visor y el juego los usen igual.
// Las 39 animaciones extra (trabajos, arco, espada ligera y pesada, escudo, pasos…), pasadas al mismo esqueleto, van
// aparte (op.extra: true, ~1 MB más por personaje): recursos/personajes/taller-anim-v1/mh_<sexo>_extra.glb. Con
// op.extra = 'carpeta/' se cogen de otra carpeta.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CLIPS, CLIPS_EXTRA } from './cargar.js';
import { normalizarAspecto, colorDe, pesosFormas, escalaAltura, piezasCabeza } from '../logica/aspecto.js';
import { TALLER } from '../logica/prendas.js';
import { normalizarTintes, colorFigura, NUM_BLASON, paletaDe, PRENDAS_TENIBLES } from '../logica/tintes.js';
import { HECHURAS, normalizarHechuras, naturalDe, largoDe, granoDe, NUM_TEJIDO } from '../logica/hechura.js';
import { prepararDetalle } from './detalle.js';

const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const cargar = (url) => { if (!cache.has(url)) cache.set(url, cargador.loadAsync(url)); return cache.get(url); };

// calcos pintados sobre la piel; la barba larga no (desde taller-v14 es una malla con volumen, que se recorta)
const CALCO = /_(vello|barba_(corta|bigote|perilla))$/;
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

// Blasón de la sobreveste (taller-v13): el dibujo sale de la posición de cada punto en el cuerpo en reposo (x: de un
// lado a otro, la derecha del que la lleva en x < 0; y: altura sobre el pecho), así vale para el cuerpo y la falda de la
// prenda sin textura nueva ni rehacer el modelo. Dentro de la figura, el color de la tela se cambia por el de la figura
// (manteniendo el dibujo de la tela). Bordes suavizados con fwidth. Va delante y detrás, como en las sobrevestes de verdad.
const ANCHO_PIEZA = 0.06; // media anchura de palo, faja, banda, cruz, sotuer y cheurón (m)
// Hechura de la tela (src/logica/hechura.js), en el mismo sombreado: el tejido (sarga, espiguilla, cuadros, rayas), el
// grano del material (la lana más irregular que el lino) y el corte (la falda se corta a una altura, con el dobladillo
// algo más oscuro). Como el blasón, sale de la posición en reposo (en m): alrededor del cuerpo, s = ángulo × 0,16 m, y
// la altura, y. Los dibujos se suavizan y se apagan cuando son más finos que un píxel (de lejos no hacen muaré).
const TELA_GLSL = `
float kh_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kh_ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(kh_hash(i), kh_hash(i + vec2(1, 0)), f.x), mix(kh_hash(i + vec2(0, 1)), kh_hash(i + vec2(1, 1)), f.x), f.y); }
// franja suavizada: 1 dentro de [0, ancho) de cada periodo; la media si es más fina que un píxel
float kh_banda(float x, float ancho) { float w = fwidth(x) + 1e-5, f = fract(x);
  float b = smoothstep(0.0, w, f) - smoothstep(ancho, ancho + w, f); return mix(b, ancho, smoothstep(0.3, 0.7, w)); }
float kh_rayado(float x, float amp) { float w = fwidth(x); return sin(x * 6.2832) * amp * (1.0 - smoothstep(0.2, 0.5, w)); }
`;
function ponerSombreadoTela(material, u, conBlason) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vReposo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReposo = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vReposo;
uniform int uBlason; uniform vec3 uFigura; uniform float uPecho;
uniform int uTejido; uniform float uGrano; uniform float uCorte;
${TELA_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vReposo.y < uCorte) discard; // corte: lo que queda por debajo del bajo no se dibuja`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 p = vReposo; float s = atan(p.x, p.z) * 0.16, y = p.y, k = 1.0;
  if (uTejido == 1) k += kh_rayado((s + y) / 0.005, 0.07);                       // sarga: costillas en diagonal
  else if (uTejido == 2) { float c = floor(s / 0.012); float dir = mod(c, 2.0) * 2.0 - 1.0;
    k += kh_rayado((y + dir * s) / 0.005, 0.08) - 0.05 * kh_banda(s / 0.012, 0.08); } // espiguilla: zigzag en columnas
  else if (uTejido == 3) { float bx = kh_banda(s / 0.045 + 0.5, 0.3), by = kh_banda(y / 0.045, 0.3);
    k *= (1.0 - 0.17 * bx) * (1.0 - 0.17 * by) * (1.0 + 0.08 * (1.0 - bx) * (1.0 - by)); } // cuadros
  else if (uTejido == 4) k *= 1.0 - 0.22 * kh_banda(y / 0.032, 0.35);               // rayas
  // grano: hilos de grosor desigual (lana más que lino), de unos 3 mm; se apaga de lejos
  float gw = fwidth(y * 330.0);
  k += uGrano * (kh_ruido(vec2(s, y) * vec2(120.0, 330.0)) - 0.5) * 2.0 * (1.0 - smoothstep(0.4, 0.9, gw));
  if (uCorte > -50.0) k *= mix(0.8, 1.0, smoothstep(uCorte, uCorte + 0.014, y)); // dobladillo
  diffuseColor.rgb *= k;
}
` + (conBlason ? `
if (uBlason > 0) {
  float x = vReposo.x, y = vReposo.y - uPecho, w = ${ANCHO_PIEZA.toFixed(3)}, d = 0.0;
  if (uBlason == 1) d = -x;                                         // partido: la mitad diestra
  else if (uBlason == 2) d = y;                                     // cortado: la mitad de arriba
  else if (uBlason == 3) d = min(abs(x), abs(y)) * sign(-x * y);    // cuartelado: cuarteles 1 y 4
  else if (uBlason == 4) d = w - abs(x);                            // palo
  else if (uBlason == 5) d = w - abs(y);                            // faja
  else if (uBlason == 6) d = w - abs(x + y) * 0.7071;               // banda: de arriba a la diestra hacia abajo
  else if (uBlason == 7) d = w - min(abs(x), abs(y));               // cruz
  else if (uBlason == 8) d = w - min(abs(x + y), abs(x - y)) * 0.7071; // sotuer
  else if (uBlason == 9) d = w - abs(y - 0.06 + abs(x) * 0.9) * 0.74;  // cheurón, con la punta arriba
  float fw = fwidth(d) * 0.8 + 1e-4;
  float m = smoothstep(-fw, fw, d);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb / max(diffuse, vec3(1e-4)) * uFigura, m);
}` : ''));
  };
  material.customProgramCacheKey = () => conBlason ? 'tela-blason' : 'tela';
}
// la sombra de una falda cortada: el mismo corte en el material de la sombra
function sombraCortada(u) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCorte = u.uCorte;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAlto;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlto = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlto; uniform float uCorte;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vAlto < uCorte) discard;');
  };
  m.customProgramCacheKey = () => 'sombra-cortada';
  return m;
}

// ---- la capa se mueve al andar (tela sencilla, sin simulación) ----
// Lo habitual en juegos sin simulación de tela: la capa va con la espalda y la pelvis (taller-v15) y, encima, el
// sombreado la desplaza en cada vértice según su altura (nada en los hombros; más cuanto más abajo, al cuadrado, como un
// péndulo): al andar se queda atrás y, al girar, hacia fuera; al pararse vuelve con un muelle amortiguado (se pasa un
// poco y se asienta). Por detrás se mueve entera; hacia los bordes de delante, cada vez menos, para no meterse en las
// piernas. Una onda pequeña sube por la tela al ritmo del paso. Al echarse atrás, sube un poco (la tela no se estira).
// Va en el sombreado de la ropa y en el de su sombra; la malla de lejos (detalle.js) no la lleva: de lejos no se ve.
const VUELO_GLSL = `
uniform vec3 uVuelo; uniform vec2 uOnda; uniform vec3 uCapaAlto;
vec3 kh_vuelo(vec3 p) {
  float w = clamp((uCapaAlto.x - p.y) / (uCapaAlto.x - uCapaAlto.y), 0.0, 1.0); w *= w;
  float atras = smoothstep(0.12, -0.04, p.z - uCapaAlto.z); // 1 por detrás del cuerpo, 0 en los bordes de delante
  vec3 d = vec3(uVuelo.x, 0.0, uVuelo.z * mix(0.25, 1.0, atras)) * w;
  d.x += uOnda.x * w * sin(uOnda.y - p.y * 6.0 + p.x * 5.0) * mix(0.4, 1.0, atras);
  d.z += uOnda.x * 0.7 * w * atras * sin(uOnda.y * 1.1 - p.y * 5.0 + 1.3);
  d.y += 0.5 * dot(d.xz, d.xz) / max(uCapaAlto.x - p.y, 0.25);
  return d;
}
`;
function ponerVuelo(material, v) {
  const antes = material.onBeforeCompile, clave = material.customProgramCacheKey;
  material.onBeforeCompile = (sh, r) => {
    if (antes) antes(sh, r);
    Object.assign(sh.uniforms, v);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VUELO_GLSL)
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += kh_vuelo(position);');
  };
  const k = clave ? clave.call(material) : '';
  material.customProgramCacheKey = () => k + '-vuelo';
}
function sombraVuelo(v) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  ponerVuelo(m, v);
  return m;
}
// muelle de la capa: lo que se queda atrás (m, en el bajo) por cada m/s, el máximo, y cuánto se abre al girar (por rad/s)
const VUELO = { atras: 0.085, max: 0.26, giro: 0.06, maxGiro: 0.12, rigidez: 38, amortigua: 6.5 };

export async function crearPersonajeMH(op = {}, base = 'recursos/personajes/taller-v1/') {
  const o = { sexo: 'hombre', calidad: 'alta', extra: false, ...op };
  const carpetaExtra = typeof o.extra === 'string' ? o.extra : `${base}../taller-anim-v1/`;
  const [g, gExtra] = await Promise.all([cargar(`${base}mh_${o.sexo}.glb`), o.extra ? cargar(`${carpetaExtra}mh_${o.sexo}_extra.glb`) : null]);
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
  const cintura = new Map(); // altura de arriba de cada falda (en reposo): el corte acorta desde ahí
  modelo.traverse(n => { const c = n.isMesh && capaDe(n); if (c && c.falda) { n.geometry.computeBoundingBox(); bajo.set(c.capa, n.geometry.boundingBox.min.y); cintura.set(c.capa, n.geometry.boundingBox.max.y); } });
  // el bajo con el corte de la hechura (src/logica/hechura.js): largo = 1, como en el taller
  const alturaCorte = (capa, corte) => { const l = largoDe(corte); return l >= 1 ? -100 : cintura.get(capa) - l * (cintura.get(capa) - bajo.get(capa)); };
  const bajoEf = (capa) => { const h = resultado.hechuras?.[capa]; const a = h && bajo.has(capa) ? alturaCorte(capa, h.corte) : -100; return Math.max(bajo.get(capa), a); };
  let hayPies = false;
  modelo.traverse(n => { if (n.isMesh && n.name.endsWith('_pies')) hayPies = true; });
  const ponerCapas = (lista) => {
    const puestas = ORDEN.filter(c => c === 'camisa' || lista.includes(c));
    const ceñidas = puestas.filter(c => c !== 'manto');
    const fuera = ceñidas[ceñidas.length - 1]; // el cinturón va sobre la última prenda ceñida, bajo el manto
    const tocado = TOCADOS.find(t => lista.includes(t));
    // descalzo solo si el modelo tiene pies (taller-v12); en los anteriores se quedan los zapatos (si no, no habría pies)
    const descalzo = lista.includes(TALLER.descalzo) && hayPies;
    modelo.traverse(n => {
      if (!n.isMesh) return;
      const c = capaDe(n);
      if (cabezaDe(n)) return; // pelo, barba, orejas y cofia: los pone ponerCabeza
      else if (c && c.tipo === 'cinturon') n.visible = c.capa === fuera && c.capa !== 'camisa';
      else if (c && c.capa === 'zapatos') n.visible = !lista.includes('botas') && !descalzo;
      else if (n.name.endsWith('_pies')) n.visible = descalzo && !lista.includes('botas'); // la piel de los pies (taller-v12)
      else if (c && SIEMPRE.includes(c.capa)) n.visible = true;
      else if (c && TOCADOS.includes(c.capa)) n.visible = c.capa === tocado;
      else if (c && CALZADO.includes(c.capa)) n.visible = lista.includes(c.capa);
      else if (c) {
        const k = puestas.indexOf(c.capa), encima = puestas.slice(k + 1).filter(e => e !== 'manto');
        if (k < 0) n.visible = false;
        else if (c.falda) n.visible = encima.every(e => !bajo.has(e) || bajoEf(c.capa) < bajoEf(e) - 0.01);
        else if (c.mangas) n.visible = encima.every(e => !(e in MANGA) || MANGA[e] > MANGA[c.capa] + 0.005);
        else n.visible = encima.every(e => ABIERTAS.includes(e)); // la sobreveste deja ver el cuello y los hombros de lo de debajo
      }
    });
    resultado.capas = [...lista]; resultado.tocado = tocado;
    ponerCabeza();
  };
  // pelo, barba, orejas y cofia según el peinado, la barba y el tocado (src/logica/aspecto.js: piezasCabeza)
  const cabezaDe = (n) => { const m = n.isMesh && n.name.match(/(_pelo(_[a-z]+)?|_barba_[a-z]+|_orejas|_cofia)$/); return m && m[1]; };
  const ponerCabeza = () => {
    if (!resultado.aspecto) return;
    const ver = piezasCabeza(resultado.aspecto, resultado.tocado);
    let tri = 0;
    modelo.traverse(n => {
      if (!n.isMesh) return;
      const k = cabezaDe(n);
      if (k) n.visible = !!ver[k];
      if (n.visible) tri += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
    });
    resultado.triangulos = tri;
  };
  const hueso = {};
  modelo.traverse(n => { if (n.isBone || n.type === 'Object3D') hueso[n.name] = n; });
  hueso.Head = hueso.head; hueso.root = hueso.Root; // mismos nombres que el esqueleto de Quaternius
  const mezclador = new THREE.AnimationMixer(modelo);
  const acciones = {};
  for (const clip of g.animations) acciones[clip.name] = mezclador.clipAction(clip);
  for (const [id, nombre] of Object.entries(CLIPS)) if (acciones[nombre]) acciones[id] = acciones[nombre];
  // extra: las que se llaman igual que una básica (otra versión) van como «nombre_2», como en cargar.js
  const extra = {};
  for (const clip of gExtra ? gExtra.animations : []) {
    extra[clip.name] = acciones[clip.name] ? clip.name + '_2' : clip.name;
    acciones[extra[clip.name]] = mezclador.clipAction(clip);
  }
  for (const [id, nombre] of Object.entries(CLIPS_EXTRA)) if (extra[nombre]) acciones[id] = acciones[extra[nombre]];
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
      if (t && t !== 'ropa') { const c = lineal(colorDe(t, asp[t])), r = n.userData.ref || 1; n.material.color.setRGB(c[0] / r, c[1] / r, c[2] / r, THREE.LinearSRGBColorSpace); }
      ponerFormas(n, pesos);
    });
    resultado.aspecto = asp;
    ponerCabeza();
  };
  // ---- tintes de la ropa y blasón de la sobreveste (src/logica/tintes.js), sin volver a cargar el modelo ----
  // Las prendas teñibles (taller-v13) llevan en sus extras tinte «ropa», la prenda y el gris de referencia de su textura.
  const blason = { uBlason: { value: 0 }, uFigura: { value: new THREE.Color(1, 1, 1) }, uPecho: { value: 1.3 } };
  // hechura de cada prenda de tela (src/logica/hechura.js): tejido, grano del material y corte, en el sombreado de la tela
  const tela = new Map(); // malla → sus valores del sombreado
  {
    let alto = -Infinity;
    modelo.traverse(n => {
      if (!n.isMesh || n.userData.tinte !== 'ropa' || !HECHURAS[n.userData.prenda]) return;
      const u = { ...blason, uTejido: { value: 0 }, uGrano: { value: granoDe(HECHURAS[n.userData.prenda].materiales[0]) }, uCorte: { value: -100 } };
      ponerSombreadoTela(n.material, u, n.userData.prenda === 'sobreveste');
      const c = capaDe(n);
      if (c && c.falda) n.customDepthMaterial = sombraCortada(u);
      tela.set(n, { u, capa: c && c.capa, falda: !!(c && c.falda) });
      if (n.userData.prenda === 'sobreveste' && !/_falda$/.test(n.name)) { n.geometry.computeBoundingBox(); alto = Math.max(alto, n.geometry.boundingBox.max.y); }
    });
    if (alto > 0) blason.uPecho.value = alto - 0.2; // el cruce de la cruz, unos 20 cm por debajo del cuello
  }
  // la capa que se mueve al andar (VUELO_GLSL): de dónde a dónde cae y por dónde pasa el cuerpo (en reposo)
  const vuelo = { uVuelo: { value: new THREE.Vector3() }, uOnda: { value: new THREE.Vector2() }, uCapaAlto: { value: new THREE.Vector3() } };
  const mantos = [];
  // solo la capa que cae de los hombros (taller-v15 en adelante, la que lleva broche); la de antes era el cuerpo empujado
  if (modelo.getObjectByName(`${o.sexo}_capa_manto_broche`)) modelo.traverse(n => { if (n.isMesh && /_capa_manto(_falda)?$/.test(n.name)) mantos.push(n); });
  if (mantos.length) {
    const caja = new THREE.Box3();
    for (const n of mantos) { n.geometry.computeBoundingBox(); caja.union(n.geometry.boundingBox); }
    // arriba, unos 12 cm bajo el cuello (los hombros no se mueven); el cuerpo pasa por el medio de delante a atrás
    vuelo.uCapaAlto.value.set(caja.max.y - 0.12, caja.min.y, (caja.min.z + caja.max.z) / 2);
    for (const n of mantos) { ponerVuelo(n.material, vuelo); n.customDepthMaterial = sombraVuelo(vuelo); }
  }
  // el muelle: con lo que se ha movido el personaje (en el mundo) desde la última vez y lo que anda la animación puesta
  // (en el visor anda sin moverse); lo que más sea
  const muelle = { x: new THREE.Vector2(), v: new THREE.Vector2(), fase: 0, pos: null, rumbo: 0 };
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _f = new THREE.Vector3();
  const moverCapa = (dt) => {
    if (!mantos.length || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    modelo.getWorldPosition(_p); modelo.getWorldQuaternion(_q);
    _f.set(0, 0, 1).applyQuaternion(_q);
    const rumbo = Math.atan2(_f.x, _f.z);
    let adelante = 0, giro = 0;
    if (muelle.pos) {
      const d = _p.clone().sub(muelle.pos).setY(0);
      if (d.length() / dt < 15) { // más rápido: se ha puesto en otro sitio, no ha andado
        adelante = d.dot(_f.setY(0).normalize()) / dt;
        let dr = rumbo - muelle.rumbo; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        giro = dr / dt;
      }
    }
    muelle.pos = (muelle.pos || new THREE.Vector3()).copy(_p); muelle.rumbo = rumbo;
    for (const id of ['andar', 'correr']) {
      const a = acciones[id];
      if (a && a === actual && a.isRunning() && velocidad[id]) adelante = Math.max(adelante, velocidad[id] * a.getEffectiveTimeScale() * a.getEffectiveWeight());
    }
    const objetivo = new THREE.Vector2(
      THREE.MathUtils.clamp(giro * VUELO.giro, -VUELO.maxGiro, VUELO.maxGiro),
      -THREE.MathUtils.clamp(adelante * VUELO.atras, -VUELO.max / 2, VUELO.max));
    // muelle amortiguado, en pasos cortos para que no se dispare con fotogramas largos
    for (let t = 0; t < dt; t += 1 / 120) {
      const h = Math.min(1 / 120, dt - t);
      muelle.v.x += (VUELO.rigidez * (objetivo.x - muelle.x.x) - VUELO.amortigua * muelle.v.x) * h;
      muelle.v.y += (VUELO.rigidez * (objetivo.y - muelle.x.y) - VUELO.amortigua * muelle.v.y) * h;
      muelle.x.x += muelle.v.x * h; muelle.x.y += muelle.v.y * h;
    }
    const rapidez = Math.abs(adelante);
    muelle.fase = (muelle.fase + dt * 2 * Math.PI * (0.8 + 0.45 * Math.min(rapidez, 4))) % (2 * Math.PI * 100);
    vuelo.uVuelo.value.set(muelle.x.x, 0, muelle.x.y);
    vuelo.uOnda.value.set(0.011 * Math.min(rapidez / 1.4, 2), muelle.fase);
  };
  {
    const actualizar = mezclador.update.bind(mezclador);
    mezclador.update = (dt) => { const r = actualizar(dt); moverCapa(dt); return r; };
  }
  // color de una prenda: el del tinte o, sin teñir, el de su material (el lino crudo es más claro que la lana)
  const colorDe_ = (prenda, tinte) => {
    const p = PRENDAS_TENIBLES[prenda]; if (!p) return null;
    const c = paletaDe(prenda)[tinte];
    return (c && c[1]) || naturalDe(prenda, resultado.hechuras?.[prenda]?.material, p.natural);
  };
  const ponerTintes = (t) => {
    const tin = normalizarTintes(t, o.sexo);
    let ref = 1;
    modelo.traverse(n => {
      if (!n.isMesh || n.userData.tinte !== 'ropa') return;
      const c = lineal(colorDe_(n.userData.prenda, tin.prendas[n.userData.prenda]) || [255, 255, 255]);
      ref = n.userData.ref || 1;
      n.material.color.setRGB(c[0] / ref, c[1] / ref, c[2] / ref, THREE.LinearSRGBColorSpace);
    });
    const f = lineal(colorFigura(tin.blason.color));
    blason.uFigura.value.setRGB(f[0] / ref, f[1] / ref, f[2] / ref, THREE.LinearSRGBColorSpace);
    blason.uBlason.value = NUM_BLASON[tin.blason.dibujo] || 0;
    resultado.tintes = tin;
  };
  // hechuras: { prenda: { material, corte, tejido } }; lo que falte, la de siempre (se ve como el taller)
  const ponerHechuras = (hs) => {
    const h = normalizarHechuras(hs);
    resultado.hechuras = h;
    for (const [n, { u, capa, falda }] of tela) {
      const p = h[n.userData.prenda];
      u.uTejido.value = NUM_TEJIDO[p.tejido] || 0;
      u.uGrano.value = granoDe(p.material);
      u.uCorte.value = falda && bajo.has(capa) ? alturaCorte(capa, p.corte) : -100;
    }
    if (resultado.tintes) ponerTintes(resultado.tintes);
    if (resultado.capas) ponerCapas(resultado.capas);
  };
  const resultado = { raiz, modelo, mezclador, acciones, poner, triangulos, velocidad, opciones: o, hueso, clips: [...g.animations.map(c => c.name), ...Object.values(extra)], ponerCapas, ponerAspecto, ponerTintes, ponerHechuras, hechuras: normalizarHechuras(o.hechuras),
    // las prendas que se pueden teñir en este modelo (las de antes de la taller-v13 no se tiñen)
    tenibles: (() => { const s = new Set(); modelo.traverse(n => { if (n.isMesh && n.userData.tinte === 'ropa') s.add(n.userData.prenda); }); return [...s]; })(),
    // la altura del corte de una falda (hechura), para la malla de lejos (detalle.js)
    corteDe: (n) => tela.has(n) ? tela.get(n).u.uCorte.value : -100,
    // cuánto se ha movido el bajo de la capa (m, en los ejes del modelo: x a un lado, z adelante), para las pruebas
    vueloCapa: () => ({ x: vuelo.uVuelo.value.x, z: vuelo.uVuelo.value.z, onda: vuelo.uOnda.value.x }),
    capasPosibles: [...[...ORDEN, ...SUELTAS].filter(c => c !== 'camisa' && modelo.getObjectByName(`${o.sexo}_capa_${c}`)), ...(hayPies ? [TALLER.descalzo] : [])], tocados: TOCADOS };
  ponerCapas(o.capas || [o.sexo === 'mujer' ? 'vestido' : 'tunica']);
  ponerAspecto(o.aspecto);
  ponerHechuras(o.hechuras);
  ponerTintes(o.tintes);
  // niveles de detalle (detalle.js): ponerNivel(n) y, envueltas, las funciones de arriba para rehacer la malla de lejos
  await prepararDetalle(resultado);
  return resultado;
}
