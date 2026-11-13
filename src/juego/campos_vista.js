// Kinhold — cómo se ven los campos marcados con estacas (P11; la lógica, en src/logica/campos.js).
// Cada estaca, clavada de pie con un cuarto de su largo en la tierra; y el linde, una franja estrecha de tierra pisada
// que va de estaca en estaca pegada al suelo (y de la última a la primera cuando el campo está cerrado). Todo se rehace
// cuando cambia el mundo de construcción (main.js, reconstruir).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { estacaEn } from './modelos_objetos.js';
import { ladosDe } from '../logica/campos.js';

const HUNDIDA = 0.25;          // lo que va bajo tierra
const ANCHO_LINDE = 0.14;      // m
const SOBRE = 0.025;           // m sobre el suelo (para que no parpadee con él)
const COLOR_LINDE = new THREE.Color(0x5e4a36);
const MAT_LINDE = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

export function crearCamposVista({ escena, sueloEn }) {
  const raiz = new THREE.Group();
  raiz.name = 'campos';
  escena.add(raiz);
  const vaciar = () => { for (const h of raiz.children) h.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); raiz.clear(); };

  // la franja del linde de a a b, cada medio metro a la altura del suelo, con algo de variación de color
  function linde(a, b, geos) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 0.05) return;
    const n = Math.max(1, Math.ceil(L / 0.5)), nx = -(b.z - a.z) / L * ANCHO_LINDE / 2, nz = (b.x - a.x) / L * ANCHO_LINDE / 2;
    const pos = [], col = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      for (const s of [-1, 1]) {
        const px = x + nx * s, pz = z + nz * s;
        pos.push(px, sueloEn(px, pz) + SOBRE, pz);
        const v = 0.9 + 0.2 * (Math.sin(px * 7.1 + pz * 3.3) * 0.5 + 0.5);
        col.push(COLOR_LINDE.r * v, COLOR_LINDE.g * v, COLOR_LINDE.b * v);
      }
      if (k < n) { const i = k * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    geos.push(g);
  }

  // campos: los del mundo (Mundo.campos). Devuelve las mallas de las estacas, cada una con userData.estaca = { campo, i }.
  function poner(campos) {
    vaciar();
    const L = new Lote({ rangoSuelo: 0.3, variacion: 0.06 }), lindes = [];
    for (const c of campos || []) {
      c.puntos.forEach((p, i) => estacaEn(L, p.x, sueloEn(p.x, p.z) - HUNDIDA, p.z, { y: (i * 1.7 + c.id) % 6.28, x: 0.04, z: ((i * 0.37) % 0.1) - 0.05 }, `${c.id}:${i}`));
      for (const [a, b] of ladosDe(c)) linde(a, b, lindes);
    }
    for (const [tex, geos] of Object.entries(L.cerrar(null, true))) {
      const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; raiz.add(m);
    }
    if (lindes.length) { const m = new THREE.Mesh(mergeGeometries(lindes), MAT_LINDE); m.receiveShadow = true; raiz.add(m); }
  }
  return { poner, raiz };
}
