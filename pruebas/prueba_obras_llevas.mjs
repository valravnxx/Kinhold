// Pruebas de «obras con lo que llevas» (src/logica/acciones.js, construccion.js e inventario.js): lo que se entrega
// a una obra sale de lo que lleva el autor encima, no de un montón común; el montón común es el arcón de pruebas.
// Ejecutar: node pruebas/prueba_obras_llevas.mjs
// Con MUTAR=1 las entregas vuelven a salir del montón común aunque haya inventarios: las pruebas deben FALLAR.
import { Mundo, VARAS_PARA_RODAR } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';
import { Inventarios, CATALOGO, OBJETO_DE_MATERIAL } from '../src/logica/inventario.js';
import { MATERIALES_INICIALES } from '../src/logica/piezas.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const yo = 'jugador:a', otro = 'jugador:b';
function nuevo() {
  const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
  const A = (autor, a) => ejecutar(m, reg, { autor, ...a }, process.env.MUTAR === '1' ? null : invs);
  // el mojón se paga de lo que llevas: tres piedras del arcón de pruebas, a las manos (sin inventarios, del montón)
  A(yo, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  A(yo, { tipo: 'mojon', x: 0, z: 0 });
  return { m, reg, invs, A };
}

console.log('Cada material de las obras es un objeto que se lleva');
for (const k of Object.keys(MATERIALES_INICIALES)) comprobar(`«${k}» tiene su objeto en el catálogo`, !!CATALOGO[OBJETO_DE_MATERIAL[k]], OBJETO_DE_MATERIAL[k]);
comprobar('el tronco de las obras es el tronco delgado del árbol joven (la madera de la casa humilde)', OBJETO_DE_MATERIAL.tronco === 'tronco_delgado');
comprobar('y el tronco corto (sale de tronzar, que no es de este tramo) no paga las obras', !Object.values(OBJETO_DE_MATERIAL).includes('tronco_corto'));

console.log('Entregar a una obra sale de lo que llevas');
{
  const { m, invs, A } = nuevo();
  const r = A(yo, { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  const c = r.construccion, kc = r.clave, cim = c.piezas.get(kc);
  const arcon0 = m.materiales.piedra;
  const e0 = A(yo, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: 8 });
  comprobar('con las manos vacías no se entrega nada, aunque el arcón esté lleno', !e0.ok && !cim.obra.entregado.piedra && m.materiales.piedra === arcon0, e0.motivo);
  const s = A(yo, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 6 });
  comprobar('del arcón se cogen 6 piedras (dos manos, 3 en cada una)', s.ok && invs.de(yo).cuantos('piedra') === 6 && m.materiales.piedra === arcon0 - 6, JSON.stringify(s));
  const s2 = A(yo, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 1 });
  comprobar('lo que no cabe se queda en el arcón', !s2.ok && m.materiales.piedra === arcon0 - 6, s2.motivo);
  const e1 = A(yo, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: 8 });
  comprobar('se entrega lo que llevas (6 de 8) y el arcón no cambia', e1.ok && e1.entregado === 6 && cim.obra.entregado.piedra === 6 && invs.de(yo).cuantos('piedra') === 0 && m.materiales.piedra === arcon0 - 6, JSON.stringify(e1));
  comprobar('la entrega queda con su autor', cim.obra.aportes.at(-1).autor === yo && cim.obra.aportes.at(-1).n === 6);
  const e2 = A(otro, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: 2 });
  comprobar('el otro jugador no entrega con lo que llevo yo', !e2.ok, e2.motivo);
  invs.de(otro).coger('piedra', 3, 'mano:izq');
  const e3 = A(otro, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: 3 });
  comprobar('el otro entrega lo que le falta con lo suyo, y le sobra 1', e3.ok && e3.entregado === 2 && invs.de(otro).cuantos('piedra') === 1 && cim.obra.aportes.at(-1).autor === otro, JSON.stringify(e3));
  let t = { ok: true }; for (let i = 0; i < 1000 && t.ok && !t.terminada; i++) t = A(yo, { tipo: 'trabajar', construccion: c.id, clave: kc, segundos: 5 });
  comprobar('con todo entregado, se trabaja hasta terminarla', t.ok && t.terminada && !cim.obra);
}

console.log('Lo de los contenedores y el hombro también cuenta');
{
  const { m, invs, A } = nuevo();
  const inv = invs.de(yo);
  inv.coger('lenero', 1, 'espalda');
  inv.coger('tronco_corto', 1, 'espalda/0');   // el corto del leñero no vale para la obra
  inv.coger('tronco_delgado', 1, 'hombro');
  const r = A(yo, { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  acabarObra(m, new RegistroAcciones(), yo, r.construccion.id, r.clave);
  const mu = A(yo, { tipo: 'colocar', pieza: 'muro_tronco', x: 1, z: -0.95, k: 0, rot: 0, dir: 0 });
  const p = mu.construccion.piezas.get(mu.clave);
  const e = A(yo, { tipo: 'entregar', construccion: mu.construccion.id, clave: mu.clave, material: 'tronco', cantidad: 4 });
  comprobar('el tronco delgado del hombro se entrega como «tronco»; el corto del leñero, no', e.ok && e.entregado === 1 && p.obra.entregado.tronco === 1 && inv.cuantos('tronco_corto') === 1 && !inv.lugares.hombro, JSON.stringify(e));
  const d = A(yo, { tipo: 'desmontar', construccion: mu.construccion.id, clave: mu.clave });
  comprobar('al desmontar la obra a medias vuelve el tronco delgado, no uno corto', d.ok && inv.cuantos('tronco_delgado') === 1 && inv.cuantos('tronco_corto') === 1, JSON.stringify(d.devuelto || d.motivo));
}

console.log('Subir lo pesado a una obra en alto: la unidad y las varas, de lo que llevas');
{
  const { m, invs, A } = nuevo();
  // una construcción de dos plantas hecha con el atajo (del montón común), y una obra en la planta 1
  const ponerYAcabar = (pieza, x, z, k) => { const r = A(yo, { tipo: 'colocar', pieza, x, z, k, rot: 0, dir: 0 }); if (r.ok) acabarObra(m, new RegistroAcciones(), yo, r.construccion.id, r.clave); return r; };
  for (const [x, z] of [[0, 0], [2, 0]]) ponerYAcabar('cim_piedra', x, z, 0);
  for (const [x, z] of [[1, -0.95], [1, 0.95], [-0.95, 0], [2.95, 0], [3, -0.95], [3, 0.95]]) ponerYAcabar('muro_tronco', x, z, 0);
  const obra = A(yo, { tipo: 'colocar', pieza: 'muro_tronco', x: 1, z: -0.95, k: 1, rot: 0, dir: 0 });
  if (!obra.ok) comprobar('hay una obra en la planta 1', false, obra.motivo);
  else {
    const id = obra.construccion.id, k = obra.clave, inv = invs.de(yo);
    const s0 = A(yo, { tipo: 'subir', construccion: id, clave: k, material: 'tronco', segundos: 5, metodo: 'varas' });
    comprobar('sin llevar el tronco ni las varas no se sube', !s0.ok, s0.motivo);
    inv.coger('tronco_delgado', 1, 'hombro');
    const s1 = A(yo, { tipo: 'subir', construccion: id, clave: k, material: 'tronco', segundos: 5, metodo: 'varas' });
    comprobar('con el tronco pero sin dos varas y una cuerda, tampoco', !s1.ok && inv.cuantos('tronco_delgado') === 1, s1.motivo);
    // con el tronco al hombro, las manos no llevan nada (valravnx, 1 nov): las varas y la cuerda, en la mochila
    inv.coger('mochila_bastidor', 1, 'espalda'); inv.coger('vara', VARAS_PARA_RODAR.vara, 'espalda/0'); inv.coger('cuerda', VARAS_PARA_RODAR.cuerda, 'espalda/1');
    const s2 = A(yo, { tipo: 'subir', construccion: id, clave: k, material: 'tronco', segundos: 5, metodo: 'varas' });
    comprobar('con el tronco al hombro, dos varas y una cuerda: el tronco sale de lo que llevas; las varas no se gastan', s2.ok && inv.cuantos('tronco_delgado') === 0 && inv.cuantos('vara') === 2 && inv.cuantos('cuerda') === 1, JSON.stringify(s2));
  }
}

console.log('El arcón de pruebas: dejar, rellenar y sin inventarios');
{
  const { m, invs, A } = nuevo();
  A(yo, { tipo: 'sacar_arcon', material: 'tabla', cantidad: 3, a: 'mano:izq' });
  comprobar('se coge donde se pide', invs.de(yo).lugares['mano:izq']?.tipo === 'tabla');
  invs.de(yo).coger('lenero', 1, 'espalda');
  const p1 = m.materiales.piedra, sp = A(yo, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 3, a: 'espalda/3' });
  comprobar('con una ruta, va justo ahí o no se coge (la piedra no entra en el leñero, ni acaba en otro sitio)', !sp.ok && invs.de(yo).cuantos('piedra') === 0 && m.materiales.piedra === p1, sp.motivo);
  const t0 = m.materiales.tabla;
  const d = A(yo, { tipo: 'dejar_arcon', de: 'mano:izq', cantidad: 2 });
  comprobar('dejar en el arcón devuelve el material', d.ok && m.materiales.tabla === t0 + 2 && invs.de(yo).cuantos('tabla') === 1, JSON.stringify(d));
  invs.de(yo).coger('espada', 1, 'mano:der');
  comprobar('lo que no es material no va al arcón de materiales', !A(yo, { tipo: 'dejar_arcon', de: 'mano:der', cantidad: 1 }).ok);
  comprobar('un material desconocido no se saca', !A(yo, { tipo: 'sacar_arcon', material: 'constructor', cantidad: 1 }).ok);
  const p0 = m.materiales.piedra;
  A(yo, { tipo: 'rellenar', cantidad: 50 });
  comprobar('rellenar llena el arcón de pruebas', m.materiales.piedra === p0 + 50);
  // sin inventarios (en línea, hasta que el servidor los lleve) todo sigue saliendo del montón común
  const m2 = new Mundo(), reg2 = new RegistroAcciones();
  ejecutar(m2, reg2, { autor: yo, tipo: 'mojon', x: 0, z: 0 });
  const r = ejecutar(m2, reg2, { autor: yo, tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  const e = ejecutar(m2, reg2, { autor: yo, tipo: 'entregar', construccion: r.construccion.id, clave: r.clave, material: 'piedra', cantidad: 8 });
  comprobar('sin inventarios, la entrega sale del montón común (como antes)', e.ok && e.entregado === 8);
  comprobar('sin inventarios no hay arcón', !ejecutar(m2, reg2, { autor: yo, tipo: 'sacar_arcon', material: 'piedra', cantidad: 1 }).ok);
  comprobar('el mundo se rehace igual desde el registro', reproducir(reg2.exportar()).construcciones.length === 1);
}

console.log('El mojón y los muebles se pagan de lo que llevas (no del montón común)');
{
  const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
  const sinInv = process.env.MUTAR === '1';
  const A = (autor, a) => ejecutar(m, reg, { autor, ...a }, sinInv ? null : invs);
  const piedra0 = m.materiales.piedra;
  const r0 = A(yo, { tipo: 'mojon', x: 0, z: 0 });
  comprobar('con las manos vacías no se pone el mojón, aunque el montón común esté lleno', !r0.ok && !m.mojonDe(yo) && m.materiales.piedra === piedra0, r0.motivo);
  comprobar('y dice que no llevas los materiales', r0.motivo === 'No llevas los materiales.', r0.motivo);
  A(yo, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  const enArcon = m.materiales.piedra;
  const r1 = A(yo, { tipo: 'mojon', x: 0, z: 0, lleva: true });   // «lleva» del navegador no vale: se pisa
  comprobar('con tres piedras encima sí, y salen de lo que llevas', r1.ok && invs.de(yo).cuantos('piedra') === 0 && m.materiales.piedra === enArcon, JSON.stringify(r1));
  // un mueble: la mesa pide 3 tablas y 4 clavos
  const mesa = { tipo: 'decorar', pieza: 'mesa', x: 1, y: 0, z: 1, rot: 0 };
  const d0 = A(yo, mesa);
  comprobar('sin las tablas y los clavos encima no se pone la mesa', !d0.ok && m.decoracion.length === 0, d0.motivo);
  A(yo, { tipo: 'sacar_arcon', material: 'tabla', cantidad: 3 });
  A(yo, { tipo: 'sacar_arcon', material: 'clavo', cantidad: 4 });
  const tablas = m.materiales.tabla, d1 = A(yo, mesa);
  comprobar('con ellas, sí, y se gastan de lo que llevas', d1.ok && invs.de(yo).cuantos('tabla') === 0 && invs.de(yo).cuantos('clavo') === 0 && m.materiales.tabla === tablas, JSON.stringify(d1));
  // quitarla devuelve el 75 % a lo que llevas (2 tablas y 3 clavos), no al montón común
  const q = A(yo, { tipo: 'quitar', id: d1.deco && d1.deco.id });
  comprobar('al quitarla, lo que devuelve va a lo que llevas', q.ok && invs.de(yo).cuantos('tabla') === 2 && invs.de(yo).cuantos('clavo') === 3 && m.materiales.tabla === tablas, JSON.stringify(q));
  // la de otro, en su tierra: no se quita (ni se lleva lo que devuelve)
  A(otro, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  A(otro, { tipo: 'mojon', x: 60, z: 0 });
  A(otro, { tipo: 'sacar_arcon', material: 'paja', cantidad: 4 });
  const cama = A(otro, { tipo: 'decorar', pieza: 'cama_paja', x: 60, y: 0, z: 2, rot: 0 });
  const q2 = A(yo, { tipo: 'quitar', id: cama.deco && cama.deco.id });
  comprobar('el mueble de otro, en su tierra, no lo quitas tú', cama.ok && !q2.ok && m.decoracion.length === 1, q2.motivo);
  // si no te cabe lo que devuelve, no se quita
  const cosas = invs.de(otro);
  A(otro, { tipo: 'sacar_arcon', material: 'piedra', cantidad: 6 });   // las dos manos llenas de piedras
  const q3 = A(otro, { tipo: 'quitar', id: cama.deco && cama.deco.id });
  comprobar('con las manos llenas, la cama no se quita: no te cabe la paja', !q3.ok && m.decoracion.length === 1 && cosas.cuantos('paja') === 0, q3.motivo);
  // al rehacer (el servidor al arrancar, los demás con lo que reparte), lo pagado no vuelve a cobrar del montón común
  const re = reproducir(reg.exportar());
  comprobar('el mundo se rehace igual, y el montón común queda como en el servidor', JSON.stringify(re.exportar()) === JSON.stringify(m.exportar()),
    `piedra ${re.materiales.piedra}/${m.materiales.piedra}, tabla ${re.materiales.tabla}/${m.materiales.tabla}, muebles ${re.decoracion.length}/${m.decoracion.length}`);
}

console.log('Desmontar devuelve a lo que llevas, y lo que no cabe cae al suelo (sin arcón, valravnx 1 nov)');
{
  const { m, reg, invs, A } = nuevo();
  const r = A(yo, { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  const c = r.construccion, kc = r.clave;
  for (const n of [6, 2]) { A(yo, { tipo: 'sacar_arcon', material: 'piedra', cantidad: n }); A(yo, { tipo: 'entregar', construccion: c.id, clave: kc, material: 'piedra', cantidad: n }); }
  let t = { ok: true }; for (let i = 0; i < 1000 && t.ok && !t.terminada; i++) t = A(yo, { tipo: 'trabajar', construccion: c.id, clave: kc, segundos: 5 });
  A(yo, { tipo: 'sacar_arcon', material: 'tabla', cantidad: 1, a: 'mano:izq' });   // la izquierda, ocupada
  const arcon0 = m.materiales.piedra;
  const d = A(yo, { tipo: 'desmontar', construccion: c.id, clave: kc });
  comprobar('el cimiento terminado se desmonta aunque no quepa todo', t.terminada && d.ok && !m.construcciones.includes(c), d.motivo || '');
  comprobar('lo que devuelve (6 de 8 piedras) va a lo que llevas: 3 en la mano libre', invs.de(yo).cuantos('piedra') === 3, String(invs.de(yo).cuantos('piedra')));
  comprobar('y lo que no cabe sale para el suelo (3), no al arcón', d.sobra && d.sobra.piedra === 3 && m.materiales.piedra === arcon0, JSON.stringify(d.sobra) + ` arcón ${arcon0} → ${m.materiales.piedra}`);
  const re = reproducir(reg.exportar());
  comprobar('al rehacer, el arcón queda igual (lo desmontado ya cobrado no vuelve a él)', re.materiales.piedra === m.materiales.piedra, `${re.materiales.piedra}/${m.materiales.piedra}`);
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
