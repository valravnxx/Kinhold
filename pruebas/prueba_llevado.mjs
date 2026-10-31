// Prueba de lo que se ve que lleva cada jugador (src/logica/llevado.js) y de cómo lo reparte el servidor.
// Ejecutar: node pruebas/prueba_llevado.mjs
// Comprueba: llevadoDe saca del inventario el cinturón y lo de sus huecos, la espalda y lo que lleva dentro (sumado),
// el hombro y las manos (lo grande, una vez y con las dos); normalizarLlevado quita lo que no existe o no va en su sitio;
// y con el servidor de verdad y dos clientes, el aspecto que recibe B lleva lo que A tiene en el inventario del
// servidor (al coger un cinturón y un leñero, B lo recibe enseguida), no lo que diga el navegador de A.
// Con MUTAR=1 se prueba un servidor que se fía del «llevado» que manda el cliente: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { llevadoDe, normalizarLlevado } from '../src/logica/llevado.js';
import { Inventario } from '../src/logica/inventario.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

console.log('Del inventario a lo que se ve');
{
  const inv = Inventario.inicial();
  inv.lugares.cintura = { tipo: 'cinto_anillas', n: 1, dentro: [{ tipo: 'hacha_piedra', n: 1 }, null, { tipo: 'bayas', n: 4 }, null] };
  inv.lugares.espalda = { tipo: 'lenero', n: 1, dentro: [{ tipo: 'tronco_corto', n: 1 }, null, { tipo: 'lena', n: 3 }, { tipo: 'lena', n: 2 }, null, null] };
  inv.lugares.hombro = { tipo: 'saco', n: 1 };
  inv.lugares['mano:izq'] = { tipo: 'piedra', n: 2 };
  const l = llevadoDe(inv.lugares);
  comprobar('el cinturón y lo de cada hueco, en su orden', l.cintura === 'cinto_anillas' && JSON.stringify(l.colgado) === '["hacha_piedra",null,"bayas",null]', JSON.stringify(l.colgado));
  comprobar('la espalda y lo de dentro sumado por tipo', l.espalda === 'lenero' && l.dentro.lena === 5 && l.dentro.tronco_corto === 1, JSON.stringify(l.dentro));
  comprobar('el hombro y la mano izquierda (con cuántos)', l.hombro === 'saco' && l.izq === 'piedra' && l.n.izq === 2 && !l.der && !l.dos);
  const g = Inventario.inicial(); g.lugares['mano:izq'] = { tipo: 'tronco_corto', n: 1 };
  const lg = llevadoDe(g.lugares);
  comprobar('lo grande va una vez, en las dos manos', lg.dos && lg.der === 'tronco_corto' && !lg.izq, JSON.stringify(lg));
  const nada = llevadoDe(Inventario.inicial().lugares);
  comprobar('con lo puesto, nada encima', !nada.cintura && !nada.espalda && !nada.hombro && !nada.der && !nada.izq && nada.colgado.length === 0);
}

console.log('Lo que llega por la red se comprueba');
{
  const n = normalizarLlevado({ cintura: 'lenero', espalda: 'cinto_cuero', hombro: 'tronco_corto', der: 'tronco_largo', izq: 'nada', colgado: ['espada', 'tronco_corto', 'inventado'], dentro: { lena: 5, x: 3 } });
  comprobar('lo que no va en su sitio o no existe, fuera', n && !n.cintura && !n.espalda && n.hombro === 'tronco_corto' && !n.der && !n.izq, JSON.stringify(n));
  comprobar('sin cinturón no cuelga nada; sin espalda, no hay nada dentro', n.colgado.length === 0 && Object.keys(n.dentro).length === 0);
  const b = normalizarLlevado({ cintura: 'cinto_armas', colgado: ['espada', 'tronco_corto', 'inventado', 'bayas', 'cuchillo'], espalda: 'lenero', dentro: { lena: 5.5, tronco_corto: 2, x: 3 }, der: 'piedra', n: { der: 'mucho' } });
  comprobar('lo colgado: solo lo que cabe en un hueco del cinturón, como mucho 4', JSON.stringify(b.colgado) === '["espada",null,null,"bayas"]', JSON.stringify(b.colgado));
  comprobar('lo de dentro: solo tipos que existen y números enteros', JSON.stringify(b.dentro) === '{"tronco_corto":2}', JSON.stringify(b.dentro));
  comprobar('en la mano, al menos uno', b.der === 'piedra' && b.n.der === 1);
  comprobar('lo que no es un objeto, null', normalizarLlevado('lenero') === null && normalizarLlevado([1]) === null && normalizarLlevado(null) === null);
}

// ---------- con el servidor ----------
let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('e.llevado = llevadoDe(objetos.invs.de(autor).lugares);', 'e.llevado = msg.llevado || null;');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_llevado.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 2000) => new Promise((r, f) => {
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
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
const dir = mkdtempSync(join(tmpdir(), 'kinhold-llevado-'));
let s = null;
try {
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  const puerto = await s.listo;
  const a = await cliente(puerto), b = await cliente(puerto);
  const yoA = a.bienvenida.autor;
  console.log('El servidor reparte lo que lleva cada uno');
  const deA = (cond) => b.esperar(m => m.tipo === 'aspecto' && m.autor === yoA && cond(m));
  let llega = deA(() => true);
  // el navegador de A dice que lleva un leñero (no lo lleva): el servidor no se lo cree
  a.ws.send(JSON.stringify({ tipo: 'aspecto', sexo: 'hombre', capas: [], llevado: { espalda: 'lenero', dentro: { lena: 18 } } }));
  let m = await llega;
  comprobar('B recibe el aspecto de A con lo que lleva según el servidor (nada)', m.llevado && !m.llevado.espalda && !m.llevado.cintura, JSON.stringify(m.llevado));
  llega = deA(m => m.llevado && m.llevado.cintura === 'cinto_cuero');
  let r = await a.objeto({ tipo: 'coger', objeto: 'cinto_cuero', cantidad: 1, a: 'cintura' });
  comprobar('A coge un cinto de cuero del arcón', r.ok, r.motivo);
  m = await llega.catch(() => null);
  comprobar('B lo recibe sin que A mande nada más', !!m, m && JSON.stringify(m.llevado));
  llega = deA(m => m.llevado && m.llevado.espalda === 'lenero');
  r = await a.objeto({ tipo: 'coger', objeto: 'lenero', cantidad: 1, a: 'espalda' });
  m = await llega.catch(() => null);
  comprobar('y el leñero a la espalda, con el cinturón aún puesto', r.ok && !!m && m.llevado.cintura === 'cinto_cuero', m && JSON.stringify(m.llevado));
  const antes = b.recibidos.filter(x => x.tipo === 'aspecto').length;
  r = await a.objeto({ tipo: 'coger', objeto: 'cinto_cuero', cantidad: 1, a: 'cintura' }); // ya lo lleva: no cambia nada
  await new Promise(res => setTimeout(res, 200));
  comprobar('si no cambia lo que se ve, no se vuelve a mandar', b.recibidos.filter(x => x.tipo === 'aspecto').length === antes);
  const c = await cliente(puerto);
  const suyo = (c.bienvenida.aspectos || []).find(x => x.autor === yoA);
  comprobar('el que llega después lo ve en la bienvenida', suyo && suyo.llevado && suyo.llevado.espalda === 'lenero', suyo && JSON.stringify(suyo.llevado));
  for (const x of [a, b, c]) x.ws.close();
} catch (e) { comprobar('sin errores', false, e.message); }
finally {
  if (s) await s.cerrar?.();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
