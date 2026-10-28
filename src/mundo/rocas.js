// Kinhold — la roca de los cortados: piezas de roca 3D que se encajan en las paredes (como hacen los juegos sobre un
// terreno de alturas, que por sí solo no puede tener salientes ni grietas: bloques de roca «encajados» en la pared).
// Cada pieza sale de una esfera facetada que se ensancha, se escalona en estratos y se corta con planos al azar (así
// rompe la roca de verdad: en caras planas con aristas), con la sombra horneada en los vértices (más oscura en lo que
// mira abajo y en las juntas) y una textura de roca propia con vetas, grietas, grano y algo de liquen.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let tex = null;
export function texturaRoca() {
  if (tex) return tex;
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), r = azar(9137);
  const gris = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  const envolver = (fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  g.fillStyle = gris(196); g.fillRect(0, 0, N, N);
  // manchas grandes de tono (la roca no es de un color)
  for (let n = 0; n < 60; n++) { const x = r() * N, y = r() * N, rr = 30 + r() * 80, v = 165 + r() * 70; envolver(() => { const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, gris(v, 0.35)); gr.addColorStop(1, gris(v, 0)); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }); }
  // vetas de estrato: franjas horizontales onduladas, más claras y más oscuras
  for (let n = 0; n < 26; n++) { const y0 = r() * N, v = r() < 0.5 ? 155 + r() * 25 : 210 + r() * 25, w = 2 + r() * 9, f = r() * 6;
    envolver(() => { g.strokeStyle = gris(v, 0.3); g.lineWidth = w; g.beginPath(); for (let x = -10; x <= N + 10; x += 10) g.lineTo(x, y0 + Math.sin(x * 0.02 + f) * 6 + Math.sin(x * 0.07 + f) * 2); g.stroke(); }); }
  // grano fino
  for (let n = 0; n < 9000; n++) { const x = r() * N, y = r() * N, v = 110 + r() * 140; g.fillStyle = gris(v, 0.35); g.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5); }
  // grietas: oscuras con un labio claro a un lado (así parecen hundidas)
  for (let n = 0; n < 14; n++) {
    let x = r() * N, y = r() * N; const pts = [[x, y]]; const ang = (r() < 0.6 ? 1.57 : 0) + (r() - 0.5) * 0.9;
    for (let k = 0; k < 7; k++) { x += Math.cos(ang + (r() - 0.5) * 1.2) * (10 + r() * 22); y += Math.sin(ang + (r() - 0.5) * 1.2) * (10 + r() * 22); pts.push([x, y]); }
    const w = 0.7 + r() * 1.3;
    envolver(() => {
      g.strokeStyle = gris(225, 0.3); g.lineWidth = w * 1.4; g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a + 1.2, b + 1.2) : g.moveTo(a + 1.2, b + 1.2)); g.stroke();
      g.strokeStyle = gris(95, 0.55); g.lineWidth = w; g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke();
    });
  }
  // liquen: motas pequeñas, algo más claras
  for (let n = 0; n < 180; n++) { const x = r() * N, y = r() * N, rr = 2 + r() * 6; envolver(() => { g.fillStyle = gris(230, 0.25); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }); }
  tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

let mat = null;
export function materialRoca() {
  return (mat ||= new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, map: texturaRoca(), bumpMap: texturaRoca(), bumpScale: 1.6 }));
}

// una pieza de roca de pared: ancha, poco honda, en estratos y cortada en caras planas. Medidas: 1 de alto, ~1,6 de
// ancho, ~0,9 de hondo (se escala al ponerla). La cara de fuera mira a +z.
function pieza(semilla) {
  const r = azar(semilla * 7919 + 13);
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position, v = new THREE.Vector3();
  const planos = [];
  for (let k = 0; k < 7; k++) {
    const d = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5 + (k < 3 ? 0.5 : 0)).normalize();
    planos.push([d, 0.55 + r() * 0.3]);
  }
  const estrato = 0.22 + r() * 0.12, fase = r();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiply(new THREE.Vector3(1.6, 1, 0.9));
    // bultos
    const b = Math.sin(v.x * 3.1 + semilla) * Math.sin(v.y * 2.7 + semilla * 2) * Math.sin(v.z * 3.3) * 0.12;
    v.multiplyScalar(1 + b);
    // estratos: la altura tira hacia escalones (repisas y frentes)
    const u = v.y / estrato + fase, k = Math.floor(u), f = u - k;
    v.y = (k + 0.5 + Math.max(-0.5, Math.min(0.5, (f - 0.5) * 2.2)) * 0.9 - fase) * estrato * 0.9 + v.y * 0.1;
    // cortes: lo que sobresale de cada plano se aplana contra él
    for (const [d, o] of planos) { const s = v.dot(d); if (s > o) v.addScaledVector(d, o - s); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const plana = g.toNonIndexed(); plana.computeVertexNormals();
  // sombra horneada y UV por caja (cada cara proyecta la textura desde su eje dominante)
  const pp = plana.attributes.position, nn = plana.attributes.normal, n3 = pp.count;
  const col = new Float32Array(n3 * 3), uv = new Float32Array(n3 * 2), tono = 0.9 + r() * 0.2;
  for (let i = 0; i < n3; i += 3) {
    const nx = nn.getX(i), ny = nn.getY(i), nz = nn.getZ(i), ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    for (let j = i; j < i + 3; j++) {
      const x = pp.getX(j), y = pp.getY(j), z = pp.getZ(j);
      // más oscuro lo que mira abajo y lo de abajo y lo de atrás (las juntas con la pared); algo más claro arriba
      let k = (0.62 + 0.38 * (ny * 0.5 + 0.5)) * (0.7 + 0.3 * Math.min(1, (y + 1) / 1.4)) * (0.72 + 0.28 * Math.min(1, (z + 0.9) / 1.2)) * tono;
      col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k;
      const [a, c2] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
      uv[j * 2] = a * 0.45 + semilla * 0.37; uv[j * 2 + 1] = c2 * 0.45;
    }
  }
  plana.setAttribute('color', new THREE.BufferAttribute(col, 3));
  plana.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return plana;
}

let piezas = null;
export function modelosRocaPared() { return (piezas ||= [1, 2, 3, 4, 5].map(pieza)); }
