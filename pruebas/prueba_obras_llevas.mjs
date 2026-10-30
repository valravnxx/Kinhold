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
  A(yo, { tipo: 'mojon', x: 0, z: 0 });
  return { m, reg, invs, A };
}

console.log('Cada material de las obras es un objeto que se lleva');
for (const k of Object.keys(MATERIALES_INICIALES)) comprobar(`«${k}» tiene su objeto en el catálogo`, !!CATALOGO[OBJETO_DE_MATERIAL[k]], OBJETO_DE_MATERIAL[k]);
comprobar('el tronco de las obras es el tronco corto (sale de tronzar)', OBJETO_DE_MATERIAL.tronco === 'tronco_corto');

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
  inv.coger('tronco_corto', 1, 'espalda/0');
  inv.coger('tronco_corto', 1, 'hombro');
  const r = A(yo, { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 });
  acabarObra(m, new RegistroAcciones(), yo, r.construccion.id, r.clave);
  const mu = A(yo, { tipo: 'colocar', pieza: 'muro_tronco', x: 1, z: -0.95, k: 0, rot: 0, dir: 0 });
  const p = mu.construccion.piezas.get(mu.clave);
  const e = A(yo, { tipo: 'entregar', construccion: mu.construccion.id, clave: mu.clave, material: 'tronco', cantidad: 4 });
  comprobar('los troncos cortos del leñero y del hombro se entregan como «tronco»', e.ok && e.entregado === 2 && p.obra.entregado.tronco === 2 && inv.cuantos('tronco_corto') === 0 && !inv.lugares.hombro, JSON.stringify(e));
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
    inv.coger('tronco_corto', 1, 'hombro');
    const s1 = A(yo, { tipo: 'subir', construccion: id, clave: k, material: 'tronco', segundos: 5, metodo: 'varas' });
    comprobar('con el tronco pero sin dos varas y una cuerda, tampoco', !s1.ok && inv.cuantos('tronco_corto') === 1, s1.motivo);
    inv.coger('vara', VARAS_PARA_RODAR.vara, 'mano:der'); inv.coger('cuerda', VARAS_PARA_RODAR.cuerda, 'mano:izq');
    const s2 = A(yo, { tipo: 'subir', construccion: id, clave: k, material: 'tronco', segundos: 5, metodo: 'varas' });
    comprobar('con el tronco al hombro, dos varas y una cuerda: el tronco sale de lo que llevas; las varas no se gastan', s2.ok && inv.cuantos('tronco_corto') === 0 && inv.cuantos('vara') === 2 && inv.cuantos('cuerda') === 1, JSON.stringify(s2));
  }
}

console.log('El arcón de pruebas: dejar, rellenar y sin inventarios');
{
  const { m, invs, A } = nuevo();
  A(yo, { tipo: 'sacar_arcon', material: 'tabla', cantidad: 3, a: 'mano:izq' });
  comprobar('se coge donde se pide', invs.de(yo).lugares['mano:izq']?.tipo === 'tabla');
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

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
