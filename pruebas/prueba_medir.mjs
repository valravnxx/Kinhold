// Prueba de la medición del servidor (servidor/medir.mjs, hito 1f).
// Ejecutar: node pruebas/prueba_medir.mjs
// Seis bots durante 14 s contra el servidor en su propio proceso. Comprueba que hay muestras de cada segundo,
// que el resumen trae CPU, memoria, bucle, red y disco con valores con sentido (la CPU mayor que 0, la red que
// sale del servidor al menos lo que dicen haber recibido los bots en ese rato, el disco que crece con las obras),
// que los seis siguen conectados, que la bienvenida se mide y que el servidor se cierra.
// Con MUTAR=1 se mide con una copia que no cuenta la CPU: debe FALLAR.
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

let ruta = join(raiz, 'servidor/medir.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('(cpu.user + cpu.system) / 1000', '0 / 1000');
  if (mutada === fuente) { console.log('No se pudo mutar la medición'); process.exit(1); }
  copia = join(raiz, 'servidor/.medir_mutado.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
try {
  const { medir, CALENTAR } = await import(pathToFileURL(ruta).href);
  const N = 6, S = 14;
  console.log(`Medición con ${N} bots durante ${S} s`);
  const r = await medir({ bots: N, segundos: S });
  const R = r.resumen;
  comprobar('una muestra por segundo', r.muestras.length >= S - 1 && r.muestras.length <= S + 2, `${r.muestras.length} muestras`);
  comprobar('hay resumen (sin los primeros segundos)', !!R && R.segundosMedidos >= S - CALENTAR - 2, R ? `${R.segundosMedidos} s` : 'sin resumen');
  if (R) {
    comprobar('la CPU del servidor se mide', R.cpuNucleoPct.media > 0 && R.cpuNucleoPct.max < 400, JSON.stringify(R.cpuNucleoPct));
    comprobar('la memoria se mide', R.memoriaMB.rssMax > 20 && R.memoriaMB.heapMax > 1, JSON.stringify(R.memoriaMB));
    comprobar('el retraso del bucle se mide', R.bucleMs.max >= 0 && R.bucleMs.p99Max >= R.bucleMs.p99Medio, JSON.stringify(R.bucleMs));
    // los bots reciben unos 10 estados y 20 tics de luchadores por segundo: de la red sale bastante más que lo que entra
    comprobar('sale tráfico del servidor', R.red.salidaPorJugadorKBs > 0.5 && R.red.salidaKBs > R.red.entradaKBs, JSON.stringify(R.red));
    const recibido = r.deLosBots.porBotYSegundo.bytesRecibidos / 1024;
    comprobar('la red medida en los sockets cuadra con lo que reciben los bots', R.red.salidaPorJugadorKBs >= recibido * 0.6 && R.red.salidaPorJugadorKBs <= recibido * 2,
      `${R.red.salidaPorJugadorKBs} KB/s por jugador en el servidor, ${recibido.toFixed(1)} en los bots`);
    comprobar('entra el estado de cada uno (unos 10 por segundo)', R.red.entradaPorJugadorKBs > 0.3, `${R.red.entradaPorJugadorKBs} KB/s`);
    comprobar('el mundo crece en disco', R.disco.alFinalMB >= 0 && R.disco.crecimientoMBHora > 0, JSON.stringify(R.disco));
    comprobar('siguen todos conectados', R.conectadosMin === N, `${R.conectadosMin}`);
  }
  comprobar('se mide la bienvenida', r.bienvenidaBytes > 100, `${r.bienvenidaBytes} bytes`);
  comprobar('los bots no tienen errores', r.deLosBots.errores === 0 && r.deLosBots.conectados === N);
  comprobar('se apunta la máquina', r.maquina.nucleos > 0 && !!r.maquina.cpu);
} finally {
  if (copia) rmSync(copia, { force: true });
}
console.log(`\nMedición: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
