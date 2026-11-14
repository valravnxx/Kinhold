// Limpiar el campo (P11, la granja básica). Ejecutar: node pruebas/prueba_limpiar_campo.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/tala.js, src/logica/campos.js,
// src/logica/objetos_red.js): el tocón se arranca a golpes con la azada o el palo cavador en la mano (con el palo
// cavador, el doble de golpes), no sin ellos, no si el árbol está en pie ni si está caído sin limpiar; arrancado, deja
// leña en el suelo y el árbol ya no vuelve a crecer nunca; dentro de un campo, lo talado no vuelve a crecer (fuera, sí,
// a su tiempo); lo arrancado y lo que lleva arrancado se guardan y se leen; el campo cuenta lo que queda por limpiar
// (árboles, caídos, tocones, matas y piedras dentro de su linde); y el servidor (ObjetosServidor) lo hace con el autor
// y donde lo tiene.
// Con MUTAR=1 lo arrancado y lo de dentro del campo vuelven a crecer como cualquiera: debe FALLAR.
import { Tala, ejecutarTala, idArbol, GOLPES_TOCON, LENA_TOCON, DA } from '../src/logica/tala.js';
import { Inventarios } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { porLimpiar } from '../src/logica/campos.js';
import { ObjetosServidor } from '../src/logica/objetos_red.js';

const MUTAR = process.env.MUTAR === '1';
if (MUTAR) Tala.prototype.vuelveDe = function (id) { const e = this.estado[id]; return e && e.vuelve ? e.vuelve : 0; };   // lo arrancado y lo del campo, como cualquiera
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana';
const DIA = 24 * 3600 * 1000;
const joven = { id: idArbol(10, 10), x: 10, z: 10, edad: 'joven' }, otro = { id: idArbol(40, 10), x: 40, z: 10, edad: 'joven' };
const adulto = { id: idArbol(20, 10), x: 20, z: 10, edad: 'adulto' };
let ahora = 1e12;
const sigue = () => (ahora += 1000);

// tala un árbol y lo limpia, desde (x+1, z)
function talarYLimpiar(tala, invs, suelo, reg, a) {
  invs.de(A).lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };
  let r;
  for (let i = 0; i < 200; i++) { r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'talar', arbol: a.id, x: a.x + 1, z: a.z }, sigue()); if (!r.ok || r.cae) break; }
  if (!r.cae) return r;
  for (let i = 0; i < 400; i++) {
    const t = tala.tendido(a.id, ahora), x = t ? (t.x0 + t.x1) / 2 : a.x, z = t ? (t.z0 + t.z1) / 2 : a.z;
    invs.de(A).lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };   // (el hacha se gasta: una nueva)
    r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'talar', arbol: a.id, x, z }, sigue()); if (!r.ok || r.limpio) break;
  }
  return r;
}
function arrancarTodo(tala, invs, suelo, reg, a, con) {
  let r, golpes = 0;
  for (let i = 0; i < 100; i++) {
    invs.de(A).lugares['mano:der'] = { tipo: con, n: 1 };
    r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: a.id, x: a.x + 1, z: a.z }, sigue());
    if (!r.ok) break; golpes++; if (r.arrancado) break;
  }
  return { r, golpes };
}

{
  const tala = new Tala([{ ...joven }, { ...adulto }, { ...otro }]), invs = new Inventarios(), suelo = new Suelo(), reg = new RegistroAcciones();
  const enCampo = (x, z) => x < 30;   // el campo: todo lo que queda a x < 30 (el joven y el adulto; «otro» fuera)
  tala.sinRebrote = enCampo;
  let r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: joven.id, x: 11, z: 10 }, sigue());
  comprobar('en pie, no se arranca', !r.ok && r.motivo === 'Primero hay que talar el árbol.', r.motivo);
  invs.de(A).lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };
  for (let i = 0; i < 100; i++) { r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'talar', arbol: joven.id, x: 11, z: 10 }, sigue()); if (r.cae) break; }
  comprobar('talado, cae entero', r.ok && r.cae && tala.caido(joven.id, ahora));
  invs.de(A).lugares['mano:der'] = { tipo: 'azada', n: 1 };
  r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: joven.id, x: 11, z: 10 }, sigue());
  comprobar('caído sin limpiar, no se arranca: primero se limpia', !r.ok && r.motivo === 'Antes limpia el árbol caído con el hacha.', r.motivo);
  // lo limpia (y se queda el tocón)
  for (let i = 0; i < 400; i++) {
    const t = tala.tendido(joven.id, ahora); if (!t) break;
    invs.de(A).lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };
    r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'talar', arbol: joven.id, x: (t.x0 + t.x1) / 2, z: (t.z0 + t.z1) / 2 }, sigue()); if (r.limpio) break;
  }
  comprobar('limpio, queda el tocón', r.ok && r.limpio && tala.tocon(joven.id, ahora) && tala.tocones(ahora).length === 1);
  invs.de(A).lugares['mano:der'] = null;
  r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: joven.id, x: 11, z: 10 }, sigue());
  comprobar('sin azada ni palo cavador en la mano, no', !r.ok && /azada o un palo cavador/.test(r.motivo), r.motivo);
  invs.de(A).lugares['mano:der'] = { tipo: 'azada', n: 1 };
  r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: joven.id, x: 15, z: 10 }, sigue());
  comprobar('lejos, no', !r.ok && r.motivo === 'Está demasiado lejos.', r.motivo);
  // dentro del campo: aunque pase su tiempo, no vuelve a crecer
  const tarde = ahora + DA.joven.vuelve + DIA;
  comprobar('dentro del campo, pasado su tiempo, sigue el tocón (no vuelve a crecer)', !tala.enPie(joven.id, tarde) && tala.tocon(joven.id, tarde));
  const lenaAntes = suelo.objetos.filter(o => o.cosa.tipo === 'lena').reduce((n, o) => n + o.cosa.n, 0);
  const { r: ra, golpes } = arrancarTodo(tala, invs, suelo, reg, joven, 'azada');
  comprobar(`con la azada, ${GOLPES_TOCON.joven} golpes para el tocón joven`, ra.ok && ra.arrancado && golpes === GOLPES_TOCON.joven, `${golpes} golpes · ${ra.motivo || ''}`);
  const lena = suelo.objetos.filter(o => o.cosa.tipo === 'lena').reduce((n, o) => n + o.cosa.n, 0) - lenaAntes;
  comprobar(`deja ${LENA_TOCON.joven} de leña en el suelo, a su lado`, lena === LENA_TOCON.joven && suelo.objetos.some(o => o.cosa.tipo === 'lena' && Math.hypot(o.x - joven.x, o.z - joven.z) < 1), String(lena));
  comprobar('arrancado: ni árbol ni tocón, y ya nunca vuelve a crecer', !tala.tocon(joven.id, ahora) && !tala.enPie(joven.id, ahora + 365 * DIA) && tala.tocones(ahora).length === 0 && tala.arrancado(joven.id));
  r = ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: joven.id, x: 11, z: 10 }, sigue());
  comprobar('arrancado, no se arranca otra vez', !r.ok, r.motivo);
  comprobar('queda en el registro con su autor y lo que deja', reg.entradas.some(e => e.tipo === 'arrancar' && e.autor === A && e.ok && e.resultado && e.resultado.arrancado));

  // el adulto, con el palo cavador: el doble de golpes
  r = talarYLimpiar(tala, invs, suelo, reg, adulto);
  comprobar('el adulto, talado y limpio', r.ok && tala.tocon(adulto.id, ahora), r.motivo || '');
  const { r: rb, golpes: gb } = arrancarTodo(tala, invs, suelo, reg, adulto, 'palo_cavador');
  comprobar(`con el palo cavador, el doble: ${GOLPES_TOCON.adulto * 2} golpes para el adulto`, rb.ok && rb.arrancado && gb === GOLPES_TOCON.adulto * 2, `${gb} golpes`);

  // fuera del campo, lo talado vuelve a crecer a su tiempo
  r = talarYLimpiar(tala, invs, suelo, reg, otro);
  comprobar('fuera del campo, su tocón vuelve a ser árbol a su tiempo', r.ok && tala.tocon(otro.id, ahora) && tala.enPie(otro.id, ahora + DA.joven.vuelve + DIA));

  // a medias: lo que lleva arrancado se guarda
  const t2 = new Tala([{ ...joven }, { ...otro }]); t2.sinRebrote = enCampo;
  t2.importar(JSON.parse(JSON.stringify(tala.exportar())));
  comprobar('se guarda y se lee: el arrancado sigue arrancado', t2.arrancado(joven.id) && !t2.enPie(joven.id, ahora + 365 * DIA) && !t2.tocon(joven.id, ahora));
  invs.de(A).lugares['mano:der'] = { tipo: 'azada', n: 1 };
  ejecutarTala(tala, invs, suelo, reg, { autor: A, tipo: 'arrancar', arbol: otro.id, x: 41, z: 10 }, sigue());
  const t3 = new Tala([{ ...otro }]); t3.importar(JSON.parse(JSON.stringify(tala.exportar())));
  comprobar('y lo que lleva arrancado, también', t3.estado[otro.id] && t3.estado[otro.id].arranca > 0 && t3.estado[otro.id].arranca < 1, JSON.stringify(t3.estado[otro.id]));
}

console.log('Lo que queda por limpiar en un campo');
{
  const campo = { id: 1, cerrado: true, puntos: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], area: 100 };
  const q = porLimpiar(campo, { arboles: [{ x: 5, z: 5 }, { x: 20, z: 5 }], caidos: [{ x: 1, z: 1 }], tocones: [{ x: 2, z: 2 }, { x: 3, z: 3 }], matas: [{ x: 9, z: 9 }, { x: -1, z: 5 }], piedras: [{ x: 4, z: 6 }, { x: 5, z: 6 }, { x: 6, z: 6 }] });
  comprobar('cuenta solo lo de dentro del linde: 1 árbol, 1 caído, 2 tocones, 1 mata y 3 piedras', q.arboles === 1 && q.caidos === 1 && q.tocones === 2 && q.matas === 1 && q.piedras === 3 && q.total === 8, JSON.stringify(q));
  comprobar('un campo abierto no cuenta nada', porLimpiar({ ...campo, cerrado: false }, { arboles: [{ x: 5, z: 5 }] }).total === 0);
  comprobar('limpio: total 0', porLimpiar(campo, {}).total === 0);
}

console.log('El servidor (ObjetosServidor): con el autor y donde lo tiene');
{
  const pos = { [A]: { x: 11, z: 10 } };
  const os = new ObjetosServidor({ posicion: a => pos[a] || null, arconPruebas: true, sinRebrote: (x) => x < 30 });
  // el árbol lo conoce el servidor al primer golpe (sin terreno: el que dice el navegador)
  const da = { arbol: joven.id, ax: joven.x, az: joven.z, edad: 'joven' };
  os.invs.de(A).lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };
  let r;
  for (let i = 0; i < 100; i++) { r = os.ejecutar({ autor: A, tipo: 'talar', x: 11, z: 10, ...da }, sigue()); if (!r.ok || r.cae) break; }
  comprobar('el servidor tala el árbol', r.ok && r.cae, r.motivo || '');
  for (let i = 0; i < 400; i++) {
    const t = os.tala.tendido(joven.id, ahora); if (!t) break;
    pos[A] = { x: (t.x0 + t.x1) / 2, z: (t.z0 + t.z1) / 2 };
    os.invs.de(A).lugares['mano:der'] = { tipo: 'hacha_piedra', n: 1 };
    r = os.ejecutar({ autor: A, tipo: 'talar', x: pos[A].x, z: pos[A].z, ...da }, sigue()); if (!r.ok || r.limpio) break;
  }
  comprobar('y lo limpia', r.ok && r.limpio, r.motivo || '');
  pos[A] = { x: 11, z: 10 };
  comprobar('el servidor tiene puesto lo del campo: dentro, no vuelve a crecer', os.tala.tocon(joven.id, ahora + DA.joven.vuelve + DIA));
  r = os.ejecutar({ autor: A, tipo: 'arrancar', x: 25, z: 10, ...da }, sigue());
  comprobar('si dice estar donde no está, no', !r.ok && r.motivo === 'No estás ahí.', r.motivo);
  let n = 0;
  for (let i = 0; i < 50; i++) { os.invs.de(A).lugares['mano:der'] = { tipo: 'azada', n: 1 }; r = os.ejecutar({ autor: A, tipo: 'arrancar', x: 11, z: 10, ...da }, sigue()); if (!r.ok) break; n++; if (r.arrancado) break; }
  comprobar('lo arranca con la azada y la leña cae al suelo del servidor', r.ok && r.arrancado && r.suelo === true && os.suelo.objetos.some(o => o.cosa.tipo === 'lena'), `${n} golpes · ${r.motivo || ''}`);
  comprobar('se apunta con su autor', r.entrada && r.entrada.autor === A && r.entrada.tipo === 'arrancar' && r.entrada.ok);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
