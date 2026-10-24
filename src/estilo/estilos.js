// Kinhold — estilo visual v2 (hito 1b): un solo estilo, estilizado y sobrio, pensado para móvil.
// Cómo se consigue que sea ligero:
//  - Un único material de dibujo (toon de 3 tonos) para todo lo fijo: el color va en los vértices,
//    así toda la escena fija se junta en una sola malla (un dibujado).
//  - Lo repetido (árboles, matas, piedras) va instanciado: un dibujado por tipo.
//  - Una sola luz con sombra, de 1024 px y ajustada a la zona cercana.
//  - Resolución adaptativa: si el aparato no llega a ~50 fps, se dibuja a menos resolución.
import * as THREE from 'three';

// Paleta apagada y natural. Todo color sale de aquí.
export const PALETA = {
  madera: 0x6b4f35, maderaOsc: 0x4f3a27, corte: 0xb8955f, tabla: 0x86654a,
  paja: 0xa48a58, pajaOsc: 0x84703f, piedra: 0x8b877e, piedraOsc: 0x67645d,
  hierro: 0x4a4a4c, hierba: 0x6a8048, hierbaClara: 0x87955a, tierra: 0x6f5e47, camino: 0x857256,
  hoja: 0x4d6534, hojaOsc: 0x3c5229, hojaClara: 0x627a3f, pino: 0x3f5634, pinoOsc: 0x30452a, corteza: 0x4a3a2c,
};

// Dos ambientes de luz para comparar (misma escena, mismo coste)
export const LUCES = {
  manana: { nombre: 'Mañana', sol: [0xfff0d8, 2.4, [14, 16, 9]], hemi: [0xdbe6ec, 0x5d5140, 1.25], niebla: [0xcfd9dc, 30, 110], cielo: [0x9fb8c8, 0xdfe3dc] },
  tarde:  { nombre: 'Tarde',  sol: [0xffcf94, 2.6, [18, 7, 4]],   hemi: [0xc9cfd6, 0x5a4634, 1.15], niebla: [0xd8c7aa, 24, 95],  cielo: [0xa9b4bb, 0xe6cfa8] },
};

// Gradiente de 3 tonos para el material toon (sombra, medio, luz)
let degradado = null;
function texturaDegradado() {
  if (degradado) return degradado;
  degradado = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  degradado.minFilter = degradado.magFilter = THREE.NearestFilter;
  degradado.needsUpdate = true;
  return degradado;
}
const mats = {};
export function material(tipo = 'fijo') {
  if (!mats[tipo]) {
    mats[tipo] = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: texturaDegradado() });
    if (tipo === 'doble') mats[tipo].side = THREE.DoubleSide;
  }
  return mats[tipo];
}

// ---------- Lote: junta geometrías con su color en una sola ----------
// add(geo, color, x, y, z, giro, opc) — giro: {x, y, z} en radianes o una Matrix4.
// Al cerrar se hornea el color en los vértices: paleta × variación × oclusión
// (más oscuro cerca del suelo, en caras que miran abajo y donde diga la función 'oclusion').
function ruido3(x, y, z) { const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.71) * 43758.55; return s - Math.floor(s); }
export class Lote {
  constructor({ variacion = 0.07, rangoSuelo = 0.8 } = {}) { this.piezas = []; this.variacion = variacion; this.rangoSuelo = rangoSuelo; }
  add(geo, color, x = 0, y = 0, z = 0, giro = null, opc = {}) {
    const m = new THREE.Matrix4();
    if (giro && giro.isMatrix4) m.copy(giro);
    else if (giro) m.makeRotationFromEuler(new THREE.Euler(giro.x || 0, giro.y || 0, giro.z || 0, 'YXZ'));
    if (opc.escala) m.scale(opc.escala);
    m.setPosition(x, y, z);
    this.piezas.push({ geo, color: new THREE.Color(PALETA[color] ?? color), m, opc });
  }
  cerrar(oclusion = null) {
    const geos = [], v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const p of this.piezas) {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m);
      if (!p.opc.suave) g.computeVertexNormals(); // sin índice: cada triángulo con su normal (caras planas)
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(pos.count * 3);
      const e = p.m.elements, tono = 1 + (ruido3(e[12], e[13], e[14]) - 0.5) * 2 * this.variacion; // cada pieza, un poco distinta
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
        let k = tono * (1 + (ruido3(Math.floor(v.x * 4), Math.floor(v.y * 4), Math.floor(v.z * 4)) - 0.5) * this.variacion);
        k *= 0.7 + 0.3 * Math.min(1, Math.max(0, v.y / this.rangoSuelo)); // contacto con el suelo
        k *= 0.88 + 0.12 * (n.y * 0.5 + 0.5);                             // lo que mira abajo, más oscuro
        if (oclusion) k *= oclusion(v);
        if (p.opc.brillo) k *= p.opc.brillo;
        if (p.opc.rayas) k *= p.opc.rayas(v);
        col[i * 3] = p.color.r * k; col[i * 3 + 1] = p.color.g * k; col[i * 3 + 2] = p.color.b * k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    }
    return geos;
  }
}
