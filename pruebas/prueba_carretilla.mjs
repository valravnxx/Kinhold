// Pruebas de la carretilla de rueda maciza (src/logica/rastra.js: VEHICULOS.carretilla) y de la carretilla en el
// servidor (src/logica/objetos_red.js).
// Ejecutar: node pruebas/prueba_carretilla.mjs
// Con MUTAR=1 la carretilla no protege lo que lleva en tus tierras: las pruebas deben FALLAR.
import { Rastras, VEHICULOS, CABE_CARRETILLA, DELANTE_CARRETILLA, ALCANCE_RASTRA, factorRastra, sitioRastra, sitioDe, ejecutarRastra, ejecutarArconAlSuelo } from '../src/logica/rastra.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Suelo, HORA } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

if (process.env.MUTAR === '1') VEHICULOS.carretilla.protege = false;
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 10, 1, 7);
// las tierras de ana: x < 0 (mientras no haya tierras de cada uno, enTierras lo dice quien conoce el mundo)
const tierras = (autor, x) => autor === 'ana' && x < 0;
function nuevo(x = 20, z = 0) {
  const suelo = new Suelo(), reg = new RegistroAcciones(), invs = new Inventarios();
  const ra = ejecutarArconAlSuelo(suelo, reg, { autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'carretilla', x, z }, T0, tierras);
  return { suelo, reg, invs, rastras: new Rastras(suelo), id: ra.objeto };
}
const hacer = (m, a, giro = 0, t = T0) => ejecutarRastra(m.rastras, m.invs, m.reg, a, t, tierras, giro);

console.log('La carretilla en el catálogo y en el suelo');
{
  comprobar('es enorme: no se lleva encima', CATALOGO.carretilla.tam === 'E');
  const m = nuevo();
  const o = m.suelo.porId(m.id, T0);
  comprobar('del arcón de pruebas sale al suelo', o && o.cosa.tipo === 'carretilla' && o.x === 20);
  comprobar('no desaparece aunque esté fuera de tus tierras', o.desaparece === null && m.suelo.porId(m.id, T0 + 40 * HORA));
  comprobar('fuera de tus tierras no tiene guarda', !o.guarda);
  comprobar('no se coge del suelo con las manos', !m.suelo.coger(m.invs.de('ana'), m.id, 20, 0, T0).ok);
  comprobar('lleva más que la rastra', CABE_CARRETILLA.tronco_corto > VEHICULOS.rastra.cabe.tronco_corto && CABE_CARRETILLA.piedra > VEHICULOS.rastra.cabe.piedra);
}

console.log('Empujarla y aparcarla');
{
  const m = nuevo();
  let r = hacer(m, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m.id, x: 21, z: 0 });
  comprobar('las acciones de la rastra no valen con la carretilla', !r.ok && /carretilla/.test(r.motivo), r.motivo);
  m.invs.de('ana').coger('piedra', 1, 'mano:der');
  r = hacer(m, { autor: 'ana', tipo: 'empujar_carretilla', objeto: m.id, x: 21, z: 0 });
  comprobar('con algo en las manos no se empuja', !r.ok && /manos libres/.test(r.motivo), r.motivo);
  m.invs.de('ana').sacar('mano:der');
  r = hacer(m, { autor: 'ana', tipo: 'empujar_carretilla', objeto: m.id, x: 20 + ALCANCE_RASTRA + 0.5, z: 0 });
  comprobar('lejos no se empuja', !r.ok && /lejos/.test(r.motivo));
  r = hacer(m, { autor: 'ana', tipo: 'empujar_carretilla', objeto: m.id, x: 21, z: 0 });
  comprobar('a su lado y con las manos libres, se empuja', r.ok && m.rastras.deAutor('ana', T0)?.id === m.id, r.motivo);
  comprobar('queda en el registro con su autor y su nombre', m.reg.entradas.some(e => e.tipo === 'empujar_carretilla' && e.autor === 'ana' && e.ok));
  const c = m.invs.de('ana').coger('piedra', 1, 'mano:der');
  comprobar('empujándola no coges nada con las manos', !c.ok && /carretilla/.test(c.motivo), c.motivo);
  comprobar('otro no la coge mientras la empujas', !hacer(m, { autor: 'bea', tipo: 'empujar_carretilla', objeto: m.id, x: 21, z: 0 }).ok);
  // va delante: quien mira a +x la tiene en +x
  const d = sitioDe(30, 5, Math.PI / 2, 'carretilla');
  comprobar('va delante del que la empuja', Math.abs(d.x - (30 + DELANTE_CARRETILLA)) < 1e-9 && Math.abs(d.z - 5) < 1e-9);
  r = hacer(m, { autor: 'ana', tipo: 'aparcar_carretilla', x: 30, z: 5, rx: d.x, rz: d.z });
  let o = m.suelo.porId(m.id, T0);
  comprobar('al aparcarla se queda donde la dejas, delante', r.ok && !o.arrastra && Math.abs(o.x - d.x) < 0.01, JSON.stringify(o));
  comprobar('mirando hacia donde la empujabas', Math.abs(o.giro - Math.PI / 2) < 0.01, String(o.giro));
  comprobar('y ya coges con las manos', m.invs.de('ana').coger('piedra', 1, 'mano:der').ok);
  m.invs.de('ana').sacar('mano:der');
  hacer(m, { autor: 'ana', tipo: 'empujar_carretilla', objeto: m.id, x: 30, z: 5 });
  r = hacer(m, { autor: 'ana', tipo: 'aparcar_carretilla', x: 50, z: 5, rx: 0, rz: 0 }, Math.PI / 2);
  o = m.suelo.porId(m.id, T0);
  comprobar('si el sitio que dice el navegador no cuadra, queda delante de ti', r.ok && Math.abs(o.x - (50 + DELANTE_CARRETILLA)) < 0.01);
}

console.log('Lo que lleva y lo que frena');
{
  const m = nuevo();
  const inv = m.invs.de('ana');
  inv.coger('tronco_corto', 1, 'mano:der');
  let r = hacer(m, { autor: 'ana', tipo: 'cargar_carretilla', objeto: m.id, x: 21, z: 0, de: 'mano:der' });
  comprobar('se carga lo que llevas en las manos', r.ok && m.suelo.porId(m.id, T0).cosa.carga.n === 1 && !inv.lugares['mano:der'], r.motivo);
  m.suelo.dejar({ tipo: 'tronco_corto', n: 5 }, 21, 1, T0, 'ana', false);
  const pila = m.suelo.objetos.find(q => q.cosa.tipo === 'tronco_corto');
  r = hacer(m, { autor: 'ana', tipo: 'cargar_carretilla', objeto: m.id, x: 21, z: 0, suelo: pila.id });
  comprobar('del suelo carga hasta llenarla (4 troncos cortos)', r.ok && m.suelo.porId(m.id, T0).cosa.carga.n === CABE_CARRETILLA.tronco_corto && pila.cosa.n === 2, r.motivo);
  comprobar('llena, ya no cabe más', sitioRastra(m.suelo.porId(m.id, T0).cosa.carga, 'tronco_corto', 'carretilla') === 0);
  m.suelo.dejar({ tipo: 'piedra', n: 5 }, 22, -1, T0, 'ana', false);
  r = hacer(m, { autor: 'ana', tipo: 'cargar_carretilla', objeto: m.id, x: 21, z: 0, suelo: m.suelo.objetos.find(q => q.cosa.tipo === 'piedra').id });
  comprobar('una sola clase de cosa a la vez', !r.ok && /otra cosa/.test(r.motivo), r.motivo);
  comprobar('la leña sí va en la carretilla (no en la rastra)', sitioRastra(null, 'lena', 'carretilla') === CABE_CARRETILLA.lena && sitioRastra(null, 'lena') === 0);
  const vacia = factorRastra(null, 'carretilla'), llena = factorRastra({ tipo: 'tronco_corto', n: 4 }, 'carretilla');
  comprobar('vacía frena menos que la rastra vacía', vacia > factorRastra(null), `${vacia}`);
  comprobar('llena va más despacio que vacía', llena < vacia && Math.abs(llena - VEHICULOS.carretilla.llena) < 1e-9, `${llena}`);
  r = hacer(m, { autor: 'ana', tipo: 'descargar_carretilla', objeto: m.id, x: 21, z: 0 });
  comprobar('se descarga al suelo, a su lado', r.ok && r.cantidad === 4 && !m.suelo.porId(m.id, T0).cosa.carga, r.motivo);
}

console.log('Protegida en tus tierras; fuera, cualquiera coge lo que lleva');
{
  const m = nuevo(-10, 0);   // en las tierras de ana
  let o = m.suelo.porId(m.id, T0);
  comprobar('sacada del arcón en tus tierras, queda a tu guarda', o.guarda === 'ana');
  m.suelo.dejar({ tipo: 'piedra', n: 6 }, -11, 1, T0, 'ana', true);
  hacer(m, { autor: 'ana', tipo: 'cargar_carretilla', objeto: m.id, x: -10, z: 1, suelo: m.suelo.objetos.find(q => q.cosa.tipo === 'piedra').id });
  let r = hacer(m, { autor: 'bea', tipo: 'descargar_carretilla', objeto: m.id, x: -10, z: 1 });
  comprobar('en tus tierras, otro no coge lo que lleva', !r.ok && /tierras de otro/.test(r.motivo), r.motivo);
  r = hacer(m, { autor: 'bea', tipo: 'empujar_carretilla', objeto: m.id, x: -10, z: 1 });
  comprobar('ni se la lleva', !r.ok && /tierras de otro/.test(r.motivo), r.motivo);
  comprobar('lo que no ha podido hacer queda en el registro', m.reg.entradas.some(e => e.autor === 'bea' && e.tipo === 'empujar_carretilla' && !e.ok));
  r = hacer(m, { autor: 'ana', tipo: 'empujar_carretilla', objeto: m.id, x: -10, z: 1 });
  comprobar('la dueña sí la empuja', r.ok, r.motivo);
  r = hacer(m, { autor: 'ana', tipo: 'aparcar_carretilla', x: 10, z: 0 }, 0);
  o = m.suelo.porId(m.id, T0);
  comprobar('aparcada fuera de sus tierras, ya no tiene guarda', r.ok && !o.guarda && o.x > 0);
  r = hacer(m, { autor: 'bea', tipo: 'descargar_carretilla', objeto: m.id, x: 10, z: 1 });
  comprobar('y cualquiera coge lo que lleva', r.ok && r.cantidad === 6, r.motivo);
  hacer(m, { autor: 'bea', tipo: 'empujar_carretilla', objeto: m.id, x: 10, z: 1 });
  r = hacer(m, { autor: 'bea', tipo: 'aparcar_carretilla', x: -20, z: 0 }, 0);
  comprobar('quien la aparca en tierras que no son suyas no la protege', r.ok && !m.suelo.porId(m.id, T0).guarda);
}

console.log('La carretilla en el servidor');
{
  const pos = { ana: { x: -5, z: 1, giro: 0 }, bea: { x: -5, z: 1, giro: 0 } };
  const os = new ObjetosServidor({ posicion: a => pos[a] || null, enTierras: tierras, arconPruebas: true });
  let r = os.ejecutar({ autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'carretilla', x: -5, z: 1 }, T0);
  const id = r.objeto;
  comprobar('el arcón de pruebas la deja en el suelo del servidor, a su guarda', r.ok && os.sueloVisible(T0).find(o => o.id === id)?.guarda === 'ana', r.motivo);
  r = os.ejecutar({ autor: 'bea', tipo: 'empujar_carretilla', objeto: id, x: -5, z: 1 }, T0);
  comprobar('el servidor no deja a otro llevársela de tus tierras', !r.ok, r.motivo);
  r = os.ejecutar({ autor: 'ana', tipo: 'empujar_carretilla', objeto: id, x: -5, z: 1 }, T0);
  comprobar('la dueña la empuja por el servidor y todos lo ven', r.ok && os.sueloVisible(T0).find(o => o.id === id).arrastra === 'ana', r.motivo);
  pos.ana = { x: 30, z: 0, giro: Math.PI / 2 };
  comprobar('quien se va aparca la carretilla delante de donde estaba', os.soltarAlSalir('ana', T0) && Math.abs(os.sueloVisible(T0).find(q => q.id === id).x - (30 + DELANTE_CARRETILLA)) < 0.02);
  comprobar('y queda anotado como aparcar', os.registro.entradas.some(e => e.tipo === 'aparcar_carretilla' && e.datos.alSalir));
  pos.ana = { x: -3, z: 0, giro: 0 };
  os.ejecutar({ autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'carretilla', x: -3, z: 0 }, T0);
  const os2 = new ObjetosServidor({ posicion: a => pos[a] || null, enTierras: tierras, arconPruebas: true }).importar(JSON.parse(JSON.stringify(os.exportar())), T0);
  const vistas = os2.sueloVisible(T0).filter(q => q.cosa.tipo === 'carretilla');
  comprobar('al volver a arrancar el servidor siguen donde estaban, y la guarda también', vistas.length === 2 && vistas.some(q => q.guarda === 'ana') && vistas.some(q => !q.guarda));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
