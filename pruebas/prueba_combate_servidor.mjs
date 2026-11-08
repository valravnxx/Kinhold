// Prueba del combate en el servidor (hito 1f): src/logica/combate_servidor.js sin red, y después el servidor
// de verdad con dos clientes por websocket y lag simulado (ida y vuelta, con vaivén). Un solo modo, el del combate en
// el mundo (fuera la liza y sus capas y guardias, 6 nov): arma sacada, golpe cargado por una de cuatro direcciones,
// finta y paradas por lado.
// Ejecutar: node pruebas/prueba_combate_servidor.mjs
// Con MUTAR=1 se prueba un servidor que se fía del autor que manda el cliente en sus intenciones: debe FALLAR.
// Con MUTAR_MODOS=1, un combate que vuelve a aceptar las intenciones de la liza y de las guardias: debe FALLAR.
// Con MUTAR_ROPA=1, un servidor que no viste al luchador con lo que lleva puesto en el inventario: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { T, RITMO, ARMAS, Luchador } from '../src/combate/logica.js';
import { aplicarFoto, avanzarCopia, resultadoDeEvento } from '../src/logica/combate_cliente.js';
import { proteccion, puestasDe } from '../src/logica/prendas.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let rutaCombate = join(raiz, 'src/logica/combate_servidor.js'), copiaCombate = null;
if (process.env.MUTAR_MODOS === '1') {
  const fuente = readFileSync(rutaCombate, 'utf8');
  const mutada = fuente.replace("    case 'fintar': return { que: 'fintar' };",
    "    case 'fintar': return { que: 'fintar' };\n    case 'liza': case 'mundo': case 'guardia': case 'atacar': return { que: m.que };");
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
const PREP = ARMAS.espada_larga.prep * RITMO.normal;
const IMPACTO = PREP * T.cargaMinima + T.vuelo;   // s: un golpe soltado enseguida llega a la carga mínima y vuela
const ic = (c, a, m) => c.intencion(a, { tipo: 'combate', ...m });
// un golpe soltado enseguida: cargar y descargar
const golpe = (c, a, linea) => ic(c, a, { que: 'cargar', linea }).ok && ic(c, a, { que: 'descargar' }).ok;
// A en el origen mirando a +z; B a 1,5 m delante, mirándole; los dos con el arma sacada
function pareja(opc = {}) {
  const c = new CombateServidor({ semilla: 5, ...opc });
  c.entrar('jugador:a', { z: 0, rot: 0 });
  c.entrar('jugador:b', { z: 1.5, rot: Math.PI });
  for (const x of ['jugador:a', 'jugador:b']) ic(c, x, { que: 'arma', sacada: true });
  return c;
}
{
  const c = pareja();
  comprobar('cargar y soltar son intenciones válidas', golpe(c, 'jugador:a', 'alto'));
  c.avanzar(IMPACTO - 0.03);
  comprobar('el golpe no llega antes de su carga mínima y su vuelo', c.sacarEventos().length === 0, `${(IMPACTO * 1000).toFixed(0)} ms`);
  c.avanzar(0.05);
  const ev = c.sacarEventos();
  const g = ev[0];
  comprobar('al llegar el servidor resuelve el golpe, con su autor y su objetivo',
    ev.length === 1 && g.tipo === 'golpe' && g.autor === 'jugador:a' && g.objetivo === 'jugador:b' && g.resultado === 'herida',
    g && `${g.resultado} en ${g.zona} (${g.gravedad}) a los ${g.t} ms`);
  const e = c.registro.entradas.at(-1);
  comprobar('la herida queda en el registro con autor', e && e.autor === 'jugador:a' && e.tipo === 'golpe' && e.datos.objetivo === 'jugador:b' && e.n === g.n);
  comprobar('el herido lo está en el servidor', c.luchadores['jugador:b'].heridas.length === 1);
  comprobar('el golpe dice el tipo de herida (para el sonido y la sangre)', g.danio === 'corte', g.danio);
  const f = c.cambiados(true).find(l => l.autor === 'jugador:b');
  comprobar('la foto lleva cada herida (zona, gravedad, tipo), sin modo, ni guardia, ni liza', f.lista.length === 1 && f.lista[0][0] === g.zona && f.lista[0][1] === g.gravedad && f.lista[0][2] === 'corte'
    && !('modo' in f) && !('guardia' in f) && !('liza' in f), Object.keys(f).join(','));
}
{
  const c = pareja();
  ic(c, 'jugador:b', { que: 'parar', activo: true, linea: 'izquierda' });   // el espejo de la derecha de A
  c.avanzar(0.3);
  golpe(c, 'jugador:a', 'derecha');
  c.avanzar(0.7);
  const g = c.sacarEventos()[0];
  comprobar('parar con tiempo por el lado bueno es parada normal', g && g.resultado === 'parada', g && g.resultado);
}
{
  const c = pareja();
  golpe(c, 'jugador:a', 'izquierda');
  c.avanzar(IMPACTO - 0.12);
  ic(c, 'jugador:b', { que: 'parar', activo: true, linea: 'derecha' });
  c.avanzar(0.2);
  const g = c.sacarEventos()[0];
  comprobar('parar justo antes del impacto (en el reloj del servidor) es parada perfecta', g && g.resultado === 'parada perfecta' && c.luchadores['jugador:a'].accion === 'aturdido', g && g.resultado);
}
{
  const c = pareja();
  c.colocar('jugador:b', 0, 4, Math.PI);
  golpe(c, 'jugador:a', 'estocada');
  c.avanzar(1);
  const g = c.sacarEventos()[0];
  comprobar('sin nadie a su alcance el golpe va al aire y no hiere', g && g.resultado === 'al aire' && !g.objetivo && c.luchadores['jugador:b'].heridas.length === 0);
  c.colocar('jugador:b', 0, 1.5, Math.PI);
  c.colocar('jugador:a', 0, 0, Math.PI);   // de espaldas
  c.avanzar(2);
  golpe(c, 'jugador:a', 'alto');
  c.avanzar(1);
  const g2 = c.sacarEventos()[0];
  comprobar('de espaldas al rival tampoco le da', g2 && g2.resultado === 'al aire');
}
{
  const c = pareja();
  const malas = [
    { tipo: 'combate', que: 'volar' }, { tipo: 'combate', que: 'cargar', linea: 'arriba' },
    { tipo: 'combate', que: 'parar', activo: 'si' }, { tipo: 'combate', que: 'soltar', x: 'a', y: 0, z: 0 },
    { tipo: 'combate', que: 'equipar', arma: 'lanza_laser' }, { tipo: 'combate', que: 'equipar', armadura: 'malla' },
    null, 'cargar',
  ];
  comprobar('las intenciones mal formadas se rechazan', malas.every(m => !validarIntencion(m) && !c.intencion('jugador:a', m).ok));
  // las de la liza y de las guardias (fuera el 6 nov) ya no existen
  const viejas = [{ que: 'liza' }, { que: 'mundo' }, { que: 'guardia', guardia: 'pflug' }, { que: 'atacar', linea: 'alto' }];
  comprobar('las intenciones de la liza y de las guardias ya no valen', viejas.every(m => !validarIntencion({ tipo: 'combate', ...m }) && !ic(c, 'jugador:a', m).ok)
    && c.luchadores['jugador:a'].accion === 'libre' && !('liza' in c.luchadores['jugador:a']));
  comprobar('quien no está en el combate no puede nada', !ic(c, 'jugador:x', { que: 'cargar', linea: 'alto' }).ok);
  ic(c, 'jugador:a', { que: 'cargar', linea: 'alto' });
  comprobar('no se cambia de arma a mitad de un golpe', !ic(c, 'jugador:a', { que: 'equipar', arma: 'arco' }).ok);
  c.luchadores['jugador:b'].caer('prueba');
  comprobar('fuera de combate no se puede atacar', !ic(c, 'jugador:b', { que: 'cargar', linea: 'alto' }).ok);
}
{
  // el duelo con lo que llevas (7 nov): la armadura es la ropa puesta, no la que diga el cliente
  const c = pareja();
  const A = c.luchadores['jugador:a'];
  const LINO = ['camisa_lino', 'pantalon_lino'], COTA = [...LINO, 'gambeson', 'cota_malla'];
  c.vestir('jugador:a', LINO);
  const conLino = A.proteccion('torso', 'corte');
  comprobar('el cliente ya no elige su armadura: equipar con «malla» no cambia lo que le protege',
    ic(c, 'jugador:a', { que: 'equipar', arma: 'espada_larga', armadura: 'malla' }).ok && A.proteccion('torso', 'corte') === conLino && A.armadura === 'lino');
  c.vestir('jugador:a', COTA);
  comprobar('con la cota puesta le protege lo de sus prendas, zona a zona',
    ['torso', 'brazoI', 'piernaD', 'cabeza'].every(z => A.proteccion(z, 'corte') === proteccion(COTA, z, 'corte')) && A.proteccion('torso', 'corte') < conLino && A.armadura === 'malla',
    `torso ${conLino} → ${Math.round(A.proteccion('torso', 'corte') * 1000) / 1000}`);
  const f = c.cambiados(true).find(l => l.autor === 'jugador:a');
  comprobar('los demás ven lo que lleva puesto', f && JSON.stringify(f.prendas) === JSON.stringify(COTA) && f.armadura === 'malla');
  const copia = new Luchador({ armadura: 'lino' }); aplicarFoto(copia, f);
  comprobar('la copia del cliente se viste con la foto', copia.proteccion('torso', 'corte') === A.proteccion('torso', 'corte'));
  c.luchadores['jugador:b'].x = 50;   // lejos, para poder volver a empezar
  ic(c, 'jugador:a', { que: 'reiniciar' });
  comprobar('al volver a empezar sigue con lo que lleva puesto', JSON.stringify(c.luchadores['jugador:a'].prendas) === JSON.stringify(COTA));
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
  ic(c, 'jugador:a', { que: 'cargar', linea: 'alto' });
  const l = c.cambiados();
  comprobar('al cargar se manda solo el que ataca, preparando y por qué línea', l.length === 1 && l[0].autor === 'jugador:a' && l[0].accion === 'preparando' && l[0].linea === 'alto');
}
{
  // todos se dan con todos (ya no hay liza aparte), y volver a empezar sano: no a mitad de una pelea
  const c = pareja();
  c.entrar('jugador:obra', { z: 1.5, x: 0.6, rot: Math.PI });   // otro, que no ha sacado el arma, delante de A
  c.colocar('jugador:b', 0, 30, Math.PI);
  golpe(c, 'jugador:a', 'alto');
  c.avanzar(1);
  const g = c.sacarEventos().find(e => e.tipo === 'golpe');
  comprobar('el golpe da a quien está delante, haga lo que haga', g && g.objetivo === 'jugador:obra' && g.resultado === 'herida', g && g.resultado);
  comprobar('no se vuelve a empezar sano con el rival en pie al lado', !ic(c, 'jugador:obra', { que: 'reiniciar' }).ok && c.luchadores['jugador:obra'].heridas.length === 1);
  c.luchadores['jugador:obra'].caer('Desangrado');
  comprobar('caído, sí: sale sano y con la misma arma', ic(c, 'jugador:obra', { que: 'reiniciar' }).ok
    && c.luchadores['jugador:obra'].heridas.length === 0 && !c.luchadores['jugador:obra'].fuera && c.luchadores['jugador:obra'].arma === 'espada_larga');
  comprobar('y se avisa a todos', c.sacarEventos().some(e => e.tipo === 'reinicio' && e.autor === 'jugador:obra'));
  c.luchadores['jugador:obra'].x = 40;
  comprobar('sin nadie cerca también se puede', ic(c, 'jugador:a', { que: 'reiniciar' }).ok && c.luchadores['jugador:a'].sacada === true);
}
{
  // la copia de un cliente: se pone como dice el servidor; lo propio no se pisa mientras se predice
  const c = pareja({ semilla: 3 });
  golpe(c, 'jugador:a', 'derecha');
  c.avanzar(0.2);
  const fa = c.cambiados(true).find(l => l.autor === 'jugador:a');
  const otro = new Luchador({ ritmo: RITMO.normal });
  aplicarFoto(otro, fa);
  comprobar('la copia de otro hace lo que dice el servidor (preparando, por la derecha, a su punto)', otro.accion === 'preparando' && otro.linea === 'derecha' && Math.abs(otro.tAccion - 0.2) < 0.02);
  c.avanzar(0.2);
  aplicarFoto(otro, c.cambiados(true).find(l => l.autor === 'jugador:a'));
  for (let i = 0; i < 300; i++) avanzarCopia(otro, 1 / 60);
  comprobar('la copia avanza sola entre fotos, pero sus golpes no cuentan', otro.accion === 'libre' && c.luchadores['jugador:b'].heridas.length === 0, otro.accion);
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

// Pelear en el mundo (valravnx, 31 oct): sacar el arma, cargar, fintar y parar por un lado
console.log('Pelear en el mundo');
{
  const c = new CombateServidor({ semilla: 5 });
  c.entrar('jugador:a', { z: 0, rot: 0 });
  c.entrar('jugador:b', { z: 1.5, rot: Math.PI });
  const La = c.luchadores['jugador:a'], Lb = c.luchadores['jugador:b'];
  const ic = (a, m) => c.intencion(a, { tipo: 'combate', ...m });
  comprobar('sin el arma sacada no se carga un golpe', !ic('jugador:a', { que: 'cargar', linea: 'alto' }).ok && La.accion === 'libre');
  comprobar('sacar el arma es una intención válida, y la foto lo dice', ic('jugador:a', { que: 'arma', sacada: true }).ok && c.cambiados(true).find(f => f.autor === 'jugador:a').sacada === true);
  comprobar('las intenciones nuevas mal formadas no valen', !validarIntencion({ tipo: 'combate', que: 'cargar', linea: 'bajo' }) && !validarIntencion({ tipo: 'combate', que: 'arma', sacada: 'si' })
    && !validarIntencion({ tipo: 'combate', que: 'parar', activo: true, linea: 'centro' }));
  comprobar('cargar un golpe por arriba', ic('jugador:a', { que: 'cargar', linea: 'alto' }).ok && La.accion === 'preparando' && La.linea === 'alto');
  c.avanzar(0.3);
  comprobar('la finta lo cancela', ic('jugador:a', { que: 'fintar' }).ok && La.accion === 'libre');
  c.sacarEventos();
  ic('jugador:a', { que: 'cargar', linea: 'derecha' });
  c.avanzar(0.2);
  ic('jugador:a', { que: 'descargar' });
  c.avanzar(2);
  let g = c.sacarEventos().find(e => e.tipo === 'golpe');
  comprobar('al soltar sale y hiere al otro, con su autor', g && g.autor === 'jugador:a' && g.objetivo === 'jugador:b' && g.resultado === 'herida' && Lb.heridas.length === 1, g && g.resultado);
  // B saca el arma y para por su lado izquierdo (el espejo de la derecha de A)
  ic('jugador:b', { que: 'arma', sacada: true });
  comprobar('parar por un lado', ic('jugador:b', { que: 'parar', activo: true, linea: 'izquierda' }).ok && Lb.bloqueando && Lb.lineaBloqueo === 'izquierda');
  c.avanzar(1.5);
  ic('jugador:a', { que: 'cargar', linea: 'derecha' }); c.avanzar(0.1); ic('jugador:a', { que: 'descargar' });
  c.avanzar(2);
  g = c.sacarEventos().find(e => e.tipo === 'golpe');
  comprobar('la parada por el lado bueno para el golpe', g && g.resultado === 'parada', g && g.resultado);
  ic('jugador:b', { que: 'parar', activo: true, linea: 'alto' });
  c.avanzar(1.5);
  ic('jugador:a', { que: 'cargar', linea: 'derecha' }); c.avanzar(0.1); ic('jugador:a', { que: 'descargar' });
  c.avanzar(2);
  g = c.sacarEventos().find(e => e.tipo === 'golpe');
  comprobar('por el lado malo, no', g && g.resultado !== 'parada' && g.resultado !== 'parada perfecta', g && g.resultado);
  comprobar('la foto lleva el lado de la parada', (() => { const f = c.cambiados(true).find(x => x.autor === 'jugador:b'); return f.lineaBloqueo === 'alto' && f.bloqueando; })());
  ic('jugador:a', { que: 'cargar', linea: 'alto' });
  comprobar('guardar el arma deja de cargar y la foto lo dice', ic('jugador:a', { que: 'arma', sacada: false }).ok && La.accion === 'libre' && c.cambiados(true).find(f => f.autor === 'jugador:a').sacada === false);
  // la copia que dibuja a otro jugador: con el golpe cargado no lo suelta por su cuenta (no sabe cuándo suelta el botón)
  ic('jugador:a', { que: 'arma', sacada: true }); ic('jugador:a', { que: 'cargar', linea: 'izquierda' });
  const copia = new Luchador();
  aplicarFoto(copia, c.cambiados(true).find(f => f.autor === 'jugador:a'));
  for (let i = 0; i < 120; i++) avanzarCopia(copia, 1 / 60);
  comprobar('la copia de otro sigue cargando hasta que el servidor diga que sale', copia.accion === 'preparando' && copia.linea === 'izquierda', copia.accion);
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
if (process.env.MUTAR_ROPA === '1') {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace('const vestirLuchador = (autor) => combate.vestir(', 'const vestirLuchador = (autor) => (() => {})(');
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
  s = crearServidor({ arconPruebas: true, puerto: 0, archivo, semilla: 9 });
  const puerto = await s.listo;
  const A = await cliente(puerto, 80, 30);
  const B = await cliente(puerto, 140, 50);
  const a = A.bienvenida.autor, b = B.bienvenida.autor;
  comprobar('la bienvenida trae los luchadores (cada jugador tiene el suyo)', B.bienvenida.luchadores.some(l => l.autor === a) && B.bienvenida.luchadores.some(l => l.autor === b) && typeof B.bienvenida.tc === 'number');

  // los dos sacan el arma
  A.mandar({ tipo: 'combate', que: 'arma', sacada: true }); B.mandar({ tipo: 'combate', que: 'arma', sacada: true });
  // se colocan frente a frente por la presencia
  A.mandar({ tipo: 'estado', x: 0, y: 0, z: 0, giro: 0, anim: 'quieto' });
  B.mandar({ tipo: 'estado', x: 0, y: 0, z: 1.5, giro: Math.PI, anim: 'quieto' });
  await pausa(400);
  comprobar('la posición del luchador sale de la presencia', s.combate.luchadores[b].z === 1.5 && s.combate.luchadores[b].rot === Math.PI);

  // A ataca; un rato después llega a los dos el mismo golpe (por la izquierda: desde el 7 nov la cabeza no la protege
  // el gambesón, y un tajo alto podía dejar a B fuera de combate antes de lo que se prueba después)
  const sale = Date.now();
  A.mandar({ tipo: 'combate', que: 'cargar', linea: 'izquierda' }); A.mandar({ tipo: 'combate', que: 'descargar' });
  const gA = await A.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe'));
  const gB = await B.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe'));
  const g = gA.eventos.find(e => e.tipo === 'golpe');
  const prep = IMPACTO * 1000;
  comprobar('el golpe lo resuelve el servidor con el autor de la conexión', g.autor === a && g.objetivo === b && g.resultado === 'herida', `${g.resultado} en ${g.zona} (${g.gravedad})`);
  comprobar('los tiempos los lleva el servidor: no llega antes de la carga mínima y el vuelo más el lag', gA.llega - sale >= prep + 2 * 50, `${gA.llega - sale} ms desde que se mandó (hasta el impacto ${prep.toFixed(0)} ms)`);
  comprobar('los dos ven el mismo golpe', sinLlega(gA.eventos) === sinLlega(gB.eventos));
  await pausa(400);
  const lb = (c) => [...c.recibidos].reverse().find(m => m.tipo === 'luchadores' && m.lista.some(l => l.autor === b))?.lista.find(l => l.autor === b);
  comprobar('los dos ven al herido con su herida', lb(A)?.heridas === 1 && lb(B)?.heridas === 1);

  // B intenta hacerse pasar por A: el golpe es de B igualmente
  B.mandar({ tipo: 'combate', que: 'cargar', linea: 'estocada', autor: a }); B.mandar({ tipo: 'combate', que: 'descargar', autor: a });
  const gf = await A.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe' && e.linea === 'estocada'));
  const f = gf.eventos.find(e => e.linea === 'estocada');
  comprobar('el autor que diga el cliente no cuenta: el golpe es de quien lo manda', f.autor === b && f.objetivo === a, `autor ${f.autor === b ? 'B' : f.autor === a ? 'A (suplantado)' : f.autor}`);

  // B para con tiempo por el lado bueno (el espejo de la derecha de A) y A vuelve a atacar
  await pausa(1500);
  B.mandar({ tipo: 'combate', que: 'parar', activo: true, linea: 'izquierda' });
  await pausa(500);
  A.mandar({ tipo: 'combate', que: 'cargar', linea: 'derecha' }); A.mandar({ tipo: 'combate', que: 'descargar' });
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
  A.mandar({ tipo: 'combate', que: 'cargar', linea: 'alto' });   // con arco no se golpea cuerpo a cuerpo
  A.mandar({ tipo: 'combate', que: 'volar' });
  const rech = await A.esperar(m => m.tipo === 'combate_rechazo' && m.que === 'volar');
  comprobar('lo que no se puede se rechaza al que lo manda', !!rech && A.recibidos.filter(m => m.tipo === 'combate_rechazo').length === 2 && !B.recibidos.some(m => m.tipo === 'combate_rechazo'), rech.motivo);

  await pausa(500);
  comprobar('con lag distinto, los dos reciben exactamente los mismos eventos y en el mismo orden', sinLlega(eventos(A)) === sinLlega(eventos(B)), `${eventos(A).length} eventos`);

  const lineas = readFileSync(join(dir, 'combate.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('el combate se guarda aparte del mundo, con autor y numerado', lineas.length >= 4 && lineas.every((e, i) => e.n === i + 1 && e.autor)
    && lineas.some(e => e.tipo === 'impacto' && e.autor === a), `${lineas.length} líneas: ${lineas.map(e => e.tipo).join(', ')}`);
  comprobar('el archivo del mundo no se mezcla con el combate', !existsSync(archivo) || !readFileSync(archivo, 'utf8').includes('"golpe"'));

  // otra vez con espada: A guarda el arma y la vuelve a sacar, y golpea cargando
  for (const C of [A, B]) C.mandar({ tipo: 'combate', que: 'equipar', arma: 'espada_larga' });
  A.mandar({ tipo: 'estado', x: 0, y: 0, z: 0, giro: 0, anim: 'quieto' });
  A.mandar({ tipo: 'combate', que: 'reiniciar' }); B.mandar({ tipo: 'combate', que: 'reiniciar' });   // sanos (si alguno cayó)
  A.mandar({ tipo: 'combate', que: 'arma', sacada: false });
  await pausa(600);
  const marca = Date.now();
  A.mandar({ tipo: 'combate', que: 'arma', sacada: true });
  const visto = await B.esperar(m => m.tipo === 'luchadores' && m.llega > marca && m.lista.some(l => l.autor === a && l.sacada));
  comprobar('el otro ve que has sacado el arma', !!visto);
  const heridasAntes = s.combate.luchadores[b].heridas.length;
  A.mandar({ tipo: 'combate', que: 'cargar', linea: 'alto' });
  await pausa(250);
  A.mandar({ tipo: 'combate', que: 'descargar' });
  const gm = await B.esperar(m => m.tipo === 'combate' && m.eventos.some(e => e.tipo === 'golpe' && e.autor === a && e.linea === 'alto' && e.t > (visto.t || 0)), 6000);
  const em = gm.eventos.find(e => e.tipo === 'golpe' && e.autor === a && e.linea === 'alto');
  comprobar('el golpe cargado en el mundo le hiere de verdad, con tu autor', em.objetivo === b && em.resultado === 'herida' && s.combate.luchadores[b].heridas.length === heridasAntes + 1, `${em.resultado}`);

  // el duelo con lo que llevas: le protege lo que tiene puesto en el inventario del servidor, y al quitárselo deja de
  const mismas = (autor) => JSON.stringify(s.combate.luchadores[autor].puestas) === JSON.stringify(puestasDe(s.objetos.invs.de(autor).lugares));
  comprobar('el luchador lleva lo que tiene puesto en el inventario del servidor', mismas(a) && mismas(b), s.combate.luchadores[b].puestas.join(', '));
  const antes = s.combate.luchadores[b].puestas.length;
  B.mandar({ tipo: 'objeto', id: 77, accion: { tipo: 'quitarse', lugar: 'ropa:interior', a: 'mano:der' } });
  await B.esperar(m => m.tipo === 'resultado_objeto' && m.id === 77 && m.ok);
  await pausa(300);
  const fb = lb(A);
  comprobar('al quitarse la camisa, el combate lo sabe y el otro lo ve', mismas(b) && s.combate.luchadores[b].puestas.length === antes - 1
    && !s.combate.luchadores[b].puestas.includes('camisa_lino') && fb && Array.isArray(fb.prendas) && !fb.prendas.includes('camisa_lino'), (fb?.prendas || []).join(', '));

  // al irse fuera de su tierra, se queda dormido y atacable unos minutos: su luchador sigue (GDD, apartado 6)
  B.ws.close();
  await pausa(300);
  comprobar('al irse un jugador fuera de su tierra, su luchador sigue en el combate (dormido, atacable unos minutos)', !!s.combate.luchadores[b] && s.dormidos.atacable(b, Date.now()));
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
