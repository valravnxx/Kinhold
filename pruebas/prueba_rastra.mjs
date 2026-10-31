// Pruebas de la rastra (src/logica/rastra.js) y de la rastra en el servidor (src/logica/objetos_red.js).
// Ejecutar: node pruebas/prueba_rastra.mjs
// Con MUTAR=1 la rastra no lleva nada (no cabe nada en ella) y arrastrarla no frena: las pruebas deben FALLAR.
import { Rastras, CABE_RASTRA, ALCANCE_RASTRA, DETRAS, factorRastra, sitioRastra, detrasDe, ejecutarRastra, ejecutarArconAlSuelo, VEL_VACIA, VEL_LLENA } from '../src/logica/rastra.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Suelo, HORA } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

if (process.env.MUTAR === '1') { for (const k of Object.keys(CABE_RASTRA)) CABE_RASTRA[k] = 0; }
const factor = c => (process.env.MUTAR === '1' ? 1 : factorRastra(c));
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 9, 31, 21);
function nuevo() {
  const suelo = new Suelo(), reg = new RegistroAcciones(), invs = new Inventarios();
  const ra = ejecutarArconAlSuelo(suelo, reg, { autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'rastra', x: 0, z: 0 }, T0);
  return { suelo, reg, invs, rastras: new Rastras(suelo), id: ra.objeto };
}
const hacer = (m, a, t = T0) => ejecutarRastra(m.rastras, m.invs, m.reg, a, t);

console.log('La rastra en el catálogo y en el suelo');
{
  comprobar('es enorme: no se lleva encima', CATALOGO.rastra.tam === 'E');
  const m = nuevo();
  const o = m.suelo.porId(m.id, T0);
  comprobar('del arcón de pruebas sale al suelo, a tus pies', o && o.cosa.tipo === 'rastra' && o.x === 0 && o.z === 0);
  comprobar('no desaparece aunque esté fuera de tus tierras', o.desaparece === null && m.suelo.porId(m.id, T0 + 30 * HORA));
  comprobar('el arcón solo saca al suelo lo que se arrastra', !ejecutarArconAlSuelo(m.suelo, m.reg, { autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'hacha_hierro', x: 0, z: 0 }, T0).ok);
  const c = m.suelo.coger(m.invs.de('ana'), m.id, 0, 0, T0);
  comprobar('no se coge del suelo con las manos', !c.ok && /enorme/.test(c.motivo), c.motivo);
}

console.log('Engancharla y soltarla');
{
  const m = nuevo();
  m.invs.de('ana').coger('piedra', 1, 'mano:der');
  let r = hacer(m, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m.id, x: 1, z: 0 });
  comprobar('con algo en las manos no se engancha', !r.ok && /manos libres/.test(r.motivo), r.motivo);
  m.invs.de('ana').sacar('mano:der');
  r = hacer(m, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m.id, x: ALCANCE_RASTRA + 0.5, z: 0 });
  comprobar('lejos no se engancha', !r.ok && /lejos/.test(r.motivo));
  r = hacer(m, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m.id, x: 1, z: 0 });
  comprobar('con las manos libres y a su lado, se engancha', r.ok && m.rastras.deAutor('ana', T0)?.id === m.id, r.motivo);
  comprobar('queda en el registro con su autor', m.reg.entradas.some(e => e.tipo === 'enganchar_rastra' && e.autor === 'ana' && e.ok));
  r = hacer(m, { autor: 'bea', tipo: 'enganchar_rastra', objeto: m.id, x: 1, z: 0 });
  comprobar('otro no la engancha mientras la arrastras', !r.ok && /otro/.test(r.motivo));
  const c = m.invs.de('ana').coger('piedra', 1, 'mano:der');
  comprobar('arrastrándola no coges nada con las manos', !c.ok && /rastra/.test(c.motivo), c.motivo);
  comprobar('ni de lo que hay en el suelo', m.invs.de('ana').meterDonde('silex', 1).ok === false || !m.invs.de('ana').lugares['mano:der']);
  // se lleva a otro sitio: la suelta 1,6 m detrás de donde está, mirando a +x
  const d = detrasDe(30, 5, Math.PI / 2);
  comprobar('detrás de quien mira a +x es a −x', Math.abs(d.x - (30 - DETRAS)) < 1e-9 && Math.abs(d.z - 5) < 1e-9);
  r = hacer(m, { autor: 'ana', tipo: 'soltar_rastra', x: 30, z: 5, rx: d.x, rz: d.z });
  const o = m.suelo.porId(m.id, T0);
  comprobar('al soltarla se queda donde la dejas', r.ok && !o.arrastra && Math.abs(o.x - d.x) < 0.01 && Math.abs(o.z - 5) < 0.01, JSON.stringify(o));
  comprobar('y ya coges con las manos', m.invs.de('ana').coger('piedra', 1, 'mano:der').ok);
  m.invs.de('ana').sacar('mano:der');
  hacer(m, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m.id, x: 30, z: 5 });
  r = hacer(m, { autor: 'ana', tipo: 'soltar_rastra', x: 60, z: 5, rx: 0, rz: 0 });
  comprobar('si el sitio que dice no cuadra, se deja detrás de él', r.ok && Math.abs(Math.hypot(r.x - 60, r.z - 5) - DETRAS) < 0.02, `${r.x},${r.z}`);
  r = hacer(m, { autor: 'ana', tipo: 'soltar_rastra', x: 60, z: 5 });
  comprobar('sin arrastrar ninguna, no se suelta nada', !r.ok);
  r = hacer(m, { tipo: 'enganchar_rastra', objeto: m.id, x: 60, z: 5 });
  comprobar('sin autor no vale', !r.ok && /autor/.test(r.motivo));
  const m2 = nuevo();
  ejecutarArconAlSuelo(m2.suelo, m2.reg, { autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'rastra', x: 1, z: 1 }, T0);
  hacer(m2, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m2.id, x: 0.5, z: 0.5 });
  const otra = m2.rastras.todas(T0).find(x => x.id !== m2.id);
  r = hacer(m2, { autor: 'ana', tipo: 'enganchar_rastra', objeto: otra.id, x: 0.5, z: 0.5 });
  comprobar('cada uno arrastra una sola', !r.ok && /Ya arrastras/.test(r.motivo));
}

console.log('Cargarla y descargarla');
{
  const m = nuevo(), inv = m.invs.de('ana');
  inv.coger('tronco_corto', 1, 'mano:der');
  let r = hacer(m, { autor: 'ana', tipo: 'cargar_rastra', objeto: m.id, x: 1, z: 0, de: 'mano:der' });
  comprobar('el tronco corto de las manos va a la rastra', r.ok && r.lleva === 1 && !inv.lugares['mano:der'], r.motivo);
  const pila = m.suelo.dejar({ tipo: 'tronco_corto', n: 4 }, 1.5, 0, T0, 'ana', false);
  r = hacer(m, { autor: 'ana', tipo: 'cargar_rastra', objeto: m.id, x: 1, z: 0, suelo: pila.id });
  comprobar('de una pila del suelo coge lo que quepa: 3 troncos cortos como mucho', r.ok && r.cantidad === CABE_RASTRA.tronco_corto - 1 && m.suelo.porId(pila.id, T0).cosa.n === 2, `${r.cantidad} ${r.motivo || ''}`);
  r = hacer(m, { autor: 'ana', tipo: 'cargar_rastra', objeto: m.id, x: 1, z: 0, suelo: pila.id });
  comprobar('llena, no cabe más', !r.ok && /llena/.test(r.motivo));
  inv.coger('piedra', 3, 'mano:der');
  r = hacer(m, { autor: 'ana', tipo: 'cargar_rastra', objeto: m.id, x: 1, z: 0, de: 'mano:der' });
  comprobar('lleva una sola clase de cosa a la vez', !r.ok && /otra cosa/.test(r.motivo));
  inv.sacar('mano:der');
  inv.coger('hacha_hierro', 1, 'mano:der');
  r = hacer(m, { autor: 'ana', tipo: 'cargar_rastra', objeto: m.id, x: 1, z: 0, de: 'mano:der' });
  comprobar('un hacha no va en la rastra', !r.ok && /solo van/.test(r.motivo));
  inv.sacar('mano:der');
  comprobar('vacía frena al 70 % y con 3 troncos cortos al 50 % («despacio»)', Math.abs(factor(null) - VEL_VACIA) < 1e-9 && Math.abs(factor({ tipo: 'tronco_corto', n: 3 }) - VEL_LLENA) < 1e-9,
    `${factor(null)} ${factor({ tipo: 'tronco_corto', n: 3 })}`);
  // se la lleva cargada y la deja en otro sitio, con lo que lleva
  hacer(m, { autor: 'ana', tipo: 'enganchar_rastra', objeto: m.id, x: 1, z: 0 });
  r = hacer(m, { autor: 'ana', tipo: 'descargar_rastra', objeto: m.id, x: 1, z: 0 });
  comprobar('arrastrándola no se descarga: hay que soltarla', !r.ok && /Suelta/.test(r.motivo));
  hacer(m, { autor: 'ana', tipo: 'soltar_rastra', x: 50, z: 0, rx: 50 - DETRAS, rz: 0 });
  comprobar('se queda donde la dejas con lo que lleva', m.suelo.porId(m.id, T0 + 5 * HORA).cosa.carga?.n === 3);
  r = hacer(m, { autor: 'bea', tipo: 'descargar_rastra', objeto: m.id, x: 50, z: 0 });
  const tr = m.suelo.cercanos(50 - DETRAS, 0, T0, 2).find(o => o.cosa.tipo === 'tronco_corto');
  comprobar('descargada, lo que lleva cae a su lado como una pila', r.ok && tr && tr.cosa.n === 3 && !m.suelo.porId(m.id, T0).cosa.carga, r.motivo);
  comprobar('los troncos cortos no desaparecen', !!tr && tr.desaparece === null);
  r = hacer(m, { autor: 'bea', tipo: 'descargar_rastra', objeto: m.id, x: 50, z: 0 });
  comprobar('vacía no se descarga', !r.ok && /vacía/.test(r.motivo));
  // piedras: un montón (24) y el bloque de piedra
  const mont = m.suelo.dejar({ tipo: 'piedra', n: 30 }, 49, 1, T0, 'bea', false);
  r = hacer(m, { autor: 'bea', tipo: 'cargar_rastra', objeto: m.id, x: 49, z: 0.5, suelo: mont.id });
  comprobar('un montón de piedras: hasta 24', r.ok && r.cantidad === 24 && m.suelo.porId(mont.id, T0).cosa.n === 6, `${r.cantidad}`);
  comprobar('24 piedras frenan casi como tres troncos', factor(m.suelo.porId(m.id, T0).cosa.carga) < 0.53);
  hacer(m, { autor: 'bea', tipo: 'descargar_rastra', objeto: m.id, x: 49, z: 0.5 });
  const bloque = m.suelo.dejar({ tipo: 'bloque_piedra', n: 1 }, 49.5, -0.5, T0, 'bea', false);
  r = hacer(m, { autor: 'bea', tipo: 'cargar_rastra', objeto: m.id, x: 49, z: 0, suelo: bloque.id });
  comprobar('el bloque de piedra en bruto va en la rastra (uno)', r.ok && sitioRastra(m.suelo.porId(m.id, T0).cosa.carga, 'bloque_piedra') === 0 && !m.suelo.porId(bloque.id, T0));
  r = hacer(m, { autor: 'bea', tipo: 'cargar_rastra', objeto: m.id, x: 49, z: 0 });
  comprobar('sin decir de dónde, no vale', !r.ok && /Datos/.test(r.motivo));
}

console.log('Guardado: el suelo guarda la rastra con lo que lleva');
{
  const m = nuevo();
  m.suelo.porId(m.id, T0).cosa.carga = { tipo: 'piedra', n: 10 };
  const s2 = new Suelo().importar(JSON.parse(JSON.stringify(m.suelo.exportar())));
  comprobar('al cargar sigue con su carga', s2.porId(m.id, T0)?.cosa.carga?.n === 10);
}

console.log('En el servidor (src/logica/objetos_red.js)');
{
  const pos = { ana: { x: 0, z: 1, giro: 0 }, bea: { x: 20, z: 20, giro: 0 } };
  const os = new ObjetosServidor({ posicion: a => pos[a] || null, arconPruebas: true });
  let r = os.ejecutar({ autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'rastra', x: 0, z: 1 }, T0);
  comprobar('el arcón de pruebas deja la rastra en el suelo del servidor', r.ok && r.suelo && os.sueloVisible(T0).some(o => o.cosa.tipo === 'rastra'), r.motivo);
  const id = r.objeto;
  r = os.ejecutar({ autor: 'ana', tipo: 'enganchar_rastra', objeto: id, x: 5, z: 5 }, T0);
  comprobar('el servidor mira dónde estás de verdad', !r.ok && /No estás ahí/.test(r.motivo));
  r = os.ejecutar({ autor: 'ana', tipo: 'enganchar_rastra', objeto: id, x: 0, z: 1 }, T0);
  comprobar('se engancha por el servidor y todos lo ven', r.ok && r.suelo && os.sueloVisible(T0).find(o => o.id === id).arrastra === 'ana', r.motivo);
  pos.ana = { x: 10, z: 10, giro: 0 };
  r = os.ejecutar({ autor: 'ana', tipo: 'soltar_rastra', x: 10, z: 10, rx: 10, rz: 10 - DETRAS }, T0);
  const o = os.sueloVisible(T0).find(q => q.id === id);
  comprobar('se suelta donde la ha llevado', r.ok && Math.abs(o.x - 10) < 0.01 && Math.abs(o.z - (10 - DETRAS)) < 0.01 && !o.arrastra);
  os.ejecutar({ autor: 'ana', tipo: 'enganchar_rastra', objeto: id, x: 10, z: 10 }, T0);
  pos.ana = { x: 40, z: 0, giro: Math.PI / 2 };
  comprobar('quien se va suelta la rastra donde estaba', os.soltarAlSalir('ana', T0) && Math.abs(os.sueloVisible(T0).find(q => q.id === id).x - (40 - DETRAS)) < 0.02);
  const sin = new ObjetosServidor({ posicion: a => pos[a] || null });
  comprobar('sin arcón de pruebas, no sale ninguna rastra', !sin.ejecutar({ autor: 'ana', tipo: 'arcon_al_suelo', objeto: 'rastra', x: 40, z: 0 }, T0).ok);
  const os2 = new ObjetosServidor({ posicion: a => pos[a] || null, arconPruebas: true }).importar(JSON.parse(JSON.stringify(os.exportar())), T0);
  comprobar('al volver a arrancar el servidor la rastra sigue donde estaba', os2.sueloVisible(T0).some(q => q.id === id && q.cosa.tipo === 'rastra'));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
