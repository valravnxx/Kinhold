// Kinhold — excavación (lógica pura, sin three.js): cavar zanjas y minas.
// La roca se divide en cubitos de TAM metros, en trozos de LADO³ cubitos. El mundo solo guarda los cubitos QUITADOS
// de cada trozo tocado (un bit por cubito: LADO³/8 bytes por trozo excavado; nada donde no ha cavado nadie).
// Lo que hay en cada sitio antes de cavar (roca o aire) lo dice el terreno base, que sale de una función (en el juego,
// de la semilla del mundo), así que no se guarda.
// Cada golpe es una acción con autor, como construir: el servidor la podrá validar, guardar y reproducir.

export const TAM = 0.5;            // lado de un cubito (m)
export const LADO = 16;            // cubitos por lado de un trozo (16 × 0,5 = 8 m)
export const RADIO_GOLPE = 0.8;    // radio del puñado de roca que quita un golpe de pico (m); con el suavizado, galerías de algo más de 1,5 m
export const ALCANCE = 2.6;        // distancia máxima del personaje al punto del golpe (m)

const clave = (cx, cy, cz) => `${cx},${cy},${cz}`;
// base64 de los bits de un trozo (en node y en el navegador)
const aTexto = (u8) => typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(String.fromCharCode(...u8));
const deTexto = (b) => typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(b, 'base64')) : Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const dividir = (i) => Math.floor(i / LADO);

export class Excavacion {
  // base(x, y, z) → true si en ese punto (centro de un cubito, en metros) hay roca antes de cavar
  constructor(base) { this.base = base; this.trozos = new Map(); this.version = 0; }

  quitado(ix, iy, iz) {
    const t = this.trozos.get(clave(dividir(ix), dividir(iy), dividir(iz)));
    if (!t) return false;
    const lx = ix - dividir(ix) * LADO, ly = iy - dividir(iy) * LADO, lz = iz - dividir(iz) * LADO;
    const n = (ly * LADO + lz) * LADO + lx;
    return (t[n >> 3] & (1 << (n & 7))) !== 0;
  }
  // ¿hay roca en el cubito (ix, iy, iz)?
  solido(ix, iy, iz) { return !this.quitado(ix, iy, iz) && this.base((ix + 0.5) * TAM, (iy + 0.5) * TAM, (iz + 0.5) * TAM); }

  quitar(ix, iy, iz) {
    const k = clave(dividir(ix), dividir(iy), dividir(iz));
    let t = this.trozos.get(k);
    if (!t) { t = new Uint8Array(LADO * LADO * LADO / 8); this.trozos.set(k, t); }
    const lx = ix - dividir(ix) * LADO, ly = iy - dividir(iy) * LADO, lz = iz - dividir(iz) * LADO;
    const n = (ly * LADO + lz) * LADO + lx;
    t[n >> 3] |= 1 << (n & 7);
    return k;
  }

  // Un golpe de pico: quita los cubitos de roca cuyo centro cae a menos de RADIO_GOLPE del punto (x, y, z).
  // accion = { autor, x, y, z, desde: {x, y, z} (dónde está el personaje) }.
  // Devuelve { ok, quitados, trozos: [claves tocadas, también las vecinas cuya malla cambia], motivo }.
  golpe(accion) {
    const { autor, x, y, z, desde } = accion || {};
    if (!autor) return { ok: false, motivo: 'sin autor' };
    if (![x, y, z].every(Number.isFinite)) return { ok: false, motivo: 'punto no válido' };
    if (desde && Math.hypot(x - desde.x, y - desde.y, z - desde.z) > ALCANCE) return { ok: false, motivo: 'demasiado lejos' };
    const r = RADIO_GOLPE, tocados = new Set();
    let quitados = 0;
    for (let ix = Math.floor((x - r) / TAM); ix <= Math.floor((x + r) / TAM); ix++)
      for (let iy = Math.floor((y - r) / TAM); iy <= Math.floor((y + r) / TAM); iy++)
        for (let iz = Math.floor((z - r) / TAM); iz <= Math.floor((z + r) / TAM); iz++) {
          const cx = (ix + 0.5) * TAM - x, cy = (iy + 0.5) * TAM - y, cz = (iz + 0.5) * TAM - z;
          if (cx * cx + cy * cy + cz * cz > r * r || !this.solido(ix, iy, iz)) continue;
          this.quitar(ix, iy, iz); quitados++;
          // la malla de un trozo depende de los cubitos vecinos: los trozos de al lado también se rehacen
          for (const dx of [-3, 0, 3]) for (const dy of [-3, 0, 3]) for (const dz of [-3, 0, 3])
            tocados.add(clave(dividir(ix + dx), dividir(iy + dy), dividir(iz + dz)));
        }
    if (!quitados) return { ok: false, motivo: 'no hay roca ahí' };
    this.version++;
    return { ok: true, quitados, trozos: [...tocados], autor };
  }

  // Para guardar y mandar: solo los trozos tocados, cada uno como texto base64 de sus bits.
  serializar() {
    const datos = {};
    for (const [k, t] of this.trozos) datos[k] = aTexto(t);
    return datos;
  }
  static deserializar(base, datos) {
    const e = new Excavacion(base);
    for (const [k, b] of Object.entries(datos || {})) e.trozos.set(k, deTexto(b));
    return e;
  }
}
