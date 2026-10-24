// Kinhold — estilo visual v3 (hito 1b): «maqueta en miniatura».
// Formas limpias y redondeadas, sombreado suave, luz cálida y suave con sombras blandas,
// oclusión de contacto horneada en los vértices y fondo desenfocado (como una foto de maqueta).
// Ligero igual que la v2: todo lo fijo en una malla, lo repetido instanciado, una sola sombra.
import * as THREE from 'three';

// Paleta: apagada y natural, un punto más cálida y limpia que la v2
export const PALETA = {
  madera: 0x7a5a3f, maderaOsc: 0x5c4330, corte: 0xc9a777, tabla: 0x93714f,
  paja: 0xb59d6c, pajaOsc: 0x9a8457, piedra: 0x9c978d, piedraOsc: 0x7d7970, mortero: 0x8a8274,
  hierro: 0x55555a, hierba: 0x7d9455, hierbaClara: 0x98a866, tierra: 0x7f6a4f, camino: 0x9a8566,
  tierraCorte: 0x6a5440, tierraCorteOsc: 0x4f3f31, raiz: 0x5a4632,
  hoja: 0x6f8a4a, hojaOsc: 0x587340, hojaClara: 0x8aa05a, pino: 0x52693f, pinoOsc: 0x445a35, corteza: 0x5e4a38,
};

export const LUCES = {
  manana: { nombre: 'Mañana', sol: [0xfff1dc, 2.2, [10, 14, 8]], hemi: [0xe6eef2, 0x6a5b47, 1.6], fondo: [0xdfe6e4, 0xb9c9cc] },
  tarde:  { nombre: 'Tarde',  sol: [0xffd8a6, 2.4, [13, 8, 3]],  hemi: [0xe2ddd6, 0x6a5240, 1.45], fondo: [0xeadcc6, 0xc9b9a2] },
};

const mats = {};
export function material(tipo = 'fijo') {
  if (!mats[tipo]) {
    mats[tipo] = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    if (tipo === 'doble') mats[tipo].side = THREE.DoubleSide;
  }
  return mats[tipo];
}

// ---------- Lote: junta geometrías con su color horneado en una sola ----------
// add(geo, color, x, y, z, giro, opc) — giro: {x, y, z} en radianes o una Matrix4.
// opc: escala (Vector3), plano (caras planas), brillo, rayas(v), sinSuelo (sin oscurecer al pie).
// Al cerrar: color × variación suave × oclusión de contacto (más oscuro al pie y en lo que mira abajo)
function ruido3(x, y, z) { const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.71) * 43758.55; return s - Math.floor(s); }
export class Lote {
  constructor({ variacion = 0.05, rangoSuelo = 0.6, suelo = 0 } = {}) { this.piezas = []; this.variacion = variacion; this.rangoSuelo = rangoSuelo; this.suelo = suelo; }
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
      if (p.opc.plano) g.computeVertexNormals();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(pos.count * 3);
      const e = p.m.elements, tono = 1 + (ruido3(e[12], e[13], e[14]) - 0.5) * 2 * this.variacion;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
        let k = tono;
        if (!p.opc.sinSuelo) { const h = Math.max(0, (v.y - this.suelo) / this.rangoSuelo); k *= 0.55 + 0.45 * Math.min(1, Math.sqrt(h)); }
        k *= 0.8 + 0.2 * (n.y * 0.5 + 0.5);
        if (oclusion) k *= oclusion(v, n);
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
