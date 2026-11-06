// Prueba de la herramienta del admin en el servidor (valravnx, 6 nov; src/logica/admin.js): «más información, el modo
// autoconstruir (construir de una sin materiales), el arcón de admin para invocarse lo que sea y multiplicar la
// velocidad de carrera». (La cámara libre es solo del navegador: la prueba «Navegador: panel del admin».)
// Ejecutar: node pruebas/prueba_admin_herramienta.mjs
// Comprueba, con clientes de verdad por websocket y el límite de velocidad puesto:
//   - «ver» trae la información del servidor (conectados, cuentas, obras, mojones…) y la de donde estás, y los modos;
//   - otra cuenta no puede cambiar modos ni invocar nada, ni mandar la acción que termina obras (admin_terminar);
//   - invocar mete el objeto en lo que lleva el admin y, si no le cabe, lo deja a sus pies; con datos raros, no;
//   - con autoconstruir, el mojón y un mueble no cobran nada y la obra que pone queda terminada (al admin y a los demás
//     les llega la acción que la termina); sin él, la obra queda a medias y el mueble no se pone sin materiales;
//   - al volver a arrancar el servidor, todo eso sigue igual (se rehace del registro del mundo);
//   - con la velocidad ×10, el servidor le deja moverse diez veces más deprisa; sin ella, le recorta; a otra cuenta, no;
//   - los modos se apagan al desconectarse; cada petición queda en admin.jsonl.
// Con MUTAR=1 se prueba un servidor que acepta admin_terminar de cualquiera: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { validarPeticionAdmin, aplicarModo, MODOS_INICIALES, infoServidor, INVOCAR_MAX } from '../src/logica/admin.js';
import { PresenciaServidor, CREDITO_MAX } from '../src/logica/presencia.js';
import { Mundo } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';
import { MundoEnLinea } from '../src/logica/en_linea.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let ruta = join(raiz, 'servidor/servidor.mjs'), copia = null;
if (MUTAR) {
  const fuente = readFileSync(ruta, 'utf8');
  const mutada = fuente.replace("const soloServidor = accion.tipo === 'admin_terminar' || accion.tipo === 'tierra_al_rey';", 'const soloServidor = false;');
  if (mutada === fuente) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  copia = join(raiz, 'servidor/.servidor_mutado_herramienta.mjs');
  writeFileSync(copia, mutada);
  ruta = copia;
}
const { crearServidor } = await import(pathToFileURL(ruta).href);

function cliente(puerto) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, admin: [], cuentas: [], resultados: [], acciones: [], inventarios: [], suelos: [], estados: [] };
    c.cerrado = new Promise(r => ws.on('close', r));
    c.mandar = (m) => ws.send(JSON.stringify(m));
    c.estado = (x, z, giro = 0, y = 2) => c.mandar({ tipo: 'estado', x, y, z, giro, anim: 'quieto' });
    let id = 0;
    const esperar = async (lista, n, ms = 2000) => { for (let k = 0; k < ms / 20; k++) { const r = lista.find(a => a.id === n); if (r) return r; await pausa(20); } return null; };
    c.admin1 = (m) => { const n = ++id; c.mandar({ tipo: 'admin', id: n, ...m }); return esperar(c.admin, n); };
    c.accion = (accion) => { const n = ++id; c.mandar({ tipo: 'accion', id: n, accion }); return esperar(c.resultados, n); };
    c.cuenta1 = async (usuario) => {
      const n = ++id; c.mandar({ tipo: 'cuenta', id: n, que: 'crear', usuario, clave: 'una-contraseña-larga', correo: usuario.toLowerCase() + '@ejemplo.com' });
      const r = await esperar(c.cuentas, n, 5000);
      if (r && r.ok) {
        const carta = cartas.filter(x => x.usuario === r.usuario).at(-1);
        const m = ++id; c.mandar({ tipo: 'cuenta', id: m, que: 'verificar', codigo: carta && carta.codigo });
        r.confirmado = await esperar(c.cuentas, m, 5000);
      }
      return r;
    };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') { c.yo = m.autor; c.bienvenida = m; listo(c); }
      if (m.tipo === 'admin') c.admin.push(m);
      if (m.tipo === 'cuenta') c.cuentas.push(m);
      if (m.tipo === 'resultado') c.resultados.push(m);
      if (m.tipo === 'accion') c.acciones.push(m);
      if (m.tipo === 'inventario') c.inventarios.push(m.inventario);
      if (m.tipo === 'suelo') c.suelos.push(m.objetos);
    });
    ws.on('error', fallo);
  });
}
const tiene = (inv, tipo) => JSON.stringify(inv || {}).includes(`"tipo":"${tipo}"`);

const cartas = [];
const cartero = { conClave: true, enviar: async (x) => { cartas.push(x); return { ok: true }; } };
const BARATO = { N: 1 << 10, r: 8, p: 1 };
const CORREO_ADMIN = 'valravnx@ejemplo.com';
const dir = mkdtempSync(join(tmpdir(), 'kinhold-herramienta-'));
const archivo = join(dir, 'mundo.jsonl');
const opciones = { arconPruebas: false, puerto: 0, archivo, adminCorreo: CORREO_ADMIN, parametrosClave: BARATO, cartero, altas: { origen: 1e6, total: 1e6, espera: 0 }, limiteMovimiento: true };
try {
  console.log('Lógica pura');
  comprobar('«modo» con autoconstruir o una velocidad de la lista vale', !!validarPeticionAdmin({ que: 'modo', autoconstruir: true }) && !!validarPeticionAdmin({ que: 'modo', velocidad: 10 }));
  comprobar('«modo» vacío, con una velocidad que no está o con autoconstruir que no es sí o no, no vale', [{}, { velocidad: 4 }, { velocidad: 1000 }, { autoconstruir: 'si' }].every(m => validarPeticionAdmin({ que: 'modo', ...m }) === null));
  comprobar('«invocar» un objeto del catálogo vale; uno que no existe, «__proto__» o cantidades raras, no',
    !!validarPeticionAdmin({ que: 'invocar', objeto: 'hacha_hierro', cantidad: 1 }) && [['nada', 1], ['__proto__', 1], ['toString', 1], ['piedra', 0], ['piedra', INVOCAR_MAX + 1], ['piedra', 1.5], ['piedra', '3']].every(([o, n]) => validarPeticionAdmin({ que: 'invocar', objeto: o, cantidad: n }) === null));
  comprobar('los modos empiezan apagados y «modo» cambia solo lo que dice', MODOS_INICIALES.autoconstruir === false && MODOS_INICIALES.velocidad === 1
    && JSON.stringify(aplicarModo({ autoconstruir: true, velocidad: 5 }, { que: 'modo', velocidad: 2 })) === '{"autoconstruir":true,"velocidad":2}');
  const i = infoServidor({ conectados: 2.4, sitio: { x: 1.234, y: 2.26, z: -3 }, zona: 12, raro: 'x' });
  comprobar('la información sale limpia (números enteros, el sitio redondeado, sin lo que no toca)', i.conectados === 2 && i.sitio.x === 1.2 && i.sitio.y === 2.3 && i.zona === '12' && !('raro' in i) && i.piezas === 0);
  {
    const p = new PresenciaServidor();
    const t = 1e6; p.anclar('a', { x: 0, z: 0 }, t); p.anclar('b', { x: 0, z: 0 }, t);
    const ra = p.recibir('a', { x: 100, y: 0, z: 30, giro: 0, anim: 'correr' }, t + 3000, { vel: 10 });
    const rb = p.recibir('b', { x: 100, y: 0, z: 30, giro: 0, anim: 'correr' }, t + 3000);
    comprobar('presencia: con vel 10, 104 m en 3 s pasan; sin ella, se recorta a lo que da el crédito', ra && ra.recortado === 0 && rb && rb.recortado > 0 && Math.hypot(rb.estado.x, rb.estado.z) <= CREDITO_MAX + 1e-6, `${ra && ra.recortado} · ${rb && Math.hypot(rb.estado.x, rb.estado.z).toFixed(1)}`);
  }
  {
    const m = new Mundo(), reg = new RegistroAcciones();
    ejecutar(m, reg, { autor: 'jugador:a', tipo: 'mojon', x: 0, z: 0, lleva: true });
    const r = ejecutar(m, reg, { autor: 'jugador:a', tipo: 'colocar', pieza: 'cim_piedra', x: 3, z: 0, k: 0, rot: 0, dir: 0 });
    const c = m.construcciones[0], q = c && c.piezas.get(r.clave);
    const r2 = ejecutar(m, reg, { autor: 'jugador:a', tipo: 'admin_terminar', construccion: c.id, clave: r.clave });
    comprobar('admin_terminar deja la obra terminada (en la lógica; quién la manda lo mira el servidor)', r.ok && r.obra && r2.ok && q && !q.obra, JSON.stringify(r2));
    const m2 = reproducir(reg.entradas);
    const q2 = m2.construcciones[0] && m2.construcciones[0].piezas.get(r.clave);
    comprobar('y al rehacer el mundo del registro, también', q2 && !q2.obra);
  }

  {
    // el navegador (src/logica/en_linea.js): con autoconstruir adelanta el mojón sin cobrar y ve la obra terminada
    const enviados = [], ml = new MundoEnLinea((m) => enviados.push(m));
    ml.recibir({ tipo: 'bienvenida', autor: 'jugador:adm', entradas: [] });
    const sin = ml.accion({ tipo: 'mojon', x: 0, z: 0 });
    ml.modosAdmin = { autoconstruir: true, velocidad: 1 };
    const con = ml.accion({ tipo: 'mojon', x: 0, z: 0 });
    comprobar('navegador: sin autoconstruir, el mojón no se adelanta sin materiales; con él, sí (y no manda «lleva»)', !sin.ok && con.ok && enviados.length === 1 && !('lleva' in enviados[0].accion), JSON.stringify([sin.motivo, enviados]));
    ml.recibir({ tipo: 'resultado', id: enviados[0].id, ok: true });
    ml.recibir({ tipo: 'accion', entrada: { autor: 'jugador:adm', tipo: 'mojon', datos: { x: 0, z: 0, lleva: true }, ok: true } });
    const c1 = ml.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 3, z: 0, k: 0, rot: 0, dir: 0 });
    ml.recibir({ tipo: 'resultado', id: enviados[1].id, ok: true });
    ml.recibir({ tipo: 'accion', entrada: { autor: 'jugador:adm', tipo: 'colocar', datos: { pieza: 'cim_piedra', x: 3, z: 0, k: 0, rot: 0, dir: 0 }, ok: true } });
    const cc = ml.base.construcciones[0];
    const r = ml.recibir({ tipo: 'accion', entrada: { autor: 'jugador:adm', tipo: 'admin_terminar', datos: { construccion: cc && cc.id, clave: c1.clave }, ok: true } });
    comprobar('navegador: al llegar admin_terminar (propia), la obra queda terminada y se vuelve a dibujar', c1.ok && r.cambio === true && cc && !cc.piezas.get(c1.clave).obra, JSON.stringify(r));
    ml.recibir({ tipo: 'bienvenida', autor: 'jugador:adm', entradas: [] });
    comprobar('navegador: al volver a conectar, los modos se apagan', ml.modosAdmin.autoconstruir === false && ml.modosAdmin.velocidad === 1);
  }

  let s = crearServidor(opciones);
  let puerto = await s.listo;
  let admin = await cliente(puerto), otro = await cliente(puerto);
  await admin.cuenta1('ValRavnX'); await otro.cuenta1('Berta');
  admin.estado(5, 5); otro.estado(9, 5); await pausa(200);

  console.log('Más información al abrir el panel');
  let r = await admin.admin1({ que: 'ver' });
  comprobar('«ver» trae la información del servidor', r && r.ok && r.info && r.info.conectados === 2 && r.info.cuentas === 2 && r.info.construcciones === 0 && r.info.arranque > 0 && r.info.ahora >= r.info.arranque, JSON.stringify(r && r.info));
  comprobar('y la de donde estás, y los modos (apagados)', r && r.info.sitio && r.info.sitio.x === 5 && r.info.sitio.z === 5 && r.info.tierraDe === null && r.modos && r.modos.autoconstruir === false && r.modos.velocidad === 1, JSON.stringify(r && [r.info.sitio, r.modos]));

  console.log('Solo la cuenta de admin');
  r = await otro.admin1({ que: 'modo', autoconstruir: true });
  comprobar('otra cuenta no cambia modos', r && r.ok === false);
  r = await otro.admin1({ que: 'invocar', objeto: 'hacha_hierro', cantidad: 1 });
  comprobar('ni invoca nada', r && r.ok === false && !tiene(s.objetos.inventarioDe(otro.yo), 'hacha_hierro'));

  console.log('El arcón de admin');
  const antesInv = admin.inventarios.length;
  r = await admin.admin1({ que: 'invocar', objeto: 'hacha_hierro', cantidad: 1 });
  await pausa(100);
  comprobar('invocar un hacha de hierro: va a lo que lleva el admin', r && r.ok && !r.alSuelo && tiene(s.objetos.inventarioDe(admin.yo), 'hacha_hierro'), JSON.stringify(r));
  comprobar('y le llega lo que lleva', admin.inventarios.slice(antesInv).some(i => tiene(i, 'hacha_hierro')));
  r = await admin.admin1({ que: 'invocar', objeto: 'piedra', cantidad: 200 });
  await pausa(100);
  const pila = s.objetos.sueloVisible(Date.now()).find(o => o.cosa.tipo === 'piedra');
  comprobar('200 piedras no le caben: van a sus pies y las ven los dos', r && r.ok && r.alSuelo && pila && pila.cosa.n === 200 && Math.hypot(pila.x - 5, pila.z - 5) < 0.5 && otro.suelos.some(l => l.some(o => o.cosa.tipo === 'piedra')), JSON.stringify(r));
  r = await admin.admin1({ que: 'invocar', objeto: 'nada', cantidad: 1 });
  comprobar('un objeto que no existe, no', r && r.ok === false);

  console.log('Autoconstruir');
  let ra = await admin.accion({ tipo: 'mojon', x: 5, z: 5 });
  comprobar('sin autoconstruir, el mojón cuesta piedras que no lleva', ra && ra.ok === false, JSON.stringify(ra));
  r = await admin.admin1({ que: 'modo', autoconstruir: true });
  comprobar('se activa', r && r.ok && r.modos.autoconstruir === true && r.modos.velocidad === 1, JSON.stringify(r));
  ra = await admin.accion({ tipo: 'mojon', x: 5, z: 5 });
  comprobar('con él, el mojón se pone sin cobrar nada', ra && ra.ok && !!s.mundo.mojonDe(admin.yo), JSON.stringify(ra));
  const nAcc = admin.acciones.length, nOtro = otro.acciones.length;
  ra = await admin.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 8, z: 5, k: 0, rot: 0, dir: 0 });
  await pausa(150);
  const c = s.mundo.construcciones.at(-1), clave = c && [...c.piezas.keys()].find(k => c.piezas.get(k).tipo === 'cim_piedra');
  comprobar('el cimiento queda terminado al momento', ra && ra.ok && clave && !c.piezas.get(clave).obra, JSON.stringify(ra));
  const fin = admin.acciones.slice(nAcc).find(m => m.entrada.tipo === 'admin_terminar');
  comprobar('al admin le llega la acción que lo termina, detrás del colocar', !!fin && admin.acciones.slice(nAcc).findIndex(m => m.entrada.tipo === 'colocar') < admin.acciones.slice(nAcc).indexOf(fin) && fin.entrada.datos.clave === clave);
  comprobar('y al otro jugador también', otro.acciones.slice(nOtro).some(m => m.entrada.tipo === 'admin_terminar'));
  ra = await admin.accion({ tipo: 'decorar', pieza: 'banco', x: 6, y: 0, z: 6, rot: 0 });
  comprobar('un banco (2 tablas y 2 clavos) se pone sin llevarlos', ra && ra.ok && s.mundo.decoracion.some(d => d.pieza === 'banco' || d.tipo === 'banco'), JSON.stringify(ra));
  r = await admin.admin1({ que: 'modo', autoconstruir: false });
  ra = await admin.accion({ tipo: 'colocar', pieza: 'cim_piedra', x: 10, z: 5, k: 0, rot: 0, dir: 0 });
  await pausa(100);
  const c2 = s.mundo.construcciones.at(-1), k2 = c2 && [...c2.piezas.keys()].filter(k => c2.piezas.get(k).tipo === 'cim_piedra');
  comprobar('apagado: la obra nueva queda a medias, como siempre', ra && ra.ok && k2 && k2.some(k => c2.piezas.get(k).obra), JSON.stringify(ra));
  ra = await admin.accion({ tipo: 'decorar', pieza: 'banco', x: 7, y: 0, z: 7, rot: 0 });
  comprobar('y un mueble sin materiales, no', ra && ra.ok === false);
  // la obra a medias: nadie la termina mandando admin_terminar (solo la crea el servidor)
  const medias = k2 && k2.find(k => c2.piezas.get(k).obra);
  ra = await otro.accion({ tipo: 'admin_terminar', construccion: c2 ? c2.id : 1, clave: medias || 'x' });
  comprobar('nadie puede mandar admin_terminar', ra && ra.ok === false && medias && !!c2.piezas.get(medias).obra, JSON.stringify(ra));
  const ra2 = await admin.accion({ tipo: 'admin_terminar', construccion: c2 ? c2.id : 1, clave: medias || 'x' });
  comprobar('…ni el admin (solo la crea el servidor, tras su «colocar» con autoconstruir)', ra2 && ra2.ok === false && medias && !!c2.piezas.get(medias).obra);
  r = await admin.admin1({ que: 'ver' });
  comprobar('la información cuenta lo construido', r && r.info.construcciones >= 1 && r.info.mojones === 1 && r.info.muebles === 1 && r.info.obrasAMedias === 1 && r.info.tierraDe === admin.yo, JSON.stringify(r && r.info));

  console.log('Velocidad multiplicada');
  admin.estado(5, 5); otro.estado(9, 5); await pausa(2200);   // que se llene el crédito
  admin.estado(120, 5); otro.estado(124, 5); await pausa(150);
  let v = await admin.admin1({ que: 'ver' });
  const xDe = (lista, a) => (lista.find(j => j.autor === a) || {}).x;
  comprobar('sin multiplicar, el servidor recorta un salto de 115 m', xDe(v.jugadores, admin.yo) < 30 && xDe(v.jugadores, otro.yo) < 30, `${xDe(v.jugadores, admin.yo)} · ${xDe(v.jugadores, otro.yo)}`);
  r = await admin.admin1({ que: 'modo', velocidad: 10 });
  comprobar('×10 se activa', r && r.ok && r.modos.velocidad === 10 && r.modos.autoconstruir === false, JSON.stringify(r && r.modos));
  await pausa(2200);
  const x0 = xDe(v.jugadores, admin.yo);
  admin.estado(x0 + 115, 5); otro.estado(xDe(v.jugadores, otro.yo) + 115, 5); await pausa(150);
  v = await admin.admin1({ que: 'ver' });
  comprobar('con ×10, el admin sí llega (115 m tras 2 s quieto)', Math.abs(xDe(v.jugadores, admin.yo) - (x0 + 115)) < 1e-6, `${xDe(v.jugadores, admin.yo)}`);
  comprobar('otra cuenta sigue recortada', xDe(v.jugadores, otro.yo) < x0 + 60, `${xDe(v.jugadores, otro.yo)}`);

  console.log('El registro');
  const reg = readFileSync(s.archivoAdmin, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  comprobar('modos e invocaciones quedan en admin.jsonl, con su autor y lo pedido', reg.some(e => e.que === 'modo' && e.ok && e.autoconstruir === true && e.autor === admin.yo) && reg.some(e => e.que === 'modo' && e.velocidad === 10) && reg.some(e => e.que === 'invocar' && e.ok && e.objeto === 'hacha_hierro' && e.cantidad === 1) && reg.some(e => e.que === 'modo' && !e.ok && e.autor === otro.yo), `${reg.length} líneas`);

  console.log('Al desconectarse y al volver a arrancar');
  const foto = JSON.stringify(s.mundo.exportar());
  admin.ws.close(); await admin.cerrado; await pausa(100);
  admin = await cliente(puerto);
  comprobar('(otra conexión sin cuenta no es admin)', admin.bienvenida.admin === false);
  admin.ws.close(); await admin.cerrado;
  otro.ws.close(); await otro.cerrado;
  await s.cerrar();
  s = crearServidor(opciones); puerto = await s.listo;
  comprobar('el mundo se rehace igual del registro (mojón y mueble sin cobrar, la obra terminada)', JSON.stringify(s.mundo.exportar()) === foto);
  await s.cerrar();
} catch (e) {
  mal++; console.log('  FALLA', e && e.stack || e);
} finally {
  rmSync(dir, { recursive: true, force: true });
  if (copia && existsSync(copia)) rmSync(copia);
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
