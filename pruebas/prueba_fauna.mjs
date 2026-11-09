// Prueba de las liebres (P4; GDD, apartado 14; src/logica/fauna.js y servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_fauna.mjs
// Comprueba, en la lógica pura y con el servidor de verdad (clientes por websocket, con un mundo de prueba: un prado con
// un río a un lado):
//   - cada trozo tiene siempre las mismas liebres, solo en su prado (nada en el agua ni en el bosque);
//   - sin nadie cerca, pastan cerca de su querencia; con alguien a 15 m se ponen alerta; a 5 m huyen, a más de 9 m/s,
//     alejándose de él, y no se meten en el agua; se paran después y vuelven a pastar;
//   - en el servidor: a los dos jugadores les llega la misma liebre en el mismo sitio; al acercarse uno, huye y el otro
//     la ve huir igual; a quien se aleja (otros trozos) se le dice que se va.
// MUTAR=1: las liebres no huyen (la huida no se activa): tiene que FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { azar } from '../src/logica/azar.js';

const MUTAR = process.env.MUTAR || '';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

// la lógica (mutada si MUTAR=1) y el servidor que la usa
let rutaFauna = join(raiz, 'src/logica/fauna.js'), rutaServidor = join(raiz, 'servidor/servidor.mjs');
const copias = [];
if (MUTAR) {
  const f = readFileSync(rutaFauna, 'utf8'), m = f.replace("const huye = p && d <", "const huye = false && p && d <");
  if (m === f) { console.log('No se pudo mutar la fauna'); process.exit(1); }
  rutaFauna = join(raiz, 'src/logica/.fauna_mutada.js'); writeFileSync(rutaFauna, m); copias.push(rutaFauna);
  const s = readFileSync(rutaServidor, 'utf8'), ms = s.replace("from '../src/logica/fauna.js'", "from '../src/logica/.fauna_mutada.js'");
  rutaServidor = join(raiz, 'servidor/.servidor_mutado_fauna.mjs'); writeFileSync(rutaServidor, ms); copias.push(rutaServidor);
}
const { Fauna, FAUNA, liebresDelTrozo } = await import(pathToFileURL(rutaFauna).href);
const { crearServidor } = await import(pathToFileURL(rutaServidor).href);

// el mundo de prueba: prado en z < 300, bosque más allá; un río (agua) en x > 200
const pisable = (x, z) => x <= 200;
const habitat = (x, z) => x <= 200 && z < 300;

try {
  console.log('Lógica:');
  // siempre las mismas, y solo en el prado
  const a = liebresDelTrozo('0,0', habitat, 5), b = liebresDelTrozo('0,0', habitat, 5);
  comprobar('las liebres de un trozo son siempre las mismas', JSON.stringify(a) === JSON.stringify(b), `${a.length} en 0,0`);
  let n = 0, fuera = 0;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (const l of liebresDelTrozo(`${i},${j}`, habitat, 5)) { n++; if (!habitat(l.x, l.z)) fuera++; }
  comprobar('hay liebres en el prado y ninguna fuera de él (agua o bosque)', n > 20 && fuera === 0, `${n} en 169 trozos, ${fuera} fuera`);
  const bosque = (() => { let k = 0; for (let i = 0; i < 6; i++) for (let j = 3; j < 9; j++) k += liebresDelTrozo(`${i},${j}`, habitat, 5).length; return k; })();
  comprobar('en el bosque cerrado no sale ninguna', bosque === 0, `${bosque}`);

  // sin nadie cerca, pastan cerca de su querencia
  const F = new Fauna({ habitat, pisable, semilla: 5, azar: azar(9) });
  const lejos = { x: 64 + 128, z: 64, vel: 0 };    // en el trozo de al lado: el 0,0 está vivo
  for (let s = 0; s < 600; s++) F.avanzar(0.2, [lejos]);
  const L = F.todas();
  comprobar('los trozos de alrededor tienen liebres vivas', L.length > 0, `${L.length}`);
  const l = L.find(k => Math.hypot(k.x - lejos.x, k.z - lejos.z) > 60) || L[0];
  const estados = new Set();
  let maxCasa = 0;
  for (let s = 0; s < 600; s++) { F.avanzar(0.2, [lejos]); estados.add(l.estado); maxCasa = Math.max(maxCasa, Math.hypot(l.x - l.casa.x, l.z - l.casa.z)); }
  comprobar('sin nadie cerca pastan y dan saltos cortos, cerca de su querencia', estados.has('pastar') && estados.has('saltar') && !estados.has('huir') && maxCasa < FAUNA.RADIO_CASA + 6, `${[...estados].join(', ')}; hasta ${maxCasa.toFixed(1)} m de casa`);

  // alguien a 15 m: alerta
  const lx = l.x, lz = l.z;
  const ante = (d, ang = 0) => ({ x: l.x + Math.sin(ang) * d, z: l.z + Math.cos(ang) * d, vel: 1.2 });
  F.avanzar(0.2, [lejos, ante(15)]);
  comprobar('con alguien a 15 m se pone alerta (quieta)', l.estado === 'alerta', l.estado);
  F.avanzar(0.2, [lejos, ante(15)]);
  comprobar('alerta no se mueve', Math.hypot(l.x - lx, l.z - lz) < 0.05);
  // a 5 m: huye, deprisa y alejándose
  const p = ante(5, 0.3), x0 = l.x, z0 = l.z, d0 = Math.hypot(p.x - x0, p.z - z0);
  F.avanzar(0.2, [lejos, p]);
  comprobar('con alguien a 5 m huye', l.estado === 'huir', l.estado);
  for (let s = 0; s < 9; s++) F.avanzar(0.2, [lejos, p]);
  const corrido = Math.hypot(l.x - x0, l.z - z0), d1 = Math.hypot(p.x - l.x, p.z - l.z);
  comprobar('corre a más de 9 m/s', corrido / 2 > 9, `${(corrido / 2).toFixed(1)} m/s`);
  comprobar('se aleja de quien llega', d1 > d0 + 15, `de ${d0.toFixed(1)} a ${d1.toFixed(1)} m`);
  let paro = false;
  for (let s = 0; s < 60 && !paro; s++) { F.avanzar(0.2, [lejos, p]); paro = l.estado === 'alerta'; }
  comprobar('después se para (alerta)', paro, l.estado);
  for (let s = 0; s < 40; s++) F.avanzar(0.2, [lejos]);
  comprobar('sin nadie cerca vuelve a pastar', l.estado === 'pastar' || l.estado === 'saltar', l.estado);

  // huye hacia el río: no se mete en el agua
  const G = new Fauna({ habitat, pisable, semilla: 5, azar: azar(3) });
  G.avanzar(0.2, [{ x: 150, z: 60, vel: 0 }]);
  const q = G.todas().find(k => k.x > 100) || G.todas()[0];
  q.x = 195; q.z = 60;
  let enAgua = false;
  for (let s = 0; s < 50; s++) { G.avanzar(0.2, [{ x: 190, z: 60, vel: 4 }]); if (!pisable(q.x, q.z)) enAgua = true; }
  comprobar('acorralada contra el agua, no se mete en ella', !enAgua && q.x <= 200, `x ${q.x.toFixed(1)}`);

  // trozos sin nadie: se olvidan
  const H = new Fauna({ habitat, pisable, semilla: 5, azar: azar(4) });
  H.avanzar(0.2, [{ x: 64, z: 64, vel: 0 }]);
  const antes = H.todas().length;
  for (let s = 0; s < (FAUNA.OLVIDO + 5) / 0.2; s++) H.avanzar(0.2, [{ x: 64 + 128 * 20, z: 64, vel: 0 }]);
  const quedan = H.todas().filter(k => Math.abs(k.x - 64) < 300).length;
  comprobar('las de un trozo sin nadie cerca se olvidan', antes > 0 && quedan === 0 && H.sacarCambios().quitadas.length > 0, `${antes} → ${quedan}`);

  // el servidor
  console.log('Servidor:');
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-fauna-'));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), latido: 400, limiteMovimiento: false, fauna: { habitat, pisable }, ticoFauna: 100 });
  const puerto = await s.listo;
  const cliente = () => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, liebres: new Map(), fuera: [] };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estar = (x, z, anim = 'quieto') => c.mandar({ tipo: 'estado', x, y: 0, z, giro: 0, anim });
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') listo(c);
      if (m.tipo === 'fauna') { for (const f of m.liebres) c.liebres.set(f.id, f); for (const id of m.fuera) { c.liebres.delete(id); c.fuera.push(id); } }
    });
    ws.on('error', fallo);
  });
  const A = await cliente(), B = await cliente();
  const vivas = s.fauna.todas().length;
  // los dos en el mismo sitio: les llegan las mismas
  A.estar(150, 150); B.estar(152, 150);
  await pausa(700);
  const idsA = [...A.liebres.keys()].sort(), idsB = [...B.liebres.keys()].sort();
  comprobar('a los dos les llegan las liebres de alrededor', idsA.length > 0 && JSON.stringify(idsA) === JSON.stringify(idsB), `${idsA.length} (${vivas} vivas al empezar)`);
  // una cualquiera: A se le acerca; las dos la ven huir igual
  const id = idsA[0], lv = s.fauna.de(id);
  for (let k = 0; k < 5; k++) { A.estar(lv.x + 4, lv.z, 'correr'); await pausa(60); }
  await pausa(900);
  const fa = A.liebres.get(id), fb = B.liebres.get(id);
  comprobar('al acercarse uno, la liebre huye (lo dice el servidor)', fa && (fa.anim === 'huir' || Math.hypot(fa.x - lv.casa.x, fa.z - lv.casa.z) > 8), fa ? `${fa.anim}, a ${Math.hypot(fa.x - lv.casa.x, fa.z - lv.casa.z).toFixed(1)} m de su sitio` : 'no llega');
  comprobar('el otro la ve en el mismo sitio y haciendo lo mismo', fa && fb && fa.x === fb.x && fa.z === fb.z && fa.anim === fb.anim, fb ? `${fb.x}, ${fb.z}` : 'no llega');
  // B se va lejos (otros trozos): se le dice que las de aquí se van
  B.estar(150 + 128 * 8, 150);
  await pausa(600);
  comprobar('a quien se va lejos se le dice que esas liebres ya no están', B.fuera.includes(id) && !B.liebres.has(id), `${B.fuera.length} fuera`);
  A.ws.close(); B.ws.close();
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
} finally {
  for (const c of copias) rmSync(c, { force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
