// Kinhold — estilo visual del mundo («realismo en miniatura», decidido en la prueba de estilo v5).
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
  manana: { nombre: 'Mañana', sol: [0xfff1dc, 2.2, [10, 14, 8]], hemi: [0xe6eef2, 0x6a5b47, 1.6], fondo: [0xd9e1e0, 0xa9bfca] },
  tarde:  { nombre: 'Tarde',  sol: [0xffd8a6, 2.4, [13, 8, 3]],  hemi: [0xe2ddd6, 0x6a5240, 1.45], fondo: [0xe6d6bd, 0xb7b4ad] },
};

// ---------- Texturas por código (v4, «realismo en miniatura») ----------
// En gris claro (media ≈ 0,85): el color lo ponen los vértices; la textura da el detalle y el relieve (bumpMap).
// Todas las vetas van a lo largo del eje v; el Lote proyecta las UV para que v siga el eje largo de cada pieza.
function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cacheTex = {};
export function textura(tipo) {
  if (cacheTex[tipo]) return cacheTex[tipo];
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), r = azar(tipo.length * 131 + tipo.charCodeAt(0) * 7);
  const gris = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  g.fillStyle = gris(222); g.fillRect(0, 0, N, N);
  // dibuja también con desplazamiento de ±N para que la textura se repita sin costuras
  const envolver = (fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  if (tipo === 'veta' || tipo === 'corteza') {
    const corteza = tipo === 'corteza';
    for (let n = 0; n < (corteza ? 46 : 90); n++) {
      const x = r() * N, w = corteza ? 2 + r() * 5 : 0.6 + r() * 2.2, v = corteza ? 90 + r() * 70 : 150 + r() * 70, fase = r() * 6;
      envolver(() => { g.strokeStyle = gris(v, corteza ? 0.85 : 0.55); g.lineWidth = w; g.beginPath(); for (let y = -8; y <= N + 8; y += 8) g.lineTo(x + Math.sin(y * 0.045 + fase) * (corteza ? 3 : 2.5), y); g.stroke(); });
    }
    if (!corteza) for (let n = 0; n < 4; n++) { const x = r() * N, y = r() * N; envolver(() => { g.fillStyle = gris(120, 0.7); g.beginPath(); g.ellipse(x, y, 3 + r() * 2, 7 + r() * 5, 0, 0, 7); g.fill(); }); }
  } else if (tipo === 'anillos') {
    g.fillStyle = gris(230); g.fillRect(0, 0, N, N);
    for (let k = 34; k > 0; k--) { g.strokeStyle = gris(k % 2 ? 175 : 212); g.lineWidth = 2.5 + r() * 2; g.beginPath(); g.arc(N / 2 + r() * 2, N / 2 + r() * 2, k * 3.7, 0, 7); g.stroke(); }
    g.strokeStyle = gris(110, 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(N / 2, N / 2); g.lineTo(N * 0.92, N * 0.3); g.stroke();
  } else if (tipo === 'paja') {
    for (let n = 0; n < 2600; n++) {
      const x = r() * N, y = r() * N, l = 14 + r() * 34, v = 140 + r() * 115;
      envolver(() => { g.strokeStyle = gris(v, 0.85); g.lineWidth = 0.8 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + l); g.stroke(); });
    }
  } else if (tipo === 'piedra') {
    for (let n = 0; n < 1400; n++) { const x = r() * N, y = r() * N, rr = 1 + r() * 7, v = 160 + r() * 95; envolver(() => { g.fillStyle = gris(v, 0.35); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }); }
    for (let n = 0; n < 9; n++) { let x = r() * N, y = r() * N; g.strokeStyle = gris(120, 0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  } else if (tipo === 'hojas') {
    // follaje: manchas redondas y suaves de luz y sombra (racimos de hojas vistos de lejos), sin trazos
    g.fillStyle = gris(200); g.fillRect(0, 0, N, N);
    for (let n = 0; n < 700; n++) {
      const x = r() * N, y = r() * N, rr = 3 + r() * 9, v = 150 + r() * 105;
      envolver(() => { const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, gris(v, 0.75)); gr.addColorStop(1, gris(v, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); });
    }
  } else if (tipo === 'suelo') {
    for (let n = 0; n < 5000; n++) { const x = r() * N, y = r() * N, v = 140 + r() * 115; envolver(() => { g.fillStyle = gris(v, 0.55); g.fillRect(x, y, 1 + r() * 1.5, 2 + r() * 5); }); }
    for (let n = 0; n < 60; n++) { const x = r() * N, y = r() * N, v = 150 + r() * 60; envolver(() => { g.fillStyle = gris(v, 0.5); g.beginPath(); g.arc(x, y, 1.5 + r() * 3, 0, 7); g.fill(); }); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (cacheTex[tipo] = t);
}
// qué textura lleva cada color de la paleta, y cuántas repeticiones por metro
export const TEX = {
  madera: 'veta', maderaOsc: 'veta', tabla: 'veta', corte: 'anillos', paja: 'paja', pajaOsc: 'paja',
  piedra: 'piedra', piedraOsc: 'piedra', mortero: 'piedra', corteza: 'corteza',
  hoja: 'hojas', hojaOsc: 'hojas', hojaClara: 'hojas', pino: 'hojas', pinoOsc: 'hojas',
};
export const DENSIDAD = { veta: 1.1, anillos: 1, paja: 0.9, piedra: 1.6, corteza: 1.4, hojas: 1.2 };
const RELIEVE = { veta: 1.2, anillos: 0.8, paja: 2.0, piedra: 1.6, corteza: 2.4, hojas: 0.5, suelo: 1.0 };
export function materialTex(tipo) {
  const k = 'tex_' + tipo;
  if (!mats[k]) {
    if (!tipo || tipo === 'liso') return material('fijo');
    const t = textura(tipo);
    mats[k] = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, map: t, bumpMap: t, bumpScale: RELIEVE[tipo] ?? 1 });
  }
  return mats[k];
}

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
    this.piezas.push({ geo, color: new THREE.Color(PALETA[color] ?? color), colorClave: color, m, opc });
  }
  // cerrar(oclusion, conTextura): con textura devuelve { tipo: [geometrías] } con UV proyectadas;
  // sin ella, una lista de geometrías como antes.
  cerrar(oclusion = null, conTextura = false) {
    const grupos = {}, lista = [], v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const p of this.piezas) {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      const tipo = conTextura ? (p.opc.tex ?? TEX[p.colorClave] ?? 'liso') : 'liso';
      if (tipo !== 'liso') proyectarUV(g, tipo);
      g.applyMatrix4(p.m);
      if (p.opc.plano) g.computeVertexNormals();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(pos.count * 3);
      const e = p.m.elements, tono = 1 + (ruido3(e[12], e[13], e[14]) - 0.5) * 2 * this.variacion;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
        let k = tono;
        if (!p.opc.sinSuelo) { const h = Math.max(0, (v.y - this.suelo) / this.rangoSuelo); k *= 0.55 + 0.45 * Math.min(1, Math.sqrt(h)); }
        k *= 0.8 + 0.2 * (n.y * 0.5 + 0.5);
        if (oclusion) k *= oclusion(v, n);
        if (p.opc.copa) k *= 0.62 + 0.5 * (n.y * 0.5 + 0.5) + 0.12 * Math.min(1, Math.max(0, (v.y - p.opc.copa) / 2)); // copas: luz arriba, sombra dentro
        if (p.opc.brillo) k *= p.opc.brillo;
        if (p.opc.rayas) k *= p.opc.rayas(v);
        if (tipo !== 'liso') k *= 1.12; // la textura oscurece un poco: se compensa
        col[i * 3] = p.color.r * k; col[i * 3 + 1] = p.color.g * k; col[i * 3 + 2] = p.color.b * k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      (grupos[tipo] ??= []).push(g); lista.push(g);
    }
    return conTextura ? grupos : lista;
  }
}

// UV por proyección de caja en el espacio propio de la pieza, a escala real (DENSIDAD repeticiones por metro).
// El eje v sigue el eje Y propio (el largo de troncos, tablas de pie y postes); en las caras que miran
// arriba o abajo, v sigue Z (la pendiente del tejado). Los cortes (anillos) se centran en la pieza.
function proyectarUV(g, tipo) {
  const p = g.attributes.position, nr = g.attributes.normal, uv = new Float32Array(p.count * 2);
  g.computeBoundingBox(); const bb = g.boundingBox, c = new THREE.Vector3(); bb.getCenter(c);
  const tam = new THREE.Vector3(); bb.getSize(tam);
  const D = DENSIDAD[tipo] ?? 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(nr.getX(i)), ay = Math.abs(nr.getY(i)), az = Math.abs(nr.getZ(i));
    let u, w;
    if (tipo === 'hojas') { // copas: proyección cilíndrica alrededor de la pieza (sin costuras entre caras)
      const dx = x - c.x, dz = z - c.z, rad = Math.max(0.3, Math.max(tam.x, tam.z) / 2);
      u = (Math.atan2(dz, dx) / (2 * Math.PI) + 0.5) * Math.max(1, Math.round(2 * Math.PI * rad * D)); w = y * D;
    } else if (tipo === 'anillos') { // centrado: el plano perpendicular al eje más corto
      const corto = Math.min(tam.x, tam.y, tam.z);
      if (corto === tam.y) { u = (x - c.x) / Math.max(tam.x, 1e-3); w = (z - c.z) / Math.max(tam.z, 1e-3); }
      else if (corto === tam.x) { u = (z - c.z) / Math.max(tam.z, 1e-3); w = (y - c.y) / Math.max(tam.y, 1e-3); }
      else { u = (x - c.x) / Math.max(tam.x, 1e-3); w = (y - c.y) / Math.max(tam.y, 1e-3); }
      u += 0.5; w += 0.5;
    } else if (ay > ax && ay > az) { u = x * D; w = z * D; }
    else if (ax > az) { u = z * D; w = y * D; }
    else { u = x * D; w = y * D; }
    uv[i * 2] = u; uv[i * 2 + 1] = w;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
