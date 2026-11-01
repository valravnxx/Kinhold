// Contraseñas de las cuentas: resumen lento con sal (scrypt, de node), para src/logica/cuentas.js.
// scrypt con N = 2^16, r = 8, p = 1 (64 MiB de memoria por resumen) y 64 bytes; sal de 16 bytes al azar por cuenta.
// Se hace en segundo plano (los hilos de libuv): no para el juego mientras resume. Decisión provisional (diario del 1 nov).
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';

export const PARAMETROS = { N: 1 << 16, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };

export const sal = () => randomBytes(16).toString('hex');

export const resumir = (clave, salHex, parametros = PARAMETROS) => new Promise((bien, mal) =>
  scrypt(String(clave).normalize('NFC'), Buffer.from(salHex, 'hex'), 64, parametros, (e, k) => (e ? mal(e) : bien(k.toString('hex')))));

export const iguales = (a, b) => {
  const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};
