// Prueba de las cuentas (usuario y contraseña; src/logica/cuentas.js, servidor/claves.mjs y el servidor).
// Ejecutar: node pruebas/prueba_cuentas.mjs
// Comprueba:
//   - lógica pura: qué usuario y qué contraseña valen; crear y entrar; usuario repetido (también con otras mayúsculas);
//     un personaje, una cuenta; contraseña mala y usuario que no existe dan el mismo motivo; demasiados intentos a una
//     cuenta y desde una dirección (y que se pasa con el tiempo); demasiadas altas; dos altas a la vez del mismo usuario;
//   - la contraseña se resume con sal (scrypt): dos cuentas con la misma contraseña no tienen el mismo resumen;
//   - con clientes de verdad por websocket: crear la cuenta se queda con el personaje de la conexión; entrar desde otro
//     «aparato» da una ficha con la que se vuelve a ser ese personaje (y la conexión vieja se cierra); contraseña mala,
//     usuario repetido y demasiados intentos se rechazan; las cuentas siguen tras reiniciar el servidor; la contraseña no
//     aparece nunca en cuentas.jsonl ni en el registro; mensajes raros no tumban nada.
// Con MUTAR=1 se prueba un servidor que da por buena cualquier contraseña: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { Cuentas, motivoUsuario, motivoClave, validarPeticionCuenta, FALLOS_USUARIO, FALLOS_ORIGEN, ESPERA, ALTAS_ORIGEN } from '../src/logica/cuentas.js';
import * as claves from '../servidor/claves.mjs';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('resumir: (c, s) => claves.resumir(c, s, parametrosClave)', "resumir: (c, s) => claves.resumir('igual', s, parametrosClave)");
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_cuentas.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

// ---------- lógica pura ----------
console.log('Lógica pura');
comprobar('usuario válido (con ñ y tilde)', motivoUsuario('Íñigo_92') === null);
comprobar('usuario demasiado corto', !!motivoUsuario('ab'));
comprobar('usuario demasiado largo', !!motivoUsuario('a'.repeat(21)));
comprobar('usuario con espacio o símbolos', !!motivoUsuario('ana maría') && !!motivoUsuario('ana@x') && !!motivoUsuario('<b>'));
comprobar('usuario que no es texto', !!motivoUsuario(42) && !!motivoUsuario(null));
comprobar('contraseña corta', !!motivoClave('1234567'));
comprobar('contraseña igual al usuario', !!motivoClave('Leñador77', 'leñador77'));
comprobar('contraseña larga y buena', motivoClave('una frase bastante larga', 'ana') === null);
comprobar('petición rara no vale', !!validarPeticionCuenta({ que: 'borrar', usuario: 'ana', clave: 'x' }).motivo && !!validarPeticionCuenta(null).motivo && !!validarPeticionCuenta([]).motivo);
comprobar('entrar sin contraseña no vale', !!validarPeticionCuenta({ que: 'entrar', usuario: 'ana' }).motivo);

// un resumen rápido para la lógica (el de verdad es scrypt, más abajo)
let resumidas = 0;
const falso = { resumir: async (c, s) => { resumidas++; await pausa(1); return 'h:' + s + ':' + c; }, sal: (() => { let n = 0; return () => 's' + (++n); })() };
{
  const C = new Cuentas(falso);
  let t = 1000;
  const r1 = await C.crear({ usuario: 'Ana', clave: 'clave-buena-1', autor: 'jugador:a', origen: 'ip1', ahora: t });
  comprobar('crear una cuenta', r1.ok && r1.cuenta.autor === 'jugador:a' && r1.cuenta.usuario === 'Ana');
  comprobar('lo guardado no lleva la contraseña', r1.ok && !JSON.stringify(r1.cuenta).includes('"clave') && typeof r1.cuenta.hash === 'string' && typeof r1.cuenta.sal === 'string');
  const r2 = await C.crear({ usuario: 'ANA', clave: 'otra-clave-9', autor: 'jugador:b', origen: 'ip1', ahora: t });
  comprobar('usuario repetido (otras mayúsculas) no', !r2.ok && /existe/.test(r2.motivo));
  const r3 = await C.crear({ usuario: 'Ana2', clave: 'otra-clave-9', autor: 'jugador:a', origen: 'ip1', ahora: t });
  comprobar('un personaje, una cuenta', !r3.ok && /ya tiene cuenta/.test(r3.motivo));
  const e1 = await C.entrar({ usuario: 'ana', clave: 'clave-buena-1', origen: 'ip2', ahora: t });
  comprobar('entrar (sin mirar mayúsculas) da su personaje', e1.ok && e1.autor === 'jugador:a');
  const e2 = await C.entrar({ usuario: 'ana', clave: 'clave-mala-1', origen: 'ip2', ahora: t });
  const n0 = resumidas;
  const e3 = await C.entrar({ usuario: 'nadie', clave: 'clave-mala-1', origen: 'ip2', ahora: t });
  comprobar('contraseña mala y usuario que no existe: el mismo motivo', !e2.ok && !e3.ok && e2.motivo === e3.motivo);
  comprobar('con un usuario que no existe también se resume (tarda lo mismo)', resumidas > n0);
  // demasiados intentos a una cuenta (ya lleva 1 fallo)
  for (let i = 1; i < FALLOS_USUARIO; i++) await C.entrar({ usuario: 'Ana', clave: 'mala-' + i + 'xxxx', origen: 'ip3', ahora: t });
  const b1 = await C.entrar({ usuario: 'Ana', clave: 'clave-buena-1', origen: 'ip4', ahora: t + 1000 });
  comprobar(`tras ${FALLOS_USUARIO} fallos, ni con la buena`, !b1.ok && b1.bloqueado && /Demasiados intentos/.test(b1.motivo), b1.motivo);
  const b2 = await C.entrar({ usuario: 'Ana', clave: 'clave-buena-1', origen: 'ip4', ahora: t + ESPERA + 1 });
  comprobar('pasada la espera, se puede entrar', b2.ok);
  // demasiados fallos desde una dirección (a cuentas distintas)
  const D = new Cuentas(falso);
  for (let i = 0; i < FALLOS_ORIGEN; i++) await D.entrar({ usuario: 'usuario' + i, clave: 'loquesea12', origen: 'ipX', ahora: t });
  await D.crear({ usuario: 'Berta', clave: 'clave-berta-1', autor: 'jugador:b', origen: 'ipY', ahora: t });
  const b3 = await D.entrar({ usuario: 'Berta', clave: 'clave-berta-1', origen: 'ipX', ahora: t });
  const b4 = await D.entrar({ usuario: 'Berta', clave: 'clave-berta-1', origen: 'ipZ', ahora: t });
  comprobar(`tras ${FALLOS_ORIGEN} fallos desde una dirección, esa dirección no; otra sí`, !b3.ok && b3.bloqueado && b4.ok);
  // demasiadas altas desde una dirección
  const E = new Cuentas(falso);
  const altas = [];
  for (let i = 0; i <= ALTAS_ORIGEN; i++) altas.push(await E.crear({ usuario: 'alta' + i, clave: 'clave-alta-1', autor: 'jugador:alta' + i, origen: 'ipA', ahora: t }));
  comprobar(`como mucho ${ALTAS_ORIGEN} altas por dirección`, altas.slice(0, ALTAS_ORIGEN).every(r => r.ok) && !altas[ALTAS_ORIGEN].ok);
  // dos altas a la vez con el mismo usuario
  const F = new Cuentas(falso);
  const [x, y] = await Promise.all([
    F.crear({ usuario: 'Carla', clave: 'clave-carla-1', autor: 'jugador:c1', origen: 'i1', ahora: t }),
    F.crear({ usuario: 'carla', clave: 'clave-carla-2', autor: 'jugador:c2', origen: 'i2', ahora: t }),
  ]);
  comprobar('dos altas a la vez del mismo usuario: solo una', [x, y].filter(r => r.ok).length === 1 && F.total === 1);
  // se cargan las guardadas
  const G = new Cuentas({ ...falso, previas: [r1.cuenta, { basura: 1 }, null] });
  comprobar('las cuentas guardadas se cargan (y lo raro se descarta)', G.total === 1 && G.deAutor('jugador:a').usuario === 'Ana');
}

// ---------- scrypt ----------
console.log('Resumen de la contraseña (scrypt con sal)');
{
  const s1 = claves.sal(), s2 = claves.sal();
  const t0 = performance.now();
  const h1 = await claves.resumir('misma-clave-1', s1);
  const ms = performance.now() - t0;
  const h2 = await claves.resumir('misma-clave-1', s2);
  comprobar('sal distinta → resumen distinto', s1 !== s2 && h1 !== h2 && h1.length === 128);
  comprobar('el resumen no contiene la contraseña', !h1.includes('misma'));
  comprobar('la misma contraseña con su sal da lo mismo; otra no', claves.iguales(h1, await claves.resumir('misma-clave-1', s1)) && !claves.iguales(h1, await claves.resumir('misma-clave-2', s1)));
  comprobar('el resumen es lento (más de 20 ms)', ms > 20, `${Math.round(ms)} ms en esta máquina`);
}

// ---------- servidor ----------
function cliente(puerto, ficha) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '?ficha=' + ficha : ''}`);
    const c = { ws, cuenta: [], cerradoCon: null };
    c.cerrado = new Promise(r => ws.on('close', (codigo) => { c.cerradoCon = codigo; r(codigo); }));
    c.mandar = (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
    let id = 0;
    c.pedir = async (m) => {
      const n = ++id; c.mandar({ tipo: 'cuenta', id: n, ...m });
      for (let k = 0; k < 250; k++) { const r = c.cuenta.find(a => a.id === n); if (r) return r; await pausa(20); }
      return null;
    };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.yo = m.autor; c.bienvenida = m; listo(c); } if (m.tipo === 'cuenta') c.cuenta.push(m); });
    ws.on('error', fallo);
  });
}

console.log('Servidor');
const dir = mkdtempSync(join(tmpdir(), 'kinhold-cuentas-'));
const lineas = [];
const registrar = (t) => lineas.push(t);
const CLAVE = 'mi casa de troncos 7';
try {
  let s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), registrar, tico: 200 });
  let puerto = await s.listo;
  const a = await cliente(puerto);
  comprobar('al entrar sin cuenta, la bienvenida lo dice', a.bienvenida.cuenta === null);
  const r1 = await a.pedir({ que: 'crear', usuario: 'Leñadora', clave: CLAVE });
  comprobar('crear la cuenta con el personaje de la conexión', r1 && r1.ok && r1.autor === a.yo && r1.usuario === 'Leñadora', JSON.stringify(r1));
  const r2 = await a.pedir({ que: 'crear', usuario: 'Otra', clave: CLAVE });
  comprobar('el mismo personaje no crea otra', r2 && !r2.ok);
  const b = await cliente(puerto);
  const r3 = await b.pedir({ que: 'crear', usuario: 'leñadora', clave: 'otra clave larga' });
  comprobar('usuario repetido no', r3 && !r3.ok && /existe/.test(r3.motivo));
  const r4 = await b.pedir({ que: 'crear', usuario: 'yo', clave: 'otra clave larga' });
  const r5 = await b.pedir({ que: 'crear', usuario: 'Bruno', clave: 'corta' });
  comprobar('usuario corto y contraseña corta no', r4 && !r4.ok && r5 && !r5.ok);
  const r6 = await b.pedir({ que: 'entrar', usuario: 'Leñadora', clave: 'no es la buena' });
  comprobar('contraseña mala no', r6 && !r6.ok && !r6.ficha && r6.motivo === 'Usuario o contraseña incorrectos.');
  const r7 = await b.pedir({ que: 'entrar', usuario: 'LEÑADORA', clave: CLAVE });
  comprobar('entrar desde otro aparato da una ficha', r7 && r7.ok && r7.autor === a.yo && /^[0-9a-f]{32}$/.test(r7.ficha || ''));
  const a2 = await cliente(puerto, r7.ficha);
  comprobar('con esa ficha se vuelve a ser el mismo personaje', a2.yo === a.yo && a2.bienvenida.vuelve === true && a2.bienvenida.cuenta === 'Leñadora');
  await Promise.race([a.cerrado, pausa(1500)]);
  comprobar('la conexión vieja de ese personaje se cierra', a.cerradoCon === 4001, String(a.cerradoCon));
  // mensajes raros
  b.mandar({ tipo: 'cuenta', que: 'entrar', usuario: { $ne: 1 }, clave: ['x'] });
  b.mandar({ tipo: 'cuenta', que: 'crear', usuario: 'x'.repeat(5000), clave: 'y'.repeat(5000) });
  b.mandar({ tipo: 'cuenta' });
  await pausa(300);
  const r8 = await b.pedir({ que: 'entrar', usuario: 'Leñadora', clave: CLAVE });
  comprobar('mensajes raros no tumban nada', r8 && r8.ok);
  // demasiados intentos
  const c = await cliente(puerto);
  const malas = [];
  for (let i = 0; i < 5; i++) malas.push(await c.pedir({ que: 'entrar', usuario: 'Leñadora', clave: 'mala ' + i + ' clave' }));
  const r9 = await c.pedir({ que: 'entrar', usuario: 'Leñadora', clave: CLAVE });
  comprobar('tras 5 contraseñas malas, ni con la buena', malas.every(r => r && !r.ok) && r9 && !r9.ok && /Demasiados intentos/.test(r9.motivo), r9 && r9.motivo);
  // la contraseña no está en ningún sitio
  const guardado = readFileSync(s.archivoCuentas, 'utf8');
  comprobar('cuentas.jsonl tiene la cuenta, con sal y resumen', guardado.includes('Leñadora') && /"sal":"[0-9a-f]{32}"/.test(guardado) && /"hash":"[0-9a-f]{128}"/.test(guardado));
  comprobar('la contraseña no está en cuentas.jsonl', !guardado.includes(CLAVE) && !guardado.includes('mala 0'));
  comprobar('ni en el registro del servidor', !lineas.some(l => l.includes(CLAVE) || l.includes('no es la buena')) && lineas.some(l => l.includes('cuenta nueva')));
  for (const x of [a2, b, c]) x.ws.close();
  await s.cerrar();
  // tras reiniciar
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), registrar, tico: 200 });
  puerto = await s.listo;
  const d = await cliente(puerto);
  const r10 = await d.pedir({ que: 'entrar', usuario: 'leñadora', clave: CLAVE });
  comprobar('tras reiniciar el servidor, se entra igual', r10 && r10.ok && r10.autor === a.yo);
  const r11 = await d.pedir({ que: 'entrar', usuario: 'leñadora', clave: 'tampoco es esta' });
  comprobar('y la mala sigue sin valer', r11 && !r11.ok);
  const r12 = await d.pedir({ que: 'crear', usuario: 'Leñadora', clave: 'otra clave larga' });
  comprobar('y el usuario sigue cogido', r12 && !r12.ok);
  d.ws.close();
  await s.cerrar();
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia && existsSync(copia)) rmSync(copia);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
