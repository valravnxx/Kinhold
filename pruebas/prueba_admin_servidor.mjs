// Prueba del panel de depuración del admin en el servidor (valravnx, 30 oct; src/logica/admin.js), con el admin por la
// cuenta (revisión del 1 nov, P1: sin clave aparte) y por su correo confirmado (valravnx, 2 nov).
// Ejecutar: node pruebas/prueba_admin_servidor.mjs
// Comprueba, con clientes de verdad por websocket:
//   - sin cuenta, o con una cuenta que no es la de admin, el panel no responde (ni con la clave de antes en el mensaje);
//   - la bienvenida dice admin: true solo a la cuenta de admin (también al volver a entrar con ella) y al confirmar su correo;
//   - es admin la cuenta cuyo correo confirmado está en la lista de la máquina (KINHOLD_ADMIN_CORREO, sin mayúsculas);
//     el nombre no cuenta (una cuenta «valravnx» con otro correo no es admin); sin la lista, nadie; sin confirmar, no;
//     al cambiar el correo por otro que no está en la lista, deja de serlo;
//   - con la de admin: «ver» da los conectados con su posición y el nombre de su cuenta, y nada de los que se han ido;
//   - «ir» a un punto de la isla responde ese punto; fuera de la isla o con datos raros, no;
//   - «ir» junto a otro: a su lado (a 1,6 m) y mirándole; junto a uno que no está o junto a sí mismo, no;
//   - cada petición queda en admin.jsonl con su autor y su cuenta; la lógica pura comprueba las peticiones.
// Con MUTAR=1 se prueba un servidor que no mira la cuenta: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { validarPeticionAdmin, sitioJunto, JUNTO, correosAdmin, esCorreoAdmin, NO_ADMIN } from '../src/logica/admin.js';

// Con MUTAR=correo, uno que da por confirmado el correo: también debe FALLAR.
const MUTAR = process.env.MUTAR === '1' || process.env.MUTAR === 'correo';
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
  const mutada = process.env.MUTAR === 'correo'
    ? fuente.replace('esCorreoAdmin(cuentas.correoDe(autor), admins)', 'esCorreoAdmin({ ...cuentas.correoDe(autor), verificado: true }, admins)')
    : fuente.replace('if (!esAdmin(autor)) return responder({ ok: false, motivo: NO_ADMIN });', '');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_admin.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
    const c = { ws, admin: [], cuentas: [], cerradoCon: null };
    c.cerrado = new Promise(r => ws.on('close', (codigo) => { c.cerradoCon = codigo; r(codigo); }));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estado = (x, z, giro = 0, y = 2) => c.mandar({ tipo: 'estado', x, y, z, giro, anim: 'quieto' });
    let id = 0;
    // una petición del panel y su respuesta (o null si no llega en 1 s)
    c.admin1 = async (m) => {
      const n = ++id; c.mandar({ tipo: 'admin', id: n, ...m });
      for (let k = 0; k < 50; k++) { const r = c.admin.find(a => a.id === n); if (r) return r; await pausa(20); }
      return null;
    };
    // crear o entrar con una cuenta, y su respuesta
    // (al crearla, también confirma el correo con el código que llega, como haría el jugador: sin eso no entra en el mundo)
    const esperarCuenta = async (n) => { for (let k = 0; k < 250; k++) { const r = c.cuentas.find(a => a.id === n); if (r) return r; await pausa(20); } return null; };
    // (la respuesta lleva en `confirmado` la de confirmar el correo: con ella el servidor dice si es de admin)
    c.cuenta1 = async (que, usuario, clave = 'una-contraseña-larga') => {
      const n = ++id; c.mandar({ tipo: 'cuenta', id: n, que, usuario, clave, correo: usuario.toLowerCase() + '@ejemplo.com' });
      const r = await esperarCuenta(n);
      if (que === 'crear' && r && r.ok) {
        const carta = cartas.filter(x => x.usuario === r.usuario).at(-1);
        const m = ++id; c.mandar({ tipo: 'cuenta', id: m, que: 'verificar', codigo: carta && carta.codigo });
        const v = await esperarCuenta(m);
        if (!v || !v.ok) console.log('  (no se pudo confirmar el correo de', usuario, JSON.stringify(v), ')');
        r.confirmado = v;
      }
      return r;
    };
    // cambiar el correo desde el menú (con la contraseña) y confirmarlo con el código: la respuesta de confirmarlo
    c.cambiarCorreo = async (usuario, nuevo, clave = 'una-contraseña-larga') => {
      const n = ++id; c.mandar({ tipo: 'cuenta', id: n, que: 'cambiar_correo', actual: clave, correo: nuevo });
      const r = await esperarCuenta(n);
      if (!r || !r.ok) return r;
      const carta = cartas.filter(x => x.usuario === usuario && x.para === nuevo).at(-1);
      const m = ++id; c.mandar({ tipo: 'cuenta', id: m, que: 'verificar', codigo: carta && carta.codigo });
      return esperarCuenta(m);
    };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.yo = m.autor; c.bienvenida = m; listo(c); } if (m.tipo === 'admin') c.admin.push(m); if (m.tipo === 'cuenta') c.cuentas.push(m); });
    ws.on('error', fallo);
  });
}

// el cartero de la prueba: guarda los códigos en lugar de mandarlos
const cartas = [];
const cartero = { conClave: true, enviar: async (x) => { cartas.push(x); return { ok: true }; } };
const BARATO = { N: 1 << 10, r: 8, p: 1 };   // contraseñas resumidas rápido: aquí no se prueba scrypt
const dir = mkdtempSync(join(tmpdir(), 'kinhold-admin-'));
try {
  console.log('Lógica pura');
  comprobar('«ver» vale', JSON.stringify(validarPeticionAdmin({ que: 'ver' })) === '{"que":"ver"}');
  comprobar('«ir» a un punto de la isla vale', !!validarPeticionAdmin({ que: 'ir', x: 120, z: -300 }));
  comprobar('«ir» fuera de la isla no vale', validarPeticionAdmin({ que: 'ir', x: 900000, z: 0 }) === null);
  comprobar('«ir» con números raros no vale', [NaN, Infinity, '3', null].every(v => validarPeticionAdmin({ que: 'ir', x: v, z: 0 }) === null));
  comprobar('«ir» junto a un autor con forma rara no vale', validarPeticionAdmin({ que: 'ir', junto: 'x'.repeat(80) }) === null && validarPeticionAdmin({ que: 'ir', junto: 3 }) === null);
  comprobar('otra cosa no vale', validarPeticionAdmin({ que: 'borrar' }) === null && validarPeticionAdmin(null) === null && validarPeticionAdmin([]) === null);
  const j = sitioJunto({ x: 10, y: 3, z: 20, giro: 0.7 });
  comprobar('junto a otro: a 1,6 m, a su altura y mirándole', Math.abs(Math.hypot(j.x - 10, j.z - 20) - JUNTO) < 1e-9 && j.y === 3
    && Math.abs(Math.sin(j.giro) * JUNTO - (10 - j.x)) < 1e-9 && Math.abs(Math.cos(j.giro) * JUNTO - (20 - j.z)) < 1e-9, JSON.stringify(j));
  const conf = (correo, verificado = true) => ({ usuario: 'x', correo, verificado });
  comprobar('el correo de la lista, confirmado, es admin (sin mayúsculas ni espacios)', esCorreoAdmin(conf('yo@ejemplo.com'), correosAdmin(' Yo@Ejemplo.COM , otra@ejemplo.com')) && esCorreoAdmin(conf('OTRA@ejemplo.com'), correosAdmin('yo@ejemplo.com,otra@ejemplo.com')));
  comprobar('sin confirmar no es admin', !esCorreoAdmin(conf('yo@ejemplo.com', false), correosAdmin('yo@ejemplo.com')));
  comprobar('otro correo, sin correo o sin cuenta no es admin', !esCorreoAdmin(conf('tu@ejemplo.com'), correosAdmin('yo@ejemplo.com')) && !esCorreoAdmin(conf(null), correosAdmin('yo@ejemplo.com')) && !esCorreoAdmin(null, correosAdmin('yo@ejemplo.com')) && !esCorreoAdmin(undefined, correosAdmin('yo@ejemplo.com')));
  comprobar('sin lista, vacía o con lo que no son correos: nadie es admin', [undefined, '', ' , ', 'valravnx', 'a b, @@', null, 7].every(l => correosAdmin(l).size === 0));
  comprobar('lo que no es un correo se descarta y lo demás vale', correosAdmin('valravnx, yo@ejemplo.com').size === 1);

  console.log('Sin la lista en la máquina');
  {
    const s0 = crearServidor({ puerto: 0, archivo: join(dir, 'sin', 'mundo.jsonl'), adminCorreo: undefined, parametrosClave: BARATO, cartero, altas: { origen: 1e6, total: 1e6, espera: 0 } });
    const p = await s0.listo;
    const v = await cliente(p);
    const rv = await v.cuenta1('crear', 'valravnx');
    comprobar('sin KINHOLD_ADMIN_CORREO, ni la cuenta «valravnx» es admin', rv && rv.ok && rv.confirmado && rv.confirmado.ok && rv.confirmado.admin === false, JSON.stringify(rv && rv.confirmado));
    const r0 = await v.admin1({ que: 'ver' });
    comprobar('y el panel no le responde', r0 && r0.ok === false && r0.motivo === NO_ADMIN, JSON.stringify(r0));
    v.ws.close(); await v.cerrado; await s0.cerrar();
  }

  console.log('Quien se queda antes el nombre «valravnx» no es admin');
  {
    const s2 = crearServidor({ puerto: 0, archivo: join(dir, 'otra', 'mundo.jsonl'), adminCorreo: 'ANA@ejemplo.com', parametrosClave: BARATO, cartero, altas: { origen: 1e6, total: 1e6, espera: 0 } });
    const p = await s2.listo;
    const v = await cliente(p), a = await cliente(p);
    const rv = await v.cuenta1('crear', 'valravnx'), ra = await a.cuenta1('crear', 'Ana');
    comprobar('al crearlas, con el correo aún sin confirmar, ninguna es admin', rv && rv.ok && rv.admin === false && ra && ra.ok && ra.admin === false, JSON.stringify([rv && rv.admin, ra && ra.admin]));
    comprobar('al confirmar el correo, solo la del correo de la lista es admin', rv.confirmado && rv.confirmado.admin === false && ra.confirmado && ra.confirmado.admin === true, JSON.stringify([rv.confirmado && rv.confirmado.admin, ra.confirmado && ra.confirmado.admin]));
    const r1 = await v.admin1({ que: 'ver' }), r2 = await a.admin1({ que: 'ver' });
    comprobar('la cuenta «valravnx» con otro correo no es admin; la del correo de la lista, sí', r1 && r1.ok === false && r2 && r2.ok === true, JSON.stringify([r1 && r1.ok, r2 && r2.ok]));
    // cambiar el correo por otro que no está en la lista: deja de ser admin
    const rc = await a.cambiarCorreo('Ana', 'ana.nueva@ejemplo.com');
    comprobar('al cambiar el correo por otro, deja de ser admin', rc && rc.ok && rc.cambiado === true && rc.admin === false, JSON.stringify(rc));
    const r3 = await a.admin1({ que: 'ver' });
    comprobar('y el panel ya no le responde', r3 && r3.ok === false && r3.motivo === NO_ADMIN, JSON.stringify(r3));

    v.ws.close(); a.ws.close(); await v.cerrado; await a.cerrado; await s2.cerrar();
  }

  console.log('Con la cuenta de admin (su correo en la lista de la máquina)');
  const CORREO_ADMIN = 'valravnx@ejemplo.com';   // el de la cuenta «ValRavnX» de cuenta1
  const archivo = join(dir, 'mundo.jsonl');
  let s = crearServidor({ puerto: 0, archivo, adminCorreo: CORREO_ADMIN, parametrosClave: BARATO, cartero, altas: { origen: 1e6, total: 1e6, espera: 0 } });
  let puerto = await s.listo;
  let admin = await cliente(puerto);
  const otro = await cliente(puerto), tercero = await cliente(puerto);
  comprobar('sin cuenta, la bienvenida no dice admin', admin.bienvenida.admin === false && otro.bienvenida.admin === false, JSON.stringify(admin.bienvenida.admin));

  // sin cuenta, nada (ni con la clave de antes en el mensaje)
  let r = await admin.admin1({ que: 'ver' });
  comprobar('sin cuenta: no se ve nada', r && r.ok === false && !r.jugadores && r.motivo === NO_ADMIN, JSON.stringify(r));
  r = await admin.admin1({ clave: 'cualquier-clave-de-antes-0123', que: 'ir', x: 5, z: 5 });
  comprobar('sin cuenta y con una clave: no se va a ningún sitio', r && r.ok === false && r.x === undefined, JSON.stringify(r));

  // con otra cuenta, nada
  const ro = await otro.cuenta1('crear', 'Berta');
  comprobar('otra cuenta: al crearla y al confirmar su correo no es admin', ro && ro.ok && ro.admin === false && ro.confirmado && ro.confirmado.admin === false, JSON.stringify(ro));
  r = await otro.admin1({ que: 'ver' });
  comprobar('otra cuenta: no se ve nada', r && r.ok === false && !r.jugadores, JSON.stringify(r));
  r = await otro.admin1({ que: 'ir', junto: tercero.yo });
  comprobar('otra cuenta: no va junto a nadie', r && r.ok === false && r.x === undefined, JSON.stringify(r));
  for (let k = 0; k < 6; k++) await otro.admin1({ que: 'ver' });
  comprobar('pedir sin ser admin no echa a nadie (no hay clave que adivinar)', otro.ws.readyState === WebSocket.OPEN);

  // la de admin: al confirmar su correo ya lo es, sin volver a entrar
  const ra = await admin.cuenta1('crear', 'ValRavnX');
  comprobar('al confirmar el correo de admin, la respuesta dice admin (sin volver a entrar)', ra && ra.ok && ra.confirmado && ra.confirmado.admin === true, JSON.stringify(ra && ra.confirmado));
  admin.estado(1, 2, 0); otro.estado(40, -30, 1.1, 5.5); tercero.estado(-12, 8); await pausa(150);

  // la buena
  r = await admin.admin1({ que: 'ver' });
  const lista = r && r.jugadores || [];
  const de = (a) => lista.find(e => e.autor === a);
  comprobar('cuenta de admin: «ver» da los tres conectados', r && r.ok && lista.length === 3 && r.yo === admin.yo, JSON.stringify(r && { n: lista.length, yo: r.yo }));
  comprobar('con el nombre de su cuenta (o nada si no tiene)', de(otro.yo) && de(otro.yo).cuenta === 'Berta' && de(admin.yo).cuenta === 'ValRavnX' && de(tercero.yo).cuenta === null, JSON.stringify(lista.map(j => j.cuenta)));
  comprobar('con su posición', de(otro.yo) && de(otro.yo).x === 40 && de(otro.yo).z === -30 && de(otro.yo).y === 5.5 && de(tercero.yo).x === -12, JSON.stringify(de(otro.yo)));
  tercero.ws.close(); await tercero.cerrado; await pausa(100);
  r = await admin.admin1({ que: 'ver' });
  comprobar('el que se ha ido ya no sale', r && r.ok && r.jugadores.length === 2 && !r.jugadores.some(e => e.autor === tercero.yo));

  r = await admin.admin1({ que: 'ir', x: 250.5, z: -1200 });
  comprobar('«ir» a un punto: el servidor responde ese punto (la altura la pone el navegador)', r && r.ok && r.x === 250.5 && r.z === -1200 && r.y === null, JSON.stringify(r));
  r = await admin.admin1({ que: 'ir', x: 1e6, z: 0 });
  comprobar('«ir» fuera de la isla: no', r && r.ok === false, JSON.stringify(r));
  r = await admin.admin1({ que: 'ir', junto: otro.yo });
  comprobar('«ir» junto a otro: a su lado y a su altura', r && r.ok && Math.abs(Math.hypot(r.x - 40, r.z + 30) - JUNTO) < 1e-6 && r.y === 5.5 && Number.isFinite(r.giro), JSON.stringify(r));
  r = await admin.admin1({ que: 'ir', junto: tercero.yo });
  comprobar('«ir» junto a uno que no está: no', r && r.ok === false, JSON.stringify(r));
  r = await admin.admin1({ que: 'ir', junto: admin.yo });
  comprobar('«ir» junto a sí mismo: no', r && r.ok === false, JSON.stringify(r));

  // el registro
  const reg = readFileSync(s.archivoAdmin, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('cada petición queda en admin.jsonl con su autor y su cuenta', reg.length >= 8 && reg.some(e => e.autor === otro.yo && e.cuenta === 'Berta' && !e.ok) && reg.some(e => e.autor === admin.yo && e.cuenta === 'ValRavnX' && e.ok && e.que === 'ir') && reg.some(e => e.cuenta === null && !e.ok), `${reg.length} líneas`);
  comprobar('la clave de un mensaje no se apunta nunca', !readFileSync(s.archivoAdmin, 'utf8').includes('cualquier-clave-de-antes'));

  // entrar con la cuenta de admin desde otro aparato (y tras reiniciar el servidor): la bienvenida dice admin
  admin.ws.close(); await admin.cerrado;
  const deNuevo = await cliente(puerto);
  const re = await deNuevo.cuenta1('entrar', 'valravnx');
  comprobar('entrar con «valravnx» da una ficha', re && re.ok && typeof re.ficha === 'string', JSON.stringify(re && { ok: re.ok, motivo: re.motivo }));
  deNuevo.ws.close(); await deNuevo.cerrado;
  for (const c of [otro, tercero]) { c.ws.close(); await c.cerrado; }
  await s.cerrar();
  s = crearServidor({ puerto: 0, archivo, adminCorreo: CORREO_ADMIN, parametrosClave: BARATO, cartero, altas: { origen: 1e6, total: 1e6, espera: 0 } });
  puerto = await s.listo;
  admin = await cliente(puerto, re && re.ficha);
  comprobar('con esa ficha, tras reiniciar: la bienvenida dice admin y la cuenta', admin.bienvenida.admin === true && admin.bienvenida.cuenta === 'ValRavnX', JSON.stringify({ admin: admin.bienvenida.admin, cuenta: admin.bienvenida.cuenta }));
  admin.estado(3, 4); await pausa(150);
  r = await admin.admin1({ que: 'ver' });
  comprobar('y el panel le responde', r && r.ok && r.jugadores.length === 1, JSON.stringify(r && { ok: r.ok, n: (r.jugadores || []).length }));
  const nuevo = await cliente(puerto);
  comprobar('uno nuevo sin cuenta no es admin', nuevo.bienvenida.admin === false);
  nuevo.ws.close(); await nuevo.cerrado;

  admin.ws.close(); await admin.cerrado;
  await s.cerrar();
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia && existsSync(copia)) rmSync(copia);
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
