// Prueba de lógica: el mazo de piedra y romper rocas (valravnx, 8 nov: «imagínate construir un castillo corriendo por
// ahí, rebuscando entre piedrecitas del suelo»). En la lógica pura (src/logica/recoleccion.js y fabricacion.js) y en
// el servidor con el terreno de Whitholm (src/logica/terreno_servidor.js y src/logica/objetos_red.js), con su autor:
//   - el mazo de piedra se hace con las manos con 1 piedra, 1 rama y 2 cordel;
//   - sin el mazo en la mano no se rompe; con él, cada golpe es una acción y la roca pide más golpes cuanto más grande;
//   - al último golpe la roca desaparece (rota) y deja de 6 a 25 piedras sueltas en el suelo donde estaba, según su
//     tamaño; vuelve a salir en unos meses reales (3);
//   - las grandes (de más de 1,1 m) no se rompen con el mazo; con algo al hombro, tampoco;
//   - lo que llevan dado los golpes se guarda; romper cansa;
//   - el servidor conoce las rocas del mundo (las mismas que dibuja el navegador, por su nombre, sin los cantos del río
//     ni las grandes) y rechaza las que no existen.
// MUTAR=1: la roca no queda rota (se rompe sin fin); MUTAR=2: se rompe sin el mazo. Tienen que FALLAR.
import { Recoleccion, ejecutarRecoleccion, idRoca, golpesRoca, piedrasRoca, medidaRoca, rompible, ROMPER, RECOLECTABLES } from '../src/logica/recoleccion.js';
import { RECETAS, ejecutarFabricacion, Fabricacion } from '../src/logica/fabricacion.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ESFUERZOS } from '../src/logica/necesidades.js';

const MUTAR = process.env.MUTAR;
let fallos = 0, total = 0;
function comprobar(nombre, cond, detalle = '') {
  total++; if (!cond) fallos++;
  console.log(`${cond ? '  bien' : '  MAL '}  ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
if (MUTAR === '1') { const d = Recoleccion.prototype.romper; Recoleccion.prototype.romper = function (...a) { const r = d.apply(this, a); if (r.ok && r.rota) delete this.estado[a[1]]; return r; }; }

const T0 = Date.UTC(2026, 10, 8, 16);
const chica = { id: idRoca(10, 4), tipo: 'roca', x: 10, z: 4, tam: 0.3 };
const media = { id: idRoca(20, 4), tipo: 'roca', x: 20, z: 4, tam: 0.5 };
const grande = { id: idRoca(30, 4), tipo: 'roca', x: 30, z: 4, tam: 0.8 };
const rec = new Recoleccion([chica, media, grande]);
const invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
const yo = 'ana', inv = invs.de(yo);
const romper = (p, ahora, x = p.x + 0.8) => ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'romper', punto: p.id, x, z: p.z }, ahora, suelo);
const enSuelo = (tipo) => suelo.objetos.filter(o => o.cosa.tipo === tipo).reduce((n, o) => n + o.cosa.n, 0);

console.log('El mazo de piedra');
const rm = RECETAS.mazo_piedra;
comprobar('está en el catálogo, como herramienta', CATALOGO.mazo_piedra && CATALOGO.mazo_piedra.herramienta === true);
comprobar('se hace con las manos con 1 piedra, 1 rama y 2 cordel', rm && rm.uso === 'manos' && JSON.stringify(rm.gasta) === JSON.stringify({ piedra: 1, rama: 1, cordel: 2 }), JSON.stringify(rm));
{
  const fi = new Inventarios(), f = fi.de('eva'), fab = new Fabricacion(), fr = new RegistroAcciones(), fs = new Suelo();
  for (const [t, n] of [['piedra', 1], ['rama', 1], ['cordel', 2]]) fs.dejar({ tipo: t, n }, 0.3, 0.2, T0, 'eva', true);   // lo del suelo a tu lado
  const r = ejecutarFabricacion(fab, fi, fr, { autor: 'eva', tipo: 'fabricar', receta: 'mazo_piedra', x: 0, z: 0 }, T0, fs, () => true, () => false, () => null);
  // con las manos tarda lo suyo (45 s): luego se recoge
  const rr = ejecutarFabricacion(fab, fi, fr, { autor: 'eva', tipo: 'recoger_fabricado', estacion: null, x: 0, z: 0 }, T0 + 46000, fs, () => true, () => false, () => null);
  const tiene = f.cuantos('mazo_piedra') === 1 || fs.objetos.some(o => o.cosa.tipo === 'mazo_piedra');
  comprobar('y se hace de verdad, con lo del suelo a tu lado', r.ok && tiene && !fs.objetos.some(o => o.cosa.tipo === 'cordel'), `${r.motivo || ''} ${rr.motivo || ''}`);
}

console.log('Romper rocas en la lógica');
comprobar('el nombre de la roca sale de su sitio', chica.id === 'roca:100,40', chica.id);
comprobar('las medianas (hasta 1,1 m) se rompen y las grandes no', rompible(0.3) && rompible(0.5) && !rompible(0.8), `${medidaRoca(0.3)} ${medidaRoca(0.5)} ${medidaRoca(0.8)} m`);
comprobar('más golpes y más piedras cuanto más grande: de 8 a 30 golpes y de 6 a 25 piedras', golpesRoca(0.3) === 8 && golpesRoca(0.5) === 30 && piedrasRoca(0.3) === 6 && piedrasRoca(0.5) === 25, `${golpesRoca(0.3)}–${golpesRoca(0.5)}, ${piedrasRoca(0.3)}–${piedrasRoca(0.5)}`);
let r = romper(chica, T0);
comprobar('sin el mazo en la mano no se rompe', !r.ok && /mazo/.test(r.motivo), r.motivo);
inv.meterDonde('mazo_piedra', 1, 'mano:der');
if (MUTAR === '2') inv.sacar('mano:der');
r = romper(chica, T0, 40);
comprobar('lejos no', !r.ok && /lejos/.test(r.motivo), r.motivo);
let t = T0;
r = romper(chica, t); const r2 = romper(chica, t + 100);
comprobar('un golpe es una acción, y no dos seguidos sin terminar el gesto', r.ok && !r.rota && r.faltan === 7 && !r2.ok, `${r.motivo || ''} faltan ${r.faltan}; ${r2.motivo}`);
comprobar('lo que lleva dado se ve', Math.abs(rec.progresoRoca(chica.id) - 1 / 8) < 1e-9, String(rec.progresoRoca(chica.id)));
const guardado = JSON.parse(JSON.stringify(rec.exportar()));
comprobar('y se guarda (a medias)', new Recoleccion([{ ...chica }]).importar(guardado).progresoRoca(chica.id) > 0);
for (let k = 0; k < 7; k++) { t += 1000; r = romper(chica, t); }
comprobar('al octavo golpe la pequeña se rompe y deja 6 piedras en el suelo donde estaba', r.ok && r.rota && enSuelo('piedra') === 6 && suelo.objetos.every(o => Math.hypot(o.x - chica.x, o.z - chica.z) < 0.5), `${r.motivo || ''} piedras ${enSuelo('piedra')}`);
comprobar('las piedras no van a lo que llevas (se cogen del suelo)', inv.cuantos('piedra') === 0);
comprobar('la roca queda rota (no en pie)', !rec.enPie(chica.id, t + 1000));
r = romper(chica, t + 2000);
comprobar('no se vuelve a romper hasta que vuelve a salir', !r.ok && /rota/.test(r.motivo), r.motivo);
comprobar('vuelve a salir en unos meses reales (3)', ROMPER.vuelve === 90 * 24 * 3600 * 1000 && !rec.enPie(chica.id, t + ROMPER.vuelve - 1000) && rec.enPie(chica.id, t + ROMPER.vuelve + 1000));
let n = 0; t += 5000;
do { t += 1000; r = romper(media, t); n++; } while (r.ok && !r.rota && n < 100);
comprobar('la mediana pide 30 golpes y deja 25 piedras', r.ok && r.rota && n === 30 && r.cantidad === 25, `${n} golpes, ${r.cantidad}`);
r = romper(grande, t + 2000);
comprobar('la grande no se rompe con el mazo (hace falta hierro)', !r.ok && /hierro/.test(r.motivo), r.motivo);
r = ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'recoger', punto: grande.id, x: 30.5, z: 4 }, t);
comprobar('una roca no se recoge ni sale entre lo que se recoge', !r.ok && !rec.cercanos(30, 4, t, 3).length, r.motivo);
{
  const i2 = new Inventarios(), j = i2.de('luis'); j.coger('tronco_corto', 1, 'hombro'); j.meterDonde('mazo_piedra', 1, 'mano:der');
  const r3 = new Recoleccion([{ ...media }]).romper(j, media.id, 20.8, 4, T0, 'luis');
  comprobar('con algo al hombro no se rompe', !r3.ok && /hombro/.test(r3.motivo), r3.motivo);
}
comprobar('romper cansa (cada golpe, como uno de hacha)', ESFUERZOS.romper >= 1, String(ESFUERZOS.romper));
comprobar('y queda en el registro con su autor', reg.entradas.some(e => e.tipo === 'romper' && e.autor === yo && e.ok && e.resultado && e.resultado.rota));

console.log('En el servidor, con el terreno de Whitholm');
const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
const { ObjetosServidor } = await import('../src/logica/objetos_red.js');
const { vegetacionEn } = await import('../src/logica/vegetacion.js');
const terreno = terrenoWhitholm();
const O = terreno.origen;
let p1 = null, gr = null, canto = null;
for (let R = 40; (!p1 || !gr) && R < 900; R += 80) {
  const v = vegetacionEn(terreno.paisaje, terreno.alt, terreno.semilla, { x0: O.x - R, z0: O.z - R, x1: O.x + R, z1: O.z + R });
  const l = v.piedras.map(e => ({ x: e.x - O.x, z: e.z - O.z, tam: e.tam, canto: e.canto })).filter(e => Math.hypot(e.x, e.z - 2) > 3).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  p1 = p1 || l.find(e => !e.canto && rompible(e.tam)); gr = gr || l.find(e => !e.canto && !rompible(e.tam)); canto = canto || l.find(e => e.canto);
}
comprobar('hay rocas medianas en el mundo', !!p1, p1 ? `a ${Math.hypot(p1.x, p1.z).toFixed(0)} m, ${medidaRoca(p1.tam)} m` : '');
const t1 = p1 && terreno.punto(idRoca(p1.x, p1.z), p1.x, p1.z);
comprobar('el servidor la conoce por su nombre, con su tamaño', !!t1 && t1.tipo === 'roca' && Math.abs(t1.tam - p1.tam) < 0.001, JSON.stringify(t1));
comprobar('las grandes no son de romper', !gr || !terreno.punto(idRoca(gr.x, gr.z), gr.x, gr.z));
comprobar('ni los cantos del río', !canto || !terreno.punto(idRoca(canto.x, canto.z), canto.x, canto.z));
comprobar('y una roca que no existe, no', !terreno.punto(idRoca(p1.x + 0.73, p1.z + 0.41), p1.x + 0.73, p1.z + 0.41));
const obj = new ObjetosServidor({ terreno, posicion: () => ({ x: p1.x + 0.9, z: p1.z }) });
obj.invs.de('eva').meterDonde('mazo_piedra', 1, 'mano:der');
const golpe = (ahora, id = idRoca(p1.x, p1.z), px = p1.x, pz = p1.z) => obj.ejecutar({ autor: 'eva', tipo: 'romper', punto: id, x: p1.x + 0.9, z: p1.z, px, pz, clase: 'roca', tam: 0.01 }, ahora);
let g = 0; t = T0;
do { t += 600; r = golpe(t); g++; } while (r.ok && !r.rota && g < 100);
comprobar('en el servidor se rompe a golpes (los que pide su tamaño, no los que diga el navegador)', r.ok && r.rota && g === golpesRoca(p1.tam), `${r.motivo || ''} ${g} golpes`);
comprobar('y sus piedras caen a su suelo', r.suelo && obj.suelo.objetos.filter(o => o.cosa.tipo === 'piedra').reduce((s, o) => s + o.cosa.n, 0) === piedrasRoca(p1.tam));
r = golpe(t + 1000, idRoca(p1.x + 0.73, p1.z + 0.41), p1.x + 0.73, p1.z + 0.41);
comprobar('una que no existe, no', !r.ok, r.motivo);
const vis = obj.recoleccionVisible();
comprobar('lo roto sale en lo que se reparte (quitado)', vis.estado[idRoca(p1.x, p1.z)] && vis.estado[idRoca(p1.x, p1.z)].quitado === true);
const otro = new ObjetosServidor({ terreno, posicion: () => ({ x: p1.x + 0.9, z: p1.z }) }).importar(JSON.parse(JSON.stringify(obj.exportar())));
comprobar('y se guarda: al volver a abrir el servidor sigue rota', !otro.recoleccion.enPie(idRoca(p1.x, p1.z), t + 1000));

console.log(`\n${total - fallos}/${total} bien`);
process.exit(fallos ? 1 : 0);
