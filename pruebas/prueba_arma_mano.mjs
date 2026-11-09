// Prueba del modo arma con lo que llevas en la mano (valravnx, 9 nov; src/logica/arma_mano.js, src/combate/logica.js,
// src/logica/combate_servidor.js y servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_arma_mano.mjs
// Comprueba, en la lógica pura y con el servidor de verdad (clientes por websocket, un prado de prueba con liebres):
//   - el arma es lo de la mano: vacías o con algo que no es un arma, puños; el hacha, hacha; la lanza, lanza; la piedra,
//     piedras (mira primero la derecha);
//   - la lanza clava (la estocada más larga que el tajo) y se lanza; lanzada, sale con poca fuerza (no más de 13 m/s) y
//     con desvío (unas caen a un lado y otras al otro), y puede dar a una liebre que esté en su camino;
//   - en el servidor: con las manos vacías, puños; al coger la lanza, su arma es la lanza (y el otro la ve en su mano);
//     al lanzarla apuntando a una liebre sale de su mano (puños otra vez) y cae al suelo, y alguna de las que lanza la
//     mata (la liebre muerta queda en el suelo y sale de las vivas); la lanza del suelo se recoge; la piedra se lanza y
//     se gasta (no queda en el suelo), y sin piedras vuelve a puños.
// MUTAR=1: el arma no sale de la mano (siempre puños): tiene que FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { Luchador, ARMAS, crearProyectil, moverProyectil, azar } from '../src/combate/logica.js';

const MUTAR = process.env.MUTAR || '';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let rutaMano = join(raiz, 'src/logica/arma_mano.js'), rutaServidor = join(raiz, 'servidor/servidor.mjs');
const copias = [];
if (MUTAR) {
  const f = readFileSync(rutaMano, 'utf8'), m = f.replace('if (c && Object.hasOwn(ARMA_DE, c.tipo))', 'if (false && c && Object.hasOwn(ARMA_DE, c.tipo))');
  if (m === f) { console.log('No se pudo mutar el arma de la mano'); process.exit(1); }
  rutaMano = join(raiz, 'src/logica/.arma_mano_mutada.js'); writeFileSync(rutaMano, m); copias.push(rutaMano);
  const s = readFileSync(rutaServidor, 'utf8'), ms = s.replace("from '../src/logica/arma_mano.js'", "from '../src/logica/.arma_mano_mutada.js'");
  rutaServidor = join(raiz, 'servidor/.servidor_mutado_arma.mjs'); writeFileSync(rutaServidor, ms); copias.push(rutaServidor);
}
const { armaDeMano, loQueSeLanza } = await import(pathToFileURL(rutaMano).href);
const { crearServidor } = await import(pathToFileURL(rutaServidor).href);

const pisable = (x, z) => x <= 400;
const habitat = (x, z) => x <= 400 && z < 400;

try {
  console.log('Lógica:');
  const L = (mano) => ({ 'mano:der': mano.der || null, 'mano:izq': mano.izq || null });
  comprobar('con las manos vacías, puños', armaDeMano(L({})).arma === 'punos');
  comprobar('con algo que no es un arma (un cordel), puños', armaDeMano(L({ der: { tipo: 'cordel', n: 1 } })).arma === 'punos');
  comprobar('con el hacha de piedra, hacha', armaDeMano(L({ der: { tipo: 'hacha_piedra', n: 1 } })).arma === 'hacha');
  comprobar('con la lanza en la izquierda y un cordel en la derecha, la lanza', armaDeMano(L({ der: { tipo: 'cordel', n: 1 }, izq: { tipo: 'lanza_endurecida', n: 1 } })).arma === 'lanza');
  comprobar('con piedras, piedras (y se lanzan gastándolas)', armaDeMano(L({ der: { tipo: 'piedra', n: 3 } })).arma === 'piedras' && loQueSeLanza(L({ der: { tipo: 'piedra', n: 3 } })).gasta);
  comprobar('la lanza se lanza sin gastarse; el hacha no se lanza', loQueSeLanza(L({ der: { tipo: 'lanza_endurecida', n: 1 } })).gasta === false && !loQueSeLanza(L({ der: { tipo: 'hacha_piedra', n: 1 } })));
  const lz = new Luchador({ arma: 'lanza' });
  comprobar('la lanza clava (su estocada llega más lejos que su tajo)', lz.cargar('estocada') && ARMAS.lanza.alcanceEstocada > ARMAS.lanza.alcance);
  const lz2 = new Luchador({ arma: 'lanza' });
  comprobar('y se lanza (coger impulso)', lz2.empezarTensar());
  // lanzada a 12 m: poca fuerza y desvío
  const laterales = [], vels = [];
  let dan = 0;
  for (let s = 1; s <= 60; s++) {
    const A = new Luchador({ arma: 'lanza', x: 0, z: 0 });
    const p = crearProyectil(A, { x: 0, y: 0, z: 12 }, { tension: 1, tTenso: 0 }, azar(s));
    vels.push(Math.hypot(p.vx, p.vy, p.vz));
    let r = null; while (!r) r = moverProyectil(p, 0.01, [A], azar(s), [], null, { presas: [{ id: 'liebre', x: 0, z: 12 }] });
    if (r.tipo === 'presa') dan++;
    laterales.push(p.x);
  }
  const izq = laterales.filter(x => x < -0.3).length, der = laterales.filter(x => x > 0.3).length;
  comprobar('lanzada, sale con poca fuerza (no más de 13 m/s)', Math.max(...vels) <= 13.01, `${Math.max(...vels).toFixed(1)} m/s`);
  comprobar('y con desvío: unas a un lado y otras al otro', izq >= 5 && der >= 5, `${izq} a la izquierda, ${der} a la derecha de 60`);
  comprobar('apuntando a una liebre a 12 m, unas le dan y otras no', dan >= 6 && dan <= 54, `${dan} de 60`);

  console.log('Servidor:');
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-arma-'));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), latido: 400, limiteMovimiento: false, arconPruebas: true, fauna: { habitat, pisable }, ticoFauna: 100, semilla: 3 });
  const puerto = await s.listo;
  const cliente = () => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, liebres: new Map(), id: 0, esperas: [], fotos: new Map(), suelo: [], eventos: [] };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estar = (x, z) => { c.pos = { x, z }; c.mandar({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }); };
    c.objeto = (accion) => new Promise(r => { const id = ++c.id; c.esperas.push({ id, r }); c.mandar({ tipo: 'objeto', id, accion }); });
    c.combate = (m) => c.mandar({ tipo: 'combate', ...m });
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') { c.autor = m.autor; listo(c); }
      if (m.tipo === 'fauna') { for (const f of m.liebres) c.liebres.set(f.id, f); for (const id of m.fuera) c.liebres.delete(id); }
      if (m.tipo === 'luchadores') for (const f of m.lista) c.fotos.set(f.autor, f);
      if (m.tipo === 'combate') c.eventos.push(...m.eventos);
      if (m.tipo === 'combate_rechazo' && process.env.VER) console.log('    (rechazo', m.que, m.motivo, ')');
      if (m.tipo === 'suelo') c.suelo = m.objetos;
      if (m.tipo === 'inventario') c.inv = m.inventario;
      if (m.tipo === 'resultado_objeto') c.esperas = c.esperas.filter(e => { if (e.id === m.id) { e.r(m); return false; } return true; });
    });
    ws.on('error', fallo);
  });
  const A = await cliente(), B = await cliente();
  A.estar(150, 150); B.estar(152, 150);
  await pausa(600);
  const LA = () => s.combate.luchadores[A.autor];
  comprobar('con las manos vacías, su arma son los puños', LA() && LA().arma === 'punos', LA() && LA().arma);
  let r = await A.objeto({ tipo: 'coger', objeto: 'lanza_endurecida', cantidad: 1, a: 'mano:der' });
  await pausa(300);
  comprobar('al coger la lanza, su arma es la lanza', r.ok && LA().arma === 'lanza' && LA().objeto === 'lanza_endurecida', `${LA().arma}`);
  comprobar('y el otro la ve en su mano', B.fotos.get(A.autor) && B.fotos.get(A.autor).arma === 'lanza' && B.fotos.get(A.autor).objeto === 'lanza_endurecida');
  A.combate({ que: 'arma', sacada: true });
  // una liebre de alrededor; A se pone a 11 m (quieto: se pone alerta y no se mueve)
  const id = [...A.liebres.keys()].find(k => { const l = s.fauna.de(k); return l && l.x > 30 && l.x < 380 && l.z > 30 && l.z < 380; });
  const lv = s.fauna.de(id);
  // (de golpe a 18 m, que no la asusta; luego andando despacio, a 2 m/s, hasta unos 10 m: se pone alerta y se queda quieta)
  B.estar(lv.x + 3, lv.z - 19); A.estar(lv.x, lv.z - 18);
  await pausa(1500);
  for (let k = 0; k < 40; k++) {
    const q = s.fauna.de(id), d = Math.hypot(q.x - A.pos.x, q.z - A.pos.z);
    if (d <= 10.5) break;
    A.estar(A.pos.x + (q.x - A.pos.x) / d * 0.2, A.pos.z + (q.z - A.pos.z) / d * 0.2); await pausa(100);
  }
  await pausa(500);
  { const q = s.fauna.de(id); comprobar('(se acerca andando a una liebre hasta unos 10 m: alerta, quieta)', q && q.estado === 'alerta' && Math.hypot(q.x - A.pos.x, q.z - A.pos.z) < 12, q && `${q.estado} a ${Math.hypot(q.x - A.pos.x, q.z - A.pos.z).toFixed(1)} m`); }
  let muerta = null, lanzadas = 0, cayoLanza = false, salioDeLaMano = true, otroLaVe = false;
  for (let k = 0; k < 10 && !muerta; k++) {
    if (k > 0) { await A.objeto({ tipo: 'coger', objeto: 'lanza_endurecida', cantidad: 1, a: 'mano:der' }); await pausa(200); }
    const l = s.fauna.de(id); if (!l) break;
    const nEv = B.eventos.length, nSuelo = s.objetos.suelo.objetos.filter(o => o.cosa.tipo === 'lanza_endurecida').length;
    A.combate({ que: 'tensar' }); await pausa(950);
    if (process.env.VER) console.log('    (antes de soltar:', LA().accion, LA().tension, LA().arma, ')');
    A.combate({ que: 'soltar', x: l.x, y: 0, z: l.z }); lanzadas++;
    await pausa(300);
    if (s.objetos.invs.de(A.autor).lugares['mano:der'] || LA().arma !== 'punos') salioDeLaMano = false;
    await pausa(1500);
    if (B.eventos.slice(nEv).some(e => e.tipo === 'disparo' && e.autor === A.autor && e.objeto === 'lanza_endurecida')) otroLaVe = true;
    if (s.objetos.suelo.objetos.filter(o => o.cosa.tipo === 'lanza_endurecida').length === nSuelo + 1) cayoLanza = true;
    if (process.env.VER) { const f = B.eventos.slice(nEv).find(e => e.tipo === 'flecha'); const q = s.fauna.de(id); console.log('    (cae en', f && [f.x.toFixed(1), f.z.toFixed(1), f.resultado], 'liebre', q && [q.x.toFixed(1), q.z.toFixed(1), q.estado], 'tirador', LA().x.toFixed(1), LA().z.toFixed(1), ')'); }
    if (!s.fauna.de(id)) muerta = s.objetos.suelo.objetos.find(o => o.cosa.tipo === 'liebre');
  }
  comprobar('al lanzarla sale de su mano (vuelve a los puños)', salioDeLaMano);
  comprobar('el otro la ve salir volando', otroLaVe);
  comprobar('y cae al suelo', cayoLanza);
  comprobar('alguna de las que lanza mata la liebre: queda muerta en el suelo y sale de las vivas', !!muerta && !s.fauna.de(id) && !A.liebres.has(id), `${lanzadas} lanzadas`);
  // va a por una lanza del suelo y la recoge
  const lanza = s.objetos.suelo.objetos.find(o => o.cosa.tipo === 'lanza_endurecida');
  A.estar(lanza.x, lanza.z); await pausa(300);
  r = await A.objeto({ tipo: 'coger_suelo', objeto: lanza.id, x: lanza.x, z: lanza.z, a: 'mano:der' });
  await pausa(200);
  comprobar('recoge la lanza del suelo y vuelve a ser su arma', r.ok && LA().arma === 'lanza', r.motivo);
  await A.objeto({ tipo: 'soltar', de: 'mano:der' });   // (al arcón de pruebas)
  // la piedra: se lanza y se gasta
  r = await A.objeto({ tipo: 'coger', objeto: 'piedra', cantidad: 2, a: 'mano:der' });
  await pausa(300);
  comprobar('con dos piedras en la mano, su arma son las piedras', r.ok && LA().arma === 'piedras', LA().arma);
  const piedrasSuelo = () => s.objetos.suelo.objetos.filter(o => o.cosa.tipo === 'piedra').length;
  const ps0 = piedrasSuelo();
  A.combate({ que: 'tensar' }); await pausa(700);
  A.combate({ que: 'soltar', x: A.pos.x, y: 0, z: A.pos.z + 10 }); await pausa(2000);
  const queda = s.objetos.invs.de(A.autor).lugares['mano:der'];
  comprobar('lanza una y le queda una (se gasta: no queda en el suelo)', queda && queda.tipo === 'piedra' && queda.n === 1 && piedrasSuelo() === ps0, JSON.stringify(queda));
  A.combate({ que: 'tensar' }); await pausa(700);
  A.combate({ que: 'soltar', x: A.pos.x, y: 0, z: A.pos.z + 10 }); await pausa(1500);
  comprobar('sin piedras, vuelve a los puños', !s.objetos.invs.de(A.autor).lugares['mano:der'] && LA().arma === 'punos', LA().arma);
  A.ws.close(); B.ws.close();
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
} finally {
  for (const c of copias) rmSync(c, { force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
