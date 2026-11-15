// El pozo (1), la lógica (P11b, «La lluvia y el riego»; valravnx, 14 nov: «debe ser laborioso»).
// Ejecutar: node pruebas/prueba_pozo.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/pozo.js, src/logica/acciones.js): la hondura
// del agua sale del sitio (junto al río o en el fondo de un valle, poco honda; en un alto y lejos, honda; más que el
// tope, no hay pozo), y en Whitholm de verdad la mayor parte de la tierra tiene agua al alcance; el pozo se marca solo
// en tu tierra, en seco y no pegado a otro; cada tramo de 1 m se cava a golpes con la pala de madera en la mano (sin
// ella, no) y saca su tierra; no se baja más sin revestirlo antes de piedra (8 piedras, de lo que llevas); al llegar
// al agua y revestirlo entero, tiene agua; en tierra ajena, no; rehecho desde el registro y guardado y leído, igual; y
// el servidor de verdad pone él la hondura (no la del navegador), mira que estés al lado y lo reparte a los demás.
// Con MUTAR=1 se puede bajar sin revestir: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import * as P from '../src/logica/pozo.js';
import { ESFUERZOS } from '../src/logica/necesidades.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

if (process.env.MUTAR === '1') globalThis.__mutarPozo = true;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana', B = 'jugador:bruno';
const foto = (m) => JSON.stringify(m.exportar());

console.log('El agua bajo tierra');
{
  const llano = P.honduraAgua({ suelo: 10, media: 10, fondo: 10, rio: null, mar: -50 });
  const junto = P.honduraAgua({ suelo: 1, media: 1, fondo: 0, rio: { d: 20, nivel: 0 }, mar: -50 });
  const valle = P.honduraAgua({ suelo: 0, media: 6, fondo: 0, rio: null, mar: -50 });
  const ladera = P.honduraAgua({ suelo: 40, media: 40, fondo: 0, rio: null, mar: -50 });
  const alto = P.honduraAgua({ suelo: 60, media: 52, fondo: 0, rio: null, mar: -50 });
  const cumbre = P.honduraAgua({ suelo: 110, media: 95, fondo: 0, rio: null, mar: -50 });
  comprobar('junto al río, poco honda (1 m sobre su agua: 2,1 m)', junto === 2.1, String(junto));
  comprobar('en el fondo de un valle, poco honda', valle === P.HONDURA_MIN, String(valle));
  comprobar('en una ladera 40 m sobre el fondo, más honda (6 m)', ladera === 6, String(ladera));
  comprobar('en un alto sobre lo de alrededor, más aún (12 m: el tope)', alto === 12, String(alto));
  comprobar('en una cumbre, más que el tope: no hay pozo', cumbre === null, String(cumbre));
  comprobar('en un llano alto sin río ni valle por debajo en 300 m, como el fondo de un valle (el agua no se va)', llano === P.HONDURA_MIN, String(llano));
  comprobar('con un río por encima del sitio (otro valle), no cuenta', P.honduraAgua({ suelo: 0, media: 0, fondo: 0, rio: { d: 50, nivel: 30 }, mar: -50 }) === P.HONDURA_MIN);
  // con un terreno de prueba: una loma de 1 m por cada 5 m que te alejas de x = 0 (el río en x < 0)
  const t = { y0: 0, suelo: (x) => Math.max(0, x / 5), rioEn: (x) => ({ d: Math.max(0, x), nivel: -0.5 }) };
  const h = [5, 50, 100, 200].map(x => P.honduraEn(t, x, 0));
  comprobar('con el terreno: cuanto más lejos y más alto, más honda', h[0] < h[1] && h[1] < h[2] && h[2] < h[3], h.join(' · '));
  const t2 = { y0: 0, suelo: (x, z) => 60 * Math.max(0, 1 - Math.hypot(x, z) / 100), rioEn: () => null };
  comprobar('y en lo alto de un cerro (60 m sobre el llano de alrededor), más que el tope: no hay pozo', P.honduraEn(t2, 0, 0) === null && P.honduraEn(t2, 95, 0) !== null, `${P.honduraEn(t2, 0, 0)} · al pie, ${P.honduraEn(t2, 95, 0)}`);
}

console.log('Whitholm de verdad (el terreno del servidor)');
{
  const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
  const t = terrenoWhitholm();
  let n = 0, con = 0, poco = 0, hondo = 0;
  let semilla = 7; const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400; i++) {
    const x = (azar() - 0.5) * 5000, z = (azar() - 0.5) * 5000;
    if (!t.enIsla(x, z) || t.aguaEn(x, z) !== null) continue;
    const hh = P.honduraEn(t, x, z); n++;
    if (hh !== null) { con++; if (hh <= 4) poco++; if (hh >= 8) hondo++; }
  }
  comprobar('casi toda la tierra tiene el agua al alcance (más del 80 %)', con / n > 0.8, `${con} de ${n}`);
  comprobar('y hay de todo: sitios de poco (hasta 4 m) y de mucho (8 m o más)', poco > n * 0.1 && hondo > n * 0.1, `${poco} de poco, ${hondo} hondos`);
  const salida = P.honduraEn(t, 0, 0);
  comprobar('en la salida, junto al fondo del valle, poco honda', salida !== null && salida <= 4, String(salida));
}

ponerZonas(null);
const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
const H = (autor, a) => ejecutar(m, reg, { autor, ...a }, invs);
ejecutar(m, reg, { autor: A, tipo: 'mojon', x: 0, z: 0 });
ejecutar(m, reg, { autor: B, tipo: 'mojon', x: 200, z: 0 });
const mano = (autor, tipo, n = 1) => { invs.de(autor).lugares['mano:der'] = tipo ? { tipo, n } : null; };

console.log('Marcar el pozo');
let r = H(A, { tipo: 'pozo', x: 3, z: 3 });
comprobar('sin hondura (el agua, más que el tope), no se marca, y el aviso lo dice', !r.ok && r.motivo === `Aquí el agua está a más de ${P.TOPE} m: busca más abajo, cerca del río o en el fondo de un valle.`, r.motivo);
r = H(A, { tipo: 'pozo', x: 3, z: 3, hondura: 30 });
comprobar('con una hondura de más del tope, tampoco (no se fía)', !r.ok);
r = H(B, { tipo: 'pozo', x: 3, z: 3, hondura: 2.4 });
comprobar('en tierra ajena, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
m.entorno = { agua: (x) => x > 8, ocupado: () => false };
r = H(A, { tipo: 'pozo', x: 10, z: 0, hondura: 2 });
comprobar('con agua encima, no', !r.ok && r.motivo === 'Aquí hay agua encima: el pozo se cava en seco.', r.motivo);
m.entorno = null;
r = H(A, { tipo: 'pozo', x: 3, z: 3, hondura: 2.4 });
comprobar('en tu tierra, en seco: marcado, con su hondura y sus tramos (2,4 m: 3 tramos)', r.ok && r.hondura === 2.4 && r.tramos === 3, JSON.stringify(r));
const pozo = m.pozos[0];
comprobar('es de quien tiene la tierra y lo empieza', pozo.dueno === A && pozo.autor === A && pozo.cavados === 0);
comprobar('pegado a otro pozo, no', !H(A, { tipo: 'pozo', x: 5, z: 3, hondura: 2.4 }).ok);

console.log('Cavar y revestir');
mano(A, 'hacha_piedra');
r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
comprobar('sin la pala de madera en la mano, no se cava', !r.ok && r.motivo === 'Necesitas la pala de madera en la mano para cavar el pozo.', r.motivo);
mano(A, 'pala_madera');
for (let i = 0; i < P.GOLPES_TRAMO - 1; i++) r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
comprobar(`${P.GOLPES_TRAMO - 1} golpes: el primer tramo, aún a medias`, r.ok && pozo.cavados === 0 && pozo.golpes === P.GOLPES_TRAMO - 1);
r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
comprobar(`a los ${P.GOLPES_TRAMO} golpes, el primer tramo cavado, y saca su tierra`, r.ok && r.tramo && pozo.cavados === 1 && !r.agua && r.tierra === P.TIERRA_TRAMO, JSON.stringify(r));
r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
comprobar('sin revestirlo, no se baja más (y el aviso dice por qué)', !r.ok && r.motivo === 'Reviste antes de piedra este tramo: si bajas más, la tierra se viene abajo.' && pozo.cavados === 1 && pozo.golpes === 0, r.motivo);
const piedras = (n) => { invs.de(A).lugares['mano:der'] = { tipo: 'pala_madera', n: 1 }; invs.de(A).lugares['mano:izq'] = n ? { tipo: 'piedra', n } : null; };
const cuantas = () => invs.de(A).cuantos('piedra');
piedras(0);
r = H(A, { tipo: 'revestir_pozo', pozo: pozo.id });
comprobar('sin piedras, no se reviste', !r.ok && r.motivo === 'No llevas piedras.', r.motivo);
piedras(3);
r = H(A, { tipo: 'revestir_pozo', pozo: pozo.id });
comprobar(`con 3 piedras (de ${P.PIEDRAS_TRAMO}), se ponen y el tramo sigue a medias`, r.ok && r.puestas === 3 && pozo.piedras === 3 && pozo.revestidos === 0 && cuantas() === 0, JSON.stringify(r));
r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
comprobar('a medio revestir, tampoco se baja', !r.ok);
r = H(B, { tipo: 'revestir_pozo', pozo: pozo.id });
comprobar('otro, en tu tierra sin invitarlo, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
piedras(6);
r = H(A, { tipo: 'revestir_pozo', pozo: pozo.id });
comprobar(`con otras 6, se ponen las 5 que faltan (sobra 1) y el tramo queda revestido`, r.ok && r.tramo && r.puestas === 5 && pozo.revestidos === 1 && pozo.piedras === 0 && cuantas() === 1 && !r.agua, JSON.stringify(r));
comprobar('revestido lo cavado, no se reviste más', !H(A, { tipo: 'revestir_pozo', pozo: pozo.id }).ok && pozo.revestidos === 1 && cuantas() === 1);
let gastadas = 8;
for (let k = 0; k < 2; k++) {
  for (let i = 0; i < P.GOLPES_TRAMO; i++) r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
  if (k === 0) { piedras(6); H(A, { tipo: 'revestir_pozo', pozo: pozo.id }); piedras(6); H(A, { tipo: 'revestir_pozo', pozo: pozo.id }); gastadas += 8; }
}
comprobar('el tercer tramo llega al agua', r.ok && r.agua && pozo.cavados === 3 && pozo.revestidos === 2 && !P.conAgua(pozo), JSON.stringify(r));
r = H(A, { tipo: 'cavar_pozo', pozo: pozo.id });
comprobar('ya en el agua, no se cava más', !r.ok && r.motivo === 'Ya has llegado al agua: reviste de piedra el último tramo.', r.motivo);
piedras(6); H(A, { tipo: 'revestir_pozo', pozo: pozo.id }); piedras(6);
r = H(A, { tipo: 'revestir_pozo', pozo: pozo.id }); gastadas += 8;
comprobar('revestido el último, el pozo tiene agua', r.ok && r.agua && P.conAgua(pozo) && P.siguientePaso(pozo) === 'brocal', JSON.stringify(r));
comprobar('ha gastado 8 piedras por tramo (24) y sacado la tierra de 3 tramos', gastadas === 3 * P.PIEDRAS_TRAMO && P.tierraSacada(pozo) === Math.round(3 * P.TIERRA_TRAMO * 100) / 100 && cuantas() === 4, `${cuantas()} piedras sobran en la mano`);
comprobar('ya con agua, ni se cava ni se reviste', !H(A, { tipo: 'cavar_pozo', pozo: pozo.id }).ok && !H(A, { tipo: 'revestir_pozo', pozo: pozo.id }).ok);
comprobar('cavar y revestir cansan, como una obra', ESFUERZOS.cavar_pozo >= 1 && ESFUERZOS.revestir_pozo >= 1);
comprobar('cada acción, con su autor', reg.entradas.filter(e => e.tipo === 'cavar_pozo' && e.ok).every(e => e.autor === A));

console.log('Rematarlo y sacar agua (El pozo (3))');
const lleva = (l) => { const L = invs.de(A).lugares; L['mano:der'] = l.der || null; L['mano:izq'] = l.izq || null; };
comprobar('con agua, aún no se saca: le faltan el brocal y el travesaño', !P.rematado(pozo) && !P.pozoConAgua(m, pozo.x + 1, pozo.z));
lleva({ izq: { tipo: 'piedra', n: 5 } });
r = H(A, { tipo: 'rematar_pozo', pozo: pozo.id });
comprobar(`el brocal, con las piedras que lleva: 5 de ${P.PIEDRAS_BROCAL}`, r.ok && r.paso === 'brocal' && pozo.brocal === 5 && cuantas() === 0 && !r.rematado, JSON.stringify(r));
r = H(A, { tipo: 'rematar_pozo', pozo: pozo.id });
comprobar('sin piedras, no sigue', !r.ok && r.motivo === 'No llevas piedras.', r.motivo);
r = H(B, { tipo: 'rematar_pozo', pozo: pozo.id });
comprobar('otro, en tu tierra sin invitarlo, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
lleva({ izq: { tipo: 'piedra', n: 10 } });
r = H(A, { tipo: 'rematar_pozo', pozo: pozo.id });
comprobar('con 10 más, pone las 7 que faltan (sobran 3): el brocal, entero', r.ok && pozo.brocal === P.PIEDRAS_BROCAL && r.puestas === 7 && cuantas() === 3 && P.siguientePaso(pozo) === 'travesano', JSON.stringify(r));
lleva({ der: { tipo: 'vara', n: 2 }, izq: { tipo: 'cuerda', n: 1 } });
r = H(A, { tipo: 'rematar_pozo', pozo: pozo.id });
comprobar('el travesaño con 2 varas, no (hacen falta 3 y la cuerda), y no gasta nada', !r.ok && r.motivo === 'Para el travesaño hacen falta 3 varas y una cuerda.' && invs.de(A).cuantos('vara') === 2 && invs.de(A).cuantos('cuerda') === 1, r.motivo);
lleva({ der: { tipo: 'vara', n: 3 }, izq: { tipo: 'cuerda', n: 1 } });
r = H(A, { tipo: 'rematar_pozo', pozo: pozo.id });
comprobar('con 3 varas y la cuerda, el travesaño: rematado', r.ok && r.rematado && P.rematado(pozo) && P.siguientePaso(pozo) === 'sacar' && invs.de(A).cuantos('vara') === 0 && invs.de(A).cuantos('cuerda') === 0, JSON.stringify(r));
comprobar('rematado, no se remata más', !H(A, { tipo: 'rematar_pozo', pozo: pozo.id }).ok);
comprobar('a su lado hay agua del pozo (a 2 m, sí; a 4 m, no)', P.pozoConAgua(m, pozo.x + 2, pozo.z) && !P.pozoConAgua(m, pozo.x + 4, pozo.z));
comprobar('rematar cansa', ESFUERZOS.rematar_pozo > 0 && ESFUERZOS.sacar_agua > 0);

console.log('Rehecho y guardado');
const otro2 = reproducir(reg.entradas.filter(e => e.tipo === 'mojon' || e.tipo === 'pozo' || e.tipo === 'cavar_pozo' || e.tipo === 'revestir_pozo' || e.tipo === 'rematar_pozo'));
comprobar('rehecho desde el registro (sin inventarios), el mismo pozo', JSON.stringify(otro2.pozos) === JSON.stringify(m.pozos), JSON.stringify(otro2.pozos));
const leido = Mundo.importar(JSON.parse(foto(m)));
comprobar('guardado y leído, igual', JSON.stringify(leido.pozos) === JSON.stringify(m.pozos));
comprobar('un guardado de antes (sin pozos), sin pozos', Mundo.importar({ ...JSON.parse(foto(m)), pozos: undefined }).pozos.length === 0);
const sin = new Mundo(); ejecutar(sin, new RegistroAcciones(), { autor: A, tipo: 'mojon', x: 0, z: 0 }); ejecutar(sin, new RegistroAcciones(), { autor: A, tipo: 'pozo', x: 3, z: 3, hondura: 3 });
sin.quitarMojon(A);
comprobar('al quitar el mojón, sus pozos se van con su tierra', sin.pozos.length === 0);

console.log('El servidor de verdad: pone la hondura, mira que estés al lado y lo reparte');
{
  const cliente = (puerto) => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 3000) => new Promise((rr, f) => {
      const ya = c.recibidos.find(cond); if (ya) return rr(ya);
      const tt = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (x) => { clearTimeout(tt); rr(x); } });
    });
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }));
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(x => x.tipo === 'resultado' && x.id === id); };
    c.objeto = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return c.esperar(x => x.tipo === 'resultado_objeto' && x.id === id); };
    ws.on('message', (d) => { const x = JSON.parse(d.toString()); c.recibidos.push(x); c.esperas = c.esperas.filter(e => { if (e.cond(x)) { e.r(x); return false; } return true; }); });
    ws.on('open', async () => { c.bienvenida = await c.esperar(x => x.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
  const espera = (ms) => new Promise(rr => setTimeout(rr, ms));
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-pozo-'));
  // un terreno de prueba: llano junto al río (y0 = 0, el mar 0,5 m más abajo) y, más allá de x = 8, un cerro de 200 m
  const suelo = (x) => (x > 8 ? 200 : 0);
  const terreno = { origen: { x: 0, z: 0 }, y0: 0.5, suelo, aguaEn: (x) => (x < -100 ? 1 : null), marEn: () => false, rioEn: () => null, posicion: () => null, paisaje: { sitio: () => ({ T: 12 }) }, alt: () => 0, obra: () => null };
  const s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno, limiteMovimiento: false, salidaComun: true });
  try {
    const puerto = await s.listo;
    const Ana = await cliente(puerto), Bruno = await cliente(puerto);
    const yo = Ana.bienvenida.autor;
    Ana.estar(1, 1); Bruno.estar(2, 1); await espera(150);
    await Ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
    const rm = await Ana.accion({ tipo: 'mojon', x: 0, z: 0 });
    comprobar('Ana pone su mojón', rm.ok, rm.motivo || '');
    let rp = await Ana.accion({ tipo: 'pozo', x: 6, z: 1, hondura: 2 });
    comprobar('a más de 1 m de donde la tiene el servidor, no se marca', !rp.ok && rp.motivo === 'Estás demasiado lejos.', rp.motivo);
    Ana.estar(10, 1); await espera(150);
    rp = await Ana.accion({ tipo: 'pozo', x: 10, z: 1, hondura: 2 });
    comprobar('en lo alto del cerro (el servidor mira el terreno), no: el agua, más honda que el tope', !rp.ok && rp.motivo.startsWith('Aquí el agua está a más de'), rp.motivo);
    Ana.estar(-6, 1); await espera(150);
    rp = await Ana.accion({ tipo: 'pozo', x: -6, z: 1, hondura: 11 });
    const pz = s.mundo.pozos[0];
    comprobar('en el llano, se marca con la hondura del servidor (no la que dice el navegador)', rp.ok && pz && pz.hondura === P.honduraEn(terreno, -6, 1) && pz.hondura !== 11, pz ? String(pz.hondura) : rp.motivo);
    const visto = await Bruno.esperar(x => x.tipo === 'accion' && x.entrada && x.entrada.tipo === 'pozo').catch(() => null);
    comprobar('Bruno lo ve, con su hondura', visto && visto.entrada.autor === yo && visto.entrada.datos.hondura === pz.hondura);
    const inv = s.objetos.invs.de(yo);
    inv.lugares['mano:der'] = { tipo: 'pala_madera', n: 1 };
    Ana.estar(-6, 6); await espera(150);
    let rc = await Ana.accion({ tipo: 'cavar_pozo', pozo: pz.id });
    comprobar('a 5 m del pozo, no se cava', !rc.ok && rc.motivo === 'Estás demasiado lejos.', rc.motivo);
    Ana.estar(-6, 2.5); await espera(150);
    for (let i = 0; i < P.GOLPES_TRAMO; i++) rc = await Ana.accion({ tipo: 'cavar_pozo', pozo: pz.id });
    comprobar('a su lado, con la pala, cava el primer tramo', rc.ok && pz.cavados === 1, rc.motivo || '');
    let rv;
    for (const n of [3, 3, 3]) { inv.lugares['mano:izq'] = { tipo: 'piedra', n }; rv = await Ana.accion({ tipo: 'revestir_pozo', pozo: pz.id }); }
    comprobar('y lo reviste en tres viajes con las piedras que lleva (3 + 3 + 2)', rv.ok && pz.revestidos === 1 && inv.cuantos('piedra') === 1, rv.motivo || `${inv.cuantos('piedra')} sobran`);
    const vr = await Bruno.esperar(x => x.tipo === 'accion' && x.entrada && x.entrada.tipo === 'revestir_pozo' && x.entrada.datos.piedras === 2).catch(() => null);
    comprobar('Bruno ve el tramo revestido (con las piedras puestas en cada viaje)', !!vr && vr.entrada.autor === yo);
    // hasta el agua y rematado, lejos de cualquier río: se saca agua con el cubo y se bebe
    for (let k = 0; k < 20 && !P.conAgua(pz); k++) {
      if (pz.cavados > pz.revestidos) { inv.lugares['mano:izq'] = { tipo: 'piedra', n: 8 }; await Ana.accion({ tipo: 'revestir_pozo', pozo: pz.id }); }
      else { inv.lugares['mano:der'] = { tipo: 'pala_madera', n: 1 }; for (let i = 0; i < P.GOLPES_TRAMO; i++) await Ana.accion({ tipo: 'cavar_pozo', pozo: pz.id }); }
    }
    inv.lugares['mano:der'] = { tipo: 'cubo', n: 1 }; inv.lugares['mano:izq'] = null;
    let ro = await Ana.objeto({ tipo: 'llenar_cubo' });
    comprobar('con agua pero sin rematar, lejos del río, el cubo no se llena', P.conAgua(pz) && !ro.ok && ro.motivo === 'Aquí no hay agua: busca un río.', ro.motivo);
    inv.lugares['mano:izq'] = { tipo: 'piedra', n: 12 };
    let rr = await Ana.accion({ tipo: 'rematar_pozo', pozo: pz.id });
    inv.lugares['mano:der'] = { tipo: 'vara', n: 3 }; inv.lugares['mano:izq'] = { tipo: 'cuerda', n: 1 };
    rr = rr.ok ? await Ana.accion({ tipo: 'rematar_pozo', pozo: pz.id }) : rr;
    comprobar('le pone el brocal (12 piedras) y el travesaño (3 varas y la cuerda), por el servidor', rr.ok && P.rematado(pz) && inv.cuantos('vara') === 0 && inv.cuantos('cuerda') === 0, rr.motivo || '');
    const vb = await Bruno.esperar(x => x.tipo === 'accion' && x.entrada && x.entrada.tipo === 'rematar_pozo').catch(() => null);
    comprobar('Bruno lo ve rematar', !!vb && vb.entrada.autor === yo);
    inv.lugares['mano:der'] = { tipo: 'cubo', n: 1 }; inv.lugares['mano:izq'] = null;
    Ana.estar(-6, 8); await espera(150);
    ro = await Ana.objeto({ tipo: 'llenar_cubo' });
    comprobar('lejos del pozo (7 m), no se llena', !ro.ok, ro.motivo);
    Ana.estar(-6, 2.5); await espera(150);
    ro = await Ana.objeto({ tipo: 'llenar_cubo' });
    comprobar('a su lado, saca agua del pozo: el cubo, lleno (agua dulce, sin río cerca)', ro.ok && inv.lugares['mano:der'].tipo === 'cubo_agua', ro.motivo || '');
    s.necesidades.set(yo, { ...s.necesidades.get(yo), sed: 50 });
    const rb = await Ana.objeto({ tipo: 'beber' });
    comprobar('y bebe del pozo', rb.ok && rb.datos.sed < 50, rb.motivo || JSON.stringify(rb.datos));
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message, e.stack.split('\n').slice(0, 3).join(' | ')); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
