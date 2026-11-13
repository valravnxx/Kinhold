// Kinhold — cómo se ven los campos marcados con estacas (P11; la lógica, en src/logica/campos.js).
// Cada estaca, clavada de pie con un cuarto de su largo en la tierra; y el linde, una franja estrecha de tierra pisada
// que va de estaca en estaca pegada al suelo (y de la última a la primera cuando el campo está cerrado). Todo se rehace
// cuando cambia el mundo de construcción (main.js, reconstruir).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { estacaEn } from './modelos_objetos.js';
import { ladosDe } from '../logica/campos.js';

const ALTO_ESTACA = 1.15;      // m sobre el suelo: recias y altas, para que se vean entre la hierba
const GROSOR_ESTACA = 1.7;     // más gruesas que la de la mano (para leerlas de lejos como mojones de campo)
const HUNDIDA = 0.28;          // lo que va bajo tierra
const ALTO_CUERDA = 0.82;      // m: la cuerda de esparto atada de estaca en estaca marca el linde por encima de la hierba
const MAT_CUERDA = new THREE.MeshLambertMaterial({ color: 0xc9b483 });
const ANCHO_LINDE = 0.34;      // m: una banda de tierra pisada, bien visible (como los caminos de la referencia)
const SOBRE = 0.03;            // m sobre el suelo (para que no parpadee con él)
const COLOR_LINDE = new THREE.Color(0x9a8566);   // el pardo cálido del camino (src/mundo/estilos.js)
const MAT_LINDE = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

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
        const v = 0.92 + 0.12 * (Math.sin(px * 7.1 + pz * 3.3) * 0.5 + 0.5);   // poca variación: una banda continua de tierra pisada
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

  // la cuerda que va de una estaca a la otra, a ALTO_CUERDA del suelo, con algo de comba (la parte que se ve del linde
  // mientras el campo aún tiene hierba; luego, al limpiarlo, se ve también la banda de tierra pisada)
  function cuerda(a, b, geos) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 0.05) return;
    const n = Math.max(2, Math.ceil(L / 0.6)), pts = [];
    const ya = sueloEn(a.x, a.z) + ALTO_CUERDA, yb = sueloEn(b.x, b.z) + ALTO_CUERDA;
    for (let k = 0; k <= n; k++) {
      const t = k / n, comba = Math.sin(t * Math.PI) * Math.min(0.12, L * 0.03);
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, ya + (yb - ya) * t - comba, a.z + (b.z - a.z) * t));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.012, 4, false);
    geos.push(g);
  }

  // campos: los del mundo (Mundo.campos).
  function poner(campos) {
    vaciar();
    const L = new Lote({ rangoSuelo: 0.3, variacion: 0.06 }), lindes = [], cuerdas = [];
    for (const c of campos || []) {
      c.puntos.forEach((p, i) => estacaEn(L, p.x, sueloEn(p.x, p.z) - HUNDIDA, p.z, { y: (i * 1.7 + c.id) % 6.28, x: 0.04, z: ((i * 0.37) % 0.1) - 0.05 }, `${c.id}:${i}`, GROSOR_ESTACA, ALTO_ESTACA + HUNDIDA));
      for (const [a, b] of ladosDe(c)) { linde(a, b, lindes); cuerda(a, b, cuerdas); }
    }
    for (const [tex, geos] of Object.entries(L.cerrar(null, true))) {
      const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; raiz.add(m);
    }
    if (lindes.length) { const m = new THREE.Mesh(mergeGeometries(lindes), MAT_LINDE); m.receiveShadow = true; raiz.add(m); }
    if (cuerdas.length) { const m = new THREE.Mesh(mergeGeometries(cuerdas), MAT_CUERDA); m.castShadow = true; raiz.add(m); }
  }
  return { poner, raiz };
}
