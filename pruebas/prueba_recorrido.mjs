// Recorrido de jugador (revisión del 1 nov: las cosas llegaban rotas porque nadie las jugaba como jugador).
// Un jugador nuevo, contra el servidor de verdad (servidor/servidor.mjs con el terreno de Whitholm y SIN el arcón de
// pruebas), juega de principio a fin lo que haya, con los mismos mensajes que manda la demo y solo con lo que recoge:
// elige dónde empieza (la salida común, en Lindholt; valravnx, 5 nov: hay tres y «lo eligen»), empieza con lo puesto (y lucha con eso), anda hasta lo que se recoge, lo recoge, anda hasta la zona de al lado (la de la salida es del
// rey: no se reclama) y pone su mojón pagándolo con tres de las piedras que
// lleva, levanta un cimiento de piedra con las piedras que ha traído en las manos (en dos viajes), y lo trabaja hasta
// terminarlo; luego se fabrica un hacha de piedra (fibra, cordel, piedra de tallar, y lo que pide dejado encima de
// ella), tala con ella un árbol joven (tronco delgado y varas), se echa el tronco al hombro y levanta con él un poste;
// va al río a por barro, juncos y yesca, se hace un taladro de fuego, y levanta y enciende una hoguera en la orilla;
// (y, con la casa hecha, levanta dentro el hogar, lo enciende, lo deja en brasas y lo aviva);
// levanta una pila de piedras y, con las varas del árbol, un almiar en su tierra, y guarda en ellos.
// Desde P4, sus necesidades: llega a 0 y la sed y el hambre le suben solas; lejos del agua no puede beber, y en la
// orilla del río bebe con las manos, trago a trago; coge las bayas de un arbusto y se las come. Y desbroza un matorral
// con el hacha de piedra (8 nov) y se lleva sus ramas. Y su cama ligada (8 nov): un refugio de ramas en su tierra, que
// liga y en el que duerme, y luego una cama de juncos en su casa, que liga. Y el frío (8 nov): de noche, lejos de la
// hoguera, le sube, y junto a ella le baja. Y el cansancio (8 nov): después de talar y cargar los troncos de los muros,
// se sienta a descansar y el cansancio baja más deprisa que de pie. Y morir (8 nov): sale del juego en su casa y vuelve;
// fuera se olvida de beber y se muere de sed; vuelve a su cama y recupera lo suyo de su cuerpo.
// Falla si algo no se puede hacer así.
// Ejecutar: node pruebas/prueba_recorrido.mjs
//
// Cómo se amplía (CLAUDE.md, «Recorrido de jugador»): cada tarea de juego añade aquí su parte, como un paso más del
// mismo jugador, y no se publica si no sale. Y cazar (9 nov): con la lanza que hace en la hoguera, caza una liebre. Lo que un jugador aún no puede hacer va en TODAVIA_NO con el porqué y la
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
import { idArbol, CONIFERAS } from '../src/logica/tala.js';
import { idMata, idRoca, rompible, golpesRoca, piedrasRoca } from '../src/logica/recoleccion.js';
import { Inventario } from '../src/logica/inventario.js';
import { PIEZAS, ALTURA } from '../src/logica/piezas.js';
import { ESTACIONES } from '../src/logica/fabricacion.js';
import { clave as claveDe } from '../src/logica/construccion.js';
import { USAN_INVENTARIO } from '../src/logica/acciones.js';
import { avisos, AVISO, hayAguaCerca, RITMOS } from '../src/logica/necesidades.js';
import { crearServidor } from '../servidor/servidor.mjs';
import { despojar, MOTIVOS } from '../src/logica/muerte.js';
import { msDeHora } from '../src/logica/cielo.js';

const MUTAR = process.env.MUTAR === '1';

// El reloj acelerado (valravnx, 8 nov: «no puede ser que… cada pequeña mejora sea de tantas horas»): el recorrido
// tardaba unos 35 minutos de verdad, casi todos andando a paso de jugador (6 m/s, hasta el río y vuelta) y esperando
// entre hachazos. El servidor corre en este mismo proceso, así que se le acelera el reloj entero: Date.now y
// performance.now corren RELOJ veces más deprisa, y las esperas de la prueba (pausa) duran RELOJ veces menos. Para el
// servidor todo pasa igual que antes (los mismos pasos de 0,6 m cada 100 ms de su reloj, las mismas esperas entre golpes,
// la sed y el hambre al mismo ritmo de su hora); solo se acorta la espera de verdad. RELOJ=1 lo deja como antes.
const RELOJ = Math.max(1, Number(process.env.RELOJ) || 8);
if (RELOJ > 1) {
  const d0 = Date.now(), p0 = performance.now(), dReal = Date.now.bind(Date), pReal = performance.now.bind(performance);
  Date.now = () => d0 + Math.round((dReal() - d0) * RELOJ);
  performance.now = () => p0 + (pReal() - p0) * RELOJ;
}
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// Lo que un jugador nuevo aún no puede hacer sin el arcón, con el porqué y lo que lo trae.
const TODAVIA_NO = {   // (8 nov) lo que el recorrido no hace, con el porqué
  'la resina': 'los pinos y los abetos más cercanos están a unos 4 km de la salida (cerca solo hay robles, hayas y fresnos): el recorrido no anda hasta allí; sangrarlos y coger su resina, por el servidor, lo prueba pruebas/prueba_materiales_arbol_ribera.mjs',
};   // (antes, nada (hasta el 7 nov: llevar el tronco delgado al hombro; ya es el paso 10; los juncos, el barro y la yesca, desde el 7 nov en el paso 11)

// La hora del cielo del servidor (P4, el frío: de noche sube): mediodía todo el recorrido, para que no dependa de la
// hora a la que se pase, salvo en el paso de la hoguera, que se hace de noche (como adelantar la hora: no le da nada).
let horaCielo = 12;
const T = terrenoWhitholm();
if (MUTAR) { const punto = T.punto.bind(T); T.punto = (id, x, z) => (id.startsWith('piedra:') ? null : punto(id, x, z)); }
const O = T.origen;

// el cliente: como la demo en línea, por websocket
function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
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
    c.liebres = new Map(); c.huyen = new Set();
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if ((m.tipo === 'bienvenida' || m.tipo === 'inventario' || m.tipo === 'resultado_objeto') && m.inventario) c.inv = Inventario.importarJugador(m.inventario);
      if (m.necesidades && (m.tipo === 'bienvenida' || m.tipo === 'necesidades')) c.nec = m.necesidades;   // (P4) las suyas, como se las manda el servidor
      // (P4) las liebres de alrededor, como se las manda el servidor (src/logica/fauna.js), y las que ha visto huir
      if (m.tipo === 'fauna') { for (const f of m.liebres) { c.liebres.set(f.id, f); if (f.anim === 'huir') c.huyen.add(f.id); } for (const id of m.fuera) c.liebres.delete(id); }
      c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; });
    });
    const b = c.esperar(m => m.tipo === 'bienvenida', 20000);
    ws.on('open', async () => { c.bienvenida = await b; listo(c); });
    ws.on('error', fallo);
  });
}
let sitioCaza = null;   // (P4) la hoguera de la orilla donde se hizo la lanza
const pausa = (ms) => new Promise(r => setTimeout(r, ms / RELOJ));   // en ms del reloj (acelerado): RELOJ veces menos de verdad
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
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T, ticoNecesidades: 1000 / RELOJ, horaMundo: () => msDeHora(horaCielo) });   // sin arcón: como el servidor de verdad (es lo que hay si no se pide)
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

  let varasArbol = null; // las varas del árbol joven, que se quedan en el suelo hasta el paso 15
  console.log('9. Con su hacha de piedra tala un árbol joven');
  {
    const a = cerca(arboles.filter(e => e.edad === 'joven'), J.pos)[0] || joven;
    await J.andar(a.x + 1, a.z);
    let golpes = 0;
    do { r = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); golpes++; if (r.ok && !r.datos.cae) await pausa(550); } while (r.ok && !r.datos.cae && golpes < 30);
    comprobar('lo tala a golpes (joven con piedra: 8) y cae', r.ok && r.datos.cae && golpes === 8, `${golpes} golpes · ${r.motivo || ''}`);
    comprobar('cae hacia la boca que le ha abierto: el lado desde el que tala (al este del tronco)', r.datos?.por === 'boca' && Math.abs(r.datos.dir - Math.PI / 2) < 0.05, `dir ${r.datos?.dir}, por ${r.datos?.por}`);
    const deja = s.objetos.sueloVisible(Date.now()).filter(o => Math.hypot(o.x - a.x, o.z - a.z) < 5);
    const tronco = deja.find(o => o.cosa.tipo === 'tronco_delgado'), varas = deja.find(o => o.cosa.tipo === 'vara');
    varasArbol = varas;
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
    // P4, beber del río: lejos del agua no se puede; en la orilla, sí, trago a trago, y la sed baja
    const aguaAqui = hayAguaCerca(T.aguaEn, J.pos.x, J.pos.z);
    r = await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z });
    comprobar('lejos del agua no puede beber', aguaAqui || (!r.ok && /no hay agua/.test(r.motivo || '')), aguaAqui ? 'tiene agua al lado' : r.motivo);
    await J.andar(rio.x, rio.z);
    // de allí, a la orilla: el sitio seco más cercano con agua a menos de 2,5 m
    let orillaSeca = null;
    for (let d = 0; d <= 12 && !orillaSeca; d += 0.5) for (let k = 0; k < 16 && !orillaSeca; k++) {
      const x = rio.x + Math.cos(k / 16 * 2 * Math.PI) * d, z = rio.z + Math.sin(k / 16 * 2 * Math.PI) * d;
      if (!T.aguaEn(x, z) && hayAguaCerca(T.aguaEn, x, z)) orillaSeca = { x, z };
    }
    comprobar('junto al río hay orilla seca con agua al lado', !!orillaSeca);
    await J.andar(orillaSeca.x, orillaSeca.z);
    const sedAntes = J.nec.sed;
    r = await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z });
    await pausa(300);
    comprobar('en la orilla bebe agua con las manos: la sed baja', r.ok && J.nec.sed < sedAntes, `${r.motivo || ''} sed ${sedAntes} → ${J.nec.sed}`);
    const r2b = await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z });
    comprobar('trago a trago: enseguida otra vez, no', !r2b.ok && /trago/.test(r2b.motivo || ''), r2b.motivo);
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
    comprobar('con la lasca, corta de 1 a 3 haces de juncos (valravnx, 8 nov: al azar)', r.ok && J.cuantos('junco') >= 1 && J.cuantos('junco') <= 3, r.motivo || enMano());
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
    sitioCaza = { hog, fogon };   // (la lanza se queda hecha en la hoguera: vuelve a por ella al final, para cazar)
    // P4, el frío (8 nov): se hace de noche; lejos del fuego, con lo del principio, le sube el frío; junto a la
    // hoguera encendida, le baja (lo lleva el servidor: la noche, su bioma, su ropa y el calor del fuego)
    {
      horaCielo = 0;
      const lejos = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: fogon.x + Math.cos(i * Math.PI / 4) * 9, z: fogon.z + Math.sin(i * Math.PI / 4) * 9 })).find(p => !T.aguaEn(p.x, p.z));
      await J.andar(lejos.x, lejos.z);
      const f0 = J.nec.frio; await pausa(20000); const f1 = J.nec.frio;
      comprobar('de noche, a 9 m de la hoguera y con la camisa y el pantalón de lino, le sube el frío', f1 > f0 + 1, `${f0} → ${f1}`);
      await J.andar(fogon.x, fogon.z);
      const f2 = J.nec.frio; await pausa(20000); const f3 = J.nec.frio;
      comprobar('junto a la hoguera encendida, le baja', H().fuego.hasta > Date.now() && f3 < f2 - 0.3, `${f2} → ${f3}`);
      horaCielo = 12;
    }
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

  console.log('15. Vuelve a por las varas del árbol, levanta en su tierra un almiar y guarda en él su haz de juncos (8 nov)');
  {
    const yo = J.bienvenida.autor, P = id => s.objetos.fab.estaciones[id];
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    const varas = varasArbol && s.objetos.sueloVisible(Date.now()).find(o => o.id === varasArbol.id);
    comprobar('las varas del árbol siguen donde cayeron', !!varas && varas.cosa.n >= 2, varas ? `${varas.cosa.n}` : 'no están');
    await J.andar(varas.x + 0.6, varas.z);
    let r = await J.objeto({ tipo: 'coger_suelo', objeto: varas.id, cantidad: 1, a: 'mano:der', x: J.pos.x, z: J.pos.z });
    const r2 = await J.objeto({ tipo: 'coger_suelo', objeto: varas.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z });
    comprobar('coge 2 varas, una en cada mano (los juncos siguen en el fardo)', r.ok && r2.ok && J.cuantos('vara') === 2 && J.inv.lugares.espalda?.dentro?.[0]?.tipo === 'junco', `${r.motivo || ''} ${r2.motivo || ''}`);
    const mj = s.mundo.mojonDe(yo), sitio = { x: mj.x - 2, z: mj.z - 4 };
    await J.andar(sitio.x, sitio.z);
    r = await ponerPuesto('almiar', sitio.x + 0.9, sitio.z);
    comprobar('en su tierra levanta un almiar: su marco, sus 2 varas y su trabajo', r.ok && r.datos.terminada && J.cuantos('vara') === 0, `${r.motivo || ''} lleva ${J.cuantos('vara')} varas`);
    const al = r.id;
    r = await J.objeto({ tipo: 'depositar_estacion', estacion: al, de: 'espalda/0', x: J.pos.x, z: J.pos.z });
    comprobar('guarda en él el haz de juncos que llevaba en el fardo', r.ok && P(al).deposito.junco === 1 && !J.inv.lugares.espalda?.dentro?.[0], r.motivo);
    const vista = s.objetos.estacionesVisibles().find(e => e.id === al);
    comprobar('y todos lo ven con sus juncos (lo que manda el servidor)', vista && vista.deposito.junco === 1, JSON.stringify(vista && vista.deposito));
    r = await J.objeto({ tipo: 'retirar_estacion', estacion: al, objeto: 'junco', cantidad: 1, x: J.pos.x, z: J.pos.z });
    comprobar('y lo vuelve a sacar cuando lo necesita', r.ok && J.cuantos('junco') === 1 && !P(al).deposito.junco, r.motivo);
  }

  console.log('16. La casa humilde entera, en su tierra y con lo que recoge: cimiento de piedra, cuatro postes, dos muros de troncos, uno de zarzo con barro, el de la puerta con su puerta de varas, y el tejado de juncos');
  {
    const yo = J.bienvenida.autor, P = id => s.objetos.fab.estaciones[id];
    const mj = s.mundo.mojonDe(yo), C = { x: r2(mj.x + 10), z: r2(mj.z - 10) };
    const manos = ['mano:der', 'mano:izq'];
    const enMano = () => manos.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
    const soltarManos = async () => { for (const l of manos) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z }); };
    const enSuelo = (tipo, p, d = 3) => cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === tipo && !o.arrastra && Math.hypot(o.x - p.x, o.z - p.z) < d), p);
    const alrededor = (p, d) => recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - d, z0: O.z + p.z - d, x1: O.x + p.x + d, z1: O.z + p.z + d })
      .map(q => ({ id: q.id, tipo: q.tipo, x: r2(q.x - O.x), z: r2(q.z - O.z) }));
    // lo que aún no ha intentado coger (el servidor solo sabe de lo que ya se ha recogido: lo demás, a la vista, se puede)
    const probados = new Set();
    const libres = (lista, tipo) => cerca(lista.filter(q => q.tipo === tipo && !probados.has(q.id)), J.pos);
    const coger = async (p) => { probados.add(p.id); return recoger(p); };
    const aqui = alrededor(C, 120);
    comprobar('el sitio de la casa es de su tierra', s.mundo.dentroDeTierra(C.x, C.z, yo), JSON.stringify(C));

    // lo que trae en las manos (el haz de juncos del almiar), a un lado del sitio: será del tejado
    await J.andar(C.x + 3, C.z);
    await soltarManos();
    const juncoGuardado = { x: J.pos.x, z: J.pos.z };

    // las piezas de la casa: el sitio de cada una (local a la casa) y su clave, que da el servidor al ponerla
    let casa = null;
    const pieza = (tipo, dx, dz, k = 0) => ({ tipo, x: r2(C.x + dx), z: r2(C.z + dz), k });
    const marco = async (pz) => {
      await J.andar(C.x, C.z);
      const r = await J.accion({ tipo: 'colocar', pieza: pz.tipo, x: pz.x, z: pz.z, k: pz.k, rot: 0, dir: 0, y: T.suelo(C.x, C.z) });
      if (!casa && r.ok) casa = s.mundo.construcciones.at(-1);
      const cand = s.mundo.candidata(pz.tipo, pz.x, pz.z, pz.k, 0, 0, T.suelo(C.x, C.z)).pieza;
      pz.clave = claveDe(cand.hueco, cand.i, cand.j, cand.k, cand.d);
      return r;
    };
    const obra = pz => casa?.piezas.get(pz.clave)?.obra;
    const falta = (pz, m) => (PIEZAS[pz.tipo].coste[m] || 0) - ((obra(pz)?.entregado?.[m]) || 0);
    const entregar = async (pz, m, n) => { await J.andar(C.x, C.z); return J.accion({ tipo: 'entregar', construccion: casa?.id, clave: pz.clave, material: m, cantidad: n }); };
    const trabajar = async (pz) => {
      await J.andar(C.x, C.z);
      let t = { ok: true }, n = 0;
      for (; n < 400 && t.ok && obra(pz); n++) t = await J.accion({ tipo: 'trabajar', construccion: casa.id, clave: pz.clave, segundos: 5 });
      return { ok: !!casa?.piezas.get(pz.clave) && !obra(pz), motivo: t.motivo, n };
    };
    const terminada = pz => !!casa?.piezas.get(pz.clave) && !obra(pz);

    // 16a. el cimiento: 8 piedras, en dos viajes (le caben 6 en las manos)
    const cim = pieza('cim_piedra', 0, 0);
    let r = await marco(cim);
    comprobar('pone en su tierra el marco del cimiento de su casa', r.ok && !!obra(cim), r.motivo);
    const noCoge = [];
    let entregas = [];
    for (let viaje = 0; viaje < 3 && falta(cim, 'piedra') > 0; viaje++) {
      const quiere = Math.min(6, falta(cim, 'piedra'));
      for (const p of libres(aqui, 'piedra').slice(0, 12)) { if (J.cuantos('piedra') >= quiere) break; const c = await coger(p); if (!c.ok) noCoge.push(c.motivo); }
      const e = await entregar(cim, 'piedra', J.cuantos('piedra'));
      entregas.push(e.ok ? 'ok' : e.motivo);
    }
    r = await trabajar(cim);
    comprobar('le lleva sus 8 piedras sueltas, en dos viajes, y lo levanta', r.ok, `${r.motivo || ''} faltan ${falta(cim, 'piedra')} · ${libres(aqui, 'piedra').length} piedras libres · no coge: ${[...new Set(noCoge)].join(' | ')} · entregas: ${entregas.join(' | ')} · ${enMano()} · ${JSON.stringify(J.nec)}`);

    // el hacha de piedra: la dejó en el suelo al echarse el tronco al hombro (paso 10)
    const hacha = () => J.cuantos('hacha_piedra') > 0;
    const cogerHacha = async () => {
      if (hacha()) return true;
      const h = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'hacha_piedra'), J.pos)[0];
      if (!h) return false;
      await J.andar(h.x + 0.5, h.z);
      await soltarManos();
      return (await J.objeto({ tipo: 'coger_suelo', objeto: h.id, cantidad: 1, a: 'mano:der', x: J.pos.x, z: J.pos.z })).ok;
    };
    comprobar('recoge su hacha de piedra del suelo', await cogerHacha(), enMano());

    // talar el árbol (joven o adulto) más cercano que quede en pie; lo que deja, al suelo
    const taladas = new Set(), tocones = [];
    const talar = async (edad) => {
      for (let intento = 0; intento < 6; intento++) {
        const a = cerca(arboles.filter(e => e.edad === edad && !taladas.has(e.id) && Math.hypot(e.x - C.x, e.z - C.z) > 8), C)[0];
        if (!a) return { ok: false, motivo: `no quedan árboles (${edad})` };
        taladas.add(a.id);
        if (!(await cogerHacha())) return { ok: false, motivo: 'sin hacha' };
        await J.andar(a.x + 1, a.z);
        let t, g = 0;
        do { t = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); g++; if (t.ok && !t.datos.cae) await pausa(550); } while (t.ok && !t.datos.cae && g < 80);
        if (t.ok && t.datos.cae) { tocones.push(a); return { ok: true, a, golpes: g }; }
      }
      return { ok: false, motivo: 'ningún árbol cae' };
    };
    // un tronco delgado: tala un árbol joven, deja el hacha, se echa el tronco al hombro y se lo lleva a la pieza
    const troncoA = async (pz) => {
      const t = await talar('joven');
      if (!t.ok) return t;
      const tr = enSuelo('tronco_delgado', t.a, 5)[0];
      if (!tr) return { ok: false, motivo: 'no ha dejado tronco' };
      await soltarManos();   // con algo al hombro las manos no llevan nada: el hacha se queda en el suelo, junto al tocón
      await J.andar(tr.x + 0.6, tr.z);
      const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
      if (!c.ok) return c;
      return entregar(pz, 'tronco', 1);
    };

    // 16b. los cuatro postes, en las esquinas: un árbol joven cada uno
    const postes = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => pieza('poste', dx, dz));
    let bien = 0, motivo = '';
    for (const pz of postes) {
      r = await marco(pz);
      if (r.ok) r = await troncoA(pz);
      if (r.ok) r = await trabajar(pz);
      if (r.ok) bien++; else motivo = r.motivo;
    }
    comprobar('levanta los cuatro postes de las esquinas, con un tronco delgado cada uno, talado por él y traído al hombro', bien === 4 && postes.every(terminada), `${bien} · ${motivo}`);

    // 16c. los muros de troncos (oeste y este, 4 troncos cada uno) y el de la puerta (sur, 3)
    const muros = [pieza('muro_tronco', -0.95, 0), pieza('muro_tronco', 0.95, 0), pieza('muro_tronco_puerta', 0, -0.95)];
    bien = 0; motivo = '';
    for (const pz of muros) {
      r = await marco(pz);
      for (let v = 0; r.ok && v < 6 && falta(pz, 'tronco') > 0; v++) r = await troncoA(pz);
      if (r.ok) r = await trabajar(pz);
      if (r.ok) bien++; else motivo = r.motivo;
    }
    comprobar('levanta dos muros de troncos y el de la puerta: 11 troncos delgados más, de 11 árboles jóvenes, uno a uno al hombro', bien === 3 && muros.every(terminada), `${bien} · ${motivo}`);

    // P4, el cansancio (8 nov): después de talar y cargar los troncos, se sienta en el suelo a descansar (la demo dice
    // «sentado» en su estado, Z o el botón de la ficha del cansancio); el cansancio baja más deprisa que de pie
    console.log('16c2. Cansado de talar y cargar troncos, se sienta a descansar');
    {
      await soltarManos();
      const cs = J.nec.cansancio;
      comprobar('talar y cargar los troncos le ha cansado', cs > 5, `cansancio ${cs}`);
      const sentado = (anim) => J.ws.send(JSON.stringify({ tipo: 'estado', x: J.pos.x, y: T.suelo(J.pos.x, J.pos.z), z: J.pos.z, giro: 0, anim }));
      for (let k = 0; k < 3; k++) { sentado('sentado'); await pausa(500); }
      const c0 = J.nec.cansancio;
      for (let k = 0; k < 10; k++) { sentado('sentado'); await pausa(500); }
      const k = ['hambre', 'sed', 'frio'].some(q => J.nec[q] >= 100) ? 2 : 1, espera = Math.max(0, c0 - 0.8 * 5 * RITMOS.sentado / k);
      comprobar('sentado, el cansancio baja (en 5 s, casi lo que dice sentado: más del doble que de pie quieto)', J.nec.cansancio <= espera && RITMOS.sentado >= 2 * RITMOS.quieto, `cansancio ${c0} → ${J.nec.cansancio} (como mucho ${espera.toFixed(2)})`);
      J.estar(J.pos.x, J.pos.z);   // se levanta
    }

    // 16d. al río, a por el barro del muro de zarzo y los juncos del tejado
    console.log('16d. Vuelve al río a por el barro del muro de zarzo y los juncos que le faltan para el tejado');
    await soltarManos();
    await J.andar(rio.x, rio.z);
    const ribera = alrededor(rio, 200);
    // un cordel de cinturón, para llevar la lasca con las manos ocupadas
    for (const p of libres(ribera, 'ortiga').concat(libres(ribera, 'hierba_larga'))) { if (J.cuantos('fibra') >= 3) break; await coger(p); }
    if (J.cuantos('fibra') > 3) { const rf = manos.find(l => J.inv.lugares[l]?.tipo === 'fibra'); await J.objeto({ tipo: 'soltar_suelo', de: rf, cantidad: J.cuantos('fibra') - 3, x: J.pos.x, z: J.pos.z }); }
    r = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
    adelantar();
    const rr = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
    const lc = manos.find(l => J.inv.lugares[l]?.tipo === 'cordel');
    const rp = lc ? await J.objeto({ tipo: 'ponerse', de: lc }) : { ok: false, motivo: 'no tiene el cordel en la mano' };
    comprobar('se hace un cordel y se lo ciñe a la cintura', r.ok && rr.ok && rp.ok && J.inv.lugares.cintura?.tipo === 'cordel', `${r.motivo || ''} ${rr.motivo || ''} ${rp.motivo || ''} ${enMano()}`);
    const lasca = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'lasca_silex'), rio)[0];
    if (lasca) await J.andar(lasca.x + 0.4, lasca.z);
    r = lasca ? await J.objeto({ tipo: 'coger_suelo', objeto: lasca.id, cantidad: 1, a: 'cintura/0', x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no encuentra su lasca' };
    comprobar('recoge su lasca de sílex de la orilla y la lleva en el cinturón', r.ok && J.inv.lugares.cintura?.dentro?.[0]?.tipo === 'lasca_silex', r.motivo);
    const palo = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'palo_cavador'), rio)[0];
    if (palo) await J.andar(palo.x + 0.4, palo.z);
    r = palo ? await J.objeto({ tipo: 'coger_suelo', objeto: palo.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no encuentra su palo cavador' };
    comprobar('y su palo cavador, en la mano izquierda', r.ok && J.inv.lugares['mano:izq']?.tipo === 'palo_cavador', r.motivo);
    const barro = libres(ribera, 'barro')[0];
    let cavadas = 0;
    for (let v = 0; v < 3; v++) if ((await recoger(barro)).ok) cavadas++;
    const montonBarro = { x: J.pos.x, z: J.pos.z };
    r = await J.objeto({ tipo: 'soltar_suelo', de: 'mano:der', x: J.pos.x, z: J.pos.z });
    if ((await recoger(barro)).ok) cavadas++;
    comprobar('cava 4 cestas de barro (3 las deja a sus pies: con el palo en una mano, en la otra le caben 3)', cavadas === 4 && J.cuantos('barro') === 1, `${cavadas} · ${enMano()}`);
    await J.objeto({ tipo: 'soltar_suelo', de: 'mano:izq', x: J.pos.x, z: J.pos.z });   // el palo se queda en la orilla
    // los juncos, con la lasca del cinturón, al fardo (cada corte da de 1 a 3 haces: valravnx, 8 nov), hasta llevar 3
    const enFardo = () => (J.inv.lugares.espalda?.dentro || []).filter(Boolean).filter(c => c.tipo === 'junco').reduce((t, c) => t + c.n, 0);
    let cortados = 0;
    const noCorta = [];
    for (const p of libres(ribera, 'juncos')) {
      if (enFardo() >= 3) break;
      const c = await coger(p);
      if (!c.ok) { noCorta.push(c.motivo); continue; }
      cortados++;
      const lj = manos.find(l => J.inv.lugares[l]?.tipo === 'junco');
      const hueco = [0, 1, 2, 3].find(n => !J.inv.lugares.espalda?.dentro?.[n]);
      if (lj && hueco !== undefined) await J.objeto({ tipo: 'mover', de: lj, a: `espalda/${hueco}` });
    }
    comprobar('corta juncos con la lasca del cinturón y los mete en el fardo: lleva al menos 3 haces', enFardo() >= 3 && !manos.some(l => J.inv.lugares[l]?.tipo === 'junco'), `${cortados} cortes · en el fardo ${enFardo()} · ${enMano()} · ${libres(ribera, 'juncos').length} sin probar · no corta: ${[...new Set(noCorta)].join(' | ')}`);
    const mb = enSuelo('barro', montonBarro, 2)[0];
    if (mb) await J.andar(mb.x + 0.4, mb.z);
    r = mb ? await J.objeto({ tipo: 'coger_suelo', objeto: mb.id, cantidad: 3, a: 'mano:izq', x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no está el barro' };
    comprobar('coge las 3 cestas de barro del suelo: lleva 4', r.ok && J.cuantos('barro') === 4, r.motivo || enMano());
    const zarzo = pieza('muro_zarzo', 0, 0.95);
    r = await marco(zarzo);
    comprobar('de vuelta en su casa, pone el marco del muro de zarzo (norte)', r.ok && !!obra(zarzo), r.motivo);
    r = await entregar(zarzo, 'barro', 4);
    comprobar('y le lleva sus 4 cestas de barro', r.ok && falta(zarzo, 'barro') === 0 && J.cuantos('barro') === 0, r.motivo);

    // 16e. las varas de los árboles talados: 4 del zarzo, 2 del tejado y 4 de la puerta
    const varasPara = async (pz, n) => {
      for (let v = 0; v < 6 && falta(pz, 'vara') > 0; v++) {
        for (const a of tocones) {
          if (J.cuantos('vara') >= Math.min(6, falta(pz, 'vara'))) break;
          for (const o of enSuelo('vara', a, 5)) for (const l of manos) {
            const quiere = Math.min(6, falta(pz, 'vara')) - J.cuantos('vara');
            if (quiere <= 0) break;
            if (J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'vara') continue;
            if (Math.hypot(o.x - J.pos.x, o.z - J.pos.z) > 1) await J.andar(o.x + 0.5, o.z);
            const ya = J.inv.lugares[l]?.n || 0, hay = s.objetos.sueloVisible(Date.now()).find(x => x.id === o.id)?.cosa.n || 0;
            if (Math.min(quiere, 3 - ya, hay) <= 0) continue;
            await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(quiere, 3 - ya, s.objetos.sueloVisible(Date.now()).find(x => x.id === o.id)?.cosa.n || 0), a: l, x: J.pos.x, z: J.pos.z });
          }
        }
        if (!J.cuantos('vara')) break;
        await entregar(pz, 'vara', J.cuantos('vara'));
      }
      return falta(pz, 'vara') === 0;
    };
    await soltarManos();
    r = await varasPara(zarzo);
    const rz = r ? await trabajar(zarzo) : { ok: false };
    comprobar('recoge 4 varas de los árboles que taló, se las lleva al zarzo y lo levanta', r && rz.ok, `${rz.motivo || ''} ${terminada(zarzo) ? '' : `faltan ${falta(zarzo, 'vara')} varas`}`);

    // 16f. las cuerdas (la de la puerta y las dos del andamio): el banco de tronco (2 troncos cortos de un árbol adulto,
    // tronzado) y 9 cordeles
    console.log('16f. Para las cuerdas de la puerta y del andamio: tala un árbol adulto, lo tronza, levanta un banco de tronco y trenza 3 cuerdas');
    const ad = await talar('adulto');
    comprobar('tala un árbol adulto con su hacha de piedra (despacio)', ad.ok, `${ad.motivo || ''} ${ad.golpes || ''} golpes`);
    const largo = ad.ok && enSuelo('tronco_largo', ad.a, 6)[0];
    let golpes = 0, tz = { ok: false, motivo: 'no hay tronco largo' };
    if (largo) {
      await J.andar(largo.x + 0.5, largo.z + 0.5);
      do { tz = await J.objeto({ tipo: 'trocear', objeto: largo.id, x: J.pos.x, z: J.pos.z }); golpes++; await pausa(850); } while (tz.ok && enSuelo('tronco_corto', largo, 4).length === 0 && golpes < 80);
    }
    const cortos = largo ? enSuelo('tronco_corto', largo, 4) : [];
    comprobar('lo tronza a hachazos: le da 3 o 4 troncos cortos', cortos.length && cortos.reduce((t, o) => t + o.cosa.n, 0) >= 3, `${golpes} golpes · ${tz.motivo || ''}`);
    if (cortos[0]) await J.andar(cortos[0].x + 0.6, cortos[0].z);
    const taller2 = { ...J.pos };
    const banco = cortos[0] ? await ponerPuesto('banco_tronco', J.pos.x + 0.8, J.pos.z) : { ok: false, motivo: 'sin troncos cortos' };
    comprobar('levanta allí un banco de tronco con 2 de ellos, con el hacha en la mano', banco.ok && banco.datos.terminada, `${banco.motivo || ''} ${enMano()}`);
    await soltarManos();   // el hacha, junto al banco: ya no tala más
    const fibras = alrededor(J.pos, 200);
    let cuerdas = 0, cordeles = 0;
    const noTrenza = [];
    for (let q = 0; banco.ok && q < 3; q++) {
      // 9 de fibra de una vez (en una mano caben 10), y de vuelta al banco: 3 cordeles, que deja en él
      const plantas2 = () => cerca(libres(fibras, 'ortiga').concat(libres(fibras, 'hierba_larga')), J.pos);
      for (let k = 0; k < 20 && J.cuantos('fibra') < 9; k++) { const p = plantas2()[0]; if (!p) break; await coger(p); }
      // junto al banco, la fibra (y la cuerda que ya tenga) a sus pies: con las manos se fabrica también de lo del suelo
      await J.andar(taller2.x, taller2.z);
      await soltarManos();
      for (let v = 0; v < 3; v++) {
        const f = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
        adelantar();
        const g = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
        const lc2 = manos.find(l => J.inv.lugares[l]?.tipo === 'cordel');
        const d = lc2 ? await J.objeto({ tipo: 'depositar_estacion', estacion: banco.id, de: lc2, x: J.pos.x, z: J.pos.z }) : { ok: false };
        if (f.ok && g.ok && d.ok) cordeles++;
      }
      const rq = await J.objeto({ tipo: 'fabricar', receta: 'cuerda', estacion: banco.id, x: J.pos.x, z: J.pos.z });
      adelantar();
      const rr2 = await J.objeto({ tipo: 'recoger_fabricado', estacion: banco.id, x: J.pos.x, z: J.pos.z });
      if (rq.ok && rr2.ok) cuerdas++; else noTrenza.push(rq.motivo || rr2.motivo);
    }
    // recoge del suelo las cuerdas que dejó a sus pies (se apilan en una mano) y el hacha se queda junto al banco
    for (const o of enSuelo('cuerda', taller2, 2.5)) await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: o.cosa.n, a: J.inv.lugares['mano:der'] && J.inv.lugares['mano:der'].tipo !== 'cuerda' ? 'mano:izq' : 'mano:der', x: J.pos.x, z: J.pos.z });
    comprobar('arranca fibra, hace 9 cordeles, los deja en el banco de 3 en 3 y trenza 3 cuerdas', cordeles === 9 && cuerdas === 3 && J.cuantos('cuerda') === 3, `${cordeles} cordeles, ${cuerdas} cuerdas · ${enMano()} · ${noTrenza.join(' | ')}`);

    // 16g. la puerta de varas, en el hueco del muro de la puerta: una de las cuerdas y 4 varas
    const puerta = pieza('puerta_varas', 0, -0.95);
    r = await marco(puerta);
    comprobar('pone la puerta de varas en el hueco del muro de la puerta', r.ok && !!obra(puerta), r.motivo);
    r = await entregar(puerta, 'cuerda', 1);
    const rv = await varasPara(puerta);
    comprobar('le lleva su cuerda y 4 varas', r.ok && rv && falta(puerta, 'cuerda') === 0, `${r.motivo || ''} faltan ${falta(puerta, 'vara')} varas`);
    r = await trabajar(puerta);
    comprobar('la levanta', r.ok, r.motivo);
    r = await J.accion({ tipo: 'usar', construccion: casa?.id, clave: puerta.clave });
    comprobar('y la abre con Usar', r.ok && casa.piezas.get(puerta.clave)?.abierta, r.motivo);
    // 16h. el andamio, al lado de la casa (8 varas y 2 cuerdas), para subir a poner el tejado (valravnx, 8 nov: «lo he
    // hecho ya en survival solo… puedes montar el tronco sin problema y hacer el andamio»)
    console.log('16h. Levanta un andamio junto a la casa, sube a él con las varas y los juncos y pone desde arriba el tejado de juncos');
    const andamio = pieza('andamio', 2, 0);
    r = await marco(andamio);
    comprobar('pone el marco de un andamio junto a la casa (al este)', r.ok && !!obra(andamio), r.motivo);
    r = await entregar(andamio, 'cuerda', 2);
    const ra = await varasPara(andamio);
    const ta = ra ? await trabajar(andamio) : { ok: false };
    comprobar('le lleva sus 2 cuerdas y 8 varas de los árboles que taló, y lo levanta', r.ok && ra && ta.ok, `${r.motivo || ''} ${ta.motivo || ''} ${terminada(andamio) ? '' : `faltan ${falta(andamio, 'vara')} varas`}`);
    const tejado = pieza('tejado_juncos', 0, 0, 1);
    r = await marco(tejado);
    comprobar('pone el marco del tejado de juncos encima de los muros', r.ok && !!obra(tejado), r.motivo);
    // abajo coge lo que va a subir: 2 varas en una mano, el haz de juncos que dejó al llegar en la otra, y 3 en el fardo
    await soltarManos();
    for (const a of tocones) {
      if (J.cuantos('vara') >= 2) break;
      const o = enSuelo('vara', a, 5)[0];
      if (!o) continue;
      await J.andar(o.x + 0.5, o.z);
      await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(2 - J.cuantos('vara'), o.cosa.n), a: 'mano:der', x: J.pos.x, z: J.pos.z });
    }
    const jg = enSuelo('junco', juncoGuardado, 2)[0];
    if (jg) { await J.andar(jg.x + 0.4, jg.z); await J.objeto({ tipo: 'coger_suelo', objeto: jg.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z }); }
    comprobar('lleva 2 varas y al menos 4 haces de juncos (en la mano y en el fardo)', J.cuantos('vara') === 2 && J.cuantos('junco') >= 4, `${enMano()} · ${J.cuantos('junco')} haces`);
    r = await entregar(tejado, 'vara', 2);
    comprobar('desde el suelo no se lo puede dar: el tejado está en la planta de arriba', !r.ok && /andamio/.test(r.motivo || ''), r.motivo);
    // sube por el andamio: de pie en lo alto, en la planta 1 de su casa
    const A = { x: andamio.x, z: andamio.z }, arriba = (casa.oy || 0) + ALTURA + 0.05;
    await J.andar(A.x, A.z);
    for (let h = 0; h <= 10; h++) { J.ws.send(JSON.stringify({ tipo: 'estado', x: A.x, y: T.suelo(A.x, A.z) + (arriba - T.suelo(A.x, A.z)) * h / 10, z: A.z, giro: 0, anim: 'andar' })); await pausa(120); }
    await pausa(300);
    const subido = (await J.accion({ tipo: 'entregar', construccion: casa.id, clave: tejado.clave, material: 'vara', cantidad: 2, desde: 1 }));
    const rj = await J.accion({ tipo: 'entregar', construccion: casa.id, clave: tejado.clave, material: 'junco', cantidad: 4, desde: 1 });
    comprobar('sube al andamio y desde arriba le da al tejado sus 2 varas y sus 4 haces de juncos', subido.ok && rj.ok && falta(tejado, 'vara') === 0 && falta(tejado, 'junco') === 0, `${subido.motivo || ''} ${rj.motivo || ''}`);
    let tt = { ok: true }, nt = 0;
    for (; nt < 400 && tt.ok && obra(tejado); nt++) tt = await J.accion({ tipo: 'trabajar', construccion: casa.id, clave: tejado.clave, segundos: 5 });
    comprobar('lo trabaja desde el andamio: la casa ya tiene techo', terminada(tejado) && s.mundo.bajoTecho(C.x, C.z), `${nt} ratos ${tt.motivo || ''}`);
    for (let h = 10; h >= 0; h--) { J.ws.send(JSON.stringify({ tipo: 'estado', x: A.x, y: T.suelo(A.x, A.z) + (arriba - T.suelo(A.x, A.z)) * h / 10, z: A.z, giro: 0, anim: 'andar' })); await pausa(120); }
    J.estar(A.x, A.z); await pausa(300);

    // el andamio ya no hace falta: lo desmonta (vuelve el 75 % de lo que costó, a lo que lleva o a sus pies)
    await soltarManos();
    r = await J.accion({ tipo: 'desmontar', construccion: casa.id, clave: andamio.clave });
    comprobar('desmonta el andamio', r.ok && !casa.piezas.get(andamio.clave), r.motivo);

    // 16i. la casa, entera: cerrada por los cuatro lados y techada, todo terminado
    const todas = [cim, ...postes, ...muros, zarzo, tejado, puerta];
    comprobar('la casa humilde, entera: cimiento, 4 postes, 4 muros (2 de troncos, 1 de zarzo y barro, 1 con puerta), puerta de varas y tejado de juncos, todo terminado',
      todas.every(terminada) && casa.piezas.size === todas.length, `${todas.filter(terminada).length} de ${todas.length} · ${casa ? casa.piezas.size : 0} piezas`);
    const lados = [...muros, zarzo], claves = new Set(lados.map(pz => pz.clave));
    comprobar('cerrada: un muro terminado en cada uno de sus cuatro lados', claves.size === 4 && lados.every(pz => terminada(pz) && casa.piezas.get(pz.clave).hueco === 'e'), [...claves].join(' '));
    comprobar('y techada: dentro está bajo techo; fuera, no', s.mundo.bajoTecho(C.x, C.z) && !s.mundo.bajoTecho(C.x + 4, C.z));
    comprobar('es suya: todo lo pagó con lo que llevaba (sin arcón)', J.bienvenida.arcon === false && s.mundo.materiales.piedra === piedraArcon);

    // 16j. el hogar, dentro (8 nov): 8 piedras de alrededor (en dos viajes, 3 en cada mano) y 2 cestas de barro del río;
    // se enciende con ramas, yesca y su taladro, se deja en brasas y se aviva sin yesca
    console.log('16j. Levanta el hogar dentro de su casa con piedras y barro, lo enciende, lo deja en brasas y lo aviva sin yesca');
    const sitioHogar = { x: r2(C.x + 0.3), z: r2(C.z + 0.2) };
    await soltarManos();
    await J.andar(C.x + 6, C.z);
    r = await J.objeto({ tipo: 'colocar_estacion', estacion: 'hogar', x: C.x + 6.8, z: C.z });
    comprobar('fuera de la casa no puede poner el hogar', !r.ok && /dentro/.test(r.motivo || ''), r.motivo);
    await J.andar(C.x, C.z);
    const rh = await J.objeto({ tipo: 'colocar_estacion', estacion: 'hogar', x: sitioHogar.x, z: sitioHogar.z });
    comprobar('dentro de su casa pone el marco del hogar', rh.ok, rh.motivo);
    const hg = rh.datos && rh.datos.id, HG = () => P(hg);
    const faltaHogar = m => (HG()?.obra ? (ESTACIONES.hogar.coste[m] || 0) - (HG().obra.entregado[m] || 0) : 0);
    for (let viaje = 0; viaje < 3 && hg && faltaHogar('piedra') > 0; viaje++) {
      const quiere = Math.min(6, faltaHogar('piedra'));
      for (const q of libres(aqui, 'piedra')) { if (J.cuantos('piedra') >= quiere) break; await coger(q); }
      await J.andar(C.x, C.z);
      await J.objeto({ tipo: 'entregar_estacion', estacion: hg, x: J.pos.x, z: J.pos.z });
      await soltarManos();
    }
    comprobar('le lleva sus 8 piedras, recogidas alrededor de la casa', hg && faltaHogar('piedra') === 0, `le faltan ${faltaHogar('piedra')}`);
    // el barro, del río: su palo cavador sigue en la orilla
    const palo2 = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'palo_cavador'), rio)[0];
    if (palo2) { await J.andar(palo2.x + 0.4, palo2.z); await J.objeto({ tipo: 'coger_suelo', objeto: palo2.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z }); }
    const barro2 = libres(ribera, 'barro')[0] || barro;
    for (let v = 0; v < 2; v++) await recoger(barro2);
    comprobar('cava 2 cestas de barro en la orilla', J.cuantos('barro') === 2, enMano());
    await J.objeto({ tipo: 'soltar_suelo', de: 'mano:izq', x: J.pos.x, z: J.pos.z });   // el palo, otra vez en la orilla
    // y de paso, su taladro de fuego y una yesca (de las que dejó junto a la hoguera, o de un hongo yesquero)
    const taladro = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'taladro_fuego'), rio)[0];
    if (taladro) { await J.andar(taladro.x + 0.3, taladro.z); await J.objeto({ tipo: 'coger_suelo', objeto: taladro.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z }); }
    await J.andar(C.x, C.z);
    r = await J.objeto({ tipo: 'entregar_estacion', estacion: hg, x: J.pos.x, z: J.pos.z });
    comprobar('le lleva sus 2 cestas de barro', r.ok && faltaHogar('barro') === 0 && J.cuantos('barro') === 0, r.motivo || enMano());
    let rth = { ok: true, datos: {} };
    for (let i = 0; i < 8 && rth.ok && !rth.datos.terminada; i++) rth = await J.objeto({ tipo: 'trabajar_estacion', estacion: hg, segundos: 5, x: J.pos.x, z: J.pos.z });
    comprobar('lo levanta trabajando en él: el hogar, apagado y sin nada puesto', rth.ok && rth.datos.terminada && HG().fuego && HG().fuego.combustible === 0, rth.motivo || JSON.stringify(HG() && HG().fuego));
    await J.objeto({ tipo: 'soltar_suelo', de: 'mano:izq', x: J.pos.x, z: J.pos.z }); // el taladro, en el suelo de casa
    for (const q of libres(aqui, 'ramas')) { if (J.cuantos('rama') >= 2) break; await coger(q); }
    await J.andar(C.x, C.z);
    let echadas = 0;
    while (J.cuantos('rama') && echadas < 4) { const q = await J.objeto({ tipo: 'echar_fuego', estacion: hg, objeto: 'rama', x: J.pos.x, z: J.pos.z }); if (!q.ok) break; echadas++; }
    comprobar('le echa ramas de alrededor (cada una, 4 min y medio en el hogar)', echadas >= 1 && HG().fuego.combustible === echadas * 270, `${echadas} · ${JSON.stringify(HG().fuego)}`);
    await soltarManos();
    const tl = enSuelo('taladro_fuego', J.pos, 2.5)[0];
    if (tl) await J.objeto({ tipo: 'coger_suelo', objeto: tl.id, cantidad: 1, a: 'mano:izq', x: J.pos.x, z: J.pos.z });
    if (!J.cuantos('yesca')) {
      const ys = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'yesca'), J.pos)[0];
      if (ys) { await J.andar(ys.x + 0.3, ys.z); await J.objeto({ tipo: 'coger_suelo', objeto: ys.id, cantidad: 1, a: 'mano:der', x: J.pos.x, z: J.pos.z }); }
      else for (const q of libres(alrededor(J.pos, 200), 'yesquero')) { const c = await coger(q); if (c.ok) break; }
      await J.andar(C.x, C.z);
    }
    comprobar('lleva el taladro de fuego y yesca', J.cuantos('taladro_fuego') === 1 && J.cuantos('yesca') >= 1, enMano());
    const yescas2 = J.cuantos('yesca');
    r = await J.objeto({ tipo: 'encender_fuego', estacion: hg, x: J.pos.x, z: J.pos.z });
    comprobar('enciende el hogar dentro de su casa (bajo techo)', r.ok && HG().fuego.hasta > Date.now() && J.cuantos('yesca') === yescas2 - 1 && s.mundo.bajoTecho(HG().x, HG().z), r.motivo);
    r = await J.objeto({ tipo: 'brasas_fuego', estacion: hg, x: J.pos.x, z: J.pos.z });
    const vb = s.objetos.estacionesVisibles().find(e => e.id === hg);
    comprobar('lo deja en brasas y todos lo ven en brasas, sin llama', r.ok && vb.fuego.brasas && !vb.fuego.encendida, r.motivo || JSON.stringify(vb && vb.fuego));
    r = await J.objeto({ tipo: 'fabricar', receta: 'lanza_endurecida', estacion: hg, x: J.pos.x, z: J.pos.z });
    comprobar('con brasas no se hace nada al fuego', !r.ok, r.motivo);
    r = await J.objeto({ tipo: 'encender_fuego', estacion: hg, x: J.pos.x, z: J.pos.z });
    comprobar('y lo aviva sin gastar yesca: vuelve la llama', r.ok && J.cuantos('yesca') === yescas2 - 1 && s.objetos.estacionesVisibles().find(e => e.id === hg).fuego.encendida, r.motivo);
  }
  }

  // P4, comer: el arbusto de bayas más cercano (lo que se recoge alrededor de donde está), coge las bayas con las
  // manos y se come una; el arbusto ya no da más hasta que vuelvan
  {
    const aqui = { x0: O.x + J.pos.x - 150, z0: O.z + J.pos.z - 150, x1: O.x + J.pos.x + 150, z1: O.z + J.pos.z + 150 };
    const matas = cerca(recogidaEn(T.paisaje, T.alt, T.semilla, aqui).filter(p => p.tipo === 'bayas').map(p => ({ id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) })), J.pos);
    comprobar('hay un arbusto de bayas a menos de 150 m', matas.length > 0, `${matas.length}`);
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    let r = await recoger(matas[0]);
    comprobar('coge las bayas del arbusto con las manos (de 3 a 6)', r.ok && J.cuantos('bayas') >= 3 && J.cuantos('bayas') <= 6, r.motivo || `${J.cuantos('bayas')} bayas`);
    comprobar('y el arbusto ya no tiene bayas', !s.objetos.recoleccion.disponible(matas[0].id, Date.now()));
    r = await recoger(matas[0]);
    comprobar('otra vez, no', !r.ok, r.motivo);
    const hambreAntes = J.nec.hambre, n0 = J.cuantos('bayas');
    r = await J.objeto({ tipo: 'comer', objeto: 'bayas' });
    await pausa(300);
    comprobar('se come una: el hambre baja y le queda una menos', r.ok && J.nec.hambre < hambreAntes && J.cuantos('bayas') === n0 - 1, `${r.motivo || ''} hambre ${hambreAntes} → ${J.nec.hambre}, bayas ${n0} → ${J.cuantos('bayas')}`);
  }

  // P3, desbrozar (valravnx, 8 nov): vuelve a coger el hacha de piedra que dejó en el suelo, va al matorral más cercano
  // (de los de la vegetación, como los ve el navegador), lo desbroza y se lleva las ramas que deja en el suelo
  {
    const so = (t) => s.objetos.suelo.objetos.filter(o => o.cosa.tipo === t);
    // (las bayas que le quedan, al suelo: una mano para el hacha y otra para las ramas)
    for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
    const hacha = cerca(so('hacha_piedra'), J.pos)[0];
    comprobar('su hacha de piedra sigue en el suelo donde la dejó', !!hacha);
    if (hacha) { await J.andar(hacha.x + 0.3, hacha.z); await J.objeto({ tipo: 'coger_suelo', objeto: hacha.id, x: J.pos.x, z: J.pos.z }); }
    comprobar('y la vuelve a coger', J.cuantos('hacha_piedra') === 1);
    const R = 60, v = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + J.pos.x - R, z0: O.z + J.pos.z - R, x1: O.x + J.pos.x + R, z1: O.z + J.pos.z + R }, { x: O.x + J.pos.x, z: O.z + J.pos.z, r: R });
    const matas = cerca(v.matas.map(e => ({ x: r2(e.x - O.x), z: r2(e.z - O.z) })).filter(e => Math.hypot(e.x, e.z - 2) >= 3), J.pos);
    comprobar('hay un matorral a menos de 60 m', matas.length > 0, `${matas.length}`);
    const m = matas[0], id = m && idMata(m.x, m.z);
    if (m) {
      await J.andar(m.x + 0.6, m.z);
      const r0 = so('rama').filter(o => Math.hypot(o.x - m.x, o.z - m.z) < 1).reduce((n, o) => n + o.cosa.n, 0);
      let r = await J.objeto({ tipo: 'desbrozar', punto: id, x: J.pos.x, z: J.pos.z, px: m.x, pz: m.z, clase: 'matorral' });
      const caidas = so('rama').filter(o => Math.hypot(o.x - m.x, o.z - m.z) < 1);
      const nr = caidas.reduce((n, o) => n + o.cosa.n, 0) - r0;
      comprobar('desbroza el matorral con el hacha de piedra: caen de 2 a 4 ramas donde estaba', r.ok && nr >= 2 && nr <= 4, r.motivo || `${nr} ramas`);
      comprobar('y el matorral queda quitado (en lo que reparte el servidor)', !!s.objetos.recoleccionVisible().estado[id]?.quitado);
      r = await J.objeto({ tipo: 'desbrozar', punto: id, x: J.pos.x, z: J.pos.z, px: m.x, pz: m.z, clase: 'matorral' });
      comprobar('otra vez, no: hasta que rebrote', !r.ok, r.motivo);
      const antes = J.cuantos('rama');
      for (const o of caidas) await J.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J.pos.x, z: J.pos.z });
      comprobar('y se lleva las ramas', J.cuantos('rama') >= antes + nr, `${antes} → ${J.cuantos('rama')}`);
    }
  }

  // P3, el mazo de piedra y romper rocas (valravnx, 8 nov): con las manos se hace un mazo (1 piedra, 1 rama de las del
  // matorral y 2 cordeles de fibra que arranca), va a la roca mediana más cercana (de las de la vegetación, como las ve el
  // navegador), la rompe a golpes de mazo, cada golpe por el servidor, y se lleva las piedras que deja
  {
    const so = (t) => s.objetos.suelo.objetos.filter(o => o.cosa.tipo === t), yo = J.bienvenida.autor;
    const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola)]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
    const vaciarManos = async () => { for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z }); };
    const sitio = { ...J.pos };
    await vaciarManos();   // (las ramas del matorral y el hacha, a sus pies: de ahí también se fabrica)
    const aqui = { x0: O.x + sitio.x - 150, z0: O.z + sitio.z - 150, x1: O.x + sitio.x + 150, z1: O.z + sitio.z + 150 };
    const pts = recogidaEn(T.paisaje, T.alt, T.semilla, aqui).map(p => ({ id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) }))
      .filter(p => s.objetos.recoleccion.disponible(p.id, Date.now()) || !s.objetos.recoleccion.porId.has(p.id));
    // una piedra suelta (si no tiene ya una a mano)
    if (!so('piedra').some(o => Math.hypot(o.x - sitio.x, o.z - sitio.z) < 1.5)) {
      const pd = cerca(pts.filter(p => p.tipo === 'piedra'), sitio);
      let r = { ok: false };
      for (let k = 0; k < pd.length && !r.ok && k < 6; k++) r = await recoger(pd[k]);
      await J.andar(sitio.x, sitio.z); await vaciarManos();
      comprobar('recoge una piedra suelta y la deja con lo demás', r.ok, r.motivo);
    }
    // dos cordeles: 3 de fibra cada uno
    const fib = cerca(pts.filter(p => p.tipo === 'ortiga' || p.tipo === 'hierba_larga'), sitio);
    let hechos = 0, k = 0;
    for (let v = 0; v < 2; v++) {
      while (J.cuantos('fibra') < 3 && k < fib.length && k < 12) await recoger(fib[k++]);
      await J.andar(sitio.x, sitio.z);
      if (J.cuantos('fibra') > 3) { const rf = ['mano:der', 'mano:izq'].find(l => J.inv.lugares[l]?.tipo === 'fibra'); await J.objeto({ tipo: 'soltar_suelo', de: rf, cantidad: J.cuantos('fibra') - 3, x: J.pos.x, z: J.pos.z }); }
      const r = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
      adelantar();
      const rr = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
      if (r.ok && rr.ok) hechos++;
      await vaciarManos();
    }
    comprobar('arranca fibra y hace dos cordeles', hechos === 2, `${hechos}`);
    let r = await J.objeto({ tipo: 'fabricar', receta: 'mazo_piedra', x: J.pos.x, z: J.pos.z });
    adelantar();
    const rm = await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
    comprobar('con las manos se hace el mazo de piedra (1 piedra, 1 rama y 2 cordeles, de lo que tiene a sus pies)', r.ok && rm.ok && J.cuantos('mazo_piedra') === 1, `${r.motivo || ''} ${rm.motivo || ''}`);
    // la roca mediana más cercana, como la ve el navegador (sin los cantos del río ni las grandes)
    const R = 150, v = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + sitio.x - R, z0: O.z + sitio.z - R, x1: O.x + sitio.x + R, z1: O.z + sitio.z + R });
    const rocas = cerca(v.piedras.filter(e => !e.canto && rompible(e.tam)).map(e => ({ x: e.x - O.x, z: e.z - O.z, tam: e.tam })).filter(e => Math.hypot(e.x, e.z - 2) >= 3), sitio);
    comprobar('hay una roca mediana a menos de 150 m', rocas.length > 0, `${rocas.length}`);
    const roca = rocas[0];
    if (roca && J.cuantos('mazo_piedra') === 1) {
      const id = idRoca(roca.x, roca.z), px = r2(roca.x), pz = r2(roca.z);
      await J.andar(roca.x + roca.tam * 1.1 + 0.5, roca.z);
      const golpe = () => J.objeto({ tipo: 'romper', punto: id, x: J.pos.x, z: J.pos.z, px, pz, clase: 'roca', tam: roca.tam });
      let g = 0; const c0 = J.nec ? J.nec.cansancio : 0;
      do { r = await golpe(); g++; if (r.ok && !r.datos?.rota) await pausa(650); } while (r.ok && !r.datos?.rota && g < 60);
      const caidas = so('piedra').filter(o => Math.hypot(o.x - roca.x, o.z - roca.z) < 0.5);
      const np = caidas.reduce((n, o) => n + o.cosa.n, 0);
      comprobar('rompe la roca a golpes de mazo, cada golpe por el servidor (más golpes cuanto más grande)', r.ok && r.datos?.rota && g === golpesRoca(roca.tam), `${r.motivo || ''} ${g} golpes de ${golpesRoca(roca.tam)}`);
      comprobar('y deja sus piedras sueltas donde estaba (de 6 a 25, según su tamaño)', np === piedrasRoca(roca.tam), `${np} de ${piedrasRoca(roca.tam)}`);
      comprobar('la roca queda rota (en lo que reparte el servidor)', !!s.objetos.recoleccionVisible().estado[id]?.quitado);
      await pausa(300);
      comprobar('romper cansa (o ya llega al máximo, tras todo el día)', J.nec && (J.nec.cansancio > c0 || c0 >= 99), `${c0} → ${J.nec && J.nec.cansancio}`);
      r = await golpe();
      comprobar('otra vez, no: solo quedan cascotes', !r.ok, r.motivo);
      const antes = J.cuantos('piedra');
      if (caidas[0]) r = await J.objeto({ tipo: 'coger_suelo', objeto: caidas[0].id, x: J.pos.x, z: J.pos.z });
      comprobar('y se lleva las piedras que le caben', J.cuantos('piedra') > antes, `${r.motivo || ''} ${antes} → ${J.cuantos('piedra')}`);
    }
  }

  // P3, el mimbre y la corteza (8 nov): con su lasca de sílex corta las varas de la mimbrera más cercana de la ribera y
  // descorteza un árbol en pie (la resina, en TODAVIA_NO: los pinos quedan lejos)
  {
    const vaciar = async () => { for (const l of ['mano:der', 'mano:izq']) if (J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'lasca_silex') await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z }); };
    await vaciar();
    if (!J.cuantos('lasca_silex')) {
      const l = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'lasca_silex'), J.pos)[0];
      if (l) { await J.andar(l.x + 0.3, l.z); await J.objeto({ tipo: 'coger_suelo', objeto: l.id, x: J.pos.x, z: J.pos.z }); }
    }
    comprobar('lleva su lasca de sílex', J.cuantos('lasca_silex') >= 1);
    // el río más cercano (como en el paso 11), y las mimbreras de su ribera
    let rio = null;
    for (let r = 0; r < 3000 && !rio; r += 25) for (let k = 0; k < 96; k++) {
      const x = J.pos.x + Math.cos(k / 96 * 2 * Math.PI) * r, z = J.pos.z + Math.sin(k / 96 * 2 * Math.PI) * r, X = x + O.x, Z = z + O.z;
      const { dm, ancho } = T.paisaje.rioCerca(X, Z, T.paisaje.riosEn(X - 20, Z - 20, X + 20, Z + 20));
      if (dm - ancho / 2 < 4 && T.alt(X, Z) > 0.5) { rio = { x, z, r }; break; }
    }
    const R = 150, aqui = rio && { x0: O.x + rio.x - R, z0: O.z + rio.z - R, x1: O.x + rio.x + R, z1: O.z + rio.z + R };
    const mimbres = rio ? cerca(recogidaEn(T.paisaje, T.alt, T.semilla, aqui).filter(p => p.tipo === 'mimbre').map(p => ({ id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) })), rio) : [];
    comprobar('en la ribera del río más cercano hay mimbreras', mimbres.length > 0, rio ? `río a ${rio.r} m; ${mimbres.length} mimbreras` : 'sin río');
    if (mimbres[0]) {
      const r = await recoger(mimbres[0]);
      comprobar('corta con la lasca las varas de la mimbrera: un haz de mimbre', r.ok && J.cuantos('mimbre') === 1, r.motivo);
      await vaciar();
    }
    const v = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + J.pos.x - 60, z0: O.z + J.pos.z - 60, x1: O.x + J.pos.x + 60, z1: O.z + J.pos.z + 60 });
    const arbol = cerca(v.arboles.map(e => ({ x: e.x - O.x, z: e.z - O.z, edad: e.edad, especie: e.especie })).filter(e => Math.hypot(e.x, e.z - 2) >= CLARO_ARBOLES && (!s.objetos.tala.porId.has(idArbol(e.x, e.z)) || s.objetos.tala.enPie(idArbol(e.x, e.z), Date.now()))), J.pos)[0];
    if (arbol) {
      await J.andar(arbol.x + 1, arbol.z);
      const r = await J.objeto({ tipo: 'descortezar', arbol: idArbol(arbol.x, arbol.z), x: J.pos.x, z: J.pos.z, ax: arbol.x, az: arbol.z, edad: arbol.edad, especie: arbol.especie });
      comprobar(`descorteza un ${arbol.especie} en pie: de 1 a 2 cortezas`, r.ok && J.cuantos('corteza') >= 1 && J.cuantos('corteza') <= 2, r.motivo);
      comprobar('y un roble o un haya no se sangra (no da resina)', CONIFERAS.has(arbol.especie) || !(await J.objeto({ tipo: 'sangrar', arbol: idArbol(arbol.x, arbol.z), x: J.pos.x, z: J.pos.z, ax: arbol.x, az: arbol.z, edad: arbol.edad, especie: arbol.especie })).ok);
    } else comprobar('hay un árbol en pie cerca', false);
  }

  // P4, las necesidades: a estas alturas del día, con todo lo que ha andado y trabajado, ya tiene algo de sed y de
  // hambre (la sed, más), sin que nadie se las haya puesto: le llegan solas del servidor
  // (la sed, que bebió en el río, vuelve a subir desde ahí)
  comprobar('le han subido solas la sed y el hambre y le llegan del servidor', J.nec && J.nec.sed > 0 && J.nec.hambre > 0, JSON.stringify(J.nec));
  // sus avisos (los círculos de la derecha, src/juego/avisos_necesidades.js) salen de esos números: desde 40; a esta
  // hora del día (la sed sube a 40 en 24 minutos), aún ninguno; la prueba de navegador de los avisos mira cómo se ven
  const susAvisos = avisos(J.nec).map(a => a.que).filter(q => q !== 'cansancio');
  comprobar('sus avisos salen de lo que manda el servidor: con la sed y el hambre por debajo de 40, aún ninguno de los dos', J.nec.sed < AVISO ? susAvisos.length === 0 : susAvisos.includes('sed'), `${JSON.stringify(J.nec)} → ${susAvisos.join(',') || 'ninguno'}`);

  // 16k (8 nov, con la tarea de morir): a estas alturas del día tiene la sed al máximo y, sin beber, se moriría
  // (src/logica/muerte.js): va al agua más cercana y bebe, como haría un jugador, y vuelve
  console.log('16k. Con la sed al máximo, va a beber al agua más cercana y vuelve');
  {
    const desde = { ...J.pos };
    let agua = null;
    for (let d = 5; d <= 1500 && !agua; d += 5) for (let k = 0; k < 48 && !agua; k++) {
      const x = desde.x + Math.cos(k / 48 * 2 * Math.PI) * d, z = desde.z + Math.sin(k / 48 * 2 * Math.PI) * d;
      if (!T.aguaEn(x, z) && hayAguaCerca(T.aguaEn, x, z)) agua = { x: r2(x), z: r2(z) };
    }
    comprobar('hay agua a menos de 1,5 km', !!agua, agua ? `a ${Math.round(Math.hypot(agua.x - desde.x, agua.z - desde.z))} m` : '');
    if (agua) {
      await J.andar(agua.x, agua.z);
      const sedAntes = J.nec.sed;
      for (let i = 0; i < 8 && J.nec.sed > 10; i++) { await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z }); await pausa(1600); }
      comprobar('bebe hasta quitarse la sed', J.nec.sed <= 40, `sed ${sedAntes} → ${J.nec.sed}`);
      await J.andar(desde.x, desde.z);
    }
  }

  // P4, la cama ligada (valravnx, 8 nov: «ambas viables»): un refugio de ramas fuera, en su tierra (12 ramas del bosque
  // y 4 cordeles de fibra), lo liga y duerme en él (el cansancio baja deprisa); luego va al río a por juncos, hace una
  // cama de juncos dentro de su casa (8 haces y 2 cordeles) y la liga: el refugio deja de ser su cama
  console.log('17. La cama ligada: un refugio de ramas en su tierra, lo liga y duerme; luego una cama de juncos en su casa, y la liga');
  {
    const yo = J.bienvenida.autor, manos = ['mano:der', 'mano:izq'];
    const enMano = () => manos.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
    const soltarManos = async () => { for (const l of manos) if (J.inv.lugares[l]) await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z }); };
    const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola)]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
    const mj = s.mundo.mojonDe(yo), C = { x: r2(mj.x + 10), z: r2(mj.z - 10) };
    const alrededor = (p, d) => recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - d, z0: O.z + p.z - d, x1: O.x + p.x + d, z1: O.z + p.z + d })
      .map(q => ({ id: q.id, tipo: q.tipo, x: r2(q.x - O.x), z: r2(q.z - O.z) }));
    const probados = new Set();
    const libres = (lista, tipos) => cerca(lista.filter(q => tipos.includes(q.tipo) && !probados.has(q.id)), J.pos);   // (lo ya recogido lo dice el servidor al intentarlo)
    const enPila = (tipo, p) => s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === tipo && Math.hypot(o.x - p.x, o.z - p.z) < 1).reduce((n, o) => n + o.cosa.n, 0);
    // lo que lleva, a la pila (a sus pies, en p)
    const aLaPila = async (p) => { await J.andar(p.x, p.z); await soltarManos(); };
    // n cordeles a la pila de p: fibra de las plantas de alrededor (3 por cordel), con las manos, uno a uno
    const cordelesA = async (p, n) => {
      const plantas = alrededor(p, 150);
      for (let k = 0; k < n + 3 && enPila('cordel', p) < n; k++) {
        for (const q of libres(plantas, ['ortiga', 'hierba_larga'])) { if (J.cuantos('fibra') >= 3) break; probados.add(q.id); await recoger(q); }
        const rc = await J.objeto({ tipo: 'fabricar', receta: 'cordel', x: J.pos.x, z: J.pos.z });
        if (!rc.ok) continue;
        adelantar(); await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z });
        const sobra = manos.find(l => J.inv.lugares[l]?.tipo === 'fibra');
        if (sobra) await J.objeto({ tipo: 'soltar_suelo', de: sobra, x: J.pos.x, z: J.pos.z });
        await J.andar(p.x, p.z);
        const lc = manos.find(l => J.inv.lugares[l]?.tipo === 'cordel');
        if (lc) await J.objeto({ tipo: 'soltar_suelo', de: lc, x: J.pos.x, z: J.pos.z });
        else { const so = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'cordel' && Math.hypot(o.x - p.x, o.z - p.z) > 1), J.pos)[0]; if (so) { await J.andar(so.x + 0.3, so.z); await J.objeto({ tipo: 'coger_suelo', objeto: so.id, cantidad: 1, a: 'mano:der', x: J.pos.x, z: J.pos.z }); await J.andar(p.x, p.z); await J.objeto({ tipo: 'soltar_suelo', de: 'mano:der', x: J.pos.x, z: J.pos.z }); } }
      }
      return enPila('cordel', p);
    };

    // 17a. el refugio de ramas, fuera de la casa y en su tierra
    const S = { x: r2(C.x + 7), z: C.z };
    comprobar('el sitio del refugio es de su tierra y está fuera (no bajo techo)', s.mundo.dentroDeTierra(S.x, S.z, yo) && !s.mundo.bajoTecho(S.x, S.z), JSON.stringify(S));
    await aLaPila(S);
    const bosque = alrededor(S, 150);
    for (let v = 0; v < 12 && enPila('rama', S) < 12; v++) {
      for (const q of libres(bosque, ['ramas'])) { if (J.cuantos('rama') >= 6 || enPila('rama', S) + J.cuantos('rama') >= 12) break; probados.add(q.id); await recoger(q); }
      await aLaPila(S);
    }
    comprobar('recoge 12 ramas caídas del bosque y las amontona en el sitio (en viajes de 6, las que le caben en las manos)', enPila('rama', S) >= 12, `${enPila('rama', S)} ramas · ${libres(bosque, ['ramas']).length} sin probar`);
    const nc = await cordelesA(S, 4);
    comprobar('y se hace 4 cordeles con la fibra de las plantas de alrededor', nc >= 4, `${nc} cordeles · ${enMano()}`);
    await J.andar(S.x, S.z);
    let r = await ponerPuesto('refugio_ramas', S.x + 1.2, S.z);
    const refugio = r.id;
    comprobar('pone el marco del refugio, le lleva las ramas y los cordeles del suelo de al lado y lo levanta', r.ok && r.datos?.terminada && !s.objetos.fab.estaciones[refugio]?.obra, r.motivo || JSON.stringify(r.entrega?.datos));
    r = await J.objeto({ tipo: 'dormir', estacion: refugio, x: J.pos.x, z: J.pos.z });
    comprobar('sin ligarlo, no duerme en él', !r.ok && /ligada/.test(r.motivo || ''), r.motivo);
    r = await J.objeto({ tipo: 'ligar_cama', estacion: refugio, x: J.pos.x, z: J.pos.z });
    comprobar('lo liga: ya es su cama (donde reaparecerá)', r.ok && s.objetos.fab.camaDe(yo) === refugio, r.motivo);
    comprobar('y lo que reparte el servidor de las estaciones dice que es la suya (el navegador lo mira para dormir)', (s.objetos.estacionesVisibles().find(e => e.id === refugio)?.ligadas || []).includes(yo));
    J.estar(S.x, S.z); await pausa(1500);
    const c0 = J.nec.cansancio;
    r = await J.objeto({ tipo: 'dormir', estacion: refugio, x: J.pos.x, z: J.pos.z });
    // tumbado en el refugio: el navegador dice «dormir» en su estado (como la demo mientras duerme)
    const fr = s.objetos.fab.estaciones[refugio];
    for (let k = 0; k < 10; k++) { J.pos = { x: fr.x, z: fr.z }; J.ws.send(JSON.stringify({ tipo: 'estado', x: fr.x, y: T.suelo(fr.x, fr.z), z: fr.z, giro: 0, anim: 'dormir' })); await pausa(500); }
    // (con la sed, el hambre o el frío al máximo se descansa a la mitad: src/logica/necesidades.js)
    const k = ['hambre', 'sed', 'frio'].some(q => J.nec[q] >= 100) ? 2 : 1, espera = Math.max(0, c0 - 0.8 * 5 * RITMOS.dormir / k);
    comprobar('duerme en él y el cansancio baja deprisa (en 5 s, casi lo que dice dormir; quieto bajaría 4 veces menos)', r.ok && J.nec.cansancio <= espera && RITMOS.dormir >= 3 * RITMOS.quieto, `${r.motivo || ''} cansancio ${c0} → ${J.nec.cansancio} (como mucho ${espera.toFixed(2)})`);

    // 17b. la cama de juncos, dentro de su casa: los juncos, del río (con la lasca; a las manos y al fardo)
    let rio = null;
    for (let d = 0; d < 3000 && !rio; d += 25) for (let k = 0; k < 96; k++) {
      const x = Math.cos(k / 96 * 2 * Math.PI) * d, z = Math.sin(k / 96 * 2 * Math.PI) * d, X = x + O.x, Z = z + O.z;
      const { dm, ancho } = T.paisaje.rioCerca(X, Z, T.paisaje.riosEn(X - 20, Z - 20, X + 20, Z + 20));
      if (dm - ancho / 2 < 4 && T.alt(X, Z) > 0.5) { rio = { x, z }; break; }
    }
    await J.andar(S.x - 1, S.z);   // se levanta (al moverse deja de dormir)
    if (!J.cuantos('lasca_silex')) {
      const l = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'lasca_silex'), J.pos)[0];
      if (l) { await J.andar(l.x + 0.3, l.z); await soltarManos(); await J.objeto({ tipo: 'coger_suelo', objeto: l.id, cantidad: 1, a: J.inv.lugares.cintura?.huecos || J.inv.lugares.cintura ? 'cintura/0' : 'mano:der', x: J.pos.x, z: J.pos.z }); }
    }
    comprobar('lleva su lasca de sílex para cortar juncos', J.cuantos('lasca_silex') >= 1, enMano());
    const ribera = alrededor(rio, 500);   // (los juncos de al lado ya los cortó para el tejado: vuelven en una estación)
    await J.andar(rio.x, rio.z);
    const enFardo = () => (J.inv.lugares.espalda?.dentro || []).filter(Boolean).filter(c => c.tipo === 'junco').reduce((t, c) => t + c.n, 0);
    for (const q of libres(ribera, ['juncos'])) {
      if (J.cuantos('junco') >= 8) break;
      probados.add(q.id);
      const c = await recoger(q);
      if (!c.ok) continue;
      // al fardo lo que quepa (a la espalda; 3 haces por hueco)
      const lj = manos.find(l => J.inv.lugares[l]?.tipo === 'junco');
      const hueco = [0, 1, 2, 3].find(n => J.inv.lugares.espalda?.tipo === 'fardo' && (!J.inv.lugares.espalda.dentro?.[n] || (J.inv.lugares.espalda.dentro[n].tipo === 'junco' && J.inv.lugares.espalda.dentro[n].n < 3)));
      if (lj && hueco !== undefined) await J.objeto({ tipo: 'mover', de: lj, a: `espalda/${hueco}` });
    }
    comprobar('corta al menos 8 haces de juncos en el río (en las manos y en el fardo)', J.cuantos('junco') >= 8, `${J.cuantos('junco')} haces · en el fardo ${enFardo()} · ${enMano()}`);
    const D = { x: r2(C.x - 0.4), z: C.z };   // dentro de la casa
    comprobar('dentro de su casa está bajo techo', s.mundo.bajoTecho(D.x, D.z));
    await J.andar(D.x, D.z);
    await soltarManos();
    const motivosJunco = [];
    for (let n = 0; n < 4; n++) { const c = J.inv.lugares.espalda?.dentro?.[n]; if (c && c.tipo === 'junco') { const m1 = await J.objeto({ tipo: 'mover', de: `espalda/${n}`, a: 'mano:der' }); const m2 = await J.objeto({ tipo: 'soltar_suelo', de: 'mano:der', x: J.pos.x, z: J.pos.z }); for (const m of [m1, m2]) if (!m.ok) motivosJunco.push(m.motivo); } }
    comprobar('deja los juncos en el suelo de su casa', enPila('junco', D) >= 8, `${enPila('junco', D)} · ${enMano()} · ${[...new Set(motivosJunco)].join('; ')} · hombro: ${J.inv.lugares.hombro?.tipo || '–'}`);
    const nc2 = await cordelesA(D, 2);
    comprobar('y le trae 2 cordeles de fibra', nc2 >= 2, `${nc2} cordeles`);
    await J.andar(D.x, D.z);
    r = await ponerPuesto('cama_juncos', r2(C.x + 0.5), C.z);
    const cama = r.id;
    comprobar('pone dentro la cama de juncos y la levanta con lo que hay en el suelo', r.ok && !s.objetos.fab.estaciones[cama]?.obra, r.motivo || JSON.stringify(r.entrega?.datos));
    r = await J.objeto({ tipo: 'ligar_cama', estacion: cama, x: J.pos.x, z: J.pos.z });
    comprobar('la liga: ya es su cama, y el refugio deja de serlo (una por personaje)', r.ok && s.objetos.fab.camaDe(yo) === cama && !s.objetos.fab.estaciones[refugio].ligadas, r.motivo);
    r = await J.objeto({ tipo: 'dormir', estacion: cama, x: J.pos.x, z: J.pos.z });
    comprobar('y duerme en ella', r.ok, r.motivo);
    await J.andar(D.x - 0.8, D.z);
    // desconectarse (GDD, apartado 6; src/logica/dormidos.js): sale del juego en su casa, en su tierra; se queda dormido,
    // protegido desde el primer momento, y pasa a su cama ligada; al volver con su ficha, despierta en ella
    const ficha = J.bienvenida.ficha, enCama = s.objetos.fab.estaciones[cama];
    J.ws.close(); await pausa(400);
    const dz = s.dormidos.de(yo);
    comprobar('sale del juego en su casa: se queda dormido en su cama, protegido (fuera del combate)', !!dz && dz.enCama && Math.hypot(dz.x - enCama.x, dz.z - enCama.z) < 0.01 && !s.dormidos.atacable(yo, Date.now()) && !s.combate.luchadores[yo], JSON.stringify(dz));
    const J2 = await cliente(puerto, ficha);
    const pv = J2.bienvenida.posicion;
    comprobar('al volver, es él y despierta en su cama', J2.bienvenida.autor === yo && !s.dormidos.esta(yo) && !!pv && Math.hypot(pv.x - enCama.x, pv.z - enCama.z) < 0.01, JSON.stringify(pv));

    // 18. Morir y que te saqueen (P4; src/logica/muerte.js): sale de casa y se olvida de beber; con la sed al máximo
    // pierde sangre y se muere de sed. Vuelve a su cama; su cuerpo queda donde cayó con la mitad de lo que llevaba, y
    // va a por ello. (Para no esperar los 20 minutos de la sed: la sed a tope y la sangre casi agotada, ya en el servidor.)
    console.log('18. Muere de sed: vuelve a su cama y recupera lo suyo del cuerpo');
    J2.pos = { x: pv.x, z: pv.z };
    await J2.andar(D.x - 0.8, D.z); await J2.andar(D.x - 6, D.z);
    const llevaba = despojar(Inventario.importarJugador(s.objetos.inventarioDe(yo))).reduce((t, c) => t + c.n, 0);
    const sueloAntes = new Set(s.objetos.suelo.objetos.map(o => o.id));
    s.necesidades.set(yo, { ...s.necesidades.get(yo), sed: 100 });
    s.combate.luchadores[yo].sangre = 0.3;
    const muerte = await J2.esperar(m => m.tipo === 'muerte', 20000).catch(() => null);
    comprobar('sin beber, se muere de sed (lo decide el servidor)', !!muerte && muerte.motivo === MOTIVOS.sed, JSON.stringify(muerte && muerte.motivo));
    comprobar('y vuelve a su cama ligada, sano', !!muerte && muerte.enCama && Math.hypot(muerte.posicion.x - enCama.x, muerte.posicion.z - enCama.z) < 0.01 && s.combate.luchadores[yo].sangre === 100, JSON.stringify(muerte && muerte.posicion));
    const cuerpo = s.cuerpos.todos().find(c => c.autor === yo);
    comprobar('su cuerpo queda donde cayó', !!cuerpo && Math.hypot(cuerpo.x - (D.x - 6), cuerpo.z - D.z) < 0.5, JSON.stringify(cuerpo && [cuerpo.x, cuerpo.z]));
    const suyos = s.objetos.suelo.objetos.filter(o => !sueloAntes.has(o.id) && o.autor === yo);
    const quedan = suyos.reduce((t, o) => t + o.cosa.n, 0);
    comprobar('con la mitad de lo que llevaba alrededor (la otra mitad se rompe)', quedan === Math.floor(llevaba / 2) || quedan === Math.ceil(llevaba / 2), `${quedan} de ${llevaba}`);
    // vuelve a por ello: de la cama al cuerpo, y lo coge (lo que cabe, donde quepa)
    J2.pos = { x: muerte.posicion.x, z: muerte.posicion.z };
    await J2.andar(D.x - 0.8, D.z); await J2.andar(cuerpo.x + 0.4, cuerpo.z);
    let cogidos = 0;
    const huecos = ['ropa:interior', 'ropa:piernas', 'ropa:abrigo', 'ropa:exterior', 'ropa:sobre', 'ropa:cabeza', 'ropa:guantes', 'ropa:pies', 'espalda', 'cintura', 'hombro', 'mano:der', 'mano:izq'];
    for (const o of suyos) {
      for (const a of huecos) {
        const rr = await J2.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J2.pos.x, z: J2.pos.z, a });
        if (rr.ok) { cogidos++; break; }
      }
    }
    comprobar('recupera lo suyo del cuerpo', cogidos > 0 && cogidos >= Math.min(suyos.length, 2), `${cogidos} de ${suyos.length} montones`);

    console.log('19. Ve liebres y huyen al acercarse');
    // P4, las liebres (9 nov; src/logica/fauna.js): ve liebres a su alrededor (las mueve el servidor) y, al ir hacia una,
    // huye y se aleja (al final del día, con lo suyo recuperado; luego vuelve a donde estaba)
    {
      const desde = { ...J2.pos };
      const ls = cerca([...J2.liebres.values()], J2.pos);
      comprobar('ve liebres a su alrededor (se las manda el servidor)', ls.length > 0, `${ls.length}`);
      if (ls.length) {
        const l = ls[0], d0 = Math.hypot(l.x - J2.pos.x, l.z - J2.pos.z), a = Math.atan2(J2.pos.x - l.x, J2.pos.z - l.z);
        await J2.andar(l.x + Math.sin(a) * 5, l.z + Math.cos(a) * 5);
        await pausa(1500 * RELOJ);   // (en tiempo de verdad: la liebre corre en el del servidor)
        const f = J2.liebres.get(l.id), d1 = f ? Math.hypot(f.x - J2.pos.x, f.z - J2.pos.z) : null;
        comprobar('va hacia la más cercana y huye, alejándose deprisa', J2.huyen.has(l.id) && f && d1 > 12, `a ${d0.toFixed(0)} m; huye: ${J2.huyen.has(l.id)}; ahora a ${d1 && d1.toFixed(1)} m`);
        await J2.andar(desde.x, desde.z);
      }
    }
    console.log('20. Vuelve a la hoguera de la orilla, recoge la lanza que hizo y caza una liebre');
    // P4, cazar (9 nov; src/logica/caza.js): recoge la lanza de la hoguera, la lleva en la mano, se acerca andando a una
    // liebre de la orilla hasta unos 16 m (se pone alerta y se queda quieta), se la lanza y el servidor decide que acierta:
    // la liebre cae muerta y la lanza a su lado. Las recoge y las deja junto a la hoguera (y luego la despieza y la asa).
    if (sitioCaza) {
      const { hog, fogon } = sitioCaza, yo = J2.bienvenida.autor;
      await J2.andar(fogon.x, fogon.z); await pausa(1000 * RELOJ);   // (le llegan las liebres de allí)
      for (const c of (s.objetos.fab.estaciones[hog]?.cola || [])) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1);
      // las manos libres: lo que lleve, a sus pies junto a la hoguera (luego lo vuelve a coger)
      const dejado = [];
      for (const l of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l]) { const q = await J2.objeto({ tipo: 'soltar_suelo', de: l, x: J2.pos.x, z: J2.pos.z }); if (q.ok) dejado.push({ id: q.datos.objeto, a: l }); }
      r = await J2.objeto({ tipo: 'recoger_fabricado', estacion: hog, x: J2.pos.x, z: J2.pos.z });
      const dondeLanza = ['mano:der', 'mano:izq'].find(l => J2.inv.lugares[l]?.tipo === 'lanza_endurecida');
      comprobar('recoge de la hoguera la lanza endurecida, en la mano', r.ok && dondeLanza, r.motivo || enMano());
      const desde = { ...J2.pos };
      // (las que tiene a tiro sin agua por medio: la lanza cae en la orilla)
      const seco = (p, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); for (let k = 0; k <= d; k++) if (T.aguaEn(p.x + (q.x - p.x) * k / d, p.z + (q.z - p.z) * k / d)) return false; return true; };
      const ls = cerca([...J2.liebres.values()], J2.pos).filter(l => seco(J2.pos, l));
      comprobar('ve liebres alrededor de la hoguera (sin agua por medio)', ls.length > 0, `${ls.length} de ${J2.liebres.size}`);
      if (ls.length && dondeLanza) {
        const l = ls[0], a = Math.atan2(J2.pos.x - l.x, J2.pos.z - l.z), d0 = Math.hypot(l.x - J2.pos.x, l.z - J2.pos.z);
        if (d0 > 16) await J2.andar(l.x + Math.sin(a) * 16, l.z + Math.cos(a) * 16);
        await pausa(1500 * RELOJ);   // quieto: la liebre se pone alerta y no se mueve (en tiempo de verdad: la fauna va en el del servidor)
        const v = J2.liebres.get(l.id) || l, dir = Math.atan2(v.x - J2.pos.x, v.z - J2.pos.z), dl = Math.hypot(v.x - J2.pos.x, v.z - J2.pos.z);
        r = await J2.objeto({ tipo: 'lanzar', de: dondeLanza, x: J2.pos.x, z: J2.pos.z, dir });
        comprobar('le lanza la lanza: sale de la mano', r.ok && !J2.inv.lugares[dondeLanza], r.motivo);
        await pausa(2000 * RELOJ);
        const muerta = s.objetos.suelo.objetos.find(o => o.cosa.tipo === 'liebre' && Math.hypot(o.x - v.x, o.z - v.z) < 3);
        const lanza = s.objetos.suelo.objetos.find(o => o.cosa.tipo === 'lanza_endurecida' && muerta && Math.hypot(o.x - muerta.x, o.z - muerta.z) < 1.2);
        comprobar('el servidor decide que acierta: la liebre cae muerta y la lanza a su lado', muerta && lanza && !s.fauna.de(l.id) && !J2.liebres.has(l.id), `a ${dl.toFixed(1)} m (${v.anim}); ${muerta ? 'liebre en el suelo' : 'sin liebre'}`);
        if (muerta && lanza) {
          await J2.andar(lanza.x, lanza.z);
          const c1 = await J2.objeto({ tipo: 'coger_suelo', objeto: lanza.id, x: J2.pos.x, z: J2.pos.z, a: 'mano:der' });
          const c2 = await J2.objeto({ tipo: 'coger_suelo', objeto: muerta.id, x: J2.pos.x, z: J2.pos.z, a: 'mano:izq' });
          comprobar('recoge la lanza y la liebre', c1.ok && c2.ok && J2.cuantos('liebre') === 1, `${c1.motivo || ''} ${c2.motivo || ''}`);
        }
        // de vuelta a la hoguera: deja la lanza y la liebre, y vuelve a coger lo suyo
        await J2.andar(desde.x, desde.z);
        for (const l2 of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l2]) await J2.objeto({ tipo: 'soltar_suelo', de: l2, x: J2.pos.x, z: J2.pos.z });
      }
      for (const d of dejado) await J2.objeto({ tipo: 'coger_suelo', objeto: d.id, x: J2.pos.x, z: J2.pos.z, a: d.a });

      // P4, despiezar y asar (9 nov; src/logica/comida.js): junto a la hoguera, despieza la liebre del suelo con la lasca
      // que lleva (carne cruda y una piel), deja la carne en la hoguera encendida, la asa, la recoge y se la come.
      console.log('21. Despieza la liebre con la lasca, asa la carne en la hoguera y se la come');
      const muertaAqui = s.objetos.suelo.objetos.find(o => o.cosa.tipo === 'liebre' && Math.hypot(o.x - J2.pos.x, o.z - J2.pos.z) < 2);
      if (muertaAqui) {
        // lo que hay para recoger a mano por aquí (sílex, piedra, ramas), como en el mundo
        const dist2 = (a) => Math.hypot(a.x - J2.pos.x, a.z - J2.pos.z);
        const aqui = recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + J2.pos.x - 120, z0: O.z + J2.pos.z - 120, x1: O.x + J2.pos.x + 120, z1: O.z + J2.pos.z + 120 }).map(p => ({ id: p.id, tipo: p.tipo, x: r2(p.x - O.x), z: r2(p.z - O.z) }));
        const recogerAqui = async (tipo, da) => { for (const p of cerca(aqui.filter(q => q.tipo === tipo), J2.pos).slice(0, 12)) { await J2.andar(p.x + 0.4, p.z); const q = await J2.objeto({ tipo: 'recoger', punto: p.id, x: J2.pos.x, z: J2.pos.z, px: p.x, pz: p.z, clase: p.tipo }); if (q.ok && J2.cuantos(da)) return true; } return false; };
        // traer algo: si no lo lleva, lo de su suelo más cercano; si no hay, se recoge de por aquí
        const traer = async (tipo, punto) => {
          if (J2.cuantos(tipo)) return true;
          const o = s.objetos.sueloVisible(Date.now()).filter(x => x.cosa.tipo === tipo).sort((a, b) => dist2(a) - dist2(b))[0];
          if (o && dist2(o) < 200) { await J2.andar(o.x + 0.3, o.z); await J2.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, x: J2.pos.x, z: J2.pos.z }); if (J2.cuantos(tipo)) return true; }
          return punto ? recogerAqui(punto, tipo) : false;
        };
        const manosLibres = async () => { for (const l of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l] && J2.inv.lugares[l].tipo !== 'lasca_silex') await J2.objeto({ tipo: 'soltar_suelo', de: l, x: J2.pos.x, z: J2.pos.z }); };
        // la lasca: la lleva desde que la talló (si no, la coge de su suelo; y si se le rompió al morir, se talla otra en
        // su piedra de tallar de la orilla, con un sílex y una piedra de por aquí)
        if (!J2.cuantos('lasca_silex')) { const o = s.objetos.sueloVisible(Date.now()).filter(x => x.cosa.tipo === 'lasca_silex').sort((a, b) => dist2(a) - dist2(b))[0]; if (o && dist2(o) < 150) { await J2.andar(o.x + 0.3, o.z); await J2.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J2.pos.x, z: J2.pos.z }); } }
        if (!J2.cuantos('lasca_silex')) {
          const pt = Object.values(s.objetos.fab.estaciones).filter(e => e.autor === yo && e.tipo === 'piedra_tallar' && !e.obra).sort((a, b) => dist2(a) - dist2(b))[0];
          const diag = [];   // (lo que pasa al traer y dejar cada cosa: para ver por qué falla, si falla)
          if (pt) {
            await manosLibres();
            for (const [tipo, da] of [['piedra', 'piedra'], ['silex', 'silex']]) {
              const tr = await traer(da, tipo);
              await J2.andar(pt.x + 1, pt.z);
              const l = J2.inv.rutasCon(da)[0];   // (en la mano o donde lo haya guardado)
              const rd = l ? await J2.objeto({ tipo: 'depositar_estacion', estacion: pt.id, de: l, cantidad: 1, x: J2.pos.x, z: J2.pos.z }) : { ok: false, motivo: 'no lo lleva' };
              diag.push(`${da}: traer ${tr}, lleva ${J2.cuantos(da)}, ruta ${l}, deja ${rd.ok || rd.motivo}`);
            }
            const rf = await J2.objeto({ tipo: 'fabricar', receta: 'lasca_silex', estacion: pt.id, x: J2.pos.x, z: J2.pos.z });
            for (const c of pt.cola) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1);
            const rr = await J2.objeto({ tipo: 'recoger_fabricado', estacion: pt.id, x: J2.pos.x, z: J2.pos.z });
            comprobar('se le rompió la lasca al morir: talla otra en su piedra de tallar', rf.ok && rr.ok && J2.cuantos('lasca_silex') === 1, `${rf.motivo || ''} ${rr.motivo || ''} · ${diag.join(' · ')} · a ${Math.round(dist2(pt))} m de la piedra de tallar`);
          }
        }
        await J2.andar(muertaAqui.x + 0.5, muertaAqui.z);
        r = await J2.objeto({ tipo: 'fabricar', receta: 'despiezar_liebre', x: J2.pos.x, z: J2.pos.z });
        comprobar('despieza con las manos la liebre del suelo, llevando la lasca', r.ok && !s.objetos.suelo.objetos.some(o => o.id === muertaAqui.id), r.motivo || `lasca: ${J2.cuantos('lasca_silex')}`);
        for (const c of (s.objetos.fab.manos[yo] || [])) c.fin = Math.min(c.fin, Date.now() - 1);   // (sus 30 s, ya pasados)
        r = await J2.objeto({ tipo: 'recoger_fabricado', x: J2.pos.x, z: J2.pos.z });
        // lo que no le cupo cae a sus pies: lo coge
        for (const t of ['carne_cruda', 'piel']) if (!J2.cuantos(t)) { const o = s.objetos.suelo.objetos.find(x => x.cosa.tipo === t && Math.hypot(x.x - J2.pos.x, x.z - J2.pos.z) < 2); const libre = ['mano:der', 'mano:izq'].find(l => !J2.inv.lugares[l]); if (o && t === 'carne_cruda' && !libre) { await J2.objeto({ tipo: 'soltar_suelo', de: 'mano:izq', x: J2.pos.x, z: J2.pos.z }); } if (o) await J2.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J2.pos.x, z: J2.pos.z }); }
        const carne = (() => { const ver = (c, ruta) => { if (!c) return null; if (c.tipo === 'carne_cruda') return { ruta, c }; for (const [i, x] of (c.dentro || []).entries()) { const y = ver(x, ruta + '/' + i); if (y) return y; } return null; }; for (const [l, c] of Object.entries(J2.inv.lugares)) { const y = ver(c, l); if (y) return y; } return null; })();
        const piel = J2.cuantos('piel') + s.objetos.suelo.objetos.filter(x => x.cosa.tipo === 'piel' && Math.hypot(x.x - J2.pos.x, x.z - J2.pos.z) < 2).length;
        comprobar('recoge la carne cruda, que se estropea con el tiempo (lleva hasta cuándo), y la piel', r.ok && carne && Number.isFinite(carne.c.hasta) && carne.c.hasta > Date.now() && piel >= 1, r.motivo || JSON.stringify(carne));
        // la hoguera, encendida (si se ha apagado desde que hizo la lanza, la vuelve a encender con su yesca y su taladro)
        const H2 = () => s.objetos.fab.estaciones[hog];
        await J2.andar(fogon.x, fogon.z);
        if (!(H2().fuego && H2().fuego.hasta > Date.now())) {
          // apagada y sin nada que arder: primero una rama (de por aquí), luego la enciende
          if (!(H2().fuego && H2().fuego.combustible > 0)) {
            await manosLibres();
            if (!J2.cuantos('rama')) await recogerAqui('ramas', 'rama');
            await J2.andar(fogon.x, fogon.z);
            const rr = await J2.objeto({ tipo: 'echar_fuego', estacion: hog, objeto: 'rama', x: J2.pos.x, z: J2.pos.z });
            comprobar('la hoguera se ha apagado y no le queda nada: le echa una rama de por aquí', rr.ok, rr.motivo);
          }
          // las manos libres (la carne y la lasca, a sus pies: luego las vuelve a coger) para el taladro y la yesca
          const aPies = [];
          for (const l of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l]) { const q = await J2.objeto({ tipo: 'soltar_suelo', de: l, x: J2.pos.x, z: J2.pos.z }); if (q.ok) aPies.push({ id: q.datos.objeto, x: J2.pos.x, z: J2.pos.z }); }
          const deMano = async (receta) => { const q = await J2.objeto({ tipo: 'fabricar', receta, x: J2.pos.x, z: J2.pos.z }); for (const c of (s.objetos.fab.manos[yo] || [])) c.fin = Math.min(c.fin, Date.now() - 1); const q2 = await J2.objeto({ tipo: 'recoger_fabricado', x: J2.pos.x, z: J2.pos.z }); return q.ok && q2.ok; };
          const soltarManosSalvo = async (no) => { for (const l of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l] && !no.includes(J2.inv.lugares[l].tipo)) await J2.objeto({ tipo: 'soltar_suelo', de: l, x: J2.pos.x, z: J2.pos.z }); };
          const soltarManos = async () => { for (const l of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l]) await J2.objeto({ tipo: 'soltar_suelo', de: l, x: J2.pos.x, z: J2.pos.z }); };
          for (const t of ['taladro_fuego', 'yesca']) if (!J2.cuantos(t)) { const o = s.objetos.sueloVisible(Date.now()).filter(x => x.cosa.tipo === t).sort((a, b) => dist2(a) - dist2(b))[0]; if (o && dist2(o) < 200) { await J2.andar(o.x + 0.3, o.z); await J2.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, x: J2.pos.x, z: J2.pos.z }); } }
          // si al morir se le rompieron, los vuelve a hacer con lo de por aquí: yesca de un hongo yesquero (o de fibra);
          // el taladro, con 2 ramas y un cordel de fibra, con las manos
          if (!J2.cuantos('yesca')) { await J2.andar(fogon.x, fogon.z); if (!(await recogerAqui('yesquero', 'yesca'))) { let n = 0; while (J2.cuantos('fibra') < 2 && n++ < 6) await recogerAqui(n % 2 ? 'ortiga' : 'hierba_larga', 'fibra'); await deMano('yesca'); } }
          if (!J2.cuantos('taladro_fuego')) {
            const lleva = ['mano:der', 'mano:izq'].map(l => J2.inv.lugares[l]?.tipo);
            await J2.andar(fogon.x + 1.5, fogon.z); const taller2 = { ...J2.pos };
            for (const l of ['mano:der', 'mano:izq']) if (J2.inv.lugares[l]) { const q = await J2.objeto({ tipo: 'soltar_suelo', de: l, x: J2.pos.x, z: J2.pos.z }); if (q.ok) aPies.push({ id: q.datos.objeto, x: J2.pos.x, z: J2.pos.z }); }
            let n = 0; while (J2.cuantos('fibra') < 3 && n++ < 8) await recogerAqui(n % 2 ? 'ortiga' : 'hierba_larga', 'fibra');
            await J2.andar(taller2.x, taller2.z); await soltarManos();
            n = 0; while (J2.cuantos('rama') < 2 && n++ < 4) await recogerAqui('ramas', 'rama');
            await J2.andar(taller2.x, taller2.z); await soltarManos();
            const hecho = (await deMano('cordel')) && (await soltarManos(), await deMano('taladro_fuego'));
            comprobar('se le rompió el taladro al morir: hace otro (2 ramas y un cordel de fibra)', hecho && J2.cuantos('taladro_fuego') === 1, `${lleva}`);
          }
          // (lo que soltó para hacer el taladro: la yesca y el taladro, a las manos)
          await J2.andar(fogon.x, fogon.z); await soltarManosSalvo(['taladro_fuego', 'yesca']);
          await traer('taladro_fuego'); await traer('yesca', 'yesquero');
          await J2.andar(fogon.x, fogon.z);
          const re = await J2.objeto({ tipo: 'encender_fuego', estacion: hog, x: J2.pos.x, z: J2.pos.z });
          comprobar('la hoguera se había apagado: la vuelve a encender', re.ok, re.motivo);
        }
        // lo que dejó a sus pies para encenderla (la carne, la lasca), lo vuelve a coger
        for (const o of s.objetos.sueloVisible(Date.now()).filter(x => ['carne_cruda', 'lasca_silex'].includes(x.cosa.tipo) && dist2(x) < 6)) {
          if (J2.cuantos(o.cosa.tipo)) continue;
          if (['mano:der', 'mano:izq'].every(l => J2.inv.lugares[l])) await J2.objeto({ tipo: 'soltar_suelo', de: J2.inv.lugares['mano:der'].tipo === 'carne_cruda' ? 'mano:izq' : 'mano:der', x: J2.pos.x, z: J2.pos.z });
          await J2.andar(o.x + 0.3, o.z); await J2.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J2.pos.x, z: J2.pos.z }); await J2.andar(fogon.x, fogon.z);
        }
        const carneYa = (() => { const ver = (c, ruta) => { if (!c) return null; if (c.tipo === 'carne_cruda') return { ruta, c }; for (const [i, x] of (c.dentro || []).entries()) { const y = ver(x, ruta + '/' + i); if (y) return y; } return null; }; for (const [l, c] of Object.entries(J2.inv.lugares)) { const y = ver(c, l); if (y) return y; } return null; })();
        if (carneYa) {
          r = await J2.objeto({ tipo: 'depositar_estacion', estacion: hog, de: carneYa.ruta, cantidad: 1, x: J2.pos.x, z: J2.pos.z });
          const ra = await J2.objeto({ tipo: 'fabricar', receta: 'asar_carne', estacion: hog, x: J2.pos.x, z: J2.pos.z });
          comprobar('deja la carne en la hoguera encendida y la asa', r.ok && ra.ok, `${r.motivo || ''} ${ra.motivo || ''}`);
          for (const c of (H2().cola || [])) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1);   // (sus 45 s, ya pasados)
          if (!['mano:der', 'mano:izq'].some(l => !J2.inv.lugares[l])) await J2.objeto({ tipo: 'soltar_suelo', de: 'mano:izq', x: J2.pos.x, z: J2.pos.z });
          r = await J2.objeto({ tipo: 'recoger_fabricado', estacion: hog, x: J2.pos.x, z: J2.pos.z });
          comprobar('recoge la carne asada', r.ok && J2.cuantos('carne_asada') === 1, r.motivo);
          const antes = (s.necesidades.get(yo) || { hambre: 0 }).hambre;
          r = await J2.objeto({ tipo: 'comer', objeto: 'carne_asada' });
          comprobar('se la come: le quita el hambre (más que cruda)', r.ok && J2.cuantos('carne_asada') === 0 && (antes === 0 || s.necesidades.get(yo).hambre < antes), `${r.motivo || ''} hambre ${antes} → ${(s.necesidades.get(yo) || {}).hambre}`);
        }
      } else comprobar('la liebre cazada está a sus pies, junto a la hoguera', false);
    }
    J2.ws.close();
  }

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
