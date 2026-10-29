// Pruebas de recoger del suelo y de las plantas (src/logica/recoleccion.js). Ejecutar: node pruebas/prueba_recoleccion.mjs
// Con MUTAR=1 las ramas salen también en los claros y vuelven al momento: las pruebas deben FALLAR.
import { RECOLECTABLES, TIEMPOS, Recoleccion, repartirPuntos, cantidadDe, ejecutarRecoleccion, ALCANCE_RECOGER,
  guardarRecoleccion, cargarRecoleccion, migrarRecoleccion, VERSION_RECOLECCION } from '../src/logica/recoleccion.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') { RECOLECTABLES.ramas.donde.push('claro'); RECOLECTABLES.ramas.vuelve = 0; }
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
  comprobar('piedra suelta: ríos y laderas, 1 piedra mediana', R.piedra.donde.join() === 'rio,ladera' && R.piedra.max === 1 && CATALOGO.piedra.tam === 'M');
  comprobar('sílex: zonas calizas y ríos, 1 nódulo pequeño', R.silex.donde.join() === 'caliza,rio' && R.silex.max === 1 && CATALOGO.silex.tam === 'P');
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

console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
