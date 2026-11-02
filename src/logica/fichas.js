// Las fichas de cada aparato (cuentas más seguras, valravnx, 2 nov). Lógica pura: el servidor (servidor/servidor.mjs) le
// da el resumen de cada ficha (sha256; la ficha en claro no se guarda) y la hora.
// - Cada ficha es la de un aparato: con ella ese navegador vuelve a ser su personaje sin pedir la contraseña.
// - Caduca a los FICHA_VIDA ms de darla si su personaje tiene cuenta: después hay que volver a entrar con usuario y
//   contraseña. La de un personaje sin cuenta no caduca: es lo único que lo une a su personaje (decisión provisional,
//   en el diario; cuando no se pueda jugar sin cuenta, todas caducan).
// - «Salir en todos los aparatos»: todas las fichas de ese personaje dejan de valer a la vez.
// Lo que se guarda (fichas.jsonl, una línea cada vez): { h, autor, t } al dar una ficha; { fuera: autor, t } al salir en
// todos los aparatos. Las líneas de antes, sin t (de antes de que caducaran), cuentan desde que arranca el servidor.

export const FICHA_VIDA = 30 * 24 * 60 * 60 * 1000;

export class Fichas {
  // conCuenta(autor) → si ese personaje tiene cuenta (solo esas caducan)
  constructor({ vida = FICHA_VIDA, conCuenta = () => true, lineas = [], ahora = Date.now() } = {}) {
    this.vida = vida; this.conCuenta = conCuenta;
    this.porResumen = new Map();   // h → { autor, t }
    for (const l of lineas) {
      if (!l || typeof l !== 'object') continue;
      if (typeof l.fuera === 'string') this.fuera(l.fuera);
      else if (typeof l.h === 'string' && typeof l.autor === 'string') this.poner(l.h, l.autor, Number.isFinite(l.t) ? l.t : ahora);
    }
  }
  get total() { return this.porResumen.size; }
  poner(h, autor, t) { this.porResumen.set(h, { autor, t }); }
  // el autor de esa ficha, o null (no existe, o ha caducado: entonces se olvida y caducada dice true)
  de(h, ahora) {
    const f = this.porResumen.get(h);
    if (!f) return { autor: null, caducada: false };
    if (ahora - f.t >= this.vida && this.conCuenta(f.autor)) { this.porResumen.delete(h); return { autor: null, caducada: true }; }
    return { autor: f.autor, caducada: false };
  }
  // todas las de un personaje dejan de valer; devuelve cuántas eran
  fuera(autor) {
    let n = 0;
    for (const [h, f] of this.porResumen) if (f.autor === autor) { this.porResumen.delete(h); n++; }
    return n;
  }
  deAutor(autor) { let n = 0; for (const f of this.porResumen.values()) if (f.autor === autor) n++; return n; }
}
