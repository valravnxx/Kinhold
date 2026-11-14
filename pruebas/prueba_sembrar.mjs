// Sembrar y crecer (P11, la granja básica). Ejecutar: node pruebas/prueba_sembrar.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/campos.js, src/logica/acciones.js): con las
// semillas en la mano y sobre lo labrado, la cebada a voleo siembra un círculo de 2 m (las casillas labradas sin sembrar)
// y gasta 1 puñado cada 10 m²; las habas, la col y el nabo, planta a planta, a su distancia y 1 semilla cada una; sin
// semillas en la mano, fuera de lo labrado, en tierra ajena o encima de lo sembrado, no; crece por fases (brote, verde,
// espiga o cabeza, maduro) en una semana; lo sembrado no vuelve a ser hierba; rehecho desde el registro y guardado y
// leído, igual; y el servidor de verdad pone la hora, mira que estés cerca y lo reparte a los demás.
// Con MUTAR=1 la cebada a voleo cae también encima de lo plantado: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import * as C from '../src/logica/campos.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

if (process.env.MUTAR === '1') globalThis.__mutarSembrar = true;
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

// planta a planta
mano(A, null);
let r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 3.2, z: 3.2, t: T0 });
comprobar('sin las habas en la mano, no', !r.ok && r.motivo === 'Necesitas las semillas en la mano para sembrar.', r.motivo);
mano(A, 'habas', 5);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 3.2, z: 3.2, t: T0 });
comprobar('con las habas en la mano, se planta una (y gasta una)', r.ok && campo.plantas.length === 1 && invs.de(A).cuantos('habas') === 4, JSON.stringify(r));
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 3.4, z: 3.2, t: T0 });
comprobar('demasiado cerca de otra, no (y no gasta)', !r.ok && r.motivo === 'Demasiado cerca de otra planta.' && invs.de(A).cuantos('habas') === 4, r.motivo);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 3.6, z: 3.2, t: T0 });
comprobar('a su distancia, sí', r.ok && campo.plantas.length === 2, r.motivo || '');
mano(A, 'semilla_col', 3);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: 3.2, z: 2.8, t: T0 });
comprobar('la col pide más sitio que las habas', !r.ok && r.motivo === 'Demasiado cerca de otra planta.', r.motivo);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: 3.2, z: 2.4, t: T0 });
comprobar('y a su distancia, sí', r.ok && campo.plantas.length === 3, r.motivo || '');
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'nabo', x: 2, z: 2, t: T0 });
comprobar('con la col en la mano no se siembra nabo', !r.ok && r.motivo === 'Necesitas las semillas en la mano para sembrar.', r.motivo);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'col', x: 7, z: 0, t: T0 });
comprobar('fuera del linde, no', !r.ok && /Fuera del campo/.test(r.motivo), r.motivo);

// a voleo
mano(A, 'semilla_cebada', 2);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: 0, z: 0, t: T0 + DIA });
comprobar('la cebada a voleo siembra un círculo de 2 m (12 casillas) y gasta 1 puñado', r.ok && r.nuevas === 12 && r.punados === 1 && invs.de(A).cuantos('semilla_cebada') === 1, JSON.stringify(r));
comprobar('y se sabe cuándo se sembró cada casilla', C.voleoEn(campo, 0.5, 0.5) === T0 + DIA && C.voleoEn(campo, 3.5, 3.5) === null);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: 0, z: 0, t: T0 + DIA });
comprobar('donde ya está sembrado, no', !r.ok && r.motivo === 'Ahí no queda tierra labrada sin sembrar.', r.motivo);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: 3.2, z: 3, t: T0 + DIA });
comprobar('la cebada no cae encima de lo plantado', r.ok && C.voleoEn(campo, 3.5, 3.5) === null && C.voleoEn(campo, 3.5, 2.5) === null && C.voleoEn(campo, 1.5, 3.5) !== null, JSON.stringify(r));
mano(A, 'habas', 4);
r = H(A, { tipo: 'sembrar', campo: campo.id, cultivo: 'habas', x: 0.5, z: 0.5, t: T0 });
comprobar('tampoco se planta encima de la cebada', !r.ok && r.motivo === 'Ahí ya está sembrado.', r.motivo);
mano(A, 'semilla_cebada', 1);
invs.de(B).lugares['mano:der'] = { tipo: 'semilla_cebada', n: 3 };
r = H(B, { tipo: 'sembrar', campo: campo.id, cultivo: 'cebada', x: -3, z: -3, t: T0 });
comprobar('en tierra ajena, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);

// crecer: las fases en una semana
const t = T0 + DIA;
comprobar('recién sembrado, brote', C.fase(t, t + 1000) === 0);
comprobar('al segundo día, verde', C.fase(t, t + 2 * DIA) === 1);
comprobar('al quinto día, espiga (o cabeza)', C.fase(t, t + 5 * DIA) === 2 && C.nombreFase('col', 2) === 'cabeza' && C.nombreFase('cebada', 2) === 'espiga');
comprobar('a la semana, maduro', C.fase(t, t + 7 * DIA) === 3 && C.siguienteCambio(t, t + 7 * DIA) === Infinity);
comprobar('lo sembrado no vuelve a ser hierba (pasado el barbecho)', C.labradoEn(campo, 0.5, 0.5, T0 + C.PLAZO_BARBECHO + 10 * DIA));

// rehecho desde el registro y guardado: igual
comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === foto(m));
const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
const c2 = m2.campos[0];
comprobar('se guarda y se lee: lo sembrado sigue igual', c2.plantas.length === campo.plantas.length && C.voleoEn(c2, 0.5, 0.5) === T0 + DIA && C.casillasVoleo(c2).length === C.casillasVoleo(campo).length);

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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-sembrar-'));
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
    const lejos = await Ana.accion({ tipo: 'sembrar', campo: c.id, cultivo: 'cebada', x: 0, z: 4 });
    comprobar('a más de 3 m de donde está, no', !lejos.ok && lejos.motivo === 'Estás demasiado lejos.', lejos.motivo);
    const antes = Date.now();
    const rs = await Ana.accion({ tipo: 'sembrar', campo: c.id, cultivo: 'cebada', x: 0, z: 0, t: 5 });
    comprobar('con la cebada en la mano y cerca, siembra', rs.ok && C.voleoEn(c, 0.5, 0.5) !== null, rs.motivo || '');
    comprobar('la hora la pone el servidor (no la que manda el navegador)', C.voleoEn(c, 0.5, 0.5) >= antes && C.voleoEn(c, 0.5, 0.5) <= Date.now());
    const visto = await Bruno.esperar(m => m.tipo === 'accion' && m.entrada && m.entrada.tipo === 'sembrar').catch(() => null);
    comprobar('Bruno lo ve (con la hora del servidor)', visto && visto.entrada.autor === yo && visto.entrada.datos.t === C.voleoEn(c, 0.5, 0.5));
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
