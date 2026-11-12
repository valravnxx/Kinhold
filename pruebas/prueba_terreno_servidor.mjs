// Prueba de «El servidor conoce el mundo» (hito «El juego en el mundo de verdad»): el servidor genera Whitholm con la
// misma semilla que el navegador (src/logica/terreno_servidor.js) y con él:
//  - los árboles y los puntos de recogida son los suyos: los mismos (nombre, sitio, edad, clase) que pone el navegador
//    (sacados aquí por otro camino: un cuadro grande con vegetacionEn y recogidaEn, pasado a la escena como el
//    navegador), y uno que no está en el mundo no vale aunque su nombre cuadre con su sitio;
//  - la posición de cada jugador, dentro de la isla y cerca del suelo;
//  - las obras contra el terreno: el mojón en tierra firme, la planta baja a ras del suelo (también del nivelado), la
//    brocha y la decoración a una altura que tenga sentido;
//  - en el servidor de verdad (por websocket): talar un árbol que no existe se rechaza, talar uno de verdad usa la edad
//    del servidor y no la que dice el navegador, un estado fuera de la isla se rechaza, el mojón en el mar también; y
//    lo que se guarda (objetos.json) es solo lo cambiado, y lo guardado que no está en el mundo se descarta.
// Con MUTAR=1 el terreno se fía de todo: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { terrenoWhitholm, ALTURAS } from '../src/logica/terreno_servidor.js';
import { vegetacionEn, TAM_ADULTO, CLARO_ARBOLES } from '../src/logica/vegetacion.js';
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { idArbol } from '../src/logica/tala.js';
import { SALIDA, SALIDAS, ISLA } from '../src/logica/whitholm.js';
import { crearServidor } from '../servidor/servidor.mjs';
import { desagrupar, trozoDe } from '../src/logica/trozos_red.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const r2 = v => Math.round(v * 100) / 100;

const t0 = Date.now();
const T = terrenoWhitholm();
console.log(`Whitholm generado en ${Date.now() - t0} ms`);
if (MUTAR) {   // un terreno que se fía de todo
  Object.assign(T, { arbol: (id, x, z) => ({ id, x, z, edad: 'joven' }), punto: (id, x, z) => ({ id, tipo: id.split(':')[0], x, z }), posicion: () => null, obra: () => null });
}
const O = T.origen;

console.log('Los árboles y los puntos del servidor son los del navegador');
// cuadros alrededor de la salida común y de tres salidas al azar (en la escena: desde SALIDA)
const sitios = [[0, 0], ...[0, 5, 9].map(k => [SALIDAS[k][0] - SALIDA.x, SALIDAS[k][1] - SALIDA.z])];
let arboles = 0, arbolesMal = [], adultos = 0, puntos = 0, puntosMal = [];
for (const [sx, sz] of sitios) {
  const c = { x0: O.x + sx - 50, z0: O.z + sz - 50, x1: O.x + sx + 50, z1: O.z + sz + 50 };
  const v = vegetacionEn(T.paisaje, T.alt, T.semilla, c);
  for (const e of v.arboles) {
    if (e.x >= c.x1 || e.z >= c.z1) continue;   // (los trozos no tienen el borde de la derecha ni el de abajo)
    const x = e.x - O.x, z = e.z - O.z;
    if (Math.hypot(x, z - 2) < CLARO_ARBOLES) continue;
    const id = idArbol(x, z), edad = e.edad, t = T.arbol(id, x, z);
    arboles++; if (edad === 'adulto') adultos++;
    if (!t || t.edad !== edad || t.x !== r2(x) || t.z !== r2(z)) arbolesMal.push(id);
  }
  for (const p of recogidaEn(T.paisaje, T.alt, T.semilla, c)) {
    const t = T.punto(p.id, r2(p.x - O.x), r2(p.z - O.z));
    puntos++;
    if (!t || t.tipo !== p.tipo || t.x !== r2(p.x - O.x) || t.z !== r2(p.z - O.z)) puntosMal.push(p.id);
  }
}
comprobar('cada árbol de cuatro cuadros de 100 m está en el servidor, con su sitio y su edad', arboles > 50 && adultos > 0 && adultos < arboles && arbolesMal.length === 0, `${arboles} árboles (${adultos} adultos), mal: ${arbolesMal.slice(0, 3).join(' ')}`);
comprobar('y cada punto de recogida, con su sitio y su clase', puntos > 20 && puntosMal.length === 0, `${puntos} puntos, mal: ${puntosMal.slice(0, 3).join(' ')}`);
// un árbol cuyo nombre cuadra con su sitio pero que no está en el mundo (en el centro de un claro de la salida)
const falso = idArbol(1, 1);
comprobar('un árbol que no está en el mundo no vale, aunque su nombre cuadre con su sitio', T.arbol(falso, 1, 1) === null);
comprobar('ni un punto inventado', T.punto('silex:10,10', 1, 1) === null);
comprobar('ni uno de verdad dicho desde muy lejos (otro trozo)', arboles > 0 && (() => {
  const c = { x0: O.x + 40, z0: O.z + 40, x1: O.x + 90, z1: O.z + 90 }, e = vegetacionEn(T.paisaje, T.alt, T.semilla, c).arboles.find(e => e.x < c.x1 && e.z < c.z1);
  return e && T.arbol(idArbol(e.x - O.x, e.z - O.z), e.x - O.x + 300, e.z - O.z) === null;
})());

console.log('Dónde puede estar un jugador');
const s0 = T.suelo(0, 4);
comprobar('en la salida, a ras del suelo, sí', T.posicion({ x: 0, y: s0, z: 4 }) === null, `suelo ${s0.toFixed(2)}`);
comprobar('fuera de la isla, no', T.posicion({ x: ISLA.x1 - O.x + 500, y: 0, z: 0 }) !== null);
comprobar(`a más de ${ALTURAS.sobreSuelo} m sobre el suelo, no`, T.posicion({ x: 0, y: s0 + ALTURAS.sobreSuelo + 5, z: 4 }) !== null);
comprobar(`a más de ${ALTURAS.bajoSuelo} m bajo el suelo, no`, T.posicion({ x: 0, y: s0 - ALTURAS.bajoSuelo - 5, z: 4 }) !== null);
comprobar('en lo alto de una casa (10 m), sí', T.posicion({ x: 0, y: s0 + 10, z: 4 }) === null);

console.log('Las obras contra el terreno');
// un punto de mar: buscando hacia fuera desde la salida, en línea recta hacia el este, el primero bajo el nivel del mar
let mar = null; for (let d = 100; d < 40000 && !mar; d += 100) if (T.suelo(d, 0) + T.y0 < -1) mar = d;
comprobar('el mojón en tierra firme, sí', T.obra({ tipo: 'mojon', x: 0, z: 4 }) === null);
comprobar('en el mar, no', mar !== null && T.obra({ tipo: 'mojon', x: mar, z: 0 }) !== null, `mar a ${mar} m`);
comprobar('la planta baja a ras del suelo, sí', T.obra({ tipo: 'colocar', x: 0, z: 4, y: s0 + 0.3 }) === null);
comprobar('a 3 m del suelo, no', T.obra({ tipo: 'colocar', x: 0, z: 4, y: s0 + 3 }) !== null);
const marca = [{ x: 0, z: 4, y: s0 + 3, r: 2, borde: 1.5 }];
comprobar('pero sí donde un cimiento o la brocha ha subido el suelo 3 m', T.obra({ tipo: 'colocar', x: 0, z: 4, y: s0 + 3 }, marca) === null && T.suelo(0, 4, marca) > s0 + 2.9);
comprobar('la brocha a 5 m del suelo, sí (arrastrada ladera arriba)', T.obra({ tipo: 'nivelar', x: 0, z: 4, y: s0 - 5, radio: 2 }) === null);
comprobar('a 50 m, no', T.obra({ tipo: 'nivelar', x: 0, z: 4, y: s0 + 50, radio: 2 }) !== null);
comprobar('la decoración en una planta alta, sí; a 200 m o bajo tierra, no', T.obra({ tipo: 'decorar', x: 0, z: 4, y: s0 + 6 }) === null
  && T.obra({ tipo: 'decorar', x: 0, z: 4, y: s0 + 200 }) !== null && T.obra({ tipo: 'decorar', x: 0, z: 4, y: s0 - 3 }) !== null);
// tu tierra es la zona entera de tu mojón (4 nov): de qué zona es cada sitio de la escena
// (las zonas de la costa llevan algo de mar; el mojón en el agua lo rechaza el terreno, como arriba)
const altaMar = ISLA.x1 - O.x + 8000;
comprobar('cada sitio de tierra es de una zona; la alta mar, de ninguna', T.zona(0, 4) !== null && T.zona(altaMar, 0) === null && T.zona(0, 4) === T.zona(1, 5), `${T.zona(0, 4)} · ${T.zona(altaMar, 0)}`);
comprobar('ninguna fuera de la isla', T.obra({ tipo: 'colocar', x: ISLA.x0 - O.x - 100, z: 0, y: 0 }) !== null);

console.log('En el servidor');
const dir = mkdtempSync(join(tmpdir(), 'kinhold-terreno-'));
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => { const t = setTimeout(() => f(new Error('tiempo agotado')), ms); c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } }); });
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    c.accion = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado' && m.id === id); ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return p; };
    c.estar = (x, y, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y, z, giro: 0, anim: 'quieto' }));
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.recibidos.push(m); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    const b = c.esperar(m => m.tipo === 'bienvenida');
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
let s = null;
try {
  // un árbol adulto de verdad cerca de la salida, y un sitio a su lado para talarlo
  const c = { x0: O.x - 60, z0: O.z - 60, x1: O.x + 60, z1: O.z + 60 };
  const e = vegetacionEn(T.paisaje, T.alt, T.semilla, c).arboles
    .map(e => ({ ...e, x: e.x - O.x, z: e.z - O.z })).filter(e => Math.hypot(e.x, e.z - 2) >= CLARO_ARBOLES && e.edad === 'adulto' && e.x < 59 && e.z < 59)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  const id = idArbol(e.x, e.z), px = e.x + 1, pz = e.z;
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T });
  const puerto = await s.listo;
  const a = await cliente(puerto);
  a.estar(px, T.suelo(px, pz), pz); await pausa(200);
  comprobar('el servidor tiene al jugador donde dice (a ras del suelo)', !!s.presencia.ultimo.get(a.bienvenida.autor));
  let r = await a.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  comprobar('coge un hacha del arcón de pruebas', r.ok, r.motivo);
  const falsoCerca = idArbol(px + 0.5, pz);
  r = await a.objeto({ tipo: 'talar', arbol: falsoCerca, x: px, z: pz, ax: px + 0.5, az: pz, edad: 'joven' });
  comprobar('talar un árbol que no está en el mundo (aunque su nombre cuadre) se rechaza', !r.ok, r.motivo);
  r = await a.objeto({ tipo: 'talar', arbol: id, x: px, z: pz, ax: e.x, az: e.z, edad: 'joven' });
  comprobar('uno de verdad sí, y con la edad del servidor (adulto), no la que dice el navegador (joven)', r.ok && s.objetos.tala.porId.get(id)?.edad === 'adulto', `${r.motivo || ''} ${s.objetos.tala.porId.get(id)?.edad}`);
  const cerca_ = T.arbolesCerca(e.x, e.z, 12);
  comprobar('los árboles de alrededor (con los que puede dar al caer) los saca del terreno, con su alto', cerca_.some(b => b.id === id) && cerca_.every(b => Math.hypot(b.x - e.x, b.z - e.z) <= 12 && b.alto > 2), `${cerca_.length} árboles`);
  const err = a.esperar(m => m.tipo === 'error');
  a.estar(px + 2, T.suelo(px + 2, pz) + 200, pz);   // volando, 200 m sobre el suelo
  const m = await err.catch(() => null);
  await pausa(150);
  const yo = s.presencia.ultimo.get(a.bienvenida.autor);
  comprobar('un estado a 200 m sobre el suelo se rechaza y el servidor le sigue teniendo donde estaba', !!m && Math.abs(yo.x - px) < 0.01 && yo.y < 50, m && m.motivo);
  await a.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });   // el mojón se paga de lo que llevas
  r = await a.accion({ tipo: 'mojon', x: mar, z: 0 });
  comprobar('el mojón en el mar se rechaza', !r.ok, r.motivo);
  r = await a.accion({ tipo: 'mojon', x: px, z: pz });
  comprobar('junto a la salida, no: es zona del rey (src/logica/zonas_rey.js)', !r.ok && /zona del rey/.test(r.motivo || ''), r.motivo);
  // y en tierra firme de la zona de al lado (al oeste, a 70 m de su linde), sí: desde aquí, el mojón de A
  let mx = px, mz = pz;
  for (let d = 20; d < 3000; d += 10) { const id = T.zona(-d, pz); if (id !== null && id !== T.zona(px, pz) && !T.esZonaRey(id)) { mx = -d - 70; break; } }
  r = await a.accion({ tipo: 'mojon', x: mx, z: mz });
  comprobar('y en tierra firme de la zona de al lado se pone', r.ok && mx !== px, `${r.motivo || ''} en x = ${Math.round(mx)}`);
  // un sitio de tierra firme lejos del mojón en su zona, y otro en la zona de al lado (buscando en anillos)
  const firme = (x, z) => T.suelo(x, z) + T.y0 > ALTURAS.orilla + 0.5;
  let lejosMio = null, vecino = null;
  for (let d = 150; d < 2500 && !(lejosMio && vecino); d += 50) for (let k = 0; k < 24; k++) {
    const x = mx + Math.cos(k / 24 * 2 * Math.PI) * d, z = mz + Math.sin(k / 24 * 2 * Math.PI) * d;
    if (!firme(x, z)) continue;
    if (!lejosMio && d >= 300 && T.zona(x, z) === T.zona(mx, mz)) lejosMio = { x: Math.round(x), z: Math.round(z) };
    if (!vecino && T.zona(x, z) !== null && T.zona(x, z) !== T.zona(mx, mz) && !T.esZonaRey(T.zona(x, z))) vecino = { x: Math.round(x), z: Math.round(z) };
  }
  comprobar('hay un sitio de su zona a 300 m o más del mojón, y otra zona al lado (no del rey)', !!lejosMio && !!vecino, JSON.stringify({ lejosMio, vecino }));
  const b = await cliente(puerto);
  await b.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });   // el mojón se paga de lo que llevas
  r = await b.accion({ tipo: 'mojon', x: mx + 4, z: mz });
  comprobar('otro jugador no puede poner su mojón en la zona de A', !r.ok && r.motivo === 'Esta zona ya es tierra de otro.', r.motivo);
  r = await a.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: lejosMio.x, z: lejosMio.z, k: 0, rot: 0, dir: 0, y: T.suelo(lejosMio.x, lejosMio.z) });
  comprobar('A construye en su zona lejos del mojón', r.ok, r.motivo);
  r = await a.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: vecino.x, z: vecino.z, k: 0, rot: 0, dir: 0, y: T.suelo(vecino.x, vecino.z) });
  comprobar('pero no en la zona de al lado', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
  r = await b.accion({ tipo: 'mojon', x: vecino.x, z: vecino.z });
  comprobar('y el otro jugador pone el suyo en la de al lado', r.ok, r.motivo);
  b.ws.close();
  r = await a.accion({ tipo: 'colocar', pieza: 'suelo_tablas', x: mx + 3, z: mz + 3, k: 0, rot: 0, dir: 0, y: T.suelo(mx + 3, mz + 3) + 4 });
  comprobar('una planta baja que empieza a 4 m del suelo se rechaza', !r.ok, r.motivo);
  // (lo guardado va por trozos, src/logica/trozos_red.js)
  const exp = s.objetos.exportar(), expA = desagrupar(exp.tala.trozos).cosas, expP = desagrupar(exp.recoleccion.trozos).cosas;
  comprobar('lo que se guarda es solo lo cambiado: el árbol a medias, ni el falso ni ninguno más', expA.length === 1 && expA[0].id === id && expP.length === 0, `${expA.length} árboles, ${expP.length} puntos`);
  a.ws.close(); await s.cerrar(); s = null;
  // lo guardado con un árbol que no está en el mundo (de cuando el servidor se fiaba del navegador): se descarta
  const guardado = JSON.parse(readFileSync(join(dir, 'objetos.json'), 'utf8'));
  const kf = trozoDe(r2(px + 0.5), r2(pz)), tf = guardado.tala.trozos[kf] || (guardado.tala.trozos[kf] = { cosas: [], estado: {} });
  tf.cosas.push({ id: falsoCerca, x: r2(px + 0.5), z: r2(pz), edad: 'adulto' });
  tf.estado[falsoCerca] = { golpes: 3, parte: 0.2, veces: 0 };
  writeFileSync(join(dir, 'objetos.json'), JSON.stringify(guardado));
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T });
  await s.listo;
  comprobar('al volver a arrancar, lo guardado que no está en el mundo se descarta y lo de verdad sigue', !s.objetos.tala.porId.has(falsoCerca) && s.objetos.tala.porId.get(id)?.edad === 'adulto' && s.objetos.tala.progreso(id) > 0);
} catch (e) {
  comprobar('el servidor contesta', false, e && e.message);
} finally {
  if (s) await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
