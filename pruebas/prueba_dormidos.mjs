// Prueba de desconectarse (GDD, apartado 6; src/logica/dormidos.js y servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_dormidos.mjs
// Comprueba, en la lógica pura y con el servidor de verdad (clientes por websocket, con los tiempos acortados):
//   - cuánto se queda atacable: en tu tierra nada; fuera, 5 min, o 15 si peleaste en el último minuto;
//   - al irse, los demás no reciben «sale»: lo siguen viendo, tumbado y desconectado, donde estaba;
//   - fuera de su tierra, su luchador sigue en el combate (atacable) hasta que pasa su tiempo; luego se aparta y, con
//     cama ligada, pasa a ella; en su tierra, protegido enseguida y a su cama;
//   - al volver con su ficha se despierta donde duerme, con su luchador como estaba;
//   - un navegador no se puede hacer pasar por desconectado.
// Con MUTAR=1 se prueba un servidor que no deja a nadie dormido (se va como antes): debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { Dormidos, tiempoVulnerable, VULNERABLE, VULNERABLE_PELEA, PELEA_RECIENTE, DESCONECTADO } from '../src/logica/dormidos.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

console.log('Lo que dice el GDD (apartado 6)');
{
  const ahora = 1e9;
  comprobar('fuera de tu tierra, 5 minutos atacable', VULNERABLE === 5 * 60000 && tiempoVulnerable({ enTierra: false, ahora }) === VULNERABLE);
  comprobar('si peleaste en el último minuto, 15', VULNERABLE_PELEA === 15 * 60000 && PELEA_RECIENTE === 60000 && tiempoVulnerable({ enTierra: false, ultimaPelea: ahora - 30000, ahora }) === VULNERABLE_PELEA);
  comprobar('si la pelea fue hace más de un minuto, 5', tiempoVulnerable({ enTierra: false, ultimaPelea: ahora - 61000, ahora }) === VULNERABLE);
  comprobar('en tu tierra (o en la de quien te invita), protegido: nada', tiempoVulnerable({ enTierra: true, ultimaPelea: ahora, ahora }) === 0);
  const D = new Dormidos();
  const d = D.dormir('ana', { x: 10, y: 1, z: 20, giro: 1 }, { ahora, cama: { x: 3, y: 0, z: 4 } });
  comprobar('fuera, se queda donde estaba y atacable', d.x === 10 && d.z === 20 && D.atacable('ana', ahora + 1000) && !d.enCama);
  comprobar('antes de su hora, sigue atacable y no se mueve', D.revisar(ahora + VULNERABLE - 1).length === 0 && D.atacable('ana', ahora + VULNERABLE - 1));
  const fin = D.revisar(ahora + VULNERABLE);
  comprobar('pasado su tiempo, ya no es atacable y, con cama, pasa a ella', fin.length === 1 && fin[0].cama && !D.atacable('ana', ahora + VULNERABLE) && d.x === 3 && d.z === 4 && d.enCama);
  comprobar('solo una vez', D.revisar(ahora + 2 * VULNERABLE).length === 0);
  const e = D.dormir('eva', { x: 1, y: 0, z: 1 }, { ahora, enTierra: true, cama: { x: 2, y: 0, z: 2 } });
  comprobar('en su tierra, protegido enseguida y en su cama', !D.atacable('eva', ahora) && e.enCama && e.x === 2);
  const s = D.dormir('sin', { x: 7, y: 0, z: 7 }, { ahora });
  D.revisar(ahora + VULNERABLE);
  comprobar('sin cama, se queda donde estaba, ya protegido', s.x === 7 && !D.atacable('sin', ahora + VULNERABLE));
  comprobar('al despertar, deja de estar dormido', D.despertar('sin') && !D.esta('sin') && D.despertar('sin') === null);
}

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace("if (p && !cuentas.sinConfirmar(autor) && (!terreno || posiciones.has(autor))) {", 'if (false) {');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_dormidos.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 4000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond);
      if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.cerrado = new Promise(r => ws.on('close', r));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estar = (x, z, anim = 'quieto') => c.mandar({ tipo: 'estado', x, y: 0, z, giro: 0.5, anim });
    c.accion = (accion) => { const id = ++c.id; c.mandar({ tipo: 'accion', id, accion }); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    // lo último que le ha llegado de la presencia de otro
    c.de = (autor) => { for (let i = c.recibidos.length - 1; i >= 0; i--) { const m = c.recibidos[i]; if (m.tipo === 'estados') { const e = m.jugadores.find(j => j.autor === autor); if (e) return e; } } return null; };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    ws.on('open', async () => { try { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); } catch (e) { fallo(e); } });
    ws.on('error', fallo);
  });
}

const dir = mkdtempSync(join(tmpdir(), 'kinhold-dormidos-'));
let s = null;
try {
  console.log('Con el servidor de verdad (tiempos acortados: 1,5 s atacable, 4 s si peleó)');
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), latido: 200, limiteMovimiento: false, tiemposDormido: { vulnerable: 1500, pelea: 4000, reciente: 60000 } });
  const puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);
  const yoA = A.bienvenida.autor;
  for (let i = 0; i < 4; i++) { A.estar(60, 40); B.estar(62, 40); await pausa(100); }
  s.combate.luchadores[yoA].recibirHerida('brazoI', 0.1, 'corte');
  A.ws.close(); await A.cerrado;
  const e = await B.esperar(m => m.tipo === 'estados' && m.jugadores.some(j => j.autor === yoA && j.anim === DESCONECTADO)).then(m => m.jugadores.find(j => j.autor === yoA)).catch(() => null);
  comprobar('al irse, los demás lo ven tumbado y desconectado donde estaba', !!e && Math.abs(e.x - 60) < 0.01 && Math.abs(e.z - 40) < 0.01, JSON.stringify(e));
  await pausa(300);
  comprobar('y no reciben «sale»: sigue en el mundo', !B.recibidos.some(m => m.tipo === 'sale' && m.autor === yoA) && s.dormidos.esta(yoA));
  comprobar('fuera de su tierra, su luchador sigue en el combate (atacable), con el arma guardada', !!s.combate.luchadores[yoA] && !s.combate.luchadores[yoA].sacada && s.dormidos.atacable(yoA, Date.now()));
  const C = await cliente(puerto);
  comprobar('quien llega después también lo ve dormido', (C.bienvenida.presentes || []).some(j => j.autor === yoA && j.anim === DESCONECTADO));
  await pausa(1600);
  comprobar('pasado su tiempo, se aparta del combate: ya no se le puede hacer nada', !s.combate.luchadores[yoA] && s.apartados.has(yoA) && !s.dormidos.atacable(yoA, Date.now()));
  comprobar('y sigue a la vista, dormido', s.presencia.ultimo.get(yoA) && s.presencia.ultimo.get(yoA).anim === DESCONECTADO);

  const A2 = await cliente(puerto, A.bienvenida.ficha);
  comprobar('al volver con su ficha se despierta donde dormía', A2.bienvenida.autor === yoA && !s.dormidos.esta(yoA) && A2.bienvenida.posicion && Math.abs(A2.bienvenida.posicion.x - 60) < 0.01, JSON.stringify(A2.bienvenida.posicion));
  comprobar('con su luchador como estaba (la herida)', !!s.combate.luchadores[yoA] && s.combate.luchadores[yoA].heridas.length === 1);
  for (let i = 0; i < 3; i++) { A2.estar(60, 40, DESCONECTADO); await pausa(100); }
  comprobar('un navegador no se hace pasar por desconectado (queda «dormir»)', s.presencia.ultimo.get(yoA).anim === 'dormir', s.presencia.ultimo.get(yoA).anim);

  console.log('Si peleó en el último minuto, más tiempo atacable; y con cama ligada, a ella');
  s.objetos.fab.estaciones['cama_prueba'] = { id: 'cama_prueba', tipo: 'cama_juncos', x: 70, z: 45, ligadas: [yoA], cola: [], deposito: {} };
  s.ultimaPelea.set(yoA, Date.now());
  A2.ws.close(); await A2.cerrado; await pausa(100);
  const d = s.dormidos.de(yoA);
  comprobar('peleó hace nada: atacable el tiempo largo', d && d.hasta - d.desde === 4000 && !!s.combate.luchadores[yoA], d && `${d.hasta - d.desde} ms`);
  comprobar('mientras es atacable, sigue donde cayó (no en la cama)', d && d.x === 60 && !d.enCama);
  await pausa(4300);
  const enCama = await B.esperar(m => m.tipo === 'estados' && m.jugadores.some(j => j.autor === yoA && Math.abs(j.x - 70) < 0.01), 2000).then(m => m.jugadores.find(j => j.autor === yoA)).catch(() => null);
  comprobar('pasado su tiempo, pasa dormido a su cama (los demás lo ven allí)', !!enCama && enCama.anim === DESCONECTADO && Math.abs(enCama.z - 45) < 0.01, JSON.stringify(enCama));
  comprobar('y es donde aparecerá al volver', s.posiciones.get(yoA) && s.posiciones.get(yoA).x === 70);

  console.log('En su tierra, protegido enseguida');
  const T = await cliente(puerto), yoT = T.bienvenida.autor;
  for (let i = 0; i < 3; i++) { T.estar(-200, -200); await pausa(100); }
  await T.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  const rm = await T.accion({ tipo: 'mojon', x: -200, z: -200 });
  comprobar('pone su mojón', rm.ok, rm.motivo || '');
  T.ws.close(); await T.cerrado; await pausa(100);
  comprobar('al irse en su tierra, dormido y protegido (fuera del combate) desde el primer momento', s.dormidos.esta(yoT) && !s.dormidos.atacable(yoT, Date.now()) && !s.combate.luchadores[yoT] && s.apartados.has(yoT));
  B.ws.close(); C.ws.close();
} catch (e) {
  mal++; console.log('  FALLA ' + (e && e.stack || e));
} finally {
  if (s) await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
