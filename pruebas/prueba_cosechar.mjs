// Cosechar (P11, la granja básica). Ejecutar: node pruebas/prueba_cosechar.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/campos.js, src/logica/acciones.js): la cebada
// madura se siega con la hoz en la mano, a pasadas de 1,2 m, y deja una gavilla cada 2,5 m² segados en el suelo (lo que
// sobra se guarda para la siguiente); lo verde no se siega; sin hoz, en tierra ajena o donde no hay cebada, no; las
// habas, la col y el nabo maduros se cogen a mano y dan 4 veces lo sembrado (a lo que llevas); lo verde no; la col y el
// nabo se comen y se estropean; rehecho desde el registro y guardado y leído, igual; y el servidor de verdad pone la
// hora, mira que estés cerca, deja las gavillas en el suelo donde se siega y lo reparte a los demás.
// Con MUTAR=1 se siega también lo verde: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import * as C from '../src/logica/campos.js';
import { NUTRE } from '../src/logica/necesidades.js';
import { VIDA } from '../src/logica/comida.js';
import { ESTACIONES, RECETAS } from '../src/logica/fabricacion.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

if (process.env.MUTAR === '1') globalThis.__mutarCosechar = true;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana', B = 'jugador:bruno';
const foto = (m) => JSON.stringify(m.exportar());
const T0 = 1e12, DIA = 24 * 3600 * 1000;

ponerZonas(null);
const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
const H = (autor, a) => ejecutar(m, reg, { autor, ...a }, invs);
ejecutar(m, reg, { autor: A, tipo: 'mojon', x: 0, z: 0 });
ejecutar(m, reg, { autor: B, tipo: 'mojon', x: 200, z: 0 });
for (const [x, z] of [[-5, -5], [5, -5], [5, 5], [-5, 5], [-4.5, -4.5]]) { if (!invs.de(A).cuantos('estaca')) invs.de(A).meterDonde('estaca', 1); H(A, { tipo: 'estaca', x, z }); }
const campo = m.campos[0];
const mano = (autor, tipo, n) => { invs.de(autor).lugares['mano:der'] = tipo ? { tipo, n } : null; };
// labrar todo el campo
mano(A, 'azada', 1);
for (let x = -4; x <= 4; x += 1.5) for (let z = -4; z <= 4; z += 1.5) H(A, { tipo: 'labrar', campo: campo.id, x, z, t: T0 });
const labradas = C.casillasLabradas(campo, T0).length;
comprobar('el campo de Ana, labrado (casi entero)', labradas >= 95, `${labradas} m²`);

// sembrar: la cebada en dos pasadas (una hoy, otra una semana después) y unas plantas
mano(A, 'semilla_cebada', 5);
let r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: -2, z: 0, t: T0 });
const viejas = r.nuevas;
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: 2.5, z: 0, t: T0 + 7 * DIA });
mano(A, 'habas', 2); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 0.5, z: 3.5, t: T0 });
mano(A, 'semilla_col', 2); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: 2.5, z: 3.5, t: T0 });
mano(A, 'semilla_nabo', 2); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'nabo', x: -2.5, z: 3.5, t: T0 + 6 * DIA });
comprobar('sembrado: dos pasadas de cebada y tres plantas', campo.voleo.t.length === 2 && campo.plantas.length === 3);
const T = T0 + 7.5 * DIA;   // la primera cebada y las habas y la col, maduras; la otra cebada y el nabo, verdes

// segar
mano(A, null);
r = H(A, { tipo: 'segar', campo: campo.id, x: -2, z: 0, t: T });
comprobar('sin la hoz en la mano, no', !r.ok && r.motivo === 'Necesitas la hoz en la mano para segar.', r.motivo);
mano(A, 'hoz_silex', 1);
r = H(A, { tipo: 'segar', campo: campo.id, x: 2.5, z: 0, t: T });
comprobar('la cebada verde no se siega', !r.ok && r.motivo === 'La cebada aún no está madura.', r.motivo);
r = H(A, { tipo: 'segar', campo: campo.id, x: -2, z: 0, t: T });
comprobar('con la hoz, una pasada siega un círculo de 1,2 m (4 m²) y deja 1 gavilla en el suelo', r.ok && r.segadas === 4 && r.gavillas === 1 && r.sobra && r.sobra.gavilla === 1, JSON.stringify(r));
comprobar('y guarda lo que sobra (1,5 m²) para la siguiente', campo.segado === 1.5, String(campo.segado));
comprobar('lo segado ya no está sembrado (sigue labrado)', C.voleoEn(campo, -1.5, 0.5) === null && C.labradoEn(campo, -1.5, 0.5, T));
let gav = 1, seg = 4;
for (const [x, z] of [[-3.2, -1], [-0.8, -1], [-3.2, 1], [-0.8, 1], [-2, 1.6], [-2, -1.6]]) { r = H(A, { tipo: 'segar', campo: campo.id, x, z, t: T }); if (r.ok) { gav += r.gavillas; seg += r.segadas; } }
comprobar('segada entera, unas 4 gavillas cada 10 m² (lo que da un puñado)', seg === viejas && gav === Math.floor(viejas / C.M2_POR_GAVILLA), `${seg} de ${viejas} m², ${gav} gavillas`);
comprobar('y lo verde sigue en pie', C.casillasVoleo(campo).length > 0 && C.casillasVoleo(campo).every(k => k.t === T0 + 7 * DIA));
r = H(A, { tipo: 'segar', campo: campo.id, x: -2, z: 0, t: T });
comprobar('donde ya está segado, no', !r.ok && r.motivo === 'Aquí no hay cebada que segar.', r.motivo);
invs.de(B).lugares['mano:der'] = { tipo: 'hoz_silex', n: 1 };
r = H(B, { tipo: 'segar', campo: campo.id, x: 2.5, z: 0, t: T + 7 * DIA });
comprobar('en tierra ajena, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);

// coger a mano
mano(A, null);
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: -2.5, z: 3.5, t: T });
comprobar('el nabo verde no se coge', !r.ok && r.motivo === 'Aún no está madura.', r.motivo);
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: 0.6, z: 3.4, t: T });
comprobar('las habas maduras se cogen a mano y dan 4 habas (a lo que llevas)', r.ok && r.cultivo === 'habas' && invs.de(A).cuantos('habas') === 4, JSON.stringify(r));
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: 2.5, z: 3.5, t: T });
const tiene = (t) => invs.de(A).cuantos(t) + ((r.sobra || {})[t] || 0);
comprobar('la col da la col y 3 semillas (lo que no cabe en las manos, al suelo)', r.ok && tiene('col') === 1 && tiene('semilla_col') === 3 && r.sobra.semilla_col === 3, JSON.stringify(r));
comprobar('y ya no están en el campo', campo.plantas.length === 1 && campo.plantas[0].c === 'nabo');
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: 0.5, z: 3.5, t: T });
comprobar('donde no hay nada, no', !r.ok && r.motivo === 'Aquí no hay nada que coger.', r.motivo);
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: -2.5, z: 3.5, t: T0 + 14 * DIA });
comprobar('el nabo, maduro, da el nabo y 3 semillas', r.ok && tiene('nabo') === 1 && tiene('semilla_nabo') === 3, JSON.stringify(r));

// lo que da, en el juego
comprobar('la col y el nabo se comen, crudos o asados (que sacian más)', NUTRE.col > 0 && NUTRE.nabo > 0 && NUTRE.col_asada > NUTRE.col && NUTRE.nabo_asado > NUTRE.nabo && RECETAS.asar_col && RECETAS.asar_nabo);
comprobar('y se estropean pronto', VIDA.col > 0 && VIDA.nabo > 0);
comprobar('las gavillas van al almiar y el nabo (lo pequeño) al cesto', ESTACIONES.almiar.guarda.includes('gavilla') && ESTACIONES.cesto.guarda.includes('nabo'));

// rehecho desde el registro y guardado: igual
comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === foto(m));
const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
comprobar('se guarda y se lee: lo segado y lo cogido, igual', m2.campos[0].segado === campo.segado && C.casillasVoleo(m2.campos[0]).length === C.casillasVoleo(campo).length && (m2.campos[0].plantas || []).length === 0);

console.log('El servidor de verdad: pone la hora, mira que estés cerca y lo reparte');
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
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.recibidos.push(m); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
  const espera = (ms) => new Promise(r => setTimeout(r, ms));
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-cosechar-'));
  const s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  try {
    const puerto = await s.listo;
    const Ana = await cliente(puerto), Bruno = await cliente(puerto);
    const yo = Ana.bienvenida.autor;
    Ana.estar(1, 1); Bruno.estar(2, 1); await espera(150);
    await Ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
    await Ana.accion({ tipo: 'mojon', x: 0, z: 0 });
    const inv = s.objetos.invs.de(yo);
    for (const [x, z] of [[-5, -5], [5, -5], [5, 5], [-5, 5], [-4.6, -4.6]]) {
      if (!inv.cuantos('estaca')) inv.meterDonde('estaca', 1);
      Ana.estar(x, z); await espera(120);
      await Ana.accion({ tipo: 'estaca', x, z });
    }
    const c = s.mundo.campos[0];
    inv.lugares['mano:der'] = { tipo: 'azada', n: 1 };
    Ana.estar(0, -1); await espera(150);
    const rl = await Ana.accion({ tipo: 'labrar', campo: c.id, x: 0, z: 0 });
    comprobar('Ana labra en el servidor', rl.ok, rl.motivo || '');
    inv.lugares['mano:der'] = { tipo: 'semilla_cebada', n: 2 };
    const rs = await Ana.accion({ tipo: 'sembrar', campo: c.id, cultivo: 'cebada', x: 0, z: 0 });
    comprobar('Ana siembra la cebada', rs.ok, rs.motivo || '');
    c.voleo.t = c.voleo.t.map(t => t - 8 * DIA);   // (madura: como si fuera de hace ocho días)
    inv.lugares['mano:der'] = { tipo: 'hoz_silex', n: 1 };
    const lejos = await Ana.accion({ tipo: 'segar', campo: c.id, x: 0, z: 4 });
    comprobar('a más de 3 m de donde está, no', !lejos.ok && lejos.motivo === 'Estás demasiado lejos.', lejos.motivo);
    const antes = s.objetos.suelo.objetos.length;
    const rg = await Ana.accion({ tipo: 'segar', campo: c.id, x: 0.2, z: 0.3, t: 5 });
    comprobar('con la hoz y cerca, siega', rg.ok && C.voleoEn(c, 0.5, 0.5) === null, rg.motivo || '');
    const g = s.objetos.suelo.objetos.slice(antes).find(o => o.cosa.tipo === 'gavilla');
    comprobar('y la gavilla queda en el suelo, donde se siega', g && Math.hypot(g.x - 0.2, g.z - 0.3) < 1.5, JSON.stringify(g || null));
    const visto = await Bruno.esperar(m => m.tipo === 'accion' && m.entrada && m.entrada.tipo === 'segar').catch(() => null);
    comprobar('Bruno lo ve (con la hora del servidor)', visto && visto.entrada.autor === yo && visto.entrada.datos.t > 1e12);
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
