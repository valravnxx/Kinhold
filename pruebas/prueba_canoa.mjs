// Pruebas de la canoa de un tronco (src/logica/canoa.js): vaciar el tronco largo con el hacha y las brasas, por
// tiempo transcurrido, hasta que queda la canoa en el suelo; y por la red (src/logica/objetos_red.js), con su autor.
// Ejecutar: node pruebas/prueba_canoa.mjs
// Con MUTAR=1 las brasas no esperan (QUEMA = 0) y basta una vuelta: las pruebas deben FALLAR.
import { Canoas, ejecutarCanoa, velocidadCanoa, nuevaRemada, pasoRemar, faseRemada, PALADA, VEL_MAX_REMAR, VEL_MAX_CANOA, HONDO_FLOTA, Vaciado, ejecutarVaciado, faseDe, fuegoCerca, progresoVaciado, GOLPES_DESBASTAR, GOLPES_RASPAR, VUELTAS, QUEMA, ENTRE_GOLPES } from '../src/logica/canoa.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Suelo, NO_DESAPARECE } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';
import { Rastras, DETRAS_TRONCO } from '../src/logica/rastra.js';
import { VEL_MAX } from '../src/logica/presencia.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 10, 16, 9);
// (con MUTAR, lo que se rompe a propósito: se miran las constantes de la lógica tal cual)
const quema = MUTAR ? 0 : QUEMA, vueltas = MUTAR ? 1 : VUELTAS;
const hoguera = (x, z, hasta) => ({ h1: { id: 'h1', tipo: 'hoguera', x, z, fuego: { hasta, combustible: 0, cenizas: false } } });

function nuevo(n = 1) {
  const suelo = new Suelo(), invs = new Inventarios(), reg = new RegistroAcciones();
  const o = suelo.dejar({ tipo: 'tronco_largo', n }, 0, 0, T0, 'ana', false, 0.3);
  return { suelo, invs, reg, va: new Vaciado(suelo), id: o.id };
}
// golpes hasta que se termine el paso (o falle); devuelve [golpes, último, hora]
function golpes(m, id, t, est = {}, autor = 'ana', max = 200) {
  let r, n = 0;
  for (; n < max; n++) {
    r = ejecutarVaciado(m.va, m.invs, m.reg, { autor, tipo: 'vaciar', objeto: id, x: 1, z: 0 }, t, est);
    t += ENTRE_GOLPES; n;
    if (!r.ok || r.termina) { n++; break; }
  }
  return [n, r, t];
}

console.log('El catálogo y el suelo');
{
  comprobar('la canoa y la canoa a medias son enormes (se arrastran)', CATALOGO.canoa.tam === 'E' && CATALOGO.canoa_a_medias.tam === 'E');
  comprobar('no desaparecen del suelo', NO_DESAPARECE.includes('canoa') && NO_DESAPARECE.includes('canoa_a_medias'));
}

console.log('Desbastar: con el hacha, a golpes; al primer golpe deja de ser un tronco');
{
  const m = nuevo();
  let r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, T0);
  comprobar('sin hacha, no', !r.ok && /hacha/.test(r.motivo), r.motivo);
  m.invs.de('ana').coger('hacha_piedra', 1, 'mano:der');
  r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 9, z: 0 }, T0);
  comprobar('lejos, no', !r.ok && /lejos/.test(r.motivo), r.motivo);
  r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, T0);
  const o = m.suelo.porId(m.id, T0);
  comprobar('el primer golpe vale y lo deja como canoa a medias', r.ok && o.cosa.tipo === 'canoa_a_medias' && o.cosa.vaciado.golpes === 1, JSON.stringify(o.cosa));
  r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, T0 + 100);
  comprobar('golpes demasiado seguidos, no', !r.ok);
  const [n, rf] = golpes(m, m.id, T0 + ENTRE_GOLPES);
  comprobar(`con hacha de piedra, ${GOLPES_DESBASTAR.piedra} golpes en total`, rf.ok && rf.termina && rf.paso === 'desbastar' && n + 1 === GOLPES_DESBASTAR.piedra, `${n + 1}`);
  comprobar('luego tocan las brasas', faseDe(o.cosa.vaciado, T0 + 1e5) === 'brasas');
  comprobar('lo que va a medias no desaparece', o.desaparece === null);
}

console.log('De una pila de troncos largos se aparta uno');
{
  const m = nuevo(3);
  m.invs.de('ana').coger('hacha_hierro', 1, 'mano:der');
  const r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, T0);
  const pila = m.suelo.porId(m.id, T0), nueva = m.suelo.porId(r.objeto, T0);
  comprobar('la pila queda con 2 y al lado una canoa a medias', r.ok && pila.cosa.n === 2 && pila.cosa.tipo === 'tronco_largo' && nueva && nueva.cosa.tipo === 'canoa_a_medias');
  const [n] = golpes(m, r.objeto, T0 + ENTRE_GOLPES);
  comprobar(`con hacha de hierro, ${GOLPES_DESBASTAR.hierro} golpes`, n + 1 === GOLPES_DESBASTAR.hierro, `${n + 1}`);
}

console.log('Las brasas (de una hoguera encendida al lado), por tiempo transcurrido, y raspar');
{
  const m = nuevo();
  m.invs.de('ana').coger('hacha_hierro', 1, 'mano:der');
  let [, , t] = golpes(m, m.id, T0);
  let r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, t, {});
  comprobar('sin hoguera, no se echan brasas', !r.ok && /hoguera/.test(r.motivo), r.motivo);
  r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, t, hoguera(20, 0, t + 1e6));
  comprobar('con la hoguera lejos, tampoco', !r.ok);
  r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, t, hoguera(5, 0, t - 1));
  comprobar('con la hoguera apagada, tampoco', !r.ok);
  comprobar('fuegoCerca mira el fuego vivo y la distancia', fuegoCerca(hoguera(5, 0, t + 1), 1, 0, t) && !fuegoCerca(hoguera(5, 0, t + 1), -6, 0, t));
  const est = hoguera(5, 0, t + 1e8);
  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, t, est);
    comprobar(`vuelta ${vuelta + 1}: se echan las brasas`, r.ok && r.paso === 'brasas');
    t += ENTRE_GOLPES;
    r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, t, est);
    comprobar(`vuelta ${vuelta + 1}: mientras arden no se raspa`, !r.ok && r.paso === 'quemando', r.motivo);
    t += quema;
    const o = m.suelo.porId(m.id, t);
    comprobar(`vuelta ${vuelta + 1}: pasados 10 min, toca raspar`, faseDe(o.cosa.vaciado, t) === 'raspar');
    const [n, rf, t2] = golpes(m, m.id, t, est);
    t = t2;
    comprobar(`vuelta ${vuelta + 1}: se raspa en ${GOLPES_RASPAR.hierro} golpes de hierro`, rf.ok && rf.termina && n === GOLPES_RASPAR.hierro, `${n}`);
  }
  const o = m.suelo.porId(m.id, t);
  comprobar(`tras ${VUELTAS} vueltas queda la canoa en el suelo`, o && o.cosa.tipo === 'canoa' && !o.cosa.vaciado, o && o.cosa.tipo);
  comprobar('la canoa no se coge con las manos', !m.suelo.coger(m.invs.de('ana'), o.id, 0, 0, t).ok);
  comprobar('el progreso de una a medias va de 0 a 1', progresoVaciado({ fase: 'desbastar', golpes: 0, vuelta: 0 }, t) === 0 && progresoVaciado({ fase: 'raspar', golpes: GOLPES_RASPAR.piedra, vuelta: VUELTAS - 1 }, t) === 1);
}

console.log('Lo atado no se vacía; lo que no es un tronco largo, tampoco');
{
  const m = nuevo();
  m.invs.de('ana').coger('hacha_piedra', 1, 'mano:der');
  m.suelo.porId(m.id, T0).arrastra = 'eva';
  let r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, T0);
  comprobar('atado, no', !r.ok && /atado/.test(r.motivo));
  const c = m.suelo.dejar({ tipo: 'tronco_corto', n: 1 }, 0, 3, T0, 'ana', false);
  r = ejecutarVaciado(m.va, m.invs, m.reg, { autor: 'ana', tipo: 'vaciar', objeto: c.id, x: 0, z: 2 }, T0);
  comprobar('el tronco corto, no', !r.ok);
  r = ejecutarVaciado(m.va, m.invs, m.reg, { tipo: 'vaciar', objeto: m.id, x: 1, z: 0 }, T0);
  comprobar('sin autor, no', !r.ok && /autor/.test(r.motivo));
  comprobar('se anota en el registro', m.reg.entradas.length >= 3);
}

console.log('Por la red (objetos_red): con su autor, desde donde el servidor lo tiene, y la hoguera del servidor');
{
  const pos = { ana: { x: 1, z: 0 } };
  const S = new ObjetosServidor({ posicion: a => pos[a] || null, enTierras: () => false });
  const o = S.suelo.dejar({ tipo: 'tronco_largo', n: 1 }, 0, 0, T0, 'ana', false, 0);
  S.invs.de('ana').coger('hacha_hierro', 1, 'mano:der');
  let t = T0, r;
  for (let i = 0; i < GOLPES_DESBASTAR.hierro; i++) { r = S.ejecutar({ autor: 'ana', tipo: 'vaciar', objeto: o.id, x: 1, z: 0 }, t); t += 1000; }
  comprobar('desbastado por la red', r.ok && r.termina && r.suelo, JSON.stringify({ ok: r.ok, m: r.motivo }));
  r = S.ejecutar({ autor: 'ana', tipo: 'vaciar', objeto: o.id, x: 1, z: 0 }, t);
  comprobar('sin hoguera en el servidor, no hay brasas', !r.ok && /hoguera/.test(r.motivo));
  S.fab.estaciones.h1 = { id: 'h1', tipo: 'hoguera', x: 4, z: 0, fuego: { hasta: t + 1e7, combustible: 0, cenizas: false } };
  r = S.ejecutar({ autor: 'ana', tipo: 'vaciar', objeto: o.id, x: 1, z: 0 }, t);
  comprobar('con la hoguera del servidor ardiendo, sí', r.ok && r.paso === 'brasas' && r.suelo);
  pos.ana = { x: 30, z: 0 };
  r = S.ejecutar({ autor: 'ana', tipo: 'vaciar', objeto: o.id, x: 1, z: 0 }, t + QUEMA);
  comprobar('si el servidor no te tiene ahí, no', !r.ok);
  comprobar('lo a medias se guarda con el suelo', JSON.stringify(S.suelo.exportar()).includes('"vaciado"'));
  const s2 = new Suelo().importar(S.suelo.exportar());
  comprobar('y se carga igual', s2.porId(o.id, t).cosa.vaciado.fase === 'quemando');
}

console.log('La canoa se arrastra a cuerda hasta la orilla (como el tronco largo)');
{
  const suelo = new Suelo(), invs = new Inventarios(), ra = new Rastras(suelo);
  const c = suelo.dejar({ tipo: 'canoa', n: 1 }, 0, 0, T0, 'ana', false, 0);
  let r = ra.atarTronco(invs.de('ana'), c.id, 1, 0, T0, 'ana');
  comprobar('sin cuerda en la mano, no', !r.ok && /cuerda/.test(r.motivo), r.motivo);
  invs.de('ana').coger('cuerda', 1, 'mano:izq');
  r = ra.atarTronco(invs.de('ana'), c.id, 1, 0, T0, 'ana');
  comprobar('con la cuerda en la mano, se ata', r.ok && c.arrastra === 'ana' && ra.troncoDe('ana', T0) === c);
  r = ra.atarTronco(invs.de('eva'), c.id, 1, 0, T0, 'eva');
  invs.de('eva').coger('cuerda', 1, 'mano:izq');
  r = ra.atarTronco(invs.de('eva'), c.id, 1, 0, T0, 'eva');
  comprobar('otro ayuda a tirar', r.ok && r.ayuda && c.ayuda === 'eva');
  ra.soltarTronco(invs.de('eva'), 'eva', 1, 0, undefined, undefined, T0, 0);
  r = ra.soltarTronco(invs.de('ana'), 'ana', 20, 0, undefined, undefined, T0, Math.PI / 2);
  comprobar('soltada, queda detrás del que tiraba', r.ok && Math.abs(Math.hypot(c.x - 20, c.z) - DETRAS_TRONCO) < 0.05 && !c.arrastra, `${c.x}, ${c.z}`);
  comprobar('y sigue siendo la canoa', suelo.porId(c.id, T0 + 1e9).cosa.tipo === 'canoa');
}

console.log('Echar la canoa al agua, subir y remar (P11d)');
{
  // la orilla en x = 5: más allá, el agua, medio metro más honda por metro (a 7,5 m ya no se hace pie)
  const agua = (x) => (x > 5 ? (x - 5) * 0.5 : null);
  const suelo = new Suelo(), invs = new Inventarios(), reg = new RegistroAcciones(), ca = new Canoas(suelo, (x) => agua(x));
  const c = suelo.dejar({ tipo: 'canoa', n: 1 }, 3, 0, T0, 'ana', false, 0);
  const A = (autor, tipo, d) => ejecutarCanoa(ca, invs, reg, { autor, tipo, x: d.x, z: d.z ?? 0, ...d }, T0, { x: d.x, z: d.z ?? 0, giro: Math.PI / 2 });
  let r = A('ana', 'subir_canoa', { objeto: c.id, x: 3 });
  comprobar('en tierra no se sube: hay que echarla antes al agua', !r.ok && /agua/.test(r.motivo), r.motivo);
  r = A('ana', 'echar_canoa', { objeto: c.id, x: 2, rx: 5.2, rz: 0 });
  comprobar('donde casi no hay agua, no flota', !r.ok && /flote/.test(r.motivo), r.motivo);
  r = A('ana', 'echar_canoa', { objeto: c.id, x: 2, rx: 9, rz: 0 });
  comprobar('más allá de lo que se empuja, no', !r.ok, r.motivo);
  r = A('ana', 'echar_canoa', { objeto: c.id, x: -2, rx: 7, rz: 0 });
  comprobar('lejos de la canoa, no se empuja', !r.ok && /lejos/.test(r.motivo), r.motivo);
  invs.de('ana').coger('cuerda', 1, 'mano:der');
  r = A('ana', 'echar_canoa', { objeto: c.id, x: 2, rx: 6.5, rz: 0 });
  comprobar('con algo en la mano que no es el remo, no se empuja', !r.ok && /manos/.test(r.motivo), r.motivo);
  invs.de('ana').lugares['mano:der'] = { tipo: 'remo', n: 1 };
  r = A('ana', 'echar_canoa', { objeto: c.id, x: 2, rx: 6.5, rz: 0 });
  comprobar('desde la orilla, con el remo en la mano, al agua', r.ok && c.agua && c.x === 6.5 && agua(c.x) >= HONDO_FLOTA, r.motivo);
  r = A('ana', 'subir_canoa', { objeto: c.id, x: 8.4 });
  comprobar('nadando no se sube', !r.ok && /Nadando/.test(r.motivo), r.motivo);
  r = A('ana', 'subir_canoa', { objeto: c.id, x: 5.5 });
  comprobar('desde el agua poco honda se sube, y el primero rema', r.ok && c.rema === 'ana' && ca.deAutor('ana', T0) === c, r.motivo);
  r = A('eva', 'subir_canoa', { objeto: c.id, x: 4.5 });
  comprobar('desde la orilla sube otro, sentado', r.ok && c.pasajero === 'eva', r.motivo);
  r = A('teo', 'subir_canoa', { objeto: c.id, x: 4.5 });
  comprobar('no caben tres', !r.ok && /dos/.test(r.motivo), r.motivo);
  invs.de('teo').coger('cuerda', 1, 'mano:izq');
  r = new Rastras(suelo).atarTronco(invs.de('teo'), c.id, 4.5, 0, T0, 'teo');
  comprobar('con gente dentro no se ata', !r.ok && /alguien/.test(r.motivo), r.motivo);
  // remar a paladas (17 nov, valravnx: «un tironcillo… por el otro, otro tironcillo… de manera realista»): cada tirón la
  // acelera y entre uno y otro se frena; alternando lados va recta con su vaivén; para girar, rema de un solo lado
  {
    const s = nuevaRemada(); let rumbo = 0, minV = 99, maxV = 0, suma = 0, n = 0, rumboMax = 0; const lados = [];
    for (let t = 0; t < 20; t += 0.05) {
      pasoRemar(s, { rema: true, giro: -rumbo }, 0.05); rumbo += s.w * 0.05;
      if (t > 10) { minV = Math.min(minV, s.v); maxV = Math.max(maxV, s.v); suma += s.v; n++; rumboMax = Math.max(rumboMax, Math.abs(rumbo)); }
      if (!lados.length || lados[lados.length - 1] !== s.lado) lados.push(s.lado);
    }
    comprobar('remando, a ritmo de canoa: unos 4 m/s de media (entre 3 y 5), no la velocidad fija de antes', suma / n > 3 && suma / n < 5, `${(suma / n).toFixed(2)} m/s`);
    comprobar('a tirones: sube y baja a cada palada (más de 0,3 m/s entre lo más lento y lo más rápido)', maxV - minV > 0.3, `${minV.toFixed(2)}–${maxV.toFixed(2)} m/s`);
    comprobar('una palada por un lado y la siguiente por el otro (casi siempre: si se tuerce, corrige por el lado que toca)', lados.length > 12, `${lados.length} cambios de lado en 20 s`);
    comprobar('alternando lados, va recta (se tuerce menos de 8°)', rumboMax < 0.14, `${(rumboMax * 57.3).toFixed(1)}°`);
    const fase = faseRemada(s);
    comprobar('la fase de la palada, para la animación', fase && (fase.lado === 'r' || fase.lado === 'l') && fase.fase >= 0 && fase.fase < 1, JSON.stringify(fase));
    const g = nuevaRemada(); let r = 0, tg = 0;
    while (r < Math.PI / 2 - 0.15 && tg < 30) { pasoRemar(g, { rema: true, giro: Math.PI / 2 - r }, 0.05); r += g.w * 0.05; tg += 0.05; }
    comprobar('para girar a la izquierda rema por la derecha, y gira (casi 90° en menos de 10 s)', tg < 10 && g.lado === 'r', `${tg.toFixed(1)} s`);
    const d = nuevaRemada(); let td = 0;
    while (d.v < 3 && td < 20) { pasoRemar(d, { rema: true }, 0.05); td += 0.05; }
    let tp = 0; while (d.v > 0.1 && tp < 60) { pasoRemar(d, { rema: false }, 0.05); tp += 0.05; }
    comprobar('arranca en unas pocas paladas y, sin remar, sigue un poco y se para', td > PALADA && td < 6 && tp > 2 && tp < 20, `a 3 m/s en ${td.toFixed(1)} s; parada en ${tp.toFixed(1)} s`);
    comprobar('el servidor deja ir lo más deprisa remando, con la corriente', VEL_MAX_CANOA >= VEL_MAX_REMAR + 3 && maxV <= VEL_MAX_REMAR);
  }
  const deriva = velocidadCanoa({ dir: { x: 1, z: 0 }, remando: false, corriente: { dx: 0, dz: 1.2 } });
  comprobar('sin remar, a la deriva con la corriente del río', deriva.vx === 0 && Math.abs(deriva.vz - 1.2) < 1e-9);
  const mar = velocidadCanoa({ corriente: { dx: 2, dz: 0 }, mar: true });
  comprobar('en el mar, a la deriva despacio', mar.vx > 0 && mar.vx <= 0.5, `${mar.vx} m/s`);
  // bajar: solo en la orilla; el que rema deja la canoa donde está él
  r = ejecutarCanoa(ca, invs, reg, { autor: 'ana', tipo: 'bajar_canoa', x: 20, z: 0, bx: 21, bz: 0 }, T0, { x: 20, z: 0, giro: 0 });
  comprobar('en medio del agua no se baja', !r.ok && /orilla/.test(r.motivo), r.motivo);
  r = ejecutarCanoa(ca, invs, reg, { autor: 'ana', tipo: 'bajar_canoa', x: 6, z: 3, bx: 4.6, bz: 3 }, T0, { x: 6, z: 3, giro: 0 });
  comprobar('en la orilla se baja; la canoa se queda donde iba, a flote, y rema el otro', r.ok && c.x === 6 && c.z === 3 && c.agua && c.rema === 'eva' && !c.pasajero, r.motivo);
  r = ejecutarCanoa(ca, invs, reg, { autor: 'ana', tipo: 'bajar_canoa', x: 6, z: 3, bx: 4.6, bz: 3 }, T0, { x: 6, z: 3 });
  comprobar('el que ya se bajó no se vuelve a bajar', !r.ok);
  comprobar('cada acción, en el registro con su autor', reg.entradas.filter(e => e.accion && /_canoa$/.test(e.accion.tipo)).every(e => e.accion.autor));
}

console.log('La canoa por la red: el servidor mira el agua de su terreno y el que se va se baja');
{
  const pos = { ana: { x: 2, z: 0, giro: Math.PI / 2 } };
  const S = new ObjetosServidor({ posicion: a => pos[a] || null, terreno: { aguaEn: (x) => (x > 5 ? (x - 5) * 0.5 : null), suelo: () => 0 } });
  const c = S.suelo.dejar({ tipo: 'canoa', n: 1 }, 3, 0, T0, 'ana', false, 0);
  let r = S.ejecutar({ autor: 'ana', tipo: 'echar_canoa', objeto: c.id, x: 2, z: 0, rx: 6.5, rz: 0 }, T0);
  comprobar('echarla al agua cambia el suelo de todos', r.ok && r.suelo && c.agua, r.motivo);
  pos.ana = { x: 5.4, z: 0 };
  r = S.ejecutar({ autor: 'ana', tipo: 'subir_canoa', objeto: c.id, x: 5.4, z: 0 }, T0);
  comprobar('sube', r.ok && c.rema === 'ana', r.motivo);
  pos.ana = { x: 40, z: 2, giro: 0 };   // ha remado hasta allí
  comprobar('se va del juego remando: se baja y la canoa se queda allí, a flote', S.soltarAlSalir('ana', T0) && c.x === 40 && c.z === 2 && c.agua && !c.rema);
  const s2 = new Suelo().importar(S.suelo.exportar());
  comprobar('a flote se guarda con el suelo', s2.porId(c.id, T0).agua === true);
}

console.log('La canoa se queda donde la dejas: en tu tierra, a tu guarda; fuera, cualquiera se la lleva (P11d)');
{
  // la tierra de ana: x < 0 (y la de nadie, x >= 0); el agua, de x > 5
  const pos = { ana: { x: -3, z: 0 }, eva: { x: -3, z: 1 } };
  const suya = (a, x) => (MUTAR ? true : a === 'ana' && x < 0);
  const S = new ObjetosServidor({ posicion: a => pos[a] || null, suTierra: (a, x, z) => suya(a, x, z), terreno: { aguaEn: (x) => (x > 5 || x < -5 ? Math.abs(x) - 5 : null), suelo: () => 0 } });
  for (const a of ['ana', 'eva']) S.invs.de(a).lugares['mano:der'] = { tipo: 'cuerda', n: 1 };
  const c = S.suelo.dejar({ tipo: 'canoa', n: 1 }, -3, 0, T0, 'ana', false, 0);
  // ana la ata y la suelta en su tierra
  let r = S.ejecutar({ autor: 'ana', tipo: 'atar_tronco', objeto: c.id, x: -3, z: 0 }, T0);
  pos.ana = { x: -1, z: 0, giro: Math.PI / 2 };
  r = S.ejecutar({ autor: 'ana', tipo: 'soltar_tronco', x: -1, z: 0 }, T0);
  comprobar('soltada la cuerda en su tierra, la canoa queda a su guarda', r.ok && c.guarda === 'ana' && r.guarda === 'ana', JSON.stringify({ r: r.motivo, g: c.guarda }));
  r = S.ejecutar({ autor: 'eva', tipo: 'atar_tronco', objeto: c.id, x: -3, z: 1 }, T0);
  comprobar('otro no la ata (en tierra de otro)', !r.ok && /tierras de otro/.test(r.motivo), r.motivo);
  // ana la echa al agua de su tierra (x < -5)
  S.invs.de('ana').lugares['mano:der'] = null; S.invs.de('eva').lugares['mano:der'] = null;
  pos.ana = { x: -4, z: 0 }; pos.eva = { x: -4, z: 1 };
  r = S.ejecutar({ autor: 'eva', tipo: 'echar_canoa', objeto: c.id, x: -4, z: 1, rx: -6.5, rz: 0 }, T0);
  comprobar('otro no la echa al agua', !r.ok && /tierras de otro/.test(r.motivo), r.motivo);
  r = S.ejecutar({ autor: 'ana', tipo: 'echar_canoa', objeto: c.id, x: -4, z: 0, rx: -6.5, rz: 0 }, T0);
  comprobar('ella sí, y a flote en su tierra sigue a su guarda', r.ok && c.agua && c.guarda === 'ana', r.motivo);
  pos.eva = { x: -5.4, z: 0 };
  r = S.ejecutar({ autor: 'eva', tipo: 'subir_canoa', objeto: c.id, x: -5.4, z: 0 }, T0);
  comprobar('otro no se sube a remarla', !r.ok && /tierras de otro/.test(r.motivo), r.motivo);
  pos.ana = { x: -5.4, z: 0 };
  r = S.ejecutar({ autor: 'ana', tipo: 'subir_canoa', objeto: c.id, x: -5.4, z: 0 }, T0);
  comprobar('ella sube, y con ella dentro la canoa no tiene guarda', r.ok && c.rema === 'ana' && !c.guarda, r.motivo);
  r = S.ejecutar({ autor: 'eva', tipo: 'subir_canoa', objeto: c.id, x: -5.4, z: 0 }, T0);
  comprobar('con ella remando, cabe otro delante', r.ok && c.pasajero === 'eva', r.motivo);
  // reman hasta el agua de nadie (x > 5) y se bajan
  pos.ana = { x: 6, z: 0, giro: 0 }; pos.eva = { x: 6, z: 0 };
  r = S.ejecutar({ autor: 'eva', tipo: 'bajar_canoa', x: 6, z: 0, bx: 5, bz: 0 }, T0);
  r = S.ejecutar({ autor: 'ana', tipo: 'bajar_canoa', x: 6, z: 0, bx: 5, bz: 0 }, T0);
  comprobar('dejada fuera de su tierra, no tiene guarda', r.ok && !c.guarda && !r.guarda && c.agua && !c.rema, r.motivo);
  pos.eva = { x: 5.4, z: 0 };
  r = S.ejecutar({ autor: 'eva', tipo: 'subir_canoa', objeto: c.id, x: 5.4, z: 0 }, T0);
  comprobar('fuera, cualquiera se sube y se la lleva', r.ok && c.rema === 'eva', r.motivo);
  // eva se va del juego en el agua de la tierra de ana: no es la suya, sin guarda
  pos.eva = { x: -6, z: 0, giro: 0 };
  comprobar('el que se va en tierra que no es la suya la deja sin guarda', S.soltarAlSalir('eva', T0) && !c.guarda && c.x === -6);
  // ana la vuelve a coger y se va del juego en su tierra: a su guarda
  pos.ana = { x: -5.6, z: 0 };
  r = S.ejecutar({ autor: 'ana', tipo: 'subir_canoa', objeto: c.id, x: -5.6, z: 0 }, T0);
  pos.ana = { x: -7, z: 0, giro: 0 };
  comprobar('la que se va del juego en su tierra la deja a su guarda', r.ok && S.soltarAlSalir('ana', T0) && c.guarda === 'ana');
  // varada en la orilla o a flote, no desaparece y se guarda con su guarda
  const lejos = T0 + 40 * 24 * 3600 * 1000;
  const s2 = new Suelo().importar(S.suelo.exportar());
  const c2 = s2.porId(c.id, lejos);
  comprobar('no desaparece y se guarda con su guarda', !!c2 && c2.guarda === 'ana' && c2.agua === true && S.suelo.porId(c.id, lejos));
  // la canoa recién vaciada en tu tierra, a tu guarda
  for (const [autor, x, guarda] of [['ana', -1, 'ana'], ['eva', -1, undefined], ['ana', 3, undefined]]) {
    const S2 = new ObjetosServidor({ posicion: () => ({ x, z: 0 }), suTierra: (a, xx, z) => suya(a, xx, z) });
    const m = S2.suelo.dejar({ tipo: 'canoa_a_medias', n: 1, vaciado: { fase: 'raspar', golpes: GOLPES_RASPAR.piedra - 1, vuelta: VUELTAS - 1, hasta: 0 } }, x, 0, T0, autor, false, 0);
    S2.invs.de(autor).coger('hacha_piedra', 1, 'mano:der');
    const rv = S2.ejecutar({ autor, tipo: 'vaciar', objeto: m.id, x, z: 0 }, T0);
    comprobar(`la canoa recién vaciada por ${autor} en x=${x}: ${guarda ? 'a su guarda' : 'sin guarda'}`, rv.ok && rv.canoa && m.cosa.tipo === 'canoa' && m.guarda === guarda, rv.motivo);
  }
}

console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
