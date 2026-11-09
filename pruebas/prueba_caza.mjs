// Prueba de cazar con la lanza endurecida (P4; src/logica/caza.js, src/logica/objetos_red.js y servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_caza.mjs
// Comprueba, en la lógica pura y con el servidor de verdad (clientes por websocket, un prado de prueba):
//   - la lanza vuela en línea recta a su velocidad y cae al final de su alcance si no da en nada;
//   - si en su vuelo pasa junto a una liebre, la mata ahí; si la liebre se aparta antes, no;
//   - si delante hay agua, cae antes de ella;
//   - en el servidor: sin la lanza en la mano no se lanza; con ella, sale de la mano, el otro jugador la ve volar, el
//     servidor decide que acierta, la liebre sale de la fauna (no vuelve a salir) y en el suelo quedan la liebre muerta y
//     la lanza, que se recoge; lanzando hacia donde no hay nada, la lanza cae a 20 m.
// MUTAR=1: la lanza no da nunca en la liebre: tiene que FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const MUTAR = process.env.MUTAR || '';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let rutaCaza = join(raiz, 'src/logica/caza.js'), rutaServidor = join(raiz, 'servidor/servidor.mjs');
const copias = [];
if (MUTAR) {
  const f = readFileSync(rutaCaza, 'utf8'), m = f.replace('if (t.d <= CAZA.RADIO &&', 'if (false && t.d <= CAZA.RADIO &&');
  if (m === f) { console.log('No se pudo mutar la caza'); process.exit(1); }
  rutaCaza = join(raiz, 'src/logica/.caza_mutada.js'); writeFileSync(rutaCaza, m); copias.push(rutaCaza);
  const s = readFileSync(rutaServidor, 'utf8'), ms = s.replace("from '../src/logica/caza.js'", "from '../src/logica/.caza_mutada.js'");
  rutaServidor = join(raiz, 'servidor/.servidor_mutado_caza.mjs'); writeFileSync(rutaServidor, ms); copias.push(rutaServidor);
}
const { Lanzas, CAZA } = await import(pathToFileURL(rutaCaza).href);
const { crearServidor } = await import(pathToFileURL(rutaServidor).href);

const pisable = (x, z) => x <= 200;
const habitat = (x, z) => x <= 200 && z < 300;

try {
  console.log('Lógica:');
  const cosa = { tipo: 'lanza_endurecida', n: 1 };
  // sin nada delante: vuela a su velocidad y cae a su alcance
  let L = new Lanzas({ pisable });
  L.lanzar({ autor: 'a', x: 0, z: 0, dir: 0, cosa });
  let caen = [], t = 0;
  while (!caen.length && t < 5) { caen = L.avanzar(0.1, []); t += 0.1; }
  comprobar('sin nada delante cae al final de su alcance, a su velocidad', caen.length === 1 && !caen[0].liebre && Math.abs(caen[0].z - CAZA.ALCANCE) < 0.01 && Math.abs(t - CAZA.ALCANCE / CAZA.VEL) < 0.15, caen[0] && `${caen[0].z} m en ${t.toFixed(1)} s`);
  // una liebre a 12 m en su camino: la mata ahí
  L = new Lanzas({ pisable });
  L.lanzar({ autor: 'a', x: 0, z: 0, dir: 0, cosa });
  const liebre = { id: 'liebre:0,0:0', x: 0.2, z: 12 };
  caen = []; for (let k = 0; k < 30 && !caen.length; k++) caen = L.avanzar(0.1, [liebre]);
  comprobar('si pasa junto a una liebre, la mata ahí', caen.length === 1 && caen[0].liebre === liebre.id && Math.abs(caen[0].z - 12) < 0.5, caen[0] && `${caen[0].liebre} en ${caen[0].z}`);
  // la liebre se aparta antes de que llegue
  L = new Lanzas({ pisable });
  L.lanzar({ autor: 'a', x: 0, z: 0, dir: 0, cosa });
  const lista = { id: 'l2', x: 0, z: 14 };
  caen = []; for (let k = 0; k < 30 && !caen.length; k++) { if (k === 3) lista.x = 3; caen = L.avanzar(0.1, [lista]); }
  comprobar('si la liebre se aparta antes, no', caen.length === 1 && !caen[0].liebre, caen[0] && `${caen[0].liebre}`);
  // hacia el agua: cae antes de ella
  L = new Lanzas({ pisable });
  L.lanzar({ autor: 'a', x: 190, z: 0, dir: Math.PI / 2, cosa });
  caen = []; for (let k = 0; k < 30 && !caen.length; k++) caen = L.avanzar(0.1, []);
  comprobar('hacia el agua, cae antes de ella', caen.length === 1 && caen[0].x <= 200 && caen[0].x > 195, caen[0] && `x ${caen[0].x}`);

  console.log('Servidor:');
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-caza-'));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), latido: 400, limiteMovimiento: false, arconPruebas: true, fauna: { habitat, pisable }, ticoFauna: 100 });
  const puerto = await s.listo;
  const cliente = () => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, liebres: new Map(), id: 0, esperas: [], vistas: [], caidas: [], suelo: [] };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estar = (x, z) => { c.pos = { x, z }; c.mandar({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }); };
    c.objeto = (accion) => new Promise(r => { const id = ++c.id; c.esperas.push({ id, r }); c.mandar({ tipo: 'objeto', id, accion }); });
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') listo(c);
      if (m.tipo === 'fauna') { for (const f of m.liebres) c.liebres.set(f.id, f); for (const id of m.fuera) c.liebres.delete(id); }
      if (m.tipo === 'lanza') c.vistas.push(m);
      if (m.tipo === 'lanza_cae') c.caidas.push(m);
      if (m.tipo === 'suelo') c.suelo = m.objetos;
      if (m.tipo === 'resultado_objeto') c.esperas = c.esperas.filter(e => { if (e.id === m.id) { e.r(m); return false; } return true; });
    });
    ws.on('error', fallo);
  });
  const A = await cliente(), B = await cliente();
  A.estar(150, 150); B.estar(150, 152);
  await pausa(600);
  // una liebre de alrededor; A se pone a 15 m (andando: se pone alerta y se queda quieta)
  const id = [...A.liebres.keys()].find(k => { const l = s.fauna.de(k); return l && l.x < 185 && l.z < 280 && l.x > 20; });
  const lv = s.fauna.de(id);
  A.estar(lv.x, lv.z - 15); B.estar(lv.x + 1, lv.z - 16);
  await pausa(700);
  comprobar('a 15 m, la liebre se queda alerta (quieta)', s.fauna.de(id) && s.fauna.de(id).estado === 'alerta', s.fauna.de(id) && s.fauna.de(id).estado);
  let r = await A.objeto({ tipo: 'lanzar', de: 'mano:der', x: A.pos.x, z: A.pos.z, dir: 0 });
  comprobar('sin la lanza en la mano no se lanza', !r.ok, r.motivo);
  r = await A.objeto({ tipo: 'coger', objeto: 'lanza_endurecida', cantidad: 1, a: 'mano:der' });
  comprobar('(del arcón de pruebas, la lanza a la mano)', r.ok, r.motivo);
  const l = s.fauna.de(id), apunta = Math.atan2(l.x - A.pos.x, l.z - A.pos.z);
  r = await A.objeto({ tipo: 'lanzar', de: 'mano:der', x: A.pos.x, z: A.pos.z, dir: apunta });
  const inv = s.objetos.invs.de(s.objetos.registro.entradas.at(-1).autor);
  comprobar('con la lanza en la mano, la lanza: sale de la mano', r.ok && !inv.lugares['mano:der'], r.motivo);
  await pausa(1600);
  comprobar('el otro jugador la ve salir volando', B.vistas.length === 1 && B.vistas[0].vel === CAZA.VEL, JSON.stringify(B.vistas[0]));
  const c = A.caidas[0];
  comprobar('el servidor decide que acierta: la liebre cae', c && c.liebre === id && B.caidas[0] && B.caidas[0].liebre === id, JSON.stringify(c));
  comprobar('la liebre ya no está en la fauna ni se le manda', !s.fauna.de(id) && !A.liebres.has(id) && !B.liebres.has(id));
  const muerta = A.suelo.find(o => o.cosa.tipo === 'liebre'), lanza = A.suelo.find(o => o.cosa.tipo === 'lanza_endurecida');
  comprobar('en el suelo, la liebre muerta y la lanza a su lado (los dos lo ven)', muerta && lanza && Math.hypot(muerta.x - lanza.x, muerta.z - lanza.z) < 1 && B.suelo.some(o => o.cosa.tipo === 'liebre'), muerta && `liebre en ${muerta.x}, ${muerta.z}`);
  // va a por ellas y las coge
  A.estar(lanza.x, lanza.z); await pausa(300);
  r = await A.objeto({ tipo: 'coger_suelo', objeto: lanza.id, x: A.pos.x, z: A.pos.z, a: 'mano:der' });
  const r2 = await A.objeto({ tipo: 'coger_suelo', objeto: muerta.id, x: A.pos.x, z: A.pos.z, a: 'mano:izq' });
  comprobar('recoge la lanza y la liebre', r.ok && r2.ok, `${r.motivo || ''} ${r2.motivo || ''}`);
  // hacia donde no hay ninguna (al sur, de espaldas a todo): cae a 20 m
  const antes = A.caidas.length, desde = { ...A.pos };
  r = await A.objeto({ tipo: 'lanzar', de: 'mano:der', x: A.pos.x, z: A.pos.z, dir: Math.PI });
  await pausa(1700);
  const c2 = A.caidas[antes];
  comprobar('lanzada hacia donde no hay nada, cae a su alcance', r.ok && c2 && !c2.liebre && Math.abs(Math.hypot(c2.x - desde.x, c2.z - desde.z) - CAZA.ALCANCE) < 0.6, c2 && JSON.stringify(c2));
  // la cazada no vuelve a salir aunque su trozo se olvide y vuelva
  comprobar('la cazada no vuelve a salir', !s.fauna.viva(id));
  A.ws.close(); B.ws.close();
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
} finally {
  for (const c of copias) rmSync(c, { force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
