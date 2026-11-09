// Kinhold — cazar con la lanza endurecida (P4, «Un primer día con sentido»; GDD, apartado 14: la caza). Lógica pura (sin
// three.js ni websocket): la lleva el servidor, para que el acierto lo decida él con su autor, y la usan las pruebas.
//
// Lanzar: el jugador lanza la lanza que lleva en la mano hacia donde mira (un ángulo, dir, como el giro del personaje:
// 0 hacia +Z). Sale de la mano (deja de llevarla) y vuela por el aire, en línea recta sobre el suelo, a VEL m/s, hasta
// ALCANCE m. Cada tic el servidor la adelanta y mira si en ese tramo pasa a menos de RADIO m de una liebre (con las
// liebres donde están en ese momento: la que huye puede escaparse). Si da en una, la liebre cae muerta ahí (una
// «liebre» en el suelo, para despiezarla) y la lanza cae a su lado; si no, la lanza cae al final de su vuelo. Siempre
// queda en el suelo para recogerla. Si delante hay algo que no deja pasar (agua honda, un cortado), cae ahí.
//
// Decisiones provisionales (registro de la demo y diario, 9 nov): las cifras de aquí. Una lanza de madera lanzada a mano
// caza de verdad a 10–20 m; aquí, hasta 20 m a 16 m/s (algo más de un segundo de vuelo a lo más lejos). La liebre
// muerta no vuelve a salir en su querencia hasta REAPARECE s (media hora; lo lleva la fauna).

export const CAZA = { ALCANCE: 20, VEL: 16, RADIO: 0.45 };
export const SE_LANZA = new Set(['lanza_endurecida']);
const r2 = v => Math.round(v * 100) / 100;

// La distancia de (px, pz) al tramo de (ax, az) a (bx, bz) y lo avanzado (0–1) por él en el punto más cercano.
export function aTramo(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const u = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return { d: Math.hypot(px - (ax + dx * u), pz - (az + dz * u)), u };
}

// Las lanzas que vuelan. pisable(x, z): si la lanza puede seguir por ahí (lo da el servidor con el terreno).
export class Lanzas {
  constructor({ pisable = () => true } = {}) { this.pisable = pisable; this.vuelan = []; this.siguiente = 1; }
  // Una lanza que sale de (x, z) hacia dir. cosa: lo que se lanza ({ tipo, n }). Devuelve lo que se manda a todos.
  lanzar({ autor, x, z, dir, cosa }) {
    const l = { id: 'lz' + this.siguiente++, autor, x0: x, z0: z, dir, d: 0, cosa };
    this.vuelan.push(l);
    return Lanzas.foto(l);
  }
  static foto(l) { return { id: l.id, autor: l.autor, x: r2(l.x0), z: r2(l.z0), dir: r2(l.dir), vel: CAZA.VEL, alcance: CAZA.ALCANCE }; }
  // Avanza dt s con las liebres donde están ahora ([{ id, x, z }]). Devuelve las que caen:
  // [{ lanza, autor, cosa, x, z, liebre: id | null }] (x, z: donde cae la lanza; la liebre, en su sitio).
  avanzar(dt, liebres) {
    const caen = [];
    this.vuelan = this.vuelan.filter(l => {
      const s = Math.sin(l.dir), c = Math.cos(l.dir), d1 = Math.min(CAZA.ALCANCE, l.d + CAZA.VEL * dt);
      const ax = l.x0 + s * l.d, az = l.z0 + c * l.d;
      // hasta dónde llega en este tramo: si algo no la deja pasar, cae ahí (a pasos de medio metro)
      let fin = d1, para = false;
      for (let d = l.d + 0.5; d < d1 + 0.5; d += 0.5) {
        const e = Math.min(d, d1);
        if (!this.pisable(l.x0 + s * e, l.z0 + c * e)) { fin = Math.max(l.d, e - 0.5); para = true; break; }
      }
      const bx = l.x0 + s * fin, bz = l.z0 + c * fin;
      // la primera liebre que pasa a menos de RADIO en el tramo
      let mejor = null;
      for (const q of liebres) {
        const t = aTramo(q.x, q.z, ax, az, bx, bz);
        if (t.d <= CAZA.RADIO && (!mejor || t.u < mejor.u)) mejor = { q, u: t.u };
      }
      if (mejor) {
        caen.push({ lanza: l.id, autor: l.autor, cosa: l.cosa, x: r2(mejor.q.x - s * 0.3), z: r2(mejor.q.z - c * 0.3), liebre: mejor.q.id, lx: r2(mejor.q.x), lz: r2(mejor.q.z) });
        return false;
      }
      l.d = fin;
      if (para || fin >= CAZA.ALCANCE) { caen.push({ lanza: l.id, autor: l.autor, cosa: l.cosa, x: r2(bx), z: r2(bz), liebre: null }); return false; }
      return true;
    });
    return caen;
  }
}
