// Prueba del servidor de prueba en internet (servidor/nube/, hito 1f).
// Ejecutar: node pruebas/prueba_nube.mjs        (hace falta caddy: apt-get install -y caddy)
// Comprueba: los guiones no tienen errores de sintaxis; instalar.sh rellena bien el Caddyfile y el servicio
// (dominio sslip.io sacado de la IP, puerto, la demo pública con ?servidor=wss://…); caddy acepta el Caddyfile;
// systemd acepta el servicio; y, con un Caddy de verdad delante de un servidor del juego de verdad (HTTPS con
// certificado local), el navegador que abre la dirección va a la demo con el servidor puesto y dos clientes
// conectan por wss:// a través de Caddy y se ven. Con MUTAR=1 se prueba una plantilla que no deja pasar el
// WebSocket al juego: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { execFileSync, spawn, spawnSync } from 'child_process';
import { request } from 'https';
import { createServer } from 'net';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const nube = join(raiz, 'servidor/nube');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const libre = () => new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const tmp = mkdtempSync(join(tmpdir(), 'kinhold_nube_'));
const JUEGO = 'https://valravnxx.github.io/Kinhold/jugar/demo/index.html';

// Con MUTAR=1, una copia de la carpeta con la plantilla estropeada (el WebSocket no llega al juego).
let carpeta = nube;
if (MUTAR) {
  carpeta = join(tmp, 'nube'); execFileSync('cp', ['-r', nube, carpeta]);
  const p = join(carpeta, 'Caddyfile.plantilla'), f = readFileSync(p, 'utf8');
  const m = f.replace('header Upgrade websocket', 'header Upgrade nada');
  if (m === f) { console.log('No se pudo mutar la plantilla'); process.exit(1); }
  writeFileSync(p, m);
}
const archivos = (env, dest) => execFileSync('bash', [join(carpeta, 'instalar.sh'), '--solo-archivos', dest],
  { env: { ...process.env, KINHOLD_IP: '', KINHOLD_DOMINIO: '', KINHOLD_PUERTO: '', ...env } }).toString().trim();

console.log('Guiones');
for (const g of ['instalar.sh', 'actualizar.sh']) {
  const r = spawnSync('bash', ['-n', join(nube, g)]);
  comprobar(`${g} sin errores de sintaxis`, r.status === 0, r.stderr.toString().trim());
}
const nubeYaml = readFileSync(join(nube, 'cloud-config.yaml'), 'utf8');
comprobar('cloud-config empieza por #cloud-config y lanza instalar.sh', nubeYaml.startsWith('#cloud-config\n') && nubeYaml.includes('servidor/nube/instalar.sh'));
comprobar('cloud-config clona el repositorio con K mayúscula', nubeYaml.includes('https://github.com/valravnxx/Kinhold.git'));

console.log('Archivos rellenos (IP 1.2.3.4)');
const d1 = join(tmp, 'ip');
const dominio = archivos({ KINHOLD_IP: '1.2.3.4' }, d1);
const caddy1 = readFileSync(join(d1, 'Caddyfile'), 'utf8'), serv1 = readFileSync(join(d1, 'kinhold.service'), 'utf8');
comprobar('el dominio sale de la IP con sslip.io', dominio === '1-2-3-4.sslip.io', dominio);
comprobar('no queda nada sin rellenar', !caddy1.includes('@@') && !serv1.includes('@@'));
comprobar('el Caddyfile sirve ese dominio', /^1-2-3-4\.sslip\.io \{/m.test(caddy1));
comprobar('quien abre la dirección va a la demo con wss:// de ese dominio', caddy1.includes(`redir "${JUEGO}?servidor=wss://1-2-3-4.sslip.io" 302`));
comprobar('el WebSocket va al servidor del juego en 8080 dentro de la máquina', caddy1.includes('reverse_proxy 127.0.0.1:8080'));
const exec = serv1.match(/^ExecStart=(\S+) (\S+) (\d+) (\S+)$/m);
comprobar('el servicio arranca servidor/servidor.mjs en 8080', exec && exec[2] === 'servidor/servidor.mjs' && exec[3] === '8080' && existsSync(join(raiz, exec[2])), exec && exec[0]);
comprobar('el mundo se guarda en /var/lib/kinhold (StateDirectory), fuera del código', exec && exec[4] === '/var/lib/kinhold/mundo.jsonl' && /^StateDirectory=kinhold$/m.test(serv1));
comprobar('el servicio vuelve a arrancar si se cae', /^Restart=always$/m.test(serv1) && /^WantedBy=multi-user.target$/m.test(serv1));
const sinIp = spawnSync('bash', [join(nube, 'instalar.sh'), '--solo-archivos', join(tmp, 'mal')], { env: { ...process.env, KINHOLD_IP: 'nada', KINHOLD_DOMINIO: '' } });
comprobar('sin IP válida se para con un aviso', sinIp.status !== 0 && /IP pública/.test(sinIp.stderr.toString()));
const propio = archivos({ KINHOLD_DOMINIO: 'juego.ejemplo.org', KINHOLD_PUERTO: '9000' }, join(tmp, 'propio'));
const caddyP = readFileSync(join(tmp, 'propio', 'Caddyfile'), 'utf8');
comprobar('con dominio propio y otro puerto', propio === 'juego.ejemplo.org' && caddyP.includes('reverse_proxy 127.0.0.1:9000') && caddyP.includes('wss://juego.ejemplo.org"'));

console.log('Caddy y systemd los aceptan');
const v = spawnSync('caddy', ['validate', '--adapter', 'caddyfile', '--config', join(d1, 'Caddyfile')], { env: { ...process.env, XDG_DATA_HOME: tmp, XDG_CONFIG_HOME: tmp } });
comprobar('caddy validate', v.status === 0, v.error ? 'no está caddy (apt-get install -y caddy)' : (v.status ? v.stderr.toString().trim().split('\n').pop() : ''));
const conNode = join(tmp, 'node'); archivos({ KINHOLD_IP: '1.2.3.4', KINHOLD_NODE: process.execPath }, conNode);
const sa = spawnSync('systemd-analyze', ['verify', join(conNode, 'kinhold.service')]);
const avisos = (sa.stderr || '').toString().split('\n').filter(l => l.trim() && !/not found|unknown user|Failed to resolve user|getpwnam|User=kinhold/i.test(l));
comprobar('systemd-analyze verify', !sa.error && avisos.length === 0, sa.error ? 'no está systemd-analyze' : avisos.join(' | '));

console.log('De verdad: Caddy (HTTPS local) delante del servidor del juego');
const pJuego = await libre(), pHttps = await libre(), pHttp = await libre();
const dl = join(tmp, 'local');
archivos({ KINHOLD_DOMINIO: 'localhost', KINHOLD_PUERTO: String(pJuego) }, dl);
const global = `{\n\tadmin off\n\tlocal_certs\n\tskip_install_trust\n\thttp_port ${pHttp}\n\thttps_port ${pHttps}\n}\n`;
writeFileSync(join(dl, 'Caddyfile'), global + readFileSync(join(dl, 'Caddyfile'), 'utf8'));
const srv = crearServidor({ puerto: pJuego, archivo: join(tmp, 'mundo', 'mundo.jsonl') });
await srv.listo;
const cad = spawn('caddy', ['run', '--adapter', 'caddyfile', '--config', join(dl, 'Caddyfile')], { env: { ...process.env, XDG_DATA_HOME: tmp, XDG_CONFIG_HOME: tmp }, stdio: ['ignore', 'ignore', 'pipe'] });
let regCaddy = ''; cad.stderr.on('data', d => regCaddy += d);
const pedir = () => new Promise((r) => {
  const q = request({ host: '127.0.0.1', port: pHttps, path: '/', servername: 'localhost', headers: { host: 'localhost' }, rejectUnauthorized: false }, res => { res.resume(); r({ estado: res.statusCode, a: res.headers.location }); });
  q.on('error', e => r({ error: e.message })); q.end();
});
let resp;
for (let i = 0; i < 60; i++) { resp = await pedir(); if (!resp.error) break; await new Promise(r => setTimeout(r, 250)); }
comprobar('abrir la dirección lleva a la demo con el servidor puesto', resp.estado === 302 && resp.a === `${JUEGO}?servidor=wss://localhost`, resp.error || `${resp.estado} → ${resp.a}`);

function cliente() {
  return new Promise((listo) => {
    const ws = new WebSocket(`wss://localhost:${pHttps}/`, { rejectUnauthorized: false });
    const c = { ws, recibidos: [] };
    ws.on('message', m => c.recibidos.push(JSON.parse(m)));
    ws.on('open', () => listo(c));
    ws.on('error', e => { c.error = e.message; listo(c); });
    c.esperar = (cond, ms = 3000) => new Promise(r => { const t0 = Date.now(); const mira = () => { const m = c.recibidos.find(cond); if (m || Date.now() - t0 > ms) r(m); else setTimeout(mira, 20); }; mira(); });
  });
}
const a = await cliente(), b = await cliente();
const ba = !a.error && await a.esperar(m => m.tipo === 'bienvenida'), bb = !b.error && await b.esperar(m => m.tipo === 'bienvenida');
comprobar('dos clientes conectan por wss:// a través de Caddy y reciben la bienvenida', ba && bb && ba.autor !== bb.autor, a.error || b.error || (ba && bb ? `${ba.autor} y ${bb.autor}` : 'sin bienvenida'));
if (ba && bb) {
  a.ws.send(JSON.stringify({ tipo: 'estado', x: 3, y: 0, z: 4, giro: 0.5, anim: 'andar' }));
  const visto = await b.esperar(m => m.tipo === 'estados' && (m.jugadores || []).some(j => j.autor === ba.autor && j.x === 3));
  comprobar('lo que manda uno le llega al otro a través de Caddy', !!visto);
}
for (const c of [a, b]) try { c.ws.close(); } catch (e) {}
cad.kill(); await srv.cerrar();
rmSync(tmp, { recursive: true, force: true });
if (mal && regCaddy && process.env.VER_CADDY) console.log(regCaddy.slice(-2000));
console.log(`\n${ok}/${ok + mal} comprobaciones correctas${MUTAR ? ' (MUTAR=1: debería fallar)' : ''}`);
process.exit(mal ? 1 : 0);
