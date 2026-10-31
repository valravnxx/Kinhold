// Prueba del inventario y el suelo en el servidor (src/logica/objetos_red.js y servidor/servidor.mjs), con dos clientes
// de verdad por websocket.
// Ejecutar: node pruebas/prueba_objetos_servidor.mjs
// Comprueba: la bienvenida lleva lo que llevas y el suelo; soltar al suelo lo quita de tu inventario y lo ven los
// dos; el otro lo coge y pasa a su inventario; el autor lo pone el servidor (no se puede soltar lo de otro); el sitio
// es el de la presencia (no se coge desde lejos diciendo que estás al lado); no se mete nada de la nada ('coger') ni se
// hace desaparecer ('soltar'); lo que se reordena (mover, ponerse, quitarse) va al inventario del autor; y al volver a
// arrancar el servidor, los inventarios y el suelo siguen igual (y el jugador que vuelve con su ficha, con lo suyo).
// Con MUTAR=1 se prueba un servidor que se fía del autor que manda el cliente: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('Object.assign({}, msg.accion, { autor })', 'Object.assign({ autor }, msg.accion)');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_objetos.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto, ficha) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '?ficha=' + ficha : ''}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 2000) => new Promise((r, f) => {
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.ultimo = (tipo) => { for (let i = c.recibidos.length - 1; i >= 0; i--) if (c.recibidos[i].tipo === tipo) return c.recibidos[i]; return null; };
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    const b = c.esperar(m => m.tipo === 'bienvenida');
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const lugar = (inv, l) => inv && inv.lugares && inv.lugares[l];
const tiene = (inv, tipo) => JSON.stringify(inv).includes(`"tipo":"${tipo}"`);

const dir = mkdtempSync(join(tmpdir(), 'kinhold-objetos-'));
const archivo = join(dir, 'mundo.jsonl');
try {
  let s = crearServidor({ puerto: 0, archivo });
  let puerto = await s.listo;
  const a = await cliente(puerto), b = await cliente(puerto);
  const yoA = a.bienvenida.autor, yoB = b.bienvenida.autor;

  console.log('Bienvenida');
  comprobar('lleva el inventario del jugador', lugar(a.bienvenida.inventario, 'ropa:interior')?.tipo === 'camisa_lino', JSON.stringify(lugar(a.bienvenida.inventario, 'ropa:interior')));
  comprobar('y el suelo (vacío al empezar)', Array.isArray(a.bienvenida.suelo) && a.bienvenida.suelo.length === 0);

  console.log('Sin presencia, nada que dependa del sitio');
  let r = await a.objeto({ tipo: 'soltar_suelo', de: 'ropa:interior', x: 0, z: 0 });
  comprobar('soltar sin que el servidor sepa dónde estás se rechaza', !r.ok, r.motivo);

  a.estar(0, 0); b.estar(1, 0); await pausa(150);
  console.log('Soltar al suelo');
  const sueloB = b.esperar(m => m.tipo === 'suelo');
  const invA = a.esperar(m => m.tipo === 'inventario');
  r = await a.objeto({ tipo: 'soltar_suelo', de: 'ropa:interior', x: 0.2, z: 0 });
  comprobar('A suelta su camisa', r.ok, r.motivo);
  const ia = await invA, sb = await sueloB;
  comprobar('A recibe su inventario sin la camisa', !lugar(ia.inventario, 'ropa:interior'));
  comprobar('B ve la camisa en el suelo', sb.objetos.length === 1 && sb.objetos[0].cosa.tipo === 'camisa_lino' && sb.objetos[0].autor === yoA, JSON.stringify(sb.objetos[0]));
  comprobar('B no recibe el inventario de A', !b.recibidos.some(m => m.tipo === 'inventario'));

  console.log('El autor lo pone el servidor');
  r = await b.objeto({ autor: yoA, tipo: 'soltar_suelo', de: 'ropa:piernas', x: 1, z: 0 });
  comprobar('B diciendo que es A suelta lo suyo, no lo de A', r.ok && s.objetos.inventarioDe(yoA).lugares['ropa:piernas'] && !s.objetos.inventarioDe(yoB).lugares['ropa:piernas'], r.motivo);

  console.log('El sitio es el de la presencia');
  const id = s.objetos.sueloVisible(Date.now()).find(o => o.cosa.tipo === 'camisa_lino').id;
  b.estar(40, 0); await pausa(150);
  r = await b.objeto({ tipo: 'coger_suelo', objeto: id, x: 0.5, z: 0 });
  comprobar('B lejos, diciendo que está al lado, no la coge', !r.ok, r.motivo);
  b.estar(1, 0); await pausa(150);
  r = await b.objeto({ tipo: 'coger_suelo', objeto: id, x: 1, z: 0 });
  comprobar('B al lado sí la coge', r.ok, r.motivo);
  comprobar('la camisa está en lo que lleva B', tiene(s.objetos.inventarioDe(yoB), 'camisa_lino') && !tiene(s.objetos.inventarioDe(yoA), 'camisa_lino'));
  r = await a.objeto({ tipo: 'coger_suelo', objeto: id, x: 0, z: 0 });
  comprobar('ya no está para A', !r.ok, r.motivo);

  console.log('Nada de la nada');
  r = await a.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  comprobar("'coger' (meter algo de la nada) se rechaza", !r.ok && !tiene(s.objetos.inventarioDe(yoA), 'hacha_hierro'), r.motivo);
  r = await a.objeto({ tipo: 'soltar', de: 'ropa:piernas' });
  comprobar("'soltar' (hacerlo desaparecer) se rechaza", !r.ok && lugar(s.objetos.inventarioDe(yoA), 'ropa:piernas'), r.motivo);
  r = await a.objeto({ tipo: 'nada' });
  comprobar('una acción desconocida se rechaza', !r.ok, r.motivo);

  console.log('Reordenar lo que llevas');
  const ruta2 = Object.keys(s.objetos.inventarioDe(yoB).lugares).find(l => s.objetos.inventarioDe(yoB).lugares[l]?.tipo === 'camisa_lino');
  r = await b.objeto({ tipo: 'quitarse', lugar: 'ropa:interior', a: 'mano:izq' });
  comprobar('B se quita su camisa a la mano izquierda', r.ok && lugar(s.objetos.inventarioDe(yoB), 'mano:izq')?.tipo === 'camisa_lino', r.motivo);
  r = await b.objeto({ tipo: 'ponerse', de: ruta2 });
  comprobar('y se pone la que ha cogido', r.ok && lugar(s.objetos.inventarioDe(yoB), 'ropa:interior')?.tipo === 'camisa_lino' && !lugar(s.objetos.inventarioDe(yoB), ruta2), `${ruta2} · ${r.motivo || ''}`);
  r = await b.objeto({ tipo: 'mover', de: 'mano:izq', a: 'mano:der' });
  comprobar('y pasa la suya a la otra mano', r.ok && lugar(s.objetos.inventarioDe(yoB), 'mano:der')?.tipo === 'camisa_lino' && !lugar(s.objetos.inventarioDe(yoB), 'mano:izq'), r.motivo);
  comprobar('lo de A no cambia', !lugar(s.objetos.inventarioDe(yoA), 'ropa:interior') && !lugar(s.objetos.inventarioDe(yoA), 'mano:der'));

  console.log('Mensajes raros');
  a.ws.send(JSON.stringify({ tipo: 'objeto', id: 99, accion: [1, 2] }));
  a.ws.send(JSON.stringify({ tipo: 'objeto', id: 98, accion: { tipo: 'mover', de: { x: 1 }, a: null } }));
  await pausa(150);
  comprobar('no tumban el servidor', (await a.objeto({ tipo: 'mover', de: 'mano:der', a: 'mano:izq' })).ok === false);

  const fichaB = b.bienvenida.ficha;
  const foto = JSON.stringify(s.objetos.exportar());
  a.ws.close(); b.ws.close(); await pausa(100);
  await s.cerrar();
  const auditoria = readFileSync(join(dir, 'objetos.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('cada acción queda en el registro, bien o mal, con su autor', auditoria.length >= 10 && auditoria.every(e => e.autor === yoA || e.autor === yoB), `${auditoria.length} entradas`);

  console.log('Al volver a arrancar');
  s = crearServidor({ puerto: 0, archivo });
  puerto = await s.listo;
  comprobar('los inventarios y el suelo siguen igual', JSON.stringify(s.objetos.exportar()) === foto);
  const b2 = await cliente(puerto, fichaB);
  comprobar('B vuelve con su ficha y lleva lo suyo', b2.bienvenida.autor === yoB && lugar(b2.bienvenida.inventario, 'mano:der')?.tipo === 'camisa_lino' && lugar(b2.bienvenida.inventario, 'ropa:interior')?.tipo === 'camisa_lino');
  comprobar('y ve en el suelo los pantalones que soltó', b2.bienvenida.suelo.some(o => o.cosa.tipo === 'pantalon_lino' && o.autor === yoB));
  b2.ws.close(); await pausa(50);
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA', e.stack || e);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
