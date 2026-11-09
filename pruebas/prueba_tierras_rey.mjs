// Prueba de Strandvang, tierras del rey (valravnx, 31 oct): src/logica/tierras_rey.js y el combate del servidor
// (src/logica/combate_servidor.js). En la comarca E nadie puede herir a otro jugador: el servidor rechaza el golpe y la
// flecha (sin herida, en el registro con su autor y el motivo); fuera, se hiere como siempre; los NPCs sí valen. Y el
// aviso al entrar y al salir (vigiaTierras), con las comarcas de verdad de Whitholm.
// Ejecutar: node pruebas/prueba_tierras_rey.mjs
// MUTAR=1: un servidor sin las tierras del rey (no se pasa `tierras`): tiene que FALLAR.
import { CombateServidor } from '../src/logica/combate_servidor.js';
import { crearTierrasRey, vigiaTierras, motivoProtegido, MOTIVO_TIERRAS, RESULTADO_TIERRAS } from '../src/logica/tierras_rey.js';
import { crearComarcas } from '../src/logica/comarcas.js';
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { SALIDA, SALIDAS, CIUDAD_REY } from '../src/logica/whitholm.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

console.log('Las tierras del rey en el mapa de verdad');
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO });
const comarcas = crearComarcas(mapa);
// en línea, la escena tiene su 0 en SALIDA (en Lindholt)
const T = crearTierrasRey(comarcas, SALIDA);
const esc = (p) => [p.x - SALIDA.x, p.z - SALIDA.z];
comprobar('se llaman Strandvang', T.nombre === 'Strandvang', T.nombre);
comprobar('el sitio común de salida (Lindholt) no es tierra del rey', !T.en(0, 0), comarcas.nombreEn(SALIDA.x, SALIDA.z));
comprobar('la ciudad del rey sí', T.en(...esc(CIUDAD_REY)));
// la salida 41 está en Strandvang, a unos 300 m de Motdale (al oeste)
const s41 = { x: SALIDAS[41][0], z: SALIDAS[41][1] };
comprobar('un sitio de salida de Strandvang es tierra del rey', T.en(...esc(s41)), comarcas.nombreEn(s41.x, s41.z));
comprobar('y 400 m al oeste, en Motdale, ya no', !T.en(...esc({ x: s41.x - 400, z: s41.z })), comarcas.nombreEn(s41.x - 400, s41.z));
comprobar('un sitio sin número no es tierra del rey', !T.en(NaN, 0) && !T.en(undefined, 0));
// lo mismo, con la escena con su 0 en otro sitio (el navegador sin servidor: la salida de cada uno)
const T41 = crearTierrasRey(comarcas, s41);
comprobar('con otro 0 de la escena sale lo mismo', T41.en(0, 0) && !T41.en(-400, 0));

console.log('El aviso al entrar y al salir');
{
  const v = vigiaTierras(T41.en);
  const pasos = [[0, 0], [10, 0], [-400, 0], [-410, 0], [0, 0], [-400, 0]].map(([x, z]) => v.mirar(x, z));
  comprobar('al aparecer dentro, «entra»; al cruzar, «sale» y «entra»; quieto, nada', JSON.stringify(pasos) === JSON.stringify(['entra', null, 'sale', null, 'entra', 'sale']), JSON.stringify(pasos));
  const w = vigiaTierras(T41.en);
  comprobar('al aparecer fuera, nada', w.mirar(-400, 0) === null && w.dentro === false);
}

console.log('El servidor rechaza los golpes entre jugadores en Strandvang');
// A mirando a +z y B a 1,5 m delante, mirándole; en la escena de la salida 41 (dentro) o 400 m al oeste (fuera)
function pareja(x0, opc = {}) {
  const c = new CombateServidor({ semilla: 5, ...(MUTAR ? {} : { tierras: T41.en }), ...opc });
  c.entrar('jugador:a', { arma: 'espada_larga', x: x0, z: 0, rot: 0 });   // (con una espada en la mano)
  c.entrar('jugador:b', { arma: 'espada_larga', x: x0, z: 1.5, rot: Math.PI });
  return c;
}
const ic = (c, a, m) => c.intencion(a, { tipo: 'combate', ...m });
function golpe(c) {
  ic(c, 'jugador:a', { que: 'arma', sacada: true });
  ic(c, 'jugador:a', { que: 'cargar', linea: 'derecha' }); c.avanzar(0.2); ic(c, 'jugador:a', { que: 'descargar' });
  c.avanzar(2);
  return c.sacarEventos().find(e => e.tipo === 'golpe');
}
{
  const c = pareja(0), Lb = c.luchadores['jugador:b'];
  const g = golpe(c);
  comprobar('dentro, el golpe llega pero no hiere', g && g.objetivo === 'jugador:b' && g.resultado === RESULTADO_TIERRAS && Lb.heridas.length === 0, g && `${g.resultado}, ${Lb.heridas.length} heridas`);
  const e = c.registro.entradas.at(-1);
  comprobar('queda en el registro rechazado, con su autor y el motivo', e && e.tipo === 'golpe' && e.autor === 'jugador:a' && e.datos.objetivo === 'jugador:b' && e.ok === false && e.motivo === MOTIVO_TIERRAS && g.n === e.n, e && JSON.stringify(e));
  comprobar('el evento lleva el motivo', g && g.motivo === MOTIVO_TIERRAS);
}
{
  const c = pareja(-400), Lb = c.luchadores['jugador:b'];
  const g = golpe(c);
  comprobar('fuera (en Motdale), el mismo golpe hiere', g && g.resultado === 'herida' && Lb.heridas.length === 1, g && g.resultado);
}
{
  // A fuera y B dentro (a caballo de una frontera de prueba: dentro, de z = 1 en adelante), y al revés: tampoco
  const enZ = (x, z) => z > 1, enA = (x, z) => z < 1;
  const fr = { a: enZ(0, 0), b: enZ(0, 1.5) };
  const c = pareja(0, MUTAR ? {} : { tierras: enZ });
  const g = golpe(c);
  const c2 = pareja(0, MUTAR ? {} : { tierras: enA }), g2 = golpe(c2);
  comprobar('ni desde dentro a quien está fuera', g2 && g2.resultado === RESULTADO_TIERRAS && c2.luchadores['jugador:b'].heridas.length === 0, g2 && g2.resultado);
  comprobar('basta con que uno de los dos esté dentro', g && g.resultado === RESULTADO_TIERRAS && c.luchadores['jugador:b'].heridas.length === 0, `${JSON.stringify(fr)} ${g && g.resultado}`);
}
{
  // y una flecha desde 12 m
  const c = pareja(0); c.colocar('jugador:b', 0, 12, Math.PI);
  c.armar('jugador:a', { arma: 'arco' }); ic(c, 'jugador:a', { que: 'tensar' }); c.avanzar(1.1);
  const tiro = ic(c, 'jugador:a', { que: 'soltar', x: 0, y: 1.2, z: 12 }).ok;
  c.avanzar(1.5);
  const f = c.sacarEventos().find(e => e.tipo === 'flecha');
  comprobar('la flecha tampoco hiere', tiro && f && f.objetivo === 'jugador:b' && f.resultado === RESULTADO_TIERRAS && c.luchadores['jugador:b'].heridas.length === 0, f && f.resultado);
  comprobar('y queda rechazada en el registro, con su autor', c.registro.entradas.some(e => e.tipo === 'impacto' && e.autor === 'jugador:a' && e.ok === false && e.motivo === MOTIVO_TIERRAS));
}
{
  const c = pareja(-400); c.colocar('jugador:b', -400, 12, Math.PI);
  c.armar('jugador:a', { arma: 'arco' }); ic(c, 'jugador:a', { que: 'tensar' }); c.avanzar(1.1);
  ic(c, 'jugador:a', { que: 'soltar', x: -400, y: 1.2, z: 12 }); c.avanzar(1.5);
  const f = c.sacarEventos().find(e => e.tipo === 'flecha');
  comprobar('fuera, la flecha hiere', f && f.resultado === 'blanco' && c.luchadores['jugador:b'].heridas.length === 1, f && f.resultado);
}
{
  // los NPCs no cuentan
  const A = { x: 0, z: 0 }, B = { x: 0, z: 1 };
  comprobar('contra un NPC sí se pelea dentro', motivoProtegido(T41.en, A, { ...B, npc: true }) === null && motivoProtegido(T41.en, { ...A, npc: true }, B) === null);
  comprobar('entre dos jugadores dentro, no', motivoProtegido(T41.en, A, B) === MOTIVO_TIERRAS);
  comprobar('sin tierras (otro servidor), sí', motivoProtegido(null, A, B) === null);
}

console.log(`\nTierras del rey: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
