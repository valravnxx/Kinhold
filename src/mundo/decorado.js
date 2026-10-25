// Kinhold — decorado común del mundo (estilo v5, «realismo en miniatura»): suelo que sigue hasta
// el horizonte, bosque instanciado (pinos y árboles de copa) y hierba con flores.
// Lo usan la construcción, el combate, la prueba de estilo y el visor de personaje: cada mejora llega a todos.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETA, Lote, material, materialTex } from './estilos.js';

export function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const cil = (r1, r2, h, lados, abierto = false) => new THREE.CylinderGeometry(r1, r2, h, lados, 1, abierto);

// Copa de árbol: esfera con bultos (racimos), mismo desplazamiento en vértices repetidos para no abrir grietas
export function copa(radio, detalle, semilla) {
  let g = new THREE.IcosahedronGeometry(radio, detalle); g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g); // vértices compartidos: sombreado suave, no facetado
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const b = 1 + 0.13 * Math.sin(v.x * 5.3 + semilla) * Math.sin(v.y * 4.1 + semilla * 2) + 0.08 * Math.sin(v.z * 7.7 + v.x * 3 + semilla);
    v.multiplyScalar(radio * b * (v.y < -0.3 ? 0.88 : 1)); // un poco plana por debajo
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
// Piso de pino: cono con el borde de abajo en puntas caídas (ramas), no un cono liso
export function pisoPino(radio, alto, lados, semilla) {
  const g = new THREE.ConeGeometry(radio, alto, lados, 2, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -alto / 2 + 1e-3) { // anillo de abajo
      const a = Math.atan2(z, x), j = Math.round((a / (2 * Math.PI)) * lados * 2), punta = j % 2 === 0;
      const f = punta ? 1.12 : 0.82;
      p.setXYZ(i, x * f, y + (punta ? -0.12 * alto : 0.06 * alto) + Math.sin(a * 3 + semilla) * 0.04 * alto, z * f);
    }
  }
  g.computeVertexNormals(); return g;
}

// Altura del terreno: llano hasta «llano» metros del centro y lomas suaves más allá
// (la construcción y el combate trabajan sobre el llano, a altura 0).
export function alturaTerreno(llano = 12) {
  return (x, z) => {
    const d = Math.hypot(x, z); if (d < llano) return 0;
    const f = Math.min(1, (d - llano) / 14);
    return f * (Math.sin(x * 0.07) * Math.cos(z * 0.06) * 2.2 + Math.sin((x + z) * 0.03) * 1.6 + 0.6);
  };
}

// ---------- Suelo: sigue hasta el horizonte (el mundo no está recortado) ----------
// Anillos concéntricos cada vez más separados: detalle cerca, poco lejos. Color en vértices
// (hierba, claros y sombras de contacto) y textura de suelo repetida.
// opc: llano, cerca (radio con detalle fino), lejos (radio total), sombras [[x, z, radio, fuerza]],
// tinte(x, z, color) → oscurecimiento propio de cada sitio (caminos, tierra pisada…).
export function suelo({ llano = 12, cerca = 15, lejos = 90, anillos = 30, lados = 64, sombras = [], tinte = null, relieve = true } = {}) {
  const H = new THREE.Color(PALETA.hierba), C = new THREE.Color(PALETA.hierbaClara);
  const pos = [], col = [], uv = [], idx = [], k = new THREE.Color();
  const altura = alturaTerreno(llano);
  const radio = (i) => { const t = i / anillos; return t < 0.6 ? t / 0.6 * cerca : cerca + Math.pow((t - 0.6) / 0.4, 1.6) * (lejos - cerca); };
  const punto = (x, z) => { pos.push(x, altura(x, z), z); col.push(...colorSuelo(x, z)); uv.push(x * 0.5, z * 0.5); };
  punto(0, 0);
  for (let i = 1; i <= anillos; i++) for (let j = 0; j < lados; j++) { const a = j / lados * Math.PI * 2, rr = radio(i); punto(Math.cos(a) * rr, Math.sin(a) * rr); }
  const id = (i, j) => (i === 0 ? 0 : 1 + (i - 1) * lados + (j % lados));
  for (let j = 0; j < lados; j++) idx.push(0, id(1, j + 1), id(1, j));
  for (let i = 1; i < anillos; i++) for (let j = 0; j < lados; j++) { const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j), d = id(i + 1, j + 1); idx.push(a, b, d, a, d, c); }
  function colorSuelo(x, z) {
    const m = Math.sin(x * 0.45 + 1) * Math.cos(z * 0.4) * 0.5 + 0.5, m2 = Math.sin(x * 0.11 - 2) * Math.sin(z * 0.13 + 1) * 0.5 + 0.5;
    k.copy(H).lerp(C, m * 0.45 + m2 * 0.2);
    let o = tinte ? tinte(x, z, k) : 1;
    for (const [sx, sz, sr, f] of sombras) { const dd = Math.hypot(x - sx, z - sz); if (dd < sr) o *= 1 - f * (1 - dd / sr) ** 2; }
    o *= 1.1; // la textura oscurece un poco
    return [k.r * o, k.g * o, k.b * o];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, materialTex('suelo', { relieve })); m.receiveShadow = true; m.name = 'suelo';
  return m;
}

// ---------- Bosque: dos tipos de árbol instanciados (pocas llamadas de dibujo aunque sean cientos) ----------
// opc: n (intentos), desde/hasta (anillo en metros), reparto (exponente: <1 más cerca del borde de dentro),
// libre(x, z, d) para dejar huecos, llano (altura del terreno), sombra (si los árboles echan sombra).
// Devuelve los troncos como obstáculos [{x, z, r}] para chocar con ellos.
export function bosque(raiz, r, { n = 36, desde = 15, hasta = 60, reparto = 0.8, libre = null, llano = 12, sombra = false } = {}) {
  const hacer = (fn) => {
    const L = new Lote({ rangoSuelo: 2.5 }); fn(L);
    const grupos = L.cerrar(null, true), tipos = Object.keys(grupos);
    const geo = mergeGeometries(tipos.map(t => mergeGeometries(grupos[t])), true);
    return { geo, mats: tipos.map(t => materialTex(t)) };
  };
  const pino = hacer((L) => {
    L.add(cil(0.12, 0.24, 2.2, 6), 'corteza', 0, 1.1, 0);
    [[1.7, 2.1, 1.8], [1.35, 1.9, 2.9], [0.95, 1.7, 3.9], [0.55, 1.4, 4.8]].forEach(([rad, h, y], i) => L.add(pisoPino(rad, h, 8, i), i % 2 ? 'pinoOsc' : 'pino', 0, y, 0, { y: i }, { copa: 0 }));
  });
  const frond = hacer((L) => {
    L.add(cil(0.16, 0.26, 2.6, 6), 'corteza', 0, 1.3, 0);
    [[0, 3.4, 0, 1.4], [0.9, 2.9, 0.3, 1.0], [-0.9, 3.0, -0.2, 1.05], [0.1, 2.9, -0.9, 0.95]].forEach(([x, y, z, s], i) => L.add(copa(s, 1, i), ['hoja', 'hojaOsc', 'hojaClara'][i % 3], x, y, z, { x: i, y: i * 2 }, { copa: 2 }));
  });
  const altura = alturaTerreno(llano);
  const sitios = { p: [], f: [] }, obstaculos = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = desde + Math.pow(r(), reparto) * (hasta - desde);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (libre && !libre(x, z, d)) continue;
    const s = 0.8 + r() * 0.7;
    (i % 3 === 0 ? sitios.f : sitios.p).push([x, z, s, r() * 6, 0.85 + r() * 0.3]);
    obstaculos.push({ x, z, r: (i % 3 === 0 ? 0.26 : 0.24) * s + 0.1 });
  }
  for (const [mod, lista] of [[pino, sitios.p], [frond, sitios.f]]) {
    if (!lista.length) continue;
    const im = new THREE.InstancedMesh(mod.geo, mod.mats, lista.length), o = new THREE.Object3D(), c = new THREE.Color();
    lista.forEach(([x, z, s, g, t], i) => {
      o.position.set(x, altura(x, z) - 0.1, z); o.rotation.set(0, g, 0); o.scale.setScalar(s); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.setScalar(t));
    });
    im.receiveShadow = true; im.castShadow = sombra; im.name = 'bosque'; raiz.add(im);
  }
  return obstaculos;
}

// ---------- Hierba y flores instanciadas ----------
// opc: hierba y flores (cuántas), radio (hasta dónde), desde (radio libre en el centro), libre(x, z).
export function plantas(raiz, r, { hierba = 170, flores = 70, radio = 11.5, desde = 0, libre = null } = {}) {
  const sitios = (n) => {
    const lista = []; let t = 0;
    while (lista.length < n && t++ < n * 10) {
      const a = r() * 7, d = desde + Math.sqrt(r()) * (radio - desde);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!libre || libre(x, z)) lista.push([x, z]);
    }
    return lista;
  };
  const mata = (() => { const L = new Lote({ rangoSuelo: 0.3, variacion: 0 }); for (let k = 0; k < 3; k++) { const g = new THREE.ConeGeometry(0.03, 0.26, 3); g.translate(0, 0.13, 0); L.add(g, k % 2 ? 'hierbaClara' : 'hierba', 0, 0, 0, { y: k * 2.1, z: (k - 1) * 0.3 }, { brillo: 1.1 }); } return mergeGeometries(L.cerrar()); })();
  const flor = (() => { const L = new Lote({ variacion: 0, rangoSuelo: 0.01 }); L.add(cil(0.006, 0.006, 0.2, 3), 'hierba', 0, 0.1, 0, null, { sinSuelo: true }); L.add(new THREE.IcosahedronGeometry(0.035, 0), 0xffffff, 0, 0.21, 0, null, { sinSuelo: true }); return mergeGeometries(L.cerrar()); })();
  const poner = (geo, lista, color, mat, nombre) => {
    const im = new THREE.InstancedMesh(geo, mat, lista.length), o = new THREE.Object3D(), c = new THREE.Color();
    lista.forEach(([x, z], i) => {
      o.position.set(x, 0, z); o.rotation.set(0, r() * 6, 0); o.scale.setScalar(0.7 + r() * 0.8); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, color(c));
    });
    im.receiveShadow = true; im.name = nombre; raiz.add(im);
  };
  poner(mata, sitios(hierba), (c) => c.setScalar(0.85 + r() * 0.3), material('doble'), 'hierba');
  // flores de colores apagados (blanco roto, amarillo pálido, malva)
  const FLORES = [0xe8e2d0, 0xd9c27a, 0xa98aa6];
  poner(flor, sitios(flores), (c) => c.set(FLORES[Math.floor(r() * 3)]), material('fijo'), 'flores');
}

// ---------- Mundo abierto para jugar (construcción, combate) ----------
// Llano grande con suelo, bosque, hierba y rocas del estilo v5. «claro(x, z)» dice dónde puede haber hierba.
// El suelo va sin relieve (bumpMap) salvo relieveSuelo: es lo que más cuesta dibujar y a la distancia de juego no se ve.
// Devuelve { raiz, obstaculos, altura }.
export function crearDecorado({ semilla = 7, llano = 40, lejos = 220, arboles = 160, bosqueDesde = 28, bosqueHasta = 160,
  hierba = 900, flores = 260, hierbaDesde = 0, hierbaHasta = 40, claro = null, tierra = null, sombraArboles = false, rocas = 24, relieveSuelo = false } = {}) {
  const raiz = new THREE.Group(); raiz.name = 'decorado';
  const r = azar(semilla);
  const T = new THREE.Color(PALETA.tierra);
  // tierra pisada en el centro (por ejemplo, la liza del duelo)
  const tinte = tierra ? (x, z, k) => { const d = Math.hypot(x, z); const f = d < tierra ? 0.55 : d < tierra + 2 ? 0.55 * (tierra + 2 - d) / 2 : 0; k.lerp(T, f); return 1; } : null;
  const obstaculos = bosque(raiz, r, { n: arboles, desde: bosqueDesde, hasta: bosqueHasta, reparto: 1, llano, sombra: sombraArboles });
  const sombras = obstaculos.filter(o => Math.hypot(o.x, o.z) < llano + 30).map(o => [o.x, o.z, o.r * 7, 0.35]);
  raiz.add(suelo({ llano, cerca: llano * 1.2, lejos, sombras, tinte, relieve: relieveSuelo }));
  plantas(raiz, r, { hierba, flores, radio: hierbaHasta, desde: hierbaDesde, libre: claro });
  // rocas sueltas entre la hierba y el bosque (una sola malla)
  if (rocas) {
    const L = new Lote(), alt = alturaTerreno(llano);
    for (let i = 0; i < rocas; i++) {
      const a = r() * Math.PI * 2, d = hierbaDesde + 4 + r() * (bosqueHasta * 0.6 - hierbaDesde), x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.35 + r() * 0.4;
      L.add(new THREE.IcosahedronGeometry(1, 1), r() > 0.5 ? 'piedraOsc' : 'piedra', x, alt(x, z) + s * 0.22, z, { y: r() * 6 }, { escala: new THREE.Vector3(s * 1.3, s * 0.65, s), plano: true });
      obstaculos.push({ x, z, r: s * 1.1 });
    }
    const grupos = L.cerrar(null, true);
    for (const [tipo, geos] of Object.entries(grupos)) { const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tipo)); m.castShadow = m.receiveShadow = true; m.name = 'rocas'; raiz.add(m); }
  }
  return { raiz, obstaculos, altura: alturaTerreno(llano) };
}
