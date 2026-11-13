// Kinhold — lo que se recoge del suelo y de las plantas en la demo (nivel N0): ramas caídas, piedra suelta, sílex,
// fibra de ortigas y hierba larga, juncos y barro de la orilla, hongos yesqueros, (P4) bayas y setas y (P11) las semillas silvestres. La lógica (dónde sale, qué da, cuándo vuelve) está en src/logica/recoleccion.js;
// aquí se dibuja con el estilo v5 y se decide qué zonas tiene el terreno de la demo.
//
// En el mundo de verdad (crearRecoleccionMundo, abajo), lo que se recoge sale del sitio (src/logica/recogida_mundo.js):
// ramas en el bosque, sílex en la caliza, piedra en las laderas y los ríos, fibra en los claros y las riberas, y sigue
// al jugador por la isla como lo que crece. Lo de aquí debajo es solo para el llano de la construcción.
//
// Zonas del terreno del llano (provisional):
//  - claro: el llano de hierba antes del bosque (a menos de 25 m del centro).
//  - bosque: entre los árboles (de 30 a 110 m).
//  - ladera: donde empiezan las lomas, pasado el llano (más de 62 m).
//  - caliza: un afloramiento de roca caliza en la ladera del nordeste, con sus peñas claras.
// La demo no tiene ríos ni riberas: allí también saldrían la piedra, el sílex y la fibra cuando haya agua.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex, material } from '../mundo/estilos.js';
import { cil, copa } from '../mundo/decorado.js';
import { naturaleza } from '../mundo/naturaleza_meshy.js';
import { Recoleccion, repartirPuntos, RECOLECTABLES, cargarRecoleccion, guardarRecoleccion, ejecutarRecoleccion } from '../logica/recoleccion.js';
import { recogidaTrozo, LADO_RECOGIDA } from '../logica/recogida_mundo.js';
import { alturaMundo } from '../logica/whitholm.js';

export const CALIZA = { x: 50, z: -46, r: 8 }; // el afloramiento calizo (a unos 68 m del centro)

export function zonasDemo(x, z) {
  const d = Math.hypot(x, z), zs = [];
  if (d < 25) zs.push('claro');
  if (d > 30 && d < 110) zs.push('bosque');
  if (d > 62) zs.push('ladera');
  if (Math.hypot(x - CALIZA.x, z - CALIZA.z) < CALIZA.r) zs.push('caliza');
  return zs;
}

// ---------- Modelos (estilo v5: texturas por código, color por vértice, sombra de contacto) ----------
const PIEL_SILEX = 0xcfc6b0, NUCLEO_SILEX = 0x3e3b3c, CALIZA_COLOR = 0xbcb4a0, ORTIGA = 0x4a6436, ORTIGA_OSC = 0x3d5530;
const JUNCO = 0x7a8c4e, JUNCO_OSC = 0x687a43, JUNCO_FLOR = 0x7a6040, BARRO_SECO = 0x6e5a44, BARRO_HUMEDO = 0x4e3f31, BARRO_AGUA = 0x51473a;
const TOCON = 0x8a7660, TOCON_PODRIDO = 0x9c8c74, YESQUERO = 0x8c7b63, YESQUERO_BORDE = 0xc9bca3;
// (P4) las bayas: maduras rojas y negro morado, alguna aún verde rojiza; las cañas, pardo rojizo. Las setas: sombrero
// pardo y pie crema.
const CEPA = 0x5e5040, CEPA_OSC = 0x4a3f33, VARA_MIMBRE = 0x7a4a32, VARA_MIMBRE_ARR = 0x8a7a3e, HOJA_SAUCE = 0x7d8f5a, HOJA_SAUCE_OSC = 0x627548;
const BAYA_ROJA = 0xb0222e, BAYA_NEGRA = 0x3b1630, BAYA_VERDE = 0xb46a3c, CANA = 0x6e3a2c, SETA = 0xa2643a, SETA_OSC = 0x7e4c2a, SETA_PIE = 0xe2d6bc, SETA_LAMINAS = 0xcbb894;

function geoLote(fn, opc = {}) { // un modelo por tipo de textura: [{ geo, mat }]
  const L = new Lote({ rangoSuelo: opc.rangoSuelo ?? 0.25, variacion: 0.08 }); fn(L);
  const grupos = L.cerrar(null, true);
  return Object.entries(grupos).map(([tex, geos]) => ({ geo: mergeGeometries(geos), mat: opc.doble ? material('doble') : materialTex(tex) }));
}
// rama curvada: tramos de cilindro que siguen una curva suave, con dos ramitas
function rama(L, largo, grosor, x, z, giro, semilla) {
  const tramos = 4, puntos = [];
  for (let i = 0; i <= tramos; i++) {
    const t = i / tramos;
    puntos.push(new THREE.Vector3(t * largo - largo / 2, grosor * 0.9 + Math.sin(t * 3 + semilla) * 0.03, Math.sin(t * 2.2 + semilla) * 0.09 * largo));
  }
  const m = new THREE.Matrix4().makeRotationY(giro).setPosition(x, 0, z), eje = new THREE.Vector3(0, 1, 0);
  const tramo = (a, b, r1, r2) => {
    const d = new THREE.Vector3().subVectors(b, a), l = d.length();
    const g = cil(r2, r1, l, 5); const q = new THREE.Quaternion().setFromUnitVectors(eje, d.normalize());
    const mm = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1)).premultiply(m);
    const pos = new THREE.Vector3().setFromMatrixPosition(mm); mm.setPosition(0, 0, 0); // Lote.add pone la posición aparte
    L.add(g, 'corteza', pos.x, pos.y, pos.z, mm);
  };
  for (let i = 0; i < tramos; i++) tramo(puntos[i], puntos[i + 1], grosor * (1 - i * 0.15), grosor * (1 - (i + 1) * 0.15));
  // ramitas
  for (const [i, s] of [[1, 1], [3, -1]]) {
    const a = puntos[i], b = a.clone().add(new THREE.Vector3(0.18, 0.02, 0.16 * s).multiplyScalar(largo * 0.6));
    tramo(a, b, grosor * 0.45, grosor * 0.25);
  }
}
let cache = null;
export function modelosRecoleccion() {
  if (cache) return cache;
  const ramas = geoLote(L => { rama(L, 1.15, 0.035, 0, 0, 0.2, 1); rama(L, 0.9, 0.028, 0.05, 0.12, -0.5, 2); rama(L, 0.7, 0.022, -0.1, -0.1, 1.2, 3); }, { rangoSuelo: 0.2 });
  const piedra = geoLote(L => {
    L.add(new THREE.IcosahedronGeometry(0.14, 1), 'piedra', 0, 0.07, 0, { y: 0.4 }, { escala: new THREE.Vector3(1.25, 0.72, 1), plano: true });
  }, { rangoSuelo: 0.12 });
  const silex = geoLote(L => { // nódulo de corteza blanquecina con una cara rota que deja ver el sílex oscuro
    L.add(new THREE.IcosahedronGeometry(0.11, 1), PIEL_SILEX, 0, 0.08, 0, { y: 0.3, z: 0.2 }, { escala: new THREE.Vector3(1.3, 0.8, 1), plano: true, tex: 'piedra' });
    L.add(new THREE.IcosahedronGeometry(0.08, 0), NUCLEO_SILEX, 0.065, 0.09, 0.01, { y: 0.9, z: 0.5 }, { escala: new THREE.Vector3(0.8, 0.95, 0.95), plano: true, sinSuelo: true, tex: 'piedra' });
    L.add(new THREE.IcosahedronGeometry(0.07, 1), PIEL_SILEX, -0.17, 0.04, 0.09, { y: 2 }, { escala: new THREE.Vector3(1.2, 0.7, 1), plano: true, tex: 'piedra' });
  }, { rangoSuelo: 0.08 });
  // ortigas: tallos rectos con hojas opuestas, dentadas y apuntadas, de verde oscuro
  const hojaOrtiga = (() => {
    const s = new THREE.Shape(); s.moveTo(0, 0);
    const pts = [[0.022, 0.012], [0.03, 0.03], [0.026, 0.05], [0.032, 0.062], [0.02, 0.08], [0.016, 0.1], [0, 0.125]];
    for (const [x, y] of pts) s.lineTo(x, y);
    for (const [x, y] of pts.slice(0, -1).reverse()) s.lineTo(-x, y);
    s.lineTo(0, 0);
    return new THREE.ShapeGeometry(s);
  })();
  const ortiga = geoLote(L => {
    for (let k = 0; k < 11; k++) {
      const a = k * 2.4, d = 0.04 + (k % 4) * 0.06, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.6 + (k % 3) * 0.16;
      L.add(cil(0.006, 0.009, h, 4), ORTIGA_OSC, x, h / 2, z);
      for (let n = 0; n < 5; n++) {
        const y = h * (0.25 + n * 0.15), giro = a + n * Math.PI / 2, esc = 1.5 - n * 0.2;
        for (const lado of [0, Math.PI]) L.add(hojaOrtiga, n % 2 ? ORTIGA : ORTIGA_OSC, x, y, z, new THREE.Matrix4().makeRotationY(giro + lado).multiply(new THREE.Matrix4().makeRotationX(-1.0)), { escala: new THREE.Vector3(esc, esc, esc), sinSuelo: n > 0 });
      }
      L.add(hojaOrtiga, ORTIGA, x, h, z, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(-0.3)), { escala: new THREE.Vector3(0.6, 0.6, 0.6), sinSuelo: true });
    }
  }, { doble: true, rangoSuelo: 0.2 });
  // hierba larga: mata alta de hojas finas que se doblan, con espigas pajizas
  const hierbaLarga = geoLote(L => {
    for (let k = 0; k < 40; k++) {
      const a = k * 2.399, d = 0.02 + (k % 6) * 0.03, h = 0.7 + ((k * 7) % 5) * 0.1;
      const g = new THREE.ConeGeometry(0.012, h, 3, 3); g.translate(0, h / 2, 0);
      const p = g.attributes.position; // se dobla hacia fuera con la altura
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), f = (y / h) ** 2 * 0.22 * h; p.setX(i, p.getX(i) + f); }
      L.add(g, k % 3 ? 'hierbaClara' : 'hierba', Math.cos(a) * d, 0, Math.sin(a) * d, { y: -a }, { brillo: 1.05 });
      if (k % 4 === 0) L.add(new THREE.CylinderGeometry(0.012, 0.005, 0.14, 4), 0xb7a676, Math.cos(a) * d, h * 1.02, Math.sin(a) * d, { y: -a, z: -0.25 }, { sinSuelo: true });
    }
  }, { doble: true, rangoSuelo: 0.3 });
  // juncos (7 nov): una mata de tallos redondos, rectos y lisos de verde oscuro (1,2–1,6 m), unos pocos doblados, con
  // la panoja parda que sale de lado cerca de la punta, como el junco de las orillas
  const juncos = geoLote(L => {
    for (let k = 0; k < 34; k++) {
      const a = k * 2.399, d = 0.015 + (k % 7) * 0.022, h = 1.2 + ((k * 5) % 9) * 0.05, dobla = k % 6 === 0 ? 0.16 : 0.04;
      const g = new THREE.CylinderGeometry(0.0055, 0.01, h, 5, 4); g.translate(0, h / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), f = (y / h) ** 2 * dobla * h; p.setX(i, p.getX(i) + f); }
      L.add(g, k % 3 ? JUNCO : JUNCO_OSC, Math.cos(a) * d, 0, Math.sin(a) * d, { y: -a }, { brillo: 0.95 });
      if (k % 3 === 0) L.add(new THREE.IcosahedronGeometry(0.018, 0), JUNCO_FLOR, Math.cos(a) * d + 0.012 + dobla * 0.55 * h, h * 0.86, Math.sin(a) * d, { y: -a }, { escala: new THREE.Vector3(0.7, 1.6, 0.7), plano: true, sinSuelo: true });
    }
  }, { doble: true, rangoSuelo: 0.25 });
  // barro de la orilla (7 nov): un charco de lodo oscuro, de borde irregular y algo hundido en medio, con la tierra
  // removida alrededor; se ve húmedo (más oscuro donde hay agua)
  const barro = geoLote(L => {
    const borde = (r, y, n, sem) => {
      const s = new THREE.Shape();
      for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, q = r * (0.82 + 0.18 * Math.sin(a * 3 + sem) + 0.08 * Math.sin(a * 7 + sem * 2)); i ? s.lineTo(Math.cos(a) * q * 1.3, Math.sin(a) * q) : s.moveTo(Math.cos(a) * q * 1.3, Math.sin(a) * q); }
      const g = new THREE.ShapeGeometry(s, 2); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
    };
    L.add(borde(0.62, 0.012, 28, 1), BARRO_SECO, 0, 0, 0, null, { tex: 'piedra', sinSuelo: true });
    L.add(borde(0.48, 0.02, 24, 2), BARRO_HUMEDO, 0, 0, 0, null, { tex: 'piedra', sinSuelo: true });
    L.add(borde(0.26, 0.024, 18, 4), BARRO_AGUA, 0.05, 0, -0.03, null, { tex: 'liso', sinSuelo: true, brillo: 0.9 });
    // terrones removidos en el borde (de cavar)
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + 0.3, r = 0.5 + (k % 3) * 0.06;
      L.add(new THREE.IcosahedronGeometry(0.05 + (k % 2) * 0.02, 0), k % 2 ? BARRO_SECO : BARRO_HUMEDO, Math.cos(a) * r * 1.3, 0.02, Math.sin(a) * r, { y: k }, { escala: new THREE.Vector3(1.3, 0.55, 1), plano: true, tex: 'piedra' });
    }
  }, { rangoSuelo: 0.05 });
  // hongos yesqueros (7 nov): un tocón viejo y podrido (40 cm), con la corteza rota y la madera gris a la vista, y en
  // él tres o cuatro yesqueros en repisa: semicírculos gruesos, gris pardo con bandas, el borde claro
  const yesquero = geoLote(L => {
    L.add(cil(0.15, 0.19, 0.42, 9), TOCON, 0, 0.21, 0, { y: 0.4 }, { tex: 'corteza' });
    L.add(new THREE.CylinderGeometry(0.135, 0.15, 0.05, 9), TOCON_PODRIDO, 0, 0.43, 0, { x: 0.12, y: 0.4 }, { tex: 'veta', sinSuelo: true });
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.6; L.add(new THREE.ConeGeometry(0.06, 0.22, 5), TOCON, Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17, new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2 + 0.35)), { tex: 'corteza' }); } // el arranque de las raíces
    const repisa = (y, a, r, gr) => {
      const g = new THREE.SphereGeometry(r, 10, 5, -Math.PI / 2, Math.PI, 0, Math.PI / 2); g.scale(1, gr, 1);
      const x = Math.cos(a) * 0.16, z = Math.sin(a) * 0.16;
      L.add(g, YESQUERO, x, y, z, { y: -a + Math.PI / 2 }, { tex: 'corteza', sinSuelo: true });
      L.add(new THREE.TorusGeometry(r * 0.98, r * 0.12, 4, 12, Math.PI), YESQUERO_BORDE, x, y, z, new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), { sinSuelo: true });
    };
    repisa(0.3, 0.3, 0.11, 0.6); repisa(0.18, 0.75, 0.085, 0.65); repisa(0.36, 2.6, 0.095, 0.6); repisa(0.14, 4.2, 0.1, 0.6);
  }, { rangoSuelo: 0.15 });
  // (P4) el arbusto de bayas (valravnx, 7 nov: «que los arbustos que tengan bayas se vean claramente, y al recolectarlas
  // estas desaparezcan del mismo»): una mata baja y redonda (unos 0,8 m) de hoja oscura, con cañas pardo rojizo que
  // asoman, y muchas bayas en racimos por toda la cara de fuera, rojas y negro morado. El arbusto queda siempre; las
  // bayas son otra malla (fruto), que se va al cogerlas y vuelve cuando vuelve el punto.
  // bultos de hoja: [x, y, z, radio, semilla]; la mata entera, de 1,1 m de ancho y 0,9 de alto
  const bultos = [[0, 0.5, 0, 0.46, 1.0], [0.36, 0.38, 0.16, 0.34, 2.0], [-0.34, 0.36, -0.18, 0.33, 3.0], [-0.1, 0.4, 0.38, 0.31, 4.0], [0.16, 0.36, -0.38, 0.3, 5.0], [0.12, 0.72, 0.1, 0.26, 6.0], [-0.22, 0.66, -0.04, 0.24, 7.0]];
  const ESC = new THREE.Vector3(1.1, 0.88, 1.1);
  const arbusto = geoLote(L => {
    for (const [x, y, z, r, sem] of bultos) L.add(copa(r, 2, sem), sem % 3 === 0 ? 'hoja' : 'hojaOsc', x, y, z, null, { escala: ESC, copa: 0, brillo: sem % 2 ? 0.8 : 0.9 });
    for (let k = 0; k < 9; k++) { // las cañas que salen arqueadas de la mata
      const a = k * 0.8 + 0.4, h = 0.6 + (k % 3) * 0.15;
      L.add(cil(0.008, 0.015, h, 4), CANA, Math.cos(a) * 0.42, h * 0.45, Math.sin(a) * 0.42, new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-0.8)), { tex: 'corteza', sinSuelo: true });
    }
  }, { rangoSuelo: 0.6 });
  const bayas = geoLote(L => {
    let n = 0;
    for (const [x, y, z, r, sem] of bultos) for (let k = 0; k < 11; k++, n++) {
      // un racimo en la cara de fuera del bulto, de lado y por arriba (no por debajo, que no se ve)
      const a = k * 2.399 + sem, e = -0.05 + (k % 5) * 0.28, d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      const c = new THREE.Vector3(x, y, z).add(d.multiplyScalar(r * 1.03).multiply(ESC));
      const color = n % 6 === 5 ? BAYA_VERDE : n % 2 ? BAYA_ROJA : BAYA_NEGRA;
      for (let b = 0; b < 3; b++) {   // (icosaedros sin subdividir: 20 triángulos cada baya; unos 4600 por mata)
        const ab = b * 2.1 + k, db = b ? 0.036 : 0;
        L.add(new THREE.IcosahedronGeometry(0.032, 0), color, c.x + Math.cos(ab) * db, c.y - b * 0.014, c.z + Math.sin(ab) * db, null, { escala: new THREE.Vector3(1, 1.1, 1), sinSuelo: true, tex: 'liso', brillo: 1.2 });
      }
    }
  }, { rangoSuelo: 0.6 });
  // (P4) setas del bosque: un corro de seis o siete, de sombrero pardo redondeado y pie crema, de 9 a 22 cm (grandes,
  // como las de pie gordo de otoño: si no, entre la hierba no se ven; valravnx, 7 nov: que lo que se recoge se vea)
  const setas = geoLote(L => {
    const E = 1.75, D = 1.7;   // tamaño y separación
    const seta = (x0, z0, h0, r0, inclina, sem) => {
      const x = x0 * D, z = z0 * D, h = h0 * E, r = r0 * E;
      L.add(cil(r * 0.32, r * 0.42, h, 7), SETA_PIE, x, h / 2, z, { x: inclina, y: sem }, { tex: 'liso' });
      const somb = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); somb.scale(1, 0.62, 1);
      L.add(somb, sem % 2 ? SETA : SETA_OSC, x + Math.sin(inclina) * h * 0.5, h, z, { x: inclina, y: sem }, { tex: 'liso', sinSuelo: true, brillo: 1.05 });
      const laminas = new THREE.CircleGeometry(r * 0.97, 12); laminas.rotateX(Math.PI / 2);
      L.add(laminas, SETA_LAMINAS, x + Math.sin(inclina) * h * 0.5, h + 0.002, z, { x: inclina, y: sem }, { tex: 'liso', sinSuelo: true });
    };
    seta(0, 0, 0.12, 0.075, 0.05, 1); seta(0.12, 0.05, 0.09, 0.06, 0.25, 2); seta(-0.09, 0.08, 0.07, 0.05, -0.3, 3); seta(0.03, -0.11, 0.1, 0.065, 0.15, 4); seta(-0.13, -0.07, 0.05, 0.035, -0.2, 5); seta(0.15, -0.1, 0.06, 0.045, 0.3, 6); seta(-0.02, 0.16, 0.08, 0.055, -0.1, 7);
    for (let k = 0; k < 9; k++) L.add(new THREE.IcosahedronGeometry(0.045, 0), 0x6b5a3e, Math.cos(k * 0.7) * 0.28, 0.005, Math.sin(k * 0.7) * 0.28, { y: k }, { escala: new THREE.Vector3(1.4, 0.3, 1), plano: true, tex: 'piedra' }); // hojarasca
  }, { rangoSuelo: 0.12 });

  // (8 nov) la mimbrera: la cepa baja y nudosa de un sauce de mimbre, que se queda (siempre), y el manojo de varas
  // largas, rectas y finas que salen de ella abiertas en abanico (1,6–2,3 m), pardo rojizas abajo y verde oliva arriba,
  // con hojas estrechas y largas en el tercio de arriba; al cortarlas se van las varas
  const cepa = geoLote(L => {
    L.add(cil(0.16, 0.22, 0.32, 9), CEPA, 0, 0.16, 0, null, { tex: 'corteza' });
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; L.add(new THREE.IcosahedronGeometry(0.08, 1), CEPA_OSC, Math.cos(a) * 0.15, 0.3 + (k % 2) * 0.03, Math.sin(a) * 0.15, null, { escala: new THREE.Vector3(1, 0.6, 1), tex: 'corteza', sinSuelo: true }); }   // los muñones de cortas de otros años
    for (let k = 0; k < 5; k++) { const a = k * 1.3; L.add(cil(0.025, 0.045, 0.32, 5), CEPA, Math.cos(a) * 0.22, 0.04, Math.sin(a) * 0.22, new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-1.25)), { tex: 'corteza' }); }   // raíces
  }, { rangoSuelo: 0.4 });
  const hojaSauce = (() => { const g = new THREE.PlaneGeometry(0.018, 0.11); g.translate(0, 0.055, 0); return g; })();
  const varas = geoLote(L => {
    for (let k = 0; k < 26; k++) {
      const a = k * 2.399, d = 0.03 + (k % 5) * 0.025, h = 1.6 + ((k * 7) % 8) * 0.09, abre = 0.12 + (k % 4) * 0.05;
      const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(new THREE.Vector3(Math.cos(a) * (d + abre * h * t * t), 0.3 + t * h, Math.sin(a) * (d + abre * h * t * t))); }
      L.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0075, 4), k % 3 ? VARA_MIMBRE : VARA_MIMBRE_ARR, 0, 0, 0, null, { tex: 'liso', sinSuelo: true });
      for (let n = 0; n < 7; n++) {   // las hojas, en el tercio de arriba, apuntando hacia arriba y afuera
        const t = 0.6 + n * 0.06, p = pts[0].clone().lerp(pts[5], t); p.x = Math.cos(a) * (d + abre * h * t * t); p.z = Math.sin(a) * (d + abre * h * t * t);
        L.add(hojaSauce, n % 2 ? HOJA_SAUCE : HOJA_SAUCE_OSC, p.x, p.y, p.z, new THREE.Matrix4().makeRotationY(-a + n * 1.7).multiply(new THREE.Matrix4().makeRotationX(0.55 + (n % 3) * 0.12)), { sinSuelo: true });
      }
    }
  }, { doble: true, rangoSuelo: 0.3 });

  // (P11, 13 nov) las semillas silvestres. Cada planta se queda (siempre) y se va lo que tiene la semilla, que es lo que
  // se coge: las espigas de la cebada, las vainas de las habas y los tallos en flor (con sus silicuas) de la col y del nabo.
  // Que se distingan bien entre la hierba (valravnx, 7 nov: que lo que se recoge se vea): la cebada, pajiza y alta; las
  // habas, una mata erguida de hoja gris verdosa con flores blancas y vainas verdes que cuelgan por fuera; la col, hojas anchas de verde azulado; el
  // nabo, hojas de verde vivo; las dos, con tallos de flor amarilla.
  const hojaAncha = (largo, ancho) => {   // una hoja ovalada, algo cóncava, que sale del centro hacia fuera (eje +x)
    const s = new THREE.Shape(); s.moveTo(0, 0);
    const pts = [[0.15, 0.32], [0.4, 0.48], [0.7, 0.42], [0.92, 0.2], [1, 0]];
    for (const [x, y] of pts) s.lineTo(x * largo, y * ancho);
    for (const [x, y] of pts.slice(0, -1).reverse()) s.lineTo(x * largo, -y * ancho);
    s.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;   // cóncava y que cae por la punta
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, (z / ancho) ** 2 * ancho * 0.35 - (x / largo) ** 2 * largo * 0.18); }
    g.computeVertexNormals(); return g;
  };
  const roseta = (L, n, largo, ancho, c1, c2, alza, sem) => {   // las hojas de la base, en corro
    for (let k = 0; k < n; k++) {
      const a = k * 2.399 + sem, l = largo * (0.75 + (k % 3) * 0.15), sube = alza * (1 - (k % 4) * 0.18);
      L.add(hojaAncha(l, ancho * (0.85 + (k % 2) * 0.2)), k % 2 ? c1 : c2, 0, 0.03 + (k % 3) * 0.015, 0, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(sube)), { sinSuelo: k > 2 });
    }
  };
  const flores = (L, tallos, alto, colorFlor, colorTallo, colorVaina, sem) => {   // tallos con flores en la punta y silicuas debajo
    for (let k = 0; k < tallos; k++) {
      const a = k * 2.1 + sem, d = 0.03 + (k % 3) * 0.03, h = alto * (0.8 + (k % 3) * 0.12), inc = 0.12 + (k % 2) * 0.1;
      const base = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), punta = new THREE.Vector3(Math.cos(a) * (d + h * inc), h, Math.sin(a) * (d + h * inc));
      const dir = punta.clone().sub(base), l = dir.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      L.add(cil(0.006, 0.01, l, 4), colorTallo, 0, 0, 0, new THREE.Matrix4().compose(base.clone().lerp(punta, 0.5), q, new THREE.Vector3(1, 1, 1)), { sinSuelo: true });
      for (let n = 0; n < 7; n++) {   // las silicuas, finas y largas, por el tercio de arriba
        const t = 0.55 + n * 0.05, p = base.clone().lerp(punta, t), b = n * 2.4 + k;
        L.add(cil(0.0035, 0.0035, 0.07, 3), colorVaina, p.x + Math.cos(b) * 0.025, p.y + 0.02, p.z + Math.sin(b) * 0.025, { x: Math.cos(b) * 0.6, z: Math.sin(b) * 0.6 }, { sinSuelo: true });
      }
      for (let n = 0; n < 9; n++) {   // el ramillete de flores (un puñado de motas amarillas)
        const b = n * 2.399, r = 0.012 + (n % 3) * 0.014;
        L.add(new THREE.IcosahedronGeometry(0.014, 0), colorFlor, punta.x + Math.cos(b) * r, punta.y + 0.005 - (n % 3) * 0.012, punta.z + Math.sin(b) * r, null, { escala: new THREE.Vector3(1, 0.6, 1), sinSuelo: true, tex: 'liso', brillo: 1.25 });
      }
    }
  };
  const CEBADA_TALLO = 0x9c9a5c, CEBADA_TALLO_SECO = 0xb3a46a, CEBADA_ESPIGA = 0xcdb46a, CEBADA_ARISTA = 0xd9c991;
  const HABA_TALLO = 0x6f8f4c, HABA_HOJA = 0x6f8a5c, HABA_HOJA_OSC = 0x5b7549, HABA_FLOR = 0xe9e4d8, HABA_MANCHA = 0x2a2426, HABA_VAINA = 0x66803e, HABA_VAINA_OSC = 0x3e3f26;
  const COL_HOJA = 0x62806a, COL_HOJA_OSC = 0x506c58, NABO_HOJA = 0x5f8a3e, NABO_HOJA_OSC = 0x4d7433, FLOR_AMARILLA = 0xe2c53a, FLOR_AMARILLA_PALIDA = 0xd9cf6a, SILICUA = 0x7d8a46;
  // la cebada silvestre: una mata de cañas finas (0,6–0,9 m), pajizas, con hojas estrechas abajo; las espigas, que es lo
  // que se coge, cabizbajas y con sus aristas largas
  const cebadaCanas = [];
  for (let k = 0; k < 22; k++) { const a = k * 2.399, d = 0.02 + (k % 6) * 0.035, h = 0.6 + ((k * 7) % 7) * 0.05, dobla = 0.08 + (k % 4) * 0.05; cebadaCanas.push({ a, d, h, dobla }); }
  const cebadaPlanta = geoLote(L => {
    for (const [k, c] of cebadaCanas.entries()) {
      const g = new THREE.CylinderGeometry(0.0035, 0.006, c.h, 3, 4); g.translate(0, c.h / 2, 0);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), f = (y / c.h) ** 2 * c.dobla * c.h; p.setX(i, p.getX(i) + f); }
      L.add(g, k % 3 ? CEBADA_TALLO : CEBADA_TALLO_SECO, Math.cos(c.a) * c.d, 0, Math.sin(c.a) * c.d, { y: -c.a }, { brillo: 1.05 });
      if (k % 2 === 0) { const hj = new THREE.ConeGeometry(0.01, 0.3, 3, 3); hj.translate(0, 0.15, 0); L.add(hj, 'hierba', Math.cos(c.a) * c.d, 0.02, Math.sin(c.a) * c.d, { y: -c.a + 1, z: -0.45 }, { brillo: 0.95 }); }
    }
  }, { doble: true, rangoSuelo: 0.3 });
  const cebadaEspigas = geoLote(L => {
    for (const c of cebadaCanas) {
      // la punta de la caña (doblada hacia +x local, girada -a): la espiga cuelga de ella, cabizbaja
      const m0 = new THREE.Matrix4().makeRotationY(-c.a), punta = new THREE.Vector3(c.dobla * c.h, c.h, 0).applyMatrix4(m0).add(new THREE.Vector3(Math.cos(c.a) * c.d, 0, Math.sin(c.a) * c.d));
      const m = m0.clone().multiply(new THREE.Matrix4().makeRotationZ(-0.6 - c.dobla * 2.5));
      const esp = new THREE.CylinderGeometry(0.009, 0.006, 0.09, 5, 1); esp.translate(0, 0.045, 0);
      L.add(esp, CEBADA_ESPIGA, punta.x, punta.y - 0.01, punta.z, m, { sinSuelo: true, tex: 'paja', brillo: 1.1 });
      for (let n = 0; n < 4; n++) {   // las aristas, largas y finas, que salen de la espiga
        const ar = new THREE.CylinderGeometry(0.0012, 0.0012, 0.1, 3); ar.translate(0, 0.05, 0);
        L.add(ar, CEBADA_ARISTA, punta.x, punta.y + 0.02 + n * 0.012, punta.z, m.clone().multiply(new THREE.Matrix4().makeRotationX(n % 2 ? 0.25 : -0.25)), { sinSuelo: true, brillo: 1.1 });
      }
    }
  }, { doble: true, rangoSuelo: 0.3 });
  // las habas silvestres: una mata erguida (unos 0,6 m) de tallos recios, hojas ovaladas gris verdosas, flores blancas
  // con su mancha oscura y, lo que se coge, las vainas gruesas que cuelgan, verde oscuro y alguna ya negra
  const habasTallos = [];
  for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.3, d = 0.04 + (k % 3) * 0.05, h = 0.55 + (k % 3) * 0.1; habasTallos.push({ a, d, h }); }
  const habasPlanta = geoLote(L => {
    for (const { a, d, h } of habasTallos) {
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      L.add(cil(0.008, 0.012, h, 4), HABA_TALLO, x, h / 2, z);
      for (let n = 0; n < 6; n++) {
        const y = h * (0.12 + n * 0.15), b = a + n * 1.9;
        for (const lado of [0, Math.PI]) L.add(hojaAncha(0.12 - n * 0.008, 0.05), n % 2 ? HABA_HOJA : HABA_HOJA_OSC, x, y, z, new THREE.Matrix4().makeRotationY(b + lado).multiply(new THREE.Matrix4().makeRotationZ(0.35)), { sinSuelo: true });
        if (n >= 2 && n % 2 === 0) { // las flores, junto a la hoja
          L.add(new THREE.IcosahedronGeometry(0.012, 0), HABA_FLOR, x + Math.cos(b) * 0.025, y + 0.012, z - Math.sin(b) * 0.025, null, { escala: new THREE.Vector3(1.3, 0.8, 1), sinSuelo: true, tex: 'liso', brillo: 1.15 });
          L.add(new THREE.IcosahedronGeometry(0.005, 0), HABA_MANCHA, x + Math.cos(b) * 0.036, y + 0.014, z - Math.sin(b) * 0.036, null, { sinSuelo: true, tex: 'liso' });
        }
      }
    }
  }, { doble: true, rangoSuelo: 0.25 });
  const habasVainas = geoLote(L => {
    for (const [k, { a, d, h }] of habasTallos.entries()) for (let n = 0; n < 4; n++) {   // por fuera de las hojas, para que se vean (y se note al cogerlas)
      const y = h * (0.3 + n * 0.15), b = a + n * 1.6 + 0.8, x = Math.cos(a) * d + Math.cos(b) * 0.07, z = Math.sin(a) * d + Math.sin(b) * 0.07;
      const v = new THREE.CapsuleGeometry(0.017, 0.1, 2, 6); v.translate(0, -0.045, 0);
      L.add(v, (k + n) % 4 === 0 ? HABA_VAINA_OSC : HABA_VAINA, x, y, z, { y: -b, z: 0.35 }, { escala: new THREE.Vector3(1.25, 1, 0.9), sinSuelo: true, tex: 'liso', brillo: 1.05 });
    }
  }, { rangoSuelo: 0.25 });
  // la col silvestre: un corro de hojas anchas, carnosas y azuladas, que se queda; lo que se coge, los tallos en flor
  // (0,7–0,9 m) con sus silicuas llenas de semilla
  const colPlanta = geoLote(L => { roseta(L, 9, 0.3, 0.12, COL_HOJA, COL_HOJA_OSC, 0.5, 0.4); roseta(L, 6, 0.18, 0.09, COL_HOJA_OSC, COL_HOJA, 0.95, 1.3); }, { doble: true, rangoSuelo: 0.15 });
  const colFlor = geoLote(L => flores(L, 4, 0.8, FLOR_AMARILLA_PALIDA, 0x6f8a52, SILICUA, 0.2), { rangoSuelo: 0.3 });
  // el nabo silvestre: hojas de verde vivo en corro bajo; los tallos en flor, más y de amarillo más vivo (0,5–0,7 m)
  const naboPlanta = geoLote(L => { roseta(L, 13, 0.3, 0.085, NABO_HOJA, NABO_HOJA_OSC, 0.55, 0.9); }, { doble: true, rangoSuelo: 0.15 });
  const naboFlor = geoLote(L => flores(L, 6, 0.6, FLOR_AMARILLA, 0x6f8a52, SILICUA, 1.1), { rangoSuelo: 0.3 });

  // peña de caliza del afloramiento (decorado, no se recoge)
  const pena = geoLote(L => L.add(new THREE.IcosahedronGeometry(1, 1), CALIZA_COLOR, 0, 0.35, 0, null, { escala: new THREE.Vector3(1.4, 0.8, 1.05), plano: true, tex: 'piedra' }), { rangoSuelo: 0.8 });
  // (11 nov) las plantas de Meshy, si han llegado (src/mundo/naturaleza_meshy.js): ortigas, juncos, la hierba larga (con sus
  // espigas) y el arbusto de las bayas, con las bayas puestas por su cara de fuera
  const M = (n) => { const m = naturaleza(n); return m ? [{ geo: m.cerca.geo, mat: m.cerca.mats }] : null; };
  const arbustoM = naturaleza('arbusto_bayas'), bayasM = arbustoM ? bayasSobre(arbustoM.cerca.geo) : null;
  // el arbusto queda siempre (siempre: true); lo demás se va al recogerlo
  return (cache = { ramas, piedra, silex, ortiga: M('ortigas') || ortiga, hierba_larga: M('hierba_larga') || hierbaLarga, juncos: M('juncos') || juncos, barro, yesquero, pena,
    bayas: [...(M('arbusto_bayas') || arbusto).map(m => ({ ...m, siempre: true })), ...(bayasM || bayas)], setas, mimbre: [...cepa.map(m => ({ ...m, siempre: true })), ...varas],
    cebada_silvestre: [...cebadaPlanta.map(m => ({ ...m, siempre: true })), ...cebadaEspigas], habas_silvestres: [...habasPlanta.map(m => ({ ...m, siempre: true })), ...habasVainas],
    col_silvestre: [...colPlanta.map(m => ({ ...m, siempre: true })), ...colFlor], nabo_silvestre: [...naboPlanta.map(m => ({ ...m, siempre: true })), ...naboFlor] });
}

// Las bayas sobre el arbusto de Meshy: racimos de tres en la cara de fuera de la mata (lo que mira hacia fuera y no
// hacia abajo, en el tercio de fuera y de la mitad para arriba), siempre los mismos sitios (cada n triángulos)
function bayasSobre(geo) {
  const pos = geo.attributes.position, idx = geo.index, nt = (idx ? idx.count : pos.count) / 3;
  let R = 0, H = 0; for (let i = 0; i < pos.count; i++) { R = Math.max(R, Math.hypot(pos.getX(i), pos.getZ(i))); H = Math.max(H, pos.getY(i)); }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), sitios = [];
  const v = (k, t) => t.fromBufferAttribute(pos, idx ? idx.getX(k) : k);
  for (let t = 0; t < nt; t++) {
    v(3 * t, a); v(3 * t + 1, b); v(3 * t + 2, c);
    m.copy(a).add(b).add(c).divideScalar(3);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const radial = Math.hypot(m.x, m.z), hacia = (n.x * m.x + n.z * m.z) / (radial || 1);
    if (m.y > H * 0.35 && radial > R * 0.55 && n.y > -0.15 && (hacia > 0.3 || n.y > 0.6)) sitios.push([m.clone(), n.clone()]);
  }
  const quiero = 50, paso = Math.max(1, Math.floor(sitios.length / quiero));
  return geoLote(L => {
    for (let k = 0, q = 0; k < sitios.length && q < quiero; k += paso, q++) {
      const [p, nn] = sitios[k], color = q % 6 === 5 ? BAYA_VERDE : q % 2 ? BAYA_ROJA : BAYA_NEGRA, c0 = p.clone().addScaledVector(nn, 0.02);
      for (let j = 0; j < 3; j++) {
        const ab = j * 2.1 + q, db = j ? 0.026 : 0;
        L.add(new THREE.IcosahedronGeometry(0.022, 0), color, c0.x + Math.cos(ab) * db, c0.y - j * 0.014, c0.z + Math.sin(ab) * db, null, { escala: new THREE.Vector3(1, 1.1, 1), sinSuelo: true, tex: 'liso', brillo: 1.2 });
      }
    }
  }, { rangoSuelo: 0.6 });
}

const CERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Crea los puntos de recogida de la demo y sus mallas. altura(x, z): el terreno. obstaculos: troncos y rocas (para no
// ponerlos dentro) — las peñas del afloramiento se añaden a la lista. almacen: localStorage (o null).
export function crearRecoleccion({ raiz, altura, obstaculos, almacen, semilla = 11 }) {
  const libre = (x, z) => !obstaculos.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + 0.4) ** 2) && Math.hypot(x, z - 4) > 2.5;
  // peñas de caliza (antes de repartir, para no poner nada dentro)
  const penas = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3 + 0.4, d = (i % 3 + 0.5) * CALIZA.r * 0.3, x = CALIZA.x + Math.cos(a) * d, z = CALIZA.z + Math.sin(a) * d, s = 0.5 + (i * 37 % 10) / 14;
    penas.push([x, z, s, a]); obstaculos.push({ x, z, r: s * 1.2 });
  }
  const puntos = [
    ...repartirPuntos({ semilla, cuantos: { ramas: 30, piedra: 14, ortiga: 10, hierba_larga: 12 }, zonas: zonasDemo, radio: 100, libre }),
    ...repartirPuntos({ semilla, cuantos: { silex: 8, piedra: 0 }, zonas: zonasDemo, radio: CALIZA.r, cx: CALIZA.x, cz: CALIZA.z, libre }),
  ];
  const rec = new Recoleccion(puntos);
  if (almacen) cargarRecoleccion(almacen, rec);
  const grupo = new THREE.Group(); grupo.name = 'recoleccion'; raiz.add(grupo);
  const mods = modelosRecoleccion(), o = new THREE.Object3D();
  // las peñas
  for (const { geo, mat } of mods.pena) {
    const im = new THREE.InstancedMesh(geo, mat, penas.length);
    penas.forEach(([x, z, s, a], i) => { o.position.set(x, altura(x, z) - 0.15 * s, z); o.rotation.set(0, a, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = im.receiveShadow = true; im.name = 'caliza'; grupo.add(im);
  }
  // una malla instanciada por tipo y textura; cada punto, su ejemplar
  const mallas = [];
  for (const tipo of Object.keys(RECOLECTABLES)) {
    const lista = puntos.filter(p => p.tipo === tipo); if (!lista.length) continue;
    for (const { geo, mat, siempre } of mods[tipo] || []) {   // (el matorral no tiene: lo dibuja la vegetación)
      const im = new THREE.InstancedMesh(geo, mat, lista.length), matrices = [];
      lista.forEach((p, i) => { o.position.set(p.x, altura(p.x, p.z) - 0.01, p.z); o.rotation.set(0, p.giro, 0); o.scale.setScalar(0.9 + (i % 4) * 0.08); o.updateMatrix(); matrices.push(o.matrix.clone()); im.setMatrixAt(i, o.matrix); });
      im.castShadow = tipo !== 'hierba_larga' && tipo !== 'barro'; im.receiveShadow = true; im.name = 'recoger_' + tipo + (siempre ? '_planta' : ''); grupo.add(im);
      mallas.push({ im, lista, matrices, siempre });
    }
  }
  let ocupado = () => false;
  const visible = (p, ahora, siempre) => (siempre ? rec.enPie(p.id, ahora) : rec.disponible(p.id, ahora)) && !ocupado(p.x, p.z);
  function refrescar(ahora = Date.now()) {
    for (const { im, lista, matrices, siempre } of mallas) {
      lista.forEach((p, i) => im.setMatrixAt(i, visible(p, ahora, siempre) ? matrices[i] : CERO));
      im.instanceMatrix.needsUpdate = true;
    }
  }
  refrescar();
  // vuelve a salir lo que toca (por tiempo transcurrido): se mira cada pocos segundos
  let ultimo = 0;
  return {
    rec, puntos, grupo,
    paso() { const t = Date.now(); if (t - ultimo > 5000) { ultimo = t; refrescar(t); } },
    // donde se construye no se recoge (queda debajo): ocupado(x, z) como el del decorado
    despejar(fn) { ocupado = fn; refrescar(); },
    // el punto disponible más cercano a (x, z) a menos de dist m
    cercano(x, z, dist = 1.6, ahora = Date.now()) { return rec.cercanos(x, z, ahora, dist).find(p => !ocupado(p.x, p.z)) || null; },
    // todos los disponibles a menos de dist m, del más cercano al más lejano (para el menú de Usar)
    cercanos(x, z, dist = 1.6, ahora = Date.now()) { return rec.cercanos(x, z, ahora, dist).filter(p => !ocupado(p.x, p.z)); },
    // recoger con autor; lo guarda en el navegador y esconde el punto
    recoger(invs, registro, autor, punto, x, z, ahora = Date.now()) {
      const r = ejecutarRecoleccion(rec, invs, registro, { autor, tipo: 'recoger', punto, x, z }, ahora);
      if (r.ok) { if (almacen) guardarRecoleccion(almacen, rec); refrescar(ahora); }
      return r;
    },
    refrescar,
    importar(datos) { rec.importar(datos); refrescar(); },
  };
}

// ---------------- En el mundo de verdad ----------------
// Los puntos salen por trozos de 32 m del mundo (recogidaTrozo, siempre los mismos en cada sitio) en un cuadro de
// RADIO m alrededor del jugador, unos pocos ms en cada fotograma; los de lejos se sueltan (lo recogido de ellos se
// guarda igual, y vuelve con ellos). Decisión provisional (31 oct): 64 m (48 m en el móvil), lo que se distingue en
// el suelo con la niebla del juego.
const movil = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 700;
export const RADIO_RECOGIDA = movil ? 48 : 64;
const MS_FOTOGRAMA = 3, PASO_REHACER = 8;
export const CLAVE_RECOLECCION_MUNDO = 'kinhold.recoleccion.mundo';

// mundoJ: el mundo del juego (src/mundo/mundo_juego.js). altura(x, z): el suelo de la escena. obstaculos: los de lo que
// crece (las rocas y las matas: lo que se recoge no sale dentro; los árboles ya los aparta la lógica).
export function crearRecoleccionMundo({ raiz, mundoJ, semilla, altura, obstaculos, almacen, radio = RADIO_RECOGIDA }) {
  const O = mundoJ.salida, pai = mundoJ.paisaje, altW = alturaMundo(pai), L = LADO_RECOGIDA;
  const rec = new Recoleccion([]);
  if (almacen) cargarRecoleccion(almacen, rec, CLAVE_RECOLECCION_MUNDO, { todo: true });
  const grupo = new THREE.Group(); grupo.name = 'recoleccion'; raiz.add(grupo);
  const mods = modelosRecoleccion(), o = new THREE.Object3D();
  const trozos = new Map(), clave = (i, j) => i + ',' + j;   // clave → los ids de sus puntos
  let mallas = [], ocupado = () => false, centro = null, cambio = false, ultimo = 0;
  const cuenta = { trozos: 0, puntos: 0, pendientes: 0, msMax: 0 };
  const tapado = (p) => obstaculos.some(q => !q.arbol && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < (q.r + 0.3) ** 2);
  // (siempre: lo que queda aunque se haya recogido, como el arbusto de las bayas, mientras no se desbroce)
  const visible = (p, ahora, siempre) => (siempre ? rec.enPie(p.id, ahora) : rec.disponible(p.id, ahora)) && !ocupado(p.x, p.z) && !p.tapado;

  function hacer(i, j) {
    const lista = recogidaTrozo(pai, altW, semilla, i, j).map(p => ({ id: p.id, tipo: p.tipo, x: Math.round((p.x - O.x) * 100) / 100, z: Math.round((p.z - O.z) * 100) / 100, giro: p.giro, zonas: p.zonas }));
    rec.anadir(lista); trozos.set(clave(i, j), lista.map(p => p.id)); cambio = true;
  }
  // los trozos que faltan en el cuadro alrededor de P (escena), los más cercanos primero, y los de lejos se sueltan
  function faltan(P) {
    const X = P.x + O.x, Z = P.z + O.z, r = [];
    for (let j = Math.floor((Z - radio) / L); j <= Math.floor((Z + radio) / L); j++) for (let i = Math.floor((X - radio) / L); i <= Math.floor((X + radio) / L); i++)
      if (!trozos.has(clave(i, j))) r.push({ i, j, d: Math.hypot((i + 0.5) * L - X, (j + 0.5) * L - Z) });
    return r.sort((a, b) => a.d - b.d);
  }
  function soltar(P) {
    const X = P.x + O.x, Z = P.z + O.z;
    for (const [k, ids] of trozos) {
      const [i, j] = k.split(',').map(Number);
      if (Math.max(Math.abs((i + 0.5) * L - X), Math.abs((j + 0.5) * L - Z)) > radio + 2 * L) { trozos.delete(k); rec.quitar(ids); cambio = true; }
    }
  }
  // las mallas, de nuevo: una instanciada por tipo y textura; cada punto, su ejemplar
  function poner() {
    for (const { im } of mallas) { grupo.remove(im); im.dispose(); }
    mallas = [];
    for (const p of rec.puntos) { p.tapado = tapado(p); p.y = altura(p.x, p.z); }
    for (const tipo of Object.keys(RECOLECTABLES)) {
      const lista = rec.puntos.filter(p => p.tipo === tipo); if (!lista.length) continue;
      for (const { geo, mat, siempre } of mods[tipo] || []) {   // (el matorral no tiene: lo dibuja la vegetación)
        const im = new THREE.InstancedMesh(geo, mat, lista.length), matrices = [];
        lista.forEach((p, i) => { o.position.set(p.x, p.y - 0.01, p.z); o.rotation.set(0, p.giro, 0); o.scale.setScalar(0.9 + (i % 4) * 0.08); o.updateMatrix(); matrices.push(o.matrix.clone()); im.setMatrixAt(i, o.matrix); });
        im.castShadow = tipo !== 'hierba_larga' && tipo !== 'barro'; im.receiveShadow = true; im.name = 'recoger_' + tipo + (siempre ? '_planta' : ''); im.frustumCulled = false; grupo.add(im);
        mallas.push({ im, lista, matrices, siempre });
      }
    }
    cuenta.trozos = trozos.size; cuenta.puntos = rec.puntos.length;
    refrescar();
  }
  function refrescar(ahora = Date.now()) {
    for (const { im, lista, matrices, siempre } of mallas) {
      lista.forEach((p, i) => im.setMatrixAt(i, visible(p, ahora, siempre) ? matrices[i] : CERO));
      im.instanceMatrix.needsUpdate = true;
    }
  }
  // cada fotograma: unos pocos trozos (como mucho MS_FOTOGRAMA ms) y, si ha cambiado algo, las mallas. Devuelve los ms.
  function paso(P) {
    const t0 = performance.now(), t = Date.now();
    if (P && (!centro || Math.hypot(P.x - centro.x, P.z - centro.z) > PASO_REHACER || cuenta.pendientes)) {
      const lista = faltan(P);
      let n = 0;
      while (n < lista.length && (n === 0 || performance.now() - t0 < MS_FOTOGRAMA)) { hacer(lista[n].i, lista[n].j); n++; }
      cuenta.pendientes = lista.length - n;
      if (!cuenta.pendientes) { soltar(P); centro = { x: P.x, z: P.z }; }
    }
    if (cambio) { cambio = false; poner(); }
    else if (t - ultimo > 5000) { ultimo = t; refrescar(t); }   // vuelve a salir lo que toca
    const ms = performance.now() - t0; cuenta.msMax = Math.max(cuenta.msMax, ms);
    return ms;
  }
  const cercanos = (x, z, dist = 1.6, ahora = Date.now()) => rec.cercanos(x, z, ahora, dist).filter(p => !ocupado(p.x, p.z) && !p.tapado);
  return {
    rec, grupo, cuenta, paso, refrescar,
    get puntos() { return rec.puntos; },
    get listo() { return !!centro && !cuenta.pendientes; },
    // donde se construye no se recoge (queda debajo), y las alturas de nuevo (el suelo nivelado)
    despejar(fn) { ocupado = fn; cambio = true; },
    cercano(x, z, dist = 1.6, ahora = Date.now()) { return cercanos(x, z, dist, ahora)[0] || null; },
    cercanos,
    // lo recogido que manda el servidor (de todos los puntos, estén o no cerca). Devuelve si ha cambiado lo desbrozado
    // de algún matorral (entonces la vegetación tiene que rehacer sus matas)
    importar(datos) {
      // (y las rocas rotas con el mazo, 8 nov: lo que dibuja también la vegetación; sus golpes a medias no cuentan)
      const matas = () => JSON.stringify(Object.entries(rec.estado).filter(([k, e]) => k.startsWith('matorral:') || (k.startsWith('roca:') && e.quitado)));
      const antes = matas(); rec.importar(datos, { todo: true }); refrescar();
      return matas() !== antes;
    },
    // Desbrozar (8 nov): los arbustos de bayas en pie a menos de dist m; y si un matorral (por su nombre) sigue en pie
    arbustosCerca(x, z, dist = 1.6, ahora = Date.now()) {
      return rec.puntos.filter(p => p.tipo === 'bayas' && rec.enPie(p.id, ahora) && !ocupado(p.x, p.z) && !p.tapado && Math.hypot(p.x - x, p.z - z) <= dist)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    },
    mataEnPie: (id, ahora = Date.now()) => rec.enPie(id, ahora),
    // Romper rocas (8 nov): si una roca (por su nombre) sigue en pie, lo que lleva dado, y sin servidor (las pruebas), un
    // golpe de mazo aquí, con sus piedras al suelo de la página; la roca se da a conocer
    rocaEnPie: (id, ahora = Date.now()) => rec.enPie(id, ahora),
    progresoRoca: (id) => rec.progresoRoca(id),
    romper(invs, registro, autor, roca, x, z, suelo, ahora = Date.now()) {
      rec.anadir([{ id: roca.id, tipo: 'roca', x: roca.x, z: roca.z, tam: roca.tam }]);
      const r = ejecutarRecoleccion(rec, invs, registro, { autor, tipo: 'romper', punto: roca.id, x, z }, ahora, suelo);
      if (r.ok && almacen) guardarRecoleccion(almacen, rec, CLAVE_RECOLECCION_MUNDO);
      return r;
    },
    // sin servidor (las pruebas): desbrozar aquí, con lo cortado al suelo de la página; el matorral se da a conocer
    desbrozar(invs, registro, autor, punto, x, z, suelo, ahora = Date.now()) {
      if (punto.tipo === 'matorral') rec.anadir([{ id: punto.id, tipo: 'matorral', x: punto.x, z: punto.z }]);
      const r = ejecutarRecoleccion(rec, invs, registro, { autor, tipo: 'desbrozar', punto: punto.id, x, z }, ahora, suelo);
      if (r.ok) { if (almacen) guardarRecoleccion(almacen, rec, CLAVE_RECOLECCION_MUNDO); refrescar(ahora); }
      return r;
    },
    recoger(invs, registro, autor, punto, x, z, ahora = Date.now()) {
      const r = ejecutarRecoleccion(rec, invs, registro, { autor, tipo: 'recoger', punto, x, z }, ahora);
      if (r.ok) { if (almacen) guardarRecoleccion(almacen, rec, CLAVE_RECOLECCION_MUNDO); refrescar(ahora); }
      return r;
    },
  };
}
