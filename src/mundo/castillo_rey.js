// Kinhold — el castillo del rey en el mundo: su malla y sus choques (src/logica/castillo_rey.js), que se cargan cuando
// el jugador se acerca (a 900 m) y no antes: son unos 2 MB.
//
// La malla va en docs/recursos/mundo/castillo-rey-v1/castillo.bin.gz: «KCR1», el número de vértices (uint32), la
// escala (float32, 0,01 m), las posiciones (int16 × 3: x y z desde ORIGEN_CASTILLO, y la altura del mundo) y los
// colores (uint8 × 3), todo comprimido con gzip. Se dibuja con colores por vértice y sombreado plano, como la maqueta.
//
// Bajo techo (un suelo, una bóveda o un tejado del castillo a más de 2 m sobre los pies), el castillo se corta (el
// corte por plantas) a 2,3 m sobre los pies o más bajo si el techo lo está: se ve la planta en la que estás, como en los
// interiores de lo construido, y la cámara mira desde arriba.
import * as THREE from 'three';
import { crearChoquesCastillo, ORIGEN_CASTILLO } from '../logica/castillo_rey.js';

export const CARPETA_CASTILLO = 'recursos/mundo/castillo-rey-v1/';
const CERCA = 900;   // m: a esta distancia se carga

// escena, origen: el sitio de salida (el 0 de la escena, en el mundo), y0: la altura de ese sitio; base: la dirección
// donde están los recursos (la de la página)
export function crearCastilloRey({ escena, origen, y0, base = '' }) {
  const dx = ORIGEN_CASTILLO.x - origen.x, dz = ORIGEN_CASTILLO.z - origen.z;
  let estado = 'lejos', malla = null, choques = null;
  const corte = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  async function cargar() {
    estado = 'cargando';
    try {
      const [bin, col] = await Promise.all([
        fetch(base + CARPETA_CASTILLO + 'castillo.bin.gz').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
        fetch(base + CARPETA_CASTILLO + 'colision.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      ]);
      let buf = new Uint8Array(bin);
      if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'KCR1') throw new Error('formato');
      const n = dv.getUint32(4, true), esc = dv.getFloat32(8, true);
      const q = new Int16Array(buf.buffer.slice(buf.byteOffset + 12, buf.byteOffset + 12 + n * 6));
      const c8 = new Uint8Array(buf.buffer, buf.byteOffset + 12 + n * 6, n * 3);
      const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) { pos[i] = q[i] * esc; colr[i] = c8[i] / 255; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, shadowSide: THREE.BackSide, flatShading: true, clippingPlanes: [corte] });
      malla = new THREE.Mesh(g, mat);
      malla.name = 'castillo_rey'; malla.castShadow = true; malla.receiveShadow = true;
      malla.position.set(dx, -y0, dz);
      escena.add(malla);
      choques = crearChoquesCastillo(col, { dx: origen.x - ORIGEN_CASTILLO.x, dz: origen.z - ORIGEN_CASTILLO.z, dy: y0 });
      estado = 'listo';
    } catch (e) {
      console.warn('[castillo] no se ha podido cargar:', e);
      estado = 'fallo';
    }
  }
  // cada fotograma: carga al acercarse y corta bajo techo. Devuelve los choques (o null si aún no están).
  function paso(pj) {
    if (estado === 'lejos' && Math.hypot(pj.x - dx, pj.z - dz) < CERCA) cargar();
    if (!choques || sin()) return null;
    const t = choques.techo(pj.x, pj.z, pj.y);
    // (el plano mira hacia abajo: se ve lo que queda por debajo). Bajo techo se corta a 2,3 m sobre los pies como mucho:
    // los muros bajos dejan ver al personaje desde arriba aunque esté junto a un muro grueso
    corte.constant = t === null ? 1e6 : Math.min(t - 0.05, pj.y + 2.3);
    return choques;
  }
  // (window.__mutarCastillo: solo para romper a propósito su prueba: el castillo se ve pero no se pisa ni para el paso)
  const sin = () => typeof window !== 'undefined' && window.__mutarCastillo;
  return { paso, get choques() { return sin() ? null : choques; }, get malla() { return malla; }, get corte() { return corte.constant < 1e5 ? corte.constant : null; }, get estado() { return estado; } };
}
