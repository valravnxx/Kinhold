// Desconectarse (GDD, apartado 6; tarea del hito de supervivencia). Lógica pura (sin red): la usa servidor/servidor.mjs
// y la pueden usar las pruebas sin servidor.
//
// Al desconectarse, el personaje se queda dormido en el mundo, donde estaba, con su símbolo de desconectado encima (lo
// ven los demás: su presencia sigue, con la animación DESCONECTADO).
//   - En tu tierra (la tuya o la de quien te ha invitado a construir): protegido desde el primer momento, como tu base.
//   - Fuera de ella: atacable donde está unos minutos, VULNERABLE (5), o VULNERABLE_PELEA (15) si peleaste en el último
//     PELEA_RECIENTE (un minuto). Pasado ese tiempo, si tiene cama ligada pasa a ella; si no, se queda donde estaba,
//     pero ya no se le puede hacer nada.
//   - En tu tierra, si tienes cama ligada, pasas a ella enseguida (GDD: «va a su cama automáticamente»).
// Al volver a conectar se despierta donde está dormido (en la cama, si pasó a ella). Los tiempos, para ajustar.
export const VULNERABLE = 5 * 60 * 1000;          // ms atacable fuera de tu tierra
export const VULNERABLE_PELEA = 15 * 60 * 1000;   // ms si peleaste justo antes
export const PELEA_RECIENTE = 60 * 1000;          // ms: «en el último minuto»
export const DESCONECTADO = 'desconectado';       // la animación con la que se ve a quien duerme desconectado

// Cuánto tiempo (ms) se queda atacable al desconectarse. enTierra: en la suya o en la de quien le ha invitado;
// ultimaPelea: la hora (ms) de su último golpe o flecha dada o recibida (o null).
export function tiempoVulnerable({ enTierra, ultimaPelea = null, ahora, tiempos = {} }) {
  if (enTierra) return 0;
  const { vulnerable = VULNERABLE, pelea = VULNERABLE_PELEA, reciente = PELEA_RECIENTE } = tiempos;
  return Number.isFinite(ultimaPelea) && ahora - ultimaPelea <= reciente ? pelea : vulnerable;
}

export class Dormidos {
  // tiempos: { vulnerable, pelea, reciente } en ms (las pruebas los acortan)
  constructor(tiempos = {}) { this.tiempos = tiempos; this.lista = new Map(); }   // autor → { x, y, z, giro, desde, hasta, cama }
  // Se queda dormido en pos ({ x, y, z, giro }). cama: { x, y, z } de su cama ligada, o null. Devuelve lo apuntado:
  // { ..., hasta } (hasta: la hora hasta la que es atacable; igual a desde si está protegido) y si ya está en la cama.
  dormir(autor, pos, { ahora, enTierra = false, ultimaPelea = null, cama = null }) {
    const dura = tiempoVulnerable({ enTierra, ultimaPelea, ahora, tiempos: this.tiempos });
    const d = { x: pos.x, y: pos.y, z: pos.z, giro: pos.giro || 0, desde: ahora, hasta: ahora + dura, cama: cama ? { x: cama.x, y: cama.y, z: cama.z } : null, enCama: false };
    this.lista.set(autor, d);
    if (dura === 0 && d.cama) this.aLaCama(d);
    return d;
  }
  aLaCama(d) { d.x = d.cama.x; d.y = d.cama.y; d.z = d.cama.z; d.enCama = true; }
  esta(autor) { return this.lista.has(autor); }
  de(autor) { return this.lista.get(autor) || null; }
  // ¿se le puede atacar ahora? (dormido y aún en su tiempo vulnerable)
  atacable(autor, ahora) { const d = this.lista.get(autor); return !!d && ahora < d.hasta; }
  // Los que acaban de dejar de ser atacables (su tiempo ha pasado): quedan protegidos y, con cama, pasan a ella.
  // Devuelve [{ autor, d, cama }] (cama: true si se ha movido a ella).
  revisar(ahora) {
    const fin = [];
    for (const [autor, d] of this.lista) {
      if (d.protegido || ahora < d.hasta) continue;
      d.protegido = true;
      const cama = !!d.cama && !d.enCama;
      if (cama) this.aLaCama(d);
      fin.push({ autor, d, cama });
    }
    return fin;
  }
  // Se despierta (vuelve a conectar o se le quita del mundo). Devuelve dónde estaba dormido, o null.
  despertar(autor) { const d = this.lista.get(autor) || null; this.lista.delete(autor); return d; }
  autores() { return [...this.lista.keys()]; }
}
