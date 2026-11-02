// El correo de la cuenta y su verificación (cuentas más seguras, valravnx, 2 nov: «verificadas con email»; correos por
// Resend; sin confirmar el correo no se entra en el mundo). Lógica pura: el servidor le da el azar y la hora, y manda el
// correo (servidor/correo.mjs).
// - El correo es obligatorio al crear la cuenta, y un correo es de una sola cuenta (sin mayúsculas).
// - Al pedirlo llega un código de CODIGO_CIFRAS cifras que caduca a los CODIGO_VIDA ms. Pedir otro (reenviar) deja sin
//   valer el de antes; entre uno y otro, REENVIO_ESPERA ms, y como mucho ENVIOS_HORA a la misma cuenta y ENVIOS_HORA al
//   mismo correo en una hora (para no llenar el buzón de nadie).
// - FALLOS_CODIGO códigos mal seguidos y ese código deja de valer: hay que pedir otro.
// - El código no se guarda en claro ni en disco: solo su resumen, en memoria (si el servidor se reinicia, se pide otro).
// (Números provisionales: registro en el diario.)

export const CORREO_MAX = 254;
export const CODIGO_CIFRAS = 6;
export const CODIGO_VIDA = 15 * 60 * 1000;
export const REENVIO_ESPERA = 60 * 1000;
export const ENVIOS_HORA = 5;
export const FALLOS_CODIGO = 5;
const HORA = 60 * 60 * 1000;

import { Contador } from './cuentas.js';

// usuario@dominio.algo, sin espacios ni comillas ni < >; el dominio con un punto y letras al final
const FORMA_CORREO = /^[^\s@<>"'(),;:\\[\]]+@[^\s@<>"'(),;:\\[\]]+\.[\p{L}]{2,}$/u;

export const claveDeCorreo = (c) => String(c).trim().normalize('NFC').toLowerCase();

export function motivoCorreo(c) {
  if (typeof c !== 'string' || !c.trim()) return 'Falta el correo.';
  const t = c.trim();
  if (t.length > CORREO_MAX || !FORMA_CORREO.test(t) || t.includes('..')) return 'Ese correo no es válido.';
  return null;
}

// a***@d***.com: lo que se enseña del correo (en la pantalla y en el registro)
export function enmascarar(c) {
  if (typeof c !== 'string' || !c.includes('@')) return '';
  const [u, d] = c.split('@');
  const p = d.lastIndexOf('.');
  const dom = p > 0 ? d.slice(0, p) : d, fin = p > 0 ? d.slice(p) : '';
  return `${u.slice(0, 1)}***@${dom.slice(0, 1)}***${fin}`;
}

export const codigoValido = (c) => typeof c === 'string' && new RegExp(`^\\d{${CODIGO_CIFRAS}}$`).test(c.trim());

// Los códigos pendientes de cada cuenta. azar() → número entero de 0 a 10^CODIGO_CIFRAS - 1 (del servidor, criptográfico);
// resumir(texto) → texto (rápido; el código caduca pronto y tiene pocos intentos).
export class Verificaciones {
  constructor({ azar, resumir = (x) => x, vida = CODIGO_VIDA, espera = REENVIO_ESPERA, envios = ENVIOS_HORA } = {}) {
    this.azar = azar; this.resumir = resumir; this.vida = vida; this.espera = espera;
    this.pendientes = new Map();   // clave de usuario → { correo, h, hasta, fallos, t }
    this.porCuenta = new Contador(envios, HORA);
    this.porCorreo = new Contador(envios, HORA);
  }
  // ms que faltan para poder pedir otro código para esa cuenta (0 si ya se puede)
  falta(k, correo, ahora) {
    const p = this.pendientes.get(k);
    const reenvio = p ? Math.max(0, p.t + this.espera - ahora) : 0;
    return Math.max(reenvio, this.porCuenta.falta(k, ahora), this.porCorreo.falta(claveDeCorreo(correo), ahora));
  }
  // Un código nuevo para la cuenta k y ese correo. Devuelve { ok, codigo } (el que hay que mandar) o { ok: false, motivo, falta }.
  pedir(k, correo, ahora) {
    const falta = this.falta(k, correo, ahora);
    if (falta > 0) {
      const s = Math.ceil(falta / 1000);
      return { ok: false, falta, motivo: s <= 90 ? `Espera ${s} s para pedir otro código.` : `Demasiados códigos; prueba dentro de ${Math.ceil(s / 60)} min.` };
    }
    const codigo = String(this.azar()).padStart(CODIGO_CIFRAS, '0').slice(-CODIGO_CIFRAS);
    this.pendientes.set(k, { correo, h: this.resumir(k + ':' + codigo), hasta: ahora + this.vida, fallos: 0, t: ahora });
    this.porCuenta.sumar(k, ahora); this.porCorreo.sumar(claveDeCorreo(correo), ahora);
    return { ok: true, codigo };
  }
  // ¿Vale ese código para la cuenta k? Devuelve { ok, correo } (el correo confirmado) o { ok: false, motivo }.
  comprobar(k, codigo, ahora) {
    const p = this.pendientes.get(k);
    if (!p) return { ok: false, motivo: 'No hay ningún código pendiente; pide uno.' };
    if (ahora >= p.hasta) { this.pendientes.delete(k); return { ok: false, motivo: 'El código ha caducado; pide otro.' }; }
    if (!codigoValido(codigo) || this.resumir(k + ':' + codigo.trim()) !== p.h) {
      p.fallos++;
      if (p.fallos >= FALLOS_CODIGO) { this.pendientes.delete(k); return { ok: false, motivo: 'Demasiados códigos mal; pide otro.' }; }
      return { ok: false, motivo: 'El código no es correcto.' };
    }
    this.pendientes.delete(k);
    return { ok: true, correo: p.correo };
  }
  olvidar(k) { this.pendientes.delete(k); }
}
