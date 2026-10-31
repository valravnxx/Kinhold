// Prueba de «las obras cobran de lo que llevas también en línea» (servidor/servidor.mjs, src/logica/acciones.js y
// src/logica/en_linea.js), con dos clientes de verdad por websocket.
// Ejecutar: node pruebas/prueba_obras_en_linea.mjs
// Comprueba: con las manos vacías no se entrega nada a una obra (aunque el navegador diga «lleva: true»); el arcón de
// materiales va por el servidor (sacar_arcon mete el material en lo que llevas en el servidor y saca del arcón);
// entregar gasta lo que llevas en el servidor y la entrada que se reparte va ya pagada, con la cantidad de verdad; al
// autor le llega lo que lleva tal como queda; el otro navegador (MundoEnLinea, con las entradas que reparte) rehace la
// obra y el arcón igual que el servidor; el adelanto del navegador cobra de lo que llevas; dejar_arcon devuelve al
// arcón; y al volver a arrancar el servidor, el mundo (obra y arcón) y lo que llevas siguen igual.
// Con MUTAR=1 el servidor ejecuta las obras sin los inventarios (cobran del montón común): debe FALLAR.
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
  const mutada = fuente.replace('usaInventario ? objetos.invs : null', 'null');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_obras.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);
const { MundoEnLinea } = await import(pathToFileURL(join(raiz, 'src/logica/en_linea.js')).href);
const { Inventario } = await import(pathToFileURL(join(raiz, 'src/logica/inventario.js')).href);

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    // el navegador: el mundo en línea con su adelanto, y lo que llevas tal como lo manda el servidor
    c.inv = null;
    c.red = new MundoEnLinea((m) => ws.send(JSON.stringify(m)));
    Object.defineProperty(c.red, 'invs', { get: () => (c.inv ? { de: () => c.inv } : null) });
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => {
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.objeto = (accion) => { const id = ++c.id + 100000; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    // una acción mandada tal cual (sin adelanto), con su resultado
    // (las de las obras esperan también lo que llevas, que el servidor manda justo detrás)
    c.accion = (accion) => {
      const id = ++c.id + 200000;
      const p = c.esperar(m => m.tipo === 'resultado' && m.id === id);
      const usa = ['entregar', 'subir', 'sacar_arcon', 'dejar_arcon'].includes(accion.tipo);
      const q = usa ? c.esperar(m => m.tipo === 'inventario') : null;
      ws.send(JSON.stringify({ tipo: 'accion', id, accion }));
      return q ? Promise.all([p, q]).then(([r]) => r) : p;
    };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.recibidos.push(m);
      if (m.tipo === 'bienvenida' || m.tipo === 'inventario') { const datos = m.inventario; if (datos) { if (!c.inv) c.inv = Inventario.importarJugador(datos); else { const n = Inventario.importarJugador(datos); c.inv.lugares = n.lugares; c.inv.apartado = n.apartado; } } }
      if (['bienvenida', 'resultado', 'accion'].includes(m.tipo)) c.red.recibir(m);
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    const b = c.esperar(m => m.tipo === 'bienvenida');
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const obraDe = (mundo, id, clave) => { const c = mundo.construcciones.find(x => x.id === id); const p = c && c.piezas.get(clave); return p && p.obra; };
const huella = (mundo, id, clave) => JSON.stringify({ entregado: obraDe(mundo, id, clave)?.entregado || null, materiales: mundo.materiales });

const dir = mkdtempSync(join(tmpdir(), 'kinhold-obras-'));
const archivo = join(dir, 'mundo.jsonl');
try {
  let s = crearServidor({ puerto: 0, archivo });
  let puerto = await s.listo;
  const a = await cliente(puerto), b = await cliente(puerto);
  const yoA = a.bienvenida.autor;

  console.log('Una obra en el mundo');
  let r = await a.accion({ tipo: 'mojon', x: 0, z: 0 });
  const vColocar = b.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'colocar');
  r = await a.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  comprobar('se pone el marco de un cimiento', r.ok, r.motivo);
  await vColocar;
  const c = s.mundo.construcciones[0], id = c.id, clave = [...c.piezas.keys()][0];
  const arcon0 = s.mundo.materiales.piedra;

  console.log('Con las manos vacías no se entrega nada');
  r = await a.accion({ tipo: 'entregar', construccion: id, clave, material: 'piedra', cantidad: 4 });
  comprobar('el servidor la rechaza', !r.ok && !obraDe(s.mundo, id, clave).entregado.piedra && s.mundo.materiales.piedra === arcon0, r.motivo);
  r = await a.accion({ tipo: 'entregar', construccion: id, clave, material: 'piedra', cantidad: 4, lleva: true });
  comprobar('aunque el navegador diga que ya va pagada («lleva: true»)', !r.ok && !obraDe(s.mundo, id, clave).entregado.piedra, r.motivo);
  const pred = a.red.accion({ tipo: 'entregar', construccion: id, clave, material: 'piedra', cantidad: 4 });
  comprobar('y el navegador ni la manda: no llevas ese material', !pred.ok && pred.faltan, pred.motivo);

  console.log('El arcón de materiales va por el servidor');
  const vSacar = b.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'sacar_arcon');
  r = await a.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 6 });
  comprobar('sacar 6 piedras del arcón', r.ok && s.mundo.materiales.piedra === arcon0 - 6, r.motivo);
  comprobar('van a lo que llevas en el servidor', s.objetos.invs.de(yoA).cuantos('piedra') === 6, String(s.objetos.invs.de(yoA).cuantos('piedra')));
  comprobar('y al navegador le llega lo que lleva', a.inv.cuantos('piedra') === 6);
  await vSacar;
  comprobar('el otro navegador ve el arcón igual', b.red.mundo.materiales.piedra === s.mundo.materiales.piedra, `${b.red.mundo.materiales.piedra} y ${s.mundo.materiales.piedra}`);

  console.log('Entregar cobra de lo que llevas en el servidor');
  const vEnt = b.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'entregar');
  r = await a.accion({ tipo: 'entregar', construccion: id, clave, material: 'piedra', cantidad: 8 });
  const ent = await vEnt;
  comprobar('se entregan las 6 que lleva (de 8 que faltan)', r.ok && obraDe(s.mundo, id, clave).entregado.piedra === 6, r.motivo);
  comprobar('lo que lleva en el servidor queda sin piedras', s.objetos.invs.de(yoA).cuantos('piedra') === 0);
  comprobar('el arcón no cambia', s.mundo.materiales.piedra === arcon0 - 6, String(s.mundo.materiales.piedra));
  comprobar('la entrada que se reparte va ya pagada, con la cantidad de verdad', ent.entrada.datos.lleva === true && ent.entrada.datos.cantidad === 6, JSON.stringify(ent.entrada.datos));
  comprobar('el otro navegador rehace la obra y el arcón igual que el servidor', huella(b.red.mundo, id, clave) === huella(s.mundo, id, clave), huella(b.red.mundo, id, clave));
  await pausa(100);
  comprobar('y el propio también', huella(a.red.mundo, id, clave) === huella(s.mundo, id, clave));

  console.log('El adelanto del navegador cobra de lo que llevas');
  r = await a.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 2 });
  const vAdel = a.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'entregar' && m.entrada.datos.cantidad === 2);
  const adel = a.red.accion({ tipo: 'entregar', construccion: id, clave, material: 'piedra', cantidad: 2 });
  comprobar('se adelanta y lo que llevas baja ya', adel.ok && a.inv.cuantos('piedra') === 0 && obraDe(a.red.mundo, id, clave).entregado.piedra === 8, JSON.stringify(adel));
  await vAdel;
  await pausa(100);
  comprobar('el servidor la acepta y cobra de lo suyo', obraDe(s.mundo, id, clave).entregado.piedra === 8 && s.objetos.invs.de(yoA).cuantos('piedra') === 0 && !a.red.pendientes.length);
  comprobar('los tres mundos cuadran', huella(a.red.mundo, id, clave) === huella(s.mundo, id, clave) && huella(b.red.mundo, id, clave) === huella(s.mundo, id, clave));

  console.log('Dejar en el arcón');
  r = await a.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  const ruta = Object.entries(a.inv.lugares).find(([, v]) => v && v.tipo === 'piedra')?.[0];
  const vDej = b.esperar(m => m.tipo === 'accion' && m.entrada.tipo === 'dejar_arcon');
  r = await a.accion({ tipo: 'dejar_arcon', de: ruta, cantidad: 3 });
  const dej = await vDej;
  comprobar('vuelve al arcón lo que llevaba en esa mano', r.ok && s.mundo.materiales.piedra === arcon0 - 8 - 3 + dej.entrada.datos.cantidad && dej.entrada.datos.material === 'piedra', JSON.stringify(dej.entrada.datos));
  comprobar('y el otro navegador lo ve igual', huella(b.red.mundo, id, clave) === huella(s.mundo, id, clave));

  console.log('Al volver a arrancar el servidor');
  const antes = huella(s.mundo, id, clave), llevaba = JSON.stringify(s.objetos.inventarioDe(yoA));
  a.ws.close(); b.ws.close();
  await new Promise(r => s.wss.close(r));
  s = crearServidor({ puerto: 0, archivo });
  puerto = await s.listo;
  comprobar('la obra y el arcón quedan igual', huella(s.mundo, id, clave) === antes, huella(s.mundo, id, clave));
  comprobar('lo que lleva cada uno, también', JSON.stringify(s.objetos.inventarioDe(yoA)) === llevaba);
  const n = await cliente(puerto);
  comprobar('un navegador nuevo rehace el mismo mundo con la bienvenida', huella(n.red.mundo, id, clave) === antes);
  n.ws.close();
  await new Promise(r => s.wss.close(r));
} catch (e) {
  mal++; console.log('  FALLA ' + (e && e.stack || e));
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
