// Kinhold — pruebas de estilo (hito 1b). Tres maneras de dibujar lo mismo para que Pedro elija.
// Cada estilo decide: detalle de la geometría, sombreado, materiales, texturas por código,
// oclusión horneada en vértices, luz, niebla y gradación de color. La paleta base es la misma
// (apagada y natural) con pequeños ajustes de cada estilo.
import * as THREE from 'three';

// Paleta base por material (colores apagados, naturales)
export const PALETA = {
  piel: 0xc49a7c, pielSombra: 0xa97f63, labio: 0x8a5a4e, ojo: 0x3a2a1e, blancoOjo: 0xcfc6b8,
  pelo: 0x3d2c20, lino: 0xcfc4ab, linoOsc: 0xb3a88e, lana: 0x6b5b45, lanaVerde: 0x56603f,
  cuero: 0x5a3f2a, cueroOsc: 0x3e2b1d, cordel: 0x8a7a55,
  madera: 0x6f5236, maderaOsc: 0x54402b, corte: 0xb89466, tabla: 0x8d6a46,
  paja: 0xb99a5a, pajaOsc: 0x977b45, piedra: 0x8a867d, piedraOsc: 0x6b6861, barro: 0x8c7357,
  hierro: 0x4a4b4d, hierba: 0x667f45, hierbaSeca: 0x8a8a52, tierra: 0x6e5d45, hoja: 0x4c6234, hojaOsc: 0x3d5229,
};

export const ESTILOS = {
  A: {
    id: 'A', nombre: 'A · Plano sobrio',
    resumen: 'Caras planas y colores lisos con un poco de variación. Poco detalle, el más ligero. Luz de mediodía.',
    detalle: 0,                 // 0 bajo, 1 medio, 2 alto: lados de cilindros, esferas, etc.
    sombreado: 'plano',         // plano | suave | mixto
    material: 'lambert',        // lambert | estandar
    texturas: false, ao: false, variacion: 0.05,
    cielo: 0xbcd0dc, niebla: [0xbcd0dc, 35, 110],
    sol: { color: 0xfff3dc, fuerza: 2.0, pos: [12, 20, 8] }, cieloLuz: [0xdfe9ef, 0x6e604a, 1.0],
    tono: THREE.NoToneMapping, exposicion: 1, sombraSuave: 1, filtro: 'none', vineta: 0,
  },
  B: {
    id: 'B', nombre: 'B · Suave y natural',
    resumen: 'Sombreado suave, materiales mates con oclusión horneada en los vértices, más detalle en cara y manos. Luz de mañana, tonos de cine.',
    detalle: 1, sombreado: 'suave', material: 'estandar',
    texturas: false, ao: true, variacion: 0.08,
    cielo: 0xc3d2d8, niebla: [0xc3d2d8, 28, 95],
    sol: { color: 0xffe7c4, fuerza: 3.0, pos: [14, 13, 10] }, cieloLuz: [0xd6e2ea, 0x5b4e3c, 1.4],
    tono: THREE.ACESFilmicToneMapping, exposicion: 1.05, sombraSuave: 3, filtro: 'saturate(0.92)', vineta: 0.18,
  },
  C: {
    id: 'C', nombre: 'C · Texturas pintadas',
    resumen: 'Texturas hechas por código (veta de la madera, paja, piedra, tejido), caras planas en lo duro y suaves en piel y ropa, el más detallado. Luz baja de tarde, niebla y gradación cálida.',
    detalle: 2, sombreado: 'mixto', material: 'estandar',
    texturas: true, ao: true, variacion: 0.1,
    cielo: 0xd2c6b0, niebla: [0xcdbfa6, 22, 80],
    sol: { color: 0xffd29a, fuerza: 3.4, pos: [16, 11, 7] }, cieloLuz: [0xcad3d6, 0x5a4a38, 1.45],
    tono: THREE.ACESFilmicToneMapping, exposicion: 1.1, sombraSuave: 4, filtro: 'saturate(0.9) contrast(1.05) sepia(0.08)', vineta: 0.32,
  },
};

// Lados según detalle: [bajo, medio, alto]
export function lados(estilo, bajo, medio, alto) { return [bajo, medio, alto][estilo.detalle]; }

// Materiales "duros" (planos en el estilo mixto)
const DUROS = new Set(['madera', 'maderaOsc', 'corte', 'tabla', 'piedra', 'piedraOsc', 'hierro', 'paja', 'pajaOsc', 'barro', 'hoja', 'hojaOsc']);
// Qué textura lleva cada material en el estilo con texturas
const TEXTURA = {
  madera: 'veta', maderaOsc: 'veta', tabla: 'veta', corte: 'anillos', paja: 'paja', pajaOsc: 'paja',
  piedra: 'piedra', piedraOsc: 'piedra', barro: 'piedra', lino: 'tejido', linoOsc: 'tejido', lana: 'tejido', lanaVerde: 'tejido',
  cuero: 'cuero', cueroOsc: 'cuero', tierra: 'suelo', hierba: 'suelo',
};

// ---------- Texturas generadas con canvas (en gris: el color lo pone el material) ----------
function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cacheTex = new Map();
function textura(tipo) {
  if (cacheTex.has(tipo)) return cacheTex.get(tipo);
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), r = azar(tipo.length * 977 + tipo.charCodeAt(0));
  const gris = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
  g.fillStyle = gris(225); g.fillRect(0, 0, N, N);
  if (tipo === 'veta') { // vetas a lo largo (eje v)
    for (let n = 0; n < 70; n++) {
      const x = r() * N, w = 1 + r() * 3; g.strokeStyle = gris(150 + r() * 60, 0.5); g.lineWidth = w;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= N; y += 16) g.lineTo(x + Math.sin(y * 0.03 + n) * 4, y);
      g.stroke();
    }
    for (let n = 0; n < 6; n++) { g.fillStyle = gris(120, 0.6); g.beginPath(); g.ellipse(r() * N, r() * N, 3 + r() * 3, 6 + r() * 6, 0, 0, 7); g.fill(); }
  } else if (tipo === 'anillos') {
    for (let k = 30; k > 0; k--) { g.strokeStyle = gris(k % 2 ? 170 : 205); g.lineWidth = 4; g.beginPath(); g.arc(N / 2, N / 2, k * 4.3, 0, 7); g.stroke(); }
    g.strokeStyle = gris(110, 0.7); g.lineWidth = 3; g.beginPath(); g.moveTo(N / 2, N / 2); g.lineTo(N * 0.9, N * 0.2); g.stroke();
  } else if (tipo === 'paja') {
    for (let n = 0; n < 1400; n++) {
      const x = r() * N, y = r() * N, l = 18 + r() * 30; g.strokeStyle = gris(140 + r() * 110, 0.8); g.lineWidth = 1 + r() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y + l); g.stroke();
    }
  } else if (tipo === 'piedra') {
    for (let n = 0; n < 900; n++) { g.fillStyle = gris(150 + r() * 100, 0.35); g.beginPath(); g.arc(r() * N, r() * N, 1 + r() * 6, 0, 7); g.fill(); }
    for (let n = 0; n < 10; n++) { g.strokeStyle = gris(110, 0.5); g.lineWidth = 1; g.beginPath(); let x = r() * N, y = r() * N; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  } else if (tipo === 'tejido') {
    for (let y = 0; y < N; y += 4) { g.fillStyle = gris(195 + r() * 30, 0.6); g.fillRect(0, y, N, 2); }
    for (let x = 0; x < N; x += 4) { g.fillStyle = gris(185 + r() * 30, 0.45); g.fillRect(x, 0, 2, N); }
  } else if (tipo === 'cuero') {
    for (let n = 0; n < 500; n++) { g.fillStyle = gris(170 + r() * 70, 0.3); g.beginPath(); g.arc(r() * N, r() * N, 2 + r() * 10, 0, 7); g.fill(); }
  } else if (tipo === 'suelo') {
    for (let n = 0; n < 3000; n++) { g.fillStyle = gris(140 + r() * 115, 0.5); g.fillRect(r() * N, r() * N, 1 + r() * 2, 2 + r() * 4); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cacheTex.set(tipo, t);
  return t;
}

// ---------- Materiales ----------
const cacheMat = new Map();
export function material(estilo, clave, extra = {}) {
  const k = estilo.id + clave + JSON.stringify(extra);
  if (cacheMat.has(k)) return cacheMat.get(k);
  const color = PALETA[clave] ?? clave;
  const plano = estilo.sombreado === 'plano' || (estilo.sombreado === 'mixto' && DUROS.has(clave));
  const op = { color, flatShading: plano, vertexColors: true, ...extra };
  if (estilo.texturas && TEXTURA[clave]) op.map = textura(TEXTURA[clave]);
  let m;
  if (estilo.material === 'estandar') {
    const rug = clave === 'hierro' ? 0.45 : clave.startsWith('piel') || clave === 'labio' ? 0.62 : 0.9;
    m = new THREE.MeshStandardMaterial({ roughness: rug, metalness: clave === 'hierro' ? 0.6 : 0, ...op });
  } else m = new THREE.MeshLambertMaterial(op);
  cacheMat.set(k, m);
  return m;
}

// ---------- Color por vértice: variación y oclusión horneada ----------
// Se hace una vez, con la pieza ya colocada (posición del mundo).
// variación: ruido suave por posición. Oclusión: más oscuro cerca del suelo y en caras que miran abajo.
function ruido3(x, y, z) {
  const s = Math.sin(x * 12.99 + y * 78.23 + z * 37.71) * 43758.55;
  return s - Math.floor(s);
}
export function hornear(raiz, estilo) {
  raiz.updateMatrixWorld(true);
  const v = new THREE.Vector3(), nrm = new THREE.Vector3(), mN = new THREE.Matrix3();
  raiz.traverse(o => {
    if (!o.isMesh || o.userData.sinHornear) return;
    let geo = o.geometry;
    if (geo.userData.horneada) { geo = geo.clone(); o.geometry = geo; }
    geo.userData.horneada = true;
    const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
    const col = new Float32Array(n * 3);
    mN.getNormalMatrix(o.matrixWorld);
    const base = o.userData.alturaSuelo ?? 0;
    const rango = raiz.userData.rangoAO ?? 0.9;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      let k = 1 + (ruido3(Math.floor(v.x * 3), Math.floor(v.y * 3), Math.floor(v.z * 3)) - 0.5) * 2 * estilo.variacion;
      if (estilo.ao) {
        const h = v.y - base;
        k *= 0.62 + 0.38 * Math.min(1, Math.max(0, h / rango)); // contacto con el suelo
        if (nor) { nrm.fromBufferAttribute(nor, i).applyMatrix3(mN).normalize(); k *= 0.82 + 0.18 * (nrm.y * 0.5 + 0.5); }
        if (o.userData.ao) k *= o.userData.ao(v); // oclusión propia de la pieza (p. ej. bajo el alero)
      }
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}
