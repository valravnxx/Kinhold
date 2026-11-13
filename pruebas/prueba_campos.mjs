// Marcar el campo con estacas (P11, la granja básica). Ejecutar: node pruebas/prueba_campos.mjs
// Comprueba, en la lógica pura y con el autor de cada acción (src/logica/campos.js, src/logica/acciones.js):
// la estaca se hace con 1 rama, con las manos; sin mojón no se clava; cada estaca sale de lo que llevas; con 3 o más,
// la que se clava junto a la primera cierra el campo (sin gastar otra) con su superficie en m²; fuera de tu tierra, a
// través del agua, de una pendiente, de una obra, de un puesto o de otro campo, no; el linde no se cruza consigo mismo;
// como mucho 16 estacas; quitar una la devuelve a lo que llevas y deja el campo abierto para moverla; el invitado marca
// en la tierra de quien le invita y el extraño no; lo rechazado no cambia nada; rehecho desde el registro (sin cobrar
// otra vez) da el mismo mundo; se guarda y se lee; y el servidor de verdad la valida con el autor de la conexión, con lo
// que lleva y donde lo tiene, y la reparte a los demás.
// Con MUTAR=1 el linde no mira si cruza otro campo: debe FALLAR.
import { Mundo, ponerZonas } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';
import { Inventarios } from '../src/logica/inventario.js';
import { RECETAS } from '../src/logica/fabricacion.js';
import * as C from '../src/logica/campos.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { crearServidor } from '../servidor/servidor.mjs';

const MUTAR = process.env.MUTAR === '1';
if (MUTAR) globalThis.__mutarCampos = true;   // src/logica/campos.js deja de mirar los lindes de los otros campos
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const A = 'jugador:ana', B = 'jugador:bruno', X = 'jugador:xavi';
const foto = (m) => JSON.stringify(m.exportar());

comprobar('la estaca: 1 rama, con las manos', RECETAS.estaca && RECETAS.estaca.uso === 'manos' && JSON.stringify(RECETAS.estaca.gasta) === '{"rama":1}' && RECETAS.estaca.da === 'estaca');

ponerZonas((x, z) => `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`);
const m = new Mundo(), reg = new RegistroAcciones(), invs = new Inventarios();
const H = (autor, a, conInv = true) => { if (a.tipo === 'estaca' && !H.sin) dar(autor); return ejecutar(m, reg, { autor, ...a }, conInv ? invs : null); };
// el entorno de pruebas: agua en la franja 480 < x < 485, una cuesta en z < 465, un puesto en (510, 510)
m.entorno = { agua: (x) => x > 480 && x < 485, pendiente: (x, z) => (z < 465 ? 0.6 : 0.05), ocupado: (x, z) => Math.hypot(x - 510, z - 510) < 1.2 };
// lo que cabe en las manos (sin mochila): se repone antes de cada estaca
const dar = (a) => { const i = invs.de(a); for (let k = 0; k < 9 && i.cuantos('estaca') < 3; k++) if (!i.meterDonde('estaca', 1).ok) break; };

let r = H(A, { tipo: 'estaca', x: 500, z: 500 });
comprobar('sin mojón no se clava', !r.ok && r.motivo === 'Primero coloca tu mojón.', r.motivo);
ejecutar(m, reg, { autor: A, tipo: 'mojon', x: 400, z: 400 });
ejecutar(m, reg, { autor: B, tipo: 'mojon', x: 1400, z: 400 });
const cuantas = (a) => invs.de(a).cuantos('estaca');

r = H(A, { tipo: 'estaca', x: 1500, z: 500 });
comprobar('en la tierra de otro, no', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
r = H(A, { tipo: 'estaca', x: 500, z: 500 });
comprobar('la primera estaca empieza un campo y sale de lo que llevas', r.ok && r.nuevo && m.campos.length === 1 && cuantas(A) === 2, `${r.motivo || ''} quedan ${cuantas(A)}`);
const id = r.campo;
let antes = foto(m);
r = H(A, { tipo: 'estaca', x: 500.4, z: 500.3 });
comprobar('pegada a la anterior, no', !r.ok && r.motivo === 'Ahí ya hay una estaca.' && foto(m) === antes, r.motivo);
r = H(A, { tipo: 'estaca', x: 475, z: 500 });
comprobar('a través del agua, no (y no cambia nada ni cobra)', !r.ok && r.motivo === 'El linde cruza el agua.' && foto(m) === antes && cuantas(A) === 3, r.motivo);
r = H(A, { tipo: 'estaca', x: 500, z: 460 });
comprobar('por una cuesta, no', !r.ok && r.motivo === 'Demasiada pendiente para un campo.', r.motivo);
r = H(A, { tipo: 'estaca', x: 520, z: 520 });
comprobar('a través de un puesto, no', !r.ok && r.motivo === 'El linde cruza un puesto.', r.motivo);
r = H(A, { tipo: 'estaca', x: 500, z: 560 });
comprobar('demasiado lejos de la anterior, no', !r.ok && r.motivo === 'Demasiado lejos de la estaca anterior.', r.motivo);
r = H(A, { tipo: 'estaca', x: 530, z: 500 });
const r3 = H(A, { tipo: 'estaca', x: 530, z: 520 });
comprobar('2.ª y 3.ª estacas', r.ok && r3.ok && r3.estacas === 3, r.motivo || r3.motivo || '');
r = H(A, { tipo: 'estaca', x: 520, z: 490 });
comprobar('el linde no se cruza consigo mismo', !r.ok && r.motivo === 'El linde se cruza consigo mismo.', r.motivo);
dar(A); antes = cuantas(A);
r = H(A, { tipo: 'estaca', x: 500.8, z: 500.8 });
comprobar('la que va junto a la primera cierra el campo, sin gastar otra', r.ok && r.cerrado && cuantas(A) === antes && m.campos[0].cerrado, r.motivo || '');
comprobar('con su superficie en m² (30 × 20 / 2 = 300)', r.area === 300 && m.campos[0].area === 300, String(r.area));
comprobar('y se sabe qué hay dentro', C.campoEn(m, 520, 505) && !C.campoEn(m, 505, 515));

// Bruno, invitado por Ana, marca en la tierra de Ana; un segundo campo no puede cruzar el primero
r = H(B, { tipo: 'estaca', x: 510, z: 470 });
comprobar('sin invitación, Bruno no marca en la tierra de Ana', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
ejecutar(m, reg, { autor: A, tipo: 'invitar', a: B });
r = H(B, { tipo: 'estaca', x: 510, z: 470 });
comprobar('invitado, sí', r.ok, r.motivo || '');
const id2 = r.campo;
r = H(B, { tipo: 'estaca', x: 515, z: 515 });
comprobar('el linde no entra en otro campo', !r.ok && (r.motivo === 'El linde cruza otro campo.' || r.motivo === 'Eso es otro campo.'), r.motivo);
r = H(X, { tipo: 'estaca', x: 520, z: 505 });
comprobar('un extraño, nada', !r.ok, r.motivo);

// como mucho 16 estacas
{
  const m2 = new Mundo(); ejecutar(m2, new RegistroAcciones(), { autor: A, tipo: 'mojon', x: 400, z: 400 });
  let ult;
  for (let k = 0; k < 17; k++) ult = C.clavarEstaca(m2, 300 + k * 3, 300 + (k % 2) * 2, A);
  comprobar('como mucho 16 estacas', !ult.ok && /16 estacas/.test(ult.motivo) && m2.campos[0].puntos.length === 16, ult.motivo);
}

// quitar una estaca: vuelve a lo que llevas y el campo queda abierto, para moverla
invs.de(A).gastar('estaca', 1); antes = cuantas(A);
r = H(A, { tipo: 'quitar_estaca', campo: id, i: 1 });
comprobar('quitar una estaca del campo cerrado: vuelve a lo que llevas y el campo queda abierto', r.ok && cuantas(A) === antes + 1 && !m.campos.find(c => c.id === id).cerrado, r.motivo || '');
const c1 = m.campos.find(c => c.id === id);
comprobar('el campo, abierto, sigue desde la estaca de después', c1.puntos.length === 2 && c1.puntos[0].x === 530 && c1.puntos[0].z === 520, JSON.stringify(c1.puntos));
H.sin = false;
r = H(A, { tipo: 'estaca', x: 535, z: 495 });
const rc = H(A, { tipo: 'estaca', x: 530, z: 521 });
comprobar('se vuelve a clavar en otro sitio y se cierra otra vez', r.ok && rc.ok && rc.cerrado, r.motivo || rc.motivo || '');
r = H(X, { tipo: 'quitar_estaca', campo: id, i: 0 });
comprobar('un extraño no quita estacas', !r.ok && r.motivo === 'Fuera de tu tierra.', r.motivo);
r = H(B, { tipo: 'quitar_estaca', campo: id2, i: 0 });
comprobar('al quitar la única estaca, el campo deja de existir', r.ok && !m.campos.find(c => c.id === id2), r.motivo || '');

// sin estacas no se clava
{
  const inv = invs.de(B); inv.gastar('estaca', inv.cuantos('estaca'));
  H.sin = true;
  r = H(B, { tipo: 'estaca', x: 510, z: 470 });
  comprobar('sin estacas encima, no', !r.ok && r.motivo === 'No llevas ninguna estaca.', r.motivo);
}

// rehecho desde el registro (el servidor al volver a arrancar): lo mismo, y sin cobrar otra vez
const sinEntorno = foto(m);
comprobar('rehecho desde el registro da el mismo mundo', foto(reproducir(reg.exportar())) === sinEntorno);
comprobar('se guarda y se lee (con los campos)', foto(Mundo.importar(JSON.parse(JSON.stringify(m.exportar())))) === sinEntorno && Mundo.importar(m.exportar()).campos.length === m.campos.length);
comprobar('los guardados de antes (sin campos) se leen sin campos', Mundo.importar({ ...m.exportar(), campos: undefined }).campos.length === 0);
// quitar el mojón se lleva los campos de esa tierra
{
  const m3 = Mundo.importar(m.exportar()); m3.quitarMojon(A);
  comprobar('al quitar el mojón se van los campos de su tierra', m3.campos.length === 0);
}

console.log('El servidor de verdad: la estaca, donde estás y de lo que llevas; los demás la ven');
{
  ponerZonas(null);
  const cliente = (puerto) => new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
    const c = { ws, recibidos: [], esperas: [], id: 0 };
    c.esperar = (cond, ms = 3000) => new Promise((r, f) => {
      const ya = c.recibidos.find(cond); if (ya) return r(ya);
      const t = setTimeout(() => f(new Error('tiempo agotado')), ms);
      c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } });
    });
    c.estar = (x, z) => ws.send(JSON.stringify({ tipo: 'estado', x, y: 0, z, giro: 0, anim: 'quieto' }));
    c.accion = (accion) => { const id = ++c.id; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return c.esperar(m => m.tipo === 'resultado' && m.id === id); };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.recibidos.push(m); c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    ws.on('open', async () => { c.bienvenida = await c.esperar(m => m.tipo === 'bienvenida'); listo(c); });
    ws.on('error', fallo);
  });
  const espera = (ms) => new Promise(r => setTimeout(r, ms));
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-campos-'));
  const s = crearServidor({ arconPruebas: true, puerto: 0, archivo: join(dir, 'mundo.jsonl') });
  try {
    const puerto = await s.listo;
    const Ana = await cliente(puerto), Bruno = await cliente(puerto);
    Ana.estar(2, 2); Bruno.estar(4, 2);
    await espera(150);
    await Ana.accion({ tipo: 'sacar_arcon', material: 'piedra', cantidad: 3 });
    const rm = await Ana.accion({ tipo: 'mojon', x: 0, z: 0 });
    const r0 = await Ana.accion({ tipo: 'estaca', x: 2, z: 2 });
    comprobar('sin estacas encima, el servidor no la clava', rm.ok && !r0.ok && r0.motivo === 'No llevas ninguna estaca.', [rm.motivo, r0.motivo].join(' / '));
    const autorAna = Ana.bienvenida.autor;
    s.objetos.invs.de(autorAna).meterDonde('estaca', 3);   // (la preparación: como si se las hubiera hecho con ramas)
    const lejos = await Ana.accion({ tipo: 'estaca', x: 12, z: 2 });
    comprobar('lejos de donde el servidor tiene a Ana, no', !lejos.ok && lejos.motivo === 'Estás demasiado lejos.', lejos.motivo);
    const r1 = await Ana.accion({ tipo: 'estaca', x: 2, z: 2 });
    comprobar('donde está y con estacas encima, sí', r1.ok && s.mundo.campos.length === 1 && s.objetos.invs.de(autorAna).cuantos('estaca') === 2, r1.motivo || '');
    const visto = await Bruno.esperar(m => m.tipo === 'accion' && m.entrada && m.entrada.tipo === 'estaca').catch(() => null);
    comprobar('Bruno la ve (le llega la acción con el autor de Ana)', visto && visto.entrada.autor === autorAna && visto.entrada.datos.lleva === true);
    const rb = await Bruno.accion({ tipo: 'quitar_estaca', campo: s.mundo.campos[0].id, i: 0 });
    comprobar('Bruno no quita la estaca de Ana', !rb.ok && s.mundo.campos.length === 1, rb.motivo);
    Ana.ws.close(); Bruno.ws.close();
  } catch (e) { mal++; console.log('  FALLA la prueba del servidor se cortó:', e.message); }
  await s.cerrar();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
