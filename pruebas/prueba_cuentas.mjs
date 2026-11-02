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
//     aparece nunca en cuentas.jsonl ni en el registro; mensajes raros no tumban nada;
//   - cuentas más seguras (valravnx, 2 nov): contraseñas de 10 o más, fuera las más usadas, las series y las repetidas;
//     crear cuentas en masa no sale (por dirección, con espera que crece, por bloque IPv6 /64 y en total por hora; ni
//     cambiando la dirección que dice el propio cliente); las fichas caducan; salir en todos los aparatos deja sin
//     valer todas las fichas (también tras reiniciar) y cierra sus conexiones; el registro de seguridad apunta altas,
//     entradas, fallos y salidas, sin la contraseña.
// Con MUTAR=2 se prueba una lógica que deja crear cuentas sin espera ni límite: debe FALLAR.
// Con MUTAR=1 se prueba un servidor que da por buena cualquier contraseña: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { Cuentas, motivoUsuario, motivoClave, validarPeticionCuenta, claveDeOrigen, FALLOS_USUARIO, FALLOS_ORIGEN, ESPERA, ALTAS_ORIGEN, ALTAS_TOTAL, ALTAS_VENTANA, ESPERA_ALTA, CLAVE_MIN } from '../src/logica/cuentas.js';
import { CLAVES_COMUNES } from '../src/logica/claves_comunes.js';
import { Fichas } from '../src/logica/fichas.js';
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
if (process.env.MUTAR === '2') {   // sin espera ni tope de altas: tiene que fallar
  Cuentas.prototype.esperaAlta = () => 0;
  Cuentas.prototype._crear = Cuentas.prototype.crear;
}

// ---------- lógica pura ----------
console.log('Lógica pura');
comprobar('usuario válido (con ñ y tilde)', motivoUsuario('Íñigo_92') === null);
comprobar('usuario demasiado corto', !!motivoUsuario('ab'));
comprobar('usuario demasiado largo', !!motivoUsuario('a'.repeat(21)));
comprobar('usuario con espacio o símbolos', !!motivoUsuario('ana maría') && !!motivoUsuario('ana@x') && !!motivoUsuario('<b>'));
comprobar('usuario que no es texto', !!motivoUsuario(42) && !!motivoUsuario(null));
comprobar('contraseña corta', !!motivoClave('1234567'));
comprobar(`contraseña de ${CLAVE_MIN - 1} no; de ${CLAVE_MIN}, sí`, CLAVE_MIN >= 10 && !!motivoClave('bosque.ve'.slice(0, CLAVE_MIN - 1)) && motivoClave('bosque.ver', 'ana') === null);
for (const c of ['password123', 'Contraseña123', 'QWERTYUIOP', '1q2w3e4r5t', 'kinhold2026', 'йцукенгшщз', 'iloveyou123'])
  comprobar(`de las más usadas no: ${c}`, /más usadas/.test(motivoClave(c, 'ana') || ''));
for (const c of ['aaaaaaaaaaaa', '0987654321', 'abcdefghijk', 'abcabcabcabc', '1212121212'])
  comprobar(`fácil de adivinar no: ${c}`, !!motivoClave(c, 'ana'));
comprobar('la lista de las más usadas está guardada en el juego', CLAVES_COMUNES.size > 300, `${CLAVES_COMUNES.size}`);
comprobar('IPv6: todo un bloque /64 cuenta como una dirección', claveDeOrigen('2001:db8:a:b:1:2:3:4') === claveDeOrigen('2001:db8:a:b::ffff') && claveDeOrigen('2001:db8:a:c::1') !== claveDeOrigen('2001:db8:a:b::1'));
comprobar('IPv4 (también escrita como IPv6) tal cual', claveDeOrigen('::ffff:1.2.3.4') === '1.2.3.4' && claveDeOrigen('1.2.3.4') !== claveDeOrigen('1.2.3.5'));
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
  // (con la espera que crece entre una y otra: 1, 2, 4… veces ESPERA_ALTA; se respeta para ver el tope por hora)
  let ta = t;
  for (let i = 0; i <= ALTAS_ORIGEN; i++) { altas.push(await E.crear({ usuario: 'alta' + i, clave: 'clave-alta-1', autor: 'jugador:alta' + i, origen: 'ipA', ahora: ta })); ta += ESPERA_ALTA * 2 ** i + 1; }
  comprobar(`como mucho ${ALTAS_ORIGEN} altas por dirección en una hora`, altas.slice(0, ALTAS_ORIGEN).every(r => r.ok) && !altas[ALTAS_ORIGEN].ok, altas.map(r => r.ok ? 'sí' : r.motivo).join(' | '));
  // la espera que crece
  const W = new Cuentas(falso);
  const w1 = await W.crear({ usuario: 'masa0', clave: 'clave-masa-12', autor: 'jugador:m0', origen: 'ipW', ahora: t });
  const w2 = await W.crear({ usuario: 'masa1', clave: 'clave-masa-12', autor: 'jugador:m1', origen: 'ipW', ahora: t + 1000 });
  const w3 = await W.crear({ usuario: 'masa1', clave: 'clave-masa-12', autor: 'jugador:m1', origen: 'ipW', ahora: t + ESPERA_ALTA + 1 });
  const w4 = await W.crear({ usuario: 'masa2', clave: 'clave-masa-12', autor: 'jugador:m2', origen: 'ipW', ahora: t + ESPERA_ALTA + 2 + ESPERA_ALTA });
  const w5 = await W.crear({ usuario: 'masa2', clave: 'clave-masa-12', autor: 'jugador:m2', origen: 'ipW', ahora: t + ESPERA_ALTA + 2 + 2 * ESPERA_ALTA });
  comprobar('entre una alta y otra desde la misma dirección, una espera que crece (1 min, luego 2…)', w1.ok && !w2.ok && /prueba dentro de 1 min/.test(w2.motivo) && w3.ok && !w4.ok && w5.ok, [w1, w2, w3, w4, w5].map(r => r.ok ? 'sí' : r.motivo).join(' | '));
  // en masa: mil altas seguidas desde una dirección, o desde todo un bloque IPv6, o desde muchas direcciones
  const M = new Cuentas(falso);
  let hechas = 0;
  for (let i = 0; i < 1000; i++) if ((await M.crear({ usuario: 'bot' + i, clave: 'clave-del-bot-1', autor: 'jugador:bot' + i, origen: '9.9.9.9', ahora: t + i * 10 })).ok) hechas++;
  comprobar('mil altas seguidas desde una dirección: solo la primera', hechas === 1, `${hechas}`);
  const M6 = new Cuentas(falso);
  hechas = 0;
  for (let i = 0; i < 200; i++) if ((await M6.crear({ usuario: 'seis' + i, clave: 'clave-del-bot-1', autor: 'jugador:seis' + i, origen: `2001:db8:1:2:${i.toString(16)}::1`, ahora: t + i * 10 })).ok) hechas++;
  comprobar('doscientas desde direcciones distintas del mismo bloque IPv6: solo la primera', hechas === 1, `${hechas}`);
  const MT = new Cuentas(falso);
  hechas = 0;
  for (let i = 0; i < 200; i++) if ((await MT.crear({ usuario: 'red' + i, clave: 'clave-del-bot-1', autor: 'jugador:red' + i, origen: `10.0.${i >> 8}.${i & 255}`, ahora: t + i * 10 })).ok) hechas++;
  const tarde = await MT.crear({ usuario: 'tarde', clave: 'clave-del-bot-1', autor: 'jugador:tarde', origen: '10.9.9.9', ahora: t + ALTAS_VENTANA + 5000 });
  comprobar(`doscientas desde doscientas direcciones: como mucho ${ALTAS_TOTAL} en una hora (y pasada, otra vez)`, hechas === ALTAS_TOTAL && tarde.ok, `${hechas}`);
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

// ---------- fichas ----------
console.log('Fichas de cada aparato');
{
  const conCuenta = new Set(['jugador:a', 'jugador:b']);
  const F = new Fichas({ vida: 1000, conCuenta: (a) => conCuenta.has(a), lineas: [{ h: 'h1', autor: 'jugador:a', t: 0 }, { h: 'h2', autor: 'jugador:a', t: 500 }, { h: 'h3', autor: 'jugador:sin', t: 0 }, { h: 'h4', autor: 'jugador:b' }, { basura: 1 }, null], ahora: 900 });
  comprobar('las guardadas se cargan (las de antes, sin hora, cuentan desde que arranca)', F.total === 4 && F.de('h4', 1800).autor === 'jugador:b' && F.de('h4', 1900).autor === null);
  comprobar('una ficha vale hasta que caduca', F.de('h1', 999).autor === 'jugador:a' && F.de('h1', 1000).autor === null && F.de('h1', 1000).caducada === false);
  const c = new Fichas({ vida: 1000, conCuenta: (a) => conCuenta.has(a), lineas: [{ h: 'h1', autor: 'jugador:a', t: 0 }] }).de('h1', 5000);
  comprobar('al caducar lo dice (para el registro de seguridad)', c.autor === null && c.caducada === true);
  comprobar('la de un personaje sin cuenta no caduca (es lo único que lo une a él)', F.de('h3', 1e9).autor === 'jugador:sin');
  comprobar('salir en todos los aparatos: ninguna de ese personaje vale', F.fuera('jugador:a') === 1 && F.de('h2', 600).autor === null && F.de('h3', 600).autor === 'jugador:sin');
  const G = new Fichas({ vida: 1e9, lineas: [{ h: 'x1', autor: 'jugador:a', t: 0 }, { h: 'x2', autor: 'jugador:a', t: 1 }, { fuera: 'jugador:a', t: 2 }, { h: 'x3', autor: 'jugador:a', t: 3 }] });
  comprobar('al cargar, las de antes de salir en todos ya no valen; la de después, sí', G.de('x1', 5).autor === null && G.de('x2', 5).autor === null && G.de('x3', 5).autor === 'jugador:a');
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

// un cliente con cabeceras (X-Forwarded-For, como si viniera de Caddy)
function clienteCon(puerto, headers) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`, { headers });
    const c = { ws, cuenta: [] };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    let id = 0;
    c.pedir = async (m) => { const n = ++id; c.mandar({ tipo: 'cuenta', id: n, ...m }); for (let k = 0; k < 250; k++) { const r = c.cuenta.find(a => a.id === n); if (r) return r; await pausa(20); } return null; };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') listo(c); if (m.tipo === 'cuenta') c.cuenta.push(m); });
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
  // salir en todos los aparatos
  const r13 = await d.pedir({ que: 'entrar', usuario: 'leñadora', clave: CLAVE });
  const otroAparato = await cliente(puerto, r10.ficha);
  const sinCuenta = await cliente(puerto);
  const r14 = await sinCuenta.pedir({ que: 'salir_todos' });
  comprobar('sin cuenta no hay sesión que cerrar', r14 && !r14.ok);
  const r15 = await otroAparato.pedir({ que: 'salir_todos' });
  await Promise.race([otroAparato.cerrado, pausa(1500)]);
  comprobar('salir en todos los aparatos: responde y cierra la conexión (4002)', r15 && r15.ok && otroAparato.cerradoCon === 4002, `${JSON.stringify(r15)} ${otroAparato.cerradoCon}`);
  const e1 = await cliente(puerto, r10.ficha), e2 = await cliente(puerto, r13.ficha);
  comprobar('después, ninguna ficha de ese personaje vale (vuelve sin cuenta, como uno nuevo)', e1.yo !== a.yo && e2.yo !== a.yo && e1.bienvenida.cuenta === null && e2.bienvenida.cuenta === null && !e1.bienvenida.vuelve);
  const r16 = await e1.pedir({ que: 'entrar', usuario: 'leñadora', clave: CLAVE });
  comprobar('y con usuario y contraseña se vuelve a entrar', r16 && r16.ok && r16.autor === a.yo);
  for (const x of [d, sinCuenta, e1, e2]) x.ws.close();
  await s.cerrar();
  // tras reiniciar, la salida sigue (las fichas de antes no vuelven a valer)
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), registrar, tico: 200 });
  puerto = await s.listo;
  const e3 = await cliente(puerto, r13.ficha), e4 = await cliente(puerto, r16.ficha);
  comprobar('tras reiniciar, las fichas de antes de salir siguen sin valer; la nueva sí', e3.yo !== a.yo && e4.yo === a.yo);
  // crear cuentas en masa por el servidor, desde la misma máquina (también diciendo otra dirección en X-Forwarded-For)
  const masa = [];
  for (let i = 0; i < 6; i++) {
    const ws = await clienteCon(puerto, { 'x-forwarded-for': `203.0.113.${i}, 198.51.100.7` });
    masa.push(await ws.pedir({ que: 'crear', usuario: 'Masa' + i, clave: 'una clave para la masa' }));
    ws.ws.close();
  }
  comprobar('crear cuentas en masa por el servidor: solo la primera (ni cambiando la dirección que dice el cliente)', masa[0] && masa[0].ok && masa.slice(1).every(r => r && !r.ok && /Demasiadas cuentas nuevas/.test(r.motivo)), masa.map(r => r && (r.ok ? 'sí' : r.motivo)).join(' | '));
  // el registro de seguridad
  const seg = readFileSync(s.archivoSeguridad, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const hay = (f) => seg.some(f);
  comprobar('el registro de seguridad apunta altas, entradas, fallos y salidas',
    hay(e => e.que === 'alta' && e.ok && e.usuario === 'Leñadora') && hay(e => e.que === 'entrar' && e.ok) && hay(e => e.que === 'entrar' && !e.ok && e.motivo === 'Usuario o contraseña incorrectos.')
    && hay(e => e.que === 'entrar' && e.bloqueado) && hay(e => e.que === 'alta' && !e.ok && /Demasiadas/.test(e.motivo)) && hay(e => e.que === 'salir_todos' && e.ok) && seg.every(e => typeof e.t === 'string' && e.origen), `${seg.length} líneas`);
  const segTexto = readFileSync(s.archivoSeguridad, 'utf8');
  comprobar('sin la contraseña ni las fichas', !segTexto.includes(CLAVE) && !segTexto.includes('no es la buena') && !segTexto.includes(r13.ficha) && !segTexto.includes('una clave para la masa'));
  e3.ws.close(); e4.ws.close();
  await s.cerrar();
  // las fichas caducan
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), registrar, tico: 200, vidaFicha: 400 });
  puerto = await s.listo;
  const f1 = await cliente(puerto);
  const r17 = await f1.pedir({ que: 'entrar', usuario: 'leñadora', clave: CLAVE });
  const f2 = await cliente(puerto, r17.ficha);
  comprobar('una ficha recién dada vale', f2.yo === a.yo);
  f2.ws.close(); f1.ws.close();
  await pausa(600);
  const f3 = await cliente(puerto, r17.ficha);
  comprobar('pasada su vida, la ficha ya no vale (hay que volver a entrar)', f3.yo !== a.yo && f3.bienvenida.cuenta === null);
  await pausa(100);
  comprobar('y se apunta en el registro de seguridad', readFileSync(s.archivoSeguridad, 'utf8').includes('"ficha_caducada"'));
  f3.ws.close();
  await s.cerrar();
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia && existsSync(copia)) rmSync(copia);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
