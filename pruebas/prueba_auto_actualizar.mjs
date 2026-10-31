// Prueba de servidor/nube/auto_actualizar.sh (el servidor, al día solo con cada versión nueva de la demo; valravnx,
// 31 oct). Un repositorio de mentira hace de GitHub y una copia corta (--depth 1, como la del servidor) hace de
// /opt/kinhold. «Poner al día» es lo mismo que hace actualizar.sh con git (git pull --ff-only) y apuntar que se llamó.
// Comprueba: la primera vez solo apunta la versión puesta; un cambio sin versión nueva no reinicia nada; una versión
// nueva sí (y la copia queda en ella); y no se repite.
// MUTAR=1: mira la versión de la copia de aquí y no la de main (no vería nunca las nuevas): tiene que fallar.
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = mkdtempSync(join(tmpdir(), 'kinhold-auto-'));
const ORIGEN = join(T, 'origen'), TRABAJO = join(T, 'trabajo'), DIR = join(T, 'opt-kinhold'), ESTADO = join(T, 'estado', 'version'), LLAMADAS = join(T, 'llamadas');
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=prueba', '-c', 'user.email=prueba@kinhold.invalid', '-c', 'init.defaultBranch=main', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let fallos = 0, bien = 0;
const comprobar = (n, c, d = '') => { console.log(`${c ? '  OK  ' : '  FALLA'} ${n}${d ? ' — ' + d : ''}`); c ? bien++ : fallos++; };

// el script que se prueba (con MUTAR, estropeado a propósito)
let guion = readFileSync(join(RAIZ, 'servidor/nube/auto_actualizar.sh'), 'utf8');
if (process.env.MUTAR) guion = guion.replace('nueva="$(ultima FETCH_HEAD)"', 'nueva="$(ultima HEAD)"');
const GUION = join(T, 'auto_actualizar.sh'); writeFileSync(GUION, guion);

// «GitHub»: un repositorio con la demo v1
mkdirSync(TRABAJO); git(TRABAJO, 'init', '-q');
const subir = (archivo, texto, msj) => { mkdirSync(dirname(join(TRABAJO, archivo)), { recursive: true }); writeFileSync(join(TRABAJO, archivo), texto); git(TRABAJO, 'add', '-A'); git(TRABAJO, 'commit', '-qm', msj); git(TRABAJO, 'push', '-q', ORIGEN, 'HEAD:main'); };
git(T, 'init', '-q', '--bare', ORIGEN);
subir('docs/jugar/demo/v1.html', 'demo 1', 'demo v1');
subir('docs/jugar/demo/v9.html', 'demo 9', 'demo v9');           // (la 10 tiene que ganar a la 9: por número, no por letras)
// el servidor: copia corta, como la de cloud-config.yaml
git(T, 'clone', '-q', '--depth', '1', `file://${ORIGEN}`, DIR);

const lanzar = () => execFileSync('bash', [GUION], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, KINHOLD_DIR: DIR, KINHOLD_ESTADO: ESTADO, KINHOLD_ACTUALIZAR: `git -C "${DIR}" pull -q --ff-only && echo x >> "${LLAMADAS}"` },
});
const llamadas = () => existsSync(LLAMADAS) ? readFileSync(LLAMADAS, 'utf8').trim().split('\n').filter(Boolean).length : 0;
const estado = () => existsSync(ESTADO) ? readFileSync(ESTADO, 'utf8').trim() : null;

lanzar();
comprobar('la primera vez apunta la versión puesta y no reinicia nada', estado() === '9' && llamadas() === 0, `apuntada v${estado()}, ${llamadas()} puestas al día`);

subir('proyecto/diario.json', '[]', 'diario');
lanzar();
comprobar('con un cambio sin versión nueva de la demo, nada', llamadas() === 0 && estado() === '9', `${llamadas()} puestas al día`);

subir('docs/jugar/demo/v10.html', 'demo 10', 'demo v10');
let sal = '';
try { sal = lanzar(); } catch (e) { sal = String(e.stderr || e.message); }
comprobar('con una versión nueva, se pone al día una vez (git pull en la copia corta)', llamadas() === 1, `${llamadas()} puestas al día; ${sal.split('\n')[0]}`);
comprobar('y apunta la nueva (v10, no v9)', estado() === '10', `apuntada v${estado()}`);
comprobar('la copia del servidor queda en la versión nueva', existsSync(join(DIR, 'docs/jugar/demo/v10.html')) && existsSync(join(DIR, 'proyecto/diario.json')));

lanzar();
comprobar('después, sin nada nuevo, no se repite', llamadas() === 1, `${llamadas()} puestas al día`);

rmSync(T, { recursive: true, force: true });
console.log(`\n${bien} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
