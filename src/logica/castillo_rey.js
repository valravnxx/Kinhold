// Kinhold — el castillo del rey: dónde se pisa y qué para el paso (lógica pura, sin three.js; el servidor la puede usar).
//
// El castillo es una pieza fija del mundo: su malla (docs/recursos/mundo/castillo-rey-v1/castillo.bin.gz) y sus choques
// (colision.json, de la misma maqueta: herramientas/castillo_rey/) salen juntos, así que lo que se ve es lo que se pisa.
// Coordenadas de los choques: x y z en metros desde ORIGEN (en el mundo); las alturas, las del mundo (sobre el mar).
//
// Los choques son de cinco clases:
//  - suelos: rectángulos horizontales en un marco (plantas, adarves, puentes), con sus huecos; se pasa por debajo;
//  - rampas: escaleras rectas; las macizas no se pasan por debajo;
//  - sólidos: prismas (un polígono, de y0 a y1): se pisa su cara de arriba y paran el cuerpo (peldaños del caracol,
//    pilas, rellanos, muebles);
//  - muros: segmentos con su altura (las puertas, abiertas);
//  - techos: tejados; solo para la cámara (el corte por plantas).
//
// Decisiones provisionales (anotadas en el registro y en el diario):
//  - SUBIR: lo más que se sube de un paso sin trepar, 0,6 m (un peldaño son 0,2; un rellano de piedra, hasta 0,5). A los
//    muebles no se sube: paran el paso.
//  - El cuerpo, de los pies a 1,75 m, con 0,3 m de radio contra los muros: las puertas del castillo son de 0,9 m o más.
//  - Lo que tapa por encima de la cabeza (más de 2 m sobre los pies) corta la vista: la cámara corta el castillo ahí.

import { ZONA, FOSO, SIN_HIERBA, HIERBA_DENTRO } from './castillo_rey_datos.js';

export const ORIGEN_CASTILLO = { x: 217600, z: 52990 };
// Quitado del juego (valravnx, 26 nov 2026): el castillo no se carga, no se pisa, no cava el foso y no aparta la
// hierba, los árboles ni la recogida. Lo hecho se queda aquí y en herramientas/castillo_rey/ por si vuelve.
export const CASTILLO_REY_ACTIVO = false;
export const SUBIR = 0.6, CUERPO = 1.75, RADIO = 0.3, CABEZA = 2.0;
// La zona del castillo, del foso, de la barbacana y de su explanada (en el mundo): ahí no crecen árboles ni matas ni
// salen puntos de recogida (src/logica/vegetacion.js, src/logica/recogida_mundo.js). Y el foso: marcas de nivelado
// (src/logica/nivelado.js) que bajan el suelo a su fondo. Los dos salen de la maqueta (castillo_rey_datos.js).
export const ZONA_CASTILLO = ZONA;
export const MARCAS_FOSO = !CASTILLO_REY_ACTIVO ? [] : FOSO.map(([x, z, y, r, borde]) => ({ x, z, y, r, borde }));
const CAJA_ZONA = ZONA.reduce((c, [x, z]) => ({ x0: Math.min(c.x0, x), z0: Math.min(c.z0, z), x1: Math.max(c.x1, x), z1: Math.max(c.z1, z) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });

const dentroDe = (p, x, z) => {
  let r = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) r = !r;
  }
  return r;
};
// donde no crece la hierba ni las matas (el recinto, el patio de la barbacana y los caminos); en el foso, la explanada y
// al pie de los muros del patio de armas (HIERBA_DENTRO), sí
export function sinHierbaCastillo(x, z) {
  if (!CASTILLO_REY_ACTIVO) return false;
  if (!enZonaCastillo(x, z)) return false;
  if (HIERBA_DENTRO.some(([a, ...huecos]) => dentroDe(a, x, z) && !huecos.some(h => dentroDe(h, x, z)))) return false;
  return SIN_HIERBA.some(p => dentroDe(p, x, z));
}

/** cerca de la zona (a menos de `m` metros, mirando en 8 direcciones): para las rocas grandes de los cortados, que no
 *  tapen el acantilado del castillo ni su embarcadero */
export function cercaZonaCastillo(x, z, m = 60) {
  if (!CASTILLO_REY_ACTIVO) return false;
  if (x < CAJA_ZONA.x0 - m || x > CAJA_ZONA.x1 + m || z < CAJA_ZONA.z0 - m || z > CAJA_ZONA.z1 + m) return false;
  if (enZonaCastillo(x, z)) return true;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    if (enZonaCastillo(x + Math.cos(a) * m, z + Math.sin(a) * m)) return true;
  }
  return false;
}

export function enZonaCastillo(x, z) {
  if (!CASTILLO_REY_ACTIVO) return false;
  if (x < CAJA_ZONA.x0 || x > CAJA_ZONA.x1 || z < CAJA_ZONA.z0 || z > CAJA_ZONA.z1) return false;
  let r = false; const p = ZONA_CASTILLO;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) r = !r;
  }
  return r;
}

const CELDA = 4;

// datos: el contenido de colision.json. dx, dz: lo que se suma a las coordenadas de quien pregunta para pasarlas a las
// del castillo (en la escena: escena + salida − ORIGEN); dy: lo que se suma a las alturas de quien pregunta para
// pasarlas a las del mundo (en la escena: + y0, la altura del sitio de salida).
export function crearChoquesCastillo(datos, { dx = 0, dz = 0, dy = 0 } = {}) {
  const marco = (f) => ({ ox: f[0], oz: f[1], ca: Math.cos(f[2]), sa: Math.sin(f[2]) });
  // del castillo al marco: u = (p − o) · eu, w = (p − o) · ew, con eu = (cos a, sin a), ew = (−sin a, cos a)
  const local = (m, x, z) => { const ex = x - m.ox, ez = z - m.oz; return [ex * m.ca + ez * m.sa, -ex * m.sa + ez * m.ca]; };
  const mundo = (m, u, w) => [m.ox + u * m.ca - w * m.sa, m.oz + u * m.sa + w * m.ca];
  const rejilla = new Map();
  const meter = (o, x0, z0, x1, z1) => {
    for (let i = Math.floor(x0 / CELDA); i <= Math.floor(x1 / CELDA); i++)
      for (let j = Math.floor(z0 / CELDA); j <= Math.floor(z1 / CELDA); j++) {
        const k = i * 100000 + j; let l = rejilla.get(k); if (!l) rejilla.set(k, l = []); l.push(o);
      }
  };
  const cajaDe = (m, pts) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [u, w] of pts) { const [x, z] = mundo(m, u, w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return [x0, z0, x1, z1];
  };
  const rect = (e) => [[e.u[0], e.w[0]], [e.u[1], e.w[0]], [e.u[1], e.w[1]], [e.u[0], e.w[1]]];
  // los caracoles: el hueco de un suelo por el que pasa un caracol es redondo (el del caracol), no el rectángulo del hueco
  const caracoles = (datos.caracoles || []).map(e => { const m = marco(e.f); const [x, z] = mundo(m, e.c[0], e.c[1]); return { x, z, r: e.r - 0.03, y0: e.y[0], y1: e.y[1] }; });
  for (const e of datos.suelos) {
    const o = { t: 's', m: marco(e.f), u: e.u, w: e.w, y: e.y, h: e.h || [] };
    // a cada hueco, el caracol que pasa por él (si lo hay)
    o.hc = o.h.map(h => caracoles.find(c => { const [u, w] = local(o.m, c.x, c.z); return u > h[0] && u < h[1] && w > h[2] && w < h[3] && c.y0 < o.y - 0.05 && c.y1 > o.y - 0.3; }) || null);
    meter(o, ...cajaDe(o.m, rect(e)));
  }
  for (const e of datos.rampas) { const o = { t: 'r', m: marco(e.f), u: e.u, w: e.w, y: e.y, maciza: !!e.m }; meter(o, ...cajaDe(o.m, rect(e))); }
  for (const e of datos.solidos) { const o = { t: 'p', m: marco(e.f), p: e.p, y0: e.y0, y1: e.y1, mueble: !!e.n }; meter(o, ...cajaDe(o.m, e.p)); }
  for (const e of datos.techos || []) { const o = { t: 't', m: marco(e.f), u: e.u, w: e.w, y: e.y }; meter(o, ...cajaDe(o.m, rect(e))); }
  for (const s of datos.muros) { const o = { t: 'm', a: [s[0], s[1]], b: [s[2], s[3]], y0: s[4], y1: s[5] }; meter(o, Math.min(s[0], s[2]) - 0.5, Math.min(s[1], s[3]) - 0.5, Math.max(s[0], s[2]) + 0.5, Math.max(s[1], s[3]) + 0.5); }

  const cerca = (x, z) => rejilla.get(Math.floor(x / CELDA) * 100000 + Math.floor(z / CELDA)) || [];
  const dentroPol = (p, u, w) => {
    let r = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ui, wi] = p[i], [uj, wj] = p[j];
      if ((wi > w) !== (wj > w) && u < (uj - ui) * (w - wi) / (wj - wi) + ui) r = !r;
    }
    return r;
  };
  // Las superficies que hay en (x, z) (del castillo): [{ y, maciza, base }]
  function superficies(x, z) {
    const r = [];
    for (const o of cerca(x, z)) {
      if (o.t === 'm' || o.t === 't') continue;
      if (o.t === 'p') { const [u, w] = local(o.m, x, z); if (dentroPol(o.p, u, w)) r.push({ y: o.y1, maciza: true, base: o.y0, mueble: o.mueble }); continue; }
      const [u, w] = local(o.m, x, z);
      if (u < o.u[0] || u > o.u[1] || w < o.w[0] || w > o.w[1]) continue;
      if (o.t === 's') {
        if (o.h.some((h, i) => u > h[0] && u < h[1] && w > h[2] && w < h[3] && (!o.hc[i] || Math.hypot(x - o.hc[i].x, z - o.hc[i].z) < o.hc[i].r))) continue;
        r.push({ y: o.y, maciza: false, base: o.y - 0.4 });
      } else {
        const t = (u - o.u[0]) / (o.u[1] - o.u[0] || 1), y = o.y[0] + t * (o.y[1] - o.y[0]);
        r.push({ y, maciza: o.maciza, base: o.maciza ? Math.min(o.y[0], o.y[1]) - 0.4 : y - 0.3 });
      }
    }
    return r;
  }
  // La altura que pisas en (x, z) si tus pies están a y: la superficie más alta a la que se llega sin trepar; null si
  // ahí no hay nada del castillo a tu alcance (manda el terreno).
  function altura(xe, ze, ye) {
    const x = xe + dx, z = ze + dz, y = ye + dy;
    let mejor = null;
    for (const s of superficies(x, z)) if (!s.mueble && s.y <= y + SUBIR && (mejor === null || s.y > mejor)) mejor = s.y;
    return mejor === null ? null : mejor - dy;
  }
  // ¿Se puede estar de pie en (x, z) con los pies a y? No, si algo macizo te llega más arriba de un paso y no está
  // ya por encima de la cabeza (un peldaño alto, el canto de un rellano, un mueble).
  function cabe(xe, ze, ye) {
    const x = xe + dx, z = ze + dz, y = ye + dy;
    for (const s of superficies(x, z)) if (s.maciza && s.y > y + (s.mueble ? 0.1 : SUBIR) && s.base < y + CUERPO) return false;
    return true;
  }
  // Te aparta de los muros que tocan tu cuerpo (de y + 0,4 a y + CUERPO).
  function apartar(xe, ze, ye) {
    let x = xe + dx, z = ze + dz; const y = ye + dy;
    for (let it = 0; it < 3; it++) {
      for (const o of cerca(x, z)) {
        if (o.t !== 'm' || o.y1 <= y + 0.4 || o.y0 >= y + CUERPO) continue;
        const [x1, z1] = o.a, [x2, z2] = o.b, ddx = x2 - x1, ddz = z2 - z1, l2 = ddx * ddx + ddz * ddz;
        let u = l2 ? ((x - x1) * ddx + (z - z1) * ddz) / l2 : 0; u = Math.max(0, Math.min(1, u));
        const px = x1 + u * ddx, pz = z1 + u * ddz, ex = x - px, ez = z - pz, d = Math.hypot(ex, ez);
        if (d < RADIO && d > 1e-6) { x = px + ex / d * RADIO; z = pz + ez / d * RADIO; }
      }
    }
    return { x: x - dx, z: z - dz };
  }
  // ¿Corta un muro el paso de (x0, z0) a (x1, z1) con los pies a y? (para no colarse de un salto entre dos fotogramas)
  function cruzaMuro(x0e, z0e, x1e, z1e, ye) {
    const x0 = x0e + dx, z0 = z0e + dz, x1 = x1e + dx, z1 = z1e + dz, y = ye + dy;
    const vistos = new Set();
    for (const [cx, cz] of [[x0, z0], [x1, z1]]) for (const o of cerca(cx, cz)) {
      if (o.t !== 'm' || vistos.has(o) || o.y1 <= y + 0.4 || o.y0 >= y + CUERPO) continue;
      vistos.add(o);
      if (cortan(x0, z0, x1, z1, o.a[0], o.a[1], o.b[0], o.b[1])) return true;
    }
    return false;
  }
  // Lo que tapa por encima de la cabeza en (x, z): la altura más baja de un suelo, peldaño o tejado por encima de
  // y + CABEZA; null si nada. La cámara corta el castillo ahí (el corte por plantas).
  function techo(xe, ze, ye) {
    const x = xe + dx, z = ze + dz, y = ye + dy;
    let mejor = null;
    const ver = (v) => { if (v > y + CABEZA && (mejor === null || v < mejor)) mejor = v; };
    for (const s of superficies(x, z)) ver(s.maciza ? s.base : s.y - 0.45);   // (un suelo de tablas, por debajo de sus vigas)
    for (const o of cerca(x, z)) if (o.t === 't') { const [u, w] = local(o.m, x, z); if (u >= o.u[0] && u <= o.u[1] && w >= o.w[0] && w <= o.w[1]) ver(o.y); }
    return mejor === null ? null : mejor - dy;
  }
  // La fracción (0..1) del rayo de a a b (en 3D) hasta el primer muro que lo corta; 1 si ninguno. Para la cámara.
  function rayo(ax, ay, az, bx, by, bz, hasta = Infinity) {
    const x0 = ax + dx, z0 = az + dz, x1 = bx + dx, z1 = bz + dz, y0 = ay + dy, y1 = by + dy, lim = hasta + dy;
    let t = 1; const vistos = new Set();
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / CELDA) * 2);
    for (let i = 0; i <= n; i++) {
      for (const o of cerca(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)) {
        if (o.t !== 'm' || vistos.has(o)) continue; vistos.add(o);
        const s = corteT(x0, z0, x1, z1, o.a[0], o.a[1], o.b[0], o.b[1]);
        if (s === null || s >= t) continue;
        const yy = y0 + (y1 - y0) * s;
        if (yy >= o.y0 && yy <= Math.min(o.y1, lim)) t = s;
      }
    }
    return t;
  }
  return { altura, cabe, apartar, cruzaMuro, techo, rayo, superficies: (x, z) => superficies(x + dx, z + dz).map(s => ({ ...s, y: s.y - dy })) };
}

function corteT(ax, az, bx, bz, cx, cz, ex, ez) {
  const rx = bx - ax, rz = bz - az, sx = ex - cx, sz = ez - cz, den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
function cortan(ax, az, bx, bz, cx, cz, ex, ez) { return corteT(ax, az, bx, bz, cx, cz, ex, ez) !== null; }
