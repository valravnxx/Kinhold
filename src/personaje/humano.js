// Kinhold — escultura del humano base (hombre de 1,76 m) con su ropa, por campos de distancia.
// Medidas en metros, mirando a +z, izquierda del personaje = +x, pies en y = 0.
// Proporciones de dibujo de figura: cabeza de 23 cm (1/7,6 de la altura); en la cara, los ojos a media
// altura de la cabeza, la base de la nariz a medio camino entre cejas y mentón, la boca a un tercio de
// la nariz al mentón, las orejas entre la ceja y la base de la nariz, un ojo de separación entre ojos.
import { v3, lerp, add, esfera, elipsoide, cono, capsula, caja, capa } from './sdf.js';

export const J = { // articulaciones (lado izquierdo; el derecho es su espejo)
  pelvis: v3(0, 0.95, 0), columna: v3(0, 1.1, 0), pecho: v3(0, 1.3, 0), cuello: v3(0, 1.48, -0.012), cabeza: v3(0, 1.585, 0.0),
  hombro: v3(0.172, 1.418, -0.012), codo: v3(0.196, 1.142, -0.03), muneca: v3(0.21, 0.9, 0.0), nudillos: v3(0.214, 0.81, 0.008),
  cadera: v3(0.092, 0.92, 0.0), rodilla: v3(0.1, 0.5, 0.012), tobillo: v3(0.105, 0.085, -0.02), punta: v3(0.11, 0.015, 0.155),
  ojos: v3(0, 1.645, 0.0), // línea de los ojos: centro de la cabeza
};
export const HUESOS = ['pelvis', 'columna', 'pecho', 'cuello', 'cabeza', 'hombroI', 'codoI', 'munecaI', 'hombroD', 'codoD', 'munecaD', 'caderaI', 'rodillaI', 'tobilloI', 'caderaD', 'rodillaD', 'tobilloD'];
export const PADRE = { columna: 'pelvis', pecho: 'columna', cuello: 'pecho', cabeza: 'cuello', hombroI: 'pecho', codoI: 'hombroI', munecaI: 'codoI', hombroD: 'pecho', codoD: 'hombroD', munecaD: 'codoD', caderaI: 'pelvis', rodillaI: 'caderaI', tobilloI: 'rodillaI', caderaD: 'pelvis', rodillaD: 'caderaD', tobilloD: 'rodillaD' };
export function posicionHueso(n) {
  const lado = n.endsWith('I') ? 1 : n.endsWith('D') ? -1 : 0;
  const base = lado ? n.slice(0, -1) : n;
  const p = J[base]; return lado < 0 ? [-p[0], p[1], p[2]] : p;
}

export const COLORES = {
  piel: 0xc09478, labio: 0xa57a68, pelo: 0x3a2a1d, ceja: 0x33251a, blancoOjo: 0xddd6ca, iris: 0x4a3524, pupila: 0x16100c,
  tunica: 0x5f6a48, tunicaBorde: 0x4c5638, camisa: 0xcfc4a6, calzas: 0x5b4f44, vendas: 0x9a8e72, cinto: 0x4a3324, hebilla: 0x77736a, zapato: 0x3e2b1e,
};

const espejoX = (p) => [-p[0], p[1], p[2]];
// la cabeza se escribe en su propio marco: origen en la línea de los ojos, centrado
const H = (x, y, z) => add(J.ojos, v3(x, y, z));

// centros de los globos de los ojos (los ojos se hacen aparte, como esferas finas, al hornear)
export const OJOS = [];
export const RADIO_OJO = 0.0124;

export function esculpir() {
  OJOS.length = 0;
  const cuerpo = [], cabeza = [], tunica = [], pelo = [], barba = [], ojos = [], cejas = [];
  // ---------------- Tronco ----------------
  cuerpo.push(
    elipsoide(v3(0, 0.935, -0.005), [0.158, 0.105, 0.108], { hueso: 'pelvis', k: 0.03 }),
    elipsoide(v3(0.066, 0.885, -0.05), [0.074, 0.085, 0.066], { hueso: 'pelvis', k: 0.03 }),
    elipsoide(v3(-0.066, 0.885, -0.05), [0.074, 0.085, 0.066], { hueso: 'pelvis', k: 0.03 }),
    elipsoide(v3(0, 1.075, 0.008), [0.138, 0.13, 0.098], { hueso: 'columna', k: 0.05 }),
    elipsoide(v3(0, 1.265, -0.008), [0.15, 0.158, 0.1], { hueso: 'pecho', k: 0.05 }),
    elipsoide(v3(0.056, 1.318, 0.046), [0.064, 0.042, 0.026], { hueso: 'pecho', k: 0.03 }),
    elipsoide(v3(-0.056, 1.318, 0.046), [0.064, 0.042, 0.026], { hueso: 'pecho', k: 0.03 }),
    elipsoide(v3(0, 1.43, -0.035), [0.115, 0.042, 0.058], { hueso: 'pecho', k: 0.04 }), // trapecio
    capsula(v3(0.125, 1.415, -0.015), v3(-0.125, 1.415, -0.015), 0.04, { hueso: 'pecho', k: 0.04 }), // cintura escapular
  );
  // cuello
  cuerpo.push(cono(v3(0, 1.44, -0.022), v3(0, 1.585, -0.005), 0.054, 0.049, { hueso: 'cuello', k: 0.03 }));
  // ---------------- Brazos y manos ----------------
  for (const s of [1, -1]) {
    const L = s > 0 ? 'I' : 'D', X = (p) => (s > 0 ? p : espejoX(p));
    const ho = X(J.hombro), co = X(J.codo), mu = X(J.muneca), nu = X(J.nudillos);
    cuerpo.push(
      elipsoide(add(ho, v3(s * 0.002, -0.028, 0)), [0.042, 0.058, 0.046], { hueso: 'hombro' + L, k: 0.03 }), // deltoides
      cono(ho, co, 0.041, 0.034, { hueso: 'hombro' + L, k: 0.025 }),
      elipsoide(add(lerp(ho, co, 0.5), v3(0, 0, 0.012)), [0.033, 0.075, 0.034], { hueso: 'hombro' + L, k: 0.02 }), // bíceps
      cono(co, mu, 0.037, 0.025, { hueso: 'codo' + L, k: 0.02 }),
      elipsoide(add(lerp(co, mu, 0.25), v3(0, 0, 0.004)), [0.036, 0.075, 0.033], { hueso: 'codo' + L, k: 0.02 }),
    );
    // mano: la palma mira al muslo (delgada en x, ancha en z); dedos un poco recogidos
    const dirM = [nu[0] - mu[0], nu[1] - mu[1], nu[2] - mu[2]];
    cuerpo.push(
      elipsoide(lerp(mu, nu, 0.55), [0.015, 0.05, 0.039], { hueso: 'muneca' + L, k: 0.015 }),
      cono(mu, lerp(mu, nu, 0.4), 0.024, 0.02, { hueso: 'muneca' + L, k: 0.012 }),
    );
    [[0.026, 0.07], [0.009, 0.078], [-0.008, 0.074], [-0.024, 0.06]].forEach(([dz, l]) => {
      const a = add(nu, v3(-s * 0.002, 0.004, dz));
      const b = add(a, v3(s * -0.003, -l * 0.55, 0.008));
      const c = add(b, v3(s * -0.006, -l * 0.42, 0.018));
      cuerpo.push(cono(a, b, 0.0085, 0.0075, { hueso: 'muneca' + L, k: 0.006 }), cono(b, c, 0.0075, 0.0062, { hueso: 'muneca' + L, k: 0.004 }));
    });
    const pb = add(lerp(mu, nu, 0.45), v3(-s * 0.008, 0, 0.022));
    const pc = add(pb, v3(-s * 0.01, -0.03, 0.014)), pt = add(pc, v3(-s * 0.005, -0.026, 0.004));
    cuerpo.push(cono(pb, pc, 0.0105, 0.009, { hueso: 'muneca' + L, k: 0.008 }), cono(pc, pt, 0.009, 0.0075, { hueso: 'muneca' + L, k: 0.004 }));
    void dirM;
  }
  // ---------------- Piernas y pies ----------------
  for (const s of [1, -1]) {
    const L = s > 0 ? 'I' : 'D', X = (p) => (s > 0 ? p : espejoX(p));
    const ca = X(J.cadera), ro = X(J.rodilla), to = X(J.tobillo), pu = X(J.punta);
    cuerpo.push(
      cono(ca, ro, 0.083, 0.05, { hueso: 'cadera' + L, k: 0.04 }),
      elipsoide(add(lerp(ca, ro, 0.45), v3(-s * 0.005, 0, 0.016)), [0.058, 0.17, 0.058], { hueso: 'cadera' + L, k: 0.03 }),
      elipsoide(add(ro, v3(0, 0.005, 0.008)), [0.045, 0.05, 0.046], { hueso: 'rodilla' + L, k: 0.02 }),
      cono(ro, to, 0.046, 0.03, { hueso: 'rodilla' + L, k: 0.02 }),
      elipsoide(add(lerp(ro, to, 0.28), v3(0, 0, -0.024)), [0.044, 0.11, 0.045], { hueso: 'rodilla' + L, k: 0.025 }), // pantorrilla
      cono(add(to, v3(0, -0.035, -0.02)), add(pu, v3(0, 0.012, -0.03)), 0.034, 0.03, { hueso: 'tobillo' + L, k: 0.02 }),
      elipsoide(add(pu, v3(0, 0.008, -0.02)), [0.036, 0.022, 0.04], { hueso: 'tobillo' + L, k: 0.015 }),
    );
  }

  // ---------------- Cabeza ----------------
  const hc = { hueso: 'cabeza' };
  cabeza.push(
    elipsoide(H(0, 0.033, -0.022), [0.075, 0.083, 0.098], { ...hc, k: 0.02 }),          // cráneo
    elipsoide(H(0, 0.028, 0.04), [0.066, 0.052, 0.048], { ...hc, k: 0.025 }),           // frente
    capsula(H(-0.036, 0.02, 0.07), H(0.036, 0.02, 0.07), 0.0105, { ...hc, k: 0.016 }),  // arco de las cejas
    elipsoide(H(0, -0.04, 0.046), [0.045, 0.042, 0.044], { ...hc, k: 0.025 }),          // maxilar
    elipsoide(H(0.047, -0.012, 0.042), [0.021, 0.014, 0.022], { ...hc, k: 0.02 }),      // pómulos
    elipsoide(H(-0.047, -0.012, 0.042), [0.021, 0.014, 0.022], { ...hc, k: 0.02 }),
    cono(H(0.058, -0.03, -0.01), H(0.024, -0.098, 0.05), 0.019, 0.014, { ...hc, k: 0.02 }), // rama de la mandíbula
    cono(H(-0.058, -0.03, -0.01), H(-0.024, -0.098, 0.05), 0.019, 0.014, { ...hc, k: 0.02 }),
    elipsoide(H(0, -0.1, 0.058), [0.024, 0.017, 0.018], { ...hc, k: 0.02 }),           // mentón
    // nariz: puente, punta y aletas
    cono(H(0, 0.008, 0.08), H(0, -0.033, 0.106), 0.0064, 0.009, { ...hc, k: 0.008 }),
    elipsoide(H(0, -0.036, 0.103), [0.0108, 0.0098, 0.0105], { ...hc, k: 0.006 }),
    elipsoide(H(0.012, -0.04, 0.094), [0.0078, 0.0066, 0.0082], { ...hc, k: 0.005 }),
    elipsoide(H(-0.012, -0.04, 0.094), [0.0078, 0.0066, 0.0082], { ...hc, k: 0.005 }),
    esfera(H(0.0065, -0.0458, 0.0995), 0.0029, { ...hc, quitar: true, k: 0.002 }),      // fosas
    esfera(H(-0.0065, -0.0458, 0.0995), 0.0029, { ...hc, quitar: true, k: 0.002 }),
    // boca: labios y la línea entre ellos
    elipsoide(H(0, -0.059, 0.0825), [0.019, 0.0042, 0.0075], { ...hc, k: 0.005, color: COLORES.labio }),
    elipsoide(H(0, -0.068, 0.0805), [0.016, 0.0052, 0.0078], { ...hc, k: 0.005, color: COLORES.labio }),
    elipsoide(H(0, -0.0635, 0.091), [0.02, 0.0011, 0.012], { ...hc, quitar: true, k: 0.002 }),
    // cuencas de los ojos (se hunden con suavidad)
    elipsoide(H(0.0305, 0.002, 0.09), [0.0175, 0.012, 0.012], { ...hc, quitar: true, k: 0.008 }),
    elipsoide(H(-0.0305, 0.002, 0.09), [0.0175, 0.012, 0.012], { ...hc, quitar: true, k: 0.008 }),
  );
  // párpados: casquete alrededor del globo con la abertura almendrada
  for (const s of [1, -1]) {
    const c = H(s * 0.0305, 0.0, 0.073);
    cabeza.push(esfera(c, 0.0137, { ...hc, k: 0.003, despues: true }));
    cabeza.push(elipsoide(add(c, v3(0, -0.0012, 0.012)), [0.0134, 0.0048, 0.0125], { ...hc, quitar: true, final: true, k: 0.0012, giro: [0, 0, s * 0.08] }));
    OJOS.push(c);
  }
  // orejas
  for (const s of [1, -1]) {
    cabeza.push(elipsoide(H(s * 0.074, -0.012, -0.008), [0.009, 0.03, 0.019], { ...hc, k: 0.006, giro: [0.1, s * 0.25, 0] }));
    cabeza.push(elipsoide(H(s * 0.081, -0.012, -0.004), [0.005, 0.017, 0.009], { ...hc, quitar: true, k: 0.003, giro: [0.1, s * 0.25, 0] }));
  }
  // cejas (pelo corto sobre el arco)
  for (const s of [1, -1]) cejas.push(elipsoide(H(s * 0.031, 0.021, 0.08), [0.017, 0.0034, 0.0055], { ...hc, k: 0.004, giro: [0, 0, -s * 0.12] }));
  // pelo: el cráneo y la frente algo hinchados, quitando la cara y debajo de la línea del pelo
  pelo.push(
    elipsoide(H(0, 0.035, -0.022), [0.076, 0.084, 0.099], { ...hc, k: 0.02 }),
    elipsoide(H(0, 0.03, 0.04), [0.067, 0.053, 0.049], { ...hc, k: 0.02 }),
  );
  // barba corta y bigote: mandíbula, mentón y maxilar algo hinchados, sin boca
  barba.push(
    cono(H(0.058, -0.03, -0.012), H(0.024, -0.1, 0.051), 0.021, 0.016, { ...hc, k: 0.02 }),
    cono(H(-0.058, -0.03, -0.012), H(-0.024, -0.1, 0.051), 0.021, 0.016, { ...hc, k: 0.02 }),
    elipsoide(H(0, -0.101, 0.06), [0.027, 0.02, 0.02], { ...hc, k: 0.02 }),
    elipsoide(H(0, -0.05, 0.048), [0.052, 0.04, 0.045], { ...hc, k: 0.02 }),
    capsula(H(-0.018, -0.0505, 0.088), H(0.018, -0.0505, 0.088), 0.0042, { ...hc, k: 0.008 }), // bigote
  );

  // ---------------- Ropa ----------------
  const tronco = cuerpo.slice(0, 9);
  const brazos = cuerpo.filter(f => f.hueso && (f.hueso.startsWith('hombro') || f.hueso.startsWith('codo')));
  const piernas = cuerpo.filter(f => f.hueso && (f.hueso.startsWith('cadera') || f.hueso.startsWith('rodilla')));
  const pies = cuerpo.filter(f => f.hueso && f.hueso.startsWith('tobillo'));
  // falda de la túnica: cono ancho de la cintura a la rodilla (achatado delante-detrás)
  const falda = { ...cono(v3(0, 0.93, 0), v3(0, 0.56, 0), 0.15, 0.235), hueso: 'pelvis', k: 0.03, falda: true };
  const faldaD = falda.d; falda.d = (p) => faldaD([p[0], p[1], p[2] / 0.74]) * 0.86;
  tunica.push(...tronco, ...brazos, falda);
  const angulo = (p) => Math.atan2(p[2], p[0]);
  const capas = [
    capa('piel', [...cuerpo, ...cabeza], { color: COLORES.piel, k: 0.02 }),
    capa('pelo', pelo, {
      inflar: 0.004, color: COLORES.pelo, k: 0.01, kRecorte: 0.006,
      // mechones: ondas suaves; las cejas no llevan
      relieve: (p) => (p[1] > J.ojos[1] + 0.03 ? 0.0016 * Math.sin(p[0] * 260 + p[2] * 90) * Math.sin(p[1] * 180 + p[2] * 140) : 0),
      recorte: (p) => {
        const q = [p[0] - J.ojos[0], p[1] - J.ojos[1], p[2] - J.ojos[2]];
        // línea del pelo: frente alta con entradas suaves, patillas a media oreja, nuca baja
        const frente = 0.068 + 6 * q[0] * q[0], nuca = -0.055;
        const w = Math.max(0, Math.min(1, (0.035 - q[2]) / 0.075));
        const linea = frente * (1 - w) + nuca * w;
        return linea - q[1];
      },
    }),
    capa('cejas', cejas, { inflar: 0.0, color: COLORES.ceja, k: 0.004 }),
    capa('barba', barba, {
      inflar: 0.0028, color: COLORES.pelo, k: 0.01, kRecorte: 0.005,
      relieve: (p) => 0.0008 * Math.sin(p[0] * 400) * Math.sin(p[1] * 330),
      recorte: (p) => {
        const q = [p[0] - J.ojos[0], p[1] - J.ojos[1], p[2] - J.ojos[2]];
        // por arriba: bajo el pómulo en los lados y bajo la nariz por delante
        const techo = Math.abs(q[0]) > 0.032 ? -0.046 : -0.05;
        let d = q[1] - techo;
        d = Math.max(d, -0.022 - q[2]);                                          // no pasa de la oreja hacia atrás
        if (q[2] > 0.055) d = Math.max(d, 1 - Math.hypot(q[0] / 0.024, (q[1] + 0.0635) / 0.0115)); // labios libres
        return d;
      },
    }),
    capa('tunica', tunica, {
      inflar: 0.008, k: 0.012, kRecorte: 0.004,
      color: (p) => (p[1] < 0.6 ? COLORES.tunicaBorde : COLORES.tunica),
      relieve: (p) => (p[1] < 0.98 ? 0.0055 * Math.sin(angulo(p) * 9 + 0.6) * Math.min(1, (0.98 - p[1]) / 0.3) : 0), // pliegues
      recorte: (p) => {
        let d = 0.56 - p[1]; // bajo
        d = Math.max(d, p[1] - 1.488 - 0.02 * Math.max(0, -p[2]) / 0.05); // cuello
        // mangas hasta un poco antes de la muñeca
        const s = p[0] > 0 ? 1 : -1, co = s > 0 ? J.codo : espejoX(J.codo), mu = s > 0 ? J.muneca : espejoX(J.muneca);
        const t = proyeccion(p, co, mu), cerca = distSeg(p, co, mu) < 0.07; // solo cerca del antebrazo
        if (cerca && t > 0.5) d = Math.max(d, (t - 0.82) * 0.25);
        return d;
      },
      pesos: (p, base) => {
        if (p[1] >= 0.96) return base;
        // la falda sigue un poco a cada muslo
        const f = Math.min(1, (0.96 - p[1]) / 0.4) * 0.5 * Math.min(1, Math.abs(p[0]) / 0.1);
        return [['pelvis', 1 - f], [p[0] > 0 ? 'caderaI' : 'caderaD', f]];
      },
    }),
    capa('camisa', [...tronco.slice(7, 9), cuerpo.find(f => f.hueso === 'cuello'), ...brazos.filter(f => f.hueso.startsWith('codo'))], {
      inflar: 0.0095, color: COLORES.camisa, k: 0.02,
      recorte: (p) => {
        if (p[1] > 1.3) return Math.max(1.478 - p[1], p[1] - 1.502); // cuello de la camisa
        const s = p[0] > 0 ? 1 : -1, co = s > 0 ? J.codo : espejoX(J.codo), mu = s > 0 ? J.muneca : espejoX(J.muneca);
        const t = proyeccion(p, co, mu); return Math.max((0.8 - t) * 0.25, (t - 0.94) * 0.25); // puños
      },
    }),
    capa('cinto', tronco, {
      inflar: 0.017, k: 0.012, color: (p) => (Math.abs(p[0]) < 0.02 && p[2] > 0 ? COLORES.hebilla : COLORES.cinto),
      recorte: (p) => Math.abs(p[1] - 1.032) - 0.019,
    }),
    capa('calzas', piernas, { inflar: 0.004, color: COLORES.calzas, k: 0.03, recorte: (p) => Math.max(0.1 - p[1], p[1] - 0.9) }),
    capa('vendas', piernas.filter(f => f.hueso.startsWith('rodilla')), {
      inflar: 0.0075, k: 0.02,
      color: (p) => { const f = ((p[1] * 30 + angulo(p) * 0.35) % 1 + 1) % 1; return f < 0.7 ? COLORES.vendas : 0x847a62; },
      relieve: (p) => { const f = ((p[1] * 30 + angulo(p) * 0.35) % 1 + 1) % 1; return f > 0.7 ? 0.0015 : 0; },
      recorte: (p) => Math.max(0.13 - p[1], p[1] - 0.41),
    }),
    capa('zapato', pies, {
      inflar: 0.007, color: COLORES.zapato, k: 0.02,
      recorte: (p) => Math.max(p[1] - 0.125, -p[1] - 0.0),
    }),
  ];
  return capas;
}
function distSeg(p, a, b) { const t = Math.max(0, Math.min(1, proyeccion(p, a, b))); return Math.hypot(p[0] - a[0] - (b[0] - a[0]) * t, p[1] - a[1] - (b[1] - a[1]) * t, p[2] - a[2] - (b[2] - a[2]) * t); }
// posición relativa (0 en a, 1 en b) de p a lo largo del segmento
function proyeccion(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  return (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2);
}
void caja;
