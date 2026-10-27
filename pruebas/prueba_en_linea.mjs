// Prueba del mundo en línea del cliente (src/logica/en_linea.js) contra el servidor de verdad (servidor/servidor.mjs).
// Ejecutar: node pruebas/prueba_en_linea.mjs
// Comprueba: la acción propia se ve enseguida (sin esperar a la red), la de otro llega a todos, si dos ponen
// lo mismo a la vez gana el que llega antes al servidor y el otro lo pierde en su pantalla, y al final los tres
// mundos (dos clientes y servidor) son iguales. También el aspecto (cuerpo y ropa) que se reparte.
// Con MUTAR=1 se prueba un cliente que no rehace su copia cuando llega lo de otro: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ruta = join(raiz, 'src/logica/en_linea.js'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('if (!propia) { this.rehacer();', 'if (!propia) {');
  if (mutada === fuente) { console.log('No se pudo mutar el cliente'); process.exit(1); }
  copia = join(raiz, 'src/logica/.en_linea_mutado.js');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { MundoEnLinea } = await import(pathToFileURL(ruta).href);

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const foto = (m) => JSON.stringify(m.exportar());
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

// un cliente: el websocket y su MundoEnLinea; guarda los mensajes y lo que devuelve recibir
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, msgs: [], cambios: [] };
    c.retenidos = null;   // si es una lista, lo que manda se queda ahí (red lenta) hasta soltar()
    c.red = new MundoEnLinea((m) => c.retenidos ? c.retenidos.push(m) : ws.send(JSON.stringify(m)));
    c.soltar = () => { const l = c.retenidos; c.retenidos = null; for (const m of l) ws.send(JSON.stringify(m)); };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.msgs.push(m);
      c.cambios.push(c.red.recibir(m));
      if (m.tipo === 'bienvenida') listo(c);
    });
    ws.on('error', fallo);
  });
}
// espera a que no quede nada por confirmar en ningún cliente
async function calma(...cs) { for (let i = 0; i < 100 && cs.some(c => c.red.pendientes.length); i++) await pausa(20); await pausa(60); }

const dir = mkdtempSync(join(tmpdir(), 'kinhold-enlinea-'));
try {
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  const puerto = await s.listo;
  const A = await cliente(puerto), B = await cliente(puerto);
  comprobar('sin bienvenida no se construye', new MundoEnLinea(() => {}).accion({ tipo: 'mojon', x: 0, z: 0 }).ok === false);

  console.log('La acción propia se ve enseguida y llega a los demás');
  const r1 = A.red.accion({ tipo: 'mojon', x: 0, z: 0 });
  comprobar('el mojón de A está en su mundo antes de que conteste el servidor', r1.ok && !!A.red.mundo.mojon && A.red.pendientes.length === 1);
  comprobar('mientras tanto, la base (lo del servidor) aún no lo tiene', !A.red.base.mojon);
  await calma(A, B);
  comprobar('B ve el mojón de A', !!B.red.mundo.mojon);
  comprobar('confirmado, A ya no tiene copia: su mundo es la base', A.red.mundo === A.red.base && A.red.pendientes.length === 0);

  console.log('Dos ponen lo mismo a la vez');
  const pieza = { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 };
  const ra = A.red.accion(pieza), rb = B.red.accion(pieza);
  comprobar('los dos lo ven puesto en su pantalla al momento', ra.ok && rb.ok);
  await calma(A, B);
  const rechazos = [...A.cambios, ...B.cambios].filter(c => c.rechazo);
  comprobar('el servidor rechaza al segundo y se le avisa', rechazos.length === 1, rechazos.map(c => c.rechazo).join(''));
  comprobar('los dos clientes y el servidor tienen el mismo mundo', foto(A.red.mundo) === foto(s.mundo) && foto(B.red.mundo) === foto(s.mundo),
    `${s.mundo.construcciones[0].piezas.size} pieza, materiales iguales`);

  console.log('Lo de otro llega mientras hay acciones propias por confirmar');
  // B pone dos cimientos con la red lenta (no salen aún); A pone uno entre medias, que llega a B antes
  B.retenidos = [];
  B.red.accion({ ...pieza, x: 2 });
  A.red.accion({ ...pieza, x: -2 });
  B.red.accion({ ...pieza, x: 4 });
  await calma(A);
  const enB = B.red.mundo.construcciones.reduce((t, k) => t + k.piezas.size, 0);
  comprobar('B ve la pieza de A sin perder las suyas por confirmar', B.red.pendientes.length === 2 && enB === 4, `${enB} piezas en B, ${B.red.pendientes.length} por confirmar`);
  B.soltar();
  await calma(A, B);
  const n = (c) => c.red.mundo.construcciones.reduce((t, k) => t + k.piezas.size, 0);
  comprobar('las cuatro piezas en los dos clientes', n(A) === 4 && n(B) === 4, `A ${n(A)}, B ${n(B)}`);
  comprobar('y los tres mundos siguen iguales', foto(A.red.mundo) === foto(s.mundo) && foto(B.red.mundo) === foto(s.mundo));

  console.log('Aspecto: cuerpo y ropa');
  A.ws.send(JSON.stringify({ tipo: 'aspecto', sexo: 'mujer', capas: ['vestido', 'gambeson'] }));
  await pausa(80);
  const asp = B.msgs.find(m => m.tipo === 'aspecto');
  comprobar('B recibe el aspecto de A con su autor', asp && asp.autor === A.red.yo && asp.sexo === 'mujer' && asp.capas.join() === 'vestido,gambeson');
  comprobar('A no recibe su propio aspecto', !A.msgs.some(m => m.tipo === 'aspecto'));
  A.ws.send(JSON.stringify({ tipo: 'aspecto', sexo: 'dragon', capas: ['<script>'] }));
  await pausa(80);
  comprobar('un aspecto mal formado se rechaza', A.msgs.some(m => m.tipo === 'error' && /Aspecto/.test(m.motivo)));
  const C = await cliente(puerto);
  const bv = C.msgs[0];
  comprobar('el que llega después recibe el aspecto de los que ya están', (bv.aspectos || []).some(e => e.autor === A.red.yo && e.sexo === 'mujer'));
  comprobar('y el mundo tal como está', foto(C.red.mundo) === foto(s.mundo));
  A.ws.close(); B.ws.close(); C.ws.close();
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA la prueba se cortó:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
