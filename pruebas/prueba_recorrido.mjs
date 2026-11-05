// Recorrido de jugador (revisión del 1 nov: las cosas llegaban rotas porque nadie las jugaba como jugador).
// Un jugador nuevo, contra el servidor de verdad (servidor/servidor.mjs con el terreno de Whitholm y SIN el arcón de
// pruebas), juega de principio a fin lo que haya, con los mismos mensajes que manda la demo y solo con lo que recoge:
// empieza con lo puesto, anda hasta lo que se recoge, lo recoge, anda hasta la zona de al lado (la de la salida es del
// rey: no se reclama) y pone su mojón pagándolo con tres de las piedras que
// lleva, levanta un cimiento de piedra con las piedras que ha traído en las manos (en dos viajes), y lo trabaja hasta
// terminarlo. Falla si algo no se puede hacer así.
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
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// Lo que un jugador nuevo aún no puede hacer sin el arcón, con el porqué y lo que lo trae.
const TODAVIA_NO = {
  talar: 'un jugador nuevo no tiene hacha y aún no se fabrica nada: llega con «Fabricar por el servidor» (hito «De nada a una casa»)',
};

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
    c.andar = async (x, z) => {
      const { x: x0, z: z0 } = c.pos, d = Math.hypot(x - x0, z - z0), n = Math.max(1, Math.ceil(d / 0.6));
      for (let i = 1; i <= n; i++) { c.estar(x0 + (x - x0) * i / n, z0 + (z - z0) * i / n); await pausa(100); }
      await pausa(150);
    };
    c.cuantos = (tipo) => (c.inv ? c.inv.cuantos(tipo) : 0);
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if ((m.tipo === 'bienvenida' || m.tipo === 'inventario' || m.tipo === 'resultado_objeto') && m.inventario) c.inv = Inventario.importarJugador(m.inventario);
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
  .map(e => ({ x: e.x - O.x, z: e.z - O.z, edad: e.tam >= TAM_ADULTO ? 'adulto' : 'joven' }))
  .filter(e => Math.hypot(e.x, e.z - 2) >= CLARO_ARBOLES).map(e => ({ ...e, id: idArbol(e.x, e.z) }));

const dir = mkdtempSync(join(tmpdir(), 'kinhold-recorrido-'));
let s = null;
try {
  s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T, arconPruebas: false });
  const puerto = await s.listo, J = await cliente(puerto);
  // aparece en la salida (hoy la común; con «Salida al azar de verdad en línea», la que le dé el servidor)
  J.estar(0, 4); await pausa(200);

  console.log('1. Empieza con lo puesto, y sin arcón');
  const lugares = J.inv ? Object.entries(J.inv.lugares).filter(([, c]) => c).map(([l, c]) => `${l}=${c.tipo}`) : [];
  comprobar('le llega lo que lleva: solo la camisa y el pantalón de lino', lugares.length === 2 && lugares.join(' ').includes('camisa_lino') && lugares.join(' ').includes('pantalon_lino'), lugares.join(' '));
  let r = await J.objeto({ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' });
  comprobar('no puede sacar nada del arcón de pruebas (no hay)', !r.ok && J.cuantos('hacha_hierro') === 0, r.motivo);
  r = await J.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  comprobar('ni del arcón de materiales de las obras', !r.ok && J.cuantos('piedra') === 0, r.motivo);
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
  let cogidas = 0, motivos = [];
  for (const p of piedras.slice(0, 6)) { r = await recoger(p); if (r.ok) cogidas++; else motivos.push(r.motivo); }
  comprobar('recoge 6 piedras, 3 en cada mano', cogidas === 6 && J.cuantos('piedra') === 6, `${J.cuantos('piedra')} piedras ${motivos.slice(0, 2).join(' · ')}`);
  r = await recoger(piedras[6] || piedras[0]);
  comprobar('la séptima ya no le cabe en las manos', !r.ok && J.cuantos('piedra') === 6, r.motivo);
  r = await recoger(piedras[0]);
  comprobar('y una piedra ya recogida no vuelve a darse', !r.ok && /recogido/.test(r.motivo || ''), r.motivo);

  console.log('3. Lo que aún no se puede hacer como jugador nuevo');
  {
    // talar: el árbol joven más cercano, a su lado y con las manos como las tiene
    const a = cerca(arboles.filter(e => e.edad === 'joven'), J.pos)[0];
    await J.andar(a.x + 1, a.z);
    r = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad });
    comprobar(`talar: aún no se puede (${TODAVIA_NO.talar}); cuando se pueda, pasarlo a los pasos de verdad`, !r.ok, r.motivo);
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
    K.estar(0, 4); await pausa(200); await K.andar(sitio.x + 2, sitio.z + 1);   // aparece en la salida y va andando hasta ella
    const rk = await K.accion({ tipo: 'desmontar', construccion: obra?.id, clave });
    comprobar('otro jugador no puede desmontar su cimiento', !rk.ok && !!obra?.piezas.get(clave), rk.motivo);
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
