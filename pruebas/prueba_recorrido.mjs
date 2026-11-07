// Recorrido de jugador (revisión del 1 nov: las cosas llegaban rotas porque nadie las jugaba como jugador).
// Un jugador nuevo, contra el servidor de verdad (servidor/servidor.mjs con el terreno de Whitholm y SIN el arcón de
// pruebas), juega de principio a fin lo que haya, con los mismos mensajes que manda la demo y solo con lo que recoge:
// elige dónde empieza (la salida común, en Lindholt; valravnx, 5 nov: hay tres y «lo eligen»), empieza con lo puesto (y lucha con eso), anda hasta lo que se recoge, lo recoge, anda hasta la zona de al lado (la de la salida es del
// rey: no se reclama) y pone su mojón pagándolo con tres de las piedras que
// lleva, levanta un cimiento de piedra con las piedras que ha traído en las manos (en dos viajes), y lo trabaja hasta
// terminarlo; luego se fabrica un hacha de piedra (fibra, cordel, piedra de tallar, y lo que pide dejado encima de
// ella), tala con ella un árbol joven (tronco delgado y varas), se echa el tronco al hombro y levanta con él un poste;
// va al río a por barro, juncos y yesca, se hace un taladro de fuego, y levanta y enciende una hoguera en la orilla.
// Desde P4, sus necesidades: llega a 0 y la sed y el hambre le suben solas.
// Falla si algo no se puede hacer así.
// Ejecutar: node pruebas/prueba_recorrido.mjs
//
// Cómo se amplía (CLAUDE.md, «Recorrido de jugador»): cada tarea de juego añade aquí su parte, como un paso más del
// mismo jugador, y no se publica si no sale. Lo que un jugador aún no puede hacer va en TODAVIA_NO con el porqué y la
// tarea que lo trae: el recorrido comprueba que de verdad no se puede (así, cuando llegue, falla y obliga a pasarlo a
// los pasos de verdad) y lo dice en la salida, para que no se olvide.
//
// Decisiones provisionales (anotadas en el diario):
//  - Anda a 20 m/s (un paso de 1 m cada 50 ms) para que la prueba tarde poco: hoy el servidor no mira la velocidad.
//  - Sin cuenta: crear la cuenta y confirmar el correo ya lo juegan «Navegador: entrar con la cuenta» y las pruebas
//    de cuentas; aquí empieza en el mundo.
//  - Lo que se fabrica tarda de verdad (el cordel 15 s, el hacha 60 s): la prueba adelanta la hora a la que termina lo
//    que ha encargado este jugador, en vez de esperarla. No le da nada: solo ahorra la espera.
//
// Con MUTAR=1 el mundo del servidor no tiene piedras sueltas (como si se rompiera la recogida): debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { terrenoWhitholm } from '../src/logica/terreno_servidor.js';
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn, TAM_ADULTO, CLARO_ARBOLES } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { Inventario } from '../src/logica/inventario.js';
import { PIEZAS } from '../src/logica/piezas.js';
import { USAN_INVENTARIO } from '../src/logica/acciones.js';
import { avisos, AVISO } from '../src/logica/necesidades.js';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// Lo que un jugador nuevo aún no puede hacer sin el arcón, con el porqué y lo que lo trae.
const TODAVIA_NO = {};   // hoy, nada (hasta el 7 nov: llevar el tronco delgado al hombro; ya es el paso 10; los juncos, el barro y la yesca, desde el 7 nov en el paso 11)

const T = terrenoWhitholm();
if (MUTAR) { const punto = T.punto.bind(T); T.punto = (id, x, z) => (id.startsWith('piedra:') ? null : punto(id, x, z)); }
const O = T.origen;

// el cliente: como la demo en línea, por websocket
function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, esperas: [], id: 0, inv: null, pos: null };
    c.esperar = (cond, ms = 5000) => new Promise((r, f) => { const t = setTimeout(() => f(new Error('tiempo agotado')), ms); c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } }); });
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    c.accion = (accion) => {
      const id = ++c.id + 100000;
      const p = c.esperar(m => m.tipo === 'resultado' && m.id === id);
      const q = USAN_INVENTARIO.has(accion.tipo) ? c.esperar(m => m.tipo === 'inventario') : null;
      ws.send(JSON.stringify({ tipo: 'accion', id, accion }));
      return q ? Promise.all([p, q]).then(([r]) => r) : p;
    };
    c.estar = (x, z) => { c.pos = { x, z }; ws.send(JSON.stringify({ tipo: 'estado', x, y: T.suelo(x, z), z, giro: 0, anim: 'andar' })); };
    // andar hasta (x, z): corriendo, un paso de 0,6 m cada 100 ms (6 m/s), como lo manda la demo: el servidor recorta lo
    // que vaya más deprisa de lo que se puede (movimiento sin trampas, src/logica/presencia.js)
    // (P4) rendido o casi (el cansancio a 90 o más), anda: a 3,6 m/s, un paso de 0,36 m; el servidor no deja correr al
    // rendido (src/logica/necesidades.js, factorVelocidad), como a un jugador de verdad
    c.andar = async (x, z) => {
      for (let i = 0; i < 100000; i++) {
        const paso = c.nec && c.nec.cansancio >= 90 ? 0.36 : 0.6;   // (lo mira a cada paso: se cansa por el camino)
        const { x: x0, z: z0 } = c.pos, d = Math.hypot(x - x0, z - z0);
        if (d <= paso) { c.estar(x, z); await pausa(100); break; }
        c.estar(x0 + (x - x0) * paso / d, z0 + (z - z0) * paso / d); await pausa(100);
      }
      await pausa(150);
    };
    c.salida = (salida) => { const id = ++c.id + 200000; const p = c.esperar(m => m.tipo === 'salida' && m.id === id); ws.send(JSON.stringify({ tipo: 'salida', id, salida })); return p; };
    c.cuantos = (tipo) => (c.inv ? c.inv.cuantos(tipo) : 0);
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if ((m.tipo === 'bienvenida' || m.tipo === 'inventario' || m.tipo === 'resultado_objeto') && m.inventario) c.inv = Inventario.importarJugador(m.inventario);
      if (m.necesidades && (m.tipo === 'bienvenida' || m.tipo === 'necesidades')) c.nec = m.necesidades;   // (P4) las suyas, como se las manda el servidor
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    const b = c.esperar(m => m.tipo === 'bienvenida', 20000);
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const r2 = v => Math.round(v * 100) / 100;

// Las zonas del rey (valravnx, 4 nov; src/logica/zonas_rey.js): la de la salida no se reclama, así que pone su tierra
// en la zona de al lado, al oeste (la más cercana), a BASE_DENTRO m de su linde y con sitio para mover el mojón 30 m más.
const BASE_DENTRO = 70;
const base = (() => {
  const zs = T.zona(0, 4);
  for (let r = 20; r < 3000; r += 10) { const id = T.zona(-r, 4); if (id !== null && id !== zs && !T.esZonaRey(id)) return { x: -r - BASE_DENTRO, z: 4, zona: id }; }
  return { x: 0, z: 4, zona: zs };
})();
// lo que el navegador tiene alrededor de la salida y de camino a su tierra (los puntos de recogida y los árboles, en
// coordenadas de la escena)
const cuadro = { x0: O.x + base.x - 120, z0: O.z - 120, x1: O.x + 120, z1: O.z + 120 };
const cerca = (l, p) => l.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
const puntos = recogidaEn(T.paisaje, T.alt, T.semilla, cuadro).map(p => ({ id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) }));
const arboles = vegetacionEn(T.paisaje, T.alt, T.semilla, cuadro).arboles
  .map(e => ({ x: e.x - O.x, z: e.z - O.z, edad: e.edad }))
  .filter(e => Math.hypot(e.x, e.z - 2) >= CLARO_ARBOLES).map(e => ({ ...e, id: idArbol(e.x, e.z) }));

const dir = mkdtempSync(join(tmpdir(), 'kinhold-recorrido-'));
let s = null;
try {
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T });   // sin arcón: como el servidor de verdad (es lo que hay si no se pide)
  const puerto = await s.listo, J = await cliente(puerto);
  console.log('0. Elige dónde empieza: la salida común (Lindholt), de las tres del rey');
  comprobar('llega sin posición: aún no ha elegido', J.bienvenida.posicion === null, JSON.stringify(J.bienvenida.posicion));
  comprobar('llega sin hambre, sin sed, sin frío y descansado (P4: sus necesidades, del servidor)', J.bienvenida.necesidades && Object.values(J.bienvenida.necesidades).every(v => v === 0), JSON.stringify(J.bienvenida.necesidades));
  let rs = await J.salida('motdale_no');
  comprobar('una salida que no existe no vale', !rs.ok, rs.motivo);
  rs = await J.salida('lindholt');
  comprobar('elige Lindholt: aparece en la salida común, en el suelo', rs.ok && rs.posicion.x === 0 && rs.posicion.z === 0 && Math.abs(rs.posicion.y - T.suelo(0, 0)) < 1e-6, JSON.stringify(rs.posicion));
  rs = await J.salida('ciudad');
  comprobar('y no puede volver a elegir', !rs.ok, rs.motivo);
  J.estar(0, 4); await pausa(200);

  console.log('1. Empieza con lo puesto, y sin arcón');
  const lugares = J.inv ? Object.entries(J.inv.lugares).filter(([, c]) => c).map(([l, c]) => `${l}=${c.tipo}`) : [];
  comprobar('le llega lo que lleva: solo la camisa y el pantalón de lino', lugares.length === 2 && lugares.join(' ').includes('camisa_lino') && lugares.join(' ').includes('pantalon_lino'), lugares.join(' '));
  // el duelo con lo que llevas (7 nov): si le atacan, le protege eso y nada más (sin el gambesón que antes ponía el servidor)
  const yoL = J.bienvenida.luchadores.find(l => l.autor === J.bienvenida.autor);
  comprobar('en el combate lleva eso mismo: la camisa y el pantalón, sin armadura', yoL && JSON.stringify([...yoL.prendas].sort()) === JSON.stringify(['camisa_lino', 'pantalon_lino']) && yoL.armadura === 'lino', yoL ? yoL.prendas.join(', ') : 'no está en el combate');
  let r = await J.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  comprobar('no puede sacar nada del arcón de pruebas (no hay)', !r.ok && J.cuantos('hacha_hierro') === 0, r.motivo);
  r = await J.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  comprobar('ni del arcón de materiales de las obras', !r.ok && J.cuantos('piedra') === 0, r.motivo);
  const piedraArcon = s.mundo.materiales.piedra;
  r = await J.accion({ tipo: 'rellenar', cantidad: 50 });
  comprobar('ni rellenarlo (el botón de pruebas)', !r.ok && s.mundo.materiales.piedra === piedraArcon, r.motivo);
  comprobar('la bienvenida le dice que no hay arcón (el navegador no lo enseña)', J.bienvenida.arcon === false, String(J.bienvenida.arcon));
  r = await J.accion({ tipo: 'mojon', x: 0, z: 4 });
  comprobar('en la salida no puede poner su mojón: es zona del rey', !r.ok && !s.mundo.mojonDe(J.bienvenida.autor) && /zona del rey/.test(r.motivo || ''), r.motivo);

  console.log('2. Recoge piedras: anda hasta ellas y las coge con las manos');
  const piedras = cerca(puntos.filter(p => p.tipo === 'piedra' && Math.hypot(p.x, p.z - 4) < 120), { x: 0, z: 4 });
  const piedrasBase = cerca(puntos.filter(p => p.tipo === 'piedra' && Math.hypot(p.x - base.x, p.z - base.z) < 120), base);
  comprobar('hay piedras sueltas cerca de la salida (a menos de 120 m)', piedras.length >= 6 + PIEZAS.cim_piedra.coste.piedra - (6 - PIEZAS.mojon.coste.piedra), `${piedras.length}; la primera a ${piedras[0] ? Math.round(Math.hypot(piedras[0].x, piedras[0].z)) : '–'} m`);
  const recoger = async (p) => {
    await J.andar(p.x + 0.4, p.z);
    return J.objeto({ tipo: 'recoger', punto: p.id, x: J.pos.x, z: J.pos.z, px: p.x, pz: p.z, clase: p.tipo });
  };
  // un puesto de trabajo es obra (valravnx, 6 nov): se pone el marco, se le lleva lo que pide (de lo que lleva y del
  // suelo de al lado) y se trabaja en él hasta levantarlo, a ratos de 5 s, como en el juego
  const ponerPuesto = async (estacion, x, z) => {
    const rc = await J.objeto({ tipo: 'colocar_estacion', estacion, x, z });
    if (!rc.ok) return rc;
    const id = rc.datos.id, re = await J.objeto({ tipo: 'entregar_estacion', estacion: id, x: J.pos.x, z: J.pos.z });
    if (!re.ok) return { ...re, id };
    let rt = { ok: true, datos: {} };
    for (let i = 0; i < 20 && rt.ok && !rt.datos.terminada; i++) rt = await J.objeto({ tipo: 'trabajar_estacion', estacion: id, segundos: 5, x: J.pos.x, z: J.pos.z });
    return { ...rt, id, marco: rc, entrega: re };
  };
  let cogidas = 0, motivos = [];
  for (const p of piedras.slice(0, 6)) { r = await recoger(p); if (r.ok) cogidas++; else motivos.push(r.motivo); }
  comprobar('recoge 6 piedras, 3 en cada mano', cogidas === 6 && J.cuantos('piedra') === 6, `${J.cuantos('piedra')} piedras ${motivos.slice(0, 2).join(' · ')}`);
  r = await recoger(piedras[6] || piedras[0]);
  comprobar('la séptima ya no le cabe en las manos', !r.ok && J.cuantos('piedra') === 6, r.motivo);
  r = await recoger(piedras[0]);
  comprobar('y una piedra ya recogida no vuelve a darse', !r.ok && /recogido/.test(r.motivo || ''), r.motivo);

  console.log('3. Lo que aún no se puede hacer como jugador nuevo');
  let joven;
  {
    // talar: el árbol joven más cercano, a su lado y con las manos como las tiene
    const a = joven = cerca(arboles.filter(e => e.edad === 'joven'), J.pos)[0];
    await J.andar(a.x + 1, a.z);
    r = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad });
    comprobar('talar: sin hacha, no (se la fabrica en el paso 8)', !r.ok, r.motivo);
  }

  console.log('4. Anda hasta la zona de al lado (la de la salida es del rey) y pone su mojón: la zona es su tierra');
  comprobar('la zona de al lado de la salida no es del rey', base.zona !== T.zona(0, 4) && !T.esZonaRey(base.zona), `a ${-base.x} m al oeste`);
  await J.andar(base.x, base.z);
  const precio = PIEZAS.mojon.coste.piedra, montonAntes = s.mundo.materiales.piedra;
  r = await J.accion({ tipo: 'mojon', x: base.x, z: base.z });
  comprobar(`pone su mojón en ella y lo paga con ${precio} de las piedras que lleva (no del montón común)`, r.ok && J.cuantos('piedra') === 6 - precio && s.mundo.materiales.piedra === montonAntes, `${r.motivo || ''} lleva ${J.cuantos('piedra')}`);
  r = await J.accion({ tipo: 'mojon', x: base.x - 30, z: base.z });
  comprobar('y no un segundo (uno por personaje)', !r.ok, r.motivo);

  console.log('5. Levanta un cimiento de piedra con las piedras que ha traído');
  const sitio = { x: base.x + 5, z: base.z + 3 };
  r = await J.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: sitio.x, z: sitio.z, k: 0, rot: 0, dir: 0, y: T.suelo(sitio.x, sitio.z) });
  comprobar('pone el marco del cimiento en su tierra', r.ok, r.motivo);
  const obra = s.mundo.construcciones.at(-1), clave = obra && [...obra.piezas.keys()].find(k => obra.piezas.get(k).tipo === 'cim_piedra');
  const pide = PIEZAS.cim_piedra.coste.piedra, falta = () => pide - ((obra?.piezas.get(clave)?.obra?.entregado?.piedra) || 0);
  await J.andar(sitio.x + 1.5, sitio.z);
  const lleva = J.cuantos('piedra');
  r = await J.accion({ tipo: 'entregar', construccion: obra?.id, clave, material: 'piedra', cantidad: pide });
  comprobar(`entrega las ${lleva} que le quedan (pide ${pide}) y se queda con las manos vacías`, r.ok && lleva > 0 && falta() === pide - lleva && J.cuantos('piedra') === 0, `${r.motivo || ''} faltan ${falta()}`);
  r = await J.accion({ tipo: 'trabajar', construccion: obra?.id, clave, segundos: 5 });
  comprobar('sin todo el material aún no se puede trabajar', !r.ok, r.motivo);
  // segundo viaje: las que faltan
  cogidas = 0;
  const faltan = falta();
  for (const p of piedrasBase.slice(0, faltan)) { r = await recoger(p); if (r.ok) cogidas++; }
  comprobar(`vuelve a por las ${faltan} que faltan (le caben en las manos)`, faltan <= 6 && J.cuantos('piedra') === faltan, `${J.cuantos('piedra')} piedras`);
  await J.andar(sitio.x + 1.5, sitio.z);
  r = await J.accion({ tipo: 'entregar', construccion: obra?.id, clave, material: 'piedra', cantidad: falta() });
  comprobar('las entrega: el cimiento tiene todo lo que pide', r.ok && falta() === 0 && J.cuantos('piedra') === 0, r.motivo);
  let t = { ok: true }, veces = 0;
  for (; veces < 400 && t.ok && obra?.piezas.get(clave)?.obra; veces++) t = await J.accion({ tipo: 'trabajar', construccion: obra.id, clave, segundos: 5 });
  comprobar('lo trabaja hasta terminarlo', !!obra?.piezas.get(clave) && !obra.piezas.get(clave).obra, `${veces} ratos de 5 s ${t.motivo || ''}`);

  console.log('5b. Llega otro jugador: lo de su tierra no lo toca (lo tuyo es tuyo)');
  {
    const K = await cliente(puerto);
    const rk0 = await K.salida('lindholt');
    comprobar('otro jugador nuevo elige también Lindholt', rk0.ok, rk0.motivo);
    K.estar(0, 4); await pausa(200); await K.andar(sitio.x + 2, sitio.z + 1);   // aparece en la salida y va andando hasta ella
    const rk = await K.accion({ tipo: 'desmontar', construccion: obra?.id, clave });
    comprobar('otro jugador no puede desmontar su cimiento', !rk.ok && !!obra?.piezas.get(clave), rk.motivo);
    // y se hablan (el chat de texto, valravnx, 6 nov): lo que dice uno le llega al otro, que está al lado, por el servidor
    const oye = K.esperar(m => m.tipo === 'dicho' && m.autor === J.bienvenida.autor).catch(() => null);
    J.ws.send(JSON.stringify({ tipo: 'decir', texto: 'Esa es mi tierra' }));
    const dicho = await oye;
    comprobar('se hablan: lo que dice uno le llega al otro, que está al lado', dicho && dicho.texto === 'Esa es mi tierra', JSON.stringify(dicho));
    K.ws.close();
  }

  console.log('6. Con las manos libres otra vez, recoge ramas del bosque');
  const ramas = cerca(puntos.filter(p => p.tipo === 'ramas'), J.pos);
  r = ramas[0] ? await recoger(ramas[0]) : { ok: false, motivo: 'no hay ramas cerca' };
  comprobar('recoge ramas caídas', r.ok && J.cuantos('rama') > 0, `${r.motivo || ''} ${J.cuantos('rama')} ramas`);

  console.log('7. Se arrepiente del sitio: quita su mojón (pierde el cimiento) y lo vuelve a poner más allá');
  {
    // antes de quitarlo sabe lo que pierde (el aviso del juego sale de aquí)
    const p = s.mundo.perderiaSinMojon(J.bienvenida.autor);
    comprobar('sabe que perdería su cimiento (1 construcción, 1 pieza)', !!p && p.construcciones.length === 1 && p.piezas === 1, JSON.stringify(p && { c: p.construcciones.length, p: p.piezas }));
    r = await J.accion({ tipo: 'quitar_mojon' });
    comprobar('quita su mojón: dice lo perdido', r.ok, r.motivo);
    comprobar('ya no tiene mojón y el cimiento ha desaparecido', !s.mundo.mojonDe(J.bienvenida.autor) && !s.mundo.construcciones.some(c => c.id === obra?.id), `${s.mundo.construcciones.length} construcciones`);
    // y lo pone otra vez, 30 m más allá: el mojón se paga de lo que llevas, así que sin piedras no puede
    r = await J.accion({ tipo: 'mojon', x: base.x - 30, z: base.z });
    comprobar(`sin nada encima no puede volver a ponerlo (se paga con ${precio} piedras de lo que lleva)`, !r.ok && J.cuantos('piedra') === 0 && !s.mundo.mojonDe(J.bienvenida.autor), r.motivo);
    // antes recoge sus 3 piedras
    let nuevas = 0;
    for (const p of piedrasBase.slice(faltan)) { if (nuevas >= precio) break; r = await recoger(p); if (r.ok) nuevas++; }
    comprobar(`recoge otras ${precio} piedras para el mojón nuevo`, J.cuantos('piedra') === precio, `${J.cuantos('piedra')} piedras`);
    await J.andar(base.x - 30, base.z);
    r = await J.accion({ tipo: 'mojon', x: base.x - 30, z: base.z });
    comprobar('vuelve a poner su mojón 30 m más allá, sin espera, pagado con ellas', r.ok && !!s.mundo.mojonDe(J.bienvenida.autor) && J.cuantos('piedra') === 0, r.motivo);
  }

  console.log('8. Se fabrica un hacha de piedra con lo que recoge: fibra, cordel, piedra de tallar y el hacha');
  {
    const yo = J.bienvenida.autor;
    // lo encargado termina ya (ver arriba: solo se ahorra la espera)
    const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola)]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
    const enMano = () => ['mano:der', 'mano:izq'].map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
    // deja las ramas a sus pies: le hacen falta las dos manos y del suelo de al lado también se fabrica
    const taller = { ...J.pos };
    const ruta = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'rama');
    r = ruta ? await J.objeto({ tipo: 'soltar_suelo', de: ruta, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no lleva ramas' };
    comprobar('deja las ramas en el suelo, a sus pies', r.ok && J.cuantos('rama') === 0, r.motivo);
    const fibras = cerca(puntos.filter(p => p.tipo === 'ortiga' || p.tipo === 'hierba_larga'), J.pos);
    let i = 0;
    while (J.cuantos('fibra') < 6 && i < Math.min(8, fibras.length)) await recoger(fibras[i++]);
    comprobar('arranca fibra de ortigas y hierba larga hasta tener 6', J.cuantos('fibra') >= 6, `${J.cuantos('fibra')} de fibra de ${i} plantas; ${enMano()}`);
    if (J.cuantos('fibra') > 6) { const rf = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'fibra'); await J.objeto({ tipo: 'soltar_suelo', de: rf, cantidad: J.cuantos('fibra') - 6, x: J.pos.x, z: J.pos.z }); }
    for (let k = 1; k <= 2; k++) {
      r = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
      comprobar(`con las manos, en cualquier sitio, se hace su cordel ${k} (3 de fibra)`, r.ok, r.motivo);
      adelantar();
      r = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
      comprobar(`y lo recoge (va a lo que lleva, o a sus pies si no le cabe)`, r.ok, r.motivo || JSON.stringify(r.datos));
    }
    const sueloCordel = s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'cordel' && Math.hypot(o.x - J.pos.x, o.z - J.pos.z) < 2).reduce((t, o) => t + o.cosa.n, 0);
    comprobar('tiene sus 2 cordeles (en la mano o a sus pies)', J.cuantos('cordel') + sueloCordel === 2 && J.cuantos('fibra') === 0, `${J.cuantos('cordel')} en la mano, ${sueloCordel} en el suelo; ${enMano()}`);
    // el cordel no se apila (también es un cinturón): uno se queda a sus pies, para tener una mano libre
    if (['mano:der', 'mano:izq'].every(l => J.inv.lugares[l]?.tipo === 'cordel')) {
      await J.andar(taller.x, taller.z);   // junto a las ramas, donde va a trabajar
      r = await J.objeto({ tipo: 'soltar_suelo', de: 'mano:der', x: J.pos.x, z: J.pos.z });
      comprobar('deja un cordel a sus pies para tener una mano libre', r.ok && J.cuantos('cordel') === 1, r.motivo);
    }
    // vuelve con dos piedras: una para la piedra de tallar y otra para el hacha
    let pied = 0;
    for (const p of piedrasBase) { if (pied >= 2) break; r = await recoger(p); if (r.ok) pied++; }
    comprobar('recoge 2 piedras', J.cuantos('piedra') === 2, `${J.cuantos('piedra')} · ${enMano()}`);
    await J.andar(taller.x, taller.z);
    r = await ponerPuesto('piedra_tallar', J.pos.x + 0.8, J.pos.z);
    comprobar('levanta una piedra de tallar a su lado: el marco, sin gastar nada; le lleva 1 piedra y trabaja en ella', r.ok && r.datos.terminada && r.marco.datos.obra && r.entrega.datos.entregado.piedra === 1 && J.cuantos('piedra') === 1, r.motivo);
    // lo que pide el hacha se deja encima de la piedra de tallar (valravnx, 6 nov): lo de las manos y lo del suelo
    const pt = Object.values(s.objetos.fab.estaciones).find(e => e.autor === yo && e.tipo === 'piedra_tallar');
    r = await J.objeto({ tipo: 'fabricar', receta: 'hacha_piedra', estacion: pt?.id, x: J.pos.x, z: J.pos.z });
    comprobar('sin nada depositado en la piedra de tallar, el hacha no se encarga', !r.ok && /en la estación/.test(r.motivo || ''), r.motivo);
    const dejarDeLaMano = async tipo => { const l = ['mano:der', 'mano:izq'].find(x => J.inv.lugares[x]?.tipo === tipo); return l ? J.objeto({ tipo: 'depositar_estacion', estacion: pt.id, de: l, cantidad: 1, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: `no lleva ${tipo} en la mano` }; };
    const delSuelo = async tipo => {
      const o = s.objetos.sueloVisible(Date.now()).find(x => x.cosa.tipo === tipo && Math.hypot(x.x - J.pos.x, x.z - J.pos.z) < 2);
      const libre = ['mano:der', 'mano:izq'].find(l => !J.inv.lugares[l]);
      if (!o || !libre) return { ok: false, motivo: !o ? `no hay ${tipo} en el suelo a su lado` : 'sin mano libre' };
      const rc = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: libre, x: J.pos.x, z: J.pos.z });
      return rc.ok ? dejarDeLaMano(tipo) : rc;
    };
    r = await dejarDeLaMano('piedra');
    comprobar('deja en la piedra de tallar la piedra que lleva', r.ok && J.cuantos('piedra') === 0, r.motivo);
    r = await dejarDeLaMano('cordel');
    comprobar('y el cordel de la mano', r.ok && J.cuantos('cordel') === 0, r.motivo);
    r = await delSuelo('cordel');
    comprobar('coge el otro cordel de sus pies y lo deja también', r.ok, r.motivo);
    r = await delSuelo('rama');
    comprobar('y una de sus ramas del suelo', r.ok, r.motivo);
    comprobar('la piedra de tallar tiene encima 1 piedra, 1 rama y 2 cordeles', JSON.stringify(s.objetos.fab.estaciones[pt.id].deposito) === JSON.stringify({ piedra: 1, cordel: 2, rama: 1 }), JSON.stringify(s.objetos.fab.estaciones[pt.id].deposito));
    r = await J.objeto({ tipo: 'fabricar', receta: 'hacha_piedra', x: J.pos.x, z: J.pos.z });
    comprobar('encarga el hacha de piedra con lo depositado en la piedra de tallar', r.ok && r.datos?.estacion === pt.id && JSON.stringify(r.datos?.usado?.estacion) === JSON.stringify({ piedra: 1, rama: 1, cordel: 2 }) && !Object.keys(s.objetos.fab.estaciones[pt.id].deposito).length, r.motivo || JSON.stringify(r.datos?.usado));
    adelantar();
    r = await J.objeto({ tipo: 'recoger_fabricado', estacion: r.datos?.estacion, x: J.pos.x, z: J.pos.z });
    comprobar('y la recoge: lleva un hacha de piedra en la mano', r.ok && J.cuantos('hacha_piedra') === 1 && ['mano:der', 'mano:izq'].some(l => J.inv.lugares[l]?.tipo === 'hacha_piedra'), r.motivo || enMano());
  }

  console.log('9. Con su hacha de piedra tala un árbol joven');
  {
    const a = cerca(arboles.filter(e => e.edad === 'joven'), J.pos)[0] || joven;
    await J.andar(a.x + 1, a.z);
    let golpes = 0;
    do { r = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); golpes++; if (r.ok && !r.datos.cae) await pausa(550); } while (r.ok && !r.datos.cae && golpes < 30);
    comprobar('lo tala a golpes (joven con piedra: 8) y cae', r.ok && r.datos.cae && golpes === 8, `${golpes} golpes · ${r.motivo || ''}`);
    const deja = s.objetos.sueloVisible(Date.now()).filter(o => Math.hypot(o.x - a.x, o.z - a.z) < 5);
    const tronco = deja.find(o => o.cosa.tipo === 'tronco_delgado'), varas = deja.find(o => o.cosa.tipo === 'vara');
    comprobar('y deja en el suelo un tronco delgado y de 2 a 4 varas (revisión del 1 nov)', !!tronco && !!varas && varas.cosa.n >= 2 && varas.cosa.n <= 4, deja.map(o => `${o.cosa.tipo}×${o.cosa.n}`).join(', '));

    console.log('10. Se echa el tronco delgado al hombro y levanta con él un poste en su tierra (la madera de la casa humilde)');
    // el hacha, al suelo: con algo al hombro las manos no llevan nada (valravnx, 1 nov)
    const lh = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'hacha_piedra');
    if (lh) await J.objeto({ tipo: 'soltar_suelo', de: lh, x: J.pos.x, z: J.pos.z });
    await J.andar(tronco.x + 0.6, tronco.z);
    r = await J.objeto({ tipo: 'coger_suelo', objeto: tronco.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    comprobar('coge el tronco delgado del suelo y se lo echa al hombro', r.ok && J.inv.lugares.hombro?.tipo === 'tronco_delgado', r.motivo);
    await J.andar(varas.x + 0.6, varas.z);
    r = await J.objeto({ tipo: 'coger_suelo', objeto: varas.id, cantidad: 1, a: 'mano:der', x: J.pos.x, z: J.pos.z });
    comprobar('con el tronco al hombro no coge las varas con las manos (vendrá a por ellas)', !r.ok && J.cuantos('vara') === 0, r.motivo);
    const mj = s.mundo.mojonDe(J.bienvenida.autor), sitio2 = { x: mj.x + 4, z: mj.z + 3 };
    await J.andar(sitio2.x, sitio2.z);
    r = await J.accion({ tipo: 'colocar', pieza: 'poste', x: sitio2.x, z: sitio2.z, k: 0, rot: 0, dir: 0, y: T.suelo(sitio2.x, sitio2.z) });
    comprobar('pone en su tierra el marco de un poste (pide 1 tronco delgado)', r.ok && PIEZAS.poste.coste.tronco === 1, r.motivo);
    const c2 = s.mundo.construcciones.at(-1), k2 = c2 && [...c2.piezas.keys()].find(k => c2.piezas.get(k).tipo === 'poste');
    r = await J.accion({ tipo: 'entregar', construccion: c2?.id, clave: k2, material: 'tronco', cantidad: 1 });
    comprobar('le lleva el tronco delgado del hombro: el poste tiene lo que pide', r.ok && !J.inv.lugares.hombro && J.cuantos('tronco_delgado') === 0 && (c2?.piezas.get(k2)?.obra?.entregado?.tronco) === 1, r.motivo);
    let t2 = { ok: true }, n2 = 0;
    for (; n2 < 400 && t2.ok && c2?.piezas.get(k2)?.obra; n2++) t2 = await J.accion({ tipo: 'trabajar', construccion: c2.id, clave: k2, segundos: 5 });
    comprobar('lo trabaja hasta terminarlo: su primer poste', !!c2?.piezas.get(k2) && !c2.piezas.get(k2).obra, `${n2} ratos de 5 s ${t2.motivo || ''}`);
  }

  console.log('11. Va al río a por lo que pide la casa humilde y la hoguera: barro con su palo cavador, juncos con una lasca y yesca');
  {
    const yo = J.bienvenida.autor;
    const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola)]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
    const enMano = () => ['mano:der', 'mano:izq'].map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
    const aSusPies = async (tipo) => { const l = ['mano:der', 'mano:izq'].find(x => J.inv.lugares[x]?.tipo === tipo); return l ? J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z }) : { ok: true }; };
    const sueloMio = (tipo) => s.objetos.sueloVisible(Date.now()).find(o => o.cosa.tipo === tipo && Math.hypot(o.x - J.pos.x, o.z - J.pos.z) < 2);
    // el río más cercano a la salida (en anillos de 25 m), y lo que se recoge en su orilla
    let rio = null;
    for (let r = 0; r < 3000 && !rio; r += 25) for (let k = 0; k < 96; k++) {
      const x = Math.cos(k / 96 * 2 * Math.PI) * r, z = Math.sin(k / 96 * 2 * Math.PI) * r, X = x + O.x, Z = z + O.z;
      const { dm, ancho } = T.paisaje.rioCerca(X, Z, T.paisaje.riosEn(X - 20, Z - 20, X + 20, Z + 20));
      if (dm - ancho / 2 < 4 && T.alt(X, Z) > 0.5) { rio = { x, z, r }; break; }
    }
    comprobar('hay un río al que ir andando desde la salida', !!rio, rio ? `a ${rio.r} m` : 'ninguno a menos de 3 km');
    const orilla = recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + rio.x - 100, z0: O.z + rio.z - 100, x1: O.x + rio.x + 100, z1: O.z + rio.z + 100 }).map(p => ({ id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) }));
    const de = (tipo) => cerca(orilla.filter(p => p.tipo === tipo), rio);
    comprobar('en su orilla hay juncos, barro, hongos yesqueros, sílex, piedra y ramas', ['juncos', 'barro', 'yesquero', 'silex', 'piedra', 'ramas'].every(t => de(t).length), ['juncos', 'barro', 'yesquero', 'silex', 'piedra', 'ramas'].map(t => `${t} ${de(t).length}`).join(', '));
    // las manos libres para el camino: lo que lleve, a sus pies (en su tierra)
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    await J.andar(rio.x, rio.z);
    r = await recoger(de('ramas')[0]);
    comprobar('recoge ramas junto al río', r.ok && J.cuantos('rama') > 0, r.motivo);
    r = await recoger(de('barro')[0]);
    comprobar('sin palo cavador no puede cavar el barro', !r.ok && /palo cavador/.test(r.motivo || ''), r.motivo);
    r = await J.objeto({ tipo: 'fabricar', receta: 'palo_cavador', x: J.pos.x, z: J.pos.z });
    comprobar('se hace un palo cavador con las manos (1 rama)', r.ok, r.motivo);
    adelantar();
    r = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
    comprobar('y lo coge', r.ok && J.cuantos('palo_cavador') + (sueloMio('palo_cavador') ? 1 : 0) === 1, r.motivo || enMano());
    await aSusPies('rama');
    if (!J.cuantos('palo_cavador')) { const o = sueloMio('palo_cavador'); if (o) await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z }); }
    r = await recoger(de('barro')[0]);
    comprobar('con el palo cavador, cava una cesta de barro en la orilla', r.ok && J.cuantos('barro') === 1, r.motivo || enMano());
    comprobar('y el barro no se agota: el sitio sigue ahí', s.objetos.recoleccion.disponible(de('barro')[0].id, Date.now()));
    r = await recoger(de('juncos')[0]);
    comprobar('sin cuchillo no puede cortar los juncos', !r.ok && /cuchillo/.test(r.motivo || ''), r.motivo);
    // una lasca: una piedra de tallar en la orilla, con su sílex y su piedra
    await aSusPies('barro'); await aSusPies('palo_cavador');
    const taller = { ...J.pos };
    let pied = 0;
    for (const p of de('piedra')) { if (pied >= 2) break; r = await recoger(p); if (r.ok) pied++; }
    await J.andar(taller.x, taller.z);
    r = await ponerPuesto('piedra_tallar', J.pos.x + 0.8, J.pos.z);
    comprobar('levanta una piedra de tallar en la orilla (su marco, su piedra y su trabajo)', r.ok && r.datos.terminada, `${r.motivo || ''} ${enMano()}`);
    const pt = Object.values(s.objetos.fab.estaciones).filter(e => e.autor === yo && e.tipo === 'piedra_tallar').sort((a, b) => Math.hypot(a.x - J.pos.x, a.z - J.pos.z) - Math.hypot(b.x - J.pos.x, b.z - J.pos.z))[0];
    const dejar = async tipo => { const l = ['mano:der', 'mano:izq'].find(x => J.inv.lugares[x]?.tipo === tipo); return l ? J.objeto({ tipo: 'depositar_estacion', estacion: pt.id, de: l, cantidad: 1, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: `no lleva ${tipo}` }; };
    r = await dejar('piedra');
    for (const p of de('silex')) { const q = await recoger(p); if (q.ok) break; }
    await J.andar(taller.x, taller.z);
    const r2s = await dejar('silex');
    comprobar('deja encima una piedra y un sílex', r.ok && r2s.ok, `${r.motivo || ''} ${r2s.motivo || ''}`);
    r = await J.objeto({ tipo: 'fabricar', receta: 'lasca_silex', estacion: pt.id, x: J.pos.x, z: J.pos.z });
    comprobar('encarga una lasca de sílex', r.ok, r.motivo);
    adelantar();
    r = await J.objeto({ tipo: 'recoger_fabricado', estacion: pt.id, x: J.pos.x, z: J.pos.z });
    comprobar('y la coge: lleva un cuchillo de sílex', r.ok && J.cuantos('lasca_silex') === 1, r.motivo || enMano());
    r = await recoger(de('juncos')[0]);
    comprobar('con la lasca, corta un haz de juncos', r.ok && J.cuantos('junco') === 1, r.motivo || enMano());
    await aSusPies('junco');
    r = await recoger(de('yesquero')[0]);
    comprobar('y coge yesca de los hongos yesqueros de un tocón, con las manos', r.ok && J.cuantos('yesca') >= 1, r.motivo || enMano());
    // el taladro de fuego (7 nov), para encender la hoguera con la yesca: un cordel y dos ramas, con las manos
    await aSusPies('yesca'); await aSusPies('lasca_silex');
    const fibrasRio = cerca(orilla.filter(p => p.tipo === 'ortiga' || p.tipo === 'hierba_larga'), rio);
    let f = 0;
    while (J.cuantos('fibra') < 3 && f < Math.min(8, fibrasRio.length)) await recoger(fibrasRio[f++]);
    if (J.cuantos('fibra') > 3) { const rf = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'fibra'); await J.objeto({ tipo: 'soltar_suelo', de: rf, cantidad: J.cuantos('fibra') - 3, x: J.pos.x, z: J.pos.z }); }
    r = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
    comprobar('cerca del río, arranca fibra y hace otro cordel', r.ok, `${r.motivo || ''} ${J.cuantos('fibra')} de fibra de ${f} plantas`);
    adelantar();
    r = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
    for (const p of de('ramas')) { if (J.cuantos('rama') >= 2) break; await recoger(p); }
    comprobar('lleva un cordel y dos ramas', J.cuantos('cordel') >= 1 && J.cuantos('rama') >= 2, enMano());
    r = await J.objeto({ tipo: 'fabricar', receta: 'taladro_fuego', x: J.pos.x, z: J.pos.z });
    comprobar('se hace un taladro de fuego con las manos (2 ramas y 1 cordel)', r.ok, r.motivo || enMano());
    adelantar();
    r = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
    comprobar('y lo coge: con la yesca, ya puede encender fuego', r.ok && J.cuantos('taladro_fuego') + (sueloMio('taladro_fuego') ? 1 : 0) === 1, r.motivo || enMano());

    console.log('12. Levanta una hoguera en la orilla, la enciende con su yesca y su taladro, le echa una rama y se apaga sola');
    // las manos libres: lo que lleve, a sus pies (el taladro y la yesca se quedan junto al sitio de la hoguera)
    const fogon = { ...J.pos };
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    const rc = await J.objeto({ tipo: 'colocar_estacion', estacion: 'hoguera', x: fogon.x + 0.8, z: fogon.z });
    comprobar('pone el marco de una hoguera en la orilla (fuera, sin techo)', rc.ok, rc.motivo);
    const hog = rc.datos && rc.datos.id;
    let pi = 0;
    for (const p of de('piedra')) { if (J.cuantos('piedra') >= 6) break; const q = await recoger(p); if (q.ok) pi++; }
    await J.andar(fogon.x, fogon.z);
    r = await J.objeto({ tipo: 'entregar_estacion', estacion: hog, x: J.pos.x, z: J.pos.z });
    comprobar('le lleva sus 6 piedras, recogidas de la orilla con las manos', r.ok && r.datos.entregado && r.datos.entregado.piedra === 6, `${r.motivo || ''} ${JSON.stringify(r.datos && r.datos.entregado)} (${pi} recogidas)`);
    for (const p of de('ramas')) { if (J.cuantos('rama') >= 5) break; await recoger(p); }
    await J.andar(fogon.x, fogon.z);
    if (J.cuantos('rama') > 4) { const lr = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'rama'); await J.objeto({ tipo: 'soltar_suelo', de: lr, cantidad: J.cuantos('rama') - 4, x: J.pos.x, z: J.pos.z }); }
    r = await J.objeto({ tipo: 'entregar_estacion', estacion: hog, x: J.pos.x, z: J.pos.z });
    comprobar('y sus 4 ramas', r.ok && Object.keys(r.datos.falta || {}).length === 0, r.motivo || JSON.stringify(r.datos && r.datos.falta));
    let rt = { ok: true, datos: {} };
    for (let i = 0; i < 6 && rt.ok && !rt.datos.terminada; i++) rt = await J.objeto({ tipo: 'trabajar_estacion', estacion: hog, segundos: 5, x: J.pos.x, z: J.pos.z });
    const H = () => s.objetos.fab.estaciones[hog];
    comprobar('la levanta trabajando en ella: apagada, con sus ramas puestas', rt.ok && rt.datos.terminada && H().fuego && H().fuego.hasta === 0 && H().fuego.combustible > 0, rt.motivo || JSON.stringify(H() && H().fuego));
    r = await J.objeto({ tipo: 'encender_fuego', estacion: hog, x: J.pos.x, z: J.pos.z });
    comprobar('sin la yesca y el taladro en las manos no la enciende', !r.ok, r.motivo);
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l] && !['taladro_fuego', 'yesca'].includes(J.inv.lugares[l].tipo)) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    for (const t of ['taladro_fuego', 'yesca']) { if (J.cuantos(t)) continue; const o = sueloMio(t) || s.objetos.sueloVisible(Date.now()).filter(x => x.cosa.tipo === t).sort((a, b) => Math.hypot(a.x - J.pos.x, a.z - J.pos.z) - Math.hypot(b.x - J.pos.x, b.z - J.pos.z))[0];
      if (o && Math.hypot(o.x - J.pos.x, o.z - J.pos.z) > 1.5) await J.andar(o.x + 0.3, o.z);
      const libre = ['mano:der', 'mano:izq'].find(l => !J.inv.lugares[l]);
      if (o && libre) await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: libre, x: J.pos.x, z: J.pos.z }); }
    await J.andar(fogon.x, fogon.z);
    comprobar('coge del suelo su taladro y su yesca', J.cuantos('taladro_fuego') === 1 && J.cuantos('yesca') >= 1, enMano());
    const yescas = J.cuantos('yesca');
    r = await J.objeto({ tipo: 'encender_fuego', estacion: hog, x: J.pos.x, z: J.pos.z });
    comprobar('enciende la hoguera: gasta una yesca y el taladro le sigue sirviendo', r.ok && J.cuantos('yesca') === yescas - 1 && J.cuantos('taladro_fuego') === 1 && H().fuego.hasta > Date.now(), r.motivo || enMano());
    const vista = s.objetos.estacionesVisibles().find(e => e.id === hog);
    comprobar('y todos la ven encendida (lo que manda el servidor)', vista && vista.fuego && vista.fuego.encendida && vista.fuego.queda > 0, JSON.stringify(vista && vista.fuego));
    await aSusPies('yesca'); await aSusPies('taladro_fuego');
    if (!J.cuantos('rama')) { const o = sueloMio('rama'); if (o) await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'mano:der', x: J.pos.x, z: J.pos.z }); else for (const p of de('ramas')) { const q = await recoger(p); if (q.ok) break; } }
    await J.andar(fogon.x, fogon.z);
    const hasta = H().fuego.hasta;
    r = await J.objeto({ tipo: 'echar_fuego', estacion: hog, objeto: 'rama', x: J.pos.x, z: J.pos.z });
    comprobar('le echa una rama: arde 3 min más', r.ok && H().fuego.hasta === hasta + 180000, r.motivo || enMano());
    // la lanza endurecida al fuego, con una rama dejada en la hoguera
    if (!J.cuantos('rama')) for (const p of de('ramas')) { const q = await recoger(p); if (q.ok) break; }
    await J.andar(fogon.x, fogon.z);
    const lr = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'rama');
    r = lr ? await J.objeto({ tipo: 'depositar_estacion', estacion: hog, de: lr, cantidad: 1, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no lleva ramas' };
    const rl = await J.objeto({ tipo: 'fabricar', receta: 'lanza_endurecida', estacion: hog, x: J.pos.x, z: J.pos.z });
    comprobar('deja una rama en la hoguera y la endurece al fuego (la lanza)', r.ok && rl.ok, `${r.motivo || ''} ${rl.motivo || ''}`);
    // se apaga sola: la prueba adelanta la hora a la que se apaga (como lo que se fabrica), en vez de esperarla
    H().fuego.hasta = Date.now() - 1;
    const apagada = s.objetos.estacionesVisibles().find(e => e.id === hog);
    comprobar('pasada su hora se apaga sola y quedan las cenizas', apagada.fuego && !apagada.fuego.encendida && apagada.fuego.cenizas, JSON.stringify(apagada.fuego));
    r = await J.objeto({ tipo: 'fabricar', receta: 'lanza_endurecida', estacion: hog, x: J.pos.x, z: J.pos.z });
    comprobar('y apagada ya no se hace nada al fuego', !r.ok && /apagado/.test(r.motivo || ''), r.motivo);

  console.log('13. Vuelve a su tierra con piedras de la orilla y levanta una pila de piedras: guarda en ella, saca, y la obra no coge de ella sola');
  {
    const yo = J.bienvenida.autor, P = id => s.objetos.fab.estaciones[id];
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    for (const p of de('piedra')) { if (J.cuantos('piedra') >= 6) break; await recoger(p); }
    comprobar('recoge 6 piedras en la orilla, 3 en cada mano', J.cuantos('piedra') === 6, `${J.cuantos('piedra')}`);
    if (!s.mundo.dentroDeTierra(J.pos.x, J.pos.z, yo)) {
      r = await J.objeto({ tipo: 'colocar_estacion', estacion: 'pila_piedras', x: J.pos.x + 0.8, z: J.pos.z });
      comprobar('fuera de su tierra no puede poner un almacenaje', !r.ok, r.motivo);
    }
    const mj = s.mundo.mojonDe(yo), sitio = { x: mj.x - 5, z: mj.z + 4 };
    await J.andar(sitio.x, sitio.z);
    r = await ponerPuesto('pila_piedras', sitio.x + 0.8, sitio.z);
    comprobar('en su tierra levanta una pila de piedras: su marco, sus 4 piedras y su trabajo', r.ok && r.datos.terminada && J.cuantos('piedra') === 2, `${r.motivo || ''} lleva ${J.cuantos('piedra')}`);
    const pila = r.id, lp = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'piedra');
    r = lp ? await J.objeto({ tipo: 'depositar_estacion', estacion: pila, de: lp, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no lleva piedras' };
    if (r.ok && J.cuantos('piedra')) { const l2 = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'piedra'); r = await J.objeto({ tipo: 'depositar_estacion', estacion: pila, de: l2, x: J.pos.x, z: J.pos.z }); }
    comprobar('guarda en ella las 2 piedras que le sobran (Usar: guardar)', r.ok && P(pila).deposito.piedra === 2 && J.cuantos('piedra') === 0, r.motivo);
    const vista = s.objetos.estacionesVisibles().find(e => e.id === pila);
    comprobar('y todos la ven con sus piedras (lo que manda el servidor)', vista && vista.deposito.piedra === 2, JSON.stringify(vista && vista.deposito));
    const rc = await J.objeto({ tipo: 'colocar_estacion', estacion: 'hoguera', x: sitio.x - 0.8, z: sitio.z });
    r = rc.ok ? await J.objeto({ tipo: 'entregar_estacion', estacion: rc.datos.id, x: J.pos.x, z: J.pos.z }) : rc;
    comprobar('la obra no coge de la pila sola: con las manos vacías, la hoguera de al lado no recibe ninguna piedra', rc.ok && !r.ok && P(pila).deposito.piedra === 2 && !Object.keys(P(rc.datos.id).obra.entregado).length, r.motivo);
    r = await J.objeto({ tipo: 'retirar_estacion', estacion: pila, objeto: 'piedra', cantidad: 1, x: J.pos.x, z: J.pos.z });
    comprobar('saca una piedra de la pila (Usar: sacar)', r.ok && J.cuantos('piedra') === 1 && P(pila).deposito.piedra === 1, r.motivo);
    r = await J.objeto({ tipo: 'entregar_estacion', estacion: rc.datos.id, x: J.pos.x, z: J.pos.z });
    comprobar('y esa sí se la lleva a la obra', r.ok && P(rc.datos.id).obra.entregado.piedra === 1, r.motivo);
  }

  console.log('14. Se ata un fardo y se lleva los juncos a la espalda (valravnx, 7 nov: los juncos, con la paja, en el fardo)');
  {
    const yo = J.bienvenida.autor;
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    // el haz de juncos que cortó en la orilla (paso 11) sigue en el suelo, junto al río
    const junco = s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'junco').sort((a, b) => Math.hypot(a.x - rio.x, a.z - rio.z) - Math.hypot(b.x - rio.x, b.z - rio.z))[0];
    comprobar('su haz de juncos sigue en la orilla', !!junco, '');
    await J.andar(rio.x, rio.z);
    // dos cordeles para el fardo: 6 de fibra de las plantas de la orilla
    const plantas = cerca(orilla.filter(p => p.tipo === 'ortiga' || p.tipo === 'hierba_larga'), rio);
    let hechos = 0;
    for (let v = 0; v < 2; v++) {
      let k = 0;
      while (J.cuantos('fibra') < 3 && k < plantas.length) await recoger(plantas[k++]);
      if (J.cuantos('fibra') > 3) { const rf = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'fibra'); await J.objeto({ tipo: 'soltar_suelo', de: rf, cantidad: J.cuantos('fibra') - 3, x: J.pos.x, z: J.pos.z }); }
      r = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
      adelantar();
      const rr = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
      if (r.ok && rr.ok) hechos++;
    }
    comprobar('arranca fibra y hace dos cordeles', hechos === 2 && J.cuantos('cordel') >= 2, `${hechos} ${enMano()}`);
    r = await J.objeto({ tipo: 'fabricar', receta: 'fardo', x: J.pos.x, z: J.pos.z });
    adelantar();
    const rf = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
    comprobar('se ata un fardo con ellos (con las manos)', r.ok && rf.ok && J.cuantos('fardo') === 1, `${r.motivo || ''} ${rf.motivo || ''} ${enMano()}`);
    const lf = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'fardo');
    r = lf ? await J.objeto({ tipo: 'ponerse', de: lf }) : { ok: false, motivo: 'no lleva el fardo' };
    comprobar('y se lo echa a la espalda', r.ok && J.inv.lugares.espalda?.tipo === 'fardo', r.motivo);
    await J.andar(junco.x + 0.4, junco.z);
    r = await J.objeto({ tipo: 'coger_suelo', objeto: junco.id, cantidad: 1, a: 'espalda/0', x: J.pos.x, z: J.pos.z });
    comprobar('coge del suelo su haz de juncos y va al fardo, a la espalda, con las manos libres', r.ok && J.inv.lugares.espalda?.dentro?.[0]?.tipo === 'junco' && !J.inv.lugares['mano:der'] && !J.inv.lugares['mano:izq'], r.motivo);
    const piedra = s.objetos.sueloVisible(Date.now()).find(o => o.cosa.tipo === 'piedra' && Math.hypot(o.x - J.pos.x, o.z - J.pos.z) < 30);
    if (piedra) {
      await J.andar(piedra.x + 0.4, piedra.z);
      r = await J.objeto({ tipo: 'coger_suelo', objeto: piedra.id, cantidad: 1, a: 'espalda/1', x: J.pos.x, z: J.pos.z });
      comprobar('una piedra, en el fardo no', !r.ok, r.motivo);
    }
  }
  }

  // P4, las necesidades: a estas alturas del día, con todo lo que ha andado y trabajado, ya tiene algo de sed y de
  // hambre (la sed, más), sin que nadie se las haya puesto: le llegan solas del servidor
  comprobar('le han subido solas la sed y el hambre (la sed, más) y le llegan del servidor', J.nec && J.nec.sed > 0 && J.nec.hambre > 0 && J.nec.sed > J.nec.hambre, JSON.stringify(J.nec));
  // sus avisos (los círculos de la derecha, src/juego/avisos_necesidades.js) salen de esos números: desde 40; a esta
  // hora del día (la sed sube a 40 en 24 minutos), aún ninguno; la prueba de navegador de los avisos mira cómo se ven
  const susAvisos = avisos(J.nec).map(a => a.que).filter(q => q !== 'cansancio');
  comprobar('sus avisos salen de lo que manda el servidor: con la sed y el hambre por debajo de 40, aún ninguno de los dos', J.nec.sed < AVISO ? susAvisos.length === 0 : susAvisos.includes('sed'), `${JSON.stringify(J.nec)} → ${susAvisos.join(',') || 'ninguno'}`);

  // lo que sale de aquí, en la salida (para quien lo lea en la nube)
  console.log(`\nTodavía no se puede (sin el arcón): ${Object.entries(TODAVIA_NO).map(([k, v]) => `${k} — ${v}`).join('; ')}`);
  J.ws.close();
} catch (e) {
  comprobar('el recorrido llega al final', false, e && e.message);
} finally {
  if (s) await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
