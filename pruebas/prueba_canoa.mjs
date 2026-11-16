// Pruebas de la canoa de un tronco (src/logica/canoa.js): vaciar el tronco largo con el hacha y las brasas, por
// tiempo transcurrido, hasta que queda la canoa en el suelo; y por la red (src/logica/objetos_red.js), con su autor.
// Ejecutar: node pruebas/prueba_canoa.mjs
// Con MUTAR=1 las brasas no esperan (QUEMA = 0) y basta una vuelta: las pruebas deben FALLAR.
import { Vaciado, ejecutarVaciado, faseDe, fuegoCerca, progresoVaciado, GOLPES_DESBASTAR, GOLPES_RASPAR, VUELTAS, QUEMA, ENTRE_GOLPES } from '../src/logica/canoa.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Suelo, NO_DESAPARECE } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';
import { Rastras, DETRAS_TRONCO } from '../src/logica/rastra.js';

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

console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
