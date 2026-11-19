// Kinhold — el castillo del rey en el mundo: su malla y sus choques (src/logica/castillo_rey.js), que se cargan cuando
// el jugador se acerca (a 900 m) y no antes: son unos 2 MB.
//
// La malla va en docs/recursos/mundo/castillo-rey-v2/castillo.bin.gz (gzip): «KCR2», el número de vértices (uint32),
// la escala (float32, 0,002 m), el número de materiales (uint32) y, por cada uno, su nombre (uint8 de largo + letras) y
// sus vértices (uint32); luego, por vértice y en ese orden: la posición (int16 × 3, en pasos de la escala: x y z desde ORIGEN_CASTILLO, y la
// altura del mundo), el color (uint8 × 3), la UV (int16 × 2, en centímetros de pared o de suelo), la altura sobre su
// suelo (uint8, en decímetros) y la normal de su cara (int8 × 3, ×127). Cada material lleva su textura de color y de relieve (tex/, de herramientas/castillo_rey/
// texturas.py), repetida cada TAM metros, con la luz del estilo v5 (Lambert, color por vértice). Y el desgaste por
// píxel: humedad y verdín al pie de los muros (con la altura sobre el suelo), regueros, y musgo en lo que mira arriba.
//
// Bajo techo (un suelo, una bóveda o un tejado del castillo a más de 2 m sobre los pies), el castillo se corta (el
// corte por plantas) a 2,3 m sobre los pies o más bajo si el techo lo está: se ve la planta en la que estás, como en los
// interiores de lo construido, y la cámara mira desde arriba.
import * as THREE from 'three';
import { crearChoquesCastillo, ORIGEN_CASTILLO } from '../logica/castillo_rey.js';

export const CARPETA_CASTILLO = 'recursos/mundo/castillo-rey-v2/';
// metros que cubre cada textura (u, v), cuánto relieve y cuánto musgo coge (0: nada)
const MATS = {
  sillar: { tam: [3.2, 1.6], relieve: 1.2, musgo: 1 }, mamp: { tam: [5, 2.5], relieve: 1.3, musgo: 1 }, piedra: { tam: [1, 1], relieve: 1.3, musgo: 0.55 },
  losa: { tam: [3, 3], relieve: 1.0, musgo: 0.7 }, canto: { tam: [2, 2], relieve: 0.7, musgo: 0.6 }, tierra: { tam: [4, 4], relieve: 0.6, musgo: 0.3 },
  madera: { tam: [2, 2], relieve: 0.7, musgo: 0.2 }, tabla: { tam: [2, 2], relieve: 0.8, musgo: 0 }, teja: { tam: [2, 1], relieve: 1.2, musgo: 0.5 },
  paja: { tam: [1, 1], relieve: 1.0, musgo: 0.2 }, tela: { tam: [0.5, 0.5], relieve: 1.0, musgo: 0 }, liso: { tam: null, relieve: 0, musgo: 0 },
};
// el desgaste, en el sombreador de cada material (ruido de valor 3D en el mundo)
const RUIDO_GLSL = `
float kh_h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float kh_ruido(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(kh_h(i), kh_h(i + vec3(1,0,0)), f.x), mix(kh_h(i + vec3(0,1,0)), kh_h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(kh_h(i + vec3(0,0,1)), kh_h(i + vec3(1,0,1)), f.x), mix(kh_h(i + vec3(0,1,1)), kh_h(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
const CORTADO = { value: 0 };   // 1 mientras el castillo está cortado por plantas
function desgaste(mat, musgo) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMusgo = { value: musgo };
    sh.uniforms.uCortado = CORTADO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float hs;\nvarying float vHs;\nvarying vec3 vMundo;\nvarying vec3 vNorM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHs = hs / 10.0;\nvMundo = (modelMatrix * vec4(position, 1.0)).xyz;\nvNorM = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMusgo;\nuniform float uCortado;\nvarying float vHs;\nvarying vec3 vMundo;\nvarying vec3 vNorM;\n' + RUIDO_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float n1 = kh_ruido(vMundo * 1.7), n2 = kh_ruido(vMundo * 0.33), n3 = kh_ruido(vMundo * 4.1);
          // tono a gran escala (manchas de sol y lluvia) y regueros verticales
          diffuseColor.rgb *= 0.9 + 0.2 * n2;
          // y a escala de muro entero (10–20 m): paños más limpios y más sucios, que rompen la repetición de lejos
          float n4 = kh_ruido(vMundo * 0.065 + vec3(3.1, 0.0, 7.7));
          diffuseColor.rgb *= 0.84 + 0.3 * n4;
          float reg = kh_ruido(vec3(vMundo.x * 2.3 + vMundo.z * 1.7, vMundo.y * 0.12, vMundo.z * 2.3 - vMundo.x * 1.1));
          diffuseColor.rgb *= 1.0 - 0.16 * smoothstep(0.62, 0.92, reg) * step(abs(vNorM.y), 0.6);
          // humedad y verdín al pie (hasta ~2 m, a manchas)
          float pie = smoothstep(3.2, 0.0, vHs + (n1 - 0.5) * 1.4 + (n4 - 0.5) * 1.5);
          diffuseColor.rgb *= mix(1.0, 0.62, pie);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.31, 0.17), uMusgo * pie * 0.7 * smoothstep(0.25, 0.65, n2 + n3 * 0.3));
          // musgo en lo que mira arriba (albardillas, cornisas, tejados, peldaños de fuera)
          float arriba = smoothstep(0.55, 0.95, vNorM.y) * smoothstep(0.62, 0.92, n2 * 0.6 + n1 * 0.4 + n3 * 0.2);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.35, 0.18) * (0.8 + 0.4 * n3), uMusgo * arriba * 0.5);
          // cortado por plantas: lo de dentro de los muros (sus caras de detrás) se ve como la sección, oscuro y liso
          if (uCortado > 0.5 && !gl_FrontFacing) diffuseColor.rgb *= 0.5;
        }`);
  };
  mat.customProgramCacheKey = () => 'castillo_rey_' + musgo;
}

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
      if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'KCR2') throw new Error('formato');
      const n = dv.getUint32(4, true), esc = dv.getFloat32(8, true), nm = dv.getUint32(12, true);
      let o = 16; const grupos = [];
      for (let k = 0; k < nm; k++) {
        const l = buf[o]; const nombre = String.fromCharCode(...buf.subarray(o + 1, o + 1 + l)); o += 1 + l;
        grupos.push({ nombre, cuenta: dv.getUint32(o, true) }); o += 4;
      }
      const copia = (bytes) => { const r = buf.slice(o, o + bytes); o += bytes; return r.buffer; };
      const q = new Int16Array(copia(n * 6)), c8 = new Uint8Array(copia(n * 3)), uq = new Int16Array(copia(n * 4)), hs = new Uint8Array(copia(n)), n8 = new Int8Array(copia(n * 3));
      const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      const nor = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) { pos[i] = q[i] * esc; colr[i] = c8[i] / 255; nor[i] = n8[i] / 127; }
      for (let i = 0; i < n * 2; i++) uv[i] = uq[i] * 0.01;
      // dos mallas: lo que levanta (echa sombra) y los suelos planos (tierra, cantos, losas), que no la echan: un plano que
      // se sombrea a sí mismo sale con rayas
      const SUELOS = new Set(['tierra', 'canto', 'losa']);
      const carga = new THREE.TextureLoader();
      const tex = (nombre, color, [tu, tv]) => {
        const t = carga.load(base + CARPETA_CASTILLO + 'tex/' + nombre + '.webp');
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tu, 1 / tv); t.anisotropy = 4;
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      const material = (nombre) => {
        const d = MATS[nombre] || MATS.liso;
        // (shadowSide: las caras de detrás echan la sombra; si no, las de delante se sombrean a sí mismas en rayas)
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.BackSide, clippingPlanes: [corte] });
        if (d.tam) {
          mat.map = tex(nombre, true, d.tam);
          mat.normalMap = tex(nombre + '_n', false, d.tam); mat.normalScale.set(d.relieve, d.relieve);
        }
        desgaste(mat, d.musgo);
        return mat;
      };
      let ini = 0; const rangos = grupos.map(gr => { const r = { ...gr, ini }; ini += gr.cuenta; return r; });
      // lo liso (hierro, brasas, lo oscuro) no lleva textura que module su color: el suyo va en sRGB, como se pintó
      for (const r of rangos) if (r.nombre === 'liso') for (let i = r.ini * 3; i < (r.ini + r.cuenta) * 3; i++) colr[i] = Math.pow(colr[i], 2.2);
      const hacer = (lista) => {
        const n2 = lista.reduce((t, r) => t + r.cuenta, 0);
        const P = new Float32Array(n2 * 3), C = new Float32Array(n2 * 3), U = new Float32Array(n2 * 2), H = new Uint8Array(n2), N = new Float32Array(n2 * 3);
        const g = new THREE.BufferGeometry(), mats = []; let o2 = 0;
        for (const [k, r] of lista.entries()) {
          P.set(pos.subarray(r.ini * 3, (r.ini + r.cuenta) * 3), o2 * 3); C.set(colr.subarray(r.ini * 3, (r.ini + r.cuenta) * 3), o2 * 3);
          U.set(uv.subarray(r.ini * 2, (r.ini + r.cuenta) * 2), o2 * 2); H.set(hs.subarray(r.ini, r.ini + r.cuenta), o2);
          N.set(nor.subarray(r.ini * 3, (r.ini + r.cuenta) * 3), o2 * 3);
          g.addGroup(o2, r.cuenta, k); mats.push(material(r.nombre)); o2 += r.cuenta;
        }
        g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('hs', new THREE.BufferAttribute(H, 1));
        g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.computeBoundingSphere();
        const me = new THREE.Mesh(g, mats); me.position.set(dx, -y0, dz); me.receiveShadow = true;
        return me;
      };
      malla = new THREE.Group(); malla.name = 'castillo_rey';
      const obra = hacer(rangos.filter(r => !SUELOS.has(r.nombre))); obra.castShadow = true; malla.add(obra);
      const suelos = rangos.filter(r => SUELOS.has(r.nombre));
      if (suelos.length) { const ms = hacer(suelos); ms.castShadow = false; malla.add(ms); }
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
    CORTADO.value = t === null ? 0 : 1;
    return choques;
  }
  // (window.__mutarCastillo: solo para romper a propósito su prueba: el castillo se ve pero no se pisa ni para el paso)
  const sin = () => typeof window !== 'undefined' && window.__mutarCastillo;
  return { paso, get choques() { return sin() ? null : choques; }, get malla() { return malla; }, get corte() { return corte.constant < 1e5 ? corte.constant : null; }, get estado() { return estado; } };
}
