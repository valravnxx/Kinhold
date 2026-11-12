// El guardado del servidor en archivos (partido de servidor/servidor.mjs, 12 nov): leer el registro del mundo, el
// estado compactado (mundo_estado.json) y cambiar un guardado por el nuevo sin dejarlo a medias.
import { readFileSync, existsSync, writeFileSync, renameSync, statSync, openSync, readSync, closeSync } from 'fs';
import { rename } from 'fs/promises';
import { reproducir, reproducirDesde } from '../src/logica/acciones.js';

// Lee el archivo del mundo. Una línea cortada al final (el servidor se apagó a mitad) se descarta.
export function leerArchivo(archivo) {
  if (!existsSync(archivo)) return [];
  return leerLineas(readFileSync(archivo, 'utf8'));
}
function leerLineas(texto) {
  const entradas = [];
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue;
    try { entradas.push(JSON.parse(linea)); } catch (e) { console.warn('Línea del mundo no válida, se descarta:', linea.slice(0, 80)); }
  }
  return entradas;
}

// El registro del mundo compactado (auditoría del 4 nov; 12 nov). Al arrancar, el servidor guarda el mundo entero en
// mundo_estado.json, junto al registro: { version, n (la última acción que lleva), bytes (hasta dónde del registro),
// cola (los últimos bytes de ese trozo, para saber que el registro es el mismo), mundo (Mundo.exportar()) }. La vez
// siguiente parte de ahí y solo reproduce lo que vino después, en vez de cada acción desde el primer día. El registro
// entero se queda (para auditar). Si el estado no casa con el registro (el registro es más corto o es otro: un wipe a
// medias, una copia de otro día), no se usa: se rehace todo desde el registro, como antes.
const COLA = 256;
export function trozo(archivo, desde, hasta) {
  const fd = openSync(archivo, 'r');
  try { const b = Buffer.alloc(hasta - desde); let leidos = 0; while (leidos < b.length) { const n = readSync(fd, b, leidos, b.length - leidos, desde + leidos); if (!n) break; leidos += n; } return b.subarray(0, leidos); }
  finally { closeSync(fd); }
}
const colaDe = (archivo, bytes) => bytes > 0 ? trozo(archivo, Math.max(0, bytes - COLA), bytes).toString('base64') : '';
export function cargarMundo(archivo, archivoEstado, registrar = () => {}) {
  const tam = existsSync(archivo) ? statSync(archivo).size : 0;
  let estado = null;
  if (existsSync(archivoEstado)) {
    try {
      const e = JSON.parse(readFileSync(archivoEstado, 'utf8'));
      if (e && e.version === 1 && Number.isInteger(e.n) && Number.isInteger(e.bytes) && e.bytes >= 0 && e.bytes <= tam && e.mundo && e.cola === colaDe(archivo, e.bytes)) estado = e;
      else registrar('mundo_estado.json no casa con el registro: se rehace el mundo entero desde el registro');
    } catch (x) { registrar(`mundo_estado.json no válido, se rehace el mundo entero desde el registro: ${x && x.message}`); }
  }
  if (!estado) {
    const previas = leerArchivo(archivo);
    return { mundo: reproducir(previas), total: previas.reduce((m, e) => Math.max(m, e.n || 0), 0), reproducidas: previas.length, compactado: false };
  }
  const resto = estado.bytes < tam ? leerLineas(trozo(archivo, estado.bytes, tam).toString('utf8')) : [];
  return { mundo: reproducirDesde(estado.mundo, resto), total: resto.reduce((m, e) => Math.max(m, e.n || 0), estado.n), reproducidas: resto.length, compactado: true };
}
// guarda el estado entero del mundo (después de cargarlo y de cerrar la línea a medias, antes de apuntar nada nuevo)
export function guardarEstadoMundo(archivo, archivoEstado, mundo, n, registrar = () => {}) {
  const bytes = existsSync(archivo) ? statSync(archivo).size : 0;
  try {
    writeFileSync(archivoEstado + '.tmp', JSON.stringify({ version: 1, n, bytes, cola: colaDe(archivo, bytes), t: new Date().toISOString(), mundo: mundo.exportar() }));
    reemplazar(archivoEstado + '.tmp', archivoEstado, registrar);
  } catch (x) { registrar(`no se ha podido guardar mundo_estado.json: ${x && x.message}`); }
}

// Cambia el guardado por el nuevo (escrito en .tmp). En Windows, si alguien tiene el archivo abierto en ese momento
// (las pruebas lo leen a menudo), cambiarlo falla con EPERM o EBUSY: se reintenta un poco y, si no, se dice y se sigue
// (se guardará la vez siguiente). Antes, el fallo cortaba la acción antes de contestar al jugador.
const ESPERA = new Int32Array(new SharedArrayBuffer(4));
// Lo mismo sin bloquear (para objetos.json, que se guarda a menudo): si falla, se dice y se guardará la vez siguiente.
export async function reemplazarSinEsperar(tmp, dest, registrar = console.error) {
  for (let i = 0; ; i++) {
    try { await rename(tmp, dest); return true; } catch (e) {
      if (i >= 25 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { registrar(`no se ha podido guardar ${dest} (${e.code}); se guardará la próxima vez`); return false; }
      await new Promise(r => setTimeout(r, 8));
    }
  }
}
// Cada cuánto, como mucho, se reescribe objetos.json (ms)
export const GUARDAR_CADA = 1000;
export function reemplazar(tmp, dest, registrar = console.error) {
  for (let i = 0; ; i++) {
    try { renameSync(tmp, dest); return true; } catch (e) {
      if (i >= 25 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { registrar(`no se ha podido guardar ${dest} (${e.code}); se guardará la próxima vez`); return false; }
      Atomics.wait(ESPERA, 0, 0, 8);
    }
  }
}
