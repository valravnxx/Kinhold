// Pruebas de recoger del suelo y de las plantas (src/logica/recoleccion.js). Ejecutar: node pruebas/prueba_recoleccion.mjs
// Con MUTAR=1 las ramas salen también en los claros y vuelven al momento: las pruebas deben FALLAR.
import { RECOLECTABLES, TIEMPOS, Recoleccion, repartirPuntos, cantidadDe, ejecutarRecoleccion, ALCANCE_RECOGER,
  guardarRecoleccion, cargarRecoleccion, migrarRecoleccion, VERSION_RECOLECCION } from '../src/logica/recoleccion.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { RECETAS } from '../src/logica/fabricacion.js';
import { comestible } from '../src/logica/necesidades.js';

if (process.env.MUTAR === '1') { RECOLECTABLES.ramas.donde.push('claro'); RECOLECTABLES.ramas.vuelve = 0; }
// MUTAR=2: los juncos y el barro, sin herramienta (como si no se mirara): las pruebas deben FALLAR
if (process.env.MUTAR === '2') { RECOLECTABLES.juncos.con = 'manos'; RECOLECTABLES.barro.con = 'manos'; }
// MUTAR=3: la cebada silvestre, en el bosque (como si no fuera del claro): las pruebas deben FALLAR
if (process.env.MUTAR === '3') RECOLECTABLES.cebada_silvestre.donde = ['bosque'];
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const DIA = 24 * 3600 * 1000;
// un terreno de prueba: claro en el centro (x < 0), bosque al este (x > 20), ladera al norte (z > 30), caliza en un rincón
const zonas = (x, z) => [
  ...(x < 0 && z < 30 ? ['claro'] : []), ...(x > 20 ? ['bosque'] : []), ...(z > 30 ? ['ladera'] : []),
  ...(z > 30 && x < -20 ? ['caliza'] : []),
];
const cuantos = { ramas: 12, piedra: 8, silex: 5, ortiga: 6, hierba_larga: 6 };
const puntos = repartirPuntos({ semilla: 5, cuantos, zonas, radio: 80 });

console.log('Lo que dice el documento de sistemas (apartado 3, N0)');
{
  const R = RECOLECTABLES;
  comprobar('ramas caídas: en el bosque, con las manos, 1–3 ramas medianas', R.ramas.donde.join() === 'bosque' && R.ramas.con === 'manos' && R.ramas.min === 1 && R.ramas.max === 3 && CATALOGO.rama.tam === 'M', R.ramas.donde.join());
  comprobar('piedra suelta: ríos y laderas (y algo en el claro, valravnx 1 nov), 1 piedra mediana', R.piedra.donde.join() === 'rio,ladera,claro' && R.piedra.max === 1 && CATALOGO.piedra.tam === 'M');
  comprobar('sílex: zonas calizas y ríos (y algo en el claro), 1 nódulo pequeño', R.silex.donde.join() === 'caliza,rio,claro' && R.silex.max === 1 && CATALOGO.silex.tam === 'P');
  comprobar('fibra: ortiga y hierba larga en claros y riberas, se arranca, 2–4 de fibra cruda pequeña',
    ['ortiga', 'hierba_larga'].every(t => R[t].donde.join() === 'claro,ribera' && R[t].accion === 'arrancar' && R[t].da === 'fibra' && R[t].min === 2 && R[t].max === 4) && CATALOGO.fibra.tam === 'P');
  comprobar('vuelven: ramas en días, piedra y sílex en semanas, fibra en una estación (un mes real)',
    R.ramas.vuelve === 3 * DIA && R.piedra.vuelve === 21 * DIA && R.silex.vuelve === 21 * DIA && R.ortiga.vuelve === 30 * DIA, `${R.ramas.vuelve / DIA} días`);
  comprobar('todo lo que se recoge existe en el catálogo del inventario', Object.values(R).every(d => CATALOGO[d.da]));
}

console.log('Cada cosa sale donde dice el documento');
{
  for (const [tipo, n] of Object.entries(cuantos)) {
    const lista = puntos.filter(p => p.tipo === tipo);
    comprobar(`${tipo}: salen ${n} puntos, todos en sus zonas`, lista.length === n && lista.every(p => RECOLECTABLES[tipo].donde.some(w => zonas(p.x, p.z).includes(w))), `${lista.length}`);
  }
  comprobar('no hay ramas en el claro', !puntos.some(p => p.tipo === 'ramas' && zonas(p.x, p.z).includes('claro') && !zonas(p.x, p.z).includes('bosque')));
  const otra = repartirPuntos({ semilla: 5, cuantos, zonas, radio: 80 });
  comprobar('con la misma semilla, los mismos puntos (para todos igual)', JSON.stringify(otra) === JSON.stringify(puntos));
  const distinta = repartirPuntos({ semilla: 6, cuantos, zonas, radio: 80 });
  comprobar('con otra semilla, otros sitios', JSON.stringify(distinta) !== JSON.stringify(puntos));
  const libre = (x, z) => Math.hypot(x - 40, z) > 10;
  comprobar('no se ponen donde no hay sitio (un tronco, una roca)', repartirPuntos({ semilla: 5, cuantos, zonas, radio: 80, libre }).every(p => libre(p.x, p.z)));
  const ids = new Set(puntos.map(p => p.id));
  comprobar('cada punto tiene su id', ids.size === puntos.length);
}

console.log('Recoger con autor: va al inventario por huecos');
{
  const rec = new Recoleccion(puntos), invs = new Inventarios(), reg = new RegistroAcciones();
  const p = puntos.find(q => q.tipo === 'ramas'), t0 = 1_700_000_000_000;
  const r = ejecutarRecoleccion(rec, invs, reg, { autor: 'jugador:a', tipo: 'recoger', punto: p.id, x: p.x + 1, z: p.z }, t0);
  const n = cantidadDe(p, 0);
  comprobar('se recogen las ramas y van a la mano', r.ok && r.objeto === 'rama' && r.cantidad === n && invs.de('jugador:a').cuantos('rama') === n && r.donde[0][0] === 'mano:der', JSON.stringify(r.donde));
  comprobar('van al inventario del autor y no al de otro', invs.de('jugador:b').cuantos('rama') === 0);
  comprobar('queda en el registro con su autor, lo que dio y la hora', reg.entradas.at(-1).autor === 'jugador:a' && reg.entradas.at(-1).resultado.cantidad === n && reg.entradas.at(-1).ahora === t0);
  const r2 = ejecutarRecoleccion(rec, invs, reg, { autor: 'jugador:b', tipo: 'recoger', punto: p.id, x: p.x, z: p.z }, t0 + 1000);
  comprobar('ya recogido, nadie más lo puede coger', !r2.ok && r2.motivo === 'Ya lo han recogido: aún no ha vuelto a salir.', r2.motivo);
  comprobar('el fallo también queda en el registro', reg.entradas.at(-1).ok === false && reg.entradas.at(-1).autor === 'jugador:b');
  const lejos = puntos.find(q => q.tipo === 'piedra');
  const r3 = ejecutarRecoleccion(rec, invs, reg, { autor: 'jugador:a', tipo: 'recoger', punto: lejos.id, x: lejos.x + ALCANCE_RECOGER + 0.5, z: lejos.z }, t0);
  comprobar('desde lejos no se recoge', !r3.ok && r3.motivo === 'Está demasiado lejos.', r3.motivo);
  comprobar('sin autor, no', !ejecutarRecoleccion(rec, invs, reg, { tipo: 'recoger', punto: lejos.id, x: lejos.x, z: lejos.z }, t0).ok);
  comprobar('con datos que no son números, no', !ejecutarRecoleccion(rec, invs, reg, { autor: 'jugador:a', tipo: 'recoger', punto: lejos.id, x: 'a', z: lejos.z }, t0).ok);
  comprobar('un punto que no existe, no', ejecutarRecoleccion(rec, invs, reg, { autor: 'jugador:a', tipo: 'recoger', punto: 'constructor', x: 0, z: 0 }, t0).motivo === 'Ahí no hay nada que recoger.');
  // fibra: se junta en la misma mano hasta la pila (10)
  const fibras = puntos.filter(q => q.tipo === 'ortiga' || q.tipo === 'hierba_larga');
  const invF = new Inventarios(); let total = 0;
  for (const f of fibras.slice(0, 2)) { const rr = rec.recoger(invF.de('c'), f.id, f.x, f.z, t0); if (rr.ok) total += rr.cantidad; }
  comprobar('la fibra de dos plantas se junta en el mismo hueco', invF.de('c').lugares['mano:der'] && invF.de('c').lugares['mano:der'].n === total && total >= 4, `${total}`);
}

console.log('Juncos, barro y yesca (lo que pide la casa humilde y la hoguera, 7 nov)');
{
  const R = RECOLECTABLES;
  comprobar('juncos: riberas y orilla, con cuchillo, se cortan, de 1 a 3 haces medianos (valravnx, 8 nov), una estación', R.juncos.donde.join() === 'rio,ribera' && R.juncos.con === 'cuchillo' && R.juncos.accion === 'cortar' && R.juncos.da === 'junco' && R.juncos.min === 1 && R.juncos.max === 3 && CATALOGO.junco.tam === 'M' && R.juncos.vuelve === 30 * DIA);
  comprobar('barro: la orilla, se cava con palo o pala, 1 cesta mediana, inagotable', R.barro.donde.includes('rio') && R.barro.con === 'cavar' && R.barro.da === 'barro' && CATALOGO.barro.tam === 'M' && R.barro.vuelve === 0);
  comprobar('hongos yesqueros: en el bosque, con las manos, 1–2 de yesca pequeña', R.yesquero.donde.join() === 'bosque' && R.yesquero.con === 'manos' && R.yesquero.da === 'yesca' && R.yesquero.min === 1 && R.yesquero.max === 2 && CATALOGO.yesca.tam === 'P');
  const pts = [{ id: 'juncos:0', tipo: 'juncos', x: 0, z: 0 }, { id: 'barro:0', tipo: 'barro', x: 3, z: 0 }, { id: 'yesquero:0', tipo: 'yesquero', x: 6, z: 0 }];
  const rec = new Recoleccion(pts), invs = new Inventarios(), reg = new RegistroAcciones(), t0 = 1_700_000_000_000, yo = 'jugador:a';
  const rc = (punto, x, t = t0) => ejecutarRecoleccion(rec, invs, reg, { autor: yo, tipo: 'recoger', punto, x, z: 0 }, t);
  let r = rc('juncos:0', 0.5);
  comprobar('sin cuchillo no se cortan los juncos (y lo dice)', !r.ok && /cuchillo/.test(r.motivo) && invs.de(yo).cuantos('junco') === 0, r.motivo);
  r = rc('barro:0', 3.5);
  comprobar('sin palo cavador no se cava el barro (y lo dice)', !r.ok && /palo cavador/.test(r.motivo) && invs.de(yo).cuantos('barro') === 0, r.motivo);
  r = rc('yesquero:0', 6.5);
  comprobar('los yesqueros se cogen con las manos: dan yesca', r.ok && r.objeto === 'yesca' && invs.de(yo).cuantos('yesca') >= 1, JSON.stringify(r.donde));
  invs.de(yo).sacar(r.donde[0][0], r.cantidad);
  invs.de(yo).meter('mano:izq', { tipo: 'lasca_silex', n: 1 });
  r = rc('juncos:0', 0.5);
  const haces = invs.de(yo).cuantos('junco');
  comprobar('con una lasca de sílex encima, se cortan de 1 a 3 haces de juncos', r.ok && haces >= 1 && haces <= 3, r.motivo || JSON.stringify(r.donde));
  comprobar('y la mata no vuelve hasta dentro de una estación', !rec.disponible('juncos:0', t0 + 29 * DIA) && rec.disponible('juncos:0', t0 + 30 * DIA));
  invs.de(yo).sacar(r.donde[0][0], haces); invs.de(yo).sacar('mano:izq', 1);
  invs.de(yo).meter('mano:izq', { tipo: 'palo_cavador', n: 1 });
  r = rc('barro:0', 3.5);
  comprobar('con el palo cavador, una cesta de barro', r.ok && invs.de(yo).cuantos('barro') === 1, r.motivo);
  r = rc('barro:0', 3.5, t0 + 1000);
  comprobar('el barro no se agota: se vuelve a cavar enseguida', r.ok && invs.de(yo).cuantos('barro') === 2 && rec.disponible('barro:0', t0 + 1000), r.motivo);
  const e = reg.entradas.at(-1), f = reg.entradas.find(x => !x.ok);
  comprobar('queda anotado con su autor, también lo que no se pudo', e.autor === yo && e.ok && e.resultado.objeto === 'barro' && f && /cuchillo/.test(f.motivo), JSON.stringify(e.resultado));
}

console.log('Si no cabe, no se recoge');
{
  const rec = new Recoleccion(puntos), inv = Inventario.inicial();
  inv.coger('tronco_corto', 1, 'mano:der'); // algo grande: las dos manos
  const p = puntos.find(q => q.tipo === 'silex');
  const r = rec.recoger(inv, p.id, p.x, p.z, 0);
  comprobar('con algo grande en las manos no se puede recoger con las manos', !r.ok && r.motivo === 'Tienes las dos manos ocupadas.', r.motivo);
  comprobar('y el punto sigue ahí', rec.disponible(p.id, 0));
  const inv2 = Inventario.inicial();
  inv2.coger('cuchillo', 1, 'mano:der'); inv2.coger('piedra', 3, 'mano:izq');
  const r2 = rec.recoger(inv2, p.id, p.x, p.z, 0);
  comprobar('con las manos llenas y sin cinturón, no cabe', !r2.ok && r2.motivo === 'No te cabe: no tienes sitio libre.', r2.motivo);
  comprobar('y nada ha cambiado en el inventario', inv2.lugares['mano:izq'].n === 3 && inv2.lugares['mano:der'].tipo === 'cuchillo' && rec.disponible(p.id, 0));
  inv2.coger('cordel', 1, 'cintura');
  const r3 = rec.recoger(inv2, p.id, p.x, p.z, 0);
  comprobar('con un cordel de cinturón, el sílex va a su hueco', r3.ok && r3.donde[0][0] === 'cintura/0', JSON.stringify(r3.donde || r3.motivo));
  // reparto: tres ramas con una mano con dos ramas → una a esa mano y el resto a la otra
  const inv3 = Inventario.inicial(); inv3.coger('rama', 2, 'mano:der');
  const rd = inv3.meterDonde('rama', 3);
  comprobar('lo que no cabe en un hueco se reparte en otro', rd.ok && inv3.cuantos('rama') === 5 && rd.donde.length === 2 && rd.donde[0][0] === 'mano:der', JSON.stringify(rd.donde));
  const inv4 = Inventario.inicial(); inv4.coger('cuchillo', 1, 'mano:der');
  comprobar('si se da una ruta preferida y cabe, va ahí', rec.recoger(inv4, puntos.find(q => q.tipo === 'piedra').id, puntos.find(q => q.tipo === 'piedra').x, puntos.find(q => q.tipo === 'piedra').z, 0, 'mano:izq').ok && inv4.lugares['mano:izq'].tipo === 'piedra');
}

console.log('Vuelve a salir pasado su tiempo (tiempo transcurrido)');
{
  const rec = new Recoleccion(puntos), inv = Inventario.inicial(), t0 = 1_000_000;
  const ramas = puntos.find(q => q.tipo === 'ramas'), fibra = puntos.find(q => q.tipo === 'ortiga'), piedra = puntos.find(q => q.tipo === 'piedra');
  rec.recoger(inv, ramas.id, ramas.x, ramas.z, t0);
  comprobar('recién recogidas, las ramas no están', !rec.disponible(ramas.id, t0 + DIA));
  comprobar('a los 3 días han vuelto', rec.disponible(ramas.id, t0 + 3 * DIA));
  comprobar('mientras tanto no salen entre los cercanos', !rec.cercanos(ramas.x, ramas.z, t0 + DIA).some(p => p.id === ramas.id) && rec.cercanos(ramas.x, ramas.z, t0 + 3 * DIA).some(p => p.id === ramas.id));
  comprobar('falta lo que falta', rec.faltaPara(ramas.id, t0 + DIA) === 2 * DIA);
  rec.recoger(Inventario.inicial(), piedra.id, piedra.x, piedra.z, t0);
  comprobar('la piedra tarda semanas: a los 20 días aún no', !rec.disponible(piedra.id, t0 + 20 * DIA) && rec.disponible(piedra.id, t0 + 21 * DIA));
  rec.recoger(Inventario.inicial(), fibra.id, fibra.x, fibra.z, t0);
  comprobar('las ortigas vuelven en una estación (un mes real)', !rec.disponible(fibra.id, t0 + 29 * DIA) && rec.disponible(fibra.id, t0 + 30 * DIA));
  const otra = rec.recoger(Inventario.inicial(), ramas.id, ramas.x, ramas.z, t0 + 3 * DIA);
  comprobar('la segunda vez da lo suyo (azar fijo por vez)', otra.ok && otra.cantidad === cantidadDe(ramas, 1));
  const veces = Array.from({ length: 60 }, (_, v) => cantidadDe(ramas, v));
  comprobar('las ramas dan entre 1 y 3, y salen los tres valores', veces.every(n => n >= 1 && n <= 3) && new Set(veces).size === 3, [...new Set(veces)].sort().join());
}

console.log('Se guarda en el navegador y no se pierde');
{
  const mem = {}; const almacen = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const rec = new Recoleccion(puntos), inv = Inventario.inicial();
  const p = puntos.find(q => q.tipo === 'silex');
  rec.recoger(inv, p.id, p.x, p.z, 5000);
  guardarRecoleccion(almacen, rec);
  const otra = cargarRecoleccion(almacen, new Recoleccion(puntos));
  comprobar('lo recogido sigue agotado al volver', !otra.disponible(p.id, 6000) && otra.faltaPara(p.id, 5000) === rec.faltaPara(p.id, 5000));
  comprobar('con versión', JSON.parse(Object.values(mem)[0]).version === VERSION_RECOLECCION);
  const menos = cargarRecoleccion(almacen, new Recoleccion(puntos.filter(q => q.id !== p.id)));
  comprobar('lo guardado de un punto que ya no existe se descarta', Object.keys(menos.estado).length === 0);
  comprobar('un guardado roto o sin versión se descarta sin romper', migrarRecoleccion({ estado: {} }) === null && cargarRecoleccion({ getItem: () => '{roto' }, new Recoleccion(puntos)).puntos.length === puntos.length);
}

console.log('Las semillas silvestres (P11): cebada y habas en los claros, col y nabo en la ribera, a mano');
{
  const R = RECOLECTABLES, sem = { cebada_silvestre: ['claro', 'semilla_cebada'], habas_silvestres: ['claro', 'habas'], col_silvestre: ['ribera', 'semilla_col'], nabo_silvestre: ['ribera', 'semilla_nabo'] };
  for (const [t, [zona, da]] of Object.entries(sem)) comprobar(`${R[t].nombre}: en ${zona}, con las manos, da ${da} (pequeño)`, R[t].donde.join() === zona && R[t].con === 'manos' && R[t].da === da && CATALOGO[da].tam === 'P' && R[t].vuelve === TIEMPOS.estacion);
  const zonasS = (x, z) => x < 0 ? ['claro'] : ['ribera'];
  const ps = repartirPuntos({ semilla: 9, cuantos: { cebada_silvestre: 3, habas_silvestres: 3, col_silvestre: 3, nabo_silvestre: 3 }, zonas: zonasS, radio: 40 });
  comprobar('cada una sale solo en su zona', ps.length === 12 && ps.every(p => zonasS(p.x, p.z).includes(sem[p.tipo][0])), `${ps.length} puntos`);
  const rec = new Recoleccion(ps), inv = Inventario.inicial(), t0 = 1000;
  const c = ps.find(p => p.tipo === 'cebada_silvestre'), r = rec.recoger(inv, c.id, c.x, c.z, t0);
  comprobar('se recoge la cebada silvestre con las manos libres', r.ok && inv.cuantos('semilla_cebada') === r.cantidad && r.cantidad >= 2 && r.cantidad <= 4, r.motivo || `${r.cantidad}`);
  comprobar('la planta se queda (se van las espigas) y vuelven en una estación', rec.enPie(c.id, t0) && !rec.disponible(c.id, t0 + 29 * DIA) && rec.disponible(c.id, t0 + 30 * DIA));
  // caben en el cinturón (un hueco pequeño) y en la cesta de recolección
  const enCinturon = Inventario.inicial(); enCinturon.lugares.cintura = { tipo: 'cordel', n: 1, dentro: [null] };
  enCinturon.lugares['mano:der'] = { tipo: 'rama', n: 1 }; enCinturon.lugares['mano:izq'] = { tipo: 'rama', n: 1 };   // (las manos llenas: al cinturón)
  const h = ps.find(p => p.tipo === 'habas_silvestres'), r2 = rec.recoger(enCinturon, h.id, h.x, h.z, t0);
  comprobar('las habas caben en el cinturón', r2.ok && enCinturon.lugares.cintura.dentro[0]?.tipo === 'habas' && enCinturon.cuantos('habas') >= 3, r2.motivo || JSON.stringify(enCinturon.lugares.cintura));
  comprobar('las habas crudas no se comen; 3 al fuego dan 3 asadas, que sí', !comestible('habas') && comestible('habas_asadas') && RECETAS.asar_habas.uso === 'fuego' && RECETAS.asar_habas.gasta.habas === 3 && RECETAS.asar_habas.n === 3);
  comprobar('y en la cesta de recolección', ['semilla_cebada', 'habas', 'semilla_col', 'semilla_nabo'].every(t => CATALOGO.cesta_recoleccion.admite.includes(t)));
}

console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
