// Prueba de morir y que te saqueen (P4; GDD, apartado 6; src/logica/muerte.js y servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_muerte.mjs
// Comprueba, en la lógica pura y con el servidor de verdad (clientes por websocket, con los tiempos acortados):
//   - con la sed al máximo se pierde la sangre en unos 20 minutos, con el hambre en unos 40, y nada sin ellas;
//   - la mitad de lo que llevas queda (por unidades: cada piedra cuenta) y la otra mitad se rompe, al azar, sin que se
//     cree ni se pierda nada más; el inventario queda vacío;
//   - en el servidor: sin beber se muere de sed (la sangre baja sola); el cuerpo queda donde cayó, tumbado y con su
//     aspecto, a la vista de los demás; la mitad de lo que llevaba, al suelo alrededor, que otro puede coger; vuelve
//     sano a su cama ligada (o, sin ella, a su salida) con la sed a 60; el cuerpo se va pasada su hora;
//   - en el combate: quien cae, muere y vuelve (no se levanta curado donde cayó);
//   - ahogado: solo si el servidor le ve en el agua honda (un navegador no se mata para volver a casa).
// MUTAR=1: el servidor no deja nada en el cuerpo (lo rompe todo): tiene que FALLAR. MUTAR=2: la sed al máximo no quita
// sangre: tiene que FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { sangrePerdida, repartir, despojar, sitiosAlrededor, necesidadesAlVolver, reaparicion, Cuerpos, motivoNecesidades, MUERTE_SED, MUERTE_HAMBRE, DURA_CUERPO, MOTIVOS, MUERTO } from '../src/logica/muerte.js';
import { Inventario } from '../src/logica/inventario.js';
import { azar } from '../src/logica/azar.js';

const MUTAR = process.env.MUTAR || '';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const unidades = (l) => l.reduce((s, c) => s + (c.n || 1), 0);

console.log('La lógica (src/logica/muerte.js)');
{
  const n0 = { hambre: 0, sed: 0, frio: 0, cansancio: 0 };
  comprobar('sin sed ni hambre al máximo, no se pierde sangre', sangrePerdida(n0) === 0 && sangrePerdida({ ...n0, sed: 99.9, hambre: 99 }) === 0);
  comprobar('con la sed al máximo, la sangre entera en unos 20 minutos', MUERTE_SED === 1200 && Math.abs(100 / sangrePerdida({ ...n0, sed: 100 }) - 1200) < 1e-6);
  comprobar('con el hambre al máximo, en unos 40', MUERTE_HAMBRE === 2400 && Math.abs(100 / sangrePerdida({ ...n0, hambre: 100 }) - 2400) < 1e-6);
  comprobar('las dos a la vez, antes', 100 / sangrePerdida({ ...n0, hambre: 100, sed: 100 }) < 1200);
  comprobar('de qué se muere: de sed antes que de hambre', motivoNecesidades({ sed: 100, hambre: 100 }) === MOTIVOS.sed && motivoNecesidades({ sed: 50, hambre: 100 }) === MOTIVOS.hambre);
  comprobar('el cuerpo, una hora real', DURA_CUERPO === 3600 * 1000);

  const inv = Inventario.inicial();
  inv.lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };
  inv.lugares['cintura'] = { tipo: 'bolsa_cintura', n: 1, dentro: [{ tipo: 'piedra', n: 1 }, { tipo: 'bayas', n: 6 }] };
  const cosas = despojar(inv);
  comprobar('despojar: el inventario queda vacío', Object.values(inv.lugares).every(c => c === null) && inv.apartado.length === 0);
  comprobar('y saca cada cosa, también lo de dentro (el contenedor, vacío)', cosas.length === 6 && cosas.find(c => c.tipo === 'bolsa_cintura').dentro.every(x => x === null), JSON.stringify(cosas.map(c => [c.tipo, c.n])));
  const total = unidades(cosas);
  let bien = true, vistas = new Set();
  for (let s = 1; s <= 40; s++) {
    const r = repartir(cosas, MUTAR === '1' ? () => 0.99 : azar(s));
    const q = unidades(r.quedan), k = unidades(r.rotas);
    if (q + k !== total || Math.abs(q - k) > 1) bien = false;
    // por tipo: lo que queda y lo que se rompe suman lo que había
    for (const c of cosas) { const a = r.quedan.filter(x => x.tipo === c.tipo).reduce((s, x) => s + x.n, 0) + r.rotas.filter(x => x.tipo === c.tipo).reduce((s, x) => s + x.n, 0); if (a !== cosas.filter(x => x.tipo === c.tipo).reduce((s, x) => s + x.n, 0)) bien = false; }
    vistas.add(r.quedan.map(c => c.tipo + c.n).join(','));
  }
  comprobar('la mitad queda y la mitad se rompe, por unidades, sin crear ni perder nada', bien, `${total} unidades`);
  comprobar('y cuál, al azar (no siempre lo mismo)', vistas.size > 5, `${vistas.size} repartos distintos en 40`);
  const r1 = repartir([{ tipo: 'piedra', n: 1 }], () => 0.2), r2 = repartir([{ tipo: 'piedra', n: 1 }], () => 0.8);
  comprobar('si es impar, la del medio a suertes', unidades(r1.quedan) + unidades(r2.quedan) === 1);
  const sit = sitiosAlrededor(10, 20, 12);
  comprobar('lo que queda, en corro alrededor del cuerpo (a menos de 2 m: se coge desde ahí)', sit.length === 12 && sit.every(p => Math.hypot(p.x - 10, p.z - 20) < 1.5 && Math.hypot(p.x - 10, p.z - 20) > 0.3));
  const nv = necesidadesAlVolver({ hambre: 100, sed: 100, frio: 30, cansancio: 90 });
  comprobar('al volver: sed y hambre a 60 como mucho, descansado', nv.sed === 60 && nv.hambre === 60 && nv.cansancio === 0 && nv.frio === 30 && necesidadesAlVolver({ hambre: 10, sed: 20, frio: 0, cansancio: 0 }).sed === 20);
  comprobar('vuelve a su cama si la tiene; si no, a su salida', reaparicion({ cama: { x: 1, y: 0, z: 2 }, salida: { x: 9, y: 0, z: 9 } }).enCama && reaparicion({ salida: { x: 9, y: 0, z: 9 } }).x === 9);
  const C = new Cuerpos(1000);
  const c = C.dejar('ana', { x: 1, y: 2, z: 3 }, 'De sed', 5000);
  comprobar('el cuerpo queda con su hora', c.hasta === 6000 && C.limpiar(5999).length === 0 && C.limpiar(6000).length === 1 && C.todos().length === 0);
}

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = MUTAR === '1' ? fuente.replace('const { quedan, rotas } = repartir(despojar(objetos.invs.de(autor)), Math.random);', 'const rotas = despojar(objetos.invs.de(autor)), quedan = [];')
    : fuente.replace('sangrePerdida(n, tiemposMuerte) : 0;', '0 : 0;');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_muerte.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 6000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond);
      if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.cerrado = new Promise(r => ws.on('close', r));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estar = (x, z, anim = 'quieto') => c.mandar({ tipo: 'estado', x, y: 0, z, giro: 0.5, anim });
    c.objeto = (accion) => { const id = ++c.id; c.mandar({ tipo: 'objeto', id, accion }); return c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); };
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

const dir = mkdtempSync(join(tmpdir(), 'kinhold-muerte-'));
let s = null;
try {
  console.log('Con el servidor de verdad (de sed en 1,5 s, el cuerpo 3 s)');
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), latido: 200, limiteMovimiento: false, ticoNecesidades: 100, tiemposMuerte: { sed: 1.5, hambre: 3 }, duraCuerpo: 3000 });
  const puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);
  const yoA = A.bienvenida.autor;
  for (let i = 0; i < 4; i++) { A.estar(60, 40); B.estar(61, 40); await pausa(100); }
  // lo que lleva: lo del principio, un hacha y 10 piedras (del arcón de pruebas)
  let r = await A.objeto({ tipo: 'coger', objeto: 'hacha_piedra', cantidad: 1, a: 'mano:der' });
  const r2 = await A.objeto({ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:izq' });
  comprobar('lleva lo suyo (hacha y piedra en las manos, camisa y pantalón)', r.ok && r2.ok, r.motivo || r2.motivo);
  const antes = unidades(despojar(Inventario.importarJugador(s.objetos.inventarioDe(yoA))));
  s.objetos.fab.estaciones['cama_a'] = { id: 'cama_a', tipo: 'cama_juncos', x: 70, z: 45, ligadas: [yoA], cola: [], deposito: {} };
  const sueloAntes = s.objetos.suelo.objetos.length;
  // la sed, al máximo
  s.necesidades.set(yoA, { hambre: 0, sed: 100, frio: 0, cansancio: 30 });
  await pausa(400);
  const L = s.combate.luchadores[yoA];
  comprobar('con la sed al máximo, la sangre baja sola', L && L.sangre < 100 && L.sangre > 0, L && L.sangre.toFixed(1));
  const m = await A.esperar(x => x.tipo === 'muerte', 4000).catch(() => null);
  comprobar('sin beber, se muere de sed (se lo dice el servidor)', !!m && m.motivo === MOTIVOS.sed, JSON.stringify(m && m.motivo));
  comprobar('y vuelve a su cama ligada', !!m && m.enCama && Math.abs(m.posicion.x - 70) < 0.01 && Math.abs(m.posicion.z - 45) < 0.01, JSON.stringify(m && m.posicion));
  const cu = m && s.cuerpos.todos().find(c => c.autor === yoA);
  comprobar('su cuerpo queda donde cayó', !!cu && Math.abs(cu.x - 60) < 0.01 && Math.abs(cu.z - 40) < 0.01);
  await pausa(300);
  const vista = cu && B.de(cu.id);
  comprobar('los demás lo ven tumbado (presencia «muerto») y con su aspecto', !!vista && vista.anim === MUERTO && B.recibidos.some(x => x.tipo === 'aspecto' && x.autor === cu.id), JSON.stringify(vista));
  const L2 = s.combate.luchadores[yoA];
  comprobar('vuelve sano (un luchador nuevo, con la sangre llena)', L2 && L2 !== L && L2.sangre === 100 && !L2.fuera);
  const n = s.necesidades.get(yoA);
  comprobar('con la sed a 60 y descansado', n.sed >= 60 && n.sed < 61 && n.cansancio < 1, JSON.stringify(n));
  const inv = s.objetos.inventarioDe(yoA);
  comprobar('no lleva nada (lo suyo está en el cuerpo o roto)', Object.values(inv.lugares).every(c => c === null));
  const caido = s.objetos.suelo.objetos.slice(sueloAntes);
  comprobar('la mitad de lo que llevaba, al suelo alrededor del cuerpo', unidades(caido.map(o => o.cosa)) === Math.floor(antes / 2) || unidades(caido.map(o => o.cosa)) === Math.ceil(antes / 2), `${unidades(caido.map(o => o.cosa))} de ${antes}`);
  comprobar('a menos de 2 m (se coge desde el cuerpo)', caido.length > 0 && caido.every(o => Math.hypot(o.x - 60, o.z - 40) < 1.6));
  const reg = readFileSync(s.archivoObjetosReg, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(e => e.tipo === 'morir');
  comprobar('queda en el registro, con su autor, lo que queda y lo que se rompe', !!reg && reg.autor === yoA && Array.isArray(reg.rotas) && Array.isArray(reg.quedan));
  // otro jugador lo saquea
  if (caido.length) {
    const o = caido[0];
    for (let i = 0; i < 3; i++) { B.estar(o.x + 0.3, o.z); await pausa(80); }
    const huecos = ['mano:der', 'mano:izq', 'ropa:interior', 'ropa:piernas'];
    let cogido = null;
    for (const a of huecos) { const rr = await B.objeto({ tipo: 'coger_suelo', objeto: o.id, x: o.x + 0.3, z: o.z, a }); if (rr.ok) { cogido = rr; break; } }
    comprobar('cualquiera puede cogerlo del cuerpo', !!cogido, o.cosa.tipo);
  }
  // A, de vuelta: lo que su navegador mandó desde donde murió no le saca de la cama
  A.estar(60, 40); await pausa(150);
  const pa = s.presencia.ultimo.get(yoA);
  comprobar('lo que su navegador manda aún desde donde murió no cuenta', Math.hypot(pa.x - 70, pa.z - 45) < 0.5, JSON.stringify([pa.x, pa.z]));
  for (let i = 0; i < 3; i++) { A.estar(70, 45.5); await pausa(80); }
  comprobar('y desde la cama ya sí', Math.abs(s.presencia.ultimo.get(yoA).z - 45.5) < 0.01);
  await pausa(3200);
  comprobar('pasada su hora, el cuerpo se va (los demás dejan de verlo)', !s.cuerpos.todos().length && B.recibidos.some(x => x.tipo === 'sale' && x.autor === cu.id));

  console.log('En el combate: quien cae, muere');
  s.objetos.fab.estaciones['cama_a'].ligadas = [];
  for (let i = 0; i < 3; i++) { A.estar(20, 20); await pausa(80); }
  s.combate.luchadores[yoA].caer('Desangrado');
  const m2 = await A.esperar(x => x.tipo === 'muerte' && x.motivo === 'Desangrado', 3000).catch(() => null);
  comprobar('cae en el combate y muere (no se levanta curado donde cayó)', !!m2 && !s.combate.luchadores[yoA].fuera);
  comprobar('sin cama, sin terreno: vuelve a su sitio de salida (aquí, el centro)', !!m2 && !m2.enCama && m2.posicion.x === 0 && m2.posicion.z === 0, JSON.stringify(m2 && m2.posicion));

  console.log('Ahogado: lo dice su navegador, y el servidor mira el agua');
  const s2 = crearServidor({ puerto: 0, archivo: join(dir, 'b', 'mundo.jsonl'), latido: 200, limiteMovimiento: false, terreno: { origen: { x: 0, z: 0 }, suelo: () => 0, aguaEn: (x) => (x > 100 ? 3 : null), posicion: () => null, paisaje: { sitio: () => ({ T: 12 }) }, alt: () => 0 }, salidaComun: true });
  const p2 = await s2.listo;
  const D = await cliente(p2);
  const yoD = D.bienvenida.autor;
  for (let i = 0; i < 3; i++) { D.estar(10, 10); await pausa(80); }
  D.mandar({ tipo: 'morir', motivo: 'ahogado' });
  const e1 = await D.esperar(x => x.tipo === 'error', 2000).catch(() => null);
  comprobar('en seco no te ahogas (no sirve para volver a casa)', !!e1 && !D.recibidos.some(x => x.tipo === 'muerte'), e1 && e1.motivo);
  for (let i = 0; i < 3; i++) { D.estar(120, 10); await pausa(80); }
  D.mandar({ tipo: 'morir', motivo: 'ahogado' });
  const m3 = await D.esperar(x => x.tipo === 'muerte', 2000).catch(() => null);
  comprobar('en el agua honda, sí: ahogado', !!m3 && m3.motivo === MOTIVOS.ahogado);
  D.mandar({ tipo: 'morir', motivo: 'sed' });
  const e2 = await D.esperar(x => x.tipo === 'error' && x !== e1, 2000).catch(() => null);
  comprobar('de sed no se puede decir: eso lo ve el servidor', !!e2);
  await s2.cerrar();
  void yoD;
} catch (e) {
  mal++; console.log('  FALLA', e && e.stack);
} finally {
  if (s) await s.cerrar();
  if (copia) rmSync(copia, { force: true });
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
