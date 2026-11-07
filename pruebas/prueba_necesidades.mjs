// Las necesidades (P4; src/logica/necesidades.js y servidor/servidor.mjs). Ejecutar: node pruebas/prueba_necesidades.mjs
// Comprueba la lógica: empiezan a 0; el hambre llega al máximo en 90 minutos y la sed en 60 (la sed, más rápida); el
// frío va hacia lo que pide el sitio; correr y cargar cansan, quieto se descansa; cada acción cansa lo suyo; al máximo
// de hambre o sed el cansancio sube el doble; con el cansancio al máximo no se corre ni se golpea fuerte; avisos desde
// 40 (fuerte desde 75); lo guardado se limpia. Y con el servidor de verdad: la bienvenida trae las del personaje (un
// jugador nuevo, a 0), le llegan solas cada segundo y suben con el tiempo; correr (lo que el servidor le ve andar, no lo
// que diga el navegador) cansa y quieto descansa; las acciones cansan; a otro jugador no le llegan las tuyas; se
// guardan al salir y al volver (con su ficha) siguen como estaban.
// MUTAR=1: el servidor no las avanza (sed y hambre quietas); MUTAR=2: el cansancio sale de lo que dice el navegador
// (su «anim»), no de lo que corre de verdad; MUTAR=3: rendido sin llegar al máximo (el servidor no recorta). Las tres
// deben FALLAR. MUTAR=4: se bebe en cualquier sitio (sin mirar si hay agua); MUTAR=5: se come sin gastar lo que llevas. Tienen que FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { nuevas, avanzar, esfuerzo, saciar, efectos, avisos, validarNecesidades, factorVelocidad, hayAguaCerca, RITMOS, ESFUERZOS, AVISO, FUERTE, TRAGO, ESPERA_TRAGO, NUTRE, comestible } from '../src/logica/necesidades.js';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { PresenciaServidor } from '../src/logica/presencia.js';

const MUTAR = process.env.MUTAR;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

console.log('La lógica');
{
  const n0 = nuevas();
  comprobar('empiezan a 0', Object.values(n0).every(v => v === 0) && Object.keys(n0).join() === 'hambre,sed,frio,cansancio');
  // minuto a minuto, quieto: cuándo llegan al máximo
  let n = n0, tH = null, tS = null;
  for (let m = 1; m <= 120; m++) { n = avanzar(n, 60); if (tH === null && n.hambre >= 100) tH = m; if (tS === null && n.sed >= 100) tS = m; }
  comprobar('el hambre llega al máximo en 90 minutos sin comer (dos comidas por día de juego como poco)', tH === 90, `${tH} min`);
  comprobar('y la sed en 60, más rápida', tS === 60, `${tS} min`);
  comprobar('no pasan de 100', n.hambre === 100 && n.sed === 100);
  let f = nuevas(); for (let i = 0; i < 600; i++) f = avanzar(f, 1, { frioObjetivo: 80 });
  comprobar('el frío va hacia lo que pide el sitio (en 10 minutos, casi entero)', f.frio > 70 && f.frio < 80, f.frio.toFixed(1));
  let g = f; for (let i = 0; i < 1200; i++) g = avanzar(g, 1, { frioObjetivo: 0 });
  comprobar('y baja cuando el sitio no lo pide', g.frio < 5, g.frio.toFixed(1));
  const corre = avanzar(nuevas(), 10, { velocidad: 6 }), anda = avanzar({ ...nuevas(), cansancio: 50 }, 10, { velocidad: 1.5 }), quieto = avanzar({ ...nuevas(), cansancio: 50 }, 10);
  comprobar('correr cansa (10 s, 5 puntos)', Math.abs(corre.cansancio - 10 * RITMOS.correr) < 1e-9, corre.cansancio.toFixed(2));
  comprobar('quieto se descansa más que andando', quieto.cansancio < anda.cansancio && anda.cansancio < 50, `${quieto.cansancio.toFixed(1)} y ${anda.cansancio.toFixed(1)}`);
  const carga = avanzar(nuevas(), 10, { velocidad: 1.5, kilos: 12 });
  comprobar('andar con un tronco (12 kg) al hombro cansa', carga.cansancio > 0, carga.cansancio.toFixed(2));
  comprobar('cada acción cansa lo suyo (talar 1,5; obra 2)', esfuerzo(nuevas(), 'talar').cansancio === ESFUERZOS.talar && esfuerzo(nuevas(), 'trabajar').cansancio === ESFUERZOS.trabajar && esfuerzo(nuevas(), 'bailar').cansancio === 0);
  const hambriento = { ...nuevas(), hambre: 100 };
  comprobar('con hambre al máximo, el cansancio sube el doble', avanzar(hambriento, 10, { velocidad: 6 }).cansancio === 2 * corre.cansancio && esfuerzo(hambriento, 'talar').cansancio === 2 * ESFUERZOS.talar);
  comprobar('y las heridas se curan despacio', efectos(hambriento).curacionLenta && !efectos(nuevas()).curacionLenta);
  const rendido = { ...nuevas(), cansancio: 100 };
  comprobar('con el cansancio al máximo, ni correr ni golpear fuerte', efectos(rendido).sinCorrer && efectos(rendido).golpeFlojo && !efectos(nuevas()).sinCorrer);
  comprobar('con el frío al máximo, torpe', efectos({ ...nuevas(), frio: 100 }).torpe);
  const av = avisos({ hambre: AVISO - 1, sed: AVISO, frio: 0, cansancio: FUERTE });
  comprobar(`avisos desde ${AVISO} y en fuerte desde ${FUERTE}`, av.length === 2 && av[0].que === 'sed' && !av[0].fuerte && av[1].que === 'cansancio' && av[1].fuerte, JSON.stringify(av));
  comprobar('comer y beber bajan lo suyo, sin pasar de 0', saciar({ ...nuevas(), hambre: 30 }, 'hambre', 50).hambre === 0 && saciar({ ...nuevas(), sed: 80 }, 'sed', 30).sed === 50);
  comprobar('lo guardado se limpia (números raros, fuera)', JSON.stringify(validarNecesidades({ hambre: 150, sed: -3, frio: 'x', cansancio: 12, otra: 5 })) === JSON.stringify({ hambre: 100, sed: 0, frio: 0, cansancio: 12 }));
}

console.log('Lo que se puede mover (el servidor no deja correr al rendido)');
{
  comprobar('rendido, 0,6 (andar sí, correr no); helado, 0,8; descansado, 1', factorVelocidad({ ...nuevas(), cansancio: 100 }) === 0.6 && factorVelocidad({ ...nuevas(), frio: 100 }) === 0.8 && factorVelocidad(nuevas()) === 1);
  // 20 s corriendo a 6 m/s (un paso cada 100 ms) lejos de la salida: cuánto recorta el servidor
  const recorta = (vel) => {
    const P = new PresenciaServidor();
    P.anclar('a', { x: 100, z: 100 }, 0);
    let r = 0;
    for (let i = 1; i <= 200; i++) { const x = P.recibir('a', { x: 100 + i * 0.6, y: 0, z: 100, giro: 0, anim: 'correr' }, i * 100, { vel }); r += x ? x.recortado : 0; }
    return r;
  };
  const rDesc = recorta(factorVelocidad(nuevas())), rRend = recorta(factorVelocidad({ ...nuevas(), cansancio: MUTAR === '3' ? 99 : 100 }));
  comprobar('descansado, corre sin que el servidor le recorte', rDesc === 0, `${rDesc.toFixed(2)} m`);
  comprobar('rendido, el servidor le recorta lo que corre de más', rRend > 3, `${rRend.toFixed(2)} m`);
}

console.log('Beber del río (la lógica)');
{
  const rio = (x, z) => (x > 10 ? 1 : null);   // agua de x = 10 en adelante
  comprobar('con el agua a 1 m, hay agua cerca; a 2,5 m, también; a 4 m, no', hayAguaCerca(rio, 9, 0) && hayAguaCerca(rio, 7.6, 0) && !hayAguaCerca(rio, 6, 0));
  comprobar('dentro del agua, también', hayAguaCerca(rio, 12, 0));
  comprobar(`un trago baja la sed ${TRAGO} y van uno cada ${ESPERA_TRAGO / 1000} s`, saciar({ ...nuevas(), sed: 70 }, 'sed', TRAGO).sed === 40 && ESPERA_TRAGO >= 1000);
}

console.log('Con el servidor de verdad');
let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (['1', '2', '4', '5'].includes(MUTAR)) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = MUTAR === '1' ? fuente.replace('necesidades.set(a, avanzarNecesidades(', 'necesidades.set(a, ((n) => n)(')
    : MUTAR === '2' ? fuente.replace("const velocidad = e && p && dt > 0 ? Math.hypot(e.x - p.x, e.z - p.z) / dt : 0;", "const velocidad = e && e.anim === 'correr' ? 6 : 0;")
    : MUTAR === '4' ? fuente.replace('if (!terreno || !p || !hayAguaCerca(terreno.aguaEn, p.x, p.z))', 'if (!terreno || !p)')
    : fuente.replace('else r = inv.gastar(tipo, 1);', 'else r = { ok: true };');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_necesidades.mjs');
  writeFileSync(copia, mutada.replaceAll("from '../src/", "from '../src/"));
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);
function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? `/?ficha=${encodeURIComponent(ficha)}` : ''}`);
    const c = { ws, recibidas: [], id: 0 };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estar = (x, z, anim = 'andar') => c.mandar({ tipo: 'estado', x, y: 2, z, giro: 0, anim });
    c.ultima = () => c.recibidas[c.recibidas.length - 1];
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') { c.bienvenida = m; listo(c); }
      if (m.tipo === 'necesidades') c.recibidas.push(m.necesidades);
    });
    ws.on('error', fallo);
  });
}
const dir = mkdtempSync(join(tmpdir(), 'kinhold-necesidades-'));
let srv = null;
try {
  srv = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), arconPruebas: true, altas: { origen: 1e6, total: 1e6, espera: 0 }, limiteMovimiento: false, ticoNecesidades: 250, latido: 1000 });
  const puerto = await srv.listo;
  const a = await cliente(puerto), b = await cliente(puerto);
  comprobar('la bienvenida trae sus necesidades: un jugador nuevo, a 0', JSON.stringify(a.bienvenida.necesidades) === JSON.stringify(nuevas()), JSON.stringify(a.bienvenida.necesidades));
  a.estar(0, 0, 'quieto'); b.estar(30, 0, 'quieto');
  await pausa(3000);
  const n1 = a.ultima();
  comprobar('le llegan solas, varias veces por segundo en la prueba (cada segundo en el de verdad)', a.recibidas.length >= 8, `${a.recibidas.length} en 3 s`);
  comprobar('suben solas con el tiempo: la sed más que el hambre', n1 && n1.sed > 0 && n1.hambre > 0 && n1.sed > n1.hambre, JSON.stringify(n1));
  // corre: 6 m/s de verdad (un paso de 0,6 m cada 100 ms), diciendo «andar»
  for (let i = 1; i <= 30; i++) { a.estar(i * 0.6, 0, 'andar'); await pausa(100); }
  await pausa(400);
  const n2 = a.ultima();
  comprobar('correr de verdad cansa (aunque el navegador diga que anda)', n2.cansancio >= 1, `${n2.cansancio}`);
  // dice que corre, pero está quieto
  for (let i = 0; i < 20; i++) { a.estar(18, 0, 'correr'); await pausa(100); }
  await pausa(300);
  const n3 = a.ultima();
  comprobar('decir que corre sin moverse no cansa: descansa', n3.cansancio < n2.cansancio, `${n2.cansancio} → ${n3.cansancio}`);
  // una acción: fabricar un cordel (con fibra del arcón de pruebas: coger del arcón no cansa; fabricar sí)
  const antesAcc = a.ultima().cansancio;
  const id = 77;
  const resp = new Promise(r => a.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'resultado_objeto' && m.id === id) r(m); }));
  a.mandar({ tipo: 'objeto', id, accion: { tipo: 'coger', objeto: 'fibra', cantidad: 3, a: 'mano:der' } });
  await resp;
  const id2 = 78;
  const resp2 = new Promise(r => a.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'resultado_objeto' && m.id === id2) r(m); }));
  a.mandar({ tipo: 'objeto', id: id2, accion: { tipo: 'fabricar', receta: 'cordel', estacion: null, x: 18, z: 0 } });
  const rf = await resp2;
  await pausa(400);
  comprobar('lo que hace cansa (fabricar un cordel)', rf.ok && a.ultima().cansancio > antesAcc - 0.5 + ESFUERZOS.fabricar - 0.5, `${rf.ok ? '' : rf.motivo} ${antesAcc} → ${a.ultima().cansancio}`);
  comprobar('a otro jugador no le llegan las tuyas: las suyas, sin correr', b.recibidas.length > 0 && b.ultima().cansancio === 0, JSON.stringify(b.ultima()));
  // comer (P4): bayas del arcón de pruebas; una unidad cada vez, de lo que llevas, por el servidor
  {
    const pide = (id, accion) => new Promise(r => { a.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'resultado_objeto' && m.id === id) r(m); }); a.mandar({ tipo: 'objeto', id, accion }); });
    const yo = a.bienvenida.autor;
    await pide(80, { tipo: 'soltar', de: 'mano:der' }); await pide(81, { tipo: 'soltar', de: 'mano:izq' });
    let r = await pide(82, { tipo: 'comer', objeto: 'bayas' });
    comprobar('sin bayas encima, no se come', !r.ok && /No llevas/.test(r.motivo || ''), r.motivo);
    await pide(83, { tipo: 'coger', objeto: 'bayas', cantidad: 4, a: 'mano:der' });
    srv.necesidades.set(yo, { ...srv.necesidades.get(yo), hambre: 50 });
    r = await pide(84, { tipo: 'comer', objeto: 'bayas' });
    const inv = srv.objetos.invs.de(yo);
    comprobar(`comer una baya quita ${NUTRE.bayas} de hambre y gasta una`, r.ok && Math.abs(r.datos.hambre - (50 - NUTRE.bayas)) < 0.2 && inv.cuantos('bayas') === 3, `${JSON.stringify(r.datos || r.motivo)}, quedan ${inv.cuantos('bayas')}`);
    r = await pide(85, { tipo: 'comer', objeto: 'piedra' });
    comprobar('una piedra no se come', !r.ok && /no se come/.test(r.motivo || ''), r.motivo);
    comprobar('se comen las bayas y las setas', comestible('bayas') && comestible('setas') && !comestible('rama') && !comestible('toString'));
  }

  // salir y volver con la ficha
  const guardada = a.ultima(), ficha = a.bienvenida.ficha;
  a.ws.close(); await pausa(600);
  const archivo = srv.archivoNecesidades;
  const enArchivo = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8'))[a.bienvenida.autor] : null;
  comprobar('al salir se guardan (necesidades.json)', enArchivo && Math.abs(enArchivo.sed - guardada.sed) < 0.5, JSON.stringify(enArchivo));
  const a2 = await cliente(puerto, ficha);
  comprobar('al volver, el mismo personaje sigue como estaba', a2.bienvenida.autor === a.bienvenida.autor && Math.abs(a2.bienvenida.necesidades.sed - guardada.sed) < 0.5, JSON.stringify(a2.bienvenida.necesidades));
  a2.ws.close(); b.ws.close();
} catch (e) {
  mal++; console.log('  FALLA ' + (e && e.stack || e));
} finally {
  if (srv) await srv.cerrar();
  rmSync(dir, { recursive: true, force: true });
  if (copia) rmSync(copia, { force: true });
}
console.log('Beber con el servidor de verdad y el terreno de Whitholm');
{
  const T = terrenoWhitholm();
  // un sitio seco con agua al lado y otro seco sin agua, cerca de la salida
  let orilla = null, seco = null;
  for (let r = 5; r < 3000 && !(orilla && seco); r += 5) for (let k = 0; k < 48; k++) {
    const x = Math.cos(k / 48 * 2 * Math.PI) * r, z = Math.sin(k / 48 * 2 * Math.PI) * r;
    if (T.aguaEn(x, z) || !T.enIsla(x, z)) continue;
    const cerca = hayAguaCerca(T.aguaEn, x, z);
    if (cerca && !orilla) orilla = { x, z }; else if (!cerca && !seco) seco = { x, z };
  }
  comprobar('hay una orilla y un sitio seco cerca de la salida', !!orilla && !!seco, JSON.stringify({ orilla, seco }));
  const dir2 = mkdtempSync(join(tmpdir(), 'kinhold-beber-'));
  let srv2 = null;
  try {
    srv2 = crearServidor({ puerto: 0, archivo: join(dir2, 'mundo.jsonl'), terreno: T, altas: { origen: 1e6, total: 1e6, espera: 0 }, limiteMovimiento: false, salidaComun: true, ticoNecesidades: 250 });
    const puerto = await srv2.listo, c = await cliente(puerto);
    const beberAqui = async (p, idb) => {
      c.mandar({ tipo: 'estado', x: p.x, y: T.suelo(p.x, p.z), z: p.z, giro: 0, anim: 'quieto' }); await pausa(300);
      const r = new Promise(res => c.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'resultado_objeto' && m.id === idb) res(m); }));
      c.mandar({ tipo: 'objeto', id: idb, accion: { tipo: 'beber', x: p.x, z: p.z } });
      return r;
    };
    srv2.necesidades.set(c.bienvenida.autor, { ...nuevas(), sed: 70 });
    let r = await beberAqui(seco, 901);
    comprobar('en seco, sin agua al lado, no se bebe (lo mira el servidor, donde te tiene)', !r.ok && /no hay agua/.test(r.motivo || ''), r.motivo);
    r = await beberAqui(orilla, 902);
    comprobar(`en la orilla se bebe: la sed baja ${TRAGO}`, r.ok && Math.abs(r.datos.sed - (70 - TRAGO)) < 0.5, JSON.stringify(r.datos || r.motivo));
    r = await beberAqui(orilla, 903);
    comprobar('otro trago enseguida, no: trago a trago', !r.ok && /trago/.test(r.motivo || ''), r.motivo);
    await pausa(ESPERA_TRAGO);
    r = await beberAqui(orilla, 904);
    comprobar('pasado el rato, otro trago', r.ok && r.datos.sed < 70 - TRAGO, JSON.stringify(r.datos || r.motivo));
    c.ws.close();
  } catch (e) { mal++; console.log('  FALLA ' + (e && e.stack || e)); }
  finally { if (srv2) await srv2.cerrar(); rmSync(dir2, { recursive: true, force: true }); if (copia) rmSync(copia, { force: true }); }
}

console.log(`\n${ok} correctas, ${mal} fallan`);
process.exit(mal ? 1 : 0);
