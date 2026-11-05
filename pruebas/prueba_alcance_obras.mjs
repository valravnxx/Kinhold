// El servidor no se fía del navegador en las obras (hito «Jugar entre dos sin trampas»): entregar, subir, trabajar y
// desmontar solo valen al alcance de la pieza y en su planta (o la de debajo), con la posición que tiene el servidor del
// jugador, no con lo que diga el navegador. Ejecutar: node pruebas/prueba_alcance_obras.mjs
// Comprueba la lógica pura (alAlcance, plantaDeAltura, fueraDeAlcance) y el servidor de verdad con un navegador
// tramposo: lejos de la obra no entrega, ni trabaja, ni desmonta; sin haber dicho dónde está, tampoco; desde el suelo no
// entrega a una obra de la planta de arriba aunque diga «desde: 1»; junto a la obra, todo sale.
// Con MUTAR=1 el servidor cree al jugador siempre junto a la obra (como si se fiara del navegador): debe FALLAR.
import { alAlcance, plantaDeAltura, ALCANCE_OBRA, centroMundo } from '../src/logica/construccion.js';
import { ALTURA } from '../src/logica/piezas.js';
import { fueraDeAlcance } from '../src/logica/acciones.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const LEJOS = 'Estás demasiado lejos: acércate.', PLANTA = 'No estás en su planta.';

console.log('La lógica pura');
{
  const c = { ox: 10, oz: 0, rot: 0, oy: 3, piezas: new Map() };
  const p0 = { hueco: 'f', i: 0, j: 0, k: 0 }, p1 = { hueco: 'f', i: 0, j: 0, k: 1 }, p2 = { hueco: 'f', i: 0, j: 0, k: 2 };
  const m = centroMundo(c, p0);
  comprobar('junto a la pieza, en su planta, llega', alAlcance(c, p0, m.x + 1, m.z, 0).ok);
  comprobar(`a más de ${ALCANCE_OBRA} m, no`, alAlcance(c, p0, m.x + ALCANCE_OBRA + 0.2, m.z, 0).motivo === LEJOS);
  comprobar('con holgura, sí', alAlcance(c, p0, m.x + ALCANCE_OBRA + 0.2, m.z, 0, 3).ok);
  comprobar('desde el suelo llega a la planta de encima', alAlcance(c, p1, m.x, m.z, 0).ok);
  comprobar('pero no a la de dos más arriba', alAlcance(c, p2, m.x, m.z, 0).motivo === PLANTA);
  comprobar('desde arriba no llega a lo de abajo (la demo)', alAlcance(c, p0, m.x, m.z, 1).motivo === PLANTA);
  comprobar('con una planta de margen hacia abajo (el servidor), sí', alAlcance(c, p0, m.x, m.z, 1, 0, 1).ok);
  comprobar('planta por la altura: en el suelo, 0', plantaDeAltura(c, 3.1) === 0 && plantaDeAltura(c, 2) === 0 && plantaDeAltura(c, 4.4) === 0);
  comprobar('sobre la planta 1, 1; sobre la 2, 2', plantaDeAltura(c, 3 + ALTURA + 0.1) === 1 && plantaDeAltura(c, 3 + 2 * ALTURA) === 2);
  // lo que mira el servidor (fueraDeAlcance), con un mundo de una construcción y una obra en la planta 1
  c.id = 7; c.piezas.set('f:0:0:1', p1);
  const M = { construcciones: [c] }, yArriba = 3 + ALTURA + 0.05;
  const F = (a, pos) => fueraDeAlcance(M, { construccion: 7, clave: 'f:0:0:1', ...a }, pos);
  const ent = { tipo: 'entregar', material: 'tabla', cantidad: 1 };
  comprobar('sin posición, no', /no sabe dónde/.test(F(ent, null)?.motivo || ''));
  comprobar('en el suelo junto a ella, diciendo «desde: 1», no entrega arriba', F({ ...ent, desde: 1 }, { x: m.x, y: 3, z: m.z })?.motivo === PLANTA);
  comprobar('en el suelo, «desde: 0», pasa (la lógica dirá que hay que subirlo)', F({ ...ent, desde: 0 }, { x: m.x, y: 3, z: m.z }) === null);
  comprobar('arriba de verdad, «desde: 1», pasa', F({ ...ent, desde: 1 }, { x: m.x, y: yArriba, z: m.z }) === null);
  comprobar('trabajar, subir y desmontar, igual de lejos: no', ['trabajar', 'subir', 'desmontar'].every(t => F({ tipo: t }, { x: m.x + 8, y: 3, z: m.z })?.motivo === LEJOS));
  comprobar('con 3 m de margen por el retraso: a 5 m, sí', F({ tipo: 'trabajar' }, { x: m.x + 5, y: 3, z: m.z }) === null);
  comprobar('las demás acciones no se miran aquí', F({ tipo: 'usar' }, null) === null && F({ tipo: 'colocar' }, null) === null);
}

const { crearServidor } = await import('../servidor/servidor.mjs');

console.log('El servidor de verdad: un navegador tramposo');
{
  const cliente = (puerto) => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond); if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.estar = (x, z, y = 0) => ws.send(JSON.stringify({ tipo: 'estado', x, y, z, giro: 0, anim: 'quieto' }));
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.recibidos.push(m); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-alcance-'));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  try {
    const puerto = await s.listo;
    const Ana = await cliente(puerto);
    // sin haber dicho dónde está, ni el mojón (que no mira esto) le hace falta
    await Ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
    const rm = await Ana.accion({ tipo: 'mojon', x: 0, z: 0 });
    const rc = await Ana.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 2, z: 0, k: 0, rot: 0, dir: 0 });
    comprobar('pone su mojón y un cimiento (en obras)', rm.ok && rc.ok, [rm, rc].map(r => r.ok ? 'ok' : r.motivo).join(', '));
    const c = s.mundo.construcciones[0], k = c && [...c.piezas.keys()][0], p = c && c.piezas.get(k);
    const centro = centroMundo(c, p);
    if (MUTAR) s.presencia.ultimo.get = () => ({ x: centro.x, y: 0, z: centro.z });
    const falta = s.mundo.faltaEntregar(p)[0];
    // de tres en tres (lo que cabe en las manos)
    const entrega = async () => {
      const f = s.mundo.faltaEntregar(c.piezas.get(k))[0]; if (!f) return { ok: true };
      await Ana.accion({ tipo: 'sacar_arcon', material: f.m, cantidad: Math.min(3, f.n) });
      return Ana.accion({ tipo: 'entregar', construccion: c.id, clave: k, material: f.m, cantidad: Math.min(3, f.n), desde: 0 });
    };

    const r0 = await entrega();
    comprobar('sin saber dónde está, no entrega', !r0.ok && /no sabe dónde/.test(r0.motivo || ''), r0.motivo || 'entregó');

    Ana.estar(centro.x + 12, centro.z);
    const r1 = await entrega();
    comprobar('a 12 m de la obra no entrega', !r1.ok && r1.motivo === LEJOS, r1.motivo || 'entregó');
    comprobar('y la obra sigue sin el material', s.mundo.faltaEntregar(c.piezas.get(k)).length > 0);

    Ana.estar(centro.x + 1, centro.z);
    let r2 = await entrega();
    comprobar('junto a la obra, sí', r2.ok, r2.motivo || '');
    for (let i = 0; i < 10 && r2.ok && s.mundo.faltaEntregar(c.piezas.get(k)).length; i++) r2 = await entrega();
    comprobar(`le lleva todo (${falta.n} ${falta.m})`, !s.mundo.faltaEntregar(c.piezas.get(k)).length, r2.motivo || '');

    Ana.estar(centro.x, centro.z + 12);
    const r3 = await Ana.accion({ tipo: 'trabajar', construccion: c.id, clave: k, segundos: 5 });
    comprobar('a 12 m no trabaja', !r3.ok && r3.motivo === LEJOS, r3.motivo || 'trabajó');
    Ana.estar(centro.x + 4.5, centro.z);   // 2,3 m de alcance y 3 de holgura por el retraso
    const r4 = await Ana.accion({ tipo: 'trabajar', construccion: c.id, clave: k, segundos: 5 });
    comprobar('a 4,5 m (con el margen del retraso) trabaja', r4.ok, r4.motivo || '');
    for (let i = 0; i < 200 && c.piezas.get(k)?.obra; i++) await Ana.accion({ tipo: 'trabajar', construccion: c.id, clave: k, segundos: 5 });
    comprobar('termina el cimiento', !!c.piezas.get(k) && !c.piezas.get(k).obra);

    Ana.estar(centro.x + 12, centro.z);
    const r7 = await Ana.accion({ tipo: 'desmontar', construccion: c.id, clave: k });
    comprobar('a 12 m no desmonta', !r7.ok && r7.motivo === LEJOS && c.piezas.has(k), r7.motivo || 'desmontó');
    Ana.estar(centro.x + 1, centro.z);
    const r8 = await Ana.accion({ tipo: 'desmontar', construccion: c.id, clave: k });
    comprobar('junto a él, sí', r8.ok, r8.motivo || '');
    const e = await Ana.accion({ tipo: 'trabajar', construccion: c.id, clave: 'x:9:9:9', segundos: 1 });   // (la construcción, ya sin piezas, puede no existir)
    comprobar('lo que no existe lo dice la acción misma', !e.ok && e.motivo === 'No existe.', e.motivo);
    Ana.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
