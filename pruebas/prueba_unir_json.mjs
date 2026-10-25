// Pruebas de la unión del diario y las traducciones (herramientas/unir_json.mjs). Ejecutar: node pruebas/prueba_unir_json.mjs
// Primero la unión de tres vías con casos pequeños; después un caso real con git: dos ramas que añaden
// cada una su entrada al final del diario y sus textos al final de en.json, y se fusionan sin conflicto.
// Con MUTAR=1 la unión no tiene en cuenta la otra rama y en git no se activa: las pruebas deben FALLAR.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as U from '../herramientas/unir_json.mjs';

const MUTAR = process.env.MUTAR === '1';
const unirDiario = MUTAR ? (b, n) => U.unirDiario(b, n, n) : U.unirDiario;
const unirTraducciones = MUTAR ? (b, n) => U.unirTraducciones(b, n, n) : U.unirTraducciones;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const E = (h, t, extra = {}) => ({ inicio: `2026-10-25T${h}:00+00:00`, titulo: t, estado: 'ok', ...extra });
const titulos = (l) => l.map((e) => e.titulo).join(',');

console.log('Diario: unión de tres vías');
{
  const base = [E('10:00', 'a'), E('11:00', 'b')];
  let r = unirDiario(base, [...base, E('12:00', 'c')], [...base, E('12:05', 'd')]);
  comprobar('las dos ramas añaden al final: entran las dos, la nuestra primero', titulos(r.resultado) === 'a,b,c,d' && !r.choques.length, titulos(r.resultado));
  r = unirDiario(base, [...base, E('12:30', 'c')], [...base, E('12:05', 'd'), E('13:00', 'e')]);
  comprobar('las entradas de la otra rama se meten por su hora de inicio', titulos(r.resultado) === 'a,b,d,c,e', titulos(r.resultado));
  r = unirDiario(base, [...base, E('12:00', 'c')], [...base, E('12:00', 'c')]);
  comprobar('la misma entrada en las dos ramas entra una sola vez', titulos(r.resultado) === 'a,b,c' && !r.choques.length);
  r = unirDiario(base, [base[0], E('11:00', 'b', { estado: 'fallo' })], [...base, E('12:00', 'd')]);
  comprobar('un cambio de una rama en una entrada vieja se conserva', r.resultado[1].estado === 'fallo' && titulos(r.resultado) === 'a,b,d' && !r.choques.length);
  r = unirDiario(base, [...base], [base[0], E('11:00', 'b', { fin: 'x' })]);
  comprobar('el cambio de la otra rama también se conserva', r.resultado[1].fin === 'x' && !r.choques.length);
  r = unirDiario(base, [E('11:00', 'b')], [...base, E('12:00', 'd')]);
  comprobar('lo que quita una rama sin que la otra lo cambie se quita', titulos(r.resultado) === 'b,d' && !r.choques.length);
  r = unirDiario(base, [base[0], E('11:00', 'b', { estado: 'fallo' })], [base[0], E('11:00', 'b', { estado: 'ok2' })]);
  comprobar('las dos cambian la misma entrada de forma distinta: choque, no se elige solo', r.choques.length === 1, r.choques.join());
  r = unirDiario([], [E('10:00', 'a')], [E('10:00', 'a'), E('11:00', 'z')]);
  comprobar('sin ancestro común (archivo nuevo en las dos ramas)', titulos(r.resultado) === 'a,z' && !r.choques.length);
  let error = '';
  try { U.unirDiario([], [E('10:00', 'a'), E('10:00', 'a')], []); } catch (e) { error = e.message; }
  comprobar('una entrada repetida en un lado se avisa', error.includes('repetida'), error);
}

console.log('Traducciones: unión de tres vías');
{
  const base = { Hola: 'Hello', Casa: 'House' };
  let r = unirTraducciones(base, { ...base, Muro: 'Wall' }, { ...base, Puerta: 'Door' });
  comprobar('textos nuevos de las dos ramas entran, en orden', Object.keys(r.resultado).join() === 'Hola,Casa,Muro,Puerta' && !r.choques.length, Object.keys(r.resultado).join());
  r = unirTraducciones(base, { ...base, Casa: 'Home' }, { ...base, Puerta: 'Door' });
  comprobar('una traducción corregida en una rama se conserva', r.resultado.Casa === 'Home' && r.resultado.Puerta === 'Door' && !r.choques.length);
  r = unirTraducciones(base, { ...base, Casa: 'Home' }, { ...base, Casa: 'Hut' });
  comprobar('la misma traducción cambiada distinto en las dos: choque', r.choques.length === 1 && r.choques[0] === 'Casa');
  r = unirTraducciones(base, { Hola: 'Hello' }, { ...base, Muro: 'Wall' });
  comprobar('un texto que ya no se usa y se quita en una rama se quita', !('Casa' in r.resultado) && r.resultado.Muro === 'Wall' && !r.choques.length);
}

console.log('Formato del archivo');
{
  const tb = '[\n {\n  "inicio": "1",\n  "titulo": "a"\n }\n]';
  const tn = '[\n {\n  "inicio": "1",\n  "titulo": "a"\n },\n {\n  "inicio": "2",\n  "titulo": "b"\n }\n]';
  const ts = '[\n {\n  "inicio": "1",\n  "titulo": "a"\n },\n {\n  "inicio": "3",\n  "titulo": "c"\n }\n]';
  const { texto } = U.unirTextos(tb, tn, ts);
  comprobar('mantiene la sangría de un espacio y no añade salto final', texto === JSON.stringify(JSON.parse(tn).concat({ inicio: '3', titulo: 'c' }), null, 1));
  comprobar('si el archivo acaba en salto de línea, lo mantiene', U.unirTextos('{}\n', '{\n  "a": 1\n}\n', '{}\n').texto === '{\n  "a": 1\n}\n');
}

console.log('Caso real con git: dos sesiones en paralelo');
{
  const raizProyecto = join(dirname(fileURLToPath(import.meta.url)), '..');
  const d = mkdtempSync(join(tmpdir(), 'kinhold-unir-'));
  const g = (...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8' });
  const esc = (ruta, obj) => writeFileSync(join(d, ruta), JSON.stringify(obj, null, 1));
  const lee = (ruta) => JSON.parse(readFileSync(join(d, ruta), 'utf8'));
  try {
    g('init', '-q', '-b', 'main');
    g('config', 'user.email', 'prueba@kinhold'); g('config', 'user.name', 'Prueba');
    mkdirSync(join(d, 'herramientas')); mkdirSync(join(d, 'proyecto/idiomas'), { recursive: true });
    cpSync(join(raizProyecto, 'herramientas/unir_json.mjs'), join(d, 'herramientas/unir_json.mjs'));
    if (!MUTAR) execFileSync('node', ['herramientas/unir_json.mjs', '--instalar'], { cwd: d, encoding: 'utf8' });
    esc('proyecto/diario.json', [E('10:00', 'a')]); esc('proyecto/idiomas/en.json', { Hola: 'Hello' }); esc('proyecto/idiomas/ru.json', { Hola: 'Привет' });
    g('add', '-A'); g('commit', '-qm', 'base');
    g('checkout', '-qb', 'trabajo/chat');
    esc('proyecto/diario.json', [E('10:00', 'a'), E('11:00', 'chat')]); esc('proyecto/idiomas/en.json', { Hola: 'Hello', Muro: 'Wall' }); esc('proyecto/idiomas/ru.json', { Hola: 'Привет', Muro: 'Стена' });
    g('commit', '-qam', 'chat');
    g('checkout', '-q', 'main'); g('checkout', '-qb', 'trabajo/auto');
    esc('proyecto/diario.json', [E('10:00', 'a'), E('11:05', 'auto')]); esc('proyecto/idiomas/en.json', { Hola: 'Hello', Puerta: 'Door' }); esc('proyecto/idiomas/ru.json', { Hola: 'Привет', Puerta: 'Дверь' });
    g('commit', '-qam', 'auto');
    g('checkout', '-q', 'main');
    const m1 = g('merge', '-q', '--no-edit', 'trabajo/chat');
    const m2 = g('merge', '-q', '--no-edit', 'trabajo/auto');
    if (m2.status !== 0) g('merge', '--abort');
    comprobar('la segunda fusión no da conflicto', m1.status === 0 && m2.status === 0, (m2.stdout + m2.stderr).trim().split('\n').slice(-1)[0]);
    let diario = [], en = {}, ru = {};
    try { diario = lee('proyecto/diario.json'); en = lee('proyecto/idiomas/en.json'); ru = lee('proyecto/idiomas/ru.json'); } catch { /* con conflicto no es JSON válido */ }
    comprobar('el diario lleva las entradas de las dos sesiones', titulos(diario) === 'a,chat,auto', titulos(diario));
    comprobar('en.json y ru.json llevan los textos de las dos', en.Muro === 'Wall' && en.Puerta === 'Door' && ru.Muro === 'Стена' && ru.Puerta === 'Дверь');
    // un choque de verdad sí se para
    g('checkout', '-qb', 'x1'); esc('proyecto/idiomas/en.json', { ...lee('proyecto/idiomas/en.json'), Hola: 'Hi' }); g('commit', '-qam', 'x1');
    g('checkout', '-q', 'main'); g('checkout', '-qb', 'x2'); esc('proyecto/idiomas/en.json', { ...lee('proyecto/idiomas/en.json'), Hola: 'Hey' }); g('commit', '-qam', 'x2');
    const m3 = g('merge', '-q', '--no-edit', 'x1');
    comprobar('si las dos cambian la misma traducción distinto, git lo deja en conflicto', m3.status !== 0 && (MUTAR || (m3.stdout + m3.stderr).includes('Hola')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}

console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
