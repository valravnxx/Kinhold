// Prueba del combate en el servidor (hito 1f): src/logica/combate_servidor.js sin red, y después el servidor
// de verdad con dos clientes por websocket y lag simulado (ida y vuelta, con vaivén).
// Ejecutar: node pruebas/prueba_combate_servidor.mjs
// Con MUTAR=1 se prueba un servidor que se fía del autor que manda el cliente en sus intenciones: debe FALLAR.
// Con MUTAR_LIZA=1, un combate en el que los de la liza dan también a los que construyen: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { T, RITMO, ARMAS, Luchador } from '../src/combate/logica.js';
import { aplicarFoto, avanzarCopia, resultadoDeEvento, rivalCercano } from '../src/logica/combate_cliente.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let rutaCombate = join(raiz, 'src/logica/combate_servidor.js'), copiaCombate = null;
if (process.env.MUTAR_LIZA === '1') {
  const fuente = readFileSync(rutaCombate, 'utf8');
  const mutada = fuente.split('!!o.liza !== !!L.liza').join('false');
  if (mutada === fuente) { console.log('No se pudo mutar el combate'); process.exit(1); }
  copiaCombate = join(raiz, 'src/logica/.combate_servidor_mutado.js');
  writeFileSync(copiaCombate, mutada); rutaCombate = copiaCombate;
}
const { CombateServidor, validarIntencion } = await import(pathToFileURL(rutaCombate).href);
if (copiaCombate) rmSync(copiaCombate);
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// ---------------- 1. La lógica, sin red ----------------
console.log('Combate en el servidor, sin red');
// A en el origen mirando a +z; B a 1,5 m delante, mirándole
function pareja(opc = {}) {
  const c = new CombateServidor({ semilla: 5, ...opc });
  c.entrar('jugador:a', { z: 0, rot: 0 });
  c.entrar('jugador:b', { z: 1.5, rot: Math.PI });
  return c;
}
{
  const c = pareja();
  const prep = ARMAS.espada_larga.prep * RITMO.normal;
  comprobar('atacar es una intención válida', c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'alto' }).ok);
  c.avanzar(prep - 0.03);
  comprobar('el golpe no llega antes de su preparación', c.sacarEventos().length === 0, `${(prep * 1000).toFixed(0)} ms`);
  c.avanzar(0.05);
  const ev = c.sacarEventos();
  const g = ev[0];
  comprobar('al terminar la preparación el servidor resuelve el golpe, con su autor y su objetivo',
    ev.length === 1 && g.tipo === 'golpe' && g.autor === 'jugador:a' && g.objetivo === 'jugador:b' && g.resultado === 'herida',
    g && `${g.resultado} en ${g.zona} (${g.gravedad}) a los ${g.t} ms`);
  const e = c.registro.entradas.at(-1);
  comprobar('la herida queda en el registro con autor', e && e.autor === 'jugador:a' && e.tipo === 'golpe' && e.datos.objetivo === 'jugador:b' && e.n === g.n);
  comprobar('el herido lo está en el servidor', c.luchadores['jugador:b'].heridas.length === 1);
}
{
  const c = pareja();
  c.intencion('jugador:b', { tipo: 'combate', que: 'parar', activo: true });
  c.avanzar(0.3);
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'derecha' });
  c.avanzar(0.7);
  const g = c.sacarEventos()[0];
  comprobar('parar con tiempo es parada normal', g && g.resultado === 'parada', g && g.resultado);
}
{
  const c = pareja();
  const prep = ARMAS.espada_larga.prep * RITMO.normal;
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'izquierda' });
  c.avanzar(prep - 0.12);
  c.intencion('jugador:b', { tipo: 'combate', que: 'parar', activo: true });
  c.avanzar(0.2);
  const g = c.sacarEventos()[0];
  comprobar('parar justo antes del impacto (en el reloj del servidor) es parada perfecta', g && g.resultado === 'parada perfecta' && c.luchadores['jugador:a'].accion === 'aturdido', g && g.resultado);
}
{
  const c = pareja();
  c.colocar('jugador:b', 0, 4, Math.PI);
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'bajo' });
  c.avanzar(1);
  const g = c.sacarEventos()[0];
  comprobar('sin nadie a su alcance el golpe va al aire y no hiere', g && g.resultado === 'al aire' && !g.objetivo && c.luchadores['jugador:b'].heridas.length === 0);
  c.colocar('jugador:b', 0, 1.5, Math.PI);
  c.colocar('jugador:a', 0, 0, Math.PI);   // de espaldas
  c.avanzar(2);
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'bajo' });
  c.avanzar(1);
  const g2 = c.sacarEventos()[0];
  comprobar('de espaldas al rival tampoco le da', g2 && g2.resultado === 'al aire');
}
{
  const c = pareja();
  const malas = [
    { tipo: 'combate', que: 'volar' }, { tipo: 'combate', que: 'atacar', linea: 'arriba' },
    { tipo: 'combate', que: 'parar', activo: 'si' }, { tipo: 'combate', que: 'soltar', x: 'a', y: 0, z: 0 },
    { tipo: 'combate', que: 'equipar', arma: 'lanza_laser' }, { tipo: 'combate', que: 'equipar', arma: 'arco', armadura: 'papel' },
    { tipo: 'combate', que: 'guardia', guardia: '__proto__' }, null, 'atacar',
  ];
  comprobar('las intenciones mal formadas se rechazan', malas.every(m => !validarIntencion(m) && !c.intencion('jugador:a', m).ok));
  comprobar('quien no está en el combate no puede nada', !c.intencion('jugador:x', { tipo: 'combate', que: 'atacar', linea: 'alto' }).ok);
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'alto' });
  comprobar('no se cambia de arma a mitad de un golpe', !c.intencion('jugador:a', { tipo: 'combate', que: 'equipar', arma: 'arco' }).ok);
  c.luchadores['jugador:b'].caer('prueba');
  comprobar('fuera de combate no se puede atacar', !c.intencion('jugador:b', { tipo: 'combate', que: 'atacar', linea: 'alto' }).ok);
}
{
  // arco: A se aparta 12 m, tensa del todo y suelta al pecho de B
  const c = pareja();
  c.colocar('jugador:b', 0, 12, Math.PI);
  comprobar('coger el arco estando libre', c.intencion('jugador:a', { tipo: 'combate', que: 'equipar', arma: 'arco' }).ok);
  comprobar('tensar', c.intencion('jugador:a', { tipo: 'combate', que: 'tensar' }).ok);
  c.avanzar(1.1);
  comprobar('soltar apuntando al rival', c.intencion('jugador:a', { tipo: 'combate', que: 'soltar', x: 0, y: 1.2, z: 12 }).ok);
  c.avanzar(1.5);
  const ev = c.sacarEventos();
  const d = ev.find(e => e.tipo === 'disparo'), f = ev.find(e => e.tipo === 'flecha');
  comprobar('el disparo y su impacto salen con el autor del tirador', d && f && d.autor === 'jugador:a' && f.autor === 'jugador:a',
    f && `${f.resultado}${f.objetivo ? ' a ' + f.objetivo : ''}${f.zona ? ' en ' + f.zona : ''}`);
  comprobar('la flecha hiere a B y queda en el registro', f && f.resultado === 'blanco' && f.objetivo === 'jugador:b' && c.registro.entradas.some(e => e.tipo === 'impacto' && e.autor === 'jugador:a' && e.datos.objetivo === 'jugador:b'));
  comprobar('las flechas acabadas se quitan', c.proyectiles.length === 0);
  comprobar('soltar sin tensar no dispara', !c.intencion('jugador:a', { tipo: 'combate', que: 'soltar', x: 0, y: 1, z: 12 }).ok);
}
{
  // lo que se reparte de los luchadores: solo lo que cambia
  const c = pareja();
  comprobar('la primera vez van todos los luchadores', c.cambiados().length === 2);
  c.avanzar(0.1);
  comprobar('sin cambios no se manda nada', c.cambiados().length === 0);
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'alto' });
  const l = c.cambiados();
  comprobar('al atacar se manda solo el que ataca, preparando y por qué línea', l.length === 1 && l[0].autor === 'jugador:a' && l[0].accion === 'preparando' && l[0].linea === 'alto');
}

{
  // la liza (el «Duelo en línea»): sus luchadores solo se dan entre ellos
  const c = new CombateServidor({ semilla: 5 });
  c.entrar('jugador:a', { z: 0, rot: 0 });
  c.entrar('jugador:obra', { z: 1.5, rot: Math.PI });   // uno que construye, delante de A
  comprobar('entrar en la liza es una intención válida', c.intencion('jugador:a', { tipo: 'combate', que: 'liza' }).ok && c.luchadores['jugador:a'].liza === true);
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'alto' });
  c.avanzar(1.5);
  const g = c.sacarEventos().find(e => e.tipo === 'golpe');
  comprobar('el de la liza no da al que construye (aunque esté delante)', g && g.resultado === 'al aire' && c.luchadores['jugador:obra'].heridas.length === 0, g && g.resultado);
  c.entrar('jugador:b', { z: 1.5, x: 0.01, rot: Math.PI }); c.intencion('jugador:b', { tipo: 'combate', que: 'liza' });
  delete c.luchadores['jugador:obra'];
  c.avanzar(1.5); c.sacarEventos();
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'alto' });
  c.avanzar(1.5);
  const g2 = c.sacarEventos().find(e => e.tipo === 'golpe');
  comprobar('a otro de la liza sí le da', g2 && g2.objetivo === 'jugador:b' && g2.resultado === 'herida', g2 && g2.resultado);
  comprobar('el golpe dice el tipo de herida (para el sonido y la sangre)', g2 && g2.danio === 'corte', g2 && g2.danio);
  const f = c.cambiados(true).find(l => l.autor === 'jugador:b');
  comprobar('la foto lleva cada herida (zona, gravedad, tipo) y si está en la liza', f.liza === true && f.lista.length === 1 && f.lista[0][0] === g2.zona && f.lista[0][1] === g2.gravedad && f.lista[0][2] === 'corte');
  // volver a empezar sano: no a mitad de una pelea
  comprobar('no se vuelve a empezar sano con el rival en pie al lado', !c.intencion('jugador:b', { tipo: 'combate', que: 'reiniciar' }).ok && c.luchadores['jugador:b'].heridas.length === 1);
  c.luchadores['jugador:b'].caer('Desangrado');
  comprobar('caído, sí: sale sano, en la liza y con la misma arma', c.intencion('jugador:b', { tipo: 'combate', que: 'reiniciar' }).ok
    && c.luchadores['jugador:b'].heridas.length === 0 && !c.luchadores['jugador:b'].fuera && c.luchadores['jugador:b'].liza && c.luchadores['jugador:b'].arma === 'espada_larga');
  comprobar('y se avisa a todos', c.sacarEventos().some(e => e.tipo === 'reinicio' && e.autor === 'jugador:b'));
  c.luchadores['jugador:b'].x = 40;
  comprobar('sin nadie cerca también se puede', c.intencion('jugador:a', { tipo: 'combate', que: 'reiniciar' }).ok);
}
{
  // la copia de un cliente: se pone como dice el servidor; lo propio no se pisa mientras se predice
  const c = new CombateServidor({ semilla: 3 });
  c.entrar('jugador:a', { z: 0, rot: 0 }); c.entrar('jugador:b', { z: 1.5, rot: Math.PI });
  for (const x of ['jugador:a', 'jugador:b']) c.intencion(x, { tipo: 'combate', que: 'liza' });
  c.intencion('jugador:a', { tipo: 'combate', que: 'atacar', linea: 'derecha' });
  c.avanzar(0.2);
  const fa = c.cambiados(true).find(l => l.autor === 'jugador:a');
  const otro = new Luchador({ ritmo: RITMO.normal });
  aplicarFoto(otro, fa);
  comprobar('la copia de otro hace lo que dice el servidor (preparando, por la derecha, a su punto)', otro.accion === 'preparando' && otro.linea === 'derecha' && Math.abs(otro.tAccion - 0.2) < 0.02 && otro.liza);
  avanzarCopia(otro, 5);
  comprobar('la copia avanza sola entre fotos, pero sus golpes no cuentan', otro.accion !== 'preparando' && c.luchadores['jugador:b'].heridas.length === 0);
  const propio = new Luchador({ ritmo: RITMO.normal });
  propio.bloquear(true);
  const libre = { ...fa, accion: 'libre', linea: null, bloqueando: false, tAccion: 0, duracion: 0 };
  aplicarFoto(propio, libre, { propio: true, prediciendo: true });
  comprobar('lo propio no se pisa mientras se predice', propio.bloqueando === true);
  aplicarFoto(propio, { ...libre, accion: 'aturdido', duracion: 700 }, { propio: true, prediciendo: true });
  comprobar('salvo lo que solo sabe el servidor (quedar descolocado)', propio.accion === 'aturdido');
  aplicarFoto(propio, { ...libre, lista: [['torso', 'grave', 'corte', 1.2]], sangre: 80, cansancio: 40 }, { propio: true, prediciendo: true });
  comprobar('las heridas, la sangre y el cansancio, siempre los del servidor', propio.heridas.length === 1 && propio.heridas[0].zona === 'torso' && propio.sangre === 80 && propio.cansancio === 40);
  propio.sangre = 1; avanzarCopia(propio, 10);
  comprobar('la copia no cae por su cuenta (desangrarse lo decide el servidor)', !propio.fuera);
  aplicarFoto(propio, { ...libre, fuera: true, accion: 'caido', motivoFuera: 'Desangrado' }, { propio: true, prediciendo: true });
  comprobar('cae cuando lo dice el servidor', propio.fuera && propio.motivoFuera === 'Desangrado');
  const r = resultadoDeEvento({ tipo: 'golpe', resultado: 'al aire', linea: 'alto' });
  comprobar('un golpe al aire del servidor se cuenta como fallo', r.resultado === 'fallo');
  const yo = { x: 0, z: 0 };
  const lista = [{ autor: 'x', L: Object.assign(new Luchador(), { x: 1, z: 0, liza: true, fuera: true }) }, { autor: 'y', L: Object.assign(new Luchador(), { x: 3, z: 0, liza: true }) }, { autor: 'z', L: Object.assign(new Luchador(), { x: 0.5, z: 0 }) }];
  comprobar('el rival es el más cercano en pie de la liza', rivalCercano(yo, lista).autor === 'y');
}

// Curarse en línea: intención con el autor de la conexión, la cura la lleva el servidor y la copia la recibe
{
  const c = pareja();
  const La = c.luchadores['jugador:a'];
  La.recibirHerida('torso', 0.5, 'corte');
  comprobar('intención de curar mal formada: no vale', !validarIntencion({ tipo: 'combate', que: 'curar', herida: 0, metodo: 'constructor' }) && !validarIntencion({ tipo: 'combate', que: 'curar', herida: -1, metodo: 'vendar' }) && !validarIntencion({ tipo: 'combate', que: 'curar', herida: '0', metodo: 'vendar' }));
  comprobar('no se cura una herida que no existe', !c.intencion('jugador:b', { tipo: 'combate', que: 'curar', herida: 0, metodo: 'vendar' }).ok);
  comprobar('el jugador empieza a vendarse', c.intencion('jugador:a', { tipo: 'combate', que: 'curar', herida: 0, metodo: 'vendar' }).ok && La.accion === 'curando');
  c.cambiados();
  c.avanzar(4.2);
  const ev = c.sacarEventos(), fs = c.cambiados(), fa = fs.find(f => f.autor === 'jugador:a');
  comprobar('el servidor reparte la cura terminada', ev.some(e => e.tipo === 'curado' && e.autor === 'jugador:a' && e.metodo === 'vendar'));
  comprobar('la foto lleva la herida vendada y el botiquín', fa && fa.lista[0][4] === 'v' && fa.botiquin.vendas === 2, fa ? JSON.stringify(fa.lista) : 'sin foto');
  const copia = new Luchador();
  aplicarFoto(copia, fa, { propio: true });
  comprobar('la copia del cliente ve la venda', copia.heridas[0].vendada && copia.botiquin.vendas === 2);
  c.intencion('jugador:a', { tipo: 'combate', que: 'curar', herida: 0, metodo: 'coser' });
  comprobar('dejar la cura a medias', c.intencion('jugador:a', { tipo: 'combate', que: 'dejarCura' }).ok && La.accion === 'libre' && !La.heridas[0].cosida);
}

// ---------------- 2. El servidor, con dos clientes y lag ----------------
let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('combate.intencion(autor, msg)', 'combate.intencion(msg.autor || autor, msg)');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_combate.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

// Cliente con lag: lo que manda y lo que recibe se retrasa lag ± vaivén ms, sin cambiar el orden (como TCP).
function cliente(puerto, lag, vaiven) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], sube: 0, baja: 0 };
    const retraso = () => lag + (Math.random() * 2 - 1) * vaiven;
    c.mandar = (m) => { c.sube = Math.max(c.sube, Date.now() + retraso()); setTimeout(() => ws.send(JSON.stringify(m)), c.sube - Date.now()); };
    c.esperar = (cond, ms = 4000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond);
      if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    ws.on('message', (d) => {
      c.baja = Math.max(c.baja, Date.now() + retraso());
      setTimeout(() => {
        const m = JSON.parse(d.toString());
        m.llega = Date.now();
        c.recibidos.push(m);
        c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
      }, c.baja - Date.now());
    });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const eventos = (c) => c.recibidos.filter(m => m.tipo === 'combate').flatMap(m => m.eventos);
const sinLlega = (l) => JSON.stringify(l);

const dir = mkdtempSync(join(tmpdir(), 'kinhold-combate-'));
const archivo = join(dir, 'mundo.jsonl');
let s;
try {
  console.log('Servidor con dos clientes y lag simulado (A: 80 ± 30 ms, B: 140 ± 50 ms, cada sentido)');
  s = crearServidor({ puerto: 0, archivo, semilla: 9 });
  const puerto = await s.listo;
  const A = await cliente(puerto, 80, 30);
  const B = await cliente(puerto, 140, 50);
  const a = A.bienvenida.autor, b = B.bienvenida.autor;
  comprobar('la bienvenida trae los luchadores (cada jugador tiene el suyo)', B.bienvenida.luchadores.some(l => l.autor === a) && B.bienvenida.luchadores.some(l => l.autor === b) && typeof B.bienvenida.tc === 'number');

  // se colocan frente a frente por la presencia
  A.mandar({ tipo: 'estado', x: 0, y: 0, z: 0, giro: 0, anim: 'quieto' });
  B.mandar({ tipo: 'estado', x: 0, y: 0, z: 1.5, giro: Math.PI, anim: 'quieto' });
  await pausa(400);
  comprobar('la posición del luchador sale de la presencia', s.combate.luchadores[b].z === 1.5 && s.combate.luchadores[b].rot === Math.PI);

  // A ataca; un rato después llega a los dos el mismo golpe
  const sale = Date.now();
  A.mandar({ tipo: 'combate', que: 'atacar', linea: 'alto' });
  const gA = await A.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe'));
  const gB = await B.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe'));
  const g = gA.eventos.find(e => e.tipo === 'golpe');
  const prep = ARMAS.espada_larga.prep * RITMO.normal * 1000;
  comprobar('el golpe lo resuelve el servidor con el autor de la conexión', g.autor === a && g.objetivo === b && g.resultado === 'herida', `${g.resultado} en ${g.zona} (${g.gravedad})`);
  comprobar('los tiempos los lleva el servidor: no llega antes de la preparación más el lag', gA.llega - sale >= prep + 2 * 50, `${gA.llega - sale} ms desde que se mandó (preparación ${prep.toFixed(0)} ms)`);
  comprobar('los dos ven el mismo golpe', sinLlega(gA.eventos) === sinLlega(gB.eventos));
  await pausa(400);
  const lb = (c) => [...c.recibidos].reverse().find(m => m.tipo === 'luchadores' && m.lista.some(l => l.autor === b))?.lista.find(l => l.autor === b);
  comprobar('los dos ven al herido con su herida', lb(A)?.heridas === 1 && lb(B)?.heridas === 1);

  // B intenta hacerse pasar por A: el golpe es de B igualmente
  B.mandar({ tipo: 'combate', que: 'atacar', linea: 'bajo', autor: a });
  const gf = await A.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe' && e.linea === 'bajo'));
  const f = gf.eventos.find(e => e.linea === 'bajo');
  comprobar('el autor que diga el cliente no cuenta: el golpe es de quien lo manda', f.autor === b && f.objetivo === a, `autor ${f.autor === b ? 'B' : f.autor === a ? 'A (suplantado)' : f.autor}`);

  // B para con tiempo y A vuelve a atacar
  await pausa(1500);
  B.mandar({ tipo: 'combate', que: 'parar', activo: true });
  await pausa(500);
  A.mandar({ tipo: 'combate', que: 'atacar', linea: 'derecha' });
  const gp = await A.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe' && e.linea === 'derecha'));
  comprobar('una parada a tiempo para el golpe aunque haya lag', gp.eventos.find(e => e.linea === 'derecha').resultado === 'parada');
  B.mandar({ tipo: 'combate', que: 'parar', activo: false });

  // A coge el arco, se aparta y tira a B
  await pausa(800);
  A.mandar({ tipo: 'combate', que: 'equipar', arma: 'arco' });
  A.mandar({ tipo: 'estado', x: 0, y: 0, z: -10, giro: 0, anim: 'quieto' });
  B.mandar({ tipo: 'combate', que: 'equipar', arma: 'arco' });   // sin escudo, para que la flecha entre
  await pausa(300);
  A.mandar({ tipo: 'combate', que: 'tensar' });
  await pausa(1200);
  A.mandar({ tipo: 'combate', que: 'soltar', x: 0, y: 1.2, z: 1.5 });
  const fl = await B.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'flecha'));
  const fe = fl.eventos.find(e => e.tipo === 'flecha');
  comprobar('la flecha sale y da con el autor del tirador', fe.autor === a && fe.resultado === 'blanco' && fe.objetivo === b, `${fe.resultado} en ${fe.zona || '—'}`);

  // una intención que no se puede recibe su rechazo solo el que la manda
  A.mandar({ tipo: 'combate', que: 'atacar', linea: 'alto' });   // con arco no se ataca cuerpo a cuerpo
  A.mandar({ tipo: 'combate', que: 'volar' });
  const rech = await A.esperar(m => m.tipo === 'combate_rechazo' && m.que === 'volar');
  comprobar('lo que no se puede se rechaza al que lo manda', !!rech && A.recibidos.filter(m => m.tipo === 'combate_rechazo').length === 2 && !B.recibidos.some(m => m.tipo === 'combate_rechazo'), rech.motivo);

  await pausa(500);
  comprobar('con lag distinto, los dos reciben exactamente los mismos eventos y en el mismo orden', sinLlega(eventos(A)) === sinLlega(eventos(B)), `${eventos(A).length} eventos`);

  const lineas = readFileSync(join(dir, 'combate.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('el combate se guarda aparte del mundo, con autor y numerado', lineas.length >= 4 && lineas.every((e, i) => e.n === i + 1 && e.autor)
    && lineas.some(e => e.tipo === 'impacto' && e.autor === a), `${lineas.length} líneas: ${lineas.map(e => e.tipo).join(', ')}`);
  comprobar('el archivo del mundo no se mezcla con el combate', !existsSync(archivo) || !readFileSync(archivo, 'utf8').includes('"golpe"'));

  // al irse, su luchador se quita
  B.ws.close();
  await pausa(300);
  comprobar('al irse un jugador, su luchador sale del combate', !s.combate.luchadores[b]);
  A.ws.close();
} catch (e) {
  comprobar('la prueba con el servidor termina', false, e.message);
} finally {
  if (s) await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
