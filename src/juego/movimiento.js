// Kinhold — el movimiento del jugador por lo construido (partido de src/juego/main.js, 12 nov, sin cambiar nada de lo
// que hace): qué corta el paso en cada planta (muros, puertas cerradas, el hogar, el adarve, los postes), cómo se
// resuelve el choque, el paso de quien anda por el suelo del mundo (el rival de práctica) y la altura del suelo bajo el
// jugador (el cimiento, los suelos, las escaleras, el adarve, las trampillas, el andamio y los tejados terminados).
import * as THREE from 'three';
import { clave, localAMundo, mundoALocal, geometriaTejados, escaleraAndando, trampillaCerrada, progresoEscalera, andamioEn, altoCanon, huellaHogar, adarveEn, adarveDeEscalera, altoTejadoEn, empalizadasDe, ALTO_ADARVE } from '../logica/construccion.js';
import { P } from '../mundo/modelos.js';
import { PIEZAS, MODULO, ALTURA } from '../logica/piezas.js';
import { modoAgua } from '../logica/nado.js';

const oyDe = (c) => c.oy || 0;

// mundo: () => el mundo de ahora (cambia al deshacer o al conectarse); pj: la posición del jugador (se le cambia la
// planta, pj.k); obstaculos: lo del suelo que choca ({x, z, r}); altosCanon: hasta dónde sube cada cañón de chimenea;
// mundoJ: el mundo grande (o null); decorado: con la altura del terreno.
export function crearMovimiento({ mundo, pj, obstaculos, altosCanon, mundoJ, decorado }) {
  function segmentosBloqueo(k) {
    const segs = []; // [x1,z1,x2,z2]
    // las matas escondidas bajo lo construido no chocan; y lo del suelo (árboles, rocas, matas) solo choca a ras de
    // suelo: desde un adarve o una planta de arriba se pasa por encima (una roca bajo el adarve paraba al que andaba por él)
    const circulos = k === 0 ? obstaculos.filter(o => !o.oculto) : [];
    for (const c of mundo().construcciones) {
      for (const [key, p] of c.piezas) {
        // chimenea: en la planta baja no se entra en el hogar; más arriba, su cañón no se atraviesa
        if (p.hueco === 'h' && !p.obra && !window.__sinChoqueHogar && (k === 0 || k * ALTURA < (altosCanon.get(p) ?? altoCanon(c, p, P.subidaTejado)))) {
          const esq = huellaHogar(p, k > 0).map(q => localAMundo(c, q.lx, q.lz));
          for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]);
          continue;
        }
        if (p.k !== k && !(p.hueco === 'a' && k === 1)) continue;
        if (p.obra) continue; // una obra es solo un armazón: no corta el paso
        if (p.hueco === 'a' && !window.__sinChoqueAdarve) {
          // adarve: por debajo de su piso no se pasa (está a 1,5 m); encima, la empalizada no se salta (los otros
          // lados están abiertos: si sales por ellos, caes)
          const esq = [[p.i, p.j], [p.i + 1, p.j], [p.i + 1, p.j + 1], [p.i, p.j + 1]].map(([a, b]) => localAMundo(c, a * MODULO, b * MODULO));
          if (k === 0) { for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]); continue; }
          // los lados de la casilla, por dir (SUBE): 0 → +z (esq 2-3), 1 → -x (3-0), 2 → -z (0-1), 3 → +x (1-2)
          const LADO = [[2, 3], [3, 0], [0, 1], [1, 2]];
          for (const { dir } of empalizadasDe(c, p.i, p.j)) { const [a, b] = LADO[dir]; segs.push([esq[a].x, esq[a].z, esq[b].x, esq[b].z]); }
          continue;
        }
        if (p.hueco === 'v') {
          const m = localAMundo(c, p.i * MODULO, p.j * MODULO);
          circulos.push({ x: m.x, z: m.z, r: 0.16 });
          continue;
        }
        if (p.hueco === 'l' && PIEZAS[p.tipo].andando && trampillaCerrada(c, p.i, p.j, p.k)) {
          // escalera con la trampilla de arriba cerrada: no se puede subir, así que la casilla no se pisa
          const esq = [[p.i, p.j], [p.i + 1, p.j], [p.i + 1, p.j + 1], [p.i, p.j + 1]].map(([a, b]) => localAMundo(c, a * MODULO, b * MODULO));
          for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]);
          continue;
        }
        if (p.hueco !== 'e') continue;
        const def = PIEZAS[p.tipo];
        if (def.portón && p.abierta) continue;
        const a = p.d === 0 ? [p.i * MODULO, p.j * MODULO] : [p.i * MODULO, p.j * MODULO];
        const b = p.d === 0 ? [(p.i + 1) * MODULO, p.j * MODULO] : [p.i * MODULO, (p.j + 1) * MODULO];
        const pa = localAMundo(c, a[0], a[1]), pb = localAMundo(c, b[0], b[1]);
        if (def.conPuerta) {
          const puertaP = c.piezas.get(clave('p', p.i, p.j, p.k, p.d));
          const f = (P.anchoPuerta / 2) / MODULO;
          const m1 = { x: pa.x + (pb.x - pa.x) * (0.5 - f), z: pa.z + (pb.z - pa.z) * (0.5 - f) };
          const m2 = { x: pa.x + (pb.x - pa.x) * (0.5 + f), z: pa.z + (pb.z - pa.z) * (0.5 + f) };
          segs.push([pa.x, pa.z, m1.x, m1.z], [m2.x, m2.z, pb.x, pb.z]);
          if (puertaP && !puertaP.abierta) segs.push([m1.x, m1.z, m2.x, m2.z]);
        } else segs.push([pa.x, pa.z, pb.x, pb.z]);
      }
    }
    return { segs, circulos };
  }
  function resolverColision(x, z, k) {
    const R = 0.32;
    const { segs, circulos } = segmentosBloqueo(k);
    for (let it = 0; it < 3; it++) {
      for (const [x1, z1, x2, z2] of segs) {
        const dx = x2 - x1, dz = z2 - z1;
        const l2 = dx * dx + dz * dz;
        let u = ((x - x1) * dx + (z - z1) * dz) / l2;
        u = Math.max(0, Math.min(1, u));
        const px = x1 + u * dx, pz = z1 + u * dz;
        const ex = x - px, ez = z - pz, d = Math.hypot(ex, ez);
        const lim = R + 0.14;
        if (d < lim && d > 1e-6) { x = px + ex / d * lim; z = pz + ez / d * lim; }
      }
      for (const o of circulos) {
        const ex = x - o.x, ez = z - o.z, d = Math.hypot(ex, ez), lim = R + o.r;
        if (d < lim && d > 1e-6) { x = o.x + ex / d * lim; z = o.z + ez / d * lim; }
      }
    }
    return { x, z };
  }
  // Un paso de alguien que anda por el suelo del mundo (el rival de práctica): de (x0, z0) hacia (x1, z1) sin
  // atravesar obras ni árboles, sin subir cortados ni salir de la isla y sin meterse donde ya cubre (no nada). Si no
  // puede de frente, se desliza por un eje, como tú; si tampoco, se queda donde estaba.
  function andarHasta(x0, z0, x1, z1) {
    const r = resolverColision(x1, z1, 0);
    if (!mundoJ) return { x: THREE.MathUtils.clamp(r.x, -190, 190), z: THREE.MathUtils.clamp(r.z, -190, 190) };
    const vale = (x, z) => mundoJ.andable(x0, z0, x, z) && modoAgua(mundoJ.aguaEn(x, z)?.hondo) !== 'nadar';
    if (vale(r.x, r.z)) return r;
    if (vale(r.x, z0)) return { x: r.x, z: z0 };
    if (vale(x0, r.z)) return { x: x0, z: r.z };
    return { x: x0, z: z0 };
  }
  // altura del suelo bajo el jugador en su planta; baja de planta si no hay suelo
  // Escalera de tablas bajo el jugador: se sube andando. Devuelve { k, y } o null.
  // Si vienes por debajo del tramo alto (o caes por el hueco desde arriba muy por encima), no cuenta.
  function escaleraBajoJugador() {
    for (const c of mundo().construcciones) {
      const l = mundoALocal(c, pj.x, pj.z);
      const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
      for (const k0 of [pj.k, pj.k - 1]) {
        if (k0 < 0) continue;
        const p = escaleraAndando(c, i, j, k0);
        if (!p || trampillaCerrada(c, i, j, k0)) continue; // con la trampilla cerrada, la escalera no sube
        const t = progresoEscalera(p, l.lx, l.lz);
        const base = c.piezas.has(clave('f', i, j, k0)) ? (k0 === 0 ? P.superficieCimiento : P.superficieSuelo) : 0;
        const y0 = oyDe(c) + k0 * ALTURA + base, y1 = oyDe(c) + (adarveDeEscalera(c, p, false) ? ALTO_ADARVE : (k0 + 1) * ALTURA + P.superficieSuelo);
        const y = y0 + t * (y1 - y0);
        if (pj.k === k0 && y - pj.y > 0.8) continue; // estás debajo de la escalera, no encima
        return { k: t > 0.5 ? k0 + 1 : k0, y };
      }
    }
    return null;
  }
  // Tejado terminado de la casilla (i, j) que cubre la planta k - 1 (sus muros acaban a la altura de la planta k): altura
  // de su cara de arriba bajo el jugador, o null. Se pisa (valravnx, 31 oct: «los tejados deben poder ser pisables para
  // poder construir tejados con un solo andamio»): desde el andamio se sale al tramo de al lado y desde ahí se alcanza
  // el siguiente. Si su cara está muy por encima de tus pies (llegas por debajo, a un tramo alto), no se sube de golpe.
  // Grueso de cada tejado por encima de su plano, en vertical (m; del dibujo de modelos.js): paja en dos hiladas,
  // tablillas sobre la tablazón, tejas de canal y cobija.
  const SOBRE_TEJADO = { paja: 0.44, tablilla: 0.13, teja: 0.25 };
  function tejadoBajoJugador(c, i, j, k, l) {
    const key = clave('r', i, j, k), p = c.piezas.get(key);
    if (!p || p.obra || window.__sinPisarTejados) return null;
    const tj = geometriaTejados(c).get(key);
    const material = Object.keys(SOBRE_TEJADO).find(m => p.tipo.endsWith(m)) || 'tablilla';
    const y = oyDe(c) + k * ALTURA + altoTejadoEn(p, tj, l.lx, l.lz) * P.subidaTejado + SOBRE_TEJADO[material];
    return y - pj.y > 0.8 ? null : y;
  }
  function alturaSuelo() {
    const e = escaleraBajoJugador();
    if (e) { pj.k = e.k; return e.y; }
    for (let k = pj.k; k >= 0; k--) {
      for (const c of mundo().construcciones) {
        const l = mundoALocal(c, pj.x, pj.z);
        const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
        const f = c.piezas.get(clave('f', i, j, k));
        const oy = oyDe(c);
        if (f && !f.obra) { pj.k = k; return oy + k * ALTURA + (k === 0 ? P.superficieCimiento : P.superficieSuelo); }
        if (k === 1 && adarveEn(c, i, j)) { pj.k = 1; return oy + ALTO_ADARVE; } // en el piso del adarve
        if (k > 0 && trampillaCerrada(c, i, j, k - 1)) { pj.k = k; return oy + k * ALTURA + P.superficieSuelo; } // la trampilla cerrada se pisa
        if (k > 0 && andamioEn(c, i, j, k - 1)) { pj.k = k; return oy + k * ALTURA + P.superficieSuelo; } // plataforma del andamio
        if (k > 0) { const y = tejadoBajoJugador(c, i, j, k, l); if (y !== null) { pj.k = k; return y; } } // el tejado terminado se pisa
      }
      // sin suelo construido debajo, el terreno: llano en la zona de construir, y las lomas de más allá (donde está la
      // ladera con la piedra suelta y el sílex), que antes se cruzaban por dentro
      if (k === 0) { pj.k = 0; return decorado.altura(pj.x, pj.z); }
    }
    return 0;
  }

  return { segmentosBloqueo, resolverColision, andarHasta, escaleraBajoJugador, alturaSuelo };
}
