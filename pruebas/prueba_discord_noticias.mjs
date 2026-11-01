// Comprueba las noticias del desarrollo en Discord (herramientas/discord_noticias.mjs), sin Discord de verdad:
//   - solo salen las entradas del diario que no estaban antes (no se repite lo ya publicado) y como mucho MAX_MENSAJES
//   - la entrada lleva su título, lo hecho, el hito, el tiempo, las pruebas y su captura; las que fallaron, marcadas
//   - cada versión nueva sale con su nota, el enlace para jugarla y su captura
//   - de punta a punta: en un repositorio de mentira con dos commits, el publicador manda a un webhook falso (un servidor
//     local) una versión y una entrada del diario, cada una a su canal, y nada si no hay webhooks
// Uso: node pruebas/prueba_discord_noticias.mjs     MUTAR=1 → el diario se publica entero (sin quitar lo de antes): tiene que fallar.
import { noticias, MAX_MENSAJES } from '../herramientas/discord_noticias.mjs';
import { execFileSync, spawn } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const MUTAR = process.env.MUTAR || '';
const AQUI = dirname(fileURLToPath(import.meta.url));
let fallos = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ' — ' + d : '')); if (!c) fallos++; };

// ---------- lo puro ----------
const e = (i, extra = {}) => ({ inicio: `2026-11-01T10:${String(i).padStart(2, '0')}:00+01:00`, fin: `2026-11-01T10:${String(i + 20).padStart(2, '0')}:00+01:00`,
  titulo: `Tarea ${i}`, hito: 'servidor', hecho: [`Hecho ${i}`], pruebas: 'Todo bien', estado: 'ok', ...extra });
const roadmap = { hitos: [{ id: 'servidor', nombre: 'Cuentas' }], prototipos: [{ id: 'demo', nombre: 'Demo única', versiones: [{ v: 'v91', fecha: '2026-11-01', notas: 'El tronco al hombro.', capturas: 'capturas/demo-v91' }] }] };
const antes = [e(1), e(2)];
const ahora = [e(1), e(2), e(3, { capturas: 'capturas/demo-v91' }), e(4, { estado: 'fallo' })];
const n = noticias({ diarioAntes: MUTAR === '1' ? [] : antes, diarioAhora: ahora, versionesNuevas: [{ prototipo: 'demo', v: 'v91' }], roadmap, sha: 'abc',
  captura: (c) => (c ? `https://raw.githubusercontent.com/x/abc/docs/${c}/pc.jpg` : null) });
comprobar('solo las entradas nuevas del diario', n.diario.length === 2 && n.diario[0].embeds[0].title === 'Tarea 3', n.diario.map(m => m.embeds[0].title).join(', '));
const d = n.diario[0].embeds[0];
comprobar('la entrada lleva lo hecho, el hito, el tiempo y las pruebas', d.description.includes('• Hecho 3') && d.fields.some(f => f.name === 'Hito' && f.value === 'Cuentas')
  && d.fields.some(f => f.name === 'Tiempo' && f.value === '20 min') && d.fields.some(f => f.name === 'Pruebas'), JSON.stringify(d.fields));
comprobar('y su captura', d.image && d.image.url.endsWith('/capturas/demo-v91/pc.jpg'));
comprobar('las que fallaron salen marcadas', n.diario[1].embeds[0].title.startsWith('⚠️'));
const v = n.versiones[0]?.embeds[0];
comprobar('la versión nueva lleva su nota, el enlace para jugarla y su captura', v && v.title === 'Demo única · v91' && v.description.includes('El tronco al hombro.')
  && v.description.includes('jugar/demo/') && v.url.endsWith('jugar/demo/v91.html') && v.image, JSON.stringify(v).slice(0, 200));
const muchas = noticias({ diarioAntes: [], diarioAhora: Array.from({ length: 30 }, (_, i) => e(i % 30)), versionesNuevas: [], roadmap, sha: 'x' });
comprobar(`como mucho ${MAX_MENSAJES} de golpe (las últimas)`, muchas.diario.length === MAX_MENSAJES && muchas.diario.at(-1).embeds[0].title === 'Tarea 29');
const largo = noticias({ diarioAntes: [], diarioAhora: [e(1, { hecho: Array(400).fill('x'.repeat(40)) })], versionesNuevas: [], roadmap, sha: 'x' });
comprobar('los textos largos se cortan a lo que admite Discord', largo.diario[0].embeds[0].description.length <= 4000);

// ---------- de punta a punta, en un repositorio de mentira ----------
const repo = mkdtempSync(join(tmpdir(), 'kinhold-discord-'));
const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
const escribir = (ruta, txt) => { mkdirSync(dirname(join(repo, ruta)), { recursive: true }); writeFileSync(join(repo, ruta), txt); };
g('init', '-q'); g('config', 'user.email', 'prueba@kinhold'); g('config', 'user.name', 'prueba');
escribir('proyecto/diario.json', JSON.stringify(antes)); escribir('proyecto/roadmap.json', JSON.stringify(roadmap));
escribir('docs/jugar/demo/v90.html', 'vieja');
g('add', '-A'); g('commit', '-qm', 'antes'); const c0 = g('rev-parse', 'HEAD');
escribir('proyecto/diario.json', JSON.stringify(ahora.slice(0, 3))); escribir('docs/jugar/demo/v91.html', 'nueva');
escribir('docs/capturas/demo-v91/movil_a.jpg', 'x'); escribir('docs/capturas/demo-v91/pc_a.jpg', 'x');
g('add', '-A'); g('commit', '-qm', 'ahora'); const c1 = g('rev-parse', 'HEAD');

const recibidos = [];
const srv = http.createServer((req, res) => { let b = ''; req.on('data', x => (b += x)); req.on('end', () => { recibidos.push({ url: req.url, cuerpo: JSON.parse(b) }); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const puerto = srv.address().port;
const lanzar = (env) => new Promise((ok) => {
  const p = spawn('node', [join(AQUI, '..', 'herramientas', 'discord_noticias.mjs'), c0, c1], { cwd: repo, env: { ...process.env, ...env } });
  let out = ''; p.stdout.on('data', x => (out += x)); p.stderr.on('data', x => (out += x)); p.on('close', (code) => ok({ code, out }));
});
const r1 = await lanzar({ DISCORD_WEBHOOK_VERSIONES: `http://127.0.0.1:${puerto}/versiones`, DISCORD_WEBHOOK_DIARIO: `http://127.0.0.1:${puerto}/diario` });
const aV = recibidos.filter(x => x.url.startsWith('/versiones')), aD = recibidos.filter(x => x.url.startsWith('/diario'));
comprobar('manda la versión nueva a #versiones y la entrada nueva a #diario-de-desarrollo', r1.code === 0 && aV.length === 1 && aD.length === 1, r1.out.trim().split('\n').slice(-2).join(' | '));
comprobar('la versión vieja no se repite', !aV.some(x => x.cuerpo.embeds[0].title.includes('v90')));
comprobar('con el nombre y el icono de Kinhold, sin mencionar a nadie', aV[0] && aV[0].cuerpo.username === 'Kinhold' && aV[0].cuerpo.avatar_url.includes('icono') && aV[0].cuerpo.allowed_mentions.parse.length === 0);
comprobar('la captura es la de PC de esa versión, en el commit exacto', aV[0] && aV[0].cuerpo.embeds[0].image?.url === `https://raw.githubusercontent.com/valravnxx/Kinhold/${c1}/docs/capturas/demo-v91/pc_a.jpg`, aV[0]?.cuerpo.embeds[0].image?.url);
recibidos.length = 0;
const r2 = await lanzar({ DISCORD_WEBHOOK_VERSIONES: '', DISCORD_WEBHOOK_DIARIO: '' });
comprobar('sin webhooks no manda nada (y no falla)', r2.code === 0 && recibidos.length === 0, r2.out.trim());
srv.close();

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
