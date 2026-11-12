// Pruebas del registro del mundo compactado (servidor/servidor.mjs: cargarMundo y guardarEstadoMundo; auditoría del 4 nov).
// Ejecutar: node pruebas/prueba_compactar_mundo.mjs
// Comprueba que el mundo que sale del estado guardado (mundo_estado.json) más lo que vino después es el mismo que
// reproduciendo el registro entero desde el primer día; que lo que pasa después sale igual en los dos; que el registro
// entero se queda; y que un estado que no casa con el registro (más corto, cambiado, roto) no se usa.
// Con MUTAR=1 se guarda el estado sin la última acción: las pruebas deben FALLAR.
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, existsSync, statSync, truncateSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Mundo, tiempoObra } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';
import { cargarMundo, guardarEstadoMundo } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const foto = (m) => JSON.stringify(m.exportar());
const dir = mkdtempSync(join(tmpdir(), 'kinhold-compactar-'));
const archivo = join(dir, 'mundo.jsonl'), archivoEstado = join(dir, 'mundo_estado.json');

// un mundo de verdad con dos jugadores: mojones, cimiento terminado entre dos, muro, puerta, una obra a medias,
// algo desmontado y acciones rechazadas (que también van al registro)
const m = new Mundo(), reg = new RegistroAcciones();
const escribir = () => { if (reg.entradas.length) appendFileSync(archivo, reg.entradas.map(e => JSON.stringify(e)).join('\n') + '\n'); reg.entradas.length = 0; };
const A = (autor, a) => ejecutar(m, reg, { autor, ...a });
const yo = 'jugador:a', otro = 'jugador:b';
A(yo, { tipo: 'mojon', x: 0, z: 0 });
A(otro, { tipo: 'mojon', x: 0, z: 0 });   // rechazada (ya hay mojón): va al registro
const r = A(yo, { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
const c = r.construccion, kc = r.clave;
A(yo, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: 5 });
A(otro, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: 50 });
for (let i = 0; i < 2 * tiempoObra('cim_piedra'); i++) A(i % 2 ? otro : yo, { tipo: 'trabajar', construccion: c.id, clave: kc, segundos: 0.5 });
escribir();

console.log('Primer arranque: sin estado guardado, desde el registro entero');
const primero = cargarMundo(archivo, archivoEstado);
comprobar('sin mundo_estado.json se reproduce el registro entero', !primero.compactado && primero.reproducidas === reg.total, `${primero.reproducidas} de ${reg.total}`);
comprobar('y sale el mismo mundo que el de la partida', foto(primero.mundo) === foto(m));
comprobar('la última acción es la última del registro', primero.total === reg.total, `${primero.total}`);
guardarEstadoMundo(archivo, archivoEstado, primero.mundo, MUTAR ? primero.total - 1 : primero.total);
if (MUTAR) { const e = JSON.parse(readFileSync(archivoEstado, 'utf8')); e.mundo = reproducir(readFileSync(archivo, 'utf8').trim().split('\n').map(l => JSON.parse(l)).slice(0, -2)).exportar(); writeFileSync(archivoEstado, JSON.stringify(e)); }
comprobar('se guarda el estado entero', existsSync(archivoEstado) && JSON.parse(readFileSync(archivoEstado, 'utf8')).bytes === statSync(archivo).size);

// la partida sigue: más obra, una puerta, una pieza desmontada, una obra a medias
const rp = A(yo, { tipo: 'colocar', pieza: 'muro_tronco_puerta', x: 1, z: -0.95, k: 0, rot: 0, dir: 0 });
acabarObra(m, reg, yo, c.id, rp.clave);
A(yo, { tipo: 'colocar', pieza: 'puerta_varas', x: 1, z: -0.95, k: 0, rot: 0, dir: 0 });
const mu = A(otro, { tipo: 'colocar', pieza: 'muro_tronco', x: 0, z: 0.05, k: 0, rot: 0, dir: 1 });
if (mu.ok) A(otro, { tipo: 'entregar', construccion: c.id, clave: mu.clave, material: 'tronco', cantidad: 2 });
A(yo, { tipo: 'trabajar', construccion: c.id, clave: kc, segundos: 1 });   // rechazada: ya está terminada
escribir();
const tamAntes = statSync(archivo).size;

console.log('Segundo arranque: desde el estado guardado y lo que vino después');
const entero = reproducir(readFileSync(archivo, 'utf8').trim().split('\n').map(l => JSON.parse(l)));
const segundo = cargarMundo(archivo, archivoEstado);
comprobar('se parte del estado guardado', segundo.compactado);
comprobar('solo se reproduce lo que vino después', segundo.reproducidas > 0 && segundo.reproducidas < reg.total, `${segundo.reproducidas} de ${reg.total}`);
comprobar('el mundo compactado es el mismo que reproduciendo el registro entero', foto(segundo.mundo) === foto(entero));
comprobar('y el mismo que el de la partida', foto(segundo.mundo) === foto(m));
comprobar('la cuenta de acciones sigue donde iba', segundo.total === reg.total, `${segundo.total} / ${reg.total}`);
comprobar('el registro entero se queda (para auditar)', statSync(archivo).size === tamAntes && readFileSync(archivo, 'utf8').trim().split('\n').length === reg.total);

// lo que pasa después sale igual en el mundo compactado y en el rehecho desde cero
{
  const ra = new RegistroAcciones(), rb = new RegistroAcciones();
  const k = [...segundo.mundo.construcciones[0].piezas.entries()].find(([, p]) => p.obra);
  const sig = [
    { autor: otro, tipo: 'entregar', construccion: c.id, clave: k ? k[0] : 'x', material: 'tronco', cantidad: 9 },
    { autor: yo, tipo: 'colocar', pieza: 'muro_tronco', x: -1, z: -0.95, k: 0, rot: 0, dir: 0 },
    { autor: otro, tipo: 'desmontar', construccion: c.id, clave: k ? k[0] : 'x' },
  ];
  const resA = sig.map(a => { const x = ejecutar(segundo.mundo, ra, a); return [x.ok, x.motivo || '']; });
  const resB = sig.map(a => { const x = ejecutar(entero, rb, a); return [x.ok, x.motivo || '']; });
  comprobar('lo que se hace después sale igual en los dos (mismas respuestas y mismo mundo)', JSON.stringify(resA) === JSON.stringify(resB) && foto(segundo.mundo) === foto(entero), JSON.stringify(resA));
}

console.log('Un estado que no casa con el registro no se usa');
{
  // al volver a guardar, el estado cubre el registro entero: no hay nada que reproducir
  guardarEstadoMundo(archivo, archivoEstado, m, reg.total);
  const tercero = cargarMundo(archivo, archivoEstado);
  comprobar('con el estado al día no se reproduce nada', tercero.compactado && tercero.reproducidas === 0 && foto(tercero.mundo) === foto(m));
  const avisos = [];
  // el registro, más corto que el estado (una copia de antes)
  const copia = readFileSync(archivo);
  truncateSync(archivo, tamAntes - 40);
  const corto = cargarMundo(archivo, archivoEstado, x => avisos.push(x));
  comprobar('si el registro es más corto que el estado, se rehace desde el registro', !corto.compactado && avisos.length === 1, avisos[0] || '');
  // el mismo tamaño, pero otro registro (los últimos bytes no casan)
  writeFileSync(archivo, copia); const t = readFileSync(archivo, 'utf8'); writeFileSync(archivo, t.slice(0, -3) + (t.at(-3) === '}' ? ']' : '}') + t.slice(-2));
  const otroReg = cargarMundo(archivo, archivoEstado, x => avisos.push(x));
  comprobar('si el registro es otro, se rehace desde el registro', !otroReg.compactado && avisos.length === 2, avisos[1] || '');
  writeFileSync(archivo, copia);
  writeFileSync(archivoEstado, '{ roto');
  const roto = cargarMundo(archivo, archivoEstado, x => avisos.push(x));
  comprobar('un mundo_estado.json roto no para el arranque: se rehace desde el registro', !roto.compactado && foto(roto.mundo) === foto(m) && avisos.length === 3);
  // wipe: se borra todo (los .json y .jsonl): se empieza de cero
  rmSync(archivo); rmSync(archivoEstado);
  const cero = cargarMundo(archivo, archivoEstado);
  comprobar('tras un wipe, el mundo empieza vacío', cero.total === 0 && foto(cero.mundo) === foto(new Mundo()));
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${ok} correctas, ${mal} fallan`);
process.exit(mal ? 1 : 0);
