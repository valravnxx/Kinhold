// Prueba de la copia de seguridad del servidor (servidor/nube/copia.sh y restaurar.sh; auditoría del 4 nov).
// Ejecutar: node pruebas/prueba_copia_servidor.mjs   (hace falta rsync; si no está, la prueba falla y lo dice)
// Comprueba, con el servidor de verdad en una carpeta aparte:
//   - una cuenta creada por websocket y lo que el servidor guarda junto al mundo entran en la copia (.tar.gz con la
//     fecha), sin los .tmp; la copia se hace con el servidor en marcha;
//   - quedan las últimas 14, en la máquina y fuera (aquí, «fuera» es otra carpeta: rsync igual que a la Storage Box),
//     y fuera no queda nada de más;
//   - sin destino fuera, la copia se hace igual pero sale con error 3 y lo dice; con la carpeta vacía, no se hace nada;
//   - restaurar: se pierde el mundo (borrado), se trae la última copia de fuera, se restaura y el servidor arranca con
//     ella: la cuenta entra con su contraseña y los archivos son los mismos byte a byte; lo de antes no se borra;
//   - una copia rota no se restaura (y no toca nada).
// Con MUTAR=1 se prueba un copia.sh que no quita las viejas: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { crearServidor } from '../servidor/servidor.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), 'kinhold-copia-'));
let copiaSh = join(raiz, 'servidor/nube/copia.sh');
if (process.env.MUTAR === '1') {
  const f = readFileSync(copiaSh, 'utf8'); const m = f.replace('head -n "-$QUEDAN"', 'head -n 0');
  if (m === f) { console.log('No se pudo mutar copia.sh'); process.exit(1); }
  copiaSh = join(tmp, 'copia_mutada.sh'); writeFileSync(copiaSh, m);
}
const restaurarSh = join(raiz, 'servidor/nube/restaurar.sh');
const DATOS = join(tmp, 'kinhold'), COPIAS = join(tmp, 'copias'), FUERA = join(tmp, 'fuera'), ENV = join(tmp, 'copia.env');
const base = { ...process.env, KINHOLD_DATOS: DATOS, KINHOLD_COPIAS_DIR: COPIAS, KINHOLD_COPIA_ENV: ENV, KINHOLD_COPIA_DESTINO: '' };
const copiar = (fecha, extra = {}) => spawnSync('bash', [copiaSh], { env: { ...base, KINHOLD_COPIA_FECHA: fecha, ...extra }, encoding: 'utf8' });
const restaurar = (arg) => spawnSync('bash', [restaurarSh, arg], { env: { ...base, KINHOLD_SIN_SERVICIO: '1' }, encoding: 'utf8' });
const tars = (d) => existsSync(d) ? readdirSync(d).filter(n => /^kinhold-\d{8}-\d{6}\.tar\.gz$/.test(n)).sort() : [];

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, cuenta: [] }; let id = 0;
    c.pedir = async (m) => { const n = ++id; ws.send(JSON.stringify({ tipo: 'cuenta', id: n, ...m })); for (let k = 0; k < 250; k++) { const r = c.cuenta.find(a => a.id === n); if (r) return r; await pausa(20); } return null; };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { c.yo = m.autor; listo(c); } if (m.tipo === 'cuenta') c.cuenta.push(m); });
    ws.on('error', fallo);
  });
}
const CLAVE = 'troncos y barro 4471';
const nuevoServidor = () => crearServidor({ puerto: 0, archivo: join(DATOS, 'mundo.jsonl'), registrar: () => {}, tico: 200 });

try {
  comprobar('rsync está en esta máquina', spawnSync('rsync', ['--version']).status === 0, 'instalar.sh lo pone en el servidor');
  mkdirSync(DATOS, { recursive: true });
  const sinMundo = copiar('20261101-000000');
  comprobar('con la carpeta del mundo vacía no se copia nada', sinMundo.status === 1 && tars(COPIAS).length === 0, sinMundo.stderr.trim());

  let s = nuevoServidor(); let puerto = await s.listo;
  const a = await cliente(puerto);
  const r = await a.pedir({ que: 'crear', correo: 'copia@ejemplo.com', usuario: 'Guardiana', clave: CLAVE });
  comprobar('se crea una cuenta en el servidor', r && r.ok, JSON.stringify(r));
  await pausa(300);
  writeFileSync(join(DATOS, 'objetos.json.tmp'), 'a medias');
  // primera copia con el servidor en marcha y sin destino fuera
  const solo = copiar('20261101-034100');
  comprobar('sin destino fuera: se copia en la máquina pero sale con error 3 y lo dice', solo.status === 3 && tars(COPIAS).length === 1 && /SIN COPIA FUERA/.test(solo.stderr), `código ${solo.status}`);
  const lista = spawnSync('tar', ['-tzf', join(COPIAS, tars(COPIAS)[0])], { encoding: 'utf8' }).stdout.split('\n');
  comprobar('la copia lleva las cuentas y su registro, y no los .tmp', lista.includes('./cuentas.jsonl') && lista.includes('./seguridad.jsonl') && !lista.some(l => l.endsWith('.tmp')), lista.filter(Boolean).join(' '));
  rmSync(join(DATOS, 'objetos.json.tmp'));
  await a.ws.close(); await s.cerrar();

  // 16 días de copias con el destino fuera en copia.env: quedan las 14 últimas aquí y fuera
  writeFileSync(ENV, `# destino de prueba\nKINHOLD_COPIA_DESTINO=${FUERA}\n`);
  let todas = true;
  for (let d = 2; d <= 17; d++) { const x = copiar(`202611${String(d).padStart(2, '0')}-034100`); if (x.status !== 0) { todas = false; console.log(x.stderr); } }
  comprobar('con destino fuera (en copia.env), cada copia sale bien', todas);
  const aqui = tars(COPIAS), fuera = tars(FUERA);
  comprobar('en la máquina quedan las 14 últimas', aqui.length === 14 && aqui[0] === 'kinhold-20261104-034100.tar.gz' && aqui[13] === 'kinhold-20261117-034100.tar.gz', `${aqui.length}: ${aqui[0]} … ${aqui[aqui.length - 1]}`);
  comprobar('fuera, las mismas 14 y nada más', JSON.stringify(fuera) === JSON.stringify(aqui) && readdirSync(FUERA).length === 14, `${fuera.length}`);
  const tamano = (n) => readFileSync(join(FUERA, n)).equals(readFileSync(join(COPIAS, n)));
  comprobar('lo de fuera es igual byte a byte', fuera.every(tamano));

  // se pierde la máquina: el mundo y las copias de aquí. Se trae la última de fuera y se restaura.
  const antes = Object.fromEntries(readdirSync(DATOS).map(n => [n, readFileSync(join(DATOS, n))]));
  rmSync(DATOS, { recursive: true }); rmSync(COPIAS, { recursive: true });
  mkdirSync(COPIAS);
  spawnSync('rsync', ['-a', FUERA + '/', COPIAS + '/']);
  const rota = join(tmp, 'rota.tar.gz'); writeFileSync(rota, 'esto no es una copia');
  const rr = restaurar(rota);
  comprobar('una copia rota no se restaura y no toca nada', rr.status === 1 && !existsSync(DATOS), rr.stderr.trim());
  const re = restaurar('--ultima');
  comprobar('restaurar la última copia traída de fuera', re.status === 0 && existsSync(join(DATOS, 'cuentas.jsonl')), (re.stdout + re.stderr).trim());
  const despues = Object.fromEntries(readdirSync(DATOS).map(n => [n, readFileSync(join(DATOS, n))]));
  comprobar('los archivos son los mismos, byte a byte', Object.keys(antes).length > 2 && Object.keys(antes).sort().join() === Object.keys(despues).sort().join() && Object.keys(antes).every(n => antes[n].equals(despues[n])), Object.keys(despues).sort().join(' '));
  s = nuevoServidor(); puerto = await s.listo;
  const b = await cliente(puerto);
  const e1 = await b.pedir({ que: 'entrar', usuario: 'guardiana', clave: CLAVE });
  comprobar('el servidor arranca con lo restaurado y la cuenta entra con su contraseña', e1 && e1.ok && e1.autor === a.yo, JSON.stringify(e1 && { ok: e1.ok, motivo: e1.motivo }));
  const e2 = await b.pedir({ que: 'entrar', usuario: 'guardiana', clave: 'otra que no es 9931' });
  comprobar('y una contraseña mala sigue sin valer', e2 && !e2.ok);
  await b.ws.close(); await s.cerrar();
  // restaurar otra vez encima: lo de antes queda al lado, no se borra
  const re2 = restaurar('--ultima');
  const lado = readdirSync(tmp).filter(n => n.startsWith('kinhold.antes-'));
  comprobar('restaurar encima deja lo de antes al lado (kinhold.antes-<fecha>)', re2.status === 0 && lado.length === 1 && existsSync(join(tmp, lado[0], 'cuentas.jsonl')), lado.join(' '));
} catch (e) {
  comprobar('sin errores', false, e && e.stack);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
