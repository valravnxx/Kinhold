// Kinhold — personaje de las pruebas de estilo: hombre de 1,76 m con camisa de lino, túnica de lana,
// calzas, vendas en las piernas y zapatos de cuero. Proporciones humanas (cabeza ≈ 1/7,6 de la altura).
// Articulado (hombro, codo, muñeca, cadera, rodilla, cuello) para poder animarlo después.
// Todas las medidas en P para ajustarlas cambiando números.
import * as THREE from 'three';
import { material, lados } from './estilos.js';

export const P = {
  altura: 1.76,
  cadera: 0.90, separacionCaderas: 0.095, rodilla: 0.50, tobillo: 0.08,
  hombro: 1.43, anchoHombros: 0.19, codo: 0.29, antebrazo: 0.25,
  cuello: 1.49, centroCabeza: 1.655, radioCabeza: 0.1,
  bajoTunica: 0.62, escalaFondo: 0.6,
  colores: { piel: 'piel', pelo: 'pelo', tunica: 'lanaVerde', camisa: 'lino', calzas: 'lana', cinto: 'cuero', zapatos: 'cueroOsc', vendas: 'linoOsc' },
};

export function crearPersonaje(estilo) {
  const C = P.colores;
  const M = (clave, extra) => material(estilo, clave, extra);
  const seg = (a, b, c) => lados(estilo, a, b, c);
  const malla = (geo, clave, x = 0, y = 0, z = 0, extra) => {
    const m = new THREE.Mesh(geo, M(clave, extra)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
  };
  // cilindro vertical que cuelga desde y=0 hacia abajo
  const tramo = (r1, r2, largo, clave, s = seg(6, 10, 14)) => {
    const g = new THREE.CylinderGeometry(r1, r2, largo, s); g.translate(0, -largo / 2, 0); return malla(g, clave);
  };
  const esfera = (r, clave, sx = 1, sy = 1, sz = 1, s = seg(6, 12, 18)) => {
    const g = new THREE.SphereGeometry(r, s, Math.max(4, Math.round(s * 0.75))); g.scale(sx, sy, sz); return malla(g, clave);
  };

  const g = new THREE.Group();
  const art = {};

  // ---- Túnica (torno con perfil) y camisa en el cuello ----
  const perfil = [[0.255, P.bajoTunica], [0.225, 0.80], [0.188, 0.95], [0.172, 1.05], [0.186, 1.18], [0.206, 1.30], [0.214, 1.39], [0.19, 1.455], [0.12, 1.495], [0.075, 1.505]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tunica = new THREE.LatheGeometry(perfil, seg(8, 14, 22));
  tunica.scale(1, 1, P.escalaFondo);
  g.add(malla(tunica, C.tunica, 0, 0, 0, { side: THREE.DoubleSide }));
  // cuello de la camisa de lino que asoma
  const cuelloCamisa = new THREE.CylinderGeometry(0.062, 0.078, 0.05, seg(6, 10, 14), 1, true);
  g.add(malla(cuelloCamisa, C.camisa, 0, 1.51, 0.004, { side: THREE.DoubleSide }));
  // cinto con hebilla y bolsa
  const cinto = new THREE.CylinderGeometry(0.176, 0.176, 0.045, seg(8, 14, 22), 1, true); cinto.scale(1, 1, P.escalaFondo + 0.02);
  g.add(malla(cinto, C.cinto, 0, 1.035, 0, { side: THREE.DoubleSide }));
  g.add(malla(new THREE.BoxGeometry(0.04, 0.035, 0.012), 'hierro', 0, 1.035, 0.108));
  if (estilo.detalle >= 1) {
    g.add(malla(new THREE.BoxGeometry(0.012, 0.11, 0.008), C.cinto, 0.012, 0.975, 0.11)); // punta del cinto colgando
    const bolsa = esfera(0.05, 'cuero', 0.55, 1, 0.9, seg(5, 8, 10)); bolsa.position.set(0.17, 0.96, 0.05); g.add(bolsa);
  }

  // ---- Piernas: cadera → rodilla → tobillo ----
  art.piernas = [];
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group(); cadera.position.set(lado * P.separacionCaderas, P.cadera, 0);
    const muslo = tramo(0.074, 0.054, P.cadera - P.rodilla, C.calzas); cadera.add(muslo);
    const rodilla = new THREE.Group(); rodilla.position.y = -(P.cadera - P.rodilla); cadera.add(rodilla);
    rodilla.add(esfera(0.054, C.calzas));
    rodilla.add(tramo(0.052, 0.04, P.rodilla - P.tobillo, C.calzas));
    if (estilo.detalle >= 1) { // vendas de lino en espiral (winingas) en la espinilla
      for (let n = 0; n < (estilo.detalle === 2 ? 6 : 4); n++) {
        const y = -0.08 - n * 0.055, r = 0.053 - n * 0.002;
        const anillo = new THREE.CylinderGeometry(r, r + 0.002, 0.03, seg(6, 10, 14), 1, true);
        const v = malla(anillo, C.vendas, 0, y, 0, { side: THREE.DoubleSide }); v.rotation.z = 0.12 * (n % 2 ? 1 : -1); rodilla.add(v);
      }
    }
    // zapato de cuero (de una pieza, sin tacón)
    const tobillo = new THREE.Group(); tobillo.position.y = -(P.rodilla - P.tobillo); rodilla.add(tobillo);
    tobillo.add(tramo(0.044, 0.05, 0.05, C.zapatos));
    const pie = esfera(0.05, C.zapatos, 0.95, 0.75, 2.4, seg(6, 10, 14)); pie.position.set(0, -0.045, 0.055); tobillo.add(pie);
    pie.userData.alturaSuelo = 0;
    g.add(cadera);
    art.piernas.push({ cadera, rodilla, tobillo });
  }

  // ---- Brazos: hombro → codo → muñeca → mano ----
  art.brazos = [];
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group(); hombro.position.set(lado * P.anchoHombros, P.hombro, 0);
    { const h = esfera(0.058, C.tunica, 1, 0.9, 0.95); h.position.set(-lado * 0.012, -0.01, 0); hombro.add(h); }
    hombro.add(tramo(0.062, 0.05, P.codo, C.tunica));
    const codo = new THREE.Group(); codo.position.y = -P.codo; hombro.add(codo);
    codo.add(esfera(0.05, C.tunica));
    codo.add(tramo(0.049, 0.04, P.antebrazo - 0.04, C.tunica));
    // puño de la camisa que asoma
    const punio = tramo(0.041, 0.038, 0.04, C.camisa); punio.position.y = -(P.antebrazo - 0.04); codo.add(punio);
    const muneca = new THREE.Group(); muneca.position.y = -P.antebrazo; codo.add(muneca);
    muneca.add(mano(lado));
    hombro.rotation.z = lado * 0.07; codo.rotation.x = -0.18; muneca.rotation.z = -lado * 0.05;
    g.add(hombro);
    art.brazos.push({ hombro, codo, muneca });
  }
  function mano(lado) {
    const m = new THREE.Group();
    m.add(tramo(0.034, 0.036, 0.02, C.piel, seg(6, 8, 10))); // muñeca
    const palma = new THREE.BoxGeometry(0.03, 0.085, 0.075, 2, 3, 3); palma.translate(0, -0.06, 0.004);
    if (estilo.sombreado !== 'plano') redondear(palma, 0.6);
    m.add(malla(palma, C.piel));
    if (estilo.detalle === 0) {
      const dedos = new THREE.BoxGeometry(0.026, 0.07, 0.07); dedos.translate(0, -0.135, 0.008); m.add(malla(dedos, C.piel));
    } else {
      for (let d = 0; d < 4; d++) { // cuatro dedos un poco doblados
        const z = 0.031 - d * 0.02, largo = [0.068, 0.076, 0.072, 0.058][d];
        const dedo = new THREE.Group(); dedo.position.set(0, -0.1, z);
        const f1 = tramo(0.0095, 0.0085, largo * 0.55, C.piel, seg(4, 6, 8)); dedo.add(f1);
        const f2 = tramo(0.0085, 0.007, largo * 0.45, C.piel, seg(4, 6, 8)); f2.position.y = -largo * 0.55; f2.rotation.x = 0.35; dedo.add(f2);
        dedo.rotation.x = 0.25; m.add(dedo);
      }
    }
    const pulgar = tramo(0.012, 0.009, 0.06, C.piel, seg(4, 6, 8)); pulgar.position.set(-lado * 0.004, -0.04, 0.04); pulgar.rotation.set(0.7, 0, -lado * 0.25); m.add(pulgar);
    return m;
  }

  // ---- Cuello y cabeza ----
  const cuello = new THREE.Group(); cuello.position.y = P.cuello; g.add(cuello);
  const cil = new THREE.CylinderGeometry(0.048, 0.054, 0.11, seg(6, 10, 14)); cil.translate(0, 0.055, 0);
  cuello.add(malla(cil, C.piel));
  const cabeza = new THREE.Group(); cabeza.position.y = P.centroCabeza - P.cuello; cuello.add(cabeza);
  art.cuello = cuello; art.cabeza = cabeza;
  const R = P.radioCabeza;
  const craneo = esfera(R, C.piel, 0.92, 1.1, 1.02, seg(8, 16, 24)); cabeza.add(craneo);
  const mandibula = esfera(0.075, C.piel, 1, 0.78, 1, seg(6, 12, 18)); mandibula.position.set(0, -0.055, 0.022); cabeza.add(mandibula);
  // nariz
  const nariz = new THREE.ConeGeometry(0.017, 0.05, seg(3, 5, 6)); nariz.rotateX(Math.PI / 2 + 0.5); nariz.scale(1, 1, 0.9);
  const nz = malla(nariz, C.piel, 0, -0.008, 0.103); cabeza.add(nz);
  // ojos: blanco, iris y ceja
  for (const lado of [-1, 1]) {
    const blanco = esfera(0.0115, 'blancoOjo', 1.35, 0.6, 0.6, seg(5, 8, 10)); blanco.position.set(lado * 0.036, 0.016, 0.0885); cabeza.add(blanco);
    const parpado = esfera(0.0125, C.piel, 1.4, 0.55, 0.65, seg(5, 8, 10)); parpado.position.set(lado * 0.036, 0.0215, 0.0885); cabeza.add(parpado);
    const iris = esfera(0.0058, 'ojo', 1, 1, 0.5, seg(4, 6, 8)); iris.position.set(lado * 0.036, 0.0155, 0.0945); cabeza.add(iris);
    const ceja = new THREE.BoxGeometry(0.036, 0.0065, 0.012); const c = malla(ceja, C.pelo, lado * 0.037, 0.038, 0.097); c.rotation.z = -lado * 0.12; cabeza.add(c);
    const oreja = esfera(0.026, C.piel, 0.4, 1, 0.7, seg(5, 8, 10)); oreja.position.set(lado * 0.093, -0.002, -0.004); cabeza.add(oreja);
  }
  const boca = new THREE.BoxGeometry(0.032, 0.005, 0.01); cabeza.add(malla(boca, 'labio', 0, -0.05, 0.097));
  // pelo: casquete que cubre arriba y atrás
  const pelo = new THREE.SphereGeometry(R * 1.05, seg(8, 16, 24), seg(6, 10, 14), 0, Math.PI * 2, 0, 1.78);
  pelo.rotateX(-0.72); pelo.scale(0.93, 1.1, 1.03);
  const pm = malla(pelo, C.pelo, 0, 0.012, -0.004); cabeza.add(pm);
  // barba corta y bigote
  const barba = new THREE.SphereGeometry(0.075 * 1.1, seg(8, 14, 20), seg(5, 8, 12), -0.25, Math.PI + 0.5, 1.72, Math.PI - 1.72);
  barba.scale(1, 0.85, 1);
  const b = malla(barba, C.pelo, 0, -0.058, 0.02); cabeza.add(b);
  const bigote = new THREE.BoxGeometry(0.048, 0.011, 0.014); const bg = malla(bigote, C.pelo, 0, -0.039, 0.099); cabeza.add(bg);

  g.userData.articulaciones = art;
  return g;
}

// Acerca los vértices de una caja a una esfera para redondear cantos (t = 0 caja, 1 esfera)
function redondear(geo, t) {
  geo.computeBoundingBox();
  const c = new THREE.Vector3(); geo.boundingBox.getCenter(c);
  const s = new THREE.Vector3(); geo.boundingBox.getSize(s);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(c).divide(s).multiplyScalar(2); // -1..1
    const len = v.length() || 1, e = v.clone().divideScalar(len).multiplyScalar(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)));
    v.lerp(e, t).multiplyScalar(0.5).multiply(s).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
}
