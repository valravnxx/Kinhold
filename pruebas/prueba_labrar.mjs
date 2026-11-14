// Labrar con la azada (P11, la granja básica). Ejecutar: node pruebas/prueba_labrar.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/campos.js, src/logica/acciones.js): con la azada
// en la mano, cada pasada voltea un círculo de 1,2 m (las casillas de 1 m cuyo centro cae dentro) solo dentro del linde
// de un campo cerrado; sin azada, fuera del linde, en un campo abierto, en tierra ajena o donde queda algo por limpiar,
// no; lo ya labrado no se vuelve a labrar; pasado el plazo sin sembrar, vuelve a ser hierba (y se puede labrar otra vez);
// labrado, las estacas ya no se mueven; rehecho desde el registro y guardado y leído, igual; y el servidor de verdad pone
// la hora, mira que estés cerca y lo reparte a los demás.
// Con MUTAR=1 se labra también fuera del linde: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import * as C from '../src/logica/campos.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana', B = 'jugador:bruno';
const foto = (m) => JSON.stringify(m.exportar());
const T0 = 1e12;

ponerZonas(null);
const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
const H = (autor, a) => ejecutar(m, reg, { autor, ...a }, invs);
ejecutar(m, reg, { autor: A, tipo: 'mojon', x: 0, z: 0 });
ejecutar(m, reg, { autor: B, tipo: 'mojon', x: 200, z: 0 });
// el campo de Ana: 10 × 10 m
for (const [x, z] of [[-5, -5], [5, -5], [5, 5], [-5, 5], [-4.5, -4.5]]) { if (!invs.de(A).cuantos('estaca')) invs.de(A).meterDonde('estaca', 1); H(A, { tipo: 'estaca', x, z }); }
const campo = m.campos[0];
comprobar('el campo de Ana, cerrado (100 m²)', campo && campo.cerrado && campo.area === 100);
if (MUTAR) campo.puntos = [{ x: -50, z: -50 }, { x: 50, z: -50 }, { x: 50, z: 50 }, { x: -50, z: 50 }];   // el linde, mucho más grande que el campo

let r = H(A, { tipo: 'labrar', campo: campo.id, x: 0, z: 0, t: T0 });
comprobar('sin la azada en la mano, no', !r.ok && r.motivo === 'Necesitas la azada en la mano para labrar.', r.motivo);
invs.de(A).lugares['mano:der'] = { tipo: 'azada', n: 1 };
r = H(A, { tipo: 'labrar', campo: campo.id, x: 0, z: 0, t: T0 });
comprobar('con la azada, una pasada voltea un círculo de 1,2 m (4 casillas de 1 m)', r.ok && r.nuevas === 4 && r.labradas === 4, JSON.stringify(r));
comprobar('y se sabe qué está labrado', C.labradoEn(campo, 0.5, 0.5, T0) && C.labradoEn(campo, -0.5, -0.5, T0) && !C.labradoEn(campo, 2.5, 0.5, T0) && C.labradoAqui(m, 0.2, 0.2, T0));
r = H(A, { tipo: 'labrar', campo: campo.id, x: 0, z: 0, t: T0 + 1000 });
comprobar('lo ya labrado no se vuelve a labrar', !r.ok && r.motivo === 'Ahí ya está labrado.', r.motivo);
let antes = foto(m);
r = H(A, { tipo: 'labrar', campo: campo.id, x: 8, z: 0, t: T0 });
comprobar('fuera del linde, no (y no cambia nada)', !r.ok && /Fuera del campo/.test(r.motivo) && foto(m) === antes, r.motivo);
r = H(A, { tipo: 'labrar', campo: campo.id, x: 4.6, z: 0, t: T0 + 2000 });
comprobar('junto al linde, solo lo de dentro', r.ok && C.labradoEn(campo, 4.5, 0.5, T0 + 2000) && !C.labradoEn(campo, 5.5, 0.5, T0 + 2000), JSON.stringify(r));
invs.de(B).lugares['mano:der'] = { tipo: 'azada', n: 1 };
r = H(B, { tipo: 'labrar', campo: campo.id, x: -3, z: -3, t: T0 });
comprobar('en tierra ajena, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
m.entorno = { estorbo: (x) => x < -2 };   // el entorno: algo por limpiar al oeste
r = H(A, { tipo: 'labrar', campo: campo.id, x: -3, z: 0, t: T0 + 3000 });
comprobar('donde queda algo por limpiar, no', !r.ok && /Antes limpia/.test(r.motivo), r.motivo);
m.entorno = null;
invs.de(A).lugares['mano:izq'] = { tipo: 'estaca', n: 1 };
r = H(A, { tipo: 'estaca', x: 30, z: 30 });   // un campo abierto (una sola estaca)
const abierto = m.campos.find(c => !c.cerrado);
r = H(A, { tipo: 'labrar', campo: abierto ? abierto.id : -1, x: 30, z: 30, t: T0 });
comprobar('en un campo sin cerrar, no', !r.ok && r.motivo === 'Aquí no hay ningún campo cerrado.', r.motivo);
r = H(A, { tipo: 'quitar_estaca', campo: campo.id, i: 0 });
comprobar('labrado, sus estacas ya no se mueven', !r.ok && /ya está labrado/.test(r.motivo), r.motivo);

// rehecho desde el registro y guardado: igual (también los bits)
comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === foto(m));
const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
comprobar('se guarda y se lee: lo labrado sigue labrado', C.labradoEn(m2.campos[0], 0.5, 0.5, T0 + 5000) && !C.labradoEn(m2.campos[0], 2.5, 2.5, T0 + 5000));
comprobar('las casillas labradas, de una en una', C.casillasLabradas(campo, T0 + 5000).length === r.labradas || C.casillasLabradas(campo, T0 + 5000).length >= 6);

// el barbecho: pasado el plazo sin sembrar, vuelve a ser hierba
const tarde = T0 + 2000 + C.PLAZO_BARBECHO + 1;
comprobar('pasado el plazo sin sembrar, vuelve a ser hierba', !C.labradoEn(campo, 0.5, 0.5, tarde) && C.casillasLabradas(campo, tarde).length === 0);
r = H(A, { tipo: 'labrar', campo: campo.id, x: 0, z: 0, t: tarde });
comprobar('y se puede volver a labrar (lo de antes ya no cuenta)', r.ok && r.nuevas === 4 && r.labradas === 4, JSON.stringify(r));

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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-labrar-'));
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
    comprobar('Ana cierra su campo en el servidor', c && c.cerrado, JSON.stringify(c));
    inv.lugares['mano:der'] = { tipo: 'azada', n: 1 };
    Ana.estar(0, -2); await espera(150);
    const lejos = await Ana.accion({ tipo: 'labrar', campo: c.id, x: 0, z: 4 });
    comprobar('donde apunta, a más de 3 m de donde está, no', !lejos.ok && lejos.motivo === 'Estás demasiado lejos.', lejos.motivo);
    const antes = Date.now();
    const rl = await Ana.accion({ tipo: 'labrar', campo: c.id, x: 0, z: 0, t: 5 });
    comprobar('con la azada y cerca, labra', rl.ok && C.labradoEn(c, 0.5, 0.5, Date.now()), rl.motivo || '');
    comprobar('la hora la pone el servidor (no la que manda el navegador)', c.labradoEn >= antes && c.labradoEn <= Date.now());
    const visto = await Bruno.esperar(m => m.tipo === 'accion' && m.entrada && m.entrada.tipo === 'labrar').catch(() => null);
    comprobar('Bruno lo ve (con la hora del servidor)', visto && visto.entrada.autor === yo && visto.entrada.datos.t === c.labradoEn);
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
