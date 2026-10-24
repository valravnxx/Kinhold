// Kinhold — personaje por código (hito 1b), estilo «realismo en miniatura».
// Cómo se hace, para que no parezca un muñeco de piezas:
//  - Cada parte (torso con túnica, brazos con mangas, piernas con calzas, cuello, manos, zapatos)
//    es un tubo hecho por SECCIONES: anillos con forma (elipses algo cuadradas) a lo largo del hueso,
//    con el perfil de un cuerpo real (pantorrilla, rodilla, cintura, pecho). Sin juntas de bola.
//  - La cabeza es una esfera MOLDEADA: mandíbula, mentón, ceja, cuencas, pómulos, nariz y boca
//    salen de deformarla. Pelo y barba son una capa encima, recortada con su forma.
//  - Todo es UNA malla con esqueleto (SkinnedMesh): cada vértice sigue a su hueso y se mezcla con el
//    vecino cerca de la articulación, así codos, rodillas y cadera se doblan sin abrirse.
//  - Color en los vértices (ropa, piel, labios, cejas, vendas), sombra de contacto horneada.
// Todas las medidas en P: se ajusta cambiando números.
import * as THREE from 'three';

export const P = {
  // articulaciones en posición de reposo (metros; mira hacia +z)
  pelvis: [0, 0.95, 0], columna: [0, 1.1, 0], pecho: [0, 1.3, 0], cuello: [0, 1.49, -0.005], cabeza: [0, 1.6, 0.005],
  hombro: [0.172, 1.415, -0.01], codo: [0.2, 1.14, -0.03], muneca: [0.214, 0.9, 0.0], manoFin: [0.218, 0.735, 0.012],
  cadera: [0.093, 0.92, 0.0], rodilla: [0.103, 0.5, 0.012], tobillo: [0.108, 0.085, -0.012], punta: [0.112, 0.02, 0.15],
  centroCabeza: [0, 1.655, 0.012], cabezaRadios: [0.077, 0.116, 0.097],
  colores: {
    piel: 0xb98f74, labio: 0x9a675a, pelo: 0x3b2a1d, ceja: 0x34261a,
    tunica: 0x5f6a48, tunicaBorde: 0x4f593b, camisa: 0xcbbf9f, calzas: 0x5d5045, vendas: 0x8e8368,
    cinto: 0x4a3324, hebilla: 0x6e6a60, zapato: 0x3d2a1d, ojo: 0x3a2a1c, blancoOjo: 0xd9d2c4,
  },
};

const V = (a) => new THREE.Vector3(...a);
const espejo = (a) => [-a[0], a[1], a[2]];

// ---------- Acumulador de la malla con pesos de huesos ----------
class Malla {
  constructor() { this.pos = []; this.col = []; this.idx = []; this.hueso = []; this.peso = []; }
  vertice(p, color, huesos) { // huesos: [[índice, peso], ...] (hasta 4)
    this.pos.push(p.x, p.y, p.z); this.col.push(color.r, color.g, color.b);
    const h = [0, 0, 0, 0], w = [0, 0, 0, 0];
    huesos.slice(0, 4).forEach(([i, k], j) => { h[j] = i; w[j] = k; });
    const s = w[0] + w[1] + w[2] + w[3] || 1;
    this.hueso.push(...h); this.peso.push(w[0] / s, w[1] / s, w[2] / s, w[3] / s);
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.hueso, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.peso, 4));
    g.setIndex(this.idx); g.computeVertexNormals();
    return g;
  }
}

// Tubo por secciones a lo largo de una línea de puntos.
// secciones: [{ c: centro (Vector3), a: semiancho, b: semifondo, dz: adelanto, color, huesos, forma }]
// 'forma' > 2 hace la sección más cuadrada (superelipse). El marco de cada anillo se orienta al tubo.
function tubo(M, secciones, lados, { tapaIni = false, tapaFin = false, lateral = new THREE.Vector3(1, 0, 0) } = {}) {
  const anillos = [];
  for (let s = 0; s < secciones.length; s++) {
    const S = secciones[s];
    const ant = secciones[Math.max(0, s - 1)].c, sig = secciones[Math.min(secciones.length - 1, s + 1)].c;
    const eje = sig.clone().sub(ant).normalize();
    const x = lateral.clone().sub(eje.clone().multiplyScalar(lateral.dot(eje))).normalize();
    const z = new THREE.Vector3().crossVectors(x, eje).normalize();
    const forma = S.forma ?? 2, anillo = [];
    for (let i = 0; i < lados; i++) {
      const t = i / lados * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      const ex = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / forma), ez = Math.sign(st) * Math.pow(Math.abs(st), 2 / forma);
      const delante = ez > 0 ? (S.delante ?? 1) : (S.detras ?? 1); // pecho o nalgas más marcados
      const pl = 1 + (S.pliegues ?? 0) * Math.sin(t * 7 + 0.5); // pliegues de la tela
      const p = S.c.clone().addScaledVector(x, ex * S.a * pl).addScaledVector(z, (ez * S.b * delante) * pl + (S.dz ?? 0));
      const color = typeof S.color === 'function' ? S.color(t, p) : S.color;
      anillo.push(M.vertice(p, color, S.huesos));
    }
    anillos.push(anillo);
  }
  for (let s = 0; s < anillos.length - 1; s++) for (let i = 0; i < lados; i++) {
    const a = anillos[s][i], b = anillos[s][(i + 1) % lados], c = anillos[s + 1][i], d = anillos[s + 1][(i + 1) % lados];
    M.tri(a, c, b); M.tri(b, c, d);
  }
  const tapa = (anillo, S, fin) => {
    const centro = M.vertice(S.c.clone().add(S.tapaSale ?? new THREE.Vector3()), S.colorTapa ?? (typeof S.color === 'function' ? S.color(0, S.c) : S.color), S.huesos);
    for (let i = 0; i < lados; i++) { const a = anillo[i], b = anillo[(i + 1) % lados]; fin ? M.tri(a, b, centro) : M.tri(b, a, centro); }
  };
  if (tapaIni) tapa(anillos[0], secciones[0], false);
  if (tapaFin) tapa(anillos[anillos.length - 1], secciones[secciones.length - 1], true);
}

// pesos que mezclan dos huesos según la posición t (0..1) en el tramo
const mezcla = (h0, h1, t, desde = 0.75) => (t < desde ? [[h0, 1]] : [[h0, 1 - (t - desde) / (1 - desde) * 0.5], [h1, (t - desde) / (1 - desde) * 0.5]]);

export function crearPersonaje(op = {}) {
  const C = Object.fromEntries(Object.entries(P.colores).map(([k, v]) => [k, new THREE.Color(v)]));
  const M = new Malla();
  // ---------- Esqueleto ----------
  const nombres = ['pelvis', 'columna', 'pecho', 'cuello', 'cabeza',
    'hombroI', 'codoI', 'munecaI', 'hombroD', 'codoD', 'munecaD',
    'caderaI', 'rodillaI', 'tobilloI', 'caderaD', 'rodillaD', 'tobilloD'];
  const H = Object.fromEntries(nombres.map((n, i) => [n, i]));
  // lado I = izquierda del personaje = +x (mira hacia +z)
  const posicion = {
    pelvis: P.pelvis, columna: P.columna, pecho: P.pecho, cuello: P.cuello, cabeza: P.cabeza,
    hombroI: P.hombro, codoI: P.codo, munecaI: P.muneca, hombroD: espejo(P.hombro), codoD: espejo(P.codo), munecaD: espejo(P.muneca),
    caderaI: P.cadera, rodillaI: P.rodilla, tobilloI: P.tobillo, caderaD: espejo(P.cadera), rodillaD: espejo(P.rodilla), tobilloD: espejo(P.tobillo),
  };
  const padre = { columna: 'pelvis', pecho: 'columna', cuello: 'pecho', cabeza: 'cuello', hombroI: 'pecho', codoI: 'hombroI', munecaI: 'codoI',
    hombroD: 'pecho', codoD: 'hombroD', munecaD: 'codoD', caderaI: 'pelvis', rodillaI: 'caderaI', tobilloI: 'rodillaI', caderaD: 'pelvis', rodillaD: 'caderaD', tobilloD: 'rodillaD' };
  const huesos = nombres.map(n => { const b = new THREE.Bone(); b.name = n; return b; });
  for (const n of nombres) {
    const b = huesos[H[n]], p = V(posicion[n]);
    if (padre[n]) { huesos[H[padre[n]]].add(b); p.sub(V(posicion[padre[n]])); }
    b.position.copy(p);
  }

  // ---------- Torso con túnica (de la falda al cuello) ----------
  {
    // [y, semiancho, semifondo, adelanto, delante, detrás, color, forma]
    const perfil = [
      [0.56, 0.262, 0.185, 0.0, 1, 1, 'borde'], [0.6, 0.258, 0.182, 0, 1, 1, 'tunica'], [0.72, 0.236, 0.165, 0, 1, 1.03, 'tunica'],
      [0.86, 0.206, 0.142, -0.004, 1, 1.12, 'tunica'], [0.96, 0.19, 0.128, 0, 1, 1.08, 'tunica'],
      [1.012, 0.176, 0.12, 0.004, 1, 1, 'cinto'], [1.058, 0.174, 0.12, 0.004, 1, 1, 'cinto'],
      [1.1, 0.178, 0.122, 0.006, 1.02, 1, 'tunica'], [1.2, 0.188, 0.128, 0.012, 1.08, 0.98, 'tunica'], [1.29, 0.198, 0.13, 0.014, 1.1, 0.97, 'tunica'],
      [1.36, 0.198, 0.122, 0.006, 1.04, 0.98, 'tunica'], [1.41, 0.178, 0.108, -0.006, 1, 1, 'tunica'], [1.45, 0.14, 0.092, -0.008, 1, 1, 'tunica'], [1.475, 0.1, 0.08, -0.006, 1, 1, 'tunica'],
      [1.49, 0.086, 0.075, -0.004, 1, 1, 'camisa'], [1.505, 0.066, 0.064, -0.002, 1, 1, 'camisa'],
    ];
    const huesoY = (y) => y < 1.0 ? [[H.pelvis, 1]] : y < 1.16 ? [[H.pelvis, (1.16 - y) / 0.16 * 0.6], [H.columna, 1 - (1.16 - y) / 0.16 * 0.6]] : y < 1.3 ? [[H.columna, (1.3 - y) / 0.14], [H.pecho, 1 - (1.3 - y) / 0.14]] : y < 1.47 ? [[H.pecho, 1]] : [[H.pecho, 0.6], [H.cuello, 0.4]];
    const secs = perfil.map(([y, a, b, dz, del, det, col]) => ({
      c: new THREE.Vector3(0, y, dz), a, b, delante: del, detras: det, forma: 2.2, pliegues: y < 1.0 ? 0.035 * Math.min(1, (1.0 - y) / 0.3) : 0,
      color: (t, p) => {
        if (col === 'cinto') return Math.abs(p.x) < 0.022 && p.z > 0 ? C.hebilla : C.cinto;
        const base = col === 'borde' ? C.tunicaBorde : col === 'camisa' ? C.camisa : C.tunica;
        if (y > 1.0) return base;
        return base.clone().multiplyScalar(1 + 0.09 * Math.sin(t * 7 + 0.5) * Math.min(1, (1.0 - y) / 0.25)); // los pliegues se ven
      },
      // la falda de la túnica sigue un poco a cada muslo para que no lo atraviese al andar
      huesos: huesoY(y),
    }));
    // los pesos de la falda dependen del lado de cada vértice: se rehacen tras crear el tubo
    const inicio = M.pos.length / 3;
    tubo(M, secs, 22, {});
    for (let i = inicio; i < M.pos.length / 3; i++) {
      const x = M.pos[i * 3], y = M.pos[i * 3 + 1];
      if (y < 0.9) {
        const f = Math.min(1, (0.92 - y) / 0.36) * 0.6, lado = x > 0 ? H.caderaI : H.caderaD, w = f * Math.min(1, Math.abs(x) / 0.12);
        M.hueso.splice(i * 4, 4, H.pelvis, lado, 0, 0); M.peso.splice(i * 4, 4, 1 - w, w, 0, 0);
      }
    }
  }

  // ---------- Piernas: calzas de lana con vendas de lino, y zapatos ----------
  for (const s of [1, -1]) {
    const L = s > 0 ? 'I' : 'D', sx = (a) => [a[0] * s, a[1], a[2]];
    const cad = V(sx(P.cadera)), rod = V(sx(P.rodilla)), tob = V(sx(P.tobillo));
    const en = (a, b, t) => a.clone().lerp(b, t);
    // vendas: franjas en diagonal en la pierna, de la rodilla al tobillo
    const vendas = (t, p) => { if (p.y > 0.4 || p.y < 0.12) return C.calzas; const f = (p.y * 26 + t * 0.6) % 1; return f < 0.62 ? C.vendas : C.vendas.clone().multiplyScalar(0.85); };
    const secs = [
      { c: en(cad, rod, -0.08).setY(0.97), a: 0.07, b: 0.07, color: C.calzas, huesos: [[H.pelvis, 0.6], [H['cadera' + L], 0.4]] },
      { c: en(cad, rod, 0.0), a: 0.088, b: 0.09, color: C.calzas, huesos: [[H['cadera' + L], 1]] },
      { c: en(cad, rod, 0.3), a: 0.08, b: 0.082, color: C.calzas, huesos: [[H['cadera' + L], 1]] },
      { c: en(cad, rod, 0.65), a: 0.066, b: 0.068, color: C.calzas, huesos: [[H['cadera' + L], 1]] },
      { c: en(cad, rod, 0.9), a: 0.056, b: 0.058, color: C.calzas, huesos: mezcla(H['cadera' + L], H['rodilla' + L], 0.9) },
      { c: rod.clone(), a: 0.054, b: 0.06, dz: 0.005, color: C.calzas, huesos: [[H['cadera' + L], 0.5], [H['rodilla' + L], 0.5]] },
      { c: en(rod, tob, 0.08), a: 0.052, b: 0.056, color: vendas, huesos: [[H['rodilla' + L], 0.85], [H['cadera' + L], 0.15]] },
      { c: en(rod, tob, 0.3), a: 0.06, b: 0.066, detras: 1.18, color: vendas, huesos: [[H['rodilla' + L], 1]] }, // pantorrilla
      { c: en(rod, tob, 0.55), a: 0.048, b: 0.052, detras: 1.08, color: vendas, huesos: [[H['rodilla' + L], 1]] },
      { c: en(rod, tob, 0.8), a: 0.039, b: 0.04, color: vendas, huesos: [[H['rodilla' + L], 1]] },
      { c: en(rod, tob, 0.93), a: 0.037, b: 0.038, color: vendas, huesos: [[H['rodilla' + L], 0.6], [H['tobillo' + L], 0.4]] },
    ];
    tubo(M, secs, 12);
    // zapato de cuero de una pieza: del talón a la punta, apoyado en el suelo
    const pun = V(sx(P.punta));
    const zap = [
      { c: new THREE.Vector3(tob.x, 0.105, tob.z), a: 0.042, b: 0.043, color: C.zapato, huesos: [[H['tobillo' + L], 1]] },
      { c: new THREE.Vector3(tob.x, 0.05, tob.z - 0.01), a: 0.044, b: 0.052, color: C.zapato, huesos: [[H['tobillo' + L], 1]], forma: 2.4 },
      { c: new THREE.Vector3(tob.x + s * 0.002, 0.04, tob.z + 0.06), a: 0.047, b: 0.04, color: C.zapato, huesos: [[H['tobillo' + L], 1]], forma: 2.4 },
      { c: new THREE.Vector3(pun.x, 0.032, pun.z - 0.035), a: 0.043, b: 0.03, color: C.zapato, huesos: [[H['tobillo' + L], 1]], forma: 2.4 },
      { c: new THREE.Vector3(pun.x, 0.026, pun.z), a: 0.03, b: 0.022, color: C.zapato, huesos: [[H['tobillo' + L], 1]], tapaSale: new THREE.Vector3(0, -0.004, 0.012) },
    ];
    // el zapato va a lo largo de z: su "lateral" es x pero el eje cambia de vertical a horizontal
    tubo(M, zap, 12, { tapaIni: false, tapaFin: true });
  }

  // ---------- Brazos: mangas de la túnica, puño de la camisa y mano ----------
  for (const s of [1, -1]) {
    const L = s > 0 ? 'I' : 'D', sx = (a) => [a[0] * s, a[1], a[2]];
    const hom = V(sx(P.hombro)), cod = V(sx(P.codo)), mun = V(sx(P.muneca)), fin = V(sx(P.manoFin));
    const en = (a, b, t) => a.clone().lerp(b, t);
    const lat = new THREE.Vector3(0, 0, 1); // en los brazos el "ancho" va de delante a atrás
    const secs = [
      { c: hom.clone().add(new THREE.Vector3(-s * 0.06, 0.0, 0)), a: 0.03, b: 0.03, color: C.tunica, huesos: [[H.pecho, 1]] },
      { c: hom.clone().add(new THREE.Vector3(-s * 0.02, 0.012, 0)), a: 0.052, b: 0.048, color: C.tunica, huesos: [[H.pecho, 0.6], [H['hombro' + L], 0.4]] },
      { c: hom.clone().add(new THREE.Vector3(s * 0.006, -0.03, 0)), a: 0.058, b: 0.058, color: C.tunica, huesos: [[H['hombro' + L], 0.8], [H.pecho, 0.2]] }, // deltoides
      { c: en(hom, cod, 0.35), a: 0.054, b: 0.053, color: C.tunica, huesos: [[H['hombro' + L], 1]] },
      { c: en(hom, cod, 0.85), a: 0.05, b: 0.049, color: C.tunica, huesos: mezcla(H['hombro' + L], H['codo' + L], 0.85, 0.7) },
      { c: cod.clone(), a: 0.05, b: 0.052, color: C.tunica, huesos: [[H['hombro' + L], 0.5], [H['codo' + L], 0.5]] },
      { c: en(cod, mun, 0.25), a: 0.05, b: 0.052, color: C.tunica, huesos: [[H['codo' + L], 1]] },
      { c: en(cod, mun, 0.78), a: 0.04, b: 0.038, color: C.tunica, huesos: [[H['codo' + L], 1]] },
      { c: en(cod, mun, 0.86), a: 0.044, b: 0.041, color: C.camisa, huesos: [[H['codo' + L], 1]] },
      { c: en(cod, mun, 0.96), a: 0.042, b: 0.039, color: C.camisa, huesos: [[H['codo' + L], 0.8], [H['muneca' + L], 0.2]] },
      { c: en(cod, mun, 0.97), a: 0.028, b: 0.024, color: C.camisa, huesos: [[H['codo' + L], 0.7], [H['muneca' + L], 0.3]] },
    ];
    tubo(M, secs, 12, { tapaIni: true, lateral: lat });
    // mano: muñeca, palma (más ancha que gruesa), cuatro dedos un poco doblados y pulgar
    const piel = C.piel, hm = [[H['muneca' + L], 1]];
    const dirMano = fin.clone().sub(mun).normalize();
    const palma = [
      { c: en(cod, mun, 0.95), a: 0.027, b: 0.022, color: piel, huesos: [[H['codo' + L], 0.5], [H['muneca' + L], 0.5]] },
      { c: mun.clone(), a: 0.028, b: 0.02, color: piel, huesos: hm },
      { c: mun.clone().addScaledVector(dirMano, 0.04), a: 0.043, b: 0.018, color: piel, huesos: hm, forma: 2.6 },
      { c: mun.clone().addScaledVector(dirMano, 0.085), a: 0.045, b: 0.016, color: piel, huesos: hm, forma: 2.8 },
      { c: mun.clone().addScaledVector(dirMano, 0.096), a: 0.04, b: 0.013, color: piel, huesos: hm, forma: 2.8 },
    ];
    // la palma mira hacia el muslo: su ancho va de delante a atrás
    tubo(M, palma, 10, { tapaFin: true, lateral: lat });
    const nudillos = mun.clone().addScaledVector(dirMano, 0.09);
    [[0.031, 0.072], [0.011, 0.08], [-0.009, 0.076], [-0.027, 0.062]].forEach(([dzz, largo], d) => {
      const base = nudillos.clone().add(new THREE.Vector3(0, 0, dzz));
      const curva = (t) => base.clone().addScaledVector(dirMano, largo * t * (1 - 0.25 * t)).add(new THREE.Vector3(-s * 0.012 * t * t, 0, 0.018 * t * t)); // se recogen hacia la palma
      const dedo = [0, 0.33, 0.66, 0.92, 1].map((t, k) => ({ c: curva(t), a: 0.0095 - t * 0.0022, b: 0.009 - t * 0.002, color: piel, huesos: hm, ...(k === 4 ? { tapaSale: dirMano.clone().multiplyScalar(0.004) } : {}) }));
      tubo(M, dedo, 6, { tapaFin: true, lateral: lat });
    });
    const bp = mun.clone().addScaledVector(dirMano, 0.035).add(new THREE.Vector3(-s * 0.008, 0, 0.022));
    const pulgar = [0, 0.4, 0.8, 1].map(t => ({ c: bp.clone().addScaledVector(dirMano, 0.05 * t).add(new THREE.Vector3(-s * 0.006 * t, 0, 0.018 * t)), a: 0.011 - t * 0.002, b: 0.01 - t * 0.002, color: piel, huesos: hm }));
    tubo(M, pulgar, 6, { tapaFin: true, lateral: lat });
  }

  // ---------- Cuello ----------
  tubo(M, [
    { c: new THREE.Vector3(0, 1.46, -0.01), a: 0.05, b: 0.05, color: C.piel, huesos: [[H.pecho, 0.5], [H.cuello, 0.5]] },
    { c: new THREE.Vector3(0, 1.53, -0.004), a: 0.047, b: 0.05, color: C.piel, huesos: [[H.cuello, 1]] },
    { c: new THREE.Vector3(0, 1.575, 0.004), a: 0.046, b: 0.05, color: C.piel, huesos: [[H.cuello, 0.5], [H.cabeza, 0.5]] },
  ], 12);

  // ---------- Cabeza moldeada ----------
  cabeza(M, C, [[H.cabeza, 1]]);

  const geo = M.geometria();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const malla = new THREE.SkinnedMesh(geo, mat);
  malla.castShadow = true; malla.receiveShadow = true;
  const raiz = huesos[H.pelvis];
  malla.add(raiz); malla.updateMatrixWorld(true);
  malla.bind(new THREE.Skeleton(huesos));
  malla.userData.H = H; malla.userData.huesos = huesos;
  malla.userData.reposo = huesos.map(b => b.quaternion.clone());
  hornearSombra(geo);
  return malla;
}

// ---------- La cabeza ----------
// Esfera unitaria deformada por zonas, en función de la dirección (x, y, z) de cada vértice
// (z hacia delante, y hacia arriba); luego se escala a medidas de cabeza real.
// Pelo y barba NO son piezas aparte: son un abultamiento suave de la misma malla con su color,
// así el borde (frente, patillas, barba) es limpio y sin escalones.
const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2)); // campana
const suave = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// máscaras 0..1 de pelo y barba
function mascaraPelo(d) {
  const { x, y, z } = d;
  const frente = z > 0 ? 0.5 + 0.22 * x * x : -0.25 - 0.15 * Math.max(0, -z); // línea del pelo: frente alta, nuca baja
  const patilla = Math.abs(x) > 0.82 && z > -0.2 && z < 0.45 ? 0.18 : 0;       // patillas hasta media oreja
  return suave(frente - patilla - 0.06, frente - patilla + 0.06, y);
}
function mascaraBarba(d) {
  const { x, y, z } = d;
  if (z < -0.25) return 0;
  // por los lados empieza bajo la oreja; por delante solo el mentón (barba corta, mejillas limpias)
  const borde = -0.18 - 0.32 * suave(0.3, 0.85, z) * (1 - suave(0.15, 0.45, Math.abs(x)));
  let m = suave(borde, borde - 0.12, y) * suave(-0.25, 0.05, z);
  const boca = g2(x, y, 0, -0.43, 0.22, 0.07) * suave(0.6, 0.85, z); // boca libre
  m *= 1 - Math.min(1, boca * 1.6);
  const bigote = g2(x, y, 0, -0.34, 0.3, 0.045) * suave(0.7, 0.9, z);
  return Math.max(m, bigote * 0.9);
}
function nariz(x, y) { // abultamiento de la nariz: puente estrecho, punta marcada, aletas, corte limpio debajo
  if (y > 0.24 || y < -0.3) return 0;
  const alto = y > -0.17 ? 0.035 + 0.15 * (0.24 - y) / 0.41 : 0.185 * (1 - suave(-0.17, -0.27, y) * 0.0) * (y + 0.3) / 0.13;
  const ancho = 0.045 + 0.065 * suave(0.05, -0.2, y);
  const f = Math.abs(x) < ancho ? (1 - (x / ancho) ** 2) ** 2 : 0;
  const aletas = 0.035 * g2(Math.abs(x), y, 0.1, -0.21, 0.04, 0.05);
  return alto * f + aletas;
}
function forma(d) {
  const { x, y, z } = d;
  let r = 1;
  const delante = Math.max(0, z);
  if (y < 0.1) r *= 1 - 0.3 * Math.max(0, 0.1 - y) * Math.abs(x);       // mandíbula que se estrecha
  if (y < -0.55 && z > 0.3) r += 0.06 * (-y - 0.55) * z;               // mentón
  if (z < 0 && y > -0.2) r *= 1 + 0.06 * (-z);                         // cráneo atrás
  if (Math.abs(x) > 0.6 && y > -0.1 && y < 0.5) r *= 1 - 0.05 * (Math.abs(x) - 0.6); // sienes planas
  r *= 1 - 0.09 * suave(0.45, 1, z) * suave(0.55, 0.2, y + 0.0);     // cara más plana de frente (los rasgos se leen mejor)
  r += 0.045 * g2(Math.abs(x), y, 0.62, -0.5, 0.2, 0.16) * suave(-0.2, 0.3, z); // ángulo de la mandíbula
  r -= 0.03 * g2(Math.abs(x), y, 0.5, -0.3, 0.14, 0.1) * delante;     // mejilla hundida bajo el pómulo
  r += 0.045 * g2(x, y, 0, 0.29, 0.6, 0.07) * delante;                  // arco de la ceja
  for (const s of [-1, 1]) {
    r -= 0.075 * g2(x, y, 0.31 * s, 0.13, 0.12, 0.08) * delante;       // cuencas de los ojos
    r += 0.03 * g2(x, y, 0.5 * s, -0.06, 0.14, 0.12) * delante;        // pómulos
  }
  r += 1.9 * nariz(x, y) * Math.pow(delante, 2);
  r -= 0.02 * g2(x, y, 0, -0.41, 0.2, 0.025) * delante;               // línea de la boca
  r += 0.016 * g2(x, y, 0, -0.455, 0.15, 0.035) * delante;            // labio inferior
  r += 0.07 * mascaraPelo(d) * (1 + 0.15 * Math.sin(x * 13 + z * 7) * Math.sin(y * 11)); // pelo con mechones
  r += 0.04 * mascaraBarba(d) * (1 + 0.2 * Math.sin(x * 21) * Math.sin(y * 17));
  return r;
}
function cabeza(M, C, huesos) {
  const [rx, ry, rz] = P.cabezaRadios, cc = V(P.centroCabeza);
  const LADOS = 44, PISOS = 32;
  const dir = (i, j) => { const th = j / PISOS * Math.PI, ph = i / LADOS * Math.PI * 2; return new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)); };
  const punto = (d, extra = 0) => { const r = forma(d) + extra; return new THREE.Vector3(d.x * rx * r, d.y * ry * r, d.z * rz * r).add(cc); };
  const pelo = new THREE.Color(P.colores.pelo), k = new THREE.Color();
  const colorDe = (d) => {
    const { x, y, z } = d;
    k.copy(C.piel);
    if (z > 0.6) k.lerp(C.labio, g2(x, y, 0, -0.44, 0.12, 0.035) * 0.8);              // labios
    for (const s of [-1, 1]) k.lerp(C.ceja, g2(x, y, 0.31 * s, 0.27, 0.14, 0.03) * 0.9 * suave(0.5, 0.7, z)); // cejas
    k.lerp(pelo, Math.min(1, mascaraBarba(d) * 1.1) * 0.92);
    k.lerp(pelo, mascaraPelo(d));
    return k.clone().multiplyScalar(0.94 + 0.06 * Math.sin(x * 40) * Math.sin(y * 37)); // un poco de variación
  };
  const ids = [];
  for (let j = 0; j <= PISOS; j++) { ids.push([]); for (let i = 0; i < LADOS; i++) { const d = dir(i, j); ids[j].push(M.vertice(punto(d), colorDe(d), huesos)); } }
  for (let j = 0; j < PISOS; j++) for (let i = 0; i < LADOS; i++) {
    const a = ids[j][i], b = ids[j][(i + 1) % LADOS], c = ids[j + 1][i], d = ids[j + 1][(i + 1) % LADOS];
    M.tri(a, c, b); M.tri(b, c, d);
  }
  // ojos metidos en la cuenca
  for (const s of [-1, 1]) {
    const d = new THREE.Vector3(0.31 * s, 0.13, 1).normalize();
    ojo(M, C, punto(d, -0.085), huesos);
  }
  for (const s of [-1, 1]) oreja(M, C, cc.clone().add(new THREE.Vector3(s * rx * 0.97, -0.008, -0.01)), s, huesos);
}
// globo del ojo con párpados: la parte de arriba y la de abajo del globo llevan color de piel,
// así el ojo se ve almendrado y no como una bola
function ojo(M, C, c, huesos) {
  const R = 0.0128, LADOS = 12, PISOS = 9, ids = [];
  const parpado = C.piel.clone().multiplyScalar(0.92);
  for (let j = 0; j <= PISOS; j++) { ids.push([]); for (let i = 0; i < LADOS; i++) {
    const th = j / PISOS * Math.PI, ph = i / LADOS * Math.PI * 2;
    const d = new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
    let color = C.blancoOjo;
    if (d.z > 0.2 && Math.hypot(d.x, d.y + 0.05) < 0.45) color = C.ojo;
    if (d.y > 0.42 || d.y < -0.5) color = parpado;
    ids[j].push(M.vertice(c.clone().add(new THREE.Vector3(d.x * R * 1.15, d.y * R * 0.9, d.z * R)), color, huesos));
  } }
  for (let j = 0; j < PISOS; j++) for (let i = 0; i < LADOS; i++) {
    const a = ids[j][i], b = ids[j][(i + 1) % LADOS], cc = ids[j + 1][i], d = ids[j + 1][(i + 1) % LADOS];
    M.tri(a, cc, b); M.tri(b, cc, d);
  }
}
function oreja(M, C, c, s, huesos) {
  const LADOS = 10, ids = [[], []], piel = C.piel.clone().multiplyScalar(0.95);
  for (let k = 0; k < 2; k++) for (let i = 0; i < LADOS; i++) {
    const t = i / LADOS * Math.PI * 2;
    const p = c.clone().add(new THREE.Vector3(s * (k ? 0.012 : -0.004), Math.cos(t) * 0.031, Math.sin(t) * 0.02 - 0.004 + (k ? -0.006 : 0)));
    ids[k].push(M.vertice(p, piel, huesos));
  }
  const ca = M.vertice(c.clone().add(new THREE.Vector3(s * 0.016, 0, -0.006)), piel, huesos);
  for (let i = 0; i < LADOS; i++) {
    const a = ids[0][i], b = ids[0][(i + 1) % LADOS], cc = ids[1][i], d = ids[1][(i + 1) % LADOS];
    if (s > 0) { M.tri(a, b, cc); M.tri(b, d, cc); M.tri(cc, d, ca); } else { M.tri(a, cc, b); M.tri(b, cc, d); M.tri(cc, ca, d); }
  }
}

// sombra de contacto y oclusión suave horneadas en el color (pies, entrepierna, bajo la barbilla, axilas)
function hornearSombra(geo) {
  const p = geo.attributes.position, c = geo.attributes.color, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), ny = n.getY(i);
    let k = 1;
    k *= 0.72 + 0.28 * Math.min(1, y / 0.25);                         // cerca del suelo
    k *= 0.88 + 0.12 * (ny * 0.5 + 0.5);                               // lo que mira abajo
    if (y > 0.8 && y < 0.95 && Math.abs(x) < 0.06) k *= 0.8;           // entrepierna
    if (y > 1.5 && y < 1.58 && ny < -0.2) k *= 0.75;                   // bajo la barbilla
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
}

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
