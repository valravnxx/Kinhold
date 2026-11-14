// Escardar (P11, la granja básica; valravnx, 14 nov). Ejecutar: node pruebas/prueba_escardar.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/campos.js, src/logica/acciones.js): lo recién
// sembrado aún no tiene malas hierbas; verde o en espiga, sí; con las manos vacías o con la azada se escarda a pasadas
// de 1,2 m (con otra cosa en la mano, no; en tierra ajena, no; lo ya escardado, no otra vez); lo maduro ya no se
// escarda; al segar, lo escardado da 5 gavillas por cada 4 de lo que no, y cada planta escardada da una más; sin escardar
// se cosecha como siempre; lo segado vuelve a estar sin escardar; rehecho desde el registro y guardado y leído, igual; y
// el servidor de verdad pone la hora, mira que estés cerca y lo reparte a los demás.
// Con MUTAR=1 todo tiene malas hierbas siempre y lo escardado no da más: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import * as C from '../src/logica/campos.js';
import { ESFUERZOS } from '../src/logica/necesidades.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

if (process.env.MUTAR === '1') globalThis.__mutarEscardar = true;
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
mano(A, 'azada', 1);
for (let x = -4; x <= 4; x += 1.5) for (let z = -4; z <= 4; z += 1.5) H(A, { tipo: 'labrar', campo: campo.id, x, z, t: T0 });

// dos pasadas de cebada (la de la izquierda se escardará, la de la derecha no) y dos pares de plantas
mano(A, 'semilla_cebada', 5);
const izq = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: -2.4, z: -1, t: T0 }).nuevas;
const der = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: 2.4, z: -1, t: T0 }).nuevas;
mano(A, 'habas', 2); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: -3, z: 3.5, t: T0 }); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 3, z: 3.5, t: T0 });
mano(A, 'semilla_col', 2); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: -2, z: 2, t: T0 }); H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: 2, z: 2, t: T0 });
comprobar('sembrado: dos pasadas de cebada (iguales) y cuatro plantas', izq === der && izq > 0 && campo.plantas.length === 4, `${izq} y ${der} m²`);

// cuándo hay malas hierbas
const h0 = C.hierbasCerca(campo, -2.4, -1, T0 + 0.05 * DIA);
comprobar('lo recién sembrado aún no tiene malas hierbas', h0.casillas.length === 0, `${h0.casillas.length} m²`);
const TV = T0 + 2 * DIA;   // verde
const hv = C.hierbasCerca(campo, -2.4, -1, TV);
comprobar('verde, sí (dentro del círculo de 1,2 m)', hv.casillas.length >= 3 && hv.casillas.length <= 6, `${hv.casillas.length} m²`);
comprobar('y en espiga, también', C.hierbasCerca(campo, -2.4, -1, T0 + 4.5 * DIA).casillas.length > 0);
comprobar('maduro, ya no', C.hierbasCerca(campo, -2.4, -1, T0 + 7.5 * DIA).casillas.length === 0);

// escardar
mano(A, 'hoz_silex', 1);
let r = H(A, { tipo: 'escardar', campo: campo.id, x: -2.4, z: -1, t: TV });
comprobar('con otra cosa en la mano, no', !r.ok && r.motivo === 'Para escardar, las manos vacías o la azada.', r.motivo);
mano(A, null);
r = H(A, { tipo: 'escardar', campo: campo.id, x: -2.4, z: -1, t: T0 + 0.05 * DIA });
comprobar('recién sembrado, no hay nada que escardar', !r.ok && r.motivo === 'Aquí no hay malas hierbas que quitar.', r.motivo);
r = H(A, { tipo: 'escardar', campo: campo.id, x: -2.4, z: -1, t: TV });
comprobar('con las manos vacías, una pasada escarda un círculo de 1,2 m', r.ok && r.casillas === hv.casillas.length, JSON.stringify(r));
r = H(A, { tipo: 'escardar', campo: campo.id, x: -2.4, z: -1, t: TV });
comprobar('lo ya escardado, no otra vez', !r.ok && r.motivo === 'Aquí no hay malas hierbas que quitar.', r.motivo);
mano(A, 'azada', 1);
for (const [x, z] of [[-3.6, -2.2], [-1.2, -2.2], [-3.6, 0.2], [-1.2, 0.2], [-2.4, 0.6], [-2.4, -2.6], [-4, -1], [-0.8, -1]]) H(A, { tipo: 'escardar', campo: campo.id, x, z, t: TV });
const escIzq = C.casillasVoleo(campo).filter(k => k.x < 0 && C.escardadoEn(campo, k.x + 0.5, k.z + 0.5)).length;
comprobar('con la azada también; la pasada de la izquierda, escardada entera', escIzq === izq, `${escIzq} de ${izq} m²`);
comprobar('la de la derecha sigue con sus malas hierbas', C.casillasVoleo(campo).filter(k => k.x >= 0 && C.escardadoEn(campo, k.x + 0.5, k.z + 0.5)).length === 0);
mano(A, null);
r = H(A, { tipo: 'escardar', campo: campo.id, x: -3, z: 3.5, t: TV });
comprobar('las plantas también (el haba de la izquierda)', r.ok && r.plantas === 1 && campo.plantas.find(p => p.x === -3).e === 1, JSON.stringify(r));
H(A, { tipo: 'escardar', campo: campo.id, x: -2, z: 2, t: TV });
comprobar('y la col de la izquierda; las de la derecha, no', campo.plantas.filter(p => p.e).length === 2 && campo.plantas.filter(p => p.x > 0).every(p => !p.e));
invs.de(B).lugares['mano:der'] = null;
r = H(B, { tipo: 'escardar', campo: campo.id, x: 2.4, z: -1, t: TV });
comprobar('en tierra ajena, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
comprobar('escardar cansa como segar', ESFUERZOS.escardar === ESFUERZOS.segar);

// al cosechar
const T = T0 + 7.5 * DIA;
mano(A, 'hoz_silex', 1);
const segarTodo = (xs) => { let g = 0, s = 0; const antes = campo.segado || 0; for (const x of xs) for (const z of [-2.4, -1, 0.4]) for (const dx of [-0.6, 0.6]) { const q = H(A, { tipo: 'segar', campo: campo.id, x: x + dx, z, t: T }); if (q.ok) { g += q.gavillas; s += q.segadas; } } return { g, s, antes }; };
const sd = segarTodo([2.4, 1.2, 3.6]);
const si = segarTodo([-2.4, -1.2, -3.6]);
comprobar('sin escardar, la cebada da lo de siempre (4 gavillas por cada 10 m²)', sd.s === der && sd.g === Math.floor((sd.antes + der) / C.M2_POR_GAVILLA + 1e-9), `${sd.s} m², ${sd.g} gavillas`);
comprobar('escardada, da 5 por cada 4 (cada m² cuenta 1,25)', si.s === izq && si.g === Math.floor((si.antes + izq * C.EXTRA_ESCARDA) / C.M2_POR_GAVILLA + 1e-9) && si.g > sd.g, `${si.s} m², ${si.g} gavillas (con ${si.antes} m² que sobraban)`);
comprobar('lo segado vuelve a estar sin escardar', !C.escardadoEn(campo, -2.4, -1));
const tiene = (t) => invs.de(A).cuantos(t);
mano(A, null);
H(A, { tipo: 'coger_planta', campo: campo.id, x: 3, z: 3.5, t: T });
comprobar('el haba sin escardar da 4', tiene('habas') === 4, String(tiene('habas')));
H(A, { tipo: 'coger_planta', campo: campo.id, x: -3, z: 3.5, t: T });
comprobar('la escardada, 5', tiene('habas') === 9, String(tiene('habas')));
r = H(A, { tipo: 'coger_planta', campo: campo.id, x: -2, z: 2, t: T });
comprobar('la col escardada da la col y 4 semillas (no 3)', r.ok && r.da.col === 1 && r.da.semilla_col === 4, JSON.stringify(r.da));

// rehecho y guardado
{
  const a = reproducir(reg.exportar()).exportar().campos[0], b = m.exportar().campos[0];
  const dif = Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === foto(m), dif.map(k => `${k}: ${String(JSON.stringify(a[k])).slice(0, 120)} / ${String(JSON.stringify(b[k])).slice(0, 120)}`).join(' · '));
}
const c2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar()))).campos[0];
comprobar('se guarda y se lee: lo escardado y la col que queda, igual', c2.escarda === campo.escarda && JSON.stringify(c2.plantas) === JSON.stringify(campo.plantas));

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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-escardar-'));
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
    await Ana.accion({ tipo: 'labrar', campo: c.id, x: 0, z: 0 });
    inv.lugares['mano:der'] = { tipo: 'semilla_cebada', n: 2 };
    const rs = await Ana.accion({ tipo: 'sembrar', campo: c.id, cultivo: 'cebada', x: 0, z: 0 });
    comprobar('Ana siembra la cebada en el servidor', rs.ok, rs.motivo || '');
    c.voleo.t = c.voleo.t.map(t => t - 2 * DIA);   // (verde: como si fuera de hace dos días)
    inv.lugares['mano:der'] = null;
    const lejos = await Ana.accion({ tipo: 'escardar', campo: c.id, x: 0, z: 4 });
    comprobar('a más de 3 m de donde está, no', !lejos.ok && lejos.motivo === 'Estás demasiado lejos.', lejos.motivo);
    const re = await Ana.accion({ tipo: 'escardar', campo: c.id, x: 0.2, z: 0.3, t: 5 });
    comprobar('con las manos vacías y cerca, escarda', re.ok && C.escardadoEn(c, 0.5, 0.5), re.motivo || '');
    const visto = await Bruno.esperar(m => m.tipo === 'accion' && m.entrada && m.entrada.tipo === 'escardar').catch(() => null);
    comprobar('Bruno lo ve (con la hora del servidor, no la del navegador)', visto && visto.entrada.autor === yo && visto.entrada.datos.t > 1e12);
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
