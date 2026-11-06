// La tierra vuelve al rey si no se usa (valravnx, 4 nov; src/logica/abandono.js). Ejecutar: node pruebas/prueba_tierra_al_rey.mjs
// Comprueba:
//   - lógica pura: con una pieza terminada el plazo es de 30 días, sin ninguna (o solo obras a medias) de 15; cuenta la
//     última entrada del dueño o de cualquiera de sus invitados; aviso a una semana y el último día, uno de cada; si entra
//     alguien, el plazo vuelve a empezar (y los avisos); pasado el plazo, a liberar; los de antes sin nada apuntado
//     empiezan a contar desde la primera revisión; se guarda y se recupera igual;
//   - la acción del rey: el mojón y los invitados se van, lo construido se queda como ruina que cualquiera desmonta, y la
//     zona se puede volver a reclamar; un jugador no puede hacerla; rehecho desde el registro da el mismo mundo;
//   - el servidor de verdad, por websocket y con la hora de la prueba: el aviso de la semana y el del último día llegan
//     al correo confirmado de la cuenta del dueño (una vez cada uno), el día 30 la tierra vuelve al rey, a los conectados
//     les llega la acción y su copia del mundo queda igual; todo en tierras.jsonl y en el mundo; tras reiniciar sigue
//     libre; entrar en el juego retrasa el plazo; un jugador que manda la acción del rey no consigue nada.
// Con MUTAR=1 el plazo no mira a los invitados: debe FALLAR. Con MUTAR=ruina, la tierra devuelta se lleva lo construido: también.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';
import { Abandono, DIA, DIAS, DIAS_SIN_OBRA, AUTOR_REY, tieneObraTerminada } from '../src/logica/abandono.js';
import { MundoEnLinea } from '../src/logica/en_linea.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR;
if (MUTAR === '1') Abandono.prototype.ultima = function (mundo, dueno) { return this.vistos[dueno]; };
if (MUTAR === 'ruina') Mundo.prototype.tierraAlRey = function (a) { const r = this.quitarMojon(a); return r.ok ? { ok: true, ruinas: { piezas: 0 } } : r; };
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const A = 'jugador:ana', B = 'jugador:bruno', C = 'jugador:carla';
const T0 = Date.UTC(2026, 10, 1);

ponerZonas((x, z) => `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`);
// Ana: mojón en (500, 500) con un cimiento terminado; Bruno, mojón lejos con solo una obra a medias
function montar() {
  const m = new Mundo(), reg = new RegistroAcciones();
  const E = (autor, a) => { const r = ejecutar(m, reg, { autor, ...a }); if (!r.ok) throw new Error(`${a.tipo}: ${r.motivo}`); return r; };
  E(A, { tipo: 'rellenar', cantidad: 500 });
  E(A, { tipo: 'mojon', x: 500, z: 500 });
  E(B, { tipo: 'mojon', x: 3500, z: 3500 });
  const r = E(A, { tipo: 'colocar', pieza: 'cim_piedra', x: 504, z: 500, k: 0, rot: 0, dir: 0 });
  if (r.obra) acabarObra(m, reg, A, r.construccion.id, r.clave);
  E(B, { tipo: 'colocar', pieza: 'cim_piedra', x: 3504, z: 3500, k: 0, rot: 0, dir: 0 });
  return { m, reg };
}

console.log('Lógica pura');
{
  const { m } = montar();
  comprobar('Ana tiene una obra terminada; Bruno, solo una a medias', tieneObraTerminada(m, A) && !tieneObraTerminada(m, B));
  const ab = new Abandono();
  ab.visto(A, T0); ab.visto(B, T0);
  let r = ab.revisar(m, T0 + DIA);
  comprobar('al día siguiente, nada', !r.liberar.length && !r.avisar.length, JSON.stringify(r));
  r = ab.revisar(m, T0 + 8.5 * DIA);
  comprobar('Bruno (15 días, sin obra terminada): aviso de la semana a los 8 días y medio', r.avisar.length === 1 && r.avisar[0].dueno === B && r.avisar[0].que === 'semana' && r.avisar[0].dias === DIAS_SIN_OBRA, JSON.stringify(r.avisar));
  r = ab.revisar(m, T0 + 9 * DIA);
  comprobar('el aviso de la semana, una sola vez', !r.avisar.length);
  r = ab.revisar(m, T0 + 14.2 * DIA);
  comprobar('Bruno: el del último día a los 14,2 días', r.avisar.length === 1 && r.avisar[0].que === 'ultimo' && r.avisar[0].dueno === B, JSON.stringify(r.avisar));
  r = ab.revisar(m, T0 + 15 * DIA + 1);
  comprobar('Bruno: a los 15 días, a liberar; Ana, no', r.liberar.length === 1 && r.liberar[0].dueno === B && r.liberar[0].dias === 15, JSON.stringify(r.liberar));
  // Ana invita a Carla; Carla entra el día 20: el plazo de Ana empieza otra vez
  ejecutar(m, new RegistroAcciones(), { autor: A, tipo: 'invitar', a: C });
  ab.visto(C, T0 + 20 * DIA);
  r = ab.revisar(m, T0 + 25 * DIA);
  comprobar('Ana: si entra su invitada el día 20, el día 25 no hay aviso', !r.avisar.some(v => v.dueno === A) && !r.liberar.some(v => v.dueno === A), JSON.stringify(r));
  r = ab.revisar(m, T0 + 31 * DIA);
  comprobar('Ana: el día 31 tampoco se libera (cuenta desde que entró Carla)', !r.liberar.some(v => v.dueno === A));
  r = ab.revisar(m, T0 + 43.5 * DIA);
  comprobar('Ana: aviso de la semana el día 43,5 (30 días desde el 20)', r.avisar.some(v => v.dueno === A && v.que === 'semana' && v.dias === DIAS), JSON.stringify(r.avisar));
  ab.visto(A, T0 + 44 * DIA);
  r = ab.revisar(m, T0 + 70 * DIA);
  comprobar('si entra Ana, los avisos vuelven a empezar (el de la semana otra vez)', r.avisar.some(v => v.dueno === A && v.que === 'semana'), JSON.stringify(r.avisar));
  r = ab.revisar(m, T0 + 73.5 * DIA);
  comprobar('y el del último día', r.avisar.some(v => v.dueno === A && v.que === 'ultimo'));
  const copia = new Abandono(JSON.parse(JSON.stringify(ab.exportar())));
  comprobar('se guarda y se recupera igual', JSON.stringify(copia.exportar()) === JSON.stringify(ab.exportar()));
  r = ab.revisar(m, T0 + 74 * DIA + 1);
  comprobar('Ana: a los 30 días desde que entró, a liberar', r.liberar.some(v => v.dueno === A));
  // los de antes, sin nada apuntado
  const nuevo = new Abandono(), { m: m2 } = montar();
  r = nuevo.revisar(m2, T0 + 100 * DIA);
  comprobar('sin nada apuntado: empiezan a contar desde la primera revisión (nada se libera de golpe)', !r.liberar.length && !r.avisar.length && nuevo.vistos[A] === T0 + 100 * DIA);
}

console.log('La acción del rey');
{
  const { m, reg } = montar();
  ejecutar(m, reg, { autor: A, tipo: 'invitar', a: C });
  const n = m.construcciones.length, piezas = m.construcciones.reduce((s, c) => s + c.piezas.size, 0);
  let r = ejecutar(m, reg, { autor: B, tipo: 'tierra_al_rey', dueno: A });
  comprobar('un jugador no puede devolver la tierra de otro', !r.ok && !!m.mojonDe(A), r.motivo);
  r = ejecutar(m, reg, { autor: A, tipo: 'tierra_al_rey', dueno: A });
  comprobar('ni la suya (para eso está quitar el mojón)', !r.ok && !!m.mojonDe(A), r.motivo);
  r = ejecutar(m, reg, { autor: AUTOR_REY, tipo: 'tierra_al_rey', dueno: A });
  comprobar('el rey sí: el mojón y los invitados se van', r.ok && !m.mojonDe(A) && !m.invitadosDe(A).length && m.tierraDe(504, 500) === null, JSON.stringify(r));
  comprobar('lo construido se queda (ruina)', m.construcciones.length === n && m.construcciones.reduce((s, c) => s + c.piezas.size, 0) === piezas && r.ruinas && r.ruinas.piezas >= 1, JSON.stringify(r.ruinas));
  const c = m.construcciones.find(x => Math.floor(x.ox / 1000) === 0);
  const k = [...c.piezas.keys()][0];
  comprobar('y cualquiera puede desmontarlo', m.puedeTocar(c.ox, c.oz, B).ok);
  r = ejecutar(m, reg, { autor: AUTOR_REY, tipo: 'tierra_al_rey', dueno: A });
  comprobar('dos veces no', !r.ok);
  r = ejecutar(m, reg, { autor: C, tipo: 'mojon', x: 600, z: 600 });
  comprobar('la zona se puede volver a reclamar', r.ok && m.tierraDe(504, 500) === C, r.motivo);
  r = ejecutar(m, reg, { autor: B, tipo: 'desmontar', construccion: c.id, clave: k });
  comprobar('(y ya es de quien la reclama: Bruno no desmonta)', !r.ok);
  const re = reproducir(reg.exportar());
  comprobar('rehecho desde el registro da el mismo mundo', JSON.stringify(re.exportar()) === JSON.stringify(m.exportar()));
}

console.log('En el servidor de verdad');
function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + ficha : ''}`);
    const c = { ws, cuentas: [], acciones: [], resultados: [], copia: new MundoEnLinea((m) => ws.send(JSON.stringify(m))) };
    c.cerrado = new Promise(r => ws.on('close', r));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    let id = 0;
    const esperar = async (lista, n) => { for (let k = 0; k < 250; k++) { const r = lista.find(a => a.id === n); if (r) return r; await pausa(20); } return null; };
    c.cuenta = async (usuario) => {
      const n = ++id; c.mandar({ tipo: 'cuenta', id: n, que: 'crear', usuario, clave: 'una-contraseña-larga', correo: usuario.toLowerCase() + '@ejemplo.com', idioma: 'es' });
      const r = await esperar(c.cuentas, n);
      const carta = cartas.filter(x => x.usuario === usuario).at(-1);
      const m = ++id; c.mandar({ tipo: 'cuenta', id: m, que: 'verificar', codigo: carta && carta.codigo });
      return [r, await esperar(c.cuentas, m)];
    };
    c.accion = async (a) => { const n = ++id; c.mandar({ tipo: 'accion', id: n, accion: a }); return esperar(c.resultados, n); };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      c.copia.recibir(m);
      if (m.tipo === 'bienvenida') { c.yo = m.autor; c.ficha = m.ficha; listo(c); }
      if (m.tipo === 'cuenta') c.cuentas.push(m);
      if (m.tipo === 'resultado') c.resultados.push(m);
      if (m.tipo === 'accion') c.acciones.push(m.entrada);
    });
    ws.on('error', fallo);
  });
}
const cartas = [];
const cartero = { conClave: true, enviar: async (x) => { cartas.push(x); return { ok: true }; } };
const dir = mkdtempSync(join(tmpdir(), 'kinhold-tierra-'));
const archivo = join(dir, 'mundo.jsonl');
const opciones = { arconPruebas: true, puerto: 0, archivo, cartero, parametrosClave: { N: 1024, r: 8, p: 1 }, altas: { origen: 1e6, total: 1e6, espera: 0 }, limiteMovimiento: false, revisarCada: 0 };
try {
  let s = crearServidor(opciones);
  let puerto = await s.listo;
  const ana = await cliente(puerto), otro = await cliente(puerto);
  const [ra, va] = await ana.cuenta('Ana');
  comprobar('Ana crea su cuenta y confirma el correo', ra && ra.ok && va && va.ok, JSON.stringify(va));
  ana.mandar({ tipo: 'estado', x: 2, y: 0, z: 2, giro: 0, anim: 'quieto' }); await pausa(150);
  let r = await ana.accion({ tipo: 'rellenar', cantidad: 200 });
  await ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });   // el mojón se paga de lo que llevas
  r = await ana.accion({ tipo: 'mojon', x: 2, z: 2 });
  comprobar('Ana pone su mojón', r && r.ok, JSON.stringify(r));
  r = await otro.accion({ tipo: 'tierra_al_rey', dueno: ana.yo });
  comprobar('un jugador tramposo que manda la acción del rey no consigue nada', r && !r.ok && !!s.mundo.mojonDe(ana.yo), JSON.stringify(r));
  const fichaAna = ana.ficha;
  ana.ws.close(); await ana.cerrado; await pausa(100);
  const sale = s.abandono.vistos[ana.yo];
  comprobar('el servidor apunta cuándo estuvo Ana en el mundo', Number.isFinite(sale) && Date.now() - sale < 60000);
  // sin obras terminadas: 15 días
  const n0 = cartas.length;
  s.revisarTierras(sale + 8.5 * DIA);
  const semana = cartas.slice(n0).filter(x => x.tipo === 'tierra_semana');
  comprobar('el día 8,5 llega a su correo el aviso de la semana', semana.length === 1 && semana[0].para === 'ana@ejemplo.com' && semana[0].usuario === 'Ana' && semana[0].dias === 7, JSON.stringify(semana));
  s.revisarTierras(sale + 9 * DIA);
  comprobar('una sola vez', cartas.slice(n0).filter(x => x.tipo === 'tierra_semana').length === 1);
  s.revisarTierras(sale + 14.5 * DIA);
  const ultimo = cartas.slice(n0).filter(x => x.tipo === 'tierra_ultimo');
  comprobar('el día 14,5, el del último día', ultimo.length === 1 && ultimo[0].para === 'ana@ejemplo.com', JSON.stringify(ultimo));
  const antesAcc = otro.acciones.length;
  s.revisarTierras(sale + 15 * DIA + 1000);
  await pausa(150);
  comprobar('el día 15 su tierra vuelve al rey', !s.mundo.mojonDe(ana.yo));
  const llega = otro.acciones.slice(antesAcc);
  comprobar('a los conectados les llega la acción del rey', llega.length === 1 && llega[0].autor === AUTOR_REY && llega[0].tipo === 'tierra_al_rey', JSON.stringify(llega));
  comprobar('y su copia del mundo queda igual que la del servidor', JSON.stringify(otro.copia.mundo.mojones) === JSON.stringify(s.mundo.mojones) && !otro.copia.mundo.mojonDe(ana.yo));
  const reg = existsSync(s.archivoTierras) ? readFileSync(s.archivoTierras, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  comprobar('en tierras.jsonl: los dos avisos y la tierra devuelta, con la cuenta', reg.filter(e => e.que === 'aviso').length === 2 && reg.some(e => e.que === 'al_rey' && e.dueno === ana.yo && e.cuenta === 'Ana' && e.ok && e.dias === 15), JSON.stringify(reg));
  comprobar('en el mundo, la acción del rey', readFileSync(archivo, 'utf8').includes('"tierra_al_rey"'));
  await s.cerrar();
  // reiniciar: sigue libre y Ana pone otro mojón; ahora con una obra terminada
  s = crearServidor(opciones); puerto = await s.listo;
  comprobar('tras reiniciar, sigue libre', !s.mundo.mojonDe(ana.yo) && Number.isFinite(s.abandono.vistos[ana.yo]));
  const ana2 = await cliente(puerto, fichaAna);
  comprobar('Ana vuelve con su ficha', ana2.yo === ana.yo);
  ana2.mandar({ tipo: 'estado', x: 2, y: 0, z: 2, giro: 0, anim: 'quieto' }); await pausa(150);
  await ana2.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
  r = await ana2.accion({ tipo: 'mojon', x: 2, z: 2 });
  comprobar('Ana reclama otra vez su zona', r && r.ok, JSON.stringify(r));
  const t1 = Date.now();
  ana2.ws.close(); await ana2.cerrado; await pausa(100);
  { const rc = ejecutar(s.mundo, new RegistroAcciones(), { autor: ana.yo, tipo: 'colocar', pieza: 'cim_piedra', x: 5, z: 2, k: 0, rot: 0, dir: 0 }); if (rc.ok && rc.obra) acabarObra(s.mundo, new RegistroAcciones(), ana.yo, rc.construccion.id, rc.clave); }
  comprobar('(con una obra terminada en su tierra)', tieneObraTerminada(s.mundo, ana.yo));
  s.revisarTierras(t1 + 20 * DIA);
  comprobar('con obra terminada, el día 20 sigue siendo suya', !!s.mundo.mojonDe(ana.yo));
  s.revisarTierras(t1 + 30 * DIA + 60000);
  comprobar('el día 30, al rey', !s.mundo.mojonDe(ana.yo));
  await s.cerrar();
} catch (e) { mal++; console.log('  FALLA error:', e && e.stack); }
finally { rmSync(dir, { recursive: true, force: true }); }

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
