// Regar el huerto (P11b, «La lluvia y el riego»; valravnx, 14 nov). Ejecutar: node pruebas/prueba_regar.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/campos.js, src/logica/tiempo.js,
// src/logica/acciones.js): el tiempo sale igual para todos de la hora y el sitio (unos 3 días de cada 10 con lluvia);
// la col y el nabo, sin agua dos días, se ven mustios y crecen a la mitad (no se mueren); la lluvia los riega solos;
// con el cubo lleno en la mano se riega un círculo de 1,2 m (y el cubo se vacía); vacío o sin cubo, no; el cereal y las
// habas no se riegan; regada a tiempo, la col madura en su semana y la que no, más tarde; en tierra ajena, no; el cubo
// se llena solo con agua al lado; rehecho desde el registro y guardado y leído, igual; y el servidor de verdad llena el
// cubo donde te tiene (con agua), pone la hora, mira que estés cerca y lo reparte a los demás.
// Con MUTAR=1 la sed no frena el crecimiento: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import * as C from '../src/logica/campos.js';
import { lloviendo, DIA, BLOQUE_TIEMPO } from '../src/logica/tiempo.js';
import { ESFUERZOS } from '../src/logica/necesidades.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

if (process.env.MUTAR === '1') globalThis.__mutarRegar = true;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana', B = 'jugador:bruno';
const foto = (m) => JSON.stringify(m.exportar());
const T0 = Math.floor(1e12 / DIA) * DIA;

console.log('El tiempo del mundo');
{
  globalThis.__tiempo = undefined;
  let dias = 0, n = 0;
  for (let zx = 0; zx < 20; zx++) for (let d = 0; d < 50; d++) { n++; let ll = false; for (let b = 0; b < 8; b++) if (lloviendo(zx * 1000 + 5, 300, T0 + d * DIA + b * BLOQUE_TIEMPO)) ll = true; if (ll) dias++; }
  comprobar('unos 3 días de cada 10 con lluvia (entre 2 y 4)', dias / n > 0.2 && dias / n < 0.4, (dias / n).toFixed(2));
  comprobar('igual para todos: el mismo sitio y la misma hora dan lo mismo', [...Array(200)].every((_, i) => lloviendo(i * 37, i * 11, T0 + i * 3e6) === lloviendo(i * 37, i * 11, T0 + i * 3e6)));
  let distintas = 0; for (let d = 0; d < 60; d++) if (lloviendo(500, 500, T0 + d * DIA + 3 * BLOQUE_TIEMPO) !== lloviendo(5500, 500, T0 + d * DIA + 3 * BLOQUE_TIEMPO)) distintas++;
  comprobar('por zonas: a 5 km no siempre hace el mismo tiempo', distintas > 5, `${distintas} de 60 ratos distintos`);
  const s = C.sequia(500, 500, T0, T0 + 30 * DIA);
  comprobar('en un mes, llueve alguna vez y la col pasa parte del tiempo seca', s.mojada > T0 && s.seco > 0 && s.seco < 28 * DIA, `${(s.seco / DIA).toFixed(1)} días mustia, la última lluvia a los ${((s.mojada - T0) / DIA).toFixed(1)} días`);
}

globalThis.__tiempo = 'seco';   // lo demás, sin llover (salvo donde se dice)
ponerZonas(null);
const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
const H = (autor, a) => ejecutar(m, reg, { autor, ...a }, invs);
ejecutar(m, reg, { autor: A, tipo: 'mojon', x: 0, z: 0 });
ejecutar(m, reg, { autor: B, tipo: 'mojon', x: 200, z: 0 });
for (const [x, z] of [[-5, -5], [5, -5], [5, 5], [-5, 5], [-4.5, -4.5]]) { if (!invs.de(A).cuantos('estaca')) invs.de(A).meterDonde('estaca', 1); H(A, { tipo: 'estaca', x, z }); }
const campo = m.campos[0];
const mano = (autor, tipo, n = 1) => { invs.de(autor).lugares['mano:der'] = tipo ? { tipo, n } : null; };
const enMano = (autor) => (invs.de(autor).lugares['mano:der'] || {}).tipo;
mano(A, 'azada');
for (let x = -4; x <= 4; x += 1.5) for (let z = -4; z <= 4; z += 1.5) H(A, { tipo: 'labrar', campo: campo.id, x, z, t: T0 });
mano(A, 'semilla_col', 2); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: -2, z: 2, t: T0 }); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: 2, z: 2, t: T0 });
mano(A, 'semilla_nabo', 1); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'nabo', x: -2, z: -2, t: T0 });
mano(A, 'habas', 1); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 3, z: -2.5, t: T0 });
mano(A, 'semilla_cebada', 1); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: 0, z: -3, t: T0 });
const col1 = () => campo.plantas.find(p => p.c === 'col' && p.x === -2), col2 = () => campo.plantas.find(p => p.c === 'col' && p.x === 2);
const nabo = () => campo.plantas.find(p => p.c === 'nabo'), haba = () => campo.plantas.find(p => p.c === 'habas');
comprobar('sembrado: dos coles, un nabo, una haba y cebada a voleo', campo.plantas.length === 4 && C.casillasVoleo(campo).length > 0);

console.log('La sed');
comprobar('a 1 día, la col está bien', !C.riegoPlanta(col1(), T0 + 1 * DIA).mustia);
const e25 = C.riegoPlanta(col1(), T0 + 2.5 * DIA);
comprobar('a los 2 días y medio sin agua, mustia', e25.mustia);
comprobar('y ha crecido a la mitad desde los 2 días (cuenta como sembrada 6 h más tarde)', Math.abs(e25.t - (T0 + 0.25 * DIA)) < 1000, `${((e25.t - T0) / 3600000).toFixed(1)} h`);
comprobar('la haba, de secano, nunca mustia y crece como siempre', !C.riegoPlanta(haba(), T0 + 5 * DIA).mustia && C.riegoPlanta(haba(), T0 + 5 * DIA).t === T0);
comprobar('sin regar, la col no está madura a la semana (la haba sí)', C.fase(C.tPlanta(nabo(), T0 + 7.2 * DIA), T0 + 7.2 * DIA) < 3 && C.fase(C.tPlanta(haba(), T0 + 7.2 * DIA), T0 + 7.2 * DIA) === 3);
comprobar('pero no se muere: madura más tarde (a los 12 días, con 2 de agua y 10 a la mitad)', C.fase(C.tPlanta(nabo(), T0 + 11.9 * DIA), T0 + 11.9 * DIA) === 2 && C.fase(C.tPlanta(nabo(), T0 + 12.1 * DIA), T0 + 12.1 * DIA) === 3);
comprobar('madura, ya no se ve mustia', !C.riegoPlanta(nabo(), T0 + 12.2 * DIA).mustia);
globalThis.__tiempo = 'lluvia';
comprobar('con lluvia, nunca mustia y crece como siempre', !C.riegoPlanta(nabo(), T0 + 5 * DIA).mustia && C.riegoPlanta(nabo(), T0 + 5 * DIA).t === T0);
globalThis.__tiempo = 'seco';

console.log('El cubo');
mano(A, 'cubo');
let r = C.llenarCubo(invs.de(A).lugares, false);
comprobar('sin agua al lado, el cubo no se llena', !r.ok && r.motivo === 'Aquí no hay agua: busca un río, un lago o el mar.', r.motivo);
r = C.llenarCubo(invs.de(A).lugares, true);
comprobar('con agua al lado, se llena', r.ok && enMano(A) === 'cubo_agua');
r = C.llenarCubo(invs.de(A).lugares, true);
comprobar('lleno, no otra vez', !r.ok && r.motivo === 'El cubo ya está lleno.', r.motivo);
mano(A, 'azada');
comprobar('sin cubo en la mano, no', !C.llenarCubo(invs.de(A).lugares, true).ok);

console.log('Regar');
mano(A, 'cubo');
r = H(A, { tipo: 'regar', campo: campo.id, x: -2, z: 2, t: T0 + 2.5 * DIA });
comprobar('con el cubo vacío, no se riega', !r.ok && r.motivo === 'Necesitas el cubo lleno de agua en la mano para regar.', r.motivo);
mano(A, 'cubo_agua');
r = H(A, { tipo: 'regar', campo: campo.id, x: 3, z: -2.6, t: T0 + 2.5 * DIA });
comprobar('las habas no se riegan', !r.ok && r.motivo === 'La cebada y las habas no se riegan: les basta la lluvia.' && enMano(A) === 'cubo_agua', r.motivo);
r = H(A, { tipo: 'regar', campo: campo.id, x: 0, z: -3, t: T0 + 2.5 * DIA });
comprobar('ni la cebada', !r.ok && r.motivo === 'La cebada y las habas no se riegan: les basta la lluvia.', r.motivo);
r = H(A, { tipo: 'regar', campo: campo.id, x: 0, z: 1, t: T0 + 2.5 * DIA });
comprobar('donde no hay col ni nabo, nada', !r.ok && r.motivo === 'Aquí no hay col ni nabo que regar.', r.motivo);
r = H(A, { tipo: 'regar', campo: campo.id, x: -2, z: 2.2, t: T0 + 2.5 * DIA });
comprobar('con el cubo lleno, riega la col de delante (un círculo de 1,2 m: solo esa)', r.ok && r.regadas === 1 && r.mustias === 1, JSON.stringify(r));
comprobar('y el cubo se vacía', enMano(A) === 'cubo');
comprobar('regada, ya no está mustia', !C.riegoPlanta(col1(), T0 + 3 * DIA).mustia);
comprobar('lo que perdió mustia se queda (6 h)', Math.abs(C.tPlanta(col1(), T0 + 3 * DIA) - (T0 + 0.25 * DIA)) < 1000);
comprobar('dos días más sin agua y mustia otra vez', C.riegoPlanta(col1(), T0 + 4.6 * DIA).mustia);
// la otra col, regada cada día y medio: madura en su semana
for (const d of [1.5, 3, 4.5, 6]) { mano(A, 'cubo_agua'); H(A, { tipo: 'regar', campo: campo.id, x: 2, z: 2, t: T0 + d * DIA }); }
comprobar('regada a tiempo, nunca mustia', [1, 2, 3, 4, 5, 6.5].every(d => !C.riegoPlanta(col2(), T0 + d * DIA).mustia));
mano(A, null);
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: 2, z: 2, t: T0 + 7.05 * DIA });
comprobar('y se coge a la semana', r.ok && r.cultivo === 'col', r.motivo || '');
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: -2, z: -2, t: T0 + 7.05 * DIA });
comprobar('el nabo sin regar, aún no', !r.ok && r.motivo === 'Aún no está madura.', r.motivo);
invs.de(B).lugares['mano:der'] = { tipo: 'cubo_agua', n: 1 };
r = H(B, { tipo: 'regar', campo: campo.id, x: -2, z: -2, t: T0 + 3 * DIA });
comprobar('en tierra ajena, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
comprobar('regar cansa, menos que labrar', ESFUERZOS.regar > 0 && ESFUERZOS.regar < ESFUERZOS.labrar);

// rehecho y guardado
comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === foto(m));
const c2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar()))).campos[0];
comprobar('se guarda y se lee: cuándo se regó y lo que perdió, igual', JSON.stringify(c2.plantas) === JSON.stringify(campo.plantas) && c2.plantas.some(p => p.ag && p.rt));

console.log('El servidor de verdad: llena el cubo donde te tiene, pone la hora, mira que estés cerca y lo reparte');
{
  const cliente = (puerto) => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond); if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }));
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    c.objeto = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.recibidos.push(m); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
  const espera = (ms) => new Promise(r => setTimeout(r, ms));
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-regar-'));
  // un terreno de prueba: llano, con el río a partir de x = 100
  const terreno = { origen: { x: 0, z: 0 }, suelo: () => 0, aguaEn: (x) => (x > 100 ? 1 : null), posicion: () => null, paisaje: { sitio: () => ({ T: 12 }) }, alt: () => 0, obra: () => null };
  const s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno, limiteMovimiento: false, salidaComun: true });
  try {
    const puerto = await s.listo;
    const Ana = await cliente(puerto), Bruno = await cliente(puerto);
    const yo = Ana.bienvenida.autor;
    Ana.estar(1, 1); Bruno.estar(2, 1); await espera(150);
    await Ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
    const rm = await Ana.accion({ tipo: 'mojon', x: 0, z: 0 });
    comprobar('Ana pone su mojón', rm.ok, rm.motivo || '');
    const inv = s.objetos.invs.de(yo);
    for (const [x, z] of [[-5, -5], [5, -5], [5, 5], [-5, 5], [-4.6, -4.6]]) {
      if (!inv.cuantos('estaca')) inv.meterDonde('estaca', 1);
      Ana.estar(x, z); await espera(120);
      await Ana.accion({ tipo: 'estaca', x, z });
    }
    const c = s.mundo.campos[0];
    inv.lugares['mano:der'] = { tipo: 'azada', n: 1 };
    Ana.estar(0, -1); await espera(150);
    await Ana.accion({ tipo: 'labrar', campo: c.id, x: 0, z: 0 });
    inv.lugares['mano:der'] = { tipo: 'semilla_col', n: 1 };
    const rs = await Ana.accion({ tipo: 'sembrar', campo: c.id, cultivo: 'col', x: 0, z: 0.3 });
    comprobar('Ana planta una col en el servidor', rs.ok, rs.motivo || '');
    c.plantas[0].t -= 3 * DIA;   // (como si fuera de hace tres días, sin una gota)
    comprobar('sin llover tres días, mustia', C.riegoPlanta(c.plantas[0], Date.now()).mustia);
    inv.lugares['mano:der'] = { tipo: 'cubo', n: 1 };
    let ro = await Ana.objeto({ tipo: 'llenar_cubo' });
    comprobar('lejos del río, el cubo no se llena', !ro.ok && ro.motivo === 'Aquí no hay agua: busca un río, un lago o el mar.', ro.motivo);
    Ana.estar(99.5, 0); await espera(150);
    ro = await Ana.objeto({ tipo: 'llenar_cubo' });
    comprobar('junto al río, se llena', ro.ok && inv.lugares['mano:der'].tipo === 'cubo_agua', ro.motivo || '');
    const lejos = await Ana.accion({ tipo: 'regar', campo: c.id, x: 0, z: 0.3 });
    comprobar('a más de 3 m de donde está, no se riega', !lejos.ok && lejos.motivo === 'Estás demasiado lejos.', lejos.motivo);
    Ana.estar(0, -0.6); await espera(150);
    const rr = await Ana.accion({ tipo: 'regar', campo: c.id, x: 0, z: 0.3, t: 5 });
    comprobar('cerca y con el cubo lleno, riega la col', rr.ok && !C.riegoPlanta(c.plantas[0], Date.now()).mustia, rr.motivo || '');
    comprobar('y el cubo, vacío', inv.lugares['mano:der'].tipo === 'cubo');
    const visto = await Bruno.esperar(m => m.tipo === 'accion' && m.entrada && m.entrada.tipo === 'regar').catch(() => null);
    comprobar('Bruno lo ve (con la hora del servidor, no la del navegador)', visto && visto.entrada.autor === yo && visto.entrada.datos.t > 1e12);
    const otra = await Ana.accion({ tipo: 'regar', campo: c.id, x: 0, z: 0.3 });
    comprobar('con el cubo vacío, no otra vez', !otra.ok && otra.motivo === 'Necesitas el cubo lleno de agua en la mano para regar.', otra.motivo);
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message, e.stack.split('\n').slice(0, 3).join(' | ')); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
