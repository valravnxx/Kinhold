// Kinhold — los modelos de lo que piden y dan las recetas de P3 y hasta ahora salía con el hatillo de lino (tarea de
// P3, 6 nov): cómo se ven en el suelo, lo depositado en una estación y su imagen en el panel de fabricar
// (herramientas/iconos/). Estilo v5: piezas sencillas con su color por vértice, texturas por código y oclusión de
// contacto al pie. Medidas de las cosas de verdad, en metros; todo apoyado en el suelo (y = 0).
//
// Cómo es cada uno (como los de verdad, sin adornos):
//  - fibra cruda: un manojo de hebras pálidas de ortiga, dobladas por la mitad y con una vuelta atada.
//  - haz de juncos: tallos verdes y finos, largos (1,3 m), atados en dos sitios.
//  - haz de mimbre: varas de sauce peladas, finas y rectas (1,5 m), atadas en dos sitios.
//  - piel: una piel curtida estirada, de contorno irregular con las patas, el pelo hacia arriba.
//  - resina: unos grumos de color ámbar sobre un trozo de corteza.
//  - cordel: una madeja de cordel fino enrollada, con una vuelta que la ata.
//  - cuerda: una adujada de cuerda más gruesa, en espiras.
//  - cinturón de cuerda: cuerda trenzada en un rollo, con las dos puntas anudadas fuera.
//  - honda: dos cordeles con la cazoleta de cuero en medio, el lazo del dedo en una punta y el nudo en la otra.
//  - odre: un pellejo de cabra cosido, panzudo, con el cuello atado y la correa.
//  - nasa: un cono de mimbre con aros, la boca abierta y la punta atada.
//  - trampa de lazo: la estaca clavada con el cordel y el lazo abierto delante.
//  - cubo: duelas de madera con dos aros de mimbre y el asa de cuerda.
//  - hacha de piedra: la cabeza de piedra pulida en el mango de madera, atada con tiras.
//  - corteza (7 nov): dos tiras de corteza arrancadas, curvadas en canal, la cara de fuera rugosa y la de dentro clara.
//  - cintos de cuero (7 nov, para el panel de equipo): la correa enrollada de canto, con la hebilla de hierro en la punta
//    de fuera; el de anillas, con sus dos anillas de hierro; el de armas, más ancho y oscuro, con el tahalí de la espada.
//  - saco (7 nov): un saco de lino lleno, tumbado, con la boca atada con cordel.
//  - bandolera (7 nov): la bolsa de cuero con su tapa y la correa larga tirada en un arco.
//  - taladro de fuego (7 nov): el arco con su cordel, el huso de punta tostada, la tabla con muescas quemadas y la
//    piedra de apoyo.
//  - bayas (P4): un puñado de bayas rojas y negro morado sobre una hoja ancha, con alguna ramita de su mata.
//  - setas (P4): tres setas de sombrero pardo y pie crema, una tumbada, como recién cogidas.
//  - carne cruda (9 nov, la de la liebre despiezada): el lomo y los dos cuartos traseros, rojo oscuro con la tela
//    blanquecina por encima y la punta del hueso de cada pata, sobre una hoja.
//  - carne asada (9 nov): lo mismo, tostado, con las puntas del hueso quemadas y alguna mancha quemada, sobre una hoja.
//  - las semillas silvestres (P11, 13 nov), cada una sobre una hoja ancha como las bayas: la cebada silvestre, un manojo
//    de espigas pajizas con sus aristas; las habas, unas vainas verde oscuro y unas habas sueltas, pardo verdosas; las
//    asadas, tostadas y alguna partida; las semillas de col y de nabo, un montoncito de granos redondos y pequeños
//    (pardo rojizos los de la col, casi negros los del nabo) con unas silicuas secas al lado.
//  - yesca (7 nov): un trozo de hongo yesquero cortado (pardo, con su corte claro y aterciopelado) junto a un nido de
//    fibra seca deshilachada, pálida.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { cajaR } from '../mundo/modelos.js';

const FIBRA = 0xb3a77f, CORDEL = 0x9c8a60, CUERDA = 0x86714c, JUNCO = 0x7f8a4c, JUNCO_PUNTA = 0xa59a62, MIMBRE = 0xb39a6c;
const TOSTADO = 0x2f2620, LIBER = 0xb49a74, YESQUERO = 0x6e6152, YESCA_CORTE = 0xa58a62, YESCA_FIBRA = 0xc2b48a;
const CUERO = 0x6b4c35, CUERO_OSC = 0x4f3726, PIEL_PELO = 0x7d6346, AMBAR = 0x8a561d, AMBAR_CLARO = 0xa36d2a;
const BAYA_ROJA = 0xb0222e, BAYA_NEGRA = 0x3b1630, HOJA_BAYA = 0x3f5a2e, SETA = 0x8c5a32, SETA_PIE = 0xe2d6bc, SETA_LAMINAS = 0xcbb894;
const CARNE = 0x7a2b27, CARNE_OSC = 0x5e211d, TELA = 0xa8746a, HUESO = 0xddd2bb, ASADA = 0x58301a, ASADA_OSC = 0x3e200f, QUEMADA = 0x2e1c12;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const az = (id, k) => { let h = 2166136261; for (const ch of id + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
const lote = (rango = 0.05) => new Lote({ rangoSuelo: rango, variacion: 0.06 });
const mallas = L => {
  const g = new THREE.Group();
  for (const [tex, geos] of Object.entries(L.cerrar(null, true))) { const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; g.add(m); }
  return g;
};
// un tubo por una curva (cordeles, lazos, asas)
const tubo = (puntos, r, lados = 5, cerrado = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos, cerrado), Math.max(8, puntos.length * 6), r, lados, cerrado);
// una atadura alrededor de un haz tumbado a lo largo de X
const atadura = (L, x, y, r, color = CORDEL) => L.add(new THREE.TorusGeometry(r, 0.005, 4, 14), color, x, y, 0, { y: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });

// Un haz de tallos o varas tumbado a lo largo de X: n tallos de largo y radio dados, apretados en el centro.
function haz(L, { n, largo, r, color, punta = null, ataduras = [-0.25, 0.25], abre = 0.02, id, tex = 'veta' }) {
  const R = Math.sqrt(n) * r * 1.15;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399, d = R * Math.sqrt((i + 0.5) / n);
    const y = R + Math.sin(a) * d, z = Math.cos(a) * d, dx = (az(id, i) - 0.5) * largo * 0.08;
    const g = (az(id, i + 30) - 0.5) * abre;
    L.add(cil(r * 0.75, r, largo, 5), color, dx, y, z, { z: Math.PI / 2, y: g }, { tex });
    if (punta) L.add(new THREE.ConeGeometry(r * 0.75, largo * 0.12, 4), punta, dx + largo * 0.56, y, z, { z: -Math.PI / 2, y: g }, { sinSuelo: true });
  }
  for (const f of ataduras) atadura(L, f * largo, R, R * 1.05);
  return R;
}

function fibra(n, id) {
  const L = lote(0.04);
  // un manojo doblado por la mitad: dos ramales que salen del pliegue y se abren un poco, con una vuelta atada
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399, d = 0.028 * Math.sqrt((i + 0.5) / 26), lado = i % 2 ? 1 : -1;
    const y = 0.03 + Math.sin(a) * d, z = Math.cos(a) * d * 1.6;
    const fin = v3(0.32 + az(id, i) * 0.06, 0.012 + az(id, i + 9) * 0.01, z * 2.4 + lado * 0.03);
    L.add(tubo([v3(0, y, z), v3(0.12, y * 0.8, z * 1.4), fin], 0.0035 + az(id, i + 5) * 0.002, 3), i % 3 ? FIBRA : 0x9d9468, 0, 0, 0, null, { tex: 'liso' });
  }
  L.add(new THREE.TorusGeometry(0.03, 0.008, 5, 12), FIBRA, -0.005, 0.03, 0, { y: Math.PI / 2 }, { tex: 'paja' }); // el pliegue
  atadura(L, 0.07, 0.028, 0.03, 0x8c8058);
  return mallas(L);
}
const juncos = (n, id) => { const L = lote(0.06); haz(L, { n: 22, largo: 1.3, r: 0.006, color: JUNCO, punta: JUNCO_PUNTA, id, tex: 'paja', abre: 0.05 }); return mallas(L); };
const mimbre = (n, id) => { const L = lote(0.06); haz(L, { n: 24, largo: 1.5, r: 0.005, color: MIMBRE, id, abre: 0.015 }); return mallas(L); };

function piel(n, id) {
  const L = lote(0.02);
  // el contorno de una piel de ciervo o de cabra estirada: cuerpo ovalado, las cuatro patas y el cuello
  const P = [[0, 0.36], [0.07, 0.3], [0.16, 0.31], [0.27, 0.38], [0.24, 0.24], [0.21, 0.08], [0.22, -0.12], [0.26, -0.3], [0.3, -0.42], [0.15, -0.33], [0.06, -0.38], [0, -0.42]];
  const pts = [...P, ...P.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y], i) => new THREE.Vector2(x * (1 + (az(id, i) - 0.5) * 0.12), y));
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  // un poco ondulada, como se queda una piel en el suelo
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.02 * Math.sin(p.getX(i) * 9 + 1) * Math.cos(p.getZ(i) * 6));
  g.computeVertexNormals();
  L.add(g, PIEL_PELO, 0, 0.01, 0, { y: az(id, 40) }, { tex: 'liso', rayas: (v) => 0.88 + 0.12 * Math.cos(v.x * 7) * Math.cos(v.z * 5) }); // el pelo, más oscuro en el lomo
  return mallas(L);
}

// una tira de corteza curvada en canal (medio tubo), tumbada a lo largo de X: fuera la corteza, dentro el líber claro
function tiraCorteza(L, largo, ancho, x, z, giro, id, k) {
  const r = ancho / 2, ab = Math.PI * (0.9 + az(id, k) * 0.3);
  // en canal: el arco abajo (rotateX), y la cara de dentro con las caras y las normales vueltas hacia el eje
  const fuera = new THREE.CylinderGeometry(r, r * 0.92, largo, 8, 3, true, -ab / 2, ab); fuera.rotateX(Math.PI / 2); fuera.rotateY(Math.PI / 2);
  const dentro = new THREE.CylinderGeometry(r * 0.94, r * 0.86, largo * 0.98, 8, 3, true, -ab / 2, ab); dentro.scale(-1, 1, 1);
  const nd = dentro.attributes.normal; for (let i = 0; i < nd.count; i++) nd.setXYZ(i, -nd.getX(i), -nd.getY(i), -nd.getZ(i));
  dentro.rotateX(Math.PI / 2); dentro.rotateY(Math.PI / 2);
  const g = new THREE.Matrix4().makeRotationY(giro);
  L.add(fuera, 'corteza', x, r, z, g, { tex: 'corteza' });
  L.add(dentro, LIBER, x, r, z, g, { tex: 'veta', sinSuelo: true });
}
function corteza(n, id) {
  const L = lote(0.03);
  tiraCorteza(L, 0.42, 0.1, 0, 0, az(id, 1) * 0.4, id, 1);
  tiraCorteza(L, 0.34, 0.08, 0.02, 0.1, -0.3 + az(id, 2) * 0.4, id, 2);
  return mallas(L);
}
function yesca(n, id) {
  const L = lote(0.03);
  // el trozo de yesquero: una cuña gruesa y redondeada, parda por fuera, con el corte de dentro claro
  const cuna = new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI, 0, Math.PI / 2); cuna.scale(1.2, 0.75, 0.9);
  L.add(cuna, YESQUERO, -0.05, 0.004, 0, { y: az(id, 1) * 0.6 }, { tex: 'corteza' });
  L.add(new THREE.CircleGeometry(0.06, 10, 0, Math.PI), YESCA_CORTE, -0.05, 0.005, 0, new THREE.Matrix4().makeRotationY(az(id, 1) * 0.6).multiply(new THREE.Matrix4().makeScale(1.2, 0.75, 1)), { tex: 'liso', sinSuelo: true });
  // el nido de fibra seca: hebras finas enredadas en un montoncito
  for (let i = 0; i < 30; i++) {
    const a = i * 2.399, d = 0.012 + (i % 5) * 0.008, y = 0.008 + (i % 4) * 0.007;
    const c = v3(0.07 + Math.cos(a) * d, y, Math.sin(a) * d);
    L.add(tubo([c.clone().add(v3(-0.03, 0, -0.01)), c.clone().add(v3(0, 0.01, 0.02 * Math.sin(a))), c.clone().add(v3(0.03, -0.004, 0.01))], 0.002, 3), i % 3 ? YESCA_FIBRA : FIBRA, 0, 0, 0, { y: a }, { tex: 'liso', sinSuelo: i > 8 });
  }
  return mallas(L);
}

function bayas(n, id) {
  const L = lote(0.03);
  // la hoja ancha, algo abarquillada, y encima el montón de bayas (más con más)
  const hoja = new THREE.CircleGeometry(0.075, 10); hoja.rotateX(-Math.PI / 2); hoja.scale(1.5, 1, 1);
  const p = hoja.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.6);
  L.add(hoja, HOJA_BAYA, 0, 0.003, 0, { y: az(id, 1) }, { tex: 'liso' });
  const k = Math.min(16, 7 + (n || 1) * 2);
  for (let i = 0; i < k; i++) {
    const a = i * 2.399, d = 0.012 + Math.sqrt(i / k) * 0.05, y = 0.018 + (i < k / 3 ? 0.02 : 0);
    L.add(new THREE.IcosahedronGeometry(0.014, 1), i % 3 ? BAYA_ROJA : BAYA_NEGRA, Math.cos(a) * d * 1.3, y, Math.sin(a) * d, null, { tex: 'liso', sinSuelo: true, brillo: 1.15 });
  }
  L.add(cil(0.002, 0.003, 0.09, 4), 0x6e3a2c, 0.04, 0.03, 0.03, { z: 1.2, y: 0.5 }, { tex: 'corteza', sinSuelo: true });
  return mallas(L);
}
// La carne de una liebre (9 nov): el lomo (a lo largo de X) y los dos cuartos traseros con la punta del hueso.
// asada: tostada. n: cuántas piezas (hasta 3, una junto a otra).
function piezaCarne(L, x, z, giro, asada, id) {
  const m = new THREE.Matrix4().makeRotationY(giro), en = (dx, dy, dz) => v3(dx, dy, dz).applyMatrix4(m).add(v3(x, 0, z));
  const C = asada ? ASADA : CARNE, C2 = asada ? ASADA_OSC : CARNE_OSC;
  const lomo = new THREE.SphereGeometry(0.035, 12, 8); lomo.scale(2.3, 0.62, 1.25);
  let p = en(0.02, 0.03, 0); L.add(lomo, C, p.x, p.y, p.z, { y: giro }, { tex: 'liso' });
  // la tela de encima del lomo (cruda) o la costra (asada)
  const tela = new THREE.SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 4); tela.scale(2.2, 0.6, 0.7);
  p = en(0.02, 0.03, 0); L.add(tela, asada ? ASADA_OSC : TELA, p.x, p.y, p.z, { y: giro }, { tex: 'liso', sinSuelo: true, brillo: asada ? 0.9 : 1.1 });
  for (const lado of [-1, 1]) {
    const muslo = new THREE.SphereGeometry(0.03, 10, 8); muslo.scale(1.25, 0.85, 0.9);
    p = en(-0.085, 0.027, lado * 0.03); L.add(muslo, C2, p.x, p.y, p.z, { y: giro + lado * 0.35 }, { tex: 'liso', sinSuelo: true });
    // la pata: la caña de carne y la punta del hueso
    p = en(-0.135, 0.022, lado * 0.045); L.add(cil(0.009, 0.014, 0.07, 6), C, p.x, p.y, p.z, { z: Math.PI / 2, y: giro + lado * 0.4 }, { tex: 'liso', sinSuelo: true });
    p = en(-0.178, 0.021, lado * 0.062); L.add(cil(0.0045, 0.006, 0.026, 5), asada ? QUEMADA : HUESO, p.x, p.y, p.z, { z: Math.PI / 2, y: giro + lado * 0.4 }, { tex: 'liso', sinSuelo: true });
  }
  if (asada) {
    // la costra tostada, con dos o tres manchas quemadas encima (sin espetón: a lo lejos parecía un bicho)
    for (let i = 0; i < 3; i++) { p = en(-0.03 + i * 0.035, 0.05, (az(id, i) - 0.5) * 0.025); L.add(new THREE.SphereGeometry(0.009, 5, 3), QUEMADA, p.x, p.y, p.z, null, { tex: 'liso', sinSuelo: true, escala: v3(1.6, 0.3, 1.1) }); }
  }
}
function carne(asada) {
  return (n, id) => {
    const L = lote(0.04);
    {   // la hoja ancha debajo
      const hoja = new THREE.CircleGeometry(0.1, 10); hoja.rotateX(-Math.PI / 2); hoja.scale(2.2, 1, 1.2);
      L.add(hoja, HOJA_BAYA, -0.03, 0.003, 0, { y: az(id, 1) * 0.5 }, { tex: 'liso' });
    }
    const k = Math.max(1, Math.min(2, n || 1));
    for (let i = 0; i < k; i++) piezaCarne(L, 0, (i - (k - 1) / 2) * 0.11, (az(id, i + 3) - 0.5) * 0.3, asada, id + i);
    return mallas(L);
  };
}
// La carne seca (P9, 13 nov): tres tiras oscuras y arrugadas, más finas que la carne fresca, sobre la hoja.
const SECA = 0x352014, SECA_CLARA = 0x4a2a1a;
function carneSeca(n, id) {
  const L = lote(0.04);
  { const hoja = new THREE.CircleGeometry(0.1, 10); hoja.rotateX(-Math.PI / 2); hoja.scale(2.2, 1, 1.2); L.add(hoja, HOJA_BAYA, 0, 0.003, 0, { y: az(id, 1) * 0.5 }, { tex: 'liso' }); }
  const k = 3;
  for (let i = 0; i < k; i++) {
    const largo = 0.2 + az(id, i + 5) * 0.04, tira = new THREE.BoxGeometry(largo, 0.01, 0.03, 8, 1, 1), p = tira.attributes.position;
    for (let j = 0; j < p.count; j++) { const x = p.getX(j); p.setY(j, p.getY(j) + Math.sin(x * 38 + i) * 0.004); p.setZ(j, p.getZ(j) * (1 - 0.3 * Math.abs(x / largo))); }   // arrugada y más fina en las puntas
    tira.computeVertexNormals();
    L.add(tira, i === 1 ? SECA_CLARA : SECA, (az(id, i + 9) - 0.5) * 0.02, 0.012 + i * 0.011, (i - 1) * 0.034, { y: (az(id, i + 20) - 0.5) * 0.35 }, { tex: 'liso', sinSuelo: true, brillo: 0.85 });
  }
  return mallas(L);
}
function setas(n, id) {
  const L = lote(0.03);
  const seta = (x, z, h, r, inclX, inclZ, g) => {
    const m = new THREE.Matrix4().makeRotationY(g).multiply(new THREE.Matrix4().makeRotationX(inclX)).multiply(new THREE.Matrix4().makeRotationZ(inclZ));
    L.add(cil(r * 0.32, r * 0.42, h, 7), SETA_PIE, x, h / 2, z, m, { tex: 'liso' });
    const somb = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); somb.scale(1, 0.62, 1); somb.translate(0, h, 0);
    L.add(somb, SETA, x, 0, z, m, { tex: 'liso', sinSuelo: true });
    const lam = new THREE.CircleGeometry(r * 0.97, 12); lam.rotateX(Math.PI / 2); lam.translate(0, h + 0.001, 0);
    L.add(lam, SETA_LAMINAS, x, 0, z, m, { tex: 'liso', sinSuelo: true });
  };
  seta(-0.03, 0, 0.07, 0.045, 0.08, 0, az(id, 1));
  seta(0.05, 0.03, 0.055, 0.036, -0.1, 0.12, az(id, 2) * 3);
  seta(0.01, -0.06, 0.06, 0.04, Math.PI / 2 - 0.15, 0, az(id, 3) * 6);   // la tumbada
  return mallas(L);
}

// (P11) las semillas silvestres
const ESPIGA = 0xcdb46a, ARISTA = 0xd9c991, VAINA = 0x4a5a30, HABA = 0x8a7a4e, HABA_ASADA = 0x5a3d22, SILICUA_SECA = 0xa49a62;
function hojaBase(L, id, r = 0.075) {
  const hoja = new THREE.CircleGeometry(r, 10); hoja.rotateX(-Math.PI / 2); hoja.scale(1.5, 1, 1);
  const p = hoja.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.6);
  L.add(hoja, HOJA_BAYA, 0, 0.003, 0, { y: az(id, 1) }, { tex: 'liso' });
}
function cebada(n, id) {
  const L = lote(0.03);
  const k = Math.min(9, 4 + (n || 1));
  for (let i = 0; i < k; i++) {   // espigas tumbadas, en abanico, con su trozo de caña
    const g = (i - (k - 1) / 2) * 0.16 + az(id, i) * 0.1, m = new THREE.Matrix4().makeRotationY(g).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2)).setPosition(-0.06, 0, 0);
    const cana = cil(0.002, 0.0025, 0.12, 3); cana.translate(0, 0.0, 0);
    L.add(cana, 0xb3a46a, 0, 0.012 + (i % 2) * 0.006, 0, m, { sinSuelo: true });
    for (let g2 = 0; g2 < 7; g2++) {   // la espiga: los granos en dos filas, gruesos, y una arista corta en cada uno
      const gr = new THREE.IcosahedronGeometry(0.0075, 0); gr.scale(0.8, 1.5, 0.8); gr.translate((g2 % 2 ? 0.005 : -0.005), 0.07 + g2 * 0.011, 0);
      L.add(gr, ESPIGA, 0, 0.012 + (i % 2) * 0.006, 0, m, { tex: 'liso', sinSuelo: true, brillo: 1.05 });
      const ar = new THREE.CylinderGeometry(0.0009, 0.0009, 0.05, 3); ar.translate(g2 % 2 ? 0.006 : -0.006, 0.1 + g2 * 0.011, 0);
      L.add(ar, ARISTA, 0, 0.012 + (i % 2) * 0.006, 0, m.clone().multiply(new THREE.Matrix4().makeRotationZ(g2 % 2 ? -0.15 : 0.15)), { sinSuelo: true, brillo: 1.1 });
    }
  }
  return mallas(L);
}
function habas(asadas) {
  return (n, id) => {
    const L = lote(0.03); hojaBase(L, id);
    if (!asadas) for (let i = 0; i < 2; i++) {   // dos vainas enteras
      const v = new THREE.CapsuleGeometry(0.011, 0.075, 2, 6); v.rotateZ(Math.PI / 2);
      L.add(v, VAINA, -0.02 + i * 0.015, 0.014, -0.03 + i * 0.03, { y: az(id, i) * 0.8 - 0.4 }, { escala: v3(1, 0.8, 1.25), tex: 'liso', sinSuelo: true, brillo: 1.05 });
    }
    const k = Math.min(10, 4 + (n || 1));
    for (let i = 0; i < k; i++) {   // las habas sueltas: ovaladas y algo aplastadas
      const a = i * 2.399, d = 0.01 + Math.sqrt(i / k) * 0.045;
      L.add(new THREE.SphereGeometry(0.011, 8, 6), asadas ? (i % 3 ? HABA_ASADA : TOSTADO) : HABA, Math.cos(a) * d * 1.3 + (asadas ? 0 : 0.02), 0.016 + (i < 3 ? 0.008 : 0), Math.sin(a) * d + (asadas ? 0 : 0.02), { y: a }, { escala: v3(1.3, 0.7, 1), tex: 'liso', sinSuelo: true });
    }
    return mallas(L);
  };
}
function semillas(color) {
  return (n, id) => {
    const L = lote(0.03); hojaBase(L, id, 0.06);
    for (let i = 0; i < 3; i++) L.add(cil(0.003, 0.003, 0.07, 3), SILICUA_SECA, -0.04 + i * 0.012, 0.01, 0.025, { z: Math.PI / 2, y: az(id, i) - 0.5 }, { sinSuelo: true });
    for (let i = 0; i < 22; i++) {   // el montoncito de granos
      const a = i * 2.399, d = Math.sqrt(i / 22) * 0.03, y = 0.012 + (0.03 - d) * 0.5;
      L.add(new THREE.IcosahedronGeometry(0.005, 0), color, Math.cos(a) * d + 0.01, y, Math.sin(a) * d - 0.005, null, { tex: 'liso', sinSuelo: true });
    }
    return mallas(L);
  };
}

function resina(n, id) {
  const L = lote(0.03);
  L.add(cajaR(0.2, 0.025, 0.11, 0.01), 'corteza', 0, 0.012, 0, { y: 0.3 }, { tex: 'corteza' });
  const k = Math.min(6, 3 + (n || 1));
  for (let i = 0; i < k; i++) {
    const a = i * 2.2, d = 0.02 + (i % 3) * 0.022;
    L.add(new THREE.DodecahedronGeometry(0.016 + az(id, i) * 0.012, 0), i % 2 ? AMBAR : AMBAR_CLARO, Math.cos(a) * d * 1.6, 0.034, Math.sin(a) * d * 0.7, { y: i, x: i * 0.7 }, { plano: true, escala: v3(1, 0.7, 1), brillo: 1.05, sinSuelo: true });
  }
  return mallas(L);
}

// una madeja o adujada: espiras que se apilan un poco desplazadas
function rollo(L, { espiras, radio, grueso, color, id, tex = 'paja' }) {
  for (let i = 0; i < espiras; i++) {
    const r = radio * (1 - i * 0.06), dx = (az(id, i) - 0.5) * radio * 0.12, dz = (az(id, i + 7) - 0.5) * radio * 0.12;
    L.add(new THREE.TorusGeometry(r, grueso, 5, 22), color, dx, grueso * (1 + i * 1.5), dz, { x: Math.PI / 2 + (az(id, i + 3) - 0.5) * 0.15 }, { tex });
  }
}
function cordel(n, id) {
  const L = lote(0.03);
  rollo(L, { espiras: 7, radio: 0.06, grueso: 0.004, color: CORDEL, id });
  // la vuelta que ata la madeja, cruzada
  L.add(new THREE.TorusGeometry(0.018, 0.004, 4, 10), 0x86774f, 0.055, 0.02, 0, { y: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
  L.add(tubo([v3(0.06, 0.012, 0.01), v3(0.1, 0.004, 0.03), v3(0.14, 0.002, 0.02)], 0.003, 4), CORDEL, 0, 0, 0, null, { tex: 'liso' }); // la punta suelta
  return mallas(L);
}
function cuerda(n, id) {
  const L = lote(0.05);
  rollo(L, { espiras: 5, radio: 0.13, grueso: 0.011, color: CUERDA, id });
  L.add(tubo([v3(0.13, 0.012, 0.02), v3(0.2, 0.01, 0.06), v3(0.27, 0.01, 0.03)], 0.01, 6), CUERDA, 0, 0, 0, null, { tex: 'paja' });
  return mallas(L);
}
function cinturonCuerda(n, id) {
  const L = lote(0.03);
  // la cuerda trenzada: dos cabos que se retuercen uno con otro, en un rollo, con las puntas anudadas
  const r = 0.09, N = 60;
  for (const fase of [0, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2.2, t = a * 9 + fase; pts.push(v3(Math.cos(a) * (r + Math.cos(t) * 0.006) - (a > Math.PI * 2 ? 0 : 0), 0.012 + Math.sin(t) * 0.006 + a * 0.004, Math.sin(a) * (r + Math.cos(t) * 0.006))); }
    L.add(tubo(pts, 0.0075, 5), fase ? CUERDA : 0x95805a, 0, 0, 0, null, { tex: 'paja' });
  }
  for (const s of [0, 1]) { // las puntas, con su nudo, fuera del rollo
    const x0 = r * (s ? 0.6 : 1), z0 = s ? 0.06 : 0.0;
    L.add(tubo([v3(x0, 0.015, z0), v3(x0 + 0.07, 0.01, z0 + 0.03 + s * 0.03), v3(x0 + 0.13, 0.008, z0 + 0.02 + s * 0.05)], 0.008, 5), CUERDA, 0, 0, 0, null, { tex: 'paja' });
    L.add(new THREE.SphereGeometry(0.014, 7, 5), 0x7d6a46, x0 + 0.13, 0.012, z0 + 0.02 + s * 0.05, null, { tex: 'paja', sinSuelo: true });
  }
  return mallas(L);
}

function honda(n, id) {
  const L = lote(0.02);
  // la cazoleta de cuero en el centro, abombada, y los dos cordeles curvados a cada lado
  const caz = new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4);
  L.add(caz, CUERO, 0, 0.004, 0, { x: Math.PI }, { escala: v3(1.5, 0.45, 1), tex: 'liso' });
  L.add(caz, CUERO, 0, 0.004, 0, null, { escala: v3(1.5, 0.25, 1), tex: 'liso' });
  for (const s of [-1, 1]) {
    const pts = [v3(s * 0.065, 0.008, 0)];
    for (let i = 1; i <= 8; i++) pts.push(v3(s * (0.065 + i * 0.05), 0.004, Math.sin(i * 0.55 + (s > 0 ? 0 : 2)) * 0.06));
    L.add(tubo(pts, 0.003, 4), CORDEL, 0, 0, 0, null, { tex: 'liso' });
    const fin = pts[pts.length - 1];
    if (s > 0) L.add(new THREE.TorusGeometry(0.018, 0.003, 4, 12), CORDEL, fin.x + 0.016, 0.004, fin.z, { x: Math.PI / 2 }, { tex: 'liso' }); // el lazo del dedo
    else L.add(new THREE.SphereGeometry(0.008, 6, 4), 0x86774f, fin.x, 0.006, fin.z, null, { tex: 'liso' }); // el nudo
  }
  return mallas(L);
}

function odre(n, id) {
  const L = lote(0.06);
  // el pellejo: un cuerpo panzudo tumbado, el cuello estrecho atado y la correa
  const perfil = [[0, 0], [0.07, 0.01], [0.11, 0.06], [0.12, 0.13], [0.1, 0.2], [0.06, 0.25], [0.03, 0.28], [0.028, 0.33], [0.032, 0.35], [0, 0.35]].map(([x, y]) => new THREE.Vector2(x, y));
  const cuerpo = new THREE.LatheGeometry(perfil, 12);
  L.add(cuerpo, CUERO, 0, 0.09, 0, { z: -Math.PI / 2 + 0.12 }, { escala: v3(1, 1, 0.8), tex: 'liso' });
  L.add(new THREE.TorusGeometry(0.031, 0.005, 4, 10), CORDEL, 0.32, 0.12, 0, { y: Math.PI / 2, z: 0.12 }, { tex: 'liso', sinSuelo: true }); // la atadura del cuello
  // la costura a lo largo, más oscura
  L.add(tubo([v3(0.0, 0.17, 0), v3(0.12, 0.2, 0), v3(0.24, 0.17, 0)], 0.003, 3), CUERO_OSC, 0, 0, 0, null, { tex: 'liso', sinSuelo: true });
  // la correa, tirada en el suelo en un arco
  L.add(tubo([v3(0.02, 0.06, 0.08), v3(-0.08, 0.008, 0.2), v3(0.12, 0.004, 0.3), v3(0.3, 0.01, 0.14), v3(0.3, 0.09, 0.04)], 0.007, 4), CUERO_OSC, 0, 0, 0, null, { escala: v3(1, 1, 1), tex: 'liso' });
  return mallas(L);
}

function nasa(n, id) {
  const L = lote(0.08);
  // un cono de mimbre tumbado: la boca de 30 cm, 70 cm de largo, aros por fuera y la punta atada
  const largo = 0.7, boca = 0.15;
  const cono = cil(0.025, boca, largo, 14, true);
  L.add(cono, MIMBRE, 0, boca, 0, { z: Math.PI / 2 }, { tex: 'paja', rayas: (v) => 0.85 + 0.15 * Math.sin(Math.atan2(v.z, v.y - boca) * 14) });
  // (la punta, estrecha, queda en -X y la boca en +X)
  for (const f of [0.25, 0.55, 0.85]) { const r = 0.025 + (boca - 0.025) * f; L.add(new THREE.TorusGeometry(r + 0.004, 0.007, 4, 16), 'madera', -largo / 2 + largo * f, boca, 0, { y: Math.PI / 2 }, { tex: 'veta' }); }
  // el embudo de la boca, hacia dentro (por donde entra el pez y no sale)
  L.add(cil(0.04, boca * 0.95, 0.2, 14, true), 0x9c8558, largo / 2 - 0.1, boca, 0, { z: Math.PI / 2 }, { tex: 'paja' });
  L.add(new THREE.TorusGeometry(0.02, 0.006, 4, 10), CORDEL, -largo / 2 - 0.01, boca, 0, { y: Math.PI / 2 }, { tex: 'liso' });
  return mallas(L);
}

function trampaLazo(n, id) {
  const L = lote(0.05);
  // la estaca, una ramita doblada sujeta a ella y el lazo de cuerda abierto delante, a ras de suelo
  L.add(cil(0.012, 0.016, 0.3, 6), 'madera', 0, 0.15, 0, { z: 0.08 }, { tex: 'veta' });
  L.add(new THREE.ConeGeometry(0.012, 0.05, 6), 'madera', 0.006, 0.0, 0, { x: Math.PI }, { tex: 'veta' });
  L.add(tubo([v3(0.01, 0.27, 0), v3(0.12, 0.3, 0.01), v3(0.24, 0.25, 0.02), v3(0.3, 0.17, 0.02)], 0.006, 5), 'corteza', 0, 0, 0, null, { tex: 'corteza' }); // la ramita que hace de muelle
  L.add(tubo([v3(0.3, 0.17, 0.02), v3(0.31, 0.12, 0.02), v3(0.3, 0.09, 0.02)], 0.0025, 4), CORDEL, 0, 0, 0, null, { tex: 'liso' });
  L.add(new THREE.TorusGeometry(0.06, 0.0025, 4, 18), CORDEL, 0.3, 0.07, 0.02, { y: 0.2 }, { tex: 'liso', sinSuelo: true }); // el lazo
  return mallas(L);
}

function cubo(n, id) {
  const L = lote(0.1);
  // duelas: un cilindro algo más ancho arriba, con las juntas marcadas; dos aros de mimbre y el asa de cuerda
  const alto = 0.28, r0 = 0.12, r1 = 0.14, D = 14;
  L.add(cil(r1, r0, alto, D * 2, true), 'tabla', 0, alto / 2, 0, null, { tex: 'veta', rayas: (v) => { const a = (Math.atan2(v.z, v.x) / (Math.PI * 2) + 1) * D; return (a % 1) < 0.07 ? 0.62 : 0.95 + 0.08 * Math.sin(Math.floor(a) * 2.3); } });
  L.add(new THREE.CircleGeometry(r0 * 0.97, D * 2), 'corte', 0, 0.025, 0, { x: -Math.PI / 2 }, { sinSuelo: true, tex: 'veta' }); // el fondo, visto por dentro
  L.add(cil(r1 * 0.96, r0 * 0.96, alto - 0.02, D * 2, true), 'maderaOsc', 0, alto / 2 + 0.01, 0, null, { escala: v3(-1, 1, 1), tex: 'veta', sinSuelo: true, brillo: 0.8 }); // por dentro (en espejo: se ven sus caras de dentro)
  for (const f of [0.22, 0.78]) L.add(new THREE.TorusGeometry(r0 + (r1 - r0) * f + 0.004, 0.007, 4, 28), MIMBRE, 0, alto * f, 0, { x: Math.PI / 2 }, { tex: 'paja', sinSuelo: true });
  L.add(tubo([v3(-r1, alto * 0.86, 0), v3(-0.1, alto + 0.12, 0.02), v3(0.1, alto + 0.12, 0.02), v3(r1, alto * 0.86, 0)], 0.007, 5), CUERDA, 0, 0, 0, { y: 0.4 }, { tex: 'paja', sinSuelo: true });
  return mallas(L);
}

// El hacha de piedra (revisión del 1 nov: la primera herramienta para talar los jóvenes): la cabeza de piedra pulida,
// en forma de gota con el filo abajo, encajada en el mango y atada con tiras de cuero cruzadas. Tumbada en el suelo.
// loteHachaPiedra() da sus piezas (el mango a lo largo de +Y con la mano en el origen y el filo hacia +Z, como el hacha
// de hierro de src/juego/personaje.js): así la misma sirve para la mano, el cinturón y el suelo.
export function modeloHachaPiedra() { return mallas(loteHachaPiedra()); }
export function loteHachaPiedra() {
  const L = new Lote({ variacion: 0.04, rangoSuelo: 0.001, suelo: -100 });
  L.add(cil(0.016, 0.02, 0.62, 8), 'tabla', 0, 0.21, 0, null, { tex: 'veta' });
  L.add(new THREE.SphereGeometry(0.022, 8, 5), 'tabla', 0, -0.1, 0, null, { escala: v3(1, 0.7, 1.3), tex: 'veta' });
  const y = 0.47;
  const cabeza = new THREE.SphereGeometry(0.05, 10, 7);
  L.add(cabeza, 'piedraOsc', 0, y, 0.055, { x: Math.PI / 2 }, { escala: v3(0.55, 1.7, 0.8), tex: 'piedra' });
  L.add(cil(0.003, 0.003, 0.07, 4), 0x8a8780, 0, y, 0.135, null, { escala: v3(3, 1, 1), plano: true, sinSuelo: true }); // el filo pulido
  for (const dy of [-0.025, 0.025]) L.add(new THREE.TorusGeometry(0.022, 0.005, 4, 10), CUERO_OSC, 0, y + dy, 0.005, { x: Math.PI / 2 + dy * 8 }, { tex: 'liso' });
  return L;
}
// El mazo de piedra (valravnx, 8 nov: para romper las rocas medianas): un canto de río gordo y alargado, cruzado en la
// punta de un mango de rama que se abre en horquilla para abrazarlo, y atado con vueltas de cordel en cruz por encima y
// por debajo de la piedra. Mismo sistema que el hacha (el mango a lo largo de +Y, la mano en el origen, la piedra
// cruzada a lo largo de Z): así sirve para la mano, el cinturón, el suelo y su imagen.
export function modeloMazoPiedra() { return mallas(loteMazoPiedra()); }
export function loteMazoPiedra() {
  const L = new Lote({ variacion: 0.05, rangoSuelo: 0.001, suelo: -100 });
  // el mango: una rama algo torcida, con la corteza, más gorda hacia la piedra; el pomo, el muñón de una ramita
  L.add(tubo([v3(0, -0.12, 0), v3(0.004, 0.08, -0.003), v3(-0.003, 0.3, 0.004), v3(0, 0.43, 0)], 0.019, 7), 'corteza', 0, 0, 0, null, { tex: 'corteza' });
  L.add(new THREE.SphereGeometry(0.022, 8, 5), 'corteza', 0, -0.12, 0, null, { escala: v3(1, 0.8, 1), tex: 'corteza' });
  L.add(new THREE.CircleGeometry(0.019, 8), 'corte', 0, -0.135, 0, { x: Math.PI / 2 }, { tex: 'veta', sinSuelo: true });
  // la horquilla: dos brazos que suben por los lados de la piedra
  const y = 0.5;
  for (const sx of [-1, 1]) L.add(tubo([v3(sx * 0.004, 0.42, 0), v3(sx * 0.045, y - 0.035, 0), v3(sx * 0.054, y + 0.01, 0), v3(sx * 0.042, y + 0.06, 0)], 0.009, 6), 'corteza', 0, 0, 0, null, { tex: 'corteza', sinSuelo: true });
  // la piedra: un canto alargado y algo aplastado, cruzado (a lo largo de Z, hacia donde golpea), con las puntas más
  // claras de los golpes
  L.add(new THREE.IcosahedronGeometry(0.06, 2), 'piedraOsc', 0, y + 0.01, 0, { x: 0.06, y: 0.04 }, { escala: v3(0.74, 0.82, 1.9), tex: 'piedra' });
  for (const sz of [-1, 1]) L.add(new THREE.IcosahedronGeometry(0.026, 1), 0x8f8a80, 0, y + 0.012, sz * 0.098, null, { escala: v3(1, 1.05, 0.45), plano: true, sinSuelo: true });
  // las ataduras: dos vueltas de cordel que abrazan la piedra y los brazos de la horquilla, a cada lado del mango
  for (const sz of [-1, 1]) for (const d of [0, 0.011]) L.add(new THREE.TorusGeometry(0.056, 0.0045, 4, 16), CORDEL, 0, y + 0.01, sz * (0.03 + d), null, { escala: v3(1.02, 0.95, 1), tex: 'liso', sinSuelo: true });
  // y el cordel, de vueltas por el cuello del mango
  for (const dy of [0, 0.014, 0.028]) L.add(new THREE.TorusGeometry(0.021, 0.0042, 4, 12), CORDEL, 0, 0.405 + dy, 0, { x: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
  return L;
}
function mazoPiedraSuelo(n, id) { const g = new THREE.Group(), h = modeloMazoPiedra(); h.rotation.set(Math.PI / 2, 0, az(id, 3) * 6); h.position.y = 0.045; g.add(h); return g; }
// El taladro de fuego de arco (7 nov; el documento de sistemas lo nombra para encender la hoguera): el arco (una rama
// curvada con el cordel tenso de punta a punta), el huso (un palo recto con la punta tostada), la tabla con las
// muescas negras de otras veces y la piedra de apoyo con su hoyuelo. Todo tumbado en el suelo.
export function piezasArcoTaladro(L, { y0 = 0, enSuelo = true } = {}) {
  // el arco a lo largo de +Y (de 0 a 0,6), combado hacia +Z, y el cordel recto de punta a punta
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(v3(0, y0 + t * 0.6, Math.sin(t * Math.PI) * 0.07)); }
  L.add(tubo(pts, 0.011, 6), 'corteza', 0, 0, 0, null, { tex: 'corteza', sinSuelo: !enSuelo });
  for (const t of [0, 1]) L.add(new THREE.TorusGeometry(0.014, 0.003, 4, 8), CORDEL, 0, y0 + 0.02 + t * 0.56, 0.006, { x: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
  L.add(tubo([v3(0, y0 + 0.02, 0.004), v3(0, y0 + 0.3, -0.004), v3(0, y0 + 0.58, 0.004)], 0.0025, 4), CORDEL, 0, 0, 0, null, { tex: 'liso', sinSuelo: true });
}
export function piezasHuso(L, x, y, z, giro) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(giro.x || 0, giro.y || 0, giro.z || 0, 'YXZ'));
  L.add(cil(0.011, 0.011, 0.26, 7), 'madera', x, y, z, m.clone(), { tex: 'veta', sinSuelo: true });
  const d = v3(0, -0.14, 0).applyMatrix4(m);   // la punta de abajo, tostada de girar en la tabla
  L.add(new THREE.ConeGeometry(0.011, 0.025, 7), TOSTADO, x + d.x, y + d.y, z + d.z, m.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI)), { plano: true, sinSuelo: true });
}
function taladroFuego(n, id) {
  const L = lote(0.05);
  // la tabla, plana, con tres muescas quemadas en el canto
  L.add(cajaR(0.34, 0.022, 0.075, 0.004), 'tabla', 0, 0.011, 0, null, { tex: 'veta' });
  for (const x of [-0.09, 0, 0.09]) L.add(cil(0.012, 0.01, 0.006, 8), TOSTADO, x, 0.023, 0.026, null, { plano: true, sinSuelo: true });
  // el arco tumbado delante y el huso cruzado encima de la tabla
  const A = lote(0.05); piezasArcoTaladro(A, { y0: -0.3 });
  const g = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2 + 0.15)).setPosition(0.02, 0.012, 0.13);
  for (const p of A.piezas) { p.m.premultiply(g); L.piezas.push(p); }
  piezasHuso(L, 0.05, 0.034, -0.005, { z: Math.PI / 2, y: 0.5 });
  // la piedra de apoyo, con su hoyuelo
  L.add(new THREE.IcosahedronGeometry(0.035, 1), 'piedra', -0.2, 0.02, -0.09, { y: az(id, 1) * 3 }, { escala: v3(1.1, 0.6, 1), plano: true });
  return mallas(L);
}
function hachaPiedraSuelo(n, id) { const g = new THREE.Group(), h = modeloHachaPiedra(); h.rotation.set(Math.PI / 2, 0, az(id, 3) * 6); h.position.y = 0.03; g.add(h); return g; }
// Una correa de cuero de canto (el cinto enrollado): tramos cortos a lo largo de los puntos (en el suelo, XZ)
function correaCanto(L, pts, ancho, grueso, color) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
    L.add(cajaR(l + 0.004, ancho, grueso, 0.001), color, (a.x + b.x) / 2, ancho / 2, (a.z + b.z) / 2, { y: -Math.atan2(dz, dx) }, { tex: 'liso' });
  }
}
function cintoDe(clase) {
  return (n, id) => {
    const L = new Lote({ rangoSuelo: 0.04, variacion: 0.008 });   // la correa, de una pieza: sin cambio de color entre tramos
    const ancho = clase === 'armas' ? 0.048 : 0.036, color = clase === 'armas' ? CUERO_OSC : CUERO;
    // la correa enrollada: espiral de 1,6 vueltas que se abre hacia fuera y sale recta con la hebilla
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 2 * 1.6, r = 0.05 + t * 0.06; pts.push(v3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const u = pts[pts.length - 1], w = pts[pts.length - 2], dx = u.x - w.x, dz = u.z - w.z, l = Math.hypot(dx, dz);
    const fin = v3(u.x + dx / l * 0.1, 0, u.z + dz / l * 0.1);
    pts.push(fin);
    correaCanto(L, pts, ancho, 0.006, color);
    // la hebilla de hierro en la punta, un marco alrededor de la correa
    const giro = -Math.atan2(dz, dx);
    L.add(new THREE.TorusGeometry(ancho * 0.6, 0.004, 4, 4), 'hierro', fin.x, ancho / 2 + 0.002, fin.z, { y: giro + Math.PI / 2, z: Math.PI / 4 }, { escala: v3(1, 1.25, 1), plano: true, sinSuelo: true });
    L.add(cajaR(0.004, ancho * 1.05, 0.004, 0.001), 'hierro', fin.x, ancho / 2, fin.z, { y: giro }, { sinSuelo: true }); // el clavillo
    if (clase === 'anillas') for (const k of [12, 26]) { // dos anillas de hierro por fuera de la correa, colgando
      const q = pts[k], r = Math.hypot(q.x, q.z);
      L.add(new THREE.TorusGeometry(0.017, 0.0035, 4, 12), 'hierro', q.x * (1 + 0.025 / r), 0.018, q.z * (1 + 0.025 / r), { y: -Math.atan2(q.z, q.x) + Math.PI / 2, x: 0.5 }, { plano: true, sinSuelo: true });
    }
    if (clase === 'armas') { // el tahalí de la espada: una correa en lazo que sale del cinto
      const q = pts[30], r = Math.hypot(q.x, q.z), sx = q.x / r, sz = q.z / r;
      L.add(tubo([v3(q.x, 0.03, q.z), v3(q.x + sx * 0.06, 0.012, q.z + sz * 0.06), v3(q.x + sx * 0.1 - sz * 0.04, 0.008, q.z + sz * 0.1 + sx * 0.04), v3(q.x + sx * 0.05 - sz * 0.06, 0.008, q.z + sz * 0.05 + sx * 0.06), v3(q.x - sz * 0.03, 0.02, q.z + sx * 0.03)], 0.007, 4), CUERO, 0, 0, 0, null, { escala: v3(1, 0.5, 1), tex: 'liso', sinSuelo: true });
    }
    return mallas(L);
  };
}
function saco(n, id) {
  const L = lote(0.12);
  // el saco de lino lleno, tumbado: el cuerpo blando, el cuello recogido y atado con cordel, la boca abierta en volantes
  L.add(new THREE.IcosahedronGeometry(0.2, 3), 'lino', 0, 0.13, 0, { z: 0.08 }, { escala: v3(1.35, 0.65, 0.95), plano: false });
  L.add(new THREE.IcosahedronGeometry(0.06, 2), 'lino', 0.3, 0.1, 0.01, null, { escala: v3(1.2, 0.8, 0.9) });
  L.add(new THREE.TorusGeometry(0.032, 0.006, 4, 12), CORDEL, 0.34, 0.1, 0.01, { y: Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
  L.add(new THREE.ConeGeometry(0.055, 0.09, 7, 1, true), 'lino', 0.4, 0.1, 0.01, { z: Math.PI / 2 }, { sinSuelo: true });
  return mallas(L);
}
function bandolera(n, id) {
  const L = lote(0.05);
  // la bolsa de cuero, de pie, con la tapa caída por delante y su cierre; la correa larga tirada en un arco
  L.add(cajaR(0.2, 0.17, 0.07, 0.03), CUERO, 0, 0.085, 0, { y: 0.3 }, { tex: 'liso' });
  L.add(cajaR(0.21, 0.1, 0.012, 0.008), CUERO_OSC, 0.012, 0.12, 0.037, { y: 0.3 }, { tex: 'liso', sinSuelo: true });
  L.add(cil(0.006, 0.006, 0.012, 6), 'madera', 0.025, 0.08, 0.05, { x: Math.PI / 2, y: 0.3 }, { tex: 'veta', sinSuelo: true }); // el botón de madera
  L.add(tubo([v3(-0.1, 0.15, -0.02), v3(-0.18, 0.04, 0.05), v3(-0.14, 0.004, 0.24), v3(0.1, 0.004, 0.32), v3(0.24, 0.006, 0.18), v3(0.1, 0.15, 0.05)], 0.012, 4), CUERO_OSC, 0, 0, 0, null, { escala: v3(1, 1, 1), tex: 'liso' });
  return mallas(L);
}

// tipo del catálogo → (cuántos, id) → Group, apoyado en el suelo
export const MODELO_OBJETO = {
  carne_cruda: carne(false), carne_asada: carne(true), carne_seca: carneSeca,
  semilla_cebada: cebada, habas: habas(false), habas_asadas: habas(true), semilla_col: semillas(0x7a4a32), semilla_nabo: semillas(0x2e2622),
  fibra, junco: juncos, mimbre, piel, resina, corteza, yesca, bayas, setas, cordel, cuerda, cuerda_trenzada: cinturonCuerda,
  honda, odre, nasa, trampa_lazo: trampaLazo, cubo, hacha_piedra: hachaPiedraSuelo, mazo_piedra: mazoPiedraSuelo, taladro_fuego: taladroFuego,
  cinto_cuero: cintoDe('cuero'), cinto_anillas: cintoDe('anillas'), cinto_armas: cintoDe('armas'), saco, bandolera,
};
