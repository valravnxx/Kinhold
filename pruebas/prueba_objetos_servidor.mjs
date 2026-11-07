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
// igual (y el jugador que vuelve con su ficha, con lo suyo). Fabricar: con las manos y en una estación, gastando de lo
// que lleva el autor y del suelo de al lado, lo hecho a lo que lleva (o al suelo si no cabe), la estación la ven los
// dos, en tierra de otro no se pone, y sigue igual al volver a arrancar.
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
  let s = crearServidor({ arconPruebas: true, puerto: 0, archivo });
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

  console.log('Fabricar por el servidor');
  {
    a.estar(5, 5); b.estar(5, 6); await pausa(150);
    await a.objeto({ tipo: 'soltar_suelo', de: 'mano:der', x: 5, z: 5 }); // deja el hacha para tener una mano libre
    r = await a.objeto({ tipo: 'coger', objeto: 'fibra', cantidad: 3, a: 'mano:der' });
    comprobar('A coge 3 de fibra (del arcón de pruebas)', r.ok, r.motivo);
    const invF = a.esperar(m => m.tipo === 'inventario');
    r = await a.objeto({ tipo: 'fabricar', receta: 'cordel', x: 5, z: 5 });
    comprobar('A encarga un cordel con las manos: gasta la fibra que lleva', r.ok && r.datos.encargo.receta === 'cordel' && !tiene(s.objetos.inventarioDe(yoA), 'fibra'), r.motivo);
    comprobar('y le llega lo que lleva, ya sin la fibra', !tiene((await invF).inventario, 'fibra'));
    r = await a.objeto({ tipo: 'recoger_fabricado', x: 5, z: 5 });
    comprobar('antes de su tiempo no se recoge', !r.ok, r.motivo);
    r = await b.objeto({ tipo: 'recoger_fabricado', x: 5, z: 6 });
    comprobar('B no recoge el cordel de A', !r.ok && !tiene(s.objetos.inventarioDe(yoB), 'cordel'), r.motivo);
    s.objetos.fab.manos[yoA][0].fin = Date.now() - 1; // como si hubieran pasado los 15 s
    r = await a.objeto({ tipo: 'recoger_fabricado', x: 5, z: 5 });
    comprobar('terminado, el cordel va a lo que lleva A', r.ok && tiene(s.objetos.inventarioDe(yoA), 'cordel'), r.motivo || JSON.stringify(r.datos));
    r = await a.objeto({ tipo: 'fabricar', receta: 'cordel', x: 30, z: 30 });
    comprobar('lo que pide un sitio va desde donde el servidor tiene al autor', !r.ok && /No estás ahí/.test(r.motivo), r.motivo);
    // la piedra de tallar: la ven los dos
    // la piedra de tallar, como obra: el marco, su piedra y el trabajo; la ven los dos
    const marcoB = b.esperar(m => m.tipo === 'estaciones' && m.estaciones.some(e => e.tipo === 'piedra_tallar' && e.obra));
    const estB = b.esperar(m => m.tipo === 'estaciones' && m.estaciones.some(e => e.tipo === 'piedra_tallar' && !e.obra));
    r = await a.objeto({ tipo: 'colocar_estacion', estacion: 'piedra_tallar', x: 5.5, z: 5 });
    const idMarco = r.datos && r.datos.id;
    comprobar('A pone el marco de una piedra de tallar, sin gastar nada', r.ok && r.datos.obra && tiene(s.objetos.inventarioDe(yoA), 'piedra'), r.motivo);
    comprobar('B ve el marco, con lo que lleva entregado', !!(await marcoB));
    r = await b.objeto({ tipo: 'trabajar_estacion', estacion: idMarco, segundos: 2, x: 5, z: 6 });
    comprobar('sin su material no se trabaja en él', !r.ok && /material/.test(r.motivo), r.motivo);
    r = await a.objeto({ tipo: 'entregar_estacion', estacion: idMarco, x: 5, z: 5 });
    comprobar('A le lleva la piedra que recogió', r.ok && !tiene(s.objetos.inventarioDe(yoA), 'piedra') && r.datos.entregado.piedra === 1, r.motivo);
    r = await a.objeto({ tipo: 'trabajar_estacion', estacion: idMarco, segundos: 60, x: 5, z: 5 });
    comprobar('un rato de trabajo de más no cuela', !r.ok, r.motivo);
    r = await b.objeto({ tipo: 'trabajar_estacion', estacion: idMarco, segundos: 2, x: 5, z: 6 });
    const r2 = await a.objeto({ tipo: 'trabajar_estacion', estacion: idMarco, segundos: 3, x: 5, z: 5 });
    comprobar('entre los dos la levantan (el trabajo de los dos se suma)', r.ok && !r.datos.terminada && r2.ok && r2.datos.terminada, r2.motivo || JSON.stringify(r2.datos));
    const eb = await estB;
    comprobar('B la ve levantada (sin las colas de nadie)', eb.estaciones.length === 1 && eb.estaciones[0].tipo === 'piedra_tallar' && eb.estaciones[0].autor === yoA && !('cola' in eb.estaciones[0]) && !eb.estaciones[0].obra, JSON.stringify(eb.estaciones));
    r = await a.objeto({ tipo: 'colocar_estacion', estacion: 'hoguera', x: 5, z: 5 });
    const idHog = r.datos && r.datos.id;
    const re = await a.objeto({ tipo: 'entregar_estacion', estacion: idHog, x: 5, z: 5 });
    comprobar('a la hoguera, sin lo que cuesta, no se le entrega nada', r.ok && !re.ok && /falta/.test(re.motivo), re.motivo);
    r = await a.objeto({ tipo: 'quitar_estacion', estacion: idHog, x: 5, z: 5 });
    comprobar('y su marco se quita', r.ok && !s.objetos.fab.estaciones[idHog], r.motivo);
    // la lasca, con lo depositado en la piedra de tallar: el sílex lo deja B y la piedra A (valravnx, 6 nov)
    const idPt = eb.estaciones[0].id;
    r = await b.objeto({ tipo: 'coger', objeto: 'silex', cantidad: 1, a: 'mano:izq' });
    const conSilex = a.esperar(m => m.tipo === 'estaciones' && m.estaciones.some(e => e.id === idPt && e.deposito && e.deposito.silex === 1));
    r = await b.objeto({ tipo: 'depositar_estacion', estacion: idPt, de: 'mano:izq', x: 5, z: 6 });
    comprobar('B deja un sílex en la piedra de tallar de A, y A lo ve puesto en ella', r.ok && !tiene(s.objetos.inventarioDe(yoB), 'silex') && !!(await conSilex), r.motivo);
    const libre = ['mano:der', 'mano:izq'].find(l => !lugar(s.objetos.inventarioDe(yoA), l));
    r = await a.objeto({ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: libre });
    comprobar('A coge otra piedra', r.ok, r.motivo);
    r = await a.objeto({ tipo: 'fabricar', receta: 'lasca_silex', x: 5, z: 5 });
    comprobar('sin la piedra depositada, la lasca no se encarga aunque la lleve', !r.ok && /en la estación/.test(r.motivo) && tiene(s.objetos.inventarioDe(yoA), 'piedra'), r.motivo);
    r = await a.objeto({ tipo: 'depositar_estacion', estacion: idPt, de: libre, x: 30, z: 30 });
    comprobar('depositar va desde donde el servidor tiene al autor', !r.ok && /No estás ahí/.test(r.motivo), r.motivo);
    r = await a.objeto({ tipo: 'depositar_estacion', estacion: idPt, de: libre, x: 5, z: 5 });
    comprobar('A deposita su piedra', r.ok && !tiene(s.objetos.inventarioDe(yoA), 'piedra'), r.motivo);
    const vacia = b.esperar(m => m.tipo === 'estaciones' && m.estaciones.some(e => e.id === idPt && e.deposito && !Object.keys(e.deposito).length));
    r = await a.objeto({ tipo: 'fabricar', receta: 'lasca_silex', x: 5, z: 5 });
    comprobar('A encarga la lasca sin decir la estación: la de al lado, con lo depositado en ella', r.ok && r.datos.estacion === idPt && r.datos.usado.estacion.silex === 1 && r.datos.usado.estacion.piedra === 1, r.motivo || JSON.stringify(r.datos));
    comprobar('y B ve la piedra de tallar vacía', !!(await vacia));
    // terminado y sin sitio: al suelo, a sus pies
    s.objetos.fab.estaciones[eb.estaciones[0].id].cola[0].fin = Date.now() - 1;
    const libre2 = ['mano:der', 'mano:izq'].find(l => !lugar(s.objetos.inventarioDe(yoA), l));
    if (libre2) await a.objeto({ tipo: 'coger', objeto: 'rama', cantidad: 1, a: libre2 });
    const inv0 = s.objetos.inventarioDe(yoA);
    const lleno = ['mano:der', 'mano:izq'].every(l => lugar(inv0, l));
    const alSuelo = b.esperar(m => m.tipo === 'suelo' && m.objetos.some(o => o.cosa.tipo === 'lasca_silex'));
    r = await a.objeto({ tipo: 'recoger_fabricado', estacion: eb.estaciones[0].id, x: 5, z: 5 });
    comprobar('con las manos llenas, la lasca cae al suelo a sus pies y la ven los dos', lleno && r.ok && r.datos.dados[0].alSuelo && !!(await alSuelo), r.motivo || JSON.stringify(r.datos));
    // en tierra de otro, no
    const ajena = new ObjetosServidor({ posicion: () => ({ x: 0, z: 0 }), puedeTocar: () => ({ ok: false, motivo: 'Es tierra de otro: solo su dueño y sus invitados.' }) });
    ajena.invs.de(yoA).meterDonde('piedra', 1);
    const rt = ajena.ejecutar({ autor: yoA, tipo: 'colocar_estacion', estacion: 'piedra_tallar', x: 0.5, z: 0 }, Date.now());
    ajena.fab.estaciones['hoguera:8'] = { id: 'hoguera:8', tipo: 'hoguera', x: 0.5, z: 0, autor: 'otro', cola: [], deposito: {}, obra: { entregado: {}, trabajo: 0, aportes: [] } };
    const rq = ajena.ejecutar({ autor: yoA, tipo: 'quitar_estacion', estacion: 'hoguera:8', x: 0, z: 0 }, Date.now());
    comprobar('ni se quita el marco de un puesto en tierra de otro', !rq.ok && !!ajena.fab.estaciones['hoguera:8'], rq.motivo);
    const techo = new ObjetosServidor({ posicion: () => ({ x: 0, z: 0 }), bajoTecho: () => true });
    const rh = techo.ejecutar({ autor: yoA, tipo: 'colocar_estacion', estacion: 'hoguera', x: 0.5, z: 0 }, Date.now());
    comprobar('bajo techo el servidor no deja poner una hoguera', !rh.ok && /fuera/.test(rh.motivo), rh.motivo);
    comprobar('en tierra de otro no se coloca una estación (ni se gasta nada)', !rt.ok && /tierra de otro/.test(rt.motivo) && ajena.invs.de(yoA).cuantos('piedra') === 1, rt.motivo);
    ajena.fab.estaciones['piedra_tallar:9'] = { id: 'piedra_tallar:9', tipo: 'piedra_tallar', x: 0.5, z: 0, autor: 'otro', cola: [], deposito: { rama: 2 } };
    const rd = ajena.ejecutar({ autor: yoA, tipo: 'depositar_estacion', estacion: 'piedra_tallar:9', de: ajena.invs.de(yoA).rutasCon('piedra')[0], x: 0, z: 0 }, Date.now());
    const rr = ajena.ejecutar({ autor: yoA, tipo: 'retirar_estacion', estacion: 'piedra_tallar:9', objeto: 'rama', x: 0, z: 0 }, Date.now());
    comprobar('ni se deja ni se coge nada de una estación en tierra de otro', !rd.ok && !rr.ok && /tierra de otro/.test(rd.motivo + rr.motivo) && ajena.invs.de(yoA).cuantos('piedra') === 1 && ajena.fab.estaciones['piedra_tallar:9'].deposito.rama === 2, rd.motivo);
    // los almacenajes de la base (7 nov): lo guardado es de la tierra; en la de otro, ni se guarda ni se saca
    ajena.fab.estaciones['pila_piedras:10'] = { id: 'pila_piedras:10', tipo: 'pila_piedras', x: 0.5, z: 0, autor: 'otro', cola: [], deposito: { piedra: 30 } };
    const rg = ajena.ejecutar({ autor: yoA, tipo: 'depositar_estacion', estacion: 'pila_piedras:10', de: ajena.invs.de(yoA).rutasCon('piedra')[0], x: 0, z: 0 }, Date.now());
    const rs = ajena.ejecutar({ autor: yoA, tipo: 'retirar_estacion', estacion: 'pila_piedras:10', objeto: 'piedra', cantidad: 1, x: 0, z: 0 }, Date.now());
    comprobar('la pila de piedras de otro: ni se guarda ni se saca nada', !rg.ok && !rs.ok && /tierra de otro/.test(rg.motivo + rs.motivo) && ajena.fab.estaciones['pila_piedras:10'].deposito.piedra === 30, rs.motivo);
    // y un almacenaje solo se pone en una tierra con dueño (la tuya o la de quien te invita): en tierra de nadie, no
    const nadie = new ObjetosServidor({ posicion: () => ({ x: 0, z: 0 }), enTierras: () => false });
    const rn = nadie.ejecutar({ autor: yoA, tipo: 'colocar_estacion', estacion: 'pila_piedras', x: 0.5, z: 0 }, Date.now());
    const suya = new ObjetosServidor({ posicion: () => ({ x: 0, z: 0 }), enTierras: () => true });
    const rsu = suya.ejecutar({ autor: yoA, tipo: 'colocar_estacion', estacion: 'pila_piedras', x: 0.5, z: 0 }, Date.now());
    comprobar('un almacenaje, en tierra de nadie no; en la suya, sí', !rn.ok && /tu tierra/.test(rn.motivo) && rsu.ok, `${rn.motivo} / ${rsu.motivo || 'ok'}`);
  }

  const fichaB = b.bienvenida.ficha;
  const foto = JSON.stringify(s.objetos.exportar());
  a.ws.close(); b.ws.close(); await pausa(100);
  await s.cerrar();
  const auditoria = readFileSync(join(dir, 'objetos.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('cada acción queda en el registro, bien o mal, con su autor', auditoria.length >= 10 && auditoria.every(e => e.autor === yoA || e.autor === yoB), `${auditoria.length} entradas`);

  console.log('Al volver a arrancar');
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo });
  puerto = await s.listo;
  comprobar('los inventarios y el suelo siguen igual', JSON.stringify(s.objetos.exportar()) === foto);
  const b2 = await cliente(puerto, fichaB);
  comprobar('B vuelve con su ficha y lleva lo suyo', b2.bienvenida.autor === yoB && lugar(b2.bienvenida.inventario, 'mano:der')?.tipo === 'camisa_lino' && lugar(b2.bienvenida.inventario, 'ropa:interior')?.tipo === 'camisa_lino');
  comprobar('y ve en el suelo los pantalones que soltó', b2.bienvenida.suelo.some(o => o.cosa.tipo === 'pantalon_lino' && o.autor === yoB));
  comprobar('y la piedra de tallar de A, sin perder nada de lo encargado', b2.bienvenida.estaciones.some(e => e.tipo === 'piedra_tallar' && e.autor === yoA) && JSON.stringify(s.objetos.fab.exportar()) === JSON.stringify(JSON.parse(foto).fabricacion));
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
