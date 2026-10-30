// Pruebas de los objetos en el suelo (src/logica/suelo.js). Ejecutar: node pruebas/prueba_suelo.mjs
// Con MUTAR=1 lo soltado no desaparece nunca y las piedras no hacen pila: las pruebas deben FALLAR.
import { Suelo, DURA_SUELO, HORA, RADIO_PILA, ALCANCE_COGER, DE_PILA, esDePila, ejecutarSuelo, guardarSuelo, cargarSuelo,
  migrarSuelo, VERSION_SUELO } from '../src/logica/suelo.js';
import { Inventarios, Inventario, CATALOGO } from '../src/logica/inventario.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') { DE_PILA.splice(DE_PILA.indexOf('piedra'), 1); DE_PILA.push('cuchillo'); }
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 9, 30, 12);
const conCinto = () => { const inv = Inventario.inicial(); inv.lugares.cintura = { tipo: 'cinto_cuero', n: 1, dentro: [null, null, null] }; return inv; };

console.log('Lo que dice el GDD (apartado 7)');
{
  comprobar('lo soltado fuera de tus tierras desaparece pasada 1 hora real', DURA_SUELO === HORA && HORA === 3600000);
  comprobar('troncos y piedras se quedan como pila', ['tronco_delgado', 'tronco_largo', 'tronco_corto', 'lena', 'piedra', 'bloque_piedra'].every(esDePila) && !esDePila('rama') && !esDePila('cuchillo'));
  comprobar('todo lo de pila existe en el catálogo', DE_PILA.every(t => CATALOGO[t]));
}

console.log('Soltar y que desaparezca (por tiempo transcurrido)');
{
  const s = new Suelo(), inv = conCinto();
  inv.lugares['mano:der'] = { tipo: 'cuchillo', n: 1 };
  const r = s.soltar(inv, 'mano:der', undefined, 3, 4, T0, 'ana', false);
  comprobar('soltar el cuchillo: sale de la mano y queda en el suelo a tus pies', r.ok && !inv.lugares['mano:der'] && s.visibles(T0).length === 1 && s.objetos[0].x === 3 && s.objetos[0].z === 4);
  comprobar('el objeto guarda quién lo soltó y cuándo', s.objetos[0].autor === 'ana' && s.objetos[0].soltado === T0);
  comprobar('a los 59 minutos sigue ahí', s.visibles(T0 + 59 * 60000).length === 1);
  comprobar('pasada la hora ya no está', s.visibles(T0 + HORA).length === 0 && s.porId(r.objeto, T0 + HORA) === null);
  comprobar('no se puede coger lo que ya desapareció', !s.coger(inv, r.objeto, 3, 4, T0 + HORA + 1).ok);
  comprobar('limpiar lo quita de la lista', s.limpiar(T0 + HORA) === 1 && s.objetos.length === 0);
  // dentro de tus tierras
  inv.lugares['mano:der'] = { tipo: 'cuchillo', n: 1 };
  const t = s.soltar(inv, 'mano:der', undefined, 0, 0, T0, 'ana', true);
  comprobar('dentro de tus tierras no desaparece (ni pasado un año)', t.ok && t.desaparece === null && s.visibles(T0 + 365 * 24 * HORA).length === 1);
  // soltar parte de una pila
  inv.lugares.cintura.dentro[1] = { tipo: 'silex', n: 6 };
  const p = s.soltar(inv, 'cintura/1', 2, 10, 10, T0, 'ana', false);
  comprobar('soltar 2 de 6 sílex: quedan 4 en el hueco y 2 en el suelo', p.ok && inv.lugares.cintura.dentro[1].n === 4 && p.cosa.n === 2);
  comprobar('soltar de un hueco vacío no hace nada', !s.soltar(inv, 'cintura/2', undefined, 0, 0, T0, 'ana', false).ok && s.objetos.length === 2);
}

console.log('Pilas de troncos y piedras');
{
  const s = new Suelo();
  const a = s.dejar({ tipo: 'piedra', n: 3 }, 5, 5, T0, 'ana', false);
  comprobar('la piedra soltada fuera de tus tierras no desaparece', a.desaparece === null && s.visibles(T0 + 1000 * HORA).length === 1);
  s.dejar({ tipo: 'piedra', n: 2 }, 5 + RADIO_PILA * 0.6, 5, T0 + 5, 'luis', false);
  comprobar('otra piedra a menos de 1 m se suma a la pila', s.objetos.length === 1 && s.objetos[0].cosa.n === 5, `${s.objetos.length} objetos`);
  s.dejar({ tipo: 'piedra', n: 1 }, 5 + RADIO_PILA * 1.5, 5, T0, 'ana', false);
  comprobar('más lejos, otra pila', s.objetos.length === 2);
  s.dejar({ tipo: 'tronco_corto', n: 1 }, 5, 5, T0, 'ana', false);
  s.dejar({ tipo: 'tronco_corto', n: 1 }, 5.2, 5, T0, 'ana', false);
  comprobar('los troncos hacen su propia pila, sin mezclarse con la piedra', s.objetos.length === 3 && s.objetos.find(o => o.cosa.tipo === 'tronco_corto').cosa.n === 2);
  s.dejar({ tipo: 'rama', n: 2 }, 20, 20, T0, 'ana', false); s.dejar({ tipo: 'rama', n: 1 }, 20.2, 20, T0, 'ana', false);
  comprobar('las ramas no hacen pila y desaparecen', s.objetos.filter(o => o.cosa.tipo === 'rama').length === 2 && s.visibles(T0 + HORA).every(o => o.cosa.tipo !== 'rama'));
  // coger de una pila lo que quepa
  const inv = conCinto(); // manos: 3 + 3 piedras; el cinto: un hueco M (3) y dos P (no admiten M)
  const pilaGrande = s.dejar({ tipo: 'piedra', n: 30 }, 40, 40, T0, 'ana', false);
  const c = s.coger(inv, pilaGrande.id, 40, 40, T0);
  comprobar('coger de una pila de 30 piedras sin decir cuánto: lo que cabe (9) y el resto se queda', c.ok && c.cantidad === 9 && pilaGrande.cosa.n === 21 && inv.cuantos('piedra') === 9, `${c.cantidad}`);
  comprobar('con todo lleno no se coge nada', !s.coger(inv, pilaGrande.id, 40, 40, T0).ok && pilaGrande.cosa.n === 21);
  const inv2 = Inventario.inicial();
  const c2 = s.coger(inv2, pilaGrande.id, 40, 40, T0, 'mano:izq', 2);
  comprobar('coger 2 a la mano izquierda', c2.ok && inv2.lugares['mano:izq'].n === 2 && pilaGrande.cosa.n === 19);
  const tl = s.dejar({ tipo: 'tronco_largo', n: 1 }, 60, 60, T0, 'ana', false);
  comprobar('el tronco largo es enorme: no se coge con las manos', !s.coger(Inventario.inicial(), tl.id, 60, 60, T0).ok);
}

console.log('Coger del suelo');
{
  const s = new Suelo(), inv = Inventario.inicial();
  const o = s.dejar({ tipo: 'hacha_mano', n: 1 }, 0, 0, T0, 'ana', false);
  comprobar('lejos (más de 2 m) no se coge', !s.coger(inv, o.id, ALCANCE_COGER + 0.5, 0, T0).ok && s.objetos.length === 1);
  const c = s.coger(inv, o.id, 1, 0, T0);
  comprobar('cerca se coge: va a la mano y deja el suelo', c.ok && inv.lugares['mano:der'].tipo === 'hacha_mano' && s.objetos.length === 0);
  // contenedor con lo de dentro
  const inv3 = conCinto(); inv3.lugares.espalda = { tipo: 'cesta_recoleccion', n: 1, dentro: [{ tipo: 'bayas', n: 7 }, null, null, null, null, null] };
  const sc = s.soltar(inv3, 'espalda', undefined, 2, 2, T0, 'ana', false);
  comprobar('la cesta se suelta con las bayas dentro', sc.ok && s.porId(sc.objeto, T0).cosa.dentro[0].n === 7);
  const inv4 = Inventario.inicial();
  const cc = s.coger(inv4, sc.objeto, 2, 2, T0, 'espalda');
  comprobar('y se coge a la espalda con las bayas', cc.ok && inv4.lugares.espalda.tipo === 'cesta_recoleccion' && inv4.cuantos('bayas') === 7);
  const g = s.dejar({ tipo: 'tronco_delgado', n: 1 }, 0, 0, T0, 'ana', false);
  const inv5 = Inventario.inicial(); inv5.lugares['mano:der'] = { tipo: 'cuchillo', n: 1 };
  comprobar('el tronco delgado (grande) no se coge con una mano ocupada', !s.coger(inv5, g.id, 0, 0, T0).ok);
  // lo apartado al cargar cae al suelo
  const inv6 = Inventario.inicial(); inv6.apartado = [{ tipo: 'silex', n: 3 }, { tipo: 'rama', n: 1 }];
  comprobar('lo que no cupo al cargar («a tus pies») cae al suelo', s.dejarApartado(inv6, 7, 7, T0, 'ana', false) === 2 && inv6.apartado.length === 0 && s.cercanos(7, 7, T0).length === 2);
}

console.log('Acciones con autor');
{
  const s = new Suelo(), invs = new Inventarios(), reg = new RegistroAcciones();
  invs.de('ana').lugares['mano:der'] = { tipo: 'cuchillo', n: 1 };
  const tierras = (autor, x, z) => autor === 'ana' && Math.hypot(x, z) < 20;
  const r = ejecutarSuelo(s, invs, reg, { autor: 'ana', tipo: 'soltar_suelo', de: 'mano:der', x: 1, z: 1 }, T0, tierras);
  comprobar('ana suelta en sus tierras: no desaparece', r.ok && r.desaparece === null);
  const r2 = ejecutarSuelo(s, invs, reg, { autor: 'luis', tipo: 'coger_suelo', objeto: r.objeto, x: 1.5, z: 1 }, T0 + 10, tierras);
  comprobar('luis lo coge: va a su inventario, no al de ana', r2.ok && invs.de('luis').lugares['mano:der'].tipo === 'cuchillo' && !invs.de('ana').lugares['mano:der']);
  invs.de('luis').lugares['mano:izq'] = { tipo: 'silex', n: 2 };
  const r3 = ejecutarSuelo(s, invs, reg, { autor: 'luis', tipo: 'soltar_suelo', de: 'mano:izq', x: 1, z: 1 }, T0, tierras);
  comprobar('luis suelta en las tierras de ana: sí desaparece (no son las suyas)', r3.ok && r3.desaparece === T0 + HORA);
  comprobar('sin autor no vale', !ejecutarSuelo(s, invs, reg, { tipo: 'coger_suelo', objeto: 's1', x: 0, z: 0 }, T0).ok);
  comprobar('datos raros no valen', !ejecutarSuelo(s, invs, reg, { autor: 'ana', tipo: 'soltar_suelo', de: 'mano:der', x: 'a', z: 0 }, T0).ok
    && !ejecutarSuelo(s, invs, reg, { autor: 'ana', tipo: 'coger_suelo', x: 0, z: 0 }, T0).ok && !ejecutarSuelo(s, invs, reg, { autor: 'ana', tipo: 'robar', x: 0, z: 0 }, T0).ok);
  comprobar('sin hora no vale', !ejecutarSuelo(s, invs, reg, { autor: 'ana', tipo: 'coger_suelo', objeto: r3.objeto, x: 1, z: 1 }, NaN).ok);
  comprobar('todo queda anotado en el registro, salga bien o no, con su autor', reg.entradas.length === 8 && reg.entradas[1].autor === 'luis' && reg.entradas[1].ok && !reg.entradas[3].ok, `${reg.entradas.length}`);
}

console.log('Guardado con migración');
{
  const s = new Suelo();
  s.dejar({ tipo: 'piedra', n: 4 }, 1, 2, T0, 'ana', false);
  s.dejar({ tipo: 'cesta_recoleccion', n: 1, dentro: [{ tipo: 'setas', n: 3 }, null, null, null, null, null] }, 3, 3, T0, 'ana', false);
  const mem = {}, alm = { setItem: (k, v) => { mem[k] = v; }, getItem: k => mem[k] ?? null };
  guardarSuelo(alm, s);
  const s2 = cargarSuelo(alm, new Suelo());
  comprobar('se guarda y se carga igual (con lo de dentro de la cesta)', JSON.stringify(s2.exportar()) === JSON.stringify(s.exportar()));
  const n = s2.dejar({ tipo: 'rama', n: 1 }, 50, 50, T0, 'ana', false);
  comprobar('los ids nuevos no repiten los cargados', !s.objetos.some(o => o.id === n.id));
  comprobar('versión del formato', s.exportar().version === VERSION_SUELO);
  comprobar('lo roto, sin versión o de una versión futura se descarta', migrarSuelo(null) === null && migrarSuelo({ objetos: [] }) === null && migrarSuelo({ version: VERSION_SUELO + 1, objetos: [] }) === null);
  const raro = new Suelo().importar({ version: VERSION_SUELO, objetos: [{ id: 's1', cosa: { tipo: 'dragon', n: 1 }, x: 0, z: 0 }, { id: 's2', cosa: { tipo: 'rama', n: 1 }, x: 'x', z: 0 }, { id: 's3', cosa: { tipo: 'rama', n: 2 }, x: 1, z: 1, desaparece: T0 }] });
  comprobar('lo desconocido o sin sitio se descarta; lo bueno se queda con su hora', raro.objetos.length === 1 && raro.objetos[0].desaparece === T0);
  comprobar('un almacén roto no rompe nada', cargarSuelo({ getItem: () => '{roto' }, new Suelo()).objetos.length === 0);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
