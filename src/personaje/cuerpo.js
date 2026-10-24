// Kinhold — personaje humano listo para el juego.
// La forma sale de una escultura por campos de distancia (humano.js) que se hornea en mallas
// (herramientas/hornear_personaje.mjs → datos_humano.js). Aquí solo se monta la malla con su esqueleto.
// Dos niveles de detalle: 'cerca' (~14 mil triángulos) y 'lejos' (~3,5 mil).
import * as THREE from 'three';
import { HUMANO } from './datos_humano.js';

const deB64 = (s, Tipo) => { const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return new Tipo(b.buffer, b.byteOffset, b.byteLength / Tipo.BYTES_PER_ELEMENT); };
const P = { pelvis: HUMANO.huesos.find(h => h.nombre === 'pelvis').pos };

function geometria(nivel) {
  const L = HUMANO.niveles[nivel], { min, max } = HUMANO;
  const q = deB64(L.pos, Uint16Array), nq = deB64(L.nor, Int8Array);
  const pos = new Float32Array(q.length), nor = new Float32Array(nq.length);
  for (let i = 0; i < q.length; i++) { const e = i % 3; pos[i] = min[e] + q[i] / 65535 * (max[e] - min[e]); nor[i] = nq[i] / 127; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  // el color se hornea en sRGB; three trabaja en lineal
  const c8 = deB64(L.col, Uint8Array), col = new Float32Array(c8.length), k = new THREE.Color();
  for (let i = 0; i < c8.length; i += 3) { k.setRGB(c8[i] / 255, c8[i + 1] / 255, c8[i + 2] / 255, THREE.SRGBColorSpace); col[i] = k.r; col[i + 1] = k.g; col[i + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(deB64(L.hi, Uint8Array)), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(deB64(L.hw, Uint8Array), 4, true));
  g.setIndex(new THREE.BufferAttribute(deB64(L.ind, Uint16Array), 1));
  return g;
}

export function crearPersonaje({ nivel = 'cerca' } = {}) {
  const huesos = HUMANO.huesos.map(h => { const b = new THREE.Bone(); b.name = h.nombre; return b; });
  const H = Object.fromEntries(HUMANO.huesos.map((h, i) => [h.nombre, i]));
  HUMANO.huesos.forEach((h, i) => {
    const p = new THREE.Vector3(...h.pos);
    if (h.padre) { huesos[H[h.padre]].add(huesos[i]); p.sub(new THREE.Vector3(...HUMANO.huesos[H[h.padre]].pos)); }
    huesos[i].position.copy(p);
  });
  const malla = new THREE.SkinnedMesh(geometria(nivel), new THREE.MeshLambertMaterial({ vertexColors: true }));
  malla.castShadow = true; malla.receiveShadow = true;
  malla.add(huesos[H.pelvis]); malla.updateMatrixWorld(true);
  malla.bind(new THREE.Skeleton(huesos));
  malla.userData = { H, huesos, reposo: huesos.map(b => b.quaternion.clone()), nivel };
  return malla;
}
export const triangulos = (nivel) => HUMANO.niveles[nivel].triangulos;

// ---------- Animación: reposo (respira) y andar ----------
export function animar(malla, t, modo) {
  const { H, huesos, reposo } = malla.userData;
  huesos.forEach((b, i) => b.quaternion.copy(reposo[i]));
  const rot = (n, x = 0, y = 0, z = 0) => huesos[H[n]].quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
  const pelvis = huesos[H.pelvis];
  pelvis.position.y = P.pelvis[1];
  if (modo === 'andar') {
    const f = t * Math.PI * 2 * 0.9, a = Math.sin(f);
    rot('caderaI', -a * 0.42); rot('caderaD', a * 0.42);
    rot('rodillaI', Math.max(0, Math.sin(f + 1.2)) * 0.8); rot('rodillaD', Math.max(0, Math.sin(f + Math.PI + 1.2)) * 0.8);
    rot('tobilloI', -Math.max(0, -Math.sin(f - 0.4)) * 0.25); rot('tobilloD', -Math.max(0, Math.sin(f - 0.4)) * 0.25);
    rot('hombroI', a * 0.38); rot('hombroD', -a * 0.38);
    rot('codoI', -0.25 - Math.max(0, a) * 0.3); rot('codoD', -0.25 - Math.max(0, -a) * 0.3);
    rot('pelvis', 0, a * 0.08, 0); rot('pecho', 0, -a * 0.12, 0);
    pelvis.position.y = P.pelvis[1] - 0.02 + Math.abs(Math.cos(f)) * 0.025;
  } else {
    const r = Math.sin(t * 1.6);
    rot('pecho', r * 0.012); rot('cabeza', -r * 0.008, Math.sin(t * 0.4) * 0.12, 0);
    rot('hombroI', 0, 0, 0.04 + r * 0.01); rot('hombroD', 0, 0, -0.04 - r * 0.01);
    rot('codoI', -0.12); rot('codoD', -0.12);
  }
}
