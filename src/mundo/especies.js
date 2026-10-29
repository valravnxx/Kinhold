// Kinhold — las especies de árbol del mundo, con el vocabulario del estilo v5 (copas de bultos, pisos de pino con
// puntas, cortezas con su textura): abeto, pino, abedul, roble, haya, fresno y encina, las del documento de sistemas
// («abeto y abedul al norte; roble, haya y fresno en lo templado; pino y encina al sur»). Cada una se reconoce por la
// silueta, también de lejos: el abeto en aguja oscura, el pino con el tronco alto y la copa arriba, el abedul fino y
// blanco, el roble bajo y ancho, el haya alta y ovalada, el fresno con la copa abierta y clara, la encina baja y redonda.
// Medidas a escala 1 en metros, del tamaño de los árboles del juego (6 a 11 m). La forma «sencilla», con menos caras,
// es para los miles de árboles de lejos.
import * as THREE from 'three';
import { cil, copa, pisoPino, modeloLote } from './decorado.js';

export const ESPECIES = ['abeto', 'pino', 'abedul', 'roble', 'haya', 'fresno', 'encina'];

// copas: [x, y, z, radio, color, escala (x, y, z) opcional]; s = sencillo
function copas(L, lista, s, det, desde = 0) {
  lista.forEach(([x, y, z, r, color, e], i) => L.add(copa(r, det, i * 1.7 + desde), color, x, y, z, { x: i * 0.7, y: i * 2.1 },
    { copa: y - r, escala: e ? new THREE.Vector3(...e) : undefined }));
}

const HACER = {
  abeto: (L, s) => {
    const lados = s ? 6 : 8;
    L.add(cil(0.13, 0.3, 3, s ? 5 : 6), 'corteza', 0, 1.5, 0);
    // aguja estrecha y alta: pisos cada vez más pequeños hasta la punta
    const pisos = s ? [[1.95, 3.0, 2.6], [1.55, 2.8, 4.2], [1.15, 2.6, 5.8], [0.75, 2.4, 7.4], [0.4, 2.0, 8.9]]
      : [[2.0, 2.4, 2.4], [1.7, 2.3, 3.8], [1.4, 2.2, 5.2], [1.1, 2.1, 6.6], [0.8, 2.0, 7.9], [0.5, 1.8, 9.1], [0.25, 1.4, 10.2]];
    pisos.forEach(([r, h, y], i) => L.add(pisoPino(r, h, lados, i * 1.3), i % 2 ? 'abetoOsc' : 'abeto', 0, y, 0, { y: i * 0.9 }, { copa: 0 }));
  },
  pino: (L, s) => {
    // tronco alto y desnudo, rojizo arriba; la copa, unas cuantas masas aplastadas en lo alto
    L.add(cil(0.17, 0.27, 3.4, s ? 5 : 6), 'corteza', 0, 1.7, 0);
    L.add(cil(0.1, 0.17, 4.2, s ? 5 : 6), 'cortezaRoja', 0.08, 5.4, 0, { z: -0.03 });
    if (!s) L.add(cil(0.05, 0.08, 1.6, 5), 'cortezaRoja', 0.65, 6.6, 0.1, { z: -0.9 });
    copas(L, s ? [[0.1, 8.0, 0, 1.6, 'pino', [1.5, 0.6, 1.4]], [1.1, 7.2, 0.4, 1.1, 'pinoOsc', [1.4, 0.6, 1.3]]]
      : [[0.1, 8.3, 0, 1.5, 'pino', [1.5, 0.58, 1.4]], [1.2, 7.4, 0.4, 1.1, 'pinoOsc', [1.45, 0.6, 1.3]], [-0.9, 7.6, -0.6, 1.0, 'pinoOsc', [1.4, 0.6, 1.3]], [0.2, 9.1, -0.2, 0.9, 'pino', [1.4, 0.6, 1.3]]], s, s ? 0 : 1);
  },
  abedul: (L, s) => {
    // fino y blanco, con las marcas oscuras de su corteza; copa estrecha y ligera
    const marcas = (v) => (Math.sin(v.y * 7.3 + Math.sin(v.y * 2.1) * 2) > 0.8 ? 0.55 : 1);
    L.add(cil(0.07, 0.15, 6.4, s ? 5 : 6), 'cortezaClara', 0, 3.2, 0, { z: 0.03 }, { rayas: marcas });
    copas(L, s ? [[0, 5.6, 0, 1.45, 'hojaClara', [1, 1.3, 1]], [0.25, 7.5, 0.1, 1.15, 'hoja', [1, 1.3, 1]], [-0.6, 5.0, 0.45, 1.1, 'hoja', [1, 1.2, 1]]]
      : [[0, 5.6, 0, 1.4, 'hojaClara', [1, 1.3, 1]], [0.3, 7.3, 0.1, 1.15, 'hoja', [1, 1.3, 1]], [-0.65, 4.9, 0.5, 1.05, 'hoja', [1, 1.2, 1]], [0.65, 5.1, -0.5, 1.0, 'hojaClara', [1, 1.2, 1]], [0.05, 8.6, 0, 0.75, 'hojaClara', [1, 1.3, 1]]], s, s ? 0 : 1, 3);
  },
  roble: (L, s) => {
    // bajo y ancho: tronco grueso que se abre en ramas gruesas y una copa más ancha que alta
    L.add(cil(0.32, 0.52, 2.8, s ? 5 : 7), 'corteza', 0, 1.4, 0);
    L.add(cil(0.14, 0.26, 2.6, s ? 4 : 6), 'corteza', 0.7, 3.5, 0, { z: -0.7 });
    L.add(cil(0.13, 0.24, 2.4, s ? 4 : 6), 'corteza', -0.6, 3.4, 0.3, { z: 0.65, x: 0.2 });
    copas(L, s ? [[0, 5.4, 0, 2.0, 'hojaOsc', [1.25, 0.8, 1.2]], [1.8, 4.8, 0.5, 1.5, 'hoja', [1.2, 0.8, 1.1]], [-1.7, 4.9, -0.4, 1.5, 'hoja', [1.2, 0.8, 1.1]]]
      : [[0, 5.6, 0, 1.9, 'hojaOsc', [1.2, 0.8, 1.2]], [1.9, 4.9, 0.6, 1.45, 'hoja', [1.2, 0.8, 1.1]], [-1.8, 5.0, -0.5, 1.5, 'hoja', [1.2, 0.8, 1.1]], [0.4, 4.8, 1.9, 1.35, 'hojaOsc', [1.2, 0.8, 1.1]], [-0.5, 4.9, -1.9, 1.35, 'hojaOsc', [1.2, 0.8, 1.1]], [0.6, 6.6, -0.4, 1.2, 'hojaClara', [1.1, 0.75, 1.1]]], s, s ? 0 : 1, 5);
  },
  haya: (L, s) => {
    // alta, de tronco liso y gris, con la copa en óvalo apretado
    L.add(cil(0.2, 0.36, 5.2, s ? 5 : 7), 'cortezaGris', 0, 2.6, 0);
    if (!s) L.add(cil(0.08, 0.14, 2.2, 5), 'cortezaGris', 0.5, 5.2, 0, { z: -0.5 });
    copas(L, s ? [[0, 6.9, 0, 2.0, 'haya', [1, 1.2, 1]], [0.3, 8.9, 0.1, 1.5, 'hayaOsc', [1, 1.1, 1]], [-0.6, 5.6, 0.5, 1.4, 'hayaOsc']]
      : [[0, 6.8, 0, 1.95, 'haya', [1, 1.2, 1]], [0.35, 8.9, 0.1, 1.45, 'hayaOsc', [1, 1.15, 1]], [-0.8, 5.7, 0.6, 1.35, 'hayaOsc'], [0.85, 5.9, -0.55, 1.3, 'haya'], [-0.3, 10.1, -0.2, 0.9, 'haya']], s, s ? 0 : 1, 7);
  },
  fresno: (L, s) => {
    // copa abierta y clara, en masas sueltas con huecos entre ellas
    L.add(cil(0.15, 0.27, 4.6, s ? 5 : 6), 'corteza', 0, 2.3, 0);
    L.add(cil(0.07, 0.13, 2.4, s ? 4 : 5), 'corteza', 0.7, 5.0, 0.1, { z: -0.6 });
    L.add(cil(0.07, 0.12, 2.2, s ? 4 : 5), 'corteza', -0.6, 5.1, -0.2, { z: 0.55 });
    copas(L, s ? [[1.0, 6.5, 0.2, 1.55, 'fresno', [1.1, 0.9, 1.1]], [-1.0, 6.7, -0.3, 1.5, 'fresno', [1.1, 0.9, 1.1]], [0.1, 7.9, 0.4, 1.35, 'hojaClara']]
      : [[1.1, 6.5, 0.2, 1.45, 'fresno', [1.1, 0.9, 1.1]], [-1.05, 6.7, -0.35, 1.4, 'fresno', [1.1, 0.9, 1.1]], [0.15, 8.0, 0.45, 1.3, 'hojaClara'], [0.3, 6.3, -1.1, 1.2, 'hoja'], [-0.3, 6.1, 1.1, 1.15, 'fresno']], s, s ? 0 : 1, 9);
  },
  encina: (L, s) => {
    // baja, de tronco corto y torcido, con la copa redonda, densa y oscura
    L.add(cil(0.2, 0.34, 3.0, s ? 5 : 6), 'corteza', 0.2, 1.45, 0, { z: -0.15 });
    if (!s) L.add(cil(0.12, 0.2, 1.6, 5), 'corteza', -0.4, 2.0, 0.1, { z: 0.6 });
    copas(L, s ? [[0, 3.9, 0, 1.9, 'encina', [1.15, 0.8, 1.15]], [1.2, 3.4, 0.6, 1.3, 'encinaOsc'], [-1.2, 3.4, -0.5, 1.3, 'encinaOsc']]
      : [[0, 4.0, 0, 1.8, 'encina', [1.15, 0.8, 1.15]], [1.3, 3.5, 0.6, 1.25, 'encinaOsc'], [-1.25, 3.5, -0.55, 1.25, 'encinaOsc'], [0.2, 3.3, -1.3, 1.15, 'encina'], [-0.3, 3.4, 1.3, 1.1, 'encinaOsc']], s, s ? 0 : 1, 11);
  },
};

const cache = {};
// { abeto: { geo, mats }, pino: …, … }; sencillo: con menos caras, para los árboles de lejos
export function modelosEspecies({ sencillo = false } = {}) {
  const k = sencillo ? 's' : 'n';
  return (cache[k] ||= Object.fromEntries(ESPECIES.map(e => [e, modeloLote((L) => HACER[e](L, sencillo))])));
}
