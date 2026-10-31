// Prueba del inventario y el suelo en el servidor (src/logica/objetos_red.js y servidor/servidor.mjs), con dos clientes
// de verdad por websocket.
// Ejecutar: node pruebas/prueba_objetos_servidor.mjs
// Comprueba: la bienvenida lleva lo que llevas y el suelo; soltar al suelo lo quita de tu inventario y lo ven los
// dos; el otro lo coge y pasa a su inventario; el autor lo pone el servidor (no se puede soltar lo de otro); el sitio
// es el de la presencia (no se coge desde lejos diciendo que estás al lado); 'coger' y 'soltar' solo con el arcón de
// pruebas (sin él no se mete nada de la nada ni se hace desaparecer); lo que se reordena (mover, ponerse, quitarse) va
// al inventario del autor; talar (el árbol que dice el navegador vale si su nombre cuadra con su sitio y estás al lado),
// lo que deja en el suelo y el tocón lo ven los dos; trocear lo del suelo; recoger va a lo que llevas y el punto se
// agota para los dos; y al volver a arrancar el servidor, los inventarios, el suelo, lo talado y lo recogido siguen
// igual (y el jugador que vuelve con su ficha, con lo suyo).
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
const { ObjetosServidor } = await import(pathToFileURL(join(raiz, 'src/logica/objetos_red.js')).href);
const { idArbol } = await import(pathToFileURL(join(raiz, 'src/logica/tala.js')).href);

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

  console.log('El arcón de pruebas');
  {
    const sin = new ObjetosServidor({ posicion: () => ({ x: 0, z: 0 }) });
    const r1 = sin.ejecutar({ autor: yoA, tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' }, Date.now());
    const r2 = sin.ejecutar({ autor: yoA, tipo: 'soltar', de: 'ropa:piernas' }, Date.now());
    comprobar("sin arcón de pruebas, 'coger' (meter algo de la nada) y 'soltar' (hacerlo desaparecer) se rechazan",
      !r1.ok && !r2.ok && !tiene(sin.inventarioDe(yoA), 'hacha_hierro') && lugar(sin.inventarioDe(yoA), 'ropa:piernas'), `${r1.motivo} · ${r2.motivo}`);
  }
  r = await a.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  comprobar('con él (el servidor de pruebas), A coge un hacha del arcón', r.ok && lugar(s.objetos.inventarioDe(yoA), 'mano:der')?.tipo === 'hacha_hierro', r.motivo);
  const invMal = a.esperar(m => m.tipo === 'inventario');
  r = await a.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  comprobar('y no otra donde ya lleva algo', !r.ok, r.motivo);
  const msgInv = await invMal;
  comprobar('aunque salga mal, le llega lo que lleva (para deshacer lo adelantado)', lugar(msgInv.inventario, 'mano:der')?.tipo === 'hacha_hierro');
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
  comprobar('lo de A no cambia', !lugar(s.objetos.inventarioDe(yoA), 'ropa:interior') && lugar(s.objetos.inventarioDe(yoA), 'mano:der')?.tipo === 'hacha_hierro');

  console.log('Mensajes raros');
  a.ws.send(JSON.stringify({ tipo: 'objeto', id: 99, accion: [1, 2] }));
  a.ws.send(JSON.stringify({ tipo: 'objeto', id: 98, accion: { tipo: 'mover', de: { x: 1 }, a: null } }));
  await pausa(150);
  comprobar('no tumban el servidor', (await a.objeto({ tipo: 'mover', de: 'mano:izq', a: 'mano:der' })).ok === false);

  console.log('Talar');
  s.objetos.tala.entre = 0; s.objetos.troceo.entre = 0;   // sin esperar entre golpes (la prueba no espera 0,5 s cada uno)
  a.estar(10, 10); await pausa(150);
  const arbol = idArbol(11, 10);
  r = await a.objeto({ tipo: 'talar', arbol: idArbol(30, 10), x: 10, z: 10, ax: 30, az: 10, edad: 'adulto' });
  comprobar('un árbol lejos de donde estás no vale', !r.ok, r.motivo);
  r = await a.objeto({ tipo: 'talar', arbol, x: 10, z: 10, ax: 10.5, az: 10, edad: 'adulto' });
  comprobar('ni uno cuyo nombre no cuadra con su sitio', !r.ok, r.motivo);
  r = await b.objeto({ tipo: 'talar', arbol, x: 1, z: 0, ax: 11, az: 10, edad: 'adulto' });
  comprobar('B, lejos, no lo tala aunque diga que está al lado', !r.ok, r.motivo);
  const talaB = b.esperar(m => m.tipo === 'tala', 4000), sueloTala = b.esperar(m => m.tipo === 'suelo' && m.objetos.some(o => o.cosa.tipo === 'tronco_largo'), 4000);
  let golpes = 0;
  do { r = await a.objeto({ tipo: 'talar', arbol, x: 10, z: 10, ax: 11, az: 10, edad: 'adulto' }); golpes++; } while (r.ok && !r.datos.cae && golpes < 30);
  comprobar('A lo tala a golpes (adulto con hierro: 14) y el resultado dice que cae y hacia dónde', r.ok && r.datos.cae && golpes === 14 && Number.isFinite(r.datos.dir), `${golpes} golpes · ${r.motivo || ''}`);
  const tb = await talaB, sl = await sueloTala;
  comprobar('B se entera: el árbol cae y queda el tocón', tb.cae.arbol === arbol && tb.cae.autor === yoA && tb.estado.estado[arbol]?.vuelve > Date.now());
  comprobar('y ve el tronco largo y las ramas en el suelo', sl.objetos.some(o => o.cosa.tipo === 'tronco_largo') && sl.objetos.some(o => o.cosa.tipo === 'rama'));
  r = await a.objeto({ tipo: 'talar', arbol, x: 10, z: 10, ax: 11, az: 10, edad: 'joven' });
  comprobar('talado, ya no se tala (ni diciendo que es otro árbol más joven)', !r.ok, r.motivo);

  console.log('Trocear');
  const tronco = s.objetos.sueloVisible(Date.now()).find(o => o.cosa.tipo === 'tronco_largo');
  a.estar(tronco.x, tronco.z); await pausa(150);
  golpes = 0;
  do { r = await a.objeto({ tipo: 'trocear', objeto: tronco.id, x: tronco.x, z: tronco.z }); golpes++; } while (r.ok && !r.datos.termina && golpes < 40);
  comprobar('A tronza el tronco largo (18 golpes con hierro) en troncos cortos', r.ok && r.datos.termina && golpes === 18 && r.datos.da.tipo === 'tronco_corto', `${golpes} golpes · ${r.motivo || JSON.stringify(r.datos.da)}`);
  comprobar('el tronco largo ya no está y los cortos sí', !s.objetos.sueloVisible(Date.now()).some(o => o.id === tronco.id) && s.objetos.sueloVisible(Date.now()).some(o => o.cosa.tipo === 'tronco_corto'));

  console.log('Recoger');
  a.estar(5, 5); await pausa(150);
  const recB = b.esperar(m => m.tipo === 'recoleccion');
  r = await a.objeto({ tipo: 'recoger', punto: 'piedra:3', x: 5, z: 5, px: 5.5, pz: 5, clase: 'piedra' });
  comprobar('A recoge una piedra suelta y va a lo que lleva', r.ok && r.datos.objeto === 'piedra' && tiene(s.objetos.inventarioDe(yoA), 'piedra'), r.motivo);
  comprobar('B se entera de que ese punto ya está recogido', (await recB).estado.estado['piedra:3']?.vuelve > Date.now());
  r = await a.objeto({ tipo: 'recoger', punto: 'piedra:3', x: 5, z: 5, px: 5.5, pz: 5, clase: 'piedra' });
  comprobar('y no se vuelve a recoger hasta que vuelva', !r.ok, r.motivo);
  r = await a.objeto({ tipo: 'recoger', punto: 'piedra:4', x: 5, z: 5, px: 5.5, pz: 5, clase: 'silex' });
  comprobar('un punto cuyo nombre no cuadra con su clase no vale', !r.ok, r.motivo);

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
  comprobar('y el tocón y lo recogido', b2.bienvenida.tala.estado[arbol]?.vuelve > Date.now() && b2.bienvenida.recoleccion.estado['piedra:3']?.vuelve > Date.now());
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
