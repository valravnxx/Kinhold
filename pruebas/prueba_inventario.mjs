// Pruebas del inventario por huecos (src/logica/inventario.js). Ejecutar: node pruebas/prueba_inventario.mjs
// Con MUTAR=1 el tronco corto pasa a ser mediano (cabría en una mano y en un hueco mediano): las pruebas deben FALLAR.
// Con MUTAR=2 el leñero admite piedras y el cinto de cuero pierde su hueco mediano: las del equipo de carga deben FALLAR.
import { Inventario, Inventarios, CATALOGO, pila, ejecutarInventario, migrar, MIGRACIONES, VERSION_INVENTARIO,
  guardarInventarios, cargarInventarios, CLAVE_INVENTARIO, capacidad, EQUIPO_CARGA, factorVelocidad, factorPeso, RALENTIZACION_MAXIMA } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

const MUTAR = process.env.MUTAR === '1';
if (process.env.MUTAR === '2') { CATALOGO.lenero.admite.push('piedra'); CATALOGO.cinto_cuero.huecos[0].tam = 'P'; }
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
// Catálogo de las pruebas: el del juego más un contenedor de espalda y un cinto con un hueco mediano y una vaina.
const CAT = {
  ...CATALOGO,
  ...(MUTAR ? { tronco_corto: { ...CATALOGO.tronco_corto, tam: 'M' } } : {}),
  cesta_prueba: { nombre: 'Cesta de prueba', tam: 'G', lugar: 'espalda', huecos: [{ tam: 'M' }, { tam: 'M' }, { tam: 'P' }], admite: ['bayas', 'setas', 'huevo', 'cuchillo'] },
  lenero_prueba: { nombre: 'Leñero de prueba', tam: 'G', lugar: 'espalda', huecos: [{ tam: 'G' }, { tam: 'G' }], admite: ['lena', 'tronco_corto'] },
  cinto_prueba: { nombre: 'Cinto de prueba', tam: 'M', lugar: 'cintura', huecos: [{ tam: 'M' }, { tam: 'P' }, { tam: 'M', admite: ['espada'] }] },
  bolsa_prueba: { nombre: 'Bolsa de prueba', tam: 'P', huecos: [{ tam: 'P' }, { tam: 'P' }] },
  saco_prueba: { nombre: 'Saco de prueba', tam: 'M', lugar: 'hombro', huecos: [{ tam: 'M' }] },
  espada: { nombre: 'Espada', tam: 'M' },
};

console.log('Tamaños y pilas');
{
  comprobar('cada cosa del catálogo tiene un tamaño P, M, G o E', Object.values(CATALOGO).every(d => ['P', 'M', 'G', 'E'].includes(d.tam)));
  comprobar('los recursos se apilan según su tamaño (fibra 10, piedra 3, tronco corto 1)',
    pila('fibra') === 10 && pila('piedra') === 3 && pila('tronco_corto') === 1, `${pila('fibra')}, ${pila('piedra')}, ${pila('tronco_corto')}`);
  comprobar('las herramientas y la ropa no se apilan', pila('cuchillo') === 1 && pila('camisa_lino') === 1);
}

console.log('Empiezas con lo puesto');
{
  const inv = Inventario.inicial(CAT);
  comprobar('camisa y pantalón de lino puestos', inv.lugares['ropa:interior'].tipo === 'camisa_lino' && inv.lugares['ropa:piernas'].tipo === 'pantalon_lino');
  comprobar('manos, espalda, cintura y hombro vacíos', ['mano:der', 'mano:izq', 'espalda', 'cintura', 'hombro'].every(l => inv.lugares[l] === null));
  comprobar('sin cinturón no hay huecos de cintura', inv.huecosCintura().length === 0);
  const r = inv.coger('cuchillo', 1, 'cintura/0');
  comprobar('sin cinturón no se puede guardar nada en la cintura', !r.ok && r.motivo === 'Ahí no hay huecos.', r.motivo);
}

console.log('Manos');
{
  const inv = Inventario.inicial(CAT);
  comprobar('lo pequeño va en una mano', inv.coger('cuchillo', 1, 'mano:der').ok);
  comprobar('lo mediano va en la otra', inv.coger('piedra', 2, 'mano:izq').ok);
  comprobar('en una mano con piedras se juntan más piedras hasta la pila', inv.coger('piedra', 1, 'mano:izq').ok && inv.lugares['mano:izq'].n === 3);
  const r = inv.coger('piedra', 1, 'mano:izq');
  comprobar('pasada la pila ya no cabe', !r.ok && r.motivo === 'Ese hueco está lleno.', r.motivo);
  const r2 = inv.coger('fibra', 1, 'mano:der');
  comprobar('no se mezclan dos cosas en el mismo hueco', !r2.ok && r2.motivo === 'Ese sitio está ocupado.', r2.motivo);
  const inv2 = Inventario.inicial(CAT);
  inv2.coger('cuchillo', 1, 'mano:izq');
  const r3 = inv2.coger('tronco_corto', 1, 'mano:der');
  comprobar('lo grande necesita las dos manos libres', !r3.ok && r3.motivo === 'Eso es grande: necesitas las dos manos libres.', r3.motivo);
  inv2.soltar('mano:izq');
  comprobar('con las dos libres, lo grande se coge', inv2.coger('tronco_corto', 1, 'mano:der').ok);
  const r4 = inv2.coger('cuchillo', 1, 'mano:izq');
  comprobar('con algo grande, la otra mano queda ocupada', !r4.ok && r4.motivo === 'Tienes las dos manos ocupadas.', r4.motivo);
  const r5 = inv2.coger('tronco_largo', 1, 'mano:izq');
  comprobar('lo enorme no se lleva encima', !r5.ok && /enorme/.test(r5.motivo), r5.motivo);
  comprobar('lo grande se pasa de una mano a la otra', inv2.mover('mano:der', 'mano:izq').ok && inv2.lugares['mano:izq'].tipo === 'tronco_corto' && !inv2.lugares['mano:der']);
}

console.log('Cinturón y contenedores');
{
  const inv = Inventario.inicial(CAT);
  inv.coger('cordel', 1, 'mano:der');
  comprobar('el cordel de fibra se ata como cinturón', inv.ponerse('mano:der').ok && inv.lugares.cintura.tipo === 'cordel' && !inv.lugares['mano:der']);
  comprobar('el cordel da un hueco pequeño de cintura', inv.huecosCintura().length === 1 && inv.huecosCintura()[0].tam === 'P');
  comprobar('el cuchillo cabe en ese hueco', inv.coger('cuchillo', 1, 'cintura/0').ok);
  const r = inv.coger('hacha_mano', 1, 'cintura/0');
  comprobar('el hacha de mano (mediana) no cabe en un hueco pequeño', !r.ok, r.motivo);
  const r1 = inv.coger('cuchillo', 1, 'cintura/1');
  comprobar('un hueco que el cinturón no tiene no existe', !r1.ok && r1.motivo === 'Ese hueco no existe.', r1.motivo);

  const inv2 = Inventario.inicial(CAT);
  inv2.coger('cinto_prueba', 1, 'mano:der'); inv2.ponerse('mano:der');
  comprobar('un cinto con hueco mediano lleva el hacha de mano', inv2.coger('hacha_mano', 1, 'cintura/0').ok);
  const r2 = inv2.coger('hacha_mano', 1, 'cintura/2');
  comprobar('la vaina solo admite la espada', !r2.ok && r2.motivo === 'Eso no va en ese hueco.', r2.motivo);
  comprobar('la espada va en su vaina', inv2.coger('espada', 1, 'cintura/2').ok);
  comprobar('una bolsa pequeña colgada del cinto', inv2.coger('bolsa_prueba', 1, 'cintura/1').ok);
  comprobar('dentro de la bolsa, sílex', inv2.coger('silex', 4, 'cintura/1/0').ok && inv2.cuantos('silex') === 4);
  const r3 = inv2.mover('cintura/1', 'cintura/1/1');
  comprobar('una bolsa no se mete dentro de sí misma', !r3.ok, r3.motivo);
  const r4 = inv2.coger('piedra', 1, 'cintura/1/1');
  comprobar('lo mediano no cabe en la bolsa pequeña', !r4.ok, r4.motivo);

  const r5 = inv2.coger('cesta_prueba', 1, 'cintura/0');
  comprobar('una cesta de espalda no va en un hueco ocupado', !r5.ok, r5.motivo);
  inv2.coger('cesta_prueba', 1, 'espalda');
  comprobar('la cesta se lleva a la espalda', inv2.lugares.espalda && inv2.lugares.espalda.tipo === 'cesta_prueba');
  comprobar('la cesta admite bayas', inv2.coger('bayas', 6, 'espalda/0').ok);
  const r6 = inv2.coger('piedra', 1, 'espalda/1');
  comprobar('la cesta no admite piedras', !r6.ok && r6.motivo === 'Eso no va en ese hueco.', r6.motivo);
  const r7 = inv2.coger('cinto_prueba', 1, 'espalda');
  comprobar('la espalda ya está ocupada', !r7.ok, r7.motivo);
  const r8 = inv2.coger('piedra', 1, 'hombro');
  comprobar('al hombro solo va lo que se lleva al hombro', !r8.ok && r8.motivo === 'Eso no se lleva ahí.', r8.motivo);
  comprobar('un saco al hombro con piedras', inv2.coger('saco_prueba', 1, 'hombro').ok && inv2.coger('piedra', 3, 'hombro/0').ok);

  const inv3 = Inventario.inicial(CAT);
  inv3.coger('lenero_prueba', 1, 'espalda');
  comprobar('el leñero lleva troncos cortos', inv3.coger('tronco_corto', 1, 'espalda/0').ok);
  const r9 = inv3.coger('bayas', 1, 'espalda/1');
  comprobar('el leñero no lleva bayas', !r9.ok, r9.motivo);
  const inv4 = Inventario.inicial(CAT); inv4.coger('cesta_prueba', 1, 'espalda');
  const r10 = inv4.coger('tronco_corto', 1, 'espalda/0');
  comprobar('un tronco corto (grande) no cabe en un hueco mediano', !r10.ok && r10.motivo === 'No cabe en ese hueco.', r10.motivo);
}

console.log('Mover, soltar, ponerse y quitarse');
{
  const inv = Inventario.inicial(CAT);
  inv.coger('piedra', 3, 'mano:der');
  inv.coger('saco_prueba', 1, 'hombro');
  comprobar('mover parte de una pila', inv.mover('mano:der', 'hombro/0', 2).ok && inv.lugares['mano:der'].n === 1 && inv.cuantos('piedra') === 3);
  const r = inv.mover('mano:der', 'hombro/0', 2);
  comprobar('no se mueve más de lo que hay', !r.ok && r.motivo === 'Cantidad no válida.', r.motivo);
  const s = inv.soltar('hombro/0', 1);
  comprobar('soltar parte devuelve lo soltado', s.ok && s.cosa.tipo === 'piedra' && s.cosa.n === 1 && inv.cuantos('piedra') === 2);
  const antes = JSON.stringify(inv.exportarJugador());
  const r2 = inv.mover('mano:der', 'ropa:cabeza');
  comprobar('un movimiento que no cabe deja todo como estaba', !r2.ok && JSON.stringify(inv.exportarJugador()) === antes, r2.motivo);
  // quitarse con lo que lleva dentro
  const q = inv.quitarse('hombro', 'mano:izq');
  comprobar('al quitarse el saco, sus piedras van con él', q.ok && inv.lugares['mano:izq'].tipo === 'saco_prueba' && inv.lugares['mano:izq'].dentro[0].n === 1, q.motivo);
  const q2 = inv.quitarse('ropa:interior', 'mano:izq');
  comprobar('quitarse a una mano ocupada no se hace', !q2.ok && inv.lugares['ropa:interior'], q2.motivo);
  inv.soltar('mano:der');
  comprobar('quitarse la camisa a la mano', inv.quitarse('ropa:interior', 'mano:der').ok && !inv.lugares['ropa:interior']);
  comprobar('y volver a ponérsela', inv.ponerse('mano:der').ok && inv.lugares['ropa:interior'].tipo === 'camisa_lino');
  const p = inv.coger('piedra', 1, 'mano:der') && inv.ponerse('mano:der');
  comprobar('una piedra no se pone', !p.ok && p.motivo === 'Eso no se pone.', p.motivo);
  inv.soltar('mano:der'); inv.coger('camisa_lino', 1, 'mano:der');
  const p2 = inv.ponerse('mano:der');
  comprobar('no se pone una segunda camisa en la misma capa', !p2.ok, p2.motivo);
  const sb = inv.soltar('mano:izq');
  comprobar('soltar un contenedor lo suelta con lo de dentro', sb.ok && sb.cosa.dentro && sb.cosa.dentro[0].tipo === 'piedra');
}

console.log('Acciones con autor, por jugador');
{
  const invs = new Inventarios(CAT), reg = new RegistroAcciones();
  const A = (autor, a) => ejecutarInventario(invs, reg, { autor, ...a });
  const r0 = ejecutarInventario(invs, reg, { tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:der' });
  comprobar('sin autor se rechaza', !r0.ok && r0.motivo === 'Acción sin autor.');
  const r1 = A('jugador:ana', { tipo: 'coger', objeto: 'piedra', cantidad: 'dos', a: 'mano:der' });
  comprobar('con datos raros se rechaza', !r1.ok && r1.motivo === 'Datos no válidos.');
  const r1b = A('jugador:ana', { tipo: 'volar' });
  comprobar('una acción desconocida se rechaza', !r1b.ok && r1b.motivo === 'Acción desconocida.');
  A('jugador:ana', { tipo: 'coger', objeto: 'cordel', cantidad: 1, a: 'mano:der' });
  A('jugador:ana', { tipo: 'ponerse', de: 'mano:der' });
  A('jugador:ana', { tipo: 'coger', objeto: 'cuchillo', cantidad: 1, a: 'cintura/0' });
  A('jugador:bea', { tipo: 'coger', objeto: 'piedra', cantidad: 3, a: 'mano:izq' });
  A('jugador:bea', { tipo: 'mover', de: 'mano:izq', a: 'mano:der', cantidad: 1 });
  const s = A('jugador:bea', { tipo: 'soltar', de: 'mano:der' });
  const ana = invs.de('jugador:ana'), bea = invs.de('jugador:bea');
  comprobar('cada acción va al inventario de su autor', ana.cuantos('cuchillo') === 1 && ana.cuantos('piedra') === 0 && bea.cuantos('piedra') === 2 && bea.cuantos('cuchillo') === 0);
  const r2 = A('jugador:bea', { tipo: 'mover', de: 'cintura/0', a: 'mano:der' });
  comprobar('nadie toca lo de otro: bea no tiene el cuchillo de ana', !r2.ok && ana.cuantos('cuchillo') === 1, r2.motivo);
  comprobar('todo queda anotado con su autor', reg.entradas.length === 10 && reg.entradas.every(e => e.autor !== undefined || !e.ok));
  comprobar('lo soltado queda en el registro', s.ok && reg.entradas[8].resultado && reg.entradas[8].resultado.n === 1);
  comprobar('lo rechazado queda anotado con su motivo', reg.entradas.filter(e => !e.ok).every(e => e.motivo));
  const q = A('jugador:ana', { tipo: 'quitarse', lugar: 'cintura', a: 'mano:izq' });
  comprobar('quitarse el cinturón con el cuchillo dentro', q.ok && ana.huecosCintura().length === 0 && ana.cuantos('cuchillo') === 1);
}

console.log('Guardado y migración');
{
  const invs = new Inventarios(CAT);
  const ana = invs.de('jugador:ana');
  ana.coger('cinto_prueba', 1, 'mano:der'); ana.ponerse('mano:der');
  ana.coger('bolsa_prueba', 1, 'cintura/1'); ana.coger('silex', 5, 'cintura/1/0');
  ana.coger('tronco_corto', 1, 'mano:der');
  const datos = JSON.parse(JSON.stringify(invs.exportar()));
  comprobar('el guardado lleva su versión', datos.version === VERSION_INVENTARIO);
  const otra = Inventarios.importar(datos, CAT);
  comprobar('se carga igual que se guardó', JSON.stringify(otra.exportar()) === JSON.stringify(invs.exportar()));
  // almacenamiento de navegador falso
  const mem = {}; const almacen = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  comprobar('se guarda en el navegador', guardarInventarios(almacen, invs) && typeof mem[CLAVE_INVENTARIO] === 'string');
  comprobar('y se vuelve a cargar', cargarInventarios(almacen, CAT).de('jugador:ana').cuantos('silex') === 5);
  mem[CLAVE_INVENTARIO] = '{roto';
  comprobar('un guardado roto empieza con lo puesto', cargarInventarios(almacen, CAT).de('jugador:ana').lugares['ropa:interior'].tipo === 'camisa_lino');
  const sinAlmacen = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  comprobar('sin almacenamiento no se rompe', !guardarInventarios(sinAlmacen, invs) && cargarInventarios(sinAlmacen, CAT) instanceof Inventarios);
  // el catálogo cambia: el cinto pasa a tener un solo hueco y el sílex se apila de 3 en 3: nada se pierde
  const CAT2 = { ...CAT, cinto_prueba: { ...CAT.cinto_prueba, huecos: [{ tam: 'M' }] }, silex: { ...CAT.silex, pila: 3 } };
  const cambiada = Inventarios.importar(datos, CAT2).de('jugador:ana');
  const apartadoSilex = cambiada.apartado.flatMap(c => [c, ...(c.dentro || [])]).filter(c => c && c.tipo === 'silex').reduce((t, c) => t + c.n, 0);
  comprobar('lo que ya no cabe se aparta sin perderse', cambiada.lugares.cintura.dentro.length === 1 && cambiada.apartado.some(c => c.tipo === 'bolsa_prueba') && apartadoSilex === 5,
    JSON.stringify(cambiada.apartado));
  const raro = Inventarios.importar({ version: 1, jugadores: { x: { lugares: { 'mano:der': { tipo: 'dragon', n: 1 }, 'mano:izq': { tipo: 'piedra', n: 2 } } } } }, CAT).de('x');
  comprobar('lo desconocido se descarta y lo demás se queda', !raro.lugares['mano:der'] && raro.lugares['mano:izq'].n === 2);
  comprobar('un guardado de una versión futura no se entiende', migrar({ version: VERSION_INVENTARIO + 1, jugadores: {} }) === null);
  // un paso de migración de prueba: la versión 0 guardaba las manos como «der» e «izq»
  MIGRACIONES[0] = d => ({ version: 1, jugadores: Object.fromEntries(Object.entries(d.jugadores).map(([k, j]) =>
    [k, { lugares: { 'mano:der': j.der, 'mano:izq': j.izq }, apartado: [] }])) });
  const viejo = Inventarios.importar({ version: 0, jugadores: { y: { der: { tipo: 'cuchillo', n: 1 }, izq: null } } }, CAT).de('y');
  delete MIGRACIONES[0];
  comprobar('un guardado antiguo se migra paso a paso', viejo.lugares['mano:der'] && viejo.lugares['mano:der'].tipo === 'cuchillo');
}

console.log('Equipo de carga (GDD: cinturones, mochilas y bastidores, hombro)');
{
  const ids = l => EQUIPO_CARGA(l).map(k => CATALOGO[k].nombre);
  comprobar('los cinco cinturones', EQUIPO_CARGA('cintura').length === 5, ids('cintura').join(', '));
  comprobar('las diez mochilas y bastidores de espalda', EQUIPO_CARGA('espalda').length === 10, ids('espalda').join(', '));
  comprobar('saco, bandolera y odre al hombro', ['saco', 'bandolera', 'odre'].every(k => EQUIPO_CARGA('hombro').includes(k)) && EQUIPO_CARGA('hombro').length === 3);
  comprobar('lo del hombro no tiene huecos (valravnx: se lleva y se ve, no se abre)', ['saco', 'bandolera', 'odre'].every(k => !(process.env.MUTAR_HOMBRO ? [{ tam: 'M' }] : CATALOGO[k].huecos)));   // MUTAR_HOMBRO: como antes, con huecos
  // huecos de los cinturones, como el GDD
  const hc = k => CATALOGO[k].huecos.map(h => h.tam).sort().join('');
  comprobar('cordel de fibra: 1 pequeño', hc('cordel') === 'P');
  comprobar('cuerda trenzada: 2 pequeños', hc('cuerda_trenzada') === 'PP');
  comprobar('cinto de cuero: 3, uno mediano', hc('cinto_cuero') === 'MPP', hc('cinto_cuero'));
  comprobar('cinto con anillas: 4, dos medianos', hc('cinto_anillas') === 'MMPP');
  comprobar('cinto de armas: vaina para espada y 2 pequeños', hc('cinto_armas') === 'MPP' && CATALOGO.cinto_armas.huecos.filter(h => h.admite && h.admite.join() === 'espada').length === 1);
  // cada cinturón da sus huecos de cintura al ponérselo
  const inv = Inventario.inicial();
  inv.coger('cinto_cuero', 1, 'mano:der'); inv.ponerse('mano:der');
  comprobar('con el cinto de cuero hay 3 huecos de cintura', inv.huecosCintura().length === 3);
  comprobar('el hacha de mano va en su hueco mediano', inv.coger('hacha_mano', 1, 'cintura/0').ok);
  const r = inv.coger('hacha_mano', 1, 'cintura/1');
  comprobar('y no en uno pequeño', !r.ok && r.motivo === 'No cabe en ese hueco.', r.motivo);
  const inv2 = Inventario.inicial();
  inv2.coger('cinto_armas', 1, 'mano:der'); inv2.ponerse('mano:der');
  comprobar('la espada va en la vaina del cinto de armas', inv2.coger('espada', 1, 'cintura/0').ok);
  inv2.soltar('cintura/0');
  const r2 = inv2.coger('hacha_mano', 1, 'cintura/0');
  comprobar('y en la vaina no va otra cosa', !r2.ok && r2.motivo === 'Eso no va en ese hueco.', r2.motivo);
  // leñero: solo leña y troncos cortos, en gran cantidad
  const inv3 = Inventario.inicial();
  inv3.coger('lenero', 1, 'mano:der');
  comprobar('el leñero es grande: en las manos ocupa las dos', !inv3.coger('cuchillo', 1, 'mano:izq').ok);
  comprobar('el leñero se pone a la espalda', inv3.ponerse('mano:der').ok && inv3.lugares.espalda.tipo === 'lenero');
  comprobar('el leñero lleva troncos cortos', inv3.coger('tronco_corto', 1, 'espalda/0').ok && inv3.coger('tronco_corto', 1, 'espalda/1').ok);
  comprobar('y leña', [2, 3, 4].every(i => inv3.coger('lena', 3, 'espalda/' + i).ok) && inv3.cuantos('lena') === 9);
  const r3 = inv3.coger('piedra', 1, 'mano:der'), r4 = inv3.mover('mano:der', 'espalda/5', 1);
  comprobar('el leñero no lleva piedras', r3.ok && !r4.ok && r4.motivo === 'Eso no va en ese hueco.', r4.motivo);
  const cl = capacidad('lenero');
  comprobar('capacidad del leñero: 2 troncos cortos o 18 de leña, nada más', cl.porTipo.tronco_corto === 2 && cl.porTipo.lena === 18 && Object.keys(cl.porTipo).length === 2 && !cl.mixto, JSON.stringify(cl.porTipo));
  // lo que admite cada uno
  const adm = (k, si, no) => { const c = capacidad(k); return si.every(t => c.porTipo[t] > 0) && no.every(t => !c.porTipo[t]); };
  comprobar('cesta de recolección: bayas, setas, hierbas, frutos y huevos; no piedras', adm('cesta_recoleccion', ['bayas', 'setas', 'hierbas', 'frutos_secos', 'huevo'], ['piedra', 'lena']));
  comprobar('fardo atado: pieles, telas, fibras y paja', adm('fardo', ['piel', 'tela', 'fibra', 'paja'], ['bayas', 'piedra']));
  comprobar('porta-piedras: piedras', adm('porta_piedras', ['piedra'], ['lena']) && capacidad('porta_piedras').porTipo.piedra === 12);
  comprobar('caja de herramientas: herramientas de oficio', adm('caja_herramientas', ['cuchillo', 'hacha_mano'], ['piedra', 'espada']));
  comprobar('carcaj: flechas o virotes', adm('carcaj', ['flecha', 'virote'], ['cuchillo']));
  comprobar('cesto de pescador: pescado y aparejos', adm('cesto_pescador', ['pescado', 'anzuelo'], ['bayas']));
  comprobar('escudo a la espalda: el escudo, nada más', adm('correa_escudo', ['escudo'], ['espada', 'piedra']) && capacidad('correa_escudo').porTipo.escudo === 1);
  comprobar('zurrón y mochila de bastidor son mixtos', ['zurron', 'mochila_bastidor'].every(k => capacidad(k).mixto));
  comprobar('la mochila de bastidor lleva más que el zurrón', capacidad('mochila_bastidor').huecos.length > capacidad('zurron').huecos.length);
  comprobar('el bloque de piedra en bruto no va en ninguna mochila (es enorme)', EQUIPO_CARGA('espalda').every(k => !capacidad(k).porTipo.bloque_piedra));
  // lo de hombro y la espalda a la vez, y cada cosa en su lugar
  const inv4 = Inventario.inicial();
  inv4.coger('saco', 1, 'mano:izq');
  const r5 = inv4.mover('mano:izq', 'espalda');
  comprobar('el saco no se pone a la espalda', !r5.ok && r5.motivo === 'Eso no se lleva ahí.', r5.motivo);
  comprobar('el saco va al hombro', inv4.ponerse('mano:izq').ok && inv4.lugares.hombro.tipo === 'saco');
  const r6 = inv4.coger('grano', 10, 'hombro/0');
  comprobar('y no se abre: no tiene huecos', !r6.ok, r6.motivo);
  inv4.coger('cesta_recoleccion', 1, 'mano:der');
  comprobar('con el saco al hombro se puede llevar una cesta a la espalda', inv4.ponerse('mano:der').ok && inv4.coger('setas', 4, 'espalda/0').ok);
  // quitarse la mochila con lo que lleva dentro: nada se pierde
  comprobar('al quitarse la cesta se lleva lo que tiene dentro', inv4.quitarse('espalda', 'mano:der').ok && inv4.cuantos('setas') === 4 && inv4.lugares['mano:der'].dentro[0].n === 4);
  comprobar('y se puede volver a poner', inv4.ponerse('mano:der').ok && inv4.cuantos('setas') === 4 && inv4.lugares.espalda.tipo === 'cesta_recoleccion');
  // por acciones con autor y guardado
  const invs = new Inventarios(), reg = new RegistroAcciones();
  const a1 = ejecutarInventario(invs, reg, { autor: 'jugador:ana', tipo: 'coger', objeto: 'odre', cantidad: 1, a: 'mano:der' });
  const a2 = ejecutarInventario(invs, reg, { autor: 'jugador:ana', tipo: 'ponerse', de: 'mano:der' });
  comprobar('el odre se coge y se lleva al hombro con acciones con autor', a1.ok && a2.ok && invs.de('jugador:ana').lugares.hombro.tipo === 'odre');
  const otra = Inventarios.importar(JSON.parse(JSON.stringify(invs.exportar())));
  comprobar('lo del hombro se guarda y se carga', otra.de('jugador:ana').lugares.hombro.tipo === 'odre');
  // un guardado de antes con agua en el odre: el agua no se pierde (queda a tus pies)
  const viejoOdre = Inventarios.importar({ version: 1, jugadores: { b: { lugares: { hombro: { tipo: 'odre', n: 1, dentro: [{ tipo: 'agua', n: 10 }] } }, apartado: [] } } }).de('b');
  comprobar('un odre guardado con agua: el odre al hombro y el agua a tus pies', viejoOdre.lugares.hombro.tipo === 'odre' && viejoOdre.apartado.some(c => c.tipo === 'agua' && c.n === 10));
}

// ---------------- Ralentización por carga (GDD: con poca carga no se nota; al máximo en todo, el 80%) ----------------
{
  const casi = (a, b) => Math.abs(a - b) < 1e-9;
  const mutar = !!process.env.MUTAR_CARGA; // rompe la cuenta a propósito: estas pruebas tienen que fallar
  const mutarPeso = !!process.env.MUTAR_PESO; // quita lo que frena el peso: las del tronco tienen que fallar
  const vel = inv => mutar ? 1 - RALENTIZACION_MAXIMA * inv.lleno().fraccion : mutarPeso ? factorVelocidad(inv.lleno().fraccion) : inv.velocidad();
  const inv = Inventario.inicial();
  comprobar('sin carga se anda a la velocidad de siempre', vel(inv) === 1 && inv.lleno().fraccion === 0);
  comprobar('la ropa puesta no ralentiza (aún)', inv.lugares['ropa:interior'] && vel(inv) === 1);
  inv.coger('silex', 3, 'mano:der');
  comprobar('con poca carga no se nota (menos del 0,5%)', vel(inv) < 1 && vel(inv) > 0.995, String(vel(inv)));
  inv.soltar('mano:der');
  inv.coger('tronco_corto', 1, 'mano:der');
  comprobar('lo grande llena las dos manos', casi(inv.lleno().lugares.manos, 1));
  comprobar('un tronco corto en las manos frena por su peso: el 90%', casi(vel(inv), 0.9), String(vel(inv)));
  // al hombro, solo: antes apenas frenaba (lo lleno daba un 1%); ahora frena por sus 25 kg (valravnx, 31 oct)
  inv.ponerse('mano:der');
  comprobar('el tronco corto al hombro frena: el 90%', inv.lugares.hombro?.tipo === 'tronco_corto' && casi(vel(inv), 0.9), String(vel(inv)));
  inv.soltar('hombro');
  const ligera = Inventario.inicial(); ligera.coger('hacha_piedra', 1, 'mano:der');
  comprobar('un hacha en la mano casi no se nota (más del 98%)', vel(ligera) > 0.98 && vel(ligera) < 1, String(vel(ligera)));
  comprobar('el peso no frena más del 80% ni con datos raros', factorPeso(500) === 0.8 && factorPeso(-3) === 1 && factorPeso(NaN) === 1);
  // todo lleno: leñero lleno a la espalda, cinto lleno, saco lleno al hombro y las manos llenas
  const t = Inventario.inicial();
  const ok = [
    t.coger('lenero', 1, 'mano:der').ok, t.ponerse('mano:der').ok,
    t.coger('tronco_corto', 1, 'espalda/0').ok, t.coger('tronco_corto', 1, 'espalda/1').ok,
    ...[2, 3, 4, 5].map(i => t.coger('lena', 3, 'espalda/' + i).ok),
    t.coger('cinto_anillas', 1, 'mano:der').ok, t.ponerse('mano:der').ok,
    t.coger('piedra', 3, 'cintura/0').ok, t.coger('rama', 3, 'cintura/1').ok, t.coger('silex', 10, 'cintura/2').ok, t.coger('resina', 10, 'cintura/3').ok,
    t.coger('saco', 1, 'mano:der').ok, t.ponerse('mano:der').ok,
    t.coger('piedra', 3, 'mano:der').ok, t.coger('rama', 3, 'mano:izq').ok,
  ];
  comprobar('se puede llenar todo (leñero, cinto, saco al hombro y manos)', ok.every(x => x), ok.map(Number).join(''));
  comprobar('cargado al máximo en todo: el 80%', casi(t.lleno().fraccion, 1) && casi(vel(t), 0.8), String(vel(t)));
  // a medias: la mitad de lleno se nota poco (el 95%), no la mitad de la reducción
  t.soltar('mano:der'); t.soltar('mano:izq'); t.soltar('hombro');
  comprobar('mitad de lleno (espalda y cintura llenas): el 95%', casi(t.lleno().fraccion, 0.5) && casi(vel(t), 0.95), String(vel(t)));
  // crece con lo que llevas: nunca va más rápido por llevar más
  const c = Inventario.inicial(); c.coger('cinto_cuero', 1, 'mano:der'); c.ponerse('mano:der');
  let antes = vel(c), crece = true;
  for (let i = 1; i <= 10; i++) { c.coger('silex', 1, 'cintura/1'); const v = vel(c); if (!(v < antes)) crece = false; antes = v; }
  comprobar('cada cosa más ralentiza un poco más', crece);
  comprobar('un hueco a medias cuenta a medias', casi(c.lleno().lugares.cintura, 1 / 3));
  // llevar puesto un contenedor vacío no cambia nada
  const e = Inventario.inicial(); e.coger('mochila_bastidor', 1, 'mano:der'); e.ponerse('mano:der');
  comprobar('una mochila vacía a la espalda no ralentiza', vel(e) === 1);
  // la cuenta no se sale de 0,8–1 con datos raros, y se guarda y carga con lo que lleva
  comprobar('el factor queda entre 0,8 y 1 con datos raros', factorVelocidad(5) === 0.8 && factorVelocidad(-1) === 1 && factorVelocidad(NaN) === 1);
  const g = Inventarios.importar(JSON.parse(JSON.stringify((() => { const s = new Inventarios(); s.jugadores['jugador:ana'] = t; return s.exportar(); })())));
  comprobar('lo cargado de un guardado ralentiza igual', casi(g.de('jugador:ana').velocidad(), t.velocidad()));
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
